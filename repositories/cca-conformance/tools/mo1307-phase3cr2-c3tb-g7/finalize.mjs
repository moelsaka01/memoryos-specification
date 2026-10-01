// Append-only Phase 3CR2 G7 finalizer and acceptance verifier.
//
// G7 preserves the complete G6 terminal evidence and its failed staged
// verification. It never launches a helper, worker, product control, security
// control, native control, certification stage, or network operation.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import * as recovery from './recovery-static-lib.mjs';

const {
  ACCEPTED_PHASE3BR2,
  ACCEPTED_PHASE3BR2_TREE,
  BRANCH,
  C3T,
  C3TB,
  C3TB_TREE,
  EXPECTED_G4_VIOLATIONS,
  G2_EVIDENCE_RELATIVE: G2_EVIDENCE,
  G2_TOOL_RELATIVE: G2_TOOL,
  G2_VALIDATION_ROOT_RELATIVE: G2_VALIDATION_ROOT,
  G3_EVIDENCE_RELATIVE: G3_EVIDENCE,
  G3_TOOL_RELATIVE: G3_TOOL,
  G4_EVIDENCE_RELATIVE: G4_EVIDENCE,
  G4_TOOL_RELATIVE: G4_TOOL,
  G5_EVIDENCE_RELATIVE: G5_EVIDENCE,
  G5_TOOL_RELATIVE: G5_TOOL,
  G6_ACCEPTANCE_ROOTS,
  G6_EVIDENCE_RELATIVE: G6_EVIDENCE,
  G6_TOOL_RELATIVE: G6_TOOL,
  G7_EVIDENCE_RELATIVE: G7_EVIDENCE,
  G7_PLANNED_OUTPUTS,
  G7_TOOL_RELATIVE: G7_TOOL,
  GENERATION,
  HELPER_RELATIVE: HELPER,
  ORIGINAL_EVIDENCE_RELATIVE: ORIGINAL_EVIDENCE,
  ORIGINAL_TOOL_RELATIVE: ORIGINAL_TOOL,
  PRODUCT_RELATIVE: PRODUCT,
  ROOT,
} = recovery;

const GIT_VERSION = 'git version 2.55.0.windows.3';
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
const HELPER_SHA256 = 'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127';
const HELPER_BLOB = '7ca55b8713108465099ecfce9796e06e3db67bd2';

const VALIDATION = `${G7_EVIDENCE}/zero-execution-validation.json`;
const PLAN = `${G7_EVIDENCE}/recovery-plan.json`;
const PRE_SEAL = `${G7_EVIDENCE}/pre-execution-seal.json`;
const ADMINISTRATIVE = `${G7_EVIDENCE}/administrative-acceptance-recovery.json`;
const RECEIPT = `${G7_EVIDENCE}/certification-receipt.json`;
const FINAL_VALIDATION = `${G7_EVIDENCE}/final-validation.json`;
const HANDOFF = `${G7_EVIDENCE}/phase3d-handoff.json`;
const MANIFEST = `${G7_EVIDENCE}/evidence-manifest.json`;
const FINAL_SEAL = `${G7_EVIDENCE}/final-seal.json`;
const G2_LEDGER = `${G2_EVIDENCE}/execution-ledger.json`;
const G2_REUSE = `${G2_EVIDENCE}/dependency-reuse.json`;
const G4_FRESH = `${G4_EVIDENCE}/fresh-control-results.json`;
const G4_CANDIDATE = `${G4_EVIDENCE}/candidate-specific-controls.json`;
const G4_REVIEWS = `${G4_EVIDENCE}/source-security-reviews.json`;

const PREFINAL_OUTPUTS = Object.freeze([VALIDATION, PLAN, PRE_SEAL, ADMINISTRATIVE]);
const TERMINAL_OUTPUTS = Object.freeze([RECEIPT, FINAL_VALIDATION, HANDOFF, MANIFEST, FINAL_SEAL]);
const FINAL_EVIDENCE_FILES = Object.freeze([...PREFINAL_OUTPUTS, ...TERMINAL_OUTPUTS]);
const ACCEPTANCE_ROOTS = Object.freeze([...G6_ACCEPTANCE_ROOTS, G7_TOOL, G7_EVIDENCE]);
const G7_TOOL_NAMES = Object.freeze([
  'accept.mjs',
  'binding-lib.mjs',
  'finalize.mjs',
  'preflight.mjs',
  'README.md',
  'recovery-static-lib.mjs',
  'validate-recovery.mjs',
]);
const ZERO_EXECUTIONS = Object.freeze({
  helper: 0,
  worker: 0,
  product: 0,
  security: 0,
  native: 0,
  network: 0,
  certification: 0,
});
const EXPECTED_CASE_IDS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
const EXPECTED_CASE_RESULTS = Object.freeze(['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'PASS', 'FAIL', 'FAIL', 'PASS', 'FAIL']);
const EXPECTED_DIGESTS = Object.freeze({
  originalTools: ['repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb', 15, 'sha256:9abb9d879a5b29724b42a8efa31f66579d104c336ef4ed2f2e304a77ff7c1e19'],
  originalEvidence: ['repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb', 194, 'sha256:2ce1063de146fb4c1bb153175271ff19e0a6db5d9d759abe0e137e4b00b8224f'],
  g2Tools: [G2_TOOL, 18, 'sha256:338da32c0b9c500bf19adaa9d7c5adb5fda8be0646ffb9319eff8a6de5c1a646'],
  g2Evidence: [G2_EVIDENCE, 1043, 'sha256:eca2a9b239253173e76e40e13f9d4614b5039b226215760042a64677695e4416'],
  g3Tools: [G3_TOOL, 7, 'sha256:cb80849ddec5df31f314f51fc397140f82452ada1e83da495caa630f5263527d'],
  g3Evidence: [G3_EVIDENCE, 3, 'sha256:66e59061edace9359f18d796511cc2c25791ce972a87f779f89321a9329ebe87'],
  g4Tools: [G4_TOOL, 7, 'sha256:5345190df10de4554df711051b41063cc2b479de3a00e16dd4013e757f1e51aa'],
  g4Evidence: [G4_EVIDENCE, 12, 'sha256:285b34e2d82af75ae683d426e88f4f22d3e39d454f04d6946a65d4caea14deca'],
  g5Tools: [G5_TOOL, 7, 'sha256:7e4a3f42f68bc3bf902d56adf3a9f0e496cc042f99cdfe39ded93a9e83d342b2'],
  g5Evidence: [G5_EVIDENCE, 3, 'sha256:0ed78607211afaba3029896b28d2c424b247ef8437e89195e4013fcc69779b3b'],
  g6Tools: [G6_TOOL, 7, 'sha256:bd2276695ac4b09c9a66484a5ba293dfd4c6ff70267baf29e6a7b98f1a78cc7d'],
  g6Evidence: [G6_EVIDENCE, 9, 'sha256:1304d2fe31026440e29047c2f945ad94369a80f51c8dcee86f30314617e0ca68'],
});
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
const G6_ARTIFACT_PATHS = Object.freeze({
  validation: `${G6_EVIDENCE}/zero-execution-validation.json`,
  plan: `${G6_EVIDENCE}/recovery-plan.json`,
  seal: `${G6_EVIDENCE}/pre-execution-seal.json`,
  administrative: `${G6_EVIDENCE}/administrative-acceptance-recovery.json`,
  receipt: `${G6_EVIDENCE}/certification-receipt.json`,
  finalValidation: `${G6_EVIDENCE}/final-validation.json`,
  handoff: `${G6_EVIDENCE}/phase3d-handoff.json`,
  manifest: `${G6_EVIDENCE}/evidence-manifest.json`,
  finalSeal: `${G6_EVIDENCE}/final-seal.json`,
});

const slash = value => value.replaceAll('\\', '/');
const fileOrder = (left, right) => left.localeCompare(right, 'en');
const canonical = value => recovery.canonical(value);
const sha256 = data => `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
const gitBlob = data => crypto.createHash('sha1')
  .update(Buffer.from(`blob ${data.length}\0`))
  .update(data)
  .digest('hex');

function absolute(relative) {
  const resolved = path.resolve(ROOT, relative);
  const prefix = path.resolve(ROOT) + path.sep;
  assert.ok(resolved.startsWith(prefix), `Path escapes worktree: ${relative}`);
  return resolved;
}

function readRegularBytes(relative) {
  return recovery.readRegularBytes(relative);
}

function readJson(relative) {
  return recovery.readJson(relative);
}

function fileRecord(relative, includeGitBlob = false) {
  return recovery.fileRecord(relative, includeGitBlob);
}

function recordFromBytes(relative, bytes, includeGitBlob = true) {
  const record = { path: relative, byteLength: bytes.length, sha256: sha256(bytes) };
  if (includeGitBlob) record.gitBlob = gitBlob(bytes);
  return record;
}

function closureSnapshot(relative, includeGitBlob = true) {
  return recovery.closureSnapshot(relative, includeGitBlob);
}

function runGitResult(args) {
  return recovery.runGit(args, { allowFailure: true });
}

function runGit(args) {
  const result = recovery.runGit(args);
  return result.stdout;
}

const gitText = args => runGit(args).toString('utf8').trim();

function canonicalRoot(value) {
  return slash(path.resolve(value)).replace(/\/$/u, '').toLowerCase();
}

function assertFixedRuntimeAndHistory(allowAcceptanceCommit) {
  assert.equal(process.version, EXPECTED_NODE.version, 'Unexpected Node version');
  assert.equal(process.platform, EXPECTED_NODE.platform, 'Unexpected Node platform');
  assert.equal(process.arch, EXPECTED_NODE.arch, 'Unexpected Node architecture');
  assert.equal(canonicalRoot(process.execPath), canonicalRoot(EXPECTED_NODE_PATH), 'Unexpected Node executable');
  const nodeBytes = fs.readFileSync(process.execPath);
  assert.equal(nodeBytes.length, EXPECTED_NODE.byteLength, 'Unexpected Node byte length');
  assert.equal(sha256(nodeBytes), EXPECTED_NODE.sha256, 'Unexpected Node SHA-256');
  assert.equal(gitText(['--version']), GIT_VERSION, 'Unexpected fixed Git version');
  const gitRootRaw = gitText(['rev-parse', '--show-toplevel']);
  const nodeRootRaw = path.resolve(ROOT);
  assert.notEqual(gitRootRaw.toLowerCase(), nodeRootRaw.toLowerCase(), 'G6 Windows path-normalization precondition changed');
  assert.equal(canonicalRoot(gitRootRaw), canonicalRoot(nodeRootRaw), 'Canonicalized Git/Node roots differ');
  assert.equal(gitText(['branch', '--show-current']), BRANCH, 'Unexpected branch');
  assert.equal(gitText(['cat-file', '-t', C3T]), 'commit');
  assert.equal(gitText(['show', '-s', '--format=%P', C3T]), C3T_PARENT);
  assert.equal(gitText(['show', '-s', '--format=%T', C3T]), C3T_TREE);
  assert.equal(gitText(['cat-file', '-t', C3TB]), 'commit');
  assert.equal(gitText(['show', '-s', '--format=%P', C3TB]), C3T);
  assert.equal(gitText(['show', '-s', '--format=%T', C3TB]), C3TB_TREE);
  assert.equal(gitText(['cat-file', '-t', ACCEPTED_PHASE3BR2]), 'commit');
  assert.equal(gitText(['show', '-s', '--format=%P', ACCEPTED_PHASE3BR2]), C3TB);
  assert.equal(gitText(['show', '-s', '--format=%T', ACCEPTED_PHASE3BR2]), ACCEPTED_PHASE3BR2_TREE);
  const productionTree = gitText(['rev-parse', `${C3T}:${PRODUCT}`]);
  assert.match(productionTree, /^[0-9a-f]{40}$/u, 'Dynamic production tree');
  assert.equal(gitText(['rev-parse', `${C3TB}:${PRODUCT}`]), productionTree, 'C3TB product tree');
  assert.equal(gitText(['rev-parse', `${ACCEPTED_PHASE3BR2}:${PRODUCT}`]), productionTree, 'Phase 3BR2 product tree');
  assert.equal(gitText(['diff', '--name-only', C3T, C3TB, '--', PRODUCT]), '', 'C3TB product delta');
  assert.equal(gitText(['rev-parse', `${C3TB}:${HELPER}`]), HELPER_BLOB, 'C3TB helper blob');
  assert.equal(sha256(runGit(['show', `${C3TB}:${HELPER}`])), HELPER_SHA256, 'C3TB helper SHA-256');
  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all', '--', PRODUCT]), '', 'Product worktree must be clean');
  const head = gitText(['rev-parse', 'HEAD']);
  if (!allowAcceptanceCommit) assert.equal(head, C3TB, 'Source/staged verification requires exact C3TB HEAD');
  else if (head !== C3TB) {
    assert.equal(gitText(['show', '-s', '--format=%P', head]), C3TB, 'Acceptance commit parent');
    assert.equal(gitText(['rev-parse', `${head}:${PRODUCT}`]), productionTree, 'Acceptance commit production tree');
  }
  return { productionTree, gitRootRaw, nodeRootRaw, canonicalRoot: canonicalRoot(nodeRootRaw), head };
}

function assertExactInventory(root, expectedPaths, label) {
  const target = absolute(root);
  const stat = fs.lstatSync(target);
  assert.equal(stat.isSymbolicLink(), false, `${label}: root symlink`);
  assert.equal(stat.isDirectory(), true, `${label}: root directory`);
  const entries = fs.readdirSync(target, { withFileTypes: true });
  assert.deepEqual(entries.map(entry => `${root}/${entry.name}`).sort(fileOrder), [...expectedPaths].sort(fileOrder), `${label}: exact inventory`);
  for (const entry of entries) {
    assert.equal(entry.isSymbolicLink(), false, `${label}: symlink ${entry.name}`);
    assert.equal(entry.isFile(), true, `${label}: nested/non-file ${entry.name}`);
  }
}

function assertCanonicalText(relative) {
  const bytes = readRegularBytes(relative);
  const text = bytes.toString('utf8');
  assert.equal(Buffer.from(text).equals(bytes), true, `${relative}: canonical UTF-8`);
  assert.equal(text.includes('\r'), false, `${relative}: LF-only`);
  assert.equal(text.endsWith('\n'), true, `${relative}: final LF`);
  assert.equal(text.endsWith('\n\n'), false, `${relative}: exactly one final LF`);
  const lines = text.split('\n');
  for (let index = 0; index < lines.length - 1; index += 1) {
    assert.equal(/[ \t]+$/u.test(lines[index]), false, `${relative}:${index + 1}: trailing whitespace`);
    assert.equal(/^(?:<{7}|={7}|>{7})(?: |$)/u.test(lines[index]), false, `${relative}:${index + 1}: conflict marker`);
  }
}

function assertG7ToolNamespace() {
  const expected = G7_TOOL_NAMES.map(name => `${G7_TOOL}/${name}`);
  assertExactInventory(G7_TOOL, expected, 'G7 tool namespace');
  for (const relative of expected) assertCanonicalText(relative);
  const closure = closureSnapshot(G7_TOOL, true);
  assert.equal(closure.fileCount, 7, 'G7 exact tool count');
  return closure;
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

function priorAcceptancePaths() {
  const paths = G6_ACCEPTANCE_ROOTS.flatMap(root => closureSnapshot(root, true).files.map(record => record.path)).sort(fileOrder);
  assert.equal(new Set(paths).size, paths.length, 'Prior G6 acceptance path union contains duplicates');
  assert.equal(paths.length, 1326, 'Exact prior G6 acceptance path count');
  return paths;
}

function acceptancePaths() {
  assertExactInventory(G7_EVIDENCE, FINAL_EVIDENCE_FILES, 'G7 final evidence');
  const paths = ACCEPTANCE_ROOTS.flatMap(root => closureSnapshot(root, true).files.map(record => record.path)).sort(fileOrder);
  assert.equal(new Set(paths).size, paths.length, 'G7 acceptance path union contains duplicates');
  assert.equal(paths.length, 1342, 'Exact G7 final acceptance path count');
  return paths;
}

function assertStagedBlobs(expectedPaths) {
  const records = runGit(['ls-files', '--stage', '-z']).toString('utf8').split('\0').filter(Boolean);
  const staged = new Map();
  for (const record of records) {
    const match = /^100644 ([0-9a-f]{40}) 0\t(.+)$/u.exec(record);
    if (match) staged.set(slash(match[2]), match[1]);
  }
  for (const relative of expectedPaths) {
    assert.equal(staged.get(relative), gitBlob(readRegularBytes(relative)), `Staged bytes differ: ${relative}`);
  }
}

function assertExactKnownWhitespaceResult(result, label) {
  assert.equal(result.status, 2, `${label}: fixed Git exit code`);
  assert.equal(result.stderr.toString('utf8'), '', `${label}: stderr`);
  const expected = EXPECTED_G4_VIOLATIONS.map(item => `${item.path}:${item.line}: ${item.message}`);
  const actual = result.stdout.toString('utf8').replaceAll('\r\n', '\n').trimEnd().split('\n');
  assert.deepEqual(actual, expected, `${label}: exact two immutable G4 violations and no others`);
}

function assertLaterGenerationsWhitespaceClean(args, label) {
  const result = runGitResult(args);
  assert.equal(result.status, 0, `${label}: fixed Git exit code`);
  assert.equal(result.stdout.toString('utf8'), '', `${label}: stdout`);
  assert.equal(result.stderr.toString('utf8'), '', `${label}: stderr`);
}

function assertPriorG6Index() {
  const expected = priorAcceptancePaths();
  const staged = runGit(['diff', '--cached', '--name-only', '-z', C3TB])
    .toString('utf8').split('\0').filter(Boolean).map(slash).sort(fileOrder);
  assert.deepEqual(staged, expected, 'Exact prior G6 staged path union');
  const statuses = runGit(['diff', '--cached', '--name-status', C3TB]).toString('utf8')
    .split(/\r?\n/u).filter(Boolean);
  assert.equal(statuses.length, expected.length, 'Prior G6 staged status count');
  assert.equal(statuses.every(line => line.startsWith('A\t')), true, 'Prior G6 staged union must be A-only');
  assert.equal(gitText(['diff', '--cached', '--name-only', '--', PRODUCT]), '', 'Product path staged');
  assert.equal(gitText(['diff', '--name-only']), '', 'Unstaged tracked changes');
  assertStagedBlobs(expected);
  assertExactKnownWhitespaceResult(runGitResult(['diff', '--cached', '--check']), 'Prior G6 staged whitespace check');
  assertLaterGenerationsWhitespaceClean(
    ['diff', '--cached', '--check', '--', G5_TOOL, G5_EVIDENCE, G6_TOOL, G6_EVIDENCE],
    'G5+G6 staged whitespace check',
  );
  return expected;
}

function assertClosure(recorded, key) {
  const [root, count, digest] = EXPECTED_DIGESTS[key];
  const current = closureSnapshot(root, true);
  assert.equal(current.fileCount, count, `${root}: current count`);
  assert.equal(current.digest, digest, `${root}: current digest`);
  assert.deepEqual(recorded, current, `${root}: exact recorded closure`);
  return current;
}

function assertAuthoritativeBinding(binding, productionTree, label) {
  assert.equal(binding?.result, 'PASS', `${label}: binding result`);
  assert.equal(binding?.candidate?.commit, C3TB, `${label}: candidate commit`);
  assert.equal(binding?.candidate?.tree, C3TB_TREE, `${label}: candidate tree`);
  assert.equal(binding?.candidate?.soleParent, C3T, `${label}: candidate parent`);
  assert.equal(binding?.production?.commit, C3T, `${label}: production commit`);
  assert.equal(binding?.production?.tree, productionTree, `${label}: production tree`);
  assert.equal(binding?.helper?.sha256, HELPER_SHA256, `${label}: helper SHA-256`);
  if (Object.hasOwn(binding?.helper ?? {}, 'gitBlob')) assert.equal(binding.helper.gitBlob, HELPER_BLOB, `${label}: helper blob`);
  assert.equal(binding?.nonAuthoritativePlaceholders?.excludedFromDerivation, true, `${label}: placeholders excluded`);
}

function assertZeroExecutions(actual, label) {
  assert.deepEqual(actual, ZERO_EXECUTIONS, `${label}: zero execution`);
}

function assertGeneration(actual, label) {
  assert.deepEqual(actual, GENERATION, `${label}: exact G7 generation`);
}

function assertPin(record, expectedPath = record?.path) {
  assert.equal(record?.path, expectedPath, `Pin path: ${expectedPath}`);
  assert.deepEqual(record, fileRecord(expectedPath, Object.hasOwn(record, 'gitBlob')), `Pin changed: ${expectedPath}`);
}

function assertPriorG6Failure(prior) {
  const tools = closureSnapshot(G6_TOOL, true);
  const evidence = closureSnapshot(G6_EVIDENCE, true);
  assert.equal(tools.fileCount, EXPECTED_DIGESTS.g6Tools[1]);
  assert.equal(tools.digest, EXPECTED_DIGESTS.g6Tools[2]);
  assert.equal(evidence.fileCount, EXPECTED_DIGESTS.g6Evidence[1]);
  assert.equal(evidence.digest, EXPECTED_DIGESTS.g6Evidence[2]);
  const correctTerminalInventory = [...G6_EVIDENCE_NAMES].sort(fileOrder);
  const incorrectPrefinalInventory = [...G6_PREFINAL_NAMES].sort(fileOrder);
  const expected = {
    generation: {
      id: 'phase3cr2-c3tb-g6',
      ordinal: 6,
      mode: 'ACCEPTANCE_ONLY_FROM_IMMUTABLE_G4_AFTER_FAILED_G5_VERIFICATION',
      resumesPriorAttempt: false,
      sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
      priorRecoveryGeneration: 'phase3cr2-c3tb-g5',
    },
    result: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    phase: 'STAGED_ACCEPTANCE_VERIFICATION',
    classification: ['OTHER_CONCRETE_RECONCILIATION_DEFECT'],
    classificationLabel: 'OTHER_CONCRETE_RECONCILIATION_DEFECT/FINAL_LOADER_REUSES_PREFINAL_INVENTORY_ASSERTION',
    failure: {
      code: 'ERR_ASSERTION',
      path: `${G6_TOOL}/finalize.mjs`,
      entryPoint: { line: 1002, source: 'const artifacts = loadFinal(runtime, staticChain);' },
      terminalLoader: { line: 954, source: 'const inputs = loadPrefinal(runtime, staticChain);' },
      prefinalCall: { line: 549, source: "assertExactInventory(G6_EVIDENCE, PREFINAL_OUTPUTS, 'G6 prefinal evidence');" },
      rejectedAssertion: { line: 317, source: "assert.deepEqual(entries.map(entry => `${root}/${entry.name}`).sort(fileOrder), [...expectedPaths].sort(fileOrder), `${label}: exact inventory`);" },
    },
    cause: {
      invokedMode: '--verify-staged',
      callChain: ['verifyStaged', 'loadFinal', 'loadPrefinal', 'assertExactInventory'],
      correctTerminalInventoryCount: 9,
      incorrectExpectedPrefinalInventoryCount: 4,
      correctTerminalInventory,
      incorrectPrefinalInventory,
      unexpectedTerminalFiles: correctTerminalInventory.filter(name => !G6_PREFINAL_NAMES.includes(name)),
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
      pathCount: 1326,
      allPathsAOnly: true,
      productPathsAbsent: true,
      unstagedTrackedChangesAbsent: true,
      exactImmutableG4WhitespaceViolations: [...EXPECTED_G4_VIOLATIONS],
      additionalWhitespaceViolations: 0,
    },
    tools,
    evidence,
    artifacts: Object.fromEntries(Object.entries(G6_ARTIFACT_PATHS).map(([key, relative]) => [key, fileRecord(relative)])),
    sourceIntegrity: {
      mechanicallyReproduced: true,
      sourceLinesExact: true,
      terminalEvidenceExact: true,
      stagedUnionExactAtFailure: true,
      onlyKnownWhitespaceViolations: true,
    },
  };
  assert.deepEqual(prior, expected, 'Exact immutable G6 staged-verifier failure');
}

function assertRecordedChain(validation, runtime, staticChain = undefined) {
  assertClosure(validation.sourceG2.tools, 'g2Tools');
  assertClosure(validation.sourceG2.evidence, 'g2Evidence');
  const ledger = readJson(G2_LEDGER);
  assert.equal(ledger.result, 'FAILED_INCOMPLETE');
  assert.equal(ledger.outcome, 'PHASE3CR2_FAILED_INCOMPLETE');
  assert.deepEqual(ledger.stages.map(stage => stage.status), [...Array(8).fill('PASS'), 'FAIL']);
  assert.equal(ledger.stages.every(stage => stage.integrity?.result === 'PASS'), true);
  assert.equal(ledger.firstFailure.stage, 'CASE_SENSITIVE_RECONCILIATION');

  const priorG3 = validation.priorG3Failure;
  assert.equal(priorG3.result, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(priorG3.failure.path, `${G3_TOOL}/reconcile.mjs`);
  assert.equal(priorG3.failure.line, 677);
  assertClosure(priorG3.tools, 'g3Tools');
  assertClosure(priorG3.evidence, 'g3Evidence');

  const priorG4 = validation.priorG4Failure;
  assert.equal(priorG4.result, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(priorG4.phase, 'STAGED_ACCEPTANCE_VERIFICATION');
  assert.deepEqual(priorG4.violations, [...EXPECTED_G4_VIOLATIONS]);
  assertClosure(priorG4.tools, 'g4Tools');
  assertClosure(priorG4.evidence, 'g4Evidence');
  for (const violation of EXPECTED_G4_VIOLATIONS) {
    assert.equal(readRegularBytes(violation.path).subarray(-8).toString('hex'), violation.tailHex, `${violation.path}: immutable tail`);
  }

  const priorG5 = validation.priorG5Failure;
  assert.equal(priorG5.result, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(priorG5.phase, 'ACCEPTANCE_SOURCE_VERIFICATION');
  assert.equal(priorG5.classificationLabel, 'OTHER_CONCRETE_RECONCILIATION_DEFECT/PATH_SEPARATOR_NORMALIZATION_MISMATCH');
  assert.equal(priorG5.failure.code, 'ERR_ASSERTION');
  assert.equal(priorG5.failure.path, `${G5_TOOL}/accept.mjs`);
  assert.equal(priorG5.failure.line, 312);
  assert.equal(priorG5.cause.exactEqual, false);
  assert.equal(canonicalRoot(priorG5.cause.gitRootRaw), runtime.canonicalRoot);
  assert.equal(canonicalRoot(priorG5.cause.nodeRootRaw), runtime.canonicalRoot);
  assert.equal(priorG5.acceptanceCommitCreated, false);
  assertClosure(priorG5.tools, 'g5Tools');
  assertClosure(priorG5.evidence, 'g5Evidence');

  const priorG6 = validation.priorG6Failure;
  assertPriorG6Failure(priorG6);
  assertAuthoritativeBinding(validation.authoritativeBinding, runtime.productionTree, 'G7 binding');
  const fresh = readJson(G4_FRESH);
  const reuse = readJson(G2_REUSE);
  const candidate = readJson(G4_CANDIDATE);
  const reviews = readJson(G4_REVIEWS);
  assert.equal(fresh.count, 89);
  assert.equal(fresh.rows.length, 89);
  assert.equal(fresh.rows.every(row => row.result === 'PASS_FRESH'), true);
  assert.equal(reuse.counts.reusedHistoricalControls, 462);
  assert.equal(reuse.rows.length, 462);
  assert.equal(reuse.rows.every(row => row.disposition === 'REUSED_EXACT'), true);
  assert.equal(candidate.count, 2);
  assert.equal(candidate.rows.every(row => row.result === 'PASS'), true);
  assert.equal(reviews.count, 12);
  assert.equal(reviews.rows.every(row => row.result === 'PASS'), true);
  if (staticChain) {
    assert.deepEqual(validation.sourceG2, staticChain.source.sourceG2);
    assert.deepEqual(priorG3, staticChain.priorG3Failure);
    assert.deepEqual(priorG4, staticChain.priorG4Failure);
    assert.deepEqual(priorG5, staticChain.priorG5Failure);
    assert.deepEqual(priorG6, staticChain.priorG6Failure);
    assert.deepEqual(validation.authoritativeBinding, staticChain.authoritativeBinding);
  }
  return { priorG3, priorG4, priorG5, priorG6 };
}

function assertG7ToolSeal(plan, seal) {
  const tools = assertG7ToolNamespace();
  assert.equal(plan.finalizedToolInputCount, 7);
  assert.deepEqual(plan.finalizedToolInputs, tools.files);
  assert.equal(plan.finalizedToolSetDigest, tools.digest);
  assert.equal(seal.finalizedToolInputCount, 7);
  assert.deepEqual(seal.finalizedToolInputs, tools.files);
  assert.equal(seal.finalizedToolSetDigest, tools.digest);
  return tools;
}

function assertAdministrative(administrative, validation, productionTree) {
  assert.equal(administrative.kind, 'MO1307Phase3CR2C3TBG7AdministrativeAcceptanceRecovery');
  assert.equal(administrative.version, '1.0.0');
  assert.equal(administrative.result, 'PASS');
  assert.equal(administrative.outcome, 'ACCEPTANCE_RECOVERY_COMPLETE');
  assertGeneration(administrative.generation, 'G7 administrative acceptance recovery');
  assert.equal(administrative.sourceExecutionGeneration, 'phase3cr2-c3tb-g2');
  assert.equal(administrative.priorRecoveryGeneration, 'phase3cr2-c3tb-g6');
  assertAuthoritativeBinding(administrative.authoritativeBinding, productionTree, 'G7 administrative binding');
  assert.deepEqual(administrative.sourceG2, validation.sourceG2);
  assert.deepEqual(administrative.priorG3Failure, validation.priorG3Failure);
  assert.deepEqual(administrative.priorG4Failure, validation.priorG4Failure);
  assert.deepEqual(administrative.priorG5Failure, validation.priorG5Failure);
  assert.deepEqual(administrative.priorG6Failure, validation.priorG6Failure);
  assertZeroExecutions(administrative.executionCounts, 'G7 administrative acceptance recovery');
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
  assert.equal(administrative.campaignRerun, false);
  assert.equal(administrative.stages1Through8Rerun, false);
  assert.equal(administrative.stages2Through8Rerun, false);
  assert.equal(administrative.productChanges, false);
  assert.equal(administrative.commitCreatedByG7Tool, false);
  assert.equal(administrative.acceptance.g6TerminalEvidenceAccepted, true);
  assert.equal(administrative.acceptance.exactFinalPathCount, 1342);
  assert.deepEqual(administrative.acceptance.exactImmutableG4WhitespaceViolations, [...EXPECTED_G4_VIOLATIONS]);
  assert.equal(administrative.phase3DExecuted, false);
  assert.equal(administrative.push, false);
  assert.equal(administrative.tag, false);
  assert.deepEqual(administrative.outputs, { administrativeAcceptanceRecovery: ADMINISTRATIVE });
}

function loadCore(runtime, staticChain = undefined) {
  const validation = readJson(VALIDATION);
  const plan = readJson(PLAN);
  const seal = readJson(PRE_SEAL);
  const administrative = readJson(ADMINISTRATIVE);

  assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG7ZeroExecutionValidation');
  assert.equal(validation.version, '1.0.0');
  assert.equal(validation.result, 'PASS');
  assertGeneration(validation.generation, 'G7 validation');
  assert.equal(validation.productionTree, runtime.productionTree);
  assertZeroExecutions(validation.executionCounts, 'G7 validation');
  assert.deepEqual(validation.cases.map(test => test.id), EXPECTED_CASE_IDS);
  assert.deepEqual(validation.cases.map(test => test.expected), EXPECTED_CASE_RESULTS);
  assert.deepEqual(validation.cases.map(test => test.actual), EXPECTED_CASE_RESULTS);
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
  const chain = assertRecordedChain(validation, runtime, staticChain);

  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBG7RecoveryPlan');
  assert.equal(plan.version, '1.0.0');
  assert.equal(plan.status, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assertGeneration(plan.generation, 'G7 recovery plan');
  assert.equal(plan.productionTree, runtime.productionTree);
  assert.deepEqual(plan.authoritativeBinding, validation.authoritativeBinding);
  assert.deepEqual(plan.validation, fileRecord(VALIDATION));
  assert.deepEqual(plan.sourceG2, validation.sourceG2);
  assert.deepEqual(plan.priorG3Failure, validation.priorG3Failure);
  assert.deepEqual(plan.priorG4Failure, validation.priorG4Failure);
  assert.deepEqual(plan.priorG5Failure, validation.priorG5Failure);
  assert.deepEqual(plan.priorG6Failure, validation.priorG6Failure);
  assert.deepEqual(plan.outputs, [...G7_PLANNED_OUTPUTS]);
  assert.equal(plan.scope.mode, 'ACCEPTANCE_ONLY');
  assert.equal(plan.scope.repairTarget, 'G6_STAGED_VERIFIER_TERMINAL_INVENTORY_REENTRY');
  for (const field of ['preservesFailedG2', 'preservesFailedG3', 'preservesFailedG4', 'preservesFailedG5', 'preservesFailedG6', 'consumesCompleteG4Reconciliation', 'consumesCompleteG6TerminalEvidence']) assert.equal(plan.scope[field], true, `G7 plan scope ${field}`);
  for (const field of ['rerunsStages1Through8', 'rerunsReconciliation', 'launchesControls', 'changesProduct', 'createsCommit', 'executesPhase3D']) assert.equal(plan.scope[field], false, `G7 plan scope ${field}`);
  assert.equal(plan.executionPolicy.mode, 'ZERO_EXECUTION_ACCEPTANCE_ONLY');
  assert.equal(plan.executionPolicy.preservesFailedG6, true);
  assert.equal(plan.executionPolicy.consumesCompleteG6TerminalEvidence, true);
  assertZeroExecutions(plan.executionPolicy.executionsBeforeSeal, 'G7 plan');

  assert.equal(seal.kind, 'MO1307Phase3CR2C3TBG7PreExecutionSeal');
  assert.equal(seal.version, '1.0.0');
  assert.equal(seal.result, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assertGeneration(seal.generation, 'G7 pre-execution seal');
  assert.equal(seal.productionTree, runtime.productionTree);
  assert.deepEqual(seal.authoritativeBinding, validation.authoritativeBinding);
  assert.deepEqual(seal.validation, fileRecord(VALIDATION));
  assert.deepEqual(seal.recoveryPlan, fileRecord(PLAN));
  assert.deepEqual(seal.sourceG2, validation.sourceG2);
  assert.deepEqual(seal.priorG3Failure, validation.priorG3Failure);
  assert.deepEqual(seal.priorG4Failure, validation.priorG4Failure);
  assert.deepEqual(seal.priorG5Failure, validation.priorG5Failure);
  assert.deepEqual(seal.priorG6Failure, validation.priorG6Failure);
  assert.deepEqual(seal.executionPolicy, plan.executionPolicy);
  assertZeroExecutions(seal.executionCounts, 'G7 pre-execution seal');
  assert.equal(seal.appendOnly, true);
  const g7Tools = assertG7ToolSeal(plan, seal);
  assertAdministrative(administrative, validation, runtime.productionTree);

  return {
    validation,
    plan,
    seal,
    administrative,
    sourceG2: validation.sourceG2,
    priorG3Failure: chain.priorG3,
    priorG4Failure: chain.priorG4,
    priorG5Failure: chain.priorG5,
    priorG6Failure: chain.priorG6,
    g7Tools,
    productionTree: runtime.productionTree,
  };
}

function loadPrefinal(runtime, staticChain = undefined) {
  assertExactInventory(G7_EVIDENCE, PREFINAL_OUTPUTS, 'G7 prefinal evidence');
  return loadCore(runtime, staticChain);
}

function containingCommitRule(productionTree) {
  return {
    state: 'PENDING_VERIFICATION',
    verifierMode: '--verify-committed',
    requiredSingleParent: true,
    requiredParent: C3TB,
    requiredCandidateTree: C3TB_TREE,
    requiredProductionTree: productionTree,
    productChangesAllowed: false,
    exactPathUnionRequired: true,
    exactPathCount: 1342,
    allPathsMustBeAdded: true,
    fullWhitespaceCheck: {
      requiredExitCode: 2,
      exactImmutableG4Violations: [...EXPECTED_G4_VIOLATIONS],
      additionalViolationsAllowed: false,
    },
    g5ThroughG7WhitespaceCheck: { requiredExitCode: 0, violationsAllowed: false },
  };
}

function controlsSummary() {
  return {
    freshExecutedInG7: 0,
    freshAcceptedFromG6: 89,
    reusedExactAcceptedFromG6: 462,
    candidateSpecificAcceptedFromG6: 2,
    sourceSecurityReviewsAcceptedFromG6: 12,
    backedByExecutionGeneration: 'phase3cr2-c3tb-g2',
    reconciledInGeneration: 'phase3cr2-c3tb-g4',
    terminalizedInGeneration: 'phase3cr2-c3tb-g6',
    totalHistoricalInventory: 551,
    unresolved: 0,
    omissions: 0,
    duplicateIds: 0,
    overlaps: 0,
    mismatches: 0,
  };
}

function preservedFailures(inputs) {
  return {
    preservedG2: { outcome: 'PHASE3CR2_FAILED_INCOMPLETE', tools: inputs.sourceG2.tools, evidence: inputs.sourceG2.evidence, ledger: fileRecord(G2_LEDGER), immutable: true, modified: false, resumed: false },
    preservedG3: { outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER', failure: inputs.priorG3Failure.failure, tools: inputs.priorG3Failure.tools, evidence: inputs.priorG3Failure.evidence, immutable: true, modified: false, resumed: false },
    preservedG4: { outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER', phase: inputs.priorG4Failure.phase, failure: inputs.priorG4Failure.failure, violations: inputs.priorG4Failure.violations, tools: inputs.priorG4Failure.tools, evidence: inputs.priorG4Failure.evidence, immutable: true, modified: false, resumed: false },
    preservedG5: { outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER', phase: inputs.priorG5Failure.phase, failure: inputs.priorG5Failure.failure, cause: inputs.priorG5Failure.cause, tools: inputs.priorG5Failure.tools, evidence: inputs.priorG5Failure.evidence, immutable: true, modified: false, resumed: false },
    preservedG6: {
      outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
      phase: inputs.priorG6Failure.phase,
      classification: inputs.priorG6Failure.classification,
      classificationLabel: inputs.priorG6Failure.classificationLabel,
      failure: inputs.priorG6Failure.failure,
      cause: inputs.priorG6Failure.cause,
      tools: inputs.priorG6Failure.tools,
      evidence: inputs.priorG6Failure.evidence,
      terminalEvidenceComplete: true,
      stagedVerificationCompleted: false,
      acceptanceCommitCreated: false,
      immutable: true,
      modified: false,
      resumed: false,
    },
  };
}

function buildReceipt(inputs, finalizedAt) {
  return {
    kind: 'MO1307Phase3CR2C3TBG7CertificationReceipt',
    version: '1.0.0',
    finalizedAt,
    result: 'PASS_ACCEPTANCE_READY',
    phase3CR2: 'ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    status: 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    outcome: 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
    priorRecoveryGeneration: 'phase3cr2-c3tb-g6',
    priorG6Failure: inputs.priorG6Failure,
    ...preservedFailures(inputs),
    administrativeAcceptanceRecovery: fileRecord(ADMINISTRATIVE),
    controls: controlsSummary(),
    executionCounts: ZERO_EXECUTIONS,
    campaignRerun: false,
    stages1Through8Rerun: false,
    stages2Through8Rerun: false,
    inputs: {
      zeroExecutionValidation: fileRecord(VALIDATION),
      recoveryPlan: fileRecord(PLAN),
      preExecutionSeal: fileRecord(PRE_SEAL),
      administrativeAcceptanceRecovery: fileRecord(ADMINISTRATIVE),
      g6CertificationReceipt: fileRecord(`${G6_EVIDENCE}/certification-receipt.json`),
      g6FinalValidation: fileRecord(`${G6_EVIDENCE}/final-validation.json`),
      g6Phase3DHandoff: fileRecord(`${G6_EVIDENCE}/phase3d-handoff.json`),
      g6EvidenceManifest: fileRecord(`${G6_EVIDENCE}/evidence-manifest.json`),
      g6FinalSeal: fileRecord(`${G6_EVIDENCE}/final-seal.json`),
      g4FreshControlResults: fileRecord(G4_FRESH),
      g2DependencyReuse: fileRecord(G2_REUSE),
      g4CandidateSpecificControls: fileRecord(G4_CANDIDATE),
      g4SourceSecurityReviews: fileRecord(G4_REVIEWS),
    },
    containingCommit: containingCommitRule(inputs.productionTree),
    phase3D: { executed: false, handoff: HANDOFF, authorizationGranted: false, conditionalOnContainingCommitVerification: true },
    prohibitions: { productChanges: false, push: false, tag: false, phase3AR2: false, phase3D: false, network: false },
  };
}

function buildFinalValidation(inputs, receiptRecord, finalizedAt) {
  return {
    kind: 'MO1307Phase3CR2C3TBG7FinalValidation',
    version: '1.0.0',
    finalizedAt,
    result: 'PASS_ACCEPTANCE_SUPPORTED',
    outcome: 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    priorG6Failure: inputs.priorG6Failure,
    receipt: receiptRecord,
    executionCounts: ZERO_EXECUTIONS,
    checks: {
      preservedG2: { outcome: 'PHASE3CR2_FAILED_INCOMPLETE', immutable: true },
      preservedG3: { outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER', immutable: true, failure: inputs.priorG3Failure.failure },
      preservedG4: { outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER', immutable: true, failure: inputs.priorG4Failure.failure },
      preservedG5: { outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER', immutable: true, failure: inputs.priorG5Failure.failure },
      preservedG6: { outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER', immutable: true, failure: inputs.priorG6Failure.failure, terminalEvidenceComplete: true, stagedVerificationCompleted: false },
      exactG4WhitespaceViolations: [...EXPECTED_G4_VIOLATIONS],
      g5ThroughG7WhitespaceViolations: 0,
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
    containingCommit: containingCommitRule(inputs.productionTree),
  };
}

function buildHandoff(inputs, receiptRecord, finalValidationRecord, finalizedAt) {
  return {
    kind: 'MO1307Phase3CR2C3TBG7Phase3DHandoff',
    version: '1.0.0',
    finalizedAt,
    result: 'READY_AFTER_CONTAINING_COMMIT_VERIFICATION_NOT_EXECUTED',
    phase3CR2: 'ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    phase3DExecuted: false,
    phase3DExecutionAuthorized: false,
    conditionalOnContainingCommitVerification: true,
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    priorG6Failure: inputs.priorG6Failure,
    administrativeAcceptanceRecovery: fileRecord(ADMINISTRATIVE),
    receipt: receiptRecord,
    finalValidation: finalValidationRecord,
    controls: controlsSummary(),
    executionCounts: ZERO_EXECUTIONS,
    containingCommit: containingCommitRule(inputs.productionTree),
    consumeRule: 'Consume only after --verify-committed emits the terminal acceptance result for a clean single-parent commit over exact C3TB with the exact 1342-path A-only union, unchanged production tree, exactly the two immutable G4 whitespace violations, and zero G5/G6/G7 whitespace violations. This handoff neither executes nor authorizes Phase 3D.',
  };
}

function buildManifest(inputs, receiptBytes, finalValidationBytes, handoffBytes, finalizedAt) {
  const members = [
    ...closureSnapshot(G7_TOOL, true).files,
    ...PREFINAL_OUTPUTS.map(relative => fileRecord(relative, true)),
    recordFromBytes(RECEIPT, receiptBytes),
    recordFromBytes(FINAL_VALIDATION, finalValidationBytes),
    recordFromBytes(HANDOFF, handoffBytes),
  ].sort((left, right) => fileOrder(left.path, right.path));
  assert.equal(new Set(members.map(record => record.path)).size, members.length, 'G7 manifest duplicate member');
  assert.equal(members.length, 14, 'G7 manifest member count');
  return {
    kind: 'MO1307Phase3CR2C3TBG7EvidenceManifest',
    version: '1.0.0',
    finalizedAt,
    result: 'PASS_ACCEPTANCE_READY',
    phase3CR2: 'ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    priorG6Failure: inputs.priorG6Failure,
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
      g5Tools: inputs.priorG5Failure.tools,
      g5Evidence: inputs.priorG5Failure.evidence,
      g6Tools: inputs.priorG6Failure.tools,
      g6Evidence: inputs.priorG6Failure.evidence,
    },
    executionCounts: ZERO_EXECUTIONS,
    containingCommit: containingCommitRule(inputs.productionTree),
    phase3DExecuted: false,
  };
}

function buildFinalSeal(inputs, receiptRecord, finalValidationRecord, handoffRecord, manifestRecord, finalizedAt) {
  return {
    kind: 'MO1307Phase3CR2C3TBG7FinalSeal',
    version: '1.0.0',
    finalizedAt,
    result: 'PASS_ACCEPTANCE_READY',
    phase3CR2: 'ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    immutableG2: { tools: inputs.sourceG2.tools, evidence: inputs.sourceG2.evidence, ledger: fileRecord(G2_LEDGER), outcome: 'PHASE3CR2_FAILED_INCOMPLETE' },
    immutableG3: { tools: inputs.priorG3Failure.tools, evidence: inputs.priorG3Failure.evidence, failure: inputs.priorG3Failure.failure, outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER' },
    immutableG4: { tools: inputs.priorG4Failure.tools, evidence: inputs.priorG4Failure.evidence, failure: inputs.priorG4Failure.failure, violations: inputs.priorG4Failure.violations, outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER' },
    immutableG5: { tools: inputs.priorG5Failure.tools, evidence: inputs.priorG5Failure.evidence, failure: inputs.priorG5Failure.failure, cause: inputs.priorG5Failure.cause, outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER' },
    immutableG6: { tools: inputs.priorG6Failure.tools, evidence: inputs.priorG6Failure.evidence, failure: inputs.priorG6Failure.failure, cause: inputs.priorG6Failure.cause, terminalEvidenceComplete: true, stagedVerificationCompleted: false, acceptanceCommitCreated: false, outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER' },
    zeroExecutionValidation: fileRecord(VALIDATION),
    recoveryPlan: fileRecord(PLAN),
    preExecutionSeal: fileRecord(PRE_SEAL),
    administrativeAcceptanceRecovery: fileRecord(ADMINISTRATIVE),
    receipt: receiptRecord,
    finalValidation: finalValidationRecord,
    phase3DHandoff: handoffRecord,
    manifest: manifestRecord,
    executionCounts: ZERO_EXECUTIONS,
    containingCommit: containingCommitRule(inputs.productionTree),
    phase3DExecuted: false,
    push: false,
    tag: false,
  };
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function assertExpectedStatus(expectedPaths, untrackedPaths, label) {
  const entries = statusEntries();
  assert.deepEqual(entries.map(entry => entry.path).sort(fileOrder), [...expectedPaths].sort(fileOrder), `${label}: exact status path union`);
  const untracked = new Set(untrackedPaths);
  for (const entry of entries) {
    assert.equal(entry.status, untracked.has(entry.path) ? '??' : 'A ', `${label}: unexpected status for ${entry.path}`);
  }
  assert.equal(entries.some(entry => entry.path === PRODUCT || entry.path.startsWith(`${PRODUCT}/`)), false, `${label}: product path in status`);
}

function assertAllowedSourceState(g7Tools) {
  const prior = assertPriorG6Index();
  const toolPaths = g7Tools.files.map(record => record.path);
  const expected = [...prior, ...toolPaths].sort(fileOrder);
  assert.equal(expected.length, 1333, 'Exact G7 source path count');
  assertExpectedStatus(expected, toolPaths, 'G7 source state');
  return prior;
}

function assertAllowedPreWriteState(g7Tools) {
  const prior = assertPriorG6Index();
  assertExactInventory(G7_EVIDENCE, PREFINAL_OUTPUTS, 'G7 prefinal evidence');
  const newPaths = [
    ...g7Tools.files.map(record => record.path),
    ...PREFINAL_OUTPUTS,
  ].sort(fileOrder);
  const expected = [...prior, ...newPaths].sort(fileOrder);
  assert.equal(expected.length, 1337, 'Exact G7 prefinal path count');
  assertExpectedStatus(expected, newPaths, 'G7 pre-write state');
}

function sourceOnly() {
  const runtime = assertFixedRuntimeAndHistory(false);
  assert.equal(fs.existsSync(absolute(G7_EVIDENCE)), false, 'G7 evidence must not exist for source-only verification');
  const staticChain = recovery.verifyRecoveryChain();
  assert.equal(staticChain.productionTree, runtime.productionTree, 'Static dynamic production tree');
  const g7Tools = assertG7ToolNamespace();
  const prior = assertAllowedSourceState(g7Tools);
  process.stdout.write(`${canonical({
    mode: '--verify-source-only',
    result: 'PASS_SOURCE_CHAIN_VERIFIED',
    head: C3TB,
    branch: BRANCH,
    productionTree: runtime.productionTree,
    canonicalRoot: runtime.canonicalRoot,
    priorPathCount: prior.length,
    g7ToolFiles: g7Tools.fileCount,
    preservedG2Outcome: staticChain.source.sourceG2.ledger.outcome,
    preservedG3Outcome: staticChain.priorG3Failure.outcome,
    preservedG4Outcome: staticChain.priorG4Failure.outcome,
    preservedG5Outcome: staticChain.priorG5Failure.outcome,
    preservedG6Outcome: staticChain.priorG6Failure.outcome,
    priorG6Failure: staticChain.priorG6Failure.classificationLabel,
    writes: 0,
    executions: ZERO_EXECUTIONS,
  })}\n`);
}

function writeFinal() {
  const runtime = assertFixedRuntimeAndHistory(false);
  const staticChain = recovery.verifyRecoveryChain();
  assert.equal(staticChain.productionTree, runtime.productionTree, 'Static dynamic production tree');
  const g7Tools = assertG7ToolNamespace();
  assertAllowedPreWriteState(g7Tools);
  for (const relative of TERMINAL_OUTPUTS) assert.equal(fs.existsSync(absolute(relative)), false, `Refusing overwrite: ${relative}`);
  const inputs = loadPrefinal(runtime, staticChain);
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
  for (const [relative, bytes] of writes) fs.writeFileSync(absolute(relative), bytes, { flag: 'wx', mode: 0o644 });
  assertExactInventory(G7_EVIDENCE, FINAL_EVIDENCE_FILES, 'G7 post-finalization evidence');
  process.stdout.write(`${canonical({
    mode: '--write',
    result: 'PASS_FINAL_ARTIFACTS_WRITTEN',
    outcome: 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    freshExecutedInG7: 0,
    freshAcceptedFromG6: 89,
    reusedExactAcceptedFromG6: 462,
    candidateSpecificAcceptedFromG6: 2,
    outputs: TERMINAL_OUTPUTS,
    next: 'Stage the exact 1342-path acceptance union, run --verify-staged, create one single-parent commit over C3TB, then run --verify-committed. Do not push, tag, or execute Phase 3D.',
  })}\n`);
}

function loadFinal(runtime, staticChain = undefined) {
  assertExactInventory(G7_EVIDENCE, FINAL_EVIDENCE_FILES, 'G7 final evidence');
  const inputs = loadCore(runtime, staticChain);
  const receipt = readJson(RECEIPT);
  const finalValidation = readJson(FINAL_VALIDATION);
  const handoff = readJson(HANDOFF);
  const manifest = readJson(MANIFEST);
  const finalSeal = readJson(FINAL_SEAL);
  const finalizedAt = receipt.finalizedAt;
  assert.equal(typeof finalizedAt, 'string');
  assert.deepEqual(receipt, buildReceipt(inputs, finalizedAt), 'Exact G7 certification receipt');
  const receiptRecord = fileRecord(RECEIPT);
  assert.deepEqual(finalValidation, buildFinalValidation(inputs, receiptRecord, finalizedAt), 'Exact G7 final validation');
  const finalValidationRecord = fileRecord(FINAL_VALIDATION);
  assert.deepEqual(handoff, buildHandoff(inputs, receiptRecord, finalValidationRecord, finalizedAt), 'Exact G7 Phase 3D handoff');
  assert.deepEqual(
    manifest,
    buildManifest(inputs, readRegularBytes(RECEIPT), readRegularBytes(FINAL_VALIDATION), readRegularBytes(HANDOFF), finalizedAt),
    'Exact G7 evidence manifest',
  );
  assert.deepEqual(
    finalSeal,
    buildFinalSeal(inputs, receiptRecord, finalValidationRecord, fileRecord(HANDOFF), fileRecord(MANIFEST), finalizedAt),
    'Exact G7 final seal',
  );
  for (const artifact of [receipt, finalValidation, handoff, manifest, finalSeal]) {
    assertGeneration(artifact.generation, artifact.kind);
    assertAuthoritativeBinding(artifact.authoritativeBinding, runtime.productionTree, artifact.kind);
    assertZeroExecutions(artifact.executionCounts, artifact.kind);
    if (Object.hasOwn(artifact, 'phase3CR2')) assert.equal(artifact.phase3CR2, 'ACCEPTANCE_PENDING_CONTAINING_COMMIT', `${artifact.kind}: pending phase`);
    else assert.equal(artifact.outcome, 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT', `${artifact.kind}: pending outcome`);
  }
  assert.equal(receipt.status, 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT');
  assert.equal(receipt.outcome, 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT');
  assert.equal(finalValidation.checks.containingCommitVerified, false);
  assert.equal(handoff.phase3DExecuted, false);
  assert.equal(handoff.phase3DExecutionAuthorized, false);
  assert.equal(handoff.conditionalOnContainingCommitVerification, true);
  assert.equal(manifest.memberCount, 14);
  assert.deepEqual(manifest.excludes, [MANIFEST, FINAL_SEAL]);
  assert.equal(finalSeal.phase3DExecuted, false);
  return { inputs, receipt, finalValidation, handoff, manifest, finalSeal, expectedPaths: acceptancePaths() };
}

function verifyStaged() {
  const runtime = assertFixedRuntimeAndHistory(false);
  const staticChain = recovery.verifyRecoveryChain({ requirePriorStagedUnion: false });
  assert.equal(staticChain.productionTree, runtime.productionTree, 'Static dynamic production tree');
  const artifacts = loadFinal(runtime, staticChain);
  const staged = runGit(['diff', '--cached', '--name-only', '-z', C3TB])
    .toString('utf8').split('\0').filter(Boolean).map(slash).sort(fileOrder);
  assert.deepEqual(staged, artifacts.expectedPaths, 'Exact staged Phase 3CR2 path union');
  assert.equal(staged.length, 1342, 'Exact staged Phase 3CR2 path count');
  assert.equal(gitText(['diff', '--name-only']), '', 'Unstaged tracked changes are forbidden');
  assert.equal(gitText(['diff', '--cached', '--name-only', '--', PRODUCT]), '', 'Product paths are forbidden');
  const entries = statusEntries();
  assert.equal(entries.length, artifacts.expectedPaths.length);
  assert.deepEqual(entries.map(entry => entry.path).sort(fileOrder), artifacts.expectedPaths);
  assert.equal(entries.every(entry => entry.status === 'A '), true, 'Every acceptance path must have A-only status');
  assertStagedBlobs(artifacts.expectedPaths);
  assertExactKnownWhitespaceResult(runGitResult(['diff', '--cached', '--check']), 'Full staged whitespace check');
  assertLaterGenerationsWhitespaceClean(
    ['diff', '--cached', '--check', '--', G5_TOOL, G5_EVIDENCE, G6_TOOL, G6_EVIDENCE, G7_TOOL, G7_EVIDENCE],
    'G5+G6+G7 staged whitespace check',
  );
  process.stdout.write(`${canonical({
    mode: '--verify-staged',
    result: 'PASS_STAGED_ACCEPTANCE',
    acceptanceState: 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    files: artifacts.expectedPaths.length,
    parent: C3TB,
    exactImmutableG4WhitespaceViolations: EXPECTED_G4_VIOLATIONS,
    g5ThroughG7WhitespaceViolations: 0,
    productionChanged: false,
    next: 'Create one single-parent acceptance commit without amendment, then run --verify-committed. Do not push or tag.',
  })}\n`);
}

function verifyCommitted() {
  const runtime = assertFixedRuntimeAndHistory(true);
  const head = runtime.head;
  assert.notEqual(head, C3TB, 'Acceptance commit is missing');
  assert.equal(gitText(['show', '-s', '--format=%P', head]), C3TB, 'Acceptance commit parent');
  assert.equal(gitText(['rev-list', '--parents', '-n', '1', head]).split(' ').length, 2, 'Acceptance commit must have exactly one parent');
  const artifacts = loadFinal(runtime);
  const changed = runGit(['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', C3TB, head])
    .toString('utf8').split('\0').filter(Boolean).map(slash).sort(fileOrder);
  assert.deepEqual(changed, artifacts.expectedPaths, 'Exact committed Phase 3CR2 path union');
  assert.equal(changed.length, 1342, 'Exact committed Phase 3CR2 path count');
  const nameStatus = runGit(['diff-tree', '--no-commit-id', '--name-status', '-r', '-z', C3TB, head])
    .toString('utf8').split('\0').filter(Boolean);
  assert.equal(nameStatus.length, artifacts.expectedPaths.length * 2, 'Committed name-status arity');
  for (let index = 0; index < nameStatus.length; index += 2) assert.equal(nameStatus[index], 'A', `Committed path is not A-only: ${nameStatus[index + 1]}`);
  assert.equal(gitText(['rev-parse', `${head}:${PRODUCT}`]), runtime.productionTree, 'Committed production tree');
  assert.equal(gitText(['diff', '--name-only', C3TB, head, '--', PRODUCT]), '', 'Committed product changes');
  const committedRecords = runGit(['ls-tree', '-r', '-z', head, '--', ...ACCEPTANCE_ROOTS])
    .toString('utf8').split('\0').filter(Boolean);
  const committedBlobs = new Map();
  for (const record of committedRecords) {
    const match = /^100644 blob ([0-9a-f]{40})\t(.+)$/u.exec(record);
    assert.ok(match, `Committed acceptance path is not a regular blob: ${record}`);
    committedBlobs.set(slash(match[2]), match[1]);
  }
  assert.equal(committedBlobs.size, artifacts.expectedPaths.length, 'Committed acceptance blob count');
  for (const relative of artifacts.expectedPaths) assert.equal(committedBlobs.get(relative), gitBlob(readRegularBytes(relative)), `Committed bytes differ: ${relative}`);
  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all']), '', 'Repository must be clean');
  assertExactKnownWhitespaceResult(runGitResult(['diff', '--check', C3TB, head]), 'Full committed whitespace check');
  assertLaterGenerationsWhitespaceClean(
    ['diff', '--check', C3TB, head, '--', G5_TOOL, G5_EVIDENCE, G6_TOOL, G6_EVIDENCE, G7_TOOL, G7_EVIDENCE],
    'G5+G6+G7 committed whitespace check',
  );
  process.stdout.write(`${canonical({
    mode: '--verify-committed',
    result: 'PHASE3CR2_ACCEPTED',
    commit: head,
    parent: C3TB,
    branch: BRANCH,
    repositoryStatus: 'CLEAN',
    files: artifacts.expectedPaths.length,
    productionTree: runtime.productionTree,
    productChanged: false,
    freshExecutedInG7: 0,
    freshAcceptedFromG6: 89,
    reusedExactAcceptedFromG6: 462,
    candidateSpecificAcceptedFromG6: 2,
    sourceSecurityReviewsAcceptedFromG6: 12,
    preservedG2Outcome: 'PHASE3CR2_FAILED_INCOMPLETE',
    preservedG3Outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    preservedG4Outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    preservedG5Outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    preservedG6Outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    priorG6Failure: artifacts.inputs.priorG6Failure.classificationLabel,
    exactImmutableG4WhitespaceViolations: EXPECTED_G4_VIOLATIONS,
    g5ThroughG7WhitespaceViolations: 0,
    receipt: fileRecord(RECEIPT),
    finalValidation: fileRecord(FINAL_VALIDATION),
    phase3DHandoff: fileRecord(HANDOFF),
    finalSeal: fileRecord(FINAL_SEAL),
    phase3DExecuted: false,
  })}\n`);
}

try {
  assert.equal(process.argv.length, 3, 'Use exactly one mode');
  const mode = process.argv[2];
  if (mode === '--verify-source-only') sourceOnly();
  else if (mode === '--write') writeFinal();
  else if (mode === '--verify-staged') verifyStaged();
  else if (mode === '--verify-committed') verifyCommitted();
  else throw new Error('Use --verify-source-only, --write, --verify-staged, or --verify-committed.');
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
