# Web Route `/subtitles`

## Route

- path: `/subtitles`
- source: `apps/web/src/app/pages/subtitles-extract/page.tsx`
- logic: `apps/web/src/app/pages/subtitles-extract/_hooks/use-subtitles-extract-logic.ts`
- navigation: primary navigation `자막 추출` (desktop header tab / mobile bottom tab)

## 사용자 흐름

1. 사용자는 `mp4`, `mov`, `webm` 파일과 `base_en` 또는 `small_en` 모델을 선택한다.
2. 앱은 영상 metadata로 예상 시간을 표시하고 `GET /health`로 worker를 확인한다.
3. `POST /subtitles/uploads`로 multipart session을 만들고 presigned URL로 파일 part를 직접 업로드한다.
4. `POST /subtitles/uploads/complete` 성공 응답의 UUID와 접수 시각을 자막 접수증으로 저장한다.
5. 현재 route에서 `GET /subtitles/jobs/:jobId`를 polling해 처리·완료·실패·만료 상태를 표시한다.
6. 완료되면 실제 SRT `downloadUrl`을 표시하고, 실패·만료·상태 조회 오류에는 상세와 기존 파일을 유지한 재요청 동작을 제공한다.
7. 업로드 실패 시 `POST /subtitles/uploads/abort` 정리를 best-effort로 요청한다.

## 상태와 오류

- mount 시 과거 접수증을 읽거나 상태 조회를 시작하지 않는다. 현재 화면에서 새로 접수한 job만 조회한다.
- session 생성부터 part upload와 complete 응답까지 주요 navigation의 현재 목적지를 제외한 route와 상단 `설정` 링크의 이동 및 중복 제출을 막는다. 링크는 계속 표시하며 비활성 목적지에는 `aria-disabled="true"`와 잠금 사유를 제공한다.
- complete 성공 뒤 navigation lock을 해제하고 현재 route에서 공유 정책으로 job을 polling한다.
- 파일 검증, 413, direct upload, complete 실패 시 접수증을 저장하거나 history로 이동하지 않는다.
- 접수 뒤 worker health 상태가 바뀌어도 현재 job의 API 상태와 메시지를 우선한다.

## API

- `GET /health`
- `POST /subtitles/uploads`
- R2 presigned URL `PUT`
- `POST /subtitles/uploads/complete`
- `POST /subtitles/uploads/abort`
- `GET /subtitles/jobs/:jobId`
- `GET /subtitles/jobs/:jobId/file`

## 미구현 범위

- `docs/unimplemented/current-unimplemented.md`

## 검증

- `pnpm --filter web run test`
- `pnpm --filter web run lint`
- `pnpm run test:web:browser`
- Browser: 새로고침 후 빈 form, 업로드 중 navigation lock, complete 성공 뒤 in-place 결과·SRT 다운로드, failed/expired·상태 조회 오류의 상세와 재요청
