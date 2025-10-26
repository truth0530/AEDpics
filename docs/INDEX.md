# AEDpics 문서 전체 인덱스

모든 문서의 위치와 용도를 안내합니다.

최종 업데이트: 2025-10-26

---

## 📌 이 문서 관리 지침 (AI 개발자용)

### 업데이트 시점
다음 상황에서 **반드시** 이 INDEX.md를 업데이트하세요:

1. **새 문서 추가 시**
   - 해당 폴더 섹션에 문서 추가
   - 우선순위 표시 (⭐)
   - 간단한 설명 1줄

2. **문서 이동 시**
   - 이전 위치에서 제거
   - 새 위치에 추가
   - 경로 업데이트

3. **문서 삭제 또는 COMPLETE 이동 시**
   - 활성 문서 목록에서 제거
   - COMPLETE 섹션에 추가 (완료 문서인 경우)

4. **새 폴더 생성 시**
   - "문서 구조 개요"에 폴더 추가
   - 해당 폴더 섹션 신규 생성
   - README.md와 일관성 유지

5. **월 1회 정기 검토**
   - 문서 통계 업데이트
   - 깨진 링크 확인
   - 우선순위 재평가

### 업데이트 규칙

**DO (반드시 할 것)**:
- ✅ 새 문서는 즉시 추가
- ✅ 우선순위 ⭐ 정확히 표시 (5개 등급)
- ✅ 문서 설명은 1줄로 명확하게
- ✅ 링크 상대 경로 사용 (./폴더/파일.md)
- ✅ 최종 업데이트 날짜 갱신
- ✅ README.md와 일관성 유지

**DON'T (하지 말 것)**:
- ❌ 절대 경로 사용 금지
- ❌ 이모지 남용 금지 (📌 등 최소한만)
- ❌ 주관적 평가 금지 ("좋은 문서", "추천" 등)
- ❌ 완료 문서를 활성 목록에 유지
- ❌ 링크 없이 파일명만 나열

### 문서 우선순위 기준

- ⭐⭐⭐⭐⭐ 최우선 - 프로젝트 시작 시 필수
- ⭐⭐⭐⭐ 높음 - 개발 중 자주 참조
- ⭐⭐⭐ 중간 - 특정 작업 시 필요
- ⭐⭐ 낮음 - 선택적 참조
- ⭐ 참고용 - 필요 시만

### 변경 이력 기록

주요 변경 시 이 섹션 하단에 기록:
```
- YYYY-MM-DD: 변경 내용 (담당자)
```

**변경 이력**:
- 2025-10-26: INDEX.md 초기 생성, 120개 문서 인덱싱 (Claude Code)
- 2025-10-26: 관리 지침 추가 (Claude Code)

---

## 문서 구조 개요

```
docs/
├── README.md (폴더 안내)
├── INDEX.md (이 문서 - 전체 인덱스)
├── 시작하기.md
├── NEXT_STEPS_PRIORITY.md
├── AED_DATA_IMPORT_GUIDE.md
├── CSV_STRUCTURE_ANALYSIS.md
├── migration/ (마이그레이션)
├── planning/ (개선 계획)
├── reference/ (참조)
├── guides/ (가이드)
├── current/ (현재 상태)
├── setup/ (초기 설정)
├── security/ (보안)
├── analysis/ (분석)
├── troubleshooting/ (문제 해결)
└── archive/ (아카이브)
```

---

## docs/ 루트 파일

### 필수 문서

**[README.md](./README.md)** - 문서 폴더 메인 안내
- docs 폴더 전체 구조
- 상황별 문서 찾기
- 문서 관리 정책
- 우선순위: ⭐⭐⭐⭐⭐

**[INDEX.md](./INDEX.md)** - 전체 문서 인덱스 (이 문서)
- 모든 문서 목록
- 문서별 용도 및 우선순위
- 우선순위: ⭐⭐⭐⭐⭐

**[시작하기.md](./시작하기.md)** - 상세 시작 가이드
- 프로젝트 시작 방법
- 환경 설정
- 우선순위: ⭐⭐⭐⭐⭐

### 작업 문서

**[NEXT_STEPS_PRIORITY.md](./NEXT_STEPS_PRIORITY.md)** - 다음 단계 우선순위
- 우선순위 작업 목록
- 완료 현황
- 우선순위: ⭐⭐⭐⭐⭐

**[AED_DATA_IMPORT_GUIDE.md](./AED_DATA_IMPORT_GUIDE.md)** - AED 데이터 import 가이드
- e-gen CSV 파일 import
- 81,331개 레코드 처리
- 우선순위: ⭐⭐⭐⭐

**[CSV_STRUCTURE_ANALYSIS.md](./CSV_STRUCTURE_ANALYSIS.md)** - CSV 구조 분석
- e-gen CSV 필드 분석
- 우선순위: ⭐⭐⭐

---

## migration/ - NCP 마이그레이션

**폴더 안내**: [migration/INDEX.md](./migration/INDEX.md)

### 활성 문서 (6개)

**[MIGRATION_STATUS.md](./migration/MIGRATION_STATUS.md)** - 전체 마이그레이션 현황
- Phase 1-4.1 모든 단계 상태
- 데이터베이스, 인증, API 전환 현황
- 국정원 인증 요구사항 충족 상태
- 우선순위: ⭐⭐⭐⭐⭐

**[NCP_마이그레이션_완전가이드.md](./migration/NCP_마이그레이션_완전가이드.md)** - 전체 가이드
- 7단계 마이그레이션 플랜
- 기술 스택 및 아키텍처
- 우선순위: ⭐⭐⭐⭐

**[NCP_DEPLOYMENT_GUIDE.md](./migration/NCP_DEPLOYMENT_GUIDE.md)** - 배포 가이드
- NCP 서비스 설정
- 환경변수 구성
- 우선순위: ⭐⭐⭐

**[NEXTAUTH_MIGRATION_PLAN.md](./migration/NEXTAUTH_MIGRATION_PLAN.md)** - NextAuth 계획
- NextAuth 아키텍처
- 마이그레이션 단계
- 우선순위: ⭐⭐

**[POTENTIAL_ISSUES_ANALYSIS.md](./migration/POTENTIAL_ISSUES_ANALYSIS.md)** - 이슈 분석
- 발생 가능한 문제 및 해결 방법
- 우선순위: ⭐⭐⭐

**[PRISMA_CONVERSION_GUIDE.md](./migration/PRISMA_CONVERSION_GUIDE.md)** - Prisma 가이드
- Supabase → Prisma 변환 패턴
- 우선순위: ⭐⭐

### 완료 문서 (COMPLETE/ - 13개)

**[COMPLETE/README.md](./migration/COMPLETE/README.md)** - 아카이브 설명
- 완료된 Phase별 보고서 안내

**Phase 보고서**:
- FINAL_MIGRATION_STATUS.md - 최종 현황
- API_CONVERSION_SUMMARY.md - API 변환 요약
- NCP_MIGRATION_PHASE1_COMPLETE.md - Phase 1 완료
- NCP_MIGRATION_COMPLETE_REPORT.md - 전체 완료
- NEXTAUTH_MIGRATION_COMPLETE.md - NextAuth 완료
- NEXTAUTH_PHASE1_COMPLETE.md - NextAuth Phase 1
- NEXTAUTH_PHASE2_PROGRESS.md - NextAuth Phase 2
- PHASE3_API_CONVERSION_STATUS.md - Phase 3 API 상태
- PHASE3_COMPLETE.md - Phase 3 완료
- PHASE3_PROGRESS_2025_10_25.md - Phase 3 진행
- SESSION_PROGRESS_2025-10-25.md - 세션 진행
- SESSION_SUMMARY_2025_10_25.md - 세션 요약
- UPDATE_2025_10_25.md - 업데이트

---

## planning/ - 개선 계획

**폴더 안내**: [planning/README.md](./planning/README.md) | [planning/INDEX.md](./planning/INDEX.md)

### 활성 문서 (15개)

**성능 최적화**:

**[PERFORMANCE_OPTIMIZATION_MASTER.md](./planning/PERFORMANCE_OPTIMIZATION_MASTER.md)** - 마스터 문서
- 전체 성능 최적화 통합 문서
- 우선순위: ⭐⭐⭐⭐⭐

**[LAYOUT_IMPROVEMENT_PLAN.md](./planning/LAYOUT_IMPROVEMENT_PLAN.md)** - 레이아웃 계획
- Stage 1~3 개선 방안
- 우선순위: ⭐⭐

**[PAGINATION_OPTIMIZATION_2025.md](./planning/PAGINATION_OPTIMIZATION_2025.md)** - 페이지네이션
- Phase 0~3 최적화 계획
- 우선순위: ⭐⭐

**[PAGINATION_OPTIMIZATION_RISKS.md](./planning/PAGINATION_OPTIMIZATION_RISKS.md)** - 위험 분석
- Phase 2-3 위험 요소
- 우선순위: ⭐

**기타 계획**:
- ADVANCED_OPTIMIZATION_ROADMAP.md - 고급 최적화
- INSPECTION_SYSTEM.md - 점검 시스템
- MAPPING_2025_STRATEGY.md - 매핑 전략
- MAPPING_SYSTEM.md - 매핑 시스템
- OPERATIONAL_POLICIES.md - 운영 정책
- MODEL_VALIDATION_IMPROVEMENT_PLAN.md - 모델 검증
- FIELD_VALIDATION_IMPROVEMENTS.md - 필드 검증
- PHOTO_STORAGE_OPTIMIZATION.md - 사진 저장소
- TIER3_LONG_TERM_OPTIMIZATION.md - 장기 최적화
- DOCUMENTATION_REDUCTION_PLAN.md - 문서 간소화

### 완료 문서 (COMPLETE/ - 11개)

**[COMPLETE/README.md](./planning/COMPLETE/README.md)** - 아카이브 설명

**완료 작업**:
- PHASE_0_APPLIED.md - Phase 0 완료 (2025-10-17)
- LAYOUT_STAGE1_READY.md - Layout 준비
- LAYOUT_STAGE1_COMPLETE.md - Layout 완료 (2025-10-17)
- FILTERING_STRATEGY_ANALYSIS.md - 필터링 전략 (2025-10-17)
- DB_FILTERING_MIGRATION_PLAN.md - DB 필터링 계획
- DB_FILTERING_COMPLETE.md - DB 필터링 완료 (2025-10-18)
- FILTER_BUG_FIX_2025-10-18.md - 필터 버그 수정
- COMPLETE_FILTER_FIX_2025-10-18.md - 모든 필터 수정
- JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md - 관할보건소 쿼리
- signup-approval-improvements.md - 회원가입 개선 (2025-10-03)

### 아카이브 (archive/ - 3개)

- speedup_25.10.16.md - 초기 성능 분석
- SPEEDUP_QUICK_FIX.md - 캐싱 수정
- SPEEDUP_IMPLEMENTATION_AUDIT.md - 구현 감사

---

## reference/ - 참조 문서

### 활성 문서 (8개)

**[ARCHITECTURE_OVERVIEW.md](./reference/ARCHITECTURE_OVERVIEW.md)** - 시스템 아키텍처
- 전체 시스템 구조
- 우선순위: ⭐⭐⭐⭐

**[REGION_CODE_GUIDELINES.md](./reference/REGION_CODE_GUIDELINES.md)** - 지역 코드 가이드
- 지역 코드 체계
- 우선순위: ⭐⭐⭐⭐

**[SECURITY_GUIDELINES.md](./reference/SECURITY_GUIDELINES.md)** - 보안 가이드라인
- 보안 정책
- 우선순위: ⭐⭐⭐⭐

**[QUICK_START.md](./reference/QUICK_START.md)** - 빠른 시작
- 개발 환경 설정
- 우선순위: ⭐⭐⭐⭐

**[NCP_AUTH_STRATEGY.md](./reference/NCP_AUTH_STRATEGY.md)** - NCP 인증 전략
- NextAuth 전략
- 우선순위: ⭐⭐⭐

**AED 데이터**:
- aed-data-analysis.md - 데이터 분석
- aed-data-schema.md - 데이터 스키마
- aed-installation-targets.md - 설치 대상

### 레거시 문서 (COMPLETE/ - 6개)

**[COMPLETE/README.md](./reference/COMPLETE/README.md)** - 아카이브 설명

**Supabase 레거시**:
- SUPABASE_SCHEMA_COMPLETE.md - Supabase 스키마
- MIGRATION_GUIDE.md - Supabase 마이그레이션
- NCP_VS_SUPABASE_AUTH.md - 인증 비교

**프로젝트 관리**:
- PROJECT_RESTRUCTURE_SUMMARY.md - 재구조화 (2025-10-25)
- NCP_PRIORITY_REVIEW.md - 우선순위 검토 (2025-10-25)
- SUPABASE_VERCEL_CLEANUP_REPORT.md - 정리 보고서

### aed-data 하위폴더

- (빈 폴더 - 향후 사용 예정)

---

## guides/ - 기능 가이드

### 데이터 품질 관리

- aed-duplicate-equipment-strategy.md - 중복 장비 처리
- data-filtering-issue-solution.md - 필터링 이슈
- aed-identifier-issue.md - 식별자 이슈
- display-allowed-values-audit.md - 표시값 감사

### 기능 가이드

- aed-data-testing-guide.md - 데이터 테스트
- error-logging-guide.md - 에러 로깅
- post-fix-checklist.md - 수정 후 체크리스트

### 문제 해결

- fix-health-centers-error.md - 보건소 에러
- layout-improvements.md - 레이아웃 개선

### 하위 폴더

- features/ - 기능별 가이드
- data-quality/ - 데이터 품질
- troubleshooting/ - 문제 해결

---

## current/ - 현재 상태

- current-status.md - 전체 프로젝트 현황
- inspection-architecture.md - 점검 시스템 아키텍처
- aed-data-state-management.md - 데이터 상태 관리
- technical-debt.md - 기술 부채 현황
- deployment-checklist.md - 배포 체크리스트

---

## setup/ - 초기 설정

- kakao-map-guide.md - 카카오맵 API 설정
- seed-instructions.md - 초기 데이터 시드
- vercel-deployment-guide.md - Vercel 배포 (레거시)

---

## security/ - 보안 정책

- aed-data-security-plan.md - 데이터 보안 계획
- aed-data-access-rules.md - 접근 규칙
- ux-tradeoff-analysis.md - 보안/UX 트레이드오프

---

## analysis/ - 분석

- (데이터 분석 문서들)

---

## troubleshooting/ - 문제 해결

- (문제 해결 가이드들)

---

## archive/ - 아카이브

**경고**: 읽기 전용, 수정 금지

### 구조

- reports/ - 완료된 작업 보고서 (전체 이동됨)
  - 2025-10-04~10-18 작업 보고서 약 20개
- README_OLD_SUPABASE.md - Supabase 시절 README
- PROJECT_STATUS.md - 구 프로젝트 현황
- TODAY_SUMMARY.md - 일일 요약

### 기타 레거시

- PHASE1_DEPLOYMENT_GUIDE.md - Phase 1 배포
- TUTORIAL_GUIDE.md - 튜토리얼 가이드
- TUTORIAL_IMPLEMENTATION_PLAN.md - 튜토리얼 계획
- DOCUMENTATION_POLICY.md - 문서 정책
- PERFORMANCE_MEASUREMENT_GUIDE.md - 성능 측정
- guideline_text*.txt - 가이드라인 텍스트

---

## 빠른 참조

### 시작하기
1. [README.md](./README.md)
2. [시작하기.md](./시작하기.md)
3. [reference/QUICK_START.md](./reference/QUICK_START.md)

### 마이그레이션
1. [migration/MIGRATION_STATUS.md](./migration/MIGRATION_STATUS.md)
2. [migration/INDEX.md](./migration/INDEX.md)
3. [migration/COMPLETE/](./migration/COMPLETE/)

### 개선 계획
1. [planning/PERFORMANCE_OPTIMIZATION_MASTER.md](./planning/PERFORMANCE_OPTIMIZATION_MASTER.md)
2. [planning/README.md](./planning/README.md)
3. [planning/INDEX.md](./planning/INDEX.md)

### 참조
1. [reference/ARCHITECTURE_OVERVIEW.md](./reference/ARCHITECTURE_OVERVIEW.md)
2. [reference/REGION_CODE_GUIDELINES.md](./reference/REGION_CODE_GUIDELINES.md)
3. [reference/SECURITY_GUIDELINES.md](./reference/SECURITY_GUIDELINES.md)

---

## 우선순위 가이드

### 최우선 (즉시 참조)
- README.md
- 시작하기.md
- NEXT_STEPS_PRIORITY.md
- migration/MIGRATION_STATUS.md
- planning/PERFORMANCE_OPTIMIZATION_MASTER.md

### 높은 우선순위 (필수 참조)
- migration/NCP_마이그레이션_완전가이드.md
- reference/ARCHITECTURE_OVERVIEW.md
- reference/REGION_CODE_GUIDELINES.md
- reference/SECURITY_GUIDELINES.md
- reference/QUICK_START.md
- AED_DATA_IMPORT_GUIDE.md

### 중간 우선순위 (필요시 참조)
- migration/NCP_DEPLOYMENT_GUIDE.md
- planning/LAYOUT_IMPROVEMENT_PLAN.md
- planning/PAGINATION_OPTIMIZATION_2025.md
- CSV_STRUCTURE_ANALYSIS.md
- reference/NCP_AUTH_STRATEGY.md
- guides/* (각 기능별)

### 낮은 우선순위 (선택적)
- planning/ADVANCED_OPTIMIZATION_ROADMAP.md
- planning/TIER3_LONG_TERM_OPTIMIZATION.md
- planning/DOCUMENTATION_REDUCTION_PLAN.md

### 참고용 (필요시만)
- migration/COMPLETE/* (완료 히스토리)
- planning/COMPLETE/* (완료 작업)
- reference/COMPLETE/* (레거시)
- archive/* (아카이브)

---

## 문서 통계

### 전체 문서 수
- **docs/ 루트**: 5개 (필수 3 + 작업 2)
- **migration/**: 19개 (활성 6 + 완료 13)
- **planning/**: 29개 (활성 15 + 완료 11 + 아카이브 3)
- **reference/**: 15개 (활성 8 + 완료 6 + 하위폴더 1)
- **guides/**: 약 15개
- **current/**: 약 5개
- **setup/**: 3개
- **security/**: 3개
- **archive/**: 약 25개

**총 문서**: 약 120개

### COMPLETE 폴더
- migration/COMPLETE/: 13개
- planning/COMPLETE/: 11개
- reference/COMPLETE/: 6개

**총 완료 문서**: 30개

---

## 최근 업데이트 (2025-10-26)

1. migration, planning, reference에 COMPLETE 폴더 생성
2. 완료된 문서 30개 COMPLETE로 이동
3. reports 폴더 전체 archive로 이동
4. docs/ 루트 파일 9개 archive로 이동
5. docs/README.md 완전 재작성 (v3.0)
6. docs/INDEX.md 신규 생성
7. 각 COMPLETE 폴더에 README.md 생성
8. migration/INDEX.md, planning/INDEX.md 생성

---

작성자: Claude Code
문서 버전: 1.0
최종 업데이트: 2025-10-26
