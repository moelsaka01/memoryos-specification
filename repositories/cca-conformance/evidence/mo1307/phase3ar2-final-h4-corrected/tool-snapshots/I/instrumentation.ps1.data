# MO-1307 harness-only host instrumentation. It reads host counters, process CPU deltas and OS event logs only;
# it never touches product code, helper, installed package, configuration or any security/OS setting.
param(
  [Parameter(Mandatory)][ValidateSet('Sample','Events')][string]$Mode,
  [Parameter(Mandatory)][string]$Out,
  [string]$StopFile,
  [int]$IntervalMs = 1000,
  [string]$StartUtc,
  [string]$EndUtc
)
$ErrorActionPreference = 'Continue'
function Write-Json($value, $path) {
  [IO.File]::WriteAllText($path, (($value | ConvertTo-Json -Depth 8) + "`n"), (New-Object Text.UTF8Encoding($false)))
}
if ($Mode -eq 'Sample') {
  try { [Diagnostics.Process]::GetCurrentProcess().PriorityClass = 'BelowNormal' } catch {}
  $cpu = New-Object Diagnostics.PerformanceCounter('Processor', '% Processor Time', '_Total')
  $freq = $null; try { $freq = New-Object Diagnostics.PerformanceCounter('Processor Information', '% Processor Performance', '_Total') } catch {}
  $avail = New-Object Diagnostics.PerformanceCounter('Memory', 'Available MBytes')
  $queue = New-Object Diagnostics.PerformanceCounter('System', 'Processor Queue Length')
  $null = $cpu.NextValue(); if ($freq) { $null = $freq.NextValue() }
  $prev = @{}; $sw = [Diagnostics.Stopwatch]::StartNew()
  $writer = New-Object IO.StreamWriter($Out, $false, (New-Object Text.UTF8Encoding($false)))
  try {
    while (-not (Test-Path -LiteralPath $StopFile)) {
      $rows = New-Object Collections.Generic.List[object]; $cur = @{}
      foreach ($p in [Diagnostics.Process]::GetProcesses()) {
        try {
          $t = $p.TotalProcessorTime.TotalMilliseconds; $k = [string]$p.Id; $cur[$k] = $t
          if ($prev.ContainsKey($k)) { $d = $t - $prev[$k]; if ($d -gt 0) { $rows.Add([pscustomobject]@{ n = $p.ProcessName; pid = $p.Id; cpuMs = [math]::Round($d, 1) }) } }
        } catch {} finally { $p.Dispose() }
      }
      $prev = $cur
      $top = @($rows | Sort-Object cpuMs -Descending | Select-Object -First 6)
      $perf = $null; if ($freq) { $perf = [math]::Round($freq.NextValue(), 1) }
      $record = [ordered]@{ atUtc = (Get-Date).ToUniversalTime().ToString('o'); tMs = [math]::Round($sw.Elapsed.TotalMilliseconds, 1); cpuPct = [math]::Round($cpu.NextValue(), 1); cpuPerformancePct = $perf; availMB = [int]$avail.NextValue(); queueLength = [int]$queue.NextValue(); processCount = $cur.Count; topCpu = $top }
      $writer.WriteLine(($record | ConvertTo-Json -Compress -Depth 4)); $writer.Flush()
      Start-Sleep -Milliseconds $IntervalMs
    }
  } finally { $writer.Dispose() }
} else {
  $start = [DateTime]::Parse($StartUtc).ToUniversalTime(); $end = [DateTime]::Parse($EndUtc).ToUniversalTime()
  $logs = @('Microsoft-Windows-Windows Defender/Operational', 'Microsoft-Windows-PowerShell/Operational', 'Windows PowerShell', 'System', 'Application')
  $result = [ordered]@{ kind = 'MO1307HostEventWindow'; version = '1.0.0'; startUtc = $start.ToString('o'); endUtc = $end.ToString('o'); logs = @() }
  foreach ($name in $logs) {
    $entry = [ordered]@{ log = $name; available = $true; error = $null; count = 0; byProviderAndId = @(); sample = @() }
    try {
      $events = @(Get-WinEvent -FilterHashtable @{ LogName = $name; StartTime = $start.ToLocalTime(); EndTime = $end.ToLocalTime() } -ErrorAction Stop)
      $entry.count = $events.Count
      $entry.byProviderAndId = @($events | Group-Object { $_.ProviderName + '#' + $_.Id } | Sort-Object Count -Descending | Select-Object -First 25 | ForEach-Object { [ordered]@{ key = $_.Name; count = $_.Count } })
      $entry.sample = @($events | Where-Object { $name -notin @('Microsoft-Windows-PowerShell/Operational', 'Windows PowerShell') -or $_.Level -le 3 } | Select-Object -First 40 | ForEach-Object { [ordered]@{ at = $_.TimeCreated.ToUniversalTime().ToString('o'); provider = $_.ProviderName; id = $_.Id; level = $_.Level; message = ([string]$_.Message).Substring(0, [Math]::Min(300, ([string]$_.Message).Length)) } })
    } catch [Exception] {
      if ($_.Exception.Message -match 'No events were found') { } else { $entry.available = $false; $entry.error = $_.Exception.Message }
    }
    $result.logs += $entry
  }
  $mp = [ordered]@{}; try { $s = Get-MpComputerStatus -ErrorAction Stop; $mp.realTimeProtectionEnabled = $s.RealTimeProtectionEnabled; $mp.amRunningMode = $s.AMRunningMode; $mp.antivirusEnabled = $s.AntivirusEnabled } catch { $mp.error = $_.Exception.Message }
  $result.defenderStatusReadOnly = $mp
  $products = @(); try { $products = @(Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction Stop | ForEach-Object { [ordered]@{ displayName = $_.displayName; productState = $_.productState } }) } catch {}
  $result.registeredAntivirusProducts = $products
  Write-Json $result $Out
}
