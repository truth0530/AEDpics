# PostgreSQL Migration 종합 가이드

**작성일**: 2025-10-04
**목적**: Migration 작성 시 필요한 모든 정보를 한 곳에 통합

---

## 📚 목차

1. [최우선 규칙](#최우선-규칙)
2. [실제 스키마 참조](#실제-스키마-참조)
3. [타입 캐스팅 필수 규칙](#타입-캐스팅-필수-규칙)
4. [함수 작성 가이드](#함수-작성-가이드)
5. [Migration 파일 현황](#migration-파일-현황)
6. [에러 해결 가이드](#에러-해결-가이드)
7. [실행 방법](#실행-방법)
8. [체크리스트](#체크리스트)

---

## 🚨 최우선 규칙

### 규칙 0: 기존 문서 필수 참조
**새로운 RPC 함수 작성 시 반드시 참조할 파일**:
- ⭐ **`40_fix_varchar_text_mismatch.sql`** - 최종 성공 버전 (유일한 참조 기준)
- ✅ **`47_target_matching_ui_functions.sql`** - VARCHAR 캐스팅 완벽 적용 사례
- ❌ **절대 참조 금지**: `09_aed_query_functions.sql`, `23_aed_query_functions_complete.sql`

### 규칙 1: 타입 캐스팅 필수
**모든 VARCHAR 컬럼은 반드시 명시적 캐스팅**

```sql
-- ❌ 절대 금지
SELECT installation_institution FROM aed_data;  -- TEXT 반환

-- ✅ 항상 이렇게
SELECT installation_institution::VARCHAR FROM aed_data;  -- VARCHAR 반환
```

**특히 위험한 경우** (암묵적으로 TEXT 반환):
- `MAX()`, `MIN()`, `STRING_AGG()` → **TEXT 반환**
- `COALESCE()` → **TEXT 반환**
- `CASE WHEN ... THEN ... END` → **TEXT 반환**
- 문자열 연결 (`||`) → **TEXT 반환**

**해결책**: 모든 경우에 `::VARCHAR` 추가!

```sql
-- ✅ 올바른 예제
SELECT
  MAX(installation_institution)::VARCHAR,
  COALESCE(sido, '미정')::VARCHAR,
  (CASE WHEN a.sido IS NOT NULL THEN a.sido ELSE '미정' END)::VARCHAR,
  (a.sido || '-' || a.gugun)::VARCHAR
FROM aed_data a;
```

### 규칙 2: 실제 스키마만 사용
**존재하지 않는 컬럼 절대 사용 금지**

```sql
-- ❌ 절대 금지 (존재하지 않는 컬럼)
health_center_id      -- 실제: jurisdiction_health_center (VARCHAR)
region_code           -- 실제: sido (VARCHAR)
city_code             -- 실제: gugun (VARCHAR)
device_serial         -- 실제: equipment_serial (VARCHAR)
device_serial_number  -- 실제: serial_number (VARCHAR)
institution_name      -- 실제: installation_institution (VARCHAR)
category              -- 실제: category_1, category_2, category_3 (VARCHAR)
```

### 규칙 3: 함수 시그니처 정확히 매칭
**DROP FUNCTION 시 반드시 정확한 시그니처 사용**

```sql
-- ❌ 잘못된 예 (함수를 찾을 수 없음)
DROP FUNCTION IF EXISTS get_aed_data_filtered(TEXT, UUID, ...);

-- ✅ 올바른 예 (Migration 40 참조)
DROP FUNCTION IF EXISTS public.get_aed_data_filtered(
  UUID,           -- p_health_center_id
  TEXT[],         -- p_region_codes
  TEXT[],         -- p_city_codes
  TEXT[],         -- p_category_1 (배열!)
  TEXT[],         -- p_category_2 (배열!)
  TEXT[],         -- p_category_3 (배열!)
  TEXT,           -- p_search
  INTEGER,        -- p_limit
  INTEGER,        -- p_offset
  DOUBLE PRECISION,  -- user_org_lat
  DOUBLE PRECISION   -- user_org_lng
) CASCADE;
```

**에러 예시**:
```
ERROR: 42725: function name "get_aed_data_filtered" is not unique
HINT: Specify the argument list to select the function unambiguously.
```
→ **원인**: DROP 시그니처가 실제 함수와 다름
→ **해결**: Migration 40의 정확한 시그니처 사용

---

## 📊 실제 스키마 참조

### aed_data 테이블 (실제 DB 확인됨)

#### ✅ 존재하는 컬럼

```sql
-- 기본 식별자
id                              BIGINT NOT NULL (NOT integer, NOT uuid)
sido                            VARCHAR (NOT region_code)
gugun                           VARCHAR NOT NULL (NOT city_code)
management_number               VARCHAR NOT NULL
equipment_serial                VARCHAR NOT NULL (NOT device_serial)

-- 상태 정보
operation_status                VARCHAR NOT NULL
display_allowed                 VARCHAR NOT NULL
external_display                VARCHAR NOT NULL
external_non_display_reason     VARCHAR
government_support              VARCHAR

-- 날짜 정보
report_date                     DATE
first_installation_date         DATE
installation_date               DATE NOT NULL
last_inspection_date            DATE
last_use_date                   NUMERIC  -- ⚠️ DATE가 아니라 NUMERIC임!
battery_expiry_date             DATE
patch_expiry_date               DATE
replacement_date                DATE
registration_date               DATE NOT NULL
manufacturing_date              DATE

-- 설치/위치 정보
installation_institution        VARCHAR NOT NULL (NOT institution_name)
installation_address            VARCHAR
installation_location_address   VARCHAR NOT NULL
installation_position           VARCHAR
jurisdiction_health_center      VARCHAR (NOT health_center_id uuid)

-- 분류
category_1                      VARCHAR NOT NULL
category_2                      VARCHAR NOT NULL
category_3                      VARCHAR NOT NULL

-- 설치 방법 및 관리
installation_method             VARCHAR
institution_contact             VARCHAR
establisher                     VARCHAR
manager                         VARCHAR

-- GPS 좌표
longitude                       NUMERIC
latitude                        NUMERIC

-- 장비 정보
model_name                      VARCHAR
manufacturer                    VARCHAR
manufacturing_country           VARCHAR
serial_number                   VARCHAR  -- ⚠️ device_serial_number가 아님!

-- 패드/패치
patch_available                 VARCHAR

-- 구매 및 교체
purchase_institution            VARCHAR
remarks                         VARCHAR

-- 삭제/상태
saeum_deletion_status           VARCHAR NOT NULL

-- 시스템
created_at                      TIMESTAMP
updated_at                      TIMESTAMP
data_status                     TEXT
first_seen_date                 DATE
last_seen_date                  DATE
consecutive_missing_days        INTEGER
deletion_suspected_date         DATE
sync_batch_id                   TEXT
```

#### ❌ 존재하지 않는 컬럼 (절대 사용 금지)

```
health_center_id     -- ❌ 없음! jurisdiction_health_center (VARCHAR)만 있음
region_code          -- ❌ 없음! sido (VARCHAR)만 있음
city_code            -- ❌ 없음! gugun (VARCHAR)만 있음
device_serial        -- ❌ 없음! equipment_serial (VARCHAR)만 있음
device_serial_number -- ❌ 없음! serial_number (VARCHAR)만 있음
institution_name     -- ❌ 없음! installation_institution (VARCHAR)만 있음
category             -- ❌ 없음! category_1, category_2, category_3만 있음
```

### organizations 테이블

```sql
id           UUID PRIMARY KEY
name         TEXT NOT NULL
type         TEXT NOT NULL
parent_id    UUID REFERENCES organizations(id)
region_code  TEXT      -- ⚠️ '서울', 'SEO' 등 (코드/이름 혼용)
city_code    TEXT      -- ⚠️ '강남구' 등 (이름)
region       TEXT      -- ⚠️ '서울' 등 (이름)
address      TEXT
contact      TEXT
latitude     DOUBLE PRECISION  -- Migration 31에서 추가
longitude    DOUBLE PRECISION  -- Migration 31에서 추가
created_at   TIMESTAMPTZ DEFAULT NOW()
updated_at   TIMESTAMPTZ DEFAULT NOW()
```

**주의사항**:
- `organizations.region_code`: 'SEO', 'BUS' 등 코드 또는 '서울특별시' 등 이름
- `organizations.city_code`: '강남구', '중구' 등 구군 이름
- `aed_data.sido`: '서울특별시', '부산광역시' 등 전체 이름
- `aed_data.gugun`: '중구', '강남구' 등 구군 이름

---

## 🔥 타입 캐스팅 필수 규칙

### PostgreSQL의 타입 시스템

**PostgreSQL은 타입에 매우 엄격함**:
- TEXT와 VARCHAR는 **암묵적 변환이 안 될 수 있음**
- RETURNS TABLE의 타입과 SELECT 결과 타입이 **정확히 일치해야 함**

### 문제 사례

```
ERROR: 42804: structure of query does not match function result type
DETAIL: Returned type character varying(255) does not match expected type text in column 2.
```

**원인**:
- `aed_data` 테이블의 많은 컬럼이 `character varying(255)` 타입
- 함수에서는 `TEXT` 타입으로 반환하려 했으나 암묵적 변환 실패

### 해결 방법

#### ❌ 잘못된 방법
```sql
RETURNS TABLE (
  device_serial TEXT,
  management_number TEXT
)
...
SELECT
  ad.equipment_serial AS device_serial,  -- VARCHAR(255) → TEXT 암묵적 변환 실패
  ad.management_number                   -- VARCHAR(255) → TEXT 암묵적 변환 실패
```

#### ✅ 올바른 방법 1: RETURNS TABLE을 VARCHAR로
```sql
RETURNS TABLE (
  device_serial VARCHAR,      -- VARCHAR로 선언
  management_number VARCHAR
)
...
SELECT
  ad.equipment_serial,        -- VARCHAR 그대로
  ad.management_number        -- VARCHAR 그대로
```

#### ✅ 올바른 방법 2: SELECT에서 명시적 캐스팅
```sql
RETURNS TABLE (
  device_serial TEXT,
  management_number TEXT
)
...
SELECT
  ad.equipment_serial::TEXT,         -- 명시적 캐스팅
  ad.management_number::TEXT         -- 명시적 캐스팅
```

### Migration 40의 접근법 (권장)

Migration 40은 **RETURNS TABLE을 VARCHAR로 선언**하고 **명시적 캐스팅 없이 사용**:

```sql
RETURNS TABLE (
  device_serial VARCHAR,
  management_number VARCHAR,
  installation_org VARCHAR,
  sido VARCHAR,
  gugun VARCHAR,
  category_1 VARCHAR,
  category_2 VARCHAR,
  category_3 VARCHAR
  -- ... 모두 VARCHAR
)
...
SELECT
  a.equipment_serial,              -- VARCHAR → VARCHAR (자동 매칭)
  a.management_number,             -- VARCHAR → VARCHAR (자동 매칭)
  a.installation_institution,      -- VARCHAR → VARCHAR (자동 매칭)
  a.sido,                          -- VARCHAR → VARCHAR (자동 매칭)
  a.gugun,                         -- VARCHAR → VARCHAR (자동 매칭)
  a.category_1,                    -- VARCHAR → VARCHAR (자동 매칭)
  a.category_2,                    -- VARCHAR → VARCHAR (자동 매칭)
  a.category_3                     -- VARCHAR → VARCHAR (자동 매칭)
FROM aed_data a
```

### Migration 47의 접근법 (엄격한 캐스팅)

Migration 47은 **모든 VARCHAR 컬럼에 명시적 캐스팅**:

```sql
RETURNS TABLE (
  management_number VARCHAR,
  aed_institution VARCHAR,
  sido VARCHAR,
  gugun VARCHAR
)
...
WITH aed_summary AS (
  SELECT
    a.management_number::VARCHAR,                      -- 명시적 캐스팅
    MAX(a.installation_institution)::VARCHAR,          -- MAX() 결과도 캐스팅
    MAX(a.sido)::VARCHAR,                              -- MAX() 결과도 캐스팅
    MAX(a.gugun)::VARCHAR                              -- MAX() 결과도 캐스팅
  FROM aed_data a
  GROUP BY a.management_number
)
SELECT
  m.management_number::VARCHAR,    -- 재캐스팅 (안전)
  a.aed_institution::VARCHAR,      -- 재캐스팅 (안전)
  a.sido::VARCHAR,                 -- 재캐스팅 (안전)
  a.gugun::VARCHAR                 -- 재캐스팅 (안전)
```

**Migration 47이 더 엄격한 이유**:
- CTE에서 집계 함수 사용 (MAX, MIN 등은 TEXT 반환)
- 여러 테이블 조인 시 타입 혼란 방지
- 재캐스팅으로 완벽한 타입 안정성 보장

### 권장 접근법

**신규 함수 작성 시**:
1. **RETURNS TABLE을 VARCHAR로 선언** (Migration 40 방식)
2. **집계 함수/COALESCE/CASE 사용 시 명시적 캐스팅** (Migration 47 방식)
3. **의심스러우면 명시적 캐스팅 추가** (안전 우선)

```sql
-- ✅ 안전한 패턴
RETURNS TABLE (
  id TEXT,                    -- id::TEXT로 캐스팅 필요 (BIGINT → TEXT)
  device_serial VARCHAR,      -- VARCHAR 그대로
  management_number VARCHAR,  -- VARCHAR 그대로
  max_sido VARCHAR            -- MAX() 결과는 캐스팅 필요
)
...
SELECT
  a.id::TEXT,                           -- BIGINT → TEXT 캐스팅
  a.equipment_serial,                   -- VARCHAR 그대로
  a.management_number,                  -- VARCHAR 그대로
  MAX(a.sido)::VARCHAR AS max_sido      -- MAX() 결과 캐스팅
FROM aed_data a
```

### COALESCE 결과도 캐스팅

```sql
-- ❌ 잘못된 예
COALESCE(a.sido, '미정') AS sido  -- TEXT 반환

-- ✅ 올바른 예
COALESCE(a.sido, '미정')::VARCHAR AS sido  -- VARCHAR 반환
```

### CASE 문 결과도 캐스팅

```sql
-- ❌ 잘못된 예
CASE
  WHEN a.sido IS NOT NULL THEN a.sido
  ELSE '미정'
END AS sido  -- TEXT 반환

-- ✅ 올바른 예
(CASE
  WHEN a.sido IS NOT NULL THEN a.sido
  ELSE '미정'
END)::VARCHAR AS sido  -- VARCHAR 반환
```

---

## 📝 함수 작성 가이드

### 1. 타입 확인

**함수 작성 전에 반드시 실제 테이블 스키마 확인**:

```sql
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'aed_data'
ORDER BY ordinal_position;
```

### 2. VARCHAR 필드 처리

`aed_data` 테이블의 VARCHAR 필드들 (모두 `::VARCHAR` 캐스팅 권장):

```sql
equipment_serial                 -- character varying(255)
management_number                -- character varying(255)
installation_institution         -- character varying(255) ⚠️ NOT institution_name
installation_address             -- character varying(255)
installation_position            -- character varying(255)
jurisdiction_health_center       -- character varying(255) ⚠️ NOT health_center_id
institution_contact              -- character varying(255)
sido                             -- character varying(255) ⚠️ NOT region_code
gugun                            -- character varying(255) ⚠️ NOT city_code
category_1, category_2, category_3  -- character varying(255) ⚠️ NOT category
```

### 3. 함수 시그니처 작성 (Migration 40 참조)

```sql
-- Migration 40의 정확한 시그니처
CREATE FUNCTION public.get_aed_data_filtered(
  p_health_center_id UUID DEFAULT NULL,
  p_region_codes TEXT[] DEFAULT NULL,         -- 배열
  p_city_codes TEXT[] DEFAULT NULL,           -- 배열
  p_category_1 TEXT[] DEFAULT NULL,           -- 배열 (주의!)
  p_category_2 TEXT[] DEFAULT NULL,           -- 배열 (주의!)
  p_category_3 TEXT[] DEFAULT NULL,           -- 배열 (주의!)
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  user_org_lat DOUBLE PRECISION DEFAULT NULL,
  user_org_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,                           -- BIGINT를 TEXT로 캐스팅
  device_serial VARCHAR,             -- VARCHAR 그대로
  management_number VARCHAR,         -- VARCHAR 그대로
  installation_org VARCHAR,          -- installation_institution
  address VARCHAR,                   -- installation_address
  detailed_address VARCHAR,          -- installation_position
  jurisdiction_health_center VARCHAR,
  latitude NUMERIC,
  longitude NUMERIC,
  expiry_date DATE,
  days_until_expiry INT,
  device_status VARCHAR,             -- operation_status
  is_public_visible BOOLEAN,
  contact_phone VARCHAR,             -- institution_contact
  contact_email TEXT,
  has_sensitive_data BOOLEAN,
  last_inspection_date DATE,
  installation_date DATE,
  category_1 VARCHAR,
  category_2 VARCHAR,
  category_3 VARCHAR,
  sido VARCHAR,
  gugun VARCHAR,
  operation_status VARCHAR,
  external_display VARCHAR,
  external_non_display_reason VARCHAR,
  battery_expiry_date DATE,
  patch_expiry_date DATE,
  replacement_date DATE,
  model_name VARCHAR,
  manufacturer VARCHAR,
  display_allowed VARCHAR,
  installation_method VARCHAR,
  registration_date DATE,
  manufacturing_date DATE,
  manufacturing_country VARCHAR,
  serial_number VARCHAR,
  establisher VARCHAR,
  government_support VARCHAR,
  patch_available VARCHAR,
  remarks VARCHAR,
  first_installation_date DATE,
  last_use_date NUMERIC,             -- ⚠️ NUMERIC (NOT DATE)
  manager VARCHAR,
  purchase_institution VARCHAR,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $BODY$
...
$BODY$;
```

### 4. 함수 테스트

**마이그레이션 파일 작성 후 반드시 직접 실행 테스트**:

```sql
-- 실제 함수 호출 테스트
SELECT * FROM get_aed_data_filtered(
  NULL,     -- p_health_center_id
  NULL,     -- p_region_codes
  NULL,     -- p_city_codes
  NULL,     -- p_category_1
  NULL,     -- p_category_2
  NULL,     -- p_category_3
  NULL,     -- p_search
  10,       -- p_limit
  0         -- p_offset
);
```

### 5. 스키마 캐시 갱신

**Supabase에서 함수 변경 후 반드시 실행**:

```sql
NOTIFY pgrst, 'reload schema';
```

---

## 📂 Migration 파일 현황

### ✅ 현재 유지 중인 Migration (31개 + 신규 1개)

#### 기본 스키마 (01-06)
1. `01_initial_schema.sql` - 기본 테이블 (organizations, user_profiles)
2. `02_initial_data.sql` - 초기 데이터
3. `03_rls_policies.sql` - Row Level Security 정책
4. `04_aed_tables.sql` - AED 데이터 테이블
5. `05_team_management.sql` - 팀 관리 기능
6. `06_fix_inspection_schema.sql` - 점검 스키마 수정

#### 핵심 기능 (10-20)
7. `10_aed_data_rls_policy.sql` - AED 데이터 RLS 정책
8. `11_create_notifications.sql` - 알림 테이블 생성
9. `12_fix_notification_policies.sql` - 알림 정책 수정
10. `13_add_last_login.sql` - 마지막 로그인 추적
11. `14_login_tracking.sql` - 로그인 이력 추적
12. `15_organization_changes.sql` - 조직 구조 변경
13. `16_inspection_schedule_entries.sql` - 점검 스케줄 관리
14. `17_duplicate_equipment_handling.sql` - 중복 장비 처리
15. `18_notification_system.sql` - 알림 시스템 개선
16. `19_gps_issues_table.sql` - GPS 이슈 추적
17. `20_create_inspection_sessions.sql` - 점검 세션 관리

#### 추가 기능 (25-31)
18. `25_otp_rate_limiting.sql` - OTP 요청 제한
19. `28_add_field_changes_to_sessions.sql` - 필드 변경 추적
20. `31_add_coordinates_to_organizations.sql` - 조직 좌표 추가

#### 2025년 9월 추가 기능
21. `20250927_create_missing_tables.sql` - 누락 테이블 생성
22. `20250927_create_audit_logs.sql` - 감사 로그 테이블
23. `20250927_safe_audit_logs_setup.sql` - 안전한 감사 로그 설정

#### ⭐ 최종 RPC 함수 (중요!)
24. **`40_fix_varchar_text_mismatch.sql`** - get_aed_data_filtered 최종 성공 버전
    - ✅ VARCHAR 타입 정확히 매칭
    - ✅ 실제 스키마 기반
    - ✅ 존재하지 않는 컬럼 제거 완료
    - ✅ **유일한 참조 기준**

#### 🆕 구비의무기관 매칭 시스템 (41-47)
25. `41_target_list_2024_upload.sql` - 구비의무기관 리스트 (26,724개)
26. `42_target_key_generation.sql` - target_key 자동 생성
27. `43_aed_target_mapping.sql` - AED ↔ 구비의무기관 영속성 매핑
28. `44_auto_matching_function.sql` - 장비연번 기반 자동 매칭
29. `45_fix_one_to_many_mapping.sql` - 1:N 매핑 지원 (1 기관 → N 관리번호)
30. `46_auto_match_management_number.sql` - 관리번호 기반 그룹 매칭
31. `47_target_matching_ui_functions.sql` - 매칭 관리 UI 지원 함수
    - `get_target_matching_list_2024()` - UI용 매칭 목록 조회
    - 신뢰도/지역/검색/확정 여부 필터링
    - ⚠️ **모든 VARCHAR 컬럼에 ::VARCHAR 캐스팅 완벽 적용**

#### 🚀 2025-10-04 신규
32. **`48_fix_rpc_schema_mismatch.sql`** - 관할보건소기준 조회 수정 + 헤더 필터 통합
    - `get_aed_data_filtered()` 함수: sido/gugun 파라미터 추가
    - `get_aed_data_by_jurisdiction()` 함수: 새로 생성
    - Migration 40 시그니처 준수
    - RETURNS TABLE 구조 동일하게 유지

### 🗑️ 보관된 파일 (_archive_failed_attempts/)

#### 잘못된 스키마를 가진 RPC 함수들
- `07_health_center_mapping.sql` - 잘못된 health_center_id 사용
- `08_health_center_initial_data.sql` - 잘못된 스키마 데이터
- ❌ **`09_aed_query_functions.sql`** - 오래된 RPC 함수 (절대 참조 금지!)
- ❌ **`23_aed_query_functions_complete.sql`** - 오래된 RPC 함수 (절대 참조 금지!)

#### 롤백/중복 파일
- `26_region_code_migration.sql` - 잘못된 region_code 추가 시도
- `26_region_code_migration_rollback.sql` - 위의 롤백
- `27_persistent_mapping_table.sql` - region_code 매핑 테이블 (불필요)

#### 실패한 시도 (30-39)
- `30-39번` - 모두 잘못된 스키마 참조로 실패
  - **원인**: health_center_id, region_code, city_code 등 존재하지 않는 컬럼 참조
  - **교훈**: 절대 추측하지 말 것, 반드시 실제 스키마 확인

#### 임시/테스트 파일
- `APPLY_PENDING_MIGRATIONS.sql` - 임시 실행 파일
- ❌ **`ESSENTIAL_MIGRATIONS_2025_10_04_v3.sql`** - 잘못된 스키마 포함 (혼란의 근원)
- `RUN_THIS_FOR_AED_MAP.sql` - 임시 실행 파일

### 📋 Migration 실행 순서

**프로덕션 DB에 새로 적용 시**:
```
01 → 02 → 03 → 04 → 05 → 06 →
10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 →
25 → 28 → 31 →
20250927 (missing_tables) → 20250927 (audit_logs) → 20250927 (safe_audit) →
40 (최종 RPC 함수) →
41 (target_list) → 42 (target_key) → 43 (mapping) →
44 (auto_match) → 45 (1:N) → 46 (mgmt_number) → 47 (UI 함수) →
48 (관할보건소 + 헤더 필터)
```

---

## 🚨 에러 해결 가이드

### 1. 타입 불일치 에러

```
ERROR: 42804: structure of query does not match function result type
DETAIL: Returned type text does not match expected type character varying in column X
```

**해결**:
1. column X 확인 (X번째 컬럼, 1부터 시작)
2. RETURNS TABLE의 X번째 컬럼 타입 확인
3. SELECT 문의 해당 필드에 `::VARCHAR` 또는 `::TEXT` 추가
4. 재실행

**에러 메시지 읽기**:
```
DETAIL: Returned type character varying(255) does not match expected type text in column 2.
```
- **column 2**: RETURNS TABLE의 두 번째 컬럼
- 해당 컬럼이 무엇인지 확인하고 SELECT 문에서 해당 필드 찾기

### 2. 컬럼 존재하지 않음 에러

```
ERROR: column "institution_name" does not exist
```

**해결**:
1. 실제 컬럼명 확인 (`installation_institution`)
2. 올바른 컬럼명으로 변경
3. 재실행

**컬럼 존재 여부 확인**:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'aed_data'
  AND column_name IN ('category', 'institution_name', 'region_code');
-- 결과가 0건이면 컬럼이 없는 것!
```

### 3. 함수명 중복 에러

```
ERROR: 42725: function name "get_aed_data_filtered" is not unique
HINT: Specify the argument list to select the function unambiguously.
```

**원인**: DROP FUNCTION 시그니처가 실제 함수와 다름

**해결**:
1. 기존 함수의 정확한 시그니처 확인 (Migration 40 참조)
2. DROP FUNCTION에 정확한 파라미터 타입 리스트 작성
3. 재실행

**정확한 시그니처 확인 방법**:
```sql
-- 함수 정의 확인
\df+ get_aed_data_filtered

-- 또는
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'get_aed_data_filtered';
```

### 4. Supabase PostgREST 캐시 문제

**증상**: 함수를 수정했는데도 에러가 계속됨

**해결**:
1. `NOTIFY pgrst, 'reload schema';` 실행
2. Supabase 프로젝트 재시작 (Dashboard > Settings > Restart)
3. 개발 서버 재시작 (`npm run dev` 종료 후 재실행)

---

## 📊 실행 방법

### 1. Supabase Dashboard 사용 (권장)

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. **SQL Editor** 메뉴 클릭
4. **New Query** 버튼 클릭
5. Migration 파일 내용 복사
6. 붙여넣기 후 **Run** 버튼 클릭
7. 성공 메시지 확인

### 2. Supabase CLI 사용

```bash
# Supabase 프로젝트 연결 (최초 1회)
cd /path/to/aed-check-system
npx supabase link --project-ref YOUR_PROJECT_REF

# 마이그레이션 푸시
npx supabase db push
```

### 3. psql 직접 연결

```bash
psql "postgresql://postgres:PASSWORD@HOST:5432/postgres" \
  -f supabase/migrations/48_fix_rpc_schema_mismatch.sql
```

### 4. 함수 생성 확인

```sql
-- 함수 존재 확인
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN ('get_aed_data_filtered', 'get_aed_data_by_jurisdiction');

-- 결과:
-- routine_name                    | routine_type
-- -------------------------------|-------------
-- get_aed_data_filtered          | FUNCTION
-- get_aed_data_by_jurisdiction   | FUNCTION
```

---

## ✅ 체크리스트

### 작성 전
- [ ] Migration 40 (`40_fix_varchar_text_mismatch.sql`) 읽음
- [ ] Migration 47 (`47_target_matching_ui_functions.sql`) 읽음 (캐스팅 예시)
- [ ] `information_schema.columns`로 실제 스키마 확인
- [ ] 존재하지 않는 컬럼 사용 안 함 확인
- [ ] 절대 참조 금지 파일(09, 23번) 참조 안 함 확인

### 작성 중
- [ ] 모든 VARCHAR 컬럼에 명시적 캐스팅 (또는 RETURNS TABLE을 VARCHAR로)
- [ ] 집계 함수 결과에 `::VARCHAR` 캐스팅
- [ ] COALESCE 결과에 `::VARCHAR` 캐스팅
- [ ] CASE WHEN 결과에 `::VARCHAR` 캐스팅
- [ ] 문자열 연결 (`||`) 결과에 `::VARCHAR` 캐스팅
- [ ] DROP FUNCTION 시그니처가 정확한지 확인

### 작성 후
- [ ] Supabase SQL Editor에서 실제 실행 테스트
- [ ] 에러 없이 결과 반환 확인
- [ ] 타입 불일치 에러 없음 확인
- [ ] `NOTIFY pgrst, 'reload schema';` 실행
- [ ] 함수 생성 확인 (`information_schema.routines`)

### 배포 후
- [ ] API 호출 테스트 (실제 애플리케이션에서)
- [ ] 브라우저 콘솔 에러 확인
- [ ] 예상되는 데이터 반환 확인

**모두 체크했으면 배포 가능!**

---

## 🎓 교훈 (40번의 시행착오)

1. **PostgreSQL은 타입에 매우 엄격함** - TEXT와 VARCHAR는 암묵적 변환이 안 될 수 있음
2. **명시적 캐스팅이 항상 안전함** - 의심스러우면 `::VARCHAR` 추가
3. **함수 시그니처와 구현체의 완벽한 일치** - RETURNS TABLE과 SELECT 결과 타입이 정확히 동일해야 함
4. **테스트는 실제 데이터로** - 마이그레이션 실행 후 반드시 SELECT 테스트
5. **원본 작동 코드를 참고** - Migration 40번을 기준으로 삼을 것
6. **절대 컬럼명을 추측하지 말 것** - `information_schema.columns` 필수 확인 ⭐
7. **40번 이후 시행착오 끝** - 40번과 47번을 참조 기준으로 유지
8. **DROP FUNCTION 시그니처 정확히** - 파라미터 타입과 순서가 정확해야 함

---

## 📚 참고 문서

### 필수 참조
- ⭐ **`40_fix_varchar_text_mismatch.sql`** - 최종 성공 버전
- ✅ **`47_target_matching_ui_functions.sql`** - VARCHAR 캐스팅 완벽 예시
- 📖 **`ACTUAL_SCHEMA_REFERENCE.md`** - 실제 스키마 정의
- 📖 **`COMPLETE_MIGRATION_GUIDE.md`** - 상세 가이드 (있다면)

### 절대 참조 금지
- ❌ **`09_aed_query_functions.sql`** - 잘못된 스키마
- ❌ **`23_aed_query_functions_complete.sql`** - 잘못된 스키마
- ❌ **`ESSENTIAL_MIGRATIONS_2025_10_04_v3.sql`** - 잘못된 스키마

---

## 🎯 최종 확인 (2025-10-04)

- ✅ 실제 DB 스키마 확인 완료
- ✅ 타입 캐스팅 규칙 문서화 완료
- ✅ 40번의 시행착오 끝에 성공
- ✅ 재발 방지 체크리스트 완성
- ✅ Migration 40, 47번 참조 기준 확립
- ✅ Migration 48번 작성 완료 (관할보건소 + 헤더 필터)

**이제 더 이상 같은 실수를 반복하지 않습니다!**

---

**최종 업데이트**: 2025-10-04
**작성자**: Claude
**버전**: 1.0 (통합 가이드)
