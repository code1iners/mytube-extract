# 08: 요청 내역 목록·빈 상태 전환

Status: done (2026-09-07)

**What to build:** 사용자가 빈 내역에서 추출 화면으로 이동하거나 기존 영상·자막 기록의 상태와 결과를 확인할 수 있다.

**Blocked by:** 05: 영상 추출 접수·결과 상태 전환, 07: 자막 추출 접수·결과 상태 전환

## 완료 조건

- [x] 빈 내역, 목록·항목 메타, 상태·진행 표시, 결과 링크의 일반 스타일을 전환한다.
- [x] 빈 내역의 기존 진입점으로 영상·자막 화면에 이동할 수 있고 존재하지 않는 기록을 만들어 표시하지 않는다.
- [x] 영상·자막 혼합 fixture에서 진행·완료·실패·만료 표시와 기존 최신순 정렬·표시 제한·브라우저 저장 범위를 보존한다.
- [x] 완료 결과 링크와 각 항목의 기존 동작을 확인하고 긴 제목·파일명·상태 안내가 라이트·다크 및 세 화면 크기에서 잘리지 않는다.
- [x] 목록의 읽기 순서·링크 포커스·터치 영역을 유지한다. 삭제·되돌리기는 이전 스타일로 계속 작동한다.
- [x] 05·07 완료를 확인한 후 시작하여 요청 화면을 먼저 전환한다는 합의 순서를 지킨다.

## 공통 보존·검증 조건

- [x] 최신 디자인·동작 계약과 별도 작업 변경을 보존한다. Chrome 확장 프로그램·Popup, 서버 요청·응답·저장 정책 및 제품 기능은 변경하지 않는다.
- [x] 변경 전후 동일한 브라우저·폰트·fixture·화면 상태를 사용하고 변동 요소를 통제한다. 해당 영역의 시각·키보드·동작 회귀를 이 티켓에서 해결한다.
- [x] 기존 브라우저 사용자 동작 검증과 관련 단위 검사를 재사용한다. 마지막 관련 변경 이후 타입 검사·전체 단위 테스트·배포용 빌드·기존 브라우저 smoke 결과와 미검증 경계를 기록한다.

## 범위 경계

삭제 버튼과 삭제·되돌리기 안내의 스타일 소유권은 09에 남긴다.

이 티켓은 확정된 Web 앱 Tailwind CSS 전환 스펙을 따른다. 상태 표시는 작업 준비 상태이며, 티켓 게시 자체가 코드 구현 착수를 뜻하지 않는다.

## 구현 및 검증 기록 (2026-09-07)

- `/history`의 flat panel, 빈 상태 시작 링크·보관 안내, 목록·항목 메타, 상태 tone·progress, 완료 다운로드·실패/만료 재요청·상태 재확인 action을 전용 Tailwind utility class로 전환했다. 기존 route, localStorage receipt identity·최신순·20건 제한, API status polling, RequestFlow, ARIA 구조와 test selector는 유지했다.
- 상태별 utility map을 정적으로 선언해 `queued`·`processing`·`completed`·`failed`·`expired` 색상이 배포용 CSS에서 누락되지 않도록 했다. 긴 파일명·오류 문구는 `min-w-0`과 `overflow-wrap:anywhere`로 기존 줄바꿈 계약을 유지했다.
- 결과 action의 hover 효과는 기존 `@media (hover: hover)` 동작을 유지하도록 Tailwind arbitrary variant로 제한했고, populated fixture에 긴 상태 안내 문구도 추가해 긴 파일명·상태 안내의 줄바꿈을 함께 확인했다.
- 삭제 button, 삭제 후 undo 안내·button 및 해당 focus 동작의 스타일 소유권은 09에 남겼다. 저장 실패 안내는 history 전용 utility로 옮겼다.
- 기존 browser smoke의 populated history를 영상 processing·completed·failed 및 자막 completed·expired 혼합 fixture로 확장해 최신순, 50/100/0/0 progress, 상태 tone, 다운로드·재요청 링크와 긴 파일명을 확인했다. 빈 상태 링크의 실제 focus·44px 이상 touch target, light/dark × `320x844`·`390x844`·`1280x900` overflow도 재실행했다.
- 위 fixture는 긴 상태 안내 문구의 실제 렌더링도 확인하며, action hover가 터치 환경에서 고정되지 않는 Tailwind media variant를 build 결과로 확인했다.
- 검증 결과:
  - `pnpm --filter web run lint`: 통과
  - `pnpm --filter web run test`: 18개 파일 / 137개 테스트 통과
  - `pnpm --filter web run build`: 통과, `Vite web package verified.`
  - `pnpm --filter web run test:browser`: 전체 시나리오 및 정적 서버 종료 상태 `ok`
  - `git diff --check`: 통과

## 검증 경계

단위 검사·배포용 build·fixture·정적 서버·Chromium 결과는 로컬 Web CSS와 브라우저 요청 내역 흐름만 증명한다. 실제 API·작업 처리기·YouTube 제공자·R2·운영 배포, 물리 모바일 기기 safe-area/브라우저 chrome, 실제 screen reader는 검증하지 않았다.
