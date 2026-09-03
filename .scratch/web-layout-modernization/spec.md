Status: done (2026-09-03)

# Web 작업 레이아웃 현대화

## Problem Statement

MyTube Extract Web은 Pretendard, Nintendo red 단일 액션색, hairline, 8–12px radius 등 현대적인 foundation을 이미 사용하고 있으며 주요 내비게이션과 접근성 구조도 일관적이다. 그러나 `/video`, `/subtitles`, `/history`, `/settings`의 헤더·본문·상태·선택지가 모두 비슷한 회색 카드와 테두리 안에 배치되어, 핵심 작업과 보조 정보가 같은 시각적 무게를 가진다. 그 결과 화면은 정돈돼 있지만 컴포넌트 예제를 세로로 쌓은 범용 관리 도구처럼 보이고, 영상 추출과 자막 추출의 서로 다른 작업 성격도 레이아웃에서 충분히 드러나지 않는다.

요청 전에 표시하는 API (Application Programming Interface: 앱과 서버가 통신하는 규약)·worker readiness는 사용자가 입력을 시작하는 데 필요한 조건이다. 확인 중·실패·미가용에서는 폼을 숨긴 status-first 화면이 먼저 상태와 복구 동작을 보여주고, 준비됨에서만 입력을 연다. 모바일 자막 요청은 파일 선택 영역과 두 처리 방식이 CTA (Call to Action: 주요 실행 버튼) 앞에 펼쳐져도 핵심 행동까지의 거리가 짧도록 밀도를 유지한다.

요청 내역은 계정이나 서버별 소유권이 없는 현재 개인 사용 단계에서 job을 다시 찾는 유일한 브라우저 표면이다. 하지만 내역 삭제는 복구 기회 없이 즉시 localStorage의 job receipt를 제거한다. 또한 설정 링크와 URL 지우기 동작은 높이는 확보했지만 44px보다 좁고, `/settings`는 테마 선호 하나를 큰 독립 카드로 보여줘 내용보다 컨테이너가 더 커 보인다.

## Solution

기존 Nintendo 미니멀 플랫 정체성과 기능·상태·route 계약은 유지하면서 Web의 표면 계층과 작업 리듬을 재구성한다. 페이지 전체를 다시 하나의 카드로 보이게 만드는 외곽 표면을 약화하고, 제목·설명·입력·CTA가 여백과 타이포그래피만으로도 하나의 작업 흐름으로 읽히게 한다. border와 surface 전환은 실제 상호작용 경계, 오류, 완료 결과처럼 구분이 필요한 곳에만 사용한다. 주요 요청 상태와 `/history`에는 `원본 → 추출 → 파일 수령` trail을 API 응답에 맞춰 연결한다.

영상 추출은 `YouTube URL → 형식 → 품질 → 요청`, 자막 추출은 `로컬 영상 → 처리 방식 → 영어 SRT 생성` 순서가 한눈에 읽히도록 서로 다른 작업 구조를 갖는다. API·worker readiness가 `ready`가 아니면 상태 우선 화면이 form을 대체하고, `ready`에서만 입력을 제공한다. API 확인 실패와 worker 미가용은 확장 안내에서 구분하며 같은 차단 이유를 중복 설명하지 않는다. 서버 job 생성 전 `요청 취소`는 브라우저 요청을 중단하지만, 생성 경쟁이 확인되면 접수증을 보존하고 서버 job이 취소됐다고 말하지 않는다.

모바일 자막 요청에서는 파일 선택 영역과 처리 방식의 높이·간격을 줄이되 모든 선택지를 계속 인식 가능한 형태로 유지한다. CTA는 파일 선택 뒤 짧은 스크롤 안에 도달할 수 있어야 하며 fixed 하단 내비게이션과 겹치지 않는다. 요청 내역 삭제는 즉시 결과를 보여주면서도 짧은 시간 동안 되돌릴 수 있게 하고, 복원 성공·실패와 focus 이동을 접근 가능하게 알린다.

`/settings` route와 시스템·라이트·다크 테마 선택은 유지한다. 존재하지 않는 설정 항목을 만들지 않고, 외곽 카드보다 `화면 표시`라는 실제 preference group이 중심이 되도록 밀도를 조정한다. 구현 용어는 검증 가능한 운영 정보로서 기본으로 접힌 native disclosure에 남기되 사용자의 결정과 결과를 설명하는 문구보다 앞서지 않는다. `/video`의 `U`, `/subtitles`의 `F`는 text editing target과 modifier 조합을 침범하지 않는 보조 단축키다.

## User Stories

1. As a 영상 추출 사용자, I want URL 입력이 화면의 첫 번째 시각적 초점이 되기를 원한다, so that 서버 상태 카드보다 내가 하려는 작업을 먼저 인식할 수 있다.
2. As a 영상 추출 사용자, I want URL·형식·품질·요청 순서가 하나의 연속된 흐름으로 보이기를 원한다, so that 다음에 무엇을 선택해야 하는지 빠르게 알 수 있다.
3. As a 자막 추출 사용자, I want 파일·처리 방식·영어 SRT 생성 순서가 명확하기를 원한다, so that 영상 추출과 다른 작업 구조를 자연스럽게 이해할 수 있다.
4. As a Web 앱 사용자, I want 페이지·상태·폼·선택지가 모두 중첩 카드처럼 보이지 않기를 원한다, so that 핵심 작업과 보조 정보의 위계를 쉽게 구분할 수 있다.
5. As a Web 앱 사용자, I want 실제 상호작용 경계에만 border가 사용되기를 원한다, so that 화면을 훑을 때 불필요한 박스가 시선을 분산하지 않는다.
6. As a Web 앱 사용자, I want light와 dark 테마에서 같은 표면 계층을 경험하기를 원한다, so that 테마에 따라 정보 위계가 달라지지 않는다.
7. As a Web 앱 사용자, I want 준비된 서버 상태가 짧고 조용하게 표시되기를 원한다, so that 정상적인 시스템 조건이 내 작업보다 더 크게 보이지 않는다.
8. As a Web 앱 사용자, I want 서버 상태 확인 중에도 무엇을 확인하는지 알 수 있기를 원한다, so that 잠시 기다려야 하는 이유를 이해할 수 있다.
9. As a Web 앱 사용자, I want API 상태 확인 실패와 worker 미가용을 서로 다른 상태로 안내받기를 원한다, so that 어떤 계층을 점검해야 하는지 알 수 있다.
10. As a Web 앱 사용자, I want 장애 상태에서 재확인 동작을 바로 찾을 수 있기를 원한다, so that 화면을 벗어나지 않고 복구를 시도할 수 있다.
11. As a Web 앱 사용자, I want 검증되지 않은 원인이나 운영 명령을 장애 안내에서 보지 않기를 원한다, so that 잘못된 해결책을 따르지 않는다.
12. As a Web 앱 사용자, I want 동일한 제출 차단 이유가 여러 위치에서 반복되지 않기를 원한다, so that 짧고 일관된 안내만 읽을 수 있다.
13. As a 키보드 사용자, I want compact readiness의 재확인 동작에도 명확한 focus 표시가 있기를 원한다, so that 현재 조작 위치를 놓치지 않는다.
14. As a 스크린리더 사용자, I want readiness의 확인 중·준비됨·실패·미가용 변화가 적절한 live region으로 전달되기를 원한다, so that 시각 정보 없이도 제출 가능 여부를 알 수 있다.
15. As a 모바일 자막 사용자, I want 파일 선택 영역이 화면 대부분을 차지하지 않기를 원한다, so that 파일 선택 후 처리 방식과 CTA를 빠르게 찾을 수 있다.
16. As a 모바일 자막 사용자, I want 속도 우선과 정확도 우선 선택지를 계속 비교할 수 있기를 원한다, so that 공간 절약 때문에 중요한 결정을 기억에 의존하지 않는다.
17. As a 모바일 자막 사용자, I want 처리 방식의 사용자 중심 설명이 모델 식별자보다 먼저 보이기를 원한다, so that 내부 구현을 몰라도 선택할 수 있다.
18. As a 모바일 자막 사용자, I want CTA가 fixed 하단 내비게이션에 가려지지 않기를 원한다, so that 스크롤 끝에서도 요청을 제출할 수 있다.
19. As a 320px 폭 사용자, I want 자막 처리 옵션과 CTA가 잘리거나 수평으로 넘치지 않기를 원한다, so that 가장 좁은 지원 폭에서도 작업을 완료할 수 있다.
20. As a 데스크톱 사용자, I want 넓은 화면에서 작업 흐름이 지나치게 비어 있거나 작은 카드 하나로 보이지 않기를 원한다, so that 콘텐츠 폭과 여백이 의도적으로 느껴진다.
21. As a 요청 내역 사용자, I want 실수로 삭제한 job receipt를 짧은 시간 동안 되돌리고 싶다, so that 완료 파일이나 진행 상태로 돌아가는 유일한 경로를 잃지 않는다.
22. As a 요청 내역 사용자, I want 삭제 결과와 되돌릴 수 있는 남은 행동을 즉시 안내받기를 원한다, so that 삭제가 반영됐는지 확신할 수 있다.
23. As a 요청 내역 사용자, I want 삭제를 되돌리면 원래 acceptedAt을 포함한 같은 receipt가 복원되기를 원한다, so that 최신순 정렬과 job 식별이 바뀌지 않는다.
24. As a 요청 내역 사용자, I want 되돌리기 시간이 끝나면 삭제가 확정되기를 원한다, so that 명시한 삭제 의도가 유지된다.
25. As a 요청 내역 사용자, I want localStorage 복원이 실패하면 그 사실을 안내받기를 원한다, so that 내역이 복구됐다고 잘못 믿지 않는다.
26. As a 키보드 사용자, I want 삭제·되돌리기 후 focus가 예측 가능한 요소로 이동하기를 원한다, so that 목록에서 현재 위치를 잃지 않는다.
27. As a 스크린리더 사용자, I want 삭제·복원·복원 실패가 중복되지 않는 상태 메시지로 전달되기를 원한다, so that 변경 결과를 정확히 알 수 있다.
28. As a 설정 사용자, I want `/settings`에서 실제 제공하는 `화면 표시` preference가 중심으로 보이기를 원한다, so that 빈 카드보다 설정 목적을 먼저 이해할 수 있다.
29. As a 설정 사용자, I want 시스템·라이트·다크 선택과 저장된 선호 복원이 그대로 유지되기를 원한다, so that 레이아웃 개선 때문에 기존 설정 동작이 바뀌지 않는다.
30. As a 모바일 사용자, I want 상단 설정과 URL 지우기 동작이 최소 44×44px 조작 영역을 갖기를 원한다, so that 손가락으로 안정적으로 누를 수 있다.
31. As a URL 입력 사용자, I want 입력값이 있을 때만 지우기 동작이 보이기를 원한다, so that 빈 입력 행의 불필요한 비활성 control을 스캔하지 않는다.
32. As a 요청 내역이 없는 사용자, I want 두 추출 시작점과 브라우저 로컬 이력·7일 보관 사실을 짧게 이해하고 싶다, so that 현재 제품 모델을 놓치지 않으면서 바로 작업을 시작할 수 있다.
33. As a Web 앱 사용자, I want 영상·자막·요청 내역의 주요 내비게이션 위치와 현재 route 표시가 유지되기를 원한다, so that 레이아웃이 달라져도 익숙한 이동 구조를 사용할 수 있다.
34. As a Web 앱 사용자, I want 요청 접수·처리·완료·실패 상태와 다운로드 동작이 그대로 유지되기를 원한다, so that 시각 개선이 실제 job 흐름을 바꾸지 않는다.
35. As a Web 앱 사용자, I want light·dark, 320px·390px·1280px에서 읽기 순서와 조작 순서가 일치하기를 원한다, so that 기기와 테마에 관계없이 같은 작업 모델을 사용할 수 있다.
36. As a 유지보수자, I want 레이아웃 계약이 디자인 문서와 실제 컴포넌트에서 같은 용어로 설명되기를 원한다, so that 이후 티켓과 구현이 다시 카드 중첩 방식으로 회귀하지 않는다.

## Implementation Decisions

- **개선 성격**: 이번 작업은 기존 정체성을 보존하는 refinement다. Nintendo 미니멀 플랫, Pretendard, semantic color token, Nintendo red 단일 액션색, 760px 콘텐츠 최대 폭, 4px 기반 spacing scale을 유지한다. 새로운 visual world, 장식용 gradient, 대형 hero copy, 마케팅 이미지, 새로운 font family를 도입하지 않는다.
- **표면 계층**: app shell과 workspace는 전체 정렬을 담당하고, 각 route의 주 작업 영역은 다시 하나의 독립된 카드처럼 보이지 않게 한다. surface tint·hairline·shadow는 입력 control, 선택 control, 확장 오류, 완료 결과 등 기능적 경계에 선택적으로 사용한다. 헤더와 본문이 모두 동일한 card elevation을 갖지 않도록 계층을 분리한다.
- **route별 작업 구조**: 영상 추출은 URL, 형식, 품질, CTA 순서를 유지하고 자막 추출은 파일, 처리 방식, CTA 순서를 유지한다. 두 route가 동일한 상태·버튼 token을 공유하더라도 고유 입력의 크기와 그룹 구조는 각각의 작업에 맞게 조정한다.
- **내비게이션 계약 보존**: 영상 추출, 자막 추출, 요청 내역은 데스크톱과 모바일에서 계속 같은 수준의 주요 목적지다. `/settings`와 테마 preference도 유지한다. 기존 route path, `aria-current`, 요청 접수 중 이동 잠금, fixed 모바일 하단 내비게이션과 safe-area 처리를 바꾸지 않는다.
- **readiness 표현 상태**: `ready`에서만 요청 form을 표시하고 `checking`·`failed`·`unavailable`에서는 status-first readiness panel이 form을 대체한다. `failed`는 API 상태 요청 자체를 확인하지 못한 상태, `unavailable`은 API가 응답했지만 worker가 작업을 받을 수 없는 상태로 구분해 안내한다. 모든 차단 상태에는 재확인 동작을 유지한다.
- **readiness 정보 우선순위**: 마지막 확인 시각은 정상 상태의 주 콘텐츠가 아니며 보조 정보로 낮춘다. background refetch로 form이 숨겨져도 hook state의 URL·파일·선택값을 보존한다. 제출 불가 이유는 readiness 영역의 canonical 안내 하나로 유지하고 CTA 인접 영역에서 긴 문구를 반복하지 않는다.
- **진단 문구 제한**: 현재 health 계약으로 확인 가능한 API 요청 성공 여부와 worker availability만 표현한다. tunnel, process, network 원인을 추정하거나 실제로 제공되지 않는 로그 링크·운영 명령을 만들지 않는다.
- **readiness 접근성**: 기존 `status`·`alert`, `aria-live`, `aria-busy`, 재확인 accessible name 계약을 유지한다. compact 표현은 시각적 축약일 뿐 상태 의미나 보조 기술 공지를 제거하지 않는다.
- **자막 모바일 밀도**: 좁은 viewport의 파일 선택 영역은 현재 220px보다 낮게 조정하고, 처리 방식 두 개는 full-width compact row로 유지한다. 두 선택을 disclosure 뒤에 숨기거나 파일 선택 전 DOM (Document Object Model: 브라우저가 읽는 문서 구조)에서 제거하지 않는다. 사용자는 언제든 두 결과 중심 설명을 비교할 수 있어야 한다.
- **처리 방식 용어**: `속도 우선`과 `정확도 우선` 및 검증된 상대적 설명을 주 정보로 유지한다. `base.en`, `small.en`, 로컬 Whisper, worker는 기본으로 접힌 native disclosure에 보조 기술 정보로 표시하며 제거하거나 값을 바꾸지 않는다.
- **요청 중단과 응답 경쟁**: 영상 POST 및 자막 session·part·complete 요청은 접수 전 `AbortController`로 중단할 수 있다. 중단 뒤 navigation lock을 풀고 입력·파일을 보존한다. 취소 시점과 서버 응답이 경쟁해 job이 생성되면 receipt를 저장하고, 서버 job 취소로 오인할 수 있는 문구·API 호출을 만들지 않는다.
- **공통 흐름과 탐색**: request·processing·completed·history 항목은 실제 API 상태에 맞춰 `원본 → 추출 → 파일 수령`의 current step을 표시한다. active navigation label은 테마 본문색, red는 indicator/icon에만 사용하며 `/settings`는 primary 3탭 밖의 보조 route로 유지한다.
- **키보드 단축키와 조작 영역**: `U`는 URL 입력, `F`는 자막 파일 선택 동작을 focus한다. text input·textarea·select·contenteditable, modifier 조합, 반복 keydown에서는 동작하지 않는다. history의 모든 실제 action은 44×44px 이상이다.
- **요청 내역 undo**: 삭제 동작은 기존 receipt의 `kind`, `jobId`, `acceptedAt`을 보존한 채 즉시 목록과 localStorage에 반영한다. 일정 시간 동안 하나의 undo action을 제공하고, undo 시 기존 receipt 추가 seam을 통해 같은 acceptedAt으로 복원한다. 새로운 삭제가 시작되면 이전 삭제는 확정된 것으로 취급하고 가장 최근 삭제 하나만 되돌릴 수 있다.
- **undo 시간과 종료**: undo 가능 시간은 8초로 고정한다. 시간이 끝나거나 사용자가 다른 삭제를 수행하면 UI의 undo affordance를 닫는다. 삭제 자체는 이미 localStorage에 반영되므로 route 이동이나 unmount에서 별도 commit 작업은 필요하지 않다.
- **undo 실패 처리**: receipt 복원이 성공한 경우 원래 최신순 위치로 다시 나타나며 성공을 announce한다. localStorage 접근 실패나 유효성 실패로 복원하지 못하면 성공 상태로 되돌리지 않고 복원 실패를 alert로 알린다.
- **focus 관리**: 삭제 후에는 기존처럼 다음 삭제 버튼, 이전 삭제 버튼, 목록 제목 순으로 focus를 이동한다. undo가 실행되면 복원된 항목의 제목 또는 첫 번째 사용자 동작으로 focus를 이동해 복원 위치를 다시 찾을 수 있게 한다.
- **URL 지우기와 터치 영역**: URL 지우기 control은 값이 있을 때만 렌더링한다. 설정 링크와 지우기 control의 실제 clickable box는 너비와 높이 모두 최소 44px이며, 보이는 텍스트·accessible name은 기존 사용 목적을 유지한다.
- **설정 화면**: `/settings`에 존재하지 않는 계정·저장소·운영 설정을 만들지 않는다. `화면 표시` preference group, 테마 설명, theme control을 직접적인 세로 흐름으로 구성하고 불필요한 외곽 card elevation을 줄인다. 시스템·라이트·다크 값과 저장 키는 변경하지 않는다.
- **빈 내역 문구**: 영상·자막 두 진입점, 현재 브라우저에만 남는 이력, 완료 파일 7일 보관이라는 제품 사실은 유지한다. 같은 의미를 반복하는 제목·설명은 줄일 수 있지만 새로운 보관 정책이나 동기화 기능을 암시하지 않는다.
- **API·상태 계약 보존**: 다운로드·자막 요청 payload, health response, job status polling, receipt key, 최대 20건, in-place 처리·완료·오류 상태, 7일 보관 사실을 변경하지 않는다. UI는 API 응답을 계속 유일한 상태 근거로 사용한다.
- **디자인 문서 동기화**: 구현으로 확정된 표면 계층, compact readiness, 모바일 자막 밀도 규칙을 디자인 계약에 반영한다. color·typography token 값이 바뀌지 않으면 token sidecar를 불필요하게 수정하지 않는다.

## Testing Decisions

좋은 테스트는 CSS class의 존재나 내부 state 이름이 아니라 사용자가 보는 읽기 순서, 상태별 안내, 가능한 동작, focus 결과, responsive geometry를 검증한다. 기존 테스트 seam을 확장하고 레이아웃만을 위한 새 테스트 프레임워크는 도입하지 않는다.

- **주 seam — Web 브라우저 smoke**: 기존 request/history 브라우저 smoke에서 `/video`, `/subtitles`, `/history`, `/settings`를 fixture API와 함께 검증한다. 이 한 seam이 route 이동, readiness 네 상태, 자막 선택, localStorage receipt, 키보드 focus, 320px·390px·1280px responsive layout을 이미 소유하므로 사용자 여정 검증의 중심으로 사용한다.
- **레이아웃 외부 행동**: 320px·390px·1280px에서 수평 overflow가 없고, 모바일 CTA가 fixed 하단 내비게이션과 겹치지 않으며, 작업 입력이 DOM과 시각 순서에서 readiness 보조 정보보다 명확히 구분되는지 검증한다. light·dark 모두에서 같은 시나리오의 computed geometry와 가시성을 확인한다.
- **readiness 상태**: `checking`·`failed`·`unavailable`에서는 form이 보이지 않고 status-first 안내와 재확인 동작이 보이는지, `ready`에서만 form이 복원되는지 검증한다. background checking 동안 URL·파일·선택값이 보존되고, 상태 변화가 `status` 또는 `alert`와 `aria-busy`로 전달되며, 같은 차단 설명이 중복 출력되지 않는지 확인한다.
- **요청 중단·단축키·flow**: 영상 POST와 자막 multipart 각 단계에서 취소 시 AbortError, focus 복귀, navigation unlock, multipart abort cleanup과 job cancel 미호출을 확인한다. response race에서는 receipt가 보존되는지 확인한다. U/F 단축키는 keyboard-only로 focus를 이동하고 text editing/modifier 조합을 무시하며, flow trail은 상태별 current step을 반영하는지 검증한다.
- **기술 상세 disclosure**: 자막 처리 정보는 닫힌 native disclosure에서 click·Enter·Space로 열고 닫을 수 있으며, result-centered copy와 속도·정확도 선택은 기본 화면에 남는지 확인한다.
- **자막 모바일 밀도**: 320px·390px에서 파일 선택 control, 두 처리 방식, CTA의 순서와 가시성을 검증한다. 두 radio의 accessible name·checked state와 기존 click·Enter·Space·drag-and-drop 경로는 유지한다.
- **삭제·undo 사용자 여정**: receipt가 둘 이상인 fixture에서 하나를 삭제하면 해당 항목과 localStorage key가 사라지고 undo가 나타나는지 검증한다. 8초 안에 undo하면 같은 kind·jobId·acceptedAt이 복원되고 최신순 위치와 focus가 회복되는지, 시간이 지난 뒤에는 undo할 수 없는지 확인한다.
- **삭제·undo 실패 경로**: blocked localStorage fixture에서 복원 실패가 성공으로 표시되지 않고 alert가 전달되는지 검증한다. 연속 삭제 시 가장 최근 삭제만 undo 가능하고 이전 삭제가 다시 나타나지 않는지 확인한다.
- **순수 receipt seam**: 기존 job receipt unit test에서 같은 acceptedAt을 사용한 복원이 identity와 정렬을 보존하는지만 검증한다. 타이머와 toast 렌더링은 컴포넌트 내부 구현이므로 브라우저 사용자 여정에서 검증한다.
- **readiness 변환 seam**: 기존 worker health unit test에서 네 health 입력이 올바른 사용자 상태와 공지 역할로 변환되는지 유지한다. compact/expanded 여부가 별도 순수 모델로 도출될 경우에만 그 외부 반환값을 추가로 검증한다.
- **설정 회귀**: 기존 settings page와 theme preference 테스트에서 시스템·라이트·다크 선택, 저장된 선호 복원, `/settings`의 현재 위치 표시가 그대로 동작하는지 확인한다.
- **정적·자동 검증**: Web TypeScript 정적 검사, 전체 unit test, production build, 기존 browser smoke가 마지막 변경 이후 통과해야 한다. Impeccable detector는 coverage 산출물을 대상에서 제외하고 앱 source 또는 실제 변경 target에 한 번 실행한다.
- **수동 시각 확인**: 자동 테스트 뒤 light·dark의 320×844, 390×844와 1280×900을 한 번의 bounded pass로 비교한다. 카드 중첩 감소, 첫 시각 초점, readiness 위계, 자막 CTA 거리, 설정 밀도와 active navigation 대비를 함께 확인하고 발견 사항은 한 번에 수정한 뒤 최대 한 번만 재확인한다.
- **검증 경계**: fixture·로컬 Chromium 결과는 실제 API·worker·다운로드 provider, 물리 모바일 기기의 browser chrome·safe-area, 화면 낭독기 동작을 증명하지 않는다. 실제 환경을 실행하지 못했다면 각 경계를 완료로 표현하지 않는다.

## Out of Scope

- Nintendo 미니멀 플랫 정체성, 서비스 로고, Pretendard, semantic color token을 교체하는 전면 rebrand.
- Chrome 확장 프로그램 popup·YouTube overlay의 레이아웃 변경.
- API, worker, DB (Database: 데이터 저장소), R2, 다운로드·자막 생성 payload 또는 provider 동작 변경.
- 로그인, 계정, 서버 기반 사용자별 요청 소유권, 기기 간 동기화. ADR-0001의 개인 사용 단계는 유지한다.
- 요청 내역 검색·필터·페이지네이션·전체 삭제·서버 job 취소 API·batch 요청. 접수 전 브라우저 요청 중단은 이번 범위에 포함한다.
- `/settings` route 삭제, 테마 control의 헤더 복귀, 존재하지 않는 설정 범주 추가.
- `base.en`·`small.en` 모델 값이나 Whisper 처리 정책 변경.
- 검증되지 않은 처리 시간·정확도 수치, 장애 원인, 운영 URL·명령 추가.
- 실제 모바일 기기, 화면 낭독기, production provider 검증을 로컬 브라우저 결과로 대체하는 것.

## Further Notes

- 근거는 `apps/web` PRODUCT 계약, 공통 DESIGN 계약, 2026-09-03 `apps/web` Impeccable critique(28/40), 현재 route·컴포넌트 구현, 기존 Web unit/browser 테스트다.
- 이번 스펙은 기존 `.scratch/web-request-flow-hardening/` 01–17의 성과를 전제로 한다. 통합 주요 내비게이션, in-place 요청 상태, 접근 가능한 파일 picker, 처리 방식 설명, 대비·터치 높이 계약을 되돌리지 않는다.
- 새 기능 디렉터리로 분리한 이유는 기존 request-flow-hardening spec과 17개 완료 티켓의 역사적 계약을 덮어쓰지 않으면서, 이후 티켓이 레이아웃 현대화라는 하나의 독립된 목표와 완료 조건을 공유하게 하기 위함이다.
- 2026-09-03 critique 후속은 이 스펙의 이슈 06에서 C01–C09와 D01–D04로 추적했다. 구현·문서 동기화·자동 검증·bounded visual pass를 완료했으며, 실제 API·worker/provider·물리 기기·화면 낭독기·production 검증은 별도 경계로 남긴다.
