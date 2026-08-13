# MyTube Extract Web 현재 구현 PRD

## 목적

사용자가 브라우저에서 영상·오디오 또는 영어 SRT 추출을 접수하고, 같은 브라우저의 최근 요청을 다시 확인해 완료 파일을 받을 수 있게 한다.

## 현재 제공 범위

- `/video`: YouTube URL, 오디오/비디오 형식, 품질을 검증해 `POST /downloads` job을 접수한다.
- `/subtitles`: 로컬 `mp4`, `mov`, `webm`을 R2 multipart로 업로드해 영어 SRT job을 접수한다.
- `/history`: 같은 브라우저가 접수한 영상·자막 요청을 최신순 최대 20건 조회한다.
- 상단의 항상 보이는 `요청 내역` 링크와 하단의 영상·자막 전환 탭을 제공하며 요청 접수 중에는 두 navigation surface의 route 이동을 막는다.
- 요청 전 `GET /health`로 worker 가능 여부를 확인한다.
- 요청 성공 시 최소 접수 정보만 localStorage에 저장하고 history deep link로 이동한다.
- history는 API 응답만 상태·진행률·메시지·다운로드의 source of truth로 사용한다.
- 진행 중 job만 polling하고 terminal job은 polling을 멈춘다.
- completed는 API `downloadUrl`을 사용하고 failed/expired는 같은 종류의 재요청 링크를 제공한다.
- network/5xx는 접수증을 유지하고 404만 해당 접수증 하나를 제거한다.
- storage event로 다른 탭의 접수증 추가·삭제·재추가를 정확히 반영한다.
- localStorage가 실패해도 유효한 history deep link의 job은 조회한다.

## 사용자 데이터 범위

- 저장: `kind`, UUID `jobId`, ISO `acceptedAt`
- 미저장: 원본 URL, 파일명, 상태, 진행률, 메시지, 오류, `downloadUrl`
- 같은 브라우저 profile의 localStorage에만 남으며 삭제·차단·다른 기기에서는 동기화되지 않는다.

## 현재 한계

- 계정, 인증, 사용자별 서버 목록 API, 브라우저·기기 간 동기화는 없다.
- 검색, 필터, 페이지네이션, 전체 삭제, 작업 취소는 없다.
- 자막은 영어 SRT만 제공한다.
- polling 간격은 2500ms 고정이다.
- 세부 진행률은 API가 제공하는 상태 기반 값만 표시한다.

## Route 문서

- `docs/web/routes/video.md`
- `docs/web/routes/subtitles.md`
- `docs/web/routes/history.md`
