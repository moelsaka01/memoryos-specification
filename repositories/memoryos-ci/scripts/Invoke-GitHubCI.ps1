param(
  [Parameter(Mandatory=$true)][ValidateSet('Evaluate','Gate')][string]$Mode,
  [Parameter(Mandatory=$true)][string]$WorkspaceRoot,
  [Parameter(Mandatory=$true)][string]$ConfigurationDigest,
  [Parameter(Mandatory=$true)][string]$DistributionDigest
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if ($Mode -ceq 'Gate') {
  $validCode = $env:EXIT_CODE -cmatch '^(?:0|6|7|1[0-7])$'
  if ($env:COMPLETE -cne 'true' -or $env:EVALUATE_OUTCOME -cne 'success') {
    if ($validCode -and [int]$env:EXIT_CODE -ge 10) { exit ([int]$env:EXIT_CODE) }
    exit 16
  }
  if (-not $validCode -or $env:RUN_ID -cnotmatch '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') { exit 16 }
  if ($env:UPLOAD_OUTCOME -cne 'success') { exit 17 }
}
try {
  foreach ($capability in @($WorkspaceRoot,$env:MEMORYOS_CI_HOME,$env:MEMORYOS_CI_CONFIG)) {
    if ([string]::IsNullOrEmpty($capability) -or $capability.Length -gt 240 -or $capability -notmatch '^[A-Za-z]:[\\/]' -or $capability.Substring(2) -match '[:"''\x00-\x1f\x7f\x60$;|&<>{}\[\]()!*?]') { throw 'path' }
    if ([IO.Path]::GetFullPath($capability) -cne $capability.Replace('/','\')) { throw 'path' }
    $cursor = $capability
    while ($cursor) {
      if (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'reparse' }
      $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
  }
  if ($env:MEMORYOS_CI_HOME -cne [IO.Path]::Combine($WorkspaceRoot,'_memoryos\tool\repositories\memoryos-ci')) { throw 'home' }
  $trustedPrefix = [IO.Path]::Combine($WorkspaceRoot,'_memoryos\tool')+'\'
  if (-not $env:MEMORYOS_CI_CONFIG.StartsWith($trustedPrefix,[StringComparison]::Ordinal)) { throw 'config' }
  $nodePath = [IO.Path]::Combine($WorkspaceRoot,'_memoryos\runtime\node.exe')
  $cursor = $nodePath
  while ($cursor) {
    if (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'reparse' }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
  if ((Get-Item -LiteralPath $nodePath).Length -ne 93580104 -or (Get-FileHash -LiteralPath $nodePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32') { throw 'node' }
  if ($ConfigurationDigest -cnotmatch '^sha256:[a-f0-9]{64}$' -or $DistributionDigest -cnotmatch '^sha256:[a-f0-9]{64}$') { throw 'pin' }
  if ('sha256:'+(Get-FileHash -LiteralPath ([IO.Path]::Combine($env:MEMORYOS_CI_HOME,'distribution-manifest.json')) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $DistributionDigest) { throw 'distribution' }
  foreach ($name in @('NODE_OPTIONS','NODE_PATH','NODE_INSPECT_RESUME_ON_START','NODE_REPL_EXTERNAL_MODULE')) { [Environment]::SetEnvironmentVariable($name,$null) }
  $env:MEMORYOS_CI_NODE = $nodePath
  $transport = [IO.Path]::Combine($env:MEMORYOS_CI_HOME,'scripts\github-transport.mjs')
  if ($Mode -ceq 'Gate') {
    & $nodePath '--max-old-space-size=128' $transport 'gate' $WorkspaceRoot $ConfigurationDigest $DistributionDigest
    $gateExit = $LASTEXITCODE
    exit $gateExit
  }
  # The common launcher writes canonical LF directly to Console.Out. Capture
  # that bounded record in-process without adding a launcher child process.
  $priorOutput = [Console]::Out
  $capture = New-Object IO.StringWriter
  try {
    [Console]::SetOut($capture)
    $global:LASTEXITCODE = $null
    $unexpected = @(& ([IO.Path]::Combine($env:MEMORYOS_CI_HOME,'scripts\Invoke-MemoryOSCI.ps1')) -Provider 'github' -Workspace ([IO.Path]::Combine($WorkspaceRoot,'_memoryos\data')) -ConfigurationDigest $ConfigurationDigest -DistributionDigest $DistributionDigest)
    $code = $LASTEXITCODE
  } finally {
    [Console]::SetOut($priorOutput)
  }
  $summary = $capture.ToString()
  $capture.Dispose()
  if ($null -eq $code -or $unexpected.Count -ne 0 -or [Text.Encoding]::UTF8.GetByteCount($summary) -gt 1024) { throw 'summary' }
  if ($summary -cnotmatch '\A[^\r\n]+\n\z') { throw 'summary newline' }
  # The native text pipeline appends CRLF; remove exactly the captured LF.
  $summary = $summary.Substring(0, $summary.Length - 1)
  $OutputEncoding = New-Object Text.UTF8Encoding($false)
  $transportOutput = $summary | & $nodePath '--max-old-space-size=128' $transport 'evaluate' $WorkspaceRoot $ConfigurationDigest $DistributionDigest ([string]$code)
  $transportExit = $LASTEXITCODE
  if ($transportExit -ne 0) { throw 'transport' }
  $text = ($transportOutput -join "`n")+"`n"
  if ($text -cnotmatch '\Acomplete=(?:true|false)\nexit-code=(?:0|6|7|1[0-7])\nrun-id=(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?\n\z' -or ($text.StartsWith('complete=true') -and $text.EndsWith("run-id=`n"))) { throw 'outputs' }
  $outputPath = $env:GITHUB_OUTPUT
  if ([string]::IsNullOrEmpty($outputPath) -or $outputPath -notmatch '^[A-Za-z]:[\\/]' -or $outputPath.Length -gt 240 -or $outputPath.Substring(2) -match '[:"''\x00-\x1f\x7f\x60$;|&<>{}\[\]()!*?]' -or [IO.Path]::GetFullPath($outputPath) -cne $outputPath.Replace('/','\')) { throw 'output path' }
  $cursor = $outputPath
  while ($cursor) {
    if (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'output reparse' }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
  [IO.File]::AppendAllText($outputPath,$text,(New-Object Text.UTF8Encoding($false)))
  exit 0
} catch {
  [Console]::Error.WriteLine('{"code":"MO1306_RUNTIME_INTEGRITY","kind":"MemoryOSCICDDiagnostic","message":"GitHub result transport failed.","stage":"INTEGRITY","version":"1.0.0"}')
  exit 15
}
