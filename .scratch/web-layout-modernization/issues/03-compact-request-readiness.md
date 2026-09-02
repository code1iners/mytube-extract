# 03: 요청 readiness를 상태별 compact 안내로 정리

**What to build:** 영상·자막 요청 사용자가 정상적인 API·worker 상태보다 자신의 입력 작업에 집중하면서도, 요청할 수 없는 경우에는 API 확인 실패와 worker 미가용을 구분하고 같은 화면에서 재확인을 시도할 수 있게 한다. 상태 의미와 접근성 공지는 유지하고 시각적 비중과 중복 문구만 정리한다.

**Blocked by:** 01: 영상 추출을 작업 중심 레이아웃으로 전환, 02: 자막 요청 레이아웃과 모바일 밀도 개선.

**Status:** done (2026-09-02)

- [x] `checking`과 `ready`는 제목·상태명·필요 최소 정보만 가진 compact status로 표시되어 영상 URL 또는 자막 파일 입력보다 강한 카드로 보이지 않는다.
- [x] `failed`는 API 상태 요청을 확인하지 못한 상태로, `unavailable`은 API가 응답했지만 worker가 작업을 받을 수 없는 상태로 구분해 확장 안내한다.
- [x] `failed`와 `unavailable`에는 기존 재확인 동작이 유지되고 재확인 중 중복 health 요청과 요청 제출이 발생하지 않는다.
- [x] 현재 health 계약으로 확인할 수 없는 tunnel·process·network 원인을 추정하거나 존재하지 않는 로그 링크·운영 명령을 추가하지 않는다.
- [x] 마지막 확인 시각은 정상 상태의 보조 정보로 낮아지고, readiness 영역과 주요 요청 동작 근처에 동일한 긴 차단 사유가 반복되지 않는다.
- [x] 제출 가능 여부는 API 응답과 worker availability를 계속 유일한 readiness 근거로 사용하며, 접수 뒤 job 상태가 새 요청 readiness로 덮이지 않는다.
- [x] `status`·`alert`, `aria-live`, `aria-busy`, 재확인 accessible name과 keyboard focus가 네 상태 및 상태 전환에서 유지된다.
- [x] 영상·자막 route 모두에서 `checking`·`ready`의 compact 표현과 `failed`·`unavailable`의 확장 표현, 재확인, 중복 문구 부재를 단위·브라우저 테스트로 검증한다.
- [x] 320px·390px·1280px의 light·dark 화면에서 readiness가 입력 흐름을 밀어내거나 수평 overflow를 만들지 않고, Web 정적 검사와 production build가 통과한다.

## Comments

### 2026-09-02 구현

- `checking`·`ready`를 flat compact status로 축약하고, `failed`·`unavailable`은 API 확인 실패와 worker 미가용을 구분한 확장 안내로 표시했다.
- 마지막 확인 시각은 `ready`에서만 보조 메타로 표시하고, health 설명을 route별 `aria-describedby` 대상으로 연결해 제출 차단 문구 중복을 제거했다. 기존 health query·재확인 guard·요청 payload와 상태 흐름은 변경하지 않았다.
- 영상·자막 단위 테스트와 request/history 브라우저 smoke를 확장해 네 상태, 키보드 재확인, 중복 health 요청·제출 차단, 320px·390px·1280px light·dark geometry를 검증했다.
- 검증 완료: `pnpm --filter web run lint`, Web unit `16 files / 116 tests`, `pnpm --filter web run test:browser`(production build·PWA package·local Chromium fixture smoke 포함).
- 로컬 fixture·Chromium 결과는 실제 API·worker·provider, 물리 모바일 browser chrome·safe-area, screen reader 동작을 증명하지 않는다.
