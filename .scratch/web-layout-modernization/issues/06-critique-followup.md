# 06: 2026-09-03 Impeccable critique 후속

**What to build:** `/video`, `/subtitles`, `/history`, `/settings`의 남은 UI critique를 기존
Nintendo 미니멀 플랫·API·route 계약 안에서 해소하고, 구현 계약을 현재 문서에 동기화한다.

**Blocked by:** 01, 02, 03, 04, 05

**Status:** done (2026-09-03)

## Acceptance

- [x] C01. 주요 navigation active label과 `/settings` active link는 테마 본문색으로 읽히고 Nintendo red는 indicator/icon에만 사용한다. `aria-current`, focus, disabled 계약을 유지한다.
- [x] C02. 영상 POST와 자막 session·part·complete 요청이 서버 job 생성 전 `요청 취소`로 중단된다. navigation lock·focus·입력/파일 보존을 확인하고, 응답 경쟁으로 이미 생성된 job은 접수증을 보존하며 취소 완료로 가장하지 않는다. 서버 job cancel API는 추가하지 않는다.
- [x] C03. `/history`의 다운로드·다시 요청·삭제·되돌리기 control이 320px·390px에서 각각 최소 44×44px이고 줄바꿈·overflow 없이 동작한다.
- [x] C04 / D01. `checking`·`failed`·`unavailable`은 status-first readiness 화면을 사용하고 `ready`에서만 form을 표시한다. 실패와 미가용을 구분하고 retry·`aria-live`·`aria-busy`·입력/파일 보존을 유지한다.
- [x] C05 / D03. 결과 중심 자막 안내와 속도·정확도 선택은 기본으로 보이며 `base.en`·`small.en`·`Whisper`·`worker`는 닫힌 native disclosure에 둔다. 확인된 사실만 표시하고 click·Enter·Space를 지원한다.
- [x] C06 / D04. `/video`의 `U`, `/subtitles`의 `F` 단축키가 첫 입력 동작을 focus한다. text editing target·modifier·repeat에서는 작동하지 않고 OS/browser shortcut을 가로채지 않는다.
- [x] C07. request·processing·completion·history에 API 상태와 연결된 `원본 → 추출 → 파일 수령` trail을 표시하고 fake progress를 만들지 않는다.
- [x] C08. 760px max-width와 Nintendo flat surface를 유지하며 320px·390px을 해치지 않는 desktop vertical rhythm을 적용한다. 새 hero·gradient·nested card를 추가하지 않는다.
- [x] C09. `/settings`는 primary 3 destinations 밖의 secondary route로 유지하고 `aria-current`, 시각 active marker, 페이지 제목/구조를 강화한다.
- [x] D02. `/video`·`/subtitles`·`/history`·`/settings` route 문서와 PRD/FSD, `docs/DESIGN.md`, `apps/web/PRODUCT.md`, active spec을 현재 구현 계약에 맞춰 동기화한다. historical resolved issues 01–05의 의미는 변경하지 않는다.

## Evidence

- Web unit suite: readiness 상태 변환·abort error·기술 상세 disclosure·flow mapping을 포함한다.
- Browser smoke: readiness 상태 전환·background form 보존·영상/자막 취소·multipart cleanup·response race receipt·U/F 안전성·history geometry·settings active 상태·light/dark responsive 동작을 fixture API와 로컬 Chromium에서 검증한다.
- 정적 검증: `pnpm --filter web run lint`, `pnpm --filter web run test`, `pnpm --filter web run build`, `pnpm run test:web:browser`.
- 시각 검증: 320×844, 390×844, 1280×900의 light/dark를 bounded pass로 확인하고, 변경 target에 Impeccable detector를 한 번 실행한다.

## Boundary

fixture·로컬 Chromium은 실제 API·worker·다운로드 provider/R2, 물리 모바일 browser chrome·safe-area, 화면 낭독기, production 배포 동작을 증명하지 않는다. 서버 job 취소 API도 이 이슈의 범위가 아니다.

## Comments

### 2026-09-03 구현

- status-first readiness gate, pre-job AbortController 중단, multipart abort cleanup, API response race receipt 보존, 공통 request flow trail, active navigation contrast, history action geometry, 자막 기술 상세 disclosure, U/F 단축키를 구현했다.
- C01–C09와 D01–D04를 현재 route·컴포넌트·테스트·문서 계약에 반영했다. `/settings`는 계속 상단 보조 링크이며 모바일 하단 3탭에는 추가하지 않았다.
- 브라우저 증거는 fixture/local Chromium 경계로 보고하며 실제 API·worker/provider·R2·물리 기기·screen reader 증거로 확장하지 않는다.
