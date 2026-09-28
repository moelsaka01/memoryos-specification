// Supplementary operational witnesses with reviewed framed/worker doubles.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import path from 'node:path';import {Writable}from'node:stream';
import {canonicalBytes}from'../../memoryos-readiness/src/canonical.mjs';
import {createSupervisorForTesting}from'../../memoryos-readiness/src/runtime.mjs';
import {orchestrateCli}from'../../memoryos-readiness/src/cli.mjs';
import {acquireCliInputs}from'../../memoryos-readiness/src/acquisition.mjs';
import {createHelperSequence,decodeHelperRequest,decodeHelperResponse,encodeHelperResponse}from'../../memoryos-readiness/src/helper-protocol.mjs';
import {bundle,root,workerURL,finalName,launchFor,capture,syntheticExchange}from'../tools/mo1307-phase2c-resumed/surface-fixture.mjs';
const scratch=path.join(root,'.cache/mo1307-phase2c-resumed/supplement-'+process.pid);await fs.mkdir(scratch,{recursive:true});
const ready=await bundle();const is=code=>error=>error.code==='MO1307_'+code;
async function run(launch,{signal,now,stream,exchange=syntheticExchange()}={}){
 const supervisor=createSupervisorForTesting({kind:'cli',signal,...(now?{now}:{})},{workerURL});const output=capture();
 try{return{answer:await orchestrateCli(launch,{supervisor,exchange,stdout:stream??output.stream}),stdout:output.bytes(),snapshot:supervisor.snapshot()};}
 finally{await supervisor.dispose();}
}
for(const reason of ['TIMEOUT','CANCELLED'])test(`SUP01 post-rename ${reason} returns OUTPUT and retains exact committed result`,async()=>{
 const dest=path.join(scratch,'post-'+reason),controller=new AbortController();let time=0,written=false;
 const stream=new Writable({write(_chunk,_encoding,callback){written=true;if(reason==='TIMEOUT')time=30000;else controller.abort();callback();}});stream.on('error',()=>{});
 await assert.rejects(run(launchFor(ready,dest),{signal:controller.signal,now:()=>time,stream}),is('OUTPUT'));
 assert.equal(written,true);assert.deepEqual(await fs.readFile(path.join(dest,finalName)),ready.resultBytes);assert.deepEqual(await fs.readdir(dest),[finalName]);
});
test('SUP02 verify stdout backpressure times out without product filesystem changes',async()=>{
 const dest=path.join(scratch,'verify-backpressure');await fs.mkdir(dest);await fs.writeFile(path.join(dest,finalName),ready.resultBytes);const before=await fs.readFile(path.join(dest,finalName));let time=0;
 const stream=new Writable({write(_chunk,_encoding,_callback){time=30000;}});stream.on('error',()=>{});
 await assert.rejects(run(launchFor(ready,dest,'verify'),{now:()=>time,stream}),is('TIMEOUT'));
 assert.equal(stream.destroyed,true);assert.deepEqual(await fs.readdir(dest),[finalName]);assert.deepEqual(await fs.readFile(path.join(dest,finalName)),before);
});
test('SUP03 input root identity change between helper slots fails closed',async()=>{
 const base=syntheticExchange(),seen=[];const exchange=async frame=>{const request=decodeHelperRequest(frame);seen.push(request.sequence);const answer=await base(frame);const response=decodeHelperResponse(answer.responseBytes,request);
  if(request.sequence===2)response.roots[0].identity.fileId='000000000000ffff';return{...answer,responseBytes:encodeHelperResponse(response,request)};
 };
 await assert.rejects(acquireCliInputs(launchFor(ready,path.join(scratch,'root-change')),createHelperSequence('evaluate'),exchange,()=>{}),is('FILESYSTEM_BOUNDARY'));assert.deepEqual(seen,[1,2]);
});
test('SUP04 physical file alias across bootstrap slots is rejected despite distinct paths',async()=>{
 const base=syntheticExchange(),seen=[];let authorityIdentity;const exchange=async frame=>{const request=decodeHelperRequest(frame);seen.push(request.sequence);const answer=await base(frame);const response=decodeHelperResponse(answer.responseBytes,request);
  if(request.sequence===1)authorityIdentity=response.files.find(f=>f.id==='authority').identity;
  if(request.sequence===2)Object.assign(response.files.find(f=>f.id==='candidate').identity,{fileId:authorityIdentity.fileId,volumeSerial:authorityIdentity.volumeSerial});
  return{...answer,responseBytes:encodeHelperResponse(response,request)};
 };
 await assert.rejects(acquireCliInputs(launchFor(ready,path.join(scratch,'file-alias')),createHelperSequence('evaluate'),exchange,()=>{}),is('FILESYSTEM_BOUNDARY'));assert.deepEqual(seen,[1,2]);
});
async function decisionCase(name,decisionName){
 const data=await bundle(name),input=path.join(scratch,decisionName+'-input'),dest=path.join(scratch,decisionName+'-result');await fs.cp(data.directory,input,{recursive:true});await fs.mkdir(dest);await fs.writeFile(path.join(dest,finalName),data.resultBytes);
 const result=JSON.parse(data.resultBytes),decision={kind:'MemoryOSReadinessHumanDecision',version:'1.0.0',candidateDigest:result.assessment.candidateDigest,readinessDigest:result.readinessDigest,proofBindingDigest:result.proofBindingDigest,decision:'APPROVE',reason:'Private reason sentinel',actor:'unverified actor',timestamp:null,authenticity:'NOT_VERIFIED_BY_MEMORYOS',attestation:null};
 return{data,input,dest,decision,launch:launchFor({...data,directory:input},dest,'verify','decision.json')};
}
test('SUP05 malformed external decision rejects without stdout or changes',async()=>{
 const fixture=await decisionCase('ready','malformed-decision');await fs.writeFile(path.join(fixture.input,'decision.json'),'{}\n');await assert.rejects(run(fixture.launch),is('DECISION_MISMATCH'));
 assert.deepEqual(await fs.readFile(path.join(fixture.dest,finalName)),fixture.data.resultBytes);
});
test('SUP06 wrong external decision proof binding rejects',async()=>{
 const fixture=await decisionCase('ready','wrong-proof');fixture.decision.proofBindingDigest='sha256:'+'0'.repeat(64);await fs.writeFile(path.join(fixture.input,'decision.json'),canonicalBytes(fixture.decision));await assert.rejects(run(fixture.launch),is('DECISION_MISMATCH'));
 assert.deepEqual(await fs.readFile(path.join(fixture.dest,finalName)),fixture.data.resultBytes);
});
for(const name of ['not-ready','could-not-evaluate'])test('SUP07 contrary APPROVE preserves '+name+' and reports unverified authenticity',async()=>{
 const fixture=await decisionCase(name,'contrary-'+name);await fs.writeFile(path.join(fixture.input,'decision.json'),canonicalBytes(fixture.decision));const result=await run(fixture.launch),summary=JSON.parse(result.stdout);
 assert.equal(result.answer.exitCode,0);assert.equal(summary.readiness,JSON.parse(fixture.data.resultBytes).assessment.readiness);assert.deepEqual(summary.decision,{authenticity:'NOT_VERIFIED_BY_MEMORYOS',consistency:'CONTRARY_TO_READINESS',decision:'APPROVE'});
 assert.equal(result.stdout.includes('sentinel'),false);assert.equal(result.stdout.includes('unverified actor'),false);assert.deepEqual(await fs.readFile(path.join(fixture.dest,finalName)),fixture.data.resultBytes);
});
test('SUP08 slot4 output inspection ERROR maps to frozen OUTPUT before worker',async()=>{
 const base=syntheticExchange(),seen=[];const exchange=async frame=>{const request=decodeHelperRequest(frame);seen.push(request.sequence);if(request.sequence!==4)return base(frame);
  return{exitConfirmed:true,responseBytes:encodeHelperResponse({kind:'MemoryOSReadinessHelperResponse',version:'2.0.0',session:request.session,sequence:4,operation:'CHECK_OUTPUT',status:'ERROR',code:'MO1307_FILESYSTEM_BOUNDARY',roots:[],files:[]},request)};
 };
 const dest=path.join(scratch,'slot4-error');await assert.rejects(run(launchFor(ready,dest),{exchange}),is('OUTPUT'));assert.deepEqual(seen,[1,2,3,4]);await assert.rejects(fs.stat(dest),e=>e.code==='ENOENT');
});
