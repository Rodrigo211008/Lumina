// 루미나 시티 — 자체 서버. 게임 페이지(public/)를 내보내고, 같은 방에 있는 플레이어끼리 위치·채팅·공격을 중계합니다.
// 실행: npm install && npm start   (PORT 환경변수를 주면 그 포트로, 없으면 3000)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');

const PORT = +process.env.PORT || 3000;
// the files this server hands out, all next to it (no folders, so uploading them anywhere is a plain drag-and-drop)
const FILES = { '/': 'index.html', '/index.html': 'index.html', '/models/manifest.json': 'manifest.json', '/models/xevo.glb.txt': 'xevo.glb.txt' };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary' };
const TOPIC = /^[a-z][a-z0-9_.-]{0,47}$/, ROOM = /^[a-z0-9][a-z0-9_.-]{0,47}$/;
const MAX_ROOM = 64, MAX_TOTAL = 600, MAX_DATA = 4096;

/* ---- static files ---- */
const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (p === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok ' + clients.size); }
  const name = FILES[p];
  if (!name) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('not found'); }
  // next to this file, or in public/ (either layout works)
  const here = path.join(__dirname, name), pub = path.join(__dirname, 'public', name.endsWith('index.html') ? name : path.join('models', name));
  const f = fs.existsSync(here) ? here : pub;
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': name === 'index.html' ? 'no-cache' : 'public, max-age=3600' });
    res.end(data);
  });
});

/* ---- the rooms ---- */
const clients = new Set(), rooms = new Map();          // room name -> Set of clients ('' is the lobby)
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
const uid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
const send = (c, obj) => { if (c.ws.readyState === 1) { try { c.ws.send(JSON.stringify(obj)); } catch (e) { /* closing */ } } };
const members = name => rooms.get(name) || new Set();
function enter(c, name) {
  if (c.room === name && c.joined) return;
  leaveRoom(c);
  if (members(name).size >= MAX_ROOM) { send(c, { t: 'error', code: 'limit_reached' }); return; }
  let set = rooms.get(name); if (!set) rooms.set(name, set = new Set());
  set.add(c); c.room = name; c.joined = true; c.presence = {};
  send(c, { t: 'peers', room: name, peers: Array.from(set, o => ({ peer: o.peer, presence: o.presence })) });
  for (const o of set) if (o !== c) send(o, { t: 'join', peer: c.peer, presence: c.presence });
}
function leaveRoom(c) {
  if (!c.joined) return;
  const set = rooms.get(c.room);
  if (set) { set.delete(c); for (const o of set) send(o, { t: 'left', peer: c.peer }); if (!set.size && c.room) rooms.delete(c.room); }
  c.joined = false; c.presence = {};
}
// token buckets: presence ~30/s, moments ~40/s, both with a little burst
function allow(c, k, rate, burst) {
  const now = Date.now(), b = c.bucket[k] || (c.bucket[k] = { n: burst, t: now });
  b.n = Math.min(burst, b.n + (now - b.t) / 1000 * rate); b.t = now;
  if (b.n < 1) return false; b.n -= 1; return true;
}
const sizeOk = v => Buffer.byteLength(JSON.stringify(v === undefined ? null : v)) <= MAX_DATA;
wss.on('connection', ws => {
  if (clients.size >= MAX_TOTAL) { ws.close(1013, 'full'); return; }
  const c = { ws, peer: uid(), room: '', joined: false, presence: {}, bucket: {}, alive: true };
  clients.add(c);
  send(c, { t: 'welcome', peer: c.peer });
  ws.on('pong', () => { c.alive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'join') { const name = typeof m.room === 'string' ? m.room : ''; if (name && !ROOM.test(name)) { send(c, { t: 'error', code: 'invalid_argument' }); return; } enter(c, name); }
    else if (m.t === 'presence') {
      if (!c.joined || !m.p || typeof m.p !== 'object' || !sizeOk(m.p) || !allow(c, 'p', 30, 60)) return;
      c.presence = m.p;
      for (const o of members(c.room)) if (o !== c) send(o, { t: 'presence', peer: c.peer, p: m.p });
    } else if (m.t === 'emit') {
      if (!c.joined || typeof m.topic !== 'string' || !TOPIC.test(m.topic) || !sizeOk(m.data) || !allow(c, 'e', 40, 80)) return;
      for (const o of members(c.room)) send(o, { t: 'event', topic: m.topic, data: m.data, peer: c.peer });
    }
  });
  ws.on('close', () => { leaveRoom(c); clients.delete(c); });
  ws.on('error', () => { /* closed by the peer */ });
});
// dead connections go within a minute; a ping every 25 s also keeps idle proxies from cutting the socket
setInterval(() => { for (const c of clients) { if (!c.alive) { try { c.ws.terminate(); } catch (e) { /* gone */ } continue; } c.alive = false; try { c.ws.ping(); } catch (e) { /* gone */ } } }, 25000);

server.listen(PORT, () => console.log('루미나 시티 서버: http://localhost:' + PORT));
