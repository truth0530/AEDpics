-- ============================================
-- Migration 44: 자동 매칭 함수
-- 실행일: 2025-10-04
-- 목적: aed_data와 target_list_2024 자동 매칭
-- ============================================

-- ============================================
-- 1. 문자열 유사도 계산 함수
-- ============================================

-- 1-1. 문자열 정규화 (공백, 특수문자 제거)
CREATE OR REPLACE FUNCTION normalize_text(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN '';
  END IF;

  -- 공백, 특수문자 제거, 소문자 변환
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(input_text, '[^가-힣a-zA-Z0-9]', '', 'g'),
      '\s+', '', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION normalize_text IS '문자열 정규화: 공백/특수문자 제거';

-- 1-2. 간단한 유사도 계산 (Levenshtein 대체)
CREATE OR REPLACE FUNCTION simple_similarity(str1 TEXT, str2 TEXT)
RETURNS NUMERIC AS $$
DECLARE
  norm1 TEXT;
  norm2 TEXT;
  len1 INTEGER;
  len2 INTEGER;
  common_prefix INTEGER := 0;
  i INTEGER;
BEGIN
  norm1 := normalize_text(str1);
  norm2 := normalize_text(str2);

  IF norm1 = norm2 THEN
    RETURN 100.0;
  END IF;

  len1 := LENGTH(norm1);
  len2 := LENGTH(norm2);

  IF len1 = 0 OR len2 = 0 THEN
    RETURN 0.0;
  END IF;

  -- 공통 접두사 길이 계산
  FOR i IN 1..LEAST(len1, len2) LOOP
    IF SUBSTRING(norm1, i, 1) = SUBSTRING(norm2, i, 1) THEN
      common_prefix := common_prefix + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- 부분 문자열 포함 여부
  IF POSITION(norm1 IN norm2) > 0 OR POSITION(norm2 IN norm1) > 0 THEN
    RETURN 70.0 + (common_prefix::NUMERIC / GREATEST(len1, len2) * 30.0);
  END IF;

  -- 유사도 = (공통 접두사 / 최대 길이) * 100
  RETURN (common_prefix::NUMERIC / GREATEST(len1, len2)) * 100.0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION simple_similarity IS '간단한 문자열 유사도 계산 (0-100)';

-- ============================================
-- 2. 자동 매칭 함수 (단일 AED)
-- ============================================

CREATE OR REPLACE FUNCTION auto_match_single_aed(
  p_equipment_serial VARCHAR
)
RETURNS TABLE (
  target_key VARCHAR,
  institution_name VARCHAR,
  target_keygroup VARCHAR,
  total_score NUMERIC,
  sido_match BOOLEAN,
  gugun_match BOOLEAN,
  name_score NUMERIC,
  matching_reason JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH aed AS (
    SELECT
      equipment_serial,
      sido,
      gugun,
      installation_institution
    FROM aed_data
    WHERE equipment_serial = p_equipment_serial
  ),
  candidates AS (
    SELECT
      tl.target_key,
      tl.institution_name,
      tl.target_keygroup,
      tl.sido,
      tl.gugun,

      -- 시도 일치 (필수)
      (tl.sido = aed.sido) as sido_match,

      -- 구군 일치 (가산점)
      (tl.gugun = aed.gugun) as gugun_match,

      -- 기관명 유사도
      simple_similarity(tl.institution_name, aed.installation_institution) as name_score,

      aed.installation_institution as aed_institution_name

    FROM target_list_2024 tl, aed
    WHERE tl.sido = aed.sido  -- 시도는 반드시 일치
  ),
  scored AS (
    SELECT
      c.target_key,
      c.institution_name,
      c.target_keygroup,

      -- 총점 계산 (0-100)
      CASE
        -- 시도 일치 (기본 30점)
        WHEN c.sido_match THEN 30.0
        ELSE 0.0
      END +
      CASE
        -- 구군 일치 (추가 20점)
        WHEN c.gugun_match THEN 20.0
        ELSE 0.0
      END +
      -- 기관명 유사도 (최대 50점)
      (c.name_score * 0.5) as total_score,

      c.sido_match,
      c.gugun_match,
      c.name_score,

      -- 매칭 근거 JSONB
      jsonb_build_object(
        'sido_match', c.sido_match,
        'gugun_match', c.gugun_match,
        'name_score', ROUND(c.name_score, 2),
        'aed_institution', c.aed_institution_name,
        'target_institution', c.institution_name
      ) as matching_reason

    FROM candidates c
  )
  SELECT
    s.target_key,
    s.institution_name,
    s.target_keygroup,
    ROUND(s.total_score, 2) as total_score,
    s.sido_match,
    s.gugun_match,
    ROUND(s.name_score, 2) as name_score,
    s.matching_reason
  FROM scored s
  WHERE s.total_score >= 50.0  -- 50점 이상만 추천
  ORDER BY s.total_score DESC, s.name_score DESC
  LIMIT 5;  -- 상위 5개만
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_match_single_aed IS
  '단일 AED에 대한 자동 매칭 추천 (상위 5개, 50점 이상)';

-- ============================================
-- 3. 배치 자동 매칭 함수
-- ============================================

CREATE OR REPLACE FUNCTION auto_match_batch(
  p_limit INTEGER DEFAULT 100,
  p_min_confidence NUMERIC DEFAULT 80.0
)
RETURNS INTEGER AS $$
DECLARE
  v_inserted_count INTEGER := 0;
  v_aed RECORD;
  v_best_match RECORD;
BEGIN
  -- 아직 매칭되지 않은 AED만 처리
  FOR v_aed IN
    SELECT DISTINCT a.equipment_serial, a.management_number
    FROM aed_data a
    LEFT JOIN aed_target_mapping m ON a.equipment_serial = m.equipment_serial
    WHERE m.equipment_serial IS NULL
    LIMIT p_limit
  LOOP
    -- 최고 점수 매칭 찾기
    SELECT * INTO v_best_match
    FROM auto_match_single_aed(v_aed.equipment_serial)
    ORDER BY total_score DESC
    LIMIT 1;

    -- 신뢰도 이상이면 저장
    IF v_best_match.total_score >= p_min_confidence THEN
      INSERT INTO aed_target_mapping (
        equipment_serial,
        management_number,
        auto_suggested_2024,
        auto_confidence_2024,
        auto_matching_reason_2024
      ) VALUES (
        v_aed.equipment_serial,
        v_aed.management_number,
        v_best_match.target_key,
        v_best_match.total_score,
        v_best_match.matching_reason
      )
      ON CONFLICT (equipment_serial) DO UPDATE SET
        auto_suggested_2024 = v_best_match.target_key,
        auto_confidence_2024 = v_best_match.total_score,
        auto_matching_reason_2024 = v_best_match.matching_reason;

      v_inserted_count := v_inserted_count + 1;
    END IF;
  END LOOP;

  RETURN v_inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_match_batch IS
  '배치 자동 매칭: 미매칭 AED에 대해 자동 추천 생성 (기본 100개, 80점 이상)';

-- ============================================
-- 4. 담당자 확인 함수
-- ============================================

CREATE OR REPLACE FUNCTION confirm_target_match(
  p_equipment_serial VARCHAR,
  p_target_key VARCHAR,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_management_number VARCHAR;
BEGIN
  -- aed_data에서 management_number 가져오기
  SELECT management_number INTO v_management_number
  FROM aed_data
  WHERE equipment_serial = p_equipment_serial;

  -- aed_target_mapping 업데이트/삽입
  INSERT INTO aed_target_mapping (
    equipment_serial,
    management_number,
    target_key_2024,
    confirmed_2024,
    confirmed_by_2024,
    confirmed_at_2024
  ) VALUES (
    p_equipment_serial,
    v_management_number,
    p_target_key,
    TRUE,
    p_user_id,
    NOW()
  )
  ON CONFLICT (equipment_serial) DO UPDATE SET
    target_key_2024 = p_target_key,
    confirmed_2024 = TRUE,
    confirmed_by_2024 = p_user_id,
    confirmed_at_2024 = NOW();

  -- target_list_2024에 management_number 역매핑
  UPDATE target_list_2024
  SET management_number = v_management_number
  WHERE target_key = p_target_key;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION confirm_target_match IS
  '담당자가 매칭 확정 (aed_target_mapping + target_list_2024 업데이트)';

-- ============================================
-- 5. 매칭 수정 함수
-- ============================================

CREATE OR REPLACE FUNCTION modify_target_match(
  p_equipment_serial VARCHAR,
  p_new_target_key VARCHAR,
  p_user_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- 기존 매칭 수정
  UPDATE aed_target_mapping
  SET
    target_key_2024 = p_new_target_key,
    confirmed_2024 = TRUE,
    modified_by_2024 = p_user_id,
    modified_at_2024 = NOW(),
    modification_note_2024 = p_note
  WHERE equipment_serial = p_equipment_serial;

  IF NOT FOUND THEN
    -- 없으면 새로 생성
    PERFORM confirm_target_match(p_equipment_serial, p_new_target_key, p_user_id);
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION modify_target_match IS
  '담당자가 매칭 수정 (이력 기록)';

-- ============================================
-- 완료 로그
-- ============================================
-- schema_migrations 테이블이 없으므로 주석 처리
-- INSERT INTO public.schema_migrations (version, applied_at)
-- VALUES ('44_auto_matching_function', NOW())
-- ON CONFLICT (version) DO NOTHING;
