# 04: 요청 내역 삭제에 8초 되돌리기 제공

**What to build:** 요청 내역 사용자가 브라우저의 유일한 job 추적 경로를 실수로 삭제했을 때 가장 최근 삭제 한 건을 8초 안에 되돌릴 수 있게 한다. 삭제와 복원은 localStorage에 즉시 반영하고, 동일한 receipt 정체성·정렬·focus와 접근 가능한 결과 공지를 보장한다.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] 내역 삭제 시 해당 항목과 localStorage receipt가 즉시 제거되고, 삭제 결과와 8초 동안 사용할 수 있는 되돌리기 동작이 표시된다.
- [ ] 되돌리기를 실행하면 삭제 전 `kind`, `jobId`, `acceptedAt`과 동일한 receipt가 복원되어 기존 최신순 위치로 다시 나타난다.
- [ ] 새로운 삭제를 실행하면 이전 삭제의 되돌리기는 종료되고 가장 최근 삭제 한 건만 되돌릴 수 있다.
- [ ] 8초가 지나면 되돌리기 동작이 닫히며 route 이동이나 unmount에서 추가 삭제 commit을 요구하지 않는다.
- [ ] localStorage 접근·유효성 문제로 복원에 실패하면 항목을 성공 상태로 되돌리지 않고 복원 실패를 alert로 알린다.
- [ ] 삭제 후에는 다음 삭제 버튼, 이전 삭제 버튼, 목록 제목 순으로 focus를 이동하고, 복원 후에는 복원된 항목의 제목 또는 첫 사용자 동작으로 focus를 이동한다.
- [ ] 삭제·복원·복원 실패 공지는 스크린리더에 중복 전달되지 않고, 기존 storage failure와 cross-tab 동기화 동작을 깨뜨리지 않는다.
- [ ] 다른 receipt, 원본 URL·파일명, 서버 job 또는 다운로드 자산은 삭제·복원 과정에서 변경되지 않는다.
- [ ] unit test는 동일 acceptedAt 복원과 정렬을 검증하고, 브라우저 테스트는 삭제·8초 내 복원·시간 만료·연속 삭제·blocked localStorage·focus 경로를 사용자 동작으로 검증한다.
- [ ] Web 정적 검사, 전체 단위 테스트, production build와 기존 브라우저 smoke가 통과한다.
