// Append-only Phase 3CR2 G6 acceptance-only administrative recovery.
//
// This program consumes the sealed G6 validation, plan, and pre-execution
// seal; verifies the immutable G2 through G5 chain; and never launches a
// product, helper, worker, native control, security control, or network operation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  ROOT,
  BRANCH,
  C3T,
  C3TB,
  GENERATION,
  PRIOR_G5_GENERATION,
  G6_PLANNED_OUTPUTS,
  canonical,
  closureSnapshot,
  fileRecord,
  gitText,
  readJson,
  readRegularBytes,
  verifyRecoveryChain,
  writeJsonExclusive,
} from './recovery-static-lib.mjs';

const PRODUCT = 'repositories/memoryos-readiness';
const G2_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g2';
const G2_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2';
const G3_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g3';
const G3_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g3';
const G4_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g4';
const G4_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g4';
const G5_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g5';
const G5_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g5';
const G6_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g6';
const G6_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g6';

const VALIDATION = G6_EVIDENCE + '/zero-execution-validation.json';
const PLAN = G6_EVIDENCE + '/recovery-plan.json';
const PRE_SEAL = G6_EVIDENCE + '/pre-execution-seal.json';
const OUTPUT = G6_EVIDENCE + '/administrative-acceptance-recovery.json';
const G6_TOOL_FILES = Object.freeze([
  'README.md',
  'accept.mjs',
  'binding-lib.mjs',
  'finalize.mjs',
  'preflight.mjs',
  'recovery-static-lib.mjs',
  'validate-recovery.mjs',
]);
const G6_EVIDENCE_FILES = Object.freeze([
  'administrative-acceptance-recovery.json',
  'certification-receipt.json',
  'evidence-manifest.json',
  'final-seal.json',
  'final-validation.json',
  'phase3d-handoff.json',
  'pre-execution-seal.json',
  'recovery-plan.json',
  'zero-execution-validation.json',
]);
const G6_EVIDENCE_BEFORE_ACCEPTANCE = Object.freeze([
  'pre-execution-seal.json',
  'recovery-plan.json',
  'zero-execution-validation.json',
]);
const G4_EVIDENCE_FILES = Object.freeze([
  'administrative-recovery.json',
  'candidate-specific-controls.json',
  'certification-receipt.json',
  'evidence-manifest.json',
  'final-seal.json',
  'final-validation.json',
  'fresh-control-results.json',
  'phase3d-handoff.json',
  'pre-execution-seal.json',
  'recovery-plan.json',
  'source-security-reviews.json',
  'zero-execution-validation.json',
]);
const G4_ARTIFACTS = Object.freeze({
  validation: G4_EVIDENCE + '/zero-execution-validation.json',
  plan: G4_EVIDENCE + '/recovery-plan.json',
  preExecutionSeal: G4_EVIDENCE + '/pre-execution-seal.json',
  fresh: G4_EVIDENCE + '/fresh-control-results.json',
  candidate: G4_EVIDENCE + '/candidate-specific-controls.json',
  reviews: G4_EVIDENCE + '/source-security-reviews.json',
  administrativeRecovery: G4_EVIDENCE + '/administrative-recovery.json',
  receipt: G4_EVIDENCE + '/certification-receipt.json',
  finalValidation: G4_EVIDENCE + '/final-validation.json',
  phase3DHandoff: G4_EVIDENCE + '/phase3d-handoff.json',
  manifest: G4_EVIDENCE + '/evidence-manifest.json',
  finalSeal: G4_EVIDENCE + '/final-seal.json',
});
const G5_ABSENT_ACCEPTANCE_OUTPUTS = Object.freeze([
  G5_EVIDENCE + '/administrative-acceptance-recovery.json',
  G5_EVIDENCE + '/certification-receipt.json',
  G5_EVIDENCE + '/final-validation.json',
  G5_EVIDENCE + '/phase3d-handoff.json',
  G5_EVIDENCE + '/evidence-manifest.json',
  G5_EVIDENCE + '/final-seal.json',
]);

const G2_TOOL_DIGEST = 'sha256:338da32c0b9c500bf19adaa9d7c5adb5fda8be0646ffb9319eff8a6de5c1a646';
const G2_EVIDENCE_DIGEST = 'sha256:eca2a9b239253173e76e40e13f9d4614b5039b226215760042a64677695e4416';
const G3_TOOL_DIGEST = 'sha256:cb80849ddec5df31f314f51fc397140f82452ada1e83da495caa630f5263527d';
const G3_EVIDENCE_DIGEST = 'sha256:66e59061edace9359f18d796511cc2c25791ce972a87f779f89321a9329ebe87';
const G4_TOOL_DIGEST = 'sha256:5345190df10de4554df711051b41063cc2b479de3a00e16dd4013e757f1e51aa';
const G4_EVIDENCE_DIGEST = 'sha256:285b34e2d82af75ae683d426e88f4f22d3e39d454f04d6946a65d4caea14deca';
const G5_TOOL_DIGEST = 'sha256:7e4a3f42f68bc3bf902d56adf3a9f0e496cc042f99cdfe39ded93a9e83d342b2';
const G5_EVIDENCE_DIGEST = 'sha256:0ed78607211afaba3029896b28d2c424b247ef8437e89195e4013fcc69779b3b';
const ZERO_EXECUTIONS = Object.freeze({
  helper: 0,
  worker: 0,
  product: 0,
  security: 0,
  native: 0,
  network: 0,
  certification: 0,
});

const slash = value => value.replaceAll('\\', '/');
const canonicalSlashPath = value => slash(path.resolve(value)).toLowerCase();
const fileOrder = (left, right) => left.localeCompare(right, 'en');

function absolute(relative) {
  const resolved = path.resolve(ROOT, relative);
  const prefix = path.resolve(ROOT) + path.sep;
  assert.ok(resolved.startsWith(prefix), 'Path escapes worktree: ' + relative);
  return resolved;
}

function filePin(relative) {
  const record = fileRecord(relative, false);
  return { path: record.path, byteLength: record.byteLength, sha256: record.sha256 };
}

function assertExactFlatRegularFiles(relativeRoot, expectedNames, label) {
  const directory = absolute(relativeRoot);
  assert.equal(fs.lstatSync(directory).isDirectory(), true, label + ': missing directory');
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    assert.equal(entry.isSymbolicLink(), false, label + ': symlink forbidden: ' + entry.name);
    assert.equal(entry.isFile(), true, label + ': nested/non-file entry forbidden: ' + entry.name);
  }
  assert.deepEqual(entries.map(entry => entry.name).sort(fileOrder), [...expectedNames].sort(fileOrder), label + ': exact flat inventory');
}

function assertClosure(actual, expectedPath, expectedCount, expectedDigest) {
  assert.equal(actual.path, expectedPath);
  assert.equal(actual.fileCount, expectedCount);
  assert.equal(actual.digest, expectedDigest);
  assert.equal(actual.files.length, expectedCount);
  assert.deepEqual(actual.files.map(record => record.path), [...actual.files.map(record => record.path)].sort(fileOrder));
  for (const record of actual.files) assert.deepEqual(record, fileRecord(record.path, true));
}

function assertZeroExecutions(actual, label) {
  assert.deepEqual(actual, ZERO_EXECUTIONS, label + ': zero-execution invariant');
}

function assertExactEofLf(relative) {
  const bytes = readRegularBytes(relative);
  assert.ok(bytes.length > 1, 'Artifact must not be empty: ' + relative);
  assert.equal(bytes.at(-1), 0x0a, 'Artifact must end in LF: ' + relative);
  assert.notEqual(bytes.at(-2), 0x0a, 'Artifact must have exactly one EOF LF: ' + relative);
  const text = bytes.toString('utf8');
  assert.equal(text.includes('\r'), false, 'Artifact must use LF only: ' + relative);
  assert.equal(/[ \t]+$/mu.test(text), false, 'Artifact has trailing horizontal whitespace: ' + relative);
}

function verifyCanonicalRootEquality() {
  const gitRootRaw = gitText(['rev-parse', '--show-toplevel']);
  const nodeRootRaw = path.resolve(ROOT);
  const gitRootCanonical = canonicalSlashPath(gitRootRaw);
  const nodeRootCanonical = canonicalSlashPath(nodeRootRaw);
  assert.equal(gitRootCanonical, nodeRootCanonical, 'Git and Node worktree roots differ after canonical slash normalization.');
  assert.equal(slash(gitRootRaw).toLowerCase(), gitRootCanonical);
  assert.equal(slash(nodeRootRaw).toLowerCase(), nodeRootCanonical);
  return {
    gitRootRaw,
    nodeRootRaw,
    gitRootCanonical,
    nodeRootCanonical,
    exactRawEquality: gitRootRaw === nodeRootRaw,
    canonicalEquality: true,
  };
}

function assertRepositoryState(chain) {
  const rootNormalization = verifyCanonicalRootEquality();
  assert.equal(gitText(['symbolic-ref', '--short', 'HEAD']), BRANCH);
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB, 'No G6 acceptance commit may exist.');
  assert.deepEqual(gitText(['show', '-s', '--format=%P', C3TB]).split(/\s+/u), [C3T]);
  const c3tProductionTree = gitText(['rev-parse', C3T + ':' + PRODUCT]);
  const c3tbProductionTree = gitText(['rev-parse', C3TB + ':' + PRODUCT]);
  assert.match(c3tProductionTree, /^[0-9a-f]{40}$/u);
  assert.equal(c3tbProductionTree, c3tProductionTree, 'C3T and C3TB production subtrees differ.');
  assert.equal(chain.productionTree, c3tProductionTree);
  assert.equal(chain.authoritativeBinding.production.tree, c3tProductionTree);
  assert.equal(gitText(['diff', '--name-only', C3TB, '--', PRODUCT]), '');
  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all', '--', PRODUCT]), '');
  return rootNormalization;
}

function assertPreservedChain(chain, rootNormalization) {
  assert.equal(chain.source.sourceG2.ledger.result, 'FAILED_INCOMPLETE');
  assert.equal(chain.source.sourceG2.ledger.outcome, 'PHASE3CR2_FAILED_INCOMPLETE');
  assert.equal(chain.source.sourceG2.ledger.firstFailure.stage, 'CASE_SENSITIVE_RECONCILIATION');
  assertClosure(chain.source.sourceG2.tools, G2_TOOL, 18, G2_TOOL_DIGEST);
  assertClosure(chain.source.sourceG2.evidence, G2_EVIDENCE, 1043, G2_EVIDENCE_DIGEST);

  assert.equal(chain.priorG3Failure.result, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(chain.priorG3Failure.outcome, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.deepEqual(chain.priorG3Failure.classification, ['MISSING_PROPAGATION', 'OTHER_CONCRETE_RECONCILIATION_DEFECT']);
  assert.equal(chain.priorG3Failure.failure.path, G3_TOOL + '/reconcile.mjs');
  assert.equal(chain.priorG3Failure.failure.line, 677);
  assertClosure(chain.priorG3Failure.tools, G3_TOOL, 7, G3_TOOL_DIGEST);
  assertClosure(chain.priorG3Failure.evidence, G3_EVIDENCE, 3, G3_EVIDENCE_DIGEST);

  assert.equal(chain.priorG4Failure.result, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(chain.priorG4Failure.outcome, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(chain.priorG4Failure.phase, 'STAGED_ACCEPTANCE_VERIFICATION');
  assert.equal(chain.priorG4Failure.failure.path, G4_TOOL + '/finalize.mjs');
  assert.equal(chain.priorG4Failure.failure.line, 1354);
  assert.equal(chain.priorG4Failure.acceptanceCommitCreated, false);
  assertClosure(chain.priorG4Failure.tools, G4_TOOL, 7, G4_TOOL_DIGEST);
  assertClosure(chain.priorG4Failure.evidence, G4_EVIDENCE, 12, G4_EVIDENCE_DIGEST);

  const priorG5 = chain.priorG5Failure;
  assert.deepEqual(priorG5.generation, PRIOR_G5_GENERATION);
  assert.equal(priorG5.result, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(priorG5.outcome, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(priorG5.phase, 'ACCEPTANCE_SOURCE_VERIFICATION');
  assert.deepEqual(priorG5.classification, ['OTHER_CONCRETE_RECONCILIATION_DEFECT']);
  assert.equal(priorG5.classificationLabel, 'OTHER_CONCRETE_RECONCILIATION_DEFECT/PATH_SEPARATOR_NORMALIZATION_MISMATCH');
  assert.deepEqual(priorG5.failure, {
    code: 'ERR_ASSERTION',
    path: G5_TOOL + '/accept.mjs',
    line: 312,
    assertion: "assert.equal(gitText(['rev-parse', '--show-toplevel']).toLowerCase(), path.resolve(ROOT).toLowerCase());",
  });
  assert.equal(priorG5.cause.gitRootRaw, rootNormalization.gitRootRaw);
  assert.equal(priorG5.cause.nodeRootRaw, rootNormalization.nodeRootRaw);
  assert.equal(priorG5.cause.gitCompared, rootNormalization.gitRootRaw.toLowerCase());
  assert.equal(priorG5.cause.nodeCompared, rootNormalization.nodeRootRaw.toLowerCase());
  assert.equal(priorG5.cause.exactEqual, false);
  assert.equal(priorG5.cause.correctedCanonicalRoot, rootNormalization.gitRootCanonical);
  assert.equal(priorG5.cause.correction, 'NORMALIZE_BOTH_GIT_AND_NODE_ROOT_PATHS_TO_FORWARD_SLASHES_BEFORE_EQUALITY');
  assert.deepEqual(priorG5.outputsWritten, {
    administrativeAcceptanceRecovery: false,
    certificationReceipt: false,
    finalValidation: false,
    phase3DHandoff: false,
    evidenceManifest: false,
    finalSeal: false,
  });
  assert.equal(priorG5.acceptanceCommitCreated, false);
  assertClosure(priorG5.tools, G5_TOOL, 7, G5_TOOL_DIGEST);
  assertClosure(priorG5.evidence, G5_EVIDENCE, 3, G5_EVIDENCE_DIGEST);
  assert.deepEqual(priorG5.sourceIntegrity, {
    mechanicallyReproduced: true,
    validationPlanSealExact: true,
    onlyDefect: 'PATH_SEPARATOR_NORMALIZATION_MISMATCH',
  });
  for (const relative of G5_ABSENT_ACCEPTANCE_OUTPUTS) {
    assert.equal(fs.existsSync(absolute(relative)), false, 'G5 planned acceptance output must remain absent: ' + relative);
  }
  const g5SourceLines = readRegularBytes(G5_TOOL + '/accept.mjs').toString('utf8').split(/\r?\n/u);
  assert.equal(g5SourceLines[311], "  assert.equal(gitText(['rev-parse', '--show-toplevel']).toLowerCase(), path.resolve(ROOT).toLowerCase());");
}

function loadAndAssertG4Artifacts(chain) {
  assertExactFlatRegularFiles(G4_EVIDENCE, G4_EVIDENCE_FILES, 'immutable G4 evidence namespace');
  const artifacts = Object.fromEntries(Object.entries(G4_ARTIFACTS).map(([key, relative]) => [key, readJson(relative)]));
  for (const key of ['validation', 'plan', 'preExecutionSeal', 'administrativeRecovery', 'receipt', 'finalValidation', 'phase3DHandoff', 'manifest', 'finalSeal']) {
    assert.deepEqual(artifacts[key].authoritativeBinding, chain.authoritativeBinding);
  }
  assert.equal(artifacts.administrativeRecovery.kind, 'MO1307Phase3CR2C3TBG4AdministrativeRecovery');
  assert.equal(artifacts.administrativeRecovery.result, 'PASS');
  assert.equal(artifacts.administrativeRecovery.outcome, 'RECONCILIATION_COMPLETE');
  assert.deepEqual(artifacts.administrativeRecovery.reconciliation, {
    result: 'PASS',
    freshSelectedHistoricalControls: 89,
    reusedHistoricalControls: 462,
    candidateSpecificControls: 2,
    sourceAndSecurityReviews: 12,
    omitted: 0,
    duplicates: 0,
    mismatches: 0,
    unresolved: 0,
  });
  assertZeroExecutions(artifacts.administrativeRecovery.executionCounts, 'G4 administrative recovery');
  assert.equal(artifacts.receipt.result, 'PASS');
  assert.equal(artifacts.receipt.status, 'PHASE3CR2_ACCEPTED');
  assert.equal(artifacts.receipt.controls.freshAcceptedFromG2, 89);
  assert.equal(artifacts.receipt.controls.reusedExactAcceptedFromG2, 462);
  assert.equal(artifacts.receipt.controls.candidateSpecificAcceptedFromG2, 2);
  assert.equal(artifacts.receipt.controls.sourceSecurityReviewsAcceptedFromG2, 12);
  assert.equal(artifacts.finalValidation.result, 'PASS_ACCEPTANCE_SUPPORTED');
  assert.equal(artifacts.finalValidation.outcome, 'PHASE3CR2_ACCEPTED');
  assert.equal(artifacts.phase3DHandoff.result, 'READY_NOT_EXECUTED');
  assert.equal(artifacts.phase3DHandoff.phase3DExecuted, false);
  assert.equal(artifacts.finalSeal.result, 'PASS');
  assert.equal(artifacts.finalSeal.phase3DExecuted, false);
  assert.equal(artifacts.finalSeal.push, false);
  assert.equal(artifacts.finalSeal.tag, false);
  return artifacts;
}

function assertG6SealedInputs(validation, plan, seal, g6Tools, chain) {
  assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG6ZeroExecutionValidation');
  assert.equal(validation.result, 'PASS');
  assert.deepEqual(validation.generation, GENERATION);
  assert.deepEqual(validation.authoritativeBinding, chain.authoritativeBinding);
  assert.equal(validation.productionTree, chain.productionTree);
  assert.deepEqual(validation.sourceG2, chain.source.sourceG2);
  assert.deepEqual(validation.priorG3Failure, chain.priorG3Failure);
  assert.deepEqual(validation.priorG4Failure, chain.priorG4Failure);
  assert.deepEqual(validation.priorG5Failure, chain.priorG5Failure);
  assertZeroExecutions(validation.executionCounts, 'G6 validation');
  assert.deepEqual(validation.cases.map(test => test.id), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
  assert.deepEqual(validation.cases.map(test => test.expected), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'PASS', 'FAIL', 'FAIL']);
  assert.deepEqual(validation.cases.map(test => test.actual), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'PASS', 'FAIL', 'FAIL']);
  assert.equal(validation.cases.every(test => test.result === 'PASS'), true);
  assert.deepEqual(validation.scope, {
    validationOnly: true,
    priorG2Preserved: true,
    priorG3Preserved: true,
    priorG4Preserved: true,
    priorG5Preserved: true,
    reconciliationExecuted: false,
    acceptanceExecuted: false,
    acceptanceCommitCreated: false,
    stages1Through8Rerun: false,
    helperOrWorkerLaunched: false,
    productOrSecurityControlLaunched: false,
    nativeControlLaunched: false,
    networkUsed: false,
    phase3AExecuted: false,
    phase3BExecuted: false,
    phase3DExecuted: false,
  });

  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBG6RecoveryPlan');
  assert.equal(plan.status, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assert.deepEqual(plan.generation, GENERATION);
  assert.deepEqual(plan.scope, {
    mode: 'ACCEPTANCE_ONLY',
    repairTarget: 'G5_ACCEPTANCE_SOURCE_VERIFICATION_PATH_NORMALIZATION',
    sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
    priorRecoveryGeneration: 'phase3cr2-c3tb-g5',
    preservesFailedG2: true,
    preservesFailedG3: true,
    preservesFailedG4: true,
    preservesFailedG5: true,
    consumesCompleteG4Reconciliation: true,
    rerunsStages1Through8: false,
    rerunsReconciliation: false,
    launchesControls: false,
    changesProduct: false,
    executesPhase3D: false,
  });
  assert.equal(plan.finalizedToolInputCount, 7);
  assert.deepEqual(plan.finalizedToolInputs, g6Tools.files);
  assert.equal(plan.finalizedToolSetDigest, g6Tools.digest);
  assert.deepEqual(plan.outputs, G6_PLANNED_OUTPUTS);
  assert.deepEqual(
    G6_PLANNED_OUTPUTS.map(relative => relative.slice(relative.lastIndexOf('/') + 1)).sort(fileOrder),
    [...G6_EVIDENCE_FILES].sort(fileOrder),
  );
  assert.equal(plan.executionPolicy.mode, 'ZERO_EXECUTION_ACCEPTANCE_ONLY');
  for (const field of ['preservesFailedG2', 'preservesFailedG3', 'preservesFailedG4', 'preservesFailedG5', 'consumesCompleteG4Reconciliation']) {
    assert.equal(plan.executionPolicy[field], true);
  }
  assertZeroExecutions(plan.executionPolicy.executionsBeforeSeal, 'G6 plan execution policy');

  assert.equal(seal.kind, 'MO1307Phase3CR2C3TBG6PreExecutionSeal');
  assert.equal(seal.result, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assert.deepEqual(seal.generation, GENERATION);
  assert.equal(seal.finalizedToolInputCount, 7);
  assert.deepEqual(seal.finalizedToolInputs, g6Tools.files);
  assert.equal(seal.finalizedToolSetDigest, g6Tools.digest);
  assertZeroExecutions(seal.executionCounts, 'G6 pre-execution seal');
  assert.equal(seal.appendOnly, true);

  for (const artifact of [plan, seal]) {
    assert.deepEqual(artifact.authoritativeBinding, chain.authoritativeBinding);
    assert.equal(artifact.productionTree, chain.productionTree);
    assert.deepEqual(artifact.sourceG2, chain.source.sourceG2);
    assert.deepEqual(artifact.priorG3Failure, chain.priorG3Failure);
    assert.deepEqual(artifact.priorG4Failure, chain.priorG4Failure);
    assert.deepEqual(artifact.priorG5Failure, chain.priorG5Failure);
    assert.deepEqual(artifact.executionPolicy, plan.executionPolicy);
  }
  assert.deepEqual(plan.validation, filePin(VALIDATION));
  assert.deepEqual(seal.validation, filePin(VALIDATION));
  assert.deepEqual(seal.recoveryPlan, filePin(PLAN));
}

function authorityCitations() {
  return [
    { path: G2_TOOL + '/README.md', range: '41-44', rule: 'FIRST_MANDATORY_FAILURE_TERMINATES_THE_GENERATION_WITHOUT_RETRY_OR_IN_CAMPAIGN_REPAIR' },
    { path: G2_TOOL + '/run.mjs', range: '422,477,598-612', rule: 'FAILED_G2_LEDGER_AND_STAGE_INTEGRITY_ARE_APPEND_ONLY_TERMINAL_EVIDENCE' },
    { path: G3_TOOL + '/reconcile.mjs', range: '431,677', rule: 'FAILED_G3_RECONCILIATION_IS_PRESERVED_AND_SUPERSEDED_ONLY_BY_REFERENCE' },
    { path: G4_TOOL + '/finalize.mjs', range: '1354', rule: 'FAILED_G4_STAGED_ACCEPTANCE_VERIFICATION_IS_PRESERVED_AND_SUPERSEDED_ONLY_BY_REFERENCE' },
    { path: G5_TOOL + '/accept.mjs', range: '312', rule: 'FAILED_G5_SOURCE_VERIFICATION_IS_PRESERVED_AND_CORRECTED_ONLY_IN_NEW_G6' },
    { path: 'repositories/cca-conformance/docs/certification-guide.md', range: '98-99', rule: 'RETAINED_OUTPUTS_USE_EXCLUSIVE_CREATION_AND_LATER_ASSESSMENTS_USE_NEW_VERSIONED_PATHS' },
    { path: 'repositories/cca-conformance/README.md', range: '223-225', rule: 'PUBLISHED_EVIDENCE_IS_IMMUTABLE_AND_POST_GENERATION_VALIDATION_IS_SEPARATE' },
    { path: 'repositories/cca-conformance/docs/mo1302-handoff.md', range: '67-68', rule: 'FAILED_OR_SUPERSEDED_GENERATIONS_REMAIN_PRESERVED_AND_MUST_NOT_BE_PROMOTED' },
  ];
}

function buildRecord(validation, chain, rootNormalization, g4Artifacts, g6Tools) {
  const g4Tools = closureSnapshot(G4_TOOL, true);
  const g4Evidence = closureSnapshot(G4_EVIDENCE, true);
  const g5Tools = closureSnapshot(G5_TOOL, true);
  const g5Evidence = closureSnapshot(G5_EVIDENCE, true);
  const record = {
    kind: 'MO1307Phase3CR2C3TBG6AdministrativeAcceptanceRecovery',
    version: '1.0.0',
    recoveredAt: new Date().toISOString(),
    result: 'PASS',
    outcome: 'ACCEPTANCE_RECOVERY_COMPLETE',
    generation: { ...GENERATION },
    sourceExecutionGeneration: GENERATION.sourceExecutionGeneration,
    priorRecoveryGeneration: GENERATION.priorRecoveryGeneration,
    evidenceOrigin: {
      mode: 'ACCEPTANCE_ONLY_NO_EXECUTION',
      executedInG6: { fresh: 0, reuse: 0, candidateSpecific: 0, sourceAndSecurityReviews: 0 },
      acceptedFromG4: {
        freshSelectedHistoricalControls: 89,
        reusedHistoricalControls: 462,
        candidateSpecificControls: 2,
        sourceAndSecurityReviews: 12,
        backedByExecutionGeneration: 'phase3cr2-c3tb-g2',
      },
    },
    authoritativeBinding: validation.authoritativeBinding,
    sourceG2: validation.sourceG2,
    priorG3Failure: validation.priorG3Failure,
    priorG4Failure: validation.priorG4Failure,
    priorG5Failure: validation.priorG5Failure,
    administrativeAuthority: {
      mode: 'NEW_GENERATION_ACCEPTANCE_ONLY',
      authorityScope: 'ACCEPT_IMMUTABLE_G4_RECONCILIATION_AFTER_CORRECTED_G5_SOURCE_VERIFICATION',
      appendOnly: true,
      resumesPriorAttempt: false,
      citations: authorityCitations(),
      priorG2FailurePreserved: true,
      priorG2FailureRewrittenAsPass: false,
      priorG3FailurePreserved: true,
      priorG3FailureRewrittenAsPass: false,
      priorG4FailurePreserved: true,
      priorG4FailureRewrittenAsPass: false,
      priorG5FailurePreserved: true,
      priorG5FailureRewrittenAsPass: false,
      g4ReconciliationArtifactsPreserved: true,
      g4BytesModified: false,
      g5BytesModified: false,
    },
    rootCause: {
      phase: chain.priorG5Failure.phase,
      classification: chain.priorG5Failure.classification,
      classificationLabel: chain.priorG5Failure.classificationLabel,
      failure: chain.priorG5Failure.failure,
      cause: chain.priorG5Failure.cause,
      absentPlannedOutputs: [...G5_ABSENT_ACCEPTANCE_OUTPUTS],
      acceptanceCommitCreatedInG5: false,
      correction: 'NEW_G6_APPEND_ONLY_ACCEPTANCE_GENERATION_WITH_SYMMETRIC_CANONICAL_SLASH_NORMALIZATION',
      rootNormalization,
    },
    executionCounts: { ...ZERO_EXECUTIONS },
    campaignRerun: false,
    stages1Through8Rerun: false,
    stages2Through8Rerun: false,
    productChanges: false,
    reconciliation: {
      result: 'PASS',
      freshSelectedHistoricalControls: 89,
      reusedHistoricalControls: 462,
      candidateSpecificControls: 2,
      sourceAndSecurityReviews: 12,
      omitted: 0,
      duplicates: 0,
      mismatches: 0,
      unresolved: 0,
    },
    acceptance: {
      result: 'PASS',
      g4ReconciliationAccepted: true,
      g4ToolFiles: 7,
      g4EvidenceFiles: 12,
      g4AcceptanceCommitCreated: false,
      g5AcceptanceOutputsWritten: 0,
      g5AcceptanceCommitCreated: false,
      g5AbsentPlannedOutputs: [...G5_ABSENT_ACCEPTANCE_OUTPUTS],
      containingCommitRequired: true,
      requiredSingleParent: C3TB,
      productTree: chain.productionTree,
    },
    inputs: {
      validation: filePin(VALIDATION),
      recoveryPlan: filePin(PLAN),
      preExecutionSeal: filePin(PRE_SEAL),
      g4: Object.fromEntries(Object.entries(G4_ARTIFACTS).map(([key, relative]) => [key, filePin(relative)])),
      g4Tools,
      g4Evidence,
      g5Tools,
      g5Evidence,
      g6Tools,
    },
    outputs: {
      administrativeAcceptanceRecovery: OUTPUT,
    },
    phase3DExecuted: false,
    push: false,
    tag: false,
  };

  assert.deepEqual(record.generation, GENERATION);
  assert.deepEqual(record.authoritativeBinding, chain.authoritativeBinding);
  assert.deepEqual(record.sourceG2, chain.source.sourceG2);
  assert.deepEqual(record.priorG3Failure, chain.priorG3Failure);
  assert.deepEqual(record.priorG4Failure, chain.priorG4Failure);
  assert.deepEqual(record.priorG5Failure, chain.priorG5Failure);
  assertZeroExecutions(record.executionCounts, 'G6 administrative acceptance recovery');
  assert.equal(record.reconciliation.freshSelectedHistoricalControls, 89);
  assert.equal(record.reconciliation.reusedHistoricalControls, 462);
  assert.equal(record.reconciliation.candidateSpecificControls, 2);
  assert.equal(record.reconciliation.sourceAndSecurityReviews, 12);
  for (const field of ['omitted', 'duplicates', 'mismatches', 'unresolved']) assert.equal(record.reconciliation[field], 0);
  assert.equal(record.campaignRerun, false);
  assert.equal(record.stages1Through8Rerun, false);
  assert.equal(record.productChanges, false);
  assert.equal(record.phase3DExecuted, false);
  assert.equal(record.push, false);
  assert.equal(record.tag, false);
  assert.equal(g4Artifacts.administrativeRecovery.reconciliation.freshSelectedHistoricalControls, record.reconciliation.freshSelectedHistoricalControls);
  return record;
}

function verifySourceOnly(chain, rootNormalization) {
  assert.equal(fs.existsSync(absolute(G6_EVIDENCE)), false, 'G6 evidence namespace must not exist during source-only verification.');
  assertExactFlatRegularFiles(G6_TOOL, G6_TOOL_FILES, 'finalized G6 source-only tool namespace');
  const g6Tools = closureSnapshot(G6_TOOL, true);
  assert.equal(g6Tools.fileCount, 7);
  assertPreservedChain(chain, rootNormalization);
  loadAndAssertG4Artifacts(chain);
  assert.deepEqual(closureSnapshot(G5_TOOL, true), chain.priorG5Failure.tools);
  assert.deepEqual(closureSnapshot(G5_EVIDENCE, true), chain.priorG5Failure.evidence);
  process.stdout.write(canonical({
    result: 'PASS_SOURCE_VERIFICATION',
    outcome: 'PHASE3CR2_G6_ACCEPTANCE_SOURCE_VERIFIED',
    generation: GENERATION,
    pathNormalization: rootNormalization,
    g6Tools: { fileCount: g6Tools.fileCount, digest: g6Tools.digest },
    priorG5Failure: {
      result: chain.priorG5Failure.result,
      phase: chain.priorG5Failure.phase,
      classificationLabel: chain.priorG5Failure.classificationLabel,
    },
    evidenceWritten: false,
    executionCounts: ZERO_EXECUTIONS,
  }) + '\n');
}

function main() {
  const [operation, ...extra] = process.argv.slice(2);
  assert.equal(extra.length, 0, 'Expected exactly --verify-source-only, --verify-only, or --write.');
  assert.ok(
    operation === '--verify-source-only' || operation === '--verify-only' || operation === '--write',
    'Expected exactly --verify-source-only, --verify-only, or --write.',
  );

  const chain = verifyRecoveryChain();
  const rootNormalization = assertRepositoryState(chain);
  assertPreservedChain(chain, rootNormalization);
  if (operation === '--verify-source-only') {
    verifySourceOnly(chain, rootNormalization);
    return;
  }

  assertExactFlatRegularFiles(G6_TOOL, G6_TOOL_FILES, 'sealed G6 tool namespace');
  assertExactFlatRegularFiles(G6_EVIDENCE, G6_EVIDENCE_BEFORE_ACCEPTANCE, 'sealed G6 evidence namespace before acceptance');
  assert.equal(fs.existsSync(absolute(OUTPUT)), false, 'G6 administrative acceptance recovery must not already exist.');
  const g6Tools = closureSnapshot(G6_TOOL, true);
  assert.equal(g6Tools.fileCount, 7);
  const g4Artifacts = loadAndAssertG4Artifacts(chain);
  const validation = readJson(VALIDATION);
  const plan = readJson(PLAN);
  const seal = readJson(PRE_SEAL);
  assertG6SealedInputs(validation, plan, seal, g6Tools, chain);
  const record = buildRecord(validation, chain, rootNormalization, g4Artifacts, g6Tools);

  assert.deepEqual(closureSnapshot(G4_TOOL, true), chain.priorG4Failure.tools, 'G4 tools changed during G6 acceptance verification.');
  assert.deepEqual(closureSnapshot(G4_EVIDENCE, true), chain.priorG4Failure.evidence, 'G4 evidence changed during G6 acceptance verification.');
  assert.deepEqual(closureSnapshot(G5_TOOL, true), chain.priorG5Failure.tools, 'G5 tools changed during G6 acceptance verification.');
  assert.deepEqual(closureSnapshot(G5_EVIDENCE, true), chain.priorG5Failure.evidence, 'G5 evidence changed during G6 acceptance verification.');
  assert.deepEqual(closureSnapshot(G6_TOOL, true), g6Tools, 'G6 tools changed during G6 acceptance verification.');
  assertRepositoryState(chain);

  if (operation === '--write') {
    writeJsonExclusive(OUTPUT, record);
    assertExactEofLf(OUTPUT);
    assertExactFlatRegularFiles(
      G6_EVIDENCE,
      [...G6_EVIDENCE_BEFORE_ACCEPTANCE, 'administrative-acceptance-recovery.json'],
      'G6 evidence namespace after acceptance',
    );
    assert.deepEqual(readJson(OUTPUT), record);
    process.stdout.write(canonical({
      result: 'PASS_ACCEPTANCE_RECOVERY_WRITTEN',
      outcome: 'PHASE3CR2_ACCEPTANCE_RECOVERED_PENDING_FINALIZATION',
      output: filePin(OUTPUT),
      executionCounts: ZERO_EXECUTIONS,
    }) + '\n');
  } else {
    assertExactFlatRegularFiles(G6_EVIDENCE, G6_EVIDENCE_BEFORE_ACCEPTANCE, 'G6 verify-only evidence namespace');
    process.stdout.write(canonical({
      result: 'PASS_ACCEPTANCE_VERIFIED',
      outcome: 'PHASE3CR2_ACCEPTANCE_RECOVERY_READY',
      wouldWrite: OUTPUT,
      executionCounts: ZERO_EXECUTIONS,
    }) + '\n');
  }
}

try {
  main();
} catch (error) {
  const failure = {
    name: error && error.name ? error.name : 'Error',
    code: error && error.code ? error.code : null,
    message: error && error.message ? error.message : String(error),
  };
  process.stderr.write(canonical({
    result: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    failure,
    outputWritten: fs.existsSync(absolute(OUTPUT)),
  }) + '\n');
  process.exitCode = 1;
}
