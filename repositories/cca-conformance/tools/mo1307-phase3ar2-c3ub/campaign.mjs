import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {root,E,T,cache,relativeE as rel,packageRoot,HEAD,env,json,record,walk,write,put,identity,git,hash,startedAt,hardStopAt} from './common.mjs';
const mode=process.argv[2];assert.ok(['seal','run','close'].includes(mode));
if(mode!=='close')identity();else{assert.equal(path.resolve(root).toLowerCase(),'c:\\users\\melsa\\documents\\codex\\3ar2');assert.equal(process.platform,'win32');assert.equal(process.version,'v24.21.0');assert.equal(process.arch,'x64');assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');assert.equal(git('rev-parse','HEAD').toString().trim(),HEAD);assert.equal(git('branch','--show-current').toString().trim(),'codex/mo1307-phase3ar2-c3ub');}
const steps='ABCDEFGHIJKLMNO'.split('');
const exists=name=>fs.existsSync(path.join(E,name));
const check=b=>assert.deepEqual(record(path.resolve(root,b.path)),b);
const inventoryPath=path.join(E,'recovered-inventory.json');
const toolNames=['.gitattributes','prepare.mjs','recover-inventory.mjs','record-harness-review.mjs','common.mjs','campaign.mjs','core.mjs','stage.mjs','decisions-tags.mjs','method.mjs','observer-entry.mjs','runtime-observer.mjs','transport-observer.mjs','errors-observer.mjs','observe-command.py','runtime-controls.mjs','runtime-controls-worker.mjs','runtime-controls-run.py','runtime-controls-observer.py','cleanup-topology.mjs','finalization.mjs','finalization-lock.ps1','security.mjs','security-worker.mjs','determinism.mjs'];
const dependencyPaths=['repositories/cca-conformance/tools/mo1307-phase2b/test-support.mjs','repositories/cca-conformance/tools/mo1307-phase1/package.mjs','repositories/cca-conformance/tests/mo1307_phase2d_semantic_test.mjs','docs/mo1307-contract-freeze-1.md','docs/mo1307-phase2c-publication-inspection-correction.md','docs/mo1307-phase2c-finalization-boundary-correction.md','docs/mo1307-prospective-helper-bound-v2-candidate.md','docs/mo1307-final-headless-correction-addendum.md','repositories/cca-conformance/evidence/mo1307/final-headless/authorization.txt','repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/authority.json','repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/phase3a-handoff.json','repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/phase3b-refresh-map.json','repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/phase3c-refresh-map.json','repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/changed-file-inventory.json','repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/binding.json','repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/binding-verification.json','repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/candidate.json','repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/consistency-validation.json'];
const inputNames=['pre-execution-gate.json','campaign-config.json','generation-authorization.txt','baseline.json','candidate-before.json','installed-before.json','candidate-identity.json','runtime.json','historical-before.json','vectors-prepared.json','wrong-name-prepared.json','prepared-wrong-name/expected-result.json','recovered-inventory.json','inventory-validation.json','harness-review.json','observation-method.json'];
const fixedLimits={helperWholeLifecycleMs:9000,helperSuccess:'elapsedMs < 9000',helperTimeout:'elapsedMs >= 9000',aggregateHelperActiveMs:20000,cliRenameAdmissionMs:30000,apiWorkerMs:10000,failureCleanupMs:2000};
const fixedExecution={once:true,caseRetry:false,replacement:false,warmup:false,adaptiveExpansion:false,diagnosticPromotion:false,lateSuccessRecovery:false,stopAtFirstMandatoryFailure:true,semanticNonzeroExitsAcceptedWhenExpected:true};
function expectedSealBindings(){
  const baseline=json(path.join(E,'baseline.json'));
  const tools=walk(T).map(r=>record(path.join(T,r.path)));
  const dependencies=dependencyPaths.map(p=>record(path.join(root,p)));
  const fixtureBindings=walk(path.join(root,'repositories/cca-conformance/fixtures/mo1307')).map(r=>record(path.join(root,'repositories/cca-conformance/fixtures/mo1307',r.path)));
  const candidateMembers=[...baseline.source.map(r=>record(path.join(root,'repositories/memoryos-readiness',r.path))),...baseline.installed.map(r=>record(path.join(packageRoot,r.path)))];
  const preparedBindings=json(path.join(E,'vectors-prepared.json')).vectors.flatMap(v=>v.input.map(r=>record(path.join(v.inputRoot,r.path))));
  const wrong=json(path.join(E,'wrong-name-prepared.json'));for(const r of wrong.input)preparedBindings.push(record(path.join(wrong.inputRoot,r.path)));
  const inputs=inputNames.map(n=>record(path.join(E,n)));
  assert.equal(tools.length,25);assert.equal(dependencies.length,dependencyPaths.length);assert.equal(candidateMembers.length,178);assert.equal(inputs.length,16);
  return {tools,dependencies,fixtureBindings,candidateMembers,preparedBindings,inputs};
}
function validateSeal(seal){
  assert.equal(seal.kind,'MO1307Phase3AR2C3UBNativeInstalledCampaignSeal');assert.equal(seal.version,'1.0.0');
  assert.ok(Number.isFinite(Date.parse(seal.sealedAt)));
  assert.equal(seal.candidate,HEAD);assert.equal(seal.productionCommit,'34f42c50abfa1c440416c4cdf7f643f784585588');assert.equal(seal.productionTree,'302cf1a506e974b2102a78be1b9c920ac80105b2');assert.equal(seal.integrationAuthority,'PROSPECTIVE_HELPER_BOUND@2.0.0');
  assert.deepEqual(seal.order,steps);assert.deepEqual(seal.inventory,record(inventoryPath));assert.deepEqual(seal.limits,fixedLimits);assert.deepEqual(seal.execution,fixedExecution);
  assert.equal(seal.historicalCharacterizationH,'NOT_ESTABLISHED');assert.equal(seal.replacementHelperBoundH,'NOT_ESTABLISHED');assert.equal(seal.admittedRenameSettlement,'NO_FINITE_BOUND_ESTABLISHED');
  assert.equal(seal.historicalEvidencePromoted,false);assert.equal(seal.scope,'PHASE_3AR2_ONLY');assert.equal(seal.phase3BR2,false);assert.equal(seal.phase3CR2,false);assert.equal(seal.phase3D,false);
  const expected=expectedSealBindings();for(const key of Object.keys(expected))assert.deepEqual(seal[key],expected[key],key);
  const prefix=path.relative(root,T).replaceAll('\\','/');assert.deepEqual(seal.tools.map(r=>r.path).sort(),toolNames.map(n=>prefix+'/'+n).sort());
  assert.deepEqual(seal.dependencies.map(r=>r.path),dependencyPaths);assert.deepEqual(seal.inputs.map(r=>r.path),inputNames.map(n=>rel+'/'+n));
  return seal;
}
if(mode==='seal'){
  assert.equal(exists('campaign-seal.json'),false);assert.equal(exists('campaign-run-start.json'),false);
  for(const name of ['campaign-run-finished.json','generation-stopped.json','certification-receipt.json','phase3d-handoff.json','closure.json'])assert.equal(exists(name),false,'Pre-run output already exists: '+name);
  for(const name of ['steps','scheduler','runtime-H','runtime-I','cleanup-topology','finalization','security-L','security-M','determinism'])assert.equal(exists(name),false,'Certification output namespace already exists: '+name);
  const statusLines=git('status','--porcelain=v1','--untracked-files=all').toString().trim().split(/\r?\n/).filter(Boolean);
  const toolRel=path.relative(root,T).replaceAll('\\','/');assert.ok(statusLines.every(line=>line.startsWith('?? '+toolRel+'/')||line.startsWith('?? '+rel+'/')),'Unexpected working-tree path before seal');
  const baseline=json(path.join(E,'baseline.json'));
  assert.deepEqual(walk(packageRoot),baseline.installed);assert.deepEqual(walk(path.join(root,'repositories/memoryos-readiness')),baseline.source);
  for(const n of toolNames)assert.ok(fs.existsSync(path.join(T,n)),n);
  assert.ok(fs.existsSync(inventoryPath),'Complete recovered inventory is required');
  assert.ok(exists('harness-review.json'),'Independent static harness review is required');
  const harnessReview=json(path.join(E,'harness-review.json'));assert.equal(harnessReview.result,'PASS');
  for(const binding of harnessReview.reviewedModules)check(binding);
  const inventoryValidation=json(path.join(E,'inventory-validation.json'));
  assert.equal(inventoryValidation.result,'PASS');assert.equal(inventoryValidation.candidate,HEAD);assert.equal(inventoryValidation.integrationAuthority,'PROSPECTIVE_HELPER_BOUND@2.0.0');assert.equal(inventoryValidation.totalCases,80);assert.deepEqual(inventoryValidation.sections,steps);assert.deepEqual(inventoryValidation.inventory,record(inventoryPath));assert.equal(inventoryValidation.checks.allCasesNotRun,true);assert.equal(inventoryValidation.checks.historicalOutcomesPromoted,false);
  const bindings=expectedSealBindings();assert.deepEqual(harnessReview.reviewedModules,bindings.tools);
  const seal={kind:'MO1307Phase3AR2C3UBNativeInstalledCampaignSeal',version:'1.0.0',sealedAt:new Date().toISOString(),candidate:HEAD,productionCommit:'34f42c50abfa1c440416c4cdf7f643f784585588',productionTree:'302cf1a506e974b2102a78be1b9c920ac80105b2',integrationAuthority:'PROSPECTIVE_HELPER_BOUND@2.0.0',order:steps,inventory:record(inventoryPath),...bindings,limits:fixedLimits,historicalCharacterizationH:'NOT_ESTABLISHED',replacementHelperBoundH:'NOT_ESTABLISHED',admittedRenameSettlement:'NO_FINITE_BOUND_ESTABLISHED',execution:fixedExecution,historicalEvidencePromoted:false,scope:'PHASE_3AR2_ONLY',phase3BR2:false,phase3CR2:false,phase3D:false};
  validateSeal(seal);write('campaign-seal.json',seal);validateSeal(json(path.join(E,'campaign-seal.json')));
  console.log(JSON.stringify({result:'SEALED',inventory:record(inventoryPath),seal:record(path.join(E,'campaign-seal.json')),certificationCasesExecuted:0}));
}
if(mode==='run'){
  const seal=json(path.join(E,'campaign-seal.json'));
  validateSeal(seal);
  for(const b of [...seal.tools,...seal.dependencies,...seal.fixtureBindings,...seal.candidateMembers,...seal.preparedBindings,...seal.inputs])check(b);
  assert.equal(exists('campaign-run-start.json'),false,'Finite campaign cannot be restarted');
  assert.equal(exists('generation-stopped.json'),false);
  for(const name of ['campaign-run-finished.json','certification-receipt.json','phase3d-handoff.json','closure.json'])assert.equal(exists(name),false,'Pre-existing run/closure output: '+name);
  write('campaign-run-start.json',{candidate:HEAD,startedAt:new Date().toISOString(),seal:record(path.join(E,'campaign-seal.json')),singleExecution:true});
  let failure=null,currentStep=null;
  try{for(const step of steps){
    currentStep=step;
    assert.equal(exists('generation-stopped.json'),false);
    for(const b of [...seal.tools,...seal.candidateMembers,...seal.preparedBindings])check(b);
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
  try{validateSeal(seal);}catch(error){integrityFailures.push({type:'CAMPAIGN_SEAL_INVALID',message:error.message});}
  const safeGenerated=(file,type)=>{try{return json(file);}catch(error){integrityFailures.push({type,path:path.relative(root,file).replaceAll('\\','/'),message:error.message});return null;}};
  const safeObject=(file,type)=>{const value=safeGenerated(file,type);if(value&&typeof value==='object'&&!Array.isArray(value))return value;integrityFailures.push({type:type+'_SCHEMA',path:path.relative(root,file).replaceAll('\\','/'),message:'Expected a JSON object'});return null;};
  const safeArrayField=(value,field,type,file)=>{if(Array.isArray(value?.[field]))return value[field];integrityFailures.push({type,path:path.relative(root,file).replaceAll('\\','/'),field,message:'Expected an array'});return [];};
  const validNamedRows=(rows,type,context)=>{const valid=[];for(const [index,row] of rows.entries()){if(row&&typeof row==='object'&&!Array.isArray(row)&&typeof row.name==='string'&&typeof row.result==='string')valid.push(row);else integrityFailures.push({type,context,index,message:'Expected an object with string name and result'});}return valid;};
  const runStart=safeObject(path.join(E,'campaign-run-start.json'),'CAMPAIGN_START_MALFORMED')??{};
  const runFinished=safeObject(path.join(E,'campaign-run-finished.json'),'CAMPAIGN_FINISH_MALFORMED')??{result:'FAILED_INCOMPLETE',failure:'CAMPAIGN_FINISH_MALFORMED',noFurtherProductExecution:true};
  try{assert.deepEqual(runStart.seal,record(path.join(E,'campaign-seal.json')));assert.equal(runStart.candidate,HEAD);assert.equal(runStart.singleExecution,true);}catch(error){integrityFailures.push({type:'CAMPAIGN_START_BINDING_INVALID',message:error.message});}
  const closeBindings=['tools','dependencies','fixtureBindings','candidateMembers','preparedBindings','inputs'].flatMap(key=>Array.isArray(seal[key])?seal[key]:(integrityFailures.push({type:'CAMPAIGN_SEAL_ARRAY_INVALID',field:key}),[]));
  for(const b of closeBindings){try{check(b);}catch{integrityFailures.push({type:'SEALED_INPUT_CHANGED',binding:b});}}
  const sourceNow=walk(path.join(root,'repositories/memoryos-readiness')),installedNow=walk(packageRoot);
  const sourceUnchanged=JSON.stringify(sourceNow)===JSON.stringify(baseline.source),installedUnchanged=JSON.stringify(installedNow)===JSON.stringify(baseline.installed);
  const history=json(path.join(E,'historical-before.json')).members;
  const historicalChanged=history.filter(b=>{try{const actual=record(b.absolutePath);return actual.byteLength!==b.byteLength||actual.sha256!==b.sha256;}catch{return true;}});
  const archive=json(path.join(E,'candidate-identity.json')).archive;try{check(archive);}catch{integrityFailures.push({type:'ARCHIVE_CHANGED',binding:archive});}
  const productionDiff=git('diff','--name-only',HEAD,'--','repositories/memoryos-readiness').toString();
  const noProductionMutation=sourceUnchanged&&productionDiff==='';
  const results=steps.map(step=>{const p=path.join(E,'steps',step+'.json'),schedulerPath=path.join(E,'scheduler',step+'-receipt.json');if(fs.existsSync(p)){const data=safeObject(p,'STEP_RECEIPT_MALFORMED'),scheduler=fs.existsSync(schedulerPath)?safeObject(schedulerPath,'SCHEDULER_RECEIPT_MALFORMED'):null;if(!data)return {step,result:'FAIL',failure:{reason:'Malformed step receipt'},binding:record(p),scheduler:scheduler?{...scheduler,binding:record(schedulerPath)}:null};const identityMatches=data.step===step&&scheduler?.step===step,result=data.result==='PASS'&&scheduler?.result==='PASS'&&identityMatches?'PASS':'FAIL';return {step,...data,result,binding:record(p),scheduler:scheduler?{...scheduler,binding:record(schedulerPath)}:null,...(!identityMatches?{closeFailure:{reason:'Step/scheduler identity mismatch',expectedStep:step,stepReceiptStep:data.step??null,schedulerStep:scheduler?.step??null}}:{})};}if(fs.existsSync(schedulerPath)){const scheduler=safeObject(schedulerPath,'SCHEDULER_RECEIPT_MALFORMED');return {step,result:'FAIL',failure:{reason:'No complete step receipt',scheduler},binding:record(schedulerPath)};}return {step,result:'NOT_RUN',reason:'Stopped at first mandatory failure'};});
  const sealedInventory=safeObject(inventoryPath,'SEALED_INVENTORY_MALFORMED')??{};
  const inventorySteps=safeArrayField(sealedInventory,'steps','SEALED_INVENTORY_STEPS_SCHEMA',inventoryPath);
  const expectedCaseIds={};
  for(const step of steps){const row=inventorySteps.find(item=>item&&typeof item==='object'&&item.step===step),cases=safeArrayField(row,'cases','SEALED_INVENTORY_CASES_SCHEMA',inventoryPath);expectedCaseIds[step]=cases.map(item=>typeof item?.case==='string'?item.case:null).filter(Boolean);if(expectedCaseIds[step].length!==cases.length)integrityFailures.push({type:'SEALED_INVENTORY_CASE_ID_SCHEMA',step});}
  const passingNames=(relative,field)=>{if(!exists(relative))return [];const file=path.join(E,relative),data=safeObject(file,'CASE_RECEIPT_MALFORMED'),rows=safeArrayField(data,field,'CASE_RECEIPT_ROWS_SCHEMA',file);return validNamedRows(rows,'CASE_RECEIPT_ROW_SCHEMA',relative).filter(row=>row.result==='PASS').map(row=>row.name);};
  const completedCaseIds=step=>{
    const stepResult=results.find(row=>row.step===step);
    if('ABCDEO'.includes(step))return stepResult?.result==='PASS'?[...expectedCaseIds[step]]:[];
    if(step==='F'||step==='G'){if(stepResult?.result==='NOT_RUN')return [];const rows=Array.isArray(stepResult?.cases)?stepResult.cases:(integrityFailures.push({type:'STEP_CASES_SCHEMA',step}),[]);return validNamedRows(rows,'STEP_CASE_ROW_SCHEMA',step).filter(row=>row.result==='PASS').map(row=>row.name);}
    if(step==='H'||step==='I')return passingNames('runtime-'+step+'/receipt.json','cases');
    if(step==='J')return stepResult?.result==='PASS'?[...expectedCaseIds.J]:[];
    if(step==='K')return passingNames('finalization/receipt.json','cases');
    if(step==='L'||step==='M')return passingNames('security-'+step+'/receipt.json','rows');
    if(step==='N'&&stepResult?.result==='PASS'&&exists('determinism/receipt.json')){const file=path.join(E,'determinism/receipt.json'),receipt=safeObject(file,'DETERMINISM_RECEIPT_MALFORMED'),vectors=validNamedRows(safeArrayField(receipt,'vectors','DETERMINISM_VECTORS_SCHEMA',file),'DETERMINISM_VECTOR_ROW_SCHEMA','determinism/receipt.json');return receipt?.result==='PASS'&&vectors.length===5&&vectors.every(row=>row.result==='PASS')?[...expectedCaseIds.N]:[];}
    return [];
  };
  const caseCompletion=steps.map(step=>{const stepResult=results.find(row=>row.step===step),expected=expectedCaseIds[step],completedCases=completedCaseIds(step),exact=JSON.stringify(completedCases)===JSON.stringify(expected);return {step,expected,completed:completedCases,remaining:expected.filter(name=>!completedCases.includes(name)),result:exact&&stepResult?.result==='PASS'?'PASS':stepResult?.result==='NOT_RUN'?'NOT_RUN':'FAIL_OR_INCOMPLETE'};});
  const observations=walk(E).filter(x=>x.path.endsWith('/observation.json')).map(x=>{const file=path.join(E,x.path),data=safeObject(file,'OBSERVATION_MALFORMED');if(data&&!Array.isArray(data.requests))integrityFailures.push({type:'OBSERVATION_REQUESTS_SCHEMA',path:x.path,message:'Expected requests array'});if(Array.isArray(data?.requests))for(const [index,row] of data.requests.entries())if(!row||typeof row!=='object'||Array.isArray(row))integrityFailures.push({type:'OBSERVATION_REQUEST_ROW_SCHEMA',path:x.path,index,message:'Expected a request object'});return {binding:record(file),data};});
  const native=observations.map(({binding,data:d})=>d&&Array.isArray(d.requests)?{binding,pid:d.pid,exit:d.productExit,productLifecycleElapsedMs:d.productLifecycleElapsedMs,maxRssKiB:d.maxRssKiB,requests:d.requests.map(q=>q&&typeof q==='object'&&!Array.isArray(q)?{ordinal:q.ordinal,sequence:q.sequence,operation:q.operation,fileCount:q.fileCount,pid:q.pid,disposition:q.disposition,error:q.error,durationMs:q.durationMs,chargedThisExchangeMs:q.chargedThisExchangeMs,exitCode:q.exitCode,exitSignal:q.exitSignal,transportClosed:q.transportClosed,responseComplete:q.responseComplete,responseAcceptedByTransport:q.responseAcceptedByTransport}:{schemaFailure:true}),supervisors:d.supervisors,events:d.events}:{binding,parseOrSchemaFailure:true});
  const integrity={result:noProductionMutation&&installedUnchanged&&!historicalChanged.length&&!integrityFailures.length?'PASS':'FAIL',sourceUnchanged,installedUnchanged,installedMembers:installedNow.length,historicalFiles:history.length,historicalChanged,integrityFailures,productionDiff,noProductionMutation};
  write('integrity-after.json',integrity);
  write('resource-and-cleanup-observations.json',{limits:seal.limits,replacementHelperBoundH:'NOT_ESTABLISHED',native,externalTopology:exists('topology-B/receipt.json')?record(path.join(E,'topology-B/receipt.json')):null,cleanupControls:exists('cleanup-topology/receipt.json')?record(path.join(E,'cleanup-topology/receipt.json')):null,notes:'Observed product cleanup confirmation is distinct from held-process-object external cleanup proof; unexecuted controls make no certification claim.'});
  const completed=results.filter(r=>r.result==='PASS').map(r=>r.step),failed=results.find(r=>r.result==='FAIL'),unexecuted=results.filter(r=>r.result==='NOT_RUN').map(r=>r.step);
  const completedMandatoryCases=caseCompletion.reduce((sum,row)=>sum+row.completed.length,0);
  const remainingMandatoryCases=caseCompletion.flatMap(row=>row.remaining.map((name,index)=>({step:row.step,case:name,status:row.step===failed?.step&&index===0?'FAILED_OR_INCOMPLETE':'NOT_RUN'})));
  const allPassed=completed.length===15&&completedMandatoryCases===80&&caseCompletion.every(row=>row.result==='PASS')&&integrity.result==='PASS'&&runFinished.result==='ALL_STEPS_COMPLETED'&&!runFinished.failure&&!exists('generation-stopped.json');
  const outcome=allPassed?'PHASE3AR2_ACCEPTED_NEW_CANDIDATE':'PHASE3AR2_FAILED_INCOMPLETE';
  const bindings=walk(E).map(x=>record(path.join(E,x.path)));
  const handoffDisposition=allPassed
    ?'Exact C3UB Phase 3AR2 receipt is eligible as an immutable input to a later, independent Phase 3D. Phase 3D was not performed.'
    :'No Phase 3D handoff exists for this failed/incomplete Phase 3AR2 stream.';
  const receipt={kind:allPassed?'MO1307Phase3AR2CertificationAcceptedReceipt':'MO1307Phase3AR2CertificationFailedIncompleteReceipt',version:'1.0.0',createdAt:new Date().toISOString(),result:outcome,certificationPassed:allPassed,allMandatoryPassed:allPassed,candidate:{name:'C3UB',commit:HEAD,productionCommit:seal.productionCommit,productionTree:seal.productionTree},integrationAuthority:seal.integrationAuthority,worktree:root,branch:'codex/mo1307-phase3ar2-c3ub',runtime:json(path.join(E,'runtime.json')),package:json(path.join(E,'candidate-identity.json')),installedMemberVerification:record(path.join(E,'installed-before.json')),inventory:record(inventoryPath),seal:record(path.join(E,'campaign-seal.json')),campaignRunStart:record(path.join(E,'campaign-run-start.json')),campaignRunFinished:{...runFinished,binding:record(path.join(E,'campaign-run-finished.json'))},limits:seal.limits,historicalCharacterizationH:'NOT_ESTABLISHED',replacementHelperBoundH:'NOT_ESTABLISHED',steps:results,caseCompletion,completedMandatoryCases,remainingMandatoryCases,completed,firstMandatoryFailure:failed??runFinished.failure??(remainingMandatoryCases[0]??null),unexecuted,resourceCleanup:record(path.join(E,'resource-and-cleanup-observations.json')),integrity:record(path.join(E,'integrity-after.json')),historicalEvidencePreserved:integrity.historicalChanged.length===0,historicalEvidencePromoted:false,diagnosticsRun:0,retries:0,replacementExecutions:0,phase3BR2:false,phase3CR2:false,phase3D:false,push:false,tag:false,determinism:results.find(r=>r.step==='N')?.result??'NOT_RUN',cliApiParity:results.filter(r=>'ABCDEO'.includes(r.step)).map(r=>({step:r.step,result:r.result,rows:r.rows??[]})),startedAt,finishedAt:new Date().toISOString(),evidenceMembers:bindings,handoffDisposition};
  write('certification-receipt.json',receipt);
  let handoff=null;
  if(allPassed){
    write('phase3d-handoff.json',{kind:'MO1307Phase3AR2ToPhase3DHandoff',version:'1.0.0',result:'READY_FOR_PHASE3D',createdAt:new Date().toISOString(),candidate:receipt.candidate,integrationAuthority:seal.integrationAuthority,packageIdentity:receipt.package.packageIdentity,installedMemberCount:receipt.package.members,installedMemberVerification:record(path.join(E,'installed-before.json')),inventory:record(inventoryPath),seal:record(path.join(E,'campaign-seal.json')),certificationReceipt:record(path.join(E,'certification-receipt.json')),phase3AR2Result:outcome,independentStreamsRequired:['PHASE3BR2','PHASE3CR2'],phase3DPerformed:false,push:false,tag:false,commit:null,commitBinding:'The local certification commit containing these already-existing immutable bytes is reported externally; a Git object cannot embed its own future commit hash.'});
    handoff=record(path.join(E,'phase3d-handoff.json'));
  }
  const lines=['# MO-1307 Phase 3AR2 native Windows installed-runtime certification','',`**${outcome}.**`,'',`Candidate: C3UB \`${HEAD}\`; production commit C3U \`${seal.productionCommit}\`; production tree \`${seal.productionTree}\`.`,`Authority: \`${seal.integrationAuthority}\`. Worktree: \`${root}\`; branch: \`codex/mo1307-phase3ar2-c3ub\`.`,'',`Fresh offline package: \`${archive.sha256}\`, ${archive.byteLength} bytes. Exactly 89 installed members verified byte-for-byte against C3UB before execution; post-run integrity ${integrity.result}.`,`Runtime: Node 24.21.0 win-x64, SHA-256 ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32; native Windows PowerShell ${receipt.runtime.powershell.powerShellVersion}.`,`Mandatory inventory completed: ${completedMandatoryCases}/80 cases.`,'','| Step | Result |','|---|---|',...results.map(r=>`| ${r.step} | ${r.result} |`),'',allPassed?'Every mandatory A-O step and all 80 cases completed successfully.':failed?`First mandatory failure: ${failed.step}. Exact expected/actual case, request ordinals, errors, clocks, process state and cleanup state are retained in the step receipt and resource observations.`:'Incomplete/interrupted or integrity failure; see preserved receipts.',`Completed steps: ${completed.join(', ')||'none'}. Unexecuted steps: ${unexecuted.join(', ')||'none'}. Remaining mandatory cases: ${remainingMandatoryCases.length}.`,'','Limits: whole-helper lifecycle success <9000 ms; timeout >=9000 ms; helper-active aggregate <=20000 ms; CLI/rename admission <=30000 ms; API/worker <=10000 ms; cleanup <=2000 ms. Historical H remains NOT_ESTABLISHED. No retry, grace, late-success recovery, helper/helper overlap, or helper/worker overlap.','',`Historical evidence: ${history.length} files checked, ${historicalChanged.length} changed; none promoted. No diagnostic campaign, production change, push, tag, Phase 3BR2, Phase 3CR2, or Phase 3D execution.`,`CLI/API parity and cleanup claims are limited to retained completed observations. Byte determinism stage N: ${receipt.determinism}.`,'',`Receipt: [certification-receipt.json](../${rel}/certification-receipt.json).`,`Sealed inventory: [recovered-inventory.json](../${rel}/recovered-inventory.json).`,`Resource/cleanup: [resource-and-cleanup-observations.json](../${rel}/resource-and-cleanup-observations.json).`,...(handoff?[`Phase 3D handoff: [phase3d-handoff.json](../${rel}/phase3d-handoff.json).`]:[]),'',handoffDisposition,''];
  const report=path.join(root,'docs/mo1307-phase3ar2-c3ub.md');fs.writeFileSync(report,lines.join('\n'),{flag:'wx'});
  write('closure.json',{result:outcome,receipt:record(path.join(E,'certification-receipt.json')),handoff,report:record(report),integrity:record(path.join(E,'integrity-after.json')),commit:null,commitBinding:'Subsequent local evidence commit includes these already-existing bytes; no future self-hash is embedded.'});
  console.log(JSON.stringify({result:outcome,completed,firstFailure:failed?.step??null,unexecuted,integrity:integrity.result,receipt:record(path.join(E,'certification-receipt.json')),handoff,report}));
}
