// Append-only reconciliation of the fresh MO-1307 Phase 3CR2 C3TB evidence.
// This tool executes no product or helper. It accepts only the sealed, already
// completed receipts and writes the three finite reconciliation artifacts.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const EVIDENCE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2';
const EVIDENCE = path.join(ROOT, EVIDENCE_RELATIVE);
const PRODUCT = 'repositories/memoryos-readiness';
const TOOL_RELATIVE = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g2';
const CURRENT_AUTHORITY = 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate';
const HISTORICAL_EVIDENCE = 'repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3';

const OUTPUTS = Object.freeze({
  fresh: `${EVIDENCE_RELATIVE}/fresh-control-results.json`,
  candidate: `${EVIDENCE_RELATIVE}/candidate-specific-controls.json`,
  reviews: `${EVIDENCE_RELATIVE}/source-security-reviews.json`,
});

const BRANCH = 'codex/mo1307-phase3cr2-c3tb';
const C3T = '65e24b2debdd70ecb8e52fbccbd6c101621f1917';
const C3T_TREE = 'd21f46bc31ccd7a9f80a5e494b3d09116d125522';
const C3TB = '119e68bdcf0ffc906b4ca03a912aadcb25908346';
const C3TB_TREE = '5e0088965d4eac4002165fe0190f275c257985ba';
const PRODUCTION_TREE = '324bf600b6cbfaa8564db27fce2d999711270cb8';
const HISTORICAL_PHASE3C = 'b02fc0226a1a2d800185a02071674ca80bdf4a1d';
const HISTORICAL_PRODUCTION = 'defe93989efc6501b1a730b82e79e705884b269b';
const N15_REFERENCE_COMMIT = 'c9cd73df2f4c48afeab6059b31eca61830e1633c';
const N15_REFERENCE_BLOB = '527fea7b9f12ba345f5b4f57511263485e79e303';
const N15_REFERENCE_PATH = 'repositories/cca-conformance/evidence/mo1307/n15-correction/native-filesystem/helper.ps1.data';
const HELPER_PATH = 'repositories/memoryos-readiness/helpers/windows-inspect.ps1';
const NATIVE_LAST_ERROR_CASE = 'createfile-setlasterror-effective-metadata-and-source-semantics';
const NATIVE_METHOD_KEYS = Object.freeze([
  'CreateFileW:System.String,System.UInt32,System.UInt32,System.IntPtr,System.UInt32,System.UInt32,System.IntPtr',
  'FreeConsole:',
  'GetConsoleProcessList:System.IntPtr,System.UInt32',
  'GetFileInformationByHandle:Microsoft.Win32.SafeHandles.SafeFileHandle,System.IntPtr',
  'GetFileType:Microsoft.Win32.SafeHandles.SafeFileHandle',
  'GetFileType:System.IntPtr',
  'GetFinalPathNameByHandleW:Microsoft.Win32.SafeHandles.SafeFileHandle,System.Text.StringBuilder,System.UInt32,System.UInt32',
  'GetStdHandle:System.Int32',
]);
const GIT = 'C:/Program Files/Git/cmd/git.exe';
const EXPECTED_GIT_VERSION = 'git version 2.55.0.windows.3';
const EXPECTED_NODE = Object.freeze({
  version: 'v24.21.0',
  platform: 'win32',
  arch: 'x64',
  byteLength: 93580104,
  sha256: 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32',
});

const CURRENT_FILES = Object.freeze({
  authority: `${CURRENT_AUTHORITY}/authority.json`,
  candidate: `${CURRENT_AUTHORITY}/candidate.json`,
  changedInventory: `${CURRENT_AUTHORITY}/changed-file-inventory.json`,
  consistency: `${CURRENT_AUTHORITY}/consistency-validation.json`,
  map: `${CURRENT_AUTHORITY}/phase3c-refresh-map.json`,
  binding: `${CURRENT_AUTHORITY}/binding.json`,
  bindingVerification: `${CURRENT_AUTHORITY}/binding-verification.json`,
});
const HISTORICAL_FILES = Object.freeze({
  controlMap: `${HISTORICAL_EVIDENCE}/current-control-map.json`,
  controlResults: `${HISTORICAL_EVIDENCE}/current-control-results.json`,
});
const RECEIPT_PATHS = Object.freeze({
  plan: `${EVIDENCE_RELATIVE}/campaign-plan.json`,
  preExecutionSeal: `${EVIDENCE_RELATIVE}/pre-execution-seal.json`,
  dependencyReuse: `${EVIDENCE_RELATIVE}/dependency-reuse.json`,
  headlessSmoke: `${EVIDENCE_RELATIVE}/headless-smoke/receipt.json`,
  headlessSmokeSeal: `${EVIDENCE_RELATIVE}/headless-smoke/seal.json`,
  headlessSecurity: `${EVIDENCE_RELATIVE}/headless-security/receipt.json`,
  headlessSecuritySeal: `${EVIDENCE_RELATIVE}/headless-security/seal.json`,
  deadlineCampaign: `${EVIDENCE_RELATIVE}/deadline-cleanup/attempt-1/campaign.json`,
  deadline: `${EVIDENCE_RELATIVE}/deadline-cleanup/attempt-1/receipt.json`,
  deadlineBoundary: `${EVIDENCE_RELATIVE}/deadline-cleanup/attempt-1/boundary-closure.json`,
  equivalence: `${EVIDENCE_RELATIVE}/equivalence/attempt1/receipt.json`,
  nativeLastError: `${EVIDENCE_RELATIVE}/native-last-error/receipt.json`,
  protocol: `${EVIDENCE_RELATIVE}/protocol-subset.json`,
  toctou: `${EVIDENCE_RELATIVE}/toctou-boundaries/attempt1/receipt.json`,
  securityManifest: `${TOOL_RELATIVE}/security-manifest.json`,
});

const EXPECTED_SUPPLEMENTAL = Object.freeze([
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
const EXPECTED_HEADLESS = Object.freeze(Array.from({ length: 19 }, (_, index) => String.fromCharCode(65 + index)));
const SUPPORTING_CASES = Object.freeze({
  equivalence: Object.freeze(['mo1306-native-counters', 'ordinary-native-counters']),
  protocol: Object.freeze(['cross-session-response-replay']),
  toctou: Object.freeze([]),
  'deadline-cleanup': Object.freeze([
    'bounded-state-and-fixed-source-review',
    'fixed-native-timely',
    'resource-native-observed-file-cap',
    'resource-native-path-cap129',
    'resource-native-request-prefix-cap',
    'resource-sample-corrected',
    'resource-sample-reference',
  ]),
});
const FRESH_REUSE_SUPPORT = Object.freeze([
  Object.freeze({ controlId: 'runtime-boundary:launch-flag---import', caseId: 'launch-substitution-import' }),
  Object.freeze({ controlId: 'runtime-boundary:launch-flag---require', caseId: 'launch-substitution-require' }),
  Object.freeze({ controlId: 'runtime-boundary:launch-flag---loader', caseId: 'launch-substitution-loader' }),
  Object.freeze({ controlId: 'runtime-boundary:secret-fixed-diagnostic', caseId: 'secret-safe-error-projection' }),
]);

const canonical = value => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
const sha256 = bytes => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
const gitBlob = bytes => crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
const slash = value => value.replaceAll('\\', '/');
const ordinalSorted = values => [...values].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
const errorRecord = error => ({
  name: error?.name ?? 'Error',
  code: error?.code ?? null,
  message: error?.message ?? String(error),
  stack: error?.stack ?? null,
});
const comparablePin = pin => ({ path: pin.path, byteLength: pin.byteLength, sha256: pin.sha256 });
const campaignGitPin = pin => ({ path: pin.path, byteLength: pin.byteLength, sha256: pin.sha256, gitBlob: pin.gitBlob });
const normalizedPin = pin => ({
  path: slash(path.isAbsolute(pin.path) ? path.relative(ROOT, pin.path) : pin.path),
  byteLength: pin.byteLength,
  sha256: pin.sha256,
});

function runGit(args, input = undefined) {
  const result = spawnSync(GIT, [
    '-c', 'core.longpaths=true',
    '-c', `safe.directory=${slash(ROOT).replace(/\/$/u, '')}`,
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
const gitBytes = (commit, relativePath) => runGit(['show', `${commit}:${relativePath}`]);
const gitJson = (commit, relativePath) => JSON.parse(gitBytes(commit, relativePath).toString('utf8'));
function gitPin(commit, relativePath) {
  const bytes = gitBytes(commit, relativePath);
  return {
    path: relativePath,
    byteLength: bytes.length,
    sha256: sha256(bytes),
    commit,
    gitBlob: gitText(['rev-parse', `${commit}:${relativePath}`]),
  };
}

function regularBytes(absolutePath) {
  const stat = fs.lstatSync(absolutePath);
  assert.equal(stat.isSymbolicLink(), false, `Symlink is forbidden: ${absolutePath}`);
  assert.equal(stat.isFile(), true, `Expected regular file: ${absolutePath}`);
  return fs.readFileSync(absolutePath);
}
function filePin(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  const bytes = regularBytes(absolutePath);
  return { path: relativePath, byteLength: bytes.length, sha256: sha256(bytes) };
}
function currentGitPin(commit, relativePath) {
  const current = regularBytes(path.join(ROOT, relativePath));
  const committed = gitBytes(commit, relativePath);
  assert.ok(current.equals(committed), `${relativePath}: checkout differs from ${commit}`);
  return {
    path: relativePath,
    byteLength: current.length,
    sha256: sha256(current),
    commit,
    gitBlob: gitText(['rev-parse', `${commit}:${relativePath}`]),
  };
}
function jsonArtifact(relativePath) {
  const bytes = regularBytes(path.join(ROOT, relativePath));
  return { value: JSON.parse(bytes.toString('utf8')), pin: { path: relativePath, byteLength: bytes.length, sha256: sha256(bytes) } };
}
function assertPinCurrent(pin, label = pin.path) {
  assert.equal(typeof pin?.path, 'string', `${label}: path`);
  const absolutePath = path.isAbsolute(pin.path) ? pin.path : path.join(ROOT, pin.path);
  const bytes = regularBytes(absolutePath);
  assert.equal(bytes.length, pin.byteLength, `${label}: byteLength`);
  assert.equal(sha256(bytes), pin.sha256, `${label}: sha256`);
}
function assertReferenceProvenance(provenance, copyRelative, referencePin) {
  assert.equal(provenance.sealedArtifact.commit, N15_REFERENCE_COMMIT);
  assert.equal(provenance.sealedArtifact.gitBlob, N15_REFERENCE_BLOB);
  assert.deepEqual(normalizedPin(provenance.sealedArtifact), comparablePin(referencePin));
  assert.equal(provenance.productionSource.commit, N15_REFERENCE_COMMIT);
  assert.equal(provenance.productionSource.path, HELPER_PATH);
  assert.equal(provenance.productionSource.gitBlob, N15_REFERENCE_BLOB);
  assert.equal(provenance.productionSource.byteLength, referencePin.byteLength);
  assert.equal(provenance.productionSource.sha256, referencePin.sha256);
  assert.equal(provenance.sameGitBlob, true);
  assert.equal(provenance.role, 'SEALED_CORRECTED_PRODUCTION_HELPER_COMPARISON_SOURCE');
  assert.equal(provenance.diagnosticEvidencePromoted, false);
  assert.deepEqual(normalizedPin(provenance.copy), { ...comparablePin(referencePin), path: copyRelative });
  assertPinCurrent(provenance.sealedArtifact, 'N15 sealed corrected production reference');
  assertPinCurrent(provenance.copy, `${copyRelative}: byte-for-byte reference copy`);
}
function indexUnique(rows, key, label) {
  const result = new Map();
  for (const row of rows) {
    const id = row[key];
    assert.equal(typeof id, 'string', `${label}: missing ${key}`);
    assert.equal(result.has(id), false, `${label}: duplicate ${id}`);
    result.set(id, row);
  }
  return result;
}
function assertExactSet(actual, expected, label) {
  assert.equal(new Set(actual).size, actual.length, `${label}: duplicate`);
  assert.equal(new Set(expected).size, expected.length, `${label}: expected duplicate`);
  assert.deepEqual(ordinalSorted(actual), ordinalSorted(expected), label);
}
function receiptRows(receipt, label) {
  const rows = receipt.cases ?? receipt.rows ?? receipt.records;
  assert.ok(Array.isArray(rows), `${label}: finite case array`);
  return rows;
}
function caseKey(row, label) {
  const id = row.id ?? row.name;
  assert.equal(typeof id, 'string', `${label}: row identifier`);
  return id;
}
function assertPassingCaseSet(receipt, expectedIds, label) {
  const rows = receiptRows(receipt, label);
  const ids = rows.map(row => caseKey(row, label));
  assertExactSet(ids, expectedIds, `${label}: exact case set`);
  assert.equal(rows.every(row => row.result === 'PASS' || row.pass === true), true, `${label}: all cases PASS`);
  const indexed = new Map();
  for (const row of rows) {
    const id = caseKey(row, label);
    assert.equal(indexed.has(id), false, `${label}: duplicate ${id}`);
    indexed.set(id, row);
  }
  return indexed;
}
function actualOf(rawWitness) {
  if (Object.hasOwn(rawWitness, 'actual')) return rawWitness.actual;
  if (Object.hasOwn(rawWitness, 'detail')) return rawWitness.detail;
  return {
    result: rawWitness.result ?? (rawWitness.pass === true ? 'PASS' : null),
    code: rawWitness.code ?? null,
    status: rawWitness.status ?? null,
  };
}
function evidencePins(...pins) {
  const byPath = new Map();
  for (const pin of pins.flat()) {
    assert.ok(pin && typeof pin.path === 'string', 'Evidence pin');
    byPath.set(pin.path, pin);
  }
  return [...byPath.values()].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

let failure = null;
try {
  assert.deepEqual(process.argv.slice(2), []);
  assert.equal(process.version, EXPECTED_NODE.version);
  assert.equal(process.platform, EXPECTED_NODE.platform);
  assert.equal(process.arch, EXPECTED_NODE.arch);
  const nodeBytes = regularBytes(process.execPath);
  assert.equal(nodeBytes.length, EXPECTED_NODE.byteLength);
  assert.equal(sha256(nodeBytes), EXPECTED_NODE.sha256);
  assert.equal(gitText(['--version']), EXPECTED_GIT_VERSION);
  assert.equal(gitText(['branch', '--show-current']), BRANCH);
  assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);
  assert.equal(gitText(['show', '-s', '--format=%T', C3TB]), C3TB_TREE);
  assert.equal(gitText(['show', '-s', '--format=%P', C3TB]), C3T);
  assert.equal(gitText(['show', '-s', '--format=%T', C3T]), C3T_TREE);
  assert.equal(gitText(['rev-parse', `${C3TB}:${PRODUCT}`]), PRODUCTION_TREE);
  assert.equal(gitText(['rev-parse', `${C3T}:${PRODUCT}`]), PRODUCTION_TREE);
  assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all', '--', PRODUCT]), '');
  assert.deepEqual(
    gitText(['diff-tree', '--no-commit-id', '--name-only', '-r', C3T, C3TB]).split(/\r?\n/u).filter(Boolean).sort(),
    [`${CURRENT_AUTHORITY}/binding-verification.json`, `${CURRENT_AUTHORITY}/binding.json`].sort(),
  );
  assert.equal(fs.lstatSync(EVIDENCE).isDirectory(), true);
  for (const relativePath of Object.values(OUTPUTS)) assert.equal(fs.existsSync(path.join(ROOT, relativePath)), false, `${relativePath}: append-only output exists`);

  const currentPins = Object.fromEntries(Object.entries(CURRENT_FILES).map(([key, relativePath]) => [key, currentGitPin(C3TB, relativePath)]));
  const current = Object.fromEntries(Object.entries(CURRENT_FILES).map(([key, relativePath]) => [key, JSON.parse(regularBytes(path.join(ROOT, relativePath)).toString('utf8'))]));
  const historicalPins = Object.fromEntries(Object.entries(HISTORICAL_FILES).map(([key, relativePath]) => [key, gitPin(HISTORICAL_PHASE3C, relativePath)]));
  const helperPin = currentGitPin(C3TB, HELPER_PATH);
  const n15ReferencePin = currentGitPin(C3TB, N15_REFERENCE_PATH);
  const n15SealedPin = gitPin(N15_REFERENCE_COMMIT, N15_REFERENCE_PATH);
  const n15ProductionPin = gitPin(N15_REFERENCE_COMMIT, HELPER_PATH);
  assert.equal(n15ReferencePin.gitBlob, N15_REFERENCE_BLOB);
  assert.deepEqual(comparablePin(n15ReferencePin), comparablePin(n15SealedPin));
  assert.deepEqual({ ...comparablePin(n15ProductionPin), path: N15_REFERENCE_PATH }, comparablePin(n15ReferencePin));
  const historicalMap = gitJson(HISTORICAL_PHASE3C, HISTORICAL_FILES.controlMap);
  const historicalResults = gitJson(HISTORICAL_PHASE3C, HISTORICAL_FILES.controlResults);

  assert.equal(current.map.kind, 'MO1307ProspectiveBoundPhase3CRefreshMap');
  assert.equal(current.map.status, 'PENDING_SEPARATE_EXECUTION');
  assert.equal(current.map.consumeRule, 'EXACT_C3TB_HEAD_AFTER_BINDING_VERIFICATION');
  assert.deepEqual(current.map.accounting, {
    dependencyReuseCandidates: 462,
    historicalInventory: 551,
    omitted: 0,
    selectedFreshHistoricalControls: 89,
  });
  assert.deepEqual(current.map.additionalHeadlessCases, EXPECTED_HEADLESS);
  assert.deepEqual(current.map.candidateSpecificSupplementalControls, EXPECTED_SUPPLEMENTAL);
  assert.deepEqual(current.map.requiredSourceAndSecurityReviews, EXPECTED_REVIEWS);
  assert.deepEqual(current.map.historicalAccepted, { appliesOnlyTo: 'C3RB', commit: HISTORICAL_PHASE3C, controls: 551, promoted: false });
  assert.equal(current.map.push, false);
  assert.equal(current.map.tag, false);

  assert.equal(historicalMap.kind, 'MO1307Phase3CCert3CompleteFreshDraftMapping');
  assert.equal(historicalMap.candidate, HISTORICAL_PRODUCTION);
  assert.equal(historicalMap.controls, 551);
  assert.equal(historicalMap.negative, 426);
  assert.equal(historicalMap.rows.length, 551);
  assert.equal(historicalResults.kind, 'MO1307Phase3CC3RBFreshControlResults');
  assert.equal(historicalResults.candidate, HISTORICAL_PRODUCTION);
  assert.equal(historicalResults.result, 'PASS_FRESH_COMPLETE');
  assert.equal(historicalResults.count, 551);
  assert.equal(historicalResults.negative, 426);
  assert.equal(historicalResults.rows.length, 551);
  assert.equal(historicalResults.historicalPassReused, false);
  const historicalMapById = indexUnique(historicalMap.rows, 'id', 'historical control map');
  const historicalResultById = indexUnique(historicalResults.rows, 'id', 'historical control results');
  assertExactSet([...historicalMapById.keys()], [...historicalResultById.keys()], 'historical map/result inventory');

  const selectedIds = current.map.selectedHistoricalIds;
  const reuseIds = current.map.dependencyReuseIds;
  assert.equal(selectedIds.length, 89);
  assert.equal(reuseIds.length, 462);
  assert.equal(new Set(selectedIds).size, 89);
  assert.equal(new Set(reuseIds).size, 462);
  const selectedSet = new Set(selectedIds);
  const reuseSet = new Set(reuseIds);
  assert.equal(reuseIds.some(id => selectedSet.has(id)), false);
  assertExactSet([...selectedIds, ...reuseIds], [...historicalMapById.keys()], 'exact 551-control partition');
  assert.equal(FRESH_REUSE_SUPPORT.length, 4);
  assert.equal(new Set(FRESH_REUSE_SUPPORT.map(row => row.controlId)).size, 4);
  assert.equal(new Set(FRESH_REUSE_SUPPORT.map(row => row.caseId)).size, 4);
  for (const row of FRESH_REUSE_SUPPORT) {
    assert.equal(reuseSet.has(row.controlId), true, `${row.controlId}: dependency reuse control`);
    assert.equal(selectedSet.has(row.controlId), false, `${row.controlId}: not selected fresh`);
    const mapping = historicalMapById.get(row.controlId);
    assert.equal(mapping.suite, 'deadline-cleanup');
    assert.equal(mapping.caseId, row.caseId);
  }

  assert.equal(current.authority.kind, 'MO1307ProspectiveHelperBoundAuthority');
  assert.equal(current.authority.status, 'ADOPTED_PROSPECTIVELY');
  assert.equal(current.authority.identity, 'PROSPECTIVE_HELPER_BOUND@1.0.0');
  assert.equal(current.authority.valueMs, 8000);
  assert.equal(current.authority.historical.H, 'NOT_ESTABLISHED');
  assert.deepEqual(current.authority.relation, { equality: 'TIMEOUT', success: 'elapsedMs < 8000', timeout: 'elapsedMs >= 8000' });
  assert.equal(current.authority.humanReleaseAuthorization, false);
  assert.equal(current.authority.retroactive, false);
  assert.equal(current.authority.certification, false);
  assert.equal(current.candidate.kind, 'MO1307ProspectiveHelperBoundCandidate');
  assert.equal(current.candidate.result, 'READY_FOR_BINDING');
  assert.equal(current.candidate.package.packageMemberCount, 89);
  assert.equal(current.candidate.package.externalProductionDependencies, 0);
  assert.equal(current.candidate.productionTree, PRODUCTION_TREE);
  assert.equal(current.candidate.historicalAuthorities.H, 'NOT_ESTABLISHED');
  assert.equal(current.candidate.humanReleaseAuthorization, false);
  assert.equal(current.candidate.certification, false);
  assert.equal(current.consistency.kind, 'MO1307ProspectiveHelperBoundConsistencyValidation');
  assert.equal(current.consistency.result, 'PASS');
  assert.deepEqual(current.consistency.strictBoundary, { equalityFailsClosed: true, success: '<8000', timeout: '>=8000' });
  assert.equal(current.consistency.package.members, 89);
  assert.equal(current.consistency.package.contractMembers, 53);
  assert.equal(current.consistency.package.externalProductionDependencies, 0);
  assert.equal(current.consistency.productionOrHelperExecuted, false);
  assert.equal(current.consistency.certificationExecuted, false);
  assert.equal(current.binding.kind, 'MO1307ProspectiveHelperBoundBinding');
  assert.equal(current.binding.result, 'NEW_PRODUCTION_CANDIDATE_READY_FOR_PHASE3');
  assert.equal(current.binding.bindingRole, 'C3TB');
  assert.equal(current.binding.binding.soleParent, C3T);
  assert.equal(current.binding.binding.productionChanges, false);
  assert.equal(current.binding.implementation.commit, C3T);
  assert.equal(current.binding.implementation.rootTree, C3T_TREE);
  assert.equal(current.binding.package.memberCount, 89);
  assert.equal(current.binding.package.productionTree, PRODUCTION_TREE);
  assert.equal(current.binding.package.packageIdentity, current.candidate.package.packageIdentity);
  assert.equal(current.binding.authorities.H, 'NOT_ESTABLISHED');
  assert.equal(current.binding.phase3CExecuted, false);
  assert.equal(current.binding.phase3DExecuted, false);
  assert.equal(current.binding.humanReleaseAuthorization, false);
  assert.equal(current.binding.certification, false);
  assert.equal(current.bindingVerification.kind, 'MO1307ProspectiveHelperBoundBindingVerification');
  assert.equal(current.bindingVerification.result, 'PASS');
  assert.equal(current.bindingVerification.candidateCommit, C3T);
  assert.equal(current.bindingVerification.candidateRootTree, C3T_TREE);
  assert.equal(current.bindingVerification.productionTree, PRODUCTION_TREE);
  assert.equal(current.bindingVerification.productionChangesInBindingCommit, false);
  assert.ok(current.bindingVerification.checks.includes('C3TB_BINDING_ONLY'));
  assert.deepEqual(comparablePin(currentPins.binding), current.bindingVerification.binding);

  const generatedPaths = current.consistency.generatedResources.map(record => `${PRODUCT}/${record.path}`);
  assert.equal(generatedPaths.length, 7);
  for (const generated of current.consistency.generatedResources) {
    const relativePath = `${PRODUCT}/${generated.path}`;
    assert.deepEqual(comparablePin(currentGitPin(C3TB, relativePath)), { path: relativePath, byteLength: generated.byteLength, sha256: generated.sha256 });
    const bound = current.binding.resources.find(record => record.path === relativePath);
    assert.ok(bound, `${relativePath}: bound generated resource`);
    assert.deepEqual(comparablePin(bound), { path: relativePath, byteLength: generated.byteLength, sha256: generated.sha256 });
  }
  const definitions = JSON.parse(regularBytes(path.join(ROOT, PRODUCT, 'contracts/definitions.json')).toString('utf8'));
  assert.equal(definitions.limits.helperDeadlineMs, 8000);

  const artifacts = Object.fromEntries(Object.entries(RECEIPT_PATHS).map(([key, relativePath]) => [key, jsonArtifact(relativePath)]));
  const plan = artifacts.plan.value;
  const preExecutionSeal = artifacts.preExecutionSeal.value;
  const dependencyReuse = artifacts.dependencyReuse.value;
  const smoke = artifacts.headlessSmoke.value;
  const smokeSeal = artifacts.headlessSmokeSeal.value;
  const headlessSecurity = artifacts.headlessSecurity.value;
  const headlessSecuritySeal = artifacts.headlessSecuritySeal.value;
  const deadlineCampaign = artifacts.deadlineCampaign.value;
  const deadline = artifacts.deadline.value;
  const deadlineBoundary = artifacts.deadlineBoundary.value;
  const equivalence = artifacts.equivalence.value;
  const nativeLastError = artifacts.nativeLastError.value;
  const protocol = artifacts.protocol.value;
  const toctou = artifacts.toctou.value;
  const securityManifest = artifacts.securityManifest.value;

  assert.equal(plan.kind, 'MO1307Phase3CR2C3TBCampaignPlan');
  assert.equal(plan.status, 'SEALED_NOT_EXECUTED');
  assert.equal(plan.candidate.role, 'C3TB');
  assert.equal(plan.candidate.commit, C3TB);
  assert.equal(plan.candidate.tree, C3TB_TREE);
  assert.equal(plan.candidate.soleParent, C3T);
  assert.equal(plan.candidate.productionTree, PRODUCTION_TREE);
  assert.deepEqual(plan.authority.selection, campaignGitPin(currentPins.map));
  assert.deepEqual(plan.authority.binding, campaignGitPin(currentPins.binding));
  assert.deepEqual(plan.authority.bindingVerification, campaignGitPin(currentPins.bindingVerification));
  assert.equal(plan.accounting.historical.inventory, 551);
  assert.equal(plan.accounting.historical.selectedFresh, 89);
  assert.equal(plan.accounting.historical.selectedRejections, 74);
  assert.equal(plan.accounting.historical.dependencyReuse, 462);
  assert.equal(plan.accounting.historical.omitted, 0);
  assert.equal(plan.accounting.candidateSpecificSupplementalControls.count, 2);
  assert.equal(plan.accounting.headlessCorrectionCases.count, 19);
  assert.equal(plan.accounting.requiredSourceAndSecurityReviews.count, 12);
  assert.deepEqual(plan.stageOrder, ['DEPENDENCY_REUSE_PROOF_462', 'HEADLESS_SMOKE', 'HEADLESS_SECURITY_A_TO_S_19', 'DEADLINE_CLEANUP_SELECTED_7', 'EQUIVALENCE_SELECTED_67', 'NATIVE_LAST_ERROR_METADATA', 'PROTOCOL_SELECTED_12', 'TOCTOU_BOUNDARIES_SELECTED_2', 'CASE_SENSITIVE_RECONCILIATION', 'INDEPENDENT_FINAL_REVIEW', 'FINAL_APPEND_ONLY_SEAL']);
  assert.equal(preExecutionSeal.kind, 'MO1307Phase3CR2C3TBPreExecutionSeal');
  assert.equal(preExecutionSeal.result, 'SEALED_NOT_EXECUTED');
  assert.deepEqual(preExecutionSeal.candidate, plan.candidate);
  assert.deepEqual(preExecutionSeal.campaignPlan, artifacts.plan.pin);
  assert.deepEqual(preExecutionSeal.selectionMap, campaignGitPin(currentPins.map));
  assert.deepEqual(preExecutionSeal.binding, campaignGitPin(currentPins.binding));
  assert.deepEqual(preExecutionSeal.bindingVerification, campaignGitPin(currentPins.bindingVerification));
  assert.equal(preExecutionSeal.appendOnly.writesUseExclusiveCreate, true);
  assert.equal(preExecutionSeal.appendOnly.productModified, false);
  assert.equal(preExecutionSeal.appendOnly.historicalArtifactsModified, false);
  const sealedManifest = plan.finalizedToolInputs.find(record => record.path === RECEIPT_PATHS.securityManifest);
  assert.ok(sealedManifest, 'security manifest sealed by preflight');
  assert.deepEqual(comparablePin(sealedManifest), artifacts.securityManifest.pin);

  assert.equal(dependencyReuse.kind, 'MO1307Phase3CR2DependencyReuse');
  assert.equal(dependencyReuse.result, 'PASS');
  assert.equal(dependencyReuse.candidate, C3TB);
  assert.equal(dependencyReuse.candidateImplementation, C3T);
  assert.equal(dependencyReuse.historicalAcceptedPhase3C, HISTORICAL_PHASE3C);
  assert.equal(dependencyReuse.counts.reusedHistoricalControls, 462);
  assert.equal(dependencyReuse.counts.selectedFreshHistoricalControls, 89);
  assert.equal(dependencyReuse.counts.omittedHistoricalControls, 0);
  assert.equal(dependencyReuse.rows.length, 462);
  assertExactSet(dependencyReuse.rows.map(row => row.id), reuseIds, 'dependency reuse rows');
  const dependencyReuseById = indexUnique(dependencyReuse.rows, 'id', 'dependency reuse rows');
  assert.equal(dependencyReuse.rows.every(row => row.disposition === 'REUSED_EXACT'), true);
  assert.equal(dependencyReuse.rows.every(row => row.equalityProof?.allExercisedFacetsEqual === true), true);
  assert.equal(dependencyReuse.rows.some(row => selectedSet.has(row.id)), false);
  assert.deepEqual(dependencyReuse.dependencyDisposition, {
    phase: 'SEALED_CAMPAIGN',
    policy: 'REUSED_EXACT requires every exercised facet to remain equal; any post-seal mismatch is fatal drift and is never moved adaptively.',
    reusedExact: 462,
    movedToFresh: [],
    unresolved: [],
    mismatches: [],
  });
  assert.equal(dependencyReuse.accounting.movedToFreshBeforeSeal, 0);
  assert.equal(dependencyReuse.accounting.postSealAdaptiveMoveAllowed, false);
  for (const row of FRESH_REUSE_SUPPORT) {
    const reuse = dependencyReuseById.get(row.controlId);
    assert.equal(reuse.disposition, 'REUSED_EXACT');
    assert.equal(reuse.equalityProof.allExercisedFacetsEqual, true);
  }

  assert.equal(smoke.kind, 'MO1307Phase3CR2HeadlessSmokeReceipt');
  assert.equal(smoke.result, 'PASS');
  assert.equal(smoke.failure, null);
  assert.equal(smoke.candidate, C3TB);
  assert.equal(smoke.candidateStatus, 'BOUND_C3TB');
  assert.equal(smoke.packageTree, PRODUCTION_TREE);
  assert.equal(smoke.sourceUnchanged, true);
  assert.equal(smoke.source.length, 89);
  assert.equal(smoke.helperInvocations, 1);
  assert.equal(smoke.additionalCasesExecuted, 0);
  assert.equal(smoke.noRetry, true);
  assert.equal(smoke.limitsVerified, true);
  assert.equal(smoke.case.result, 'PASS');
  assert.equal(smoke.case.helperInvocations, 1);
  assert.equal(smoke.case.response.status, 'OK');
  assert.equal(smoke.case.exitCode, 0);
  assert.equal(smoke.case.stderrTotalBytes, 0);
  assert.equal(smoke.case.snapshot.cleanupConfirmed, true);
  assert.equal(smoke.case.snapshot.activeRole, null);
  assert.equal(smoke.case.startupGate.positiveSoleHelperMembership, true);
  assert.equal(smoke.case.startupGate.selfFreeConsoleSucceeded, true);
  assert.equal(smoke.case.startupGate.postDetachMembershipQuery, false);
  assert.equal(smokeSeal.kind, 'MO1307Phase3CR2HeadlessSmokeSeal');
  assert.equal(smokeSeal.candidate, C3TB);
  assert.equal(smokeSeal.productionCandidate, C3T);
  assert.equal(smokeSeal.packageTree, PRODUCTION_TREE);
  assert.equal(smokeSeal.sourceBaseHead, C3TB);
  assert.equal(smokeSeal.sourceParent, C3T);
  assert.equal(smokeSeal.sourceBasePackageTree, PRODUCTION_TREE);
  assert.equal(smokeSeal.workingProductionDiff, '');
  assert.deepEqual(smoke.seal, artifacts.headlessSmokeSeal.pin);
  assert.equal(smokeSeal.decodedRequest.operation, 'READ_SET');
  assert.equal(smokeSeal.launch.executable, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.deepEqual(smokeSeal.launch.options.env, { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' });
  assert.equal(smokeSeal.launch.options.detached, false);
  assert.equal(smokeSeal.launch.options.shell, false);
  assert.equal(smokeSeal.policy.once, true);
  assert.equal(smokeSeal.policy.noRetry, true);

  assert.equal(securityManifest.kind, 'MO1307Phase3CR2HeadlessSecurityMatrix');
  assert.equal(securityManifest.candidate, C3TB);
  assert.equal(securityManifest.productionCandidate, C3T);
  assert.equal(securityManifest.productionTree, PRODUCTION_TREE);
  assert.deepEqual(securityManifest.items.map(item => item.id), EXPECTED_HEADLESS);
  assert.equal(headlessSecuritySeal.kind, 'MO1307Phase3CR2HeadlessSecuritySeal');
  assert.equal(headlessSecuritySeal.candidate, C3TB);
  assert.equal(headlessSecuritySeal.productionCandidate, C3T);
  assert.equal(headlessSecuritySeal.productionTree, PRODUCTION_TREE);
  assert.deepEqual(headlessSecuritySeal.smoke, artifacts.headlessSmoke.pin);
  assert.deepEqual(headlessSecuritySeal.matrix, artifacts.securityManifest.pin);
  assert.equal(headlessSecuritySeal.exactExtraction, true);
  assert.equal(headlessSecurity.kind, 'MO1307Phase3CR2HeadlessSecurityReceipt');
  assert.equal(headlessSecurity.result, 'PASS');
  assert.equal(headlessSecurity.failure, null);
  assert.equal(headlessSecurity.candidate, C3TB);
  assert.equal(headlessSecurity.productionCandidate, C3T);
  assert.equal(headlessSecurity.productionTree, PRODUCTION_TREE);
  assert.equal(headlessSecurity.sourceUnchanged, true);
  assert.equal(headlessSecurity.source.length, 89);
  assert.equal(headlessSecurity.newProductHelpers, 0);
  assert.equal(headlessSecurity.noRetry, true);
  assert.deepEqual(headlessSecurity.allNineteenRequired, EXPECTED_HEADLESS);
  assertExactSet(headlessSecurity.rows.map(row => row.id), EXPECTED_HEADLESS, 'headless A-S rows');
  assert.equal(headlessSecurity.rows.every(row => row.result === 'PASS'), true);
  assertExactSet(headlessSecurity.caseAccounting.map(row => row.id), EXPECTED_HEADLESS, 'headless A-S accounting');
  assert.equal(headlessSecurity.caseAccounting.every(row => row.result === 'PASS'), true);
  const headlessById = indexUnique(headlessSecurity.rows, 'id', 'headless security rows');
  const startupRows = headlessSecurity.rows.flatMap(row => row.startupCases ?? []);
  assertExactSet(startupRows.map(row => row.name), securityManifest.startupScenarios.map(row => row.name), 'headless startup scenarios');
  assert.equal(startupRows.length, 15);
  assert.equal(startupRows.every(row => row.result === 'PASS'), true);
  assert.equal(headlessSecurity.engineeringExtractedFunctionProcesses, 15);
  for (const id of ['H', 'I', 'J']) {
    const row = headlessById.get(id);
    assert.equal(row.hostAuthority, 'NONE');
    assert.equal(row.consoleReattachmentOrAllocation, 'ABSENT');
    assert.equal(row.membershipCallSites, 1);
    assert.equal(row.postDetachMembershipQuery, false);
    for (const forbidden of ['TerminateProcess', 'OpenProcess', 'GetProcessId', 'GetConsoleWindow', 'GetWindowThreadProcessId', 'CreateToolhelp32Snapshot', 'Process32FirstW', 'Process32NextW', 'WaitForSingleObject', 'AllocConsole', 'AttachConsole']) {
      assert.equal(row.nativeImports.includes(forbidden), false, `${id}: forbidden native import ${forbidden}`);
    }
  }
  assert.equal(headlessById.get('R').nonOverlap.length, 2);
  assert.equal(headlessById.get('S').boundaries.length, 6);

  assert.equal(deadlineCampaign.kind, 'MO1307Phase3CR2RefreshDeadlineEnvironment');
  assert.equal(deadlineCampaign.baseline, C3TB);
  assert.equal(deadline.kind, 'MO1307Phase3CR2RefreshDeadlineEnvironmentReceipt');
  assert.equal(deadline.result, 'PASS');
  assert.equal(deadline.failure, null);
  assert.equal(deadline.productionChanged, false);
  assert.equal(deadline.cases.length, 18);
  assert.equal(deadline.authority.identity, 'PROSPECTIVE_HELPER_BOUND@1.0.0');
  assert.equal(deadline.authority.historicalH, 'NOT_ESTABLISHED');
  assert.equal(deadline.authority.success, 'elapsedMs < 8000');
  assert.equal(deadline.authority.timeout, 'elapsedMs >= 8000');
  assert.deepEqual(deadline.limits, { helperMs: 8000, aggregateHelperActiveMs: 20000, cliMs: 30000, apiWorkerMs: 10000, cleanupMs: 2000 });
  assert.equal(deadlineBoundary.result, 'PASS');
  assert.equal(deadlineBoundary.sourceUnchanged, true);
  assert.equal(deadlineBoundary.observerExit, 0);
  assert.equal(deadlineBoundary.remainingOwnedProcesses.length, 0);
  assert.equal(deadlineBoundary.nativeCoverage.length, deadline.invocations.length);
  assert.equal(deadlineBoundary.nativeCoverage.every(row => row.closed && row.streamsClosed), true);
  assert.deepEqual(deadlineBoundary.requiredObserved.map(row => row.name), ['timeout-exact-mapping', 'late-native-success-refused', 'crash-closed-transport']);
  assert.equal(deadlineBoundary.requiredObserved.every(row => row.seen && row.closed && row.streamsClosed), true);
  assert.equal(deadlineBoundary.observedNativeProcessCount, deadlineBoundary.nativeCoverage.filter(row => row.seen).length);
  assert.equal(deadlineBoundary.observedNativeProcessCount >= 3, true);
  assert.deepEqual(deadlineCampaign.referenceProvenance, deadline.referenceProvenance);
  assertReferenceProvenance(deadline.referenceProvenance, `${EVIDENCE_RELATIVE}/deadline-cleanup/attempt-1/reference-helper.ps1`, n15ReferencePin);

  assert.equal(equivalence.kind, 'MO1307ReadSetEquivalence');
  assert.equal(equivalence.result, 'PASS');
  assert.equal(equivalence.failure, null);
  assert.equal(equivalence.candidate, C3TB);
  assert.equal(equivalence.expectedCases, 69);
  assert.equal(equivalence.cases.length, 69);
  assert.equal(equivalence.exactFramesCompared, true);
  assert.equal(equivalence.helperDeadlineMs, 8000);
  assert.equal(equivalence.productHooksAdded, false);
  assert.equal(equivalence.noSourceWorktreeWrites, true);
  assert.equal(equivalence.network, false);
  assertReferenceProvenance(equivalence.referenceProvenance, `${EVIDENCE_RELATIVE}/equivalence/attempt1/reference-helper.ps1`, n15ReferencePin);
  assert.equal(nativeLastError.kind, 'MO1307Phase3CR2NativeLastErrorReceipt');
  assert.equal(nativeLastError.version, '1.0.0');
  assert.equal(nativeLastError.candidate, C3TB);
  assert.equal(nativeLastError.candidateTree, C3TB_TREE);
  assert.equal(nativeLastError.implementation, C3T);
  assert.equal(nativeLastError.productionTree, PRODUCTION_TREE);
  assert.equal(nativeLastError.result, 'PASS');
  assert.equal(nativeLastError.failure, null);
  assert.equal(nativeLastError.count, 1);
  assert.deepEqual(nativeLastError.caseAccounting, [{ ordinal: 1, id: NATIVE_LAST_ERROR_CASE, status: 'PASS' }]);
  assert.deepEqual(nativeLastError.source, comparablePin(helperPin));
  assert.deepEqual(nativeLastError.sourceGit, { commit: C3TB, blob: helperPin.gitBlob });
  assert.equal(nativeLastError.sourceUnchanged, true);
  assert.equal(nativeLastError.nativeApiInvocations, 0);
  assert.equal(nativeLastError.helperRequests, 0);
  assert.equal(nativeLastError.engineeringMetadataProcesses, 1);
  assert.equal(nativeLastError.retries, 0);
  assert.equal(nativeLastError.certification, false);
  assert.equal(nativeLastError.reflectedMethodCount, 8);
  assert.deepEqual(nativeLastError.exactMethodKeys, NATIVE_METHOD_KEYS);
  assert.equal(nativeLastError.exactExpectedMetadata, true);
  assert.equal(nativeLastError.otherSevenExpectedUnchangedMetadata, true);
  assert.equal(nativeLastError.metadataProcess.result, 'PASS');
  assert.equal(nativeLastError.metadataProcess.boundedMs, 10000);
  assert.equal(nativeLastError.metadataProcess.exit, 0);
  assert.equal(nativeLastError.metadataProcess.signal, null);
  assert.equal(nativeLastError.metadataProcess.error, null);
  assert.equal(nativeLastError.metadataProcess.stderr.byteLength, 0);
  assert.equal(nativeLastError.metadataProcess.metadata.length, 8);
  assert.deepEqual(nativeLastError.metadataProcess.metadata.map(row => row.key), NATIVE_METHOD_KEYS);
  for (const row of nativeLastError.metadataProcess.metadata) {
    assert.equal(row.library, 'kernel32.dll');
    assert.equal(row.entryPoint, row.name);
    assert.equal(row.charSet, 3);
    assert.equal(row.callingConvention, 1);
    assert.equal(row.preserveSig, true);
    assert.equal(row.pinvokeImpl, true);
    assert.equal(row.implementationFlags, 128);
    assert.equal(row.setLastError, row.name === 'CreateFileW');
    assert.equal(row.exactSpelling, row.name === 'CreateFileW');
  }
  assert.deepEqual(nativeLastError.createFileW, nativeLastError.metadataProcess.metadata.find(row => row.name === 'CreateFileW'));
  assert.equal(nativeLastError.createFileW.returnType, 'Microsoft.Win32.SafeHandles.SafeFileHandle');
  assert.deepEqual(nativeLastError.createFileW.parameterTypes, ['System.String', 'System.UInt32', 'System.UInt32', 'System.IntPtr', 'System.UInt32', 'System.UInt32', 'System.IntPtr']);
  assert.equal(nativeLastError.sourceAssertions.exactInitializeNativeExtraction, true);
  assert.equal(nativeLastError.sourceAssertions.inertConfirmConsoleQuiescenceStub, true);
  assert.equal(nativeLastError.sourceAssertions.extractedNativeApiInvocations, 0);
  assert.equal(nativeLastError.sourceAssertions.generatedScriptNativeApiInvocationCallSites, 0);
  assert.equal(nativeLastError.sourceAssertions.generatedScriptHelperRequestConstructions, 0);
  assert.deepEqual(nativeLastError.sourceAssertions.immediateLastErrorCaptureCallSites.map(row => row.function), ['Open-Native', 'Assert-NativeAbsent']);
  assert.equal(nativeLastError.sourceAssertions.immediateLastErrorCaptureCallSites.every(row => row.adjacentPhysicalLines && row.getLastWin32ErrorLine === row.createFileWLine + 1), true);
  assert.equal(nativeLastError.sourceAssertions.allGetLastWin32ErrorCallSitesCovered, true);
  assert.equal(nativeLastError.sourceAssertions.error2Comparisons, 2);
  assert.equal(nativeLastError.sourceAssertions.error2OnlyMissingLeafSemantics, true);
  assert.equal(nativeLastError.sourceAssertions.openNativeMissingInputLeafMapsTo, 'MO1307_INPUT');
  assert.equal(nativeLastError.sourceAssertions.openNativeMissingAncestorMapsTo, 'MO1307_FILESYSTEM_BOUNDARY');
  assert.equal(nativeLastError.sourceAssertions.assertNativeAbsentAcceptsOnlyErrorFileNotFound, true);
  assert.equal(nativeLastError.sourceAssertions.allOtherOpenFailuresMapTo, 'MO1307_FILESYSTEM_BOUNDARY');
  assertPinCurrent(nativeLastError.generatedScript, 'native-last-error generated metadata script');
  assertPinCurrent(nativeLastError.metadataProcess.stdout, 'native-last-error metadata stdout');
  assertPinCurrent(nativeLastError.metadataProcess.stderr, 'native-last-error metadata stderr');
  assert.equal(protocol.kind, 'MO1307Phase3CR2RefreshConsumerProtocol');
  assert.equal(protocol.result, 'PASS');
  assert.equal(protocol.candidate, C3TB);
  assert.equal(protocol.count, 13);
  assert.equal(protocol.negativeCount, 12);
  assert.equal(toctou.kind, 'MO1307Phase3CR2RefreshAdditionalTOCTOU');
  assert.equal(toctou.result, 'PASS');
  assert.equal(toctou.candidate, C3TB);
  assert.equal(toctou.rows.length, 2);
  assertReferenceProvenance(toctou.referenceProvenance, `${EVIDENCE_RELATIVE}/toctou-boundaries/attempt1/reference-helper.ps1`, n15ReferencePin);

  const primaryCaseIdsBySuite = Object.fromEntries(['equivalence', 'protocol', 'toctou', 'deadline-cleanup'].map(suite => {
    const caseIds = historicalMap.rows.filter(row => row.suite === suite).map(row => row.caseId);
    assert.equal(new Set(caseIds).size, caseIds.length, `${suite}: historical case IDs unique`);
    return [suite, caseIds];
  }));
  const expectedRawCounts = { equivalence: 69, protocol: 13, toctou: 2, 'deadline-cleanup': 18 };
  const receiptBySuite = {
    equivalence: { value: equivalence, pin: artifacts.equivalence.pin },
    protocol: { value: protocol, pin: artifacts.protocol.pin },
    toctou: { value: toctou, pin: artifacts.toctou.pin },
    'deadline-cleanup': { value: deadline, pin: artifacts.deadline.pin },
  };
  const freshCaseBySuite = {};
  for (const suite of Object.keys(receiptBySuite)) {
    const expected = [...primaryCaseIdsBySuite[suite], ...SUPPORTING_CASES[suite]];
    assert.equal(expected.length, expectedRawCounts[suite], `${suite}: expected raw count`);
    freshCaseBySuite[suite] = assertPassingCaseSet(receiptBySuite[suite].value, expected, `${suite} fresh receipt`);
  }
  const supportingIds = Object.entries(SUPPORTING_CASES).flatMap(([suite, ids]) => ids.map(id => `${suite}:${id}`));
  assert.equal(supportingIds.length, 10);
  assert.equal(new Set(supportingIds).size, 10);
  assert.equal(Object.values(expectedRawCounts).reduce((total, count) => total + count, 0) + smoke.helperInvocations, 103);
  const freshlyExecutedReuseCandidateMappings = FRESH_REUSE_SUPPORT.map(row => {
    const witness = freshCaseBySuite['deadline-cleanup'].get(row.caseId);
    assert.ok(witness, `${row.controlId}: fresh supporting witness`);
    assert.equal(witness.result, 'PASS');
    assert.equal(supportingIds.includes(`deadline-cleanup:${row.caseId}`), false);
    return {
      controlId: row.controlId,
      suite: 'deadline-cleanup',
      caseId: row.caseId,
      freshWitnessResult: 'PASS',
      disposition: dependencyReuseById.get(row.controlId).disposition,
      selectedFreshOutcomeSubstituted: false,
    };
  });
  assert.equal(freshlyExecutedReuseCandidateMappings.length, 4);
  assert.equal(selectedIds.length + supportingIds.length + freshlyExecutedReuseCandidateMappings.length, 103);
  const missingFileCase = freshCaseBySuite.equivalence.get('missing-file');
  assert.ok(missingFileCase, 'missing-file current candidate behavior witness');
  assert.equal(missingFileCase.result, 'PASS');
  assert.equal(missingFileCase.exactResponseEqual, true);
  assert.equal(missingFileCase.code, 'MO1307_INPUT');
  assert.equal(missingFileCase.status, 'ERROR');
  assert.deepEqual(normalizedPin(missingFileCase.candidate.helperSource), comparablePin(helperPin));

  const timeoutCase = freshCaseBySuite['deadline-cleanup'].get('timeout-exact-mapping');
  assert.equal(timeoutCase.detail.accepted, false);
  assert.equal(timeoutCase.detail.errorCode, 'MO1307_TIMEOUT');
  assert.equal(timeoutCase.detail.mappedPublicExit, 29);
  assert.equal(timeoutCase.detail.lateNativeOK, false);
  assert.equal(timeoutCase.detail.exactFixedLaunch, true);
  assert.equal(timeoutCase.detail.snapshot.terminalCode, 'MO1307_TIMEOUT');
  const lateCase = freshCaseBySuite['deadline-cleanup'].get('late-native-success-refused');
  assert.equal(lateCase.detail.accepted, false);
  assert.equal(lateCase.detail.errorCode, 'MO1307_TIMEOUT');
  assert.equal(lateCase.detail.mappedPublicExit, 29);
  assert.equal(lateCase.detail.lateNativeOK, true);
  assert.equal(lateCase.detail.snapshot.terminalCode, 'MO1307_TIMEOUT');
  assert.ok(lateCase.detail.observation.deliveredAt >= lateCase.detail.snapshot.terminalAt);
  const sequenceCase = freshCaseBySuite['deadline-cleanup'].get('deadline-sequence-no-partial-or-late-success');
  assert.deepEqual(sequenceCase.detail, {
    deadlineMs: 8000,
    successRule: 'elapsedMs < 8000',
    timeoutRule: 'elapsedMs >= 8000',
    firstError: 'MO1307_TIMEOUT',
    subsequentTerminalRefusal: 'MO1307_INPUT',
  });
  const fixedEnvironmentCase = freshCaseBySuite['deadline-cleanup'].get('fixed-launch-combined-environment-poison');
  assert.equal(fixedEnvironmentCase.detail.accepted, true);
  assert.equal(fixedEnvironmentCase.detail.errorCode, null);
  assert.equal(fixedEnvironmentCase.detail.exactFixedLaunch, true);
  assert.equal(fixedEnvironmentCase.detail.snapshot.cleanupConfirmed, true);
  assert.ok(fixedEnvironmentCase.detail.poisonedKeys.length > 0);
  const sourceReviewCase = freshCaseBySuite['deadline-cleanup'].get('bounded-state-and-fixed-source-review');
  assert.equal(sourceReviewCase.detail.definitionsProjection.allFieldsExceptHelperDeadlineMsEqual, true);
  assert.equal(sourceReviewCase.detail.definitionsProjection.historicalHelperDeadlineMs, 5000);
  assert.equal(sourceReviewCase.detail.definitionsProjection.currentHelperDeadlineMs, 8000);
  assert.equal(sourceReviewCase.detail.rawHistoricalSourceEqualityRequired, false);
  assert.equal(sourceReviewCase.detail.dependencyAwareSourceReview, true);
  const sourceDeltaReview = sourceReviewCase.detail.sourceDeltaReview;
  assert.equal(sourceDeltaReview.kind, 'MO1307Phase3CR2DependencyAwareSourceReview');
  assert.equal(sourceDeltaReview.result, 'PASS');
  assert.equal(sourceDeltaReview.mode, 'ACTUAL_CAMPAIGN');
  assert.equal(sourceDeltaReview.authorizedDiff.result, 'PASS');
  assert.equal(sourceDeltaReview.authorizedDiff.changedFileCount, 9);
  assert.equal(sourceDeltaReview.authorizedDiff.hunkCount, 28);
  assert.equal(sourceDeltaReview.authorizedDiff.unexpectedChangeCount, 0);
  assert.equal(sourceDeltaReview.authorizedDiff.allHunksClassified, true);
  assert.equal(sourceDeltaReview.authorizedDiff.noUnauthorizedSourceDelta, true);
  assert.equal(sourceDeltaReview.authorizedDiff.securityCriticalHunkCount, 14);
  assert.equal(sourceDeltaReview.authorizedDiff.everySecurityCriticalHunkReviewed, true);
  assert.deepEqual(sourceDeltaReview.authorizedDiff.categoryCounts, {
    AUTHORIZED_HEADLESS_CORRECTION: 9,
    AUTHORIZED_NATIVE_LASTERROR_CORRECTION: 2,
    AUTHORIZED_OPEN_CHAIN_CORRECTION: 1,
    AUTHORIZED_DEADLINE_CORRECTION: 2,
    DERIVED_METADATA_CHANGE: 3,
    DOCUMENTATION_ONLY: 11,
    UNEXPECTED_CHANGE: 0,
  });
  assert.equal(sourceDeltaReview.authorizedDiff.hunks.length, 28);
  assert.equal(sourceDeltaReview.commentHandling.method, 'PER_HUNK_LANGUAGE_AWARE_EXECUTABLE_PROJECTION_NO_GLOBAL_SOURCE_ELISION');
  assert.equal(sourceDeltaReview.commentHandling.commentOnlyHunkCount, 5);
  assert.equal(sourceDeltaReview.commentHandling.allCommentOnlyExecutableProjectionsEqual, true);
  assert.equal(sourceDeltaReview.commentHandling.globallyStrippedSourceEqualityUsed, false);
  assert.equal(sourceDeltaReview.securitySemantics.result, 'PASS');
  const requiredConsoleSemantics = [
    'initial-console-query-failure-fails-closed',
    'positive-sole-helper-membership',
    'freeconsole-required',
    'no-post-detach-second-membership-query',
    'no-numeric-ppid-ownership',
    'no-getconsolewindow-ownership',
    'no-speculative-conhost-termination',
    'supervisor-process-pipe-quiescence-required',
  ];
  for (const id of requiredConsoleSemantics) assert.equal(sourceDeltaReview.securitySemantics.checks.find(row => row.id === id)?.result, 'PASS', id);
  assert.equal(sourceDeltaReview.dependencySelection.result, 'PASS');
  assert.equal(sourceDeltaReview.dependencySelection.changedDependencies.result, 'PASS');
  assert.equal(sourceDeltaReview.dependencySelection.changedDependencies.count, 9);
  assert.equal(sourceDeltaReview.dependencySelection.changedDependencies.disposition, 'FRESH_REVIEW_REQUIRED_AND_MAPPED');
  assert.equal(sourceDeltaReview.dependencySelection.changedDependencies.rows.every(row => row.disposition === 'FRESH_REVIEW_REQUIRED_AND_MAPPED'), true);
  assert.equal(sourceDeltaReview.dependencySelection.reusedDependencies.result, 'PASS');
  assert.equal(sourceDeltaReview.dependencySelection.reusedDependencies.action, 'REUSE_EXACT');
  assert.equal(sourceDeltaReview.dependencySelection.reusedDependencies.count, 462);
  assert.equal(sourceDeltaReview.dependencySelection.reusedDependencies.negativeCount, dependencyReuse.rows.filter(row => row.negative === true).length);
  assert.equal(sourceDeltaReview.dependencySelection.reusedDependencies.rowsSha256, sha256(Buffer.from(canonical(dependencyReuse.rows))));
  assert.deepEqual(sourceDeltaReview.dependencySelection.reusedDependencies.failures, []);
  assert.deepEqual(sourceDeltaReview.dependencySelection.reusedDependencies.movedToFresh, []);
  assert.deepEqual(sourceDeltaReview.dependencySelection.reusedDependencies.unresolved, []);
  assert.deepEqual(sourceDeltaReview.dependencySelection.reusedDependencies.mismatches, []);
  assert.equal(sourceDeltaReview.dependencySelection.reusedDependencies.movedToFreshBeforeSeal, 0);
  assert.equal(sourceDeltaReview.dependencySelection.reusedDependencies.postSealAdaptiveMoveAllowed, false);
  assert.deepEqual(
    sourceDeltaReview.sourcePins.filter(pin => pin.path === RECEIPT_PATHS.dependencyReuse),
    [artifacts.dependencyReuse.pin],
  );
  assert.equal(sourceDeltaReview.unchangedSourceReview.result, 'PASS');
  assert.equal(sourceDeltaReview.unchangedSourceReview.readSetBodyByteIdentical, true);
  assert.equal(sourceDeltaReview.productionExecuted, false);
  assert.equal(sourceDeltaReview.helperExecuted, false);
  assert.equal(sourceDeltaReview.securityControlExecuted, false);
  assert.equal(sourceDeltaReview.certificationClaims, 0);
  assert.equal(sourceReviewCase.detail.readSetBodyIdentical, true);
  assert.deepEqual(sourceReviewCase.detail.referenceProvenance, deadline.referenceProvenance);
  assert.equal(sourceReviewCase.detail.findings.length, 5);
  assert.equal(equivalence.cases.every(row => row.exactResponseEqual === true), true);
  assert.equal(toctou.rows.every(row => row.exactResponseEquivalent === true), true);

  const freshRows = [];
  for (const id of selectedIds) {
    const control = historicalMapById.get(id);
    const historicalResult = historicalResultById.get(id);
    assert.ok(control, `${id}: historical control`);
    assert.ok(historicalResult, `${id}: historical result`);
    assert.equal(historicalResult.result, 'PASS_FRESH', `${id}: historical result status`);
    assert.equal(historicalResult.adoptedHistoricalOutcome, false, `${id}: historical outcome freshness`);
    assert.equal(historicalResult.suite, control.suite, `${id}: historical suite`);
    assert.equal(historicalResult.caseId, control.caseId, `${id}: historical case ID`);
    assert.equal(historicalResult.negative, control.negative, `${id}: historical negative flag`);
    let rawWitness;
    let receipt;
    let supportingReceipts = [];
    if (Object.hasOwn(freshCaseBySuite, control.suite)) {
      rawWitness = freshCaseBySuite[control.suite].get(control.caseId);
      assert.ok(rawWitness, `${id}: fresh case ${control.caseId}`);
      receipt = receiptBySuite[control.suite].pin;
    } else {
      assert.equal(id, 'runtime-boundary:fixed-powershell-launch', `${id}: unsupported selected suite`);
      assert.equal(control.suite, 'runtime-main');
      const actual = { accepted: smoke.case.result === 'PASS' && smoke.case.response.status === 'OK', noPublication: smokeSeal.decodedRequest.operation === 'READ_SET' };
      assert.deepEqual(actual, historicalResult.expected);
      rawWitness = {
        id: control.caseId,
        layer: 'EXACT_C3TB_HEADLESS_SMOKE_FIXED_LAUNCH',
        expected: historicalResult.expected,
        actual,
        result: 'PASS',
        launch: smokeSeal.launch,
        helperInvocations: smoke.helperInvocations,
        response: smoke.case.response,
        sourceBaseHead: smokeSeal.sourceBaseHead,
        productionTree: smokeSeal.packageTree,
      };
      receipt = artifacts.headlessSmoke.pin;
      supportingReceipts = [artifacts.headlessSmokeSeal.pin, artifacts.deadline.pin];
    }
    assert.equal(rawWitness.result === 'PASS' || rawWitness.pass === true, true, `${id}: fresh raw witness PASS`);
    freshRows.push({
      id,
      negative: control.negative,
      result: 'PASS_FRESH',
      suite: control.suite,
      caseId: control.caseId,
      authorityScope: control.authorityScope,
      expectedOriginalTuple: control.expectedOriginalTuple,
      expected: historicalResult.expected,
      actual: actualOf(rawWitness),
      rawWitness,
      receipt,
      supportingReceipts,
      historicalExpectedTupleAuthority: {
        phase3CCommit: HISTORICAL_PHASE3C,
        controlMap: historicalPins.controlMap,
        controlResults: historicalPins.controlResults,
      },
      historicalAuthorityOnly: control.authoritativeWitnesses,
      adoptedHistoricalOutcome: false,
    });
  }
  assert.equal(freshRows.length, 89);
  assert.equal(new Set(freshRows.map(row => row.id)).size, 89);
  assert.equal(freshRows.filter(row => row.negative).length, 74);
  assertExactSet(freshRows.map(row => row.id), selectedIds, 'fresh result inventory');
  const bySuite = Object.fromEntries(ordinalSorted(new Set(freshRows.map(row => row.suite))).map(suite => {
    const rows = freshRows.filter(row => row.suite === suite);
    return [suite, { controls: rows.length, negative: rows.filter(row => row.negative).length }];
  }));
  assert.deepEqual(bySuite, {
    'deadline-cleanup': { controls: 7, negative: 6 },
    equivalence: { controls: 67, negative: 55 },
    protocol: { controls: 12, negative: 11 },
    'runtime-main': { controls: 1, negative: 0 },
    toctou: { controls: 2, negative: 2 },
  });

  const commonCandidatePins = {
    role: 'C3TB',
    commit: C3TB,
    tree: C3TB_TREE,
    soleParent: C3T,
    implementationTree: C3T_TREE,
    productionTree: PRODUCTION_TREE,
    authority: currentPins.authority,
    candidateRecord: currentPins.candidate,
    changedInventory: currentPins.changedInventory,
    consistency: currentPins.consistency,
    selectionMap: currentPins.map,
    binding: currentPins.binding,
    bindingVerification: currentPins.bindingVerification,
  };
  const sourceEvidence = evidencePins(
    artifacts.dependencyReuse.pin,
    artifacts.deadline.pin,
    artifacts.deadlineBoundary.pin,
    artifacts.equivalence.pin,
    artifacts.nativeLastError.pin,
    artifacts.protocol.pin,
    artifacts.toctou.pin,
    artifacts.headlessSmoke.pin,
    artifacts.headlessSmokeSeal.pin,
    artifacts.headlessSecurity.pin,
    artifacts.headlessSecuritySeal.pin,
  );

  const candidateRowsById = new Map([
    ['candidate:prospective-bound-generated-contract-consistency', {
      id: 'candidate:prospective-bound-generated-contract-consistency',
      result: 'PASS',
      scope: 'CURRENT_C3TB_GENERATED_CONTRACT_AND_RUNTIME_RESOURCE_BINDING',
      checks: {
        consistencyValidation: 'PASS',
        generatedResources: 7,
        packageMembers: 89,
        contractMembers: 53,
        schemaCount: 52,
        externalProductionDependencies: 0,
        helperDeadlineMs: 8000,
        generatedFieldsOtherThanHelperDeadlineEqualHistoricalProjection: true,
        runtimeResourcesBoundToC3TB: true,
      },
      evidence: evidencePins(currentPins.consistency, currentPins.binding, artifacts.deadline.pin),
    }],
    ['candidate:prospective-bound-package-and-binding-identity', {
      id: 'candidate:prospective-bound-package-and-binding-identity',
      result: 'PASS',
      scope: 'EXACT_C3TB_COMMIT_PACKAGE_TREE_AND_BINDING_ONLY_CHILD',
      checks: {
        candidateCommit: C3TB,
        soleParent: C3T,
        bindingOnlyChild: true,
        productionTree: PRODUCTION_TREE,
        packageMembers: 89,
        packageIdentity: current.binding.package.packageIdentity,
        bindingVerification: 'PASS',
        realHeadlessSmoke: 'PASS',
        productionChangedDuringCampaign: false,
      },
      evidence: evidencePins(currentPins.candidate, currentPins.binding, currentPins.bindingVerification, artifacts.headlessSmoke.pin, artifacts.headlessSecurity.pin),
    }],
  ]);
  const candidateRows = EXPECTED_SUPPLEMENTAL.map(id => candidateRowsById.get(id));
  assert.equal(candidateRows.every(Boolean), true);
  assert.equal(candidateRows.every(row => row.result === 'PASS'), true);
  assertExactSet(candidateRows.map(row => row.id), EXPECTED_SUPPLEMENTAL, 'candidate-specific controls');

  const reviewRowsById = new Map([
    ['DEADLINE_CONSTANT_BINDING', {
      id: 'DEADLINE_CONSTANT_BINDING', result: 'PASS',
      findings: { authority: 'PROSPECTIVE_HELPER_BOUND@1.0.0', helperMs: 8000, historicalH: 'NOT_ESTABLISHED', definitionsHelperDeadlineMs: 8000 },
      evidence: evidencePins(currentPins.authority, currentPins.consistency, currentPins.binding, artifacts.deadline.pin),
    }],
    ['STRICT_TIMEOUT_EQUALITY', {
      id: 'STRICT_TIMEOUT_EQUALITY', result: 'PASS',
      findings: { success: 'elapsedMs < 8000', timeout: 'elapsedMs >= 8000', equality: 'TIMEOUT', noGrace: true },
      evidence: evidencePins(currentPins.authority, currentPins.consistency, artifacts.deadline.pin, artifacts.headlessSecurity.pin),
    }],
    ['TIMEOUT_MAPPING', {
      id: 'TIMEOUT_MAPPING', result: 'PASS',
      findings: { caseId: timeoutCase.id, errorCode: timeoutCase.detail.errorCode, mappedPublicExit: timeoutCase.detail.mappedPublicExit, terminalCode: timeoutCase.detail.snapshot.terminalCode },
      evidence: evidencePins(artifacts.deadline.pin, artifacts.deadlineBoundary.pin),
    }],
    ['LATE_SUCCESS_REFUSAL', {
      id: 'LATE_SUCCESS_REFUSAL', result: 'PASS',
      findings: { caseId: lateCase.id, accepted: lateCase.detail.accepted, lateNativeFrameObserved: lateCase.detail.lateNativeOK, terminalCode: lateCase.detail.snapshot.terminalCode, recoveryAccepted: false },
      evidence: evidencePins(artifacts.deadline.pin, artifacts.deadlineBoundary.pin, artifacts.headlessSecurity.pin),
    }],
    ['SEQUENCE_NO_PARTIAL_SUCCESS', {
      id: 'SEQUENCE_NO_PARTIAL_SUCCESS', result: 'PASS',
      findings: { caseId: sequenceCase.id, deadlineMs: sequenceCase.detail.deadlineMs, firstError: sequenceCase.detail.firstError, subsequentTerminalRefusal: sequenceCase.detail.subsequentTerminalRefusal },
      evidence: evidencePins(artifacts.deadline.pin, artifacts.protocol.pin),
    }],
    ['SEPARATE_CLEANUP_TIMING', {
      id: 'SEPARATE_CLEANUP_TIMING', result: 'PASS',
      findings: { cleanupMs: 2000, formula: current.consistency.cleanup.formula, remainingOwnedProcesses: 0, nativeProcessesObserved: deadlineBoundary.nativeCoverage.filter(row => row.seen).length, requiredNativeProcessesObserved: deadlineBoundary.requiredObserved.map(row => row.name), allNativeStreamsClosed: true, headlessBoundarySnapshots: headlessById.get('S').boundaries.length },
      evidence: evidencePins(currentPins.consistency, artifacts.deadline.pin, artifacts.deadlineBoundary.pin, artifacts.headlessSecurity.pin),
    }],
    ['NATIVE_API_PARITY', {
      id: 'NATIVE_API_PARITY', result: 'PASS',
      findings: { equivalenceCases: equivalence.cases.length, exactFramesCompared: true, toctouCases: toctou.rows.length, exactTOCTOUResponses: true, metadataCaseId: NATIVE_LAST_ERROR_CASE, reflectedNativeMethods: nativeLastError.reflectedMethodCount, createFileWSetLastError: nativeLastError.createFileW.setLastError, createFileWExactSpelling: nativeLastError.createFileW.exactSpelling, otherSevenExpectedUnchangedMetadata: nativeLastError.otherSevenExpectedUnchangedMetadata, nativeApiInvocations: nativeLastError.nativeApiInvocations, helperRequests: nativeLastError.helperRequests, missingLeafWitness: { suite: 'equivalence', caseId: missingFileCase.name, result: missingFileCase.result, code: missingFileCase.code, status: missingFileCase.status, currentCandidate: normalizedPin(missingFileCase.candidate.helperSource) } },
      evidence: evidencePins(artifacts.nativeLastError.pin, artifacts.equivalence.pin, artifacts.toctou.pin),
    }],
    ['GENERATED_CONTRACT_CONSISTENCY', {
      id: 'GENERATED_CONTRACT_CONSISTENCY', result: 'PASS',
      findings: { generatedResources: 7, packageMembers: 89, contractMembers: 53, externalProductionDependencies: 0, helperDeadlineMs: 8000, historicalProjectionExclusion: 'limits.helperDeadlineMs only' },
      evidence: evidencePins(currentPins.consistency, currentPins.binding, artifacts.deadline.pin),
    }],
    ['HEADLESS_AND_STARTUP_CORRECTIONS', {
      id: 'HEADLESS_AND_STARTUP_CORRECTIONS', result: 'PASS',
      findings: { realHelpers: smoke.helperInvocations, headlessCases: headlessSecurity.rows.length, startupScenarios: startupRows.length, postDetachMembershipQuery: false, hostAuthority: 'NONE', newProductHelpers: 0 },
      evidence: evidencePins(artifacts.headlessSmoke.pin, artifacts.headlessSmokeSeal.pin, artifacts.headlessSecurity.pin, artifacts.headlessSecuritySeal.pin),
    }],
    ['FILESYSTEM_AND_TOCTOU_CORRECTIONS', {
      id: 'FILESYSTEM_AND_TOCTOU_CORRECTIONS', result: 'PASS',
      findings: { equivalencePrimaryControls: primaryCaseIdsBySuite.equivalence.length, equivalenceRawCases: equivalence.cases.length, toctouPrimaryControls: primaryCaseIdsBySuite.toctou.length, toctouRawCases: toctou.rows.length, exactResponseParity: true, missingLeafCase: missingFileCase.name, missingLeafCode: missingFileCase.code, immediateLastErrorCaptureCallSites: nativeLastError.sourceAssertions.immediateLastErrorCaptureCallSites.length, error2OnlyMissingLeafSemantics: nativeLastError.sourceAssertions.error2OnlyMissingLeafSemantics, sourceChangedDuringExecution: false },
      evidence: evidencePins(artifacts.equivalence.pin, artifacts.toctou.pin, artifacts.deadline.pin, artifacts.nativeLastError.pin),
    }],
    ['SOURCE_SECURITY_REVIEW', {
      id: 'SOURCE_SECURITY_REVIEW', result: 'PASS',
      findings: { mechanicalSourceReviewCase: sourceReviewCase.id, findings: sourceReviewCase.detail.findings.length, nativeMetadataCase: NATIVE_LAST_ERROR_CASE, exactInitializeNativeExtraction: nativeLastError.sourceAssertions.exactInitializeNativeExtraction, immediateLastErrorCaptureCallSites: nativeLastError.sourceAssertions.immediateLastErrorCaptureCallSites.length, error2OnlyMissingLeafSemantics: nativeLastError.sourceAssertions.error2OnlyMissingLeafSemantics, readSetBodyIdentical: true, rawHistoricalSourceEqualityRequired: false, sourceDeltaHunks: sourceDeltaReview.authorizedDiff.hunkCount, sourceDeltaCategories: sourceDeltaReview.authorizedDiff.categoryCounts, unexpectedSourceChanges: sourceDeltaReview.authorizedDiff.unexpectedChangeCount, perHunkCommentProjection: sourceDeltaReview.commentHandling.allCommentOnlyExecutableProjectionsEqual, globalCommentStripUsed: sourceDeltaReview.commentHandling.globallyStrippedSourceEqualityUsed, consoleSemanticChecks: requiredConsoleSemantics, dependencyReuseRows: sourceDeltaReview.dependencySelection.reusedDependencies.count, dependencyReuseRowsSha256: sourceDeltaReview.dependencySelection.reusedDependencies.rowsSha256, dependencyReuseArtifact: artifacts.dependencyReuse.pin, correctedN15ProductionComparatorGitBlob: N15_REFERENCE_BLOB, diagnosticEvidencePromoted: false, forbiddenHeadlessNativeImports: 0, networkUsedByEquivalence: false },
      evidence: evidencePins(artifacts.dependencyReuse.pin, artifacts.deadline.pin, artifacts.headlessSecurity.pin, artifacts.equivalence.pin, artifacts.nativeLastError.pin),
    }],
    ['CANDIDATE_BINDING', {
      id: 'CANDIDATE_BINDING', result: 'PASS',
      findings: { candidate: C3TB, implementation: C3T, soleParent: C3T, productionTree: PRODUCTION_TREE, bindingOnlyChild: true, bindingVerification: current.bindingVerification.result, consumeRule: current.map.consumeRule },
      evidence: evidencePins(currentPins.map, currentPins.binding, currentPins.bindingVerification, artifacts.plan.pin, artifacts.preExecutionSeal.pin),
    }],
  ]);
  const reviewRows = EXPECTED_REVIEWS.map(id => reviewRowsById.get(id));
  assert.equal(reviewRows.every(Boolean), true);
  assert.equal(reviewRows.every(row => row.result === 'PASS'), true);
  assertExactSet(reviewRows.map(row => row.id), EXPECTED_REVIEWS, 'source/security review inventory');

  for (const pin of sourceEvidence) assertPinCurrent(pin);
  const reconciledAt = new Date().toISOString();
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
  const freshRecord = {
    kind: 'MO1307Phase3CR2C3TBFreshControlResults',
    version: '1.0.0',
    reconciledAt,
    result: 'PASS_FRESH_COMPLETE',
    candidateRole: 'C3TB',
    candidate: C3TB,
    candidateImplementation: C3T,
    productionTree: PRODUCTION_TREE,
    historicalAcceptedPhase3C: HISTORICAL_PHASE3C,
    historicalCandidate: HISTORICAL_PRODUCTION,
    count: freshRows.length,
    negative: freshRows.filter(row => row.negative).length,
    bySuite,
    rows: freshRows,
    candidatePins: commonCandidatePins,
    historicalPins,
    receiptPins: sourceEvidence,
    supportingCounts,
    accounting: {
      selectedIdsOrdinalUnique: true,
      selectedAndReuseDisjoint: true,
      selectedExactMapMatch: true,
      freshOutcomesOnly: true,
      historicalPassReusedForSelected: false,
      selectedNotClassifiedAsReuse: true,
      freshlyExecutedReuseCandidateMappings,
      freshlyExecutedReuseOutcomesSubstitutedForReuseProof: false,
      nativeLastErrorMetadata: { caseId: NATIVE_LAST_ERROR_CASE, count: 1, result: 'PASS', historicalControl: false },
      caseSensitiveControlIds: true,
      omittedHistoricalControls: 0,
    },
    counting: 'The 103 fresh execution witnesses decompose into 89 selected witnesses, 10 dependent supporting raw cases, and 4 freshly executed REUSED_EXACT candidate witnesses whose outcomes do not replace reuse proof. The one native last-error metadata/source-semantic case is separate review evidence, not a historical control.',
  };
  const candidateRecord = {
    kind: 'MO1307Phase3CR2CandidateSpecificControls',
    version: '1.0.0',
    reconciledAt,
    result: 'PASS',
    candidateRole: 'C3TB',
    candidate: C3TB,
    candidateImplementation: C3T,
    productionTree: PRODUCTION_TREE,
    map: currentPins.map,
    count: candidateRows.length,
    rows: candidateRows,
    candidatePins: commonCandidatePins,
    supportingCounts,
    historicalOutcomeAdopted: false,
  };
  const reviewRecord = {
    kind: 'MO1307Phase3CR2SourceSecurityReviews',
    version: '1.0.0',
    reconciledAt,
    result: 'PASS',
    candidateRole: 'C3TB',
    candidate: C3TB,
    candidateImplementation: C3T,
    productionTree: PRODUCTION_TREE,
    map: currentPins.map,
    count: reviewRows.length,
    rows: reviewRows,
    candidatePins: commonCandidatePins,
    receiptPins: sourceEvidence,
    supportingCounts,
    governance: {
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
    },
    scope: 'Mechanically reconciled source/security findings over exact sealed C3TB receipts; no release authorization, Phase 3D execution, production repair, push, or tag.',
  };

  assert.equal(freshRecord.count, 89);
  assert.equal(freshRecord.negative, 74);
  assert.equal(freshRecord.rows.every(row => row.result === 'PASS_FRESH'), true);
  assert.equal(candidateRecord.count, 2);
  assert.equal(candidateRecord.rows.every(row => row.result === 'PASS'), true);
  assert.equal(reviewRecord.count, 12);
  assert.equal(reviewRecord.rows.every(row => row.result === 'PASS'), true);
  const payloads = [
    [OUTPUTS.fresh, freshRecord],
    [OUTPUTS.candidate, candidateRecord],
    [OUTPUTS.reviews, reviewRecord],
  ];
  for (const [relativePath] of payloads) assert.equal(fs.existsSync(path.join(ROOT, relativePath)), false, `${relativePath}: append-only pre-write check`);
  for (const [relativePath, record] of payloads) fs.writeFileSync(path.join(ROOT, relativePath), `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(`${canonical({ result: 'PASS_FRESH_COMPLETE', fresh: 89, negative: 74, reused: 462, candidateSpecific: 2, reviews: 12, omitted: 0, outputs: Object.values(OUTPUTS) })}\n`);
} catch (error) {
  failure = errorRecord(error);
  process.stderr.write(`${canonical({ result: 'FAIL', failure, outputsWritten: Object.fromEntries(Object.entries(OUTPUTS).map(([key, relativePath]) => [key, fs.existsSync(path.join(ROOT, relativePath))])) })}\n`);
  process.exitCode = 1;
}
