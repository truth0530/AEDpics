-- Migration: Add RPC function to update inspection assignment to unavailable status
-- Purpose: Workaround for PostgREST schema cache issue
-- Date: 2025-10-15

CREATE OR REPLACE FUNCTION update_assignment_unavailable(
  assignment_id UUID,
  unavail_reason TEXT,
  unavail_note TEXT,
  unavail_at TIMESTAMPTZ,
  upd_at TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  UPDATE inspection_assignments
  SET
    status = 'unavailable',
    unavailable_reason = unavail_reason,
    unavailable_note = unavail_note,
    unavailable_at = unavail_at,
    updated_at = upd_at
  WHERE id = assignment_id
  RETURNING to_json(inspection_assignments.*) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_assignment_unavailable TO authenticated;

COMMENT ON FUNCTION update_assignment_unavailable IS 'Update inspection assignment to unavailable status (workaround for PostgREST schema cache)';
