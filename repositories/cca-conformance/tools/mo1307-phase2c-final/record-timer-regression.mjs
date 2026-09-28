// Documentary read/hash verification of preserved attempts; no product execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const base='repositories/cca-conformance/evidence/mo1307/phase2c-final/';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(root,p));
const bind=p=>{const b=read(p);return{path:p,byteLength:b.length,sha256:hash(b)};};
const receipt=n=>JSON.parse(read(base+`timer-attempt${n}/receipt.json`));
assert.equal(receipt(1).result,'PASS');assert.equal(receipt(2).result,'FAIL');assert.equal(receipt(3).result,'PASS');
const text=read(base+'timer-attempt3/stdout.txt').toString('utf8'),marker='TIMER_WITNESS ';
const line=text.split('\n').find(x=>x.includes(marker));assert.ok(line);
const witnesses=JSON.parse(line.slice(line.indexOf(marker)+marker.length));
assert.equal(witnesses.length,7);assert.ok(witnesses.some(x=>x.name==='stalled-write-cancellation'));
for(const w of witnesses){assert.equal(w.remainingTimers,0);assert.equal(w.callbacksAfterSettlement,0);assert.equal(w.serverOrWatcherResources,0);assert.equal(w.activeRole,null);assert.ok(w.observedTimers>0);}
const binding=JSON.parse(read(base+'timer-attempt3/source-binding-before.json'));
assert.deepEqual(binding,JSON.parse(read(base+'timer-attempt3/source-binding-after.json')));
for(const row of binding)assert.deepEqual(bind(row.path),row);
const failedBinding=JSON.parse(read(base+'timer-attempt2/source-binding-before.json'));
const retained=[['repositories/cca-conformance/tools/mo1307-phase2c-continuation/timer-witness.mjs','timer-attempt2/timer-witness.mjs.data'],['repositories/cca-conformance/tests/mo1307_phase2c_timer_lifetime_test.mjs','timer-attempt2/timer-lifetime-test.mjs.data'],...['publication','runtime','cli'].map(n=>['repositories/memoryos-readiness/src/'+n+'.mjs','timer-defect-source-preservation/'+n+'.mjs.data'])].map(([original,copy])=>{
 const expected=failedBinding.find(x=>x.path===original);assert.ok(expected);const b=read(base+copy);assert.equal(b.length,expected.byteLength);assert.equal(hash(b),expected.sha256);return{original,...bind(base+copy)};
});
const result={kind:'MO1307Phase2CFinalTimerRegression',version:'1.0.0',result:'PASS',authorityCommit:'08de262d1ef3149b6e540bcaea0cf910e02732bd',authorityReview:bind(base+'timer-review.json'),
 attempts:[{number:1,result:'PASS',scope:'Six earlier lifetime cases; narrower coverage and earlier production bytes; not final acceptance.'},{number:2,result:'FAIL',classification:'IMPLEMENTATION_DEFECT',finding:'A staged write intentionally kept unresolved left one polling timer alive after supervisor.dispose and two event-loop turns.',repeatedBeforeFix:false},{number:3,result:'PASS',classification:'FOCUSED_FIXED_REGRESSION',scope:'Same stalled-write failure plus all earlier six cases, bound to corrected production.'}].map(x=>({...x,receipt:bind(base+`timer-attempt${x.number}/receipt.json`)})),
 fix:'CLI stage wait passes its existing opaque publication token to private waitOperation. Initial-checkpoint failure and supervisor stop synchronously call existing recordPublicationInterruption. A private state-owned write-stop callback clears polling and aborts the pending write immediately. No new public export, helper wire field, normative state, deadline or process topology.',
 failureSourcePreservation:retained,sourceBindingsUnchanged:true,boundSourceCount:binding.length,
 rawOutput:bind(base+'timer-attempt3/stdout.txt'),witnesses,
 counts:{topLevelTests:1,passedTopLevelTests:1,sequentialWitnesses:7,totalObservedTimerResources:witnesses.reduce((n,w)=>n+w.observedTimers,0),survivingTimers:0,postSettlementCallbacks:0,serverOrWatcherResources:0},
 witnessScope:'Real owned filesystem I/O and async resource lifetime observation, with synthetic framed identities. The stalled write remains unresolved through disposal and observation; engineering cleanup releases it only afterward. No actual native helper claim.',
 timerInterpretation:'C2FB permits bounded operation/supervisor timers; after final return none survives into later calls. Admitted rename settlement remains unbounded by authority but its one-shot deadline observer ceases after recording interruption; no recurring polling of that rename is introduced.',
 historicalEvidence:'Earlier receipts and stopped reports remain byte-preserved and are not rewritten.'};
fs.writeFileSync(path.join(root,base+'timer-regression.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({result:result.result,...result.counts,failedSourceCopies:retained.length})+'\n');
