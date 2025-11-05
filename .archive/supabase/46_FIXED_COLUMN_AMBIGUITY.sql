-- ============================================
-- Migration 46 최종 수정: 컬럼명 충돌 해결
-- 문제: RETURNS TABLE의 컬럼명과 CTE 컬럼명 충돌
-- 해결: RETURNS TABLE 컬럼명 변경 (out_ 접두사)
-- ============================================

-- auto_match_management_numbers_batch 함수 수정
CREATE OR REPLACE FUNCTION auto_match_management_numbers_batch(
  p_category_filter VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_year INTEGER DEFAULT 2024
)
RETURNS TABLE (
  out_management_number VARCHAR,        -- ⚠️ out_ 접두사로 충돌 방지
  out_suggested_target_key VARCHAR,
  out_confidence NUMERIC,
  out_matching_reason JSONB,
  out_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH unique_management_numbers AS (
    -- aed_data에서 고유 관리번호 추출
    SELECT DISTINCT
      a.management_number::VARCHAR,
      a.installation_institution::VARCHAR,
      a.sido::VARCHAR,
      a.gugun::VARCHAR,
      a.category_1::VARCHAR
    FROM aed_data a
    WHERE a.management_number IS NOT NULL
      AND (p_category_filter IS NULL OR a.category_1 = p_category_filter)
      AND NOT EXISTS (
        -- 이미 매핑된 관리번호 제외
        SELECT 1 FROM management_number_group_mapping mg
        WHERE mg.management_number = a.management_number
      )
    LIMIT p_limit
  ),
  matched AS (
    SELECT
      umn.management_number,
      (auto_match_single_management_number(umn.management_number, p_year)).*
    FROM unique_management_numbers umn
  ),
  top_matches AS (
    -- 각 관리번호당 최고 점수 매칭만 선택
    SELECT DISTINCT ON (m.management_number)
      m.management_number,
      m.target_key as suggested_target_key,
      m.total_score as confidence,
      m.matching_reason,
      CASE
        WHEN m.total_score >= 90 THEN 'high_confidence'
        WHEN m.total_score >= 70 THEN 'medium_confidence'
        ELSE 'low_confidence'
      END as status
    FROM matched m
    ORDER BY m.management_number, m.total_score DESC
  )
  -- management_number_group_mapping에 INSERT
  INSERT INTO management_number_group_mapping (
    management_number,
    target_key_2024,
    auto_suggested_2024,
    auto_confidence_2024,
    auto_matching_reason_2024,
    confirmed_2024
  )
  SELECT
    tm.management_number::VARCHAR,
    NULL,  -- 아직 확정 안됨
    tm.suggested_target_key::VARCHAR,
    tm.confidence,
    tm.matching_reason,
    FALSE
  FROM top_matches tm
  ON CONFLICT (management_number) DO UPDATE
  SET
    auto_suggested_2024 = EXCLUDED.auto_suggested_2024,
    auto_confidence_2024 = EXCLUDED.auto_confidence_2024,
    auto_matching_reason_2024 = EXCLUDED.auto_matching_reason_2024,
    updated_at = NOW()
  RETURNING
    management_number::VARCHAR,
    auto_suggested_2024::VARCHAR as suggested_target_key,
    auto_confidence_2024 as confidence,
    auto_matching_reason_2024 as matching_reason,
    CASE
      WHEN auto_confidence_2024 >= 90 THEN 'high_confidence'::TEXT
      WHEN auto_confidence_2024 >= 70 THEN 'medium_confidence'::TEXT
      ELSE 'low_confidence'::TEXT
    END as status;

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_match_management_numbers_batch IS
  '관리번호 그룹 일괄 자동 매칭 (컬럼명 충돌 해결)';

-- 완료 확인
SELECT '✅ auto_match_management_numbers_batch 함수 수정 완료!' as status;
