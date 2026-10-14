// Sole native-helper launcher for this sealed characterization generation.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {Writable} from 'node:stream';
import {
  root,evidence,read,json,record,check,writeJson,writeBytes,hash,assertAuthority,
  ns,nsText,ms,captureHost,capturePathState,checkTree,responseIdentityCore,
} from './common.mjs';
import {createEngineeringSupervisor,DERIVATION_GUARD_NS} from './engineering-supervisor.mjs';
import {createHelperTransportForTesting,helperLaunchSpecification} from '../../../memoryos-readiness/src/helper-transport.mjs';
import {decodeHelperRequest,decodeHelperResponse,encodeHelperRequest} from '../../../memoryos-readiness/src/helper-protocol.mjs';
import {createProspectiveSupervisor} from './prospective-runtime.mjs';
import {orchestrateProspectiveCli} from './prospective-cli.mjs';
import {verifyFixtureLedger,assertExpectedResponse} from './fixtures.mjs';

const errorRecord=error=>({code:error?.code??error?.name??'ERROR',stage:error?.stage??null,reference:error?.reference??null,message:error?.message??String(error)});
const expectedSealHash=process.argv[2];
let seal,anchor,fixtureManifest,fixtureLedger,plan,sequencePlan,environment,byClass,spec,startedAtUtc;
try{
  assert.match(expectedSealHash??'',/^sha256:[a-f0-9]{64}$/);
  seal=json(evidence+'/plan-seal.json');plan=json(evidence+'/sample-plan.json');sequencePlan=json(evidence+'/sequence-plan.json');
  assertAuthority();anchor=json(evidence+'/plan-seal-anchor.json');fixtureManifest=json(evidence+'/fixture-manifest.json');fixtureLedger=json(evidence+'/fixture-ledger.json');environment=json(evidence+'/runtime-environment.json');
  assert.equal(seal.result,'SEALED');assert.equal(record(evidence+'/plan-seal.json').sha256,expectedSealHash);assert.equal(anchor.record.sha256,expectedSealHash);
  assert.equal(seal.counts.totalHelperLaunches,1544);assert.equal(seal.counts.sequenceWorkerThreads,16);for(const pin of seal.sourceBindings)check(pin);
  assert.equal(fs.existsSync(path.join(root,evidence,'campaign-start.json')),false,'campaign already started');assert.equal(fs.existsSync(path.join(root,evidence,'campaign.json')),false,'campaign already completed');
  const fixtureCheck=verifyFixtureLedger(fixtureLedger),currentHost=captureHost();assert.deepEqual(currentHost,{powershell:environment.powershell.powershell,edition:environment.powershell.edition,is64:environment.powershell.is64,windows:environment.powershell.windows,cpu:environment.powershell.cpu,ramBytes:environment.powershell.ramBytes,volume:environment.powershell.volume,powerScheme:environment.powershell.powerScheme});
  assert.deepEqual({SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,processorArchitecture:process.env.PROCESSOR_ARCHITECTURE,numberOfProcessors:process.env.NUMBER_OF_PROCESSORS,tempVolume:path.parse(process.env.TEMP??'').root},environment.selectedEnvironment);
  spec=helperLaunchSpecification();assert.deepEqual({executable:spec.executable,args:[...spec.args],options:{...spec.options,env:{...spec.options.env},stdio:[...spec.options.stdio]}},environment.helperLaunch);
  let previous=ns();for(let i=0;i<100000;i++){const at=ns();assert.ok(at>=previous);previous=at;}
  byClass=new Map(fixtureManifest.classes.map(c=>[c.id,c]));assert.equal(byClass.size,18);
  startedAtUtc=new Date().toISOString();writeJson(evidence+'/campaign-start.json',{kind:'MO1307ReplacementBoundCampaignStart',startedAtUtc,seal:record(evidence+'/plan-seal.json'),anchor:record(evidence+'/plan-seal-anchor.json'),
    sourceRecheck:'PASS',runtimeRecheck:'PASS',environmentRecheck:'PASS',fixtureRequestExpectedIdentityRecheck:fixtureCheck,clockRecheck:'PASS',productionTree:seal.productionTree??'6a0bf13aaf40e20b68e469989b5a34ef74cf2903',plannedHelperLaunches:1544,plannedWorkerThreads:16,actualHelperLaunches:0,actualWorkerThreads:0});
}catch(error){
  const failure=errorRecord(error),executedPrefix={derivation:0,holdout:0,completedSequenceControls:0,attemptedSequenceControls:0,sequenceHelperLaunches:0,actualHelperLaunches:0,workerThreads:0},
    remaining={samples:Array.isArray(plan?.order)?plan.order.map(row=>({...row,status:'NOT_EXECUTED'})):{binding:seal?.samplePlan??`${evidence}/sample-plan.json`,count:1440,status:'NOT_EXECUTED'},
      sequenceControls:Array.isArray(sequencePlan?.controls)?sequencePlan.controls.map(control=>({id:control.id,kind:control.kind,status:'NOT_EXECUTED',executedHelperPrefix:0,helpers:control.helpers.map(h=>({ordinal:h.ordinal,sequence:h.sequence,operation:h.operation,status:'NOT_EXECUTED'}))})):{binding:seal?.sequencePlan??`${evidence}/sequence-plan.json`,controls:16,helperLaunches:104,status:'NOT_EXECUTED'}};
  const invalidation=writeJson(evidence+'/prelaunch-invalidation.json',{kind:'MO1307ReplacementBoundPrelaunchInvalidation',result:'H_NOT_ESTABLISHED',atUtc:new Date().toISOString(),failure,actualHelperLaunches:0,actualWorkerThreads:0,executedPrefix,remaining,noRetry:true});
  writeJson(evidence+'/campaign.json',{kind:'MO1307ReplacementBoundCampaign',version:'1.0.0',result:'H_NOT_ESTABLISHED',startedAtUtc:null,endedAtUtc:new Date().toISOString(),counts:{planned:1544,actualHelperLaunches:0,derivation:0,holdout:0,sequenceControlsPassed:0,sequenceControlsAttempted:0,sequenceHelperLaunches:0,workerThreads:0},candidateHms:null,stop:{reason:failure,prelaunch:true,evidence:invalidation,executedPrefix,remaining},productionChanges:false,certification:false});
  console.log(JSON.stringify({result:'H_NOT_ESTABLISHED',prelaunch:true,failure}));process.exit(0);
}

let actualLaunches=0,activeNative=false,stop=null,Hns=null,Hms=null,workerThreads=0;
const derivationRows=[],holdoutRows=[],controlRows=[],sequenceHelperReceipts=[];

function responseProjection(response){
  return {status:response.status,code:response.code,operation:response.operation,sequence:response.sequence,session:response.session,
    roots:response.roots.map(r=>r.identity?{id:r.id,identity:r.identity}:{id:r.id,chain:r.chain}),
    files:response.files.map(f=>{const bytes=Buffer.from(f.bytes.join(''),'base64');return {id:f.id,identity:f.identity,byteLength:bytes.length,sha256:hash(bytes)};})};
}
function newLaunchObserver(context){
  const state={context,attempted:false,attemptOrdinal:null,pid:null,spawnEvent:false,spawnError:null,exit:null,close:null,
    pipes:{stdinClose:false,stdoutClose:false,stderrClose:false,stdinFinish:false,stdoutEnd:false,stderrEnd:false},stdout:[],stderr:[],stdoutBytes:0,stderrBytes:0};
  const forward=(exe,args,options)=>{
    assert.equal(exe,spec.executable);assert.deepEqual(args,[...spec.args]);assert.deepEqual(options,{...spec.options,env:{...spec.options.env},stdio:[...spec.options.stdio]});
    assert.equal(state.attempted,false);assert.ok(actualLaunches<1544,'helper launch ceiling');state.attempted=true;state.attemptOrdinal=++actualLaunches;
    const child=spawn(exe,args,options);state.pid=child.pid??null;
    child.once('spawn',()=>{state.spawnEvent=true;});child.once('error',error=>{state.spawnError=errorRecord(error);});
    child.once('exit',(code,signal)=>{state.exit={code,signal};});child.once('close',(code,signal)=>{state.close={code,signal};});
    child.stdin.once('finish',()=>{state.pipes.stdinFinish=true;});child.stdin.once('close',()=>{state.pipes.stdinClose=true;});
    child.stdout.once('end',()=>{state.pipes.stdoutEnd=true;});child.stdout.once('close',()=>{state.pipes.stdoutClose=true;});
    child.stderr.once('end',()=>{state.pipes.stderrEnd=true;});child.stderr.once('close',()=>{state.pipes.stderrClose=true;});
    child.stdout.on('data',data=>{state.stdout.push(Buffer.from(data));state.stdoutBytes+=data.length;});child.stderr.on('data',data=>{state.stderr.push(Buffer.from(data));state.stderrBytes+=data.length;});
    return child;
  };
  return {state,forward};
}
function processEvidence(state){
  const stdout=Buffer.concat(state.stdout,state.stdoutBytes),stderr=Buffer.concat(state.stderr,state.stderrBytes);
  return {stdout,stderr,processOk:state.attempted&&state.spawnEvent&&state.spawnError===null&&state.exit?.code===0&&state.exit?.signal===null&&state.close?.code===0&&state.close?.signal===null&&Object.values(state.pipes).every(Boolean),
    child:{attemptOrdinal:state.attemptOrdinal,pid:state.pid,spawnEvent:state.spawnEvent,spawnError:state.spawnError,exit:state.exit,close:state.close,pipes:state.pipes}};
}
function receiptExists(relative){return fs.existsSync(path.join(root,relative));}
function fallbackRaw(prefix,stdout,stderr){
  const stdoutPath=prefix+'.stdout.bin',stderrPath=prefix+'.stderr.bin';
  try{return {stdout:receiptExists(stdoutPath)?record(stdoutPath):writeBytes(stdoutPath,stdout),stderr:receiptExists(stderrPath)?record(stderrPath):writeBytes(stderrPath,stderr)};}
  catch(error){return {captureError:errorRecord(error),stdout:{byteLength:stdout.length,sha256:hash(stdout)},stderr:{byteLength:stderr.length,sha256:hash(stderr)}};}
}

async function runStandalone({receiptPath,requestRecord,expected,phase,limitNs,planRef}){
  assert.equal(activeNative,false,'helper/helper overlap');activeNative=true;
  const started=new Date().toISOString();let request=null,outerBegin=null,outerEnd=null,supervisor=null,observer=null,answer=null,response=null,error=null;
  try{
    request=decodeHelperRequest(read(requestRecord.path));outerBegin=ns();const frame=encodeHelperRequest(request);assert.ok(frame.equals(read(requestRecord.path)),'request frame mismatch');
    supervisor=createEngineeringSupervisor(limitNs,{phase});observer=newLaunchObserver({phase,planRef});const transport=createHelperTransportForTesting(supervisor,observer.forward);
    try{answer=await transport.exchange(frame);outerEnd=ns();response=decodeHelperResponse(answer.responseBytes,request);assertExpectedResponse(response,answer.responseBytes,expected);}
    catch(caught){outerEnd??=ns();error=errorRecord(caught);if(!response){try{const raw=Buffer.concat(observer.state.stdout,observer.state.stdoutBytes);if(raw.length)response=decodeHelperResponse(raw,request);}catch{}}}
    const snap=supervisor.snapshot(),pe=processEvidence(observer.state),S=snap.durationNs,E=nsText(outerEnd-outerBegin),quiescent=snap.transportCleanupConfirmed===true&&answer?.exitConfirmed===true,
      qualifying=error===null&&observer.state.attempted&&pe.processOk&&observer.state.stderrBytes===0&&quiescent&&S!==null&&BigInt(S)<BigInt(limitNs)&&BigInt(E)<BigInt(limitNs);
    if(!qualifying&&error===null)error={code:'NON_QUALIFYING_LIFECYCLE',stage:'ACQUISITION',reference:null,message:'Lifecycle/security/strict-bound predicate failed'};
    const rawFailure=qualifying?null:fallbackRaw(receiptPath.replace(/\.json$/,''),pe.stdout,pe.stderr),projection=response?responseProjection(response):null;
    const receipt={kind:'MO1307ReplacementBoundLaunch',version:'1.0.0',phase,planRef,request:requestRecord,expected,result:qualifying?'PASS':'FAIL',error,startedAtUtc:started,endedAtUtc:new Date().toISOString(),
      Sns:S,E_ns:E,Sms:S===null?null:ms(S),Ems:ms(E),QcandidateNs:S===null?null:nsText(BigInt(E)>BigInt(S)?BigInt(E)-BigInt(S):0n),limitNs:nsText(limitNs),
      response:{byteLength:answer?.responseBytes.length??pe.stdout.length,sha256:hash(answer?.responseBytes??pe.stdout),projection},stderr:{byteLength:pe.stderr.length,sha256:hash(pe.stderr)},rawFailure,
      child:pe.child,supervisor:snap,security:{freshProcess:observer.state.attempted,oneCanonicalFrame:true,eofAndAllPipes:pe.processOk,stderrZero:pe.stderr.length===0,noRetry:true,noOverlap:true,
        checkedHandleAndToctou:'UNCHANGED_PRODUCTION_HELPER',failClosed:true,lateSuccessRecovery:false,transportSelfDetachAndQuiescence:quiescent,cleanupWithin2000:snap.transportCleanupConfirmed===true,humanAuthoritySeparated:true},
      productionChanges:false,certification:false};
    writeJson(receiptPath,receipt);return receipt;
  }catch(caught){
    if(!observer?.state.attempted)throw caught;
    if(receiptExists(receiptPath))return json(receiptPath);
    const pe=processEvidence(observer.state),snap=supervisor?.snapshot?.()??null,S=snap?.durationNs??null,E=outerBegin===null?null:nsText((outerEnd??ns())-outerBegin),failure=errorRecord(caught),rawFailure=fallbackRaw(receiptPath.replace(/\.json$/,''),pe.stdout,pe.stderr);
    const receipt={kind:'MO1307ReplacementBoundLaunch',version:'1.0.0',phase,planRef,request:requestRecord,expected,result:'FAIL',error:failure,startedAtUtc:started,endedAtUtc:new Date().toISOString(),
      Sns:S,E_ns:E,Sms:S===null?null:ms(S),Ems:E===null?null:ms(E),QcandidateNs:S===null||E===null?null:nsText(BigInt(E)>BigInt(S)?BigInt(E)-BigInt(S):0n),limitNs:nsText(limitNs),
      response:{byteLength:answer?.responseBytes.length??pe.stdout.length,sha256:hash(answer?.responseBytes??pe.stdout),projection:null},stderr:{byteLength:pe.stderr.length,sha256:hash(pe.stderr)},rawFailure,
      child:pe.child,supervisor:snap,security:{freshProcess:true,oneCanonicalFrame:true,eofAndAllPipes:pe.processOk,stderrZero:pe.stderr.length===0,noRetry:true,noOverlap:true,
        checkedHandleAndToctou:'UNCHANGED_PRODUCTION_HELPER',failClosed:true,lateSuccessRecovery:false,transportSelfDetachAndQuiescence:false,cleanupWithin2000:snap?.transportCleanupConfirmed===true,humanAuthoritySeparated:true},
      receiptFallback:true,productionChanges:false,certification:false};
    writeJson(receiptPath,receipt);return receipt;
  }finally{activeNative=false;}
}

function derive(rows){
  assert.equal(rows.length,1080);const values=rows.map(r=>BigInt(r.Sns)),U=values.reduce((a,b)=>a>b?a:b),floor=5_021_030_400n,L=U>floor?U:floor;let V=0n;
  for(let id=1;id<=18;id++){const sample=rows.filter(r=>r.planRef.classId===id).map(r=>BigInt(r.Sns));assert.equal(sample.length,60);const range=sample.reduce((a,b)=>a>b?a:b)-sample.reduce((a,b)=>a<b?a:b);if(range>V)V=range;}
  const Q=rows.map(r=>{const E=BigInt(r.E_ns),S=BigInt(r.Sns);return E>S?E-S:0n;}).reduce((a,b)=>a>b?a:b),R=L+V+Q,H=500n*((R+499_999_999n)/500_000_000n);
  return {U_ns:nsText(U),L_ns:nsText(L),V_ns:nsText(V),Q_ns:nsText(Q),R_ns:nsText(R),H_ms:Number(H),formula:'H=500*ceil(Rns/500000000)',historicalFloorNs:nsText(floor)};
}

function remainingInventory(){
  const executedGlobal=new Set([...derivationRows,...holdoutRows].map(r=>r.planRef?.globalOrdinal).filter(Number.isInteger));
  const samples=plan.order.filter(row=>!executedGlobal.has(row.globalOrdinal)).map(row=>({...row,status:'NOT_EXECUTED'}));
  const controls=[];for(const control of sequencePlan.controls){const row=controlRows.find(x=>x.id===control.id),done=row?.helperReceipts??0;if(row?.result==='PASS')continue;controls.push({id:control.id,kind:control.kind,status:row?'STOPPED_AFTER_EXECUTED_PREFIX':'NOT_EXECUTED',executedHelperPrefix:done,helpers:control.helpers.slice(done).map(h=>({ordinal:h.ordinal,sequence:h.sequence,operation:h.operation,status:'NOT_EXECUTED'}))});}
  return {samples,sequenceControls:controls};
}
function stopGeneration(reason,current){
  if(stop)return;const first={atUtc:new Date().toISOString(),reason:typeof reason==='object'?reason:{code:String(reason)},current,actualHelperLaunches:actualLaunches,workerThreads},
    executedPrefix={derivation:derivationRows.length,holdout:holdoutRows.length,completedSequenceControls:controlRows.filter(x=>x.result==='PASS').length,attemptedSequenceControls:controlRows.length,sequenceHelperLaunches:sequenceHelperReceipts.length,actualHelperLaunches:actualLaunches,workerThreads},remaining=remainingInventory();
  stop={...first,executedPrefix,remaining};const stopRecord=writeJson(evidence+'/generation-stopped.json',{kind:'MO1307ReplacementBoundGenerationStopped',result:'H_NOT_ESTABLISHED',...stop,noRetry:true});stop.evidence=stopRecord;
}

for(const row of plan.order.filter(x=>x.phase==='derivation')){
  const c=byClass.get(row.classId),receiptPath=`${evidence}/derivation/${String(row.phaseOrdinal).padStart(4,'0')}-${row.sampleId}.json`;let rec;
  try{rec=await runStandalone({receiptPath,requestRecord:c.request,expected:c.expected,phase:'derivation',limitNs:DERIVATION_GUARD_NS,planRef:row});}
  catch(error){stopGeneration(errorRecord(error),row);break;}
  derivationRows.push(rec);if(row.phaseOrdinal%18===0)console.log(JSON.stringify({phase:'derivation',completed:row.phaseOrdinal,round:row.round,result:rec.result,maxLaunches:actualLaunches}));
  if(rec.result!=='PASS'){stopGeneration(rec.error,row);break;}
}

if(!stop){
  const value=derive(derivationRows);Hms=value.H_ms;Hns=BigInt(Hms)*1_000_000n;
  if(!(Hms>5000&&Hms<=20000))stopGeneration({code:'H_OUTSIDE_AUTHORIZED_DOMAIN',derived:value},{phase:'h-derivation'});
  else writeJson(evidence+'/h-freeze.json',{kind:'MO1307ReplacementBoundHFreeze',result:'FROZEN_FOR_GENERATION',createdAtUtc:new Date().toISOString(),...value,derivationCount:1080,recomputeAfterHoldout:false});
}

if(!stop)for(const row of plan.order.filter(x=>x.phase==='holdout')){
  const c=byClass.get(row.classId),receiptPath=`${evidence}/holdout/${String(row.phaseOrdinal).padStart(4,'0')}-${row.sampleId}.json`;let rec;
  try{rec=await runStandalone({receiptPath,requestRecord:c.request,expected:c.expected,phase:'holdout',limitNs:Hns,planRef:row});}
  catch(error){stopGeneration(errorRecord(error),row);break;}
  holdoutRows.push(rec);if(row.phaseOrdinal%18===0)console.log(JSON.stringify({phase:'holdout',completed:row.phaseOrdinal,round:row.round,result:rec.result,Hms,actualLaunches}));
  if(rec.result!=='PASS'||BigInt(rec.Sns)>=Hns||BigInt(rec.E_ns)>=Hns){stopGeneration(rec.error??{code:'HOLDOUT_AT_OR_ABOVE_H'},row);break;}
}

function equalCore(a,b){assert.deepEqual(responseIdentityCore(a),responseIdentityCore(b));}
function validateRelational(control,response,state){
  if(control.command!=='evaluate')return;const seq=response.sequence,chain=response.roots[0]?.chain;
  if(seq===5)state.parent=chain.map(x=>structuredClone(x));
  if(seq===6){assert.equal(chain.length,state.parent.length+1);state.parent.forEach((x,i)=>equalCore(x,chain[i]));state.output=chain.map(x=>structuredClone(x));}
  if(seq===7){assert.equal(chain.length,state.output.length);state.output.forEach((x,i)=>equalCore(x,chain[i]));}
  if(seq===8){assert.equal(chain.length,state.output.length+1);state.output.forEach((x,i)=>equalCore(x,chain[i]));assert.equal(chain.at(-1).byteLength,control.expected.result.byteLength);state.pending=chain.map(x=>structuredClone(x));}
  if(seq===9){assert.equal(chain.length,state.pending.length);state.pending.forEach((x,i)=>equalCore(x,chain[i]));}
}
function collectingStream(){const chunks=[];let total=0;const stream=new Writable({write(chunk,_encoding,callback){const b=Buffer.from(chunk);chunks.push(b);total+=b.length;callback();}});return {stream,bytes:()=>Buffer.concat(chunks,total)};}

async function runControl(control){
  if(control.command==='evaluate')assert.equal(capturePathState(control.launch.outputRoot).exists,false);else checkTree(control.initialState.resultTree);
  const cliBegin=ns(),started=performance.now(),supervisor=createProspectiveSupervisor({kind:'cli',started,helperBoundMs:Hms}),relational={},capture=collectingStream();
  let index=0,result=null,error=null,sequenceSnapshot=null,pending=null,orchestrationFailure=null;
  const alreadyRecorded=helper=>sequenceHelperReceipts.some(x=>x.controlId===control.id&&x.helperOrdinal===helper.ordinal);
  const persist=(ctx,receipt)=>{
    if(!ctx.observer.state.attempted)return receipt;
    if(receiptExists(ctx.receiptPath))receipt=json(ctx.receiptPath);else writeJson(ctx.receiptPath,receipt);
    if(!alreadyRecorded(ctx.helper)){sequenceHelperReceipts.push(receipt);index++;}
    return receipt;
  };
  const fallbackReceipt=(ctx,caught,detail=null)=>{
    const pe=processEvidence(ctx.observer.state),snapshot=supervisor.snapshot(),events=ctx.eventAt===null?[]:snapshot.events.slice(ctx.eventAt),startEvent=events.find(x=>x.type==='start'&&x.role==='helper'),endEvent=[...events].reverse().find(x=>x.type==='quiescent'&&x.role==='helper'),
      Sns=startEvent&&endEvent?nsText(BigInt(Math.round((endEvent.at-startEvent.at)*1e6))):null,E=ctx.begin===null?null:nsText((ctx.end??ns())-ctx.begin),failure=errorRecord(caught),rawFailure=fallbackRaw(ctx.receiptPath.replace(/\.json$/,''),pe.stdout,pe.stderr),sequenceNs=detail?nsText(BigInt(Math.round(detail.durationMs*1e6))):null;
    return {kind:'MO1307ReplacementBoundSequenceHelper',controlId:control.id,kindName:control.kind,helperOrdinal:ctx.helper.ordinal,sequence:ctx.helper.sequence,operation:ctx.helper.operation,request:ctx.helper.request,expected:ctx.helper.expected,
      result:'FAIL',error:failure,startedAtUtc:ctx.startedAt,endedAtUtc:new Date().toISOString(),Sns,E_ns:E,Sms:Sns===null?null:ms(Sns),Ems:E===null?null:ms(E),sequenceLifecycleNs:sequenceNs,sequenceLifecycleMs:detail?.durationMs??null,sequenceUsedMsAfter:detail?.usedMs??null,Hms,
      response:{byteLength:ctx.answer?.responseBytes.length??pe.stdout.length,sha256:hash(ctx.answer?.responseBytes??pe.stdout),projection:null},stderr:{byteLength:pe.stderr.length,sha256:hash(pe.stderr)},rawFailure,
      child:pe.child,supervisorEvents:events,security:{freshProcess:true,oneCanonicalFrame:ctx.observer.state.pipes.stdinFinish,eofAndAllPipes:pe.processOk,stderrZero:pe.stderr.length===0,noRetry:true,noOverlap:true,sameProspectiveSupervisorOwnership:true,transportSelfDetachAndQuiescence:false,checkedHandleAndToctou:'UNCHANGED_PRODUCTION_HELPER',humanAuthoritySeparated:true},
      receiptFallback:true,productionChanges:false,certification:false};
  };
  const finalizeHelper=(ctx,detail,{failure=null,validate=true}={})=>{
    let receipt;
    try{
      let frameError=failure?errorRecord(failure):null,response=detail?.response??null;
      if(frameError===null&&validate){
        try{
          assert.ok(detail,'missing post-helper endpoint detail');assert.equal(detail.request.sequence,ctx.helper.sequence);assert.equal(detail.request.operation,ctx.helper.operation);
          assert.ok(ctx.frame.equals(read(ctx.helper.request.path)),`sealed frame mismatch ${control.id}/${ctx.helper.sequence}`);
          assertExpectedResponse(response,ctx.answer.responseBytes,ctx.helper.expected);validateRelational(control,response,relational);
        }catch(caught){frameError=errorRecord(caught);}
      }else if(response===null){try{const raw=Buffer.concat(ctx.observer.state.stdout,ctx.observer.state.stdoutBytes);if(raw.length)response=decodeHelperResponse(raw,decodeHelperRequest(ctx.frame));}catch{}}
      const pe=processEvidence(ctx.observer.state),snapshot=supervisor.snapshot(),events=snapshot.events.slice(ctx.eventAt),startEvent=events.find(x=>x.type==='start'&&x.role==='helper'),endEvent=[...events].reverse().find(x=>x.type==='quiescent'&&x.role==='helper'),Sns=startEvent&&endEvent?nsText(BigInt(Math.round((endEvent.at-startEvent.at)*1e6))):null,E=nsText((ctx.end??ns())-ctx.begin),sequenceNs=detail?nsText(BigInt(Math.round(detail.durationMs*1e6))):null,
        quiescent=ctx.answer?.exitConfirmed===true&&endEvent!==undefined&&snapshot.activeRole===null,qualifying=frameError===null&&detail!==null&&ctx.observer.state.attempted&&pe.processOk&&pe.stderr.length===0&&quiescent&&Sns!==null&&BigInt(Sns)<Hns&&detail.durationMs<Hms;
      if(!qualifying&&frameError===null)frameError={code:'COMPLETE_SEQUENCE_HELPER_FAILURE',stage:'ACQUISITION',reference:null,message:'Complete-sequence helper lifecycle/security predicate failed'};
      const rawFailure=qualifying?null:fallbackRaw(ctx.receiptPath.replace(/\.json$/,''),pe.stdout,pe.stderr);
      receipt={kind:'MO1307ReplacementBoundSequenceHelper',controlId:control.id,kindName:control.kind,helperOrdinal:ctx.helper.ordinal,sequence:ctx.helper.sequence,operation:ctx.helper.operation,request:ctx.helper.request,expected:ctx.helper.expected,
        result:qualifying?'PASS':'FAIL',error:frameError,startedAtUtc:ctx.startedAt,endedAtUtc:new Date().toISOString(),Sns,E_ns:E,Sms:Sns===null?null:ms(Sns),Ems:ms(E),sequenceLifecycleNs:sequenceNs,sequenceLifecycleMs:detail?.durationMs??null,sequenceUsedMsAfter:detail?.usedMs??null,Hms,
        response:{byteLength:ctx.answer?.responseBytes.length??pe.stdout.length,sha256:hash(ctx.answer?.responseBytes??pe.stdout),projection:response?responseProjection(response):null},stderr:{byteLength:pe.stderr.length,sha256:hash(pe.stderr)},rawFailure,
        child:pe.child,supervisorEvents:events,security:{freshProcess:ctx.observer.state.attempted,oneCanonicalFrame:ctx.observer.state.pipes.stdinFinish,eofAndAllPipes:pe.processOk,stderrZero:pe.stderr.length===0,noRetry:true,noOverlap:true,sameProspectiveSupervisorOwnership:true,transportSelfDetachAndQuiescence:quiescent,checkedHandleAndToctou:'UNCHANGED_PRODUCTION_HELPER',humanAuthoritySeparated:true},productionChanges:false,certification:false};
      receipt=persist(ctx,receipt);
    }catch(caught){receipt=alreadyRecorded(ctx.helper)?sequenceHelperReceipts.find(x=>x.controlId===control.id&&x.helperOrdinal===ctx.helper.ordinal):persist(ctx,fallbackReceipt(ctx,caught,detail));}
    if(receipt.result!=='PASS')throw Object.assign(new Error(receipt.error?.message??'Complete-sequence helper failed'),receipt.error??{});
    return receipt;
  };
  const afterHelperExited=detail=>{
    const ctx=pending;assert.ok(ctx,'post-helper hook without pending transport');
    try{return finalizeHelper(ctx,detail);}finally{pending=null;}
  };
  const exchange=async frame=>{
    const helper=control.helpers[index];assert.ok(helper,'unexpected extra helper');assert.equal(pending,null,'prior helper evidence not settled');assert.equal(activeNative,false,'helper/helper overlap');activeNative=true;
    const ctx={helper,frame:Buffer.from(frame),receiptPath:`${evidence}/sequence-controls/${control.id}/helpers/${String(helper.ordinal).padStart(2,'0')}.json`,startedAt:new Date().toISOString(),observer:null,eventAt:null,begin:null,end:null,answer:null};
    try{
      ctx.observer=newLaunchObserver({phase:'sequence-control',controlId:control.id,helperOrdinal:helper.ordinal,sequence:helper.sequence});ctx.eventAt=supervisor.snapshot().events.length;
      const transport=createHelperTransportForTesting(supervisor,ctx.observer.forward);ctx.begin=ns();
      try{ctx.answer=await transport.exchange(ctx.frame);ctx.end=ns();pending=ctx;return ctx.answer;}
      catch(caught){ctx.end??=ns();if(ctx.observer.state.attempted)finalizeHelper(ctx,null,{failure:caught,validate:false});throw caught;}
    }catch(caught){
      if(ctx.observer?.state.attempted&&!alreadyRecorded(helper))persist(ctx,fallbackReceipt(ctx,caught));
      throw caught;
    }finally{activeNative=false;}
  };
  try{result=await orchestrateProspectiveCli(control.launch,{supervisor,exchange,session:control.session,helperBoundMs:Hms,afterHelperExited,stdout:capture.stream});sequenceSnapshot=result.sequence;}
  catch(caught){orchestrationFailure=caught;error=errorRecord(caught);sequenceSnapshot=caught?.prospectiveSequence??null;}
  finally{
    if(pending){const ctx=pending;pending=null;try{finalizeHelper(ctx,null,{failure:orchestrationFailure??new Error('Helper completed transport without post-helper endpoint'),validate:false});}catch(receiptError){error??=errorRecord(receiptError);}}
    try{await supervisor.dispose();}catch(disposeError){error??=errorRecord(disposeError);}
  }
  const cliEnd=ns(),cliNs=cliEnd-cliBegin,snapshot=supervisor.snapshot(),workerStarts=snapshot.events.filter(x=>x.type==='start'&&x.role==='worker'),workerEnds=snapshot.events.filter(x=>x.type==='quiescent'&&x.role==='worker'),workerObservations=snapshot.events.filter(x=>x.type==='observation'&&x.role==='worker'),
    workerMs=workerStarts.length===1&&workerEnds.length===1?workerEnds[0].at-workerStarts[0].at:null,stdout=capture.bytes();
  if(workerStarts.length===1)workerThreads++;
  try{
    assert.equal(error,null);assert.equal(index,control.helperLaunches);assert.equal(snapshot.helpers,control.helperLaunches);assert.equal(snapshot.workers,1);assert.equal(workerStarts.length,1);assert.equal(workerEnds.length,1);assert.equal(workerObservations.length,1);
    assert.ok(workerMs<10000);assert.ok(snapshot.helperUsedMs<20000);assert.ok(sequenceSnapshot.usedMs<20000);assert.ok(cliNs<30_000_000_000n);assert.equal(snapshot.activeRole,null);assert.equal(snapshot.cleanupConfirmed,true);
    assert.equal(sequenceSnapshot.failed,false);assert.equal(sequenceSnapshot.worker,'STOPPED');assert.equal(sequenceSnapshot.active,null);assert.equal(sequenceSnapshot.awaitingExit,false);assert.equal(sequenceSnapshot.next,control.command==='evaluate'?10:5);assert.equal(sequenceSnapshot.claimed,control.command==='evaluate');
    assert.equal(result.exitCode,control.expected.exitCode);assert.equal(result.committed,control.expected.committed);assert.equal(hash(Buffer.from(result.resultBytes)),control.expected.result.sha256);assert.equal(Buffer.from(result.resultBytes).length,control.expected.result.byteLength);
    check(control.expected.stdout,stdout);
    if(control.command==='evaluate'){const final=capturePathState(path.join(control.launch.outputRoot,'memoryos-readiness-result.json')),pending=capturePathState(path.join(control.launch.outputRoot,'memoryos-readiness-result.json.pending'));assert.equal(final.sha256,control.expected.result.sha256);assert.equal(final.byteLength,control.expected.result.byteLength);assert.equal(pending.exists,false);}
    else checkTree(control.initialState.resultTree);
  }catch(validationError){error??=errorRecord(validationError);}
  const pass=error===null,receipt={kind:'MO1307ReplacementBoundSequenceControl',version:'1.0.0',id:control.id,kindName:control.kind,result:pass?'PASS':'FAIL',error,
    helperReceipts:index,helperLaunchesPlanned:control.helperLaunches,workerThreads:workerStarts.length,helperAggregateMs:snapshot.helperUsedMs,sequenceAggregateMs:sequenceSnapshot?.usedMs??null,
    cliNs:nsText(cliNs),cliMs:ms(cliNs),workerMs,limits:{individualHelperMs:Hms,helperAggregateMs:20000,cliAdmissionMs:30000,workerApiMs:10000,cleanupMs:2000},
    cliResult:result?{exitCode:result.exitCode,committed:result.committed,byteLength:result.resultBytes.length,sha256:hash(Buffer.from(result.resultBytes))}:null,stdout:{byteLength:stdout.length,sha256:hash(stdout)},
    supervisor:snapshot,sequence:sequenceSnapshot,productionChanges:false,certification:false};
  writeJson(`${evidence}/sequence-controls/${control.id}/receipt.json`,receipt);return receipt;
}

if(!stop)for(const control of sequencePlan.controls){
  let rec;try{rec=await runControl(control);}catch(error){
    const receiptPath=`${evidence}/sequence-controls/${control.id}/receipt.json`;
    if(receiptExists(receiptPath))rec=json(receiptPath);
    else{const priorWorkers=controlRows.reduce((sum,row)=>sum+(row.workerThreads??0),0),controlWorkers=Math.max(0,workerThreads-priorWorkers);rec={kind:'MO1307ReplacementBoundSequenceControl',version:'1.0.0',id:control.id,kindName:control.kind,result:'FAIL',error:errorRecord(error),
      helperReceipts:sequenceHelperReceipts.filter(x=>x.controlId===control.id).length,helperLaunchesPlanned:control.helperLaunches,workerThreads:controlWorkers,helperAggregateMs:null,sequenceAggregateMs:null,cliNs:null,cliMs:null,workerMs:null,
      limits:{individualHelperMs:Hms,helperAggregateMs:20000,cliAdmissionMs:30000,workerApiMs:10000,cleanupMs:2000},cliResult:null,stdout:null,supervisor:null,sequence:null,outerFailure:true,productionChanges:false,certification:false};writeJson(receiptPath,rec);}
  }
  controlRows.push(rec);console.log(JSON.stringify({phase:'sequence-control',id:control.id,kind:control.kind,result:rec.result,helperReceipts:rec.helperReceipts,actualLaunches,workerThreads}));if(rec.result!=='PASS'){stopGeneration(rec.error,{controlId:control.id});break;}
}

if(!stop){
  try{for(const pin of seal.sourceBindings)check(pin);verifyFixtureLedger(fixtureLedger,{includeControlInitial:false});assertAuthority();const afterHost=captureHost();assert.deepEqual(afterHost,{powershell:environment.powershell.powershell,edition:environment.powershell.edition,is64:environment.powershell.is64,windows:environment.powershell.windows,cpu:environment.powershell.cpu,ramBytes:environment.powershell.ramBytes,volume:environment.powershell.volume,powerScheme:environment.powershell.powerScheme});
    assert.equal(actualLaunches,1544);assert.equal(derivationRows.length,1080);assert.equal(holdoutRows.length,360);assert.equal(controlRows.filter(x=>x.result==='PASS').length,16);assert.equal(sequenceHelperReceipts.length,104);assert.equal(workerThreads,16);
  }catch(error){stopGeneration({code:'POST_LAUNCH_INTEGRITY_FAILURE',detail:errorRecord(error)},{phase:'post-campaign-integrity'});}
}

const campaignResult=stop?'H_NOT_ESTABLISHED':'CAMPAIGN_COMPLETE_PENDING_INDEPENDENT_RECOMPUTATION';
writeJson(evidence+'/campaign.json',{kind:'MO1307ReplacementBoundCampaign',version:'1.0.0',result:campaignResult,startedAtUtc,endedAtUtc:new Date().toISOString(),seal:record(evidence+'/plan-seal.json'),
  counts:{planned:1544,actualHelperLaunches:actualLaunches,derivation:derivationRows.length,holdout:holdoutRows.length,sequenceControlsPassed:controlRows.filter(x=>x.result==='PASS').length,sequenceControlsAttempted:controlRows.length,sequenceHelperLaunches:sequenceHelperReceipts.length,workerThreads},
  candidateHms:Hms,stop,productionChanges:false,contractChanges:false,freezeChanges:false,certification:false,phase3A:false,phase3B:false,phase3C:false,phase3D:false,push:false,tag:false});
console.log(JSON.stringify({result:campaignResult,candidateHms:Hms,actualHelperLaunches:actualLaunches,derivation:derivationRows.length,holdout:holdoutRows.length,sequenceControls:controlRows.length,sequenceHelperLaunches:sequenceHelperReceipts.length,workerThreads}));
