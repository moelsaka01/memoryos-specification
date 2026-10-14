import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {launch,trustedValidationBroker,stage,root,wire,response,delay} from '../../repositories/cca-conformance/tools/mo1305-phase1/installed.mjs';
import {catalog,raw} from '../../repositories/cca-conformance/tools/mo1305-phase1/campaign-catalog.mjs';
import {monitor} from '../../repositories/cca-conformance/tools/mo1305-phase1/monitor.mjs';
import {clock,elapsedUs} from '../../repositories/cca-conformance/tools/mo1305-phase1/clock.mjs';
const out=resolve(root,'.cache/mo1305-r6-diagnostic'),diagnosticId=randomUUID(),broker=trustedValidationBroker();
const item=catalog().find(x=>x.id==='maximum-permitted-headers');assert.ok(item);const limits=JSON.parse(readFileSync(resolve(stage,'package/contracts/limits.json')));assert.equal(limits.measured.operationMs,60000);assert.equal(limits.state,'PRELIMINARY');
const sourceTreeSha256=JSON.parse(readFileSync(resolve(stage,'package/dependency-manifest.json'))).sourceTreeSha256;assert.equal(sourceTreeSha256,'3757c03536d73d0457b901155cab34b5b1c0e410c5a64ed0ba1e9dbbc1007949');
const archiveSha256=createHash('sha256').update(readFileSync(resolve(root,'.cache/mo1305-bounded-r6/frozen-measured/memoryos-rest-0.1.0.tgz'))).digest('hex');
const records=[],runs=[];const began=clock.stamp();let fatal=null;
function save(){writeFileSync(resolve(out,'focused-reproduction.json'),JSON.stringify({kind:'R6FocusedDiagnostic',certification:false,state:fatal?'FAIL':'RUNNING',diagnosticId,sourceTreeSha256,archiveSha256,case:item.id,configuredOperationMs:60000,records,runs,failure:fatal}));}
async function run(mode,label,count){
 const trace=resolve(out,mode+'-'+label+'-parent.json'),started=clock.stamp();let state,collector,exit=null,collectorExit=null;
 try{
  state=await launch({validationBroker:broker,measurement:true,args:[resolve(out,'diagnostic-server.mjs'),stage,trace]});
  if(mode==='with-collector')collector=await monitor(state.child,resolve(out,mode+'-'+label+'-native.json'),{candidateId:sourceTreeSha256,archiveSha256,campaignId:diagnosticId});
  for(let index=0;index<count;index++){
   assert.ok(elapsedUs(began,clock.stamp())<480000000,'DIAGNOSTIC_STAGE_BUDGET');await delay(60);let pre=null,post=null;
   if(collector)pre=await collector.barrier();state.observations.length=0;
   const requestStart=clock.stamp();let result,error=null;try{result=response(await wire(raw(item),{timeout:63000}));}catch(e){error={message:e.message,code:e.code??null};}
   const responseEnd=clock.stamp();await delay(60);if(collector)post=await collector.barrier();
   const record={mode,phase:label==='warm'?'warm':'cold',index:label==='warm'?index:Number(label.replace('cold-','')),pid:state.child.pid,requestStart,responseEnd,roundTripUs:elapsedUs(requestStart,responseEnd),httpStatus:result?.status??null,responseSha256:result?createHash('sha256').update(result.bytes).digest('hex'):null,expectedStatus:200,bodyExact:result?JSON.stringify(result.body)===JSON.stringify(item.expected):false,observations:state.observations.slice(),pre,post,error};
   records.push(record);save();console.log(JSON.stringify({mode,phase:record.phase,index:record.index,status:record.httpStatus,roundTripUs:record.roundTripUs,operationUs:record.observations[0]?.record.operationUs??null}));
   assert.equal(record.httpStatus,200,'DIAGNOSTIC_HTTP_FAILURE');assert.deepEqual(result.body,item.expected,'DIAGNOSTIC_BODY_MISMATCH');assert.equal(state.observations.length,1);
  }
 }finally{
  if(state){try{exit=await state.stop();}finally{if(collector){await collector.stop();collectorExit=await collector.exited;}}}
  runs.push({mode,label,pid:state?.child.pid??null,started,ended:clock.stamp(),exit,collectorExit,trace:trace.replace(root+'\\','').replaceAll('\\','/')});save();
 }
}
try{
 for(let i=0;i<3;i++)await run('with-collector','cold-'+i,1);await run('with-collector','warm',5);
 await run('without-collector','cold-0',1);await run('without-collector','warm',3);
}catch(e){fatal={message:e.message,code:e.code??null};save();throw e;}
finally{await broker.stop();}
const value=JSON.parse(readFileSync(resolve(out,'focused-reproduction.json')));value.state='DIAGNOSTIC_COMPLETED';value.elapsedUs=elapsedUs(began,clock.stamp());writeFileSync(resolve(out,'focused-reproduction.json'),JSON.stringify(value));console.log(JSON.stringify({state:value.state,observations:records.length,elapsedUs:value.elapsedUs}));