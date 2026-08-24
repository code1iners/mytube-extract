# 03: worker queued job에 공통 fallback 연결

**What to build:** Web 앱의 queued job이 API direct media와 같은 client 정책으로 YouTube 추출을 수행하고, 추출 실패 시 정의된 retry/fallback 예산을 지킨 뒤 기존 R2 asset과 completed job 흐름으로 이어지게 한다.

**Blocked by:** 01: 공통 YouTube client 시도 정책과 진단 seam 마련

**Status:** ready-for-agent

- [ ] worker queued audio 320 job이 dQw4w9WgXcQ와 a0iBRRoDnDw에서 공통 client 정책으로 추출된다.
- [ ] worker queued video 1080 job이 dQw4w9WgXcQ와 a0iBRRoDnDw에서 공통 client 정책으로 추출된다.
- [ ] 일반 transient 오류는 같은 client로 한 번 retry하고, client 전환 대상 오류는 web_embedded로 즉시 전환한다.
- [ ] fallback client는 한 번만 시도하고, fallback 실패 뒤 추가 client 또는 동일 client retry를 하지 않는다.
- [ ] 추출 성공 뒤 upload, asset 저장, completed 전환, 기존 downloadUrl 생성 흐름이 유지된다.
- [ ] worker가 API direct media와 다른 client 순서나 오류 분류를 자체적으로 덮어쓰지 않는다.
- [ ] worker retry, 진단 redaction, 실패 코드 mapping 테스트가 공통 정책 계약에 맞게 통과한다.
