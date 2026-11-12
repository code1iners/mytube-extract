# 03: 무대 화면과 현재 탭 자동 읽기

**What to build:** Popup 메인 화면을 A안 "무대"로 다시 구성한다. Popup을 열면 활성 탭이 지원 YouTube 영상(watch·Shorts·youtu.be)일 때 그 영상의 썸네일과 제목이 16:9 무대에 바로 올라오고, 원본으로 지정된다. YouTube가 아닌 탭에서는 무대 자리에 붙여넣기 칸(붙여넣기·타이핑 가능한 실제 입력)이 나타난다. 잘못된 주소는 오류 색 칸, 입력한 주소, 이유 한 줄, 지우기 버튼으로 보여준다. 무대 아래에는 제목 한 줄, 형식 아이콘 두 칸(오디오 MP3·비디오 MP4), 품질 막대 세 개, 빨간 추출 버튼을 둔다. 이 구성으로 기존 제출과 background 추적이 그대로 동작한다. 헤더는 로고와 아이콘 버튼 두 개(격자·설정, 동작은 07에서 연결)만 둔다. `현재 탭 사용` 버튼, 제목·부제, 정책 문구 줄, 썸네일 버튼 활성화 카드, 라벨·설명 문장은 제거한다. 최근 요청 목록 영역은 06이 대체할 때까지 기존 표시를 유지해도 된다.

화면 상태는 model snapshot에서 도출하고 React 컴포넌트는 그 값만 그린다. 무대 원본의 모양은 시안 프로토타입에서 가져왔다.

```ts
type StageSource =
  | { kind: 'tab' | 'pasted'; videoId: string; title: string | null; thumbnailUrl: string }
  | { kind: 'empty' }                        // missing-source-url
  | { kind: 'invalid'; input: string };      // invalid-source-url
```

썸네일은 영상 ID로 만든 YouTube 이미지 주소를 쓴다. 로드에 실패하면 중립 배경과 비디오 아이콘으로 대체한다. 제목은 탭 제목에서 YouTube 접미사를 뗀 값이고, 모르면 영상 ID를 보여준다. 영상 길이는 표시하지 않는다. 시각은 `DESIGN.md` semantic token(라이트·다크)과 스펙의 시각 계약을 따른다. 아이콘 버튼에는 접근 가능한 이름을 달고, 조작 영역은 44px 이상으로 한다. 시안: `../mockups/extension-a-states.html`.

**Blocked by:** 01

**Status:** resolved

- [x] model 통합 테스트: 지원 YouTube 탭에서 초기화하면 원본이 자동 지정되고 무대 원본이 `tab`이며 제출 가능하다.
- [x] model 통합 테스트: YouTube가 아닌 탭은 `empty`, 탭 읽기 실패도 `empty`, 잘못된 입력은 `invalid`이며 둘 다 제출이 잠긴다. 유효한 주소를 붙여넣으면 `pasted`가 된다.
- [x] model 통합 테스트: 원본 URL은 저장되지 않고, 형식·품질은 계속 저장된다.
- [x] 기존 "현재 탭 자동 감지 대신 입력 필요" 통합 테스트를 새 결정에 맞게 고친다. 나머지 기존 통합 테스트는 통과한다.
- [x] popup 브라우저 스모크가 built popup에서 무대(지원 탭), 붙여넣기 칸(비유튜브 탭), 잘못된 주소 칸, 형식·품질 선택, 추출 버튼 제출 흐름을 확인하도록 갱신되어 통과한다.
- [x] 에이전트가 라이트·다크와 360px 폭에서 Popup 스크린샷을 찍어 무대·조작이 잘리지 않고 텍스트가 넘치지 않음을 확인한다.
- [x] 확장 `lint`, `test`, `build`가 통과한다.

## Comments

- 2026-11-12 구현 완료.
  - 활성 탭 읽기: `TabsAdapter.getCurrentTab()`이 `{ url, title }`을 돌려준다(이전 `getCurrentTabUrl` 대체). model `initialize`가 지원 YouTube 탭이면 정규화한 주소를 원본으로 지정하고, 탭 제목에서 ` - YouTube` 접미사와 `(3) ` 알림 개수를 뗀 값을 제목으로 쓴다. 남는 것이 없으면 `null`이다. `importCurrentTabUrl`은 지웠다.
  - 무대 원본: snapshot에 `stageSource: StageSource`를 더했다. `setSnapshot`이 모든 갱신 때 `deriveStageSource(sourceUrl, tabVideo)`로 다시 도출한다(`src/domain/popup-state/popup-state.ts`).
  - 썸네일 주소: `getYoutubeThumbnailUrl(videoId)` = `https://i.ytimg.com/vi/<id>/hqdefault.jpg`이고, 16:9 칸에 `object-fit: cover`로 그린다.
  - 무대 원본 판정 결정: 붙여넣은 주소가 활성 탭과 같은 영상이면 탭 제목을 쓸 수 있어 `pasted`가 아니라 `tab`으로 본다. 다른 영상이면 `pasted`다.
  - 범위 밖 추가: 탭 영상이 무대에 있을 때 입력칸 밖에서 붙여넣어도(document `paste`) 원본을 바꾼다. 스펙 사용자 스토리 10을 위한 것이고 시안의 붙여넣기 처리와 같다.
  - 화면:
    - 헤더는 로고와 아이콘 버튼 두 개(`썸네일 버튼`·`설정`)만 둔다. 두 버튼은 07 전까지 `disabled`다.
    - 형식은 아이콘 radio 두 칸(`오디오 MP3`·`비디오 MP4`), 품질은 radio 막대 세 개(`360p`… / `192 kbps`…)다. 선택한 값 이하의 막대를 채우고, 고른 값에는 밑줄을 더한다.
    - 추출 버튼은 아이콘 버튼이고 접근 가능한 이름은 `추출 시작`·`서버 확인 중`·`다시 시도`다. 기존 상태 문장 줄과 최근 요청 목록은 04·06이 대체할 때까지 그대로 둔다.
- 다음 티켓까지 남는 공백(이번 범위에서 고치지 않음):
  - 05 관련: 파일명 입력칸이 없어졌지만 예전에 저장된 `filename` 값은 아직 로드되어 제출에 쓰이고, 형식·품질을 저장할 때 다시 저장된다. 05의 "예전에 저장된 파일명 값은 무시된다"가 해결한다. 03과 05 사이에는 배포하지 않아야 한다.
  - 07 관련: 테마 선택과 썸네일 버튼 권한 카드를 헤더에서 뺐다. 07 전까지는 Popup에서 테마나 권한을 바꿀 수 없다(저장된 테마는 계속 적용된다). popup 스모크의 썸네일 버튼 활성화 흐름도 함께 뺐으므로 07에서 설정 화면 기준으로 다시 넣어야 한다. model의 `activateYoutubeOverlay`와 통합 테스트는 남겨 두었다.
  - popup의 `--color-border`는 `#e0e0e0`이라 `DESIGN.md`의 hairline `#8a8a8a`와 다르다. 이번 변경 전부터 있던 차이라 고치지 않았다. 비선택 품질 막대는 대비를 확보하려고 `--color-text-secondary`를 쓴다. 추출 버튼 56px·radius 12px 같은 시안 값과 함께 10의 `DESIGN.md` 갱신 때 반영할 대상이다.
- 검증(마지막 변경 뒤):
  - `pnpm --filter chrome-extension lint`(tsc) 통과, `test` 26파일 191개 통과, `build` 통과.
  - popup 스모크에 아래 흐름을 넣었고 모두 통과했다.
    - 지원 탭 무대: 썸네일 로드, 제목, 입력칸 밖 붙여넣기
    - 썸네일 실패 대체: Shorts 탭, 제목 대신 영상 ID
    - 붙여넣기 칸·잘못된 주소: 비유튜브 탭, `aria-invalid`, 이유 줄, 지우기와 포커스 복귀, 타이핑
    - 서버 실패: `다시 시도`
    - 형식·품질 선택과 제출: 비디오 1080 저장, `sourceUrl` 저장 안 함, job 생성 본문 확인
  - overlay 스모크 2종도 통과했다.
  - 썸네일은 `i.ytimg.com` 요청을 가짜 PNG 또는 실패 응답으로 가로챈다. 실제 서버에는 popup 스모크의 `/health` GET만 간다.
  - `.env`의 API 주소에는 로컬 서버가 없어 `/health`에서 실패한다. 그래서 `WXT_MEDIA_NEST_API_BASE_URL=https://mytube-extract-api.codeliners.cc`로 빌드와 스모크를 맞춰 실행했다(02 기록과 같은 방식).
  - 스크린샷: popup 스모크에 `MYTUBE_EXTRACT_POPUP_SCREENSHOT_DIR`를 주면 무대·붙여넣기·잘못된 주소 상태를 라이트·다크 360px로 남긴다. 각 상태에서 가로 넘침이 없음을 확인하고 이미지도 직접 확인했다.
    - `/tmp/mytube-03/shots/popup-stage-light.png`, `popup-stage-dark.png`
    - `/tmp/mytube-03/shots/popup-paste-light.png`, `popup-paste-dark.png`
    - `/tmp/mytube-03/shots/popup-invalid-light.png`, `popup-invalid-dark.png`
  - 로그: `/tmp/mytube-03/popup-smoke.log`, `overlay-smoke.log`, `overlay-vis.log`
