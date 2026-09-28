// Independent finite reproduction of the B1 interface, before any correction.
// Synthetic records prove representation restrictions, never native FS safety.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const stopped = 'C:/Users/melsa/Documents/Codex/cca-mo1307-2c';
const baseline = '3883ca889911fcc5a6f46c24e569478a8c32648e';
const evidenceRelative = 'repositories/cca-conformance/evidence/mo1307/phase2c-correction';
const evidence = path.join(root, evidenceRelative);
const git = 'C:/Program Files/Git/cmd/git.exe';
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const identity = (relative, bytes) => ({ path: relative, byteLength: bytes.length, sha256: hash(bytes) });
const write = (relative, bytes) => {
  const destination = path.join(evidence, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes, { flag: 'wx' });
  return identity(evidenceRelative + '/' + relative, bytes);
};
function readGit(directory, args) {
  const child = spawnSync(git, ['-c', 'safe.directory=' + directory.replaceAll('\\', '/'), '-C', directory, ...args],
    { encoding: null, timeout: 10000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
  assert.ifError(child.error); assert.equal(child.status, 0);
  return child.stdout;
}
const oldPaths = [
  'docs/mo1307-phase2c-acquisition-publication.md',
  'repositories/cca-conformance/evidence/mo1307/phase2c/blocker-campaign.json',
  'repositories/cca-conformance/evidence/mo1307/phase2c/blocker-receipt.json',
  'repositories/cca-conformance/evidence/mo1307/phase2c/final-checks.json',
  'repositories/cca-conformance/tools/mo1307-phase2c/blocker-probe.mjs',
];
const sourceNames = ['canonical.mjs', 'constants.mjs', 'errors.mjs', 'helper-protocol.mjs', 'publication.mjs', 'windows-paths.mjs'];
const campaign = {
  kind: 'MemoryOSReadinessOldBlockerReproductionCampaign', version: '1.0.0', baseline,
  scope: 'ONE_FINITE_MAIN_BASELINE_REPRODUCTION', executions: 1,
  expectedChecks: 14, noAutomaticRetry: true,
  writes: ['new correction evidence and byte-preserving historical source/artifact copies only'],
  exclusions: ['No stopped-worktree writes', 'No native helper invocation', 'No product publication',
    'No live filesystem safety witness', 'No full Phase 2C or Phase 1 campaign'],
};
write('old-blocker-campaign.json', Buffer.from(JSON.stringify(campaign, null, 2) + '\n'));
const receipt = { kind: 'MemoryOSReadinessOldBlockerReproduction', version: '1.0.0', baseline,
  startedAt: new Date().toISOString(), originalState: ['STOPPED', 'CONTRACT_INTERFACE_BLOCKER', 'NOT_PHASE2C_COMPLETE'],
  originalStateReinterpreted: false, sourceBindings: [], historicalArtifacts: [], checks: [],
  productionCertification: false, syntheticIdentities: true, productFilesystemMutation: false };
const started = performance.now();
try {
  assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64'); assert.equal(process.version, 'v24.21.0');
  const node = fs.readFileSync(process.execPath);
  assert.equal(node.length, 93580104);
  assert.equal(hash(node), 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
  receipt.runtime = { executable: process.execPath, version: process.version, byteLength: node.length, sha256: hash(node) };
  assert.equal(readGit(root, ['rev-parse', 'HEAD']).toString().trim(), baseline);
  assert.equal(readGit(root, ['branch', '--show-current']).toString().trim(), 'main');
  const statusBefore = readGit(stopped, ['status', '--porcelain', '--untracked-files=all']);
  const expectedStatus = oldPaths.map(name => '?? ' + name).sort();
  assert.deepEqual(statusBefore.toString().trimEnd().split(/\r?\n/).sort(), expectedStatus);
  receipt.stoppedStatusBefore = statusBefore.toString();
  for (let i = 0; i < oldPaths.length; i++) {
    const originalPath = oldPaths[i], bytes = fs.readFileSync(path.join(stopped, originalPath));
    const copy = write(`stopped-2c/${String(i + 1).padStart(2, '0')}-${path.basename(originalPath)}.data`, bytes);
    receipt.historicalArtifacts.push({ originalPath, originalWorktree: stopped, originalState: 'UNTRACKED_STOPPED_ARTIFACT',
      byteLength: bytes.length, sha256: hash(bytes), retainedCopy: copy });
  }
  const stoppedFinal = JSON.parse(fs.readFileSync(path.join(stopped, oldPaths[3])));
  assert.equal(stoppedFinal.status, 'STOPPED_BLOCKED_NOT_COMPLETE');
  for (const name of sourceNames) {
    const originalPath = 'repositories/memoryos-readiness/src/' + name;
    const live = fs.readFileSync(path.join(root, originalPath));
    const committed = readGit(root, ['show', `${baseline}:${originalPath}`]);
    assert.deepEqual(live, committed, 'Production must be unchanged before reproduction: ' + name);
    receipt.sourceBindings.push({ originalPath, baseline, ...write('old-foundation/' + name, live) });
  }
  const old = await import(pathToFileURL(path.join(evidence, 'old-foundation/helper-protocol.mjs')));
  const { DEFINITIONS: D } = await import(pathToFileURL(path.join(evidence, 'old-foundation/constants.mjs')));
  const { assertComponentChain } = await import(pathToFileURL(path.join(evidence, 'old-foundation/windows-paths.mjs')));
  const { createPublication } = await import(pathToFileURL(path.join(evidence, 'old-foundation/publication.mjs')));
  const native = (finalPath, directory = true) => ({ attributes: directory ? 16 : 32, byteLength: 0,
    fileId: '0000000000000001', finalPath, isDirectory: directory, linkCount: 1, volumeSerial: '00000001' });
  const query = n => ({ kind: 'MemoryOSReadinessHelperRequest', version: '1.0.0', sequence: n,
    operation: n === 4 ? 'CHECK_OUTPUT' : 'READ_SET', roots: [{ id: n === 4 ? 'output' : 'input',
      path: n === 4 ? 'C:\\Private\\Uncreated' : 'C:\\Inputs' }],
    files: (n === 1 ? [['authority', D.limits.authorityBytes], ['config', D.limits.configurationBytes]]
      : n === 2 ? [['candidate', D.limits.candidateBytes], ['manifest', D.limits.manifestBytes]] : [])
      .map(([id, maxBytes]) => ({ id, maxBytes, root: 'input', path: id + '.json' })) });
  const reply = q => ({ kind: 'MemoryOSReadinessHelperResponse', version: '1.0.0', sequence: q.sequence,
    operation: q.operation, status: q.sequence === 4 ? 'ABSENT' : 'OK', code: null,
    roots: q.sequence === 4 ? [{ id: 'output-parent', identity: native('C:\\Private') }]
      : [{ id: 'input', identity: native('C:\\Inputs') }],
    files: q.files.map(f => ({ id: f.id, identity: native('C:\\Inputs\\' + f.path, false), bytes: [] })) });
  async function check(id, claim, action) {
    try { await action(); receipt.checks.push({ id, claim, result: 'PASS' }); }
    catch (error) { receipt.checks.push({ id, claim, result: 'FAIL', code: error.code ?? error.name }); throw error; }
  }
  const rejected = (action, suffix = 'INPUT') => assert.throws(action, error => error.code === 'MO1307_' + suffix);
  const q4 = query(4), r4 = reply(q4);
  await check('O01', 'The unchanged limit is four requests per assessment', () => assert.equal(D.limits.helperRequests, 4));
  await check('O02', 'Evaluate slot 4 accepts only ABSENT, one parent identity, zero files', () => {
    const actual = old.decodeHelperResponse(old.encodeHelperResponse(r4, q4), q4);
    assert.equal(actual.status, 'ABSENT'); assert.equal(actual.roots.length, 1); assert.equal(actual.files.length, 0);
    assert.equal(actual.roots[0].identity.finalPath, 'C:\\Private');
  });
  await check('O03', 'A created-root identity cannot replace the output parent', () => {
    const changed = structuredClone(r4); changed.roots[0].identity.finalPath += '\\Uncreated';
    rejected(() => old.encodeHelperResponse(changed, q4), 'FILESYSTEM_BOUNDARY');
  });
  await check('O04', 'A second root identity cannot be added to CHECK_OUTPUT', () => {
    rejected(() => old.encodeHelperResponse({ ...r4, roots: [...r4.roots, { id: 'z-created', identity: native('C:\\Private\\Uncreated') }] }, q4));
  });
  await check('O05', 'No pending-file identity or bytes fit the CHECK_OUTPUT result', () => {
    rejected(() => old.encodeHelperResponse({ ...r4, files: [{ id: 'pending', identity: native('C:\\Private\\Uncreated\\memoryos-readiness-result.json.pending', false), bytes: [] }] }, q4));
  });
  await check('O06', 'Extra ancestor-chain fields are closed out', () => rejected(() => old.encodeHelperResponse({ ...r4, chain: [] }, q4)));
  await check('O07', 'A new post-create operation is not an existing capability', () => rejected(() => old.encodeHelperRequest({ ...q4, operation: 'CHECK_CREATED_OUTPUT' })));
  await check('O08', 'READ_SET cannot acquire the output capability', () => rejected(() => old.encodeHelperRequest({ ...q4, operation: 'READ_SET' })));
  await check('O09', 'A fifth sequence is rejected', () => rejected(() => old.encodeHelperRequest({ ...q4, sequence: 5 })));
  await check('O10', 'Four completed requests cannot be retried or extended', () => {
    const state = old.createHelperSequence('evaluate');
    for (let n = 1; n <= 4; n++) { const q = query(n); state.begin(q); state.complete(old.encodeHelperResponse(reply(q), q)); }
    rejected(() => state.begin(q4)); rejected(() => state.begin({ ...q4, sequence: 5 }));
  });
  await check('O11', 'Trailing response frames cannot carry an inspection side channel', () => {
    const frame = old.encodeHelperResponse(r4, q4); rejected(() => old.decodeHelperResponse(Buffer.concat([frame, frame]), q4));
  });
  await check('O12', 'A parent witness cannot stand in for the created-root chain', () => {
    const parents = [native('C:\\'), native('C:\\Private')];
    assertComponentChain('C:\\Private', null, parents);
    rejected(() => assertComponentChain('C:\\Private\\Uncreated', null, parents), 'FILESYSTEM_BOUNDARY');
  });
  await check('O13', 'Publication refuses a missing native-inspection authority before filesystem mutation', () =>
    assert.rejects(() => createPublication('C:\\Private\\Uncreated'), error => error.code === 'MO1307_OUTPUT'));
  await check('O14', 'Publication demands six native-hook observations across object creation/staging/finalization', () => {
    const source = fs.readFileSync(path.join(evidence, 'old-foundation/publication.mjs'), 'utf8');
    assert.equal([...source.matchAll(/await chainAt\(/g)].length, 6);
    assert.ok(source.indexOf('await fs.mkdir(root') < source.indexOf('const created = await chainAt(inspect, root)'));
    assert.ok(source.indexOf("fs.open(pending, 'wx+'") < source.indexOf('const pendingChain = await chainAt(state.inspect, state.root, PENDING)'));
  });
  const statusAfter = readGit(stopped, ['status', '--porcelain', '--untracked-files=all']);
  assert.deepEqual(statusAfter, statusBefore);
  for (const artifact of receipt.historicalArtifacts) assert.equal(hash(fs.readFileSync(path.join(stopped, artifact.originalPath))), artifact.sha256);
  receipt.stoppedStatusAfter = statusAfter.toString();
  receipt.stoppedArtifactsUnchanged = true;
  assert.equal(receipt.checks.length, campaign.expectedChecks);
  receipt.result = 'BLOCKER_REPRODUCED';
} catch (error) {
  receipt.result = 'DIAGNOSTIC_FAILURE'; receipt.error = { code: error.code ?? error.name, message: error.message };
  process.exitCode = 1;
}
receipt.elapsedMs = Math.round((performance.now() - started) * 1000) / 1000;
receipt.finishedAt = new Date().toISOString();
write('old-blocker-reproduction.json', Buffer.from(JSON.stringify(receipt, null, 2) + '\n'));
process.stdout.write(JSON.stringify({ result: receipt.result, checks: receipt.checks.length,
  pass: receipt.checks.filter(row => row.result === 'PASS').length, stoppedArtifacts: receipt.historicalArtifacts.length }) + '\n');
