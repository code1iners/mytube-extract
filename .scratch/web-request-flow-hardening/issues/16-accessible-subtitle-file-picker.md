# 16: 자막 파일 선택을 하나의 접근 가능한 control로 통합

**What to build:** 키보드와 화면 낭독기 사용자가 보이지 않는 영문 파일 입력과 한국어 dropzone을 중복해서 만나지 않고, 하나의 명확한 자막 원본 선택 control로 파일을 고를 수 있게 한다. 클릭·키보드·드래그 입력과 기존 파일 검증·지우기 동작을 모두 유지한다.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] 접근성 트리와 tab 순서에는 사용자가 조작할 자막 파일 선택 control이 하나만 노출된다.
- [ ] control은 한국어 accessible name과 보이는 키보드 focus 상태를 가지며 Enter 또는 Space로 native 파일 선택기를 열 수 있다.
- [ ] mp4, mov, webm 파일의 클릭 선택과 drag-and-drop이 모두 동작하고, 지원하지 않는 형식·크기 오류는 기존처럼 입력 근처에서 안내된다.
- [ ] 선택한 파일명·메타정보 표시와 `지우기` 동작이 유지되고, 파일을 지운 뒤 focus가 예측 가능한 위치로 돌아간다.
- [ ] 제출 가능 여부와 실제 업로드 계약은 기존과 동일하게 유지된다.
- [ ] 접근성 role·name·tab 순서와 클릭·키보드·드래그 경로를 검증하는 단위 테스트 및 브라우저 검증이 통과한다.
