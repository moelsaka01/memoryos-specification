// Append-only Phase 3CR2 acceptance sealing and reporting.
// This tool validates already-completed evidence. It never executes product controls.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const EXPECTED_ROOT = 'C:/Users/melsa/Documents/Codex/3cr2';
const BRANCH = 'codex/mo1307-phase3cr2-c3tb';
const C3TB = '119e68bdcf0ffc906b4ca03a912aadcb25908346';
const C3TB_TREE = '5e0088965d4eac4002165fe0190f275c257985ba';
const C3T = '65e24b2debdd70ecb8e52fbccbd6c101621f1917';
const C3T_TREE = 'd21f46bc31ccd7a9f80a5e494b3d09116d125522';
const C3T_PARENT = '79ef47e608c67edc70f3e9f51d494b169794f903';
const PRODUCTION_TREE = '324bf600b6cbfaa8564db27fce2d999711270cb8';
const HELPER_SHA256 = 'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127';
const HISTORICAL_PHASE3C = 'b02fc0226a1a2d800185a02071674ca80bdf4a1d';
const HISTORICAL_PHASE3C_TREE = 'd95be491e59e409c628eac8d990ddcbd1cc3ed34';
const C3RB = 'defe93989efc6501b1a730b82e79e705884b269b';
const C3RB_TREE = '54c8ca8acc388d8dcb5d8d76e119b434dcc1a9bb';
const HISTORICAL_EVIDENCE_TREE = '17bab55dfaf49e5554cfb751975b5391299cb857';
const HISTORICAL_TOOLS_TREE = '92d84d66a9bf54d5fb85e1ceb2f0ab104beed2b1';
const HISTORICAL_REPORT_BLOB = '140f47d0a1d786ca0e11cefc201e25b7f94f5e62';
const ACCEPTED_PHASE3BR2 = '4d92f0f21c9c3aad8202f4558d61b9229c7214fc';
const ACCEPTED_PHASE3BR2_TREE = '7d07f5f570248f8159339ae33637194937cf4918';
const N15_REFERENCE_COMMIT = 'c9cd73df2f4c48afeab6059b31eca61830e1633c';
const N15_REFERENCE_BLOB = '527fea7b9f12ba345f5b4f57511263485e79e303';
const N15_REFERENCE_SHA256 = 'sha256:f9d68d43cba57b5fc64e6bca13605ccf82f6afa9e1b0ac110bf9e4357bdbce69';
const N15_REFERENCE_PATH = 'repositories/cca-conformance/evidence/mo1307/n15-correction/native-filesystem/helper.ps1.data';
const EXPECTED_NODE_VERSION = 'v24.21.0';
const EXPECTED_NODE_SHA256 = 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
const RUNTIME_RELATIVE = '.cache/mo1307-phase3cr2-runtime/node.exe';
const GIT = 'C:/Program Files/Git/cmd/git.exe';

const productRelative = 'repositories/memoryos-readiness';
const helperRelative = `${productRelative}/helpers/windows-inspect.ps1`;
const toolRelative = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb';
const evidenceRelative = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb';
const reportRelative = 'repositories/cca-conformance/docs/mo1307-phase3cr2-c3tb.md';
const toolRoot = path.join(root, toolRelative);
const evidenceRoot = path.join(root, evidenceRelative);
const reportPath = path.join(root, reportRelative);

const planRelative = `${evidenceRelative}/campaign-plan.json`;
const preSealRelative = `${evidenceRelative}/pre-execution-seal.json`;
const failedPreflightRelative = `${evidenceRelative}/failed-preflight-attempt-1.json`;
const executionStartRelative = `${evidenceRelative}/execution-start.json`;
const executionLedgerRelative = `${evidenceRelative}/execution-ledger.json`;
const reuseRelative = `${evidenceRelative}/dependency-reuse.json`;
const freshResultsRelative = `${evidenceRelative}/fresh-control-results.json`;
const candidateControlsRelative = `${evidenceRelative}/candidate-specific-controls.json`;
const sourceReviewsRelative = `${evidenceRelative}/source-security-reviews.json`;
const deadlineRelative = `${evidenceRelative}/deadline-cleanup/attempt-1/receipt.json`;
const deadlineClosureRelative = `${evidenceRelative}/deadline-cleanup/attempt-1/boundary-closure.json`;
const equivalenceRelative = `${evidenceRelative}/equivalence/attempt1/receipt.json`;
const protocolRelative = `${evidenceRelative}/protocol-subset.json`;
const toctouRelative = `${evidenceRelative}/toctou-boundaries/attempt1/receipt.json`;
const nativeLastErrorRelative = `${evidenceRelative}/native-last-error/receipt.json`;
const smokeRelative = `${evidenceRelative}/headless-smoke/receipt.json`;
const smokeSealRelative = `${evidenceRelative}/headless-smoke/seal.json`;
const securityRelative = `${evidenceRelative}/headless-security/receipt.json`;
const securitySealRelative = `${evidenceRelative}/headless-security/seal.json`;
const receiptRelative = `${evidenceRelative}/certification-receipt.json`;
const handoffRelative = `${evidenceRelative}/phase3d-handoff.json`;
const finalReviewRelative = `${evidenceRelative}/final-review.json`;
const manifestRelative = `${evidenceRelative}/evidence-manifest.json`;
const finalSealRelative = `${evidenceRelative}/final-seal.json`;

const candidateEvidenceRelative = 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate';
const mapRelative = `${candidateEvidenceRelative}/phase3c-refresh-map.json`;
const bindingRelative = `${candidateEvidenceRelative}/binding.json`;
const bindingVerificationRelative = `${candidateEvidenceRelative}/binding-verification.json`;
const historicalEvidenceRelative = 'repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3';
const historicalToolsRelative = 'repositories/cca-conformance/tools/mo1307-phase3c-c3rb-cert3';
const historicalReportRelative = 'docs/mo1307-phase3c-c3rb-cert3.md';
const historicalReceiptRelative = `${historicalEvidenceRelative}/certification-receipt.json`;
const historicalControlMapRelative = `${historicalEvidenceRelative}/current-control-map.json`;
const historicalControlResultsRelative = `${historicalEvidenceRelative}/current-control-results.json`;

const expectedSupplemental = Object.freeze([
  'candidate:prospective-bound-generated-contract-consistency',
  'candidate:prospective-bound-package-and-binding-identity',
]);
const expectedHeadless = Object.freeze([...'ABCDEFGHIJKLMNOPQRS']);
const expectedNativeMethodKeys = Object.freeze([
  'CreateFileW:System.String,System.UInt32,System.UInt32,System.IntPtr,System.UInt32,System.UInt32,System.IntPtr',
  'FreeConsole:',
  'GetConsoleProcessList:System.IntPtr,System.UInt32',
  'GetFileInformationByHandle:Microsoft.Win32.SafeHandles.SafeFileHandle,System.IntPtr',
  'GetFileType:Microsoft.Win32.SafeHandles.SafeFileHandle',
  'GetFileType:System.IntPtr',
  'GetFinalPathNameByHandleW:Microsoft.Win32.SafeHandles.SafeFileHandle,System.Text.StringBuilder,System.UInt32,System.UInt32',
  'GetStdHandle:System.Int32',
]);
const expectedReviews = Object.freeze([
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
const expectedFreshExecutedReuseSupport = Object.freeze([
  Object.freeze({ id: 'runtime-boundary:launch-flag---import', caseId: 'launch-substitution-import', negative: true }),
  Object.freeze({ id: 'runtime-boundary:launch-flag---require', caseId: 'launch-substitution-require', negative: true }),
  Object.freeze({ id: 'runtime-boundary:launch-flag---loader', caseId: 'launch-substitution-loader', negative: true }),
  Object.freeze({ id: 'runtime-boundary:secret-fixed-diagnostic', caseId: 'secret-safe-error-projection', negative: false }),
]);
const expectedStages = Object.freeze([
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
const expectedLimits = Object.freeze({
  aggregateHelperActiveMs: 20000,
  apiMs: 10000,
  cleanupMs: 2000,
  cliAdmissionMs: 30000,
  helperMs: 8000,
  workerMs: 10000,
});

const ordinal = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const slash = value => value.replaceAll('\\', '/');
const sha256 = data => `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
const gitBlob = data => crypto.createHash('sha1')
  .update(Buffer.from(`blob ${data.length}\0`))
  .update(data)
  .digest('hex');
const textOf = value => Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? '');

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

const canonicalBytes = value => Buffer.from(`${canonical(value)}\n`);

function absolute(relative) {
  const resolved = path.resolve(root, relative);
  const rootPrefix = `${path.resolve(root)}${path.sep}`;
  assert.ok(resolved.startsWith(rootPrefix), `Path escapes worktree: ${relative}`);
  return resolved;
}

function recordFromBytes(relative, data, includeGitBlob = false) {
  const record = { path: slash(relative), byteLength: data.length, sha256: sha256(data) };
  if (includeGitBlob) record.gitBlob = gitBlob(data);
  return record;
}

function pin(relative) {
  const data = fs.readFileSync(absolute(relative));
  return recordFromBytes(relative, data);
}

function fileRecord(absolutePath) {
  const relative = slash(path.relative(root, absolutePath));
  assert.ok(relative && relative !== '..' && !relative.startsWith('../'), absolutePath);
  const stat = fs.lstatSync(absolutePath);
  assert.equal(stat.isSymbolicLink(), false, `Symlink not allowed: ${relative}`);
  assert.equal(stat.isFile(), true, `Not a regular file: ${relative}`);
  return recordFromBytes(relative, fs.readFileSync(absolutePath), true);
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(absolute(relative), 'utf8'));
}

function walkFiles(directory) {
  const result = [];
  const walk = current => {
    const currentStat = fs.lstatSync(current);
    assert.equal(currentStat.isSymbolicLink(), false, `Directory symlink not allowed: ${current}`);
    assert.equal(currentStat.isDirectory(), true, `Expected directory: ${current}`);
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => ordinal(a.name, b.name))) {
      const child = path.join(current, entry.name);
      assert.equal(entry.isSymbolicLink(), false, `Symlink not allowed: ${child}`);
      if (entry.isDirectory()) walk(child);
      else {
        assert.equal(entry.isFile(), true, `Not a regular file: ${child}`);
        result.push(child);
      }
    }
  };
  walk(directory);
  return result.sort((a, b) => ordinal(slash(a), slash(b))).map(fileRecord);
}

function run(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    input: options.input,
    encoding: options.encoding,
    windowsHide: true,
    maxBuffer: options.maxBuffer ?? 128 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${file} ${args.join(' ')} failed (${result.status}): ${textOf(result.stderr)}`);
  return result;
}

const gitBytes = args => run(GIT, ['-c', 'core.longpaths=true', '-c', `safe.directory=${slash(path.resolve(root))}`, ...args]).stdout;
const gitText = args => textOf(gitBytes(args)).trim();
const gitShow = (commit, relative) => gitBytes(['show', `${commit}:${relative}`]);
const gitJson = (commit, relative) => JSON.parse(gitShow(commit, relative).toString('utf8'));

function gitRecord(commit, relative) {
  const data = gitShow(commit, relative);
  const record = recordFromBytes(relative, data, true);
  assert.equal(record.gitBlob, gitText(['rev-parse', `${commit}:${relative}`]));
  return record;
}

function changedNames(commit) {
  return gitBytes(['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', commit])
    .toString('utf8').split('\0').filter(Boolean).sort(ordinal);
}

function statusEntries() {
  const raw = gitBytes(['status', '--porcelain=v1', '-z', '--untracked-files=all']).toString('utf8');
  const fields = raw.split('\0').filter(Boolean);
  const result = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    const status = field.slice(0, 2);
    assert.equal(/[RC]/u.test(status), false, `Rename/copy not allowed during finalization: ${field}`);
    result.push({ status, path: slash(field.slice(3)) });
  }
  return result;
}

function assertAllowedWriteState() {
  const entries = statusEntries();
  for (const entry of entries) {
    const allowed = entry.path === toolRelative
      || entry.path.startsWith(`${toolRelative}/`)
      || entry.path === evidenceRelative
      || entry.path.startsWith(`${evidenceRelative}/`)
      || entry.path === reportRelative;
    assert.equal(allowed, true, `Unexpected dirty path: ${entry.path}`);
  }
  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all', '--', productRelative]), '');
  return entries;
}

function assertRecord(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value, `${label} ${key}`);
}

function assertPassRows(rows, idField, expectedCount, label) {
  assert.equal(Array.isArray(rows), true, `${label} rows`);
  assert.equal(rows.length, expectedCount, `${label} count`);
  assert.equal(new Set(rows.map(row => row[idField])).size, expectedCount, `${label} unique IDs`);
  assert.equal(rows.every(row => row.result === 'PASS'), true, `${label} PASS`);
}

function assertPassedCaseAccounting(caseAccounting, executedIds, expectedCount, label) {
  assert.equal(Array.isArray(caseAccounting), true, `${label} case accounting`);
  assert.equal(caseAccounting.length, expectedCount, `${label} planned count`);
  assert.equal(executedIds.length, expectedCount, `${label} executed count`);
  assert.deepEqual(caseAccounting.map(row => row.id), executedIds, `${label} exact planned/executed IDs and order`);
  assert.deepEqual(caseAccounting.map(row => row.ordinal), Array.from({ length: expectedCount }, (_, index) => index + 1), `${label} ordinals`);
  assert.equal(new Set(caseAccounting.map(row => row.id)).size, expectedCount, `${label} unique planned IDs`);
  assert.equal(caseAccounting.every(row => row.status === 'PASS'), true, `${label} every planned case PASS`);
}

function assertReferenceProvenance(provenance, label) {
  const normalizePath = value => slash(path.isAbsolute(value) ? path.relative(root, value) : value);
  assert.equal(provenance.sealedArtifact.commit, N15_REFERENCE_COMMIT, `${label} sealed commit`);
  assert.equal(provenance.sealedArtifact.gitBlob, N15_REFERENCE_BLOB, `${label} sealed blob`);
  assert.deepEqual({
    path: normalizePath(provenance.sealedArtifact.path),
    byteLength: provenance.sealedArtifact.byteLength,
    sha256: provenance.sealedArtifact.sha256,
  }, { path: N15_REFERENCE_PATH, byteLength: 29136, sha256: N15_REFERENCE_SHA256 });
  assert.equal(provenance.productionSource.commit, N15_REFERENCE_COMMIT, `${label} production commit`);
  assert.equal(provenance.productionSource.path, helperRelative, `${label} production path`);
  assert.equal(provenance.productionSource.gitBlob, N15_REFERENCE_BLOB, `${label} production blob`);
  assert.equal(provenance.sameGitBlob, true, `${label} same Git blob`);
  assert.equal(provenance.role, 'SEALED_CORRECTED_PRODUCTION_HELPER_COMPARISON_SOURCE', `${label} role`);
  assert.equal(provenance.diagnosticEvidencePromoted, false, `${label} diagnostic promotion`);
  const copyPath = path.isAbsolute(provenance.copy.path) ? provenance.copy.path : absolute(provenance.copy.path);
  const copyBytes = fs.readFileSync(copyPath);
  assert.equal(copyBytes.length, 29136, `${label} copy bytes`);
  assert.equal(sha256(copyBytes), N15_REFERENCE_SHA256, `${label} copy SHA-256`);
  assert.equal(provenance.copy.byteLength, copyBytes.length, `${label} recorded copy bytes`);
  assert.equal(provenance.copy.sha256, sha256(copyBytes), `${label} recorded copy SHA-256`);
}

function assertCommonAnchors() {
  assert.equal(slash(path.resolve(root)), EXPECTED_ROOT);
  assert.equal(process.platform, 'win32');
  assert.equal(process.arch, 'x64');
  assert.equal(process.version, EXPECTED_NODE_VERSION);
  assert.equal(path.resolve(process.execPath).toLowerCase(), absolute(RUNTIME_RELATIVE).toLowerCase(), 'Use the provisioned in-worktree runtime.');
  assert.equal(fs.lstatSync(process.execPath).isFile(), true);
  assert.equal(fs.lstatSync(process.execPath).isSymbolicLink(), false);
  assert.equal(fs.statSync(process.execPath).size, 93580104);
  assert.equal(sha256(fs.readFileSync(process.execPath)), EXPECTED_NODE_SHA256);
  assert.equal(gitText(['branch', '--show-current']), BRANCH);
  assert.equal(gitText(['cat-file', '-t', ACCEPTED_PHASE3BR2]), 'commit');
  assert.equal(gitText(['show', '-s', '--format=%P', ACCEPTED_PHASE3BR2]), C3TB);
  assert.equal(gitText(['show', '-s', '--format=%T', ACCEPTED_PHASE3BR2]), ACCEPTED_PHASE3BR2_TREE);
  assert.equal(gitText(['show', '-s', '--format=%P', C3TB]), C3T);
  assert.equal(gitText(['show', '-s', '--format=%T', C3TB]), C3TB_TREE);
  assert.equal(gitText(['show', '-s', '--format=%P', C3T]), C3T_PARENT);
  assert.equal(gitText(['show', '-s', '--format=%T', C3T]), C3T_TREE);
  assert.equal(gitText(['rev-parse', `${C3TB}:${productRelative}`]), PRODUCTION_TREE);
  assert.equal(gitText(['rev-parse', `${C3T}:${productRelative}`]), PRODUCTION_TREE);
  assert.equal(gitText(['diff', '--name-only', C3T, C3TB, '--', productRelative]), '');
  assert.deepEqual(changedNames(C3TB), [bindingRelative, bindingVerificationRelative].sort(ordinal));
  assertRecord(gitRecord(C3TB, helperRelative), {
    byteLength: 29153,
    sha256: HELPER_SHA256,
    gitBlob: '7ca55b8713108465099ecfce9796e06e3db67bd2',
  }, 'helper');
  assertRecord(gitRecord(N15_REFERENCE_COMMIT, N15_REFERENCE_PATH), {
    byteLength: 29136,
    sha256: N15_REFERENCE_SHA256,
    gitBlob: N15_REFERENCE_BLOB,
  }, 'N15 sealed corrected helper');
  assertRecord(gitRecord(N15_REFERENCE_COMMIT, helperRelative), {
    byteLength: 29136,
    sha256: N15_REFERENCE_SHA256,
    gitBlob: N15_REFERENCE_BLOB,
  }, 'N15 production helper');
  assertRecord(gitRecord(C3TB, N15_REFERENCE_PATH), {
    byteLength: 29136,
    sha256: N15_REFERENCE_SHA256,
    gitBlob: N15_REFERENCE_BLOB,
  }, 'C3TB-retained N15 comparator');

  assert.equal(gitText(['cat-file', '-t', HISTORICAL_PHASE3C]), 'commit');
  assert.equal(gitText(['show', '-s', '--format=%P', HISTORICAL_PHASE3C]), C3RB);
  assert.equal(gitText(['show', '-s', '--format=%T', HISTORICAL_PHASE3C]), HISTORICAL_PHASE3C_TREE);
  assert.equal(gitText(['show', '-s', '--format=%T', C3RB]), C3RB_TREE);
  assert.equal(gitText(['rev-parse', `${HISTORICAL_PHASE3C}:${historicalEvidenceRelative}`]), HISTORICAL_EVIDENCE_TREE);
  assert.equal(gitText(['rev-parse', `${HISTORICAL_PHASE3C}:${historicalToolsRelative}`]), HISTORICAL_TOOLS_TREE);
  assert.equal(gitText(['rev-parse', `${HISTORICAL_PHASE3C}:${historicalReportRelative}`]), HISTORICAL_REPORT_BLOB);
}

function verifyArtifactPin(record) {
  const actual = pin(record.path);
  assert.deepEqual(actual, record, `Changed artifact: ${record.path}`);
}

function loadFinalArtifacts() {
  const receipt = readJson(receiptRelative);
  const handoff = readJson(handoffRelative);
  const finalReview = readJson(finalReviewRelative);
  const manifest = readJson(manifestRelative);
  const finalSeal = readJson(finalSealRelative);
  const failedPreflightEvidence = pin(failedPreflightRelative);
  const failedPreflightSummary = {
    status: 'FAILED_SETUP',
    result: 'FAIL',
    outcome: 'PHASE3CR2_FAILED_INCOMPLETE',
    resumable: false,
    controlsExecuted: 0,
    certificationClaims: 0,
    rewrittenAsPass: false,
    evidence: failedPreflightEvidence,
  };
  assert.equal(receipt.result, 'PASS');
  assert.equal(receipt.phase3CR2, 'ACCEPTED');
  assert.equal(receipt.status, 'PHASE3CR2_ACCEPTED');
  assert.equal(receipt.failedPreflightAttempt.status, 'FAILED_SETUP');
  assert.equal(receipt.failedPreflightAttempt.result, 'FAIL');
  assert.equal(receipt.failedPreflightAttempt.rewrittenAsPass, false);
  assert.deepEqual(receipt.failedPreflightAttempt, failedPreflightSummary);
  assert.equal(receipt.generation.mode, 'FRESH_AFTER_FAILED_PREFLIGHT');
  assert.equal(receipt.generation.resumesPriorAttempt, false);
  assert.equal(handoff.phase3CR2, 'ACCEPTED');
  assert.equal(handoff.phase3DExecuted, false);
  assert.deepEqual(handoff.failedPreflightAttempt, failedPreflightSummary);
  assert.equal(finalReview.result, 'PASS_ACCEPTANCE_SUPPORTED');
  assert.equal(finalReview.requiredReportItems, 22);
  assert.equal(finalReview.requiredReportItemsPresent, 22);
  assert.equal(finalReview.checks.reportFields, 22);
  assert.deepEqual(finalReview.failedPreflightAttempt, failedPreflightSummary);
  assert.equal(manifest.result, 'PASS');
  assert.equal(manifest.phase3CR2, 'ACCEPTED');
  assert.equal(finalSeal.result, 'PASS');
  assert.equal(finalSeal.phase3CR2, 'ACCEPTED');
  assert.deepEqual(manifest.failedPreflightAttempt, failedPreflightSummary);
  assert.deepEqual(finalSeal.failedPreflightAttempt, failedPreflightSummary);
  for (const artifact of [finalReview, receipt, handoff, manifest, finalSeal]) {
    assert.deepEqual(artifact.generation, receipt.generation, 'Generation identity diverged across final artifacts.');
  }
  for (const artifact of [receipt, handoff, manifest, finalSeal]) {
    assert.deepEqual(artifact.pinCorrection, finalReview.checks.correctedPin, 'Pin correction diverged across final artifacts.');
    assert.deepEqual(artifact.zeroExecutionPreflight, finalReview.checks.zeroExecutionPreflight, 'Zero-execution preflight diverged across final artifacts.');
  }
  for (const record of manifest.members) {
    const actual = fileRecord(absolute(record.path));
    assert.deepEqual(actual, record, `Manifest member changed: ${record.path}`);
  }
  for (const record of [finalSeal.manifest, finalSeal.receipt, finalSeal.report, finalSeal.independentFinalReview, finalSeal.phase3DHandoff, finalSeal.preExecutionSeal, finalSeal.failedPreflightAttempt.evidence]) {
    verifyArtifactPin(record);
  }
  assert.deepEqual(manifest.excludes, [manifestRelative, finalSealRelative]);
  assert.deepEqual(manifest.members.find(record => record.path === failedPreflightRelative), fileRecord(absolute(failedPreflightRelative)));
  const expectedPaths = [...manifest.members.map(record => record.path), manifestRelative, finalSealRelative].sort(ordinal);
  assert.equal(new Set(expectedPaths).size, expectedPaths.length);
  return { receipt, handoff, finalReview, manifest, finalSeal, expectedPaths };
}

function finalReporting(commit, repositoryStatus) {
  return {
    stalePinCause: {
      result: 'HISTORICAL_FAILED_SETUP_PRESERVED',
      cause: 'CONTROL_MAP_VS_CONTROL_RESULTS_IDENTITY_FIELD_TRANSPOSITION',
      oldExpectedSha256: 'sha256:9131759b75fc9407fd25467ef7656b0d6948711daecdf58234f1c4b09f9b9433',
      failedPreflightEvidence: failedPreflightRelative,
      controlsExecuted: 0,
      certificationClaims: 0,
    },
    verifiedControlMapIdentity: {
      result: 'PASS',
      path: historicalControlMapRelative,
      historicalSourceCommit: HISTORICAL_PHASE3C,
      byteLength: 530142,
      sha256: 'sha256:0c490f5d4afa76b673c64d320308a2d1ca841a4330072b532964b0054d027131',
      gitBlob: 'bf6bbaeb118fcfc38384530cee3d2942ac39fc47',
    },
    correctedPin: {
      result: 'PASS',
      sha256: 'sha256:0c490f5d4afa76b673c64d320308a2d1ca841a4330072b532964b0054d027131',
      toolingOnly: true,
      objectBytesChanged: false,
      selectionChanged: false,
    },
    zeroExecutionPreflightResult: {
      result: 'PASS', freshAccounted: 89, reuseAccounted: 462, candidateSpecificAccounted: 2,
      omissions: 0, exactIdDuplicates: 0, selectedReuseOverlap: 0, productExecutions: 0, securityExecutions: 0,
    },
    candidateIdentity: { worktree: EXPECTED_ROOT, branch: BRANCH, role: 'C3TB', commit: C3TB, tree: C3TB_TREE, productionCommit: C3T, productionTree: PRODUCTION_TREE, helperSha256: HELPER_SHA256 },
    finalFreshControlCount: 89,
    finalReuseCount: 462,
    controlsMovedFromReuseToFresh: {
      count: 0,
      ids: [],
      freshExecutedSupportingOnlyCount: 4,
      freshExecutedSupportingOnlyIds: expectedFreshExecutedReuseSupport.map(row => row.id),
      certificationDisposition: 'REUSED_EXACT',
      freshOutcomesSubstituteForReuseProof: false,
    },
    deadlineTimeoutResults: { result: 'PASS', helperMs: 8000, success: '< 8000 ms', timeout: '>= 8000 ms', historicalH: 'NOT_ESTABLISHED' },
    headlessStartupResults: { result: 'PASS', nativeSmoke: 1, securityCases: 19 },
    filesystemNativeResults: { result: 'PASS', equivalenceCases: 67, nativeLastErrorMetadataCases: 1, createFileWSetLastError: true, missingLeafWitness: { caseId: 'missing-file', code: 'MO1307_INPUT', exactResponseEqual: true } },
    toctouResults: { result: 'PASS', cases: 2 },
    protocolEquivalenceResults: { result: 'PASS', protocolCases: 12, equivalenceCases: 67 },
    cleanupTopology: { result: 'PASS', remainingOwnedProcesses: 0, helperWorkerExclusion: true, quiescenceRequired: true },
    sourceSecurityReview: { result: 'PASS', reviews: 12 },
    governanceSeparation: { result: 'PASS', phase3AR2Executed: false, acceptedPhase3BR2: ACCEPTED_PHASE3BR2, phase3BR2Rerun: false, phase3BR2Modified: false, phase3DExecuted: false, releaseAuthorized: false },
    candidateBinding: { result: 'PASS', candidate: C3TB, productionChangesInBindingCommit: false },
    refreshReceipt: receiptRelative,
    status: 'PHASE3CR2_ACCEPTED',
    commit,
    repositoryStatus,
    phase3DHandoff: handoffRelative,
  };
}

function verifyStaged() {
  assertCommonAnchors();
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);
  const artifacts = loadFinalArtifacts();
  const staged = gitBytes(['diff', '--cached', '--name-only', '-z']).toString('utf8').split('\0').filter(Boolean).sort(ordinal);
  assert.deepEqual(staged, artifacts.expectedPaths);
  assert.equal(gitText(['diff', '--name-only']), '');
  assert.equal(gitText(['diff', '--cached', '--name-only', '--', productRelative]), '');
  const status = statusEntries();
  assert.equal(status.length, artifacts.expectedPaths.length);
  assert.deepEqual(status.map(entry => entry.path).sort(ordinal), artifacts.expectedPaths);
  assert.equal(status.every(entry => entry.status === 'A '), true, 'Every refresh path must be staged as a new file.');
  for (const relative of artifacts.expectedPaths) {
    const entry = gitText(['ls-files', '--stage', '--', relative]);
    const match = /^100644 ([0-9a-f]{40}) 0\t/u.exec(entry);
    assert.ok(match, `Not a staged regular file: ${relative}`);
    assert.equal(match[1], gitBlob(fs.readFileSync(absolute(relative))), `Staged bytes differ: ${relative}`);
  }
  run(GIT, ['-c', 'core.longpaths=true', '-c', `safe.directory=${slash(path.resolve(root))}`, 'diff', '--cached', '--check']);
  process.stdout.write(`${canonical({
    mode: '--verify-staged',
    result: 'PASS_STAGED_REFRESH',
    files: artifacts.expectedPaths.length,
    productionChanged: false,
    finalReporting: finalReporting('PENDING_CONTAINING_REFRESH_COMMIT', 'STAGED_PHASE3CR2_ONLY'),
  })}\n`);
}

function verifyCommitted() {
  assertCommonAnchors();
  const artifacts = loadFinalArtifacts();
  const head = gitText(['rev-parse', 'HEAD']);
  assert.notEqual(head, C3TB);
  assert.equal(gitText(['show', '-s', '--format=%P', head]), C3TB);
  assert.equal(gitText(['rev-list', '--parents', '-n', '1', head]).split(' ').length, 2);
  const changed = gitBytes(['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', head])
    .toString('utf8').split('\0').filter(Boolean).sort(ordinal);
  assert.deepEqual(changed, artifacts.expectedPaths);
  assert.equal(gitText(['rev-parse', `${head}:${productRelative}`]), PRODUCTION_TREE);
  assert.equal(gitText(['diff', '--name-only', C3TB, head, '--', productRelative]), '');
  for (const relative of artifacts.expectedPaths) {
    assert.equal(gitText(['rev-parse', `${head}:${relative}`]), gitBlob(fs.readFileSync(absolute(relative))), `Committed bytes differ: ${relative}`);
  }
  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all']), '');
  run(GIT, ['-c', 'core.longpaths=true', '-c', `safe.directory=${slash(path.resolve(root))}`, 'show', '--format=', '--check', head]);
  process.stdout.write(`${canonical({
    mode: '--verify-committed',
    result: 'PHASE3CR2_ACCEPTED',
    commit: head,
    subject: gitText(['show', '-s', '--format=%s', head]),
    branch: BRANCH,
    files: artifacts.expectedPaths.length,
    productionChanged: false,
    finalReporting: finalReporting(head, 'CLEAN'),
    receipt: pin(receiptRelative),
    finalSeal: pin(finalSealRelative),
    phase3DHandoff: pin(handoffRelative),
  })}\n`);
}

function writeFinal() {
  assertCommonAnchors();
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);
  const initialStatus = assertAllowedWriteState();
  assert.equal(fs.existsSync(evidenceRoot), true, 'Preflight/campaign evidence directory is missing.');
  assert.equal(fs.lstatSync(evidenceRoot).isDirectory(), true);
  assert.equal(fs.existsSync(path.dirname(reportPath)), true, 'Repository documentation directory is missing.');
  const outputRelatives = [reportRelative, finalReviewRelative, receiptRelative, handoffRelative, manifestRelative, finalSealRelative];
  for (const relative of outputRelatives) assert.equal(fs.existsSync(absolute(relative)), false, `Refusing overwrite: ${relative}`);

  const plan = readJson(planRelative);
  const preSeal = readJson(preSealRelative);
  const failedPreflight = readJson(failedPreflightRelative);
  const planPin = pin(planRelative);
  const preSealPin = pin(preSealRelative);
  const failedPreflightPin = pin(failedPreflightRelative);
  const failedPreflightFileRecord = fileRecord(absolute(failedPreflightRelative));
  const failedPreflightSummary = {
    status: 'FAILED_SETUP',
    result: 'FAIL',
    outcome: 'PHASE3CR2_FAILED_INCOMPLETE',
    resumable: false,
    controlsExecuted: 0,
    certificationClaims: 0,
    rewrittenAsPass: false,
    evidence: failedPreflightPin,
  };
  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBCampaignPlan');
  assert.equal(plan.status, 'SEALED_NOT_EXECUTED');
  assert.equal(preSeal.kind, 'MO1307Phase3CR2C3TBPreExecutionSeal');
  assert.equal(preSeal.result, 'SEALED_NOT_EXECUTED');
  assert.deepEqual(preSeal.campaignPlan, planPin);
  assert.deepEqual(preSeal.candidate, plan.candidate);
  assert.deepEqual(preSeal.generation, plan.generation);
  assert.deepEqual(preSeal.priorFailedPreflight, plan.priorFailedPreflight);
  assert.deepEqual(preSeal.pinCorrection, plan.pinCorrection);
  assert.deepEqual(preSeal.zeroExecutionPreflight, plan.zeroExecutionPreflight);
  assert.deepEqual(plan.generation, {
    mode: 'FRESH_AFTER_FAILED_PREFLIGHT',
    preflightAttempt: 2,
    resumesPriorAttempt: false,
    priorAttempt: { status: 'FAILED_SETUP', outcome: 'PHASE3CR2_FAILED_INCOMPLETE', resumable: false, evidence: failedPreflightFileRecord },
  });
  assert.deepEqual(plan.priorFailedPreflight, { evidence: failedPreflightFileRecord, record: failedPreflight });
  assert.equal(failedPreflight.kind, 'MO1307Phase3CR2C3TBFailedPreflightHistory');
  assert.equal(failedPreflight.status, 'FAILED_SETUP');
  assert.equal(failedPreflight.result, 'FAIL');
  assert.equal(failedPreflight.outcome, 'PHASE3CR2_FAILED_INCOMPLETE');
  assert.equal(failedPreflight.recordedRetrospectively, true);
  assert.equal(failedPreflight.previousStopRewrittenAsPass, false);
  assert.equal(failedPreflight.resumable, false);
  assert.equal(failedPreflight.controlMap.oldExpectedSha256, 'sha256:9131759b75fc9407fd25467ef7656b0d6948711daecdf58234f1c4b09f9b9433');
  assert.deepEqual(failedPreflight.controlMap.actual, { byteLength: 530142, sha256: 'sha256:0c490f5d4afa76b673c64d320308a2d1ca841a4330072b532964b0054d027131', gitBlob: 'bf6bbaeb118fcfc38384530cee3d2942ac39fc47' });
  assert.equal(failedPreflight.misboundDigestSource.sha256, failedPreflight.controlMap.oldExpectedSha256);
  assert.equal(failedPreflight.misboundDigestSource.gitBlob, '50551f4cde0c1f5107126f9459c8b4e447226dfd');
  assert.deepEqual(failedPreflight.execution, { campaignExecutionStarted: false, freshControlsSelected: 89, freshControlsExecuted: 0, reuseCandidates: 462, reuseControlsCertified: 0, candidateSpecificControlsSelected: 2, candidateSpecificControls: 'NOT_RUN', certificationClaims: 0 });
  assert.deepEqual(failedPreflight.claims, []);
  assert.equal(plan.pinCorrection.result, 'PASS');
  assert.equal(plan.pinCorrection.scope, 'CERTIFICATION_TOOLING_IDENTITY_PIN_ONLY');
  assert.equal(plan.pinCorrection.oldExpectedSha256, failedPreflight.controlMap.oldExpectedSha256);
  assert.equal(plan.pinCorrection.correctedExpectedSha256, failedPreflight.controlMap.actual.sha256);
  assert.equal(plan.pinCorrection.objectBytesChanged, false);
  assert.equal(plan.pinCorrection.controlIdsChanged, false);
  assert.equal(plan.pinCorrection.expectedOutcomesChanged, false);
  assert.equal(plan.pinCorrection.selectionChanged, false);
  assert.equal(plan.pinCorrection.dependencyMappingsChanged, false);
  assert.deepEqual(plan.pinCorrection.historicalControlMap, gitRecord(HISTORICAL_PHASE3C, historicalControlMapRelative));
  assert.deepEqual(plan.pinCorrection.staleExpectedResolvedTo, gitRecord(HISTORICAL_PHASE3C, historicalControlResultsRelative));
  assert.deepEqual(plan.zeroExecutionPreflight, { result: 'PASS', historicalControlMapIdentity: 'PASS', acceptedPhase3CAuthorityChain: 'PASS', c3tbIdentity: 'PASS', productionTreeIdentity: 'PASS', helperIdentity: 'PASS', refreshMapCardinality: 'PASS', selectedFreshHistoricalControls: { expected: 89, accounted: 89 }, dependencyReuseCandidates: { expected: 462, accounted: 462 }, candidateSpecificControls: { expected: 2, accounted: 2 }, historicalInventory: { expected: 551, accounted: 551 }, exactIdDuplicates: 0, caseSensitiveControlIds: true, caseFoldDistinctAuthorityPairCount: 1, selectedReuseOverlap: 0, omissions: 0, productExecutions: 0, securityExecutions: 0, certificationClaims: 0 });
  assert.equal(plan.candidate.commit, C3TB);
  assert.equal(plan.candidate.tree, C3TB_TREE);
  assert.equal(plan.candidate.soleParent, C3T);
  assert.equal(plan.candidate.implementation.commit, C3T);
  assert.equal(plan.candidate.implementation.tree, C3T_TREE);
  assert.equal(plan.candidate.implementation.parent, C3T_PARENT);
  assert.equal(plan.candidate.productionTree, PRODUCTION_TREE);
  assert.equal(plan.candidate.helper.sha256, HELPER_SHA256);
  assert.equal(plan.historicalAccepted.commit, HISTORICAL_PHASE3C);
  assert.equal(plan.historicalAccepted.commitTree, HISTORICAL_PHASE3C_TREE);
  assert.equal(plan.historicalAccepted.soleParent, C3RB);
  assert.equal(plan.historicalAccepted.candidateTree, C3RB_TREE);
  assert.equal(plan.historicalAccepted.promoted, false);
  assert.equal(plan.historicalAccepted.appliesOnlyTo, 'C3RB');
  assert.deepEqual(plan.limits, { ...expectedLimits, success: 'elapsedMs < 8000', timeout: 'elapsedMs >= 8000', H: 'NOT_ESTABLISHED' });
  assert.deepEqual(plan.accounting.historical, {
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
    selectedBySuite: plan.accounting.historical.selectedBySuite,
    reuseBySuite: plan.accounting.historical.reuseBySuite,
  });
  assert.deepEqual(plan.accounting.historical.selectedBySuite, {
    'deadline-cleanup': { controls: 7, rejections: 6, behavioral: 1 },
    equivalence: { controls: 67, rejections: 55, behavioral: 12 },
    protocol: { controls: 12, rejections: 11, behavioral: 1 },
    'runtime-main': { controls: 1, rejections: 0, behavioral: 1 },
    toctou: { controls: 2, rejections: 2, behavioral: 0 },
  });
  assert.deepEqual(plan.accounting.historical.reuseBySuite, {
    'deadline-cleanup': { controls: 4, rejections: 3, behavioral: 1 },
    'governance-primary': { controls: 97, rejections: 59, behavioral: 38 },
    'governance-supplement': { controls: 18, rejections: 12, behavioral: 6 },
    root: { controls: 157, rejections: 114, behavioral: 43 },
    'runtime-main': { controls: 75, rejections: 71, behavioral: 4 },
    'runtime-supplement': { controls: 15, rejections: 6, behavioral: 9 },
    'trust-graph': { controls: 96, rejections: 87, behavioral: 9 },
  });
  assert.deepEqual(plan.accounting.candidateSpecificSupplementalControls, { count: 2, ids: [...expectedSupplemental] });
  assert.deepEqual(plan.accounting.headlessCorrectionCases, { count: 19, ids: [...expectedHeadless] });
  assert.deepEqual(plan.accounting.requiredSourceAndSecurityReviews, { count: 12, ids: [...expectedReviews] });
  assert.equal(plan.accounting.axesRemainSeparate, true);
  assert.equal(plan.accounting.flatAggregateControlCountNotAsserted, true);
  assert.equal(plan.executionPolicy.retries, 0);
  assert.equal(plan.executionPolicy.inCampaignRepair, false);
  assert.equal(plan.executionPolicy.adaptiveExpansion, false);
  assert.equal(plan.executionPolicy.firstMandatoryFailureStopsGeneration, true);
  assert.equal(plan.executionPolicy.dependencyReuseRequiresFieldLevelEquality, true);
  assert.deepEqual(plan.stageOrder, [
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
  ]);
  assert.equal(plan.officialBindingCheck.result, 'PASS');
  assert.equal(plan.officialBindingCheck.runtime.version, EXPECTED_NODE_VERSION);
  assert.equal(path.resolve(plan.officialBindingCheck.runtime.executable).toLowerCase(), absolute(RUNTIME_RELATIVE).toLowerCase());
  assert.equal(plan.officialBindingCheck.runtime.byteLength, 93580104);
  assert.equal(plan.officialBindingCheck.runtime.sha256, EXPECTED_NODE_SHA256);
  assert.equal(plan.officialBindingCheck.stdout.parsed.result, 'PASS');
  assert.equal(plan.officialBindingCheck.stdout.parsed.mode, 'check');
  assert.equal(plan.officialBindingCheck.stdout.parsed.candidateCommit, C3T);
  assert.equal(plan.officialBindingCheck.stdout.parsed.candidateRootTree, C3T_TREE);
  assert.equal(plan.officialBindingCheck.stdout.parsed.productionTree, PRODUCTION_TREE);
  assert.equal(plan.officialBindingCheck.stdout.parsed.packageMembers, 89);
  assert.equal(plan.officialBindingCheck.stdout.parsed.productionChangesInBindingCommit, false);
  assert.equal(plan.prohibitions.productChange, false);
  assert.equal(plan.prohibitions.phase3A, false);
  assert.equal(plan.prohibitions.phase3B, false);
  assert.equal(plan.prohibitions.phase3D, false);
  assert.equal(plan.prohibitions.networkAcquisition, false);
  assert.equal(plan.prohibitions.hostedProviders, false);
  assert.equal(plan.prohibitions.push, false);
  assert.equal(plan.prohibitions.tag, false);

  const currentToolInputs = walkFiles(toolRoot);
  assert.deepEqual(currentToolInputs, plan.finalizedToolInputs, 'Finalized campaign tools changed after preflight.');
  assert.deepEqual(currentToolInputs, preSeal.finalizedToolInputs);
  assert.equal(currentToolInputs.length, plan.finalizedToolInputCount);
  assert.equal(sha256(canonicalBytes(currentToolInputs)), plan.finalizedToolSetDigest);
  assert.equal(currentToolInputs.some(record => record.path === `${toolRelative}/finalize.mjs`), true, 'Preflight did not seal finalize.mjs.');

  const runtimeRecord = pin(RUNTIME_RELATIVE);
  assertRecord(runtimeRecord, { byteLength: 93580104, sha256: EXPECTED_NODE_SHA256 }, 'provisioned runtime');
  const executionStart = readJson(executionStartRelative);
  const executionStartPin = pin(executionStartRelative);
  const executionLedger = readJson(executionLedgerRelative);
  const executionLedgerPin = pin(executionLedgerRelative);
  assert.equal(executionStart.kind, 'MO1307Phase3CR2C3TBExecutionStart');
  assert.equal(executionStart.version, '1.0.0');
  assert.deepEqual(executionStart.candidate, plan.candidate);
  assert.deepEqual(executionStart.generation, plan.generation);
  assert.deepEqual(executionStart.preflight, {
    campaignPlan: planPin,
    seal: preSealPin,
    failedPreflightEvidence: failedPreflightFileRecord,
    pinCorrection: plan.pinCorrection,
    zeroExecution: plan.zeroExecutionPreflight,
    finalizedToolSetDigest: preSeal.finalizedToolSetDigest,
  });
  assert.deepEqual(executionStart.runtime, runtimeRecord);
  assert.deepEqual(executionStart.policy, { once: true, retries: 0, ordered: true, stopOnFirstMandatoryFailure: true });
  assert.deepEqual(executionStart.stages.map(row => row.id), [...expectedStages]);
  assert.equal(executionStart.stages.every(row => row.status === 'NOT_RUN'), true);
  assert.equal(executionStart.stages.every((row, index) => row.ordinal === index + 1), true);

  assert.equal(executionLedger.kind, 'MO1307Phase3CR2C3TBExecutionLedger');
  assert.equal(executionLedger.version, '1.0.0');
  assert.deepEqual(executionLedger.candidate, plan.candidate);
  assert.deepEqual(executionLedger.generation, plan.generation);
  assert.deepEqual(executionLedger.preflight, executionStart.preflight);
  assert.deepEqual(executionLedger.runtime, runtimeRecord);
  assert.equal(executionLedger.startedAt, executionStart.startedAt);
  assert.equal(executionLedger.result, 'EXECUTION_PASSED_PENDING_INDEPENDENT_FINAL_REVIEW_AND_SEAL');
  assert.equal(executionLedger.firstFailure, null);
  assert.deepEqual(executionLedger.stages.map(row => row.id), [...expectedStages]);
  assert.equal(executionLedger.stages.every(row => row.status === 'PASS'), true);
  assert.equal(executionLedger.stages.every((row, index) => row.ordinal === index + 1 && row.mandatory === true), true);
  for (const stage of executionLedger.stages) {
    assert.deepEqual(stage.expected, { exitCode: 0, signal: null, mandatoryOutcome: 'PASS' });
    assert.deepEqual(stage.actual, { code: 0, signal: null, error: null });
    verifyArtifactPin(stage.stdout);
    verifyArtifactPin(stage.stderr);
    verifyArtifactPin(stage.resultRecord);
  }

  const refreshMapRecord = gitRecord(C3TB, mapRelative);
  assertRecord(refreshMapRecord, {
    byteLength: 21293,
    sha256: 'sha256:ada9532c868c69d7b6b951535f8f4a501c728a24057da6423308d5540192c16b',
    gitBlob: '863cd3d67d52ca2118f5de42b497db5f03279b03',
  }, 'refresh map');
  assert.deepEqual(plan.authority.selection, refreshMapRecord);
  assert.deepEqual(preSeal.selectionMap, refreshMapRecord);
  const refreshMap = gitJson(C3TB, mapRelative);
  assert.equal(refreshMap.status, 'PENDING_SEPARATE_EXECUTION');
  assert.equal(refreshMap.consumeRule, 'EXACT_C3TB_HEAD_AFTER_BINDING_VERIFICATION');
  assert.deepEqual(refreshMap.accounting, {
    dependencyReuseCandidates: 462,
    historicalInventory: 551,
    omitted: 0,
    selectedFreshHistoricalControls: 89,
  });
  assert.equal(refreshMap.selectedHistoricalIds.length, 89);
  assert.equal(refreshMap.dependencyReuseIds.length, 462);
  assert.equal(new Set(refreshMap.selectedHistoricalIds).size, 89);
  assert.equal(new Set(refreshMap.dependencyReuseIds).size, 462);
  assert.deepEqual(refreshMap.candidateSpecificSupplementalControls, [...expectedSupplemental]);
  assert.deepEqual(refreshMap.additionalHeadlessCases, [...expectedHeadless]);
  assert.deepEqual(refreshMap.requiredSourceAndSecurityReviews, [...expectedReviews]);

  const historicalReceiptRecord = gitRecord(HISTORICAL_PHASE3C, historicalReceiptRelative);
  assertRecord(historicalReceiptRecord, {
    byteLength: 9782,
    sha256: 'sha256:015888bc3cf2b78daebfc050d1563fc5cb33f5ce97f1c0cfb85f36061f923039',
    gitBlob: '84fd131988b662d04d63470e1038b18743ed2d71',
  }, 'historical receipt');
  const historicalReceipt = gitJson(HISTORICAL_PHASE3C, historicalReceiptRelative);
  assert.equal(historicalReceipt.result, 'PASS');
  assert.equal(historicalReceipt.phase3C, 'ACCEPTED');
  assert.equal(historicalReceipt.accepted, true);
  assert.equal(historicalReceipt.candidate, C3RB);
  assert.equal(historicalReceipt.candidateTree, C3RB_TREE);
  assert.equal(historicalReceipt.controls.primary, 551);
  assert.equal(historicalReceipt.controls.rejections, 426);
  assert.equal(historicalReceipt.controls.passFresh, 551);
  assert.deepEqual(historicalReceipt.priorFailedGenerations, [
    {
      root: 'C:/m7c',
      commit: '2fe26d371a394f631d0d1d25d979bfaba7265015',
      files: 57,
      status: 'CLEAN',
      byteIdentical: true,
      receiptRewritten: false,
    },
    {
      root: 'C:/m7c2',
      commit: 'f35dfcbfa99691eda26a9668e43e07914a83df8d',
      files: 97,
      status: 'CLEAN',
      byteIdentical: true,
      receiptRewritten: false,
    },
  ]);
  const priorFailedGenerationRefs = historicalReceipt.priorFailedGenerations.map(record => {
    assert.equal(gitText(['cat-file', '-t', record.commit]), 'commit');
    assert.equal(gitText(['show', '-s', '--format=%P', record.commit]), C3RB);
    const tree = gitText(['show', '-s', '--format=%T', record.commit]);
    const expectedTree = record.commit === '2fe26d371a394f631d0d1d25d979bfaba7265015'
      ? 'afa432f7eb9d9b77178ef2b7434bc55df815e62e'
      : '702b166543e37ba4b8ddf492330cddbf3969e6b9';
    assert.equal(tree, expectedTree);
    return {
      ...record,
      immutableGitObject: true,
      tree,
      soleParent: C3RB,
      subject: gitText(['show', '-s', '--format=%s', record.commit]),
    };
  });

  const historicalControlMap = gitJson(HISTORICAL_PHASE3C, historicalControlMapRelative);
  assert.equal(historicalControlMap.rows.length, 551);
  const historicalIds = historicalControlMap.rows.map(row => row.id);
  assert.equal(new Set(historicalIds).size, 551);
  assert.equal(new Set(historicalIds.map(id => id.toLowerCase())).size, 550);
  const selectedSet = new Set(refreshMap.selectedHistoricalIds);
  const reuseSet = new Set(refreshMap.dependencyReuseIds);
  for (const id of selectedSet) {
    assert.equal(reuseSet.has(id), false, `Selected/reuse overlap: ${id}`);
    assert.equal(historicalIds.includes(id), true, `Unknown selected ID: ${id}`);
  }
  for (const id of reuseSet) assert.equal(historicalIds.includes(id), true, `Unknown reuse ID: ${id}`);
  assert.equal(new Set([...selectedSet, ...reuseSet]).size, 551);

  const reuse = readJson(reuseRelative);
  const reusePin = pin(reuseRelative);
  assert.equal(reuse.kind, 'MO1307Phase3CR2DependencyReuse');
  assert.equal(reuse.result, 'PASS');
  assert.equal(reuse.candidateRole, 'C3TB');
  assert.equal(reuse.candidate, C3TB);
  assert.equal(reuse.candidateImplementation, C3T);
  assert.equal(reuse.historicalAcceptedPhase3C, HISTORICAL_PHASE3C);
  assert.equal(reuse.counts.historicalInventory, 551);
  assert.equal(reuse.counts.selectedFreshHistoricalControls, 89);
  assert.equal(reuse.counts.reusedHistoricalControls, 462);
  assert.equal(reuse.counts.candidateSpecificSupplementalControls, 2);
  assert.equal(reuse.counts.omittedHistoricalControls, 0);
  assert.equal(reuse.counts.reusedNegativeControls, 352);
  assert.equal(reuse.rows.length, 462);
  assert.equal(new Set(reuse.rows.map(row => row.id)).size, 462);
  assert.deepEqual(new Set(reuse.rows.map(row => row.id)), reuseSet);
  assert.equal(reuse.rows.every(row => row.disposition === 'REUSED_EXACT'), true);
  assert.equal(reuse.rows.every(row => row.equalityProof.allExercisedFacetsEqual === true), true);
  assert.equal(reuse.rows.every(row => row.historicalAuthority.result === 'PASS_FRESH'), true);
  assert.equal(reuse.rows.every(row => row.historicalAuthority.receiptCaseResult === 'PASS'), true);
  assert.equal(reuse.accounting.exactOrdinalPartition, true);
  assert.equal(reuse.accounting.selectedAndReuseDisjoint, true);
  assert.equal(reuse.accounting.selectedIdsNeverReused, true);
  assert.equal(reuse.accounting.fieldLevelEqualityRequired, true);
  assert.equal(reuse.accounting.nameInclusionAloneAccepted, false);
  assert.equal(reuse.certificationExecuted, false);
  assert.equal(reuse.productionExecuted, false);
  assert.equal(reuse.helperExecuted, false);
  assert.equal(reuse.networkUsed, false);
  assert.equal(reuse.push, false);
  assert.equal(reuse.tag, false);

  const deadline = readJson(deadlineRelative);
  const deadlinePin = pin(deadlineRelative);
  assert.equal(deadline.kind, 'MO1307Phase3CR2RefreshDeadlineEnvironmentReceipt');
  assert.equal(deadline.result, 'PASS');
  assert.equal(deadline.failure, null);
  assertPassRows(deadline.cases, 'id', 18, 'deadline/supporting witnesses');
  assertPassedCaseAccounting(deadline.caseAccounting, deadline.cases.map(row => row.id), 18, 'deadline/supporting witnesses');
  assert.equal(deadline.productionChanged, false);
  assertReferenceProvenance(deadline.referenceProvenance, 'deadline');
  assert.equal(deadline.runtime.version, EXPECTED_NODE_VERSION);
  assert.deepEqual(deadline.authority, {
    identity: 'PROSPECTIVE_HELPER_BOUND@1.0.0',
    historicalH: 'NOT_ESTABLISHED',
    success: 'elapsedMs < 8000',
    timeout: 'elapsedMs >= 8000',
  });
  assert.deepEqual(deadline.limits, {
    helperMs: 8000,
    aggregateHelperActiveMs: 20000,
    cliMs: 30000,
    apiWorkerMs: 10000,
    cleanupMs: 2000,
  });
  const deadlineClosure = readJson(deadlineClosureRelative);
  const deadlineClosurePin = pin(deadlineClosureRelative);
  assert.equal(deadlineClosure.result, 'PASS');
  assert.equal(deadlineClosure.sourceUnchanged, true);
  assert.equal(deadlineClosure.observerExit, 0);
  assert.deepEqual(deadlineClosure.remainingOwnedProcesses, []);
  assert.equal(deadlineClosure.nativeCoverage.every(row => row.closed && row.streamsClosed), true);
  const requiredObservedNativeNames = ['timeout-exact-mapping', 'late-native-success-refused', 'crash-closed-transport'];
  assert.deepEqual(deadlineClosure.requiredObserved.map(row => row.name), requiredObservedNativeNames);
  assert.equal(deadlineClosure.requiredObserved.every(row => row.seen && row.closed && row.streamsClosed), true);
  for (const observed of deadlineClosure.requiredObserved) {
    const launched = deadlineClosure.nativeCoverage.find(row => row.name === observed.name);
    assert.ok(launched, `Missing required native process: ${observed.name}`);
    assert.deepEqual(observed, {
      name: launched.name,
      pid: launched.pid,
      seen: launched.seen,
      closed: launched.closed,
      streamsClosed: launched.streamsClosed,
    });
  }
  assert.equal(deadlineClosure.observedNativeProcessCount, deadlineClosure.nativeCoverage.filter(row => row.seen).length);
  assert.ok(deadlineClosure.observedNativeProcessCount > 0, 'External CIM observer saw no native process.');
  const freshExecutedReuseSupport = expectedFreshExecutedReuseSupport.map(expected => {
    const control = historicalControlMap.rows.find(row => row.id === expected.id);
    assert.ok(control, `Missing historical supporting-only control: ${expected.id}`);
    assert.equal(control.suite, 'deadline-cleanup');
    assert.equal(control.caseId, expected.caseId);
    assert.equal(control.negative, expected.negative);
    assert.equal(reuseSet.has(expected.id), true, `${expected.id} must remain dependency reuse.`);
    assert.equal(selectedSet.has(expected.id), false, `${expected.id} must not enter the selected-fresh set.`);
    const reuseProof = reuse.rows.find(row => row.id === expected.id);
    assert.ok(reuseProof, `Missing dependency-reuse proof: ${expected.id}`);
    assert.equal(reuseProof.disposition, 'REUSED_EXACT');
    assert.equal(reuseProof.equalityProof.allExercisedFacetsEqual, true);
    assert.equal(reuseProof.historicalAuthority.result, 'PASS_FRESH');
    const witness = deadline.cases.find(row => row.id === expected.caseId);
    assert.ok(witness, `Missing supporting-only fresh witness: ${expected.caseId}`);
    assert.equal(witness.result, 'PASS');
    return {
      historicalControlId: expected.id,
      caseId: expected.caseId,
      negative: expected.negative,
      freshWitnessResult: 'PASS_SUPPORTING_ONLY',
      certificationDisposition: 'REUSED_EXACT',
      dependencyReuseAuthority: reusePin,
      freshWitnessAuthority: deadlinePin,
      freshOutcomeSubstitutedForReuseProof: false,
    };
  });

  const equivalence = readJson(equivalenceRelative);
  const equivalencePin = pin(equivalenceRelative);
  assert.equal(equivalence.kind, 'MO1307ReadSetEquivalence');
  assert.equal(equivalence.result, 'PASS');
  assert.equal(equivalence.failure, null);
  assert.equal(equivalence.candidate, C3TB);
  assert.equal(equivalence.expectedCases, 69);
  assertPassRows(equivalence.cases, 'name', 69, 'equivalence');
  assertPassedCaseAccounting(equivalence.caseAccounting, equivalence.cases.map(row => row.name), 69, 'equivalence');
  assert.deepEqual(
    equivalence.cases.filter(row => ['ordinary-native-counters', 'mo1306-native-counters'].includes(row.name)).map(row => row.name).sort(ordinal),
    ['mo1306-native-counters', 'ordinary-native-counters'],
  );
  assert.equal(equivalence.exactFramesCompared, true);
  assert.equal(equivalence.productHooksAdded, false);
  assert.equal(equivalence.noSourceWorktreeWrites, true);
  assert.equal(equivalence.network, false);
  assertReferenceProvenance(equivalence.referenceProvenance, 'equivalence');
  const missingLeafWitness = equivalence.cases.find(row => row.name === 'missing-file');
  assert.ok(missingLeafWitness, 'Exact missing-leaf behavioral witness is missing.');
  assert.equal(missingLeafWitness.result, 'PASS');
  assert.equal(missingLeafWitness.exactResponseEqual, true);
  assert.equal(missingLeafWitness.code, 'MO1307_INPUT');
  assert.equal(missingLeafWitness.status, 'ERROR');

  const nativeLastError = readJson(nativeLastErrorRelative);
  const nativeLastErrorPin = pin(nativeLastErrorRelative);
  assert.equal(nativeLastError.kind, 'MO1307Phase3CR2NativeLastErrorReceipt');
  assert.equal(nativeLastError.version, '1.0.0');
  assert.equal(nativeLastError.result, 'PASS');
  assert.equal(nativeLastError.failure, null);
  assert.equal(nativeLastError.candidate, C3TB);
  assert.equal(nativeLastError.candidateTree, C3TB_TREE);
  assert.equal(nativeLastError.implementation, C3T);
  assert.equal(nativeLastError.productionTree, PRODUCTION_TREE);
  assert.equal(nativeLastError.count, 1);
  assertPassedCaseAccounting(nativeLastError.caseAccounting, ['createfile-setlasterror-effective-metadata-and-source-semantics'], 1, 'native last-error metadata/source semantics');
  assert.deepEqual(nativeLastError.source, { path: helperRelative, byteLength: 29153, sha256: HELPER_SHA256 });
  assert.deepEqual(nativeLastError.sourceGit, { commit: C3TB, blob: '7ca55b8713108465099ecfce9796e06e3db67bd2' });
  verifyArtifactPin(nativeLastError.driver);
  assert.deepEqual(nativeLastError.runtime.node, runtimeRecord);
  const expectedPowerShell = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
  assert.equal(path.resolve(root, nativeLastError.runtime.powershell.path).toLowerCase(), path.resolve(expectedPowerShell).toLowerCase());
  const powerShellBytes = fs.readFileSync(expectedPowerShell);
  assert.equal(nativeLastError.runtime.powershell.byteLength, powerShellBytes.length);
  assert.equal(nativeLastError.runtime.powershell.sha256, sha256(powerShellBytes));
  verifyArtifactPin(nativeLastError.generatedScript);
  assert.equal(nativeLastError.metadataProcess.executable, expectedPowerShell);
  assert.equal(nativeLastError.metadataProcess.exit, 0);
  assert.equal(nativeLastError.metadataProcess.signal, null);
  assert.equal(nativeLastError.metadataProcess.error, null);
  assert.equal(nativeLastError.metadataProcess.boundedMs, 10000);
  assert.equal(nativeLastError.metadataProcess.result, 'PASS');
  verifyArtifactPin(nativeLastError.metadataProcess.stdout);
  verifyArtifactPin(nativeLastError.metadataProcess.stderr);
  assert.equal(nativeLastError.metadataProcess.stderr.byteLength, 0);
  assert.equal(nativeLastError.reflectedMethodCount, 8);
  assert.deepEqual(nativeLastError.exactMethodKeys, [...expectedNativeMethodKeys]);
  assert.deepEqual(nativeLastError.metadataProcess.metadata.map(row => row.key), [...expectedNativeMethodKeys]);
  assert.equal(nativeLastError.metadataProcess.metadata.length, 8);
  assert.equal(nativeLastError.exactExpectedMetadata, true);
  assert.deepEqual(nativeLastError.createFileW, {
    key: expectedNativeMethodKeys[0],
    name: 'CreateFileW',
    returnType: 'Microsoft.Win32.SafeHandles.SafeFileHandle',
    parameterTypes: ['System.String', 'System.UInt32', 'System.UInt32', 'System.IntPtr', 'System.UInt32', 'System.UInt32', 'System.IntPtr'],
    library: 'kernel32.dll',
    entryPoint: 'CreateFileW',
    charSet: 3,
    callingConvention: 1,
    preserveSig: true,
    setLastError: true,
    exactSpelling: true,
    pinvokeImpl: true,
    implementationFlags: 128,
  });
  assert.equal(nativeLastError.metadataProcess.metadata.filter(row => row.name !== 'CreateFileW').length, 7);
  assert.equal(nativeLastError.metadataProcess.metadata.filter(row => row.name !== 'CreateFileW').every(row => row.setLastError === false && row.exactSpelling === false), true);
  assert.equal(nativeLastError.otherSevenExpectedUnchangedMetadata, true);
  assert.equal(nativeLastError.sourceAssertions.exactInitializeNativeExtraction, true);
  assert.equal(nativeLastError.sourceAssertions.inertConfirmConsoleQuiescenceStub, true);
  assert.equal(nativeLastError.sourceAssertions.extractedNativeApiInvocations, 0);
  assert.deepEqual(nativeLastError.sourceAssertions.immediateLastErrorCaptureCallSites.map(row => row.function), ['Open-Native', 'Assert-NativeAbsent']);
  assert.equal(nativeLastError.sourceAssertions.immediateLastErrorCaptureCallSites.every(row => row.adjacentPhysicalLines && row.getLastWin32ErrorLine === row.createFileWLine + 1), true);
  assert.equal(nativeLastError.sourceAssertions.allGetLastWin32ErrorCallSitesCovered, true);
  assert.equal(nativeLastError.sourceAssertions.error2Comparisons, 2);
  assert.equal(nativeLastError.sourceAssertions.error2OnlyMissingLeafSemantics, true);
  assert.equal(nativeLastError.sourceAssertions.openNativeMissingInputLeafMapsTo, 'MO1307_INPUT');
  assert.equal(nativeLastError.sourceAssertions.openNativeMissingAncestorMapsTo, 'MO1307_FILESYSTEM_BOUNDARY');
  assert.equal(nativeLastError.sourceAssertions.assertNativeAbsentAcceptsOnlyErrorFileNotFound, true);
  assert.equal(nativeLastError.sourceAssertions.allOtherOpenFailuresMapTo, 'MO1307_FILESYSTEM_BOUNDARY');
  assert.equal(nativeLastError.sourceUnchanged, true);
  assert.equal(nativeLastError.nativeApiInvocations, 0);
  assert.equal(nativeLastError.helperRequests, 0);
  assert.equal(nativeLastError.engineeringMetadataProcesses, 1);
  assert.equal(nativeLastError.retries, 0);
  assert.equal(nativeLastError.certification, false);

  const protocol = readJson(protocolRelative);
  const protocolPin = pin(protocolRelative);
  assert.equal(protocol.kind, 'MO1307Phase3CR2RefreshConsumerProtocol');
  assert.equal(protocol.result, 'PASS');
  assert.equal(protocol.candidate, C3TB);
  assert.equal(protocol.count, 13);
  assert.equal(protocol.negativeCount, 12);
  assertPassRows(protocol.rows, 'id', 13, 'protocol');
  assertPassedCaseAccounting(protocol.caseAccounting, protocol.rows.map(row => row.id), 13, 'protocol');
  assert.equal(protocol.rows.filter(row => row.id === 'cross-session-response-replay').length, 1);

  const toctou = readJson(toctouRelative);
  const toctouPin = pin(toctouRelative);
  assert.equal(toctou.kind, 'MO1307Phase3CR2RefreshAdditionalTOCTOU');
  assert.equal(toctou.result, 'PASS');
  assert.equal(toctou.candidate, C3TB);
  assertPassRows(toctou.rows, 'id', 2, 'TOCTOU');
  assertPassedCaseAccounting(toctou.caseAccounting, toctou.rows.map(row => row.id), 2, 'TOCTOU');
  assert.equal(toctou.rows.every(row => row.negative && row.exactResponseEquivalent), true);
  assertReferenceProvenance(toctou.referenceProvenance, 'TOCTOU');
  const n15ComparatorAuthority = {
    role: 'SEALED_CORRECTED_PRODUCTION_HELPER_COMPARISON_SOURCE',
    commit: N15_REFERENCE_COMMIT,
    sealedArtifact: gitRecord(N15_REFERENCE_COMMIT, N15_REFERENCE_PATH),
    productionSource: gitRecord(N15_REFERENCE_COMMIT, helperRelative),
    retainedAtC3TB: gitRecord(C3TB, N15_REFERENCE_PATH),
    sameGitBlob: true,
    diagnosticEvidencePromoted: false,
  };

  const smoke = readJson(smokeRelative);
  const smokePin = pin(smokeRelative);
  const smokeSeal = readJson(smokeSealRelative);
  const smokeSealPin = pin(smokeSealRelative);
  assert.equal(smoke.kind, 'MO1307Phase3CR2HeadlessSmokeReceipt');
  assert.equal(smoke.result, 'PASS');
  assert.equal(smoke.failure, null);
  assert.equal(smoke.candidateStatus, 'BOUND_C3TB');
  assert.equal(smoke.candidate, C3TB);
  assert.equal(smoke.packageTree, PRODUCTION_TREE);
  assert.equal(smoke.case.result, 'PASS');
  assert.equal(smoke.sourceUnchanged, true);
  assert.equal(smoke.helperInvocations, 1);
  assert.equal(smoke.additionalCasesExecuted, 0);
  assert.equal(smoke.noRetry, true);
  assert.equal(smoke.limitsVerified, true);
  assert.deepEqual(smoke.seal, smokeSealPin);
  assert.equal(smokeSeal.kind, 'MO1307Phase3CR2HeadlessSmokeSeal');
  assert.equal(smokeSeal.candidate, C3TB);
  assert.equal(smokeSeal.productionCandidate, C3T);
  assert.equal(smokeSeal.packageTree, PRODUCTION_TREE);

  const security = readJson(securityRelative);
  const securityPin = pin(securityRelative);
  const securitySeal = readJson(securitySealRelative);
  const securitySealPin = pin(securitySealRelative);
  assert.equal(security.kind, 'MO1307Phase3CR2HeadlessSecurityReceipt');
  assert.equal(security.result, 'PASS');
  assert.equal(security.failure, null);
  assert.equal(security.candidate, C3TB);
  assert.equal(security.productionCandidate, C3T);
  assert.equal(security.productionTree, PRODUCTION_TREE);
  assert.equal(security.candidateStatus, 'BOUND_C3TB');
  assert.equal(security.sourceUnchanged, true);
  assertPassRows(security.rows, 'id', 19, 'headless/security');
  assert.deepEqual(security.rows.map(row => row.id), [...expectedHeadless]);
  assert.deepEqual(security.caseAccounting.map(row => row.id), [...expectedHeadless]);
  assert.equal(security.caseAccounting.every(row => row.result === 'PASS'), true);
  assert.deepEqual(security.allNineteenRequired, [...expectedHeadless]);
  assert.equal(security.newProductHelpers, 0);
  assert.equal(security.noRetry, true);
  assert.deepEqual(security.smoke, smokePin);
  assert.equal(securitySeal.kind, 'MO1307Phase3CR2HeadlessSecuritySeal');
  assert.equal(securitySeal.candidate, C3TB);
  assert.equal(securitySeal.productionCandidate, C3T);
  assert.equal(securitySeal.productionTree, PRODUCTION_TREE);
  assert.equal(securitySeal.newProductHelpers, 0);

  const bindingRecord = gitRecord(C3TB, bindingRelative);
  const bindingVerificationRecord = gitRecord(C3TB, bindingVerificationRelative);
  const binding = gitJson(C3TB, bindingRelative);
  const bindingVerification = gitJson(C3TB, bindingVerificationRelative);
  assert.deepEqual(plan.authority.binding, bindingRecord);
  assert.deepEqual(plan.authority.bindingVerification, bindingVerificationRecord);
  assert.deepEqual(preSeal.binding, bindingRecord);
  assert.deepEqual(preSeal.bindingVerification, bindingVerificationRecord);
  assert.equal(binding.result, 'NEW_PRODUCTION_CANDIDATE_READY_FOR_PHASE3');
  assert.equal(binding.implementation.commit, C3T);
  assert.equal(binding.implementation.rootTree, C3T_TREE);
  assert.equal(binding.implementation.productionTree, PRODUCTION_TREE);
  assert.equal(binding.binding.soleParent, C3T);
  assert.equal(binding.binding.productionChanges, false);
  assert.equal(binding.package.memberCount, 89);
  assert.equal(binding.package.contractMemberCount, 53);
  assert.equal(binding.package.schemaCount, 52);
  assert.deepEqual(binding.limits, expectedLimits);
  assert.equal(bindingVerification.result, 'PASS');
  assert.equal(bindingVerification.candidateCommit, C3T);
  assert.equal(bindingVerification.candidateRootTree, C3T_TREE);
  assert.equal(bindingVerification.productionTree, PRODUCTION_TREE);
  assert.equal(bindingVerification.productionChangesInBindingCommit, false);
  assert.equal(bindingVerification.certificationExecuted, false);

  const freshResults = readJson(freshResultsRelative);
  const freshResultsPin = pin(freshResultsRelative);
  const candidateControls = readJson(candidateControlsRelative);
  const candidateControlsPin = pin(candidateControlsRelative);
  const sourceReviews = readJson(sourceReviewsRelative);
  const sourceReviewsPin = pin(sourceReviewsRelative);
  const supportingCounts = {
    dependencyReuse: 462,
    freshSelectedHistoricalControls: 89,
    freshSelectedNegativeControls: 74,
    freshSelectedHistoricalBySuite: { equivalence: 67, protocol: 12, 'deadline-cleanup': 7, toctou: 2, 'runtime-main': 1 },
    headlessRealHelperInvocations: 1,
    headlessCorrectionCases: 19,
    headlessStartupScenarios: 15,
    rawReceiptCases: { equivalence: 69, protocol: 13, toctou: 2, 'deadline-cleanup': 18 },
    freshExecutionWitnessesIncludingLiveRuntimeSmoke: 103,
    dependentSupportingRawCases: 10,
    freshlyExecutedReuseCandidateWitnesses: 4,
    nativeLastErrorMetadataCases: 1,
    sourceAndSecurityReviews: 12,
    candidateSpecificControls: 2,
  };
  assert.equal(freshResults.kind, 'MO1307Phase3CR2C3TBFreshControlResults');
  assert.equal(freshResults.version, '1.0.0');
  assert.equal(freshResults.result, 'PASS_FRESH_COMPLETE');
  assert.equal(freshResults.candidateRole, 'C3TB');
  assert.equal(freshResults.candidate, C3TB);
  assert.equal(freshResults.candidateImplementation, C3T);
  assert.equal(freshResults.productionTree, PRODUCTION_TREE);
  assert.equal(freshResults.historicalAcceptedPhase3C, HISTORICAL_PHASE3C);
  assert.equal(freshResults.count, 89);
  assert.equal(freshResults.negative, 74);
  assert.deepEqual(freshResults.bySuite, {
    'deadline-cleanup': { controls: 7, negative: 6 },
    equivalence: { controls: 67, negative: 55 },
    protocol: { controls: 12, negative: 11 },
    'runtime-main': { controls: 1, negative: 0 },
    toctou: { controls: 2, negative: 2 },
  });
  assert.equal(freshResults.rows.length, 89);
  assert.equal(new Set(freshResults.rows.map(row => row.id)).size, 89);
  assert.deepEqual(new Set(freshResults.rows.map(row => row.id)), selectedSet);
  assert.equal(freshResults.rows.every(row => row.result === 'PASS_FRESH'), true);
  assert.equal(freshResults.rows.every(row => row.adoptedHistoricalOutcome === false), true);
  assert.deepEqual(freshResults.supportingCounts, supportingCounts);
  assert.equal(freshResults.accounting.selectedIdsOrdinalUnique, true);
  assert.equal(freshResults.accounting.selectedAndReuseDisjoint, true);
  assert.equal(freshResults.accounting.selectedExactMapMatch, true);
  assert.equal(freshResults.accounting.freshOutcomesOnly, true);
  assert.equal(freshResults.accounting.historicalPassReusedForSelected, false);
  assert.equal(freshResults.accounting.selectedNotClassifiedAsReuse, true);
  assert.deepEqual(freshResults.accounting.freshlyExecutedReuseCandidateMappings, expectedFreshExecutedReuseSupport.map(row => ({
    controlId: row.id,
    suite: 'deadline-cleanup',
    caseId: row.caseId,
    freshWitnessResult: 'PASS',
    disposition: 'REUSED_EXACT',
    selectedFreshOutcomeSubstituted: false,
  })));
  assert.equal(freshResults.accounting.freshlyExecutedReuseOutcomesSubstitutedForReuseProof, false);
  assert.deepEqual(freshResults.accounting.nativeLastErrorMetadata, {
    caseId: 'createfile-setlasterror-effective-metadata-and-source-semantics',
    count: 1,
    result: 'PASS',
    historicalControl: false,
  });
  assert.equal(freshResults.accounting.caseSensitiveControlIds, true);
  assert.equal(freshResults.accounting.omittedHistoricalControls, 0);
  assert.deepEqual(freshResults.receiptPins.find(record => record.path === nativeLastErrorRelative), nativeLastErrorPin);
  assert.equal(freshResults.counting, 'The 103 fresh execution witnesses decompose into 89 selected witnesses, 10 dependent supporting raw cases, and 4 freshly executed REUSED_EXACT candidate witnesses whose outcomes do not replace reuse proof. The one native last-error metadata/source-semantic case is separate review evidence, not a historical control.');
  const reconciledMissingLeaf = freshResults.rows.find(row => row.id === 'runtime-boundary:native-missing-input');
  assert.ok(reconciledMissingLeaf, 'Selected missing-leaf control was not reconciled.');
  assert.equal(reconciledMissingLeaf.caseId, 'missing-file');
  assert.equal(reconciledMissingLeaf.suite, 'equivalence');
  assert.equal(reconciledMissingLeaf.negative, true);
  assert.equal(reconciledMissingLeaf.result, 'PASS_FRESH');
  assert.equal(reconciledMissingLeaf.adoptedHistoricalOutcome, false);
  assert.equal(reconciledMissingLeaf.rawWitness.code, 'MO1307_INPUT');
  assert.equal(reconciledMissingLeaf.rawWitness.exactResponseEqual, true);

  assert.equal(candidateControls.kind, 'MO1307Phase3CR2CandidateSpecificControls');
  assert.equal(candidateControls.version, '1.0.0');
  assert.equal(candidateControls.result, 'PASS');
  assert.equal(candidateControls.candidateRole, 'C3TB');
  assert.equal(candidateControls.candidate, C3TB);
  assert.equal(candidateControls.candidateImplementation, C3T);
  assert.equal(candidateControls.productionTree, PRODUCTION_TREE);
  assert.equal(candidateControls.count, 2);
  assert.deepEqual(candidateControls.rows.map(row => row.id), [...expectedSupplemental]);
  assert.equal(candidateControls.rows.every(row => row.result === 'PASS'), true);
  assert.equal(candidateControls.historicalOutcomeAdopted, false);
  assert.deepEqual(candidateControls.supportingCounts, supportingCounts);

  assert.equal(sourceReviews.kind, 'MO1307Phase3CR2SourceSecurityReviews');
  assert.equal(sourceReviews.version, '1.0.0');
  assert.equal(sourceReviews.result, 'PASS');
  assert.equal(sourceReviews.candidateRole, 'C3TB');
  assert.equal(sourceReviews.candidate, C3TB);
  assert.equal(sourceReviews.candidateImplementation, C3T);
  assert.equal(sourceReviews.productionTree, PRODUCTION_TREE);
  assert.equal(sourceReviews.count, 12);
  assert.deepEqual(sourceReviews.rows.map(row => row.id), [...expectedReviews]);
  assert.equal(sourceReviews.rows.every(row => row.result === 'PASS'), true);
  assert.deepEqual(sourceReviews.supportingCounts, supportingCounts);
  assert.deepEqual(sourceReviews.receiptPins.find(record => record.path === nativeLastErrorRelative), nativeLastErrorPin);
  const nativeParityReview = sourceReviews.rows.find(row => row.id === 'NATIVE_API_PARITY');
  assert.ok(nativeParityReview);
  assert.deepEqual(nativeParityReview.findings, {
    equivalenceCases: 69,
    exactFramesCompared: true,
    toctouCases: 2,
    exactTOCTOUResponses: true,
    metadataCaseId: 'createfile-setlasterror-effective-metadata-and-source-semantics',
    reflectedNativeMethods: 8,
    createFileWSetLastError: true,
    createFileWExactSpelling: true,
    otherSevenExpectedUnchangedMetadata: true,
    nativeApiInvocations: 0,
    helperRequests: 0,
    missingLeafWitness: {
      suite: 'equivalence',
      caseId: 'missing-file',
      result: 'PASS',
      code: 'MO1307_INPUT',
      status: 'ERROR',
      currentCandidate: { path: helperRelative, byteLength: 29153, sha256: HELPER_SHA256 },
    },
  });
  assert.equal(nativeParityReview.evidence.some(record => record.path === nativeLastErrorRelative && record.sha256 === nativeLastErrorPin.sha256), true);
  assert.deepEqual(sourceReviews.governance, {
    prospectiveAuthority: { identity: 'PROSPECTIVE_HELPER_BOUND@1.0.0', helperMs: 8000, retroactive: false },
    historicalAuthority: { H: 'NOT_ESTABLISHED', acceptedPhase3C: HISTORICAL_PHASE3C, appliesOnlyTo: 'C3RB', preserved: true, promoted: false },
    diagnosticEvidencePromotedToCertification: false,
    readinessAuthorizesRelease: false,
    humanReleaseAuthorization: false,
    humanAuthorizationRemainsSeparate: true,
    phase3AR2Executed: false,
    phase3BR2Executed: false,
    phase3DExecuted: false,
    otherRefreshStreamsConsumed: false,
    push: false,
    tag: false,
  });
  const freshSuites = [
    { suite: 'deadline-cleanup', selectedControls: 7, selectedRejections: 6, rawWitnesses: 18, receipt: deadlinePin },
    { suite: 'equivalence', selectedControls: 67, selectedRejections: 55, rawWitnesses: 69, receipt: equivalencePin },
    { suite: 'protocol', selectedControls: 12, selectedRejections: 11, rawWitnesses: 13, receipt: protocolPin },
    { suite: 'runtime-main', selectedControls: 1, selectedRejections: 0, rawWitnesses: 1, receipt: smokePin },
    { suite: 'toctou', selectedControls: 2, selectedRejections: 2, rawWitnesses: 2, receipt: toctouPin },
  ];
  assert.equal(freshSuites.reduce((sum, row) => sum + row.selectedControls, 0), freshResults.count);
  assert.equal(freshSuites.reduce((sum, row) => sum + row.selectedRejections, 0), freshResults.negative);
  assert.equal(freshSuites.reduce((sum, row) => sum + row.rawWitnesses, 0), freshResults.supportingCounts.freshExecutionWitnessesIncludingLiveRuntimeSmoke);

  const existingEvidence = walkFiles(evidenceRoot);
  assert.equal(existingEvidence.some(record => record.path.endsWith('/stopped.json')), false, 'Stopped/failure marker present.');
  for (const relative of [failedPreflightRelative, planRelative, preSealRelative, executionStartRelative, executionLedgerRelative, reuseRelative, freshResultsRelative, candidateControlsRelative, sourceReviewsRelative, deadlineRelative, deadlineClosureRelative, equivalenceRelative, nativeLastErrorRelative, protocolRelative, toctouRelative, smokeRelative, smokeSealRelative, securityRelative, securitySealRelative]) {
    assert.equal(existingEvidence.some(record => record.path === relative), true, `Evidence omitted from namespace: ${relative}`);
  }
  assert.deepEqual(existingEvidence.find(record => record.path === failedPreflightRelative), failedPreflightFileRecord);

  const finalizedAt = new Date().toISOString();
  const reporting = finalReporting('CONTAINING_REFRESH_COMMIT_SUPPLIED_AFTER_CREATION', 'PHASE3CR2_CONFORMANCE_OUTPUTS_UNCOMMITTED_ONLY');
  const reportLines = [
    '# MO-1307 Phase 3CR2: dependency-selected C3TB refresh',
    '',
    '**PHASE3CR2_ACCEPTED.** Every selected fresh historical control passed, all 462 dependency-reuse candidates have exact field-level equality proof, both candidate-specific controls passed, all 19 headless/startup cases passed, all 12 required reviews passed, and zero historical controls were omitted.',
    '',
    '## Required final report',
    '',
    '| # | Requested item | Result |',
    '|---:|---|---|',
    `| 1 | Exact stale-pin cause | The failed setup used the accepted current-control-results SHA-256 9131759b75fc9407fd25467ef7656b0d6948711daecdf58234f1c4b09f9b9433 as the expected current-control-map digest. The failed setup remains FAIL in ${failedPreflightRelative}; it executed zero controls and made zero certification claims. |`,
    `| 2 | Verified control-map identity | PASS. ${HISTORICAL_PHASE3C}:${historicalControlMapRelative} is 530142 bytes, Git blob bf6bbaeb118fcfc38384530cee3d2942ac39fc47, SHA-256 0c490f5d4afa76b673c64d320308a2d1ca841a4330072b532964b0054d027131, and is the unchanged map supplied by accepted Phase 3C authority ${HISTORICAL_PHASE3C}. |`,
    '| 3 | Corrected pin | PASS. The expected map pin is sha256:0c490f5d4afa76b673c64d320308a2d1ca841a4330072b532964b0054d027131. Object bytes, control IDs, outcomes, selection and dependency mappings were unchanged. |',
    '| 4 | Zero-execution preflight result | PASS. Historical map, C3TB/tree, production tree, helper and refresh cardinalities passed; 89 fresh, 462 reuse and 2 candidate-specific controls were accounted for with zero exact-ID duplicates, zero overlap, zero omissions and zero product/security executions. |',
    `| 5 | Candidate identity | ${EXPECTED_ROOT}; ${BRANCH}; C3TB ${C3TB}, tree ${C3TB_TREE}; production C3T ${C3T}, tree ${PRODUCTION_TREE}; helper ${HELPER_SHA256}. |`,
    '| 6 | Final fresh-control count | 89 of 89 PASS_FRESH, including 74 rejection and 15 behavioral controls. |',
    '| 7 | Final reuse count | 462 of 462 REUSED_EXACT with field-level dependency equality. |',
    '| 8 | Controls moved to fresh | 0. Four dependency-reuse controls also received supporting-only fresh deadline witnesses, but remain REUSED_EXACT; those outcomes do not substitute for field-level reuse proof. No adaptive expansion or omission occurred. |',
    '| 9 | Deadline and timeout results | PASS. Prospective helper authority is 8000 ms; success is below 8000 ms and timeout is at or above 8000 ms. Aggregate 20000 ms, CLI 30000 ms, API/worker 10000 ms, cleanup 2000 ms; historical H remains NOT_ESTABLISHED. |',
    '| 10 | Headless and startup results | PASS. One exact production-helper headless smoke and all 19 required A-S cases passed, including fail-closed membership, sole-helper detachment, forbidden-host-operation absence and quiescence. |',
    '| 11 | Filesystem and native results | PASS. A dedicated current-source metadata witness proved CreateFileW SetLastError=true with immediate last-error capture; the exact missing-file behavioral witness returned MO1307_INPUT and matched the sealed corrected N15 production comparator. All 67 selected equivalence controls passed with exact response comparison; held-handle, final-path, identity, reparse, link, type and missing-leaf boundaries remain covered. |',
    '| 12 | TOCTOU results | PASS. Both selected controlled mutation-window controls passed with exact response equivalence and no production hook. |',
    '| 13 | Protocol and equivalence results | PASS. Protocol 12 of 12 and equivalence 67 of 67; framing, sequence, session, canonical encoding and native response behavior were preserved. |',
    '| 14 | Cleanup and topology | PASS. No owned process remained in the external boundary witness; process and streams closed, helper/worker overlap was refused, and terminal-plus-cleanup relations and quiescence passed. |',
    '| 15 | Source and security review | 12 of 12 required reviews PASS, including deadline binding, generated consistency, native/API parity, startup, filesystem/TOCTOU, source security and candidate binding. |',
    `| 16 | Governance separation | Historical accepted Phase 3C ${HISTORICAL_PHASE3C} remains unchanged and applies only to C3RB. Accepted Phase 3BR2 ${ACCEPTED_PHASE3BR2} was preserved and neither rerun nor modified. Phase 3AR2 remains independent; Phase 3D was not executed. Readiness does not authorize release and human authorization remains separate. |`,
    '| 17 | Candidate binding | PASS. The official binding tool passed under the exact Node runtime; C3TB is a binding-only sole child of C3T and the production tree is unchanged. |',
    `| 18 | Refresh receipt | ${receiptRelative}; immutable PASS / Phase 3CR2 ACCEPTED receipt created by this finalization. |`,
    '| 19 | Phase 3CR2 status | **PHASE3CR2_ACCEPTED**. |',
    `| 20 | Commit | The containing conformance-only refresh commit must have exact C3TB ${C3TB} as sole parent. Its generated hash is supplied after creation to avoid self-reference. |`,
    '| 21 | Repository status | Before the containing commit, only Phase 3CR2 tools, evidence and this report may differ. The committed verifier requires an exact changed-path set and a clean repository. |',
    `| 22 | Exact Phase 3D handoff | ${handoffRelative}. It binds this receipt, exact candidate/tree, counts, limits and containing refresh commit rule. Phase 3D was not executed. |`,
    '',
    '## Accounting',
    '',
    '| Axis | Count | Result |',
    '|---|---:|---|',
    '| Historical selected fresh controls | 89 | PASS_FRESH |',
    '| Historical dependency reuse | 462 | REUSED_EXACT |',
    '| Fresh execution witnesses, including live runtime smoke | 103 | PASS |',
    '| Fresh outcomes supporting REUSED_EXACT controls only | 4 | PASS_SUPPORTING_ONLY; reuse proof remains authoritative |',
    '| Current CreateFileW metadata/source-semantic case | 1 | PASS; separate engineering source-review evidence |',
    '| Historical omissions | 0 | PASS |',
    '| Candidate-specific supplemental controls | 2 | PASS |',
    '| Headless/startup A-S cases | 19 | PASS |',
    '| Required source/security reviews | 12 | PASS |',
    '',
    'These axes remain separate; no misleading flat aggregate control count is asserted. The campaign retained 103 fresh raw/live witnesses: 89 selected historical-control witnesses, 10 dependent supporting raw cases, and four supporting-only fresh outcomes for controls whose certification disposition remains REUSED_EXACT. Those four outcomes do not substitute for their exact dependency-reuse proofs. Historical outcomes were adopted only for the 462 controls whose exact exercised dependency closure was proven unchanged.',
    '',
    'Evidence: [preserved failed preflight](../evidence/mo1307/phase3cr2-c3tb/failed-preflight-attempt-1.json), [receipt](../evidence/mo1307/phase3cr2-c3tb/certification-receipt.json), [independent final review](../evidence/mo1307/phase3cr2-c3tb/final-review.json), [manifest](../evidence/mo1307/phase3cr2-c3tb/evidence-manifest.json), [final seal](../evidence/mo1307/phase3cr2-c3tb/final-seal.json), and [Phase 3D handoff](../evidence/mo1307/phase3cr2-c3tb/phase3d-handoff.json).',
    '',
  ];
  const reportBytes = Buffer.from(reportLines.join('\n'));
  const reportRecord = recordFromBytes(reportRelative, reportBytes, true);

  const controls = {
    historicalInventory: 551,
    selectedFresh: 89,
    selectedFreshRejections: 74,
    selectedFreshBehavioral: 15,
    dependencyReuse: 462,
    dependencyReuseRejections: 352,
    dependencyReuseBehavioral: 110,
    movedFromReuseToFresh: 0,
    omitted: 0,
    candidateSpecificSupplemental: 2,
    headlessCorrectionCases: 19,
    sourceAndSecurityReviews: 12,
    freshExecutionWitnessesIncludingLiveRuntimeSmoke: 103,
    selectedHistoricalFreshWitnesses: 89,
    dependentSupportingRawCases: 10,
    freshExecutedReuseSupportingOnly: 4,
    nativeLastErrorMetadataCases: 1,
    axesRemainSeparate: true,
  };
  assert.equal(Object.keys(reporting).length, 22);
  const finalReview = {
    kind: 'MO1307Phase3CR2C3TBIndependentFinalReview',
    version: '1.0.0',
    reviewedAt: finalizedAt,
    result: 'PASS_ACCEPTANCE_SUPPORTED',
    phase3CR2: 'ACCEPTED',
    candidate: { commit: C3TB, tree: C3TB_TREE, soleParent: C3T, productionTree: PRODUCTION_TREE },
    generation: plan.generation,
    failedPreflightAttempt: failedPreflightSummary,
    requiredReportItems: 22,
    requiredReportItemsPresent: Object.keys(reporting).length,
    accounting: controls,
    authorities: {
      failedPreflightEvidence: failedPreflightPin,
      campaignPlan: planPin,
      preExecutionSeal: preSealPin,
      executionStart: executionStartPin,
      executionLedger: executionLedgerPin,
      dependencyReuse: reusePin,
      freshControlResults: freshResultsPin,
      candidateSpecificControls: candidateControlsPin,
      sourceSecurityReviews: sourceReviewsPin,
      headlessSmoke: smokePin,
      headlessSecurity: securityPin,
      deadlineCleanup: deadlinePin,
      deadlineBoundaryClosure: deadlineClosurePin,
      equivalence: equivalencePin,
      nativeLastError: nativeLastErrorPin,
      protocol: protocolPin,
      toctou: toctouPin,
      n15Comparator: n15ComparatorAuthority,
      report: recordFromBytes(reportRelative, reportBytes),
    },
    checks: {
      priorFailedPreflight: { status: 'FAILED_SETUP', result: 'FAIL', controlsExecuted: 0, certificationClaims: 0, rewrittenAsPass: false },
      correctedPin: plan.pinCorrection,
      zeroExecutionPreflight: plan.zeroExecutionPreflight,
      executionStages: { expected: 9, passed: 9, firstFailure: null },
      selectedFresh: { expected: 89, passed: 89, rejections: 74, supports: 103 },
      dependencyReuse: { expected: 462, exact: 462, movedToFresh: 0 },
      freshExecutedReuseSupport: { expected: 4, passed: 4, disposition: 'REUSED_EXACT', substitutedForReuseProof: false, rows: freshExecutedReuseSupport },
      nativeLastErrorMetadata: { expected: 1, passed: 1, caseId: 'createfile-setlasterror-effective-metadata-and-source-semantics', setLastError: true, missingLeafWitness: 'MO1307_INPUT' },
      candidateSpecific: { expected: 2, passed: 2 },
      headlessCorrectionCases: { expected: 19, passed: 19, ids: [...expectedHeadless] },
      sourceAndSecurityReviews: { expected: 12, passed: 12, ids: [...expectedReviews] },
      historicalInventory: { expected: 551, partitioned: 551, omitted: 0 },
      productChanges: 0,
      reportFields: 22,
    },
    governance: {
      ...sourceReviews.governance,
      acceptedPhase3BR2: { commit: ACCEPTED_PHASE3BR2, preserved: true, rerunByThisCampaign: false, modifiedByThisCampaign: false },
    },
    historicalAcceptedPhase3C: { commit: HISTORICAL_PHASE3C, appliesOnlyTo: 'C3RB', preserved: true, promoted: false },
    priorFailedGenerations: priorFailedGenerationRefs,
    allReceiptPinsCurrent: true,
    allReconciliationAuthoritiesPassed: true,
    exactAccountingPassed: true,
    reportComplete: true,
    productionChanged: false,
    phase3AR2Executed: false,
    phase3BR2Executed: false,
    phase3DExecuted: false,
    push: false,
    tag: false,
  };
  const finalReviewBytes = Buffer.from(`${JSON.stringify(finalReview, null, 2)}\n`);
  const finalReviewRecord = recordFromBytes(finalReviewRelative, finalReviewBytes, true);
  const receipt = {
    kind: 'MO1307Phase3CR2C3TBCertificationReceipt',
    version: '1.0.0',
    createdAt: finalizedAt,
    result: 'PASS',
    phase3CR2: 'ACCEPTED',
    accepted: true,
    status: 'PHASE3CR2_ACCEPTED',
    generation: plan.generation,
    failedPreflightAttempt: failedPreflightSummary,
    pinCorrection: plan.pinCorrection,
    zeroExecutionPreflight: plan.zeroExecutionPreflight,
    candidate: {
      role: 'C3TB',
      commit: C3TB,
      tree: C3TB_TREE,
      soleParent: C3T,
      production: { role: 'C3T', commit: C3T, tree: PRODUCTION_TREE, rootTree: C3T_TREE },
      helperSha256: HELPER_SHA256,
    },
    worktree: EXPECTED_ROOT,
    branch: BRANCH,
    runtime: recordFromBytes(RUNTIME_RELATIVE, fs.readFileSync(process.execPath)),
    historicalAccepted: {
      commit: HISTORICAL_PHASE3C,
      candidate: C3RB,
      candidateTree: C3RB_TREE,
      appliesOnlyTo: 'C3RB',
      preserved: true,
      promotedToC3TB: false,
      receipt: historicalReceiptRecord,
      priorFailedGenerations: priorFailedGenerationRefs,
    },
    controls,
    freshSuites,
    freshControlResults: { result: 'PASS_FRESH_COMPLETE', count: 89, negative: 74, authority: freshResultsPin },
    dependencyReuse: { result: 'PASS', count: 462, movedToFresh: [], receipt: reusePin, freshExecutedSupportingOnly: freshExecutedReuseSupport },
    candidateSpecificSupplementalControls: { result: 'PASS', count: 2, authority: candidateControlsPin },
    headlessAndStartup: { result: 'PASS', smoke: smokePin, smokeSeal: smokeSealPin, securityCases: 19, security: securityPin, securitySeal: securitySealPin },
    sourceAndSecurityReviews: { result: 'PASS', count: 12, authority: sourceReviewsPin, governance: sourceReviews.governance },
    deadlineAndCleanup: { result: 'PASS', receipt: deadlinePin, boundaryClosure: deadlineClosurePin },
    filesystemAndNative: { result: 'PASS', equivalence: equivalencePin, toctou: toctouPin, nativeLastError: nativeLastErrorPin, n15Comparator: n15ComparatorAuthority, createFileWSetLastError: true, missingLeafWitness: { name: 'missing-file', code: 'MO1307_INPUT', exactResponseEqual: true } },
    protocolAndEquivalence: { result: 'PASS', protocol: protocolPin, equivalence: equivalencePin },
    firstMandatoryFailure: null,
    campaign: { mode: plan.generation.mode, resumesPriorAttempt: false, executions: 1, retries: 0, repairs: 0, adaptiveExpansion: false, historicalOutcomeFallbackAfterMismatch: false, executionStart: executionStartPin, executionLedger: executionLedgerPin },
    limits: plan.limits,
    preExecutionSeal: preSealPin,
    campaignPlan: planPin,
    independentFinalReview: recordFromBytes(finalReviewRelative, finalReviewBytes),
    report: recordFromBytes(reportRelative, reportBytes),
    evidenceManifestPath: manifestRelative,
    finalSealPath: finalSealRelative,
    phase3D: { executed: false, handoff: handoffRelative, requiresIndependentAcceptedPhase3AR2: true, requiresIndependentAcceptedPhase3BR2: true },
    governance: {
      prospectiveDeadlineAuthority: 'PROSPECTIVE_HELPER_BOUND@1.0.0',
      historicalH: 'NOT_ESTABLISHED',
      historicalFailuresPreserved: true,
      acceptedPhase3BR2: { commit: ACCEPTED_PHASE3BR2, preserved: true, rerunByThisCampaign: false, modifiedByThisCampaign: false },
      diagnosticEvidencePromoted: false,
      readinessAuthorizesRelease: false,
      humanAuthorizationSeparate: true,
      phase3AR2Executed: false,
      phase3BR2Executed: false,
      phase3DExecuted: false,
      networkAcquisition: false,
      hostedProviders: false,
      productChanged: false,
      push: false,
      tag: false,
    },
    commit: { identity: 'Containing conformance-only refresh commit; exact hash supplied externally after creation.', soleParent: C3TB, productionChanged: false },
    repositoryStatus: { beforeCommit: 'PHASE3CR2_CONFORMANCE_OUTPUTS_UNCOMMITTED_ONLY', afterCommitRequired: 'CLEAN', verifierMode: '--verify-committed' },
    finalReporting: reporting,
    limitations: [
      'Finite dependency-selected Phase 3CR2 evidence for exact C3TB and the recorded Windows/Node environment; not Phase 3AR2, Phase 3BR2 or Phase 3D.',
      'Controlled filesystem mutation witnesses use labeled engineering copies and do not claim that production sharing permits the adversary.',
      'Representative resource observations do not establish an OS-wide hard RSS sandbox.',
      'Readiness, byte identity and conformance evidence do not provide organizational or human release authorization.',
    ],
  };
  const receiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  const receiptRecord = recordFromBytes(receiptRelative, receiptBytes, true);

  const handoff = {
    kind: 'MO1307Phase3CR2ExactPhase3DHandoff',
    version: '1.0.0',
    createdAt: finalizedAt,
    result: 'PASS',
    phase3CR2: 'ACCEPTED',
    status: 'PHASE3CR2_ACCEPTED',
    generation: plan.generation,
    failedPreflightAttempt: failedPreflightSummary,
    pinCorrection: plan.pinCorrection,
    zeroExecutionPreflight: plan.zeroExecutionPreflight,
    candidate: { role: 'C3TB', commit: C3TB, tree: C3TB_TREE, productionCommit: C3T, productionTree: PRODUCTION_TREE, helperSha256: HELPER_SHA256 },
    historicalAcceptedPhase3C: { commit: HISTORICAL_PHASE3C, candidate: C3RB, preserved: true, promoted: false },
    acceptedPhase3BR2: { commit: ACCEPTED_PHASE3BR2, preserved: true, rerunByThisCampaign: false, modifiedByThisCampaign: false },
    refreshEvidenceCommit: 'Containing conformance-only refresh commit; exact hash supplied externally after creation.',
    refreshCommitSoleParent: C3TB,
    branch: BRANCH,
    worktree: EXPECTED_ROOT,
    receipt: recordFromBytes(receiptRelative, receiptBytes),
    report: recordFromBytes(reportRelative, reportBytes),
    independentFinalReview: recordFromBytes(finalReviewRelative, finalReviewBytes),
    preExecutionSeal: preSealPin,
    reconciliationAuthorities: {
      freshControlResults: freshResultsPin,
      dependencyReuse: reusePin,
      nativeLastError: nativeLastErrorPin,
      candidateSpecificControls: candidateControlsPin,
      sourceSecurityReviews: sourceReviewsPin,
      executionLedger: executionLedgerPin,
      n15Comparator: n15ComparatorAuthority,
    },
    evidenceManifestPath: manifestRelative,
    finalSealPath: finalSealRelative,
    counts: controls,
    limits: plan.limits,
    consumeRule: 'Require the exact C3TB commit/tree, exact containing single-parent refresh commit, immutable receipt/manifest/final-seal hashes, and independently accepted exact-candidate Phase 3AR2 and Phase 3BR2 handoffs. Do not substitute C3RB evidence or any failed/diagnostic generation.',
    prerequisites: {
      phase3AR2: 'INDEPENDENT_ACCEPTANCE_REQUIRED_FOR_EXACT_C3TB',
      phase3BR2: 'INDEPENDENT_ACCEPTANCE_REQUIRED_FOR_EXACT_C3TB',
      humanReleaseAuthorization: 'SEPARATE_AND_NOT_GRANTED_BY_THIS_HANDOFF',
    },
    phase3AR2ExecutedByThisWorkstream: false,
    phase3BR2ExecutedByThisWorkstream: false,
    phase3DExecuted: false,
    push: false,
    tag: false,
  };
  const handoffBytes = Buffer.from(`${JSON.stringify(handoff, null, 2)}\n`);
  const handoffRecord = recordFromBytes(handoffRelative, handoffBytes, true);

  const members = [
    ...currentToolInputs,
    ...existingEvidence,
    reportRecord,
    finalReviewRecord,
    receiptRecord,
    handoffRecord,
  ].sort((a, b) => ordinal(a.path, b.path));
  assert.equal(new Set(members.map(record => record.path)).size, members.length, 'Duplicate manifest path.');
  const manifest = {
    kind: 'MO1307Phase3CR2C3TBAcceptedEvidenceManifest',
    version: '1.0.0',
    createdAt: finalizedAt,
    result: 'PASS',
    phase3CR2: 'ACCEPTED',
    status: 'PHASE3CR2_ACCEPTED',
    candidate: C3TB,
    candidateTree: C3TB_TREE,
    productionTree: PRODUCTION_TREE,
    generation: plan.generation,
    failedPreflightAttempt: failedPreflightSummary,
    pinCorrection: plan.pinCorrection,
    zeroExecutionPreflight: plan.zeroExecutionPreflight,
    members,
    memberCount: members.length,
    excludes: [manifestRelative, finalSealRelative],
    selfReference: false,
    appendOnly: true,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const finalSeal = {
    kind: 'MO1307Phase3CR2C3TBFinalAcceptanceSeal',
    version: '1.0.0',
    sealedAt: finalizedAt,
    result: 'PASS',
    phase3CR2: 'ACCEPTED',
    status: 'PHASE3CR2_ACCEPTED',
    candidate: C3TB,
    candidateTree: C3TB_TREE,
    soleParent: C3T,
    productionCommit: C3T,
    productionTree: PRODUCTION_TREE,
    helperSha256: HELPER_SHA256,
    generation: plan.generation,
    failedPreflightAttempt: failedPreflightSummary,
    pinCorrection: plan.pinCorrection,
    zeroExecutionPreflight: plan.zeroExecutionPreflight,
    manifest: recordFromBytes(manifestRelative, manifestBytes),
    receipt: recordFromBytes(receiptRelative, receiptBytes),
    report: recordFromBytes(reportRelative, reportBytes),
    independentFinalReview: recordFromBytes(finalReviewRelative, finalReviewBytes),
    nativeLastError: nativeLastErrorPin,
    n15Comparator: n15ComparatorAuthority,
    phase3DHandoff: recordFromBytes(handoffRelative, handoffBytes),
    preExecutionSeal: preSealPin,
    controls,
    historicalAcceptedPhase3CPreserved: true,
    historicalAcceptedPhase3CPromoted: false,
    acceptedPhase3BR2: { commit: ACCEPTED_PHASE3BR2, preserved: true, rerunByThisCampaign: false, modifiedByThisCampaign: false },
    allSelectedFreshPassed: true,
    allDependencyReuseProvedExact: true,
    bothCandidateSpecificControlsPassed: true,
    allHeadlessCorrectionCasesPassed: true,
    allRequiredReviewsPassed: true,
    omissions: 0,
    productChanged: false,
    certificationExecutionDuringFinalization: false,
    containingCommit: { identity: 'Supplied externally after creation to avoid self-reference.', soleParent: C3TB },
    phase3AR2Executed: false,
    phase3BR2Executed: false,
    phase3DExecuted: false,
    push: false,
    tag: false,
  };
  const finalSealBytes = Buffer.from(`${JSON.stringify(finalSeal, null, 2)}\n`);

  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);
  assert.equal(gitText(['branch', '--show-current']), BRANCH);
  assert.deepEqual(walkFiles(toolRoot), currentToolInputs, 'Tools changed during finalization validation.');
  assert.deepEqual(walkFiles(evidenceRoot), existingEvidence, 'Evidence changed during finalization validation.');
  assert.deepEqual(assertAllowedWriteState(), initialStatus, 'Worktree state changed during finalization validation.');
  for (const relative of outputRelatives) assert.equal(fs.existsSync(absolute(relative)), false, `Concurrent output appeared: ${relative}`);

  fs.writeFileSync(reportPath, reportBytes, { flag: 'wx', mode: 0o644 });
  fs.writeFileSync(absolute(finalReviewRelative), finalReviewBytes, { flag: 'wx', mode: 0o644 });
  fs.writeFileSync(absolute(receiptRelative), receiptBytes, { flag: 'wx', mode: 0o644 });
  fs.writeFileSync(absolute(handoffRelative), handoffBytes, { flag: 'wx', mode: 0o644 });
  fs.writeFileSync(absolute(manifestRelative), manifestBytes, { flag: 'wx', mode: 0o644 });
  fs.writeFileSync(absolute(finalSealRelative), finalSealBytes, { flag: 'wx', mode: 0o644 });

  process.stdout.write(`${canonical({
    result: 'PHASE3CR2_ACCEPTED',
    candidate: C3TB,
    productionTree: PRODUCTION_TREE,
    controls,
    finalReporting: reporting,
    manifest: recordFromBytes(manifestRelative, manifestBytes),
    receipt: recordFromBytes(receiptRelative, receiptBytes),
    report: recordFromBytes(reportRelative, reportBytes),
    independentFinalReview: recordFromBytes(finalReviewRelative, finalReviewBytes),
    phase3DHandoff: recordFromBytes(handoffRelative, handoffBytes),
    finalSeal: recordFromBytes(finalSealRelative, finalSealBytes),
    next: 'Stage exact manifest paths, run --verify-staged, create the single-parent refresh commit, then run --verify-committed. No push, tag or Phase 3D.',
  })}\n`);
}

assert.equal(process.argv.length, 3);
const mode = process.argv[2];
if (mode === '--write') writeFinal();
else if (mode === '--verify-staged') verifyStaged();
else if (mode === '--verify-committed') verifyCommitted();
else throw new Error('Use --write, --verify-staged, or --verify-committed.');
