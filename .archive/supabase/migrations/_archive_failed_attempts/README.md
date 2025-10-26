# 실패한 Migration 시도 기록

이 폴더에는 **잘못된 스키마 가정**으로 인해 실패한 migration 파일들이 보관되어 있습니다.

## ❌ 실패 원인

모든 실패는 **aed_data 테이블에 존재하지 않는 컬럼**을 참조했기 때문입니다:

- `health_center_id` (UUID) - 실제로는 `jurisdiction_health_center` (VARCHAR)
- `region_code` - 실제로는 `sido` (VARCHAR)
- `city_code` - 실제로는 `gugun` (VARCHAR)
- `device_serial_number` - 실제로는 `serial_number` (VARCHAR)
- `device_serial` - 실제로는 `equipment_serial` (VARCHAR)

## 📁 보관된 파일 목록

- `30_get_aed_by_location.sql` - 잘못된 컬럼명 사용
- `32_add_distance_to_rpc.sql` - 잘못된 컬럼명 사용
- `33_fix_region_code_references.sql` - region_code 사용 시도
- `34_fix_all_column_references.sql` - 여러 잘못된 컬럼 참조
- `35_fix_get_aed_by_location.sql` - UUID 타입 오류
- `36_fix_get_aed_data_filtered_id_type.sql` - TEXT vs VARCHAR 불일치
- `37_fix_get_aed_data_filtered_unique.sql` - 함수 중복 문제
- `38_fix_region_code_columns.sql` - region_code 제거 시도
- `39_correct_schema_alignment.sql` - TEXT vs VARCHAR 타입 불일치

## ✅ 최종 성공한 Migration

**`40_fix_varchar_text_mismatch.sql`**

이 migration만이 실제 스키마를 정확히 반영하여 성공했습니다.

## 교훈

1. **절대 추측하지 말 것** - 항상 실제 스키마 확인
2. **타입 정확히 맞출 것** - VARCHAR vs TEXT 구분
3. **실제 컬럼명 사용** - 존재하지 않는 컬럼 참조 금지

## 참조 문서

- `/supabase/ACTUAL_SCHEMA_REFERENCE.md` - 실제 스키마 정의
- `/supabase/00_MIGRATION_WARNING.md` - Migration 작성 시 주의사항
