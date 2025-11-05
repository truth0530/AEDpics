-- ============================================
-- 필수 마이그레이션 통합 파일 v3
-- 실행일: 2025-10-04
-- 목적: inspections 테이블 참조 제거 버전
-- ============================================

-- ============================================
-- 0. PostGIS 확장 활성화
-- ============================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- 1. inspection_sessions에 field_changes 컬럼 추가
-- ============================================
ALTER TABLE public.inspection_sessions
ADD COLUMN IF NOT EXISTS field_changes JSONB DEFAULT '{}';

COMMENT ON COLUMN inspection_sessions.field_changes IS '점검 중 변경된 필드 정보 (원본값, 수정값, 사유 포함)';

-- ============================================
-- 2. 위치 기반 AED 검색 RPC 함수 생성
-- ============================================
CREATE OR REPLACE FUNCTION get_aed_by_location(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 3000,
  result_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  id UUID,
  equipment_serial TEXT,
  device_serial TEXT,
  management_number TEXT,
  installation_institution TEXT,
  installation_org TEXT,
  installation_address TEXT,
  address TEXT,
  installation_location_address TEXT,
  installation_position TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  sido TEXT,
  gugun TEXT,
  region_code TEXT,
  city_code TEXT,
  model_name TEXT,
  manufacturer TEXT,
  battery_expiry_date TEXT,
  patch_expiry_date TEXT,
  pad_expiry_date TEXT,
  last_inspection_date TEXT,
  operation_status TEXT,
  external_display BOOLEAN,
  category_1 TEXT,
  category_2 TEXT,
  category_3 TEXT,
  display_allowed TEXT,
  installation_method TEXT,
  registration_date TEXT,
  manufacturing_date TEXT,
  manufacturing_country TEXT,
  serial_number TEXT,
  establisher TEXT,
  government_support TEXT,
  patch_available TEXT,
  remarks TEXT,
  jurisdiction_health_center TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $BODY$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.equipment_serial::TEXT,
    a.device_serial::TEXT,
    a.management_number::TEXT,
    a.installation_institution::TEXT,
    a.installation_org::TEXT,
    a.installation_address::TEXT,
    a.address::TEXT,
    a.installation_location_address::TEXT,
    a.installation_position::TEXT,
    a.latitude,
    a.longitude,
    a.sido::TEXT,
    a.gugun::TEXT,
    a.region_code::TEXT,
    a.city_code::TEXT,
    a.model_name::TEXT,
    a.manufacturer::TEXT,
    a.battery_expiry_date::TEXT,
    a.patch_expiry_date::TEXT,
    a.pad_expiry_date::TEXT,
    a.last_inspection_date::TEXT,
    a.operation_status::TEXT,
    a.external_display,
    a.category_1::TEXT,
    a.category_2::TEXT,
    a.category_3::TEXT,
    a.display_allowed::TEXT,
    a.installation_method::TEXT,
    a.registration_date::TEXT,
    a.manufacturing_date::TEXT,
    a.manufacturing_country::TEXT,
    a.serial_number::TEXT,
    a.establisher::TEXT,
    a.government_support::TEXT,
    a.patch_available::TEXT,
    a.remarks::TEXT,
    a.jurisdiction_health_center::TEXT
  FROM aed_data a
  WHERE
    a.latitude IS NOT NULL
    AND a.longitude IS NOT NULL
    AND a.latitude <> 0
    AND a.longitude <> 0
    AND ST_DWithin(
      ST_MakePoint(a.longitude, a.latitude)::geography,
      ST_MakePoint(center_lng, center_lat)::geography,
      radius_meters
    )
  ORDER BY
    ST_Distance(
      ST_MakePoint(a.longitude, a.latitude)::geography,
      ST_MakePoint(center_lng, center_lat)::geography
    )
  LIMIT result_limit;
END;
$BODY$;

COMMENT ON FUNCTION get_aed_by_location IS '지도 중심 좌표와 반경(미터)을 기준으로 AED 데이터를 조회합니다. 거리순으로 정렬됩니다.';

-- ============================================
-- 3. organizations 테이블에 좌표 필드 추가
-- ============================================
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_organizations_lat ON organizations(latitude) WHERE latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_lng ON organizations(longitude) WHERE longitude IS NOT NULL;

COMMENT ON COLUMN organizations.latitude IS '보건소 위도 좌표 (WGS84)';
COMMENT ON COLUMN organizations.longitude IS '보건소 경도 좌표 (WGS84)';

-- ============================================
-- 4. RPC 함수에 거리 계산 기능 추가
-- ============================================

-- 기존 함수의 모든 오버로드 버전을 강제로 삭제
DO $FUNC_DROP$
DECLARE
  func_name TEXT;
BEGIN
  FOR func_name IN
    SELECT oid::regprocedure::text
    FROM pg_proc
    WHERE proname = 'get_aed_data_filtered'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_name || ' CASCADE';
  END LOOP;

  FOR func_name IN
    SELECT oid::regprocedure::text
    FROM pg_proc
    WHERE proname = 'get_aed_data_by_jurisdiction'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_name || ' CASCADE';
  END LOOP;
END $FUNC_DROP$;

-- 새로운 함수 생성 (inspections 테이블 참조 제거)
CREATE OR REPLACE FUNCTION get_aed_data_filtered(
  p_user_role TEXT,
  p_region_codes TEXT[] DEFAULT NULL,
  p_city_codes TEXT[] DEFAULT NULL,
  p_expiry_filter TEXT DEFAULT NULL,
  p_status_filters TEXT[] DEFAULT NULL,
  p_category_1 TEXT[] DEFAULT NULL,
  p_category_2 TEXT[] DEFAULT NULL,
  p_category_3 TEXT[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0,
  user_org_lat DOUBLE PRECISION DEFAULT NULL,
  user_org_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  device_serial TEXT,
  management_number TEXT,
  installation_org TEXT,
  address TEXT,
  detailed_address TEXT,
  region_code TEXT,
  city_code TEXT,
  jurisdiction_health_center TEXT,
  health_center_id UUID,
  latitude NUMERIC,
  longitude NUMERIC,
  expiry_date DATE,
  days_until_expiry INT,
  device_status TEXT,
  is_public_visible BOOLEAN,
  contact_phone TEXT,
  contact_email TEXT,
  has_sensitive_data BOOLEAN,
  last_inspection_date DATE,
  installation_date DATE,
  category_1 TEXT,
  category_2 TEXT,
  category_3 TEXT,
  sido TEXT,
  gugun TEXT,
  operation_status TEXT,
  external_display TEXT,
  external_non_display_reason TEXT,
  battery_expiry_date DATE,
  patch_expiry_date DATE,
  replacement_date DATE,
  model_name TEXT,
  manufacturer TEXT,
  display_allowed TEXT,
  installation_method TEXT,
  registration_date DATE,
  manufacturing_date DATE,
  manufacturing_country TEXT,
  serial_number TEXT,
  establisher TEXT,
  government_support TEXT,
  patch_available TEXT,
  remarks TEXT,
  first_installation_date DATE,
  last_use_date DATE,
  manager TEXT,
  purchase_institution TEXT,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $BODY$
DECLARE
  region_labels TEXT[];
BEGIN
  IF p_region_codes IS NOT NULL THEN
    region_labels := ARRAY(
      SELECT rm.label
      FROM (VALUES
        ('KR', '중앙'), ('SEO', '서울특별시'), ('BUS', '부산광역시'),
        ('DAE', '대구광역시'), ('INC', '인천광역시'), ('GWA', '광주광역시'),
        ('DAJ', '대전광역시'), ('ULS', '울산광역시'), ('SEJ', '세종특별자치시'),
        ('GYE', '경기도'), ('GAN', '강원특별자치도'), ('CHU', '충청북도'),
        ('CHN', '충청남도'), ('JEO', '전북특별자치도'), ('JEN', '전라남도'),
        ('GYB', '경상북도'), ('GYN', '경상남도'), ('JEJ', '제주특별자치도')
      ) AS rm(code, label)
      WHERE rm.code = ANY(p_region_codes)
    );
  END IF;

  RETURN QUERY
  SELECT * FROM (
    SELECT
      a.id::TEXT,
      a.equipment_serial AS device_serial,
      a.management_number,
      a.installation_institution AS installation_org,
      a.installation_address AS address,
      a.installation_position AS detailed_address,
      a.region_code, a.city_code, a.jurisdiction_health_center, a.health_center_id,
      a.latitude, a.longitude, a.replacement_date AS expiry_date,
      CASE WHEN a.replacement_date IS NOT NULL THEN (a.replacement_date - CURRENT_DATE) ELSE NULL END AS days_until_expiry,
      a.operation_status AS device_status,
      CASE WHEN a.external_display = 'Y' THEN TRUE ELSE FALSE END AS is_public_visible,
      a.institution_contact AS contact_phone,
      NULL::TEXT AS contact_email,
      FALSE AS has_sensitive_data,
      a.last_inspection_date::DATE,
      a.installation_date, a.category_1, a.category_2, a.category_3,
      a.sido, a.sigungu AS gugun, a.operation_status, a.external_display, a.external_non_display_reason,
      a.battery_expiry_date, a.patch_expiry_date, a.replacement_date,
      a.model_name, a.manufacturer, a.display_allowed, a.installation_method,
      a.registration_date, a.manufacturing_date, a.manufacturing_country,
      a.device_serial_number AS serial_number, a.establisher, a.government_support, a.patch_available, a.remarks,
      a.first_installation_date, a.last_use_date, a.manager, a.purchase_institution,
      CASE
        WHEN user_org_lat IS NOT NULL AND user_org_lng IS NOT NULL AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
        THEN ST_Distance(ST_MakePoint(user_org_lng, user_org_lat)::geography, ST_MakePoint(a.longitude::double precision, a.latitude::double precision)::geography) / 1000.0
        ELSE 999999.0
      END AS distance_km
    FROM public.aed_data a
    WHERE
      (p_region_codes IS NULL OR a.sido = ANY(region_labels))
      AND (p_city_codes IS NULL OR a.sigungu = ANY(p_city_codes))
      AND (p_category_1 IS NULL OR a.category_1 = ANY(p_category_1))
      AND (p_category_2 IS NULL OR a.category_2 = ANY(p_category_2))
      AND (p_category_3 IS NULL OR a.category_3 = ANY(p_category_3))
      AND (p_search IS NULL OR a.installation_institution ILIKE '%' || p_search || '%' OR a.installation_address ILIKE '%' || p_search || '%' OR a.equipment_serial ILIKE '%' || p_search || '%')
  ) filtered_data
  ORDER BY distance_km ASC
  LIMIT p_limit OFFSET p_offset;
END;
$BODY$;

CREATE OR REPLACE FUNCTION get_aed_data_by_jurisdiction(
  p_user_role TEXT,
  p_region_codes TEXT[] DEFAULT NULL,
  p_city_codes TEXT[] DEFAULT NULL,
  p_health_center_id UUID DEFAULT NULL,
  p_expiry_filter TEXT DEFAULT NULL,
  p_status_filters TEXT[] DEFAULT NULL,
  p_category_1 TEXT[] DEFAULT NULL,
  p_category_2 TEXT[] DEFAULT NULL,
  p_category_3 TEXT[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0,
  user_org_lat DOUBLE PRECISION DEFAULT NULL,
  user_org_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  id TEXT, device_serial TEXT, management_number TEXT, installation_org TEXT, address TEXT, detailed_address TEXT,
  region_code TEXT, city_code TEXT, jurisdiction_health_center TEXT, health_center_id UUID, latitude NUMERIC, longitude NUMERIC,
  expiry_date DATE, days_until_expiry INT, device_status TEXT, is_public_visible BOOLEAN, contact_phone TEXT, contact_email TEXT,
  has_sensitive_data BOOLEAN, last_inspection_date DATE, installation_date DATE, category_1 TEXT, category_2 TEXT, category_3 TEXT,
  sido TEXT, gugun TEXT, operation_status TEXT, external_display TEXT, external_non_display_reason TEXT,
  battery_expiry_date DATE, patch_expiry_date DATE, replacement_date DATE, model_name TEXT, manufacturer TEXT, display_allowed TEXT,
  installation_method TEXT, registration_date DATE, manufacturing_date DATE, manufacturing_country TEXT, serial_number TEXT,
  establisher TEXT, government_support TEXT, patch_available TEXT, remarks TEXT, first_installation_date DATE, last_use_date DATE,
  manager TEXT, purchase_institution TEXT, distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql SECURITY DEFINER
AS $BODY$
DECLARE region_labels TEXT[];
BEGIN
  IF p_region_codes IS NOT NULL THEN
    region_labels := ARRAY(
      SELECT rm.label FROM (VALUES
        ('KR', '중앙'), ('SEO', '서울특별시'), ('BUS', '부산광역시'), ('DAE', '대구광역시'),
        ('INC', '인천광역시'), ('GWA', '광주광역시'), ('DAJ', '대전광역시'), ('ULS', '울산광역시'),
        ('SEJ', '세종특별자치시'), ('GYE', '경기도'), ('GAN', '강원특별자치도'), ('CHU', '충청북도'),
        ('CHN', '충청남도'), ('JEO', '전북특별자치도'), ('JEN', '전라남도'), ('GYB', '경상북도'),
        ('GYN', '경상남도'), ('JEJ', '제주특별자치도')
      ) AS rm(code, label) WHERE rm.code = ANY(p_region_codes)
    );
  END IF;

  RETURN QUERY SELECT * FROM (
    SELECT
      a.id::TEXT, a.equipment_serial AS device_serial, a.management_number, a.installation_institution AS installation_org,
      a.installation_address AS address, a.installation_position AS detailed_address, a.region_code, a.city_code,
      a.jurisdiction_health_center, a.health_center_id, a.latitude, a.longitude, a.replacement_date AS expiry_date,
      CASE WHEN a.replacement_date IS NOT NULL THEN (a.replacement_date - CURRENT_DATE) ELSE NULL END AS days_until_expiry,
      a.operation_status AS device_status, CASE WHEN a.external_display = 'Y' THEN TRUE ELSE FALSE END AS is_public_visible,
      a.institution_contact AS contact_phone, NULL::TEXT AS contact_email, FALSE AS has_sensitive_data,
      a.last_inspection_date::DATE,
      a.installation_date, a.category_1, a.category_2, a.category_3,
      a.sido, a.sigungu AS gugun, a.operation_status, a.external_display, a.external_non_display_reason,
      a.battery_expiry_date, a.patch_expiry_date, a.replacement_date, a.model_name, a.manufacturer, a.display_allowed,
      a.installation_method, a.registration_date, a.manufacturing_date, a.manufacturing_country,
      a.device_serial_number AS serial_number, a.establisher, a.government_support, a.patch_available, a.remarks,
      a.first_installation_date, a.last_use_date, a.manager, a.purchase_institution,
      CASE
        WHEN user_org_lat IS NOT NULL AND user_org_lng IS NOT NULL AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
        THEN ST_Distance(ST_MakePoint(user_org_lng, user_org_lat)::geography, ST_MakePoint(a.longitude::double precision, a.latitude::double precision)::geography) / 1000.0
        ELSE 999999.0
      END AS distance_km
    FROM public.aed_data a
    WHERE
      (p_health_center_id IS NULL OR a.health_center_id = p_health_center_id)
      AND (p_region_codes IS NULL OR a.sido = ANY(region_labels))
      AND (p_city_codes IS NULL OR a.sigungu = ANY(p_city_codes))
      AND (p_category_1 IS NULL OR a.category_1 = ANY(p_category_1))
      AND (p_category_2 IS NULL OR a.category_2 = ANY(p_category_2))
      AND (p_category_3 IS NULL OR a.category_3 = ANY(p_category_3))
      AND (p_search IS NULL OR a.installation_institution ILIKE '%' || p_search || '%' OR a.installation_address ILIKE '%' || p_search || '%' OR a.equipment_serial ILIKE '%' || p_search || '%')
  ) filtered_data
  ORDER BY distance_km ASC LIMIT p_limit OFFSET p_offset;
END;
$BODY$;

GRANT EXECUTE ON FUNCTION get_aed_data_filtered TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_aed_data_by_jurisdiction TO anon, authenticated;

COMMENT ON FUNCTION get_aed_data_filtered IS 'AED 데이터 필터링 조회 (거리 계산 포함, 거리순 정렬)';
COMMENT ON FUNCTION get_aed_data_by_jurisdiction IS 'AED 데이터 관할구역 기준 조회 (거리 계산 포함, 거리순 정렬)';
