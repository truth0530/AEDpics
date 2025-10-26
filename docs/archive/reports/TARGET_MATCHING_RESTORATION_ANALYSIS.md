# 의무기관매칭 기존 구현 복원 분석 보고서

## 📋 요약

**작성일**: 2025-10-15
**목적**: 2024년 10월 3일에 구현했던 의무기관 매칭 시스템의 복원 가능성 분석
**결론**: ✅ **복원 가능하지만, 현재 구현(target_list_2024 기반)과 완전히 다른 시스템**

---

## 🔍 발견된 커밋

### 1. 설계 문서 커밋
- **커밋 해시**: `190ba75`
- **날짜**: 2025-10-03
- **제목**: docs: 의무대상 기관 매칭 시스템 설계
- **내용**:
  - 3-Tier 외부 시스템 아키텍처 설계
  - `mandatory_institutions` 테이블 설계
  - Jaro-Winkler 유사도 알고리즘
  - 수동 매칭 + 자동 추천 혼합 방식

### 2. 구현 커밋
- **커밋 해시**: `79527c4`
- **날짜**: 2025-10-03
- **제목**: feat: 외부 시스템 매칭 API 및 관리 UI 구현
- **구현 파일**:
  1. `app/(authenticated)/admin/external-mapping/ExternalMappingClient.tsx`
  2. `app/(authenticated)/admin/external-mapping/page.tsx`
  3. `app/api/external-mapping/route.ts`
  4. `app/api/external-mapping/stats/route.ts`
  5. `app/api/inspections/sessions/route.ts` (수정)

---

## 🆚 현재 시스템 vs 기존 시스템 비교

### 현재 시스템 (2025-10-04 완성)

#### 테이블 구조
```sql
1. target_list_2024 (구비의무기관 목록)
   - target_key (PK)
   - institution_name, sido, gugun, division
   - 26,724건

2. management_number_group_mapping (관리번호 그룹 매칭)
   - management_number (PK, unique)
   - target_key_2024, auto_suggested_2024
   - auto_confidence_2024, confirmed_2024
   - 50,010건 (1 target → N management_numbers)

3. aed_target_mapping (장비 기반 영속성)
   - equipment_serial (unique)
   - target_key_2024, target_key_2025
   - 연도별 컬럼 분리
```

#### 매칭 방식
- **자동 매칭**: sido, gugun, 기관명 유사도 기반
- **신뢰도**: 평균 69.81점
- **UI**: 신뢰도별 탭 (고/중/저/전체)
- **DB 함수**: `get_target_matching_list_2024()`

---

### 기존 시스템 (2025-10-03 구현, 삭제됨)

#### 테이블 구조 (추정)
```sql
1. mandatory_institutions (의무대상 기관 마스터)
   - id (PK)
   - institution_name, address
   - sido, gugun
   - 엑셀 업로드 기반

2. mandatory_institution_devices (N:M 매칭)
   - id (PK)
   - mandatory_institution_id (FK)
   - equipment_serial (FK)
   - matching_method (manual/auto)
   - matching_confidence
   - verified (검증 여부)

3. aed_persistent_mapping (확장)
   - equipment_serial
   - external_system_id (e-gen 등)
   - mandatory_institution_id (추가)
   - matching_method
```

#### 매칭 방식
- **자동 매칭**: Jaro-Winkler 유사도 (기관명 70% + 주소 30%)
- **신뢰도**: 80%+ 높음, 60-80% 중간, 60%- 낮음
- **UI**: 통계 대시보드 + 매칭 목록 + 검증 버튼
- **API**: `/api/external-mapping` (GET/POST/PATCH/DELETE)

---

## 🔄 시스템 차이점 분석

| 구분 | 현재 시스템 | 기존 시스템 |
|------|-------------|-------------|
| **핵심 개념** | target_list 기반 그룹 매칭 | 외부 시스템 N:M 매칭 |
| **매칭 단위** | management_number → target_key | equipment_serial → institution_id |
| **매칭 방식** | 자동 매칭 + 확정 | 자동 추천 + 수동 매칭 + 검증 |
| **데이터 소스** | target_list_2024.csv | mandatory_institutions (엑셀 업로드) |
| **매칭 알고리즘** | 시도/구군/기관명 점수 합산 | Jaro-Winkler 유사도 |
| **연도 지원** | 2024/2025 컬럼 분리 | 단일 연도 |
| **워크플로우** | 자동매칭 → 검토 → 확정 | 자동추천 → 수동선택 → 검증승인 |
| **관계 구조** | 1:N (1 target → N management_numbers) | N:M (N devices ↔ M institutions) |
| **외부 시스템** | 없음 (target_list만) | e-gen, 119시스템 등 통합 |

---

## ❓ 두 시스템이 완전히 다른 이유

### 설계 목적의 차이

#### 현재 시스템 (target_list_2024)
- **목적**: 2024년 구비의무기관 목록과 AED 관리번호 매칭
- **사용 케이스**: "이 management_number는 어느 구비의무기관 소속인가?"
- **데이터 흐름**:
  ```
  target_list_2024 (엑셀)
    ↓
  management_number_group_mapping (자동 매칭)
    ↓
  담당자 확정
  ```

#### 기존 시스템 (external-mapping)
- **목적**: 여러 외부 시스템(e-gen, 119시스템 등)과 AED 장비 연동
- **사용 케이스**: "이 equipment_serial은 e-gen의 어떤 ID와 매칭되는가?"
- **데이터 흐름**:
  ```
  aed_data (매일 교체)
    ↓
  aed_persistent_mapping (영속성 보장, equipment_serial 기준)
    ↓
  external_systems (e-gen, 119, mandatory_institutions)
    ↓
  수동/자동 매칭 + 검증
  ```

---

## 📊 Migration 차이

### 현재 시스템 Migrations
```
41_target_list_2024.sql               - target_list_2024 테이블 생성
41_target_list_2024_upload.sql        - 26,724건 데이터 INSERT
42_target_key_generation.sql          - target_key 자동 생성
43_aed_target_mapping.sql             - aed_target_mapping 테이블 (영속성)
47_target_matching_ui_functions.sql   - get_target_matching_list_2024()
```

### 기존 시스템 Migrations (추정, 삭제됨)
```
28_mandatory_institutions.sql         - mandatory_institutions 테이블
28_mandatory_institution_devices.sql  - N:M 매칭 테이블
28_aed_persistent_mapping_extend.sql  - mandatory_institution_id 컬럼 추가
28_external_mapping_functions.sql     - match_external_system(), verify_external_mapping()
```

---

## 🤔 복원 가능성 평가

### ✅ 복원 가능한 부분

1. **UI 컴포넌트**
   - `ExternalMappingClient.tsx` (Git 커밋에 존재)
   - `page.tsx` (Git 커밋에 존재)
   - 복원 명령: `git show 79527c4:path/to/file > restored-file`

2. **API 엔드포인트**
   - `app/api/external-mapping/route.ts`
   - `app/api/external-mapping/stats/route.ts`
   - 복원 가능

3. **설계 문서**
   - `docs/mandatory-institution-matching-plan.md`
   - 복원 명령: `git show 190ba75:path/to/file > restored-file`

### ⚠️ 복원 불가능한 부분

1. **DB Migrations**
   - Git 히스토리에 Migration 28이 없음 (실행되지 않았거나 롤백됨)
   - DB에 `mandatory_institutions` 테이블 없음
   - DB에 `mandatory_institution_devices` 테이블 없음

2. **데이터**
   - `mandatory_institutions` 엑셀 파일 위치 불명
   - 매칭 데이터 없음

---

## 🎯 복원 vs 새로 구현 권장사항

### 옵션 1: 현재 시스템 유지 (권장)
**장점**:
- ✅ DB 테이블 모두 존재 (target_list_2024, management_number_group_mapping, aed_target_mapping)
- ✅ Migration 41-47 완료
- ✅ 50,010건 자동 매칭 완료
- ✅ UI/API 모두 완성
- ✅ 문서화 완료
- ✅ 2024년/2025년 확장 구조 준비됨

**단점**:
- ❌ 외부 시스템(e-gen, 119) 연동 불가
- ❌ N:M 매칭 불가 (1:N만 가능)
- ❌ Jaro-Winkler 알고리즘 없음

**추천 이유**:
- 이미 완성되어 있고, 2024년 데이터 기반으로 작동 중
- 2025년 확장 구조가 설계되어 있음
- 단순히 연도별 탭만 추가하면 됨

---

### 옵션 2: 기존 시스템 복원 + 통합
**장점**:
- ✅ Jaro-Winkler 유사도 알고리즘 사용 가능
- ✅ 외부 시스템(e-gen, 119) 통합 가능
- ✅ N:M 매칭 유연성

**단점**:
- ❌ Migration 28을 새로 작성해야 함
- ❌ `mandatory_institutions` 엑셀 데이터 다시 준비 필요
- ❌ `aed_persistent_mapping` 확장 필요
- ❌ DB 함수 새로 작성
- ❌ 현재 시스템과 충돌 가능성
- ❌ 개발 기간 2주 이상 소요

**복원 단계**:
1. Git에서 UI/API 파일 복원
2. Migration 28 재작성 (테이블 스키마)
3. `mandatory_institutions` 엑셀 데이터 수집
4. 자동 매칭 알고리즘 구현 (Jaro-Winkler)
5. 현재 시스템과 통합 (복잡도 높음)

---

### 옵션 3: 하이브리드 (현재 + 기존 알고리즘만)
**추천**: ⭐⭐⭐⭐⭐

**내용**:
- 현재 시스템(target_list_2024 기반) 유지
- 기존 시스템의 Jaro-Winkler 알고리즘만 차용
- Migration 67: 매칭 알고리즘 개선
  - 현재: sido/gugun/기관명 단순 점수
  - 개선: Jaro-Winkler 유사도 추가

**장점**:
- ✅ 현재 시스템 유지 (안정성)
- ✅ 알고리즘만 개선 (신뢰도 향상)
- ✅ 개발 기간 짧음 (3-5일)
- ✅ 리스크 낮음

**구현**:
```sql
-- Migration 67: Jaro-Winkler 유사도 추가
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- 이미 있음
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;  -- Jaro-Winkler

UPDATE management_number_group_mapping m
SET
  auto_confidence_2024 = (
    -- sido 일치: 35점
    CASE WHEN sido_match THEN 35 ELSE 0 END +
    -- gugun 일치: 35점
    CASE WHEN gugun_match THEN 35 ELSE 0 END +
    -- Jaro-Winkler 유사도: 30점
    (jarowinkler(normalize(aed_name), normalize(target_name)) * 30)
  ),
  auto_matching_reason_2024 = jsonb_build_object(
    'algorithm', 'jaro_winkler',
    'sido_score', ...,
    'gugun_score', ...,
    'name_similarity', jarowinkler(...)
  )
WHERE ...;
```

---

## 📝 최종 권장사항

### 🎯 옵션 3 (하이브리드) 추천

**이유**:
1. ✅ **현재 시스템 안정성 유지**
   - 50,010건 매칭 데이터 보존
   - Migration 41-47 유지
   - UI/API 재사용

2. ✅ **알고리즘 개선**
   - Jaro-Winkler 유사도 추가
   - 평균 신뢰도 69.81점 → 80점 이상 목표
   - 고신뢰도 비율 21.3% → 40% 이상 목표

3. ✅ **개발 효율성**
   - Migration 67 하나만 작성
   - 3-5일 소요
   - 리스크 낮음

4. ✅ **2025년 확장 가능**
   - 동일한 알고리즘을 2025년에 적용
   - 연도별 탭 구조 유지

---

## 🔧 복원 명령어 (참고용)

### UI 파일 복원
```bash
# ExternalMappingClient.tsx 복원
git show 79527c4:aed-check-system/app/\(authenticated\)/admin/external-mapping/ExternalMappingClient.tsx \
  > app/(authenticated)/admin/external-mapping/ExternalMappingClient.tsx.backup

# API 복원
git show 79527c4:aed-check-system/app/api/external-mapping/route.ts \
  > app/api/external-mapping/route.ts.backup
```

### 설계 문서 복원
```bash
# 설계 문서 확인
git show 190ba75 --stat

# 파일 목록
git show 190ba75 --name-only
```

---

## 📊 의사결정 매트릭스

| 기준 | 옵션 1 (현재 유지) | 옵션 2 (기존 복원) | 옵션 3 (하이브리드) |
|------|-------------------|-------------------|-------------------|
| **안정성** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **알고리즘 품질** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **개발 기간** | ⭐⭐⭐⭐⭐ (완료) | ⭐ (2주+) | ⭐⭐⭐⭐ (3-5일) |
| **외부 시스템 통합** | ❌ | ✅ | ❌ |
| **2025년 확장** | ✅ | ❌ (재설계 필요) | ✅ |
| **유지보수성** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🎬 다음 단계

### 사용자 결정 필요

**질문 1**: 외부 시스템(e-gen, 119시스템) 연동이 필요한가요?
- **YES** → 옵션 2 (기존 복원) 고려
- **NO** → 옵션 3 (하이브리드) 추천

**질문 2**: 2024년 데이터 기반 시스템을 빠르게 완성하고 싶나요?
- **YES** → 옵션 3 (하이브리드) 추천
- **NO, 시간 충분** → 옵션 2 고려

**질문 3**: 현재 50,010건 매칭 데이터를 유지하고 싶나요?
- **YES** → 옵션 1 또는 옵션 3
- **NO, 처음부터** → 옵션 2

---

## 📁 관련 파일

### 현재 시스템 (유지)
```
✅ supabase/migrations/41-47_*.sql
✅ app/(authenticated)/admin/target-matching/TargetMatchingClient.tsx
✅ app/api/target-matching/*.ts
✅ docs/reports/TARGET_MATCHING_TEST_GUIDE.md
✅ docs/reports/2025-10-05-target-matching.md
✅ docs/reports/TARGET_MATCHING_2024_2025_PLAN.md
```

### 기존 시스템 (Git에 존재, 복원 가능)
```
📦 Commit 79527c4:
  - app/(authenticated)/admin/external-mapping/ExternalMappingClient.tsx
  - app/(authenticated)/admin/external-mapping/page.tsx
  - app/api/external-mapping/route.ts
  - app/api/external-mapping/stats/route.ts

📦 Commit 190ba75:
  - docs/mandatory-institution-matching-plan.md (경로 불명확)
```

---

**작성자**: Claude
**작성일**: 2025-10-15
**버전**: 1.0
**권장사항**: ⭐ 옵션 3 (하이브리드 - 현재 시스템 + Jaro-Winkler 알고리즘)
