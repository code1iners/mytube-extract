# 02: API direct media에 기본 client 우선 fallback 연결

**What to build:** API direct media 사용자가 known-good URL과 기존 실패 URL을 오디오 320kbps·비디오 1080p로 요청했을 때, 기본 client 성공 경로를 우선 사용하고 필요한 경우에만 web_embedded fallback으로 복구해 실제 non-empty 파일을 받게 한다.

**Blocked by:** 01: 공통 YouTube client 시도 정책과 진단 seam 마련

Status: done (2026-08-24)

- [x] API direct audio 요청이 dQw4w9WgXcQ와 a0iBRRoDnDw에서 요청 상한 이하의 non-empty 결과를 만든다.
- [x] API direct video 요청이 dQw4w9WgXcQ와 a0iBRRoDnDw에서 요청 상한 이하의 non-empty 결과를 만든다.
- [x] 기본 client가 성공한 요청에는 web_embedded를 추가 호출하지 않는다.
- [x] client 전환 대상 오류에서는 같은 client retry 없이 web_embedded를 한 번 시도한다.
- [x] embed-disabled, 인증, 네트워크, abort, spawn 오류에서는 web_embedded fallback을 호출하지 않는다.
- [x] 두 client가 실패해도 기존 API 오류 계약과 server-only 진단 redaction이 유지된다.
- [x] 기존 real integration 실행 경계에 네 URL·형식 조합을 추가하고 코드 원인 실패가 테스트 실패로 남는다.

## Comments

- `apps/api/test/real-integration/media-download.real-e2e-spec.ts`에 기존 direct 케이스를 보존하면서 known-good/실패 URL의 audio 320·video 1080 네 조합을 추가했다. URL source 정규화, service job builder의 상한 format, 실제 output non-empty를 함께 확인한다.
- 공통 client 정책과 API public error/diagnostic 계약은 선행 티켓 01의 구현과 테스트를 재사용했다. worker queued/R2 운영 smoke는 이 티켓의 범위가 아니며 후속 티켓에서 별도 검증한다.
- 검증: `pnpm run build` 통과(6 tasks), `pnpm run lint` 통과(8 tasks), `pnpm run test` 통과(root 12 tasks; API 24 suites/201 tests; media-downloader 20 tests; worker 5 tests).
- 검증: API와 worker에서 `EXPECTED_YT_DLP_VERSION=2026.08.19 pnpm run verify:runtime` 통과. local `youtube-dl-exec` binary를 pinned `2026.08.19`로 맞춘 뒤 `pnpm --filter api run test:e2e:real`을 실행해 기존 2개와 required 4개, 총 6개 direct 케이스가 모두 통과하고 non-empty artifact를 확인했다.
- 완료 시점의 미검증 경계는 queued worker의 completed/downloadUrl/실제 파일 전달과 production 운영 상태이며, 이 티켓의 완료 증거로 표현하지 않는다.
