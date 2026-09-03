# MyTube Extract Web 현재 구현 FSD

## 구조

- entry: `apps/web/src/main.tsx`
- router: `apps/web/src/app/app.tsx`
- shared layout/header/primary navigation/bottom tabs: `apps/web/src/app/components/*`
- API client: `apps/web/src/api/mytube-extract.api.ts`
- receipt storage: `apps/web/src/app/utils/job-receipt.util.ts`
- request preference storage: `apps/web/src/app/utils/request-preference.util.ts`
- shared job polling: `apps/web/src/app/utils/job-status-polling.util.ts`
- request flow trail: `apps/web/src/app/components/request-flow.tsx`, `apps/web/src/app/utils/request-flow.util.ts`
- readiness gate: `apps/web/src/app/components/request-readiness-panel.tsx`, `apps/web/src/app/components/worker-health-status.tsx`
- request cancellation and keyboard guards: route logic hooks, `apps/web/src/app/utils/keyboard-shortcut.util.ts`
- route 상세: `docs/web/routes/*`

`QueryClientProvider`와 React Router `BrowserRouter`를 기존 앱 전역 경계로 사용한다. 별도 상태 관리 library, 서버 목록 endpoint, DB schema는 없다.

## Route와 navigation

- `/`와 unknown route는 `/video`로 redirect한다.
- `/video`, `/subtitles`, `/history`, `/settings`를 제공한다.
- `영상 추출`·`자막 추출`·`요청 내역`은 하나의 주요 navigation으로 공유한다. 데스크톱은 작업 영역 헤더 탭, 모바일은 하단 3탭이다.
- 주요 navigation의 현재 목적지는 `aria-current="page"`와 active 시각 상태로 함께 전달한다.
- 상단 `설정`은 보조 route 링크이며, 테마 radio 선택은 `/settings`에서 layout의 기존 테마 state와 storage 콜백을 사용한다.

## 요청 접수

- 영상은 worker 확인 후 `POST /downloads` 성공 시 접수증을 추가한다. health가 `ready`가 아니면 status-first readiness 화면에서 form을 대체한다.
- 자막은 upload session, R2 part PUT, complete 전체가 성공한 뒤 접수증을 추가한다.
- 접수증 key는 `mytube-extract:job-receipt:v2:<kind>:<jobId>`다.
- value는 JSON `{ "acceptedAt": "<ISO timestamp>" }`만 저장한다.
- 접수 성공 뒤 현재 `/video` 또는 `/subtitles` route에 남아 생성 응답의 job을 상태 조회한다.
- 접수증 storage 쓰기 실패는 job 생성이나 현재 route의 상태 조회를 막지 않는다.
- `/video`, `/subtitles` mount는 과거 접수증을 복원하지 않으며, 현재 화면에서 새로 접수한 job만 query한다.
- navigation lock은 영상 POST 또는 자막 upload/complete 요청 중에만 유지하며 데스크톱 헤더·모바일 하단의 주요 navigation과 상단 `설정` 링크에 함께 적용한다. 현재 목적지는 활성 상태로 남긴다. 사용자가 접수 전 `요청 취소`를 누르면 AbortController를 중단하고 입력·파일을 유지한 채 lock을 풀며, 응답 경쟁으로 job이 만들어졌으면 접수증을 보존하고 취소 완료로 가장하지 않는다.

## Request route query

- job 생성 응답을 받기 전에는 처리 단계나 가짜 진행률 대신 경량 `accepting` 상태를 표시한다.
- `RequestFlow`는 request/processing/error에서 `extract`, completed와 history의 완료 항목에서 `receipt`를 표시하며 API 상태 외의 진행률을 추정하지 않는다.
- `/video`의 `U`, `/subtitles`의 `F` 단축키는 수정키·반복·text editing target을 제외하고 첫 입력 동작에 focus한다.
- 생성 응답의 `jobId`로 `/video`는 download job, `/subtitles`는 subtitle job 상태를 조회한다.
- query key·재시도·2500ms polling·terminal 중단 정책은 history와 같은 공유 모듈을 사용한다.
- completed는 현재 route에서 실제 `downloadUrl`을 제공하고, failed/expired는 오류 요약·접이식 기술 상세·기존 입력을 유지한 재요청 경로를 제공한다.
- 상태 조회가 404·401처럼 재시도 불가 오류로 끝나면 생성 응답의 초기 상태를 계속 표시하지 않고 오류와 재요청 경로를 제공한다.
- job 접수 뒤의 worker health 갱신은 현재 job의 API 상태·메시지를 덮어쓰지 않는다.
- 자막의 모델·Whisper·worker 기술 정보는 닫힌 native disclosure에 두고, 열기·닫기는 기본 keyboard 동작과 보조 기술로 접근 가능해야 한다.

## Request preference storage

- key는 `mytube-extract-request-preferences`다.
- 다운로드 형식·형식에 맞는 품질·Whisper 모델만 저장한다.
- 서버 지원 선택지 밖의 값, 손상된 JSON, 차단된 localStorage는 제품 기본값으로 안전하게 폴백한다.

## History query

- 접수증은 UUID, kind, timestamp를 검증하고 최신순으로 정렬한다.
- 동일 key는 덮어써 dedupe하고 추가 뒤 오래된 항목을 제거해 20건만 남긴다.
- `useQueries` key는 `['job-status', kind, jobId]`다.
- video query는 `getDownloadJob`, subtitle query는 `getSubtitleJob`을 재사용한다.
- active status는 2500ms polling, terminal status는 `refetchInterval: false`다.
- network와 5xx는 지수 backoff 재시도하며 접수증과 마지막 성공 data를 유지한다.
- `JobStatusRequestError(404)` effect만 대상 접수증 하나를 제거한다.
- API의 `displayStatus`, `progress`, `message`, `createdAt`, metadata, `downloadUrl`만 화면에 반영한다.
- storage event의 접수증 key와 `newValue`로 다른 탭의 정확한 삭제·재추가를 먼저 반영한 뒤 접수증을 다시 읽는다.

## UI와 접근성

- `docs/DESIGN.md`의 semantic status color와 spacing/radius/layout token을 사용한다.
- history는 dashboard가 아닌 한 열 목록이다.
- 상태마다 텍스트와 `AppIcon`을 함께 표시한다.
- 숨김 polite live region은 동일 polling tick이 아니라 상태 값 전이와 삭제만 알린다.
- completed URL 누락은 다운로드를 추정하지 않고 다시 확인 오류로 표시한다.
- download anchor는 API `downloadUrl`과 base URL을 결합하고 attachment 응답 파일명을 따른다.
- history의 다운로드·다시 요청·삭제·되돌리기 control은 좁은 폭에서도 각각 최소 44×44px을 유지한다.

## 검증 기준

- `pnpm --filter web run lint`
- `pnpm --filter web run test`
- `pnpm --filter web run build`
- `pnpm run test:web:browser`
- Browser: `/video`·`/subtitles` in-place 완료와 다운로드, readiness status-first gate와 입력 보존, 접수 전 취소·AbortError·업로드 abort cleanup·응답 경쟁 접수증 보존, 상태 조회 오류 복구, `/history`, refresh, 두 endpoint, terminal polling, 오류별 보존/삭제, 실제 attachment, storage event/차단, mobile/desktop, U/F 단축키 안전성, 200% zoom, screen reader, Console/Network

## 후속 보류

- 계정 기반 서버 이력과 기기 간 동기화
- 검색, 필터, 페이지네이션, 전체 삭제
- 서버 job 취소 API
- 파일명 입력
