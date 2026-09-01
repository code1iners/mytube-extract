# 05: `/subtitles` 제출 직후 "접수 중" 전환으로 교체

**What to build:** 03과 동일한 모양을 자막 생성 흐름에 적용한다. `/subtitles`에서 요청을 제출한 직후 실제 상태가 아닌 진행률 UI 대신 경량 "접수 중" 표시를 보여주고, job 생성 응답을 받으면 실제 processing 상태로 자연스럽게 이어진다.

**Blocked by:** 04

**Status:** done (2026-09-01)

- [x] 요청 제출(mutation 진행 중)부터 job 생성 응답을 받기 전까지는 처리 단계 탭/진행률 미터가 아니라 별도의 경량 "접수 중" 표시가 보인다.
- [x] job 생성 응답을 받으면 별도 안내 없이 실제 processing 상태(04에서 연결한 폴링 기반)로 화면이 자연스럽게 이어진다.
- [x] 이 전환 동안 사용자에게 실제로 존재하지 않는 진행 단계가 진짜처럼 보이지 않는다.
- [x] 접수 중 상태와 실제 processing 상태를 구분하는 단위 테스트 또는 마크업 단언 테스트가 추가된다.

## Comments

- 공통 화면 상태의 `accepting` 분기를 자막 화면에 연결했다. 이 단계는 접수 안내만 렌더링하며 자막 처리 단계 탭과 진행률 미터를 포함하지 않는다. job 생성 응답 뒤에는 기존 폴링 상태가 `processing`을 렌더링한다.
- 검증: `pnpm --filter web exec vitest run tests/unit/subtitles-extract-page.test.tsx` (5 tests), `pnpm --filter web run lint`, `pnpm --filter web run test` (83 tests), `pnpm test` (12 tasks) 통과.
