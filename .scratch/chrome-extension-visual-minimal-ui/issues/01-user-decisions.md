# 01: 사용자 결정 확인

**What to build:** 구현 전에 사용자가 내려야 하는 결정을 한곳에 기록한다. 모든 결정을 대화 중에 받았으므로 이 티켓은 완료 상태로 발행한다.

**Blocked by:** None (can start immediately)

**Status:** done (2026-11-12, 대화에서 결정 수령)

- [x] 방향: A안 "무대"를 채택한다(B·C안은 구현하지 않음).
- [x] 현재 탭: Popup을 열 때 활성 탭 URL을 자동으로 읽어 무대에 올린다. 기존 PRD의 "버튼으로만 현재 탭 가져오기" 결정을 대체한다.
- [x] Overlay 진행 표시: 이번 범위에 포함한다. 새 background→content 메시지 없이 저장된 최근 요청 목록을 구독하는 방식이다.
- [x] 테스트 seam: `PopupDownloadModel` 통합 테스트, 기존 Playwright 브라우저 스모크(popup·overlay), 기존 단위 계약 테스트를 확장한다. 새 seam은 만들지 않는다.
- [x] 처음 사용 시 빈 최근 요청 줄은 숨긴다(빈 상태는 최근 요청 화면에서만 보여줌).
- [x] 티켓 분할 10개와 막는 관계를 승인받았다.
