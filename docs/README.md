# AEDpics 문서 허브

AEDpics의 전체 문서를 안내합니다.

최종 업데이트: 2025-11-01

> **중요**: 2025-10-25~28에 Supabase에서 NCP PostgreSQL + Prisma로 완전히 전환 완료
> 레거시 문서는 archive/ 폴더로 이동되었습니다.

---

## 빠른 시작

### 처음 시작하는 경우
1. [README.md](../README.md) - 프로젝트 전체 개요
2. [CLAUDE.md](../CLAUDE.md) - AI 개발 가이드라인 (필수)
3. [시작하기.md](./시작하기.md) - 상세 시작 가이드

### 현재 상태 확인
1. [migration/MIGRATION_STATUS.md](./migration/MIGRATION_STATUS.md) - 마이그레이션 현황
2. [current/current-status.md](./current/current-status.md) - 프로젝트 현황

---

## 문서 구조

```
docs/
├── README.md (이 문서 - 문서 허브)
├── 시작하기.md (상세 시작 가이드)
├── DOCUMENTATION_CLEANUP_PLAN.md (문서 정리 계획)
│
├── guides/ (실무 가이드)
│   ├── PERFORMANCE_OPTIMIZATION.md (성능 최적화)
│   ├── IMAGE_OPTIMIZATION_STRATEGY.md (이미지 최적화)
│   ├── AED_DATA_IMPORT_GUIDE.md (AED 데이터 import)
│   ├── DAILY_REFRESH_OPTIMIZATION.md
│   └── ... (기타 가이드)
│
├── deployment/ (배포)
│   ├── NCP_SERVER_SETUP.md (NCP 서버 설정)
│   ├── DEPLOYMENT.md (배포 절차)
│   ├── CICD_SETUP.md (CI/CD)
│   ├── GITHUB_SECRETS_SETUP.md
│   ├── MONITORING_GUIDE.md
│   └── BACKUP_GUIDE.md
│
├── migration/ (NCP 마이그레이션)
│   ├── MIGRATION_STATUS.md (현황)
│   └── NCP_마이그레이션_완전가이드.md (완전 가이드)
│
├── reference/ (참조 문서)
│   ├── architecture-overview.md (아키텍처)
│   ├── REGION_CODE_GUIDELINES.md (지역 코드)
│   ├── SECURITY_GUIDELINES.md (보안)
│   └── aed-data-schema.md (데이터 스키마)
│
├── troubleshooting/ (문제 해결)
│   ├── EMAIL_DEBUGGING_CHECKLIST.md
│   └── EMAIL_SENDING_ISSUE_RESOLUTION.md
│
├── security/ (보안)
│   └── aed-data-access-rules.md
│
├── testing/
│   └── EMAIL_AUTHENTICATION_TEST_PLAN.md
│
├── current/ (현재 상태)
│   ├── current-status.md
│   ├── inspection-architecture.md
│   └── technical-debt.md
│
└── archive/ (아카이브 - 읽기 전용)
    ├── migration/ (완료된 마이그레이션 문서)
    ├── performance/ (성능 최적화 보고서)
    ├── reports/ (세션별 보고서)
    └── ... (기타 레거시 문서)
```

---

## 핵심 문서

### 1. 마이그레이션 (NCP 전환)

**현재 상태**: Phase 4 완료 (2025-10-28)
- 인프라 구축 ✅
- 데이터 마이그레이션 ✅ (81,464개 AED)
- NextAuth 전환 ✅
- Prisma API 변환 ✅
- 프로덕션 배포 ✅ (https://aed.pics)

**주요 문서**:
- [MIGRATION_STATUS.md](./migration/MIGRATION_STATUS.md) - 전체 현황
- [NCP_마이그레이션_완전가이드.md](./migration/NCP_마이그레이션_완전가이드.md) - 완전 가이드

**완료 문서**: [archive/migration/](./archive/migration/)

---

### 2. 배포 및 운영

**프로덕션 정보**:
- URL: https://aed.pics
- 서버: NCP (223.130.150.133)
- 데이터베이스: NCP PostgreSQL
- 프로세스 관리: PM2 (cluster mode, zero-downtime)

**주요 문서**:
- [NCP_SERVER_SETUP.md](./deployment/NCP_SERVER_SETUP.md) - 서버 설정
- [DEPLOYMENT.md](./deployment/DEPLOYMENT.md) - 배포 절차
- [CICD_SETUP.md](./deployment/CICD_SETUP.md) - CI/CD
- [GITHUB_SECRETS_SETUP.md](./deployment/GITHUB_SECRETS_SETUP.md) - GitHub Secrets
- [MONITORING_GUIDE.md](./deployment/MONITORING_GUIDE.md) - 모니터링
- [BACKUP_GUIDE.md](./deployment/BACKUP_GUIDE.md) - 백업

---

### 3. 실무 가이드

**성능 최적화**:
- [PERFORMANCE_OPTIMIZATION.md](./guides/PERFORMANCE_OPTIMIZATION.md) - 종합 가이드
- [IMAGE_OPTIMIZATION_STRATEGY.md](./guides/IMAGE_OPTIMIZATION_STRATEGY.md) - 이미지 최적화

**데이터 관리**:
- [AED_DATA_IMPORT_GUIDE.md](./guides/AED_DATA_IMPORT_GUIDE.md) - AED 데이터 import
- [CSV_STRUCTURE_ANALYSIS.md](./CSV_STRUCTURE_ANALYSIS.md) - CSV 구조

**기타 가이드**:
- [guides/](./guides/) - 전체 가이드 목록

---

### 4. 참조 문서

**시스템 아키텍처**:
- [architecture-overview.md](./reference/architecture-overview.md) - 전체 아키텍처
- [REGION_CODE_GUIDELINES.md](./reference/REGION_CODE_GUIDELINES.md) - 지역 코드 체계
- [aed-data-schema.md](./reference/aed-data-schema.md) - 데이터 스키마

**보안**:
- [SECURITY_GUIDELINES.md](./reference/SECURITY_GUIDELINES.md) - 보안 가이드라인
- [aed-data-access-rules.md](./security/aed-data-access-rules.md) - 접근 규칙

---

### 5. 문제 해결

**이메일 발송 문제**:
- [EMAIL_DEBUGGING_CHECKLIST.md](./troubleshooting/EMAIL_DEBUGGING_CHECKLIST.md) - 디버깅 체크리스트
- [EMAIL_SENDING_ISSUE_RESOLUTION.md](./troubleshooting/EMAIL_SENDING_ISSUE_RESOLUTION.md) - 전체 해결 과정

**기타 문제**:
- [troubleshooting/](./troubleshooting/) - 전체 문제 해결 가이드

---

## 상황별 문서 찾기

### 프로젝트 시작
1. [시작하기.md](./시작하기.md)
2. [README.md](../README.md)
3. [CLAUDE.md](../CLAUDE.md)

### NCP 마이그레이션 이해
1. [migration/MIGRATION_STATUS.md](./migration/MIGRATION_STATUS.md)
2. [migration/NCP_마이그레이션_완전가이드.md](./migration/NCP_마이그레이션_완전가이드.md)

### 배포 및 운영
1. [deployment/NCP_SERVER_SETUP.md](./deployment/NCP_SERVER_SETUP.md)
2. [deployment/DEPLOYMENT.md](./deployment/DEPLOYMENT.md)
3. [deployment/CICD_SETUP.md](./deployment/CICD_SETUP.md)

### 성능 최적화
1. [guides/PERFORMANCE_OPTIMIZATION.md](./guides/PERFORMANCE_OPTIMIZATION.md)
2. [guides/IMAGE_OPTIMIZATION_STRATEGY.md](./guides/IMAGE_OPTIMIZATION_STRATEGY.md)

### AED 데이터 작업
1. [guides/AED_DATA_IMPORT_GUIDE.md](./guides/AED_DATA_IMPORT_GUIDE.md)
2. [CSV_STRUCTURE_ANALYSIS.md](./CSV_STRUCTURE_ANALYSIS.md)
3. [reference/aed-data-schema.md](./reference/aed-data-schema.md)

### 보안 및 권한
1. [reference/SECURITY_GUIDELINES.md](./reference/SECURITY_GUIDELINES.md)
2. [security/aed-data-access-rules.md](./security/aed-data-access-rules.md)
3. [CLAUDE.md](../CLAUDE.md) - 권한 체계 (1-1절)

### 문제 해결
1. [troubleshooting/EMAIL_DEBUGGING_CHECKLIST.md](./troubleshooting/EMAIL_DEBUGGING_CHECKLIST.md)
2. [troubleshooting/](./troubleshooting/)

---

## 문서 관리 정책

### Archive 폴더 사용
완료된 작업 보고서, 레거시 문서는 archive/로 이동:
- `archive/migration/` - 완료된 마이그레이션 문서
- `archive/performance/` - 성능 최적화 보고서
- `archive/reports/` - 세션별 보고서
- `archive/` - 기타 레거시 문서

### 업데이트 규칙
1. **migration/**: 마이그레이션 진행 시 업데이트
2. **guides/**: 새로운 가이드 추가 또는 기존 가이드 개선
3. **reference/**: 시스템 구조 변경 시 업데이트
4. **current/**: 기능 완료 시 즉시 업데이트
5. **archive/**: 읽기 전용, 수정 금지

### 문서 라이프사이클
```
guides/ → (작업 완료) → archive/
보고서 → (작성 완료) → archive/reports/
마이그레이션 → (완료) → archive/migration/
```

---

## NCP 마이그레이션 영향

### 변경된 부분
- 데이터베이스: Supabase → NCP PostgreSQL
- ORM: Supabase SDK → Prisma
- 인증: Supabase Auth → NextAuth.js
- 배포: Vercel → NCP
- 이메일: Resend → NCP Cloud Outbound Mailer
- 스토리지: Supabase Storage → NCP Object Storage (진행 중)

### 레거시 문서 위치
- Supabase 관련: [archive/migration/COMPLETE/](./archive/migration/COMPLETE/)
- 성능 최적화 보고서: [archive/performance/](./archive/performance/)
- 세션 보고서: [archive/reports/](./archive/reports/)

### 현재 참조 문서
- Prisma 스키마: [../prisma/schema.prisma](../prisma/schema.prisma)
- 마이그레이션 현황: [migration/MIGRATION_STATUS.md](./migration/MIGRATION_STATUS.md)

---

## 주요 업데이트 히스토리

- **2025-11-01**: 문서 대규모 정리 (174개 → 약 50개)
- **2025-10-28**: 프로덕션 배포 완료, 이미지 최적화 전략 수립
- **2025-10-26**: NCP 마이그레이션 완료, 배포 준비
- **2025-10-25**: NextAuth 전환, Prisma API 변환

---

## 외부 링크

- **프로젝트 루트**: [../README.md](../README.md)
- **개발 가이드라인**: [../CLAUDE.md](../CLAUDE.md)
- **Prisma 스키마**: [../prisma/schema.prisma](../prisma/schema.prisma)

---

**관리**: AEDpics 개발팀
**문의**: [CLAUDE.md 연락처 참조](../CLAUDE.md#연락처-정보)
**최종 업데이트**: 2025-11-01
**문서 버전**: 4.0 (문서 대규모 정리 반영)
