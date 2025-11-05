-- Phase 3: Schema Improvements
-- 1. Add session_status enum value (in_progress)
-- 2. Create new composite indexes for performance

-- ========================================
-- 1. Update session_status enum
-- ========================================

-- Add 'in_progress' to session_status enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'in_progress'
          AND enumtypid = (
              SELECT oid FROM pg_type
              WHERE typname = 'session_status'
                AND typnamespace = (
                    SELECT oid FROM pg_namespace WHERE nspname = 'aedpics'
                )
          )
    ) THEN
        ALTER TYPE "aedpics"."session_status" ADD VALUE 'in_progress' AFTER 'active';
        RAISE NOTICE 'Added in_progress to session_status enum';
    ELSE
        RAISE NOTICE 'in_progress already exists in session_status enum';
    END IF;
END $$;

-- ========================================
-- 2. Create new composite indexes
-- ========================================

-- user_profiles: Role and active status composite index
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'aedpics'
          AND tablename = 'user_profiles'
          AND indexname = 'idx_user_profiles_role_active'
    ) THEN
        CREATE INDEX "idx_user_profiles_role_active" ON "aedpics"."user_profiles" ("role", "is_active");
        RAISE NOTICE 'Created index idx_user_profiles_role_active';
    ELSE
        RAISE NOTICE 'Index idx_user_profiles_role_active already exists';
    END IF;
END $$;

-- inspection_field_comparisons: Complex query patterns index
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'aedpics'
          AND tablename = 'inspection_field_comparisons'
          AND indexname = 'idx_field_comparisons_equipment_improvement_time'
    ) THEN
        CREATE INDEX "idx_field_comparisons_equipment_improvement_time"
        ON "aedpics"."inspection_field_comparisons" ("equipment_serial", "improvement_status", "inspection_time" DESC);
        RAISE NOTICE 'Created index idx_field_comparisons_equipment_improvement_time';
    ELSE
        RAISE NOTICE 'Index idx_field_comparisons_equipment_improvement_time already exists';
    END IF;
END $$;

-- ========================================
-- Verification
-- ========================================

-- Verify enum value
DO $$
DECLARE
    v_enum_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'in_progress'
          AND enumtypid = (
              SELECT oid FROM pg_type
              WHERE typname = 'session_status'
                AND typnamespace = (
                    SELECT oid FROM pg_namespace WHERE nspname = 'aedpics'
                )
          )
    ) INTO v_enum_exists;

    IF v_enum_exists THEN
        RAISE NOTICE '✓ session_status enum includes in_progress';
    ELSE
        RAISE WARNING '⚠ session_status enum missing in_progress';
    END IF;
END $$;

-- Verify indexes
DO $$
DECLARE
    v_idx1_exists BOOLEAN;
    v_idx2_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'aedpics'
          AND tablename = 'user_profiles'
          AND indexname = 'idx_user_profiles_role_active'
    ) INTO v_idx1_exists;

    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'aedpics'
          AND tablename = 'inspection_field_comparisons'
          AND indexname = 'idx_field_comparisons_equipment_improvement_time'
    ) INTO v_idx2_exists;

    RAISE NOTICE '=== Index Verification ===';
    IF v_idx1_exists THEN
        RAISE NOTICE '✓ idx_user_profiles_role_active exists';
    ELSE
        RAISE WARNING '⚠ idx_user_profiles_role_active missing';
    END IF;

    IF v_idx2_exists THEN
        RAISE NOTICE '✓ idx_field_comparisons_equipment_improvement_time exists';
    ELSE
        RAISE WARNING '⚠ idx_field_comparisons_equipment_improvement_time missing';
    END IF;
END $$;
