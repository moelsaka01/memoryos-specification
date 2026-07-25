[CmdletBinding()]
param(
    [switch]$Fix
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$workspaceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$arguments = @(
    (Join-Path $workspaceRoot "tools\run_clang_format.py"),
    "--root",
    $workspaceRoot
)
if ($Fix) {
    $arguments += "--fix"
}

if ($null -ne (Get-Command "python" -ErrorAction SilentlyContinue)) {
    & python @arguments
} elseif ($null -ne (Get-Command "py" -ErrorAction SilentlyContinue)) {
    & py -3.12 @arguments
} else {
    throw "Python 3.12 or newer is required"
}
if ($LASTEXITCODE -ne 0) { throw "clang-format validation failed" }
