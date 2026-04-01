# ============================================================
# RPT Monitor - Fix Setup Script (PM2 + Nginx + Tailscale)
# Run this from the project directory as Administrator for best results
# ============================================================

param(
    [switch]$SkipNginx,
    [switch]$SkipBuild,
    [string]$TailscaleIP = ""
)

$ErrorActionPreference = "Continue"
$ProjectRoot = $PSScriptRoot
$PM2Home = "$ProjectRoot\.pm2-local"
$NginxDir = "C:\nginx"
$NginxVersion = "1.27.4"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  RPT Monitor - Fix Setup (PM2 + Nginx + Tailscale)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ── STEP 1: Kill any stale processes ────────────────────────
Write-Host "[1/6] Cleaning up stale processes..." -ForegroundColor Yellow

# Kill existing PM2 daemon
$pm2Procs = Get-Process -Name "pm2" -ErrorAction SilentlyContinue
if ($pm2Procs) {
    $pm2Procs | Stop-Process -Force
    Write-Host "  ✓ Killed PM2 daemon" -ForegroundColor Green
}

# Kill process on port 3000 if any
$port3000 = netstat -ano | Select-String ":3000 " | Select-String "LISTENING"
if ($port3000) {
    $pid3000 = ($port3000 -split "\s+")[-1]
    taskkill /PID $pid3000 /F 2>$null
    Write-Host "  ✓ Freed port 3000 (PID $pid3000)" -ForegroundColor Green
}

# Kill nginx if running
$nginxProcs = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
if ($nginxProcs) {
    $nginxProcs | Stop-Process -Force
    Write-Host "  ✓ Stopped nginx" -ForegroundColor Green
}

# ── STEP 2: Fix PM2 HOME (the EPERM fix) ────────────────────
Write-Host ""
Write-Host "[2/6] Fixing PM2 home directory (EPERM fix)..." -ForegroundColor Yellow

# Remove old broken PM2 homes
if (Test-Path "$env:USERPROFILE\.pm2") {
    Remove-Item -Path "$env:USERPROFILE\.pm2" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ Removed stale ~/.pm2" -ForegroundColor Green
}
if (Test-Path $PM2Home) {
    Remove-Item -Path $PM2Home -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ Removed old local .pm2-local" -ForegroundColor Green
}

# Create fresh PM2 home
New-Item -ItemType Directory -Path $PM2Home -Force | Out-Null
Write-Host "  ✓ PM2_HOME set to: $PM2Home" -ForegroundColor Green

# Set PM2_HOME for this session
$env:PM2_HOME = $PM2Home

# ── STEP 3: Detect Tailscale IP ─────────────────────────────
Write-Host ""
Write-Host "[3/6] Detecting Tailscale IP..." -ForegroundColor Yellow

if (-not $TailscaleIP) {
    $tsIp = (tailscale ip -4 2>$null)
    if ($tsIp) {
        $TailscaleIP = $tsIp.Trim()
        Write-Host "  ✓ Tailscale IP detected: $TailscaleIP" -ForegroundColor Green
    } else {
        Write-Host "  ! Tailscale not running or not installed. Skipping Tailscale config." -ForegroundColor DarkYellow
    }
}

# Update .env ALLOWED_ORIGINS with Tailscale IP
$envFile = "$ProjectRoot\.env"
$envContent = Get-Content $envFile -Raw

$baseOrigins = "http://localhost:3000,http://127.0.0.1:3000"
if ($TailscaleIP) {
    $newOrigins = "$baseOrigins,http://${TailscaleIP}:3000,http://${TailscaleIP}"
} else {
    $newOrigins = $baseOrigins
}

$envContent = $envContent -replace "ALLOWED_ORIGINS=.*", "ALLOWED_ORIGINS=$newOrigins"
Set-Content $envFile $envContent -Encoding UTF8
Write-Host "  ✓ Updated .env ALLOWED_ORIGINS" -ForegroundColor Green

# ── STEP 4: Build the app ────────────────────────────────────
Write-Host ""
Write-Host "[4/6] Building application..." -ForegroundColor Yellow

if ($SkipBuild) {
    Write-Host "  ! Skipping build (--SkipBuild flag)" -ForegroundColor DarkYellow
} else {
    Set-Location $ProjectRoot
    npm run build 2>&1 | Tail -5
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Build successful" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Build failed! Run 'npm run build' manually to see errors." -ForegroundColor Red
    }
}

# ── STEP 5: Start PM2 ───────────────────────────────────────
Write-Host ""
Write-Host "[5/6] Starting PM2..." -ForegroundColor Yellow

Set-Location $ProjectRoot
$env:PM2_HOME = $PM2Home

# Create a wrapper to start with PM2_HOME set
$pm2StartCmd = "cd '$ProjectRoot'; `$env:PM2_HOME='$PM2Home'; pm2 start ecosystem.config.cjs --env production"
Start-Process powershell -ArgumentList "-NoExit -Command `"$pm2StartCmd`"" -WindowStyle Normal -PassThru | Out-Null

Write-Host "  ⏳ Waiting for PM2 to start (10s)..." -ForegroundColor DarkYellow
Start-Sleep -Seconds 10

# Check if port 3000 is now listening
$port3000Check = netstat -ano | Select-String ":3000 " | Select-String "LISTENING"
if ($port3000Check) {
    Write-Host "  ✓ Server is listening on port 3000!" -ForegroundColor Green
} else {
    Write-Host "  ! Port 3000 not yet active. Check the PM2 window for errors." -ForegroundColor DarkYellow
    Write-Host "    Tip: View logs with: `$env:PM2_HOME='$PM2Home'; pm2 logs rpt-monitor" -ForegroundColor DarkGray
}

# ── STEP 6: Install & Start Nginx ───────────────────────────
Write-Host ""
Write-Host "[6/6] Setting up Nginx..." -ForegroundColor Yellow

if ($SkipNginx) {
    Write-Host "  ! Skipping Nginx (--SkipNginx flag)" -ForegroundColor DarkYellow
} else {
    # Check if nginx exists
    $nginxExe = "$NginxDir\nginx.exe"
    if (-not (Test-Path $nginxExe)) {
        Write-Host "  ⬇  Nginx not found. Downloading nginx $NginxVersion for Windows..." -ForegroundColor Yellow
        $nginxZip = "$env:TEMP\nginx-$NginxVersion.zip"
        $nginxUrl = "https://nginx.org/download/nginx-$NginxVersion.zip"

        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $nginxUrl -OutFile $nginxZip -UseBasicParsing
            Write-Host "  ✓ Downloaded nginx" -ForegroundColor Green

            # Extract
            Write-Host "  📦 Extracting nginx..." -ForegroundColor Yellow
            Expand-Archive -Path $nginxZip -DestinationPath "C:\" -Force
            Rename-Item "C:\nginx-$NginxVersion" $NginxDir -Force -ErrorAction SilentlyContinue
            Write-Host "  ✓ Installed nginx to $NginxDir" -ForegroundColor Green
        } catch {
            Write-Host "  ✗ Failed to download nginx: $_" -ForegroundColor Red
            Write-Host "  → Manual install: https://nginx.org/en/download.html → extract to C:\nginx" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  ✓ Nginx already installed at $NginxDir" -ForegroundColor Green
    }

    if (Test-Path $nginxExe) {
        # Update nginx config with Tailscale IP in server_name
        $nginxConf = Get-Content "$ProjectRoot\nginx\rpt-monitor.conf" -Raw
        if ($TailscaleIP) {
            $nginxConf = $nginxConf -replace "server_name localhost 127.0.0.1 \*\.local;", "server_name localhost 127.0.0.1 *.local $TailscaleIP;"
        }
        Set-Content "$NginxDir\conf\nginx.conf" $nginxConf -Encoding UTF8
        Write-Host "  ✓ Nginx config installed (with Tailscale IP)" -ForegroundColor Green

        # Make sure logs dir exists
        New-Item -ItemType Directory -Path "$NginxDir\logs" -Force | Out-Null
        New-Item -ItemType Directory -Path "$NginxDir\temp" -Force | Out-Null

        # Test config
        $nginxTest = & "$NginxDir\nginx.exe" -t -p "$NginxDir" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Nginx config test: OK" -ForegroundColor Green
            # Kill any old nginx
            Get-Process -Name "nginx" -ErrorAction SilentlyContinue | Stop-Process -Force
            Start-Sleep -Seconds 1
            # Check if port 80 is free
            $port80 = netstat -ano | Select-String ":80 " | Select-String "LISTENING"
            if ($port80) {
                Write-Host "  ! Port 80 is already in use. Nginx will not start." -ForegroundColor Red
                $portInfo = $port80 | ForEach-Object { ($_ -split "\s+")[-1] }
                Write-Host "    PID using port 80: $portInfo" -ForegroundColor DarkGray
            } else {
                Start-Process "$NginxDir\nginx.exe" -WorkingDirectory "$NginxDir" -WindowStyle Hidden
                Start-Sleep -Seconds 2
                $nginxRunning = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
                if ($nginxRunning) {
                    Write-Host "  ✓ Nginx started successfully!" -ForegroundColor Green
                } else {
                    Write-Host "  ! Nginx failed to start. Check: $NginxDir\logs\error.log" -ForegroundColor Red
                }
            }
        } else {
            Write-Host "  ✗ Nginx config test failed:" -ForegroundColor Red
            Write-Host $nginxTest -ForegroundColor Red
        }
    }
}

# ── SUMMARY ─────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Setup Summary" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  🔧 PM2_HOME: $PM2Home" -ForegroundColor White
Write-Host ""
Write-Host "  🌐 Access URLs:" -ForegroundColor White
Write-Host "     http://localhost:3000          (Node.js direct)" -ForegroundColor Cyan
if (-not $SkipNginx) {
    Write-Host "     http://localhost               (via Nginx :80)" -ForegroundColor Cyan
}
if ($TailscaleIP) {
    Write-Host "     http://${TailscaleIP}:3000    (Tailscale direct)" -ForegroundColor Cyan
    if (-not $SkipNginx) {
        Write-Host "     http://${TailscaleIP}          (Tailscale via Nginx)" -ForegroundColor Cyan
    }
}
Write-Host ""
Write-Host "  📋 Useful PM2 commands (run in a new terminal):" -ForegroundColor White
Write-Host "     `$env:PM2_HOME='$PM2Home'; pm2 status" -ForegroundColor DarkGray
Write-Host "     `$env:PM2_HOME='$PM2Home'; pm2 logs rpt-monitor" -ForegroundColor DarkGray
Write-Host "     `$env:PM2_HOME='$PM2Home'; pm2 restart rpt-monitor" -ForegroundColor DarkGray
Write-Host ""
if (-not $SkipNginx) {
    Write-Host "  📋 Nginx commands:" -ForegroundColor White
    Write-Host "     C:\nginx\nginx.exe -s reload   (reload config)" -ForegroundColor DarkGray
    Write-Host "     C:\nginx\nginx.exe -s stop     (stop nginx)" -ForegroundColor DarkGray
    Write-Host "     Get-Content C:\nginx\logs\error.log -Tail 20  (view errors)" -ForegroundColor DarkGray
}
Write-Host ""
