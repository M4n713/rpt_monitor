# ==============================================================
# RPT Monitor - Install & Start Nginx (Windows)
# Downloads portable nginx if not present, applies config, starts it
# ==============================================================

$ProjectRoot  = $PSScriptRoot
$NginxDir     = "C:\nginx"
$NginxVersion = "1.27.4"
$NginxZip     = "$env:TEMP\nginx-$NginxVersion.zip"
$NginxUrl     = "https://nginx.org/download/nginx-$NginxVersion.zip"
$NginxExe     = "$NginxDir\nginx.exe"
$NginxConf    = "$ProjectRoot\nginx\rpt-monitor.conf"

Write-Host ""
Write-Host "=== Nginx Setup ===" -ForegroundColor Cyan

# ── Stop any running nginx ────────────────────────────────────
$running = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "Stopping existing nginx..." -ForegroundColor Yellow
    & "$NginxExe" -s stop 2>$null
    Start-Sleep -Seconds 2
    Get-Process -Name "nginx" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

# ── Download & install nginx if needed ───────────────────────
if (-not (Test-Path $NginxExe)) {
    Write-Host "Nginx not found. Downloading nginx $NginxVersion..." -ForegroundColor Yellow
    
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        
        # Progress bar slows Invoke-WebRequest significantly, suppress it
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $NginxUrl -OutFile $NginxZip -UseBasicParsing
        $ProgressPreference = 'Continue'
        
        Write-Host "  ✓ Downloaded nginx ($([math]::Round((Get-Item $NginxZip).Length/1MB,1)) MB)" -ForegroundColor Green
        
        # Extract
        Write-Host "  Extracting to C:\..." -ForegroundColor Yellow
        Expand-Archive -Path $NginxZip -DestinationPath "C:\" -Force
        
        # Rename versioned folder to C:\nginx
        $extracted = "C:\nginx-$NginxVersion"
        if (Test-Path $extracted) {
            if (Test-Path $NginxDir) { Remove-Item $NginxDir -Recurse -Force }
            Rename-Item $extracted $NginxDir
        }
        
        Write-Host "  ✓ Nginx installed to $NginxDir" -ForegroundColor Green
        Remove-Item $NginxZip -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host "  ✗ Failed to download nginx: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Manual install:" -ForegroundColor Yellow
        Write-Host "  1. Go to: https://nginx.org/en/download.html" -ForegroundColor Cyan
        Write-Host "  2. Download nginx/Windows-$NginxVersion zip" -ForegroundColor Cyan
        Write-Host "  3. Extract to C:\nginx" -ForegroundColor Cyan
        Write-Host "  4. Re-run this script" -ForegroundColor Cyan
        exit 1
    }
} else {
    Write-Host "  ✓ Nginx already installed at $NginxDir" -ForegroundColor Green
}

# ── Ensure required dirs exist ───────────────────────────────
New-Item -ItemType Directory -Path "$NginxDir\logs" -Force | Out-Null
New-Item -ItemType Directory -Path "$NginxDir\temp" -Force | Out-Null
New-Item -ItemType Directory -Path "$NginxDir\temp\client_body" -Force | Out-Null
New-Item -ItemType Directory -Path "$NginxDir\temp\proxy" -Force | Out-Null

# ── Get Tailscale IP for server_name ─────────────────────────
$tsIp = (tailscale ip -4 2>$null)
if ($tsIp) { $tsIp = $tsIp.Trim() }

# ── Apply nginx config ────────────────────────────────────────
$confContent = Get-Content $NginxConf -Raw

# Add temp path directives and Tailscale IP to server_name
$nginxConf = @"
# Auto-generated nginx.conf for RPT Monitor
# Generated: $(Get-Date -f 'yyyy-MM-dd HH:mm:ss')

worker_processes  1;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;
    
    # Temp paths for Windows portable install
    client_body_temp_path  temp/client_body;
    proxy_temp_path        temp/proxy;
    fastcgi_temp_path      temp/fastcgi;
    uwsgi_temp_path        temp/uwsgi;
    scgi_temp_path         temp/scgi;

$confContent
}
"@

Set-Content "$NginxDir\conf\nginx.conf" $nginxConf -Encoding UTF8

# Patch server_name to include Tailscale IP if available
if ($tsIp) {
    $content = Get-Content "$NginxDir\conf\nginx.conf" -Raw
    $content = $content -replace "server_name localhost 127\.0\.0\.1 \*\.local;", "server_name localhost 127.0.0.1 *.local $tsIp;"
    Set-Content "$NginxDir\conf\nginx.conf" $content -Encoding UTF8
    Write-Host "  ✓ Added Tailscale IP ($tsIp) to server_name" -ForegroundColor Green
}

# ── Test config ───────────────────────────────────────────────
Write-Host "  Testing nginx config..." -ForegroundColor Yellow
$testOutput = & "$NginxExe" -t -p "$NginxDir" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Config OK" -ForegroundColor Green
} else {
    Write-Host "  ✗ Config error:" -ForegroundColor Red
    $testOutput | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
    exit 1
}

# ── Check port 80 ─────────────────────────────────────────────
$port80 = netstat -ano 2>$null | Select-String ":80 " | Select-String "LISTENING"
if ($port80) {
    $rows = @($port80)
    $parts = $rows[0].ToString() -split '\s+'
    $pidNum = $parts | Where-Object { $_ -match '^\d+$' } | Select-Object -Last 1
    if ($pidNum) { $proc = Get-Process -Id ([int]$pidNum) -ErrorAction SilentlyContinue } else { $proc = $null }
    if ($proc) { $procName = $proc.ProcessName } else { $procName = "?" }
    Write-Host "  ! Port 80 is in use by PID $pidNum ($procName)" -ForegroundColor Red
    Write-Host "    Run: taskkill /PID $pidNum /F    to free port 80, then re-run this script" -ForegroundColor DarkGray
    exit 1
}

# ── Start nginx ───────────────────────────────────────────────
Start-Process -FilePath $NginxExe -WorkingDirectory $NginxDir -WindowStyle Hidden
Start-Sleep -Seconds 2

$nginxCheck = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
if ($nginxCheck) {
    Write-Host "  ✓ Nginx started!" -ForegroundColor Green
    Write-Host "     http://localhost     (port 80)" -ForegroundColor Cyan
    if ($tsIp) { Write-Host "     http://$tsIp  (Tailscale via Nginx)" -ForegroundColor Cyan }
    Write-Host ""
    Write-Host "  Nginx commands:" -ForegroundColor White
    Write-Host "   Reload : C:\nginx\nginx.exe -s reload" -ForegroundColor DarkGray
    Write-Host "   Stop   : C:\nginx\nginx.exe -s stop" -ForegroundColor DarkGray
    Write-Host "   Errors : Get-Content C:\nginx\logs\error.log -Tail 20" -ForegroundColor DarkGray
} else {
    Write-Host "  ✗ Nginx failed to start. Check:" -ForegroundColor Red
    Write-Host "    Get-Content C:\nginx\logs\error.log -Tail 20" -ForegroundColor DarkGray
}
