# ⚠️ MIGRATION 경고

## 실행 전 필수 확인

**Migration을 작성하거나 실행하기 전에 반드시 이 문서를 읽으세요.**

---

## 🚨 최우선 규칙 (2025-10-04 업데이트)

### 규칙 1: 타입 캐스팅 필수!
**모든 VARCHAR 컬럼은 반드시 `::VARCHAR` 캐스팅**

```sql
-- ❌ 절대 금지
SELECT installation_institution FROM aed_data;  -- TEXT 반환

-- ✅ 항상 이렇게
SELECT installation_institution::VARCHAR FROM aed_data;  -- VARCHAR 반환
```

**특히 위험한 경우**:
- `MAX()`, `MIN()`, `STRING_AGG()` → TEXT 반환
- `COALESCE()` → TEXT 반환
- `CASE WHEN` → TEXT 반환
- 문자열 연결 (`||`) → TEXT 반환

**해결책**: 모든 경우에 `::VARCHAR` 추가!

```sql
-- ✅ 올바른 예제
SELECT
  MAX(installation_institution)::VARCHAR,
  COALESCE(sido, '미정')::VARCHAR,
  (CASE WHEN ... THEN ... END)::VARCHAR,
  (sido || '-' || gugun)::VARCHAR
FROM aed_data;
```

---

## ❌ 절대 사용 금지 컬럼

다음 컬럼들은 `aed_data` 테이블에 **존재하지 않습니다**:

```
health_center_id      -- ❌ 없음 (실제: jurisdiction_health_center)
region_code           -- ❌ 없음 (실제: sido)
city_code             -- ❌ 없음 (실제: gugun)
device_serial         -- ❌ 없음 (실제: equipment_serial)
device_serial_number  -- ❌ 없음 (실제: serial_number)
institution_name      -- ❌ 없음 (실제: installation_institution)
category              -- ❌ 없음 (실제: category_1, category_2, category_3)
```

---

## ✅ 실제 존재하는 컬럼

```sql
-- 식별자
id                              bigint (NOT integer, NOT uuid)
equipment_serial                varchar (NOT device_serial) ⚠️ ::VARCHAR 필수
serial_number                   varchar (NOT device_serial_number) ⚠️ ::VARCHAR 필수

-- 설치 정보
installation_institution        varchar (NOT institution_name) ⚠️ ::VARCHAR 필수
installation_address            varchar ⚠️ ::VARCHAR 필수
installation_location_address   varchar ⚠️ ::VARCHAR 필수
installation_position           varchar ⚠️ ::VARCHAR 필수

-- 지역
sido                            varchar (NOT region_code) ⚠️ ::VARCHAR 필수
gugun                           varchar (NOT city_code) ⚠️ ::VARCHAR 필수

-- 분류
category_1                      varchar (NOT category) ⚠️ ::VARCHAR 필수
category_2                      varchar ⚠️ ::VARCHAR 필수
category_3                      varchar ⚠️ ::VARCHAR 필수

-- 관할
jurisdiction_health_center      varchar (NOT health_center_id uuid) ⚠️ ::VARCHAR 필수
```

---

## 📋 필수 확인 문서

**함수 작성 전 반드시 읽기**:

1. **`/supabase/TYPE_CASTING_MANDATORY_RULES.md`** ⭐ 타입 캐스팅 필수 규칙
2. **`/supabase/ACTUAL_SCHEMA_REFERENCE.md`** - 실제 스키마 정의
3. **`/supabase/COMPLETE_MIGRATION_GUIDE.md`** - Migration 작성 가이드
4. **`/supabase/migrations/README.md`** - 함수 작성 가이드

---

## 🔥 함수 작성 필수 체크리스트

### 작성 전
- [ ] `information_schema.columns`로 실제 스키마 확인
- [ ] `TYPE_CASTING_MANDATORY_RULES.md` 읽음
- [ ] 존재하지 않는 컬럼 사용 안함

### 작성 중
- [ ] 모든 VARCHAR 컬럼에 `::VARCHAR` 캐스팅
- [ ] 집계 함수 결과에 `::VARCHAR` 캐스팅
- [ ] COALESCE 결과에 `::VARCHAR` 캐스팅
- [ ] CASE WHEN 결과에 `::VARCHAR` 캐스팅
- [ ] 문자열 연결 (`||`) 결과에 `::VARCHAR` 캐스팅

### 작성 후
- [ ] Supabase SQL Editor에서 실제 실행 테스트
- [ ] 에러 없이 결과 반환 확인
- [ ] 타입 불일치 에러 없음 확인

**모두 체크했으면 배포 가능!**

---

## 🚫 폐기된 Migration 파일들

다음 migration 파일들은 **잘못된 스키마**를 포함하고 있습니다:

1. `ESSENTIAL_MIGRATIONS_2025_10_04_v3.sql` - ❌ 삭제됨
2. `30_get_aed_by_location.sql` - ⚠️ 잘못된 스키마
3. `32_add_distance_to_rpc.sql` - ⚠️ 잘못된 스키마
4. `33_fix_region_code_references.sql` - ⚠️ 잘못된 스키마
5. `34_fix_all_column_references.sql` - ⚠️ 잘못된 스키마
6. `36-38` - ⚠️ 시도했으나 실패한 수정들

---

## ✅ 올바른 최종 Migration

**Migration 40: `40_fix_varchar_text_mismatch.sql`** ⭐

이것이 실제 스키마에 맞춰 작성된 최종 성공 버전입니다.
- ✅ 모든 VARCHAR 컬럼에 명시적 캐스팅
- ✅ 실제 컬럼명 사용
- ✅ 존재하지 않는 컬럼 완전 제거

**Migration 49: `49_fix_region_short_names.sql`** ✅ (2025-10-04)

지역 이름 매핑 수정 (중요!)
- ✅ 'SEO' → '서울' (❌ NOT '서울특별시')
- ✅ 'BUS' → '부산' (❌ NOT '부산광역시')
- ✅ DB 실제 저장 형식과 일치
- ✅ 지역 필터 검색 정상 작동

---

## ⚠️ 에러 발생 시

### 타입 불일치 에러
```
ERROR: structure of query does not match function result type
DETAIL: Returned type text does not match expected type character varying in column X
```

**해결**:
1. column X 확인 (X번째 컬럼)
2. 해당 컬럼에 `::VARCHAR` 추가
3. 재실행

### 컬럼 존재하지 않음 에러
```
ERROR: column "institution_name" does not exist
```

**해결**:
1. `ACTUAL_SCHEMA_REFERENCE.md` 확인
2. 올바른 컬럼명으로 변경 (`installation_institution`)
3. 재실행

---

## 📊 실행 방법

1. Supabase Dashboard → SQL Editor 열기
2. Migration 파일 내용 복사
3. SQL Editor에 붙여넣기
4. **Run 실행**
5. 에러 없으면 완료!

---

## 🎯 2025-10-04 확인 완료

- ✅ 실제 DB 스키마 확인 완료
- ✅ 타입 캐스팅 규칙 문서화 완료
- ✅ 40번의 시행착오 끝에 성공
- ✅ 재발 방지 체크리스트 완성
- ✅ **Migration 49**: 지역 이름 매핑 수정 완료
- ✅ **중요 발견**: DB는 짧은 이름 저장 ("서울", ❌ NOT "서울특별시")

**이제 더 이상 같은 실수를 반복하지 않습니다!**
