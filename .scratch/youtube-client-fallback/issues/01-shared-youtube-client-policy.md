# 01: 공통 YouTube client 시도 정책과 진단 seam 마련

**What to build:** API direct media와 worker queued job이 같은 YouTube 추출 정책을 사용할 수 있도록 공통 media-downloader 경계를 마련한다. 이 선행 prefactor가 끝나면 두 실행 표면은 yt-dlp 2026.08.19, 기본 client 우선, 제한적 web_embedded fallback, client별 시도 진단을 같은 계약으로 사용할 수 있어야 한다.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] API와 worker가 사용할 공통 추출 정책이 기본 client를 첫 시도로 선택한다.
- [ ] client 전환 대상 오류 allowlist와 embed-disabled no-fallback 규칙이 공통 정책에 표현된다.
- [ ] 일반 transient 오류의 같은 client 1회 retry, client 오류의 즉시 fallback 전환, fallback 1회 시도 예산이 공통 정책에 반영된다.
- [ ] API와 worker의 yt-dlp runtime pin이 2026.08.19로 동일해진다.
- [ ] EXTRACTION_FAILED와 YOUTUBE_AUTH_REQUIRED 외부 계약을 유지하고, client별 진단은 server-only redaction 경계를 지킨다.
- [ ] fake runner를 주입해 기본 성공, client fallback, transient retry, embed-disabled no-fallback, fallback 실패를 결정론적으로 검증한다.
