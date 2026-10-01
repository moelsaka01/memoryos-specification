// Append-only Phase 3CR2 G6 acceptance-only finalizer.
//
// This program consumes the immutable G2 execution evidence, the immutable G3
// reconciliation failure, the immutable G4 reconciliation, and the immutable
// G4/G5 administrative failures. It never launches a product, helper, worker,
// native control, security control, certification stage, or network operation.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import * as recovery from './recovery-static-lib.mjs';

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
const C3TB = '119e68bdcf0ffc906b4ca03a912aadcb25908346';
const C3T = '65e24b2debdd70ecb8e52fbccbd6c101621f1917';
const C3T_PARENT = '79ef47e608c67edc70f3e9f51d494b169794f903';
const C3T_TREE = 'd21f46bc31ccd7a9f80a5e494b3d09116d125522';
const C3TB_TREE = '5e0088965d4eac4002165fe0190f275c257985ba';
const ACCEPTED_PHASE3BR2 = '4d92f0f21c9c3aad8202f4558d61b9229c7214fc';
const ACCEPTED_PHASE3BR2_TREE = '7d07f5f570248f8159339ae33637194937cf4918';
const HELPER_SHA256 = 'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127';
const HELPER_BLOB = '7ca55b8713108465099ecfce9796e06e3db67bd2';

const PRODUCT = 'repositories/memoryos-readiness';
const HELPER = `${PRODUCT}/helpers/windows-inspect.ps1`;
const ORIGINAL_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb';
const ORIGINAL_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb';
const G2_VALIDATION_ROOT = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2-harness-validation';
const G2_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g2';
const G2_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2';
const G3_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g3';
const G3_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g3';
const G4_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g4';
const G4_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g4';
const G5_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g5';
const G5_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g5';
const G6_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g6';
const G6_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g6';

const G2_LEDGER = `${G2_EVIDENCE}/execution-ledger.json`;
const G2_REUSE = `${G2_EVIDENCE}/dependency-reuse.json`;
const G4_VALIDATION = `${G4_EVIDENCE}/zero-execution-validation.json`;
const G4_FRESH = `${G4_EVIDENCE}/fresh-control-results.json`;
const G4_CANDIDATE = `${G4_EVIDENCE}/candidate-specific-controls.json`;
const G4_REVIEWS = `${G4_EVIDENCE}/source-security-reviews.json`;

const VALIDATION = `${G6_EVIDENCE}/zero-execution-validation.json`;
const PLAN = `${G6_EVIDENCE}/recovery-plan.json`;
const PRE_SEAL = `${G6_EVIDENCE}/pre-execution-seal.json`;
const ADMINISTRATIVE = `${G6_EVIDENCE}/administrative-acceptance-recovery.json`;
const RECEIPT = `${G6_EVIDENCE}/certification-receipt.json`;
const FINAL_VALIDATION = `${G6_EVIDENCE}/final-validation.json`;
const HANDOFF = `${G6_EVIDENCE}/phase3d-handoff.json`;
const MANIFEST = `${G6_EVIDENCE}/evidence-manifest.json`;
const FINAL_SEAL = `${G6_EVIDENCE}/final-seal.json`;

const PREFINAL_OUTPUTS = Object.freeze([VALIDATION, PLAN, PRE_SEAL, ADMINISTRATIVE]);
const TERMINAL_OUTPUTS = Object.freeze([RECEIPT, FINAL_VALIDATION, HANDOFF, MANIFEST, FINAL_SEAL]);
const FINAL_EVIDENCE_FILES = Object.freeze([...PREFINAL_OUTPUTS, ...TERMINAL_OUTPUTS]);

const GENERATION = Object.freeze({
  id: 'phase3cr2-c3tb-g6',
  ordinal: 6,
  mode: 'ACCEPTANCE_ONLY_FROM_IMMUTABLE_G4_AFTER_FAILED_G5_VERIFICATION',
  resumesPriorAttempt: false,
  sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
  priorRecoveryGeneration: 'phase3cr2-c3tb-g5',
});
const G5_GENERATION = Object.freeze({
  id: 'phase3cr2-c3tb-g5',
  ordinal: 5,
  mode: 'ACCEPTANCE_ONLY_FROM_IMMUTABLE_G4_AFTER_FAILED_STAGED_VERIFICATION',
  resumesPriorAttempt: false,
  sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
  priorRecoveryGeneration: 'phase3cr2-c3tb-g4',
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

const ROOTS_BEFORE_G6 = Object.freeze([
  ORIGINAL_TOOL,
  ORIGINAL_EVIDENCE,
  G2_VALIDATION_ROOT,
  G2_TOOL,
  G2_EVIDENCE,
  G3_TOOL,
  G3_EVIDENCE,
  G4_TOOL,
  G4_EVIDENCE,
  G5_TOOL,
  G5_EVIDENCE,
]);
const ACCEPTANCE_ROOTS = Object.freeze([...ROOTS_BEFORE_G6, G6_TOOL, G6_EVIDENCE]);

const G6_TOOL_NAMES = Object.freeze([
  'accept.mjs',
  'binding-lib.mjs',
  'finalize.mjs',
  'preflight.mjs',
  'README.md',
  'recovery-static-lib.mjs',
  'validate-recovery.mjs',
]);

const KNOWN_G4_WHITESPACE_VIOLATIONS = Object.freeze([
  Object.freeze({
    path: `${G4_TOOL}/binding-lib.mjs`,
    line: 271,
    message: 'new blank line at EOF.',
    tailHex: '207d293b0a7d0a0a',
  }),
  Object.freeze({
    path: `${G4_TOOL}/recovery-static-lib.mjs`,
    line: 551,
    message: 'new blank line at EOF.',
    tailHex: '207d293b0a7d0a0a',
  }),
]);

const slash = value => value.replaceAll('\\', '/');
const fileOrder = (left, right) => left.localeCompare(right, 'en');
const sha256 = data => `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
const gitBlob = data => crypto.createHash('sha1')
  .update(Buffer.from(`blob ${data.length}\0`))
  .update(data)
  .digest('hex');

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

function absolute(relative) {
  const root = path.resolve(ROOT);
  const resolved = path.resolve(root, relative);
  assert.equal(resolved === root || resolved.startsWith(`${root}${path.sep}`), true, `Path escapes worktree: ${relative}`);
  return resolved;
}

function readRegularBytes(relative) {
  const target = absolute(relative);
  const stat = fs.lstatSync(target);
  assert.equal(stat.isSymbolicLink(), false, `${relative}: symlink forbidden`);
  assert.equal(stat.isFile(), true, `${relative}: regular file required`);
  return fs.readFileSync(target);
}

function readJson(relative) {
  const bytes = readRegularBytes(relative);
  assert.ok(bytes.length > 1, `${relative}: empty JSON`);
  assert.equal(bytes.at(-1), 0x0a, `${relative}: final LF required`);
  assert.notEqual(bytes.at(-2), 0x0a, `${relative}: exactly one EOF newline required`);
  assert.equal(bytes.includes(0x0d), false, `${relative}: CR forbidden`);
  return JSON.parse(bytes.toString('utf8'));
}

function fileRecord(relative, includeGitBlob = false) {
  const normalized = slash(relative);
  const bytes = readRegularBytes(normalized);
  const record = { path: normalized, byteLength: bytes.length, sha256: sha256(bytes) };
  if (includeGitBlob) record.gitBlob = gitBlob(bytes);
  return record;
}

function recordFromBytes(relative, bytes, includeGitBlob = true) {
  const record = { path: slash(relative), byteLength: bytes.length, sha256: sha256(bytes) };
  if (includeGitBlob) record.gitBlob = gitBlob(bytes);
  return record;
}

function walkFiles(relativeRoot) {
  const root = absolute(relativeRoot);
  const rootStat = fs.lstatSync(root);
  assert.equal(rootStat.isSymbolicLink(), false, `${relativeRoot}: root symlink forbidden`);
  assert.equal(rootStat.isDirectory(), true, `${relativeRoot}: directory required`);
  const results = [];
  const walk = current => {
    const entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => fileOrder(a.name, b.name));
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      assert.equal(entry.isSymbolicLink(), false, `${slash(path.relative(ROOT, target))}: symlink forbidden`);
      if (entry.isDirectory()) walk(target);
      else {
        assert.equal(entry.isFile(), true, `${slash(path.relative(ROOT, target))}: regular file required`);
        results.push(slash(path.relative(ROOT, target)));
      }
    }
  };
  walk(root);
  return results.sort(fileOrder);
}

function closureSnapshot(relativeRoot, includeGitBlob = true) {
  assert.equal(includeGitBlob, true, 'Acceptance closures require gitBlob records');
  const files = walkFiles(relativeRoot).map(relative => fileRecord(relative, true));
  return {
    path: slash(relativeRoot),
    fileCount: files.length,
    digest: sha256(Buffer.from(`${canonical(files)}\n`)),
    files,
  };
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
  assert.equal(gitText(['--version']), EXPECTED_GIT_VERSION, 'Unexpected fixed Git version');

  const gitRootRaw = gitText(['rev-parse', '--show-toplevel']);
  const nodeRootRaw = path.resolve(ROOT);
  assert.notEqual(gitRootRaw.toLowerCase(), nodeRootRaw.toLowerCase(), 'G5 failure precondition changed');
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
  const entries = fs.readdirSync(target, { withFileTypes: true }).sort((a, b) => fileOrder(a.name, b.name));
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
  assert.equal(text.endsWith('\n\n'), false, `${relative}: exactly one EOF LF`);
  const lines = text.split('\n');
  for (let index = 0; index < lines.length - 1; index += 1) {
    assert.equal(/[ \t]+$/u.test(lines[index]), false, `${relative}:${index + 1}: trailing whitespace`);
    assert.equal(/^(?:<{7}|={7}|>{7})(?: |$)/u.test(lines[index]), false, `${relative}:${index + 1}: conflict marker`);
  }
}

function assertG6ToolNamespace() {
  const expected = G6_TOOL_NAMES.map(name => `${G6_TOOL}/${name}`);
  assertExactInventory(G6_TOOL, expected, 'G6 tool namespace');
  for (const relative of expected) assertCanonicalText(relative);
  const closure = closureSnapshot(G6_TOOL, true);
  assert.equal(closure.fileCount, 7, 'G6 exact tool count');
  return closure;
}

function priorAcceptancePaths() {
  const paths = ROOTS_BEFORE_G6.flatMap(root => closureSnapshot(root, true).files.map(record => record.path)).sort(fileOrder);
  assert.equal(new Set(paths).size, paths.length, 'Pre-G6 path union contains duplicates');
  assert.equal(paths.length, 1310, 'Exact pre-G6 acceptance path count');
  return paths;
}

function expectedPriorG5Failure(g5Tools, g5Evidence, runtime) {
  return {
    generation: { ...G5_GENERATION },
    result: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    phase: 'ACCEPTANCE_SOURCE_VERIFICATION',
    classification: ['OTHER_CONCRETE_RECONCILIATION_DEFECT'],
    classificationLabel: 'OTHER_CONCRETE_RECONCILIATION_DEFECT/PATH_SEPARATOR_NORMALIZATION_MISMATCH',
    failure: {
      code: 'ERR_ASSERTION',
      path: `${G5_TOOL}/accept.mjs`,
      line: 312,
      assertion: "assert.equal(gitText(['rev-parse', '--show-toplevel']).toLowerCase(), path.resolve(ROOT).toLowerCase());",
    },
    cause: {
      gitRootRaw: runtime.gitRootRaw,
      nodeRootRaw: runtime.nodeRootRaw,
      gitCompared: runtime.gitRootRaw.toLowerCase(),
      nodeCompared: runtime.nodeRootRaw.toLowerCase(),
      exactEqual: false,
      correctedCanonicalRoot: runtime.canonicalRoot,
      correction: 'NORMALIZE_BOTH_GIT_AND_NODE_ROOT_PATHS_TO_FORWARD_SLASHES_BEFORE_EQUALITY',
    },
    outputsWritten: {
      administrativeAcceptanceRecovery: false,
      certificationReceipt: false,
      finalValidation: false,
      phase3DHandoff: false,
      evidenceManifest: false,
      finalSeal: false,
    },
    acceptanceCommitCreated: false,
    tools: g5Tools,
    evidence: g5Evidence,
    sourceIntegrity: {
      mechanicallyReproduced: true,
      validationPlanSealExact: true,
      onlyDefect: 'PATH_SEPARATOR_NORMALIZATION_MISMATCH',
    },
  };
}

function assertClosure(recorded, root, count, digest) {
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

function assertRecordedChain(validation, runtime) {
  assertClosure(validation.sourceG2.tools, G2_TOOL, 18, 'sha256:338da32c0b9c500bf19adaa9d7c5adb5fda8be0646ffb9319eff8a6de5c1a646');
  assertClosure(validation.sourceG2.evidence, G2_EVIDENCE, 1043, 'sha256:eca2a9b239253173e76e40e13f9d4614b5039b226215760042a64677695e4416');
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
  assertClosure(priorG3.tools, G3_TOOL, 7, 'sha256:cb80849ddec5df31f314f51fc397140f82452ada1e83da495caa630f5263527d');
  assertClosure(priorG3.evidence, G3_EVIDENCE, 3, 'sha256:66e59061edace9359f18d796511cc2c25791ce972a87f779f89321a9329ebe87');

  const priorG4 = validation.priorG4Failure;
  assert.equal(priorG4.result, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(priorG4.phase, 'STAGED_ACCEPTANCE_VERIFICATION');
  assert.deepEqual(priorG4.violations, [...KNOWN_G4_WHITESPACE_VIOLATIONS]);
  assertClosure(priorG4.tools, G4_TOOL, 7, 'sha256:5345190df10de4554df711051b41063cc2b479de3a00e16dd4013e757f1e51aa');
  assertClosure(priorG4.evidence, G4_EVIDENCE, 12, 'sha256:285b34e2d82af75ae683d426e88f4f22d3e39d454f04d6946a65d4caea14deca');
  for (const violation of KNOWN_G4_WHITESPACE_VIOLATIONS) {
    assert.equal(readRegularBytes(violation.path).subarray(-8).toString('hex'), violation.tailHex, `${violation.path}: immutable tail`);
  }

  const g5Tools = closureSnapshot(G5_TOOL, true);
  const g5Evidence = closureSnapshot(G5_EVIDENCE, true);
  assert.equal(g5Tools.fileCount, 7);
  assert.equal(g5Tools.digest, 'sha256:7e4a3f42f68bc3bf902d56adf3a9f0e496cc042f99cdfe39ded93a9e83d342b2');
  assert.equal(g5Evidence.fileCount, 3);
  assert.equal(g5Evidence.digest, 'sha256:0ed78607211afaba3029896b28d2c424b247ef8437e89195e4013fcc69779b3b');
  assert.deepEqual(validation.priorG5Failure, expectedPriorG5Failure(g5Tools, g5Evidence, runtime), 'Exact G5 path-normalization failure');

  assertAuthoritativeBinding(validation.authoritativeBinding, runtime.productionTree, 'G6 binding');
  assert.deepEqual(validation.authoritativeBinding, readJson(G4_VALIDATION).authoritativeBinding, 'G6/G4 binding equality');
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
  priorAcceptancePaths();
  return { priorG3, priorG4, priorG5: validation.priorG5Failure, g5Tools, g5Evidence };
}

function verifyStaticChain(runtime) {
  for (const name of ['verifySourceG2', 'verifyPriorG3', 'verifyPriorG4', 'verifyPriorG5']) {
    assert.equal(typeof recovery[name], 'function', `G6 static library missing ${name}`);
  }
  const source = recovery.verifySourceG2();
  const priorG3Failure = recovery.verifyPriorG3(source);
  const priorG4Failure = recovery.verifyPriorG4(source, priorG3Failure);
  const priorG5Failure = recovery.verifyPriorG5(source, priorG3Failure, priorG4Failure);
  assert.equal(source.authoritativeBinding.production.tree, runtime.productionTree, 'Static dynamic production tree');
  assert.deepEqual(priorG5Failure, expectedPriorG5Failure(
    closureSnapshot(G5_TOOL, true),
    closureSnapshot(G5_EVIDENCE, true),
    runtime,
  ));
  priorAcceptancePaths();
  return { source, priorG3Failure, priorG4Failure, priorG5Failure };
}

function assertZeroExecutions(actual, label) {
  assert.deepEqual(actual, ZERO_EXECUTIONS, `${label}: zero execution`);
}

function assertGeneration(actual, label) {
  assert.deepEqual(actual, GENERATION, `${label}: exact G6 generation`);
}

function assertPin(record, expectedPath = record?.path) {
  assert.equal(record?.path, expectedPath, `Pin path: ${expectedPath}`);
  assert.deepEqual(record, fileRecord(expectedPath, Object.hasOwn(record, 'gitBlob')), `Pin changed: ${expectedPath}`);
}

function assertG6ToolSeal(plan, seal) {
  const tools = assertG6ToolNamespace();
  assert.equal(plan.finalizedToolInputCount, 7);
  assert.deepEqual(plan.finalizedToolInputs, tools.files);
  assert.equal(plan.finalizedToolSetDigest, tools.digest);
  assert.equal(seal.finalizedToolInputCount, 7);
  assert.deepEqual(seal.finalizedToolInputs, tools.files);
  assert.equal(seal.finalizedToolSetDigest, tools.digest);
  return tools;
}

function assertAdministrative(administrative, validation, productionTree) {
  assert.equal(administrative.kind, 'MO1307Phase3CR2C3TBG6AdministrativeAcceptanceRecovery');
  assert.equal(administrative.version, '1.0.0');
  assert.equal(administrative.result, 'PASS');
  assert.equal(administrative.outcome, 'ACCEPTANCE_RECOVERY_COMPLETE');
  assertGeneration(administrative.generation, 'G6 administrative acceptance recovery');
  assert.equal(administrative.sourceExecutionGeneration, 'phase3cr2-c3tb-g2');
  assert.equal(administrative.priorRecoveryGeneration, 'phase3cr2-c3tb-g5');
  assertAuthoritativeBinding(administrative.authoritativeBinding, productionTree, 'G6 administrative binding');
  assert.deepEqual(administrative.sourceG2, validation.sourceG2);
  assert.deepEqual(administrative.priorG3Failure, validation.priorG3Failure);
  assert.deepEqual(administrative.priorG4Failure, validation.priorG4Failure);
  assert.deepEqual(administrative.priorG5Failure, validation.priorG5Failure);
  assertZeroExecutions(administrative.executionCounts, 'G6 administrative acceptance recovery');
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
  if (Object.hasOwn(administrative, 'stages2Through8Rerun')) assert.equal(administrative.stages2Through8Rerun, false);
  assert.equal(administrative.productChanges, false);
  assert.equal(administrative.phase3DExecuted, false);
  assert.equal(administrative.push, false);
  assert.equal(administrative.tag, false);
  assert.deepEqual(administrative.outputs, { administrativeAcceptanceRecovery: ADMINISTRATIVE });
}

function loadPrefinal(runtime, staticChain = undefined) {
  assertExactInventory(G6_EVIDENCE, PREFINAL_OUTPUTS, 'G6 prefinal evidence');
  const validation = readJson(VALIDATION);
  const plan = readJson(PLAN);
  const seal = readJson(PRE_SEAL);
  const administrative = readJson(ADMINISTRATIVE);

  assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG6ZeroExecutionValidation');
  assert.equal(validation.version, '1.0.0');
  assert.equal(validation.result, 'PASS');
  assertGeneration(validation.generation, 'G6 validation');
  assert.equal(validation.productionTree, runtime.productionTree);
  assertZeroExecutions(validation.executionCounts, 'G6 validation');
  assert.deepEqual(validation.cases.map(test => test.id), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
  assert.deepEqual(validation.cases.map(test => test.expected), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'PASS', 'FAIL', 'FAIL']);
  assert.deepEqual(validation.cases.map(test => test.actual), ['PASS', 'FAIL', 'FAIL', 'FAIL', 'FAIL', 'PASS', 'PASS', 'PASS', 'FAIL', 'FAIL']);
  assert.equal(validation.cases.every(test => test.result === 'PASS'), true);
  const chain = assertRecordedChain(validation, runtime);

  if (staticChain) {
    assert.deepEqual(validation.sourceG2, staticChain.source.sourceG2);
    assert.deepEqual(validation.priorG3Failure, staticChain.priorG3Failure);
    assert.deepEqual(validation.priorG4Failure, staticChain.priorG4Failure);
    assert.deepEqual(validation.priorG5Failure, staticChain.priorG5Failure);
    assert.deepEqual(validation.authoritativeBinding, staticChain.source.authoritativeBinding);
  }

  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBG6RecoveryPlan');
  assert.equal(plan.status, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assertGeneration(plan.generation, 'G6 recovery plan');
  assert.equal(plan.productionTree, runtime.productionTree);
  assert.deepEqual(plan.authoritativeBinding, validation.authoritativeBinding);
  assert.deepEqual(plan.validation, fileRecord(VALIDATION));
  assert.deepEqual(plan.sourceG2, validation.sourceG2);
  assert.deepEqual(plan.priorG3Failure, validation.priorG3Failure);
  assert.deepEqual(plan.priorG4Failure, validation.priorG4Failure);
  assert.deepEqual(plan.priorG5Failure, validation.priorG5Failure);
  assert.deepEqual(plan.outputs, [...FINAL_EVIDENCE_FILES]);
  assert.equal(plan.scope.mode, 'ACCEPTANCE_ONLY');
  assert.equal(plan.scope.repairTarget, 'G5_ACCEPTANCE_SOURCE_VERIFICATION_PATH_NORMALIZATION');
  assert.equal(plan.scope.preservesFailedG2, true);
  assert.equal(plan.scope.preservesFailedG3, true);
  assert.equal(plan.scope.preservesFailedG4, true);
  assert.equal(plan.scope.preservesFailedG5, true);
  assert.equal(plan.scope.consumesCompleteG4Reconciliation, true);
  assert.equal(plan.scope.rerunsStages1Through8, false);
  assert.equal(plan.scope.rerunsReconciliation, false);
  assert.equal(plan.scope.launchesControls, false);
  assert.equal(plan.scope.changesProduct, false);
  assert.equal(plan.scope.executesPhase3D, false);
  assert.equal(plan.executionPolicy.mode, 'ZERO_EXECUTION_ACCEPTANCE_ONLY');
  assert.equal(plan.executionPolicy.preservesFailedG5, true);
  assertZeroExecutions(plan.executionPolicy.executionsBeforeSeal, 'G6 plan');

  assert.equal(seal.kind, 'MO1307Phase3CR2C3TBG6PreExecutionSeal');
  assert.equal(seal.result, 'SEALED_ACCEPTANCE_ONLY_NOT_EXECUTED');
  assertGeneration(seal.generation, 'G6 pre-execution seal');
  assert.equal(seal.productionTree, runtime.productionTree);
  assert.deepEqual(seal.authoritativeBinding, validation.authoritativeBinding);
  assert.deepEqual(seal.validation, fileRecord(VALIDATION));
  assert.deepEqual(seal.recoveryPlan, fileRecord(PLAN));
  assert.deepEqual(seal.sourceG2, validation.sourceG2);
  assert.deepEqual(seal.priorG3Failure, validation.priorG3Failure);
  assert.deepEqual(seal.priorG4Failure, validation.priorG4Failure);
  assert.deepEqual(seal.priorG5Failure, validation.priorG5Failure);
  assert.deepEqual(seal.executionPolicy, plan.executionPolicy);
  assertZeroExecutions(seal.executionCounts, 'G6 pre-execution seal');
  assert.equal(seal.appendOnly, true);
  const g6Tools = assertG6ToolSeal(plan, seal);
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
    g5Tools: chain.g5Tools,
    g5Evidence: chain.g5Evidence,
    g6Tools,
    productionTree: runtime.productionTree,
  };
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
    exactPathCount: 1326,
    allPathsMustBeAdded: true,
    fullWhitespaceCheck: {
      requiredExitCode: 2,
      exactImmutableG4Violations: [...KNOWN_G4_WHITESPACE_VIOLATIONS],
      additionalViolationsAllowed: false,
    },
    g5AndG6WhitespaceCheck: { requiredExitCode: 0, violationsAllowed: false },
  };
}

function controlsSummary() {
  return {
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
  };
}

function buildReceipt(inputs, finalizedAt) {
  return {
    kind: 'MO1307Phase3CR2C3TBG6CertificationReceipt',
    version: '1.0.0',
    finalizedAt,
    result: 'PASS_ACCEPTANCE_READY',
    phase3CR2: 'ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    status: 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    outcome: 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
    priorRecoveryGeneration: 'phase3cr2-c3tb-g5',
    preservedG2: { outcome: 'PHASE3CR2_FAILED_INCOMPLETE', tools: inputs.sourceG2.tools, evidence: inputs.sourceG2.evidence, ledger: fileRecord(G2_LEDGER), immutable: true, modified: false, resumed: false },
    preservedG3: { outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER', failure: inputs.priorG3Failure.failure, tools: inputs.priorG3Failure.tools, evidence: inputs.priorG3Failure.evidence, immutable: true, modified: false, resumed: false },
    preservedG4: { outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER', phase: inputs.priorG4Failure.phase, failure: inputs.priorG4Failure.failure, violations: inputs.priorG4Failure.violations, tools: inputs.priorG4Failure.tools, evidence: inputs.priorG4Failure.evidence, immutable: true, modified: false, resumed: false },
    preservedG5: { outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER', phase: inputs.priorG5Failure.phase, failure: inputs.priorG5Failure.failure, cause: inputs.priorG5Failure.cause, tools: inputs.priorG5Failure.tools, evidence: inputs.priorG5Failure.evidence, immutable: true, modified: false, resumed: false },
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
    kind: 'MO1307Phase3CR2C3TBG6FinalValidation',
    version: '1.0.0',
    finalizedAt,
    result: 'PASS_ACCEPTANCE_SUPPORTED',
    outcome: 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    priorG5Failure: inputs.priorG5Failure,
    receipt: receiptRecord,
    executionCounts: ZERO_EXECUTIONS,
    checks: {
      preservedG2: { outcome: 'PHASE3CR2_FAILED_INCOMPLETE', immutable: true },
      preservedG3: { outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER', immutable: true, failure: inputs.priorG3Failure.failure },
      preservedG4: { outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER', immutable: true, failure: inputs.priorG4Failure.failure },
      preservedG5: { outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER', immutable: true, failure: inputs.priorG5Failure.failure },
      exactG4WhitespaceViolations: [...KNOWN_G4_WHITESPACE_VIOLATIONS],
      g5AndG6WhitespaceViolations: 0,
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
    kind: 'MO1307Phase3CR2C3TBG6Phase3DHandoff',
    version: '1.0.0',
    finalizedAt,
    result: 'READY_AFTER_CONTAINING_COMMIT_VERIFICATION_NOT_EXECUTED',
    phase3CR2: 'ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    phase3DExecuted: false,
    phase3DExecutionAuthorized: false,
    conditionalOnContainingCommitVerification: true,
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    priorG5Failure: inputs.priorG5Failure,
    administrativeAcceptanceRecovery: fileRecord(ADMINISTRATIVE),
    receipt: receiptRecord,
    finalValidation: finalValidationRecord,
    controls: controlsSummary(),
    executionCounts: ZERO_EXECUTIONS,
    containingCommit: containingCommitRule(inputs.productionTree),
    consumeRule: 'Consume only after --verify-committed emits the terminal acceptance result for a clean single-parent commit over exact C3TB with the exact 1326-path A-only union, unchanged production tree, exactly the two immutable G4 whitespace violations, and zero G5/G6 whitespace violations. This handoff neither executes nor authorizes Phase 3D.',
  };
}

function buildManifest(inputs, receiptBytes, finalValidationBytes, handoffBytes, finalizedAt) {
  const members = [
    ...closureSnapshot(G6_TOOL, true).files,
    ...PREFINAL_OUTPUTS.map(relative => fileRecord(relative, true)),
    recordFromBytes(RECEIPT, receiptBytes),
    recordFromBytes(FINAL_VALIDATION, finalValidationBytes),
    recordFromBytes(HANDOFF, handoffBytes),
  ].sort((left, right) => fileOrder(left.path, right.path));
  assert.equal(new Set(members.map(record => record.path)).size, members.length, 'G6 manifest duplicate member');
  assert.equal(members.length, 14, 'G6 manifest member count');
  return {
    kind: 'MO1307Phase3CR2C3TBG6EvidenceManifest',
    version: '1.0.0',
    finalizedAt,
    result: 'PASS_ACCEPTANCE_READY',
    phase3CR2: 'ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    priorG5Failure: inputs.priorG5Failure,
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
    },
    executionCounts: ZERO_EXECUTIONS,
    containingCommit: containingCommitRule(inputs.productionTree),
    phase3DExecuted: false,
  };
}

function buildFinalSeal(inputs, receiptRecord, finalValidationRecord, handoffRecord, manifestRecord, finalizedAt) {
  return {
    kind: 'MO1307Phase3CR2C3TBG6FinalSeal',
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
  assertExactInventory(G6_EVIDENCE, FINAL_EVIDENCE_FILES, 'G6 final evidence');
  const paths = ACCEPTANCE_ROOTS.flatMap(root => closureSnapshot(root, true).files.map(record => record.path)).sort(fileOrder);
  assert.equal(new Set(paths).size, paths.length, 'Acceptance path union contains duplicates');
  assert.equal(paths.length, 1326, 'Exact G6 final acceptance path count');
  return paths;
}

function assertAllowedPreWriteState() {
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB, 'G6 must finalize directly over C3TB');
  assert.equal(gitText(['diff', '--name-only']), '', 'Tracked unstaged changes are forbidden');
  assert.equal(gitText(['diff', '--cached', '--name-only']), '', 'Staged changes are forbidden before G6 finalization');
  const expected = ACCEPTANCE_ROOTS.flatMap(root => closureSnapshot(root, true).files.map(record => record.path)).sort(fileOrder);
  assert.equal(expected.length, 1321, 'Exact G6 prefinal path count');
  const entries = statusEntries();
  assert.deepEqual(entries.map(entry => entry.path).sort(fileOrder), expected, 'Exact pre-write acceptance path union');
  assert.equal(entries.every(entry => entry.status === '??'), true, 'Only untracked append-only files are permitted before G6 finalization');
  assert.equal(entries.some(entry => entry.path === PRODUCT || entry.path.startsWith(`${PRODUCT}/`)), false, 'Product path in status');
}

function sourceOnly() {
  const runtime = assertFixedRuntimeAndHistory(false);
  assert.equal(fs.existsSync(absolute(G6_EVIDENCE)), false, 'G6 evidence must not exist for source-only verification');
  const staticChain = verifyStaticChain(runtime);
  const priorPaths = priorAcceptancePaths();
  const g6Tools = assertG6ToolNamespace();
  const expectedStatus = [...priorPaths, ...g6Tools.files.map(record => record.path)].sort(fileOrder);
  const entries = statusEntries();
  assert.deepEqual(entries.map(entry => entry.path).sort(fileOrder), expectedStatus, 'Source-only exact untracked path union');
  assert.equal(entries.every(entry => entry.status === '??'), true, 'Source-only requires append-only untracked files');
  process.stdout.write(`${canonical({
    mode: '--verify-source-only',
    result: 'PASS_SOURCE_CHAIN_VERIFIED',
    head: C3TB,
    branch: BRANCH,
    productionTree: runtime.productionTree,
    canonicalRoot: runtime.canonicalRoot,
    priorPathCount: priorPaths.length,
    g6ToolFiles: g6Tools.fileCount,
    preservedG2Outcome: staticChain.source.sourceG2.ledger.outcome,
    preservedG3Outcome: staticChain.priorG3Failure.outcome,
    preservedG4Outcome: staticChain.priorG4Failure.outcome,
    preservedG5Outcome: staticChain.priorG5Failure.outcome,
    writes: 0,
    executions: ZERO_EXECUTIONS,
  })}\n`);
}

function writeFinal() {
  const runtime = assertFixedRuntimeAndHistory(false);
  const staticChain = verifyStaticChain(runtime);
  assertAllowedPreWriteState();
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
  assertExactInventory(G6_EVIDENCE, FINAL_EVIDENCE_FILES, 'G6 post-finalization evidence');
  process.stdout.write(`${canonical({
    mode: '--write',
    result: 'PASS_FINAL_ARTIFACTS_WRITTEN',
    outcome: 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    freshExecutedInG6: 0,
    freshAcceptedFromG4: 89,
    reusedExactAcceptedFromG4: 462,
    candidateSpecificAcceptedFromG4: 2,
    outputs: TERMINAL_OUTPUTS,
    next: 'Stage the exact 1326-path acceptance union, run --verify-staged, create one single-parent commit over C3TB, then run --verify-committed. Do not push, tag, or execute Phase 3D.',
  })}\n`);
}

function loadFinal(runtime, staticChain = undefined) {
  assertExactInventory(G6_EVIDENCE, FINAL_EVIDENCE_FILES, 'G6 final evidence');
  const inputs = loadPrefinal(runtime, staticChain);
  const receipt = readJson(RECEIPT);
  const finalValidation = readJson(FINAL_VALIDATION);
  const handoff = readJson(HANDOFF);
  const manifest = readJson(MANIFEST);
  const finalSeal = readJson(FINAL_SEAL);
  const finalizedAt = receipt.finalizedAt;
  assert.equal(typeof finalizedAt, 'string');
  assert.deepEqual(receipt, buildReceipt(inputs, finalizedAt), 'Exact G6 certification receipt');
  const receiptRecord = fileRecord(RECEIPT);
  assert.deepEqual(finalValidation, buildFinalValidation(inputs, receiptRecord, finalizedAt), 'Exact G6 final validation');
  const finalValidationRecord = fileRecord(FINAL_VALIDATION);
  assert.deepEqual(handoff, buildHandoff(inputs, receiptRecord, finalValidationRecord, finalizedAt), 'Exact G6 Phase 3D handoff');
  assert.deepEqual(manifest, buildManifest(inputs, readRegularBytes(RECEIPT), readRegularBytes(FINAL_VALIDATION), readRegularBytes(HANDOFF), finalizedAt), 'Exact G6 evidence manifest');
  assert.deepEqual(finalSeal, buildFinalSeal(inputs, receiptRecord, finalValidationRecord, fileRecord(HANDOFF), fileRecord(MANIFEST), finalizedAt), 'Exact G6 final seal');
  for (const artifact of [receipt, finalValidation, handoff, manifest, finalSeal]) {
    assertGeneration(artifact.generation, artifact.kind);
    assertAuthoritativeBinding(artifact.authoritativeBinding, runtime.productionTree, artifact.kind);
    assertZeroExecutions(artifact.executionCounts, artifact.kind);
  }
  return { inputs, receipt, finalValidation, handoff, manifest, finalSeal, expectedPaths: acceptancePaths() };
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
  const expectedLines = KNOWN_G4_WHITESPACE_VIOLATIONS.map(violation => `${violation.path}:${violation.line}: ${violation.message}`);
  const actualLines = result.stdout.toString('utf8').replaceAll('\r\n', '\n').trimEnd().split('\n');
  assert.deepEqual(actualLines, expectedLines, `${label}: exact two immutable G4 violations and no others`);
}

function assertG5AndG6WhitespaceClean(args, label) {
  const result = runGitResult(args);
  assert.equal(result.status, 0, `${label}: fixed Git exit code`);
  assert.equal(result.stdout.toString('utf8'), '', `${label}: stdout`);
  assert.equal(result.stderr.toString('utf8'), '', `${label}: stderr`);
}

function verifyStaged() {
  const runtime = assertFixedRuntimeAndHistory(false);
  const staticChain = verifyStaticChain(runtime);
  const artifacts = loadFinal(runtime, staticChain);
  const staged = runGit(['diff', '--cached', '--name-only', '-z', C3TB])
    .toString('utf8').split('\0').filter(Boolean).map(slash).sort(fileOrder);
  assert.deepEqual(staged, artifacts.expectedPaths, 'Exact staged Phase 3CR2 path union');
  assert.equal(gitText(['diff', '--name-only']), '', 'Unstaged tracked changes are forbidden');
  assert.equal(gitText(['diff', '--cached', '--name-only', '--', PRODUCT]), '', 'Product paths are forbidden');
  const entries = statusEntries();
  assert.equal(entries.length, artifacts.expectedPaths.length);
  assert.deepEqual(entries.map(entry => entry.path).sort(fileOrder), artifacts.expectedPaths);
  assert.equal(entries.every(entry => entry.status === 'A '), true, 'Every acceptance path must have A-only status');
  for (const relative of artifacts.expectedPaths) assertStagedBlob(relative);
  assertExactKnownWhitespaceResult(runGitResult(['diff', '--cached', '--check']), 'Full staged whitespace check');
  assertG5AndG6WhitespaceClean(
    ['diff', '--cached', '--check', '--', G5_TOOL, G5_EVIDENCE, G6_TOOL, G6_EVIDENCE],
    'G5+G6 staged whitespace check',
  );
  process.stdout.write(`${canonical({
    mode: '--verify-staged',
    result: 'PASS_STAGED_ACCEPTANCE',
    acceptanceState: 'PHASE3CR2_ACCEPTANCE_PENDING_CONTAINING_COMMIT',
    files: artifacts.expectedPaths.length,
    parent: C3TB,
    exactImmutableG4WhitespaceViolations: KNOWN_G4_WHITESPACE_VIOLATIONS,
    g5AndG6WhitespaceViolations: 0,
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
  const nameStatus = runGit(['diff-tree', '--no-commit-id', '--name-status', '-r', '-z', C3TB, head])
    .toString('utf8').split('\0').filter(Boolean);
  assert.equal(nameStatus.length, artifacts.expectedPaths.length * 2, 'Committed name-status arity');
  for (let index = 0; index < nameStatus.length; index += 2) assert.equal(nameStatus[index], 'A', `Committed path is not A-only: ${nameStatus[index + 1]}`);
  assert.equal(gitText(['rev-parse', `${head}:${PRODUCT}`]), runtime.productionTree, 'Committed production tree');
  assert.equal(gitText(['diff', '--name-only', C3TB, head, '--', PRODUCT]), '', 'Committed product changes');
  for (const relative of artifacts.expectedPaths) {
    assert.equal(gitText(['rev-parse', `${head}:${relative}`]), gitBlob(readRegularBytes(relative)), `Committed bytes differ: ${relative}`);
  }
  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all']), '', 'Repository must be clean');
  assertExactKnownWhitespaceResult(runGitResult(['diff', '--check', C3TB, head]), 'Full committed whitespace check');
  assertG5AndG6WhitespaceClean(
    ['diff', '--check', C3TB, head, '--', G5_TOOL, G5_EVIDENCE, G6_TOOL, G6_EVIDENCE],
    'G5+G6 committed whitespace check',
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
    freshExecutedInG6: 0,
    freshAcceptedFromG4: 89,
    reusedExactAcceptedFromG4: 462,
    candidateSpecificAcceptedFromG4: 2,
    sourceSecurityReviewsAcceptedFromG4: 12,
    preservedG2Outcome: 'PHASE3CR2_FAILED_INCOMPLETE',
    preservedG3Outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    preservedG4Outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    preservedG5Outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
    exactImmutableG4WhitespaceViolations: KNOWN_G4_WHITESPACE_VIOLATIONS,
    g5AndG6WhitespaceViolations: 0,
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
