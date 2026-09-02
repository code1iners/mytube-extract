# 03: 요청 readiness를 상태별 compact 안내로 정리

**What to build:** 영상·자막 요청 사용자가 정상적인 API·worker 상태보다 자신의 입력 작업에 집중하면서도, 요청할 수 없는 경우에는 API 확인 실패와 worker 미가용을 구분하고 같은 화면에서 재확인을 시도할 수 있게 한다. 상태 의미와 접근성 공지는 유지하고 시각적 비중과 중복 문구만 정리한다.

**Blocked by:** 01: 영상 추출을 작업 중심 레이아웃으로 전환, 02: 자막 요청 레이아웃과 모바일 밀도 개선.

**Status:** ready-for-agent

- [ ] `checking`과 `ready`는 제목·상태명·필요 최소 정보만 가진 compact status로 표시되어 영상 URL 또는 자막 파일 입력보다 강한 카드로 보이지 않는다.
- [ ] `failed`는 API 상태 요청을 확인하지 못한 상태로, `unavailable`은 API가 응답했지만 worker가 작업을 받을 수 없는 상태로 구분해 확장 안내한다.
- [ ] `failed`와 `unavailable`에는 기존 재확인 동작이 유지되고 재확인 중 중복 health 요청과 요청 제출이 발생하지 않는다.
- [ ] 현재 health 계약으로 확인할 수 없는 tunnel·process·network 원인을 추정하거나 존재하지 않는 로그 링크·운영 명령을 추가하지 않는다.
- [ ] 마지막 확인 시각은 정상 상태의 보조 정보로 낮아지고, readiness 영역과 주요 요청 동작 근처에 동일한 긴 차단 사유가 반복되지 않는다.
- [ ] 제출 가능 여부는 API 응답과 worker availability를 계속 유일한 readiness 근거로 사용하며, 접수 뒤 job 상태가 새 요청 readiness로 덮이지 않는다.
- [ ] `status`·`alert`, `aria-live`, `aria-busy`, 재확인 accessible name과 keyboard focus가 네 상태 및 상태 전환에서 유지된다.
- [ ] 영상·자막 route 모두에서 `checking`·`ready`의 compact 표현과 `failed`·`unavailable`의 확장 표현, 재확인, 중복 문구 부재를 단위·브라우저 테스트로 검증한다.
- [ ] 320px·390px·1280px의 light·dark 화면에서 readiness가 입력 흐름을 밀어내거나 수평 overflow를 만들지 않고, Web 정적 검사와 production build가 통과한다.
