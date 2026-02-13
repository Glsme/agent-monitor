# Install.Tests.ps1 - Tests for scripts/install.ps1

BeforeAll {
    . (Join-Path $PSScriptRoot "TestHelpers.ps1")
    $scriptPath = Join-Path $PSScriptRoot "..\..\scripts\install.ps1"
    $tempFunctions = Get-ScriptFunctionsPath -ScriptPath $scriptPath
    . $tempFunctions
    Remove-Item -Path $tempFunctions -Force -ErrorAction SilentlyContinue
}

Describe "Get-AssetName" {
    AfterEach {
        # Restore real arch in case a test changed it
        $env:PROCESSOR_ARCHITECTURE = $script:originalArch
    }

    BeforeAll {
        $script:originalArch = $env:PROCESSOR_ARCHITECTURE
    }

    It "returns x64 zip for AMD64 architecture" {
        $env:PROCESSOR_ARCHITECTURE = "AMD64"
        Get-AssetName | Should -Be "AgentMonitor-windows-x64.zip"
    }

    It "returns arm64 zip for ARM64 architecture" {
        $env:PROCESSOR_ARCHITECTURE = "ARM64"
        Get-AssetName | Should -Be "AgentMonitor-windows-arm64.zip"
    }

    It "returns null for unknown architecture" {
        $env:PROCESSOR_ARCHITECTURE = "IA64"
        Mock Write-Host {}
        $result = Get-AssetName
        $result | Should -BeNullOrEmpty
    }
}

Describe "Try-DownloadBinary" {
    It "returns false when asset name is null" {
        $result = Try-DownloadBinary -AssetName $null
        $result | Should -Be $false
    }

    It "returns false when asset name is empty string" {
        $result = Try-DownloadBinary -AssetName ""
        $result | Should -Be $false
    }

    Context "extraction fallback" {
        It "searches subdirectories when exe not at root of zip" {
            $scriptContent = Get-Content -Path (Join-Path $PSScriptRoot "..\..\scripts\install.ps1") -Raw
            $scriptContent | Should -Match 'Get-ChildItem\s+-Path\s+\$tmpExtract\s+-Filter\s+"\*\.exe"\s+-Recurse'
        }
    }
}

Describe "Test-BuildDeps" {
    It "detects missing Node.js" {
        Mock Get-Command { $null } -ParameterFilter { $Name -eq "node" }
        Mock Write-Host {}
        { Test-BuildDeps } | Should -Throw "ExitCalled"
    }

    It "detects missing npm when Node.js is present" {
        Mock Get-Command { [PSCustomObject]@{ Name = "node" } } -ParameterFilter { $Name -eq "node" }
        Mock Get-Command { $null } -ParameterFilter { $Name -eq "npm" }
        Mock node { "v20.0.0" }
        Mock Write-Host {}
        { Test-BuildDeps } | Should -Throw "ExitCalled"
    }
}

Describe "Install-Daemon" {
    BeforeAll {
        # Extract the daemon here-string from install.ps1 source to test its content
        # without actually running schtasks (which requires admin privileges)
        $srcContent = Get-Content -Path (Join-Path $PSScriptRoot "..\..\scripts\install.ps1") -Raw
        $hereStringStart = $srcContent.IndexOf('$daemonScript = @"')
        $hereStringEnd = $srcContent.IndexOf('"@', $hereStringStart + 20)
        $script:daemonTemplate = $srcContent.Substring($hereStringStart, $hereStringEnd - $hereStringStart + 2)
    }

    It "daemon script content includes Write-Log function" {
        $script:daemonTemplate | Should -Match 'function Write-Log'
    }

    It "daemon script content includes Test-AppRunning function" {
        $script:daemonTemplate | Should -Match 'function Test-AppRunning'
    }

    It "daemon script content includes Test-ActiveTeams function" {
        $script:daemonTemplate | Should -Match 'function Test-ActiveTeams'
    }

    It "daemon script content includes config.json check" {
        $script:daemonTemplate | Should -Match 'config\.json'
    }

    It "schtasks command uses RemoteSigned execution policy" {
        $srcContent = Get-Content -Path (Join-Path $PSScriptRoot "..\..\scripts\install.ps1") -Raw
        $srcContent | Should -Match 'RemoteSigned'
    }

    It "schtasks command uses ONLOGON schedule" {
        $srcContent = Get-Content -Path (Join-Path $PSScriptRoot "..\..\scripts\install.ps1") -Raw
        $srcContent | Should -Match '/SC\s+ONLOGON'
    }

    It "schtasks command uses LIMITED run level" {
        $srcContent = Get-Content -Path (Join-Path $PSScriptRoot "..\..\scripts\install.ps1") -Raw
        $srcContent | Should -Match '/RL\s+LIMITED'
    }
}

Describe "Write-Banner" {
    It "uses cyan foreground for border" {
        $srcContent = Get-Content -Path (Join-Path $PSScriptRoot "..\..\scripts\install.ps1") -Raw
        $srcContent | Should -Match 'Write-Host.*ForegroundColor Cyan'
    }

    It "uses green foreground for Agent Monitor text" {
        $srcContent = Get-Content -Path (Join-Path $PSScriptRoot "..\..\scripts\install.ps1") -Raw
        $srcContent | Should -Match '"Agent Monitor".*-ForegroundColor Green'
    }
}

Describe "Write-Done" {
    It "includes correct log path reference" {
        $srcContent = Get-Content -Path (Join-Path $PSScriptRoot "..\..\scripts\install.ps1") -Raw
        $srcContent | Should -Match 'daemon\.log'
        $srcContent | Should -Match 'View logs'
    }

    It "does not use emoji characters in output strings" {
        $scriptPath = Join-Path $PSScriptRoot "..\..\scripts\install.ps1"
        $srcContent = Get-Content -Path $scriptPath -Raw
        # Extract Write-Done function body
        $doneStart = $srcContent.IndexOf("function Write-Done")
        $doneEnd = $srcContent.IndexOf("# ---- Main ----")
        $doneBody = $srcContent.Substring($doneStart, $doneEnd - $doneStart)
        # Box-drawing characters are acceptable; actual emoji (U+1F300+) are not
        # Use .NET regex with Unicode escape for emoji range
        $emojiPattern = [regex]::new('[\uD83C-\uD83F][\uDC00-\uDFFF]')
        $emojiPattern.IsMatch($doneBody) | Should -Be $false -Because "Write-Done should not contain emoji characters"
    }
}

Describe "PS 5.1 compatibility" {
    It "does not use the ?? (null-coalescing) operator" {
        $scriptPath = Join-Path $PSScriptRoot "..\..\scripts\install.ps1"
        $lines = Get-Content -Path $scriptPath
        foreach ($line in $lines) {
            $trimmed = $line.TrimStart()
            if ($trimmed.StartsWith('#')) { continue }
            $line | Should -Not -Match '\?\?' -Because "?? operator is not supported in PS 5.1"
        }
    }

    It "uses if/else for localAppData fallback" {
        $scriptPath = Join-Path $PSScriptRoot "..\..\scripts\install.ps1"
        $content = Get-Content -Path $scriptPath -Raw
        $content | Should -Match '\$localAppData\s*=\s*if\s*\('
    }

    It "APP_DIR falls back when LOCALAPPDATA is empty" {
        $scriptPath = Join-Path $PSScriptRoot "..\..\scripts\install.ps1"
        $content = Get-Content -Path $scriptPath -Raw
        $content | Should -Match 'Join-Path\s+\$env:USERPROFILE\s+"AppData\\Local"'
    }
}
