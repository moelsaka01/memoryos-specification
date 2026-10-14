[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$workspaceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

Push-Location -LiteralPath $workspaceRoot
try {
    cmake --preset analysis
    if ($LASTEXITCODE -ne 0) { throw "Analysis configuration failed" }

    cmake --build --preset analysis
    if ($LASTEXITCODE -ne 0) { throw "clang-tidy build failed" }
} finally {
    Pop-Location
}
