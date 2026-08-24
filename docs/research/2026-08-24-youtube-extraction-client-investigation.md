# YouTube 추출 client fallback 진단 기록

작성일: 2026-08-24 (Asia/Seoul)

## 기록의 성격

이 문서는 2026-08-24에 수행한 YouTube 추출 실패 진단의 역사적 증거를 보존한다. 현재 구현 계약과 작업 우선순위는 [YouTube 추출 client fallback 스펙](../../.scratch/youtube-client-fallback/spec.md)과 [ADR 0002](../adr/0002-youtube-default-client-with-web-embedded-fallback.md)가 source of truth다. 이 문서는 구현 계약을 대신하지 않는다.

## 조사 목적

MyTube Extract에서 실패하는 YouTube URL이 다른 공개 downloader 서비스에서는 처리되는 차이를 확인하고, 실패 원인이 영상 자체인지, yt-dlp version/client 조합인지, 또는 API·worker의 고정 client 정책인지 분리한다.

비교 대상은 다음과 같다.

- 실패 URL의 canonical video ID: a0iBRRoDnDw
- known-good 비교 URL: dQw4w9WgXcQ
- 실패 URL의 원래 입력 형태: youtu.be 단축 URL에 query parameter가 포함된 형태

## 우리 서비스에서 확인한 사실

- 운영 API에서 실패 URL의 audio와 video 요청은 모두 EXTRACTION_FAILED로 종료됐다.
- 같은 운영 API에서 known-good 비교 URL은 성공했다. 따라서 API, ffmpeg, R2 전달 경로 전체가 일반적으로 고장 난 상태는 아니었다.
- 실패 영상의 YouTube watch page에는 streamingData가 있었고 공개 영상이었지만 playableInEmbed는 false였다.
- 실패 시 YouTube가 반환한 Playback on other websites has been disabled by the video owner 오류는 우리 서비스가 web_embedded client를 강제하는 현재 동작과 일치했다.
- 진단 당시 worker 이미지의 yt-dlp pin은 2026.07.04였고, worker와 API direct media 경로 모두 web_embedded player client를 명시적으로 사용했다.

## yt-dlp client와 version 실험

진단 당시 기록된 결과는 다음과 같다.

| version 또는 client | metadata/format | 실제 추출 | 관찰 |
| --- | --- | --- | --- |
| 2026.07.04 + web_embedded | 실패 | 실패 | 현재 pinned worker와 같은 client 경로가 실패 |
| 2026.08.19 + web_embedded | 실패 | 실패 | version만 올려도 web_embedded 고정 문제는 해결되지 않음 |
| mweb | format 노출 | audio 성공 | 결합된 360p format을 확인했지만 운영 fallback으로 채택하지 않음 |
| android_vr | format 노출 | download 403 | metadata 조회와 실제 media download 결과가 다름 |
| 최신 확인 version의 기본 client | 해당 audio 경로 성공 | audio 성공 | 실패 URL의 audio 추출 가능성을 확인 |
| pinned version의 기본 client | 해당 경로 403 | 실패 | extractor 및 HLS/SABR 처리 차이 가능성을 확인 |

이 실험만으로 모든 YouTube 영상의 최적 client 순서를 확정할 수는 없다. 다만 이 실패 URL에서는 web_embedded 고정이 가장 강한 직접 원인이었고, pinned version의 노후화가 별도 위험 요인으로 확인됐다.

## YTDown에서 확인한 사실

브라우저에서 YTDown 공개 페이지에 실패 URL을 제출하고, 실제 Start/download 버튼은 누르지 않은 채 화면과 공개 응답을 읽기 전용으로 확인했다.

- 제목과 재생시간, 1080p부터 144p까지의 MP4, M4A 48K/128K, MP3 128K 선택지가 표시됐다.
- 기본 1080p 항목은 약 122.85 MB로 표시됐다.
- DOM의 품질 선택값은 s28.worker03.com 호스트의 v5/video 및 v5/audio 형태 별도 worker endpoint를 가리켰다.
- 공개 endpoint를 읽기 전용으로 조회했을 때 MP3 128K는 status completed와 약 6.38 MB artifact를 반환했다.
- 같은 방식으로 1080p는 status completed와 약 122.98 MB artifact를 반환했다.
- 실제 signed file URL은 이 기록에 남기지 않는다.
- YTDown의 Start/download 동작은 실행하지 않았으므로 브라우저에서 최종 파일이 실제로 내려오는 단계까지 검증한 것은 아니다.
- 비브라우저 curl로 공개 JS/about 페이지를 확인하려 했을 때 Cloudflare challenge가 반환됐다. challenge를 우회하지 않았으므로 YTDown이 내부적으로 yt-dlp, Cobalt/Innertube, cache/session, cookie/PO token, HLS 중 무엇을 사용하는지는 확정하지 않았다.

확정 가능한 기술적 차이는 YTDown이 web_embedded 한 경로에 묶이지 않고, 서버 측 별도 worker에서 품질별 artifact를 준비하는 구조를 보였다는 점이다. 다른 서비스가 성공했다는 사실은 기술적 가능성의 증거이지 저작권·약관·서비스 정책의 근거는 아니다.

## 조사 당시 확인한 코드 경계

다음 경계가 당시 변경 후보와 테스트 계약으로 확인됐다.

- worker image의 yt-dlp version pin
- worker의 format 선택과 player client 옵션 생성
- API direct media adapter의 동일한 player client 옵션
- worker extraction subprocess의 기존 retry 정책
- worker 오류가 대부분 EXTRACTION_FAILED로 수렴하는 분류 경계
- web_embedded player client를 고정한 unit test
- worker와 API가 공유해야 하는 media-downloader runner와 diagnostic redaction 경계

## 조사 당시 작업 상태

- 진단 당시 코드와 설정은 변경하지 않았다.
- 임시 yt-dlp binary와 테스트 산출물은 정리했다.
- 운영 API 진단 job은 생성했지만 결과 파일을 최종 다운로드하지 않았다.
- signed URL, cookie, token, API key와 같은 민감하거나 만료 가능한 값은 기록하지 않았다.
- 이 문서의 당시 worktree 상태나 임시 job 상태는 현재 저장소 상태를 나타내지 않는다.

## 참고 링크

- [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases/)
- [yt-dlp README: player clients](https://github.com/yt-dlp/yt-dlp/blob/master/README.md)
- [yt-dlp PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide/388881c1a33a5a3a68d5097514f64ea6c3538d6c)
- [YTDown 공개 페이지](https://app.ytdown.to/en38/)
