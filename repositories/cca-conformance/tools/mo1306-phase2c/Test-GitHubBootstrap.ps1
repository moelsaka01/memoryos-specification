param(
  [Parameter(Mandatory=$true)][string]$OutputRoot,
  [Parameter(Mandatory=$true)][string]$ArchivePath
)
$ErrorActionPreference = 'Stop'
$packageRoot = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot,'..\..\..\memoryos-ci'))
$scriptPath = [IO.Path]::Combine($packageRoot,'scripts\Initialize-GitHubCI.ps1')
$source = [IO.File]::ReadAllText($scriptPath)
$tokens=$null; $parseErrors=$null
$ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$parseErrors)
if ($parseErrors.Count) { throw 'production syntax' }
$function=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Assert-GitHubPath'},$true)
if ($null -eq $function) { throw 'path helper missing' }
. ([ScriptBlock]::Create($function.Extent.Text))
# Exercise the exact production extraction/identity statements offline. The
# preceding HTTP acquisition and its immutable archive hash are separate gates.
$start=$source.IndexOf('  Add-Type -AssemblyName System.IO.Compression.FileSystem',[StringComparison]::Ordinal)
$end=$source.IndexOf("  foreach (`$name in @('NODE_OPTIONS'",[StringComparison]::Ordinal)
if ($start -lt 0 -or $end -le $start) { throw 'extraction boundary' }
$extraction=[ScriptBlock]::Create($source.Substring($start,$end-$start))
if ((Get-Item -LiteralPath $ArchivePath).Length -ne 37618919 -or (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne '158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541') { throw 'retained ZIP identity' }
if (Test-Path -LiteralPath $OutputRoot) { throw 'exclusive output' }
$null=New-Item -ItemType Directory -Path $OutputRoot
Assert-GitHubPath $OutputRoot
$rows=New-Object 'System.Collections.Generic.List[object]'
$runtime=[IO.Path]::Combine($OutputRoot,'positive')
$null=New-Item -ItemType Directory -Path $runtime
$archivePath=$ArchivePath
$buffer=New-Object byte[] 65536
. $extraction
$nodeVersion=& $nodePath '--version';$versionExit=$LASTEXITCODE
if ($nodeVersion -cne 'v24.21.0' -or $versionExit -ne 0) {throw 'version'}
$nodeArch=& $nodePath '-p' 'process.platform+"/"+process.arch';$archExit=$LASTEXITCODE
if ($nodeArch -cne 'win32/x64' -or $archExit -ne 0) {throw 'architecture'}
$rows.Add([ordered]@{id='pinned-offline-extraction-version-architecture';status='PASS'})
$rows.Add([ordered]@{id='pinned-archive-hash-length';status='PASS'})
$negative=@(
  @{id='entry-traversal';names=@('node-v24.21.0-win-x64/../node.exe')},
  @{id='entry-absolute';names=@('/node.exe')},
  @{id='entry-backslash';names=@('node-v24.21.0-win-x64\node.exe')},
  @{id='entry-ADS';names=@('node-v24.21.0-win-x64/node.exe:stream')},
  @{id='entry-nested-dot';names=@('node-v24.21.0-win-x64/a/./b')},
  @{id='entry-case-collision';names=@('node-v24.21.0-win-x64/a','node-v24.21.0-win-x64/A')},
  @{id='entry-symlink';names=@('node-v24.21.0-win-x64/node.exe');attributes=-1610612736},
  @{id='entry-reparse';names=@('node-v24.21.0-win-x64/node.exe');attributes=1024},
  @{id='entry-reserved';names=@('node-v24.21.0-win-x64/CON')},
  @{id='entry-node-length';names=@('node-v24.21.0-win-x64/node.exe')},
  @{id='entry-wrong-version';names=@('node-v24.20.0-win-x64/node.exe')},
  @{id='entry-control';names=@("node-v24.21.0-win-x64/a`nb")}
)
foreach($case in $negative) {
  $archivePath=[IO.Path]::Combine($OutputRoot,$case.id+'.zip')
  $file=[IO.File]::Open($archivePath,[IO.FileMode]::CreateNew)
  $zip=New-Object IO.Compression.ZipArchive($file,[IO.Compression.ZipArchiveMode]::Create,$false)
  try {foreach($name in $case.names){$entry=$zip.CreateEntry($name);if($case.ContainsKey('attributes')){$entry.ExternalAttributes=[int]$case.attributes}}} finally {$zip.Dispose();$file.Dispose()}
  $runtime=[IO.Path]::Combine($OutputRoot,$case.id)
  $null=New-Item -ItemType Directory -Path $runtime
  $rejected=$false
  try {. $extraction} catch {$rejected=$true}
  if(-not $rejected){throw ('accepted '+$case.id)}
  $rows.Add([ordered]@{id=$case.id;status='PASS'})
}
$report=[ordered]@{kind='MemoryOSCICDGitHubBootstrapOfflineTest';version='1.0.0';sourceSha256=(Get-FileHash -LiteralPath $scriptPath -Algorithm SHA256).Hash.ToLowerInvariant();networkExecuted=$false;hostedExecuted=$false;cases=$rows;passed=$rows.Count}
$reportText=($report|ConvertTo-Json -Depth 10).Replace("`r`n","`n")+"`n"
[IO.File]::WriteAllText([IO.Path]::Combine($OutputRoot,'report.json'),$reportText,(New-Object Text.UTF8Encoding($false)))
$reportText
