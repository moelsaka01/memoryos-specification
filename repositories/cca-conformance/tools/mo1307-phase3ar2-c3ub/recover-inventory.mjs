import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  root,
  E,
  T,
  relativeE,
  HEAD,
  C3UB,
  C3U,
  authority,
  hash,
  json,
  record,
  write,
  git,
  str,
  identity,
} from './common.mjs';

// Definition recovery only. Read the exact all-NOT_RUN inventory preserved by
// the failed C3TB generation and adapt only current candidate/authority fields.
// This performs no package install, product execution, helper execution, worker
// execution, certification case, or historical outcome promotion.
assert.equal(process.argv.length, 2, 'recover-inventory.mjs accepts no arguments');
identity();

const sourceRevision = '9f45656cdb1fe8899cfd6abceb8061bbba459d73';
const sourceCommit = sourceRevision;
const sourcePath = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-c3tb/recovered-inventory.json';
const sourceBlob = '0d8815d060cb7889e7896cc1f34de4d1433ca862';
const sourceByteLength = 96633;
const sourceSha256 = 'sha256:c2c31b709a0b1b72ccb537df105c484f0190a50a619185b532115c1cdff85fc6';
const sourceCandidate = '119e68bdcf0ffc906b4ca03a912aadcb25908346';
const sourceProductionCandidate = '65e24b2debdd70ecb8e52fbccbd6c101621f1917';
const sourceProductionTree = '324bf600b6cbfaa8564db27fce2d999711270cb8';
const sourceAuthority = 'PROSPECTIVE_HELPER_BOUND@1.0.0';
const originalSource = {
  requestedRevision: 'bf715553',
  commit: 'bf715553bf815654098e01ddd217448f00743414',
  path: 'repositories/cca-conformance/evidence/mo1307/phase3a-c3rb-restart/recovered-inventory.json',
  selector: 'bf715553bf815654098e01ddd217448f00743414:repositories/cca-conformance/evidence/mo1307/phase3a-c3rb-restart/recovered-inventory.json',
  blob: 'a30be79898ec9cd22101d9b11532375697d5854a',
  byteLength: 68277,
  sha256: 'sha256:ae927858aed6c9ddc255ed0efb9fb74160ffbd899f9780aa6c3f9109ae51b784',
};
const productionTree = '302cf1a506e974b2102a78be1b9c920ac80105b2';
const toolNamespace = 'repositories/cca-conformance/tools/mo1307-phase3ar2-c3ub';
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

assert.equal(HEAD, C3UB);
assert.equal(str('rev-parse', sourceRevision + '^{commit}'), sourceCommit);
assert.equal(str('rev-parse', sourceCommit + ':' + sourcePath), sourceBlob);
assert.equal(str('rev-parse', originalSource.commit + ':' + originalSource.path), originalSource.blob);
assert.equal(str('show', '-s', '--format=%P', C3UB), C3U);
assert.equal(str('rev-parse', C3UB + ':repositories/memoryos-readiness'), productionTree);
assert.equal(str('rev-parse', C3U + ':repositories/memoryos-readiness'), productionTree);

const sourceBytes = git('show', sourceCommit + ':' + sourcePath);
assert.equal(sourceBytes.length, sourceByteLength);
assert.equal(hash(sourceBytes), sourceSha256);
const originalSourceBytes = git('show', originalSource.commit + ':' + originalSource.path);
assert.equal(originalSourceBytes.length, originalSource.byteLength);
assert.equal(hash(originalSourceBytes), originalSource.sha256);
const sourceInventory = JSON.parse(sourceBytes.toString('utf8'));
assert.equal(sourceInventory.kind, 'MO1307Phase3AR2C3TBRecoveredCertificationInventory');
assert.equal(sourceInventory.status, 'RECOVERED_ADAPTED_NOT_EXECUTED_NOT_ACCEPTED');
assert.equal(sourceInventory.candidate, sourceCandidate);
assert.equal(sourceInventory.productionCandidate, sourceProductionCandidate);
assert.equal(sourceInventory.productionTree, sourceProductionTree);
assert.equal(sourceInventory.integrationAuthority, sourceAuthority);
assert.equal(sourceInventory.productExecutionPerformed, false);
assert.equal(sourceInventory.historicalFilesModified, false);
assert.equal(sourceInventory.authentication.newCertificationEvidence, false);
assert.equal(sourceInventory.authentication.historicalOutcomesPromoted, false);
assert.deepEqual(sourceInventory.definitionRecovery.source, originalSource);
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
assert.equal(priorHelperAdaptation.from.wholeLifecycleMs, 5000);
assert.equal(priorHelperAdaptation.to.wholeLifecycleMs, 8000);

const authorityFileSpecifications = [
  {role: 'PROSPECTIVE_BOUND_AUTHORITY', path: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/authority.json', byteLength: 2318, sha256: 'sha256:6d5e04401c6d8ead77901b0c0ec8ec3fbf17b353e5fa4cf39e17ad3e8d1a7788'},
  {role: 'PROSPECTIVE_CANDIDATE_RECORD', path: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/candidate.json', byteLength: 20367, sha256: 'sha256:0525104e26f4a9de29a0ccec7406f95d4d264fb3d2a542f83f866caac15e9bbf'},
  {role: 'CHANGED_FILE_INVENTORY', path: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/changed-file-inventory.json', byteLength: 3985, sha256: 'sha256:2ac6aeba7c5a5d3af5ce7c76e4791ec176aba67309b48b24ddd284c4c1529ace'},
  {role: 'CONSISTENCY_VALIDATION', path: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/consistency-validation.json', byteLength: 2569, sha256: 'sha256:772571073f22dc29154640372e084eac6e3b248da1f46d4cffab2d219c3ca691'},
  {role: 'PHASE_3A_HANDOFF', path: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/phase3a-handoff.json', byteLength: 960, sha256: 'sha256:f55d5e5f3a5c415375e30c3f7a3115aa2ca71dd45d5a49572fd247850116d003'},
  {role: 'PHASE_3B_REFRESH_MAP', path: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/phase3b-refresh-map.json', byteLength: 1665, sha256: 'sha256:8ac9b756541955357c307c9bf9b9163f3e35f93fe02b049c8da924d694d021c2'},
  {role: 'PHASE_3C_REFRESH_MAP', path: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/phase3c-refresh-map.json', byteLength: 21301, sha256: 'sha256:394593c2f7ca54c7c6d12b8ead0290aa61d28ffa7f9ddd7d3424995ac9b39420'},
  {role: 'CANDIDATE_BINDING', path: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/binding.json', byteLength: 27470, sha256: 'sha256:b48d3d08d1c7a5f1780970b2f12bc8d7e4a2c37c8c687ec91de6ac0694d860d0'},
  {role: 'BINDING_VERIFICATION', path: 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/binding-verification.json', byteLength: 1154, sha256: 'sha256:749b98e950bb30f435ac8d0f06979d6817fec428c3f828312b3be2abdee36d8c'},
  {role: 'PROSPECTIVE_BOUND_SPECIFICATION', path: 'docs/mo1307-prospective-helper-bound-v2-candidate.md', byteLength: 3344, sha256: 'sha256:397ffffabb9d6fa5fcf8650686ec01064759ae80180aaa7a3633bf51918f3945'},
  {role: 'FINAL_HEADLESS_AUTHORIZATION', path: 'repositories/cca-conformance/evidence/mo1307/final-headless/authorization.txt', byteLength: 12394, sha256: 'sha256:31442e397007ead68da717088a502d4b0d860580bb34518b19d83097a89cbd66'},
  {role: 'FINAL_HEADLESS_ADDENDUM', path: 'docs/mo1307-final-headless-correction-addendum.md', byteLength: 11416, sha256: 'sha256:40303f1c51637de94057fc5203c6729bf9763496d4e63640278f1d10b0be6024'},
];
const currentAuthorityBindings = authorityFileSpecifications.map(({role, ...expected}) => {
  const actual = record(expected.path);
  assert.deepEqual(actual, expected);
  const committedBytes = git('show', C3UB + ':' + expected.path);
  assert.equal(committedBytes.length, expected.byteLength);
  assert.equal(hash(committedBytes), expected.sha256);
  return {role, ...actual, gitBlob: str('rev-parse', C3UB + ':' + expected.path)};
});

const authorityDocument = json(authorityFileSpecifications[0].path);
const handoff = json(authorityFileSpecifications[4].path);
const binding = json(authorityFileSpecifications[7].path);
const bindingVerification = json(authorityFileSpecifications[8].path);
const expectedLimits = {aggregateHelperActiveMs: 20000, apiMs: 10000, cleanupMs: 2000, cliAdmissionMs: 30000, helperMs: 9000, workerMs: 10000};
assert.equal(authorityDocument.identity, authority);
assert.equal(authorityDocument.status, 'ADOPTED_PROSPECTIVELY');
assert.equal(authorityDocument.valueMs, 9000);
assert.deepEqual(authorityDocument.limits, expectedLimits);
assert.deepEqual(authorityDocument.relation, {equality: 'TIMEOUT', success: 'elapsedMs < 9000', timeout: 'elapsedMs >= 9000'});
assert.equal(authorityDocument.cleanup.separateAllowanceMs, 2000);
assert.equal(authorityDocument.cleanup.beginsAfterTerminalHelperOutcome, true);
assert.equal(authorityDocument.cleanup.successGrace, false);
assert.equal(handoff.authority, authority);
assert.equal(handoff.candidateRole, 'C3U');
assert.equal(handoff.consumeRule, 'EXACT_C3UB_HEAD_AFTER_BINDING_VERIFICATION');
assert.equal(handoff.mode, 'FRESH_FULL_A_TO_O');
assert.equal(handoff.certificationStarted, false);
assert.deepEqual(handoff.inventory, expectedSections);
assert.deepEqual(handoff.limits, expectedLimits);
assert.equal(binding.result, 'NEW_PRODUCTION_CANDIDATE_READY_FOR_PHASE3');
assert.equal(binding.candidateRole, 'C3U');
assert.equal(binding.bindingRole, 'C3UB');
assert.equal(binding.binding.soleParent, C3U);
assert.equal(binding.binding.productionChanges, false);
assert.equal(binding.phase3AExecuted, false);
assert.deepEqual(binding.limits, expectedLimits);
assert.equal(bindingVerification.result, 'PASS');
assert.equal(bindingVerification.candidateCommit, C3U);
assert.equal(bindingVerification.productionTree, productionTree);
assert.equal(bindingVerification.productionChangesInBindingCommit, false);
assert.equal(bindingVerification.certificationExecuted, false);

const inventory = structuredClone(sourceInventory);
inventory.kind = 'MO1307Phase3AR2C3UBRecoveredCertificationInventory';
inventory.status = 'RECOVERED_ADAPTED_NOT_EXECUTED_NOT_ACCEPTED';
inventory.candidate = C3UB;
inventory.candidateRole = 'C3UB';
inventory.productionCandidate = C3U;
inventory.productionRole = 'C3U';
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
};
inventory.sourceSnapshots = inventory.sourceSnapshots.map(row => ({...row, interpretation: 'HISTORICAL_DEFINITION_AUTHORITY_ONLY_NO_OUTCOME_PROMOTION'}));
inventory.limits.helperWholeLifecycleMs = 9000;
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
  lifecycle: authorityDocument.lifecycle,
};
inventory.namespace = {evidence: relativeE, tools: toolNamespace, cache: '.cache/phase3ar2-c3ub', report: 'docs/mo1307-phase3ar2-c3ub.md'};
inventory.filesWrittenOnlyUnder = [relativeE, '.cache/phase3ar2-c3ub', 'docs/mo1307-phase3ar2-c3ub.md'];
inventory.historicalFilesModified = false;
inventory.productExecutionPerformed = false;
inventory.currentAuthority = {
  identity: authority,
  candidate: C3UB,
  productionCandidate: C3U,
  productionTree,
  prospectiveOnly: true,
  certificationStarted: false,
  bindings: currentAuthorityBindings,
};
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
timelyHelper.expected.durationMs = '<9000';
timelyHelper.expected.successRelation = 'elapsedMs < 9000';
helperTimeout.expected.clock = '9000 ms whole helper lifecycle';
helperTimeout.expected.timeoutRelation = 'elapsedMs >= 9000';
helperTimeout.expected.equality = 'TIMEOUT';
helperTimeout.immediateHistoricalSourceCase = helperTimeout.sourceCase;
helperTimeout.sourceCase = 'helper-9000ms-timeout';
helperStep.currentBoundary = inventory.helperBoundary;

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
  {scope: 'IDENTITY', from: {candidate: sourceCandidate, productionCandidate: sourceProductionCandidate, productionTree: sourceProductionTree, integrationAuthority: sourceAuthority}, to: {candidate: C3UB, productionCandidate: C3U, productionTree, integrationAuthority: authority}, historicalOutcomePromoted: false},
  {scope: 'NAMESPACE', from: sourceInventory.namespace, to: {evidence: relativeE, tools: toolNamespace, cache: '.cache/phase3ar2-c3ub', report: 'docs/mo1307-phase3ar2-c3ub.md'}, historicalOutcomePromoted: false},
  {scope: 'H_HELPER_BOUNDARY', from: {wholeLifecycleMs: 8000, success: 'elapsedMs < 8000', timeout: 'elapsedMs >= 8000', equality: 'TIMEOUT'}, to: {wholeLifecycleMs: 9000, success: 'elapsedMs < 9000', timeout: 'elapsedMs >= 9000', equality: 'TIMEOUT'}, authority: currentAuthorityBindings.find(row => row.role === 'PROSPECTIVE_BOUND_AUTHORITY'), historicalOutcomePromoted: false},
  {scope: 'J_HEADLESS_BOUNDARY', from: sourceInventory.steps.find(row => row.step === 'J').cases[0].expected, to: cleanupExpected, changed: false, authority: currentAuthorityBindings.find(row => row.role === 'FINAL_HEADLESS_ADDENDUM'), historicalOutcomePromoted: false},
  {scope: 'EXECUTION_BOOKKEEPING', from: {steps: 'NOT_RUN', cases: {executionStatus: 'NOT_RUN', result: 'NOT_RUN'}}, to: {steps: 'NOT_RUN', cases: {executionStatus: 'NOT_RUN', result: 'NOT_RUN'}}, note: 'The preserved failed generation inventory already records all 15 steps and 80 cases as NOT_RUN; the fresh generation resets and verifies the same state without promoting its A failure.', historicalOutcomePromoted: false},
];
inventory.sealDisposition = 'Preparation only. Independently review and seal the exact final Phase 3AR2 C3UB tools, this fresh all-NOT_RUN inventory, current authority, fresh installed package, fixtures, and prepared inputs before the first A-O execution. This inventory confers no certification PASS or acceptance.';

assert.deepEqual(inventory.steps.map(row => row.step), expectedSections);
assert.deepEqual(inventory.steps.map(row => row.cases.length), expectedCounts);
assert.deepEqual(Object.fromEntries(inventory.steps.map(row => [row.step, row.cases.map(item => item.case)])), expectedCaseIds);
assert.equal(inventory.steps.flatMap(row => row.cases).length, 80);
assert.ok(inventory.steps.every(row => row.mandatory === true && row.executionStatus === 'NOT_RUN' && row.result === 'NOT_RUN'));
assert.ok(inventory.steps.flatMap(row => row.cases).every(item => item.mandatory === true && item.executionStatus === 'NOT_RUN' && item.result === 'NOT_RUN'));
assert.equal(inventory.limits.helperWholeLifecycleMs, 9000);
assert.equal(inventory.limits.aggregateHelperActiveMs, 20000);
assert.equal(inventory.limits.cliRenameAdmissionMs, 30000);
assert.equal(inventory.limits.apiWorkerMs, 10000);
assert.equal(inventory.limits.failureCleanupMs, 2000);
assert.equal(inventory.limits.replacementHelperBoundH, 'NOT_ESTABLISHED');
assert.equal(timelyHelper.expected.durationMs, '<9000');
assert.equal(helperTimeout.expected.timeoutRelation, 'elapsedMs >= 9000');
assert.equal(cleanupExpected.strictDeadlineRelation, 'cleanupDeadline === terminalAt + 2000');
assert.deepEqual(inventory.steps.find(row => row.step === 'O').cases.map(row => row.case), ['mo1306-qualified-final']);

// Prove all case definitions survive exactly except the recorded H-boundary
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
normalizedTimely.expected.successRelation = sourceTimely.expected.successRelation;
const normalizedTimeout = recoveredH.find(row => row.case === 'helper-timeout');
const sourceTimeout = sourceH.find(row => row.case === 'helper-timeout');
normalizedTimeout.expected.clock = sourceTimeout.expected.clock;
normalizedTimeout.expected.timeoutRelation = sourceTimeout.expected.timeoutRelation;
normalizedTimeout.expected.equality = sourceTimeout.expected.equality;
normalizedTimeout.sourceCase = sourceTimeout.sourceCase;
delete normalizedTimeout.immediateHistoricalSourceCase;
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
assert.ok(sourceCandidatePaths.every(item => item.startsWith('$.definitionRecovery.') || item.startsWith('$.prospectiveInventoryAdaptations[')), 'C3TB appears in a current-identity field');
assert.equal(inventory.candidate, C3UB);
assert.equal(inventory.productionCandidate, C3U);
assert.equal(inventory.integrationAuthority, authority);
assert.equal(inventory.authentication.historicalOutcomesPromoted, false);
assert.equal(inventory.authentication.productExecutions, 0);

const outputNames = ['recovered-inventory.json', 'inventory-validation.json'];
for (const name of outputNames) assert.equal(fs.existsSync(path.join(E, name)), false, 'Fresh output already exists: ' + name);
const inventoryBytes = Buffer.from(JSON.stringify(inventory, null, 2) + '\n');
const inventoryBinding = {path: relativeE + '/recovered-inventory.json', byteLength: inventoryBytes.length, sha256: hash(inventoryBytes)};
const validation = {
  kind: 'MO1307Phase3AR2C3UBInventoryValidation',
  version: '1.0.0',
  result: 'PASS',
  scope: 'PREPARATION_ONLY_NO_PRODUCT_OR_CERTIFICATION_EXECUTION',
  candidate: C3UB,
  candidateRole: 'C3UB',
  productionCandidate: C3U,
  productionRole: 'C3U',
  productionTree,
  integrationAuthority: authority,
  namespace: {evidence: relativeE, tools: toolNamespace},
  sourceDefinition: inventory.definitionRecovery.source,
  originalDefinitionSource: originalSource,
  currentAuthorityBindings,
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
    currentAuthorityFilesBoundToC3UB: true,
    currentCandidateIsC3UB: true,
    productionCandidateIsC3U: true,
    historicalCandidateOnlyInHistoricalProvenance: true,
    priorProspectiveInventoryAdaptationsPreserved: true,
    historicalOutcomesPromoted: false,
  },
  helperBoundary: inventory.helperBoundary,
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
