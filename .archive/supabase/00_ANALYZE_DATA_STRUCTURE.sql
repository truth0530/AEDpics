-- ============================================
-- aed_data 실제 데이터 구조 분석
-- ============================================

-- 1. 카테고리별 분포 및 관리번호 중복도 (category_1 기준)
SELECT
  category_1,
  COUNT(*) as aed_count,
  COUNT(DISTINCT management_number) as unique_mgmt_numbers,
  ROUND(100.0 * COUNT(DISTINCT management_number) / COUNT(*), 2) as uniqueness_rate
FROM aed_data
WHERE category_1 IS NOT NULL
GROUP BY category_1
ORDER BY aed_count DESC;

-- 2. category_1 상세 분포
SELECT
  category_1,
  category_2,
  COUNT(*) as aed_count,
  COUNT(DISTINCT management_number) as unique_mgmt_numbers,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM aed_data
GROUP BY category_1, category_2
ORDER BY aed_count DESC
LIMIT 30;

-- 3. 관리번호당 장비연번 개수 분포
SELECT
  equipment_per_mgmt,
  COUNT(*) as mgmt_number_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM (
  SELECT
    management_number,
    COUNT(*) as equipment_per_mgmt
  FROM aed_data
  WHERE management_number IS NOT NULL
  GROUP BY management_number
) sub
GROUP BY equipment_per_mgmt
ORDER BY equipment_per_mgmt;

-- 4. 관리번호가 NULL인 데이터 확인
SELECT
  COUNT(*) as null_mgmt_count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM aed_data), 2) as percentage
FROM aed_data
WHERE management_number IS NULL;

-- 5. 샘플: category_1별 샘플 추출
SELECT
  management_number,
  installation_institution,
  sido,
  gugun,
  category_1,
  category_2,
  COUNT(*) as equipment_count
FROM aed_data
WHERE management_number IS NOT NULL
GROUP BY management_number, installation_institution, sido, gugun, category_1, category_2
ORDER BY equipment_count DESC
LIMIT 30;

-- 6. 중복 관리번호 TOP 20 (1개 관리번호에 여러 장비)
SELECT
  management_number,
  installation_institution,
  sido,
  gugun,
  category_1,
  category_2,
  COUNT(*) as equipment_count
FROM aed_data
WHERE management_number IS NOT NULL
GROUP BY management_number, installation_institution, sido, gugun, category_1, category_2
HAVING COUNT(*) > 1
ORDER BY equipment_count DESC
LIMIT 20;
