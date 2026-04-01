@REM PostgreSQL Security Setup for Windows
@REM This script helps set up secure PostgreSQL access for Tailscale team

@echo off
setlocal enabledelayedexpansion

cls
echo.
echo ========================================
echo  PostgreSQL Security Setup for RPT Monitor
echo ========================================
echo.

REM Check if PostgreSQL tools are available
where psql >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: PostgreSQL CLI tools not found in PATH
    echo Please install PostgreSQL or add its bin folder to PATH
    echo Example: C:\Program Files\PostgreSQL\15\bin
    pause
    exit /b 1
)

echo [1/4] Verifying PostgreSQL connection...
psql -U postgres -h localhost -p 5433 -d postgres -c "SELECT version();" >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Cannot connect to PostgreSQL on localhost:5433
    echo Make sure PostgreSQL is running and accessible
    pause
    exit /b 1
)
echo OK - PostgreSQL is running
echo.

echo [2/4] Running security setup script...
REM Run the SQL setup script
psql -U postgres -h localhost -p 5433 -d postgres -f setup-postgres-security.sql
if %errorlevel% neq 0 (
    echo ERROR: Failed to execute setup script
    pause
    exit /b 1
)
echo OK - Security roles and permissions configured
echo.

echo [3/4] Updating .env file...
REM Create backup first
copy .env .env.backup >nul 2>&1

REM Update database credentials in .env
(
    echo # Server Configuration
    echo PORT=3000
    echo HOST=0.0.0.0
    echo.
    echo # CORS and Origin Configuration
    echo ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
    echo.
    echo # Database Connection - SECURED
    echo DB_HOST=localhost
    echo DB_PORT=5433
    echo DB_USER=db_app
    echo DB_PASSWORD=ChangeMe_App_Pass_2024!
    echo DB_NAME=rpt_monitor_data
    echo DB_SSL=true
    echo DB_SSL_REJECT_UNAUTHORIZED=true
    echo.
    echo # JWT Secret for authentication
    echo JWT_SECRET=your-secret-key-change-in-prod
) > .env.new
move /y .env.new .env >nul 2>&1
echo OK - .env backed up to .env.backup
echo.

echo [4/4] Configuration summary...
echo.
echo ========================================
echo    SECURITY SETUP COMPLETE
echo ========================================
echo.
echo Created Roles:
echo  • db_admin   - Superuser for maintenance
echo  • db_app     - Application user (limited)
echo  • db_viewer  - Read-only access
echo.
echo Next Steps:
echo.
echo 1. CHANGE DEFAULT PASSWORDS IMMEDIATELY:
echo    psql -U postgres -h localhost -p 5433
echo    ALTER USER db_app PASSWORD 'your-strong-password';
echo    ALTER USER db_viewer PASSWORD 'your-viewer-password';
echo    ALTER USER db_admin PASSWORD 'your-admin-password';
echo.
echo 2. Configure PostgreSQL for SSL (Edit postgresql.conf):
echo    Find: C:\Program Files\PostgreSQL\15\data\postgresql.conf
echo    Enable: ssl = on
echo    Set: listen_addresses = '*'
echo.
echo 3. Restrict access with pg_hba.conf (Edit):
echo    Find: C:\Program Files\PostgreSQL\15\data\pg_hba.conf
echo    Add: host rpt_monitor_data db_app 100.0.0.0/8 md5
echo.
echo 4. Restart PostgreSQL:
echo    net stop postgresql-x64-15
echo    net start postgresql-x64-15
echo.
echo 5. Test connection:
echo    psql -U db_app -h localhost -p 5433 -d rpt_monitor_data
echo.
echo Resources:
echo • See POSTGRESQL_SECURITY.md for detailed guide
echo • See setup-postgres-security.sql for SQL commands
echo.
echo ========================================
echo.
pause
