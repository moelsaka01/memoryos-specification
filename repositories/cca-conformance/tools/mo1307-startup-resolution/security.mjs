// Finite A-O engineering validation. Root runs once, only after the bound native smoke PASS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {fileURLToPath} from 'node:url';
import {createSupervisorForTesting} from '../../../memoryos-readiness/src/runtime.mjs';
import {createHelperTransportForTesting,helperLaunchSpecification} from '../../../memoryos-readiness/src/helper-transport.mjs';
import {encodeHelperRequest,encodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';
import {DEFINITIONS} from '../../../memoryos-readiness/src/constants.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),T=path.dirname(fileURLToPath(import.meta.url));
const base=path.join(root,'repositories/cca-conformance/evidence/mo1307/startup-resolution'),E=path.join(base,'security');
const pkg=path.join(root,'repositories/memoryos-readiness'),L=DEFINITIONS.limits,launch=helperLaunchSpecification();
assert.equal(process.argv.length,2);assert.equal(fs.existsSync(E),false,'No retry or alternate evidence directory');fs.mkdirSync(E,{recursive:true});
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const record=file=>{const b=fs.readFileSync(file);return{path:path.relative(root,file).replaceAll('\\','/'),byteLength:b.length,sha256:hash(b)};};
const put=(name,b)=>{const file=path.join(E,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,b,{flag:'wx'});return record(file);};
const write=(name,v)=>put(name,Buffer.from(JSON.stringify(v,null,2)+'\n'));
const err=e=>({name:e.name,code:e.code??null,message:e.message,stack:e.stack});
const names=JSON.parse(fs.readFileSync(path.join(pkg,'package.json'))).files,members=()=>names.map(n=>record(path.join(pkg,n))),before=members();
const matrix=JSON.parse(fs.readFileSync(path.join(T,'security-manifest.json'))),rows=[],faults=[],observations=[];
const smokePath=path.join(base,'minimum-wire-smoke/receipt.json'),smoke=JSON.parse(fs.readFileSync(smokePath));
const smokeSeal=JSON.parse(fs.readFileSync(path.join(base,'minimum-wire-smoke/seal.json')));
const helper=fs.readFileSync(path.join(pkg,'helpers/windows-inspect.ps1'),'utf8');
const extract=(a,b)=>{const start=helper.indexOf(a),end=helper.indexOf(b,start);assert.ok(start>=0&&end>start);return helper.slice(start,end);};
const extracted=extract('function Reject-Protocol(','function Assert-Keys(')+extract('function Confirm-ConsoleQuiescence {','function Open-Native(');
const extractedPath=path.join(E,'extracted-startup.ps1'),doublePath=path.join(T,'startup-double.ps1');
let failure=null,sourceUnchanged=false;
async function run(item,action){
 const row={id:item.id,name:item.name,kind:item.kind,result:'FAIL',startedAt:new Date().toISOString()};
 try{await action(row);assert.deepEqual(members(),before);row.result='PASS';}
 catch(e){row.failure=err(e);throw e;}
 finally{rows.push(row);write(item.id+'/receipt.json',row);}
}
async function startup(name,row){
 const accepted=['sole-helper','no-console'].includes(name),dir=path.join(E,'startup',name);
 fs.mkdirSync(dir,{recursive:true});
 const scenarioPath=path.join(dir,'scenario.json'),proofPath=path.join(dir,'proof.json');
 fs.writeFileSync(scenarioPath,JSON.stringify({name})+'\n',{flag:'wx'});
 const args=[...launch.args.slice(0,-1),doublePath,'-ScenarioPath',scenarioPath,'-ExtractedPath',extractedPath,'-ProofPath',proofPath];
 const data={name,kind:'EXACT_EXTRACTED_FUNCTION_WITH_NATIVE_DOUBLE',expectedExit:accepted?0:22,accepted,result:'FAIL',nativeProductHelper:false,realHostProof:false,events:[]};
 const stdout=[],stderr=[];let outBytes=0,errBytes=0,closed=false,timedOut=false,cleanupExpired=false,timer,guard;
 const begin=performance.now(),deadline=begin+5000;
 let child;
 try{
  child=spawn(launch.executable,args,{...launch.options,env:{...launch.options.env},stdio:[...launch.options.stdio]});data.pid=child.pid;
  const event=(event,details={})=>data.events.push({event,elapsedMs:performance.now()-begin,...details});
  for(const [label,chunks]of [['stdout',stdout],['stderr',stderr]]){
   child[label].on('data',b=>{const used=label==='stdout'?outBytes:errBytes;if(label==='stdout')outBytes+=b.length;else errBytes+=b.length;if(used<4096)chunks.push(Buffer.from(b.subarray(0,4096-used)));});
   child[label].once('end',()=>event(label+'-end'));
  }
  for(const label of ['stdin','stdout','stderr']){child[label].once('close',()=>event(label+'-close'));child[label].on('error',e=>event(label+'-error',{code:e.code??null}));}
  child.stdin.once('finish',()=>event('stdin-finish'));child.once('exit',(code,signal)=>event('exit',{code,signal}));
  const settlement=new Promise((resolve,reject)=>{
   child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});
   timer=setTimeout(()=>{
    timedOut=true;data.timeoutAt=performance.now()-begin;
    child.stdin.destroy();child.stdout.destroy();child.stderr.destroy();if(!closed)child.kill();
    guard=setTimeout(()=>{cleanupExpired=true;child.unref();reject(new Error('Engineering startup double did not close within its 2000 ms cleanup guard'));},Math.max(0,begin+5000+2000-performance.now()));
   },Math.max(0,deadline-performance.now()));
  });
  child.stdin.end();const result=await settlement;data.exitCode=result.code;data.exitSignal=result.signal;data.elapsedMs=performance.now()-begin;
  assert.equal(timedOut,false,'Startup double exceeded unchanged 5000 ms allowance');assert.ok(data.elapsedMs<5000);assert.equal(result.code,data.expectedExit);assert.equal(result.signal,null);
  assert.equal(outBytes,0);assert.equal(errBytes,0);
  for(const event of ['stdin-finish','stdin-close','stdout-end','stdout-close','stderr-end','stderr-close','exit'])assert.ok(data.events.some(x=>x.event===event),event);
  const proof=JSON.parse(fs.readFileSync(proofPath));data.proof=record(proofPath);data.observed=proof;
  assert.equal(proof.accepted,accepted);assert.equal(proof.productionFunctionUnmodified,true);assert.equal(proof.nativeProcessOperationsPerformed,false);
  if(!accepted)assert.equal(proof.failure,'MO1307_INTERNAL');
  assert.ok(proof.events.every(x=>!['TerminateProcess','OpenProcess','GetConsoleWindow','GetWindowThreadProcessId','CreateToolhelp32Snapshot'].includes(x.name)));
  if(name==='sole-helper'){assert.equal(proof.detached,true);assert.equal(proof.events.filter(x=>x.name==='FreeConsole').length,1);}
  if(name==='no-console')assert.equal(proof.detached,false);
  if(['extra-client','overflow','initial-list-error','unrelated-sole-client'].includes(name))assert.equal(proof.detached,false);
  data.result='PASS';
 }catch(e){data.failure=err(e);throw e;}
 finally{
  clearTimeout(timer);clearTimeout(guard);data.closed=closed;data.timedOut=timedOut;data.cleanupExpired=cleanupExpired;
  data.stdout=put('startup/'+name+'/stdout.data',Buffer.concat(stdout));data.stderr=put('startup/'+name+'/stderr.data',Buffer.concat(stderr));data.stdoutBytes=outBytes;data.stderrBytes=errBytes;
  faults.push(data);write('startup/'+name+'/receipt.json',data);row.startupCases??=[];row.startupCases.push(data);
 }
}
const request={kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session:'f'.repeat(64),sequence:4,operation:'CHECK_OUTPUT',roots:[{id:'output',path:'C:\\headless-security-output'}],files:[]};
const identity={attributes:16,byteLength:0,fileId:'1'.repeat(16),finalPath:'C:\\',isDirectory:true,linkCount:1,volumeSerial:'0'.repeat(8)};
const frame=encodeHelperRequest(request),response=encodeHelperResponse({kind:'MemoryOSReadinessHelperResponse',version:'2.0.0',session:request.session,sequence:4,operation:request.operation,roots:[{id:'output-parent',chain:[identity]}],files:[],status:'ABSENT',code:null},request);
const next=()=>new Promise(resolve=>setImmediate(resolve));
function childDouble(){
 const child=new EventEmitter(),events=[],state={processClosed:false,stdinClosed:false,stdoutClosed:false,stderrClosed:false,kills:0};
 child.pid=700000001;child.unref=()=>events.push('unref');
 for(const name of ['stdin','stdout','stderr']){
  const stream=child[name]=new EventEmitter();stream.destroy=()=>{if(!state[name+'Closed']){state[name+'Closed']=true;events.push(name+'-close');stream.emit('close');}};
 }
 child.stdin.end=bytes=>{assert.deepEqual(bytes,frame);queueMicrotask(()=>{events.push('stdin-finish');child.stdin.emit('finish');});};
 child.kill=()=>{state.kills++;for(const name of ['stdin','stdout','stderr'])child[name].destroy();close(null);return true;};
 const close=code=>{if(!state.processClosed){state.processClosed=true;events.push('process-close');child.emit('close',code);}};
 let outputSent=false;const output=()=>{if(outputSent)return;outputSent=true;child.stdout.emit('data',response);child.stdout.emit('end');child.stderr.emit('end');events.push('stdout-end','stderr-end');};
 const finish=(code=0)=>{output();for(const name of ['stdin','stdout','stderr'])child[name].destroy();close(code);};
 return {child,state,events,close,output,finish};
}
async function lifecycle(name,row){
 let now=0;const controller=new AbortController(),supervisor=createSupervisorForTesting({kind:'cli',now:()=>now,signal:controller.signal}),d=childDouble();
 let pending=null,settled=false;
 try{
  const transport=createHelperTransportForTesting(supervisor,(executable,args,options)=>{
   assert.equal(executable,launch.executable);assert.deepEqual(args,[...launch.args]);assert.deepEqual(options,{...launch.options,env:{...launch.options.env},stdio:[...launch.options.stdio]});return d.child;
  });
  pending=transport.exchange(frame);pending.then(()=>{settled=true;},()=>{settled=true;});await next();
  if(name==='crash'){d.child.stdout.emit('end');d.child.stderr.emit('end');for(const k of ['stdin','stdout','stderr'])d.child[k].destroy();d.close(1);await assert.rejects(pending,e=>e.code==='MO1307_INTERNAL');}
  else if(name==='timeout'){now=5000;assert.throws(()=>supervisor.checkpoint('ACQUISITION'),e=>e.code==='MO1307_TIMEOUT');await assert.rejects(pending,e=>e.code==='MO1307_TIMEOUT');}
  else if(name==='late-output'){controller.abort();d.finish();await assert.rejects(pending,e=>e.code==='MO1307_CANCELLED');assert.throws(()=>supervisor.checkpoint(),e=>e.code==='MO1307_CANCELLED');}
  else if(name==='delayed-pipe-close'){
   d.output();d.child.stdin.destroy();d.child.stdout.destroy();d.close(0);await next();assert.equal(settled,false);assert.equal(supervisor.snapshot().activeRole,'helper');
   d.child.stderr.destroy();const result=await pending;assert.equal(result.exitConfirmed,true);
  }else if(name==='quiescence'){
   d.output();await next();assert.equal(settled,false);assert.equal(supervisor.snapshot().activeRole,'helper');d.finish();await pending;
  }else throw new Error('Undeclared transport scenario');
  const snapshot=supervisor.snapshot();row.lifecycle={name,kind:'PRODUCTION_TRANSPORT_WITH_IN_MEMORY_CHILD',snapshot,state:d.state,events:d.events};
  assert.equal(snapshot.helpers,1);assert.equal(snapshot.workers,0);
  if(['crash','timeout'].includes(name)){assert.equal(snapshot.cleanupConfirmed,false);assert.equal(snapshot.activeRole,'helper');}
  else{assert.equal(snapshot.cleanupConfirmed,true);assert.equal(snapshot.activeRole,null);}
  if(snapshot.terminalAt!==null)assert.equal(snapshot.cleanupDeadline,snapshot.terminalAt+2000);
  for(const key of ['processClosed','stdinClosed','stdoutClosed','stderrClosed'])assert.equal(d.state[key],true,key);
 }finally{await supervisor.dispose();if(!row.lifecycle)row.lifecycle={name,snapshot:supervisor.snapshot(),state:d.state,events:d.events};}
}
async function overlap(row){
 const s=createSupervisorForTesting({kind:'cli',now:()=>0});let close,workerConstructed=false;
 const first=s.runOwned('helper',()=>({completion:new Promise(()=>{}),closed:new Promise(r=>{close=r;}),terminate(){close();}}));first.catch(()=>{});
 try{
  await assert.rejects(s.runOwned('worker',()=>{workerConstructed=true;}),e=>e.code==='MO1307_INTERNAL');await assert.rejects(first,e=>e.code==='MO1307_INTERNAL');
  assert.equal(workerConstructed,false);assert.equal(s.snapshot().workers,0);assert.equal(s.snapshot().cleanupConfirmed,true);row.snapshot=s.snapshot();
 }finally{await s.dispose();}
}
async function deadlines(row){
 row.boundaries=[];
 for(const [kind,limit]of [['api',10000],['cli',30000]]){
  let now=0;const s=createSupervisorForTesting({kind,now:()=>now});
  try{now=limit-1;s.checkpoint();now=limit;assert.throws(()=>s.checkpoint(),e=>e.code==='MO1307_TIMEOUT');assert.equal(s.snapshot().cleanupDeadline,limit+2000);row.boundaries.push(s.snapshot());}finally{await s.dispose();}
 }
 let now=0;const s=createSupervisorForTesting({kind:'cli',now:()=>now});
 try{
  for(let i=0;i<4;i++)await s.runOwned('helper',()=>{now+=4999;return{completion:Promise.resolve(),closed:Promise.resolve(),terminate(){}};});
  assert.equal(s.snapshot().helperUsedMs,19996);
  await assert.rejects(s.runOwned('helper',lease=>{assert.equal(lease.deadline,20000);now=20000;return{completion:Promise.resolve(),closed:Promise.resolve(),terminate(){}};}),e=>e.code==='MO1307_TIMEOUT');
  assert.equal(s.snapshot().cleanupDeadline,22000);row.boundaries.push(s.snapshot());
 }finally{await s.dispose();}
 let workerNow=0;const w=createSupervisorForTesting({kind:'api',now:()=>workerNow});
 try{await assert.rejects(w.runOwned('worker',lease=>{assert.equal(lease.deadline,10000);workerNow=10000;return{completion:Promise.resolve(),closed:Promise.resolve(),terminate(){}};}),e=>e.code==='MO1307_TIMEOUT');row.boundaries.push(w.snapshot());}finally{await w.dispose();}
}
try{
 assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');
 assert.equal(before.length,89);assert.equal(smoke.result,'PASS');assert.equal(smoke.sourceUnchanged,true);assert.deepEqual(smoke.source,before);assert.equal(smoke.helperInvocations,1);
 assert.deepEqual(smoke.seal,record(path.join(base,'minimum-wire-smoke/seal.json')));
 for(const binding of [...smokeSeal.runtime,...smokeSeal.governance,...smokeSeal.postRepairBindings])assert.deepEqual(record(path.join(root,binding.path)),binding);
 assert.deepEqual(matrix.items.map(x=>x.id),Array.from({length:15},(_,i)=>String.fromCharCode(65+i)));
 assert.deepEqual(record(path.join(T,'security-manifest.json')),smokeSeal.securityManifest);
 for(const b of smokeSeal.securityDrivers)assert.deepEqual(record(path.join(root,b.path)),b);
 for(const [key,value]of Object.entries({helperDeadlineMs:5000,helperAggregateDeadlineMs:20000,cliDeadlineMs:30000,apiDeadlineMs:10000,cleanupAllowanceMs:2000,stderrBytes:4096}))assert.equal(L[key],value);
 assert.equal(launch.options.detached,false);
 put('extracted-startup.ps1',Buffer.from(extracted));
 write('seal.json',{kind:'MO1307HeadlessSecuritySeal',candidate:null,candidateStatus:'NOT_YET_CANDIDATE',source:before,smoke:record(smokePath),matrix:record(path.join(T,'security-manifest.json')),tools:smokeSeal.securityDrivers,extracted:record(extractedPath),exactExtraction:true,request:put('transport-request.bin',frame),response:put('transport-response.bin',response),newProductHelpers:0,scope:matrix.scope});
 for(const item of matrix.items)await run(item,async row=>{
  if(item.id==='A'){row.smoke=record(smokePath);row.native=smoke.case;assert.equal(smoke.case.result,'PASS');}
  else if(item.id==='B'){row.smoke=record(smokePath);for(const name of item.cases)await startup(name,row);}
  else if(['C','D','E'].includes(item.id)){for(const name of item.cases)await startup(name,row);}
  else if(['F','G'].includes(item.id)){
   const initialization=extract('function Initialize-Native {','function Confirm-ConsoleQuiescence {');
   const imported=[...initialization.matchAll(/@\('([^']+)'/g)].map(x=>x[1]);
   for(const forbidden of ['TerminateProcess','OpenProcess','GetProcessId','GetConsoleWindow','GetWindowThreadProcessId','CreateToolhelp32Snapshot','Process32FirstW','Process32NextW','WaitForSingleObject'])assert.equal(imported.includes(forbidden),false,forbidden);
   assert.equal(/Stop-Process|taskkill|\.Kill\(/i.test(extracted),false);row.nativeImports=imported;row.hostAuthority='NONE';
   for(const name of item.cases)await startup(name,row);
  }else if(['H','I','J'].includes(item.id))await lifecycle(item.cases[0],row);
  else if(item.id==='K'){await lifecycle('delayed-pipe-close',row);for(const name of item.cases.slice(1))await startup(name,row);}
  else if(item.id==='L'){await lifecycle('quiescence',row);for(const name of item.cases.slice(1))await startup(name,row);}
  else if(item.id==='M')await overlap(row);
  else if(item.id==='N'){const refused=faults.filter(x=>!x.accepted);assert.equal(refused.length,13);for(const r of refused){assert.equal(r.result,'PASS');assert.equal(r.exitCode,22);assert.equal(r.stdoutBytes,0);assert.equal(r.stderrBytes,0);}row.reusedRefusalCases=refused.map(x=>x.name);row.additionalInvocations=0;}
  else if(item.id==='O')await deadlines(row);
 });
}catch(e){failure=err(e);}
finally{
 try{assert.deepEqual(members(),before);sourceUnchanged=true;}catch(e){failure??=err(e);}
 if(failure)write('stopped.json',{reason:'FIRST_MANDATORY_SECURITY_FAILURE',failure,noRetry:true,noMoreSecurityCases:true,noRegressions:true});
 write('receipt.json',{kind:'MO1307HeadlessSecurityReceipt',result:failure?'FAIL':'PASS',candidate:null,candidateStatus:'NOT_YET_CANDIDATE',source:before,sourceUnchanged,rows,failure,smoke:record(smokePath),newProductHelpers:0,engineeringExtractedFunctionProcesses:faults.length,allFifteenRequired:matrix.items.map(x=>x.id),noRetry:true,scope:matrix.scope,finishedAt:new Date().toISOString()});
 console.log(JSON.stringify({result:failure?'FAIL':'PASS',completed:rows.length,receipt:path.join(E,'receipt.json')}));process.exitCode=failure?1:0;
}
