# 03: 자막 추출 생명주기 vertical slice

**What to build:** 준비된 자막 요청 adapter를 공통 deep module과 자막 추출 화면에 연결한다. 사용자는 기존 파일 선택과 처리 방식을 유지하면서 readiness 확인부터 접수·취소, 영어 SRT 작업 상태, 다운로드 또는 오류까지 영상 추출과 같은 생명주기 interface를 이용할 수 있다.

**Blocked by:** 02: 자막 요청 adapter의 multipart protocol 심층화

**Status:** done (2026-09-04)

- [x] 자막 파일·처리 방식 상태와 validation은 자막 화면에 유지되고 검증된 입력만 deep module에 전달된다.
- [x] 공통 lifecycle implementation에는 자막 종류나 multipart protocol 분기가 없다.
- [x] 최초 readiness와 submit 직전 재확인, ready 이후 background checking 중 파일·처리 방식 보존이 유지된다.
- [x] 접수 중 navigation lock과 cancel 뒤 즉시 unlock이 유지된다.
- [x] cancel 뒤 선택 파일과 처리 방식이 유지되고 화면이 파일 선택 또는 readiness 재확인 control로 focus를 이동한다.
- [x] cancel과 경쟁한 늦은 complete 성공은 접수증과 활성 작업을 보존하고 서버 작업 취소로 표시하지 않는다.
- [x] 접수증 저장 실패는 접수 실패로 바뀌지 않으며 현재 작업 추적과 요청 내역 deep link가 유지된다.
- [x] queued·extracting_audio·transcribing polling과 terminal 상태 중단이 유지된다.
- [x] 활성 작업 이후 readiness 변화가 현재 자막 작업 상태를 덮지 않는다.
- [x] 완료 결과의 원본 파일명·영어 SRT·보관기간·다운로드 주소와 실패·만료·조회 오류 상세가 유지된다.
- [x] 자막 화면은 phase별 상태만 사용하고 raw query·mutation, multipart ordering, 생명주기 ordering을 조합하지 않는다.
- [x] lifecycle interface의 영상·자막 adapter 교체가 공통 상태와 행동을 바꾸지 않는다는 테스트가 있다.
- [x] 자막 화면 테스트와 자막 browser 성공·취소·저장 실패 흐름이 통과한다.
- [x] Web lint와 unit test가 통과한다.

## Comments

### 2026-09-04 구현

- `use-subtitles-extract-logic.ts`가 파일·Whisper 처리 방식·validation·focus를 계속 소유하고, 검증된 `SubtitleRequest`만 `useExtractionRequestLifecycle`에 전달한다. 자막 adapter가 session·part·complete·cleanup 순서를 숨기므로 route에는 multipart ordering이 남지 않는다.
- 공통 lifecycle이 자막 adapter와 동일한 readiness, submit 직전 재확인, navigation lock, 취소 경쟁, 접수증 저장 fallback, active job polling, terminal/error 우선순위를 처리한다. 접수증 저장 실패 시에도 현재 job과 요청 내역 deep link를 유지하고 저장 실패 안내를 표시한다.
- lifecycle interface의 자막 adapter 교체 단위 테스트와 자막 browser 성공·취소·저장 실패 흐름을 추가했다. 기존 자막 화면의 파일 선택, 처리 방식, 결과·오류 문구와 DOM focus 계약은 유지했다.
- 검증: `pnpm --filter web run lint`, `pnpm --filter web run test` (19 files, 138 tests), `pnpm --filter web run build`, `pnpm --filter web run test:browser`, `pnpm test` (6 packages, 12 tasks) 통과.
- browser smoke는 fixture API와 로컬 Chromium 증거이며 실제 API·worker/provider/R2, 물리 browser/system UI, screen reader, production 배포 동작을 증명하지 않는다.
