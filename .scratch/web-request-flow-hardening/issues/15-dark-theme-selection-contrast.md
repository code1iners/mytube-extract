# 15: 통합된 테마 설정의 다크 모드 대비 보장

**What to build:** 12에서 재배치한 테마 설정을 포함해 모든 선택형 control의 라벨과 선택 상태가 light·dark 테마에서 읽기 쉬운 대비를 갖게 한다. Nintendo red의 액션 정체성은 유지하되 red-on-dark 일반 텍스트처럼 접근성 기준에 못 미치는 조합은 사용하지 않는다.

**Blocked by:** 12: 주요 내비게이션을 영상·자막·내역으로 통합

**Status:** done (2026-09-02)

- [x] 다크 테마의 선택된 테마 control과 선택형 chip 라벨이 실제 배경에서 WCAG AA 일반 텍스트 대비 4.5:1 이상을 충족한다.
- [x] 선택 경계와 키보드 focus indicator는 인접 색상과 3:1 이상 대비를 충족하며 선택 여부가 색상만으로 전달되지 않는다.
- [x] Nintendo red는 주요 액션과 선택 표시의 브랜드 역할을 유지하면서 본문 가독성을 해치지 않는 방식으로 쓰인다.
- [x] 시스템·라이트·다크 전환과 저장된 테마 선호 복원 동작은 변경되지 않는다.
- [x] 색 token을 변경하면 디자인 문서와 Impeccable 사이드카의 같은 semantic token 값도 함께 동기화된다.
- [x] 실제 사용 배경에 대한 대비 계산과 light·dark 브라우저 렌더링 검증이 기록된다.

## Comments

- 선택된 `theme-toggle`, 형식 `segment`, 품질 `quality-chip`은 `--color-action-primary`를 경계와 형식 아이콘에만 사용하고, 라벨·밑줄은 `--color-text-primary`와 `--color-surface`를 사용한다. native radio의 checked semantics와 밑줄을 함께 유지해 선택 여부를 색상만으로 전달하지 않는다.
- 실제 사용 배경의 Chrome computed-style 대비 계산: dark(`#f2f0ee` on `#202124`) 라벨/밑줄 `14.163:1`, red 경계(`#e60012` on `#202124`) `3.353:1`, focus(`#a9b4f2` on `#202124`) `8.048:1`; light(`#484848` on `#f8f8f8`) 라벨/밑줄 `8.612:1`, red 경계(`#e60012` on `#f8f8f8`) `4.521:1`, focus(`#4b5cce` on `#f8f8f8`) `5.314:1`으로 측정했다. 라벨/밑줄은 일반 텍스트 4.5:1 이상, 경계와 focus는 UI 기준 3:1 이상이다.
- 로컬 Chrome에서 `http://localhost:5010/settings`와 `/video`를 390×780으로 재로드해 light·dark 선택 상태와 focus를 확인했다. 320px dark·1280px light에서도 control 높이 48px, 콘텐츠 잘림·수평 overflow 없음, 브라우저 error/warning 없음(`[]`)을 확인했다. 저장된 light 선택은 설정 화면 재로드 후에도 복원됐다. 이 결과는 로컬 브라우저 증거이며 실기기·브라우저 시스템 UI·실제 provider 동작을 증명하지 않는다.
- `node /Users/wraith/.agents/skills/impeccable/scripts/detect.mjs --json apps/web/src`는 `[]`를 반환했다. `pnpm --filter web run lint`, `pnpm --filter web run test`, `pnpm --filter web run build`, `pnpm --filter web run test:browser`, `pnpm lint`, `pnpm test`를 통과했다.
- `docs/DESIGN.md`와 `.impeccable/design.json`의 선택 chip 계약을 실제 CSS와 동기화했다. 색상 token 값 자체는 변경하지 않았다.
