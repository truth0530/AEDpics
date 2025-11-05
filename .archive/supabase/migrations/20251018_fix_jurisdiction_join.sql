-- Fix jurisdiction JOIN in get_aed_data_summary RPC function
-- 문제: 공백 불일치로 JOIN 실패
--   - aed_data.jurisdiction_health_center: "대구광역시달서구보건소" (공백 없음)
--   - organizations.name: "대구광역시 달서구 보건소" (공백 있음)
-- 해결: REPLACE() 함수로 공백 제거 후 JOIN

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS get_aed_data_summary(
    TEXT, TEXT[], TEXT[], TEXT, TEXT[], TEXT, TEXT, TEXT
);

-- 새 함수 생성 (공백 정규화 적용)
CREATE OR REPLACE FUNCTION get_aed_data_summary(
    p_user_role TEXT DEFAULT NULL,
    p_region_codes TEXT[] DEFAULT NULL,
    p_city_codes TEXT[] DEFAULT NULL,
    p_expiry_filter TEXT DEFAULT NULL,
    p_status_filters TEXT[] DEFAULT NULL,
    p_category_filter TEXT DEFAULT NULL,
    p_query_criteria TEXT DEFAULT 'address',
    p_last_inspection_filter TEXT DEFAULT NULL
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
            -- ✅ FIX: 공백 정규화 적용 (Line 52-54 수정)
            (p_region_codes IS NULL OR EXISTS (
                SELECT 1 FROM organizations o
                WHERE REPLACE(o.name, ' ', '') = REPLACE(a.jurisdiction_health_center, ' ', '')
                AND o.type = 'health_center'
                AND o.region_code = ANY(p_region_codes)
            ))
            AND (p_city_codes IS NULL OR EXISTS (
                SELECT 1 FROM organizations o
                WHERE REPLACE(o.name, ' ', '') = REPLACE(a.jurisdiction_health_center, ' ', '')
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
        -- 주소 기준 통계 (기본) - 변경 없음
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
COMMENT ON FUNCTION get_aed_data_summary IS 'AED 데이터 요약 통계 조회 (jurisdiction 공백 정규화 적용)';

-- 테스트 쿼리 (대구 관할보건소 기준)
-- SELECT * FROM get_aed_data_summary(
--     p_query_criteria := 'jurisdiction',
--     p_region_codes := ARRAY['DAE']
-- );
