// Read-only evidence verification. No campaign, mutation, package rebuild or retry.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {root,evidence,baseline,sources,hash,read,json,record,check,blobs,str,sourceState} from './common.mjs';
import {checkPackage} from '../mo1307-phase1/package.mjs';
import {canonicalBytes} from '../../../memoryos-readiness/src/canonical.mjs';
import {summaryProjection} from '../../../memoryos-readiness/src/projections.mjs';
import {decodeHelperRequest,decodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';
const checks=[],pins=[];
const pin='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
const checked=(member,bytes)=>{check(member,bytes);return member;};
const checkedJson=p=>{const r=record(p);pins.push(r);return json(p);};
const expectPass=(r,label)=>assert.equal(r.result,'PASS',label);
function checkCounts(actual,total){assert.deepEqual(actual,{tests:total,pass:total,fail:0,cancelled:0,skipped:0,todo:0});}
function tapCounts(bytes){const t=bytes.toString();return Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(k=>[k,Number(new RegExp('^# '+k+' (\\d+)$','m').exec(t)?.[1]??-1)]));}
function checkCommand(c,expectedTests){assert.equal(c.exit,0,c.id);assert.equal(c.error,null,c.id);if(Object.hasOwn(c,'result'))expectPass(c,c.id);checked(c.stdout);checked(c.stderr);if(expectedTests!==undefined){checkCounts(c.tests??tapCounts(read(c.stdout.path)),expectedTests);checkCounts(tapCounts(read(c.stdout.path)),expectedTests);}}
function sourceCheck(){
 const gate=checkedJson(evidence+'/source-gate.json');expectPass(gate,'all source gates');assert.equal(gate.baseline,baseline);assert.equal(gate.sourceReviews.length,3);for(const r of gate.sourceReviews)checked(r);
 for(const source of sources){const state=sourceState(source);assert.equal(state.commit,source.commit);assert.deepEqual(state.parents,[source.base]);assert.equal(state.subject,source.subject);assert.equal(state.status,'');const review=checkedJson(evidence+'/source-gate-'+source.id+'.json');expectPass(review,source.id);assert.equal(review.commit,source.commit);
  const atSource=rows=>{for(const r of rows??[])checked(r,fs.readFileSync(path.join(source.worktree,r.path)));};
  if(source.id==='2a'){atSource(review.sourceBindings);for(const r of review.authorityBindings)checked(r);}
  if(source.id==='2b'){atSource(review.verifiedBindingMembers);atSource(review.verifiedAcceptanceSources);atSource(review.verifiedAcceptanceLogs);}
  if(source.id==='2c')atSource(review.receipts);
 }
 const correction=checkedJson('repositories/cca-conformance/evidence/mo1307/phase2c-finalization-correction/binding.json');assert.equal(correction.implementation.commit,'a61a8ff6fe01028fd21f8abe7208d5ffbe9c5152');assert.equal(str('show','-s','--format=%P',baseline),correction.implementation.commit);assert.equal(str('show','-s','--format=%s',baseline),correction.bindingSubject);assert.equal(str('show','-s','--format=%P',correction.implementation.commit),correction.implementation.parent);assert.equal(str('rev-parse',correction.implementation.commit+'^{tree}'),correction.implementation.tree);const old=blobs(correction.implementation.commit,correction.members.map(r=>r.path));correction.members.forEach((r,i)=>checked(r,old[i]));assert.equal(correction.members.length,184);
 checks.push({id:'source-gates-correction-graph',result:'PASS',sourceCommits:3,correctionMembers:184});
 const history=checkedJson(evidence+'/historical-preservation.json');expectPass(history,'historical preservation');assert.equal(history.historicalFailuresRelabeled,false);for(const r of [...history.baselineEvidence,...history.importedEvidence])checked(r);assert.equal(history.baselineEvidence.length,466);assert.equal(history.importedEvidence.length,1841);
 const captured=json('repositories/cca-conformance/evidence/mo1307/phase2c-finalization-correction/history/original-phase2c/changed-file-inventory.json');const blocked='C:/Users/melsa/Documents/Codex/cca-mo1307-2c',args=['-c','safe.directory='+blocked,'-C',blocked];assert.equal(str(...args,'rev-parse','HEAD'),captured.before.head);const status=spawnSync('git',[...args,'status','--porcelain=v1','--untracked-files=all'],{cwd:root,windowsHide:true,encoding:'utf8',timeout:15000});assert.ifError(status.error);assert.equal(status.status,0);assert.equal(status.stdout,captured.before.status);for(const r of captured.files)checked(r,fs.readFileSync(path.join(blocked,r.path)));assert.equal(captured.files.length,5);
 checks.push({id:'historical-preservation',result:'PASS',baseline:466,imported:1841,originalBlocked:5});
}
function overlapCheck(){
 const matrix=checkedJson(evidence+'/overlap-matrix.json'),resolution=checkedJson(evidence+'/package-overlap-resolution.json'),final=checkedJson(evidence+'/package-phase-order-refresh.json');expectPass(resolution,'package overlap');expectPass(final,'final package bindings');assert.equal(matrix.threeWay.length,4);assert.deepEqual([...resolution.paths].sort(),[...matrix.threeWay].sort());assert.equal(resolution.sources.length,5);
 for(const source of resolution.sources){const values=blobs(source.revision,source.files.map(r=>r.path));source.files.forEach((r,i)=>checked(r,values[i]));}for(const r of final.after)checked(r);checked(final.integration);
 const review=checkedJson(evidence+'/integration-review-final.json');expectPass(review,'final source review');assert.deepEqual(review.remainingNormativeBlockers,[]);for(const r of [...review.sourceBindings,...review.authoritiesUnchanged,...review.developmentEvidence])checked(r);checked(review.testBinding);for(const r of review.supersedes)checked(r.record);
 const pkg=checkPackage();assert.equal(pkg.members,89);assert.equal(pkg.contractMembers,53);assert.equal(pkg.externalProductionDependencies,0);checks.push({id:'package-overlap-and-integration-review',result:'PASS',package:pkg,sourcePinSets:5,overlaps:4});
}
function regressionCheck(){
 const summary=checkedJson(evidence+'/regressions/summary.json');expectPass(summary,'regression summary');for(const r of summary.finalOverlapFiles)checked(r);for(const r of summary.testAdaptations.files)checked(r);
 const required={cheap:null,phase1:105,phase2a:84,phase2b:172,phase2c:219};assert.deepEqual(summary.campaigns.map(r=>r.group),Object.keys(required));
 for(const row of summary.campaigns){checked(row.receipt);const r=checkedJson(row.receipt.path);expectPass(r,row.group);assert.equal(r.sourcesUnchanged,true);const dir=path.posix.dirname(row.receipt.path),before=checkedJson(dir+'/inputs-before.json'),after=checkedJson(dir+'/inputs-after.json');assert.deepEqual(before,after);for(const b of before)checked(b);assert.equal(before.length,r.sourceBindings);for(const c of r.commands)checkCommand(c,c.id==='tests'?required[row.group]:undefined);if(row.group==='phase2a'||row.group==='phase2b'){assert.equal(r.exactVectors,16);const vectors=checkedJson(dir+'/vectors.json');assert.equal(vectors.length,16);assert.ok(vectors.every(v=>v.result==='PASS'));}if(row.group==='cheap'){const schema=json(dir+'/schemas.stdout.txt');expectPass(schema,'schemas');assert.equal(schema.schemas,52);assert.equal(schema.checkedFixtures,476);assert.deepEqual(schema.failures,[]);const fixtures=json(dir+'/fixtures.stdout.txt');assert.equal(fixtures.mode,'CHECK');assert.equal(fixtures.catalogEntries,485);}}
 assert.equal(summary.timerWitnesses.length,7);assert.ok(summary.timerWitnesses.every(t=>t.remainingTimers===0&&t.callbacksAfterSettlement===0&&t.serverOrWatcherResources===0));assert.equal(summary.queuedRenameWitnesses.length,2);for(const q of summary.queuedRenameWitnesses){assert.equal(q.requests,1);assert.equal(q.observation.settled,false);}
 checks.push({id:'current-source-regressions',result:'PASS',phase1:105,phase2a:84,phase2b:172,phase2c:219,phase2aVectors:16,phase2bVectors:16,timerWitnesses:7,queuedRenameWitnesses:2});
}
function semanticCheck(){
 const r=checkedJson(evidence+'/semantics/attempt-1/receipt.json'),campaign=checkedJson(evidence+'/semantics/attempt-1/campaign.json');expectPass(r,'semantic receipt');checkCounts(r.tests,58);checkCommand(r.command,58);assert.equal(r.sourcesUnchanged,true);assert.equal(r.error,null);assert.deepEqual(r.sourceBindings,campaign.sources);for(const s of r.sourceBindings)checked(s);assert.equal(r.matrices.length,6);const names=['vectorMatrix','graphMatrix','determinismMatrix','decisionMatrix','preservationMatrix','securityMatrix'];assert.deepEqual(r.matrices.map(m=>path.posix.basename(m.path,'.json')),names);const m=Object.fromEntries(r.matrices.map((b,i)=>{checked(b);const value=checkedJson(b.path);expectPass(value,names[i]);return[names[i],value];}));assert.equal(m.vectorMatrix.vectors.length,16);assert.equal(m.graphMatrix.graphs.length,16);assert.equal(m.decisionMatrix.cases.length,8);assert.equal(m.securityMatrix.controls.length,26);assert.deepEqual([...m.vectorMatrix.fourReadinessStates].sort(),['COULD_NOT_EVALUATE','NOT_READY','READY','READY_WITH_QUALIFICATIONS']);
 for(const v of m.vectorMatrix.vectors){assert.equal(v.validation,'PASS');assert.equal(v.exactExpectedResult,true);assert.equal(v.fixedWorkerSeamMatchesDirectComputation,true);checked({...v.result,path:'repositories/cca-conformance/fixtures/mo1307/bundles/'+v.name+'/expected-result.json'});}
 for(const g of m.graphMatrix.graphs){expectPass(g,g.name);assert.equal(g.acyclic,true);assert.equal(g.closed,true);assert.equal(g.futureOrSelfReference,false);assert.equal(hash(canonicalBytes(g.graph)),g.graphDigest);}
 assert.equal(m.preservationMatrix.mo1306.history.length,12);assert.equal(m.preservationMatrix.mo1306.qualifications.length,10);assert.equal(m.preservationMatrix.mo1306.rawHistoryRows,19);assert.equal(m.preservationMatrix.mo1306.readiness,'READY_WITH_QUALIFICATIONS');for(const d of m.decisionMatrix.cases)expectPass(d,'decision matrix');for(const s of m.securityMatrix.controls)expectPass(s,'semantic security');checks.push({id:'integrated-semantics',result:'PASS',tests:58,vectors:16,matrices:6,decisions:8,semanticSecurityControls:26});
}
function checkIntegrationCase(c,directory){
 expectPass(c,c.name);assert.deepEqual(checkedJson(directory+'/'+c.name+'/receipt.json'),c);checked(c.resultBytes);
 const fixture=read('repositories/cca-conformance/fixtures/mo1307/bundles/'+c.name+'/expected-result.json'),value=JSON.parse(fixture);
 assert.deepEqual(read(c.resultBytes.path),fixture);assert.equal(c.readiness,value.assessment.readiness);assert.equal(c.gates,22);assert.equal(c.readinessDigest,value.readinessDigest);assert.equal(c.proofBindingDigest,value.proofBindingDigest);
 const exit={READY:0,READY_WITH_QUALIFICATIONS:2,NOT_READY:3,COULD_NOT_EVALUATE:4}[c.readiness];assert.equal(c.exit,exit);assert.equal(c.cliEvaluate.exit,exit);assert.equal(c.cliVerify.exit,0);
 for(const command of [c.cliEvaluate,c.cliVerify,...(c.repeat?[c.repeat]:[])]){
  checked(command.stdout);checked(command.stderr);assert.equal(command.error,null);assert.equal(command.signal,null);assert.equal(command.stderr.byteLength,0);
  assert.deepEqual(read(command.stdout.path),summaryProjection(value,command.command,command.command==='verify'?c.decision:null));
 }
 for(const key of ['exactApiCliParity','verifyNoPublicationMutation','actualPackagedCli','actualFixedWorker','actualNativePublication','actual2BVerification','actual2AComputation'])assert.equal(c[key],true,key);
 if(c.name==='ready'){assert.equal(c.repeat.sameNormativeBytes,true);assert.equal(c.repeat.differentSafeOutputRoot,true);assert.equal(c.repeat.exit,0);}
}
function checkNativeOuter(pin,innerPin,expectedResult){
 checked(pin);const outer=checkedJson(pin.path),campaign=checkedJson(path.posix.dirname(pin.path)+'/campaign.json');assert.equal(outer.result,expectedResult);assert.equal(outer.result==='PASS',outer.exit===0);assert.equal(outer.error,null);assert.equal(outer.signal,null);assert.equal(outer.finiteProductSettlementClaim,false);
 assert.deepEqual(outer.sourceBindings,campaign.sourceBindings);assert.equal(campaign.output,path.posix.dirname(innerPin.path));for(const b of outer.sourceBindings)checked(b);checked(outer.stdout);checked(outer.stderr);
 if(expectedResult==='PASS'){checked(outer.innerReceipt);assert.deepEqual(outer.innerReceipt,innerPin);}else if(outer.innerReceipt!==null){checked(outer.innerReceipt);assert.deepEqual(outer.innerReceipt,innerPin);}
 return outer;
}
function checkSelectedIntegration(selection,retainedFailures,additionalLimitations){
 const limited=selection.acceptance==='FIVE_EXPLICIT_PASS_CASES_WITH_MO1306_NATIVE_NOT_ESTABLISHED';
 assert.ok(limited||selection.acceptance==='SIX_EXPLICIT_PASS_CASES');assert.equal(selection.cases.length,limited?5:6);
 if(limited){
  const limitation=additionalLimitations?.mo1306Native;assert.equal(limitation?.status,'NOT_ESTABLISHED');checked(limitation.semanticReceipt);assert.equal(limitation.semanticReceipt.path,evidence+'/semantics/attempt-1/receipt.json');const semantic=checkedJson(limitation.semanticReceipt.path);expectPass(semantic,'MO1306 semantic/API acceptance');checkCounts(semantic.tests,58);
  assert.deepEqual(limitation.focusedFailureReceipts.map(r=>r.path).sort(),['mo1306-attempt1','mo1306-attempt2'].map(n=>evidence+'/native/'+n+'/receipt.json'));
  for(const failed of limitation.focusedFailureReceipts){checked(failed);assert.equal(checkedJson(failed.path).result,'FAIL');assert.deepEqual(retainedFailures.find(r=>r.receipt.path===failed.path)?.receipt,failed);}
  checked(limitation.diagnosticReceipt);assert.deepEqual(retainedFailures.find(r=>r.receipt.path===limitation.diagnosticReceipt.path)?.receipt,limitation.diagnosticReceipt);checked(limitation.pidObservation);assert.equal(limitation.cleanupConfirmedByDiagnostic,false);assert.equal(limitation.quiescence,'NOT_CONFIRMED_BY_THIS_RECEIPT');assert.equal(limitation.specificInnerCause,'UNDETERMINED');
 }
 const rows=[];
 for(const entry of selection.cases){
  checked(entry.receipt);checked(entry.campaignReceipt);const c=checkedJson(entry.receipt.path),parent=checkedJson(entry.campaignReceipt.path),directory=path.posix.dirname(entry.campaignReceipt.path),campaign=checkedJson(directory+'/campaign.json');
  assert.equal(entry.receipt.path,directory+'/'+c.name+'/receipt.json');assert.deepEqual(parent.cases.find(v=>v.name===c.name),c);assert.deepEqual(parent.sourceBindings,campaign.sourceBindings);for(const b of parent.sourceBindings)checked(b);assert.equal(parent.sourceInputsUnchanged,true);assert.equal(parent.sourceWorktreeWrites,false);
  assert.ok(['PASS','FAIL'].includes(parent.result));if(parent.result==='FAIL'){const historical=retainedFailures.find(f=>f.receipt.path===entry.campaignReceipt.path);assert.ok(historical,'A selected case from a failed campaign must retain the failure disposition.');assert.deepEqual(historical.receipt,entry.campaignReceipt);assert.deepEqual(historical.outerReceipt,entry.outerReceipt);}else assert.equal(parent.failure,null);
  const outer=checkNativeOuter(entry.outerReceipt,entry.campaignReceipt,parent.result);assert.ok(['integration','selected'].includes(outer.group));
  checkIntegrationCase(c,directory);rows.push(c);
 }
 assert.deepEqual(rows.map(c=>c.name),limited?['ready','qualified','not-ready','could-not-evaluate','rest-qualified']:['ready','qualified','not-ready','could-not-evaluate','mo1306-qualified','rest-qualified']);
 assert.deepEqual([...new Set(rows.map(c=>c.readiness))].sort(),['COULD_NOT_EVALUATE','NOT_READY','READY','READY_WITH_QUALIFICATIONS']);
 checks.push({id:'native-integration',result:'PASS',cases:rows.length,acceptance:selection.acceptance,parentCampaignFailuresRelabeled:false,mo1306Native:limited?'NOT_ESTABLISHED':'PASS',mo1306SemanticAndApi:'PASS'});
}
function checkMo1306Diagnostic(r){
 assert.equal(r.result,'FAIL');assert.equal(r.failure.code,'MO1307_TIMEOUT');assert.equal(r.failure.stage,'ACQUISITION');assert.equal(r.sourceInputsUnchanged,true);assert.equal(r.semanticDoubles,false);assert.equal(r.nativeDoubles,false);assert.equal(r.normativeLimitsChanged,false);
 assert.equal(r.requests.length,3);assert.deepEqual(r.observation.completedHelperOrdinals,[1,2]);assert.equal(r.requests[2].files.length,65);assert.equal(r.requests[2].error.code,'MO1307_TIMEOUT');assert.equal(r.requests[2].response,undefined);
 assert.ok(r.observation.observedDeadlineMinusStartEventMs>4990&&r.observation.observedDeadlineMinusStartEventMs<=5000);assert.ok(r.snapshot.helperUsedMs<20000);assert.equal(r.snapshot.workers,0);assert.equal(r.namespace.outputRootExists,false);assert.equal(r.stdout.byteLength,0);checked(r.stdout);
 assert.equal(r.snapshot.cleanupConfirmed,false);assert.equal(r.snapshot.activeRole,'helper');assert.equal(r.exactResult,false);assert.equal(r.exactSummary,false);
 for(const [i,observed] of r.requests.entries()){
  checked(observed.request);const request=decodeHelperRequest(read(observed.request.path));assert.equal(request.sequence,i+1);assert.equal(request.session,observed.session);assert.equal(request.operation,observed.operation);assert.equal(request.files.length,observed.files.length);
  if(observed.response){checked(observed.response);const response=decodeHelperResponse(read(observed.response.path),request);assert.equal(response.status,'OK');assert.equal(observed.exitConfirmed,true);}
 }
 checks.push({id:'mo1306-native-diagnostic-retention',result:'PASS',nativeReadiness:'NOT_ESTABLISHED',observedFailure:'MO1307_TIMEOUT',slot:3,files:65,workerStarted:false,publication:false,quiescence:'NOT_CONFIRMED_BY_THIS_RECEIPT',laterProcessLiveness:'NOT_INFERRED'});
}
function nativeCheck(){
 const authorization=checkedJson(evidence+'/pre-native-authorization.json');expectPass(authorization,'native authorization');checked(authorization.regressionSummary);for(const r of [...authorization.receipts,...authorization.sourceBindings])checked(r);
 const summary=checkedJson(evidence+'/native/summary.json');expectPass(summary,'native selection');
 assert.deepEqual(summary.campaigns.map(c=>c.group),['integration','lifecycle','security']);
 assert.ok(Array.isArray(summary.retainedFailures),'Retained native failures must be explicit, including an empty list.');
 const nativePath=p=>assert.ok(p.startsWith(evidence+'/native/')&&!p.split('/').some(v=>v==='..'||v==='.'),'Native evidence must remain in its retained subtree.');
 for(const selected of summary.campaigns){
  const name=selected.group;if(name==='integration'&&Array.isArray(selected.cases)){for(const c of selected.cases){nativePath(c.receipt.path);nativePath(c.campaignReceipt.path);nativePath(c.outerReceipt.path);}checkSelectedIntegration(selected,summary.retainedFailures,summary.additionalLimitations);continue;}nativePath(selected.receipt.path);nativePath(selected.outerReceipt.path);checked(selected.receipt);checked(selected.outerReceipt);
  const directory=path.posix.dirname(selected.receipt.path),r=checkedJson(selected.receipt.path);expectPass(r,'native '+name);assert.equal(r.failure,null);
  const campaign=checkedJson(directory+'/campaign.json');assert.deepEqual(r.sourceBindings,campaign.sourceBindings);for(const b of r.sourceBindings)checked(b);assert.equal(r.sourceWorktreeWrites,false);
  if(name==='integration'){
   assert.deepEqual(r.cases.map(c=>c.name),['ready','qualified','not-ready','could-not-evaluate','mo1306-qualified','rest-qualified']);
   assert.equal(r.completedCases,6);assert.equal(r.expectedCases,6);assert.equal(r.sourceInputsUnchanged,true);
   for(const c of r.cases){
    expectPass(c,c.name);assert.deepEqual(checkedJson(directory+'/'+c.name+'/receipt.json'),c);checked(c.resultBytes);
    const fixture=read('repositories/cca-conformance/fixtures/mo1307/bundles/'+c.name+'/expected-result.json'),value=JSON.parse(fixture);
    assert.deepEqual(read(c.resultBytes.path),fixture);assert.equal(c.readiness,value.assessment.readiness);assert.equal(c.gates,22);assert.equal(c.readinessDigest,value.readinessDigest);assert.equal(c.proofBindingDigest,value.proofBindingDigest);
    const exit={READY:0,READY_WITH_QUALIFICATIONS:2,NOT_READY:3,COULD_NOT_EVALUATE:4}[c.readiness];assert.equal(c.exit,exit);assert.equal(c.cliEvaluate.exit,exit);assert.equal(c.cliVerify.exit,0);
    for(const command of [c.cliEvaluate,c.cliVerify,...(c.repeat?[c.repeat]:[])]){
     checked(command.stdout);checked(command.stderr);assert.equal(command.error,null);assert.equal(command.signal,null);assert.equal(command.stderr.byteLength,0);
     const expectedSummary=summaryProjection(value,command.command,command.command==='verify'?c.decision:null);assert.deepEqual(read(command.stdout.path),expectedSummary);
    }
    assert.equal(c.exactApiCliParity,true);assert.equal(c.verifyNoPublicationMutation,true);assert.equal(c.actualPackagedCli,true);assert.equal(c.actualFixedWorker,true);assert.equal(c.actualNativePublication,true);assert.equal(c.actual2BVerification,true);assert.equal(c.actual2AComputation,true);
   }
   assert.equal(r.cases[0].repeat.sameNormativeBytes,true);assert.equal(r.cases[0].repeat.differentSafeOutputRoot,true);assert.equal(r.cases[0].repeat.exit,0);
  }
  if(name==='lifecycle'){
   assert.deepEqual(r.cases.map(c=>c.name),['evaluate-a','verify-a','evaluate-b']);assert.equal(r.syntheticInspection,false);assert.equal(r.differentSessionsSameNormativeBytes,true);
   const expected=read('repositories/cca-conformance/fixtures/mo1307/bundles/ready/expected-result.json');
   for(const c of r.cases){
    expectPass(c,c.name);assert.deepEqual(checkedJson(directory+'/'+c.name+'/receipt.json'),c);assert.equal(c.noOverlap,true);assert.equal(c.actualNativeFrames,true);assert.equal(c.actualFixedWorker,true);assert.equal(c.actual2B2ASemantics,true);
    assert.equal(c.snapshot.workers,1);assert.equal(c.snapshot.activeRole,null);assert.equal(c.snapshot.cleanupConfirmed,true);assert.equal(c.requests.length,c.command==='evaluate'?9:4);assert.equal(c.snapshot.helpers,c.requests.length);
    assert.equal(c.outcome.exitCode,0);assert.equal(c.outcome.committed,c.command==='evaluate');if(c.command==='verify')assert.equal(c.verifyNoMutation,true);
    checked(c.stdout);assert.deepEqual(read(c.stdout.path),summaryProjection(JSON.parse(expected),c.command,null));checked(c.resultIdentity,expected);
    let active=null,helpers=0,workers=0;
    for(const event of c.snapshot.events){
     if(event.type==='start'){assert.equal(active,null,'Native worker/helper overlap');active={role:event.role,ordinal:event.ordinal};if(event.role==='helper')helpers++;else if(event.role==='worker')workers++;else assert.fail('Unexpected native role');}
     if(event.type==='quiescent'){assert.deepEqual(active,{role:event.role,ordinal:event.ordinal});active=null;}
     if(event.type==='cleanup'&&event.confirmed)active=null;
     if(event.type==='observation'&&event.role==='worker'){assert.equal(event.resourceLimits.maxOldGenerationSizeMb,128);assert.equal(event.resourceLimits.maxYoungGenerationSizeMb,16);}
    }
    assert.equal(active,null);assert.equal(helpers,c.requests.length);assert.equal(workers,1);
    for(const [index,req] of c.requests.entries()){
     assert.equal(req.sequence,index+1);assert.equal(req.session,c.session);
     const slot=String(req.sequence).padStart(2,'0'),requestPath=directory+'/'+c.name+'/'+slot+'.request.bin',responsePath=directory+'/'+c.name+'/'+slot+'.response.bin';
     pins.push(record(requestPath),record(responsePath));const request=decodeHelperRequest(read(requestPath)),response=decodeHelperResponse(read(responsePath),request);
     assert.equal(request.session,req.session);assert.equal(request.sequence,req.sequence);assert.equal(request.operation,req.operation);assert.equal(response.status,req.status);assert.equal(response.code,null);assert.equal(req.exitConfirmed,true);
    }
   }
   assert.notEqual(r.cases[0].session,r.cases[2].session);assert.equal(r.cases[0].resultIdentity.sha256,r.cases[2].resultIdentity.sha256);assert.equal(r.cases[0].stdout.sha256,r.cases[2].stdout.sha256);
  }
  if(name==='security'){
   const specs=[['traversal',20,'MO1307_FILESYSTEM_BOUNDARY'],['hardlink',20,'MO1307_FILESYSTEM_BOUNDARY'],['junction',20,'MO1307_FILESYSTEM_BOUNDARY'],['raw-source-tamper',13,'MO1307_INTEGRITY'],['existing-output',21,'MO1307_OUTPUT'],['prototype-command',10,'MO1307_USAGE'],['launch-override',10,'MO1307_USAGE']];
   assert.equal(r.expectedCases,7);assert.deepEqual(r.cases.map(c=>[c.name,c.expectedExit,c.expectedCode]),specs);
   for(const c of r.cases){expectPass(c,c.name);assert.deepEqual(checkedJson(directory+'/'+c.name+'/receipt.json'),c);checked(c.stdout);checked(c.stderr);assert.equal(c.exit,c.expectedExit);assert.equal(c.error,null);assert.equal(c.stdout.byteLength,0);assert.equal(c.diagnostic.code,c.expectedCode);assert.deepEqual(JSON.parse(read(c.stderr.path)),c.diagnostic);assert.equal(read(c.stderr.path).at(-1),10);assert.equal(c.noReadinessPublication,true);}
  }
  const outer=checkedJson(selected.outerReceipt.path),outerCampaign=checkedJson(path.posix.dirname(selected.outerReceipt.path)+'/campaign.json');expectPass(outer,'native outer '+name);assert.equal(outer.group,name);assert.equal(outer.exit,0);assert.equal(outer.error,null);assert.equal(outer.signal,null);assert.equal(outer.finiteProductSettlementClaim,false);assert.deepEqual(outer.sourceBindings,outerCampaign.sourceBindings);for(const b of outer.sourceBindings)checked(b);checked(outer.stdout);checked(outer.stderr);checked(outer.innerReceipt);assert.equal(outer.innerReceipt.path,selected.receipt.path);
  checks.push({id:'native-'+name,result:'PASS',cases:r.cases.length,receipt:selected.receipt.path});
 }
 for(const failed of summary.retainedFailures){
  nativePath(failed.receipt.path);nativePath(failed.outerReceipt.path);checked(failed.receipt);checked(failed.outerReceipt);assert.equal(typeof failed.disposition,'string');assert.ok(failed.disposition.length>0);
  const r=checkedJson(failed.receipt.path),outer=checkedJson(failed.outerReceipt.path),campaign=checkedJson(path.posix.dirname(failed.receipt.path)+'/campaign.json');assert.deepEqual(r.sourceBindings,campaign.sourceBindings);for(const b of r.sourceBindings)checked(b);if(Object.hasOwn(r,'sourceInputsUnchanged'))assert.equal(r.sourceInputsUnchanged,true);assert.equal(r.result,'FAIL');assert.notEqual(r.failure,null);if(r.kind==='MO1307NativeMO1306Diagnostic')checkMo1306Diagnostic(r);assert.equal(outer.result,'FAIL');checked(outer.stdout);checked(outer.stderr);if(outer.innerReceipt!==null){checked(outer.innerReceipt);assert.equal(outer.innerReceipt.path,failed.receipt.path);}const outerCampaign=checkedJson(path.posix.dirname(failed.outerReceipt.path)+'/campaign.json');assert.equal(outerCampaign.output,path.posix.dirname(failed.receipt.path));
  const walk=p=>fs.readdirSync(path.resolve(root,p)).sort().flatMap(n=>{const next=p+'/'+n;return fs.statSync(path.resolve(root,next)).isDirectory()?walk(next):[next];});
  for(const p of walk(path.posix.dirname(failed.receipt.path))){pins.push(record(p));if(p.endsWith('.receipt.json')||p.endsWith('/receipt.json')){const receipt=json(p);for(const key of ['stdout','stderr'])if(receipt[key])checked(receipt[key]);}}
 }
 const discoveredFailures=fs.readdirSync(path.resolve(root,evidence+'/native'),{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>evidence+'/native/'+d.name+'/receipt.json').filter(p=>fs.existsSync(path.resolve(root,p))).filter(p=>{const r=json(p);return r.result==='FAIL'&&['MO1307IntegratedNativeAcceptance','MO1307IntegratedNativeLifecycle','MO1307IntegratedNativeSecurity','MO1307NativeMO1306Diagnostic'].includes(r.kind);}).sort();
 assert.deepEqual(summary.retainedFailures.map(f=>f.receipt.path).sort(),discoveredFailures,'Every failed native body must retain an explicit disposition.');
 checks.push({id:'retained-native-failures',result:'PASS',failures:summary.retainedFailures.length,reclassifiedAsSuccess:false});
}
function publicApiCheck(){
 const directory=evidence+'/api/mo1306-attempt1',r=checkedJson(directory+'/receipt.json'),campaign=checkedJson(directory+'/campaign.json');expectPass(r,'actual MO1306 public API');assert.equal(r.failure,null);assert.deepEqual(r.sourceBindings,campaign.sourceBindings);for(const b of r.sourceBindings)checked(b);assert.equal(r.nativeAcquisitionClaim,false);assert.equal(campaign.byteOnly,true);assert.equal(campaign.actualFixedWorker,true);
 const d=r.details;assert.equal(d.actualPublicEvaluate,true);assert.equal(d.actualPublicVerify,true);assert.equal(d.actualFixedWorker,true);assert.equal(d.readiness,'READY_WITH_QUALIFICATIONS');assert.equal(d.readinessExitProjection,2);assert.equal(d.gates,22);assert.equal(d.qualifications,10);
 checked(d.resultBytes);checked(d.decisionBytes);const bytes=read(d.resultBytes.path),expected=read('repositories/cca-conformance/fixtures/mo1307/bundles/mo1306-qualified/expected-result.json');assert.deepEqual(bytes,expected);assert.equal(bytes.length,303620);
 const result=JSON.parse(bytes),decision=JSON.parse(read(d.decisionBytes.path));assert.deepEqual(canonicalBytes(decision),read(d.decisionBytes.path));assert.equal(result.assessment.qualifications.length,10);assert.equal(d.readinessDigest,result.readinessDigest);assert.equal(d.proofBindingDigest,result.proofBindingDigest);assert.equal(decision.candidateDigest,result.assessment.candidateDigest);assert.equal(decision.readinessDigest,result.readinessDigest);assert.equal(decision.proofBindingDigest,result.proofBindingDigest);assert.equal(decision.decision,'REJECT');assert.equal(decision.authenticity,'NOT_VERIFIED_BY_MEMORYOS');assert.deepEqual(d.decision,{decision:'REJECT',consistency:'CONSISTENT',authenticity:'NOT_VERIFIED_BY_MEMORYOS'});
 checks.push({id:'mo1306-actual-public-api',result:'PASS',evaluate:true,verify:true,fixedWorker:true,readiness:d.readiness,exitProjection:2,gates:22,qualifications:10,resultBytes:303620,decision:'REJECT',nativeAcquisitionClaim:false});
}
function securityLedgerCheck(){
 const ledger=checkedJson(evidence+'/integrated-security.json');expectPass(ledger,'integrated security ledger');assert.equal(ledger.categoryCount,21);assert.equal(ledger.categories.length,21);assert.equal(new Set(ledger.categories.map(c=>c.id)).size,21);for(const c of ledger.categories){expectPass(c,c.id);assert.ok(c.observations.length>0);}for(const b of ledger.evidenceBindings)checked(b);checks.push({id:'integrated-security-ledger',result:'PASS',categories:21});
}
export function checkEvidence({preNative=false}={}){
 checks.length=0;pins.length=0;
 try{
  assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(hash(fs.readFileSync(process.execPath)),pin);
  sourceCheck();overlapCheck();regressionCheck();semanticCheck();if(!preNative){nativeCheck();publicApiCheck();securityLedgerCheck();}
  return {kind:'MO1307Phase2DEvidenceCheck',version:'1.0.0',result:preNative?'PASS_PRE_NATIVE':'PASS',native:preNative?'NOT_CHECKED':'PASS',mo1306PublicApi:preNative?'NOT_CHECKED':'PASS',readOnly:true,campaignsRun:false,checks:[...checks],receiptBindings:[...pins]};
 }catch(error){return {kind:'MO1307Phase2DEvidenceCheck',version:'1.0.0',result:'FAIL',readOnly:true,checks:[...checks],failure:{code:error.code??null,message:error.message,stack:error.stack}};}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const argv=process.argv.slice(2);assert.ok(argv.length===0||(argv.length===1&&argv[0]==='--pre-native'),'Usage: check-evidence.mjs [--pre-native]');const result=checkEvidence({preNative:argv.length===1});console.log(JSON.stringify(result));process.exitCode=result.result==='FAIL'?1:0;
}
