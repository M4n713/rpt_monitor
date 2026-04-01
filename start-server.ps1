# RPT Monitor Server Startup PowerShell Script for Windows
# This script starts the RPT Monitor server and optionally Nginx

param(
    [switch]$WithNginx
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RPT Monitor Server Startup" -ForegroundColor Cyan
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

# Check if npm packages are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm packages..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ ERROR: npm install failed" -ForegroundColor Red
        exit 1
    }
}

# Build the application
Write-Host ""
Write-Host "Building application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ ERROR: Build failed" -ForegroundColor Red
    exit 1
}

# Start the Node.js server
Write-Host ""
Write-Host "Starting RPT Monitor server on port 3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command 'cd $PSScriptRoot; npm run dev'" -WindowName "RPT Monitor Server"

Start-Sleep -Seconds 3

# Check if Nginx is available and start it if requested
$nginxAvailable = $null
try {
    $nginxAvailable = (Get-Command nginx -ErrorAction SilentlyContinue) -ne $null
} catch {
    $nginxAvailable = $false
}

if ($WithNginx -and $nginxAvailable) {
    Write-Host "Starting Nginx..." -ForegroundColor Yellow
    Start-Process "nginx.exe" -WindowName "Nginx Server"
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Servers started successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Nginx:      http://localhost (port 80)" -ForegroundColor Cyan
    Write-Host "Backend:    http://localhost:3000 (port 3000)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To stop the servers:" -ForegroundColor Yellow
    Write-Host "  - RPT Monitor Server: Close the 'RPT Monitor Server' window" -ForegroundColor DarkGray
    Write-Host "  - Nginx:              Run 'nginx -s stop' in command prompt" -ForegroundColor DarkGray
    Write-Host ""
} else {
    if (-not $nginxAvailable) {
        Write-Host "  Note: Nginx is not installed. Use -WithNginx flag if you have Nginx installed." -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Server started successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Backend:    http://localhost:3000 (port 3000)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To stop the server: Close the 'RPT Monitor Server' window" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Press Ctrl+C to stop the startup script (servers will continue running)" -ForegroundColor DarkGray
Read-Host "Press Enter to exit this window"
