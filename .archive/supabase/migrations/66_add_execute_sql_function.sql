-- Migration: Add execute_sql RPC function for dynamic SQL execution
-- Purpose: Workaround for PostgREST schema cache issues with new columns
-- Date: 2025-10-15

CREATE OR REPLACE FUNCTION execute_sql(query TEXT, params TEXT[] DEFAULT '{}')
RETURNS JSON[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON[];
  prepared_query TEXT;
  i INT;
BEGIN
  -- This is a simplified version that doesn't support parameters
  -- We'll use a different approach
  RAISE EXCEPTION 'This function is not implemented. Use direct table operations instead.';
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION execute_sql TO authenticated;

COMMENT ON FUNCTION execute_sql IS 'Execute dynamic SQL (placeholder - not fully implemented)';
