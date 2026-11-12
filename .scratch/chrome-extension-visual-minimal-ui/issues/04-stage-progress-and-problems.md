# 04: 무대 진행·문제 상태

**What to build:** 추출 버튼을 누른 뒤의 진행과 문제를 무대 위에서 보여준다. 서버 확인과 처리는 숫자 없는 회전 링, 대기는 시계와 회전 링, 완료는 초록 체크 덮개다. 완료 덮개는 약 1.8초 뒤 준비 상태로 돌아간다. 실패는 어두운 덮개 위 crimson 경고 아이콘과 서버가 준 이유 한 줄, 서버 연결 실패는 구름 아이콘과 "서버에 연결할 수 없어요" 한 줄로 구분한다. 진행 중에는 형식·품질이 잠기고 추출 버튼은 회색 회전 아이콘이 된다. 실패 시 같은 버튼이 다시 시도 아이콘으로 바뀌어 같은 조건으로 재제출한다. 진행 단계마다 live region 문장(서버 확인 중·대기 중·처리 중·다운로드를 시작했어요)을 둔다. 확장의 남은 영어 사용자 문구는 모두 한국어로 바꾼다.

무대 진행 단계는 현재 무대 영상의 최신 job을 기준으로 도출한다. 다른 영상의 job 진행은 무대에 영향을 주지 않는다. 처리 중에도 다른 영상의 새 요청은 허용하고, 같은 영상의 제출만 잠근다. Popup을 다시 열었을 때 같은 영상의 job이 진행 중이면 그 단계를 다시 보여준다. 단계의 모양은 시안 프로토타입에서 가져왔다.

```ts
type StagePhase =
  | 'idle'        // ready
  | 'checking'    // checking-server 또는 submitting
  | 'queued'      // job-queued
  | 'processing'  // job-processing (숫자 없음)
  | 'done'        // download-started, 잠시 뒤 idle로 복귀
  | 'failed'      // job 실패 또는 서버가 거부한 접수
  | 'unreachable';// 서버 연결 실패
```

**Blocked by:** 03

**Status:** resolved

- [x] model 통합 테스트: 제출에서 `checking` → `queued` → `processing` → `done` → `idle` 순서로 전이한다(가짜 시계 사용).
- [x] model 통합 테스트: job 실패와 접수 거부는 `failed`와 서버 메시지로, 연결 실패는 `unreachable`로 구분되고, 재시도가 같은 조건으로 제출된다.
- [x] model 통합 테스트: 다른 영상의 job 진행은 무대 단계를 바꾸지 않고, 같은 영상의 진행 중 job은 제출을 잠근다. 다시 열었을 때 진행 단계가 복원된다.
- [x] 확장 소스에 사용자에게 보이는 영어 문구가 남지 않았음을 검색으로 확인한다.
- [x] popup 브라우저 스모크의 서버 실패·다운로드 흐름이 새 덮개·버튼 상태를 확인하도록 갱신되어 통과한다.
- [x] 줄어든 동작 설정에서 회전·전환 애니메이션이 멈추는 것을 브라우저 스모크 또는 스크린샷으로 확인한다.
- [x] 확장 `lint`, `test`, `build`가 통과한다.

## Comments

- 2026-11-12 구현 완료.
  - 무대 단계: snapshot에 `stagePhase: StagePhase`를 더했다. model이 무대 영상의 최신 job과 이번 Popup의 제출 결과로 매 갱신마다 도출한다(`deriveStageProgress`).
    - 우선순위는 제출 중(`checking`) → 아직 새 job이 없는 제출 실패 → 최신 job 순이다.
    - 완료·실패 덮개는 이번 Popup에서 진행을 지켜본 job에만 띄운다. 진행 중이었던 job, 초기화 뒤 새로 생긴 job, 직접 제출한 job이 대상이다.
    - Popup을 열기 전에 이미 끝난 job은 `idle`로 시작한다(실패 내역은 06의 최근 요청이 맡는다). 만료 job도 `idle`이다.
    - 완료 덮개는 `STAGE_DONE_DISPLAY_MS`(1800ms) 뒤 걷힌다. job 상태는 바꾸지 않는다.
    - 형식·품질·원본을 바꾸면 실패·완료 표시를 걷는다.
  - 제출 잠금: `canDownload`는 무대 영상의 단계가 `checking`·`queued`·`processing`일 때만 막는다. 다른 영상의 진행은 막지 않는다.
  - 실패 원인: background 제출 응답의 `ok: false`에 `failure: 'unreachable' | 'rejected'`(`DownloadJobSubmitFailure`)를 더했다. bridge는 `DownloadJobSubmitError(failure, message)`로 거절한다.
    - client는 네트워크 실패와 health check 실패(비정상 HTTP·`ok !== true` 포함)를 `ServerUnreachableError`로 던진다. 그래서 `unreachable`로 분류된다.
    - HTTP 거부(`DownloadJobRequestError`)와 그 밖의 실패는 `rejected`이고, 무대는 서버 메시지를 그대로 보여준다.
    - background 메시지 자체가 실패한 경우(`runtime.lastError`)는 `rejected`로 둔다.
  - 다시 시도:
    - job 없이 끝난 실패는 보냈던 입력을 그대로 다시 보낸다.
    - 접수 뒤 실패한 job은 그 job의 원본·형식·품질로 다시 보낸다. API 주소와 파일명은 현재 값을 쓴다(파일명은 05 범위).
  - 화면:
    - 무대 위 덮개(`data-veil`): 진행은 흰 링, 대기는 시계를 더한다. 완료는 초록 체크, 실패는 경고, 연결 실패는 구름 아이콘이다.
    - 무대 아래 오류 한 줄은 `role="alert"`로 둔다.
    - 진행 단계 문장(서버 확인 중·대기 중·처리 중·다운로드를 시작했어요)은 숨긴 `role="status"` live region에 둔다.
    - 진행 중에는 형식·품질 radio를 `disabled`로 잠근다. 추출 버튼 이름은 `서버 확인 중`·`대기 중`·`처리 중`·`다시 시도`·`추출 시작`이다.
    - 기존 버튼 아래 상태 문장 줄(`request-status`)은 지웠다.
    - 덮개 색은 `--color-scrim*`·`--color-on-scrim*` semantic token으로 두었다. 덮개는 썸네일 위의 어두운 바탕이라 두 테마가 같은 값을 쓴다.
  - 한국어화: 확장 `src`·`entrypoints`에서 사용자에게 닿을 수 있는 영어 오류 문구를 모두 한국어로 바꿨다(어댑터·client·manager·background·overlay 다운로드·주소 검증).
    - 검색으로 남은 영어 문자열은 브랜드명 `MyTube Extract`와 형식명 `MP3`·`MP4`뿐임을 확인했다.
  - 범위 밖 추가: 형식·품질 저장 실패를 `options-save-failed` 상태로 무대 아래 오류 줄에 보여준다. 이전에는 영어 문구로 상태 줄에 떴던 것을 옮긴 것이다.
- 확인이 필요한 스펙 내부 차이(구현은 버튼 상태 표와 시안을 따름):
  - 티켓과 사용자 스토리 25는 진행 중 추출 버튼을 "회색 회전 아이콘", 스펙 버튼 상태 표는 "잠김, 파란 회전 아이콘"이라고 적는다.
  - 구현은 회색 잠금 버튼 위 파란 회전 아이콘(`--color-status-processing`)이다. 10의 `DESIGN.md` 갱신 때 문구를 맞추면 된다.
- 코드 리뷰(Standards·Spec 두 축)의 지적 중 아래를 반영했다.
  - 덮개 색 하드코딩 → token
  - 제출 실패 표시가 같은 영상의 이후 새 job을 가림 → 새 job 우선, 회귀 테스트 추가
  - live region 문장 중복 → `status.message` 재사용
  - `isStagePhaseProblem` 재구현 제거
  - 반영하지 않은 지적: job 표시 상태 Set 통합, 단계별 표시 정보 표 통합(판단 사항), `returnToForm` 미사용(기존부터 있던 공개 메서드)
- 검증(마지막 변경 뒤):
  - `pnpm --filter chrome-extension lint`(tsc)·`test`(26파일 202개)·`build` 통과.
  - popup 스모크 전체 통과. 새로 넣은 흐름은 아래와 같다.
    - 서버 연결 실패: 구름 덮개, `서버에 연결할 수 없어요`, `다시 시도`로 health 재요청
    - 접수 거부: 경고 덮개, 서버 이유 한 줄, 재시도 요청 본문이 첫 요청과 같음
    - 다운로드: 서버 확인 덮개, 잠긴 radio, live 문장, 초록 체크 덮개, 덮개가 걷히고 `추출 시작` 복귀
    - 다시 열기: 저장된 대기·처리 job의 단계 복원, 버튼·radio 잠금
    - 줄어든 동작: `reducedMotion: 'reduce'`에서 링·버튼 회전·덮개 전환의 `animationName`이 모두 `none`이고, 기본 설정에서는 모두 살아 있음
  - overlay 스모크 2종 통과.
  - 실제 서버에는 popup 스모크의 `/health` GET만 간다. 다운로드는 가짜 응답이다.
  - `.env` 주소에 로컬 서버가 없어 `WXT_MEDIA_NEST_API_BASE_URL=https://mytube-extract-api.codeliners.cc`로 빌드·스모크를 맞춰 실행했다(02·03과 같은 방식).
  - 캡처는 `/tmp/mytube-04/shots/`에 남겼고 직접 확인했다. 360px에서 가로 넘침은 없다.
    - `popup-checking-light.png`, `popup-done-light.png`
    - `popup-queued-light.png`, `popup-queued-dark.png`
    - `popup-processing-light.png`, `popup-processing-dark.png`
    - `popup-failed-light.png`, `popup-failed-dark.png`
    - `popup-unreachable-light.png`
  - 로그: `/tmp/mytube-04/popup-smoke.log`, `overlay-smoke.log`, `overlay-vis.log`, `build.log`
