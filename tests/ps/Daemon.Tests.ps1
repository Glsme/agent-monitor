# Daemon.Tests.ps1 - Tests for scripts/agent-monitor-daemon.ps1
# Tests the daemon functions: Write-Log, Test-AppRunning, Test-ActiveTeams

BeforeAll {
    # Read the daemon script and extract only the function definitions
    # (everything before the infinite loop) so we can test them in isolation.
    $daemonScriptPath = Join-Path $PSScriptRoot "..\..\scripts\agent-monitor-daemon.ps1"
    $scriptContent = Get-Content -Path $daemonScriptPath -Raw
    $loopIndex = $scriptContent.IndexOf("while (`$true)")
    if ($loopIndex -lt 0) {
        throw "Could not find 'while (`$true)' in daemon script"
    }
    # Store function definitions as a string we can re-invoke per test.
    # The script sets variables like $TEAMS_DIR, $APP_PATH, $LOG_PATH then defines
    # functions that reference them. We Invoke-Expression to define the functions
    # in the It block's scope, then override the variables AFTER (since the functions
    # resolve variables dynamically at call time, not at definition time).
    $script:DaemonFunctionDefs = $scriptContent.Substring(0, $loopIndex)
}

Describe "Test-ActiveTeams" {
    BeforeEach {
        $script:testRoot = Join-Path $env:TEMP "daemon-test-$(Get-Random)"
        New-Item -ItemType Directory -Path $script:testRoot -Force | Out-Null
    }

    AfterEach {
        if (Test-Path $script:testRoot) {
            Remove-Item -Path $script:testRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    It "returns false when teams directory does not exist" {
        Invoke-Expression $script:DaemonFunctionDefs
        $TEAMS_DIR = Join-Path $script:testRoot "nonexistent"
        Test-ActiveTeams | Should -Be $false
    }

    It "returns false when teams directory has subdirs without config.json" {
        Invoke-Expression $script:DaemonFunctionDefs
        $teamsDir = Join-Path $script:testRoot "teams"
        New-Item -ItemType Directory -Path (Join-Path $teamsDir "team-abc") -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $teamsDir "team-xyz") -Force | Out-Null
        $TEAMS_DIR = $teamsDir
        Test-ActiveTeams | Should -Be $false
    }

    It "returns true when a subdir contains config.json" {
        Invoke-Expression $script:DaemonFunctionDefs
        $teamsDir = Join-Path $script:testRoot "teams"
        $teamDir = Join-Path $teamsDir "team-abc"
        New-Item -ItemType Directory -Path $teamDir -Force | Out-Null
        Set-Content -Path (Join-Path $teamDir "config.json") -Value "{}"
        $TEAMS_DIR = $teamsDir
        Test-ActiveTeams | Should -Be $true
    }
}

Describe "Test-AppRunning" {
    It "returns false when no process matches APP_PATH" {
        Invoke-Expression $script:DaemonFunctionDefs
        $APP_PATH = "C:\nonexistent\fake-app-12345.exe"
        Test-AppRunning | Should -Be $false
    }

    It "returns true when a process path matches APP_PATH" {
        Invoke-Expression $script:DaemonFunctionDefs
        $currentProc = Get-Process -Id $PID
        $APP_PATH = $currentProc.Path
        Test-AppRunning | Should -Be $true
    }
}

Describe "Test-AppRunning -ErrorAction placement" {
    It "has -ErrorAction on Get-Process, not on Where-Object" {
        $scriptPath = Join-Path $PSScriptRoot "..\..\scripts\agent-monitor-daemon.ps1"
        $content = Get-Content -Path $scriptPath -Raw

        $content | Should -Match 'Get-Process\s+-ErrorAction'
        $content | Should -Not -Match 'Where-Object\s+.*-ErrorAction'
    }
}

Describe "Write-Log" {
    BeforeEach {
        $script:testRoot = Join-Path $env:TEMP "daemon-log-test-$(Get-Random)"
        New-Item -ItemType Directory -Path $script:testRoot -Force | Out-Null
    }

    AfterEach {
        if (Test-Path $script:testRoot) {
            Remove-Item -Path $script:testRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    It "writes a timestamped entry to LOG_PATH" {
        Invoke-Expression $script:DaemonFunctionDefs
        $LOG_PATH = Join-Path $script:testRoot "daemon.log"
        Write-Log -Message "Test message"
        $LOG_PATH | Should -Exist
        $logContent = Get-Content -Path $LOG_PATH -Raw
        $logContent | Should -Match '\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] AgentMonitor: Test message'
    }

    It "uses INSTALL_DIR/daemon.log as the log path in source" {
        $scriptPath = Join-Path $PSScriptRoot "..\..\scripts\agent-monitor-daemon.ps1"
        $content = Get-Content -Path $scriptPath -Raw
        $content | Should -Match '\$LOG_PATH\s*=\s*Join-Path\s+\$INSTALL_DIR\s+"daemon\.log"'
    }
}

Describe "PS 5.1 compatibility" {
    It "does not use the ?? (null-coalescing) operator" {
        $scriptPath = Join-Path $PSScriptRoot "..\..\scripts\agent-monitor-daemon.ps1"
        $lines = Get-Content -Path $scriptPath
        foreach ($line in $lines) {
            $trimmed = $line.TrimStart()
            if ($trimmed.StartsWith('#')) { continue }
            $line | Should -Not -Match '\?\?' -Because "?? operator is not supported in PS 5.1"
        }
    }

    It "uses if/else for localAppData fallback, not ??" {
        $scriptPath = Join-Path $PSScriptRoot "..\..\scripts\agent-monitor-daemon.ps1"
        $content = Get-Content -Path $scriptPath -Raw
        $content | Should -Match '\$localAppData\s*=\s*if\s*\('
    }
}
