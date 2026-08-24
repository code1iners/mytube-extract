# 04: API direct·worker queued 운영 smoke 및 완료 증거

**What to build:** 구현된 두 실행 표면을 실제 운영 또는 staging 경계에서 검증해, client fallback 수정이 subprocess 성공에 그치지 않고 API direct 파일 응답과 worker queued downloadUrl 파일 응답까지 완성되는지 증명한다.

**Blocked by:** 02: API direct media에 기본 client 우선 fallback 연결, 03: worker queued job에 공통 fallback 연결

**Status:** ready-for-agent

- [ ] dQw4w9WgXcQ의 API direct audio 320 요청이 실제 non-empty 파일 응답까지 완료된다.
- [ ] dQw4w9WgXcQ의 API direct video 1080 요청이 실제 non-empty 파일 응답까지 완료된다.
- [ ] a0iBRRoDnDw의 API direct audio 320 요청이 실제 non-empty 파일 응답까지 완료된다.
- [ ] a0iBRRoDnDw의 API direct video 1080 요청이 실제 non-empty 파일 응답까지 완료된다.
- [ ] dQw4w9WgXcQ의 worker queued audio 320과 video 1080 job이 completed가 되고 유효한 downloadUrl로 파일을 받을 수 있다.
- [ ] a0iBRRoDnDw의 worker queued audio 320과 video 1080 job이 completed가 되고 유효한 downloadUrl로 파일을 받을 수 있다.
- [ ] 각 queued job의 type과 quality가 요청값과 일치하고, R2 전달 이후에도 파일이 non-empty인지 확인한다.
- [ ] direct와 queued 결과를 구분해 기록하고, provider·네트워크·인증 등 환경 요인으로 확인하지 못한 항목은 완료로 표시하지 않는다.
- [ ] signed URL, cookie, token, API key와 같은 민감하거나 만료 가능한 값을 티켓에 기록하지 않는다.

## Comments

### 2026-08-24 production 운영 smoke

- 대상: `https://mytube-extract-api.codeliners.cc` production API. 사전 확인한 `GET /health`는 HTTP 200이며 `worker.available=true`를 반환했다.
- 자동 검증: `pnpm run lint`, `pnpm run build`, `pnpm run test` 통과. `pnpm --filter api run test:e2e:real`은 1 suite/6 tests 통과했다. API와 worker의 `EXPECTED_YT_DLP_VERSION=2026.08.19 pnpm --filter ... run verify:runtime`도 통과했으며, 두 local runtime 모두 `yt-dlp 2026.08.19`를 확인했다. 이 local 증거는 production 배포 증거를 대신하지 않는다.

| Surface | Video ID | Type | Quality | Observed result |
| --- | --- | --- | --- | --- |
| API direct | `dQw4w9WgXcQ` | audio | 320 | HTTP 200, `audio/mpeg`, attachment, 3,750,165 bytes |
| API direct | `dQw4w9WgXcQ` | video | 1080 | HTTP 200, `video/mp4`, attachment, 33,829,665 bytes |
| API direct | `a0iBRRoDnDw` | audio | 320 | HTTP 500, generic extraction error; non-empty media file 아님 |
| API direct | `a0iBRRoDnDw` | video | 1080 | HTTP 500, generic extraction error; non-empty media file 아님 |
| worker queued | `dQw4w9WgXcQ` | audio | 320 | 재시도 요청은 기존 asset cache hit로 즉시 `completed`; file HTTP 200, `audio/mpeg`, 3,750,165 bytes. fresh worker 증거로 세지 않음 |
| worker queued | `dQw4w9WgXcQ` | video | 1080 | `queued` → `processing` → `completed`, type/quality 일치, file HTTP 200, `video/mp4`, 33,829,665 bytes; fresh worker 성공 |
| worker queued | `a0iBRRoDnDw` | audio | 320 | `queued` → `processing` → `failed`, `EXTRACTION_FAILED`, `downloadUrl` 없음 |
| worker queued | `a0iBRRoDnDw` | video | 1080 | `queued` → `processing` → `failed`, `EXTRACTION_FAILED`, `downloadUrl` 없음 |

- 첫 queued audio runner는 로컬 smoke 변수명 충돌로 POST 직후 중단되어 최종 job ID를 보존하지 못했다. 이후 재시도는 cache hit였으므로 해당 케이스를 fresh worker 완료로 판정하지 않았다.
- 현재 production target에서는 기존 실패 ID의 direct·queued audio/video가 모두 실패했다. local current HEAD의 real integration 성공만으로 production 운영 완료를 선언할 수 없으며, 현재 구현을 승인된 production/staging target에 배포한 뒤 8개 케이스를 다시 검증해야 한다.
- 이번 확인에서는 push, deploy, DB/R2 삭제, signed URL·cookie·token·API key 기록을 수행하지 않았다. 티켓은 미완료 상태로 유지한다.

### 2026-08-24 post-review 배포 후 재검증

- 코드 기준점: `4d87a89` (`fix: YouTube client fallback 및 진단 로그 보안 개선`). worker video preflight의 공통 fallback 경계 우회 수정과 관련 테스트가 포함되어 있다.
- 최신 자동 검증(2026-08-24 16:25 KST): `pnpm run lint`, `pnpm run build`, `pnpm run test`(12 tasks, API 24 suites/201 tests), `pnpm --filter api run test:e2e:real`(1 suite/6 tests), API/worker `EXPECTED_YT_DLP_VERSION=2026.08.19 pnpm --filter ... run verify:runtime` 모두 통과했다.
- 실제 target `https://mytube-extract-api.codeliners.cc/health` 재확인 결과 HTTP 530, Cloudflare `error code: 1033`이었다. health와 `worker.available=true`를 관찰하지 못했으므로 post-deploy direct 4건과 queued 4건은 실행·완료로 판정하지 않았다.
- 로컬 검증 환경에도 API·cloudflared Docker container가 없어 로컬 deployment verification은 실패했다. 이는 원격 배포 상태를 추정하는 근거로 사용하지 않는다.
- ticket은 미완료 상태를 유지하며, target health가 복구된 뒤 direct/queued 8개 케이스를 다시 독립 검증해야 한다.

### 2026-08-24 target recovery 후 smoke 재검증

- 실행 시각: 2026-08-24 16:54–16:56 KST. `GET /health`는 HTTP 200이며 `worker.available=true`를 반환했다.

| Surface | Video ID | Type | Quality | Observed result |
| --- | --- | --- | --- | --- |
| API direct | `dQw4w9WgXcQ` | audio | 320 | PASS, HTTP 200, `audio/mpeg`, attachment, 3,750,165 bytes |
| API direct | `dQw4w9WgXcQ` | video | 1080 | PASS, HTTP 200, `video/mp4`, attachment, 33,829,665 bytes |
| API direct | `a0iBRRoDnDw` | audio | 320 | FAIL, HTTP 500 JSON response, media artifact 아님 |
| API direct | `a0iBRRoDnDw` | video | 1080 | FAIL, HTTP 500 JSON response, media artifact 아님 |
| worker queued | `dQw4w9WgXcQ` | audio | 320 | initial `completed` cache hit, type/quality 일치, file HTTP 200 `audio/mpeg`, attachment, 3,750,165 bytes; fresh worker 증거 아님 |
| worker queued | `dQw4w9WgXcQ` | video | 1080 | initial `completed` cache hit, type/quality 일치, file HTTP 200 `video/mp4`, attachment, 33,829,665 bytes; fresh worker 증거 아님 |
| worker queued | `a0iBRRoDnDw` | audio | 320 | `queued` → `failed`, type/quality 일치, `EXTRACTION_FAILED`, `downloadUrl` 없음 |
| worker queued | `a0iBRRoDnDw` | video | 1080 | `queued` → `failed`, type/quality 일치, `EXTRACTION_FAILED`, `downloadUrl` 없음 |

- health 복구는 확인했지만 direct/queued 8건이 모두 요구 조건을 충족하지 않았고, cache hit은 fresh worker 성공으로 판정하지 않았다. ticket은 미완료 상태를 유지한다.
