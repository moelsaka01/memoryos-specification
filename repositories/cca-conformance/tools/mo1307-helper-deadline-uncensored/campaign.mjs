// Authorized finite ENGINEERING observation. No production deadline is changed.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {root,evidence,baseline,read,json,record,check,write,str,hash} from './common.mjs';
import {createEngineeringSupervisor,PRODUCT_MS,GUARD_MS} from './engineering-supervisor.mjs';
import {helperLaunchSpecification,createHelperTransportForTesting} from '../../../memoryos-readiness/src/helper-transport.mjs';
import {decodeHelperRequest,decodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';
const toolRoot='repositories/cca-conformance/tools/mo1307-helper-deadline-uncensored';
assert.equal(str('rev-parse','HEAD'),baseline);assert.equal(process.version,'v24.21.0');
assert.equal(hash(read(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const plan=json(evidence+'/sample-plan.json');assert.equal(plan.order.length,70);
for(const pin of plan.sourceBindings)check(pin);
for(const c of plan.cases){check(c.request);for(const pin of c.members)check(pin);if(c.manifest)check(c.manifest);if(c.id==='E')assert.equal(fs.existsSync(c.root),false);}
const started=performance.now(),startedAtUtc=new Date().toISOString(),spec=helperLaunchSpecification();
const observerExe='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const observerArgs=['-B',toolRoot+'/native-observer.py','--output',path.join(root,evidence,'observer')];
const observer=spawn(observerExe,observerArgs,{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});
const rpcPending=[],rpcTranscript=[],observerErrors=[];let lineBuffer='',activeSupervisor=null,observerFault=null;
let readyResolve,readyReject;
const readyPromise=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
const failObserver=message=>{observerFault??={code:'ENGINEERING_OBSERVER_DEFECT',message};const error=new Error(message);error.code=observerFault.code;activeSupervisor?.abort(error);};
observer.stdout.on('data',chunk=>{
  lineBuffer+=chunk.toString('utf8');if(lineBuffer.length>2*1024*1024){failObserver('Observer output bound exceeded');return;}
  for(let end;(end=lineBuffer.indexOf('\n'))>=0;){const line=lineBuffer.slice(0,end);lineBuffer=lineBuffer.slice(end+1);if(!line.trim())continue;
    try{const value=JSON.parse(line);rpcTranscript.push({at:performance.now(),value});
      if(value.event==='ready'){readyResolve(value);continue;}
      if(value.event==='stop'){failObserver(JSON.stringify(value));continue;}
      const index=rpcPending.findIndex(p=>p.command===value.command&&p.sampleId===(value.sampleId??null));
      if(index<0){failObserver('Unmatched observer acknowledgment');continue;}
      const p=rpcPending.splice(index,1)[0];clearTimeout(p.timer);
      if(value.result!=='OK'){p.reject(new Error(JSON.stringify(value)));failObserver('Observer RPC failed');}else p.resolve(value);
    }catch(error){failObserver(error.message);}
  }
});
observer.stderr.on('data',chunk=>{observerErrors.push(chunk);if(observerErrors.reduce((n,b)=>n+b.length,0)>65536)failObserver('Observer stderr bound exceeded');});
let observerExit=null,normalDoneRequested=false;
const observerClosed=new Promise(resolve=>observer.once('close',(code,signal)=>{observerExit={code,signal,at:performance.now()};if(!normalDoneRequested)failObserver('Observer exited before normal done');resolve(observerExit);for(const p of rpcPending.splice(0)){clearTimeout(p.timer);p.reject(new Error('Observer closed'));}if(!readySeen)readyReject(new Error('Observer closed before ready'));}));
observer.once('error',error=>{readyReject(error);failObserver(error.message);});
let readySeen=false;
function rpc(command,detail={},timeout=25000){
  return new Promise((resolve,reject)=>{const p={command,sampleId:detail.sampleId??null,resolve,reject,timer:null};
    p.timer=setTimeout(()=>{const i=rpcPending.indexOf(p);if(i>=0)rpcPending.splice(i,1);reject(new Error('Observer RPC timeout: '+command));failObserver('Observer RPC timeout');},timeout);
    rpcPending.push(p);observer.stdin.write(JSON.stringify({command,...detail})+'\n');
  });
}
const context=()=>({utc:new Date().toISOString(),availableMemoryBytes:os.freemem(),totalMemoryBytes:os.totalmem(),cpuTimes:os.cpus().map(c=>c.times),nodeMemory:process.memoryUsage()});
const rows=[],launches=[];let campaignResult='COMPLETE',stopReason=null,ready=null,done=null;
try {
  let readyTimer;
  try{ready=await Promise.race([readyPromise,new Promise((_,reject)=>{readyTimer=setTimeout(()=>reject(new Error('Observer ready deadline')),10000);})]);readySeen=true;}finally{clearTimeout(readyTimer);}
  write(evidence+'/campaign-start.json',{kind:'MO1307UncensoredCampaignStart',baseline,startedAtUtc,plan:record(evidence+'/sample-plan.json'),launch:spec,observer:{executable:record(observerExe),args:observerArgs,ready},node:record(process.execPath),productionDeadlineMs:PRODUCT_MS,engineeringGuardMs:GUARD_MS});
  for(const row of plan.order){
    if(Date.now()>=Date.parse(plan.absoluteLastLaunchUtc)||performance.now()-started>=plan.campaignGuardMs){campaignResult='STOPPED';stopReason='PREDECLARED_TIME_BUDGET';break;}
    if(observerFault){campaignResult='STOPPED';stopReason=observerFault;break;}
    const c=plan.cases.find(c=>c.id===row.case),dir=evidence+'/samples/'+row.sampleId;
    check(c.request);for(const pin of c.members)check(pin);if(c.id==='E')assert.equal(fs.existsSync(c.root),false);
    const frame=read(c.request.path),request=decodeHelperRequest(frame),beforeContext=context();
    if(beforeContext.availableMemoryBytes<256*1024*1024){campaignResult='STOPPED';stopReason='HOST_STABILITY_LOW_AVAILABLE_MEMORY';break;}
    const prepared=await rpc('prepare',{sampleId:row.sampleId});
    const supervisor=createEngineeringSupervisor();activeSupervisor=supervisor;
    let entered=null,returned=null,spawnAt=null,stdinFinish=null,firstByte=null,exited=null,closed=null,pid=null;
    let stderrBytes=0,spawnCount=0,answer=null,error=null,transportSettled=null,activePromise=null,activeAck=null,ipcWriteMs=null;
    const chunks=[],pipes={stdin:false,stdout:false,stderr:false};
    const sampleStartUtc=new Date().toISOString(),exchangeBegin=performance.now();
    const forward=(exe,args,options)=>{
      assert.equal(exe,spec.executable);assert.deepEqual(args,[...spec.args]);assert.deepEqual(options,{...spec.options,env:{...spec.options.env},stdio:[...spec.options.stdio]});
      assert.equal(++spawnCount,1);assert.ok(launches.length<70);entered=performance.now();
      const launch={sampleId:row.sampleId,case:row.case,entered,pid:null};launches.push(launch);
      const child=spawn(exe,args,options);returned=performance.now();pid=child.pid;launch.pid=pid??null;
      child.once('spawn',()=>{spawnAt=performance.now();});child.stdin.once('finish',()=>{stdinFinish=performance.now();});
      child.stdout.on('data',b=>{firstByte??=performance.now();chunks.push(b);});child.stderr.on('data',b=>{stderrBytes+=b.length;});
      child.once('exit',(code,signal)=>{exited={at:performance.now(),code,signal};});child.once('close',(code,signal)=>{closed={at:performance.now(),code,signal};});
      for(const key of Object.keys(pipes))child[key].once('close',()=>{pipes[key]=true;});
      const controlStart=performance.now();activePromise=rpc('active',{sampleId:row.sampleId,pid},2000);activePromise.catch(()=>{});ipcWriteMs=performance.now()-controlStart;
      return child;
    };
    try{answer=await createHelperTransportForTesting(supervisor,forward).exchange(frame);transportSettled=performance.now();}
    catch(e){transportSettled=performance.now();error={code:e.code??'ENGINEERING_ERROR',stage:e.stage??null,message:e.message};}
    const snapshot=supervisor.snapshot();activeSupervisor=null;
    if(activePromise)try{activeAck=await activePromise;}catch(e){error??={code:'ENGINEERING_OBSERVER_DEFECT',message:e.message};}
    let nativeRecord=null,nativeSummary=null;
    try {
      const nativeAck=await rpc('settled',{sampleId:row.sampleId},2000);
      const nativePath=path.relative(root,nativeAck.path??nativeAck.receipt.path).replaceAll('\\','/');
      assert.ok(nativePath.startsWith(evidence+'/observer/'));
      nativeRecord=record(nativePath);nativeSummary=nativeAck.summary;
    } catch(e) {error??={code:'ENGINEERING_OBSERVER_DEFECT',message:'Native settlement receipt unavailable'};}
    const afterContext=context(),raw=Buffer.concat(chunks),validation={protocol:false,exactInputBytes:false,responseStatus:null,files:[]};
    try{if(answer){assert.equal(answer.exitConfirmed,true);assert.ok(answer.responseBytes.equals(raw),'RESPONSE_BUFFER_MISMATCH');
      const response=decodeHelperResponse(raw,request);assert.equal(response.status,c.id==='C'?'OK':'ABSENT');validation.protocol=true;validation.responseStatus=response.status;
      assert.equal(response.files.length,request.files.length);
      for(const file of response.files){const desc=request.files.find(f=>f.id===file.id),bytes=Buffer.from(file.bytes.join(''),'base64');const inputPath=path.join(c.root,...desc.path.split('/'));const input=read(inputPath);assert.ok(bytes.equals(input),'INPUT_BYTES_MISMATCH');validation.files.push({id:file.id,byteLength:bytes.length,sha256:hash(bytes),input:record(inputPath,input),identity:file.identity});}
      validation.exactInputBytes=true;validation.roots=response.roots;
    }}catch(e){error??={code:'PROTOCOL_OR_SEMANTIC_MISMATCH',message:'Response protocol, identity, status or exact input-byte validation failed'};}
    assert.ok(snapshot.origin!==null&&snapshot.origin<=entered&&snapshot.origin>=exchangeBegin);
    const wholeLifecycleMs=snapshot.completedAt===null?null:snapshot.completedAt-snapshot.origin;
    const nativeProof=nativeSummary?.helperCount===1&&nativeSummary?.consoleCount===1&&nativeSummary?.allSignaled===true&&nativeSummary?.externalConsoleExitProof===true&&(nativeSummary?.identityFailureCount??0)===0&&(nativeSummary?.unexpectedChildren?.length??0)===0;
    if(!nativeProof)error??={code:'UNCONFIRMED_ENGINEERING_CLEANUP',message:'Positive retained helper/console proof or expected topology unavailable'};
    if(observerFault)error??=observerFault;
    const qualifying=!error&&answer&&validation.protocol&&validation.exactInputBytes&&snapshot.transportCleanupConfirmed&&nativeProof&&wholeLifecycleMs<=GUARD_MS;
    const result=qualifying?'QUALIFYING_COMPLETION':error?.code??'CHARACTERIZATION_DEFECT';
    const classification=qualifying?(wholeLifecycleMs<=PRODUCT_MS?'WITHIN_PRODUCT_BOUND':'SUCCESSFUL_COMPLETION_BEYOND_PRODUCT_BOUND'):(snapshot.terminalCode==='ENGINEERING_GUARD_EXCEEDED'?'ENGINEERING_GUARD_EXCEEDED':'CHARACTERIZATION_DEFECT');
    const receipt={kind:'MO1307UncensoredSample',version:'1.0.0',...row,result,classification,
      productClassification:qualifying?(wholeLifecycleMs<=PRODUCT_MS?'WITHIN_PRODUCT_BOUND':'PRODUCT_DEADLINE_EXCEEDED'):'NO_SUCCESS_CLASSIFICATION',
      engineeringGuardClassification:qualifying?'SUCCESSFUL_COMPLETION_WITHIN_ENGINEERING_GUARD':classification,
      productCounterfactual:qualifying&&wholeLifecycleMs>PRODUCT_MS?'The unchanged production supervisor would have returned TIMEOUT before this completion; this is a counterfactual timing classification, not a production execution result.':null,
      utcStart:sampleStartUtc,utcEnd:new Date().toISOString(),wholeLifecycleMs,transportSettlementMs:transportSettled-snapshot.origin,error,
      request:c.request,response:{byteLength:raw.length,sha256:hash(raw)},validation,inputIdentity:'EXACT_RETAINED_ROOTS_DESCRIPTORS_ORDER_HASHES',
      nativeObserver:nativeRecord,nativeSummary,prepared,activeAck,snapshot,pid,spawnCount,stderrBytes,pipes,
      nodeTimeOriginUnixMs:performance.timeOrigin,times:{exchangeBegin,origin:snapshot.origin,spawnEntered:entered,spawnReturned:returned,spawnEvent:spawnAt,stdinFinish,firstByte,exited,closed,transportSettled},
      beforeContext,afterContext,observerControlWriteMs:ipcWriteMs,transportNativeConsoleProof:snapshot.transportCleanupConfirmed,
      engineeringCleanupConfirmed:nativeProof&&snapshot.transportCleanupConfirmed,completeDescendantCoverageEstablished:false,helperCopy:false,productionChanges:false,productExecutionResult:false,certification:false,fileContentsLogged:false};
    write(dir+'/receipt.json',receipt);rows.push({sampleId:row.sampleId,case:row.case,result,classification,receipt:record(dir+'/receipt.json')});
    console.log(JSON.stringify({sampleId:row.sampleId,classification,wholeLifecycleMs,responseBytes:raw.length,nativeProof}));
    if(!qualifying){campaignResult='STOPPED';stopReason=classification==='ENGINEERING_GUARD_EXCEEDED'?'ENGINEERING_GUARD_EXCEEDED':error??'CHARACTERIZATION_DEFECT';break;}
  }
}catch(error){campaignResult='STOPPED';stopReason={code:error.code??'CHARACTERIZATION_DEFECT',message:error.message,stack:error.stack};}
finally{
  activeSupervisor=null;
  if(observerExit===null){try{normalDoneRequested=true;done=await rpc('done',{},5000);}catch(error){campaignResult='STOPPED';stopReason??={code:'OBSERVER_DISPOSITION_DEFECT',message:error.message};}observer.stdin.end();}
  let observerCloseTimer;
  try{await Promise.race([observerClosed,new Promise(resolve=>{observerCloseTimer=setTimeout(()=>{observer.kill();resolve();},2000);})]);}finally{clearTimeout(observerCloseTimer);}
}
let sourceIntegrityUnchanged=true;
if(observerExit?.code!==0||observerExit?.signal!==null){campaignResult='STOPPED';stopReason??={code:'OBSERVER_DISPOSITION_DEFECT',message:'Observer did not close normally with exit0'};}
for(const pin of plan.sourceBindings){try{check(pin);}catch{sourceIntegrityUnchanged=false;}}
for(const c of plan.cases){try{check(c.request);for(const pin of c.members)check(pin);}catch{sourceIntegrityUnchanged=false;}}
if(!sourceIntegrityUnchanged){campaignResult='STOPPED';stopReason='INPUT_OR_SOURCE_INTEGRITY_MISMATCH';}
write(evidence+'/observer-rpc.json',{kind:'MO1307UncensoredObserverRpc',transcript:rpcTranscript,stderr:Buffer.concat(observerErrors).toString('utf8'),exit:observerExit,done,fileContentsLogged:false});
write(evidence+'/campaign.json',{kind:'MO1307UncensoredCampaign',version:'1.0.0',baseline,result:campaignResult,stopReason,startedAtUtc,endedAtUtc:new Date().toISOString(),elapsedMs:performance.now()-started,
 plan:record(evidence+'/sample-plan.json'),samples:rows,launches,actualHelperExecutions:launches.length,completedSampleReceipts:rows.length,maximum:70,retries:0,replacements:0,discardedSamples:0,adaptiveExpansion:false,sourceIntegrityUnchanged,
 observerRpc:record(evidence+'/observer-rpc.json'),productionChanges:false,productionDeadlineChanged:false,certification:false,fileContentsLogged:false});
console.log(JSON.stringify({result:campaignResult,stopReason,executions:launches.length,receipts:rows.length}));
process.exitCode=campaignResult==='COMPLETE'?0:1;
