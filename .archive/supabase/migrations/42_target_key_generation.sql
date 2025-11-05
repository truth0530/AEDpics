-- ============================================
-- Migration 42: target_key 자동 생성 및 본 테이블로 이동
-- 실행일: 2025-10-04
-- 전제조건: temp_target_import_2024에 CSV 데이터 업로드 완료
-- ============================================

-- ============================================
-- 1. 데이터 확인
-- ============================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM temp_target_import_2024;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'temp_target_import_2024 테이블이 비어있습니다. CSV 파일을 먼저 업로드하세요.';
  END IF;

  RAISE NOTICE '임시 테이블에 % 개 행이 있습니다.', v_count;
END $$;

-- ============================================
-- 2. target_key 자동 생성 및 본 테이블 삽입
-- ============================================

-- 기존 데이터 삭제 (재실행 시)
TRUNCATE target_list_2024;

-- target_key 생성 규칙:
-- target_keygroup + '_' + ROW_NUMBER() OVER (PARTITION BY target_keygroup ORDER BY no)
INSERT INTO target_list_2024 (
  target_key,
  no,
  sido,
  gugun,
  division,
  sub_division,
  institution_name,
  target_keygroup,
  management_number
)
SELECT
  target_keygroup || '_' || ROW_NUMBER() OVER (
    PARTITION BY target_keygroup
    ORDER BY no
  ) as target_key,
  no,
  sido,
  gugun,
  division,
  sub_division,
  institution_name,
  target_keygroup,
  NULL as management_number  -- 초기값 NULL
FROM temp_target_import_2024;

-- ============================================
-- 3. 결과 검증
-- ============================================

-- 전체 통계
DO $$
DECLARE
  v_total_count INTEGER;
  v_keygroup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_count FROM target_list_2024;
  SELECT COUNT(DISTINCT target_keygroup) INTO v_keygroup_count FROM target_list_2024;

  RAISE NOTICE '===============================================';
  RAISE NOTICE 'target_list_2024 데이터 업로드 완료';
  RAISE NOTICE '===============================================';
  RAISE NOTICE '총 기관 수: %', v_total_count;
  RAISE NOTICE '총 그룹 수: %', v_keygroup_count;
  RAISE NOTICE '===============================================';
END $$;

-- target_keygroup별 통계 (상위 10개)
\echo ''
\echo '=== target_keygroup별 기관 수 (상위 10개) ==='
SELECT
  target_keygroup,
  COUNT(*) as institution_count,
  MIN(target_key) as first_key,
  MAX(target_key) as last_key
FROM target_list_2024
GROUP BY target_keygroup
ORDER BY institution_count DESC
LIMIT 10;

-- 시도별 통계
\echo ''
\echo '=== 시도별 통계 ==='
SELECT
  sido,
  COUNT(*) as total_institutions,
  COUNT(DISTINCT target_keygroup) as total_groups
FROM target_list_2024
GROUP BY sido
ORDER BY total_institutions DESC;

-- 구분별 통계
\echo ''
\echo '=== 구분별 통계 ==='
SELECT
  division,
  sub_division,
  COUNT(*) as institution_count
FROM target_list_2024
GROUP BY division, sub_division
ORDER BY institution_count DESC
LIMIT 20;

-- 샘플 데이터 확인
\echo ''
\echo '=== 샘플 데이터 (첫 20개) ==='
SELECT
  target_key,
  sido,
  gugun,
  division,
  institution_name,
  target_keygroup
FROM target_list_2024
ORDER BY no
LIMIT 20;

-- ============================================
-- 4. 임시 테이블 삭제
-- ============================================
DROP TABLE IF EXISTS temp_target_import_2024;

\echo ''
\echo '==============================================='
\echo 'target_key 생성 완료!'
\echo '==============================================='
\echo ''
\echo '예시:'
\echo '  target_keygroup: "서울_중구_지역보건의료기관"'
\echo '  ├─ target_key: "서울_중구_지역보건의료기관_1"'
\echo '  ├─ target_key: "서울_중구_지역보건의료기관_2"'
\echo '  ├─ target_key: "서울_중구_지역보건의료기관_3"'
\echo '  └─ target_key: "서울_중구_지역보건의료기관_4"'
\echo ''
\echo '다음 단계: aed_data와 매칭 시작'
\echo '==============================================='

-- ============================================
-- 완료 로그
-- ============================================
INSERT INTO public.schema_migrations (version, applied_at)
VALUES ('42_target_key_generation', NOW())
ON CONFLICT (version) DO NOTHING;
