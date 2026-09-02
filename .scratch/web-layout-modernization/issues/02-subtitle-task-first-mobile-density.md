# 02: 자막 요청 레이아웃과 모바일 밀도 개선

**What to build:** 자막 추출 사용자가 로컬 영상 → 처리 방식 → 영어 SRT 생성 순서를 한눈에 이해하고, 좁은 화면에서도 큰 파일 선택 영역과 반복 카드 때문에 주요 요청 동작을 놓치지 않도록 자막 고유 작업 흐름을 정리한다. 파일 선택과 두 처리 방식은 계속 직접 비교·조작할 수 있어야 한다.

**Blocked by:** 01: 영상 추출을 작업 중심 레이아웃으로 전환.

**Status:** done (2026-09-02)

- [x] 자막 추출 화면이 01에서 확정한 공통 표면 계층을 사용하면서도 파일 → 처리 방식 → 영어 SRT 생성이라는 고유 작업 순서를 분명히 보여준다.
- [x] 좁은 viewport에서 파일 선택 영역은 기존 220px보다 낮아지고, 파일 선택 뒤 처리 방식과 주요 요청 동작까지의 불필요한 세로 거리가 줄어든다.
- [x] `속도 우선`과 `정확도 우선`은 full-width compact row로 계속 함께 보이며, disclosure 뒤에 숨거나 파일 선택 전 접근성 트리에서 사라지지 않는다.
- [x] 두 처리 방식의 결과 중심 설명이 `base.en`·`small.en`·로컬 Whisper 같은 기술 정보보다 먼저 읽히고, 모델 값과 API 전달 계약은 바뀌지 않는다.
- [x] 기존 파일 선택 control의 accessible name, click·Enter·Space, mp4·mov·webm 선택, drag-and-drop, 형식·용량 오류, 선택 파일 표시·지우기·focus 복귀가 유지된다.
- [x] 320px·390px에서 파일 선택 control, 처리 방식 두 개, 주요 요청 동작이 잘리거나 수평으로 넘치지 않고 fixed 하단 내비게이션에 가려지지 않는다.
- [x] 1280px에서도 작업 영역이 작은 카드 하나처럼 고립되거나 과도하게 비어 보이지 않으며 light·dark에서 같은 읽기 순서를 유지한다.
- [x] 자막 요청 payload, 접수·처리·완료·실패·다운로드, 요청 중 내비게이션 잠금과 저장된 처리 방식 복원은 변경되지 않는다.
- [x] 관련 단위·브라우저 테스트, Web 정적 검사와 production build가 통과하고, 자동 검증과 별도로 390×844 및 1280×900 시각 확인 결과를 기록한다.

## Comments

### 2026-09-02 구현

- 자막 요청 route를 `phase-panel subtitle-request-panel` flat work surface로 전환하고 `로컬 영상 → 처리 방식 → 영어 SRT 생성` 순서 뒤에 worker readiness를 보조 영역으로 배치했다. 요청 중 navigation lock, 상태·결과·오류 화면은 기존 표면과 동작을 유지했다.
- 파일 선택 control의 높이를 160px로 낮추고 처리 방식 두 개를 모든 폭에서 full-width compact row로 정렬했다. 결과 중심 설명을 먼저 렌더링한 뒤 `base.en`·`small.en`·로컬 Whisper 기술 정보를 보조 위치에 남겼다.
- 모델 값, 업로드·complete payload, 접수증, polling, 완료 다운로드, 오류 복구와 처리 방식 저장·복원 로직은 수정하지 않았다. 기존 파일 picker의 click·Enter·Space·drag-and-drop, 세 형식, 검증·413 오류, 지우기 후 focus 경로도 유지했다.
- 검증: `pnpm --filter web run lint`, `pnpm --filter web run test`(16 files/112 tests), `pnpm --filter web run build`, `pnpm --filter web run test:browser`, `pnpm test`(12 tasks), `git diff --check` 통과.
- 별도 시각 확인에서 개발 서버 fixture를 사용해 390×844·1280×900의 light/dark 네 렌더링을 확인했다. 파일·처리 방식·CTA의 읽기 순서, 1열 처리 방식, flat work surface, desktop 여백과 하단 fixed navigation 관계에서 추가 수정 사항은 없었다.
- fixture·로컬 Chromium 결과는 실제 API·worker/provider, 화면 낭독기, 물리 모바일 browser chrome·safe-area 검증을 대체하지 않는다.
