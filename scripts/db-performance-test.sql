-- Database Performance Test
-- Phase 3: 데이터베이스 레벨 성능 측정

-- ============================================================
-- 1. 인덱스 사용 확인
-- ============================================================

\echo '=== 1. Index Usage Check ==='
\echo ''

-- Inspection mode 쿼리 플랜
\echo '1-1. Inspection Mode Query Plan:'
EXPLAIN ANALYZE
SELECT a.equipment_serial, a.status, ad.*
FROM inspection_assignments a
JOIN aed_data ad ON a.equipment_serial = ad.equipment_serial
WHERE a.assigned_to = 'some-user-id'
  AND a.status IN ('pending', 'in_progress')
  AND ad.sido = '서울'
  AND ad.category_1 = '공공기관'
ORDER BY a.id
LIMIT 50;

\echo ''
\echo '1-2. Region Filter Query Plan:'
EXPLAIN ANALYZE
SELECT *
FROM aed_data
WHERE sido = '서울'
  AND gugun = '강남구'
  AND category_1 = '공공기관'
  AND operation_status = '정상'
LIMIT 50;

\echo ''
\echo '1-3. Expiry Date Filter Query Plan:'
EXPLAIN ANALYZE
SELECT *
FROM aed_data
WHERE battery_expiry_date < CURRENT_DATE
LIMIT 50;

\echo ''
\echo '1-4. Full-text Search Query Plan:'
EXPLAIN ANALYZE
SELECT *
FROM aed_data
WHERE search_vector @@ to_tsquery('simple', '서울')
LIMIT 50;

-- ============================================================
-- 2. 함수 성능 테스트
-- ============================================================

\echo ''
\echo '=== 2. Function Performance Test ==='
\echo ''

-- check_expiry_status 함수 성능
\echo '2-1. check_expiry_status function:'
\timing on
SELECT COUNT(*)
FROM aed_data
WHERE check_expiry_status(battery_expiry_date, 'expired', CURRENT_DATE);
\timing off

\echo ''
\echo '2-2. check_inspection_status function:'
\timing on
SELECT COUNT(*)
FROM aed_data
WHERE check_inspection_status(last_inspection_date, 'overdue', CURRENT_DATE);
\timing off

\echo ''
\echo '2-3. Full-text search function:'
\timing on
SELECT * FROM search_aed_data('서울');
\timing off

-- ============================================================
-- 3. Bulk Insert RPC 성능
-- ============================================================

\echo ''
\echo '=== 3. Bulk Insert RPC Performance ==='
\echo ''

-- 테스트용 시리얼 번호 생성
\echo '3-1. Bulk insert 10 items:'
\timing on
SELECT bulk_create_assignments(
  ARRAY['TEST001', 'TEST002', 'TEST003', 'TEST004', 'TEST005',
        'TEST006', 'TEST007', 'TEST008', 'TEST009', 'TEST010'],
  'some-user-id'::uuid,
  'some-user-id'::uuid,
  'scheduled',
  CURRENT_DATE,
  NULL,
  0,
  'Performance test'
);
\timing off

-- 테스트 데이터 정리
DELETE FROM inspection_assignments
WHERE notes = 'Performance test';

-- ============================================================
-- 4. 인덱스 상태 확인
-- ============================================================

\echo ''
\echo '=== 4. Index Statistics ==='
\echo ''

SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('aed_data', 'inspection_assignments')
ORDER BY idx_scan DESC;

-- ============================================================
-- 5. 테이블 통계
-- ============================================================

\echo ''
\echo '=== 5. Table Statistics ==='
\echo ''

SELECT
  schemaname,
  tablename,
  n_live_tup as row_count,
  n_dead_tup as dead_rows,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename IN ('aed_data', 'inspection_assignments');

-- ============================================================
-- 6. 쿼리 성능 비교
-- ============================================================

\echo ''
\echo '=== 6. Query Performance Comparison ==='
\echo ''

-- BEFORE: 메모리 필터링 시뮬레이션
\echo '6-1. BEFORE (simulated memory filtering) - fetch all then filter:'
\timing on
SELECT *
FROM (
  SELECT a.equipment_serial, a.status, ad.*
  FROM inspection_assignments a
  JOIN aed_data ad ON a.equipment_serial = ad.equipment_serial
  WHERE a.assigned_to = 'some-user-id'
    AND a.status IN ('pending', 'in_progress')
  LIMIT 1000
) subquery
WHERE sido = '서울'
  AND category_1 = '공공기관';
\timing off

\echo ''
\echo '6-2. AFTER (DB-level filtering) - filter at DB level:'
\timing on
SELECT a.equipment_serial, a.status, ad.*
FROM inspection_assignments a
JOIN aed_data ad ON a.equipment_serial = ad.equipment_serial
WHERE a.assigned_to = 'some-user-id'
  AND a.status IN ('pending', 'in_progress')
  AND ad.sido = '서울'
  AND ad.category_1 = '공공기관'
LIMIT 50;
\timing off

-- ============================================================
-- 7. 권장사항
-- ============================================================

\echo ''
\echo '=== 7. Recommendations ==='
\echo ''

-- 사용되지 않는 인덱스
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexname NOT LIKE '%pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

\echo ''
\echo '=== Performance Test Complete ==='
\echo ''
\echo 'Review the results above to:'
\echo '1. Confirm indexes are being used (Index Scan vs Seq Scan)'
\echo '2. Check query execution times'
\echo '3. Identify slow queries (> 100ms)'
\echo '4. Remove unused indexes if any'
\echo ''
