// Read-only examination of the dirty stopped worktree; writes only new main
// evidence. Historical STOPPED dispositions are never reinterpreted as PASS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const main = fileURLToPath(new URL('../../../../', import.meta.url));
const stopped = 'C:/Users/melsa/Documents/Codex/cca-mo1307-2c-resumed';
const baseline = '0d68ac211b3b204635e7af252cd693dce5bd70b1';
const destination = path.join(main, 'repositories/cca-conformance/evidence/mo1307/phase2c-finalization-correction');
const prefix = 'repositories/cca-conformance/evidence/mo1307/phase2c-continuation/';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => {
  const child = spawnSync('C:/Program Files/Git/cmd/git.exe', ['-c', 'safe.directory=' + stopped, '-C', stopped, ...args],
    { timeout: 10000, maxBuffer: 4194304, windowsHide: true });
  assert.ifError(child.error); assert.equal(child.status, 0); return child.stdout;
};
const read = relative => {
  assert.ok(!path.isAbsolute(relative) && !relative.split(/[\\/]/).includes('..'));
  return fs.readFileSync(path.join(stopped, relative));
};
const write = (relative, bytes) => {
  const target = path.join(destination, relative); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes, { flag: 'wx' });
  return { path: relative, byteLength: bytes.length, sha256: 'sha256:' + hash(bytes) };
};
assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64'); assert.equal(process.version, 'v24.21.0');
const node = fs.readFileSync(process.execPath);
assert.equal(node.length, 93580104); assert.equal(hash(node), 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(git(['rev-parse', 'HEAD']).toString().trim(), baseline);
assert.equal(git(['branch', '--show-current']).toString().trim(), 'codex/mo1307-phase2c-resumed');
const statusBefore = git(['status', '--porcelain', '-z', '--untracked-files=all']);
const inventoryPath = prefix + 'changed-file-inventory.json';
const inventory = JSON.parse(read(inventoryPath));
assert.equal(inventory.baseline, baseline); assert.equal(inventory.count, inventory.files.length);
assert.equal(inventory.count, 592); assert.equal(inventory.selfExcluded, inventoryPath);
for (const file of inventory.files) {
  const bytes = read(file.path); assert.equal(bytes.length, file.byteLength, file.path); assert.equal(hash(bytes), file.sha256, file.path);
}
const statusRows = statusBefore.toString('utf8').split('\0').filter(Boolean);
assert.deepEqual(statusRows.map(row => row.slice(3)).sort(), [...inventory.files.map(row => row.path), inventoryPath].sort());
const selected = [
  'docs/mo1307-phase2c-resumed.md', 'docs/mo1307-phase2c-continuation.md',
  'repositories/cca-conformance/evidence/mo1307/phase2c-resumed/stop-disposition.json',
  prefix + 'final-disposition.json', prefix + 'timer-disposition.json', prefix + 'rename-authority-review.json',
  inventoryPath, prefix + 'stopped-preservation-review.json', prefix + 'continuation.json',
  ...['receipt.json', 'stdout.txt', 'stderr.txt', 'exit.json'].map(name => prefix + 'rename-boundary-diagnostic/' + name),
  'repositories/cca-conformance/tools/mo1307-phase2c-resumed/rename-boundary-diagnostic.mjs',
  'repositories/memoryos-readiness/src/runtime.mjs', 'repositories/memoryos-readiness/src/errors.mjs',
  'repositories/memoryos-readiness/src/constants.mjs', 'repositories/memoryos-readiness/src/publication.mjs',
];
const originals = selected.map((originalPath, index) => {
  const bytes = read(originalPath);
  return { originalPath, byteLength: bytes.length, sha256: 'sha256:' + hash(bytes),
    retained: write('stopped-diagnostic/' + String(index + 1).padStart(2, '0') + '-' + path.basename(originalPath) + '.data', bytes) };
});
const prior = JSON.parse(read(selected[2])), current = JSON.parse(read(prefix + 'final-disposition.json'));
for (const disposition of [prior, current]) { assert.equal(disposition.status, 'STOPPED'); assert.equal(disposition.completion, 'NOT_PHASE2C_COMPLETE'); }
assert.equal(prior.classification, 'ENVIRONMENT_BLOCKER'); assert.equal(current.classification, 'CONTRACT_DEFECT');
assert.equal(current.previousEnvironmentBlocker.exactAuthorizedProductionLaunch, 'PASS');
const diagnostic = JSON.parse(read(prefix + 'rename-boundary-diagnostic/receipt.json'));
assert.equal(diagnostic.result, 'CONFLICT_REPRODUCED'); assert.equal(diagnostic.observedError.code, 'MO1307_TIMEOUT');
assert.ok(diagnostic.submittedAt < diagnostic.remainingCliBudgetMs);
assert.ok(diagnostic.atFailure > diagnostic.submittedAt && diagnostic.afterNativeRename > diagnostic.atFailure);
assert.equal(diagnostic.finalAtFailure, false); assert.equal(diagnostic.pendingAtFailure, true);
assert.equal(diagnostic.nativeCompletedAtFailure, false); assert.equal(diagnostic.finalAfter, true); assert.equal(diagnostic.pendingAfter, false);
assert.equal(diagnostic.completedJobs.length, 4);
const source = read(selected[13]).toString('utf8');
assert.equal([...source.matchAll(/fsp\.rename\(/g)].length, 1);
for (const fragment of ['const rename = fsp.rename(pending, final)', 'finalAtFailure = fs.existsSync(final)',
  'pendingAtFailure = fs.existsSync(pending)', 'await rename;', 'await Promise.all(cryptoJobs);']) assert.ok(source.includes(fragment));
assert.ok(source.indexOf('finalAtFailure = fs.existsSync(final)') < source.indexOf('await rename;'));
assert.ok(source.indexOf('await rename;') < source.indexOf('const finalAfter = fs.existsSync(final)'));
assert.deepEqual(JSON.parse(read(prefix + 'rename-boundary-diagnostic/stdout.txt')), diagnostic);
assert.equal(read(prefix + 'rename-boundary-diagnostic/stderr.txt').length, 0);
assert.equal(JSON.parse(read(prefix + 'rename-boundary-diagnostic/exit.json')).exitCode, 0);
const authority = JSON.parse(read(prefix + 'rename-authority-review.json'));
assert.equal(authority.diagnostic.sha256, 'sha256:' + hash(read(prefix + 'rename-boundary-diagnostic/receipt.json')));
const statusAfter = git(['status', '--porcelain', '-z', '--untracked-files=all']);
assert.deepEqual(statusAfter, statusBefore);
for (const file of inventory.files) assert.equal(hash(read(file.path)), file.sha256, file.path);
for (const file of originals) assert.equal('sha256:' + hash(read(file.originalPath)), file.sha256, file.originalPath);
const statusBinding = write('stopped-diagnostic/status-before.bin', statusBefore);
const receipt = { kind: 'MO1307FinalizationDiagnosticBinding', version: '1.0.0', baseline,
  verifiedAt: new Date().toISOString(), result: 'DIAGNOSTIC_CONFIRMED', originalWorktree: stopped,
  originalStates: ['STOPPED_ENVIRONMENT_BLOCKER_NOT_PHASE2C_COMPLETE', 'STOPPED_CONTRACT_DEFECT_NOT_PHASE2C_COMPLETE'],
  reinterpretationAsPhase2CPass: false, actualOutstandingMutationConfirmed: true, mereCallbackDelayRejected: true,
  basis: 'The sole submitted native rename had not changed the namespace at synchronous timeout observation; the exact same promise was later awaited and the final path then existed.',
  submittedAtMs: diagnostic.submittedAt, timeoutObservedAtMs: diagnostic.atFailure, renameCompletedAtMs: diagnostic.afterNativeRename,
  atTimeout: { finalPresent: false, pendingPresent: true, nativeCompleted: false }, afterRename: { finalPresent: true, pendingPresent: false },
  historicalLaunchBlocker: 'PRESERVED_AND_RESOLVED_ONLY_BY_EXPLICIT_PROCESS_SCOPED_AUTHORIZATION',
  currentBlocker: 'CONTRACT_DEFECT', statusBinding, changedFilesIncludingInventory: statusRows.length,
  completePriorInventoryVerifiedBeforeAndAfter: inventory.files.length, originalStatusUnchanged: true, originalBytesUnchanged: true,
  retainedArtifacts: originals, newDiagnosticExecution: false,
  limitations: ['Mechanical verification of retained actual-native evidence, not a fresh native campaign.',
    'Finite injected libuv contention is engineering-only, not normal production workload.',
    'No universal OS architecture-impossibility or full Phase2C certification claimed.'] };
write('diagnostic-binding.json', Buffer.from(JSON.stringify(receipt, null, 2) + '\n'));
process.stdout.write(JSON.stringify({ result: receipt.result, retained: originals.length,
  unchangedDirtyFiles: statusRows.length, verifiedInventoryFiles: inventory.files.length,
  submittedAtMs: receipt.submittedAtMs, timeoutObservedAtMs: receipt.timeoutObservedAtMs, renameCompletedAtMs: receipt.renameCompletedAtMs }) + '\n');
