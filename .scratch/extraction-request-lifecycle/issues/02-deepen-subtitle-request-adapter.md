# 02: 자막 요청 adapter의 multipart protocol 심층화

**What to build:** 자막 요청 adapter가 로컬 영상의 upload session 생성부터 part upload, complete, 실패 또는 취소 시 cleanup까지 하나의 요청 생성 동작으로 제공하게 한다. 자막 화면의 기존 동작은 아직 바꾸지 않으며, 다음 vertical slice가 multipart 순서를 알지 않고 adapter를 연결할 수 있게 한다.

**Blocked by:** 01: 영상 추출 생명주기 vertical slice

**Status:** done (2026-09-04)

- [x] 자막 adapter가 01에서 확정된 요청 생성·상태 조회 seam을 만족한다.
- [x] upload session 생성, 동시 part upload, progress, complete가 adapter implementation 안에 숨겨진다.
- [x] part upload 실패, ETag 누락, complete 실패, browser abort를 구분해 기존 사용자 열람용 오류 사실을 보존한다.
- [x] session 생성 후 실패하거나 취소되면 multipart abort cleanup을 best-effort로 요청한다.
- [x] abort cleanup 실패가 원래 요청 실패나 취소 결과를 덮지 않는다.
- [x] complete 성공과 cancel이 경쟁하면 이미 생성된 자막 작업 결과를 버리지 않는다.
- [x] progress는 실제 업로드 byte만 사용하고 임의의 진행률을 만들지 않는다.
- [x] adapter는 자막 상태 조회 통신을 제공하되 polling과 terminal 판단은 공통 lifecycle implementation에 남긴다.
- [x] 자막 화면은 아직 기존 경로를 사용하며 이 prefactor 전후의 사용자 동작과 서버 계약이 동일하다.
- [x] in-memory transport로 session, 여러 part, complete, cleanup, 경쟁 상태를 adapter interface에서 검증한다.
- [x] 기존 단계별 통신 테스트는 새 adapter interface 테스트가 포괄하는 범위에서 교체하고 중복 implementation 테스트를 남기지 않는다.
- [x] Web lint와 unit test가 통과한다.

## Comments

### 2026-09-04 구현

- `subtitle-request.adapter.ts`가 `RequestLifecycleAdapter<SubtitleRequest, SubtitleJobResponse, 'subtitle'>` seam을 만족하며 session 생성, 최대 3개 part 동시 업로드, 실제 byte progress, complete, 상태 조회를 하나의 `createRequest`·`getStatus` interface 뒤로 숨긴다.
- session 이후 part/ETag/complete/browser abort 오류는 원래 오류와 사용자 열람용 상세를 유지하고, 실패·취소 cleanup은 caller signal 없이 best-effort로 실행한다. cleanup 실패는 원래 결과를 덮지 않는다.
- complete 요청은 caller abort signal을 전달하지 않아 서버가 이미 만든 자막 job의 성공 응답을 취소 경쟁에서 보존하고, 공통 lifecycle이 접수증·활성 job 수락을 결정하도록 했다.
- in-memory fetch transport로 session payload, 3-way part concurrency와 순서 정렬, byte progress, cleanup body, cleanup 실패, abort, complete 경쟁을 adapter interface에서 검증했다. 단계별 multipart 통신 테스트는 새 adapter 테스트로 대체했으며 staged migration 중인 legacy client contract 테스트는 유지했다.
- `use-subtitles-extract-logic.ts`와 자막 화면은 이번 단계에서 기존 경로를 유지했다. 자막 route 연결은 issue 03에서 수행한다.
- 검증: `pnpm --filter web run lint`, `pnpm test` (6 packages, 12 tasks; Web 19 files/137 tests), `git diff --check` 통과. route를 변경하지 않아 browser smoke와 실제 provider/R2 acceptance는 수행하지 않았다.
