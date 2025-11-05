-- ============================================
-- 미적용 마이그레이션 일괄 실행 스크립트
-- 실행일: 2025-10-03
-- 파일: 27, 28, 23(개선)
-- ============================================
--
-- 실행 방법:
-- Supabase Studio의 SQL Editor에서 이 파일 전체를 복사하여 실행
--
-- 주의사항:
-- 1. 프로덕션 환경에서는 반드시 백업 후 실행
-- 2. 실행 전 현재 schema_migrations 테이블 확인
-- 3. 오류 발생 시 롤백 가능하도록 트랜잭션 사용
-- ============================================

BEGIN;

-- ============================================
-- PART 1: 영속성 매핑 테이블 (27번 마이그레이션)
-- ============================================

-- 1. 영속성 매핑 테이블 생성
CREATE TABLE IF NOT EXISTS public.aed_persistent_mapping (
  equipment_serial VARCHAR(255) PRIMARY KEY,
  external_system_id VARCHAR(255) UNIQUE,
  external_system_name VARCHAR(100),
  matched_by UUID REFERENCES user_profiles(id),
  matched_at TIMESTAMPTZ,
  matching_method VARCHAR(50) DEFAULT 'manual' CHECK (
    matching_method IN ('manual', 'auto', 'verified', 'pending')
  ),
  matching_confidence NUMERIC(5,2) CHECK (matching_confidence BETWEEN 0 AND 100),
  matching_notes TEXT,
  verified_by UUID REFERENCES user_profiles(id),
  verified_at TIMESTAMPTZ,
  previous_external_id VARCHAR(255),
  change_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_persistent_mapping_external_id
  ON aed_persistent_mapping(external_system_id);

CREATE INDEX IF NOT EXISTS idx_persistent_mapping_method
  ON aed_persistent_mapping(matching_method, matched_at DESC);

-- 2. aed_data 테이블 컬럼 추가
ALTER TABLE aed_data
  ADD COLUMN IF NOT EXISTS external_system_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS external_sync_status VARCHAR(50) DEFAULT 'pending' CHECK (
    external_sync_status IN ('pending', 'matched', 'verified', 'conflict', 'unmatched')
  ),
  ADD COLUMN IF NOT EXISTS last_external_sync TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_aed_data_external_id
  ON aed_data(external_system_id);

-- 3. aed_inspections 테이블 컬럼 추가
ALTER TABLE aed_inspections
  ADD COLUMN IF NOT EXISTS field_changes JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS original_data JSONB,
  ADD COLUMN IF NOT EXISTS total_changes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS external_system_id_at_inspection VARCHAR(255);

-- 4. 통합 뷰 생성
CREATE OR REPLACE VIEW aed_integrated_view AS
SELECT
  a.*,
  pm.external_system_id as persistent_external_id,
  pm.external_system_name,
  pm.matching_method,
  pm.matching_confidence,
  pm.matched_by,
  pm.matched_at,
  pm.verified_by,
  pm.verified_at,
  CASE
    WHEN pm.external_system_id IS NULL THEN 'unmatched'
    WHEN pm.verified_at IS NOT NULL THEN 'verified'
    WHEN pm.matched_at IS NOT NULL THEN 'matched'
    ELSE 'pending'
  END as overall_matching_status
FROM aed_data a
LEFT JOIN aed_persistent_mapping pm
  ON a.equipment_serial = pm.equipment_serial;

-- RLS 정책
ALTER TABLE aed_persistent_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mapping_authenticated_read" ON aed_persistent_mapping
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- PART 2: inspection_sessions 필드 추가 (28번 마이그레이션)
-- ============================================

ALTER TABLE public.inspection_sessions
ADD COLUMN IF NOT EXISTS field_changes JSONB DEFAULT '{}';

COMMENT ON COLUMN inspection_sessions.field_changes IS '점검 중 변경된 필드 정보 (원본값, 수정값, 사유 포함)';

-- ============================================
-- PART 3: AED 쿼리 함수 최종본 (23번 개선)
-- ============================================

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS get_aed_data_filtered CASCADE;
DROP FUNCTION IF EXISTS get_aed_data_by_jurisdiction CASCADE;

-- 1. get_aed_data_filtered 함수
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
  installation_date DATE,
  category_1 TEXT,
  category_2 TEXT,
  category_3 TEXT,
  sido TEXT,
  gugun TEXT,
  operation_status TEXT,
  external_display TEXT,
  external_non_display_reason TEXT,
  battery_expiry_date DATE,
  patch_expiry_date DATE,
  replacement_date DATE,
  model_name TEXT,
  manufacturer TEXT,
  display_allowed TEXT,
  installation_method TEXT,
  registration_date DATE,
  manufacturing_date DATE,
  manufacturing_country TEXT,
  serial_number TEXT,
  establisher TEXT,
  government_support TEXT,
  patch_available TEXT,
  remarks TEXT,
  first_installation_date DATE,
  last_use_date DATE,
  manager TEXT,
  purchase_institution TEXT
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
        ('KR', '중앙'), ('SEO', '서울특별시'), ('BUS', '부산광역시'),
        ('DAE', '대구광역시'), ('INC', '인천광역시'), ('GWA', '광주광역시'),
        ('DAJ', '대전광역시'), ('ULS', '울산광역시'), ('SEJ', '세종특별자치시'),
        ('GYE', '경기도'), ('GAN', '강원특별자치도'), ('CHU', '충청북도'),
        ('CHN', '충청남도'), ('JEO', '전북특별자치도'), ('JEN', '전라남도'),
        ('GYB', '경상북도'), ('GYN', '경상남도'), ('JEJ', '제주특별자치도')
      ) AS rm(code, label)
      WHERE rm.label = ad.sido LIMIT 1),
      ad.sido
    ) AS region_code,
    COALESCE(hc.city_code, ad.gugun) AS city_code,
    ad.jurisdiction_health_center,
    hc.id AS health_center_id,
    ad.latitude,
    ad.longitude,
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
    ad.installation_date,
    ad.category_1,
    ad.category_2,
    ad.category_3,
    ad.sido,
    ad.gugun,
    ad.operation_status,
    ad.external_display,
    ad.external_non_display_reason,
    ad.battery_expiry_date,
    ad.patch_expiry_date,
    ad.replacement_date,
    ad.model_name,
    ad.manufacturer,
    ad.display_allowed,
    ad.installation_method,
    ad.registration_date,
    ad.manufacturing_date,
    ad.manufacturing_country,
    ad.serial_number,
    ad.establisher,
    ad.government_support,
    ad.patch_available,
    ad.remarks,
    ad.first_installation_date,
    ad.last_use_date,
    ad.manager,
    ad.purchase_institution
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

-- 2. get_aed_data_by_jurisdiction 함수 (동일한 RETURNS TABLE 사용)
CREATE FUNCTION get_aed_data_by_jurisdiction(
  p_user_role TEXT,
  p_region_codes TEXT[] DEFAULT NULL,
  p_city_codes TEXT[] DEFAULT NULL,
  p_health_center_id UUID DEFAULT NULL,
  p_expiry_filter TEXT DEFAULT NULL,
  p_status_filters TEXT[] DEFAULT NULL,
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
  installation_date DATE,
  category_1 TEXT,
  category_2 TEXT,
  category_3 TEXT,
  sido TEXT,
  gugun TEXT,
  operation_status TEXT,
  external_display TEXT,
  external_non_display_reason TEXT,
  battery_expiry_date DATE,
  patch_expiry_date DATE,
  replacement_date DATE,
  model_name TEXT,
  manufacturer TEXT,
  display_allowed TEXT,
  installation_method TEXT,
  registration_date DATE,
  manufacturing_date DATE,
  manufacturing_country TEXT,
  serial_number TEXT,
  establisher TEXT,
  government_support TEXT,
  patch_available TEXT,
  remarks TEXT,
  first_installation_date DATE,
  last_use_date DATE,
  manager TEXT,
  purchase_institution TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.id::TEXT,
    ad.equipment_serial AS device_serial,
    ad.management_number,
    ad.installation_institution AS installation_org,
    ad.installation_address AS address,
    ad.installation_position AS detailed_address,
    COALESCE(hc.region_code, ad.sido) AS region_code,
    COALESCE(hc.city_code, ad.gugun) AS city_code,
    ad.jurisdiction_health_center,
    hc.id AS health_center_id,
    ad.latitude,
    ad.longitude,
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
    ad.installation_date,
    ad.category_1,
    ad.category_2,
    ad.category_3,
    ad.sido,
    ad.gugun,
    ad.operation_status,
    ad.external_display,
    ad.external_non_display_reason,
    ad.battery_expiry_date,
    ad.patch_expiry_date,
    ad.replacement_date,
    ad.model_name,
    ad.manufacturer,
    ad.display_allowed,
    ad.installation_method,
    ad.registration_date,
    ad.manufacturing_date,
    ad.manufacturing_country,
    ad.serial_number,
    ad.establisher,
    ad.government_support,
    ad.patch_available,
    ad.remarks,
    ad.first_installation_date,
    ad.last_use_date,
    ad.manager,
    ad.purchase_institution
  FROM aed_data ad
  LEFT JOIN organizations hc ON hc.name = ad.jurisdiction_health_center
  WHERE
    hc.id IS NOT NULL
    AND (
      (p_health_center_id IS NOT NULL AND hc.id = p_health_center_id)
      OR (p_health_center_id IS NULL AND (p_region_codes IS NULL OR hc.region_code = ANY(p_region_codes)))
    )
  ORDER BY ad.updated_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================
-- 마이그레이션 완료 확인
-- ============================================

-- 성공 메시지
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '마이그레이션 27-28-23 일괄 적용 완료';
  RAISE NOTICE '========================================';
  RAISE NOTICE '적용 내용:';
  RAISE NOTICE '  - 영속성 매핑 테이블 (aed_persistent_mapping)';
  RAISE NOTICE '  - inspection_sessions.field_changes 추가';
  RAISE NOTICE '  - AED 쿼리 함수 최종본 (분류, 상세정보 포함)';
  RAISE NOTICE '========================================';
END $$;

-- 모든 작업이 성공하면 커밋
COMMIT;
