// Authoring only until root invokes after all gates. No product/helper/test/package import or execution.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

assert.deepEqual(process.argv.slice(2,3),['--candidate']);
assert.equal(process.argv.length,4);
const candidate=process.argv[3];assert.match(candidate,/^[0-9a-f]{40}$/u);
const root='C:/m7n1',validationRoot='C:/m7fix',baseRoot='C:/m7a2';
const Erel='repositories/cca-conformance/evidence/mo1307/phase3a-n15';
const Trel='repositories/cca-conformance/tools/mo1307-phase3a-n15';
const Vrel='repositories/cca-conformance/evidence/mo1307/n15-correction';
const oldErel='repositories/cca-conformance/evidence/mo1307/phase3a-c3rb-restart';
const oldTrel='repositories/cca-conformance/tools/mo1307-phase3a-c3rb-restart';
const E=path.join(root,Erel),T=path.join(root,Trel);
const sourceCommit='bf715553bf815654098e01ddd217448f00743414';
const C3RB='defe93989efc6501b1a730b82e79e705884b269b';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const binding=(base,relative)=>{assert.ok(!path.isAbsolute(relative)&&!relative.split(/[\\/]/u).includes('..'));const bytes=fs.readFileSync(path.join(base,relative));return {path:relative.replaceAll('\\','/'),byteLength:bytes.length,sha256:hash(bytes)};};
const verify=(base,row)=>assert.deepEqual(binding(base,row.path),row);
function git(base,...args){const r=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c','safe.directory='+base,...args],{cwd:base,windowsHide:true,shell:false,encoding:null,timeout:30000,maxBuffer:32*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr.toString());return r.stdout;}
function walk(base,prefix=''){return fs.readdirSync(path.join(base,prefix),{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1).flatMap(entry=>{const relative=prefix?prefix+'/'+entry.name:entry.name;assert.equal(entry.isSymbolicLink(),false);if(entry.isDirectory())return walk(base,relative);assert.equal(entry.isFile(),true);return [binding(base,relative)];});}
const encode=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const outputs=[];
function queue(relative,bytes){assert.ok(relative.startsWith(Erel+'/'));assert.ok(!relative.split('/').includes('..'));outputs.push({relative,bytes:Buffer.isBuffer(bytes)?bytes:encode(bytes)});}
function recordQueued(relative){const rows=outputs.filter(row=>row.relative===relative);assert.equal(rows.length,1);const bytes=rows[0].bytes;return {path:relative,byteLength:bytes.length,sha256:hash(bytes)};}

// Every assertion before the first write is a static integrity/admission gate.
assert.notEqual(candidate,C3RB);
assert.notEqual(candidate,'b73f4bd6ce71228372614889d9c6da1b778df49d','A newly committed corrected candidate is required');
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(git(root,'rev-parse','HEAD').toString().trim(),candidate);
assert.equal(git(root,'branch','--show-current').toString().trim(),'codex/mo1307-phase3a-n15');
assert.equal(git(baseRoot,'rev-parse','HEAD').toString().trim(),sourceCommit);
assert.equal(git(baseRoot,'status','--porcelain=v1','--untracked-files=all').toString(),'');
assert.equal(fs.existsSync(path.join(root,'.cache/m7n1')),false,'No package preparation before activation');
assert.equal(fs.existsSync(path.join(E,'activation.json')),false,'Activation is once-only');
assert.equal(fs.existsSync(path.join(E,'baseline.json')),false);
const packageTree=git(root,'rev-parse',candidate+':repositories/memoryos-readiness').toString().trim();assert.match(packageTree,/^[0-9a-f]{40}$/u);
const validationManifest=binding(validationRoot,Vrel+'/validation-source.json');
const validation=json(path.join(validationRoot,validationManifest.path));
assert.equal(validation.kind,'MO1307N15CorrectionValidationSource');assert.equal(validation.status,'VALIDATION_SOURCE_NOT_YET_ACCEPTED_CANDIDATE');assert.equal(validation.candidate,null);
assert.equal(validation.packageMembers.length,89);assert.equal(new Set(validation.packageMembers.map(row=>row.path)).size,89);
assert.equal(validation.sourceIdentity,hash(Buffer.from(JSON.stringify(validation.packageMembers)+'\n')));
for(const row of validation.inputs)verify(validationRoot,row);
for(const row of validation.prerequisites)verify(validationRoot,row);
for(const row of validation.executables){const bytes=fs.readFileSync(row.executable);assert.equal(bytes.length,row.byteLength);assert.equal(hash(bytes),row.sha256);}
assert.equal(fs.existsSync(path.join(validationRoot,Vrel,'generation-stopped.json')),false,'Stopped validation cannot admit a candidate');
assert.deepEqual(validation.executionOrder,['n15','native-filesystem','security','regressions','toctou']);
const members=validation.packageMembers;
for(const row of members){verify(validationRoot,row);verify(root,row);assert.equal(hash(git(root,'show',candidate+':'+row.path)),row.sha256);}
assert.deepEqual(walk(path.join(root,'repositories/memoryos-readiness')).map(row=>({...row,path:'repositories/memoryos-readiness/'+row.path})),[...members].sort((a,b)=>a.path<b.path?-1:1));
const validationReceipts=validation.executionOrder.map(name=>binding(validationRoot,Vrel+'/'+name+'/receipt.json'));
const receiptMap=new Map();
const exactRecord=row=>({path:row.path,byteLength:row.byteLength,sha256:row.sha256});
const validationEvidence=[];
const bindEvidence=row=>{const bound=exactRecord(row);verify(validationRoot,bound);validationEvidence.push(bound);return bound;};
const sourceInventory=json(path.join(validationRoot,'repositories/cca-conformance/tools/mo1307-n15-correction/regression-inventory.json'));
assert.equal(sourceInventory.kind,'MO1307N15CorrectionExactRegressionInventory');assert.equal(sourceInventory.total,107);
const expectedTestIds=sourceInventory.suites.flatMap(s=>s.names.map((_,i)=>s.id+'-'+String(i+1).padStart(3,'0'))).sort();
assert.equal(expectedTestIds.length,107);assert.equal(new Set(expectedTestIds).size,107);
for(const row of validationReceipts){
 const receipt=json(path.join(validationRoot,row.path)),stage=row.path.split('/').at(-2);receiptMap.set(stage,receipt);
 assert.equal(receipt.kind,'MO1307N15CorrectionEngineeringReceipt');assert.equal(receipt.result,'PASS');assert.equal(receipt.failure,null);
 assert.equal(receipt.sourcesUnchanged,true);assert.equal(receipt.sourceFailure,null);assert.equal(receipt.sourceIdentity,validation.sourceIdentity);assert.deepEqual(receipt.source,validationManifest);assert.equal(receipt.acceptedCandidate,null);assert.equal(receipt.retries,0);
 if(stage!=='security')assert.deepEqual(receipt.notRun,[]);
 if(stage==='n15'){
  assert.equal(receipt.expectedTests,1);assert.equal(receipt.selectedTestPasses,1);assert.equal(receipt.freshSelectedTestPasses,1);assert.equal(receipt.historicalResultsPromoted,0);
  assert.deepEqual(receipt.completedSelectedIds,['native-foundation-016']);assert.deepEqual(receipt.commands.map(r=>r.id),['native-foundation-016']);assert.equal(receipt.commands[0].result,'PASS');
  assert.ok(receipt.commands[0].args.includes('--test-isolation=none'));
  bindEvidence(receipt.commands[0].stdout);bindEvidence(receipt.commands[0].stderr);bindEvidence(receipt.commands[0].nativeCapture);
  const capture=json(path.join(validationRoot,receipt.commands[0].nativeCapture.path));assert.equal(capture.selectedProcessPid,receipt.commands[0].pid);
  assert.equal(path.resolve(capture.directory),path.resolve(validationRoot,'.cache/mo1307/phase1/native-foundation-'+receipt.commands[0].pid));
  assert.deepEqual(capture.frames.map(r=>[r.sequence,r.operation,r.status]),[[1,'READ_SET','OK'],[2,'READ_SET','OK'],[3,'READ_SET','OK'],[4,'READ_SET','OK'],[4,'CHECK_OUTPUT','ABSENT'],[5,'CHECK_OUTPUT','ABSENT'],[6,'INSPECT_OUTPUT_ROOT','OK'],[7,'CHECK_STAGE_ROOT','OK'],[8,'INSPECT_PENDING','OK'],[9,'CHECK_FINALIZATION','FINAL_ABSENT']]);
  assert.ok(capture.frames.every(r=>!r.decodeFailure&&r.code===null&&r.stderrBytes===0&&r.responseSessionMatches&&r.responseSequence===r.sequence&&r.responseOperation===r.operation));
  assert.equal(capture.files.length,37);assert.equal(capture.files.filter(r=>/\/helper-\d+\.(request|stdout|stderr)$/u.test(r.path)).length,30);
  for(const file of capture.files)bindEvidence(file);
 }
 if(stage==='native-filesystem'){
  assert.equal(validation.filesystem.expectedCases,35);assert.equal(validation.filesystem.expectedHelperInvocations,39);assert.equal(validation.filesystem.shortAlias.applicable,true);
  assert.deepEqual(receipt.rows.map(x=>x.name),validation.filesystem.cases);assert.equal(receipt.rows.length,35);assert.ok(receipt.rows.every(x=>x.outcome==='PASS'));
  assert.equal(receipt.passed,35);assert.equal(receipt.failed,0);assert.equal(receipt.stopped,false);assert.equal(receipt.invocations.length,39);
  assert.ok(receipt.invocations.every(x=>x.exitCode===0&&x.signal===null&&x.error===null&&x.stderrBytes===0&&x.durationMs<5000));
 }
 if(stage==='security'){
  assert.deepEqual(receipt.rows.map(x=>x.id),'ABCDEFGHIJKLMNOPQRS'.split(''));assert.ok(receipt.rows.every(x=>x.result==='PASS'));
  assert.equal(receipt.sourceUnchanged,true);assert.deepEqual(receipt.packageMembers,members);assert.equal(receipt.newProductHelpers,0);assert.deepEqual(receipt.n15,validationReceipts[0]);
 }
 if(stage==='regressions'){
  assert.equal(receipt.expectedTests,107);assert.equal(receipt.freshSelectedTests,106);assert.equal(receipt.freshSelectedTestPasses,106);assert.equal(receipt.selectedTestPasses,107);
  assert.equal(receipt.commands.length,107);assert.ok(receipt.commands.every(x=>x.result==='PASS'));assert.equal(receipt.historicalResultsPromoted,0);assert.deepEqual(receipt.sameGenerationN15,validationReceipts[0]);
  assert.deepEqual([...receipt.completedSelectedIds].sort(),expectedTestIds);assert.equal(receipt.commands[0].id,'package-check');
  assert.deepEqual(receipt.commands.slice(1).map(x=>x.id).sort(),expectedTestIds.filter(id=>id!=='native-foundation-016'));
 }
 if(stage==='toctou'){assert.deepEqual(receipt.rows.map(x=>x.id),validation.toctouCases);assert.equal(receipt.rows.length,2);assert.ok(receipt.rows.every(x=>x.result==='PASS'));}
}
const validationSupport=['correction-decision.json','security-dependency-review.json','native-binding-metadata/receipt.json'].map(p=>binding(validationRoot,Vrel+'/'+p));
const decision=json(path.join(validationRoot,validationSupport[0].path));assert.equal(decision.result,'APPROVED_FOR_N15_VALIDATION');assert.deepEqual(decision.source,members);
for(const row of decision.evidence)bindEvidence(row);
const securityReview=json(path.join(validationRoot,validationSupport[1].path));assert.equal(securityReview.result,'PASS_STATIC');assert.equal(securityReview.sourceIdentity,validation.sourceIdentity);assert.deepEqual(securityReview.historicalRows,[]);
assert.deepEqual(securityReview.freshRows.map(r=>r.id),'ABCDEFGHIJKLMNOPQRS'.split(''));
for(const row of securityReview.freshRows){assert.equal(row.result,'PASS');assert.equal(row.sourceIdentity,validation.sourceIdentity);assert.deepEqual(row.receipt,validationReceipts[2]);bindEvidence(row.receipt);if(row.individual)bindEvidence(row.individual);}
for(const row of securityReview.bindings)bindEvidence(row);
const metadata=json(path.join(validationRoot,validationSupport[2].path));assert.equal(metadata.result,'PASS');assert.equal(metadata.sourceUnchanged,true);assert.equal(metadata.nativeApiInvocations,0);assert.equal(metadata.helperRequests,0);bindEvidence(metadata.seal);
const authorityBindings=[Vrel+'/authorization.txt','docs/mo1307-n15-correction.md','repositories/cca-conformance/evidence/mo1307/final-headless/authorization.txt','docs/mo1307-final-headless-correction-addendum.md'].map(relative=>{const row=binding(validationRoot,relative);verify(root,row);return row;});
const activation={kind:'MO1307N15Phase3AActivation',status:'CANDIDATE_BOUND_AFTER_ALL_VALIDATION_PASS',candidate,packageTree,worktree:root,branch:'codex/mo1307-phase3a-n15',validationManifest,validationReceipts,validationSupport,validationEvidence,authorityBindings,sourceIdentity:validation.sourceIdentity,productionBaseline:C3RB,productExecutionsByActivation:0,packagePreparationByActivation:false};

const oldInventoryBinding=binding(baseRoot,oldErel+'/recovered-inventory.json');
assert.equal(oldInventoryBinding.byteLength,68277);assert.equal(oldInventoryBinding.sha256,'sha256:ae927858aed6c9ddc255ed0efb9fb74160ffbd899f9780aa6c3f9109ae51b784');
const inventory=json(path.join(baseRoot,oldInventoryBinding.path));
assert.equal(inventory.sourceSnapshots.length,39);assert.deepEqual(inventory.steps.map(row=>row.step),'ABCDEFGHIJKLMNO'.split(''));
assert.deepEqual(inventory.steps.map(row=>row.cases.length),[1,1,1,1,1,7,7,7,4,1,7,22,18,1,1]);
assert.ok(inventory.steps.every(row=>row.mandatory===true&&row.executionStatus==='NOT_RUN'));
const copiedSnapshots=[];
for(const row of inventory.sourceSnapshots){const src=oldErel+'/'+row.snapshot;const bytes=fs.readFileSync(path.join(baseRoot,src));assert.equal(bytes.length,row.byteLength);assert.equal(hash(bytes),row.sha256);const relative=Erel+'/'+row.snapshot;queue(relative,bytes);copiedSnapshots.push({source:{...binding(baseRoot,src),root:baseRoot},destination:recordQueued(relative),interpretation:'Historical definition/authority only; no execution outcome promoted.'});}
queue(Erel+'/recovered-inventory.original.json.data',fs.readFileSync(path.join(baseRoot,oldInventoryBinding.path)));
const oldJ=structuredClone(inventory.steps.find(row=>row.step==='J').cases[0].expected);
inventory.kind='MO1307N15RecoveredCertificationInventory';inventory.candidate=candidate;
inventory.status='RECOVERED_ADAPTED_NOT_EXECUTED_NOT_ACCEPTED';inventory.filesWrittenOnlyUnder=E;
inventory.currentAuthority={authorization:authorityBindings[0],correctionSpecification:authorityBindings[1],headlessAuthorization:authorityBindings[2],headlessAddendum:authorityBindings[3],validationManifest,validationReceipts,validationSupport,sourceIdentity:validation.sourceIdentity,candidate,packageTree,prospectiveOnly:true};
inventory.definitionRecovery={sourceCommit,sourceInventory:recordQueued(Erel+'/recovered-inventory.original.json.data'),originalSteps:15,sourceSnapshots:39,originalCaseDefinitionCounts:[1,1,1,1,1,7,7,7,4,1,7,22,18,1,1],historicalOutcomesPromoted:false};
const j=inventory.steps.find(row=>row.step==='J').cases[0].expected;
j.externalTimeoutProof='Exactly one held helper object signaled and three streams closed within the unchanged 2000ms terminal cleanup deadline. Zero or one actually identified optional console object; every identified object must signal within the same measured QPC upper bound. No unidentified-host death or complete host-absence claim.';
j.optionalObservedConsoleCounts=[0,1];j.unidentifiedHostTerminationClaim=false;j.strictDeadlineRelation='cleanupDeadline === terminalAt + 2000';
inventory.prospectiveInventoryAdaptations=[{step:'J',field:'cases[0].expected',prior:oldJ,current:j,authority:authorityBindings[3],scope:'Only expressly superseded mandatory console-host presence/termination wording; process ceiling1 supervisor+1helper+optional1host, required helper/process/streams, role serialization, limits and expected semantic outcomes unchanged.'}];
inventory.sealDisposition='Fresh complete final tools, this adapted inventory, all authority snapshots, exact source/install/prepared inputs and new authority require independent static review and a once-only seal before A-O. This inventory records no current outcome.';
queue(Erel+'/recovered-inventory.json',inventory);

const previousDefinitions=[
 {root:'C:/m7a',commit:'7c2882480a4deebf39cae6b8afe42794f000539e',receipt:'repositories/cca-conformance/evidence/mo1307/phase3a-c3rb-cert/certification-receipt.json',sha256:'sha256:8c216030a88b2e491ad878b471c61981ad05eaed6a5a146179f66940b4c93776',failed:'J'},
 {root:baseRoot,commit:sourceCommit,receipt:oldErel+'/certification-receipt.json',sha256:'sha256:65f58b06e200e397059222f6fc56cff299fe7e83c3f2148230dfdfb36d9fa975',failed:'G'},
];
const previous=previousDefinitions.map(previous=>{assert.equal(git(previous.root,'rev-parse','HEAD').toString().trim(),previous.commit);assert.equal(git(previous.root,'status','--porcelain=v1','--untracked-files=all').toString(),'');const b=binding(previous.root,previous.receipt);assert.equal(b.sha256,previous.sha256);const r=json(path.join(previous.root,previous.receipt));assert.equal(r.result,'FAILED/INCOMPLETE');assert.equal(r.firstMandatoryFailure.step,previous.failed);return {root:previous.root,commit:previous.commit,receipt:b,result:r.result,completed:r.completed,firstMandatoryFailure:previous.failed,notRun:r.unexecuted,preservedReadOnly:true,observationsReused:false};});
queue(Erel+'/prior-generation-binding.json',{kind:'MO1307N15PriorGenerationsBinding',candidate,packageTree,priorGenerations:previous,currentCorrectionValidation:validationReceipts,definitionReuseOnly:true,noHistoricalPassPromotion:true,stoppedCorrectionGenerations:'Preserve all prior console-correction, wire-repair, startup-exit22, headless-cleanup and startup-resolution evidence/tools/docs; preparation records the recursive preservation baseline before A-O.',productExecutions:0});

const observerFiles=['cleanup-topology.mjs','observe-command.py','runtime-controls-run.py'];
const currentSnippetSource=fs.readFileSync(path.join(T,'cleanup-topology.mjs'),'utf8');
const oldSnippetSource=fs.readFileSync(path.join(baseRoot,oldTrel,'cleanup-topology.mjs'),'utf8');
const block=/\/\* BEGIN exact cleanup allowance relation \*\/[\s\S]*?\/\* END exact cleanup allowance relation \*\//gu;
const currentMatches=[...currentSnippetSource.matchAll(block)],oldMatches=[...oldSnippetSource.matchAll(block)];
assert.equal(currentMatches.length,1);assert.equal(oldMatches.length,1);assert.equal(currentMatches[0][0],oldMatches[0][0]);
const snippet=currentMatches[0][0];
assert.ok(snippet.includes('Number.isFinite(H.timeoutCleanupTiming.terminalAtMs)&&H.timeoutCleanupTiming.terminalAtMs>=0'));
assert.ok(snippet.includes('Number.isFinite(H.timeoutCleanupTiming.cleanupDeadlineAtMs)&&H.timeoutCleanupTiming.cleanupDeadlineAtMs>H.timeoutCleanupTiming.terminalAtMs'));
assert.ok(snippet.includes('assert.equal(H.timeoutCleanupTiming.cleanupDeadlineAtMs,H.timeoutCleanupTiming.terminalAtMs+2000)'));
for(const relative of ['src/runtime.mjs','contracts/definitions.json'])assert.equal(hash(fs.readFileSync(path.join(root,'repositories/memoryos-readiness',relative))),hash(git(baseRoot,'show',C3RB+':repositories/memoryos-readiness/'+relative)));
const numericProvenance=[];
for(const [name,expected] of [['independent-review.json','sha256:0bf2f8211f072a9b8625e7501f2596b47a401fee325fc8dd2cb052787da21fb8'],['provenance-and-correction.json','sha256:994e27355440118af950cfb229cb2b00c183fb7f4374057a3449a4f5abe97fc6']]){const relative=oldErel+'/harness-correction/'+name;const b=binding(baseRoot,relative);assert.equal(b.sha256,expected);const destination=Erel+'/numeric-history/'+name+'.data';queue(destination,fs.readFileSync(path.join(baseRoot,relative)));numericProvenance.push({source:{root:baseRoot,...b},snapshot:recordQueued(destination),use:'Closed numeric provenance only; not current cleanup observations, not reexecuted.'});}
queue(Erel+'/cleanup-authority-review.json',{kind:'MO1307N15CleanupAuthorityStaticReview',result:'PASS_STATIC',candidate,numericRelation:'cleanupDeadline === terminalAt + 2000',epsilon:0,historicalObservationsPromoted:false,scope:'Static exact-source equality and prospective observer-policy bindings only; independent whole-harness review of all exact current modules remains required before seal.',authorityBindings,reviewedModules:observerFiles.map(name=>binding(root,Trel+'/'+name)),sourceBindings:['src/runtime.mjs','contracts/definitions.json','src/helper-transport.mjs','helpers/windows-inspect.ps1'].map(name=>binding(root,'repositories/memoryos-readiness/'+name)),inheritedDeadlineCheck:{sourceCommit,source:binding(baseRoot,oldTrel+'/cleanup-topology.mjs'),snippet,byteIdentical:true,finiteAndNonnegativeTerminal:true,finiteIncreasingDeadline:true,strictForwardEquality:true,allowanceMs:2000,epsilonMs:0,toleranceMs:0,timingSlackMs:0,numericProvenance},optionalHostPolicy:{observedPerHelper:[0,1],requiredHeldHelperObjects:1,allActuallyIdentifiedObjectsMustSignal:true,absentHostSignal:null,unidentifiedHostTerminationClaim:false,completeAbsenceClaim:false,maxSupervisor:1,maxHelper:1,maxOptionalHost:1,maxProductProcesses:3,worker:'thread',helperOrWorkerOverlapAllowed:false,timeoutAcceptance:'Existing conservative QPC ready/ack offset upper bound and actual stream closure timestamps, with no UTC-clock acceptance or added grace.'},mandatoryClosure:'Valid response, helper exit, stdout/stderr EOF, stdin completion/closure, all3 stream closures, known-owned-resource closure, no active role, no helper/helper or helper/worker overlap; killed-helper cleanupConfirmed remains conservative false.',historicalValidator:'Excluded from active tooling; no numeric issue reopened or validator reexecuted.',productExecutions:0,helperExecutions:0,testsExecuted:0,certificationAcceptance:false});

assert.equal(fs.existsSync(path.join(T,'validate-correction.mjs')),false,'Closed historical validator must not be active');
const toolBefore=walk(T);assert.equal(toolBefore.length,25);assert.ok(toolBefore.every(row=>!row.path.endsWith('.pending')));
const oldTools=walk(path.join(baseRoot,oldTrel));assert.equal(oldTools.length,25);
const adaptationBindingRelative=Trel+'/adaptation-source-bindings.json';
assert.ok(fs.existsSync(path.join(root,adaptationBindingRelative)));
const modules=toolBefore.map(row=>({source:fs.existsSync(path.join(baseRoot,oldTrel,row.path))?binding(baseRoot,oldTrel+'/'+row.path):null,current:binding(root,Trel+'/'+row.path),change:observerFiles.includes(row.path)?'Optional-host observation adaptation; exact inherited J arithmetic retained': ['prepare.mjs','common.mjs','campaign.mjs','method.mjs'].includes(row.path)?'New candidate, N15 validation/authority, fresh package/install and complete seal provenance':row.path==='README.md'?'New activation and execution instructions':row.path==='adaptation-source-bindings.json'?'Static adapted-tool provenance manifest; candidate-bound identity lives in evidence':'Mechanical generation-path migration only; no case/expectation edits'}));
const finalToolBindings=toolBefore.map(row=>binding(root,Trel+'/'+row.path));
queue(Erel+'/tooling-adaptation.json',{kind:'MO1307N15ToolingAdaptation',status:'STATIC_PREPARATION_NOT_EXECUTED',candidate,packageTree,sourceCommit,sourceRoot:baseRoot,sourceToolFiles:25,activeToolFiles:25,tools:finalToolBindings,modules,sourceBindings:binding(root,adaptationBindingRelative),inventory:recordQueued(Erel+'/recovered-inventory.json'),originalInventory:recordQueued(Erel+'/recovered-inventory.original.json.data'),authoritySnapshots:copiedSnapshots,sourceSnapshotCount:39,cleanupReview:recordQueued(Erel+'/cleanup-authority-review.json'),numericHistory:numericProvenance,authorityBindings,validationSupport,caseDefinitionCounts:[1,1,1,1,1,7,7,7,4,1,7,22,18,1,1],expectedSemanticOutcomesChanged:false,limitsChanged:false,prospectiveObserverPolicy:'Only the expressly authorized optional-host cleanup-observation predicate is adapted. No unidentified host death claim.',historicalOutcomesPromoted:false,productExecutions:0});
queue(Erel+'/activation-script.mjs.data',fs.readFileSync(fileURLToPath(import.meta.url)));
queue(Erel+'/activation.json',activation);
assert.equal(new Set(outputs.map(row=>row.relative)).size,outputs.length);
for(const row of outputs)assert.equal(fs.existsSync(path.join(root,row.relative)),false,'No activation output may already exist: '+row.relative);
// All outputs are fresh evidence. No prepared or reviewed tool byte is rewritten.
for(const row of outputs){const dest=path.join(root,row.relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,row.bytes,{flag:'wx'});}
console.log(JSON.stringify({result:'ACTIVATED_SOURCE_AND_AUTHORITY_ONLY',candidate,packageTree,sourceIdentity:validation.sourceIdentity,inventorySteps:15,authoritySnapshots:39,toolFiles:25,outputs:outputs.length,productExecutions:0,packagePreparation:false}));
