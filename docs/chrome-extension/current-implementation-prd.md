# MyTube Extract Chrome Extension 현재 구현 PRD

## Problem Statement

MyTube Extract API 서버는 URL 또는 YouTube 영상 ID를 기반으로 오디오와 비디오 파일 다운로드 응답을 제공한다. Chrome 확장 프로그램은 Popup을 열면 현재 탭의 YouTube 영상을 바로 원본으로 지정하고, 사용자가 YouTube 목록을 탐색하는 중 썸네일에서 바로 오디오·비디오 추출을 시작하고 그 진행을 확인할 수 있게 한다.

사용자는 API 경로와 query string을 직접 조합하지 않고도, 가진 YouTube URL·현재 열어둔 YouTube 탭·영상 썸네일에서 오디오 또는 비디오 다운로드를 시작할 수 있어야 한다.

## Solution

Chrome 확장 프로그램은 WXT + React + TypeScript Popup과 MV3 Background, YouTube unlisted Overlay script로 구현되어 있다. Popup과 Overlay는 Background에 job 생성을 요청하고, Background가 상태 조회·재시작 복구·완료 파일 다운로드를 소유한다. Popup은 글자를 최소화한 A안("무대")으로 구성한다. 첫 화면은 현재 영상을 16:9 썸네일로 보여 주는 무대, 파일명을 겸하는 제목 줄, 형식 아이콘 두 칸, 품질 막대 세 개, 추출 버튼, 최근 요청 썸네일 줄이다. 진행은 무대 위 덮개와 숫자 없는 링으로 보여 주고, 최근 요청 목록과 설정은 Popup 안의 별도 화면(`recent`, `settings`)으로 연다. 권한을 허용한 사용자는 일반 YouTube 영상 카드의 썸네일에서 형식 아이콘과 품질 막대로 같은 job 흐름을 바로 시작하고, 그 카드 위에서 대기·처리·완료·실패 상태를 볼 수 있다.

화면 계약은 `docs/DESIGN.md`의 "Chrome popup·Overlay 최소 UI 계약"을, 결정의 원본은 `.scratch/chrome-extension-visual-minimal-ui/spec.md`를 따른다.

API 서버 제품 개요는 `docs/api/current-implementation-prd.md`, endpoint별 상세 계약은 `docs/server/endpoints/*`를 기준으로 소비하며, 이번 범위에서는 서버 엔드포인트나 응답 계약을 변경하지 않는다.

## User Stories

1. YouTube URL을 가진 사용자로서, 나는 YouTube가 아닌 페이지에서 popup을 열면 무대 자리의 붙여넣기 칸에 URL을 넣고 싶다. 그래서 현재 탭 위치와 관계없이 추출을 시작할 수 있다.
2. 오디오 다운로드 사용자로서, 나는 오디오 다운로드를 선택할 수 있기를 원한다. 그래서 URL의 미디어에서 mp3 오디오만 추출할 수 있다.
3. 비디오 다운로드 사용자로서, 나는 비디오 다운로드를 선택할 수 있기를 원한다. 그래서 URL의 미디어를 mp4 파일로 받을 수 있다.
4. 다운로드 옵션을 조정하는 사용자로서, 나는 무대 아래 제목 줄을 연필로 눌러 이번 영상의 파일명을 바꾸고 싶다. 그래서 내려받는 파일을 나중에 쉽게 찾을 수 있고, 다른 영상으로 옮기면 바꾼 이름이 남지 않는다.
5. 오디오 다운로드 사용자로서, 나는 128/192/320 kbps 중에서 오디오 비트레이트를 고르고 싶다. 그래서 서버가 지원하는 값만 API 서버의 `bitrate` 옵션으로 전달된다.
6. 비디오 다운로드 사용자로서, 나는 360/720/1080p 중에서 영상 해상도를 고르고 싶다. 그래서 서버가 지원하는 값만 API 서버의 `resolution` 옵션으로 전달된다.
7. 일반 사용자로서, 나는 API 서버 주소를 직접 설정하지 않고 운영 API를 사용하고 싶다. 그래서 설정 없이 바로 추출할 수 있다.
8. 잘못된 URL을 입력한 사용자로서, 나는 붙여넣기 칸이 오류 색으로 바뀌고 이유 한 줄이 보이기를 원한다. 그래서 왜 추출 버튼이 잠겼는지 알 수 있다.
9. API 서버에 연결할 수 없는 사용자로서, 나는 일반 실패와 다른 구름 아이콘과 서버 연결 실패 문장을 보고 싶다. 그래서 확장 프로그램이나 영상 문제가 아니라 서버 상태 문제임을 구분할 수 있다.
10. YouTube 탭을 보고 있는 사용자로서, 나는 popup을 열자마자 현재 탭 영상이 무대에 올라오기를 원한다. 그래서 버튼을 더 누르지 않고 추출 버튼만 누르면 된다.
11. YouTube 목록을 탐색하는 사용자로서, 나는 일반 영상 썸네일에 마우스를 올려 형식 아이콘(오디오·비디오)을 고르고 싶다. 그래서 URL을 복사하지 않고 추출을 시작할 수 있다.
12. 썸네일에서 추출하는 사용자로서, 나는 128/192/320 kbps 또는 360/720/1080p 품질 막대를 누르면 바로 접수되기를 원한다. 그래서 한 번의 클릭으로 요청할 수 있다.
13. 처음 기능을 사용하는 사용자로서, 나는 Popup 설정 화면의 썸네일 버튼 스위치로 YouTube 권한을 한 번 허용하고, 원하면 같은 스위치로 다시 해제하고 싶다. 그래서 지원 페이지에서 썸네일 버튼을 쓸지 스스로 정할 수 있다.
14. 썸네일에서 추출한 사용자로서, 나는 그 썸네일 위에 대기·처리 링, 완료 체크, 실패 다시 시도 배지가 남기를 원한다. 그래서 페이지를 떠나지 않고 그 영상이 어떻게 됐는지 알 수 있다.
15. 진행을 확인하는 사용자로서, 나는 처리 중에 숫자 없는 회전 링을 보고 싶다. 그래서 실제가 아닌 진행률에 속지 않는다.
16. 최근 요청을 확인하는 사용자로서, 나는 상태 배지를 단 썸네일 줄과 펼친 목록에서 다시 다운로드·다시 시도·다시 요청을 하고 싶다. 그래서 같은 조건을 다시 입력하지 않는다.

## Implementation Decisions

- Chrome 확장 프로그램 문서는 `docs/chrome-extension`이 소유하고, API 서버 문서는 `docs/api`가 소유한다.
- Popup은 열릴 때 활성 탭 URL을 한 번 읽고, 지원 YouTube 주소이면 원본으로 지정해 무대에 올린다. 현재 탭이 YouTube가 아니면 무대 자리에 붙여넣기 칸을 보여 준다. 붙여넣기·직접 입력으로 다른 영상으로 바꿀 수 있다. 별도의 현재 탭 가져오기 버튼은 두지 않는다.
- WXT는 extension entrypoint와 generated manifest를 소유하고, React는 popup UI rendering만 담당한다.
- Chrome storage/downloads API, MyTube Extract API URL 생성, popup 상태 전이는 React component 밖의 TypeScript module로 분리한다.
- 현재 MyTube Extract API의 job 계약을 그대로 사용한다. 확장 프로그램은 `POST /downloads`, `GET /downloads/{jobId}`, `GET /downloads/{jobId}/file`을 호출하며 기존 직접 `/audio`·`/video` 서버 계약은 변경하지 않는다.
- API base URL은 `WXT_MYTUBE_EXTRACT_API_BASE_URL` 환경 변수로 정하고 사용자 입력 UI를 제공하지 않는다. 운영 값은 `https://mytube-extract-api.codeliners.cc`, 로컬 값은 `http://127.0.0.1:5011`만 사용한다. 기존 `WXT_MEDIA_NEST_API_BASE_URL`, non-WXT `MYTUBE_EXTRACT_API_BASE_URL`, `MEDIA_NEST_API_BASE_URL`은 빌드 설정 전환 기간의 fallback으로만 지원한다.
- 파일명은 무대 아래 제목 줄이다. 편집하지 않으면 영상 제목 기반으로 정리한 기본 이름(실패 시 영상 ID)을 쓰고, 편집 값은 이번 영상에만 쓰며 Chrome storage에 저장하지 않는다. 원본 영상이 바뀌면 편집 값을 비운다. 형식·품질은 계속 저장한다.
- 오디오 비트레이트(`128/192/320 kbps`)와 비디오 해상도(`360/720/1080p`)는 Popup에서도 YouTube 썸네일 Overlay와 동일한 고정 선택지 중에서만 고를 수 있다. 임의의 숫자를 직접 입력할 수 없다.
- 입력한 원본 URL은 기본적으로 Chrome storage에 저장하지 않는다.
- 확장 아이콘 클릭으로 부여되는 `activeTab`으로 Popup을 열 때 활성 탭 URL·제목을 한 번 읽는다. manifest 권한은 늘리지 않는다.
- 썸네일 기능은 Popup 설정 화면의 썸네일 버튼 스위치를 켤 때 `https://www.youtube.com/*` optional Host Permission을 요청하고, 스위치를 끄면 그 권한을 해제해 이후 자동 주입을 멈춘다. 이미 열린 탭의 버튼은 다음 이동이나 새로고침 때 사라진다. 거부해도 Popup 흐름은 유지한다.
- 테마 선호, 썸네일 버튼 스위치, 정책 안내, 완료 파일 보관 기간 안내는 Popup 내부 설정 화면에 둔다. 헤더 격자 아이콘의 표시(빨간 점·초록 체크 배지·crimson 느낌표 배지)가 썸네일 버튼 상태(아직 켜지 않음·켜짐·거부)를 보여 준다.
- 썸네일 Overlay는 홈, 검색 결과, 구독 피드, 시청 페이지 추천 영역, 채널 홈·동영상 탭·채널 안 검색의 표준 영상 카드만 대상으로 하고 Shorts와 재생목록 카드는 제외한다.
- MP3 품질은 `128/192/320 kbps`, MP4 품질은 `360/720/1080p`이며 숫자 선택 즉시 Background가 job 생성 요청을 만든다. Popup·Overlay message 경계에서도 mode별 조합을 재검증한다.
- 썸네일 제목은 Background에서 안전한 `filename`으로 정리해 전달한다. 접수·실패는 미니 썸네일·상태 아이콘·형식·품질의 페이지 전역 Toast로 알리고, 실패 Toast와 실패 카드 배지에서 같은 조건으로 다시 요청할 수 있다.
- Overlay는 새 background→content 메시지 없이 저장된 최근 요청 목록의 storage 변경을 구독해, 카드 영상 ID와 job 영상 ID가 같은 카드 위에 대기·처리·완료·실패 상태를 그린다. 그래서 최근 5건 보관 목록에 있는 job만 Overlay에 표시된다.
- 진행률은 숫자로 표시하지 않는다. API `progress`는 상태 기반 값이라 실제 진행률이 아니므로 Popup 무대와 Overlay 모두 숫자 없는 회전 링을 쓴다. 영상 길이도 표시하지 않는다.
- Background job manager는 여러 job을 독립적으로 추적하고 active record를 영속화한다. service worker 재시작 후 진행 중 job을 즉시 다시 조회하며, 완료·실패 알림과 실패 알림 재시도를 제공한다.
- 최근 job 목록은 최대 5건을 유지한다. 6번째 job이 추가되면 가장 오래된 완료·실패 job부터 제거하고, 대기·처리 중 job은 목록 상한을 넘어도 유지한다.
- Popup은 직접 URL, 사용자 지정 파일명, 서버 오류 복구, 최근 요청 재실행의 기본 진입점으로 계속 유지한다.
- 확장 job 표현은 API 응답의 `sourceUrl`과 요청 영상 제목을 보존하고, 영상 ID는 `sourceUrl`에서 도출한다. 이 값이 없는 예전 저장 job은 썸네일 대신 중립 배경과 형식 아이콘을 보여 준다.
- 현재 서버 CORS는 no-origin 요청과 운영 web origin, local 개발 origin만 허용한다. 고정 extension ID 기반 `chrome-extension://...` origin 허용은 별도 후속 범위로 둔다.
- Chrome Web Store 배포, 계정, 전체 다운로드 이력, 백분율 진행률 조회는 이번 문서 범위에 포함하지 않는다. 최근 5건의 job 상태 표시는 포함한다.

## Testing Decisions

- 좋은 테스트는 내부 구현 함수 이름보다 사용자가 보는 동작을 기준으로 한다.
- 지원 YouTube 탭에서 열면 원본이 자동으로 지정되고, YouTube가 아닌 탭에서는 붙여넣기 칸 상태로 시작하는지 검증한다.
- 원본 URL이 비어 있을 때 다운로드 액션을 비활성화하고 URL 입력 상태를 보여주는지 검증한다.
- 원본 URL이 지원 YouTube URL일 때 다운로드 액션을 활성화하는지 검증한다.
- 원본 URL 형식이 올바르지 않을 때 다운로드 액션을 비활성화하고 URL 오류 상태를 보여주는지 검증한다.
- 오디오 모드가 선택되면 `POST /downloads` body에 오디오 type과 선택한 bitrate가 전달되는지 검증한다.
- 비디오 모드가 선택되면 `POST /downloads` body에 비디오 type과 선택한 resolution이 전달되는지 검증한다.
- `filename`은 job 생성 요청에 포함하지 않고 완료 파일을 Chrome에 저장할 때 local filename으로 전달되는지, storage에 저장되지 않고 원본이 바뀌면 비워지는지 검증한다.
- 제출 후 무대 단계가 서버 확인 → 대기 → 처리 → 완료 → 준비 순서로 바뀌고, job 실패와 서버 연결 실패를 구분하며, 다른 영상의 job은 무대에 영향을 주지 않는지 검증한다.
- 최근 요청의 다시 다운로드·다시 시도·다시 요청과 썸네일 버튼 권한 켜기·끄기·거부 전이를 검증한다.
- 저장된 `bitrate`/`resolution` 값이 고정 선택지를 벗어나면 각 모드 기본값(`192`/`720`)으로 대체되는지 검증한다.
- Popup과 Overlay message가 mode에 맞지 않는 품질 조합을 거부하는지 검증한다.
- 여러 job을 동시에 생성해도 active storage의 기록이 서로 덮어써지지 않는지 검증한다.
- service worker 재시작 후 최근 이력에 이미 있는 진행 중 job도 즉시 재조회되는지 검증한다.
- 완료 asset이 만료됐거나 다운로드 URL이 없을 때 성공 다운로드를 시작하지 않고 실패·재시도 상태를 표시하는지 검증한다.
- API가 반환한 validation message가 Popup 오류 상태에 그대로 전달되는지 검증한다.
- API base URL이 popup UI나 storage 사용자 설정으로 바뀌지 않는지 검증한다.
- Chrome extension load unpacked 환경에서 WXT generated manifest, popup asset, script 경로가 깨지지 않는지 확인한다.
- package test는 Chrome runtime 없이 URL 검증, job API mapping, popup 상태 전이를 검증하고, package build는 WXT build output의 manifest/popup 정적 파일 참조를 검증한다.
- browser smoke는 built popup의 무대·붙여넣기 칸·잘못된 주소·서버 실패·접수 거부·다운로드 흐름, 파일명 편집, 진행 복원, 최근 요청 줄·목록, 설정 화면의 테마와 썸네일 버튼 권한 흐름을 확인한다.
- Overlay browser smoke는 Shadow Root 형식 아이콘과 품질 막대, 품질 클릭 제출, 저장된 job 변경에 따른 카드 상태 배지, 실패 배지 재시도, 전역 Toast, Shorts 제외, 무한 스크롤에 해당하는 동적 카드, 중복 주입을 확인한다. 채널 smoke는 채널 홈·동영상 탭·채널 안 검색 카드의 Overlay 부착과 제목 읽기, 재생목록 카드·지원하지 않는 채널 탭 제외, shelf 이동 뒤 상태 배지 위치를 확인한다.
- 실제 Chrome 검증은 새 프로필에서 권한 허용 후 YouTube 홈·검색·구독·시청 추천 영역·채널 화면을 직접 열고 DOM 주입, console 오류, API 요청, 실제 다운로드를 분리해 확인한다.

## Out of Scope

- MyTube Extract API 서버 엔드포인트 변경
- API 서버 인증, 사용자 계정, 권한 관리
- 백분율 다운로드 진행률 조회와 표시
- 진행 중인 요청 취소
- 영상 길이 표시
- 전체 다운로드 이력 저장
- Chrome Web Store 배포 자동화
- 고정 extension ID 기반 CORS 허용
- YouTube-only source policy 서버 강제
- 입력 URL 저장 또는 최근 URL 목록
- shared package 도입
- YouTube Shorts 지원
- 썸네일 기능의 백분율 진행률, Web Store 배포 자동화, 텔레메트리
- 데스크톱 알림의 모양과 동작 변경

## Further Notes

현재 `apps/chrome-extension`은 무대 Popup과 YouTube 일반 영상 카드 Overlay를 함께 제공한다. Job 상태·재시작 복구·최근 5건 목록·Overlay 카드 진행 표시는 현재 범위이며, 백분율 진행률, Shorts, Chrome Web Store 배포 자동화, 전체 다운로드 이력은 후속 범위다.

### 결정 이력

| 이전 결정 | 출처 | 대체한 결정 | 대체 출처 |
| --- | --- | --- | --- |
| URL 직접 입력이 기본이고, 현재 탭 URL은 버튼을 누를 때만 가져온다. `activeTab`도 그때만 쓴다. | 이 문서의 이전 판 | Popup을 열 때 활성 탭을 한 번 읽어 지원 YouTube 영상이면 무대에 올린다. 현재 탭 버튼은 없앴다. | `.scratch/chrome-extension-visual-minimal-ui/spec.md` |
| Overlay는 접수 Toast만 보여 주고, 진행은 데스크톱 알림과 Popup이 담당한다. | `.scratch/chrome-extension-job-based-downloads/spec.md` "오버레이 표시" | Overlay가 저장된 최근 요청 목록을 구독해 카드 위에 대기·처리·완료·실패를 남긴다. 알림과 자동 다운로드는 그대로다. | `.scratch/chrome-extension-visual-minimal-ui/spec.md` |
| Popup은 항상 새 요청 form 아래에 최근 요청 목록을 함께 보여 준다. | `.scratch/chrome-extension-job-based-downloads/spec.md` "팝업 레이아웃" | 첫 화면에는 최근 요청 썸네일 줄(최신 3건)만 두고, 목록은 Popup 안의 `recent` 화면으로 펼친다. | `.scratch/chrome-extension-visual-minimal-ui/spec.md` |
| 완료 job은 자동 다운로드만 하고 목록에 다운로드 버튼을 두지 않는다. | `.scratch/chrome-extension-job-based-downloads/spec.md` "자동 다운로드" | 자동 다운로드는 유지하고, 보관 기간 안의 완료 항목에 다시 다운로드를 더했다. | `.scratch/chrome-extension-visual-minimal-ui/spec.md` |
| Popup 파일명은 다른 옵션과 함께 저장한다. | 이 문서의 이전 판 | 파일명은 영상별 값이라 저장하지 않고, 원본이 바뀌면 비운다. | `.scratch/chrome-extension-visual-minimal-ui/spec.md` |
| 썸네일 버튼 권한은 켜기만 있다. | 이 문서의 이전 판 | 설정 화면 스위치로 권한을 해제할 수 있다. | `.scratch/chrome-extension-visual-minimal-ui/spec.md` |

job 기반 다운로드 전환 스펙의 나머지 결정(Background 단일 추적, 다중 job, 5건 보관 정책, 알림 재시도, 서버에 파일명 미전송)은 그대로 유효하다.
