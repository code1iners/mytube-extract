# 06: 최근 요청 줄과 목록 화면

**What to build:** 추출 버튼 아래에 최근 요청 썸네일 최대 세 개와 더보기 버튼을 둔다. 썸네일 모서리 배지로 상태를 구분한다: 대기(회색 시계), 처리(파랑 회전), 완료(초록 체크), 실패(crimson 느낌표), 만료(흐린 썸네일). 줄이나 더보기를 누르면 Popup 내부 `recent` 화면이 열린다. 각 항목은 썸네일, 요청 영상 제목, 형식 아이콘과 품질, 요청 시각, 상태 아이콘과 상태명을 보여주고 행동을 하나씩 둔다:
- 완료: 다시 내려받기. 보관 기간 안의 다운로드 주소로 로컬 다운로드를 다시 시작한다.
- 실패: 다시 시도. 만료: 다시 요청. 둘 다 job의 원본·형식·품질로 새 job을 제출하고, 파일명은 기본 이름을 쓴다. 재제출은 알림 재시도와 같은 background 제출 경로를 쓴다.
- 대기·처리: 행동 없이 상태 아이콘만 둔다.

뒤로 버튼으로 무대 화면에 돌아간다. Popup을 다시 열면 항상 무대 화면이다. 최근 요청이 없으면 무대 아래 줄은 숨기고, `recent` 화면에는 빈 상자 아이콘을 보여준다. 원본 정보가 없는 예전 job은 중립 배경과 형식 아이콘으로 그린다. 기존 5건 보관 정책과 진행 중 job 보호는 그대로 둔다.

**Blocked by:** 02, 03

**Status:** resolved

- [x] model 통합 테스트: 최근 요청의 상태별 표시 정보(배지 종류·행동)가 job 상태와 만료 여부에서 올바르게 도출된다.
- [x] model 통합 테스트: 다시 시도·다시 요청은 job의 원본·형식·품질로 제출되고, 다시 내려받기는 해당 다운로드 주소로 downloads adapter를 호출한다. 만료된 완료 job은 다시 내려받기를 제공하지 않는다.
- [x] model 통합 테스트: 원본 정보가 없는 예전 job과 빈 목록이 오류 없이 표시 정보를 만든다.
- [x] popup 브라우저 스모크가 최근 요청 줄, `recent` 화면 열기·뒤로, 빈 상태를 확인하도록 갱신되어 통과한다.
- [x] 확장 `lint`, `test`, `build`가 통과한다.

## Comments

- 2026-11-12 구현 완료.
  - 표시 정보:
    - `src/domain/recent-request/recent-request.ts`의 `deriveRecentRequest(job, now)`가 job마다 상태 배지(`RecentRequestState`: queued·processing·completed·failed·expired), 상태명, 행동(`RecentRequestAction`: redownload·retry·rerequest 또는 null), 영상 ID, 썸네일, 제목을 도출한다.
    - model snapshot에 `recentRequests`(위 값에 `pending`·`locked`를 더한 `PopupRecentRequest`), `recentActionResult`, `view: PopupView`(`'main' | 'recent' | 'settings'`, `popup-state.ts`)를 더했다.
    - 메서드는 `openView(view)`, `runRecentRequestAction(jobId)`다. Popup을 다시 열면 새 model이라 항상 `main`에서 시작한다.
  - 만료 판정: 서버 `displayStatus === 'expired'`이거나, 완료 job의 생성 시각 + `retentionDays`가 지났으면 만료다.
    - Background가 완료 뒤 job을 다시 조회하지 않아 저장된 job이 `completed`로 남기 때문에 클라이언트에서도 판정한다.
    - 생성 시각 기준이라 서버보다 조금 일찍 만료로 볼 수 있다. Popup을 연 채로 기한이 지나면 다음 갱신 때 반영된다.
  - 행동:
    - 다시 내려받기: model에 `downloads: DownloadsAdapter` 의존성을 더해 job의 `downloadUrl`로 `startDownload`를 호출한다. 서버에 job을 새로 만들지 않는다.
    - 다시 시도·다시 요청: `downloadJobs.submitJob`(Background 제출 메시지 → `jobManager.submitJob`, 알림 재시도와 같은 경로)으로 job의 원본·형식·품질을 보낸다.
    - 두 행동 모두 파일명은 기본 이름(`sanitizeYoutubeOverlayFilename(job.title, videoId)` + 확장자)을 쓴다. 다시 내려받기도 기본 이름이라 05에서 사용자가 바꾼 이름은 남지 않는다. 바꾼 이름은 job에 저장되지 않기 때문이다.
    - 실행 중에는 같은 항목의 버튼을 잠근다(`pending`). 같은 영상의 다른 요청이 진행 중이면 다시 시도·다시 요청도 잠근다(`locked`). 무대의 같은 영상 제출 잠금과 같은 규칙이다.
    - 결과는 성공이면 live region(`다운로드를 다시 시작했어요`·`다시 요청했어요`), 실패면 recent 화면의 `role="alert"` 한 줄로 알린다.
  - 스펙에 없던 결정: 아래 경우는 다시 보낼 근거가 없어 행동 버튼을 두지 않는다.
    - 원본 주소가 없는 예전 실패·만료 job
    - `downloadUrl`이 없는 완료 job
  - 화면:
    - 무대 아래 줄은 최신 세 개의 썸네일 버튼(`제목, 상태명`)과 더보기(`최근 요청 모두 보기`)다. 어느 쪽을 눌러도 `recent` 화면이 열린다.
    - `recent` 화면은 뒤로 버튼과 제목, 항목 목록(썸네일·제목·형식 아이콘과 품질·요청 시각·상태 아이콘과 상태명·행동 하나)이다. 요청 시각은 오늘이면 `19:50`, 아니면 `11월 4일`이다.
    - 화면을 바꾸면 포커스를 옮긴다. 열면 뒤로 버튼, 돌아오면 더보기 버튼이다.
    - 예전 job이나 썸네일 로드 실패는 중립 배경과 형식 아이콘으로 그린다.
    - 기존 글자 목록(`RecentJobsList`)과 그 CSS는 지웠다.
  - 시각:
    - 만료 배지는 리뷰 지적에 따라 `DESIGN.md` 9절의 "만료는 비활성 회색 대신 보조 텍스트색"을 따른다. 대기와 색이 같아지므로 아이콘을 시계 대신 `clock-off`로 구분한다. 시안의 흐린 회색 배지·시계 아이콘과 다른 점이다.
    - 배지 아이콘 색 token으로 `--color-on-status`를 추가했다.
    - 시안의 처리 진행 막대(퍼센트)는 스펙대로 넣지 않았다.
- 확인이 필요한 스펙 내부 차이(비차단, 구현은 스펙 기본값을 따름):
  - 스펙의 열린 결정 기본값대로 최근 요청이 없으면 무대 아래 줄을 숨겼다. 그런데 이 줄이 `recent` 화면의 유일한 진입점이라, 빈 상자 화면에는 실제로 닿을 수 없다(5건 보관 정책상 화면을 연 채로 목록이 비지도 않는다).
  - 빈 상자 화면은 구현했고 model 테스트로 빈 목록을 확인했다. 브라우저 스모크는 기록이 없을 때 줄이 숨겨지는 것만 확인한다.
  - 승인 시안은 빈 상태에서도 빈 줄 버튼(`strip-empty`)을 둔다. 처음 쓰는 사용자에게 빈 상자를 보여 주려면 시안처럼 빈 줄을 두는 쪽으로 결정이 필요하다.
- 코드 리뷰(Standards·Spec):
  - 반영한 지적:
    - 만료 배지 대비
    - 대기·만료가 색만으로 구분됨
    - 성공 결과 live region 없음
    - 같은 영상 진행 중 재제출 잠금 없음
    - JSDoc 주석 위치
  - 반영하지 않은 지적(판단 사항):
    - 형식 라벨·품질 단위 표기 분기 중복
    - `PopupView`의 `'settings'`: 07에서 쓰는 스펙 타입이다.
    - 빈 문자열 기본값
    - 품질 단위 표기(`kbps`/`p`)
- 검증(마지막 변경 뒤):
  - 확장 `lint`(tsc)·`test`(26파일 221개)·`build` 통과, `git diff --check` 통과.
  - `test:browser` 통과: popup·overlay·overlay-visibility 스모크.
  - popup 스모크에 넣은 흐름은 아래와 같다.
    - 다운로드 완료 뒤: 줄에 완료 배지, 더보기로 `recent` 열기와 뒤로 포커스, 다시 내려받기(같은 주소·기본 이름·새 job 없음·live 문장), 뒤로와 더보기 포커스 복귀
    - 여러 상태 저장 job: 줄 배지 순서, 항목별 상태명·행동·예전 job 대체 표시, 실패 항목 다시 시도의 job 생성 본문과 기본 파일명, 새 job이 목록 맨 위에 생김
    - 기록 없음: 줄 숨김
    - 기존 진행 복원 흐름의 버튼 찾기는 정확한 이름으로 바꿨다(썸네일 이름 `제목, 대기 중`과 겹침).
  - 실제 서버에는 popup 스모크의 `/health` GET만 간다. 다운로드는 가짜 응답이다.
  - `.env` 주소에 로컬 서버가 없어 `WXT_MEDIA_NEST_API_BASE_URL=https://mytube-extract-api.codeliners.cc`로 빌드·스모크를 맞춰 실행했다(02~05와 같은 방식).
  - 캡처(직접 확인, 360px 가로 넘침 없음):
    - `/tmp/mytube-06/shots/popup-recent-strip-light.png`, `popup-recent-strip-dark.png`
    - `/tmp/mytube-06/shots/popup-recent-light.png`, `popup-recent-dark.png`
  - 로그: `/tmp/mytube-06/` 아래 `lint.log`, `test.log`, `build-plain.log`, `test-browser.log`, `popup-smoke.log`, `overlay-smoke.log`, `overlay-vis.log`
