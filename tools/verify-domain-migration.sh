#!/bin/bash

# MyTube Extract 도메인 마이그레이션 검증 스크립트
# 프로덕션 배포 전/후 실행하여 API 도메인 변경 확인

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 함수: 로그 출력
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
  echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[!]${NC} $1"
}

echo "=========================================="
echo "MyTube Extract 도메인 마이그레이션 검증"
echo "=========================================="
echo ""

# 1. 소스 코드 검증
log_info "1단계: 소스 코드 검증"
echo ""

OLD_DOMAIN="media-nest.codeliners.cc"
NEW_DOMAIN="mytube-extract-api.codeliners.cc"

# 구 도메인 참조 확인 (마이그레이션 계획 문서, 스크립트 제외)
OLD_COUNT=$(grep -r "$OLD_DOMAIN" . \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=dist \
  --exclude-dir=build \
  --exclude-dir=.output \
  --exclude="*.lock" \
  --exclude="*MIGRATION_PLAN*" \
  --exclude="verify-domain-migration.sh" \
  2>/dev/null | wc -l)

if [ "$OLD_COUNT" -eq 0 ]; then
  log_success "구 도메인 참조 0개"
else
  log_error "구 도메인 참조 $OLD_COUNT개 발견"
  echo ""
  log_warning "남은 구 도메인 참조:"
  grep -r "$OLD_DOMAIN" . \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir=.output \
    --exclude="*.lock" \
    --exclude="*MIGRATION_PLAN*" \
    --exclude="verify-domain-migration.sh" \
    2>/dev/null || true
  exit 1
fi

# 신 도메인 참조 확인
NEW_COUNT=$(grep -r "$NEW_DOMAIN" . \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=dist \
  --exclude-dir=build \
  --exclude-dir=.output \
  --exclude="*.lock" \
  2>/dev/null | wc -l)

if [ "$NEW_COUNT" -gt 0 ]; then
  log_success "신 도메인 참조 $NEW_COUNT개 확인"
else
  log_error "신 도메인 참조 0개 (설정 누락)"
  exit 1
fi

echo ""

# 2. 빌드 검증
log_info "2단계: 프로덕션 빌드 검증"
echo ""

if [ ! -d "apps/web/dist" ] || [ ! -d "apps/chrome-extension/.output/chrome-mv3" ]; then
  log_warning "빌드 산출물 미검출, 빌드 실행 중..."
  pnpm build > /dev/null 2>&1
fi

# 빌드 산출물에서 도메인 확인
WEB_BUILD_OLD=$(grep -r "$OLD_DOMAIN" apps/web/dist 2>/dev/null | wc -l || echo 0)
EXT_BUILD_OLD=$(grep -r "$OLD_DOMAIN" apps/chrome-extension/.output 2>/dev/null | wc -l || echo 0)

if [ "$WEB_BUILD_OLD" -eq 0 ] && [ "$EXT_BUILD_OLD" -eq 0 ]; then
  log_success "빌드 산출물에서 구 도메인 제거됨"
else
  log_error "빌드 산출물에 구 도메인 남아있음 (web: $WEB_BUILD_OLD, ext: $EXT_BUILD_OLD)"
  exit 1
fi

WEB_BUILD_NEW=$(grep -r "$NEW_DOMAIN" apps/web/dist 2>/dev/null | wc -l || echo 0)
EXT_BUILD_NEW=$(grep -r "$NEW_DOMAIN" apps/chrome-extension/.output 2>/dev/null | wc -l || echo 0)

if [ "$WEB_BUILD_NEW" -gt 0 ] || [ "$EXT_BUILD_NEW" -gt 0 ]; then
  log_success "빌드 산출물에서 신 도메인 확인됨 (web: $WEB_BUILD_NEW, ext: $EXT_BUILD_NEW)"
else
  log_warning "빌드 산출물에서 신 도메인을 찾을 수 없음 (정상일 수 있음)"
fi

echo ""

# 3. API 엔드포인트 검증 (선택: 배포 후)
log_info "3단계: API 엔드포인트 검증 (선택)"
echo ""

read -p "신 도메인 API 서버 상태를 확인하시겠습니까? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  log_info "신 도메인 API 엔드포인트 검증 중..."

  if curl -s -I "https://$NEW_DOMAIN/health" > /dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$NEW_DOMAIN/health")
    if [ "$HTTP_CODE" -eq 200 ]; then
      log_success "API 서버 정상 (HTTP $HTTP_CODE)"
    else
      log_warning "API 서버 응답 비정상 (HTTP $HTTP_CODE)"
    fi
  else
    log_error "API 서버 접속 실패 (DNS 또는 네트워크 오류)"
  fi
fi

echo ""
echo "=========================================="
log_success "모든 검증이 완료되었습니다!"
echo "=========================================="
echo ""
echo "다음 단계:"
echo "  1. 스테이징 배포 후: 브라우저 DevTools → Network 탭에서 API 호출 확인"
echo "  2. 프로덕션 배포 후: 24시간 모니터링 실행"
echo ""
