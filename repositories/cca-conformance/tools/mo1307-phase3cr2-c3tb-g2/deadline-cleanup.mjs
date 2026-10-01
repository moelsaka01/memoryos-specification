// Targeted Phase 3C-R security controls; never production runtime certification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createSupervisor} from '../../../memoryos-readiness/src/runtime.mjs';
import {createHelperTransportForTesting, helperLaunchSpecification} from '../../../memoryos-readiness/src/helper-transport.mjs';
import {encodeHelperRequest, decodeHelperResponse, createHelperSequence} from '../../../memoryos-readiness/src/helper-protocol.mjs';
import {canonicalBytes} from '../../../memoryos-readiness/src/canonical.mjs';
import {DEFINITIONS} from '../../../memoryos-readiness/src/constants.mjs';
import {ReadinessError,errorExit,serializeError} from '../../../memoryos-readiness/src/errors.mjs';
import {validateLaunch} from '../../../memoryos-readiness/src/cli-args.mjs';
import {reviewRepositorySource} from './source-review-lib.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const self=fileURLToPath(import.meta.url),base=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2/deadline-cleanup');
const historical='defe93989efc6501b1a730b82e79e705884b269b';
const referenceSource=path.join(root,'repositories/cca-conformance/evidence/mo1307/n15-correction/native-filesystem/helper.ps1.data');
const referenceCommit='c9cd73df2f4c48afeab6059b31eca61830e1633c',referenceBlob='527fea7b9f12ba345f5b4f57511263485e79e303';
const gitExecutable='C:/Program Files/Git/cmd/git.exe';
const sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const bind=p=>{const b=fs.readFileSync(p);return {path:p,byteLength:b.length,sha256:sha(b)};};
const json=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const spec=helperLaunchSpecification();
const pinned=['src/helper-transport.mjs','src/helper-protocol.mjs','src/runtime.mjs','src/windows-paths.mjs','src/cli-args.mjs','src/errors.mjs','src/constants.mjs','helpers/windows-inspect.ps1'];
const pins=()=>pinned.map(p=>({...bind(path.join(root,'repositories/memoryos-readiness',p)),relative:p}));
const referenceEvidence=copy=>({sealedArtifact:{commit:referenceCommit,gitBlob:referenceBlob,...bind(referenceSource)},productionSource:{commit:referenceCommit,path:'repositories/memoryos-readiness/helpers/windows-inspect.ps1',gitBlob:referenceBlob,byteLength:29136,sha256:'sha256:f9d68d43cba57b5fc64e6bca13605ccf82f6afa9e1b0ac110bf9e4357bdbce69'},copy:bind(copy),sameGitBlob:true,role:'SEALED_CORRECTED_PRODUCTION_HELPER_COMPARISON_SOURCE',diagnosticEvidencePromoted:false});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function childRun(exe,args,options){const c=spawn(exe,args,options);const out=[],err=[];c.stdout.on('data',b=>out.push(b));c.stderr.on('data',b=>err.push(b));return await new Promise((resolve,reject)=>{c.once('error',reject);c.once('close',code=>resolve({code,stdout:Buffer.concat(out),stderr:Buffer.concat(err)}));});}
if(process.argv[2]!=='--driver'){
  const attempt=process.argv[2]||'attempt-1';assert.match(attempt,/^attempt-[1-9][0-9]*$/);
  const dir=path.join(base,attempt);fs.mkdirSync(dir,{recursive:false});
  fs.copyFileSync(self,path.join(dir,'executed-harness.mjs.data'),fs.constants.COPYFILE_EXCL);
  const referenceHelper=path.join(dir,'reference-helper.ps1');fs.copyFileSync(referenceSource,referenceHelper,fs.constants.COPYFILE_EXCL);assert.deepEqual(fs.readFileSync(referenceHelper),fs.readFileSync(referenceSource));assert.equal(bind(referenceSource).sha256,'sha256:f9d68d43cba57b5fc64e6bca13605ccf82f6afa9e1b0ac110bf9e4357bdbce69');
  const node=process.execPath;
  assert.equal(process.version,'v24.21.0');
  assert.equal(sha(fs.readFileSync(node)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
  const bindings=pins();json(path.join(dir,'campaign.json'),{kind:'MO1307Phase3CR2RefreshDeadlineEnvironment',baseline:'119e68bdcf0ffc906b4ca03a912aadcb25908346',created:new Date().toISOString(),node:bind(node),helper:bind(spec.args.at(-1)),sources:[...bindings,bind(referenceSource),bind(referenceHelper)],referenceProvenance:referenceEvidence(referenceHelper),launch:spec,scope:'Representative security boundary only. No CLI smoke, worker/runtime certification, provider use, production change or package certification.',controls:'Actual fixed executable/script with engineering stdin EOF or shutdown timing control; crash forced on owned process. Raw request limits use engineering 15000ms outer guard. The sealed corrected N15 production helper is an explicitly selected comparison source.'});
const observer=String.raw`param([string]$Node,[string]$Driver,[string]$Evidence)
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
$psi.WorkingDirectory='${root.replaceAll("'","''")}'
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
`;
  const ps=path.join(dir,'observer.ps1');fs.writeFileSync(ps,observer,{flag:'wx'});
  const result=await childRun(spec.executable,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',ps,'-Node',node,'-Driver',self,'-Evidence',dir],{cwd:root,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
  fs.writeFileSync(path.join(dir,'observer.stdout.txt'),result.stdout,{flag:'wx'});fs.writeFileSync(path.join(dir,'observer.stderr.txt'),result.stderr,{flag:'wx'});
  const observation=JSON.parse(fs.readFileSync(path.join(dir,'process-observation.json'),'utf8').replace(/^\uFEFF/,''));
  const receipt=JSON.parse(fs.readFileSync(path.join(dir,'receipt.json'),'utf8'));
  const seen=new Set(observation.samples.flatMap(s=>s.processes.map(p=>p.pid)));
  const nativeCoverage=receipt.invocations.map(r=>({name:r.name,pid:r.pid,seen:seen.has(r.pid),closed:r.closedAt!==null,streamsClosed:r.streamsClosed}));
  const requiredObservedNames=['timeout-exact-mapping','late-native-success-refused','crash-closed-transport'];
  const requiredObserved=requiredObservedNames.map(name=>{const row=nativeCoverage.find(candidate=>candidate.name===name);return{name,pid:row?.pid??null,seen:row?.seen===true,closed:row?.closed===true,streamsClosed:row?.streamsClosed===true};});
  const resourceComparisons=receipt.invocations.filter(r=>r.name.startsWith('resource-sample')).map(r=>({name:r.name,pid:r.pid,elapsedMs:r.closedAt-r.startedAt,sampledWorkingSetMax:Math.max(0,...observation.samples.flatMap(s=>s.processes).filter(p=>p.pid===r.pid).map(p=>p.workingSetBytes))}));
  const pass=result.code===0&&receipt.result==='PASS'&&observation.remainingOwnedProcesses.length===0&&!observation.observerDeadlineExceeded&&nativeCoverage.every(r=>r.closed&&r.streamsClosed)&&requiredObserved.every(r=>r.seen&&r.closed&&r.streamsClosed);
  json(path.join(dir,'boundary-closure.json'),{result:pass?'PASS':'FAIL',sourceUnchanged:JSON.stringify(bindings)===JSON.stringify(pins()),observerExit:result.code,nativeCoverage,requiredObserved,observedNativeProcessCount:nativeCoverage.filter(r=>r.seen).length,remainingOwnedProcesses:observation.remainingOwnedProcesses,resourceComparisons,limitation:'Bounded CIM sampling is not exhaustive for short-lived helpers. The timeout, late-success and crash helpers must each be externally observed, and every launched helper must independently reach full process/stream closure with no attributable survivor.'});
  console.log(JSON.stringify({result:pass?'PASS':'FAIL',cases:receipt.cases.length,evidence:dir}));if(!pass)process.exitCode=1;
}else{
  const dir=process.argv[3];assert.ok(dir.startsWith(base+path.sep));
  const referenceHelper=path.join(dir,'reference-helper.ps1');assert.deepEqual(fs.readFileSync(referenceHelper),fs.readFileSync(referenceSource));const referenceProvenance=referenceEvidence(referenceHelper);
  const input=path.join(dir,'i');fs.mkdirSync(input);fs.writeFileSync(path.join(input,'small.data'),'isolated bytes\n',{flag:'wx'});fs.writeFileSync(path.join(input,'oversize.data'),Buffer.alloc(33,65),{flag:'wx'});
  const caseIds=['fixed-native-timely','timeout-exact-mapping','late-native-success-refused','crash-closed-transport','fixed-launch-combined-environment-poison','resource-request-path-cap128-129','resource-native-path-cap129','resource-native-request-prefix-cap','resource-native-declared-file-cap','resource-native-observed-file-cap','resource-sample-reference','resource-sample-corrected','deadline-sequence-no-partial-or-late-success','launch-substitution-require','launch-substitution-import','launch-substitution-loader','secret-safe-error-projection','bounded-state-and-fixed-source-review'];
  const caseAccounting=caseIds.map((id,index)=>({ordinal:index+1,id,status:'NOT_RUN'}));
  const cases=[],invocations=[],before=pins(),syntheticSentinel='MO1307_3CR_SYNTHETIC_ENV_SENTINEL';
  const put=(n,v)=>json(path.join(dir,n),v);
  put('case-plan.json',{kind:'MO1307Phase3CR2DeadlineCasePlan',candidate:'119e68bdcf0ffc906b4ca03a912aadcb25908346',cases:structuredClone(caseAccounting)});
  function req(files=[{id:'small',maxBytes:128,path:'small.data',root:'input'}]){return{kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session:'a7'.repeat(32),sequence:3,operation:'READ_SET',roots:[{id:'input',path:input}],files};}
  function rawFrame(q){const b=canonicalBytes(q,{maxBytes:1000000,stage:'ACQUISITION'});const f=Buffer.alloc(b.length+4);f.writeUInt32BE(b.length);b.copy(f,4);return f;}
  function responseBody(b){assert.equal(b.readUInt32BE(0),b.length-4);return JSON.parse(b.subarray(4).toString());}
  function track(name,child){
    const row={name,pid:child.pid,startedAt:performance.now(),closedAt:null,exitCode:null,stdoutBytes:0,stderrBytes:0,streamsClosed:false,killRequestedAt:null};invocations.push(row);
    const out=[],err=[];const streamClosed={stdin:false,stdout:false,stderr:false};
    for(const k of ['stdin','stdout','stderr'])child[k].once('close',()=>{streamClosed[k]=true;row.streamsClosed=Object.values(streamClosed).every(Boolean);});
    child.stdout.on('data',b=>{out.push(Buffer.from(b));row.stdoutBytes+=b.length;row.responseAt??=performance.now();});child.stderr.on('data',b=>{err.push(Buffer.from(b));row.stderrBytes+=b.length;});
    child.once('close',code=>{row.exitCode=code;row.closedAt=performance.now();fs.writeFileSync(path.join(dir,name+'.stdout.bin'),Buffer.concat(out),{flag:'wx'});fs.writeFileSync(path.join(dir,name+'.stderr.txt'),Buffer.concat(err),{flag:'wx'});});
    return{row,out,err};
  }
  async function test(name,layer,action){const accounting=caseAccounting.find(row=>row.id===name);assert.ok(accounting,`Unplanned case: ${name}`);assert.equal(accounting.status,'NOT_RUN');accounting.status='RUNNING';const start=performance.now();try{const detail=await action();cases.push({id:name,layer,result:'PASS',elapsedMs:performance.now()-start,detail});accounting.status='PASS';put(name+'.json',cases.at(-1));}catch(e){cases.push({id:name,layer,result:'FAIL',elapsedMs:performance.now()-start,error:{code:e.code??null,message:e.message,stack:e.stack}});accounting.status='FAIL';put(name+'.json',cases.at(-1));throw e;}}
  async function native(name,{delay=0,late=false,crash=false,poison=false}={}){
    const supervisor=createSupervisor({kind:'cli'});let tracking,child,originalKill,eofTimer,crashTimer,fallbackTimer;
    const poisonValues={PATH:path.join(dir,'substitution'),PATHEXT:'.CMD;.PS1;.BAD',HOME:path.join(dir,'home'),USERPROFILE:path.join(dir,'profile'),HTTP_PROXY:'http://127.0.0.1:1',HTTPS_PROXY:'http://127.0.0.1:1',ALL_PROXY:'http://127.0.0.1:1',AWS_SECRET_ACCESS_KEY:syntheticSentinel,GITHUB_TOKEN:syntheticSentinel,AZURE_CLIENT_SECRET:syntheticSentinel,POWERSHELL:path.join(dir,'substitution','powershell.cmd'),PSHOME:path.join(dir,'substitution'),PSModulePath:path.join(dir,'substitution'),SystemRoot:path.join(dir,'fake-windows'),WINDIR:path.join(dir,'fake-windows'),MEMORYOS_READINESS_HELPER:path.join(dir,'substitution','evil.ps1'),POWERSHELL_EXECUTABLE:path.join(dir,'substitution','powershell.cmd'),PSExecutionPolicyPreference:'Restricted'};
    const saved=Object.fromEntries(Object.keys(poisonValues).map(k=>[k,process.env[k]]));
    if(poison){fs.mkdirSync(path.join(dir,'substitution'));const marker=path.join(dir,'SUBSTITUTED.txt');fs.writeFileSync(path.join(dir,'substitution','powershell.cmd'),'@echo off\r\necho substitution>"'+marker+'"\r\nexit /b 0\r\n',{flag:'wx'});fs.writeFileSync(path.join(dir,'substitution','evil.ps1'),"[IO.File]::WriteAllText('"+marker.replaceAll("'","''")+"','substitution')\n",{flag:'wx'});Object.assign(process.env,poisonValues);}
    let answer=null,error=null;
    try{
      const transport=createHelperTransportForTesting(supervisor,(executable,args,options)=>{
        assert.equal(executable,spec.executable);assert.deepEqual(args,[...spec.args]);assert.deepEqual(options.env,{...spec.options.env});assert.equal(options.cwd,spec.options.cwd);assert.equal(options.shell,false);assert.equal(options.windowsHide,true);
        child=spawn(executable,args,options);tracking=track(name,child);originalKill=child.kill.bind(child);
        const originalEnd=child.stdin.end.bind(child.stdin);
        child.stdin.end=(frame,...rest)=>{fs.writeFileSync(path.join(dir,name+'.request.bin'),frame,{flag:'wx'});if(delay&&!late){child.stdin.write(frame);eofTimer=setTimeout(()=>{if(!child.stdin.destroyed)originalEnd(...rest);},delay);return child.stdin;}return originalEnd(frame,...rest);};
        if(late){
          const proxy=new EventEmitter();proxy.pid=child.pid;proxy.stdin=child.stdin;proxy.stderr=child.stderr;proxy.stdout=new PassThrough();proxy.unref=()=>child.unref();proxy.kill=()=>{tracking.row.killRequestedAt=performance.now();return child.exitCode===null?originalKill():true;};
          const lateOut=[];let outputEnded=false,released=false;
          child.stdout.on('data',b=>{if(released)proxy.stdout.write(b);else lateOut.push(Buffer.from(b));});child.stdout.once('end',()=>{outputEnded=true;if(released)proxy.stdout.end();});
          child.once('close',code=>proxy.emit('close',code));child.once('error',error=>proxy.emit('error',error));
          const destroy=proxy.stdout.destroy.bind(proxy.stdout);let skipped=false;proxy.stdout.destroy=(...a)=>{if(!skipped){skipped=true;return proxy.stdout;}return destroy(...a);};
          eofTimer=setTimeout(()=>{released=true;tracking.row.deliveredAt=performance.now();for(const b of lateOut)proxy.stdout.write(b);if(outputEnded)proxy.stdout.end();},8250);
          return proxy;
        }
        if(crash)crashTimer=setTimeout(()=>{tracking.row.crashRequestedAt=performance.now();originalKill();},2200);
        return child;
      });
      try{answer=await transport.exchange(encodeHelperRequest(req()));}catch(e){error=e;}
      const expected=crash?'MO1307_INTERNAL':delay?'MO1307_TIMEOUT':null;
      assert.equal(error?.code??null,expected);if(expected){assert.equal(error.stage,'ACQUISITION');assert.equal(errorExit(error),crash?22:29);assert.equal(answer,null);}
      else{assert.equal(decodeHelperResponse(answer.responseBytes,req()).status,'OK');assert.equal(answer.exitConfirmed,true);}
      const snap=supervisor.snapshot();assert.equal(snap.workers,0);assert.equal(snap.helpers,1);if(delay)assert.equal(snap.terminalCode,expected);
      if(late){const body=decodeHelperResponse(Buffer.concat(tracking.out),req());assert.equal(body.status,'OK');assert.ok(tracking.row.deliveredAt>=snap.terminalAt);assert.equal(snap.terminalCode,'MO1307_TIMEOUT');}
      assert.equal(tracking.row.stderrBytes,0);assert.ok(tracking.row.streamsClosed);assert.ok(!Buffer.concat(tracking.out).includes(syntheticSentinel));
      if(poison)assert.equal(fs.existsSync(path.join(dir,'SUBSTITUTED.txt')),false);
      return{accepted:!!answer,errorCode:error?.code??null,mappedPublicExit:error?errorExit(error):null,lateNativeOK:late,noSecretEcho:true,exactFixedLaunch:true,poisonedKeys:poison?Object.keys(poisonValues).sort():[],snapshot:snap,observation:tracking.row};
    }finally{clearTimeout(eofTimer);clearTimeout(crashTimer);clearTimeout(fallbackTimer);if(child&&tracking.row.closedAt===null)originalKill?.();await supervisor.dispose();if(poison)for(const[k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
  }
  async function direct(name,frame,{script=spec.args.at(-1),expectedCode=null}={}){
    const args=[...spec.args];args[args.length-1]=script;const child=spawn(spec.executable,args,{...spec.options,env:{...spec.options.env},stdio:[...spec.options.stdio]});const t=track(name,child);let killed=false;
    const timer=setTimeout(()=>{killed=true;child.kill();},15000);child.stdin.end(frame);fs.writeFileSync(path.join(dir,name+'.request.bin'),frame,{flag:'wx'});
    const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});clearTimeout(timer);assert.ok(!killed);assert.equal(exit,0);assert.equal(t.row.stderrBytes,0);assert.ok(t.row.streamsClosed);const b=responseBody(Buffer.concat(t.out));assert.equal(b.code,expectedCode);assert.equal(b.status,expectedCode?'ERROR':'OK');return{response:b.code??b.status,observation:t.row,engineeringGuardMs:15000,scriptBinding:bind(script)};
  }
  let failure=null;
  try{
    await test('fixed-native-timely','ACTUAL_FIXED_HELPER',()=>native('fixed-native-timely'));
    await test('timeout-exact-mapping','ACTUAL_FIXED_HELPER_ENGINEERING_EOF_DELAY',()=>native('timeout-exact-mapping',{delay:9000}));
    await test('late-native-success-refused','ACTUAL_FIXED_HELPER_FRAME_ENGINEERING_DELAYED_STREAM_DELIVERY',()=>native('late-native-success-refused',{delay:8250,late:true}));
    await test('crash-closed-transport','ACTUAL_FIXED_HELPER_OWNED_PROCESS_KILL',()=>native('crash-closed-transport',{delay:10000,crash:true}));
    await test('fixed-launch-combined-environment-poison','ACTUAL_FIXED_HELPER',()=>native('fixed-launch-combined-environment-poison',{poison:true}));
    await test('resource-request-path-cap128-129','PRODUCTION_JS_ADMISSION',()=>{const files=Array.from({length:128},(_,i)=>({id:'f'+String(i).padStart(3,'0'),maxBytes:0,path:'f'+i+'.data',root:'input'}));assert.ok(encodeHelperRequest(req(files)).length>0);files.push({id:'f128',maxBytes:0,path:'f128.data',root:'input'});assert.throws(()=>encodeHelperRequest(req(files)),e=>e.code==='MO1307_RESOURCE_LIMIT');return{acceptedPathCount:128,rejectedPathCount:129};});
    await test('resource-native-path-cap129','ACTUAL_FIXED_HELPER_RAW_ENGINEERING_TRANSPORT',()=>direct('resource-native-path-cap129',rawFrame(req(Array.from({length:129},(_,i)=>({id:'f'+String(i).padStart(3,'0'),maxBytes:0,path:'f'+i+'.data',root:'input'})))),{expectedCode:'MO1307_RESOURCE_LIMIT'}));
    await test('resource-native-request-prefix-cap','ACTUAL_FIXED_HELPER_RAW_ENGINEERING_TRANSPORT',()=>{const b=Buffer.alloc(4);b.writeUInt32BE(DEFINITIONS.limits.helperRequestBytes-3);return direct('resource-native-request-prefix-cap',b,{expectedCode:'MO1307_RESOURCE_LIMIT'});});
    await test('resource-native-declared-file-cap','ACTUAL_FIXED_HELPER_RAW_ENGINEERING_TRANSPORT',()=>direct('resource-native-declared-file-cap',rawFrame(req([{id:'small',maxBytes:2097153,path:'small.data',root:'input'}])),{expectedCode:'MO1307_RESOURCE_LIMIT'}));
    await test('resource-native-observed-file-cap','ACTUAL_FIXED_HELPER_RAW_ENGINEERING_TRANSPORT',()=>direct('resource-native-observed-file-cap',encodeHelperRequest(req([{id:'oversize',maxBytes:32,path:'oversize.data',root:'input'}])),{expectedCode:'MO1307_RESOURCE_LIMIT'}));
    await test('resource-sample-reference','SEALED_CORRECTED_PRODUCTION_REFERENCE_ENGINEERING_SCRIPT_SELECTION',()=>direct('resource-sample-reference',encodeHelperRequest(req()),{script:referenceHelper}));
    await test('resource-sample-corrected','ACTUAL_FIXED_HELPER_RAW_ENGINEERING_TRANSPORT',()=>direct('resource-sample-corrected',encodeHelperRequest(req())));
    await test('deadline-sequence-no-partial-or-late-success','PRODUCTION_SEQUENCE_SYNTHETIC_CLOCK',()=>{let now=0;const seq=createHelperSequence('evaluate',{session:'a7'.repeat(32),now:()=>now});const q={...req([{id:'authority',maxBytes:1048576,path:'authority.data',root:'input'},{id:'config',maxBytes:16384,path:'config.data',root:'input'}]),sequence:1};seq.begin(q);now=8000;assert.throws(()=>seq.complete(Buffer.alloc(0)),e=>e.code==='MO1307_TIMEOUT');assert.throws(()=>seq.complete(Buffer.alloc(0)),e=>e.code==='MO1307_INPUT');return{deadlineMs:8000,successRule:'elapsedMs < 8000',timeoutRule:'elapsedMs >= 8000',firstError:'MO1307_TIMEOUT',subsequentTerminalRefusal:'MO1307_INPUT'};});
    for(const flag of ['--require=untrusted.cjs','--import=untrusted.mjs','--loader=untrusted.mjs'])await test('launch-substitution-'+flag.split('=')[0].slice(2),'PRODUCTION_LAUNCH_ADMISSION',()=>{assert.throws(()=>validateLaunch({platform:'win32',arch:'x64',version:'v24.21.0',execArgv:[flag],environment:{}}),e=>e.code==='MO1307_USAGE');return{code:'MO1307_USAGE',noModuleExecuted:true};});
    await test('secret-safe-error-projection','PRODUCTION_ERROR_SERIALIZATION',()=>{const b=serializeError(new Error(syntheticSentinel));assert.ok(!b.includes(syntheticSentinel));assert.equal(JSON.parse(b).code,'MO1307_INTERNAL');return{diagnostic:JSON.parse(b),sentinelAbsent:true};});
    await test('bounded-state-and-fixed-source-review','SOURCE_REVIEW_MECHANICAL_DEPENDENCY_BINDING',()=>{
      const historicalBytes=relative=>{const result=spawnSync(gitExecutable,['-c','core.longpaths=true','-c',`safe.directory=${root.replaceAll('\\','/').replace(/\/$/,'')}`,'show',historical+':repositories/memoryos-readiness/'+relative],{cwd:root,windowsHide:true,encoding:null,maxBuffer:64*1024*1024});assert.equal(result.status,0,result.stderr?.toString());return result.stdout;};
      const bindings=before.map(n=>{const oldBytes=historicalBytes(n.relative);return{relative:n.relative,oldSha256:sha(oldBytes),newSha256:n.sha256,equal:sha(oldBytes)===n.sha256};});
      assert.ok(bindings.filter(r=>!['helpers/windows-inspect.ps1','src/helper-transport.mjs','src/constants.mjs'].includes(r.relative)).every(r=>r.equal));
      const oldDefinitions=JSON.parse(historicalBytes('contracts/definitions.json'));const newDefinitions=JSON.parse(fs.readFileSync(path.join(root,'repositories/memoryos-readiness/contracts/definitions.json')));const oldLimit=oldDefinitions.limits.helperDeadlineMs,newLimit=newDefinitions.limits.helperDeadlineMs;delete oldDefinitions.limits.helperDeadlineMs;delete newDefinitions.limits.helperDeadlineMs;assert.deepEqual(newDefinitions,oldDefinitions);assert.equal(oldLimit,5000);assert.equal(newLimit,8000);
      const sourceDeltaReview=reviewRepositorySource({requireReuseProof:true,requireCheckout:true});
      assert.equal(sourceDeltaReview.result,'PASS');
      assert.equal(sourceDeltaReview.authorizedDiff.hunkCount,28);
      assert.equal(sourceDeltaReview.authorizedDiff.unexpectedChangeCount,0);
      assert.equal(sourceDeltaReview.authorizedDiff.allHunksClassified,true);
      assert.equal(sourceDeltaReview.authorizedDiff.everySecurityCriticalHunkReviewed,true);
      assert.equal(sourceDeltaReview.commentHandling.globallyStrippedSourceEqualityUsed,false);
      assert.equal(sourceDeltaReview.commentHandling.allCommentOnlyExecutableProjectionsEqual,true);
      assert.equal(sourceDeltaReview.securitySemantics.result,'PASS');
      assert.equal(sourceDeltaReview.dependencySelection.changedDependencies.count,9);
      assert.equal(sourceDeltaReview.dependencySelection.changedDependencies.result,'PASS');
      assert.equal(sourceDeltaReview.dependencySelection.changedDependencies.disposition,'FRESH_REVIEW_REQUIRED_AND_MAPPED');
      assert.equal(sourceDeltaReview.dependencySelection.reusedDependencies.result,'PASS');
      assert.equal(sourceDeltaReview.dependencySelection.reusedDependencies.action,'REUSE_EXACT');
      assert.equal(sourceDeltaReview.dependencySelection.reusedDependencies.count,462);
      assert.deepEqual(sourceDeltaReview.dependencySelection.reusedDependencies.failures,[]);
      const source=fs.readFileSync(spec.args.at(-1),'utf8');const reference=fs.readFileSync(referenceHelper,'utf8');
      const readset=s=>s.slice(s.indexOf('function Invoke-ReadSet'),s.indexOf('function Invoke-Inspection'));
      assert.equal(readset(source),readset(reference));
      assert.ok(!/(?:Invoke-WebRequest|Invoke-RestMethod|System\.Net|WebClient|HttpClient|Write-Host|Write-Verbose|Write-Debug|Stopwatch|Get-Date|deadline)/i.test(source));
      return{bindings,definitionsProjection:{allFieldsExceptHelperDeadlineMsEqual:true,historicalHelperDeadlineMs:oldLimit,currentHelperDeadlineMs:newLimit},rawHistoricalSourceEqualityRequired:false,dependencyAwareSourceReview:true,sourceDeltaReview,readSetBodyIdentical:true,referenceProvenance,requestLocalCollections:['rootChains <=3 roots','responseRoots <=3','responseFiles <=128 files','nativeFiles <=128 native ids','data <=maxBytes+1 per file','chunks bounded by maxBytes and response ceiling'],limits:DEFINITIONS.limits,findings:['All nine C3RB-to-C3TB changed product members and all 28 unified-zero hunks match exact old/new blobs and per-hunk fingerprints; no unexpected source delta exists.','Every changed dependency is mapped to a required fresh review, and all 14 security-critical hunks are mechanically reviewed.','All 462 reuse rows remain REUSED_EXACT with every exercised facet equal; moved-to-fresh, unresolved and mismatch sets are empty.','Console startup fails closed, admits only positive sole-helper membership, requires FreeConsole, performs no post-detach membership query, PPID/window ownership inference or speculative host termination, and still requires process-and-pipe quiescence.','Five comment-only executable-file hunks are classified DOCUMENTATION_ONLY with equal per-hunk executable projections; no global source comment elision or normalization is used.'],scope:'Source review and bounded representative measurements, not aggregate RSS certification.'};
    });
    assert.deepEqual(pins(),before);assert.deepEqual(fs.readFileSync(referenceHelper),fs.readFileSync(referenceSource));
  }catch(e){failure={code:e.code??null,message:e.message,stack:e.stack};const running=caseAccounting.find(row=>row.status==='RUNNING');if(running)running.status='FAIL';process.exitCode=1;}
  finally{put('receipt.json',{kind:'MO1307Phase3CR2RefreshDeadlineEnvironmentReceipt',result:failure?'FAIL':'PASS',failure,cases,caseAccounting,invocations,dependencies:before,referenceProvenance,productionChanged:false,runtime:{version:process.version,platform:process.platform,arch:process.arch},authority:{identity:'PROSPECTIVE_HELPER_BOUND@1.0.0',historicalH:'NOT_ESTABLISHED',success:'elapsedMs < 8000',timeout:'elapsedMs >= 8000'},limits:{helperMs:8000,aggregateHelperActiveMs:20000,cliMs:30000,apiWorkerMs:10000,cleanupMs:2000},scope:'Security boundary controls only; no MO1306 runtime promotion. Timeout/crash without valid native frame leave conservative product cleanupConfirmed=false. External OS observer and full stream/process closures establish actual targeted no-survivor boundary.'});console.log(JSON.stringify({result:failure?'FAIL':'PASS',cases:cases.length}));}
}
