#Requires -Version 5.1
# ============================================
#  Agent Monitor - Windows Installer
#  Claude Code Agent Team GUI Monitor
# ============================================

$ErrorActionPreference = "Stop"

$VERSION = "0.1.0"
$REPO = "Glsme/agent-monitor"
$REPO_URL = "https://github.com/$REPO.git"
$RELEASE_URL = "https://github.com/$REPO/releases/download/v$VERSION"
$INSTALL_DIR = Join-Path $env:USERPROFILE ".agent-monitor"
$localAppData = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $env:USERPROFILE "AppData\Local" }
$APP_DIR = Join-Path $localAppData "AgentMonitor"
$DAEMON_DIR = Join-Path $INSTALL_DIR "daemon"
$TASK_NAME = "AgentMonitorDaemon"
$APP_NAME = "Agent Monitor.exe"
$APP_PATH = Join-Path $APP_DIR $APP_NAME

function Write-Banner {
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║     " -ForegroundColor Cyan -NoNewline; Write-Host "Agent Monitor" -ForegroundColor Green -NoNewline; Write-Host " - Installer        ║" -ForegroundColor Cyan
    Write-Host "  ║  Claude Code Team GUI Monitor        ║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Get-AssetName {
    $arch = $env:PROCESSOR_ARCHITECTURE
    switch ($arch) {
        "AMD64"   { return "AgentMonitor-windows-x64.zip" }
        "ARM64"   { return "AgentMonitor-windows-arm64.zip" }
        default   {
            Write-Host "  Warning: Unknown architecture $arch, will build from source." -ForegroundColor Yellow
            return $null
        }
    }
}

function Try-DownloadBinary {
    param([string]$AssetName)

    if (-not $AssetName) { return $false }

    Write-Host "[1/3] Downloading pre-built binary..." -ForegroundColor Yellow
    $downloadUrl = "$RELEASE_URL/$AssetName"
    $tmpZip = Join-Path $env:TEMP "agent-monitor-download.zip"

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $downloadUrl -OutFile $tmpZip -UseBasicParsing -TimeoutSec 30
        $sizeMB = [math]::Round((Get-Item $tmpZip).Length / 1MB, 1)
        Write-Host "  ✓ Downloaded $AssetName ($sizeMB MB)"

        Write-Host "[2/3] Installing..." -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $APP_DIR -Force | Out-Null

        # Remove old app if exists
        if (Test-Path $APP_PATH) {
            Remove-Item -Path $APP_PATH -Force
        }

        # Extract
        $tmpExtract = Join-Path $env:TEMP "agent-monitor-extract"
        if (Test-Path $tmpExtract) { Remove-Item -Path $tmpExtract -Recurse -Force }
        Expand-Archive -Path $tmpZip -DestinationPath $tmpExtract -Force

        # Copy extracted app
        $extractedApp = Join-Path $tmpExtract $APP_NAME
        if (Test-Path $extractedApp) {
            Copy-Item -Path $extractedApp -Destination $APP_PATH -Force
        } else {
            # Try finding the exe in subdirectories
            $found = Get-ChildItem -Path $tmpExtract -Filter "*.exe" -Recurse | Select-Object -First 1
            if ($found) {
                Copy-Item -Path $found.FullName -Destination $APP_PATH -Force
            } else {
                throw "Could not find executable in archive"
            }
        }

        Remove-Item -Path $tmpExtract -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -Path $tmpZip -Force -ErrorAction SilentlyContinue

        Write-Host "  ✓ App installed to $APP_PATH"
        return $true
    }
    catch {
        Write-Host "  Pre-built binary not available. Building from source..." -ForegroundColor Yellow
        Remove-Item -Path $tmpZip -Force -ErrorAction SilentlyContinue
        return $false
    }
}

function Test-BuildDeps {
    Write-Host "[1/4] Checking build dependencies..." -ForegroundColor Yellow

    # Check Node.js
    if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
        Write-Host "Error: Node.js is required. Install from https://nodejs.org" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ Node.js $(node --version)"

    # Check npm
    if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
        Write-Host "Error: npm is required." -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ npm $(npm --version)"

    # Check/Install Rust
    if (-not (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
        $cargoPath = Join-Path $env:USERPROFILE ".cargo\bin\cargo.exe"
        if (Test-Path $cargoPath) {
            $env:PATH = (Join-Path $env:USERPROFILE ".cargo\bin") + ";" + $env:PATH
        } else {
            Write-Host "  Installing Rust..."
            Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile (Join-Path $env:TEMP "rustup-init.exe") -UseBasicParsing
            & (Join-Path $env:TEMP "rustup-init.exe") -y --quiet
            $env:PATH = (Join-Path $env:USERPROFILE ".cargo\bin") + ";" + $env:PATH
        }
    }
    Write-Host "  ✓ Rust $(rustc --version 2>$null | ForEach-Object { $_.Split(' ')[1] })"

    # Check for Visual C++ Build Tools (via cl.exe or MSBuild)
    $hasBuildTools = (Get-Command "cl" -ErrorAction SilentlyContinue) -or
                     (Test-Path "C:\Program Files (x86)\Microsoft Visual Studio\*\*\MSBuild\*\Bin\MSBuild.exe") -or
                     (Test-Path "C:\Program Files\Microsoft Visual Studio\*\*\MSBuild\*\Bin\MSBuild.exe")
    if (-not $hasBuildTools) {
        Write-Host "  Warning: Visual C++ Build Tools may be required for building." -ForegroundColor Yellow
        Write-Host "  Install from: https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor Yellow
    } else {
        Write-Host "  ✓ Visual C++ Build Tools"
    }
}

function Get-OrUpdateSource {
    Write-Host "[2/4] Getting source code..." -ForegroundColor Yellow

    $srcDir = Join-Path $INSTALL_DIR "src"
    if (Test-Path $srcDir) {
        Write-Host "  Updating existing installation..."
        Push-Location $srcDir
        try { git pull --ff-only 2>$null } catch {}
        Pop-Location
    } else {
        New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
        # Check if running from local source
        if ((Test-Path ".\package.json") -and (Select-String -Path ".\package.json" -Pattern "agent-monitor" -Quiet)) {
            Write-Host "  Using local source..."
            Copy-Item -Path "." -Destination $srcDir -Recurse
        } else {
            Write-Host "  Cloning repository..."
            git clone $REPO_URL $srcDir
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Failed to clone repo. If installing locally, run from the project directory." -ForegroundColor Red
                exit 1
            }
        }
    }

    Set-Location $srcDir
}

function Build-App {
    Write-Host "[3/4] Building application..." -ForegroundColor Yellow
    $env:PATH = (Join-Path $env:USERPROFILE ".cargo\bin") + ";" + $env:PATH

    Write-Host "  Installing npm dependencies..."
    npm install --silent 2>$null

    Write-Host "  Building Tauri app (this may take a few minutes on first run)..."
    npx tauri build --bundles nsis 2>&1 | Select-Object -Last 5

    # Find the built exe
    $builtExe = Get-ChildItem -Path "src-tauri\target\release" -Filter "*.exe" -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -notmatch "deps" } |
                Select-Object -First 1
    if (-not $builtExe) {
        Write-Host "Build failed. Check the output above." -ForegroundColor Red
        exit 1
    }

    New-Item -ItemType Directory -Path $APP_DIR -Force | Out-Null
    if (Test-Path $APP_PATH) {
        Remove-Item -Path $APP_PATH -Force
    }
    Copy-Item -Path $builtExe.FullName -Destination $APP_PATH -Force
    Write-Host "  ✓ App installed to $APP_PATH"
}

function Install-Daemon {
    param([string]$StepPrefix)
    Write-Host "$StepPrefix Setting up auto-launch daemon..." -ForegroundColor Yellow

    New-Item -ItemType Directory -Path $DAEMON_DIR -Force | Out-Null

    # Create daemon script (with logging, matching standalone agent-monitor-daemon.ps1)
    $daemonScript = @"
# Agent Monitor Daemon for Windows
# Watches %USERPROFILE%\.claude\teams\ and launches Agent Monitor when teams exist.
# Registered as a Windows Task Scheduler task to run on logon.

`$APP_PATH = "$APP_PATH"
`$TEAMS_DIR = Join-Path `$env:USERPROFILE ".claude\teams"
`$CHECK_INTERVAL = 5
`$LOG_PATH = Join-Path "$INSTALL_DIR" "daemon.log"

function Write-Log {
    param([string]`$Message)
    `$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    `$entry = "[`$timestamp] AgentMonitor: `$Message"
    Add-Content -Path `$LOG_PATH -Value `$entry -ErrorAction SilentlyContinue
}

function Test-AppRunning {
    `$proc = Get-Process -ErrorAction SilentlyContinue | Where-Object { `$_.Path -eq `$APP_PATH }
    return (`$null -ne `$proc)
}

function Test-ActiveTeams {
    if (-not (Test-Path `$TEAMS_DIR)) { return `$false }
    `$teamDirs = Get-ChildItem -Path `$TEAMS_DIR -Directory -ErrorAction SilentlyContinue
    foreach (`$dir in `$teamDirs) {
        if (Test-Path (Join-Path `$dir.FullName "config.json")) { return `$true }
    }
    return `$false
}

Write-Log "Daemon started. Watching `$TEAMS_DIR"

while (`$true) {
    if (Test-ActiveTeams) {
        if (-not (Test-AppRunning)) {
            if (Test-Path `$APP_PATH) {
                Write-Log "Teams detected. Launching Agent Monitor."
                Start-Process -FilePath `$APP_PATH
            } else {
                Write-Log "Agent Monitor app not found at `$APP_PATH"
            }
        }
    }
    Start-Sleep -Seconds `$CHECK_INTERVAL
}
"@
    $daemonPath = Join-Path $DAEMON_DIR "agent-monitor-daemon.ps1"
    Set-Content -Path $daemonPath -Value $daemonScript -Encoding UTF8

    # Remove existing scheduled task if present
    try { schtasks /Delete /TN $TASK_NAME /F 2>$null } catch {}

    # Create scheduled task to run at logon
    schtasks /Create /TN $TASK_NAME `
        /TR "powershell.exe -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File `"$daemonPath`"" `
        /SC ONLOGON /RL LIMITED /F | Out-Null

    # Start the task now
    try { schtasks /Run /TN $TASK_NAME 2>$null | Out-Null } catch {}

    Write-Host "  ✓ Auto-start daemon activated (Task Scheduler)"
}

function Write-Done {
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "  ║     Installation Complete!            ║" -ForegroundColor Green
    Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "  App location:  " -NoNewline; Write-Host $APP_PATH -ForegroundColor Cyan
    Write-Host "  Auto-start:    " -NoNewline; Write-Host "Enabled (Task Scheduler)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  The app will " -NoNewline
    Write-Host "automatically launch" -ForegroundColor Green -NoNewline
    Write-Host " when you"
    Write-Host "  create a Claude Code agent team."
    Write-Host ""
    Write-Host "  Commands:" -ForegroundColor Yellow
    Write-Host "    Open now:      " -NoNewline; Write-Host "agent-monitor open" -ForegroundColor Cyan
    Write-Host "    View logs:     " -NoNewline; Write-Host "Get-Content -Wait `$env:USERPROFILE\.agent-monitor\daemon.log" -ForegroundColor Cyan
    Write-Host "    Uninstall:     " -NoNewline; Write-Host "agent-monitor uninstall" -ForegroundColor Cyan
    Write-Host ""
}

# ---- Main ----
Write-Banner
$assetName = Get-AssetName

if (Try-DownloadBinary -AssetName $assetName) {
    # Fast path: pre-built binary downloaded
    Install-Daemon -StepPrefix "[3/3]"
    Write-Done
} else {
    # Slow path: build from source
    Test-BuildDeps
    Get-OrUpdateSource
    Build-App
    Install-Daemon -StepPrefix "[4/4]"
    Write-Done
}
