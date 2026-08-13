# Web Route `/history`

## Route

- path: `/history`
- source: `apps/web/src/app/pages/request-history/page.tsx`
- navigation: 모든 route의 상단 `요청 내역` 텍스트 링크
- data source: browser `localStorage` 접수증과 job status API

## 사용자 흐름

1. 앱은 `mytube-extract:job-receipt:v2:<kind>:<jobId>` 건별 key를 읽는다.
2. 유효한 영상·자막 접수증을 `acceptedAt` 최신순 최대 20건의 단일 목록으로 표시한다.
3. `kind=video`는 `GET /downloads/:jobId`, `kind=subtitle`은 `GET /subtitles/jobs/:jobId`를 조회한다.
4. `queued`, `processing`, `extracting_audio`, `transcribing`은 2500ms 간격으로 polling한다.
5. `completed`, `failed`, `expired`에서는 polling을 중단한다.
6. completed와 API `downloadUrl`이 함께 있으면 attachment 다운로드 링크를 제공한다.
7. failed와 expired는 같은 종류의 요청 route로 이동하는 `다시 요청` 링크를 제공한다.
8. 사용자는 접수증 하나를 정확히 삭제할 수 있다.

## 저장 계약

- 접수증은 `kind`, UUID `jobId`, ISO `acceptedAt`만 포함한다.
- 상태, 진행률, 메시지, 파일명, `downloadUrl`은 저장하지 않고 서버 응답만 사용한다.
- 손상된 접수증은 해당 key만 제거하며 다른 storage 값은 건드리지 않는다.
- network/5xx에서는 항목을 유지한다. 404에서만 해당 접수증을 제거한다.
- native `storage` event의 접수증 key와 `newValue`로 다른 탭의 정확한 추가·삭제·재추가를 반영한다.
- 다른 탭에서 삭제한 현재 deep link 접수증은 저장 목록 fallback으로 되살리지 않는다.
- 유효한 `kind`와 UUID query가 있으면 저장 목록에 없어도 deep link 항목을 조회한다.
- localStorage 실패 시 deep link 조회를 유지하고 저장 실패 안내를 표시한다.

## 접근성

- 상태는 텍스트와 아이콘을 함께 사용하고 색만으로 전달하지 않는다.
- 동일 polling 결과는 live region에 반복 알리지 않고 실제 상태 전이와 삭제만 polite status로 알린다.
- 항목 삭제 뒤 다음 삭제 버튼, 이전 삭제 버튼, 빈 목록 제목 순으로 focus를 돌린다.
- layout은 `docs/DESIGN.md`의 색·간격·radius·760px content token을 재사용한다.

## 검증

- `pnpm --filter web run test`
- `pnpm --filter web run lint`
- `pnpm --filter web run build`
- `pnpm run test:web:browser`
- Browser: 두 종류 endpoint, refresh, terminal polling 중단, download, 오류별 보존/삭제, 두 탭, storage 차단, keyboard, 200% zoom, screen reader
