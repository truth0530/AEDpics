-- Fix get_aed_data_filtered function to properly return last_inspection_date
-- This recreates the function with all necessary columns

DROP FUNCTION IF EXISTS get_aed_data_filtered CASCADE;

CREATE OR REPLACE FUNCTION get_aed_data_filtered(
  p_user_role TEXT DEFAULT NULL,
  p_region_codes TEXT[] DEFAULT NULL,
  p_city_codes TEXT[] DEFAULT NULL,
  p_battery_expiry_filter TEXT DEFAULT NULL,
  p_patch_expiry_filter TEXT DEFAULT NULL,
  p_replacement_filter TEXT DEFAULT NULL,
  p_last_inspection_filter TEXT DEFAULT NULL,
  p_status_filters TEXT[] DEFAULT NULL,
  p_category_1_filters TEXT[] DEFAULT NULL,
  p_category_2_filters TEXT[] DEFAULT NULL,
  p_category_3_filters TEXT[] DEFAULT NULL,
  p_external_display_filter TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0,
  p_cursor TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  management_number TEXT,
  equipment_serial TEXT,
  model_name TEXT,
  manufacturer TEXT,
  manufacturing_date DATE,
  serial_number TEXT,
  installation_date DATE,
  installation_institution TEXT,
  installation_address TEXT,
  installation_position TEXT,
  health_center_name TEXT,
  manager_name TEXT,
  institution_contact TEXT,
  sido TEXT,
  gugun TEXT,
  longitude NUMERIC,
  latitude NUMERIC,
  operation_status TEXT,
  display_allowed TEXT,
  external_display TEXT,
  battery_expiry_date DATE,
  patch_existence TEXT,
  patch_expiry_date DATE,
  last_inspection_date DATE,
  replacement_date DATE,
  category_1 TEXT,
  category_2 TEXT,
  category_3 TEXT,
  jurisdiction_health_center TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.id::TEXT,
    ad.management_number,
    ad.equipment_serial,
    ad.model_name,
    ad.manufacturer,
    ad.manufacturing_date,
    ad.serial_number,
    ad.installation_date,
    ad.installation_institution,
    ad.installation_address,
    ad.installation_position,
    ad.health_center_name,
    ad.manager_name,
    ad.institution_contact,
    ad.sido,
    ad.gugun,
    ad.longitude,
    ad.latitude,
    ad.operation_status,
    ad.display_allowed,
    ad.external_display,
    ad.battery_expiry_date,
    ad.patch_existence,
    ad.patch_expiry_date,
    ad.last_inspection_date,
    ad.replacement_date,
    ad.category_1,
    ad.category_2,
    ad.category_3,
    ad.jurisdiction_health_center
  FROM aed_data ad
  WHERE
    -- Region filter
    (p_region_codes IS NULL OR ad.sido = ANY(p_region_codes))
    AND
    -- City filter
    (p_city_codes IS NULL OR ad.gugun = ANY(p_city_codes))
    AND
    -- Battery expiry filter
    (p_battery_expiry_filter IS NULL OR
      CASE p_battery_expiry_filter
        WHEN 'expired' THEN ad.battery_expiry_date < CURRENT_DATE
        WHEN 'in30' THEN ad.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        WHEN 'in60' THEN ad.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
        WHEN 'in90' THEN ad.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
        WHEN 'over90' THEN ad.battery_expiry_date > CURRENT_DATE + INTERVAL '90 days'
        ELSE TRUE
      END
    )
    AND
    -- Patch expiry filter
    (p_patch_expiry_filter IS NULL OR
      CASE p_patch_expiry_filter
        WHEN 'expired' THEN ad.patch_expiry_date < CURRENT_DATE
        WHEN 'in30' THEN ad.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        WHEN 'in60' THEN ad.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
        WHEN 'in90' THEN ad.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
        WHEN 'over90' THEN ad.patch_expiry_date > CURRENT_DATE + INTERVAL '90 days'
        ELSE TRUE
      END
    )
    AND
    -- Replacement date filter
    (p_replacement_filter IS NULL OR
      CASE p_replacement_filter
        WHEN 'expired' THEN ad.replacement_date < CURRENT_DATE
        WHEN 'in30' THEN ad.replacement_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        WHEN 'in60' THEN ad.replacement_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
        WHEN 'in90' THEN ad.replacement_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
        WHEN 'over90' THEN ad.replacement_date > CURRENT_DATE + INTERVAL '90 days'
        ELSE TRUE
      END
    )
    AND
    -- Last inspection date filter
    (p_last_inspection_filter IS NULL OR
      CASE p_last_inspection_filter
        WHEN 'expired' THEN ad.last_inspection_date < CURRENT_DATE - INTERVAL '30 days' OR ad.last_inspection_date IS NULL
        WHEN 'in30' THEN ad.last_inspection_date BETWEEN CURRENT_DATE - INTERVAL '60 days' AND CURRENT_DATE - INTERVAL '30 days'
        WHEN 'in60' THEN ad.last_inspection_date BETWEEN CURRENT_DATE - INTERVAL '90 days' AND CURRENT_DATE - INTERVAL '60 days'
        WHEN 'in90' THEN ad.last_inspection_date BETWEEN CURRENT_DATE - INTERVAL '120 days' AND CURRENT_DATE - INTERVAL '90 days'
        WHEN 'over90' THEN ad.last_inspection_date < CURRENT_DATE - INTERVAL '120 days'
        ELSE TRUE
      END
    )
    AND
    -- Status filter
    (p_status_filters IS NULL OR ad.operation_status = ANY(p_status_filters))
    AND
    -- Category filters
    (p_category_1_filters IS NULL OR ad.category_1 = ANY(p_category_1_filters))
    AND
    (p_category_2_filters IS NULL OR ad.category_2 = ANY(p_category_2_filters))
    AND
    (p_category_3_filters IS NULL OR ad.category_3 = ANY(p_category_3_filters))
    AND
    -- External display filter
    (p_external_display_filter IS NULL OR
      CASE p_external_display_filter
        WHEN 'Y' THEN ad.external_display = 'Y'
        WHEN 'N' THEN ad.external_display = 'N' OR ad.external_display IS NULL OR ad.external_display = ''
        ELSE TRUE
      END
    )
    AND
    -- Search filter (검색어가 여러 컬럼에 포함되는지 확인)
    (p_search IS NULL OR
      ad.installation_institution ILIKE '%' || p_search || '%' OR
      ad.installation_address ILIKE '%' || p_search || '%' OR
      ad.installation_position ILIKE '%' || p_search || '%' OR
      ad.management_number ILIKE '%' || p_search || '%' OR
      ad.equipment_serial ILIKE '%' || p_search || '%'
    )
  ORDER BY ad.id
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_aed_data_filtered TO anon, authenticated;
