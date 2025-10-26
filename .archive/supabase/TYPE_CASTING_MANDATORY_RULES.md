# PostgreSQL 타입 캐스팅 필수 규칙

## ⚠️ 절대 규칙: 모든 반환값에 명시적 캐스팅!

### 핵심 원칙
**PostgreSQL은 TEXT와 VARCHAR를 암묵적으로 변환하지 않습니다.**

```sql
-- ❌ 절대 금지
RETURNS TABLE (name VARCHAR) AS $$
SELECT name FROM users;  -- ERROR: text ≠ varchar
$$;

-- ✅ 항상 이렇게
RETURNS TABLE (name VARCHAR) AS $$
SELECT name::VARCHAR FROM users;  -- 명시적 캐스팅 필수
$$;
```

---

## 🚨 위험한 상황들

### 1. 집계 함수 (MAX, MIN, STRING_AGG 등)
```sql
-- ❌ 위험
SELECT MAX(installation_institution) FROM aed_data;
-- 결과: TEXT

-- ✅ 안전
SELECT MAX(installation_institution)::VARCHAR FROM aed_data;
-- 결과: VARCHAR
```

### 2. COALESCE
```sql
-- ❌ 위험
COALESCE(sido, '기본값')
-- 결과: TEXT

-- ✅ 안전
COALESCE(sido, '기본값')::VARCHAR
-- 결과: VARCHAR
```

### 3. CASE WHEN
```sql
-- ❌ 위험
CASE WHEN sido IS NULL THEN '미정' ELSE sido END
-- 결과: TEXT

-- ✅ 안전
(CASE WHEN sido IS NULL THEN '미정' ELSE sido END)::VARCHAR
-- 결과: VARCHAR
```

### 4. 문자열 연결 (||)
```sql
-- ❌ 위험
sido || '-' || gugun
-- 결과: TEXT

-- ✅ 안전
(sido || '-' || gugun)::VARCHAR
-- 결과: VARCHAR
```

---

## 📋 필수 체크리스트 (함수 작성 전)

### Step 1: 함수 시그니처 작성
```sql
RETURNS TABLE (
  management_number VARCHAR,        -- ⚠️ 여기서 VARCHAR 선언
  installation_institution VARCHAR,
  sido VARCHAR,
  ...
)
```

### Step 2: SELECT 문 작성 (모든 컬럼 캐스팅!)
```sql
SELECT
  a.management_number::VARCHAR,                      -- 1. 직접 선택
  MAX(a.installation_institution)::VARCHAR,          -- 2. 집계 함수
  COALESCE(a.sido, '미정')::VARCHAR,                 -- 3. COALESCE
  (CASE WHEN ... THEN ... END)::VARCHAR,             -- 4. CASE
  (a.sido || '-' || a.gugun)::VARCHAR,               -- 5. 문자열 연결
  COUNT(*)                                            -- 6. 숫자는 그대로
FROM aed_data a
```

### Step 3: 실행 전 재확인
- [ ] 모든 VARCHAR 컬럼에 `::VARCHAR` 캐스팅?
- [ ] 집계 함수 결과에 캐스팅?
- [ ] COALESCE 결과에 캐스팅?
- [ ] CASE WHEN 결과에 캐스팅?
- [ ] 문자열 연결에 캐스팅?

---

## 🎯 aed_data 테이블 전용 캐스팅 규칙

### 항상 캐스팅 필요한 컬럼 (VARCHAR 255)
```sql
-- 관리/식별 정보
equipment_serial::VARCHAR
management_number::VARCHAR
serial_number::VARCHAR

-- 설치 정보
installation_institution::VARCHAR      -- ⚠️ NOT institution_name
installation_address::VARCHAR
installation_location_address::VARCHAR
installation_position::VARCHAR

-- 지역 정보
sido::VARCHAR                          -- ⚠️ NOT region_code
gugun::VARCHAR                         -- ⚠️ NOT city_code
jurisdiction_health_center::VARCHAR    -- ⚠️ NOT health_center_id

-- 분류 정보
category_1::VARCHAR                    -- ⚠️ NOT category
category_2::VARCHAR
category_3::VARCHAR

-- 기타
operation_status::VARCHAR
display_allowed::VARCHAR
model_name::VARCHAR
manufacturer::VARCHAR
```

### 캐스팅 불필요 (이미 정확한 타입)
```sql
-- 숫자
id                          -- BIGINT
longitude::NUMERIC          -- NUMERIC
latitude::NUMERIC           -- NUMERIC

-- 날짜
installation_date::DATE     -- DATE
last_inspection_date::DATE  -- DATE

-- 타임스탬프
created_at::TIMESTAMPTZ     -- TIMESTAMPTZ
updated_at::TIMESTAMPTZ     -- TIMESTAMPTZ
```

---

## 🔧 실전 예제

### 예제 1: get_sample_management_numbers
```sql
CREATE OR REPLACE FUNCTION get_sample_management_numbers(...)
RETURNS TABLE (
  management_number VARCHAR,           -- VARCHAR 선언
  installation_institution VARCHAR,
  sido VARCHAR,
  gugun VARCHAR,
  category_1 VARCHAR,
  equipment_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.management_number::VARCHAR,                          -- ✅ 캐스팅
    MAX(a.installation_institution)::VARCHAR,              -- ✅ 집계+캐스팅
    MAX(a.sido)::VARCHAR,                                  -- ✅ 집계+캐스팅
    MAX(a.gugun)::VARCHAR,                                 -- ✅ 집계+캐스팅
    MAX(a.category_1)::VARCHAR,                            -- ✅ 집계+캐스팅
    COUNT(*) as equipment_count                            -- ✅ BIGINT 그대로
  FROM aed_data a
  GROUP BY a.management_number;
END;
$$ LANGUAGE plpgsql;
```

### 예제 2: COALESCE + 문자열 연결
```sql
RETURNS TABLE (full_address VARCHAR) AS $$
  SELECT
    (COALESCE(sido, '미정') || ' ' || COALESCE(gugun, ''))::VARCHAR
  FROM aed_data;
$$;
```

---

## 🚫 절대 하지 말아야 할 것

### 1. "아마도 암묵적 변환될 거야" ❌
```sql
-- ❌ 절대 금지
SELECT sido FROM aed_data;  -- TEXT 반환
-- 함수: RETURNS TABLE (sido VARCHAR)
-- 결과: ERROR!
```

### 2. "테스트 없이 배포" ❌
```sql
-- 함수 작성 후 반드시 실행 테스트!
SELECT * FROM your_new_function(params);
```

### 3. "일부만 캐스팅" ❌
```sql
-- ❌ 일부만
SELECT management_number::VARCHAR, sido FROM aed_data;

-- ✅ 모두
SELECT management_number::VARCHAR, sido::VARCHAR FROM aed_data;
```

---

## 📊 에러 메시지 해독

### 에러 1
```
ERROR: structure of query does not match function result type
DETAIL: Returned type text does not match expected type character varying in column 2
```
**해결**: column 2 (두 번째 컬럼)에 `::VARCHAR` 추가

### 에러 2
```
DETAIL: Returned type character varying does not match expected type text in column 3
```
**해결**: column 3을 `TEXT` → `VARCHAR`로 변경 OR `::TEXT` 캐스팅

---

## ✅ 최종 체크리스트

함수 작성 완료 후:
- [ ] `information_schema.columns`로 실제 타입 확인했는가?
- [ ] 모든 VARCHAR 컬럼에 `::VARCHAR` 추가했는가?
- [ ] 집계 함수 결과에 캐스팅 추가했는가?
- [ ] COALESCE/CASE 결과에 캐스팅 추가했는가?
- [ ] 실제로 함수를 실행해서 테스트했는가?
- [ ] 에러 없이 결과가 반환되는가?

**모두 YES면 배포 가능!**

---

## 🎓 교훈

1. **PostgreSQL은 타입에 매우 엄격함**
2. **명시적 캐스팅이 유일한 해결책**
3. **"아마도"는 없다 - 항상 캐스팅**
4. **테스트 없이 배포 금지**
5. **에러 메시지를 정확히 읽기**

---

**작성일: 2025-10-04**
**경험: 40번의 시행착오 끝에 얻은 교훈**
