// Append-only G5 preflight/seal. Performs static Git/hash/evidence checks only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  GENERATION,
  G5_EVIDENCE_RELATIVE,
  G5_PLANNED_OUTPUTS,
  G5_TOOL_RELATIVE,
  ROOT,
  closureSnapshot,
  fileRecord,
  readJson,
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
    planWritten: fs.existsSync(path.join(ROOT, G5_EVIDENCE_RELATIVE, 'recovery-plan.json')),
    sealWritten: fs.existsSync(path.join(ROOT, G5_EVIDENCE_RELATIVE, 'pre-execution-seal.json')),
  })}\n`);
  process.exitCode = 1;
});

assert.deepEqual(process.argv.slice(2), ['--write']);
const validationRelative = `${G5_EVIDENCE_RELATIVE}/zero-execution-validation.json`;
const planRelative = `${G5_EVIDENCE_RELATIVE}/recovery-plan.json`;
const sealRelative = `${G5_EVIDENCE_RELATIVE}/pre-execution-seal.json`;
const requiredTools = [
  'accept.mjs',
  'binding-lib.mjs',
  'finalize.mjs',
  'preflight.mjs',
  'README.md',
  'recovery-static-lib.mjs',
  'validate-recovery.mjs',
];

const evidenceRoot = path.join(ROOT, G5_EVIDENCE_RELATIVE);
const evidenceStat = fs.lstatSync(evidenceRoot);
assert.equal(evidenceStat.isSymbolicLink(), false, 'G5 evidence namespace is a symlink.');
assert.equal(evidenceStat.isDirectory(), true, 'G5 evidence namespace is not a directory.');
const initialEntries = fs.readdirSync(evidenceRoot, { withFileTypes: true });
assert.deepEqual(initialEntries.map(entry => entry.name), ['zero-execution-validation.json']);
assert.equal(initialEntries[0].isFile(), true);
assert.equal(initialEntries[0].isSymbolicLink(), false);

const validation = readJson(validationRelative);
assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG5ZeroExecutionValidation');
assert.equal(validation.version, '1.0.0');
assert.equal(validation.result, 'PASS');
assert.deepEqual(validation.generation, GENERATION);
assert.deepEqual(validation.cases.map(test => test.id), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
assert.deepEqual(validation.cases.map(test => test.expected), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'PASS', 'FAIL']);
assert.deepEqual(validation.cases.map(test => test.actual), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'PASS', 'FAIL']);
assert.equal(validation.cases.every(test => test.result === 'PASS'), true);
assert.deepEqual(validation.executionCounts, zeroExecutionCounts());
assert.deepEqual(validation.scope, {
  validationOnly: true,
  priorG2Preserved: true,
  priorG3Preserved: true,
  priorG4Preserved: true,
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

const chain = verifyRecoveryChain();
assert.deepEqual(validation.authoritativeBinding, chain.authoritativeBinding);
assert.equal(validation.productionTree, chain.productionTree);
assert.equal(validation.authoritativeBinding.production.tree, chain.productionTree);
assert.deepEqual(validation.sourceG2, chain.source.sourceG2);
assert.deepEqual(validation.priorG3Failure, chain.priorG3Failure);
assert.deepEqual(validation.priorG4Failure, chain.priorG4Failure);
const validationRecord = fileRecord(validationRelative);

const toolClosure = closureSnapshot(G5_TOOL_RELATIVE, true);
assert.equal(toolClosure.fileCount, requiredTools.length, 'G5 tool closure must contain exactly seven files.');
assert.deepEqual(toolClosure.files.map(record => path.basename(record.path)), requiredTools);

const executionPolicy = {
  mode: 'ZERO_EXECUTION_ACCEPTANCE_ONLY',
  sourceExecutionGeneration: GENERATION.sourceExecutionGeneration,
  priorRecoveryGeneration: GENERATION.priorRecoveryGeneration,
  preservesFailedG2: true,
  preservesFailedG3: true,
  preservesFailedG4: true,
  consumesCompleteG4Reconciliation: true,
  executionsBeforeSeal: zeroExecutionCounts(),
  permittedOperations: [
    'READ_IMMUTABLE_G2',
    'READ_IMMUTABLE_G3',
    'READ_IMMUTABLE_G4',
    'STATIC_GIT_AND_HASH_VERIFICATION',
    'WRITE_G5_ACCEPTANCE_EVIDENCE',
    'STAGE_EXACT_ACCEPTANCE_PATH_UNION',
    'CREATE_SINGLE_PARENT_ACCEPTANCE_COMMIT',
  ],
  forbiddenOperations: [
    'RERUN_STAGES_1_THROUGH_8',
    'LAUNCH_HELPER_OR_WORKER',
    'LAUNCH_PRODUCT_OR_SECURITY_CONTROL',
    'LAUNCH_NATIVE_CONTROL',
    'USE_NETWORK',
    'MODIFY_G1_G2_G3_OR_G4',
    'MODIFY_PRODUCT',
    'EXECUTE_PHASE3A_OR_PHASE3B_OR_PHASE3D',
    'PUSH',
    'TAG',
  ],
};

const plan = {
  kind: 'MO1307Phase3CR2C3TBG5RecoveryPlan',
  version: '1.0.0',
  status: 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED',
  createdAt: new Date().toISOString(),
  generation: { ...GENERATION },
  scope: {
    mode: 'ACCEPTANCE_ONLY',
    repairTarget: 'G4_STAGED_ACCEPTANCE_VERIFICATION',
    sourceExecutionGeneration: GENERATION.sourceExecutionGeneration,
    priorRecoveryGeneration: GENERATION.priorRecoveryGeneration,
    preservesFailedG2: true,
    preservesFailedG3: true,
    preservesFailedG4: true,
    consumesCompleteG4Reconciliation: true,
    rerunsStages1Through8: false,
    rerunsReconciliation: false,
    launchesControls: false,
    changesProduct: false,
    executesPhase3D: false,
  },
  rootCause: {
    classification: ['OTHER_CONCRETE_RECONCILIATION_DEFECT'],
    classificationLabel: 'OTHER_CONCRETE_RECONCILIATION_DEFECT/GIT_DIFF_CHECK_EXACT_KNOWN_VIOLATIONS',
    phase: 'STAGED_ACCEPTANCE_VERIFICATION',
    failure: chain.priorG4Failure.failure,
    violations: chain.priorG4Failure.violations,
    correction: 'CREATE_NEW_APPEND_ONLY_G5_ACCEPTANCE_GENERATION_WITH_G4_BYTES_PRESERVED',
    g4BytesModified: false,
  },
  authoritativeBinding: chain.authoritativeBinding,
  productionTree: chain.productionTree,
  sourceG2: chain.source.sourceG2,
  priorG3Failure: chain.priorG3Failure,
  priorG4Failure: chain.priorG4Failure,
  validation: validationRecord,
  finalizedToolInputCount: toolClosure.fileCount,
  finalizedToolInputs: toolClosure.files,
  finalizedToolSetDigest: toolClosure.digest,
  executionPolicy,
  outputs: [...G5_PLANNED_OUTPUTS],
};

const immediatelyBeforePlan = verifyRecoveryChain();
assert.deepEqual(immediatelyBeforePlan.source.sourceG2, chain.source.sourceG2);
assert.deepEqual(immediatelyBeforePlan.priorG3Failure, chain.priorG3Failure);
assert.deepEqual(immediatelyBeforePlan.priorG4Failure, chain.priorG4Failure);
assert.deepEqual(immediatelyBeforePlan.authoritativeBinding, chain.authoritativeBinding);
assert.equal(immediatelyBeforePlan.productionTree, chain.productionTree);
assert.deepEqual(closureSnapshot(G5_TOOL_RELATIVE, true), toolClosure, 'G5 tools changed during preflight.');
assert.deepEqual(fs.readdirSync(evidenceRoot), ['zero-execution-validation.json']);

writeJsonExclusive(planRelative, plan);
assert.deepEqual(fs.readdirSync(evidenceRoot).sort(), ['recovery-plan.json', 'zero-execution-validation.json']);
const planRecord = fileRecord(planRelative);
const seal = {
  kind: 'MO1307Phase3CR2C3TBG5PreExecutionSeal',
  version: '1.0.0',
  result: 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED',
  sealedAt: new Date().toISOString(),
  generation: { ...GENERATION },
  recoveryPlan: planRecord,
  validation: validationRecord,
  authoritativeBinding: chain.authoritativeBinding,
  productionTree: chain.productionTree,
  sourceG2: chain.source.sourceG2,
  priorG3Failure: chain.priorG3Failure,
  priorG4Failure: chain.priorG4Failure,
  finalizedToolInputCount: toolClosure.fileCount,
  finalizedToolInputs: toolClosure.files,
  finalizedToolSetDigest: toolClosure.digest,
  executionPolicy,
  executionCounts: zeroExecutionCounts(),
  appendOnly: true,
};

const immediatelyBeforeSeal = verifyRecoveryChain();
assert.deepEqual(immediatelyBeforeSeal.source.sourceG2, chain.source.sourceG2);
assert.deepEqual(immediatelyBeforeSeal.priorG3Failure, chain.priorG3Failure);
assert.deepEqual(immediatelyBeforeSeal.priorG4Failure, chain.priorG4Failure);
assert.deepEqual(immediatelyBeforeSeal.authoritativeBinding, chain.authoritativeBinding);
assert.equal(immediatelyBeforeSeal.productionTree, chain.productionTree);
assert.deepEqual(closureSnapshot(G5_TOOL_RELATIVE, true), toolClosure, 'G5 tools changed before sealing.');
assert.deepEqual(fileRecord(validationRelative), validationRecord);
assert.deepEqual(fileRecord(planRelative), planRecord);

writeJsonExclusive(sealRelative, seal);
assert.deepEqual(fs.readdirSync(evidenceRoot).sort(), [
  'pre-execution-seal.json',
  'recovery-plan.json',
  'zero-execution-validation.json',
]);
process.stdout.write(`${JSON.stringify({
  result: 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED',
  generation: GENERATION.id,
  tools: { fileCount: toolClosure.fileCount, digest: toolClosure.digest },
  evidence: [validationRelative, planRelative, sealRelative],
  executionCounts: seal.executionCounts,
})}\n`);
