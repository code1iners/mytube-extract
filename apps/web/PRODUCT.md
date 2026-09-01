# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

현재 유일한 사용자는 개발자 본인(운영 계정: `codeliner96@gmail.com`)이다. YouTube 영상·오디오를 내려받거나, 로컬에 있는 영상 파일에서 영어 SRT 자막을 뽑아야 하는 상황에서 이 웹앱을 연다. 여러 사용자를 대상으로 한 공개 서비스 전환은 아직 계획되지 않았고, 지금은 계정·로그인·사용자별 소유권을 의도적으로 도입하지 않은 1인 도구 단계다(`docs/adr/0001-keep-single-user-mode-until-public-service-transition.md`).

## Product Purpose

MyTube Extract Web은 브라우저에서 YouTube 영상 URL을 비디오(mp4)·오디오(mp3) 파일로 접수하거나, 로컬 영상 파일을 업로드해 영어 SRT 자막 생성을 접수하고, 같은 브라우저에서 그 요청들의 진행 상태를 확인해 완료 파일을 받을 수 있게 한다. 성공은 사용자가 원하는 형식·품질의 파일을 받을 때까지 각 요청의 상태(대기·처리중·완료·실패·만료)를 놓치지 않고 추적할 수 있는 것이다.

## Positioning

계정 가입이나 로그인 없이, 사용자 자신이 운영하는 API·worker 인프라 위에서 요청을 처리한다. 자막 생성은 외부 유료 transcription API를 호출하지 않고 로컬 `whisper.cpp`로 수행해 사용량에 따른 API 비용이 발생하지 않는다. 요청 이력은 서버 계정이 아니라 요청을 접수한 브라우저의 localStorage에만 남으며, 완료 파일은 R2에 7일만 보관한다. 이는 범용 온라인 YouTube 다운로드 사이트(광고, 계정, 서버 측 이력 관리를 동반하는)와 구분되는 자체 호스팅형 개인 도구라는 위치를 만든다.

## Operating Context

- Docker Compose로 자체 호스팅하는 NestJS API, FIFO worker, Cloudflare tunnel 뒤에서 동작한다. 웹앱은 이 API를 호출하는 Vite CSR 클라이언트다.
- 요청 흐름은 두 종류: `/video`에서 YouTube URL·형식(비디오/오디오)·품질을 선택해 `POST /downloads` job을 접수하거나, `/subtitles`에서 로컬 mp4/mov/webm을 업로드해 영어 SRT job을 접수한다.
- `/history`는 같은 브라우저가 접수한 요청을 최신순 최대 20건 조회하며, API 응답을 상태·진행률·다운로드 링크의 유일한 source of truth로 쓴다. 진행 중 job만 polling하고 terminal 상태(완료·실패·만료)는 polling을 멈춘다.
- 요청 접수 전 `GET /health`로 worker 가용성을 확인하고, 접수 중에는 상단 요청 내역 링크와 하단 영상·자막 탭의 route 이동을 막는다.
- 같은 제품의 자매 표면으로 Chrome 확장 프로그램(popup + YouTube 페이지 오버레이)이 있으며 같은 API 계약을 공유하지만 별도 앱(`apps/chrome-extension`)이고 이번 PRODUCT.md 범위 밖이다.

## Capabilities and Constraints

- 비디오 요청은 오디오(mp3, 128/192/320 kbps) 또는 비디오(mp4, 360/720/1080p) 중 하나를 고른다. 서버가 지원하는 고정 선택지 외 임의 값은 입력할 수 없다.
- 자막 요청은 mp4/mov/webm 로컬 파일을 R2 multipart로 업로드하고, Whisper 모델을 속도 우선(`base.en`) 또는 정확도 우선(`small.en`) 중에서 고른다. 영어 SRT만 제공하며 다른 언어는 없음.
- 완료 자산은 `ASSET_RETENTION_DAYS`(기본 7일) 후 만료된다. 만료·실패 요청은 같은 종류의 재요청 링크를 제공한다.
- 요청 이력에는 `kind`, UUID `jobId`, ISO `acceptedAt`만 localStorage에 저장한다. 원본 URL, 파일명, 상태, 진행률, 오류, 다운로드 URL은 저장하지 않는다. 같은 브라우저 profile에만 남고 기기 간 동기화는 없다.
- 검색, 필터, 페이지네이션, 전체 삭제, 작업 취소는 현재 없다. polling 간격은 2500ms 고정이며 세부 진행률은 API가 제공하는 상태 기반 값만 표시한다.
- 계정, 인증, 사용자별 서버 목록 API는 없다(공개 서비스 전환 전까지 의도적 미도입, ADR-0001).

## Brand Commitments

- 제품명은 "MyTube Extract"로 고정이며, 헤더 워드마크 자간·최소 크기 규칙은 아직 미확정(`docs/DESIGN.md` 열린 결정 참조).
- 서비스 로고 아이콘은 Nintendo red(`#e60012`) 배경 rounded square 위 흰색 추출(다운로드 화살표) 글리프로 확정되어 있다(`apps/web/public/mytube-extract-icon.svg`). YouTube 로고와 혼동되지 않도록 재생 삼각형 대신 추출 화살표 모양을 의도적으로 사용했다.
- 시각적 정체성(Nintendo Design System 기반 minimal flat, Pretendard Variable, 단일 액션색)은 `docs/DESIGN.md`가 소유하며 이 PRODUCT.md는 시각 결정을 다루지 않는다.

## Evidence on Hand

- `docs/web/current-implementation-prd.md`, `docs/web/current-implementation-fsd.md`: 현재 웹 구현의 제품·기능 계약.
- `docs/adr/0001-keep-single-user-mode-until-public-service-transition.md`: 1인 사용 단계 유지 결정과 재검토 조건.
- `docs/chrome-extension/current-implementation-prd.md`: 같은 API를 공유하는 자매 표면(Chrome 확장)의 제품 범위, 이번 PRODUCT.md는 참고만 하고 소유하지 않는다.
- 실제 사용자 테스트, 고객 인터뷰, 사용량 지표, 스크린샷 외 마케팅 자산은 없음. 앞으로의 작업에서 가상의 사용자 후기·벤치마크·가격 정책을 만들지 않는다.
- `apps/web/src/assets/illustrations/{light,dark}`는 준비만 되어 있고 실제 일러스트 자산은 아직 없다.

## Product Principles

1. 요청 폼과 처리·결과 상태를 분리해서 보여준다 — 사용자가 새 요청을 만드는 중에도 과거 요청의 실제 상태를 잃지 않는다.
2. API 응답을 상태의 유일한 근거로 삼는다 — 클라이언트가 낙관적으로 완료·진행률을 추정하지 않는다.
3. 계정 없는 개인 도구라는 전제를 지운다 — 브라우저 로컬 이력, 서버 비저장 소유권 모델을 임의로 서버 계정 개념으로 되돌리지 않는다.
4. 고정된 서버 지원 선택지만 노출한다 — 오디오 비트레이트·비디오 해상도·Whisper 모델처럼 서버가 실제로 처리 가능한 값만 사용자에게 보여준다.
5. 실패·만료를 막다른 길로 두지 않는다 — 같은 종류의 재요청 경로를 항상 함께 제공한다.

## Accessibility & Inclusion

제품 차원의 별도 접근성 요구사항은 아직 확정되지 않았다. `docs/DESIGN.md`가 WCAG 2.2 AA 대비 기준과 키보드 포커스 규칙을 시각 시스템 차원에서 이미 약속하고 있으며, 이 PRODUCT.md는 그 약속을 반복하지 않고 DESIGN.md를 근거로 남겨둔다.
