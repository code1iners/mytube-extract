# 마이그레이션 계획: media-nest → mytube-extract

## 개요

프로젝트명이 `media-nest`에서 `mytube-extract`로 변경되었습니다. 코드베이스, 문서, 환경변수, 설정에 남아있는 레거시 참조를 체계적으로 정리하는 계획입니다.

**현재 상태**: Claude Code 사이드바 프로젝트명 불일치 + 운영 도메인 변경 필요 + 레거시 환경변수 복잡성

**최종 목표**: 모든 공식 참조는 `mytube-extract`, 프로덕션 도메인은 `https://mytube-extract-api.codeliners.cc` 적용

---

## 🔴 Phase 1: 프로덕션 도메인 변경 (긴급, 중간-높은 리스크)

**목표**: `media-nest.codeliners.cc` → `mytube-extract-api.codeliners.cc` 변경 (29개 참조)

### 상황
- 운영 API 서버 도메인이 이미 `https://mytube-extract-api.codeliners.cc`로 배포됨
- 코드베이스의 모든 상수, 문서, 테스트가 구 도메인 참조 중
- 클라이언트가 여전히 구 도메인으로 호출하면 서비스 장애 발생 위험

### 변경이 필요한 파일 (29개 참조)

**🔴 긴급** (소스 코드 - 프로덕션 영향):
1. `apps/web/src/api/mytube-extract.api.ts`: PRODUCTION_API_BASE_URL
2. `apps/chrome-extension/wxt.config.ts`: PRODUCTION_API_BASE_URL
3. `apps/chrome-extension/src/shared/constants.ts`: PRODUCTION_API_BASE_URL
4. `apps/chrome-extension/tools/verify-extension-package.js`: DEFAULT_API_BASE_URL

**🟡 높음** (문서 - 설정 혼동 위험):
5. `README.md` (3곳)
6. `docs/web/current-implementation-fsd.md`
7. `docs/chrome-extension/current-implementation-fsd.md` (2곳)
8. `docs/chrome-extension/current-implementation-prd.md`

**🟢 중간** (테스트 - 간접 영향):
9. `apps/chrome-extension/tests/unit/download-url.test.ts` (2곳)
10. `apps/chrome-extension/tests/integration/popup-download-model.test.ts` (4곳)
11. `apps/chrome-extension/tests/manifest/wxt-config.test.ts` (3곳)
12. `apps/chrome-extension/tests/browser/popup-smoke.mjs` (1곳)

### 변경 사항

```diff
- const PRODUCTION_API_BASE_URL = 'https://media-nest.codeliners.cc';
+ const PRODUCTION_API_BASE_URL = 'https://mytube-extract-api.codeliners.cc';

- 'https://media-nest.codeliners.cc/*'
+ 'https://mytube-extract-api.codeliners.cc/*'
```

### 체크리스트

- [x] `.claude/settings.json` 프로젝트명 설정 (완료)
- [ ] 소스 코드 상수 4개 파일 변경
- [ ] 문서 8개 파일 변경
- [ ] 테스트 5개 파일 변경
- [ ] 전체 테스트 통과 검증
- [ ] 스테이징 배포 검증
- [ ] 프로덕션 배포

---

## 🟡 Phase 2: 레거시 환경변수 정리 (1-2주, 중간 리스크)

**목표**: `MEDIA_NEST_*` 환경변수의 상태를 명확히 하고, 마이그레이션 패스를 문서화  
**주의**: Phase 1 도메인 변경 후 진행

### 작업 1: turbo.json 환경변수 정책 명시

**파일**: `/turbo.json`

**현황**:
```json
"env": [
  "MEDIA_NEST_API_BASE_URL",
  "MEDIA_NEST_WXT_DEV_OUTPUT_ROOT",
  "MEDIA_NEST_WXT_DEV_PORT",
  "MEDIA_NEST_PREVIEW_PORT",
  "MEDIA_NEST_DEV_READY_TIMEOUT_MS",
  "MEDIA_NEST_DEV_READY_INTERVAL_MS",
  "MEDIA_NEST_DEV_OPEN_PREVIEW",
  "WXT_MEDIA_NEST_API_BASE_URL"
]
```

**변경안**:
```json
"env": [
  // 현재 활성: 신규 표준명
  "WXT_MYTUBE_EXTRACT_API_BASE_URL",
  "VITE_MYTUBE_EXTRACT_API_BASE_URL",
  "MYTUBE_EXTRACT_API_BASE_URL",
  
  // Fallback (2025 Q4 이전 지원, 이후 제거)
  "WXT_MEDIA_NEST_API_BASE_URL",
  "VITE_MEDIA_NEST_API_BASE_URL",
  "MEDIA_NEST_API_BASE_URL",
  
  // 개발 도구 설정 (레거시 - Phase 3에서 제거)
  "MEDIA_NEST_WXT_DEV_OUTPUT_ROOT",
  "MEDIA_NEST_WXT_DEV_PORT",
  "MEDIA_NEST_PREVIEW_PORT",
  "MEDIA_NEST_DEV_READY_TIMEOUT_MS",
  "MEDIA_NEST_DEV_READY_INTERVAL_MS",
  "MEDIA_NEST_DEV_OPEN_PREVIEW"
]
```

**우선순위**: 높음 (CI/CD 파이프라인에 영향)

---

### 작업 2: FSD 문서 마이그레이션 섹션 추가

**파일들**:
- `docs/web/current-implementation-fsd.md`
- `docs/chrome-extension/current-implementation-fsd.md`
- `docs/chrome-extension/current-implementation-prd.md`

**추가 내용** (각 문서의 "환경 변수" 섹션에 추가):

```markdown
### 레거시 환경변수 (폐기 예정)

다음 환경변수는 2025년 Q4까지만 지원되며, 이후 제거됩니다:
- `VITE_MEDIA_NEST_API_BASE_URL` → `VITE_MYTUBE_EXTRACT_API_BASE_URL`으로 이동
- `WXT_MEDIA_NEST_API_BASE_URL` → `WXT_MYTUBE_EXTRACT_API_BASE_URL`으로 이동
- `MEDIA_NEST_API_BASE_URL` → `MYTUBE_EXTRACT_API_BASE_URL`으로 이동

**마이그레이션 방법**:
1. 로컬 `.env` 또는 배포 인프라에서 환경변수 이름 변경
2. 신규 `MYTUBE_EXTRACT_*` 변수명 사용
3. 레거시 변수는 제거해도 fallback으로 자동 처리됨

**지원 종료 일정**:
- 2025 Q1-Q2: 신규 표준명 배포 및 호환성 유지
- 2025 Q3: 레거시 사용 경고 로그 추가
- 2025 Q4: 레거시 환경변수 제거
```

**우선순위**: 중간

---

### 작업 3: .env.example 정책 명시

**파일**: `apps/chrome-extension/.env.example`

**현황**:
```bash
WXT_MEDIA_NEST_API_BASE_URL=
```

**변경안**:
```bash
# 신규 표준 (권장)
WXT_MYTUBE_EXTRACT_API_BASE_URL=

# 레거시 (2025 Q4 폐기 예정)
# WXT_MEDIA_NEST_API_BASE_URL=
```

**우선순위**: 낮음

---

### 작업 4: README.md 마이그레이션 섹션 추가

**파일**: `README.md`

**추가 내용** (환경변수 섹션 뒤에 추가):

```markdown
## 레거시 환경변수 마이그레이션

프로젝트가 `media-nest`에서 `mytube-extract`로 이름 변경되면서, 
환경변수도 다음과 같이 표준화되었습니다:

| 레거시 (폐기 예정) | 신규 표준 | 지원 종료 |
|---|---|---|
| `VITE_MEDIA_NEST_API_BASE_URL` | `VITE_MYTUBE_EXTRACT_API_BASE_URL` | 2025 Q4 |
| `WXT_MEDIA_NEST_API_BASE_URL` | `WXT_MYTUBE_EXTRACT_API_BASE_URL` | 2025 Q4 |
| `MEDIA_NEST_API_BASE_URL` | `MYTUBE_EXTRACT_API_BASE_URL` | 2025 Q4 |

**프로덕션 도메인은 변경되지 않습니다**: `https://media-nest.codeliners.cc`

더 자세한 내용은 [마이그레이션 계획](./docs/MIGRATION_PLAN_media-nest-to-mytube.md)을 참고하세요.
```

**우선순위**: 낮음

---

## ⚫ Phase 3: 레거시 환경변수 제거 (2025년 Q4, 높은 리스크)

**조건**: Phase 2 완료 후 최소 1분기(3개월) 경과 후 진행  
**전제**: Phase 1 도메인 변경 + 프로덕션 배포 성공

### 제거 대상

```
높은 영향도:
- turbo.json의 MEDIA_NEST_* 환경변수 정의
- apps/chrome-extension/wxt.config.ts의 fallback 로직
- apps/chrome-extension/tools/*.js의 레거시 변수 처리
- apps/web/src/vite-env.d.ts의 VITE_MEDIA_NEST_*

중간 영향도:
- .env.example의 주석 처리된 레거시 변수
- 문서의 레거시 변수 언급 (이력 섹션 제외)

낮은 영향도:
- 테스트 파일의 mock 상수 (도메인 제외)
```

### 사전 검증

```bash
# Phase 3 실행 전 확인 사항:
1. $ grep -r "MEDIA_NEST" .               # 모든 참조 확인
2. 배포 파이프라인 (CI/CD)에서 레거시 환경변수 사용 여부 확인
3. 개발자 로컬 설정 (.env) 마이그레이션 안내
4. 프로덕션 배포 인프라 환경변수 마이그레이션 완료
5. 최소 1분기간 레거시 호환성 테스트
```

### 제거 순서 (낮은 의존도부터)

1. **테스트 mock 정리** (1-2시간)
   - `apps/chrome-extension/tests/**/*` 레거시 변수 정리

2. **타입 정의 정리** (1-2시간)
   - `apps/web/src/vite-env.d.ts` 레거시 타입 제거
   - `apps/chrome-extension/src/shared/constants.ts` 정리

3. **설정 파일 정리** (3-4시간)
   - `turbo.json` 레거시 변수 제거
   - `apps/chrome-extension/.env.example` 정리

4. **소스 코드 정리** (4-6시간)
   - `apps/chrome-extension/wxt.config.ts` fallback 로직 제거
   - `apps/chrome-extension/tools/*.js` 간소화
   - `apps/web/src` 레거시 변수 참조 제거

5. **문서 정리** (1-2시간)
   - 마이그레이션 섹션 "완료" 표시
   - 레거시 변수 모든 언급 제거

### 완료 기준

- [ ] `grep -r "MEDIA_NEST"` 실행 시 도메인 제외하고 결과 0개
- [ ] 모든 테스트 통과 (`pnpm test`)
- [ ] 로컬 dev 동작 확인 (`pnpm dev`)
- [ ] 프로덕션 배포 성공 및 모니터링 24시간

---

## 📋 체크리스트 및 타임라인

### Phase 1: 프로덕션 도메인 변경 🔴 긴급

**예상 소요 시간**: 2-3시간 (변경) + 2-4시간 (테스트 및 배포)

- [x] `.claude/settings.json` 생성 및 프로젝트명 설정
  
- [ ] **소스 코드 변경** (45분) - 프로덕션 영향도 높음
  - `apps/web/src/api/mytube-extract.api.ts`
  - `apps/chrome-extension/wxt.config.ts`
  - `apps/chrome-extension/src/shared/constants.ts`
  - `apps/chrome-extension/tools/verify-extension-package.js`
  
- [ ] **문서 변경** (30분) - 설정 혼동 방지
  - `README.md` (3곳)
  - `docs/web/current-implementation-fsd.md`
  - `docs/chrome-extension/current-implementation-fsd.md` (2곳)
  - `docs/chrome-extension/current-implementation-prd.md`
  
- [ ] **테스트 변경** (30분) - 간접 영향
  - `apps/chrome-extension/tests/unit/download-url.test.ts` (2곳)
  - `apps/chrome-extension/tests/integration/popup-download-model.test.ts` (4곳)
  - `apps/chrome-extension/tests/manifest/wxt-config.test.ts` (3곳)
  - `apps/chrome-extension/tests/browser/popup-smoke.mjs` (1곳)

- [ ] **검증** (2-4시간)
  - 전체 테스트 통과 (`pnpm test`)
  - 로컬 dev 동작 (`pnpm dev`)
  - 스테이징 배포 및 API 호출 검증
  - 프로덕션 배포 및 모니터링 (24시간)

### Phase 2: 레거시 환경변수 정리 ⏳ Phase 1 완료 후

**예상 소요 시간**: 4-6시간

- [ ] **작업 1**: turbo.json 정책 명시 (30분)
  - 파일: `/turbo.json`
  - 상태: Phase 1 완료 후
  
- [ ] **작업 2**: FSD/PRD 문서 마이그레이션 섹션 (1시간)
  - 파일: 3개 (web, chrome-extension FSD/PRD)
  - 상태: Phase 1 완료 후
  
- [ ] **작업 3**: .env.example 정책 명시 (15분)
  - 파일: `apps/chrome-extension/.env.example`
  - 상태: Phase 1 완료 후
  
- [ ] **작업 4**: README.md 마이그레이션 섹션 (20분)
  - 파일: `/README.md` (도메인 변경 후)
  - 상태: Phase 1 완료 후

- [ ] **검증**: 모든 파일 검토 및 팀 승인 (1-2시간)

### Phase 3: 레거시 환경변수 제거 📅 2025년 Q4

**예상 소요 시간**: 8-12시간

**사전 조건**:
- [ ] Phase 2 완료 및 배포
- [ ] 최소 3개월 호환성 기간 경과
- [ ] 팀 전체 합의
- [ ] 배포 인프라 마이그레이션 완료

---

## 📊 영향도 분석

### 높은 영향도 (운영 중단 가능)

| 항목 | 현황 | 리스크 | 대응책 |
|---|---|---|---|
| **프로덕션 API 주소** | 구 도메인 `media-nest.codeliners.cc` | 🔴 매우 높음 | **Phase 1 긴급**: 29개 참조 모두 변경 후 배포 |
| 클라이언트 API 호출 | 코드 상수로 하드코딩됨 | 높음 | 소스 코드 4개 파일 즉시 변경 |
| 스테이징/프로덕션 배포 | 환경별 다른 도메인 필요 | 높음 | 배포 후 24시간 모니터링 필수 |

### 중간 영향도 (개발 및 테스트)

| 항목 | 현황 | 리스크 | 대응책 |
|---|---|---|---|
| 문서 정확성 | 구 도메인 기재 | 중간 | 문서 8개 파일 변경 (개발자 혼동 방지) |
| 테스트 모의 서버 | 구 도메인 mock | 중간 | 테스트 5개 파일 변경 (테스트 실패 방지) |
| CI/CD 파이프라인 | `MEDIA_NEST_*` 환경변수 | 중간 | Phase 2에서 호환성 유지 후 Phase 3에서 제거 |

### 낮은 영향도

| 항목 | 현황 | 리스크 | 대응책 |
|---|---|---|---|
| 레거시 환경변수 | 폐기되지 않음 | 낮음 | Phase 2-3에서 단계적 정리 |

---

## 📚 참고 자료

### 현재 환경변수 사용 현황

```bash
# 검색 결과 요약:
grep -r "MEDIA_NEST" 2>/dev/null | wc -l
# → 약 50+ 참조

# 카테고리별 분류:
# 1. 프로덕션 도메인: media-nest.codeliners.cc (유지)
# 2. 환경변수: MEDIA_NEST_*, WXT_MEDIA_NEST_* (정리 필요)
# 3. 문서: 레거시 참조 (명확화 필요)
```

### 관련 파일 목록

**급우선** (프로덕션 영향):
- `/turbo.json`
- `apps/chrome-extension/wxt.config.ts`
- `apps/web/src/api/mytube-extract.api.ts`

**중간 우선** (개발자 경험):
- `docs/` (모든 FSD/PRD)
- `apps/chrome-extension/.env.example`
- `/README.md`

**낮은 우선** (내부 정리):
- 테스트 파일들
- 타입 정의 파일들

---

## 💬 리뷰 및 피드백

이 마이그레이션 계획은 다음을 고려하여 수립되었습니다:

1. **프로덕션 안정성**: 도메인 불변, 호환성 유지 기간 설정
2. **개발자 경험**: 명확한 마이그레이션 패스, 단계적 진행
3. **인프라 영향도**: CI/CD, 배포 파이프라인 최소 영향

**팀 검토 및 승인 필요 여부**: Yes (Phase 3 실행 전 필수)

---

## 🚨 사전 점검 사항

**Phase 1 실행 전 필수 확인**:

- [ ] 신 도메인 `https://mytube-extract-api.codeliners.cc`이 실제로 프로덕션에서 작동 중인가?
- [ ] API 서버가 신 도메인으로 완전히 마이그레이션되었는가?
- [ ] DNS 및 인증서가 신 도메인에 올바르게 설정되었는가?
- [ ] CORS 설정이 신 도메인을 허용하는가?

**배포 체크리스트**:

- [ ] 로컬 dev에서 신 도메인 API 호출 성공 확인
- [ ] 모든 테스트 통과
- [ ] 스테이징 환경에서 전체 기능 테스트
- [ ] 프로덕션 배포 후 모니터링 계획 수립
- [ ] Rollback 계획 준비

---

**마지막 업데이트**: 2026년 8월 9일 (수정)  
**상태**: 활성 (Phase 1 긴급, Phase 2-3 준비)
