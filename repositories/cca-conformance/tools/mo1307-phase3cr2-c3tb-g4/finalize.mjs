// Append-only Phase 3CR2 G4 reconciliation-only acceptance finalizer.
//
// This program validates immutable G2 witnesses, the immutable failed G3
// recovery, and G4 administrative reconciliation artifacts. It never launches a product, helper, worker,
// native control, security control, or network operation.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
const C3T_PARENT = '79ef47e608c67edc70f3e9f51d494b169794f903';
const C3T_TREE = 'd21f46bc31ccd7a9f80a5e494b3d09116d125522';
const C3TB = '119e68bdcf0ffc906b4ca03a912aadcb25908346';
const C3TB_TREE = '5e0088965d4eac4002165fe0190f275c257985ba';
const HELPER_SHA256 = 'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127';
const HELPER_BLOB = '7ca55b8713108465099ecfce9796e06e3db67bd2';
const ACCEPTED_PHASE3BR2 = '4d92f0f21c9c3aad8202f4558d61b9229c7214fc';
const ACCEPTED_PHASE3BR2_TREE = '7d07f5f570248f8159339ae33637194937cf4918';

const PRODUCT = 'repositories/memoryos-readiness';
const HELPER = `${PRODUCT}/helpers/windows-inspect.ps1`;
const CANDIDATE_AUTHORITY = 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate';
const BINDING = `${CANDIDATE_AUTHORITY}/binding.json`;
const BINDING_VERIFICATION = `${CANDIDATE_AUTHORITY}/binding-verification.json`;
const CANDIDATE_RECORD = `${CANDIDATE_AUTHORITY}/candidate.json`;

const ORIGINAL_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb';
const ORIGINAL_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb';
const G2_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g2';
const G2_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2';
const G2_VALIDATION = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2-harness-validation';
const G2_VALIDATION_FILE = `${G2_VALIDATION}/validation.json`;
const G2_PLAN = `${G2_EVIDENCE}/campaign-plan.json`;
const G2_SEAL = `${G2_EVIDENCE}/pre-execution-seal.json`;
const G2_LEDGER = `${G2_EVIDENCE}/execution-ledger.json`;
const G2_REUSE = `${G2_EVIDENCE}/dependency-reuse.json`;

const G3_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g3';
const G3_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g3';
const G3_VALIDATION = `${G3_EVIDENCE}/zero-execution-validation.json`;
const G3_PLAN = `${G3_EVIDENCE}/recovery-plan.json`;
const G3_SEAL = `${G3_EVIDENCE}/pre-execution-seal.json`;
const G3_RECONCILIATION_OUTPUTS = Object.freeze([
  `${G3_EVIDENCE}/fresh-control-results.json`,
  `${G3_EVIDENCE}/candidate-specific-controls.json`,
  `${G3_EVIDENCE}/source-security-reviews.json`,
  `${G3_EVIDENCE}/administrative-recovery.json`,
]);
const G3_EVIDENCE_FILES = Object.freeze([G3_VALIDATION, G3_PLAN, G3_SEAL]);

const G4_TOOL = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g4';
const G4_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g4';
const G4_REPORT = 'repositories/cca-conformance/docs/mo1307-phase3cr2-c3tb-g4.md';
const VALIDATION = `${G4_EVIDENCE}/zero-execution-validation.json`;
const PLAN = `${G4_EVIDENCE}/recovery-plan.json`;
const PRE_SEAL = `${G4_EVIDENCE}/pre-execution-seal.json`;
const ADMINISTRATIVE_RECOVERY = `${G4_EVIDENCE}/administrative-recovery.json`;
const FRESH = `${G4_EVIDENCE}/fresh-control-results.json`;
const CANDIDATE_CONTROLS = `${G4_EVIDENCE}/candidate-specific-controls.json`;
const REVIEWS = `${G4_EVIDENCE}/source-security-reviews.json`;
const RECEIPT = `${G4_EVIDENCE}/certification-receipt.json`;
const FINAL_VALIDATION = `${G4_EVIDENCE}/final-validation.json`;
const HANDOFF = `${G4_EVIDENCE}/phase3d-handoff.json`;
const MANIFEST = `${G4_EVIDENCE}/evidence-manifest.json`;
const FINAL_SEAL = `${G4_EVIDENCE}/final-seal.json`;

const GENERATION = Object.freeze({
  id: 'phase3cr2-c3tb-g4',
  ordinal: 4,
  mode: 'RECONCILIATION_ONLY_FROM_IMMUTABLE_G2_AFTER_FAILED_G3',
  resumesPriorAttempt: false,
  sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
  priorRecoveryGeneration: 'phase3cr2-c3tb-g3',
});
const G3_GENERATION = Object.freeze({
  id: 'phase3cr2-c3tb-g3',
  ordinal: 3,
  mode: 'RECONCILIATION_ONLY_FROM_IMMUTABLE_G2',
  resumesPriorAttempt: false,
  sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
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
const EXPECTED_VALIDATION_CASES = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F']);
const EXPECTED_CANDIDATE_CONTROLS = Object.freeze([
  'candidate:prospective-bound-generated-contract-consistency',
  'candidate:prospective-bound-package-and-binding-identity',
]);
const EXPECTED_REVIEWS = Object.freeze([
  'DEADLINE_CONSTANT_BINDING',
  'STRICT_TIMEOUT_EQUALITY',
  'TIMEOUT_MAPPING',
  'LATE_SUCCESS_REFUSAL',
  'SEQUENCE_NO_PARTIAL_SUCCESS',
  'SEPARATE_CLEANUP_TIMING',
  'NATIVE_API_PARITY',
  'GENERATED_CONTRACT_CONSISTENCY',
  'HEADLESS_AND_STARTUP_CORRECTIONS',
  'FILESYSTEM_AND_TOCTOU_CORRECTIONS',
  'SOURCE_SECURITY_REVIEW',
  'CANDIDATE_BINDING',
]);
const G2_FORBIDDEN_TERMINAL_OUTPUTS = Object.freeze([
  `${G2_EVIDENCE}/fresh-control-results.json`,
  `${G2_EVIDENCE}/candidate-specific-controls.json`,
  `${G2_EVIDENCE}/source-security-reviews.json`,
  `${G2_EVIDENCE}/certification-receipt.json`,
  `${G2_EVIDENCE}/final-validation.json`,
  `${G2_EVIDENCE}/final-review.json`,
  `${G2_EVIDENCE}/phase3d-handoff.json`,
  `${G2_EVIDENCE}/evidence-manifest.json`,
  `${G2_EVIDENCE}/final-seal.json`,
]);
const G2_ADMINISTRATIVE_RECOVERY = `${G2_EVIDENCE}/administrative-recovery.json`;
const FINAL_OUTPUTS = Object.freeze([RECEIPT, FINAL_VALIDATION, HANDOFF, MANIFEST, FINAL_SEAL]);
const G4_RECONCILED_INPUTS = Object.freeze([
  VALIDATION,
  PLAN,
  PRE_SEAL,
  ADMINISTRATIVE_RECOVERY,
  FRESH,
  CANDIDATE_CONTROLS,
  REVIEWS,
]);
const G4_FINAL_EVIDENCE_FILES = Object.freeze([...G4_RECONCILED_INPUTS, ...FINAL_OUTPUTS]);
const ACCEPTANCE_ROOTS = Object.freeze([
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
const ORIGINAL_TOOL_DIGEST = 'sha256:9abb9d879a5b29724b42a8efa31f66579d104c336ef4ed2f2e304a77ff7c1e19';
const ORIGINAL_EVIDENCE_DIGEST = 'sha256:2ce1063de146fb4c1bb153175271ff19e0a6db5d9d759abe0e137e4b00b8224f';
const G2_EVIDENCE_DIGEST = 'sha256:eca2a9b239253173e76e40e13f9d4614b5039b226215760042a64677695e4416';
const G3_TOOL_DIGEST = 'sha256:cb80849ddec5df31f314f51fc397140f82452ada1e83da495caa630f5263527d';
const G3_EVIDENCE_DIGEST = 'sha256:66e59061edace9359f18d796511cc2c25791ce972a87f779f89321a9329ebe87';

const ordinal = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const fileOrder = (left, right) => left.localeCompare(right, 'en');
const slash = value => value.replaceAll('\\', '/');
const sha256 = data => `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
const gitBlob = data => crypto.createHash('sha1')
  .update(Buffer.from(`blob ${data.length}\0`))
  .update(data)
  .digest('hex');

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort(ordinal).map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
const canonicalBytes = value => Buffer.from(`${canonical(value)}\n`);

function absolute(relative) {
  const resolved = path.resolve(ROOT, relative);
  const prefix = `${path.resolve(ROOT)}${path.sep}`;
  assert.ok(resolved.startsWith(prefix), `Path escapes worktree: ${relative}`);
  return resolved;
}

function runGit(args, input = undefined) {
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
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${GIT} ${args.join(' ')}: ${result.stderr?.toString('utf8')}`);
  return result.stdout;
}
const gitText = args => runGit(args).toString('utf8').trim();

function regularBytes(relative) {
  const target = absolute(relative);
  const stat = fs.lstatSync(target);
  assert.equal(stat.isSymbolicLink(), false, `Symlink is forbidden: ${relative}`);
  assert.equal(stat.isFile(), true, `Expected regular file: ${relative}`);
  return fs.readFileSync(target);
}

function recordFromBytes(relative, bytes, includeGitBlob = true) {
  const record = { path: slash(relative), byteLength: bytes.length, sha256: sha256(bytes) };
  if (includeGitBlob) record.gitBlob = gitBlob(bytes);
  return record;
}
const fileRecord = (relative, includeGitBlob = true) => recordFromBytes(relative, regularBytes(relative), includeGitBlob);
const pin = relative => fileRecord(relative, false);
const readJson = relative => JSON.parse(regularBytes(relative).toString('utf8'));

function walkFiles(relative, includeGitBlob = true) {
  const root = absolute(relative);
  const rootStat = fs.lstatSync(root);
  assert.equal(rootStat.isSymbolicLink(), false, `Symlink is forbidden: ${relative}`);
  assert.equal(rootStat.isDirectory(), true, `Expected directory: ${relative}`);
  const files = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => fileOrder(a.name, b.name))) {
      const child = path.join(current, entry.name);
      assert.equal(entry.isSymbolicLink(), false, `Symlink is forbidden: ${child}`);
      if (entry.isDirectory()) walk(child);
      else {
        assert.equal(entry.isFile(), true, `Expected regular file: ${child}`);
        files.push(fileRecord(slash(path.relative(ROOT, child)), includeGitBlob));
      }
    }
  };
  walk(root);
  return files.sort((a, b) => fileOrder(a.path, b.path));
}

function assertPin(record, expectedPath = record?.path) {
  assert.equal(record?.path, expectedPath, `Pin path: ${expectedPath}`);
  const actualWithBlob = fileRecord(expectedPath);
  const actual = Object.hasOwn(record, 'gitBlob') ? actualWithBlob : {
    path: actualWithBlob.path,
    byteLength: actualWithBlob.byteLength,
    sha256: actualWithBlob.sha256,
  };
  assert.deepEqual(record, actual, `Pin changed: ${expectedPath}`);
}

function assertClosure(closure, expectedPath, expectedCount, expectedDigest = undefined, includeGitBlob = true) {
  assert.equal(closure?.path, expectedPath, `${expectedPath}: closure path`);
  assert.equal(closure.fileCount, expectedCount, `${expectedPath}: recorded file count`);
  const actual = walkFiles(expectedPath, includeGitBlob);
  assert.equal(actual.length, expectedCount, `${expectedPath}: current file count`);
  assert.deepEqual(closure.files, actual, `${expectedPath}: closure members`);
  const digest = sha256(canonicalBytes(actual));
  assert.equal(closure.digest, digest, `${expectedPath}: closure digest`);
  if (expectedDigest !== undefined) assert.equal(digest, expectedDigest, `${expectedPath}: immutable digest`);
  return actual;
}

function assertExactIds(rows, expected, label, result = undefined) {
  assert.ok(Array.isArray(rows), `${label}: rows`);
  const ids = rows.map(row => row.id);
  assert.equal(new Set(ids).size, ids.length, `${label}: duplicate IDs`);
  assert.deepEqual([...ids].sort(ordinal), [...expected].sort(ordinal), `${label}: exact IDs`);
  if (result !== undefined) assert.equal(rows.every(row => row.result === result), true, `${label}: result`);
}

function assertZeroExecutions(actual, label) {
  assert.deepEqual(actual, ZERO_EXECUTIONS, `${label}: exact zero-execution accounting`);
}

function assertGeneration(actual, label) {
  assert.deepEqual(actual, GENERATION, `${label}: generation`);
}

function assertAuthoritativeBinding(binding, label, expectedProductionTree) {
  assert.ok(binding && typeof binding === 'object' && !Array.isArray(binding), `${label}: binding object`);
  assert.equal(binding.result, 'PASS', `${label}: result`);
  assert.deepEqual(binding.candidate, {
    role: 'C3TB',
    branch: BRANCH,
    commit: C3TB,
    tree: C3TB_TREE,
    soleParent: C3T,
  }, `${label}: exact candidate identity`);
  assert.deepEqual(binding.production, {
    role: 'C3T',
    commit: C3T,
    parent: C3T_PARENT,
    rootTree: C3T_TREE,
    tree: expectedProductionTree,
  }, `${label}: exact production identity`);
  const helper = binding.helper;
  assert.ok(helper && typeof helper === 'object', `${label}: helper`);
  assert.equal(helper.sha256, HELPER_SHA256, `${label}: helper SHA-256`);
  const normalizedHelperPath = slash(helper.path);
  assert.equal(
    normalizedHelperPath === HELPER || normalizedHelperPath === 'helpers/windows-inspect.ps1',
    true,
    `${label}: helper path`,
  );
  if (Object.hasOwn(helper, 'gitBlob')) assert.equal(helper.gitBlob, HELPER_BLOB, `${label}: helper blob`);
  assert.deepEqual(binding.nonAuthoritativePlaceholders, {
    candidateCommit: null,
    candidateProductionTree: null,
    candidatePackageProductionTree: null,
    candidatePackageProductionTreePresent: false,
    excludedFromDerivation: true,
  }, `${label}: prebinding placeholders must be null and excluded from derivation`);
}

function assertExactG4EvidenceInventory(expectedPaths, label) {
  assert.equal([7, 12].includes(expectedPaths.length), true, `${label}: expected inventory arity must be 7 or 12`);
  const evidenceRoot = absolute(G4_EVIDENCE);
  const rootStat = fs.lstatSync(evidenceRoot);
  assert.equal(rootStat.isSymbolicLink(), false, `${label}: G4 evidence root is a symlink`);
  assert.equal(rootStat.isDirectory(), true, `${label}: G4 evidence root is not a directory`);
  const entries = fs.readdirSync(evidenceRoot, { withFileTypes: true }).sort((a, b) => fileOrder(a.name, b.name));
  const actualPaths = entries.map(entry => `${G4_EVIDENCE}/${entry.name}`).sort(fileOrder);
  assert.equal(entries.length, expectedPaths.length, `${label}: exact G4 evidence count`);
  assert.deepEqual(actualPaths, [...expectedPaths].sort(fileOrder), `${label}: exact G4 evidence inventory`);
  for (const entry of entries) {
    const relative = `${G4_EVIDENCE}/${entry.name}`;
    assert.equal(entry.isSymbolicLink(), false, `${label}: symlink is forbidden: ${relative}`);
    assert.equal(entry.isFile(), true, `${label}: only regular files are permitted: ${relative}`);
    const stat = fs.lstatSync(absolute(relative));
    assert.equal(stat.isSymbolicLink(), false, `${label}: symlink is forbidden: ${relative}`);
    assert.equal(stat.isFile(), true, `${label}: expected regular file: ${relative}`);
  }
}

function assertCommonAnchors() {
  assert.equal(process.version, EXPECTED_NODE.version, 'Unexpected Node version');
  assert.equal(process.platform, EXPECTED_NODE.platform, 'Unexpected Node platform');
  assert.equal(process.arch, EXPECTED_NODE.arch, 'Unexpected Node architecture');
  assert.equal(path.resolve(process.execPath).toLowerCase(), path.resolve(EXPECTED_NODE_PATH).toLowerCase(), 'Unexpected Node executable');
  const nodeBytes = fs.readFileSync(process.execPath);
  assert.equal(nodeBytes.length, EXPECTED_NODE.byteLength, 'Unexpected Node executable byte length');
  assert.equal(sha256(nodeBytes), EXPECTED_NODE.sha256, 'Unexpected Node executable SHA-256');
  assert.equal(gitText(['--version']), EXPECTED_GIT_VERSION, 'Unexpected Git version');
  assert.equal(gitText(['branch', '--show-current']), BRANCH, 'Unexpected branch');
  assert.equal(gitText(['cat-file', '-t', C3T]), 'commit');
  assert.equal(gitText(['cat-file', '-t', C3TB]), 'commit');
  assert.equal(gitText(['show', '-s', '--format=%P', C3T]), C3T_PARENT);
  assert.equal(gitText(['show', '-s', '--format=%T', C3T]), C3T_TREE);
  assert.equal(gitText(['show', '-s', '--format=%P', C3TB]), C3T);
  assert.equal(gitText(['show', '-s', '--format=%T', C3TB]), C3TB_TREE);
  assert.equal(gitText(['diff', '--name-only', C3T, C3TB, '--', PRODUCT]), '');
  assert.equal(gitText(['rev-parse', `${C3TB}:${HELPER}`]), HELPER_BLOB);
  const helperBytes = runGit(['show', `${C3TB}:${HELPER}`]);
  assert.equal(sha256(helperBytes), HELPER_SHA256);
  assert.equal(gitText(['cat-file', '-t', ACCEPTED_PHASE3BR2]), 'commit');
  assert.equal(gitText(['show', '-s', '--format=%P', ACCEPTED_PHASE3BR2]), C3TB);
  assert.equal(gitText(['show', '-s', '--format=%T', ACCEPTED_PHASE3BR2]), ACCEPTED_PHASE3BR2_TREE);

  const candidate = JSON.parse(runGit(['show', `${C3TB}:${CANDIDATE_RECORD}`]).toString('utf8'));
  const binding = JSON.parse(runGit(['show', `${C3TB}:${BINDING}`]).toString('utf8'));
  const verification = JSON.parse(runGit(['show', `${C3TB}:${BINDING_VERIFICATION}`]).toString('utf8'));
  const g2Plan = readJson(G2_PLAN);
  const g2Seal = readJson(G2_SEAL);
  const g2Ledger = readJson(G2_LEDGER);
  const productionTreeAuthorities = [
    ['G2 plan candidate', g2Plan.candidate.productionTree],
    ['G2 seal candidate', g2Seal.candidate.productionTree],
    ['binding implementation', binding.implementation.productionTree],
    ['binding package', binding.package.productionTree],
    ['binding verification', verification.productionTree],
    ['G2 ledger candidate', g2Ledger.candidate.productionTree],
    ['Git C3T product tree', gitText(['rev-parse', `${C3T}:${PRODUCT}`])],
    ['Git C3TB product tree', gitText(['rev-parse', `${C3TB}:${PRODUCT}`])],
    ['accepted Phase 3BR2 product tree', gitText(['rev-parse', `${ACCEPTED_PHASE3BR2}:${PRODUCT}`])],
  ];
  for (const [source, value] of productionTreeAuthorities) {
    assert.match(value, /^[0-9a-f]{40}$/u, `${source}: production tree`);
  }
  const expectedProductionTree = productionTreeAuthorities[0][1];
  assert.equal(productionTreeAuthorities.every(([, value]) => value === expectedProductionTree), true, 'Authoritative production-tree values differ');
  assert.equal(candidate.productionTree, null, 'Prebinding top-level placeholder must remain preserved');
  assert.equal(candidate.package?.productionTree ?? null, null, 'Prebinding package productionTree must remain excluded');
  assert.equal(candidate.helper.sha256, HELPER_SHA256);
  assert.equal(binding.binding.soleParent, C3T);
  assert.equal(binding.binding.productionChanges, false);
  assert.equal(binding.implementation.commit, C3T);
  assert.equal(binding.implementation.productionTree, expectedProductionTree);
  assert.equal(binding.package.productionTree, expectedProductionTree);
  assert.equal(binding.helper.sha256, HELPER_SHA256);
  assert.equal(verification.candidateCommit, C3T);
  assert.equal(verification.productionTree, expectedProductionTree);
  assert.equal(verification.productionChangesInBindingCommit, false);
  assert.equal(verification.result, 'PASS');
  return expectedProductionTree;
}

function assertG2Preserved(sourceG2, expectedProductionTree) {
  const toolFiles = assertClosure(sourceG2.tools, G2_TOOL, 18);
  const evidenceFiles = assertClosure(sourceG2.evidence, G2_EVIDENCE, 1043, G2_EVIDENCE_DIGEST, true);
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
  assert.equal(ledger.firstFailure.actual.code, 1);
  assert.equal(sourceG2.ledger.result, ledger.result);
  assert.equal(sourceG2.ledger.outcome, ledger.outcome);
  assert.deepEqual(sourceG2.ledger.firstFailure, {
    stage: ledger.firstFailure.stage,
    ordinal: ledger.firstFailure.ordinal,
    integrity: ledger.firstFailure.integrity,
  });
  assert.deepEqual(sourceG2.ledger.stages, ledger.stages.map(stage => ({
    ordinal: stage.ordinal,
    id: stage.id,
    status: stage.status,
    actual: stage.actual,
    integrity: stage.integrity,
  })));

  for (const relative of G2_FORBIDDEN_TERMINAL_OUTPUTS) {
    assert.equal(fs.existsSync(absolute(relative)), false, `G2 terminal output must remain absent: ${relative}`);
  }
  assert.equal(fs.existsSync(absolute(G2_ADMINISTRATIVE_RECOVERY)), false, `G2 administrative recovery must remain absent: ${G2_ADMINISTRATIVE_RECOVERY}`);
  const absent = sourceG2.absentTerminalOutputs;
  if (Array.isArray(absent)) {
    const paths = absent.map(item => typeof item === 'string' ? item : item.path);
    for (const relative of G2_FORBIDDEN_TERMINAL_OUTPUTS) {
      assert.equal(paths.includes(relative), true, `G2 absent-terminal inventory omitted ${relative}`);
    }
  } else {
    assert.equal(absent === true || absent?.result === 'PASS' || absent?.allAbsent === true, true, 'G2 absent terminal outputs');
  }

  const g2Plan = readJson(G2_PLAN);
  const g2Seal = readJson(G2_SEAL);
  assert.equal(g2Plan.kind, 'MO1307Phase3CR2C3TBCampaignPlan');
  assert.equal(g2Seal.kind, 'MO1307Phase3CR2C3TBPreExecutionSeal');
  assert.equal(g2Seal.result, 'SEALED_NOT_EXECUTED');
  assert.equal(g2Plan.candidate.commit, C3TB);
  assert.equal(g2Plan.candidate.implementation.commit, C3T);
  assert.equal(g2Plan.candidate.productionTree, expectedProductionTree);
  assert.equal(g2Plan.candidate.helper.sha256, HELPER_SHA256);
  assert.deepEqual(g2Seal.candidate, g2Plan.candidate);
  assert.deepEqual(g2Seal.finalizedToolInputs, g2Plan.finalizedToolInputs);
  assert.equal(g2Plan.finalizedToolInputCount, 18);
  assert.deepEqual(g2Plan.finalizedToolInputs, toolFiles);
  assert.equal(g2Plan.finalizedToolSetDigest, sha256(canonicalBytes(toolFiles)));

  const originalTools = assertClosure(g2Plan.priorFailedGeneration.tools, ORIGINAL_TOOL, 15, ORIGINAL_TOOL_DIGEST);
  const originalEvidence = assertClosure(g2Plan.priorFailedGeneration.evidence, ORIGINAL_EVIDENCE, 194, ORIGINAL_EVIDENCE_DIGEST);
  assert.equal(g2Plan.priorFailedGeneration.status, 'FAILED_INCOMPLETE');
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
  assert.deepEqual(walkFiles(G2_VALIDATION), [fileRecord(G2_VALIDATION_FILE)]);

  return { toolFiles, evidenceFiles, originalTools, originalEvidence, ledger };
}

function assertPriorG3Failure(prior, sourceG2, expectedProductionTree) {
  assert.ok(prior && typeof prior === 'object' && !Array.isArray(prior), 'prior G3 failure object');
  assert.deepEqual(prior.generation, G3_GENERATION, 'prior G3 generation');
  assert.equal(prior.result, 'PHASE3CR2_RECONCILIATION_BLOCKER', 'prior G3 result');
  assert.equal(prior.outcome, 'PHASE3CR2_RECONCILIATION_BLOCKER', 'prior G3 outcome');
  assert.deepEqual(prior.classification, [
    'MISSING_PROPAGATION',
    'OTHER_CONCRETE_RECONCILIATION_DEFECT',
  ], 'prior G3 classification');
  assert.equal(prior.classificationLabel, 'MISSING_PROPAGATION/OTHER_CONCRETE_RECONCILIATION_DEFECT');
  assert.equal(prior.failure?.code, 'ERR_ASSERTION');
  assert.equal(prior.failure?.path, `${G3_TOOL}/reconcile.mjs`);
  assert.equal(prior.failure?.line, 677);
  assert.equal(prior.failure?.assertion, 'assert.deepEqual(zeroExecutionValidation.authoritativeBinding, authoritativeBinding);');

  assert.equal(prior.cause?.missingField, 'git.helperCheckout.gitBlob');
  assert.equal(prior.cause?.construction?.line, 431);
  assert.equal(prior.cause?.construction?.source, 'const helperCheckout = filePin(HELPER_PATH);');
  assert.equal(prior.cause?.filePin?.startLine, 234);
  assert.equal(prior.cause?.filePin?.returnLine, 237);
  assert.equal(prior.cause?.filePin?.includesGitBlob, false);
  assert.equal(prior.cause?.sealedValidationAuthoritySource, 'authoritativeBinding.helperAuthorities.gitBlobs');
  assert.equal(prior.cause?.sealedContainsCheckoutHelperGitBlob, true);
  assert.equal(prior.cause?.reconstructedContainsCheckoutHelperGitBlob, false);
  assert.equal(prior.cause?.exactAuthoritativeBindingDeepEqual, false);
  assert.equal(prior.cause?.onlyDifference, 'authoritativeBinding.helperAuthorities.gitBlobs[checkout.helper.gitBlob]');
  assert.deepEqual(prior.cause?.expectedCheckoutGitBlobAuthority, {
    source: 'checkout.helper.gitBlob',
    value: HELPER_BLOB,
  });
  assert.equal(prior.cause?.reconstructedHelperIdentity?.path, HELPER);
  assert.equal(prior.cause?.reconstructedHelperIdentity?.sha256, HELPER_SHA256);
  assert.equal(prior.cause?.reconstructedHelperIdentity?.gitBlob, HELPER_BLOB);

  assert.deepEqual(prior.outputsWritten, {
    fresh: false,
    candidate: false,
    reviews: false,
    administrativeRecovery: false,
  });
  assert.deepEqual(prior.absentReconciliationOutputs, [...G3_RECONCILIATION_OUTPUTS]);
  for (const relative of G3_RECONCILIATION_OUTPUTS) {
    assert.equal(fs.existsSync(absolute(relative)), false, `Prior G3 reconciliation output must remain absent: ${relative}`);
  }

  const g3Tools = assertClosure(prior.tools, G3_TOOL, 7, G3_TOOL_DIGEST, true);
  const g3Evidence = assertClosure(prior.evidence, G3_EVIDENCE, 3, G3_EVIDENCE_DIGEST, true);
  assert.deepEqual(g3Evidence.map(record => record.path), [...G3_EVIDENCE_FILES].sort(fileOrder));
  assertPin(prior.artifacts?.zeroExecutionValidation, G3_VALIDATION);
  assertPin(prior.artifacts?.recoveryPlan, G3_PLAN);
  assertPin(prior.artifacts?.preExecutionSeal, G3_SEAL);
  assertPin(prior.artifacts?.reconcile, `${G3_TOOL}/reconcile.mjs`);
  assert.equal(prior.sourceIntegrity?.validationPlanSealExact, true);
  assert.equal(prior.sourceIntegrity?.closureOrdering, "localeCompare('en')");
  assert.equal(prior.sourceIntegrity?.closureRecordsIncludeGitBlob, true);
  assert.equal(prior.sourceIntegrity?.mechanicallyReproduced, true);

  const validation = readJson(G3_VALIDATION);
  const plan = readJson(G3_PLAN);
  const seal = readJson(G3_SEAL);
  assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG3ZeroExecutionValidation');
  assert.equal(validation.result, 'PASS');
  assert.deepEqual(validation.generation, G3_GENERATION);
  assertAuthoritativeBinding(validation.authoritativeBinding, 'preserved G3 validation', expectedProductionTree);
  assert.deepEqual(validation.sourceG2, sourceG2);
  assertZeroExecutions(validation.executionCounts, 'preserved G3 validation');
  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBG3RecoveryPlan');
  assert.equal(plan.status, 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED');
  assert.deepEqual(plan.generation, G3_GENERATION);
  assert.deepEqual(plan.validation, pin(G3_VALIDATION));
  assert.deepEqual(plan.sourceG2, sourceG2);
  assert.equal(plan.finalizedToolInputCount, 7);
  assert.deepEqual(plan.finalizedToolInputs, g3Tools);
  assert.equal(plan.finalizedToolSetDigest, G3_TOOL_DIGEST);
  assert.equal(seal.kind, 'MO1307Phase3CR2C3TBG3PreExecutionSeal');
  assert.equal(seal.result, 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED');
  assert.deepEqual(seal.generation, G3_GENERATION);
  assert.deepEqual(seal.validation, pin(G3_VALIDATION));
  assert.deepEqual(seal.recoveryPlan, pin(G3_PLAN));
  assert.deepEqual(seal.sourceG2, sourceG2);
  assert.equal(seal.finalizedToolInputCount, 7);
  assert.deepEqual(seal.finalizedToolInputs, g3Tools);
  assert.equal(seal.finalizedToolSetDigest, G3_TOOL_DIGEST);
  assertZeroExecutions(seal.executionCounts, 'preserved G3 seal');
  return { g3Tools, g3Evidence, validation, plan, seal };
}

function assertValidation(validation, expectedProductionTree) {
  assert.equal(validation.kind, 'MO1307Phase3CR2C3TBG4ZeroExecutionValidation');
  assert.equal(validation.result, 'PASS');
  assertGeneration(validation.generation, 'zero-execution validation');
  assertAuthoritativeBinding(validation.authoritativeBinding, 'zero-execution validation', expectedProductionTree);
  assertZeroExecutions(validation.executionCounts, 'zero-execution validation');
  assertExactIds(validation.cases, EXPECTED_VALIDATION_CASES, 'zero-execution validation cases', 'PASS');
  assertPriorG3Failure(validation.priorG3Failure, validation.sourceG2, expectedProductionTree);
  assert.deepEqual(
    validation.authoritativeBinding,
    readJson(G3_VALIDATION).authoritativeBinding,
    'G4 binding must exactly reproduce the sealed G3 authoritative binding after the propagation correction',
  );

  const byId = new Map(validation.cases.map(row => [row.id, row]));
  const observed = row => row.observed ?? row.actual;
  const resultOf = value => typeof value === 'object' && value !== null ? value.result : value;
  assert.equal(resultOf(observed(byId.get('A'))), 'PASS', 'A exact binding must pass');
  for (const id of ['B', 'C', 'D', 'E']) {
    const value = resultOf(observed(byId.get(id)));
    assert.equal(['FAIL', 'EXPECTED_FAIL'].includes(value), true, `${id} must observe fail-closed rejection`);
  }
  assert.equal(resultOf(observed(byId.get('F'))), 'PASS', 'F exact preserved G2 evidence must pass');
}

function assertToolSeal(plan, preSeal) {
  const tools = walkFiles(G4_TOOL);
  assert.equal(tools.length, 7, 'G4 exact tool count');
  assert.equal(plan.finalizedToolInputCount, tools.length);
  assert.deepEqual(plan.finalizedToolInputs, tools);
  assert.equal(plan.finalizedToolSetDigest, sha256(canonicalBytes(tools)));
  assert.equal(preSeal.finalizedToolInputCount, tools.length);
  assert.deepEqual(preSeal.finalizedToolInputs, tools);
  assert.equal(preSeal.finalizedToolSetDigest, sha256(canonicalBytes(tools)));
  return tools;
}

function assertRecoveryAuthority(administrative) {
  const citations = administrative.authorityCitations
    ?? administrative.authority?.citations
    ?? administrative.administrativeAuthority?.citations;
  assert.ok(Array.isArray(citations) && citations.length > 0, 'Administrative recovery authority citations are required');
  for (const [index, citation] of citations.entries()) {
    assert.ok(citation && typeof citation === 'object', `Authority citation ${index}`);
    assert.equal(typeof (citation.path ?? citation.source), 'string', `Authority citation ${index}: source path`);
    assert.equal(typeof (citation.rule ?? citation.finding ?? citation.statement), 'string', `Authority citation ${index}: rule`);
  }
  return citations;
}

function assertReconciledOutputs(fresh, reuse, candidate, reviews, expectedProductionTree) {
  assert.equal(fresh.kind, 'MO1307Phase3CR2C3TBFreshControlResults');
  assert.equal(fresh.result, 'PASS_FRESH_COMPLETE');
  assert.equal(fresh.candidate, C3TB);
  assert.equal(fresh.candidateImplementation, C3T);
  assert.equal(fresh.productionTree, expectedProductionTree);
  assert.equal(fresh.count, 89);
  assert.equal(fresh.negative, 74);
  assert.equal(fresh.rows.length, 89);
  assert.equal(fresh.rows.every(row => row.result === 'PASS_FRESH'), true);
  assert.equal(fresh.accounting.omittedHistoricalControls, 0);
  assert.equal(fresh.accounting.selectedIdsOrdinalUnique, true);
  assert.equal(fresh.accounting.selectedAndReuseDisjoint, true);
  assert.equal(fresh.accounting.selectedExactMapMatch, true);
  assert.equal(fresh.accounting.freshOutcomesOnly, true);
  assert.equal(fresh.accounting.historicalPassReusedForSelected, false);

  assert.equal(reuse.kind, 'MO1307Phase3CR2DependencyReuse');
  assert.equal(reuse.result, 'PASS');
  assert.equal(reuse.candidate, C3TB);
  assert.equal(reuse.candidateImplementation, C3T);
  assert.equal(reuse.counts.historicalInventory, 551);
  assert.equal(reuse.counts.selectedFreshHistoricalControls, 89);
  assert.equal(reuse.counts.reusedHistoricalControls, 462);
  assert.equal(reuse.counts.candidateSpecificSupplementalControls, 2);
  assert.equal(reuse.counts.omittedHistoricalControls, 0);
  assert.equal(reuse.rows.length, 462);
  assert.equal(reuse.rows.every(row => row.disposition === 'REUSED_EXACT'), true);
  assert.equal(reuse.rows.every(row => row.equalityProof?.allExercisedFacetsEqual === true), true);
  assert.equal(reuse.rows.every(row => row.equalityProof?.selectedIntersection === false), true);
  assert.equal(reuse.rows.every(row => row.exercisedDependencies?.every(facet => facet.equal === true)), true);
  assert.equal(reuse.accounting.exactOrdinalPartition, true);
  assert.equal(reuse.accounting.selectedAndReuseDisjoint, true);
  assert.equal(reuse.accounting.selectedIdsNeverReused, true);
  assert.equal(reuse.accounting.reuseRowsOrdinalUnique, true);
  assert.equal(reuse.dependencyDisposition.reusedExact, 462);
  assert.deepEqual(reuse.dependencyDisposition.movedToFresh, []);
  assert.deepEqual(reuse.dependencyDisposition.unresolved, []);
  assert.deepEqual(reuse.dependencyDisposition.mismatches, []);

  assert.equal(candidate.kind, 'MO1307Phase3CR2CandidateSpecificControls');
  assert.equal(candidate.result, 'PASS');
  assert.equal(candidate.candidate, C3TB);
  assert.equal(candidate.candidateImplementation, C3T);
  assert.equal(candidate.productionTree, expectedProductionTree);
  assert.equal(candidate.count, 2);
  assertExactIds(candidate.rows, EXPECTED_CANDIDATE_CONTROLS, 'candidate-specific controls', 'PASS');
  assert.equal(candidate.historicalOutcomeAdopted, false);

  assert.equal(reviews.kind, 'MO1307Phase3CR2SourceSecurityReviews');
  assert.equal(reviews.result, 'PASS');
  assert.equal(reviews.candidate, C3TB);
  assert.equal(reviews.candidateImplementation, C3T);
  assert.equal(reviews.productionTree, expectedProductionTree);
  assert.equal(reviews.count, 12);
  assertExactIds(reviews.rows, EXPECTED_REVIEWS, 'source/security reviews', 'PASS');
  assert.equal(reviews.governance.phase3DExecuted, false);
  assert.equal(reviews.governance.push, false);
  assert.equal(reviews.governance.tag, false);

  const freshIds = fresh.rows.map(row => row.id);
  const reuseIds = reuse.rows.map(row => row.id);
  assert.equal(new Set(freshIds).size, 89, 'Fresh IDs must be unique');
  assert.equal(new Set(reuseIds).size, 462, 'Reuse IDs must be unique');
  const overlap = freshIds.filter(id => new Set(reuseIds).has(id));
  assert.deepEqual(overlap, [], 'Fresh and reuse IDs must be disjoint');
  assert.equal(new Set([...freshIds, ...reuseIds]).size, 551, 'Historical inventory must be complete');
}

function loadInputs(expectedProductionTree, expectedEvidencePaths) {
  assertExactG4EvidenceInventory(expectedEvidencePaths, 'loadInputs');
  const validation = readJson(VALIDATION);
  const plan = readJson(PLAN);
  const preSeal = readJson(PRE_SEAL);
  const administrative = readJson(ADMINISTRATIVE_RECOVERY);
  const fresh = readJson(FRESH);
  const reuse = readJson(G2_REUSE);
  const candidate = readJson(CANDIDATE_CONTROLS);
  const reviews = readJson(REVIEWS);

  assertValidation(validation, expectedProductionTree);
  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBG4RecoveryPlan');
  assert.equal(plan.status, 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED');
  assertGeneration(plan.generation, 'recovery plan');
  assertAuthoritativeBinding(plan.authoritativeBinding, 'recovery plan', expectedProductionTree);
  assert.deepEqual(plan.validation, pin(VALIDATION), 'Recovery plan validation pin');

  assert.equal(preSeal.kind, 'MO1307Phase3CR2C3TBG4PreExecutionSeal');
  assert.equal(preSeal.result, 'SEALED_RECONCILIATION_ONLY_NOT_EXECUTED');
  assertGeneration(preSeal.generation, 'pre-execution seal');
  assertAuthoritativeBinding(preSeal.authoritativeBinding, 'pre-execution seal', expectedProductionTree);
  assert.deepEqual(preSeal.recoveryPlan, pin(PLAN), 'Pre-execution seal recovery-plan pin');
  assert.deepEqual(preSeal.validation, pin(VALIDATION), 'Pre-execution seal validation pin');
  assertZeroExecutions(preSeal.executionCounts, 'pre-execution seal');
  assert.equal(preSeal.appendOnly === true || preSeal.appendOnly?.writesUseExclusiveCreate === true, true, 'Append-only pre-execution seal');

  assert.deepEqual(plan.authoritativeBinding, validation.authoritativeBinding);
  assert.deepEqual(preSeal.authoritativeBinding, validation.authoritativeBinding);
  assert.deepEqual(plan.sourceG2, validation.sourceG2);
  assert.deepEqual(preSeal.sourceG2, validation.sourceG2);
  assert.deepEqual(plan.priorG3Failure, validation.priorG3Failure);
  assert.deepEqual(preSeal.priorG3Failure, validation.priorG3Failure);
  const preserved = assertG2Preserved(validation.sourceG2, expectedProductionTree);
  const g4Tools = assertToolSeal(plan, preSeal);

  assert.equal(administrative.kind, 'MO1307Phase3CR2C3TBG4AdministrativeRecovery');
  assert.equal(administrative.result, 'PASS');
  assert.equal(administrative.outcome, 'RECONCILIATION_COMPLETE');
  assertGeneration(administrative.generation, 'administrative recovery');
  assertAuthoritativeBinding(administrative.authoritativeBinding, 'administrative recovery', expectedProductionTree);
  assertZeroExecutions(administrative.executionCounts, 'administrative recovery');
  assert.equal(administrative.campaignRerun, false);
  assert.equal(administrative.stages1Through8Rerun, false);
  if (Object.hasOwn(administrative, 'stages2Through8Rerun')) assert.equal(administrative.stages2Through8Rerun, false);
  assert.deepEqual(administrative.sourceG2, validation.sourceG2);
  assert.deepEqual(administrative.priorG3Failure, validation.priorG3Failure);
  assert.equal(administrative.administrativeAuthority?.priorG2FailurePreserved, true);
  assert.equal(administrative.administrativeAuthority?.priorG2FailureRewrittenAsPass, false);
  assert.equal(administrative.administrativeAuthority?.priorG3FailurePreserved, true);
  assert.equal(administrative.administrativeAuthority?.priorG3FailureRewrittenAsPass, false);
  assert.equal(administrative.administrativeAuthority?.resumesPriorAttempt, false);
  assert.equal(administrative.administrativeAuthority?.manualFallbackUsed, false);
  assert.deepEqual(administrative.rootCause?.priorG3?.classifications, validation.priorG3Failure.classification);
  assert.equal(administrative.rootCause?.priorG3?.missingField, 'git.helperCheckout.gitBlob');
  assert.deepEqual(administrative.rootCause?.priorG3?.observedFailure, validation.priorG3Failure.failure);
  assert.equal(administrative.rootCause?.priorG3?.manualFallbackUsed, false);
  assert.deepEqual(administrative.evidenceOrigin, {
    generation: 'phase3cr2-c3tb-g4',
    sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
    priorRecoveryGeneration: 'phase3cr2-c3tb-g3',
    executedInG4: 0,
    acceptedFromG2: {
      freshSelectedHistoricalControls: 89,
      reusedHistoricalControls: 462,
      candidateSpecificControls: 2,
      sourceAndSecurityReviews: 12,
    },
    administrativeReconciliationOnly: true,
  });
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
  assert.deepEqual(administrative.accounting, {
    historicalInventory: 551,
    exactPartition: true,
    fresh: 89,
    reused: 462,
    candidateSpecific: 2,
    reviews: 12,
    allFreshPass: true,
    allReusePass: true,
    allCandidateSpecificPass: true,
    allReviewsPass: true,
  });
  const authorityCitations = assertRecoveryAuthority(administrative);

  assertReconciledOutputs(fresh, reuse, candidate, reviews, expectedProductionTree);
  for (const [artifact, acceptedFromG2] of [[fresh, 89], [candidate, 2], [reviews, 12]]) {
    assert.equal(artifact.candidate, C3TB);
    assert.equal(artifact.candidateImplementation, C3T);
    assert.equal(artifact.productionTree, expectedProductionTree);
    assertGeneration(artifact.generation, `${artifact.kind} generation`);
    assert.equal(artifact.sourceExecutionGeneration, 'phase3cr2-c3tb-g2');
    assert.equal(artifact.reconciliationOnly, true);
    assertZeroExecutions(artifact.executionCounts, `${artifact.kind} executions`);
    assert.deepEqual(artifact.evidenceOrigin, {
      generation: 'phase3cr2-c3tb-g4',
      sourceExecutionGeneration: 'phase3cr2-c3tb-g2',
      executedInG4: 0,
      acceptedFromG2,
      administrativeReconciliationOnly: true,
    });
    if (Object.hasOwn(artifact, 'sourceG2')) assert.deepEqual(artifact.sourceG2, validation.sourceG2);
    if (Object.hasOwn(artifact, 'priorG3Failure')) assert.deepEqual(artifact.priorG3Failure, validation.priorG3Failure);
  }

  return {
    validation,
    plan,
    preSeal,
    administrative,
    fresh,
    reuse,
    candidate,
    reviews,
    preserved,
    priorG3Failure: validation.priorG3Failure,
    g4Tools,
    authorityCitations,
    expectedProductionTree,
  };
}

function isAllowedAcceptancePath(relative) {
  return ACCEPTANCE_ROOTS.some(root => relative === root || relative.startsWith(`${root}/`))
    || relative === G4_REPORT;
}

function statusEntries() {
  const raw = runGit(['status', '--porcelain=v1', '-z', '--untracked-files=all']).toString('utf8');
  const tokens = raw.split('\0').filter(Boolean);
  const entries = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const status = token.slice(0, 2);
    const relative = slash(token.slice(3));
    entries.push({ status, path: relative });
    if (status.includes('R') || status.includes('C')) index += 1;
  }
  return entries;
}

function exactAcceptancePaths() {
  assertExactG4EvidenceInventory(G4_FINAL_EVIDENCE_FILES, 'acceptance path union');
  const paths = ACCEPTANCE_ROOTS.flatMap(relative => walkFiles(relative).map(record => record.path));
  if (fs.existsSync(absolute(G4_REPORT))) paths.push(G4_REPORT);
  paths.sort(fileOrder);
  assert.equal(new Set(paths).size, paths.length, 'Acceptance path union contains duplicates');
  return paths;
}

function assertAllowedPreWriteState() {
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);
  assert.equal(gitText(['diff', '--name-only']), '', 'Tracked unstaged changes are forbidden');
  assert.equal(gitText(['diff', '--cached', '--name-only']), '', 'Staged changes are forbidden before finalization');
  const entries = statusEntries();
  assert.ok(entries.length > 0, 'Expected preserved untracked Phase 3CR2 artifacts');
  const expectedPaths = ACCEPTANCE_ROOTS
    .flatMap(relative => walkFiles(relative).map(record => record.path));
  if (fs.existsSync(absolute(G4_REPORT))) expectedPaths.push(G4_REPORT);
  expectedPaths.sort(fileOrder);
  assert.equal(new Set(expectedPaths).size, expectedPaths.length, 'Pre-write acceptance path union contains duplicates');
  assert.deepEqual(entries.map(entry => entry.path).sort(fileOrder), expectedPaths, 'Exact pre-write Phase 3CR2 path union');
  for (const entry of entries) {
    assert.equal(entry.status, '??', `Only untracked append-only files are permitted before finalization: ${entry.path}`);
    assert.equal(isAllowedAcceptancePath(entry.path), true, `Out-of-scope untracked path: ${entry.path}`);
    assert.equal(entry.path === PRODUCT || entry.path.startsWith(`${PRODUCT}/`), false, `Product path present in status: ${entry.path}`);
  }
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
  };
}

function buildReceipt(inputs, finalizedAt) {
  return {
    kind: 'MO1307Phase3CR2C3TBG4CertificationReceipt',
    version: '1.0.0',
    finalizedAt,
    result: 'PASS',
    phase3CR2: 'ACCEPTED',
    status: 'PHASE3CR2_ACCEPTED',
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    priorG3Failure: inputs.priorG3Failure,
    preservedG2: {
      result: 'FAILED_INCOMPLETE',
      outcome: 'PHASE3CR2_FAILED_INCOMPLETE',
      failureStage: 'CASE_SENSITIVE_RECONCILIATION',
      failureOrdinal: 9,
      ledger: pin(G2_LEDGER),
      tools: inputs.validation.sourceG2.tools,
      evidence: inputs.validation.sourceG2.evidence,
      immutable: true,
      modified: false,
      resumed: false,
    },
    preservedG3: {
      result: 'PHASE3CR2_RECONCILIATION_BLOCKER',
      outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
      classification: inputs.priorG3Failure.classification,
      failure: inputs.priorG3Failure.failure,
      cause: inputs.priorG3Failure.cause,
      tools: inputs.priorG3Failure.tools,
      evidence: inputs.priorG3Failure.evidence,
      artifacts: inputs.priorG3Failure.artifacts,
      absentReconciliationOutputs: inputs.priorG3Failure.absentReconciliationOutputs,
      immutable: true,
      modified: false,
      resumed: false,
    },
    administrativeRecovery: {
      result: 'PASS',
      outcome: 'RECONCILIATION_COMPLETE',
      artifact: pin(ADMINISTRATIVE_RECOVERY),
      authorityCitations: inputs.authorityCitations,
      campaignRerun: false,
      stages1Through8Rerun: false,
      stages2Through8Rerun: false,
      priorG3FailurePreserved: true,
    },
    controls: {
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
    },
    executionCounts: ZERO_EXECUTIONS,
    campaignRerun: false,
    stages1Through8Rerun: false,
    stages2Through8Rerun: false,
    inputs: {
      zeroExecutionValidation: pin(VALIDATION),
      recoveryPlan: pin(PLAN),
      preExecutionSeal: pin(PRE_SEAL),
      administrativeRecovery: pin(ADMINISTRATIVE_RECOVERY),
      freshControlResults: pin(FRESH),
      dependencyReuse: pin(G2_REUSE),
      candidateSpecificControls: pin(CANDIDATE_CONTROLS),
      sourceSecurityReviews: pin(REVIEWS),
      priorG3Failure: inputs.priorG3Failure.artifacts,
    },
    containingCommit: finalCommitRule('SUPPLIED_AND_VERIFIED_AFTER_APPEND_ONLY_CREATION', inputs.expectedProductionTree),
    phase3D: {
      executed: false,
      handoff: HANDOFF,
      authorizationGranted: false,
    },
    prohibitions: { productChanges: false, push: false, tag: false, phase3AR2: false, phase3D: false, network: false },
  };
}

function buildFinalValidation(inputs, receiptRecord, finalizedAt) {
  return {
    kind: 'MO1307Phase3CR2C3TBG4FinalValidation',
    version: '1.0.0',
    finalizedAt,
    result: 'PASS_ACCEPTANCE_SUPPORTED',
    outcome: 'PHASE3CR2_ACCEPTED',
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    priorG3Failure: inputs.priorG3Failure,
    receipt: receiptRecord,
    executionCounts: ZERO_EXECUTIONS,
    checks: {
      exactNullProductionTreeCause: {
        classifications: ['WRONG_SOURCE_OBJECT', 'OTHER_CONCRETE_RECONCILIATION_DEFECT'],
        details: 'G2 reconciliation selected candidate.json.productionTree, an explicit-null prebinding placeholder excluded from authority, through a stale discriminator instead of deriving the tree from the sealed binding authorities.',
      },
      exactG3ReconciliationCause: {
        classifications: inputs.priorG3Failure.classification,
        missingField: inputs.priorG3Failure.cause.missingField,
        failure: inputs.priorG3Failure.failure,
        correction: 'PROPAGATE_CHECKOUT_HELPER_GIT_BLOB_FROM_FIXED_GIT_PIN_INTO_AUTHORITATIVE_BINDING_DERIVATION',
        manualFallbackUsed: false,
      },
      correctedBindingSource: 'SEALED_AUTHORITATIVE_BINDING_CONSENSUS',
      zeroExecutionValidation: { result: 'PASS', cases: 6, artifact: pin(VALIDATION) },
      administrativeRecoveryAuthority: { result: 'PASS', citations: inputs.authorityCitations },
      preservedG2: { result: 'FAILED_INCOMPLETE', outcome: 'PHASE3CR2_FAILED_INCOMPLETE', failureStage: 'CASE_SENSITIVE_RECONCILIATION' },
      preservedG3: {
        result: 'PHASE3CR2_RECONCILIATION_BLOCKER',
        outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
        classification: inputs.priorG3Failure.classification,
        failure: inputs.priorG3Failure.failure,
        immutable: true,
      },
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
      stages2Through8Rerun: false,
      productChanged: false,
      phase3DExecuted: false,
    },
    containingCommit: finalCommitRule('SUPPLIED_AND_VERIFIED_AFTER_APPEND_ONLY_CREATION', inputs.expectedProductionTree),
  };
}

function buildHandoff(inputs, receiptRecord, finalValidationRecord, finalizedAt) {
  return {
    kind: 'MO1307Phase3CR2C3TBG4Phase3DHandoff',
    version: '1.0.0',
    finalizedAt,
    result: 'READY_NOT_EXECUTED',
    phase3CR2: 'ACCEPTED',
    phase3DExecuted: false,
    phase3DExecutionAuthorized: false,
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    priorG3Failure: inputs.priorG3Failure,
    preservedG2: { outcome: 'PHASE3CR2_FAILED_INCOMPLETE', immutable: true, ledger: pin(G2_LEDGER) },
    preservedG3: {
      outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
      immutable: true,
      tools: inputs.priorG3Failure.tools,
      evidence: inputs.priorG3Failure.evidence,
      failure: inputs.priorG3Failure.failure,
    },
    administrativeRecovery: pin(ADMINISTRATIVE_RECOVERY),
    administrativeAuthorityCitations: inputs.authorityCitations,
    receipt: receiptRecord,
    finalValidation: finalValidationRecord,
    controls: {
      freshExecutedInG4: 0,
      freshAcceptedFromG2: 89,
      reusedExactAcceptedFromG2: 462,
      candidateSpecificAcceptedFromG2: 2,
      unresolved: 0,
      omissions: 0,
      duplicateIds: 0,
      mismatches: 0,
    },
    executionCounts: ZERO_EXECUTIONS,
    containingCommit: finalCommitRule('SUPPLIED_AND_VERIFIED_AFTER_APPEND_ONLY_CREATION', inputs.expectedProductionTree),
    consumeRule: 'Consume only after --verify-committed proves a clean single-parent acceptance commit over exact C3TB with the exact A-only Phase 3CR2 path union and unchanged production tree. This handoff does not execute or authorize Phase 3D.',
  };
}

function bufferFor(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function writeFinal() {
  const expectedProductionTree = assertCommonAnchors();
  assertAllowedPreWriteState();
  for (const relative of FINAL_OUTPUTS) assert.equal(fs.existsSync(absolute(relative)), false, `Refusing overwrite: ${relative}`);
  assertExactG4EvidenceInventory(G4_RECONCILED_INPUTS, 'pre-finalization');
  const inputs = loadInputs(expectedProductionTree, G4_RECONCILED_INPUTS);
  const finalizedAt = new Date().toISOString();

  const receipt = buildReceipt(inputs, finalizedAt);
  const receiptBytes = bufferFor(receipt);
  const receiptRecord = recordFromBytes(RECEIPT, receiptBytes, false);
  const finalValidation = buildFinalValidation(inputs, receiptRecord, finalizedAt);
  const finalValidationBytes = bufferFor(finalValidation);
  const finalValidationRecord = recordFromBytes(FINAL_VALIDATION, finalValidationBytes, false);
  const handoff = buildHandoff(inputs, receiptRecord, finalValidationRecord, finalizedAt);
  const handoffBytes = bufferFor(handoff);

  const existingMembers = [
    ...walkFiles(G4_TOOL),
    ...walkFiles(G4_EVIDENCE),
    ...(fs.existsSync(absolute(G4_REPORT)) ? [fileRecord(G4_REPORT)] : []),
  ];
  const members = [
    ...existingMembers,
    recordFromBytes(RECEIPT, receiptBytes),
    recordFromBytes(FINAL_VALIDATION, finalValidationBytes),
    recordFromBytes(HANDOFF, handoffBytes),
  ].sort((a, b) => fileOrder(a.path, b.path));
  assert.equal(new Set(members.map(record => record.path)).size, members.length, 'G4 manifest duplicate member');

  const manifest = {
    kind: 'MO1307Phase3CR2C3TBG4EvidenceManifest',
    version: '1.0.0',
    finalizedAt,
    result: 'PASS',
    phase3CR2: 'ACCEPTED',
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    priorG3Failure: inputs.priorG3Failure,
    memberCount: members.length,
    members,
    excludes: [MANIFEST, FINAL_SEAL],
    preservedG2: {
      promotedToG4Members: false,
      tools: inputs.validation.sourceG2.tools,
      evidence: inputs.validation.sourceG2.evidence,
      ledger: pin(G2_LEDGER),
      outcome: 'PHASE3CR2_FAILED_INCOMPLETE',
    },
    preservedG3: {
      promotedToG4Members: false,
      tools: inputs.priorG3Failure.tools,
      evidence: inputs.priorG3Failure.evidence,
      outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
      failure: inputs.priorG3Failure.failure,
    },
    executionCounts: ZERO_EXECUTIONS,
    phase3DExecuted: false,
  };
  const manifestBytes = bufferFor(manifest);
  const finalSeal = {
    kind: 'MO1307Phase3CR2C3TBG4FinalSeal',
    version: '1.0.0',
    finalizedAt,
    result: 'PASS',
    phase3CR2: 'ACCEPTED',
    generation: GENERATION,
    authoritativeBinding: inputs.validation.authoritativeBinding,
    priorG3Failure: inputs.priorG3Failure,
    manifest: recordFromBytes(MANIFEST, manifestBytes, false),
    receipt: receiptRecord,
    finalValidation: finalValidationRecord,
    phase3DHandoff: recordFromBytes(HANDOFF, handoffBytes, false),
    zeroExecutionValidation: pin(VALIDATION),
    recoveryPlan: pin(PLAN),
    preExecutionSeal: pin(PRE_SEAL),
    administrativeRecovery: pin(ADMINISTRATIVE_RECOVERY),
    immutableG2: { tools: inputs.validation.sourceG2.tools, evidence: inputs.validation.sourceG2.evidence, ledger: pin(G2_LEDGER) },
    immutableG3: {
      tools: inputs.priorG3Failure.tools,
      evidence: inputs.priorG3Failure.evidence,
      artifacts: inputs.priorG3Failure.artifacts,
      outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
      failure: inputs.priorG3Failure.failure,
    },
    authorityCitations: inputs.authorityCitations,
    executionCounts: ZERO_EXECUTIONS,
    containingCommit: finalCommitRule('SUPPLIED_AND_VERIFIED_AFTER_APPEND_ONLY_CREATION', inputs.expectedProductionTree),
    phase3DExecuted: false,
    push: false,
    tag: false,
  };
  const finalSealBytes = bufferFor(finalSeal);

  const writes = [
    [RECEIPT, receiptBytes],
    [FINAL_VALIDATION, finalValidationBytes],
    [HANDOFF, handoffBytes],
    [MANIFEST, manifestBytes],
    [FINAL_SEAL, finalSealBytes],
  ];
  for (const [relative] of writes) assert.equal(fs.existsSync(absolute(relative)), false, `Append-only pre-write check: ${relative}`);
  for (const [relative, bytes] of writes) fs.writeFileSync(absolute(relative), bytes, { flag: 'wx', mode: 0o644 });
  assertExactG4EvidenceInventory(G4_FINAL_EVIDENCE_FILES, 'post-finalization');

  process.stdout.write(`${canonical({
    mode: '--write',
    result: 'PASS_FINAL_ARTIFACTS_WRITTEN',
    outcome: 'PHASE3CR2_ACCEPTED_PENDING_CONTAINING_COMMIT',
    freshExecutedInG4: 0,
    freshAcceptedFromG2: 89,
    reusedExactAcceptedFromG2: 462,
    candidateSpecificAcceptedFromG2: 2,
    outputs: FINAL_OUTPUTS,
    next: 'Stage the exact acceptance path union, run --verify-staged, create one single-parent commit over C3TB, then run --verify-committed. Do not push, tag, or execute Phase 3D.',
  })}\n`);
}

function loadFinalArtifacts(expectedProductionTree) {
  assertExactG4EvidenceInventory(G4_FINAL_EVIDENCE_FILES, 'final artifacts');
  const inputs = loadInputs(expectedProductionTree, G4_FINAL_EVIDENCE_FILES);
  const receipt = readJson(RECEIPT);
  const finalValidation = readJson(FINAL_VALIDATION);
  const handoff = readJson(HANDOFF);
  const manifest = readJson(MANIFEST);
  const finalSeal = readJson(FINAL_SEAL);

  assert.equal(receipt.kind, 'MO1307Phase3CR2C3TBG4CertificationReceipt');
  assert.equal(receipt.result, 'PASS');
  assert.equal(receipt.status, 'PHASE3CR2_ACCEPTED');
  assert.equal(receipt.phase3CR2, 'ACCEPTED');
  assertGeneration(receipt.generation, 'receipt');
  assertAuthoritativeBinding(receipt.authoritativeBinding, 'receipt', expectedProductionTree);
  assertZeroExecutions(receipt.executionCounts, 'receipt');
  assert.equal(receipt.campaignRerun, false);
  assert.equal(receipt.stages1Through8Rerun, false);
  assert.equal(receipt.stages2Through8Rerun, false);
  assert.deepEqual(receipt.controls, {
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
  assert.equal(receipt.preservedG2.outcome, 'PHASE3CR2_FAILED_INCOMPLETE');
  assert.equal(receipt.preservedG2.immutable, true);
  assert.equal(receipt.preservedG2.modified, false);
  assert.equal(receipt.preservedG3.outcome, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(receipt.preservedG3.immutable, true);
  assert.equal(receipt.preservedG3.modified, false);
  assert.deepEqual(receipt.preservedG3.tools, inputs.priorG3Failure.tools);
  assert.deepEqual(receipt.preservedG3.evidence, inputs.priorG3Failure.evidence);
  assert.deepEqual(receipt.preservedG3.failure, inputs.priorG3Failure.failure);
  assert.equal(receipt.phase3D.executed, false);
  assert.deepEqual(receipt.containingCommit, finalCommitRule('SUPPLIED_AND_VERIFIED_AFTER_APPEND_ONLY_CREATION', expectedProductionTree));

  assert.equal(finalValidation.kind, 'MO1307Phase3CR2C3TBG4FinalValidation');
  assert.equal(finalValidation.result, 'PASS_ACCEPTANCE_SUPPORTED');
  assert.equal(finalValidation.outcome, 'PHASE3CR2_ACCEPTED');
  assertGeneration(finalValidation.generation, 'final validation');
  assertZeroExecutions(finalValidation.executionCounts, 'final validation');
  assert.equal(finalValidation.checks.fresh.actual, 89);
  assert.equal(finalValidation.checks.reuse.actual, 462);
  assert.equal(finalValidation.checks.candidateSpecific.actual, 2);
  assert.equal(finalValidation.checks.reviews.actual, 12);
  assert.equal(finalValidation.checks.unresolved, 0);
  assert.equal(finalValidation.checks.omissions, 0);
  assert.equal(finalValidation.checks.duplicateIds, 0);
  assert.equal(finalValidation.checks.overlaps, 0);
  assert.equal(finalValidation.checks.mismatches, 0);
  assert.deepEqual(finalValidation.checks.exactG3ReconciliationCause.classifications, inputs.priorG3Failure.classification);
  assert.equal(finalValidation.checks.exactG3ReconciliationCause.missingField, 'git.helperCheckout.gitBlob');
  assert.deepEqual(finalValidation.checks.exactG3ReconciliationCause.failure, inputs.priorG3Failure.failure);
  assert.equal(finalValidation.checks.exactG3ReconciliationCause.manualFallbackUsed, false);
  assert.equal(finalValidation.checks.preservedG3.outcome, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(finalValidation.checks.preservedG3.immutable, true);
  assert.deepEqual(finalValidation.checks.preservedG3.failure, inputs.priorG3Failure.failure);
  assert.equal(finalValidation.checks.phase3DExecuted, false);

  assert.equal(handoff.kind, 'MO1307Phase3CR2C3TBG4Phase3DHandoff');
  assert.equal(handoff.result, 'READY_NOT_EXECUTED');
  assert.equal(handoff.phase3CR2, 'ACCEPTED');
  assert.equal(handoff.phase3DExecuted, false);
  assert.equal(handoff.phase3DExecutionAuthorized, false);
  assertGeneration(handoff.generation, 'Phase 3D handoff');
  assertZeroExecutions(handoff.executionCounts, 'Phase 3D handoff');
  assert.equal(handoff.controls.freshExecutedInG4, 0);
  assert.equal(handoff.controls.freshAcceptedFromG2, 89);
  assert.equal(handoff.controls.reusedExactAcceptedFromG2, 462);
  assert.equal(handoff.controls.candidateSpecificAcceptedFromG2, 2);
  assert.equal(handoff.preservedG3.outcome, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.equal(handoff.preservedG3.immutable, true);
  assert.deepEqual(handoff.preservedG3.failure, inputs.priorG3Failure.failure);

  assert.equal(manifest.kind, 'MO1307Phase3CR2C3TBG4EvidenceManifest');
  assert.equal(manifest.result, 'PASS');
  assertGeneration(manifest.generation, 'manifest');
  assertZeroExecutions(manifest.executionCounts, 'manifest');
  assert.deepEqual(manifest.excludes, [MANIFEST, FINAL_SEAL]);
  const actualMembers = [
    ...walkFiles(G4_TOOL),
    ...walkFiles(G4_EVIDENCE).filter(record => ![MANIFEST, FINAL_SEAL].includes(record.path)),
    ...(fs.existsSync(absolute(G4_REPORT)) ? [fileRecord(G4_REPORT)] : []),
  ].sort((a, b) => fileOrder(a.path, b.path));
  assert.deepEqual(manifest.members, actualMembers, 'G4 accepted manifest members');
  assert.equal(manifest.memberCount, actualMembers.length);
  assert.equal(manifest.preservedG2.promotedToG4Members, false);
  assert.equal(manifest.preservedG3.promotedToG4Members, false);
  assert.equal(manifest.preservedG3.outcome, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.deepEqual(manifest.preservedG3.tools, inputs.priorG3Failure.tools);
  assert.deepEqual(manifest.preservedG3.evidence, inputs.priorG3Failure.evidence);
  for (const record of manifest.members) assert.deepEqual(fileRecord(record.path), record, `Manifest member changed: ${record.path}`);

  assert.equal(finalSeal.kind, 'MO1307Phase3CR2C3TBG4FinalSeal');
  assert.equal(finalSeal.result, 'PASS');
  assert.equal(finalSeal.phase3CR2, 'ACCEPTED');
  assertGeneration(finalSeal.generation, 'final seal');
  assertZeroExecutions(finalSeal.executionCounts, 'final seal');
  assert.equal(finalSeal.phase3DExecuted, false);
  assert.equal(finalSeal.push, false);
  assert.equal(finalSeal.tag, false);
  assert.equal(finalSeal.immutableG3.outcome, 'PHASE3CR2_RECONCILIATION_BLOCKER');
  assert.deepEqual(finalSeal.immutableG3.tools, inputs.priorG3Failure.tools);
  assert.deepEqual(finalSeal.immutableG3.evidence, inputs.priorG3Failure.evidence);
  for (const record of [
    finalSeal.manifest,
    finalSeal.receipt,
    finalSeal.finalValidation,
    finalSeal.phase3DHandoff,
    finalSeal.zeroExecutionValidation,
    finalSeal.recoveryPlan,
    finalSeal.preExecutionSeal,
    finalSeal.administrativeRecovery,
  ]) assertPin(record);

  for (const artifact of [receipt, finalValidation, handoff, manifest, finalSeal]) {
    assert.deepEqual(artifact.generation, GENERATION);
    assertAuthoritativeBinding(artifact.authoritativeBinding, artifact.kind, expectedProductionTree);
    assert.deepEqual(artifact.priorG3Failure, inputs.priorG3Failure, `${artifact.kind}: exact failed G3 record`);
  }
  const expectedPaths = exactAcceptancePaths();
  return { inputs, receipt, finalValidation, handoff, manifest, finalSeal, expectedPaths };
}

function assertStagedBlob(relative) {
  const line = gitText(['ls-files', '--stage', '--', relative]);
  const match = /^100644 ([0-9a-f]{40}) 0\t/u.exec(line);
  assert.ok(match, `Not staged as a regular file: ${relative}`);
  assert.equal(match[1], gitBlob(regularBytes(relative)), `Staged bytes differ: ${relative}`);
}

function verifyStaged() {
  const expectedProductionTree = assertCommonAnchors();
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);
  const artifacts = loadFinalArtifacts(expectedProductionTree);
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
  runGit(['diff', '--cached', '--check']);
  process.stdout.write(`${canonical({
    mode: '--verify-staged',
    result: 'PASS_STAGED_ACCEPTANCE',
    files: artifacts.expectedPaths.length,
    parent: C3TB,
    productionChanged: false,
    next: 'Create one single-parent acceptance commit without amendment, then run --verify-committed. Do not push or tag.',
  })}\n`);
}

function verifyCommitted() {
  const expectedProductionTree = assertCommonAnchors();
  const artifacts = loadFinalArtifacts(expectedProductionTree);
  const head = gitText(['rev-parse', 'HEAD']);
  assert.notEqual(head, C3TB, 'Acceptance commit is missing');
  assert.equal(gitText(['show', '-s', '--format=%P', head]), C3TB, 'Acceptance commit parent');
  assert.equal(gitText(['rev-list', '--parents', '-n', '1', head]).split(' ').length, 2, 'Acceptance commit must have exactly one parent');
  const changed = runGit(['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', C3TB, head])
    .toString('utf8').split('\0').filter(Boolean).map(slash).sort(fileOrder);
  assert.deepEqual(changed, artifacts.expectedPaths, 'Exact committed Phase 3CR2 path union');
  const nameStatus = runGit(['diff-tree', '--no-commit-id', '--name-status', '-r', '-z', C3TB, head])
    .toString('utf8').split('\0').filter(Boolean);
  assert.equal(nameStatus.length, artifacts.expectedPaths.length * 2, 'Committed name-status arity');
  for (let index = 0; index < nameStatus.length; index += 2) {
    assert.equal(nameStatus[index], 'A', `Committed path is not A-only: ${nameStatus[index + 1]}`);
  }
  assert.equal(gitText(['rev-parse', `${head}:${PRODUCT}`]), expectedProductionTree);
  assert.equal(gitText(['diff', '--name-only', C3TB, head, '--', PRODUCT]), '');
  for (const relative of artifacts.expectedPaths) {
    assert.equal(gitText(['rev-parse', `${head}:${relative}`]), gitBlob(regularBytes(relative)), `Committed bytes differ: ${relative}`);
  }
  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all']), '', 'Repository must be clean');
  runGit(['show', '--format=', '--check', head]);
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
    freshExecutedInG4: 0,
    freshAcceptedFromG2: 89,
    reusedExactAcceptedFromG2: 462,
    candidateSpecificAcceptedFromG2: 2,
    preservedG2Outcome: 'PHASE3CR2_FAILED_INCOMPLETE',
    preservedG3Outcome: 'PHASE3CR2_RECONCILIATION_BLOCKER',
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
