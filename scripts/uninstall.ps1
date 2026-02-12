#Requires -Version 5.1
# ============================================
#  Agent Monitor - Windows Uninstaller
# ============================================

$ErrorActionPreference = "SilentlyContinue"

$TASK_NAME = "AgentMonitorDaemon"
$INSTALL_DIR = Join-Path $env:USERPROFILE ".agent-monitor"
$APP_DIR = Join-Path ($env:LOCALAPPDATA ?? (Join-Path $env:USERPROFILE "AppData\Local")) "AgentMonitor"
$APP_PATH = Join-Path $APP_DIR "Agent Monitor.exe"

Write-Host "Uninstalling Agent Monitor..." -ForegroundColor Cyan
Write-Host ""

# Stop and remove scheduled task
schtasks /Delete /TN $TASK_NAME /F 2>$null | Out-Null
Write-Host "  ✓ Daemon stopped and removed"

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
