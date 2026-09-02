# Web Route `/video`

## Route

- path: `/video`
- source: `apps/web/src/app/pages/video-extract/page.tsx`
- logic: `apps/web/src/app/pages/video-extract/_hooks/use-video-extract-logic.ts`
- navigation: primary navigation `영상 추출` (desktop header tab / mobile bottom tab)

## 사용자 흐름

1. 사용자는 YouTube URL, 오디오/비디오 형식, 품질을 선택한다.
2. 앱은 `GET /health`로 worker를 확인하고 `POST /downloads`를 호출한다.
3. 성공 응답의 UUID와 접수 시각을 영상 접수증으로 저장한다.
4. 현재 route에서 `GET /downloads/:jobId`를 polling해 처리·완료·실패·만료 상태를 표시한다.
5. 완료되면 실제 `downloadUrl`과 형식·품질·보관기간을 표시하고, 실패·만료·상태 조회 오류에는 상세와 재요청 동작을 제공한다.
6. `/history` 이동은 상단 `요청 내역` 링크를 선택할 때만 일어난다.

## 상태와 오류

- mount 시 과거 접수증을 읽거나 상태 조회를 시작하지 않는다. 현재 화면에서 새로 접수한 job만 조회한다.
- 요청 form 상단에서 API 연결과 worker 준비 상태를 확인 중·준비됨·worker 중단·확인 실패의 텍스트와 아이콘으로 표시한다. 마지막 확인 시각과 `다시 확인` 동작을 함께 제공하며, 확인 중에는 재확인 요청을 중복 전송하지 않는다.
- health가 준비되지 않았을 때 제출 버튼 가까이에 비활성화 이유를 표시하고 aria-describedby로 연결한다.
- URL 검증 또는 POST 실패 시 route를 유지하며 접수증을 저장하지 않는다.
- POST가 진행되는 동안 주요 navigation의 현재 목적지를 제외한 route와 상단 `설정` 링크의 이동을 막는다. 링크는 계속 표시하며 비활성 목적지에는 `aria-disabled="true"`와 잠금 사유를 제공한다.
- 접수 이후에는 공유 polling 정책으로 현재 job을 조회하고, terminal 상태나 재시도 불가 조회 오류에서 polling을 멈춘다.
- 접수 뒤 worker health 상태가 바뀌어도 현재 job의 API 상태와 메시지를 우선한다.

## API

- `GET /health`
- `POST /downloads`
- `GET /downloads/:jobId`
- `GET /downloads/:jobId/file`

## 검증

- `pnpm --filter web run test`
- `pnpm --filter web run lint`
- `pnpm run test:web:browser`
- Browser: 새로고침 후 빈 form, 접수 중 navigation lock, 성공 시 in-place 결과·다운로드, failed/expired·상태 조회 오류의 상세와 재요청, POST 실패 시 미저장·미이동
