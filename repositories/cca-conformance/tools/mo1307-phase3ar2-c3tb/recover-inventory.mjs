import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  root,
  E,
  T,
  relativeE,
  HEAD,
  C3TB,
  C3T,
  authority,
  hash,
  json,
  record,
  write,
  git,
  str,
  identity,
} from './common.mjs';

// Definition recovery only. This program reads local Git objects and tracked
// authority files, then writes two fresh preparation records. It does not load
// the product, use the network, install a package, or execute a certification.
assert.equal(process.argv.length,2,'recover-inventory.mjs accepts no arguments');
identity();

const sourceRevision='bf715553';
const sourceCommit='bf715553bf815654098e01ddd217448f00743414';
const sourcePath='repositories/cca-conformance/evidence/mo1307/phase3a-c3rb-restart/recovered-inventory.json';
const sourceBlob='a30be79898ec9cd22101d9b11532375697d5854a';
const sourceByteLength=68277;
const sourceSha256='sha256:ae927858aed6c9ddc255ed0efb9fb74160ffbd899f9780aa6c3f9109ae51b784';
const historicalCandidate='defe93989efc6501b1a730b82e79e705884b269b';
const historicalIntegrationAuthority='4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97';
const productionTree='324bf600b6cbfaa8564db27fce2d999711270cb8';
const toolNamespace='repositories/cca-conformance/tools/mo1307-phase3ar2-c3tb';
const expectedSections='ABCDEFGHIJKLMNO'.split('');
const expectedCaseIds={
  A:['mo1306-qualified'],
  B:['ready'],
  C:['not-ready'],
  D:['could-not-evaluate'],
  E:['rest-qualified'],
  F:['ready-approve','ready-reject','qualified-approve','not-ready-attempted-approve','candidate-mismatch','readiness-mismatch','proof-mismatch'],
  G:['pre-tag-absent','post-tag-ready','pre-tag-present','post-tag-absent','post-tag-lightweight','post-tag-wrong-target','post-tag-wrong-name'],
  H:['timely-helper','cancel-before-helper','helper-timeout','late-helper-success-rejected','cancel-during-helper','cancel-between-helper-worker','aggregate-helper-exhaustion'],
  I:['worker-timeout','worker-cancellation','late-worker-result-rejected','cancel-after-worker-before-publication'],
  J:['timeout-cleanup-and-serialized-process-topology'],
  K:['timely','pre-admission-timeout','pre-admission-cancel','post-admission-timeout','post-admission-cancel','native-rename-failure','post-commit-stdout-failure'],
  L:['ordinary-read-and-seven-field-native-identity','actual-junction-reparse-refused','actual-hardlink-refused','actual-wrong-type-refused','native-replacement-fresh-identity-and-consumer-refusal','native-size-change-freshness-and-consumer-refusal','native-changed-final-path-and-consumer-refusal','native-short-alias-final-path-mismatch-refused','native-path-refusal-traversal','native-path-refusal-ads','native-path-refusal-reserved','native-path-refusal-trailing-dot','native-path-refusal-trailing-space','native-root-refusal-drive-relative','native-root-refusal-unc','native-root-refusal-device','native-missing-ancestor-refused','native-missing-file-is-input-failure','actual-publication-existing-output-preserved','actual-publication-existing-pending-preserved','actual-publication-existing-final-preserved','actual-publication-same-byte-replacement-refused'],
  M:['fixed-production-helper-launch-under-combined-environment-poison','actual-worker-empty-environment-execargv-resource-limits','actual-cli-node-options-empty','actual-cli-node-options-option','actual-cli-node-path','actual-cli-preload','actual-cli-import','actual-cli-loader','actual-cli-inspect-config','actual-cli-proxy-credential-path-poison-fixed-helper','launch-guard---require=untrusted','launch-guard---import=untrusted','launch-guard---loader=untrusted','launch-guard---experimental-loader=untrusted','launch-guard---inspect','launch-guard---inspect-brk','launch-guard---debug','launch-guard---debug-brk'],
  N:['A-E-canonical-byte-and-digest-determinism'],
  O:['mo1306-qualified-final'],
};
const expectedCounts=expectedSections.map(step=>expectedCaseIds[step].length);
assert.deepEqual(expectedCounts,[1,1,1,1,1,7,7,7,4,1,7,22,18,1,1]);
assert.equal(expectedCounts.reduce((sum,count)=>sum+count,0),80);

assert.equal(HEAD,C3TB);
assert.equal(str('rev-parse',sourceRevision+'^{commit}'),sourceCommit);
assert.equal(str('rev-parse',sourceCommit+':'+sourcePath),sourceBlob);
assert.equal(str('show','-s','--format=%P',C3TB),C3T);
assert.equal(str('rev-parse',C3TB+':repositories/memoryos-readiness'),productionTree);
assert.equal(str('rev-parse',C3T+':repositories/memoryos-readiness'),productionTree);

const sourceBytes=git('show',sourceCommit+':'+sourcePath);
assert.equal(sourceBytes.length,sourceByteLength);
assert.equal(hash(sourceBytes),sourceSha256);
const sourceInventory=JSON.parse(sourceBytes.toString('utf8'));
assert.equal(sourceInventory.kind,'MO1307Phase3ARecoveredCertificationInventory');
assert.equal(sourceInventory.status,'RECOVERED_NOT_EXECUTED_NOT_ACCEPTED');
assert.equal(sourceInventory.candidate,historicalCandidate);
assert.equal(sourceInventory.integrationAuthority,historicalIntegrationAuthority);
assert.equal(sourceInventory.sourceSnapshots.length,39);
assert.equal(sourceInventory.productExecutionPerformed,false);
assert.equal(sourceInventory.historicalFilesModified,false);
assert.equal(sourceInventory.authentication.newCertificationEvidence,false);
assert.deepEqual(sourceInventory.steps.map(row=>row.step),expectedSections);
assert.deepEqual(sourceInventory.steps.map(row=>row.cases.length),expectedCounts);
assert.deepEqual(Object.fromEntries(sourceInventory.steps.map(row=>[row.step,row.cases.map(item=>item.case)])),expectedCaseIds);
assert.ok(sourceInventory.steps.every(row=>row.mandatory===true&&row.executionStatus==='NOT_RUN'));
const sourceCases=sourceInventory.steps.flatMap(row=>row.cases);
assert.equal(sourceCases.length,80);
assert.ok(sourceCases.every(item=>item.mandatory===true));
assert.ok(sourceCases.every(item=>!Object.hasOwn(item,'executionStatus')&&!Object.hasOwn(item,'result')),'Historical case schema unexpectedly contains execution fields');

const authorityFileSpecifications=[
  {role:'PROSPECTIVE_BOUND_AUTHORITY',path:'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/authority.json',byteLength:1934,sha256:'sha256:ba8f9f085d8339348f69bd777fd0619b4d7594b9566b72cd0e5af6a3ed39b9b0'},
  {role:'PROSPECTIVE_CANDIDATE_RECORD',path:'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/candidate.json',byteLength:20084,sha256:'sha256:38a20eecd128be0407b926ad3064d6e3f5e66ec62f96787c3a634e7992faf76d'},
  {role:'CHANGED_FILE_INVENTORY',path:'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/changed-file-inventory.json',byteLength:3947,sha256:'sha256:05a43964b8a218f39be13237237bcd3b8062da1cc2add1fb3facb1d7c0570955'},
  {role:'CONSISTENCY_VALIDATION',path:'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/consistency-validation.json',byteLength:2567,sha256:'sha256:8362dbf4418fe234226c773758a3e490f6d9d67738447940ce96c9dd1ca00346'},
  {role:'PHASE_3A_HANDOFF',path:'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/phase3a-handoff.json',byteLength:958,sha256:'sha256:2c544b27bcc2b8843e0e7ef1eb9cfa7ceb1beb69ba9e90a0c142499d35c60521'},
  {role:'PHASE_3B_REFRESH_MAP',path:'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/phase3b-refresh-map.json',byteLength:1520,sha256:'sha256:96457347f72b9aab0f7dfaf8d7c55cf9226c7bc6e85697aef3a7a104b7981391'},
  {role:'PHASE_3C_REFRESH_MAP',path:'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/phase3c-refresh-map.json',byteLength:21293,sha256:'sha256:ada9532c868c69d7b6b951535f8f4a501c728a24057da6423308d5540192c16b'},
  {role:'CANDIDATE_BINDING',path:'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/binding.json',byteLength:27189,sha256:'sha256:dde0766b80e65bc3426a6c2bdc3208bdd1b8ecd7ca17aa2594449cfe6ccb7175'},
  {role:'BINDING_VERIFICATION',path:'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/binding-verification.json',byteLength:1155,sha256:'sha256:f322d1ba53a9ab18fc3638b367fb770b5c2d47a1dd5ffbe7ae06ad82373555d1'},
  {role:'PROSPECTIVE_BOUND_SPECIFICATION',path:'docs/mo1307-prospective-helper-bound-candidate.md',byteLength:3912,sha256:'sha256:ba31d9a35635484db0207910a598dfea2bc191bc9fc88c175e3b5820df90e380'},
  {role:'FINAL_HEADLESS_AUTHORIZATION',path:'repositories/cca-conformance/evidence/mo1307/final-headless/authorization.txt',byteLength:12394,sha256:'sha256:31442e397007ead68da717088a502d4b0d860580bb34518b19d83097a89cbd66'},
  {role:'FINAL_HEADLESS_ADDENDUM',path:'docs/mo1307-final-headless-correction-addendum.md',byteLength:11416,sha256:'sha256:40303f1c51637de94057fc5203c6729bf9763496d4e63640278f1d10b0be6024'},
];
const currentAuthorityBindings=authorityFileSpecifications.map(({role,...expected})=>{
  const actual=record(expected.path);
  assert.deepEqual(actual,expected);
  const committedBytes=git('show',C3TB+':'+expected.path);
  assert.equal(committedBytes.length,expected.byteLength);
  assert.equal(hash(committedBytes),expected.sha256);
  return {role,...actual,gitBlob:str('rev-parse',C3TB+':'+expected.path)};
});

const authorityDocument=json(authorityFileSpecifications[0].path);
const handoff=json(authorityFileSpecifications[4].path);
const binding=json(authorityFileSpecifications[7].path);
const bindingVerification=json(authorityFileSpecifications[8].path);
const expectedLimits={aggregateHelperActiveMs:20000,apiMs:10000,cleanupMs:2000,cliAdmissionMs:30000,helperMs:8000,workerMs:10000};
assert.equal(authorityDocument.identity,authority);
assert.equal(authorityDocument.status,'ADOPTED_PROSPECTIVELY');
assert.equal(authorityDocument.valueMs,8000);
assert.deepEqual(authorityDocument.limits,expectedLimits);
assert.deepEqual(authorityDocument.relation,{equality:'TIMEOUT',success:'elapsedMs < 8000',timeout:'elapsedMs >= 8000'});
assert.equal(authorityDocument.cleanup.separateAllowanceMs,2000);
assert.equal(authorityDocument.cleanup.beginsAfterTerminalHelperOutcome,true);
assert.equal(authorityDocument.cleanup.successGrace,false);
assert.equal(handoff.authority,authority);
assert.equal(handoff.candidateRole,'C3T');
assert.equal(handoff.consumeRule,'EXACT_C3TB_HEAD_AFTER_BINDING_VERIFICATION');
assert.equal(handoff.mode,'FRESH_FULL_A_TO_O');
assert.equal(handoff.certificationStarted,false);
assert.deepEqual(handoff.inventory,expectedSections);
assert.deepEqual(handoff.limits,expectedLimits);
assert.equal(binding.result,'NEW_PRODUCTION_CANDIDATE_READY_FOR_PHASE3');
assert.equal(binding.candidateRole,'C3T');
assert.equal(binding.bindingRole,'C3TB');
assert.equal(binding.binding.soleParent,C3T);
assert.equal(binding.binding.productionChanges,false);
assert.equal(binding.phase3AExecuted,false);
assert.deepEqual(binding.limits,expectedLimits);
assert.equal(bindingVerification.result,'PASS');
assert.equal(bindingVerification.candidateCommit,C3T);
assert.equal(bindingVerification.productionTree,productionTree);
assert.equal(bindingVerification.productionChangesInBindingCommit,false);
assert.equal(bindingVerification.certificationExecuted,false);

const inventory=structuredClone(sourceInventory);
const originalMetadata={
  kind:sourceInventory.kind,
  status:sourceInventory.status,
  candidate:sourceInventory.candidate,
  integrationAuthority:sourceInventory.integrationAuthority,
  historicalAuthorityRoot:sourceInventory.historicalAuthorityRoot,
  authorityChain:sourceInventory.authorityChain,
  authentication:sourceInventory.authentication,
  filesWrittenOnlyUnder:sourceInventory.filesWrittenOnlyUnder,
};
inventory.kind='MO1307Phase3AR2C3TBRecoveredCertificationInventory';
inventory.status='RECOVERED_ADAPTED_NOT_EXECUTED_NOT_ACCEPTED';
inventory.candidate=C3TB;
inventory.candidateRole='C3TB';
inventory.productionCandidate=C3T;
inventory.productionRole='C3T';
inventory.productionTree=productionTree;
inventory.integrationAuthority=authority;
inventory.authorityChain=currentAuthorityBindings;
inventory.authentication={
  sourceGitObjectVerified:true,
  currentAuthorityFilesVerified:currentAuthorityBindings.length,
  historicalOutcomesPromoted:false,
  newCertificationEvidence:false,
  productExecutions:0,
  helperExecutions:0,
  workerExecutions:0,
  networkUsed:false,
};
inventory.sourceSnapshots=inventory.sourceSnapshots.map(row=>({...row,interpretation:'HISTORICAL_DEFINITION_AUTHORITY_ONLY_NO_OUTCOME_PROMOTION'}));
inventory.limits.helperWholeLifecycleMs=8000;
inventory.limits.replacementHelperBoundH='NOT_ESTABLISHED';
inventory.helperBoundary={
  wholeLifecycleMs:8000,
  success:'elapsedMs < 8000',
  timeout:'elapsedMs >= 8000',
  equality:'TIMEOUT',
  cleanupBeginsAfterTerminalOutcome:true,
  cleanupAllowanceMs:2000,
  successGrace:false,
  retry:false,
  lateSuccessRecovery:false,
  lifecycle:authorityDocument.lifecycle,
};
inventory.namespace={evidence:relativeE,tools:toolNamespace,cache:'.cache/phase3ar2-c3tb',report:'docs/mo1307-phase3ar2-c3tb.md'};
inventory.filesWrittenOnlyUnder=[relativeE,'.cache/phase3ar2-c3tb','docs/mo1307-phase3ar2-c3tb.md'];
inventory.historicalFilesModified=false;
inventory.productExecutionPerformed=false;
inventory.currentAuthority={
  identity:authority,
  candidate:C3TB,
  productionCandidate:C3T,
  productionTree,
  prospectiveOnly:true,
  certificationStarted:false,
  bindings:currentAuthorityBindings,
};
inventory.definitionRecovery={
  method:'LOCAL_GIT_SHOW_DEFINITION_ONLY',
  source:{
    requestedRevision:sourceRevision,
    commit:sourceCommit,
    path:sourcePath,
    selector:sourceCommit+':'+sourcePath,
    blob:sourceBlob,
    byteLength:sourceByteLength,
    sha256:sourceSha256,
  },
  originalMetadata,
  sourceSteps:15,
  sourceSnapshots:39,
  sourceCaseDefinitionCounts:expectedCounts,
  sourceCases:80,
  sourceCaseSchemaHadExecutionStatus:false,
  sourceCaseSchemaHadResult:false,
  historicalOutcomesPromoted:false,
  sourceBytesCopiedAsOutcomeEvidence:false,
};

for(const step of inventory.steps){
  step.executionStatus='NOT_RUN';
  step.result='NOT_RUN';
  const moduleName=step.historicalHarnessDefinition.slice(step.historicalHarnessDefinition.lastIndexOf('/')+1);
  step.currentHarnessDefinition=toolNamespace+'/'+moduleName;
  step.historicalAuthorityInterpretation='DEFINITION_ONLY_NO_OUTCOME_PROMOTION';
  for(const item of step.cases){
    item.executionStatus='NOT_RUN';
    item.result='NOT_RUN';
  }
}

const helperStep=inventory.steps.find(row=>row.step==='H');
const timelyHelper=helperStep.cases.find(row=>row.case==='timely-helper');
const helperTimeout=helperStep.cases.find(row=>row.case==='helper-timeout');
timelyHelper.expected.durationMs='<8000';
timelyHelper.expected.successRelation='elapsedMs < 8000';
helperTimeout.expected.clock='8000 ms whole helper lifecycle';
helperTimeout.expected.timeoutRelation='elapsedMs >= 8000';
helperTimeout.expected.equality='TIMEOUT';
helperTimeout.historicalSourceCase=helperTimeout.sourceCase;
helperTimeout.sourceCase='helper-8000ms-timeout';
helperStep.currentBoundary=inventory.helperBoundary;

const cleanupStep=inventory.steps.find(row=>row.step==='J');
const cleanupExpected=cleanupStep.cases[0].expected;
cleanupExpected.externalTimeoutProof='Exactly one held helper object signaled and three streams closed within the unchanged 2000 ms terminal cleanup deadline. Zero or one actually identified optional console object; every identified object must signal within the same measured QPC upper bound. No unidentified-host death or complete host-absence claim.';
cleanupExpected.optionalObservedConsoleCounts=[0,1];
cleanupExpected.requiredHeldHelperObjects=1;
cleanupExpected.unidentifiedHostTerminationClaim=false;
cleanupExpected.completeConsoleHostAbsenceClaim=false;
cleanupExpected.strictDeadlineRelation='cleanupDeadline === terminalAt + 2000';
cleanupExpected.epsilonMs=0;
cleanupExpected.toleranceMs=0;
cleanupExpected.timingSlackMs=0;

inventory.prospectiveInventoryAdaptations=[
  {scope:'IDENTITY',from:{candidate:historicalCandidate,integrationAuthority:historicalIntegrationAuthority},to:{candidate:C3TB,productionCandidate:C3T,productionTree,integrationAuthority:authority},historicalOutcomePromoted:false},
  {scope:'NAMESPACE',to:{evidence:relativeE,tools:toolNamespace},historicalOutcomePromoted:false},
  {scope:'H_HELPER_BOUNDARY',from:{wholeLifecycleMs:5000,success:'elapsedMs < 5000',timeout:'elapsedMs >= 5000'},to:{wholeLifecycleMs:8000,success:'elapsedMs < 8000',timeout:'elapsedMs >= 8000',equality:'TIMEOUT'},authority:currentAuthorityBindings.find(row=>row.role==='PROSPECTIVE_BOUND_AUTHORITY'),historicalOutcomePromoted:false},
  {scope:'J_OPTIONAL_CONSOLE_OBSERVATION',to:{optionalObservedConsoleCounts:[0,1],requiredHeldHelperObjects:1,unidentifiedHostTerminationClaim:false,strictDeadlineRelation:'cleanupDeadline === terminalAt + 2000'},authority:currentAuthorityBindings.find(row=>row.role==='FINAL_HEADLESS_ADDENDUM'),historicalOutcomePromoted:false},
  {scope:'EXECUTION_BOOKKEEPING',to:{steps:'NOT_RUN',cases:{executionStatus:'NOT_RUN',result:'NOT_RUN'}},note:'The recovered source has step-level executionStatus but no case-level executionStatus/result properties; explicit case bookkeeping is added without changing case IDs or non-authority-superseded definitions.',historicalOutcomePromoted:false},
];
inventory.sealDisposition='Preparation only. Independently review and seal the exact final Phase 3AR2 C3TB tools, this recovered inventory, current authority, fresh installed package, fixtures, and prepared inputs before the first A-O execution. This inventory confers no certification PASS or acceptance.';

assert.deepEqual(inventory.steps.map(row=>row.step),expectedSections);
assert.deepEqual(inventory.steps.map(row=>row.cases.length),expectedCounts);
assert.deepEqual(Object.fromEntries(inventory.steps.map(row=>[row.step,row.cases.map(item=>item.case)])),expectedCaseIds);
assert.equal(inventory.steps.flatMap(row=>row.cases).length,80);
assert.ok(inventory.steps.every(row=>row.mandatory===true&&row.executionStatus==='NOT_RUN'&&row.result==='NOT_RUN'));
assert.ok(inventory.steps.flatMap(row=>row.cases).every(item=>item.mandatory===true&&item.executionStatus==='NOT_RUN'&&item.result==='NOT_RUN'));
assert.equal(inventory.limits.helperWholeLifecycleMs,8000);
assert.equal(inventory.limits.aggregateHelperActiveMs,20000);
assert.equal(inventory.limits.cliRenameAdmissionMs,30000);
assert.equal(inventory.limits.apiWorkerMs,10000);
assert.equal(inventory.limits.failureCleanupMs,2000);
assert.equal(inventory.limits.replacementHelperBoundH,'NOT_ESTABLISHED');
assert.equal(timelyHelper.expected.durationMs,'<8000');
assert.equal(helperTimeout.expected.timeoutRelation,'elapsedMs >= 8000');
assert.equal(cleanupExpected.strictDeadlineRelation,'cleanupDeadline === terminalAt + 2000');
assert.deepEqual(inventory.steps.find(row=>row.step==='O').cases.map(row=>row.case),['mo1306-qualified-final']);

// Prove all case definitions survive exactly except for the two recorded,
// current-authority adaptations. Execution bookkeeping is not a definition.
const recoveredDefinitions=inventory.steps.map(row=>row.cases.map(item=>{
  const copy=structuredClone(item);
  delete copy.executionStatus;
  delete copy.result;
  return copy;
}));
const sourceDefinitions=sourceInventory.steps.map(row=>structuredClone(row.cases));
const recoveredH=recoveredDefinitions[expectedSections.indexOf('H')],sourceH=sourceDefinitions[expectedSections.indexOf('H')];
const normalizedTimely=recoveredH.find(row=>row.case==='timely-helper'),sourceTimely=sourceH.find(row=>row.case==='timely-helper');
normalizedTimely.expected.durationMs=sourceTimely.expected.durationMs;delete normalizedTimely.expected.successRelation;
const normalizedTimeout=recoveredH.find(row=>row.case==='helper-timeout'),sourceTimeout=sourceH.find(row=>row.case==='helper-timeout');
normalizedTimeout.expected.clock=sourceTimeout.expected.clock;delete normalizedTimeout.expected.timeoutRelation;delete normalizedTimeout.expected.equality;
normalizedTimeout.sourceCase=sourceTimeout.sourceCase;delete normalizedTimeout.historicalSourceCase;
const recoveredJ=recoveredDefinitions[expectedSections.indexOf('J')][0],sourceJ=sourceDefinitions[expectedSections.indexOf('J')][0];
recoveredJ.expected.externalTimeoutProof=sourceJ.expected.externalTimeoutProof;
for(const key of ['optionalObservedConsoleCounts','requiredHeldHelperObjects','unidentifiedHostTerminationClaim','completeConsoleHostAbsenceClaim','strictDeadlineRelation','epsilonMs','toleranceMs','timingSlackMs'])delete recoveredJ.expected[key];
assert.deepEqual(recoveredDefinitions,sourceDefinitions);

function findStringPaths(value,needle,at='$',out=[]){
  if(typeof value==='string'){
    if(value.includes(needle))out.push(at);
    return out;
  }
  if(Array.isArray(value)){
    value.forEach((item,index)=>findStringPaths(item,needle,at+'['+index+']',out));
    return out;
  }
  if(value&&typeof value==='object')for(const [key,item] of Object.entries(value))findStringPaths(item,needle,at+'.'+key,out);
  return out;
}
const historicalCandidatePaths=findStringPaths(inventory,historicalCandidate);
assert.ok(historicalCandidatePaths.length>0);
assert.ok(historicalCandidatePaths.every(item=>item.startsWith('$.sourceSnapshots[')||item.startsWith('$.definitionRecovery.')||item.startsWith('$.prospectiveInventoryAdaptations[')),'Historical candidate appears in a current-identity field');
assert.equal(inventory.candidate,C3TB);
assert.equal(inventory.productionCandidate,C3T);
assert.equal(inventory.integrationAuthority,authority);
assert.equal(inventory.authentication.historicalOutcomesPromoted,false);
assert.equal(inventory.authentication.productExecutions,0);

const outputNames=['recovered-inventory.json','inventory-validation.json'];
for(const name of outputNames)assert.equal(fs.existsSync(path.join(E,name)),false,'Fresh output already exists: '+name);
const inventoryBytes=Buffer.from(JSON.stringify(inventory,null,2)+'\n');
const inventoryBinding={path:relativeE+'/recovered-inventory.json',byteLength:inventoryBytes.length,sha256:hash(inventoryBytes)};
const validation={
  kind:'MO1307Phase3AR2C3TBInventoryValidation',
  version:'1.0.0',
  result:'PASS',
  scope:'PREPARATION_ONLY_NO_PRODUCT_OR_CERTIFICATION_EXECUTION',
  candidate:C3TB,
  candidateRole:'C3TB',
  productionCandidate:C3T,
  productionRole:'C3T',
  productionTree,
  integrationAuthority:authority,
  namespace:{evidence:relativeE,tools:toolNamespace},
  sourceDefinition:inventory.definitionRecovery.source,
  currentAuthorityBindings,
  recoveryTool:record(path.join(T,'recover-inventory.mjs')),
  inventory:inventoryBinding,
  sections:expectedSections,
  caseIds:expectedCaseIds,
  caseDefinitionCounts:Object.fromEntries(expectedSections.map((step,index)=>[step,expectedCounts[index]])),
  totalCases:80,
  sourceSnapshots:39,
  checks:{
    exactSectionOrder:true,
    exactCaseIdOrder:true,
    exactCounts:true,
    definitionsPreservedExceptRecordedCurrentAuthorityAdaptations:true,
    allStepsMandatory:true,
    allCasesMandatory:true,
    allStepsNotRun:true,
    allCasesNotRun:true,
    sourceGitCommitBlobSizeAndShaBound:true,
    currentAuthorityFilesBoundToC3TB:true,
    currentCandidateIsC3TB:true,
    productionCandidateIsC3T:true,
    historicalCandidateOnlyInHistoricalProvenance:true,
    historicalOutcomesPromoted:false,
  },
  helperBoundary:inventory.helperBoundary,
  limits:inventory.limits,
  adaptations:inventory.prospectiveInventoryAdaptations,
  schemaNotes:{
    sourceCasesHadExecutionStatus:false,
    sourceCasesHadResult:false,
    recoveredCasesAddExecutionStatusAndResult:'NOT_RUN',
    expectedStatusAndExpectedResultFieldsRemainDefinitions:'Expected status/result-like fields nested below expected are assertions, not execution outcomes, and are intentionally preserved.',
  },
  historicalCandidateOccurrences:historicalCandidatePaths,
  effects:{
    outputCreation:'flag wx through common.mjs write()',
    outputs:outputNames.map(name=>relativeE+'/'+name),
    network:false,
    packageInstall:false,
    packageAssembly:false,
    productExecution:false,
    helperExecution:false,
    workerExecution:false,
    certificationExecution:false,
    historicalFilesModified:false,
  },
  certificationAcceptance:false,
};

const writtenInventory=write('recovered-inventory.json',inventory);
assert.deepEqual(writtenInventory,inventoryBinding);
const writtenValidation=write('inventory-validation.json',validation);
console.log(JSON.stringify({result:'RECOVERED_INVENTORY_PREPARED',inventory:writtenInventory,validation:writtenValidation,sections:15,cases:80,historicalOutcomesPromoted:false,productExecutions:0}));
