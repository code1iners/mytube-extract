# 11: 미사용 CSS 제거

**What to build:** 어떤 화면에서도 참조되지 않는 `console-grid`/`legend-bar` 계열 CSS 규칙을 코드베이스에서 제거해, 유지보수자가 살아있는 레이아웃으로 오인하지 않게 한다.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `.console-grid`, `.legend-bar`, `.legend-item`, `.legend-title` 규칙이 스타일시트에서 제거된다.
- [ ] 제거 전 코드베이스 전체에서 이 클래스들에 대한 참조가 없음을 다시 확인한다.
- [ ] 기존 레이아웃(요청 폼, 상태 패널 등)의 렌더링이 변경되지 않는다.
- [ ] `pnpm --filter web run lint`, `pnpm --filter web run test`가 통과한다.
