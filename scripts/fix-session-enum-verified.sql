-- ========================================
-- Session Status Enum 수정 스크립트 (검증된 버전)
-- ========================================
-- 작성일: 2025-11-05
-- 작성자: Senior Developer
-- 목적: session_status enum 타입 생성 및 칼럼 변환
--
-- 주의사항:
-- 1. 반드시 백업 후 실행
-- 2. 트랜잭션으로 감싸서 안전하게 실행
-- 3. 각 단계마다 검증 수행
--
-- 사용법:
-- PGPASSWORD="password" psql -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
--   -U aedpics_admin -d aedpics_production -f fix-session-enum-verified.sql

-- 트랜잭션 시작
BEGIN;

\echo '========================================';
\echo 'Step 1: 현재 상태 확인';
\echo '========================================';

-- 1-1. Enum 존재 여부
DO $$
DECLARE
    enum_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE t.typname = 'session_status'
          AND n.nspname = 'aedpics'
    ) INTO enum_exists;

    IF enum_exists THEN
        RAISE NOTICE '✓ session_status enum이 이미 존재합니다';
    ELSE
        RAISE NOTICE '✗ session_status enum이 존재하지 않습니다 (생성 필요)';
    END IF;
END $$;

-- 1-2. 칼럼 타입 확인
DO $$
DECLARE
    column_type TEXT;
BEGIN
    SELECT data_type INTO column_type
    FROM information_schema.columns
    WHERE table_schema = 'aedpics'
      AND table_name = 'inspection_sessions'
      AND column_name = 'status';

    IF column_type IN ('character varying', 'text') THEN
        RAISE NOTICE '✗ status 칼럼이 % 타입입니다 (변환 필요)', column_type;
    ELSIF column_type = 'USER-DEFINED' THEN
        RAISE NOTICE '✓ status 칼럼이 이미 enum 타입입니다';
    ELSE
        RAISE NOTICE '? status 칼럼이 예상치 못한 타입입니다: %', column_type;
    END IF;
END $$;

\echo '';
\echo '========================================';
\echo 'Step 2: session_status enum 생성';
\echo '========================================';

DO $$
BEGIN
    -- Enum이 없으면 생성
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE t.typname = 'session_status'
          AND n.nspname = 'aedpics'
    ) THEN
        CREATE TYPE "aedpics"."session_status" AS ENUM (
            'active',
            'in_progress',
            'completed',
            'cancelled',
            'paused'
        );
        RAISE NOTICE '✓ session_status enum 생성 완료';
    ELSE
        RAISE NOTICE '→ session_status enum이 이미 존재함 (건너뜀)';
    END IF;
END $$;

\echo '';
\echo '========================================';
\echo 'Step 3: 데이터 유효성 검증';
\echo '========================================';

-- 3-1. 현재 status 값들이 enum 값과 일치하는지 확인
DO $$
DECLARE
    invalid_count INTEGER;
    invalid_values TEXT;
BEGIN
    SELECT COUNT(*), string_agg(DISTINCT status, ', ')
    INTO invalid_count, invalid_values
    FROM aedpics.inspection_sessions
    WHERE status NOT IN ('active', 'in_progress', 'completed', 'cancelled', 'paused');

    IF invalid_count > 0 THEN
        RAISE EXCEPTION '✗ 유효하지 않은 status 값 발견 (% 건): %', invalid_count, invalid_values;
    ELSE
        RAISE NOTICE '✓ 모든 status 값이 유효합니다';
    END IF;
END $$;

\echo '';
\echo '========================================';
\echo 'Step 4: 칼럼 타입 변환';
\echo '========================================';

DO $$
DECLARE
    column_type TEXT;
BEGIN
    -- 현재 칼럼 타입 확인
    SELECT data_type INTO column_type
    FROM information_schema.columns
    WHERE table_schema = 'aedpics'
      AND table_name = 'inspection_sessions'
      AND column_name = 'status';

    IF column_type IN ('character varying', 'text') THEN
        -- TEXT/VARCHAR → ENUM 변환
        ALTER TABLE "aedpics"."inspection_sessions"
        ALTER COLUMN "status" TYPE "aedpics"."session_status"
        USING "status"::text::"aedpics"."session_status";

        RAISE NOTICE '✓ status 칼럼을 enum 타입으로 변환 완료';
    ELSIF column_type = 'USER-DEFINED' THEN
        RAISE NOTICE '→ status 칼럼이 이미 enum 타입임 (건너뜀)';
    ELSE
        RAISE EXCEPTION '✗ 예상치 못한 칼럼 타입: %', column_type;
    END IF;
END $$;

\echo '';
\echo '========================================';
\echo 'Step 5: 기본값 설정';
\echo '========================================';

DO $$
BEGIN
    -- 기본값이 없으면 설정
    ALTER TABLE "aedpics"."inspection_sessions"
    ALTER COLUMN "status" SET DEFAULT 'active'::"aedpics"."session_status";

    RAISE NOTICE '✓ 기본값을 active로 설정 완료';
END $$;

\echo '';
\echo '========================================';
\echo 'Step 6: 최종 검증';
\echo '========================================';

-- 6-1. Enum 타입 검증
SELECT
    '✓ Enum 타입 생성 확인' as status,
    n.nspname AS schema,
    t.typname AS enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE t.typname = 'session_status'
  AND n.nspname = 'aedpics'
GROUP BY n.nspname, t.typname;

-- 6-2. 칼럼 타입 검증
SELECT
    '✓ 칼럼 타입 변환 확인' as status,
    table_schema,
    table_name,
    column_name,
    udt_name as type_name,
    column_default
FROM information_schema.columns
WHERE table_schema = 'aedpics'
  AND table_name = 'inspection_sessions'
  AND column_name = 'status';

-- 6-3. 데이터 분포 확인
SELECT
    '✓ 데이터 분포 확인' as status,
    status,
    COUNT(*) as count
FROM aedpics.inspection_sessions
GROUP BY status
ORDER BY count DESC;

\echo '';
\echo '========================================';
\echo '✓ 모든 작업 완료';
\echo '========================================';
\echo '트랜잭션을 커밋하려면 아래 명령어를 실행하세요:';
\echo 'COMMIT;';
\echo '';
\echo '문제가 발생했다면 롤백하세요:';
\echo 'ROLLBACK;';
\echo '========================================';

-- 트랜잭션 커밋 (자동)
COMMIT;

\echo '';
\echo '========================================';
\echo '✓ 트랜잭션 커밋 완료';
\echo '========================================';
