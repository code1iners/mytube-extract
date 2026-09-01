Status: ready-for-agent

# Web 요청 완료 흐름 및 접근성/품질 하드닝

## Problem Statement

`apps/web`의 `/video`·`/subtitles`는 접수 성공 즉시 항상 `/history`로 이동하는데, 그 결과 `viewPhase === 'processing'`은 mutation이 걸리는 찰나에만 나타나고 `viewPhase === 'result'`는 정상 흐름에서 절대 렌더되지 않는다. 두 페이지 모두 `downloadHref`가 빈 문자열로 하드코딩돼 있어, 형식/품질/보관기간 요약과 다운로드 CTA까지 갖춘 결과 패널이 한 번도 실사용된 적이 없다.

이 외에도 `/impeccable critique`와 `/impeccable audit` 두 차례의 검토에서 다음 문제가 확인됐다.

- 이 도구는 "동일한 한 사람이 반복해서 여는" 개인 도구(PRODUCT.md)인데, 매 세션 형식·품질·Whisper 모델 선택이 초기화되어 반복 사용의 이점이 전혀 없다.
- 제출 직후 대기/0% 진행률을 실제처럼 보여주다 안내 없이 `/history`로 튕기는 전환이 사용자를 불안하게 한다.
- 기술 오류 상세(`오류 코드`, `응답 상태`)가 완충 문구 없이 원문 그대로 노출된다.
- `hairline` 테두리(`#e0e0e0` light / `#3a3b3e` dark)가 카드·입력창·미선택 칩의 유일한 경계 표시인데, 실측 대비가 1.15~1.44:1로 WCAG 1.4.11(3:1)에 크게 못 미친다.
- `완료` 상태 텍스트 색(`#468254`)이 surface 배경 대비 4.32:1로 WCAG 1.4.3의 4.5:1 기준에 미달한다. `docs/DESIGN.md` §11이 스스로 약속한 기준을 코드가 어기고 있다.
- step-tabs(처리 단계 표시)가 `role`/`aria-current` 없는 `<span>`이라 스크린리더 사용자가 현재 단계를 알 수 없다.
- `index.html`과 `manifest.webmanifest`의 `theme-color`/`background_color`가 `#ffffff`로 고정돼, 앱이 지원하는 dark mode에서도 브라우저·PWA 크롬이 흰색으로 남는다.
- `theme-toggle`(28px, 820px 이하 breakpoint에서 26px로 더 작아짐)·`url-reset-button`(32px)·`secondary-button--compact`(34px)가 44px 터치 타깃 권장값에 못 미친다.
- Pretendard Variable 전체 weight axis(45-920)를 담은 2MB woff2 하나를 preload 없이 로드하는데, 실제 쓰는 weight는 400/600 두 개뿐이다.
- `console-grid`/`legend-bar`/`legend-item`/`legend-title` CSS가 정의만 있고 어떤 화면에서도 참조되지 않는다.

## Solution

`/video`·`/subtitles`가 `/history`의 기존 폴링 로직(`fetchHistoryJobStatus`/`getHistoryRefetchInterval`)을 공유 모듈로 재사용해 자체적으로 폴링하고, `processing`/`result`/`error` 단계까지 그 자리(in-place)에서 보여주도록 바꾼다. `/history`로의 이동은 강제가 아니라 선택 동작으로 남긴다. `downloadHref`는 실제 API 응답의 `downloadUrl`로 배선한다.

같은 브라우저의 마지막 선택(요청 형식, 품질, Whisper 모델)을 `theme-preference.util.ts`와 같은 패턴의 새 localStorage 유틸로 저장하고, 다음 방문 시 그 값을 기본 선택지로 되살린다(서버가 지원하는 고정 선택지 제약은 유지한다).

제출 직후 전환은 가짜 진행률 UI 대신 짧은 "접수 중" 상태만 보여주고, 접수 완료 시 이 화면 안에서 자연스럽게 processing 단계로 이어지게 한다. 오류 상세 disclosure 상단에는 평이한 한 줄 요약을 추가해, 기술 블록(`오류 코드`/`응답 상태`/`응답 내용`)이 진짜 "선택적 심화 정보"가 되게 한다.

토큰 조정: `--hairline-light`/`--hairline-dark`를 인접 배경 대비 3:1 이상이 되는 값으로, `--green-700`(완료 상태색)을 surface 배경 대비 4.5:1 이상이 되는 값으로 각각 다시 정한다. `docs/DESIGN.md`의 Color 표와 YAML frontmatter, `.impeccable/design.json` 사이드카를 새 값으로 동기화한다(현재 frontmatter의 `#468254`와 본문 표의 `#356b43`이 서로 다른 상태이므로, 이번에 하나의 검증된 값으로 통일한다).

step-tabs에 `aria-current="step"`(선택 시)을 추가한다. `index.html`에 `prefers-color-scheme: dark`용 두 번째 `theme-color` meta를 추가한다. `theme-toggle`/`url-reset-button`/`secondary-button--compact`를 44px 이상으로 키우고, `theme-toggle`이 좁은 뷰포트에서 더 작아지지 않게 한다. Pretendard 폰트를 400/600 weight만 담은 정적 subset으로 교체하거나 최소한 `<link rel="preload">`를 추가한다. `console-grid`/`legend-bar` 계열 미사용 CSS를 제거한다.

시각 정체성(Nintendo 미니멀 플랫, 토큰 구조, 3-route 구성)은 바꾸지 않는다 — 이번 작업은 기존 정체성 안에서의 하드닝이지 재설계가 아니다.

## User Stories

1. As a Web 앱 사용자, I want `/video`에서 접수한 요청이 완료되면 그 화면에서 바로 결과(형식/품질/보관기간 요약 + 다운로드 버튼)를 보고 싶다, so that 방금 연 화면을 벗어나지 않고 파일을 받을 수 있다.
2. As a Web 앱 사용자, I want `/subtitles`에서 접수한 요청이 완료되면 그 화면에서 바로 SRT 다운로드 결과를 보고 싶다, so that 자막 생성 흐름도 영상 추출과 동일하게 일관되게 동작한다.
3. As a Web 앱 사용자, I want 요청이 처리 중일 때 `/video`·`/subtitles`가 그 자리에서 실제 진행 상태를 보여주기를 원한다, so that 실제로 존재하지 않는 화면(현재의 죽은 processing 분기)이 아니라 진짜 상태를 확인할 수 있다.
4. As a Web 앱 사용자, I want 요청이 실패하거나 만료됐을 때도 그 화면에서 바로 오류와 재요청 경로를 보고 싶다, so that `/history`로 이동하지 않아도 다음 행동을 알 수 있다.
5. As a Web 앱 사용자, I want 원한다면 여전히 `/history`로 이동해 모든 요청 이력을 확인할 수 있기를 원한다, so that 과거 요청들을 한 곳에서 훑어볼 수 있다.
6. As a Web 앱 사용자, I want 완료된 요청의 다운로드 버튼이 실제 유효한 파일 URL을 가리키기를 원한다, so that 빈 링크를 누르는 일이 없다.
7. As a 반복 방문자, I want 지난번에 고른 형식(오디오/비디오)이 다음 방문에도 기본 선택돼 있기를 원한다, so that 매번 같은 클릭을 반복하지 않는다.
8. As a 반복 방문자, I want 지난번에 고른 품질(비트레이트/해상도)이 다음 방문에도 기본 선택돼 있기를 원한다, so that 항상 같은 품질을 쓰는 경우 매번 다시 고르지 않는다.
9. As a 자막 기능 반복 사용자, I want 지난번에 고른 Whisper 모델(빠름/정확도)이 다음 방문에도 기본 선택돼 있기를 원한다, so that 선호하는 속도-정확도 절충안을 매번 다시 정하지 않는다.
10. As a Web 앱 사용자, I want 서버가 지원하지 않는 값이 기본값으로 복원되지 않기를 원한다, so that 저장된 선호값이 깨진 요청을 만들지 않는다.
11. As a Web 앱 사용자, I want 요청을 제출한 직후 실제 상태가 아닌 가짜 진행률 화면을 보고 싶지 않다, so that 접수 확인과 실제 처리 상태를 혼동하지 않는다.
12. As a Web 앱 사용자, I want 제출 직후 짧은 "접수 중" 표시만 보고 곧바로 실제 처리 상태로 자연스럽게 이어지기를 원한다, so that 전환이 매끄럽고 안심할 수 있다.
13. As a Web 앱 사용자, I want 오류 상세를 열기 전에 평이한 한 줄 요약을 먼저 보고 싶다, so that 기술적인 오류 코드를 이해하지 못해도 무슨 일이 있었는지 알 수 있다.
14. As a Web 앱 사용자, I want 오류 코드·응답 상태 같은 기술적 세부 정보는 원한다면 펼쳐서 볼 수 있기를 원한다, so that 필요할 때는 디버깅에 필요한 정보를 계속 확인할 수 있다.
15. As a 저시력 사용자, I want 카드·입력창·미선택 칩의 경계가 배경과 충분히 구분되는 대비로 보이기를 원한다, so that 어디까지가 하나의 인터랙티브 요소인지 알 수 있다.
16. As a 저시력 사용자, I want light와 dark 테마 모두에서 카드·입력창의 경계가 잘 보이기를 원한다, so that 테마 선택과 무관하게 동일한 사용성을 얻는다.
17. As a 저시력 사용자, I want `완료` 상태 텍스트 색이 배경과 충분한 대비를 가지기를 원한다, so that 완료 여부를 색으로도 정확히 구분할 수 있다.
18. As a 스크린리더 사용자, I want 처리 단계 표시(step-tabs)에서 현재 어느 단계인지 음성으로 안내받고 싶다, so that 화면을 보지 않고도 진행 상황을 알 수 있다.
19. As a dark mode 사용자, I want 브라우저 주소창이나 PWA 실행 화면의 시스템 UI 색이 앱의 dark 테마와 맞기를 원한다, so that 갑작스러운 흰색 화면에 눈이 부시지 않는다.
20. As a 모바일 사용자, I want 테마 전환·URL 지우기·재시도 같은 작은 버튼도 손가락으로 편하게 누를 수 있는 크기이기를 원한다, so that 오탭 없이 원하는 동작을 할 수 있다.
21. As a 모바일 사용자, I want 좁은 화면에서 테마 전환 버튼이 오히려 더 작아지지 않기를 원한다, so that 화면이 좁아질수록 터치가 더 어려워지는 일이 없다.
22. As a Web 앱 사용자, I want 페이지가 더 빠르게 뜨기를 원한다, so that 2MB 폰트 하나 때문에 첫 렌더가 늦어지지 않는다.
23. As a 유지보수자, I want 실제로 쓰이지 않는 CSS(`console-grid`, `legend-bar` 등)가 코드베이스에 남아 있지 않기를 원한다, so that 살아있는 레이아웃으로 오인하거나 삭제를 주저하지 않는다.
24. As a 유지보수자, I want `docs/DESIGN.md`의 Color 표·YAML frontmatter·`.impeccable/design.json` 사이드카가 실제 코드 토큰 값과 정확히 일치하기를 원한다, so that 디자인 문서를 신뢰하고 다음 작업의 근거로 쓸 수 있다.
25. As a Web 앱 사용자, I want 이번 하드닝 작업 이후에도 기존 요청 폼·요청 이력·상태색 규율(brand red는 액션에만) 같은 기존 동작이 그대로 유지되기를 원한다, so that 익숙한 흐름이 갑자기 바뀌지 않는다.

## Implementation Decisions

- **공유 폴링 모듈**: `apps/web/src/app/pages/request-history/request-history.logic.ts`의 `fetchHistoryJobStatus`/`getHistoryRefetchInterval`(및 관련 타입)을 `/video`·`/subtitles`·`/history` 세 곳이 공유하는 모듈로 승격한다. `/video`·`/subtitles`의 훅(`use-video-extract-logic.ts`, `use-subtitles-extract-logic.ts`)이 이 모듈로 자체 job 상태를 폴링하도록 바꾼다.
- **view-phase 분기 정정**: `use-video-extract-logic.ts`/`use-subtitles-extract-logic.ts`가 `getExtractViewPhase`에 항상 `status: null`을 넘기던 부분을 실제 폴링된 job status로 교체한다. `downloadHref`를 실제 job 응답의 `downloadUrl`로 배선한다. `getExtractViewPhase` 자체의 상태 머신(요청/처리/결과/오류 네 단계)은 이미 올바르므로 그대로 재사용한다.
- **`/history` 이동은 선택 동작으로 유지**: 접수 성공 시 강제 `navigate('/history?...')`를 제거하고, 요청 내역 링크나 사용자의 명시적 동작으로만 이동하게 한다. `/history`의 기존 폴링·상태 표시 로직 자체는 바꾸지 않는다.
- **선호 기억 유틸**: `apps/web/src/app/utils/theme-preference.util.ts`와 같은 패턴(순수 함수 + localStorage read/write, SSR-safe 가드)으로 새 유틸(예: 요청 draft 선호 저장)을 추가한다. 저장 대상은 형식(오디오/비디오), 품질, Whisper 모델뿐이며 URL·파일명 등 PRODUCT.md가 명시적으로 "미저장" 대상이라 규정한 값은 저장하지 않는다. 저장된 값이 서버가 지원하는 고정 선택지 밖이면 기본값으로 안전하게 되돌아간다.
- **제출 직후 전환**: 접수(mutation) 진행 중에는 기존 `processing` step-tabs/progress-meter를 재사용하지 않고 별도의 경량 "접수 중" 표시를 쓴다. job 생성 응답을 받으면 같은 화면 안에서 실제 폴링 기반 `processing` 상태로 자연스럽게 전환한다.
- **오류 상세 요약 줄**: `apps/web/src/app/components/error-details-disclosure.tsx`에 평이한 한 줄 요약 prop/슬롯을 추가하고, `오류 코드`/`응답 상태`/`응답 내용` 블록은 그 아래 접이식으로 유지한다.
- **토큰 재계산**: `apps/web/src/styles/global.css`의 `--hairline-light`/`--hairline-dark`, `--green-700`을 WCAG 계산으로 검증된 새 값으로 교체한다. `docs/DESIGN.md`의 Color 표·YAML frontmatter, `.impeccable/design.json`의 `colorMeta`/`tonalRamp`를 같은 값으로 재동기화한다(기존 frontmatter `#468254` vs 본문 표 `#356b43` 불일치를 이번에 하나로 통일).
- **step-tabs 마크업**: `video-extract/page.tsx`·`subtitles-extract/page.tsx`의 step-tab `<span>`에 선택 시 `aria-current="step"`을 추가한다.
- **theme-color 대응**: `apps/web/index.html`에 `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="...">`를 기존 light 메타 옆에 추가한다. `manifest.webmanifest`는 정적 파일 한계상 이번 범위에서는 손대지 않는다(Out of Scope 참고).
- **터치 타깃**: `.theme-toggle__option span`, `.url-reset-button`, `.secondary-button--compact`의 `min-height`를 44px 이상으로 올리고, 820px 이하 breakpoint에서 `.theme-toggle__option span`을 축소하던 규칙을 제거한다.
- **폰트**: Pretendard Variable 2MB 파일을 400/600 정적 subset 2개로 교체하거나(용량 우선) `<link rel="preload">`를 추가한다(구현 시점에 실제 subset 파일 확보 가능 여부에 따라 결정 — 확보 불가하면 preload만 적용).
- **미사용 CSS 제거**: `global.css`의 `.console-grid`, `.legend-bar`, `.legend-item`, `.legend-title` 규칙을 삭제한다.

## Testing Decisions

좋은 테스트는 내부 구현이 아니라 사용자가 보는 동작(어떤 화면 단계가 렌더되는지, 어떤 마크업 속성이 나오는지)을 검증한다. 기존 관례를 그대로 재사용하며 새 seam은 만들지 않는다.

- **순수 함수 unit test** (`apps/web/tests/unit/`, vitest): `extract-view-phase.test.ts`처럼 `getExtractViewPhase`가 실제 폴링 상태를 받았을 때 올바른 단계를 반환하는지 검증한다. 새 선호-기억 유틸은 `theme-preference.test.ts`와 같은 패턴으로 저장/복원/유효하지 않은 값 폴백을 검증한다. 승격된 공유 폴링 모듈은 `request-history.test.ts`가 이미 검증하는 동작(재시도 간격, terminal 상태에서 polling 중단)을 그대로 재사용·확장한다.
- **마크업 단언 test** (`app-hero.test.tsx` 패턴, `renderToStaticMarkup`): step-tabs의 `aria-current` 출력, 오류 상세 요약 줄의 존재, in-place result/error 패널이 실제로 렌더되는지를 문자열 단언으로 검증한다.
- **CSS·자산 전용 변경은 자동화 테스트 없음**: hairline/완료색 대비, 터치 타깃 크기, `theme-color` 메타, 폰트 subset/preload, 미사용 CSS 제거는 로직이 없어 vitest seam이 성립하지 않는다. `/impeccable audit apps/web` 재실행으로 대비 수치와 터치 타깃을 재확인하는 것을 검증 루프로 삼는다.
- **기존 테스트 회귀 없음 확인**: `pnpm --filter web run lint`, `pnpm --filter web run test`가 계속 통과해야 한다.

## Out of Scope

- Nintendo 미니멀 플랫 시각 정체성의 교체(재설계) — 사용자가 명시적으로 "지금 정체성 유지"를 선택했다.
- Chrome 확장 프로그램(`apps/chrome-extension`) 변경 — 별도 표면이며 이번 스펙 범위 밖.
- 계정·로그인·다중 사용자 지원 (ADR-0001, 공개 서비스 전환 전까지 유지).
- `manifest.webmanifest`의 `theme_color`/`background_color` dark 대응 — 정적 매니페스트 한계로 이번 범위에서는 `index.html`의 meta 태그 대응만 한다.
- 자동 브라우저 스크린샷/시각 회귀 테스트 도입 — CSS·자산 전용 변경은 `/impeccable audit` 재실행으로 검증하고 새 CI 테스트 seam을 만들지 않는다.
- `/history`의 검색·필터·페이지네이션·전체 삭제·작업 취소 — 기존 PRODUCT.md가 명시적으로 범위 밖이라 규정한 항목.

## Further Notes

- 근거 문서: `apps/web/PRODUCT.md`, `docs/DESIGN.md`(YAML frontmatter + `.impeccable/design.json` 포함), `.impeccable/critique/2026-08-31T13-21-07Z__apps-web.md`(critique 30/40), 같은 세션의 `/impeccable audit apps/web` 실행 결과(15/20).
- `docs/DESIGN.md`의 Color 표(`#356b43`)와 YAML frontmatter(`#468254`)가 이미 서로 다른 값을 갖고 있던 상태였다 — 이번 작업에서 실제 WCAG 검증을 거친 하나의 값으로 통일하는 것이 목적이지, 기존 값 중 하나를 그대로 승격하는 것이 아니다.
- 이 스펙은 `/impeccable shape apps/web`에서 정리된 브리프(P0: in-place completion 방향 채택)를 기반으로 하며, 구현은 harden → onboard → clarify → adapt → optimize → distill → polish 순서를 따르는 것을 권장하되 티켓 분해·실행 순서는 구현 담당자가 정한다.
