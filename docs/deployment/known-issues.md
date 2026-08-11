# 배포 설정 알려진 이슈

Docker Compose 기반 API, worker, Cloudflare Tunnel 배포에서 확인된 이슈와 현재 상태를 기록한다.

## 해결된 항목

### Worker 배포의 Tunnel token 의존성

- 상태: 해결
- 해결 내용:
  - `TUNNEL_TOKEN`의 전역 필수 보간 가드를 제거했다.
  - Worker 서비스를 `docker-compose.worker.yml`로 분리하고 worker 명령에서만 병합한다.
  - `worker:deploy`는 `docker-compose.shared.env`와 `docker-compose.worker.env`만 읽는다.
  - Tunnel token 없이도 worker 구성을 파싱하고 배포할 수 있다.
- 회귀 검증:
  - `CLOUDFLARE_TUNNEL_TOKEN` 없이 worker Compose 구성 검증
  - 실제 `pnpm worker:deploy` 성공 확인

### API·Worker 컨테이너의 불필요한 시크릿 유입

- 상태: 해결
- 해결 내용:
  - 배포 env를 `shared`, `api`, `worker`, `cloudflared` 파일로 분리했다.
  - API와 worker의 통합 `env_file` 주입을 제거하고 서비스별 환경 변수 allowlist를 선언했다.
  - `CLOUDFLARE_TUNNEL_TOKEN`은 `cloudflared`의 `TUNNEL_TOKEN`에만 전달한다.
  - Prisma migration 전용 `DIRECT_URL`은 API와 worker runtime에 전달하지 않는다.
  - 실제 `docker-compose.*.env`는 `.dockerignore`로 image build context에서도 제외한다.
- 회귀 검증:
  - API와 worker 컨테이너의 env 키 목록에서 Tunnel token 및 상대 서비스 전용 키가 없는지 확인
  - API와 worker 컨테이너에 `DIRECT_URL`이 없는지 확인
  - production image에 실제 env 파일이 없는지 확인
  - Cloudflared의 등록 상태와 공개 HTTPS `/health` 확인

### API 배포 실패가 성공으로 보고되는 문제

- 상태: 해결
- 해결 내용:
  - 전체 명령 실패를 덮던 마지막 `|| true`를 제거했다.
  - `sleep 3` 대신 `docker compose up --wait --wait-timeout 60`으로 API와 Tunnel의 healthy 상태를 기다린다.
  - 로그 출력만 선택적으로 실패를 허용한다.
- 회귀 검증:
  - 정상 배포 exit code `0`
  - Compose 시작 또는 healthy 대기 실패 시 non-zero exit code

### 로컬 Worker Whisper 모델 환경 변수 불일치

- 상태: 해결
- 해결 내용:
  - 로컬 `apps/worker/.env`의 `WHISPER_MODEL_PATH`를 제거했다.
  - `WHISPER_MODEL_BASE_EN_PATH`, `WHISPER_MODEL_SMALL_EN_PATH`를 실제 모델 파일에 맞게 설정했다.
- 회귀 검증:
  - Whisper CLI와 두 모델 파일 존재 확인
  - 로컬 worker preflight 및 heartbeat 갱신 확인

### Worker 기본값과 필수 host mount 검증 불일치

- 상태: 해결
- 해결 내용:
  - Worker 구현, Compose fallback, Docker·로컬 env example의 `WORKER_LOOP_INTERVAL_MS`를 `5000`으로 통일했다.
  - Worker 전용 Compose 파일에서 `WHISPER_CPP_HOST_DIR`를 필수값으로 검증한다.
  - 값 누락 시 저장소 루트를 `/whisper.cpp`로 mount하지 않고 Compose 파싱 단계에서 실패한다.
- 회귀 검증:
  - 빈 `WORKER_LOOP_INTERVAL_MS`의 렌더링 결과가 `5000`인지 확인
  - 빈 `WHISPER_CPP_HOST_DIR`로 worker 구성을 파싱하면 non-zero인지 확인
  - 실제 `pnpm worker:deploy` 후 heartbeat 갱신 확인

### 배포 가이드의 Tunnel 전제와 명령 불일치

- 상태: 해결
- 해결 내용:
  - `deploy:api`가 API와 Tunnel을 항상 함께 배포하므로 Tunnel token을 필수 전제로 명시했다.
  - Compose logs 옵션을 서비스명 앞에 두는 실행 가능한 명령으로 교체했다.
  - 잘못된 migration script 이름을 실제 DB package script인 `migrate:deploy`로 교체했다.
- 회귀 검증:
  - 문서의 package script 이름을 실제 `package.json`과 대조
  - 비추적 API logs 명령의 정상 종료 확인

---

## 1. [낮음] 배포 가이드의 헬스체크 응답 예시가 실제 응답과 다름

- 상태: 미해결
- 대상 파일: [api-local-deployment.md:40](./api-local-deployment.md)
- 판정: 명확한 결함 (문서 정합성)

문서는 `/health` 성공 응답을 `{"status":"ok"}`로 안내하지만 실제 응답 계약은 `{"ok":true,"worker":{"available":boolean}}`이다. 문서 예시를 기준으로 `status`를 파싱하면 항상 실패한다.

### 완료 조건

- [ ] `api-local-deployment.md`의 성공 응답 예시가 `HealthResponse`와 일치

---

## 2. [참고] 검증 스크립트가 컨테이너 미존재 시 포트 표시가 깨짐

- 상태: 미해결
- 대상 파일: [verify-api-deployment.sh:18](../../scripts/verify-api-deployment.sh)
- 판정: 참고 (기능 오류 아님, 진단 메시지 품질)

`docker port` 실패 뒤의 `cut`이 빈 입력에도 exit `0`을 반환해 `|| echo "5012"`가 실행되지 않는다. 컨테이너가 없으면 `API_PORT`가 비어 `http://localhost:/health`처럼 표시된다.

### 완료 조건

- [ ] 컨테이너 미존재 상태에서도 검증 출력에 fallback 포트가 표시됨

---

배포 후 회귀 검증은 [API 로컬 배포](./api-local-deployment.md)의 절차와 `bash scripts/verify-api-deployment.sh`를 따른다.
