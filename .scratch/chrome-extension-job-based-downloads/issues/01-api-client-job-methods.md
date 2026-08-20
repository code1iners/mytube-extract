# 01: MyTube Extract API client에 job 생성/조회 메서드 추가

**What to build:** MyTube Extract API client가 서버의 job 기반 다운로드 API(작업 생성, 상태 조회)를 호출할 수 있게 한다. 사용자에게 보이는 화면 변화는 없다 — 이후 티켓들이 이 위에서 실제 요청 흐름을 만든다.

**Blocked by:** None (can start immediately)

**Status:** done (구현 9c8e9fe, 리뷰 반영 d838c49)

- [x] client가 다운로드 형식·원본 URL·화질을 받아 job을 생성하는 요청을 보낼 수 있다.
- [x] client가 job id로 현재 상태(대기/처리 중/완료/실패, 완료 시 파일 다운로드 URL)를 조회할 수 있다.
- [x] 서버가 오류(잘못된 입력, 존재하지 않는 job 등)를 반환하면 호출자가 구분 가능한 오류로 전달된다.
- [x] 실제 네트워크 호출 없이 가짜 fetch로 요청/응답 매핑이 검증된다.
