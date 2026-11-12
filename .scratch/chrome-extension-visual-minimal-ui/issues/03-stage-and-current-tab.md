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

**Status:** ready-for-agent

- [ ] model 통합 테스트: 지원 YouTube 탭에서 초기화하면 원본이 자동 지정되고 무대 원본이 `tab`이며 제출 가능하다.
- [ ] model 통합 테스트: YouTube가 아닌 탭은 `empty`, 탭 읽기 실패도 `empty`, 잘못된 입력은 `invalid`이며 둘 다 제출이 잠긴다. 유효한 주소를 붙여넣으면 `pasted`가 된다.
- [ ] model 통합 테스트: 원본 URL은 저장되지 않고, 형식·품질은 계속 저장된다.
- [ ] 기존 "현재 탭 자동 감지 대신 입력 필요" 통합 테스트를 새 결정에 맞게 고친다. 나머지 기존 통합 테스트는 통과한다.
- [ ] popup 브라우저 스모크가 built popup에서 무대(지원 탭), 붙여넣기 칸(비유튜브 탭), 잘못된 주소 칸, 형식·품질 선택, 추출 버튼 제출 흐름을 확인하도록 갱신되어 통과한다.
- [ ] 에이전트가 라이트·다크와 360px 폭에서 Popup 스크린샷을 찍어 무대·조작이 잘리지 않고 텍스트가 넘치지 않음을 확인한다.
- [ ] 확장 `lint`, `test`, `build`가 통과한다.
