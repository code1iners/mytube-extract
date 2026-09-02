# 05: 설정·빈 요청 내역의 보조 표면 정리

**What to build:** 주요 요청 흐름과 삭제 복구가 정리된 뒤, 설정과 빈 요청 내역이 큰 외곽 카드나 반복 설명보다 실제 사용자 목적을 먼저 보여주도록 보조 표면을 정돈한다. 네 route가 하나의 현대적인 제품으로 읽히는지 최종 반응형·테마 검증까지 완료한다.

**Blocked by:** 01: 영상 추출을 작업 중심 레이아웃으로 전환, 02: 자막 요청 레이아웃과 모바일 밀도 개선, 03: 요청 readiness를 상태별 compact 안내로 정리, 04: 요청 내역 삭제에 8초 되돌리기 제공.

**Status:** done (2026-09-02)

- [x] `/settings`에서 불필요한 외곽 card elevation보다 `화면 표시` preference group, 테마 설명과 시스템·라이트·다크 선택이 직접적인 작업 흐름으로 보인다.
- [x] `/settings` route, 시스템·라이트·다크 값, 저장 키, 저장된 선호 복원과 현재 위치 표시는 유지되고 계정·저장소·운영 설정을 새로 만들지 않는다.
- [x] 상단 설정 동작의 실제 clickable box는 너비와 높이 모두 최소 44px이며 keyboard focus와 요청 중 잠금 설명이 유지된다.
- [x] 빈 요청 내역에서 영상·자막 두 진입점, 현재 브라우저에만 남는 이력, 완료 파일 7일 보관 사실은 유지하면서 같은 의미를 반복하는 제목·설명은 줄어든다.
- [x] 기존 요청이 있을 때의 최신순 목록, status polling, 다운로드, 다시 요청, 내역 삭제·되돌리기 동작은 빈 상태 정리로 변경되지 않는다.
- [x] `/video`, `/subtitles`, `/history`, `/settings`가 320px·390px·1280px의 light·dark에서 같은 콘텐츠 폭·여백·표면 계층과 예측 가능한 읽기 순서를 사용한다.
- [x] 모바일 fixed 하단 내비게이션, desktop 주요 내비게이션, safe-area, 현재 route 표시가 모든 화면에서 겹침·잘림·수평 overflow 없이 유지된다.
- [x] Web 정적 검사, 전체 단위 테스트, production build와 기존 브라우저 smoke가 마지막 변경 이후 통과한다.
- [x] Impeccable detector는 coverage 산출물이 아닌 실제 변경 target에 한 번 실행하고, 390×844·1280×900 light·dark 시각 확인은 한 번의 bounded pass와 최대 한 번의 재확인으로 마친다.
- [x] fixture·로컬 Chromium 증거와 실제 API·worker·provider·물리 모바일 기기·브라우저 시스템 UI·화면 낭독기 검증 경계를 완료 보고에서 분리한다.

## Comments

### 2026-09-02 구현

- `/settings`의 외곽 card 표면을 제거하고 `화면 표시` preference group, 시스템·라이트·다크 설명과 native radio 흐름을 workspace에 직접 배치했다. 테마 값·저장 키·복원·현재 route 표시·요청 중 설정 이동 잠금은 유지했다.
- 빈 `/history`는 `요청 내역`과 짧은 상태 설명 뒤 `시작할 작업을 선택하세요.`를 보여주고, 영상·자막 시작 링크를 flat한 동등 행으로 정리했다. 브라우저 로컬 이력과 완료 파일 7일 보관 note는 한 번만 유지했다.
- 기존 receipt 목록의 최신순 표시, status polling, 다운로드, 다시 요청, 삭제·8초 undo와 요청 route의 payload/readiness 흐름은 변경하지 않았다. route 문서와 공통 `docs/DESIGN.md`에 확정된 표면 계약을 동기화했다.
- 단위 테스트에 설정·빈 상태 표면 계약을 반영하고, 기존 browser smoke에 320×844·390×844·1280×900 light/dark 조합의 빈 상태 surface·overflow·링크 조작과 설정 surface·radio·focus·현재 route 검증을 추가했다.
- 리뷰 보강으로 설정 설명의 저장 범위를 명시하고, populated history의 긴 파일명·`history-panel` 최소 폭과 `system` 테마 저장·reload 복원도 browser smoke에서 확인했다.
- 검증: Web lint·unit·production build/PWA package·기존 browser smoke·모노레포 전체 unit test·`git diff --check`를 실행하고, Impeccable detector는 실제 변경 UI target에서 `[]`를 반환했다.
- fixture·로컬 Chromium 및 Playwright 시각 확인은 실제 API·worker/provider, 물리 모바일 browser chrome·safe-area, 화면 낭독기 동작을 대체하지 않는다.
