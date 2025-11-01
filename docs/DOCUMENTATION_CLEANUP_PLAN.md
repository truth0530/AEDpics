# 프로젝트 문서 정리 계획

**목표**: 문서를 심플하게 관리하면서 중요한 교훈 보존

**작성일**: 2025-11-01

---

## 1. 루트 디렉토리 정리

### 삭제할 파일
```
CLAUDE.md.backup
CLAUDE.md.backup2
CLAUDE.md.backup3
CLAUDE.md.backup4
package.json.backup-20251029-210744
.eslintrc.json (eslint.config.mjs로 마이그레이션 완료)
ecosystem.config.cjs (ecosystem.config.js로 통합)
tsconfig.tsbuildinfo (.gitignore 추가 필요)
```

**사유**:
- 백업 파일은 Git 히스토리에 이미 존재
- .eslintrc.json은 Flat Config로 마이그레이션됨
- ecosystem.config.js가 더 최신 버전 (Zero-Downtime 설정 포함)

### 유지할 루트 파일
```
README.md (프로젝트 개요)
CLAUDE.md (AI 개발 가이드라인)
.env.example (환경변수 템플릿)
.gitignore
package.json
next.config.ts
tsconfig.json
eslint.config.mjs
tailwind.config.ts
postcss.config.mjs
middleware.ts
ecosystem.config.js (프로덕션 배포)
```

---

## 2. 문서 통합 계획

### A. 성능 최적화 문서 통합

**통합 대상**:
```
docs/PERFORMANCE_OPTIMIZATION_GUIDE.md (마스터)
docs/PERFORMANCE_OPTIMIZATION_STEP1_QUALITY_REPORT.md → 통합 후 삭제
docs/PERFORMANCE_OPTIMIZATION_STEP3_QUALITY_REPORT.md → 통합 후 삭제
docs/PERFORMANCE_OPTIMIZATION_STEP4_QUALITY_REPORT.md → 통합 후 삭제
docs/PERFORMANCE_OPTIMIZATION_VERIFICATION_REPORT.md → 통합 후 삭제
docs/STEP1_QUALITY_REPORT.md → 통합 후 삭제
docs/planning/PERFORMANCE_OPTIMIZATION_MASTER.md → 통합
docs/planning/ADVANCED_OPTIMIZATION_ROADMAP.md → 통합
```

**통합 후 최종 문서**:
- `docs/guides/PERFORMANCE_OPTIMIZATION.md` (종합 가이드)

**보존할 교훈**:
- 단계별 최적화 전략
- 성능 측정 방법론
- 실패한 시도와 이유
- 성공한 최적화 기법

---

### B. 배포 문서 통합

**통합 대상**:
```
docs/PRODUCTION_DEPLOYMENT_GUIDE.md
docs/deployment/DEPLOYMENT.md
docs/deployment/NCP_PRODUCTION_SETUP.md
docs/deployment/NCP_SERVER_SETUP.md (마스터)
docs/deployment/PRODUCTION_DEPLOYMENT_STATUS.md
docs/deployment/SERVER_SETUP_SESSION_20251027.md → archive
docs/migration/NCP_DEPLOYMENT_GUIDE.md
```

**통합 후 최종 문서**:
- `docs/deployment/NCP_SERVER_SETUP.md` (상세 서버 설정)
- `docs/deployment/DEPLOYMENT.md` (배포 절차)
- `docs/deployment/GITHUB_SECRETS_SETUP.md` (유지)
- `docs/deployment/CICD_SETUP.md` (유지)
- `docs/deployment/MONITORING_GUIDE.md` (유지)
- `docs/deployment/BACKUP_GUIDE.md` (유지)

**삭제**:
- `docs/PRODUCTION_DEPLOYMENT_GUIDE.md` (중복)

---

### C. README/INDEX 정리

**삭제할 중복 INDEX**:
```
docs/INDEX.md → 통합 후 삭제
planning/INDEX.md → 통합 후 삭제
migration/INDEX.md → 통합 후 삭제
```

**유지할 README**:
```
README.md (루트 - 프로젝트 메인)
docs/README.md (문서 허브)
docs/archive/reports/README.md (아카이브 가이드)
docs/reference/COMPLETE/README.md (완료 마이그레이션)
docs/planning/COMPLETE/README.md (완료 계획)
docs/migration/COMPLETE/README.md (완료 마이그레이션)
```

**통합 후 최종 구조**:
- `README.md`: 프로젝트 개요, 빠른 시작
- `docs/README.md`: 전체 문서 맵 (INDEX 내용 통합)
- `docs/시작하기.md`: 상세 시작 가이드

---

### D. 현재 상태 문서 통합

**통합 대상**:
```
docs/current/current-status.md (마스터)
docs/NEXT_STEPS_PRIORITY.md → 통합
```

**삭제**:
```
docs/archive/PROJECT_STATUS.md (구버전)
docs/archive/TODAY_SUMMARY.md (구버전)
```

**최종 문서**:
- `docs/current/current-status.md`: 현재 프로젝트 상태
- `docs/migration/MIGRATION_STATUS.md`: 마이그레이션 상태

---

### E. 마이그레이션 문서 정리

**유지 (핵심 문서)**:
```
docs/migration/MIGRATION_STATUS.md (현재 상태)
docs/migration/NCP_마이그레이션_완전가이드.md (완전 가이드)
docs/migration/COMPLETE/README.md (완료 요약)
```

**archive로 이동**:
```
docs/migration/COMPLETE/* (나머지 모든 파일)
→ docs/archive/migration/COMPLETE/*
```

**사유**: 마이그레이션 완료된 세부 단계는 참조용으로만 필요

---

### F. 중복 기능 가이드 정리

**통합 대상**:
```
docs/ACT_LOCAL_TESTING_GUIDE.md
docs/GITHUB_ACTIONS_OPTIMIZATION.md
docs/GITHUB_ACTIONS_FAILURE_ANALYSIS.md → 통합 후 삭제
```

**최종 문서**:
- `docs/deployment/CICD_SETUP.md`: CI/CD 전체 가이드
- `docs/deployment/GITHUB_ACTIONS.md`: GitHub Actions 상세

---

### G. TypeScript 오류 관련 문서

**삭제**:
```
docs/TYPESCRIPT_ERROR_PRIORITY_PLAN.md (이미 해결됨)
```

**사유**: 문제 해결 완료, 교훈은 troubleshooting에 통합

---

## 3. 디렉토리 구조 재구성

### 현재 구조
```
docs/
├── [루트 레벨 문서 37개] ← 너무 많음
├── analysis/
├── archive/
├── current/
├── deployment/
├── guides/
├── migration/
├── planning/
├── reference/
├── security/
├── setup/
├── testing/
└── troubleshooting/
```

### 목표 구조
```
docs/
├── README.md (문서 허브)
├── 시작하기.md (빠른 시작)
├── guides/ (실무 가이드)
│   ├── PERFORMANCE_OPTIMIZATION.md (통합)
│   ├── AED_DATA_IMPORT_GUIDE.md
│   ├── IMAGE_OPTIMIZATION_STRATEGY.md
│   └── ... (실제 사용하는 가이드만)
├── deployment/ (배포)
│   ├── NCP_SERVER_SETUP.md (마스터)
│   ├── DEPLOYMENT.md
│   ├── CICD_SETUP.md
│   ├── GITHUB_SECRETS_SETUP.md
│   ├── MONITORING_GUIDE.md
│   └── BACKUP_GUIDE.md
├── migration/ (마이그레이션)
│   ├── MIGRATION_STATUS.md
│   └── NCP_마이그레이션_완전가이드.md
├── reference/ (참조)
│   ├── architecture-overview.md
│   ├── REGION_CODE_GUIDELINES.md
│   ├── SECURITY_GUIDELINES.md
│   └── aed-data-schema.md
├── troubleshooting/ (문제 해결)
│   ├── EMAIL_DEBUGGING_CHECKLIST.md
│   ├── EMAIL_SENDING_ISSUE_RESOLUTION.md
│   └── ... (실제 문제 해결 경험)
├── security/ (보안)
│   └── aed-data-access-rules.md
├── testing/
│   └── EMAIL_AUTHENTICATION_TEST_PLAN.md
└── archive/ (보관)
    ├── migration/ (완료된 마이그레이션 세부 문서)
    ├── planning/ (완료된 계획)
    ├── analysis/ (과거 분석)
    └── reports/ (세션별 보고서)
```

---

## 4. 보존할 중요한 교훈

### A. 이메일 발송 문제
**위치**: `docs/troubleshooting/EMAIL_SENDING_ISSUE_RESOLUTION.md`

**핵심 교훈**:
1. `noreply@nmc.or.kr`가 실패하면 **인증 문제가 아님**
2. 환경변수 확인이 최우선
3. 개인 이메일 사용 금지
4. DMARC/SPF 임의 변경 금지

**보존 방법**: CLAUDE.md에 이미 통합됨

---

### B. 권한 체계
**위치**: `docs/security/aed-data-access-rules.md`

**핵심 교훈**:
1. 전국 권한 vs 시도 권한 vs 시군구 권한
2. 이원화된 지역 관리 (주소 vs 관할보건소)
3. KR(중앙)은 데이터 없음

**보존 방법**: CLAUDE.md에 이미 통합됨

---

### C. 성능 최적화 실패 사례
**위치**: 각 QUALITY_REPORT

**핵심 교훈**:
1. 무한 스크롤 실패 이유 (데이터 정합성)
2. 클라이언트 캐싱 실패 이유 (메모리)
3. 성공한 최적화: useMemo, useCallback, 서버 캐싱

**보존 방법**: 통합 문서에 "실패 사례" 섹션 추가

---

### D. GitHub Actions 최적화
**위치**: `docs/GITHUB_ACTIONS_OPTIMIZATION.md`

**핵심 교훈**:
1. 캐싱 전략 (dependencies, Next.js build)
2. 병렬 실행
3. 조건부 실행

**보존 방법**: deployment/CICD_SETUP.md에 통합

---

## 5. 실행 순서

1. **루트 파일 정리** (백업 파일 삭제)
2. **문서 통합** (중복 제거)
3. **archive 이동** (완료된 문서)
4. **README/INDEX 통합**
5. **CLAUDE.md 업데이트** (문서 목차 갱신)
6. **최종 검증** (링크 확인)

---

## 6. 예상 효과

**현재 상태**:
- 루트 레벨 문서: 37개
- 총 마크다운 파일: 174개
- docs 디렉토리: 13개

**목표 상태**:
- 루트 레벨 문서: 2개 (README.md, 시작하기.md)
- 총 마크다운 파일: 약 50개 (70% 감소)
- docs 디렉토리: 7개 (핵심만 유지)

**기대 효과**:
1. 문서 찾기 쉬움
2. 중복 정보 제거
3. 유지보수 부담 감소
4. 중요한 교훈은 보존

---

## 7. 안전 장치

1. **Git 히스토리 보존**: 모든 삭제는 Git에 기록됨
2. **archive 활용**: 즉시 삭제 대신 archive로 이동
3. **단계별 커밋**: 각 통합 작업마다 커밋
4. **링크 검증**: 통합 후 모든 내부 링크 확인

---

## 다음 단계

**승인 대기 중**: 이 계획을 검토하고 승인해주시면 실행하겠습니다.

**예상 소요 시간**: 1-2시간
