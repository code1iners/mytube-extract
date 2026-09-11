# `POST /downloads`

- method/path: `POST /downloads`
- source file: `apps/api/src/downloads/downloads.controller.ts`
- request body:

| field | required | value |
| --- | --- | --- |
| `type` | yes | `audio` or `video` |
| `url` | yes | YouTube watch, Shorts, or `youtu.be` URL |
| `title` | no | 처음 확보한 원본 영상 제목. `null`, 빈 문자열, 공백뿐인 값은 미확보로 처리한다. |
| `quality` | no | audio `128`/`192`/`320`, video `360`/`720`/`1080`; missing or legacy `default` becomes audio `320`, video `1080` |

- success response:

```json
{
  "jobId": "uuid",
  "status": "queued",
  "displayStatus": "queued",
  "progress": 0,
  "type": "audio",
  "quality": "192",
  "createdAt": "2026-06-24T05:32:00.000Z",
  "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "원본 영상 제목",
  "retentionDays": 7,
  "downloadUrl": null,
  "errorCode": null,
  "message": "요청이 접수되어 대기 중입니다."
}
```

- error response: invalid `type`, `url`, or `quality` returns `400`.
- 접근 조건: 인증 없음. API CORS allowlist 적용.
- side effect: 입력 URL에서 검증한 `videoId`로 query-free canonical YouTube watch URL을 만들어 `ExtractionJob`에 저장한다. 요청 `title`은 trim 후 유효한 값만 저장하며, 같은 `videoId`/`type`/`quality`의 유효한 R2 asset이 있으면 asset 제목을 제목 없는 새 job에 복사해 즉시 `completed`로 만든다. 이미 제목이 있는 요청은 asset 제목으로 덮어쓰지 않는다.
- 제목은 요청 내역 식별용으로 `ExtractionJob.title`에만 보존한다. 결과물 제목과 다운로드 파일명은 기존 `ExtractedAsset.title` 계약을 계속 사용하며, 결과물 만료·정리로 asset row가 사라져도 `ExtractionJob` row가 존재하는 동안 요청 제목은 삭제하지 않는다.
- 구 버전 결과물에만 남은 제목은 `pnpm --filter api run backfill:request-titles` dry-run과 명시적 `--apply`로 조건부 이관한다. 이 명령은 외부 제목 조회를 하지 않으며, cleanup은 이관 완료 확인 뒤 재개한다. 전체 순서는 `docs/server/request-title-rollout.md`를 따른다.
- 관련 worker: `apps/worker/src/main.ts`가 queued job을 FIFO로 처리한다. 기존 제목 조회에서 유효한 제목을 얻으면 다운로드·업로드 전에 `ExtractionJob.title`에 조건부 저장하며, 제목 조회 실패는 추출을 중단하지 않는다. 공통 media-downloader 정책은 기본 client의 일반 transient extraction 실패를 같은 work directory와 partial file을 유지한 채 한 번 재시도하고, client 전환 대상 오류에서는 같은 client 재시도 없이 `web_embedded`를 한 번 fallback한다. fallback client는 추가 재시도하지 않으며, 인증 요구, abort/killed, process spawn, preflight, upload, DB 실패는 client fallback 대상이 아니다.
- 운영 진단: subprocess exit code·signal·bounded stdout/stderr tail은 server-only redacted diagnostic으로만 기록하며 API response에는 노출하지 않는다.
- 미구현 과제: `docs/unimplemented/current-unimplemented.md`
- 검증: `pnpm --filter api run test`, `pnpm --filter api run test:e2e`
