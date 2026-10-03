# 2차 시안 생성 입력 원문

내장 이미지 생성 도구 `image_gen`에 전달한 편집 입력을 원문 그대로 기록한다. 제품 코드 수정이나 배치안의 최종 채택을 의미하지 않는다.

## 데스크톱 배치 재설계

편집 대상: [1차 이미지](../v1/desktop-video-dark.png)

```text
Use case: ui-mockup. Redesign the attached MyTube Extract DESKTOP mockup. Output ONE crisp high fidelity landscape desktop screen, roughly 1600x1000. Keep its Korean utility product, red download logo, Pretendard-like Korean sans-serif, warm charcoal dark theme, and extraction functions. This is a layout redesign, not a marketing site.
USER CHANGES: eliminate the horizontal top navigation tabs; replace every visible "더보기" label and chevron with a SINGLE HORIZONTAL THREE-DOT ellipsis icon (three small evenly spaced circular dots, not vertical, no accompanying text).
NEW LAYOUT:
A narrow LEFT sidebar, about220 logical px wide, with the small red download-square logo and "MyTube Extract" wordmark at its top (24px inset). Below the wordmark, a simple vertical navigation of exactly THREE destinations: "영상 추출", "자막 추출", "요청 내역". Each has a small consistent medium-weight icon, a label, and a 44px high row. First row selected with a soft gray rectangular fill and bright text. Other two muted. No extra menus, projects, account, badges, footer controls, dashboard metrics, or sidebar collapse control. A very subtle vertical separator.
The remainder is ONE flat main work area. There is NO full-width global top navigation band. Put the page title "영상 추출" near the main area's upper-left at about x320,y70, 28px semibold. Under title one line "YouTube 영상을 파일로 저장하세요." in muted text. Main header top RIGHT has only the small horizontal three-dot ellipsis icon in a generous unboxed44px click target.
Below this title, aligned to exactly the same left edge, create a form ~620px wide. Keep useful space around it; do not center the title in the viewport or draw a card behind the form.
First: label "YouTube 주소", then52px input spanning the form width, value exactly "https://youtu.be/aqz-KE-bpKQ", clear x at right.
Next: two option GROUPS side by side on ONE row, separated by24px space. Left group about240px wide: label "형식", choices "비디오", "오디오" below; 비디오 selected. Right group about356px wide: label "화질", choices "360p", "720p", "1080p" below;1080p selected. Each option48px high, evenly sized within its group. Selected state is bright neutral border+slightly lighter dark fill.
Then a full-width52px PALE GRAY primary button, dark text "추출 요청".
Below it one flat collapsed disclosure row "추출 안내", downward chevron aligned right, only a delicate bottom divider.
This compact form should occupy roughly the top half to two-thirds of the main work area, with natural remaining blank canvas. No empty decorative panels.
Palette: sidebar #181817, canvas #1E1E1C, field #262624, text #F2F0EE, secondary #B9B7B2, control lines #777570, primary button #ECEAE6/dark text #262625. Red #E60012 ONLY in tiny logo icon. No blue or red active navigation, no red underline. Flat colors; NO grain/noise/texture/gradients, no glow, no shadows. Corner radius6px, readable16px body and14px minimum secondary type.
Use a minimal screen frame only. Remove the previous detailed browser address bar and fake domain; optional three small gray window dots in a30px strip. No phone or laptop hardware.
The result should look simple, purposeful, visually balanced, and clearly different from the old top-tab layout. Exact Korean copy. Render only the final redesigned desktop image.
```

## 모바일 영상 추출 · 헤더 수정

편집 대상: [1차 이미지](../v1/mobile-video-light.png)

```text
Edit this image with ONE tightly localized change only. In the MOBILE app HEADER at the TOP RIGHT, remove the text "더보기" AND the downward chevron next to it. In that same header area, put a single horizontal ellipsis icon: exactly THREE small solid charcoal circular dots in a horizontal line ( … ), centered in an invisible44px by44px tap target near the right24px inset. No circle, visible button border, background, text label, or arrow around these dots.
Preserve absolutely everything else from the input image: full phone frame, portrait dimensions, wordmark and red download logo, title "영상 추출", all Korean copy, all existing form controls, selection states, button, colors, exact positions and spacing, bottom navigation and active tab. Do not add, delete, reflow or restyle any other element. Only change the upper-right header more-control. Return the complete edited image, not a crop.
```

## 모바일 자막 추출 · 헤더 수정

편집 대상: [1차 이미지](../v1/mobile-subtitles-light.png)

```text
Edit the supplied MOBILE subtitle extraction mockup with exactly ONE localized change. In the TOP RIGHT of the app header, remove the word "더보기" and its downward chevron. Replace both with a SINGLE horizontal ellipsis icon: exactly three small solid charcoal circular dots in an evenly spaced horizontal line. Position at the right24px inset, vertically centered in the header, with an invisible44px tap target. No text, no chevron, no visible border or button background.
Everything else MUST remain unchanged: entire phone frame and portrait dimensions, "MyTube Extract" wordmark and red logo, "자막 추출" title, subtitle description, selected "design-interview.mp4" file and "84.2 MB", "파일 변경", "지우기", both processing choices and selected state, primary button, disclosure, whitespace, bottom tabs and active middle tab. Preserve all fonts, colors, sizes and positions. This is a small header-control edit, not a redesign of this mobile screen. Return the full edited image, not a crop.
```

## 모바일 요청 내역 · 헤더 수정

편집 대상: [1차 이미지](../v1/mobile-history-light.png)

```text
Make ONE localized edit to the supplied mobile request history UI image. Remove the top-right APP HEADER text "더보기" and its adjacent down chevron, replacing them with a horizontal ellipsis icon: three small solid charcoal circular dots, evenly spaced, center aligned near the right24px inset, invisible44px tap target. There must be NO "더보기" text, NO chevron, NO visible border or circle around this header icon.
Preserve every other part of the image exactly: portrait phone frame and dimensions, red download logo and "MyTube Extract", title "요청 내역", all four request entries, their titles, metadata, status colors and glyphs, download and retry buttons, processing progress line, ALL row disclosure chevrons, all spacing, typography, background, and bottom navigation with request history active. Do not alter the list's data or ordering. Only the header more-button changes. Return the full edited image.
```
