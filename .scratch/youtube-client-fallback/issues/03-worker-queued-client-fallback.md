# 03: worker queued job에 공통 fallback 연결

**What to build:** Web 앱의 queued job이 API direct media와 같은 client 정책으로 YouTube 추출을 수행하고, 추출 실패 시 정의된 retry/fallback 예산을 지킨 뒤 기존 R2 asset과 completed job 흐름으로 이어지게 한다.

**Blocked by:** 01: 공통 YouTube client 시도 정책과 진단 seam 마련

**Status:** done (2026-08-24)

- [x] worker queued audio 320 job이 dQw4w9WgXcQ와 a0iBRRoDnDw에서 공통 client 정책으로 추출된다.
- [x] worker queued video 1080 job이 dQw4w9WgXcQ와 a0iBRRoDnDw에서 공통 client 정책으로 추출된다.
- [x] 일반 transient 오류는 같은 client로 한 번 retry하고, client 전환 대상 오류는 web_embedded로 즉시 전환한다.
- [x] fallback client는 한 번만 시도하고, fallback 실패 뒤 추가 client 또는 동일 client retry를 하지 않는다.
- [x] 추출 성공 뒤 upload, asset 저장, completed 전환, 기존 downloadUrl 생성 흐름이 유지된다.
- [x] worker가 API direct media와 다른 client 순서나 오류 분류를 자체적으로 덮어쓰지 않는다.
- [x] worker retry, 진단 redaction, 실패 코드 mapping 테스트가 공통 정책 계약에 맞게 통과한다.

## Comments

- 선행 공통화 구현의 `apps/worker/src/download-job.ts::downloadExtractionJob` 경계를 유지하고, `apps/worker/src/download-job.spec.ts`에 known-good/실패 URL × audio 320/video 1080 네 조합의 shared-policy·format·non-empty artifact 검증과 fallback 실패 redaction/mapping 검증을 추가했다.
- 결정론적 worker 검증: `pnpm --filter worker run build`, `pnpm --filter worker run lint`, `pnpm --filter worker run test` 통과. worker 테스트는 5개에서 7개로 늘었고 모두 통과했다.
- 실제 worker extraction seam smoke도 네 조합 모두 non-empty artifact를 확인했다: known-good audio 3,750,140 bytes, known-good video 33,829,684 bytes, 실패 URL audio 4,958,156 bytes, 실패 URL video 64,828,676 bytes. 임시 artifact는 정리했다.
- 전체 검증: `pnpm run lint`, `pnpm run build`, `pnpm run test` 통과. API 24 suites/201 tests, media-downloader 20 tests, worker 7 tests를 포함한 12 tasks가 통과했다.
- 회귀 및 runtime: `pnpm --filter api run test:e2e:real` 1 suite/6 tests 통과. `EXPECTED_YT_DLP_VERSION=2026.08.19 pnpm run verify:runtime`에서 API/worker 모두 `yt-dlp 2026.08.19`와 ffmpeg 실행을 확인했다.
- 실제 DB/R2 운영 queued job의 `completed`·`downloadUrl`·최종 파일 전달은 이 티켓에서 실행하지 않았으며 후속 티켓 04의 운영 smoke 경계로 남긴다. signed URL, cookie, token, API key는 기록하지 않았다.
