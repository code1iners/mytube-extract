# Web Route `/subtitles`

## Route

- path: `/subtitles`
- source: `apps/web/src/app/pages/subtitles-extract/page.tsx`
- logic: `apps/web/src/app/pages/subtitles-extract/_hooks/use-subtitles-extract-logic.ts`
- navigation: primary navigation `자막 추출` (desktop header tab / mobile bottom tab)

## 사용자 흐름

1. 앱은 먼저 `GET /health`를 확인한다. `checking`·`failed`·`unavailable`이면 상태 우선 화면과 재확인을 보여주고, `ready`일 때만 파일·처리 방식 입력을 연다.
2. 준비된 상태에서 사용자는 `mp4`, `mov`, `webm` 로컬 영상 파일을 선택한다. 화면에는 `원본 → 추출 → 파일 수령` 흐름을 표시한다.
3. 사용자는 속도 우선(`base_en`) 또는 정확도 우선(`small_en`) 처리 방식을 비교한 뒤 영어 SRT 생성을 요청한다. 사용자 중심 결과 설명은 바로 보이고, 모델 식별자·로컬 Whisper·worker 정보는 닫힌 native `기술적인 처리 정보` disclosure에서 필요할 때 확인한다.
4. `POST /subtitles/uploads`로 multipart session을 만들고 presigned URL로 파일 part를 직접 업로드한다. session·part·complete 중 사용자가 `요청 취소`를 누르면 브라우저 요청을 중단하고 abort cleanup을 best-effort로 시도한다.
5. `POST /subtitles/uploads/complete` 성공 응답의 UUID와 접수 시각을 자막 접수증으로 저장한다. 응답 경쟁으로 job이 생성되면 접수증을 보존하고 서버 job 취소로 표시하지 않는다.
6. 현재 route에서 `GET /subtitles/jobs/:jobId`를 polling해 처리·완료·실패·만료 상태를 표시한다.
7. 완료되면 실제 SRT `downloadUrl`을 표시하고, 실패·만료·상태 조회 오류에는 상세와 기존 파일을 유지한 재요청 동작을 제공한다.
8. 업로드 실패 시 `POST /subtitles/uploads/abort` 정리를 best-effort로 요청한다.

## 상태와 오류

- mount 시 과거 접수증을 읽거나 상태 조회를 시작하지 않는다. 현재 화면에서 새로 접수한 job만 조회한다.
- `checking`·`failed`·`unavailable`에서는 readiness panel이 form을 대체하고, `ready`에서만 파일 picker와 처리 방식을 표시한다. background checking으로 form이 숨겨져도 선택 파일과 model state는 보존한다.
- readiness는 상태 텍스트·아이콘·`status`/`alert` live semantics·`aria-busy`·재확인 accessible name을 유지한다. 확인 가능한 API 응답과 worker availability만 안내한다.
- session 생성부터 part upload와 complete 응답까지 주요 navigation의 현재 목적지를 제외한 route와 상단 `설정` 링크의 이동 및 중복 제출을 막는다. 링크는 계속 표시하며 비활성 목적지에는 `aria-disabled="true"`와 잠금 사유를 제공한다. `요청 취소` 뒤에는 lock을 풀고 파일·선택을 유지한다.
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
- Browser: readiness 네 상태와 background checking 파일/model 보존, `F` 단축키의 focus와 text editing/modifier 안전성, session·part 중단 및 `/subtitles/uploads/abort` cleanup, 응답 경쟁 접수증 보존·서버 job cancel 미호출, 닫힌 `기술적인 처리 정보` disclosure의 click/Enter/Space, 흐름 trail과 320/390 geometry
