-- 위치 기반 AED 검색 RPC 함수 수정
-- 실제 aed_data 테이블 스키마에 맞춤

DROP FUNCTION IF EXISTS get_aed_by_location(double precision, double precision, integer, integer);

CREATE OR REPLACE FUNCTION get_aed_by_location(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 3000,
  result_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  id INTEGER,
  equipment_serial TEXT,
  management_number TEXT,
  installation_institution TEXT,
  installation_address TEXT,
  installation_position TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  sido TEXT,
  gugun TEXT,
  jurisdiction_health_center TEXT,
  manager TEXT,
  model_name TEXT,
  manufacturer TEXT,
  battery_expiry_date TEXT,
  patch_expiry_date TEXT,
  last_inspection_date TEXT,
  operation_status TEXT,
  external_display TEXT,
  external_non_display_reason TEXT,
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
  first_installation_date TEXT,
  installation_date TEXT,
  last_use_date TEXT,
  purchase_institution TEXT,
  distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.equipment_serial,
    a.management_number,
    a.installation_institution,
    a.installation_address,
    a.installation_position,
    a.latitude,
    a.longitude,
    a.sido,
    a.gugun,
    a.jurisdiction_health_center,
    a.manager,
    a.model_name,
    a.manufacturer,
    a.battery_expiry_date::TEXT,
    a.patch_expiry_date::TEXT,
    a.last_inspection_date::TEXT,
    a.operation_status,
    a.external_display,
    a.external_non_display_reason,
    a.category_1,
    a.category_2,
    a.category_3,
    a.display_allowed,
    a.installation_method,
    a.registration_date::TEXT,
    a.manufacturing_date::TEXT,
    a.manufacturing_country,
    a.serial_number,
    a.establisher,
    a.government_support,
    a.patch_available,
    a.remarks,
    a.first_installation_date::TEXT,
    a.installation_date::TEXT,
    a.last_use_date::TEXT,
    a.purchase_institution,
    -- 거리 계산 (미터 단위)
    ST_Distance(
      ST_SetSRID(ST_MakePoint(a.longitude, a.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
    ) AS distance_meters
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
    distance_meters
  LIMIT result_limit;
END;
$$;

-- 함수 설명
COMMENT ON FUNCTION get_aed_by_location IS '지도 중심 좌표와 반경(미터)을 기준으로 AED 데이터를 조회합니다. 거리순으로 정렬됩니다.';
