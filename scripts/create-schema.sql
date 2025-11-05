-- Create aedpics schema and grant permissions
-- Run this script in NCP PostgreSQL

-- Create schema
CREATE SCHEMA IF NOT EXISTS aedpics;

-- Grant all privileges on schema to aedpics_admin
GRANT ALL ON SCHEMA aedpics TO aedpics_admin;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA aedpics
GRANT ALL ON TABLES TO aedpics_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA aedpics
GRANT ALL ON SEQUENCES TO aedpics_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA aedpics
GRANT ALL ON FUNCTIONS TO aedpics_admin;

-- Set search path for aedpics_admin user
ALTER USER aedpics_admin SET search_path TO aedpics, public;

-- Show confirmation
SELECT 'Schema aedpics created successfully' AS status;
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'aedpics';
