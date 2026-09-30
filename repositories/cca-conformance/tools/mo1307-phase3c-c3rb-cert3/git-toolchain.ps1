# Engineering-only exact process ownership; no LASTEXITCODE, native call operator or pipeline.
Set-StrictMode -Version 2.0
. (Join-Path $PSScriptRoot 'identity-functions.ps1')
if (-not ('EngineeringProcessCapture' -as [type])) { Add-Type -Path (Join-Path $PSScriptRoot 'engineering-process.cs') }
function Write-EngineeringCapture($Capture) {
    if ($script:EngineeringGit.PSObject.Properties.Name -contains 'captureDirectory') {
        $directory = $script:EngineeringGit.captureDirectory
        if (-not [IO.Path]::IsPathRooted($directory)) { throw 'ENGINEERING_GIT_AUDIT: absolute capture directory required' }
        [void][IO.Directory]::CreateDirectory($directory)
        $destination = Join-Path $directory ('powershell-' + [Guid]::NewGuid().ToString('N') + '.json')
        $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($Capture | ConvertTo-Json -Depth 12) + "`n")
        $stream = [IO.FileStream]::new($destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
        try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
    }
}
function Get-EngineeringGitCapture([string[]] $Arguments, [int] $TimeoutMs = 60000, [int] $MaxBytesPerStream = 67108864) {
    $capture = [ordered]@{ kind='EngineeringGitProcessCapture'; engine='System.Diagnostics.Process'; executable=$script:EngineeringGit.git.absolute; arguments=$Arguments; cwd=[Environment]::CurrentDirectory; startedAt=[DateTime]::UtcNow.ToString('o'); classification='WRAPPER_FAILED'; code=$null; actualExitCode=$null; child=$null; ambientPathFallback=$false; limits=@{timeoutMs=$TimeoutMs;maxBytesPerStream=$MaxBytesPerStream;eachEngineeringDrainOrKillGuardMs=2000;maximumEngineeringPostTimeoutGuards=3;processTreeCleanupEstablished=$false;productDeadlineEvidence=$false} }
    try {
        Assert-EngineeringIdentity $script:EngineeringGit.git
        if ($null -ne $script:EngineeringGit.core) { Assert-EngineeringIdentity $script:EngineeringGit.core }
        $r = [EngineeringProcessCapture]::Run($script:EngineeringGit.git.absolute, $Arguments, [Environment]::CurrentDirectory, $TimeoutMs, $MaxBytesPerStream)
        $capture.child = $r
        if ($r.exitObserved) { $capture.actualExitCode = $r.exitCode }
        if (-not $r.started) { $capture.code = 'ENGINEERING_GIT_EXECUTION' }
        elseif ($r.timedOut) { $capture.code = 'ENGINEERING_GIT_TIMEOUT' }
        elseif ($r.outputLimitExceeded) { $capture.code = 'ENGINEERING_GIT_OUTPUT_LIMIT' }
        elseif ($r.wrapperError -or -not $r.outputComplete) { $capture.code = 'ENGINEERING_GIT_CAPTURE' }
        elseif (-not $r.exitObserved) { $capture.code = 'ENGINEERING_GIT_EXIT_UNOBSERVED' }
        else {
            Assert-EngineeringIdentity $script:EngineeringGit.git
            if ($null -ne $script:EngineeringGit.core) { Assert-EngineeringIdentity $script:EngineeringGit.core }
            if ($r.exitCode -eq 0) { $capture.classification = 'GIT_SUCCEEDED'; $capture.code = 'OK' }
            else { $capture.classification = 'GIT_FAILED'; $capture.code = 'ENGINEERING_GIT_EXIT' }
        }
    } catch { $capture.code = ($_.Exception.Message -split ':',2)[0]; $capture.error = $_.Exception.Message }
    $capture.finishedAt = [DateTime]::UtcNow.ToString('o')
    $script:LastEngineeringGitCapture = $capture
    try { Write-EngineeringCapture $capture } catch { $capture.classification = 'WRAPPER_FAILED'; $capture.code = 'ENGINEERING_GIT_AUDIT'; $capture.error = $_.Exception.Message }
    return $capture
}
function Invoke-EngineeringGit([string[]] $Arguments) {
    $r = Get-EngineeringGitCapture $Arguments
    if ($r.classification -cne 'GIT_SUCCEEDED') { throw ($r.code + ': classification=' + $r.classification + '; observedGitExit=' + $r.actualExitCode) }
    return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($r.child.stdoutBase64))
}
function Initialize-EngineeringGit([string] $Executable, [string] $Manifest) {
    $script:EngineeringGit = [IO.File]::ReadAllText($Manifest) | ConvertFrom-Json
    if (-not [IO.Path]::IsPathRooted($Executable)) { throw 'ENGINEERING_GIT_PATH: absolute path required' }
    if ([IO.Path]::GetFullPath($Executable) -cne [IO.Path]::GetFullPath($script:EngineeringGit.git.absolute)) { throw 'ENGINEERING_GIT_PATH: explicit path differs from sealed manifest' }
    $version = (Invoke-EngineeringGit @('--version')).Trim()
    if ($version -cne $script:EngineeringGit.git.version) { throw 'ENGINEERING_GIT_VERSION: unexpected version' }
    return @{ result='PASS_ENGINEERING_ONLY'; version=$version; absolute=$Executable; sha256=$script:EngineeringGit.git.sha256; ambientPathFallback=$false; exitCapture='Explicit Process.ExitCode and separate bounded byte streams' }
}
