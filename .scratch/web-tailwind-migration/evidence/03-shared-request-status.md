# 03: 공통 요청 준비·상태 안내 전환 검증

## 구현 범위

- `RequestReadinessPanel`, `WorkerHealthStatusNotice`, `RequestFlow`, `ErrorDetailsDisclosure`, `ErrorBoundary`의 일반 layout·간격·색상·타이포그래피를 Tailwind 유틸리티로 전환했다.
- 기존 semantic class, `data-health-status`, `data-health-presentation`, `data-flow-stage`, ARIA 이름·상태·announcement 계약을 유지했다. 영상·자막 페이지의 고유 입력·결과 내부는 수정하지 않았다.
- `apps/web/src/styles/global.css`에서 전환한 공통 컴포넌트 규칙만 제거하고, `phase-panel`, `console-panel`, 버튼 기본 스타일 등 다른 소비자의 공통 규칙과 native/special-effect 규칙은 유지했다.
- Tailwind utility selector가 배포용 CSS에 포함되는지 `pnpm --filter web run build` 결과로 확인했다.

## 동작·시각 검증

- 전환 전 관련 단위 기준: `request-flow`, `worker-health-status`, 영상·자막 화면 테스트 4개 파일/28개 테스트 통과.
- 기존 fixture 기반 브라우저 smoke에서 준비 확인, 입력 보존, 완료 결과 전환, 오류 복구, 재확인, 취소, 요청 내역 및 내비게이션 시나리오를 재실행했다.
- 같은 smoke에서 재확인 button의 실제 `:focus-visible`, 오류 상세의 실제 focus 후 `Space` 펼침·닫힘, 백그라운드 확인 중 `aria-live="off"`와 상태 공지 억제를 확인했다.
- light·dark와 `320x844`, `390x844`, `1280x900`에서 공통 상태 surface를 확인했다.
  - 모든 행렬에서 `document.scrollWidth === document.clientWidth`였다.
  - `RequestFlow`는 `padding: 0px`이며 좁은 폭에서 단계 marker와 connector가 한 줄 안에 배치됐다.
  - 준비 완료 compact 상태는 `flex`, `gap: 8px 12px`, 44px 재확인 control을 유지했다.
  - 미가용 expanded 상태는 모바일 `gap: 8px`, `padding: 8px`, 데스크톱 `gap: 12px`, `padding: 12px`와 전체 폭 primary retry를 유지했다.
  - light·dark expanded surface는 각각 기존 semantic surface 값으로 계산됐고, 상태별 processing/completed/failed 색상도 유지됐다.
- `RequestFlow`의 기본 `ol` padding 누락으로 발견된 320px populated-history overflow를 `p-0`으로 보완한 뒤 전체 smoke를 다시 실행했다.

## 자동 검증

- `pnpm --filter web run lint`: 통과
- `pnpm --filter web run test`: 18개 파일/135개 테스트 통과
- `pnpm --filter web run build`: 통과, `Vite web package verified.`
- `pnpm test`: 12개 태스크 성공
- `pnpm --filter web run test:browser`: 25개 시나리오 통과, 결과 `{"status":"ok"}`
- `git diff --check`: 통과

배포용 CSS를 로컬 정적 서버에서 다시 읽은 뒤 `RequestFlow` 상태 색상을 계산했다. 현재 단계 text는 `rgb(72, 72, 72)`, 현재 marker는 `rgb(230, 0, 18)` 배경·테두리와 `rgb(255, 255, 255)` 전경, upcoming marker는 `rgb(239, 239, 239)` 배경·`rgb(138, 138, 138)` 테두리로 계산됐다.

## 증거 경계

위 결과는 로컬 fixture·정적 서버·Chromium·배포용 CSS·자동 테스트가 실행한 범위만 증명한다. 실제 API·작업 처리기·YouTube 제공자·R2·운영 배포·물리 모바일 기기·실제 화면 낭독기 동작은 검증하지 않았다.
