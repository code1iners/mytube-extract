Status: done (2026-08-25)

# YouTube 추출 client fallback 개선

## 문제 정의

MyTube Extract에서 일반적으로 처리되던 YouTube URL과 특정 URL의 처리 결과가 갈린다. 이번에 재현한 실패 URL은 공개 영상이고 YouTube watch page에 streamingData가 있지만, 현재 추출 경로가 embeddable 영상에 제한된 web_embedded client를 고정해 사용하면서 audio와 video 요청이 모두 EXTRACTION_FAILED로 종료된다.

현재 문제는 Web 앱의 queued job 경로와 기존 API direct media 경로에 같은 client 제약이 각각 존재한다는 점이다. 한쪽만 수정하면 사용자가 어떤 제품 표면이나 API 경로를 이용하는지에 따라 같은 URL의 결과가 달라질 수 있다. 기존에 통과하던 비교 URL도 계속 성공해야 하며, 최종적으로는 단순히 subprocess가 끝나는 것뿐 아니라 queued job이 완료되고 실제 downloadUrl 파일을 받을 수 있어야 한다.

검증 대상 URL은 다음 두 개다.

- known-good 비교 URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ
- 기존 실패 URL: https://youtu.be/a0iBRRoDnDw?si=PGGG5psGrOm34WkG

## 해결 방안

API direct media와 worker queued job이 공통 media-downloader 정책을 사용하도록 추출 시도 경계를 통합한다. API와 worker 모두 yt-dlp 2026.08.19를 고정하고, 일반 추출에는 yt-dlp의 기본 client를 먼저 사용한다. 기본 client에서 client 전환 대상 오류가 발생할 때만 web_embedded를 한 번 fallback으로 시도한다.

fallback은 client 전환 전용 오류 allowlist에만 적용한다. embed-disabled 오류는 영상이 embed 불가하다는 의미이므로 web_embedded를 다시 시도하지 않는다. 일반 transient 오류는 기존처럼 같은 client로 한 번 재시도하고, client 전환 대상 오류는 같은 client를 반복하지 않고 즉시 fallback으로 전환한다. fallback client가 실패하면 추가 client 시도 없이 기존 외부 실패 계약을 유지한다.

현재 API와 Web 앱·Chrome 확장 프로그램이 사용하는 외부 오류 계약은 바꾸지 않는다. 일반 최종 실패는 EXTRACTION_FAILED, YouTube 인증 확인 실패는 YOUTUBE_AUTH_REQUIRED를 유지하고, client별 stderr와 시도 결과는 server-only redacted diagnostic으로만 남긴다.

성공 기준은 known-good URL과 실패 URL 각각에 대해 오디오 320kbps 및 비디오 1080p를 direct media와 queued worker에서 처리하는 것이다. 품질 값은 기존 계약대로 상한값으로 해석하므로, 요청값 이하의 유효한 결과 파일이면 성공으로 인정한다.

## 사용자 스토리

1. As a Web 앱 사용자, I want known-good URL을 오디오 320kbps로 요청하고 성공한 파일을 받고 싶다, so that 기존에 통과하던 추출 기능이 회귀하지 않는다.
2. As a Web 앱 사용자, I want known-good URL을 비디오 1080p로 요청하고 성공한 파일을 받고 싶다, so that 기존에 처리되던 video 경로를 계속 사용할 수 있다.
3. As a Web 앱 사용자, I want 실패 URL을 오디오 320kbps로 요청하고 성공한 파일을 받고 싶다, so that embeddable 여부 때문에 공개 영상을 처리하지 못하는 문제가 사라진다.
4. As a Web 앱 사용자, I want 실패 URL을 비디오 1080p로 요청하고 성공한 파일을 받고 싶다, so that audio와 video 중 한 형식만 우연히 복구되는 상태를 피한다.
5. As a API direct media 사용자, I want 두 URL의 대표 audio/video 요청이 같은 client 정책으로 처리되기를 원한다, so that 호출 경로에 따라 추출 성공 여부가 달라지지 않는다.
6. As a Web 앱 사용자, I want queued job이 queued에서 processing을 거쳐 completed가 되기를 원한다, so that 비동기 추출이 실제로 완료되었는지 확인할 수 있다.
7. As a Web 앱 사용자, I want completed job에 유효한 downloadUrl이 포함되기를 원한다, so that 상태만 completed이고 파일은 받을 수 없는 상황을 피한다.
8. As a Web 앱 사용자, I want downloadUrl에서 실제 non-empty 파일을 받을 수 있기를 원한다, so that 성공 응답이 손상되거나 빈 artifact를 가리키지 않는다.
9. As a 사용자, I want 기본 client가 성공하면 불필요한 fallback이 실행되지 않기를 원한다, so that 추출 시간이 늘어나거나 YouTube 요청량이 불필요하게 증가하지 않는다.
10. As a 사용자, I want 기본 client가 client 전환 대상 오류를 반환하면 web_embedded fallback이 자동으로 실행되기를 원한다, so that client별 접근 차이로 인한 실패를 복구할 수 있다.
11. As a 사용자, I want embed-disabled 오류에서 의미 없는 web_embedded 재시도가 발생하지 않기를 원한다, so that 실패까지의 시간이 불필요하게 늘어나지 않는다.
12. As a 사용자, I want 일시적인 추출 오류는 기존 retry 정책으로 한 번 더 시도되기를 원한다, so that 일시적인 upstream 문제로 바로 실패하지 않는다.
13. As a 사용자, I want client 전환 대상 오류에서 같은 client가 반복되지 않기를 원한다, so that 동일한 실패를 반복하는 대신 다른 추출 경로가 사용된다.
14. As a 사용자, I want fallback client가 한 번 실패하면 제한된 시도 안에서 종료되기를 원한다, so that 요청이 과도하게 오래 실행되거나 여러 client를 무분별하게 호출하지 않는다.
15. As a 사용자, I want 최종 실패 시 기존 오류 메시지와 상태 계약을 계속 받기를 원한다, so that Web 앱과 Chrome 확장 프로그램의 오류 처리가 깨지지 않는다.
16. As a 사용자, I want yt-dlp client 이름이나 stderr 원문이 화면에 노출되지 않기를 원한다, so that 내부 실행 정보와 민감한 upstream 정보가 외부로 새지 않는다.
17. As a 운영자, I want 기본 client와 fallback client의 시도 결과를 server-only 진단 로그에서 구분해 보고 싶다, so that 특정 URL의 실패 원인을 client 문제와 일반 환경 문제로 나눌 수 있다.
18. As a 운영자, I want API와 worker가 동일한 fallback 정책을 사용하기를 원한다, so that 운영 경로별로 다른 장애가 재발하지 않는다.
19. As a 개발자, I want client 정책을 하나의 공통 media-downloader 경계에서 테스트하고 싶다, so that API와 worker의 중복 구현이 서로 다른 동작을 만들지 않는다.
20. As a 개발자, I want fake runner로 client 순서와 시도 예산을 검증하고 싶다, so that 실제 YouTube 상태에 의존하지 않고 핵심 실패 경로를 재현할 수 있다.
21. As a 개발자, I want real integration에서 known-good URL과 실패 URL을 함께 검증하고 싶다, so that 이번 회귀 수정이 기존 성공 경로를 깨지 않았음을 확인할 수 있다.
22. As a 릴리스 담당자, I want 두 URL의 queued job이 실제 파일 응답까지 완료되는지 확인하고 싶다, so that subprocess 성공만으로 운영 완료를 선언하지 않는다.

## 구현 결정

- API direct media와 worker queued job은 단일 공통 media-downloader 정책을 사용한다. client 순서, client 전환 오류 분류, 시도 예산, 최종 진단 형식을 호출자별로 다시 구현하지 않는다.
- API와 worker가 사용하는 yt-dlp는 2026.08.19로 동일하게 고정한다. 구현 시점의 최신 release를 부동적으로 추적하지 않으며, 두 실행 표면이 서로 다른 extractor 동작을 갖지 않도록 한다.
- 추출 시도 순서는 기본 client를 첫 시도로 하고, client 전환 대상 오류에 한해 web_embedded를 fallback으로 사용한다. mweb, PO token, cookies, 다른 player client 추가는 이번 결정에 포함하지 않는다.
- 기본 client가 성공하면 fallback은 실행하지 않는다.
- client 전환 대상 오류는 공통 진단 경계에서 구조화한 allowlist로 판정한다. raw stderr의 일반적인 403 문자열이나 단순 non-zero 종료만으로 fallback하지 않으며, client 변경이 의미 있는 format/client 접근 실패만 대상으로 한다.
- embed-disabled 오류는 web_embedded fallback의 대상이 아니다. 이 오류를 확인하면 같은 URL에 대해 web_embedded를 추가로 시도하지 않고 최종 실패로 처리한다.
- 일반 transient extraction 오류는 기존처럼 같은 client로 한 번 재시도한다. client 전환 대상 오류는 같은 client retry를 생략하고 즉시 web_embedded로 전환한다. fallback client는 한 번만 시도하며 fallback 실패 뒤 추가 client나 동일 client 재시도는 하지 않는다.
- abort, process spawn 실패, 인증 확인 필요, 네트워크 단절, upload 실패는 client fallback으로 해결할 수 있는 오류로 취급하지 않는다. 네트워크 등 기존 transient 정책이 허용하는 같은 client retry와 client 전환은 분리한다.
- 두 client가 모두 실패해도 public API와 job response의 오류 계약은 변경하지 않는다. 일반 실패는 EXTRACTION_FAILED, 인증 확인 필요는 YOUTUBE_AUTH_REQUIRED를 유지한다. 새로운 공개 client fallback 오류 코드는 만들지 않는다.
- client별 시도 순서, client 이름, 구조화 reason, exit 정보와 redacted stderr tail은 server-only 진단에 남긴다. client 응답과 사용자 표시 메시지에는 raw stderr, local path, token, cookie, signed URL을 포함하지 않는다.
- 오디오 320과 비디오 1080은 기존 품질 계약대로 각각 최대 bitrate와 최대 height로 해석한다. 정확히 320kbps 또는 정확히 1080p가 존재하지 않더라도 요청 상한 이하의 유효한 artifact를 성공으로 인정한다.
- API direct media의 subprocess 결과는 non-empty artifact까지 확인해야 성공으로 인정한다. worker queued job은 추출 성공 외에도 upload, asset 저장, completed 전환, downloadUrl 생성이 모두 끝나야 성공으로 인정한다.
- 데이터베이스 schema, job 상태 이름, R2 object 보존 정책, Web 앱과 Chrome 확장 프로그램의 public error type은 변경하지 않는다.

## 테스트 결정

- 좋은 테스트는 client 선택 함수의 내부 구현이 아니라, 입력 URL·품질·실패 진단에 따라 어떤 외부 추출 시도가 실행되고 최종적으로 어떤 artifact 또는 오류 계약이 관찰되는지를 검증한다. subprocess와 YouTube 응답은 공통 media-downloader 경계에서 fake로 대체한다.
- 공통 정책 단위 테스트는 single-attempt runner와 client별 option factory를 주입받아 다음 외부 동작을 검증한다.
  - 기본 client 성공 시 한 번만 실행되고 web_embedded가 실행되지 않는다.
  - client 전환 대상 오류는 같은 client retry 없이 web_embedded로 전환된다.
  - 일반 transient 오류는 같은 client로 한 번 재시도하고 client fallback으로 전환하지 않는다.
  - embed-disabled, 인증, 네트워크, abort, spawn 실패는 web_embedded fallback을 실행하지 않는다.
  - fallback 성공은 최종 artifact 성공으로 끝나고, fallback 실패는 기존 오류 계약과 두 시도의 server-only 진단을 남긴다.
  - API direct와 worker가 공통 정책을 호출하며 각 표면이 자체 client 순서를 덮어쓰지 않는다.
- 기존 real integration 테스트 관례를 확장해 다음 네 가지 direct media 조합을 실제 yt-dlp로 실행한다.
  - known-good URL audio 320
  - known-good URL video 1080
  - 실패 URL audio 320
  - 실패 URL video 1080
  각 테스트는 요청 상한에 맞는 non-empty output artifact를 확인한다. 네트워크 단절이나 YouTube 인증 확인처럼 코드가 해결할 수 없는 기존 환경 reason은 기존 real integration 규칙에 따라 경고와 함께 skip할 수 있지만, client 정책·yt-dlp pin·format 선택·artifact 생성이 원인인 실패는 테스트 실패로 처리한다.
- 위 real integration은 현재 저장소의 pre-push 실행 경계를 따른다. 따라서 일반 테스트와 mock e2e를 통과한 뒤 실제 yt-dlp/YouTube 테스트가 실행되어 코드 원인 회귀를 push 전에 잡는다.
- queued worker 검증은 별도 운영 smoke로 수행한다. 두 URL 각각에 대해 audio 320과 video 1080 job을 생성하고, job이 completed가 되는지, type과 quality가 요청과 일치하는지, downloadUrl이 유효한지, 최종 파일 응답이 non-empty인지 확인한다.
- 운영 smoke에서는 API direct와 queued worker를 구분해 기록한다. direct 성공만으로 worker와 R2 전달 경로의 성공을 추정하지 않으며, worker 성공만으로 direct media adapter의 성공을 추정하지 않는다.
- 기존 worker retry 테스트, media-downloader diagnostic redaction 테스트, API public error mapping 테스트의 패턴을 prior art로 활용한다. 실제 URL 성공 테스트와 fake runner 정책 테스트를 한 테스트로 섞지 않는다.

## 완료 검증

2026-08-25 기준 구현과 운영 smoke의 완료 조건을 모두 충족했다. 하위 티켓 01~04가 완료되었고, 이전 production 실패는 배포 서버에 뒤처진 commit이 적용된 상태에서 발생했으며 재배포 후 동일 target에서 direct·queued 경로를 다시 통과했다.

하위 티켓 완료 상태:

- [x] [01: 공통 YouTube client 시도 정책과 진단 seam 마련](issues/01-shared-youtube-client-policy.md)
- [x] [02: API direct media에 기본 client 우선 fallback 연결](issues/02-api-direct-media-client-fallback.md)
- [x] [03: worker queued job에 공통 fallback 연결](issues/03-worker-queued-client-fallback.md)
- [x] [04: API direct·worker queued 운영 smoke 및 완료 증거](issues/04-operational-youtube-client-fallback-smoke.md)

자동·통합 검증:

- `pnpm run lint`, `pnpm run build`, `pnpm run test` 통과
- `pnpm --filter api run test:e2e:real` 1 suite/6 tests 통과
- API와 worker의 `yt-dlp 2026.08.19` 및 ffmpeg runtime 확인
- fake runner 정책 테스트, API direct real integration, worker extraction seam에서 기본 client 우선·제한적 `web_embedded` fallback·artifact non-empty 계약 확인

운영 smoke 검증:

- production `GET /health` HTTP 200 및 `worker.available=true` 확인
- API direct에서 두 URL의 audio 320/video 1080 네 조합 모두 HTTP 200, 기대 content type, attachment, non-empty 파일 응답 확인
  - `dQw4w9WgXcQ`: audio 3,750,165 bytes, video 33,829,665 bytes
  - `a0iBRRoDnDw`: audio 4,958,157 bytes, video 64,828,645 bytes
- worker queued에서 두 URL의 네 조합 모두 `queued` → `processing` → `completed`, 요청 `type`·`quality`, `downloadUrl`, 실제 non-empty 파일 응답 확인
- known-good URL은 cache를 삭제한 뒤 queued audio/video를 `cache_hit=no`로 재실행했고, DB asset과 R2 object 재생성 및 R2 `HeadObject`의 크기·content type을 확인
- signed URL, cookie, token, API key 등 민감하거나 만료 가능한 값은 기록하지 않음

## 범위 제외

- 오디오 128/192, 비디오 360/720을 포함한 전체 품질 행렬의 운영 성공 보장은 이번 스펙에 포함하지 않는다. 대표 검증은 오디오 320과 비디오 1080이다.
- mweb client, PO token provider, YouTube cookies, account authentication, Cobalt/Innertube 기반 extractor, YTDown 내부 구현 추적은 포함하지 않는다.
- 기본 client와 web_embedded 이외의 player client를 추가하거나 client를 무제한 순회하는 정책은 포함하지 않는다.
- EXTRACTION_FAILED와 YOUTUBE_AUTH_REQUIRED 외에 새로운 public error code, API response schema, Web 앱 표시 계약을 추가하지 않는다.
- Web 앱·Chrome 확장 프로그램의 UI, 요청 history, Popup, Overlay, 파일명 정책은 변경하지 않는다. 서버의 추출 정책만 다룬다.
- job queue, worker claim, R2 upload, asset retention, downloadUrl endpoint의 구조를 재설계하지 않는다.
- YouTube URL이 삭제되었거나 지역·연령·계정 제한으로 접근할 수 없는 임의의 모든 영상을 성공시키는 보장은 제공하지 않는다.
- YouTube 약관, 저작권, API 정책의 적합성 판단은 이 스펙의 범위가 아니다.
- 운영 smoke에서 확인할 수 없는 signed URL, cookie, token, API key를 문서나 로그에 기록하지 않는다.

## 추가 참고

- 현재 web_embedded 고정은 과거 android_vr 계열 403 회귀를 피하기 위한 결정이었다. 이번 변경은 그 동작을 무조건 삭제하는 것이 아니라 기본 client를 우선하고, 검증된 client 전환 오류에서만 web_embedded를 제한적으로 보조 경로로 사용하는 것이다.
- 상세한 실험 관찰과 YTDown 조사 결과는 [역사적 진단 기록](../../docs/research/2026-08-24-youtube-extraction-client-investigation.md)에 보존한다. 구현 계약과 작업 우선순위는 이 스펙과 ADR을 따른다.
- known-good URL과 실패 URL의 real integration 편입은 이번 회귀를 재현하고 기존 성공 경로를 보호하기 위한 것이다. YouTube 쪽 영상 상태가 바뀌면 테스트가 환경 요인이 아니라 실제 영상 상태 변화로 실패할 수 있으므로, 실패 reason과 마지막 진단을 함께 확인해야 한다.
- yt-dlp의 기본 client 구성과 YouTube의 format·SABR·PO token 정책은 변할 수 있다. pin 변경이나 새로운 client 추가가 필요해지면 이 ADR과 real integration 성공 행렬을 다시 검토한다.
- 구현 완료 선언에는 fake runner 단위 테스트, 기존 real integration, API direct 운영 검증, queued worker의 completed/downloadUrl/실제 파일 검증을 각각 별도 증거로 남긴다.
