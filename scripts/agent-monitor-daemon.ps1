# Agent Monitor Daemon for Windows
# Watches %USERPROFILE%\.claude\teams\ and launches Agent Monitor when teams exist.
# Registered as a Windows Task Scheduler task to run on logon.

$APP_NAME = "Agent Monitor.exe"
$APP_DIR = Join-Path ($env:LOCALAPPDATA ?? (Join-Path $env:USERPROFILE "AppData\Local")) "AgentMonitor"
$APP_PATH = Join-Path $APP_DIR $APP_NAME
$TEAMS_DIR = Join-Path $env:USERPROFILE ".claude\teams"
$CHECK_INTERVAL = 5  # seconds
$LOG_PATH = Join-Path $env:TEMP "agent-monitor-daemon.log"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $entry = "[$timestamp] AgentMonitor: $Message"
    Add-Content -Path $LOG_PATH -Value $entry -ErrorAction SilentlyContinue
}

function Test-AppRunning {
    $proc = Get-Process -Name "Agent Monitor" -ErrorAction SilentlyContinue
    return ($null -ne $proc)
}

function Test-ActiveTeams {
    if (-not (Test-Path $TEAMS_DIR)) {
        return $false
    }
    $teamDirs = Get-ChildItem -Path $TEAMS_DIR -Directory -ErrorAction SilentlyContinue
    foreach ($dir in $teamDirs) {
        $configPath = Join-Path $dir.FullName "config.json"
        if (Test-Path $configPath) {
            return $true
        }
    }
    return $false
}

function Start-App {
    if (Test-Path $APP_PATH) {
        Write-Log "Teams detected. Launching Agent Monitor."
        Start-Process -FilePath $APP_PATH
    } else {
        Write-Log "Agent Monitor app not found at $APP_PATH"
    }
}

Write-Log "Daemon started. Watching $TEAMS_DIR"

while ($true) {
    if (Test-ActiveTeams) {
        if (-not (Test-AppRunning)) {
            Start-App
        }
    }
    Start-Sleep -Seconds $CHECK_INTERVAL
}
