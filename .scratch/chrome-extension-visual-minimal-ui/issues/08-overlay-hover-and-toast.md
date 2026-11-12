# 08: 오버레이 호버 UI와 토스트 개편

**What to build:** YouTube 표준 영상 카드 썸네일에 마우스를 올리거나 포커스하면 오른쪽 위에 형식 원형 아이콘 버튼 두 개(오디오 MP3·비디오 MP4)와 품질 막대 세 개가 나타난다. 기존 `MP3`·`MP4` 글자 버튼과 품질 패널을 대체한다. 오디오를 고르면 막대 숫자가 kbps 값으로 바뀐다. 형식 선택은 같은 페이지 안에서만 기억한다. 품질 막대를 누르면 기존 Overlay 다운로드 메시지로 바로 제출한다.

접수·실패 토스트는 미니 썸네일, 상태 아이콘, 형식 아이콘과 품질, 닫기 버튼으로 바꾼다. 실패 토스트에는 다시 시도 버튼을 더한다. 문장은 화면에 보이지 않고 live region으로만 전달한다. 아이콘 버튼에는 접근 가능한 이름을 단다. 기존 Shadow Root 격리, Shorts 제외, 동적 카드 대응, 중복 주입 방지는 유지한다. 시안: `../mockups/extension-a-states.html`의 오버레이 묶음.

**Blocked by:** 01

**Status:** resolved

- [x] Overlay 다운로드 메시지 계약 단위 테스트가 그대로 통과한다(형식·품질 조합 포함).
- [x] overlay 브라우저 스모크가 새 호버 UI(아이콘·막대, 오디오 전환 시 kbps 숫자), 막대 클릭 제출, 아이콘 토스트와 실패 토스트의 다시 시도, Shorts 제외, 동적 카드, 중복 주입을 확인하도록 갱신되어 통과한다.
- [x] overlay 가시성 스모크가 통과한다.
- [x] 에이전트가 overlay 스모크 화면의 스크린샷으로 버튼·막대·토스트가 썸네일 안에서 잘리지 않음을 확인한다.
- [x] 확장 `lint`, `test`, `build`가 통과한다.

## Comments

- 2026-11-12 구현(에이전트): `youtube-overlay-ui.ts`의 호버 UI와 토스트를 새로 작성했다. Overlay 다운로드 메시지 계약(`youtube-overlay-message.ts`)은 바꾸지 않았다.
  - 호버 UI는 썸네일 링크에 pointer가 있거나 포커스가 썸네일 링크·Overlay 안에 있을 때만 보인다(opacity, 숨김 상태에서도 Tab으로 도달 가능). 기본 형식은 시안처럼 비디오이고, 형식 선택은 저장하지 않는 페이지 상태로 같은 탭의 모든 카드가 공유한다. YouTube SPA 이동(`yt-navigate-finish`) 뒤에도 같은 탭이면 유지된다. 이것을 "같은 페이지"로 해석했다.
  - 접근 가능한 이름: 형식 `오디오 MP3`·`비디오 MP4`(`aria-pressed`), 막대 `360p 추출`·`192 kbps 추출` 등, 토스트 `다시 시도`·`닫기`. 토스트 문장은 숨김 live region(`role=status` 접수, `role=alert` 실패)으로만 전달한다.
  - 접수 토스트는 기존과 같이 막대를 누른 즉시 뜨고 4초 뒤 닫힌다. 실패 토스트는 닫기나 다시 시도까지 남는다. 확장 연결 오류의 영어 원문은 `확장 프로그램에 연결할 수 없어요.`로 바꿔 읽어 준다.
  - 사이드바처럼 짧은 썸네일(높이 130px 이하)은 container query로 여백만 줄이고 44px 조작 영역은 유지한다(168×94 썸네일 안에 들어감, 가시성 스모크가 경계를 자동 검사).
  - 아이콘은 YouTube Trusted Types 정책을 피하려고 `innerHTML` 없이 SVG element로 만든다.
- 검증: 확장 `lint`, `test`(237/237), `build`, `youtube-overlay-smoke`, `youtube-overlay-visibility-smoke` 통과. popup 스모크는 이 티켓 범위 밖이고 실제 API 주소를 부르므로 돌리지 않았다. 스모크는 `i.ytimg.com` 썸네일을 가짜 그림으로 응답해 외부 요청을 하지 않는다.
- 대표 캡처(`MYTUBE_EXTRACT_OVERLAY_SCREENSHOT_DIR=/tmp/mytube-08`로 생성, 에이전트가 직접 보고 잘림 없음 확인): `/tmp/mytube-08/overlay-hover-video.png`, `/tmp/mytube-08/overlay-hover-audio.png`, `/tmp/mytube-08/overlay-hover-compact.png`, `/tmp/mytube-08/overlay-toast-accepted.png`, `/tmp/mytube-08/overlay-toast-failed.png`.
- 비차단 확인 사항: (1) 시안은 형식 선택을 빨강으로만 표시하지만 `DESIGN.md`의 "색만으로 선택을 전달하지 않는다" 규칙에 따라 선택된 형식 버튼에 흰 테두리를 더했다. (2) Overlay 포커스는 썸네일 위에서도 보이도록 파란 outline 안쪽에 흰 띠를 둔다. (3) `docs/chrome-extension/current-implementation-fsd.md`의 `MP3`·`MP4` 버튼, 토스트 상태 서술은 10 문서 티켓에서 고친다.
