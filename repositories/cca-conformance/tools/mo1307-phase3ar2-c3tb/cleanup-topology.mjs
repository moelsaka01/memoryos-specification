// Stage J consumes already executed H/I controls and one scheduled semantic lifecycle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {root,E,identity,record,write} from './common.mjs';
identity();
const [observationPath,tracePath]=process.argv.slice(2);assert.ok(observationPath&&tracePath);
const read=p=>JSON.parse(fs.readFileSync(path.resolve(root,p),'utf8'));
const H=read(path.join(E,'runtime-H/external-proof.json')),HC=read(path.join(E,'runtime-H/receipt.json'));
const I=read(path.join(E,'runtime-I/external-proof.json')),IC=read(path.join(E,'runtime-I/receipt.json'));
const observed=read(observationPath),trace=read(tracePath);
for(const row of [H,HC,I,IC,observed])assert.equal(row.result,'PASS');
assert.deepEqual(HC.cases.map(x=>x.name),['timely-helper','cancel-before-helper','helper-timeout','late-helper-success-rejected','cancel-during-helper','cancel-between-helper-worker','aggregate-helper-exhaustion']);assert.deepEqual(IC.cases.map(x=>x.name),['worker-timeout','worker-cancellation','late-worker-result-rejected','cancel-after-worker-before-publication']);for(const row of [...HC.cases,...IC.cases]){assert.equal(row.result,'PASS');assert.equal(row.error?.code??null,row.expectedError);}
assert.equal(trace.productExit,0);assert.equal(trace.requests.length,9);
assert.equal(trace.supervisors.length,1);
const supervisor=trace.supervisors[0].snapshot;
assert.equal(supervisor.helpers,9);assert.equal(supervisor.workers,1);assert.equal(supervisor.activeRole,null);assert.equal(supervisor.cleanupConfirmed,true);
assert.equal(supervisor.terminalCode,null);
let active=null,starts=0,ends=0;
for(const event of supervisor.events){
 if(event.type==='start'){assert.equal(active,null,'Role overlap');active=event.role;starts++;}
 if(event.type==='quiescent'){assert.equal(active,event.role);active=null;ends++;}
}
assert.equal(active,null);assert.equal(starts,10);assert.equal(ends,10);
const timeout=HC.cases.find(c=>c.name==='helper-timeout');
assert.equal(timeout.error.code,'MO1307_TIMEOUT');assert.equal(timeout.snapshot.cleanupConfirmed,false);
assert.ok(H.timeoutCleanup.killRequestedAt!==null);assert.equal(H.timeoutCleanup.helperObjectSignaled,true);assert.equal(H.timeoutCleanup.consoleObjectsWithinPolicy,true);assert.equal(H.timeoutCleanup.allIdentifiedConsoleObjectsSignaled,true);assert.equal(H.timeoutCleanup.transportClosed,true);assert.equal(H.allKnownObjectsSignaled,true);assert.equal(H.timeoutCleanupTiming.result,'PASS');/* BEGIN exact cleanup allowance relation */
assert.ok(Number.isFinite(H.timeoutCleanupTiming.terminalAtMs)&&H.timeoutCleanupTiming.terminalAtMs>=0);
assert.ok(Number.isFinite(H.timeoutCleanupTiming.cleanupDeadlineAtMs)&&H.timeoutCleanupTiming.cleanupDeadlineAtMs>H.timeoutCleanupTiming.terminalAtMs);
assert.equal(H.timeoutCleanupTiming.cleanupDeadlineAtMs,H.timeoutCleanupTiming.terminalAtMs+2000);
/* END exact cleanup allowance relation */assert.equal(H.timeoutCleanupTiming.transportClosedBeforeCleanupDeadline,true);assert.equal(H.timeoutCleanupTiming.allThreeStreamsClosedBeforeCleanupDeadline,true);assert.equal(H.timeoutCleanupTiming.streamClosures.length,3);assert.equal(H.timeoutCleanupTiming.helperObjectCount,1);assert.ok(H.timeoutCleanupTiming.consoleObjectCount===0||H.timeoutCleanupTiming.consoleObjectCount===1);assert.ok(H.timeoutCleanupTiming.nativeObjects.length===1||H.timeoutCleanupTiming.nativeObjects.length===2);assert.ok(H.timeoutCleanupTiming.nativeObjects.every(x=>x.exitBeforeCleanupDeadline&&x.heldHandleSignaled));
assert.ok(observed.maximumProductRoles<=3);assert.equal(observed.maximumHelpers,1);assert.ok(observed.maximumHelperConsoles<=1);
assert.equal(observed.helperOverlap.length,0);assert.equal(observed.unexplainedDescendants.length,0);
for(const witness of [H,observed]){assert.equal(witness.bootstrapBeforeProductEntry,true);assert.ok(witness.clockBridge.offsetLowerMs<=witness.clockBridge.offsetUpperMs);assert.ok(witness.engineeringBootstrapConsoles.every(x=>BigInt(x.identity.creationTime100ns)<BigInt(witness.bootstrapCutoffNativeUtc100ns)));assert.equal(witness.identityOrSnapshotFailures,0);assert.deepEqual(witness.observationErrors,[]);}assert.equal(H.completeProductObjectAssignment,true);assert.equal(observed.allKnownObjectsSignaled,true);assert.ok(observed.peakSampledProductWorkingSetBytes<=536870912);
const pairs=trace.requests.map(request=>{
 const candidates=observed.helperPairs.filter(p=>p.helper.identity.pid===request.pid);assert.equal(candidates.length,1);
 const pair=candidates[0];assert.ok(pair.helper.signaledAt);assert.ok(pair.consoles.length<=1);assert.ok(pair.consoles.every(console=>console.signaledAt));
 assert.equal(request.transportClosed,true);assert.equal(request.responseAcceptedByTransport,true);assert.equal(request.exitCode,0);
 return {sequence:request.sequence,operation:request.operation,helper:pair.helper.identity,consoles:pair.consoles.map(console=>console.identity),helperSignaled:pair.helper.signaledAt,consoleSignals:pair.consoles.map(console=>console.signaledAt),transportClosed:true};
});
write('cleanup-topology/receipt.json',{kind:'MO1307Phase3AR2FinalCleanupTopology',result:'PASS',stage:'J',inputs:[record(observationPath),record(tracePath),record(path.join(E,'runtime-H/external-proof.json')),record(path.join(E,'runtime-H/receipt.json')),record(path.join(E,'runtime-I/external-proof.json')),record(path.join(E,'runtime-I/receipt.json'))],freshTimeoutProof:H.timeoutCleanup,freshTimeoutTiming:H.timeoutCleanupTiming,timeoutProductCleanupConfirmed:false,allKnownControlObjectsSignaled:H.allKnownObjectsSignaled,acceptedLifecycle:{pairs,supervisors:1,workers:1,serializedRoleStarts:starts,serializedRoleQuiescence:ends,maximumProductRoles:observed.maximumProductRoles,maximumRawProcesses:observed.maximumRawProcesses,engineeringBootstrapConsoles:observed.engineeringBootstrapConsoles,peakSampledProductWorkingSetBytes:observed.peakSampledProductWorkingSetBytes,maximumSampleGapMs:observed.maximumSampleGapMs,identityOrSnapshotFailures:observed.identityOrSnapshotFailures},additionalSemanticExecutions:0,additionalTimeoutExecutions:0,hardRssEnforcement:false,limitations:['The killed helper emits no validated response, so its conservative product cleanupConfirmed remains false; external held-handle signal and stream-close evidence prove actual termination separately.','Only identified object exits are directly proved. Sampling cannot establish complete absence of unknown short-lived descendants.','Raw process totals retain separately attributed engineering bootstrap consoles; source supervisor guards and sampled product roles establish serialized ownership.','Fresh accepted-lifecycle and timeout witnesses do not rewrite previous generations.']});
console.log(JSON.stringify({stage:'J',result:'PASS',additionalExecutions:0}));
