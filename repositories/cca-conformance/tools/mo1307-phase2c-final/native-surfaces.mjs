// Native 2C lifecycle acceptance: every inspection frame comes from the fixed
// production helper. Only semantic computation uses the reviewed fixed worker.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createSupervisorForTesting } from '../../../memoryos-readiness/src/runtime.mjs';
import { createHelperTransport, helperLaunchSpecification } from '../../../memoryos-readiness/src/helper-transport.mjs';
import { decodeHelperRequest, decodeHelperResponse } from '../../../memoryos-readiness/src/helper-protocol.mjs';
import { orchestrateCli } from '../../../memoryos-readiness/src/cli.mjs';
import { bundle, root, workerURL, finalName, launchFor, capture } from '../mo1307-phase2c-resumed/surface-fixture.mjs';
const [receiptDirectory] = process.argv.slice(2);
if (!receiptDirectory || !path.isAbsolute(receiptDirectory)) throw Error('explicit absolute receipt directory');
await fs.mkdir(receiptDirectory,{recursive:false});
const scratch = path.join(root,'.cache/mo1307-phase2c-final/native-surfaces-'+process.pid);
await fs.mkdir(scratch,{recursive:true});
const data=await bundle(),results=[],started=performance.now();
const exists=async p=>{try{await fs.lstat(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
async function witness(name,command,options={}) {
 const at=performance.now(),controller=new AbortController(),supervisor=createSupervisorForTesting({kind:'cli',signal:controller.signal},{workerURL});
 const transport=createHelperTransport(supervisor),requests=[],output=capture(options.failWrite);
 const destination=command==='verify'?path.join(scratch,'evaluate-a'):path.join(scratch,name);
 const initialVerify=command==='verify'?await fs.readdir(destination):null;
 const caseDirectory=path.join(receiptDirectory,name);await fs.mkdir(caseDirectory);
 const exchange=async frame=>{
   const req=decodeHelperRequest(frame),index=String(req.sequence).padStart(2,'0');
   requests.push({session:req.session,sequence:req.sequence,operation:req.operation,launched:false,responseValidated:false});
   if(options.cancelBeforeSlot===req.sequence)controller.abort();
   await fs.writeFile(path.join(caseDirectory,index+'.request.bin'),frame);
   const before=supervisor.snapshot().helpers;
   try {const result=await transport.exchange(frame);const response=decodeHelperResponse(result.responseBytes,req);
     Object.assign(requests.at(-1),{launched:true,responseValidated:true,exitConfirmed:result.exitConfirmed,status:response.status,roots:response.roots,responseSha256:createHash('sha256').update(result.responseBytes).digest('hex')});
     await fs.writeFile(path.join(caseDirectory,index+'.response.bin'),result.responseBytes);
     if(options.cancelAfterSlot===req.sequence)controller.abort();
     return result;
   } catch(e){requests.at(-1).launched=supervisor.snapshot().helpers>before;throw e;}
 };
 let outcome=null,failure=null;
 try {
   outcome=await orchestrateCli(launchFor(data,destination,command),{supervisor,exchange,stdout:output.stream});
   if(options.expectedError)throw Error('expected operational rejection missing');
   assert.equal(outcome.exitCode,0);
   assert.equal(requests.length,command==='evaluate'?9:4);
   assert.deepEqual(requests.map(r=>r.sequence),Array.from({length:requests.length},(_,i)=>i+1));
   assert.ok(requests.every(r=>r.launched&&r.responseValidated&&r.exitConfirmed));
   assert.equal(new Set(requests.map(r=>r.session)).size,1);
   assert.deepEqual(await fs.readFile(path.join(destination,finalName)),data.resultBytes);
   assert.ok(output.bytes().at(-1)===10);
   if(command==='verify'){assert.deepEqual(await fs.readdir(destination),initialVerify);assert.equal(outcome.committed,false);}
   else assert.deepEqual(await fs.readdir(destination),[finalName]);
 } catch(e){
   failure={code:e.code??null,message:e.message};
   if(e.code!==options.expectedError)throw e;
   assert.equal(output.bytes().length,0);
   if(options.failWrite)assert.deepEqual(await fs.readFile(path.join(destination,finalName)),data.resultBytes);
   if(options.cancelBeforeSlot===9)assert.deepEqual(await fs.readdir(destination),[finalName+'.pending']);
   if(options.cancelBeforeSlot===5||options.cancelAfterSlot===4)assert.equal(await exists(destination),false);
 } finally {
   await supervisor.dispose();
   const snapshot=supervisor.snapshot();
   const startEvents=snapshot.events.filter(e=>e.type==='start'),endEvents=snapshot.events.filter(e=>e.type==='quiescent'||e.type==='cleanup');
   let role=null,overlap=false;
   for(const event of snapshot.events){if(event.type==='start'){if(role!==null)overlap=true;role=event.role;}if(event.type==='quiescent'||(event.type==='cleanup'&&event.confirmed))role=null;}
   const row={name,command,elapsedMs:performance.now()-at,requests,outcome,failure,snapshot,outputBytes:output.bytes().length,noOverlap:!overlap,ownedRoleRemaining:role,verifiedInputSource:'ACTUAL_FIXED_PRODUCTION_POWERSHELL',nativeFrames:true,semanticIntegration:'REVIEWED_FIXED_WORKER_ONLY_NOT_2A_2B_CERTIFICATION'};
   results.push(row);await fs.writeFile(path.join(caseDirectory,'receipt.json'),JSON.stringify(row,null,2)+'\n');
   await fs.writeFile(path.join(caseDirectory,'stdout.data'),output.bytes());
   assert.equal(overlap,false);assert.equal(role,null);assert.equal(snapshot.cleanupConfirmed,true);
   if(!options.expectedError)assert.equal(startEvents.length,endEvents.length);
 }
 if(name==='evaluate-a')await fs.writeFile(path.join(receiptDirectory,'summary-a.data'),output.bytes());
 if(name==='evaluate-b')assert.deepEqual(output.bytes(),await fs.readFile(path.join(receiptDirectory,'summary-a.data')));
}
let result='PASS',failure=null;
try {
 await witness('evaluate-a','evaluate');
 await witness('verify','verify');
 await witness('evaluate-b','evaluate');
 assert.notEqual(results[0].requests[0].session,results[2].requests[0].session);
 await witness('stdout-failure','evaluate',{failWrite:true,expectedError:'MO1307_OUTPUT'});
 await witness('cancel-before-admission','evaluate',{cancelBeforeSlot:9,expectedError:'MO1307_CANCELLED'});
 await witness('cancel-between-helper-worker','evaluate',{cancelAfterSlot:4,expectedError:'MO1307_CANCELLED'});
 await witness('cancel-after-worker','evaluate',{cancelBeforeSlot:5,expectedError:'MO1307_CANCELLED'});
}catch(e){result='FAIL';failure={code:e.code??null,message:e.message,stack:e.stack};}
const receipt={kind:'MO1307FinalNativeSurfaces',result,failure,pid:process.pid,elapsedMs:performance.now()-started,runtime:{node:process.version,platform:process.platform,arch:process.arch},launch:helperLaunchSpecification(),results,syntheticInspectionFrames:false,semanticIntegration:'REVIEWED_FIXED_ENGINEERING_WORKER_NOT_2A_2B_CERTIFICATION'};
await fs.writeFile(path.join(receiptDirectory,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
process.stdout.write(JSON.stringify({result,cases:results.length,helpers:results.reduce((n,r)=>n+r.snapshot.helpers,0),elapsedMs:receipt.elapsedMs,failure})+'\n');process.exitCode=result==='PASS'?0:1;

