-- Add 'lost' value to unavailable_reason enum
-- This fixes the enum mismatch where mark-unavailable/route.ts expects 'lost' as a valid reason

-- ========================================
-- Update unavailable_reason enum
-- ========================================

-- Add 'lost' to unavailable_reason enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'lost'
          AND enumtypid = (
              SELECT oid FROM pg_type
              WHERE typname = 'unavailable_reason'
                AND typnamespace = (
                    SELECT oid FROM pg_namespace WHERE nspname = 'aedpics'
                )
          )
    ) THEN
        ALTER TYPE "aedpics"."unavailable_reason" ADD VALUE 'lost' BEFORE 'other';
        RAISE NOTICE 'Added lost to unavailable_reason enum';
    ELSE
        RAISE NOTICE 'lost already exists in unavailable_reason enum';
    END IF;
END $$;
