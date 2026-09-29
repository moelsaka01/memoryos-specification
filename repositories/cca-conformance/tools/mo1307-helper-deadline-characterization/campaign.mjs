// External lifecycle observation of exact production bytes; one fixed plan only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {root,evidence,baseline,hash,record,check,json,write,str} from './common.mjs';
import {createSupervisor} from '../../../memoryos-readiness/src/runtime.mjs';
import {createHelperTransportForTesting,helperLaunchSpecification} from '../../../memoryos-readiness/src/helper-transport.mjs';
import {decodeHelperRequest,decodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(str('rev-parse','HEAD'),baseline);
const plan=json(evidence+'/sample-plan.json');assert.equal(plan.plannedProductionHelperExecutions,25);assert.equal(plan.order.length,25);for(const m of plan.sourceBindings)check(m);
for(const c of plan.cases){check(c.request);for(const m of c.members)check(m);if(c.manifest)check(c.manifest);}
const output=path.join(root,evidence),observerRoot=path.join(output,'observer');assert.equal(fs.existsSync(observerRoot),false);fs.mkdirSync(observerRoot);
const control=path.join(observerRoot,'control.json'),python='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const publish=(phase,sampleId=null,pid=null)=>fs.writeFileSync(control,JSON.stringify({version:1,phase,sampleId,pid}));
publish('prepare',plan.order[0].sampleId,null);
const observer=spawn(python,['-I','-B',path.join(root,'repositories/cca-conformance/tools/mo1307-helper-deadline-characterization/observer.py'),'--control',control,'--output',observerRoot],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
const observerOut=[],observerErr=[];let observerExit=null;observer.stdout.on('data',b=>observerOut.push(b));observer.stderr.on('data',b=>observerErr.push(b));observer.once('exit',(code,signal)=>{observerExit={code,signal};});
let observerClosed=false;const observerClose=new Promise(resolve=>observer.once('close',()=>{observerClosed=true;resolve();}));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function readWhenReady(file,ms=10000){const until=performance.now()+ms;while(performance.now()<until){if(fs.existsSync(file)){try{return JSON.parse(fs.readFileSync(file));}catch{}}if(observerExit)throw Error('Observer exited before '+file+': '+JSON.stringify(observerExit));await pause(20);}throw Error('Observer handshake timeout '+file);}
const spec=helperLaunchSpecification(),rows=[],launches=[];let campaignResult='COMPLETE',stopReason=null;const campaignStart=new Date().toISOString(),at=performance.now();
write(evidence+'/campaign-start.json',{kind:'MO1307HelperDeadlineCampaignStart',startedAtUtc:campaignStart,plan:record(evidence+'/sample-plan.json'),sourceBindings:plan.sourceBindings,actualLaunch:spec,observerPid:observer.pid,observerRuntime:record(python),retries:0});
try{
 await readWhenReady(path.join(observerRoot,'ready.json'));
 for(const row of plan.order){
  if(observerExit)throw Error('Observer unavailable');const c=plan.cases.find(c=>c.id===row.case),dir=evidence+'/samples/'+row.sampleId;
  publish('prepare',row.sampleId,null);const context=await readWhenReady(path.join(observerRoot,'ack-'+row.sampleId+'.json'));
  const frame=fs.readFileSync(path.join(root,c.request.path)),request=decodeHelperRequest(frame),events=[],chunks=[];let total=0,expected=null,first=null,complete=null,pid=null,processExit=null,processClose=null,stdinFinish=null,spawnReturned=null,spawnEvent=null,spawnEntered=null;
  const pipes={stdin:false,stdout:false,stderr:false};let stderrBytes=0,spawnCount=0,answer=null,error=null,settled=null,responseStatus=null,activeControlError=null,activeControlWriteMs=null;
  const before=performance.now(),wall=new Date().toISOString(),supervisor=createSupervisor({kind:'cli'});
  const forwardingSpawn=(exe,args,options)=>{
   assert.equal(exe,spec.executable);assert.deepEqual(args,[...spec.args]);assert.deepEqual(options,{...spec.options,env:{...spec.options.env},stdio:[...spec.options.stdio]});assert.equal(++spawnCount,1);
   assert.ok(launches.length<25);spawnEntered=performance.now();const launchRecord={sampleId:row.sampleId,at:spawnEntered,pid:null};launches.push(launchRecord);
   const child=spawn(exe,args,options);spawnReturned=performance.now();pid=child.pid;launchRecord.pid=pid??null;
   child.once('spawn',()=>{spawnEvent=performance.now();});child.stdin.once('finish',()=>{stdinFinish=performance.now();});
   child.stdout.on('data',b=>{const now=performance.now();first??=now;chunks.push(b);total+=b.length;if(expected===null&&total>=4){let prefix=Buffer.allocUnsafe(4),used=0;for(const part of chunks){const n=Math.min(4-used,part.length);part.copy(prefix,used,0,n);used+=n;if(used===4)break;}expected=prefix.readUInt32BE(0)+4;}if(expected!==null&&total>=expected&&complete===null)complete=now;});
   child.stderr.on('data',b=>{stderrBytes+=b.length;});for(const key of Object.keys(pipes))child[key].once('close',()=>{pipes[key]=true;events.push({type:key+'-close',at:performance.now()});});
   child.once('exit',(code,signal)=>{processExit={at:performance.now(),code,signal};});child.once('close',(code,signal)=>{processClose={at:performance.now(),code,signal};});
   const controlAt=performance.now();try{publish('active',row.sampleId,pid);}catch(e){activeControlError={message:e.message};}activeControlWriteMs=performance.now()-controlAt;
   // Observation failure cannot prevent ownership of the real spawned child.
   return child;
  };
  const transport=createHelperTransportForTesting(supervisor,forwardingSpawn),exchangeBegin=performance.now();
  try{answer=await transport.exchange(frame);settled=performance.now();}catch(e){settled=performance.now();error={code:e.code??null,stage:e.stage??null,message:e.message};}
  await supervisor.dispose();const snapshot=supervisor.snapshot();let processAck=null,observationError=activeControlError;
  try{publish('settled',row.sampleId,pid);}catch(e){observationError??={message:e.message};}
  try{processAck=await readWhenReady(path.join(observerRoot,'ack-settled-'+row.sampleId+'.json'),5000);}catch(e){observationError={message:e.message};}
  const raw=Buffer.concat(chunks,total);fs.writeFileSync(path.join(root,dir,'request.bin'),frame,{flag:'wx'});fs.writeFileSync(path.join(root,dir,'response.bin'),raw,{flag:'wx'});
  let validation=null;
  try{if(answer){assert.equal(answer.exitConfirmed,true);assert.deepEqual(answer.responseBytes,raw);const response=decodeHelperResponse(raw,request);responseStatus=response.status;assert.equal(response.status,c.operation==='READ_SET'?'OK':'ABSENT');
    for(const f of response.files){const d=request.files.find(x=>x.id===f.id);assert.deepEqual(Buffer.from(f.bytes.join(''),'base64'),fs.readFileSync(path.join(request.roots[0].path,...d.path.split('/'))));}
    validation='EXACT_PROTOCOL_AND_INPUT_BYTES';}else validation='NO_SUCCESS_CLAIM';
  }catch(e){validation='FAIL';error??={code:'ENGINEERING_RESPONSE_VALIDATION',message:e.message};}
  const start=snapshot.events.find(e=>e.type==='start'&&e.role==='helper');assert.ok(start);const clockOrigin=start.deadline-5000;
  assert.ok(clockOrigin>=before&&clockOrigin<=spawnEntered);const whole=settled-clockOrigin;
  const times={T0:{status:'DERIVED',at:clockOrigin,basis:'Real supervisor effective per-helper deadline minus unchanged5000ms; min-limits checked.'},supervisorStartEvent:start.at,
   spawnCallEntered:spawnEntered,T1:spawnReturned,T2:{status:spawnEvent===null?'NOT_OBSERVABLE':'OS_SPAWN_NOTIFICATION',at:spawnEvent,note:'Child successfully spawned; not proof of PowerShell/helper readiness.'},T3:{status:'NOT_OBSERVABLE'},T4:stdinFinish,T5:first,T6:complete,T7:processExit,T8:{status:'SEE_EXTERNAL_PROCESS_OBSERVATIONS',note:'Native retained-handle exit when observed; valid frame provides source-backed prior-quiescence inference only.'},transportSettled:settled,childClose:processClose};
  const durations={processCreationReturnMs:spawnReturned-spawnEntered,clockOriginToSpawnReturnMs:spawnReturned-clockOrigin,bootstrapMs:null,
   requestToFirstByteMs:first!==null&&stdinFinish!==null?first-stdinFinish:null,requestToCompleteFrameMs:complete!==null&&stdinFinish!==null?complete-stdinFinish:null,
   responseToExitMs:complete!==null&&processExit?processExit.at-complete:null,launchToFirstByteMs:first!==null?first-clockOrigin:null,
   launchToCompleteFrameMs:complete!==null?complete-clockOrigin:null,launchToProcessExitMs:processExit?processExit.at-clockOrigin:null,
   launchToTransportSettlementMs:whole,transportExchangeMs:settled-exchangeBegin,deadlineMarginMs:5000-whole,terminalOverrunMs:snapshot.terminalAt===null?null:snapshot.terminalAt-start.deadline};
  const result=error?.code==='MO1307_TIMEOUT'?'TIMEOUT':error?'ERROR':'SUCCESS';
  const receipt={kind:'MO1307HelperDeadlineSample',version:'1.0.0',sampleId:row.sampleId,case:row.case,round:row.round,result,error,wallClockUtc:wall,nodeTimeOriginUnixMs:performance.timeOrigin,
   request:record(dir+'/request.bin'),response:record(dir+'/response.bin'),operation:c.operation,fileCount:c.fileCount,aggregateBytes:c.aggregateBytes,requestFrameBytes:frame.length,responseFrameBytes:raw.length,
   advertisedFrameBytes:expected,completeFrameObserved:complete!==null&&raw.length===expected,responseStatus,validation,pid,spawnCount,stderrBytes,times,durations,pipes,snapshot,
   processObservation:fs.existsSync(path.join(observerRoot,'samples',row.sampleId,'process-observations.json'))?record(path.relative(root,path.join(observerRoot,'samples',row.sampleId,'process-observations.json')).replaceAll('\\','/')):null,processAck,context,observationError,activeControlWriteMs,
   cleanupConfirmed:snapshot.cleanupConfirmed,productSource:plan.sourceBindings.find(p=>p.path.endsWith('/helpers/windows-inspect.ps1')),scope:'EXTERNAL_OBSERVATION_OF_EXACT_PRODUCT_HELPER_WITH_REAL_SUPERVISOR',privateSequenceExecuted:false,certification:false};
  write(dir+'/receipt.json',receipt);rows.push({sampleId:row.sampleId,case:row.case,result,receipt:record(dir+'/receipt.json')});console.log(JSON.stringify({sampleId:row.sampleId,result,wholeMs:whole,marginMs:5000-whole,cleanup:snapshot.cleanupConfirmed}));
  if(validation==='FAIL'||(error&&error.code!=='MO1307_TIMEOUT')){campaignResult='STOPPED';stopReason='Unexpected product/protocol/engineering error: '+JSON.stringify(error);break;}
  if(snapshot.terminalAt!==null&&snapshot.terminalAt<start.deadline){campaignResult='STOPPED';stopReason='Premature supervisor terminal relative to own per-helper deadline';break;}
  if(observationError){campaignResult='STOPPED';stopReason=observationError;break;}
  if(processAck?.requiredCleanupViolation===true){campaignResult='STOPPED';stopReason='Externally established owned survivor after bounded cleanup';break;}
 }
}catch(error){campaignResult='STOPPED';stopReason={message:error.message,stack:error.stack};}
finally{try{publish('done');}catch(e){campaignResult='STOPPED';stopReason??={message:e.message};}await Promise.race([observerClose,pause(5000)]);
 if(!observerClosed){observer.kill();await Promise.race([observerClose,pause(2000)]);campaignResult='STOPPED';stopReason??='Engineering observer did not close; terminated observer only.';}}
fs.writeFileSync(path.join(observerRoot,'stdout.txt'),Buffer.concat(observerOut),{flag:'wx'});fs.writeFileSync(path.join(observerRoot,'stderr.txt'),Buffer.concat(observerErr),{flag:'wx'});
let integrity=true;for(const m of plan.sourceBindings){try{check(m);}catch{integrity=false;}}for(const c of plan.cases)for(const m of c.members){try{check(m);}catch{integrity=false;}}
write(evidence+'/campaign.json',{kind:'MO1307HelperDeadlineCampaign',version:'1.0.0',result:campaignResult,stopReason,startedAtUtc:campaignStart,endedAtUtc:new Date().toISOString(),elapsedMs:performance.now()-at,
 plan:record(evidence+'/sample-plan.json'),samples:rows,launches,actualHelperExecutions:launches.length,completedSampleReceipts:rows.length,maximum:25,retries:0,sourceIntegrityUnchanged:integrity,observerExit,observerClosed,
 observerStdout:record(path.relative(root,path.join(observerRoot,'stdout.txt')).replaceAll('\\','/')),observerStderr:record(path.relative(root,path.join(observerRoot,'stderr.txt')).replaceAll('\\','/')),certification:false});
assert.ok(integrity);assert.ok(observerClosed);assert.equal(observerExit?.code,0);process.exitCode=campaignResult==='COMPLETE'?0:1;
