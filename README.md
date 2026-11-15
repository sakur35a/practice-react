# Diary frontend

React와 Vite로 만든 일기 프런트엔드입니다. 브라우저가 `VITE_API_BASE_URL`의
백엔드 API를 직접 호출합니다. 백엔드는 Cloudflare Tunnel을 통해
`https://api.ssobbs13.pp.ua`로 공개되어 있고, CORS는 백엔드에서 허용합니다.

## 로컬 개발

`.env.development`의 `VITE_API_BASE_URL`을 로컬 백엔드 주소로 지정한 뒤 실행합니다.

```dotenv
VITE_API_BASE_URL=http://localhost:8080/
```

```bash
pnpm install
pnpm dev
```

## Cloudflare Pages 배포

`main`에 push하면 Cloudflare Pages가 자동으로 빌드하고 배포합니다.

```text
Build command: pnpm build
Build output directory: dist
```

배포 빌드는 `.env.production`의 `VITE_API_BASE_URL`을 사용합니다.

```dotenv
VITE_API_BASE_URL=https://api.ssobbs13.pp.ua/
```

## 확인

```bash
pnpm build
pnpm lint
pnpm test
```

`pnpm test`는 Node 내장 테스트 러너(Node 22.18 이상)로 오류 응답 해석(`src/api`)을 확인합니다.
별도 테스트 라이브러리는 쓰지 않습니다. 재시도 정책 시험은 로컬 HTTP 서버로 실제 `ky`를 돌려서 약 10초 걸립니다.
