// Append-only Phase 3CR2 G5 acceptance-only administrative recovery.
//
// This program consumes the sealed G5 validation, plan, and pre-execution
// seal; verifies the immutable G2, G3, and G4 record; and never launches a
// product, helper, worker, native control, security control, or network operation.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { verifyRecoveryChain } from './recovery-static-lib.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
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
const BRANCH = 'codex/mo1307-phase3cr2-c3tb';

const C3T = '65e24b2debdd70ecb8e52fbccbd6c101621f1917';
const C3TB = '119e68bdcf0ffc906b4ca03a912aadcb25908346';
const C3TB_TREE = '5e0088965d4eac4002165fe0190f275c257985ba';
const HELPER_SHA256 = 'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127';
const HELPER_BLOB = '7ca55b8713108465099ecfce9796e06e3db67bd2';
const ACCEPTED_PHASE3BR2 = '4d92f0f21c9c3aad8202f4558d61b9229c7214fc';
const ACCEPTED_PHASE3BR2_TREE = '7d07f5f570248f8159339ae33637194937cf4918';

const PRODUCT = 'repositories/memoryos-readiness';
const HELPER = PRODUCT + '/helpers/windows-inspect.ps1';
const ORIGINAL_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb';
const ORIGINAL_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb';
const G2_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g2';
const G2_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2';
const G2_VALIDATION = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2-harness-validation';
const G2_LEDGER = G2_EVIDENCE + '/execution-ledger.json';
const G3_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g3';
const G3_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g3';
const G4_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g4';
const G4_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g4';
const G5_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g5';
const G5_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g5';

const VALIDATION = G5_EVIDENCE + '/zero-execution-validation.json';
const PLAN = G5_EVIDENCE + '/recovery-plan.json';
const PRE_SEAL = G5_EVIDENCE + '/pre-execution-seal.json';
const OUTPUT = G5_EVIDENCE + '/administrative-acceptance-recovery.json';
const G5_PLANNED_OUTPUTS = Object.freeze([
  VALIDATION,
  PLAN,
  PRE_SEAL,
  OUTPUT,
  G5_EVIDENCE + '/certification-receipt.json',
  G5_EVIDENCE + '/final-validation.json',
  G5_EVIDENCE + '/phase3d-handoff.json',
  G5_EVIDENCE + '/evidence-manifest.json',
  G5_EVIDENCE + '/final-seal.json',
]);
const G5_TOOL_FILES = Object.freeze([
  'README.md',
  'accept.mjs',
  'binding-lib.mjs',
  'finalize.mjs',
  'preflight.mjs',
  'recovery-static-lib.mjs',
  'validate-recovery.mjs',
]);
const G4_EVIDENCE_FILES = Object.freeze([
  'administrative-recovery.json',
  'candidate-specific-controls.json',
  'certification-receipt.json',
  'evidence-manifest.json',
  'final-seal.json',
  'final-validation.json',
  'fresh-control-results.json',
  'phase3d-handoff.json',
  'pre-execution-seal.json',
  'recovery-plan.json',
  'source-security-reviews.json',
  'zero-execution-validation.json',
]);
const G4_ARTIFACTS = Object.freeze({
  validation: G4_EVIDENCE + '/zero-execution-validation.json',
  plan: G4_EVIDENCE + '/recovery-plan.json',
  preExecutionSeal: G4_EVIDENCE + '/pre-execution-seal.json',
  fresh: G4_EVIDENCE + '/fresh-control-results.json',
  candidate: G4_EVIDENCE + '/candidate-specific-controls.json',
  reviews: G4_EVIDENCE + '/source-security-reviews.json',
  administrativeRecovery: G4_EVIDENCE + '/administrative-recovery.json',
  receipt: G4_EVIDENCE + '/certification-receipt.json',
  finalValidation: G4_EVIDENCE + '/final-validation.json',
  phase3DHandoff: G4_EVIDENCE + '/phase3d-handoff.json',
  manifest: G4_EVIDENCE + '/evidence-manifest.json',
  finalSeal: G4_EVIDENCE + '/final-seal.json',
});

const GENERATION = Object.freeze({
  id: 'phase3cr2-c3tb-g5',
  ordinal: 5,
  mode: 'ACCEPTANCE_ONLY_FROM_IMMUTABLE_G4_AFTER_FAILED_STAGED_VERIFICATION',
  resumesPriorAttempt: false,
  sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
  priorRecoveryGeneration: 'phase3cr2-c3tb-g4',
});
const G4_GENERATION = Object.freeze({
  id: 'phase3cr2-c3tb-g4',
  ordinal: 4,
  mode: 'RECONCILIATION_ONLY_FROM_IMMUTABLE_G2_AFTER_FAILED_G3',
  resumesPriorAttempt: false,
  sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
  priorRecoveryGeneration: 'phase3cr2-c3tb-g3',
});
const ZERO_EXECUTIONS = Object.freeze({
  helper: 0,
  worker: 0,
  product: 0,
  security: 0,
  native: 0,
  network: 0,
  certification: 0,
});
const G4_TOOL_DIGEST = 'sha256:5345190df10de4554df711051b41063cc2b479de3a00e16dd4013e757f1e51aa';
const G4_EVIDENCE_DIGEST = 'sha256:285b34e2d82af75ae683d426e88f4f22d3e39d454f04d6946a65d4caea14deca';
const G2_TOOL_DIGEST = 'sha256:338da32c0b9c500bf19adaa9d7c5adb5fda8be0646ffb9319eff8a6de5c1a646';
const G2_EVIDENCE_DIGEST = 'sha256:eca2a9b239253173e76e40e13f9d4614b5039b226215760042a64677695e4416';
const G3_TOOL_DIGEST = 'sha256:cb80849ddec5df31f314f51fc397140f82452ada1e83da495caa630f5263527d';
const G3_EVIDENCE_DIGEST = 'sha256:66e59061edace9359f18d796511cc2c25791ce972a87f779f89321a9329ebe87';
const EXPECTED_G4_VIOLATIONS = Object.freeze([
  {
    path: G4_TOOL + '/binding-lib.mjs',
    line: 271,
    message: 'new blank line at EOF.',
    tailHex: '207d293b0a7d0a0a',
  },
  {
    path: G4_TOOL + '/recovery-static-lib.mjs',
    line: 551,
    message: 'new blank line at EOF.',
    tailHex: '207d293b0a7d0a0a',
  },
]);
const ACCEPTANCE_ROOTS_G4 = Object.freeze([
  ORIGINAL_TOOL,
  ORIGINAL_EVIDENCE,
  G2_VALIDATION,
  G2_TOOL,
  G2_EVIDENCE,
  G3_TOOL,
  G3_EVIDENCE,
  G4_TOOL,
  G4_EVIDENCE,
]);
const G2_FORBIDDEN_TERMINAL_OUTPUTS = Object.freeze([
  G2_EVIDENCE + '/fresh-control-results.json',
  G2_EVIDENCE + '/candidate-specific-controls.json',
  G2_EVIDENCE + '/source-security-reviews.json',
  G2_EVIDENCE + '/certification-receipt.json',
  G2_EVIDENCE + '/final-validation.json',
  G2_EVIDENCE + '/final-review.json',
  G2_EVIDENCE + '/phase3d-handoff.json',
  G2_EVIDENCE + '/evidence-manifest.json',
  G2_EVIDENCE + '/final-seal.json',
]);
const G3_FORBIDDEN_RECONCILIATION_OUTPUTS = Object.freeze([
  G3_EVIDENCE + '/fresh-control-results.json',
  G3_EVIDENCE + '/candidate-specific-controls.json',
  G3_EVIDENCE + '/source-security-reviews.json',
  G3_EVIDENCE + '/administrative-recovery.json',
]);

const ordinal = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const fileOrder = (left, right) => left.localeCompare(right, 'en');
const slash = value => value.replaceAll('\\', '/');
const sha256 = data => 'sha256:' + crypto.createHash('sha256').update(data).digest('hex');
const gitBlob = data => crypto.createHash('sha1')
  .update(Buffer.from('blob ' + data.length + '\0'))
  .update(data)
  .digest('hex');

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort(ordinal).map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

function absolute(relative) {
  const resolved = path.resolve(ROOT, relative);
  const prefix = path.resolve(ROOT) + path.sep;
  assert.ok(resolved.startsWith(prefix), 'Path escapes worktree: ' + relative);
  return resolved;
}

function runGit(args, options = {}) {
  const result = spawnSync(GIT, [
    '-c', 'core.longpaths=true',
    '-c', 'safe.directory=' + slash(path.resolve(ROOT)),
    ...args,
  ], {
    cwd: ROOT,
    encoding: null,
    windowsHide: true,
    shell: false,
    maxBuffer: 512 * 1024 * 1024,
    ...options,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, GIT + ' ' + args.join(' ') + ': ' + (result.stderr || Buffer.alloc(0)).toString('utf8'));
  return result.stdout;
}
const gitText = args => runGit(args).toString('utf8').trim();

function regularBytes(relative) {
  const target = absolute(relative);
  const stat = fs.lstatSync(target);
  assert.equal(stat.isSymbolicLink(), false, 'Symlink is forbidden: ' + relative);
  assert.equal(stat.isFile(), true, 'Expected regular file: ' + relative);
  return fs.readFileSync(target);
}

function fileRecord(relative, includeGitBlob = true) {
  const normalized = slash(relative);
  const bytes = regularBytes(normalized);
  const record = { path: normalized, byteLength: bytes.length, sha256: sha256(bytes) };
  if (includeGitBlob) record.gitBlob = gitBlob(bytes);
  return record;
}

function filePin(relative) {
  const record = fileRecord(relative, false);
  return { path: record.path, byteLength: record.byteLength, sha256: record.sha256 };
}

function walkFiles(relativeRoot) {
  const base = absolute(relativeRoot);
  assert.equal(fs.lstatSync(base).isDirectory(), true, 'Expected directory: ' + relativeRoot);
  const records = [];
  const visit = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const relative = slash(path.relative(ROOT, full));
      assert.equal(entry.isSymbolicLink(), false, 'Symlink is forbidden: ' + relative);
      if (entry.isDirectory()) visit(full);
      else {
        assert.equal(entry.isFile(), true, 'Expected regular file: ' + relative);
        records.push(fileRecord(relative));
      }
    }
  };
  visit(base);
  return records.sort((left, right) => fileOrder(left.path, right.path));
}

function closureSnapshot(relativeRoot, includeGitBlob = true) {
  assert.equal(includeGitBlob, true, 'Acceptance closures must include gitBlob records.');
  const files = walkFiles(relativeRoot);
  return {
    path: slash(relativeRoot),
    fileCount: files.length,
    digest: sha256(Buffer.from(canonical(files) + '\n', 'utf8')),
    files,
  };
}

function readJson(relative) {
  const bytes = regularBytes(relative);
  assert.ok(bytes.length > 1, 'Empty JSON artifact: ' + relative);
  assert.equal(bytes.at(-1), 0x0a, 'JSON must end in LF: ' + relative);
  assert.notEqual(bytes.at(-2), 0x0a, 'JSON must have exactly one EOF newline: ' + relative);
  return JSON.parse(bytes.toString('utf8'));
}

function assertExactFlatRegularFiles(relativeRoot, expectedNames, label) {
  const directory = absolute(relativeRoot);
  assert.equal(fs.lstatSync(directory).isDirectory(), true, label + ': missing directory');
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    assert.equal(entry.isSymbolicLink(), false, label + ': symlink forbidden: ' + entry.name);
    assert.equal(entry.isFile(), true, label + ': nested/non-file entry forbidden: ' + entry.name);
  }
  assert.deepEqual(entries.map(entry => entry.name).sort(fileOrder), [...expectedNames].sort(fileOrder), label + ': exact flat inventory');
}

function assertClosure(actual, expectedPath, expectedCount, expectedDigest) {
  assert.equal(actual.path, expectedPath);
  assert.equal(actual.fileCount, expectedCount);
  assert.equal(actual.digest, expectedDigest);
  assert.equal(actual.files.length, expectedCount);
  assert.deepEqual(actual.files.map(record => record.path), [...actual.files.map(record => record.path)].sort(fileOrder));
  for (const record of actual.files) assert.deepEqual(record, fileRecord(record.path));
}

function assertZeroExecutions(actual, label) {
  assert.deepEqual(actual, ZERO_EXECUTIONS, label + ': zero-execution invariant');
}

function assertRuntimeAndRepository() {
  assert.equal(process.version, EXPECTED_NODE.version);
  assert.equal(process.platform, EXPECTED_NODE.platform);
  assert.equal(process.arch, EXPECTED_NODE.arch);
  assert.equal(path.resolve(process.execPath).toLowerCase(), path.resolve(EXPECTED_NODE_PATH).toLowerCase());
  const nodeBytes = fs.readFileSync(process.execPath);
  assert.equal(nodeBytes.length, EXPECTED_NODE.byteLength);
  assert.equal(sha256(nodeBytes), EXPECTED_NODE.sha256);
  assert.equal(gitText(['--version']), EXPECTED_GIT_VERSION);
  assert.equal(gitText(['rev-parse', '--show-toplevel']).toLowerCase(), path.resolve(ROOT).toLowerCase());
  assert.equal(gitText(['symbolic-ref', '--short', 'HEAD']), BRANCH);
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB, 'No G4 acceptance commit may exist.');
  assert.equal(gitText(['rev-parse', C3TB + '^{tree}']), C3TB_TREE);
  assert.deepEqual(gitText(['show', '-s', '--format=%P', C3TB]).split(/\s+/), [C3T]);
  const c3tProductionTree = gitText(['rev-parse', C3T + ':' + PRODUCT]);
  const c3tbProductionTree = gitText(['rev-parse', C3TB + ':' + PRODUCT]);
  assert.match(c3tProductionTree, /^[0-9a-f]{40}$/u);
  assert.equal(c3tbProductionTree, c3tProductionTree, 'C3T and C3TB production subtrees differ.');
  assert.equal(gitText(['rev-parse', ACCEPTED_PHASE3BR2 + '^{tree}']), ACCEPTED_PHASE3BR2_TREE);
  assert.equal(runGit(['diff', '--quiet', C3TB, '--', PRODUCT]).length, 0);
  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all', '--', PRODUCT]), '');
  const helperBytes = regularBytes(HELPER);
  assert.equal(sha256(helperBytes), HELPER_SHA256);
  assert.equal(gitBlob(helperBytes), HELPER_BLOB);
  return c3tProductionTree;
}

function assertAuthoritativeBinding(binding, label, productionTree) {
  assert.equal(binding.result, 'PASS', label + ': binding result');
  assert.equal(binding.identityKind, 'EXACT_C3TB_BINDING', label + ': identity kind');
  assert.equal(binding.candidate.commit, C3TB, label + ': candidate commit');
  assert.equal(binding.candidate.tree, C3TB_TREE, label + ': candidate tree');
  assert.equal(binding.candidate.soleParent, C3T, label + ': candidate parent');
  assert.equal(binding.production.commit, C3T, label + ': production commit');
  assert.equal(binding.production.tree, productionTree, label + ': production tree');
  assert.equal(binding.helper.path, HELPER, label + ': helper path');
  assert.equal(binding.helper.sha256, HELPER_SHA256, label + ': helper hash');
  assert.equal(binding.helper.gitBlob, HELPER_BLOB, label + ': helper blob');
  assert.equal(binding.nonAuthoritativePlaceholders.excludedFromDerivation, true, label + ': placeholders excluded');
  for (const authority of binding.productionTreeAuthorities) assert.equal(authority.value, productionTree, label + ': production tree authority');
  for (const authority of binding.productionCommitAuthorities) assert.equal(authority.value, C3T, label + ': production commit authority');
  for (const authority of binding.helperAuthorities.paths) assert.equal(authority.value, HELPER, label + ': helper path authority');
  for (const authority of binding.helperAuthorities.sha256) assert.equal(authority.value, HELPER_SHA256, label + ': helper hash authority');
  for (const authority of binding.helperAuthorities.gitBlobs) assert.equal(authority.value, HELPER_BLOB, label + ': helper blob authority');
}

function assertPreservedG2(sourceG2) {
  assert.equal(sourceG2.ledger.result, 'FAILED_INCOMPLETE');
  assert.equal(sourceG2.ledger.outcome, 'PHASE3CR2_FAILED_INCOMPLETE');
  assert.equal(sourceG2.ledger.firstFailure.stage, 'CASE_SENSITIVE_RECONCILIATION');
  assert.equal(sourceG2.ledger.firstFailure.ordinal, 9);
  assert.equal(sourceG2.ledger.firstFailure.integrity.result, 'PASS');
  assert.deepEqual(sourceG2.ledger.stages.slice(0, 8).map(stage => stage.status), Array(8).fill('PASS'));
  assert.equal(sourceG2.ledger.stages[8].status, 'FAIL');
  assert.deepEqual(sourceG2.ledger.stages.map(stage => stage.integrity.result), Array(9).fill('PASS'));
  assertClosure(sourceG2.tools, G2_TOOL, 18, G2_TOOL_DIGEST);
  assertClosure(sourceG2.evidence, G2_EVIDENCE, 1043, G2_EVIDENCE_DIGEST);
  assert.deepEqual(closureSnapshot(G2_TOOL, true), sourceG2.tools);
  assert.deepEqual(closureSnapshot(G2_EVIDENCE, true), sourceG2.evidence);
  const ledger = readJson(G2_LEDGER);
  assert.equal(ledger.result, 'FAILED_INCOMPLETE');
  assert.equal(ledger.outcome, 'PHASE3CR2_FAILED_INCOMPLETE');
  assert.equal(ledger.stages.length, 9);
  assert.deepEqual(ledger.stages.slice(0, 8).map(stage => stage.status), Array(8).fill('PASS'));
  assert.equal(ledger.stages[8].status, 'FAIL');
  assert.deepEqual(ledger.stages.map(stage => stage.integrity.result), Array(9).fill('PASS'));
  for (const relative of G2_FORBIDDEN_TERMINAL_OUTPUTS) assert.equal(fs.existsSync(absolute(relative)), false, 'G2 terminal output must remain absent: ' + relative);
}

function assertPreservedG3(priorG3) {
  assert.equal(priorG3.result, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(priorG3.outcome, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.deepEqual(priorG3.classification, ['MISSING_PROPAGATION', 'OTHER_CONCRETE_RECONCILIATION_DEFECT']);
  assert.equal(priorG3.failure.code, 'ERR_ASSERTION');
  assert.equal(priorG3.failure.path, G3_TOOL + '/reconcile.mjs');
  assert.equal(priorG3.failure.line, 677);
  assert.equal(priorG3.cause.missingField, 'git.helperCheckout.gitBlob');
  assert.equal(priorG3.cause.onlyDifference, 'authoritativeBinding.helperAuthorities.gitBlobs[checkout.helper.gitBlob]');
  assert.equal(priorG3.sourceIntegrity.mechanicallyReproduced, true);
  assertClosure(priorG3.tools, G3_TOOL, 7, G3_TOOL_DIGEST);
  assertClosure(priorG3.evidence, G3_EVIDENCE, 3, G3_EVIDENCE_DIGEST);
  assert.deepEqual(closureSnapshot(G3_TOOL, true), priorG3.tools);
  assert.deepEqual(closureSnapshot(G3_EVIDENCE, true), priorG3.evidence);
  for (const relative of G3_FORBIDDEN_RECONCILIATION_OUTPUTS) assert.equal(fs.existsSync(absolute(relative)), false, 'G3 reconciliation output must remain absent: ' + relative);
}

function assertPriorG4Failure(priorG4, g4Tools, g4Evidence) {
  assert.deepEqual(priorG4.generation, G4_GENERATION);
  assert.equal(priorG4.result, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(priorG4.outcome, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(priorG4.phase, 'STAGED_ACCEPTANCE_VERIFICATION');
  assert.deepEqual(priorG4.classification, ['OTHER_CONCRETE_RECONCILIATION_DEFECT']);
  assert.equal(priorG4.classificationLabel, 'OTHER_CONCRETE_RECONCILIATION_DEFECT/GIT_DIFF_CHECK_EXACT_KNOWN_VIOLATIONS');
  assert.deepEqual(priorG4.failure, {
    code: 'GIT_DIFF_CHECK',
    exitCode: 2,
    path: G4_TOOL + '/finalize.mjs',
    line: 1354,
    assertion: "runGit(['diff', '--cached', '--check']);",
  });
  assert.deepEqual(priorG4.violations, EXPECTED_G4_VIOLATIONS);
  assert.deepEqual(priorG4.passedBeforeFailure, {
    exactStagedPathUnion: true,
    pathCount: 1300,
    allPathsAOnly: true,
    allStagedBlobsByteExact: true,
    productPathsAbsent: true,
    unstagedTrackedChangesAbsent: true,
  });
  assert.equal(priorG4.acceptanceCommitCreated, false);
  assert.deepEqual(priorG4.tools, g4Tools);
  assert.deepEqual(priorG4.evidence, g4Evidence);
  assert.equal(priorG4.sourceIntegrity.mechanicallyReproduced, true);
  assert.equal(priorG4.sourceIntegrity.onlyKnownViolations, true);

  const finalizerLines = regularBytes(G4_TOOL + '/finalize.mjs').toString('utf8').split(/\r?\n/);
  assert.equal(finalizerLines[1353], "  runGit(['diff', '--cached', '--check']);");
  for (const violation of EXPECTED_G4_VIOLATIONS) {
    const bytes = regularBytes(violation.path);
    assert.equal(bytes.subarray(-8).toString('hex'), violation.tailHex);
    assert.equal(bytes.toString('utf8').split(/\r?\n/)[violation.line - 1], '');
  }
  const acceptancePaths = ACCEPTANCE_ROOTS_G4.flatMap(root => walkFiles(root).map(record => record.path));
  assert.equal(new Set(acceptancePaths).size, acceptancePaths.length, 'G4 acceptance path union must be duplicate-free.');
  assert.equal(acceptancePaths.length, 1300, 'G4 acceptance path union count');
}

function verifyG4Artifacts(g4Tools, g4Evidence, productionTree) {
  assertExactFlatRegularFiles(G4_TOOL, [
    'README.md',
    'binding-lib.mjs',
    'finalize.mjs',
    'preflight.mjs',
    'reconcile.mjs',
    'recovery-static-lib.mjs',
    'validate-recovery.mjs',
  ], 'immutable G4 tool namespace');
  assertExactFlatRegularFiles(G4_EVIDENCE, G4_EVIDENCE_FILES, 'immutable G4 evidence namespace');
  assertClosure(g4Tools, G4_TOOL, 7, G4_TOOL_DIGEST);
  assertClosure(g4Evidence, G4_EVIDENCE, 12, G4_EVIDENCE_DIGEST);

  const artifacts = Object.fromEntries(Object.entries(G4_ARTIFACTS).map(([key, relative]) => [key, readJson(relative)]));
  const binding = artifacts.validation.authoritativeBinding;
  const sourceG2 = artifacts.validation.sourceG2;
  const priorG3 = artifacts.validation.priorG3Failure;
  assertAuthoritativeBinding(binding, 'G4 validation', productionTree);
  assertPreservedG2(sourceG2);
  assertPreservedG3(priorG3);

  for (const key of ['validation', 'plan', 'preExecutionSeal', 'administrativeRecovery', 'receipt', 'finalValidation', 'phase3DHandoff', 'manifest', 'finalSeal']) {
    assert.deepEqual(artifacts[key].generation, G4_GENERATION, key + ': exact G4 generation');
    assert.deepEqual(artifacts[key].authoritativeBinding, binding, key + ': exact G4 binding');
    assert.deepEqual(artifacts[key].priorG3Failure, priorG3, key + ': exact G3 failure');
  }
  assert.deepEqual(artifacts.plan.sourceG2, sourceG2);
  assert.deepEqual(artifacts.preExecutionSeal.sourceG2, sourceG2);
  assert.deepEqual(artifacts.administrativeRecovery.sourceG2, sourceG2);

  assert.equal(artifacts.administrativeRecovery.kind, 'MO1307Phase3CR2C3TBG4AdministrativeRecovery');
  assert.equal(artifacts.administrativeRecovery.result, 'PASS');
  assert.equal(artifacts.administrativeRecovery.outcome, 'RECONCILIATION_COMPLETE');
  assert.deepEqual(artifacts.administrativeRecovery.reconciliation, {
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
  assertZeroExecutions(artifacts.administrativeRecovery.executionCounts, 'G4 administrative recovery');

  assert.equal(artifacts.receipt.kind, 'MO1307Phase3CR2C3TBG4CertificationReceipt');
  assert.equal(artifacts.receipt.result, 'PASS');
  assert.equal(artifacts.receipt.phase3CR2, 'ACCEPTED');
  assert.equal(artifacts.receipt.status, 'PHASE3CR2_ACCEPTED');
  assert.deepEqual(artifacts.receipt.controls, {
    freshExecutedInG4: 0,
    freshAcceptedFromG2: 89,
    reusedExactAcceptedFromG2: 462,
    candidateSpecificAcceptedFromG2: 2,
    sourceSecurityReviewsAcceptedFromG2: 12,
    totalHistoricalInventory: 551,
    unresolved: 0,
    omissions: 0,
    duplicateIds: 0,
    overlaps: 0,
    mismatches: 0,
  });
  assertZeroExecutions(artifacts.receipt.executionCounts, 'G4 receipt');
  assert.equal(artifacts.receipt.preservedG2.outcome, 'PHASE3CR2_FAILED_INCOMPLETE');
  assert.equal(artifacts.receipt.preservedG2.immutable, true);
  assert.equal(artifacts.receipt.preservedG2.modified, false);
  assert.equal(artifacts.receipt.preservedG3.outcome, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(artifacts.receipt.preservedG3.immutable, true);
  assert.equal(artifacts.receipt.preservedG3.modified, false);

  assert.equal(artifacts.finalValidation.kind, 'MO1307Phase3CR2C3TBG4FinalValidation');
  assert.equal(artifacts.finalValidation.result, 'PASS_ACCEPTANCE_SUPPORTED');
  assert.equal(artifacts.finalValidation.outcome, 'PHASE3CR2_ACCEPTED');
  assert.equal(artifacts.finalValidation.checks.fresh.actual, 89);
  assert.equal(artifacts.finalValidation.checks.reuse.actual, 462);
  assert.equal(artifacts.finalValidation.checks.candidateSpecific.actual, 2);
  assert.equal(artifacts.finalValidation.checks.reviews.actual, 12);
  for (const field of ['unresolved', 'omissions', 'duplicateIds', 'overlaps', 'mismatches']) assert.equal(artifacts.finalValidation.checks[field], 0);
  assertZeroExecutions(artifacts.finalValidation.executionCounts, 'G4 final validation');

  assert.equal(artifacts.phase3DHandoff.kind, 'MO1307Phase3CR2C3TBG4Phase3DHandoff');
  assert.equal(artifacts.phase3DHandoff.result, 'READY_NOT_EXECUTED');
  assert.equal(artifacts.phase3DHandoff.phase3CR2, 'ACCEPTED');
  assert.equal(artifacts.phase3DHandoff.phase3DExecuted, false);
  assert.equal(artifacts.phase3DHandoff.phase3DExecutionAuthorized, false);
  assertZeroExecutions(artifacts.phase3DHandoff.executionCounts, 'G4 Phase 3D handoff');

  assert.equal(artifacts.manifest.kind, 'MO1307Phase3CR2C3TBG4EvidenceManifest');
  assert.equal(artifacts.manifest.result, 'PASS');
  assert.equal(artifacts.manifest.phase3CR2, 'ACCEPTED');
  assert.equal(artifacts.manifest.memberCount, artifacts.manifest.members.length);
  assert.deepEqual(artifacts.manifest.excludes, [G4_ARTIFACTS.manifest, G4_ARTIFACTS.finalSeal]);
  for (const record of artifacts.manifest.members) assert.deepEqual(record, fileRecord(record.path), 'G4 manifest member changed: ' + record.path);
  assertZeroExecutions(artifacts.manifest.executionCounts, 'G4 manifest');

  assert.equal(artifacts.finalSeal.kind, 'MO1307Phase3CR2C3TBG4FinalSeal');
  assert.equal(artifacts.finalSeal.result, 'PASS');
  assert.equal(artifacts.finalSeal.phase3CR2, 'ACCEPTED');
  assert.equal(artifacts.finalSeal.phase3DExecuted, false);
  assert.equal(artifacts.finalSeal.push, false);
  assert.equal(artifacts.finalSeal.tag, false);
  assertZeroExecutions(artifacts.finalSeal.executionCounts, 'G4 final seal');
  for (const record of [
    artifacts.finalSeal.manifest,
    artifacts.finalSeal.receipt,
    artifacts.finalSeal.finalValidation,
    artifacts.finalSeal.phase3DHandoff,
    artifacts.finalSeal.zeroExecutionValidation,
    artifacts.finalSeal.recoveryPlan,
    artifacts.finalSeal.preExecutionSeal,
    artifacts.finalSeal.administrativeRecovery,
  ]) assert.deepEqual(record, filePin(record.path));

  return { artifacts, binding, sourceG2, priorG3 };
}

function assertG5SealedInputs(validation, plan, seal, g5Tools, prior) {
  assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG5ZeroExecutionValidation');
  assert.equal(validation.result, 'PASS');
  assert.deepEqual(validation.generation, GENERATION);
  assertAuthoritativeBinding(validation.authoritativeBinding, 'G5 validation', prior.productionTree);
  assert.equal(validation.productionTree, prior.productionTree);
  assertZeroExecutions(validation.executionCounts, 'G5 validation');
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

  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBG5RecoveryPlan');
  assert.equal(plan.status, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assert.deepEqual(plan.generation, GENERATION);
  assert.equal(plan.finalizedToolInputCount, 7);
  assert.deepEqual(plan.finalizedToolInputs, g5Tools.files);
  assert.equal(plan.finalizedToolSetDigest, g5Tools.digest);
  assert.deepEqual(plan.outputs, G5_PLANNED_OUTPUTS);
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

  assert.equal(seal.kind, 'MO1307Phase3CR2C3TBG5PreExecutionSeal');
  assert.equal(seal.result, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assert.deepEqual(seal.generation, GENERATION);
  assert.equal(seal.finalizedToolInputCount, 7);
  assert.deepEqual(seal.finalizedToolInputs, g5Tools.files);
  assert.equal(seal.finalizedToolSetDigest, g5Tools.digest);
  assertZeroExecutions(seal.executionCounts, 'G5 pre-execution seal');
  assert.equal(seal.appendOnly, true);

  for (const artifact of [plan, seal]) {
    assert.deepEqual(artifact.authoritativeBinding, validation.authoritativeBinding);
    assert.equal(artifact.productionTree, prior.productionTree);
    assert.deepEqual(artifact.sourceG2, validation.sourceG2);
    assert.deepEqual(artifact.priorG3Failure, validation.priorG3Failure);
    assert.deepEqual(artifact.priorG4Failure, validation.priorG4Failure);
    assert.deepEqual(artifact.executionPolicy, plan.executionPolicy);
  }
  assert.deepEqual(validation.authoritativeBinding, prior.binding);
  assert.deepEqual(validation.sourceG2, prior.sourceG2);
  assert.deepEqual(validation.priorG3Failure, prior.priorG3);
  assert.deepEqual(validation.priorG4Failure, prior.priorG4Failure);
  assert.deepEqual(plan.validation, filePin(VALIDATION));
  assert.deepEqual(seal.validation, filePin(VALIDATION));
  assert.deepEqual(seal.recoveryPlan, filePin(PLAN));
}

function authorityCitations() {
  return [
    { path: G2_TOOL + '/README.md', range: '41-44', rule: 'FIRST_MANDATORY_FAILURE_TERMINATES_THE_GENERATION_WITHOUT_RETRY_OR_IN_CAMPAIGN_REPAIR' },
    { path: G2_TOOL + '/run.mjs', range: '422,477,598-612', rule: 'FAILED_G2_LEDGER_AND_STAGE_INTEGRITY_ARE_APPEND_ONLY_TERMINAL_EVIDENCE' },
    { path: G2_TOOL + '/finalize.mjs', range: '1056-1058', rule: 'FINALIZATION_REQUIRES_A_COMPLETE_RECONCILIATION_AND_CANNOT_RELABEL_A_FAILED_LEDGER' },
    { path: G3_TOOL + '/reconcile.mjs', range: '431,677', rule: 'FAILED_G3_RECONCILIATION_IS_PRESERVED_AND_SUPERSEDED_ONLY_BY_REFERENCE' },
    { path: G4_TOOL + '/finalize.mjs', range: '1354', rule: 'FAILED_G4_STAGED_ACCEPTANCE_VERIFICATION_IS_PRESERVED_AND_CORRECTED_ONLY_IN_NEW_G5' },
    { path: 'repositories/cca-conformance/docs/certification-guide.md', range: '98-99', rule: 'RETAINED_OUTPUTS_USE_EXCLUSIVE_CREATION_AND_LATER_ASSESSMENTS_USE_NEW_VERSIONED_PATHS' },
    { path: 'repositories/cca-conformance/README.md', range: '223-225', rule: 'PUBLISHED_EVIDENCE_IS_IMMUTABLE_AND_POST_GENERATION_VALIDATION_IS_SEPARATE' },
    { path: 'repositories/cca-conformance/docs/mo1302-handoff.md', range: '67-68', rule: 'FAILED_OR_SUPERSEDED_GENERATIONS_REMAIN_PRESERVED_AND_MUST_NOT_BE_PROMOTED' },
    { path: 'repositories/cca-conformance/evidence/mo1307/replacement-helper-bound-characterization/administrative-closure-recovery/recover-hardened.mjs', range: '144-192', rule: 'ADMINISTRATIVE_RECOVERY_MAY_VERIFY_PRESERVED_EVIDENCE_AND_WRITE_SEPARATE_RECOVERY_RECORDS_WITH_ZERO_RECOVERY_HELPER_OR_WORKER_EXECUTIONS' },
  ];
}

function main() {
  const [operation, ...extra] = process.argv.slice(2);
  assert.equal(extra.length, 0, 'Expected exactly --verify-only or --write.');
  assert.ok(operation === '--verify-only' || operation === '--write', 'Expected exactly --verify-only or --write.');
  const writeMode = operation === '--write';
  const fixedGitProductionTree = assertRuntimeAndRepository();

  assertExactFlatRegularFiles(G5_TOOL, G5_TOOL_FILES, 'sealed G5 tool namespace');
  const expectedEvidenceBefore = ['pre-execution-seal.json', 'recovery-plan.json', 'zero-execution-validation.json'];
  assertExactFlatRegularFiles(G5_EVIDENCE, expectedEvidenceBefore, 'sealed G5 evidence namespace before acceptance');
  assert.equal(fs.existsSync(absolute(OUTPUT)), false, 'G5 administrative acceptance recovery must not already exist.');

  const g4Tools = closureSnapshot(G4_TOOL, true);
  const g4Evidence = closureSnapshot(G4_EVIDENCE, true);
  const staticChain = verifyRecoveryChain();
  assert.equal(staticChain.productionTree, fixedGitProductionTree);
  const g4 = verifyG4Artifacts(g4Tools, g4Evidence, staticChain.productionTree);
  assert.deepEqual(staticChain.source.sourceG2, g4.sourceG2);
  assert.deepEqual(staticChain.priorG3Failure, g4.priorG3);
  assert.deepEqual(staticChain.priorG4Failure.tools, g4Tools);
  assert.deepEqual(staticChain.priorG4Failure.evidence, g4Evidence);
  assert.deepEqual(staticChain.authoritativeBinding, g4.binding);

  const validation = readJson(VALIDATION);
  const plan = readJson(PLAN);
  const seal = readJson(PRE_SEAL);
  const priorG4Failure = validation.priorG4Failure;
  assertPriorG4Failure(priorG4Failure, g4Tools, g4Evidence);
  assert.deepEqual(priorG4Failure, staticChain.priorG4Failure, 'G5 validation must seal the exact mechanically verified G4 failure.');
  const g5Tools = closureSnapshot(G5_TOOL, true);
  assert.equal(g5Tools.fileCount, 7);
  assertG5SealedInputs(validation, plan, seal, g5Tools, {
    binding: g4.binding,
    sourceG2: g4.sourceG2,
    priorG3: g4.priorG3,
    priorG4Failure,
    productionTree: staticChain.productionTree,
  });

  const record = {
    kind: 'MO1307Phase3CR2C3TBG5AdministrativeAcceptanceRecovery',
    version: '1.0.0',
    recoveredAt: new Date().toISOString(),
    result: 'PASS',
    outcome: 'ACCEPTANCE_RECOVERY_COMPLETE',
    generation: { ...GENERATION },
    sourceExecutionGeneration: GENERATION.sourceExecutionGeneration,
    priorRecoveryGeneration: GENERATION.priorRecoveryGeneration,
    evidenceOrigin: {
      mode: 'ACCEPTANCE_ONLY_NO_EXECUTION',
      executedInG5: {
        fresh: 0,
        reuse: 0,
        candidateSpecific: 0,
        sourceAndSecurityReviews: 0,
      },
      acceptedFromG4: {
        freshSelectedHistoricalControls: 89,
        reusedHistoricalControls: 462,
        candidateSpecificControls: 2,
        sourceAndSecurityReviews: 12,
        backedByExecutionGeneration: 'phase3cr2-c3tb-g2',
      },
    },
    authoritativeBinding: validation.authoritativeBinding,
    sourceG2: validation.sourceG2,
    priorG3Failure: validation.priorG3Failure,
    priorG4Failure,
    administrativeAuthority: {
      mode: 'NEW_GENERATION_ACCEPTANCE_ONLY',
      authorityScope: 'ACCEPT_IMMUTABLE_G4_RECONCILIATION_WITHOUT_REEXECUTION',
      appendOnly: true,
      resumesPriorAttempt: false,
      citations: authorityCitations(),
      priorG2FailurePreserved: true,
      priorG2FailureRewrittenAsPass: false,
      priorG3FailurePreserved: true,
      priorG3FailureRewrittenAsPass: false,
      priorG4FailurePreserved: true,
      priorG4FailureRewrittenAsPass: false,
      g4ReconciliationArtifactsPreserved: true,
      g4BytesModified: false,
    },
    rootCause: {
      phase: priorG4Failure.phase,
      classification: priorG4Failure.classification,
      classificationLabel: priorG4Failure.classificationLabel,
      failure: priorG4Failure.failure,
      violations: priorG4Failure.violations,
      acceptanceCommitCreatedInG4: false,
      correction: 'NEW_G5_APPEND_ONLY_ACCEPTANCE_GENERATION_WITH_CANONICAL_SINGLE_EOF_NEWLINES',
    },
    executionCounts: { ...ZERO_EXECUTIONS },
    campaignRerun: false,
    stages1Through8Rerun: false,
    stages2Through8Rerun: false,
    productChanges: false,
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
      g4ReconciliationAccepted: true,
      g4ToolFiles: 7,
      g4EvidenceFiles: 12,
      g4AcceptanceCommitCreated: false,
      containingCommitRequired: true,
      requiredSingleParent: C3TB,
      productTree: staticChain.productionTree,
    },
    inputs: {
      validation: filePin(VALIDATION),
      recoveryPlan: filePin(PLAN),
      preExecutionSeal: filePin(PRE_SEAL),
      g4: Object.fromEntries(Object.entries(G4_ARTIFACTS).map(([key, relative]) => [key, filePin(relative)])),
      g4Tools,
      g4Evidence,
    },
    outputs: {
      administrativeAcceptanceRecovery: OUTPUT,
    },
    phase3DExecuted: false,
    push: false,
    tag: false,
  };

  assert.deepEqual(record.generation, GENERATION);
  assert.deepEqual(record.priorG4Failure, validation.priorG4Failure);
  assertZeroExecutions(record.executionCounts, 'G5 administrative acceptance recovery');
  assert.equal(record.reconciliation.freshSelectedHistoricalControls, 89);
  assert.equal(record.reconciliation.reusedHistoricalControls, 462);
  assert.equal(record.reconciliation.candidateSpecificControls, 2);
  assert.equal(record.reconciliation.sourceAndSecurityReviews, 12);
  for (const field of ['omitted', 'duplicates', 'mismatches', 'unresolved']) assert.equal(record.reconciliation[field], 0);
  assert.equal(record.campaignRerun, false);
  assert.equal(record.stages1Through8Rerun, false);
  assert.equal(record.productChanges, false);

  assert.deepEqual(closureSnapshot(G4_TOOL, true), g4Tools, 'G4 tools changed during G5 acceptance verification.');
  assert.deepEqual(closureSnapshot(G4_EVIDENCE, true), g4Evidence, 'G4 evidence changed during G5 acceptance verification.');
  assert.deepEqual(closureSnapshot(G5_TOOL, true), g5Tools, 'G5 tools changed during G5 acceptance verification.');
  assertRuntimeAndRepository();

  if (writeMode) {
    fs.writeFileSync(absolute(OUTPUT), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
    assertExactFlatRegularFiles(G5_EVIDENCE, [...expectedEvidenceBefore, 'administrative-acceptance-recovery.json'], 'G5 evidence namespace after acceptance');
    assert.deepEqual(readJson(OUTPUT), record);
    process.stdout.write(canonical({
      result: 'PASS_ACCEPTANCE_RECOVERY_WRITTEN',
      outcome: 'PHASE3CR2_ACCEPTANCE_RECOVERED_PENDING_FINALIZATION',
      output: filePin(OUTPUT),
      executionCounts: ZERO_EXECUTIONS,
    }) + '\n');
  } else {
    assertExactFlatRegularFiles(G5_EVIDENCE, expectedEvidenceBefore, 'G5 verify-only evidence namespace');
    process.stdout.write(canonical({
      result: 'PASS_ACCEPTANCE_VERIFIED',
      outcome: 'PHASE3CR2_ACCEPTANCE_RECOVERY_READY',
      wouldWrite: OUTPUT,
      executionCounts: ZERO_EXECUTIONS,
    }) + '\n');
  }
}

try {
  main();
} catch (error) {
  const failure = {
    name: error && error.name ? error.name : 'Error',
    code: error && error.code ? error.code : null,
    message: error && error.message ? error.message : String(error),
  };
  process.stderr.write(canonical({
    result: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    failure,
    outputWritten: fs.existsSync(absolute(OUTPUT)),
  }) + '\n');
  process.exitCode = 1;
}
