# Uninstall.Tests.ps1 - Tests for scripts/uninstall.ps1

BeforeAll {
    $script:uninstallScriptPath = Join-Path $PSScriptRoot "..\..\scripts\uninstall.ps1"
    $script:scriptContent = Get-Content -Path $script:uninstallScriptPath -Raw
}

Describe "Process termination" {
    It "uses path-based Get-Process filtering" {
        $script:scriptContent | Should -Match 'Get-Process.*Where-Object.*\$_\.Path\s+-eq'
    }

    It "uses Get-CimInstance (not Get-WmiObject) for daemon process" {
        $script:scriptContent | Should -Match 'Get-CimInstance\s+Win32_Process'
        $script:scriptContent | Should -Not -Match 'Get-WmiObject'
    }

    It "filters daemon by CommandLine containing agent-monitor-daemon" {
        $script:scriptContent | Should -Match 'CommandLine.*agent-monitor-daemon'
    }
}

Describe "Scheduled task removal" {
    It "calls schtasks /Delete with correct task name" {
        $script:scriptContent | Should -Match 'schtasks\s+/Delete\s+/TN\s+\$TASK_NAME'
    }

    It "uses /F flag for forced deletion" {
        $script:scriptContent | Should -Match 'schtasks\s+/Delete\s+/TN\s+\$TASK_NAME\s+/F'
    }

    It "task name matches the install script task name" {
        $installContent = Get-Content -Path (Join-Path $PSScriptRoot "..\..\scripts\install.ps1") -Raw

        # Extract TASK_NAME from both scripts
        $uninstallMatch = [regex]::Match($script:scriptContent, '\$TASK_NAME\s*=\s*"([^"]+)"')
        $installMatch = [regex]::Match($installContent, '\$TASK_NAME\s*=\s*"([^"]+)"')

        $uninstallMatch.Success | Should -Be $true
        $installMatch.Success | Should -Be $true
        $uninstallMatch.Groups[1].Value | Should -Be $installMatch.Groups[1].Value
    }
}

Describe "File cleanup" {
    It "removes APP_PATH" {
        $script:scriptContent | Should -Match 'Remove-Item\s+-Path\s+\$APP_PATH'
    }

    It "removes INSTALL_DIR recursively" {
        $script:scriptContent | Should -Match 'Remove-Item\s+-Path\s+\$INSTALL_DIR\s+-Recurse'
    }

    It "removes empty APP_DIR" {
        $script:scriptContent | Should -Match 'Remove-Item\s+-Path\s+\$APP_DIR'
    }
}

Describe "Idempotent uninstall" {
    It "handles already-removed app with Test-Path check" {
        $script:scriptContent | Should -Match 'if\s*\(Test-Path\s+\$APP_PATH\)'
        $script:scriptContent | Should -Match 'already removed'
    }

    It "handles already-removed install directory" {
        $script:scriptContent | Should -Match 'if\s*\(Test-Path\s+\$INSTALL_DIR\)'
        $script:scriptContent | Should -Match 'already removed'
    }

    It "uses SilentlyContinue ErrorActionPreference" {
        $script:scriptContent | Should -Match '\$ErrorActionPreference\s*=\s*"SilentlyContinue"'
    }
}

Describe "localAppData fallback" {
    It "uses if/else for PS 5.1 compatibility" {
        $script:scriptContent | Should -Match '\$localAppData\s*=\s*if\s*\('
    }

    It "falls back to USERPROFILE\AppData\Local" {
        $script:scriptContent | Should -Match 'Join-Path\s+\$env:USERPROFILE\s+"AppData\\Local"'
    }

    It "does not use ?? operator" {
        $lines = Get-Content -Path $script:uninstallScriptPath
        foreach ($line in $lines) {
            $trimmed = $line.TrimStart()
            if ($trimmed.StartsWith('#')) { continue }
            $line | Should -Not -Match '\?\?' -Because "?? operator is not supported in PS 5.1"
        }
    }
}
