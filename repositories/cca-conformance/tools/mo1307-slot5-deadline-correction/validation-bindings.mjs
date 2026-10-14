// Frozen correction-validation source and write-once campaign bindings.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { packageFiles } from '../mo1307-phase1/package.mjs';
import { helperLaunchSpecification } from '../../../memoryos-readiness/src/helper-transport.mjs';

export const root = fileURLToPath(new URL('../../../../', import.meta.url));
export const toolRoot = 'repositories/cca-conformance/tools/mo1307-slot5-deadline-correction';
export const evidenceRoot = 'repositories/cca-conformance/evidence/mo1307/slot5-deadline-correction';
export const manifestPath = evidenceRoot + '/validation-source.json';
export const baseCommit = 'f1a78f64c13ad4ff06b8d31dc923331ad46ffe96';
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
  assert.equal(process.version, 'v24.21.0');
  assert.equal(process.platform, 'win32');
  assert.equal(process.arch, 'x64');
  assert.equal(hash(fs.readFileSync(process.execPath)), runtimePin);
}
export function git(args, encoding = 'utf8') {
  const result = spawnSync('C:/Program Files/Git/cmd/git.exe', [
    '-c', 'safe.directory=' + root.replaceAll('\\', '/').replace(/\/$/u, ''), ...args,
  ], { cwd: root, windowsHide: true, encoding, timeout: 30000, maxBuffer: 16 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, String(result.stderr));
  return encoding === null ? result.stdout : result.stdout.trim();
}
export function baseBytes(relative) {
  return git(['show', baseCommit + ':' + relative.replaceAll('\\', '/')], null);
}
function fixedLaunch() {
  const launch = helperLaunchSpecification();
  assert.equal(launch.options.detached, false);
  assert.equal(launch.options.windowsHide, true);
  assert.equal(launch.options.shell, false);
  assert.deepEqual([...launch.options.stdio], ['pipe', 'pipe', 'pipe']);
  assert.deepEqual({ ...launch.options.env }, { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' });
  return launch;
}
function executableBindings() {
  return [process.execPath, fixedLaunch().executable, 'C:/Program Files/Git/cmd/git.exe'].map(executable => {
    const bytes = fs.readFileSync(executable);
    return { executable, byteLength: bytes.length, sha256: hash(bytes) };
  });
}
export function shortAliasState() {
  const alias = String.raw`C:\PROGRA~1`;
  if (!fs.existsSync(alias)) return { alias, applicable: false, reason: 'ABSENT', canonicalPath: null };
  const canonicalPath = fs.realpathSync.native(alias);
  return {
    alias,
    canonicalPath,
    applicable: canonicalPath.toLowerCase() !== alias.toLowerCase(),
    reason: canonicalPath.toLowerCase() === alias.toLowerCase() ? 'NO_DISTINCT_ALIAS' : 'DISTINCT_EXISTING_ALIAS',
  };
}
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
function addTree(names, relative) {
  for (const entry of fs.readdirSync(absolute(relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const item = relative + '/' + entry.name;
    assert.equal(entry.isSymbolicLink(), false, 'No linked validation source');
    if (entry.isDirectory()) addTree(names, item);
    else { assert.equal(entry.isFile(), true); names.add(item); }
  }
}
function collectInputs() {
  const names = new Set([
    ...packageFiles.map(member => 'repositories/memoryos-readiness/' + member),
    '.gitattributes',
    'docs/mo1307-contract-freeze-1.md',
    'docs/mo1307-slot5-deadline-correction.md',
    evidenceRoot + '/authorization.txt',
    evidenceRoot + '/correction-decision.json',
    'repositories/cca-conformance/evidence/mo1307/n17-correction/native-filesystem/002.request.bin',
    'repositories/cca-conformance/evidence/mo1307/n17-correction/native-filesystem/002.invocation.json',
    'repositories/cca-conformance/evidence/mo1307/n17-correction/native-filesystem/003.request.bin',
    'repositories/cca-conformance/evidence/mo1307/n17-correction/native-filesystem/003.invocation.json',
    'repositories/cca-conformance/evidence/mo1307/n17-correction/native-filesystem/receipt.json',
    'repositories/cca-conformance/evidence/mo1307/n15-correction/native-filesystem/receipt.json',
    'repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/optimization-design-pass1.json',
    'repositories/cca-conformance/tools/mo1307-phase1/package.mjs',
  ]);
  addTree(names, toolRoot);
  return [...names].sort().map(record);
}
function prerequisites(packageMembers) {
  const decisionPath = evidenceRoot + '/correction-decision.json';
  const decision = JSON.parse(fs.readFileSync(absolute(decisionPath), 'utf8'));
  assert.equal(decision.status, 'SELECTED_BEFORE_PRODUCTION_EDIT');
  assert.equal(decision.firstFailure.classification, 'WHOLE_HELPER_LIFECYCLE_DID_NOT_SETTLE_BEFORE_5000_MS');
  assert.equal(decision.firstFailure.stageLocalization, 'NOT_ESTABLISHED');
  assert.equal(decision.selectedOptimization.count, 1);
  assert.equal(decision.selectedOptimization.function, 'Open-Chain');
  assert.equal(decision.base.commit, baseCommit);
  assert.equal(decision.authority.sha256, record(evidenceRoot + '/authorization.txt').sha256.slice(7));
  const helperPath = 'repositories/memoryos-readiness/helpers/windows-inspect.ps1';
  const oldHelper = baseBytes(helperPath);
  assert.equal(hash(oldHelper), 'sha256:' + decision.base.helper.sha256);
  assert.equal(packageMembers.find(bound => bound.path === helperPath).sha256, 'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127');
  return {
    decision: record(decisionPath),
    authority: record(evidenceRoot + '/authorization.txt'),
    base: { commit: baseCommit, helper: { path: helperPath, byteLength: oldHelper.length, sha256: hash(oldHelper) } },
  };
}
function exactFixtureState() {
  const failedRequest = absolute('repositories/cca-conformance/evidence/mo1307/n17-correction/native-filesystem/003.request.bin');
  const bytes = fs.readFileSync(failedRequest);
  const size = bytes.readUInt32BE(0);
  assert.equal(size, bytes.length - 4);
  const request = JSON.parse(bytes.subarray(4).toString('utf8'));
  const output = request.roots.find(rootEntry => rootEntry.id === 'output').path;
  const parent = path.dirname(output);
  return { output, parent, parentExists: fs.statSync(parent).isDirectory(), outputExists: fs.existsSync(output) };
}
export function verifyBindings(context) {
  assert.equal(context.manifest.headAtPreparation, baseCommit, 'Correction validation was prepared over the preserved N17 binding commit');
  assert.equal(git(['rev-parse', 'HEAD']), baseCommit, 'Checkout HEAD changed during correction validation');
  assert.deepEqual(record(manifestPath), context.manifestBinding, 'Prepared source manifest changed');
  assert.deepEqual(collectInputs(), context.manifest.inputs, 'Bound source, authority, tool or retained witness changed');
  assert.deepEqual(prerequisites(context.manifest.packageMembers), context.manifest.prerequisites, 'Correction prerequisite changed');
  assert.deepEqual(fixedLaunch(), context.manifest.launch, 'Fixed production launch changed');
  assert.deepEqual(executableBindings(), context.manifest.executables, 'Node or PowerShell executable changed');
  assert.deepEqual(shortAliasState(), context.manifest.filesystem.shortAlias, 'Predeclared alias applicability changed');
  assert.deepEqual(exactFixtureState(), context.manifest.performance.exactFixtureState, 'The retained exact CHECK_OUTPUT fixture changed');
  assert.equal(fs.existsSync(absolute(evidenceRoot + '/generation-stopped.json')), false, 'A mandatory failure stops this generation');
}
export function beginCampaign(name) {
  runtimeCheck();
  assert.equal(process.argv.length, 2, 'No source, launch, deadline or output overrides');
  assert.ok(['equivalence-security', 'performance', 'native-filesystem', 'toctou'].includes(name));
  const manifest = JSON.parse(fs.readFileSync(absolute(manifestPath), 'utf8'));
  assert.equal(manifest.kind, 'MO1307Slot5DeadlineCorrectionValidationSource');
  assert.equal(manifest.status, 'CORRECTION_VALIDATION_NOT_CANDIDATE_ACCEPTANCE');
  assert.equal(manifest.packageMembers.length, 89);
  assert.deepEqual(manifest.packageMembers.map(bound => bound.path), packageFiles.map(member => 'repositories/memoryos-readiness/' + member));
  assert.deepEqual(manifest.packageMembers, packageFiles.map(member => record('repositories/memoryos-readiness/' + member)));
  assert.equal(manifest.sourceIdentity, hash(Buffer.from(JSON.stringify(manifest.packageMembers) + '\n')));
  const context = { manifest, manifestBinding: record(manifestPath), output: evidenceRoot + '/' + name };
  verifyBindings(context);
  const predecessor = { performance: 'equivalence-security', 'native-filesystem': 'performance', toctou: 'native-filesystem' }[name];
  if (predecessor) {
    const predecessorPath = evidenceRoot + '/' + predecessor + '/receipt.json';
    const receipt = JSON.parse(fs.readFileSync(absolute(predecessorPath), 'utf8'));
    assert.equal(receipt.result, 'PASS', 'Stop after a mandatory predecessor failure');
    assert.equal(receipt.sourcesUnchanged, true);
    assert.equal(receipt.sourceIdentity, manifest.sourceIdentity);
    assert.deepEqual(receipt.source, context.manifestBinding);
  }
  fs.mkdirSync(absolute(context.output), { recursive: false });
  write(context.output + '/started.json', {
    kind: 'MO1307Slot5DeadlineCorrectionEngineeringStart', name, source: context.manifestBinding,
    headAtPreparation: manifest.headAtPreparation, startedUtc: new Date().toISOString(), attempt: 1, retries: 0,
    acceptedCandidate: null, certification: false,
  });
  return context;
}
export function finishCampaign(context, details) {
  let sourceFailure = null;
  try { verifyBindings(context); } catch (error) { sourceFailure = { name: error.name, message: error.message }; }
  const result = details.result === 'PASS' && sourceFailure === null ? 'PASS' : 'FAIL';
  const receipt = {
    kind: 'MO1307Slot5DeadlineCorrectionEngineeringReceipt', ...details, result,
    source: context.manifestBinding, sourceIdentity: context.manifest.sourceIdentity,
    acceptedCandidate: null, sourcesUnchanged: sourceFailure === null, sourceFailure,
    runtime: { executable: process.execPath, version: process.version, platform: process.platform, arch: process.arch, sha256: runtimePin },
    finishedUtc: new Date().toISOString(), retries: 0, certificationAcceptance: false,
  };
  write(context.output + '/receipt.json', receipt);
  if (result !== 'PASS' && !fs.existsSync(absolute(evidenceRoot + '/generation-stopped.json'))) {
    write(evidenceRoot + '/generation-stopped.json', {
      reason: 'FIRST_MANDATORY_FAILURE', stage: details.suite, receipt: record(context.output + '/receipt.json'), noLaterStages: true, retries: 0,
    });
  }
  console.log(JSON.stringify({ result, output: context.output, sourcesUnchanged: sourceFailure === null }));
  process.exitCode = result === 'PASS' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2), ['prepare']);
  runtimeCheck();
  assert.equal(packageFiles.length, 89);
  assert.equal(filesystemCases.length, 34);
  assert.equal(fs.existsSync(absolute(manifestPath)), false, 'Validation source is write-once');
  const inputs = collectInputs();
  const packageMembers = packageFiles.map(member => record('repositories/memoryos-readiness/' + member));
  const shortAlias = shortAliasState();
  assert.equal(shortAlias.applicable, true, 'The frozen 35-case native suite requires the distinct short-alias control');
  const fixture = exactFixtureState();
  assert.deepEqual({ parentExists: fixture.parentExists, outputExists: fixture.outputExists }, { parentExists: true, outputExists: false });
  const sourceIdentity = hash(Buffer.from(JSON.stringify(packageMembers) + '\n'));
  assert.equal(git(['rev-parse', 'HEAD']), baseCommit, 'Prepare only over the preserved N17 binding commit');
  write(manifestPath, {
    kind: 'MO1307Slot5DeadlineCorrectionValidationSource', status: 'CORRECTION_VALIDATION_NOT_CANDIDATE_ACCEPTANCE', candidate: null,
    headAtPreparation: baseCommit, sourceIdentity, packageMembers, inputs,
    prerequisites: prerequisites(packageMembers), launch: fixedLaunch(), executables: executableBindings(),
    executionOrder: ['equivalence-security', 'performance', 'native-filesystem', 'toctou'],
    equivalence: { mode: 'static-mechanical-inverse-plus-closed-call-site-proof', helperExecutions: 0, performanceEvidence: false },
    performance: {
      exactFixtureState: fixture, helperDeadlineMs: 5000, aggregateDeadlineMs: 20000,
      order: ['retained-exact-slot5-former-failure', 'retained-exact-slot4-pass-comparator'], executionsEach: 1, retries: 0, warmups: 0,
    },
    filesystem: { shortAlias, cases: selectedFilesystemCases(shortAlias), expectedCases: 35, expectedHelperInvocations: 39 },
    toctouCases: ['before-read-replacement', 'held-to-fresh-replacement'],
    frozenDeadlinesMs: { helper: 5000, aggregateHelper: 20000, cli: 30000, apiWorker: 10000, cleanup: 2000 },
    preparation: 'Hashing, inventory, launch inspection, fixture-state inspection and source sealing only. No helper, product test or certification executed.',
  });
  console.log(JSON.stringify({ prepared: manifestPath, sourceIdentity, inputs: inputs.length, acceptedCandidate: null }));
}
