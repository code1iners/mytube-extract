# 요청 영상 제목 전환·복구 런북

이 문서는 `ExtractionJob.title`을 추가하는 전환을 로컬에서 리허설하고, 구 버전
worker가 결과물에만 남긴 제목을 잃지 않도록 정리 작업을 통제하는 절차다. 운영 배포,
운영 데이터 이관, 실제 YouTube 추출을 수행하는 문서가 아니다.

## 현재 저장 계약

- `ExtractionJob.title`은 nullable이며 요청에서 처음 확보한 유효한 원본 영상 제목을 보존한다.
  `null`, 빈 문자열, 공백뿐인 값은 미확보로 취급한다.
- `ExtractedAsset.title`은 결과물과 다운로드 파일명에 사용하는 값이고,
  `ExtractionJob.title`과 소유권이 다르다. 결과물 만료·R2 object 삭제·`ExtractedAsset` row
  삭제는 연결만 끊을 뿐, `ExtractionJob` row가 존재하는 동안 요청 제목을 지우지 않는다.
- `POST /downloads`와 `GET /downloads/:jobId`는 저장된 `title`과 `videoId` 기반 `sourceUrl`을
  반환한다. 접수·상태 조회·내역 열기에서 외부 제목 재조회는 하지 않는다.
- Web 접수증은 `kind`, `jobId`, `acceptedAt`만 가진다. 제목과 원본 링크는 매번 상태 API에서
  읽으며, 브라우저 접수증 삭제는 서버 `ExtractionJob`이나 결과물 정리를 뜻하지 않는다.
- 제목 보존 기간은 결과물 보관 기간이 아니라 `ExtractionJob` row의 존재 기간에 종속된다.
  별도의 영구 요청 보존 정책은 이 전환 범위에 포함하지 않는다.

## 호환 전환 순서

순서를 바꾸지 않는다. 특히 정리 작업을 이관보다 먼저 재개하지 않는다.

1. **정리 중지와 작업 처리 동결**: 결과물 cleanup scheduler를 중지하거나 전환 중 실행되지
   않게 하고, 구 버전 API가 새 요청을 계속 만들지 않도록 접수 창을 통제한다. 이 시점부터
   정리 재개 전까지 만료된 결과물 row와 object를 지우지 않는다.
2. **nullable 필드 추가**: `20260909000000_add_extraction_job_title` migration을 적용하고
   `ExtractionJob.title`이 nullable로 조회되는지 확인한다. 구 버전 API·worker가 이 필드를
   몰라도 읽기·쓰기가 깨지지 않는 additive migration이어야 한다.
3. **구 버전 worker drain**: 구 버전 worker 프로세스를 중지하고, 잔여 `queued`·`processing`
   실행이 더 이상 구 버전에서 진행되지 않는 것을 로그와 상태 조회로 확인한다. drain이
   끝나기 전에는 이관을 시작하지 않는다. 구 버전이 마지막으로 만든 결과물에만 제목이
   남을 수 있으므로, 그 결과물 row는 이관 때까지 보존한다.
4. **기존 제목 dry-run 및 이관**: `backfill:request-titles`를 먼저 dry-run으로 실행해
   대상 수를 기록한다. 예상 대상이 맞을 때만 `--apply`를 사용한다. 함수는 결과물 제목이
   유효하고 요청 제목이 비어 있을 때만 조건부 갱신하며, 외부 서비스에는 접근하지 않는다.
5. **이관 완료 확인**: 같은 dry-run을 다시 실행해 후보가 0인지 확인한다. `updated`가
   `candidates`보다 작으면 다른 worker가 먼저 제목을 저장했을 수 있으므로 상태를 다시
   확인하고, 후보가 남아 있으면 원인을 해결할 때까지 다음 단계로 가지 않는다.
6. **새 저장·응답·표시 활성화**: 새 API/worker와 Web을 활성화한다. 새 worker는 제목을
   확보하는 즉시 요청에 조건부 저장하고, API와 Web은 `title`·`sourceUrl` 계약을 사용한다.
7. **정리 재개**: 로컬 리허설과 배포 전 점검에서 이관 완료와 조회 보존을 확인한 뒤에만
   결과물 cleanup scheduler를 재개한다. 이후 새 구 버전 실행이 유입되지 않는지 계속 확인한다.

### 이관 명령

기본 실행은 변경하지 않는 dry-run이다. 실제 변경은 명시적으로 `--apply`를 붙인다.

```sh
pnpm --filter api run backfill:request-titles
pnpm --filter api run backfill:request-titles -- --apply
pnpm --filter api run backfill:request-titles
```

출력의 `scanned`, `candidates`, `updated`를 전환 기록에 남긴다. 대상이 비어 있거나
데이터베이스 연결·schema가 준비되지 않았으면 통과로 기록하지 않는다.

## 중단·재개·복구

다음 중 하나라도 발생하면 cleanup을 재개하지 않고 이관 단계에서 멈춘다.

- migration이 적용되지 않았거나 `ExtractionJob.title` 조회가 실패한다.
- 구 버전 worker가 아직 실행 중이거나 `queued`·`processing` 잔여 작업의 소유 버전을
  확인할 수 없다.
- dry-run 후보 수가 예상과 다르거나, `--apply` 후 후보가 0이 되지 않는다.
- 연결된 결과물 제목이 null·공백뿐이거나 요청 제목을 조건부 저장할 수 없다.
- DB 연결 단절, schema drift, 결과 기록 불일치가 발생한다.

이관 중 오류가 나면 이미 저장된 제목을 되돌리거나 필드를 삭제하지 않는다. cleanup을
계속 중지한 상태에서 원인을 해결하고 같은 명령을 다시 실행한다. 이관은 조건부 갱신과
재실행을 전제로 하므로 앞서 반영된 제목은 덮어쓰지 않는다. 재실행 후 dry-run 후보가
0인지 확인한 다음에만 cleanup을 재개한다.

새 API/worker를 되돌려야 하면 additive `title` column과 확보한 제목을 유지한 채 구 버전
코드만 복구한다. 구 버전 worker가 다시 결과물에만 제목을 남길 수 있으므로 복구 중에는
cleanup을 재개하지 않고, 새 버전으로 돌아온 뒤 drain → dry-run → apply → dry-run을 다시
수행한다. migration down, `ExtractionJob.title` 초기화, 결과물 선삭제는 복구 방법이 아니다.

## 로컬 리허설

리허설은 테스트가 소유하는 고유한 YouTube ID와 실제 로컬 PostgreSQL을 사용한다. 기존
02–04의 요청 처리·상태 조회 경계를 재사용하며, 별도 테스트용 처리기를 복제하지 않는다.

```sh
pnpm --filter @mytube-extract/db run build
pnpm --filter api exec jest src/downloads/request-title-backfill.spec.ts --runInBand
pnpm --filter api exec jest test/real-integration/request-title.real-e2e-spec.ts --config ./test/jest-e2e-real.json --runInBand
pnpm --filter web run test:browser
```

실제 DB 통합 스위트는 다음 순서를 확인한다.

1. 제목 저장을 하지 않는 구 버전 처리 경계가 완료되어 `ExtractedAsset.title`만 남긴다.
2. dry-run과 조건부 이관으로 `ExtractionJob.title`을 채우고 `GET /downloads/:jobId`에서 읽는다.
3. 결과물 만료와 실제 `ExtractedAsset` row 정리를 실행한다.
4. 결과물 row가 사라진 뒤에도 같은 서버 job 조회에 제목이 남고, 이관 재실행이 덮어쓰지 않는지 확인한다.

DB 연결 또는 migration이 없는 환경에서 이 스위트가 실패하면 필수 검증 미실행으로
기록한다. 빈 대역이나 fixture 결과로 실제 DB 검증을 대신하지 않는다.

## 증거 경계

| 검증 | 입증하는 것 | 입증하지 않는 것 |
| --- | --- | --- |
| 실제 로컬 PostgreSQL 스위트 | schema, 조건부 이관, API 상태 조회, 결과물 row 정리 뒤 요청 제목 보존 | 운영 DB, 운영 worker drain, R2·provider 성공 |
| Web Chromium 대역 | 제목·원본 링크·상태·새로고침·삭제/복원·좁은 화면 동작 | 실제 API/worker, 실제 YouTube, 물리 브라우저 UI, screen reader |
| typecheck/build/unit test | 컴파일과 자동화된 계약 | 배포 성공, 운영 데이터 상태 |

운영 배포, 운영 데이터 이관, 실제 YouTube 추출은 이 티켓에서 실행하지 않는다.
