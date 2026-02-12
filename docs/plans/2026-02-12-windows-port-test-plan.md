# Windows Port Test Plan

## Overview

Add test coverage for the Windows port of Agent Monitor. Three parallel work streams covering cli.js unit tests (Vitest), PowerShell install/uninstall tests (Pester), and daemon + cross-platform parity tests (Pester + Vitest).

## Scope

Scripts & CLI only: `npm/bin/cli.js`, `scripts/install.ps1`, `scripts/uninstall.ps1`, `scripts/agent-monitor-daemon.ps1`.

## Architecture

| Stream | Tests | Framework | Runs on |
|--------|-------|-----------|---------|
| A: cli.js unit tests | 15 | Vitest | Any OS (mocked) |
| B: install/uninstall tests | 15 | Pester | Windows |
| C: daemon + parity tests | 15 | Pester + Vitest | Daemon: Windows, Parity: Any OS |

Total: ~45 test cases.

## File Structure

```
tests/
  cli/
    cli.test.js        # Stream A: cli.js unit tests
    parity.test.js     # Stream C: cross-platform parity assertions
    helpers.js         # Shared mocks/fixtures for Vitest
  ps/
    Install.Tests.ps1  # Stream B: install.ps1 tests
    Uninstall.Tests.ps1 # Stream B: uninstall.ps1 tests
    Daemon.Tests.ps1   # Stream C: daemon.ps1 tests
    TestHelpers.ps1    # Shared Pester helpers
```

## Stream A: cli.js Unit Tests (Vitest)

Test cli.js platform-specific logic by mocking `os`, `fs`, `child_process`.

1. Platform detection: `IS_WINDOWS`/`IS_MACOS` based on `os.platform()`
2. Path resolution: `APP_DIR`, `APP_PATH` correct for each platform
3. `getArch()`: returns arm64, x64, or null
4. `findFile()`: finds exe in nested dirs, returns null when missing
5. `setupDaemon()` Windows: generates PS script with Write-Log, config.json check, path-based Get-Process; calls schtasks with RemoteSigned
6. `setupDaemon()` macOS: generates bash script with `has_active_teams()`, creates plist, calls launchctl
7. `launchApp()`: Windows uses spawn(detached), macOS uses execSync(open)
8. `uninstall()` Windows: kills processes before file removal, deletes scheduled task
9. `uninstall()` macOS: calls launchctl unload, removes plist
10. `installApp()` fallback: Windows shows irm, macOS shows curl
11. Post-install output: Windows shows open/status/uninstall, macOS shows native path + CLI
12. LOCALAPPDATA fallback when env var missing
13. Asset name: correct zip name per platform + arch
14. Windows extraction: fallback search when exe not at root of zip
15. `showStatus()`: Windows queries schtasks, macOS checks plist existence

## Stream B: PowerShell Install/Uninstall Tests (Pester)

### install.ps1

1. `Get-AssetName`: correct zip for AMD64, ARM64, null for unknown
2. `Try-DownloadBinary`: returns $false when asset name is null
3. `Try-DownloadBinary`: extraction fallback searches subdirectories
4. `Test-BuildDeps`: detects missing Node.js/npm/Rust
5. `Install-Daemon` script content: includes Write-Log, Test-AppRunning, Test-ActiveTeams, config.json check
6. `Install-Daemon` schtasks: uses RemoteSigned, ONLOGON, LIMITED
7. `Write-Banner`: Cyan border + Green "Agent Monitor"
8. `Write-Done`: correct log path, no emoji, includes "View logs"
9. PS 5.1 compat: no ?? operator, $localAppData uses if/else
10. `$APP_DIR` fallback when LOCALAPPDATA empty

### uninstall.ps1

11. Process termination: path-based Get-Process, Get-CimInstance (not Get-WmiObject)
12. Scheduled task removal: schtasks /Delete with correct name
13. File cleanup: removes app and install directory
14. Idempotent: handles already-removed components
15. `$localAppData` fallback: PS 5.1 compatible

## Stream C: Daemon + Parity Tests

### Daemon tests (Pester)

1. `Test-ActiveTeams` false: teams dir doesn't exist
2. `Test-ActiveTeams` false: subdirs without config.json
3. `Test-ActiveTeams` true: subdir with config.json
4. `Test-AppRunning` false: no matching process path
5. `Test-AppRunning` true: matching process path
6. `Test-AppRunning`: -ErrorAction on Get-Process not Where-Object
7. `Write-Log`: timestamped entries in correct format
8. `Write-Log` path: $INSTALL_DIR/daemon.log (not $env:TEMP)
9. `$localAppData`: PS 5.1 compatible, no ?? operator
10. Main loop: no launch when no teams

### Cross-platform parity (Vitest, static analysis)

11. Daemon detection parity: both .sh and .ps1 check config.json
12. cli.js inline daemon parity: macOS and Windows both check config.json
13. All 3 Windows daemons identical: cli.js, install.ps1, standalone all have Write-Log + Test-AppRunning + Test-ActiveTeams
14. ExecutionPolicy consistent: zero Bypass, all RemoteSigned
15. No PS 7+ syntax: no ??, ?., ternary in any .ps1 file

## Setup (prerequisite)

1. Add vitest to devDependencies
2. Add "test" and "test:ps" scripts to package.json
3. Create tests/ directory structure
4. Add vitest.config.js
