// Documentary extraction and source verification only; does not rerun product/tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const base='repositories/cca-conformance/evidence/mo1307/phase2c-final/';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(root,p));
const row=p=>{const b=read(p);return{path:p,byteLength:b.length,sha256:hash(b)};};
const receipt=JSON.parse(read(base+'timer-attempt1/receipt.json'));
assert.equal(receipt.result,'PASS');assert.equal(receipt.tests.tests,1);assert.equal(receipt.tests.pass,1);
const text=read(base+'timer-attempt1/stdout.txt').toString('utf8');
const marker='TIMER_WITNESS ',line=text.split('\n').find(value=>value.includes(marker));assert.ok(line);
const witnesses=JSON.parse(line.slice(line.indexOf(marker)+marker.length));assert.equal(witnesses.length,6);
assert.deepEqual(witnesses.map(x=>x.name),['success-a','write-failure','write-cancellation','rename-failure','post-admission-cancellation','success-b']);
for(const witness of witnesses){assert.equal(witness.remainingTimers,0);assert.equal(witness.callbacksAfterSettlement,0);assert.equal(witness.serverOrWatcherResources,0);assert.equal(witness.activeRole,null);assert.ok(witness.observedTimers>0);}
const bindings=JSON.parse(read(base+'timer-attempt1/source-binding-before.json'));
assert.deepEqual(bindings,JSON.parse(read(base+'timer-attempt1/source-binding-after.json')));
for(const binding of bindings)assert.deepEqual(row(binding.path),binding);
const authority='docs/mo1307-phase2c-finalization-boundary-correction.md',lines=read(authority).toString('utf8').split('\n');
const nativeTest='repositories/cca-conformance/tests/mo1307_phase1_native_test.mjs';
const result={kind:'MO1307Phase2CFinalN24TimerReview',version:'1.0.0',result:'PASS',authorityCommit:'08de262d1ef3149b6e540bcaea0cf910e02732bd',
 authority:{...row(authority),clauses:[96,98].map(line=>({line,quote:lines[line-1].trim()}))},
 disposition:'C2FB explicitly permits invocation-scoped bounded timers and supersedes the unconditional setInterval-token ban; persistent servers, watchers and cross-run recurring work remain forbidden.',
 phase1Reconciliation:{...row(nativeTest),receipt:base+'overlap-phase1-native.json',meaning:'Preserved current actual-helper N15/N17 and exact authorized argv; adopted exact corrected C2FB N24 static prohibition. No test was removed; Phase 1 still requires a separate fresh 105/105 run.'},
 testReceipt:row(base+'timer-attempt1/receipt.json'),rawOutput:row(base+'timer-attempt1/stdout.txt'),boundSourceCount:bindings.length,sourceBytesStillMatch:true,
 observation:'Async resource lifetime observation wraps each actual invocation. Every invocation disposes its supervisor; after two event-loop turns no owned timer remains, and a further outside-context observation interval sees no callbacks or rearming. Six sequential calls include success twice, write failure, write cancellation, rename failure and post-admission cancellation. Real owned file I/O and synthetic framed identities; no native helper certification.',
 extractionNote:'Node TAP escaped the embedded marker as a comment; command receipt timerWitnesses is null. This separate extraction reads the preserved raw log, validates all six rows, and does not alter or rerun that PASS test.',
 witnesses,counts:{topLevelTests:1,passedTopLevelTests:1,sequentialWitnesses:witnesses.length,totalObservedTimerResources:witnesses.reduce((n,x)=>n+x.observedTimers,0),survivingTimers:0,postSettlementCallbacks:0,serverOrWatcherResources:0},
 implementationReview:{runtime:row('repositories/memoryos-readiness/src/runtime.mjs'),publication:row('repositories/memoryos-readiness/src/publication.mjs'),cli:row('repositories/memoryos-readiness/src/cli.mjs'),findings:'Admission uses the mandatory strict checkpoint; admitted finalization awaits actual settlement without a terminal timer race. The deadline timer records once and ceases after interruption. Pre-admission pending-write polling clears immediately on observed interruption. Post-settlement verification and failed/overrun disposition share one fixed allowance. A found deadline-then-abort flag omission was repaired and separately tested by the runtime owner; this review does not replace those actual queued-rename receipts.'},
 scope:'Current bounded-operation lifetime witnesses and direct source review; no claim of a finite admitted native rename settlement bound, no semantic 2A/2B integration, no historical STOP relabeling.'};
fs.writeFileSync(path.join(root,base+'timer-review.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({result:result.result,...result.counts})+'\n');
