// Append-only preflight and pre-execution seal for exact MO-1307 C3TB Phase 3CR2.
// This tool performs Git/hash/static checks only. It does not execute product controls.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const branch = 'codex/mo1307-phase3cr2-c3tb';
const C3TB = '119e68bdcf0ffc906b4ca03a912aadcb25908346';
const C3TB_TREE = '5e0088965d4eac4002165fe0190f275c257985ba';
const C3T = '65e24b2debdd70ecb8e52fbccbd6c101621f1917';
const C3T_TREE = 'd21f46bc31ccd7a9f80a5e494b3d09116d125522';
const C3T_PARENT = '79ef47e608c67edc70f3e9f51d494b169794f903';
const PRODUCTION_TREE = '324bf600b6cbfaa8564db27fce2d999711270cb8';
const C3RB = 'defe93989efc6501b1a730b82e79e705884b269b';
const C3RB_TREE = '54c8ca8acc388d8dcb5d8d76e119b434dcc1a9bb';
const HISTORICAL_PHASE3C = 'b02fc0226a1a2d800185a02071674ca80bdf4a1d';
const HISTORICAL_PHASE3C_TREE = 'd95be491e59e409c628eac8d990ddcbd1cc3ed34';
const HISTORICAL_EVIDENCE_TREE = '17bab55dfaf49e5554cfb751975b5391299cb857';
const HISTORICAL_TOOLS_TREE = '92d84d66a9bf54d5fb85e1ceb2f0ab104beed2b1';
const HISTORICAL_REPORT_BLOB = '140f47d0a1d786ca0e11cefc201e25b7f94f5e62';
const EXPECTED_NODE_VERSION = 'v24.21.0';
const EXPECTED_NODE_SHA256 = 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
const HELPER_SHA256 = 'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127';

const productRelative = 'repositories/memoryos-readiness';
const helperRelative = `${productRelative}/helpers/windows-inspect.ps1`;
const candidateEvidenceRelative = 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate';
const mapRelative = `${candidateEvidenceRelative}/phase3c-refresh-map.json`;
const bindingRelative = `${candidateEvidenceRelative}/binding.json`;
const bindingVerificationRelative = `${candidateEvidenceRelative}/binding-verification.json`;
const bindingToolRelative = 'repositories/cca-conformance/tools/mo1307-prospective-helper-bound-candidate/binding.mjs';
const phase1ToolRelative = 'repositories/cca-conformance/tools/mo1307-phase1';
const toolRelative = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb';
const evidenceRelative = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb';
const toolRoot = path.join(root, toolRelative);
const evidenceRoot = path.join(root, evidenceRelative);
const planRelative = `${evidenceRelative}/campaign-plan.json`;
const sealRelative = `${evidenceRelative}/pre-execution-seal.json`;
const failedPreflightRelative = `${evidenceRelative}/failed-preflight-attempt-1.json`;

const historicalEvidenceRelative = 'repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3';
const historicalToolsRelative = 'repositories/cca-conformance/tools/mo1307-phase3c-c3rb-cert3';
const historicalReportRelative = 'docs/mo1307-phase3c-c3rb-cert3.md';
const historicalReceiptRelative = `${historicalEvidenceRelative}/certification-receipt.json`;
const historicalControlMapRelative = `${historicalEvidenceRelative}/current-control-map.json`;
const historicalControlResultsRelative = `${historicalEvidenceRelative}/current-control-results.json`;
const historicalHandoffRelative = `${historicalEvidenceRelative}/phase3d-handoff.json`;
const historicalFinalSealRelative = `${historicalEvidenceRelative}/final-seal.json`;
const historicalManifestRelative = `${historicalEvidenceRelative}/evidence-manifest.json`;

const expectedBindingPaths = [bindingRelative, bindingVerificationRelative].sort();
const expectedSupplementalControls = [
  'candidate:prospective-bound-generated-contract-consistency',
  'candidate:prospective-bound-package-and-binding-identity',
];
const expectedHeadlessCases = [...'ABCDEFGHIJKLMNOPQRS'];
const expectedReviews = [
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
];
const expectedLimits = Object.freeze({
  aggregateHelperActiveMs: 20000,
  apiMs: 10000,
  cleanupMs: 2000,
  cliAdmissionMs: 30000,
  helperMs: 8000,
  workerMs: 10000,
});

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

const bytes = value => Buffer.from(`${canonical(value)}\n`);
const sha256 = data => `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
const slash = value => value.replaceAll('\\', '/');
const textOf = value => Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? '');

function run(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    input: options.input,
    encoding: options.encoding,
    windowsHide: true,
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(
    result.status,
    0,
    `${file} ${args.join(' ')} failed (${result.status}): ${textOf(result.stderr)}`,
  );
  return result;
}

const gitResult = (args, options = {}) => run('git', ['-c', 'core.longpaths=true', '-c', `safe.directory=${slash(path.resolve(root))}`, ...args], options);
const gitBytes = (args, options = {}) => gitResult(args, options).stdout;
const gitText = (args, options = {}) => textOf(gitBytes(args, { ...options, encoding: 'utf8' })).trim();
const gitShow = (commit, relative) => gitBytes(['show', `${commit}:${relative}`]);
const gitJson = (commit, relative) => JSON.parse(gitShow(commit, relative).toString('utf8'));

function gitRecord(commit, relative) {
  const data = gitShow(commit, relative);
  const gitBlob = gitText(['rev-parse', `${commit}:${relative}`]);
  assert.equal(gitText(['hash-object', '--stdin'], { input: data }), gitBlob);
  return { path: relative, byteLength: data.length, sha256: sha256(data), gitBlob };
}

function fileRecord(absolute) {
  const relative = slash(path.relative(root, absolute));
  assert.ok(relative && relative !== '..' && !relative.startsWith('../'), absolute);
  const stat = fs.lstatSync(absolute);
  assert.equal(stat.isSymbolicLink(), false, `Tool input is a symlink: ${relative}`);
  assert.equal(stat.isFile(), true, `Tool input is not a regular file: ${relative}`);
  const data = fs.readFileSync(absolute);
  const gitBlob = gitText(['hash-object', '--stdin'], { input: data });
  return { path: relative, byteLength: data.length, sha256: sha256(data), gitBlob };
}

function walkFiles(directory) {
  const result = [];
  const walk = current => {
    const directoryStat = fs.lstatSync(current);
    assert.equal(directoryStat.isSymbolicLink(), false, `Tool directory is a symlink: ${current}`);
    assert.equal(directoryStat.isDirectory(), true, `Expected tool directory: ${current}`);
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const absolute = path.join(current, entry.name);
      assert.equal(entry.isSymbolicLink(), false, `Tool input is a symlink: ${absolute}`);
      if (entry.isDirectory()) walk(absolute);
      else {
        assert.equal(entry.isFile(), true, `Tool input is not a regular file: ${absolute}`);
        result.push(absolute);
      }
    }
  };
  walk(directory);
  return result.sort((a, b) => slash(a).localeCompare(slash(b), 'en')).map(fileRecord);
}

function listGitNames(commit, relative) {
  return gitText(['ls-tree', '-r', '--name-only', commit, '--', relative])
    .split(/\r?\n/u)
    .filter(Boolean);
}

function changedNames(commit) {
  return gitText(['diff-tree', '--no-commit-id', '--name-only', '-r', commit])
    .split(/\r?\n/u)
    .filter(Boolean)
    .sort();
}

function assertAllowedWorktreeState(evidenceState) {
  const raw = gitBytes(['status', '--porcelain=v1', '-z', '--untracked-files=all']).toString('utf8');
  const entries = raw.split('\0').filter(Boolean);
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const status = entry.slice(0, 2);
    assert.equal(/[RC]/u.test(status), false, `Rename/copy is not permitted before preflight: ${entry}`);
    const relative = slash(entry.slice(3));
    const allowedTool = relative === toolRelative || relative.startsWith(`${toolRelative}/`);
    const allowedPlaceholder = evidenceState.placeholder !== null && relative === evidenceState.placeholder.path;
    const allowedFailedPreflight = evidenceState.priorFailedPreflight !== null && relative === evidenceState.priorFailedPreflight.path;
    assert.ok(allowedTool || allowedPlaceholder || allowedFailedPreflight, `Unexpected dirty path before preflight: ${relative}`);
  }
  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all', '--', productRelative]), '');
}

function inspectEvidenceNamespace() {
  assert.equal(fs.existsSync(evidenceRoot), true, 'Failed preflight history is required before corrected preflight.');
  const rootStat = fs.lstatSync(evidenceRoot);
  assert.equal(rootStat.isSymbolicLink(), false, 'Evidence directory must not be a symlink.');
  assert.equal(rootStat.isDirectory(), true, 'Evidence namespace is not a directory.');
  const entries = fs.readdirSync(evidenceRoot, { withFileTypes: true });
  assert.equal(entries.length, 1, 'Evidence namespace must contain only the failed preflight history before corrected preflight.');
  const entry = entries[0];
  assert.equal(entry.name, path.basename(failedPreflightRelative), `Unexpected preflight evidence: ${entry.name}`);
  assert.equal(entry.isSymbolicLink(), false, 'Failed preflight history must not be a symlink.');
  assert.equal(entry.isFile(), true, 'Failed preflight history must be a regular file.');
  const absolute = path.join(evidenceRoot, entry.name);
  return { existed: true, placeholder: null, priorFailedPreflight: fileRecord(absolute) };
}

function countBySuite(rows) {
  const result = Object.create(null);
  for (const row of rows) {
    const current = result[row.suite] ?? { controls: 0, rejections: 0, behavioral: 0 };
    current.controls += 1;
    if (row.negative) current.rejections += 1;
    else current.behavioral += 1;
    result[row.suite] = current;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b, 'en')));
}

function assertExactRecord(record, expected) {
  for (const [key, value] of Object.entries(expected)) assert.equal(record[key], value, `${record.path} ${key}`);
}

// binding.mjs deliberately requires a clean checkout. Materialize the exact HEAD paths
// it consumes under a temporary alternate index so new, append-only campaign tools do
// not weaken or bypass that official check.
function runOfficialBindingCheck() {
  const cacheRoot = path.join(root, '.cache');
  assert.equal(fs.statSync(cacheRoot).isDirectory(), true);
  const scratch = fs.mkdtempSync(path.join(cacheRoot, 'mo1307-3cr2-binding-'));
  const shadowRoot = path.join(scratch, 'worktree');
  const shadowIndex = path.join(scratch, 'index');
  fs.mkdirSync(shadowRoot);
  const gitDir = gitText(['rev-parse', '--absolute-git-dir']);
  const shadowEnv = {
    ...process.env,
    GIT_DIR: gitDir,
    GIT_WORK_TREE: shadowRoot,
    GIT_INDEX_FILE: shadowIndex,
  };
  const shadowGit = (args, input = undefined) => gitBytes(args, { cwd: shadowRoot, env: shadowEnv, input });
  try {
    shadowGit(['read-tree', C3TB]);
    const allPaths = shadowGit(['ls-files', '-z']);
    assert.ok(allPaths.length > 0);
    shadowGit(['update-index', '--skip-worktree', '-z', '--stdin'], allPaths);
    const selectedPaths = gitBytes([
      'ls-tree', '-r', '--name-only', '-z', C3TB, '--',
      productRelative,
      candidateEvidenceRelative,
      'repositories/cca-conformance/tools/mo1307-prospective-helper-bound-candidate',
      phase1ToolRelative,
    ]);
    assert.ok(selectedPaths.length > 0);
    shadowGit(['update-index', '--no-skip-worktree', '-z', '--stdin'], selectedPaths);
    shadowGit(['checkout-index', '--force', '-z', '--stdin'], selectedPaths);
    const shadowBindingTool = path.join(shadowRoot, bindingToolRelative);
    assert.equal(fs.existsSync(shadowBindingTool), true);
    const result = run(process.execPath, [shadowBindingTool, 'check'], {
      cwd: shadowRoot,
      env: shadowEnv,
      encoding: 'utf8',
    });
    const stdout = Buffer.from(result.stdout, 'utf8');
    const stderr = Buffer.from(result.stderr, 'utf8');
    assert.equal(stderr.length, 0, stderr.toString('utf8'));
    const parsed = JSON.parse(stdout.toString('utf8'));
    assert.equal(parsed.result, 'PASS');
    assert.equal(parsed.mode, 'check');
    assert.equal(parsed.candidateCommit, C3T);
    assert.equal(parsed.candidateRootTree, C3T_TREE);
    assert.equal(parsed.productionTree, PRODUCTION_TREE);
    assert.equal(parsed.packageMembers, 89);
    assert.equal(parsed.productionChangesInBindingCommit, false);
    return {
      result: 'PASS',
      tool: gitRecord(C3TB, bindingToolRelative),
      dependencies: [gitRecord(C3TB, `${phase1ToolRelative}/package.mjs`)],
      runtime: {
        version: process.version,
        executable: process.execPath,
        byteLength: fs.statSync(process.execPath).size,
        sha256: sha256(fs.readFileSync(process.execPath)),
      },
      checkout: 'TEMPORARY_ALTERNATE_INDEX_EXACT_HEAD',
      stdout: { byteLength: stdout.length, sha256: sha256(stdout), parsed },
      stderr: { byteLength: 0, sha256: sha256(stderr) },
      productOrCertificationExecuted: false,
    };
  } finally {
    const resolvedScratch = path.resolve(scratch);
    const resolvedCache = `${path.resolve(cacheRoot)}${path.sep}`;
    assert.ok(resolvedScratch.startsWith(resolvedCache), resolvedScratch);
    fs.rmSync(resolvedScratch, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
}

assert.deepEqual(process.argv.slice(2), ['--write']);
assert.equal(process.version, EXPECTED_NODE_VERSION);
assert.equal(sha256(fs.readFileSync(process.execPath)), EXPECTED_NODE_SHA256);
assert.equal(gitText(['branch', '--show-current']), branch);
assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);
assert.equal(gitText(['show', '-s', '--format=%P', C3TB]), C3T);
assert.equal(gitText(['show', '-s', '--format=%T', C3TB]), C3TB_TREE);
assert.equal(gitText(['show', '-s', '--format=%P', C3T]), C3T_PARENT);
assert.equal(gitText(['show', '-s', '--format=%T', C3T]), C3T_TREE);
assert.equal(gitText(['rev-parse', `${C3TB}:${productRelative}`]), PRODUCTION_TREE);
assert.equal(gitText(['rev-parse', `${C3T}:${productRelative}`]), PRODUCTION_TREE);
assert.equal(gitText(['diff', '--name-only', C3T, C3TB, '--', productRelative]), '');
assert.deepEqual(changedNames(C3TB), expectedBindingPaths);

const evidenceBefore = inspectEvidenceNamespace();
assertAllowedWorktreeState(evidenceBefore);

const priorFailedPreflight = JSON.parse(fs.readFileSync(path.join(root, failedPreflightRelative), 'utf8'));
assert.deepEqual(priorFailedPreflight, {
  kind: 'MO1307Phase3CR2C3TBFailedPreflightHistory',
  version: '1.0.0',
  status: 'FAILED_SETUP',
  result: 'FAIL',
  outcome: 'PHASE3CR2_FAILED_INCOMPLETE',
  classification: 'HISTORICAL_PRE_CAMPAIGN_PIN_MISMATCH',
  recordedRetrospectively: true,
  previousStopRewrittenAsPass: false,
  resumable: false,
  candidate: {
    role: 'C3TB', commit: C3TB, branch, headUnchanged: true,
    productionCommit: C3T, productionTree: PRODUCTION_TREE, productionChanged: false,
  },
  failure: {
    stage: 'PREFLIGHT_CONTROL_MAP_IDENTITY',
    cause: 'EXPECTED_SHA256_WAS_COPIED_FROM_CURRENT_CONTROL_RESULTS_INSTEAD_OF_CURRENT_CONTROL_MAP',
    failedTool: {
      path: `${toolRelative}/preflight.mjs`,
      byteLength: 30587,
      sha256: 'sha256:315adee0784cadd3ec5ad8884b09eda51ce421a74100778692d6a87afa1a4ae3',
      gitBlob: 'db83ef24b7f702ed58838c2aadafce733f2f0c83',
    },
  },
  controlMap: {
    path: historicalControlMapRelative,
    historicalSourceCommit: HISTORICAL_PHASE3C,
    acceptedPhase3CAuthority: HISTORICAL_PHASE3C,
    oldExpectedSha256: 'sha256:9131759b75fc9407fd25467ef7656b0d6948711daecdf58234f1c4b09f9b9433',
    actual: {
      byteLength: 530142,
      sha256: 'sha256:0c490f5d4afa76b673c64d320308a2d1ca841a4330072b532964b0054d027131',
      gitBlob: 'bf6bbaeb118fcfc38384530cee3d2942ac39fc47',
    },
    objectChanged: false,
    intendedHistoricalObject: true,
  },
  misboundDigestSource: {
    path: historicalControlResultsRelative,
    historicalSourceCommit: HISTORICAL_PHASE3C,
    byteLength: 3057635,
    sha256: 'sha256:9131759b75fc9407fd25467ef7656b0d6948711daecdf58234f1c4b09f9b9433',
    gitBlob: '50551f4cde0c1f5107126f9459c8b4e447226dfd',
  },
  execution: {
    campaignExecutionStarted: false,
    freshControlsSelected: 89,
    freshControlsExecuted: 0,
    reuseCandidates: 462,
    reuseControlsCertified: 0,
    candidateSpecificControlsSelected: 2,
    candidateSpecificControls: 'NOT_RUN',
    certificationClaims: 0,
  },
  artifacts: {
    campaignPlan: false,
    preExecutionSeal: false,
    executionStart: false,
    executionLedger: false,
    certificationReceipt: false,
  },
  claims: [],
  provenance: {
    source: 'MO-1307_PHASE3CR2_PREFLIGHT_PIN_CORRECTION_BRIEF',
    originalMachineReceiptExisted: false,
    failureTimestampInvented: false,
  },
});

const helper = gitRecord(C3TB, helperRelative);
assertExactRecord(helper, {
  byteLength: 29153,
  sha256: HELPER_SHA256,
  gitBlob: '7ca55b8713108465099ecfce9796e06e3db67bd2',
});
assert.ok(fs.readFileSync(path.join(root, helperRelative)).equals(gitShow(C3TB, helperRelative)));

assert.equal(gitText(['cat-file', '-t', HISTORICAL_PHASE3C]), 'commit');
assert.equal(gitText(['show', '-s', '--format=%P', HISTORICAL_PHASE3C]), C3RB);
assert.equal(gitText(['show', '-s', '--format=%T', HISTORICAL_PHASE3C]), HISTORICAL_PHASE3C_TREE);
assert.equal(gitText(['show', '-s', '--format=%T', C3RB]), C3RB_TREE);
assert.equal(gitText(['rev-parse', `${HISTORICAL_PHASE3C}:${historicalEvidenceRelative}`]), HISTORICAL_EVIDENCE_TREE);
assert.equal(gitText(['rev-parse', `${HISTORICAL_PHASE3C}:${historicalToolsRelative}`]), HISTORICAL_TOOLS_TREE);
assert.equal(gitText(['rev-parse', `${HISTORICAL_PHASE3C}:${historicalReportRelative}`]), HISTORICAL_REPORT_BLOB);
assert.equal(listGitNames(HISTORICAL_PHASE3C, historicalEvidenceRelative).length, 1085);
assert.equal(listGitNames(HISTORICAL_PHASE3C, historicalToolsRelative).length, 42);
assert.equal(changedNames(HISTORICAL_PHASE3C).length, 1128);

const historicalReceiptRecord = gitRecord(HISTORICAL_PHASE3C, historicalReceiptRelative);
const historicalControlMapRecord = gitRecord(HISTORICAL_PHASE3C, historicalControlMapRelative);
const historicalControlResultsRecord = gitRecord(HISTORICAL_PHASE3C, historicalControlResultsRelative);
const historicalHandoffRecord = gitRecord(HISTORICAL_PHASE3C, historicalHandoffRelative);
const historicalFinalSealRecord = gitRecord(HISTORICAL_PHASE3C, historicalFinalSealRelative);
const historicalManifestRecord = gitRecord(HISTORICAL_PHASE3C, historicalManifestRelative);
assertExactRecord(historicalReceiptRecord, {
  byteLength: 9782,
  sha256: 'sha256:015888bc3cf2b78daebfc050d1563fc5cb33f5ce97f1c0cfb85f36061f923039',
  gitBlob: '84fd131988b662d04d63470e1038b18743ed2d71',
});
assertExactRecord(historicalControlMapRecord, {
  byteLength: 530142,
  sha256: 'sha256:0c490f5d4afa76b673c64d320308a2d1ca841a4330072b532964b0054d027131',
  gitBlob: 'bf6bbaeb118fcfc38384530cee3d2942ac39fc47',
});
assertExactRecord(historicalControlResultsRecord, {
  byteLength: 3057635,
  sha256: 'sha256:9131759b75fc9407fd25467ef7656b0d6948711daecdf58234f1c4b09f9b9433',
  gitBlob: '50551f4cde0c1f5107126f9459c8b4e447226dfd',
});
assertExactRecord(historicalHandoffRecord, {
  byteLength: 2041,
  sha256: 'sha256:2fa184e43d75bc396aa6199256ef3a8c59c5c66dbea3233f5a557b3d9e1cdee0',
  gitBlob: 'f176d3cd686443ec2bb658a99af6a571d508cd60',
});
assert.equal(historicalFinalSealRecord.byteLength, 1816);
assert.equal(historicalFinalSealRecord.sha256, 'sha256:94eb23d2138207455b1e08da3f788bb6a1abfdaae3b6e22855a085e8f8896f49');
assert.equal(historicalFinalSealRecord.gitBlob, '4aa4b7afa64c2e158ce140f43fd9dfa218188811');
assertExactRecord(historicalManifestRecord, {
  byteLength: 306682,
  sha256: 'sha256:9475a403e1725667499e1574d4f0fb5bf5695c60401c9e785b6dc1bba37bda67',
  gitBlob: '92c4c486b41557c63f866b12dca5569451167f5f',
});

const historicalReceipt = gitJson(HISTORICAL_PHASE3C, historicalReceiptRelative);
const historicalFinalSeal = gitJson(HISTORICAL_PHASE3C, historicalFinalSealRelative);
const historicalManifest = gitJson(HISTORICAL_PHASE3C, historicalManifestRelative);
assert.equal(historicalReceipt.result, 'PASS');
assert.equal(historicalReceipt.phase3C, 'ACCEPTED');
assert.equal(historicalReceipt.accepted, true);
assert.equal(historicalReceipt.candidate, C3RB);
assert.equal(historicalReceipt.candidateTree, C3RB_TREE);
assert.equal(historicalReceipt.controls.primary, 551);
assert.equal(historicalReceipt.controls.rejections, 426);
assert.equal(historicalReceipt.controls.passFresh, 551);
assert.equal(historicalReceipt.controls.historicalOutcomesAdopted, 0);
assert.equal(historicalFinalSeal.result, 'PASS');
assert.equal(historicalFinalSeal.phase3C, 'ACCEPTED');
assert.equal(historicalFinalSeal.candidate, C3RB);
assert.deepEqual(historicalFinalSeal.manifest, {
  path: historicalManifestRelative,
  byteLength: historicalManifestRecord.byteLength,
  sha256: historicalManifestRecord.sha256,
});
assert.equal(historicalManifest.kind, 'MO1307Phase3CCert3AcceptedEvidenceManifest');
assert.equal(historicalManifest.result, 'PASS');
assert.equal(historicalManifest.phase3C, 'ACCEPTED');
assert.equal(historicalManifest.candidate, C3RB);
const historicalManifestMapMembers = historicalManifest.members.filter(record => record.path === historicalControlMapRelative);
assert.deepEqual(historicalManifestMapMembers, [{
  path: historicalControlMapRelative,
  byteLength: historicalControlMapRecord.byteLength,
  sha256: historicalControlMapRecord.sha256,
}]);

const mapRecord = gitRecord(C3TB, mapRelative);
assertExactRecord(mapRecord, {
  byteLength: 21293,
  sha256: 'sha256:ada9532c868c69d7b6b951535f8f4a501c728a24057da6423308d5540192c16b',
  gitBlob: '863cd3d67d52ca2118f5de42b497db5f03279b03',
});
assert.ok(fs.readFileSync(path.join(root, mapRelative)).equals(gitShow(C3TB, mapRelative)));
const refreshMap = gitJson(C3TB, mapRelative);
assert.equal(refreshMap.kind, 'MO1307ProspectiveBoundPhase3CRefreshMap');
assert.equal(refreshMap.version, '1.0.0');
assert.equal(refreshMap.status, 'PENDING_SEPARATE_EXECUTION');
assert.equal(refreshMap.candidateRole, 'C3T');
assert.equal(refreshMap.consumeRule, 'EXACT_C3TB_HEAD_AFTER_BINDING_VERIFICATION');
assert.equal(refreshMap.certificationStarted, false);
assert.equal(refreshMap.selectedExecutionStarted, false);
assert.equal(refreshMap.push, false);
assert.equal(refreshMap.tag, false);
assert.deepEqual(refreshMap.accounting, {
  dependencyReuseCandidates: 462,
  historicalInventory: 551,
  omitted: 0,
  selectedFreshHistoricalControls: 89,
});
assert.deepEqual(refreshMap.candidateSpecificSupplementalControls, expectedSupplementalControls);
assert.deepEqual(refreshMap.additionalHeadlessCases, expectedHeadlessCases);
assert.deepEqual(refreshMap.requiredSourceAndSecurityReviews, expectedReviews);
assert.equal(refreshMap.historicalAccepted.commit, HISTORICAL_PHASE3C);
assert.equal(refreshMap.historicalAccepted.controls, 551);
assert.equal(refreshMap.historicalAccepted.appliesOnlyTo, 'C3RB');
assert.equal(refreshMap.historicalAccepted.promoted, false);
assert.equal(refreshMap.reuseRule, 'Each of the 462 IDs requires explicit field-level dependency equality before adopting its C3RB outcome; name inclusion is not PASS.');
assert.deepEqual(refreshMap.selectedHistoricalIds, [...refreshMap.selectedHistoricalIds].sort());
assert.deepEqual(refreshMap.dependencyReuseIds, [...refreshMap.dependencyReuseIds].sort());

const historicalControlMap = gitJson(HISTORICAL_PHASE3C, historicalControlMapRelative);
assert.equal(historicalControlMap.kind, 'MO1307Phase3CCert3CompleteFreshDraftMapping');
assert.equal(historicalControlMap.status, 'SEALED_ALL551_FRESH_REQUIRED');
assert.equal(historicalControlMap.candidate, C3RB);
assert.equal(historicalControlMap.integrationAuthority, '4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97');
assert.equal(historicalControlMap.rows.length, 551);
const historicalIds = historicalControlMap.rows.map(row => row.id);
const historicalSet = new Set(historicalIds);
const selectedSet = new Set(refreshMap.selectedHistoricalIds);
const reuseSet = new Set(refreshMap.dependencyReuseIds);
assert.equal(historicalSet.size, 551);
assert.equal(new Set(historicalIds.map(id => id.toLowerCase())).size, 550);
assert.equal(refreshMap.selectedHistoricalIds.length, 89);
assert.equal(refreshMap.dependencyReuseIds.length, 462);
assert.equal(selectedSet.size, 89);
assert.equal(reuseSet.size, 462);
for (const id of selectedSet) {
  assert.equal(historicalSet.has(id), true, `Unknown selected control: ${id}`);
  assert.equal(reuseSet.has(id), false, `Selected/reuse overlap: ${id}`);
}
for (const id of reuseSet) assert.equal(historicalSet.has(id), true, `Unknown reuse control: ${id}`);
const union = new Set([...selectedSet, ...reuseSet]);
assert.equal(union.size, 551);
for (const id of historicalSet) assert.equal(union.has(id), true, `Omitted historical control: ${id}`);

const selectedRows = historicalControlMap.rows.filter(row => selectedSet.has(row.id));
const reuseRows = historicalControlMap.rows.filter(row => reuseSet.has(row.id));
assert.equal(selectedRows.filter(row => row.negative).length, 74);
assert.equal(selectedRows.filter(row => !row.negative).length, 15);
assert.equal(reuseRows.filter(row => row.negative).length, 352);
assert.equal(reuseRows.filter(row => !row.negative).length, 110);
assert.equal(historicalControlMap.rows.filter(row => row.negative).length, 426);
assert.deepEqual(countBySuite(selectedRows), {
  'deadline-cleanup': { controls: 7, rejections: 6, behavioral: 1 },
  equivalence: { controls: 67, rejections: 55, behavioral: 12 },
  protocol: { controls: 12, rejections: 11, behavioral: 1 },
  'runtime-main': { controls: 1, rejections: 0, behavioral: 1 },
  toctou: { controls: 2, rejections: 2, behavioral: 0 },
});
assert.deepEqual(countBySuite(reuseRows), {
  'deadline-cleanup': { controls: 4, rejections: 3, behavioral: 1 },
  'governance-primary': { controls: 97, rejections: 59, behavioral: 38 },
  'governance-supplement': { controls: 18, rejections: 12, behavioral: 6 },
  root: { controls: 157, rejections: 114, behavioral: 43 },
  'runtime-main': { controls: 75, rejections: 71, behavioral: 4 },
  'runtime-supplement': { controls: 15, rejections: 6, behavioral: 9 },
  'trust-graph': { controls: 96, rejections: 87, behavioral: 9 },
});

const bindingRecord = gitRecord(C3TB, bindingRelative);
const bindingVerificationRecord = gitRecord(C3TB, bindingVerificationRelative);
assertExactRecord(bindingRecord, {
  byteLength: 27189,
  sha256: 'sha256:dde0766b80e65bc3426a6c2bdc3208bdd1b8ecd7ca17aa2594449cfe6ccb7175',
  gitBlob: '995c36fc429a0d04e42ad375f91aa00a0516b2b1',
});
assertExactRecord(bindingVerificationRecord, {
  byteLength: 1155,
  sha256: 'sha256:f322d1ba53a9ab18fc3638b367fb770b5c2d47a1dd5ffbe7ae06ad82373555d1',
  gitBlob: 'cf6e3e9499164fcff5ca015659ca6e0795d7cb1b',
});
const binding = gitJson(C3TB, bindingRelative);
const bindingVerification = gitJson(C3TB, bindingVerificationRelative);
assert.equal(binding.result, 'NEW_PRODUCTION_CANDIDATE_READY_FOR_PHASE3');
assert.equal(binding.candidateRole, 'C3T');
assert.equal(binding.bindingRole, 'C3TB');
assert.equal(binding.implementation.commit, C3T);
assert.equal(binding.implementation.parent, C3T_PARENT);
assert.equal(binding.implementation.rootTree, C3T_TREE);
assert.equal(binding.implementation.productionTree, PRODUCTION_TREE);
assert.equal(binding.binding.soleParent, C3T);
assert.equal(binding.binding.productionChanges, false);
assert.equal(binding.binding.commit, null);
assert.deepEqual(binding.limits, expectedLimits);
assert.equal(binding.phase3AExecuted, false);
assert.equal(binding.phase3BExecuted, false);
assert.equal(binding.phase3CExecuted, false);
assert.equal(binding.phase3DExecuted, false);
assert.equal(bindingVerification.result, 'PASS');
assert.equal(bindingVerification.candidateCommit, C3T);
assert.equal(bindingVerification.candidateRootTree, C3T_TREE);
assert.equal(bindingVerification.productionTree, PRODUCTION_TREE);
assert.equal(bindingVerification.bindingCommit, null);
assert.equal(bindingVerification.productionChangesInBindingCommit, false);
assert.equal(bindingVerification.certificationExecuted, false);

const officialBindingCheck = runOfficialBindingCheck();
const initialToolInputs = walkFiles(toolRoot);
assert.ok(initialToolInputs.some(record => record.path === `${toolRelative}/README.md`));
assert.ok(initialToolInputs.some(record => record.path === `${toolRelative}/preflight.mjs`));
assert.equal(new Set(initialToolInputs.map(record => record.path)).size, initialToolInputs.length);
const toolSetDigest = sha256(bytes(initialToolInputs));

const createdAt = new Date().toISOString();
const candidate = {
  role: 'C3TB',
  commit: C3TB,
  tree: C3TB_TREE,
  soleParent: C3T,
  implementation: { role: 'C3T', commit: C3T, tree: C3T_TREE, parent: C3T_PARENT },
  productionTree: PRODUCTION_TREE,
  helper,
  branch,
};
const historicalAccepted = {
  phase3C: 'ACCEPTED',
  promoted: false,
  appliesOnlyTo: 'C3RB',
  commit: HISTORICAL_PHASE3C,
  commitTree: HISTORICAL_PHASE3C_TREE,
  soleParent: C3RB,
  candidateTree: C3RB_TREE,
  evidenceTree: HISTORICAL_EVIDENCE_TREE,
  toolsTree: HISTORICAL_TOOLS_TREE,
  report: gitRecord(HISTORICAL_PHASE3C, historicalReportRelative),
  receipt: historicalReceiptRecord,
  currentControlMap: historicalControlMapRecord,
  currentControlResults: historicalControlResultsRecord,
  phase3DHandoff: historicalHandoffRecord,
  finalSeal: historicalFinalSealRecord,
  evidenceManifest: historicalManifestRecord,
  changedFiles: 1128,
  evidenceFiles: 1085,
  toolFiles: 42,
};
const accounting = {
  historical: {
    inventory: 551,
    selectedFresh: 89,
    dependencyReuse: 462,
    omitted: 0,
    rejections: 426,
    behavioral: 125,
    selectedRejections: 74,
    selectedBehavioral: 15,
    reuseRejections: 352,
    reuseBehavioral: 110,
    selectedBySuite: countBySuite(selectedRows),
    reuseBySuite: countBySuite(reuseRows),
  },
  candidateSpecificSupplementalControls: { count: 2, ids: expectedSupplementalControls },
  headlessCorrectionCases: { count: 19, ids: expectedHeadlessCases },
  requiredSourceAndSecurityReviews: { count: 12, ids: expectedReviews },
  axesRemainSeparate: true,
  flatAggregateControlCountNotAsserted: true,
};
const inputRecords = [
  gitRecord(C3TB, `${candidateEvidenceRelative}/authority.json`),
  gitRecord(C3TB, `${candidateEvidenceRelative}/candidate.json`),
  gitRecord(C3TB, `${candidateEvidenceRelative}/consistency-validation.json`),
  mapRecord,
  bindingRecord,
  bindingVerificationRecord,
  historicalReceiptRecord,
  historicalControlMapRecord,
  historicalControlResultsRecord,
  historicalHandoffRecord,
  historicalFinalSealRecord,
  historicalManifestRecord,
].sort((a, b) => a.path.localeCompare(b.path, 'en'));

const pinCorrection = {
  result: 'PASS',
  scope: 'CERTIFICATION_TOOLING_IDENTITY_PIN_ONLY',
  historicalControlMap: historicalControlMapRecord,
  oldExpectedSha256: priorFailedPreflight.controlMap.oldExpectedSha256,
  correctedExpectedSha256: historicalControlMapRecord.sha256,
  staleExpectedResolvedTo: historicalControlResultsRecord,
  cause: 'CONTROL_MAP_VS_CONTROL_RESULTS_IDENTITY_FIELD_TRANSPOSITION',
  objectBytesChanged: false,
  controlIdsChanged: false,
  expectedOutcomesChanged: false,
  selectionChanged: false,
  dependencyMappingsChanged: false,
};
const zeroExecutionPreflight = {
  result: 'PASS',
  historicalControlMapIdentity: 'PASS',
  acceptedPhase3CAuthorityChain: 'PASS',
  c3tbIdentity: 'PASS',
  productionTreeIdentity: 'PASS',
  helperIdentity: 'PASS',
  refreshMapCardinality: 'PASS',
  selectedFreshHistoricalControls: { expected: 89, accounted: selectedSet.size },
  dependencyReuseCandidates: { expected: 462, accounted: reuseSet.size },
  candidateSpecificControls: { expected: 2, accounted: expectedSupplementalControls.length },
  historicalInventory: { expected: 551, accounted: union.size },
  exactIdDuplicates: 0,
  caseSensitiveControlIds: true,
  caseFoldDistinctAuthorityPairCount: historicalSet.size - new Set(historicalIds.map(id => id.toLowerCase())).size,
  selectedReuseOverlap: [...selectedSet].filter(id => reuseSet.has(id)).length,
  omissions: [...historicalSet].filter(id => !union.has(id)).length,
  productExecutions: 0,
  securityExecutions: 0,
  certificationClaims: 0,
};
assert.deepEqual(zeroExecutionPreflight, {
  result: 'PASS',
  historicalControlMapIdentity: 'PASS',
  acceptedPhase3CAuthorityChain: 'PASS',
  c3tbIdentity: 'PASS',
  productionTreeIdentity: 'PASS',
  helperIdentity: 'PASS',
  refreshMapCardinality: 'PASS',
  selectedFreshHistoricalControls: { expected: 89, accounted: 89 },
  dependencyReuseCandidates: { expected: 462, accounted: 462 },
  candidateSpecificControls: { expected: 2, accounted: 2 },
  historicalInventory: { expected: 551, accounted: 551 },
  exactIdDuplicates: 0,
  caseSensitiveControlIds: true,
  caseFoldDistinctAuthorityPairCount: 1,
  selectedReuseOverlap: 0,
  omissions: 0,
  productExecutions: 0,
  securityExecutions: 0,
  certificationClaims: 0,
});
const generation = {
  mode: 'FRESH_AFTER_FAILED_PREFLIGHT',
  preflightAttempt: 2,
  resumesPriorAttempt: false,
  priorAttempt: {
    status: priorFailedPreflight.status,
    outcome: priorFailedPreflight.outcome,
    resumable: priorFailedPreflight.resumable,
    evidence: evidenceBefore.priorFailedPreflight,
  },
};

const campaignPlan = {
  kind: 'MO1307Phase3CR2C3TBCampaignPlan',
  version: '1.0.0',
  createdAt,
  status: 'SEALED_NOT_EXECUTED',
  candidate,
  generation,
  priorFailedPreflight: { evidence: evidenceBefore.priorFailedPreflight, record: priorFailedPreflight },
  pinCorrection,
  zeroExecutionPreflight,
  historicalAccepted,
  authority: {
    selection: mapRecord,
    binding: bindingRecord,
    bindingVerification: bindingVerificationRecord,
    consumeRule: refreshMap.consumeRule,
    reuseRule: refreshMap.reuseRule,
  },
  accounting,
  limits: {
    ...expectedLimits,
    success: 'elapsedMs < 8000',
    timeout: 'elapsedMs >= 8000',
    H: 'NOT_ESTABLISHED',
  },
  executionPolicy: {
    firstMandatoryFailureStopsGeneration: true,
    retries: 0,
    inCampaignRepair: false,
    adaptiveExpansion: false,
    historicalOutcomeFallbackAfterMismatch: false,
    dependencyReuseRequiresFieldLevelEquality: true,
    caseSensitiveControlIds: true,
    productExecutionPerformedByPreflight: false,
    certificationExecutionPerformedByPreflight: false,
  },
  stageOrder: [
    'DEPENDENCY_REUSE_PROOF_462',
    'HEADLESS_SMOKE',
    'HEADLESS_SECURITY_A_TO_S_19',
    'DEADLINE_CLEANUP_SELECTED_7',
    'EQUIVALENCE_SELECTED_67',
    'NATIVE_LAST_ERROR_METADATA',
    'PROTOCOL_SELECTED_12',
    'TOCTOU_BOUNDARIES_SELECTED_2',
    'CASE_SENSITIVE_RECONCILIATION',
    'INDEPENDENT_FINAL_REVIEW',
    'FINAL_APPEND_ONLY_SEAL',
  ],
  officialBindingCheck,
  finalizedToolInputs: initialToolInputs,
  finalizedToolInputCount: initialToolInputs.length,
  finalizedToolSetDigest: toolSetDigest,
  inputRecords,
  evidenceNamespaceBeforePreflight: evidenceBefore,
  outputs: [planRelative, sealRelative],
  prohibitions: {
    productChange: false,
    phase3A: false,
    phase3B: false,
    phase3D: false,
    networkAcquisition: false,
    hostedProviders: false,
    push: false,
    tag: false,
  },
};
const planBytes = bytes(campaignPlan);
const planRecord = { path: planRelative, byteLength: planBytes.length, sha256: sha256(planBytes) };
const seal = {
  kind: 'MO1307Phase3CR2C3TBPreExecutionSeal',
  version: '1.0.0',
  sealedAt: createdAt,
  result: 'SEALED_NOT_EXECUTED',
  candidate,
  generation,
  priorFailedPreflight: { evidence: evidenceBefore.priorFailedPreflight, record: priorFailedPreflight },
  pinCorrection,
  zeroExecutionPreflight,
  historicalAccepted,
  campaignPlan: planRecord,
  selectionMap: mapRecord,
  binding: bindingRecord,
  bindingVerification: bindingVerificationRecord,
  accounting,
  limits: campaignPlan.limits,
  officialBindingCheck,
  finalizedToolInputs: initialToolInputs,
  finalizedToolInputCount: initialToolInputs.length,
  finalizedToolSetDigest: toolSetDigest,
  inputRecords,
  appendOnly: {
    evidenceNamespaceBeforePreflight: evidenceBefore,
    writesUseExclusiveCreate: true,
    historicalArtifactsModified: false,
    productModified: false,
    selfReference: false,
  },
  productControlsExecutedBeforeSeal: false,
  certificationExecutedBeforeSeal: false,
};
const sealBytes = bytes(seal);

assert.equal(gitText(['branch', '--show-current']), branch);
assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);
assert.deepEqual(walkFiles(toolRoot), initialToolInputs, 'Finalized tool inputs changed during preflight.');
assert.deepEqual(inspectEvidenceNamespace(), evidenceBefore, 'Evidence namespace changed during preflight.');
assertAllowedWorktreeState(evidenceBefore);
fs.mkdirSync(evidenceRoot, { recursive: true });
fs.writeFileSync(path.join(root, planRelative), planBytes, { flag: 'wx', mode: 0o644 });
fs.writeFileSync(path.join(root, sealRelative), sealBytes, { flag: 'wx', mode: 0o644 });

process.stdout.write(`${canonical({
  result: 'SEALED_NOT_EXECUTED',
  candidate: C3TB,
  candidateTree: C3TB_TREE,
  productionTree: PRODUCTION_TREE,
  historicalPhase3C: HISTORICAL_PHASE3C,
  generation,
  priorFailedPreflight: evidenceBefore.priorFailedPreflight,
  pinCorrection,
  zeroExecutionPreflight,
  accounting,
  finalizedToolInputs: initialToolInputs.length,
  campaignPlan: planRecord,
  preExecutionSeal: { path: sealRelative, byteLength: sealBytes.length, sha256: sha256(sealBytes) },
})}\n`);
