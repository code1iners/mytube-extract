# 04: 요청 내역 삭제에 8초 되돌리기 제공

**What to build:** 요청 내역 사용자가 브라우저의 유일한 job 추적 경로를 실수로 삭제했을 때 가장 최근 삭제 한 건을 8초 안에 되돌릴 수 있게 한다. 삭제와 복원은 localStorage에 즉시 반영하고, 동일한 receipt 정체성·정렬·focus와 접근 가능한 결과 공지를 보장한다.

**Blocked by:** None (can start immediately).

**Status:** done (2026-09-02)

- [x] 내역 삭제 시 해당 항목과 localStorage receipt가 즉시 제거되고, 삭제 결과와 8초 동안 사용할 수 있는 되돌리기 동작이 표시된다.
- [x] 되돌리기를 실행하면 삭제 전 `kind`, `jobId`, `acceptedAt`과 동일한 receipt가 복원되어 기존 최신순 위치로 다시 나타난다.
- [x] 새로운 삭제를 실행하면 이전 삭제의 되돌리기는 종료되고 가장 최근 삭제 한 건만 되돌릴 수 있다.
- [x] 8초가 지나면 되돌리기 동작이 닫히며 route 이동이나 unmount에서 추가 삭제 commit을 요구하지 않는다.
- [x] localStorage 접근·유효성 문제로 복원에 실패하면 항목을 성공 상태로 되돌리지 않고 복원 실패를 alert로 알린다.
- [x] 삭제 후에는 다음 삭제 버튼, 이전 삭제 버튼, 목록 제목 순으로 focus를 이동하고, 복원 후에는 복원된 항목의 제목 또는 첫 사용자 동작으로 focus를 이동한다.
- [x] 삭제·복원·복원 실패 공지는 스크린리더에 중복 전달되지 않고, 기존 storage failure와 cross-tab 동기화 동작을 깨뜨리지 않는다.
- [x] 다른 receipt, 원본 URL·파일명, 서버 job 또는 다운로드 자산은 삭제·복원 과정에서 변경되지 않는다.
- [x] unit test는 동일 acceptedAt 복원과 정렬을 검증하고, 브라우저 테스트는 삭제·8초 내 복원·시간 만료·연속 삭제·blocked localStorage·focus 경로를 사용자 동작으로 검증한다.
- [x] Web 정적 검사, 전체 단위 테스트, production build와 기존 브라우저 smoke가 통과한다.

## Comments

### 2026-09-02 구현

- `restoreJobReceipt`를 추가해 삭제한 receipt를 동일한 `kind`, `jobId`, `acceptedAt`으로 저장하고, 저장 직후 재조회한 결과가 일치할 때만 복원 성공으로 처리했다. 유효성·storage 접근 실패는 `false`로 반환한다.
- 요청 내역에서 삭제 직후 목록과 localStorage key를 제거하고, 최신 삭제 하나에만 8초 undo를 제공한다. 새 삭제·cross-tab 동일 receipt 변경·timer 만료 시 이전 undo를 닫으며, unmount cleanup은 timer 해제만 수행한다.
- 삭제 결과는 단일 status live region에, 복원 실패는 단일 alert live region에 전달한다. 삭제 후 다음/이전 삭제 button 또는 목록 제목, 복원 후 복원된 항목 제목으로 focus를 이동한다.
- 관련 route 문서와 unit/browser 테스트를 갱신했다. 브라우저 테스트는 390px에서 삭제·복원·정렬·연속 삭제·만료·마지막 제목 focus·unmount 재진입을, blocked storage에서 복원 실패 alert를 검증한다.
- 검증 결과: Web lint, Web unit `16 files / 118 tests`, Web production build/PWA package, request-history browser smoke `18 flows`, 모노레포 `pnpm test` `12 tasks` 통과. Impeccable detector 결과는 `[]`였다.
- fixture·로컬 Chromium 검증은 실제 API·worker/provider, 물리 모바일 browser chrome·safe-area, 화면 낭독기 동작을 대체하지 않는다.
