// Append-only Phase 3CR2 G7 acceptance-only administrative recovery.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  C3TB,
  EXPECTED_G4_VIOLATIONS,
  GENERATION,
  G6_EVIDENCE_RELATIVE,
  G6_TOOL_RELATIVE,
  G7_EVIDENCE_RELATIVE,
  G7_PLANNED_OUTPUTS,
  G7_TOOL_RELATIVE,
  ROOT,
  canonical,
  closureSnapshot,
  fileRecord,
  readJson,
  readRegularBytes,
  verifyRecoveryChain,
  writeJsonExclusive,
  zeroExecutionCounts,
} from './recovery-static-lib.mjs';

const VALIDATION = `${G7_EVIDENCE_RELATIVE}/zero-execution-validation.json`;
const PLAN = `${G7_EVIDENCE_RELATIVE}/recovery-plan.json`;
const PRE_SEAL = `${G7_EVIDENCE_RELATIVE}/pre-execution-seal.json`;
const OUTPUT = `${G7_EVIDENCE_RELATIVE}/administrative-acceptance-recovery.json`;
const TOOL_NAMES = [
  'README.md',
  'accept.mjs',
  'binding-lib.mjs',
  'finalize.mjs',
  'preflight.mjs',
  'recovery-static-lib.mjs',
  'validate-recovery.mjs',
];
const PREFINAL_NAMES = [
  'administrative-acceptance-recovery.json',
  'pre-execution-seal.json',
  'recovery-plan.json',
  'zero-execution-validation.json',
];
const SEALED_NAMES = [
  'pre-execution-seal.json',
  'recovery-plan.json',
  'zero-execution-validation.json',
];
const G6_ARTIFACTS = Object.freeze({
  validation: `${G6_EVIDENCE_RELATIVE}/zero-execution-validation.json`,
  plan: `${G6_EVIDENCE_RELATIVE}/recovery-plan.json`,
  preExecutionSeal: `${G6_EVIDENCE_RELATIVE}/pre-execution-seal.json`,
  administrativeAcceptanceRecovery: `${G6_EVIDENCE_RELATIVE}/administrative-acceptance-recovery.json`,
  receipt: `${G6_EVIDENCE_RELATIVE}/certification-receipt.json`,
  finalValidation: `${G6_EVIDENCE_RELATIVE}/final-validation.json`,
  phase3DHandoff: `${G6_EVIDENCE_RELATIVE}/phase3d-handoff.json`,
  manifest: `${G6_EVIDENCE_RELATIVE}/evidence-manifest.json`,
  finalSeal: `${G6_EVIDENCE_RELATIVE}/final-seal.json`,
});
const fileOrder = (left, right) => left.localeCompare(right, 'en');

function absolute(relative) {
  const resolved = path.resolve(ROOT, relative);
  const prefix = path.resolve(ROOT) + path.sep;
  assert.ok(resolved.startsWith(prefix), `Path escapes worktree: ${relative}`);
  return resolved;
}

function filePin(relative) {
  const record = fileRecord(relative);
  return { path: record.path, byteLength: record.byteLength, sha256: record.sha256 };
}

function assertExactInventory(relativeRoot, names, label) {
  const target = absolute(relativeRoot);
  const entries = fs.readdirSync(target, { withFileTypes: true });
  for (const entry of entries) {
    assert.equal(entry.isSymbolicLink(), false, `${label}: symlink ${entry.name}`);
    assert.equal(entry.isFile(), true, `${label}: regular file ${entry.name}`);
  }
  assert.deepEqual(entries.map(entry => entry.name).sort(fileOrder), [...names].sort(fileOrder), `${label}: exact inventory`);
}

function assertExactEofLf(relative) {
  const bytes = readRegularBytes(relative);
  assert.equal(bytes.at(-1), 0x0a);
  assert.notEqual(bytes.at(-2), 0x0a);
  assert.equal(bytes.includes(0x0d), false);
  assert.equal(/[ \t]+$/mu.test(bytes.toString('utf8')), false);
}

function assertSealedInputs(validation, plan, seal, tools, chain) {
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
  assert.deepEqual(validation.executionCounts, zeroExecutionCounts());
  assert.deepEqual(validation.cases.map(test => test.id), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
  const expected = ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'PASS', 'FAIL', 'FAIL', 'PASS', 'FAIL'];
  assert.deepEqual(validation.cases.map(test => test.expected), expected);
  assert.deepEqual(validation.cases.map(test => test.actual), expected);
  assert.equal(validation.cases.every(test => test.result === 'PASS'), true);
  assert.deepEqual(validation.scope, {
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
  });

  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBG7RecoveryPlan');
  assert.equal(plan.status, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assert.deepEqual(plan.generation, GENERATION);
  assert.equal(plan.finalizedToolInputCount, 7);
  assert.deepEqual(plan.finalizedToolInputs, tools.files);
  assert.equal(plan.finalizedToolSetDigest, tools.digest);
  assert.deepEqual(plan.outputs, G7_PLANNED_OUTPUTS);
  assert.equal(plan.scope.repairTarget, 'G6_STAGED_VERIFIER_TERMINAL_INVENTORY_REENTRY');
  assert.equal(plan.scope.preservesFailedG6, true);
  assert.equal(plan.scope.consumesCompleteG6TerminalEvidence, true);
  assert.equal(plan.scope.createsCommit, false);
  assert.deepEqual(plan.executionPolicy.executionsBeforeSeal, zeroExecutionCounts());

  assert.equal(seal.kind, 'MO1307Phase3CR2C3TBG7PreExecutionSeal');
  assert.equal(seal.result, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assert.deepEqual(seal.generation, GENERATION);
  assert.equal(seal.finalizedToolInputCount, 7);
  assert.deepEqual(seal.finalizedToolInputs, tools.files);
  assert.equal(seal.finalizedToolSetDigest, tools.digest);
  assert.deepEqual(seal.executionPolicy, plan.executionPolicy);
  assert.deepEqual(seal.executionCounts, zeroExecutionCounts());
  assert.equal(seal.appendOnly, true);
  for (const artifact of [plan, seal]) {
    assert.deepEqual(artifact.authoritativeBinding, chain.authoritativeBinding);
    assert.equal(artifact.productionTree, chain.productionTree);
    assert.deepEqual(artifact.sourceG2, chain.source.sourceG2);
    assert.deepEqual(artifact.priorG3Failure, chain.priorG3Failure);
    assert.deepEqual(artifact.priorG4Failure, chain.priorG4Failure);
    assert.deepEqual(artifact.priorG5Failure, chain.priorG5Failure);
    assert.deepEqual(artifact.priorG6Failure, chain.priorG6Failure);
  }
  assert.deepEqual(plan.validation, filePin(VALIDATION));
  assert.deepEqual(seal.validation, filePin(VALIDATION));
  assert.deepEqual(seal.recoveryPlan, filePin(PLAN));
}

function authorityCitations() {
  return [
    { path: 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g2/README.md', range: '41-44', rule: 'FAILED_GENERATIONS_ARE_TERMINAL_AND_IMMUTABLE' },
    { path: 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g6/finalize.mjs', range: '317,549,954,1002', rule: 'FAILED_G6_STAGED_VERIFIER_IS_PRESERVED_AND_SUPERSEDED_ONLY_BY_NEW_G7' },
    { path: 'repositories/cca-conformance/docs/certification-guide.md', range: '98-99', rule: 'LATER_ASSESSMENTS_USE_NEW_VERSIONED_PATHS' },
    { path: 'repositories/cca-conformance/README.md', range: '223-225', rule: 'PUBLISHED_EVIDENCE_IS_IMMUTABLE' },
    { path: 'repositories/cca-conformance/docs/mo1302-handoff.md', range: '67-68', rule: 'FAILED_OR_SUPERSEDED_GENERATIONS_MUST_NOT_BE_PROMOTED' },
  ];
}

function buildRecord(validation, chain, tools) {
  const g6Tools = closureSnapshot(G6_TOOL_RELATIVE, true);
  const g6Evidence = closureSnapshot(G6_EVIDENCE_RELATIVE, true);
  const record = {
    kind: 'MO1307Phase3CR2C3TBG7AdministrativeAcceptanceRecovery',
    version: '1.0.0',
    recoveredAt: new Date().toISOString(),
    result: 'PASS',
    outcome: 'ACCEPTANCE_RECOVERY_COMPLETE',
    generation: { ...GENERATION },
    sourceExecutionGeneration: GENERATION.sourceExecutionGeneration,
    priorRecoveryGeneration: GENERATION.priorRecoveryGeneration,
    evidenceOrigin: {
      mode: 'ACCEPTANCE_ONLY_NO_EXECUTION',
      executedInG7: { fresh: 0, reuse: 0, candidateSpecific: 0, sourceAndSecurityReviews: 0 },
      acceptedFromG6: {
        freshSelectedHistoricalControls: 89,
        reusedHistoricalControls: 462,
        candidateSpecificControls: 2,
        sourceAndSecurityReviews: 12,
        backedByExecutionGeneration: 'phase3cr2-c3tb-g2',
        reconciledInGeneration: 'phase3cr2-c3tb-g4',
        terminalizedInGeneration: 'phase3cr2-c3tb-g6',
      },
    },
    authoritativeBinding: validation.authoritativeBinding,
    sourceG2: validation.sourceG2,
    priorG3Failure: validation.priorG3Failure,
    priorG4Failure: validation.priorG4Failure,
    priorG5Failure: validation.priorG5Failure,
    priorG6Failure: validation.priorG6Failure,
    administrativeAuthority: {
      mode: 'NEW_GENERATION_ACCEPTANCE_ONLY',
      authorityScope: 'ACCEPT_IMMUTABLE_G6_TERMINAL_EVIDENCE_AFTER_CORRECTED_STAGED_VERIFIER',
      appendOnly: true,
      resumesPriorAttempt: false,
      citations: authorityCitations(),
      priorFailuresPreserved: ['phase3cr2-c3tb-g2', 'phase3cr2-c3tb-g3', 'phase3cr2-c3tb-g4', 'phase3cr2-c3tb-g5', 'phase3cr2-c3tb-g6'],
      priorFailuresRewrittenAsPass: false,
      g6TerminalArtifactsPreserved: true,
      g6BytesModified: false,
    },
    rootCause: {
      phase: chain.priorG6Failure.phase,
      classification: chain.priorG6Failure.classification,
      classificationLabel: chain.priorG6Failure.classificationLabel,
      failure: chain.priorG6Failure.failure,
      cause: chain.priorG6Failure.cause,
      g6TerminalEvidenceComplete: true,
      g6StagedVerificationCompleted: false,
      acceptanceCommitCreatedInG6: false,
      correction: 'NEW_G7_APPEND_ONLY_ACCEPTANCE_GENERATION_WITH_DISJOINT_PREFINAL_AND_FINAL_INVENTORY_LOADERS',
    },
    executionCounts: zeroExecutionCounts(),
    campaignRerun: false,
    stages1Through8Rerun: false,
    stages2Through8Rerun: false,
    productChanges: false,
    commitCreatedByG7Tool: false,
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
      g6TerminalEvidenceAccepted: true,
      g6ToolFiles: 7,
      g6EvidenceFiles: 9,
      g6StagedVerificationCompleted: false,
      g6AcceptanceCommitCreated: false,
      containingCommitRequired: true,
      requiredSingleParent: C3TB,
      exactFinalPathCount: 1342,
      productTree: chain.productionTree,
      exactImmutableG4WhitespaceViolations: [...EXPECTED_G4_VIOLATIONS],
      additionalWhitespaceViolationsAllowed: false,
    },
    inputs: {
      validation: filePin(VALIDATION),
      recoveryPlan: filePin(PLAN),
      preExecutionSeal: filePin(PRE_SEAL),
      g6: Object.fromEntries(Object.entries(G6_ARTIFACTS).map(([key, relative]) => [key, filePin(relative)])),
      g6Tools,
      g6Evidence,
      g7Tools: tools,
    },
    outputs: { administrativeAcceptanceRecovery: OUTPUT },
    phase3DExecuted: false,
    push: false,
    tag: false,
  };
  assert.deepEqual(record.priorG6Failure, chain.priorG6Failure);
  assert.deepEqual(record.executionCounts, zeroExecutionCounts());
  for (const field of ['omitted', 'duplicates', 'mismatches', 'unresolved']) assert.equal(record.reconciliation[field], 0);
  return record;
}

function main() {
  const [mode, ...extra] = process.argv.slice(2);
  assert.equal(extra.length, 0);
  assert.ok(['--verify-source-only', '--verify-only', '--write'].includes(mode), 'Use --verify-source-only, --verify-only, or --write.');
  const chain = verifyRecoveryChain();
  assertExactInventory(G7_TOOL_RELATIVE, TOOL_NAMES, 'G7 tools');
  const tools = closureSnapshot(G7_TOOL_RELATIVE, true);
  assert.equal(tools.fileCount, 7);

  if (mode === '--verify-source-only') {
    assert.equal(fs.existsSync(absolute(G7_EVIDENCE_RELATIVE)), false, 'G7 evidence must be absent.');
    process.stdout.write(`${canonical({
      result: 'PASS_SOURCE_VERIFICATION',
      generation: GENERATION,
      g7Tools: { fileCount: tools.fileCount, digest: tools.digest },
      g6Evidence: { fileCount: chain.priorG6Failure.evidence.fileCount, digest: chain.priorG6Failure.evidence.digest },
      priorG6Failure: chain.priorG6Failure.classificationLabel,
      evidenceWritten: false,
      executionCounts: zeroExecutionCounts(),
    })}\n`);
    return;
  }

  assertExactInventory(G7_EVIDENCE_RELATIVE, SEALED_NAMES, 'G7 sealed evidence');
  assert.equal(fs.existsSync(absolute(OUTPUT)), false);
  const validation = readJson(VALIDATION);
  const plan = readJson(PLAN);
  const seal = readJson(PRE_SEAL);
  assertSealedInputs(validation, plan, seal, tools, chain);
  const record = buildRecord(validation, chain, tools);
  assert.deepEqual(closureSnapshot(G7_TOOL_RELATIVE, true), tools);
  assert.deepEqual(closureSnapshot(G6_TOOL_RELATIVE, true), chain.priorG6Failure.tools);
  assert.deepEqual(closureSnapshot(G6_EVIDENCE_RELATIVE, true), chain.priorG6Failure.evidence);

  if (mode === '--write') {
    writeJsonExclusive(OUTPUT, record);
    assertExactEofLf(OUTPUT);
    assertExactInventory(G7_EVIDENCE_RELATIVE, PREFINAL_NAMES, 'G7 prefinal evidence');
    assert.deepEqual(readJson(OUTPUT), record);
    process.stdout.write(`${canonical({ result: 'PASS_ACCEPTANCE_RECOVERY_WRITTEN', outcome: 'PHASE3CR2_ACCEPTANCE_RECOVERED_PENDING_FINALIZATION', output: filePin(OUTPUT), executionCounts: zeroExecutionCounts() })}\n`);
  } else {
    assertExactInventory(G7_EVIDENCE_RELATIVE, SEALED_NAMES, 'G7 verify-only evidence');
    process.stdout.write(`${canonical({ result: 'PASS_ACCEPTANCE_VERIFIED', outcome: 'PHASE3CR2_ACCEPTANCE_RECOVERY_READY', wouldWrite: OUTPUT, executionCounts: zeroExecutionCounts() })}\n`);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${canonical({
    result: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    failure: { name: error?.name ?? 'Error', code: error?.code ?? null, message: error?.message ?? String(error) },
    outputWritten: fs.existsSync(absolute(OUTPUT)),
  })}\n`);
  process.exitCode = 1;
}
