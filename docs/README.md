# AEDpics 문서

AEDpics의 전체 문서 구조를 안내합니다.

최종 업데이트: 2025-10-26

> **중요 변경사항**: 2025-10-25~10-26에 Supabase에서 NCP PostgreSQL + Prisma로 완전히 전환되었습니다.
> 일부 레거시 문서는 COMPLETE 폴더로 이동되었습니다.

---

## 빠른 시작

### 처음 시작하는 경우
1. [README.md](../README.md) - 프로젝트 전체 개요
2. [CLAUDE.md](../CLAUDE.md) - AI 개발 가이드라인
3. [시작하기.md](./시작하기.md) - 상세 시작 가이드

### NCP 마이그레이션 확인
1. [migration/MIGRATION_STATUS.md](./migration/MIGRATION_STATUS.md) - 마이그레이션 현황
2. [migration/NCP_마이그레이션_완전가이드.md](./migration/NCP_마이그레이션_완전가이드.md) - 전체 가이드

### 다음 단계 확인
- [NEXT_STEPS_PRIORITY.md](./NEXT_STEPS_PRIORITY.md) - 우선순위 작업 목록

---

## 문서 구조

```
docs/
├── README.md (이 문서)
├── INDEX.md (전체 문서 인덱스 - 권장)
├── 시작하기.md (시작 가이드)
├── NEXT_STEPS_PRIORITY.md (다음 작업)
├── AED_DATA_IMPORT_GUIDE.md (AED 데이터 import)
├── CSV_STRUCTURE_ANALYSIS.md (CSV 구조 분석)
│
├── migration/ (NCP 마이그레이션)
│   ├── INDEX.md
│   ├── MIGRATION_STATUS.md (메인)
│   ├── NCP_마이그레이션_완전가이드.md
│   └── COMPLETE/ (완료 문서)
│
├── planning/ (개선 계획)
│   ├── INDEX.md
│   ├── README.md
│   ├── PERFORMANCE_OPTIMIZATION_MASTER.md (메인)
│   └── COMPLETE/ (완료 작업)
│
├── reference/ (참조 문서)
│   ├── ARCHITECTURE_OVERVIEW.md
│   ├── REGION_CODE_GUIDELINES.md
│   ├── SECURITY_GUIDELINES.md
│   └── COMPLETE/ (레거시 문서)
│
├── guides/ (기능 가이드)
├── current/ (현재 상태)
├── setup/ (초기 설정)
├── security/ (보안 정책)
├── analysis/ (분석)
├── troubleshooting/ (문제 해결)
└── archive/ (아카이브)
    └── reports/ (완료 보고서)
```

---

## 핵심 폴더

### 1. migration/ - NCP 마이그레이션

**용도**: Supabase → NCP PostgreSQL 마이그레이션 전체 과정

**주요 문서**:
- [MIGRATION_STATUS.md](./migration/MIGRATION_STATUS.md) - 전체 현황 (메인)
- [NCP_마이그레이션_완전가이드.md](./migration/NCP_마이그레이션_완전가이드.md) - 완전 가이드
- [NCP_DEPLOYMENT_GUIDE.md](./migration/NCP_DEPLOYMENT_GUIDE.md) - 배포 가이드
- [COMPLETE/](./migration/COMPLETE/) - 완료된 Phase 보고서

**현재 상태**: Phase 4.1 완료 (2025-10-26)
- 인프라 구축 ✅
- 데이터 마이그레이션 ✅
- NextAuth 전환 ✅
- Prisma API 변환 ✅
- 국정원 인증 요구사항 충족 ✅

자세한 내용: [migration/INDEX.md](./migration/INDEX.md)

---

### 2. planning/ - 개선 계획

**용도**: 성능 최적화, 시스템 개선 계획

**주요 문서**:
- [PERFORMANCE_OPTIMIZATION_MASTER.md](./planning/PERFORMANCE_OPTIMIZATION_MASTER.md) - 성능 최적화 마스터
- [LAYOUT_IMPROVEMENT_PLAN.md](./planning/LAYOUT_IMPROVEMENT_PLAN.md) - 레이아웃 개선
- [PAGINATION_OPTIMIZATION_2025.md](./planning/PAGINATION_OPTIMIZATION_2025.md) - 페이지네이션 최적화
- [COMPLETE/](./planning/COMPLETE/) - 완료된 작업 (Phase 0, Layout Stage 1 등)

**완료된 작업**:
- Phase 0: 커서 페이지네이션 (2025-10-17) ✅
- Layout Stage 1: 레이아웃 개선 (2025-10-17) ✅
- 필터링 시스템 개선 (2025-10-18) ✅
- 회원가입/승인 개선 (2025-10-03) ✅

자세한 내용: [planning/README.md](./planning/README.md) | [planning/INDEX.md](./planning/INDEX.md)

---

### 3. reference/ - 참조 문서

**용도**: 시스템 아키텍처, 가이드라인, 스키마 참조

**활성 문서**:
- [ARCHITECTURE_OVERVIEW.md](./reference/ARCHITECTURE_OVERVIEW.md) - 시스템 아키텍처
- [REGION_CODE_GUIDELINES.md](./reference/REGION_CODE_GUIDELINES.md) - 지역 코드 가이드
- [SECURITY_GUIDELINES.md](./reference/SECURITY_GUIDELINES.md) - 보안 가이드라인
- [QUICK_START.md](./reference/QUICK_START.md) - 빠른 시작
- [NCP_AUTH_STRATEGY.md](./reference/NCP_AUTH_STRATEGY.md) - NCP 인증 전략
- [aed-data-*.md](./reference/) - AED 데이터 관련 문서

**레거시 문서** (COMPLETE/):
- Supabase 스키마 참조
- Supabase 마이그레이션 가이드
- 프로젝트 재구조화 보고서

---

### 4. guides/ - 기능 가이드

**용도**: 기능별 How-to 가이드

- 기능 가이드 (features/)
- 데이터 품질 관리 (data-quality/)
- 문제 해결 (troubleshooting/)

---

### 5. current/ - 현재 상태

**용도**: 시스템 최신 상태 및 진행 현황

- current-status.md - 전체 프로젝트 현황
- inspection-architecture.md - 점검 시스템 아키텍처
- technical-debt.md - 기술 부채 현황
- deployment-checklist.md - 배포 체크리스트

---

### 6. setup/ - 초기 설정

**용도**: 프로젝트 초기 설정 가이드

- kakao-map-guide.md - 카카오맵 API
- seed-instructions.md - 초기 데이터

**주의**: vercel-deployment-guide.md는 레거시 (NCP로 전환)

---

### 7. security/ - 보안 정책

**용도**: 보안 정책 및 접근 규칙

- aed-data-security-plan.md - 데이터 보안 계획
- aed-data-access-rules.md - 접근 규칙
- ux-tradeoff-analysis.md - 보안/UX 트레이드오프

---

### 8. archive/ - 아카이브

**용도**: 완료되었거나 더 이상 사용하지 않는 문서

**경고**: 읽기 전용, 수정 금지

**구조**:
- reports/ - 완료된 작업 보고서 (전체 이동됨)
- README_OLD_SUPABASE.md - Supabase 시절 README
- 기타 레거시 문서

---

## 상황별 문서 찾기

### 프로젝트 시작
1. [시작하기.md](./시작하기.md) - 상세 시작 가이드
2. [README.md](../README.md) - 프로젝트 개요
3. [migration/MIGRATION_STATUS.md](./migration/MIGRATION_STATUS.md) - 현재 상태

### NCP 마이그레이션 이해
1. [migration/MIGRATION_STATUS.md](./migration/MIGRATION_STATUS.md) - 전체 현황
2. [migration/NCP_마이그레이션_완전가이드.md](./migration/NCP_마이그레이션_완전가이드.md) - 완전 가이드
3. [migration/COMPLETE/](./migration/COMPLETE/) - Phase별 완료 보고서

### 성능 최적화
1. [planning/PERFORMANCE_OPTIMIZATION_MASTER.md](./planning/PERFORMANCE_OPTIMIZATION_MASTER.md) - 마스터 문서
2. [planning/COMPLETE/](./planning/COMPLETE/) - 완료된 최적화
3. [planning/README.md](./planning/README.md) - 전체 계획 안내

### 시스템 이해
1. [reference/ARCHITECTURE_OVERVIEW.md](./reference/ARCHITECTURE_OVERVIEW.md) - 아키텍처
2. [reference/REGION_CODE_GUIDELINES.md](./reference/REGION_CODE_GUIDELINES.md) - 지역 코드
3. [current/current-status.md](./current/current-status.md) - 현재 상태

### AED 데이터 작업
1. [AED_DATA_IMPORT_GUIDE.md](./AED_DATA_IMPORT_GUIDE.md) - 데이터 import
2. [CSV_STRUCTURE_ANALYSIS.md](./CSV_STRUCTURE_ANALYSIS.md) - CSV 구조
3. [reference/aed-data-schema.md](./reference/aed-data-schema.md) - 스키마

### 기능 개발
1. [NEXT_STEPS_PRIORITY.md](./NEXT_STEPS_PRIORITY.md) - 우선순위
2. [current/current-status.md](./current/current-status.md) - 완료 기능
3. [guides/](./guides/) - 기능별 가이드

### 보안 및 권한
1. [reference/SECURITY_GUIDELINES.md](./reference/SECURITY_GUIDELINES.md) - 보안 가이드
2. [security/aed-data-access-rules.md](./security/aed-data-access-rules.md) - 접근 규칙
3. [CLAUDE.md](../CLAUDE.md) - 권한 체계 (1-1절)

---

## 문서 관리 정책

### COMPLETE 폴더 사용
완료된 작업 보고서, 분석 문서, 레거시 참조는 각 폴더의 COMPLETE/ 하위로 이동:
- migration/COMPLETE/ - 완료된 Phase 보고서
- planning/COMPLETE/ - 완료된 최적화 작업
- reference/COMPLETE/ - Supabase 레거시 문서

### 업데이트 규칙
1. **migration/**: 마이그레이션 진행 시 업데이트
2. **planning/**: 최적화 작업 완료 시 업데이트
3. **reference/**: 시스템 구조 변경 시 업데이트
4. **guides/**: 새로운 패턴 발견 시 추가
5. **current/**: 기능 완료 시 즉시 업데이트
6. **archive/**: 읽기 전용, 수정 금지

### 문서 라이프사이클
```
planning/ → (구현 완료) → planning/COMPLETE/
보고서 → 일회성 작성 → archive/reports/
레거시 → 참조 필요 → */COMPLETE/
레거시 → 참조 불필요 → archive/
```

---

## NCP 마이그레이션 영향

### 변경된 부분
- 데이터베이스: Supabase PostgreSQL → NCP PostgreSQL
- ORM: Supabase SDK → Prisma
- 인증: Supabase Auth → NextAuth.js
- 배포: Vercel → NCP (예정)

### 레거시 문서 위치
- Supabase 스키마: [reference/COMPLETE/SUPABASE_SCHEMA_COMPLETE.md](./reference/COMPLETE/SUPABASE_SCHEMA_COMPLETE.md)
- Supabase 마이그레이션: [reference/COMPLETE/MIGRATION_GUIDE.md](./reference/COMPLETE/MIGRATION_GUIDE.md)
- 구 README: [archive/README_OLD_SUPABASE.md](./archive/README_OLD_SUPABASE.md)

### 현재 참조 문서
- Prisma 스키마: [/prisma/schema.prisma](../prisma/schema.prisma)
- 마이그레이션 현황: [migration/MIGRATION_STATUS.md](./migration/MIGRATION_STATUS.md)
- NCP 가이드: [migration/NCP_마이그레이션_완전가이드.md](./migration/NCP_마이그레이션_완전가이드.md)

---

## 문서 통계 (2025-10-26)

### 전체 현황
- **migration 문서**: 19개 (6개 활성 + 13개 완료)
- **planning 문서**: 26개 (15개 활성 + 11개 완료)
- **reference 문서**: 14개 (8개 활성 + 6개 완료)
- **guides**: 약 15개
- **archive**: 약 20개

### 최근 주요 업데이트
- 2025-10-26: migration, planning COMPLETE 폴더 생성
- 2025-10-26: reference COMPLETE 폴더 생성
- 2025-10-26: reports 폴더 archive로 이동
- 2025-10-26: docs 루트 파일 정리
- 2025-10-25~26: NCP 마이그레이션 완료

---

## 빠른 참조

### 필수 문서 (최우선)
- [시작하기.md](./시작하기.md)
- [migration/MIGRATION_STATUS.md](./migration/MIGRATION_STATUS.md)
- [NEXT_STEPS_PRIORITY.md](./NEXT_STEPS_PRIORITY.md)

### 인덱스 문서
- [INDEX.md](./INDEX.md) - docs 전체 인덱스 (권장)
- [migration/INDEX.md](./migration/INDEX.md) - 마이그레이션 인덱스
- [planning/INDEX.md](./planning/INDEX.md) - 계획 인덱스

### README 문서
- [planning/README.md](./planning/README.md) - 계획 폴더 안내
- [migration/COMPLETE/README.md](./migration/COMPLETE/README.md) - 완료 마이그레이션
- [planning/COMPLETE/README.md](./planning/COMPLETE/README.md) - 완료 최적화
- [reference/COMPLETE/README.md](./reference/COMPLETE/README.md) - 레거시 참조

---

## 외부 링크

- **프로젝트 루트**: [../README.md](../README.md)
- **개발 가이드라인**: [../CLAUDE.md](../CLAUDE.md)
- **Prisma 스키마**: [../prisma/schema.prisma](../prisma/schema.prisma)

---

**관리**: AEDpics 개발팀
**문의**: [CLAUDE.md 연락처 참조](../CLAUDE.md#연락처-정보)
**최종 업데이트**: 2025-10-26
**문서 버전**: 3.0 (NCP 마이그레이션 반영)
