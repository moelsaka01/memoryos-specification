import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {root,E,T,cache,relativeE as rel,packageRoot,HEAD,env,json,record,walk,write,put,identity,git,hash,startedAt,hardStopAt} from './common.mjs';
const mode=process.argv[2];assert.ok(['seal','run','close'].includes(mode));
if(mode!=='close')identity();else{assert.equal(process.platform,'win32');assert.equal(process.version,'v24.21.0');assert.equal(process.arch,'x64');assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');assert.equal(git('rev-parse','HEAD').toString().trim(),HEAD);}
const steps='ABCDEFGHIJKLMNO'.split('');
const exists=name=>fs.existsSync(path.join(E,name));
const check=b=>assert.deepEqual(record(path.resolve(root,b.path)),b);
const inventoryPath=path.join(E,'recovered-inventory.json');
if(mode==='seal'){
  assert.equal(exists('campaign-seal.json'),false);assert.equal(exists('campaign-run-start.json'),false);
  const baseline=json(path.join(E,'baseline.json'));
  assert.deepEqual(walk(packageRoot),baseline.installed);assert.deepEqual(walk(path.join(root,'repositories/memoryos-readiness')),baseline.source);
  const required=['prepare.mjs','common.mjs','campaign.mjs','core.mjs','stage.mjs','decisions-tags.mjs','method.mjs','observer-entry.mjs','runtime-observer.mjs','transport-observer.mjs','errors-observer.mjs','observe-command.py','runtime-controls.mjs','runtime-controls-worker.mjs','runtime-controls-run.py','runtime-controls-observer.py','cleanup-topology.mjs','finalization.mjs','finalization-lock.ps1','security.mjs','security-worker.mjs','determinism.mjs'];
  for(const n of required)assert.ok(fs.existsSync(path.join(T,n)),n);
  assert.ok(fs.existsSync(inventoryPath),'Complete recovered inventory is required');
  assert.ok(exists('harness-review.json'),'Independent static harness review is required');
  const tools=walk(T).map(r=>record(path.join(T,r.path)));assert.equal(tools.length,25,'Exact complete prospective toolkit');
  const review=json(path.join(E,'harness-review.json'));
  assert.equal(review.result,'PASS');
  assert.deepEqual(review.reviewedModules,tools,'Independent review must cover the exact complete recursive tool walk');
  for(const binding of review.reviewedModules)check(binding);
  const cleanupReview=json(path.join(E,'cleanup-authority-review.json'));
  assert.equal(cleanupReview.result,'PASS_STATIC');
  assert.equal(cleanupReview.numericRelation,'cleanupDeadline === terminalAt + 2000');
  assert.equal(cleanupReview.epsilon,0);assert.equal(cleanupReview.historicalObservationsPromoted,false);
  assert.deepEqual(cleanupReview.reviewedModules.map(r=>r.path),['cleanup-topology.mjs','observe-command.py','runtime-controls-run.py'].map(n=>path.relative(root,path.join(T,n)).split(path.sep).join('/')));
  for(const binding of cleanupReview.reviewedModules)check(binding);
  const gate=json(path.join(E,'candidate-validation-gate.json'));assert.equal(gate.result,'PASS');assert.equal(gate.candidate,HEAD);
  for(const binding of [gate.validationManifest,...gate.validationReceipts,...gate.validationSupport,...gate.validationClosure,...gate.correctionAuthority]){const bytes=fs.readFileSync(binding.absolutePath);assert.equal(bytes.length,binding.byteLength);assert.equal(hash(bytes),binding.sha256);}
  const authoritySnapshots=walk(path.join(E,'authority-inputs')).map(r=>record(path.join(E,'authority-inputs',r.path)));
  assert.equal(authoritySnapshots.length,39,'Complete recovered source authority snapshots');
  const numericProvenanceBindings=walk(path.join(E,'numeric-history')).map(r=>record(path.join(E,'numeric-history',r.path)));assert.equal(numericProvenanceBindings.length,2,'Two historical numerical provenance copies; no re-execution');
  const historicalInventory=record(path.join(E,'recovered-inventory.original.json.data'));
  assert.equal(historicalInventory.byteLength,68277);
  assert.equal(historicalInventory.sha256,'sha256:ae927858aed6c9ddc255ed0efb9fb74160ffbd899f9780aa6c3f9109ae51b784');
  const recovered=json(inventoryPath);assert.deepEqual(recovered.steps.map(r=>r.id??r.step),steps,'Complete A-O inventory order');
  assert.equal(recovered.sourceSnapshots.length,39);for(const snapshot of recovered.sourceSnapshots){const current=record(path.join(E,snapshot.snapshot));assert.equal(current.byteLength,snapshot.byteLength);assert.equal(current.sha256,snapshot.sha256);}
  assert.deepEqual(authoritySnapshots.map(r=>r.path).sort(),recovered.sourceSnapshots.map(r=>path.relative(root,path.join(E,r.snapshot)).split(path.sep).join('/')).sort());
  const dependencies=['repositories/cca-conformance/tools/mo1307-phase2b/test-support.mjs','repositories/cca-conformance/tools/mo1307-phase1/package.mjs','repositories/cca-conformance/tests/mo1307_phase2d_semantic_test.mjs','docs/mo1307-contract-freeze-1.md','docs/mo1307-phase2c-publication-inspection-correction.md','docs/mo1307-phase2c-finalization-boundary-correction.md','docs/mo1307-final-headless-correction-addendum.md','repositories/cca-conformance/evidence/mo1307/final-headless/authorization.txt','docs/mo1307-n15-correction.md','repositories/cca-conformance/evidence/mo1307/n15-correction/authorization.txt'].map(p=>record(path.join(root,p)));
  const fixtureBindings=walk(path.join(root,'repositories/cca-conformance/fixtures/mo1307')).map(r=>record(path.join(root,'repositories/cca-conformance/fixtures/mo1307',r.path)));
  const candidateMembers=[...baseline.source.map(r=>record(path.join(root,'repositories/memoryos-readiness',r.path))),...baseline.installed.map(r=>record(path.join(packageRoot,r.path)))];
  const preparedBindings=json(path.join(E,'vectors-prepared.json')).vectors.flatMap(v=>v.input.map(r=>record(path.join(v.inputRoot,r.path))));
  const wrong=json(path.join(E,'wrong-name-prepared.json'));for(const r of wrong.input)preparedBindings.push(record(path.join(wrong.inputRoot,r.path)));
  const inputs=['campaign-config.json','generation-authorization.txt','baseline.json','candidate-before.json','installed-before.json','candidate-identity.json','runtime.json','historical-before.json','vectors-prepared.json','wrong-name-prepared.json','prepared-wrong-name/expected-result.json','recovered-inventory.json','harness-review.json','observation-method.json','activation.json','candidate-validation-gate.json','cleanup-authority-review.json','prior-generation-binding.json','tooling-adaptation.json','recovered-inventory.original.json.data'].map(n=>record(path.join(E,n)));
  write('campaign-seal.json',{kind:'MO1307Phase3AN15NativeInstalledCampaignSeal',version:'1.0.0',sealedAt:new Date().toISOString(),candidate:HEAD,integrationAuthority:'4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97',order:steps,inventory:record(inventoryPath),authoritySnapshots,numericProvenanceBindings,tools,dependencies,fixtureBindings,candidateMembers,preparedBindings,inputs,limits:{helperWholeLifecycleMs:5000,aggregateHelperActiveMs:20000,cliRenameAdmissionMs:30000,apiWorkerMs:10000,failureCleanupMs:2000},replacementHelperBoundH:'NOT_ESTABLISHED',admittedRenameSettlement:'NO_FINITE_BOUND_ESTABLISHED',execution:{once:true,caseRetry:false,replacement:false,warmup:false,diagnosticPromotion:false,stopAtFirstMandatoryFailure:true,semanticNonzeroExitsAcceptedWhenExpected:true},historicalEvidencePromoted:false,scope:'PHASE_3A_ONLY'});
  console.log(JSON.stringify({result:'SEALED',inventory:record(inventoryPath),seal:record(path.join(E,'campaign-seal.json')),certificationCasesExecuted:0}));
}
if(mode==='run'){
  const seal=json(path.join(E,'campaign-seal.json'));
  for(const b of [...seal.authoritySnapshots,...seal.numericProvenanceBindings,...seal.tools,...seal.dependencies,...seal.fixtureBindings,...seal.candidateMembers,...seal.preparedBindings,...seal.inputs])check(b);
  assert.equal(exists('campaign-run-start.json'),false,'Finite campaign cannot be restarted');
  assert.equal(exists('generation-stopped.json'),false);
  write('campaign-run-start.json',{candidate:HEAD,startedAt:new Date().toISOString(),seal:record(path.join(E,'campaign-seal.json')),singleExecution:true});
  let failure=null,currentStep=null;
  try{for(const step of steps){
    currentStep=step;
    assert.equal(exists('generation-stopped.json'),false);
    for(const b of [...seal.authoritySnapshots,...seal.numericProvenanceBindings,...seal.tools,...seal.dependencies,...seal.fixtureBindings,...seal.candidateMembers,...seal.preparedBindings,...seal.inputs])check(b);
    const script='ABCDEO'.includes(step)?'core.mjs':'FG'.includes(step)?'decisions-tags.mjs':'stage.mjs';
    const args=[path.join(T,script),step],at=performance.now();
    write('scheduler/'+step+'-launch.json',{step,executable:process.execPath,args,startedAt:new Date().toISOString(),env,noRetry:true});
    const r=spawnSync(process.execPath,args,{cwd:root,env,windowsHide:true,shell:false,encoding:null,maxBuffer:8*1024*1024});
    const row={step,exit:r.status,error:r.error?.code??null,signal:r.signal,elapsedMs:performance.now()-at,stdout:put('scheduler/'+step+'.stdout.data',r.stdout??Buffer.alloc(0)),stderr:put('scheduler/'+step+'.stderr.data',r.stderr??Buffer.alloc(0))};
    const receipt=exists('steps/'+step+'.json')?json(path.join(E,'steps/'+step+'.json')):null;
    row.result=r.status===0&&!r.error&&receipt?.result==='PASS'&&!exists('generation-stopped.json')?'PASS':'FAIL';
    write('scheduler/'+step+'-receipt.json',row);console.log(JSON.stringify({step,result:row.result,exit:r.status,elapsedMs:row.elapsedMs}));
    if(row.result!=='PASS'){
      failure={step,scheduler:record(path.join(E,'scheduler/'+step+'-receipt.json')),caseFailure:receipt?.failure??null};
      if(!exists('generation-stopped.json'))write('generation-stopped.json',{step,at:new Date().toISOString(),reason:'FIRST_MANDATORY_FAILURE_OR_HARNESS_INTERRUPTION',failure,noRetry:true,noLaterSteps:true});
      break;
    }
  }}catch(error){failure={step:currentStep,reason:'SCHEDULER_FAILURE_OR_INTERRUPTION',error:{name:error.name,message:error.message,code:error.code??null,stack:error.stack}};
    if(!exists('generation-stopped.json'))write('generation-stopped.json',{step:currentStep,at:new Date().toISOString(),reason:'FIRST_MANDATORY_FAILURE_OR_HARNESS_INTERRUPTION',failure,noRetry:true,noLaterSteps:true});
  }finally{write('campaign-run-finished.json',{finishedAt:new Date().toISOString(),result:failure?'FAILED_INCOMPLETE':'ALL_STEPS_COMPLETED',failure,noFurtherProductExecution:true});}
  process.exitCode=failure?1:0;
}
if(mode==='close'){
  assert.ok(exists('campaign-run-start.json'));assert.equal(exists('certification-receipt.json'),false);
  if(!exists('campaign-run-finished.json')){
    if(!exists('generation-stopped.json'))write('generation-stopped.json',{at:new Date().toISOString(),reason:'INTERRUPTED_STARTED_CAMPAIGN',noRetry:true,noLaterSteps:true});
    write('campaign-run-finished.json',{finishedAt:new Date().toISOString(),result:'FAILED_INCOMPLETE',failure:'INTERRUPTED_STARTED_CAMPAIGN',noFurtherProductExecution:true});
  }
  const baseline=json(path.join(E,'baseline.json')),seal=json(path.join(E,'campaign-seal.json'));
  const integrityFailures=[];
  for(const b of [...seal.authoritySnapshots,...seal.numericProvenanceBindings,...seal.tools,...seal.dependencies,...seal.fixtureBindings,...seal.inputs]){try{check(b);}catch{integrityFailures.push({type:'SEALED_INPUT_CHANGED',binding:b});}}
  const sourceNow=walk(path.join(root,'repositories/memoryos-readiness')),installedNow=walk(packageRoot);
  const sourceUnchanged=JSON.stringify(sourceNow)===JSON.stringify(baseline.source),installedUnchanged=JSON.stringify(installedNow)===JSON.stringify(baseline.installed);
  const history=json(path.join(E,'historical-before.json')).members;
  const historicalChanged=history.filter(b=>{try{const actual=record(b.absolutePath);return actual.byteLength!==b.byteLength||actual.sha256!==b.sha256;}catch{return true;}});
  const archive=json(path.join(E,'candidate-identity.json')).archive;try{check(archive);}catch{integrityFailures.push({type:'ARCHIVE_CHANGED',binding:archive});}
  const integrity={result:sourceUnchanged&&installedUnchanged&&!historicalChanged.length&&!integrityFailures.length?'PASS':'FAIL',sourceUnchanged,installedUnchanged,installedMembers:installedNow.length,historicalFiles:history.length,historicalChanged,integrityFailures,productionDiff:git('diff','--name-only',HEAD,'--','repositories/memoryos-readiness').toString(),noProductionMutation:sourceUnchanged&&git('diff','--name-only',HEAD,'--','repositories/memoryos-readiness').toString()===''};
  write('integrity-after.json',integrity);
  const results=steps.map(step=>{const p=path.join(E,'steps',step+'.json');if(fs.existsSync(p))return {step,...JSON.parse(fs.readFileSync(p)),binding:record(p)};const scheduler=path.join(E,'scheduler',step+'-receipt.json');return fs.existsSync(scheduler)?{step,result:'FAIL',failure:{reason:'No complete step receipt',scheduler:JSON.parse(fs.readFileSync(scheduler))},binding:record(scheduler)}:{step,result:'NOT_RUN',reason:'Stopped at first mandatory failure'};});
  const observations=walk(E).filter(x=>x.path.endsWith('/observation.json')).map(x=>({binding:record(path.join(E,x.path)),data:json(path.join(E,x.path))}));
  const native=observations.map(({binding,data:d})=>({binding,pid:d.pid,exit:d.productExit,productLifecycleElapsedMs:d.productLifecycleElapsedMs,maxRssKiB:d.maxRssKiB,requests:d.requests.map(q=>({ordinal:q.ordinal,sequence:q.sequence,operation:q.operation,fileCount:q.fileCount,pid:q.pid,disposition:q.disposition,error:q.error,durationMs:q.durationMs,chargedThisExchangeMs:q.chargedThisExchangeMs,exitCode:q.exitCode,exitSignal:q.exitSignal,transportClosed:q.transportClosed,responseComplete:q.responseComplete,responseAcceptedByTransport:q.responseAcceptedByTransport})),supervisors:d.supervisors,events:d.events}));
  write('resource-and-cleanup-observations.json',{limits:seal.limits,replacementHelperBoundH:'NOT_ESTABLISHED',native,externalTopology:exists('topology-B/receipt.json')?record(path.join(E,'topology-B/receipt.json')):null,cleanupControls:exists('cleanup-topology/receipt.json')?record(path.join(E,'cleanup-topology/receipt.json')):null,notes:'Observed product cleanup confirmation is distinct from held-process-object external cleanup proof. No unidentified console-host death is claimed; zero identified hosts is not host absence proof. Unexecuted controls make no certification claim.'});
  const completed=results.filter(r=>r.result==='PASS').map(r=>r.step),failed=results.find(r=>r.result==='FAIL'),unexecuted=results.filter(r=>r.result==='NOT_RUN').map(r=>r.step);
  const allPassed=completed.length===15&&integrity.result==='PASS'&&!exists('generation-stopped.json');
  const outcome=allPassed?'ACCEPTED':'FAILED/INCOMPLETE';
  const bindings=walk(E).map(x=>record(path.join(E,x.path)));
  const receipt={kind:allPassed?'MO1307Phase3ACertificationAcceptedReceipt':'MO1307Phase3ACertificationFailedIncompleteReceipt',version:'1.0.0',createdAt:new Date().toISOString(),result:outcome,certificationPassed:allPassed,allMandatoryPassed:allPassed,candidate:HEAD,integrationAuthority:seal.integrationAuthority,worktree:root,branch:'codex/mo1307-phase3a-n15',runtime:json(path.join(E,'runtime.json')),package:json(path.join(E,'candidate-identity.json')),installedMemberVerification:record(path.join(E,'installed-before.json')),inventory:record(inventoryPath),seal:record(path.join(E,'campaign-seal.json')),limits:seal.limits,replacementHelperBoundH:'NOT_ESTABLISHED',steps:results,completed,firstMandatoryFailure:failed??null,unexecuted,resourceCleanup:record(path.join(E,'resource-and-cleanup-observations.json')),integrity:record(path.join(E,'integrity-after.json')),historicalEvidencePreserved:integrity.historicalChanged.length===0,historicalEvidencePromoted:false,diagnosticsRun:0,retries:0,replacementExecutions:0,phase3B:false,phase3C:false,phase3D:false,push:false,tag:false,determinism:results.find(r=>r.step==='N').result,cliApiParity:results.filter(r=>'ABCDEO'.includes(r.step)).map(r=>({step:r.step,result:r.result,rows:r.rows??[]})),startedAt,finishedAt:new Date().toISOString(),evidenceMembers:bindings,handoff:allPassed?'Immutable Phase 3A only; later Phase 3D may integrate this receipt with independently accepted exact-candidate 3B/3C receipts. Phase 3D not performed.':'No accepted Phase 3A handoff; failed/incomplete stream must be handled separately.'};
  write('certification-receipt.json',receipt);
  const lines=['# MO-1307 Phase 3A native Windows installed-runtime certification','',`**Phase 3A ${outcome}.**`,'',`Candidate: N15-corrected \`${HEAD}\`. Integration/evidence authority: \`${seal.integrationAuthority}\`.`,`Worktree: \`${root}\`; branch: \`codex/mo1307-phase3a-n15\`.`,'',`Fresh offline package: \`${archive.sha256}\`, ${archive.byteLength} bytes. Exactly 89 installed members verified against the new candidate and validated source before execution; post-run integrity ${integrity.result}.`,`Runtime: Node 24.21.0 win-x64, SHA-256 ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32; native Windows PowerShell ${receipt.runtime.powershell.powerShellVersion}.`,'','| Step | Result |','|---|---|',...results.map(r=>`| ${r.step} | ${r.result} |`),'',allPassed?'Every mandatory step completed successfully.':failed?`First mandatory failure: ${failed.step}. Exact expected/actual case, request ordinals, errors and clocks are retained in the step receipt and resource observations.`:'Incomplete/interrupted or integrity failure; see preserved receipts.',`Completed: ${completed.join(', ')||'none'}. Unexecuted: ${unexecuted.join(', ')||'none'}.`,'','Limits preserved: helper lifecycle 5000 ms; helper-active aggregate 20000 ms; CLI/rename admission 30000 ms; API/worker 10000 ms; failure cleanup 2000 ms. Replacement helper bound H remains NOT_ESTABLISHED. Admitted rename settlement has no invented finite bound.','',`Historical evidence: ${history.length} files checked, ${historicalChanged.length} changed; none promoted. No retry, diagnostic campaign, production change, push, tag or Phase 3B/3C/3D execution.`,`CLI/API parity and cleanup claims are limited to retained completed observations. Byte determinism stage N: ${receipt.determinism}.`,'',`Receipt: [certification-receipt.json](../${rel}/certification-receipt.json).`,`Sealed inventory: [recovered-inventory.json](../${rel}/recovered-inventory.json).`,`Resource/cleanup: [resource-and-cleanup-observations.json](../${rel}/resource-and-cleanup-observations.json).`,'',receipt.handoff,''];
  const report=path.join(root,'docs/mo1307-phase3a-n15.md');fs.writeFileSync(report,lines.join('\n'),{flag:'wx'});
  write('closure.json',{result:outcome,receipt:record(path.join(E,'certification-receipt.json')),report:record(report),integrity:record(path.join(E,'integrity-after.json')),commit:null,commitBinding:'Subsequent local evidence commit includes these already-existing bytes; no future self-hash embedded.'});
  console.log(JSON.stringify({result:outcome,completed,firstFailure:failed?.step??null,unexecuted,integrity:integrity.result,receipt:record(path.join(E,'certification-receipt.json')),report}));
}


