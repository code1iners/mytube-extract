# Web Route `/subtitles`

## Route

- path: `/subtitles`
- source: `apps/web/src/app/pages/subtitles-extract/page.tsx`
- logic: `apps/web/src/app/pages/subtitles-extract/_hooks/use-subtitles-extract-logic.ts`
- navigation: primary navigation `자막 추출` (desktop left menu / mobile bottom tab)

## 사용자 흐름

1. 앱은 `GET /health`를 확인하면서 파일·처리 방식 입력을 계속 표시한다. 확인 중·실패·미가용에는 제출만 제한하고, 제출 직전 한곳에 이유와 필요한 재확인을 제공한다. 정상 준비 안내는 숨긴다.
2. 사용자는 `mp4`, `mov`, `webm` 로컬 영상 파일을 키보드나 끌어놓기로 선택한다. 같은 영역에 파일명·크기·파일 변경·지우기를 표시한다. 긴 파일명은 줄바꿈하며, 비지원 새 드롭은 거부하고 기존 유효 파일은 유지한다. 파일 오류와 업로드 용량 오류는 입력 바로 아래 표시한다.
3. 사용자는 속도 우선(`base_en`) 또는 정확도 우선(`small_en`) 처리 방식을 비교한 뒤 영어 자막 파일(SRT) 생성을 요청한다. 사용자 중심 결과 설명은 바로 보이고, 모델 식별자·로컬 Whisper·worker 정보는 닫힌 native `기술적인 처리 정보` disclosure에서 필요할 때 확인한다.
4. `POST /subtitles/uploads`로 multipart session을 만들고 presigned URL로 파일 part를 직접 업로드한다. session·part·complete 중 사용자가 `요청 취소`를 누르면 브라우저 요청을 중단하고 abort cleanup을 best-effort로 시도한다.
5. `POST /subtitles/uploads/complete` 성공 응답의 UUID와 접수 시각을 자막 접수증으로 저장한다. 응답 경쟁으로 job이 생성되면 접수증을 보존하고 서버 job 취소로 표시하지 않는다.
6. 현재 route에서 `GET /subtitles/jobs/:jobId`를 polling해 처리·완료·실패·만료 상태를 표시한다.
7. 완료되면 API 응답의 `fileName`, 결과 형식 `영어 SRT`, `retentionDays`와 실제 SRT `downloadUrl`을 표시하고, 다운로드·새 요청 동작을 제공한다. 실패·만료·상태 조회 오류에는 상세와 기존 파일을 유지한 재요청 동작을 제공한다.
8. 업로드 실패 시 `POST /subtitles/uploads/abort` 정리를 best-effort로 요청한다.

## 입력 수명과 새 요청

- 영상 초안과 독립된 탭 메모리에 실제 `File`과 처리 방식을 보관한다. 메뉴 왕복 뒤에도 해당 파일의 바이트를 기존 분할 업로드로 전송한다. 파일·파일 내용은 영속 저장하거나 다른 탭으로 동기화하지 않는다.
- 새로고침과 새 탭은 파일이 빈 상태에서 기억한 처리 방식으로 시작한다. 저장된 선호가 없으면 속도 우선이다.
- 사용자가 처리 방식을 직접 바꿀 때만 현재 초안과 이후 기본값을 갱신한다. 초안 복원·화면 재진입은 선호를 저장하지 않는다. 저장 실패 시 선택은 탭 메모리에 유지하며 새로고침 복원은 보장하지 않는다.
- 완료 후 `새 요청`은 파일만 비우고 현재 처리 방식을 유지하며 파일 선택 버튼으로 포커스를 돌린다. 완료 접수증은 내역에 남는다.
- 접수된 파일은 같은 화면의 진행·결과·오류 복구에 사용한다. 접수 후 메뉴를 떠났다 돌아오면 파일이 빈 새 입력과 기억한 처리 방식을 제공한다. 오류 복구 화면에서 메뉴를 이동해도 접수된 원본을 미제출 초안으로 되살리지 않는다.
- 파일 변경·지우기·처리 방식 직접 변경은 새 미제출 입력 버전으로 보관한다. 잘못된 새 드롭은 기존 유효 파일을 보존한다. 취소된 요청의 늦은 성공은 이후에 편집한 초안을 초기화하지 않는다.
- 접수 전 취소·접수 실패는 현재 파일과 처리 방식을 유지한다. 늦은 접수 성공·접수증 저장 실패·업로드 정리·이동 잠금은 기존 추출 요청 생명주기와 어댑터의 계약을 유지한다.

## 상태와 오류

- mount 시 과거 접수증을 읽거나 상태 조회를 시작하지 않는다. 현재 화면에서 새로 접수한 job만 조회한다.
- 최초 확인·확인 실패·처리 서비스 미가용에도 파일과 처리 방식을 편집할 수 있다. 제출 직전 준비 상태를 재확인하며, 준비되지 않았으면 업로드 요청을 보내지 않는다.
- `RequestReadinessNotice`는 제출 바로 앞 한곳에서 상태 공지·상세·재확인을 제공한다. 정상 준비 안내·확인 시각·재확인은 숨긴다.
- 처리 방식은 항상 표시하고 기술 설명만 제출 뒤의 기본 닫힌 disclosure에 둔다. 390×844 기본 글자 크기에서 파일 선택 전후 제출 버튼 전체가 최초 화면에 보인다. 작은 화면·긴 파일명·200% 글자 확대에서는 스크롤로 마지막 조작을 하단 탭 위에 드러낸다.
- 공통 단계와 전체 단계 목록은 표시하지 않는다. 기존 어댑터가 전달하는 업로드 비율, 서버가 제공하는 처리 비율만 `RequestProgress`로 표시하며 null이면 막대를 생략한다. 완료에는 막대를 남기지 않는다. 다운로드 주소가 없으면 내역의 해당 접수증으로 연결해 재조회한다.
- session 생성부터 part upload와 complete 응답까지 주요 navigation의 현재 목적지를 제외한 route와 `더보기` 안의 `설정` 링크 이동 및 중복 제출을 막는다. 링크는 계속 표시하며 비활성 목적지에는 `aria-disabled="true"`와 잠금 사유를 제공한다. `요청 취소` 뒤에는 lock을 풀고 파일·선택을 유지한다.
- complete 성공 뒤 navigation lock을 해제하고 현재 route에서 공유 정책으로 job을 polling한다.
- 파일 검증, 413, direct upload, complete 실패 시 접수증을 저장하거나 history로 이동하지 않는다.
- 접수 뒤 worker health 상태가 바뀌어도 현재 job의 API 상태와 메시지를 우선한다.

## API

- `GET /health`
- `POST /subtitles/uploads`
- R2 presigned URL `PUT`
- `POST /subtitles/uploads/complete`
- `POST /subtitles/uploads/abort`
- `GET /subtitles/jobs/:jobId`
- `GET /subtitles/jobs/:jobId/file`

## 미구현 범위

- `docs/unimplemented/current-unimplemented.md`

## 검증

- `pnpm --filter web run test`
- `pnpm --filter web run lint`
- `pnpm run test:web:browser`
- Browser: 영상·자막 동시 초안, 메뉴 복귀 뒤 실제 업로드 바이트·처리 방식, 기본값과 초안 분리, 새로고침·새 탭의 빈 파일, 완료 후 새 요청과 포커스·접수증 보존, 접수 후 복귀, 취소·실패·만료·조회 오류 복구, 늦은 성공과 새 편집, 저장 차단
- Browser: 업로드 중 navigation lock, complete 성공 뒤 in-place 결과·SRT 다운로드, failed/expired·상태 조회 오류의 상세와 재요청
- Browser: 준비 상태 네 종류에서 파일/model 편집·보존, U/F 단축키 미제공, session·part 중단 및 `/subtitles/uploads/abort` cleanup, 응답 경쟁 접수증 보존·서버 job cancel 미호출, 닫힌 `기술적인 처리 정보` disclosure의 click/Enter/Space, 공통 단계 미노출, 320/390/820/821/1280 배치와 긴 파일명·200% 글자 확대

## 내역에서 다시 요청

실패·만료 자막의 `다시 요청`은 내역 화면에서 파일 선택을 연다. 새로 고른 유효한 파일을 서버 상태에 남은 처리 방식으로 업로드하며, 작성 중인 이 화면의 파일·선택은 보존한다. 실제 접수 성공만 이후 기본값을 갱신하고 초안 복원은 기본값을 덮어쓰지 않는다. 파일 선택 취소·업로드 실패·늦은 접수와 저장 실패의 처리는 [요청 내역](history.md#자막-다시-요청)을 따른다.
