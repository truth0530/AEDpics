-- Fix device_serial column type mismatch
-- Change from TEXT to VARCHAR(255) to match the actual aed_data table structure

DROP FUNCTION IF EXISTS get_aed_data_filtered CASCADE;
DROP FUNCTION IF EXISTS get_aed_data_by_jurisdiction CASCADE;

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
  device_serial VARCHAR(255),  -- Changed from TEXT to VARCHAR(255)
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
      FROM region_mapping rm
      WHERE rm.code = ANY(p_region_codes)
    );
  END IF;

  RETURN QUERY
  SELECT
    ad.id::TEXT,
    ad.equipment_serial,
    ad.management_number,
    ad.installation_institution,
    ad.installation_address,
    di.detailed_address,
    ad.sido,
    ad.gugun,
    hc.name,
    hc.id,
    ad.latitude,
    ad.longitude,
    COALESCE(ad.battery_expiry_date, ad.patch_expiry_date),
    CASE
      WHEN ad.battery_expiry_date IS NOT NULL THEN
        (ad.battery_expiry_date - CURRENT_DATE)
      WHEN ad.patch_expiry_date IS NOT NULL THEN
        (ad.patch_expiry_date - CURRENT_DATE)
      ELSE NULL
    END,
    ad.operation_status,
    (ad.external_display = 'Y'),
    di.contact_phone,
    di.contact_email,
    (di.contact_phone IS NOT NULL OR di.contact_email IS NOT NULL),
    ad.last_inspection_date,
    ad.installation_date
  FROM aed_data ad
  LEFT JOIN device_info di ON ad.equipment_serial = di.equipment_serial
  LEFT JOIN health_centers hc ON ad.jurisdiction_health_center = hc.name
  WHERE
    (p_region_codes IS NULL OR ad.sido = ANY(region_labels))
    AND (p_city_codes IS NULL OR ad.gugun = ANY(p_city_codes))
    AND (
      p_search IS NULL OR
      ad.equipment_serial ILIKE '%' || p_search || '%' OR
      ad.installation_institution ILIKE '%' || p_search || '%' OR
      ad.installation_address ILIKE '%' || p_search || '%'
    )
  ORDER BY ad.id
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

CREATE FUNCTION get_aed_data_by_jurisdiction(
  p_health_center_id UUID,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id TEXT,
  device_serial VARCHAR(255),  -- Changed from TEXT to VARCHAR(255)
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
  installation_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.id::TEXT,
    ad.equipment_serial,
    ad.management_number,
    ad.installation_institution,
    ad.installation_address,
    di.detailed_address,
    ad.sido,
    ad.gugun,
    hc.name,
    hc.id,
    ad.latitude,
    ad.longitude,
    COALESCE(ad.battery_expiry_date, ad.patch_expiry_date),
    CASE
      WHEN ad.battery_expiry_date IS NOT NULL THEN
        (ad.battery_expiry_date - CURRENT_DATE)
      WHEN ad.patch_expiry_date IS NOT NULL THEN
        (ad.patch_expiry_date - CURRENT_DATE)
      ELSE NULL
    END,
    ad.operation_status,
    (ad.external_display = 'Y'),
    di.contact_phone,
    di.contact_email,
    (di.contact_phone IS NOT NULL OR di.contact_email IS NOT NULL),
    ad.last_inspection_date,
    ad.installation_date
  FROM aed_data ad
  LEFT JOIN device_info di ON ad.equipment_serial = di.equipment_serial
  LEFT JOIN health_centers hc ON ad.jurisdiction_health_center = hc.name
  WHERE hc.id = p_health_center_id
  ORDER BY ad.id
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
