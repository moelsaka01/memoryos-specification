// Append-only preflight sealing for the G7 acceptance-only recovery.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  GENERATION,
  G7_EVIDENCE_RELATIVE,
  G7_PLANNED_OUTPUTS,
  G7_TOOL_RELATIVE,
  ROOT,
  canonical,
  closureSnapshot,
  fileRecord,
  readJson,
  verifyRecoveryChain,
  writeJsonExclusive,
  zeroExecutionCounts,
} from './recovery-static-lib.mjs';

const evidenceRoot = path.join(ROOT, G7_EVIDENCE_RELATIVE);
const validationRelative = `${G7_EVIDENCE_RELATIVE}/zero-execution-validation.json`;
const planRelative = `${G7_EVIDENCE_RELATIVE}/recovery-plan.json`;
const sealRelative = `${G7_EVIDENCE_RELATIVE}/pre-execution-seal.json`;
const requiredTools = [
  'accept.mjs',
  'binding-lib.mjs',
  'finalize.mjs',
  'preflight.mjs',
  'README.md',
  'recovery-static-lib.mjs',
  'validate-recovery.mjs',
];

function fail(error) {
  process.stderr.write(`${canonical({
    result: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    failure: { name: error?.name ?? 'Error', code: error?.code ?? null, message: error?.message ?? String(error) },
    outputsWritten: {
      recoveryPlan: fs.existsSync(path.join(ROOT, planRelative)),
      preExecutionSeal: fs.existsSync(path.join(ROOT, sealRelative)),
    },
  })}\n`);
  process.exitCode = 1;
}

function verifySourceOnly() {
  assert.equal(fs.existsSync(evidenceRoot), false, 'G7 evidence must be absent during source-only verification.');
  const chain = verifyRecoveryChain();
  const toolClosure = closureSnapshot(G7_TOOL_RELATIVE, true);
  assert.equal(toolClosure.fileCount, 7);
  assert.deepEqual(toolClosure.files.map(record => path.basename(record.path)), requiredTools);
  assert.deepEqual(chain.priorG6Failure.outputsWritten, {
    zeroExecutionValidation: true,
    recoveryPlan: true,
    preExecutionSeal: true,
    administrativeAcceptanceRecovery: true,
    certificationReceipt: true,
    finalValidation: true,
    phase3DHandoff: true,
    evidenceManifest: true,
    finalSeal: true,
  });
  assert.equal(chain.priorG6Failure.terminalEvidenceComplete, true);
  assert.equal(chain.priorG6Failure.stagedVerificationCompleted, false);
  assert.equal(chain.priorG6Failure.acceptanceCommitCreated, false);
  process.stdout.write(`${canonical({
    result: 'PASS_PREFLIGHT_SOURCE_VERIFIED',
    outcome: 'PASS_PREFLIGHT_SOURCE_VERIFIED',
    mode: '--verify-source-only',
    generation: GENERATION,
    authoritativeBinding: chain.authoritativeBinding,
    productionTree: chain.productionTree,
    priorG6Failure: {
      phase: chain.priorG6Failure.phase,
      classification: chain.priorG6Failure.classification,
      classificationLabel: chain.priorG6Failure.classificationLabel,
      tools: chain.priorG6Failure.tools,
      evidence: chain.priorG6Failure.evidence,
      stagedState: chain.priorG6Failure.stagedState,
    },
    toolFileCount: toolClosure.fileCount,
    toolDigest: toolClosure.digest,
    plannedEvidenceFiles: G7_PLANNED_OUTPUTS.length,
    wouldWriteOutputs: [planRelative, sealRelative],
    executionCounts: zeroExecutionCounts(),
    executions: 0,
    writes: 0,
    outputWritten: false,
  })}\n`);
}

function main() {
  const args = process.argv.slice(2);
  assert.equal(args.length, 1);
  assert.ok(['--verify-source-only', '--write'].includes(args[0]));
  if (args[0] === '--verify-source-only') {
    verifySourceOnly();
    return;
  }
  assert.equal(fs.lstatSync(evidenceRoot).isDirectory(), true, 'G7 evidence root must exist after validation.');
  assert.deepEqual(fs.readdirSync(evidenceRoot), ['zero-execution-validation.json']);
  const validation = readJson(validationRelative);
  const chain = verifyRecoveryChain();
  assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG7ZeroExecutionValidation');
  assert.equal(validation.result, 'PASS');
  assert.deepEqual(validation.generation, GENERATION);
  assert.deepEqual(validation.authoritativeBinding, chain.authoritativeBinding);
  assert.equal(validation.productionTree, chain.productionTree);
  assert.deepEqual(validation.sourceG2, chain.source.sourceG2);
  assert.deepEqual(validation.priorG3Failure, chain.priorG3Failure);
  assert.deepEqual(validation.priorG4Failure, chain.priorG4Failure);
  assert.deepEqual(validation.priorG5Failure, chain.priorG5Failure);
  assert.deepEqual(validation.priorG6Failure, chain.priorG6Failure);
  const validationRecord = fileRecord(validationRelative);

  const toolClosure = closureSnapshot(G7_TOOL_RELATIVE, true);
  assert.equal(toolClosure.fileCount, 7);
  assert.deepEqual(toolClosure.files.map(record => path.basename(record.path)), requiredTools);
  const executionPolicy = {
    mode: 'ZERO_EXECUTION_ACCEPTANCE_ONLY',
    sourceExecutionGeneration: GENERATION.sourceExecutionGeneration,
    priorRecoveryGeneration: GENERATION.priorRecoveryGeneration,
    preservesFailedG2: true,
    preservesFailedG3: true,
    preservesFailedG4: true,
    preservesFailedG5: true,
    preservesFailedG6: true,
    consumesCompleteG4Reconciliation: true,
    consumesCompleteG6TerminalEvidence: true,
    executionsBeforeSeal: zeroExecutionCounts(),
    permittedOperations: [
      'READ_IMMUTABLE_G2',
      'READ_IMMUTABLE_G3',
      'READ_IMMUTABLE_G4',
      'READ_IMMUTABLE_G5',
      'READ_IMMUTABLE_G6',
      'STATIC_GIT_AND_HASH_VERIFICATION',
      'WRITE_G7_ACCEPTANCE_EVIDENCE',
      'STAGE_EXACT_ACCEPTANCE_PATH_UNION',
      'CREATE_SINGLE_PARENT_ACCEPTANCE_COMMIT_OUTSIDE_G7_TOOLS',
    ],
    forbiddenOperations: [
      'RERUN_STAGES_1_THROUGH_8',
      'RERUN_RECONCILIATION',
      'LAUNCH_HELPER_OR_WORKER',
      'LAUNCH_PRODUCT_OR_SECURITY_CONTROL',
      'LAUNCH_NATIVE_CONTROL',
      'USE_NETWORK',
      'MODIFY_G1_G2_G3_G4_G5_OR_G6',
      'MODIFY_PRODUCT',
      'CREATE_COMMIT_FROM_G7_TOOL',
      'EXECUTE_PHASE3A_OR_PHASE3B_OR_PHASE3D',
      'PUSH',
      'TAG',
    ],
  };
  const plan = {
    kind: 'MO1307Phase3CR2C3TBG7RecoveryPlan',
    version: '1.0.0',
    status: 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED',
    createdAt: new Date().toISOString(),
    generation: { ...GENERATION },
    scope: {
      mode: 'ACCEPTANCE_ONLY',
      repairTarget: 'G6_STAGED_VERIFIER_TERMINAL_INVENTORY_REENTRY',
      sourceExecutionGeneration: GENERATION.sourceExecutionGeneration,
      priorRecoveryGeneration: GENERATION.priorRecoveryGeneration,
      preservesFailedG2: true,
      preservesFailedG3: true,
      preservesFailedG4: true,
      preservesFailedG5: true,
      preservesFailedG6: true,
      consumesCompleteG4Reconciliation: true,
      consumesCompleteG6TerminalEvidence: true,
      rerunsStages1Through8: false,
      rerunsReconciliation: false,
      launchesControls: false,
      changesProduct: false,
      createsCommit: false,
      executesPhase3D: false,
    },
    rootCause: {
      classification: chain.priorG6Failure.classification,
      classificationLabel: chain.priorG6Failure.classificationLabel,
      phase: chain.priorG6Failure.phase,
      failure: chain.priorG6Failure.failure,
      cause: chain.priorG6Failure.cause,
      correction: 'CREATE_NEW_APPEND_ONLY_G7_ACCEPTANCE_GENERATION_WITH_SEPARATE_PREFINAL_AND_FINAL_LOADERS',
      g6BytesModified: false,
    },
    authoritativeBinding: chain.authoritativeBinding,
    productionTree: chain.productionTree,
    sourceG2: chain.source.sourceG2,
    priorG3Failure: chain.priorG3Failure,
    priorG4Failure: chain.priorG4Failure,
    priorG5Failure: chain.priorG5Failure,
    priorG6Failure: chain.priorG6Failure,
    validation: validationRecord,
    finalizedToolInputCount: toolClosure.fileCount,
    finalizedToolInputs: toolClosure.files,
    finalizedToolSetDigest: toolClosure.digest,
    executionPolicy,
    outputs: [...G7_PLANNED_OUTPUTS],
  };

  const beforePlan = verifyRecoveryChain();
  assert.deepEqual(beforePlan.priorG6Failure, chain.priorG6Failure);
  assert.deepEqual(closureSnapshot(G7_TOOL_RELATIVE, true), toolClosure);
  writeJsonExclusive(planRelative, plan);
  assert.deepEqual(fs.readdirSync(evidenceRoot).sort(), ['recovery-plan.json', 'zero-execution-validation.json']);

  const seal = {
    kind: 'MO1307Phase3CR2C3TBG7PreExecutionSeal',
    version: '1.0.0',
    result: 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED',
    sealedAt: new Date().toISOString(),
    generation: { ...GENERATION },
    recoveryPlan: fileRecord(planRelative),
    validation: validationRecord,
    authoritativeBinding: chain.authoritativeBinding,
    productionTree: chain.productionTree,
    sourceG2: chain.source.sourceG2,
    priorG3Failure: chain.priorG3Failure,
    priorG4Failure: chain.priorG4Failure,
    priorG5Failure: chain.priorG5Failure,
    priorG6Failure: chain.priorG6Failure,
    finalizedToolInputCount: toolClosure.fileCount,
    finalizedToolInputs: toolClosure.files,
    finalizedToolSetDigest: toolClosure.digest,
    executionPolicy,
    executionCounts: zeroExecutionCounts(),
    appendOnly: true,
  };
  const beforeSeal = verifyRecoveryChain();
  assert.deepEqual(beforeSeal.priorG6Failure, chain.priorG6Failure);
  assert.deepEqual(closureSnapshot(G7_TOOL_RELATIVE, true), toolClosure);
  writeJsonExclusive(sealRelative, seal);
  assert.deepEqual(fs.readdirSync(evidenceRoot).sort(), ['pre-execution-seal.json', 'recovery-plan.json', 'zero-execution-validation.json']);
  process.stdout.write(`${canonical({
    result: 'PASS_PREFLIGHT_SEALED',
    generation: GENERATION.id,
    toolFileCount: toolClosure.fileCount,
    toolDigest: toolClosure.digest,
    plannedEvidenceFiles: G7_PLANNED_OUTPUTS.length,
    executionCounts: seal.executionCounts,
  })}\n`);
}

try {
  main();
} catch (error) {
  fail(error);
}
