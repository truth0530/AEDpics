-- 위치 기반 AED 검색 RPC 함수
-- 지도 중심 좌표와 반경(미터)을 기준으로 AED 데이터를 조회

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
AS $$
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
    -- PostGIS 거리 계산: ST_DWithin을 geography 타입으로 사용
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(a.longitude, a.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_meters
    )
  ORDER BY
    -- 거리순 정렬 (가까운 순)
    ST_Distance(
      ST_SetSRID(ST_MakePoint(a.longitude, a.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
    )
  LIMIT result_limit;
END;
$$;

-- 함수 설명
COMMENT ON FUNCTION get_aed_by_location IS '지도 중심 좌표와 반경(미터)을 기준으로 AED 데이터를 조회합니다. 거리순으로 정렬됩니다.';
