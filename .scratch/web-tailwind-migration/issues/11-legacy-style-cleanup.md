# 11: 이전 화면 스타일 정리

Status: done (2026-09-08)

**What to build:** 모든 주요 화면이 전환된 상태에서 일반 화면 스타일의 이중 정의를 제거해 유지보수자가 하나의 작성 방식으로 관리할 수 있다.

**Blocked by:** 09: 요청 내역 삭제·되돌리기 전환, 10: 설정과 테마 선택 전환

## 완료 조건

- [x] 모든 전환 티켓의 완료와 남겨 둔 공유 선택자 소비자를 확인하여 사용하지 않는 이전 일반 화면 규칙·중복 정의를 제거한다.
- [x] 전역 스타일에 남는 토큰·폰트·기본 규칙·필요한 특수 효과를 용도별로 기록하고 일반 화면 스타일이 예외에 섞여 있지 않다.
- [x] 기존 클래스를 통째로 `@apply`로 옮긴 상태가 아니며, 역할별 토큰 값을 화면에 중복 하드코딩하지 않는다.
- [x] 스타일 제거에 편승하여 테스트 식별자·접근성 속성·동작상 클래스·요청 인터페이스를 제거하지 않는다.
- [x] 정리 전후 주요 화면과 대표 상태를 비교하여 우연히 남은 이전 선택자에 의존하던 표시가 없는지 확인한다. 의존이 발견되면 해당 범위를 수정하고 검증한다.
- [x] 마지막 변경 이후 Web 앱 타입 정적 검사·전체 단위 테스트·배포용 빌드와 패키징 검사·기존 브라우저 smoke가 통과한다.

## 공통 보존·검증 조건

- [x] 최신 디자인·동작 계약과 별도 작업 변경을 보존한다. Chrome 확장 프로그램·Popup, 서버 요청·응답·저장 정책 및 제품 기능은 변경하지 않는다.
- [x] 변경 전후 동일한 브라우저·폰트·fixture·화면 상태를 사용하고 변동 요소를 통제한다. 해당 영역의 시각·키보드·동작 회귀를 이 티켓에서 해결한다.
- [x] 기존 브라우저 사용자 동작 검증과 관련 단위 검사를 재사용한다. 마지막 관련 변경 이후 타입 검사·전체 단위 테스트·배포용 빌드·기존 브라우저 smoke 결과와 미검증 경계를 기록한다.

## 범위 경계

의존성은 09·10으로 표현하되 그 선행 티켓 전체 완료를 확인한다. 무관한 코드 정리와 디자인 개선을 포함하지 않는다.

이 티켓은 확정된 Web 앱 Tailwind CSS 전환 스펙을 따른다. 상태와 아래 기록은 구현·검증 결과를 반영한다.

## 구현 및 검증 기록 (2026-09-08)

- `apps/web/src/styles/global.css`에서는 Tailwind theme alias, 토큰·폰트, `:root`/기본 요소, `.visually-hidden`, native `details` 표식, safe-area, 반응형 scroll padding, reduced-motion만 유지했다. 화면 패널·제목·로딩·버튼·빈 상태와 중복 focus/hover 규칙은 소비자 utility로 옮기고 제거했다.
- 공통 제목은 `PanelTitle`, 오류·worker action은 역할별 Tailwind utility 상수로 정리했다. `phase-panel`, `route-loading`, `panel-title-row`, `panel-title__refresh`, `primary-button`, `secondary-button`은 테스트·동작 훅으로 markup에 보존했다. `@apply`는 사용하지 않았다.
- 기존 Chromium fixture로 요청 내역, 설정, 영상·자막 요청과 terminal/accepting/result/error, 테마·뷰포트 조합 및 키보드·focus 흐름을 재실행했다.
- 통과한 검증:
  - `pnpm --filter web run lint`
  - `pnpm --filter web run test` — 18 files, 137 tests
  - `pnpm --filter web run build` — Vite package verification 포함
  - `pnpm --filter web run test:browser` — `{"status":"ok"}`
  - `pnpm test` — 12 tasks successful
  - `git diff --check`
- 검증 경계: 브라우저 검증은 로컬 Chromium fixture와 정적 패키지에 대한 증거이며, 실제 production/provider/worker/R2, 배포 환경, 물리 기기와 실제 screen reader 승인을 의미하지 않는다.
