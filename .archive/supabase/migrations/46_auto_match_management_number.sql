-- ============================================
-- Migration 46: 관리번호 기반 자동 매칭 함수
-- 실행일: 2025-10-04
-- 목적: management_number 그룹 단위로 효율적 매칭
-- ⚠️ 실제 스키마: installation_institution (NOT institution_name)
-- ⚠️ 실제 스키마: category_1, category_2, category_3 (NOT category)
-- ============================================

-- ============================================
-- 1. 관리번호 그룹 자동 매칭 (단일)
-- ============================================

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
    a.installation_institution,
    a.sido,
    a.gugun,
    a.category_1
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
      tl.target_key,
      tl.institution_name,
      tl.sido,
      tl.gugun,

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
    s.target_key,
    s.total_score,
    s.reason
  FROM scored s
  ORDER BY s.total_score DESC
  LIMIT 5;  -- 상위 5개만 반환

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_match_single_management_number IS
  '단일 관리번호에 대해 자동 매칭 후보 검색 (상위 5개)';

-- ============================================
-- 2. 관리번호 그룹 일괄 자동 매칭
-- ============================================

CREATE OR REPLACE FUNCTION auto_match_management_numbers_batch(
  p_category_filter VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_year INTEGER DEFAULT 2024
)
RETURNS TABLE (
  management_number VARCHAR,
  suggested_target_key VARCHAR,
  confidence NUMERIC,
  matching_reason JSONB,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH unique_management_numbers AS (
    -- aed_data에서 고유 관리번호 추출
    SELECT DISTINCT
      a.management_number,
      a.installation_institution,
      a.sido,
      a.gugun,
      a.category_1
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
    tm.management_number,
    NULL,  -- 아직 확정 안됨
    tm.suggested_target_key,
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
    management_number,
    auto_suggested_2024 as suggested_target_key,
    auto_confidence_2024 as confidence,
    auto_matching_reason_2024 as matching_reason,
    CASE
      WHEN auto_confidence_2024 >= 90 THEN 'high_confidence'
      WHEN auto_confidence_2024 >= 70 THEN 'medium_confidence'
      ELSE 'low_confidence'
    END as status;

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_match_management_numbers_batch IS
  '관리번호 그룹 일괄 자동 매칭 (최대 p_limit개)';

-- ============================================
-- 3. 관리번호 그룹 매칭 확정 함수
-- ============================================

CREATE OR REPLACE FUNCTION confirm_management_number_match(
  p_management_number VARCHAR,
  p_target_key VARCHAR,
  p_year INTEGER DEFAULT 2024,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- 사용자 ID 결정
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not authenticated'
    );
  END IF;

  -- management_number_group_mapping 업데이트
  IF p_year = 2024 THEN
    UPDATE management_number_group_mapping
    SET
      target_key_2024 = p_target_key,
      confirmed_2024 = TRUE,
      confirmed_by_2024 = v_user_id,
      confirmed_at_2024 = NOW(),
      updated_at = NOW()
    WHERE management_number = p_management_number;

  ELSIF p_year = 2025 THEN
    UPDATE management_number_group_mapping
    SET
      target_key_2025 = p_target_key,
      confirmed_2025 = TRUE,
      confirmed_by_2025 = v_user_id,
      confirmed_at_2025 = NOW(),
      updated_at = NOW()
    WHERE management_number = p_management_number;
  END IF;

  IF NOT FOUND THEN
    -- 레코드가 없으면 새로 INSERT
    INSERT INTO management_number_group_mapping (
      management_number,
      target_key_2024,
      confirmed_2024,
      confirmed_by_2024,
      confirmed_at_2024
    ) VALUES (
      p_management_number,
      CASE WHEN p_year = 2024 THEN p_target_key ELSE NULL END,
      CASE WHEN p_year = 2024 THEN TRUE ELSE FALSE END,
      CASE WHEN p_year = 2024 THEN v_user_id ELSE NULL END,
      CASE WHEN p_year = 2024 THEN NOW() ELSE NULL END
    );
  END IF;

  -- 결과 반환
  SELECT jsonb_build_object(
    'success', true,
    'management_number', p_management_number,
    'target_key', p_target_key,
    'year', p_year,
    'confirmed_by', v_user_id,
    'aed_count', (SELECT COUNT(*) FROM aed_data WHERE management_number = p_management_number)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION confirm_management_number_match IS
  '관리번호 그룹 매칭 확정 (담당자 승인)';

-- ============================================
-- 4. 관리번호 그룹 매칭 수정 함수
-- ============================================

CREATE OR REPLACE FUNCTION modify_management_number_match(
  p_management_number VARCHAR,
  p_new_target_key VARCHAR,
  p_modification_note TEXT,
  p_year INTEGER DEFAULT 2024,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_old_target_key VARCHAR;
  v_result JSONB;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not authenticated'
    );
  END IF;

  -- 기존 target_key 조회
  IF p_year = 2024 THEN
    SELECT target_key_2024 INTO v_old_target_key
    FROM management_number_group_mapping
    WHERE management_number = p_management_number;

    -- 업데이트
    UPDATE management_number_group_mapping
    SET
      target_key_2024 = p_new_target_key,
      confirmed_2024 = TRUE,
      modified_by_2024 = v_user_id,
      modified_at_2024 = NOW(),
      modification_note_2024 = p_modification_note,
      updated_at = NOW()
    WHERE management_number = p_management_number;

  ELSIF p_year = 2025 THEN
    SELECT target_key_2025 INTO v_old_target_key
    FROM management_number_group_mapping
    WHERE management_number = p_management_number;

    UPDATE management_number_group_mapping
    SET
      target_key_2025 = p_new_target_key,
      confirmed_2025 = TRUE,
      modified_by_2025 = v_user_id,
      modified_at_2025 = NOW(),
      modification_note_2025 = p_modification_note,
      updated_at = NOW()
    WHERE management_number = p_management_number;
  END IF;

  -- 결과 반환
  SELECT jsonb_build_object(
    'success', true,
    'management_number', p_management_number,
    'old_target_key', v_old_target_key,
    'new_target_key', p_new_target_key,
    'year', p_year,
    'modified_by', v_user_id,
    'modification_note', p_modification_note,
    'aed_count', (SELECT COUNT(*) FROM aed_data WHERE management_number = p_management_number)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION modify_management_number_match IS
  '관리번호 그룹 매칭 수정 (이력 기록)';

-- ============================================
-- 5. 샘플 테스트용 헬퍼 함수
-- ============================================

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
    a.management_number,
    MAX(a.installation_institution) as installation_institution,
    MAX(a.sido) as sido,
    MAX(a.gugun) as gugun,
    MAX(a.category_1) as category_1,
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

COMMENT ON FUNCTION get_sample_management_numbers IS
  '샘플 테스트용 미매핑 관리번호 조회';

-- ============================================
-- 완료
-- ============================================
