# Web Route `/history`

## Route

- path: `/history`
- source: `apps/web/src/app/pages/request-history/page.tsx`
- navigation: primary navigation `요청 내역` (desktop header tab / mobile bottom tab)
- data source: browser `localStorage` 접수증과 job status API
- surface: 외곽 card 없이 workspace에 정렬된 요청 목록·빈 상태 영역

## 사용자 흐름

1. 앱은 `mytube-extract:job-receipt:v2:<kind>:<jobId>` 건별 key를 읽는다.
2. 유효한 영상·자막 접수증을 `acceptedAt` 최신순 최대 20건의 단일 목록으로 표시한다.
3. `kind=video`는 `GET /downloads/:jobId`, `kind=subtitle`은 `GET /subtitles/jobs/:jobId`를 조회한다.
4. `queued`, `processing`, `extracting_audio`, `transcribing`은 2500ms 간격으로 polling한다.
5. `completed`, `failed`, `expired`에서는 polling을 중단한다.
6. completed와 API `downloadUrl`이 함께 있으면 attachment 다운로드 링크를 제공한다.
7. failed와 expired는 같은 종류의 요청 route로 이동하는 `다시 요청` 링크를 제공한다.
8. 사용자는 접수증 하나를 정확히 삭제할 수 있으며, 삭제 즉시 목록과 해당 localStorage key에서 제거된다.
9. 가장 최근 삭제 하나만 8초 동안 `되돌리기`로 같은 접수증을 복원할 수 있다. 복원은
   원래 `kind`, `jobId`, `acceptedAt`을 유지하고 최신순 위치로 다시 표시한다.

각 항목은 서버 job status API 응답의 `displayStatus`에 맞춰 `원본 → 추출 → 파일 수령` 흐름을 표시한다. `completed`만
`파일 수령`을 current step으로 삼고, 그 밖의 접수·처리·오류·만료 상태는 `추출` 단계로
표시한다. 다운로드·다시 요청·삭제·되돌리기 control은 좁은 화면에서도 각각 44×44px
이상의 실제 조작 영역을 갖는다.

접수증이 하나도 없을 때는 빈 상태에서 `영상 추출`과 `자막 추출`을 동등한 시작점으로
제공한다. `시작할 작업을 선택하세요.`를 먼저 보여주고, 영상 추출은 YouTube URL에서
영상·오디오 파일을 받으며 자막 추출은 로컬 영상에서 영어 SRT 자막을 만든다는 출발
입력과 결과를 각 링크에 짧게 설명한다. 이력은 현재 브라우저에만 저장되고 완료 파일은
7일 동안 보관된다는 운영 모델도 별도 note로 한 번 안내한다. 이 정보는 전역 안내에만 의존하지 않고
빈 상태와 완료 항목의 관련 위치에서 다시 확인할 수 있다.

## 저장 계약

- 접수증은 `kind`, UUID `jobId`, ISO `acceptedAt`만 포함한다.
- 상태, 진행률, 메시지, 파일명, `downloadUrl`은 저장하지 않고 서버 응답만 사용한다.
- 손상된 접수증은 해당 key만 제거하며 다른 storage 값은 건드리지 않는다.
- network/5xx에서는 항목을 유지한다. 404에서만 해당 접수증을 제거한다.
- native `storage` event의 접수증 key와 `newValue`로 다른 탭의 정확한 추가·삭제·재추가를 반영한다.
- 다른 탭에서 삭제한 현재 deep link 접수증은 저장 목록 fallback으로 되살리지 않는다.
- 유효한 `kind`와 UUID query가 있으면 저장 목록에 없어도 deep link 항목을 조회한다.
- localStorage 실패 시 deep link 조회를 유지하고 저장 실패 안내를 표시한다.
- 삭제한 접수증의 복원은 저장 직후 재조회로 성공 여부를 확인한다. 접근·유효성 검증에
  실패하면 삭제 상태를 유지하고 성공 공지를 보내지 않는다.
- 삭제·복원은 receipt key와 서버 job을 제외한 다른 receipt, 원본 URL·파일명, 다운로드
  자산을 변경하지 않는다. route 이동이나 unmount에서 삭제를 다시 commit하지 않는다.

## 접근성

- 상태는 텍스트와 아이콘을 함께 사용하고 색만으로 전달하지 않는다.
- 동일 polling 결과는 live region에 반복 알리지 않고 실제 상태 전이와 삭제만 polite status로 알린다.
- 항목 삭제 뒤 다음 삭제 버튼, 이전 삭제 버튼, 빈 목록 제목 순으로 focus를 돌린다.
- 삭제 뒤에는 단일 undo 안내와 동작을 표시하고, 복원 성공 시 복원된 항목 제목으로
  focus를 이동한다. 복원 실패는 하나의 `alert`로 알리고 삭제된 목록 상태를 유지한다.
- layout은 `docs/DESIGN.md`의 색·간격·radius·760px content token을 재사용한다.
- 보조 `설정` 링크는 헤더의 `더보기` disclosure 안에 제공하며 테마 선택은 `/settings`에서 관리한다.

## 검증

- `pnpm --filter web run test`
- `pnpm --filter web run lint`
- `pnpm --filter web run build`
- `pnpm run test:web:browser`
- Browser: 두 종류 endpoint, refresh, terminal polling 중단, download, 오류별 보존/삭제,
  삭제·8초 내 복원·만료·연속 삭제·blocked storage·focus, 두 탭, storage 차단, keyboard,
  200% zoom, screen reader
