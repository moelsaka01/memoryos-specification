import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const ev='repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert',td='repositories/cca-conformance/tools/mo1307-phase3c-c3rb-cert';
assert.ok(!fs.existsSync(ev+'/execution-ledger.json'));
const p=td+'/deadline-cleanup.mjs';let s=fs.readFileSync(p,'utf8');const before=s;
assert.equal(s.split('while($true){').length,2);
s=s.replace('while($true){','try {\nwhile($true){');
const needle='$remaining=@()';assert.equal(s.split(needle).length,2);
const cleanup=String.raw`} catch { $over=$true } finally {
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
`;
s=s.replace(needle,cleanup+needle);
fs.writeFileSync(ev+'/deadline-observer-preseal-original.mjs.data',before,{flag:'wx'});fs.writeFileSync(p,s);
const sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex'),pin=p=>{const b=fs.readFileSync(p);return{path:p,byteLength:b.length,sha256:sha(b)}};
fs.writeFileSync(ev+'/pre-execution-review.json',JSON.stringify({result:'READY_FOR_SINGLE_EXECUTION',certificationResult:false,reviewer:'Independent historical harness subagent',fixes:[{issue:'Seal/setup errors could escape without a ledger',correction:'Create complete NOT_RUN ledger first; catch seal/setup errors and preserve FAILED/INCOMPLETE.'},{issue:'Historical observer guard could leave driver launching later tests',correction:'Observer finally stops held driver on guard/error; captures handles only for current direct PowerShell children and their consoles, checks process creation identity, and performs bounded owned cleanup. No other streams are targeted.'}],productionChanged:false,finiteCorpusChanged:false,oldDeadlineTool:pin(ev+'/deadline-observer-preseal-original.mjs.data'),newDeadlineTool:pin(p),staleCommentDisclosure:'Inherited equivalence explanatory text says r3c; all actual cwd/scratch/output paths resolve C:/m7c. No writes to r3c.'},null,2)+'\n',{flag:'wx'});
fs.renameSync(ev+'/pre-execution-seal.json',ev+'/pre-execution-seal-before-observer-review.json.data');
function list(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?list(d+'/'+e.name):[d+'/'+e.name]);}
const members=[...list(ev),...list(td)].sort().map(pin);
fs.writeFileSync(ev+'/pre-execution-seal.json',JSON.stringify({kind:'MO1307Phase3CC3RBPreExecutionSeal',sealedAt:new Date().toISOString(),candidate:'defe93989efc6501b1a730b82e79e705884b269b',scope:'Final pre-execution seal after independent observer fail-stop review. Prior preparation seal retained. No certification test has executed and no corpus/expectation changed.',members},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({finalSealMembers:members.length,noCertificationExecuted:true}));
