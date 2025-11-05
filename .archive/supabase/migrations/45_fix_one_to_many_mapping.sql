-- ============================================
-- Migration 45: 1:N 매핑 지원 (1 target_key → N management_numbers)
-- 실행일: 2025-10-04
-- 목적: 1개 기관이 2개 이상의 관리번호로 분리된 경우 대응
-- ============================================

-- ============================================
-- 문제점:
-- - aed_target_mapping은 equipment_serial UNIQUE 제약으로 1:1 매핑만 가능
-- - 실제로는 1개 target_key에 여러 management_number가 매핑될 수 있음
--
-- 해결책:
-- - equipment_serial UNIQUE 제약 유지 (각 AED는 하나의 매핑만)
-- - management_number UNIQUE 제약 제거 (여러 관리번호가 같은 target_key 공유 가능)
-- - 그룹 매핑 테이블 추가 (management_number 기반 매칭)
-- ============================================

-- ============================================
-- 1. aed_target_mapping 제약 수정
-- ============================================

-- management_number UNIQUE 제약 제거
ALTER TABLE aed_target_mapping
  DROP CONSTRAINT IF EXISTS aed_target_mapping_management_number_key;

-- management_number 인덱스는 유지 (검색 성능)
CREATE INDEX IF NOT EXISTS idx_mapping_management_number
  ON aed_target_mapping(management_number);

-- ============================================
-- 2. 관리번호 그룹 매핑 테이블 (핵심!)
-- ============================================

CREATE TABLE IF NOT EXISTS public.management_number_group_mapping (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 관리번호 (aed_data.management_number)
  management_number VARCHAR(100) NOT NULL UNIQUE,

  -- 2024년 매핑
  target_key_2024 VARCHAR(255),  -- target_list_2024.target_key
  auto_suggested_2024 VARCHAR(255),
  auto_confidence_2024 NUMERIC(5,2) CHECK (auto_confidence_2024 BETWEEN 0 AND 100),
  auto_matching_reason_2024 JSONB,

  confirmed_2024 BOOLEAN DEFAULT FALSE,
  confirmed_by_2024 UUID REFERENCES user_profiles(id),
  confirmed_at_2024 TIMESTAMPTZ,

  modified_by_2024 UUID REFERENCES user_profiles(id),
  modified_at_2024 TIMESTAMPTZ,
  modification_note_2024 TEXT,

  -- 2025년 매핑
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

  -- 시스템 필드
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_mgmt_group_target_2024 ON management_number_group_mapping(target_key_2024);
CREATE INDEX idx_mgmt_group_confirmed_2024 ON management_number_group_mapping(confirmed_2024);
CREATE INDEX idx_mgmt_group_target_2025 ON management_number_group_mapping(target_key_2025);

-- 트리거
CREATE TRIGGER update_mgmt_group_mapping_updated_at
  BEFORE UPDATE ON public.management_number_group_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE management_number_group_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mgmt_group_select_all" ON management_number_group_mapping
  FOR SELECT USING (true);

CREATE POLICY "mgmt_group_insert_auth" ON management_number_group_mapping
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "mgmt_group_update_auth" ON management_number_group_mapping
  FOR UPDATE USING (
    confirmed_by_2024 = auth.uid()
    OR confirmed_by_2025 = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin')
    )
  );

-- 코멘트
COMMENT ON TABLE management_number_group_mapping IS
  '관리번호 기반 그룹 매핑 (1 target_key → N management_numbers 지원)';
COMMENT ON COLUMN management_number_group_mapping.management_number IS
  'AED 관리번호 (여러 개가 같은 target_key 공유 가능)';

-- ============================================
-- 3. 통합 뷰 업데이트 (관리번호 그룹 매핑 포함)
-- ============================================

CREATE OR REPLACE VIEW aed_with_target_2024 AS
SELECT
  a.*,

  -- 개별 AED 매핑 정보 (equipment_serial 기반)
  m_aed.target_key_2024 as aed_target_key_2024,
  m_aed.auto_suggested_2024 as aed_auto_suggested_2024,
  m_aed.auto_confidence_2024 as aed_auto_confidence_2024,
  m_aed.confirmed_2024 as aed_confirmed_2024,

  -- 관리번호 그룹 매핑 정보 (management_number 기반)
  m_group.target_key_2024 as group_target_key_2024,
  m_group.auto_suggested_2024 as group_auto_suggested_2024,
  m_group.auto_confidence_2024 as group_auto_confidence_2024,
  m_group.confirmed_2024 as group_confirmed_2024,

  -- 최종 매핑 (우선순위: 개별 AED > 관리번호 그룹)
  COALESCE(m_aed.target_key_2024, m_group.target_key_2024) as final_target_key_2024,
  COALESCE(m_aed.confirmed_2024, m_group.confirmed_2024, FALSE) as final_confirmed_2024,

  -- 2024년 구비의무기관 정보
  tl.institution_name as target_institution_name,
  tl.division as target_division,
  tl.sub_division as target_sub_division,
  tl.target_keygroup,

  -- 매칭 상태
  CASE
    WHEN COALESCE(m_aed.confirmed_2024, m_group.confirmed_2024) = TRUE THEN 'confirmed'
    WHEN m_aed.auto_suggested_2024 IS NOT NULL OR m_group.auto_suggested_2024 IS NOT NULL THEN 'suggested'
    ELSE 'unmatched'
  END as matching_status_2024,

  -- 매칭 소스 (어느 테이블에서 매칭되었는지)
  CASE
    WHEN m_aed.target_key_2024 IS NOT NULL THEN 'equipment_serial'
    WHEN m_group.target_key_2024 IS NOT NULL THEN 'management_number'
    ELSE NULL
  END as matching_source

FROM aed_data a

-- 개별 AED 매핑
LEFT JOIN aed_target_mapping m_aed
  ON a.equipment_serial = m_aed.equipment_serial

-- 관리번호 그룹 매핑
LEFT JOIN management_number_group_mapping m_group
  ON a.management_number = m_group.management_number

-- 구비의무기관 정보 (최종 target_key 사용)
LEFT JOIN target_list_2024 tl
  ON COALESCE(m_aed.target_key_2024, m_group.target_key_2024) = tl.target_key;

GRANT SELECT ON aed_with_target_2024 TO authenticated;

COMMENT ON VIEW aed_with_target_2024 IS
  'AED 데이터 + 2024년 구비의무기관 매핑 통합 뷰 (개별 + 그룹 매핑 지원)';

-- ============================================
-- 4. 통계 뷰 업데이트
-- ============================================

CREATE OR REPLACE VIEW target_mapping_stats_2024 AS
SELECT
  -- AED 통계
  (SELECT COUNT(*) FROM aed_data) as total_aed_devices,

  -- 확정 매핑 (개별 + 그룹)
  (SELECT COUNT(DISTINCT a.equipment_serial)
   FROM aed_data a
   LEFT JOIN aed_target_mapping m_aed ON a.equipment_serial = m_aed.equipment_serial
   LEFT JOIN management_number_group_mapping m_group ON a.management_number = m_group.management_number
   WHERE COALESCE(m_aed.confirmed_2024, m_group.confirmed_2024) = TRUE
  ) as confirmed_aed_count,

  -- 자동 추천 (개별 + 그룹)
  (SELECT COUNT(DISTINCT a.equipment_serial)
   FROM aed_data a
   LEFT JOIN aed_target_mapping m_aed ON a.equipment_serial = m_aed.equipment_serial
   LEFT JOIN management_number_group_mapping m_group ON a.management_number = m_group.management_number
   WHERE m_aed.auto_suggested_2024 IS NOT NULL OR m_group.auto_suggested_2024 IS NOT NULL
  ) as auto_suggested_aed_count,

  -- 구비의무기관 통계
  (SELECT COUNT(*) FROM target_list_2024) as total_target_institutions,

  -- 매칭된 기관 수 (개별 + 그룹)
  (SELECT COUNT(DISTINCT target_key)
   FROM (
     SELECT target_key_2024 as target_key FROM aed_target_mapping WHERE confirmed_2024 = TRUE
     UNION
     SELECT target_key_2024 as target_key FROM management_number_group_mapping WHERE confirmed_2024 = TRUE
   ) combined
   WHERE target_key IS NOT NULL
  ) as matched_institution_count,

  -- 매칭률
  ROUND(
    100.0 * (SELECT COUNT(DISTINCT a.equipment_serial)
             FROM aed_data a
             LEFT JOIN aed_target_mapping m_aed ON a.equipment_serial = m_aed.equipment_serial
             LEFT JOIN management_number_group_mapping m_group ON a.management_number = m_group.management_number
             WHERE COALESCE(m_aed.confirmed_2024, m_group.confirmed_2024) = TRUE) /
    NULLIF((SELECT COUNT(*) FROM aed_data), 0),
    2
  ) as aed_matching_rate,

  ROUND(
    100.0 * (SELECT COUNT(DISTINCT target_key)
             FROM (
               SELECT target_key_2024 as target_key FROM aed_target_mapping WHERE confirmed_2024 = TRUE
               UNION
               SELECT target_key_2024 as target_key FROM management_number_group_mapping WHERE confirmed_2024 = TRUE
             ) combined
             WHERE target_key IS NOT NULL) /
    NULLIF((SELECT COUNT(*) FROM target_list_2024), 0),
    2
  ) as institution_matching_rate,

  -- 자동 추천 신뢰도 평균 (개별 + 그룹)
  ROUND(
    (SELECT AVG(confidence)
     FROM (
       SELECT auto_confidence_2024 as confidence FROM aed_target_mapping WHERE auto_confidence_2024 IS NOT NULL
       UNION ALL
       SELECT auto_confidence_2024 as confidence FROM management_number_group_mapping WHERE auto_confidence_2024 IS NOT NULL
     ) combined
    ), 2
  ) as avg_auto_confidence,

  -- 그룹 매핑 통계 추가
  (SELECT COUNT(*) FROM management_number_group_mapping) as total_mgmt_number_groups,
  (SELECT COUNT(*) FROM management_number_group_mapping WHERE confirmed_2024 = TRUE) as confirmed_mgmt_groups;

GRANT SELECT ON target_mapping_stats_2024 TO authenticated;

COMMENT ON VIEW target_mapping_stats_2024 IS
  '2024년 매칭 통계 대시보드 (개별 AED + 관리번호 그룹 통합)';

-- ============================================
-- 5. 관리번호 그룹별 target_key 조회 뷰
-- ============================================

CREATE OR REPLACE VIEW target_management_number_groups AS
SELECT
  tl.target_key,
  tl.institution_name,
  tl.sido,
  tl.gugun,
  tl.division,
  tl.sub_division,

  -- 이 target_key에 매핑된 관리번호 목록
  ARRAY_AGG(DISTINCT mg.management_number ORDER BY mg.management_number) as management_numbers,
  COUNT(DISTINCT mg.management_number) as management_number_count,

  -- 이 target_key에 속한 총 AED 개수
  (SELECT COUNT(*)
   FROM aed_data a
   WHERE a.management_number = ANY(ARRAY_AGG(mg.management_number))
  ) as total_aed_count,

  MAX(mg.confirmed_at_2024) as last_confirmed_at

FROM target_list_2024 tl
LEFT JOIN management_number_group_mapping mg
  ON tl.target_key = mg.target_key_2024
  AND mg.confirmed_2024 = TRUE

GROUP BY tl.target_key, tl.institution_name, tl.sido, tl.gugun, tl.division, tl.sub_division
HAVING COUNT(mg.management_number) > 0  -- 최소 1개 이상의 관리번호가 매핑된 기관만

ORDER BY management_number_count DESC;

GRANT SELECT ON target_management_number_groups TO authenticated;

COMMENT ON VIEW target_management_number_groups IS
  '1개 구비의무기관에 매핑된 여러 관리번호 그룹 현황';

-- ============================================
-- 완료
-- ============================================
