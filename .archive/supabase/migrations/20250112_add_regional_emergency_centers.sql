-- 17개 지역응급의료지원센터 추가
-- regional_emergency_center_admin 역할 추가

-- 1. OrganizationType에 'regional_emergency_center' 추가
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'organization_type'
  ) THEN
    CREATE TYPE organization_type AS ENUM ('ministry', 'emergency_center', 'regional_emergency_center', 'province', 'city', 'health_center');
  ELSE
    -- 이미 존재하는 경우 새 값 추가 시도
    BEGIN
      ALTER TYPE organization_type ADD VALUE IF NOT EXISTS 'regional_emergency_center';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 2. 중앙응급의료센터 (기존)
INSERT INTO organizations (name, type, region_code, city_code, address)
VALUES (
  '중앙응급의료센터',
  'emergency_center',
  'KR',
  NULL,
  '서울특별시 중구 을지로 245'
)
ON CONFLICT (name, region_code) DO NOTHING;

-- 3. 17개 지역응급의료지원센터 추가
INSERT INTO organizations (name, type, region_code, city_code, address)
VALUES
  -- 서울
  ('서울응급의료지원센터', 'regional_emergency_center', 'SEO', NULL, '서울특별시 중구 세종대로 110'),

  -- 부산
  ('부산응급의료지원센터', 'regional_emergency_center', 'BUS', NULL, '부산광역시 연제구 중앙대로 1001'),

  -- 대구
  ('대구응급의료지원센터', 'regional_emergency_center', 'DAE', NULL, '대구광역시 중구 국채보상로 680'),

  -- 인천
  ('인천응급의료지원센터', 'regional_emergency_center', 'INC', NULL, '인천광역시 남동구 정각로 29'),

  -- 광주
  ('광주응급의료지원센터', 'regional_emergency_center', 'GWA', NULL, '광주광역시 서구 내방로 111'),

  -- 대전
  ('대전응급의료지원센터', 'regional_emergency_center', 'DAJ', NULL, '대전광역시 서구 둔산로 100'),

  -- 울산
  ('울산응급의료지원센터', 'regional_emergency_center', 'ULS', NULL, '울산광역시 남구 중앙로 201'),

  -- 세종
  ('세종응급의료지원센터', 'regional_emergency_center', 'SEJ', NULL, '세종특별자치시 한누리대로 2130'),

  -- 경기
  ('경기응급의료지원센터', 'regional_emergency_center', 'GYE', NULL, '경기도 수원시 팔달구 효원로 1'),

  -- 강원
  ('강원응급의료지원센터', 'regional_emergency_center', 'GAN', NULL, '강원특별자치도 춘천시 중앙로 1'),

  -- 충북
  ('충북응급의료지원센터', 'regional_emergency_center', 'CHB', NULL, '충청북도 청주시 상당구 상당로 82'),

  -- 충남
  ('충남응급의료지원센터', 'regional_emergency_center', 'CHN', NULL, '충청남도 홍성군 홍북읍 충남대로 21'),

  -- 전북
  ('전북응급의료지원센터', 'regional_emergency_center', 'JEB', NULL, '전북특별자치도 전주시 완산구 효자로 225'),

  -- 전남
  ('전남응급의료지원센터', 'regional_emergency_center', 'JEN', NULL, '전라남도 무안군 삼향읍 오룡길 1'),

  -- 경북
  ('경북응급의료지원센터', 'regional_emergency_center', 'GYB', NULL, '경상북도 안동시 풍천면 도청대로 455'),

  -- 경남
  ('경남응급의료지원센터', 'regional_emergency_center', 'GYN', NULL, '경상남도 창원시 의창구 중앙대로 300'),

  -- 제주
  ('제주응급의료지원센터', 'regional_emergency_center', 'JEJ', NULL, '제주특별자치도 제주시 문연로 6')
ON CONFLICT (name, region_code) DO NOTHING;

-- 4. 확인 쿼리
SELECT name, type, region_code, address
FROM organizations
WHERE type IN ('emergency_center', 'regional_emergency_center')
ORDER BY region_code;
