param([Parameter(Mandatory=$true)][string]$Pending)
$ErrorActionPreference = 'Stop'
$handle = [IO.File]::Open($Pending, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
try {
    [Console]::Out.WriteLine('LOCK_READY')
    [Console]::Out.Flush()
    [void][Console]::In.ReadLine()
} finally {
    $handle.Dispose()
}
