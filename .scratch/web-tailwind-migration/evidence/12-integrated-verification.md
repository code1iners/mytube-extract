# 12: 전체 화면 통합 검증

검증일: 2026-09-08

## 기준과 최종 캡처

- 착수 기준 revision은 `a597383`이며, 초기 비교 기준 revision은 `220a25c`다.
- 초기 기준 화면은 [`01-baseline/`](./01-baseline/)에, 현재 Web bundle의 최종 화면은 [`02-final/`](./02-final/)에 저장했다.
- 두 캡처 모두 같은 Playwright Chromium, Pretendard 폰트, `light`·`dark` 저장 선호, `320x844`·`390x844`·`1280x900` viewport를 사용했다.
- 영상·자막 화면은 초기 기준 PNG와 같은 `GET /health` HTTP 503 fixture로 readiness 실패 상태를 고정했다. 준비 완료·접수·결과 상태는 별도의 기존 smoke fixture로 검증했다.
- `apps/web/tools/capture-integrated-evidence.mjs`가 네 route × 두 theme × 세 viewport, 총 24개 PNG를 생성하고 다음을 assertion한다.
  - `document.documentElement.scrollWidth === clientWidth`
  - workspace와 표시 중인 navigation의 좌우 경계 일치
  - 저장 선호와 `data-theme` 일치
- 캡처 결과: `count: 24`, `status: "ok"`.
- 대표 geometry 결과:
  - `320x844`: workspace·하단 navigation `left=10`, `width=300`, navigation `top=783`, `bottom=844`
  - `390x844`: workspace·하단 navigation `left=10`, `width=370`, `navigation top=783`, `bottom=844`
  - `1280x900`: workspace·desktop navigation `left=260`, `width=760`, `top=88`, `bottom=137`

## 상태·동작 coverage

기존 `apps/web/tests/browser/request-history-smoke.mjs`의 사용자 경계를 재사용했다.

| 영역 | 검증 경계 |
| --- | --- |
| 준비·입력 오류 | `verifyRequestReadinessStatus`, `verifySubtitleRequestErrorRecovery`, `verifyActiveRequestStatusErrors` |
| 영상 입력·접수·중단·결과 | `verifyVideoTaskFirstLayout`, `verifyVideoRequestFlows`, `verifyVideoRequestCancellation`, `verifyRetryRoutes` |
| 자막 입력·업로드·접수·중단·결과 | `verifySubtitleProcessingChoice`, `verifyAccessibleSubtitleFilePicker`, `verifySubtitleLifecycleStatusSurfaces`, `verifySubtitleAcceptanceAndCancellationSurfaces`, `verifySubtitleRequestCancellation` |
| 진행·완료·실패·만료 | 영상·자막 lifecycle fixture의 `queued`·`processing`·`completed`·`failed`·`expired` 상태와 다운로드·다시 요청 경로 |
| 요청 내역 | `verifyEmptyHistoryProductModel`, `verifyPopulatedHistoryResponsiveLayout`, `verifyHistoryDeleteUndo`, `verifyHistoryDeleteUndoResponsiveLayout`, 저장 실패·교차 탭 동기화 경계 |
| 설정·테마 | `verifyThemePreference`, `verifySettingsSurface`, 네 route의 `verifyResponsivePrimaryNavigation` |
| 키보드·실제 focus·touch target | 사용 안내 disclosure, 오류 상세, radio ArrowRight, 파일 picker, 삭제·되돌리기, 44px 이상 조작 영역 assertion |

## 반응형·접근성 행렬

- canonical 화면 캡처는 `320x844`·`390x844`·`1280x900`에서 light·dark를 모두 확인했다.
- 기존 전환점 직전·직후는 smoke에서 `560/561px`, `820/821px`로 확인했다. `640px`은 1280px viewport의 200% 유효 폭을 대신하는 보조 proxy로 overflow·navigation을 확인했다.
- 시스템 테마와 저장 선호는 `/settings`에서 `system` 선택, `matchMedia` 변경, reload 복원을 확인했다.
- 움직임 감소는 `page.emulateMedia({ reducedMotion: 'reduce' })`로 처리 방식 disclosure의 transition 제거를 확인했다.
- 키보드 조작은 native disclosure의 Enter·Space·Escape, 실제 `activeElement`와 `:focus-visible`, radio 선택, 파일 picker 및 삭제·되돌리기 focus 복귀를 확인했다.
- 초기 통합 캡처에서 Tailwind grid 전환으로 모바일 헤더의 숨겨진 두 번째 행과 8px gap이 사라진 회귀를 발견했다. `app-hero.tsx`에 `grid-rows-[auto_auto]`를 복원하고 320/390px smoke에 63px header-height assertion을 추가한 뒤 재검증했다.

## 자동 검증

- `pnpm --filter web run lint`: 통과
- `pnpm --filter web run build`: 통과, `Vite web package verified.`
- `node apps/web/tools/capture-integrated-evidence.mjs`: 통과, 24개 캡처
- `pnpm --filter web run test:browser`: 통과, build·기존 smoke·정적 서버 결과 `{"status":"ok"}`
- `pnpm --filter web run test`: 통과, 18개 파일·137개 테스트
- `pnpm test`: 통과, 12개 task; Web 137, API 202, Chrome extension 165, media-downloader 21, worker 8개 테스트
- `git diff --check`: 통과

## 검증 경계

이 증거는 fixture 응답·배포용 Web bundle·로컬 Chromium·자동 layout assertion이 실행한 범위만 증명한다. 실제 API·작업 처리기·YouTube 제공자·R2·운영 배포, 물리 모바일 browser chrome·safe-area, 실제 화면 낭독기, 실제 browser UI의 200% text zoom은 검증하지 않았다. `640px` proxy와 로컬 reduced-motion emulation을 실제 기기·OS 승인으로 해석하지 않는다. Chrome 확장 프로그램 Popup은 이번 전환 범위 밖이다.
