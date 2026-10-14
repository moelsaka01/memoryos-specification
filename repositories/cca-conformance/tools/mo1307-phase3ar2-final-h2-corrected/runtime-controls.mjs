// Final finite Phase 3AR2 C3VB native runtime controls. Engineering-only timing seams; exact installed production dependencies.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const installed = path.join(root, '.cache/phase3ar2-final-h2-corrected/install/node_modules/memoryos-readiness');
const mode=process.argv[2];assert.ok(['H','I'].includes(mode));
const evidence = path.join(root, 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h2-corrected/runtime-'+mode);
const {DEFINITIONS}=await import(pathToFileURL(path.join(installed,'src/constants.mjs')));
const {createSupervisorForTesting} = await import(pathToFileURL(path.join(installed,'src/runtime.mjs')));
const {createHelperTransportForTesting,helperLaunchSpecification} = await import(pathToFileURL(path.join(installed,'src/helper-transport.mjs')));
const {encodeHelperRequest,decodeHelperRequest,decodeHelperResponse,createHelperSequence} = await import(pathToFileURL(path.join(installed,'src/helper-protocol.mjs')));
const write=(leaf,value)=>fs.writeFileSync(path.join(evidence,leaf),typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const authorities=['PROSPECTIVE_HELPER_BOUND@2.0.0','PROSPECTIVE_HELPER_AGGREGATE_BOUND@2.0.0'];
const authorityPaths=['repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/authority.json','repositories/cca-conformance/evidence/mo1307/prospective-helper-aggregate-bound-v2-candidate/authority.json'];
const authorityBindings=authorityPaths.map(relative=>{const bytes=fs.readFileSync(path.join(root,relative));return {path:relative,byteLength:bytes.length,sha256:'sha256:'+hash(bytes)};});
const limitRelations={helperSuccess:'elapsedMs < 9000',helperTimeout:'elapsedMs >= 9000',aggregateSuccess:'helperActiveMs < 28000',aggregateTimeout:'helperActiveMs >= 28000'};
const pins=()=>['helpers/windows-inspect.ps1',...fs.readdirSync(path.join(installed,'src')).filter(n=>n.endsWith('.mjs')).map(n=>'src/'+n)].map(file=>({file,sha256:hash(fs.readFileSync(path.join(installed,file)))}));
const before=pins(),spec=helperLaunchSpecification(),cases=[],invocations=[],workerObservations=[],strictBoundaryChecks=[];
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
assert.equal(hash(fs.readFileSync(process.execPath)),'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const aggregateFixtureRelative='repositories/cca-conformance/fixtures/mo1307/phase3ar2-final-h2-corrected';
const aggregateFixtureRoot=path.join(root,aggregateFixtureRelative),outputRoot=path.join(aggregateFixtureRoot,'absent-output');
const fixtureSnapshot=()=>fs.readdirSync(aggregateFixtureRoot,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).map(entry=>{const target=path.join(aggregateFixtureRoot,entry.name),stat=fs.lstatSync(target);assert.equal(stat.isDirectory(),false,'Aggregate fixture must contain only sealed files');const bytes=fs.readFileSync(target);return {name:entry.name,byteLength:bytes.length,sha256:'sha256:'+hash(bytes)};});
assert.equal(fs.existsSync(outputRoot),false,'Sealed aggregate absent-output target must be absent');const aggregateFixtureBefore=fixtureSnapshot();assert.ok(aggregateFixtureBefore.length>0,'Sealed aggregate fixture is empty');
const inputFixtureRelative='repositories/cca-conformance/fixtures/mo1307/phase3ar2-final-h2-corrected-input';
const inputRoot=path.join(root,inputFixtureRelative),inputNames=['authority','config','candidate','manifest','small'].map(id=>id+'.bin');
const inputSnapshot=()=>fs.readdirSync(inputRoot,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).map(entry=>{const target=path.join(inputRoot,entry.name),stat=fs.lstatSync(target);assert.equal(stat.isFile(),true,'Input fixture must contain only sealed files');const bytes=fs.readFileSync(target);return {name:entry.name,byteLength:bytes.length,sha256:'sha256:'+hash(bytes)};});
const inputFixtureBefore=inputSnapshot();assert.deepEqual(inputFixtureBefore.map(row=>row.name),[...inputNames].sort());assert.ok(inputFixtureBefore.every(row=>row.byteLength===3&&row.sha256==='sha256:'+hash('{}\n')),'Sealed input fixture bytes changed');
const workerURL=new URL('./runtime-controls-worker.mjs',import.meta.url);
write('campaign.json',{kind:'MO1307Phase3AR2C3VBRuntimeControls',mode,timeOrigin:performance.timeOrigin,started:new Date().toISOString(),candidate:'17fa84efe46d30e6f4be85fd2427485677a222a3',authorities:['PROSPECTIVE_HELPER_BOUND@2.0.0','PROSPECTIVE_HELPER_AGGREGATE_BOUND@2.0.0'],historicalCharacterizationH:'NOT_ESTABLISHED',aggregateFixture:{root:aggregateFixtureRelative,target:'absent-output',sealedMembers:aggregateFixtureBefore,runtimeWrites:0},inputFixture:{root:inputFixtureRelative,sealedMembers:inputFixtureBefore,runtimeWrites:0},runtime:{node:process.version,executable:process.execPath,platform:process.platform,arch:process.arch},installed,dependencies:before,launch:spec,controls:'Exact installed helper executable, argv, script, environment and monotonic product budgets. Engineering stdin EOF delays force actual native helper waiting; the aggregate 5700-ms EOF delay makes the unchanged 28000-ms product aggregate deadline terminate the fifth helper before any publication-state operation, so the sealed absent-output fixture remains immutable. Late controls defer first destroy/kill only to expose real late completion. Worker tests use actual native Node threads and bounded engineering worker bytes. No semantic results derived from engineering worker. Deterministic prospective boundary enforcement does not establish historical characterization H.',noRetry:true});
const gate=process.argv[3];assert.ok(gate&&path.isAbsolute(gate));
const waitStarted=performance.now();while(!fs.existsSync(gate)){assert.ok(performance.now()-waitStarted<15000,'observer readiness bound');await new Promise(r=>setTimeout(r,10));}
let clockBridge=null;if(mode==='H'){
const readyClock=JSON.parse(fs.readFileSync(gate,'utf8')),performanceSeenAt=performance.now();
const bridgeRequest={readyQpc:readyClock.qpc,qpcFrequency:readyClock.qpcFrequency,performanceSeenAt,performanceBeforeWriteAt:performance.now()};
fs.writeFileSync(gate+'.clock-bridge.pending',JSON.stringify(bridgeRequest)+'\n',{flag:'wx'});fs.renameSync(gate+'.clock-bridge.pending',gate+'.clock-bridge.json');
const bridgeWaitStarted=performance.now();while(!fs.existsSync(gate+'.clock-bridge-accepted.json')){assert.ok(performance.now()-bridgeWaitStarted<15000,'Clock bridge acknowledgment bound');await new Promise(r=>setTimeout(r,10));}
clockBridge=JSON.parse(fs.readFileSync(gate+'.clock-bridge-accepted.json','utf8'));
assert.equal(clockBridge.qpcFrequency,readyClock.qpcFrequency);assert.ok(clockBridge.qpcAcknowledged>=readyClock.qpc);assert.ok(bridgeRequest.performanceBeforeWriteAt>=performanceSeenAt);assert.ok(clockBridge.offsetLowerMs<=clockBridge.offsetUpperMs);
}
function request(sequence=3,session=randomBytes(32).toString('hex')){
 const file=(id,maxBytes)=>({id,maxBytes,path:id+'.bin',root:'input'});
 return {kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session,sequence,
 operation:sequence>=4?['CHECK_OUTPUT','CHECK_OUTPUT','INSPECT_OUTPUT_ROOT','CHECK_STAGE_ROOT','INSPECT_PENDING','CHECK_FINALIZATION'][sequence-4]:'READ_SET',
 roots:[{id:sequence>=4?'output':'input',path:sequence>=4?outputRoot:inputRoot}],
 files:sequence===1?[file('authority',1048576),file('config',16384)]:sequence===2?[file('candidate',524288),file('manifest',262144)]:sequence===3?[file('small',2097152)]:[]};
}
function controlledSpawn(name,{eofDelayMs=0,lateCleanup=false}={}){
 return(executable,args,options)=>{
  assert.equal(executable,spec.executable);assert.deepEqual(args,[...spec.args]);assert.deepEqual(options,{...spec.options,env:{...spec.options.env},stdio:[...spec.options.stdio]});
  const child=spawn(executable,args,options),ordinal=String(invocations.length+1).padStart(3,'0');
  const row={name,ordinal,helperInvocationOrdinal:invocations.length+1,launch:{executable,args,options},pid:child.pid,startedAt:performance.now(),eofDelayMs,lateCleanup,stdoutBytes:0,stderrBytes:0,killRequestedAt:null,responseAt:null,closedAt:null,exitAt:null,exitCode:null,streamEvents:[]};
  invocations.push(row);
  const out=[],err=[];let eofTimer,fallbackTimer;
  const originalEnd=child.stdin.end.bind(child.stdin),originalKill=child.kill.bind(child);
  child.stdin.end=(frame,...tail)=>{
   const decoded=decodeHelperRequest(frame);Object.assign(row,{protocolSequence:decoded.sequence,operation:decoded.operation,fileCount:decoded.files.length,rootCount:decoded.roots.length,requestSha256:'sha256:'+hash(frame),requestBytes:frame.length});write(ordinal+'.request.bin',frame);
   if(eofDelayMs){child.stdin.write(frame);eofTimer=setTimeout(()=>{if(!child.stdin.destroyed)originalEnd(...tail);},eofDelayMs);return child.stdin;}
   return originalEnd(frame,...tail);
  };
  child.kill=(...args)=>{row.killRequestedAt=performance.now();return originalKill(...args);};
  if(lateCleanup){
   for(const stream of [child.stdin,child.stdout,child.stderr]){const originalDestroy=stream.destroy.bind(stream);let delayed=false;stream.destroy=(...args)=>{if(!delayed){delayed=true;return stream;}return originalDestroy(...args);};}
   child.kill=()=>{row.killRequestedAt=performance.now();return true;};fallbackTimer=setTimeout(()=>originalKill(),10500);
  }
  for(const [id,stream] of [['stdin',child.stdin],['stdout',child.stdout],['stderr',child.stderr]]){
   stream.once('close',()=>row.streamEvents.push({id,event:'close',at:performance.now()}));
   stream.once(id==='stdin'?'finish':'end',()=>row.streamEvents.push({id,event:id==='stdin'?'finish':'end',at:performance.now()}));
  }
  child.stdout.on('data',b=>{row.stdoutBytes+=b.length;if(row.stdoutBytes<=DEFINITIONS.limits.helperResponseBytes)out.push(Buffer.from(b));else row.responseCaptureOverflow=true;row.responseAt??=performance.now();});
  child.stderr.on('data',b=>{row.stderrBytes+=b.length;if(row.stderrBytes<=DEFINITIONS.limits.stderrBytes)err.push(Buffer.from(b));else row.stderrCaptureOverflow=true;});
  child.once('exit',(code,signal)=>{row.exitAt=performance.now();row.exitCode=code;row.exitSignal=signal;});
  child.once('close',(code,signal)=>{clearTimeout(eofTimer);clearTimeout(fallbackTimer);row.closedAt=performance.now();row.exitCode=code;row.exitSignal=signal;row.transportClosed=['stdin','stdout','stderr'].every(id=>row.streamEvents.some(e=>e.id===id&&e.event==='close'));row.responseSha256='sha256:'+hash(Buffer.concat(out));write(ordinal+'.response.bin',Buffer.concat(out));write(ordinal+'.stderr.data',Buffer.concat(err));});
  return child;
 };
}
class ObservedWorker extends Worker{
 constructor(url,options){super(url,options);this.initialId=this.threadId;this.started=performance.now();workerObservations.push({type:'start',caseName:activeCaseName,threadId:this.initialId,at:this.started,env:options.env,execArgv:options.execArgv,resourceLimits:options.resourceLimits});for(const [streamName,stream] of [['stdout',this.stdout],['stderr',this.stderr]])if(stream)for(const event of ['end','close'])stream.once(event,()=>workerObservations.push({type:'stream-'+event,stream:streamName,threadId:this.initialId,at:performance.now()}));this.on('message',()=>workerObservations.push({type:'message',threadId:this.initialId,at:performance.now()}));this.once('exit',code=>{clearTimeout(this.fallback);workerObservations.push({type:'exit',threadId:this.initialId,at:performance.now(),code});});}
 terminate(){workerObservations.push({type:'termination-request',threadId:this.initialId,at:performance.now()});return super.terminate();}
}
class LateWorker extends ObservedWorker{terminate(){workerObservations.push({type:'deferred-termination-request',threadId:this.initialId,at:performance.now()});this.fallback=setTimeout(()=>super.terminate(),1500);return Promise.resolve();}}
let activeCaseName=null;
async function run(name,options,action){
 activeCaseName=name;
 const started=performance.now(),firstInvocation=invocations.length,firstWorkerObservation=workerObservations.length,controller=new AbortController(),supervisor=createSupervisorForTesting({kind:'cli',signal:controller.signal},{workerURL,WorkerClass:options.WorkerClass??ObservedWorker});
 const transport=createHelperTransportForTesting(supervisor,controlledSpawn(name,options));
 let error=null,detail=null,failure=null;
 try{detail=await action({supervisor,controller,transport});if(options.error)throw new Error('Expected '+options.error);}
 catch(caught){error={code:caught.code??null,message:String(caught.message)};if(!options.error||caught.code!==options.error)failure=String(caught.stack);}
 finally{try{await supervisor.dispose();}catch(caught){failure??=String(caught.stack);}}
 const row={name,started,finished:performance.now(),result:failure?'FAIL':'PASS',elapsedMs:performance.now()-started,error,detail,snapshot:supervisor.snapshot(),expectedError:options.error??null,engineeringElapsedEnvelope:{minMs:options.minMs??null,maxMs:options.maxMs??null,productDeadlineOverride:false},invocations:invocations.slice(firstInvocation).map(x=>({ordinal:x.ordinal,pid:x.pid,protocolSequence:x.protocolSequence,operation:x.operation})),workerObservations:workerObservations.slice(firstWorkerObservation)};
 try{
  if(failure)throw new Error(failure);
  if(options.minMs)assert.ok(row.elapsedMs>=options.minMs,name+' duration '+row.elapsedMs);
  if(options.maxMs)assert.ok(row.elapsedMs<options.maxMs,name+' duration '+row.elapsedMs);
  for(const invocation of invocations.slice(firstInvocation)){assert.equal(invocation.responseCaptureOverflow??false,false);assert.equal(invocation.stderrCaptureOverflow??false,false);}
  for(const start of row.workerObservations.filter(x=>x.type==='start')){assert.deepEqual(start.env,{});assert.deepEqual(start.execArgv,[]);assert.equal(start.resourceLimits.maxOldGenerationSizeMb,128);assert.equal(start.resourceLimits.maxYoungGenerationSizeMb,16);assert.ok(row.workerObservations.some(x=>x.type==='exit'&&x.threadId===start.threadId));for(const stream of ['stdout','stderr'])assert.ok(row.workerObservations.some(x=>x.type==='stream-end'&&x.threadId===start.threadId&&x.stream===stream));}
  if(options.validate)await options.validate(row);
 }catch(caught){failure=String(caught.stack);row.result='FAIL';row.failure=failure;}
 cases.push(row);write(name+'.json',row);
 if(failure)throw new Error(failure);
 return row;
}

let failure=null;
try{
 if(mode==='H'){
 for(const [name,elapsed,expected] of [['former-equality-8000-now-success',8000,'PASS'],['strict-before-9000',8999,'PASS'],['equality-9000-timeout',9000,'MO1307_TIMEOUT']]){
  let now=0;const supervisor=createSupervisorForTesting({kind:'cli',now:()=>now});let actual='PASS';
  try{await supervisor.runOwned('helper',()=>{now=elapsed;return {completion:Promise.resolve(),closed:Promise.resolve(),terminate(){}};});}
  catch(error){actual=error.code??String(error);}
  finally{await supervisor.dispose();}
  assert.equal(actual,expected);strictBoundaryChecks.push({name,elapsedMs:elapsed,expected,actual,result:'PASS',installedRuntime:true});
 }
 write('strict-9000-boundary.json',{result:'PASS',authority:'PROSPECTIVE_HELPER_BOUND@2.0.0',relation:{success:'elapsedMs < 9000',timeout:'elapsedMs >= 9000',equality:'TIMEOUT'},checks:strictBoundaryChecks});
 await run('timely-helper',{eofDelayMs:0,maxMs:5000},async({transport})=>{const q=request(),a=await transport.exchange(encodeHelperRequest(q)),r=decodeHelperResponse(a.responseBytes,q);assert.equal(r.status,'OK');assert.equal(a.exitConfirmed,true);return {status:r.status,exitConfirmed:true};});
 await run('cancel-before-helper',{error:'MO1307_CANCELLED',maxMs:1000,validate:row=>assert.equal(row.snapshot.helpers,0)},async({controller,transport})=>{controller.abort();await transport.exchange(encodeHelperRequest(request()));});
 await run('helper-timeout',{eofDelayMs:10000,error:'MO1307_TIMEOUT',minMs:9000,maxMs:12000,validate:row=>{const t=invocations.find(r=>r.name===row.name);assert.ok(t.killRequestedAt);assert.equal(t.transportClosed,true);assert.equal(row.snapshot.cleanupConfirmed,false);}},async({transport})=>transport.exchange(encodeHelperRequest(request())));
 await run('late-helper-success-rejected',{eofDelayMs:9250,lateCleanup:true,error:'MO1307_TIMEOUT',minMs:9000,maxMs:12000,validate:row=>{const li=invocations.find(r=>r.name===row.name),lq=decodeHelperRequest(fs.readFileSync(path.join(evidence,li.ordinal+'.request.bin'))),lr=decodeHelperResponse(fs.readFileSync(path.join(evidence,li.ordinal+'.response.bin')),lq);assert.equal(lr.status,'OK');assert.ok(li.responseAt>=row.snapshot.terminalAt);assert.equal(row.snapshot.terminalCode,'MO1307_TIMEOUT');}},async({transport})=>transport.exchange(encodeHelperRequest(request())));
 await run('cancel-during-helper',{eofDelayMs:6000,error:'MO1307_CANCELLED',minMs:1400,maxMs:3500},async({controller,transport})=>{const timer=setTimeout(()=>controller.abort(),1500);try{await transport.exchange(encodeHelperRequest(request()));}finally{clearTimeout(timer);}});
 await run('cancel-between-helper-worker',{error:'MO1307_CANCELLED',maxMs:9000,validate:row=>{assert.equal(row.snapshot.helpers,1);assert.equal(row.snapshot.workers,0);}},async({supervisor,controller,transport})=>{await transport.exchange(encodeHelperRequest(request()));controller.abort();await supervisor.runWorker({mode:'wait',delayMs:0});});
 await run('aggregate-helper-exhaustion',{eofDelayMs:5700,error:'MO1307_TIMEOUT',minMs:28000,maxMs:31000,validate:row=>{
  const starts=row.snapshot.events.filter(e=>e.type==='start'&&e.role==='helper'),last=starts.at(-1),atTimeout=row.snapshot.helperUsedMs+row.snapshot.terminalAt-last.at;
  assert.ok(row.snapshot.helpers>=5&&row.snapshot.helpers<=9);assert.equal(row.snapshot.workers,1);
  assert.ok(row.snapshot.helperUsedMs>DEFINITIONS.limits.helperAggregateDeadlineMs-DEFINITIONS.limits.helperDeadlineMs);assert.ok(last.deadline<row.snapshot.deadline);assert.ok(last.deadline-last.at<9000);assert.ok(row.snapshot.terminalAt>=last.deadline);assert.ok(Math.abs(atTimeout-28000)<100,String(atTimeout));
  const ws=row.snapshot.events.find(e=>e.type==='start'&&e.role==='worker'),we=row.snapshot.events.find(e=>e.type==='quiescent'&&e.role==='worker');assert.ok(we.at-ws.at>=250);assert.ok(row.elapsedMs-atTimeout>=250);
  write('aggregate-calculation.json',{authority:'PROSPECTIVE_HELPER_AGGREGATE_BOUND@2.0.0',relation:{success:'helperActiveMs < 28000',timeout:'helperActiveMs >= 28000',equality:'TIMEOUT'},acceptedHelperActiveMs:row.snapshot.helperUsedMs,remainingAllowanceMs:28000-row.snapshot.helperUsedMs,finalHelperStartEventAt:last.at,selectedDeadline:last.deadline,cliDeadline:row.snapshot.deadline,terminalAt:row.snapshot.terminalAt,helperActiveAtTimeoutMs:atTimeout,elapsedMs:row.elapsedMs,excludesWorker:true,startEventScope:'Start event follows private lease creation; prior charged helper time exceeds aggregate deadline minus one whole-helper deadline, so the selected deadline is earlier than the CLI deadline.',frozenCalculationToleranceMs:100});
 }},async({supervisor,transport})=>{const sequence=createHelperSequence('evaluate');for(let slot=1;slot<=9;slot++){assert.ok(slot<=5,'Aggregate deadline must terminate before publication-state operations');const q=request(slot,sequence.session),answer=await transport.exchange(sequence.begin(q));assert.equal(sequence.complete(answer.responseBytes).code,null);sequence.helperExited();if(slot===4){sequence.beginWorker();await supervisor.runWorker({mode:'wait',delayMs:250});sequence.endWorker();}}});
 }
 if(mode==='I'){
 await run('worker-timeout',{error:'MO1307_TIMEOUT',minMs:10000,maxMs:12000,validate:row=>assert.equal(row.snapshot.cleanupConfirmed,true)},async({supervisor})=>supervisor.runWorker({mode:'spin'}));
 await run('worker-cancellation',{error:'MO1307_CANCELLED',minMs:100,maxMs:2100,validate:row=>assert.equal(row.snapshot.cleanupConfirmed,true)},async({supervisor,controller})=>{const timer=setTimeout(()=>controller.abort(),100);try{await supervisor.runWorker({mode:'wait',delayMs:5000});}finally{clearTimeout(timer);}});
 await run('late-worker-result-rejected',{WorkerClass:LateWorker,error:'MO1307_TIMEOUT',minMs:10000,maxMs:12000,validate:row=>{const start=row.workerObservations.find(e=>e.type==='start');assert.ok(start);assert.ok(row.workerObservations.some(e=>e.type==='message'&&e.threadId===start.threadId&&e.at>=row.snapshot.terminalAt));assert.equal(row.snapshot.terminalCode,'MO1307_TIMEOUT');assert.equal(row.snapshot.cleanupConfirmed,true);}},async({supervisor})=>supervisor.runWorker({mode:'wait',delayMs:10500}));
 await run('cancel-after-worker-before-publication',{error:'MO1307_CANCELLED',maxMs:1500,validate:row=>{assert.equal(row.snapshot.workers,1);assert.equal(row.snapshot.helpers,0);}},async({supervisor,controller})=>{await supervisor.runWorker({mode:'wait',delayMs:0});controller.abort();supervisor.checkpoint('PUBLICATION');});
 }
  assert.deepEqual(cases.map(row=>row.name),mode==='H'?['timely-helper','cancel-before-helper','helper-timeout','late-helper-success-rejected','cancel-during-helper','cancel-between-helper-worker','aggregate-helper-exhaustion']:['worker-timeout','worker-cancellation','late-worker-result-rejected','cancel-after-worker-before-publication']);
  assert.ok(cases.every(row=>row.result==='PASS'));
  assert.deepEqual(pins(),before,'Installed dependencies mutated');assert.equal(fs.existsSync(outputRoot),false,'Aggregate fixture target mutated');assert.deepEqual(fixtureSnapshot(),aggregateFixtureBefore,'Aggregate fixture root mutated');assert.deepEqual(inputSnapshot(),inputFixtureBefore,'Input fixture root mutated');
}catch(error){failure={message:String(error.message),stack:String(error.stack),code:error.code??null};process.exitCode=1;}
finally{const aggregateFixtureAfter=fixtureSnapshot(),inputFixtureAfter=inputSnapshot();write('receipt.json',{kind:'MO1307Phase3AR2C3VBRuntimeControls',mode,timeOrigin:performance.timeOrigin,clockBridge,result:failure?'FAIL':'PASS',failure,cases,strictBoundaryChecks,invocations,workerObservations,dependenciesBefore:before,dependenciesAfter:pins(),aggregateFixture:{root:aggregateFixtureRelative,target:'absent-output',before:aggregateFixtureBefore,after:aggregateFixtureAfter,targetAbsent:!fs.existsSync(outputRoot),runtimeWrites:0},inputFixture:{root:inputFixtureRelative,before:inputFixtureBefore,after:inputFixtureAfter,runtimeWrites:0},noProductChanges:true,authorities,authorityBindings,historicalCharacterizationH:'NOT_ESTABLISHED',limits:{helperMs:9000,aggregateMs:28000,workerMs:10000,cliMs:30000,cleanupMs:2000},limitRelations,limitations:['Delay controls are engineering-only seams; native helper response frames and native file identities are real.','The aggregate 5700-ms EOF delay is an engineering-only scheduling seam: it changes no product deadline and forces the unchanged 28000-ms aggregate boundary before any publication-state operation or fixture mutation.','No valid response exists for killed helper: product cleanupConfirmed remains false and is not relabeled. External retained process handles and transport events separately establish actual cleanup.','Worker control bytes are nonsemantic; worker timeout/cancellation use actual native Node threads.','Process sampler has blind spots between samples; production role guards enforce transitions.','Deterministic enforcement of the prospective 9000-ms helper and 28000-ms aggregate limits does not establish historical characterization H.']});process.stdout.write(JSON.stringify({result:failure?'FAIL':'PASS',cases:cases.length,invocations:invocations.length,evidence})+'\n');}
