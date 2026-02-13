#Requires -Version 5.1
# ============================================
#  Agent Monitor - Windows Uninstaller
# ============================================

$ErrorActionPreference = "SilentlyContinue"

$TASK_NAME = "AgentMonitorDaemon"
$INSTALL_DIR = Join-Path $env:USERPROFILE ".agent-monitor"
$localAppData = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $env:USERPROFILE "AppData\Local" }
$APP_DIR = Join-Path $localAppData "AgentMonitor"
$APP_PATH = Join-Path $APP_DIR "Agent Monitor.exe"

Write-Host "Uninstalling Agent Monitor..." -ForegroundColor Cyan
Write-Host ""

# Kill running app and daemon processes
Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $APP_PATH } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*agent-monitor-daemon*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Write-Host "  ✓ Stopped running processes"

# Stop and remove scheduled task
schtasks /Delete /TN $TASK_NAME /F 2>$null | Out-Null
Write-Host "  ✓ Daemon task removed"

# Remove app
if (Test-Path $APP_PATH) {
    Remove-Item -Path $APP_PATH -Force
    Write-Host "  ✓ App removed"
} else {
    Write-Host "  - App not found (already removed)"
}

# Remove app directory if empty
if ((Test-Path $APP_DIR) -and -not (Get-ChildItem -Path $APP_DIR)) {
    Remove-Item -Path $APP_DIR -Force
}

# Remove install directory
if (Test-Path $INSTALL_DIR) {
    Remove-Item -Path $INSTALL_DIR -Recurse -Force
    Write-Host "  ✓ Installation files removed"
} else {
    Write-Host "  - Installation directory not found (already removed)"
}

Write-Host ""
Write-Host "Agent Monitor has been uninstalled." -ForegroundColor Green
