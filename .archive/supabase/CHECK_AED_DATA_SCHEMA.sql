-- aed_data 테이블의 실제 컬럼 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'aed_data'
ORDER BY ordinal_position;
