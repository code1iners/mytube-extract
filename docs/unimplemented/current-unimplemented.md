# MyTube Extract Current Unimplemented

## 계정 기반 서버 요청 이력과 기기 간 동기화

- 상태: 미구현 — 현재 개인 사용 단계 유지, 공개 서비스 전환 시 재검토
- 대상 표면: `route /history`, API, 인증, DB
- 현재 상태: Web `/history`는 같은 브라우저의 localStorage 접수증 최대 20건으로 영상·자막 status endpoint를 개별 조회한다. 로그인·사용자 계정·사용자별 서버 목록 API·기기 간 동기화는 없다. 설정 영역은 계정 기능이 아닌 앱 환경설정 영역으로 시작한다.
- 기술 부채: 서비스를 여러 사용자에게 공개할 경우 현재의 요청 식별·보존 범위만으로는 사용자별 소유권, 다른 기기 접근, 삭제·보존 정책을 표현할 수 없다.
- 필요성: 실제 공개 서비스 운영, 다른 환경에서 요청 내역 이어보기, 사용자별 quota·보존·삭제 정책이 필요해질 때 해결해야 한다.
- 구현 조건: 인증 방식, 사용자와 요청의 소유권, 사용자별 목록 API, 보존·삭제 정책, 기기 간 동기화, abuse/rate limit 정책을 별도 설계하고 문서화한다.
- 관련 근거:
  - `docs/adr/0001-keep-single-user-mode-until-public-service-transition.md`
  - `apps/web/src/app/pages/request-history/page.tsx`
  - `docs/web/routes/history.md`

## 긴 영상 자막 추출과 Whisper 준비 자동화

- 상태: 미구현
- 대상 표면: `route /subtitles`, `POST /subtitles/uploads/complete`, `GET /subtitles/jobs/:jobId/file`, `apps/worker`
- 현재 상태: Web 앱은 `/subtitles`에서 로컬 `mp4`, `mov`, `webm` 파일을 받아 영어 SRT 생성 job을 요청하고 완료된 영어 SRT 다운로드를 제공한다. 사용자는 `base.en`, `small.en` 처리 방식을 선택할 수 있고 선택 화면에서 상대적 차이와 영어 전용·로컬 처리 정책을 안내받는다. worker는 사용자가 직접 준비한 `whisper.cpp` binary/model path를 사용하며, 긴 영상 audio chunking과 모델 자동 다운로드를 제공하지 않는다.
- 필요성: 긴 영상 처리와 Whisper 모델 준비 자동화가 필요해질 수 있다.
- 구현 조건: 긴 영상 chunking 정책과 Whisper binary/model 배포 방식을 먼저 결정한다.
- 관련 근거:
  - `apps/web/src/app/pages/subtitles-extract/page.tsx`
  - `apps/api/src/subtitles/subtitles.controller.ts`
  - `apps/worker/src/main.ts`
  - `docs/web/routes/subtitles.md`
  - `docs/server/endpoints/post-subtitles-uploads-complete.md`
  - `docs/server/endpoints/get-subtitles-jobs-job-id-file.md`

## 고정 extension ID 기반 CORS 허용

- 상태: 미구현
- 대상 표면: API CORS policy, `apps/chrome-extension`
- 현재 상태: API CORS allowlist는 no-origin 요청, 운영 web origin `https://mytube-extract.codeliners.cc`, 이전 운영 web origin `https://mytube-extract-web.codeliners.cc`, local preview/dev origin만 허용한다. 고정 extension ID를 모르는 상태라 `chrome-extension://{id}` origin은 허용하지 않는다.
- 필요성: Chrome Web Store 배포 후 확장 프로그램이 고정 origin을 보내는 경우 API가 해당 origin을 허용해야 한다.
- 구현 조건: Chrome Web Store 배포 ID가 확정되면 `chrome-extension://{id}` origin 허용 여부를 별도 테스트로 고정한다. `host_permissions`는 Chrome extension client 권한이고 API CORS allowlist와 별도 책임이다.
- 관련 근거:
  - `apps/api/src/main.ts`
  - `docs/api/current-implementation-fsd.md`
  - `apps/chrome-extension/wxt.config.ts`

## 다중 worker 큐와 세부 진행률 표시

- 상태: 미구현
- 대상 표면: `apps/worker`, `POST /downloads`, `GET /downloads/:jobId`, `route /video`, `apps/chrome-extension`
- 현재 상태: `/downloads`는 PostgreSQL job table과 단일 worker FIFO polling을 사용하며 DB 상태는 `queued`, `processing`, `completed`, `failed`까지만 제공한다. 만료된 완료 asset은 API 응답의 `displayStatus: "expired"`로 표시한다.
- 필요성: 다중 worker 처리량, 긴 변환 작업의 세부 진행률이 필요해질 수 있다.
- 구현 조건: 다중 worker throughput이 필요해지면 Redis/BullMQ 또는 DB row locking 기반 claim 전략을 검토한다. 진행률 퍼센트는 `yt-dlp` stderr 파싱 안정성 검증 후 별도 도입한다. worker는 현재 실제 extraction subprocess의 일시 실패만 in-process로 한 번 재시도한다. durable queue retry, 사용자별 retry 이력·quota 정책은 인증/계정 범위와 함께 별도 정의한다.
- 관련 근거:
  - `apps/worker/src/main.ts`
  - `apps/api/src/downloads/downloads.service.ts`
  - `docs/server/endpoints/post-downloads.md`
  - `docs/server/endpoints/get-downloads-job-id.md`

## Web 앱 파일명 입력

- 상태: 미구현
- 대상 표면: `route /video`, `POST /downloads`, `GET /downloads/:jobId/file`
- 현재 상태: Web 앱은 `/downloads` job 생성 시 `type`, `url`, `quality`와 선택적인 요청 영상 제목을 보내며, 요청 제목은 내역 식별용으로만 보존한다. 새 추출 asset의 완료 파일명은 API가 `ExtractedAsset.title` 기반으로 만들고, 제목이 없는 기존 asset은 R2 object key 마지막 segment를 fallback으로 사용한다. 호환용 `/audio`, `/video` 직접 다운로드 API와 Chrome 확장 프로그램은 `filename` 옵션을 지원한다.
- 필요성: 사용자가 완료 파일명을 직접 지정해야 하는 요구가 생길 수 있다.
- 구현 조건: `/downloads` job 생성 DTO에 있는 `filename` 필드를 실제 저장/파일명 생성 정책까지 연결할지 먼저 결정한다. 파일명 검증 규칙은 기존 직접 다운로드 API의 경로 구분자/제어 문자 거부 정책과 맞춘다.
- 관련 근거:
  - `apps/web/src/domain/download-request/download-request.ts`
  - `apps/api/src/downloads/dto/create-download-job.dto.ts`
  - `apps/api/src/downloads/downloads.service.ts`
  - `docs/server/endpoints/post-downloads.md`
  - `docs/server/endpoints/get-downloads-job-id-file.md`
