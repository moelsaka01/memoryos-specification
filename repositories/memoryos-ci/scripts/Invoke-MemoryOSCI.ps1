param(
  [Parameter(Mandatory=$true)][ValidateSet('generic')][string]$Provider,
  [Parameter(Mandatory=$true)][string]$Workspace,
  [Parameter(Mandatory=$true)][string]$ConfigurationDigest,
  [Parameter(Mandatory=$true)][string]$DistributionDigest
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# Phase 1 exposes the generic bootstrap only. Provider integrations belong to Phase 2.
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
  $verifier = [IO.Path]::Combine($package,'scripts/verify-config.mjs')
  & $node '--max-old-space-size=128' $verifier $config $ConfigurationDigest
  $verificationExit = $LASTEXITCODE
  if ($verificationExit -ne 0) { exit $verificationExit }
  $entry = [IO.Path]::Combine($package,'bin/memoryos-ci.mjs')
  & $node '--max-old-space-size=128' $entry 'run' '--workspace' $Workspace '--config' $config '--provider' $Provider
  $gateExit = $LASTEXITCODE
  exit $gateExit
} catch {
  [Console]::Error.WriteLine('{"code":"MO1306_RUNTIME_INTEGRITY","kind":"MemoryOSCICDDiagnostic","message":"Trusted bootstrap verification failed.","stage":"INTEGRITY","version":"1.0.0"}')
  exit 15
}
