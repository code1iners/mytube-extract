# API 로컬 배포 가이드

현재 PC에서 `pnpm deploy:api` 명령을 사용하여 NestJS API 서버를 Docker 컨테이너로 배포하는 절차입니다.

## 전제 조건

- Docker Desktop (또는 Docker 데몬) 실행 중
- `docker-compose.shared.env`와 `docker-compose.api.env`가 올바르게 설정됨
- `docker-compose.cloudflared.env`에 유효한 `CLOUDFLARE_TUNNEL_TOKEN`이 설정됨 (`deploy:api`는 API와 Tunnel을 항상 함께 배포함, [Cloudflared 터널 설정 가이드](./cloudflared-tunnel-setup.md) 참고)

## 빠른 시작

### 1. API 배포

```bash
pnpm deploy:api
```

이 명령은:
- API Docker 이미지를 빌드
- `api`와 `cloudflared`(터널 커넥터) 컨테이너를 함께 실행 (`cloudflared`는 `api`가 healthy해진 뒤 시작됨)
- 최대 60초 동안 두 컨테이너의 healthy 상태를 기다린 뒤 최근 10줄 로그 출력

**출력 예시:**
```
[+] Building 15.2s (18/18) FINISHED                                             docker:desktop-linux
...
✓ API + tunnel deployed
[컨테이너 로그 출력]
```

### 2. 헬스체크 확인

배포 완료 후 API가 정상 실행 중인지 확인:

```bash
curl http://localhost:5011/health
```

**성공 응답:**
```json
{"status":"ok"}
```

### 3. 실시간 로그 확인

별도 터미널에서 실시간 로그 모니터링:

```bash
pnpm api:logs
```

**종료:** `Ctrl+C`

### 4. API 중지

```bash
pnpm api:stop
```

## 상세 설정

### 환경변수 설정

역할별 파일에서 다음 변수를 설정합니다:

```bash
# docker-compose.shared.env: API와 worker 공통
DATABASE_URL=postgresql://user:password@localhost:5432/mytube_extract?schema=public
DIRECT_URL=postgresql://user:password@localhost:5432/mytube_extract?schema=public

R2_ENDPOINT=
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
ASSET_RETENTION_DAYS=7

# docker-compose.api.env: API 전용
R2_PUBLIC_BASE_URL=
WORKER_HEARTBEAT_STALE_MS=15000
SUBTITLE_UPLOAD_MAX_BYTES=1073741824
SUBTITLE_UPLOAD_TOKEN_SECRET=your-secret-here
```

`DIRECT_URL`은 host에서 실행하는 Prisma migration에만 사용하며 API와 worker runtime에는 주입되지 않습니다. `docker-compose.worker.env`와 `docker-compose.cloudflared.env`는 각각 worker와 Tunnel 명령에서만 사용되며 API 컨테이너에는 주입되지 않습니다.

### 포트 변경

기본 포트는 5011이며, docker-compose.yml의 `ports` 섹션에서 변경 가능:

```yaml
ports:
  - "5012:5011"  # 호스트 5012 → 컨테이너 5011
```

## Troubleshooting

### 문제 1: "Port 5011 is already allocated"

**원인:** 다른 프로세스나 이전 Docker 컨테이너가 5011 포트를 사용 중

**해결 방법:**

**방법 A: 포트 사용 프로세스 확인 및 종료**
```bash
# 포트 사용 중인 프로세스 확인
lsof -i :5011

# 프로세스 종료 (PID로)
kill -9 <PID>

# 또는 pnpm dev 실행 중이면
# 터미널에서 Ctrl+C로 종료
```

**방법 B: 다른 호스트 포트 사용**
```bash
# docker-compose.yml의 ports 섹션에서:
# "5011:5011" → "5012:5011"로 변경

# 그 후 API에 접근할 때:
curl http://localhost:5012/health  # 5012로 접근
```

**현재 상황:**
현재 호스트의 5011 포트가 사용 중인 경우, `docker-compose.yml`의 다음 부분에서 포트 번호를 변경하세요:
```yaml
api:
  ports:
    # - "5011:5011"  # 주석 처리
    - "5012:5011"   # 또는 다른 사용 가능한 포트 사용
```

### 문제 2: "docker: command not found"

**원인:** Docker가 설치되지 않았거나 PATH에 없음

**해결 방법:**
```bash
# Docker 설치 확인
docker --version

# Docker Desktop 실행 확인
# macOS: Dock에서 Docker 앱 실행
# Linux/Windows: Docker 데몬 시작
```

### 문제 3: "DATABASE_URL is not set"

**원인:** `docker-compose.shared.env` 파일에서 `DATABASE_URL`이 비어 있음

**해결 방법:**
```bash
# docker-compose.shared.env 파일에 DATABASE_URL 설정
# DATABASE_URL=postgresql://...
```

### 문제 4: 헬스체크 실패 (상태 "unhealthy")

**원인:** API 컨테이너가 정상 부트 안 됨 (보통 DB 연결 실패)

**해결 방법:**
```bash
# 상세 로그 확인
pnpm api:logs

# DATABASE_URL 재확인 (마이그레이션 필요할 수 있음)
# 데이터베이스 연결 가능성 테스트
psql $DATABASE_URL -c "SELECT 1"
```

### 문제 5: Cloudflared 터널로 접근 안 됨

**원인:** `CLOUDFLARE_TUNNEL_TOKEN` 미설정, `cloudflared` 컨테이너 미기동, 또는 대시보드의 Public Hostname 라우팅 오류

**해결 방법:**
1. [Cloudflared 터널 설정 가이드](./cloudflared-tunnel-setup.md) 참고
2. cloudflared 컨테이너 상태 확인:
   ```bash
   # 컨테이너 실행 여부
   docker compose ps cloudflared

   # 터널 로그
   pnpm tunnel:logs
   ```
3. Cloudflare 대시보드에서 Public Hostname의 Service가 `http://api:5011`인지 확인 (`http://localhost:5011`이면 502 발생)

## 컨테이너 관리

### 전체 상태 확인

```bash
docker ps --filter "name=mytube-extract-"
```

출력:
```
NAME                        STATUS                    PORTS
mytube-extract-api          Up 5 minutes (healthy)    0.0.0.0:5011->5011/tcp
mytube-extract-cloudflared  Up 5 minutes (healthy)
mytube-extract-worker       Up 12 minutes
```

### 컨테이너 재시작

```bash
# API만 재시작
pnpm api:stop
pnpm deploy:api
```

환경 변수를 변경했다면 `docker compose restart`가 아니라 위 명령처럼 컨테이너를 재생성해야 합니다.

### 로그 히스토리

```bash
# 마지막 50줄 (실시간 아님)
docker compose --env-file docker-compose.shared.env --env-file docker-compose.api.env --env-file docker-compose.cloudflared.env logs --tail=50 --follow=false api

# 타임스탬프 포함
docker compose logs api --timestamps
```

### 컨테이너 정리

```bash
# 중지된 컨테이너 제거
docker compose rm api

# 이미지 제거 (재빌드 필요)
docker rmi mytube-extract-api:latest
```

## 배포 후 검증

배포 후 자동 검증 스크립트 실행:

```bash
bash scripts/verify-api-deployment.sh
```

이 스크립트는:
- api, cloudflared 컨테이너 실행/헬스 상태 확인
- 로컬 헬스체크 엔드포인트 응답 확인
- HTTPS 터널 응답과 `cf-ray` 헤더 확인 (Cloudflare 엣지 경유 증명)

## 성능 및 모니터링

### CPU/메모리 사용량 모니터링

```bash
docker stats mytube-extract-api
```

### 데이터베이스 연결 풀 상태 (필요 시)

```bash
# API 컨테이너에서 Node 프로세스 정보 확인
docker top mytube-extract-api
```

## 다음 단계

- [Cloudflared 터널 설정](./cloudflared-tunnel-setup.md): 외부 HTTPS 접근 설정
- [Worker 배포](../README.md#worker-배포): 자막 변환 워커 배포
- 마이그레이션: `pnpm --filter @mytube-extract/db run migrate:deploy`
