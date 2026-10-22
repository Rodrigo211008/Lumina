# 루미나 시티 — 자체 서버

친구들과 **같은 주소**로 접속해서 함께 달리는 버전입니다. claude.ai 계정이나 초대가 필요 없습니다.
서버는 게임 페이지(`public/`)를 내보내고, 같은 방 사람끼리 위치·채팅·공격을 중계합니다.

```
server.js      서버 (Node.js, 정적 파일 + WebSocket 중계)
package.json   의존성(ws) · 실행 명령
render.yaml    Render 자동 배포 설정
public/        게임 페이지와 3D 모델 파일
```

## 1. 무료 호스팅 (Render) — 10분

1. **GitHub에 올리기**
   - github.com 가입 → 오른쪽 위 **+ → New repository** → 이름 `lumina-city`, **Public** → Create.
   - 비어 있는 저장소 화면의 **uploading an existing file** 링크 클릭 → 이 폴더 안의 것들(`server.js`, `package.json`, `render.yaml`, `README.md`, `.gitignore`, `public` 폴더)을 **전부 드래그** → 아래 **Commit changes**.
   - `public` 폴더째 끌어다 놓으면 안의 파일도 같이 올라갑니다. `node_modules` 폴더는 올리지 마세요 (있다면).
2. **Render에서 배포**
   - render.com 가입 (GitHub으로 로그인하면 편함).
   - 대시보드 **New + → Web Service** → 방금 만든 `lumina-city` 저장소 선택.
   - 설정: Runtime **Node**, Build Command `npm install`, Start Command `npm start`, Instance Type **Free** → **Create Web Service**.
   - (또는 **New + → Blueprint** → 저장소 선택 → `render.yaml`이 위 설정을 자동으로 채웁니다.)
   - 1~2분 뒤 위쪽에 `https://lumina-city-xxxx.onrender.com` 같은 주소가 생깁니다.
3. **친구에게 주소 공유** → 바로 접속됩니다. 일시정지 → **온라인**에서 닉네임을 정하고, 방 이름을 만들어 친구끼리 모이세요 (비워 두면 로비).

### 알아둘 것
- **무료 플랜**은 15분 동안 아무도 없으면 서버가 잠들고, 다음 접속 때 깨어나는 데 30초~1분 걸립니다. 누군가 접속해 있는 동안은 안 잠듭니다.
- **저장(돈·차·부품)은 각자 브라우저에만** 남습니다 (claude.ai 버전의 계정 저장과는 별개). 브라우저 데이터를 지우면 초기화되니 주의.
- 주소는 자동으로 HTTPS입니다. 한 방에 최대 64명, 서버 전체 600명.
- 게임을 수정하려면 `public/index.html`을 새 버전으로 바꿔 올리면 됩니다 (Render가 자동으로 다시 배포).

## 2. 다른 호스팅
Node.js가 돌아가는 곳이면 그대로 됩니다 — Railway, Koyeb, Fly.io, 개인 VPS 등. `PORT` 환경변수를 주면 그 포트로 열립니다.

## 3. 내 컴퓨터에서 직접 (같은 와이파이 친구들과)
1. nodejs.org에서 Node.js(LTS) 설치.
2. 이 폴더에서 터미널 열고: `npm install` 한 번, 그다음 `npm start`.
3. 내 PC는 `http://localhost:3000`, 같은 와이파이의 친구는 `http://내PC의IP주소:3000` (Windows: `ipconfig`, Mac: 시스템 설정 → 네트워크).
