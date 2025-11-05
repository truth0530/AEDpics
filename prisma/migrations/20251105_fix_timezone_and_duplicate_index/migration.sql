-- Phase 1: Critical Database Schema Improvements
-- 1. Fix timezone inconsistency (Timestamp -> Timestamptz)
-- 2. Remove duplicate index

-- ========================================
-- 1. Fix gps_issues table timezone
-- ========================================

-- resolved_at: timestamp -> timestamptz
DO $$
BEGIN
    -- Check if column is already timestamptz
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'aedpics'
          AND table_name = 'gps_issues'
          AND column_name = 'resolved_at'
          AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE "aedpics"."gps_issues"
        ALTER COLUMN "resolved_at" TYPE TIMESTAMPTZ(6);

        RAISE NOTICE 'Changed gps_issues.resolved_at to timestamptz(6)';
    ELSE
        RAISE NOTICE 'gps_issues.resolved_at is already timestamptz(6)';
    END IF;
END $$;

-- created_at: timestamp -> timestamptz
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'aedpics'
          AND table_name = 'gps_issues'
          AND column_name = 'created_at'
          AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE "aedpics"."gps_issues"
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(6);

        RAISE NOTICE 'Changed gps_issues.created_at to timestamptz(6)';
    ELSE
        RAISE NOTICE 'gps_issues.created_at is already timestamptz(6)';
    END IF;
END $$;

-- updated_at: timestamp -> timestamptz
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'aedpics'
          AND table_name = 'gps_issues'
          AND column_name = 'updated_at'
          AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE "aedpics"."gps_issues"
        ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(6);

        RAISE NOTICE 'Changed gps_issues.updated_at to timestamptz(6)';
    ELSE
        RAISE NOTICE 'gps_issues.updated_at is already timestamptz(6)';
    END IF;
END $$;

-- ========================================
-- 2. Fix gps_analysis_logs table timezone
-- ========================================

-- created_at: timestamp -> timestamptz
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'aedpics'
          AND table_name = 'gps_analysis_logs'
          AND column_name = 'created_at'
          AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE "aedpics"."gps_analysis_logs"
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(6);

        RAISE NOTICE 'Changed gps_analysis_logs.created_at to timestamptz(6)';
    ELSE
        RAISE NOTICE 'gps_analysis_logs.created_at is already timestamptz(6)';
    END IF;
END $$;

-- ========================================
-- 3. Remove duplicate index on aed_data
-- ========================================

-- Drop idx_aed_data_serial (duplicate of idx_aed_data_equipment_serial)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'aedpics'
          AND tablename = 'aed_data'
          AND indexname = 'idx_aed_data_serial'
    ) THEN
        DROP INDEX "aedpics"."idx_aed_data_serial";
        RAISE NOTICE 'Dropped duplicate index idx_aed_data_serial';
    ELSE
        RAISE NOTICE 'Index idx_aed_data_serial does not exist (already removed)';
    END IF;
END $$;

-- ========================================
-- Verification
-- ========================================

-- Verify timezone changes
DO $$
DECLARE
    v_gps_issues_resolved_at TEXT;
    v_gps_issues_created_at TEXT;
    v_gps_issues_updated_at TEXT;
    v_gps_analysis_logs_created_at TEXT;
BEGIN
    -- Check gps_issues columns
    SELECT data_type INTO v_gps_issues_resolved_at
    FROM information_schema.columns
    WHERE table_schema = 'aedpics' AND table_name = 'gps_issues' AND column_name = 'resolved_at';

    SELECT data_type INTO v_gps_issues_created_at
    FROM information_schema.columns
    WHERE table_schema = 'aedpics' AND table_name = 'gps_issues' AND column_name = 'created_at';

    SELECT data_type INTO v_gps_issues_updated_at
    FROM information_schema.columns
    WHERE table_schema = 'aedpics' AND table_name = 'gps_issues' AND column_name = 'updated_at';

    -- Check gps_analysis_logs columns
    SELECT data_type INTO v_gps_analysis_logs_created_at
    FROM information_schema.columns
    WHERE table_schema = 'aedpics' AND table_name = 'gps_analysis_logs' AND column_name = 'created_at';

    -- Report results
    RAISE NOTICE '=== Verification Results ===';
    RAISE NOTICE 'gps_issues.resolved_at: %', v_gps_issues_resolved_at;
    RAISE NOTICE 'gps_issues.created_at: %', v_gps_issues_created_at;
    RAISE NOTICE 'gps_issues.updated_at: %', v_gps_issues_updated_at;
    RAISE NOTICE 'gps_analysis_logs.created_at: %', v_gps_analysis_logs_created_at;

    -- Check all are timestamptz
    IF v_gps_issues_resolved_at = 'timestamp with time zone'
       AND v_gps_issues_created_at = 'timestamp with time zone'
       AND v_gps_issues_updated_at = 'timestamp with time zone'
       AND v_gps_analysis_logs_created_at = 'timestamp with time zone'
    THEN
        RAISE NOTICE '✓ All timezone changes verified successfully';
    ELSE
        RAISE WARNING '⚠ Some columns are not timestamptz';
    END IF;
END $$;

-- Verify index removal
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'aedpics'
          AND tablename = 'aed_data'
          AND indexname = 'idx_aed_data_serial'
    ) THEN
        RAISE NOTICE '✓ Duplicate index removal verified';
    ELSE
        RAISE WARNING '⚠ Duplicate index still exists';
    END IF;
END $$;
