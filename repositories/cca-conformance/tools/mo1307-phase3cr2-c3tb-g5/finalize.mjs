// Append-only Phase 3CR2 G5 acceptance-only finalizer.
//
// This program consumes immutable G2 execution evidence, the immutable G3
// reconciliation failure, the immutable G4 reconciliation artifacts, and the
// exact G4 staged-verification blocker. It never launches a product, helper,
// worker, native control, security control, certification stage, or network
// operation.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  ROOT,
  BRANCH,
  C3TB,
  C3T,
  PRODUCT_RELATIVE,
  G2_TOOL_RELATIVE,
  G2_EVIDENCE_RELATIVE,
  G2_VALIDATION_ROOT_RELATIVE,
  G3_TOOL_RELATIVE,
  G3_EVIDENCE_RELATIVE,
  G4_TOOL_RELATIVE,
  G4_EVIDENCE_RELATIVE,
  G5_TOOL_RELATIVE,
  G5_EVIDENCE_RELATIVE,
  GENERATION,
  PRIOR_G4_GENERATION,
  G5_PLANNED_OUTPUTS,
  zeroExecutionCounts,
  canonical,
  canonicalBytes,
  sha256,
  readRegularBytes,
  readJson,
  fileRecord,
  closureSnapshot,
} from './recovery-static-lib.mjs';

const GIT = 'C:/Program Files/Git/cmd/git.exe';
const EXPECTED_GIT_VERSION = 'git version 2.55.0.windows.3';
const EXPECTED_NODE = Object.freeze({
  version: 'v24.21.0',
  platform: 'win32',
  arch: 'x64',
  byteLength: 93580104,
  sha256: 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32',
});
const EXPECTED_NODE_PATH = path.join(ROOT, '.cache/mo1307-phase3cr2-runtime/node.exe');

const C3T_PARENT = '79ef47e608c67edc70f3e9f51d494b169794f903';
const C3T_TREE = 'd21f46bc31ccd7a9f80a5e494b3d09116d125522';
const C3TB_TREE = '5e0088965d4eac4002165fe0190f275c257985ba';
const HELPER_SHA256 = 'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127';
const HELPER_BLOB = '7ca55b8713108465099ecfce9796e06e3db67bd2';
const ACCEPTED_PHASE3BR2 = '4d92f0f21c9c3aad8202f4558d61b9229c7214fc';
const ACCEPTED_PHASE3BR2_TREE = '7d07f5f570248f8159339ae33637194937cf4918';

const HELPER = `${PRODUCT_RELATIVE}/helpers/windows-inspect.ps1`;
const CANDIDATE_AUTHORITY = 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate';
const BINDING = `${CANDIDATE_AUTHORITY}/binding.json`;
const BINDING_VERIFICATION = `${CANDIDATE_AUTHORITY}/binding-verification.json`;
const CANDIDATE_RECORD = `${CANDIDATE_AUTHORITY}/candidate.json`;

const ORIGINAL_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb';
const ORIGINAL_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb';
const G2_VALIDATION_ROOT = G2_VALIDATION_ROOT_RELATIVE;
const G2_VALIDATION_FILE = `${G2_VALIDATION_ROOT}/validation.json`;
const G2_PLAN = `${G2_EVIDENCE_RELATIVE}/campaign-plan.json`;
const G2_SEAL = `${G2_EVIDENCE_RELATIVE}/pre-execution-seal.json`;
const G2_LEDGER = `${G2_EVIDENCE_RELATIVE}/execution-ledger.json`;
const G2_REUSE = `${G2_EVIDENCE_RELATIVE}/dependency-reuse.json`;

const G3_VALIDATION = `${G3_EVIDENCE_RELATIVE}/zero-execution-validation.json`;
const G3_PLAN = `${G3_EVIDENCE_RELATIVE}/recovery-plan.json`;
const G3_SEAL = `${G3_EVIDENCE_RELATIVE}/pre-execution-seal.json`;
const G3_ABSENT_OUTPUTS = Object.freeze([
  `${G3_EVIDENCE_RELATIVE}/fresh-control-results.json`,
  `${G3_EVIDENCE_RELATIVE}/candidate-specific-controls.json`,
  `${G3_EVIDENCE_RELATIVE}/source-security-reviews.json`,
  `${G3_EVIDENCE_RELATIVE}/administrative-recovery.json`,
]);

const G4_VALIDATION = `${G4_EVIDENCE_RELATIVE}/zero-execution-validation.json`;
const G4_PLAN = `${G4_EVIDENCE_RELATIVE}/recovery-plan.json`;
const G4_SEAL = `${G4_EVIDENCE_RELATIVE}/pre-execution-seal.json`;
const G4_ADMINISTRATIVE = `${G4_EVIDENCE_RELATIVE}/administrative-recovery.json`;
const G4_FRESH = `${G4_EVIDENCE_RELATIVE}/fresh-control-results.json`;
const G4_CANDIDATE = `${G4_EVIDENCE_RELATIVE}/candidate-specific-controls.json`;
const G4_REVIEWS = `${G4_EVIDENCE_RELATIVE}/source-security-reviews.json`;
const G4_RECEIPT = `${G4_EVIDENCE_RELATIVE}/certification-receipt.json`;
const G4_FINAL_VALIDATION = `${G4_EVIDENCE_RELATIVE}/final-validation.json`;
const G4_HANDOFF = `${G4_EVIDENCE_RELATIVE}/phase3d-handoff.json`;
const G4_MANIFEST = `${G4_EVIDENCE_RELATIVE}/evidence-manifest.json`;
const G4_FINAL_SEAL = `${G4_EVIDENCE_RELATIVE}/final-seal.json`;
const G4_FILES = Object.freeze([
  G4_ADMINISTRATIVE,
  G4_CANDIDATE,
  G4_RECEIPT,
  G4_MANIFEST,
  G4_FINAL_SEAL,
  G4_FINAL_VALIDATION,
  G4_FRESH,
  G4_HANDOFF,
  G4_SEAL,
  G4_PLAN,
  G4_REVIEWS,
  G4_VALIDATION,
]);

const VALIDATION = `${G5_EVIDENCE_RELATIVE}/zero-execution-validation.json`;
const PLAN = `${G5_EVIDENCE_RELATIVE}/recovery-plan.json`;
const PRE_SEAL = `${G5_EVIDENCE_RELATIVE}/pre-execution-seal.json`;
const ADMINISTRATIVE_ACCEPTANCE = `${G5_EVIDENCE_RELATIVE}/administrative-acceptance-recovery.json`;
const RECEIPT = `${G5_EVIDENCE_RELATIVE}/certification-receipt.json`;
const FINAL_VALIDATION = `${G5_EVIDENCE_RELATIVE}/final-validation.json`;
const HANDOFF = `${G5_EVIDENCE_RELATIVE}/phase3d-handoff.json`;
const MANIFEST = `${G5_EVIDENCE_RELATIVE}/evidence-manifest.json`;
const FINAL_SEAL = `${G5_EVIDENCE_RELATIVE}/final-seal.json`;
const PREFINAL_OUTPUTS = Object.freeze([VALIDATION, PLAN, PRE_SEAL, ADMINISTRATIVE_ACCEPTANCE]);
const FINAL_OUTPUTS = Object.freeze([RECEIPT, FINAL_VALIDATION, HANDOFF, MANIFEST, FINAL_SEAL]);
const FINAL_EVIDENCE_FILES = Object.freeze([...PREFINAL_OUTPUTS, ...FINAL_OUTPUTS]);

const G3_GENERATION = Object.freeze({
  id: 'phase3cr2-c3tb-g3',
  ordinal: 3,
  mode: 'RECONCILIATION_ONLY_FROM_IMMUTABLE_G2',
  resumesPriorAttempt: false,
  sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
});

const ZERO_EXECUTIONS = Object.freeze(zeroExecutionCounts());
const EXPECTED_STAGES = Object.freeze([
  'DEPENDENCY_REUSE_PROOF_462',
  'HEADLESS_SMOKE',
  'HEADLESS_SECURITY_A_TO_S_19',
  'DEADLINE_CLEANUP_SELECTED_7',
  'EQUIVALENCE_SELECTED_67',
  'NATIVE_LAST_ERROR_METADATA',
  'PROTOCOL_SELECTED_12',
  'TOCTOU_BOUNDARIES_SELECTED_2',
  'CASE_SENSITIVE_RECONCILIATION',
]);

const ORIGINAL_TOOL_DIGEST = 'sha256:9abb9d879a5b29724b42a8efa31f66579d104c336ef4ed2f2e304a77ff7c1e19';
const ORIGINAL_EVIDENCE_DIGEST = 'sha256:2ce1063de146fb4c1bb153175271ff19e0a6db5d9d759abe0e137e4b00b8224f';
const G2_TOOL_DIGEST = 'sha256:338da32c0b9c500bf19adaa9d7c5adb5fda8be0646ffb9319eff8a6de5c1a646';
const G2_EVIDENCE_DIGEST = 'sha256:eca2a9b239253173e76e40e13f9d4614b5039b226215760042a64677695e4416';
const G3_TOOL_DIGEST = 'sha256:cb80849ddec5df31f314f51fc397140f82452ada1e83da495caa630f5263527d';
const G3_EVIDENCE_DIGEST = 'sha256:66e59061edace9359f18d796511cc2c25791ce972a87f779f89321a9329ebe87';
const G4_TOOL_DIGEST = 'sha256:5345190df10de4554df711051b41063cc2b479de3a00e16dd4013e757f1e51aa';
const G4_EVIDENCE_DIGEST = 'sha256:285b34e2d82af75ae683d426e88f4f22d3e39d454f04d6946a65d4caea14deca';

const ACCEPTANCE_ROOTS = Object.freeze([
  ORIGINAL_TOOL,
  ORIGINAL_EVIDENCE,
  G2_VALIDATION_ROOT,
  G2_TOOL_RELATIVE,
  G2_EVIDENCE_RELATIVE,
  G3_TOOL_RELATIVE,
  G3_EVIDENCE_RELATIVE,
  G4_TOOL_RELATIVE,
  G4_EVIDENCE_RELATIVE,
  G5_TOOL_RELATIVE,
  G5_EVIDENCE_RELATIVE,
]);
const PRIOR_G4_ACCEPTANCE_ROOTS = Object.freeze(ACCEPTANCE_ROOTS.slice(0, 9));

const KNOWN_G4_WHITESPACE_VIOLATIONS = Object.freeze([
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

const slash = value => value.replaceAll('\\', '/');
const fileOrder = (left, right) => left.localeCompare(right, 'en');
const gitBlob = data => crypto.createHash('sha1')
  .update(Buffer.from(`blob ${data.length}\0`))
  .update(data)
  .digest('hex');

function absolute(relative) {
  const resolved = path.resolve(ROOT, relative);
  const rootPrefix = `${path.resolve(ROOT)}${path.sep}`;
  assert.ok(resolved.startsWith(rootPrefix), `Path escapes worktree: ${relative}`);
  return resolved;
}

function runGitResult(args, input = undefined) {
  const result = spawnSync(GIT, [
    '-c', 'core.longpaths=true',
    '-c', `safe.directory=${slash(path.resolve(ROOT))}`,
    ...args,
  ], {
    cwd: ROOT,
    input,
    encoding: null,
    windowsHide: true,
    shell: false,
    maxBuffer: 512 * 1024 * 1024,
    env: {
      SystemRoot: process.env.SystemRoot,
      COMSPEC: process.env.COMSPEC,
      PATH: 'C:/Program Files/Git/cmd;C:/Windows/System32',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: 'NUL',
      GIT_OPTIONAL_LOCKS: '0',
      GIT_TERMINAL_PROMPT: '0',
    },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, `${GIT} ${args.join(' ')} terminated by signal`);
  return result;
}

function runGit(args, input = undefined) {
  const result = runGitResult(args, input);
  assert.equal(result.status, 0, `${GIT} ${args.join(' ')}: ${result.stderr?.toString('utf8')}`);
  return result.stdout;
}

const gitText = args => runGit(args).toString('utf8').trim();

function recordFromBytes(relative, bytes, includeGitBlob = true) {
  const record = { path: slash(relative), byteLength: bytes.length, sha256: sha256(bytes) };
  if (includeGitBlob) record.gitBlob = gitBlob(bytes);
  return record;
}

function pin(relative) {
  return fileRecord(relative, false);
}

function assertPin(record, expectedPath = record?.path) {
  assert.equal(record?.path, expectedPath, `Pin path: ${expectedPath}`);
  const actual = fileRecord(expectedPath, Object.hasOwn(record, 'gitBlob'));
  assert.deepEqual(record, actual, `Pin changed: ${expectedPath}`);
}

function assertGeneration(actual, label) {
  assert.deepEqual(actual, GENERATION, `${label}: exact G5 generation`);
}

function assertZeroExecutions(actual, label) {
  assert.deepEqual(actual, ZERO_EXECUTIONS, `${label}: exact zero-execution accounting`);
}

function assertClosure(recorded, relative, count, digest) {
  assert.equal(recorded?.path, relative, `${relative}: closure path`);
  assert.equal(recorded?.fileCount, count, `${relative}: recorded count`);
  assert.equal(recorded?.digest, digest, `${relative}: recorded digest`);
  assert.equal(recorded.files?.every(record => Object.hasOwn(record, 'gitBlob')), true, `${relative}: closure records include gitBlob`);
  const actual = closureSnapshot(relative, true);
  assert.equal(actual.fileCount, count, `${relative}: current count`);
  assert.equal(actual.digest, digest, `${relative}: current immutable digest`);
  assert.deepEqual(recorded, actual, `${relative}: exact closure`);
  return actual;
}

function assertExactInventory(root, expectedPaths, label) {
  const target = absolute(root);
  const stat = fs.lstatSync(target);
  assert.equal(stat.isSymbolicLink(), false, `${label}: root symlink`);
  assert.equal(stat.isDirectory(), true, `${label}: root directory`);
  const entries = fs.readdirSync(target, { withFileTypes: true }).sort((a, b) => fileOrder(a.name, b.name));
  const actual = entries.map(entry => `${root}/${entry.name}`).sort(fileOrder);
  assert.deepEqual(actual, [...expectedPaths].sort(fileOrder), `${label}: exact inventory`);
  for (const entry of entries) {
    assert.equal(entry.isSymbolicLink(), false, `${label}: symlink ${entry.name}`);
    assert.equal(entry.isFile(), true, `${label}: non-file ${entry.name}`);
  }
}

function assertAuthoritativeBinding(binding, label, expectedProductionTree) {
  assert.ok(binding && typeof binding === 'object' && !Array.isArray(binding), `${label}: object`);
  assert.equal(binding.result, 'PASS', `${label}: result`);
  assert.deepEqual(binding.candidate, {
    role: 'C3TB',
    branch: BRANCH,
    commit: C3TB,
    tree: C3TB_TREE,
    soleParent: C3T,
  }, `${label}: candidate`);
  assert.deepEqual(binding.production, {
    role: 'C3T',
    commit: C3T,
    parent: C3T_PARENT,
    rootTree: C3T_TREE,
    tree: expectedProductionTree,
  }, `${label}: production`);
  assert.equal(binding.helper?.sha256, HELPER_SHA256, `${label}: helper SHA-256`);
  assert.equal(
    [HELPER, 'helpers/windows-inspect.ps1'].includes(slash(binding.helper?.path ?? '')),
    true,
    `${label}: helper path`,
  );
  if (Object.hasOwn(binding.helper, 'gitBlob')) assert.equal(binding.helper.gitBlob, HELPER_BLOB, `${label}: helper blob`);
  assert.deepEqual(binding.nonAuthoritativePlaceholders, {
    candidateCommit: null,
    candidateProductionTree: null,
    candidatePackageProductionTree: null,
    candidatePackageProductionTreePresent: false,
    excludedFromDerivation: true,
  }, `${label}: excluded prebinding placeholders`);
}

function assertFixedRuntimeAndHistory() {
  assert.equal(process.version, EXPECTED_NODE.version, 'Unexpected Node version');
  assert.equal(process.platform, EXPECTED_NODE.platform, 'Unexpected Node platform');
  assert.equal(process.arch, EXPECTED_NODE.arch, 'Unexpected Node architecture');
  assert.equal(path.resolve(process.execPath).toLowerCase(), path.resolve(EXPECTED_NODE_PATH).toLowerCase(), 'Unexpected Node executable');
  const nodeBytes = fs.readFileSync(process.execPath);
  assert.equal(nodeBytes.length, EXPECTED_NODE.byteLength, 'Unexpected Node byte length');
  assert.equal(sha256(nodeBytes), EXPECTED_NODE.sha256, 'Unexpected Node SHA-256');
  assert.equal(gitText(['--version']), EXPECTED_GIT_VERSION, 'Unexpected Git version');
  assert.equal(gitText(['branch', '--show-current']), BRANCH, 'Unexpected branch');

  assert.equal(gitText(['cat-file', '-t', C3T]), 'commit');
  assert.equal(gitText(['show', '-s', '--format=%P', C3T]), C3T_PARENT);
  assert.equal(gitText(['show', '-s', '--format=%T', C3T]), C3T_TREE);
  assert.equal(gitText(['cat-file', '-t', C3TB]), 'commit');
  assert.equal(gitText(['show', '-s', '--format=%P', C3TB]), C3T);
  assert.equal(gitText(['show', '-s', '--format=%T', C3TB]), C3TB_TREE);
  assert.equal(gitText(['diff', '--name-only', C3T, C3TB, '--', PRODUCT_RELATIVE]), '', 'C3TB product delta');
  assert.equal(gitText(['rev-parse', `${C3TB}:${HELPER}`]), HELPER_BLOB, 'C3TB helper blob');
  assert.equal(sha256(runGit(['show', `${C3TB}:${HELPER}`])), HELPER_SHA256, 'C3TB helper SHA-256');

  assert.equal(gitText(['cat-file', '-t', ACCEPTED_PHASE3BR2]), 'commit');
  assert.equal(gitText(['show', '-s', '--format=%P', ACCEPTED_PHASE3BR2]), C3TB, 'accepted Phase 3BR2 parent');
  assert.equal(gitText(['show', '-s', '--format=%T', ACCEPTED_PHASE3BR2]), ACCEPTED_PHASE3BR2_TREE, 'accepted Phase 3BR2 tree');

  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all', '--', PRODUCT_RELATIVE]), '', 'Product worktree must be clean');
  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all', '--', CANDIDATE_AUTHORITY]), '', 'Candidate authority worktree must be clean');

  const candidate = JSON.parse(runGit(['show', `${C3TB}:${CANDIDATE_RECORD}`]).toString('utf8'));
  const binding = JSON.parse(runGit(['show', `${C3TB}:${BINDING}`]).toString('utf8'));
  const verification = JSON.parse(runGit(['show', `${C3TB}:${BINDING_VERIFICATION}`]).toString('utf8'));
  const g2Plan = readJson(G2_PLAN);
  const g2Seal = readJson(G2_SEAL);
  const g2Ledger = readJson(G2_LEDGER);
  const authorities = [
    g2Plan.candidate.productionTree,
    g2Seal.candidate.productionTree,
    binding.implementation.productionTree,
    binding.package.productionTree,
    verification.productionTree,
    g2Ledger.candidate.productionTree,
    gitText(['rev-parse', `${C3T}:${PRODUCT_RELATIVE}`]),
    gitText(['rev-parse', `${C3TB}:${PRODUCT_RELATIVE}`]),
    gitText(['rev-parse', `${ACCEPTED_PHASE3BR2}:${PRODUCT_RELATIVE}`]),
  ];
  assert.equal(authorities.every(value => /^[0-9a-f]{40}$/u.test(value)), true, 'Every production-tree authority must be concrete');
  assert.equal(new Set(authorities).size, 1, 'Production-tree authorities differ');
  assert.equal(candidate.productionTree, null, 'Candidate prebinding placeholder changed');
  assert.equal(candidate.package?.productionTree ?? null, null, 'Candidate package prebinding placeholder changed');
  assert.equal(candidate.helper.sha256, HELPER_SHA256, 'Candidate helper identity');
  assert.equal(binding.binding.soleParent, C3T, 'Binding sole parent');
  assert.equal(binding.binding.productionChanges, false, 'Binding production changes');
  assert.equal(binding.helper.sha256, HELPER_SHA256, 'Binding helper identity');
  assert.equal(verification.candidateCommit, C3T, 'Binding verification implementation commit');
  assert.equal(verification.productionChangesInBindingCommit, false, 'Binding verification production changes');
  assert.equal(verification.result, 'PASS', 'Binding verification result');
  return authorities[0];
}

function assertPreservedG2(sourceG2, expectedProductionTree) {
  assertClosure(sourceG2.tools, G2_TOOL_RELATIVE, 18, G2_TOOL_DIGEST);
  assertClosure(sourceG2.evidence, G2_EVIDENCE_RELATIVE, 1043, G2_EVIDENCE_DIGEST);
  assertPin(sourceG2.ledger.record, G2_LEDGER);
  const ledger = readJson(G2_LEDGER);
  assert.equal(ledger.kind, 'MO1307Phase3CR2C3TBExecutionLedger');
  assert.equal(ledger.result, 'FAILED_INCOMPLETE');
  assert.equal(ledger.outcome, 'PHASE3CR2_FAILED_INCOMPLETE');
  assert.equal(ledger.candidate.commit, C3TB);
  assert.equal(ledger.candidate.implementation.commit, C3T);
  assert.equal(ledger.candidate.productionTree, expectedProductionTree);
  assert.equal(ledger.candidate.helper.sha256, HELPER_SHA256);
  assert.deepEqual(ledger.stages.map(stage => stage.id), [...EXPECTED_STAGES]);
  assert.deepEqual(ledger.stages.map(stage => stage.status), [...Array(8).fill('PASS'), 'FAIL']);
  assert.equal(ledger.stages.every(stage => stage.integrity?.result === 'PASS'), true);
  assert.equal(ledger.firstFailure.stage, 'CASE_SENSITIVE_RECONCILIATION');
  assert.equal(ledger.firstFailure.ordinal, 9);

  const g2Plan = readJson(G2_PLAN);
  const g2Seal = readJson(G2_SEAL);
  assert.equal(g2Plan.kind, 'MO1307Phase3CR2C3TBCampaignPlan');
  assert.equal(g2Seal.kind, 'MO1307Phase3CR2C3TBPreExecutionSeal');
  assert.equal(g2Seal.result, 'SEALED_NOT_EXECUTED');
  assert.equal(g2Plan.finalizedToolInputCount, 18);
  assert.equal(g2Plan.finalizedToolSetDigest, G2_TOOL_DIGEST);
  assert.deepEqual(g2Plan.finalizedToolInputs, sourceG2.tools.files);
  assert.deepEqual(g2Seal.finalizedToolInputs, g2Plan.finalizedToolInputs);
  assertClosure(g2Plan.priorFailedGeneration.tools, ORIGINAL_TOOL, 15, ORIGINAL_TOOL_DIGEST);
  assertClosure(g2Plan.priorFailedGeneration.evidence, ORIGINAL_EVIDENCE, 194, ORIGINAL_EVIDENCE_DIGEST);
  assert.equal(g2Plan.priorFailedGeneration.outcome, 'PHASE3CR2_FAILED_INCOMPLETE');
  assert.deepEqual(g2Seal.priorFailedGeneration, g2Plan.priorFailedGeneration);

  const harness = readJson(G2_VALIDATION_FILE);
  assert.equal(harness.kind, 'MO1307Phase3CR2DependencyAwareSourceReviewHarnessValidation');
  assert.equal(harness.result, 'PASS');
  assert.equal(harness.candidate, C3TB);
  assert.equal(harness.candidateImplementation, C3T);
  assert.equal(harness.productionTree, expectedProductionTree);
  assert.equal(harness.productExecuted, false);
  assert.equal(harness.helperExecuted, false);
  assert.equal(harness.securityControlExecuted, false);
  assert.equal(harness.networkExecuted, false);
  assert.equal(harness.certificationClaims, 0);
  assert.equal(harness.cases.length, 6);
  assert.equal(harness.cases.every(row => row.result === 'PASS'), true);
  assert.deepEqual(closureSnapshot(G2_VALIDATION_ROOT, true).files, [fileRecord(G2_VALIDATION_FILE, true)]);
  return ledger;
}

function assertPriorG3Failure(prior, sourceG2, expectedProductionTree) {
  assert.deepEqual(prior.generation, G3_GENERATION, 'G3 generation');
  assert.equal(prior.result, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(prior.outcome, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.deepEqual(prior.classification, ['MISSING_PROPAGATION', 'OTHER_CONCRETE_RECONCILIATION_DEFECT']);
  assert.equal(prior.classificationLabel, 'MISSING_PROPAGATION/OTHER_CONCRETE_RECONCILIATION_DEFECT');
  assert.deepEqual(prior.failure, {
    code: 'ERR_ASSERTION',
    path: `${G3_TOOL_RELATIVE}/reconcile.mjs`,
    line: 677,
    assertion: 'assert.deepEqual(zeroExecutionValidation.authoritativeBinding, authoritativeBinding);',
  });
  assert.equal(prior.cause?.missingField, 'git.helperCheckout.gitBlob');
  assert.equal(prior.cause?.onlyDifference, 'authoritativeBinding.helperAuthorities.gitBlobs[checkout.helper.gitBlob]');
  assert.equal(prior.cause?.sealedContainsCheckoutHelperGitBlob, true);
  assert.equal(prior.cause?.reconstructedContainsCheckoutHelperGitBlob, false);
  assert.equal(prior.cause?.exactAuthoritativeBindingDeepEqual, false);
  assert.deepEqual(prior.outputsWritten, { fresh: false, candidate: false, reviews: false, administrativeRecovery: false });
  assert.deepEqual(prior.absentReconciliationOutputs, [...G3_ABSENT_OUTPUTS]);
  for (const relative of G3_ABSENT_OUTPUTS) assert.equal(fs.existsSync(absolute(relative)), false, `G3 output must remain absent: ${relative}`);
  assertClosure(prior.tools, G3_TOOL_RELATIVE, 7, G3_TOOL_DIGEST);
  assertClosure(prior.evidence, G3_EVIDENCE_RELATIVE, 3, G3_EVIDENCE_DIGEST);
  assertPin(prior.artifacts.zeroExecutionValidation, G3_VALIDATION);
  assertPin(prior.artifacts.recoveryPlan, G3_PLAN);
  assertPin(prior.artifacts.preExecutionSeal, G3_SEAL);
  assertPin(prior.artifacts.reconcile, `${G3_TOOL_RELATIVE}/reconcile.mjs`);
  assert.equal(prior.sourceIntegrity?.mechanicallyReproduced, true);

  const validation = readJson(G3_VALIDATION);
  const plan = readJson(G3_PLAN);
  const seal = readJson(G3_SEAL);
  assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG3ZeroExecutionValidation');
  assert.equal(validation.result, 'PASS');
  assert.deepEqual(validation.generation, G3_GENERATION);
  assert.deepEqual(validation.sourceG2, sourceG2);
  assertAuthoritativeBinding(validation.authoritativeBinding, 'G3 binding', expectedProductionTree);
  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBG3RecoveryPlan');
  assert.equal(plan.status, 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED');
  assert.deepEqual(plan.generation, G3_GENERATION);
  assert.equal(seal.kind, 'MO1307Phase3CR2C3TBG3PreExecutionSeal');
  assert.equal(seal.result, 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED');
  assert.deepEqual(seal.generation, G3_GENERATION);
  assertZeroExecutions(seal.executionCounts, 'G3 seal');
}

function priorAcceptancePaths() {
  const paths = PRIOR_G4_ACCEPTANCE_ROOTS
    .flatMap(root => closureSnapshot(root, true).files.map(record => record.path))
    .sort(fileOrder);
  assert.equal(new Set(paths).size, paths.length, 'Prior G4 path union contains duplicates');
  assert.equal(paths.length, 1300, 'Exact prior G4 path count');
  return paths;
}

function assertTailHex(relative, expected) {
  const bytes = readRegularBytes(relative);
  assert.equal(bytes.subarray(-8).toString('hex'), expected, `${relative}: exact sealed tail`);
}

function assertPriorG4Failure(prior, sourceG2, priorG3Failure, expectedProductionTree) {
  assert.deepEqual(prior.generation, PRIOR_G4_GENERATION, 'G4 generation');
  assert.equal(prior.result, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(prior.outcome, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(prior.phase, 'STAGED_ACCEPTANCE_VERIFICATION');
  assert.deepEqual(prior.classification, ['OTHER_CONCRETE_RECONCILIATION_DEFECT']);
  assert.equal(prior.classificationLabel, 'OTHER_CONCRETE_RECONCILIATION_DEFECT/GIT_DIFF_CHECK_EXACT_KNOWN_VIOLATIONS');
  assert.deepEqual(prior.failure, {
    code: 'GIT_DIFF_CHECK',
    exitCode: 2,
    path: `${G4_TOOL_RELATIVE}/finalize.mjs`,
    line: 1354,
    assertion: "runGit(['diff', '--cached', '--check']);",
  });
  assert.deepEqual(prior.violations, [...KNOWN_G4_WHITESPACE_VIOLATIONS]);
  assert.deepEqual(prior.passedBeforeFailure, {
    exactStagedPathUnion: true,
    pathCount: 1300,
    allPathsAOnly: true,
    allStagedBlobsByteExact: true,
    productPathsAbsent: true,
    unstagedTrackedChangesAbsent: true,
  });
  assert.equal(prior.acceptanceCommitCreated, false);
  assertClosure(prior.tools, G4_TOOL_RELATIVE, 7, G4_TOOL_DIGEST);
  assertClosure(prior.evidence, G4_EVIDENCE_RELATIVE, 12, G4_EVIDENCE_DIGEST);
  assert.equal(prior.sourceIntegrity?.mechanicallyReproduced, true);
  assert.equal(prior.sourceIntegrity?.onlyKnownViolations, true);
  priorAcceptancePaths();
  for (const violation of KNOWN_G4_WHITESPACE_VIOLATIONS) assertTailHex(violation.path, violation.tailHex);

  const g4FinalizerLines = readRegularBytes(`${G4_TOOL_RELATIVE}/finalize.mjs`).toString('utf8').split(/\r?\n/u);
  assert.equal(g4FinalizerLines[1353], "  runGit(['diff', '--cached', '--check']);", 'Exact G4 staging blocker source');
  assertExactInventory(G4_EVIDENCE_RELATIVE, G4_FILES, 'G4 immutable evidence');
  const validation = readJson(G4_VALIDATION);
  const plan = readJson(G4_PLAN);
  const seal = readJson(G4_SEAL);
  const administrative = readJson(G4_ADMINISTRATIVE);
  const fresh = readJson(G4_FRESH);
  const reuse = readJson(G2_REUSE);
  const candidate = readJson(G4_CANDIDATE);
  const reviews = readJson(G4_REVIEWS);
  assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG4ZeroExecutionValidation');
  assert.equal(validation.result, 'PASS');
  assert.deepEqual(validation.generation, PRIOR_G4_GENERATION);
  assert.deepEqual(validation.sourceG2, sourceG2);
  assert.deepEqual(validation.priorG3Failure, priorG3Failure);
  assertAuthoritativeBinding(validation.authoritativeBinding, 'G4 validation binding', expectedProductionTree);
  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBG4RecoveryPlan');
  assert.equal(plan.status, 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED');
  assert.equal(seal.kind, 'MO1307Phase3CR2C3TBG4PreExecutionSeal');
  assert.equal(seal.result, 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED');
  assert.deepEqual(plan.generation, PRIOR_G4_GENERATION);
  assert.deepEqual(seal.generation, PRIOR_G4_GENERATION);
  assert.equal(administrative.kind, 'MO1307Phase3CR2C3TBG4AdministrativeRecovery');
  assert.equal(administrative.result, 'PASS');
  assert.equal(administrative.outcome, 'RECONCILIATION_COMPLETE');
  assert.deepEqual(administrative.generation, PRIOR_G4_GENERATION);
  assertZeroExecutions(administrative.executionCounts, 'G4 administrative recovery');
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
  assert.equal(fresh.count, 89);
  assert.equal(fresh.rows.length, 89);
  assert.equal(fresh.rows.every(row => row.result === 'PASS_FRESH'), true);
  assert.equal(reuse.counts.reusedHistoricalControls, 462);
  assert.equal(reuse.rows.length, 462);
  assert.equal(reuse.rows.every(row => row.disposition === 'REUSED_EXACT'), true);
  assert.equal(candidate.count, 2);
  assert.equal(candidate.rows.length, 2);
  assert.equal(candidate.rows.every(row => row.result === 'PASS'), true);
  assert.equal(reviews.count, 12);
  assert.equal(reviews.rows.length, 12);
  assert.equal(reviews.rows.every(row => row.result === 'PASS'), true);
  for (const artifact of [fresh, candidate, reviews]) {
    assert.deepEqual(artifact.generation, PRIOR_G4_GENERATION);
    assertZeroExecutions(artifact.executionCounts, artifact.kind);
  }

  const terminal = {
    receipt: readJson(G4_RECEIPT),
    finalValidation: readJson(G4_FINAL_VALIDATION),
    handoff: readJson(G4_HANDOFF),
    manifest: readJson(G4_MANIFEST),
    finalSeal: readJson(G4_FINAL_SEAL),
  };
  assert.equal(terminal.receipt.kind, 'MO1307Phase3CR2C3TBG4CertificationReceipt');
  assert.equal(terminal.receipt.status, 'PHASE3CR2_ACCEPTED');
  assert.equal(terminal.finalValidation.kind, 'MO1307Phase3CR2C3TBG4FinalValidation');
  assert.equal(terminal.finalValidation.outcome, 'PHASE3CR2_ACCEPTED');
  assert.equal(terminal.handoff.kind, 'MO1307Phase3CR2C3TBG4Phase3DHandoff');
  assert.equal(terminal.handoff.result, 'READY_NOT_EXECUTED');
  assert.equal(terminal.manifest.kind, 'MO1307Phase3CR2C3TBG4EvidenceManifest');
  assert.equal(terminal.finalSeal.kind, 'MO1307Phase3CR2C3TBG4FinalSeal');
  for (const artifact of Object.values(terminal)) {
    assert.deepEqual(artifact.generation, PRIOR_G4_GENERATION);
    assertAuthoritativeBinding(artifact.authoritativeBinding, artifact.kind, expectedProductionTree);
    assert.deepEqual(artifact.priorG3Failure, priorG3Failure);
  }
  for (const relative of [G4_RECEIPT, G4_FINAL_VALIDATION, G4_HANDOFF, G4_MANIFEST, G4_FINAL_SEAL]) {
    const atC3TB = runGitResult(['cat-file', '-e', `${C3TB}:${relative}`]);
    assert.notEqual(atC3TB.status, 0, `G4 terminal claim unexpectedly contained in C3TB: ${relative}`);
  }
  return { validation, plan, seal, administrative, fresh, reuse, candidate, reviews, terminal };
}

function assertG5ToolSeal(plan, seal) {
  const tools = closureSnapshot(G5_TOOL_RELATIVE, true);
  assert.equal(tools.fileCount, 7, 'G5 exact tool count');
  assert.equal(plan.finalizedToolInputCount, 7);
  assert.deepEqual(plan.finalizedToolInputs, tools.files);
  assert.equal(plan.finalizedToolSetDigest, tools.digest);
  assert.equal(seal.finalizedToolInputCount, 7);
  assert.deepEqual(seal.finalizedToolInputs, tools.files);
  assert.equal(seal.finalizedToolSetDigest, tools.digest);
  return tools;
}

function assertG5Administrative(administrative, validation, expectedProductionTree) {
  assert.equal(administrative.kind, 'MO1307Phase3CR2C3TBG5AdministrativeAcceptanceRecovery');
  assert.equal(administrative.version, '1.0.0');
  assert.equal(administrative.result, 'PASS');
  assert.equal(administrative.outcome, 'ACCEPTANCE_RECOVERY_COMPLETE');
  assertGeneration(administrative.generation, 'administrative acceptance recovery');
  assert.equal(administrative.sourceExecutionGeneration, 'phase3cr2-c3tb-g2');
  assert.equal(administrative.priorRecoveryGeneration, 'phase3cr2-c3tb-g4');
  assertAuthoritativeBinding(administrative.authoritativeBinding, 'administrative acceptance recovery', expectedProductionTree);
  assert.deepEqual(administrative.sourceG2, validation.sourceG2);
  assert.deepEqual(administrative.priorG3Failure, validation.priorG3Failure);
  assert.deepEqual(administrative.priorG4Failure, validation.priorG4Failure);
  assert.deepEqual(administrative.evidenceOrigin, {
    mode: 'ACCEPTANCE_ONLY_NO_EXECUTION',
    executedInG5: { fresh: 0, reuse: 0, candidateSpecific: 0, sourceAndSecurityReviews: 0 },
    acceptedFromG4: {
      freshSelectedHistoricalControls: 89,
      reusedHistoricalControls: 462,
      candidateSpecificControls: 2,
      sourceAndSecurityReviews: 12,
      backedByExecutionGeneration: 'phase3cr2-c3tb-g2',
    },
  });
  assertZeroExecutions(administrative.executionCounts, 'administrative acceptance recovery');
  assert.equal(administrative.campaignRerun, false);
  assert.equal(administrative.stages1Through8Rerun, false);
  assert.equal(administrative.stages2Through8Rerun, false);
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
  assert.ok(administrative.administrativeAuthority && typeof administrative.administrativeAuthority === 'object');
  assert.equal(administrative.administrativeAuthority.mode, 'NEW_GENERATION_ACCEPTANCE_ONLY');
  assert.equal(administrative.administrativeAuthority.authorityScope, 'ACCEPT_IMMUTABLE_G4_RECONCILIATION_WITHOUT_REEXECUTION');
  assert.equal(administrative.administrativeAuthority.appendOnly, true);
  assert.equal(administrative.administrativeAuthority.resumesPriorAttempt, false);
  assert.equal(administrative.administrativeAuthority.priorG2FailurePreserved, true);
  assert.equal(administrative.administrativeAuthority.priorG2FailureRewrittenAsPass, false);
  assert.equal(administrative.administrativeAuthority.priorG3FailurePreserved, true);
  assert.equal(administrative.administrativeAuthority.priorG3FailureRewrittenAsPass, false);
  assert.equal(administrative.administrativeAuthority.priorG4FailurePreserved, true);
  assert.equal(administrative.administrativeAuthority.priorG4FailureRewrittenAsPass, false);
  assert.equal(administrative.administrativeAuthority.g4ReconciliationArtifactsPreserved, true);
  assert.equal(administrative.administrativeAuthority.g4BytesModified, false);
  assert.ok(Array.isArray(administrative.administrativeAuthority.citations));
  assert.equal(administrative.administrativeAuthority.citations.length, 9);
  assert.deepEqual(administrative.acceptance, {
    result: 'PASS',
    g4ReconciliationAccepted: true,
    g4ToolFiles: 7,
    g4EvidenceFiles: 12,
    g4AcceptanceCommitCreated: false,
    containingCommitRequired: true,
    requiredSingleParent: C3TB,
    productTree: expectedProductionTree,
  });
  assert.deepEqual(administrative.rootCause, {
    phase: validation.priorG4Failure.phase,
    classification: validation.priorG4Failure.classification,
    classificationLabel: validation.priorG4Failure.classificationLabel,
    failure: validation.priorG4Failure.failure,
    violations: validation.priorG4Failure.violations,
    acceptanceCommitCreatedInG4: false,
    correction: 'NEW_G5_APPEND_ONLY_ACCEPTANCE_GENERATION_WITH_CANONICAL_SINGLE_EOF_NEWLINES',
  });
  assert.deepEqual(administrative.inputs.validation, pin(VALIDATION));
  assert.deepEqual(administrative.inputs.recoveryPlan, pin(PLAN));
  assert.deepEqual(administrative.inputs.preExecutionSeal, pin(PRE_SEAL));
  assert.deepEqual(administrative.inputs.g4, {
    validation: pin(G4_VALIDATION),
    plan: pin(G4_PLAN),
    preExecutionSeal: pin(G4_SEAL),
    fresh: pin(G4_FRESH),
    candidate: pin(G4_CANDIDATE),
    reviews: pin(G4_REVIEWS),
    administrativeRecovery: pin(G4_ADMINISTRATIVE),
    receipt: pin(G4_RECEIPT),
    finalValidation: pin(G4_FINAL_VALIDATION),
    phase3DHandoff: pin(G4_HANDOFF),
    manifest: pin(G4_MANIFEST),
    finalSeal: pin(G4_FINAL_SEAL),
  });
  assert.deepEqual(administrative.inputs.g4Tools, validation.priorG4Failure.tools);
  assert.deepEqual(administrative.inputs.g4Evidence, validation.priorG4Failure.evidence);
  assert.deepEqual(administrative.outputs, { administrativeAcceptanceRecovery: ADMINISTRATIVE_ACCEPTANCE });
  assert.equal(administrative.productChanges, false);
  assert.equal(administrative.phase3DExecuted, false);
  assert.equal(administrative.push, false);
  assert.equal(administrative.tag, false);
}

function assertG5SealedSchemas(validation, plan, seal, g5Tools, expectedProductionTree) {
  assert.equal(validation.productionTree, expectedProductionTree);
  assert.equal(plan.productionTree, expectedProductionTree);
  assert.equal(seal.productionTree, expectedProductionTree);
  assert.deepEqual(validation.cases.map(test => test.id), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
  assert.deepEqual(validation.cases.map(test => test.expected), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'PASS', 'FAIL']);
  assert.deepEqual(validation.cases.map(test => test.actual), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'PASS', 'FAIL']);
  assert.equal(validation.cases.every(test => test.result === 'PASS'), true);
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
  assert.deepEqual(plan.outputs, [...G5_PLANNED_OUTPUTS]);
  assert.deepEqual(plan.scope, {
    mode: 'ACCEPTANCE_ONLY',
    repairTarget: 'G4_STAGED_ACCEPTANCE_VERIFICATION',
    sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
    priorRecoveryGeneration: 'phase3cr2-c3tb-g4',
    preservesFailedG2: true,
    preservesFailedG3: true,
    preservesFailedG4: true,
    consumesCompleteG4Reconciliation: true,
    rerunsStages1Through8: false,
    rerunsReconciliation: false,
    launchesControls: false,
    changesProduct: false,
    executesPhase3D: false,
  });
  assert.equal(plan.executionPolicy.mode, 'ZERO_EXECUTION_ACCEPTANCE_ONLY');
  assert.equal(plan.executionPolicy.preservesFailedG2, true);
  assert.equal(plan.executionPolicy.preservesFailedG3, true);
  assert.equal(plan.executionPolicy.preservesFailedG4, true);
  assert.equal(plan.executionPolicy.consumesCompleteG4Reconciliation, true);
  assertZeroExecutions(plan.executionPolicy.executionsBeforeSeal, 'G5 plan execution policy');
  assert.deepEqual(seal.executionPolicy, plan.executionPolicy);
  assert.equal(seal.appendOnly, true);
  assert.equal(g5Tools.fileCount, 7);
}

function loadPrefinal(expectedProductionTree) {
  assertExactInventory(G5_EVIDENCE_RELATIVE, PREFINAL_OUTPUTS, 'G5 prefinal evidence');
  const validation = readJson(VALIDATION);
  const plan = readJson(PLAN);
  const seal = readJson(PRE_SEAL);
  const administrative = readJson(ADMINISTRATIVE_ACCEPTANCE);

  assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG5ZeroExecutionValidation');
  assert.equal(validation.result, 'PASS');
  assertGeneration(validation.generation, 'G5 validation');
  assertAuthoritativeBinding(validation.authoritativeBinding, 'G5 validation binding', expectedProductionTree);
  assertZeroExecutions(validation.executionCounts, 'G5 validation');
  assert.deepEqual(validation.authoritativeBinding, readJson(G4_VALIDATION).authoritativeBinding, 'G5 binding must equal sealed G4 binding');
  assertPreservedG2(validation.sourceG2, expectedProductionTree);
  assertPriorG3Failure(validation.priorG3Failure, validation.sourceG2, expectedProductionTree);
  const g4 = assertPriorG4Failure(
    validation.priorG4Failure,
    validation.sourceG2,
    validation.priorG3Failure,
    expectedProductionTree,
  );

  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBG5RecoveryPlan');
  assert.equal(plan.status, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assertGeneration(plan.generation, 'G5 recovery plan');
  assertAuthoritativeBinding(plan.authoritativeBinding, 'G5 recovery plan binding', expectedProductionTree);
  assert.deepEqual(plan.validation, pin(VALIDATION));
  assert.deepEqual(plan.sourceG2, validation.sourceG2);
  assert.deepEqual(plan.priorG3Failure, validation.priorG3Failure);
  assert.deepEqual(plan.priorG4Failure, validation.priorG4Failure);

  assert.equal(seal.kind, 'MO1307Phase3CR2C3TBG5PreExecutionSeal');
  assert.equal(seal.result, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assertGeneration(seal.generation, 'G5 pre-execution seal');
  assertAuthoritativeBinding(seal.authoritativeBinding, 'G5 pre-execution seal binding', expectedProductionTree);
  assert.deepEqual(seal.validation, pin(VALIDATION));
  assert.deepEqual(seal.recoveryPlan, pin(PLAN));
  assert.deepEqual(seal.sourceG2, validation.sourceG2);
  assert.deepEqual(seal.priorG3Failure, validation.priorG3Failure);
  assert.deepEqual(seal.priorG4Failure, validation.priorG4Failure);
  assertZeroExecutions(seal.executionCounts, 'G5 pre-execution seal');
  const g5Tools = assertG5ToolSeal(plan, seal);
  assertG5SealedSchemas(validation, plan, seal, g5Tools, expectedProductionTree);

  assertG5Administrative(administrative, validation, expectedProductionTree);
  return {
    validation,
    plan,
    seal,
    administrative,
    sourceG2: validation.sourceG2,
    priorG3Failure: validation.priorG3Failure,
    priorG4Failure: validation.priorG4Failure,
    g4,
    g5Tools,
    expectedProductionTree,
  };
}

function g4TerminalDisposition(inputs) {
  return {
    classification: 'PRECOMMIT_NON_CONTAINING_CLAIMS',
    observedAtPriorFailure: 'STAGED_ACCEPTANCE_VERIFICATION',
    containedInC3TB: false,
    acceptanceCommitCreated: false,
    controllingAcceptance: false,
    preservedUnchanged: true,
    supersededBy: 'G5_EXACT_CONTAINING_COMMIT_VERIFICATION',
    artifacts: [
      { role: 'certificationReceipt', record: pin(G4_RECEIPT), claimedState: inputs.g4.terminal.receipt.status },
      { role: 'finalValidation', record: pin(G4_FINAL_VALIDATION), claimedState: inputs.g4.terminal.finalValidation.outcome },
      { role: 'phase3DHandoff', record: pin(G4_HANDOFF), claimedState: inputs.g4.terminal.handoff.result },
      { role: 'evidenceManifest', record: pin(G4_MANIFEST), claimedState: inputs.g4.terminal.manifest.phase3CR2 },
      { role: 'finalSeal', record: pin(G4_FINAL_SEAL), claimedState: inputs.g4.terminal.finalSeal.phase3CR2 },
    ],
  };
}

function finalCommitRule(state, expectedProductionTree) {
  return {
    state,
    verifierMode: '--verify-committed',
    requiredSingleParent: true,
    requiredParent: C3TB,
    requiredCandidateTree: C3TB_TREE,
    requiredProductionTree: expectedProductionTree,
    productChangesAllowed: false,
    exactPathUnionRequired: true,
    allPathsMustBeAdded: true,
    fullWhitespaceCheck: {
      requiredExitCode: 2,
      exactImmutableG4Violations: [...KNOWN_G4_WHITESPACE_VIOLATIONS],
      additionalViolationsAllowed: false,
    },
    g5WhitespaceCheck: { requiredExitCode: 0, violationsAllowed: false },
  };
}

function controlsSummary() {
  return {
    freshExecutedInG5: 0,
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
  };
}

function buildReceipt(inputs, finalizedAt) {
  return {
    kind: 'MO1307Phase3CR2C3TBG5CertificationReceipt',
    version: '1.0.0',
    finalizedAt,
    result: 'PASS_ACCEPTANCE_READY',
    phase3CR2: 'ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    status: 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    outcome: 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
    priorRecoveryGeneration: 'phase3cr2-c3tb-g4',
    preservedG2: {
      outcome: 'PHASE3CR2_FAILED_INCOMPLETE',
      ledger: pin(G2_LEDGER),
      tools: inputs.sourceG2.tools,
      evidence: inputs.sourceG2.evidence,
      immutable: true,
      modified: false,
      resumed: false,
    },
    preservedG3: {
      outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
      failure: inputs.priorG3Failure.failure,
      tools: inputs.priorG3Failure.tools,
      evidence: inputs.priorG3Failure.evidence,
      immutable: true,
      modified: false,
      resumed: false,
    },
    preservedG4: {
      outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
      phase: 'STAGED_ACCEPTANCE_VERIFICATION',
      failure: inputs.priorG4Failure.failure,
      violations: inputs.priorG4Failure.violations,
      tools: inputs.priorG4Failure.tools,
      evidence: inputs.priorG4Failure.evidence,
      terminalArtifactDisposition: g4TerminalDisposition(inputs),
      immutable: true,
      modified: false,
      resumed: false,
    },
    administrativeAcceptanceRecovery: pin(ADMINISTRATIVE_ACCEPTANCE),
    controls: controlsSummary(),
    executionCounts: ZERO_EXECUTIONS,
    campaignRerun: false,
    stages1Through8Rerun: false,
    stages2Through8Rerun: false,
    inputs: {
      zeroExecutionValidation: pin(VALIDATION),
      recoveryPlan: pin(PLAN),
      preExecutionSeal: pin(PRE_SEAL),
      administrativeAcceptanceRecovery: pin(ADMINISTRATIVE_ACCEPTANCE),
      g4FreshControlResults: pin(G4_FRESH),
      g2DependencyReuse: pin(G2_REUSE),
      g4CandidateSpecificControls: pin(G4_CANDIDATE),
      g4SourceSecurityReviews: pin(G4_REVIEWS),
    },
    containingCommit: finalCommitRule('PENDING_VERIFICATION', inputs.expectedProductionTree),
    phase3D: { executed: false, handoff: HANDOFF, authorizationGranted: false, conditionalOnContainingCommitVerification: true },
    prohibitions: { productChanges: false, push: false, tag: false, phase3AR2: false, phase3D: false, network: false },
  };
}

function buildFinalValidation(inputs, receiptRecord, finalizedAt) {
  return {
    kind: 'MO1307Phase3CR2C3TBG5FinalValidation',
    version: '1.0.0',
    finalizedAt,
    result: 'PASS_ACCEPTANCE_SUPPORTED',
    outcome: 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    priorG4Failure: inputs.priorG4Failure,
    g4TerminalArtifactDisposition: g4TerminalDisposition(inputs),
    receipt: receiptRecord,
    executionCounts: ZERO_EXECUTIONS,
    checks: {
      preservedG2: { outcome: 'PHASE3CR2_FAILED_INCOMPLETE', immutable: true },
      preservedG3: { outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER', immutable: true, failure: inputs.priorG3Failure.failure },
      preservedG4: { outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER', immutable: true, failure: inputs.priorG4Failure.failure },
      exactG4WhitespaceViolations: [...KNOWN_G4_WHITESPACE_VIOLATIONS],
      fresh: { expected: 89, actual: 89, result: 'PASS' },
      reuse: { expected: 462, actual: 462, result: 'PASS' },
      candidateSpecific: { expected: 2, actual: 2, result: 'PASS' },
      reviews: { expected: 12, actual: 12, result: 'PASS' },
      unresolved: 0,
      omissions: 0,
      duplicateIds: 0,
      overlaps: 0,
      mismatches: 0,
      campaignRerun: false,
      stages1Through8Rerun: false,
      productChanged: false,
      phase3DExecuted: false,
      containingCommitVerified: false,
    },
    containingCommit: finalCommitRule('PENDING_VERIFICATION', inputs.expectedProductionTree),
  };
}

function buildHandoff(inputs, receiptRecord, finalValidationRecord, finalizedAt) {
  return {
    kind: 'MO1307Phase3CR2C3TBG5Phase3DHandoff',
    version: '1.0.0',
    finalizedAt,
    result: 'READY_AFTER_CONTAINING_COMMIT_VERIFICATION_NOT_EXECUTED',
    phase3CR2: 'ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    phase3DExecuted: false,
    phase3DExecutionAuthorized: false,
    conditionalOnContainingCommitVerification: true,
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    priorG4Failure: inputs.priorG4Failure,
    g4TerminalArtifactDisposition: g4TerminalDisposition(inputs),
    administrativeAcceptanceRecovery: pin(ADMINISTRATIVE_ACCEPTANCE),
    receipt: receiptRecord,
    finalValidation: finalValidationRecord,
    controls: controlsSummary(),
    executionCounts: ZERO_EXECUTIONS,
    containingCommit: finalCommitRule('PENDING_VERIFICATION', inputs.expectedProductionTree),
    consumeRule: 'Consume only after --verify-committed emits PHASE3CR2_ACCEPTED for a clean single-parent commit over exact C3TB with the exact A-only acceptance path union, unchanged production tree, exactly the two immutable G4 whitespace violations, and zero G5 whitespace violations. This handoff neither executes nor authorizes Phase 3D.',
  };
}

function buildManifest(inputs, receiptBytes, finalValidationBytes, handoffBytes, finalizedAt) {
  const members = [
    ...closureSnapshot(G5_TOOL_RELATIVE, true).files,
    ...PREFINAL_OUTPUTS.map(relative => fileRecord(relative, true)),
    recordFromBytes(RECEIPT, receiptBytes),
    recordFromBytes(FINAL_VALIDATION, finalValidationBytes),
    recordFromBytes(HANDOFF, handoffBytes),
  ].sort((a, b) => fileOrder(a.path, b.path));
  assert.equal(new Set(members.map(record => record.path)).size, members.length, 'G5 manifest duplicate member');
  return {
    kind: 'MO1307Phase3CR2C3TBG5EvidenceManifest',
    version: '1.0.0',
    finalizedAt,
    result: 'PASS_ACCEPTANCE_READY',
    phase3CR2: 'ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    priorG4Failure: inputs.priorG4Failure,
    g4TerminalArtifactDisposition: g4TerminalDisposition(inputs),
    memberCount: members.length,
    members,
    excludes: [MANIFEST, FINAL_SEAL],
    priorClosures: {
      originalTools: closureSnapshot(ORIGINAL_TOOL, true),
      originalEvidence: closureSnapshot(ORIGINAL_EVIDENCE, true),
      g2Tools: inputs.sourceG2.tools,
      g2Evidence: inputs.sourceG2.evidence,
      g3Tools: inputs.priorG3Failure.tools,
      g3Evidence: inputs.priorG3Failure.evidence,
      g4Tools: inputs.priorG4Failure.tools,
      g4Evidence: inputs.priorG4Failure.evidence,
    },
    executionCounts: ZERO_EXECUTIONS,
    containingCommit: finalCommitRule('PENDING_VERIFICATION', inputs.expectedProductionTree),
    phase3DExecuted: false,
  };
}

function buildFinalSeal(inputs, receiptRecord, finalValidationRecord, handoffRecord, manifestRecord, finalizedAt) {
  return {
    kind: 'MO1307Phase3CR2C3TBG5FinalSeal',
    version: '1.0.0',
    finalizedAt,
    result: 'PASS_ACCEPTANCE_READY',
    phase3CR2: 'ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    immutableG2: { tools: inputs.sourceG2.tools, evidence: inputs.sourceG2.evidence, ledger: pin(G2_LEDGER), outcome: 'PHASE3CR2_FAILED_INCOMPLETE' },
    immutableG3: { tools: inputs.priorG3Failure.tools, evidence: inputs.priorG3Failure.evidence, failure: inputs.priorG3Failure.failure, outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER' },
    immutableG4: { tools: inputs.priorG4Failure.tools, evidence: inputs.priorG4Failure.evidence, failure: inputs.priorG4Failure.failure, violations: inputs.priorG4Failure.violations, outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER' },
    g4TerminalArtifactDisposition: g4TerminalDisposition(inputs),
    zeroExecutionValidation: pin(VALIDATION),
    recoveryPlan: pin(PLAN),
    preExecutionSeal: pin(PRE_SEAL),
    administrativeAcceptanceRecovery: pin(ADMINISTRATIVE_ACCEPTANCE),
    receipt: receiptRecord,
    finalValidation: finalValidationRecord,
    phase3DHandoff: handoffRecord,
    manifest: manifestRecord,
    executionCounts: ZERO_EXECUTIONS,
    containingCommit: finalCommitRule('PENDING_VERIFICATION', inputs.expectedProductionTree),
    phase3DExecuted: false,
    push: false,
    tag: false,
  };
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function statusEntries() {
  const tokens = runGit(['status', '--porcelain=v1', '-z', '--untracked-files=all'])
    .toString('utf8').split('\0').filter(Boolean);
  const entries = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const status = token.slice(0, 2);
    entries.push({ status, path: slash(token.slice(3)) });
    if (status.includes('R') || status.includes('C')) index += 1;
  }
  return entries;
}

function acceptancePaths() {
  assertExactInventory(G5_EVIDENCE_RELATIVE, FINAL_EVIDENCE_FILES, 'G5 final evidence');
  const paths = ACCEPTANCE_ROOTS
    .flatMap(root => closureSnapshot(root, true).files.map(record => record.path))
    .sort(fileOrder);
  assert.equal(new Set(paths).size, paths.length, 'Acceptance path union contains duplicates');
  assert.equal(paths.length, 1316, 'Exact G5 acceptance path count');
  return paths;
}

function assertAllowedPreWriteState() {
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB, 'G5 must finalize directly over C3TB');
  assert.equal(gitText(['diff', '--name-only']), '', 'Tracked unstaged changes are forbidden');
  assert.equal(gitText(['diff', '--cached', '--name-only']), '', 'Staged changes are forbidden before G5 finalization');
  const expected = ACCEPTANCE_ROOTS
    .flatMap(root => closureSnapshot(root, true).files.map(record => record.path))
    .sort(fileOrder);
  assert.equal(expected.length, 1311, 'Exact G5 prefinal path count');
  const entries = statusEntries();
  assert.deepEqual(entries.map(entry => entry.path).sort(fileOrder), expected, 'Exact pre-write acceptance path union');
  assert.equal(entries.every(entry => entry.status === '??'), true, 'Only untracked append-only files are permitted before G5 finalization');
  assert.equal(entries.some(entry => entry.path === PRODUCT_RELATIVE || entry.path.startsWith(`${PRODUCT_RELATIVE}/`)), false, 'Product path in status');
}

function writeFinal() {
  const expectedProductionTree = assertFixedRuntimeAndHistory();
  assertAllowedPreWriteState();
  assert.deepEqual(G5_PLANNED_OUTPUTS, [...FINAL_EVIDENCE_FILES], 'Exact G5 planned outputs');
  for (const relative of FINAL_OUTPUTS) assert.equal(fs.existsSync(absolute(relative)), false, `Refusing overwrite: ${relative}`);
  const inputs = loadPrefinal(expectedProductionTree);
  const finalizedAt = new Date().toISOString();

  const receipt = buildReceipt(inputs, finalizedAt);
  const receiptBytes = jsonBytes(receipt);
  const receiptRecord = recordFromBytes(RECEIPT, receiptBytes, false);
  const finalValidation = buildFinalValidation(inputs, receiptRecord, finalizedAt);
  const finalValidationBytes = jsonBytes(finalValidation);
  const finalValidationRecord = recordFromBytes(FINAL_VALIDATION, finalValidationBytes, false);
  const handoff = buildHandoff(inputs, receiptRecord, finalValidationRecord, finalizedAt);
  const handoffBytes = jsonBytes(handoff);
  const handoffRecord = recordFromBytes(HANDOFF, handoffBytes, false);
  const manifest = buildManifest(inputs, receiptBytes, finalValidationBytes, handoffBytes, finalizedAt);
  const manifestBytes = jsonBytes(manifest);
  const manifestRecord = recordFromBytes(MANIFEST, manifestBytes, false);
  const finalSeal = buildFinalSeal(inputs, receiptRecord, finalValidationRecord, handoffRecord, manifestRecord, finalizedAt);
  const finalSealBytes = jsonBytes(finalSeal);

  const writes = [
    [RECEIPT, receiptBytes],
    [FINAL_VALIDATION, finalValidationBytes],
    [HANDOFF, handoffBytes],
    [MANIFEST, manifestBytes],
    [FINAL_SEAL, finalSealBytes],
  ];
  for (const [relative] of writes) assert.equal(fs.existsSync(absolute(relative)), false, `Append-only pre-write check: ${relative}`);
  for (const [relative, bytes] of writes) fs.writeFileSync(absolute(relative), bytes, { flag: 'wx', mode: 0o644 });
  assertExactInventory(G5_EVIDENCE_RELATIVE, FINAL_EVIDENCE_FILES, 'G5 post-finalization evidence');
  process.stdout.write(`${canonical({
    mode: '--write',
    result: 'PASS_FINAL_ARTIFACTS_WRITTEN',
    outcome: 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    freshExecutedInG5: 0,
    freshAcceptedFromG4: 89,
    reusedExactAcceptedFromG4: 462,
    candidateSpecificAcceptedFromG4: 2,
    outputs: FINAL_OUTPUTS,
    next: 'Stage the exact acceptance path union, run --verify-staged, create one single-parent commit over C3TB, then run --verify-committed. Do not push, tag, or execute Phase 3D.',
  })}\n`);
}

function loadFinal(expectedProductionTree) {
  assertExactInventory(G5_EVIDENCE_RELATIVE, FINAL_EVIDENCE_FILES, 'G5 final evidence');
  const inputs = loadPrefinalWithFinalInventory(expectedProductionTree);
  const receipt = readJson(RECEIPT);
  const finalValidation = readJson(FINAL_VALIDATION);
  const handoff = readJson(HANDOFF);
  const manifest = readJson(MANIFEST);
  const finalSeal = readJson(FINAL_SEAL);
  const finalizedAt = receipt.finalizedAt;
  assert.equal(typeof finalizedAt, 'string');

  const expectedReceipt = buildReceipt(inputs, finalizedAt);
  assert.deepEqual(receipt, expectedReceipt, 'Exact G5 certification receipt');
  const receiptRecord = pin(RECEIPT);
  const expectedFinalValidation = buildFinalValidation(inputs, receiptRecord, finalizedAt);
  assert.deepEqual(finalValidation, expectedFinalValidation, 'Exact G5 final validation');
  const finalValidationRecord = pin(FINAL_VALIDATION);
  const expectedHandoff = buildHandoff(inputs, receiptRecord, finalValidationRecord, finalizedAt);
  assert.deepEqual(handoff, expectedHandoff, 'Exact G5 Phase 3D handoff');
  const expectedManifest = buildManifest(
    inputs,
    readRegularBytes(RECEIPT),
    readRegularBytes(FINAL_VALIDATION),
    readRegularBytes(HANDOFF),
    finalizedAt,
  );
  assert.deepEqual(manifest, expectedManifest, 'Exact G5 evidence manifest');
  const expectedFinalSeal = buildFinalSeal(
    inputs,
    receiptRecord,
    finalValidationRecord,
    pin(HANDOFF),
    pin(MANIFEST),
    finalizedAt,
  );
  assert.deepEqual(finalSeal, expectedFinalSeal, 'Exact G5 final seal');
  for (const artifact of [receipt, finalValidation, handoff, manifest, finalSeal]) {
    assertGeneration(artifact.generation, artifact.kind);
    assertAuthoritativeBinding(artifact.authoritativeBinding, artifact.kind, expectedProductionTree);
  }
  return { inputs, receipt, finalValidation, handoff, manifest, finalSeal, expectedPaths: acceptancePaths() };
}

function loadPrefinalWithFinalInventory(expectedProductionTree) {
  const validation = readJson(VALIDATION);
  const plan = readJson(PLAN);
  const seal = readJson(PRE_SEAL);
  const administrative = readJson(ADMINISTRATIVE_ACCEPTANCE);
  assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG5ZeroExecutionValidation');
  assert.equal(validation.result, 'PASS');
  assertGeneration(validation.generation, 'G5 validation');
  assertAuthoritativeBinding(validation.authoritativeBinding, 'G5 validation binding', expectedProductionTree);
  assertZeroExecutions(validation.executionCounts, 'G5 validation');
  assert.deepEqual(validation.authoritativeBinding, readJson(G4_VALIDATION).authoritativeBinding);
  assertPreservedG2(validation.sourceG2, expectedProductionTree);
  assertPriorG3Failure(validation.priorG3Failure, validation.sourceG2, expectedProductionTree);
  const g4 = assertPriorG4Failure(validation.priorG4Failure, validation.sourceG2, validation.priorG3Failure, expectedProductionTree);
  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBG5RecoveryPlan');
  assert.equal(plan.status, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assertGeneration(plan.generation, 'G5 recovery plan');
  assertAuthoritativeBinding(plan.authoritativeBinding, 'G5 recovery plan binding', expectedProductionTree);
  assert.deepEqual(plan.authoritativeBinding, validation.authoritativeBinding);
  assert.deepEqual(plan.validation, pin(VALIDATION));
  assert.deepEqual(plan.sourceG2, validation.sourceG2);
  assert.deepEqual(plan.priorG3Failure, validation.priorG3Failure);
  assert.deepEqual(plan.priorG4Failure, validation.priorG4Failure);
  assert.equal(seal.kind, 'MO1307Phase3CR2C3TBG5PreExecutionSeal');
  assert.equal(seal.result, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assertGeneration(seal.generation, 'G5 pre-execution seal');
  assertAuthoritativeBinding(seal.authoritativeBinding, 'G5 pre-execution seal binding', expectedProductionTree);
  assert.deepEqual(seal.authoritativeBinding, validation.authoritativeBinding);
  assert.deepEqual(seal.validation, pin(VALIDATION));
  assert.deepEqual(seal.recoveryPlan, pin(PLAN));
  assert.deepEqual(seal.sourceG2, validation.sourceG2);
  assert.deepEqual(seal.priorG3Failure, validation.priorG3Failure);
  assert.deepEqual(seal.priorG4Failure, validation.priorG4Failure);
  assertZeroExecutions(seal.executionCounts, 'G5 pre-execution seal');
  const g5Tools = assertG5ToolSeal(plan, seal);
  assertG5SealedSchemas(validation, plan, seal, g5Tools, expectedProductionTree);
  assertG5Administrative(administrative, validation, expectedProductionTree);
  return {
    validation,
    plan,
    seal,
    administrative,
    sourceG2: validation.sourceG2,
    priorG3Failure: validation.priorG3Failure,
    priorG4Failure: validation.priorG4Failure,
    g4,
    g5Tools,
    expectedProductionTree,
  };
}

function assertStagedBlob(relative) {
  const line = gitText(['ls-files', '--stage', '--', relative]);
  const match = /^100644 ([0-9a-f]{40}) 0\t/u.exec(line);
  assert.ok(match, `Not staged as a regular file: ${relative}`);
  assert.equal(match[1], gitBlob(readRegularBytes(relative)), `Staged bytes differ: ${relative}`);
}

function assertExactKnownWhitespaceResult(result, label) {
  assert.equal(result.status, 2, `${label}: fixed Git exit code`);
  assert.equal(result.stderr.toString('utf8'), '', `${label}: stderr`);
  const expectedLines = KNOWN_G4_WHITESPACE_VIOLATIONS.flatMap(violation => [
    `${violation.path}:${violation.line}: ${violation.message}`,
  ]);
  const actualLines = result.stdout.toString('utf8').replaceAll('\r\n', '\n').trimEnd().split('\n');
  assert.deepEqual(actualLines, expectedLines, `${label}: exact two immutable G4 violations and no others`);
}

function assertG5WhitespaceClean(args, label) {
  const result = runGitResult(args);
  assert.equal(result.status, 0, `${label}: fixed Git exit code`);
  assert.equal(result.stdout.toString('utf8'), '', `${label}: stdout`);
  assert.equal(result.stderr.toString('utf8'), '', `${label}: stderr`);
}

function verifyStaged() {
  const expectedProductionTree = assertFixedRuntimeAndHistory();
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB, 'Staged verification parent');
  const artifacts = loadFinal(expectedProductionTree);
  const staged = runGit(['diff', '--cached', '--name-only', '-z', C3TB])
    .toString('utf8').split('\0').filter(Boolean).map(slash).sort(fileOrder);
  assert.deepEqual(staged, artifacts.expectedPaths, 'Exact staged Phase 3CR2 path union');
  assert.equal(gitText(['diff', '--name-only']), '', 'Unstaged tracked changes are forbidden');
  assert.equal(gitText(['diff', '--cached', '--name-only', '--', PRODUCT_RELATIVE]), '', 'Product paths are forbidden');
  const entries = statusEntries();
  assert.equal(entries.length, artifacts.expectedPaths.length);
  assert.deepEqual(entries.map(entry => entry.path).sort(fileOrder), artifacts.expectedPaths);
  assert.equal(entries.every(entry => entry.status === 'A '), true, 'Every acceptance path must have A-only status');
  for (const relative of artifacts.expectedPaths) assertStagedBlob(relative);
  assertExactKnownWhitespaceResult(runGitResult(['diff', '--cached', '--check']), 'Full staged whitespace check');
  assertG5WhitespaceClean(
    ['diff', '--cached', '--check', '--', G5_TOOL_RELATIVE, G5_EVIDENCE_RELATIVE],
    'G5 staged whitespace check',
  );
  process.stdout.write(`${canonical({
    mode: '--verify-staged',
    result: 'PASS_STAGED_ACCEPTANCE',
    acceptanceState: 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    files: artifacts.expectedPaths.length,
    parent: C3TB,
    exactImmutableG4WhitespaceViolations: KNOWN_G4_WHITESPACE_VIOLATIONS,
    g5WhitespaceViolations: 0,
    productionChanged: false,
    next: 'Create one single-parent acceptance commit without amendment, then run --verify-committed. Do not push or tag.',
  })}\n`);
}

function verifyCommitted() {
  const expectedProductionTree = assertFixedRuntimeAndHistory();
  const head = gitText(['rev-parse', 'HEAD']);
  assert.notEqual(head, C3TB, 'Acceptance commit is missing');
  assert.equal(gitText(['show', '-s', '--format=%P', head]), C3TB, 'Acceptance commit parent');
  assert.equal(gitText(['rev-list', '--parents', '-n', '1', head]).split(' ').length, 2, 'Acceptance commit must have exactly one parent');
  const artifacts = loadFinal(expectedProductionTree);
  const changed = runGit(['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', C3TB, head])
    .toString('utf8').split('\0').filter(Boolean).map(slash).sort(fileOrder);
  assert.deepEqual(changed, artifacts.expectedPaths, 'Exact committed Phase 3CR2 path union');
  const nameStatus = runGit(['diff-tree', '--no-commit-id', '--name-status', '-r', '-z', C3TB, head])
    .toString('utf8').split('\0').filter(Boolean);
  assert.equal(nameStatus.length, artifacts.expectedPaths.length * 2, 'Committed name-status arity');
  for (let index = 0; index < nameStatus.length; index += 2) {
    assert.equal(nameStatus[index], 'A', `Committed path is not A-only: ${nameStatus[index + 1]}`);
  }
  assert.equal(gitText(['rev-parse', `${head}:${PRODUCT_RELATIVE}`]), expectedProductionTree, 'Committed production tree');
  assert.equal(gitText(['diff', '--name-only', C3TB, head, '--', PRODUCT_RELATIVE]), '', 'Committed product changes');
  for (const relative of artifacts.expectedPaths) {
    assert.equal(gitText(['rev-parse', `${head}:${relative}`]), gitBlob(readRegularBytes(relative)), `Committed bytes differ: ${relative}`);
  }
  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all']), '', 'Repository must be clean');
  assertExactKnownWhitespaceResult(runGitResult(['diff', '--check', C3TB, head]), 'Full committed whitespace check');
  assertG5WhitespaceClean(
    ['diff', '--check', C3TB, head, '--', G5_TOOL_RELATIVE, G5_EVIDENCE_RELATIVE],
    'G5 committed whitespace check',
  );
  process.stdout.write(`${canonical({
    mode: '--verify-committed',
    result: 'PHASE3CR2_ACCEPTED',
    commit: head,
    parent: C3TB,
    branch: BRANCH,
    repositoryStatus: 'CLEAN',
    files: artifacts.expectedPaths.length,
    productionTree: expectedProductionTree,
    productChanged: false,
    freshExecutedInG5: 0,
    freshAcceptedFromG4: 89,
    reusedExactAcceptedFromG4: 462,
    candidateSpecificAcceptedFromG4: 2,
    preservedG2Outcome: 'PHASE3CR2_FAILED_INCOMPLETE',
    preservedG3Outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    preservedG4Outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    exactImmutableG4WhitespaceViolations: KNOWN_G4_WHITESPACE_VIOLATIONS,
    g5WhitespaceViolations: 0,
    receipt: pin(RECEIPT),
    finalValidation: pin(FINAL_VALIDATION),
    phase3DHandoff: pin(HANDOFF),
    finalSeal: pin(FINAL_SEAL),
    phase3DExecuted: false,
  })}\n`);
}

try {
  assert.equal(process.argv.length, 3, 'Use exactly one mode.');
  const mode = process.argv[2];
  if (mode === '--write') writeFinal();
  else if (mode === '--verify-staged') verifyStaged();
  else if (mode === '--verify-committed') verifyCommitted();
  else throw new Error('Use --write, --verify-staged, or --verify-committed.');
} catch (error) {
  process.stderr.write(`${canonical({
    result: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    mode: process.argv[2] ?? null,
    error: {
      name: error?.name ?? 'Error',
      code: error?.code ?? null,
      message: error?.message ?? String(error),
      stack: error?.stack ?? null,
    },
  })}\n`);
  process.exitCode = 1;
}
