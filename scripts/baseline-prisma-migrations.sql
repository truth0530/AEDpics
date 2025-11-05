-- ========================================
-- Prisma Migration Baseline Script
-- ========================================
-- 작성일: 2025-11-05
-- 목적: 현재 DB 상태를 기준으로 모든 마이그레이션을 "적용됨"으로 표시
--
-- 사용법:
-- PGPASSWORD="password" psql -h host -U user -d database -f baseline-prisma-migrations.sql

-- 트랜잭션 시작
BEGIN;

\echo '========================================';
\echo 'Baseline Prisma Migrations';
\echo '========================================';
\echo '';

-- 1. 기존 migration 레코드 확인
\echo 'Step 1: Current migration records';
SELECT migration_name, finished_at IS NOT NULL as applied
FROM aedpics._prisma_migrations
ORDER BY migration_name;

-- 2. 누락된 migrations 추가 (이미 수동으로 적용된 것으로 간주)
\echo '';
\echo 'Step 2: Adding missing migration records as applied';

-- 20251103_add_inspection_field_comparisons (이미 있지만 applied=false)
UPDATE aedpics._prisma_migrations
SET finished_at = NOW(),
    applied_steps_count = 1,
    logs = 'Baseline: Migration was manually applied'
WHERE migration_name = '20251103_add_inspection_field_comparisons'
  AND finished_at IS NULL;

-- 20251103_add_push_subscriptions 추가
INSERT INTO aedpics._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT
    gen_random_uuid(),
    'baseline',
    NOW(),
    '20251103_add_push_subscriptions',
    'Baseline: Migration was manually applied',
    NULL,
    NOW(),
    1
WHERE NOT EXISTS (
    SELECT 1 FROM aedpics._prisma_migrations
    WHERE migration_name = '20251103_add_push_subscriptions'
);

-- 20251105_add_organization_change_requests 추가
INSERT INTO aedpics._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT
    gen_random_uuid(),
    'baseline',
    NOW(),
    '20251105_add_organization_change_requests',
    'Baseline: Migration was manually applied',
    NULL,
    NOW(),
    1
WHERE NOT EXISTS (
    SELECT 1 FROM aedpics._prisma_migrations
    WHERE migration_name = '20251105_add_organization_change_requests'
);

-- 20251105_enum_and_index_improvements 추가
INSERT INTO aedpics._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT
    gen_random_uuid(),
    'baseline',
    NOW(),
    '20251105_enum_and_index_improvements',
    'Baseline: Migration was manually applied (session_status enum fixed)',
    NULL,
    NOW(),
    1
WHERE NOT EXISTS (
    SELECT 1 FROM aedpics._prisma_migrations
    WHERE migration_name = '20251105_enum_and_index_improvements'
);

-- 20251105_fix_timezone_and_duplicate_index 추가
INSERT INTO aedpics._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT
    gen_random_uuid(),
    'baseline',
    NOW(),
    '20251105_fix_timezone_and_duplicate_index',
    'Baseline: Migration was manually applied',
    NULL,
    NOW(),
    1
WHERE NOT EXISTS (
    SELECT 1 FROM aedpics._prisma_migrations
    WHERE migration_name = '20251105_fix_timezone_and_duplicate_index'
);

-- 3. 최종 확인
\echo '';
\echo 'Step 3: Final migration status';
SELECT migration_name,
       finished_at IS NOT NULL as applied,
       CASE
           WHEN logs LIKE '%Baseline%' THEN 'Baselined'
           ELSE 'Normal'
       END as type
FROM aedpics._prisma_migrations
ORDER BY migration_name;

-- 4. session_status enum 최종 확인
\echo '';
\echo 'Step 4: Verify session_status enum';
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (
    SELECT oid FROM pg_type
    WHERE typname = 'session_status'
    AND typnamespace = (
        SELECT oid FROM pg_namespace
        WHERE nspname = 'aedpics'
    )
)
ORDER BY enumsortorder;

-- 5. inspection_sessions.status 칼럼 타입 확인
\echo '';
\echo 'Step 5: Verify inspection_sessions.status column type';
SELECT
    column_name,
    udt_name as type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'aedpics'
  AND table_name = 'inspection_sessions'
  AND column_name = 'status';

\echo '';
\echo '========================================';
\echo '✓ Baseline complete!';
\echo '========================================';
\echo 'All migrations are now marked as applied.';
\echo 'Future deployments should work without issues.';
\echo '========================================';

-- 트랜잭션 커밋
COMMIT;

\echo '';
\echo '✓ Transaction committed successfully!';