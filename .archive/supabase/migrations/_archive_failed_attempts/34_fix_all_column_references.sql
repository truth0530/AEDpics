-- Fix ALL column references to match actual aed_data table schema
-- Based on actual columns from information_schema

-- Drop existing functions
DROP FUNCTION IF EXISTS public.get_aed_by_location(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_aed_data_filtered(TEXT, TEXT[], TEXT[], TEXT, TEXT[], TEXT[], TEXT[], TEXT[], TEXT, INTEGER, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.get_aed_data_by_jurisdiction(TEXT, TEXT[], TEXT[], UUID, TEXT, TEXT[], TEXT[], TEXT[], TEXT[], TEXT, INTEGER, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION);

-- 1. get_aed_by_location - simplified with only existing columns
CREATE OR REPLACE FUNCTION public.get_aed_by_location(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 3000,
  result_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  id INTEGER,
  management_number TEXT,
  equipment_serial TEXT,
  installation_institution TEXT,
  installation_address TEXT,
  installation_position TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  sido TEXT,
  gugun TEXT,
  model_name TEXT,
  manufacturer TEXT,
  battery_expiry_date TEXT,
  patch_expiry_date TEXT,
  replacement_date TEXT,
  last_inspection_date TEXT,
  external_display TEXT,
  category_1 TEXT,
  category_2 TEXT,
  category_3 TEXT,
  distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.management_number,
    a.equipment_serial,
    a.installation_institution,
    a.installation_address,
    a.installation_position,
    a.latitude,
    a.longitude,
    a.sido::TEXT,
    a.gugun::TEXT,
    a.model_name::TEXT,
    a.manufacturer::TEXT,
    a.battery_expiry_date::TEXT,
    a.patch_expiry_date::TEXT,
    a.replacement_date::TEXT,
    a.last_inspection_date::TEXT,
    a.external_display::TEXT,
    a.category_1::TEXT,
    a.category_2::TEXT,
    a.category_3::TEXT,
    ST_Distance(
      ST_MakePoint(center_lng, center_lat)::geography,
      ST_MakePoint(a.longitude::double precision, a.latitude::double precision)::geography
    ) AS distance_meters
  FROM public.aed_data a
  WHERE
    a.latitude IS NOT NULL
    AND a.longitude IS NOT NULL
    AND ST_DWithin(
      ST_MakePoint(center_lng, center_lat)::geography,
      ST_MakePoint(a.longitude::double precision, a.latitude::double precision)::geography,
      radius_meters
    )
  ORDER BY distance_meters ASC
  LIMIT result_limit;
END;
$$;

-- 2. get_aed_data_filtered - using only existing columns
CREATE OR REPLACE FUNCTION public.get_aed_data_filtered(
  p_user_role TEXT,
  p_region_codes TEXT[] DEFAULT NULL,
  p_city_codes TEXT[] DEFAULT NULL,
  p_expiry_filter TEXT DEFAULT NULL,
  p_status_filters TEXT[] DEFAULT NULL,
  p_category_1 TEXT[] DEFAULT NULL,
  p_category_2 TEXT[] DEFAULT NULL,
  p_category_3 TEXT[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 50,
  user_org_lat DOUBLE PRECISION DEFAULT NULL,
  user_org_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  id INTEGER,
  management_number TEXT,
  equipment_serial TEXT,
  installation_institution TEXT,
  installation_address TEXT,
  installation_position TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  sido TEXT,
  gugun TEXT,
  jurisdiction_health_center TEXT,
  manager TEXT,
  is_public_visible BOOLEAN,
  contact_phone TEXT,
  last_inspection_date TEXT,
  installation_date TEXT,
  category_1 TEXT,
  category_2 TEXT,
  category_3 TEXT,
  operation_status TEXT,
  external_display TEXT,
  external_non_display_reason TEXT,
  battery_expiry_date TEXT,
  patch_expiry_date TEXT,
  replacement_date TEXT,
  model_name TEXT,
  manufacturer TEXT,
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
  first_installation_date TEXT,
  last_use_date TEXT,
  purchase_institution TEXT,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  region_labels TEXT[];
BEGIN
  -- Convert region codes to Korean labels
  IF p_region_codes IS NOT NULL THEN
    region_labels := ARRAY(
      SELECT CASE code
        WHEN 'SEL' THEN '서울특별시'
        WHEN 'BUS' THEN '부산광역시'
        WHEN 'DAE' THEN '대구광역시'
        WHEN 'INC' THEN '인천광역시'
        WHEN 'GWA' THEN '광주광역시'
        WHEN 'DAJ' THEN '대전광역시'
        WHEN 'ULS' THEN '울산광역시'
        WHEN 'SEJ' THEN '세종특별자치시'
        WHEN 'GYE' THEN '경기도'
        WHEN 'GAN' THEN '강원특별자치도'
        WHEN 'CHB' THEN '충청북도'
        WHEN 'CHN' THEN '충청남도'
        WHEN 'JEB' THEN '전북특별자치도'
        WHEN 'JEN' THEN '전라남도'
        WHEN 'GYB' THEN '경상북도'
        WHEN 'GYN' THEN '경상남도'
        WHEN 'JEJ' THEN '제주특별자치도'
        ELSE code
      END
      FROM UNNEST(p_region_codes) AS code
    );
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.management_number,
    a.equipment_serial,
    a.installation_institution,
    a.installation_address,
    a.installation_position,
    a.latitude,
    a.longitude,
    a.sido,
    a.gugun,
    a.jurisdiction_health_center,
    a.manager,
    CASE WHEN a.external_display = 'Y' THEN TRUE ELSE FALSE END AS is_public_visible,
    a.institution_contact AS contact_phone,
    a.last_inspection_date::TEXT,
    a.installation_date,
    a.category_1,
    a.category_2,
    a.category_3,
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
    a.purchase_institution,
    CASE
      WHEN user_org_lat IS NOT NULL AND user_org_lng IS NOT NULL AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
      THEN ST_Distance(ST_MakePoint(user_org_lng, user_org_lat)::geography, ST_MakePoint(a.longitude::double precision, a.latitude::double precision)::geography) / 1000.0
      ELSE 999999.0
    END AS distance_km
  FROM public.aed_data a
  WHERE
    (p_region_codes IS NULL OR a.sido = ANY(region_labels))
    AND (p_city_codes IS NULL OR a.gugun = ANY(p_city_codes))
    AND (p_category_1 IS NULL OR a.category_1 = ANY(p_category_1))
    AND (p_category_2 IS NULL OR a.category_2 = ANY(p_category_2))
    AND (p_category_3 IS NULL OR a.category_3 = ANY(p_category_3))
    AND (
      p_search IS NULL OR
      a.installation_institution ILIKE '%' || p_search || '%' OR
      a.installation_address ILIKE '%' || p_search || '%' OR
      a.management_number ILIKE '%' || p_search || '%' OR
      a.equipment_serial ILIKE '%' || p_search || '%'
    )
  ORDER BY distance_km ASC, a.id ASC
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;

-- 3. get_aed_data_by_jurisdiction - using only existing columns
CREATE OR REPLACE FUNCTION public.get_aed_data_by_jurisdiction(
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
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 50,
  user_org_lat DOUBLE PRECISION DEFAULT NULL,
  user_org_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  id INTEGER,
  management_number TEXT,
  equipment_serial TEXT,
  installation_address TEXT,
  detailed_address TEXT,
  sido TEXT,
  gugun TEXT,
  jurisdiction_health_center TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  manager TEXT,
  is_public_visible BOOLEAN,
  contact_phone TEXT,
  last_inspection_date TEXT,
  installation_date TEXT,
  category_1 TEXT,
  category_2 TEXT,
  category_3 TEXT,
  operation_status TEXT,
  external_display TEXT,
  external_non_display_reason TEXT,
  battery_expiry_date TEXT,
  patch_expiry_date TEXT,
  replacement_date TEXT,
  model_name TEXT,
  manufacturer TEXT,
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
  first_installation_date TEXT,
  last_use_date TEXT,
  purchase_institution TEXT,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  region_labels TEXT[];
BEGIN
  -- Convert region codes to Korean labels
  IF p_region_codes IS NOT NULL THEN
    region_labels := ARRAY(
      SELECT CASE code
        WHEN 'SEL' THEN '서울특별시'
        WHEN 'BUS' THEN '부산광역시'
        WHEN 'DAE' THEN '대구광역시'
        WHEN 'INC' THEN '인천광역시'
        WHEN 'GWA' THEN '광주광역시'
        WHEN 'DAJ' THEN '대전광역시'
        WHEN 'ULS' THEN '울산광역시'
        WHEN 'SEJ' THEN '세종특별자치시'
        WHEN 'GYE' THEN '경기도'
        WHEN 'GAN' THEN '강원특별자치도'
        WHEN 'CHB' THEN '충청북도'
        WHEN 'CHN' THEN '충청남도'
        WHEN 'JEB' THEN '전북특별자치도'
        WHEN 'JEN' THEN '전라남도'
        WHEN 'GYB' THEN '경상북도'
        WHEN 'GYN' THEN '경상남도'
        WHEN 'JEJ' THEN '제주특별자치도'
        ELSE code
      END
      FROM UNNEST(p_region_codes) AS code
    );
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.management_number,
    a.equipment_serial,
    a.installation_address AS address,
    a.installation_position AS detailed_address,
    a.sido,
    a.gugun,
    a.jurisdiction_health_center,
    a.latitude,
    a.longitude,
    a.manager,
    CASE WHEN a.external_display = 'Y' THEN TRUE ELSE FALSE END AS is_public_visible,
    a.institution_contact AS contact_phone,
    a.last_inspection_date::TEXT,
    a.installation_date,
    a.category_1,
    a.category_2,
    a.category_3,
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
    a.purchase_institution,
    CASE
      WHEN user_org_lat IS NOT NULL AND user_org_lng IS NOT NULL AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
      THEN ST_Distance(ST_MakePoint(user_org_lng, user_org_lat)::geography, ST_MakePoint(a.longitude::double precision, a.latitude::double precision)::geography) / 1000.0
      ELSE 999999.0
    END AS distance_km
  FROM public.aed_data a
  WHERE
    -- Note: p_health_center_id is ignored since aed_data doesn't have health_center_id column
    (p_region_codes IS NULL OR a.sido = ANY(region_labels))
    AND (p_city_codes IS NULL OR a.gugun = ANY(p_city_codes))
    AND (p_category_1 IS NULL OR a.category_1 = ANY(p_category_1))
    AND (p_category_2 IS NULL OR a.category_2 = ANY(p_category_2))
    AND (p_category_3 IS NULL OR a.category_3 = ANY(p_category_3))
    AND (
      p_search IS NULL OR
      a.installation_institution ILIKE '%' || p_search || '%' OR
      a.installation_address ILIKE '%' || p_search || '%' OR
      a.management_number ILIKE '%' || p_search || '%' OR
      a.equipment_serial ILIKE '%' || p_search || '%'
    )
  ORDER BY distance_km ASC, a.id ASC
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;
