# 07: 오류 상세에 평이한 요약 줄 추가

**What to build:** 오류 상세 disclosure(`오류 코드`/`응답 상태`/`응답 내용`을 보여주는 컴포넌트) 상단에 평이한 한 줄 요약을 추가해, 기술 블록이 펼쳐야만 보이는 선택적 심화 정보가 되게 한다. `/video`·`/subtitles` 둘 다 이 컴포넌트를 공유하므로 한 번에 적용된다.

**Blocked by:** None (can start immediately)

**Status:** done (2026-09-01)

- [x] 오류 상세 disclosure를 펼치기 전에도 평이한 한 줄 요약이 보인다.
- [x] 기술 블록(오류 코드/응답 상태/응답 내용)은 기존처럼 펼쳐야 보이는 상태로 유지된다.
- [x] `/video`와 `/subtitles`의 오류 화면 모두 이 요약 줄을 갖는다.
- [x] 요약 줄의 존재를 검증하는 마크업 단언 테스트가 추가된다.

## Comments

- `ErrorDetailsDisclosure`에 평이한 `summary` prop을 추가하고, 기술 상세 패널보다 먼저 렌더링하도록 연결했다. `/video`·`/subtitles`는 각 요청 유형에 맞는 요약을 표시하며, 기존 ErrorBoundary도 새 prop을 사용한다.
- 기술 상세 패널은 기존처럼 disclosure가 열린 경우에만 렌더링한다. 두 페이지의 `renderToStaticMarkup` 테스트에서 요약 노출·닫힌 상태·기술 내용 비노출을 검증한다.
- 검증: `pnpm --filter web run lint`, `pnpm --filter web run test` (88 tests), Standards/Spec 양축 코드 리뷰 통과. 두 페이지 테스트의 소규모 assertion 중복은 각 페이지의 실제 마크업을 독립적으로 검증하기 위해 유지했다.
