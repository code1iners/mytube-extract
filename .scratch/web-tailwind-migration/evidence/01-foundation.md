# 01: Tailwind 연결과 기존 스타일 공존 기반 검증

## 구현 범위

- `apps/web`에 Tailwind CSS `4.3.3`과 Vite plugin을 연결했다.
- 기존 `:root` semantic token을 `@theme inline` alias로 연결했다. alias는 런타임의 `--color-*`, `--font-*`, `--radius-*`, `--shadow-*` 값을 참조하므로 기존 light·dark theme 상태를 그대로 따른다.
- Tailwind preflight는 가져오지 않고 `theme.css`와 `utilities.css`만 가져왔다. 따라서 미전환 화면의 기본 버튼·입력·제목 스타일을 reset이 덮어쓰지 않는다.
- 공통 `AppMark`의 display·크기와 브랜드 SVG의 fill·stroke를 utility(`block`, `size-full`, `fill-mytube-action-primary`, `stroke-mytube-on-primary`)로 전환했다.
- `app-mark`와 `app-icon` 선택자는 기존 소비자와 상태 스타일을 위해 유지했으며, Chrome 확장 프로그램·요청 동작·저장 구조는 변경하지 않았다.

## 전환 전 기준

- 기준 revision: `220a25c` (`모바일 헤더 정렬과 입력창 포커스 표시 개선`)
- 기준은 해당 revision의 현재 작업 트리에서 확보했다. 기존 단축키 제거 등 별도 작업 변경은 기준과 구현 모두에서 보존했다.
- `pnpm --filter web run lint`: 통과
- `pnpm --filter web run test`: 18개 파일, 135개 테스트 통과
- `pnpm --filter web run build`: 통과, `Vite web package verified.`
- `pnpm --filter web run test:browser`: `populated history stays unclipped with long job details` 진입 전까지 24개 시나리오 통과 후 1분 이상 종료되지 않아 중단했다. 같은 실행 경계가 전환 후에도 재현되어 이번 변경으로 새로 발생한 실패로 판단하지 않았다.

## 전후 화면 비교

Playwright로 `/video`, `/subtitles`, `/history`, `/settings`를 각각 light·dark 및 `320x844`, `390x844`, `1280x900`에서 캡처했다.

- 전환 전: [`01-baseline/`](./01-baseline/)
- 전환 후: [`01-after/`](./01-after/)
- PNG 24쌍 모두 `cmp` 결과 `identical`
- 두 캡처는 파일 복사가 아니라 서로 다른 시점의 별도 Chromium 실행이다. 대표 파일 `video-light-390x844.png`의 mtime은 baseline `2026-09-07T11:23:16+0900`, after `2026-09-07T11:31:33+0900`이다.
- baseline 실행은 Tailwind 의존성·코드 적용 전에 실행했고, after 실행은 최종 `pnpm --filter web run build` 성공 뒤 실행했다. 두 실행의 대표 PNG SHA-256은 `45689eba33ea5a3265172bebe2ca747d26358d74e53e2992c0c4285398f84ed3`으로 같다. 동일 hash는 시각 보존을 확인한 결과이며, 두 실행의 독립성을 대신하지 않는다.
- 두 테마의 실제 `AppMark` 계산 스타일 확인:
  - `display: block`
  - 모바일 폭에서 `26px × 26px`
  - 브랜드 fill `rgb(230, 0, 18)`
  - 브랜드 stroke `rgb(255, 255, 255)`

## 검증 경계

단위 검사·배포용 빌드·Playwright 정적 서버 캡처는 Tailwind 생성물과 로컬 브라우저 표시만 증명한다. 실제 API·worker·YouTube 제공자·R2·운영 배포·물리 기기·화면 낭독기 동작은 검증하지 않았다.
