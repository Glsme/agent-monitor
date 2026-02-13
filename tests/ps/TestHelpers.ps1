# TestHelpers.ps1 - Shared helpers for Pester tests
#
# Usage: dot-source this file, then call Get-ScriptFunctionsPath to get
# a temp file you can dot-source in your own scope.

function Get-ScriptFunctionsPath {
    <#
    .SYNOPSIS
        Extracts function definitions from a script file (everything before
        "# ---- Main ----"), replaces exit calls with throw, and returns
        the path to a temp file containing those definitions.
        The caller must dot-source the returned path in their own scope.
    #>
    param(
        [Parameter(Mandatory)]
        [string]$ScriptPath
    )

    if (-not (Test-Path $ScriptPath)) {
        throw "Script not found: $ScriptPath"
    }

    $content = Get-Content -Path $ScriptPath -Raw

    # Find the main marker and extract everything before it
    $markerIndex = $content.IndexOf("# ---- Main ----")
    if ($markerIndex -lt 0) {
        throw "Could not find '# ---- Main ----' marker in $ScriptPath"
    }

    $functionDefs = $content.Substring(0, $markerIndex)

    # Remove exit calls so they don't terminate the test runner
    $functionDefs = $functionDefs -replace '\bexit\s+\d+', 'throw "ExitCalled"'

    # Save to a temp file - caller must dot-source it
    $tempFile = Join-Path $env:TEMP "pester-functions-$(Get-Random).ps1"
    Set-Content -Path $tempFile -Value $functionDefs -Encoding UTF8
    return $tempFile
}
