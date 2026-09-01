# 03: `/video` 제출 직후 "접수 중" 전환으로 교체

**What to build:** `/video`에서 요청을 제출한 직후, 실제 상태가 아닌 대기/0% 진행률 UI를 보여주던 것을 경량 "접수 중" 표시로 교체한다. job 생성 응답을 받으면 안내 없이 실제 폴링 기반 processing 상태로 자연스럽게 이어진다.

**Blocked by:** 02

**Status:** done (2026-09-01)

- [x] 요청 제출(mutation 진행 중)부터 job 생성 응답을 받기 전까지는 대기 탭/진행률 미터가 아니라 별도의 경량 "접수 중" 표시가 보인다.
- [x] job 생성 응답을 받으면 별도 안내 없이 실제 processing 상태(02에서 연결한 폴링 기반)로 화면이 자연스럽게 이어진다.
- [x] 이 전환 동안 사용자에게 실제로 존재하지 않는 진행률(예: 고정된 0%)이 진짜처럼 보이지 않는다.
- [x] 접수 중 상태와 실제 processing 상태를 구분하는 단위 테스트 또는 마크업 단언 테스트가 추가된다.

## Comments

- mutation 중 상태 머신을 `accepting`으로 분리했다. 이 단계는 접수 안내만 렌더하며 step tabs와 progress meter를 포함하지 않는다. job 생성 응답 뒤에는 기존 폴링 상태를 사용해 `processing`으로 전환한다.
- 검증: `pnpm --filter web run lint`, `pnpm --filter web run test`, `pnpm test` 통과.
