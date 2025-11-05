-- Add regional_emergency_center_admin to user_profiles role check constraint
-- This role was missing from the original constraint, causing approval failures

-- Drop the existing constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Add the updated constraint with regional_emergency_center_admin included
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
CHECK (role = ANY (ARRAY[
  'master'::text,
  'emergency_center_admin'::text,
  'regional_emergency_center_admin'::text,
  'ministry_admin'::text,
  'regional_admin'::text,
  'local_admin'::text,
  'pending_approval'::text,
  'email_verified'::text
]));

-- Verify the constraint was added correctly
SELECT con.conname AS constraint_name, pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'user_profiles' AND con.contype = 'c';
