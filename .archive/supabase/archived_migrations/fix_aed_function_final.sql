-- 기존 함수들을 모두 삭제하고 새로 생성

-- 1. 기존 get_aed_data_filtered 함수 완전 삭제 (모든 오버로드)
DROP FUNCTION IF EXISTS get_aed_data_filtered CASCADE;

-- 2. 새 함수 생성 (API에서 사용하는 파라미터와 정확히 일치)
CREATE FUNCTION get_aed_data_filtered(
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
  p_offset INT DEFAULT 0
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
  expiry_date DATE,
  days_until_expiry INT,
  device_status TEXT,
  is_public_visible BOOLEAN,
  contact_phone TEXT,
  contact_email TEXT,
  has_sensitive_data BOOLEAN,
  last_inspection_date DATE,
  installation_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  region_labels TEXT[];
BEGIN
  IF p_region_codes IS NOT NULL THEN
    region_labels := ARRAY(
      SELECT rm.label
      FROM (VALUES
        ('KR', '중앙'),
        ('SEO', '서울특별시'),
        ('BUS', '부산광역시'),
        ('DAE', '대구광역시'),
        ('INC', '인천광역시'),
        ('GWA', '광주광역시'),
        ('DAJ', '대전광역시'),
        ('ULS', '울산광역시'),
        ('SEJ', '세종특별자치시'),
        ('GYE', '경기도'),
        ('GAN', '강원특별자치도'),
        ('CHU', '충청북도'),
        ('CHN', '충청남도'),
        ('JEO', '전북특별자치도'),
        ('JEN', '전라남도'),
        ('GYB', '경상북도'),
        ('GYN', '경상남도'),
        ('JEJ', '제주특별자치도')
      ) AS rm(code, label)
      WHERE rm.code = ANY(p_region_codes)
    );
  END IF;

  RETURN QUERY
  SELECT
    ad.id::TEXT,
    ad.equipment_serial AS device_serial,
    ad.management_number,
    ad.installation_institution AS installation_org,
    ad.installation_address AS address,
    ad.installation_position AS detailed_address,
    COALESCE(
      hc.region_code,
      (SELECT rm.code FROM (VALUES
        ('KR', '중앙'),
        ('SEO', '서울특별시'),
        ('BUS', '부산광역시'),
        ('DAE', '대구광역시'),
        ('INC', '인천광역시'),
        ('GWA', '광주광역시'),
        ('DAJ', '대전광역시'),
        ('ULS', '울산광역시'),
        ('SEJ', '세종특별자치시'),
        ('GYE', '경기도'),
        ('GAN', '강원특별자치도'),
        ('CHU', '충청북도'),
        ('CHN', '충청남도'),
        ('JEO', '전북특별자치도'),
        ('JEN', '전라남도'),
        ('GYB', '경상북도'),
        ('GYN', '경상남도'),
        ('JEJ', '제주특별자치도')
      ) AS rm(code, label)
      WHERE rm.label = ad.sido LIMIT 1),
      ad.sido
    ) AS region_code,
    COALESCE(hc.city_code, ad.gugun) AS city_code,
    ad.jurisdiction_health_center,
    hc.id AS health_center_id,
    COALESCE(ad.battery_expiry_date, ad.patch_expiry_date) AS expiry_date,
    CASE
      WHEN ad.battery_expiry_date IS NOT NULL THEN (ad.battery_expiry_date - CURRENT_DATE)::INT
      WHEN ad.patch_expiry_date IS NOT NULL THEN (ad.patch_expiry_date - CURRENT_DATE)::INT
      ELSE NULL
    END AS days_until_expiry,
    CASE
      WHEN ad.operation_status IN ('운영', '정상') THEN 'active'
      WHEN ad.operation_status IN ('중지', '비활성') THEN 'inactive'
      WHEN ad.operation_status IN ('점검중', '점검필요') THEN 'inspection_needed'
      WHEN ad.operation_status IN ('외부표출차단', '표출불가') THEN 'hidden'
      ELSE 'normal'
    END AS device_status,
    CASE
      WHEN ad.display_allowed ILIKE '%허용%' OR ad.display_allowed IN ('Y', 'y', 'YES', 'Yes') THEN TRUE
      ELSE FALSE
    END AS is_public_visible,
    ad.institution_contact AS contact_phone,
    NULL::TEXT AS contact_email,
    FALSE AS has_sensitive_data,
    ad.last_inspection_date,
    ad.installation_date
  FROM aed_data ad
  LEFT JOIN organizations hc ON hc.name = ad.jurisdiction_health_center
  WHERE
    (
      p_region_codes IS NULL
      OR (hc.region_code IS NOT NULL AND hc.region_code = ANY(p_region_codes))
      OR (region_labels IS NOT NULL AND ad.sido = ANY(region_labels))
      OR ad.sido = ANY(p_region_codes)
    )
    AND (
      p_city_codes IS NULL
      OR (hc.city_code IS NOT NULL AND hc.city_code = ANY(p_city_codes))
      OR ad.gugun = ANY(p_city_codes)
    )
    AND (
      p_expiry_filter IS NULL
      OR CASE p_expiry_filter
        WHEN 'expired' THEN
          (ad.battery_expiry_date < CURRENT_DATE OR ad.patch_expiry_date < CURRENT_DATE)
        WHEN 'in30' THEN
          ((ad.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
           OR (ad.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'))
        WHEN 'in60' THEN
          ((ad.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days')
           OR (ad.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'))
        WHEN 'in90' THEN
          ((ad.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days')
           OR (ad.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'))
        WHEN 'no_expiry' THEN
          (ad.battery_expiry_date IS NULL AND ad.patch_expiry_date IS NULL)
        WHEN 'all_with_expiry' THEN
          (ad.battery_expiry_date IS NOT NULL OR ad.patch_expiry_date IS NOT NULL)
        ELSE FALSE
      END
    )
    AND (
      p_status_filters IS NULL
      OR CASE
        WHEN ad.operation_status IN ('운영', '정상') THEN 'active'
        WHEN ad.operation_status IN ('중지', '비활성') THEN 'inactive'
        WHEN ad.operation_status IN ('점검중', '점검필요') THEN 'inspection_needed'
        WHEN ad.operation_status IN ('외부표출차단', '표출불가') THEN 'hidden'
        ELSE 'normal'
      END = ANY(p_status_filters)
    )
    AND (
      p_category_1 IS NULL
      OR ad.category_1 = ANY(p_category_1)
    )
    AND (
      p_category_2 IS NULL
      OR ad.category_2 = ANY(p_category_2)
    )
    AND (
      p_category_3 IS NULL
      OR ad.category_3 = ANY(p_category_3)
    )
    AND (
      p_search IS NULL
      OR ad.installation_institution ILIKE '%' || p_search || '%'
      OR ad.installation_address ILIKE '%' || p_search || '%'
      OR ad.installation_position ILIKE '%' || p_search || '%'
      OR ad.management_number ILIKE '%' || p_search || '%'
      OR ad.equipment_serial ILIKE '%' || p_search || '%'
    )
  ORDER BY ad.updated_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_aed_data_filtered TO anon, authenticated;
