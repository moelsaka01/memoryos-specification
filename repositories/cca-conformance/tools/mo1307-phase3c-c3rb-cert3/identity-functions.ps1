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
