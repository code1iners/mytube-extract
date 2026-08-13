# Web Route `/subtitles`

## Route

- path: `/subtitles`
- source: `apps/web/src/app/pages/subtitles-extract/page.tsx`
- logic: `apps/web/src/app/pages/subtitles-extract/_hooks/use-subtitles-extract-logic.ts`
- navigation: fixed bottom tab `자막 추출`

## 사용자 흐름

1. 사용자는 `mp4`, `mov`, `webm` 파일과 `base_en` 또는 `small_en` 모델을 선택한다.
2. 앱은 영상 metadata로 예상 시간을 표시하고 `GET /health`로 worker를 확인한다.
3. `POST /subtitles/uploads`로 multipart session을 만들고 presigned URL로 파일 part를 직접 업로드한다.
4. `POST /subtitles/uploads/complete` 성공 응답의 UUID와 접수 시각을 자막 접수증으로 저장한다.
5. 앱은 `/history?kind=subtitle&jobId=<uuid>`로 이동한다.
6. 업로드 실패 시 `POST /subtitles/uploads/abort` 정리를 best-effort로 요청한다.

## 상태와 오류

- mount 시 과거 접수증을 읽거나 `GET /subtitles/jobs/:jobId`를 호출하지 않는다.
- session 생성부터 part upload와 complete 응답까지 하단 route 탭과 상단 `요청 내역` 링크의 이동 및 중복 제출을 막는다. 링크는 계속 표시하며 `aria-disabled="true"`를 제공한다.
- complete 성공 뒤에는 요청 route가 navigation lock이나 polling을 유지하지 않는다.
- 파일 검증, 413, direct upload, complete 실패 시 접수증을 저장하거나 history로 이동하지 않는다.
- 접수 이후 상태 조회·polling·SRT download는 `/history`가 담당한다.

## API

- `GET /health`
- `POST /subtitles/uploads`
- R2 presigned URL `PUT`
- `POST /subtitles/uploads/complete`
- `POST /subtitles/uploads/abort`

## 미구현 범위

- `docs/unimplemented/current-unimplemented.md`

## 검증

- `pnpm --filter web run test`
- `pnpm --filter web run lint`
- `pnpm run test:web:browser`
- Browser: 새로고침 후 빈 form, 업로드 중 navigation lock, complete 성공 뒤 history 이동
