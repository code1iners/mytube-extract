# 04: 이전 interface contract와 통합 검증

**What to build:** 영상·자막 vertical slice가 모두 완료된 뒤 이전 shallow hook과 중복 테스트를 제거한다. 사용자는 같은 요청 동작을 유지하고, 유지보수자는 route에 생명주기 ordering이 남지 않은 하나의 deep interface만 사용한다.

**Blocked by:** 03: 자막 추출 생명주기 vertical slice

**Status:** ready-for-agent

- [ ] 이전 request-attempt public interface가 제거되고 begin·accept/ignore·finish ordering이 route에 남지 않는다.
- [ ] 이전 active-job-status public interface가 제거되고 raw query 조합이 route에 남지 않는다.
- [ ] 이전 worker-readiness public interface가 제거되고 readiness 조합이 route에 남지 않는다.
- [ ] 내부 helper는 private implementation으로만 존재하며 facade 또는 중복 seam을 만들지 않는다.
- [ ] 새 lifecycle interface 테스트가 포괄하는 shallow helper 테스트와 넓은 hook mock이 제거되거나 phase별 최소 fixture로 축소된다.
- [ ] deletion test에서 이전 module을 삭제해도 취소 경쟁, 접수증, polling, 오류 우선순위가 두 route로 되돌아오지 않는다.
- [ ] 영상·자막의 사용자 문구, navigation, 입력 보존, 요청 내역, 접수증 schema, polling 간격, focus 계약에 회귀가 없다.
- [ ] 개인 사용 단계, 브라우저 중심 요청 내역, 서버 작업 취소 미지원 계약을 유지한다.
- [ ] Web lint가 마지막 변경 이후 통과한다.
- [ ] Web unit test가 마지막 변경 이후 통과한다.
- [ ] Web production build가 마지막 변경 이후 통과한다.
- [ ] Web browser smoke가 마지막 변경 이후 통과한다.
- [ ] 로컬 fixture와 Chromium 증거를 production server·provider·실제 R2·물리 브라우저·화면 낭독기 증거로 과장하지 않는다.

## Comments
