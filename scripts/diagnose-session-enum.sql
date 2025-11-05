-- ========================================
-- Session Status Enum 진단 스크립트
-- ========================================
-- 작성일: 2025-11-05
-- 목적: session_status enum 타입 및 칼럼 상태 정확히 진단
--
-- 사용법:
-- PGPASSWORD="password" psql -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
--   -U aedpics_admin -d aedpics_production -f diagnose-session-enum.sql

\echo '========================================';
\echo '1. session_status enum 타입 존재 여부';
\echo '========================================';
SELECT
    n.nspname AS schema,
    t.typname AS enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE t.typname = 'session_status'
  AND n.nspname = 'aedpics'
GROUP BY n.nspname, t.typname;

\echo '';
\echo '========================================';
\echo '2. inspection_sessions.status 칼럼 타입';
\echo '========================================';
SELECT
    table_schema,
    table_name,
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'aedpics'
  AND table_name = 'inspection_sessions'
  AND column_name = 'status';

\echo '';
\echo '========================================';
\echo '3. inspection_sessions.status 현재 값 분포';
\echo '========================================';
SELECT
    status,
    COUNT(*) as count
FROM aedpics.inspection_sessions
GROUP BY status
ORDER BY count DESC;

\echo '';
\echo '========================================';
\echo '4. 진단 결과 해석';
\echo '========================================';
\echo '결과 1이 비어있으면: enum 타입이 생성되지 않음';
\echo '결과 2의 data_type이 text/varchar이면: 칼럼이 enum이 아님';
\echo '결과 3: 데이터 마이그레이션 가능 여부 확인';
\echo '========================================';
