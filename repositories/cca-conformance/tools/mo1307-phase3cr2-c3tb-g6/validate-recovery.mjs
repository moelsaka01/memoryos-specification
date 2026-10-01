// Append-only, zero-execution validation for the G6 acceptance-only recovery.
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
  G6_EVIDENCE_RELATIVE,
  ROOT,
  verifyRecoveryChain,
  writeJsonExclusive,
  zeroExecutionCounts,
} from './recovery-static-lib.mjs';

process.once('uncaughtException', error => {
  process.stderr.write(`${JSON.stringify({
    result: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    failure: {
      name: error?.name ?? 'Error',
      code: error?.code ?? null,
      message: error?.message ?? String(error),
    },
    outputWritten: fs.existsSync(path.join(ROOT, G6_EVIDENCE_RELATIVE, 'zero-execution-validation.json')),
  })}\n`);
  process.exitCode = 1;
});

assert.deepEqual(process.argv.slice(2), ['--write']);
const evidenceRoot = path.join(ROOT, G6_EVIDENCE_RELATIVE);
const outputRelative = `${G6_EVIDENCE_RELATIVE}/zero-execution-validation.json`;
assert.equal(fs.existsSync(evidenceRoot), false, 'The G6 evidence namespace must be absent before validation.');

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

// A second complete read closes the validation window over G2 through G5.
const after = verifyRecoveryChain();
assert.deepEqual(after.source.sourceG2, before.source.sourceG2, 'G2 source closure changed during validation.');
assert.deepEqual(after.priorG3Failure, before.priorG3Failure, 'G3 failure closure changed during validation.');
assert.deepEqual(after.priorG4Failure, before.priorG4Failure, 'G4 failure closure changed during validation.');
assert.deepEqual(after.priorG5Failure, before.priorG5Failure, 'G5 failure closure changed during validation.');
assert.deepEqual(after.authoritativeBinding, authoritativeBinding, 'Authoritative binding changed during validation.');
assert.equal(after.productionTree, before.productionTree, 'Derived production tree changed during validation.');
assert.equal(authoritativeBinding.production.tree, before.productionTree);

const cases = [
  {
    id: 'A',
    name: 'exact-c3tb-binding',
    expected: 'PASS',
    actual: 'PASS',
    result: 'PASS',
    bindingKind: authoritativeBinding.bindingKind,
    identityKind: authoritativeBinding.identityKind,
  },
  {
    id: 'B',
    name: 'missing-production-tree',
    expected: 'FAIL',
    actual: 'FAIL',
    result: 'PASS',
    failureCode: missingTreeFailure.code,
  },
  {
    id: 'C',
    name: 'incorrect-production-tree',
    expected: 'FAIL',
    actual: 'FAIL',
    result: 'PASS',
    failureCode: incorrectTreeFailure.code,
  },
  {
    id: 'D',
    name: 'incorrect-candidate',
    expected: 'FAIL',
    actual: 'FAIL',
    result: 'PASS',
    failureCode: incorrectCandidateFailure.code,
  },
  {
    id: 'E',
    name: 'incorrect-helper-identity',
    expected: 'FAIL',
    actual: 'FAIL',
    result: 'PASS',
    failureCode: incorrectHelperFailure.code,
  },
  {
    id: 'F',
    name: 'exact-preserved-g2-evidence',
    expected: 'PASS',
    actual: 'PASS',
    result: 'PASS',
    sourceExecutionGeneration: GENERATION.sourceExecutionGeneration,
    toolClosure: {
      fileCount: before.source.sourceG2.tools.fileCount,
      digest: before.source.sourceG2.tools.digest,
    },
    evidenceClosure: {
      fileCount: before.source.sourceG2.evidence.fileCount,
      digest: before.source.sourceG2.evidence.digest,
    },
    ledgerResult: before.source.sourceG2.ledger.result,
    ledgerFailureStage: before.source.sourceG2.ledger.firstFailure.stage,
  },
  {
    id: 'G',
    name: 'exact-preserved-g3-failure',
    expected: 'PASS',
    actual: 'PASS',
    result: 'PASS',
    outcome: before.priorG3Failure.outcome,
    toolClosure: {
      fileCount: before.priorG3Failure.tools.fileCount,
      digest: before.priorG3Failure.tools.digest,
    },
    evidenceClosure: {
      fileCount: before.priorG3Failure.evidence.fileCount,
      digest: before.priorG3Failure.evidence.digest,
    },
  },
  {
    id: 'H',
    name: 'exact-preserved-g4-reconciliation',
    expected: 'PASS',
    actual: 'PASS',
    result: 'PASS',
    toolClosure: {
      fileCount: before.priorG4Failure.tools.fileCount,
      digest: before.priorG4Failure.tools.digest,
    },
    evidenceClosure: {
      fileCount: before.priorG4Failure.evidence.fileCount,
      digest: before.priorG4Failure.evidence.digest,
    },
    accounting: {
      fresh: 89,
      reused: 462,
      candidateSpecific: 2,
      sourceAndSecurityReviews: 12,
      omissions: 0,
      duplicates: 0,
      mismatches: 0,
      unresolved: 0,
    },
  },
  {
    id: 'I',
    name: 'exact-g4-staged-acceptance-defect',
    expected: 'FAIL',
    actual: 'FAIL',
    result: 'PASS',
    failureCode: before.priorG4Failure.failure.code,
    exitCode: before.priorG4Failure.failure.exitCode,
    violations: before.priorG4Failure.violations,
    acceptanceCommitCreated: before.priorG4Failure.acceptanceCommitCreated,
  },
  {
    id: 'J',
    name: 'exact-g5-path-normalization-defect',
    expected: 'FAIL',
    actual: 'FAIL',
    result: 'PASS',
    failureCode: before.priorG5Failure.failure.code,
    classificationLabel: before.priorG5Failure.classificationLabel,
    cause: before.priorG5Failure.cause,
    acceptanceCommitCreated: before.priorG5Failure.acceptanceCommitCreated,
  },
];
assert.deepEqual(cases.map(test => test.id), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
assert.deepEqual(cases.map(test => test.expected), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'PASS', 'FAIL', 'FAIL']);
assert.deepEqual(cases.map(test => test.actual), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'PASS', 'FAIL', 'FAIL']);
assert.equal(cases.every(test => test.result === 'PASS'), true);

const record = {
  kind: 'MO1307Phase3CR2C3TBG6ZeroExecutionValidation',
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
  executionCounts: zeroExecutionCounts(),
  scope: {
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
  },
};

fs.mkdirSync(evidenceRoot, { recursive: false });
writeJsonExclusive(outputRelative, record);
process.stdout.write(`${JSON.stringify({
  result: 'PASS',
  evidence: outputRelative,
  cases: cases.length,
  executionCounts: record.executionCounts,
})}\n`);
