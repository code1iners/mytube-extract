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
