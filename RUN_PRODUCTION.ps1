# RPT Monitor Production Server Startup
# This script starts the server with the production build
# Avoids PM2 Windows pipe issues by running Node directly

param(
    [switch]$WithNginx
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RPT Monitor Production Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js detected: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Build the application
Write-Host "Building application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ ERROR: Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Build completed successfully" -ForegroundColor Green
Write-Host ""

# Start the Node.js server with production build
Write-Host "Starting RPT Monitor server on port 3000..." -ForegroundColor Yellow
Write-Host "Environment: Production" -ForegroundColor Gray
Write-Host ""

$env:NODE_ENV = "production"

# Start in a new window to keep this script running
$nodeCmd = "cd $PSScriptRoot; node dist-server/server.js"
Start-Process powershell -ArgumentList "-NoExit -Command '$nodeCmd'" -WindowName "RPT Monitor Server (Production)"

Start-Sleep -Seconds 3

# Start Nginx if requested
$nginxAvailable = $false
try {
    $nginxAvailable = (Get-Command nginx -ErrorAction SilentlyContinue) -ne $null
} catch {
    $nginxAvailable = $false
}

if ($WithNginx -and $nginxAvailable) {
    Write-Host "Starting Nginx..." -ForegroundColor Yellow
    Start-Process "nginx.exe" -WindowName "Nginx Server"
    Start-Sleep -Seconds 2
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Servers started successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Frontend Access Points:" -ForegroundColor Cyan
    Write-Host "  - Via Nginx:   http://localhost (port 80)" -ForegroundColor White
    Write-Host "  - Direct:      https://localhost:3000 (port 3000, HTTPS)" -ForegroundColor White
    Write-Host "  - Tailscale:   https://100.84.4.41:3000 (HTTPS secure)" -ForegroundColor Green
    Write-Host ""
    Write-Host "API Endpoints:" -ForegroundColor Cyan
    Write-Host "  - Via Nginx:   http://localhost/api/... (port 80)" -ForegroundColor White
    Write-Host "  - Direct:      https://localhost:3000/api/... (port 3000, HTTPS)" -ForegroundColor White
    Write-Host "  - Tailscale:   https://100.84.4.41:3000/api/... (HTTPS)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Admin Panel:" -ForegroundColor Cyan
    Write-Host "  - Via Nginx:   http://localhost/admin (port 80)" -ForegroundColor White
    Write-Host "  - Direct:      https://localhost:3000/admin (port 3000, HTTPS)" -ForegroundColor White
    Write-Host ""
    Write-Host "To stop the servers:" -ForegroundColor Yellow
    Write-Host "  - RPT Monitor Server: Close the 'RPT Monitor Server (Production)' window" -ForegroundColor DarkGray
    Write-Host "  - Nginx:              Run 'nginx -s stop' in command prompt" -ForegroundColor DarkGray
    Write-Host ""
} else {
    if (-not $nginxAvailable) {
        Write-Host "ℹ Info: Nginx is not installed. To use it:" -ForegroundColor Cyan
        Write-Host "  1. Install: choco install nginx" -ForegroundColor DarkGray
        Write-Host "  2. Run: .\RUN_PRODUCTION.ps1 -WithNginx" -ForegroundColor DarkGray
    }
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Server started successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Frontend Access Point:" -ForegroundColor Cyan
    Write-Host "  http://localhost:3000" -ForegroundColor White
    Write-Host ""
    Write-Host "API Endpoints:" -ForegroundColor Cyan
    Write-Host "  http://localhost:3000/api/..." -ForegroundColor White
    Write-Host ""
    Write-Host "Admin Panel:" -ForegroundColor Cyan
    Write-Host "  http://localhost:3000/admin" -ForegroundColor White
    Write-Host ""
    Write-Host "To stop the server:" -ForegroundColor Yellow
    Write-Host "  Close the 'RPT Monitor Server (Production)' window" -ForegroundColor DarkGray
    Write-Host ""
}

Write-Host "Logs are available at: ./logs/" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop the startup script (servers will continue running)" -ForegroundColor DarkGray
Read-Host "Press Enter to exit this window"
