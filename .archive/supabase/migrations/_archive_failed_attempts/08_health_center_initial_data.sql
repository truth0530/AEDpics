-- 초기 보건소 데이터 마이그레이션
-- 기존 aed_data에서 보건소 정보를 추출하여 마스터 테이블 생성
-- 2025-09-15 작성

-- 1. 기존 aed_data에서 유니크한 보건소 추출 및 마스터 데이터 생성
INSERT INTO public.health_centers (code, canonical_name, sido, gugun)
SELECT DISTINCT ON (jurisdiction_health_center, sido, gugun)
    -- 코드 생성: HC_시도_구군 형식
    'HC_' || 
    UPPER(REPLACE(REPLACE(COALESCE(sido, 'UNKNOWN'), ' ', ''), '특별', '')) || '_' ||
    UPPER(REPLACE(REPLACE(COALESCE(gugun, SPLIT_PART(jurisdiction_health_center, ' ', 1)), ' ', ''), '구', '')) AS code,
    
    -- 표준 명칭 생성
    CASE 
        WHEN sido = '서울' THEN '서울특별시 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        WHEN sido = '부산' THEN '부산광역시 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        WHEN sido = '대구' THEN '대구광역시 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        WHEN sido = '인천' THEN '인천광역시 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        WHEN sido = '광주' THEN '광주광역시 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        WHEN sido = '대전' THEN '대전광역시 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        WHEN sido = '울산' THEN '울산광역시 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        WHEN sido = '세종' THEN '세종특별자치시 ' || jurisdiction_health_center
        WHEN sido = '경기' THEN '경기도 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        WHEN sido = '강원' THEN '강원특별자치도 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        WHEN sido = '충북' THEN '충청북도 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        WHEN sido = '충남' THEN '충청남도 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        WHEN sido = '전북' THEN '전라북도 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        WHEN sido = '전남' THEN '전라남도 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        WHEN sido = '경북' THEN '경상북도 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        WHEN sido = '경남' THEN '경상남도 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        WHEN sido = '제주' THEN '제주특별자치도 ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
        ELSE COALESCE(sido, '') || ' ' || COALESCE(gugun, '') || ' ' || jurisdiction_health_center
    END AS canonical_name,
    
    sido,
    gugun
FROM public.aed_data
WHERE jurisdiction_health_center IS NOT NULL
  AND jurisdiction_health_center != ''
ON CONFLICT (code) DO NOTHING;

-- 2. 별칭 데이터 생성 (원본 명칭 및 변형)
INSERT INTO public.health_center_aliases (health_center_id, alias_name, alias_type)
SELECT DISTINCT
    hc.id,
    ad.jurisdiction_health_center,
    'original'
FROM public.aed_data ad
JOIN public.health_centers hc ON 
    hc.sido = ad.sido 
    AND (hc.gugun = ad.gugun OR (hc.gugun IS NULL AND ad.gugun IS NULL))
WHERE ad.jurisdiction_health_center IS NOT NULL
  AND ad.jurisdiction_health_center != ''
ON CONFLICT (health_center_id, alias_name) DO NOTHING;

-- 3. 공백 제거 버전 별칭 추가
INSERT INTO public.health_center_aliases (health_center_id, alias_name, alias_type)
SELECT DISTINCT
    hc.id,
    REPLACE(ad.jurisdiction_health_center, ' ', ''),
    'variation'
FROM public.aed_data ad
JOIN public.health_centers hc ON 
    hc.sido = ad.sido 
    AND (hc.gugun = ad.gugun OR (hc.gugun IS NULL AND ad.gugun IS NULL))
WHERE ad.jurisdiction_health_center IS NOT NULL
  AND ad.jurisdiction_health_center != ''
  AND ad.jurisdiction_health_center LIKE '% %'
ON CONFLICT (health_center_id, alias_name) DO NOTHING;

-- 4. 시도명 제거 버전 별칭 추가 (예: "서울특별시 강남구보건소" -> "강남구보건소")
INSERT INTO public.health_center_aliases (health_center_id, alias_name, alias_type)
SELECT DISTINCT
    hc.id,
    CASE 
        WHEN gugun IS NOT NULL THEN gugun || jurisdiction_health_center
        ELSE jurisdiction_health_center
    END,
    'short'
FROM public.aed_data ad
JOIN public.health_centers hc ON 
    hc.sido = ad.sido 
    AND (hc.gugun = ad.gugun OR (hc.gugun IS NULL AND ad.gugun IS NULL))
WHERE ad.jurisdiction_health_center IS NOT NULL
  AND ad.jurisdiction_health_center != ''
  AND ad.jurisdiction_health_center NOT LIKE '%' || ad.gugun || '%'
ON CONFLICT (health_center_id, alias_name) DO NOTHING;

-- 5. aed_data 테이블에 health_center_id 업데이트
UPDATE public.aed_data ad
SET health_center_id = hc.id
FROM public.health_centers hc
WHERE hc.sido = ad.sido 
  AND (hc.gugun = ad.gugun OR (hc.gugun IS NULL AND ad.gugun IS NULL))
  AND ad.health_center_id IS NULL;

-- 6. 통계 확인
DO $$
DECLARE
    total_centers INTEGER;
    total_aliases INTEGER;
    matched_aed INTEGER;
    unmatched_aed INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_centers FROM public.health_centers;
    SELECT COUNT(*) INTO total_aliases FROM public.health_center_aliases;
    SELECT COUNT(*) INTO matched_aed FROM public.aed_data WHERE health_center_id IS NOT NULL;
    SELECT COUNT(*) INTO unmatched_aed FROM public.aed_data WHERE health_center_id IS NULL AND jurisdiction_health_center IS NOT NULL;
    
    RAISE NOTICE '보건소 마이그레이션 완료';
    RAISE NOTICE '- 생성된 보건소: %', total_centers;
    RAISE NOTICE '- 생성된 별칭: %', total_aliases;
    RAISE NOTICE '- 매칭된 AED: %', matched_aed;
    RAISE NOTICE '- 미매칭 AED: %', unmatched_aed;
END $$;

-- 7. 테스트 쿼리
-- 보건소별 AED 수 확인
SELECT 
    hc.canonical_name,
    COUNT(ad.id) as aed_count
FROM public.health_centers hc
LEFT JOIN public.aed_data ad ON ad.health_center_id = hc.id
GROUP BY hc.canonical_name
ORDER BY aed_count DESC
LIMIT 10;

COMMENT ON FUNCTION find_health_center_id IS '다양한 형태의 보건소명으로 ID를 찾는 fuzzy matching 함수';