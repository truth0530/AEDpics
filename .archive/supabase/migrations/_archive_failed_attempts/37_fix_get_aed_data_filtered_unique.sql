-- ============================================
-- Migration 37: get_aed_data_filtered 함수 완전 재생성
-- 실행일: 2025-10-04
-- 목적: 함수 이름 중복 문제 해결
-- ============================================

-- 1. 모든 get_aed_data_filtered 함수 삭제
DO $$
DECLARE
    func_signature text;
BEGIN
    FOR func_signature IN
        SELECT pg_get_function_identity_arguments(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'get_aed_data_filtered'
        AND n.nspname = 'public'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS public.get_aed_data_filtered(%s) CASCADE', func_signature);
        RAISE NOTICE 'Dropped function: get_aed_data_filtered(%)', func_signature;
    END LOOP;
END $$;

-- 2. 올바른 타입으로 함수 재생성
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
SET search_path = public
AS $BODY$
DECLARE
  region_labels TEXT[];
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

  RETURN QUERY
  SELECT * FROM (
    SELECT
      a.id::TEXT,
      a.equipment_serial AS device_serial,
      a.management_number,
      a.installation_institution AS installation_org,
      a.installation_address AS address,
      a.installation_position AS detailed_address,
      a.region_code,
      a.city_code,
      a.jurisdiction_health_center,
      a.health_center_id,
      a.latitude,
      a.longitude,
      a.replacement_date AS expiry_date,
      CASE WHEN a.replacement_date IS NOT NULL
        THEN (a.replacement_date - CURRENT_DATE)
        ELSE NULL
      END AS days_until_expiry,
      a.operation_status AS device_status,
      CASE WHEN a.external_display = 'Y' THEN TRUE ELSE FALSE END AS is_public_visible,
      a.institution_contact AS contact_phone,
      NULL::TEXT AS contact_email,
      FALSE AS has_sensitive_data,
      a.last_inspection_date::DATE,
      a.installation_date,
      a.category_1,
      a.category_2,
      a.category_3,
      a.sido,
      a.sigungu AS gugun,
      a.operation_status,
      a.external_display,
      a.external_non_display_reason,
      a.battery_expiry_date,
      a.patch_expiry_date,
      a.replacement_date,
      a.model_name,
      a.manufacturer,
      a.display_allowed,
      a.installation_method,
      a.registration_date,
      a.manufacturing_date,
      a.manufacturing_country,
      a.device_serial_number AS serial_number,
      a.establisher,
      a.government_support,
      a.patch_available,
      a.remarks,
      a.first_installation_date,
      a.last_use_date,
      a.manager,
      a.purchase_institution,
      CASE
        WHEN user_org_lat IS NOT NULL
          AND user_org_lng IS NOT NULL
          AND a.latitude IS NOT NULL
          AND a.longitude IS NOT NULL
        THEN ST_Distance(
          ST_MakePoint(user_org_lng, user_org_lat)::geography,
          ST_MakePoint(a.longitude::double precision, a.latitude::double precision)::geography
        ) / 1000.0
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
      AND (p_search IS NULL
        OR a.installation_institution ILIKE '%' || p_search || '%'
        OR a.installation_address ILIKE '%' || p_search || '%'
        OR a.equipment_serial ILIKE '%' || p_search || '%')
  ) filtered_data
  ORDER BY distance_km ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$BODY$;

-- 3. 권한 부여
GRANT EXECUTE ON FUNCTION public.get_aed_data_filtered TO anon, authenticated;

-- 4. 코멘트 추가
COMMENT ON FUNCTION public.get_aed_data_filtered IS 'AED 데이터 필터링 조회 (거리 계산 포함, 거리순 정렬, id는 TEXT로 반환)';

-- 5. PostgREST 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
