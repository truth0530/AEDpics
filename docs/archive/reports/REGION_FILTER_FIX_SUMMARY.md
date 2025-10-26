# Region Filter Fix Summary - 2025-10-04

## 🎯 작업 완료 내용

### 1. UI 개선 완료 ✅
- **RegionFilter.tsx**: '검색' 버튼 제거, onChange 콜백으로 변경
- **AppHeader.tsx**: sessionStorage에 시도/구군 저장
- **MobileHeader.tsx**: sessionStorage에 시도/구군 저장
- **AEDFilterBar.tsx**: '조회' 버튼 클릭 시 sessionStorage에서 읽기
- **route.ts**: selectedSido/selectedGugun 파라미터 전달

### 2. DB 마이그레이션 준비 완료 ✅
- **Migration 48 생성**: `supabase/migrations/48_fix_rpc_schema_mismatch.sql`
- 스키마 문제 파악 및 수정:
  - `aed_data` 테이블: `sido`, `gugun` (VARCHAR)
  - `organizations` 테이블: `region_code`, `city_code` (TEXT)
  - RPC 함수 return type: `aed_id BIGINT` (기존 INTEGER에서 변경)

## ⚠️ 현재 상태

### 작동하는 기능
- ✅ "주소기준" 조회 (`get_aed_data_filtered`): 정상 작동
- ✅ 헤더의 시도/구군 선택: onChange 콜백 작동 확인
- ✅ sessionStorage 저장: 정상 작동

### 작동하지 않는 기능
- ❌ "관할보건소기준" 조회 (`get_aed_data_by_jurisdiction`): 스키마 불일치 오류
  ```
  code: '42804'
  details: 'Returned type bigint does not match expected type integer in column 1.'
  message: 'structure of query does not match function result type'
  ```

## 🔧 해결 방법

### Migration 48 적용 필요

현재 로컬에서 원격 DB 접속이 불가능한 상태입니다. 다음 중 하나의 방법으로 적용하세요:

#### 방법 1: Supabase Dashboard 사용 (권장)
1. https://supabase.com/dashboard 로그인
2. 프로젝트 선택 (aieltmidsagiobpuebvv)
3. SQL Editor 메뉴 선택
4. `supabase/migrations/48_fix_rpc_schema_mismatch.sql` 파일 내용 복사
5. 실행 (Run)

#### 방법 2: Supabase CLI 사용
```bash
# Supabase 프로젝트 연결 (최초 1회)
cd /Users/kwangsunglee/Projects/AED_check2025/aed-check-system
npx supabase link --project-ref aieltmidsagiobpuebvv

# 마이그레이션 푸시
npx supabase db push
```

#### 방법 3: psql 직접 연결 (네트워크 문제 해결 후)
```bash
psql "postgresql://postgres.aieltmidsagiobpuebvv:PASSWORD@db.aieltmidsagiobpuebvv.supabase.co:5432/postgres" \\
  -f supabase/migrations/48_fix_rpc_schema_mismatch.sql
```

## 📋 Migration 48의 주요 변경사항

### 1. get_aed_data_filtered 함수
```sql
- 파라미터 추가: p_selected_sido, p_selected_gugun
- Return type: aed_id BIGINT (기존 INTEGER)
- 컬럼 참조: a.sido, a.gugun (기존 region_code, city_code)
- WHERE 조건:
  - p_selected_sido → a.sido 매칭
  - p_selected_gugun → a.gugun 매칭
  - p_region_codes → a.sido 매칭
  - p_city_codes → a.gugun 매칭
```

### 2. get_aed_data_by_jurisdiction 함수
```sql
- 파라미터 추가: p_selected_sido, p_selected_gugun
- Return type: aed_id BIGINT
- 컬럼 참조:
  - aed_data: sido, gugun
  - organizations: region_code, city_code
- WHERE 조건:
  - 헤더 필터: a.sido, a.gugun
  - 관할 보건소 필터: o.region_code, o.city_code
```

## 🎯 Migration 적용 후 테스트

1. **주소기준 조회 + 헤더 필터**
   - 시도: 서울특별시, 구군: 종로구 선택
   - '조회' 버튼 클릭
   - 결과: 서울 종로구 AED만 표시되어야 함

2. **관할보건소기준 조회 + 헤더 필터**
   - 시도: 서울특별시, 구군: 종로구 선택
   - 조회 기준: "관할보건소기준" 선택
   - '조회' 버튼 클릭
   - 결과: 서울 종로구 관할 보건소가 관리하는 AED만 표시되어야 함

## 📊 스키마 참조

### aed_data 테이블 (실제 DB)
```sql
id                 bigint      -- ⚠️ BIGINT, not INTEGER
sido               varchar     -- ⚠️ varchar, not region_code
gugun              varchar     -- ⚠️ varchar, not city_code
equipment_serial   varchar
management_number  varchar
...
```

### organizations 테이블 (실제 DB)
```sql
id           uuid
name         text
type         text
region_code  text    -- ⚠️ '서울', '부산' 등 시도명
city_code    text    -- ⚠️ '종로구', '강남구' 등 구군명
...
```

## 🔍 이전 오류 원인 분석

### 문제 1: 타입 불일치
- **오류**: `Returned type bigint does not match expected type integer in column 1`
- **원인**: RPC 함수가 `INTEGER` 반환을 선언했지만 실제 `aed_data.id`는 `BIGINT`
- **해결**: RETURNS TABLE에서 `aed_id BIGINT`로 변경

### 문제 2: 컬럼명 불일치
- **오류**: 조회 결과 0건
- **원인**:
  - RPC 함수가 `region_code`, `city_code` 컬럼을 참조했지만
  - `aed_data` 테이블에는 `sido`, `gugun` 컬럼만 존재
- **해결**: WHERE 조건에서 `a.sido`, `a.gugun` 사용

### 문제 3: organizations 테이블 매칭
- **혼란**:
  - `organizations.region_code` = 'SEO' (코드)
  - `organizations.city_code` = '강남구' (이름!)
- **해결**:
  - `p_region_codes` → `o.region_code` (조직 테이블의 코드 컬럼)
  - `p_city_codes` → `o.city_code` (조직 테이블의 이름 컬럼)

## 📝 참고 문서

- **스키마 참조**: `supabase/ACTUAL_SCHEMA_REFERENCE.md`
- **마이그레이션 가이드**: `supabase/COMPLETE_MIGRATION_GUIDE.md`
- **과거 실패 사례**: Migration 30-39번 (모두 스키마 불일치로 실패)

## ✅ 완료 조건

Migration 48 적용 후:
1. "관할보건소기준" 조회 시 오류 없이 데이터 반환
2. 헤더의 시도/구군 필터가 실제 쿼리에 반영됨
3. 콘솔 로그에 `error: null` 표시됨

---

**작성일**: 2025-10-04
**작성자**: Claude Code
**관련 파일**:
- `components/layout/RegionFilter.tsx`
- `components/layout/AppHeader.tsx`
- `components/layout/MobileHeader.tsx`
- `app/aed-data/components/AEDFilterBar.tsx`
- `app/api/aed-data/route.ts`
- `supabase/migrations/48_fix_rpc_schema_mismatch.sql`
