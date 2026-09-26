param(
  [Parameter(Mandatory=$true)][string]$WorkspaceRoot,
  [Parameter(Mandatory=$true)][string]$ConfigurationDigest,
  [Parameter(Mandatory=$true)][string]$DistributionDigest
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Assert-GitHubPath([string]$Value) {
  if ([string]::IsNullOrEmpty($Value) -or $Value.Length -gt 240 -or $Value -notmatch '^[A-Za-z]:[\\/]' -or $Value.Substring(2) -match '[:"''\x00-\x1f\x7f\x60$;|&<>{}\[\]()!*?]') { throw 'path' }
  $full = [IO.Path]::GetFullPath($Value)
  if ($full -cne $Value.Replace('/','\')) { throw 'path' }
  $cursor = $full
  while ($cursor) {
    $item = Get-Item -LiteralPath $cursor -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'reparse' }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
}

try {
  Assert-GitHubPath $WorkspaceRoot
  $homePath = [IO.Path]::Combine($WorkspaceRoot,'_memoryos\tool\repositories\memoryos-ci')
  if ($env:MEMORYOS_CI_HOME -cne $homePath) { throw 'package' }
  Assert-GitHubPath $homePath
  Assert-GitHubPath $env:MEMORYOS_CI_CONFIG
  $trustedPrefix = [IO.Path]::Combine($WorkspaceRoot,'_memoryos\tool') + '\'
  if (-not $env:MEMORYOS_CI_CONFIG.StartsWith($trustedPrefix,[StringComparison]::Ordinal)) { throw 'config' }
  if ($ConfigurationDigest -cnotmatch '^sha256:[a-f0-9]{64}$' -or $DistributionDigest -cnotmatch '^sha256:[a-f0-9]{64}$') { throw 'pin' }
  $manifest = [IO.Path]::Combine($homePath,'distribution-manifest.json')
  Assert-GitHubPath $manifest
  if ('sha256:'+(Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash.ToLowerInvariant() -cne $DistributionDigest) { throw 'distribution' }
  $runtime = [IO.Path]::Combine($WorkspaceRoot,'_memoryos\runtime')
  if (Test-Path -LiteralPath $runtime) { throw 'runtime exists' }
  $null = New-Item -ItemType Directory -Path $runtime
  Assert-GitHubPath $runtime
  $archivePath = [IO.Path]::Combine($runtime,'node-v24.21.0-win-x64.zip')
  # This is the only network operation. Fixed URL, no proxy/redirect discovery.
  $request = [Net.HttpWebRequest]::Create('https://nodejs.org/dist/v24.21.0/node-v24.21.0-win-x64.zip')
  $request.AllowAutoRedirect = $false
  $request.Proxy = $null
  $request.Timeout = 60000
  $request.ReadWriteTimeout = 60000
  $response = $request.GetResponse()
  try {
    if ([int]$response.StatusCode -ne 200 -or $response.ResponseUri.AbsoluteUri -cne 'https://nodejs.org/dist/v24.21.0/node-v24.21.0-win-x64.zip' -or $response.ContentLength -ne 37618919) { throw 'response' }
    $inputStream = $response.GetResponseStream()
    $outputStream = [IO.File]::Open($archivePath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try {
      $buffer = New-Object byte[] 65536
      [long]$total = 0
      while (($count = $inputStream.Read($buffer,0,$buffer.Length)) -gt 0) {
        $total += $count
        if ($total -gt 37618919) { throw 'archive length' }
        $outputStream.Write($buffer,0,$count)
      }
      if ($total -ne 37618919) { throw 'archive length' }
    } finally { $outputStream.Dispose(); $inputStream.Dispose() }
  } finally { $response.Dispose() }
  Assert-GitHubPath $archivePath
  if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne '158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541') { throw 'archive hash' }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
  try {
    if ($archive.Entries.Count -lt 1 -or $archive.Entries.Count -gt 20000) { throw 'entry count' }
    $names = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $nodeEntry = $null
    [long]$expanded = 0
    foreach ($entry in $archive.Entries) {
      $entryName = $entry.FullName
      if ($entryName -cnotmatch '^node-v24\.21\.0-win-x64/[A-Za-z0-9_. /@+-]*$' -or -not $names.Add($entryName.TrimEnd('/'))) { throw 'entry name' }
      foreach ($part in $entryName.TrimEnd('/').Split('/')) {
        if ($part -eq '' -or $part -eq '.' -or $part -eq '..' -or $part -match '^[ ]|[ .]$|^(?i:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)') { throw 'entry path' }
      }
      $type = ($entry.ExternalAttributes -shr 16) -band 61440
      if ($type -notin @(0,16384,32768) -or ($entry.ExternalAttributes -band 1024) -ne 0 -or $entry.Length -gt 134217728) { throw 'entry type' }
      $expanded += $entry.Length
      if ($expanded -gt 536870912) { throw 'expanded length' }
      if ($entryName -ceq 'node-v24.21.0-win-x64/node.exe') { $nodeEntry = $entry }
    }
    if ($null -eq $nodeEntry -or $nodeEntry.Length -ne 93580104) { throw 'node entry' }
    $nodePath = [IO.Path]::Combine($runtime,'node.exe')
    $inputStream = $nodeEntry.Open()
    $outputStream = [IO.File]::Open($nodePath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try {
      [long]$total = 0
      while (($count = $inputStream.Read($buffer,0,$buffer.Length)) -gt 0) {
        $total += $count
        if ($total -gt 93580104) { throw 'node length' }
        $outputStream.Write($buffer,0,$count)
      }
      if ($total -ne 93580104) { throw 'node length' }
    } finally { $outputStream.Dispose(); $inputStream.Dispose() }
  } finally { $archive.Dispose() }
  Assert-GitHubPath $nodePath
  if ((Get-Item -LiteralPath $nodePath).Length -ne 93580104 -or (Get-FileHash -LiteralPath $nodePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32') { throw 'node identity' }
  foreach ($name in @('NODE_OPTIONS','NODE_PATH','NODE_INSPECT_RESUME_ON_START','NODE_REPL_EXTERNAL_MODULE')) { [Environment]::SetEnvironmentVariable($name,$null) }
  $env:MEMORYOS_CI_NODE = $nodePath
  $nodeVersion = & $nodePath '--version'
  $versionExit = $LASTEXITCODE
  if ($versionExit -ne 0 -or $nodeVersion -cne 'v24.21.0') { throw 'node version' }
  # The verifier enforces win32/x64, the full package, and normalized config pin.
  & $nodePath '--max-old-space-size=128' ([IO.Path]::Combine($homePath,'scripts\github-transport.mjs')) 'bootstrap' $WorkspaceRoot $ConfigurationDigest $DistributionDigest
  $verifyExit = $LASTEXITCODE
  exit $verifyExit
} catch {
  [Console]::Error.WriteLine('{"code":"MO1306_RUNTIME_INTEGRITY","kind":"MemoryOSCICDDiagnostic","message":"Pinned GitHub bootstrap failed.","stage":"INTEGRITY","version":"1.0.0"}')
  exit 15
}
