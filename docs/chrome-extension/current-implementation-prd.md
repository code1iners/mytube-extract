# MyTube Extract Chrome Extension 현재 구현 PRD

## Problem Statement

MyTube Extract API 서버는 URL 또는 YouTube 영상 ID를 기반으로 오디오와 비디오 파일 다운로드 응답을 제공한다. Chrome 확장 프로그램은 기존 popup URL 입력 흐름을 유지하면서, 사용자가 YouTube 목록을 탐색하는 중 썸네일에서 바로 오디오·비디오 추출을 시작할 수 있게 한다.

사용자는 API 경로와 query string을 직접 조합하지 않고도, 가진 YouTube URL·현재 열어둔 YouTube 탭·영상 썸네일에서 오디오 또는 비디오 다운로드를 시작할 수 있어야 한다.

## Solution

Chrome 확장 프로그램은 WXT + React + TypeScript Popup과 MV3 Background, YouTube unlisted Overlay script로 구현되어 있다. Popup은 사용자가 입력하거나 현재 탭에서 가져온 YouTube URL, 추출 형식, 선택 옵션을 조합해 환경 변수로 정한 MyTube Extract API로 다운로드를 시작한다. 권한을 허용한 사용자는 일반 YouTube 영상 카드의 썸네일에서 품질을 고른 뒤 같은 API를 호출할 수 있다.

API 서버 제품 개요는 `docs/api/current-implementation-prd.md`, endpoint별 상세 계약은 `docs/server/endpoints/*`를 기준으로 소비하며, 이번 범위에서는 서버 엔드포인트나 응답 계약을 변경하지 않는다.

## User Stories

1. YouTube URL을 가진 사용자로서, 나는 어떤 페이지에서든 popup을 열고 URL을 입력하고 싶다. 그래서 현재 탭 위치와 관계없이 추출을 시작할 수 있다.
2. 오디오 다운로드 사용자로서, 나는 오디오 다운로드를 선택할 수 있기를 원한다. 그래서 URL의 미디어에서 mp3 오디오만 추출할 수 있다.
3. 비디오 다운로드 사용자로서, 나는 비디오 다운로드를 선택할 수 있기를 원한다. 그래서 URL의 미디어를 mp4 파일로 받을 수 있다.
4. 다운로드 옵션을 조정하는 사용자로서, 나는 파일명을 입력할 수 있기를 원한다. 그래서 내려받는 파일을 나중에 쉽게 찾을 수 있다.
5. 오디오 다운로드 사용자로서, 나는 오디오 비트레이트 제한을 지정할 수 있기를 원한다. 그래서 API 서버의 `bitrate` 옵션을 popup에서 사용할 수 있다.
6. 비디오 다운로드 사용자로서, 나는 영상 해상도 제한을 지정할 수 있기를 원한다. 그래서 API 서버의 `resolution` 옵션을 popup에서 사용할 수 있다.
7. 일반 사용자로서, 나는 API 서버 주소를 직접 설정하지 않고 운영 API를 사용하고 싶다. 그래서 설정 없이 바로 추출할 수 있다.
8. 잘못된 URL을 입력한 사용자로서, 나는 URL 입력 상태를 보고 싶다. 그래서 왜 다운로드 버튼을 사용할 수 없는지 알 수 있다.
9. API 서버에 연결할 수 없는 사용자로서, 나는 서버 연결 실패 상태를 보고 싶다. 그래서 확장 프로그램 문제가 아니라 서버 상태 문제임을 구분할 수 있다.
10. YouTube 탭을 보고 있는 사용자로서, 나는 버튼으로 현재 탭 URL을 입력칸에 가져오고 싶다. 그래서 URL 복사 없이 추출을 시작할 수 있다.
11. YouTube 목록을 탐색하는 사용자로서, 나는 일반 영상 썸네일에서 MP3 또는 MP4를 누르고 싶다. 그래서 URL을 복사하지 않고 추출을 시작할 수 있다.
12. 썸네일에서 추출하는 사용자로서, 나는 128/192/320 kbps 또는 360/720/1080p 중 숫자 품질을 고르고 싶다. 그래서 필요한 품질로 즉시 요청할 수 있다.
13. 처음 기능을 사용하는 사용자로서, 나는 Popup에서 YouTube 버튼 권한을 한 번 허용하고 싶다. 그래서 이후 지원 페이지에서 자동으로 썸네일 버튼을 사용할 수 있다.

## Implementation Decisions

- Chrome 확장 프로그램 문서는 `docs/chrome-extension`이 소유하고, API 서버 문서는 `docs/api`가 소유한다.
- 확장 프로그램은 URL 직접 입력을 기본 흐름으로 유지하고, 현재 탭 URL 가져오기 버튼을 보조 흐름으로 제공한다.
- WXT는 extension entrypoint와 generated manifest를 소유하고, React는 popup UI rendering만 담당한다.
- Chrome storage/downloads API, MyTube Extract API URL 생성, popup 상태 전이는 React component 밖의 TypeScript module로 분리한다.
- 현재 MyTube Extract API 계약을 그대로 사용한다. 오디오는 `/audio?url={MEDIA_URL}`, 비디오는 `/video?url={MEDIA_URL}`을 호출한다.
- API base URL은 `WXT_MYTUBE_EXTRACT_API_BASE_URL` 환경 변수로 정하고 사용자 입력 UI를 제공하지 않는다. 운영 값은 `https://mytube-extract-api.codeliners.cc`, 로컬 값은 `http://127.0.0.1:5011`만 사용한다. 기존 `WXT_MEDIA_NEST_API_BASE_URL`, non-WXT `MYTUBE_EXTRACT_API_BASE_URL`, `MEDIA_NEST_API_BASE_URL`은 빌드 설정 전환 기간의 fallback으로만 지원한다.
- 파일명, 오디오 비트레이트, 비디오 해상도는 선택 옵션으로 유지한다.
- 입력한 원본 URL은 기본적으로 Chrome storage에 저장하지 않는다.
- `activeTab` 권한은 사용자가 popup에서 현재 탭 URL 가져오기 버튼을 누를 때만 사용한다.
- 썸네일 기능은 Popup의 최초 활성화 행동에서 `https://www.youtube.com/*` optional Host Permission을 요청하며, 거부해도 기존 Popup 흐름은 유지한다.
- 썸네일 Overlay는 홈, 검색 결과, 구독 피드, 시청 페이지 추천 영역의 표준 영상 카드만 대상으로 하고 Shorts는 제외한다.
- MP3 품질은 `128/192/320 kbps`, MP4 품질은 `360/720/1080p`이며 숫자 선택 즉시 Background가 기존 `/audio` 또는 `/video` query endpoint를 호출한다.
- 썸네일 제목은 Background에서 안전한 `filename`으로 정리해 전달하고, 실패는 페이지 전역 Toast의 재시도로 다시 요청한다. 백분율 진행률은 제공하지 않는다.
- Popup은 직접 URL, 사용자 지정 파일명, 고급 옵션, 서버 오류 복구용 기본 진입점으로 계속 유지한다.
- 현재 서버 CORS는 no-origin 요청과 운영 web origin, local 개발 origin만 허용한다. 고정 extension ID 기반 `chrome-extension://...` origin 허용은 별도 후속 범위로 둔다.
- Chrome Web Store 배포, 계정, 다운로드 이력, 작업 큐, 진행률 조회는 이번 문서 범위에 포함하지 않는다.

## Testing Decisions

- 좋은 테스트는 내부 구현 함수 이름보다 사용자가 보는 동작을 기준으로 한다.
- 원본 URL이 비어 있을 때 다운로드 액션을 비활성화하고 URL 입력 상태를 보여주는지 검증한다.
- 원본 URL이 지원 YouTube URL일 때 다운로드 액션을 활성화하는지 검증한다.
- 원본 URL 형식이 올바르지 않을 때 다운로드 액션을 비활성화하고 URL 오류 상태를 보여주는지 검증한다.
- 오디오 모드가 선택되면 API 서버의 URL 기반 오디오 계약에 맞는 다운로드 URL을 생성하는지 검증한다.
- 비디오 모드가 선택되면 API 서버의 URL 기반 비디오 계약에 맞는 다운로드 URL을 생성하는지 검증한다.
- `filename`, `bitrate`, `resolution` 설정값이 API 호출 URL에 반영되는지 검증한다.
- API base URL이 popup UI나 storage 사용자 설정으로 바뀌지 않는지 검증한다.
- Chrome extension load unpacked 환경에서 WXT generated manifest, popup asset, script 경로가 깨지지 않는지 확인한다.
- package test는 Chrome runtime 없이 URL 검증, API URL 생성, popup 상태 전이를 검증하고, package build는 WXT build output의 manifest/popup 정적 파일 참조를 검증한다.
- browser smoke는 built popup의 URL 미입력, 서버 실패, 다운로드 시작, YouTube Overlay 최초 활성화 흐름을 확인한다.
- Overlay browser smoke는 Shadow Root 버튼, 숫자 품질, Shorts 제외, 무한 스크롤에 해당하는 동적 카드, 중복 주입, 전역 Toast와 재시도를 확인한다.
- 실제 Chrome 검증은 새 프로필에서 권한 허용 후 YouTube 홈·검색·구독·시청 추천 영역을 직접 열고 DOM 주입, console 오류, API 요청, 실제 다운로드를 분리해 확인한다.

## Out of Scope

- MyTube Extract API 서버 엔드포인트 변경
- API 서버 인증, 사용자 계정, 권한 관리
- 다운로드 작업 큐와 진행률 조회
- 다운로드 이력 저장
- Chrome Web Store 배포 자동화
- 고정 extension ID 기반 CORS 허용
- YouTube-only source policy 서버 강제
- 입력 URL 저장 또는 최근 URL 목록
- shared package 도입
- YouTube Shorts 지원
- 썸네일 기능의 Job API, 백분율 진행률, Web Store 배포 자동화, 텔레메트리

## Further Notes

현재 `apps/chrome-extension`은 URL 입력 Popup과 YouTube 일반 영상 카드 Overlay를 함께 제공한다. Job 기반 진행률, Shorts, Chrome Web Store 배포 자동화, 최근 URL 저장은 후속 범위다.
