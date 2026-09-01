# 08: WCAG 대비 준수 색 토큰(hairline + 완료 상태색) + 문서 동기화

**What to build:** 카드·입력창·미선택 칩의 유일한 경계인 hairline 토큰과, 기준 미달인 완료(completed) 상태 텍스트 색을 WCAG 기준을 충족하는 값으로 재계산한다. `docs/DESIGN.md`의 Color 표·YAML frontmatter와 `.impeccable/design.json` 사이드카를 하나의 검증된 값으로 동기화한다.

**Blocked by:** None (can start immediately)

**Status:** done (2026-09-01)

- [x] light/dark 각각의 hairline 토큰이 실제 사용 배경(카드 표면, 캔버스) 대비 3:1 이상이다(WCAG 1.4.11).
- [x] 완료 상태 텍스트 색이 실제 사용 배경(surface) 대비 4.5:1 이상이다(WCAG 1.4.3).
- [x] 새 토큰 값이 카드·입력창·미선택 칩·history 항목·step-tabs 등 hairline을 쓰는 모든 곳에 일관되게 반영된다(개별 컴포넌트에 값이 하드코딩되지 않는다).
- [x] `docs/DESIGN.md`의 Color 표와 YAML frontmatter가 서로 다른 값을 갖지 않고 하나로 통일된다.
- [x] `.impeccable/design.json`의 `colorMeta`/`tonalRamp`가 새 값으로 갱신된다.
- [x] `/impeccable audit apps/web` 재실행에서 이 두 항목의 대비 관련 finding이 사라진다.

## Comments

- Web 토큰을 `hairline-light #8a8a8a`, `hairline-dark #767676`, 완료 상태 `green-700 #356b43`로 조정했다. dark `surface-alt`까지 포함해 hairline을 사용하는 실제 배경을 확인했다.
- WCAG 상대 휘도 계산 결과는 light hairline `#8a8a8a`가 canvas/surface/surface-alt에서 `3.452/3.251/3.002:1`, dark hairline `#767676`이 `3.873/3.544/3.159:1`, 완료색이 light/dark surface에서 `5.928/9.425:1`이다.
- `docs/DESIGN.md`의 YAML·Primitive·Semantic 값과 `.impeccable/design.json`의 `colorMeta`·`tonalRamp`·컴포넌트 예시를 동기화했다. Web CSS의 hairline 사용처는 계속 `var(--color-border)`를 참조한다.
- `/impeccable audit apps/web` 대상 재검증에서 이번 finding을 다시 확인했다: Accessibility contrast는 위 계산으로 pass, Theming은 semantic token·문서 동기화 pass, Implementation Integrity는 detector `[]`이며, Performance/Responsive에는 token-only 변경으로 새 finding이 없다.
- 검증: `pnpm --filter web run lint`, `pnpm --filter web run test` (13 files, 88 tests), `pnpm --filter web run build`, `node /Users/wraith/.agents/skills/impeccable/scripts/detect.mjs --json apps/web/src` (`[]`) 통과.
- Chrome 확장 프로그램은 상위 spec의 별도 표면·Out of Scope 결정에 따라 변경하지 않았다.
