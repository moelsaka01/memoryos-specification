$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
try {
  $stream = [Console]::OpenStandardInput()
  $buffer = New-Object byte[] 16385
  $length = 0
  while (($count = $stream.Read($buffer, $length, $buffer.Length - $length)) -gt 0) {
    $length += $count
    if ($length -gt 16384) { throw 'bounds' }
  }
  $decoder = New-Object System.Text.UTF8Encoding($false, $true)
  $request = $decoder.GetString($buffer, 0, $length) | ConvertFrom-Json
  if (($request.PSObject.Properties.Name | Sort-Object) -join ',' -cne 'kind,paths,version') { throw 'shape' }
  if ($request.kind -cne 'MemoryOSCICDPathCheckRequest' -or $request.version -cne '1.0.0' -or $request.paths.Count -lt 1 -or $request.paths.Count -gt 64) { throw 'shape' }
  foreach ($entry in $request.paths) {
    if (($entry.PSObject.Properties.Name | Sort-Object) -join ',' -cne 'allowMissingLeaf,path') { throw 'shape' }
    if ($entry.path -isnot [string] -or $entry.allowMissingLeaf -isnot [bool]) { throw 'shape' }
    $full = [IO.Path]::GetFullPath($entry.path)
    if ($full -ine $entry.path -or $full.Length -gt 240 -or $full -notmatch '^[A-Za-z]:\\') { throw 'path' }
    $root = [IO.Path]::GetPathRoot($full)
    $drive = New-Object IO.DriveInfo($root)
    if ($drive.DriveFormat -cne 'NTFS') { throw 'filesystem' }
    $parts = $full.Substring($root.Length).Split([char]'\')
    $current = $root
    for ($i = 0; $i -lt $parts.Length; $i++) {
      if ($parts[$i].Length -eq 0) { continue }
      $current = [IO.Path]::Combine($current, $parts[$i])
      try { $attributes = [IO.File]::GetAttributes($current) }
      catch [IO.FileNotFoundException] {
        if ($entry.allowMissingLeaf -and $i -eq $parts.Length - 1) { break }; throw
      }
      catch [IO.DirectoryNotFoundException] {
        if ($entry.allowMissingLeaf -and $i -eq $parts.Length - 1) { break }; throw
      }
      if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'reparse' }
      if ($i -lt $parts.Length - 1 -and ($attributes -band [IO.FileAttributes]::Directory) -eq 0) { throw 'ancestor' }
    }
  }
  [Console]::Out.Write('{"kind":"MemoryOSCICDPathCheck","safe":true,"version":"1.0.0"}' + [char]10)
} catch {
  [Console]::Out.Write('{"kind":"MemoryOSCICDPathCheck","safe":false,"version":"1.0.0"}' + [char]10)
  exit 1
}
