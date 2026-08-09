# MyTube Extract Design System

## 1. 목적과 범위

MyTube Extract의 Web과 Chrome 확장 popup에 공통 적용하는 Foundation이다.

범위는 color, typography, spacing, radius, elevation, theme·mode, 접근성, 플랫폼 mapping과 Web·popup 상태 화면 적용이다. 컴포넌트 API와 Figma는 포함하지 않는다.

## 2. 브랜드 입력과 디자인 원칙

- 입력 문서: Nintendo Design System (live-extract, 확인일 2026-06-17)
- **Nintendo red(`#e60012`)를 유일 액션 색**으로 쓴다 — primary CTA, 인라인 링크, 브랜드 포인트에만. 상태 표시에는 쓰지 않는다.
- 순검정 대신 웜 다크그레이 잉크를 쓴다.
- 근무영(whisper-soft) shadow와 hairline으로 분리한다. 두꺼운 테두리·하드 드롭섀도는 쓰지 않는다.
- 12px 카드, 8px 버튼, 48px pill, 20px 유틸리티 pill의 둥근 기하를 쓴다.
- `Pretendard Variable` 단일 패밀리를 쓴다. weight 600은 heading, 400은 body를 담당한다.
- 이미지·콘텐츠가 시각적 에너지를 담당하고 UI 크롬은 차분하게 유지한다.

## 3. 대상 플랫폼과 공통 규칙

- 대상: Vite Web, Chrome MV3 popup.
- 공통 단위: CSS `px`.
- 공통 token 의미를 먼저 정의하고, 플랫폼 구현은 semantic token을 참조한다.
- 첫 방문 theme는 OS 설정을 따른다. 사용자가 바꾸면 선택을 유지한다.

## 4. Token 구조와 명명 원칙

두 계층을 사용한다.

- Primitive: `red-700`, `ink-light`, `green-700`처럼 값 자체를 나타낸다.
- Semantic: `color-action-primary`, `color-surface-default`, `color-text-primary`처럼 UI 역할을 나타낸다.

화면·컴포넌트는 semantic token만 사용한다. primitive를 직접 참조하지 않는다.

## 5. Color

### Primitive

| Family | Light | Dark |
| --- | --- | --- |
| Nintendo Red | `#e60012` | `#e60012` (테마 불문 동일 — 브랜드 불변성 원칙) |
| Ink | `#484848` | `#f2f0ee` |
| Muted | `#727272` | `#b3b0ac` |
| Disabled | `#c8c8c8` | `#5c5955` |
| Canvas | `#ffffff` | `#18191b` |
| Surface | `#f8f8f8` | `#202124` |
| Surface-alt | `#efefef` | `#292a2d` |
| Hairline | `#e0e0e0` | `#3a3b3e` |
| Green(eShop) | `#468254` | `#8fd6a0` |
| Blue(accent) | `#4b5cce` | `#a9b4f2` |
| Danger(브랜드 red와 구분되는 별도 오류색) | `#c62828` | `#ff8a80` |

Dark 열의 값은 Nintendo 원본 문서에 없는 목표값이다. 웜그레이 잉크, 근무영 shadow, 불변 red 원칙을 역산해 새로 정했다.

### Semantic

| 역할 | Light | Dark |
| --- | --- | --- |
| Canvas | `#ffffff` | `#18191b` |
| Surface | `#f8f8f8` | `#202124` |
| Surface-alt | `#efefef` | `#292a2d` |
| Text primary | `#484848` | `#f2f0ee` |
| Text secondary(muted) | `#727272` | `#b3b0ac` |
| Text disabled | `#c8c8c8` | `#5c5955` |
| Hairline / border | `#e0e0e0` | `#3a3b3e` |
| Action-primary / on-primary | `#e60012` / `#ffffff` | `#e60012` / `#ffffff` |
| Focus ring | `#4b5cce` | `#a9b4f2` |

### 상태 색 (요청 대기·처리중·완료·실패·만료)

brand red는 상태 표시에 쓰지 않는다.

| 상태 | 색 | 근거 |
| --- | --- | --- |
| 대기(queued) | muted grey | 아직 행동이 없는 상태 |
| 처리중(processing) | blue accent | Nintendo 보조 섹션 테마 |
| 완료(completed) | green(eShop) | Nintendo 커머스/가용성 accent |
| 실패(failed) | danger(별도 crimson) | brand red와 시각적으로 구분되는 별도 계열 |
| 만료(expired) | disabled grey | 대기보다 더 비활성화된 느낌 |

status는 색과 함께 텍스트·아이콘으로 전달한다. 색만으로 상태를 전달하지 않는다.

## 6. Typography

- Font family: `Pretendard Variable`, system sans-serif fallback.
- weight 600은 heading, 400은 body를 담당한다.

| 역할 | Size | Weight | Line-height | 비고 |
| --- | --- | --- | --- | --- |
| Display (H2) | 28px | 600 | 1.35 | 섹션/기능 헤드라인 |
| Subheading (H2) | 21px | 600 | 1.40 | 카드/패널 헤드 |
| Label | 16px | 600 | 1.40 | 섹션 라벨, nav |
| Body | 16px | 400 | 1.6 | 표준 본문(한글 밀도 절충값, 목표값) |
| Button | 18px | 600 | 1.00 | Primary CTA 라벨 |
| Nav | 14px | 600 | 1.00 | 상단 nav 항목 |
| Caption | 14px | 400 | 1.40 | 입력 필드, 작은 라벨 |

Body line-height `1.6`은 Nintendo 원본에 없는 목표값이다. 한글 밀도는 US(1.4)보다 여유가 필요하지만 JP(2.0)만큼은 아니라고 판단해 절충했다.

## 7. Spacing

공통 scale은 `4, 8, 12, 16, 24, 32, 48px`다. 임의의 중간값을 추가하지 않는다. `48`은 pill 높이·큰 CTA 여백에 사용한다.

## 8. Radius

- Extra-small(`2px`): 작은 내부 detail
- Small(`4px`): 작은 컨테이너, 인라인 chip
- Medium(`8px`): primary 버튼
- Large(`12px`): 카드 — 워크호스
- Pill(`48px`): 유틸리티 pill
- Full(`9999px`): 상태 pill, 원형 아이콘

## 9. Elevation

| Level | 처리 | 용도 |
| --- | --- | --- |
| Flat | shadow 없음 | 페이지 배경, 대부분 표면 |
| Tint | surface 배경 전환 | 카드/섹션 구분 |
| Hairline | `1px solid var(--color-border)` | 카드 외곽선, 구분선 |
| Soft | `rgba(0,0,0,0.07) 0px 2px 8px` | 표준 카드 |
| Card | `rgba(72,72,72,0.15) 0px 4px 16px` | 강조 카드(예: 완료 결과 패널) |

두꺼운 테두리(2px)와 픽셀 하드 드롭섀도는 쓰지 않는다. 대부분의 분리는 flat tint와 hairline으로 한다.

## 10. Theme과 Mode

- light와 dark를 모두 제공한다.
- 최초 theme는 OS preference를 따른다.
- 사용자가 선택한 theme는 이후에도 유지한다.
- Nintendo red는 두 테마에서 동일 값을 유지한다(브랜드 불변성). 그 외 surface·ink만 반전한다.
- theme 전환은 semantic token의 값만 바꾸며, 구조·spacing·radius·elevation은 바꾸지 않는다.

## 11. 접근성

- 일반 텍스트는 최소 `4.5:1`, 큰 텍스트는 최소 `3:1` 대비를 충족한다.
- UI 경계·focus indicator는 인접 색상과 최소 `3:1` 대비를 충족한다.
- 상태는 색과 함께 텍스트·아이콘으로 전달한다.
- keyboard focus는 blue accent outline으로 명확히 표시한다. red는 focus에 쓰지 않아 액션 신호와 분리한다.
- 200% text resize와 키보드 조작을 Web·popup 모두에서 검증한다.

## 12. 플랫폼 Mapping

- Web과 Chrome popup은 CSS `px`와 같은 semantic token 의미를 사용한다.
- Web은 responsive viewport와 browser zoom을 지원한다.
- Web의 헤더·본문·하단 탭은 `760px` 공통 최대 폭 안에서 같은 반응형 좌우 여백과 가용 폭 `100%`를 사용한다.
- popup은 현재 360px 폭 제약 안에서 같은 spacing·type·color 규칙을 축소 적용한다. 12px 카드 radius와 8px 버튼 radius는 360px 폭에서 실제 렌더링으로 확인했으며 밀도 문제가 없다(확인일 2026-08-08).
- iOS·Android·desktop native mapping은 현재 대상이 아니므로 정의하지 않는다.

## 현재 상태와 목표 상태

| 항목 | 현재 | 목표 |
| --- | --- | --- |
| 정체성 | 픽셀 콘솔 레트로 게임(굵은 테두리, 하드 드롭섀도, LanaPixel) | Nintendo식 미니멀 플랫 |
| Color | violet/teal/amber 3색 액션 체계 | Nintendo red 단일 액션 + 중립 상태색(grey/blue/green/danger) |
| Font | LanaPixel 도트 폰트 | Pretendard Variable |
| Border/Shadow | 2px 굵은 테두리 + 하드 드롭섀도(`0 3px 0`, `0 5px 0`) | hairline + whisper-soft shadow |
| Radius | 2~4px 고정 | 2~12px + pill(48px/9999px) |
| Dark mode | violet/teal 역전 | ink/surface 반전, red는 불변 |
| 상태 화면 | 요청·처리 상태가 동시에 보임 | 요청 전 설정만, 요청 후 처리·결과·오류 단일 화면(유지) |

## 열린 결정

- "MyTube Extract" 텍스트 wordmark의 자간·최소 크기·안전 여백 규칙(로고 아이콘 자체는 아래 확정)

## 브랜드 마크

- 서비스 로고 아이콘: Nintendo red(`#e60012`) 배경 rounded square(radius `112/512`) 위에 흰색 추출(다운로드 화살표) 글리프. YouTube 로고(빨간 라운드 사각형 + 흰 재생 삼각형)와 혼동되지 않도록 재생 삼각형 대신 추출 화살표 모양을 사용했다.
- 원본: `apps/web/public/mytube-extract-icon.svg` — Web favicon·PWA manifest 아이콘, Chrome 확장 `icon-16/48/128.png`가 모두 이 SVG에서 생성된다.
- 헤더의 `AppMark`(outline 사각형 + accent) 컴포넌트는 앱 내부 UI 전용 마크로 유지하고, 파비콘·확장 아이콘 같은 작은 정사각형 자산은 위 solid 버전을 쓴다.

## 조사 출처

- Nintendo Design System 브랜드 문서(live-extract), 확인일: 2026-06-17
- MyTube Extract 현재 구현(`apps/web/src/styles/global.css`, 이전 `docs/DESIGN.md`), 확인일: 2026-08-08
- [WCAG 2.2 Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), 확인일: 2026-08-08
- [WCAG 2.2 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html), 확인일: 2026-08-08
- [MDN `prefers-color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme), 확인일: 2026-08-08
