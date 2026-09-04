# 02: 자막 요청 adapter의 multipart protocol 심층화

**What to build:** 자막 요청 adapter가 로컬 영상의 upload session 생성부터 part upload, complete, 실패 또는 취소 시 cleanup까지 하나의 요청 생성 동작으로 제공하게 한다. 자막 화면의 기존 동작은 아직 바꾸지 않으며, 다음 vertical slice가 multipart 순서를 알지 않고 adapter를 연결할 수 있게 한다.

**Blocked by:** 01: 영상 추출 생명주기 vertical slice

**Status:** ready-for-agent

- [ ] 자막 adapter가 01에서 확정된 요청 생성·상태 조회 seam을 만족한다.
- [ ] upload session 생성, 동시 part upload, progress, complete가 adapter implementation 안에 숨겨진다.
- [ ] part upload 실패, ETag 누락, complete 실패, browser abort를 구분해 기존 사용자 열람용 오류 사실을 보존한다.
- [ ] session 생성 후 실패하거나 취소되면 multipart abort cleanup을 best-effort로 요청한다.
- [ ] abort cleanup 실패가 원래 요청 실패나 취소 결과를 덮지 않는다.
- [ ] complete 성공과 cancel이 경쟁하면 이미 생성된 자막 작업 결과를 버리지 않는다.
- [ ] progress는 실제 업로드 byte만 사용하고 임의의 진행률을 만들지 않는다.
- [ ] adapter는 자막 상태 조회 통신을 제공하되 polling과 terminal 판단은 공통 lifecycle implementation에 남긴다.
- [ ] 자막 화면은 아직 기존 경로를 사용하며 이 prefactor 전후의 사용자 동작과 서버 계약이 동일하다.
- [ ] in-memory transport로 session, 여러 part, complete, cleanup, 경쟁 상태를 adapter interface에서 검증한다.
- [ ] 기존 단계별 통신 테스트는 새 adapter interface 테스트가 포괄하는 범위에서 교체하고 중복 implementation 테스트를 남기지 않는다.
- [ ] Web lint와 unit test가 통과한다.

## Comments
