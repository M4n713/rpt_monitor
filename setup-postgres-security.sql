-- PostgreSQL Security Setup Script for RPT Monitor
-- Run this as superuser: psql -U postgres -h localhost -p 5433
-- 
-- IMPORTANT: Change all passwords before running in production!

-- ============================================================
-- STEP 1: Create Dedicated Roles
-- ============================================================

-- Drop existing roles if they exist (use with caution in production!)
-- DROP ROLE IF EXISTS db_admin;
-- DROP ROLE IF EXISTS db_app;
-- DROP ROLE IF EXISTS db_viewer;

-- Admin user (for maintenance, backups, schema changes)
CREATE ROLE db_admin LOGIN PASSWORD 'ChangeMe_Admin_Pass_2024!' SUPERUSER;

-- Application user (for Node.js app - has limited write permissions)
CREATE ROLE db_app LOGIN PASSWORD 'ChangeMe_App_Pass_2024!' CREATEDB;

-- Read-only viewer (for team members who only need to read data)
CREATE ROLE db_viewer LOGIN PASSWORD 'ChangeMe_Viewer_Pass_2024!';

-- ============================================================
-- STEP 2: Create Database (if not exists)
-- ============================================================

-- CREATE DATABASE rpt_monitor_data OWNER db_app;

-- ============================================================
-- STEP 3: Grant Database-Level Permissions
-- ============================================================

-- Grant database access
GRANT CONNECT ON DATABASE rpt_monitor_data TO db_app;
GRANT CONNECT ON DATABASE rpt_monitor_data TO db_viewer;
GRANT ALL PRIVILEGES ON DATABASE rpt_monitor_data TO db_admin;

-- ============================================================
-- STEP 4: Grant Schema-Level Permissions
-- ============================================================

-- Connect to the database
\c rpt_monitor_data

-- Grant schema access
GRANT USAGE ON SCHEMA public TO db_app;
GRANT USAGE ON SCHEMA public TO db_viewer;
GRANT ALL PRIVILEGES ON SCHEMA public TO db_admin;

-- ============================================================
-- STEP 5: Grant Table-Level Permissions
-- ============================================================

-- For application user (can read, write, update, delete)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO db_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO db_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO db_app;

-- For viewer user (can only read)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO db_viewer;

-- ============================================================
-- STEP 6: Set Default Privileges (for future tables)
-- ============================================================

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO db_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO db_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO db_viewer;

-- ============================================================
-- STEP 7: Connection Limits (prevent resource exhaustion)
-- ============================================================

-- Limit concurrent connections per role
ALTER ROLE db_app CONNECTION LIMIT 20;
ALTER ROLE db_viewer CONNECTION LIMIT 10;
ALTER ROLE db_admin CONNECTION LIMIT 5;

-- ============================================================
-- STEP 8: Verify Setup (run these to check)
-- ============================================================

-- List all roles
-- \du

-- Check role permissions
-- SELECT grantee, privilege_type
-- FROM information_schema.table_privileges
-- WHERE table_catalog = 'rpt_monitor_data'
-- GROUP BY grantee, privilege_type
-- ORDER BY grantee;

-- ============================================================
-- NEXT STEPS:
-- ============================================================
--
-- 1. Change all passwords above to STRONG passwords:
--    - At least 16 characters
--    - Mix of uppercase, lowercase, numbers, symbols
--    - Use a password manager
--
-- 2. Update .env file:
--    DB_USER=db_app
--    DB_PASSWORD=ChangeMe_App_Pass_2024!
--    DB_SSL=true
--
-- 3. Edit postgresql.conf:
--    - enable ssl = on
--    - set listen_addresses = '*'
--    - enable logging_collector = on
--
-- 4. Edit pg_hba.conf to restrict access:
--    host rpt_monitor_data db_app 100.0.0.0/8 md5
--
-- 5. Restart PostgreSQL:
--    net stop postgresql-x64-15
--    net start postgresql-x64-15
--
-- 6. Test connection:
--    psql -U db_app -h localhost -p 5433 -d rpt_monitor_data
--
-- ============================================================
