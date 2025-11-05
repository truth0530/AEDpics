-- ============================================
-- 인덱스 생성 확인 쿼리
-- Created: 2025-10-16
-- Purpose: Verify performance indexes were created successfully
-- ============================================

-- 1. 인덱스 목록 확인
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef 
FROM pg_indexes 
WHERE indexname IN (
  'idx_assignments_user_status',
  'idx_aed_data_serial',
  'idx_sessions_inspector_status'
)
ORDER BY tablename;

-- ============================================
-- 예상 결과: 3개의 행이 표시되어야 합니다
-- ============================================
-- 
-- 1. idx_aed_data_serial
-- 2. idx_assignments_user_status  
-- 3. idx_sessions_inspector_status
-- ============================================
