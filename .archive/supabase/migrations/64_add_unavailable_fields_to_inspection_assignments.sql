-- Migration: Add unavailable fields to inspection_assignments table
-- Purpose: Support marking equipment as unavailable (disposed, broken, etc.)
-- Date: 2025-10-15

-- Add unavailable fields to inspection_assignments table
ALTER TABLE inspection_assignments
ADD COLUMN IF NOT EXISTS unavailable_reason VARCHAR(20) CHECK (unavailable_reason IN ('disposed', 'broken', 'other')),
ADD COLUMN IF NOT EXISTS unavailable_note TEXT,
ADD COLUMN IF NOT EXISTS unavailable_at TIMESTAMPTZ;

-- Create index for querying unavailable assignments
CREATE INDEX IF NOT EXISTS idx_inspection_assignments_unavailable
ON inspection_assignments(equipment_serial, status)
WHERE status = 'unavailable';

-- Add comment for documentation
COMMENT ON COLUMN inspection_assignments.unavailable_reason IS 'Reason for marking equipment as unavailable: disposed, broken, other';
COMMENT ON COLUMN inspection_assignments.unavailable_note IS 'Additional notes when unavailable_reason is "other"';
COMMENT ON COLUMN inspection_assignments.unavailable_at IS 'Timestamp when equipment was marked as unavailable';
