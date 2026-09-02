# Web Route `/settings`

## Route

- path: `/settings`
- source: `apps/web/src/app/pages/settings/page.tsx`
- navigation: 모든 route의 상단 보조 `설정` 링크
- data source: browser `localStorage` 테마 선호
- surface: 외곽 card 없이 workspace에 정렬된 `화면 표시` preference group

## 사용자 흐름

1. 사용자는 `화면 표시` group에서 시스템·라이트·다크 중 하나를 선택한다.
2. 선택값은 기존 테마 선호 storage 계약에 따라 저장되고 즉시 document theme에 반영된다.
3. 다음 방문에는 저장된 선호를 복원하며 손상되거나 차단된 storage에서는 기존 기본값·현재 렌더링 fallback을 유지한다.

## 상태와 접근성

- 테마 선택은 하나의 native radio group으로 제공한다.
- `화면 표시` 설명과 세 radio label은 workspace의 flat 세로 흐름에 놓이며 실제 조작 영역은 가로·세로 44px 이상이다.
- 요청 접수 중에는 `설정` route 이동을 막고, 링크에 `aria-disabled`와 이동 잠금 사유를 제공한다.
- 설정은 영상·자막·요청 내역의 주요 navigation에 포함되지 않는 보조 영역이다.

## 범위

- 계정, 로그인, 사용자별 요청 소유권, API endpoint 설정은 제공하지 않는다.
