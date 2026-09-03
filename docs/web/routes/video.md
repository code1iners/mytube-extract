# Web Route `/video`

## Route

- path: `/video`
- source: `apps/web/src/app/pages/video-extract/page.tsx`
- logic: `apps/web/src/app/pages/video-extract/_hooks/use-video-extract-logic.ts`
- navigation: primary navigation `영상 추출` (desktop header tab / mobile bottom tab)

## 사용자 흐름

1. 앱은 먼저 `GET /health`를 확인한다. `checking`·`failed`·`unavailable`이면 상태 우선 화면과 재확인을 보여주고, `ready`일 때만 요청 입력을 연다.
2. 준비된 상태에서 사용자는 `YouTube URL → 추출 형식 → 품질 → 추출 요청` 순서로 작업을 진행한다. 화면에는 `원본 → 추출 → 파일 수령` 흐름이 현재 상태와 함께 표시된다.
3. 앱은 `POST /downloads`를 호출한다. 요청이 서버 job을 만들기 전에 사용자가 `요청 취소`를 누르면 AbortController로 브라우저 요청을 중단한다.
4. 성공 응답의 UUID와 접수 시각을 영상 접수증으로 저장한다. 취소 응답 경쟁으로 이미 job이 생성되면 접수증을 보존하고 서버 job 취소로 표시하지 않는다.
5. 현재 route에서 `GET /downloads/:jobId`를 polling해 처리·완료·실패·만료 상태를 표시한다.
6. 완료되면 실제 `downloadUrl`과 형식·품질·보관기간을 표시하고, 실패·만료·상태 조회 오류에는 상세와 재요청 동작을 제공한다.
7. `/history` 이동은 상단 `요청 내역` 링크를 선택할 때만 일어난다.

## 상태와 오류

- mount 시 과거 접수증을 읽거나 상태 조회를 시작하지 않는다. 현재 화면에서 새로 접수한 job만 조회한다.
- `checking`·`failed`·`unavailable`에서는 readiness panel이 form을 대체하고, `ready`에서만 `YouTube URL` 입력과 validation을 표시한다. 백그라운드 확인으로 form이 사라져도 URL과 선택값은 hook state에 보존한다.
- readiness는 상태 텍스트·아이콘·`status`/`alert` live semantics·`aria-busy`·재확인 accessible name을 유지한다. API 확인 실패와 worker 미가용은 구분하고, 확인 가능한 사실만 안내한다.
- URL 입력값이 있을 때만 `리셋` control을 표시하고, 비어 있을 때는 해당 control을 DOM에 렌더링하지 않는다.
- URL 검증 또는 POST 실패 시 route를 유지하며 접수증을 저장하지 않는다.
- POST가 진행되는 동안 주요 navigation의 현재 목적지를 제외한 route와 상단 `설정` 링크의 이동을 막는다. 링크는 계속 표시하며 비활성 목적지에는 `aria-disabled="true"`와 잠금 사유를 제공한다. `요청 취소` 뒤에는 lock을 해제하고 입력을 유지한다.
- 접수 이후에는 공유 polling 정책으로 현재 job을 조회하고, terminal 상태나 재시도 불가 조회 오류에서 polling을 멈춘다.
- 접수 뒤 worker health 상태가 바뀌어도 현재 job의 API 상태와 메시지를 우선한다.

## API

- `GET /health`
- `POST /downloads`
- `GET /downloads/:jobId`
- `GET /downloads/:jobId/file`

## 검증

- `pnpm --filter web run test`
- `pnpm --filter web run lint`
- `pnpm run test:web:browser`
- Browser: 새로고침 후 빈 form, 접수 중 navigation lock, 성공 시 in-place 결과·다운로드, failed/expired·상태 조회 오류의 상세와 재요청, POST 실패 시 미저장·미이동
- Browser: readiness 네 상태와 background checking 입력 보존, 취소 전후 AbortError·navigation unlock·응답 경쟁 접수증 보존·서버 job cancel 미호출, `U` 단축키의 focus와 text editing/modifier 안전성, `원본 → 추출 → 파일 수령` 표시
