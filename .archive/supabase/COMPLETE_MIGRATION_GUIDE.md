# AED Check System - 완전한 Migration 가이드

## 🎯 핵심 원칙

### 1. 절대 추측하지 말 것
Migration을 작성하기 전에 **반드시** 실제 스키마를 확인하세요.

```sql
-- 실제 컬럼 목록 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'aed_data'
ORDER BY ordinal_position;
```

### 2. 실제 스키마 참조 문서 확인
**`/supabase/ACTUAL_SCHEMA_REFERENCE.md`** 파일을 항상 확인하세요.

### 3. 타입을 정확히 맞출 것
- `VARCHAR` ≠ `TEXT` (PostgreSQL에서 엄격히 구분됨)
- `BIGINT` ≠ `INTEGER`
- `NUMERIC` ≠ `DATE`

## ❌ 절대 사용 금지 컬럼 (aed_data 테이블)

```
health_center_id      ❌ 없음! jurisdiction_health_center (VARCHAR) 사용
region_code           ❌ 없음! sido (VARCHAR) 사용
city_code             ❌ 없음! gugun (VARCHAR) 사용
device_serial         ❌ 없음! equipment_serial (VARCHAR) 사용
device_serial_number  ❌ 없음! serial_number (VARCHAR) 사용
```

## ✅ 실제 존재하는 주요 컬럼

```sql
-- 식별자
id                              BIGINT (NOT INTEGER, NOT UUID)
equipment_serial                VARCHAR (NOT device_serial)
serial_number                   VARCHAR (NOT device_serial_number)

-- 지역
sido                            VARCHAR (NOT region_code)
gugun                           VARCHAR (NOT city_code)

-- 관할
jurisdiction_health_center      VARCHAR (NOT health_center_id UUID)

-- 날짜
last_use_date                   NUMERIC (NOT DATE!)
```

## 📋 현재 운영 중인 Migration 파일

### 핵심 Migration
1. `01_initial_schema.sql` - 기본 테이블 생성
2. `40_fix_varchar_text_mismatch.sql` - **최종 성공한 get_aed_data_filtered 함수**

### 아카이브된 실패 Migration
`/supabase/migrations/_archive_failed_attempts/` 폴더 참조

## 🔧 Migration 작성 프로세스

### Step 1: 스키마 확인
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'aed_data';
```

### Step 2: 함수 작성
- `RETURNS TABLE` 선언 시 **정확한 타입** 사용
- `VARCHAR` vs `TEXT` 구분
- `BIGINT` vs `INTEGER` 구분

### Step 3: 테스트
```sql
-- 함수 존재 확인
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname = 'your_function_name';

-- 함수 호출 테스트
SELECT * FROM your_function_name();
```

### Step 4: 권한 부여
```sql
GRANT EXECUTE ON FUNCTION your_function_name TO anon, authenticated;
```

### Step 5: PostgREST 캐시 새로고침
```sql
NOTIFY pgrst, 'reload schema';
```

## 🚨 과거 실패 사례 및 교훈

### 사례 1: 존재하지 않는 컬럼 참조
**문제**: `health_center_id` UUID 타입 컬럼 사용
**에러**: `column a.health_center_id does not exist`
**해결**: `jurisdiction_health_center` VARCHAR 타입 사용

### 사례 2: TEXT vs VARCHAR 타입 불일치
**문제**: 함수는 `TEXT` 반환, 테이블은 `VARCHAR(255)`
**에러**: `Returned type character varying(255) does not match expected type text in column 2`
**해결**: 함수 반환 타입을 `VARCHAR`로 수정

### 사례 3: BIGINT vs INTEGER 불일치
**문제**: `id` 컬럼은 `BIGINT`, 함수는 `INTEGER` 반환
**에러**: `Returned type bigint does not match expected type integer in column 1`
**해결**: `id::TEXT`로 캐스팅하여 TEXT 반환

## 📝 최종 성공한 get_aed_data_filtered 함수

```sql
CREATE FUNCTION public.get_aed_data_filtered(
  p_health_center_id UUID DEFAULT NULL,
  p_region_codes TEXT[] DEFAULT NULL,
  p_city_codes TEXT[] DEFAULT NULL,
  p_category_1 TEXT[] DEFAULT NULL,
  p_category_2 TEXT[] DEFAULT NULL,
  p_category_3 TEXT[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  user_org_lat DOUBLE PRECISION DEFAULT NULL,
  user_org_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,                        -- BIGINT를 TEXT로 캐스팅
  device_serial VARCHAR,          -- VARCHAR 타입 정확히 매칭
  management_number VARCHAR,
  -- ... 중략
  last_use_date NUMERIC,          -- DATE가 아니라 NUMERIC!
  -- ... 중략
)
```

## 🎓 배운 교훈

1. **절대 추측하지 말 것** - 항상 실제 DB 확인
2. **타입을 정확히 맞출 것** - VARCHAR ≠ TEXT
3. **스키마 문서를 신뢰하지 말 것** - 실제 DB가 진실
4. **Migration 40개 만들기 전에 1번 제대로 확인하기**

## 2025-10-04 최종 확인
- 실제 DB 스키마 확인 완료
- Migration 40 성공적으로 적용
- 더 이상 잘못된 컬럼 참조 없음
