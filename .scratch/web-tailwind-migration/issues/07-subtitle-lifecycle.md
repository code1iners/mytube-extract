# 07: 자막 추출 접수·결과 상태 전환

Status: done (2026-09-07)

**What to build:** 자막 요청의 업로드·접수·처리 상태를 확인하고, 중단 또는 결과 다운로드와 새 요청을 기존처럼 수행할 수 있다.

**Blocked by:** 06: 자막 추출 파일·처리 방식 전환

## 완료 조건

- [x] 자막 업로드·접수 중·중단·진행·완료·실패·만료의 고유 표시와 결과 동작을 유틸리티로 옮긴다.
- [x] 기존 브라우저 fixture로 업로드·접수 단계의 중단, 실패, 접수 성공을 재현하고 포커스·화면 이동 가능 여부가 기존처럼 회복된다.
- [x] 기존 업로드 정리와 접수 경합 시 내역 보존, 상태 추적이 유지된다. 스타일 변경을 이유로 생명주기 로직이나 재시도 정책을 수정하지 않는다.
- [x] 완료 결과의 원본 파일명·형식·보관 안내와 다운로드·새 요청 동작을 보존한다. 임의 진행률을 추가하지 않는다.
- [x] 라이트·다크 및 세 화면 크기에서 모든 고유 상태를 비교하고 긴 파일명·오류가 조작 요소를 가리거나 가로로 넘치지 않는다.
- [x] 파일 선택부터 결과까지 기존 브라우저 검증을 통과하며, 자막 전용 이전 규칙은 소비자가 없는 범위에서 정리한다.

## 공통 보존·검증 조건

- [x] 최신 디자인·동작 계약과 별도 작업 변경을 보존한다. Chrome 확장 프로그램·Popup, 서버 요청·응답·저장 정책 및 제품 기능은 변경하지 않는다.
- [x] 변경 전후 동일한 브라우저·폰트·fixture·화면 상태를 사용하고 변동 요소를 통제한다. 해당 영역의 시각·키보드·동작 회귀를 이 티켓에서 해결한다.
- [x] 기존 브라우저 사용자 동작 검증과 관련 단위 검사를 재사용한다. 마지막 관련 변경 이후 타입 검사·전체 단위 테스트·배포용 빌드·기존 브라우저 smoke 결과와 미검증 경계를 기록한다.

## 범위 경계

공통 오류·단계 표시는 03을 재사용한다. 외부 저장소와 실제 처리기 성공은 fixture 검증과 구분한다.

이 티켓은 확정된 Web 앱 Tailwind CSS 전환 스펙을 따른다. 상태 표시는 작업 준비 상태이며, 티켓 게시 자체가 코드 구현 착수를 뜻하지 않는다.

## 구현 및 검증 기록 (2026-09-07)

- 자막 `accepting`·`processing`·`completed`·`failed`·`expired` panel, 단계 표시, 진행률, 상세 결과, 접수 취소, 오류 복귀, 다운로드·새 요청 action을 전용 Tailwind utility class로 이동했다. 상태 문구, ARIA 역할, `RequestFlow`, API 응답·receipt·polling·취소 경계는 유지했다.
- lifecycle이 계산한 `statusIconName`·`statusTone`을 오류 화면에도 연결해 만료를 실패와 구분했다. 업로드 정리·접수 경합, 상태 추적, 재시도 정책과 임의 진행률은 변경하지 않았다.
- `console-panel`, `status-panel`, `status-head`, `status-details`, `result-actions`, `download-button` 등 자막 lifecycle 전용 이전 규칙을 제거하고, 공통 소비자가 남은 규칙은 보존했다. 결과에는 원본 파일명·영어 SRT·보관 기간·다운로드·새 요청을 그대로 유지했다.
- 기존 자막 upload/accept 성공·실패·중단·결과 smoke에 light/dark × `320x844`·`390x844`·`560x844`·`561x844`·`820x844`·`821x844`·`1280x900`의 `queued`·`extracting_audio`·`transcribing`·`completed`·`failed`·`expired` 84개 상태 조합을 추가했다. 접수 중·중단은 같은 테마·폭 6개 조합에서 실제 포커스 복귀와 navigation lock 해제를 확인했다. 긴 파일명·오류 문구, tone, panel 경계, 문서 가로 overflow와 완료 action을 측정했다.
- 기존 Web shell의 경계 계약에 맞춰 자막 lifecycle의 `820/821px`와 결과 action의 `560/561px` 전환을 `max-[821px]`·`max-[561px]` utility로 연결하고, 경계 직전·직후 fixture 측정을 추가했다.
- 검증 결과:
  - `pnpm --filter web exec vitest run tests/unit/subtitles-extract-page.test.tsx tests/unit/subtitle-request.test.ts tests/unit/subtitle-request-adapter.test.ts tests/unit/video-extract-page.test.tsx tests/unit/video-extract-logic.test.ts`: 통과 (5개 파일 / 59개 테스트)
  - `pnpm --filter web run test`: 통과 (18개 파일 / 137개 테스트)
  - `pnpm test`: 통과 (6개 패키지 / 12개 작업, Web 137·API 202·Chrome 확장 165·media-downloader 21·worker 8개 테스트)
  - `pnpm --filter web run lint`: 통과
  - `pnpm --filter web run build`: 통과, `Vite web package verified.`
  - `pnpm --filter web run test:browser`: 전체 시나리오와 추가 84개 상태 조합·6개 접수/중단 조합, 정적 서버 종료 상태 `ok`

## 검증 경계

단위 검사·배포용 빌드·fixture·정적 서버·Chromium 측정은 로컬 Web CSS와 로컬 요청 흐름만 증명한다. 실제 API·작업 처리기·YouTube 제공자·R2·운영 배포, 물리 모바일 기기 safe-area/브라우저 chrome, 실제 화면 낭독기는 검증하지 않았다.
