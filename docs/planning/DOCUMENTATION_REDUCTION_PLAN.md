# 문서 감축 계획

**작성일**: 2025-10-09
**목적**: 106개의 문서를 30-40개로 감축하여 관리 효율성 향상

---

## 📊 현재 상황

### 문서 수 현황
- **전체 마크다운 파일**: 106개
  - docs/ 폴더: 96개
  - 루트 폴더: 10개
- **Archive 문서**: 50개 (52% 차지)
- **대용량 파일**: guideline_extracted_raw.txt (5.6MB), PDF 2개 (총 2.3MB)

### 폴더별 분포
```
docs/archive/         664KB (50개 문서) ← 삭제 대상
docs/planning/        316KB (10개 문서) ← 통합 대상
docs/guides/           72KB
docs/current/          56KB
docs/reference/        44KB (7개 문서) ← 통합 가능
docs/security/         40KB (3개 문서)
docs/reports/          32KB (4개 문서)
docs/setup/            20KB (3개 문서)
docs/troubleshooting/  24KB
루트 *.md             10개 ← 정리 필요
```

---

## 🎯 감축 전략

### Phase 1: Archive 완전 삭제 (50개 → 0개)
**삭제 대상**: `docs/archive/` 전체

**이유**:
- 2025년 9월 구 계획서들 (deprecated_plans)
- 완료된 보고서들 (completed_reports)
- Tutorial 백업 파일들
- 더 이상 참조되지 않는 구 문서들

**보존 방법**:
```bash
# Git 이력에 남아있으므로 필요시 복구 가능
git log --all --full-history -- "docs/archive/**"
```

**예상 효과**: 50개 감축 (106 → 56)

---

### Phase 2: Planning 문서 통합 (10개 → 3개)

#### 통합 대상

**1. 점검 시스템 관련 → `INSPECTION_SYSTEM.md` (1개로 통합)**
- ✅ inspection-data-flow-final.md (최신, 유지)
- ❌ snapshot-refresh-implementation.md (내용이 inspection-data-flow-final.md에 포함됨)
- ❌ inspection-system-design.md (구 설계서, 이미 구현 완료)
- ❌ IMPLEMENTATION_REVIEW.md (검토 완료, 더 이상 필요 없음)

**2. 매핑 시스템 관련 → `MAPPING_SYSTEM.md` (1개로 통합)**
- ✅ persistent-mapping-architecture.md (아키텍처 설명)
- ✅ mandatory-institution-matching-plan.md (매칭 정책)
- 통합 → `MAPPING_SYSTEM.md`

**3. 운영 정책 → `OPERATIONAL_POLICIES.md` (1개로 통합)**
- ✅ inspection-assignment-policy.md (점검 할당)
- ✅ map-sync-ux.md (지도 동기화)
- ❌ aed-comprehensive-plan.md (ARCHIVED, 삭제)
- 통합 → `OPERATIONAL_POLICIES.md`

**4. 기타 유지**
- ✅ signup-approval-improvements.md (최근 작업, 유지)

**예상 효과**: 7개 감축 (56 → 49)

---

### Phase 3: 루트 문서 정리 (10개 → 4개)

#### 삭제 대상
- ❌ REGION_FILTER_FIX_SUMMARY.md → docs/reports/로 이동
- ❌ TABLE_RENAME_PLAN.md → docs/reports/로 이동
- ❌ AUDIT_REPORT_REGION_CODES.md → docs/reports/로 이동
- ❌ INSPECTION_TABLES_HISTORY.md → docs/reports/로 이동
- ❌ LOCATION_INIT_IMPLEMENTATION.md → docs/reports/로 이동
- ❌ DOCS_CONSOLIDATION_SUMMARY.md → docs/reports/로 이동

#### 유지
- ✅ README.md (프로젝트 메인)
- ✅ CLAUDE.md (AI 가이드라인)
- ✅ REGION_CODE_GUIDELINES.md (필독 가이드)
- ✅ .gitignore, .env 등 설정 파일

**예상 효과**: 6개 감축 (49 → 43)

---

### Phase 4: Reference 통합 (7개 → 4개)

#### 통합 대상
**1. 시작 가이드 통합**
- quick-start-guide.md
- health-center-complete-guide.md
- 통합 → `QUICK_START.md`

**2. 아키텍처 통합**
- architecture-overview.md (유지)
- aed-data-schema.md (유지)

**3. 분석 문서**
- aed-data-analysis.md (유지)
- aed-installation-targets.md (유지)

**예상 효과**: 3개 감축 (43 → 40)

---

### Phase 5: 대용량 파일 정리

#### 삭제 대상
```bash
# 추출된 텍스트 파일 (더 이상 사용 안함)
docs/guideline_extracted_raw.txt (5.6MB)
docs/guideline_text_decoded4.txt (4KB)
```

**보존**: PDF 파일은 유지 (공식 문서)
- ★자동심장충격기+설치+및+관리+지침(제7판)_최종.pdf
- 자동심장충격기 제조사별 배터리 유효기간.pdf

---

## 📋 최종 구조 (40개 문서)

```
/
├── README.md (프로젝트 개요)
├── CLAUDE.md (AI 가이드라인)
├── REGION_CODE_GUIDELINES.md (지역 코드 가이드)
└── docs/
    ├── PROJECT_STATUS.md (마스터 상태)
    ├── planning/ (3개)
    │   ├── INSPECTION_SYSTEM.md (점검 시스템 통합)
    │   ├── MAPPING_SYSTEM.md (매핑 시스템 통합)
    │   └── OPERATIONAL_POLICIES.md (운영 정책 통합)
    ├── reference/ (4개)
    │   ├── QUICK_START.md (시작 가이드 통합)
    │   ├── architecture-overview.md
    │   ├── aed-data-schema.md
    │   └── aed-data-analysis.md
    ├── security/ (3개) - 유지
    ├── setup/ (3개) - 유지
    ├── current/ (3개) - 정리 후 유지
    ├── reports/ (10개) - 최근 보고서만 유지
    └── guides/ (유지)
```

---

## 🚀 실행 계획

### Step 1: 백업 생성
```bash
# Git 태그로 현재 상태 백업
git tag -a docs-before-cleanup-v1 -m "문서 정리 전 백업"
git push origin docs-before-cleanup-v1
```

### Step 2: Archive 삭제
```bash
# Archive 전체 삭제
rm -rf docs/archive/

# 커밋
git add -A
git commit -m "docs: archive 폴더 삭제 (50개 구 문서 제거)"
```

### Step 3: Planning 통합
```bash
# 새 통합 문서 생성
# INSPECTION_SYSTEM.md 생성
# MAPPING_SYSTEM.md 생성
# OPERATIONAL_POLICIES.md 생성

# 구 문서 삭제
rm docs/planning/snapshot-refresh-implementation.md
rm docs/planning/inspection-system-design.md
rm docs/planning/IMPLEMENTATION_REVIEW.md
rm docs/planning/aed-comprehensive-plan.md

# 커밋
git add -A
git commit -m "docs: planning 문서 통합 (10개 → 3개)"
```

### Step 4: 루트 정리
```bash
# 보고서 이동
mv REGION_FILTER_FIX_SUMMARY.md docs/reports/
mv TABLE_RENAME_PLAN.md docs/reports/
mv AUDIT_REPORT_REGION_CODES.md docs/reports/
mv INSPECTION_TABLES_HISTORY.md docs/reports/
mv LOCATION_INIT_IMPLEMENTATION.md docs/reports/
mv DOCS_CONSOLIDATION_SUMMARY.md docs/reports/

# 커밋
git add -A
git commit -m "docs: 루트 문서 정리 (reports로 이동)"
```

### Step 5: Reference 통합
```bash
# QUICK_START.md 생성 (통합)
# 구 문서 삭제

git add -A
git commit -m "docs: reference 문서 통합 (7개 → 4개)"
```

### Step 6: 대용량 파일 삭제
```bash
rm docs/guideline_extracted_raw.txt
rm docs/guideline_text_decoded4.txt

git add -A
git commit -m "docs: 대용량 텍스트 파일 삭제 (7.6MB)"
```

---

## ✅ 예상 효과

### 문서 수
- **Before**: 106개
- **After**: 40개
- **감축률**: 62% (66개 감소)

### 폴더별 변화
| 폴더 | Before | After | 변화 |
|-----|--------|-------|------|
| archive | 50 | 0 | -50 (삭제) |
| planning | 10 | 3 | -7 (통합) |
| reference | 7 | 4 | -3 (통합) |
| 루트 | 10 | 4 | -6 (이동) |
| 기타 | 29 | 29 | 유지 |

### 관리 효율성
- ✅ 중복 문서 제거
- ✅ 구 문서 정리
- ✅ 논리적 그룹화
- ✅ 검색 시간 단축
- ✅ 유지보수 부담 감소

---

## ⚠️ 주의사항

### 삭제 전 확인
1. **참조 확인**: 다른 문서에서 링크되는지 확인
2. **코드 참조**: 소스 코드에서 참조되는지 확인
3. **Git 이력**: 필요시 복구 가능 확인

### 복구 방법
```bash
# 특정 파일 복구
git show docs-before-cleanup-v1:docs/archive/FILENAME.md > FILENAME.md

# 전체 복구
git checkout docs-before-cleanup-v1 -- docs/
```

---

## 🎯 권장 실행 순서

1. **즉시 실행 가능** (위험도 낮음)
   - Step 1: 백업 생성
   - Step 2: Archive 삭제
   - Step 6: 대용량 파일 삭제

2. **검토 후 실행** (위험도 중간)
   - Step 4: 루트 정리 (reports로 이동)

3. **신중히 실행** (위험도 높음)
   - Step 3: Planning 통합 (새 문서 작성 필요)
   - Step 5: Reference 통합 (새 문서 작성 필요)

---

**작성**: AED Smart Check 개발팀
**검토 필요**: 사용자 승인 후 실행
**예상 소요 시간**: 2-3시간
