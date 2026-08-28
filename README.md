# Diary frontend

React와 Vite로 만든 일기 프런트엔드입니다. Cloudflare Pages Functions가
`/api/*` 요청을 백엔드로 프록시하므로, HTTPS로 배포된 페이지에서도 HTTP
백엔드에 브라우저가 직접 연결하지 않습니다.

## 로컬 개발

`.env.development`의 `VITE_API_BASE_URL`을 실제 백엔드 주소로 지정한 뒤 실행합니다.

```dotenv
VITE_API_BASE_URL=http://localhost:8080/
```

```bash
pnpm install
pnpm dev
```

Vite 개발 서버가 `/api/*` 요청을 위 주소로 전달합니다.

## Cloudflare Pages 배포

Pages 프로젝트의 **Settings > Variables and Secrets**에서 다음 변수를 추가합니다.

```text
BACKEND_URL=http://your-backend.example.com/
```

- Production과 Preview 중 필요한 환경에 각각 설정합니다.
- 주소 끝의 `/`는 있어도 되고 없어도 됩니다.
- 백엔드에 별도 기본 경로가 있다면 주소에 포함할 수 있습니다.
- `VITE_API_BASE_URL`은 배포 빌드에서 사용하지 않으므로 제거해도 됩니다.

Pages 빌드 설정은 다음과 같습니다.

```text
Build command: pnpm build
Build output directory: dist
```

저장 후 새 배포를 실행하면 `functions/api/[[path]].ts`가 `/api/*` 요청을
`BACKEND_URL`로 전달합니다. 예를 들어 브라우저의 `/api/diary` 요청은
`BACKEND_URL/diary`로 전달됩니다.

## 확인

```bash
pnpm build
pnpm lint
```
