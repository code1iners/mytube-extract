# 06: 자막 추출 파일·처리 방식 전환

Status: done (2026-09-07)

**What to build:** 사용자가 기존 파일 선택·끌어놓기 방식으로 파일과 처리 방식을 정하고 자막 추출 요청을 접수할 수 있다.

**Blocked by:** 03: 공통 요청 준비·상태 안내 전환

## 완료 조건

- [x] 파일 선택·끌어놓기·선택 파일 표시·제거, 처리 방식 선택, 설명 펼침, 입력 오류와 제출 버튼의 스타일을 전환한다.
- [x] 파일 없음·선택됨·잘못된 입력 및 처리 방식별 선택·비활성·포커스 표시를 유지한다.
- [x] 기존 테스트 경계를 이용해 파일 선택과 끌어놓기, 제거·재선택, 처리 방식 선택부터 제출까지 검증하고 기존 요청 내용이 유지된다.
- [x] 파일 선택 영역의 키보드 조작과 실제 포커스를 검증한다. 설명 펼침이 기존처럼 동작하며 제거된 단축키는 복원하지 않는다.
- [x] 라이트·다크 및 세 화면 크기에서 파일 영역 높이·처리 방식 배치·읽기 순서·버튼 접근성을 비교한다.
- [x] 접수 이후 상태는 기존 스타일로 계속 동작하며 아직 필요한 공유 규칙을 제거하지 않는다.

## 공통 보존·검증 조건

- [x] 최신 디자인·동작 계약과 별도 작업 변경을 보존한다. Chrome 확장 프로그램·Popup, 서버 요청·응답·저장 정책 및 제품 기능은 변경하지 않는다.
- [x] 변경 전후 동일한 브라우저·폰트·fixture·화면 상태를 사용하고 변동 요소를 통제한다. 해당 영역의 시각·키보드·동작 회귀를 이 티켓에서 해결한다.
- [x] 기존 브라우저 사용자 동작 검증과 관련 단위 검사를 재사용한다. 마지막 관련 변경 이후 타입 검사·전체 단위 테스트·배포용 빌드·기존 브라우저 smoke 결과와 미검증 경계를 기록한다.

## 범위 경계

파일 업로드·접수 이후 고유 상태 표시는 07이 담당한다. 업로드나 처리 방식 정책을 변경하지 않는다.

이 티켓은 확정된 Web 앱 Tailwind CSS 전환 스펙을 따른다. 상태 표시는 작업 준비 상태이며, 티켓 게시 자체가 코드 구현 착수를 뜻하지 않는다.

## 구현 및 검증 기록 (2026-09-07)

- `/subtitles` 요청 단계의 panel·form·파일 선택/드롭 영역·선택 파일 row와 제거 button·처리 방식 선택지·기술 정보 disclosure·입력 오류·제출 button·비활성 사유를 Tailwind utility class로 전환했다. 제목 row의 전용 margin도 `!mb-0` utility로 옮겼으며, 기존 semantic class, accessible name, native file input 구조와 요청 payload 경계는 유지했다.
- 파일 선택 주요 문구와 형식 안내의 색상·크기를 utility로 명시하고, selected state·disabled/enabled state·focus ring·오류 danger border/feedback를 semantic token에 연결했다. 560px 경계를 포함하도록 responsive variant를 조정했으며, native `details` marker와 chevron transition처럼 전역에 남겨야 하는 특수 규칙은 보존했다.
- 파일 picker의 클릭·Enter·Space·지원 형식 drop·잘못된 입력·재선택·제거 및 실제 focus 이동, 처리 방식 변경 후 `small_en` 제출, disclosure Enter/Space/click와 접수 이후 처리 단계는 기존 browser smoke 경계를 재사용해 확인했다. 제거된 U/F 단축키는 복원하지 않았다.
- 라이트·다크 및 `320x844`·`390x844`·`560x844`·`1280x900`에서 파일 영역의 computed color/size/border, 처리 방식 selected state와 1열 배치, DOM 읽기 순서, disabled/enabled 제출 button, 48px 터치 높이, fixed navigation 여유를 확인했다.
- 검증 결과:
  - `pnpm --filter web run lint`: 통과
  - `pnpm --filter web run test`: 18개 파일 / 136개 테스트 통과
  - `pnpm --filter web run build`: 통과, `Vite web package verified.`
  - `pnpm --filter web run test:browser`: 전체 시나리오 및 정적 서버 종료 상태 `ok`

## 검증 경계

위 결과는 저장소 fixture·배포용 bundle·로컬 Chromium 범위의 증거다. 실제 API·worker·YouTube provider·R2·운영 배포, 물리 기기의 safe-area/브라우저 chrome, 실제 screen reader는 검증하지 않았다.
