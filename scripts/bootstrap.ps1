[CmdletBinding()]
param(
    [string]$Preset = "default",
    [switch]$SkipVcpkg,
    [switch]$SkipConfigure
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Checked {
    param(
        [Parameter(Mandatory)]
        [string]$Command,
        [string[]]$Arguments = @()
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')"
    }
}

$workspaceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$vcpkgDirectory = Join-Path $workspaceRoot ".cache\vcpkg"
$vcpkgVersion = (Get-Content -Raw -LiteralPath (Join-Path $workspaceRoot "tools\vcpkg-version.txt")).Trim()
$vcpkgCommit = (Get-Content -Raw -LiteralPath (Join-Path $workspaceRoot "tools\vcpkg-commit.txt")).Trim()

foreach ($requiredCommand in @("git", "cmake", "ninja")) {
    if ($null -eq (Get-Command $requiredCommand -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $requiredCommand"
    }
}

if ($null -ne (Get-Command "python" -ErrorAction SilentlyContinue)) {
    Invoke-Checked "python" @(
        "-c",
        "import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 'Python 3.12+ is required')"
    )
} elseif ($null -ne (Get-Command "py" -ErrorAction SilentlyContinue)) {
    Invoke-Checked "py" @(
        "-3.12",
        "-c",
        "import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 'Python 3.12+ is required')"
    )
} else {
    throw "Python 3.12 or newer is required"
}

if (-not $SkipVcpkg) {
    if (-not (Test-Path -LiteralPath $vcpkgDirectory)) {
        $vcpkgParent = Split-Path -Parent $vcpkgDirectory
        New-Item -ItemType Directory -Force -Path $vcpkgParent | Out-Null
        Invoke-Checked "git" @(
            "clone",
            "--branch", $vcpkgVersion,
            "--depth", "1",
            "https://github.com/microsoft/vcpkg.git",
            $vcpkgDirectory
        )
    } elseif (-not (Test-Path -LiteralPath (Join-Path $vcpkgDirectory ".git"))) {
        throw "$vcpkgDirectory exists but is not a vcpkg Git checkout"
    }

    $installedCommit = (& git -C $vcpkgDirectory rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect the vcpkg checkout"
    }
    if ($installedCommit -ne $vcpkgCommit) {
        throw "vcpkg checkout is $installedCommit; expected $vcpkgCommit. Remove $vcpkgDirectory deliberately, then rerun bootstrap."
    }

    Invoke-Checked (Join-Path $vcpkgDirectory "bootstrap-vcpkg.bat") @("-disableMetrics")
}

if (-not $SkipConfigure) {
    Push-Location -LiteralPath $workspaceRoot
    try {
        Invoke-Checked "cmake" @("--preset", $Preset)
    } finally {
        Pop-Location
    }
}

Write-Host "CCA workspace bootstrap complete."
if (-not $SkipConfigure) {
    Write-Host "Next: cmake --build --preset $Preset"
}
