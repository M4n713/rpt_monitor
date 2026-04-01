@echo off
REM RPT Monitor Server Startup Batch Script for Windows
REM This script starts the RPT Monitor server and Nginx

setlocal enabledelayedexpansion

echo.
echo ========================================
echo  RPT Monitor Server Startup
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    exit /b 1
)

REM Check if npm packages are installed
if not exist "node_modules\" (
    echo Installing npm packages...
    call npm install
)

REM Build the application
echo.
echo Building application...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    exit /b 1
)

REM Start the Node.js server
echo.
echo Starting RPT Monitor server on port 3000...
start "RPT Monitor Server" cmd /k "npm run dev"

REM Wait a moment for server to start
timeout /t 3 /nobreak

REM Try to start Nginx if available
where nginx >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo Starting Nginx...
    start "Nginx Server" cmd /k "nginx"
    echo.
    echo ========================================
    echo  Server started successfully!
    echo ========================================
    echo.
    echo Nginx:      http://localhost (port 80)
    echo Backend:    http://localhost:3000 (port 3000)
    echo.
    echo To stop the servers:
    echo   - RPT Monitor Server: Close the "RPT Monitor Server" window
    echo   - Nginx: Run 'nginx -s stop' or close the "Nginx Server" window
    echo.
) else (
    echo.
    echo WARNING: Nginx is not installed or not in PATH
    echo.
    echo ========================================
    echo  Server started successfully!
    echo ========================================
    echo.
    echo Backend:    http://localhost:3000 (port 3000)
    echo.
    echo To stop the server: Close this window or press Ctrl+C
    echo.
)

pause
