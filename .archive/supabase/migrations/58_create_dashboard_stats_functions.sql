-- 대시보드 통계 조회를 위한 PostgreSQL 함수들
-- 성능 최적화: SQL에서 직접 집계하여 네트워크 전송량 감소

-- 1. 전국 시도별 대시보드 통계
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
  completion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(sido, '미분류')::VARCHAR AS region,
    COUNT(*)::BIGINT AS total_count,
    COUNT(*) FILTER (WHERE category_1 = '구비의무기관')::BIGINT AS mandatory_count,
    COUNT(*) FILTER (WHERE category_1 = '구비의무기관 외' OR category_1 IS NULL)::BIGINT AS non_mandatory_count,
    COUNT(*) FILTER (WHERE last_inspection_date >= CURRENT_DATE - INTERVAL '90 days')::BIGINT AS completed_count,
    COUNT(*) FILTER (WHERE last_inspection_date >= CURRENT_DATE - INTERVAL '90 days' AND category_1 = '구비의무기관')::BIGINT AS completed_mandatory_count,
    COUNT(*) FILTER (WHERE last_inspection_date >= CURRENT_DATE - INTERVAL '90 days' AND (category_1 = '구비의무기관 외' OR category_1 IS NULL))::BIGINT AS completed_non_mandatory_count,
    COUNT(*) FILTER (WHERE
      battery_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
      patch_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
      last_inspection_date < CURRENT_DATE - INTERVAL '90 days'
    )::BIGINT AS urgent_count,
    ROUND(
      CASE
        WHEN COUNT(*) > 0 THEN
          (COUNT(*) FILTER (WHERE last_inspection_date >= CURRENT_DATE - INTERVAL '90 days')::NUMERIC / COUNT(*)::NUMERIC * 100)
        ELSE 0
      END,
      1
    ) AS completion_rate
  FROM aed_data
  GROUP BY sido
  ORDER BY total_count DESC;
END;
$$;

-- 2. 시군구별 대시보드 통계 (특정 시도 필터링)
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
  completion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(gugun, city_code, '미분류')::VARCHAR AS city,
    COUNT(*)::BIGINT AS total_count,
    COUNT(*) FILTER (WHERE category_1 = '구비의무기관')::BIGINT AS mandatory_count,
    COUNT(*) FILTER (WHERE category_1 = '구비의무기관 외' OR category_1 IS NULL)::BIGINT AS non_mandatory_count,
    COUNT(*) FILTER (WHERE last_inspection_date >= CURRENT_DATE - INTERVAL '90 days')::BIGINT AS completed_count,
    COUNT(*) FILTER (WHERE last_inspection_date >= CURRENT_DATE - INTERVAL '90 days' AND category_1 = '구비의무기관')::BIGINT AS completed_mandatory_count,
    COUNT(*) FILTER (WHERE last_inspection_date >= CURRENT_DATE - INTERVAL '90 days' AND (category_1 = '구비의무기관 외' OR category_1 IS NULL))::BIGINT AS completed_non_mandatory_count,
    COUNT(*) FILTER (WHERE
      battery_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
      patch_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
      last_inspection_date < CURRENT_DATE - INTERVAL '90 days'
    )::BIGINT AS urgent_count,
    ROUND(
      CASE
        WHEN COUNT(*) > 0 THEN
          (COUNT(*) FILTER (WHERE last_inspection_date >= CURRENT_DATE - INTERVAL '90 days')::NUMERIC / COUNT(*)::NUMERIC * 100)
        ELSE 0
      END,
      1
    ) AS completion_rate
  FROM aed_data
  WHERE region_code = p_region_code
  GROUP BY gugun, city_code
  ORDER BY total_count DESC;
END;
$$;

-- 3. 보건소별 대시보드 통계
CREATE OR REPLACE FUNCTION get_dashboard_stats_by_health_center(p_health_center VARCHAR)
RETURNS TABLE (
  total_count BIGINT,
  mandatory_count BIGINT,
  non_mandatory_count BIGINT,
  completed_count BIGINT,
  completed_mandatory_count BIGINT,
  completed_non_mandatory_count BIGINT,
  urgent_count BIGINT,
  completion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_count,
    COUNT(*) FILTER (WHERE category_1 = '구비의무기관')::BIGINT AS mandatory_count,
    COUNT(*) FILTER (WHERE category_1 = '구비의무기관 외' OR category_1 IS NULL)::BIGINT AS non_mandatory_count,
    COUNT(*) FILTER (WHERE last_inspection_date >= CURRENT_DATE - INTERVAL '90 days')::BIGINT AS completed_count,
    COUNT(*) FILTER (WHERE last_inspection_date >= CURRENT_DATE - INTERVAL '90 days' AND category_1 = '구비의무기관')::BIGINT AS completed_mandatory_count,
    COUNT(*) FILTER (WHERE last_inspection_date >= CURRENT_DATE - INTERVAL '90 days' AND (category_1 = '구비의무기관 외' OR category_1 IS NULL))::BIGINT AS completed_non_mandatory_count,
    COUNT(*) FILTER (WHERE
      battery_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
      patch_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
      last_inspection_date < CURRENT_DATE - INTERVAL '90 days'
    )::BIGINT AS urgent_count,
    ROUND(
      CASE
        WHEN COUNT(*) > 0 THEN
          (COUNT(*) FILTER (WHERE last_inspection_date >= CURRENT_DATE - INTERVAL '90 days')::NUMERIC / COUNT(*)::NUMERIC * 100)
        ELSE 0
      END,
      1
    ) AS completion_rate
  FROM aed_data
  WHERE jurisdiction_health_center = p_health_center;
END;
$$;

-- 권한 부여: 인증된 사용자가 함수 실행 가능
GRANT EXECUTE ON FUNCTION get_dashboard_stats_by_region() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats_by_region() TO anon;
GRANT EXECUTE ON FUNCTION get_dashboard_stats_by_city(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats_by_city(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION get_dashboard_stats_by_health_center(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats_by_health_center(VARCHAR) TO anon;
