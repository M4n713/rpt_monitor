@echo off
REM RPT Monitor Production Server Launcher
REM Quick start script for Windows - no dependencies on PowerShell

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ========================================
echo   RPT Monitor Production Server
echo ========================================
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed
    pause
    exit /b 1
)

echo [OK] Node.js detected
echo.

REM Build application
echo Building application...
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

echo [OK] Build completed
echo.

REM Start server
echo Starting RPT Monitor server on port 3000...
echo Environment: Production
echo.

start "RPT Monitor Server (Production)" node dist-server/server.js

timeout /t 3 /nobreak

echo.
echo ========================================
echo   Server started successfully!
echo ========================================
echo.
echo Access Points:
echo   Frontend:   http://localhost:3000
echo   API:        http://localhost:3000/api/...
echo   Health:     http://localhost:3000/health
echo.
echo Build logs are available in: dist-server/
echo Server logs will appear in the server window
echo.
echo To stop: Close the 'RPT Monitor Server (Production)' window
echo.
pause
