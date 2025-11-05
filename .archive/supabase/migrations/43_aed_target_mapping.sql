-- ============================================
-- Migration 43: aed_target_mapping (핵심 영속성 매핑 테이블)
-- 실행일: 2025-10-04
-- 목적: aed_data와 target_list_2024/2025 간 영속성 매핑
-- ============================================

-- ============================================
-- 1. aed_target_mapping 테이블 생성
-- ============================================
DROP TABLE IF EXISTS public.aed_target_mapping CASCADE;

CREATE TABLE public.aed_target_mapping (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- AED 식별자 (절대 변하지 않는 안정적 키)
  equipment_serial VARCHAR(255) NOT NULL UNIQUE,
  management_number VARCHAR(100) UNIQUE,  -- NULL 가능 (aed_data에 없을 수 있음)

  -- ============================================
  -- 2024년 매핑 정보
  -- ============================================
  target_key_2024 VARCHAR(255),  -- target_list_2024.target_key 참조 (FK 없음)

  -- 자동 추천 정보 (AI/알고리즘 추천)
  auto_suggested_2024 VARCHAR(255),  -- 자동 추천된 target_key
  auto_confidence_2024 NUMERIC(5,2) CHECK (auto_confidence_2024 BETWEEN 0 AND 100),
  auto_matching_reason_2024 JSONB,  -- {nameScore: 85, addressScore: 70, sido_match: true}

  -- 담당자 확인 정보
  confirmed_2024 BOOLEAN DEFAULT FALSE,
  confirmed_by_2024 UUID REFERENCES user_profiles(id),
  confirmed_at_2024 TIMESTAMPTZ,

  -- 수정 이력
  modified_by_2024 UUID REFERENCES user_profiles(id),
  modified_at_2024 TIMESTAMPTZ,
  modification_note_2024 TEXT,

  -- ============================================
  -- 2025년 매핑 정보 (향후 추가)
  -- ============================================
  target_key_2025 VARCHAR(255),
  auto_suggested_2025 VARCHAR(255),
  auto_confidence_2025 NUMERIC(5,2) CHECK (auto_confidence_2025 BETWEEN 0 AND 100),
  auto_matching_reason_2025 JSONB,
  confirmed_2025 BOOLEAN DEFAULT FALSE,
  confirmed_by_2025 UUID REFERENCES user_profiles(id),
  confirmed_at_2025 TIMESTAMPTZ,
  modified_by_2025 UUID REFERENCES user_profiles(id),
  modified_at_2025 TIMESTAMPTZ,
  modification_note_2025 TEXT,

  -- ============================================
  -- 시스템 필드
  -- ============================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 인덱스 생성
-- ============================================

-- 핵심 인덱스
CREATE INDEX idx_mapping_equipment_serial ON aed_target_mapping(equipment_serial);
CREATE INDEX idx_mapping_management_number ON aed_target_mapping(management_number);

-- 2024년 매핑 인덱스
CREATE INDEX idx_mapping_target_2024 ON aed_target_mapping(target_key_2024);
CREATE INDEX idx_mapping_confirmed_2024 ON aed_target_mapping(confirmed_2024);
CREATE INDEX idx_mapping_auto_suggested_2024 ON aed_target_mapping(auto_suggested_2024);

-- 2025년 매핑 인덱스
CREATE INDEX idx_mapping_target_2025 ON aed_target_mapping(target_key_2025);
CREATE INDEX idx_mapping_confirmed_2025 ON aed_target_mapping(confirmed_2025);

-- 복합 인덱스 (자주 사용되는 쿼리 최적화)
CREATE INDEX idx_mapping_equipment_confirmed_2024
  ON aed_target_mapping(equipment_serial, confirmed_2024);

-- ============================================
-- 3. 트리거
-- ============================================
CREATE TRIGGER update_aed_target_mapping_updated_at
  BEFORE UPDATE ON public.aed_target_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. 코멘트
-- ============================================
COMMENT ON TABLE aed_target_mapping IS 'AED와 구비의무기관 영속성 매핑 테이블 (절대 삭제 금지)';
COMMENT ON COLUMN aed_target_mapping.equipment_serial IS 'AED 장비 일련번호 (안정적 키)';
COMMENT ON COLUMN aed_target_mapping.management_number IS 'AED 관리번호 (aed_data.management_number)';
COMMENT ON COLUMN aed_target_mapping.target_key_2024 IS '2024년 구비의무기관 target_key (담당자 확정)';
COMMENT ON COLUMN aed_target_mapping.auto_suggested_2024 IS '2024년 자동 추천 target_key';
COMMENT ON COLUMN aed_target_mapping.auto_confidence_2024 IS '자동 추천 신뢰도 (0-100)';
COMMENT ON COLUMN aed_target_mapping.confirmed_2024 IS '담당자 확인 완료 여부';

-- ============================================
-- 5. RLS 정책
-- ============================================
ALTER TABLE aed_target_mapping ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 SELECT 가능
CREATE POLICY "mapping_select_all" ON aed_target_mapping
  FOR SELECT USING (true);

-- authenticated 사용자 INSERT 가능
CREATE POLICY "mapping_insert_auth" ON aed_target_mapping
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 본인이 확인한 매핑만 UPDATE 가능
CREATE POLICY "mapping_update_own" ON aed_target_mapping
  FOR UPDATE USING (
    confirmed_by_2024 = auth.uid()
    OR confirmed_by_2025 = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin')
    )
  );

-- ============================================
-- 6. 통합 뷰: AED + 2024년 구비의무기관
-- ============================================
CREATE OR REPLACE VIEW aed_with_target_2024 AS
SELECT
  a.*,

  -- 매핑 정보
  m.target_key_2024,
  m.auto_suggested_2024,
  m.auto_confidence_2024,
  m.confirmed_2024,
  m.confirmed_at_2024,

  -- 2024년 구비의무기관 정보
  tl.institution_name as target_institution_name,
  tl.division as target_division,
  tl.sub_division as target_sub_division,
  tl.target_keygroup,

  -- 자동 추천 기관 정보
  auto_tl.institution_name as auto_suggested_institution_name,
  auto_tl.target_keygroup as auto_suggested_keygroup,

  -- 매칭 상태
  CASE
    WHEN m.confirmed_2024 = TRUE THEN 'confirmed'
    WHEN m.auto_suggested_2024 IS NOT NULL THEN 'suggested'
    ELSE 'unmatched'
  END as matching_status_2024

FROM aed_data a
LEFT JOIN aed_target_mapping m
  ON a.equipment_serial = m.equipment_serial
  OR (a.management_number IS NOT NULL AND a.management_number = m.management_number)
LEFT JOIN target_list_2024 tl
  ON m.target_key_2024 = tl.target_key
LEFT JOIN target_list_2024 auto_tl
  ON m.auto_suggested_2024 = auto_tl.target_key;

GRANT SELECT ON aed_with_target_2024 TO authenticated;

COMMENT ON VIEW aed_with_target_2024 IS 'AED 데이터 + 2024년 구비의무기관 매핑 통합 뷰';

-- ============================================
-- 7. 통계 뷰: 매칭 현황
-- ============================================
CREATE OR REPLACE VIEW target_mapping_stats_2024 AS
SELECT
  -- AED 통계
  (SELECT COUNT(*) FROM aed_data) as total_aed_devices,
  (SELECT COUNT(DISTINCT equipment_serial) FROM aed_target_mapping
   WHERE confirmed_2024 = TRUE) as confirmed_aed_count,
  (SELECT COUNT(DISTINCT equipment_serial) FROM aed_target_mapping
   WHERE auto_suggested_2024 IS NOT NULL) as auto_suggested_aed_count,

  -- 구비의무기관 통계
  (SELECT COUNT(*) FROM target_list_2024) as total_target_institutions,
  (SELECT COUNT(DISTINCT target_key_2024) FROM aed_target_mapping
   WHERE confirmed_2024 = TRUE) as matched_institution_count,

  -- 매칭률
  ROUND(
    100.0 * (SELECT COUNT(DISTINCT equipment_serial) FROM aed_target_mapping
             WHERE confirmed_2024 = TRUE) /
    NULLIF((SELECT COUNT(*) FROM aed_data), 0),
    2
  ) as aed_matching_rate,

  ROUND(
    100.0 * (SELECT COUNT(DISTINCT target_key_2024) FROM aed_target_mapping
             WHERE confirmed_2024 = TRUE) /
    NULLIF((SELECT COUNT(*) FROM target_list_2024), 0),
    2
  ) as institution_matching_rate,

  -- 자동 추천 신뢰도 평균
  (SELECT ROUND(AVG(auto_confidence_2024), 2) FROM aed_target_mapping
   WHERE auto_confidence_2024 IS NOT NULL) as avg_auto_confidence;

GRANT SELECT ON target_mapping_stats_2024 TO authenticated;

COMMENT ON VIEW target_mapping_stats_2024 IS '2024년 매칭 통계 대시보드';

-- ============================================
-- 8. 헬퍼 함수: management_number 역매핑
-- ============================================

-- target_list_2024에 management_number 업데이트
CREATE OR REPLACE FUNCTION sync_management_number_to_target_2024()
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- aed_target_mapping에서 확정된 매핑을 target_list_2024로 역매핑
  WITH updates AS (
    UPDATE target_list_2024 tl
    SET management_number = m.management_number
    FROM aed_target_mapping m
    WHERE m.target_key_2024 = tl.target_key
      AND m.confirmed_2024 = TRUE
      AND m.management_number IS NOT NULL
      AND tl.management_number IS NULL
    RETURNING tl.target_key
  )
  SELECT COUNT(*) INTO v_updated_count FROM updates;

  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sync_management_number_to_target_2024 IS
  'aed_target_mapping의 확정 매핑을 target_list_2024.management_number로 역동기화';

-- ============================================
-- 완료 로그
-- ============================================
-- schema_migrations 테이블이 없으므로 주석 처리
-- INSERT INTO public.schema_migrations (version, applied_at)
-- VALUES ('43_aed_target_mapping', NOW())
-- ON CONFLICT (version) DO NOTHING;
