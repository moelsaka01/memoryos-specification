param(
  [Parameter(Mandatory=$true)][ValidateSet('generic','gitlab','jenkins','azure','github')][string]$Provider,
  [Parameter(Mandatory=$true)][string]$Workspace,
  [Parameter(Mandatory=$true)][string]$ConfigurationDigest,
  [Parameter(Mandatory=$true)][string]$DistributionDigest
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# Provider selection is an argument, never a provider-supplied script fragment.
try {
  $node = [Environment]::GetEnvironmentVariable('MEMORYOS_CI_NODE')
  $package = [Environment]::GetEnvironmentVariable('MEMORYOS_CI_HOME')
  $config = [Environment]::GetEnvironmentVariable('MEMORYOS_CI_CONFIG')
  foreach ($capability in @($node,$package,$config,$Workspace)) {
    if ([string]::IsNullOrEmpty($capability) -or $capability -notmatch '^[A-Za-z]:[\\/]' -or $capability -match '["\x00-\x1f\x60$;|&<>{}\[\]()]' -or $capability.Length -gt 240) { throw 'path' }
  }
  if ($ConfigurationDigest -cnotmatch '^sha256:[a-f0-9]{64}$' -or $DistributionDigest -cnotmatch '^sha256:[a-f0-9]{64}$') { throw 'pin' }
  if ((Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32') { throw 'node' }
  if ('sha256:'+(Get-FileHash -LiteralPath ([IO.Path]::Combine($package,'distribution-manifest.json')) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $DistributionDigest) { throw 'distribution' }
  [Environment]::SetEnvironmentVariable('NODE_OPTIONS',$null)
  [Environment]::SetEnvironmentVariable('NODE_PATH',$null)
  [Environment]::SetEnvironmentVariable('NODE_INSPECT_RESUME_ON_START',$null)
  [Environment]::SetEnvironmentVariable('NODE_REPL_EXTERNAL_MODULE',$null)
  $verifier = [IO.Path]::Combine($package,'scripts/verify-config.mjs')
  $global:LASTEXITCODE = $null
  & $node '--max-old-space-size=128' $verifier $config $ConfigurationDigest
  $verificationExit = $LASTEXITCODE
  if ($null -eq $verificationExit) { throw 'process' }
  if ($verificationExit -ne 0) { exit $verificationExit }
  $entry = [IO.Path]::Combine($package,'bin/memoryos-ci.mjs')
  $global:LASTEXITCODE = $null
  $summaryLines = @(& $node '--max-old-space-size=128' $entry 'run' '--workspace' $Workspace '--config' $config '--provider' $Provider)
  $gateExit = $LASTEXITCODE
  if ($null -eq $gateExit) { throw 'process' }
  if ($summaryLines.Count -ne 1 -or [Text.Encoding]::UTF8.GetByteCount([string]$summaryLines[0]) -gt 1023) { exit 16 }
  $summary = [string]$summaryLines[0]
  $resultVerifier = [IO.Path]::Combine($package,'scripts/verify-provider-result.mjs')
  $global:LASTEXITCODE = $null
  $OutputEncoding = New-Object Text.UTF8Encoding($false)
  $verified = @($summary | & $node '--max-old-space-size=128' $resultVerifier $Workspace $Provider $ConfigurationDigest $DistributionDigest ([string]$gateExit))
  $resultExit = $LASTEXITCODE
  if ($null -eq $resultExit) { throw 'process' }
  if ($resultExit -ne 0) { exit $resultExit }
  if ($verified.Count -ne 1 -or [string]$verified[0] -cne $summary) { exit 16 }
  [Console]::Out.Write($summary + [char]10)
  exit $gateExit
} catch {
  [Console]::Error.Write('{"code":"MO1306_RUNTIME_INTEGRITY","kind":"MemoryOSCICDDiagnostic","message":"Trusted bootstrap verification failed.","stage":"INTEGRITY","version":"1.0.0"}' + [char]10)
  exit 15
}
