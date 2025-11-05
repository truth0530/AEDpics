-- ===========================================
-- AED 커서 기반 페이지네이션 최적화 RPC 함수
-- 2025-09-24
--
-- 목적: OFFSET 기반에서 커서 기반으로 변경하여 대용량 데이터 성능 최적화
-- 커서 기준: (updated_at, id) 복합 정렬 사용
-- ===========================================

-- 1. 커서 기반 주소 기준 조회 함수 (최적화 버전)
CREATE OR REPLACE FUNCTION get_aed_data_filtered_cursor(
  p_user_role TEXT,
  p_region_codes TEXT[] DEFAULT NULL,
  p_city_codes TEXT[] DEFAULT NULL,
  p_expiry_filter TEXT DEFAULT NULL,
  p_status_filters TEXT[] DEFAULT NULL,
  p_category_1 TEXT[] DEFAULT NULL,
  p_category_2 TEXT[] DEFAULT NULL,
  p_category_3 TEXT[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_cursor_updated_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id BIGINT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  -- 실제 존재하는 컬럼들
  id BIGINT,
  equipment_serial VARCHAR(255),
  management_number VARCHAR(255),
  sido VARCHAR(255),
  gugun VARCHAR(255),
  category_1 VARCHAR(255),
  category_2 VARCHAR(255),
  category_3 VARCHAR(255),
  installation_institution VARCHAR(255),
  installation_address VARCHAR(255),
  installation_position VARCHAR(255),
  battery_expiry_date DATE,
  patch_expiry_date DATE,
  operation_status VARCHAR(255),
  jurisdiction_health_center VARCHAR(255),
  institution_contact VARCHAR(255),
  manager VARCHAR(255),
  model_name VARCHAR(255),
  manufacturer VARCHAR(255),
  display_allowed VARCHAR(255),
  updated_at TIMESTAMPTZ,
  -- API가 필요로 하는 계산 컬럼들
  region_code TEXT,
  city_code TEXT,
  days_until_battery_expiry INT,
  days_until_patch_expiry INT,
  is_public_visible BOOLEAN,
  operation_status_raw VARCHAR(255)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.equipment_serial,
    a.management_number,
    a.sido,
    a.gugun,
    a.category_1,
    a.category_2,
    a.category_3,
    a.installation_institution,
    a.installation_address,
    a.installation_position,
    a.battery_expiry_date,
    a.patch_expiry_date,
    a.operation_status,
    a.jurisdiction_health_center,
    a.institution_contact,
    a.manager,
    a.model_name,
    a.manufacturer,
    a.display_allowed,
    a.updated_at,
    -- 계산 컬럼들
    CASE
      WHEN a.sido = '서울특별시' THEN 'SEO'
      WHEN a.sido = '부산광역시' THEN 'BUS'
      WHEN a.sido = '대구광역시' THEN 'DAE'
      WHEN a.sido = '인천광역시' THEN 'INC'
      WHEN a.sido = '광주광역시' THEN 'GWA'
      WHEN a.sido = '대전광역시' THEN 'DAJ'
      WHEN a.sido = '울산광역시' THEN 'ULS'
      WHEN a.sido = '세종특별자치시' THEN 'SEJ'
      WHEN a.sido = '경기도' THEN 'GYE'
      WHEN a.sido = '강원특별자치도' THEN 'GAN'
      WHEN a.sido = '충청북도' THEN 'CHB'
      WHEN a.sido = '충청남도' THEN 'CHN'
      WHEN a.sido = '전라북도' THEN 'JEB'
      WHEN a.sido = '전북특별자치도' THEN 'JEB'
      WHEN a.sido = '전라남도' THEN 'JEN'
      WHEN a.sido = '경상북도' THEN 'GYB'
      WHEN a.sido = '경상남도' THEN 'GYN'
      WHEN a.sido = '제주특별자치도' THEN 'JEJ'
      ELSE 'UNK'
    END::TEXT AS region_code,
    a.gugun::TEXT AS city_code,
    CASE
      WHEN a.battery_expiry_date IS NULL THEN NULL
      ELSE (a.battery_expiry_date - CURRENT_DATE)::INT
    END AS days_until_battery_expiry,
    CASE
      WHEN a.patch_expiry_date IS NULL THEN NULL
      ELSE (a.patch_expiry_date - CURRENT_DATE)::INT
    END AS days_until_patch_expiry,
    CASE
      WHEN a.display_allowed IN ('표출허용', 'Y', 'YES', '1', 'TRUE') THEN true
      WHEN a.display_allowed IN ('미표출', '표출불가', 'N', 'NO', '0', 'FALSE') THEN false
      WHEN a.display_allowed IS NULL OR a.display_allowed = '' THEN true
      ELSE false
    END AS is_public_visible,
    a.operation_status AS operation_status_raw
  FROM aed_data a
  WHERE 1=1
    -- 커서 조건 (가장 중요한 최적화 부분)
    AND (
      p_cursor_updated_at IS NULL OR
      p_cursor_id IS NULL OR
      (a.updated_at, a.id) > (p_cursor_updated_at, p_cursor_id)
    )
    -- 시도 필터
    AND (p_region_codes IS NULL OR
         CASE
           WHEN a.sido = '서울특별시' THEN 'SEO'
           WHEN a.sido = '부산광역시' THEN 'BUS'
           WHEN a.sido = '대구광역시' THEN 'DAE'
           WHEN a.sido = '인천광역시' THEN 'INC'
           WHEN a.sido = '광주광역시' THEN 'GWA'
           WHEN a.sido = '대전광역시' THEN 'DAJ'
           WHEN a.sido = '울산광역시' THEN 'ULS'
           WHEN a.sido = '세종특별자치시' THEN 'SEJ'
           WHEN a.sido = '경기도' THEN 'GYE'
           WHEN a.sido = '강원특별자치도' THEN 'GAN'
           WHEN a.sido = '충청북도' THEN 'CHB'
           WHEN a.sido = '충청남도' THEN 'CHN'
           WHEN a.sido = '전라북도' THEN 'JEB'
           WHEN a.sido = '전북특별자치도' THEN 'JEB'
           WHEN a.sido = '전라남도' THEN 'JEN'
           WHEN a.sido = '경상북도' THEN 'GYB'
           WHEN a.sido = '경상남도' THEN 'GYN'
           WHEN a.sido = '제주특별자치도' THEN 'JEJ'
           ELSE 'UNK'
         END = ANY(p_region_codes))
    -- 시군구 필터
    AND (p_city_codes IS NULL OR a.gugun = ANY(p_city_codes))
    -- 만료일 필터
    AND (p_expiry_filter IS NULL OR
         CASE p_expiry_filter
           WHEN 'expired' THEN
             a.battery_expiry_date < CURRENT_DATE OR a.patch_expiry_date < CURRENT_DATE
           WHEN 'in30' THEN
             (a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30) OR
             (a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)
           WHEN 'in60' THEN
             (a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60) OR
             (a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60)
           WHEN 'in90' THEN
             (a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90) OR
             (a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90)
           ELSE true
         END)
    -- 운영 상태 필터
    AND (p_status_filters IS NULL OR a.operation_status = ANY(p_status_filters))
    -- 카테고리 필터들
    AND (p_category_1 IS NULL OR a.category_1 = ANY(p_category_1))
    AND (p_category_2 IS NULL OR a.category_2 = ANY(p_category_2))
    AND (p_category_3 IS NULL OR a.category_3 = ANY(p_category_3))
    -- 검색 필터
    AND (p_search IS NULL OR
         a.installation_institution ILIKE '%' || p_search || '%' OR
         a.installation_address ILIKE '%' || p_search || '%' OR
         a.management_number ILIKE '%' || p_search || '%' OR
         a.equipment_serial ILIKE '%' || p_search || '%')
  ORDER BY a.updated_at ASC, a.id ASC
  LIMIT p_limit + 1; -- hasMore 확인을 위해 +1
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 커서 기반 관할보건소 기준 조회 함수
CREATE OR REPLACE FUNCTION get_aed_data_by_jurisdiction_cursor(
  p_user_role TEXT,
  p_region_codes TEXT[] DEFAULT NULL,
  p_city_codes TEXT[] DEFAULT NULL,
  p_health_center_id UUID DEFAULT NULL,
  p_expiry_filter TEXT DEFAULT NULL,
  p_status_filters TEXT[] DEFAULT NULL,
  p_category_1 TEXT[] DEFAULT NULL,
  p_category_2 TEXT[] DEFAULT NULL,
  p_category_3 TEXT[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_cursor_updated_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id BIGINT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  -- get_aed_data_filtered_cursor와 동일한 구조
  id BIGINT,
  equipment_serial VARCHAR(255),
  management_number VARCHAR(255),
  sido VARCHAR(255),
  gugun VARCHAR(255),
  category_1 VARCHAR(255),
  category_2 VARCHAR(255),
  category_3 VARCHAR(255),
  installation_institution VARCHAR(255),
  installation_address VARCHAR(255),
  installation_position VARCHAR(255),
  battery_expiry_date DATE,
  patch_expiry_date DATE,
  operation_status VARCHAR(255),
  jurisdiction_health_center VARCHAR(255),
  institution_contact VARCHAR(255),
  manager VARCHAR(255),
  model_name VARCHAR(255),
  manufacturer VARCHAR(255),
  display_allowed VARCHAR(255),
  updated_at TIMESTAMPTZ,
  region_code TEXT,
  city_code TEXT,
  days_until_battery_expiry INT,
  days_until_patch_expiry INT,
  is_public_visible BOOLEAN,
  operation_status_raw VARCHAR(255)
) AS $$
DECLARE
  v_health_center_name TEXT;
BEGIN
  -- 보건소 이름 조회 (필요시)
  IF p_health_center_id IS NOT NULL THEN
    SELECT name INTO v_health_center_name
    FROM organizations
    WHERE id = p_health_center_id;
  END IF;

  -- 관할보건소 기준 필터가 추가된 버전
  RETURN QUERY
  SELECT
    a.id,
    a.equipment_serial,
    a.management_number,
    a.sido,
    a.gugun,
    a.category_1,
    a.category_2,
    a.category_3,
    a.installation_institution,
    a.installation_address,
    a.installation_position,
    a.battery_expiry_date,
    a.patch_expiry_date,
    a.operation_status,
    a.jurisdiction_health_center,
    a.institution_contact,
    a.manager,
    a.model_name,
    a.manufacturer,
    a.display_allowed,
    a.updated_at,
    -- 계산 컬럼들
    CASE
      WHEN a.sido = '서울특별시' THEN 'SEO'
      WHEN a.sido = '부산광역시' THEN 'BUS'
      WHEN a.sido = '대구광역시' THEN 'DAE'
      WHEN a.sido = '인천광역시' THEN 'INC'
      WHEN a.sido = '광주광역시' THEN 'GWA'
      WHEN a.sido = '대전광역시' THEN 'DAJ'
      WHEN a.sido = '울산광역시' THEN 'ULS'
      WHEN a.sido = '세종특별자치시' THEN 'SEJ'
      WHEN a.sido = '경기도' THEN 'GYE'
      WHEN a.sido = '강원특별자치도' THEN 'GAN'
      WHEN a.sido = '충청북도' THEN 'CHB'
      WHEN a.sido = '충청남도' THEN 'CHN'
      WHEN a.sido = '전라북도' THEN 'JEB'
      WHEN a.sido = '전북특별자치도' THEN 'JEB'
      WHEN a.sido = '전라남도' THEN 'JEN'
      WHEN a.sido = '경상북도' THEN 'GYB'
      WHEN a.sido = '경상남도' THEN 'GYN'
      WHEN a.sido = '제주특별자치도' THEN 'JEJ'
      ELSE 'UNK'
    END::TEXT AS region_code,
    a.gugun::TEXT AS city_code,
    CASE
      WHEN a.battery_expiry_date IS NULL THEN NULL
      ELSE (a.battery_expiry_date - CURRENT_DATE)::INT
    END AS days_until_battery_expiry,
    CASE
      WHEN a.patch_expiry_date IS NULL THEN NULL
      ELSE (a.patch_expiry_date - CURRENT_DATE)::INT
    END AS days_until_patch_expiry,
    CASE
      WHEN a.display_allowed IN ('표출허용', 'Y', 'YES', '1', 'TRUE') THEN true
      WHEN a.display_allowed IN ('미표출', '표출불가', 'N', 'NO', '0', 'FALSE') THEN false
      WHEN a.display_allowed IS NULL OR a.display_allowed = '' THEN true
      ELSE false
    END AS is_public_visible,
    a.operation_status AS operation_status_raw
  FROM aed_data a
  WHERE 1=1
    -- 커서 조건
    AND (
      p_cursor_updated_at IS NULL OR
      p_cursor_id IS NULL OR
      (a.updated_at, a.id) > (p_cursor_updated_at, p_cursor_id)
    )
    -- 관할보건소 필터 (추가)
    AND (v_health_center_name IS NULL OR a.jurisdiction_health_center = v_health_center_name)
    -- 나머지 필터들 (기존과 동일)
    AND (p_region_codes IS NULL OR
         CASE
           WHEN a.sido = '서울특별시' THEN 'SEO'
           WHEN a.sido = '부산광역시' THEN 'BUS'
           WHEN a.sido = '대구광역시' THEN 'DAE'
           WHEN a.sido = '인천광역시' THEN 'INC'
           WHEN a.sido = '광주광역시' THEN 'GWA'
           WHEN a.sido = '대전광역시' THEN 'DAJ'
           WHEN a.sido = '울산광역시' THEN 'ULS'
           WHEN a.sido = '세종특별자치시' THEN 'SEJ'
           WHEN a.sido = '경기도' THEN 'GYE'
           WHEN a.sido = '강원특별자치도' THEN 'GAN'
           WHEN a.sido = '충청북도' THEN 'CHB'
           WHEN a.sido = '충청남도' THEN 'CHN'
           WHEN a.sido = '전라북도' THEN 'JEB'
           WHEN a.sido = '전북특별자치도' THEN 'JEB'
           WHEN a.sido = '전라남도' THEN 'JEN'
           WHEN a.sido = '경상북도' THEN 'GYB'
           WHEN a.sido = '경상남도' THEN 'GYN'
           WHEN a.sido = '제주특별자치도' THEN 'JEJ'
           ELSE 'UNK'
         END = ANY(p_region_codes))
    AND (p_city_codes IS NULL OR a.gugun = ANY(p_city_codes))
    AND (p_expiry_filter IS NULL OR
         CASE p_expiry_filter
           WHEN 'expired' THEN
             a.battery_expiry_date < CURRENT_DATE OR a.patch_expiry_date < CURRENT_DATE
           WHEN 'in30' THEN
             (a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30) OR
             (a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)
           WHEN 'in60' THEN
             (a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60) OR
             (a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60)
           WHEN 'in90' THEN
             (a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90) OR
             (a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90)
           ELSE true
         END)
    AND (p_status_filters IS NULL OR a.operation_status = ANY(p_status_filters))
    AND (p_category_1 IS NULL OR a.category_1 = ANY(p_category_1))
    AND (p_category_2 IS NULL OR a.category_2 = ANY(p_category_2))
    AND (p_category_3 IS NULL OR a.category_3 = ANY(p_category_3))
    AND (p_search IS NULL OR
         a.installation_institution ILIKE '%' || p_search || '%' OR
         a.installation_address ILIKE '%' || p_search || '%' OR
         a.management_number ILIKE '%' || p_search || '%' OR
         a.equipment_serial ILIKE '%' || p_search || '%')
  ORDER BY a.updated_at ASC, a.id ASC
  LIMIT p_limit + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 성능 최적화를 위한 복합 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_aed_data_cursor_pagination
  ON aed_data (updated_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_aed_data_region_search
  ON aed_data (sido, gugun);

CREATE INDEX IF NOT EXISTS idx_aed_data_category_search
  ON aed_data (category_1, category_2, category_3);

CREATE INDEX IF NOT EXISTS idx_aed_data_expiry_dates
  ON aed_data (battery_expiry_date, patch_expiry_date);

-- 4. 권한 설정
GRANT EXECUTE ON FUNCTION get_aed_data_filtered_cursor TO authenticated;
GRANT EXECUTE ON FUNCTION get_aed_data_by_jurisdiction_cursor TO authenticated;

-- 5. 테스트용 호출 예시 (주석 처리)
-- SELECT COUNT(*) FROM get_aed_data_filtered_cursor('master', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10);