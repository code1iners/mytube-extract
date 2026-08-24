# 01: 공통 YouTube client 시도 정책과 진단 seam 마련

**What to build:** API direct media와 worker queued job이 같은 YouTube 추출 정책을 사용할 수 있도록 공통 media-downloader 경계를 마련한다. 이 선행 prefactor가 끝나면 두 실행 표면은 yt-dlp 2026.08.19, 기본 client 우선, 제한적 web_embedded fallback, client별 시도 진단을 같은 계약으로 사용할 수 있어야 한다.

**Blocked by:** None (can start immediately)

**Status:** done (2026-08-24)

- [x] API와 worker가 사용할 공통 추출 정책이 기본 client를 첫 시도로 선택한다.
- [x] client 전환 대상 오류 allowlist와 embed-disabled no-fallback 규칙이 공통 정책에 표현된다.
- [x] 일반 transient 오류의 같은 client 1회 retry, client 오류의 즉시 fallback 전환, fallback 1회 시도 예산이 공통 정책에 반영된다.
- [x] API와 worker의 yt-dlp runtime pin이 2026.08.19로 동일해진다.
- [x] EXTRACTION_FAILED와 YOUTUBE_AUTH_REQUIRED 외부 계약을 유지하고, client별 진단은 server-only redaction 경계를 지킨다.
- [x] fake runner를 주입해 기본 성공, client fallback, transient retry, embed-disabled no-fallback, fallback 실패를 결정론적으로 검증한다.

## Comments

- `packages/media-downloader`에 `default` 우선, allowlist 기반 `web_embedded` fallback, 같은 client transient retry, fallback 1회 예산과 client별 redacted diagnostic을 공통화했다.
- API `YoutubeDlMediaDownloader`와 worker `downloadExtractionJob`이 공통 정책과 option factory를 사용하도록 연결했고, 기존 `EXTRACTION_FAILED`·`YOUTUBE_AUTH_REQUIRED` mapping 및 artifact 검증 경계를 유지했다.
- API·worker Docker image의 `yt-dlp` pin을 `2026.08.19`로 맞추고 runtime check를 실행했다. 두 이미지에서 `node v22.22.3`, `yt-dlp 2026.08.19`, `ffmpeg 5.1.9`를 확인했다.
- 검증: `pnpm run lint`, `pnpm run build`, `pnpm run test` 통과; media-downloader 20 tests, API 24 suites/201 tests, worker 5 tests 통과. 실제 YouTube direct/queued 파일 smoke는 후속 티켓 02–04 범위다.
