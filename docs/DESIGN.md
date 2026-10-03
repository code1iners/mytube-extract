---
name: MyTube Extract
description: Nintendo 미니멀 플랫 계열 self-hosted YouTube 추출 콘솔의 Web·Chrome popup 공통 Foundation.
colors:
  action-primary: "#e60012"
  on-primary: "#ffffff"
  canvas: "#ffffff"
  surface: "#f8f8f8"
  surface-alt: "#efefef"
  text-primary: "#484848"
  text-secondary: "#727272"
  text-disabled: "#c8c8c8"
  border: "#8a8a8a"
  focus: "#4b5cce"
  status-queued: "#727272"
  status-processing: "#4b5cce"
  status-completed: "#356b43"
  status-failed: "#c62828"
  status-expired: "#c8c8c8"
typography:
  display:
    fontFamily: "'Pretendard Variable', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.35
  subheading:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  button:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.0
  nav:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.0
  caption:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  xs: "2px"
  sm: "4px"
  md: "8px"
  lg: "12px"
  pill: "48px"
  full: "9999px"
spacing:
  "4": "4px"
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "24": "24px"
  "32": "32px"
  "48": "48px"
components:
  button-primary:
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "48px"
  button-primary-disabled:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.text-disabled}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "44px"
  card-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input-url:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    height: "48px"
  chip-quality:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "48px"
  chip-quality-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    borderColor: "{colors.action-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "48px"
---

# MyTube Extract Design System

## 1. 목적과 범위

MyTube Extract의 Web과 Chrome 확장 popup에 공통 적용하는 Foundation이다.

### Web 전용 최소 구성 계약 (2026-10-03)

승인된 `.scratch/web-minimal-redesign/spec.md`에 따라 Web에는 아래 규칙을 우선 적용한다. 아래 절의 Nintendo red 액션 규칙은 Chrome popup에 유지한다. Web 스타일은 `apps/web/src/styles/global.css`에서만 정의하며 공통 자산과 확장 프로그램을 변경하지 않는다.

- 로고 아이콘만 `#e60012` / 흰색을 유지한다. 서비스 이름·탐색·선택 표시·링크·주요 버튼·포커스는 무채색이다.
- 주요 행동과 포커스는 라이트 `#484848`, 다크 `#f2f0ee`; 주요 버튼 글자는 각각 흰색, `#18191b`다.
- 일반 보조 텍스트는 라이트 `#686868`, 다크 `#b3b0ac`; 조작 경계는 두 테마 모두 `#858585`로 가장 어두운/밝은 인접 표면에서도 대비를 확보한다. 의미 있는 처리·완료·오류 상태색은 유지한다.
- 820px 이하는 헤더 브랜드와 오른쪽 `…`, 하단 고정 3탭을 사용한다. 821px 이상은 240px 왼쪽 로고·세로 메뉴와 오른쪽 작업 영역이다. 상단 주 탐색 탭은 없다.
- 오른쪽 작업 영역의 최대 폭은 760px이다. 모바일 헤더·본문·하단 탭은 같은 좌우 여백과 최대 폭을 공유한다.
- 보조 메뉴는 `…`만 표시하고 접근성 이름은 `더보기`다. 숨겨진 반대 크기의 탐색은 `display:none`으로 포커스와 접근성 트리에서도 제외한다.
- 글자 확대 시 브랜드·메뉴 라벨이 줄바꿈된다. 하단 탭 높이는 `ResizeObserver`로 본문 여백에 반영하고 안전 여백을 추가한다.
- 영상 미제출 주소·선택은 같은 탭의 메뉴 이동 중 보존한다. 새로고침과 접수 뒤 메뉴 복귀는 원본을 비우고 기억한 선택을 복원한다. 완료 후 `새 요청`은 주소만 비우며 현재 선택과 내역을 유지한다. 초안 복원만으로 이후 기본값을 저장하지 않는다.
- Pretendard 단일 서체와 기존 상태·접수 중 이동 잠금·테마 선호를 유지한다. 영상·자막 입력 밀도는 각 화면 계약을 따르며 내역 목록 재설계는 후속 티켓에서 적용한다.


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
| Hairline | `#8a8a8a` | `#767676` |
| Green(eShop) | `#356b43` | `#8fd6a0` |
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
| Hairline / border | `#8a8a8a` | `#767676` |
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

Web의 요청 설정 화면은 app shell과 workspace가 정렬을 담당하고, 주 작업 영역을 다시 카드로 감싸지 않는다. 입력·선택 control에는 surface와 hairline을 사용하고 오류·완료 안내에는 필요한 범위에서 tint 또는 shadow를 사용한다. 영상은 `YouTube URL → 추출 형식 → 품질 → 추출 요청`, 자막은 `로컬 영상 → 처리 방식 → 영어 SRT 생성` 순서다. 요청 화면은 준비 상태 확인 중에도 입력을 표시하고, 제출 위치에 제한 사유와 재확인을 제공한다. 준비되지 않으면 제출만 제한하며 기존 입력은 보존한다. 정상 준비 안내와 확인 시각은 숨긴다.

영상 화면은 준비 확인 중·실패·미가용에도 입력을 표시한다. 준비되지 않으면 제출 바로 위 한곳에 상태·이유·필요한 재확인을 제공하고, 정상 안내·시각·재확인은 숨긴다. 주소는 별도 라벨로 이름을 고정하고 설명·지우기와 분리한다. 형식·품질은 충분한 폭에서 나란히 배치하고 좁으면 읽기 순서대로 감싼다. 기술 설명은 제출 뒤 접으며 390×844 기본 화면에서 제출 버튼 전체가 보인다. 접수·처리는 실제 상태를 보여주며 수치가 있을 때만 진행률을 제공한다. 완료에서는 막대 없이 결과·다운로드를 표시한다. 영상 화면에는 공통 단계 trail을 표시하지 않는다.

Web 헤더는 workspace에 직접 놓는 flat row로 사용한다. 외곽 카드, shadow, 장식용 제목 수평선은 사용하지 않는다. 각 요청 화면은 `YouTube URL` 또는 `로컬 영상 파일`을 첫 번째 작업 대상으로 분명하게 보여준다. 좁은 화면에서도 utility는 한 줄을 유지하고, `사용 안내`와 `설정`은 접근 가능한 `더보기` disclosure 안에서 함께 제공한다. disclosure는 Enter·Space로 열고 닫으며 Escape와 바깥 pointer 입력으로 닫을 수 있고, 닫을 때 summary로 focus를 돌린다.

자막 요청은 한 파일 선택 영역에서 선택·파일명·크기·변경·지우기를 제공한다. 별도의 큰 빈 드롭 영역을 추가하지 않으며, 긴 파일명은 줄바꿈하고 조작 영역을 밀어내지 않는다. 준비 확인 중·실패·미가용에도 파일과 처리 방식은 편집 가능하며 제출 위치에만 준비 안내를 표시한다. 정상 준비 안내는 숨긴다. `속도 우선`과 `정확도 우선`은 항상 표시하고, `base.en`, `small.en`, 로컬 Whisper 같은 기술 정보는 제출 뒤 기본으로 접힌 disclosure에 둔다. 390×844 기본 글자 크기에서는 파일 선택 전후 제출 버튼 전체가 최초 화면에 보이고, 긴 파일명·작은 화면·200% 글자 확대에서는 스크롤로 하단 탭 위의 조작에 도달할 수 있어야 한다. 공통 흐름·전체 단계 표시는 제거하고 실제 업로드·처리 진행률만 표시한다. 완료에는 막대 없이 원본 파일명·`영어 SRT`·보관 기간·다운로드를 보여준다. URL 입력과 파일 선택으로 포커스를 이동하는 `U`/`F` 단축키는 제공하지 않는다. 요청 내역의 기존 흐름 표시는 내역 티켓에서 변경한다.

`/settings`는 외곽 card elevation 없이 `화면 표시` preference group을 workspace의
직접적인 세로 흐름으로 보여준다. 시스템·라이트·다크 선택과 설명은 같은 flat 표면에
두고, 실제 radio label의 조작 영역은 44px 이상으로 유지한다. `/settings`의 현재 route는
`aria-current="page"`, 본문색 라벨과 Nintendo red 밑줄로 함께 표시한다. `/history`도 페이지
바깥 표면은 flat하게 두며, 빈 상태에서는 `시작할 작업을 선택하세요.`를 먼저 보여준
뒤 영상·자막 시작 링크를 동등한 행으로 제공한다. 브라우저 로컬 이력과 완료 파일
7일 보관 안내는 별도 보조 note로 한 번만 표시한다.

## 10. Theme과 Mode

- light와 dark를 모두 제공한다.
- 최초 theme는 OS preference를 따른다.
- 사용자가 선택한 theme는 이후에도 유지한다.
- Nintendo red는 두 테마에서 동일 값을 유지한다(브랜드 불변성). 그 외 surface·ink만 반전한다.
- theme 전환은 semantic token의 값만 바꾸며, 구조·spacing·radius·elevation은 바꾸지 않는다.

## 11. 접근성

- 일반 텍스트는 최소 `4.5:1`, 큰 텍스트는 최소 `3:1` 대비를 충족한다.
- 요청 내역에서 제목을 대신하는 원본 링크는 테마별 본문색과 밑줄을 사용해 두 테마 모두 일반 텍스트 대비를 확보한다.
- UI 경계·focus indicator는 인접 색상과 최소 `3:1` 대비를 충족한다.
- 상태는 색과 함께 텍스트·아이콘으로 전달한다.
- 선택형 control은 선택 경계·형식 아이콘에만 Nintendo red를 사용하고, 라벨과 밑줄은 테마별 본문 색을 사용한다. 밑줄을 함께 두어 선택 여부를 색상만으로 전달하지 않는다.
- keyboard focus는 blue accent outline으로 명확히 표시한다. red는 focus에 쓰지 않아 액션 신호와 분리한다.
- 설정 링크와 URL 입력값이 있을 때 나타나는 지우기 control, `/history`의 다운로드·다시 요청·삭제·되돌리기 control은 실제 클릭 영역을 가로·세로 44px 이상으로 확보한다.
- 주요 navigation active label은 테마 본문색을 사용하고 Nintendo red는 icon·indicator에만 사용해 일반 텍스트 대비 4.5:1 기준을 유지한다.
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
| 상태 화면 | 요청·처리 상태가 동시에 보임 | 접수한 route에서 요청·처리·결과·오류를 단일 단계로 표시하고, 요청 내역은 별도 목록에서 확인 |

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
