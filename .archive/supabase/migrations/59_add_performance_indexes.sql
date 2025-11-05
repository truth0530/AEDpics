-- 성능 최적화를 위한 인덱스 추가
-- 자주 조회되는 컬럼들에 대해 인덱스 생성

-- 1. user_profiles 테이블 인덱스
-- role 기반 조회 최적화 (pending_approval 카운트 등)
CREATE INDEX IF NOT EXISTS idx_user_profiles_role
ON user_profiles(role)
WHERE role IS NOT NULL;

-- region_code 기반 조회 최적화
CREATE INDEX IF NOT EXISTS idx_user_profiles_region_code
ON user_profiles(region_code)
WHERE region_code IS NOT NULL;

-- organization_id 기반 조회 최적화
CREATE INDEX IF NOT EXISTS idx_user_profiles_organization_id
ON user_profiles(organization_id)
WHERE organization_id IS NOT NULL;

-- 2. aed_data 테이블 인덱스
-- 시도(sido) 기반 조회 최적화
CREATE INDEX IF NOT EXISTS idx_aed_data_sido
ON aed_data(sido)
WHERE sido IS NOT NULL;

-- 구군(gugun) 기반 조회 최적화
CREATE INDEX IF NOT EXISTS idx_aed_data_gugun
ON aed_data(gugun)
WHERE gugun IS NOT NULL;

-- region_code 기반 조회 최적화
CREATE INDEX IF NOT EXISTS idx_aed_data_region_code
ON aed_data(region_code)
WHERE region_code IS NOT NULL;

-- city_code 기반 조회 최적화
CREATE INDEX IF NOT EXISTS idx_aed_data_city_code
ON aed_data(city_code)
WHERE city_code IS NOT NULL;

-- category_1 기반 조회 최적화 (구비의무기관 필터링)
CREATE INDEX IF NOT EXISTS idx_aed_data_category_1
ON aed_data(category_1)
WHERE category_1 IS NOT NULL;

-- 관할 보건소 기반 조회 최적화
CREATE INDEX IF NOT EXISTS idx_aed_data_jurisdiction_health_center
ON aed_data(jurisdiction_health_center)
WHERE jurisdiction_health_center IS NOT NULL;

-- last_inspection_date 기반 조회 최적화 (점검 완료 여부 계산)
CREATE INDEX IF NOT EXISTS idx_aed_data_last_inspection_date
ON aed_data(last_inspection_date)
WHERE last_inspection_date IS NOT NULL;

-- 복합 인덱스: sido + gugun (시도별 시군구 조회)
CREATE INDEX IF NOT EXISTS idx_aed_data_sido_gugun
ON aed_data(sido, gugun)
WHERE sido IS NOT NULL AND gugun IS NOT NULL;

-- 복합 인덱스: region_code + city_code (지역 코드 기반 조회)
CREATE INDEX IF NOT EXISTS idx_aed_data_region_city_code
ON aed_data(region_code, city_code)
WHERE region_code IS NOT NULL;

-- 3. organizations 테이블 인덱스
-- region_code 기반 조회 최적화
CREATE INDEX IF NOT EXISTS idx_organizations_region_code
ON organizations(region_code)
WHERE region_code IS NOT NULL;

-- city_code 기반 조회 최적화
CREATE INDEX IF NOT EXISTS idx_organizations_city_code
ON organizations(city_code)
WHERE city_code IS NOT NULL;

-- type 기반 조회 최적화
CREATE INDEX IF NOT EXISTS idx_organizations_type
ON organizations(type)
WHERE type IS NOT NULL;

-- 인덱스 생성 완료 로그
DO $$
BEGIN
  RAISE NOTICE '성능 최적화 인덱스 생성 완료';
  RAISE NOTICE '- user_profiles: role, region_code, organization_id';
  RAISE NOTICE '- aed_data: sido, gugun, region_code, city_code, category_1, jurisdiction_health_center, last_inspection_date';
  RAISE NOTICE '- aed_data 복합: sido+gugun, region_code+city_code';
  RAISE NOTICE '- organizations: region_code, city_code, type';
END $$;
