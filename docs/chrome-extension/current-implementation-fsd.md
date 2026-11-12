# MyTube Extract Chrome Extension 현재 구현 FSD

## 문서 기준

이 문서는 Chrome 확장 프로그램이 MyTube Extract API 서버를 소비하는 방식과 현재 MVP의 한계를 정리한다. API 서버 자체의 요청/응답 상세 계약은 `docs/server/endpoints/*`를 기준으로 하며, 여기서는 확장 프로그램의 화면, 상태, 설정, API 호출 조합을 다룬다.

## 현재 소스 상태

- 확장 프로그램 소스는 `apps/chrome-extension` workspace package가 소유한다.
- WXT가 Manifest V3 build output을 생성하며 source `manifest.json`은 두지 않는다.
- popup entrypoint는 `entrypoints/popup/index.html`과 `entrypoints/popup/main.tsx`가 소유한다.
- Popup과 YouTube 썸네일 Overlay를 함께 제공한다. 정적 `content_scripts`는 사용하지 않고, 사용자가 Popup에서 선택 Host Permission을 허용한 뒤 Background가 `youtube-overlay.js` unlisted script를 주입한다.
- `entrypoints/background.ts`는 MV3 service worker로 permission 상태, YouTube 탭 주입, runtime message 검증, download job 생성·조회·자동 다운로드를 담당한다.
- React popup UI는 `src/app/popup-app.tsx`(아이콘은 `src/app/popup-icons.tsx`)가 소유하며, model snapshot에서 도출한 값만 그린다.
- `src/features/popup-download/popup-download-model.ts`는 popup 초기화, 형식·품질 저장/로드, 활성 탭 자동 읽기, YouTube URL 입력 검증, 무대 원본(`StageSource`)·진행 단계(`StagePhase`)·화면(`PopupView`) 도출, Background job bridge를 통한 제출, 최근 요청 행동, YouTube Overlay 권한 켜기·끄기 상태 전이를 담당한다.
- `src/domain/popup-state/`는 Popup 상태 문장과 무대 타입을, `src/domain/recent-request/`는 최근 요청 표시 상태·행동 도출을 담당한다.
- `src/adapters/chrome/`는 `chrome.storage`, `chrome.downloads`, `chrome.tabs`, `chrome.permissions` callback API를 Promise 기반 adapter로 감싼다.
- `src/features/youtube-overlay/`는 카드 URL·파일명·runtime message 계약, Shadow Root Overlay(형식 아이콘·품질 막대·카드 상태 배지)와 전역 Toast, 저장된 최근 요청으로 카드 상태를 고르는 tracker(`youtube-overlay-card-status.ts`)를 소유한다.
- `src/domain/download-options/`, `src/services/mytube-extract/`는 Chrome runtime 없이 테스트 가능한 YouTube URL 검증/정규화와 API URL 생성을 담당한다.
- `public/icon-*.png`는 WXT가 generated manifest icon으로 발견해 build output에 복사한다.
- `package.json`의 build script는 WXT production build 후 generated manifest/popup 정적 파일 참조와 permission을 검증하고, test script는 URL 검증, job API 매핑, storage key 호환성, job manager·popup 상태 전이를 검증한다.

## 목표 동작

### Popup 진입과 무대

- 사용자가 확장 아이콘을 누르면 popup이 항상 `main`(무대) 화면으로 열린다. `recent`·`settings`는 라우트가 아닌 Popup 내부 상태다.
- Popup은 열릴 때 활성 탭 URL과 제목을 한 번 읽는다. 지원 YouTube 주소이면 원본으로 지정하고 무대(`StageSource.kind = 'tab'`)에 16:9 썸네일과 제목을 올린다. 별도 현재 탭 버튼은 없다.
- 현재 탭이 YouTube가 아니면 무대 자리에 붙여넣기 칸(`empty`)을 보여 준다. 붙여넣기와 직접 입력은 같은 `sourceUrl` 갱신 경로를 쓰며, 유효하면 `pasted` 원본이 된다. YouTube 탭에서도 다른 주소를 붙여넣어 원본을 바꿀 수 있다.
- 지원하지 않는 주소(`invalid`)는 붙여넣기 칸을 오류 색으로 바꾸고 입력 주소와 이유 한 줄을 보여 준다. 지우기 버튼으로 칸을 비운다. 원본이 없거나 잘못되면 추출 버튼은 잠긴다.
- 썸네일은 영상 ID로 만든 YouTube 이미지 주소를 쓰고, 불러오지 못하면 중립 배경과 비디오 아이콘으로 대체한다.
- 제목은 탭 제목에서 YouTube 접미사를 뗀 값이다. 붙여넣은 주소처럼 제목을 모르면 영상 ID를 보여 주고, 접수 후에는 API의 요청 영상 제목이 있으면 그것을 쓴다.

### 진행 단계

- 무대 진행 단계(`StagePhase`)는 무대 영상의 최신 job과 이번 Popup의 제출 결과에서 도출한다: `idle` → `checking`(서버 확인·제출) → `queued` → `processing` → `done`(약 1.8초 뒤 `idle`로 복귀), 실패는 `failed`(job 실패·서버가 거부한 접수, 서버 메시지 표시)와 `unreachable`(서버 연결 실패, 구름 아이콘과 `서버에 연결할 수 없어요`)로 구분한다.
- `checking`·`queued`·`processing`은 무대 위 흰 회전 링(대기는 링 안 시계 아이콘)이고 숫자가 없다. 형식·품질·파일명 편집과 그 영상의 제출이 잠긴다. `done`은 초록 체크 덮개, 실패는 어두운 덮개 위 crimson 아이콘과 오류 한 줄이다.
- 다른 영상의 job 진행은 무대에 영향을 주지 않고 최근 요청 줄에만 반영한다. 여러 job을 독립적으로 추적하는 동작은 유지한다.
- Popup을 닫았다 열어도 같은 영상의 job이 진행 중이면 무대에 그 단계가 다시 보인다.
- 단계가 바뀔 때마다 live region으로 `서버 확인 중`, `대기 중`, `처리 중`, `다운로드를 시작했어요`를 읽는다. 오류 문장은 모두 한국어다.

| 무대 단계 | 추출 버튼 |
| --- | --- |
| 원본 없음·잘못됨 | 잠김(회색, 다운로드 아이콘) |
| `idle`·`done` | 빨강, 다운로드 아이콘, 이름 `추출 시작` |
| `checking`·`queued`·`processing` | 잠김, 파란 회전 아이콘 |
| `failed`·`unreachable` | 빨강, 다시 시도 아이콘, 이름 `다시 시도`(같은 조건 재제출) |

### 다운로드 모드

- 사용자는 형식 아이콘 두 칸(파형 = `오디오 MP3`, 필름 = `비디오 MP4`) 중 하나를 선택한다.
- 오디오 모드는 MyTube Extract API의 오디오 URL 다운로드 계약을 사용한다.
- 비디오 모드는 MyTube Extract API의 비디오 URL 다운로드 계약을 사용한다.

### 옵션 입력

- 공통 옵션:
  - 원본 URL `sourceUrl`(저장하지 않음)
  - 다운로드 파일명 `filename`(저장하지 않음, 영상별 값)
- 오디오 옵션:
  - 최대 오디오 비트레이트 `bitrate`: `128 / 192 / 320 kbps` 고정 선택지 중 하나. 기본값은 `192`.
- 비디오 옵션:
  - 최대 영상 높이 `resolution`: `360 / 720 / 1080p` 고정 선택지 중 하나. 기본값은 `720`.

`bitrate`, `resolution`은 YouTube 썸네일 Overlay와 같은 고정 선택지를 공유하며(`src/domain/download-options/quality-options.ts`), 임의의 숫자를 직접 입력할 수 없다. 품질은 높이가 다른 막대 세 개의 radiogroup이고, 각 막대 아래에 실제 값을 보이며, 선택한 값 이하의 막대를 채운다. 저장된 값이 고정 선택지를 벗어나면(과거 버전에서 저장된 값 포함) 해당 모드 기본값으로 대체한다. 형식·품질은 `chrome.storage`에 저장해 다음에 복원한다.

### 파일명

- 무대 아래 제목 줄이 파일명이다. 연필 버튼을 누르면 입력칸과 형식 확장자(`.mp3`/`.mp4`) 표시로 바뀌고, Enter 또는 체크 버튼으로 확정한다.
- 편집하지 않거나 빈 값으로 확정하면 영상 제목 기반으로 정리한 기본 이름(Overlay와 같은 규칙, 실패 시 영상 ID)을 쓴다. 입력 끝의 확장자는 중복되지 않게 떼고, 경로 구분자·제어 문자를 정리한다.
- 파일명은 저장하지 않는다. 원본 영상이 바뀌면 편집 값을 비운다.

API base URL은 `WXT_MYTUBE_EXTRACT_API_BASE_URL` 환경 변수로 정하며 popup에서 사용자 입력을 받지 않는다. 운영 값은 `https://mytube-extract-api.codeliners.cc`, 로컬 값은 `http://127.0.0.1:5011`만 사용한다. 기존 `WXT_MEDIA_NEST_API_BASE_URL`은 runtime fallback으로, `MYTUBE_EXTRACT_API_BASE_URL`과 `MEDIA_NEST_API_BASE_URL`은 `wxt.config.ts` host permission fallback으로만 지원한다.

### Download job 흐름

- Popup과 YouTube Overlay는 Background에 `POST /downloads` job 생성을 요청하고, 생성 직후 접수 상태를 받는다.
- Background의 job manager가 `GET /downloads/{jobId}`를 2.5초 간격으로 조회하고, 진행 중 job은 `chrome.storage.local` active record로 저장한다.
- Service worker가 재시작되면 active record를 즉시 다시 조회하고, 완료된 job만 `GET /downloads/{jobId}/file`을 `chrome.downloads.download()`로 시작한다.
- 완료·실패 job은 최근 요청 목록에 최대 5건 보관하고, 6번째 job이 추가되면 가장 오래된 완료·실패 job부터 제거한다. 대기·처리 중 job은 목록 상한을 넘겨도 유지한다. 실패 job은 데스크톱 알림에서 같은 입력으로 재시도할 수 있다.
- 확장 job 표현은 API 응답의 `sourceUrl`과 요청 영상 제목(`title`)을 보존하고, 영상 ID는 `sourceUrl`에서 도출한다. 이 값이 없는 예전 저장 job은 썸네일 대신 중립 배경과 형식 아이콘을 보여 준다.

### 최근 요청

- 추출 버튼 아래 최근 요청 줄은 최신 3건의 썸네일과 더보기 버튼을 보여 주고, 누르면 Popup 안의 `recent` 화면이 열린다. 기록이 없으면 줄을 숨기고, `recent` 화면에서 빈 상자 아이콘을 보여 준다.
- 썸네일 모서리 배지는 대기(회색 시계)·처리(파랑)·완료(초록 체크)·실패(crimson 느낌표)이고, 만료는 흐린 썸네일이다.
- 목록 항목은 썸네일, 영상 제목, 형식 아이콘과 품질, 요청 시각, 상태 아이콘과 상태명, 행동 하나를 보여 준다.
  - 완료: `다시 내려받기`. 보관 기간 안의 `downloadUrl`로 로컬 다운로드를 다시 시작한다.
  - 실패: `다시 시도`, 만료: `다시 요청`. 둘 다 job의 원본·형식·품질과 기본 파일명으로 알림 재시도와 같은 Background 제출 경로를 쓴다. 같은 영상의 job이 진행 중이면 잠긴다.
  - 대기·처리: 행동 없이 상태 아이콘만 둔다.
- 뒤로 버튼으로 무대 화면에 돌아간다.

### 설정 화면

- 헤더의 격자 아이콘과 설정 아이콘이 Popup 안의 `settings` 화면을 연다. 격자 아이콘의 점은 썸네일 버튼 상태를 보여 준다: 빨간 점 = 아직 켜지 않음, 초록 점 = 켜짐, crimson 점 = 거부·오류.
- 테마 선호는 시스템·라이트·다크 세 칸(모니터·해·달 아이콘)이고 기존 저장 방식을 유지한다.
- 썸네일 버튼 행: 꺼짐(스위치) → 켜기(권한 요청 중 회전 아이콘) → 켜짐(스위치 on), 거부·오류는 crimson 행·이유 한 줄·`권한 다시 요청` 버튼이다. 켜진 스위치를 끄면 YouTube optional host permission을 제거하고 이후 자동 주입이 멈춘다. 이미 열린 탭의 버튼은 다음 이동이나 새로고침 때 사라진다.
- 저작권·플랫폼 정책 안내와 완료 파일 보관 기간(job의 `retentionDays`, 기본 7일) 안내를 보여 준다.
- 서버가 `displayStatus: expired`를 반환하거나 완료 URL이 없으면 성공 다운로드로 처리하지 않고 실패 상태·재시도 경로로 표시한다.

### YouTube 썸네일 Overlay

- Popup 설정 화면의 썸네일 버튼 스위치를 켤 때 `https://www.youtube.com/*` optional Host Permission을 요청하고, 끌 때 해제한다.
- 권한을 거부해도 Popup의 무대·붙여넣기·파일명 편집·오류 복구 흐름은 계속 사용할 수 있다.
- 권한이 허용되면 홈, 검색 결과, 구독 피드, 시청 페이지 추천 영역의 일반 영상 카드에만 Overlay를 표시한다. Shorts URL은 제외한다.
- 썸네일에 마우스를 올리거나 키보드로 포커스하면 오른쪽 위에 형식 원형 아이콘 버튼 두 개(오디오·비디오)와 품질 막대 세 개가 나타난다. 오디오를 고르면 막대 숫자가 `128 / 192 / 320`(kbps), 비디오면 `360 / 720 / 1080`(p)이 된다. 형식 선택은 같은 페이지 안에서만 기억한다.
- 품질 막대를 누르면 별도 패널 없이 바로 기존 `youtube-overlay-download` 메시지로 접수한다.
- 카드 제목을 파일명 후보로 전달하고 Background에서 경로 구분자·제어 문자를 제거한다. 제목이 비어 있거나 `.`/`..`이면 video ID를 사용한다.
- 카드 진행 상태: Overlay 스크립트가 저장된 최근 요청 목록(`recentDownloadJobs`)의 storage 변경을 구독하고, 카드 영상 ID와 같은 영상의 최신 job 상태를 카드 왼쪽 위에 그린다. 대기는 시계와 회전 링, 처리는 회전 링, 완료는 초록 체크 배지(약 3초 뒤 사라짐), 실패는 crimson 다시 시도 버튼 배지다. 실패 배지를 누르면 같은 형식·품질로 다시 접수한다. 배지는 호버와 관계없이 보이고, 카드가 다시 그려져도 같은 매칭으로 다시 표시한다. 최근 5건 보관 목록에 있는 job만 표시하고, 만료된 job은 표시하지 않는다. 새 background→content 메시지는 쓰지 않는다.
- 페이지에는 단일 전역 Toast를 사용한다. 접수·실패 Toast는 미니 썸네일, 상태 아이콘, 형식 아이콘과 품질, 닫기 버튼으로 구성하고 실패 Toast에는 다시 시도 버튼을 더한다. 문장은 화면에 보이지 않고 live region으로만 전달한다. 백분율 진행률은 표시하지 않는다.
- Overlay UI는 카드 Shadow Root에 격리하고, `docs/DESIGN.md`의 "Chrome popup·Overlay 최소 UI 계약"(어두운 scrim 위 흰 아이콘, 44px 조작 영역, blue focus, 줄어든 동작 설정에서 회전 정지)과 `Pretendard Variable`을 적용한다.

## API 호출 계약

### 서버 기준

- 운영 API 서버 주소는 `https://mytube-extract-api.codeliners.cc`다.
- 로컬 API 서버 주소는 `http://127.0.0.1:5011`다.
- 서버 상태 확인은 `GET /health`를 사용한다.
- API CORS는 no-origin 요청, 운영 web origin, local preview/dev origin만 허용한다.
- 고정 extension ID 기반 `chrome-extension://...` origin 허용은 현재 제외되어 있으므로 확장 프로그램 MVP의 필수 조건으로 두지 않는다.

### Download job API

확장 프로그램은 아래 job endpoint를 사용한다. API 서버의 job 생성·상태·파일 응답 계약은 `docs/server/endpoints/*`를 기준으로 한다.

```text
POST /downloads
GET /downloads/{JOB_ID}
GET /downloads/{JOB_ID}/file
```

job 생성 body는 `type`, `url`, `quality`를 사용하며 popup·overlay가 선택한 품질은 Background message 경계에서 mode별 허용 조합으로 다시 검증한다. 파일명은 서버 요청에 포함하지 않고 `chrome.downloads.download()` 호출 시 로컬 filename으로만 전달한다.

상태 조회 응답의 `downloadUrl`이 유효한 완료 job만 로컬 다운로드한다. `displayStatus: expired`는 실제 `status: completed`와 별개로 파일이 더 이상 없다는 뜻이므로 실패 안내로 처리한다.

### 서버에 유지되는 기존 직접 다운로드 계약

API 서버는 기존 직접 다운로드 계약도 계속 지원하지만, 현재 Chrome 확장 프로그램 job 흐름에서는 사용하지 않는다.

```text
GET /audio?url={MEDIA_URL}
GET /audio?url={MEDIA_URL}&filename={FILENAME}&bitrate={BITRATE}
GET /video?url={MEDIA_URL}
GET /video?url={MEDIA_URL}&filename={FILENAME}&resolution={RESOLUTION}
```

직접 endpoint 응답은 각각 `audio/mpeg` 또는 `video/mp4` content type과 attachment disposition을 가진 파일 다운로드다.

### 유지되는 서버 호환 계약

API 서버는 기존 YouTube video ID path endpoint도 계속 지원한다.

```text
GET /audio/{YOUTUBE_VIDEO_ID}
GET /video/{YOUTUBE_VIDEO_ID}
```

Chrome 확장 프로그램은 현재 `POST /downloads`와 job 상태·파일 endpoint를 사용한다.

## URL 입력 규칙

- `sourceUrl`은 비어 있으면 안 된다.
- `sourceUrl`은 `youtube.com/watch`, `www.youtube.com/watch`, `youtu.be/{id}`, `www.youtu.be/{id}`, `youtube.com/shorts/{id}`, `www.youtube.com/shorts/{id}` URL이어야 한다.
- `v` query 값은 11자 YouTube video ID 형식이어야 한다.
- `youtu.be`와 Shorts URL은 API 호출 전 `https://www.youtube.com/watch?v={id}` 형식으로 정규화한다.
- 기타 `http/https` URL은 이번 확장 프로그램 MVP에서 지원하지 않는다.
- 입력한 원본 URL은 기본적으로 Chrome storage에 저장하지 않는다.

## Popup 상태

| 상태(`PopupStatusKind`) | 무대 | 조건 | 사용자 동작 |
| --- | --- | --- | --- |
| `missing-source-url` | `empty` 붙여넣기 칸 | 원본 URL이 비어 있음(YouTube가 아닌 탭 포함) | 주소 붙여넣기·입력 |
| `invalid-source-url` | `invalid` 오류 칸 | 원본 URL이 지원 YouTube URL 형식이 아님 | 지우고 다시 입력 |
| `ready` | `tab`·`pasted`, `idle` | 원본 URL이 유효한 지원 YouTube URL임 | 형식·품질을 골라 추출 |
| `checking-server` | `checking` | `/health` 확인·제출 중 | 대기 |
| `job-queued` | `queued` | job이 생성되어 대기 중 | 대기(Popup을 닫아도 계속) |
| `job-processing` | `processing` | 서버가 추출·업로드를 처리 중 | 대기(Popup을 닫아도 계속) |
| `download-started` | `done` | job 완료 후 로컬 다운로드 시작 | 약 1.8초 뒤 준비 상태로 복귀 |
| `download-failed` | `failed` | job 실패, 서버가 거부한 접수, 만료, Chrome 다운로드 시작 실패 | 같은 자리에서 다시 시도 |
| `server-unreachable` | `unreachable` | `/health` 요청 실패·비정상 응답 등 서버 연결 실패 | 같은 자리에서 다시 시도 |
| `options-save-failed` | 단계 변화 없음 | 형식·품질 저장 실패 | 안내만 표시 |

## Chrome 권한과 파일 구조

### Manifest

- `storage`는 모드, 비트레이트, 해상도 같은 non-sensitive 기본 옵션과 job 기록 저장에 사용한다. 파일명과 원본 URL은 저장하지 않는다.
- `downloads` 권한은 Chrome downloads API로 다운로드를 시작하는 데 사용한다.
- `activeTab`은 확장 아이콘 클릭으로 부여되며, Popup이 열릴 때 활성 탭 URL·제목을 한 번 읽는 데 사용한다. 이 때문에 manifest 권한을 늘리지 않는다.
- `scripting`은 권한 허용 후 현재 YouTube 탭에 `youtube-overlay.js`를 주입하는 데 사용한다.
- `optional_host_permissions`는 `https://www.youtube.com/*` 하나만 선언한다. YouTube 권한은 사용자가 Popup 설정 화면의 썸네일 버튼 스위치를 켤 때만 요청하고, 끌 때 해제한다.
- `content_scripts` manifest 등록은 사용하지 않는다. WXT unlisted script 산출물은 Background의 `chrome.scripting.executeScript()`로 주입한다.
- `web_accessible_resources`는 YouTube Shadow Root에서 기존 `public/fonts/PretendardVariable.woff2`를 사용할 수 있도록 YouTube match에 한해 노출한다.
- `host_permissions`는 `WXT_MYTUBE_EXTRACT_API_BASE_URL`, `MYTUBE_EXTRACT_API_BASE_URL`, `WXT_MEDIA_NEST_API_BASE_URL`, `MEDIA_NEST_API_BASE_URL` 순서로 origin을 고르고, 값이 없거나 URL parsing에 실패하면 `https://mytube-extract-api.codeliners.cc/*`를 사용한다. 값은 셸 환경 변수와 `apps/chrome-extension/.env*` 파일에서 읽고, 셸 값이 우선한다. WXT가 config module을 평가한 뒤에 `.env`를 적재하므로 `manifest`는 함수로 두어 runtime `import.meta.env`와 같은 주소를 보게 한다. `tools/verify-extension-package.js`도 같은 `.env*` 파일 순서로 기대값을 계산한다. 운영 build는 `https://mytube-extract-api.codeliners.cc/*`, 로컬 dev는 `http://127.0.0.1:5011/*`만 필요하다.
- manifest 값은 `wxt.config.ts`와 WXT popup entrypoint에서 생성되며, production output은 `.output/chrome-mv3/manifest.json`에 생성된다.

### Popup

- WXT popup entrypoint는 React app mount와 style import를 담당한다.
- Popup application model은 형식·품질 로드/저장, 활성 탭 자동 읽기, URL 입력 검증, 무대·화면 상태 도출, Background job bridge 구독·제출, 최근 요청 행동, YouTube Overlay 권한 켜기·끄기 상태 전이를 담당한다.
- React component는 도출된 상태 렌더링과 사용자 입력 전달만 담당한다.
- `main` 화면은 무대(또는 붙여넣기 칸), 파일명 제목 줄, 형식 아이콘 두 칸, 품질 막대 세 개, 추출 버튼, 최근 요청 줄을 제공한다. 헤더에는 로고, 격자 아이콘(썸네일 버튼 상태 점), 설정 아이콘을 둔다.
- 테마·썸네일 버튼 권한·정책·보관 안내는 `settings` 화면에, 최근 요청 목록은 `recent` 화면에 둔다.
- API 서버 주소는 UI에 표시하거나 입력받지 않는다.

### Background와 메시지

- Content Script는 `youtube-overlay-download` 메시지에 mode, 숫자 quality, video ID, 제목을 담아 전달한다. Popup도 `download-job-submit` 메시지로 mode·문자열 quality·원본 URL·로컬 파일명을 전달한다.
- Background는 두 메시지를 다시 검증하고 공용 job manager에서 job 생성·폴링·active/recent storage 저장·알림·`chrome.downloads.download()`를 수행한다.
- Background의 `/health` 확인과 다운로드 URL 실행은 확장 API host permission 경계에서 수행하므로 API CORS 계약은 변경하지 않는다.
- Popup은 `youtube-overlay-enable` 메시지로 현재 활성 YouTube 탭 주입을 요청한다. 이후 YouTube navigation과 새 탭은 권한 상태를 확인한 뒤 자동 주입한다.

## 다운로드 실행 방식 결정

현재 MVP는 `chrome.downloads.download`를 사용한다. 구현 중 권한 또는 런타임 제약이 확인되면 다운로드 URL을 새 탭 또는 현재 창으로 여는 방식으로 축소할 수 있다.

| 방식 | 장점 | 주의사항 |
| --- | --- | --- |
| 다운로드 URL을 새 탭 또는 현재 창으로 열기 | attachment 응답을 브라우저 기본 다운로드 흐름에 맡길 수 있음 | popup 상태에서 시작 결과를 세밀하게 알기 어려움 |
| `chrome.downloads.download` 사용 | 다운로드 시작 실패를 extension에서 더 명확히 다룰 수 있음 | `downloads` 권한과 URL 접근 권한을 manifest에 반영해야 함 |

## 검증 기준

- Chrome load unpacked에서 manifest 오류 없이 확장 프로그램이 로드된다.
- popup이 CSS와 script를 정상 로드한다.
- 지원 YouTube 탭에서 popup을 열면 원본이 자동 지정되어 무대에 썸네일·제목이 보인다. YouTube가 아닌 탭에서는 붙여넣기 칸이 보인다.
- 원본 URL 입력이 비어 있으면 다운로드 액션이 비활성화된다.
- 원본 URL 입력이 유효하지 않으면 다운로드 액션이 비활성화되고 URL 오류 상태를 보여준다.
- 원본 URL 입력이 유효한 YouTube watch, youtu.be, Shorts URL이면 현재 탭 위치와 관계없이 다운로드 액션이 활성화된다.
- 제출 후 무대 단계가 `checking` → `queued` → `processing` → `done` → `idle`로 바뀌고, job 실패는 `failed`, 서버 연결 실패는 `unreachable`로 구분된다. 다른 영상의 job은 무대 단계를 바꾸지 않는다.
- 파일명은 storage에 저장되지 않고 원본이 바뀌면 비워진다. 형식·품질은 저장된다.
- 오디오·비디오 모드에서 `POST /downloads` body에 mode별 품질과 정규화한 source URL이 전달된다.
- job 상태 조회가 완료되면 file endpoint URL과 선택한 local filename으로 Chrome 다운로드가 시작된다.
- Popup과 Overlay에서 서로 다른 mode·quality 조합이 Background message 경계를 통과하지 않는다.
- `bitrate`는 `128/192/320`, `resolution`은 `360/720/1080` 중에서만 고를 수 있고, 저장된 값이 이 범위를 벗어나면 각 모드 기본값으로 대체된다.
- API base URL은 `WXT_MYTUBE_EXTRACT_API_BASE_URL`을 사용하고 popup UI에서 바꿀 수 없다.
- 서버가 꺼져 있거나 health check가 실패할 때 사용자에게 서버 미응답 상태를 보여준다.
- `pnpm --filter chrome-extension run dev`는 API health와 WXT dev output manifest 준비 상태를 터미널에 표시하고, `http://localhost:3000/popup.html` 개발용 preview를 자동으로 열어 popup UI를 바로 볼 수 있게 해야 한다.
- 개발용 preview는 Chrome extension runtime이 없는 localhost 환경에서만 fake Chrome API를 설치하고, 실제 extension runtime에서는 기존 Chrome API를 그대로 사용해야 한다.
- `pnpm dev:smoke`는 이미 실행 중인 WXT dev output `.output/chrome-mv3-dev`를 load unpacked로 열어 popup 렌더링을 빠르게 확인한다.
- `pnpm --filter chrome-extension run build`가 WXT generated manifest, popup asset, 권한, icon 참조를 검증한다.
- `pnpm --filter chrome-extension run test`가 URL 검증, job API 매핑, active/recent storage 직렬화·복구, popup 상태 전이, Overlay 품질·메시지·파일명·권한 계약을 검증한다.
- `pnpm --filter chrome-extension run lint`가 WXT type generation과 TypeScript compile을 검증한다.
- `pnpm --filter chrome-extension run test:browser`가 실제 API `/health`, WXT load unpacked 렌더링, built popup의 무대 자동 지정·붙여넣기 칸·잘못된 주소·서버 실패·접수 거부·다운로드 시작·파일명 편집·진행 복원·최근 요청 줄과 목록·설정 화면의 테마와 썸네일 버튼 권한 흐름, 그리고 Overlay 스모크를 검증한다. 실제 API에는 `/health` GET만 보내고 나머지 API 응답은 가짜로 대신한다. `MYTUBE_EXTRACT_POPUP_SCREENSHOT_DIR`·`MYTUBE_EXTRACT_OVERLAY_SCREENSHOT_DIR`를 지정하면 상태별 캡처를 남긴다.
- `pnpm --filter chrome-extension run test:browser:overlay`가 Overlay unlisted script의 형식 아이콘·품질 막대, 품질 클릭 제출, 저장된 job 변경에 따른 카드 상태 배지, 실패 배지 재시도, 전역 Toast, Shorts 제외, 동적 카드, 중복 주입을 검증한다.
- 실제 Chrome에서 새 프로필로 optional permission을 허용한 뒤 YouTube 홈·검색·구독·시청 추천 영역을 직접 열어 selector와 실제 다운로드를 확인해야 한다. 자동 fixture smoke 통과만으로 실제 YouTube 동작을 완료 처리하지 않는다.

## 후속 보류 사항

- API 서버 계약 변경
- 고정 extension ID 기반 CORS 허용
- Chrome Web Store 배포 자동화
- shared package로 API client 또는 URL builder 추출
- 실제 다운로드 진행률 표시
- 입력 URL 저장 또는 최근 URL 목록
- YouTube Shorts Overlay 지원
