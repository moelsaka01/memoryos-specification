import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {trustedValidationBroker,launch,root,stage,response,wire,delay,api} from './installed.mjs';
import {catalog,raw,fixture} from './campaign-catalog.mjs';
import {monitor,osSummary,stateSummary} from './monitor.mjs';
import {validateWindow,validateChunk,makeWindow} from './sample-proof.mjs';
import {clock,elapsedUs,failureEvidence,protocolVersion,relation} from './clock.mjs';
import {J} from '../../../memoryos-rest/src/serialization.mjs';
const campaignId=randomUUID(),validationBroker=trustedValidationBroker();
const mode=process.argv[2];assert.equal(mode,'bounded','OBSOLETE_UNIVERSAL_CAMPAIGN_DISABLED');
const planPath=resolve(root,process.argv[3]),plan=JSON.parse(readFileSync(planPath));
assert.equal(plan.kind,'MemoryOSRESTBoundedOrdinaryPlan');assert.ok(['functional','resource','extension'].includes(plan.layer));
assert.ok(plan.output.startsWith('repositories/cca-conformance/evidence/mo1305-phase1-r6/')&&!plan.output.includes('..'));
const allCases=catalog(),cases=allCases.filter(c=>plan.cases.includes(c.id));assert.equal(cases.length,plan.cases.length);assert.equal(new Set(plan.cases).size,plan.cases.length);
if(plan.layer==='functional'){assert.equal(cases.length,105);assert.equal(plan.cold,1);assert.equal(plan.warm,0);}else{assert.ok(cases.length<=20);assert.ok(plan.cold>=0&&plan.cold<=30&&plan.warm>=0&&plan.warm<=50);if(plan.layer==='resource'){assert.equal(plan.cold,10);assert.equal(plan.warm,20);}else assert.ok(plan.extensionReason);}
const output=resolve(root,plan.output);assert.ok(!existsSync(output),'CAMPAIGN_OUTPUT_ALREADY_EXISTS');mkdirSync(output,{recursive:true});
const rawOutput=resolve(root,'.cache/mo1305-bounded-r6',plan.layer+'-raw');mkdirSync(rawOutput,{recursive:true});
const identity=path=>{const bytes=readFileSync(path);return {path:path.replace(root+'\\','').replaceAll('\\','/'),byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};};
const binding={archive:identity(resolve(root,'.cache/mo1305-resume/build/memoryos-rest-0.1.0.tgz')),distributionManifest:identity(resolve(stage,'package/distribution-manifest.json')),sourceTreeSha256:JSON.parse(readFileSync(resolve(stage,'package/dependency-manifest.json'))).sourceTreeSha256};
const limits=JSON.parse(readFileSync(resolve(stage,'package/contracts/limits.json')));
const executionDeadline=clock.mono()+BigInt(plan.maximumRunMs)*1000000n;
const collectorIdentity={candidateId:binding.sourceTreeSha256,archiveSha256:binding.archive.sha256,campaignId};
const progress={kind:'MemoryOSRESTResourceCampaign',protocolVersion,campaignId,state:'RUNNING',mode:plan.layer,methodologyVersion:'2.0.0',plan:identity(planPath),platform:'windows-11-x64',started:clock.stamp(),binding,coldRequired:plan.cold,warmRequired:plan.warm,totalCases:cases.length,completed:[],failure:null};
function save(){writeFileSync(resolve(output,'progress.json'),J(progress));}save();
let activeContext=null;
async function start(item,suffix){let state=null;try{state=await launch({validationBroker,measurement:true,args:item.projection?[resolve(import.meta.dirname,'projection-server.mjs'),stage,item.projection]:null});const os=await monitor(state.child,resolve(rawOutput,item.id+'-'+suffix+'.json'),collectorIdentity);return {state,os};}catch(error){if(state){try{await state.stop();}catch(cleanupError){writeFileSync(resolve(output,item.id+'-'+suffix+'-startup-cleanup-failure.json'),J(failureEvidence(cleanupError,{...activeContext,pid:state.child.pid})));}}writeFileSync(resolve(output,item.id+'-'+suffix+'-startup-failure.json'),J(failureEvidence(error,{...activeContext,pid:state?.child.pid??null,runId:error.identity?.sessionId??null,captureContext:error.capture??null,collector:error.identity??null})));throw error;}}
async function sample(item,run,phase,index){
 const {state,os}=run,context={case:item.id,phase,index,candidateId:binding.sourceTreeSha256,archiveSha256:binding.archive.sha256,campaignId,runId:os.identity.sessionId,pid:state.child.pid,pre:null,requestStart:null,responseEnd:null,post:null,http:null,httpChecksPassed:false};activeContext=context;
 try{
  relation('TASK_CAMPAIGN_BUDGET','<','nowNs',clock.mono(),'stopNs',executionDeadline-65000000000n,{units:'ns',domain:clock.domain});
  await delay(60);const pre=await os.barrier();context.pre=pre;state.observations.length=0;state.states.splice(0,Math.max(0,state.states.length-1));os.rows.splice(0,os.rows.findIndex(row=>row.sequence===pre.row.sequence));
  const request=raw(item),requestStart=clock.stamp();context.requestStart=requestStart;
  const result=response(await wire(request,{timeout:63000})),responseEnd=clock.stamp();context.responseEnd=responseEnd;context.http={status:result.status,responseSha256:createHash('sha256').update(result.bytes).digest('hex'),responseBytes:result.bytes.length};
  assert.equal(result.status,item.status,item.id);if(item.expected)assert.deepEqual(result.body,item.expected,item.id);
  else if(item.operation==='getHealth')assert.deepEqual(result.body,{status:'ok',live:true});else if(item.operation==='getReadiness')assert.deepEqual(result.body,{status:'ok',ready:true});else assert.equal(result.body.packageVersion,'0.1.0');context.httpChecksPassed=true;
  await delay(50);const post=await os.barrier();context.post=post;assert.equal(state.observations.length,1,item.id+' report count');const metrics=state.observations[0].record;
  const parent=stateSummary(state.states),native=osSummary(os.rows.filter(row=>row.sequence<=post.row.sequence)),nativeWindow=makeWindow(pre,requestStart,responseEnd,post);context.nativeWindow=nativeWindow;
  assert.ok(parent.peak.workers<=1);assert.ok(parent.peak.semanticOwners<=1);for(const key of ['workers','semanticOwners','connections'])assert.equal(parent.cleanup[key],0);
  const dispatched=api.routes.find(r=>r.operationId===item.operation).category==='semantic'&&(item.mechanism.startsWith('independent')||item.projection||item.id==='maximum-permitted-headers');if(dispatched){assert.equal(metrics.workerCreated,1,item.id);assert.equal(metrics.workerReaped,1,item.id);}
  const productLengths=Object.fromEntries(Object.entries(result.body).filter(([k,v])=>k.endsWith('Base64')&&typeof v==='string').map(([k,v])=>[k,{encodedBytes:v.length,decodedBytes:Buffer.from(v,'base64').length}]));
  assert.ok(!state.stderr.includes('Bearer'));const record={provenance:{campaignId,sourceTreeSha256:binding.sourceTreeSha256,archiveSha256:binding.archive.sha256,sessionId:os.identity.sessionId,pid:state.child.pid,processStartedUtcMs:pre.row.processStartedUtcMs},phase,index,requestBytes:request.length,bodyBytes:request.length-request.indexOf('\r\n\r\n')-4,responseBytes:result.bytes.length,responseSha256:context.http.responseSha256,roundTripUs:elapsedUs(requestStart,responseEnd),operationTiming:state.observations[0].operationTiming??null,metrics,parent,native,nativeWindow,parentHeapDeltaBytes:Math.max(0,parent.peak.heapTotal-parent.baseline.heapTotal),parentExternalDeltaBytes:Math.max(0,parent.peak.external-parent.baseline.external),productLengths,status:result.status,state:'PASS'};validateWindow(record);context.validSample=record;
  if(plan.layer!=='functional'){
   const derivedMs=Math.ceil(Math.max(1000,4*(metrics.operationUs??0)/1000)/100)*100;
   relation('SEMANTIC_DEADLINE_CEILING_EXCEEDED','<=','derivedDeadlineMs',derivedMs,'absoluteCeilingMs',60000,{units:'ms',domain:record.operationTiming?.clockDomain??clock.domain});
   for(const [key,value,minimum] of [['workerYoungMiB',metrics.youngBytes??0,8],['workerOldMiB',metrics.oldBytes??0,32],['workerExternalMiB',metrics.externalBytes??0,8],['parentHeapMiB',parent.peak.heapTotal,32],['parentExternalMiB',parent.peak.external,8],['processRssMiB',Math.max(parent.peak.rss,native.peak.PeakWorkingSetSize),128]])relation('MEMORY_CEILING_EXCEEDED','<=',key,Math.max(minimum,Math.ceil(1.5*value/1048576)),'preliminaryCeilingMiB',limits.measured[key],{units:'MiB',domain:'RESOURCE_BYTES'});
  }return record;
 }catch(error){const failed=failureEvidence(error,{...context,captureTicket:error.capture?.requestedTicket??os.rows.at(-1)?.ticket??null,sequence:error.capture?.lastSequence??os.rows.at(-1)?.sequence??null,captureContext:error.capture??null,observed:clock.stamp(),observations:state.observations,parent:state.states.length?stateSummary(state.states):null,native:os.rows.length?osSummary(os.rows):null});writeFileSync(resolve(output,item.id+'-failed-sample.json'),J(failed));throw error;}
}
try{
 for(const item of cases){
  const records=[],runs=[];const persist=complete=>writeFileSync(resolve(output,item.id+'.json'),J({campaignId,runs,id:item.id,fixtureSha256:fixture(item),complete,records}));
  async function execute(phase,number){activeContext={case:item.id,phase,index:number,candidateId:binding.sourceTreeSha256,archiveSha256:binding.archive.sha256,campaignId};let run=null,error=null;try{run=await start(item,phase==='cold'?'cold-'+number:'warm');if(phase==='cold')records.push(await sample(item,run,phase,number));else for(let i=0;i<progress.warmRequired;i++){records.push(await sample(item,run,phase,i));persist(false);}}catch(e){error=e;}finally{
   if(run){let exit=null,cleanupError=null;try{exit=await run.state.stop();}catch(e){cleanupError=e;}try{await run.os.stop();}catch(e){cleanupError??=e;}
    const {sessionId,pid,collectorPid,rawPath,candidateId,archiveSha256,campaignId}=run.os.identity;let rawRef=null,creation=null;if(existsSync(rawPath)){rawRef=identity(rawPath);creation=JSON.parse(readFileSync(rawPath)).processStartedUtcMs;}
    runs.push({sessionId,pid,collectorPid,candidateId,archiveSha256,campaignId,processStartedUtcMs:creation,phase,index:number,exitCode:exit?.code??run.state.child.exitCode,collectorExitCode:cleanupError?null:0,raw:rawRef});
    if(cleanupError){writeFileSync(resolve(output,item.id+'-'+phase+'-'+number+'-cleanup-failure.json'),J(failureEvidence(cleanupError,{case:item.id,phase,index:number,candidateId,campaignId,runId:sessionId,pid})));error??=cleanupError;}
   }persist(false);
  }if(error)throw error;}
  for(let i=0;i<progress.coldRequired;i++)await execute('cold',i);if(progress.warmRequired)await execute('warm',0);
  const path=resolve(output,item.id+'.json'),chunk={campaignId,runs,id:item.id,fixtureSha256:fixture(item),complete:true,records};validateChunk(chunk,progress,ref=>{assert.deepEqual(identity(resolve(root,ref.path)),ref);return JSON.parse(readFileSync(resolve(root,ref.path)));});persist(true);assert.ok(readFileSync(path).length<=2097152);progress.completed.push({id:item.id,cold:progress.coldRequired,warm:progress.warmRequired,samples:identity(path)});save();console.log(JSON.stringify({case:item.id,state:'PASS',completed:progress.completed.length,total:cases.length,cold:progress.coldRequired,warm:progress.warmRequired}));
 }
 progress.state='PASS';progress.ended=clock.stamp();save();
}catch(error){progress.state='FAIL';progress.ended=clock.stamp();progress.failure=failureEvidence(error,{case:cases[progress.completed.length]?.id??'unknown',context:activeContext});save();throw error;}finally{await validationBroker.stop();}
