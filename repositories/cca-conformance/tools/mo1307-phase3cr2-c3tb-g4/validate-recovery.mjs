// Append-only, zero-execution validation for the G4 reconciliation-only repair.
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
  G4_EVIDENCE_RELATIVE,
  ROOT,
  assertStaticRuntimeAndRepository,
  verifyPriorG3,
  verifySourceG2,
  writeJsonExclusive,
  zeroExecutionCounts,
} from './recovery-static-lib.mjs';

assert.deepEqual(process.argv.slice(2), ['--write']);
const runtime = assertStaticRuntimeAndRepository();
const evidenceRoot = path.join(ROOT, G4_EVIDENCE_RELATIVE);
const outputRelative = `${G4_EVIDENCE_RELATIVE}/zero-execution-validation.json`;
assert.equal(fs.existsSync(evidenceRoot), false, 'The G4 evidence namespace must be absent before validation.');

const before = verifySourceG2();
const priorG3Failure = verifyPriorG3(before);
const exactInput = before.bindingInput;
const authoritativeBinding = deriveAuthoritativeBinding(exactInput);
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

// A second complete read closes the validation window over both immutable sources.
const after = verifySourceG2();
const afterPriorG3Failure = verifyPriorG3(after);
assert.deepEqual(after.sourceG2, before.sourceG2, 'G2 source closure changed during zero-execution validation.');
assert.deepEqual(after.authoritativeBinding, authoritativeBinding, 'Authoritative binding changed during zero-execution validation.');
assert.deepEqual(afterPriorG3Failure, priorG3Failure, 'G3 failure closure changed during zero-execution validation.');

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
    toolClosure: { fileCount: before.sourceG2.tools.fileCount, digest: before.sourceG2.tools.digest },
    evidenceClosure: { fileCount: before.sourceG2.evidence.fileCount, digest: before.sourceG2.evidence.digest },
    ledgerResult: before.sourceG2.ledger.result,
    ledgerFailureStage: before.sourceG2.ledger.firstFailure.stage,
  },
];
assert.deepEqual(cases.map(test => test.id), ['A', 'B', 'C', 'D', 'E', 'F']);
assert.equal(cases.every(test => test.result === 'PASS'), true);

const record = {
  kind: 'MO1307Phase3CR2C3TBG4ZeroExecutionValidation',
  version: '1.0.0',
  generation: { ...GENERATION },
  createdAt: new Date().toISOString(),
  result: 'PASS',
  cases,
  authoritativeBinding,
  sourceG2: before.sourceG2,
  priorG3Failure,
  executionCounts: zeroExecutionCounts(),
  scope: {
    validationOnly: true,
    priorG3Preserved: true,
    reconciliationExecuted: false,
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
process.stdout.write(`${JSON.stringify({ result: 'PASS', evidence: outputRelative, cases: 6, executionCounts: record.executionCounts })}\n`);
