param([string]$Node,[string]$Driver,[string]$Evidence)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
function Write-NewText([string]$Path,[string]$Text) {
  $bytes=[Text.UTF8Encoding]::new($false).GetBytes($Text)
  $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try {$stream.Write($bytes,0,$bytes.Length)} finally {$stream.Dispose()}
}
$psi=New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName=$Node
$psi.Arguments='"'+$Driver+'" --driver "'+$Evidence+'"'
$psi.UseShellExecute=$false
$psi.CreateNoWindow=$true
$psi.WindowStyle=[System.Diagnostics.ProcessWindowStyle]::Hidden
$psi.RedirectStandardInput=$true
$psi.RedirectStandardOutput=$true
$psi.RedirectStandardError=$true
$psi.WorkingDirectory='C:\Users\melsa\Documents\Codex\3cr2\'
$psi.EnvironmentVariables.Clear()
$psi.EnvironmentVariables['SystemRoot']='C:\Windows'
$psi.EnvironmentVariables['WINDIR']='C:\Windows'
$proc=New-Object System.Diagnostics.Process
$proc.StartInfo=$psi
$watch=[Diagnostics.Stopwatch]::StartNew()
[void]$proc.Start()
$driverPid=$proc.Id
$proc.StandardInput.Close()
$stdout=$proc.StandardOutput.ReadToEndAsync()
$stderr=$proc.StandardError.ReadToEndAsync()
$known=@{}
$samples=New-Object System.Collections.Generic.List[object]
$over=$false
try {
while($true){
  $proc.Refresh()
  $rows=@(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CreationDate,WorkingSetSize,PeakWorkingSetSize)
  foreach($r in $rows){if($r.ParentProcessId -eq $driverPid){$known[[string]$r.ProcessId]=$r}}
  foreach($r in $rows){if($known.ContainsKey([string]$r.ParentProcessId)){$known[[string]$r.ProcessId]=$r}}
  $owned=@($rows | Where-Object {$k=[string]$_.ProcessId; $known.ContainsKey($k) -and $known[$k].CreationDate -eq $_.CreationDate})
  $samples.Add([ordered]@{elapsedMs=$watch.Elapsed.TotalMilliseconds;utc=[DateTime]::UtcNow.ToString('o');processes=@($owned | ForEach-Object {[ordered]@{pid=[int]$_.ProcessId;parent=[int]$_.ParentProcessId;name=$_.Name;created=$_.CreationDate.ToString('o');workingSetBytes=[long]$_.WorkingSetSize;peakWorkingSetKiB=[long]$_.PeakWorkingSetSize}})})
  if($proc.HasExited){break}
  if($watch.Elapsed.TotalSeconds -gt 150 -or $samples.Count -ge 1000){$over=$true;break}
  Start-Sleep -Milliseconds 50
}
} catch { $over=$true } finally {
  $proc.Refresh()
  if(-not $proc.HasExited){
    $over=$true
    $cleanupHandles=New-Object System.Collections.Generic.List[System.Diagnostics.Process]
    try {
      # Capture handles only for current direct helper children and their current console children.
      $cleanupRows=@(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CreationDate)
      $direct=@($cleanupRows | Where-Object {$_.ParentProcessId -eq $driverPid -and $_.Name -eq 'powershell.exe' -and $_.CreationDate -ge $proc.StartTime})
      $directIds=@($direct | ForEach-Object {$_.ProcessId})
      $targets=@($direct)+@($cleanupRows | Where-Object {$_.Name -eq 'conhost.exe' -and $directIds -contains $_.ParentProcessId -and $_.CreationDate -ge $proc.StartTime})
      foreach($t in $targets){
        try {
          $held=[Diagnostics.Process]::GetProcessById([int]$t.ProcessId)
          [void]$held.Handle
          if([Math]::Abs(($held.StartTime.ToUniversalTime()-$t.CreationDate.ToUniversalTime()).TotalMilliseconds) -lt 1){$cleanupHandles.Add($held)}else{$held.Dispose()}
        } catch {}
      }
    } finally {
      try { if(-not $proc.HasExited){$proc.Kill();[void]$proc.WaitForExit(2000)} } catch {}
      foreach($held in $cleanupHandles){try {if(-not $held.HasExited){$held.Kill();[void]$held.WaitForExit(2000)}}catch{}finally{$held.Dispose()}}
    }
  }
}
$remaining=@()
if($proc.HasExited){
  $proc.WaitForExit()
  Write-NewText (Join-Path $Evidence 'driver.stdout.txt') ($stdout.GetAwaiter().GetResult())
  Write-NewText (Join-Path $Evidence 'driver.stderr.txt') ($stderr.GetAwaiter().GetResult())
  Start-Sleep -Milliseconds 100
  $after=@(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CreationDate)
  $remaining=@($after | Where-Object {$k=[string]$_.ProcessId;($_.ParentProcessId -eq $driverPid) -or ($known.ContainsKey([string]$_.ParentProcessId)) -or ($known.ContainsKey($k) -and $known[$k].CreationDate -eq $_.CreationDate)})
}
$record=[ordered]@{kind='MO1307TargetedRefreshExternalOSObservation';driverPid=$driverPid;exitCode=$(if($proc.HasExited){$proc.ExitCode}else{$null});observerDeadlineExceeded=$over;sampleCount=$samples.Count;remainingOwnedProcesses=@($remaining);samples=@($samples.ToArray());limitations=@('Bounded CIM sampling is not exhaustive evidence of absence between samples. Fixed helper console-handle closure plus full stream/process close events supply transition proof.','Only attributable descendant identity/PID/resource fields collected; no environment, credentials or command lines collected.','RSS is representative observation, not runtime capacity certification or hard memory isolation.')}
Write-NewText (Join-Path $Evidence 'process-observation.json') ($record | ConvertTo-Json -Depth 8)
if($over -or -not $proc.HasExited -or $proc.ExitCode -ne 0 -or $remaining.Count -ne 0){exit 1}
exit 0
