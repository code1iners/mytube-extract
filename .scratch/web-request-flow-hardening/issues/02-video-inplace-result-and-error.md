# 02: `/video` 결과·오류를 그 화면에서 실제로 보여주기

**What to build:** `/video`에서 접수한 요청이 완료되거나 실패·만료됐을 때, 강제로 `/history`로 이동하는 대신 그 화면 안에서 실제 결과(형식/품질/보관기간 요약 + 다운로드 버튼)나 오류(재요청 경로 포함)를 보여준다. `/history`로의 이동은 사용자의 선택 동작으로만 남긴다.

**Blocked by:** 01

**Status:** done (2026-09-01)

- [x] `/video`가 01에서 승격한 공유 폴링 모듈로 자체 job 상태를 폴링한다.
- [x] 접수 후 job이 완료되면 그 화면에서 결과 패널(형식/품질/보관기간 요약 + 다운로드 버튼)이 렌더된다.
- [x] 결과 패널의 다운로드 버튼이 실제 job 응답의 `downloadUrl`을 가리킨다(빈 문자열 하드코딩 제거).
- [x] job이 실패하거나 만료되면 그 화면에서 오류와 동일 종류 재요청 경로가 보인다.
- [x] 접수 성공 시 `/history`로의 강제 `navigate`가 제거된다 — 사용자가 명시적으로 요청 내역 링크를 눌러야만 이동한다.
- [x] `/history`로 이동해서 같은 job을 확인해도 상태가 일치한다(두 화면이 서로 다른 source of truth를 갖지 않는다).
- [x] step-tabs가 선택된 단계에 `aria-current="step"`을 갖는다.
- [x] 새 view-phase 분기와 step-tabs `aria-current` 렌더링을 검증하는 단위 테스트가 추가된다.

## Comments

- `/video`가 접수 응답을 즉시 표시하고 `job-status-polling.util.ts`로 상태를 갱신하도록 연결했다. 접수증 저장은 유지하되 강제 `/history` 이동은 제거했으며, 완료 다운로드 링크는 API 응답의 `downloadUrl`을 API base URL 기준으로 사용한다.
- 검증: `pnpm --filter web run lint`, `pnpm --filter web run test`, `pnpm --filter web run test:browser`, `pnpm test` 통과.
