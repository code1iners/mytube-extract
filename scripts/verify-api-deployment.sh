#!/bin/bash
set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 API Deployment Verification${NC}\n"

# Configuration
API_HOST="localhost"
CONTAINER_NAME="mytube-extract-api"
CLOUDFLARED_CONTAINER_NAME="mytube-extract-cloudflared"
# docker ps에서 포트 정보 추출 (예: 0.0.0.0:5012->5011/tcp)
API_PORT=$(docker port ${CONTAINER_NAME} 5011/tcp 2>/dev/null | cut -d: -f2 || echo "5012")
API_HEALTH_ENDPOINT="http://${API_HOST}:${API_PORT}/health"
TUNNEL_DOMAIN="mytube-extract-api.codeliners.cc"
TUNNEL_HEALTH_ENDPOINT="https://${TUNNEL_DOMAIN}/health"

# Track overall status
OVERALL_STATUS=0

# ========== 1. Docker 확인 ==========
echo -e "${BLUE}1️⃣  Docker 상태 확인${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker가 설치되어 있지 않습니다.${NC}"
    OVERALL_STATUS=1
else
    echo -e "${GREEN}✓ Docker 설치됨${NC} ($(docker --version))"
fi
echo ""

# ========== 2. 컨테이너 실행 상태 ==========
echo -e "${BLUE}2️⃣  컨테이너 실행 상태${NC}"
if docker ps --filter "name=${CONTAINER_NAME}" --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    STATUS=$(docker ps --filter "name=${CONTAINER_NAME}" --format "{{.Status}}" | head -1)
    echo -e "${GREEN}✓ 컨테이너 실행 중${NC}"
    echo "  Status: ${STATUS}"

    # 헬스체크 상태
    HEALTH_STATUS=$(docker ps --filter "name=${CONTAINER_NAME}" --format "{{.Status}}" | grep -o "healthy\|unhealthy" || echo "unknown")
    if [ "$HEALTH_STATUS" == "healthy" ]; then
        echo -e "  Health: ${GREEN}✓ healthy${NC}"
    elif [ "$HEALTH_STATUS" == "unhealthy" ]; then
        echo -e "  Health: ${RED}✗ unhealthy${NC}"
        OVERALL_STATUS=1
    else
        echo -e "  Health: ${YELLOW}⚠ unknown${NC} (starting...)"
    fi
else
    echo -e "${RED}✗ 컨테이너가 실행 중이지 않습니다.${NC}"
    echo "  실행: pnpm deploy:api"
    OVERALL_STATUS=1
fi
echo ""

# ========== 3. 로컬 헬스체크 ==========
echo -e "${BLUE}3️⃣  로컬 API 헬스체크 (${API_HEALTH_ENDPOINT})${NC}"
if docker ps --filter "name=${CONTAINER_NAME}" --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    # 컨테이너가 실행 중이면 헬스체크 시도
    if response=$(curl -s -w "\n%{http_code}" "${API_HEALTH_ENDPOINT}" 2>/dev/null); then
        http_code=$(echo "$response" | tail -n 1)
        body=$(echo "$response" | sed '$d')

        if [ "$http_code" == "200" ]; then
            echo -e "${GREEN}✓ 응답 200 OK${NC}"
            echo "  Body: ${body}"
        else
            echo -e "${RED}✗ 응답 HTTP ${http_code}${NC}"
            echo "  Body: ${body}"
            OVERALL_STATUS=1
        fi
    else
        echo -e "${YELLOW}⚠ API에 연결할 수 없습니다.${NC}"
        echo "  (컨테이너 시작 중일 수 있음, 잠시 후 다시 시도)"
        OVERALL_STATUS=1
    fi
else
    echo -e "${YELLOW}⚠ 컨테이너가 실행 중이지 않아 스킵${NC}"
fi
echo ""

# ========== 4. 포트 확인 ==========
echo -e "${BLUE}4️⃣  포트 상태 (${API_HOST}:${API_PORT})${NC}"
if command -v lsof &> /dev/null; then
    if lsof -i ":${API_PORT}" &>/dev/null; then
        echo -e "${GREEN}✓ 포트 ${API_PORT} 활성${NC}"
    else
        echo -e "${RED}✗ 포트 ${API_PORT} 미활성${NC}"
        OVERALL_STATUS=1
    fi
elif command -v netstat &> /dev/null; then
    if netstat -tuln 2>/dev/null | grep -q ":${API_PORT}"; then
        echo -e "${GREEN}✓ 포트 ${API_PORT} 활성${NC}"
    else
        echo -e "${RED}✗ 포트 ${API_PORT} 미활성${NC}"
        OVERALL_STATUS=1
    fi
else
    echo -e "${YELLOW}⚠ netstat/lsof 없음, 스킵${NC}"
fi
echo ""

# ========== 5. Cloudflared 컨테이너 상태 ==========
echo -e "${BLUE}5️⃣  Cloudflared 터널 컨테이너 상태${NC}"
if docker ps --filter "name=${CLOUDFLARED_CONTAINER_NAME}" --format "{{.Names}}" | grep -q "^${CLOUDFLARED_CONTAINER_NAME}$"; then
    TUNNEL_STATUS=$(docker ps --filter "name=${CLOUDFLARED_CONTAINER_NAME}" --format "{{.Status}}" | head -1)
    echo -e "${GREEN}✓ 컨테이너 실행 중${NC}"
    echo "  Status: ${TUNNEL_STATUS}"

    TUNNEL_HEALTH=$(echo "$TUNNEL_STATUS" | grep -o "healthy\|unhealthy" || echo "unknown")
    if [ "$TUNNEL_HEALTH" == "healthy" ]; then
        echo -e "  Health: ${GREEN}✓ healthy${NC}"
    elif [ "$TUNNEL_HEALTH" == "unhealthy" ]; then
        echo -e "  Health: ${RED}✗ unhealthy${NC}"
        OVERALL_STATUS=1
    else
        echo -e "  Health: ${YELLOW}⚠ unknown${NC} (starting...)"
    fi

    # 터널 로그에서 커넥터 등록 여부 확인
    if docker compose --env-file docker-compose.shared.env --env-file docker-compose.api.env --env-file docker-compose.cloudflared.env logs cloudflared 2>/dev/null | grep -q "Registered tunnel connection"; then
        echo -e "  Connection: ${GREEN}✓ Registered tunnel connection${NC}"
    else
        echo -e "  Connection: ${YELLOW}⚠ 아직 등록 로그를 찾지 못함${NC} (컨테이너 시작 직후일 수 있음)"
    fi
    echo ""

    # ========== 6. HTTPS 터널 헬스체크 ==========
    echo -e "${BLUE}6️⃣  HTTPS 터널 헬스체크 (${TUNNEL_HEALTH_ENDPOINT})${NC}"
    if response=$(curl -s -D - -o /tmp/verify-api-body.$$ -w "%{http_code}" "${TUNNEL_HEALTH_ENDPOINT}" 2>/dev/null); then
        http_code=$(echo "$response" | tail -n 1)
        body=$(cat /tmp/verify-api-body.$$ 2>/dev/null)
        cf_ray=$(echo "$response" | grep -i "^cf-ray:" | tr -d '\r' || echo "")
        rm -f /tmp/verify-api-body.$$

        if [ "$http_code" == "200" ]; then
            echo -e "${GREEN}✓ 응답 200 OK${NC}"
            echo "  Body: ${body}"
            if [ -n "$cf_ray" ]; then
                echo -e "  ${GREEN}✓ ${cf_ray}${NC} (Cloudflare 엣지 경유 확인)"
            else
                echo -e "  ${YELLOW}⚠ cf-ray 헤더를 찾을 수 없음${NC}"
            fi
        else
            echo -e "${RED}✗ 응답 HTTP ${http_code}${NC}"
            echo "  Body: ${body}"
            OVERALL_STATUS=1
        fi
    else
        echo -e "${YELLOW}⚠ 터널을 통한 연결 실패${NC}"
        echo "  - DNS/Public Hostname 설정 확인 필요 (Service가 http://api:5011 인지 확인)"
        echo "  - 터널 설정 가이드: docs/deployment/cloudflared-tunnel-setup.md"
        OVERALL_STATUS=1
    fi
else
    echo -e "${RED}✗ cloudflared 컨테이너가 실행 중이지 않습니다.${NC}"
    echo "  실행: pnpm deploy:api"
    echo "  설정 가이드: docs/deployment/cloudflared-tunnel-setup.md"
    OVERALL_STATUS=1
fi
echo ""

# ========== 7. 컨테이너 리소스 사용량 ==========
echo -e "${BLUE}7️⃣  컨테이너 리소스 사용량${NC}"
if docker ps --filter "name=${CONTAINER_NAME}" --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    if docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" ${CONTAINER_NAME} 2>/dev/null; then
        :
    else
        echo -e "${YELLOW}⚠ 리소스 정보를 가져올 수 없습니다.${NC}"
    fi
else
    echo -e "${YELLOW}⚠ 컨테이너가 실행 중이지 않아 스킵${NC}"
fi
echo ""

# ========== 8. 요약 ==========
echo -e "${BLUE}📊 검증 요약${NC}"
if [ $OVERALL_STATUS -eq 0 ]; then
    echo -e "${GREEN}✓ 모든 검증 성공!${NC}"
    echo ""
    echo -e "API 접근:"
    echo -e "  ${BLUE}로컬:${NC}        ${API_HEALTH_ENDPOINT}"
    if docker ps --filter "name=${CLOUDFLARED_CONTAINER_NAME}" --format "{{.Names}}" | grep -q "^${CLOUDFLARED_CONTAINER_NAME}$"; then
        echo -e "  ${BLUE}HTTPS 터널:${NC}  ${TUNNEL_HEALTH_ENDPOINT}"
    fi
    echo ""
    echo -e "명령어:"
    echo -e "  ${YELLOW}API 로그:${NC}      pnpm api:logs"
    echo -e "  ${YELLOW}API 중지:${NC}      pnpm api:stop"
    echo -e "  ${YELLOW}터널 로그:${NC}     pnpm tunnel:logs"
    echo -e "  ${YELLOW}터널 중지:${NC}     pnpm tunnel:stop"
    exit 0
else
    echo -e "${RED}✗ 검증 실패${NC}"
    echo ""
    echo "다음 단계:"
    echo "  1. 로그 확인: pnpm api:logs"
    echo "  2. 배포 가이드 참고: docs/deployment/api-local-deployment.md"
    echo "  3. Cloudflared 설정 가이드: docs/deployment/cloudflared-tunnel-setup.md"
    echo ""
    exit 1
fi
