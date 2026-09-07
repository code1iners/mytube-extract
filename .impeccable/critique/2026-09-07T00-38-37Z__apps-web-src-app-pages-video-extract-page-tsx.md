---
target: apps/web/src/app/pages/video-extract/page.tsx
total_score: 11
max_score: 16
na_heuristics: 2,3,5,7,9,10
p0_count: 0
p1_count: 0
timestamp: 2026-09-07T00-38-37Z
slug: apps-web-src-app-pages-video-extract-page-tsx
---
검토 방식: 독립 평가 2개 (A: /root/design · B: /root/evidence)

모바일 헤더 정렬과 URL 입력 포커스 표시 두 문제 모두 확인했다. 전체 앱이 아닌 요청한 두 영역만 평가했다. 제품 코드는 수정하지 않았다.

## 우선 문제

### [P2] URL 입력 포커스 경계 불일치
외곽 프레임은 링크 아이콘·input·지우기 버튼을 하나로 묶지만 포커스 outline은 내부 input에만 그려진다. global.css:813의 focus-within은 외곽 border-color만 바꾼다. global.css:822의 .field input outline:none과 :1093의 input:focus-visible은 선택자 우선순위가 같아 뒤의 2px outline이 적용된다. 첨부 화면의 이중 테두리를 설명한다.
개선: URL input 포커스는 전체 둥근 프레임의 파란 outline으로 통일하고 내부 중복 outline만 범위 한정해 제거한다. 지우기 버튼은 키보드 포커스를 따로 식별할 수 있게 유지하며, 오류 상태에서도 포커스가 보여야 한다. 권장 명령: $impeccable polish.

### [P3] 모바일 헤더 수직 중심 불일치
global.css:2077의 560px 이하 규칙이 align-items:center를 start로 덮어쓴다. 495×900 브라우저에서 로고 top10/height26/중심23, 더보기 top10/height44/중심32로 실제 9px 차이를 확인했다.
개선: 모바일도 부모 행을 center로 정렬하고 더보기의 44px 터치 영역을 유지한다. 개별 margin이나 transform 보정은 필요 없다. 권장 명령: $impeccable layout.

## 디자인 평가
기존 빨간 브랜드와 간결한 작업 화면은 목적에 맞는다. 더보기의 44px 조작 영역과 URL 라벨·프레임 그룹화는 유지할 장점이다. 두 국소 구현 불일치를 고치면 된다. 자동 검사 apps/web/src/app/components 결과는 0건이며 이번 정렬·스타일 우선순위 문제를 검출하지 못했다.

| 평가 항목 | 점수 | 근거 |
|---|---:|---|
| 상태 가시성 | 3/4 | 포커스 경계 중복 |
| 현실 세계와 일치 | n/a | 검토 범위 밖 |
| 사용자 제어 | n/a | 동작 전체 미검증 |
| 일관성과 표준 | 2/4 | 중심축과 경계 불일치 |
| 오류 예방 | n/a | 검토 범위 밖 |
| 인식 용이성 | 3/4 | 라벨은 명확함 |
| 효율성 | n/a | 검토 범위 밖 |
| 미학과 최소성 | 3/4 | 간결하나 정렬과 선 중복 존재 |
| 오류 복구 | n/a | 실제 오류 입력 미검증 |
| 도움말 | n/a | 더보기 내부는 범위 밖 |
| 합계 | 11/16 | 두 영역 한정, 개선 필요 |

인지 부하는 낮지만 입력 시 하나의 조작 영역이 둘로 나뉘어 보인다. 모바일 사용자는 터치 영역 유지, 키보드 사용자는 전체 프레임과 지우기 버튼의 포커스 구분이 중요하다. 추가 범위의 문제는 제기하지 않는다.

검증 경계: 헤더는 로컬 브라우저 재현. 입력은 로컬 서비스 상태 확인 실패로 숨겨져 첨부 화면과 현재 코드로 원인을 확인했으며 직접 포커스 재현은 하지 못했다. 후속 수정 시 모바일 경계 폭, 빈값/값 있음/오류, 키보드 지우기 이동을 확인해야 한다.

Questions skipped: 우선 문제 2건이며 요청 범위와 개선 방향이 명확함.
