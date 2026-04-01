# Start RPT Monitor Services: Backend (npm run dev) + Nginx + Tailscale Guide

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RPT Monitor - Service Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectPath = "C:\Users\USER\Desktop\rpt_monitor\rpt_monitor"
cd $projectPath

# Step 1: Verify backend is ready
Write-Host "[1/4] Checking backend..." -ForegroundColor Yellow
Write-Host "  npm run dev will start on port 3000" -ForegroundColor Gray
Write-Host ""

# Step 2: Start Backend
Write-Host "[2/4] Starting Backend Server..." -ForegroundColor Yellow
Write-Host "  Opening new terminal window for backend..." -ForegroundColor Gray
Write-Host ""

# Start backend in new window
$backendScript = "cd 'C:\Users\USER\Desktop\rpt_monitor\rpt_monitor'; npm run dev"
Start-Process powershell -NoExit -ArgumentList "-NoProfile -Command ""$backendScript"""

Start-Sleep -Seconds 3

Write-Host "  ✓ Backend window opened" -ForegroundColor Green
Write-Host ""

# Step 3: Start Nginx
Write-Host "[3/4] Starting Nginx Frontend Proxy..." -ForegroundColor Yellow
Write-Host "  Starting Nginx on port 80..." -ForegroundColor Gray

# Check if nginx is available
$nginxPath = Get-Command nginx -ErrorAction SilentlyContinue
if ($nginxPath) {
    Write-Host "  ✓ Nginx found at: $($nginxPath.Source)" -ForegroundColor Green
    
    # Start Nginx
    nginx
    
    Start-Sleep -Seconds 1
    
    # Verify it started
    $port80 = netstat -ano | findstr ":80 "
    if ($port80) {
        Write-Host "  ✓ Nginx started on port 80" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Nginx may not have started, check port 80" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠ Nginx not found in PATH" -ForegroundColor Yellow
    Write-Host "    Install with: choco install nginx" -ForegroundColor Gray
}

Write-Host ""

# Step 4: Verify services
Write-Host "[4/4] Verifying Services..." -ForegroundColor Yellow
Write-Host ""

Start-Sleep -Seconds 2

# Check backend
$backend = netstat -ano | findstr ":3000 "
if ($backend) {
    Write-Host "  ✓ Backend running on :3000" -ForegroundColor Green
} else {
    Write-Host "  ✗ Backend not detected on :3000" -ForegroundColor Red
}

# Check Nginx
$frontend = netstat -ano | findstr ":80 "
if ($frontend) {
    Write-Host "  ✓ Nginx running on :80" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Nginx not running on :80" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Services Status" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend (Nginx):    http://localhost" -ForegroundColor Cyan
Write-Host "Backend (Direct):    http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

# Step 5: Tailscale instructions
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  Enable Remote Access (Tailscale)" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "1. Connect to Tailscale:" -ForegroundColor Yellow
Write-Host "   tailscale up" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Get your Tailscale IP:" -ForegroundColor Yellow
Write-Host "   tailscale ip -4" -ForegroundColor Gray
Write-Host "   (Example: 100.65.168.30)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Update .env with your IP:" -ForegroundColor Yellow
Write-Host "   ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://100.65.168.30:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Verify .env updated:" -ForegroundColor Yellow
Write-Host "   cat .env | findstr ALLOWED_ORIGINS" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Restart backend to apply changes:" -ForegroundColor Yellow
Write-Host "   - Restart the backend window (Ctrl+C then rerun npm run dev)" -ForegroundColor Gray
Write-Host "   OR" -ForegroundColor Gray
Write-Host "   - Run: npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "6. Test from another Tailscale device:" -ForegroundColor Yellow
Write-Host "   http://100.65.168.30 (via Nginx)" -ForegroundColor Gray
Write-Host "   http://100.65.168.30:3000 (direct)" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Important Notes" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "• Backend window: Check logs for any errors" -ForegroundColor Gray
Write-Host "• Nginx: If it doesn't start, ensure port 80 is free" -ForegroundColor Gray
Write-Host "• Tailscale: Use the VPN for secure remote access" -ForegroundColor Gray
Write-Host ""
Write-Host "Resources:" -ForegroundColor Gray
Write-Host "• Full Guide: DEPLOY_PM2_NGINX_TAILSCALE.md" -ForegroundColor Gray
Write-Host "• PM2 Guide: PM2_NGINX_SETUP.md" -ForegroundColor Gray
Write-Host "• Quick Start: QUICKSTART.md" -ForegroundColor Gray
Write-Host ""

# Keep window open
Read-Host "Press Enter to exit this launcher (services will continue running)"
