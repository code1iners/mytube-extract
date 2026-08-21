# YouTube Data API 공개 영상 검색 비용·제약 조사

- 조사일: 2026-08-20
- 대상: Web `/search`에서 서버가 YouTube Data API v3 `search.list`를 호출하는 방식
- 출처 기준: YouTube·Google 공식 문서만 사용

## 결론

개인용 저사용량 MVP는 **별도 YouTube API 호출 요금 없이 시작할 수 있는 구조로 보인다**. 다만 공식 문서가 이를 무제한 무료 요금제로 표현하지 않고 quota로 관리하므로, 정확한 의미는 “기본 quota 안에서 금전 과금 없이 사용할 수 있을 가능성이 높다”이다. Google Cloud 프로젝트·API 키·서버 운영 비용은 별도이며, billing 계정 요구 여부는 YouTube 공식 시작 문서에서 명시적으로 확인되지 않았다.

현재 단계의 결정은 **검증 후 진행**이다. API 키를 서버 환경변수로 설정한 뒤 실제 Google Cloud 프로젝트에서 한 번 호출하고, API Console의 quota와 billing 화면을 확인해야 금전 경계를 완료 판정할 수 있다.

## 확인된 비용·quota

### `search.list`는 별도 검색 quota bucket을 사용한다

공식 quota 표에 따르면 `search.list`는 하루 100회 한도를 가진 별도 bucket이며, 호출 1회당 1 quota를 사용한다. 검색 결과의 다음 페이지를 `pageToken`으로 가져오면 페이지 요청마다 quota가 추가로 사용된다.

- [Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
- [Search: list](https://developers.google.com/youtube/v3/docs/search/list)

따라서 현재 1인 사용 기준으로는 검색어 제출 1회당 API 요청 1회를 보내고 페이지네이션을 제한하는 MVP가 quota를 예측하기 쉽다. 입력 중 매 키 입력마다 요청하거나 자동 무한 스크롤을 넣으면 100회 한도를 빠르게 소진할 수 있다.

### 일반 quota와 추가 quota

YouTube Data API 프로젝트에는 `search.list` 100회/일 외에 다른 endpoint용 기본 quota가 별도로 표시된다. 한도에 도달하면 추가 quota를 요청할 수 있지만, 공식 문서상 quota extension request와 compliance audit 절차가 필요하다. 추가 quota가 자동으로 유료 구매되는 가격표로 설명되지는 않는다.

- [YouTube Data API Overview](https://developers.google.com/youtube/v3/getting-started)
- [Quota and Compliance Audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)
- [Audit and Quota Extension Form](https://support.google.com/youtube/contact/yt_api_form?hl=en)

## 인증·프로젝트 준비

공개 영상 검색처럼 사용자 비공개 데이터가 필요하지 않은 요청은 서버의 API key 방식으로 시작할 수 있다. OAuth 2.0은 사용자의 비공개 YouTube 데이터나 사용자 계정에 대한 작업이 필요할 때 적용한다. API key는 브라우저에 노출하지 않고 현재 API 서버의 secret 환경변수로만 보관해야 한다.

- [Obtaining authorization credentials](https://developers.google.com/youtube/registering_an_application)
- [Implementing OAuth 2.0 Authorization](https://developers.google.com/youtube/v3/guides/authentication)
- [YouTube Data API Overview](https://developers.google.com/youtube/v3/getting-started)

공식 YouTube 시작 문서는 Google Account, Google Developers Console 프로젝트, API 활성화, credential 생성을 요구하지만 billing account를 필수 조건으로 명시하지 않는다. 따라서 “billing 계정이 반드시 필요 없다”고 확정하지 않고, 실제 프로젝트 생성·API 활성화 단계에서 현재 Console 정책을 확인해야 한다.

## 검색 결과 계약에 미치는 영향

`search.list`는 기본적으로 영상·채널·재생목록을 모두 반환할 수 있으므로, 이번 요구에는 `type=video`를 명시해야 한다. 한 번에 받을 수 있는 `maxResults`는 최대 50개이고, 다음 결과는 `nextPageToken`을 이용한다.

- [Search: list request parameters](https://developers.google.com/youtube/v3/docs/search/list)

검색 결과는 YouTube API의 원본 제목·썸네일·정보를 임의로 수정하거나 다른 출처의 결과와 섞어 YouTube 결과처럼 표시하면 안 된다. 결과 화면에는 YouTube가 출처임을 알 수 있는 표시와 링크/브랜드 규칙을 반영해야 한다.

- [Complying with YouTube's Developer Policies](https://developers.google.com/youtube/terms/developer-policies-guide)
- [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies)

비인증 API 데이터는 필요한 목적에 한해 임시 저장할 수 있지만, 공식 정책에는 데이터 종류별 30일 refresh/deletion 제한과 최신 데이터 표시 의무가 있다. 따라서 MVP는 검색 결과를 서버 DB에 장기 저장하지 않고, 요청 시 API 결과를 전달하며 필요한 캐시는 정책 검토 뒤 별도로 결정하는 편이 안전하다.

## Proposal red-team

### 기본 quota가 개인용 검색량을 감당한다

- 판정: 감수 가능하지만 먼저 검증
- 실패 경로: 검색 입력마다 요청하거나 페이지를 자동으로 계속 요청함 → 하루 100회 검색 quota 소진 → 이후 검색이 실패함
- 근거: `search.list`의 별도 100회/일 bucket과 페이지별 quota 차감
- 가장 싼 검증: 입력 중 요청하지 않고 제출 시 1회만 호출하는 fixture를 만든 뒤, API key로 단일 검색과 한 번의 다음 페이지 요청을 실행하고 Console quota를 확인
- 통과 기준: 1인 사용 시 예상 일일 검색 횟수와 페이지 수가 100회보다 충분히 낮고, quota 초과 상태를 Web 오류로 표시할 수 있음

### 검색 API가 무료이면 서비스 전체도 무료다

- 판정: 근거 부족
- 실패 경로: YouTube API quota만 무료로 확인하고 API 서버·네트워크·worker 비용을 계산하지 않음 → 검색 기능 추가 후 운영 비용을 잘못 예측함
- 근거: YouTube 공식 문서는 quota와 credential을 설명하지만, 이 조사에서 YouTube Data API의 별도 종량제 가격표나 billing account 필수 여부를 확인하지 못함
- 가장 싼 검증: 실제 Google Cloud 프로젝트에서 API 활성화와 API key 생성 후 billing 화면, quota 화면, 테스트 호출 결과를 함께 확인
- 통과 기준: API 호출 자체의 금전 청구 여부와 MyTube API 서버 운영 비용을 분리해 기록함

### 공식 검색 API를 사용하면 기존 추출 기능도 자동으로 정책 승인된다

- 판정: 치명적 위험 가능성 — 구현 전 정책 검토 필요
- 실패 경로: 공식 API 검색 결과를 앱의 오디오·비디오 추출 행동으로 바로 연결함 → API 정책의 YouTube audiovisual content 다운로드·저작권 침해 조장 금지와 충돌할 가능성 → quota 축소, API key 철회, 서비스 중단 위험
- 근거: Developer Policies는 API를 사용해 YouTube audiovisual content를 다운로드·저장하도록 허용하지 않으며, API Client가 YouTube 검색 결과를 수정하거나 출처를 흐리게 표시하는 것도 제한한다. 기존 MyTube Extract는 검색과 별도로 `yt-dlp` 기반 추출을 제공한다.
- 가장 싼 검증: 검색 기능과 추출 기능을 분리한 화면/계약을 먼저 만들고, 실제 결과 카드의 표시·YouTube 링크·추출 CTA가 정책에 맞는지 공식 정책 및 필요 시 YouTube compliance 문의로 확인
- 중단 기준: 검색 결과를 추출 기능으로 연결하는 현재 제품 목적이 API 정책상 허용되는지 설명할 수 없거나, YouTube의 사전 승인 없이는 진행할 수 있다는 답을 받음

## 권고

현재 1인용 MVP에서는 **공식 API를 서버에서 호출하는 방향 자체는 비용상 검토 가능**하다. 단, 다음 순서가 필요하다.

1. Google Cloud 프로젝트와 YouTube Data API v3를 만들고 API key를 발급한다.
2. 서버에서 `type=video`, `maxResults` 제한, 제출 시 1회 호출로 단일 smoke request를 보낸다.
3. API Console에서 search quota와 billing 화면을 확인한다.
4. 검색 결과의 YouTube 출처 표시·원본 데이터 보존·캐시 기간을 정책에 맞춰 설계한다.
5. 검색 결과에서 기존 추출 기능으로 이어지는 흐름은 정책 검토가 끝난 뒤 구현 승인한다.

이 조사만으로는 API key 발급, 실제 billing 상태, quota extension 승인, 검색 결과를 다운로드로 연결하는 정책 적합성을 완료 처리하지 않는다.

## 공개 서비스 가능성 보강 검토

### 현재 검색→추출 결합 흐름

- 판정: **현재 방식은 공개 배포 승인 전 중단**
- 근거: YouTube Developer Policies는 API Client가 YouTube 영상의 offline download를 제공하거나 영상에서 오디오 트랙을 분리하도록 허용하지 않는다. 정책 예시에는 API를 사용해 영상에서 등장한 오디오의 MP3 파일을 제공하는 서비스가 포함되어 있다.
- 현재 제품과의 관계: MyTube Extract의 계획은 YouTube 검색 결과를 선택한 뒤 기존 MP3/MP4 추출 흐름으로 연결하는 것이므로, 단순히 검색 결과를 보여주는 API Client보다 이 제한과 직접적으로 충돌할 위험이 높다.
- 출처: [Complying with YouTube's Developer Policies](https://developers.google.com/youtube/terms/developer-policies-guide), [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies)

따라서 quota가 무료이고 API key를 발급받을 수 있다는 사실은 현재 제품을 공개할 수 있다는 근거가 아니다. YouTube 정책 위반 시 quota 축소, API key 철회, Google 계정 또는 API Client 종료가 가능하다고 공식 문서가 설명한다.

### 검색만 제공하는 경우

검색 결과를 YouTube 콘텐츠로 명확히 표시하고, 결과를 임의로 수정·혼합하지 않으며, YouTube ToS·Google Privacy Policy·서비스 개인정보 처리방침을 연결하는 별도 검색 서비스는 정책 검토 대상이지만 현재 추출 결합 흐름보다는 위험이 낮다. 그래도 공개 전 Developer Policies와 API Terms를 기준으로 최종 검토해야 한다.

### 한국 저작권법의 경계

한국 저작권법 제30조는 공표된 저작물을 영리 목적 없이 개인적으로 이용하거나 가정 및 이에 준하는 한정된 범위에서 이용하는 경우의 복제를 규정한다. 이 조문만으로 여러 사용자에게 다운로드 기능을 제공하는 공개 서비스가 허용된다고 볼 수는 없다. 이는 법률 자문이 아닌 조문 범위에 대한 보수적 판단이며, 공개 운영 전 한국 저작권 변호사 또는 저작권 전문 자문을 받아야 한다.

- [국가법령정보센터 저작권법 제30조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1025202705)
- [YouTube Terms of Service](https://www.youtube.com/t/terms)

### 제품 결정 제안

현재 목표를 그대로 공개하려면 `검증 후 진행`이 아니라 **`수정 후 진행`**으로 바꿔야 한다.

1. 공개 Web 검색은 검색·YouTube 링크·정책상 허용되는 메타데이터 표시까지만 제공하고, 검색 결과에서 추출 CTA를 제거한다.
2. 기존 추출 기능은 별도 개인용 범위로 유지하되 공개 서비스와 정책적으로 결합하지 않는다. 이것도 법적 안전을 보장하는 것은 아니다.
3. 검색 결과에서 MP3/MP4 추출을 공개적으로 제공하려면 YouTube의 사전 서면 승인과 법률 검토를 먼저 확보한다.

서면 승인이나 법률 검토 없이 현재의 `YouTube 검색 → MP3/MP4 추출` 흐름을 공개 배포하는 것은 권고하지 않는다.

## 개인용 비공개 운영 검토

### 범위 가정

여기서 개인용은 다음 조건을 모두 만족하는 경우로 한정한다.

- 본인 한 명만 사용하고 다른 사용자에게 계정·접근 권한을 제공하지 않는다.
- 공개 URL, 광고, 결제, 배포, 다운로드 파일 공유를 제공하지 않는다.
- API key와 추출 서버는 본인 소유의 비공개 환경에서 운영한다.
- 가능한 경우 본인이 소유하거나 이용 허락을 받은 영상만 처리한다.

### 판정

**개인용 POC는 기술적으로 진행 가능하지만, YouTube 정책상 승인된 사용 사례라고 확정할 수는 없다.**

혼자만 사용한다는 조건은 공개 서비스보다 노출·피해 범위와 운영 부담을 낮춘다. 또한 한국 저작권법 제30조의 개인적·비영리적 이용 범위에 가까워질 수 있다. 그러나 이 조항은 콘텐츠의 권리 상태와 이용 방식에 따라 판단해야 하는 제한적인 예외이고, YouTube Developer Policies나 YouTube Terms에 개인용 추출 도구에 대한 일반 면제를 부여하는 조항은 확인하지 못했다. 따라서 “나 혼자 쓰면 정책·법적으로 안전하다”가 아니라 “위험을 제한한 비공개 검증 단계로는 진행할 수 있다”가 정확한 결론이다.

특히 공식 API 검색 결과를 기존 `yt-dlp` 기반 MP3/MP4 추출로 연결하는 부분은 개인용이어도 정책 적합성이 해소되지 않는다. Developer Policies의 offline download·audio separation 금지와 직접 맞닿아 있기 때문이다. 본인 소유 또는 별도 이용 허락이 있는 영상이라면 저작권 위험은 낮아질 수 있지만, API 정책과 YouTube 약관에 대한 별도 판단까지 대신하지는 않는다.

### 개인용으로 진행할 때의 중단 조건

다음 조건을 지키는 **비공개 POC**까지만 `검증 후 진행`으로 본다.

1. 검색 API는 서버에서만 호출하고 API key를 브라우저에 노출하지 않는다.
2. 서비스에 회원가입·공개 공유·광고·결제를 넣지 않는다.
3. 검색 결과를 장기 보관하거나 YouTube 콘텐츠 사본을 서비스 저장소에 축적하지 않는다.
4. 본인 소유·이용 허락 콘텐츠 중심으로 테스트하고, 권리 확인이 안 된 콘텐츠의 대량 추출은 하지 않는다.
5. 정책 확인 전에는 공개 URL이나 다른 사람에게 제공할 수 있는 형태로 전환하지 않는다.

다음 중 하나라도 필요해지면 개인용 POC의 범위를 벗어나므로 중단하고 재검토한다.

- 다른 사람이 사용할 수 있는 초대·계정·공유 링크
- 광고·결제·서비스 공개
- YouTube 검색과 MP3/MP4 추출을 제3자에게 제공
- 대량 자동화, 장기 보관, 콘텐츠 라이브러리화

따라서 현재 단계의 결정은 **“개인용 비공개 POC로는 진행 가능, 공개 서비스로 전환할 때는 검색 전용 또는 사전 서면 승인·법률 검토가 필요”**로 기록한다. 이는 법률 자문이나 YouTube의 사전 승인을 의미하지 않는다.

## 검색 기능을 제외한 공개 전환 검토

### 현재 공개 대상의 실제 범위

검색 기능을 구현하지 않더라도 현재 제품은 사용자가 입력한 YouTube URL 또는 영상 ID를 받아 다음 추출 기능을 제공한다.

- Web의 `/downloads` job 흐름
- 호환용 `/audio` MP3 추출
- 호환용 `/video` MP4 추출
- Chrome Extension의 URL·YouTube 카드 기반 추출

현재 구현 문서상 인증은 제공하지 않고, YouTube-only source policy 강제와 reverse proxy rate limit도 공개 운영 정책 확정 뒤의 보류 범위다. 따라서 공개 URL에 배포하면 실제로는 여러 사용자가 바로 추출 요청을 보낼 수 있는 구조다.

### 판정

**검색 기능을 빼는 것만으로 현재 서비스를 공개해도 법적으로 괜찮다고 판단할 수 없다.**

검색 API 사용, 검색 결과 표시, 검색 결과를 추출로 연결하는 위험은 없어지지만, YouTube URL에서 영상·오디오를 자동으로 내려받아 사용자에게 제공하는 핵심 기능은 남는다. YouTube 약관은 개인적·비상업적 시청·청취를 허용하면서도 콘텐츠의 다운로드·복제·배포 등을 서비스가 명시적으로 허용하거나 YouTube 및 권리자의 사전 서면 허가가 있는 경우 외에는 제한한다. 이 약관 기준은 검색 기능 유무와 별개다.

또한 저작권법 제30조의 사적 이용을 위한 복제는 개인적·비영리적·가정 등 한정된 범위를 전제로 한다. 공개된 웹 서비스 운영자가 불특정 사용자에게 변환·다운로드 기능을 제공하는 상황을 사용자의 사적 이용 예외만으로 정당화할 수 있다고 보기는 어렵다. 저작권법은 저작자에게 복제권·공중송신권·배포권을 부여하므로, 공개 서비스는 콘텐츠별 권리 허락이나 별도 법률 검토가 필요하다. 이는 법률 자문이 아닌 보수적 제품 판정이다.

YouTube Data API를 사용하지 않는 직접 URL 추출 경로에는 Developer Policies의 API Client 규정이 그대로 적용된다고 단정할 수는 없다. 그러나 YouTube Terms의 자동화·다운로드 제한과 저작권 문제는 여전히 남는다. 반대로 검색 기능을 YouTube Data API로 추가하면 API 정책의 오디오 분리·오프라인 다운로드 금지까지 별도로 검토해야 한다.

### 제품 공개 판정

- **불특정 다수에게 현재 Web/API를 그대로 공개:** 진행 중단
- **초대된 소수에게 접근 제한한 비공개 베타:** 권리 확인 콘텐츠에 한해 제한적으로 검증 가능하나 법적 안전 확정 아님
- **본인 소유·이용 허락 콘텐츠만 처리하는 폐쇄형 도구:** 상대적으로 위험이 낮으며 개인용 POC 범위와 일관됨
- **YouTube 검색·재생·링크만 제공하고 추출하지 않는 서비스:** 현재 추출 서비스보다 공개 검토가 쉬운 대안

공개 전환을 하려면 최소한 인증 또는 초대 접근, rate limit·quota·abuse 방어, 허용 source 정책, 신고·삭제 대응, 로그·보존 정책을 설계해야 한다. 그러나 이 운영 장치를 갖추는 것만으로 YouTube 약관이나 저작권 허락이 확보되는 것은 아니다. 현재 제품을 그대로 공개하기보다, 먼저 공개 범위를 검색·링크·재생 중심으로 재정의하거나 콘텐츠 권리 허락을 확보한 별도 서비스로 축소하는 것이 안전하다.

## 기존 추출 서비스가 유지되는 이유에 대한 해석

이미 운영 중인 서비스가 있다는 사실만으로 해당 서비스가 YouTube 약관과 저작권법을 준수한다는 뜻은 아니다. 외부에서 확인할 수 없는 실제 운영 모델은 서로 다를 수 있다.

1. 권리자 또는 콘텐츠 제작자와 별도 라이선스를 확보했을 수 있다.
2. 퍼블릭 도메인, 이용 허락 콘텐츠, 자체 보유 콘텐츠처럼 권리 범위를 제한했을 수 있다.
3. 다운로드 기능이 아니라 사용자가 소유한 파일의 변환만 제공할 수 있다.
4. 약관·저작권 리스크를 감수하면서 아직 신고·차단·소송이 발생하지 않은 상태일 수 있다.
5. 관할, 법인 구조, 서비스 노출도, 신고 대응 방식이 우리와 다를 수 있다.

마지막 두 경우는 서비스가 “합법적으로 승인되었다”는 근거가 아니다. YouTube 약관은 다운로드·자동화 접근을 제한하고, 한국 법원도 이용자의 침해를 예상하거나 용이하게 하는 서비스 제공자의 방조책임이 문제될 수 있다고 판단한 사례가 있다. 따라서 다른 서비스가 계속 운영된다는 이유로 같은 구조를 공개해도 된다고 추론하면 안 된다.

우리 서비스가 선택할 수 있는 보수적인 공개 모델은 `YouTube 검색·링크·재생만 제공`, `권리 확인이 끝난 콘텐츠만 변환`, 또는 `개인용 비공개 도구 유지`다. 공개 추출 서비스를 목표로 한다면 권리 허락과 법률 검토를 먼저 확보해야 하며, 차단을 피하거나 약관 집행을 우회하는 운영 방식은 합법성 검토를 대신할 수 없다.

- [YouTube Terms of Service](https://www.youtube.com/t/terms)
- [국가법령정보센터 저작권침해금지등가처분 판례](https://law.go.kr/LSW/precInfoP.do?precSeq=125187)
