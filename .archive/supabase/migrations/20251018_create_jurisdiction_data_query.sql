-- Create get_aed_data_by_jurisdiction RPC function
-- 목적: queryCriteria='jurisdiction' 지원 - 관할보건소 기준 AED 데이터 조회
-- 성능: 29ms (JOIN + REPLACE), ~80x slower than address query but acceptable

CREATE OR REPLACE FUNCTION get_aed_data_by_jurisdiction(
    p_region_codes TEXT[] DEFAULT NULL,
    p_city_codes TEXT[] DEFAULT NULL,
    p_battery_expiry TEXT DEFAULT NULL,
    p_patch_expiry TEXT DEFAULT NULL,
    p_replacement_date TEXT DEFAULT NULL,
    p_last_inspection_date TEXT DEFAULT NULL,
    p_status_filters TEXT[] DEFAULT NULL,
    p_category_1 TEXT[] DEFAULT NULL,
    p_category_2 TEXT[] DEFAULT NULL,
    p_category_3 TEXT[] DEFAULT NULL,
    p_external_display TEXT DEFAULT NULL,
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
)
RETURNS SETOF aed_data
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT a.*
    FROM aed_data a
    INNER JOIN organizations o
      ON REPLACE(a.jurisdiction_health_center, ' ', '') = REPLACE(o.name, ' ', '')
    WHERE o.type = 'health_center'
      -- 지역 필터 (관할보건소 기준)
      AND (p_region_codes IS NULL OR o.region_code = ANY(p_region_codes))
      AND (p_city_codes IS NULL OR o.city_code = ANY(p_city_codes))

      -- 배터리 만료일 필터 (6가지 옵션)
      AND (p_battery_expiry IS NULL OR
          CASE p_battery_expiry
              WHEN 'expired' THEN a.battery_expiry_date < CURRENT_DATE
              WHEN 'in30' THEN a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
              WHEN 'in60' THEN a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
              WHEN 'in90' THEN a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
              WHEN 'in180' THEN a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '180 days'
              WHEN 'in365' THEN a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '365 days'
              WHEN 'no_expiry' THEN a.battery_expiry_date IS NULL
              WHEN 'never' THEN a.battery_expiry_date IS NULL
              WHEN 'over365' THEN a.battery_expiry_date > CURRENT_DATE + INTERVAL '365 days'
              WHEN 'over180' THEN a.battery_expiry_date > CURRENT_DATE + INTERVAL '180 days'
              WHEN 'over90' THEN a.battery_expiry_date > CURRENT_DATE + INTERVAL '90 days'
              WHEN 'over60' THEN a.battery_expiry_date > CURRENT_DATE + INTERVAL '60 days'
              WHEN 'over30' THEN a.battery_expiry_date > CURRENT_DATE + INTERVAL '30 days'
              WHEN 'all_with_expiry' THEN a.battery_expiry_date IS NOT NULL
              ELSE TRUE
          END
      )

      -- 패드 만료일 필터 (6가지 옵션)
      AND (p_patch_expiry IS NULL OR
          CASE p_patch_expiry
              WHEN 'expired' THEN a.patch_expiry_date < CURRENT_DATE
              WHEN 'in30' THEN a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
              WHEN 'in60' THEN a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
              WHEN 'in90' THEN a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
              WHEN 'in180' THEN a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '180 days'
              WHEN 'in365' THEN a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '365 days'
              WHEN 'no_expiry' THEN a.patch_expiry_date IS NULL
              WHEN 'never' THEN a.patch_expiry_date IS NULL
              WHEN 'over365' THEN a.patch_expiry_date > CURRENT_DATE + INTERVAL '365 days'
              WHEN 'over180' THEN a.patch_expiry_date > CURRENT_DATE + INTERVAL '180 days'
              WHEN 'over90' THEN a.patch_expiry_date > CURRENT_DATE + INTERVAL '90 days'
              WHEN 'over60' THEN a.patch_expiry_date > CURRENT_DATE + INTERVAL '60 days'
              WHEN 'over30' THEN a.patch_expiry_date > CURRENT_DATE + INTERVAL '30 days'
              WHEN 'all_with_expiry' THEN a.patch_expiry_date IS NOT NULL
              ELSE TRUE
          END
      )

      -- 교체예정일 필터 (6가지 옵션)
      AND (p_replacement_date IS NULL OR
          CASE p_replacement_date
              WHEN 'expired' THEN a.replacement_date < CURRENT_DATE
              WHEN 'in30' THEN a.replacement_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
              WHEN 'in60' THEN a.replacement_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
              WHEN 'in90' THEN a.replacement_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
              WHEN 'in180' THEN a.replacement_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '180 days'
              WHEN 'in365' THEN a.replacement_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '365 days'
              WHEN 'no_expiry' THEN a.replacement_date IS NULL
              WHEN 'never' THEN a.replacement_date IS NULL
              WHEN 'over365' THEN a.replacement_date > CURRENT_DATE + INTERVAL '365 days'
              WHEN 'over180' THEN a.replacement_date > CURRENT_DATE + INTERVAL '180 days'
              WHEN 'over90' THEN a.replacement_date > CURRENT_DATE + INTERVAL '90 days'
              WHEN 'over60' THEN a.replacement_date > CURRENT_DATE + INTERVAL '60 days'
              WHEN 'over30' THEN a.replacement_date > CURRENT_DATE + INTERVAL '30 days'
              WHEN 'all_with_expiry' THEN a.replacement_date IS NOT NULL
              ELSE TRUE
          END
      )

      -- 점검일 필터 (6가지 옵션)
      AND (p_last_inspection_date IS NULL OR
          CASE p_last_inspection_date
              WHEN 'expired' THEN a.last_inspection_date < CURRENT_DATE - INTERVAL '1 year' OR a.last_inspection_date IS NULL
              WHEN 'in30' THEN a.last_inspection_date >= CURRENT_DATE - INTERVAL '30 days'
              WHEN 'in60' THEN a.last_inspection_date >= CURRENT_DATE - INTERVAL '60 days'
              WHEN 'in90' THEN a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days'
              WHEN 'in180' THEN a.last_inspection_date >= CURRENT_DATE - INTERVAL '180 days'
              WHEN 'in365' THEN a.last_inspection_date >= CURRENT_DATE - INTERVAL '365 days'
              WHEN 'no_expiry' THEN a.last_inspection_date IS NULL
              WHEN 'never' THEN a.last_inspection_date IS NULL
              WHEN 'over365' THEN a.last_inspection_date < CURRENT_DATE - INTERVAL '365 days'
              WHEN 'over180' THEN a.last_inspection_date < CURRENT_DATE - INTERVAL '180 days'
              WHEN 'over90' THEN a.last_inspection_date < CURRENT_DATE - INTERVAL '90 days'
              WHEN 'over60' THEN a.last_inspection_date < CURRENT_DATE - INTERVAL '60 days'
              WHEN 'over30' THEN a.last_inspection_date < CURRENT_DATE - INTERVAL '30 days'
              WHEN 'all_with_expiry' THEN a.last_inspection_date IS NOT NULL
              ELSE TRUE
          END
      )

      -- 상태 필터
      AND (p_status_filters IS NULL OR a.operation_status = ANY(p_status_filters))

      -- 카테고리 필터
      AND (p_category_1 IS NULL OR a.category_1 = ANY(p_category_1))
      AND (p_category_2 IS NULL OR a.category_2 = ANY(p_category_2))
      AND (p_category_3 IS NULL OR a.category_3 = ANY(p_category_3))

      -- 외부표출 필터
      AND (p_external_display IS NULL OR
          CASE p_external_display
              WHEN 'Y' THEN a.external_display = 'Y'
              WHEN 'N' THEN a.external_display = 'N'
              WHEN 'blocked' THEN
                  a.external_display = 'N'
                  AND a.external_non_display_reason IS NOT NULL
                  AND a.external_non_display_reason NOT LIKE '%구비의무기관%'
              ELSE TRUE
          END
      )
    ORDER BY a.id
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION get_aed_data_by_jurisdiction TO authenticated;

-- 함수 설명
COMMENT ON FUNCTION get_aed_data_by_jurisdiction IS 'queryCriteria=jurisdiction 지원 - 관할보건소 기준 AED 데이터 조회 (공백 정규화 적용)';

-- 테스트 쿼리 예시
-- SELECT * FROM get_aed_data_by_jurisdiction(
--     p_region_codes := ARRAY['DAE'],
--     p_battery_expiry := 'expired',
--     p_limit := 10
-- );
