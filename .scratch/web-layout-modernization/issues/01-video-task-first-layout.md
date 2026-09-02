# 01: 영상 추출을 작업 중심 레이아웃으로 전환

**What to build:** 영상 추출 사용자가 서버 상태 카드보다 URL 입력을 먼저 작업의 시작점으로 인식하고, URL → 형식 → 품질 → 요청 순서대로 자연스럽게 진행할 수 있도록 표면 계층을 정리한다. 기존 Nintendo 미니멀 플랫 정체성과 요청·상태·내비게이션 동작은 유지하면서, 페이지·폼·선택지가 모두 중첩 카드처럼 보이는 구조를 줄인다.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] 영상 추출 화면에서 URL, 형식, 품질, 주요 요청 동작이 DOM 읽기 순서와 시각적 위계 모두에서 하나의 연속된 작업 흐름으로 보인다.
- [ ] 페이지 전체를 다시 감싸는 표면과 입력·선택 control의 기능적 경계가 같은 card elevation으로 경쟁하지 않으며, tint·hairline·shadow는 실제 구분이 필요한 요소에만 사용된다.
- [ ] Nintendo 미니멀 플랫, Pretendard, semantic color token, Nintendo red 단일 액션색, 760px 콘텐츠 최대 폭과 기존 spacing scale은 유지된다.
- [ ] URL 지우기 control은 입력값이 있을 때만 나타나고, 지우기와 상단 설정 동작의 실제 클릭 영역은 너비와 높이 모두 최소 44px이다.
- [ ] 영상·자막·요청 내역의 주요 내비게이션, `/settings`, 현재 route 표시, 요청 접수 중 이동 잠금과 모바일 safe-area 처리가 변경되지 않는다.
- [ ] 요청 payload, 선호 복원, 제출 validation, 접수·처리·완료·실패·다운로드 상태와 사용자 문구는 이번 티켓에서 변경되지 않는다.
- [ ] 320px·390px·1280px의 light·dark 화면에서 수평 overflow, control 잘림, 내비게이션 겹침 없이 URL 입력이 첫 작업 초점으로 유지된다.
- [ ] 관련 단위·브라우저 테스트, Web 정적 검사와 production build가 통과하고, 자동 검증과 별도로 390×844 및 1280×900 시각 확인 결과를 기록한다.
- [ ] 구현으로 확정된 표면 계층과 border·elevation 사용 규칙이 디자인 계약에 동기화되며, 값이 바뀌지 않은 color·typography token sidecar는 수정하지 않는다.
