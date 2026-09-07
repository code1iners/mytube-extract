# 05: 영상 추출 접수·결과 상태 전환

Status: done (2026-09-07)

**What to build:** 영상 요청을 접수하거나 중단하고, 진행 상태와 최종 결과를 확인한 뒤 다운로드 또는 새 요청을 시작할 수 있다.

**Blocked by:** 04: 영상 추출 입력·옵션 전환

## 완료 조건

- [x] 영상 접수 중·중단 안내·진행·완료·실패·만료의 고유 표시, 결과 정보와 다운로드·새 요청 동작의 스타일을 전환한다.
- [x] 기존 fixture로 접수 전 중단과 접수 성공을 재현하고 실제 포커스 복귀·화면 이동 제한 해제를 확인한다. 접수된 작업의 서버 취소 기능을 새로 만들지 않는다.
- [x] 접수와 중단이 경합할 때 기존 요청 내역 보존 동작을 유지하며, 스타일 전환으로 중복 접수나 상태 추적 유실이 생기지 않는다.
- [x] 진행·완료·실패·만료별 안내와 가능한 동작이 동일하고 완료 다운로드와 새 요청 이동이 기존처럼 작동한다.
- [x] 라이트·다크 및 세 화면 크기에서 고유 상태와 결과를 비교하고 긴 오류·결과 정보에 잘림이나 가로 넘침이 없다.
- [x] 영상 입력부터 결과까지 기존 브라우저 검증을 통과하며, 영상 전용 이전 규칙은 소비자가 없음을 확인한 범위에서 정리한다.

## 공통 보존·검증 조건

- [x] 최신 디자인·동작 계약과 별도 작업 변경을 보존한다. Chrome 확장 프로그램·Popup, 서버 요청·응답·저장 정책 및 제품 기능은 변경하지 않는다.
- [x] 변경 전후 동일한 브라우저·폰트·fixture·화면 상태를 사용하고 변동 요소를 통제한다. 해당 영역의 시각·키보드·동작 회귀를 이 티켓에서 해결한다.
- [x] 기존 브라우저 사용자 동작 검증과 관련 단위 검사를 재사용한다. 마지막 관련 변경 이후 타입 검사·전체 단위 테스트·배포용 빌드·기존 브라우저 smoke 결과와 미검증 경계를 기록한다.

## 범위 경계

공통 상태 표시는 03의 구현을 재사용한다. 요청 데이터와 상태 모델은 보존한다.

이 티켓은 확정된 Web 앱 Tailwind CSS 전환 스펙을 따른다. 상태 표시는 작업 준비 상태이며, 티켓 게시 자체가 코드 구현 착수를 뜻하지 않는다.

## 구현 및 검증 기록 (2026-09-07)

- 영상 `processing`·`completed`·`failed`·`expired` 상태 panel, 단계 표시, 진행률, 상세 결과, 접수 취소, 오류·재시도·새 요청·다운로드 action의 일반 layout·간격·색상·반응형 스타일을 전용 Tailwind utility class로 이동했다. 기존 상태 문구, ARIA 역할, 요청 흐름, focus·navigation lock, API 응답·receipt 저장 동작은 유지했다.
- 영상 화면은 기존 `console-panel`, `status-panel`, `status-head`, `step-tabs`, `status-details`, `result-actions--video`, `download-button`, `secondary-button` 스타일 소비자에서 분리했다. 자막이 아직 사용하는 공통 상태·버튼 규칙은 남겨 두었고, 영상 전용 이전 selector만 제거했다.
- 오류 화면은 lifecycle이 계산한 `statusIconName`·`statusTone`을 사용하도록 해 `expired`를 `failed`와 구분한다. 접수 전 `AbortController` 중단과 접수·중단 경합에서 서버 취소 API를 추가하지 않았고, 요청 내역 receipt 보존 로직도 변경하지 않았다.
- 검증 결과:
  - `pnpm --filter web exec vitest run tests/unit/video-extract-page.test.tsx tests/unit/video-extract-logic.test.ts`: 통과 (2개 파일 / 34개 테스트)
  - `pnpm test`: 통과 (6개 패키지 / 12개 작업, Web 136·API 202·Chrome 확장 165·media-downloader 21·worker 8개 테스트)
  - `pnpm --filter web run lint`: 통과
  - `pnpm --filter web run build`: 통과, `Vite web package verified.`
  - `pnpm --filter web run test:browser`: 25개 시나리오와 정적 서버 종료 상태 `ok`
  - 로컬 Chromium fixture에서 `processing`·`completed`·`failed`·`expired` × light·dark × `320x844`·`390x844`·`1280x900` 24개 조합을 확인했다. 상태 tone·아이콘, 패널 padding, 완료 action columns와 문서·패널 가로 overflow를 측정해 모두 통과했다.
  - 기존 breakpoint 경계인 `820/821px`와 `560/561px`에서 각각 mobile/desktop padding 및 결과 action 1/2열 전환을 별도로 확인했다.

## 검증 경계

단위 검사·배포용 빌드·fixture·정적 서버·Chromium 측정은 로컬 Web CSS와 로컬 요청 흐름만 증명한다. 실제 API·작업 처리기·YouTube 제공자·R2·운영 배포, 물리 모바일 기기 safe-area/브라우저 chrome, 실제 화면 낭독기는 검증하지 않았다.
