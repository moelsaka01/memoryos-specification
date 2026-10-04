// Zero-product, append-only validation of the Phase 3AR2 H harness-margin correction.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const evidenceRel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-harness-correction';
const evidence = path.join(root, evidenceRel);
const priorToolsRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final';
const priorEvidenceRel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final';
const priorReportRel = 'docs/mo1307-phase3ar2-final.md';
const sourceRel = 'repositories/memoryos-readiness';
const freshRuntimeRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h-corrected/runtime-controls.mjs';
const authorizationPath = 'C:/Users/melsa/.codex/attachments/e98db116-fc36-410b-b6b8-a9ae9d9c457e/Pasted text.txt';
const authorizationSha256 = 'sha256:99e921a062b4804a9251da13b330b821f684484220db7ab56470e5f2b298e643';
const C3VB = '17fa84efe46d30e6f4be85fd2427485677a222a3';
const C3V = '98b766f9218b209f52251147213839b9775f6da3';
const productionTree = 'b9dabf54572e06c96bb5e48c4e20671f2cc24053';
const packageIdentity = 'sha256:0890ca4893ef76118eefbb2b5676ad084c60c70408d9e489f92aa33b74ba45b7';
const classification = 'H_HARNESS_MARGIN_DEFECT';
const oldTimelyToken = "'timely-helper',{eofDelayMs:8200,minMs:8000,maxMs:9000}";
const newTimelyToken = "'timely-helper',{eofDelayMs:0,maxMs:5000}";
const outputNames = [
  'authorization.txt',
  'failure-analysis.json',
  'source-bindings.json',
  'structural-validation.json',
  'zero-execution-proof.json',
  'receipt.json'
];

const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const record = file => {
  const bytes = fs.readFileSync(file);
  return { path: relative(file), byteLength: bytes.length, sha256: hash(bytes) };
};
const externalRecord = file => {
  const bytes = fs.readFileSync(file);
  return { path: file.replaceAll('\\', '/'), byteLength: bytes.length, sha256: hash(bytes) };
};
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const walk = (base, prefix = '') => fs.readdirSync(path.join(base, prefix), { withFileTypes: true })
  .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  .flatMap(entry => {
    const memberPath = prefix ? prefix + '/' + entry.name : entry.name;
    const full = path.join(base, memberPath);
    const stat = fs.lstatSync(full);
    assert.equal(stat.isSymbolicLink(), false, full);
    return stat.isDirectory() ? walk(base, memberPath) : [{ ...record(full), path: memberPath }];
  });
const treeHash = members => hash(Buffer.from(members.map(row => `${row.path}\0${row.byteLength}\0${row.sha256}\n`).join('')));
const bindTree = (rel, expectedMembers, expectedSha256) => {
  const members = walk(path.join(root, rel));
  const sha256 = treeHash(members);
  assert.equal(members.length, expectedMembers, rel);
  assert.equal(sha256, expectedSha256, rel);
  return { path: rel, members: members.length, memberRecordSetSha256: sha256 };
};
const bindFile = (rel, expectedBytes, expectedSha256) => {
  const binding = record(path.join(root, rel));
  assert.equal(binding.byteLength, expectedBytes, rel);
  assert.equal(binding.sha256, expectedSha256, rel);
  return binding;
};
const count = (text, token) => text.split(token).length - 1;
const lines = text => text.split(/\r?\n/);
const exactBlock = (text, prefix, lineCount) => {
  const sourceLines = lines(text);
  const index = sourceLines.findIndex(line => line.startsWith(prefix));
  assert.notEqual(index, -1, prefix);
  return sourceLines.slice(index, index + lineCount).join('\n');
};
const put = (name, bytes) => {
  const file = path.join(evidence, name);
  assert.ok(file.startsWith(evidence + path.sep));
  fs.writeFileSync(file, bytes, { flag: 'wx' });
  return record(file);
};
const write = (name, value) => put(name, Buffer.from(JSON.stringify(value, null, 2) + '\n'));

assert.equal(process.argv.length, 2);
assert.equal(path.resolve(root).toLowerCase(), 'c:\\users\\melsa\\documents\\codex\\3ar2');
assert.equal(fs.existsSync(evidence), false, 'H correction evidence already exists; retry is forbidden');

const authorizationBytes = fs.readFileSync(authorizationPath);
assert.equal(authorizationBytes.length, 7382);
assert.equal(hash(authorizationBytes), authorizationSha256);

const priorTools = bindTree(priorToolsRel, 26, 'sha256:a1269fb4bf0a950c19f6a0d523a3b36720e3df3df382eb6db4bb328456e2e4af');
const priorEvidence = bindTree(priorEvidenceRel, 374, 'sha256:519c9ef75e33ef8b8f0ac9ea411c59a03b74ca0b51b87a995132ad0487a741a8');
const priorReport = bindFile(priorReportRel, 6946, 'sha256:fb58c587aeb9bef5b92979e89ca3db7d3ffd8e43444f787c38563f147776591d');
const priorReceipt = bindFile(priorEvidenceRel + '/certification-receipt.json', 337821, 'sha256:c0b83b89a3216892460d668f8eef5426a60a4f787b2f93b01af58b4ec57fe0df');
const priorClosure = bindFile(priorEvidenceRel + '/closure.json', 883, 'sha256:a3a00e59ad7f30ab28bdd0378b44ab5ff52836907ae2b5058059f9a116486ac6');
const priorRuntimeReceipt = bindFile(priorEvidenceRel + '/runtime-H/receipt.json', 17039, 'sha256:fe9553186f3f06829f7e5f8bcaaeb5cbdd1f98098bdccab7115a3b31361d4cea');
const priorTimelyCase = bindFile(priorEvidenceRel + '/runtime-H/timely-helper.json', 2297, 'sha256:07df78abc4787068de6624881ea04a1c06e6219c1c609a22620f48b71cb6d89c');
const priorBaseline = bindFile(priorEvidenceRel + '/baseline.json', 33326, 'sha256:ff801946effea7a7b31d32a483fee626331c01875d81f5aec9ef5a3c3fa7d0a0');
const priorCandidateBefore = bindFile(priorEvidenceRel + '/candidate-before.json', 28700, 'sha256:2180aca670d277a550fa41a6389a3af55490e6b196b838b9d912744e567e81d2');
const priorRuntimeSource = bindFile(priorToolsRel + '/runtime-controls.mjs', 21352, 'sha256:a506c9a2983646da9aed934440b8acc5add95e1f7ecc12069fc9be762fed350e');

const certification = readJson(path.join(root, priorEvidenceRel, 'certification-receipt.json'));
assert.equal(certification.result, 'PHASE3AR2_CONCRETE_BLOCKER');
assert.equal(certification.certificationPassed, false);
assert.deepEqual(certification.steps.map(row => [row.step, row.result]), [
  ['A', 'PASS'], ['B', 'PASS'], ['C', 'PASS'], ['D', 'PASS'], ['E', 'PASS'], ['F', 'PASS'], ['G', 'PASS'],
  ['H', 'FAIL'], ['I', 'NOT_RUN'], ['J', 'NOT_RUN'], ['K', 'NOT_RUN'], ['L', 'NOT_RUN'], ['M', 'NOT_RUN'], ['N', 'NOT_RUN'], ['O', 'NOT_RUN']
]);
assert.deepEqual(certification.completed, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
assert.deepEqual(certification.unexecuted, ['I', 'J', 'K', 'L', 'M', 'N', 'O']);
assert.equal(certification.firstMandatoryFailure.step, 'H');
assert.equal(certification.diagnosticsRun, 0);
assert.equal(certification.retries, 0);
assert.equal(certification.replacementExecutions, 0);

const runtimeReceipt = readJson(path.join(root, priorEvidenceRel, 'runtime-H/receipt.json'));
const timely = readJson(path.join(root, priorEvidenceRel, 'runtime-H/timely-helper.json'));
const boundary = readJson(path.join(root, priorEvidenceRel, 'runtime-H/strict-9000-boundary.json'));
assert.equal(runtimeReceipt.result, 'FAIL');
assert.equal(runtimeReceipt.noProductChanges, true);
assert.deepEqual(runtimeReceipt.dependenciesAfter, runtimeReceipt.dependenciesBefore);
assert.equal(runtimeReceipt.cases.length, 1);
assert.equal(timely.name, 'timely-helper');
assert.equal(timely.result, 'FAIL');
assert.equal(timely.elapsedMs, 9036.9764);
assert.deepEqual(timely.engineeringElapsedEnvelope, { minMs: 8000, maxMs: 9000, productDeadlineOverride: false });
assert.equal(timely.expectedError, null);
assert.deepEqual(timely.error, { code: 'MO1307_TIMEOUT', message: 'MO1307_TIMEOUT' });
assert.equal(timely.snapshot.terminalCode, 'MO1307_TIMEOUT');
assert.equal(timely.snapshot.cleanupConfirmed, false);
assert.equal(timely.snapshot.events.find(row => row.type === 'start').deadline, 9317.097);
assert.equal(timely.snapshot.events.find(row => row.type === 'terminal').at, 9325.2521);
const failedInvocation = runtimeReceipt.invocations[0];
assert.equal(failedInvocation.name, 'timely-helper');
assert.equal(failedInvocation.startedAt, 335.4142);
assert.equal(failedInvocation.eofDelayMs, 8200);
assert.equal(failedInvocation.responseAt, null);
assert.equal(failedInvocation.exitSignal, 'SIGTERM');
assert.equal(failedInvocation.transportClosed, true);
const stdinFinishAt = failedInvocation.streamEvents.find(row => row.id === 'stdin' && row.event === 'finish').at;
assert.equal(stdinFinishAt, 8542.7565);
const postEofDeadlineMarginMs = timely.snapshot.events.find(row => row.type === 'start').deadline - stdinFinishAt;
assert.ok(Math.abs(postEofDeadlineMarginMs - 774.3405) < 0.000001);
const expectedBoundaryChecks = [
  { name: 'former-equality-8000-now-success', elapsedMs: 8000, expected: 'PASS', actual: 'PASS', result: 'PASS', installedRuntime: true },
  { name: 'strict-before-9000', elapsedMs: 8999, expected: 'PASS', actual: 'PASS', result: 'PASS', installedRuntime: true },
  { name: 'equality-9000-timeout', elapsedMs: 9000, expected: 'MO1307_TIMEOUT', actual: 'MO1307_TIMEOUT', result: 'PASS', installedRuntime: true }
];
assert.equal(boundary.result, 'PASS');
assert.equal(boundary.authority, 'PROSPECTIVE_HELPER_BOUND@2.0.0');
assert.deepEqual(boundary.relation, { success: 'elapsedMs < 9000', timeout: 'elapsedMs >= 9000', equality: 'TIMEOUT' });
assert.deepEqual(boundary.checks, expectedBoundaryChecks);
assert.deepEqual(runtimeReceipt.strictBoundaryChecks, expectedBoundaryChecks);

const baseline = readJson(path.join(root, priorEvidenceRel, 'baseline.json'));
const candidateBefore = readJson(path.join(root, priorEvidenceRel, 'candidate-before.json'));
const sourceMembers = walk(path.join(root, sourceRel));
const definitions = readJson(path.join(root, sourceRel, 'contracts/definitions.json'));
const helperSource = sourceMembers.find(row => row.path === 'helpers/windows-inspect.ps1');
assert.equal(baseline.HEAD, C3VB);
assert.equal(baseline.productionCommit, C3V);
assert.equal(baseline.productionTree, productionTree);
assert.equal(baseline.productionChanges, 0);
assert.equal(baseline.candidate.packageIdentity, packageIdentity);
assert.equal(candidateBefore.candidate, C3VB);
assert.equal(candidateBefore.productionCommit, C3V);
assert.equal(candidateBefore.productionTree, productionTree);
assert.equal(candidateBefore.packageIdentity, packageIdentity);
assert.equal(candidateBefore.productionGitDiff, '');
assert.equal(sourceMembers.length, 89);
assert.equal(treeHash(sourceMembers), 'sha256:d837cc9ca6b654441b6218bce21024b40ea2f08080b4217192bb595e9cee9668');
assert.deepEqual(sourceMembers, baseline.source);
assert.deepEqual(sourceMembers, candidateBefore.members);
assert.equal(definitions.limits.helperDeadlineMs, 9000);
assert.equal(definitions.limits.helperAggregateDeadlineMs, 28000);
assert.equal(definitions.limits.apiDeadlineMs, 10000);
assert.equal(definitions.limits.cliDeadlineMs, 30000);
assert.equal(definitions.limits.cleanupAllowanceMs, 2000);
assert.deepEqual(helperSource, {
  path: 'helpers/windows-inspect.ps1',
  byteLength: 29153,
  sha256: 'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127'
});

const oldRuntimeText = fs.readFileSync(path.join(root, priorToolsRel, 'runtime-controls.mjs'), 'utf8');
const freshRuntimePath = path.join(root, freshRuntimeRel);
const freshRuntimeText = fs.readFileSync(freshRuntimePath, 'utf8');
assert.equal(count(oldRuntimeText, oldTimelyToken), 1);
assert.equal(count(oldRuntimeText, newTimelyToken), 0);
assert.equal(count(freshRuntimeText, oldTimelyToken), 0);
assert.equal(count(freshRuntimeText, newTimelyToken), 1);
assert.equal(count(oldRuntimeText, '.cache/phase3ar2-final/install/node_modules/memoryos-readiness'), 1);
assert.equal(count(freshRuntimeText, '.cache/phase3ar2-final-h-corrected/install/node_modules/memoryos-readiness'), 1);
assert.equal(count(oldRuntimeText, 'evidence/mo1307/phase3ar2-final/runtime-'), 1);
assert.equal(count(freshRuntimeText, 'evidence/mo1307/phase3ar2-final-h-corrected/runtime-'), 1);

const controlBlocks = [
  { name: 'deterministic-boundary', prefix: " for(const [name,elapsed,expected] of [['former-equality-8000-now-success'", lines: 6 },
  { name: 'boundary-receipt', prefix: " write('strict-9000-boundary.json'", lines: 1 },
  { name: 'cleanup-finalization', prefix: ' finally{try{await supervisor.dispose();}', lines: 1 },
  { name: 'cancel-before-helper', prefix: " await run('cancel-before-helper'", lines: 1 },
  { name: 'helper-timeout', prefix: " await run('helper-timeout'", lines: 1 },
  { name: 'late-helper-success-rejected', prefix: " await run('late-helper-success-rejected'", lines: 1 },
  { name: 'cancel-during-helper', prefix: " await run('cancel-during-helper'", lines: 1 },
  { name: 'cancel-between-helper-worker', prefix: " await run('cancel-between-helper-worker'", lines: 1 },
  { name: 'aggregate-helper-exhaustion', prefix: " await run('aggregate-helper-exhaustion'", lines: 7 },
  { name: 'case-set-and-no-overlap-sequence', prefix: '  assert.deepEqual(cases.map(row=>row.name)', lines: 3 }
];
const unchangedControls = controlBlocks.map(spec => {
  const oldBlock = exactBlock(oldRuntimeText, spec.prefix, spec.lines);
  const freshBlock = exactBlock(freshRuntimeText, spec.prefix, spec.lines);
  assert.equal(freshBlock, oldBlock, spec.name);
  return { name: spec.name, lines: spec.lines, sha256: hash(Buffer.from(oldBlock)) };
});
assert.equal(count(oldRuntimeText, 'noRetry:true'), count(freshRuntimeText, 'noRetry:true'));
assert.ok(count(freshRuntimeText, 'noRetry:true') >= 1);

const normalizeRuntime = text => text
  .replaceAll('.cache/phase3ar2-final-h-corrected', '.cache/<GENERATION>')
  .replaceAll('.cache/phase3ar2-final', '.cache/<GENERATION>')
  .replaceAll('evidence/mo1307/phase3ar2-final-h-corrected/runtime-', 'evidence/mo1307/<GENERATION>/runtime-')
  .replaceAll('evidence/mo1307/phase3ar2-final/runtime-', 'evidence/mo1307/<GENERATION>/runtime-')
  .replaceAll(oldTimelyToken, "'timely-helper',{eofDelayMs:<CORRECTED>,maxMs:<CORRECTED>}")
  .replaceAll(newTimelyToken, "'timely-helper',{eofDelayMs:<CORRECTED>,maxMs:<CORRECTED>}");
const normalizedOld = normalizeRuntime(oldRuntimeText);
const normalizedFresh = normalizeRuntime(freshRuntimeText);
assert.equal(normalizedFresh, normalizedOld, 'Only the namespace/cache relocation and timely-helper tuple may differ');

const correction = { eofDelayMs: 0, minMs: null, maxMs: 5000 };
const executionCounters = {
  productInvocations: 0,
  semanticEvaluations: 0,
  helperInvocations: 0,
  workerInvocations: 0,
  observerInvocations: 0,
  childProcessInvocations: 0,
  packageBuilds: 0,
  packageInstalls: 0,
  certificationCases: 0,
  diagnosticsRun: 0,
  retries: 0,
  replacementExecutions: 0,
  historicalEvidencePromotions: 0
};
assert.ok(Object.values(executionCounters).every(value => value === 0));

const createdAt = new Date().toISOString();
const failureAnalysis = {
  kind: 'MO1307Phase3AR2FinalHHarnessFailureAnalysis',
  version: '1.0.0',
  createdAt,
  result: 'PASS',
  classification,
  classificationCount: 1,
  classificationUniverse: ['H_HARNESS_MARGIN_DEFECT', 'H_PRODUCT_DEADLINE_DEFECT', 'H_EXPECTATION_AUTHORITY_CONFLICT'],
  rejectedClassifications: {
    H_PRODUCT_DEADLINE_DEFECT: 'Rejected: the installed runtime enforced the authorized strict boundary exactly at 8000, 8999, and 9000 ms.',
    H_EXPECTATION_AUTHORITY_CONFLICT: 'Rejected: authority requires only elapsedMs < 9000 and imposes no 8000-ms real-time minimum; the independent deterministic edge controls match that authority.'
  },
  preservedGeneration: {
    result: 'PHASE3AR2_CONCRETE_BLOCKER',
    steps: { A: 'PASS', B: 'PASS', C: 'PASS', D: 'PASS', E: 'PASS', F: 'PASS', G: 'PASS', H: 'FAIL', I: 'NOT_RUN', J: 'NOT_RUN', K: 'NOT_RUN', L: 'NOT_RUN', M: 'NOT_RUN', N: 'NOT_RUN', O: 'NOT_RUN' },
    resumed: false,
    rewritten: false,
    retried: false
  },
  failedControl: {
    name: 'timely-helper',
    expectedResult: 'PASS',
    expectedElapsedMs: { minimumInclusive: 8000, maximumExclusive: 9000 },
    actualElapsedMs: 9036.9764,
    actualError: 'MO1307_TIMEOUT',
    eofDelayMs: 8200,
    helperInvocationStartedAt: 335.4142,
    stdinFinishedAt: 8542.7565,
    selectedProductDeadlineAt: 9317.097,
    productTerminalEventAt: 9325.2521,
    postEofDeadlineMarginMs: Number(postEofDeadlineMarginMs.toFixed(4)),
    responseObserved: false,
    exitSignal: 'SIGTERM'
  },
  deterministicBoundary: boundary,
  diagnosis: 'The harness intentionally withheld stdin EOF for 8200 ms and left only 774.3405 ms for native helper startup, request processing, response delivery, and exit before the immutable 9000-ms product deadline. The near-boundary harness envelope, not product deadline enforcement or authority interpretation, caused the failure.',
  correction,
  correctionRationale: 'Remove the artificial EOF hold and require completion below 5000 ms, preserving at least 4000 ms of headroom beneath the immutable 9000-ms product deadline.',
  productionChange: false,
  authorityChange: false,
  limitChange: false,
  retry: false
};

const sourceBindings = {
  kind: 'MO1307Phase3AR2FinalHHarnessCorrectionSourceBindings',
  version: '1.0.0',
  createdAt,
  result: 'PASS',
  candidate: { name: 'C3VB', commit: C3VB, productionCommit: C3V, productionTree, packageIdentity },
  authorizationSource: externalRecord(authorizationPath),
  preservedFailedGeneration: {
    tools: priorTools,
    evidence: priorEvidence,
    report: priorReport,
    certificationReceipt: priorReceipt,
    closure: priorClosure,
    runtimeReceipt: priorRuntimeReceipt,
    timelyCase: priorTimelyCase,
    baseline: priorBaseline,
    candidateBefore: priorCandidateBefore,
    runtimeSource: priorRuntimeSource
  },
  currentTrackedProductionSource: {
    path: sourceRel,
    members: sourceMembers.length,
    memberRecordSetSha256: treeHash(sourceMembers),
    equalsPriorBaselineSource: true,
    equalsPriorCandidateBeforeMembers: true
  },
  currentHelperSource: helperSource,
  currentLimits: definitions.limits,
  correctedRuntimeSource: record(freshRuntimePath),
  oldGenerationBytesPreserved: true
};

const structuralValidation = {
  kind: 'MO1307Phase3AR2FinalHHarnessStructuralValidation',
  version: '1.0.0',
  createdAt,
  result: 'PASS',
  classification,
  correction,
  immutableProductDeadlineMs: 9000,
  maximumCorrectedEnvelopeMs: 5000,
  minimumDeadlineHeadroomMs: 4000,
  nearBoundaryIntervalRemoved: true,
  requiredNewToken: newTimelyToken,
  forbiddenOldToken: oldTimelyToken,
  requiredNewTokenOccurrences: 1,
  forbiddenOldTokenOccurrences: 0,
  normalizedOldRuntimeSha256: hash(Buffer.from(normalizedOld)),
  normalizedFreshRuntimeSha256: hash(Buffer.from(normalizedFresh)),
  normalizedSourcesEqual: true,
  allowedDifferences: ['fresh cache namespace', 'fresh evidence namespace', 'timely-helper engineering tuple'],
  unchangedControls,
  deterministicBoundaries: expectedBoundaryChecks,
  timeoutLateCancelCleanupAggregateAndNoOverlapControlsUnchanged: true,
  productionSourceUnchanged: true,
  helperSourceUnchanged: true,
  packageIdentityUnchanged: true,
  productLimitsUnchanged: true,
  noProductOrHelperExecution: true
};

const zeroExecutionProof = {
  kind: 'MO1307Phase3AR2FinalHHarnessCorrectionZeroExecutionProof',
  version: '1.0.0',
  createdAt,
  result: 'PASS',
  scope: 'Static filesystem, byte-hash, JSON, and source-structure validation only',
  imports: ['node:fs', 'node:path', 'node:crypto', 'node:assert/strict', 'node:url'],
  executionCounters,
  productionLoaded: false,
  productModulesImported: false,
  helperLoaded: false,
  helperSpawned: false,
  workerSpawned: false,
  observerSpawned: false,
  childProcessCapabilityImported: false,
  networkAccess: false,
  packageMutation: false,
  historicalEvidenceMutation: false,
  retry: false,
  noRetry: true
};

fs.mkdirSync(evidence, { recursive: true });
const authorization = put('authorization.txt', authorizationBytes);
const failureAnalysisBinding = write('failure-analysis.json', failureAnalysis);
const sourceBindingsBinding = write('source-bindings.json', sourceBindings);
const structuralValidationBinding = write('structural-validation.json', structuralValidation);
const zeroExecutionProofBinding = write('zero-execution-proof.json', zeroExecutionProof);
const receipt = {
  kind: 'MO1307Phase3AR2FinalHHarnessCorrectionReceipt',
  version: '1.0.0',
  createdAt,
  result: 'PASS',
  outcome: 'H_HARNESS_MARGIN_DEFECT_VALIDATED',
  classification,
  classificationCount: 1,
  correction,
  correctedControl: { artificialEofDelayMs: 0, engineeringMaxMs: 5000, engineeringMinMs: null, productDeadlineMs: 9000 },
  zeroProductValidation: 'PASS',
  structuralValidation: 'PASS',
  productionChanged: false,
  helperChanged: false,
  authoritiesChanged: false,
  limitsChanged: false,
  preservedFailedGenerationChanged: false,
  executionCounters,
  execution: { certificationRuns: 0, helperRuns: 0, nativeObserverRuns: 0, productRuns: 0, workerRuns: 0 },
  retry: false,
  noRetry: true,
  fullCertificationStarted: false,
  expectedEvidenceMembers: outputNames,
  bindings: {
    authorization,
    failureAnalysis: failureAnalysisBinding,
    sourceBindings: sourceBindingsBinding,
    structuralValidation: structuralValidationBinding,
    zeroExecutionProof: zeroExecutionProofBinding
  },
  push: false,
  tag: false,
  phase3DStarted: false
};
write('receipt.json', receipt);
assert.deepEqual(walk(evidence).map(row => row.path), [...outputNames].sort());
process.stdout.write(JSON.stringify({ result: receipt.result, outcome: receipt.outcome, classification, correction, executionCounters }) + '\n');
