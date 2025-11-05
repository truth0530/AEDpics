-- ============================================
-- Migration 67: 매칭 알고리즘 개선 (Jaro-Winkler 유사도)
-- 작성일: 2025-10-15
-- 목적: 기존 simple_similarity를 Jaro-Winkler로 개선하여 신뢰도 향상
-- 목표: 평균 신뢰도 69.81점 → 80점 이상
-- ============================================

-- ============================================
-- 1. fuzzystrmatch 확장 설치 (Jaro-Winkler 지원)
-- ============================================

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

COMMENT ON EXTENSION fuzzystrmatch IS 'Jaro-Winkler, Levenshtein, Soundex 등 문자열 유사도 함수 제공';

-- ============================================
-- 2. 개선된 유사도 함수 (Jaro-Winkler 기반)
-- ============================================

-- 2-1. Jaro-Winkler 유사도 (0-100 스케일)
CREATE OR REPLACE FUNCTION jaro_winkler_similarity(str1 TEXT, str2 TEXT)
RETURNS NUMERIC AS $$
DECLARE
  norm1 TEXT;
  norm2 TEXT;
  similarity_value NUMERIC;
BEGIN
  -- 문자열 정규화 (기존 normalize_text 함수 사용)
  norm1 := normalize_text(str1);
  norm2 := normalize_text(str2);

  -- 완전 일치
  IF norm1 = norm2 THEN
    RETURN 100.0;
  END IF;

  -- 빈 문자열 체크
  IF LENGTH(norm1) = 0 OR LENGTH(norm2) = 0 THEN
    RETURN 0.0;
  END IF;

  -- PostgreSQL fuzzystrmatch의 jarowinkler() 사용
  -- 반환값: 0.0 ~ 1.0
  similarity_value := jarowinkler(norm1, norm2);

  -- 0-100 스케일로 변환
  RETURN similarity_value * 100.0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION jaro_winkler_similarity IS
  'Jaro-Winkler 유사도 계산 (0-100): 접두사 일치에 가중치를 주는 알고리즘';

-- 2-2. 핵심 키워드 추출 함수 (기관명 정규화 강화)
CREATE OR REPLACE FUNCTION extract_core_keyword(institution_name TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  result := institution_name;

  -- 시설 유형 통일
  result := REGEXP_REPLACE(result, '보건(소|지소|진료소)', '보건', 'g');

  -- 행정 단위 제거
  result := REGEXP_REPLACE(result, '(시|도|군|구)립', '', 'g');

  -- 의료법인 제거
  result := REGEXP_REPLACE(result, '의료법인.*재단', '', 'g');

  -- 한국, 서울, 부산 등 지명 제거 (선택적)
  -- result := REGEXP_REPLACE(result, '^(한국|서울|부산|대구|인천|광주|대전|울산)', '', 'g');

  -- 최종 정규화
  result := normalize_text(result);

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION extract_core_keyword IS
  '기관명에서 핵심 키워드 추출 (시설 유형 통일, 행정 단위 제거)';

-- 2-3. 향상된 기관명 유사도 (키워드 + Jaro-Winkler)
CREATE OR REPLACE FUNCTION enhanced_name_similarity(aed_name TEXT, target_name TEXT)
RETURNS NUMERIC AS $$
DECLARE
  core_aed TEXT;
  core_target TEXT;
  jw_score NUMERIC;
  keyword_bonus NUMERIC := 0.0;
BEGIN
  -- 핵심 키워드 추출
  core_aed := extract_core_keyword(aed_name);
  core_target := extract_core_keyword(target_name);

  -- Jaro-Winkler 유사도
  jw_score := jaro_winkler_similarity(aed_name, target_name);

  -- 핵심 키워드 완전 일치 보너스 (+20점)
  IF core_aed = core_target AND LENGTH(core_aed) >= 3 THEN
    keyword_bonus := 20.0;
  END IF;

  -- 부분 문자열 포함 보너스 (+10점)
  IF POSITION(normalize_text(aed_name) IN normalize_text(target_name)) > 0 OR
     POSITION(normalize_text(target_name) IN normalize_text(aed_name)) > 0 THEN
    keyword_bonus := keyword_bonus + 10.0;
  END IF;

  -- 최종 점수 (최대 100점)
  RETURN LEAST(jw_score + keyword_bonus, 100.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION enhanced_name_similarity IS
  '향상된 기관명 유사도: Jaro-Winkler + 핵심 키워드 매칭 + 부분 문자열 보너스';

-- ============================================
-- 3. 개선된 자동 매칭 함수 (기존 함수 교체)
-- ============================================

DROP FUNCTION IF EXISTS auto_match_single_aed(VARCHAR);

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
      installation_institution,
      category_1  -- 구비의무기관 여부
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
      tl.division,  -- 시설 구분

      -- 시도 일치 (필수)
      (tl.sido = aed.sido) as sido_match,

      -- 구군 일치 (가산점)
      (tl.gugun = aed.gugun) as gugun_match,

      -- 기관명 유사도 (Jaro-Winkler 적용) ★ 개선
      enhanced_name_similarity(tl.institution_name, aed.installation_institution) as name_score,

      -- 구비의무기관 일치
      (aed.category_1 = '구비의무기관') as is_mandatory,

      aed.installation_institution as aed_institution_name,
      aed.sido as aed_sido,
      aed.gugun as aed_gugun

    FROM target_list_2024 tl, aed
    WHERE tl.sido = aed.sido  -- 시도는 반드시 일치
  ),
  scored AS (
    SELECT
      c.target_key,
      c.institution_name,
      c.target_keygroup,

      -- ★ 개선된 총점 계산 (0-100)
      CASE
        -- 시도 일치 (기본 35점, 기존 30→35)
        WHEN c.sido_match THEN 35.0
        ELSE 0.0
      END +
      CASE
        -- 구군 일치 (추가 35점, 기존 20→35)
        WHEN c.gugun_match THEN 35.0
        ELSE 0.0
      END +
      CASE
        -- 구비의무기관 일치 (추가 10점, 신규)
        WHEN c.is_mandatory THEN 10.0
        ELSE 0.0
      END +
      -- 기관명 유사도 (최대 30점, 기존 50→30)
      -- name_score는 이미 0-100이므로 0.3 곱하여 30점 만점으로
      (LEAST(c.name_score, 100.0) * 0.3) as total_score,

      c.sido_match,
      c.gugun_match,
      c.name_score,

      -- 매칭 근거 JSONB (상세 정보 추가)
      jsonb_build_object(
        'algorithm', 'jaro_winkler',
        'sido_match', c.sido_match,
        'sido_score', CASE WHEN c.sido_match THEN 35 ELSE 0 END,
        'gugun_match', c.gugun_match,
        'gugun_score', CASE WHEN c.gugun_match THEN 35 ELSE 0 END,
        'mandatory_match', c.is_mandatory,
        'mandatory_score', CASE WHEN c.is_mandatory THEN 10 ELSE 0 END,
        'name_score', ROUND(c.name_score * 0.3, 2),
        'name_similarity', ROUND(c.name_score, 2),
        'aed_sido', c.aed_sido,
        'aed_gugun', c.aed_gugun,
        'aed_institution', c.aed_institution_name,
        'target_sido', c.sido,
        'target_gugun', c.gugun,
        'target_institution', c.institution_name,
        'target_division', c.division
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
  WHERE s.total_score >= 50.0  -- 50점 이상만 추천 (기준 유지)
  ORDER BY s.total_score DESC, s.name_score DESC
  LIMIT 5;  -- 상위 5개만
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_match_single_aed IS
  '개선된 자동 매칭 (Jaro-Winkler 유사도 적용): 시도(35) + 구군(35) + 의무기관(10) + 기관명유사도(30)';

-- ============================================
-- 4. 기존 매칭 데이터 재계산 (선택적 실행)
-- ============================================

-- 4-1. 백업 테이블 생성
CREATE TABLE IF NOT EXISTS management_number_group_mapping_backup_20251015 AS
SELECT * FROM management_number_group_mapping;

COMMENT ON TABLE management_number_group_mapping_backup_20251015 IS
  '2025-10-15 Jaro-Winkler 적용 전 백업';

-- 4-2. 매칭 데이터 초기화 (주의: 확정된 것은 유지)
-- UPDATE management_number_group_mapping
-- SET
--   auto_suggested_2024 = NULL,
--   auto_confidence_2024 = NULL,
--   auto_matching_reason_2024 = NULL
-- WHERE confirmed_2024 = FALSE OR confirmed_2024 IS NULL;

-- 4-3. 재매칭 실행은 별도 스크립트로 (시간 소요)
-- 사용 예시:
-- SELECT auto_match_batch(100, 70.0);  -- 100개씩, 70점 이상

-- ============================================
-- 5. 통계 확인 함수
-- ============================================

CREATE OR REPLACE FUNCTION get_matching_quality_stats()
RETURNS TABLE (
  confidence_level TEXT,
  count BIGINT,
  avg_confidence NUMERIC,
  percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      CASE
        WHEN auto_confidence_2024 >= 90 THEN 'high'
        WHEN auto_confidence_2024 >= 70 THEN 'medium'
        WHEN auto_confidence_2024 >= 50 THEN 'low'
        ELSE 'very_low'
      END as level,
      COUNT(*) as cnt,
      AVG(auto_confidence_2024) as avg_conf
    FROM management_number_group_mapping
    WHERE auto_confidence_2024 IS NOT NULL
    GROUP BY level
  ),
  total AS (
    SELECT SUM(cnt) as total_cnt FROM stats
  )
  SELECT
    s.level as confidence_level,
    s.cnt as count,
    ROUND(s.avg_conf, 2) as avg_confidence,
    ROUND((s.cnt::NUMERIC / t.total_cnt * 100), 2) as percentage
  FROM stats s, total t
  ORDER BY
    CASE s.level
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 3
      ELSE 4
    END;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_matching_quality_stats IS
  '매칭 품질 통계: 신뢰도별 건수 및 평균';

-- ============================================
-- 6. 샘플 매칭 테스트
-- ============================================

-- 테스트 실행 예시:
-- SELECT * FROM auto_match_single_aed('장비시리얼번호');

-- 낮은 신뢰도 케이스 재매칭 예시:
-- SELECT
--   m.management_number,
--   m.auto_confidence_2024 as old_score,
--   am.total_score as new_score,
--   am.target_key as new_target
-- FROM management_number_group_mapping m
-- CROSS JOIN LATERAL (
--   SELECT * FROM auto_match_single_aed(
--     (SELECT equipment_serial FROM aed_data WHERE management_number = m.management_number LIMIT 1)
--   ) LIMIT 1
-- ) am
-- WHERE m.auto_confidence_2024 < 70
-- ORDER BY (am.total_score - m.auto_confidence_2024) DESC
-- LIMIT 20;

-- ============================================
-- 7. 개선 효과 검증 쿼리
-- ============================================

\echo ''
\echo '==============================================='
\echo 'Jaro-Winkler 알고리즘 적용 완료!'
\echo '==============================================='
\echo ''
\echo '다음 단계:'
\echo '1. 샘플 테스트: SELECT * FROM auto_match_single_aed(''장비시리얼'');'
\echo '2. 품질 확인: SELECT * FROM get_matching_quality_stats();'
\echo '3. 재매칭 실행: SELECT auto_match_batch(100, 70.0);'
\echo ''
\echo '주요 개선사항:'
\echo '- Jaro-Winkler 유사도 알고리즘 적용'
\echo '- 가중치 조정: 시도(35) + 구군(35) + 의무기관(10) + 기관명(30)'
\echo '- 핵심 키워드 추출 및 보너스 점수'
\echo '- 부분 문자열 매칭 보너스'
\echo ''
\echo '목표: 평균 신뢰도 69.81점 → 80점 이상'
\echo '==============================================='

-- ============================================
-- 완료 로그
-- ============================================
-- schema_migrations 테이블이 없으므로 주석 처리
-- INSERT INTO public.schema_migrations (version, applied_at)
-- VALUES ('67_improve_matching_algorithm_jaro_winkler', NOW())
-- ON CONFLICT (version) DO NOTHING;
