// One finite sensitivity run: exact real product, minimal parent observation.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {root,evidence,baseline,json,read,record,check,write,str,hash} from './common.mjs';
import {createSupervisor} from '../../../memoryos-readiness/src/runtime.mjs';
import {helperLaunchSpecification,createHelperTransportForTesting} from '../../../memoryos-readiness/src/helper-transport.mjs';
import {decodeHelperRequest,decodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';
assert.equal(str('rev-parse','HEAD'),baseline);assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const plan=json(evidence+'/sample-plan.json');assert.equal(plan.order.length,25);for(const p of plan.sourceBindings)check(p);for(const c of plan.cases){check(c.request);for(const p of c.members)check(p);if(c.manifest)check(c.manifest);if(c.id==='E')assert.equal(fs.existsSync(c.root),false);}
const spec=helperLaunchSpecification(),rows=[],launches=[],started=performance.now(),startedAtUtc=new Date().toISOString();let result='COMPLETE',stopReason=null;
const context=()=>({utc:new Date().toISOString(),freeMemoryBytes:os.freemem(),totalMemoryBytes:os.totalmem(),cpuTimes:os.cpus().map(c=>c.times),nodeMemory:process.memoryUsage(),processCount:'NOT_OBSERVABLE',nativeHelperCpu:'NOT_OBSERVABLE',nativeConsoleIdentity:'NOT_OBSERVABLE'});
write(evidence+'/campaign-start.json',{kind:'MO1307HelperDeadlineDesignCampaignStart',baseline,startedAtUtc,plan:record(evidence+'/sample-plan.json'),launch:spec,nodeRuntime:record(process.execPath),powershellRuntime:record(spec.executable),sourceBindings:plan.sourceBindings,additionalObserverProcesses:0});
try{for(const row of plan.order){
 if(Date.now()>=Date.parse('2026-09-29T18:50:42Z')){result='STOPPED';stopReason='TASK_HARD_STOP_RESERVE';break;}
 if(performance.now()-started>300000){result='STOPPED';stopReason='PREDECLARED_CAMPAIGN_GUARD';break;}
 const c=plan.cases.find(c=>c.id===row.case),dir=evidence+'/samples/'+row.sampleId,frame=read(c.request.path),request=decodeHelperRequest(frame),beforeContext=context();
 let entered=null,returned=null,spawnEvent=null,stdinFinish=null,firstByte=null,exited=null,closed=null,pid=null,stderrBytes=0,spawnCount=0,answer=null,error=null,settled=null;const chunks=[],pipes={stdin:false,stdout:false,stderr:false};
 const before=performance.now(),supervisor=createSupervisor({kind:'cli'});
 const forward=(exe,args,options)=>{assert.equal(exe,spec.executable);assert.deepEqual(args,[...spec.args]);assert.deepEqual(options,{...spec.options,env:{...spec.options.env},stdio:[...spec.options.stdio]});assert.equal(++spawnCount,1);assert.ok(launches.length<25);
  entered=performance.now();const launch={sampleId:row.sampleId,at:entered,pid:null};launches.push(launch);const child=spawn(exe,args,options);returned=performance.now();pid=child.pid;launch.pid=pid??null;
  child.once('spawn',()=>{spawnEvent=performance.now();});child.stdin.once('finish',()=>{stdinFinish=performance.now();});
  child.stdout.on('data',b=>{firstByte??=performance.now();chunks.push(b);});child.stderr.on('data',b=>{stderrBytes+=b.length;});
  child.once('exit',(code,signal)=>{exited={at:performance.now(),code,signal};});child.once('close',(code,signal)=>{closed={at:performance.now(),code,signal};});for(const key of Object.keys(pipes))child[key].once('close',()=>{pipes[key]=true;});
  return child;};
 const transport=createHelperTransportForTesting(supervisor,forward),exchangeBegin=performance.now();
 try{answer=await transport.exchange(frame);settled=performance.now();}catch(e){settled=performance.now();error={code:e.code??null,stage:e.stage??null,message:e.message};}
 await supervisor.dispose();const snapshot=supervisor.snapshot(),afterContext=context(),raw=Buffer.concat(chunks);let validation='NO_SUCCESS_CLAIM',responseStatus=null;
 fs.writeFileSync(path.join(root,dir,'request.bin'),frame,{flag:'wx'});fs.writeFileSync(path.join(root,dir,'response.bin'),raw,{flag:'wx'});
 try{if(answer){assert.equal(answer.exitConfirmed,true);assert.deepEqual(answer.responseBytes,raw);const response=decodeHelperResponse(raw,request);responseStatus=response.status;assert.equal(response.status,c.id==='C'?'OK':'ABSENT');for(const file of response.files){const input=request.files.find(f=>f.id===file.id);assert.deepEqual(Buffer.from(file.bytes.join(''),'base64'),fs.readFileSync(path.join(c.root,...input.path.split('/'))));}validation='EXACT_PROTOCOL_AND_INPUT_BYTES';}}catch(e){validation='FAIL';error??={code:'ENGINEERING_RESPONSE_VALIDATION',message:e.message};}
 const start=snapshot.events.find(e=>e.type==='start'&&e.role==='helper');assert.ok(start);const origin=start.deadline-5000;assert.ok(origin>=before&&origin<=entered);const sampleResult=error?.code==='MO1307_TIMEOUT'?'TIMEOUT':error?'ERROR':'SUCCESS';
 const receipt={kind:'MO1307HelperDeadlineDesignSample',version:'1.0.0',...row,result:sampleResult,error,request:record(dir+'/request.bin'),response:record(dir+'/response.bin'),pid,spawnCount,stderrBytes,pipes,validation,responseStatus,requestFrameBytes:frame.length,responseFrameBytes:raw.length,fileCount:c.fileCount,aggregateBytes:c.aggregateBytes,
  beforeContext,afterContext,nodeTimeOriginUnixMs:performance.timeOrigin,times:{originStatus:'DERIVED_FROM_REAL_DEADLINE_MINUS5000',origin,supervisorStartEvent:start.at,spawnEntered:entered,spawnReturned:returned,spawnEvent,stdinFinish,firstByte,exited,closed,exchangeBegin,transportSettled:settled,T3:'NOT_OBSERVABLE',T8:'NOT_OBSERVABLE_EXTERNALLY'},
  durations:{supervisorHelperActiveMs:sampleResult==='SUCCESS'?snapshot.helperUsedMs:null,supervisorTerminalMs:snapshot.terminalAt===null?null:snapshot.terminalAt-origin,wholeSettlementMs:settled-origin,transportExchangeMs:settled-exchangeBegin,spawnReturnMs:returned-entered,firstByteMs:firstByte===null?null:firstByte-origin,processExitMs:exited?exited.at-origin:null,wholeMarginMs:5000-(settled-origin),terminalOverrunMs:snapshot.terminalAt===null?null:snapshot.terminalAt-start.deadline},
  snapshot,cleanupConfirmed:snapshot.cleanupConfirmed,successfulCompletionCensored:sampleResult==='TIMEOUT',additionalObserverProcesses:0,periodicQueries:0,helperCopy:false,clockOverrides:false,privateSequenceExecuted:false,certification:false};
 write(dir+'/receipt.json',receipt);rows.push({sampleId:row.sampleId,case:row.case,result:sampleResult,receipt:record(dir+'/receipt.json')});console.log(JSON.stringify({sampleId:row.sampleId,result:sampleResult,activeMs:receipt.durations.supervisorHelperActiveMs,wholeMs:receipt.durations.wholeSettlementMs,cleanup:snapshot.cleanupConfirmed}));
 if(validation==='FAIL'||(error&&error.code!=='MO1307_TIMEOUT')){result='STOPPED';stopReason='UNEXPECTED_ERROR';break;}
 if(snapshot.terminalAt!==null&&snapshot.terminalAt<start.deadline){result='STOPPED';stopReason='PREMATURE_TERMINAL';break;}
 if(!snapshot.cleanupConfirmed){result='STOPPED';stopReason='UNCONFIRMED_PRODUCT_CLEANUP_MINIMAL_OBSERVER_CANNOT_UPGRADE';break;}
}}
catch(e){result='STOPPED';stopReason={message:e.message,stack:e.stack};}
let sourceIntegrityUnchanged=true;for(const p of plan.sourceBindings){try{check(p);}catch{sourceIntegrityUnchanged=false;}}for(const c of plan.cases){try{check(c.request);for(const p of c.members)check(p);}catch{sourceIntegrityUnchanged=false;}}
write(evidence+'/campaign.json',{kind:'MO1307HelperDeadlineDesignCampaign',version:'1.0.0',baseline,result,stopReason,startedAtUtc,endedAtUtc:new Date().toISOString(),elapsedMs:performance.now()-started,plan:record(evidence+'/sample-plan.json'),samples:rows,launches,actualHelperExecutions:launches.length,completedSampleReceipts:rows.length,maximum:25,retries:0,additionalObserverProcesses:0,periodicQueries:0,sourceIntegrityUnchanged,certification:false});
assert.ok(sourceIntegrityUnchanged);process.exitCode=result==='COMPLETE'||stopReason==='UNCONFIRMED_PRODUCT_CLEANUP_MINIMAL_OBSERVER_CANNOT_UPGRADE'?0:1;
