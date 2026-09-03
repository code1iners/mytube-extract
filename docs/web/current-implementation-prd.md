# MyTube Extract Web 현재 구현 PRD

## 목적

사용자가 브라우저에서 영상·오디오 또는 영어 SRT 추출을 접수하고, 같은 브라우저의 최근 요청을 다시 확인해 완료 파일을 받을 수 있게 한다.

## 현재 제공 범위

- `/video`: YouTube URL, 오디오/비디오 형식, 품질을 검증해 `POST /downloads` job을 접수한다.
- `/subtitles`: 로컬 `mp4`, `mov`, `webm`을 R2 multipart로 업로드해 영어 SRT job을 접수한다.
- `/history`: 같은 브라우저가 접수한 영상·자막 요청을 최신순 최대 20건 조회한다.
- `영상 추출`·`자막 추출`·`요청 내역`을 하나의 주요 navigation으로 제공한다. 데스크톱에서는 작업 영역 헤더 탭으로, 모바일에서는 안전 영역을 포함한 하단 3탭으로 표시하며 요청 접수 중에는 현재 목적지를 제외한 이동을 막는다.
- 테마 선택은 보조 `설정` route에서 제공하며, 모든 route의 상단 `더보기` disclosure에서 접근한다. 요청 접수 중에는 설정 route 이동도 막는다.
- 요청 전 `GET /health`로 worker 가능 여부를 확인한다. 최초 응답이 없는 동안에는 상태 우선 화면을 먼저 보여주고 `ready`에서 요청 form을 표시한다. 이미 `ready`인 form은 백그라운드 확인 중에도 유지하며, 완료된 확인 응답이 `failed` 또는 `unavailable`이면 상태 우선 화면으로 전환한다. 갱신 중에는 제목 옆 표시와 `aria-busy`를 사용하고 반복 live announcement는 하지 않는다. 입력값과 선택 파일은 상태 전환 뒤에도 보존한다.
- 영상 POST 또는 자막 upload/complete가 서버 job을 만들기 전에 사용자가 `요청 취소`를 누르면 브라우저 요청을 중단하고 navigation lock을 해제한다. 서버 응답이 경쟁적으로 도착해 이미 job이 생성된 경우에는 접수증을 보존하고 서버 job 취소로 표시하지 않는다. 서버 job 취소 API는 없다.
- 요청·처리·완료·요청 내역은 API 상태에 대응하는 `원본 → 추출 → 파일 수령` 흐름을 표시하며, `/video`는 `U`, `/subtitles`는 `F` 단축키로 첫 입력 동작에 focus할 수 있다. 단축키는 text editing target과 modifier 조합에서는 작동하지 않는다. `/video`와 `/subtitles`의 page H2와 주요 navigation은 각각 `영상 추출`과 `자막 추출`로 맞추고, CTA는 `추출 요청`과 `영어 SRT 생성`처럼 구체적인 동작명을 유지한다.
- 자막 처리 방식의 `base.en`, `small.en`, `Whisper`, `worker` 설명은 기본으로 접힌 native disclosure에서만 제공하며 사용자 결과 중심 문구와 속도·정확도 선택은 계속 바로 보인다. 완료 receipt는 API의 `fileName`, 결과 형식 `영어 SRT`, `retentionDays`를 표시하고 다운로드·새 요청 동작을 제공한다.
- 요청 성공 시 최소 접수 정보를 localStorage에 저장하고 현재 요청 route에서 해당 job을 polling한다. `/history` 이동은 사용자가 `요청 내역` 링크를 선택할 때만 일어난다.
- `/video`·`/subtitles`·`/history`는 같은 API 응답을 상태·진행률·메시지·다운로드의 source of truth로 사용한다.
- 진행 중 job만 polling하고 terminal job은 polling을 멈춘다. 상태 조회가 끝내 실패하면 현재 route에서 오류 상세와 재요청 경로를 표시한다.
- completed는 API `downloadUrl`을 사용하고 failed/expired는 현재 route에서 같은 입력으로 다시 요청할 수 있게 한다.
- 마지막 다운로드 형식·품질과 Whisper 모델은 같은 브라우저의 다음 방문 기본값으로 복원한다.
- `/history`는 network/5xx에서 접수증을 유지하고 404에서만 해당 접수증 하나를 제거한다. 요청 route의 상태 조회 오류는 접수증을 삭제하지 않고 재요청 경로를 표시한다.
- storage event로 다른 탭의 접수증 추가·삭제·재추가를 정확히 반영한다.
- localStorage가 실패해도 유효한 history deep link의 job은 조회한다.

## 사용자 데이터 범위

- 접수증 저장: `kind`, UUID `jobId`, ISO `acceptedAt`
- 요청 선호 저장: 다운로드 형식·품질, Whisper 모델
- 미저장: 원본 URL, 파일명, 상태, 진행률, 메시지, 오류, `downloadUrl`
- 같은 브라우저 profile의 localStorage에만 남으며 삭제·차단·다른 기기에서는 동기화되지 않는다.

## 현재 한계

- 계정, 인증, 사용자별 서버 목록 API, 브라우저·기기 간 동기화는 없다.
- 검색, 필터, 페이지네이션, 전체 삭제, 서버 job 취소 API는 없다. 접수 전 브라우저 요청 중단은 제공한다.
- 자막은 영어 SRT만 제공한다.
- polling 간격은 2500ms 고정이다.
- 세부 진행률은 API가 제공하는 상태 기반 값만 표시한다.

## Route 문서

- `docs/web/routes/video.md`
- `docs/web/routes/subtitles.md`
- `docs/web/routes/history.md`
- `docs/web/routes/settings.md`
