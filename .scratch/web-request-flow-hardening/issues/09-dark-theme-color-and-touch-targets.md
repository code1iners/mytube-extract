# 09: dark 대응 theme-color + 44px 터치 타깃

**What to build:** 브라우저/PWA 시스템 UI 색이 앱의 dark 테마를 따르도록 `theme-color` meta를 추가하고, 44px 권장 터치 타깃에 못 미치는 세 개의 작은 컨트롤(테마 전환, URL 지우기, 재시도 버튼)을 키운다.

**Blocked by:** None (can start immediately)

**Status:** done (2026-09-01)

- [x] `index.html`에 `prefers-color-scheme: dark`용 `theme-color` meta가 기존 light 메타와 함께 존재한다.
- [x] dark 테마로 열었을 때 브라우저 주소창/시스템 UI 색이 흰색으로 남지 않는다.
- [x] 테마 전환 버튼, URL 지우기 버튼, 컴팩트 보조 버튼(worker-health 재시도)이 모두 최소 44px 높이를 갖는다.
- [x] 좁은 뷰포트(820px 이하)에서 테마 전환 버튼이 넓은 뷰포트보다 더 작아지지 않는다.

## Comments

- `apps/web/index.html`에 light `#ffffff` fallback과 OS dark용 `#18191b` `theme-color`를 함께 추가했다. 상위 스펙의 Out of Scope에 따라 `manifest.webmanifest`는 수정하지 않았다.
- `global.css`의 `.theme-toggle__option span`, `.url-reset-button`, `.secondary-button--compact`를 모두 `min-height: 44px`로 올리고, 560px breakpoint의 theme toggle `26px` 축소 규칙을 제거했다.
- 소스 정적 검증과 production build 산출물 확인, Playwright computed-style 검증(1024px/390px에서 세 컨트롤 모두 `44px`, dark media match)을 통과했다.
- 검증: `pnpm --filter web run lint`, `pnpm --filter web exec vitest run tests/unit/app-hero.test.tsx` (2 tests), `pnpm --filter web run build` 통과. `pnpm --filter web run test:browser`는 기존 `verifySubtitleNavigationLock`이 자막 in-place 동작과 맞지 않는 `/history` 이동을 30초 대기해 실패했으며, 이번 diff에는 해당 흐름·테스트 변경이 없다.
- `impeccable` detector는 의존성 부족으로 regex fallback(degraded)에서 `[]`를 반환했다. 기존 `global.css`의 `design-system-font-size` 11건은 standing 상태로 수정·억제하지 않았다.
- 고정점 Standards/Spec 리뷰는 각각 PASS이며, 로컬 브라우저 자동화로 주소창 자체는 판독할 수 없어 시스템 UI 실기기 증적은 별도 경계로 남긴다.
