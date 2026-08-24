---
status: accepted
date: 2026-08-24
---

# YouTube 기본 client 우선과 제한적 web_embedded fallback

현재 MyTube Extract는 과거 403 회귀를 피하기 위해 web_embedded client를 고정하지만, embed가 비활성화된 공개 영상에서는 이 선택 자체가 추출 실패를 만든다. API direct media와 worker queued job은 yt-dlp 2026.08.19의 기본 client를 먼저 사용하고, client 전환이 의미 있는 오류에서만 web_embedded를 한 번 fallback으로 사용한다. embed-disabled 오류에는 fallback하지 않으며, 두 실행 표면은 공통 media-downloader 정책을 공유해 기존 성공 URL과 실패 URL의 동작을 일관되게 유지한다.

## 고려한 선택지

- web_embedded를 계속 첫 시도로 유지하고 기본 client를 fallback으로 둔다.
- 기본 client만 사용하고 fallback을 제거한다.
- 기본 client를 첫 시도로 사용하고 web_embedded를 제한적 fallback으로 둔다.

세 번째 선택지는 일반 영상에 대한 기본 추출 경로를 우선하면서도 기존 web_embedded가 해결하던 client별 회귀 가능성을 보존한다. 무차별 fallback은 요청량과 처리 시간을 늘리고 인증·네트워크·embed 제한 오류를 숨길 수 있으므로 허용 목록과 시도 예산을 둔다. mweb과 PO token은 별도 운영 경계가 필요하므로 이 결정에 포함하지 않는다.

## 결과

- API와 worker가 같은 client 순서와 오류 분류를 사용한다.
- yt-dlp pin은 API와 worker에서 동일한 2026.08.19로 관리한다.
- 기본 client 성공 시 추가 요청이 없고, client 전환 대상 오류에서만 web_embedded가 한 번 실행된다.
- 기존 public error contract는 유지되지만 server-only 진단에는 client별 시도 결과가 추가된다.
- YouTube client 구성 변화나 새로운 PO token 요구가 발생하면 이 ADR과 real integration 성공 행렬을 함께 재검토해야 한다.
