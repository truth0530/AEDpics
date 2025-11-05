-- ============================================
-- Migration 47: 구비의무기관 매칭 관리 UI 지원 함수
-- 실행일: 2025-10-04
-- 목적: UI에서 매칭 목록을 조회하는 함수 제공
-- ⚠️ 주의: 모든 VARCHAR 컬럼에 명시적 ::VARCHAR 캐스팅 필수
-- ⚠️ 실제 스키마: installation_institution (NOT institution_name)
-- ⚠️ 실제 스키마: category_1, category_2, category_3 (NOT category)
-- ⚠️ 실제 스키마: management_number_group_mapping에는 modified_2024 컬럼이 없음!
--    → modified_by_2024, modified_at_2024만 존재
-- ============================================

-- 이전 버전 함수 삭제
DROP FUNCTION IF EXISTS get_target_matching_list_2024(VARCHAR, VARCHAR, VARCHAR, BOOLEAN);

-- ============================================
-- 1. UI용 매칭 목록 조회 함수
-- ============================================
-- 기능:
-- - 신뢰도별 필터링 (high: ≥90, medium: 70-89, low: <70, all: 전체)
-- - 지역별 필터링 (sido)
-- - 검색 기능 (기관명, 관리번호)
-- - 확정 여부 필터링
--
-- 사용 예제:
-- SELECT * FROM get_target_matching_list_2024('high', NULL, NULL, FALSE) LIMIT 10;
-- SELECT * FROM get_target_matching_list_2024('all', '서울특별시', NULL, FALSE);
-- SELECT * FROM get_target_matching_list_2024('all', NULL, '한국철도', FALSE);
-- ============================================

CREATE OR REPLACE FUNCTION get_target_matching_list_2024(
  p_confidence_level VARCHAR DEFAULT 'all',
  p_sido VARCHAR DEFAULT NULL,
  p_search VARCHAR DEFAULT NULL,
  p_confirmed_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  management_number VARCHAR,
  target_key_2024 VARCHAR,
  auto_suggested_2024 VARCHAR,
  auto_confidence_2024 NUMERIC,
  confirmed_2024 BOOLEAN,
  modified_by_2024 VARCHAR,
  modified_at_2024 TIMESTAMPTZ,
  aed_institution VARCHAR,
  target_institution VARCHAR,
  sido VARCHAR,
  gugun VARCHAR,
  aed_count BIGINT,
  matching_reason JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH aed_summary AS (
    -- management_number별로 AED 요약 정보 생성
    -- ⚠️ MAX() 함수는 TEXT를 반환하므로 ::VARCHAR 캐스팅 필수!
    SELECT
      a.management_number::VARCHAR,
      MAX(a.installation_institution)::VARCHAR as aed_institution,  -- ⚠️ ::VARCHAR 필수
      MAX(a.sido)::VARCHAR as sido,                                  -- ⚠️ ::VARCHAR 필수
      MAX(a.gugun)::VARCHAR as gugun,                                -- ⚠️ ::VARCHAR 필수
      COUNT(*) as aed_count
    FROM aed_data a
    WHERE a.management_number IS NOT NULL
    GROUP BY a.management_number
  )
  SELECT
    -- management_number_group_mapping 테이블 컬럼들
    m.management_number::VARCHAR,                    -- ⚠️ ::VARCHAR 필수
    m.target_key_2024::VARCHAR,                      -- ⚠️ ::VARCHAR 필수
    m.auto_suggested_2024::VARCHAR,                  -- ⚠️ ::VARCHAR 필수
    m.auto_confidence_2024,                          -- NUMERIC는 캐스팅 불필요
    m.confirmed_2024,                                -- BOOLEAN는 캐스팅 불필요

    -- ⚠️ modified_2024 컬럼은 존재하지 않음! 제거됨
    -- m.modified_2024,  -- ❌ 이 컬럼은 테이블에 없음!

    -- modified_by_2024는 UUID인데 VARCHAR로 캐스팅해야 함
    m.modified_by_2024::VARCHAR,                     -- ⚠️ UUID → VARCHAR 캐스팅
    m.modified_at_2024,                              -- TIMESTAMPTZ는 캐스팅 불필요

    -- aed_summary CTE에서 가져온 컬럼들 (이미 ::VARCHAR 캐스팅 완료)
    a.aed_institution::VARCHAR,                      -- ⚠️ ::VARCHAR 필수 (재캐스팅)

    -- target_list_2024 테이블 컬럼
    t.institution_name::VARCHAR as target_institution,  -- ⚠️ ::VARCHAR 필수

    -- aed_summary CTE에서 가져온 지역 정보
    a.sido::VARCHAR,                                 -- ⚠️ ::VARCHAR 필수 (재캐스팅)
    a.gugun::VARCHAR,                                -- ⚠️ ::VARCHAR 필수 (재캐스팅)

    -- AED 수량
    a.aed_count,                                     -- BIGINT는 캐스팅 불필요

    -- 매칭 이유
    m.auto_matching_reason_2024 as matching_reason   -- JSONB는 캐스팅 불필요

  FROM management_number_group_mapping m
  LEFT JOIN aed_summary a ON a.management_number = m.management_number
  LEFT JOIN target_list_2024 t ON t.target_key = COALESCE(m.target_key_2024, m.auto_suggested_2024)
  WHERE
    -- 필터 1: 신뢰도별 필터링
    (
      p_confidence_level = 'all' OR
      (p_confidence_level = 'high' AND m.auto_confidence_2024 >= 90) OR
      (p_confidence_level = 'medium' AND m.auto_confidence_2024 >= 70 AND m.auto_confidence_2024 < 90) OR
      (p_confidence_level = 'low' AND m.auto_confidence_2024 < 70)
    )
    -- 필터 2: 지역 필터링 (시도)
    AND (p_sido IS NULL OR a.sido = p_sido)
    -- 필터 3: 검색 필터링 (기관명, 관리번호)
    AND (
      p_search IS NULL OR
      a.aed_institution ILIKE '%' || p_search || '%' OR
      t.institution_name ILIKE '%' || p_search || '%' OR
      m.management_number ILIKE '%' || p_search || '%'
    )
    -- 필터 4: 확정 여부 필터링
    AND (NOT p_confirmed_only OR m.confirmed_2024 = TRUE)
  ORDER BY
    m.auto_confidence_2024 DESC NULLS LAST,  -- 신뢰도 높은 순
    a.aed_count DESC,                        -- AED 수량 많은 순
    m.management_number;                     -- 관리번호 순
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 권한 설정
-- ============================================
GRANT EXECUTE ON FUNCTION get_target_matching_list_2024(VARCHAR, VARCHAR, VARCHAR, BOOLEAN) TO authenticated;

-- ============================================
-- 함수 설명
-- ============================================
COMMENT ON FUNCTION get_target_matching_list_2024 IS
  '구비의무기관 매칭 관리 UI용 목록 조회 함수
  - 신뢰도별 필터링 (high/medium/low/all)
  - 지역별 필터링 (sido)
  - 검색 기능 (기관명, 관리번호)
  - 확정 여부 필터링
  - 반환: 50,010건의 management_number별 매칭 정보
  - ⚠️ 주의: modified_2024 컬럼 없음, modified_by_2024 (UUID)와 modified_at_2024만 있음';

-- ============================================
-- 테스트 쿼리
-- ============================================
-- 1. 고신뢰도 매칭 10건 조회
-- SELECT * FROM get_target_matching_list_2024('high', NULL, NULL, FALSE) LIMIT 10;

-- 2. 서울 지역 매칭 조회
-- SELECT * FROM get_target_matching_list_2024('all', '서울특별시', NULL, FALSE) LIMIT 10;

-- 3. 검색 테스트 (한국철도)
-- SELECT * FROM get_target_matching_list_2024('all', NULL, '한국철도', FALSE) LIMIT 10;

-- 4. 확정된 매칭만 조회
-- SELECT * FROM get_target_matching_list_2024('all', NULL, NULL, TRUE) LIMIT 10;

-- 5. 통계 확인
-- SELECT
--   CASE
--     WHEN auto_confidence_2024 >= 90 THEN 'high'
--     WHEN auto_confidence_2024 >= 70 THEN 'medium'
--     ELSE 'low'
--   END as level,
--   COUNT(*) as count
-- FROM management_number_group_mapping
-- GROUP BY level
-- ORDER BY level;

-- ============================================
-- 실제 스키마 확인 쿼리 (디버깅용)
-- ============================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'management_number_group_mapping'
-- ORDER BY ordinal_position;
