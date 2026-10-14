param([string]$Out)
$trees=@{ 'g4b'='C:\g4b'; 'g4c'='C:\g4c' }
$res=@()
foreach($k in 'g4b','g4c'){
  $bd=Join-Path $trees[$k] 'out\build\default'
  $exes=Get-ChildItem $bd -Recurse -Filter *.exe -File | Where-Object { $_.FullName -notmatch '\\(CMakeFiles|vcpkg_installed|_deps)\\' -and $_.FullName -match '\\repositories\\' } | Sort-Object FullName
  foreach($e in $exes){
    $rel=$e.FullName.Substring($bd.Length+1).Replace('\','/')
    $sha=(Get-FileHash $e.FullName -Algorithm SHA256).Hash.ToLower()
    $launched=$false;$reason=''
    try{
      $psi=New-Object Diagnostics.ProcessStartInfo $e.FullName
      $psi.WorkingDirectory=$e.DirectoryName;$psi.UseShellExecute=$false;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true;$psi.CreateNoWindow=$true
      $p=[Diagnostics.Process]::Start($psi)
      $launched=$true
      if(-not $p.WaitForExit(3000)){ try{$p.Kill()}catch{} }
      try{$p.Dispose()}catch{}
    }catch{ $reason=$_.Exception.Message }
    $res+=[pscustomobject]@{tree=$k;exe=$rel;sha256=$sha;launched=$launched;reason=$reason}
  }
}
$res | ConvertTo-Json -Depth 3 | Set-Content $Out -Encoding utf8
$res | Where-Object { -not $_.launched } | ForEach-Object { "$($_.tree) $($_.exe) :: $($_.reason)" }
"total=$($res.Count) blocked=$(@($res | Where-Object {-not $_.launched}).Count)"
