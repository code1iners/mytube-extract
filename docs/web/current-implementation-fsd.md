# MyTube Extract Web 현재 구현 FSD

## 구조

- entry: `apps/web/src/main.tsx`
- router: `apps/web/src/app/app.tsx`
- shared layout/header/bottom tabs: `apps/web/src/app/components/*`
- API client: `apps/web/src/api/mytube-extract.api.ts`
- receipt storage: `apps/web/src/app/utils/job-receipt.util.ts`
- route 상세: `docs/web/routes/*`

`QueryClientProvider`와 React Router `BrowserRouter`를 기존 앱 전역 경계로 사용한다. 별도 상태 관리 library, 서버 목록 endpoint, DB schema는 없다.

## Route와 navigation

- `/`와 unknown route는 `/video`로 redirect한다.
- `/video`, `/subtitles`, `/history`를 제공한다.
- 하단 탭은 `/video`, `/subtitles` 두 개를 유지한다.
- 상단 `요청 내역`은 모든 route에서 보이며 `/history`에서 `aria-current="page"`를 가진다.

## 요청 접수

- 영상은 worker 확인 후 `POST /downloads` 성공 시 접수증을 추가한다.
- 자막은 upload session, R2 part PUT, complete 전체가 성공한 뒤 접수증을 추가한다.
- 접수증 key는 `mytube-extract:job-receipt:v2:<kind>:<jobId>`다.
- value는 JSON `{ "acceptedAt": "<ISO timestamp>" }`만 저장한다.
- 접수 성공 뒤 `/history?kind=<kind>&jobId=<uuid>`로 이동한다.
- storage 쓰기 실패는 navigation state로 전달해 history가 안내한다.
- `/video`, `/subtitles` mount는 접수증이나 job status query를 시작하지 않는다.
- navigation lock은 영상 POST 또는 자막 upload/complete 요청 중에만 유지하며 하단 route 탭과 상단 `요청 내역` 링크에 함께 적용한다.

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

## 검증 기준

- `pnpm --filter web run lint`
- `pnpm --filter web run test`
- `pnpm --filter web run build`
- `pnpm run test:web:browser`
- Browser: `/video`, `/subtitles`, `/history`, refresh, 두 endpoint, terminal polling, 오류별 보존/삭제, 실제 attachment, storage event/차단, mobile/desktop, keyboard, 200% zoom, screen reader, Console/Network

## 후속 보류

- 계정 기반 서버 이력과 기기 간 동기화
- 검색, 필터, 페이지네이션, 전체 삭제
- 작업 취소
- 파일명 입력
