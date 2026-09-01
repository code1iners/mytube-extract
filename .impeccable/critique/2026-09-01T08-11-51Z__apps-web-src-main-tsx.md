---
target: apps/web
total_score: 24
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
timestamp: 2026-09-01T08-11-51Z
slug: apps-web-src-main-tsx
---
Method: dual-agent (A: /root/assessment_a · B: /root/assessment_b)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3 | 요청 단계와 진행률은 명확하지만, API/worker 실패 원인과 마지막 확인 시각은 전면에 드러나지 않는다. |
| 2 | Match System / Real World | 3 | URL·MP3·MP4는 자연스럽지만 `Whisper`, `SRT`, `R2` 같은 기술어가 설명 없이 노출된다. |
| 3 | User Control and Freedom | 2 | 리셋·지우기·재시도는 있으나, 진행 중 취소와 내역 삭제 undo가 없다. |
| 4 | Consistency and Standards | 3 | 토큰과 컴포넌트는 일관되지만 `자막 추출`·`영어 SRT 생성`·`자막 생성` 용어가 갈린다. |
| 5 | Error Prevention | 2 | 입력 제약과 health 사전 확인은 좋지만, 삭제 복구가 없고 서비스 비가용 안내가 늦다. |
| 6 | Recognition Rather Than Recall | 3 | 라벨·선택·이력은 잘 보이지만 실패·만료 재요청 때 원 URL을 다시 찾아야 한다. |
| 7 | Flexibility and Efficiency | 1 | 반복 사용자를 위한 단축키·빠른 붙여넣기·반복 요청 가속 경로가 없다. |
| 8 | Aesthetic and Minimalist Design | 3 | 정돈된 화면이지만 3-way 테마와 분리된 하단 탭이 기능 중요도보다 큰 공간을 차지한다. |
| 9 | Error Recovery | 3 | 재확인·설정 복귀·오류 상세는 좋지만 운영자 관점의 health 진단 정보가 부족하다. |
| 10 | Help and Documentation | 1 | 모델 선택 기준, 브라우저 한정 이력, 7일 보관 등 결정 시점의 도움말이 부족하다. |
| **Total** |  | **24/40** | **Acceptable — 기본기는 좋지만 의미 있는 개선이 필요하다.** |

## Design Specificity Verdict

### LLM assessment

**부분 특화됐지만 구조는 category-interchangeable하다.** MyTube Extract 전용 아이콘, Nintendo red, 영상·자막 형식, 품질 선택, 작업 단계는 제품 맥락과 맞는다. 하지만 핵심 구도는 `브랜드 헤더 + 회색 설정 카드 + segmented controls + 전폭 CTA + 고정 하단 탭`으로, 로고와 문구를 바꾸면 다른 파일 변환기나 AI 유틸리티에도 그대로 쓸 수 있다.

가장 큰 미사용 자산은 제품의 실제 작업 모델이다. 자체 호스팅 API/worker 상태, 로컬 Whisper 처리, 브라우저 한정 이력, 완료 파일 7일 보관이 제품을 구별하지만 첫 화면의 구조와 위계에는 거의 드러나지 않는다. 현재는 이 핵심 상태보다 테마 선택기가 상단에서 더 큰 시각적 비중을 가진다.

인지 부하는 **중간 수준(8개 체크 중 3개 실패)**이다. 실패 항목은 visual hierarchy, minimal choices, working memory다. 공통 shell만 해도 요청 내역 1개, 테마 3개, 작업 탭 2개로 6개 선택지가 상시 노출된다. 폼 grouping은 좋아 실제 문제는 과도한 폼 복잡성보다 불필요한 상시 chrome에 가깝다.

감정 흐름은 입장과 완료에서 안정적이지만, 서비스 비가용 상태가 폼 끝에서 드러나는 지점이 가장 큰 골짜기다. 사용자는 URL·품질 또는 파일·모델을 검토한 뒤에야 지금 요청할 수 없다는 사실을 발견한다. 처리 중에는 단계와 진행률이 안심을 주지만, route 잠금과 취소 부재는 긴 작업에서 통제 상실을 만든다.

### Deterministic scan

`node /Users/wraith/.agents/skills/impeccable/scripts/detect.mjs --json apps/web/src`는 종료 코드 0과 `[]`를 반환했다. 총 finding 0건, rule별 count `{}`, 파일·라인 및 false positive도 없다. 즉 번들 detector가 다루는 기계적 anti-pattern은 발견되지 않았다.

다만 detector clean은 디자인·접근성 전체의 clean을 의미하지 않는다. 실제 리뷰에서는 `apps/web/src/styles/global.css`의 다크 선택 상태 대비와 `apps/web/src/app/pages/subtitles-extract/page.tsx`의 숨은 file input 포커스처럼 의미론·상호작용 맥락이 필요한 문제가 추가로 발견됐다.

### Visual overlays

사용자에게 보이는 overlay는 없다. 브라우저의 mutable injection preflight가 `TypeError: Cannot set property title of [object Object] which has only a getter`로 실패해 `detect.js`를 주입하지 않았고 `[Human]` 탭도 노출하지 않았다. 대체 근거로 `/video`, `/subtitles`, `/history`의 새 탭 스크린샷·DOM snapshot·console·viewport 측정을 사용했다. 세 route 모두 1280px에서 `scrollWidth === clientWidth`였고 수평 overflow나 console warning/error는 없었다.

## Overall Impression

기능 상태 모델과 입력 제약은 신뢰할 만하고, 시각 시스템도 이미 한 제품처럼 정돈돼 있다. 그러나 이 화면의 가장 중요한 질문인 **“worker가 지금 요청을 받을 수 있는가?”**가 테마와 폼 뒤에 숨어 있다. 다음 개선은 장식을 더하는 일이 아니라 운영 상태·작업 route·이력의 정보 구조를 하나로 정렬하는 일이어야 한다.

## What's Working

- 요청·접수·처리·완료·오류를 단일 phase로 분리해 사용자가 현재 상태를 이해하기 쉽다. 진행률, 상태색+텍스트, 재시도, 오류 상세도 같은 모델을 공유한다.
- MP3/MP4, 고정 품질, 허용 파일 형식, 두 Whisper 모델만 노출해 서버가 지원하지 않는 입력을 예방한다.
- 1280px 실제 렌더링과 390px·320px 독립 검토에서 수평 넘침 없이 구조가 유지됐다. heading, fieldset/legend, `aria-current`, live region, 44~48px touch target도 대체로 잘 갖춰져 있다.

## Priority Issues

### [P1] 다크 선택 상태와 파일 선택 control이 접근성 계약을 위반한다

**Why it matters**: 다크 모드에서 Nintendo red 텍스트와 `#292a2d` 배경의 대비는 약 2.99:1로, 16px 텍스트의 WCAG AA 4.5:1 기준에 못 미친다. 숨긴 file input은 1×1px·opacity 0이지만 tab 대상과 영문 `Choose File` 접근성 노드로 남아, 보이지 않는 포커스와 한국어 dropzone 중복을 만든다.

**Fix**: 선택 상태의 red는 border/icon에만 쓰고 라벨은 대비가 확보된 text token을 사용한다. file picker는 visible button 또는 label 하나가 접근 가능한 control을 소유하도록 통합하고, 한국어 accessible name과 visible focus를 제공한다.

**Suggested command**: `$impeccable audit apps/web`

### [P1] 서비스 비가용 상태가 사용자의 작업 뒤에 나타난다

**Why it matters**: `/video`와 `/subtitles`에서 CTA는 disabled지만 이유는 폼 맨 아래 notice를 읽어야 알 수 있다. 자체 호스팅 운영 도구에서 API/worker 준비 여부는 모든 입력보다 앞선 선행 조건이다.

**Fix**: panel title 바로 아래에 `API 연결됨 · Worker 중단됨 · 마지막 확인 14:32` 형식의 compact health row를 둔다. 비가용이면 `다시 확인`과 진단 정보를 먼저 제공하고, CTA 옆에도 disabled 이유를 반복한다.

**Suggested command**: `$impeccable harden apps/web`

### [P2] 내비게이션과 설정 chrome이 세 방향으로 갈라진다

**Why it matters**: 요청 내역은 header, 작업 route는 화면 최하단, 테마는 header의 3개 버튼에 있다. 데스크톱에서는 전폭 하단 바가 760px workspace와 분리되고, 모바일에서는 테마가 작업보다 먼저 한 행을 차지한다.

**Fix**: `영상 · 자막 · 내역`을 하나의 primary navigation level로 통합한다. 모바일은 하단 3탭, 데스크톱은 content-width header tabs를 사용한다. 테마는 system default를 유지하고 compact settings/menu로 접는다.

**Suggested command**: `$impeccable distill apps/web`

### [P2] 자막 모델 선택이 기술어와 모호한 tradeoff에 의존한다

**Why it matters**: `Whisper 모델`, `빠름`, `정확도`만으로는 처리 시간·품질·로컬 실행 여부를 판단하기 어렵고, 첫 사용자는 정확도 옵션이 항상 더 낫다고 해석할 수 있다.

**Fix**: legend를 `처리 방식`으로 바꾸고 `속도 우선 — base.en`, `정확도 우선 — small.en`처럼 모델명을 보조 정보로 내린다. 상대 속도와 `영어 전용 · 로컬 처리`를 한 문장으로 설명한다.

**Suggested command**: `$impeccable clarify apps/web/src/app/pages/subtitles-extract/page.tsx`

### [P2] 빈 이력과 첫 화면이 제품 고유 작업 모델을 가르치지 않는다

**Why it matters**: `/history` 빈 상태는 영상 CTA만 제공하고, 이력이 이 브라우저에만 남으며 결과가 7일 보관된다는 중요한 규칙을 행동 맥락에 연결하지 않는다.

**Fix**: 빈 상태에 `YouTube URL → 영상/오디오 추출`과 `로컬 영상 → 영어 SRT` 두 진입점을 둔다. `이력은 이 브라우저에만 저장 · 완료 파일은 7일 보관`을 짧은 운영 메모로 보여준다.

**Suggested command**: `$impeccable onboard apps/web/src/app/pages/request-history/page.tsx`

## Persona Red Flags

### Jordan — First-Timer

- `/video`와 `/subtitles` 모두 작업 불가 notice가 폼 끝에 있어 입력을 이해한 뒤에야 현재 요청할 수 없음을 알게 된다.
- `Whisper 모델`, `빠름`, `정확도`에는 기본값의 이유와 실제 tradeoff 설명이 없다.
- 320px에서는 `MyTube Extract` wordmark가 사라져 첫 사용자의 제품 인지가 약해진다.
- `/history` 빈 상태는 영상 경로만 직접 안내한다.

### Sam — Accessibility-dependent

- 숨은 file input이 영문 `Choose File`로 노출되고, 한국어 dropzone과 중복된다.
- 해당 input은 보이지 않지만 tab focus를 받을 수 있다.
- 다크 선택 상태의 red-on-dark 대비가 약 2.99:1로 일반 텍스트 기준에 미달한다.
- heading·fieldset·live region 등 구조는 긍정적이지만 VoiceOver/NVDA 전체 흐름과 200% text resize는 아직 검증되지 않았다.

### Casey — Distracted Mobile User

- 하단 작업 탭과 44~48px target은 한 손 조작에 유리하다.
- 390px·320px에서 테마 3버튼과 큰 dropzone이 health 오류보다 먼저 보여 작업 불가를 늦게 발견한다.
- 탭 이탈이나 새로고침 뒤 URL draft와 선택 상태 복원 안내가 없어 중단 후 복귀가 약하다.

## Minor Observations

- 자막 단계는 4개인데 `.subtitle-step-tabs`의 데스크톱 grid는 5열이라 처리 화면에 빈 열이 남는다.
- 320px에서는 URL placeholder가 reset 버튼 때문에 중간에서 잘려 예시 가치가 낮아진다.
- header 테마 라벨 12px는 DESIGN.md의 nav/caption 14px보다 작다.
- 데스크톱 빈 이력 화면은 카드 아래 무목적 여백과 viewport 전폭 하단 탭 때문에 composition이 느슨하다.
- `영상 요청하기`, `영상 추출`, `추출 요청`의 용어를 통일할 필요가 있다.
- history item 삭제 뒤 focus 복구는 좋지만 즉시 삭제에 대한 undo가 없다.

## Questions to Consider

- 이 제품의 유일한 운영자에게 매 세션 가장 먼저 보여야 하는 것은 테마인가, worker 준비 상태인가?
- 요청 내역이 세 번째 primary workflow라면 왜 영상·자막과 같은 navigation level에 있지 않은가?
- 로고와 Nintendo red를 제거해도 이 화면이 MyTube Extract임을 알아볼 수 있는 고유 구조가 남는가?
- 서비스가 꺼져 있을 때 전체 폼을 정상 화면처럼 보여줄 것인가, 운영 상태 복구를 먼저 보여줄 것인가?
- privacy를 유지하면서 실패·만료 재요청의 원 URL 회상 부담을 어디까지 줄일 수 있는가?
