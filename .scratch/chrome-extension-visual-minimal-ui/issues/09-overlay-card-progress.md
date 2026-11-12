# 09: 오버레이 카드 진행 상태

**What to build:** Overlay 스크립트가 저장된 최근 요청 목록의 변경을 구독한다(Popup과 같은 storage 변경 이벤트, 새 background→content 메시지 없음). 각 카드의 영상 ID와 job의 영상 ID를 매칭해 썸네일 위에 상태를 남긴다:
- 대기: 시계와 회전 링. 처리: 회전 링(숫자 없음).
- 완료: 초록 체크 배지. 몇 초 뒤 사라진다.
- 실패: crimson 다시 시도 버튼 배지. 누르면 같은 형식·품질로 재제출한다.

상태 배지는 호버와 관계없이 보이고, 상태마다 접근 가능한 이름이 있다. 무한 스크롤이나 페이지 이동으로 카드가 다시 그려져도 같은 매칭으로 다시 표시한다. 최근 5건 보관 목록에 있는 job만 표시 대상이다. 한 영상에 job이 여러 개면 가장 최신 job을 기준으로 한다.

**Blocked by:** 02, 08

**Status:** resolved

- [x] 영상 ID 매칭과 상태 선택(최신 job 기준, 만료·목록 밖 제외)을 단위 테스트로 확인한다.
- [x] overlay 브라우저 스모크: 저장된 job을 대기 → 처리 → 완료로 바꾸면 해당 카드 배지가 바뀌고, 완료 배지는 사라진다. 실패 배지를 누르면 같은 조건의 다운로드 메시지가 전송된다.
- [x] overlay 브라우저 스모크: 동적으로 다시 그려진 카드에도 현재 상태가 다시 표시된다.
- [x] 확장 `lint`, `test`, `build`가 통과한다.

## Comments

- 구현: `apps/chrome-extension/src/features/youtube-overlay/youtube-overlay-card-status.ts`(영상 ID 매칭·최신 job·만료 제외·완료 배지 시간), `youtube-overlay-ui.ts`(storage `subscribeJobs`·`loadJobs` 구독, 카드별 상태 배지, 실패 배지 재제출). 새 background→content 메시지는 없다.
- 리뷰 반영:
  - Background는 진행 중 job만 남으면 5건을 넘겨서도 보관하므로, Overlay가 목록을 다시 5건으로 자르지 않는다. 저장된 목록 전체를 보관 목록으로 본다.
  - 첫 로드 뒤 완료 상태로 처음 나타난 job에도 완료 배지를 띄운다.
  - 읽기보다 변경 이벤트가 먼저 오면 늦게 온 읽기 결과를 버린다.
  - 링·hover 색은 CSS 변수와 `filter`로 바꿨다.
- 검증(2026-11-13):
  - 확장 `lint`, `test` 247/247, `test:browser`(`wxt build`·패키지 검사·popup·overlay·visibility 스모크)가 통과했다.
  - popup 스모크는 `.env`의 로컬 API가 꺼져 있어, 이전 티켓처럼 `WXT_MEDIA_NEST_API_BASE_URL`을 스모크 기본 주소로 맞춰 실행했다. 이때 실제 API에는 `/health` GET만 나갔고 다운로드 요청은 보내지 않았다.
- 대표 캡처: `/tmp/mytube-09/shots/`의 `overlay-status-queued.png`, `overlay-status-processing-hover.png`, `overlay-status-completed.png`, `overlay-status-failed.png`, `overlay-status-redrawn.png`.
- 시안과 다른 점(비차단, 사용자 확인 필요):
  - 승인 시안 `mockups/extension-a-states.html`은 진행 링을 호버 UI와 같은 오른쪽 위 자리에 둔다.
  - 구현은 상태 배지를 썸네일 왼쪽 위에 둔다. "상태 배지는 호버와 관계없이 보인다"는 요구 때문에 호버 중에도 배지가 보여야 하는데, 같은 자리면 형식 버튼과 겹쳐 실패 배지나 형식 버튼을 잘못 누르게 된다.
  - 스펙의 "시안과 의도적으로 다른 점" 목록에는 이 항목이 없다. 오른쪽 위를 원하면 호버 중 배지 처리 방식을 따로 정해야 한다.
- 남은 경미 사항:
  - 페이지를 연 직후 첫 읽기가 끝나기 전에 첫 변경 이벤트가 오면, 그 목록이 기준선이 된다. 그래서 그 시점에 막 완료된 job은 완료 배지를 건너뛴다. 이때 실패 배지와 진행 배지는 정상 표시된다.
