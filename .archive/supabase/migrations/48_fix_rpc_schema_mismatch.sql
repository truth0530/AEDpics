-- ============================================================================
-- Migration 48: RPC 함수 스키마 불일치 수정 + 헤더 시도/구군 필터 추가
-- ============================================================================
--
-- 작성일: 2025-10-04
-- 목적: "관할보건소기준" 조회 오류 수정 + 헤더 지역 필터 통합
--
-- 문제점:
-- 1. aed_id INTEGER → BIGINT 타입 불일치 (실제 aed_data.id는 BIGINT)
-- 2. get_aed_data_by_jurisdiction 함수가 존재하지 않거나 잘못된 시그니처
-- 3. 헤더의 시도/구군 필터가 RPC 함수에 전달되지 않음
--
-- 해결책:
-- 1. Migration 40의 get_aed_data_filtered에 sido/gugun 파라미터 추가
-- 2. get_aed_data_by_jurisdiction 함수 새로 생성 (존재하지 않음)
-- 3. Migration 40의 RETURNS TABLE 구조 그대로 유지
--
-- 참고:
-- - Migration 40의 시그니처 준수
-- - /supabase/ACTUAL_SCHEMA_REFERENCE.md
-- - /supabase/migrations/README.md
--
-- ============================================================================

-- ============================================================================
-- 1. get_aed_data_filtered 함수 수정 (sido/gugun 필터 추가)
-- ============================================================================

-- 기존 함수 삭제 (정확한 시그니처로)
DROP FUNCTION IF EXISTS public.get_aed_data_filtered(
  UUID,           -- p_health_center_id
  TEXT[],         -- p_region_codes
  TEXT[],         -- p_city_codes
  TEXT[],         -- p_category_1
  TEXT[],         -- p_category_2
  TEXT[],         -- p_category_3
  TEXT,           -- p_search
  INTEGER,        -- p_limit
  INTEGER,        -- p_offset
  DOUBLE PRECISION,  -- user_org_lat
  DOUBLE PRECISION   -- user_org_lng
) CASCADE;

-- 새 함수 생성 (sido/gugun 파라미터 추가)
CREATE OR REPLACE FUNCTION public.get_aed_data_filtered(
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
  region_labels TEXT[];
BEGIN
  -- 지역 코드를 지역명으로 변환
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
      -- 헤더의 시도/구군 필터 (최우선)
      (p_selected_sido IS NULL OR a.sido = p_selected_sido)
      AND (p_selected_gugun IS NULL OR a.gugun = p_selected_gugun)
      -- 기존 지역 필터
      AND (region_labels IS NULL OR a.sido = ANY(region_labels))
      AND (p_city_codes IS NULL OR a.gugun = ANY(p_city_codes))
      -- 카테고리 필터 (배열)
      AND (p_category_1 IS NULL OR a.category_1 = ANY(p_category_1))
      AND (p_category_2 IS NULL OR a.category_2 = ANY(p_category_2))
      AND (p_category_3 IS NULL OR a.category_3 = ANY(p_category_3))
      -- 검색 필터
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

-- 권한 부여
GRANT EXECUTE ON FUNCTION public.get_aed_data_filtered TO authenticated;

-- ============================================================================
-- 2. get_aed_data_by_jurisdiction 함수 생성 (새로 생성)
-- ============================================================================

-- 기존 함수 삭제 (모든 가능한 시그니처)
DROP FUNCTION IF EXISTS public.get_aed_data_by_jurisdiction CASCADE;

-- 관할보건소 기준 조회 함수
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
  -- 보건소 이름 조회
  IF p_health_center_id IS NOT NULL THEN
    SELECT name INTO v_health_center_name
    FROM organizations
    WHERE id = p_health_center_id
    AND type = 'health_center';
  END IF;

  -- 지역 코드를 지역명으로 변환
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
      -- 헤더의 시도/구군 필터 (최우선)
      (p_selected_sido IS NULL OR a.sido = p_selected_sido)
      AND (p_selected_gugun IS NULL OR a.gugun = p_selected_gugun)
      -- 관할 보건소 필터
      AND (v_health_center_name IS NULL OR a.jurisdiction_health_center = v_health_center_name)
      -- 지역 필터
      AND (
        v_health_center_name IS NOT NULL  -- 보건소 계정은 자신의 관할만
        OR (
          -- 상위 권한자는 지역 필터를 통해 조회
          (region_labels IS NULL OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.name = a.jurisdiction_health_center
            AND o.type = 'health_center'
            AND o.region_code IN (SELECT unnest(region_labels))
          ))
          AND (p_city_codes IS NULL OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.name = a.jurisdiction_health_center
            AND o.type = 'health_center'
            AND o.address ILIKE '%' || ANY(p_city_codes) || '%'
          ))
        )
      )
      -- 카테고리 필터
      AND (p_category_1 IS NULL OR a.category_1 = p_category_1)
      AND (p_category_2 IS NULL OR a.category_2 = p_category_2)
      AND (p_category_3 IS NULL OR a.category_3 = p_category_3)
      -- 검색 필터
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

-- 권한 부여
GRANT EXECUTE ON FUNCTION public.get_aed_data_by_jurisdiction TO authenticated;

-- ============================================================================
-- 스키마 캐시 갱신
-- ============================================================================
NOTIFY pgrst, 'reload schema';
