# Web Route `/video`

## Route

- path: `/video`
- source: `apps/web/src/app/pages/video-extract/page.tsx`
- logic: `apps/web/src/app/pages/video-extract/_hooks/use-video-extract-logic.ts`
- navigation: fixed bottom tab `영상 추출`

## 사용자 흐름

1. 사용자는 YouTube URL, 오디오/비디오 형식, 품질을 선택한다.
2. 앱은 `GET /health`로 worker를 확인하고 `POST /downloads`를 호출한다.
3. 성공 응답의 UUID와 접수 시각을 영상 접수증으로 저장한다.
4. 앱은 `/history?kind=video&jobId=<uuid>`로 이동한다.
5. 저장 실패도 서버 접수를 실패로 바꾸지 않으며 history deep link에서 현재 요청을 조회한다.

## 상태와 오류

- mount 시 과거 접수증을 읽거나 `GET /downloads/:jobId`를 호출하지 않는다.
- 요청 전 health 확인 중·실패·worker unavailable 상태는 form 안에 텍스트로 표시한다.
- URL 검증 또는 POST 실패 시 route를 유지하며 접수증을 저장하지 않는다.
- POST가 진행되는 동안 하단 route 탭과 상단 `요청 내역` 링크의 이동을 막는다. 링크는 계속 표시하며 `aria-disabled="true"`를 제공한다.
- 접수 이후 상태 조회·polling·download는 `/history`가 담당한다.

## API

- `GET /health`
- `POST /downloads`

## 검증

- `pnpm --filter web run test`
- `pnpm --filter web run lint`
- `pnpm run test:web:browser`
- Browser: 새로고침 후 빈 form, 성공 시 history 이동, POST 실패 시 미저장·미이동
