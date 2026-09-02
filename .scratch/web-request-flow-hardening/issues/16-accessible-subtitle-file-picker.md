# 16: 자막 파일 선택을 하나의 접근 가능한 control로 통합

**What to build:** 키보드와 화면 낭독기 사용자가 보이지 않는 영문 파일 입력과 한국어 dropzone을 중복해서 만나지 않고, 하나의 명확한 자막 원본 선택 control로 파일을 고를 수 있게 한다. 클릭·키보드·드래그 입력과 기존 파일 검증·지우기 동작을 모두 유지한다.

**Blocked by:** None (can start immediately)

**Status:** done (2026-09-02)

- [x] 접근성 트리와 tab 순서에는 사용자가 조작할 자막 파일 선택 control이 하나만 노출된다.
- [x] control은 한국어 accessible name과 보이는 키보드 focus 상태를 가지며 Enter 또는 Space로 native 파일 선택기를 열 수 있다.
- [x] mp4, mov, webm 파일의 클릭 선택과 drag-and-drop이 모두 동작하고, 지원하지 않는 형식·크기 오류는 기존처럼 입력 근처에서 안내된다.
- [x] 선택한 파일명·메타정보 표시와 `지우기` 동작이 유지되고, 파일을 지운 뒤 focus가 예측 가능한 위치로 돌아간다.
- [x] 제출 가능 여부와 실제 업로드 계약은 기존과 동일하게 유지된다.
- [x] 접근성 role·name·tab 순서와 클릭·키보드·드래그 경로를 검증하는 단위 테스트 및 브라우저 검증이 통과한다.

## Comments

- 파일 선택은 visible button 하나로 통합하고, programmatic file input은 `hidden`, `aria-hidden`, `tabIndex=-1`로 접근성 트리와 tab 순서에서 제외했다. 버튼 accessible name은 visible 문구를 포함하는 `영상 선택 또는 드래그 (로컬 영상 파일)`로 설정하고 `:focus-visible` 표시를 유지했다.
- 버튼의 click·Enter·Space가 native file chooser를 열고, mp4·mov·webm click 및 drag-and-drop이 기존 `validateSubtitleFile`과 선택 상태를 사용하도록 유지했다. 형식 오류와 API 413 용량 오류는 picker 옆 feedback에 연결하며, `지우기` 후 picker로 focus를 돌린다.
- 기존 `canSubmit` 조건과 R2 multipart upload 및 자막 job 생성 payload 호출 계약은 변경하지 않았다. 선택 파일명·크기 메타정보와 `지우기` touch target도 유지했다.
- 검증: `pnpm --filter web run lint`, `pnpm --filter web run test`(16 files, 111 tests), `pnpm --filter web run build`, `pnpm --filter web run test:browser` 통과. 브라우저 smoke에는 role/name, 재확인 버튼→file picker→Whisper radio의 실제 Tab 순서, click·Enter·Space file chooser, 세 형식 drop, 형식·413 오류, clear 후 focus를 포함했다.
- 위 browser 증거는 로컬 Chromium fixture와 mock API를 통한 검증이며, 실제 화면 낭독기·OS 파일 선택기 UI·production provider 동작을 증명하지 않는다. 테스트는 synthetic media metadata와 기대한 413 응답의 정확한 console 경고만 시나리오 범위에서 제외한다.
