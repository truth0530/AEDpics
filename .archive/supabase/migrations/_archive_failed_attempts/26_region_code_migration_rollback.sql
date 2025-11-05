-- Region Code 마이그레이션 롤백 스크립트
-- 주의: 이 스크립트는 마이그레이션 전 백업이 있을 때만 사용

-- 롤백은 백업에서 복원하는 것을 권장
-- 이 스크립트는 긴급 상황에서만 사용

-- 1. 코드를 다시 한글로 변환 (권장하지 않음)
/*
UPDATE user_profiles
SET region_code = CASE
  WHEN region_code = 'SEO' THEN '서울'
  WHEN region_code = 'BUS' THEN '부산'
  WHEN region_code = 'DAE' THEN '대구'
  WHEN region_code = 'INC' THEN '인천'
  WHEN region_code = 'GWA' THEN '광주'
  WHEN region_code = 'DAJ' THEN '대전'
  WHEN region_code = 'ULS' THEN '울산'
  WHEN region_code = 'SEJ' THEN '세종'
  WHEN region_code = 'GYE' THEN '경기'
  WHEN region_code = 'GAN' THEN '강원'
  WHEN region_code = 'CHB' THEN '충북'
  WHEN region_code = 'CHN' THEN '충남'
  WHEN region_code = 'JEB' THEN '전북'
  WHEN region_code = 'JEN' THEN '전남'
  WHEN region_code = 'GYB' THEN '경북'
  WHEN region_code = 'GYN' THEN '경남'
  WHEN region_code = 'JEJ' THEN '제주'
  WHEN region_code = 'KR' THEN '중앙'
  ELSE region_code
END;
*/

-- 2. 백업에서 복원 (권장)
-- pg_restore 사용 또는 Supabase Studio의 백업 기능 사용

-- 롤백 확인 쿼리
SELECT
  'user_profiles' as table_name,
  region_code,
  COUNT(*) as count
FROM user_profiles
WHERE region_code IS NOT NULL
GROUP BY region_code
ORDER BY count DESC;

COMMENT ON FUNCTION check_region_code_migration IS '⚠️ 이 롤백 스크립트는 긴급 상황에서만 사용. 백업 복원을 권장합니다.';
