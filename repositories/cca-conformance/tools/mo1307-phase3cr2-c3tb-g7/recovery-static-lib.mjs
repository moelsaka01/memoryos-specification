// Read-only filesystem/Git verification shared by the G7 acceptance-only tools.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { deriveAuthoritativeBinding } from './binding-lib.mjs';
import {
  ACCEPTED_PHASE3BR2 as G6_ACCEPTED_PHASE3BR2,
  ACCEPTED_PHASE3BR2_TREE as G6_ACCEPTED_PHASE3BR2_TREE,
  BRANCH as G6_BRANCH,
  C3T as G6_C3T,
  C3TB as G6_C3TB,
  C3TB_TREE as G6_C3TB_TREE,
  CANDIDATE_RELATIVE as G6_CANDIDATE_RELATIVE,
  G2_EVIDENCE_RELATIVE as G6_G2_EVIDENCE_RELATIVE,
  G2_TOOL_RELATIVE as G6_G2_TOOL_RELATIVE,
  G2_VALIDATION_RELATIVE as G6_G2_VALIDATION_RELATIVE,
  G2_VALIDATION_ROOT_RELATIVE as G6_G2_VALIDATION_ROOT_RELATIVE,
  G3_EVIDENCE_RELATIVE as G6_G3_EVIDENCE_RELATIVE,
  G3_TOOL_RELATIVE as G6_G3_TOOL_RELATIVE,
  G4_EVIDENCE_RELATIVE as G6_G4_EVIDENCE_RELATIVE,
  G4_TOOL_RELATIVE as G6_G4_TOOL_RELATIVE,
  G5_ACCEPTANCE_ROOTS,
  G5_EVIDENCE_RELATIVE as G6_G5_EVIDENCE_RELATIVE,
  G5_TOOL_RELATIVE as G6_G5_TOOL_RELATIVE,
  G6_EVIDENCE_RELATIVE as PRIOR_G6_EVIDENCE_RELATIVE,
  G6_PLANNED_OUTPUTS as PRIOR_G6_PLANNED_OUTPUTS,
  G6_TOOL_RELATIVE as PRIOR_G6_TOOL_RELATIVE,
  GENERATION as PRIOR_G6_GENERATION_VALUE,
  HELPER_RELATIVE as G6_HELPER_RELATIVE,
  ORIGINAL_EVIDENCE_RELATIVE as G6_ORIGINAL_EVIDENCE_RELATIVE,
  ORIGINAL_TOOL_RELATIVE as G6_ORIGINAL_TOOL_RELATIVE,
  PRODUCT_RELATIVE as G6_PRODUCT_RELATIVE,
  ROOT as G6_ROOT,
  assertStaticRuntimeAndRepository as assertG6StaticRuntimeAndRepository,
  canonical,
  canonicalBytes,
  closureSnapshot,
  fileRecord,
  gitText,
  readJson,
  readRegularBytes,
  runGit,
  sha256,
  verifyRecoveryChain as verifyG6SourceChain,
  zeroExecutionCounts,
} from '../mo1307-phase3cr2-c3tb-g6/recovery-static-lib.mjs';

export const ROOT = G6_ROOT;
export const BRANCH = G6_BRANCH;
export const C3TB = G6_C3TB;
export const C3T = G6_C3T;
export const C3TB_TREE = G6_C3TB_TREE;
export const ACCEPTED_PHASE3BR2 = G6_ACCEPTED_PHASE3BR2;
export const ACCEPTED_PHASE3BR2_TREE = G6_ACCEPTED_PHASE3BR2_TREE;
export const PRODUCT_RELATIVE = G6_PRODUCT_RELATIVE;
export const HELPER_RELATIVE = G6_HELPER_RELATIVE;
export const CANDIDATE_RELATIVE = G6_CANDIDATE_RELATIVE;
export const ORIGINAL_TOOL_RELATIVE = G6_ORIGINAL_TOOL_RELATIVE;
export const ORIGINAL_EVIDENCE_RELATIVE = G6_ORIGINAL_EVIDENCE_RELATIVE;
export const G2_TOOL_RELATIVE = G6_G2_TOOL_RELATIVE;
export const G2_EVIDENCE_RELATIVE = G6_G2_EVIDENCE_RELATIVE;
export const G2_VALIDATION_ROOT_RELATIVE = G6_G2_VALIDATION_ROOT_RELATIVE;
export const G2_VALIDATION_RELATIVE = G6_G2_VALIDATION_RELATIVE;
export const G3_TOOL_RELATIVE = G6_G3_TOOL_RELATIVE;
export const G3_EVIDENCE_RELATIVE = G6_G3_EVIDENCE_RELATIVE;
export const G4_TOOL_RELATIVE = G6_G4_TOOL_RELATIVE;
export const G4_EVIDENCE_RELATIVE = G6_G4_EVIDENCE_RELATIVE;
export const G5_TOOL_RELATIVE = G6_G5_TOOL_RELATIVE;
export const G5_EVIDENCE_RELATIVE = G6_G5_EVIDENCE_RELATIVE;
export const G6_TOOL_RELATIVE = PRIOR_G6_TOOL_RELATIVE;
export const G6_EVIDENCE_RELATIVE = PRIOR_G6_EVIDENCE_RELATIVE;
export const G7_TOOL_RELATIVE = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g7';
export const G7_EVIDENCE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g7';

export const GENERATION = Object.freeze({
  id: 'phase3cr2-c3tb-g7',
  ordinal: 7,
  mode: 'ACCEPTANCE_ONLY_FROM_IMMUTABLE_G6_AFTER_FAILED_STAGED_VERIFICATION',
  resumesPriorAttempt: false,
  sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
  priorRecoveryGeneration: 'phase3cr2-c3tb-g6',
});
export const PRIOR_G6_GENERATION = Object.freeze({ ...PRIOR_G6_GENERATION_VALUE });

export const G7_PLANNED_OUTPUTS = Object.freeze([
  `${G7_EVIDENCE_RELATIVE}/zero-execution-validation.json`,
  `${G7_EVIDENCE_RELATIVE}/recovery-plan.json`,
  `${G7_EVIDENCE_RELATIVE}/pre-execution-seal.json`,
  `${G7_EVIDENCE_RELATIVE}/administrative-acceptance-recovery.json`,
  `${G7_EVIDENCE_RELATIVE}/certification-receipt.json`,
  `${G7_EVIDENCE_RELATIVE}/final-validation.json`,
  `${G7_EVIDENCE_RELATIVE}/phase3d-handoff.json`,
  `${G7_EVIDENCE_RELATIVE}/evidence-manifest.json`,
  `${G7_EVIDENCE_RELATIVE}/final-seal.json`,
]);
export const G6_ACCEPTANCE_ROOTS = Object.freeze([
  ...G5_ACCEPTANCE_ROOTS,
  G6_TOOL_RELATIVE,
  G6_EVIDENCE_RELATIVE,
]);

export const EXPECTED_G4_VIOLATIONS = Object.freeze([
  Object.freeze({
    path: `${G4_TOOL_RELATIVE}/binding-lib.mjs`,
    line: 271,
    message: 'new blank line at EOF.',
    tailHex: '207d293b0a7d0a0a',
  }),
  Object.freeze({
    path: `${G4_TOOL_RELATIVE}/recovery-static-lib.mjs`,
    line: 551,
    message: 'new blank line at EOF.',
    tailHex: '207d293b0a7d0a0a',
  }),
]);

const G6_TOOL_COUNT = 7;
const G6_TOOL_DIGEST = 'sha256:bd2276695ac4b09c9a66484a5ba293dfd4c6ff70267baf29e6a7b98f1a78cc7d';
const G6_EVIDENCE_COUNT = 9;
const G6_EVIDENCE_DIGEST = 'sha256:1304d2fe31026440e29047c2f945ad94369a80f51c8dcee86f30314617e0ca68';
const G6_TOOL_NAMES = Object.freeze([
  'accept.mjs',
  'binding-lib.mjs',
  'finalize.mjs',
  'preflight.mjs',
  'README.md',
  'recovery-static-lib.mjs',
  'validate-recovery.mjs',
]);
const G6_EVIDENCE_NAMES = Object.freeze([
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
const G6_PREFINAL_NAMES = Object.freeze([
  'administrative-acceptance-recovery.json',
  'pre-execution-seal.json',
  'recovery-plan.json',
  'zero-execution-validation.json',
]);
const G6_PATHS = Object.freeze({
  validation: `${G6_EVIDENCE_RELATIVE}/zero-execution-validation.json`,
  plan: `${G6_EVIDENCE_RELATIVE}/recovery-plan.json`,
  seal: `${G6_EVIDENCE_RELATIVE}/pre-execution-seal.json`,
  administrative: `${G6_EVIDENCE_RELATIVE}/administrative-acceptance-recovery.json`,
  receipt: `${G6_EVIDENCE_RELATIVE}/certification-receipt.json`,
  finalValidation: `${G6_EVIDENCE_RELATIVE}/final-validation.json`,
  handoff: `${G6_EVIDENCE_RELATIVE}/phase3d-handoff.json`,
  manifest: `${G6_EVIDENCE_RELATIVE}/evidence-manifest.json`,
  finalSeal: `${G6_EVIDENCE_RELATIVE}/final-seal.json`,
  finalizer: `${G6_TOOL_RELATIVE}/finalize.mjs`,
});
const slash = value => value.replaceAll('\\', '/');
const fileOrder = (left, right) => left.localeCompare(right, 'en');

export {
  canonical,
  canonicalBytes,
  closureSnapshot,
  deriveAuthoritativeBinding,
  fileRecord,
  gitText,
  readJson,
  readRegularBytes,
  runGit,
  sha256,
  zeroExecutionCounts,
};

function absolute(relative) {
  const resolved = path.resolve(ROOT, relative);
  const prefix = path.resolve(ROOT) + path.sep;
  assert.ok(resolved.startsWith(prefix), `Path escapes worktree: ${relative}`);
  return resolved;
}

function assertExactFlatRegularFiles(relativeRoot, expectedNames, label) {
  const directory = absolute(relativeRoot);
  assert.equal(fs.lstatSync(directory).isDirectory(), true, `${label}: directory`);
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    assert.equal(entry.isSymbolicLink(), false, `${label}: symlink ${entry.name}`);
    assert.equal(entry.isFile(), true, `${label}: regular file ${entry.name}`);
  }
  assert.deepEqual(entries.map(entry => entry.name).sort(fileOrder), [...expectedNames].sort(fileOrder), `${label}: exact inventory`);
}

function assertGeneration(record, label) {
  assert.deepEqual(record.generation, PRIOR_G6_GENERATION, `${label}: exact G6 generation`);
}

function assertPin(pin) {
  assert.deepEqual(pin, fileRecord(pin.path), `Artifact pin changed: ${pin.path}`);
}

function assertZero(actual, label) {
  assert.deepEqual(actual, zeroExecutionCounts(), `${label}: zero executions`);
}

function loadG6Artifacts() {
  return Object.fromEntries(Object.entries(G6_PATHS)
    .filter(([key]) => !['finalizer'].includes(key))
    .map(([key, relative]) => [key, readJson(relative)]));
}

function assertG6Artifacts(artifacts, sourceChain, tools, evidence) {
  const { validation, plan, seal, administrative, receipt, finalValidation, handoff, manifest, finalSeal } = artifacts;
  for (const [label, record] of Object.entries(artifacts)) {
    assert.equal(record.version, '1.0.0', `${label}: version`);
    assertGeneration(record, label);
    assert.deepEqual(record.authoritativeBinding, sourceChain.authoritativeBinding, `${label}: binding`);
  }

  assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG6ZeroExecutionValidation');
  assert.equal(validation.result, 'PASS');
  assert.equal(validation.productionTree, sourceChain.productionTree);
  assert.deepEqual(validation.sourceG2, sourceChain.source.sourceG2);
  assert.deepEqual(validation.priorG3Failure, sourceChain.priorG3Failure);
  assert.deepEqual(validation.priorG4Failure, sourceChain.priorG4Failure);
  assert.deepEqual(validation.priorG5Failure, sourceChain.priorG5Failure);
  assertZero(validation.executionCounts, 'G6 validation');

  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBG6RecoveryPlan');
  assert.equal(plan.status, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assert.equal(plan.finalizedToolInputCount, G6_TOOL_COUNT);
  assert.equal(plan.finalizedToolSetDigest, G6_TOOL_DIGEST);
  assert.deepEqual(plan.finalizedToolInputs, tools.files);
  assert.deepEqual(plan.outputs, PRIOR_G6_PLANNED_OUTPUTS);
  assert.deepEqual(plan.validation, fileRecord(G6_PATHS.validation));
  assertZero(plan.executionPolicy.executionsBeforeSeal, 'G6 plan');

  assert.equal(seal.kind, 'MO1307Phase3CR2C3TBG6PreExecutionSeal');
  assert.equal(seal.result, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assert.deepEqual(seal.recoveryPlan, fileRecord(G6_PATHS.plan));
  assert.deepEqual(seal.validation, fileRecord(G6_PATHS.validation));
  assert.equal(seal.finalizedToolInputCount, G6_TOOL_COUNT);
  assert.equal(seal.finalizedToolSetDigest, G6_TOOL_DIGEST);
  assert.deepEqual(seal.finalizedToolInputs, tools.files);
  assert.deepEqual(seal.executionPolicy, plan.executionPolicy);
  assertZero(seal.executionCounts, 'G6 seal');
  assert.equal(seal.appendOnly, true);

  assert.equal(administrative.kind, 'MO1307Phase3CR2C3TBG6AdministrativeAcceptanceRecovery');
  assert.equal(administrative.result, 'PASS');
  assert.equal(administrative.outcome, 'ACCEPTANCE_RECOVERY_COMPLETE');
  assert.deepEqual(administrative.sourceG2, sourceChain.source.sourceG2);
  assert.deepEqual(administrative.priorG3Failure, sourceChain.priorG3Failure);
  assert.deepEqual(administrative.priorG4Failure, sourceChain.priorG4Failure);
  assert.deepEqual(administrative.priorG5Failure, sourceChain.priorG5Failure);
  assert.deepEqual(administrative.reconciliation, {
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
  assertZero(administrative.executionCounts, 'G6 administrative recovery');
  assert.equal(administrative.productChanges, false);
  assert.equal(administrative.phase3DExecuted, false);

  assert.equal(receipt.kind, 'MO1307Phase3CR2C3TBG6CertificationReceipt');
  assert.equal(receipt.result, 'PASS_ACCEPTANCE_READY');
  assert.equal(receipt.phase3CR2, 'ACCEPTANCE_PENDING_CONTAINING_COMMIT');
  assert.equal(receipt.status, 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT');
  assert.equal(receipt.outcome, 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT');
  assert.deepEqual(receipt.controls, {
    freshExecutedInG6: 0,
    freshAcceptedFromG4: 89,
    reusedExactAcceptedFromG4: 462,
    candidateSpecificAcceptedFromG4: 2,
    sourceSecurityReviewsAcceptedFromG4: 12,
    backedByExecutionGeneration: 'phase3cr2-c3tb-g2',
    totalHistoricalInventory: 551,
    unresolved: 0,
    omissions: 0,
    duplicateIds: 0,
    overlaps: 0,
    mismatches: 0,
  });
  assertZero(receipt.executionCounts, 'G6 receipt');
  assert.equal(receipt.containingCommit.state, 'PENDING_VERIFICATION');
  assert.equal(receipt.containingCommit.exactPathCount, 1326);
  assert.deepEqual(receipt.containingCommit.fullWhitespaceCheck.exactImmutableG4Violations, EXPECTED_G4_VIOLATIONS);

  assert.equal(finalValidation.kind, 'MO1307Phase3CR2C3TBG6FinalValidation');
  assert.equal(finalValidation.result, 'PASS_ACCEPTANCE_SUPPORTED');
  assert.equal(finalValidation.outcome, 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT');
  assert.equal(finalValidation.checks.fresh.actual, 89);
  assert.equal(finalValidation.checks.reuse.actual, 462);
  assert.equal(finalValidation.checks.candidateSpecific.actual, 2);
  assert.equal(finalValidation.checks.reviews.actual, 12);
  for (const field of ['unresolved', 'omissions', 'duplicateIds', 'overlaps', 'mismatches']) assert.equal(finalValidation.checks[field], 0);
  assert.equal(finalValidation.checks.containingCommitVerified, false);
  assertZero(finalValidation.executionCounts, 'G6 final validation');

  assert.equal(handoff.kind, 'MO1307Phase3CR2C3TBG6Phase3DHandoff');
  assert.equal(handoff.result, 'READY_AFTER_CONTAINING_COMMIT_VERIFICATION_NOT_EXECUTED');
  assert.equal(handoff.phase3CR2, 'ACCEPTANCE_PENDING_CONTAINING_COMMIT');
  assert.equal(handoff.phase3DExecuted, false);
  assert.equal(handoff.phase3DExecutionAuthorized, false);
  assertZero(handoff.executionCounts, 'G6 handoff');

  assert.equal(manifest.kind, 'MO1307Phase3CR2C3TBG6EvidenceManifest');
  assert.equal(manifest.result, 'PASS_ACCEPTANCE_READY');
  assert.equal(manifest.phase3CR2, 'ACCEPTANCE_PENDING_CONTAINING_COMMIT');
  assert.equal(manifest.memberCount, 14);
  assert.equal(manifest.members.length, 14);
  assert.deepEqual(manifest.excludes, [G6_PATHS.manifest, G6_PATHS.finalSeal]);
  for (const record of manifest.members) assert.deepEqual(record, fileRecord(record.path, true), `G6 manifest member changed: ${record.path}`);
  assertZero(manifest.executionCounts, 'G6 manifest');

  assert.equal(finalSeal.kind, 'MO1307Phase3CR2C3TBG6FinalSeal');
  assert.equal(finalSeal.result, 'PASS_ACCEPTANCE_READY');
  assert.equal(finalSeal.phase3CR2, 'ACCEPTANCE_PENDING_CONTAINING_COMMIT');
  assert.equal(finalSeal.phase3DExecuted, false);
  assert.equal(finalSeal.push, false);
  assert.equal(finalSeal.tag, false);
  assertZero(finalSeal.executionCounts, 'G6 final seal');
  for (const [key, relative] of [
    ['zeroExecutionValidation', G6_PATHS.validation],
    ['recoveryPlan', G6_PATHS.plan],
    ['preExecutionSeal', G6_PATHS.seal],
    ['administrativeAcceptanceRecovery', G6_PATHS.administrative],
    ['receipt', G6_PATHS.receipt],
    ['finalValidation', G6_PATHS.finalValidation],
    ['phase3DHandoff', G6_PATHS.handoff],
    ['manifest', G6_PATHS.manifest],
  ]) assert.deepEqual(finalSeal[key], fileRecord(relative), `G6 final seal pin: ${key}`);
  assert.deepEqual(finalSeal.immutableG2, {
    tools: sourceChain.source.sourceG2.tools,
    evidence: sourceChain.source.sourceG2.evidence,
    ledger: sourceChain.source.sourceG2.ledger.record,
    outcome: 'PHASE3CR2_FAILED_INCOMPLETE',
  });

  assert.equal(tools.fileCount, G6_TOOL_COUNT);
  assert.equal(evidence.fileCount, G6_EVIDENCE_COUNT);
}

function acceptanceRootClosure() {
  const files = G6_ACCEPTANCE_ROOTS.flatMap(root => closureSnapshot(root, true).files);
  const paths = files.map(record => record.path).sort(fileOrder);
  assert.equal(new Set(paths).size, paths.length, 'G6 acceptance path union must be duplicate-free.');
  assert.equal(paths.length, 1326, 'G6 acceptance path union count');
  return { roots: [...G6_ACCEPTANCE_ROOTS], fileCount: paths.length, files, paths };
}

function assertPriorStagedUnion(acceptance) {
  const names = runGit(['diff', '--cached', '--name-only', '-z', C3TB]).stdout
    .toString('utf8').split('\0').filter(Boolean).map(slash).sort(fileOrder);
  assert.deepEqual(names, acceptance.paths, 'Exact prior G6 staged path union');
  const statuses = runGit(['diff', '--cached', '--name-status', C3TB]).stdout.toString('utf8')
    .split(/\r?\n/u).filter(Boolean);
  assert.equal(statuses.length, acceptance.fileCount);
  assert.equal(statuses.every(line => line.startsWith('A\t')), true, 'Every prior G6 staged path must be A-only.');
  assert.equal(gitText(['diff', '--cached', '--name-only', '--', PRODUCT_RELATIVE]), '');
  assert.equal(gitText(['diff', '--name-only']), '');
}

function assertKnownWhitespaceOnly() {
  for (const violation of EXPECTED_G4_VIOLATIONS) {
    const bytes = readRegularBytes(violation.path);
    assert.equal(bytes.subarray(-8).toString('hex'), violation.tailHex);
    assert.equal(bytes.toString('utf8').split(/\r?\n/u)[violation.line - 1], '');
  }
  const result = runGit(['diff', '--cached', '--check'], { allowFailure: true });
  assert.equal(result.status, 2, 'Full staged whitespace check must contain only the two immutable G4 violations.');
  assert.equal(result.stderr.toString('utf8'), '');
  const actual = result.stdout.toString('utf8').replaceAll('\r', '').trimEnd().split('\n');
  const expected = EXPECTED_G4_VIOLATIONS.map(item => `${item.path}:${item.line}: ${item.message}`);
  assert.deepEqual(actual, expected);
  const clean = runGit([
    'diff', '--cached', '--check', '--',
    G5_TOOL_RELATIVE, G5_EVIDENCE_RELATIVE, G6_TOOL_RELATIVE, G6_EVIDENCE_RELATIVE,
  ], { allowFailure: true });
  assert.equal(clean.status, 0, 'G5 and G6 must be whitespace-clean.');
  assert.equal(clean.stdout.toString('utf8'), '');
  assert.equal(clean.stderr.toString('utf8'), '');
}

function reproduceG6InventoryFailure() {
  const lines = readRegularBytes(G6_PATHS.finalizer).toString('utf8').split(/\r?\n/u);
  const assertion = "assertExactInventory(G6_EVIDENCE, PREFINAL_OUTPUTS, 'G6 prefinal evidence');";
  const inventoryAssertion = "assert.deepEqual(entries.map(entry => `${root}/${entry.name}`).sort(fileOrder), [...expectedPaths].sort(fileOrder), `${label}: exact inventory`);";
  const terminalCall = 'const inputs = loadPrefinal(runtime, staticChain);';
  const entryCall = 'const artifacts = loadFinal(runtime, staticChain);';
  assert.equal(lines[316].trim(), inventoryAssertion);
  assert.equal(lines[548].trim(), assertion);
  assert.equal(lines[953].trim(), terminalCall);
  assert.equal(lines[1001].trim(), entryCall);
  const terminalInventory = fs.readdirSync(absolute(G6_EVIDENCE_RELATIVE)).sort(fileOrder);
  assert.deepEqual(terminalInventory, [...G6_EVIDENCE_NAMES].sort(fileOrder));
  let failure = null;
  try {
    assert.deepEqual(terminalInventory, [...G6_PREFINAL_NAMES].sort(fileOrder));
  } catch (error) {
    failure = { name: error?.name ?? null, code: error?.code ?? null };
  }
  assert.deepEqual(failure, { name: 'AssertionError', code: 'ERR_ASSERTION' });
  return {
    assertion,
    inventoryAssertion,
    terminalCall,
    entryCall,
    terminalInventory,
    unexpectedTerminalFiles: terminalInventory.filter(name => !G6_PREFINAL_NAMES.includes(name)),
  };
}

export function assertStaticRuntimeAndRepository() {
  const runtime = assertG6StaticRuntimeAndRepository();
  assert.equal(gitText(['branch', '--show-current']), BRANCH);
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB, 'No acceptance commit may exist before G7 completion.');
  assert.equal(gitText(['ls-tree', '-r', '--name-only', 'HEAD', '--', G7_TOOL_RELATIVE, G7_EVIDENCE_RELATIVE]), '');
  return runtime;
}

export function verifyPriorG6(sourceChain = verifyG6SourceChain(), options = {}) {
  const requirePriorStagedUnion = options.requirePriorStagedUnion !== false;
  assertExactFlatRegularFiles(G6_TOOL_RELATIVE, G6_TOOL_NAMES, 'immutable G6 tool namespace');
  assertExactFlatRegularFiles(G6_EVIDENCE_RELATIVE, G6_EVIDENCE_NAMES, 'immutable G6 evidence namespace');
  const tools = closureSnapshot(G6_TOOL_RELATIVE, true);
  const evidence = closureSnapshot(G6_EVIDENCE_RELATIVE, true);
  assert.equal(tools.fileCount, G6_TOOL_COUNT);
  assert.equal(tools.digest, G6_TOOL_DIGEST);
  assert.equal(evidence.fileCount, G6_EVIDENCE_COUNT);
  assert.equal(evidence.digest, G6_EVIDENCE_DIGEST);
  assert.deepEqual(tools.files.map(record => path.basename(record.path)), G6_TOOL_NAMES);
  assert.deepEqual(evidence.files.map(record => path.basename(record.path)), G6_EVIDENCE_NAMES);
  const artifacts = loadG6Artifacts();
  assertG6Artifacts(artifacts, sourceChain, tools, evidence);
  const reproduced = reproduceG6InventoryFailure();
  const acceptance = acceptanceRootClosure();
  if (requirePriorStagedUnion) {
    assertPriorStagedUnion(acceptance);
    assertKnownWhitespaceOnly();
  }
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);

  return {
    generation: { ...PRIOR_G6_GENERATION },
    result: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    phase: 'STAGED_ACCEPTANCE_VERIFICATION',
    classification: ['OTHER_CONCRETE_RECONCILIATION_DEFECT'],
    classificationLabel: 'OTHER_CONCRETE_RECONCILIATION_DEFECT/FINAL_LOADER_REUSES_PREFINAL_INVENTORY_ASSERTION',
    failure: {
      code: 'ERR_ASSERTION',
      path: G6_PATHS.finalizer,
      entryPoint: { line: 1002, source: reproduced.entryCall },
      terminalLoader: { line: 954, source: reproduced.terminalCall },
      prefinalCall: { line: 549, source: reproduced.assertion },
      rejectedAssertion: { line: 317, source: reproduced.inventoryAssertion },
    },
    cause: {
      invokedMode: '--verify-staged',
      callChain: ['verifyStaged', 'loadFinal', 'loadPrefinal', 'assertExactInventory'],
      correctTerminalInventoryCount: 9,
      incorrectExpectedPrefinalInventoryCount: 4,
      correctTerminalInventory: reproduced.terminalInventory,
      incorrectPrefinalInventory: [...G6_PREFINAL_NAMES].sort(fileOrder),
      unexpectedTerminalFiles: reproduced.unexpectedTerminalFiles,
      terminalEvidenceIsCorrect: true,
      correction: 'SEPARATE_PREFINAL_AND_FINAL_LOADERS_WITHOUT_REENTERING_PREFINAL_INVENTORY_ASSERTION',
    },
    outputsWritten: {
      zeroExecutionValidation: true,
      recoveryPlan: true,
      preExecutionSeal: true,
      administrativeAcceptanceRecovery: true,
      certificationReceipt: true,
      finalValidation: true,
      phase3DHandoff: true,
      evidenceManifest: true,
      finalSeal: true,
    },
    terminalEvidenceComplete: true,
    stagedVerificationCompleted: false,
    acceptanceCommitCreated: false,
    stagedState: {
      exactG6AcceptancePathUnion: true,
      pathCount: acceptance.fileCount,
      allPathsAOnly: true,
      productPathsAbsent: true,
      unstagedTrackedChangesAbsent: true,
      exactImmutableG4WhitespaceViolations: [...EXPECTED_G4_VIOLATIONS],
      additionalWhitespaceViolations: 0,
    },
    tools,
    evidence,
    artifacts: Object.fromEntries(Object.entries(G6_PATHS)
      .filter(([key]) => !['finalizer'].includes(key))
      .map(([key, relative]) => [key, fileRecord(relative)])),
    sourceIntegrity: {
      mechanicallyReproduced: true,
      sourceLinesExact: true,
      terminalEvidenceExact: true,
      stagedUnionExactAtFailure: true,
      onlyKnownWhitespaceViolations: true,
    },
  };
}

export function verifyRecoveryChain(options = {}) {
  const runtime = assertStaticRuntimeAndRepository();
  const sourceChain = verifyG6SourceChain();
  const priorG6Failure = verifyPriorG6(sourceChain, options);
  assert.equal(sourceChain.authoritativeBinding.production.tree, runtime.productionTree);
  assert.equal(priorG6Failure.tools.fileCount, 7);
  assert.equal(priorG6Failure.evidence.fileCount, 9);
  assert.equal(priorG6Failure.acceptanceCommitCreated, false);
  return {
    runtime,
    source: sourceChain.source,
    priorG3Failure: sourceChain.priorG3Failure,
    priorG4Failure: sourceChain.priorG4Failure,
    priorG5Failure: sourceChain.priorG5Failure,
    priorG6Failure,
    authoritativeBinding: sourceChain.authoritativeBinding,
    productionTree: sourceChain.productionTree,
  };
}

export function writeJsonExclusive(relative, value) {
  fs.writeFileSync(path.join(ROOT, relative), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}
