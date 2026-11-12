# 02: 프리팩터: job에 원본 주소·요청 영상 제목 보존

**What to build:** 확장 프로그램이 API job 응답의 원본 YouTube 주소와 요청 영상 제목을 버리지 않고 job 표현과 최근 요청 저장소에 보존한다. 원본 주소에서 영상 ID를 얻을 수 있게 한다. 화면은 아직 바뀌지 않는다. 최근 요청 썸네일(06)과 Overlay 카드 상태(09)가 이 데이터를 사용한다. API 계약은 바꾸지 않는다.

**Blocked by:** 01

**Status:** resolved

- [x] API client가 job 응답의 원본 주소와 요청 영상 제목을 job 표현에 담는 것을 단위 테스트로 확인한다(제목이 null인 경우 포함).
- [x] 최근 요청 저장소가 두 필드를 저장·복원하고, 두 필드가 없는 예전 저장 job도 오류 없이 읽힌다(필드는 비어 있는 값으로 복원)는 것을 단위 테스트로 확인한다.
- [x] job에서 영상 ID를 얻는 동작이 watch·Shorts·youtu.be 원본과 필드 없는 job에 대해 기대값을 돌려준다는 것을 단위 테스트로 확인한다.
- [x] 기존 Popup·background 동작이 바뀌지 않았음을 기존 단위·통합 테스트 전체 통과로 확인한다.
- [x] 확장 `lint`와 `test`가 통과한다.

## Comments

- 2026-11-12 구현 완료.
  - `DownloadJob`에 `sourceUrl`·`title`(`string | null`)을 더했다. client 매핑, 최근 요청 저장소(목록·legacy latest·구독), active job 저장소가 모두 도메인의 `restoreStoredDownloadJob`으로 빠진 필드를 null로 채운다.
  - 영상 ID는 `getDownloadJobVideoId(job)`(`src/domain/download-job/download-job.ts`)로 얻는다. 기존 URL 정규화의 ID 추출을 쓰는 `parseYoutubeVideoId`를 export했다.
  - 화면과 API는 바꾸지 않았다. popup 스모크의 가짜 job 응답에는 실제 API 계약처럼 두 필드를 더했다.
- 검증: 확장 `lint` 통과, `test` 27 files / 181 tests 통과, `test:browser`(popup·overlay·overlay-visibility 스모크) 통과.
  - 로그: `/tmp/mytube-02/test-browser-final.log`
  - 화면이 바뀌지 않는 티켓이고 스모크도 캡처를 만들지 않아서 남긴 캡처는 없다.
- 환경 주의(범위 밖 발견, 이번 티켓에서 고치지 않음):
  - `apps/chrome-extension/.env`가 있는 checkout에서는 `pnpm test:browser`의 popup 스모크가 download flow에서 실패한다(`ERR_CONNECTION_REFUSED`). 빌드는 `.env`의 API 주소를 쓰는데, 스모크는 `process.env`만 읽어 기본 운영 주소만 가로채기 때문이다. 변경 전 커밋에서도 `.env`가 없을 때만 통과한다.
  - 이번 검증은 `WXT_MEDIA_NEST_API_BASE_URL=https://mytube-extract-api.codeliners.cc pnpm test:browser`로 두 주소를 맞춰 실행했다. 10번 티켓의 전체 검증 때 같은 방식이 필요하다.

