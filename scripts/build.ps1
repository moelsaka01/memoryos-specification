[CmdletBinding()]
param(
    [string]$Preset = "default",
    [switch]$SkipTests
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$workspaceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

Push-Location -LiteralPath $workspaceRoot
try {
    cmake --preset $Preset
    if ($LASTEXITCODE -ne 0) { throw "CMake configure failed" }

    cmake --build --preset $Preset
    if ($LASTEXITCODE -ne 0) { throw "CMake build failed" }

    if (-not $SkipTests -and $Preset -ne "minimal") {
        ctest --preset $Preset
        if ($LASTEXITCODE -ne 0) { throw "CTest failed" }
    }
} finally {
    Pop-Location
}
