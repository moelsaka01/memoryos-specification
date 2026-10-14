param([Parameter(Mandatory=$true)][string]$StartUtc,[Parameter(Mandatory=$true)][string]$EndUtc)
$ErrorActionPreference = 'Stop'
try {
  $start = [DateTimeOffset]::Parse($StartUtc).ToUniversalTime()
  $end = [DateTimeOffset]::Parse($EndUtc).ToUniversalTime()
  if ($end -le $start -or ($end-$start).TotalHours -gt 3) { throw 'INVALID_QUERY_WINDOW' }
  $a = $start.ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ')
  $b = $end.ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ')
  $query = "<QueryList><Query Id='0' Path='System'><Select Path='System'>*[System[Provider[@Name='Microsoft-Windows-Kernel-Power'] and TimeCreated[@SystemTime&gt;='$a' and @SystemTime&lt;='$b']]]</Select></Query></QueryList>"
  $events = @()
  try { $events = @(Get-WinEvent -FilterXml $query -MaxEvents 8193 -ErrorAction Stop) }
  catch { if ($_.FullyQualifiedErrorId -notlike 'NoMatchingEventsFound*') { throw } }
  if ($events.Count -gt 8192) { throw 'EVENT_QUERY_TRUNCATED' }
  $rows = @($events | ForEach-Object { @{RecordId=$_.RecordId;Id=$_.Id;utc=$_.TimeCreated.ToUniversalTime().ToString('o');xml=$_.ToXml()} })
  @{state='AVAILABLE';startUtc=$a;endUtc=$b;provider='Microsoft-Windows-Kernel-Power';events=$rows} | ConvertTo-Json -Depth 8 -Compress
} catch { @{state='UNAVAILABLE';error=$_.Exception.Message;events=@()} | ConvertTo-Json -Depth 8 -Compress }
