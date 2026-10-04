import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  root,
  E,
  T,
  relativeE,
  HEAD,
  C3VB,
  C3V,
  authority,
  helperAuthority,
  hash,
  json,
  record,
  write,
  git,
  str,
  identity,
} from './common.mjs';

// Definition recovery only. Read the exact all-NOT_RUN inventory preserved by
// the failed C3UB generation and adapt only current candidate/aggregate fields.
// This performs no package install, product execution, helper execution, worker
// execution, certification case, or historical outcome promotion.
assert.equal(process.argv.length, 2, 'recover-inventory.mjs accepts no arguments');
identity();

const sourceRevision = '789d92f94638ddbe63d38dc957746bf1f7d308c2';
const sourceCommit = sourceRevision;
const sourcePath = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub/recovered-inventory.json';
const sourceBlob = 'e53ad0b4aeed55b4035e541a66c13b6e47a0407a';
const sourceByteLength = 105006;
const sourceSha256 = 'sha256:9f9836a24a45f221fd8077d2ebf214335a5269fd7e16197e48cd8737df14e918';
const sourceCandidate = '91c07b1e93f65ab6252024984073c171ff5d7648';
const sourceProductionCandidate = '34f42c50abfa1c440416c4cdf7f643f784585588';
const sourceProductionTree = '302cf1a506e974b2102a78be1b9c920ac80105b2';
const sourceAuthority = 'PROSPECTIVE_HELPER_BOUND@2.0.0';
const originalSource = {
  requestedRevision: 'bf715553',
  commit: 'bf715553bf815654098e01ddd217448f00743414',
  path: 'repositories/cca-conformance/evidence/mo1307/phase3a-c3rb-restart/recovered-inventory.json',
  selector: 'bf715553bf815654098e01ddd217448f00743414:repositories/cca-conformance/evidence/mo1307/phase3a-c3rb-restart/recovered-inventory.json',
  blob: 'a30be79898ec9cd22101d9b11532375697d5854a',
  byteLength: 68277,
  sha256: 'sha256:ae927858aed6c9ddc255ed0efb9fb74160ffbd899f9780aa6c3f9109ae51b784',
};
const productionTree = 'b9dabf54572e06c96bb5e48c4e20671f2cc24053';
const toolNamespace = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h2-corrected';
const expectedSections = 'ABCDEFGHIJKLMNO'.split('');
const expectedCaseIds = {
  A: ['mo1306-qualified'],
  B: ['ready'],
  C: ['not-ready'],
  D: ['could-not-evaluate'],
  E: ['rest-qualified'],
  F: ['ready-approve', 'ready-reject', 'qualified-approve', 'not-ready-attempted-approve', 'candidate-mismatch', 'readiness-mismatch', 'proof-mismatch'],
  G: ['pre-tag-absent', 'post-tag-ready', 'pre-tag-present', 'post-tag-absent', 'post-tag-lightweight', 'post-tag-wrong-target', 'post-tag-wrong-name'],
  H: ['timely-helper', 'cancel-before-helper', 'helper-timeout', 'late-helper-success-rejected', 'cancel-during-helper', 'cancel-between-helper-worker', 'aggregate-helper-exhaustion'],
  I: ['worker-timeout', 'worker-cancellation', 'late-worker-result-rejected', 'cancel-after-worker-before-publication'],
  J: ['timeout-cleanup-and-serialized-process-topology'],
  K: ['timely', 'pre-admission-timeout', 'pre-admission-cancel', 'post-admission-timeout', 'post-admission-cancel', 'native-rename-failure', 'post-commit-stdout-failure'],
  L: ['ordinary-read-and-seven-field-native-identity', 'actual-junction-reparse-refused', 'actual-hardlink-refused', 'actual-wrong-type-refused', 'native-replacement-fresh-identity-and-consumer-refusal', 'native-size-change-freshness-and-consumer-refusal', 'native-changed-final-path-and-consumer-refusal', 'native-short-alias-final-path-mismatch-refused', 'native-path-refusal-traversal', 'native-path-refusal-ads', 'native-path-refusal-reserved', 'native-path-refusal-trailing-dot', 'native-path-refusal-trailing-space', 'native-root-refusal-drive-relative', 'native-root-refusal-unc', 'native-root-refusal-device', 'native-missing-ancestor-refused', 'native-missing-file-is-input-failure', 'actual-publication-existing-output-preserved', 'actual-publication-existing-pending-preserved', 'actual-publication-existing-final-preserved', 'actual-publication-same-byte-replacement-refused'],
  M: ['fixed-production-helper-launch-under-combined-environment-poison', 'actual-worker-empty-environment-execargv-resource-limits', 'actual-cli-node-options-empty', 'actual-cli-node-options-option', 'actual-cli-node-path', 'actual-cli-preload', 'actual-cli-import', 'actual-cli-loader', 'actual-cli-inspect-config', 'actual-cli-proxy-credential-path-poison-fixed-helper', 'launch-guard---require=untrusted', 'launch-guard---import=untrusted', 'launch-guard---loader=untrusted', 'launch-guard---experimental-loader=untrusted', 'launch-guard---inspect', 'launch-guard---inspect-brk', 'launch-guard---debug', 'launch-guard---debug-brk'],
  N: ['A-E-canonical-byte-and-digest-determinism'],
  O: ['mo1306-qualified-final'],
};
const expectedCounts = expectedSections.map(step => expectedCaseIds[step].length);
assert.deepEqual(expectedCounts, [1, 1, 1, 1, 1, 7, 7, 7, 4, 1, 7, 22, 18, 1, 1]);
assert.equal(expectedCounts.reduce((sum, count) => sum + count, 0), 80);

assert.equal(HEAD, C3VB);
assert.equal(str('rev-parse', sourceRevision + '^{commit}'), sourceCommit);
assert.equal(str('rev-parse', sourceCommit + ':' + sourcePath), sourceBlob);
assert.equal(str('rev-parse', originalSource.commit + ':' + originalSource.path), originalSource.blob);
assert.equal(str('show', '-s', '--format=%P', C3VB), C3V);
assert.equal(str('rev-parse', C3VB + ':repositories/memoryos-readiness'), productionTree);
assert.equal(str('rev-parse', C3V + ':repositories/memoryos-readiness'), productionTree);

const sourceBytes = git('show', sourceCommit + ':' + sourcePath);
assert.equal(sourceBytes.length, sourceByteLength);
assert.equal(hash(sourceBytes), sourceSha256);
const originalSourceBytes = git('show', originalSource.commit + ':' + originalSource.path);
assert.equal(originalSourceBytes.length, originalSource.byteLength);
assert.equal(hash(originalSourceBytes), originalSource.sha256);
const sourceInventory = JSON.parse(sourceBytes.toString('utf8'));
assert.equal(sourceInventory.kind, 'MO1307Phase3AR2C3UBRecoveredCertificationInventory');
assert.equal(sourceInventory.status, 'RECOVERED_ADAPTED_NOT_EXECUTED_NOT_ACCEPTED');
assert.equal(sourceInventory.candidate, sourceCandidate);
assert.equal(sourceInventory.productionCandidate, sourceProductionCandidate);
assert.equal(sourceInventory.productionTree, sourceProductionTree);
assert.equal(sourceInventory.integrationAuthority, sourceAuthority);
assert.equal(sourceInventory.productExecutionPerformed, false);
assert.equal(sourceInventory.historicalFilesModified, false);
assert.equal(sourceInventory.authentication.newCertificationEvidence, false);
assert.equal(sourceInventory.authentication.historicalOutcomesPromoted, false);
assert.deepEqual(sourceInventory.definitionRecovery.originalDefinitionSource, originalSource);
assert.deepEqual(sourceInventory.steps.map(row => row.step), expectedSections);
assert.deepEqual(sourceInventory.steps.map(row => row.cases.length), expectedCounts);
assert.deepEqual(Object.fromEntries(sourceInventory.steps.map(row => [row.step, row.cases.map(item => item.case)])), expectedCaseIds);
assert.ok(sourceInventory.steps.every(row => row.mandatory === true && row.executionStatus === 'NOT_RUN' && row.result === 'NOT_RUN'));
const sourceCases = sourceInventory.steps.flatMap(row => row.cases);
assert.equal(sourceCases.length, 80);
assert.ok(sourceCases.every(item => item.mandatory === true && item.executionStatus === 'NOT_RUN' && item.result === 'NOT_RUN'));
const priorProspectiveInventoryAdaptations = structuredClone(sourceInventory.prospectiveInventoryAdaptations);
assert.ok(Array.isArray(priorProspectiveInventoryAdaptations) && priorProspectiveInventoryAdaptations.length > 0);
const priorHelperAdaptation = priorProspectiveInventoryAdaptations.find(row => row.scope === 'H_HELPER_BOUNDARY');
assert.equal(priorHelperAdaptation.from.wholeLifecycleMs, 8000);
assert.equal(priorHelperAdaptation.to.wholeLifecycleMs, 9000);

const aggregateAuthorityRoot = 'repositories/cca-conformance/evidence/mo1307/prospective-helper-aggregate-bound-v2-candidate';
const helperAuthorityRoot = 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate';
const authorityFileSpecifications = [
  {role: 'AGGREGATE_BOUND_AUTHORITY', path: aggregateAuthorityRoot + '/authority.json'},
  {role: 'AGGREGATE_CANDIDATE_RECORD', path: aggregateAuthorityRoot + '/candidate.json'},
  {role: 'CHANGED_FILE_INVENTORY', path: aggregateAuthorityRoot + '/changed-file-inventory.json'},
  {role: 'CONSISTENCY_VALIDATION', path: aggregateAuthorityRoot + '/consistency-validation.json'},
  {role: 'PHASE_3A_HANDOFF', path: aggregateAuthorityRoot + '/phase3a-handoff.json'},
  {role: 'PHASE_3BR2_BINDING_DELTA', path: aggregateAuthorityRoot + '/phase3br2-binding-delta.json'},
  {role: 'PHASE_3CR2_AGGREGATE_DELTA', path: aggregateAuthorityRoot + '/phase3cr2-aggregate-delta.json'},
  {role: 'CANDIDATE_BINDING', path: aggregateAuthorityRoot + '/binding.json'},
  {role: 'BINDING_VERIFICATION', path: aggregateAuthorityRoot + '/binding-verification.json'},
  {role: 'AGGREGATE_BOUND_SPECIFICATION', path: 'docs/mo1307-prospective-helper-aggregate-bound-v2-candidate.md'},
  {role: 'HELPER_BOUND_AUTHORITY', path: helperAuthorityRoot + '/authority.json'},
  {role: 'HELPER_BOUND_SPECIFICATION', path: 'docs/mo1307-prospective-helper-bound-v2-candidate.md'},
  {role: 'FINAL_HEADLESS_AUTHORIZATION', path: 'repositories/cca-conformance/evidence/mo1307/final-headless/authorization.txt'},
  {role: 'FINAL_HEADLESS_ADDENDUM', path: 'docs/mo1307-final-headless-correction-addendum.md'},
];
const specification = role => authorityFileSpecifications.find(row => row.role === role);
const currentAuthorityBindings = authorityFileSpecifications.map(({role, path: filePath}) => {
  const actual = record(filePath);
  const committedBytes = git('show', C3VB + ':' + filePath);
  assert.equal(committedBytes.length, actual.byteLength);
  assert.equal(hash(committedBytes), actual.sha256);
  return {role, ...actual, gitBlob: str('rev-parse', C3VB + ':' + filePath)};
});

const authorityDocument = json(specification('AGGREGATE_BOUND_AUTHORITY').path);
const helperAuthorityDocument = json(specification('HELPER_BOUND_AUTHORITY').path);
const aggregateCandidate = json(specification('AGGREGATE_CANDIDATE_RECORD').path);
const handoff = json(specification('PHASE_3A_HANDOFF').path);
const binding = json(specification('CANDIDATE_BINDING').path);
const bindingVerification = json(specification('BINDING_VERIFICATION').path);
const expectedLimits = {aggregateHelperActiveMs: 28000, apiMs: 10000, cleanupMs: 2000, cliAdmissionMs: 30000, helperMs: 9000, workerMs: 10000};
assert.equal(authorityDocument.identity, authority);
assert.equal(authorityDocument.status, 'ADOPTED_PROSPECTIVELY');
assert.equal(authorityDocument.valueMs, 28000);
assert.deepEqual(authorityDocument.limits, expectedLimits);
assert.deepEqual(authorityDocument.relation, {accepted: 'helperActiveMs < 28000', equality: 'TIMEOUT', timeout: 'helperActiveMs >= 28000'});
assert.deepEqual(authorityDocument.preservedAuthority, {identity: helperAuthority, success: 'elapsedMs < 9000', timeout: 'elapsedMs >= 9000', valueMs: 9000});
assert.equal(helperAuthorityDocument.identity, helperAuthority);
assert.equal(helperAuthorityDocument.valueMs, 9000);
assert.deepEqual(helperAuthorityDocument.relation, {equality: 'TIMEOUT', success: 'elapsedMs < 9000', timeout: 'elapsedMs >= 9000'});
assert.equal(helperAuthorityDocument.cleanup.separateAllowanceMs, 2000);
assert.equal(helperAuthorityDocument.cleanup.beginsAfterTerminalHelperOutcome, true);
assert.equal(helperAuthorityDocument.cleanup.successGrace, false);
assert.equal(aggregateCandidate.result, 'READY_FOR_BINDING');
assert.equal(aggregateCandidate.candidateRole, 'C3V');
assert.equal(aggregateCandidate.bindingRole, 'C3VB');
assert.equal(aggregateCandidate.authorities.helper, helperAuthority);
assert.deepEqual(aggregateCandidate.authorities.aggregate, record(specification('AGGREGATE_BOUND_AUTHORITY').path));
assert.deepEqual(aggregateCandidate.limits, expectedLimits);
assert.equal(aggregateCandidate.phase3Execution, false);
assert.deepEqual(handoff.authorities, [helperAuthority, authority]);
assert.equal(handoff.candidateRole, 'C3V');
assert.equal(handoff.consumeRule, 'EXACT_C3VB_HEAD_AFTER_BINDING_VERIFICATION');
assert.equal(handoff.mode, 'ONE_B_GATE_THEN_FRESH_FULL_A_TO_O');
assert.equal(handoff.status, 'PENDING_FRESH_EXECUTION');
assert.deepEqual(handoff.certificationInventory, expectedSections);
assert.deepEqual(handoff.limits, expectedLimits);
assert.deepEqual(handoff.preCertificationGate, {certification: false, executions: 1, retry: false, vector: 'B/ready/evaluate'});
assert.equal(handoff.phase3BR2Rerun, false);assert.equal(handoff.phase3CR2, false);assert.equal(handoff.phase3D, false);
assert.equal(binding.result, 'FINAL_PRODUCTION_CANDIDATE_READY_FOR_PHASE3A');
assert.equal(binding.candidateRole, 'C3V');
assert.equal(binding.bindingRole, 'C3VB');
assert.equal(binding.binding.soleParent, C3V);
assert.equal(binding.binding.productionChanges, false);
assert.equal(binding.phase3AExecuted, false);
assert.deepEqual(binding.limits, expectedLimits);
assert.equal(binding.authorities.aggregateIdentity, authority);
assert.deepEqual(binding.authorities.helper, {identity: helperAuthority, valueMs: 9000});
assert.equal(binding.phase3BR2Rerun, false);assert.equal(binding.phase3CR2Executed, false);assert.equal(binding.phase3DExecuted, false);
assert.equal(bindingVerification.result, 'PASS');
assert.equal(bindingVerification.candidateCommit, C3V);
assert.equal(bindingVerification.productionTree, productionTree);
assert.equal(bindingVerification.productionChangesInBindingCommit, false);
assert.equal(bindingVerification.certificationExecuted, false);
const failedBGatePath = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-b-gate/gate-receipt.json';
const correctionPath = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-topology-observer-correction/receipt.json';
const correctionSourcesPath = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-topology-observer-correction/source-bindings.json';
const bGatePath = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-corrected-b-gate/gate-receipt.json';
const failedFullPath = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final/certification-receipt.json';
const hCorrectionPath = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-harness-correction/receipt.json';
const h2CorrectionPath = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h2-harness-correction/receipt.json';
const h2CorrectionSourcesPath = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h2-harness-correction/source-bindings.json';
const consumedPath = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-corrected/certification-receipt.json';
const failedBGateReceipt = json(failedBGatePath),correctionReceipt=json(correctionPath),correctionSources=json(correctionSourcesPath),bGateReceipt = json(bGatePath),failedFullReceipt=json(failedFullPath),hCorrectionReceipt=json(hCorrectionPath),h2CorrectionReceipt=json(h2CorrectionPath),h2CorrectionSources=json(h2CorrectionSourcesPath),consumedReceipt=json(consumedPath);
assert.equal(failedBGateReceipt.result,'FAIL');assert.equal(failedBGateReceipt.semanticInvocations,1);assert.equal(failedBGateReceipt.fullCertificationStarted,false);
assert.equal(correctionReceipt.kind,'MO1307Phase3AR2TopologyObserverSyntheticValidationReceipt');assert.equal(correctionReceipt.result,'PASS');assert.equal(correctionReceipt.cases.allRequiredCasesPassed,true);assert.equal(correctionReceipt.cases.passed,7);assert.deepEqual(correctionReceipt.cases.acceptedExactly,['B','F']);assert.deepEqual(correctionReceipt.cases.failedClosedExactly,['A','C','D','E','G']);assert.deepEqual({semanticProductInvocations:correctionReceipt.execution.semanticProductInvocations,productRuns:correctionReceipt.execution.productRuns,helperRuns:correctionReceipt.execution.helperRuns,nativeObserverRuns:correctionReceipt.execution.nativeObserverRuns},{semanticProductInvocations:0,productRuns:0,helperRuns:0,nativeObserverRuns:0});
for(const [name,binding] of [['runtime-controls-observer.py',h2CorrectionSources.correctedObserver],['topology_identity_policy.py',correctionSources.policy]]){const actual=record(path.join(T,name));assert.equal(actual.byteLength,binding.byteLength);assert.equal(actual.sha256,binding.sha256);}
assert.equal(h2CorrectionReceipt.kind,'MO1307Phase3AR2FinalH2HarnessCorrectionReceipt');assert.equal(h2CorrectionReceipt.result,'PASS');assert.equal(h2CorrectionReceipt.zeroProductValidation,'PASS');assert.deepEqual(h2CorrectionReceipt.classifications,['H_AGGREGATE_FIXTURE_INPUT_ISOLATION_DEFECT','H_OBSERVER_EVENT_ORDERING_DEFECT']);assert.deepEqual(h2CorrectionReceipt.execution,{certificationRuns:0,helperRuns:0,nativeObserverRuns:0,productRuns:0,workerRuns:0,engineeringInterpreterInvocations:2});
assert.equal(consumedReceipt.result,'PHASE3AR2_CONCRETE_BLOCKER');assert.deepEqual(consumedReceipt.completed,['A','B','C','D','E','F','G']);assert.equal(consumedReceipt.steps.find(row=>row.step==='H').result,'FAIL');assert.deepEqual(consumedReceipt.unexecuted,['I','J','K','L','M','N','O']);
assert.equal(bGateReceipt.kind,'MO1307Phase3AR2FinalCorrectedPreCertificationBGateReceipt');assert.equal(bGateReceipt.result, 'PASS');assert.equal(bGateReceipt.outcome,'PRE_CERTIFICATION_B_GATE_PASS');assert.equal(bGateReceipt.candidate, C3VB);assert.equal(bGateReceipt.certification, false);assert.equal(bGateReceipt.semanticInvocations, 1);assert.equal(bGateReceipt.noRetry, true);assert.equal(bGateReceipt.fullCertificationStarted,false);assert.equal(bGateReceipt.limits.aggregateHelperActiveMs, 28000);
assert.equal(bGateReceipt.productionCommit,C3V);assert.equal(bGateReceipt.productionTree,productionTree);assert.deepEqual(bGateReceipt.authorities,[helperAuthority,authority]);assert.equal(bGateReceipt.identityPolicy,'MO1307_TOPOLOGY_IDENTITY_POLICY@1.0.0');assert.equal(bGateReceipt.details.topologyIdentity.unresolvedIdentityFailures,0);assert.equal(bGateReceipt.details.topologyIdentity.acceptedIdentityProofsConsistent,true);assert.equal(bGateReceipt.details.cleanupConfirmed,true);assert.equal(bGateReceipt.details.publication.phase,'COMMITTED');
assert.equal(failedFullReceipt.result,'PHASE3AR2_CONCRETE_BLOCKER');assert.deepEqual(failedFullReceipt.completed,['A','B','C','D','E','F','G']);assert.equal(failedFullReceipt.steps.find(row=>row.step==='H').result,'FAIL');assert.deepEqual(failedFullReceipt.unexecuted,['I','J','K','L','M','N','O']);
assert.equal(hCorrectionReceipt.result,'PASS');assert.equal(hCorrectionReceipt.classification,'H_HARNESS_MARGIN_DEFECT');assert.deepEqual(hCorrectionReceipt.correctedControl,{artificialEofDelayMs:0,engineeringMaxMs:5000,engineeringMinMs:null,productDeadlineMs:9000});assert.deepEqual(hCorrectionReceipt.execution,{certificationRuns:0,helperRuns:0,nativeObserverRuns:0,productRuns:0,workerRuns:0});

const inventory = structuredClone(sourceInventory);
inventory.kind = 'MO1307Phase3AR2C3VBRecoveredCertificationInventory';
inventory.status = 'RECOVERED_ADAPTED_NOT_EXECUTED_NOT_ACCEPTED';
inventory.candidate = C3VB;
inventory.candidateRole = 'C3VB';
inventory.productionCandidate = C3V;
inventory.productionRole = 'C3V';
inventory.productionTree = productionTree;
inventory.integrationAuthority = authority;
inventory.authorityChain = currentAuthorityBindings;
inventory.authentication = {
  sourceGitObjectVerified: true,
  originalDefinitionGitObjectVerified: true,
  currentAuthorityFilesVerified: currentAuthorityBindings.length,
  historicalOutcomesPromoted: false,
  newCertificationEvidence: false,
  productExecutions: 0,
  helperExecutions: 0,
  workerExecutions: 0,
  networkUsed: false,
  scope: 'INVENTORY_RECOVERY_ONLY_AFTER_SEPARATE_CORRECTED_PRE_CERTIFICATION_B_GATE',
  preCertificationSemanticInvocations: 1,
};
inventory.observerCorrection = record(correctionPath);
inventory.observerCorrectionSources = record(correctionSourcesPath);
inventory.hHarnessCorrection = record(hCorrectionPath);
inventory.h2HarnessCorrection = record(h2CorrectionPath);
inventory.preservedFailedFullGeneration = record(failedFullPath);
inventory.preservedFailedHCorrectedGeneration = record(consumedPath);
inventory.preCertificationBGate = record(bGatePath);
inventory.preservedFailedPreCertificationBGate = record(failedBGatePath);
inventory.sourceSnapshots = inventory.sourceSnapshots.map(row => ({...row, interpretation: 'HISTORICAL_DEFINITION_AUTHORITY_ONLY_NO_OUTCOME_PROMOTION'}));
inventory.limits.helperWholeLifecycleMs = 9000;
inventory.limits.aggregateHelperActiveMs = 28000;
inventory.limits.replacementHelperBoundH = 'NOT_ESTABLISHED';
inventory.helperBoundary = {
  wholeLifecycleMs: 9000,
  success: 'elapsedMs < 9000',
  timeout: 'elapsedMs >= 9000',
  equality: 'TIMEOUT',
  cleanupBeginsAfterTerminalOutcome: true,
  cleanupAllowanceMs: 2000,
  successGrace: false,
  retry: false,
  lateSuccessRecovery: false,
  lifecycle: helperAuthorityDocument.lifecycle,
};
inventory.aggregateBoundary = {
  helperActiveMs: 28000,
  accepted: 'helperActiveMs < 28000',
  timeout: 'helperActiveMs >= 28000',
  equality: 'TIMEOUT',
  excludesWorkerTime: true,
  remainingFormula: '28000 - helperUsedMs',
};
inventory.namespace = {evidence: relativeE, tools: toolNamespace, cache: '.cache/phase3ar2-final-h2-corrected', report: 'docs/mo1307-phase3ar2-final-h2-corrected.md'};
inventory.filesWrittenOnlyUnder = [relativeE, '.cache/phase3ar2-final-h2-corrected', 'docs/mo1307-phase3ar2-final-h2-corrected.md'];
inventory.historicalFilesModified = false;
inventory.productExecutionPerformed = false;
inventory.currentAuthority = {
  identity: authority,
  identities: [helperAuthority, authority],
  candidate: C3VB,
  productionCandidate: C3V,
  productionTree,
  prospectiveOnly: true,
  certificationStarted: false,
  bindings: currentAuthorityBindings,
};
inventory.preCertificationBGate = record(bGatePath);
inventory.definitionRecovery = {
  method: 'LOCAL_GIT_SHOW_DEFINITION_ONLY_FROM_PRESERVED_FAILED_GENERATION',
  source: {
    requestedRevision: sourceRevision,
    commit: sourceCommit,
    path: sourcePath,
    selector: sourceCommit + ':' + sourcePath,
    blob: sourceBlob,
    byteLength: sourceByteLength,
    sha256: sourceSha256,
  },
  immediateSourceMetadata: {
    kind: sourceInventory.kind,
    status: sourceInventory.status,
    candidate: sourceInventory.candidate,
    productionCandidate: sourceInventory.productionCandidate,
    productionTree: sourceInventory.productionTree,
    integrationAuthority: sourceInventory.integrationAuthority,
    historicalOutcomesPromoted: sourceInventory.authentication.historicalOutcomesPromoted,
  },
  originalDefinitionSource: originalSource,
  originalDefinitionRecovery: sourceInventory.definitionRecovery,
  priorProspectiveInventoryAdaptations,
  sourceSteps: 15,
  sourceSnapshots: sourceInventory.sourceSnapshots.length,
  sourceCaseDefinitionCounts: expectedCounts,
  sourceCases: 80,
  sourceAllStepsNotRun: true,
  sourceAllCasesNotRun: true,
  historicalOutcomesPromoted: false,
  sourceBytesCopiedAsOutcomeEvidence: false,
};

for (const step of inventory.steps) {
  step.executionStatus = 'NOT_RUN';
  step.result = 'NOT_RUN';
  const moduleName = step.currentHarnessDefinition.slice(step.currentHarnessDefinition.lastIndexOf('/') + 1);
  step.currentHarnessDefinition = toolNamespace + '/' + moduleName;
  step.historicalAuthorityInterpretation = 'DEFINITION_ONLY_NO_OUTCOME_PROMOTION';
  for (const item of step.cases) {
    item.executionStatus = 'NOT_RUN';
    item.result = 'NOT_RUN';
  }
}

const helperStep = inventory.steps.find(row => row.step === 'H');
const timelyHelper = helperStep.cases.find(row => row.case === 'timely-helper');
const helperTimeout = helperStep.cases.find(row => row.case === 'helper-timeout');
const aggregateTimeout = helperStep.cases.find(row => row.case === 'aggregate-helper-exhaustion');
assert.equal(timelyHelper.expected.durationMs, '<9000');
assert.equal(timelyHelper.expected.successRelation, 'elapsedMs < 9000');
timelyHelper.expected.durationMs = '<5000';
timelyHelper.engineeringControl = {artificialEofDelayMs:0,engineeringMaxMs:5000,deadlineMarginMs:4000,productDeadlineMs:9000};
assert.equal(helperTimeout.expected.clock, '9000 ms whole helper lifecycle');
assert.equal(helperTimeout.expected.timeoutRelation, 'elapsedMs >= 9000');
assert.equal(helperTimeout.expected.equality, 'TIMEOUT');
helperStep.currentBoundary = inventory.helperBoundary;
aggregateTimeout.expected.clock = '28000 ms aggregate helper-active; worker excluded';
aggregateTimeout.immediateHistoricalSourceCase = aggregateTimeout.sourceCase;
aggregateTimeout.sourceCase = 'aggregate-28000ms-excludes-worker';
aggregateTimeout.requiredMethod.perHelperEofDelayMs = 4000;
const consumedAggregateMethod = structuredClone(aggregateTimeout.requiredMethod);
assert.deepEqual(consumedAggregateMethod, {sequence: 'createHelperSequence(evaluate), one session, slots1 through9', worker: 'after slot4, 250 ms nonsemantic wait', slot6: 'create output root before request', slot8: 'create pending before request', perHelperEofDelayMs: 4000});
aggregateTimeout.requiredMethod = {
  sequence: 'createHelperSequence(evaluate), one session, slots1 through5 maximum; slots4 and5 are CHECK_OUTPUT',
  worker: 'after slot4, 250 ms nonsemantic wait',
  publicationStateMutations: 'NONE; the sealed absent-output fixture is never created, written, or used as an evidence root',
  terminatingRule: 'unchanged 28000-ms product aggregate helper-active deadline terminates the fifth helper before its response',
  perHelperEofDelayMs: 5700,
  aggregateFixture: h2CorrectionSources.aggregateFixture,
  inputFixture: h2CorrectionSources.inputFixture,
};
assert.deepEqual(aggregateTimeout.expected, {code: 'MO1307_TIMEOUT', clock: '28000 ms aggregate helper-active; worker excluded', workers: 1});
helperStep.currentAggregateBoundary = inventory.aggregateBoundary;

const cleanupExpected = inventory.steps.find(row => row.step === 'J').cases[0].expected;
assert.deepEqual(cleanupExpected.optionalObservedConsoleCounts, [0, 1]);
assert.equal(cleanupExpected.requiredHeldHelperObjects, 1);
assert.equal(cleanupExpected.unidentifiedHostTerminationClaim, false);
assert.equal(cleanupExpected.completeConsoleHostAbsenceClaim, false);
assert.equal(cleanupExpected.strictDeadlineRelation, 'cleanupDeadline === terminalAt + 2000');
assert.equal(cleanupExpected.epsilonMs, 0);
assert.equal(cleanupExpected.toleranceMs, 0);
assert.equal(cleanupExpected.timingSlackMs, 0);

inventory.prospectiveInventoryAdaptations = [
  {scope: 'IDENTITY', from: {candidate: sourceCandidate, productionCandidate: sourceProductionCandidate, productionTree: sourceProductionTree, integrationAuthority: sourceAuthority}, to: {candidate: C3VB, productionCandidate: C3V, productionTree, integrationAuthority: authority}, historicalOutcomePromoted: false},
  {scope: 'NAMESPACE', from: sourceInventory.namespace, to: {evidence: relativeE, tools: toolNamespace, cache: '.cache/phase3ar2-final-h2-corrected', report: 'docs/mo1307-phase3ar2-final-h2-corrected.md'}, historicalOutcomePromoted: false},
  {scope: 'H_TIMELY_HELPER_HARNESS_MARGIN_CORRECTION', from: {artificialEofDelayMs:8200,engineeringMinMs:8000,engineeringMaxMs:9000}, to: timelyHelper.engineeringControl, classification:'H_HARNESS_MARGIN_DEFECT', authority:record(hCorrectionPath), productDeadlineChanged:false, historicalOutcomePromoted:false},
  {scope: 'H_AGGREGATE_FIXTURE_INPUT_ISOLATION_CORRECTION', from: consumedAggregateMethod, to: aggregateTimeout.requiredMethod, expectedChanged: false, expected: aggregateTimeout.expected, classification: 'H_AGGREGATE_FIXTURE_INPUT_ISOLATION_DEFECT', authority: record(h2CorrectionPath), preservedFailedGeneration: record(consumedPath), productDeadlineChanged: false, historicalOutcomePromoted: false},
  {scope: 'H_OBSERVER_EVENT_ORDERING_CORRECTION', rule: 'MO1307_OBSERVER_EVENT_ORDERING@1.0.0', policy: 'MO1307_TOPOLOGY_IDENTITY_POLICY@1.0.0', policyChanged: false, classification: 'H_OBSERVER_EVENT_ORDERING_DEFECT', authority: record(h2CorrectionPath), historicalOutcomePromoted: false},
  {scope: 'H_HELPER_BOUNDARY_PRESERVED', from: sourceInventory.helperBoundary, to: inventory.helperBoundary, changed: false, authority: currentAuthorityBindings.find(row => row.role === 'HELPER_BOUND_AUTHORITY'), historicalOutcomePromoted: false},
  {scope: 'H_AGGREGATE_BOUNDARY', from: {helperActiveMs: 20000, accepted: 'helperActiveMs < 20000', timeout: 'helperActiveMs >= 20000', equality: 'TIMEOUT'}, to: inventory.aggregateBoundary, authority: currentAuthorityBindings.find(row => row.role === 'AGGREGATE_BOUND_AUTHORITY'), historicalOutcomePromoted: false},
  {scope: 'J_HEADLESS_BOUNDARY', from: sourceInventory.steps.find(row => row.step === 'J').cases[0].expected, to: cleanupExpected, changed: false, authority: currentAuthorityBindings.find(row => row.role === 'FINAL_HEADLESS_ADDENDUM'), historicalOutcomePromoted: false},
  {scope: 'EXECUTION_BOOKKEEPING', from: {steps: 'NOT_RUN', cases: {executionStatus: 'NOT_RUN', result: 'NOT_RUN'}}, to: {steps: 'NOT_RUN', cases: {executionStatus: 'NOT_RUN', result: 'NOT_RUN'}}, note: 'The preserved failed generation inventory already records all 15 steps and 80 cases as NOT_RUN; the fresh generation resets and verifies the same state without promoting its A failure.', historicalOutcomePromoted: false},
];
inventory.sealDisposition = 'Preparation only. Independently review and seal the exact final Phase 3AR2 C3VB tools, this fresh all-NOT_RUN inventory, current authority, fresh installed package, fixtures, and prepared inputs before the first A-O execution. This inventory confers no certification PASS or acceptance.';

assert.deepEqual(inventory.steps.map(row => row.step), expectedSections);
assert.deepEqual(inventory.steps.map(row => row.cases.length), expectedCounts);
assert.deepEqual(Object.fromEntries(inventory.steps.map(row => [row.step, row.cases.map(item => item.case)])), expectedCaseIds);
assert.equal(inventory.steps.flatMap(row => row.cases).length, 80);
assert.ok(inventory.steps.every(row => row.mandatory === true && row.executionStatus === 'NOT_RUN' && row.result === 'NOT_RUN'));
assert.ok(inventory.steps.flatMap(row => row.cases).every(item => item.mandatory === true && item.executionStatus === 'NOT_RUN' && item.result === 'NOT_RUN'));
assert.equal(inventory.limits.helperWholeLifecycleMs, 9000);
assert.equal(inventory.limits.aggregateHelperActiveMs, 28000);
assert.equal(inventory.limits.cliRenameAdmissionMs, 30000);
assert.equal(inventory.limits.apiWorkerMs, 10000);
assert.equal(inventory.limits.failureCleanupMs, 2000);
assert.equal(inventory.limits.replacementHelperBoundH, 'NOT_ESTABLISHED');
assert.equal(timelyHelper.expected.durationMs, '<5000');
assert.deepEqual(timelyHelper.engineeringControl,{artificialEofDelayMs:0,engineeringMaxMs:5000,deadlineMarginMs:4000,productDeadlineMs:9000});
assert.equal(helperTimeout.expected.timeoutRelation, 'elapsedMs >= 9000');
assert.equal(aggregateTimeout.expected.clock, '28000 ms aggregate helper-active; worker excluded');
assert.equal(aggregateTimeout.requiredMethod.perHelperEofDelayMs, 5700);
assert.equal(aggregateTimeout.expected.code, 'MO1307_TIMEOUT');
assert.equal(cleanupExpected.strictDeadlineRelation, 'cleanupDeadline === terminalAt + 2000');
assert.deepEqual(inventory.steps.find(row => row.step === 'O').cases.map(row => row.case), ['mo1306-qualified-final']);

// Prove all case definitions survive exactly except the recorded aggregate
// adaptation. Execution bookkeeping is not a definition or an outcome.
const definitions = steps => steps.map(row => row.cases.map(item => {
  const copy = structuredClone(item);
  delete copy.executionStatus;
  delete copy.result;
  return copy;
}));
const recoveredDefinitions = definitions(inventory.steps);
const sourceDefinitions = definitions(sourceInventory.steps);
const recoveredH = recoveredDefinitions[expectedSections.indexOf('H')];
const sourceH = sourceDefinitions[expectedSections.indexOf('H')];
const normalizedTimely = recoveredH.find(row => row.case === 'timely-helper');
const sourceTimely = sourceH.find(row => row.case === 'timely-helper');
normalizedTimely.expected.durationMs = sourceTimely.expected.durationMs;
delete normalizedTimely.engineeringControl;
const normalizedAggregate = recoveredH.find(row => row.case === 'aggregate-helper-exhaustion');
const sourceAggregate = sourceH.find(row => row.case === 'aggregate-helper-exhaustion');
normalizedAggregate.expected.clock = sourceAggregate.expected.clock;
normalizedAggregate.sourceCase = sourceAggregate.sourceCase;
normalizedAggregate.requiredMethod = structuredClone(sourceAggregate.requiredMethod);
delete normalizedAggregate.immediateHistoricalSourceCase;
assert.deepEqual(recoveredDefinitions, sourceDefinitions);

function findStringPaths(value, needle, at = '$', out = []) {
  if (typeof value === 'string') {
    if (value.includes(needle)) out.push(at);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findStringPaths(item, needle, at + '[' + index + ']', out));
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) findStringPaths(item, needle, at + '.' + key, out);
  }
  return out;
}
const sourceCandidatePaths = findStringPaths(inventory, sourceCandidate);
assert.ok(sourceCandidatePaths.length > 0);
assert.ok(sourceCandidatePaths.every(item => item.startsWith('$.definitionRecovery.') || item.startsWith('$.prospectiveInventoryAdaptations[')), 'C3UB appears in a current-identity field');
assert.equal(inventory.candidate, C3VB);
assert.equal(inventory.productionCandidate, C3V);
assert.equal(inventory.integrationAuthority, authority);
assert.equal(inventory.authentication.historicalOutcomesPromoted, false);
assert.equal(inventory.authentication.productExecutions, 0);

const outputNames = ['recovered-inventory.json', 'inventory-validation.json'];
for (const name of outputNames) assert.equal(fs.existsSync(path.join(E, name)), false, 'Fresh output already exists: ' + name);
const inventoryBytes = Buffer.from(JSON.stringify(inventory, null, 2) + '\n');
const inventoryBinding = {path: relativeE + '/recovered-inventory.json', byteLength: inventoryBytes.length, sha256: hash(inventoryBytes)};
const validation = {
  kind: 'MO1307Phase3AR2C3VBInventoryValidation',
  version: '1.0.0',
  result: 'PASS',
  scope: 'PREPARATION_ONLY_NO_PRODUCT_OR_CERTIFICATION_EXECUTION',
  candidate: C3VB,
  candidateRole: 'C3VB',
  productionCandidate: C3V,
  productionRole: 'C3V',
  productionTree,
  integrationAuthority: authority,
  namespace: {evidence: relativeE, tools: toolNamespace},
  sourceDefinition: inventory.definitionRecovery.source,
  originalDefinitionSource: originalSource,
  currentAuthorityBindings,
  observerCorrection: record(correctionPath),
  hHarnessCorrection: record(hCorrectionPath),
  h2HarnessCorrection: record(h2CorrectionPath),
  preservedFailedFullGeneration: record(failedFullPath),
  preservedFailedHCorrectedGeneration: record(consumedPath),
  preCertificationBGate: record(bGatePath),
  preservedFailedPreCertificationBGate: record(failedBGatePath),
  recoveryTool: record(path.join(T, 'recover-inventory.mjs')),
  inventory: inventoryBinding,
  sections: expectedSections,
  caseIds: expectedCaseIds,
  caseDefinitionCounts: Object.fromEntries(expectedSections.map((step, index) => [step, expectedCounts[index]])),
  totalCases: 80,
  sourceSnapshots: sourceInventory.sourceSnapshots.length,
  checks: {
    exactSectionOrder: true,
    exactCaseIdOrder: true,
    exactCounts: true,
    definitionsPreservedExceptRecordedCurrentAuthorityAdaptation: true,
    allStepsMandatory: true,
    allCasesMandatory: true,
    allStepsNotRun: true,
    allCasesNotRun: true,
    preservedFailedGenerationSourceGitCommitBlobSizeAndShaBound: true,
    originalDefinitionSourceGitCommitBlobSizeAndShaBound: true,
    currentAuthorityFilesBoundToC3VB: true,
    currentCandidateIsC3VB: true,
    productionCandidateIsC3V: true,
    historicalCandidateOnlyInHistoricalProvenance: true,
    priorProspectiveInventoryAdaptationsPreserved: true,
    historicalOutcomesPromoted: false,
    observerCorrectionSyntheticCasesPassed: true,
    hHarnessMarginCorrectionValidatedWithZeroProductExecutions: true,
    preservedFailedFullGenerationNotResumed: true,
    h2HarnessCorrectionValidatedWithZeroProductExecutions: true,
    preservedFailedHCorrectedGenerationNotResumed: true,
    caseExpectationsChanged: false,
    correctedPreCertificationBGatePassedOnce: true,
    failedPreCertificationBGatePreserved: true,
  },
  helperBoundary: inventory.helperBoundary,
  aggregateBoundary: inventory.aggregateBoundary,
  limits: inventory.limits,
  adaptations: inventory.prospectiveInventoryAdaptations,
  schemaNotes: {
    sourceCasesHadExecutionStatus: true,
    sourceCasesHadResult: true,
    sourceCasesWereAllNotRun: true,
    recoveredCasesResetExecutionStatusAndResult: 'NOT_RUN',
    expectedStatusAndExpectedResultFieldsRemainDefinitions: 'Expected status/result-like fields nested below expected are assertions, not execution outcomes, and are intentionally preserved.',
  },
  historicalCandidateOccurrences: sourceCandidatePaths,
  effects: {
    outputCreation: 'flag wx through common.mjs write()',
    outputs: outputNames.map(name => relativeE + '/' + name),
    network: false,
    packageInstall: false,
    packageAssembly: false,
    productExecution: false,
    helperExecution: false,
    workerExecution: false,
    certificationExecution: false,
    historicalFilesModified: false,
  },
  certificationAcceptance: false,
};

const writtenInventory = write('recovered-inventory.json', inventory);
assert.deepEqual(writtenInventory, inventoryBinding);
const writtenValidation = write('inventory-validation.json', validation);
console.log(JSON.stringify({result: 'RECOVERED_INVENTORY_PREPARED', inventory: writtenInventory, validation: writtenValidation, sections: 15, cases: 80, historicalOutcomesPromoted: false, productExecutions: 0}));
