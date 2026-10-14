[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$workspaceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

if ($null -eq (Get-Command "gcovr" -ErrorAction SilentlyContinue)) {
    throw "gcovr is required; install tools/requirements-ci.txt"
}

Push-Location -LiteralPath $workspaceRoot
try {
    cmake --preset coverage
    if ($LASTEXITCODE -ne 0) { throw "Coverage configuration failed" }

    cmake --build --preset coverage
    if ($LASTEXITCODE -ne 0) { throw "Coverage build failed" }

    ctest --preset coverage
    if ($LASTEXITCODE -ne 0) { throw "Coverage test run failed" }

    cmake --build --preset coverage --target cca_coverage
    if ($LASTEXITCODE -ne 0) { throw "Coverage report generation failed" }
} finally {
    Pop-Location
}

Write-Host "Coverage report: $workspaceRoot\out\build\coverage\coverage\index.html"
