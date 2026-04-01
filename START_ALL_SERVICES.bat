@echo off
REM Start RPT Monitor Services - Backend and Frontend

echo.
echo ========================================
echo  RPT Monitor - Multi-Service Launcher
echo ========================================
echo.

cd /d C:\Users\USER\Desktop\rpt_monitor\rpt_monitor

echo [1/3] Starting Backend Server (npm run dev)...
echo.
start "RPT Monitor Backend - Port 3000" cmd /k npm run dev

timeout /t 3 /nobreak

echo.
echo [2/3] Starting Nginx (Frontend Proxy - Port 80)...
start "Nginx - Frontend Proxy - Port 80" cmd /k "nginx"

timeout /t 2 /nobreak

echo.
echo ========================================
echo  Services Starting...
echo ========================================
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost (via Nginx)
echo.
echo Both terminal windows should be open above.
echo.
echo Next Steps:
echo 1. Wait for backend to finish initializing
echo 2. Open http://localhost in your browser
echo 3. To enable Tailscale:
echo    - Run: tailscale up
echo    - Get your IP: tailscale ip -4
echo    - Add to .env: ALLOWED_ORIGINS
echo    - Restart backend
echo.
echo To stop services:
echo - Close the backend window or press Ctrl+C
echo - Run: nginx -s stop
echo.
pause
