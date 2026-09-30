# Engineering Git validation only. Not loaded by product code.
Set-StrictMode -Version 2.0
function Get-EngineeringIdentity([string] $Executable) {
    if (-not [IO.Path]::IsPathRooted($Executable)) { throw 'ENGINEERING_GIT_PATH: absolute path required' }
    if (-not [IO.File]::Exists($Executable)) { throw 'ENGINEERING_GIT_MISSING: executable does not exist' }
    $attributes = [IO.File]::GetAttributes($Executable)
    if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'ENGINEERING_GIT_FILE: reparse executable refused' }
    $bytes = [IO.File]::ReadAllBytes($Executable)
    $digest = [Security.Cryptography.SHA256]::Create()
    try { $hash = ([BitConverter]::ToString($digest.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() } finally { $digest.Dispose() }
    return @{ absolute=$Executable; byteLength=$bytes.Length; sha256=('sha256:'+$hash) }
}
function Assert-EngineeringIdentity($Record) {
    $actual = Get-EngineeringIdentity $Record.absolute
    if ($actual.byteLength -ne $Record.byteLength -or $actual.sha256 -cne $Record.sha256) { throw 'ENGINEERING_GIT_IDENTITY: length or SHA256 mismatch' }
}
function Invoke-EngineeringGit([string[]] $Arguments) {
    Assert-EngineeringIdentity $script:EngineeringGit.git
    if ($null -ne $script:EngineeringGit.core) { Assert-EngineeringIdentity $script:EngineeringGit.core }
    $global:LASTEXITCODE = $null
    try { $output = @(& $script:EngineeringGit.git.absolute @Arguments 2>&1) } catch { throw ('ENGINEERING_GIT_EXECUTION: ' + $_.Exception.GetType().Name) }
    if ($null -eq $LASTEXITCODE -or $LASTEXITCODE -ne 0) { throw ('ENGINEERING_GIT_EXIT: ' + $LASTEXITCODE) }
    Assert-EngineeringIdentity $script:EngineeringGit.git
    if ($null -ne $script:EngineeringGit.core) { Assert-EngineeringIdentity $script:EngineeringGit.core }
    return $output
}
function Initialize-EngineeringGit([string] $Executable, [string] $Manifest) {
    $script:EngineeringGit = [IO.File]::ReadAllText($Manifest) | ConvertFrom-Json
    if (-not [IO.Path]::IsPathRooted($Executable)) { throw 'ENGINEERING_GIT_PATH: absolute path required' }
    if ([IO.Path]::GetFullPath($Executable) -cne [IO.Path]::GetFullPath($script:EngineeringGit.git.absolute)) { throw 'ENGINEERING_GIT_PATH: explicit path differs from sealed manifest' }
    Assert-EngineeringIdentity $script:EngineeringGit.git
    $version = ((Invoke-EngineeringGit @('--version')) -join [Environment]::NewLine).Trim()
    if ($version -cne $script:EngineeringGit.git.version) { throw 'ENGINEERING_GIT_VERSION: unexpected version' }
    return @{ result='PASS_ENGINEERING_ONLY'; version=$version; absolute=$Executable; sha256=$script:EngineeringGit.git.sha256; ambientPathFallback=$false }
}
