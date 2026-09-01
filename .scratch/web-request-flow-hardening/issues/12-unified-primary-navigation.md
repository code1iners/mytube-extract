# 12: 주요 내비게이션을 영상·자막·내역으로 통합

**What to build:** 사용자가 영상 추출, 자막 추출, 요청 내역을 같은 수준의 주요 목적지로 인식하고 어떤 화면에서든 예측 가능한 위치에서 이동할 수 있게 한다. 모바일은 한 손 조작에 맞는 하단 3탭을, 데스크톱은 작업 영역 폭에 맞는 내비게이션을 제공한다. 테마 선택은 작업 목적지와 경쟁하지 않는 보조 설정으로 이동하되 기존 테마 선호와 요청 중 이동 잠금은 유지한다.

**Blocked by:** None (can start immediately)

**Status:** done (2026-09-01)

- [x] 영상 추출, 자막 추출, 요청 내역이 모바일과 데스크톱 모두에서 같은 수준의 세 주요 목적지로 보인다.
- [x] 현재 목적지가 텍스트와 시각 상태로 구분되고, 접근성 트리에서는 `aria-current`로 전달된다.
- [x] 모바일 내비게이션은 안전 영역을 포함한 하단 조작 위치와 최소 44px 터치 영역을 유지하며, 데스크톱 내비게이션은 작업 영역과 시각적으로 정렬된다.
- [x] 테마 선택은 보조 설정으로 이동하지만 시스템·라이트·다크 선택과 저장된 선호 복원 동작은 유지된다.
- [x] 요청 접수 중에는 현재 목적지를 제외한 다른 주요 목적지로 이동할 수 없고, 비활성 상태와 이유가 접근 가능하게 전달된다.
- [x] 320px, 390px, 1280px 폭에서 light·dark 화면의 수평 넘침과 내비게이션 겹침이 없으며 관련 단위·브라우저 검증이 통과한다.

## Comments

- 공통 `PrimaryNavigation`을 추가해 데스크톱 헤더와 모바일 하단 3탭이 같은 목적지·활성 상태·잠금 접근성 계약을 공유하도록 했다. 요청 내역은 더 이상 별도 header link가 아니라 영상·자막과 같은 주요 navigation level에서 제공한다.
- 테마 radio group은 보조 `/settings` route로 이동하고 layout의 기존 theme preference state/storage 콜백을 그대로 사용한다. 요청 접수 중에는 설정 링크도 잠근다.
- 검증: `pnpm --filter web run lint`, 관련 Vitest 4 tests, `pnpm --filter web run build`, `pnpm --filter web run test:browser` 통과. 브라우저 검증은 기존 요청 흐름과 네 route surface의 320px·390px·1280px light/dark 렌더링, 모바일 640px 높이의 fixed 하단 navigation, 최하단 scroll 겹침, overflow·터치 영역·테마 복원을 포함한다. 실제 기기의 non-zero safe-area inset은 로컬 Chromium에서 재현하지 못하므로 CSS `env(safe-area-inset-bottom)` 선언을 함께 확인했다.
