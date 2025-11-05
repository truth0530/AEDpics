-- ============================================
-- Migration 46 수정: VARCHAR → TEXT 캐스팅 추가
-- ============================================

-- get_sample_management_numbers 함수 수정
CREATE OR REPLACE FUNCTION get_sample_management_numbers(
  p_category VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  management_number VARCHAR,
  installation_institution VARCHAR,
  sido VARCHAR,
  gugun VARCHAR,
  category_1 VARCHAR,
  equipment_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.management_number::VARCHAR,
    MAX(a.installation_institution)::VARCHAR as installation_institution,
    MAX(a.sido)::VARCHAR as sido,
    MAX(a.gugun)::VARCHAR as gugun,
    MAX(a.category_1)::VARCHAR as category_1,
    COUNT(*) as equipment_count
  FROM aed_data a
  WHERE a.management_number IS NOT NULL
    AND (p_category IS NULL OR a.category_1 = p_category)
    AND NOT EXISTS (
      SELECT 1 FROM management_number_group_mapping mg
      WHERE mg.management_number = a.management_number
    )
  GROUP BY a.management_number
  ORDER BY equipment_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- auto_match_single_management_number 함수 수정
CREATE OR REPLACE FUNCTION auto_match_single_management_number(
  p_management_number VARCHAR,
  p_year INTEGER DEFAULT 2024
)
RETURNS TABLE (
  target_key VARCHAR,
  total_score NUMERIC,
  matching_reason JSONB
) AS $$
DECLARE
  v_aed_record RECORD;
BEGIN
  -- aed_data에서 해당 management_number의 대표 레코드 조회
  SELECT
    a.installation_institution::VARCHAR,
    a.sido::VARCHAR,
    a.gugun::VARCHAR,
    a.category_1::VARCHAR
  INTO v_aed_record
  FROM aed_data a
  WHERE a.management_number = p_management_number
  LIMIT 1;

  -- management_number가 없으면 빈 결과 반환
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- target_list_2024에서 매칭 후보 검색
  RETURN QUERY
  WITH candidates AS (
    SELECT
      tl.target_key::VARCHAR,
      tl.institution_name::VARCHAR,
      tl.sido::VARCHAR,
      tl.gugun::VARCHAR,

      -- 점수 계산
      CASE WHEN tl.sido = v_aed_record.sido THEN 30 ELSE 0 END as sido_score,
      CASE WHEN tl.gugun = v_aed_record.gugun THEN 20 ELSE 0 END as gugun_score,
      simple_similarity(
        normalize_text(tl.institution_name),
        normalize_text(v_aed_record.installation_institution)
      ) * 0.5 as name_score  -- 최대 50점

    FROM target_list_2024 tl
    WHERE tl.data_year = p_year
      AND tl.sido = v_aed_record.sido  -- 시도는 반드시 일치 (필터링 성능 향상)
  ),
  scored AS (
    SELECT
      c.target_key,
      (c.sido_score + c.gugun_score + c.name_score) as total_score,
      jsonb_build_object(
        'sido_match', (c.sido_score > 0),
        'gugun_match', (c.gugun_score > 0),
        'sido_score', c.sido_score,
        'gugun_score', c.gugun_score,
        'name_score', ROUND(c.name_score::numeric, 2),
        'aed_institution', v_aed_record.installation_institution,
        'target_institution', c.institution_name,
        'aed_sido', v_aed_record.sido,
        'aed_gugun', v_aed_record.gugun,
        'target_sido', c.sido,
        'target_gugun', c.gugun
      ) as reason
    FROM candidates c
    WHERE (c.sido_score + c.gugun_score + c.name_score) >= 50  -- 최소 점수 50점
  )
  SELECT
    s.target_key::VARCHAR,
    s.total_score,
    s.reason
  FROM scored s
  ORDER BY s.total_score DESC
  LIMIT 5;  -- 상위 5개만 반환

END;
$$ LANGUAGE plpgsql;

-- 완료 확인
SELECT 'get_sample_management_numbers 함수 수정 완료!' as status;
