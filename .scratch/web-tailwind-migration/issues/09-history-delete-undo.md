# 09: 요청 내역 삭제·되돌리기 전환

Status: done (2026-09-08)

**What to build:** 사용자가 요청 내역을 삭제하고 허용된 시간 안에 되돌리며, 결과와 실패를 기존처럼 확인할 수 있다.

**Blocked by:** 08: 요청 내역 목록·빈 상태 전환

## 완료 조건

- [x] 삭제 조작과 되돌리기 안내·버튼·실패 표시를 유틸리티로 옮긴다.
- [x] 여러 기록 중 하나를 삭제하면 해당 기록과 브라우저 저장 내용이 일치하고 마지막 기록 삭제 시 빈 상태와 되돌리기 안내가 정상 표시된다.
- [x] 기존 허용 시간 안의 되돌리기로 같은 기록과 정렬 위치가 복원되고, 시간 만료 후에는 기존처럼 되돌릴 수 없다.
- [x] 연속 삭제와 저장소 접근 실패 fixture에서 기존 대상 선택·실패 공지를 유지하며 실패를 성공으로 표시하지 않는다.
- [x] 삭제·복원 이후 실제 포커스 이동을 확인하고 라이트·다크 및 세 화면 크기에서 안내와 하단 내비게이션이 조작을 가리지 않는다.
- [x] 서버 작업 취소·결과 파일 삭제와 브라우저 내역 삭제의 경계를 유지한다. 보존 기간·저장 구조를 바꾸지 않는다.

## 공통 보존·검증 조건

- [x] 최신 디자인·동작 계약과 별도 작업 변경을 보존한다. Chrome 확장 프로그램·Popup, 서버 요청·응답·저장 정책 및 제품 기능은 변경하지 않는다.
- [x] 변경 전후 동일한 브라우저·폰트·fixture·화면 상태를 사용하고 변동 요소를 통제한다. 해당 영역의 시각·키보드·동작 회귀를 이 티켓에서 해결한다.
- [x] 기존 브라우저 사용자 동작 검증과 관련 단위 검사를 재사용한다. 마지막 관련 변경 이후 타입 검사·전체 단위 테스트·배포용 빌드·기존 브라우저 smoke 결과와 미검증 경계를 기록한다.

## 범위 경계

새 삭제 확인 흐름이나 삭제 정책을 만들지 않는다.

이 티켓은 확정된 Web 앱 Tailwind CSS 전환 스펙을 따른다. 상태 표시는 작업 준비 상태이며, 티켓 게시 자체가 코드 구현 착수를 뜻하지 않는다.

## 구현 및 검증 기록 (2026-09-08)

- `/history`의 삭제 button, 삭제 직후 undo 안내·button, 삭제·복원 결과 live region을 화면 컴포넌트의 Tailwind utility로 전환했다. 삭제/복원 함수, 8초 제한, 접수증 key·값, 서버 상태 조회와 결과 파일 동작은 변경하지 않았다.
- 기존 secondary action과 삭제·undo button이 공유하는 utility base를 두어 44px touch target, semantic token, focus ring, hover 조건, 모바일 undo full-width를 유지했다. 전역 CSS에서 history 삭제·undo 전용 selector와 breakpoint 규칙을 제거했다.
- 기존 삭제·복원/연속 삭제/정렬 복원/만료/focus 검증을 유지하고, 삭제 storage 실패 시 원래 기록·localStorage·alert를 유지하는 fixture와 마지막 기록 삭제 후 빈 상태·undo 표면의 light/dark × `320x844`·`390x844`·`1280x900` 및 fixed 하단 navigation 검증을 추가했다.
- 검증 결과:
  - `pnpm --filter web run lint`: 통과
  - `pnpm --filter web run test`: 18개 파일 / 137개 테스트 통과
  - `pnpm --filter web run build`: 통과, `Vite web package verified.`
  - `pnpm --filter web run test:browser`: 전체 request-history smoke 통과, 정적 서버 종료 상태 `ok`
  - `pnpm test`: 12개 task 성공; Web 18개 파일 / 137개 테스트, API 24개 suite / 202개 테스트 포함
  - `git diff --check`: 통과

## 검증 경계

fixture·로컬 Chromium·단위 검사·배포용 build 결과는 Web history의 로컬 스타일·브라우저 동작과 mock API 경계만 증명한다. 실제 API·작업 처리기·YouTube 제공자·R2·운영 배포, 물리 모바일 기기 safe-area/브라우저 chrome, 실제 screen reader는 검증하지 않았다.
