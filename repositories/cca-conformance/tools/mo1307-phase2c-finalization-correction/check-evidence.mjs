// Closed, current-source acceptance selection. Failed engineering attempts stay retained.
import assert from 'node:assert/strict';
import {evidence,json,check,record,write} from './common.mjs';
import {packageFiles} from '../mo1307-phase1/package.mjs';
export const finalPaths=Object.freeze({campaign:'campaigns/attempt-2/receipt.json',queued:'campaigns/attempt-2/queued/receipt.json',
  regression:'shared-regression/attempt-1/receipt.json',compatibility:'compatibility/attempt1/matrix.json',
  diagnostic:'diagnostic-binding.json',security:'security-review.json',n24:'n24-disposition.json',
  impossibility:'impossibility-analysis.json',alternatives:'alternatives-analysis.json'});
const get=p=>json(evidence+'/'+p);
const relativeCheck=(base,m)=>check({...m,path:base+'/'+m.path});
export function checkCampaign(base) {
  const campaign=json(base+'/campaign.json'),receipt=json(base+'/receipt.json'),queued=json(base+'/queued/receipt.json');
  assert.equal(receipt.result,'PASS');assert.equal(receipt.sourceInputsUnchanged,true);
  for(const m of receipt.sourceBindingsAfter)check(m);
  for(const m of campaign.sourceBindings){check(m);relativeCheck(base,m.retained);}
  assert.equal(receipt.receipts.length,2);
  for(const r of receipt.receipts){assert.equal(r.result,'PASS');assert.equal(r.exitCode,0);for(const m of r.logs)relativeCheck(base,m);}
  assert.deepEqual(receipt.receipts[0].counts,{tests:24,pass:24,fail:0,cancelled:0,skipped:0});
  assert.equal(queued.result,'PASS');assert.equal(queued.renameRequests,1);assert.equal(queued.noEarlyTimeoutOrCancellation,true);
  assert.ok(queued.submittedAtMs<queued.admissionDeadlineAtMs);assert.ok(queued.observation.elapsedMs>=queued.admissionDeadlineAtMs);
  assert.equal(queued.observation.statusBefore.phase,'COMMIT_IN_PROGRESS');assert.equal(queued.observation.finalizeSettled,false);
  assert.equal(queued.observation.finalPresent,false);assert.equal(queued.observation.pendingPresent,true);
  assert.equal(queued.finalStatus.phase,'COMMITTED');assert.equal(queued.finalStatus.namespaceVerified,true);
  assert.equal(queued.finalStatus.deadlineExpiredAfterAdmission,true);assert.equal(queued.finalStatus.cancelledAfterAdmission,true);
  assert.equal(queued.finalPresent,true);assert.equal(queued.pendingPresent,false);assert.equal(queued.sameBytes,true);
  assert.equal(queued.transportError,'MO1307_OUTPUT');assert.equal(queued.settlementBoundClaimed,false);
  return {focusedGroups:24,queuedRenameRequests:1};
}
export function checkRegression(base) {
  const campaign=json(base+'/campaign.json'),receipt=json(base+'/receipt.json');
  assert.equal(receipt.result,'PASS');assert.equal(receipt.sourcesUnchanged,true);for(const m of campaign.sources)check(m);
  for(const c of receipt.commands){assert.equal(c.result,'PASS');check(c.stdout);check(c.stderr);}
  const prior=receipt.commands.find(c=>c.id==='prior-correction');assert.equal(prior.tests.pass,24);
  check(receipt.phase1Receipt);const phase1=json(receipt.phase1Receipt.path);
  assert.equal(phase1.result,'PASS');assert.ok(phase1.commands.every(c=>c.result==='PASS'));
  const tests=phase1.commands.find(c=>c.id==='phase1-tests').tests;
  assert.deepEqual(tests,{count:105,pass:105,fail:0,cancelled:0,skipped:0,todo:0});
  for(const id of ['schemas','fixtures','package','workspace','diff-check'])assert.ok(phase1.commands.some(c=>c.id===id&&c.result==='PASS'));
  return {phase1Tests:105,priorCorrectionGroups:24};
}
export function checkCompatibility(base) {
  const matrix=json(base+'/matrix.json');assert.equal(matrix.result,'PASS');check(matrix.runner);
  for(const m of matrix.correctedSourceBindings)check(m);
  assert.deepEqual(matrix.streams.map(s=>[s.stream,s.classification,s.tests.pass,s.exactAcceptedVectors]),
    [['2a','UNCHANGED_REUSABLE',84,16],['2b','UNCHANGED_REUSABLE',172,16]]);
  assert.deepEqual(matrix.streams.map(s=>s.commit),['b628349b4e678a8f71086b1b5c807ffe2edf9a5d','b2877ab32c317bb67896414ba9cec64f6f436ca5']);
  for(const stream of matrix.streams){const receipt=json(base+'/'+stream.receipt);assert.equal(receipt.result,'PASS');
    for(const key of ['stream','commit','classification','exactAcceptedVectors'])assert.equal(receipt[key],stream[key]);
    assert.deepEqual(receipt.tests.counts,stream.tests);
    assert.equal(receipt.sourceWorktree.modified,false);assert.deepEqual(receipt.sourceWorktree.before,receipt.sourceWorktree.after);
    relativeCheck(base,receipt.tests.stdout);relativeCheck(base,receipt.tests.stderr);}
  return {compatibilityTests:256,exactCompatibilityVectors:32};
}
export function checkFinalEvidence() {
  const tests=checkCampaign(evidence+'/campaigns/attempt-2'),regression=checkRegression(evidence+'/shared-regression/attempt-1');
  const compatibility=checkCompatibility(evidence+'/compatibility/attempt1');
  const diagnostic=get(finalPaths.diagnostic);assert.equal(diagnostic.result,'DIAGNOSTIC_CONFIRMED');
  assert.equal(diagnostic.actualOutstandingMutationConfirmed,true);assert.equal(diagnostic.mereCallbackDelayRejected,true);
  assert.equal(diagnostic.changedFilesIncludingInventory,593);
  // Review documents are evidence, not a claim of completing the dirty native implementation.
  const expected={security:['disposition','TARGETED_FOUNDATION_REVIEW_PASS_WITH_RETAINED_AVAILABILITY_LIMIT'],
    n24:['result','PASS_TARGETED_FOUNDATION'],impossibility:['result','CLOSED_CONDITIONAL_CONTRACT_CONFLICT'],
    alternatives:['result','SMALLEST_COHERENT_MODEL_SELECTED']};
  for(const name of ['security','n24','impossibility','alternatives']){
    const review=get(finalPaths[name]);assert.equal(review[expected[name][0]],expected[name][1],name);
    for(const key of ['sourceBindings','acceptanceBindings'])for(const m of review[key]??[])check(m);
    if(name==='security'){assert.equal(review.threats.length,13);assert.ok(review.threats.every(t=>t.testGroups.length>0));}
    if(name==='alternatives')assert.equal(review.alternatives.length,7);
    if(name==='n24')assert.equal(review.lifetimeTests.length,6);
  }
  return {...tests,...regression,...compatibility,diagnostic:'BOUND',N24:'RESOLVED',nativePhase2CComplete:false,
    receipts:Object.fromEntries(Object.entries(finalPaths).map(([name,p])=>[name,record(evidence+'/'+p)]))};
}
export function checkSealedEvidence(){const seal=get('final-validation.json');assert.equal(seal.result,'PASS');
  assert.deepEqual(seal.receipts,checkFinalEvidence().receipts);
  assert.deepEqual(seal.validatedPackage.map(m=>m.path),packageFiles.map(p=>'repositories/memoryos-readiness/'+p));
  for(const m of seal.validatedPackage)check(m);}
if(process.argv[2]==='--seal'){
  const results=checkFinalEvidence();write(evidence+'/final-validation.json',{kind:'MO1307FinalizationCorrectionFinalValidation',version:'1.0.0',
    result:'PASS',...results,validatedPackage:packageFiles.map(p=>record('repositories/memoryos-readiness/'+p)),
    scope:'CORRECTED_SHARED_FOUNDATION_ONLY',sourceStability:'Final campaigns bind exact current production and tests; retained failed attempts are not promoted.'});
  console.log(JSON.stringify({result:'PASS',...results}));
}
