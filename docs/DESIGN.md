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
- 자막 미제출 파일·처리 방식은 영상과 독립된 탭 메모리에 보존한다. 새로고침·접수 뒤 메뉴 복귀는 파일을 비우고 기억한 처리 방식을 복원한다. 완료 후 `새 요청`은 파일만 비우며 현재 처리 방식·내역을 유지하고 파일 선택으로 포커스를 돌린다. 같은 화면의 취소·오류 복구에서는 파일을 유지한다.
- 영상·오디오 내역의 실패·만료 `다시 요청`은 그 자리에서 원래 조건으로 접수를 시도한다. 시작한 행에서 접수 상태·취소·실패 복구를 제공하고 성공 후 새 항목 제목에 포커스를 둔다. 두 입력 초안은 유지하며 실제 접수 성공만 이후 기본값을 갱신한다. 자막은 원래 처리 방식으로 파일 재선택 후 즉시 업로드·접수하며, 취소·파일 오류는 원래 행에 안내한다. 영상·오디오·자막은 같은 접수 잠금을 사용하고 자막의 실제 업로드 진행률만 표시한다.
- 재요청 중 원래 행이 다른 탭에서 삭제되면 같은 접수 안내·취소·실패 복구를 목록 위에서 유지하고, 취소·실패 후 목록 제목으로 포커스를 돌린다. 화면 재진입 뒤의 늦은 접수 성공도 현재 목록에 반영한다. 새 접수 때 최신 20건을 정리하되 명시적 되돌리기는 다른 내역을 삭제하지 않고 복원 항목을 표시한다.
- Pretendard 단일 서체와 기존 상태·접수 중 이동 잠금·테마 선호를 유지한다. 영상·자막 입력 밀도는 각 화면 계약을 따른다. 내역은 구분선 목록에서 제목·조건·시각·상태·주요 행동을 항상 표시하고 부가 상세·삭제만 접는다.

### Chrome popup·Overlay 최소 UI 계약 (2026-11-13)

승인된 `.scratch/chrome-extension-visual-minimal-ui/spec.md`(A안 "무대", 시안 `mockups/extension-a-states.html`)에 따라 Chrome 확장 프로그램 Popup과 썸네일 Overlay에는 아래 규칙을 우선 적용한다. 아래 절의 semantic token 값과 Web 계약은 바꾸지 않는다.

- **무대**: Popup 첫 화면 위쪽 16:9 썸네일 영역이 지금 추출할 영상을 보여 준다. 그 아래에는 영상 제목 한 줄(=파일명, 연필로 편집), 형식 아이콘 두 칸(파형 = 오디오 MP3, 필름 = 비디오 MP4), 품질 막대 세 개, 추출 버튼 하나만 둔다. 원본이 없거나 잘못되면 무대 자리가 붙여넣기 칸이 된다. 붙여넣기 칸은 실제 입력칸이고, 비어 있을 때만 입력칸 안에 붙여넣기 단축키 키캡(macOS `⌘` `V`, 그 밖 `Ctrl` `V`)을 장식으로 보인다. 키캡은 작은 radius·surface-alt 바탕·hairline 테두리·고정폭 글자이고, 스크린리더는 읽지 않는다. 썸네일을 불러오지 못하면 중립 surface와 비디오 아이콘으로 대체한다.
- **빨강 = 액션 전용**: Nintendo red(`#e60012`)는 추출·다시 시도 버튼, 형식·품질 선택 표시, 로고에만 쓴다. 헤더 격자 아이콘의 "썸네일 버튼을 아직 켜지 않음" 점도 red다. 이 점은 상태가 아니라 "켜기 행동이 남아 있다"는 행동 신호로 취급한다(스펙 42번과 시안을 따른 사용자 결정, 2026-11-13). 켜짐은 초록, 거부·오류는 crimson 점이다. 설정 화면 테마 세 칸의 선택 표시(red 테두리·red 아이콘)도 시안대로 둔 사용자 결정 예외다(2026-11-13, 리뷰 R5).
- **상태색은 배지와 아이콘에만**: 대기 회색(시계), 처리 파랑, 완료 초록(체크), 실패 crimson(느낌표·경고), 만료는 흐린 썸네일이다. 상태색으로 면·버튼·글자를 칠하지 않는다. 무대와 Overlay 카드 위의 진행 링은 흰색이고, 실패 덮개는 어두운 scrim 위 crimson 아이콘이다. 서버 연결 실패는 구름 아이콘으로 일반 실패와 구분한다. 다만 아래 네 곳은 승인 시안을 따른 사용자 결정 예외다(2026-11-13, 리뷰 R2·R3): 무대 완료 덮개의 초록 면(`--color-scrim-completed`), 최근 요청 화면의 상태 글자색, 설정 화면 거부·오류 행의 crimson tint 바탕, 썸네일 버튼 스위치 켜짐 트랙의 완료 초록.
- **오류에만 문장**: 화면에 남기는 글자는 영상 제목, 품질 숫자, 오류 한 줄, 설정 행 이름·안내, 최근 요청 목록의 메타 정보로 제한한다. 대기·처리·완료는 아이콘·링·배지와 live region 문장(`서버 확인 중`, `대기 중`, `처리 중`, `다운로드를 시작했어요`)으로만 전달한다. 오류 문장은 모두 한국어다. Overlay 토스트는 문장을 화면에 보이지 않고 live region으로만 전달한다. 품질 막대를 누른 뒤 Background 응답 전에는 체크 없이 중립 회전 링 토스트와 `요청을 보내고 있어요`만 알리고, 접수 응답을 받은 뒤에 체크와 `요청을 접수했어요`를 쓴다.
- **숫자 없는 진행 링**: API `progress`는 상태 기반 값이라 실제 진행률이 아니다. 처리 중에도 퍼센트·막대 없이 회전 링만 쓴다. 영상 길이도 근거 있는 출처가 없어 표시하지 않는다. 이 두 가지는 시안과 의도적으로 다른 점이다.
- **진행 중 추출 버튼**: 잠긴 회색(surface-alt) 버튼 위에 파란(focus·processing 계열) 회전 아이콘을 둔다. 스펙 25번의 "회색 회전 아이콘" 표현 대신 스펙 버튼 표와 시안을 따른 사용자 결정이다(2026-11-13).
- **44px 조작 영역**: 모든 아이콘 버튼·품질 막대·연필·지우기·토스트 버튼의 실제 조작 영역은 44×44px 이상이다. 작은 썸네일 카드에서도 Overlay 조작은 44px를 유지하고 간격만 줄인다.
- **Overlay 배치**: 호버 조작(형식 원형 버튼 두 개, 품질 막대 세 개)은 카드 오른쪽 위, 진행 상태 링·배지는 호버 조작과 겹치지 않게 늘 왼쪽 위에 둔다(시안은 오른쪽 위지만, 사용자가 2026-11-13에 왼쪽 위 유지로 정했다). 상태 배지는 호버와 관계없이 보이고, 완료 배지는 몇 초 뒤 사라진다. Overlay는 YouTube 호버 미리보기 레이어보다 위에 있어야 하므로 카드 안이 아니라 `body` 직하위 고정 레이어로 썸네일의 보이는 영역(상단 바·`overflow` 부모에 가려진 부분 제외)에 맞춰 놓고, 호버는 포인터 좌표로 판정한다(자세한 계약은 `docs/chrome-extension/current-implementation-fsd.md`). Overlay는 YouTube 썸네일 위에 놓이므로 테마와 관계없이 어두운 scrim과 흰 아이콘을 쓰고, 토스트는 다크 surface 토큰을 쓴다.
- **접근성**: 모든 아이콘 버튼에 접근 가능한 이름을 단다. Popup의 형식(`오디오 MP3`·`비디오 MP4`)과 품질(`720p`·`192 kbps`)은 이름과 선택 상태를 가진 radiogroup이다. Overlay 품질 막대는 누르면 바로 접수되므로 `720p 추출`처럼 행동을 담은 이름을 쓴다. 포커스는 blue focus outline이다. 줄어든 동작 설정에서는 회전·덮개 전환 애니메이션을 멈춘다. 200% 글자 확대에서 조작이 가려지지 않아야 한다. 글자 크기를 px로 정하므로 브라우저 200% 확대(Popup 보이는 높이 300 CSS px)를 기준으로 브라우저 스모크가 무대·최근 요청·설정 화면을 확인한다.
- **최근 요청 줄**: 기록이 없으면 줄을 숨기고, 빈 상태는 최근 요청 화면에서만 보인다(스펙 기본값, 사용자 결정 2026-11-13). 줄과 목록의 품질은 숫자만 보이고 단위는 스크린리더용으로 둔다.
- **설정 화면**: 테마(모니터·해·달 세 칸), 썸네일 버튼 스위치, 정책 안내, 완료 파일 보관 기간 안내는 Popup 내부 설정 화면으로 옮겨 첫 화면과 경쟁하지 않게 한다.


범위는 color, typography, spacing, radius, elevation, theme·mode, 접근성, 플랫폼 mapping과 Web·popup·Overlay 상태 화면 적용이다. 컴포넌트 API와 Figma는 포함하지 않는다.

## 2. 브랜드 입력과 디자인 원칙

- 입력 문서: Nintendo Design System (live-extract, 확인일 2026-06-17)
- **Nintendo red(`#e60012`)를 유일 액션 색**으로 쓴다 — primary CTA, 인라인 링크, 브랜드 포인트에만. 상태 표시에는 쓰지 않는다. Chrome popup 헤더의 "아직 켜지 않음" 점은 행동 신호로 보는 예외다(위 Chrome popup·Overlay 계약 참고).
- 순검정 대신 웜 다크그레이 잉크를 쓴다.
- 근무영(whisper-soft) shadow와 hairline으로 분리한다. 두꺼운 테두리·하드 드롭섀도는 쓰지 않는다.
- 12px 카드, 8px 버튼, 48px pill, 20px 유틸리티 pill의 둥근 기하를 쓴다.
- `Pretendard Variable` 단일 패밀리를 쓴다. weight 600은 heading, 400은 body를 담당한다.
- 이미지·콘텐츠가 시각적 에너지를 담당하고 UI 크롬은 차분하게 유지한다.

## 3. 대상 플랫폼과 공통 규칙

- 대상: Vite Web, Chrome MV3 popup, Chrome 확장 YouTube 썸네일 Overlay.
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

자막 요청은 한 파일 선택 영역에서 선택·파일명·크기·변경·지우기를 제공한다. 별도의 큰 빈 드롭 영역을 추가하지 않으며, 긴 파일명은 줄바꿈하고 조작 영역을 밀어내지 않는다. 준비 확인 중·실패·미가용에도 파일과 처리 방식은 편집 가능하며 제출 위치에만 준비 안내를 표시한다. 정상 준비 안내는 숨긴다. `속도 우선`과 `정확도 우선`은 항상 표시하고, `base.en`, `small.en`, 로컬 Whisper 같은 기술 정보는 제출 뒤 기본으로 접힌 disclosure에 둔다. 390×844 기본 글자 크기에서는 파일 선택 전후 제출 버튼 전체가 최초 화면에 보이고, 긴 파일명·작은 화면·200% 글자 확대에서는 스크롤로 하단 탭 위의 조작에 도달할 수 있어야 한다. 공통 흐름·전체 단계 표시는 제거하고 실제 업로드·처리 진행률만 표시한다. 완료에는 막대 없이 원본 파일명·`영어 SRT`·보관 기간·다운로드를 보여준다. URL 입력과 파일 선택으로 포커스를 이동하는 `U`/`F` 단축키는 제공하지 않는다. 요청 내역도 공통 흐름·종료 상태의 진행 막대를 표시하지 않는다.

`/settings`는 외곽 card elevation 없이 `화면 표시` preference group을 workspace의
직접적인 세로 흐름으로 보여준다. 시스템·라이트·다크 선택과 설명은 같은 flat 표면에
두고, 실제 radio label의 조작 영역은 44px 이상으로 유지한다. `/settings`의 현재 route는
`aria-current="page"`, 본문색 라벨과 Nintendo red 밑줄로 함께 표시한다. `/history`도 페이지
바깥 표면은 flat하게 두며, 빈 상태에서는 `시작할 작업을 선택하세요.`를 먼저 보여준
뒤 영상·자막 시작 링크를 동등한 행으로 제공한다. 브라우저 로컬 이력과 완료 파일
7일 보관 안내는 별도 보조 note로 한 번만 표시한다.

요청 내역 항목은 반복 외곽 카드 대신 구분선으로 나눈다. 영상 제목(없으면 원본 링크)과
자막 파일명 아래에 종류·품질/처리 방식·시각을 표시하고 상태와 다운로드·다시 요청은
항상 보인다. 44×44px 상세 버튼은 투명 배경과 테마별 본문색 화살표를 사용하며 제목과
접근성 이름을 연결한다. 작업 식별자·부가 원본 링크·접수 시각·삭제는 펼친 상세에 둔다.
처리 중 확인 가능한 진행률만 표시한다. 완료는 결과·보관 안내·다운로드를 제공하며,
주소 없는 완료와 조회 오류는 복구 안내로 구분한다. 만료 상태는 비활성 회색 대신
보조 텍스트색을 사용해 라이트·다크에서 4.5:1 이상의 대비를 확보한다.

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
  - 예외(사용자 결정, 2026-11-13): Chrome popup 품질 막대는 시안대로 밑줄 없이 채운 막대 모양·red 막대·본문색 숫자로 선택을 보인다. 막대 높이·채움이라는 모양 신호가 함께 있고, radio의 선택 상태는 접근 가능한 이름과 함께 유지한다.
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
