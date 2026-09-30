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
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const self=fileURLToPath(import.meta.url),base=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3/deadline-cleanup');
const oldRoot='C:\\Users\\melsa\\Documents\\Codex\\cca-mo1307-3c';
const sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const bind=p=>{const b=fs.readFileSync(p);return {path:p,byteLength:b.length,sha256:sha(b)};};
const json=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const spec=helperLaunchSpecification();
const pinned=['src/helper-transport.mjs','src/helper-protocol.mjs','src/runtime.mjs','src/windows-paths.mjs','src/cli-args.mjs','src/errors.mjs','src/constants.mjs','helpers/windows-inspect.ps1'];
const pins=()=>pinned.map(p=>({...bind(path.join(root,'repositories/memoryos-readiness',p)),relative:p}));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function childRun(exe,args,options){const c=spawn(exe,args,options);const out=[],err=[];c.stdout.on('data',b=>out.push(b));c.stderr.on('data',b=>err.push(b));return await new Promise((resolve,reject)=>{c.once('error',reject);c.once('close',code=>resolve({code,stdout:Buffer.concat(out),stderr:Buffer.concat(err)}));});}
if(process.argv[2]!=='--driver'){
  const attempt=process.argv[2]||'attempt-1';assert.match(attempt,/^attempt-[1-9][0-9]*$/);
  const dir=path.join(base,attempt);fs.mkdirSync(dir,{recursive:false});
  fs.copyFileSync(self,path.join(dir,'executed-harness.mjs.data'));
  const node=path.join(oldRoot,'.cache/mo1307-phase3c-runtime/node.exe');
  const bindings=pins();json(path.join(dir,'campaign.json'),{kind:'MO1307Phase3CRefreshDeadlineEnvironment',baseline:'defe93989efc6501b1a730b82e79e705884b269b',created:new Date().toISOString(),node:bind(node),helper:bind(spec.args.at(-1)),sources:bindings,launch:spec,scope:'Representative security boundary only. No CLI smoke, worker/runtime certification, provider use, production change or package certification.',controls:'Actual fixed executable/script with engineering stdin EOF or shutdown timing control; crash forced on owned process. Raw request limits use engineering 15000ms outer guard. Old helper is an explicitly selected read-only historical algorithm resource comparison.'});
  const observer=String.raw`param([string]$Node,[string]$Driver,[string]$Evidence)
$ErrorActionPreference='Stop'
$psi=New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName=$Node
$psi.Arguments='"'+$Driver+'" --driver "'+$Evidence+'"'
$psi.UseShellExecute=$false
$psi.CreateNoWindow=$false
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
  [IO.File]::WriteAllText((Join-Path $Evidence 'driver.stdout.txt'),$stdout.GetAwaiter().GetResult(),(New-Object Text.UTF8Encoding($false)))
  [IO.File]::WriteAllText((Join-Path $Evidence 'driver.stderr.txt'),$stderr.GetAwaiter().GetResult(),(New-Object Text.UTF8Encoding($false)))
  Start-Sleep -Milliseconds 100
  $after=@(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CreationDate)
  $remaining=@($after | Where-Object {$k=[string]$_.ProcessId;($_.ParentProcessId -eq $driverPid) -or ($known.ContainsKey([string]$_.ParentProcessId)) -or ($known.ContainsKey($k) -and $known[$k].CreationDate -eq $_.CreationDate)})
}
$record=[ordered]@{kind='MO1307TargetedRefreshExternalOSObservation';driverPid=$driverPid;exitCode=$(if($proc.HasExited){$proc.ExitCode}else{$null});observerDeadlineExceeded=$over;sampleCount=$samples.Count;remainingOwnedProcesses=@($remaining);samples=@($samples.ToArray());limitations=@('Bounded CIM sampling is not exhaustive evidence of absence between samples. Fixed helper console-handle closure plus full stream/process close events supply transition proof.','Only attributable descendant identity/PID/resource fields collected; no environment, credentials or command lines collected.','RSS is representative observation, not runtime capacity certification or hard memory isolation.')}
$record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Evidence 'process-observation.json') -Encoding UTF8
if($over -or -not $proc.HasExited -or $proc.ExitCode -ne 0 -or $remaining.Count -ne 0){exit 1}
exit 0
`;
  const ps=path.join(dir,'observer.ps1');fs.writeFileSync(ps,observer,{flag:'wx'});
  const result=await childRun(spec.executable,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',ps,'-Node',node,'-Driver',self,'-Evidence',dir],{cwd:root,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
  fs.writeFileSync(path.join(dir,'observer.stdout.txt'),result.stdout);fs.writeFileSync(path.join(dir,'observer.stderr.txt'),result.stderr);
  const observation=JSON.parse(fs.readFileSync(path.join(dir,'process-observation.json'),'utf8').replace(/^\uFEFF/,''));
  const receipt=JSON.parse(fs.readFileSync(path.join(dir,'receipt.json'),'utf8'));
  const seen=new Set(observation.samples.flatMap(s=>s.processes.map(p=>p.pid)));
  const nativeCoverage=receipt.invocations.map(r=>({name:r.name,pid:r.pid,seen:seen.has(r.pid),closed:r.closedAt!==null,streamsClosed:r.streamsClosed}));
  const resourceComparisons=receipt.invocations.filter(r=>r.name.startsWith('resource-sample')).map(r=>({name:r.name,pid:r.pid,elapsedMs:r.closedAt-r.startedAt,sampledWorkingSetMax:Math.max(0,...observation.samples.flatMap(s=>s.processes).filter(p=>p.pid===r.pid).map(p=>p.workingSetBytes))}));
  const pass=result.code===0&&receipt.result==='PASS'&&observation.remainingOwnedProcesses.length===0&&!observation.observerDeadlineExceeded&&nativeCoverage.every(r=>r.closed&&r.streamsClosed);
  json(path.join(dir,'boundary-closure.json'),{result:pass?'PASS':'FAIL',sourceUnchanged:JSON.stringify(bindings)===JSON.stringify(pins()),observerExit:result.code,nativeCoverage,remainingOwnedProcesses:observation.remainingOwnedProcesses,resourceComparisons,limitation:'No exhaustive transient process observation or runtime/resource certification. Product cleanup flag remains conservatively unconfirmed after timeout/crash without a valid native response; OS plus process/stream witness establishes no survivor for these controls.'});
  console.log(JSON.stringify({result:pass?'PASS':'FAIL',cases:receipt.cases.length,evidence:dir}));if(!pass)process.exitCode=1;
}else{
  const dir=process.argv[3];assert.ok(dir.startsWith(base+path.sep));
  const input=path.join(dir,'i');fs.mkdirSync(input);fs.writeFileSync(path.join(input,'small.data'),'isolated bytes\n');fs.writeFileSync(path.join(input,'oversize.data'),Buffer.alloc(33,65));
  const cases=[],invocations=[],before=pins(),syntheticSentinel='MO1307_3CR_SYNTHETIC_ENV_SENTINEL';
  const put=(n,v)=>json(path.join(dir,n),v);
  function req(files=[{id:'small',maxBytes:128,path:'small.data',root:'input'}]){return{kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session:'a7'.repeat(32),sequence:3,operation:'READ_SET',roots:[{id:'input',path:input}],files};}
  function rawFrame(q){const b=canonicalBytes(q,{maxBytes:1000000,stage:'ACQUISITION'});const f=Buffer.alloc(b.length+4);f.writeUInt32BE(b.length);b.copy(f,4);return f;}
  function responseBody(b){assert.equal(b.readUInt32BE(0),b.length-4);return JSON.parse(b.subarray(4).toString());}
  function track(name,child){
    const row={name,pid:child.pid,startedAt:performance.now(),closedAt:null,exitCode:null,stdoutBytes:0,stderrBytes:0,streamsClosed:false,killRequestedAt:null};invocations.push(row);
    const out=[],err=[];const streamClosed={stdin:false,stdout:false,stderr:false};
    for(const k of ['stdin','stdout','stderr'])child[k].once('close',()=>{streamClosed[k]=true;row.streamsClosed=Object.values(streamClosed).every(Boolean);});
    child.stdout.on('data',b=>{out.push(Buffer.from(b));row.stdoutBytes+=b.length;row.responseAt??=performance.now();});child.stderr.on('data',b=>{err.push(Buffer.from(b));row.stderrBytes+=b.length;});
    child.once('close',code=>{row.exitCode=code;row.closedAt=performance.now();fs.writeFileSync(path.join(dir,name+'.stdout.bin'),Buffer.concat(out));fs.writeFileSync(path.join(dir,name+'.stderr.txt'),Buffer.concat(err));});
    return{row,out,err};
  }
  async function test(name,layer,action){const start=performance.now();try{const detail=await action();cases.push({id:name,layer,result:'PASS',elapsedMs:performance.now()-start,detail});put(name+'.json',cases.at(-1));}catch(e){cases.push({id:name,layer,result:'FAIL',elapsedMs:performance.now()-start,error:{code:e.code??null,message:e.message,stack:e.stack}});put(name+'.json',cases.at(-1));throw e;}}
  async function native(name,{delay=0,late=false,crash=false,poison=false}={}){
    const supervisor=createSupervisor({kind:'cli'});let tracking,child,originalKill,eofTimer,crashTimer,fallbackTimer;
    const poisonValues={PATH:path.join(dir,'substitution'),PATHEXT:'.CMD;.PS1;.BAD',HOME:path.join(dir,'home'),USERPROFILE:path.join(dir,'profile'),HTTP_PROXY:'http://127.0.0.1:1',HTTPS_PROXY:'http://127.0.0.1:1',ALL_PROXY:'http://127.0.0.1:1',AWS_SECRET_ACCESS_KEY:syntheticSentinel,GITHUB_TOKEN:syntheticSentinel,AZURE_CLIENT_SECRET:syntheticSentinel,POWERSHELL:path.join(dir,'substitution','powershell.cmd'),PSHOME:path.join(dir,'substitution'),PSModulePath:path.join(dir,'substitution'),SystemRoot:path.join(dir,'fake-windows'),WINDIR:path.join(dir,'fake-windows'),MEMORYOS_READINESS_HELPER:path.join(dir,'substitution','evil.ps1'),POWERSHELL_EXECUTABLE:path.join(dir,'substitution','powershell.cmd'),PSExecutionPolicyPreference:'Restricted'};
    const saved=Object.fromEntries(Object.keys(poisonValues).map(k=>[k,process.env[k]]));
    if(poison){fs.mkdirSync(path.join(dir,'substitution'));const marker=path.join(dir,'SUBSTITUTED.txt');fs.writeFileSync(path.join(dir,'substitution','powershell.cmd'),'@echo off\r\necho substitution>"'+marker+'"\r\nexit /b 0\r\n');fs.writeFileSync(path.join(dir,'substitution','evil.ps1'),"[IO.File]::WriteAllText('"+marker.replaceAll("'","''")+"','substitution')\n");Object.assign(process.env,poisonValues);}
    let answer=null,error=null;
    try{
      const transport=createHelperTransportForTesting(supervisor,(executable,args,options)=>{
        assert.equal(executable,spec.executable);assert.deepEqual(args,[...spec.args]);assert.deepEqual(options.env,{...spec.options.env});assert.equal(options.cwd,spec.options.cwd);assert.equal(options.shell,false);assert.equal(options.windowsHide,true);
        child=spawn(executable,args,options);tracking=track(name,child);originalKill=child.kill.bind(child);
        const originalEnd=child.stdin.end.bind(child.stdin);
        child.stdin.end=(frame,...rest)=>{fs.writeFileSync(path.join(dir,name+'.request.bin'),frame);if(delay&&!late){child.stdin.write(frame);eofTimer=setTimeout(()=>{if(!child.stdin.destroyed)originalEnd(...rest);},delay);return child.stdin;}return originalEnd(frame,...rest);};
        if(late){
          const proxy=new EventEmitter();proxy.pid=child.pid;proxy.stdin=child.stdin;proxy.stderr=child.stderr;proxy.stdout=new PassThrough();proxy.unref=()=>child.unref();proxy.kill=()=>{tracking.row.killRequestedAt=performance.now();return child.exitCode===null?originalKill():true;};
          const lateOut=[];let outputEnded=false,released=false;
          child.stdout.on('data',b=>{if(released)proxy.stdout.write(b);else lateOut.push(Buffer.from(b));});child.stdout.once('end',()=>{outputEnded=true;if(released)proxy.stdout.end();});
          child.once('close',code=>proxy.emit('close',code));child.once('error',error=>proxy.emit('error',error));
          const destroy=proxy.stdout.destroy.bind(proxy.stdout);let skipped=false;proxy.stdout.destroy=(...a)=>{if(!skipped){skipped=true;return proxy.stdout;}return destroy(...a);};
          eofTimer=setTimeout(()=>{released=true;tracking.row.deliveredAt=performance.now();for(const b of lateOut)proxy.stdout.write(b);if(outputEnded)proxy.stdout.end();},5250);
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
    const timer=setTimeout(()=>{killed=true;child.kill();},15000);child.stdin.end(frame);fs.writeFileSync(path.join(dir,name+'.request.bin'),frame);
    const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});clearTimeout(timer);assert.ok(!killed);assert.equal(exit,0);assert.equal(t.row.stderrBytes,0);assert.ok(t.row.streamsClosed);const b=responseBody(Buffer.concat(t.out));assert.equal(b.code,expectedCode);assert.equal(b.status,expectedCode?'ERROR':'OK');return{response:b.code??b.status,observation:t.row,engineeringGuardMs:15000,scriptBinding:bind(script)};
  }
  let failure=null;
  try{
    await test('fixed-native-timely','ACTUAL_FIXED_HELPER',()=>native('fixed-native-timely'));
    await test('timeout-exact-mapping','ACTUAL_FIXED_HELPER_ENGINEERING_EOF_DELAY',()=>native('timeout-exact-mapping',{delay:6000}));
    await test('late-native-success-refused','ACTUAL_FIXED_HELPER_FRAME_ENGINEERING_DELAYED_STREAM_DELIVERY',()=>native('late-native-success-refused',{delay:5250,late:true}));
    await test('crash-closed-transport','ACTUAL_FIXED_HELPER_OWNED_PROCESS_KILL',()=>native('crash-closed-transport',{delay:10000,crash:true}));
    await test('fixed-launch-combined-environment-poison','ACTUAL_FIXED_HELPER',()=>native('fixed-launch-combined-environment-poison',{poison:true}));
    await test('resource-request-path-cap128-129','PRODUCTION_JS_ADMISSION',()=>{const files=Array.from({length:128},(_,i)=>({id:'f'+String(i).padStart(3,'0'),maxBytes:0,path:'f'+i+'.data',root:'input'}));assert.ok(encodeHelperRequest(req(files)).length>0);files.push({id:'f128',maxBytes:0,path:'f128.data',root:'input'});assert.throws(()=>encodeHelperRequest(req(files)),e=>e.code==='MO1307_RESOURCE_LIMIT');return{acceptedPathCount:128,rejectedPathCount:129};});
    await test('resource-native-path-cap129','ACTUAL_FIXED_HELPER_RAW_ENGINEERING_TRANSPORT',()=>direct('resource-native-path-cap129',rawFrame(req(Array.from({length:129},(_,i)=>({id:'f'+String(i).padStart(3,'0'),maxBytes:0,path:'f'+i+'.data',root:'input'})))),{expectedCode:'MO1307_RESOURCE_LIMIT'}));
    await test('resource-native-request-prefix-cap','ACTUAL_FIXED_HELPER_RAW_ENGINEERING_TRANSPORT',()=>{const b=Buffer.alloc(4);b.writeUInt32BE(DEFINITIONS.limits.helperRequestBytes-3);return direct('resource-native-request-prefix-cap',b,{expectedCode:'MO1307_RESOURCE_LIMIT'});});
    await test('resource-native-declared-file-cap','ACTUAL_FIXED_HELPER_RAW_ENGINEERING_TRANSPORT',()=>direct('resource-native-declared-file-cap',rawFrame(req([{id:'small',maxBytes:2097153,path:'small.data',root:'input'}])),{expectedCode:'MO1307_RESOURCE_LIMIT'}));
    await test('resource-native-observed-file-cap','ACTUAL_FIXED_HELPER_RAW_ENGINEERING_TRANSPORT',()=>direct('resource-native-observed-file-cap',encodeHelperRequest(req([{id:'oversize',maxBytes:32,path:'oversize.data',root:'input'}])),{expectedCode:'MO1307_RESOURCE_LIMIT'}));
    await test('resource-sample-old-b2','HISTORICAL_HELPER_ENGINEERING_SCRIPT_SELECTION',()=>direct('resource-sample-old-b2',encodeHelperRequest(req()),{script:path.join(oldRoot,'repositories/memoryos-readiness/helpers/windows-inspect.ps1')}));
    await test('resource-sample-corrected','ACTUAL_FIXED_HELPER_RAW_ENGINEERING_TRANSPORT',()=>direct('resource-sample-corrected',encodeHelperRequest(req())));
    await test('deadline-sequence-no-partial-or-late-success','PRODUCTION_SEQUENCE_SYNTHETIC_CLOCK',()=>{let now=0;const seq=createHelperSequence('evaluate',{session:'a7'.repeat(32),now:()=>now});const q={...req([{id:'authority',maxBytes:1048576,path:'authority.data',root:'input'},{id:'config',maxBytes:16384,path:'config.data',root:'input'}]),sequence:1};seq.begin(q);now=5000;assert.throws(()=>seq.complete(Buffer.alloc(0)),e=>e.code==='MO1307_TIMEOUT');assert.throws(()=>seq.complete(Buffer.alloc(0)),e=>e.code==='MO1307_INPUT');return{deadlineMs:5000,firstError:'MO1307_TIMEOUT',subsequentTerminalRefusal:'MO1307_INPUT'};});
    for(const flag of ['--require=untrusted.cjs','--import=untrusted.mjs','--loader=untrusted.mjs'])await test('launch-substitution-'+flag.split('=')[0].slice(2),'PRODUCTION_LAUNCH_ADMISSION',()=>{assert.throws(()=>validateLaunch({platform:'win32',arch:'x64',version:'v24.21.0',execArgv:[flag],environment:{}}),e=>e.code==='MO1307_USAGE');return{code:'MO1307_USAGE',noModuleExecuted:true};});
    await test('secret-safe-error-projection','PRODUCTION_ERROR_SERIALIZATION',()=>{const b=serializeError(new Error(syntheticSentinel));assert.ok(!b.includes(syntheticSentinel));assert.equal(JSON.parse(b).code,'MO1307_INTERNAL');return{diagnostic:JSON.parse(b),sentinelAbsent:true};});
    await test('bounded-state-and-fixed-source-review','SOURCE_REVIEW_MECHANICAL_DEPENDENCY_BINDING',()=>{
      const bindings=before.map(n=>{const old=bind(path.join(oldRoot,'repositories/memoryos-readiness',n.relative));return{relative:n.relative,oldSha256:old.sha256,newSha256:n.sha256,equal:old.sha256===n.sha256};});
      assert.ok(bindings.filter(r=>r.relative!=='helpers/windows-inspect.ps1').every(r=>r.equal));
      const source=fs.readFileSync(spec.args.at(-1),'utf8');const old=fs.readFileSync(path.join(oldRoot,'repositories/memoryos-readiness/helpers/windows-inspect.ps1'),'utf8');
      const readset=s=>s.slice(s.indexOf('function Invoke-ReadSet'),s.indexOf('function Invoke-Inspection'));
      assert.equal(readset(source),readset(old));
      assert.ok(!/(?:Invoke-WebRequest|Invoke-RestMethod|System\.Net|WebClient|HttpClient|Write-Host|Write-Verbose|Write-Debug|Stopwatch|Get-Date|deadline)/i.test(source));
      return{bindings,readSetBodyIdentical:true,requestLocalCollections:['rootChains <=3 roots','responseRoots <=3','responseFiles <=128 files','nativeFiles <=128 native ids','data <=maxBytes+1 per file','chunks bounded by maxBytes and response ceiling'],limits:DEFINITIONS.limits,findings:['No new cache, path-keyed global table or cross-request memory: helper processes one frame then exits. Existing script native field stores emitted Win32 delegate type only.','No deadline-dependent helper branch or debug/timing output; parent admission/finish checkpoints and terminal error preserve timeout mapping.','READ_SET control body and owned-chain disposal are byte-identical old/new. Optimization changes pure path validation cost, not allocation structure.','Helper imports/calls expose only existing native filesystem, identity, console/process cleanup primitives. No added network/provider capability.'],scope:'Source review and bounded representative measurements, not aggregate RSS certification.'};
    });
    assert.deepEqual(pins(),before);
  }catch(e){failure={code:e.code??null,message:e.message,stack:e.stack};process.exitCode=1;}
  finally{put('receipt.json',{kind:'MO1307Phase3CRefreshDeadlineEnvironmentReceipt',result:failure?'FAIL':'PASS',failure,cases,invocations,dependencies:before,productionChanged:false,runtime:{version:process.version,platform:process.platform,arch:process.arch},limits:'Security boundary controls only; no MO1306 runtime promotion. Timeout/crash without valid native frame leave conservative product cleanupConfirmed=false. External OS observer and full stream/process closures establish actual targeted no-survivor boundary.'});console.log(JSON.stringify({result:failure?'FAIL':'PASS',cases:cases.length}));}
}
