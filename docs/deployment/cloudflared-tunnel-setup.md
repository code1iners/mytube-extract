# Cloudflared 터널 설정 가이드 (Tunnel Token 방식)

`cloudflared`를 Docker 컨테이너로 실행하여 NestJS API를 외부 HTTPS 도메인으로 노출하는 절차입니다. 터널 자체는 Cloudflare 대시보드에서 **원격 관리(remotely-managed)** 방식으로 생성되어 있고, 이 PC는 토큰 하나로 커넥터 역할만 수행합니다.

이 방식에서는 호스트에 `cloudflared`를 설치하거나 `cloudflared tunnel login`, `config.yml`, `credentials-file`을 다룰 필요가 **전혀 없습니다.** ingress 라우팅(어떤 도메인이 어떤 서비스로 가는지)도 로컬 파일이 아니라 Cloudflare 대시보드에서 관리됩니다.

## 전제 조건

- Cloudflare 계정에 터널이 이미 생성되어 있음 (Zero Trust → Networks → Tunnels)
- 해당 터널의 Tunnel Token을 확보함 (`eyJ...`로 시작하는 문자열)
- Docker Desktop 실행 중

## 1단계: 토큰 확보

1. [Cloudflare Zero Trust 대시보드](https://one.dash.cloudflare.com) 접속
2. **Networks → Tunnels** 이동
3. 대상 터널 선택 → **Overview** 탭
4. **Add a replica** 클릭 → 표시되는 `docker run` 명령에서 `--token` 뒤의 `eyJ...` 문자열이 토큰

**주의:** 이 토큰은 터널 전체를 조작할 수 있는 시크릿입니다. 코드나 문서에 하드코딩하지 말고 `docker-compose.cloudflared.env`에만 보관하세요 (`.gitignore`에 등록되어 있어 커밋되지 않습니다).

## 2단계: 토큰을 cloudflared 전용 env 파일에 설정

```bash
# docker-compose.cloudflared.env 파일에 추가
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...실제토큰값...
```

`docker-compose.cloudflared.env.example`에 형식이 안내되어 있습니다. 이 파일은 API와 worker 컨테이너에 전달되지 않습니다.

## 3단계: Public Hostname의 Service 값 확인 (필수)

Cloudflare 대시보드에서 이 터널의 **Public Hostname** 설정을 확인합니다:

- **Networks → Tunnels → 터널 선택 → Public Hostname 탭**
- `mytube-extract-api.codeliners.cc` 항목의 **Service**가 다음과 같아야 합니다:
  ```
  http://api:5011
  ```

**왜 `localhost`가 아닌 `api`인가:** `cloudflared`가 Docker 컨테이너로 실행되면, 컨테이너 안에서 `localhost`는 `cloudflared` 자기 자신을 가리킵니다. API 서버는 `localhost`가 아니라 같은 Docker 네트워크(`mytube-extract_default`)에 속한 `api`라는 서비스 이름으로 접근해야 합니다.

Service 값이 `http://localhost:5011`로 되어 있다면 **502 Bad Gateway**가 발생하므로, 이 단계에서 반드시 `http://api:5011`로 수정하세요.

## 4단계: 배포

```bash
pnpm deploy:api
```

이 명령은 `api`와 `cloudflared` 두 컨테이너를 함께 빌드/기동합니다. `cloudflared`는 `api`의 헬스체크가 통과한 뒤에 시작됩니다(`depends_on: condition: service_healthy`).

## 5단계: 검증

### 컨테이너 상태 확인

```bash
docker compose ps
```

`api`, `cloudflared` 둘 다 `healthy` 상태여야 합니다.

### 터널 로그 확인

```bash
pnpm tunnel:logs
```

다음과 같은 로그가 보이면 정상입니다:
```
INF Registered tunnel connection connIndex=0 ...
```

### HTTPS 접근 테스트

```bash
curl -i https://mytube-extract-api.codeliners.cc/health
```

**성공 응답:**
```
HTTP/2 200
server: cloudflare
cf-ray: xxxxxxxxxxxxxxxx-XXX
...

{"ok":true,"worker":{"available":true}}
```

`server: cloudflare`와 `cf-ray` 헤더는 요청이 실제로 Cloudflare 엣지를 거쳐왔다는 증거입니다.

## 기존 커넥터 정리 (마이그레이션 시)

같은 터널에 다른 서버(예: 기존 프로덕션 호스트)의 커넥터가 이미 붙어있는 상태에서 이 PC의 커넥터를 추가하면, Cloudflare가 두 커넥터에 트래픽을 분산합니다. 즉 **일부 요청은 여전히 예전 서버로 갑니다.**

완전히 이 PC로 이관하려면:

1. 이 PC의 커넥터가 정상 등록된 것을 확인 (`pnpm tunnel:logs`에서 `Registered tunnel connection` 확인)
2. Cloudflare 대시보드 → 터널 → **Overview** 탭의 **Connectors** 목록에서 예전 서버의 커넥터를 찾아 제거하거나, 예전 서버의 `cloudflared` 프로세스를 종료
3. 제거 후 `curl -i https://mytube-extract-api.codeliners.cc/health`로 재검증

## Troubleshooting

### 502 Bad Gateway

**원인 1:** Public Hostname의 Service가 `http://localhost:5011`로 되어 있음 (컨테이너 안에서는 `cloudflared` 자신을 가리킴)

**해결:** 3단계대로 Service를 `http://api:5011`로 수정

**원인 2:** `api` 컨테이너가 중지되었거나 unhealthy 상태

**해결:**
```bash
docker compose ps
pnpm api:logs
```

### Error 1033 / 530

**원인:** 이 PC에 활성 커넥터가 없음 (`cloudflared` 컨테이너가 중지되었거나 토큰이 잘못됨)

**해결:**
```bash
docker compose ps cloudflared
pnpm tunnel:logs
```

### Tunnel token 누락으로 컨테이너 기동 실패

**원인:** `docker-compose.cloudflared.env`에 `CLOUDFLARE_TUNNEL_TOKEN`이 비어 있음

**해결:** 2단계대로 토큰 값을 채워 넣은 뒤 재배포

```bash
grep -q '^CLOUDFLARE_TUNNEL_TOKEN=.' docker-compose.cloudflared.env
pnpm deploy:api
```

### 토큰이 유출되었거나 회전이 필요한 경우

1. Cloudflare 대시보드 → 터널 → **Configure** → 토큰 재발급(Refresh token) 또는 새 터널 생성
2. `docker-compose.cloudflared.env`의 `CLOUDFLARE_TUNNEL_TOKEN` 값 교체
3. `pnpm tunnel:stop && pnpm deploy:api`로 재기동

### cloudflared 컨테이너 healthcheck가 계속 unhealthy

`TUNNEL_METRICS` 환경변수가 없으면 `cloudflared tunnel ready`가 조회할 `/ready` 엔드포인트 자체가 열리지 않아 healthcheck가 항상 실패합니다. `docker-compose.yml`의 `cloudflared` 서비스에 `TUNNEL_METRICS: 0.0.0.0:2000`이 설정되어 있는지 확인하세요.

## 관련 문서

- [API 로컬 배포](./api-local-deployment.md): `pnpm deploy:api` 사용 가이드
- [Cloudflare Tunnel 공식 문서 — Run parameters](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/)
- [Cloudflare Tunnel tokens](https://developers.cloudflare.com/tunnel/advanced/tunnel-tokens/)
