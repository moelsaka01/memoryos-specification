// Engineering preparation and exact source bindings only; no product launch in prepare mode.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { packageFiles } from '../mo1307-phase1/package.mjs';
import { helperLaunchSpecification } from '../../../memoryos-readiness/src/helper-transport.mjs';

export const root = fileURLToPath(new URL('../../../../', import.meta.url));
export const toolRoot = 'repositories/cca-conformance/tools/mo1307-n17-correction';
export const evidenceRoot = 'repositories/cca-conformance/evidence/mo1307/n17-correction';
export const manifestPath = evidenceRoot + '/validation-source.json';
export const runtimePin = 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
export const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
export const absolute = relative => path.join(root, relative);
export function record(relative) {
  assert.ok(!path.isAbsolute(relative) && !relative.split(/[\\/]/u).includes('..'), 'Root-relative binding required');
  const bytes = fs.readFileSync(absolute(relative));
  return { path: relative.replaceAll('\\', '/'), byteLength: bytes.length, sha256: hash(bytes) };
}
export function write(relative, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + '\n');
  fs.writeFileSync(absolute(relative), bytes, { flag: 'wx' });
}
export function runtimeCheck() {
  assert.equal(process.version, 'v24.21.0'); assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64');
  assert.equal(hash(fs.readFileSync(process.execPath)), runtimePin);
}
function git(args, raw = false) {
  const result = spawnSync('C:/Program Files/Git/cmd/git.exe', ['-c', 'safe.directory=' + root.replaceAll('\\', '/').replace(/\/$/, ''), ...args], { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
  assert.ifError(result.error); assert.equal(result.status, 0); return raw ? result.stdout : result.stdout.trim();
}
function prerequisites(packageMembers) {
  const file = evidenceRoot + '/correction-decision.json';
  const decision = JSON.parse(fs.readFileSync(absolute(file), 'utf8'));
  assert.equal(decision.result, 'APPROVED_FOR_N17_VALIDATION');
  assert.equal(decision.classification, 'N17_FIXTURE_SETUP_DEFECT');
  assert.equal(typeof decision.correction, 'string'); assert.ok(decision.correction.length > 0);
  assert.deepEqual(decision.source, packageMembers);
  assert.ok(Array.isArray(decision.evidence) && decision.evidence.length > 0);
  assert.equal(new Set(decision.evidence.map(bound => bound.path)).size, decision.evidence.length);
  for (const bound of decision.evidence) assert.deepEqual(record(bound.path), bound);
  assert.ok(decision.evidence.some(bound => bound.path === evidenceRoot + '/authority-review.json'));
  const authority = JSON.parse(fs.readFileSync(absolute(evidenceRoot + '/authority-review.json'), 'utf8'));
  assert.equal(authority.result, 'PASS_STATIC'); assert.equal(authority.classification, 'N17_FIXTURE_SETUP_DEFECT');
  assert.equal(authority.fixtureCorrectionReview.inverseEqualsBaseExactly, true);
  const priorPath = 'repositories/cca-conformance/evidence/mo1307/n15-correction/validation-source.json';
  const prior = JSON.parse(fs.readFileSync(absolute(priorPath), 'utf8'));
  assert.deepEqual(prior.packageMembers, packageMembers, 'N17 correction changes no production member');
  const testPath = 'repositories/cca-conformance/tests/mo1307_phase1_native_test.mjs';
  const current = fs.readFileSync(absolute(testPath), 'utf8');
  const base = git(['show', '56a3d93a0c7fdb42e93e16ec1f6c13c81770c11b:' + testPath], true);
  const anchor = "test('N17 native CLI evaluates and publishes exact integrated result'";
  const at = current.indexOf(anchor); assert.ok(at >= 0);
  const addition = '  await fs.mkdir(attempt, { recursive: true });';
  const position = current.indexOf(addition, at); assert.ok(position > at);
  const inverse = current.slice(0, position) + current.slice(position + addition.length).replace(/^\r?\n/u, '');
  assert.equal(inverse, base, 'Only authorized N17 parent setup differs from base');
  return [...new Map([record(file), ...decision.evidence, record(priorPath)].map(bound => [bound.path, bound])).values()];
}
export function securityCoverage(context) {
  const file = evidenceRoot + '/security-dependency-review.json';
  const review = JSON.parse(fs.readFileSync(absolute(file), 'utf8'));
  assert.equal(review.result, 'PASS_STATIC'); assert.equal(review.sourceIdentity, context.manifest.sourceIdentity);
  assert.ok(Array.isArray(review.historicalRows) && Array.isArray(review.freshRows) && Array.isArray(review.bindings));
  const ids = [...review.historicalRows, ...review.freshRows].map(row => row.id).sort();
  assert.deepEqual(ids, 'ABCDEFGHIJKLMNOPQRS'.split(''), 'Every security category has exactly one justified coverage row');
  for (const row of review.historicalRows) {
    assert.equal(row.exactDependencyClosureUnchanged, true); assert.equal(row.priorResult, 'PASS');
    assert.equal(typeof row.reason, 'string'); assert.ok(row.reason.length > 0);
    assert.ok(Array.isArray(row.bindings) && row.bindings.length > 0);
    for (const bound of row.bindings) assert.deepEqual(record(bound.path), bound);
  }
  for (const row of review.freshRows) {
    assert.equal(row.result, 'PASS'); assert.equal(row.sourceIdentity, context.manifest.sourceIdentity);
    assert.ok(row.receipt); assert.deepEqual(record(row.receipt.path), row.receipt);
    const receipt = JSON.parse(fs.readFileSync(absolute(row.receipt.path), 'utf8'));
    assert.equal(receipt.result, 'PASS');
    if (receipt.sourceIdentity !== undefined) assert.equal(receipt.sourceIdentity, context.manifest.sourceIdentity);
    else assert.deepEqual(receipt.source, context.manifest.packageMembers, 'Fresh security receipt must bind current source');
  }
  for (const bound of review.bindings) assert.deepEqual(record(bound.path), bound);
  return record(file);
}
function fixedLaunch() {
  const launch = helperLaunchSpecification();
  assert.equal(launch.options.detached, false); assert.equal(launch.options.windowsHide, true); assert.equal(launch.options.shell, false);
  assert.deepEqual([...launch.options.stdio], ['pipe', 'pipe', 'pipe']);
  assert.deepEqual({ ...launch.options.env }, { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' });
  return launch;
}
function executableBindings() {
  return [process.execPath, fixedLaunch().executable].map(executable => {
    const bytes = fs.readFileSync(executable); return { executable, byteLength: bytes.length, sha256: hash(bytes) };
  });
}
export function shortAliasState() {
  const alias = String.raw`C:\PROGRA~1`;
  if (!fs.existsSync(alias)) return { alias, applicable: false, reason: 'ABSENT', canonicalPath: null };
  const canonicalPath = fs.realpathSync.native(alias);
  return { alias, canonicalPath, applicable: canonicalPath.toLowerCase() !== alias.toLowerCase(), reason: canonicalPath.toLowerCase() === alias.toLowerCase() ? 'NO_DISTINCT_ALIAS' : 'DISTINCT_EXISTING_ALIAS' };
}
export const regressionCases = [
  ['package-tests', 'mo1307_phase1_package_test.mjs', 8],
  ['launch-policy', 'mo1307_phase2c_launch_policy_test.mjs', 13],
  ['runtime', 'mo1307_phase2c_runtime_test.mjs', 36],
  ['protocol-publication-correction', 'mo1307_phase2c_correction_test.mjs', 24],
  ['timer-lifetime', 'mo1307_phase2c_timer_lifetime_test.mjs', 1],
  ['native-foundation', 'mo1307_phase1_native_test.mjs', 25],
];
export const filesystemCases = [
  'native READ_SET same-handle bytes and seven-field identity',
  'native CHECK_OUTPUT slots4/5 full stable drive-parent chains',
  'native INSPECT_OUTPUT_ROOT and CHECK_STAGE_ROOT stable full chain',
  'native INSPECT_PENDING and CHECK_FINALIZATION stable full chain/final absence',
  'existing output rejected by native absence', 'existing final rejected by native absence',
  'changed pending identity observed natively', 'existing absolute target outside the declared input root rejected without read', 'traversal native request rejection', 'ADS native request rejection',
  'drive-relative native request rejection', 'UNC native request rejection', 'device native request rejection',
  'missing ancestor rejected', 'missing leaf is INPUT rather than absent success', 'directory used as file rejected',
  'hardlinked input rejected', 'file symlink rejected', 'directory symlink ancestor rejected', 'junction ancestor rejected',
  '2MiB read and canonical base64 chunks within fixed deadline', 'per-file decoded cap rejection',
  'existing pending exclusive creation refuses overwrite',
  'wrong version rejects', 'wrong session rejects', 'wrong sequence rejects', 'wrong operation rejects', 'unknown field rejects',
  'duplicate key rejects', 'noncanonical body rejects', 'truncated frame rejects', 'extra frame rejects', 'trailing bytes rejects',
  'oversized request rejects',
];
export function selectedFilesystemCases(alias) {
  const list = [...filesystemCases];
  if (alias.applicable) list.splice(23, 0, 'existing native short alias rejected for wrong final handle path');
  return list;
}
function collectInputs() {
  const names = new Set([
    ...packageFiles.map(p => 'repositories/memoryos-readiness/' + p),
    ...regressionCases.map(([, p]) => 'repositories/cca-conformance/tests/' + p),
    'docs/mo1307-contract-freeze-1.md',
    'docs/mo1307-n17-correction.md', evidenceRoot + '/authorization.txt', evidenceRoot + '/correction-decision.json',
    'docs/mo1307-final-headless-correction-addendum.md', 'repositories/cca-conformance/evidence/mo1307/final-headless/authorization.txt',
    'repositories/cca-conformance/evidence/mo1307/final-headless/minimum-wire-smoke/receipt.json', 'repositories/cca-conformance/evidence/mo1307/final-headless/security/receipt.json',
  ]);
  function addTree(relative) {
    for (const entry of fs.readdirSync(absolute(relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const item = relative + '/' + entry.name;
      assert.equal(entry.isSymbolicLink(), false, 'No linked validation source');
      if (entry.isDirectory()) addTree(item);
      else { assert.equal(entry.isFile(), true); names.add(item); }
    }
  }
  for (const relative of [
    toolRoot, 'repositories/cca-conformance/fixtures/mo1307',
    ...['mo1307-phase1', 'mo1307-phase2c-correction', 'mo1307-phase2c-resumed', 'mo1307-phase2c-continuation'].map(p => 'repositories/cca-conformance/tools/' + p),
  ]) addTree(relative);
  return [...names].sort().map(record);
}
export function verifyBindings(context) {
  assert.deepEqual(record(manifestPath), context.manifestBinding, 'Prepared source manifest changed');
  assert.deepEqual(collectInputs(), context.manifest.inputs, 'Bound source, test, fixture or tool bytes changed');
  assert.deepEqual(shortAliasState(), context.manifest.filesystem.shortAlias, 'Predeclared alias applicability changed');
  assert.deepEqual(prerequisites(context.manifest.packageMembers), context.manifest.prerequisites, 'Approved correction decision changed');
  assert.deepEqual(fixedLaunch(), context.manifest.launch, 'Fixed production launch changed');
  assert.deepEqual(executableBindings(), context.manifest.executables, 'Node or PowerShell executable changed');
  if (context.securityBinding) assert.deepEqual(securityCoverage(context), context.securityBinding, 'Security coverage changed after admission');
  assert.equal(fs.existsSync(absolute(evidenceRoot + '/generation-stopped.json')), false, 'A mandatory failure stops this entire generation');
}
export function beginCampaign(name) {
  runtimeCheck(); assert.equal(process.argv.length, 2, 'No source, launch or output overrides');
  assert.ok(['n17', 'publication', 'regressions', 'native-filesystem', 'security', 'toctou'].includes(name));
  const manifest = JSON.parse(fs.readFileSync(absolute(manifestPath), 'utf8'));
  assert.equal(manifest.kind, 'MO1307N17CorrectionValidationSource');
  assert.equal(manifest.status, 'VALIDATION_SOURCE_NOT_YET_ACCEPTED_CANDIDATE');
  assert.equal(manifest.candidate, null);
  assert.equal(manifest.packageMembers.length, 89);
  assert.deepEqual(manifest.packageMembers.map(r => r.path), packageFiles.map(p => 'repositories/memoryos-readiness/' + p));
  assert.deepEqual(manifest.packageMembers, packageFiles.map(p => record('repositories/memoryos-readiness/' + p)));
  assert.equal(manifest.sourceIdentity, hash(Buffer.from(JSON.stringify(manifest.packageMembers) + '\n')));
  const context = { manifest, manifestBinding: record(manifestPath), output: evidenceRoot + '/' + name };
  verifyBindings(context);
  const predecessor = { publication: 'n17', 'native-filesystem': 'publication', security: 'native-filesystem', regressions: 'security', toctou: 'regressions' }[name];
  if (predecessor) {
    const receipt = JSON.parse(fs.readFileSync(absolute(evidenceRoot + '/' + predecessor + '/receipt.json'), 'utf8'));
    assert.equal(receipt.result, 'PASS', 'Stop after a mandatory predecessor failure');
    assert.equal(receipt.sourcesUnchanged, true);
    assert.equal(receipt.sourceIdentity, manifest.sourceIdentity);
    assert.deepEqual(receipt.source, context.manifestBinding);
  }
  if (name === 'regressions' || name === 'toctou') context.securityBinding = securityCoverage(context);
  fs.mkdirSync(absolute(context.output), { recursive: false });
  write(context.output + '/started.json', {
    kind: 'MO1307N17CorrectionEngineeringStart', name, source: context.manifestBinding,
    headAtPreparation: manifest.headAtPreparation, startedUtc: new Date().toISOString(), attempt: 1, retries: 0,
    acceptedCandidate: null, phase3BCampaign: false, phase3CCampaign: false,
  });
  return context;
}
export function finishCampaign(context, details) {
  let sourceFailure = null;
  try { verifyBindings(context); } catch (error) { sourceFailure = { name: error.name, message: error.message }; }
  const result = details.result === 'PASS' && sourceFailure === null ? 'PASS' : 'FAIL';
  const receipt = {
    kind: 'MO1307N17CorrectionEngineeringReceipt', ...details, result,
    source: context.manifestBinding, sourceIdentity: context.manifest.sourceIdentity,
    acceptedCandidate: null, sourcesUnchanged: sourceFailure === null, sourceFailure,
    runtime: { executable: process.execPath, version: process.version, platform: process.platform, arch: process.arch, sha256: runtimePin },
    finishedUtc: new Date().toISOString(), retries: 0, certificationAcceptance: false,
  };
  write(context.output + '/receipt.json', receipt);
  if (result !== 'PASS' && !fs.existsSync(absolute(evidenceRoot + '/generation-stopped.json'))) write(evidenceRoot + '/generation-stopped.json', {
    reason: 'FIRST_MANDATORY_FAILURE', stage: details.suite, receipt: record(context.output + '/receipt.json'), noLaterStages: true, retries: 0,
  });
  console.log(JSON.stringify({ result, output: context.output, sourcesUnchanged: sourceFailure === null }));
  process.exitCode = result === 'PASS' ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2), ['prepare']); runtimeCheck(); assert.equal(packageFiles.length, 89);
  assert.equal(filesystemCases.length, 34);
  const inputs = collectInputs(), packageMembers = packageFiles.map(p => record('repositories/memoryos-readiness/' + p));
  const shortAlias = shortAliasState();
  assert.equal(shortAlias.applicable, true, 'Required native final-path mismatch witness needs the predeclared distinct alias; stop before N17 if unavailable');
  fs.mkdirSync(absolute(evidenceRoot), { recursive: true });
  write(manifestPath, {
    kind: 'MO1307N17CorrectionValidationSource', status: 'VALIDATION_SOURCE_NOT_YET_ACCEPTED_CANDIDATE', candidate: null,
    productionAuthority: 'defe93989efc6501b1a730b82e79e705884b269b', headAtPreparation: git(['rev-parse', 'HEAD']),
    sourceIdentity: hash(Buffer.from(JSON.stringify(packageMembers) + '\n')), packageMembers, inputs,
    prerequisites: prerequisites(packageMembers), launch: fixedLaunch(), executables: executableBindings(),
    filesystem: { shortAlias, cases: selectedFilesystemCases(shortAlias), expectedCases: 35, expectedHelperInvocations: 39, obligation: 'One receipt fulfills full native filesystem regression after publication preservation; no duplicate run' },
    toctouCases: ['before-read-replacement', 'held-to-fresh-replacement'], regressionTests: 107,
    executionOrder: ['n17','publication','native-filesystem','security','regressions','toctou'], firstSelectedTest: 'native-foundation-018', publicationSelectedTests: 12, publicationSupplementalControls: 5, remainingSelectedTests: 94,
    historicalSecurity: ['minimum-wire-smoke/receipt.json','security/receipt.json'].map(name => record('repositories/cca-conformance/evidence/mo1307/final-headless/' + name)),
    historicalScope: 'Preserved prior outcomes only. No historical regression result is current evidence and no old89 source list substitutes for current correction binding. Security reuse requires a later per-row exact dependency review.',
    preparation: 'Hashing, inventory and alias-applicability inspection only; no helper, product validation, test or certification executed.',
    acceptanceBinding: 'After every required validation passes, bind the new production commit/tree and all89 members exactly to these already-validated packageMembers. This source identity is never represented as a production commit.',
  });
  console.log(JSON.stringify({ prepared: manifestPath, sourceIdentity: hash(Buffer.from(JSON.stringify(packageMembers) + '\n')), inputs: inputs.length, acceptedCandidate: null }));
}
