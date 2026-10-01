// Append-only G4 preflight/seal. Performs static Git/hash/evidence checks only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  GENERATION,
  G4_EVIDENCE_RELATIVE,
  G4_TOOL_RELATIVE,
  ROOT,
  assertStaticRuntimeAndRepository,
  closureSnapshot,
  fileRecord,
  readJson,
  verifyPriorG3,
  verifySourceG2,
  writeJsonExclusive,
  zeroExecutionCounts,
} from './recovery-static-lib.mjs';

const validationRelative = `${G4_EVIDENCE_RELATIVE}/zero-execution-validation.json`;
const planRelative = `${G4_EVIDENCE_RELATIVE}/recovery-plan.json`;
const sealRelative = `${G4_EVIDENCE_RELATIVE}/pre-execution-seal.json`;
const requiredTools = [
  'README.md',
  'binding-lib.mjs',
  'finalize.mjs',
  'preflight.mjs',
  'reconcile.mjs',
  'recovery-static-lib.mjs',
  'validate-recovery.mjs',
];
const outputPaths = [
  validationRelative,
  planRelative,
  sealRelative,
  `${G4_EVIDENCE_RELATIVE}/fresh-control-results.json`,
  `${G4_EVIDENCE_RELATIVE}/candidate-specific-controls.json`,
  `${G4_EVIDENCE_RELATIVE}/source-security-reviews.json`,
  `${G4_EVIDENCE_RELATIVE}/administrative-recovery.json`,
  `${G4_EVIDENCE_RELATIVE}/certification-receipt.json`,
  `${G4_EVIDENCE_RELATIVE}/final-validation.json`,
  `${G4_EVIDENCE_RELATIVE}/phase3d-handoff.json`,
  `${G4_EVIDENCE_RELATIVE}/evidence-manifest.json`,
  `${G4_EVIDENCE_RELATIVE}/final-seal.json`,
];

assert.deepEqual(process.argv.slice(2), ['--write']);
const runtime = assertStaticRuntimeAndRepository();
const evidenceRoot = path.join(ROOT, G4_EVIDENCE_RELATIVE);
const evidenceStat = fs.lstatSync(evidenceRoot);
assert.equal(evidenceStat.isSymbolicLink(), false, 'G4 evidence namespace is a symlink.');
assert.equal(evidenceStat.isDirectory(), true, 'G4 evidence namespace is not a directory.');
const initialEntries = fs.readdirSync(evidenceRoot, { withFileTypes: true });
assert.deepEqual(initialEntries.map(entry => entry.name).sort(), [path.basename(validationRelative)]);
assert.equal(initialEntries[0].isSymbolicLink(), false);
assert.equal(initialEntries[0].isFile(), true);

const validation = readJson(validationRelative);
assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG4ZeroExecutionValidation');
assert.equal(validation.version, '1.0.0');
assert.equal(validation.result, 'PASS');
assert.deepEqual(validation.generation, GENERATION);
assert.deepEqual(validation.executionCounts, zeroExecutionCounts());
assert.deepEqual(validation.cases.map(test => test.id), ['A', 'B', 'C', 'D', 'E', 'F']);
assert.deepEqual(validation.cases.map(test => test.expected), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS']);
assert.deepEqual(validation.cases.map(test => test.actual), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS']);
assert.equal(validation.cases.every(test => test.result === 'PASS'), true);
assert.deepEqual(validation.cases.slice(1, 5).map(test => test.failureCode), [
  'MISSING_PRODUCTION_TREE',
  'PRODUCTION_TREE_MISMATCH',
  'CANDIDATE_MISMATCH',
  'HELPER_IDENTITY_MISMATCH',
]);
assert.equal(validation.scope.validationOnly, true);
assert.equal(validation.scope.priorG3Preserved, true);
assert.equal(validation.scope.reconciliationExecuted, false);
assert.equal(validation.scope.stages1Through8Rerun, false);

const source = verifySourceG2();
const priorG3Failure = verifyPriorG3(source);
assert.deepEqual(source.sourceG2, validation.sourceG2, 'G2 source differs from the zero-execution validation snapshot.');
assert.deepEqual(source.authoritativeBinding, validation.authoritativeBinding, 'Candidate binding differs from validated binding.');
assert.deepEqual(priorG3Failure, validation.priorG3Failure, 'G3 failure differs from the zero-execution validation snapshot.');
const validationRecord = fileRecord(validationRelative);

const toolClosure = closureSnapshot(G4_TOOL_RELATIVE, true);
const toolNames = toolClosure.files.map(record => path.basename(record.path));
assert.equal(toolClosure.fileCount, requiredTools.length, 'G4 tool closure must contain exactly seven files.');
for (const required of requiredTools) assert.equal(toolNames.includes(required), true, `Missing required G4 tool: ${required}`);
assert.equal(new Set(toolClosure.files.map(record => record.path)).size, toolClosure.fileCount);

const executionPolicy = {
  reconciliationOnly: true,
  sourceExecutionGeneration: GENERATION.sourceExecutionGeneration,
  priorRecoveryGeneration: GENERATION.priorRecoveryGeneration,
  consumesImmutableRawWitnesses: true,
  preservesFailedG3: true,
  rerunStages1Through8: false,
  permittedOperations: ['READ_IMMUTABLE_G2', 'READ_IMMUTABLE_G3', 'STATIC_GIT_AND_HASH_VERIFICATION', 'RECONCILE_EXISTING_WITNESSES', 'WRITE_G4_EVIDENCE'],
  prohibitedOperations: ['PRODUCT_EXECUTION', 'HELPER_EXECUTION', 'WORKER_EXECUTION', 'SECURITY_CONTROL_EXECUTION', 'NATIVE_CONTROL_EXECUTION', 'NETWORK', 'PHASE3A', 'PHASE3B', 'PHASE3D', 'PUSH', 'TAG'],
  executionsBeforeSeal: zeroExecutionCounts(),
};

const plan = {
  kind: 'MO1307Phase3CR2C3TBG4RecoveryPlan',
  version: '1.0.0',
  status: 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED',
  createdAt: new Date().toISOString(),
  generation: { ...GENERATION },
  scope: {
    classification: 'RECONCILIATION_HELPER_GIT_BLOB_PROPAGATION_CORRECTION',
    priorFailurePreserved: true,
    priorFailureRewrittenAsPass: false,
    priorRecoveryFailurePreserved: true,
    priorRecoveryFailureRewrittenAsPass: false,
    resumesPriorAttempt: false,
    newExecutionCampaign: false,
    reconciliationOnly: true,
  },
  rootCause: {
    classification: ['MISSING_PROPAGATION', 'OTHER_CONCRETE_RECONCILIATION_DEFECT'],
    classificationLabel: 'MISSING_PROPAGATION/OTHER_CONCRETE_RECONCILIATION_DEFECT',
    failedAssertionSource: 'zeroExecutionValidation.authoritativeBinding',
    failedAssertionLine: 677,
    missingField: 'git.helperCheckout.gitBlob',
    sealedAuthoritySource: 'authoritativeBinding.helperAuthorities.gitBlobs',
    correctedSourceRule: 'CHECKOUT_HELPER_MUST_USE_GIT_PIN_WITH_GIT_BLOB_BEFORE_EXACT_BINDING_COMPARISON',
    manualFallbackAllowed: false,
    hardCodedProductionTreeFallbackAllowed: false,
  },
  authoritativeBinding: source.authoritativeBinding,
  sourceG2: source.sourceG2,
  priorG3Failure,
  validation: validationRecord,
  finalizedToolInputCount: toolClosure.fileCount,
  finalizedToolInputs: toolClosure.files,
  finalizedToolSetDigest: toolClosure.digest,
  executionPolicy,
  outputs: outputPaths,
};

// Close the read window before either append-only preflight artifact is created.
const sourceImmediatelyBeforeWrite = verifySourceG2();
const priorG3ImmediatelyBeforeWrite = verifyPriorG3(sourceImmediatelyBeforeWrite);
assert.deepEqual(sourceImmediatelyBeforeWrite.sourceG2, source.sourceG2);
assert.deepEqual(sourceImmediatelyBeforeWrite.authoritativeBinding, source.authoritativeBinding);
assert.deepEqual(priorG3ImmediatelyBeforeWrite, priorG3Failure);
assert.deepEqual(closureSnapshot(G4_TOOL_RELATIVE, true), toolClosure, 'G4 tools changed during preflight.');
assert.equal(fs.existsSync(path.join(ROOT, planRelative)), false);
assert.equal(fs.existsSync(path.join(ROOT, sealRelative)), false);
writeJsonExclusive(planRelative, plan);

const planRecord = fileRecord(planRelative);
const seal = {
  kind: 'MO1307Phase3CR2C3TBG4PreExecutionSeal',
  version: '1.0.0',
  result: 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED',
  sealedAt: new Date().toISOString(),
  generation: { ...GENERATION },
  recoveryPlan: planRecord,
  validation: validationRecord,
  authoritativeBinding: source.authoritativeBinding,
  sourceG2: source.sourceG2,
  priorG3Failure,
  finalizedToolInputCount: toolClosure.fileCount,
  finalizedToolInputs: toolClosure.files,
  finalizedToolSetDigest: toolClosure.digest,
  executionPolicy,
  executionCounts: zeroExecutionCounts(),
  appendOnly: true,
};
writeJsonExclusive(sealRelative, seal);

process.stdout.write(`${JSON.stringify({
  result: 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED',
  plan: planRelative,
  seal: sealRelative,
  sourceG2EvidenceFiles: source.sourceG2.evidence.fileCount,
  sourceG2ToolFiles: source.sourceG2.tools.fileCount,
  priorG3EvidenceFiles: priorG3Failure.evidence.fileCount,
  priorG3ToolFiles: priorG3Failure.tools.fileCount,
  executionCounts: seal.executionCounts,
})}\n`);
