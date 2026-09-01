# 09: dark 대응 theme-color + 44px 터치 타깃

**What to build:** 브라우저/PWA 시스템 UI 색이 앱의 dark 테마를 따르도록 `theme-color` meta를 추가하고, 44px 권장 터치 타깃에 못 미치는 세 개의 작은 컨트롤(테마 전환, URL 지우기, 재시도 버튼)을 키운다.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `index.html`에 `prefers-color-scheme: dark`용 `theme-color` meta가 기존 light 메타와 함께 존재한다.
- [ ] dark 테마로 열었을 때 브라우저 주소창/시스템 UI 색이 흰색으로 남지 않는다.
- [ ] 테마 전환 버튼, URL 지우기 버튼, 컴팩트 보조 버튼(worker-health 재시도)이 모두 최소 44px 높이를 갖는다.
- [ ] 좁은 뷰포트(820px 이하)에서 테마 전환 버튼이 넓은 뷰포트보다 더 작아지지 않는다.
