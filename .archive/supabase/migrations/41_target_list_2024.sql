-- ============================================
-- Migration 41: 구비의무기관 리스트 2024
-- 실행일: 2025-10-04
-- 목적: 2024년 AED 구비의무기관 관리 및 매칭 시스템
-- 전략: 2025년은 교체가 아닌 추가 (target_list_2025)
-- ============================================

-- ============================================
-- 1. target_list_2024 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS public.target_list_2024 (
  -- 고유키 (예: TL2024-001, TL2024-002, ...)
  id VARCHAR(50) PRIMARY KEY,

  -- 기본 정보
  sido VARCHAR(50) NOT NULL,
  gugun VARCHAR(100) NOT NULL,
  institution_name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,

  -- 분류
  institution_type VARCHAR(100),  -- 예: 공공기관, 다중이용시설, 체육시설
  category_1 VARCHAR(100),        -- 대분류
  category_2 VARCHAR(100),        -- 중분류
  category_3 VARCHAR(100),        -- 소분류

  -- 연락 정보
  contact_phone VARCHAR(50),
  manager_name VARCHAR(100),

  -- 메타데이터
  data_year INTEGER DEFAULT 2024,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  imported_by UUID REFERENCES user_profiles(id),
  last_verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES user_profiles(id),

  -- 비고
  notes TEXT,

  -- 시스템 필드
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_target_list_2024_location
  ON target_list_2024(sido, gugun);

CREATE INDEX idx_target_list_2024_type
  ON target_list_2024(institution_type);

CREATE INDEX idx_target_list_2024_name
  ON target_list_2024(institution_name);

-- 트리거
CREATE TRIGGER update_target_list_2024_updated_at
  BEFORE UPDATE ON public.target_list_2024
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 코멘트
COMMENT ON TABLE target_list_2024 IS '2024년 AED 구비의무기관 리스트';
COMMENT ON COLUMN target_list_2024.id IS '고유키 (예: TL2024-001)';
COMMENT ON COLUMN target_list_2024.data_year IS '데이터 연도 (2024)';

-- ============================================
-- 2. target_list_devices 매칭 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS public.target_list_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 연도 구분 (2024 또는 2025)
  target_list_year INTEGER NOT NULL CHECK (target_list_year IN (2024, 2025)),

  -- 구비의무기관 ID (연도별로 다른 테이블 참조)
  -- ⚠️ Foreign Key 없음: target_list_2024/2025 동적 참조
  target_institution_id VARCHAR(50) NOT NULL,

  -- AED 장비 연결
  -- ⚠️ Foreign Key 없음: aed_data는 매일 교체되므로
  equipment_serial VARCHAR(255) NOT NULL,

  -- 매칭 정보
  matching_method VARCHAR(50) DEFAULT 'manual' CHECK (
    matching_method IN ('manual', 'auto', 'verified', 'suggested')
  ),
  matching_confidence NUMERIC(5,2) CHECK (matching_confidence BETWEEN 0 AND 100),

  -- 매칭 근거 (디버깅/검증용)
  matching_reason JSONB,  -- {nameScore: 85, addressScore: 70, sido_match: true}

  -- 매칭 메타데이터
  matched_by UUID REFERENCES user_profiles(id),
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  verified_by UUID REFERENCES user_profiles(id),
  verified_at TIMESTAMPTZ,

  -- 복합 유니크 제약 (1개 AED는 1개 연도의 1개 기관에만 매칭)
  UNIQUE (target_list_year, equipment_serial),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_target_devices_year_institution
  ON target_list_devices(target_list_year, target_institution_id);

CREATE INDEX idx_target_devices_equipment
  ON target_list_devices(equipment_serial);

CREATE INDEX idx_target_devices_year
  ON target_list_devices(target_list_year);

CREATE INDEX idx_target_devices_method
  ON target_list_devices(matching_method);

-- 트리거
CREATE TRIGGER update_target_list_devices_updated_at
  BEFORE UPDATE ON public.target_list_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 코멘트
COMMENT ON TABLE target_list_devices IS 'AED와 구비의무기관 매칭 테이블 (연도별)';
COMMENT ON COLUMN target_list_devices.target_list_year IS '2024 또는 2025';
COMMENT ON COLUMN target_list_devices.target_institution_id IS '구비의무기관 ID (TL2024-xxx 또는 TL2025-xxx)';
COMMENT ON COLUMN target_list_devices.equipment_serial IS 'AED 장비 일련번호';
COMMENT ON COLUMN target_list_devices.matching_method IS '매칭 방법: manual(수동), auto(자동), verified(검증완료), suggested(추천)';
COMMENT ON COLUMN target_list_devices.matching_confidence IS '매칭 신뢰도 (0-100)';

-- ============================================
-- 3. 통합 뷰: 2024년 기준 AED 매칭
-- ============================================
CREATE OR REPLACE VIEW aed_with_target_2024 AS
SELECT
  a.*,

  -- 2024 구비의무기관 정보
  tl.id as target_institution_id,
  tl.institution_name as target_institution_name,
  tl.institution_type as target_institution_type,
  tl.category_1 as target_category_1,
  tl.category_2 as target_category_2,
  tl.category_3 as target_category_3,

  -- 매칭 정보
  td.matching_method,
  td.matching_confidence,
  td.matching_reason,
  td.matched_at,
  td.verified_at,

  -- 매칭 상태
  CASE
    WHEN td.verified_at IS NOT NULL THEN 'verified'
    WHEN td.matched_at IS NOT NULL THEN 'matched'
    ELSE 'unmatched'
  END as matching_status

FROM aed_data a
LEFT JOIN target_list_devices td
  ON a.equipment_serial = td.equipment_serial
  AND td.target_list_year = 2024
LEFT JOIN target_list_2024 tl
  ON td.target_institution_id = tl.id;

GRANT SELECT ON aed_with_target_2024 TO authenticated;

COMMENT ON VIEW aed_with_target_2024 IS '2024년 구비의무기관과 매칭된 AED 통합 뷰';

-- ============================================
-- 4. 통계 뷰: 2024년 매칭 현황
-- ============================================
CREATE OR REPLACE VIEW target_list_stats_2024 AS
SELECT
  -- 구비의무기관 통계
  (SELECT COUNT(*) FROM target_list_2024) as total_targets,
  (SELECT COUNT(DISTINCT target_institution_id)
   FROM target_list_devices
   WHERE target_list_year = 2024) as matched_targets,

  -- AED 장비 통계
  (SELECT COUNT(*) FROM aed_data) as total_devices,
  (SELECT COUNT(DISTINCT equipment_serial)
   FROM target_list_devices
   WHERE target_list_year = 2024) as matched_devices,

  -- 매칭률
  ROUND(
    100.0 * (SELECT COUNT(DISTINCT target_institution_id)
             FROM target_list_devices
             WHERE target_list_year = 2024) /
    NULLIF((SELECT COUNT(*) FROM target_list_2024), 0),
    2
  ) as target_matching_rate,

  ROUND(
    100.0 * (SELECT COUNT(DISTINCT equipment_serial)
             FROM target_list_devices
             WHERE target_list_year = 2024) /
    NULLIF((SELECT COUNT(*) FROM aed_data), 0),
    2
  ) as device_matching_rate,

  -- 매칭 방법별 통계
  (SELECT COUNT(*) FROM target_list_devices
   WHERE target_list_year = 2024 AND matching_method = 'verified') as verified_matches,
  (SELECT COUNT(*) FROM target_list_devices
   WHERE target_list_year = 2024 AND matching_method = 'manual') as manual_matches,
  (SELECT COUNT(*) FROM target_list_devices
   WHERE target_list_year = 2024 AND matching_method = 'auto') as auto_matches,
  (SELECT COUNT(*) FROM target_list_devices
   WHERE target_list_year = 2024 AND matching_method = 'suggested') as suggested_matches;

GRANT SELECT ON target_list_stats_2024 TO authenticated;

COMMENT ON VIEW target_list_stats_2024 IS '2024년 구비의무기관 매칭 통계';

-- ============================================
-- 5. 검증 함수: 고아 레코드 찾기
-- ============================================

-- 5-1. aed_data에 없는 equipment_serial 찾기
CREATE OR REPLACE FUNCTION check_orphaned_target_matches(p_year INTEGER DEFAULT 2024)
RETURNS TABLE(
  equipment_serial VARCHAR,
  target_institution_id VARCHAR,
  matched_at TIMESTAMPTZ,
  matching_method VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    td.equipment_serial,
    td.target_institution_id,
    td.matched_at,
    td.matching_method
  FROM target_list_devices td
  LEFT JOIN aed_data a ON td.equipment_serial = a.equipment_serial
  WHERE td.target_list_year = p_year
    AND a.equipment_serial IS NULL
  ORDER BY td.matched_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_orphaned_target_matches IS 'aed_data에 없는 equipment_serial을 참조하는 매칭 레코드 찾기';

-- 5-2. target_list_2024에 없는 target_institution_id 찾기
CREATE OR REPLACE FUNCTION check_invalid_target_institutions(p_year INTEGER DEFAULT 2024)
RETURNS TABLE(
  target_institution_id VARCHAR,
  equipment_serial VARCHAR,
  matched_at TIMESTAMPTZ
) AS $$
DECLARE
  v_table_name TEXT;
BEGIN
  v_table_name := 'target_list_' || p_year;

  RETURN QUERY EXECUTE format('
    SELECT
      td.target_institution_id,
      td.equipment_serial,
      td.matched_at
    FROM target_list_devices td
    LEFT JOIN %I tl ON td.target_institution_id = tl.id
    WHERE td.target_list_year = $1
      AND tl.id IS NULL
    ORDER BY td.matched_at DESC
  ', v_table_name)
  USING p_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_invalid_target_institutions IS 'target_list_YYYY 테이블에 없는 target_institution_id를 참조하는 매칭 레코드 찾기';

-- ============================================
-- 6. RLS (Row Level Security) 정책
-- ============================================

-- target_list_2024 RLS
ALTER TABLE target_list_2024 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "target_list_2024_select_all" ON target_list_2024
  FOR SELECT USING (true);  -- 모든 사용자 조회 가능

CREATE POLICY "target_list_2024_insert_admin" ON target_list_2024
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin')
    )
  );

CREATE POLICY "target_list_2024_update_admin" ON target_list_2024
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin')
    )
  );

-- target_list_devices RLS
ALTER TABLE target_list_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "target_devices_select_all" ON target_list_devices
  FOR SELECT USING (true);  -- 모든 사용자 조회 가능

CREATE POLICY "target_devices_insert_admin" ON target_list_devices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin')
    )
  );

CREATE POLICY "target_devices_update_own" ON target_list_devices
  FOR UPDATE USING (
    matched_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin')
    )
  );

-- ============================================
-- 완료 로그
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'schema_migrations'
  ) THEN
    CREATE TABLE public.schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

INSERT INTO public.schema_migrations (version, applied_at)
VALUES ('41_target_list_2024', NOW())
ON CONFLICT (version) DO NOTHING;
