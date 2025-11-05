-- Add last_inspection_date support to get_aed_data_summary RPC function
-- 복합 필터 버그 수정: 배터리 만료 + 1년 미점검 조합 시 정확한 집계

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS get_aed_data_summary(
    TEXT, TEXT[], TEXT[], TEXT, TEXT[], TEXT, TEXT
);

-- 새 함수 생성 (last_inspection_filter 파라미터 추가)
CREATE OR REPLACE FUNCTION get_aed_data_summary(
    p_user_role TEXT DEFAULT NULL,
    p_region_codes TEXT[] DEFAULT NULL,
    p_city_codes TEXT[] DEFAULT NULL,
    p_expiry_filter TEXT DEFAULT NULL,
    p_status_filters TEXT[] DEFAULT NULL,
    p_category_filter TEXT DEFAULT NULL,
    p_query_criteria TEXT DEFAULT 'address',
    p_last_inspection_filter TEXT DEFAULT NULL  -- ✅ NEW: 점검일 필터 추가
)
RETURNS TABLE(
    total_count BIGINT,
    expired_count BIGINT,
    expiring_soon_count BIGINT,
    hidden_count BIGINT,
    with_sensitive_data_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    IF p_query_criteria = 'jurisdiction' THEN
        -- 관할보건소 기준 통계
        RETURN QUERY
        SELECT
            COUNT(*) AS total_count,
            COUNT(*) FILTER (
                WHERE battery_expiry_date < CURRENT_DATE
                OR patch_expiry_date < CURRENT_DATE
            ) AS expired_count,
            COUNT(*) FILTER (
                WHERE (battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
                OR (patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
            ) AS expiring_soon_count,
            COUNT(*) FILTER (WHERE is_public_visible = FALSE) AS hidden_count,
            COUNT(*) FILTER (WHERE institution_contact IS NOT NULL) AS with_sensitive_data_count
        FROM aed_data a
        WHERE
            -- 관할 보건소 기준 필터 적용
            (p_region_codes IS NULL OR EXISTS (
                SELECT 1 FROM organizations o
                WHERE o.name = a.jurisdiction_health_center
                AND o.type = 'health_center'
                AND o.region_code = ANY(p_region_codes)
            ))
            AND (p_city_codes IS NULL OR EXISTS (
                SELECT 1 FROM organizations o
                WHERE o.name = a.jurisdiction_health_center
                AND o.type = 'health_center'
                AND o.city_code = ANY(p_city_codes)
            ))
            AND (p_expiry_filter IS NULL OR
                CASE p_expiry_filter
                    WHEN 'expired' THEN
                        battery_expiry_date < CURRENT_DATE OR patch_expiry_date < CURRENT_DATE
                    WHEN '30days' THEN
                        (battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
                        OR (patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
                    WHEN '60days' THEN
                        (battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days')
                        OR (patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days')
                    WHEN '90days' THEN
                        (battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days')
                        OR (patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days')
                    ELSE TRUE
                END
            )
            AND (p_status_filters IS NULL OR operation_status = ANY(p_status_filters))
            AND (p_category_filter IS NULL OR category_1 = p_category_filter OR category_2 = p_category_filter)
            -- ✅ NEW: 점검일 필터 추가
            AND (p_last_inspection_filter IS NULL OR
                CASE p_last_inspection_filter
                    WHEN 'over1year' THEN
                        last_inspection_date < CURRENT_DATE - INTERVAL '1 year'
                        OR last_inspection_date IS NULL
                    WHEN 'over6months' THEN
                        last_inspection_date < CURRENT_DATE - INTERVAL '6 months'
                        OR last_inspection_date IS NULL
                    WHEN 'over3months' THEN
                        last_inspection_date < CURRENT_DATE - INTERVAL '3 months'
                        OR last_inspection_date IS NULL
                    WHEN 'recent' THEN
                        last_inspection_date >= CURRENT_DATE - INTERVAL '3 months'
                    ELSE TRUE
                END
            )
            AND (is_public_visible = TRUE OR p_user_role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin'));
    ELSE
        -- 주소 기준 통계 (기본)
        RETURN QUERY
        SELECT
            COUNT(*) AS total_count,
            COUNT(*) FILTER (
                WHERE battery_expiry_date < CURRENT_DATE
                OR patch_expiry_date < CURRENT_DATE
            ) AS expired_count,
            COUNT(*) FILTER (
                WHERE (battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
                OR (patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
            ) AS expiring_soon_count,
            COUNT(*) FILTER (WHERE is_public_visible = FALSE) AS hidden_count,
            COUNT(*) FILTER (WHERE institution_contact IS NOT NULL) AS with_sensitive_data_count
        FROM aed_data
        WHERE
            (p_region_codes IS NULL OR region_code = ANY(p_region_codes))
            AND (p_city_codes IS NULL OR city_code = ANY(p_city_codes))
            AND (p_expiry_filter IS NULL OR
                CASE p_expiry_filter
                    WHEN 'expired' THEN
                        battery_expiry_date < CURRENT_DATE OR patch_expiry_date < CURRENT_DATE
                    WHEN '30days' THEN
                        (battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
                        OR (patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
                    WHEN '60days' THEN
                        (battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days')
                        OR (patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days')
                    WHEN '90days' THEN
                        (battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days')
                        OR (patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days')
                    ELSE TRUE
                END
            )
            AND (p_status_filters IS NULL OR operation_status = ANY(p_status_filters))
            AND (p_category_filter IS NULL OR category_1 = p_category_filter OR category_2 = p_category_filter)
            -- ✅ NEW: 점검일 필터 추가
            AND (p_last_inspection_filter IS NULL OR
                CASE p_last_inspection_filter
                    WHEN 'over1year' THEN
                        last_inspection_date < CURRENT_DATE - INTERVAL '1 year'
                        OR last_inspection_date IS NULL
                    WHEN 'over6months' THEN
                        last_inspection_date < CURRENT_DATE - INTERVAL '6 months'
                        OR last_inspection_date IS NULL
                    WHEN 'over3months' THEN
                        last_inspection_date < CURRENT_DATE - INTERVAL '3 months'
                        OR last_inspection_date IS NULL
                    WHEN 'recent' THEN
                        last_inspection_date >= CURRENT_DATE - INTERVAL '3 months'
                    ELSE TRUE
                END
            )
            AND (is_public_visible = TRUE OR p_user_role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin'));
    END IF;
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION get_aed_data_summary TO authenticated;

-- 변경 사항 검증 쿼리
COMMENT ON FUNCTION get_aed_data_summary IS 'AED 데이터 요약 통계 조회 (last_inspection_filter 지원)';
