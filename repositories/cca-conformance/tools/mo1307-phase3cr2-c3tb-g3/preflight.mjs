// Append-only G3 preflight/seal. Performs static Git/hash/evidence checks only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  GENERATION,
  G3_EVIDENCE_RELATIVE,
  G3_TOOL_RELATIVE,
  ROOT,
  assertStaticRuntimeAndRepository,
  closureSnapshot,
  fileRecord,
  readJson,
  verifySourceG2,
  writeJsonExclusive,
  zeroExecutionCounts,
} from './recovery-static-lib.mjs';

const validationRelative = `${G3_EVIDENCE_RELATIVE}/zero-execution-validation.json`;
const planRelative = `${G3_EVIDENCE_RELATIVE}/recovery-plan.json`;
const sealRelative = `${G3_EVIDENCE_RELATIVE}/pre-execution-seal.json`;
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
  `${G3_EVIDENCE_RELATIVE}/fresh-control-results.json`,
  `${G3_EVIDENCE_RELATIVE}/candidate-specific-controls.json`,
  `${G3_EVIDENCE_RELATIVE}/source-security-reviews.json`,
  `${G3_EVIDENCE_RELATIVE}/administrative-recovery.json`,
  `${G3_EVIDENCE_RELATIVE}/certification-receipt.json`,
  `${G3_EVIDENCE_RELATIVE}/final-validation.json`,
  `${G3_EVIDENCE_RELATIVE}/phase3d-handoff.json`,
  `${G3_EVIDENCE_RELATIVE}/evidence-manifest.json`,
  `${G3_EVIDENCE_RELATIVE}/final-seal.json`,
];

assert.deepEqual(process.argv.slice(2), ['--write']);
const runtime = assertStaticRuntimeAndRepository();
const evidenceRoot = path.join(ROOT, G3_EVIDENCE_RELATIVE);
const evidenceStat = fs.lstatSync(evidenceRoot);
assert.equal(evidenceStat.isSymbolicLink(), false, 'G3 evidence namespace is a symlink.');
assert.equal(evidenceStat.isDirectory(), true, 'G3 evidence namespace is not a directory.');
const initialEntries = fs.readdirSync(evidenceRoot, { withFileTypes: true });
assert.deepEqual(initialEntries.map(entry => entry.name).sort(), [path.basename(validationRelative)]);
assert.equal(initialEntries[0].isSymbolicLink(), false);
assert.equal(initialEntries[0].isFile(), true);

const validation = readJson(validationRelative);
assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG3ZeroExecutionValidation');
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
assert.equal(validation.scope.reconciliationExecuted, false);
assert.equal(validation.scope.stages1Through8Rerun, false);

const source = verifySourceG2();
assert.deepEqual(source.sourceG2, validation.sourceG2, 'G2 source differs from the zero-execution validation snapshot.');
assert.deepEqual(source.authoritativeBinding, validation.authoritativeBinding, 'Candidate binding differs from validated binding.');
const validationRecord = fileRecord(validationRelative);

const toolClosure = closureSnapshot(G3_TOOL_RELATIVE, true);
const toolNames = toolClosure.files.map(record => path.basename(record.path));
for (const required of requiredTools) assert.equal(toolNames.includes(required), true, `Missing required G3 tool: ${required}`);
assert.equal(new Set(toolClosure.files.map(record => record.path)).size, toolClosure.fileCount);

const executionPolicy = {
  reconciliationOnly: true,
  sourceExecutionGeneration: GENERATION.sourceExecutionGeneration,
  consumesImmutableRawWitnesses: true,
  rerunStages1Through8: false,
  permittedOperations: ['READ_IMMUTABLE_G2', 'STATIC_GIT_AND_HASH_VERIFICATION', 'RECONCILE_EXISTING_WITNESSES', 'WRITE_G3_EVIDENCE'],
  prohibitedOperations: ['PRODUCT_EXECUTION', 'HELPER_EXECUTION', 'WORKER_EXECUTION', 'SECURITY_CONTROL_EXECUTION', 'NATIVE_CONTROL_EXECUTION', 'NETWORK', 'PHASE3A', 'PHASE3B', 'PHASE3D', 'PUSH', 'TAG'],
  executionsBeforeSeal: zeroExecutionCounts(),
};

const plan = {
  kind: 'MO1307Phase3CR2C3TBG3RecoveryPlan',
  version: '1.0.0',
  status: 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED',
  createdAt: new Date().toISOString(),
  generation: { ...GENERATION },
  scope: {
    classification: 'RECONCILIATION_EVIDENCE_BINDING_FIELD_SOURCE_CORRECTION',
    priorFailurePreserved: true,
    priorFailureRewrittenAsPass: false,
    resumesPriorAttempt: false,
    newExecutionCampaign: false,
    reconciliationOnly: true,
  },
  rootCause: {
    classification: ['WRONG_SOURCE_OBJECT', 'OTHER_CONCRETE_RECONCILIATION_DEFECT'],
    failedAssertionSource: 'candidate.json.productionTree',
    failedAssertionObservedValue: null,
    authoritativeSourceRule: 'NON_NULL_EQUALITY_ACROSS_SEALED_PLAN_SEAL_BINDING_VERIFICATION_OFFICIAL_CHECK_AND_GIT',
    manualFallbackAllowed: false,
    candidateJsonProductionTreeAuthoritative: false,
    staleBindingKindDiscriminator: {
      g2ReconcileExpected: 'MO1307ProspectiveHelperBoundBinding',
      sealedBindingActual: 'MO1307ProspectiveHelperBoundCandidateBinding',
      correctedAuthority: 'MO1307ProspectiveHelperBoundCandidateBinding',
    },
  },
  authoritativeBinding: source.authoritativeBinding,
  sourceG2: source.sourceG2,
  validation: validationRecord,
  finalizedToolInputCount: toolClosure.fileCount,
  finalizedToolInputs: toolClosure.files,
  finalizedToolSetDigest: toolClosure.digest,
  executionPolicy,
  outputs: outputPaths,
};

// Close the read window before either append-only preflight artifact is created.
const sourceImmediatelyBeforeWrite = verifySourceG2();
assert.deepEqual(sourceImmediatelyBeforeWrite.sourceG2, source.sourceG2);
assert.deepEqual(sourceImmediatelyBeforeWrite.authoritativeBinding, source.authoritativeBinding);
assert.deepEqual(closureSnapshot(G3_TOOL_RELATIVE, true), toolClosure, 'G3 tools changed during preflight.');
assert.equal(fs.existsSync(path.join(ROOT, planRelative)), false);
assert.equal(fs.existsSync(path.join(ROOT, sealRelative)), false);
writeJsonExclusive(planRelative, plan);

const planRecord = fileRecord(planRelative);
const seal = {
  kind: 'MO1307Phase3CR2C3TBG3PreExecutionSeal',
  version: '1.0.0',
  result: 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED',
  sealedAt: new Date().toISOString(),
  generation: { ...GENERATION },
  recoveryPlan: planRecord,
  validation: validationRecord,
  authoritativeBinding: source.authoritativeBinding,
  sourceG2: source.sourceG2,
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
  executionCounts: seal.executionCounts,
})}\n`);
