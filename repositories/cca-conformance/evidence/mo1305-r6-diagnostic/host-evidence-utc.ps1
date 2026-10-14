$ErrorActionPreference='Stop'
$start=[DateTime]::SpecifyKind([DateTime]'2026-09-24T16:12:00',[DateTimeKind]::Utc)
$end=[DateTime]::SpecifyKind([DateTime]'2026-09-24T16:23:00',[DateTimeKind]::Utc)
$logs=@('System','Application','Microsoft-Windows-Windows Defender/Operational','Microsoft-Windows-WindowsUpdateClient/Operational','Microsoft-Windows-Kernel-Power/Thermal-Operational')
$results=@()
foreach($name in $logs){
 try{
  $info=Get-WinEvent -ListLog $name -ErrorAction Stop
  try { $xpath="*[System[TimeCreated[@SystemTime&gt;='2026-09-24T16:12:00.000Z' and @SystemTime&lt;='2026-09-24T16:23:00.000Z']]]"; $xml="<QueryList><Query Id='0' Path='$name'><Select Path='$name'>$xpath</Select></Query></QueryList>"; $events=@(Get-WinEvent -FilterXml $xml -MaxEvents 100 -ErrorAction Stop | Select-Object TimeCreated,ProviderName,Id,LevelDisplayName,Message);$errorText=$null } catch { $events=@();$errorText=$_.Exception.Message }
  $results+= [pscustomobject]@{log=$name;enabled=$info.IsEnabled;recordCount=$info.RecordCount;events=$events;queryError=$errorText}
 }catch { $results+=[pscustomobject]@{log=$name;queryError=$_.Exception.Message} }
}
$processStart=Get-Process | Select-Object Id,ProcessName,CPU,WorkingSet64,PrivateMemorySize64,Handles,@{Name='Threads';Expression={$_.Threads.Count}}
Start-Sleep -Milliseconds 1000
$processEnd=Get-Process | Select-Object Id,ProcessName,CPU,WorkingSet64,PrivateMemorySize64,Handles,@{Name='Threads';Expression={$_.Threads.Count}}
$cpus=@($processEnd|ForEach-Object { $r=$_;$prior=$processStart|Where-Object Id -EQ $r.Id|Select-Object -First 1;if($prior){[pscustomobject]@{Id=$r.Id;Name=$r.ProcessName;CpuSecondsDelta=$r.CPU-$prior.CPU;WorkingSet64=$r.WorkingSet64;PrivateMemorySize64=$r.PrivateMemorySize64;Threads=$r.Threads}} }|Sort-Object CpuSecondsDelta -Descending|Select-Object -First 10)
$memory=Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory,TotalVirtualMemorySize,FreeVirtualMemory,LastBootUpTime
$result=[pscustomobject]@{kind='BoundedLocalHostDiagnostic';queriedUtc=[DateTime]::UtcNow.ToString('o');windowStart=$start;windowEnd=$end;logs=$results;currentProcessCount=$processEnd.Count;currentThreadCount=($processEnd|Measure-Object Threads -Sum).Sum;currentTopCpuDeltas=$cpus;currentMemory=$memory;limitations='Current samples cannot reconstruct R6 CPU/disk pressure. No personal files scanned, unrelated processes terminated, or settings changed.'}
$result|ConvertTo-Json -Depth 8|Set-Content -LiteralPath '.cache/mo1305-r6-diagnostic/host-evidence-utc.json'
[pscustomobject]@{logs=($results|ForEach-Object{[pscustomobject]@{name=$_.log;events=$_.events.Count;error=$_.queryError}});processCount=$processEnd.Count;threadCount=($processEnd|Measure-Object Threads -Sum).Sum;topCpu=$cpus;memory=$memory}|ConvertTo-Json -Depth 5