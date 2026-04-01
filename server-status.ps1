# RPT Monitor - Server Status
$ProjectRoot = $PSScriptRoot
$PidFile = "$ProjectRoot\.server.pid"

Write-Host ""
Write-Host "=== RPT Monitor Status ===" -ForegroundColor Cyan

# Check PID file
if (Test-Path $PidFile) {
    $serverPid = (Get-Content $PidFile).Trim()
    $proc = Get-Process -Id ([int]$serverPid) -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "  Server: ✓ RUNNING (PID $serverPid, CPU $([math]::Round($proc.CPU,1))s, RAM $([math]::Round($proc.WorkingSet64/1MB,1))MB)" -ForegroundColor Green
    } else {
        Write-Host "  Server: ✗ NOT RUNNING (stale PID file)" -ForegroundColor Red
    }
} else {
    # Check port anyway
    $check = netstat -ano 2>$null | Select-String ":3000 " | Select-String "LISTENING"
    if ($check) {
        Write-Host "  Server: ✓ RUNNING on port 3000 (no PID file)" -ForegroundColor Green
    } else {
        Write-Host "  Server: ✗ NOT RUNNING" -ForegroundColor Red
    }
}

# Nginx
$nginx = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
if ($nginx) {
    Write-Host "  Nginx:  ✓ RUNNING ($($nginx.Count) worker(s))" -ForegroundColor Green
} else {
    Write-Host "  Nginx:  ✗ NOT RUNNING" -ForegroundColor DarkGray
}

# Tailscale
$tsIp = (tailscale ip -4 2>$null)
if ($tsIp) {
    Write-Host "  Tailscale: ✓ $($tsIp.Trim())" -ForegroundColor Green
} else {
    Write-Host "  Tailscale: not connected" -ForegroundColor DarkGray
}

# Recent log tail
$logErr = "$ProjectRoot\logs\server-err.log"
if (Test-Path $logErr) {
    $lines = Get-Content $logErr -Tail 5 -ErrorAction SilentlyContinue
    if ($lines) {
        Write-Host ""
        Write-Host "  Recent errors:" -ForegroundColor Yellow
        $lines | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    }
}

Write-Host ""
