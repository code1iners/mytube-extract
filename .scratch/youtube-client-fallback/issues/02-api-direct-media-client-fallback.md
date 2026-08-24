# 02: API direct media에 기본 client 우선 fallback 연결

**What to build:** API direct media 사용자가 known-good URL과 기존 실패 URL을 오디오 320kbps·비디오 1080p로 요청했을 때, 기본 client 성공 경로를 우선 사용하고 필요한 경우에만 web_embedded fallback으로 복구해 실제 non-empty 파일을 받게 한다.

**Blocked by:** 01: 공통 YouTube client 시도 정책과 진단 seam 마련

**Status:** ready-for-agent

- [ ] API direct audio 요청이 dQw4w9WgXcQ와 a0iBRRoDnDw에서 요청 상한 이하의 non-empty 결과를 만든다.
- [ ] API direct video 요청이 dQw4w9WgXcQ와 a0iBRRoDnDw에서 요청 상한 이하의 non-empty 결과를 만든다.
- [ ] 기본 client가 성공한 요청에는 web_embedded를 추가 호출하지 않는다.
- [ ] client 전환 대상 오류에서는 같은 client retry 없이 web_embedded를 한 번 시도한다.
- [ ] embed-disabled, 인증, 네트워크, abort, spawn 오류에서는 web_embedded fallback을 호출하지 않는다.
- [ ] 두 client가 실패해도 기존 API 오류 계약과 server-only 진단 redaction이 유지된다.
- [ ] 기존 real integration 실행 경계에 네 URL·형식 조합을 추가하고 코드 원인 실패가 테스트 실패로 남는다.
