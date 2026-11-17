# YouTube 호버 미리보기 중 썸네일 Overlay 유지 조사

- 조사일: 2026-11-13
- 대상: `apps/chrome-extension`의 썸네일 Overlay(`youtube-overlay-ui.ts`의 `mountCardOverlay`)가, YouTube 호버 미리보기(inline playback) 레이어가 썸네일을 덮는 동안에도 썸네일 안에서 유지되고 버튼 클릭이 가능하게 하는 방법
- 출처 기준: 웹 표준(MDN·W3C·CSSWG)과 저장소 소스, 실제 `youtube.com` 응답으로 받은 YouTube 배포 번들(JS·CSS). YouTube 내부 DOM은 공식 문서가 없으므로, 배포 번들에서 직접 확인한 것은 "번들 확인", 확인하지 못한 것은 "추정"으로 표시한다.
- 범위: 조사와 합성 fixture 실험만 한다. 저장소 코드는 바꾸지 않았다. 실험 스크립트는 저장소 밖(scratchpad)에 있다.

## 결론

**추천: 후보 (a)+(b) 결합. 오버레이 host를 `document.body` 직하위 `position: fixed` 레이어(최상위 z-index)로 옮기고, 호버 판정은 document 레벨 `pointermove`와 썸네일 `getBoundingClientRect()` 포함 여부로 한다.** 위치는 `scroll`(capture)·`resize`·썸네일 `ResizeObserver`에서 rAF로 한 번 묶어 갱신한다.

이유는 한 줄로 이렇다. 미리보기는 카드의 자손이 아니라 카드 밖에 page 좌표로 얹히는 `position:absolute` 레이어라서, 호버 판정만 고치는 (a) 단독은 오버레이가 "보이기만 하고 미리보기 뒤에 있어 누를 수 없다". 실험에서 (a)는 `opacity` 1을 유지했지만 버튼 좌표의 최상단 요소는 미리보기였고 클릭은 미리보기로 갔다. (a)+(b)는 클릭이 버튼에 들어갔고 카드 이동·미리보기 클릭으로 새지 않았다.

남는 위험은 두 가지다. ① 포인터가 오버레이 버튼으로 올라가면 미리보기 컨테이너가 `mouseleave`를 받아 미리보기가 닫힐 수 있다(실험에서 재현했고, 실제 YouTube가 어떻게 반응하는지는 사람이 확인해야 한다). 오버레이는 썸네일 좌표 판정으로 계속 유지되므로 요구사항("오버레이 유지, 버튼 클릭 가능")은 깨지지 않는다. ② scroll 중 fixed 레이어가 1프레임 어긋날 수 있다(추정, 미측정).

## 1. YouTube 호버 미리보기 구조

### 확인 방법과 한계

- 2026-11-13에 로그아웃 상태로 `https://www.youtube.com/`를 `curl`로 받았고, 거기서 참조하는 메인 번들 `kevlar_base`(약 9.7MB JS)와 CSS(약 3.8MB)를 받아 `ytd-video-preview*` 코드를 직접 읽었다. 이 파일들은 개인 scratchpad에 두었고 저장소에는 넣지 않았다.
- **실제 브라우저에서 렌더링된 DOM(Elements 패널)과 `z-index`·stacking 결과는 확인하지 못했다.** 번들은 코드이지 렌더 결과가 아니고, 어느 변형(아래 loader/portal)이 켜지는지는 계정·실험 플래그마다 다를 수 있다. 로그아웃 상태의 `ytcfg` 실험 플래그에는 `web_video_preview_anchor_positioning: true`, `web_enable_video_preview_cow: true`, `web_video_preview_use_intersection_observer: true`가 있었고 `web_enable_video_preview_portal`은 보이지 않았다(그래서 이 세션 기준 loader 변형일 가능성이 높다는 것은 **추정**).
- 저장소 기존 조사 `docs/research/2026-11-12-youtube-inline-download-button.md:135`는 "미리보기가 버튼을 덮을 수 있다(추정)"까지만 적었다. 이번 조사로 구조를 번들에서 확인했다.

### 번들에서 확인한 내용 (번들 확인)

1. **미리보기 요소의 mount 위치는 카드 안이 아니다.** 앱 호스트가 `#video-preview` 요소를 찾아 그 아래에 `ytd-video-preview-loader`를 만든다(`web_enable_video_preview_portal` 플래그가 켜져 있으면 `ytd-video-preview-portal`). 코드: `document.createElement("ytd-video-preview-portal") : document.createElement("ytd-video-preview-loader")` 후 `querySelector("#video-preview").appendChild(...)`. 즉 호버 대상 썸네일(`a#thumbnail`)의 자손이 아니라 문서 쪽에 하나만 두고 재사용하는 단일 레이어다.
2. **위치는 썸네일 좌표를 따라가는 `position:absolute`다.** `yt-open-video-preview-action` 핸들러가 썸네일의 `getBoundingClientRect()`에 `window.scrollX/Y`를 더한 page 좌표를 `top`/`left`·폭·높이로 쓴다. `web_video_preview_anchor_positioning`이 켜져 있으면(그리고 `CSS.supports("anchor-name", ...)`가 참이면) 썸네일 요소 인라인 스타일에 `anchor-name: --ytd-video-preview-anchor`를 쓰고 컨테이너에 `position-anchor: --ytd-video-preview-anchor`를 준다. 어느 쪽이든 컨테이너는 썸네일 위에 겹쳐 놓인다.
3. **포인터 이벤트를 받는다.** CSS: `.ytdVideoPreviewLoaderVideoPreviewContainer{position:absolute;padding:12px;margin:-12px;pointer-events:none}`, `.ytdVideoPreviewLoaderActive{pointer-events:auto}`(portal 변형도 같은 값). 미리보기가 활성이면 컨테이너가 `pointer-events:auto`이고, 썸네일보다 사방 12px 넓다(패딩 12px, 마진 -12px). 그래서 활성 중에는 썸네일 영역의 포인터가 컨테이너로 간다. 컨테이너에는 `data-ytd-video-preview-hit-box` 속성과 `mouseenter`/`mouseleave` 핸들러가 붙어 있고, 미리보기 본체 `ytd-video-preview` 호스트 CSS도 `.ytdVideoPreviewActive{pointer-events:auto;opacity:1}`다.
4. **미리보기는 자기 hit-box를 기준으로 닫힌다.** 번들에 `ki7=function(L){return L instanceof Element&&L.closest("[data-ytd-video-preview-hit-box], ytd-video-preview")!==null}`가 있다. 미리보기 쪽은 "포인터가 hit-box 또는 `ytd-video-preview` 안인가"로 판정하므로, 우리 오버레이를 그 밖에 두면 포인터가 오버레이 위로 갈 때 미리보기 쪽은 이탈로 볼 수 있다(추정. 이 함수가 어느 경로에서 쓰이는지까지는 추적하지 않았다).
5. **stacking.** 번들·CSS에는 미리보기 컨테이너의 `z-index` 선언이 없었다(찾은 CSS 규칙에 `z-index`가 없음, 번들 확인). 컨테이너가 `position:absolute`이고 문서 쪽 `#video-preview` 아래에 늦게 놓이므로, `z-index:auto`끼리는 DOM 순서·조상 stacking context에 따라 카드 안의 오버레이 위에 그려진다는 것이 우리가 본 재현(opacity 1 → 0, 요소 최상단이 미리보기)과 일치한다. 조상 쪽 stacking context(`ytd-app` 등)와 `#video-preview`의 정확한 CSS는 확인하지 못했다(추정).
6. **카드 종류별 차이.** 위 미리보기 레이어는 카드 종류와 무관한 공용 단일 레이어이고, 카드 쪽은 썸네일 요소(`c.thumbnail`)와 선택적으로 `lockup` 요소만 넘긴다(portal 변형은 `root: lockup ?? N`에 렌더). 홈 `ytd-rich-item-renderer`, 검색 `ytd-video-renderer`, 사이드바 `ytd-compact-video-renderer`, 최신 `yt-lockup-view-model`별로 미리보기 DOM이 달라지는지는 확인하지 못했다. portal 변형일 때 미리보기가 lockup 자손이 되는지, 되더라도 `a#thumbnail`의 자손은 아니라는 점은 번들 코드상 `a#thumbnail`을 부모로 쓰는 경로가 없다는 데서 본 것이다(추정).

### 이 구조가 현재 증상을 설명하는 방식

현재 구현은 `a#thumbnail`에 `pointerenter`/`pointerleave`를 단다(`youtube-overlay-ui.ts:573-588`). 미리보기 컨테이너가 활성화되면 썸네일 영역의 hit test 대상이 컨테이너가 되어, 썸네일 링크는 "포인터가 자신과 자손을 벗어났다"고 보고 `pointerleave`를 받는다. 컨테이너는 썸네일의 자손이 아니므로 `pointerleave` 입장에서는 "겹친 형제"일 뿐이다. 우리 오버레이는 `a#thumbnail` 안에 있어 미리보기 레이어 뒤에 깔리므로, 판정이 맞더라도 클릭은 미리보기가 받는다. 두 문제(호버 판정, 클릭 가능성)는 별개이고 둘 다 풀어야 한다.

## 2. 웹 표준 근거

| 주장 | 근거 |
| --- | --- |
| `pointerleave`는 포인터가 요소와 **모든 자손**을 벗어났을 때만 발생하고 버블하지 않는다. 겹친 요소가 hit test 대상이 되면 그 요소가 자손이 아닌 한 이탈로 처리된다 | W3C Pointer Events 4.2.9 "moved out of an element and all of its descendants", "pointerleave does not bubble" https://www.w3.org/TR/pointerevents3/ · MDN https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerleave_event ("moved out of the hit test boundaries of an element") |
| 레이아웃이 바뀌어 요소의 hit test 경계가 정지한 포인터에서 벗어나도 `pointerleave`가 발생한다 | W3C Pointer Events 3 (같은 문서) |
| `pointer-events:none` 요소는 이벤트 대상이 되지 않고 아래 요소로 통과한다. 다만 `pointerenter`/`pointerleave`는 자손 이동에 대해 예외적으로 부모에서 발생한다 | MDN https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events |
| `document.elementsFromPoint(x,y)`는 hit test 대상이 되는 요소를 위에서 아래 paint 순서로 반환하고, `pointer-events`로 제외될 수 있다. shadow tree에서의 동작은 확인하지 못했다 | MDN https://developer.mozilla.org/en-US/docs/Web/API/Document/elementsFromPoint · CSSOM View https://drafts.csswg.org/cssom-view/#dom-document-elementsfrompoint |
| `getBoundingClientRect()`는 viewport 기준이고 스크롤 때마다 값이 바뀐다. 문서 좌표는 `scrollX/Y`를 더해 얻는다 | MDN https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect |
| `ResizeObserver`는 content/border box **크기** 변화만 보고한다. 위치 변화는 보고하지 않는다 | MDN https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver |
| `IntersectionObserver`는 뷰포트·조상과의 교차를 비동기로 관찰한다. `trackVisibility`는 "다른 요소에 가려졌는지"까지 보지만 계산이 비싸다고 적혀 있다 | MDN https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API |
| stacking context 안의 `z-index`는 그 context 안에서만 의미가 있다. `position:fixed`·`opacity<1`·`transform`·`contain:paint` 등이 context를 만든다. 그래서 카드 안쪽 오버레이는 `z-index`를 아무리 올려도 조상 context 밖의 미리보기를 이기지 못한다 | MDN https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context |
| top layer는 fullscreen·`showModal()` dialog·`showPopover()` popover 등이 들어가며 모든 레이어 위에 그려진다 | MDN https://developer.mozilla.org/en-US/docs/Glossary/Top_layer · https://developer.mozilla.org/en-US/docs/Web/API/Popover_API |
| CSS anchor positioning은 anchor 요소 크기·위치에 맞춰 다른 요소를 배치한다(Chrome 125부터 지원이라는 점은 MDN 페이지에서 확인하지 못해 **미확인**) | https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning |

## 3. 후보 비교

| 항목 | (a) document `pointermove` + rect 판정 | (b) body 직하위 fixed 레이어 | (c) 미리보기 위에 복제 주입 | (d) 기타: `popover=manual` top layer |
| --- | --- | --- | --- | --- |
| 호버 유지 | 가능(실험 통과) | 가능, 다만 판정은 (a)가 필요(host가 썸네일 밖이라 `pointerenter` 불가) | 가능(복제본은 미리보기 안이라 미리보기 `mouseenter`와 함께 움직임) | (b)와 같음 |
| 클릭 | **불가**. 오버레이는 미리보기 뒤라 클릭이 미리보기로 간다(실험) | 가능. 최상단 요소가 host(실험) | 가능 | 가능 |
| 클릭 누출 | 미리보기 클릭 = 보통 watch 이동(위험) | 버튼에서 `stopPropagation`하면 미리보기·카드로 안 샌다(실험: previewClick 0, anchorClick 0). 새는 곳은 없지만 미리보기가 `mouseleave`로 닫힐 수 있다 | 미리보기 DOM 안이라 YouTube 핸들러와 얽힐 수 있음 | (b)와 같음 |
| 스크롤·리사이즈 비용 | 좌표 갱신 불필요(오버레이가 썸네일 안). `pointermove` 핸들러 비용만, 카드 수 N개면 N번 rect 판정이므로 "현재 호버 카드 하나"만 추적하면 O(1) | `scroll`·`resize`마다 rAF로 위치 갱신. 보이는 오버레이 하나만 추적하면 저렴. 카드 전부 상시 추적은 비쌈 | 미리보기 위치를 YouTube가 맞춰 주므로 갱신 코드 없음 | (b)와 같음 + top layer 진입/이탈 관리 |
| 접근성(포커스) | DOM 위치가 카드 안이라 탭 순서가 자연스러움 | host가 카드 밖이라 Tab 순서가 문서 끝으로 가고, 카드 포커스와 연결하려면 별도 처리 필요 | 복제본이 미리보기 중에만 존재해 키보드 사용자는 원본을 씀 | `popover`는 포커스 이동 규칙이 있음. 상세 미확인 |
| YouTube DOM 변경 취약성 | 낮음(썸네일 rect만 씀) | 낮음~중간(썸네일 rect만 씀, 미리보기 DOM 무관) | **높음**. `ytd-video-preview-loader/portal`·`#video-preview`·hit-box 속성은 비공식이고 플래그로 변형됨 | 낮음 |
| 구현 복잡도 | 낮음 | 중간 | 높음(미리보기 mount/unmount 추적, 이중 상태) | 중간~높음 |

- (a) 단독은 호버 문제만 풀고 클릭을 못 푼다. 요구사항 "버튼 클릭도 가능"을 못 채운다.
- (c)는 YouTube 내부 요소 이름과 생명주기에 직접 의존하므로 가장 부서지기 쉽다. 번들을 보면 loader/portal 두 변형과 anchor 변형이 공존하고 플래그로 바뀐다.
- (d) top layer: `popover="manual"` 요소에 `showPopover()`를 하면 stacking과 무관하게 최상단이 된다. 다만 요소 위치는 여전히 (b)처럼 추적해야 하고, YouTube 쪽도 top layer를 쓸 수 있어 순서가 보장되지 않는다(추정). fullscreen 중 YouTube 플레이어와의 상호작용은 확인하지 못했다. (b)에서 `z-index:2147483647`이 막히는 경우에만 추가로 검토할 만하다.
- 판정 정확도: 사각형 포함 여부는 썸네일 위에 다른 카드·고정 헤더가 겹치는 경우를 구분하지 못한다. 필요하면 `elementsFromPoint`로 보강할 수 있으나, 미리보기가 활성인 동안은 최상단이 미리보기라 `a#thumbnail` 포함 여부로는 못 쓰므로 rect 판정이 더 단순하다(위 표의 `elementsFromPoint` 근거 참고).

## 4. 합성 fixture 실험

- 스크립트: `/private/tmp/claude-501/-Users-wraith-workspace-personal-mytube-extract/dfb4c08f-cd8c-4e2b-9699-11f1487e833b/scratchpad/hover-exp.mjs` (Playwright Chromium, 저장소에는 없음). 실제 빌드가 아니라 단순화한 오버레이로 세 변형을 비교한 합성 실험이다. 기존 재현 `repro.mjs`는 실제 빌드(`youtube-overlay.js`)로 같은 증상(미리보기가 덮으면 opacity 1 → 0)을 확인했다.
- fixture: 썸네일(`a#thumbnail`, 300x170)과 별도로, YouTube 구조를 모사한 `#preview`(카드 밖, page 좌표 `absolute`, `padding:12px; margin:-12px; pointer-events:auto`)를 `display:block`으로 켠다. `closeOnLeave`는 미리보기가 `mouseleave`에 닫히는 YouTube 동작을 흉내 낸 옵션이다.
- 변형: `base`는 현재 구현(썸네일 `pointerenter`/`pointerleave`, host가 썸네일 안). `a`는 document `pointermove` + rect 판정(host는 썸네일 안). `b`는 body 직하위 fixed host + (a)의 판정 + rAF 위치 갱신.

| 변형 | 미리보기 켠 뒤 opacity | 버튼 좌표 최상단 요소 | 버튼 클릭 결과 | 스크롤 후 | 비고 |
| --- | --- | --- | --- | --- | --- |
| base | 0(사라짐) | preview | 버튼 0회, 미리보기 1회 | opacity 0 | 증상 재현 |
| a | 1(유지) | preview | 버튼 0회, **미리보기 1회** | opacity 1 | 보이지만 못 누름 |
| b | 1(유지) | 오버레이 host | **버튼 1회**, 미리보기 0회, 카드 이동 0회 | 썸네일 상단에서 +8px 유지, opacity 1 | 포인터가 버튼으로 가면 미리보기가 `mouseleave` 1회를 받음. `closeOnLeave` 시 미리보기가 닫혔고 오버레이는 유지됨 |

세 변형 모두 썸네일 밖으로 나가면 opacity 0이었다. 결과 JSON은 실험을 다시 돌리면(`node hover-exp.mjs`) 출력된다.

**실험으로 확인하지 못한 것:** 실제 YouTube에서의 동작, 실제 스크롤(compositor 스레드) 중 프레임 단위 지연, 키보드 포커스 이동, 터치 입력, 썸네일 위에 다른 요소가 겹치는 경우, 미리보기 `mouseleave` 시 실제 YouTube 코드가 미리보기를 닫는지.

## 5. 추천안과 구현 시 유의점

**후보 (a)+(b).** 설계 메모:

1. 오버레이 host를 `document.body` 직하위(또는 `document.documentElement`)에 `position:fixed; z-index:2147483647; pointer-events:none`으로 두고, 보일 때만 내부 `.overlay`를 `pointer-events:auto`로 한다(현재 `youtube-overlay-ui.ts:823-824`와 같은 계약). 한 번에 하나만 보이므로 host를 카드마다 두지 말고 "현재 호버 카드"용 하나를 공유하는 쪽이 갱신 비용과 DOM 오염 면에서 낫다(구조 변경 범위는 구현 때 판단).
2. 호버 판정은 `document`에 `pointermove`(passive) 하나를 달고, 이동 때마다 후보 카드 썸네일의 `getBoundingClientRect()` 포함 여부를 본다. 오버레이 자신의 rect 안도 "호버"로 취급해 버튼으로 이동하는 중에 깜빡이지 않게 한다. `documentElement`의 `pointerleave`로 창 밖 이탈을 처리한다.
3. 위치 갱신은 `scroll`(capture, passive)·`resize`·대상 썸네일 `ResizeObserver`에서 rAF 한 번으로 묶는다. `ResizeObserver`는 크기만 보므로 스크롤·레이아웃 이동은 scroll/resize와 pointermove 안의 rect 재계산으로 보강한다(표준 근거는 2절).
4. 클릭은 현재처럼 `preventDefault()`·`stopPropagation()`을 유지한다. host가 카드 밖이므로 버튼 영역 밖 클릭은 통과해야 한다(host는 `pointer-events:none`).
5. 접근성: 현재는 카드 안이라 `:focus-within`으로 보이게 한다(`youtube-overlay-ui.ts:339`). host를 밖으로 옮기면 이 경로가 끊기므로, 키보드로 썸네일 링크에 포커스가 오면 오버레이를 보이게 하는 별도 처리가 필요하다. 이 부분은 이번 조사로 해결책을 검증하지 못했다.
6. 미리보기가 오버레이 호버로 닫히는 문제는 YouTube 내부 동작이라 우리가 막을 수 없다. 받아들일지(오버레이는 유지되므로 요구사항 충족) 여부를 사용자에게 확인하는 것이 좋다.

## 6. 가장 싼 검증 방법

1. **합성 fixture(자동):** 위 `hover-exp.mjs`의 `b` 시나리오를 실제 빌드 산출물(`apps/chrome-extension/.output/chrome-mv3/youtube-overlay.js`)로 바꿔 돌린다. 기존 `repro.mjs`의 "미리보기 표시 후 opacity"를 회귀 테스트로 쓰면 된다. 확인 항목: 미리보기 후 opacity 1, 버튼 좌표 최상단 요소가 오버레이, 클릭이 미리보기·카드 링크로 새지 않음.
2. **정적 검사·단위 테스트:** 변경 후 `apps/chrome-extension` 정적 검사와 기존 browser smoke(`youtube-overlay-smoke.mjs`)를 돌린다.
3. **실제 YouTube(사람 확인 필수, 자동화로 대체 불가):** 로그인 상태 홈에서 (확인 항목)
   - 카드에 포인터를 올리고 약 1~2초 기다려 호버 미리보기가 재생된 뒤에도 오버레이가 보이는가.
   - 그 상태에서 MP3/MP4 버튼을 눌렀을 때 요청이 접수되고 영상 페이지로 이동하지 않는가.
   - 버튼으로 포인터를 옮길 때 미리보기가 닫히는지, 닫혀도 오버레이가 남는지.
   - 스크롤하는 동안 오버레이가 썸네일 모서리를 따라가는지(어긋남·깜빡임).
   - 검색 결과, 시청 페이지 사이드바, 구독 피드, 창 크기 변경, 다크/라이트 테마.
   - Tab 키로 썸네일에 포커스했을 때 오버레이가 보이는가.
   - YouTube 설정에서 "썸네일 재생"을 끈 상태에서 기존 동작이 회귀하지 않는가.

## 확인하지 못한 부분 요약

- 실제 렌더링된 YouTube DOM(Elements 패널)과 미리보기 컨테이너의 최종 `z-index`·조상 stacking context. 번들·CSS 정적 읽기까지만 했다.
- 카드 종류별(홈·검색·사이드바·`yt-lockup-view-model`) 미리보기 차이, 계정별 실험 플래그(loader/portal/anchor) 변형 분포.
- `ki7` hit-box 판정이 미리보기 종료에 쓰이는 경로.
- 키보드 접근성, 실제 스크롤 중 지연, 터치 환경, CSS anchor positioning과 `popover` 기반 대안의 실제 동작·지원 범위.
