# AED Data 실제 스키마 참조 문서

**⚠️ IMPORTANT: 이 문서는 실제 데이터베이스 스키마를 정확히 반영합니다.**
**함수나 쿼리를 작성할 때 반드시 이 문서를 참조하세요.**

## aed_data 테이블 실제 컬럼 목록

### ✅ 존재하는 컬럼 (실제 DB 확인됨)

```sql
-- 기본 식별자
id                              bigint NOT NULL
sido                            varchar  -- ⚠️ "서울", "부산" 등 짧은 이름 저장 (NOT "서울특별시")
gugun                           varchar NOT NULL
management_number               varchar NOT NULL
equipment_serial                varchar NOT NULL

-- 상태 정보
operation_status                varchar NOT NULL
display_allowed                 varchar NOT NULL
external_display                varchar NOT NULL
external_non_display_reason     varchar
government_support              varchar

-- 날짜 정보
report_date                     date
first_installation_date         date
installation_date               date NOT NULL
last_inspection_date            date
last_use_date                   numeric  -- ⚠️ DATE가 아니라 NUMERIC임!
battery_expiry_date             date
patch_expiry_date               date
replacement_date                date
registration_date               date NOT NULL
manufacturing_date              date

-- 설치/위치 정보
installation_institution        varchar NOT NULL
installation_address            varchar
installation_location_address   varchar NOT NULL
installation_position           varchar
jurisdiction_health_center      varchar

-- 분류
category_1                      varchar NOT NULL
category_2                      varchar NOT NULL
category_3                      varchar NOT NULL

-- 설치 방법 및 관리
installation_method             varchar
institution_contact             varchar
establisher                     varchar
manager                         varchar

-- GPS 좌표
longitude                       numeric
latitude                        numeric

-- 장비 정보
model_name                      varchar
manufacturer                    varchar
manufacturing_country           varchar
serial_number                   varchar  -- ⚠️ device_serial_number가 아님!

-- 패드/패치
patch_available                 varchar

-- 구매 및 교체
purchase_institution            varchar
remarks                         varchar

-- 삭제/상태
saeum_deletion_status           varchar NOT NULL

-- 시스템
created_at                      timestamp
updated_at                      timestamp
data_status                     text
first_seen_date                 date
last_seen_date                  date
consecutive_missing_days        integer
deletion_suspected_date         date
sync_batch_id                   text
```

### ❌ 존재하지 않는 컬럼 (절대 사용 금지)

```
health_center_id     -- ❌ 없음! jurisdiction_health_center (TEXT)만 있음
region_code          -- ❌ 없음! sido (VARCHAR)만 있음
city_code            -- ❌ 없음! gugun (VARCHAR)만 있음
device_serial        -- ❌ 없음! equipment_serial (VARCHAR)만 있음
device_serial_number -- ❌ 없음! serial_number (VARCHAR)만 있음
```

## 중요한 타입 및 데이터 주의사항

1. **id는 BIGINT**: `id::TEXT`로 캐스팅 필요
2. **last_use_date는 NUMERIC**: DATE가 아님!
3. **jurisdiction_health_center는 TEXT**: UUID가 아님!
4. **sido는 짧은 이름 저장**: "서울", "부산", "대구" 등 (❌ NOT "서울특별시", "부산광역시")

## RPC 함수 작성 시 필수 체크리스트

✅ `equipment_serial` 사용 (NOT device_serial)
✅ `serial_number` 사용 (NOT device_serial_number)
✅ `sido`, `gugun` 사용 (NOT region_code, city_code)
✅ `jurisdiction_health_center` TEXT로 처리 (NOT health_center_id UUID)
✅ `id::TEXT` 캐스팅
✅ `last_use_date NUMERIC` 타입 주의
✅ **지역 코드 → 짧은 이름 변환**: 'SEO' → '서울' (❌ NOT '서울특별시') - Migration 49 참조

## ⚠️ 과거 실수 이력 (반복 금지!)

### Migration 30-39번: 모두 실패 ❌
**원인**: 존재하지 않는 컬럼 참조
- `health_center_id`, `region_code`, `city_code` 등

**교훈**:
- 절대 추측하지 말 것
- 항상 실제 DB 확인
- VARCHAR ≠ TEXT 타입 구분

### Migration 40번: 성공 ✅
**성공 요인**:
1. `information_schema.columns`로 실제 스키마 확인
2. VARCHAR 타입 정확히 매칭
3. 존재하지 않는 컬럼 완전 제거

### Migration 49번: 지역 이름 매핑 수정 ✅ (2025-10-04)
**문제점**:
- RPC 함수가 'SEO' → '서울특별시' 변환
- DB에는 '서울'로 저장됨
- 검색 결과 0건

**해결**:
1. Migration 40/48의 지역 코드 매핑 수정
2. 'SEO' → '서울', 'BUS' → '부산' 등 짧은 이름으로 변환
3. `get_aed_data_filtered()`, `get_aed_data_by_jurisdiction()` 둘 다 수정

**결과**: 지역 필터 검색 정상 작동 ✅

## 재발 방지 체크리스트

RPC 함수 작성 전 필수:
- [ ] 실제 DB에서 `information_schema.columns` 쿼리 실행
- [ ] VARCHAR vs TEXT 타입 정확히 구분
- [ ] BIGINT vs INTEGER 타입 정확히 구분
- [ ] `/supabase/COMPLETE_MIGRATION_GUIDE.md` 숙지
- [ ] 존재하지 않는 컬럼 사용 여부 재확인

## 2025-10-04 최종 확인
- 실제 DB 쿼리로 스키마 확인 완료
- Migration 40 성공적으로 적용
- Migration 49 성공: 지역 이름 매핑 수정 ✅
- **중요 발견**: DB에는 **짧은 이름** 저장 ("서울", "부산", ❌ NOT "서울특별시", "부산광역시")
- **RPC 함수 수정**: 코드 'SEO' → '서울' 변환 (Migration 49에서 완료)
- **40번의 시행착오 끝에 성공**
