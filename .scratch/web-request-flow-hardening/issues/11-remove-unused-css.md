# 11: 미사용 CSS 제거

**What to build:** 어떤 화면에서도 참조되지 않는 `console-grid`/`legend-bar` 계열 CSS 규칙을 코드베이스에서 제거해, 유지보수자가 살아있는 레이아웃으로 오인하지 않게 한다.

**Blocked by:** None (can start immediately)

**Status:** done (2026-09-01)

- [x] `.console-grid`, `.legend-bar`, `.legend-item`, `.legend-title` 규칙이 스타일시트에서 제거된다.
- [x] 제거 전 코드베이스 전체에서 이 클래스들에 대한 참조가 없음을 다시 확인한다.
- [x] 기존 레이아웃(요청 폼, 상태 패널 등)의 렌더링이 변경되지 않는다.
- [x] `pnpm --filter web run lint`, `pnpm --filter web run test`가 통과한다.

## Comments

- `apps/web/src/styles/global.css`에서 `.console-grid`와 `legend-bar` 계열의 공통·데스크톱·모바일 규칙을 제거했다. `.console-hero`와 `.console-panel`의 기존 공통 표면 규칙은 유지했다.
- 구현 전 `apps`·`packages`의 런타임 소스와 스타일시트에서 해당 클래스 참조가 없음을 확인했다. `.scratch`와 `.impeccable` 문서에는 이 정리 작업을 설명하는 역사적 언급만 남겼다.
- 검증: `pnpm --filter web run lint`, `pnpm --filter web run test`(13개 파일, 88개 테스트), `pnpm test`(12개 task), `git diff --check`, Impeccable detector(`[]`) 통과.
