# AED Data 테이블 스키마 문서

## ✅ Supabase RPC 함수 반영 완료 (2025-09-21)
- 적용 파일: `fix_aed_data_functions_v2_corrected.sql`
- pad 컬럼 제거, in90 필터 추가, display_allowed 일관성 확보

## aed_data 테이블 구조
2025-09-20 확인 기준, 81,331개 레코드 보유

### 실제 존재하는 컬럼들

#### 식별자
- `id` (BIGINT) - Primary Key
- `equipment_serial` (VARCHAR(255)) - 장비 일련번호
- `management_number` (VARCHAR(255)) - 관리번호

#### 위치 정보
- `sido` (VARCHAR(255)) - 시도명 (예: "서울특별시", "경기도")
- `gugun` (VARCHAR(255)) - 시군구명 (예: "강남구", "수원시")
- `installation_institution` (VARCHAR(255)) - 설치기관
- `installation_address` (VARCHAR(255)) - 설치주소
- `installation_position` (VARCHAR(255)) - 설치위치 상세

#### 분류 정보
- `category_1` (VARCHAR(255)) - 대분류
- `category_2` (VARCHAR(255)) - 중분류
- `category_3` (VARCHAR(255)) - 소분류

#### 만료일 정보
- `battery_expiry_date` (DATE) - 배터리 만료일
- `patch_expiry_date` (DATE) - 패치 만료일
  - 주의: `pad_adult_expiry_date`, `pad_child_expiry_date`는 존재하지 않음

#### 상태 정보
- `operation_status` (VARCHAR(255)) - 운영상태
- `display_allowed` (VARCHAR(255)) - 공개여부
  - 실제 값: "표출허용", "미표출", "Y", "N", "YES" 등 혼재
  - 주의: `is_public_visible` 컬럼은 존재하지 않음

#### 관리 정보
- `jurisdiction_health_center` (VARCHAR(255)) - 관할보건소명
- `institution_contact` (VARCHAR(255)) - 기관 연락처
- `manager` (VARCHAR(255)) - 관리자
- `model_name` (VARCHAR(255)) - 모델명
- `manufacturer` (VARCHAR(255)) - 제조사

#### 시스템 정보
- `updated_at` (TIMESTAMPTZ) - 최종 수정일시

### 존재하지 않는 컬럼들
RPC 함수에서 잘못 참조하고 있는 컬럼:
- `region_code` - 존재하지 않음 (sido에서 계산해야 함)
- `city_code` - 존재하지 않음 (gugun에서 계산해야 함)
- `operation_status_raw` - 존재하지 않음
- `is_public_visible` - 존재하지 않음 (display_allowed로 계산해야 함)

## 프런트엔드와의 계약

### API 필터 파라미터
`lib/utils/query-parser.ts`에서 정의된 값들:

#### expiry 필터
- `expired` - 이미 만료된 것
- `in30` - 30일 이내 만료
- `in60` - 60일 이내 만료
- `in90` - 90일 이내 만료

주의: RPC 함수에서 '30days', '60days' 등으로 체크하면 안 됨

### API 응답 매핑
`app/api/aed-data/route.ts`에서 기대하는 필드:

```typescript
{
  id: deviceId,
  equipment_serial: item.equipment_serial,
  device_serial: item.equipment_serial,  // 호환용 중복
  management_number: item.management_number,
  sido: item.sido,
  gugun: item.gugun,
  region_code: item.region_code,  // RPC에서 계산 필요
  city_code: item.city_code,      // RPC에서 계산 필요
  category_1: item.category_1,
  category_2: item.category_2,
  installation_org: item.installation_institution,
  installation_institution: item.installation_institution,
  address: item.installation_address,
  installation_address: item.installation_address,
  detailed_address: item.installation_position,
  installation_position: item.installation_position,
  battery_expiry_date: item.battery_expiry_date,
  patch_expiry_date: item.patch_expiry_date,
  pad_expiry_date: item.patch_expiry_date,  // UI 호환용
  expiry_date: item.battery_expiry_date,
  days_until_battery_expiry: item.days_until_battery_expiry,
  days_until_patch_expiry: item.days_until_patch_expiry,
  days_until_pad_expiry: item.days_until_patch_expiry,  // UI 호환용
  days_until_expiry: item.days_until_battery_expiry,
  operation_status: item.operation_status,
  operation_status_raw: item.operation_status_raw,  // RPC에서 제공 필요
  device_status: item.operation_status,
  jurisdiction_health_center: item.jurisdiction_health_center,
  contact_phone: item.institution_contact,
  institution_contact: item.institution_contact,
  is_public_visible: item.is_public_visible,  // RPC에서 계산 필요
  updated_at: item.updated_at
}
```

## RPC 함수 수정 지침

### 1. 컬럼 매핑
- `display_allowed` → `is_public_visible` 계산:
  ```sql
  CASE WHEN display_allowed = 'Y' THEN TRUE ELSE FALSE END AS is_public_visible
  ```

### 2. 지역 코드 계산
- sido → region_code 매핑 필요
- 단, CASE WHEN 구조 주의 (여러 코드 처리 시 문제 발생)
- `IN (SELECT ... FROM unnest())` 패턴 사용 권장

### 3. 필터 문자열
- `expired`, `in30`, `in60`, `in90` 사용
- `'30days'`, `'60days'` 등은 사용 금지

### 4. 필수 반환 컬럼
RPC 함수가 반환해야 하는 컬럼:
- 모든 실제 테이블 컬럼
- 계산된 region_code, city_code
- 계산된 is_public_visible
- operation_status_raw (operation_status와 동일하게)
- days_until_* 계산 값들

## 권장 수정 방향

1. `fix_aed_data_functions_v2.sql` 기반으로 시작
2. pad_adult/pad_child 참조 제거
3. display_allowed → is_public_visible 변환 로직 유지
4. 필터 문자열을 'in30' 형식으로 수정
5. region_code, city_code 계산 로직 포함
6. operation_status_raw 추가 (operation_status와 동일값)