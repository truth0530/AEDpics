-- 현재 존재하는 모든 get_aed 관련 함수 확인
SELECT
    proname AS function_name,
    pg_get_function_identity_arguments(oid) AS arguments,
    pg_get_function_result(oid) AS return_type
FROM pg_proc
WHERE proname IN ('get_aed_data_filtered', 'get_aed_data_by_jurisdiction', 'get_aed_data_summary')
ORDER BY proname, oid;