import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';
import {root,readCanonical,artifact,reference,validateReceipt,validateInventory,validateSample,git} from '../tools/mo1305-evidence.mjs';
import {validateChunk} from '../tools/mo1305-phase1/sample-proof.mjs';
import {J} from '../../memoryos-rest/src/serialization.mjs';
const inventoryPath=resolve(root,'repositories/cca-conformance/mo1305-conformance-inventory.json');
function validateCurrent(value){const subject=git('show','-s','--format=%s','HEAD');return validateInventory(value,subject==='conformance(memoryos-1.3): bind MO-1305 phase 1 foundation'?{role:'B1',revision:git('rev-parse','HEAD')}:value.state==='PHASE1_BOUND'?{role:'B1_PREPARED'}:{role:'I1'});}
function inventory(){return readCanonical(inventoryPath,262144);}
function receipt(type){return readCanonical(resolve(root,inventory().receipts[type][0].path));}
const scratch=' .cache/mo1305-conformance-negative'.trim();mkdirSync(resolve(root,scratch),{recursive:true});
function temporary(id,value){const path=scratch+'/'+id+'.json';writeFileSync(resolve(root,path),typeof value==='string'?value:J(value));return reference(path);}

test('MO-1305 Phase 1 inventory, actual artifacts and external binding graph agree',()=>{
 validateCurrent(inventory());
});
test('Phase 1 receipts prove every resource, functional, boundary, stress, parity, package, HTTP and security case',()=>{
 for(const type of ['resource','package','http','security','functional','boundary','stress','parity','installation','supplyChain'])validateReceipt(receipt(type));
});
test('receipt schema rejects unknown, missing, false PASS and malformed nested fields',()=>{
 const original=receipt('resource');
 for(const mutate of [r=>r.unknown=true,r=>delete r.sourceTreeSha256,r=>r.payload.unknown=true,r=>r.platform.ubuntu='PASS',r=>r.results[0].actual.failures=1,r=>r.results[0].state='FAIL',r=>r.results[0].artifactRefs[0]={path:'../escape',byteLength:0,sha256:'0'.repeat(64)}]){
  const changed=structuredClone(original);mutate(changed);assert.throws(()=>validateReceipt(changed,{checkArtifacts:false,checkRevisions:false}));
 }
});
test('canonical reader rejects duplicate keys, trailing newline, floats and excess depth',()=>{
 for(const [i,value] of ['{"x":1,"x":1}','{"x":1}\n','{"x":1.0}','['.repeat(17)+'0'+']'.repeat(17)].entries()){const ref=temporary('canonical-'+i,value);assert.throws(()=>readCanonical(resolve(root,ref.path)));}
});
test('artifact verifier rejects wrong hashes, missing files, absolute paths and traversal',()=>{
 const valid=inventory().contracts.apiSchema;artifact(valid);
 for(const change of [{sha256:'0'.repeat(64)},{byteLength:valid.byteLength+1},{path:'C:/private'},{path:'../private'},{path:'.cache/does-not-exist-mo1305'}])assert.throws(()=>artifact({...valid,...change}));
});
test('resource gate rejects a removed catalog case and weakened final memory budget',()=>{
 for(const variant of ['missing-case','weakened-limit']){
  const changed=structuredClone(receipt('resource'));
  if(variant==='missing-case'){const campaign=JSON.parse(artifact(changed.payload.derivation.campaign));campaign.vectors.pop();changed.payload.derivation.campaign=temporary(variant,campaign);}
  else{const limits=readCanonical(resolve(root,changed.payload.limits.path));limits.measured.workerYoungMiB++;changed.payload.limits=temporary(variant,limits);}
  assert.throws(()=>validateReceipt(changed));
 }
});
test('package and inventory reject archive/revision mismatch and missing Windows state',()=>{
 const p=structuredClone(receipt('package'));p.payload.archive.sha256='0'.repeat(64);assert.throws(()=>validateReceipt(p));
 for(const mutate of [v=>v.implementations.I1='f'.repeat(40),v=>v.platforms=[],v=>v.platformPolicy.ubuntu='REQUIRED',v=>v.implementations.I2='f'.repeat(40)]){const v=structuredClone(inventory());mutate(v);assert.throws(()=>validateCurrent(v));}
});

test('execution receipts reject PASS projections over failed or unrelated raw runs',()=>{
 for(const variant of ['failed-raw','unrelated-execution']){
  const changed=structuredClone(receipt('http')),run=readCanonical(resolve(root,changed.payload.local.path));
  if(variant==='failed-raw'){const raw=JSON.parse(artifact(run.provenance.rawResults));raw.status='FAIL';run.provenance.rawResults=temporary(variant+'-raw',raw);}
  else{const execution=readCanonical(resolve(root,run.provenance.execution.path));execution.binding.sourceTreeSha256='0'.repeat(64);run.provenance.execution=temporary(variant+'-run',execution);}
  changed.payload.local=temporary(variant,run);assert.throws(()=>validateReceipt(changed));
 }
});

test('native measurement windows must contain real captures before and after each request',()=>{
 const r=receipt('resource'),aggregate=JSON.parse(artifact(r.payload.derivation.campaign)),v=JSON.parse(artifact(aggregate.vectors[0])),member=v.members[0],progress=JSON.parse(readFileSync(resolve(root,'repositories/cca-conformance/evidence/mo1305-phase1-r6/resource/progress.json'))),row=JSON.parse(artifact(member.source)).records[member.recordIndex];validateSample(row);
 for(const mutate of [s=>delete s.nativeWindow,s=>s.nativeWindow.baseline.received.ns=(BigInt(s.nativeWindow.requestStart.ns)+1n).toString(),s=>s.nativeWindow.cleanup.requestedTicket=s.nativeWindow.baseline.requestedTicket,s=>s.nativeWindow.baseline.afterSequence=s.nativeWindow.baseline.sequence,s=>s.native.count=1]){const changed=structuredClone(row);mutate(changed);assert.throws(()=>validateSample(changed));}
 const chunk=JSON.parse(artifact(member.source));for(const mutate of [c=>c.records[0].provenance.pid++,c=>c.records[0].provenance.campaignId='00000000-0000-0000-0000-000000000000',c=>c.records[0].native.peak.WorkingSetSize++,c=>c.runs[0].exitCode=1]){const changed=structuredClone(chunk);mutate(changed);assert.throws(()=>validateChunk(changed,progress,ref=>JSON.parse(artifact(ref))));}
});


test('bounded methodology rejects obsolete sample counts, wrong correction and weakened stress coverage',()=>{
 for(const mutate of [r=>r.verificationCorrectionRevision='c2e3835b852fd966046ac9e984538fdcaf8b26bf',r=>r.payload.derivation.methodologyVersion='1.0.0',r=>r.results[0].actual.coldSamples=30,r=>r.results[0].actual.warmSamples=100]){const changed=structuredClone(receipt('resource'));mutate(changed);assert.throws(()=>validateReceipt(changed));}
 const r=structuredClone(receipt('stress')),progress=readCanonical(resolve(root,r.payload.confirmation.path));progress.completed.pop();r.payload.confirmation=temporary('missing-stress-repeat',progress);assert.throws(()=>validateReceipt(r));
});
