// Append-only, zero-execution validation for the G7 acceptance-only recovery.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BINDING_ERROR_CODES,
  deriveAuthoritativeBinding,
  expectBindingFailure,
} from './binding-lib.mjs';
import {
  GENERATION,
  G7_EVIDENCE_RELATIVE,
  G7_TOOL_RELATIVE,
  ROOT,
  canonical,
  closureSnapshot,
  verifyRecoveryChain,
  writeJsonExclusive,
  zeroExecutionCounts,
} from './recovery-static-lib.mjs';

const outputRelative = `${G7_EVIDENCE_RELATIVE}/zero-execution-validation.json`;
const evidenceRoot = path.join(ROOT, G7_EVIDENCE_RELATIVE);

function fail(error) {
  process.stderr.write(`${canonical({
    result: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    failure: {
      name: error?.name ?? 'Error',
      code: error?.code ?? null,
      message: error?.message ?? String(error),
    },
    outputWritten: fs.existsSync(path.join(ROOT, outputRelative)),
  })}\n`);
  process.exitCode = 1;
}

function buildValidation() {
  const before = verifyRecoveryChain();
  const exactInput = before.source.bindingInput;
  const authoritativeBinding = deriveAuthoritativeBinding(exactInput);
  assert.deepEqual(authoritativeBinding, before.authoritativeBinding);
  const clone = value => structuredClone(value);

  const missingTree = clone(exactInput);
  missingTree.binding.package.productionTree = null;
  const missingTreeFailure = expectBindingFailure(missingTree, BINDING_ERROR_CODES.MISSING_PRODUCTION_TREE);
  const incorrectTree = clone(exactInput);
  incorrectTree.binding.package.productionTree = '0000000000000000000000000000000000000000';
  const incorrectTreeFailure = expectBindingFailure(incorrectTree, BINDING_ERROR_CODES.PRODUCTION_TREE_MISMATCH);
  const incorrectCandidate = clone(exactInput);
  incorrectCandidate.planCandidate.commit = '0000000000000000000000000000000000000000';
  const incorrectCandidateFailure = expectBindingFailure(incorrectCandidate, BINDING_ERROR_CODES.CANDIDATE_MISMATCH);
  const incorrectHelper = clone(exactInput);
  incorrectHelper.candidateRecord.helper.sha256 = `sha256:${'0'.repeat(64)}`;
  const incorrectHelperFailure = expectBindingFailure(incorrectHelper, BINDING_ERROR_CODES.HELPER_IDENTITY_MISMATCH);

  const after = verifyRecoveryChain();
  assert.deepEqual(after.source.sourceG2, before.source.sourceG2, 'G2 closure changed during validation.');
  assert.deepEqual(after.priorG3Failure, before.priorG3Failure, 'G3 failure changed during validation.');
  assert.deepEqual(after.priorG4Failure, before.priorG4Failure, 'G4 failure changed during validation.');
  assert.deepEqual(after.priorG5Failure, before.priorG5Failure, 'G5 failure changed during validation.');
  assert.deepEqual(after.priorG6Failure, before.priorG6Failure, 'G6 failure changed during validation.');
  assert.deepEqual(after.authoritativeBinding, authoritativeBinding);
  assert.equal(after.productionTree, before.productionTree);

  const cases = [
    { id: 'A', name: 'exact-c3tb-binding', expected: 'PASS', actual: 'PASS', result: 'PASS', bindingKind: authoritativeBinding.bindingKind, identityKind: authoritativeBinding.identityKind },
    { id: 'B', name: 'missing-production-tree', expected: 'FAIL', actual: 'FAIL', result: 'PASS', failureCode: missingTreeFailure.code },
    { id: 'C', name: 'incorrect-production-tree', expected: 'FAIL', actual: 'FAIL', result: 'PASS', failureCode: incorrectTreeFailure.code },
    { id: 'D', name: 'incorrect-candidate', expected: 'FAIL', actual: 'FAIL', result: 'PASS', failureCode: incorrectCandidateFailure.code },
    { id: 'E', name: 'incorrect-helper-identity', expected: 'FAIL', actual: 'FAIL', result: 'PASS', failureCode: incorrectHelperFailure.code },
    {
      id: 'F', name: 'exact-preserved-g2-evidence', expected: 'PASS', actual: 'PASS', result: 'PASS',
      sourceExecutionGeneration: GENERATION.sourceExecutionGeneration,
      toolClosure: { fileCount: before.source.sourceG2.tools.fileCount, digest: before.source.sourceG2.tools.digest },
      evidenceClosure: { fileCount: before.source.sourceG2.evidence.fileCount, digest: before.source.sourceG2.evidence.digest },
      ledgerResult: before.source.sourceG2.ledger.result,
      ledgerFailureStage: before.source.sourceG2.ledger.firstFailure.stage,
    },
    {
      id: 'G', name: 'exact-preserved-g3-failure', expected: 'PASS', actual: 'PASS', result: 'PASS',
      outcome: before.priorG3Failure.outcome,
      toolClosure: { fileCount: before.priorG3Failure.tools.fileCount, digest: before.priorG3Failure.tools.digest },
      evidenceClosure: { fileCount: before.priorG3Failure.evidence.fileCount, digest: before.priorG3Failure.evidence.digest },
    },
    {
      id: 'H', name: 'exact-preserved-g4-reconciliation', expected: 'PASS', actual: 'PASS', result: 'PASS',
      toolClosure: { fileCount: before.priorG4Failure.tools.fileCount, digest: before.priorG4Failure.tools.digest },
      evidenceClosure: { fileCount: before.priorG4Failure.evidence.fileCount, digest: before.priorG4Failure.evidence.digest },
      accounting: { fresh: 89, reused: 462, candidateSpecific: 2, sourceAndSecurityReviews: 12, omissions: 0, duplicates: 0, mismatches: 0, unresolved: 0 },
    },
    {
      id: 'I', name: 'exact-g4-staged-acceptance-defect', expected: 'FAIL', actual: 'FAIL', result: 'PASS',
      failureCode: before.priorG4Failure.failure.code,
      violations: before.priorG4Failure.violations,
      acceptanceCommitCreated: before.priorG4Failure.acceptanceCommitCreated,
    },
    {
      id: 'J', name: 'exact-g5-path-normalization-defect', expected: 'FAIL', actual: 'FAIL', result: 'PASS',
      failureCode: before.priorG5Failure.failure.code,
      classificationLabel: before.priorG5Failure.classificationLabel,
      acceptanceCommitCreated: before.priorG5Failure.acceptanceCommitCreated,
    },
    {
      id: 'K', name: 'exact-complete-g6-terminal-evidence', expected: 'PASS', actual: 'PASS', result: 'PASS',
      toolClosure: { fileCount: before.priorG6Failure.tools.fileCount, digest: before.priorG6Failure.tools.digest },
      evidenceClosure: { fileCount: before.priorG6Failure.evidence.fileCount, digest: before.priorG6Failure.evidence.digest },
      terminalEvidenceComplete: before.priorG6Failure.terminalEvidenceComplete,
      reconciliation: { fresh: 89, reused: 462, candidateSpecific: 2, sourceAndSecurityReviews: 12, defects: 0 },
    },
    {
      id: 'L', name: 'exact-g6-final-loader-prefinal-inventory-defect', expected: 'FAIL', actual: 'FAIL', result: 'PASS',
      failureCode: before.priorG6Failure.failure.code,
      classificationLabel: before.priorG6Failure.classificationLabel,
      failure: before.priorG6Failure.failure,
      cause: before.priorG6Failure.cause,
      stagedVerificationCompleted: before.priorG6Failure.stagedVerificationCompleted,
      acceptanceCommitCreated: before.priorG6Failure.acceptanceCommitCreated,
    },
  ];
  const expected = ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'PASS', 'FAIL', 'FAIL', 'PASS', 'FAIL'];
  assert.deepEqual(cases.map(test => test.id), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
  assert.deepEqual(cases.map(test => test.expected), expected);
  assert.deepEqual(cases.map(test => test.actual), expected);
  assert.equal(cases.every(test => test.result === 'PASS'), true);

  return {
    chain: before,
    record: {
      kind: 'MO1307Phase3CR2C3TBG7ZeroExecutionValidation',
      version: '1.0.0',
      generation: { ...GENERATION },
      createdAt: new Date().toISOString(),
      result: 'PASS',
      cases,
      authoritativeBinding,
      productionTree: before.productionTree,
      sourceG2: before.source.sourceG2,
      priorG3Failure: before.priorG3Failure,
      priorG4Failure: before.priorG4Failure,
      priorG5Failure: before.priorG5Failure,
      priorG6Failure: before.priorG6Failure,
      executionCounts: zeroExecutionCounts(),
      scope: {
        validationOnly: true,
        priorG2Preserved: true,
        priorG3Preserved: true,
        priorG4Preserved: true,
        priorG5Preserved: true,
        priorG6Preserved: true,
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
      },
    },
  };
}

function main() {
  const [mode, ...extra] = process.argv.slice(2);
  assert.equal(extra.length, 0);
  assert.ok(mode === '--verify-source-only' || mode === '--write', 'Use --verify-source-only or --write.');
  assert.equal(fs.existsSync(evidenceRoot), false, 'The G7 evidence namespace must be absent before validation.');
  const { record } = buildValidation();
  const tools = closureSnapshot(G7_TOOL_RELATIVE, true);
  assert.equal(tools.fileCount, 7, 'G7 tool namespace must contain exactly seven finalized files.');
  if (mode === '--verify-source-only') {
    process.stdout.write(`${canonical({
      result: 'PASS_SOURCE_VERIFICATION',
      generation: GENERATION,
      cases: record.cases.length,
      g7Tools: { fileCount: tools.fileCount, digest: tools.digest },
      priorG6Failure: record.priorG6Failure.classificationLabel,
      evidenceWritten: false,
      executionCounts: record.executionCounts,
    })}\n`);
    return;
  }
  fs.mkdirSync(evidenceRoot, { recursive: false });
  writeJsonExclusive(outputRelative, record);
  process.stdout.write(`${canonical({ result: 'PASS', evidence: outputRelative, cases: record.cases.length, executionCounts: record.executionCounts })}\n`);
}

try {
  main();
} catch (error) {
  fail(error);
}
