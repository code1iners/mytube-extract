Status: ready-for-agent

# 추출 요청 생명주기 deep module

## Problem Statement

Web 앱의 영상 추출과 자막 추출은 입력 방식과 접수 통신은 다르지만, 준비 상태 확인부터 접수, navigation lock, 접수 전 취소, 늦은 접수 결과 보존, 접수증 저장, 작업 상태 확인, 완료·실패·만료 표시까지 같은 추출 요청 생명주기를 가진다.

현재는 두 요청 화면의 큰 hook이 이 생명주기를 각각 조합한다. 공통 동작을 돕는 작은 hook도 생명주기 순서를 interface로 노출한다. 호출자는 요청 시작, 취소, 결과 수락 또는 오류 무시, 종료 정리를 올바른 순서로 호출해야 한다. 화면도 수십 개의 boolean, 문자열, handler, query 상태를 전달받아 현재 상태를 다시 해석한다.

이 구조에서는 취소와 서버 접수가 경쟁하는 경우, 접수증 저장이 실패하는 경우, readiness가 갱신되는 동안 활성 작업을 계속 보여줘야 하는 경우처럼 중요한 규칙의 locality가 낮다. 작은 module의 단위 테스트는 각각 통과해도, 실제 생명주기 조합의 오류는 긴 browser smoke에서야 발견될 수 있다. 같은 규칙을 바꿀 때 영상 추출과 자막 추출을 함께 수정해야 하므로 leverage도 낮다.

## Solution

준비 상태 확인부터 활성 작업의 terminal 상태까지를 하나의 deep React hook module로 만든다. 이 module의 interface는 화면이 알아야 하는 의미 있는 상태와 그 상태에서 가능한 행동만 제공한다. 화면은 입력·검증·markup·DOM focus를 계속 소유한다.

영상 추출과 자막 추출의 차이는 두 production adapter에 둔다. 각 adapter는 요청 생성과 상태 조회 통신을 담당한다. 자막 adapter는 upload session 생성, part upload, complete, 실패 또는 취소 시 best-effort abort까지 자신의 implementation 안에 숨긴다. 공통 module은 multipart 세부를 알지 않는다.

통신, readiness 확인, 접수증 저장, navigation lock은 production adapter와 in-memory adapter로 교체할 수 있게 한다. 테스트는 가장 높은 seam인 추출 요청 생명주기 interface를 통해 성공, 오류, 취소 경쟁, 저장 실패, 상태 전이를 검증한다. 기존 shallow hook의 public interface는 새 module이 동작을 흡수한 뒤 제거하며 facade를 남기지 않는다.

이 작업은 동작을 바꾸지 않는 구조 개선이다. 기존 서버 계약, 브라우저 접수증 형식, 요청 내역, 화면 문구, 진행률 근거, route-local 상태, 접근성 focus 계약을 유지한다.

## User Stories

1. As a Web 앱 사용자, I want 영상 추출과 자막 추출이 같은 접수 규칙을 따르기를 원한다, so that 요청 종류에 따라 취소와 상태 확인 동작이 달라지지 않는다.
2. As a Web 앱 사용자, I want 최초 readiness 응답이 오기 전에는 요청 form 대신 확인 중 상태를 보기를 원한다, so that 준비되지 않은 요청을 시작하지 않는다.
3. As a Web 앱 사용자, I want readiness가 `ready`일 때만 요청 form을 사용하기를 원한다, so that 실제로 접수 가능한 상태에서 작업을 시작한다.
4. As a Web 앱 사용자, I want 이미 열린 form이 background readiness 확인 중에도 유지되기를 원한다, so that 입력하던 URL이나 선택한 파일을 잃지 않는다.
5. As a Web 앱 사용자, I want 완료된 readiness 확인이 실패 또는 worker 미가용을 알릴 때만 form이 차단되기를 원한다, so that 일시적인 background 확인 표시 때문에 작업이 중단되지 않는다.
6. As a Web 앱 사용자, I want submit 직전에 readiness를 다시 확인하기를 원한다, so that 오래된 준비 상태로 요청을 접수하지 않는다.
7. As a Web 앱 사용자, I want 접수 중에는 다른 route로 이동하지 못하기를 원한다, so that 진행 중인 브라우저 요청을 실수로 끊지 않는다.
8. As a Web 앱 사용자, I want 접수 전 요청을 취소하면 navigation lock이 즉시 풀리기를 원한다, so that 기다리지 않고 다른 화면으로 이동할 수 있다.
9. As a 영상 추출 사용자, I want 접수를 취소한 뒤에도 URL·형식·품질이 유지되기를 원한다, so that 같은 설정으로 다시 요청할 수 있다.
10. As a 자막 추출 사용자, I want 접수를 취소한 뒤에도 선택 파일과 처리 방식이 유지되기를 원한다, so that 파일을 다시 선택하지 않고 요청할 수 있다.
11. As a Web 앱 사용자, I want 취소와 경쟁해 서버 작업이 이미 접수됐다면 접수증을 보존하기를 원한다, so that 생성된 작업을 요청 내역에서 잃지 않는다.
12. As a Web 앱 사용자, I want 취소와 경쟁해 접수된 서버 작업을 취소됐다고 표시하지 않기를 원한다, so that 실제 서버 상태와 화면 안내가 충돌하지 않는다.
13. As a Web 앱 사용자, I want browser abort 오류가 일반 접수 실패로 표시되지 않기를 원한다, so that 내가 취소한 동작을 시스템 오류로 오해하지 않는다.
14. As a Web 앱 사용자, I want 접수 성공 시 현재 브라우저의 요청 내역에 접수증이 저장되기를 원한다, so that 다른 화면에서도 작업 상태를 다시 찾을 수 있다.
15. As a Web 앱 사용자, I want 접수증 저장이 실패해도 이미 생성된 서버 작업을 현재 화면에서 계속 확인하기를 원한다, so that 브라우저 저장 오류 때문에 작업 결과를 잃지 않는다.
16. As a Web 앱 사용자, I want 접수증 저장 실패 시 해당 작업의 요청 내역 deep link를 받기를 원한다, so that 저장되지 않은 작업에도 다시 접근할 수 있다.
17. As a Web 앱 사용자, I want 접수된 작업의 실제 server status를 현재 route에서 확인하기를 원한다, so that 요청 내역으로 강제 이동하지 않고 결과를 받을 수 있다.
18. As a Web 앱 사용자, I want queued·processing 상태만 정해진 간격으로 다시 확인하기를 원한다, so that 필요한 동안에만 상태 조회가 계속된다.
19. As a Web 앱 사용자, I want completed·failed·expired 상태에서 polling이 멈추기를 원한다, so that 끝난 작업을 불필요하게 계속 조회하지 않는다.
20. As a Web 앱 사용자, I want 상태 조회의 재시도 가능 오류와 재시도 불가 오류가 현재와 동일하게 처리되기를 원한다, so that 일시적 연결 문제와 사라진 작업을 구분할 수 있다.
21. As a Web 앱 사용자, I want 활성 작업이 생긴 뒤에는 readiness 변화보다 그 작업의 상태를 우선해서 보기를 원한다, so that 진행 중 결과가 준비 상태 화면에 가려지지 않는다.
22. As a 영상 추출 사용자, I want 완료 결과에서 형식·품질·보관기간과 실제 다운로드 주소를 계속 확인하기를 원한다, so that 원하는 영상 또는 오디오 파일을 받을 수 있다.
23. As a 자막 추출 사용자, I want 완료 결과에서 원본 파일명·영어 SRT·보관기간과 실제 다운로드 주소를 계속 확인하기를 원한다, so that 올바른 자막 파일을 받을 수 있다.
24. As a Web 앱 사용자, I want server response가 제공하지 않은 진행률을 화면이 만들지 않기를 원한다, so that 추정값을 실제 처리 상태로 오해하지 않는다.
25. As a 키보드 사용자, I want 취소 또는 오류 복구 뒤 focus가 요청을 다시 시작할 수 있는 control로 이동하기를 원한다, so that 키보드 탐색을 처음부터 반복하지 않는다.
26. As a Web 앱 사용자, I want route를 떠났다가 돌아왔을 때 과거 활성 작업이 자동으로 열리지 않기를 원한다, so that 현재의 route-local 사용 방식을 그대로 유지한다.
27. As a 유지보수자, I want 영상·자막 요청 생명주기를 하나의 interface로 이해하기를 원한다, so that 여러 hook의 호출 순서를 추적하지 않아도 된다.
28. As a 유지보수자, I want 영상과 자막의 통신 차이가 adapter에만 있기를 원한다, so that 공통 lifecycle implementation에서 요청 종류 분기를 제거할 수 있다.
29. As a 유지보수자, I want 자막 multipart protocol이 자막 adapter 안에 숨겨지기를 원한다, so that 공통 module과 자막 화면이 session·part·complete·abort 순서를 알지 않아도 된다.
30. As a 유지보수자, I want 현재 상태에서 유효한 행동만 interface에 나타나기를 원한다, so that 잘못된 순서의 호출을 만들기 어렵다.
31. As a 유지보수자, I want 오류 우선순위와 사용자 안내가 deep module에서 한 번만 결정되기를 원한다, so that 두 route의 오류 표시가 서로 어긋나지 않는다.
32. As a 유지보수자, I want 취소 경쟁과 상태 전이를 in-memory adapter로 재현하기를 원한다, so that 긴 browser smoke에 의존하지 않고 핵심 규칙을 빠르게 검증할 수 있다.
33. As a 유지보수자, I want 내부 helper를 바꿔도 생명주기 interface 테스트가 유지되기를 원한다, so that 테스트가 implementation refactor를 방해하지 않는다.
34. As a 유지보수자, I want 새 deep module이 기존 shallow hook 위의 facade가 아니기를 원한다, so that public interface와 ordering 지식이 실제로 줄어든다.
35. As a 유지보수자, I want 영상 route부터 자막 route까지 단계적으로 이전하기를 원한다, so that 각 단계에서 기존 동작과 새 동작을 비교하고 회귀를 제한할 수 있다.

## Implementation Decisions

- **Canonical domain term**: 준비 상태 확인부터 접수된 요청이 완료·실패·만료에 도달할 때까지를 `추출 요청 생명주기`라고 부른다. 이 용어는 사용자에게 보이는 `원본 → 추출 → 파일 수령` 요청 흐름과 구분한다.
- **Single deep module**: 추출 요청 생명주기는 하나의 React hook module이 소유한다. framework-neutral 상태 machine을 별도로 만들지 않는다. 현재 호출자가 React 화면뿐이므로 추가 seam은 만들지 않는다.
- **Lifecycle scope**: readiness 확인, submit 직전 재확인, navigation lock, 접수 전 취소, 취소와 응답의 경쟁, 접수증 저장, 활성 작업 상태 조회, terminal 상태 전환, 오류 우선순위를 implementation 안에 포함한다.
- **Behavior-preserving refactor**: 사용자 흐름과 기존 서버 계약은 변경하지 않는다. URL·파일·선택값 보존, 늦은 접수 결과 보존, 서버 작업 취소로 오인하지 않는 안내, polling 정책, 요청 내역 이동 규칙을 그대로 유지한다.
- **Route-owned input**: 영상 URL·형식·품질과 자막 파일·처리 방식의 상태 및 검증은 각 route가 계속 소유한다. deep module은 검증된 요청 입력만 받는다.
- **Phase-oriented interface**: 외부 interface는 `request`, `accepting`, `processing`, `result`, `error`처럼 의미 있는 상태를 제공한다. raw query·mutation 객체와 다수의 독립 boolean을 외부에 노출하지 않는다.
- **Readiness substate**: `request` 상태 안에서 `checking`, `ready`, `failed`, `unavailable`을 구분한다. 활성 작업이 생긴 뒤에는 background readiness 결과가 현재 작업 상태를 덮지 않는다.
- **Phase-specific actions**: 각 상태는 현재 유효한 행동만 제공한다. 잘못된 시점의 submit·cancel·retry를 항상 노출한 뒤 no-op으로 처리하지 않는다.
- **Presentation data**: 각 상태는 제목, 메시지, 진행 정보, 오류 상세, 완료 결과처럼 화면에 필요한 표시 데이터를 함께 제공한다. 화면은 상태 우선순위나 표시 문구를 다시 조합하지 않는다.
- **Route-specific result data**: 공통 상태와 함께 영상의 형식·품질, 자막의 원본 파일명·영어 SRT 정보처럼 route별 결과 데이터를 보존한다. 모든 결과를 손실 있는 단일 형식으로 평탄화하지 않는다.
- **Two request adapters**: 같은 lifecycle implementation에 영상 요청 adapter 또는 자막 요청 adapter를 전달한다. 공통 implementation에는 요청 종류에 따른 통신 분기를 두지 않는다.
- **Adapter responsibilities**: 각 요청 adapter는 요청 생성과 상태 조회 통신을 담당한다. 공통 module은 접수, 취소 경쟁, 접수증, polling, 오류 정책을 담당한다.
- **Subtitle multipart locality**: upload session, 동시 part upload, progress, complete, 실패 또는 취소 시 best-effort abort는 자막 adapter implementation 안에 둔다. 공통 lifecycle module은 multipart 세부를 알지 않는다.
- **Injected dependencies**: readiness 통신, 요청 통신, 접수증 저장, navigation lock은 production adapter와 in-memory adapter로 교체할 수 있게 한다. adapter seam은 deep module의 내부 seam이며 화면에 노출하지 않는다.
- **Error ownership**: adapter는 통신 실패 사실을 전달하고, deep module은 readiness 오류, 접수 오류, 상태 조회 오류, terminal 오류의 우선순위와 사용자 열람용 상세를 결정한다.
- **Storage failure is non-fatal**: 접수증 저장 실패는 이미 접수된 서버 작업의 실패로 바꾸지 않는다. 현재 route의 상태 확인을 유지하고 요청 내역 deep link와 저장 실패 안내를 보존한다.
- **Focus ownership**: deep module의 cancel·return 행동은 성공 여부를 화면에 알린다. 실제 DOM focus 이동은 각 route가 자신의 control을 대상으로 즉시 수행한다.
- **Route-local lifetime**: lifecycle 상태는 현재처럼 각 route mount에 속한다. route 재진입 시 과거 활성 작업을 자동 복원하거나 전역 singleton으로 승격하지 않는다.
- **Replace, do not layer**: 새 deep module이 동작을 흡수하면 기존 request-attempt, active-job-status, worker-readiness hook의 public interface를 제거한다. 같은 public ordering을 유지하는 facade는 남기지 않는다. 내부 구현을 작은 private 함수로 나누는 것은 허용한다.
- **Staged migration**: 기존 특성 테스트를 먼저 고정하고, 영상 adapter와 route를 먼저 이전한 뒤 자막 adapter와 route를 이전한다. 마지막 단계에서 이전 public interface와 중복 테스트를 제거한다.
- **No persistence or server schema change**: 브라우저 접수증의 종류·UUID·접수 시각 형식, localStorage key, 서버 요청·응답 형식, endpoint, retention 계약은 변경하지 않는다.
- **No new ADR**: 이번 선택은 현재 제품 계약을 보존하는 가역적 내부 구조 개선이며 기존 ADR을 뒤집지 않는다. 별도 ADR은 만들지 않는다.

## Testing Decisions

좋은 테스트는 내부 helper의 호출 횟수나 TanStack Query 객체를 검사하지 않는다. 화면과 호출자가 관찰할 수 있는 추출 요청 생명주기 상태, 허용 행동, adapter에 전달되는 요청, navigation lock, 접수증 결과를 가장 높은 seam인 deep module interface에서 검증한다.

- **Primary test seam**: 추출 요청 생명주기 hook interface를 렌더링하고 production adapter 대신 in-memory adapter와 제어 가능한 clock을 사용한다. 새 기능 테스트의 기본 seam은 하나다.
- **Readiness matrix**: 최초 checking, ready, 확인 실패, worker 미가용, ready 이후 background checking, background 응답 실패를 검증한다. ready form 보존과 활성 작업 우선 규칙을 observable state로 단언한다.
- **Submit and lock**: submit 직전 readiness 재확인, 접수 시작 시 navigation lock, 성공·실패·취소·unmount 시 unlock을 검증한다.
- **Cancellation races**: 응답 전 취소, 취소 뒤 AbortError, 취소와 경쟁한 늦은 성공, 교체된 attempt의 늦은 오류를 검증한다. 늦은 성공은 접수증과 활성 작업을 보존하고 서버 작업 취소로 표시하지 않아야 한다.
- **Receipt outcomes**: 접수증 저장 성공, 저장 차단, 유효하지 않은 job ID, deep link fallback을 검증한다. 저장 실패는 lifecycle error가 아니라 별도 안내가 있는 활성 작업 상태로 남아야 한다.
- **Polling transitions**: queued에서 processing을 거쳐 completed·failed·expired로 전이하는 경우, terminal 상태의 polling 중단, 재시도 가능한 5xx·network 오류, 재시도 불가 4xx·abort를 검증한다.
- **Error priority**: 상태 조회 오류, terminal 오류, 접수 오류, readiness 오류가 동시에 후보가 될 때 현재 계약의 우선순위대로 하나의 오류 상태와 상세가 나오는지 검증한다.
- **Video adapter**: 영상 요청 payload, submit signal, 상태 조회, 다운로드 결과의 형식·품질·보관기간 보존을 검증한다.
- **Subtitle adapter**: session 생성, part 순서와 동시성, progress, complete, part 실패, ETag 누락, 취소, complete 경쟁, abort 실패를 adapter의 observable 결과로 검증한다. best-effort abort 실패가 원래 오류를 덮지 않아야 한다.
- **Page tests**: 기존 정적 markup 테스트 패턴을 유지하되 넓은 hook mock 대신 phase별 최소 상태를 사용한다. 요청 form, readiness panel, accepting, processing, result, error의 markup과 가능한 행동을 확인한다.
- **Focus tests**: 취소와 오류 복구 뒤 영상 URL 입력, 자막 파일 선택 control, readiness 재확인 control로 focus가 이동하는 기존 동작을 화면 테스트와 browser 검증에서 확인한다.
- **Browser smoke**: 영상·자막의 핵심 성공 흐름, navigation lock, 취소 경쟁, 접수증 저장 실패, terminal 결과를 유지한다. deep module interface에서 충분히 검증한 조합을 browser smoke에 중복 추가하지 않는다.
- **Prior art**: 기존 request-history query contract 테스트의 polling 정책, job-receipt 테스트의 storage stand-in, 요청 화면의 정적 markup 테스트, request-history browser smoke의 취소 경쟁 fixture를 재사용한다.
- **Replace old tests**: 새 interface 테스트가 같은 행동을 포괄하면 shallow helper의 내부 동작 테스트를 제거한다. implementation 재배치만으로 깨지는 테스트는 남기지 않는다.
- **Validation commands**: 각 단계의 마지막 변경 이후 Web lint와 unit test를 실행한다. 통합 단계에서는 Web build와 browser smoke도 실행한다. 로컬 Chromium fixture는 production server, 실제 provider, 실제 R2, 물리 브라우저 또는 화면 낭독기 증거로 표현하지 않는다.

## Out of Scope

- 사용자에게 보이는 영상 추출·자막 추출 화면의 재설계 또는 문구 변경.
- 영상 URL, 형식, 품질, 자막 파일, 처리 방식의 form 상태나 validation 규칙 통합.
- 서버에 접수된 작업을 취소하는 endpoint 또는 동작 추가.
- 요청 내역 화면의 storage 동기화, 삭제·되돌리기, 404 정리, cross-tab lifecycle 심층화.
- 요청 내역의 검색, 필터, pagination, 전체 삭제 또는 서버 기반 목록.
- 계정, 로그인, 요청 소유권, 다른 기기 동기화 또는 공개 서비스 전환.
- Chrome 확장 프로그램, API 서버, worker 또는 media-downloader의 구조 변경.
- 서버 요청·응답 schema, endpoint, polling 간격, retention 기간 변경.
- framework-neutral 상태 machine 또는 전역 추출 요청 singleton 도입.
- route 재진입 시 이전 활성 작업 자동 복원.
- 실제 provider, production deployment, 실제 R2, 화면 낭독기 또는 물리 기기 acceptance를 로컬 자동화로 대체하는 것.

## Further Notes

- `추출 요청 생명주기`는 프로젝트 domain glossary에 추가됐으며 `요청 흐름`과 구분한다.
- 기존 개인 사용 단계와 브라우저 중심 요청 내역 결정은 유지한다. 이 spec은 인증·소유권·보존 정책을 재검토하지 않는다.
- YouTube client fallback 결정은 서버 측 추출 정책이므로 이 spec에서 변경하지 않는다.
- 구현 순서는 특성 테스트, 영상 route, 자막 route, 이전 interface 삭제와 통합 검증이다.
- 구조 개선의 완료 조건은 새 파일의 존재가 아니라 deletion test다. 이전 public hook을 삭제했을 때 생명주기 복잡성이 route로 되돌아오지 않아야 한다.
