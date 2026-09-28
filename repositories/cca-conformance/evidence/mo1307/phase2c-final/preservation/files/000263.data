// Engineering-only publication witnesses: framed synthetic identities deliberately
// do not claim native acquisition. Owned files are retained after every attempt.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { createPublicationInspection, decodeHelperRequest, encodeHelperResponse } from '../../memoryos-readiness/src/helper-protocol.mjs';
import { fileURLToPath } from 'node:url';
import { ReadinessError } from '../../memoryos-readiness/src/errors.mjs';
import { createPublication, stagePublication, finalizePublication } from '../../memoryos-readiness/src/publication.mjs';
import { fixtureInspection, fixtureInspect, fixtureResponse, completedAcquisition, finalName, pendingName } from '../tools/mo1307-phase2c-correction/publication-fixture.mjs';
const base = fileURLToPath(new URL(`../../../.cache/mo1307/phase2c-resumed/publication-${process.pid}/`, import.meta.url));
const rejects = fn => assert.rejects(fn, e => e.code === 'MO1307_OUTPUT');
async function fresh(name) { await fs.mkdir(base,{recursive:true}); const root=path.join(base,name); const inspection=await fixtureInspection(root); const token=await createPublication(root,{inspection}); return {root,token}; }
test('PTERM01 a rejected second staging terminally consumes publication',async()=>{
 const {root,token}=await fresh('second-stage'); await stagePublication(token,Buffer.from('{}\n'));
 await rejects(()=>stagePublication(token,Buffer.from('{}\n')));
 await rejects(()=>finalizePublication(token));
 assert.deepEqual(await fs.readdir(root),[pendingName]);
});
test('PTERM02 premature finalization consumes token before later staging',async()=>{
 const {root,token}=await fresh('premature-finalize'); await rejects(()=>finalizePublication(token));
 await rejects(()=>stagePublication(token,Buffer.from('{}\n')));
 assert.deepEqual(await fs.readdir(root),[]);
});const fields={
 attributes:x=>x.attributes^32,
 byteLength:x=>x.byteLength+1,
 fileId:x=>x.fileId==='000000000000ffff'?'000000000000fffe':'000000000000ffff',
 finalPath:x=>(x.finalPath[0]==='C'?'c':'C')+x.finalPath.slice(1),
 isDirectory:x=>!x.isDirectory,
 linkCount:x=>x.linkCount+1,
 volumeSerial:x=>x.volumeSerial==='000000ff'?'000000fe':'000000ff',
};
const operationFor={5:'CHECK_OUTPUT',6:'INSPECT_OUTPUT_ROOT',7:'CHECK_STAGE_ROOT',8:'INSPECT_PENDING',9:'CHECK_FINALIZATION'};
async function location(name){await fs.mkdir(base,{recursive:true});return path.join(base,name);}
async function noFinal(root){assert.equal(existsSync(path.join(root,finalName)),false);}
for(const slot of [5,6,7,8,9])for(const [field,change]of Object.entries(fields))test(`PCHAIN${slot}-${field} all-field cross-slot stability rejects changed ${field}`,async()=>{
 const root=await location(`s${slot}-${field}`);let phase=null;
 const inspection=await fixtureInspection(root,{observe:req=>{phase=req.operation;},inspect:async(...args)=>{
  const chain=await fixtureInspect(...args);if(phase===operationFor[slot]){
   const item=chain.at(slot===6||slot===8?-2:-1);item[field]=change(item);
  }return chain;
 }});
 await rejects(async()=>{const token=await createPublication(root,{inspection});await stagePublication(token,Buffer.from('{}\n'));await finalizePublication(token);});
 await noFinal(root);
});
test('PNEG01 pending native byteLength must equal staged detached bytes',async()=>{
 const root=await location('pending-length');let phase=null;
 const inspection=await fixtureInspection(root,{observe:req=>{phase=req.operation;},inspect:async(...args)=>{
  const chain=await fixtureInspect(...args);if(phase==='INSPECT_PENDING')chain.at(-1).byteLength++;return chain;
 }});const token=await createPublication(root,{inspection});await rejects(()=>stagePublication(token,Buffer.from('{}\n')));
 await rejects(()=>finalizePublication(token));assert.deepEqual(await fs.readdir(root),[pendingName]);
});
test('PNEG02 wrong root branded capability cannot mutate either destination',async()=>{
 const one=await location('wrong-root-one'),two=await location('wrong-root-two');const inspection=await fixtureInspection(one);
 await rejects(()=>createPublication(two,{inspection}));assert.equal(existsSync(one),false);assert.equal(existsSync(two),false);
});
test('PNEG03 foreign capability and legacy callback cannot create a directory',async()=>{
 const root=await location('foreign-cap');await rejects(()=>createPublication(root,{inspection:{}}));
 await rejects(()=>createPublication(root,{inspect:fixtureInspect}));assert.equal(existsSync(root),false);
});
test('PNEG04 foreign token never authorizes staging or finalization',async()=>{
 for(const token of [{},Object.freeze({}),null,undefined,'token']){await rejects(()=>stagePublication(token,Buffer.from('{}\n')));await rejects(()=>finalizePublication(token));}
});
test('PNEG05 second capability claim terminates original token',async()=>{
 const root=await location('second-claim'),inspection=await fixtureInspection(root);const token=await createPublication(root,{inspection});
 await rejects(()=>createPublication(root,{inspection}));await rejects(()=>stagePublication(token,Buffer.from('{}\n')));await noFinal(root);
});
test('PNEG06 second finalization preserves committed exact file and cannot rename again',async()=>{
 const {root,token}=await fresh('second-finalize');await stagePublication(token,Buffer.from('{}\n'));await finalizePublication(token);
 await rejects(()=>finalizePublication(token));assert.deepEqual(await fs.readdir(root),[finalName]);assert.equal(await fs.readFile(path.join(root,finalName),'utf8'),'{}\n');
});
test('PNEG07 same-length changed pending bytes fail final reread before slot9',async()=>{
 const {root,token}=await fresh('pending-tamper');await stagePublication(token,Buffer.from('{}\n'));await fs.writeFile(path.join(root,pendingName),'[]\n');
 await rejects(()=>finalizePublication(token));assert.deepEqual(await fs.readdir(root),[pendingName]);
});
test('PNEG08 preexisting pending file is never overwritten and remains diagnostic evidence',async()=>{
 const {root,token}=await fresh('pending-collision');await fs.writeFile(path.join(root,pendingName),'sentinel');
 await rejects(()=>stagePublication(token,Buffer.from('{}\n')));assert.equal(await fs.readFile(path.join(root,pendingName),'utf8'),'sentinel');await noFinal(root);
});
test('PNEG09 preexisting final file causes failure and remains byte-identical',async()=>{
 const {root,token}=await fresh('final-collision');await stagePublication(token,Buffer.from('{}\n'));await fs.writeFile(path.join(root,finalName),'sentinel');
 await rejects(()=>finalizePublication(token));assert.equal(await fs.readFile(path.join(root,finalName),'utf8'),'sentinel');assert.ok(existsSync(path.join(root,pendingName)));
});
test('PNEG10 existing output directory cannot be claimed or overwritten',async()=>{
 const root=await location('existing-root'),inspection=await fixtureInspection(root);await fs.mkdir(root);await fs.writeFile(path.join(root,'sentinel'),'retained');
 await rejects(()=>createPublication(root,{inspection}));assert.deepEqual(await fs.readdir(root),['sentinel']);
});
for(const code of ['TIMEOUT','CANCELLED'])test(`PNEG11-${code} immediate pre-rename checkpoint is terminal`,async()=>{
 const root=await location(`pre-rename-${code}`);let finalObserved=false,checks=0;
 const inspection=await fixtureInspection(root,{observe:req=>{if(req.sequence===9)finalObserved=true;},checkpoint:()=>{if(finalObserved&&++checks===2)throw new ReadinessError(code,'PUBLICATION');}});
 const token=await createPublication(root,{inspection});await stagePublication(token,Buffer.from('{}\n'));
 await assert.rejects(()=>finalizePublication(token),e=>e.code===`MO1307_${code}`);assert.deepEqual(await fs.readdir(root),[pendingName]);await rejects(()=>finalizePublication(token));
});
for(const point of ['before-write','after-write'])test(`PNEG12-${point} cancellation retains owned pending bytes without publishing`,async()=>{
 const root=await location(`write-${point}`),pending=path.join(root,pendingName);
 const inspection=await fixtureInspection(root,{checkpoint:()=>{if(existsSync(pending)&&(point==='before-write'||statSync(pending).size>0))throw new ReadinessError('CANCELLED','PUBLICATION');}});
 const token=await createPublication(root,{inspection});await assert.rejects(()=>stagePublication(token,Buffer.from('{}\n')),e=>e.code==='MO1307_CANCELLED');
 assert.deepEqual(await fs.readdir(root),[pendingName]);assert.equal((await fs.stat(pending)).size,point==='before-write'?0:3);await rejects(()=>finalizePublication(token));
});
test('PNEG13 in-flight staging cannot revive token after concurrent staging rejection',async()=>{
 const root=await location('concurrent-stage');let release,blocked;const entered=new Promise(resolve=>{blocked=resolve;});let pause=false;
 const inspection=await fixtureInspection(root,{observe:req=>{pause=req.sequence===7;},inspect:async(...args)=>{
  if(pause){blocked();await new Promise(resolve=>{release=resolve;});}return fixtureInspect(...args);
 }});const token=await createPublication(root,{inspection});const inFlight=stagePublication(token,Buffer.from('{}\n'));await entered;
 await rejects(()=>stagePublication(token,Buffer.from('{}\n')));release();await rejects(()=>inFlight);await rejects(()=>finalizePublication(token));assert.deepEqual(await fs.readdir(root),[]);
});
test('PNEG14 wrong session from framed transport aborts sequence and cannot publish',async()=>{
 const root=await location('wrong-session'),parent=path.win32.dirname(root);const sequence=completedAcquisition('evaluate',root,'0'.repeat(64),await fixtureInspect(parent));
 sequence.beginWorker();sequence.endWorker();const inspection=createPublicationInspection(sequence,root,{checkpoint:()=>{},exchange:async encoded=>{
  const request=decodeHelperRequest(encoded),changed={...request,session:'1'.repeat(64)};
  return{responseBytes:encodeHelperResponse(fixtureResponse(changed,await fixtureInspect(parent)),changed),exitConfirmed:true};
 }});await rejects(()=>createPublication(root,{inspection}));assert.equal(existsSync(root),false);
});
test('PDET01 staging snapshots caller bytes before async work',async()=>{
 const {root,token}=await fresh('detached');const bytes=Buffer.from('{}\n');const staged=stagePublication(token,bytes);bytes.fill(0);await staged;await finalizePublication(token);
 assert.equal(await fs.readFile(path.join(root,finalName),'utf8'),'{}\n');
});
test('PDET02 changing roots and assessment sessions does not alter exact published bytes',async()=>{
 const results=[];for(const n of [1,2]){
  const root=await location(`determinism-${n}`),parent=path.win32.dirname(root);
  const sequence=completedAcquisition('evaluate',root,String(n).repeat(64),await fixtureInspect(parent));sequence.beginWorker();sequence.endWorker();
  const inspection=createPublicationInspection(sequence,root,{checkpoint:()=>{},exchange:async encoded=>{
   const request=decodeHelperRequest(encoded),pending=['INSPECT_PENDING','CHECK_FINALIZATION'].includes(request.operation);
   if(request.operation==='CHECK_OUTPUT')assert.equal(existsSync(root),false);
   if(request.operation==='CHECK_FINALIZATION')assert.equal(existsSync(path.join(root,finalName)),false);
   const chain=await fixtureInspect(request.operation==='CHECK_OUTPUT'?parent:root,pending?pendingName:null);
   return{responseBytes:encodeHelperResponse(fixtureResponse(request,chain),request),exitConfirmed:true};
  }});const token=await createPublication(root,{inspection});await stagePublication(token,Buffer.from('{"fixed":true}\n'));await finalizePublication(token);results.push(await fs.readFile(path.join(root,finalName)));
 }
 assert.deepEqual(results[0],results[1]);
});

test('PTERM03 concurrent rejection during final reread cannot launch slot9',async()=>{
 const root=await location('concurrent-final-read'),seen=[];const inspection=await fixtureInspection(root,{observe:req=>seen.push(req.sequence)});
 const token=await createPublication(root,{inspection});await stagePublication(token,Buffer.from('{}\n'));
 const original=fs.open;let opened,release;const entered=new Promise(resolve=>{opened=resolve;});
 fs.open=async(...args)=>{const handle=await original(...args);if(args[1]==='r'&&args[0]===path.join(root,pendingName)){
  const close=handle.close.bind(handle);handle.close=async()=>{await close();opened();await new Promise(resolve=>{release=resolve;});};
 }return handle;};
 try{const inFlight=finalizePublication(token);await entered;await rejects(()=>finalizePublication(token));release();await rejects(()=>inFlight);}
 finally{fs.open=original;}
 assert.deepEqual(seen,[5,6,7,8]);assert.deepEqual(await fs.readdir(root),[pendingName]);
});
test('PTERM04 concurrent rejection during pending close cannot launch slot8',async()=>{
 const root=await location('concurrent-stage-close'),seen=[];const inspection=await fixtureInspection(root,{observe:req=>seen.push(req.sequence)});
 const token=await createPublication(root,{inspection});const original=fs.open;let closed,release;const entered=new Promise(resolve=>{closed=resolve;});
 fs.open=async(...args)=>{const handle=await original(...args);if(args[1]==='wx+'&&args[0]===path.join(root,pendingName)){
  const close=handle.close.bind(handle);handle.close=async()=>{await close();closed();await new Promise(resolve=>{release=resolve;});};
 }return handle;};
 try{const inFlight=stagePublication(token,Buffer.from('{}\n'));await entered;await rejects(()=>stagePublication(token,Buffer.from('{}\n')));release();await rejects(()=>inFlight);}
 finally{fs.open=original;}
 assert.deepEqual(seen,[5,6,7]);assert.deepEqual(await fs.readdir(root),[pendingName]);
});
