-- 1. audit_logs 테이블 존재 여부 확인
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE tablename LIKE '%audit%'
ORDER BY schemaname, tablename;

-- 2. 현재 사용 가능한 모든 테이블 확인
SELECT
    table_schema,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;

-- 3. RLS 정책 확인
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename LIKE '%audit%';

-- 4. 권한 확인
SELECT
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_name LIKE '%audit%'
ORDER BY grantee, privilege_type;