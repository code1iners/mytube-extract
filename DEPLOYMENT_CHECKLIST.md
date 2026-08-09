# 도메인 마이그레이션 배포 체크리스트

프로덕션 API 도메인 변경: `media-nest.codeliners.cc` → `mytube-extract-api.codeliners.cc`

---

## ✅ 사전 확인 (배포 전)

```bash
# 1. 신 도메인 API 서버 상태 확인
curl -I https://mytube-extract-api.codeliners.cc/health
# 예상: HTTP/1.1 200 OK 또는 2xx

# 2. 모든 검증 통과
./tools/verify-domain-migration.sh

# 3. 커밋 및 푸시
git add -A
git commit -m "chore: 프로덕션 API 도메인 마이그레이션 (media-nest → mytube-extract-api)"
git push origin main
```

---

## 🚀 스테이징 배포

### 1단계: 스테이징 환경 배포

```bash
# Vercel 배포 예시
vercel deploy --scope=staging

# 또는 프로젝트의 배포 도구 사용
# (GitHub Actions, CircleCI, 등)
```

### 2단계: 배포 후 검증

**웹 앱 검증** (모든 탭에서 실행):

1. 브라우저에서 스테이징 URL 열기: `https://staging.mytube-extract.dev` (또는 스테이징 도메인)
2. DevTools 열기 (F12)
3. **Network 탭** 클릭
4. **페이지 새로고침** (Ctrl+R)
5. 네트워크 요청 확인:
   - `mytube-extract-api.codeliners.cc/health` → 200 OK ✓
   - `mytube-extract-api.codeliners.cc/audio?url=...` 또는 `/video?url=...` 호출 ✓

**콘솔 에러 확인**:

- DevTools → **Console 탭**
- 빨간 오류 메시지 없음 ✓
- 경고 (노란색) 무시 가능

### 3단계: E2E 테스트 (수동)

```
1. 유효한 YouTube URL 입력
   - 예: https://www.youtube.com/watch?v=dQw4w9WgXcQ
   - 또는: https://youtu.be/dQw4w9WgXcQ

2. 오디오 다운로드 테스트
   ✓ 모드: "오디오 (MP3)" 선택
   ✓ 버튼: "추출 요청" 클릭
   ✓ 예상: 다운로드 시작 또는 API 응답 성공

3. 비디오 다운로드 테스트
   ✓ 모드: "비디오 (MP4)" 선택
   ✓ 버튼: "추출 요청" 클릭
   ✓ 예상: 다운로드 시작 또는 API 응답 성공

4. 자막 추출 테스트 (선택)
   ✓ 하단 탭: "자막 추출" 클릭
   ✓ 유효한 YouTube URL 입력
   ✓ 자막 파일 선택
   ✓ 버튼: "추출 요청" 클릭
   ✓ 예상: 요청 성공
```

### 4단계: Chrome Extension 검증 (선택)

```bash
# 확장 프로그램 빌드
pnpm --filter chrome-extension run build

# 수동 테스트:
# 1. chrome://extensions 열기
# 2. "개발자 모드" 활성화
# 3. "압축해제된 확장 프로그램 로드" 클릭
# 4. .output/chrome-mv3 폴더 선택
# 5. 팝업 클릭
# 6. DevTools → Network 탭에서 API 호출 확인
#    - mytube-extract-api.codeliners.cc/health ✓
#    - mytube-extract-api.codeliners.cc/audio 또는 /video ✓
```

### 5단계: 스테이징 모니터링 (2-4시간)

```bash
# 모니터링 항목:
# - 에러 추적 서비스 (Sentry, DataDog 등): 에러율 < 0.1%
# - API 응답 시간: p99 < 5초
# - 콘솔 에러 로그: 없음
# - 사용자 리포트: 없음

# 필요 시 Sentry/DataDog 대시보드 확인:
# - 오류율 추이
# - API 엔드포인트별 성공률
# - 응답 시간 분포
```

---

## 🌐 프로덕션 배포

### 1단계: 최종 검증

```bash
# 모든 검증 재실행
./tools/verify-domain-migration.sh

# 빌드 검증
pnpm build

# 결과: "모든 검증이 완료되었습니다!" ✓
```

### 2단계: 프로덕션 배포

```bash
# Vercel 배포 예시
vercel deploy --prod

# 또는 프로젝트의 배포 도구 사용
# (GitHub Actions: git push main)
```

### 3단계: 배포 후 즉시 모니터링 (30분)

**실시간 모니터링**:

```bash
# 방법 1: Sentry 대시보드
# - https://sentry.io/organizations/[org]/projects/[project]/
# - Issues 확인 (새로운 오류 0개)

# 방법 2: DataDog/New Relic
# - 애플리케이션 대시보드 오픈
# - 에러율 추이 확인
# - API 응답 시간 확인

# 방법 3: 기본 헬스 체크
curl -s https://mytube-extract-api.codeliners.cc/health | jq .
# 예상: { "ok": true, ... }
```

**체크리스트**:

```
[ ] 에러율 정상 (< 0.1%)
[ ] API 응답 시간 정상 (p99 < 5초)
[ ] 새로운 오류 없음
[ ] 사용자 신고 없음
```

### 4단계: 심화 모니터링 (2-4시간)

```bash
# 모니터링 지표:
# - 네트워크 요청 성공률 > 99.9%
# - API 엔드포인트별 에러 추적:
#   - /health: 100% 성공
#   - /audio?url=...: 오류 없음
#   - /video?url=...: 오류 없음
# - 다운로드 시작/완료 로그 정상

# Sentry 확인:
# - Event Types: 새로운 오류 없음
# - Affected Users: 영향받은 사용자 0명
# - Crash Free Sessions: > 99%
```

### 5단계: 지속 모니터링 (24시간)

```
모니터링 주기:
- 배포 직후 30분: 5분마다 확인
- 배포 후 2-4시간: 30분마다 확인
- 배포 후 4-24시간: 2시간마다 확인

모니터링 항목:
□ 에러율 추이 (점진적 증가 없음)
□ 응답 시간 (급격한 증가 없음)
□ 처리량 (평상시와 유사)
□ 사용자 피드백 (문제 신고 없음)
□ 로그 분석 (비정상 패턴 없음)
```

---

## 🔄 Rollback 절차 (긴급)

만약 프로덕션에 심각한 문제 발생:

```bash
# 1. 즉시 다음 명령 실행
git log --oneline | head -5
# 이전 커밋 해시 확인

# 2. Rollback
git revert <도메인-변경-커밋-해시>
git push origin main

# 또는 빠른 복구
git reset --hard <이전-커밋-해시>
git push -f origin main

# 3. 긴급 배포
vercel deploy --prod

# 4. 모니터링
# 에러율 감소 확인
```

---

## 📊 배포 체크리스트 (인쇄용)

```
[ ] 신 도메인 API 서버 상태 확인
[ ] 검증 스크립트 통과
[ ] 커밋 및 푸시
[ ] 스테이징 배포
[ ] 스테이징 Network 탭 검증 (API 호출 확인)
[ ] 스테이징 E2E 테스트 (3가지 케이스)
[ ] 스테이징 모니터링 완료 (2-4시간)
[ ] 프로덕션 검증 재실행
[ ] 프로덕션 배포
[ ] 배포 후 30분 모니터링
[ ] 배포 후 2-4시간 심화 모니터링
[ ] 배포 후 24시간 지속 모니터링
[ ] 모든 지표 정상 확인
[ ] 배포 완료
```

---

## 📝 배포 로그 템플릿

```
배포 날짜: [YYYY-MM-DD HH:MM:SS]
배포 환경: [ ] 스테이징  [ ] 프로덕션
배포 담당자: _______________

스테이징 배포:
- 배포 완료 시각: _____________
- Network 탭 검증: [ ] 완료
- E2E 테스트: [ ] 완료
- 모니터링 결과: _____________

프로덕션 배포:
- 배포 완료 시각: _____________
- 30분 모니터링: 에러율 ___%, 응답시간 ___ms
- 2-4시간 모니터링: 성공률 ___%, 문제 __개
- 24시간 모니터링: 안정성 정상 [ ]

이슈 발생 여부: [ ] 없음  [ ] 있음 (내용: _______________)
Rollback 필요: [ ] 없음  [ ] 필요 (이유: _______________)

최종 상태: [ ] 배포 성공  [ ] Rollback 실행
```

---

## 🆘 트러블슈팅

### 문제: Network 탭에서 API 호출이 보이지 않음

**원인**: 콘솔에서 오류 발생했을 가능성
**해결**:
1. DevTools → Console 탭 확인
2. 오류 메시지 읽기
3. API 엔드포인트 URL 정확성 확인
4. CORS 설정 확인

### 문제: 다운로드 버튼이 비활성화됨

**원인**: API 헬스 체크 실패
**해결**:
1. Network 탭에서 `/health` 요청 상태 확인
2. API 서버 가용성 확인
3. 방화벽/보안 그룹 설정 확인

### 문제: 응답 시간이 느림 (> 5초)

**원인**: API 서버 과부하, 네트워크 지연
**해결**:
1. 다른 시간대에 테스트
2. 인터넷 연결 확인
3. API 서버 성능 확인
4. CDN 캐시 상태 확인

---

## 📞 지원

배포 중 문제 발생 시:
1. 이 체크리스트 재확인
2. 트러블슈팅 섹션 참조
3. `./tools/verify-domain-migration.sh` 실행
4. 로그 및 오류 메시지 수집 후 팀에 공유
