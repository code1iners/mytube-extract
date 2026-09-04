# 01: 영상 추출 생명주기 vertical slice

**What to build:** 새 deep module과 영상 요청 adapter를 영상 추출 화면에 연결한다. 사용자는 기존과 같은 입력과 화면을 사용하면서 readiness 확인부터 접수, 취소 경쟁, 접수증 보존, 상태 확인, 다운로드 또는 오류까지 하나의 일관된 추출 요청 생명주기를 이용할 수 있다.

**Blocked by:** None (can start immediately)

Status: done (2026-09-04)

- [x] 추출 요청 생명주기 interface가 `request`, `accepting`, `processing`, `result`, `error` 상태를 구분한다.
- [x] `request` 상태가 `checking`, `ready`, `failed`, `unavailable` readiness를 구분하고 현재 유효한 행동만 제공한다.
- [x] 영상 URL·형식·품질 상태와 validation은 영상 화면에 유지되고 검증된 입력만 deep module에 전달된다.
- [x] 영상 adapter가 요청 생성과 상태 조회 통신을 담당하며 공통 lifecycle implementation에는 영상 종류 분기가 없다.
- [x] production dependency와 in-memory adapter가 같은 내부 seam을 만족하고 lifecycle interface 테스트가 이를 사용한다.
- [x] 최초 readiness와 submit 직전 재확인, ready 이후 background checking 중 form 보존이 유지된다.
- [x] 접수 중 navigation lock과 cancel 뒤 즉시 unlock이 유지된다.
- [x] cancel 뒤 URL·형식·품질이 유지되고 화면이 URL 입력 또는 readiness 재확인 control로 focus를 이동한다.
- [x] cancel과 경쟁한 늦은 성공은 접수증과 활성 작업을 보존하고 서버 작업 취소로 표시하지 않는다.
- [x] 접수증 저장 실패는 접수 실패로 바뀌지 않으며 현재 작업 추적과 요청 내역 deep link가 유지된다.
- [x] queued·processing polling, terminal 상태 중단, 재시도 가능·불가 오류 구분이 유지된다.
- [x] 활성 작업 이후 readiness 변화가 현재 작업 상태를 덮지 않는다.
- [x] 완료 결과의 형식·품질·보관기간·다운로드 주소와 실패·만료·조회 오류 상세가 유지된다.
- [x] 영상 화면은 phase별 상태만 사용하고 raw query·mutation과 생명주기 ordering을 조합하지 않는다.
- [x] lifecycle interface 테스트, 영상 화면 테스트, 영상 browser 흐름, Web lint·unit test가 통과한다.

## Comments

### 2026-09-04 구현

- `use-extraction-request-lifecycle.ts`가 readiness, 접수 직전 재확인, navigation lock, 취소 경쟁, 접수증·storage fallback, active job polling, terminal/error 우선순위를 하나의 deep React hook interface로 소유한다.
- `video-request.adapter.ts`와 `in-memory-request-lifecycle.adapter.ts`가 같은 adapter seam을 사용하며 영상 route의 URL·형식·품질 validation과 기존 화면 markup·문구·focus 계약은 유지했다. 자막 route의 기존 shallow hook은 staged migration 범위에 따라 남겨 두었다.
- React `StrictMode` effect replay, 동기 adapter 예외, 취소 후 늦은 readiness 오류, unmount 뒤 늦은 접수 응답 경계를 보완하고 lifecycle interface 테스트로 고정했다. submit-time health failure에서 readiness 재확인이 실제로 노출되는 경로도 검증했다.
- 검증: `pnpm --filter web run lint`, `pnpm --filter web run test` (18 files, 133 tests), `pnpm --filter web run build`, `pnpm --filter web run test:browser`, `pnpm test` 통과.
- browser smoke는 fixture API와 로컬 Chromium 증거이며 실제 API·worker/provider/R2, 물리 browser/system UI, screen reader, production 배포 동작을 증명하지 않는다.
