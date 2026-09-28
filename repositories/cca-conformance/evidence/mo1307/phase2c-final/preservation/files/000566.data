param(
  [Parameter(Mandatory=$true)][string]$NodePath,
  [Parameter(Mandatory=$true)][string]$Script,
  [Parameter(Mandatory=$true)][string]$EvidenceDirectory,
  [string]$DriverEvidenceDirectory,
  [int]$TimeoutSeconds = 180
)
# External engineering observer only: never shipped or called by product.
# Root/helper/conhost samples are bounded; no process is killed by this observer.
$ErrorActionPreference = 'Stop'
$nodeItem = Get-Item -LiteralPath $NodePath
$scriptItem = Get-Item -LiteralPath $Script
$evidenceItem = Get-Item -LiteralPath $EvidenceDirectory
if (-not $evidenceItem.PSIsContainer -or $TimeoutSeconds -lt 1 -or $TimeoutSeconds -gt 240) { throw 'Invalid observer bounds.' }
if ($nodeItem.FullName.Contains('"') -or $scriptItem.FullName.Contains('"')) { throw 'Invalid reviewed path.' }
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $nodeItem.FullName
if (-not $DriverEvidenceDirectory) { $DriverEvidenceDirectory = Join-Path $evidenceItem.FullName 'native-surfaces' }
if ($DriverEvidenceDirectory.Contains('"')) { throw 'Invalid driver output path.' }
$psi.Arguments = '"' + $scriptItem.FullName + '" "' + $DriverEvidenceDirectory + '"'
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $false
$psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.RedirectStandardInput = $true
$psi.WorkingDirectory = $scriptItem.DirectoryName
$psi.EnvironmentVariables.Clear()
$psi.EnvironmentVariables['SystemRoot'] = 'C:\Windows'
$psi.EnvironmentVariables['WINDIR'] = 'C:\Windows'
$process = New-Object System.Diagnostics.Process
$process.StartInfo = $psi
$started = [DateTime]::UtcNow
$watch = [System.Diagnostics.Stopwatch]::StartNew()
if (-not $process.Start()) { throw 'Observer child launch failed.' }
$supervisorPid = $process.Id
$process.StandardInput.Close()
$stdout = $process.StandardOutput.ReadToEndAsync()
$stderr = $process.StandardError.ReadToEndAsync()
$known = @{}
$samples = New-Object System.Collections.Generic.List[object]
$exceeded = $false
$maximumRoles = 1
$maximumHelpers = 0
$maximumConsoleHosts = 0
$deadlineExceeded = $false
while ($true) {
  $process.Refresh()
  $rows = @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CreationDate)
  $attributable = @($rows | Where-Object { $_.ProcessId -eq $supervisorPid })
  foreach ($row in $rows) {
    if ($row.ParentProcessId -eq $supervisorPid) { $known[[string]$row.ProcessId] = $row }
  }
  foreach ($row in $rows) {
    if ($known.ContainsKey([string]$row.ParentProcessId)) { $known[[string]$row.ProcessId] = $row }
  }
  foreach ($row in $rows) {
    $key = [string]$row.ProcessId
    if ($known.ContainsKey($key) -and $known[$key].CreationDate -eq $row.CreationDate) { $attributable += $row }
  }
  $helperCount = @($attributable | Where-Object { $_.Name -eq 'powershell.exe' }).Count
  $consoleCount = @($attributable | Where-Object { $_.Name -eq 'conhost.exe' -or $_.Name -eq 'OpenConsole.exe' }).Count
  $roles = $attributable.Count
  $maximumRoles = [Math]::Max($maximumRoles, $roles)
  $maximumHelpers = [Math]::Max($maximumHelpers, $helperCount)
  $maximumConsoleHosts = [Math]::Max($maximumConsoleHosts, $consoleCount)
  if ($roles -gt 3 -or $helperCount -gt 1 -or $consoleCount -gt 1) { $exceeded = $true }
  if ($samples.Count -lt 4096) {
    $samples.Add([ordered]@{ elapsedMs = [Math]::Round($watch.Elapsed.TotalMilliseconds,3); utc = [DateTime]::UtcNow.ToString('o'); processes = @($attributable | ForEach-Object { [ordered]@{pid=[int]$_.ProcessId;parent=[int]$_.ParentProcessId;name=$_.Name;created=$_.CreationDate.ToString('o')} }) })
  } else { $exceeded = $true; break }
  if ($process.HasExited) { break }
  if ($watch.Elapsed.TotalSeconds -ge $TimeoutSeconds) { $deadlineExceeded = $true; break }
  Start-Sleep -Milliseconds 25
}
$afterExit = @()
if ($process.HasExited) {
  $process.WaitForExit()
  $stdoutText = $stdout.GetAwaiter().GetResult()
  $stderrText = $stderr.GetAwaiter().GetResult()
  [IO.File]::WriteAllText((Join-Path $evidenceItem.FullName 'driver.stdout.txt'),$stdoutText,(New-Object Text.UTF8Encoding($false)))
  [IO.File]::WriteAllText((Join-Path $evidenceItem.FullName 'driver.stderr.txt'),$stderrText,(New-Object Text.UTF8Encoding($false)))
  # A second bounded native observation after termination catches retained
  # descendants whose PowerShell parent exited between ordinary samples.
  Start-Sleep -Milliseconds 50
  $afterRows = @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CreationDate)
  $afterExit = @($afterRows | Where-Object { $key=[string]$_.ProcessId; $known.ContainsKey($key) -and $known[$key].CreationDate -eq $_.CreationDate })
}
$receipt = [ordered]@{kind='MO1307Phase2CNativeProcessObservation';started=$started.ToString('o');supervisorPid=$supervisorPid;elapsedMs=[Math]::Round($watch.Elapsed.TotalMilliseconds,3);exitCode=$(if($process.HasExited){$process.ExitCode}else{$null});sampleCount=$samples.Count;maximumAttributableRoles=$maximumRoles;maximumHelpers=$maximumHelpers;maximumConsoleHosts=$maximumConsoleHosts;topologyExceeded=$exceeded;observerDeadlineExceeded=$deadlineExceeded;remainingKnownOwnedProcesses=@($afterExit);samples=@($samples.ToArray());limitations=@('External engineering observer is excluded from product role counts.','Sampling cannot prove absence between samples; production supervisor and native helper provide transition guards.','Known process creation times prevent PID-reuse attribution.','No automatic retry and no process termination is performed by this observer.')}
$receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $evidenceItem.FullName 'process-observation.json') -Encoding UTF8
if ($deadlineExceeded -or $exceeded -or $afterExit.Count -gt 0 -or -not $process.HasExited -or $process.ExitCode -ne 0) { exit 1 }
exit 0
