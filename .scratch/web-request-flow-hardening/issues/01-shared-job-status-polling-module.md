# 01: 공유 job-status 폴링 모듈 prefactor

**What to build:** `/history`가 이미 갖고 있는 job 상태 폴링 로직(재시도 간격 계산, terminal 상태에서 폴링 중단)을 `/video`·`/subtitles`·`/history` 세 route가 공유할 수 있는 독립 모듈로 승격한다. 이 티켓만으로는 사용자가 보는 동작 변화가 없어야 한다 — `/history`가 지금과 동일하게 동작하는 것이 완료 기준이다.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] job 상태 조회 함수와 재시도/폴링 간격 계산 함수가 `/history` 전용 모듈이 아니라 세 route가 import할 수 있는 공유 위치에 있다.
- [ ] `/history`가 승격된 공유 모듈을 사용하도록 바뀌고, 기존 동작(진행 중 job만 polling, terminal 상태에서 polling 중단, 재시도 간격)이 그대로 유지된다.
- [ ] 기존 `/history` 관련 단위 테스트가 모두 그대로 통과한다(승격 후 새 위치를 import하도록만 갱신).
- [ ] `/video`, `/subtitles`는 아직 이 모듈을 사용하지 않아도 된다 — 이후 티켓(02, 04)이 실제로 연결한다.
