-- Gwangju gugun 정규화 스크립트
-- target_list_2025에서 "광주시"를 실제 구(gugun)로 수정

BEGIN TRANSACTION;

-- 수정 전 상태 확인
SELECT COUNT(*) as before_count FROM aedpics.target_list_2025 WHERE sido = '광주광역시' AND gugun = '광주시';

-- address 주소로부터 구 추출하여 업데이트
UPDATE aedpics.target_list_2025
SET gugun = CASE
  -- 서구 포함 주소
  WHEN address LIKE '%서구%' THEN '서구'
  -- 동구 포함 주소
  WHEN address LIKE '%동구%' THEN '동구'
  -- 남구 포함 주소
  WHEN address LIKE '%남구%' THEN '남구'
  -- 북구 포함 주소
  WHEN address LIKE '%북구%' THEN '북구'
  -- 광산구 포함 주소
  WHEN address LIKE '%광산구%' THEN '광산구'
  -- 매칭되지 않은 경우 기본값 설정 (나중에 수동 확인 필요)
  ELSE '미분류'
END
WHERE sido = '광주광역시' AND gugun = '광주시';

-- 수정 후 상태 확인
SELECT COUNT(*) as fixed_count FROM aedpics.target_list_2025 WHERE sido = '광주광역시' AND gugun = '광주시';
SELECT gugun, COUNT(*) FROM aedpics.target_list_2025 WHERE sido = '광주광역시' GROUP BY gugun ORDER BY gugun;

-- 미분류 항목 확인
SELECT target_key, institution_name, address FROM aedpics.target_list_2025 WHERE gugun = '미분류' LIMIT 10;

COMMIT;
