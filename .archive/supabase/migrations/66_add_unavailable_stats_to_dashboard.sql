-- 점검불가 통계 추가
-- inspection_assignments 테이블에서 status='unavailable'인 항목 집계

-- 1. 전국 시도별 대시보드 통계에 점검불가 필드 추가
DROP FUNCTION IF EXISTS get_dashboard_stats_by_region();

CREATE OR REPLACE FUNCTION get_dashboard_stats_by_region()
RETURNS TABLE (
  region VARCHAR,
  total_count BIGINT,
  mandatory_count BIGINT,
  non_mandatory_count BIGINT,
  completed_count BIGINT,
  completed_mandatory_count BIGINT,
  completed_non_mandatory_count BIGINT,
  urgent_count BIGINT,
  completion_rate NUMERIC,
  blocked_count BIGINT,
  blocked_mandatory_count BIGINT,
  blocked_non_mandatory_count BIGINT,
  blocked_inspected_count BIGINT,
  blocked_inspected_mandatory_count BIGINT,
  blocked_inspected_non_mandatory_count BIGINT,
  uninspected_count BIGINT,
  uninspected_mandatory_count BIGINT,
  uninspected_non_mandatory_count BIGINT,
  field_inspected_count BIGINT,
  field_inspected_mandatory_count BIGINT,
  field_inspected_non_mandatory_count BIGINT,
  assigned_count BIGINT,
  assigned_mandatory_count BIGINT,
  assigned_non_mandatory_count BIGINT,
  unavailable_count BIGINT,
  unavailable_mandatory_count BIGINT,
  unavailable_non_mandatory_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(a.sido, '미분류')::VARCHAR AS region,
    COUNT(*)::BIGINT AS total_count,
    COUNT(*) FILTER (WHERE a.category_1 = '구비의무기관')::BIGINT AS mandatory_count,
    COUNT(*) FILTER (WHERE a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL)::BIGINT AS non_mandatory_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days')::BIGINT AS completed_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days' AND a.category_1 = '구비의무기관')::BIGINT AS completed_mandatory_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days' AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL))::BIGINT AS completed_non_mandatory_count,
    COUNT(*) FILTER (WHERE
      a.battery_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
      a.patch_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
      a.last_inspection_date < CURRENT_DATE - INTERVAL '90 days'
    )::BIGINT AS urgent_count,
    ROUND(
      CASE
        WHEN COUNT(*) > 0 THEN
          (COUNT(*) FILTER (WHERE a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days')::NUMERIC / COUNT(*)::NUMERIC * 100)
        ELSE 0
      END,
      1
    ) AS completion_rate,
    -- 외부표출 차단
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
    )::BIGINT AS blocked_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND a.category_1 = '구비의무기관'
    )::BIGINT AS blocked_mandatory_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL)
    )::BIGINT AS blocked_non_mandatory_count,
    -- 외부표출 차단 장비 중 점검 완료
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days'
    )::BIGINT AS blocked_inspected_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days'
      AND a.category_1 = '구비의무기관'
    )::BIGINT AS blocked_inspected_mandatory_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days'
      AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL)
    )::BIGINT AS blocked_inspected_non_mandatory_count,
    -- 미점검 장비
    COUNT(*) FILTER (WHERE a.last_inspection_date IS NULL)::BIGINT AS uninspected_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date IS NULL AND a.category_1 = '구비의무기관')::BIGINT AS uninspected_mandatory_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date IS NULL AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL))::BIGINT AS uninspected_non_mandatory_count,
    -- 현장점검 완료 (inspection_sessions에서 status='completed')
    COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN a.equipment_serial END)::BIGINT AS field_inspected_count,
    COUNT(DISTINCT CASE WHEN s.status = 'completed' AND a.category_1 = '구비의무기관' THEN a.equipment_serial END)::BIGINT AS field_inspected_mandatory_count,
    COUNT(DISTINCT CASE WHEN s.status = 'completed' AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL) THEN a.equipment_serial END)::BIGINT AS field_inspected_non_mandatory_count,
    -- 일정추가 (inspection_assignments에서 status='pending')
    COUNT(DISTINCT CASE WHEN ia.status = 'pending' THEN a.equipment_serial END)::BIGINT AS assigned_count,
    COUNT(DISTINCT CASE WHEN ia.status = 'pending' AND a.category_1 = '구비의무기관' THEN a.equipment_serial END)::BIGINT AS assigned_mandatory_count,
    COUNT(DISTINCT CASE WHEN ia.status = 'pending' AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL) THEN a.equipment_serial END)::BIGINT AS assigned_non_mandatory_count,
    -- 점검불가 (inspection_assignments에서 status='unavailable')
    COUNT(DISTINCT CASE WHEN ia.status = 'unavailable' THEN a.equipment_serial END)::BIGINT AS unavailable_count,
    COUNT(DISTINCT CASE WHEN ia.status = 'unavailable' AND a.category_1 = '구비의무기관' THEN a.equipment_serial END)::BIGINT AS unavailable_mandatory_count,
    COUNT(DISTINCT CASE WHEN ia.status = 'unavailable' AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL) THEN a.equipment_serial END)::BIGINT AS unavailable_non_mandatory_count
  FROM aed_data a
  LEFT JOIN inspection_sessions s ON a.equipment_serial = s.equipment_serial
  LEFT JOIN inspection_assignments ia ON a.equipment_serial = ia.equipment_serial
  GROUP BY a.sido
  ORDER BY total_count DESC;
END;
$$;

-- 2. 시군구별 대시보드 통계에 점검불가 필드 추가
DROP FUNCTION IF EXISTS get_dashboard_stats_by_city(VARCHAR);

CREATE OR REPLACE FUNCTION get_dashboard_stats_by_city(p_region_code VARCHAR)
RETURNS TABLE (
  city VARCHAR,
  total_count BIGINT,
  mandatory_count BIGINT,
  non_mandatory_count BIGINT,
  completed_count BIGINT,
  completed_mandatory_count BIGINT,
  completed_non_mandatory_count BIGINT,
  urgent_count BIGINT,
  completion_rate NUMERIC,
  blocked_count BIGINT,
  blocked_mandatory_count BIGINT,
  blocked_non_mandatory_count BIGINT,
  blocked_inspected_count BIGINT,
  blocked_inspected_mandatory_count BIGINT,
  blocked_inspected_non_mandatory_count BIGINT,
  uninspected_count BIGINT,
  uninspected_mandatory_count BIGINT,
  uninspected_non_mandatory_count BIGINT,
  field_inspected_count BIGINT,
  field_inspected_mandatory_count BIGINT,
  field_inspected_non_mandatory_count BIGINT,
  assigned_count BIGINT,
  assigned_mandatory_count BIGINT,
  assigned_non_mandatory_count BIGINT,
  unavailable_count BIGINT,
  unavailable_mandatory_count BIGINT,
  unavailable_non_mandatory_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(a.gugun, a.city_code, '미분류')::VARCHAR AS city,
    COUNT(*)::BIGINT AS total_count,
    COUNT(*) FILTER (WHERE a.category_1 = '구비의무기관')::BIGINT AS mandatory_count,
    COUNT(*) FILTER (WHERE a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL)::BIGINT AS non_mandatory_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days')::BIGINT AS completed_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days' AND a.category_1 = '구비의무기관')::BIGINT AS completed_mandatory_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days' AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL))::BIGINT AS completed_non_mandatory_count,
    COUNT(*) FILTER (WHERE
      a.battery_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
      a.patch_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
      a.last_inspection_date < CURRENT_DATE - INTERVAL '90 days'
    )::BIGINT AS urgent_count,
    ROUND(
      CASE
        WHEN COUNT(*) > 0 THEN
          (COUNT(*) FILTER (WHERE a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days')::NUMERIC / COUNT(*)::NUMERIC * 100)
        ELSE 0
      END,
      1
    ) AS completion_rate,
    -- 외부표출 차단
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
    )::BIGINT AS blocked_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND a.category_1 = '구비의무기관'
    )::BIGINT AS blocked_mandatory_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL)
    )::BIGINT AS blocked_non_mandatory_count,
    -- 외부표출 차단 장비 중 점검 완료
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days'
    )::BIGINT AS blocked_inspected_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days'
      AND a.category_1 = '구비의무기관'
    )::BIGINT AS blocked_inspected_mandatory_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days'
      AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL)
    )::BIGINT AS blocked_inspected_non_mandatory_count,
    -- 미점검 장비
    COUNT(*) FILTER (WHERE a.last_inspection_date IS NULL)::BIGINT AS uninspected_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date IS NULL AND a.category_1 = '구비의무기관')::BIGINT AS uninspected_mandatory_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date IS NULL AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL))::BIGINT AS uninspected_non_mandatory_count,
    -- 현장점검 완료 (inspection_sessions에서 status='completed')
    COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN a.equipment_serial END)::BIGINT AS field_inspected_count,
    COUNT(DISTINCT CASE WHEN s.status = 'completed' AND a.category_1 = '구비의무기관' THEN a.equipment_serial END)::BIGINT AS field_inspected_mandatory_count,
    COUNT(DISTINCT CASE WHEN s.status = 'completed' AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL) THEN a.equipment_serial END)::BIGINT AS field_inspected_non_mandatory_count,
    -- 일정추가 (inspection_assignments에서 status='pending')
    COUNT(DISTINCT CASE WHEN ia.status = 'pending' THEN a.equipment_serial END)::BIGINT AS assigned_count,
    COUNT(DISTINCT CASE WHEN ia.status = 'pending' AND a.category_1 = '구비의무기관' THEN a.equipment_serial END)::BIGINT AS assigned_mandatory_count,
    COUNT(DISTINCT CASE WHEN ia.status = 'pending' AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL) THEN a.equipment_serial END)::BIGINT AS assigned_non_mandatory_count,
    -- 점검불가 (inspection_assignments에서 status='unavailable')
    COUNT(DISTINCT CASE WHEN ia.status = 'unavailable' THEN a.equipment_serial END)::BIGINT AS unavailable_count,
    COUNT(DISTINCT CASE WHEN ia.status = 'unavailable' AND a.category_1 = '구비의무기관' THEN a.equipment_serial END)::BIGINT AS unavailable_mandatory_count,
    COUNT(DISTINCT CASE WHEN ia.status = 'unavailable' AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL) THEN a.equipment_serial END)::BIGINT AS unavailable_non_mandatory_count
  FROM aed_data a
  LEFT JOIN inspection_sessions s ON a.equipment_serial = s.equipment_serial
  LEFT JOIN inspection_assignments ia ON a.equipment_serial = ia.equipment_serial
  WHERE a.region_code = p_region_code
  GROUP BY a.gugun, a.city_code
  ORDER BY total_count DESC;
END;
$$;

-- 3. 보건소별 대시보드 통계에 점검불가 필드 추가
DROP FUNCTION IF EXISTS get_dashboard_stats_by_health_center(VARCHAR);

CREATE OR REPLACE FUNCTION get_dashboard_stats_by_health_center(p_health_center VARCHAR)
RETURNS TABLE (
  total_count BIGINT,
  mandatory_count BIGINT,
  non_mandatory_count BIGINT,
  completed_count BIGINT,
  completed_mandatory_count BIGINT,
  completed_non_mandatory_count BIGINT,
  urgent_count BIGINT,
  completion_rate NUMERIC,
  blocked_count BIGINT,
  blocked_mandatory_count BIGINT,
  blocked_non_mandatory_count BIGINT,
  blocked_inspected_count BIGINT,
  blocked_inspected_mandatory_count BIGINT,
  blocked_inspected_non_mandatory_count BIGINT,
  uninspected_count BIGINT,
  uninspected_mandatory_count BIGINT,
  uninspected_non_mandatory_count BIGINT,
  field_inspected_count BIGINT,
  field_inspected_mandatory_count BIGINT,
  field_inspected_non_mandatory_count BIGINT,
  assigned_count BIGINT,
  assigned_mandatory_count BIGINT,
  assigned_non_mandatory_count BIGINT,
  unavailable_count BIGINT,
  unavailable_mandatory_count BIGINT,
  unavailable_non_mandatory_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_count,
    COUNT(*) FILTER (WHERE a.category_1 = '구비의무기관')::BIGINT AS mandatory_count,
    COUNT(*) FILTER (WHERE a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL)::BIGINT AS non_mandatory_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days')::BIGINT AS completed_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days' AND a.category_1 = '구비의무기관')::BIGINT AS completed_mandatory_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days' AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL))::BIGINT AS completed_non_mandatory_count,
    COUNT(*) FILTER (WHERE
      a.battery_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
      a.patch_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
      a.last_inspection_date < CURRENT_DATE - INTERVAL '90 days'
    )::BIGINT AS urgent_count,
    ROUND(
      CASE
        WHEN COUNT(*) > 0 THEN
          (COUNT(*) FILTER (WHERE a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days')::NUMERIC / COUNT(*)::NUMERIC * 100)
        ELSE 0
      END,
      1
    ) AS completion_rate,
    -- 외부표출 차단
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
    )::BIGINT AS blocked_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND a.category_1 = '구비의무기관'
    )::BIGINT AS blocked_mandatory_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL)
    )::BIGINT AS blocked_non_mandatory_count,
    -- 외부표출 차단 장비 중 점검 완료
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days'
    )::BIGINT AS blocked_inspected_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days'
      AND a.category_1 = '구비의무기관'
    )::BIGINT AS blocked_inspected_mandatory_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days'
      AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL)
    )::BIGINT AS blocked_inspected_non_mandatory_count,
    -- 미점검 장비
    COUNT(*) FILTER (WHERE a.last_inspection_date IS NULL)::BIGINT AS uninspected_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date IS NULL AND a.category_1 = '구비의무기관')::BIGINT AS uninspected_mandatory_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date IS NULL AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL))::BIGINT AS uninspected_non_mandatory_count,
    -- 현장점검 완료 (inspection_sessions에서 status='completed')
    COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN a.equipment_serial END)::BIGINT AS field_inspected_count,
    COUNT(DISTINCT CASE WHEN s.status = 'completed' AND a.category_1 = '구비의무기관' THEN a.equipment_serial END)::BIGINT AS field_inspected_mandatory_count,
    COUNT(DISTINCT CASE WHEN s.status = 'completed' AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL) THEN a.equipment_serial END)::BIGINT AS field_inspected_non_mandatory_count,
    -- 일정추가 (inspection_assignments에서 status='pending')
    COUNT(DISTINCT CASE WHEN ia.status = 'pending' THEN a.equipment_serial END)::BIGINT AS assigned_count,
    COUNT(DISTINCT CASE WHEN ia.status = 'pending' AND a.category_1 = '구비의무기관' THEN a.equipment_serial END)::BIGINT AS assigned_mandatory_count,
    COUNT(DISTINCT CASE WHEN ia.status = 'pending' AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL) THEN a.equipment_serial END)::BIGINT AS assigned_non_mandatory_count,
    -- 점검불가 (inspection_assignments에서 status='unavailable')
    COUNT(DISTINCT CASE WHEN ia.status = 'unavailable' THEN a.equipment_serial END)::BIGINT AS unavailable_count,
    COUNT(DISTINCT CASE WHEN ia.status = 'unavailable' AND a.category_1 = '구비의무기관' THEN a.equipment_serial END)::BIGINT AS unavailable_mandatory_count,
    COUNT(DISTINCT CASE WHEN ia.status = 'unavailable' AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL) THEN a.equipment_serial END)::BIGINT AS unavailable_non_mandatory_count
  FROM aed_data a
  LEFT JOIN inspection_sessions s ON a.equipment_serial = s.equipment_serial
  LEFT JOIN inspection_assignments ia ON a.equipment_serial = ia.equipment_serial
  WHERE a.jurisdiction_health_center = p_health_center;
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION get_dashboard_stats_by_region() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats_by_region() TO anon;
GRANT EXECUTE ON FUNCTION get_dashboard_stats_by_city(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats_by_city(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION get_dashboard_stats_by_health_center(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats_by_health_center(VARCHAR) TO anon;
