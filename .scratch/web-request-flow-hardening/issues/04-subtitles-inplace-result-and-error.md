# 04: `/subtitles` 결과·오류를 그 화면에서 실제로 보여주기

**What to build:** 02와 동일한 모양을 자막 생성 흐름에 적용한다. `/subtitles`에서 접수한 요청이 완료되면 그 화면에서 바로 SRT 다운로드 결과를, 실패·만료되면 오류와 재요청 경로를 보여준다.

**Blocked by:** 01

**Status:** done (2026-09-01)

- [x] `/subtitles`가 01에서 승격한 공유 폴링 모듈로 자체 job 상태를 폴링한다.
- [x] 접수 후 job이 완료되면 그 화면에서 결과 패널(영어 SRT 다운로드 버튼 포함)이 렌더된다.
- [x] 결과 패널의 다운로드 버튼이 실제 job 응답의 `downloadUrl`을 가리킨다(빈 문자열 하드코딩 제거).
- [x] job이 실패하거나 만료되면 그 화면에서 오류와 동일 종류 재요청 경로가 보인다.
- [x] 접수 성공 시 `/history`로의 강제 `navigate`가 제거된다 — 사용자가 명시적으로 요청 내역 링크를 눌러야만 이동한다.
- [x] `/history`로 이동해서 같은 job을 확인해도 상태가 일치한다.
- [x] step-tabs(자막 처리 단계)가 선택된 단계에 `aria-current="step"`을 갖는다.
- [x] 새 view-phase 분기와 step-tabs `aria-current` 렌더링을 검증하는 단위 테스트가 추가된다.

## Comments

- `/subtitles`가 공유 job-status polling 모듈을 사용해 접수한 자막 job을 같은 화면에서 갱신한다. 완료 시 실제 `downloadUrl`을 SRT 다운로드 링크에 연결하고, 실패·만료 시 기존 파일을 유지한 재요청 경로를 제공한다.
- 검증: `pnpm --filter web exec vitest run tests/unit/subtitles-extract-page.test.tsx` (4 tests), `pnpm --filter web run lint`, `pnpm --filter web run test` (82 tests), `pnpm test` (12 tasks) 통과.
