# 05: 설정·빈 요청 내역의 보조 표면 정리

**What to build:** 주요 요청 흐름과 삭제 복구가 정리된 뒤, 설정과 빈 요청 내역이 큰 외곽 카드나 반복 설명보다 실제 사용자 목적을 먼저 보여주도록 보조 표면을 정돈한다. 네 route가 하나의 현대적인 제품으로 읽히는지 최종 반응형·테마 검증까지 완료한다.

**Blocked by:** 01: 영상 추출을 작업 중심 레이아웃으로 전환, 02: 자막 요청 레이아웃과 모바일 밀도 개선, 03: 요청 readiness를 상태별 compact 안내로 정리, 04: 요청 내역 삭제에 8초 되돌리기 제공.

**Status:** ready-for-agent

- [ ] `/settings`에서 불필요한 외곽 card elevation보다 `화면 표시` preference group, 테마 설명과 시스템·라이트·다크 선택이 직접적인 작업 흐름으로 보인다.
- [ ] `/settings` route, 시스템·라이트·다크 값, 저장 키, 저장된 선호 복원과 현재 위치 표시는 유지되고 계정·저장소·운영 설정을 새로 만들지 않는다.
- [ ] 상단 설정 동작의 실제 clickable box는 너비와 높이 모두 최소 44px이며 keyboard focus와 요청 중 잠금 설명이 유지된다.
- [ ] 빈 요청 내역에서 영상·자막 두 진입점, 현재 브라우저에만 남는 이력, 완료 파일 7일 보관 사실은 유지하면서 같은 의미를 반복하는 제목·설명은 줄어든다.
- [ ] 기존 요청이 있을 때의 최신순 목록, status polling, 다운로드, 다시 요청, 내역 삭제·되돌리기 동작은 빈 상태 정리로 변경되지 않는다.
- [ ] `/video`, `/subtitles`, `/history`, `/settings`가 320px·390px·1280px의 light·dark에서 같은 콘텐츠 폭·여백·표면 계층과 예측 가능한 읽기 순서를 사용한다.
- [ ] 모바일 fixed 하단 내비게이션, desktop 주요 내비게이션, safe-area, 현재 route 표시가 모든 화면에서 겹침·잘림·수평 overflow 없이 유지된다.
- [ ] Web 정적 검사, 전체 단위 테스트, production build와 기존 브라우저 smoke가 마지막 변경 이후 통과한다.
- [ ] Impeccable detector는 coverage 산출물이 아닌 실제 변경 target에 한 번 실행하고, 390×844·1280×900 light·dark 시각 확인은 한 번의 bounded pass와 최대 한 번의 재확인으로 마친다.
- [ ] fixture·로컬 Chromium 증거와 실제 API·worker·provider·물리 모바일 기기·브라우저 시스템 UI·화면 낭독기 검증 경계를 완료 보고에서 분리한다.
