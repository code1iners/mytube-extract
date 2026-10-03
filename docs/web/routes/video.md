# Web Route `/video`

## Route

- path: `/video`
- source: `apps/web/src/app/pages/video-extract/page.tsx`
- logic: `apps/web/src/app/pages/video-extract/_hooks/use-video-extract-logic.ts`
- navigation: primary navigation `영상 추출` (데스크톱 왼쪽 메뉴 / 모바일 하단 탭)

## 사용자 흐름

1. 앱은 `GET /health` 확인 중과 장애 상태에서도 주소·형식·품질 입력을 표시하고 편집할 수 있게 한다. 준비 상태와 입력 검증을 모두 통과해야 제출할 수 있다.
2. `YouTube URL → 추출 형식 → 품질 → 추출 요청` 읽기 순서를 유지한다. 충분한 폭에서는 형식·품질을 나란히 놓고 좁은 화면에서는 세로로 감싼다. 각 형식의 세 품질은 항상 보이고 기술 설명만 제출 아래 기본으로 접는다. 초기값과 저장된 선호는 그대로 사용한다.
3. 앱은 `POST /downloads`를 호출한다. 요청이 서버 job을 만들기 전에 사용자가 `요청 취소`를 누르면 AbortController로 브라우저 요청을 중단한다.
4. 성공 응답의 UUID와 접수 시각을 영상 접수증으로 저장한다. 취소 응답 경쟁으로 이미 job이 생성되면 접수증을 보존하고 서버 job 취소로 표시하지 않는다.
5. 현재 route에서 `GET /downloads/:jobId`를 polling해 처리·완료·실패·만료 상태를 표시한다.
6. 완료되면 실제 `downloadUrl`과 형식·품질·보관기간을 표시한다. 주소가 없으면 빈 다운로드 링크 대신 해당 접수증을 가리키는 `요청 내역에서 다시 확인`으로 상태를 다시 조회한다. 실패·만료·상태 조회 오류에는 상세와 재요청 동작을 제공한다.
7. `/history` 이동은 주요 메뉴의 `요청 내역` 링크를 선택할 때만 일어난다.

## 상태와 오류

- mount 시 과거 접수증을 읽거나 상태 조회를 시작하지 않는다. 현재 화면에서 새로 접수한 job만 조회한다.
- 준비 확인 중·실패·미가용 사유는 제출 바로 위 `RequestReadinessNotice` 한곳에서 안내한다. 정상 상태는 준비됨·시각·재확인·갱신 표시를 숨긴다. 장애 상태에만 재확인과 기술 상세를 제공한다.
- 제출 직전 재확인 실패는 접수 실패와 구분해 입력 화면을 유지한다. 실제 POST 실패는 기존 오류·복귀 동작을 제공한다.
- 주소의 접근성 이름은 별도 `label`의 `YouTube URL`로 고정한다. 설명·오류는 `aria-describedby`로 연결하고 지운 뒤 렌더 완료 시 입력으로 포커스를 돌린다.
- `원본 → 추출 → 파일 수령`과 장식 단계 탭은 표시하지 않는다. 접수에는 상태·취소, 처리에는 실제 상태와 서버 수치가 있을 때만 `RequestProgress`를 표시한다. 완료에는 진행 막대 없이 결과·다운로드·새 요청을 제공한다.
- URL 입력값이 있을 때만 `지우기` control을 표시하고, 비어 있을 때는 해당 control을 DOM에 렌더링하지 않는다.
- URL 검증 또는 POST 실패 시 route를 유지하며 접수증을 저장하지 않는다.
- POST가 진행되는 동안 주요 navigation의 현재 목적지를 제외한 route와 `더보기` 안의 `설정` 링크 이동을 막는다. 링크는 계속 표시하며 비활성 목적지에는 `aria-disabled="true"`와 잠금 사유를 제공한다. `요청 취소` 뒤에는 lock을 해제하고 입력을 유지한다.
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
- Browser: 준비 확인·실패·미가용 중 입력 편집, 정상 안내 숨김, 제출 직전 재확인과 조건 전달, 주소의 고정 이름·지우기 포커스, 취소·저장 실패·늦은 성공 접수증 보존을 검증한다.
- 390×844 기본 글자 크기에서는 접힌 기술 설명과 함께 제출 버튼 전체를 최초 화면에 표시한다. 320px·긴 주소·200% 글자 확대에서는 줄바꿈과 스크롤을 허용하고 마지막 조작을 하단 탭 위로 올린다.
- 자막 티켓 03은 `RequestReadinessNotice`와 `RequestProgress`를 재사용할 수 있다. 통신은 영상 adapter, 준비 확인·접수·취소·조회 우선순위는 공유 생명주기가 담당한다.
