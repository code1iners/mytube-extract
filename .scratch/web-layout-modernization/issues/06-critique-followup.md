# 06: 2026-09-03 Impeccable critique 후속

**What to build:** `/video`, `/subtitles`, `/history`, `/settings`의 현재 UI critique C01–C10과 D01–D04를 기존
Nintendo 미니멀 플랫·API·route 계약 안에서 해소하고, 구현 계약을 현재 문서와 테스트에 동기화한다.

**Blocked by:** 01, 02, 03, 04, 05

**Status:** done (2026-09-03)

## Acceptance

- [x] C01 / D01. 최초 health 확인 중에는 status-first 화면을 사용하되, 기존 `ready` form은 15초 주기 background refetch 중 유지한다. 완료된 health 응답이 API 실패 또는 worker 미가용일 때만 form을 대체하고, URL·파일·선택값과 요청/폴링 계약은 보존한다.
- [x] C02 / D02. failed/unavailable readiness에서 Nintendo red primary `다시 확인`을 full-width로 먼저 표시하고, 기술 상세 disclosure를 그 아래에 둔다. 입력 보존 안내와 `aria-busy`·live semantics를 유지한다.
- [x] C03. 자막 완료 receipt에 API 응답의 `fileName`, 결과 형식 `영어 SRT`, `retentionDays`와 다운로드·새 요청 동작을 표시한다.
- [x] C04 / D03. 320px·390px 헤더에서 `사용 안내`와 `설정`을 한 줄의 접근 가능한 `더보기` 메뉴로 묶는다. Enter·Space·Escape·pointer 동작, 44px target, focus return, navigation lock과 safe-area를 검증한다.
- [x] C05 / D04. primary navigation과 page H2를 영상은 `영상 추출`, 자막은 `자막 추출`로 통일하고 CTA는 `추출 요청`, `영어 SRT 생성`처럼 구체적인 동작명을 유지한다.
- [x] C06. URL과 파일 제거 동작의 짧은 사용자 문구를 `지우기`로 통일하고 실제 조작 영역을 44px 이상으로 유지한다.
- [x] C07. ready health status와 마지막 확인 시각을 제목 인접 compact 보조 메타로 낮추며, retry는 계속 제공한다.
- [x] C08. 첫 사용 맥락에서 SRT를 `영어 자막 파일(SRT)`로 설명하고, 기술 상세는 기본으로 노출하지 않는다.
- [x] C09. browser-local history, 7일 보관, API 응답 source of truth를 empty/history/completion의 관련 위치에서 짧게 맥락화하고 전역 안내 중복을 늘리지 않는다.
- [x] C10. `원본 → 추출 → 파일 수령` trail의 단계 marker·현재 상태와 완료 receipt의 원본/결과/보관 정보를 제품 고유 언어로 강화하되 fake progress와 기존 상태 계약을 만들지 않는다.

## Evidence

- [x] Web unit suite: health 상태 변환·background ready 보존·retry/detail 순서·canonical heading·subtitle receipt·more menu·flow marker를 포함한다.
- [x] Browser smoke: health 네 상태·background form 보존·입력/파일 보존·`더보기` keyboard/pointer focus·영상/자막 완료 receipt·history context·320/390/1280 responsive geometry를 fixture API와 로컬 Chromium에서 검증한다.
- [x] 정적 검증: `pnpm --filter web run lint`, `pnpm --filter web run test`, `pnpm --filter web run build`, `pnpm run test:web:browser`.
- [x] 시각 검증: 320×844, 390×844, 1280×900의 light/dark를 한 번의 bounded pass로 확인하고, 변경 target에 Impeccable detector를 한 번 실행한다.

## Boundary

fixture·로컬 Chromium은 실제 API·worker·다운로드 provider/R2, 물리 모바일 browser chrome·safe-area, 화면 낭독기, production 배포 동작을 증명하지 않는다. 서버 job 취소 API도 이 이슈의 범위가 아니다.

## Comments

### 2026-09-03 구현

- status-first readiness gate, pre-job AbortController 중단, multipart abort cleanup, API response race receipt 보존, 공통 request flow trail, active navigation contrast, history action geometry, 자막 기술 상세 disclosure, U/F 단축키를 구현했다.
- C01–C09와 D01–D04를 현재 route·컴포넌트·테스트·문서 계약에 반영했다. `/settings`는 계속 상단 보조 링크이며 모바일 하단 3탭에는 추가하지 않았다.
- 브라우저 증거는 fixture/local Chromium 경계로 보고하며 실제 API·worker/provider·R2·물리 기기·screen reader 증거로 확장하지 않는다.

### 2026-09-03 critique 후속

- C01–C10과 D01–D04의 상태·receipt·메뉴·flow·문서 동기화를 진행했다. 최종 gate가 끝나면 상태를 `done`으로 갱신한다.
- 바깥 pointer로 `더보기`를 닫을 때 summary로 focus를 복귀하고, 320px·390px·1280px의 keyboard/pointer·44px target 검증을 추가했다.
- 실제 API·worker/provider·R2·물리 safe-area·screen reader·production 증거는 이 작업에서 제공하지 않는다.

### 2026-09-03 최종 검증

- `pnpm --filter web run lint`, `pnpm --filter web run test`(17개 파일·124개 테스트), `pnpm --filter web run build`, `pnpm run test:web:browser`가 모두 통과했다.
- 변경 소스 target detector 결과는 `[]`였고, 320px·390px·1280px의 light/dark bounded visual pass와 모바일 CTA·fixed navigation 간격 재확인을 완료했다.
- browser smoke는 fixture API와 로컬 Chromium 증거이며 실제 API·worker/provider/R2·물리 safe-area·screen reader·production 동작은 증명하지 않는다.
