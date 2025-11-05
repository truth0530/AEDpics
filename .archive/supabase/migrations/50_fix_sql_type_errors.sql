-- ============================================================================
-- Migration 50: SQL 타입 오류 수정
-- ============================================================================
--
-- 작성일: 2025-10-04
-- 목적: Migration 49의 SQL 타입 오류 수정
--
-- 문제점:
-- 1. `o.region_code IN (SELECT unnest(region_labels))` - unnest 불필요
-- 2. `o.address ILIKE '%' || ANY(p_city_codes) || '%'` - ANY 사용 오류
--
-- 해결책:
-- 1. `o.region_code = ANY(region_labels)` 사용
-- 2. 배열을 루프로 처리하거나 EXISTS 사용
--
-- ============================================================================

-- get_aed_data_by_jurisdiction 함수 재생성 (타입 오류 수정)
DROP FUNCTION IF EXISTS public.get_aed_data_by_jurisdiction(
  TEXT, TEXT[], TEXT[], UUID, TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT,
  INTEGER, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, VARCHAR, VARCHAR
) CASCADE;

CREATE OR REPLACE FUNCTION public.get_aed_data_by_jurisdiction(
  p_user_role TEXT DEFAULT NULL,
  p_region_codes TEXT[] DEFAULT NULL,
  p_city_codes TEXT[] DEFAULT NULL,
  p_health_center_id UUID DEFAULT NULL,
  p_expiry_filter TEXT DEFAULT NULL,
  p_status_filters TEXT[] DEFAULT NULL,
  p_category_1 TEXT DEFAULT NULL,
  p_category_2 TEXT DEFAULT NULL,
  p_category_3 TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  user_org_lat DOUBLE PRECISION DEFAULT NULL,
  user_org_lng DOUBLE PRECISION DEFAULT NULL,
  p_selected_sido VARCHAR DEFAULT NULL,
  p_selected_gugun VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  device_serial VARCHAR,
  management_number VARCHAR,
  installation_org VARCHAR,
  address VARCHAR,
  detailed_address VARCHAR,
  jurisdiction_health_center VARCHAR,
  latitude NUMERIC,
  longitude NUMERIC,
  expiry_date DATE,
  days_until_expiry INT,
  device_status VARCHAR,
  is_public_visible BOOLEAN,
  contact_phone VARCHAR,
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
  last_use_date NUMERIC,
  manager VARCHAR,
  purchase_institution VARCHAR,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $BODY$
DECLARE
  v_health_center_name TEXT;
  region_labels TEXT[];
BEGIN
  IF p_health_center_id IS NOT NULL THEN
    SELECT name INTO v_health_center_name
    FROM organizations
    WHERE id = p_health_center_id
    AND type = 'health_center';
  END IF;

  -- 지역 코드를 짧은 이름으로 변환
  IF p_region_codes IS NOT NULL THEN
    region_labels := ARRAY(
      SELECT rm.label FROM (VALUES
        ('KR', '중앙'), ('SEO', '서울'), ('BUS', '부산'), ('DAE', '대구'),
        ('INC', '인천'), ('GWA', '광주'), ('DAJ', '대전'), ('ULS', '울산'),
        ('SEJ', '세종'), ('GYE', '경기'), ('GAN', '강원'), ('CHB', '충북'),
        ('CHN', '충남'), ('JEB', '전북'), ('JEN', '전남'), ('GYB', '경북'),
        ('GYN', '경남'), ('JEJ', '제주')
      ) AS rm(code, label) WHERE rm.code = ANY(p_region_codes)
    );
  END IF;

  RETURN QUERY
  SELECT * FROM (
    SELECT
      a.id::TEXT,
      a.equipment_serial,
      a.management_number,
      a.installation_institution,
      a.installation_address,
      a.installation_position,
      a.jurisdiction_health_center,
      a.latitude,
      a.longitude,
      a.replacement_date,
      CASE WHEN a.replacement_date IS NOT NULL
        THEN (a.replacement_date - CURRENT_DATE)::INT
        ELSE NULL
      END AS days_until_expiry,
      a.operation_status,
      CASE WHEN a.external_display = 'Y' THEN TRUE ELSE FALSE END AS is_public_visible,
      a.institution_contact,
      NULL::TEXT AS contact_email,
      FALSE AS has_sensitive_data,
      a.last_inspection_date,
      a.installation_date,
      a.category_1,
      a.category_2,
      a.category_3,
      a.sido,
      a.gugun,
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
      a.serial_number,
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
        THEN (
          6371 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(user_org_lat)) * cos(radians(a.latitude)) *
              cos(radians(a.longitude) - radians(user_org_lng)) +
              sin(radians(user_org_lat)) * sin(radians(a.latitude))
            ))
          )
        )::DOUBLE PRECISION
        ELSE NULL::DOUBLE PRECISION
      END AS distance_km
    FROM aed_data a
    WHERE
      (p_selected_sido IS NULL OR a.sido = p_selected_sido)
      AND (p_selected_gugun IS NULL OR a.gugun = p_selected_gugun)
      AND (v_health_center_name IS NULL OR a.jurisdiction_health_center = v_health_center_name)
      AND (
        v_health_center_name IS NOT NULL
        OR (
          -- 지역 필터: region_labels 배열과 sido 매칭
          (region_labels IS NULL OR a.sido = ANY(region_labels))
          -- 시군구 필터: p_city_codes 배열과 gugun 매칭
          AND (p_city_codes IS NULL OR a.gugun = ANY(p_city_codes))
        )
      )
      AND (p_category_1 IS NULL OR a.category_1 = p_category_1)
      AND (p_category_2 IS NULL OR a.category_2 = p_category_2)
      AND (p_category_3 IS NULL OR a.category_3 = p_category_3)
      AND (p_search IS NULL OR (
        a.management_number ILIKE '%' || p_search || '%' OR
        a.equipment_serial ILIKE '%' || p_search || '%' OR
        a.installation_institution ILIKE '%' || p_search || '%' OR
        a.installation_address ILIKE '%' || p_search || '%'
      ))
  ) subquery
  ORDER BY
    CASE
      WHEN user_org_lat IS NOT NULL AND user_org_lng IS NOT NULL
      THEN subquery.distance_km
      ELSE 999999
    END ASC NULLS LAST,
    subquery.id
  LIMIT p_limit
  OFFSET p_offset;
END;
$BODY$;

GRANT EXECUTE ON FUNCTION public.get_aed_data_by_jurisdiction TO authenticated;

NOTIFY pgrst, 'reload schema';
