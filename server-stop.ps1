# RPT Monitor - Stop Server
$ProjectRoot = $PSScriptRoot
$PidFile = "$ProjectRoot\.server.pid"

Write-Host "Stopping RPT Monitor server..." -ForegroundColor Yellow

# Kill by PID file
if (Test-Path $PidFile) {
    $serverPid = (Get-Content $PidFile -ErrorAction SilentlyContinue).Trim()
    if ($serverPid -match '^\d+$') {
        Stop-Process -Id ([int]$serverPid) -Force -ErrorAction SilentlyContinue
        Write-Host "  ✓ Killed server PID $serverPid" -ForegroundColor Green
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

# Kill anything on port 3000
$listening = netstat -ano 2>$null | Select-String ":3000 " | Select-String "LISTENING"
if ($listening) {
    $rows = @($listening)
    foreach ($row in $rows) {
        $parts = $row.ToString() -split '\s+'
        $pidNum = $parts | Where-Object { $_ -match '^\d+$' } | Select-Object -Last 1
        if ($pidNum) {
            taskkill /PID $pidNum /F 2>$null | Out-Null
            Write-Host "  ✓ Freed port 3000 (PID $pidNum)" -ForegroundColor Green
        }
    }
}

# Kill watcher script
$watchers = Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like "*.server-watcher.ps1*" }
if ($watchers) {
    $watchers | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Write-Host "  ✓ Killed server watcher" -ForegroundColor Green
}

Write-Host "  ✓ Server stopped." -ForegroundColor Green
