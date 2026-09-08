# 10: 설정과 테마 선택 전환

Status: done (2026-09-08)

**What to build:** 사용자가 설정 화면에서 시스템·라이트·다크 테마 선호를 선택하고 재방문에도 기존처럼 적용받을 수 있다.

**Blocked by:** 05: 영상 추출 접수·결과 상태 전환, 07: 자막 추출 접수·결과 상태 전환

## 완료 조건

- [x] 설정 화면의 제목·설명·선호 그룹과 테마 선택 요소를 유틸리티로 옮긴다.
- [x] 시스템·라이트·다크 선택 상태, 접근 가능한 이름, 키보드 선택과 포커스 표시가 기존처럼 동작한다.
- [x] 저장된 선호 복원과 시스템 테마 변경 반영을 기존 테스트 경계에서 확인한다. 저장 키·초기 적용 방식·상태 모델을 바꾸지 않는다.
- [x] 라이트·다크 및 세 화면 크기에서 설정의 간격·정렬·터치 영역·현재 위치 표시를 비교한다.
- [x] 설정에서 테마를 바꾼 뒤 다른 주요 화면으로 이동해 토큰이 일관되게 적용됨을 확인한다.
- [x] 05·07 이후에 시작한다. 요청 내역 스타일의 완료는 이 티켓의 착수 조건이 아니며 계정 등 새 설정 기능은 추가하지 않는다.

## 공통 보존·검증 조건

- [x] 최신 디자인·동작 계약과 별도 작업 변경을 보존한다. Chrome 확장 프로그램·Popup, 서버 요청·응답·저장 정책 및 제품 기능은 변경하지 않는다.
- [x] 변경 전후 동일한 브라우저·폰트·fixture·화면 상태를 사용하고 변동 요소를 통제한다. 해당 영역의 시각·키보드·동작 회귀를 이 티켓에서 해결한다.
- [x] 기존 브라우저 사용자 동작 검증과 관련 단위 검사를 재사용한다. 마지막 관련 변경 이후 타입 검사·전체 단위 테스트·배포용 빌드·기존 브라우저 smoke 결과와 미검증 경계를 기록한다.

## 범위 경계

01은 테마 연결 기반, 이 티켓은 사용자에게 보이는 설정·선택 요소 전환을 소유한다.

이 티켓은 확정된 Web 앱 Tailwind CSS 전환 스펙을 따른다. 상태 표시는 작업 준비 상태이며, 티켓 게시 자체가 코드 구현 착수를 뜻하지 않는다.

## 구현 및 검증 기록 (2026-09-08)

- `/settings`의 flat panel, 제목·설명·제품 맥락 안내와 `화면 표시` preference group을
  Tailwind utility class로 옮겼다. 기존 route, 문구, navigation 위치와 외곽 card 제거
  계약은 유지했다.
- 시스템·라이트·다크 native radio의 accessible name, 선택 상태, segmented border,
  44px touch target과 keyboard focus ring을 utility variant로 연결했다. 테마 저장 키,
  초기 적용, 시스템 `matchMedia` 반영과 상태 모델은 변경하지 않았다.
- 설정·테마 전용 이전 selector를 `apps/web/src/styles/global.css`에서 제거하고,
  공통 화면이 아직 사용하는 `panel-title-row`, `console-panel`, token·font·기본 규칙과
  native 특수 효과는 보존했다. 브라우저 smoke의 heading 탐색자는 의미 기반 selector로
  갱신했다.
- 기존 browser smoke에서 설정 route의 light·dark, `320x844`·`390x844`·`1280x900`과
  기존 breakpoint를 확인하고, 테마 변경 후 `/video`로 이동해 canvas token과 선택 상태가
  유지되는지 확인했다. smoke에서 radio role의 ArrowRight 선택, 실제 `activeElement`와
  `:focus-visible` ring도 확인하고, 별도 로컬 브라우저에서 390×844와 desktop 렌더링을
  재확인했다.
- 검증 결과:
  - `pnpm --filter web exec vitest run tests/unit/settings-page.test.tsx tests/unit/theme-preference.test.ts`: 통과 (2개 파일 / 2개 테스트)
  - `pnpm --filter web run lint`: 통과
  - `pnpm --filter web run test`: 통과 (18개 파일 / 137개 테스트)
  - `pnpm --filter web run build`: 통과, `Vite web package verified.`
  - `pnpm --filter web run test:browser`: 전체 request-history smoke와 정적 서버 종료 상태 `ok`
  - `git diff --check`: 통과

## 검증 경계

단위 검사·배포용 build·fixture·로컬 Chromium 결과는 Web CSS와 mock API 경계만 증명한다.
실제 API·worker·YouTube 제공자·R2·운영 배포, 물리 모바일 기기의 safe-area/브라우저
chrome, 실제 screen reader는 검증하지 않았다.
