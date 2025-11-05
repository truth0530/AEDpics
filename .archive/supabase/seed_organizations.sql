-- 기본 조직 데이터 시딩
-- organizations 테이블에 보건소 및 주요 기관 데이터 추가

-- 기존 데이터 삭제 (필요시)
-- DELETE FROM organizations;

-- 서울특별시 보건소
INSERT INTO organizations (name, type, region, region_code, city_code, contact_phone, contact_email, address, is_active)
VALUES
('서울특별시 강남구보건소', 'health_center', '서울', 'SEO', '강남구', '02-3423-7200', NULL, '서울특별시 강남구 선릉로 668', true),
('서울특별시 강동구보건소', 'health_center', '서울', 'SEO', '강동구', '02-3425-8500', NULL, '서울특별시 강동구 성내로 45', true),
('서울특별시 강북구보건소', 'health_center', '서울', 'SEO', '강북구', '02-901-7600', NULL, '서울특별시 강북구 한천로 897', true),
('서울특별시 강서구보건소', 'health_center', '서울', 'SEO', '강서구', '02-2600-5800', NULL, '서울특별시 강서구 공항대로 561', true),
('서울특별시 관악구보건소', 'health_center', '서울', 'SEO', '관악구', '02-879-7010', NULL, '서울특별시 관악구 관악로 145', true),
('서울특별시 광진구보건소', 'health_center', '서울', 'SEO', '광진구', '02-450-1570', NULL, '서울특별시 광진구 자양로 117', true),
('서울특별시 구로구보건소', 'health_center', '서울', 'SEO', '구로구', '02-860-3200', NULL, '서울특별시 구로구 구로중앙로 28길 66', true),
('서울특별시 금천구보건소', 'health_center', '서울', 'SEO', '금천구', '02-2627-2114', NULL, '서울특별시 금천구 시흥대로73길 70', true),
('서울특별시 노원구보건소', 'health_center', '서울', 'SEO', '노원구', '02-2116-3115', NULL, '서울특별시 노원구 노해로 437', true),
('서울특별시 도봉구보건소', 'health_center', '서울', 'SEO', '도봉구', '02-2091-4600', NULL, '서울특별시 도봉구 방학로3길 117', true),
('서울특별시 동대문구보건소', 'health_center', '서울', 'SEO', '동대문구', '02-2127-5000', NULL, '서울특별시 동대문구 홍릉로 81', true),
('서울특별시 동작구보건소', 'health_center', '서울', 'SEO', '동작구', '02-820-1423', NULL, '서울특별시 동작구 장승배기로10길 42', true),
('서울특별시 마포구보건소', 'health_center', '서울', 'SEO', '마포구', '02-3153-9020', NULL, '서울특별시 마포구 월드컵로 212', true),
('서울특별시 서대문구보건소', 'health_center', '서울', 'SEO', '서대문구', '02-330-1801', NULL, '서울특별시 서대문구 연희로 242', true),
('서울특별시 서초구보건소', 'health_center', '서울', 'SEO', '서초구', '02-2155-8000', NULL, '서울특별시 서초구 남부순환로 2584', true),
('서울특별시 성동구보건소', 'health_center', '서울', 'SEO', '성동구', '02-2286-7000', NULL, '서울특별시 성동구 마장로 23길 10', true),
('서울특별시 성북구보건소', 'health_center', '서울', 'SEO', '성북구', '02-2241-1740', NULL, '서울특별시 성북구 화랑로 63', true),
('서울특별시 송파구보건소', 'health_center', '서울', 'SEO', '송파구', '02-2147-3420', NULL, '서울특별시 송파구 올림픽로 326', true),
('서울특별시 양천구보건소', 'health_center', '서울', 'SEO', '양천구', '02-2620-3114', NULL, '서울특별시 양천구 목동동로 105', true),
('서울특별시 영등포구보건소', 'health_center', '서울', 'SEO', '영등포구', '02-2670-3114', NULL, '서울특별시 영등포구 당산로 123', true),
('서울특별시 용산구보건소', 'health_center', '서울', 'SEO', '용산구', '02-2199-8090', NULL, '서울특별시 용산구 녹사평대로 150', true),
('서울특별시 은평구보건소', 'health_center', '서울', 'SEO', '은평구', '02-351-8114', NULL, '서울특별시 은평구 은평로 195', true),
('서울특별시 종로구보건소', 'health_center', '서울', 'SEO', '종로구', '02-2148-3500', NULL, '서울특별시 종로구 자하문로19길 36', true),
('서울특별시 중구보건소', 'health_center', '서울', 'SEO', '중구', '02-3396-4000', NULL, '서울특별시 중구 다산로 39길 16', true),
('서울특별시 중랑구보건소', 'health_center', '서울', 'SEO', '중랑구', '02-2094-0700', NULL, '서울특별시 중랑구 봉화산로 179', true)
ON CONFLICT (name) DO UPDATE SET
  type = EXCLUDED.type,
  region = EXCLUDED.region,
  region_code = EXCLUDED.region_code,
  city_code = EXCLUDED.city_code,
  contact_phone = EXCLUDED.contact_phone,
  address = EXCLUDED.address,
  is_active = EXCLUDED.is_active;

-- 부산광역시 보건소 (일부)
INSERT INTO organizations (name, type, region, region_code, city_code, contact_phone, contact_email, address, is_active)
VALUES
('부산광역시 중구보건소', 'health_center', '부산', 'BUS', '중구', '051-600-4741', NULL, '부산광역시 중구 중구로 120', true),
('부산광역시 서구보건소', 'health_center', '부산', 'BUS', '서구', '051-240-4000', NULL, '부산광역시 서구 부용로 30', true),
('부산광역시 동구보건소', 'health_center', '부산', 'BUS', '동구', '051-440-4000', NULL, '부산광역시 동구 구청로1', true),
('부산광역시 영도구보건소', 'health_center', '부산', 'BUS', '영도구', '051-419-4000', NULL, '부산광역시 영도구 태종로 423', true),
('부산광역시 부산진구보건소', 'health_center', '부산', 'BUS', '부산진구', '051-645-4000', NULL, '부산광역시 부산진구 황령대로 8번길 36', true),
('부산광역시 동래구보건소', 'health_center', '부산', 'BUS', '동래구', '051-555-4000', NULL, '부산광역시 동래구 명륜로187번길 56', true),
('부산광역시 남구보건소', 'health_center', '부산', 'BUS', '남구', '051-607-4000', NULL, '부산광역시 남구 못골로 23', true),
('부산광역시 북구보건소', 'health_center', '부산', 'BUS', '북구', '051-309-4500', NULL, '부산광역시 북구 금곡대로 348', true),
('부산광역시 해운대구보건소', 'health_center', '부산', 'BUS', '해운대구', '051-749-4000', NULL, '부산광역시 해운대구 중동2로 11', true),
('부산광역시 사하구보건소', 'health_center', '부산', 'BUS', '사하구', '051-220-5701', NULL, '부산광역시 사하구 하신중앙로 205', true),
('부산광역시 금정구보건소', 'health_center', '부산', 'BUS', '금정구', '051-519-4000', NULL, '부산광역시 금정구 중앙대로 1777', true),
('부산광역시 강서구보건소', 'health_center', '부산', 'BUS', '강서구', '051-970-4000', NULL, '부산광역시 강서구 공항로811번길 10', true),
('부산광역시 연제구보건소', 'health_center', '부산', 'BUS', '연제구', '051-665-4000', NULL, '부산광역시 연제구 연제로 2', true),
('부산광역시 수영구보건소', 'health_center', '부산', 'BUS', '수영구', '051-752-4000', NULL, '부산광역시 수영구 수영로 637-5', true),
('부산광역시 사상구보건소', 'health_center', '부산', 'BUS', '사상구', '051-310-4791', NULL, '부산광역시 사상구 학감대로 242', true),
('부산광역시 기장군보건소', 'health_center', '부산', 'BUS', '기장군', '051-709-4796', NULL, '부산광역시 기장군 기장읍 기장대로 560', true)
ON CONFLICT (name) DO UPDATE SET
  type = EXCLUDED.type,
  region = EXCLUDED.region,
  region_code = EXCLUDED.region_code,
  city_code = EXCLUDED.city_code,
  contact_phone = EXCLUDED.contact_phone,
  address = EXCLUDED.address,
  is_active = EXCLUDED.is_active;

-- 시도 응급의료지원센터
INSERT INTO organizations (name, type, region, region_code, city_code, contact_phone, contact_email, address, is_active)
VALUES
('서울특별시 응급의료지원센터', 'emergency_center', '서울', 'SEO', NULL, '02-6953-7581', NULL, '서울특별시 중구 을지로 245', true),
('부산광역시 응급의료지원센터', 'emergency_center', '부산', 'BUS', NULL, '051-253-7119', NULL, '부산광역시 연제구 월드컵대로 359', true),
('대구광역시 응급의료지원센터', 'emergency_center', '대구', 'DAE', NULL, '053-320-0119', NULL, '대구광역시 중구 동덕로 200', true),
('인천광역시 응급의료지원센터', 'emergency_center', '인천', 'INC', NULL, '032-278-0119', NULL, '인천광역시 남동구 남동대로 774번길 21', true),
('광주광역시 응급의료지원센터', 'emergency_center', '광주', 'GWA', NULL, '062-613-1339', NULL, '광주광역시 서구 내방로 111', true),
('대전광역시 응급의료지원센터', 'emergency_center', '대전', 'DAJ', NULL, '042-280-7031', NULL, '대전광역시 서구 둔산로 100', true),
('울산광역시 응급의료지원센터', 'emergency_center', '울산', 'ULS', NULL, '052-290-4280', NULL, '울산광역시 남구 대학로 93', true),
('세종특별자치시 응급의료지원센터', 'emergency_center', '세종', 'SEJ', NULL, '044-300-5790', NULL, '세종특별자치시 한누리대로 2130', true),
('경기도 응급의료지원센터', 'emergency_center', '경기', 'GYE', NULL, '031-888-5119', NULL, '경기도 수원시 장안구 조원로 18', true),
('강원특별자치도 응급의료지원센터', 'emergency_center', '강원', 'GAN', NULL, '033-260-1566', NULL, '강원특별자치도 춘천시 백령로 156', true),
('충청북도 응급의료지원센터', 'emergency_center', '충북', 'CHB', NULL, '043-278-0119', NULL, '충청북도 청주시 흥덕구 무심동로 410', true),
('충청남도 응급의료지원센터', 'emergency_center', '충남', 'CHN', NULL, '041-635-1339', NULL, '충청남도 홍성군 홍북읍 충남대로 21', true),
('전라북도 응급의료지원센터', 'emergency_center', '전북', 'JEB', NULL, '063-280-7031', NULL, '전북특별자치도 전주시 완산구 흥산로 111', true),
('전라남도 응급의료지원센터', 'emergency_center', '전남', 'JEN', NULL, '061-287-8821', NULL, '전라남도 무안군 삼향읍 오룡길 1', true),
('경상북도 응급의료지원센터', 'emergency_center', '경북', 'GYB', NULL, '054-880-8911', NULL, '경상북도 안동시 풍천면 도청대로 455', true),
('경상남도 응급의료지원센터', 'emergency_center', '경남', 'GYN', NULL, '055-211-7981', NULL, '경상남도 창원시 의창구 중앙대로 300', true),
('제주특별자치도 응급의료지원센터', 'emergency_center', '제주', 'JEJ', NULL, '064-710-2911', NULL, '제주특별자치도 제주시 문연로 6', true)
ON CONFLICT (name) DO UPDATE SET
  type = EXCLUDED.type,
  region = EXCLUDED.region,
  region_code = EXCLUDED.region_code,
  city_code = EXCLUDED.city_code,
  contact_phone = EXCLUDED.contact_phone,
  address = EXCLUDED.address,
  is_active = EXCLUDED.is_active;

-- 중앙 기관
INSERT INTO organizations (name, type, region, region_code, city_code, contact_phone, contact_email, address, is_active)
VALUES
('중앙응급의료센터', 'emergency_center', '중앙', 'KR', NULL, '02-6362-3456', NULL, '서울특별시 중구 을지로 245', true),
('보건복지부', 'government', '중앙', 'KR', NULL, '129', NULL, '세종특별자치시 도움4로 13', true)
ON CONFLICT (name) DO UPDATE SET
  type = EXCLUDED.type,
  region = EXCLUDED.region,
  region_code = EXCLUDED.region_code,
  city_code = EXCLUDED.city_code,
  contact_phone = EXCLUDED.contact_phone,
  address = EXCLUDED.address,
  is_active = EXCLUDED.is_active;

-- 대구광역시 보건소 (일부)
INSERT INTO organizations (name, type, region, region_code, city_code, contact_phone, contact_email, address, is_active)
VALUES
('대구광역시 중구보건소', 'health_center', '대구', 'DAE', '중구', '053-661-3121', NULL, '대구광역시 중구 태평로 45', true),
('대구광역시 동구보건소', 'health_center', '대구', 'DAE', '동구', '053-662-3201', NULL, '대구광역시 동구 동촌로 79', true),
('대구광역시 서구보건소', 'health_center', '대구', 'DAE', '서구', '053-663-3111', NULL, '대구광역시 서구 국채보상로 257', true),
('대구광역시 남구보건소', 'health_center', '대구', 'DAE', '남구', '053-664-3601', NULL, '대구광역시 남구 영선길 34', true),
('대구광역시 북구보건소', 'health_center', '대구', 'DAE', '북구', '053-665-3201', NULL, '대구광역시 북구 성북로 49', true),
('대구광역시 수성구보건소', 'health_center', '대구', 'DAE', '수성구', '053-666-3111', NULL, '대구광역시 수성구 수성로 213', true),
('대구광역시 달서구보건소', 'health_center', '대구', 'DAE', '달서구', '053-667-5611', NULL, '대구광역시 달서구 학산로 45', true),
('대구광역시 달성군보건소', 'health_center', '대구', 'DAE', '달성군', '053-668-3001', NULL, '대구광역시 달성군 현풍읍 비슬로130길 17', true)
ON CONFLICT (name) DO UPDATE SET
  type = EXCLUDED.type,
  region = EXCLUDED.region,
  region_code = EXCLUDED.region_code,
  city_code = EXCLUDED.city_code,
  contact_phone = EXCLUDED.contact_phone,
  address = EXCLUDED.address,
  is_active = EXCLUDED.is_active;

-- 총 조직 수 확인
SELECT
  region_code,
  type,
  COUNT(*) as count
FROM organizations
GROUP BY region_code, type
ORDER BY region_code, type;