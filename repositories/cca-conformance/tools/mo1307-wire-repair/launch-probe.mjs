// Two fixed engineering launch observations; no product helper or wire validation.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),T=path.dirname(fileURLToPath(import.meta.url));
assert.equal(process.argv.length,2);assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');
const old=path.join(root,'repositories/cca-conformance/evidence/mo1307/console-correction/security-execution');
const priorReceiptPath=path.join(old,'normal-native-startup/receipt.json');
const prior=JSON.parse(fs.readFileSync(priorReceiptPath));
const requestPath=path.join(root,prior.request.path),request=fs.readFileSync(requestPath);
const E=path.join(root,'repositories/cca-conformance/evidence/mo1307/wire-repair/launch-diagnostic');
assert.equal(fs.existsSync(E),false,'This fixed diagnostic generation may execute once only');
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const record=file=>{const b=fs.readFileSync(file);return{path:path.relative(root,file).replaceAll('\\','/'),byteLength:b.length,sha256:hash(b)};};
assert.deepEqual(record(requestPath),prior.request);assert.equal(request.length,350);assert.equal(request.readUInt32BE(0),346);
const runtime=JSON.parse(fs.readFileSync(path.join(old,'engineering-runtime.json')));
assert.equal(record(process.execPath).sha256,runtime.node.sha256);
const ps=prior.launch.executable,script=path.join(T,'launch-probe.ps1');
assert.equal(ps,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
assert.deepEqual(prior.launch.args.slice(0,-1),['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File']);
assert.deepEqual(prior.launch.options.stdio,['pipe','pipe','pipe']);assert.equal(prior.launch.options.shell,false);assert.equal(prior.launch.options.windowsHide,true);
assert.equal(fs.readFileSync(script,'utf8').split(/\r?\n/)[0],"[IO.File]::WriteAllText($args[0]+'.entry','SCRIPT_ENTRY',[Text.UTF8Encoding]::new($false))",'Entry witness must be first statement');
const packageRoot=path.join(root,'repositories/memoryos-readiness');
const packageFiles=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json'))).files;
const production=()=>packageFiles.map(name=>record(path.join(packageRoot,name)));
const before=production(),historical=[priorReceiptPath,requestPath,path.join(old,'receipt.json'),path.join(old,'manifest.json')].map(record);
const unchanged=()=>{assert.deepEqual(production(),before);for(const binding of historical)assert.deepEqual(record(path.join(root,binding.path)),binding);};
fs.mkdirSync(E,{recursive:true});
const put=(name,bytes)=>{const f=path.join(E,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,bytes,{flag:'wx'});return record(f);};
const write=(name,value)=>put(name,Buffer.from(JSON.stringify(value,null,2)+'\n'));
const modes=[{name:'detached-true',detached:true},{name:'detached-false',detached:false}];
write('manifest.json',{kind:'MO1307FiniteEngineeringLaunchDiagnostic',modes,sourceBindings:[record(path.join(T,'launch-probe.mjs')),record(script)],runtime:[record(process.execPath),record(ps)],retainedRequest:prior.request,priorFailure:record(priorReceiptPath),historicalBindings:historical,productionBindings:before,policy:{once:true,noRetry:true,stopUnexpectedEngineeringFailure:true,lifecycleMs:5000,cleanupMs:2000,onlyVaryDetached:true},engineeringChangesFromPriorProductLaunch:['Use fixed engineering probe script instead of production helper','Add private file-sidecar path argument to engineering script'],productHelperInvocations:0,productWirePassClaims:0,scope:'Entry/stdio attribution only. Binary echo is the retained request, never a helper response; console client list does not identify a host.'});
const rows=[];
let failure=null;
async function observe(mode){
 const dir=path.join(E,mode.name);fs.mkdirSync(dir);
 const sidecar=path.join(dir,'private-probe'),args=[...prior.launch.args.slice(0,-1),script,sidecar];
 const options={...prior.launch.options,detached:mode.detached,env:{...prior.launch.options.env},stdio:[...prior.launch.options.stdio]};
 const row={name:mode.name,detached:mode.detached,result:'FAIL',launch:{executable:ps,args,options},request:put(mode.name+'/request.bin',request),events:[],startedAt:new Date().toISOString(),productHelperInvoked:false};
 const chunks={stdout:[],stderr:[]},total={stdout:0,stderr:0},flags={stdinFinish:false,stdinClose:false,stdoutEnd:false,stdoutClose:false,stderrEnd:false,stderrClose:false};
 const began=performance.now(),deadline=began+5000;
 let child,timer,cleanupTimer,cleanupStarted=null,ended=false,problem=null;
 const event=(name,detail={})=>row.events.push({event:name,atMs:performance.now()-began,...detail});
 const fail=error=>{problem??={name:error.name,message:error.message,code:error.code??null};};
 await new Promise(resolve=>{
  const complete=()=>{if(ended)return;ended=true;clearTimeout(timer);clearTimeout(cleanupTimer);row.elapsedMs=performance.now()-began;resolve();};
  const abort=reason=>{
   if(cleanupStarted!==null||ended)return;
   cleanupStarted=performance.now();row.cleanupReason=reason;row.cleanupAction='Terminate only exact ChildProcess-owned engineering probe handle; no process enumeration, PID sweep or console-host termination';
   event('cleanup-start',{reason});
   try{row.ownedKillRequested=child?.kill()??false;}catch(error){fail(error);}
   const remaining=Math.max(0,cleanupStarted+2000-performance.now());
   cleanupTimer=setTimeout(()=>{row.cleanupExpired=true;event('cleanup-expired');for(const s of [child?.stdin,child?.stdout,child?.stderr])s?.destroy();child?.unref();complete();},remaining);
  };
  try{
   child=spawn(ps,args,options);row.pid=child.pid;
   child.once('spawn',()=>event('spawn'));
   child.once('error',error=>{fail(error);event('process-error',{code:error.code??null});abort('PROCESS_ERROR');});
   child.once('exit',(code,signal)=>event('exit',{code,signal}));
   child.once('close',(code,signal)=>{row.exit=code;row.signal=signal;event('process-close',{code,signal});complete();});
   for(const [label,stream]of [['stdin',child.stdin],['stdout',child.stdout],['stderr',child.stderr]]){
    stream.once('close',()=>{flags[label+'Close']=true;event(label+'-close');});
    stream.on('error',error=>{fail(error);event(label+'-error',{code:error.code??null});abort('STREAM_ERROR');});
   }
   child.stdin.once('finish',()=>{flags.stdinFinish=true;event('stdin-finish');});
   for(const label of ['stdout','stderr']){
    child[label].once('end',()=>{flags[label+'End']=true;event(label+'-end');});
    child[label].on('data',bytes=>{
     total[label]+=bytes.length;
     const cap=label==='stdout'?65536:4096;
     if(total[label]<=cap)chunks[label].push(Buffer.from(bytes));
     if(total[label]>cap){fail(new Error('ENGINEERING_CAPTURE_CEILING'));abort('CAPTURE_CEILING');}
    });
   }
   timer=setTimeout(()=>{row.lifecycleExpired=true;fail(new Error('ENGINEERING_ABSOLUTE_5000MS_DEADLINE'));abort('LIFECYCLE_DEADLINE');},Math.max(0,deadline-performance.now()));
   child.stdin.end(request,()=>event('stdin-end-callback'));
  }catch(error){fail(error);if(child)abort('SPAWN_SETUP_ERROR');else complete();}
 });
 row.streams=flags;row.stdoutTotalBytes=total.stdout;row.stderrTotalBytes=total.stderr;
 row.stdout=put(mode.name+'/stdout.data',Buffer.concat(chunks.stdout));row.stderr=put(mode.name+'/stderr.data',Buffer.concat(chunks.stderr));
 row.captureTruncated=total.stdout>65536||total.stderr>4096;
 row.entryMarkerExists=fs.existsSync(sidecar+'.entry');row.stateExists=fs.existsSync(sidecar+'.state.json');
 if(row.entryMarkerExists)row.entryMarker=record(sidecar+'.entry');
 if(row.stateExists){row.stateBinding=record(sidecar+'.state.json');try{row.state=JSON.parse(fs.readFileSync(sidecar+'.state.json','utf8'));}catch(error){fail(error);}}
 if(cleanupStarted!==null)row.cleanupElapsedMs=performance.now()-cleanupStarted;
 try{
  if(problem)throw Object.assign(new Error(problem.message),{name:problem.name,code:problem.code});
  assert.equal(row.lifecycleExpired,undefined);assert.equal(row.cleanupExpired,undefined);assert.ok(row.elapsedMs<5000);
  assert.equal(row.exit,0);assert.equal(row.signal,null);assert.equal(total.stderr,0);assert.equal(row.captureTruncated,false);
  for(const [name,value]of Object.entries(flags))assert.equal(value,true,name);
  const bytes=Buffer.concat(chunks.stdout);
  if(mode.detached&&bytes.length===0){
   row.observation=row.entryMarkerExists?'SCRIPT_ENTERED_ZERO_STDOUT':'NO_SCRIPT_ENTRY_ZERO_EXIT';
   if(row.entryMarkerExists){assert.equal(row.state?.phase,'COMPLETE');assert.equal(row.state?.inputEof,true);}
   else assert.equal(row.stateExists,false);
  }else{
   assert.deepEqual(bytes,request,'Exact retained350-byte binary echo required');
   assert.equal(row.entryMarkerExists,true);assert.equal(row.state?.phase,'COMPLETE');assert.equal(row.state.inputEof,true);
   assert.equal(row.state.inputByteLength,request.length);assert.equal(row.state.inputSha256,hash(request));assert.equal(row.state.writeReturned,true);assert.equal(row.state.flushReturned,true);
   row.observation='SCRIPT_ENTRY_AND_EXACT_BINARY_ECHO';
  }
  unchanged();row.result='OBSERVATION_RECORDED';
 }catch(error){row.failure={name:error.name,code:error.code??null,message:error.message,stack:error.stack};throw error;}
 finally{rows.push(row);write(mode.name+'/receipt.json',row);}
}
try{for(const mode of modes)await observe(mode);}
catch(error){failure={name:error.name,code:error.code??null,message:error.message,stack:error.stack};}
finally{
 let sourceUnchanged=false;try{unchanged();sourceUnchanged=true;}catch(error){failure??={name:error.name,message:error.message};}
 write('receipt.json',{kind:'MO1307FiniteEngineeringLaunchDiagnosticReceipt',result:failure?'ENGINEERING_FAILURE':'OBSERVATIONS_COMPLETE',failure,cases:rows,unexecuted:modes.filter(m=>!rows.some(r=>r.name===m.name)).map(m=>m.name),sourceUnchanged,productHelperInvocations:0,productWirePassClaims:0,noRetry:true,diagnosticOnly:true,manifest:record(path.join(E,'manifest.json')),interpretation:'Private first-statement marker distinguishes observed script entry from pre-entry exit; types/native handles describe only these bounded probe invocations. Exact binary echo is not a production helper response or certification.'});
 console.log(JSON.stringify({result:failure?'ENGINEERING_FAILURE':'OBSERVATIONS_COMPLETE',cases:rows.map(r=>({name:r.name,result:r.result,observation:r.observation,exit:r.exit,stdoutBytes:r.stdoutTotalBytes,stderrBytes:r.stderrTotalBytes})),receipt:path.join(E,'receipt.json')}));
 process.exitCode=failure?1:0;
}
