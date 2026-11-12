# YouTube 페이지 인라인 내려받기 버튼·popover 조사

- 조사일: 2026-11-12
- 대상: Chrome 확장 프로그램이 youtube.com의 영상 카드·시청 페이지 플레이어에 내려받기 아이콘 버튼을 끼워 넣고, popover에서 형식·품질을 골라 기존 서버(`apps/api` + `apps/worker`) job으로 바로 내려받는 기능
- 출처 기준: 저장소 1차 자료(`경로:줄`)와 Chrome·MDN·Chrome Web Store·YouTube 공식 문서. YouTube DOM과 SPA 이벤트는 공식 문서가 없으므로 "비공식·관찰" 또는 "추정"으로 표시한다.
- 범위: 조사만 한다. 코드·설정은 바꾸지 않았다.

## 결론

**구현할 수 있고, 뼈대의 대부분은 이미 저장소에 있다.** 현재 Chrome 확장 프로그램에는 사용자가 Popup에서 YouTube 권한을 허용하면 Background가 `youtube-overlay.js`를 탭에 주입하고, 카드 썸네일마다 Shadow Root 기반 `MP3`/`MP4` 버튼과 품질 패널을 붙이는 Overlay가 이미 구현되어 있다. 버튼을 누르면 Background가 Popup과 같은 job 흐름(`/health` 확인 → `POST /downloads` → 2.5초 폴링 → `chrome.downloads.download`)으로 서버를 호출한다(`apps/chrome-extension/entrypoints/background.ts:97-160`, `apps/chrome-extension/src/features/youtube-overlay/youtube-overlay-ui.ts:56-347`). 그래서 이번 요청은 새로 만드는 일이 아니라 **기존 Overlay를 넓히는 일**이다. 주요 작업은 ① 항상 보이는 텍스트 버튼 두 개를 "아이콘 버튼 + popover"로 바꾸기, ② 주입 지점을 시청 페이지 플레이어와 채널 페이지까지 넓히기, ③ 최근 YouTube DOM(`lockupViewModel` 계열)에 맞춰 selector 다시 잡기, ④ 페이지 안에서 진행·완료 상태를 보여 주기다. 서버 계약은 바꿀 필요가 없다. 가장 큰 위험은 기술보다 정책 쪽이다. YouTube 약관은 승인 없는 다운로드를 금지하고, Chrome Web Store 정책은 저작권 콘텐츠의 무단 다운로드를 돕는 제품을 금지한다. 따라서 이 기능은 지금처럼 unpacked 개인 사용([ADR 0001](../adr/0001-keep-single-user-mode-until-public-service-transition.md))을 전제로 해야 한다.

## 현재 확장·서버에서 재사용할 수 있는 것

| 항목 | 현재 상태 | 근거 |
| --- | --- | --- |
| 주입 방식 | 정적 `content_scripts`는 없다. `https://www.youtube.com/*`는 `optional_host_permissions`로 두고, Popup에서 허용받은 뒤 Background가 `chrome.scripting.executeScript`로 unlisted script를 주입한다 | `apps/chrome-extension/wxt.config.ts:32-40`, `apps/chrome-extension/entrypoints/background.ts:149-156`, `:222-228`, `apps/chrome-extension/src/adapters/chrome/youtube-overlay.ts:37-74`, `docs/chrome-extension/current-implementation-fsd.md:12` |
| 지원 경로 | `/`, `/results`, `/watch`, `/feed/subscriptions`만 지원한다 | `apps/chrome-extension/src/features/youtube-overlay/youtube-page.ts:28-34` |
| 카드 탐지 | `ytd-rich-item-renderer`, `ytd-video-renderer`, `ytd-compact-video-renderer`를 대상으로 한다. `MutationObserver(document.documentElement, {childList, subtree})`와 100ms debounce를 쓰고, `popstate`·`yt-navigate-finish`·`yt-page-data-updated`가 오면 다시 scan한다 | `youtube-overlay-ui.ts:17-21`, `:95-115` |
| videoId 추출 | 카드 안의 `a#thumbnail[href], a[href*="/watch"]`에서 `/watch?v=`를 파싱하고 11자 형식을 검증한다. Shorts는 제외된다 | `youtube-overlay-ui.ts:119-149`, `apps/chrome-extension/src/features/youtube-overlay/youtube-card-url.ts:12-41` |
| 스타일 격리 | 카드마다 `span` host에 `attachShadow({mode:'open'})`를 붙인다. 폰트는 `web_accessible_resources`의 Pretendard를 쓴다 | `youtube-overlay-ui.ts:164-197`, `:433-453`, `wxt.config.ts:35-40` |
| 메시지 경계 | content script는 `youtube-overlay-download`(mode·quality·videoId·title)만 보낸다. Background가 mode별 품질 조합, videoId 형식, 제목 길이, 보낸 탭 URL을 다시 검증한다 | `apps/chrome-extension/src/features/youtube-overlay/youtube-overlay-message.ts:69-84`, `background.ts:245-272` |
| job 흐름 | Popup과 같은 submit handler를 쓴다. `/health` 확인 → job 생성 → 첫 상태를 받으면 즉시 응답하고 이후 폴링은 manager가 맡는다 | `apps/chrome-extension/src/features/download-jobs/download-job-submit-handler.ts:25-69`, `background.ts:257-271` |
| 폴링·복구 | 2.5초 간격으로 폴링한다. 진행 중 job은 `chrome.storage`에 저장하고, 1분 alarm과 `onStartup`으로 service worker 재시작 뒤에도 이어 간다 | `apps/chrome-extension/src/features/download-jobs/download-job-manager.ts:19`, `:239`, `background.ts:61-99`, `apps/chrome-extension/src/features/download-jobs/download-job-recovery.ts:1-22` |
| 완료·실패 알림 | 완료되면 데스크톱 알림을 띄우고 제목 기반 파일명으로 `chrome.downloads.download`를 호출한다. 실패하면 재시도 버튼이 있는 알림을 띄운다 | `download-job-manager.ts:273-285`, `apps/chrome-extension/src/adapters/chrome/downloads.ts:8-27`, `apps/chrome-extension/src/adapters/chrome/notifications.ts:53-115` |
| 페이지 내 피드백 | 페이지 전역 Toast 하나가 있다. "요청 접수"는 4초 뒤 사라지고, "실패"에는 다시 시도 버튼이 있다 | `youtube-overlay-ui.ts:349-431` |
| 품질 집합 | audio `128/192/320`, video `360/720/1080` 고정값이다. Web·API와 같다 | `apps/chrome-extension/src/domain/download-options/quality-options.ts:3-7`, `apps/web/src/domain/download-request/download-request.ts:150-162`, `docs/server/endpoints/post-downloads.md:7-11` |
| 서버 계약 | `POST /downloads {type,url,quality}`, `GET /downloads/:jobId`, `GET /downloads/:jobId/file`을 쓴다. 인증은 없다. 같은 videoId/type/quality의 유효한 asset이 있으면 즉시 `completed`가 된다 | `docs/server/endpoints/post-downloads.md:1-40`, `docs/server/endpoints/get-downloads-job-id-file.md:1-20` |
| 검증 자산 | 단위 테스트와 fixture 기반 browser smoke(`youtube-overlay-smoke.mjs`)가 있다. 다만 실제 YouTube에서 확인한 것으로 완료 처리하지 않는다고 명시되어 있다 | `apps/chrome-extension/package.json:13-15`, `docs/chrome-extension/current-implementation-fsd.md:205-206` |

공유 패키지 메모: `packages/`에는 `db`, `media-downloader`만 있고, 확장과 Web이 공유하는 API 타입·client 패키지는 없다. 확장은 자체 client(`apps/chrome-extension/src/services/mytube-extract/mytube-extract-client.ts`)를, Web은 `apps/web/src/api/mytube-extract.api.ts`를 따로 둔다. 확장 쪽 `DownloadJob` 타입에는 서버 응답의 `sourceUrl`·`title`이 없다(`apps/chrome-extension/src/domain/download-job/download-job.ts:23-46`; Web은 `apps/web/src/domain/download-request/download-request.ts:50-78`).

## 빠진 것(요청과의 차이)

1. **아이콘 버튼 + popover UI가 없다.** 지금은 썸네일 우측 상단에 `MP3`·`MP4` 텍스트 버튼이 항상 보이고, 누르면 같은 Shadow Root 안에 품질 grid가 펼쳐진다(`youtube-overlay-ui.ts:181-222`, `:332-335`). 닫기는 Escape만 되고 바깥 클릭으로는 닫히지 않는다(`:336-346`). popover는 썸네일 영역(`overflow` 안)에 갇혀 있다.
2. **시청 페이지의 메인 플레이어에는 버튼이 없다.** `/watch`에서는 추천 카드만 대상이다(`docs/chrome-extension/current-implementation-fsd.md:65`).
3. **채널·재생목록 등 다른 페이지를 지원하지 않는다.** `/@handle/videos`, `/channel/...`, `/playlist`, `/feed/history` 같은 경로는 `isSupportedYoutubePagePath`에서 제외된다(`youtube-page.ts:28-34`).
4. **추천 사이드바 selector가 낡았을 가능성이 크다(관찰).** 2026-11-12에 비로그인 `curl`로 받은 `/watch` 초기 데이터에는 `compactVideoRenderer`가 0건, `lockupViewModel`이 21건이었다. 채널 `/videos`는 `richItemRenderer.content.lockupViewModel` 30건이었다. 검색 결과는 아직 `videoRenderer` 29건이었다(조사 방법은 아래 "주입 지점" 절). 초기 데이터 키와 DOM 태그(`ytd-compact-video-renderer` ↔ `yt-lockup-view-model`)의 대응은 **추정**이다. 그래도 `ytd-compact-video-renderer` selector가 지금의 사이드바와 맞지 않을 위험이 크다.
5. **Shorts는 제품 결정으로 제외되어 있다**(`docs/chrome-extension/current-implementation-prd.md:44`, `:86`). 반면 서버는 Shorts URL을 받는다(`docs/server/endpoints/post-downloads.md:10`). 확장의 `normalizeSourceUrl`도 `/shorts/`를 파싱한다(`apps/chrome-extension/src/domain/download-options/download-options.ts:163-168`).
6. **페이지 안에서 진행·완료 상태를 보여 주지 않는다.** Toast는 접수 확인만 하고 사라진다. 완료는 데스크톱 알림과 자동 다운로드로만 알 수 있다. Background가 탭에 상태를 push하는 경로(`chrome.tabs.sendMessage`)도 없다(`background.ts:101-139`에는 수신 handler만 있다).
7. **기본 품질이 Web과 다르다.** 확장은 audio 192 / video 720(`quality-options.ts:15-18`), Web은 audio 320 / video 1080(`apps/web/src/domain/download-request/download-request.ts:144-167`, `apps/web/src/app/utils/request-preference.util.ts:28-33`)이다. Overlay는 기본값 없이 매번 숫자를 고르게 하므로 아직은 드러나지 않지만, "기본값으로 원클릭" 같은 popover를 만들면 차이가 생긴다.
8. **worker 가용성을 확인하지 않는다.** 확장의 health 확인은 `ok === true`만 본다(`mytube-extract-client.ts:75-95`). Web은 `worker.available`까지 읽는다(`apps/web/src/api/mytube-extract.api.ts:31-39`). worker가 멈춰 있으면 확장에서는 job이 `queued`인 채로 남는다.
9. **Web 요청 내역에 나타나지 않는다.** Web 내역은 브라우저 `localStorage` 접수증을 기반으로 한다(`docs/web/routes/history.md:8`). 확장에서 만든 job은 확장 저장소에만 최대 5건 남는다(`download-job-manager.ts:21`). 이는 ADR 0001의 "브라우저 중심 내역" 결과와 일치하는 현재 제약이다.
10. **확장 업데이트·재로드 뒤 고아 버튼이 남을 수 있다(추정).** 현재 script에는 context invalidation 처리가 없다(`apps/chrome-extension/entrypoints/youtube-overlay.ts:1-7`). 대부분의 브라우저는 확장이 업데이트·비활성화돼도 content script를 멈추지 않는다([WXT content scripts](https://wxt.dev/guide/essentials/content-scripts)). 다시 주입된 script는 DOM marker가 이미 있는 카드를 건너뛴다(`youtube-overlay-ui.ts:156-162`). 그 결과 옛 버튼이 남고, 눌러도 `chrome.runtime` 호출이 실패할 수 있다. 실제 재현은 하지 않았다.
11. **자막은 해당되지 않는다.** Web의 자막 추출은 로컬 영상 파일을 업로드하는 흐름이라(`docs/web/routes/subtitles.md:1-8`, `docs/server/endpoints/post-subtitles-uploads.md`) YouTube 영상 버튼에서 고를 옵션이 아니다.

## 제안 구조

```
youtube.com 탭 (ISOLATED world content script)
  ├─ 카드/플레이어 탐지: MutationObserver + SPA 이벤트(비공식) + URL 변화 감시
  ├─ 아이콘 버튼 host(span, Shadow Root)  ── 카드마다 1개, 가볍게
  └─ popover host(문서 최상위 1개, Shadow Root, position: fixed)
        │ chrome.runtime.sendMessage({type, videoId, title, mode, quality})
        ▼
Background service worker (MV3)
  ├─ 메시지 재검증(보낸 탭 URL, videoId, mode·quality)
  ├─ 기존 submit handler → /health → POST /downloads
  ├─ 기존 job manager 폴링(2.5s) · storage 영속 · alarm 복구
  ├─ 완료: chrome.downloads.download(제목 기반 파일명) + 데스크톱 알림
  └─ (신규) 상태 변화 시 chrome.tabs.sendMessage(tabId, {jobId, videoId, status})
        ▼
apps/api (인증 없음) ── apps/worker (yt-dlp, R2)
```

### content script와 주입 방식

- **ISOLATED world를 유지한다.** content script는 페이지 JS 변수를 볼 수 없지만 DOM은 공유하며, `runtime.sendMessage`·`storage` 등 일부 API만 직접 쓸 수 있다([Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)). MAIN world는 페이지 JS와 실행 환경을 공유하므로([chrome.scripting ExecutionWorld](https://developer.chrome.com/docs/extensions/reference/api/scripting)) 페이지 내부 데이터(`ytInitialData` 등)를 읽어야 할 때만 검토한다. 이번 범위에서는 DOM의 링크로 충분하다.
- **주입 방식은 두 가지다.**
  - (a) 지금처럼 권한을 허용받은 뒤 `tabs.onUpdated`에서 `executeScript`로 주입한다(`background.ts:149-156`). 동작은 확인되어 있지만 탭 이벤트마다 주입을 시도한다.
  - (b) 권한을 허용받은 직후 `chrome.scripting.registerContentScripts({matches:['https://www.youtube.com/*'], runAt:'document_idle', persistAcrossSessions:true})`로 한 번 등록한다. 공식 문서상 `persistAcrossSessions` 기본값은 true이고, 프로그램 방식 주입·등록에는 대상 host permission이 필요하다([chrome.scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting), [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)).

  (b)를 쓰면 지원 경로 판정을 script 안으로 옮기고 SPA 이동마다 활성·비활성을 바꾸게 된다. 어느 쪽이든 optional host permission 구조는 유지할 수 있다.
- **WXT의 `defineContentScript` + `createShadowRootUi` + `ctx` 전환도 검토한다.** WXT는 Shadow Root 설정을 추상화하고, `ctx`로 무효화된 context의 비동기 작업을 멈추며, `wxt:locationchange`로 SPA 경로 변화를 감지하는 방법을 문서화한다([WXT content scripts](https://wxt.dev/guide/essentials/content-scripts)). 빠진 것 10번(고아 버튼)을 해결하는 가장 싼 경로다. 현재 프로젝트는 WXT 0.20.26을 쓴다(`apps/chrome-extension/package.json:31`).

### Shadow DOM 버튼과 popover

- 버튼 host는 지금처럼 `span`에 `attachShadow`를 쓴다. MDN 기준 `span`, `div`, 유효한 이름의 autonomous custom element는 shadow root를 가질 수 있고 `<a>`는 안 된다([MDN attachShadow](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow)). 카드 썸네일은 대개 `<a>` 안에 있으므로 host를 `<a>` 자식으로 넣고, 클릭에서 `preventDefault`·`stopPropagation`으로 영상 이동을 막는다. 현재 구현도 이 방식이다(`youtube-overlay-ui.ts:303-306`).
- **popover는 카드마다 만들지 말고 문서 최상위에 하나만 둔다**(`document.body` 직속, `position: fixed`, 높은 z-index). 썸네일의 `overflow`·stacking context에 잘리지 않고, 카드 수만큼 DOM이 늘어나지도 않는다. 현재 전역 Toast가 같은 패턴이다(`youtube-overlay-ui.ts:350-364`). 열 때 버튼의 `getBoundingClientRect()`로 위치를 잡고, 스크롤·resize·SPA 이동 때 닫는다.
- 접근성·닫기 규칙은 `docs/DESIGN.md:261`의 disclosure 계약(Enter·Space로 열기, Escape와 바깥 pointer로 닫기, 닫으면 trigger로 focus 복귀)을 그대로 따른다. 색·서체·그림자는 `docs/chrome-extension/current-implementation-fsd.md:70`(Nintendo red action-primary, Pretendard, whisper-soft shadow)과 `docs/DESIGN.md:144-150`, `:247-255`를 따른다. **`docs/DESIGN.md`에는 YouTube 페이지 위에 뜨는 UI(아이콘 버튼·popover)에 대한 별도 계약이 없다.** 지금은 FSD 70행이 사실상 계약이므로, 구현 전에 DESIGN.md나 FSD에 popover 계약을 추가해야 한다.
- 아이콘은 `docs/chrome-extension/branding-direction.md:21-24`에 따라 YouTube 로고·공식 재생 버튼을 연상시키지 않는 형태로 한다.
- YouTube의 다크 테마와 맞추려면 `html[dark]` 같은 YouTube 속성을 읽어야 한다. 이 속성은 **미확인·비공식**이다. 확장의 `theme-preference`(`apps/chrome-extension/src/shared/theme-preference.ts`)를 재사용할지도 정해야 한다.

### Background 중계와 서버 흐름

- **API 호출은 반드시 Background가 한다.** content script의 요청은 주입된 페이지 origin(youtube.com) 이름으로 나가고 same-origin policy를 따른다. 확장에 host permission이 있어도 content script에서는 cross-origin으로 취급된다. 반면 service worker는 host permission이 있으면 다른 origin과 통신할 수 있다([Cross-origin network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)). API CORS allowlist는 운영·로컬 Web origin과 no-origin만 허용한다(`apps/api/src/cors-options.ts:27-38`, `:61-67`). 그래서 youtube.com origin으로 직접 호출하면 브라우저가 응답을 막는다. 현재 구조(Background가 `host_permissions`의 API origin으로 호출, `wxt.config.ts:32-34`)를 유지하면 CORS 계약을 바꿀 필요가 없다(`docs/chrome-extension/current-implementation-fsd.md:79-80`, `:172`).
- **메시지는 신뢰하지 않는다.** 공식 문서는 content script 메시지를 공격자가 만들었을 수 있다고 가정하고 입력을 검증하라고 한다([Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)). 또 content script가 임의 URL을 요청하게 두지 말라고 한다([Cross-origin network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)). 현재 메시지는 URL 대신 videoId만 받고 canonical watch URL은 Background가 만든다(`apps/chrome-extension/src/features/youtube-overlay/youtube-overlay-download.ts:41-63`). 새 메시지 종류에도 이 원칙을 유지한다.
- 비동기 응답에는 listener에서 `true`를 반환해야 한다([Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)). 현재 코드도 그렇게 한다(`background.ts:114`, `:120`, `:135`).
- **service worker 수명:** 30초 동안 아무 일이 없으면 종료되고, 이벤트나 확장 API 호출이 오면 타이머가 초기화된다. 요청 하나가 5분을 넘거나 fetch 응답이 30초를 넘어도 종료될 수 있다([Service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)). 기존 job manager는 진행 중 job을 storage에 저장하고 1분 alarm으로 복구하므로(`download-job-recovery.ts:1-22`) 이 제약을 이미 감당한다. 긴 추출(수 분)에도 폴링 1회는 짧은 fetch라 문제없다(추정).
- **파일 저장:** `chrome.downloads.download`는 `downloads` 권한이 필요하다. `filename`은 Downloads 디렉터리 기준 상대 경로여야 하며 절대 경로·`..`는 오류가 난다([chrome.downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads)). 현재 제목 정리 로직(`youtube-overlay-download.ts:24-38`, `apps/chrome-extension/src/shared/sanitize-filename.ts`)을 재사용한다.

### 진행·완료 알림

- 최소안: 지금처럼 접수 Toast, 완료 데스크톱 알림, 자동 다운로드를 그대로 쓴다. 추가 작업이 없다.
- 권장안: Background의 job manager `subscribe`(`download-job-manager.ts:70-71`)에 붙어서, 요청을 보낸 `tabId`로 `chrome.tabs.sendMessage`를 보내 상태(`queued`/`processing`/`completed`/`failed`)를 push한다. content script는 해당 videoId의 버튼에 상태 배지를 단다. 탭이 닫혔거나 이동했으면 전송이 실패하므로 무시한다. 서버는 백분율 진행률을 의미 있게 주지 않으므로(`progress`는 상태 기반, `download-job.ts:30-31`, PRD `:46`) 단계 표시만 한다.
- 같은 videoId·type·quality의 asset이 이미 있으면 서버가 즉시 `completed`로 응답한다(`docs/server/endpoints/post-downloads.md:35`). 이 경우 popover를 닫자마자 다운로드가 시작된다.

## 주입 지점과 videoId 추출

| 지점 | 후보 selector(**추정**, 실제 DOM 확인 필요) | videoId 추출 | 근거·상태 |
| --- | --- | --- | --- |
| 홈 grid | `ytd-rich-item-renderer` (내부가 `yt-lockup-view-model`일 수 있음) | 카드 안 `a[href^="/watch?v="]`의 `v` | 현재 selector(`youtube-overlay-ui.ts:17-21`). 홈은 로그인 상태에 따라 달라 curl로 확인하지 못했다(**미확인**) |
| 검색 결과 | `ytd-video-renderer` | 같은 방식 | `/results` 초기 데이터에 `videoRenderer` 29건(관찰) |
| 채널 `/videos` | `ytd-rich-item-renderer` > `yt-lockup-view-model` | 같은 방식 | 초기 데이터 `richItemRenderer.content.lockupViewModel` 30건(관찰). 현재 경로 판정에서 제외(`youtube-page.ts:28-34`) |
| 시청 페이지 추천 | `yt-lockup-view-model` (구 `ytd-compact-video-renderer`) | 같은 방식. 초기 데이터에서는 `lockupViewModel.contentId` + `LOCKUP_CONTENT_TYPE_VIDEO` | `/watch` 초기 데이터 `compactVideoRenderer` 0건, `lockupViewModel` 21건(관찰) |
| 시청 페이지 플레이어 | `#movie_player`의 컨트롤 바(`.ytp-right-controls`) 또는 제목 아래 action 영역(`ytd-watch-metadata #actions`) | `location.pathname === '/watch'`이면 `new URL(location.href).searchParams.get('v')`. URL이 가장 안정적이다 | selector는 **추정**. SPA 이동 때 같은 플레이어 DOM이 재사용되므로, 버튼은 그대로 두고 videoId만 URL에서 다시 읽어야 한다(**추정**) |
| Shorts | `ytm-shorts-lockup-view-model`·`ytd-reel-video-renderer` 등 | `/shorts/{id}` path | 검색 초기 데이터에 `shortsLockupViewModel` 66건(관찰). 현재 제품 결정상 제외(PRD `:44`) |
| 재생목록·기록 등 | `ytd-playlist-video-renderer` 등 | `/watch?v=&list=`에서 `v`만 사용 | **미확인** |

관찰 방법과 한계: 2026-11-12에 일반 데스크톱 User-Agent로 `https://www.youtube.com/watch?v=dQw4w9WgXcQ`, `/results?search_query=lofi`, `/@YouTube/videos`를 비로그인 `curl`로 받아, 응답 HTML 안의 초기 데이터 JSON 키가 나온 횟수를 셌다. 렌더링된 DOM은 보지 않았다. 로그인·실험군(A/B)·지역에 따라 결과가 다를 수 있다.

videoId 추출 원칙:

- **썸네일 링크의 `href`를 1순위로 쓴다.** 현재의 `parseStandardYoutubeWatchUrl`(`youtube-card-url.ts:12-41`)이 그대로 쓸 수 있다. `ytd-thumbnail`이 없는 lockup 구조에서는 링크 자체에 버튼을 붙이는 fallback이 이미 있다(`youtube-overlay-ui.ts:141-142`). 다만 lockup의 썸네일 링크가 `position: relative` 기준 요소로 적절한지는 **미확인**이다.
- 카드 selector에 의존하지 않고 **"`/watch?v=` 링크를 가진 썸네일 이미지"를 기준으로 카드를 역추적**하는 방식이 DOM 변경에 더 강하다(추정). 하나의 카드 안에 같은 videoId 링크가 여러 개 있으므로(썸네일·제목) 카드당 하나만 mount하는 marker 규칙이 필요하다.
- 제목은 파일명에만 쓴다. 서버는 클라이언트 제목을 쓰지 않는다(`docs/server/endpoints/post-downloads.md:35`).

SPA 대응:

- `yt-navigate-finish`, `yt-page-data-updated`는 공식 문서가 없는 **비공식·관찰 기반** 이벤트다. 현재 코드가 쓰고 있다(`youtube-overlay-ui.ts:111-113`). 이벤트가 사라져도 동작하도록 `MutationObserver`를 기본으로 두고 이벤트는 보조로만 쓴다. MDN 기준 `childList`는 자식 노드 추가·삭제를, `subtree`는 대상 아래 전체 subtree를 감시한다([MDN observe()](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe), [MDN MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)).
- 시청 페이지 플레이어 버튼은 URL 변화(WXT `wxt:locationchange` 또는 `popstate`·비공식 이벤트·주기적 `location.href` 비교)로 videoId를 갱신한다.

## 옵션 집합

- **Web과 같은 집합:** 형식 `audio`/`video`, 품질 audio `128/192/320 kbps`, video `360/720/1080p`. Web(`apps/web/src/domain/download-request/download-request.ts:150-162`), 확장(`quality-options.ts:3-7`), API(`docs/server/endpoints/post-downloads.md:11`)가 같은 값을 쓴다. 자막은 YouTube 영상 기준 옵션이 아니므로 제외한다(빠진 것 11번).
- **화질 목록을 미리 조회할 필요는 없다.** worker는 `bestvideo[height<=Q]+bestaudio/best[height<=Q]`로 "요청 품질 이하의 최선"을 고른다(`apps/worker/src/worker.logic.ts:139`). 원본이 480p인 영상에 1080을 요청하면 480p 결과가 나온다(추정, selector 의미 기준). 선택된 format이 없거나 크기 메타데이터가 없을 때만 `YOUTUBE_FORMAT_UNAVAILABLE`로 실패한다(`apps/worker/src/worker.logic.ts:186-204`).
- **미리 조회할 때의 비용:** 현재 API에는 영상별 사용 가능 format을 알려 주는 endpoint가 없다(`apps/api/src/downloads/downloads.controller.ts`, `video.controller.ts`, `audio.controller.ts`의 route 목록). 새로 만들면 popover를 열 때마다 서버가 yt-dlp metadata를 조회해야 한다. 이 조회는 수 초 단위이고, YouTube 쪽 요청 수와 차단 위험이 늘어난다(추정. 클라이언트 fallback·인증 요구 이력: `docs/research/2026-08-24-youtube-extraction-client-investigation.md`, `docs/adr/0002-youtube-default-client-with-web-embedded-fallback.md`). 개인 사용 단계에서는 고정 목록 + "최대 화질" 의미로 표기하는 편이 싸다.
- **원클릭 기본값:** popover에 "마지막 선택으로 바로 받기"를 둘지 정해야 한다. 둔다면 기본값을 Web(320/1080)과 맞출지, 확장(192/720)을 유지할지도 함께 정한다(빠진 것 7번).

## 위험

### YouTube DOM 변경과 SPA

- 렌더러 태그가 계속 바뀌고 있다(`compactVideoRenderer` → `lockupViewModel` 관찰). 고정 selector 목록은 조용히 깨진다. 버튼이 안 보여도 오류가 나지 않으므로 사용자가 늦게 알아챈다.
- 완화책: 링크 기준 역추적 탐지, 실제 youtube.com 대상 수동 점검 체크리스트(`docs/chrome-extension/current-implementation-fsd.md:206`의 기존 원칙). fixture smoke는 실제 DOM 변경을 잡지 못한다.
- 썸네일 hover 미리보기(inline playback)가 버튼을 덮거나 버튼 클릭이 카드 이동으로 새어 나갈 수 있다(**추정**).

### 성능

- `document.documentElement` 전체 subtree에 `childList` 감시를 걸고 100ms마다 전체 카드를 `querySelectorAll`로 다시 훑는다(`youtube-overlay-ui.ts:75-110`). 무한 스크롤로 카드가 수백 개가 되면 scan 비용이 계속 커진다(추정, 측정 안 함).
- 완화책: 이미 처리한 카드는 `WeakSet`으로 건너뛰기, `MutationRecord.addedNodes`만 검사하기, 감시 대상을 `ytd-app` 아래로 좁히기, `requestIdleCallback`. popover는 문서에 하나만 두기.
- 카드마다 Shadow Root와 `<style>`, `@font-face`를 만든다(`youtube-overlay-ui.ts:177-190`, `:438-440`). 카드가 많으면 style 중복 비용이 생긴다. `adoptedStyleSheets` 공유를 검토한다(추정).

### 정책·스토어

- **YouTube 서비스 약관:** "서비스의 명시적 승인, 또는 YouTube 및 해당하는 경우 각 권리 소유자의 사전 서면 승인을 받은 경우를 제외하고는" 서비스나 콘텐츠의 "액세스, 복제, 다운로드, 배포 …"를 금지한다. 자동화된 수단(로봇·스크래퍼 등)으로 서비스에 접근하는 것도 금지한다([YouTube 서비스 약관](https://www.youtube.com/static?template=terms), "권한 및 제한사항"). 이 약관은 배포 방식과 관계없이 사용자 행위에 적용된다. 인라인 버튼은 다운로드를 더 쉽게 만들 뿐, 서버 쪽 추출이 이미 안고 있는 약관 위험(`docs/research/2026-08-24-youtube-extraction-client-investigation.md`의 "기술적 가능성의 증거이지 … 근거는 아니다")을 바꾸지 않는다.
- **Chrome Web Store 프로그램 정책:** 현재 본문(2026-11-12 확인)에는 YouTube를 직접 언급하는 조항이 없다. 대신 "Do not encourage, facilitate, or enable the unauthorized access, download, or streaming of copyrighted content or media."(Malicious and Prohibited Products)와 지식재산권 침해 금지, 반복 위반 시 계정 해지 조항이 있다([Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)). YouTube 페이지에 다운로드 버튼을 끼워 넣는 확장은 이 조항으로 심사 거절·삭제될 가능성이 높다(**추정**, 실제 심사 사례는 1차 자료로 확인하지 못함). 개발자 계정과 연결된 Google 서비스가 정지될 수 있다는 조항도 있다.
- **개인용 unpacked·자체 배포에서 달라지는 점:** `chrome://extensions`에서 개발자 모드를 켜고 "Load unpacked"로 설치하면 스토어 심사를 거치지 않는다([Hello World 튜토리얼](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)). Windows·macOS에서 스토어 밖 CRX를 외부 설치하려면 `update_URL`이 Chrome Web Store를 가리켜야 하고, 관리 정책은 enterprise policy로 한다([Alternative installation methods](https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions)). 즉 macOS 개인 사용에서는 사실상 unpacked 설치만 현실적이다(추정). 스토어 정책 위험은 사라지지만 YouTube 약관 위험은 그대로다. 현재 PRD는 이미 Web Store 배포를 범위 밖으로 두고 있다(`docs/chrome-extension/current-implementation-prd.md:51`, `:81`).
- **ADR 0001과의 연결:** 지금은 한 사람이 자기 브라우저에서 쓰는 단계라 인증이 없다. 공개 서비스로 전환할 때 인증·abuse/rate limit을 다시 설계하기로 되어 있다([ADR 0001](../adr/0001-keep-single-user-mode-until-public-service-transition.md)). 인라인 버튼이 있으면 요청 빈도가 늘어날 수 있으므로, 같은 videoId 연타 방지(pending 잠금, `youtube-overlay-ui.ts:188`, `:204-206`)를 유지한다. 확장을 다른 사람에게 나눠 주는 순간 ADR 0001의 재검토 조건("다른 사람이 실제로 사용")에 해당한다.

### 인증·CORS·보안

- API는 인증이 없다(`docs/server/endpoints/post-downloads.md:34`). CORS는 브라우저가 응답을 읽지 못하게 할 뿐 서버 접근 제어가 아니다. 확장은 Background와 host permission으로 CORS 밖에서 호출하므로 동작에는 문제가 없지만, 같은 이유로 API는 누구나 호출할 수 있다(ADR 0001에서 감수한 위험).
- `web_accessible_resources`는 웹 페이지가 확장을 fingerprint하는 데 쓸 수 있다([web_accessible_resources](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources)). 현재 YouTube 대상으로 폰트 하나를 노출한다(`wxt.config.ts:35-40`). 필요하면 `use_dynamic_url`을 검토한다.
- Shadow Root `mode: 'open'`은 페이지 JS가 `host.shadowRoot`로 접근할 수 있게 한다([MDN attachShadow](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow)). 페이지가 확장 버튼을 조작할 수 있다는 뜻이다. Background가 메시지를 다시 검증하므로 피해 범위는 "다른 videoId로 job 생성" 정도다(추정).

## 미정 결정 목록

1. **배포 방식:** unpacked 개인 사용을 유지하는가(권장), Web Store 등록을 시도하는가. 등록하면 이 기능은 사실상 넣을 수 없다고 봐야 한다(추정).
2. **UI 형태:** 지금의 `MP3`/`MP4` 상시 버튼을 아이콘 1개 + popover로 바꾸는가. popover에 원클릭 기본값(마지막 선택)을 두는가. 버튼을 항상 보일지, 카드 hover 때만 보일지.
3. **주입 범위:** 시청 페이지 플레이어(컨트롤 바와 제목 아래 action 영역 중 어디), 채널 `/videos`, 재생목록, 기록 페이지, Shorts(현재 제외 결정의 재검토)를 각각 넣을지.
4. **기본 품질:** Web(320/1080)과 맞출지, 확장(192/720)을 유지할지.
5. **진행 표시 수준:** 접수 Toast + 데스크톱 알림만 쓰는가, 탭 push로 카드별 상태 배지까지 보여 주는가.
6. **주입 방식:** 지금의 `tabs.onUpdated` + `executeScript`를 유지하는가, 권한 허용 뒤 `registerContentScripts`로 바꾸는가. WXT `defineContentScript`·`createShadowRootUi`·`ctx`로 옮기는가.
7. **디자인 계약 위치:** YouTube 위에 뜨는 UI의 계약을 `docs/DESIGN.md`에 추가하는가, `docs/chrome-extension/current-implementation-fsd.md`에 두는가. YouTube 다크 테마를 따를지.
8. **health 기준:** 확장도 `worker.available`을 확인해 미리 막는가(Web과 동일하게).
9. **Web 내역 연동:** 확장 job을 Web 내역에서도 볼 필요가 있는가. 그렇다면 서버 측 내역이 필요해 ADR 0001 범위를 넘는다.

## 출처

저장소

- `apps/chrome-extension/wxt.config.ts`, `apps/chrome-extension/package.json`
- `apps/chrome-extension/entrypoints/background.ts`, `apps/chrome-extension/entrypoints/youtube-overlay.ts`
- `apps/chrome-extension/src/features/youtube-overlay/*.ts`, `apps/chrome-extension/src/adapters/chrome/{youtube-overlay,downloads,notifications}.ts`
- `apps/chrome-extension/src/features/download-jobs/{download-job-manager,download-job-submit-handler,download-job-recovery}.ts`
- `apps/chrome-extension/src/domain/download-options/{quality-options,download-options}.ts`, `apps/chrome-extension/src/domain/download-job/download-job.ts`, `apps/chrome-extension/src/services/mytube-extract/mytube-extract-client.ts`
- `apps/web/src/domain/download-request/download-request.ts`, `apps/web/src/api/mytube-extract.api.ts`, `apps/web/src/app/utils/request-preference.util.ts`
- `apps/api/src/cors-options.ts`, `apps/api/src/*/*.controller.ts`, `apps/worker/src/worker.logic.ts`
- `docs/server/endpoints/post-downloads.md`, `docs/server/endpoints/get-downloads-job-id-file.md`, `docs/server/endpoints/get-video-id.md`, `docs/web/routes/history.md`, `docs/web/routes/subtitles.md`
- `docs/chrome-extension/current-implementation-prd.md`, `docs/chrome-extension/current-implementation-fsd.md`, `docs/chrome-extension/branding-direction.md`, `docs/DESIGN.md`, `GLOSSARY.md`
- `docs/adr/0001-keep-single-user-mode-until-public-service-transition.md`, `docs/adr/0002-youtube-default-client-with-web-embedded-fallback.md`
- `.scratch/chrome-extension-job-based-downloads/spec.md`, `.scratch/chrome-extension-job-based-downloads/issues/08-overlay-job-manager-migration.md`

외부 공식 문서(2026-11-12 확인)

- [Chrome Extensions: Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome Extensions: Cross-origin network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Chrome Extensions: Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Chrome Extensions: chrome.scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [Chrome Extensions: Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Chrome Extensions: chrome.downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads)
- [Chrome Extensions: web_accessible_resources](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources)
- [Chrome Extensions: Hello World(Load unpacked)](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)
- [Chrome Extensions: Alternative installation methods](https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions)
- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [YouTube 서비스 약관](https://www.youtube.com/static?template=terms)
- [MDN: MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver), [MDN: MutationObserver.observe()](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe)
- [MDN: Element.attachShadow()](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow)
- [WXT: Content Scripts](https://wxt.dev/guide/essentials/content-scripts) (프로젝트가 쓰는 프레임워크의 공식 문서)

비공식·관찰

- `yt-navigate-finish`, `yt-page-data-updated` 이벤트: 공식 문서 없음. 현재 코드에서 쓰는 관찰 기반 이벤트다.
- YouTube 초기 데이터의 렌더러 키 횟수: 2026-11-12 비로그인 `curl` 관찰. DOM 태그와의 대응은 추정이다.
