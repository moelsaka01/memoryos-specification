// Fresh C3RB native runtime controls. Engineering-only timing seams; exact installed production dependencies.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const installed = path.join(root, '.cache/m7r/install/node_modules/memoryos-readiness');
const evidence = path.join(root, 'repositories/cca-conformance/evidence/mo1307/phase3a-refresh/runtime-controls');
const {createSupervisorForTesting} = await import(pathToFileURL(path.join(installed,'src/runtime.mjs')));
const {createHelperTransportForTesting,helperLaunchSpecification} = await import(pathToFileURL(path.join(installed,'src/helper-transport.mjs')));
const {encodeHelperRequest,decodeHelperResponse} = await import(pathToFileURL(path.join(installed,'src/helper-protocol.mjs')));
const write=(leaf,value)=>fs.writeFileSync(path.join(evidence,leaf),typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const pins=()=>['helpers/windows-inspect.ps1',...fs.readdirSync(path.join(installed,'src')).filter(n=>n.endsWith('.mjs')).map(n=>'src/'+n)].map(file=>({file,sha256:hash(fs.readFileSync(path.join(installed,file)))}));
const before=pins(),spec=helperLaunchSpecification(),cases=[],invocations=[],workerObservations=[];
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
assert.equal(hash(fs.readFileSync(process.execPath)),'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const inputRoot=path.join(evidence,'input');fs.mkdirSync(inputRoot);fs.writeFileSync(path.join(inputRoot,'small.bin'),'{}\n');
const workerURL=new URL('./runtime-controls-worker.mjs',import.meta.url);
write('campaign.json',{kind:'MO1307Phase3ARefreshRuntimeControls',started:new Date().toISOString(),candidate:'defe93989efc6501b1a730b82e79e705884b269b',runtime:{node:process.version,executable:process.execPath,platform:process.platform,arch:process.arch},installed,dependencies:before,launch:spec,controls:'Exact installed helper executable, argv, script, environment and monotonic product budgets. Engineering stdin EOF delays force actual native helper waiting; late controls defer first destroy/kill only to expose real late completion. Worker tests use actual native Node threads and bounded engineering worker bytes. No semantic results derived from engineering worker.',noRetry:true});
const gate=process.argv[2];assert.ok(gate&&path.isAbsolute(gate));
const waitStarted=performance.now();while(!fs.existsSync(gate)){assert.ok(performance.now()-waitStarted<15000,'observer readiness bound');await new Promise(r=>setTimeout(r,10));}
function request(){return {kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session:randomBytes(32).toString('hex'),sequence:3,operation:'READ_SET',roots:[{id:'input',path:inputRoot}],files:[{id:'small',path:'small.bin',root:'input',maxBytes:2097152}]};}
function controlledSpawn(name,{eofDelayMs=0,lateCleanup=false}={}){
 return(executable,args,options)=>{
  assert.equal(executable,spec.executable);assert.deepEqual(args,[...spec.args]);assert.deepEqual(options,{...spec.options,env:{...spec.options.env},stdio:[...spec.options.stdio]});
  const child=spawn(executable,args,options),ordinal=String(invocations.length+1).padStart(3,'0');
  const row={name,ordinal,pid:child.pid,startedAt:performance.now(),eofDelayMs,lateCleanup,stdoutBytes:0,stderrBytes:0,killRequestedAt:null,responseAt:null,closedAt:null,exitAt:null,exitCode:null,streamEvents:[]};
  invocations.push(row);
  const out=[],err=[];let eofTimer,fallbackTimer;
  const originalEnd=child.stdin.end.bind(child.stdin),originalKill=child.kill.bind(child);
  child.stdin.end=(frame,...tail)=>{
   row.request=request;write(ordinal+'.request.bin',frame);
   if(eofDelayMs){child.stdin.write(frame);eofTimer=setTimeout(()=>{if(!child.stdin.destroyed)originalEnd(...tail);},eofDelayMs);return child.stdin;}
   return originalEnd(frame,...tail);
  };
  child.kill=(...args)=>{row.killRequestedAt=performance.now();return originalKill(...args);};
  if(lateCleanup){
   for(const stream of [child.stdin,child.stdout,child.stderr]){const originalDestroy=stream.destroy.bind(stream);let delayed=false;stream.destroy=(...args)=>{if(!delayed){delayed=true;return stream;}return originalDestroy(...args);};}
   child.kill=()=>{row.killRequestedAt=performance.now();return true;};fallbackTimer=setTimeout(()=>originalKill(),6800);
  }
  for(const [id,stream] of [['stdin',child.stdin],['stdout',child.stdout],['stderr',child.stderr]]){
   stream.once('close',()=>row.streamEvents.push({id,event:'close',at:performance.now()}));
   stream.once(id==='stdin'?'finish':'end',()=>row.streamEvents.push({id,event:id==='stdin'?'finish':'end',at:performance.now()}));
  }
  child.stdout.on('data',b=>{row.stdoutBytes+=b.length;out.push(Buffer.from(b));row.responseAt??=performance.now();});
  child.stderr.on('data',b=>{row.stderrBytes+=b.length;err.push(Buffer.from(b));});
  child.once('exit',(code,signal)=>{row.exitAt=performance.now();row.exitCode=code;row.exitSignal=signal;});
  child.once('close',(code,signal)=>{clearTimeout(eofTimer);clearTimeout(fallbackTimer);row.closedAt=performance.now();row.exitCode=code;row.exitSignal=signal;row.transportClosed=['stdin','stdout','stderr'].every(id=>row.streamEvents.some(e=>e.id===id&&e.event==='close'));write(ordinal+'.response.bin',Buffer.concat(out));write(ordinal+'.stderr.data',Buffer.concat(err));});
  return child;
 };
}
class ObservedWorker extends Worker{
 constructor(url,options){super(url,options);this.initialId=this.threadId;this.started=performance.now();workerObservations.push({type:'start',threadId:this.initialId,at:this.started,env:options.env,execArgv:options.execArgv,resourceLimits:options.resourceLimits});this.on('message',()=>workerObservations.push({type:'message',threadId:this.initialId,at:performance.now()}));this.once('exit',code=>{clearTimeout(this.fallback);workerObservations.push({type:'exit',threadId:this.initialId,at:performance.now(),code});});}
 terminate(){workerObservations.push({type:'termination-request',threadId:this.initialId,at:performance.now()});return super.terminate();}
}
class LateWorker extends ObservedWorker{terminate(){workerObservations.push({type:'deferred-termination-request',threadId:this.initialId,at:performance.now()});this.fallback=setTimeout(()=>super.terminate(),1500);return Promise.resolve();}}
async function run(name,options,action){
 const started=performance.now(),controller=new AbortController(),supervisor=createSupervisorForTesting({kind:'cli',signal:controller.signal},{workerURL,WorkerClass:options.WorkerClass??ObservedWorker});
 const transport=createHelperTransportForTesting(supervisor,controlledSpawn(name,options));
 let error=null,detail=null,failure=null;
 try{detail=await action({supervisor,controller,transport});if(options.error)throw new Error('Expected '+options.error);}
 catch(caught){error={code:caught.code??null,message:String(caught.message)};if(!options.error||caught.code!==options.error)failure=String(caught.stack);}
 finally{await supervisor.dispose();}
 const row={name,result:failure?'FAIL':'PASS',elapsedMs:performance.now()-started,error,detail,snapshot:supervisor.snapshot()};
 cases.push(row);write(name+'.json',row);
 if(failure)throw new Error(failure);
 if(options.minMs)assert.ok(row.elapsedMs>=options.minMs,name+' duration '+row.elapsedMs);
 if(options.maxMs)assert.ok(row.elapsedMs<options.maxMs,name+' duration '+row.elapsedMs);
 return row;
}
let failure=null;
try{
 await run('timely-helper',{maxMs:5000},async({transport})=>{const q=request(),a=await transport.exchange(encodeHelperRequest(q)),r=decodeHelperResponse(a.responseBytes,q);assert.equal(r.status,'OK');assert.equal(a.exitConfirmed,true);return {status:r.status,exitConfirmed:true};});
 const timeout=await run('helper-timeout',{eofDelayMs:6500,error:'MO1307_TIMEOUT',minMs:5000,maxMs:7000},async({transport})=>transport.exchange(encodeHelperRequest(request())));
 const t=invocations.find(r=>r.name==='helper-timeout');assert.ok(t.killRequestedAt);assert.equal(t.transportClosed,true);assert.equal(timeout.snapshot.cleanupConfirmed,false);
 const late=await run('late-helper-success-rejected',{eofDelayMs:5200,lateCleanup:true,error:'MO1307_TIMEOUT',minMs:5000,maxMs:7000},async({transport})=>transport.exchange(encodeHelperRequest(request())));
 const li=invocations.find(r=>r.name===late.name);const {decodeHelperRequest}=await import(pathToFileURL(path.join(installed,'src/helper-protocol.mjs')));const lq=decodeHelperRequest(fs.readFileSync(path.join(evidence,li.ordinal+'.request.bin')));const lr=decodeHelperResponse(fs.readFileSync(path.join(evidence,li.ordinal+'.response.bin')),lq);assert.equal(lr.status,'OK');assert.ok(li.responseAt>=late.snapshot.terminalAt);assert.equal(late.snapshot.terminalCode,'MO1307_TIMEOUT');
 const agg=await run('aggregate-helper-exhaustion',{eofDelayMs:3000,error:'MO1307_TIMEOUT',minMs:20000,maxMs:23000},async({supervisor,transport})=>{for(let i=0;i<9;i++){const q=request();const a=await transport.exchange(encodeHelperRequest(q));assert.equal(decodeHelperResponse(a.responseBytes,q).status,'OK');if(i===2)await supervisor.runWorker({mode:'wait',delayMs:250});}});
 const starts=agg.snapshot.events.filter(e=>e.type==='start'&&e.role==='helper'),last=starts.at(-1),atTimeout=agg.snapshot.helperUsedMs+agg.snapshot.terminalAt-last.at;
 assert.ok(last.deadline-last.at<5000);assert.ok(Math.abs(atTimeout-20000)<150,String(atTimeout));assert.equal(agg.snapshot.workers,1);
 write('aggregate-calculation.json',{acceptedHelperActiveMs:agg.snapshot.helperUsedMs,finalHelperStart:last.at,terminalAt:agg.snapshot.terminalAt,helperActiveAtTimeoutMs:atTimeout,elapsedMs:agg.elapsedMs,excludesWorker:true});
 const wt=await run('worker-timeout',{error:'MO1307_TIMEOUT',minMs:10000,maxMs:12000},async({supervisor})=>supervisor.runWorker({mode:'spin'}));assert.equal(wt.snapshot.cleanupConfirmed,true);
 const wc=await run('worker-cancellation',{error:'MO1307_CANCELLED',minMs:100,maxMs:2200},async({supervisor,controller})=>{const timer=setTimeout(()=>controller.abort(),200);try{await supervisor.runWorker({mode:'spin'});}finally{clearTimeout(timer);}});assert.equal(wc.snapshot.cleanupConfirmed,true);
 const wl=await run('late-worker-result-rejected',{WorkerClass:LateWorker,error:'MO1307_TIMEOUT',minMs:10000,maxMs:12000},async({supervisor})=>supervisor.runWorker({mode:'wait',delayMs:10500}));assert.ok(workerObservations.some(e=>e.type==='message'&&e.at>=wl.snapshot.terminalAt));assert.equal(wl.snapshot.terminalCode,'MO1307_TIMEOUT');assert.equal(wl.snapshot.cleanupConfirmed,true);
 assert.deepEqual(pins(),before,'Installed dependencies mutated');
}catch(error){failure={message:String(error.message),stack:String(error.stack),code:error.code??null};process.exitCode=1;}
finally{write('receipt.json',{kind:'MO1307Phase3ARefreshRuntimeControls',result:failure?'FAIL':'PASS',failure,cases,invocations,workerObservations,dependenciesBefore:before,dependenciesAfter:pins(),noProductChanges:true,limits:{helperMs:5000,aggregateMs:20000,workerMs:10000,cliMs:30000},limitations:['Delay controls are engineering-only seams; native helper response frames and native file identities are real.','No valid response exists for killed helper: product cleanupConfirmed remains false and is not relabeled. External retained process handles and transport events separately establish actual cleanup.','Worker control bytes are nonsemantic; worker timeout/cancellation use actual native Node threads.','Process sampler has blind spots between samples; production role guards enforce transitions.']});process.stdout.write(JSON.stringify({result:failure?'FAIL':'PASS',cases:cases.length,invocations:invocations.length,evidence})+'\n');}

