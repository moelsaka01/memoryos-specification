// Read-only proof of correction graph, all bound blobs and preserved blocker.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkSealedEvidence } from './check-evidence.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const dir = 'repositories/cca-conformance/evidence/mo1307/phase2c-correction';
const base = '3883ca889911fcc5a6f46c24e569478a8c32648e';
const sha = b => 'sha256:' + createHash('sha256').update(b).digest('hex');
const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: null, windowsHide: true, timeout: 15000, maxBuffer: 16 * 1024 * 1024 }); assert.ifError(r.error); assert.equal(r.status, 0, r.stderr.toString()); return r.stdout; };
const str = (...args) => git(...args).toString().trim();
const read = p => JSON.parse(fs.readFileSync(path.join(root, dir, p), 'utf8'));
const check = (member, bytes) => { assert.equal(bytes.length, member.byteLength, member.path); assert.equal(sha(bytes), member.sha256, member.path); };
const binding = read('binding.json');
const c2c = binding.implementation.commit;
assert.equal(binding.implementation.parent, base);
assert.equal(str('rev-parse', c2c + '^'), base);
assert.equal(str('rev-parse', base + '^'), '7aa5ede6ec52b36d0428273d78c8ca7aa37a39ee');
assert.equal(str('rev-parse', base + '^^'), 'e0cb8e9cc6aa73e26945db30756a6667a8d9e322');
assert.equal(str('show', '-s', '--format=%s', c2c), 'fix(memoryos-1.3): correct MO-1307 publication inspection contract');
assert.equal(str('rev-parse', c2c + '^{tree}'), binding.implementation.tree);
const changed = str('diff-tree', '--no-commit-id', '--name-only', '-r', c2c).split('\n').filter(Boolean).sort();
assert.deepEqual(binding.members.map(m => m.path), changed);
for (const member of binding.members) { check(member, git('show', c2c + ':' + member.path)); check(member, fs.readFileSync(path.join(root, member.path))); }
const inventory = read('changed-file-inventory.json');
assert.deepEqual(inventory.members.map(m => m.path), changed.filter(p => p !== dir + '/changed-file-inventory.json'));
for (const member of inventory.members) check(member, fs.readFileSync(path.join(root, member.path)));
checkSealedEvidence();
const old = read('old-blocker-reproduction.json');
assert.equal(old.result, 'BLOCKER_REPRODUCED');
for (const member of old.historicalArtifacts) {
  const location = path.join(member.originalWorktree, member.originalPath);
  const bytes = fs.readFileSync(location);
  check({ ...member, path: location }, bytes);
  check(member.retainedCopy, fs.readFileSync(path.join(root, member.retainedCopy.path)));
}
for (const member of old.sourceBindings) {
  check(member, git('show', base + ':' + member.originalPath));
  check(member, fs.readFileSync(path.join(root, member.path)));
}
assert.equal(git('-c', 'safe.directory=C:/Users/melsa/Documents/Codex/cca-mo1307-2c', '-C', 'C:/Users/melsa/Documents/Codex/cca-mo1307-2c', 'status', '--porcelain', '--untracked-files=all').toString(), old.stoppedStatusBefore);
assert.equal(str('rev-parse', 'memoryos-1.3-mo1306'), '9dd37b7757314b8cecbfc018ff7cdd8c2aa0cab8');
assert.equal(str('rev-parse', 'memoryos-1.3-mo1306^{}'), '332ab0d2c35643ea8d155bcbea9c5019b304bbe3');
for (const preserved of inventory.preservedHistoricalBindings) assert.ok(git('show', base + ':' + preserved).equals(fs.readFileSync(path.join(root, preserved))));
let c2cb = null;
if (process.argv.includes('--bound')) {
  assert.equal(str('branch', '--show-current'), 'main');
  c2cb = str('rev-parse', 'HEAD');
  assert.equal(str('rev-parse', c2cb + '^'), c2c);
  assert.equal(str('show', '-s', '--format=%s', c2cb), 'conformance(memoryos-1.3): bind MO-1307 publication inspection correction');
  assert.deepEqual(str('diff-tree', '--no-commit-id', '--name-only', '-r', c2cb).split('\n').sort(),
    [dir + '/binding-verification.json', dir + '/binding.json'].sort());
  assert.equal(str('status', '--porcelain'), '');
}
console.log(JSON.stringify({ kind: 'MemoryOSReadinessPublicationCorrectionBindingVerification', version: '1.0.0', result: 'PASS',
  graph: 'PASS', correctionBinding: 'PASS', oldBlockerPreserved: true, boundBlobs: binding.members.length, C2C: c2c, C2CB: c2cb,
  productionChangesInBindingCommit: false, selfReference: false }));
