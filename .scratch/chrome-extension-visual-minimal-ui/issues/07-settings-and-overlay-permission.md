# 07: 설정 화면과 썸네일 버튼 권한

**What to build:** 헤더 격자 아이콘에 썸네일 버튼 권한 상태 점을 보여준다(빨간 점 = 아직 켜지 않음·확인 중, 초록 점 = 켜짐, crimson 점 = 거부·오류). 격자 아이콘과 설정 아이콘은 Popup 내부 `settings` 화면을 연다. 설정 화면 구성:
- 테마 선호 세 칸(모니터·해·달 = 시스템·라이트·다크). 기존 저장 방식을 유지한다.
- 썸네일 버튼 행: 꺼짐이면 스위치, 켜기를 누르면 Chrome 권한 요청과 회전 아이콘, 켜짐이면 스위치 on, 거부·오류면 crimson 행과 이유 한 줄, 권한 다시 요청 버튼.
- 저작권·플랫폼 정책 안내, 완료 파일 보관 기간 안내(job의 보관 일수, 기본 7일).

스위치를 끄면 YouTube optional host permission을 제거하고 이후 자동 주입을 멈춘다. 이를 위해 Overlay 권한 adapter에 해제 동작을 추가한다. 이미 열린 탭의 버튼은 다음 이동이나 새로고침 때 사라져도 된다. 뒤로 버튼으로 무대 화면에 돌아간다.

**Blocked by:** 03

**Status:** resolved

- [x] Overlay 권한 adapter 단위 테스트에 권한 해제(성공·실패)를 추가한다.
- [x] model 통합 테스트: 권한 꺼짐 → 요청 중 → 켜짐, 거부, 오류, 켜짐 → 해제 → 꺼짐 전이와 헤더 점 상태를 확인한다.
- [x] 권한이 해제된 뒤 background가 YouTube 탭에 자동 주입하지 않는다는 것을 단위 또는 통합 테스트로 확인한다.
- [x] popup 브라우저 스모크의 Overlay 활성화 흐름이 설정 화면 기준으로 갱신되고, 테마 세 칸 전환을 확인하며 통과한다.
- [x] 확장 `lint`, `test`, `build`가 통과한다.

## Comments

- 구현:
  - model: `youtubeOverlay`에 `indicator`(`off`=빨간 점, `on`=초록 점, `problem`=crimson 점)와 `turnOffError`를 더했다. `deactivateYoutubeOverlay()`와 `retentionDays`(최신 job의 보관 일수, 없으면 7)도 추가했다. 권한 문장은 해요체 한국어로 바꿨다.
  - adapter: `disable()`가 `chrome.permissions.remove`로 YouTube 선택 권한을 해제한다.
  - background: 주입 판단을 `src/features/youtube-overlay/youtube-overlay-injection.ts`로 옮겼다. 주입할 때마다 권한을 다시 읽으므로 해제 뒤에는 자동 주입하지 않는다.
  - 화면:
    - 헤더 격자·설정 아이콘이 `settings`를 연다. 뒤로 가면 연 버튼으로 포커스를 돌려준다.
    - 설정 화면: 테마 세 칸(기존 `localStorage` 키 유지), 썸네일 버튼 행, 정책 안내, 보관 기간 안내.
- 리뷰 반영:
  - 끄기 실패를 '오류'로 처리하면, 권한이 남아 자동 주입이 계속되는데도 crimson 점과 "권한 다시 요청"(=켜기) 버튼이 떴다.
  - 그래서 실패 뒤 실제 권한을 다시 읽는다. 권한이 남아 있으면 켜짐(초록 점)을 유지하고, 스위치 아래에 이유 한 줄만 보여준다.
- 이미 열린 탭의 버튼:
  - 권한을 해제해도 이미 주입된 content script는 남는다.
  - YouTube 안의 SPA 이동만으로는 버튼이 사라지지 않고, 새로고침해야 사라진다. 티켓의 "사라져도 된다"(허용) 범위로 보고 그대로 두었다.
- 문서와 다른 점(비차단, 확인 필요):
  - `docs/DESIGN.md` §5는 "brand red는 상태 표시에 쓰지 않는다"고 한다.
  - 반면 티켓·스펙 42·시안은 '아직 켜지 않음' 점을 빨간 점으로 명시한다. 그래서 구현은 `--color-primary` 빨간 점을 썼다.
  - DESIGN.md에 예외를 적을지는 10 문서 티켓에서 정할 일이다.
- 검증(마지막 변경 뒤):
  - 확장 `lint`(tsc), `test`(27파일 237개), `build`, `git diff --check` 모두 통과했다.
  - `test:browser`(popup·overlay·overlay-visibility 스모크)도 통과했다.
  - popup 스모크에 새로 넣은 흐름:
    - 빨간 점 → 격자로 설정 열기
    - 테마 세 칸: 시스템(OS 다크)·라이트·다크 전환, 저장 키, 재오픈 유지
    - 스위치 켜기 → 회전 아이콘 → 켜짐(Background 활성화 메시지 1회) → 뒤로 시 초록 점과 포커스
    - 설정 아이콘으로 열고 끄기 → `permissions.remove` 1회, 빨간 점
    - 거부 → crimson 행·이유 한 줄·crimson 점 → 권한 다시 요청으로 켜짐
  - API 연결:
    - `.env`가 가리키는 로컬 API가 떠 있지 않아 스모크의 전제인 실제 API `/health` 확인이 실패했다.
    - 그래서 같은 주소에 `/health`만 `{"ok":true}`로 답하는 임시 응답기(`/tmp/mytube-07/health-stub.mjs`, 검사 뒤 종료)를 두고 실행했다.
    - 이번 실행은 실제 API의 health를 확인하지 않았다. 다른 흐름은 모두 가짜 응답이고, 실제 서버 요청은 없다.
  - 캡처(직접 확인, 360px 가로 넘침 없음):
    - `/tmp/mytube-07/shots/popup-settings-off-light.png`, `popup-settings-requesting-light.png`, `popup-settings-on-light.png`, `popup-settings-on-dark.png`
    - `/tmp/mytube-07/shots/popup-settings-denied-light.png`, `popup-settings-denied-dark.png`, `popup-header-on-light.png`
  - 로그: `/tmp/mytube-07/` 아래 `lint.log`, `test.log`, `build.log`, `browser.out`, `browser.err`
