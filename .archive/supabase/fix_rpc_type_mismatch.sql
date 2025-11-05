-- RPC 함수 타입 불일치 수정
-- aed_data 테이블의 VARCHAR(255) 컬럼들을 TEXT로 캐스팅하여 반환

-- 1. get_aed_data_filtered 함수 재정의
DROP FUNCTION IF EXISTS get_aed_data_filtered(
    p_user_role TEXT,
    p_region_codes TEXT[],
    p_city_codes TEXT[],
    p_expiry_filter TEXT,
    p_status_filters TEXT[],
    p_category_filter TEXT,
    p_limit INTEGER,
    p_offset INTEGER
);

CREATE OR REPLACE FUNCTION get_aed_data_filtered(
    p_user_role TEXT DEFAULT NULL,
    p_region_codes TEXT[] DEFAULT NULL,
    p_city_codes TEXT[] DEFAULT NULL,
    p_expiry_filter TEXT DEFAULT NULL,
    p_status_filters TEXT[] DEFAULT NULL,
    p_category_filter TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    aed_id BIGINT,
    equipment_serial TEXT,
    management_number TEXT,
    region_code TEXT,
    city_code TEXT,
    sido TEXT,
    gugun TEXT,
    category_1 TEXT,
    category_2 TEXT,
    installation_institution TEXT,
    installation_address TEXT,
    installation_position TEXT,
    battery_expiry_date DATE,
    patch_expiry_date DATE,
    days_until_battery_expiry INTEGER,
    days_until_patch_expiry INTEGER,
    operation_status TEXT,
    operation_status_raw TEXT,
    jurisdiction_health_center TEXT,
    institution_contact TEXT,
    is_public_visible BOOLEAN,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id AS aed_id,
        a.equipment_serial::TEXT,
        a.management_number::TEXT,
        a.region_code::TEXT,
        a.city_code::TEXT,
        a.sido::TEXT,
        a.gugun::TEXT,
        a.category_1::TEXT,
        a.category_2::TEXT,
        a.installation_institution::TEXT,
        a.installation_address::TEXT,
        a.installation_position::TEXT,
        a.battery_expiry_date,
        a.patch_expiry_date,
        CASE
            WHEN a.battery_expiry_date IS NOT NULL THEN
                (a.battery_expiry_date - CURRENT_DATE)::INTEGER
            ELSE NULL
        END AS days_until_battery_expiry,
        CASE
            WHEN a.patch_expiry_date IS NOT NULL THEN
                (a.patch_expiry_date - CURRENT_DATE)::INTEGER
            ELSE NULL
        END AS days_until_patch_expiry,
        a.operation_status::TEXT,
        a.operation_status_raw::TEXT,
        a.jurisdiction_health_center::TEXT,
        a.institution_contact::TEXT,
        a.is_public_visible,
        a.updated_at
    FROM aed_data a
    WHERE
        -- 지역 필터
        (p_region_codes IS NULL OR a.region_code = ANY(p_region_codes))
        AND (p_city_codes IS NULL OR a.city_code = ANY(p_city_codes))
        -- 만료일 필터
        AND (
            p_expiry_filter IS NULL OR
            CASE p_expiry_filter
                WHEN 'expired' THEN
                    a.battery_expiry_date < CURRENT_DATE OR a.patch_expiry_date < CURRENT_DATE
                WHEN '30days' THEN
                    (a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
                    OR (a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
                WHEN '60days' THEN
                    (a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days')
                    OR (a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days')
                WHEN '90days' THEN
                    (a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days')
                    OR (a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days')
                ELSE TRUE
            END
        )
        -- 운영 상태 필터
        AND (p_status_filters IS NULL OR a.operation_status = ANY(p_status_filters))
        -- 카테고리 필터
        AND (p_category_filter IS NULL OR a.category_1 = p_category_filter OR a.category_2 = p_category_filter)
        -- 공개 여부
        AND (a.is_public_visible = TRUE OR p_user_role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin'))
    ORDER BY a.updated_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 2. get_aed_data_by_jurisdiction 함수 재정의
DROP FUNCTION IF EXISTS get_aed_data_by_jurisdiction(
    p_user_role TEXT,
    p_region_codes TEXT[],
    p_city_codes TEXT[],
    p_health_center_id UUID,
    p_expiry_filter TEXT,
    p_status_filters TEXT[],
    p_category_filter TEXT,
    p_limit INTEGER,
    p_offset INTEGER
);

CREATE OR REPLACE FUNCTION get_aed_data_by_jurisdiction(
    p_user_role TEXT DEFAULT NULL,
    p_region_codes TEXT[] DEFAULT NULL,
    p_city_codes TEXT[] DEFAULT NULL,
    p_health_center_id UUID DEFAULT NULL,
    p_expiry_filter TEXT DEFAULT NULL,
    p_status_filters TEXT[] DEFAULT NULL,
    p_category_filter TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    aed_id BIGINT,
    equipment_serial TEXT,
    management_number TEXT,
    region_code TEXT,
    city_code TEXT,
    sido TEXT,
    gugun TEXT,
    category_1 TEXT,
    category_2 TEXT,
    installation_institution TEXT,
    installation_address TEXT,
    installation_position TEXT,
    battery_expiry_date DATE,
    patch_expiry_date DATE,
    days_until_battery_expiry INTEGER,
    days_until_patch_expiry INTEGER,
    operation_status TEXT,
    operation_status_raw TEXT,
    jurisdiction_health_center TEXT,
    institution_contact TEXT,
    is_public_visible BOOLEAN,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_health_center_name TEXT;
BEGIN
    -- 보건소 이름 조회 (보건소 ID가 제공된 경우)
    IF p_health_center_id IS NOT NULL THEN
        SELECT name INTO v_health_center_name
        FROM organizations
        WHERE id = p_health_center_id
        AND type = 'health_center';
    END IF;

    RETURN QUERY
    SELECT
        a.id AS aed_id,
        a.equipment_serial::TEXT,
        a.management_number::TEXT,
        a.region_code::TEXT,
        a.city_code::TEXT,
        a.sido::TEXT,
        a.gugun::TEXT,
        a.category_1::TEXT,
        a.category_2::TEXT,
        a.installation_institution::TEXT,
        a.installation_address::TEXT,
        a.installation_position::TEXT,
        a.battery_expiry_date,
        a.patch_expiry_date,
        CASE
            WHEN a.battery_expiry_date IS NOT NULL THEN
                (a.battery_expiry_date - CURRENT_DATE)::INTEGER
            ELSE NULL
        END AS days_until_battery_expiry,
        CASE
            WHEN a.patch_expiry_date IS NOT NULL THEN
                (a.patch_expiry_date - CURRENT_DATE)::INTEGER
            ELSE NULL
        END AS days_until_patch_expiry,
        a.operation_status::TEXT,
        a.operation_status_raw::TEXT,
        a.jurisdiction_health_center::TEXT,
        a.institution_contact::TEXT,
        a.is_public_visible,
        a.updated_at
    FROM aed_data a
    WHERE
        -- 관할 보건소 필터 (보건소 계정인 경우)
        (v_health_center_name IS NULL OR a.jurisdiction_health_center = v_health_center_name)
        -- 지역 필터 (상위 권한자가 특정 지역의 보건소들이 관리하는 AED를 조회)
        AND (
            v_health_center_name IS NOT NULL -- 보건소 계정은 자신의 관할만
            OR (
                -- 상위 권한자는 지역 필터를 통해 조회
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
            )
        )
        -- 만료일 필터
        AND (
            p_expiry_filter IS NULL OR
            CASE p_expiry_filter
                WHEN 'expired' THEN
                    a.battery_expiry_date < CURRENT_DATE OR a.patch_expiry_date < CURRENT_DATE
                WHEN '30days' THEN
                    (a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
                    OR (a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
                WHEN '60days' THEN
                    (a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days')
                    OR (a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days')
                WHEN '90days' THEN
                    (a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days')
                    OR (a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days')
                ELSE TRUE
            END
        )
        -- 운영 상태 필터
        AND (p_status_filters IS NULL OR a.operation_status = ANY(p_status_filters))
        -- 카테고리 필터
        AND (p_category_filter IS NULL OR a.category_1 = p_category_filter OR a.category_2 = p_category_filter)
        -- 공개 여부
        AND (a.is_public_visible = TRUE OR p_user_role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin'))
    ORDER BY a.updated_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 3. get_aed_data_summary 함수 재정의
DROP FUNCTION IF EXISTS get_aed_data_summary(
    p_user_role TEXT,
    p_region_codes TEXT[],
    p_city_codes TEXT[],
    p_expiry_filter TEXT,
    p_status_filters TEXT[],
    p_category_filter TEXT,
    p_query_criteria TEXT
);

CREATE OR REPLACE FUNCTION get_aed_data_summary(
    p_user_role TEXT DEFAULT NULL,
    p_region_codes TEXT[] DEFAULT NULL,
    p_city_codes TEXT[] DEFAULT NULL,
    p_expiry_filter TEXT DEFAULT NULL,
    p_status_filters TEXT[] DEFAULT NULL,
    p_category_filter TEXT DEFAULT NULL,
    p_query_criteria TEXT DEFAULT 'address'
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
            AND (is_public_visible = TRUE OR p_user_role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin'));
    END IF;
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION get_aed_data_filtered TO authenticated;
GRANT EXECUTE ON FUNCTION get_aed_data_by_jurisdiction TO authenticated;
GRANT EXECUTE ON FUNCTION get_aed_data_summary TO authenticated;