-- Region Code 데이터 마이그레이션
-- 한글 지역명을 코드 형식으로 변환 (서울 → SEO, 부산 → BUS 등)

-- 1. user_profiles 테이블 region_code 업데이트
UPDATE user_profiles
SET region_code = CASE
  -- 서울
  WHEN region_code IN ('서울', '서울특별시', '서울시') THEN 'SEO'

  -- 부산
  WHEN region_code IN ('부산', '부산광역시', '부산시') THEN 'BUS'

  -- 대구
  WHEN region_code IN ('대구', '대구광역시', '대구시') THEN 'DAE'

  -- 인천
  WHEN region_code IN ('인천', '인천광역시', '인천시') THEN 'INC'

  -- 광주
  WHEN region_code IN ('광주', '광주광역시', '광주시') THEN 'GWA'

  -- 대전
  WHEN region_code IN ('대전', '대전광역시', '대전시') THEN 'DAJ'

  -- 울산
  WHEN region_code IN ('울산', '울산광역시', '울산시') THEN 'ULS'

  -- 세종
  WHEN region_code IN ('세종', '세종특별자치시', '세종시') THEN 'SEJ'

  -- 경기
  WHEN region_code IN ('경기', '경기도') THEN 'GYE'

  -- 강원
  WHEN region_code IN ('강원', '강원특별자치도', '강원도', '강원특별도') THEN 'GAN'

  -- 충북
  WHEN region_code IN ('충북', '충청북도', '충북도') THEN 'CHB'

  -- 충남
  WHEN region_code IN ('충남', '충청남도', '충남도') THEN 'CHN'

  -- 전북
  WHEN region_code IN ('전북', '전북특별자치도', '전라북도', '전북도', '전북특별도') THEN 'JEB'

  -- 전남
  WHEN region_code IN ('전남', '전라남도', '전남도') THEN 'JEN'

  -- 경북
  WHEN region_code IN ('경북', '경상북도', '경북도') THEN 'GYB'

  -- 경남
  WHEN region_code IN ('경남', '경상남도', '경남도') THEN 'GYN'

  -- 제주
  WHEN region_code IN ('제주', '제주특별자치도', '제주도', '제주시') THEN 'JEJ'

  -- 중앙
  WHEN region_code IN ('중앙', '전국') THEN 'KR'

  -- 이미 코드 형식이면 그대로 유지
  ELSE region_code
END
WHERE region_code IS NOT NULL
  AND region_code NOT IN ('SEO', 'BUS', 'DAE', 'INC', 'GWA', 'DAJ', 'ULS', 'SEJ',
                          'GYE', 'GAN', 'CHB', 'CHN', 'JEB', 'JEN', 'GYB', 'GYN', 'JEJ', 'KR');

-- 2. organizations 테이블 region_code 업데이트
UPDATE organizations
SET region_code = CASE
  WHEN region_code IN ('서울', '서울특별시', '서울시') THEN 'SEO'
  WHEN region_code IN ('부산', '부산광역시', '부산시') THEN 'BUS'
  WHEN region_code IN ('대구', '대구광역시', '대구시') THEN 'DAE'
  WHEN region_code IN ('인천', '인천광역시', '인천시') THEN 'INC'
  WHEN region_code IN ('광주', '광주광역시', '광주시') THEN 'GWA'
  WHEN region_code IN ('대전', '대전광역시', '대전시') THEN 'DAJ'
  WHEN region_code IN ('울산', '울산광역시', '울산시') THEN 'ULS'
  WHEN region_code IN ('세종', '세종특별자치시', '세종시') THEN 'SEJ'
  WHEN region_code IN ('경기', '경기도') THEN 'GYE'
  WHEN region_code IN ('강원', '강원특별자치도', '강원도', '강원특별도') THEN 'GAN'
  WHEN region_code IN ('충북', '충청북도', '충북도') THEN 'CHB'
  WHEN region_code IN ('충남', '충청남도', '충남도') THEN 'CHN'
  WHEN region_code IN ('전북', '전북특별자치도', '전라북도', '전북도', '전북특별도') THEN 'JEB'
  WHEN region_code IN ('전남', '전라남도', '전남도') THEN 'JEN'
  WHEN region_code IN ('경북', '경상북도', '경북도') THEN 'GYB'
  WHEN region_code IN ('경남', '경상남도', '경남도') THEN 'GYN'
  WHEN region_code IN ('제주', '제주특별자치도', '제주도', '제주시') THEN 'JEJ'
  WHEN region_code IN ('중앙', '전국') THEN 'KR'
  ELSE region_code
END
WHERE region_code IS NOT NULL
  AND region_code NOT IN ('SEO', 'BUS', 'DAE', 'INC', 'GWA', 'DAJ', 'ULS', 'SEJ',
                          'GYE', 'GAN', 'CHB', 'CHN', 'JEB', 'JEN', 'GYB', 'GYN', 'JEJ', 'KR');

-- 3. aed_data 테이블 region_code 업데이트 (있는 경우)
UPDATE aed_data
SET region_code = CASE
  WHEN region_code IN ('서울', '서울특별시', '서울시') THEN 'SEO'
  WHEN region_code IN ('부산', '부산광역시', '부산시') THEN 'BUS'
  WHEN region_code IN ('대구', '대구광역시', '대구시') THEN 'DAE'
  WHEN region_code IN ('인천', '인천광역시', '인천시') THEN 'INC'
  WHEN region_code IN ('광주', '광주광역시', '광주시') THEN 'GWA'
  WHEN region_code IN ('대전', '대전광역시', '대전시') THEN 'DAJ'
  WHEN region_code IN ('울산', '울산광역시', '울산시') THEN 'ULS'
  WHEN region_code IN ('세종', '세종특별자치시', '세종시') THEN 'SEJ'
  WHEN region_code IN ('경기', '경기도') THEN 'GYE'
  WHEN region_code IN ('강원', '강원특별자치도', '강원도', '강원특별도') THEN 'GAN'
  WHEN region_code IN ('충북', '충청북도', '충북도') THEN 'CHB'
  WHEN region_code IN ('충남', '충청남도', '충남도') THEN 'CHN'
  WHEN region_code IN ('전북', '전북특별자치도', '전라북도', '전북도', '전북특별도') THEN 'JEB'
  WHEN region_code IN ('전남', '전라남도', '전남도') THEN 'JEN'
  WHEN region_code IN ('경북', '경상북도', '경북도') THEN 'GYB'
  WHEN region_code IN ('경남', '경상남도', '경남도') THEN 'GYN'
  WHEN region_code IN ('제주', '제주특별자치도', '제주도', '제주시') THEN 'JEJ'
  WHEN region_code IN ('중앙', '전국') THEN 'KR'
  ELSE region_code
END
WHERE region_code IS NOT NULL
  AND region_code NOT IN ('SEO', 'BUS', 'DAE', 'INC', 'GWA', 'DAJ', 'ULS', 'SEJ',
                          'GYE', 'GAN', 'CHB', 'CHN', 'JEB', 'JEN', 'GYB', 'GYN', 'JEJ', 'KR');

-- 4. 마이그레이션 결과 확인용 함수
CREATE OR REPLACE FUNCTION check_region_code_migration()
RETURNS TABLE (
  table_name TEXT,
  total_count BIGINT,
  code_format_count BIGINT,
  korean_format_count BIGINT,
  null_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- user_profiles 체크
  RETURN QUERY
  SELECT
    'user_profiles'::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE region_code ~ '^[A-Z]{2,3}$')::BIGINT,
    COUNT(*) FILTER (WHERE region_code !~ '^[A-Z]{2,3}$' AND region_code IS NOT NULL)::BIGINT,
    COUNT(*) FILTER (WHERE region_code IS NULL)::BIGINT
  FROM user_profiles;

  -- organizations 체크
  RETURN QUERY
  SELECT
    'organizations'::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE region_code ~ '^[A-Z]{2,3}$')::BIGINT,
    COUNT(*) FILTER (WHERE region_code !~ '^[A-Z]{2,3}$' AND region_code IS NOT NULL)::BIGINT,
    COUNT(*) FILTER (WHERE region_code IS NULL)::BIGINT
  FROM organizations;

  -- aed_data 체크 (테이블이 존재하는 경우)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'aed_data') THEN
    RETURN QUERY
    SELECT
      'aed_data'::TEXT,
      COUNT(*)::BIGINT,
      COUNT(*) FILTER (WHERE region_code ~ '^[A-Z]{2,3}$')::BIGINT,
      COUNT(*) FILTER (WHERE region_code !~ '^[A-Z]{2,3}$' AND region_code IS NOT NULL)::BIGINT,
      COUNT(*) FILTER (WHERE region_code IS NULL)::BIGINT
    FROM aed_data;
  END IF;
END;
$$;

-- 마이그레이션 후 확인 실행
-- SELECT * FROM check_region_code_migration();

COMMENT ON FUNCTION check_region_code_migration IS '마이그레이션 결과 확인: 코드 형식과 한글 형식 개수 체크';
