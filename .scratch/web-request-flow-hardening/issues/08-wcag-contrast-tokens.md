# 08: WCAG 대비 준수 색 토큰(hairline + 완료 상태색) + 문서 동기화

**What to build:** 카드·입력창·미선택 칩의 유일한 경계인 hairline 토큰과, 기준 미달인 완료(completed) 상태 텍스트 색을 WCAG 기준을 충족하는 값으로 재계산한다. `docs/DESIGN.md`의 Color 표·YAML frontmatter와 `.impeccable/design.json` 사이드카를 하나의 검증된 값으로 동기화한다.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] light/dark 각각의 hairline 토큰이 실제 사용 배경(카드 표면, 캔버스) 대비 3:1 이상이다(WCAG 1.4.11).
- [ ] 완료 상태 텍스트 색이 실제 사용 배경(surface) 대비 4.5:1 이상이다(WCAG 1.4.3).
- [ ] 새 토큰 값이 카드·입력창·미선택 칩·history 항목·step-tabs 등 hairline을 쓰는 모든 곳에 일관되게 반영된다(개별 컴포넌트에 값이 하드코딩되지 않는다).
- [ ] `docs/DESIGN.md`의 Color 표와 YAML frontmatter가 서로 다른 값을 갖지 않고 하나로 통일된다.
- [ ] `.impeccable/design.json`의 `colorMeta`/`tonalRamp`가 새 값으로 갱신된다.
- [ ] `/impeccable audit apps/web` 재실행에서 이 두 항목의 대비 관련 finding이 사라진다.
