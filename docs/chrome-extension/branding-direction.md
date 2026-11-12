# Chrome 확장 프로그램 브랜딩 적용 규칙

공통 브랜드 결정은 [MyTube Extract 브랜드 가이드라인](../brand-guidelines.md)을 기준으로 한다. 이 문서는 Chrome 확장 popup과 툴바 아이콘에만 적용되는 규칙을 둔다.

## Popup

Popup은 글자를 최소화한 A안("무대")을 따른다. 화면 구조와 색·상태 규칙은 `docs/DESIGN.md`의 "Chrome popup·Overlay 최소 UI 계약"이 기준이다(2026-11-13 갱신).

1. 헤더: 로고 아이콘(접근 가능한 이름 `MyTube Extract`), 썸네일 버튼 상태 점을 단 격자 아이콘, 설정 아이콘
2. 무대: 현재 영상 16:9 썸네일 또는 붙여넣기 칸
3. 파일명을 겸하는 영상 제목 한 줄
4. 형식 아이콘 두 칸, 품질 막대 세 개
5. 빨간 추출 버튼(접근 가능한 이름 `추출 시작`)
6. 최근 요청 썸네일 줄

보조 설명·밈 카피는 첫 화면에 두지 않는다. 정책 안내는 Popup 설정 화면으로 옮겼다. 오류 상태만 밈 톤 없이 이유 한 줄로 설명한다.

## 아이콘

- 원본 자산은 `apps/chrome-extension/assets/icon-source.svg`다.
- Chrome 툴바의 작은 크기에서도 픽셀 추출기 실루엣이 읽혀야 한다.
- 출력 아이콘은 원본 SVG에서 생성하며, 별도의 유사 아이콘을 추가하지 않는다.
- YouTube 로고, 공식 재생 버튼, 공식 색 조합을 직접 연상시키는 형태를 사용하지 않는다.

## 적용 범위

- `apps/chrome-extension` popup UI의 제품명, 카피, 라벨, 버튼 문구
- `wxt.config.ts`의 extension name과 description
- popup HTML title
- Chrome extension icon asset
- popup CSS의 색상, 테두리, 버튼, 입력창 스타일

## 검증 기준

- popup 첫 화면에서 로고 아이콘과 무대가 먼저 읽히고, 추출 버튼이 유일한 빨간 행동으로 보인다.
- 정책 안내 문구는 Popup 설정 화면에서 확인할 수 있다.
- 영상 제목·품질 숫자·오류 한 줄의 가독성이 라이트·다크에서 유지된다.
- 툴바 아이콘이 작은 크기에서도 추출 도구로 인식된다.
- YouTube 공식 제품 또는 제휴 서비스처럼 보이지 않는다.
