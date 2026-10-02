# 1차 시안 생성 입력 원문

내장 이미지 생성 도구 `image_gen`에 전달한 입력을 원문 그대로 기록한다. 제품 구현 지시나 추가 사용자 합의로 취급하지 않는다.

## 모바일 영상 추출

방식: 새 이미지 생성

```text
Use case: ui-mockup. Generate a high fidelity, pixel-sharp product UI design mockup, not code and not a marketing page.
Product: MyTube Extract, a Korean mobile WEB app for extracting YouTube video/audio and English subtitles. This is screen 1 of a coherent four-image design set.
Output: ONE standalone portrait image, ideally 1024 x 2048. Show one entire 390 x 844 mobile viewport inside a very subtle thin charcoal phone frame, flat straight-on, on a pale warm gray presentation background, narrow even margins. No perspective, camera notch, hands, props or dramatic shadow. The screen must occupy almost all the image. Do not add captions outside the phone.
Design bible: ultra-simple functional utility. Pretendard Korean sans-serif throughout; no serif. Light canvas #FBFBFA, white fields, charcoal #292929 main text and primary action, secondary text #656460, delicate #DEDEDA separators, control outlines visibly darker #888782. Red #E60012 is reserved ONLY for the small brand icon. No gradients, texture, images, illustrations, decorative cards, metric widgets, progress trail, service-ready banners, or marketing copy. Corners 6px on controls. Body text ~16 logical px, small text never below 14, heading28, 24px outer content inset, restrained 24px grouping spaces, minimum48px field/choice/button heights. All controls must fit comfortably above the fixed bottom navigation.
Header: small red rounded-square icon containing a WHITE DOWNLOAD ARROW landing on a horizontal line; exact wordmark "MyTube Extract" in charcoal beside it, and small "더보기" with downward chevron at right. Header about64px, subtle bottom line.
Main content is left aligned, one flat column. Title exactly "영상 추출". One short muted subtitle "YouTube 영상을 파일로 저장하세요."
Then separate visible label "YouTube 주소"; full-width input with exact value "https://youtu.be/aqz-KE-bpKQ" and small clear x at far right.
Next label "형식", a compact row of TWO equal-width outlined choices "비디오" and "오디오". 비디오 selected with charcoal outline and very pale gray fill, never red.
Next label "화질", a row of THREE equal-width outlined choices "360p", "720p", "1080p". 1080p selected with charcoal outline and very pale gray fill.
Then full-width 52px charcoal primary button, white text exactly "추출 요청".
Below the button, one quiet collapsed disclosure row with exact label "추출 안내" and a small down chevron. Nothing else. Content should finish around the upper two thirds of the viewport, with ordinary free space below rather than stretched gaps between fields.
Fixed BOTTOM TAB BAR: three equal tabs with small custom solid or medium-weight icons above readable labels exactly "영상 추출", "자막 추출", "요청 내역". 영상 추출 active in charcoal; other tabs muted gray. Thin top divider, safe area padding. No colored pills, no bottom-tab overlap with the submit button.
Prioritize exact Korean text, crisp aligned typography, credible touch geometry, scan clarity and very little copy. No extra UI features. Render the final mockup image now.
```

## 모바일 자막 추출

방식: 영상 추출 시안을 기준으로 화면 내용 변경

```text
Use case: ui-mockup. Create the second mobile screen of the MyTube Extract design set by editing the supplied first-screen mockup. It is a STYLE/FRAME reference: preserve the exact phone scale, frame, outer margins, canvas, wordmark, red download logo, typography family and scale, 24px content inset, header, flat 6px controls, and bottom navigation. This is a Korean mobile WEB utility, not a landing page.
Replace ONLY the content and active tab to show the subtitle extraction form AFTER a local video has been selected. Output ONE full standalone portrait image, same size and composition as the reference. All text must be crisp, readable Korean.
Keep the header logo, "MyTube Extract", "더보기" identical.
Title exactly "자막 추출". Muted supporting line "영상의 음성을 영어 자막으로 만드세요."
Label "영상 파일". Beneath it one compact, lightly outlined selected-file region, about100 logical px high. In this ONE region show a simple medium-weight file icon, filename "design-interview.mp4", secondary "84.2 MB", and visible text actions "파일 변경" and "지우기" with comfortably sized hit areas. Do not include a second empty picker or large dashed drop zone; the selected-file region replaces the picker in the same place.
Next label "처리 방식". Two equal-width compact choices side by side, exactly "속도 우선" and "정확도 우선". Select "정확도 우선" with dark outline and very pale gray fill.
Then a full-width charcoal 52px primary button with white text "자막 추출".
Below this button put a quiet collapsed disclosure row, text "처리 방식 안내", downward chevron. This disclosure is FLAT with just a delicate bottom divider, not a boxed card.
Fixed bottom tabs exactly "영상 추출", "자막 추출", "요청 내역" with consistent simple icons. Activate middle "자막 추출" in charcoal. Other tabs gray.
The complete form and primary button fit above the bottom tabs with plenty of clearance. Do not stretch spaces or scale up components to fill the screen. Maintain ordinary functional whitespace. Hide service readiness indicators in this normal state. No step trail, no progress meter, no popup, no other actions.
Palette identical to reference: warm almost-white #FBFBFA, charcoal #292929, subdued gray #656460, outlines #888782, delicate lines #DEDEDA. Red ONLY in brand icon. No texture, gradients, card stacks, serif typography, imagery, decorative illustrations, or external annotation. Render the screen image now.
```

## 모바일 요청 내역

방식: 영상 추출 시안을 기준으로 화면 내용 변경

```text
Use case: ui-mockup. Edit the supplied MyTube Extract mobile mockup into screen 3: REQUEST HISTORY. Preserve the reference phone frame and size, equal margins, exact header, Pretendard Korean typography family, light monochrome design, and bottom tab bar. Output ONE standalone portrait image at the same dimensions. High fidelity crisp Korean UI, real readable text.
The product is a Korean WEB extraction utility. No extra native mobile features.
Keep the red download-square icon, charcoal wordmark "MyTube Extract", right text "더보기" unchanged.
Replace main body with title "요청 내역". No explanatory paragraph, no metrics, no search/filter controls.
Render FOUR flat history entries, separated ONLY by delicate thin horizontal divider lines. No cards, no thumbnails, no background rectangles around entries. About125 logical px per entry, with clear16px titles,14px metadata, readable status text. Use identical button styling and spacing across entries. Each entry has title left and a small downward disclosure chevron at upper right. Details and delete are hidden behind the chevron.
Row1:
title "Big Buck Bunny"
metadata "비디오 · 1080p · 오늘 10:24"
status at lower left: small muted-green checkmark and "완료"
outlined rectangular button at lower right: "다운로드", at least44px high.
Row2:
title "design-interview.mp4"
metadata "자막 · 정확도 우선 · 오늘 10:18"
status at lower left: small muted-red alert glyph and "실패"
outlined button lower right: "다시 요청".
Row3:
title "제주 해변의 파도 소리"
metadata "오디오 · 320 kbps · 어제 18:40"
status lower left gray "만료"
outlined button lower right: "다시 요청".
Row4:
title "제주 숲길 산책"
metadata "비디오 · 720p · 오늘 10:30"
status lower left charcoal "처리 중"
right aligned "62%"
below those a slender real 62-percent filled gray progress line, the ONLY progress bar in this image.
No completed 100% meter. No Delete buttons on collapsed rows. No confirmation popup or form visible: history retry launches directly (subtitle retry would open only the file chooser).
Bottom tabs exactly "영상 추출", "자막 추출", "요청 내역"; ACTIVATE RIGHTMOST "요청 내역" in charcoal, other two muted gray, matching icons from the reference. All four entries should fit without overlapping the bottom bar.
Palette: #FBFBFA background, #292929 primary, #656460 secondary, #888782 control borders, #DEDEDA divider. Green #356B43 only completion, subdued red #A53735 only failure. Brand red #E60012 only small logo.
No decorative text, no UX annotations outside the screen, no giant white gaps between history entries, no gradients, no serif, no card containers. Make the whole result feel calm, compact, extremely clear and usable.
```

## 데스크톱 영상 추출 · 다크

방식: 새 이미지 생성

```text
Use case: ui-mockup. Generate ONE high fidelity desktop WEB app screen for "MyTube Extract" in dark mode. This is the desktop version of a minimal Korean video extraction utility, not a landing page. Output one wide landscape image, ideally 1600 x 1000 (16:10), flat straight-on screenshot mockup inside a minimal desktop browser frame with a very thin outline and small muted gray window controls. No laptop, perspective, desk, photography, marketing sections, or outside annotations.
The app's whole visual language is warm monochrome, very simple, Pretendard Korean sans-serif ONLY. Canvas #1B1B1A, input/control surface #232322, main text #F2F0EE, muted text #C0BDB8, visible control outlines #777570, subtle dividers #393936. Red #E60012 belongs ONLY to a tiny brand icon, never to buttons, active tabs or selected options. Primary button pale gray #ECEAE6 with dark text #262625. All UI totally FLAT, 6px control corners, no glow, shadows, gradients, textures, bento cards, illustrations, big typography, or redundant containers.
Desktop application header height72px: left logo is a red rounded square containing a white DOWNLOAD arrow landing on a horizontal line, followed by text exactly "MyTube Extract". Center or right-of-center TOP navigation shows exact labels "영상 추출", "자막 추출", "요청 내역"; first selected with off-white text and a thin white underline. Far right "더보기" and small down chevron. Delicate divider below header. No sidebar and NO bottom navigation on desktop.
Below header place a single form column about600px wide, horizontally centered, starting about64px below header. All content LEFT aligned in that column, the same vertical task order as mobile.
Main heading exactly "영상 추출", about28px semibold. Muted short subtitle "YouTube 영상을 파일로 저장하세요."
24px gap, label "YouTube 주소", full-width 52px input with exact value "https://youtu.be/aqz-KE-bpKQ" and small clear x at right. Text comfortably readable 16px.
24px gap, label "형식", one compact TWO-choice row with equal widths: "비디오", "오디오". First selected by brighter outline and subtly lighter fill.
24px gap, label "화질", one compact THREE-choice row: "360p", "720p", "1080p". Last selected by brighter outline and subtly lighter fill.
24px gap, full-width52px light-gray primary button, dark text exactly "추출 요청".
Under button, one FLAT collapsed disclosure row labeled "추출 안내", downward chevron at right, only one subtle bottom divider. This is not a card.
Nothing else in the content. Sufficient quiet blank space around the form; do not enlarge controls to fill the desktop. No giant hero heading, empty placeholder panels, duplicated history preview, card frame around form, status-ready strip, stage sequence, profile avatar, subscription button, or dashboards.
The overall impression is a focused precise everyday utility with balanced functional spacing and extraordinarily legible Korean text. Render the complete desktop screen image now.
```
