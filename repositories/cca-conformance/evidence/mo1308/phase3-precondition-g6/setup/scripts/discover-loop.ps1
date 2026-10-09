$D='C:\g6-logs\setup'
$env:PATH="C:\Program Files\CMake\bin;C:\Users\melsa\AppData\Local\Microsoft\WinGet\Links;"+$env:PATH
$extra=@()
for($attempt=1;$attempt -le 40;$attempt++){
  $changed=$false; $allOk=$true
  foreach($t in 'g6b','g6c'){
    Set-Location C:\$t
    $lg="$D\ctest-N-$t-attempt$attempt.log"
    cmd /c "ctest --preset default -N > $lg 2>&1"
    $code=$LASTEXITCODE
    if($code -ne 0){
      $allOk=$false
      $txt=Get-Content $lg -Raw
      $m=[regex]::Match($txt,"Path: '([^']+\.exe)'")
      if($m.Success){
        $rel=$m.Groups[1].Value -replace '^.*/out/build/default/',''
        if($rel -notmatch '^repositories/.+_tests?\.exe$'){ "STOP: unexpected executable $rel"; exit 3 }
        foreach($t2 in 'g6b','g6c'){ $p="C:\$t2\out\build\default\"+($rel -replace '/','\'); if(Test-Path $p){Rename-Item $p ($p+'.sac-blocked')} }
        $extra+="attempt $attempt ($t): $rel result "+([regex]::Match($txt,'Result: (.+)').Groups[1].Value.Trim())
        "attempt $attempt $t renamed $rel"
        $changed=$true
      } else { "STOP: ctest -N failed without a path ($t)"; exit 4 }
    }
  }
  if($allOk){ "discovery complete after attempt $attempt"; break }
}
$extra | Set-Content "$D\discovery-extra-blocked.txt"
