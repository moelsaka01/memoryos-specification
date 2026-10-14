import test from 'node:test';import assert from 'node:assert/strict';
import { snapshotApiInput } from '../../memoryos-readiness/src/api-input.mjs';
import { ReadinessError } from '../../memoryos-readiness/src/errors.mjs';
import { canonicalBytes } from '../../memoryos-readiness/src/canonical.mjs';
import { bundle } from '../tools/mo1307-phase2c-resumed/surface-fixture.mjs';
const ready=await bundle();const is=(code,stage)=>e=>e.code==='MO1307_'+code&&e.stage===stage;
test('APIBOOT01 earlier malformed config dominates later oversized evidence',()=>{
 const input={...ready.input,configurationBytes:Buffer.from('{'),files:[{id:'a',bytes:new Uint8Array(2097153)}]};
 assert.throws(()=>snapshotApiInput(input),is('INPUT','CONFIGURATION'));
});
test('APIBOOT02 config shape error dominates wrong authority pin in same phase',()=>{
 const config=JSON.parse(ready.input.configurationBytes);config.extra=true;
 assert.throws(()=>snapshotApiInput({...ready.input,configurationBytes:canonicalBytes(config),trustedAuthorityDigest:'sha256:'+'0'.repeat(64)}),is('CONFIGURATION','CONFIGURATION'));
});
test('APIBOOT03 malformed config dominates oversized authority safely',()=>{
 assert.throws(()=>snapshotApiInput({...ready.input,configurationBytes:Buffer.from('{'),authorityBytes:new Uint8Array(1048577)}),is('INPUT','CONFIGURATION'));
});
test('APIBOOT04 exact manifest ENVELOPE cap applied before bytes copy',()=>{
 const input=structuredClone(ready.input),manifest=JSON.parse(Buffer.from(input.manifestBytes)),index=manifest.entries.findIndex(x=>x.type==='ENVELOPE');
 input.files[index].bytes=new Uint8Array(262145);let iterated=false;input.files[index].bytes[Symbol.iterator]=()=>{iterated=true;throw new Error('must not copy');};
 assert.throws(()=>snapshotApiInput(input),is('RESOURCE_LIMIT','ACQUISITION'));assert.equal(iterated,false);
});
test('APIBOOT05 exact manifest file set checked before copying unknown file',()=>{
 assert.throws(()=>snapshotApiInput({...ready.input,files:[{id:'a',bytes:new Uint8Array(1)}]}),is('INPUT','ACQUISITION'));
});
test('APIBOOT06 snapshots remain detached and byte-identical',()=>{
 const input=structuredClone(ready.input),actual=snapshotApiInput(input);assert.deepEqual(actual,input);
 input.candidateBytes.fill(0);input.files[0].bytes.fill(0);assert.notDeepEqual(actual.candidateBytes,input.candidateBytes);assert.notDeepEqual(actual.files[0].bytes,input.files[0].bytes);
});
for(const code of ['TIMEOUT','CANCELLED'])test('APIBOOT07 '+code+' interruption dominates collected parse errors',()=>{
 let calls=0;assert.throws(()=>snapshotApiInput({...ready.input,configurationBytes:Buffer.from('{')},false,stage=>{
  if(stage==='CONFIGURATION'&&++calls===2)throw new ReadinessError(code,stage);
 }),is(code,'CONFIGURATION'));
});
test('APIBOOT08 hostile typed-array byteLength override is never invoked',()=>{
 const input=structuredClone(ready.input);Object.defineProperty(input.files[0].bytes,'byteLength',{get(){throw new Error('not intrinsic');}});
 const copy=snapshotApiInput(input);assert.equal(copy.files[0].bytes.length,ready.input.files[0].bytes.length);
});
