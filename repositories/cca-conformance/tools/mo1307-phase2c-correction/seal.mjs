// Engineering-only acyclic correction inventory and binding. No product IO.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const base = '3883ca889911fcc5a6f46c24e569478a8c32648e';
const dir = 'repositories/cca-conformance/evidence/mo1307/phase2c-correction';
const sha = b => 'sha256:' + createHash('sha256').update(b).digest('hex');
const git = (...args) => {
  const r = spawnSync('git', args, { cwd: root, encoding: null, windowsHide: true, timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
  assert.ifError(r.error); assert.equal(r.status, 0, r.stderr.toString()); return r.stdout;
};
const str = (...args) => git(...args).toString('utf8').trim();
const record = (p, bytes = fs.readFileSync(path.join(root, p))) => ({ path: p, byteLength: bytes.length, sha256: sha(bytes) });
const write = (name, value) => fs.writeFileSync(path.join(root, dir, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
assert.equal(process.platform, 'win32'); assert.equal(str('branch', '--show-current'), 'main');
const mode = process.argv[2];
if (mode === 'inventory') {
  assert.equal(str('rev-parse', 'HEAD'), base);
  const tracked = str('diff', '--name-only', base).split('\n').filter(Boolean);
  const untracked = str('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);
  const names = [...new Set([...tracked, ...untracked])].sort();
  assert.ok(names.length > 0);
  const forbidden = names.filter(p => !p.startsWith('repositories/memoryos-readiness/')
    && !p.startsWith('repositories/cca-conformance/evidence/mo1307/phase2c-correction/')
    && !p.startsWith('repositories/cca-conformance/tools/mo1307-phase2c-correction/')
    && !['repositories/cca-conformance/tests/mo1307_phase1_native_test.mjs',
      'repositories/cca-conformance/tests/mo1307_phase2c_correction_test.mjs',
      'repositories/cca-conformance/tools/mo1307-phase1/generate-contracts.mjs',
      'docs/mo1307-contract-freeze-1.md', 'docs/mo1307-phase2c-publication-inspection-correction.md'].includes(p));
  assert.deepEqual(forbidden, []);
  write('changed-file-inventory.json', { kind: 'MemoryOSReadinessPublicationCorrectionInventory', version: '1.0.0', baseline: base,
    members: names.map(p => record(p)), exclusions: ['This inventory excludes itself to avoid self-reference. C2CB binds every C2C changed blob including this inventory.'],
    preservedHistoricalBindings: ['repositories/cca-conformance/mo1307-conformance-inventory.json', 'repositories/cca-conformance/evidence/mo1307/phase1/binding.json'],
    scope: 'CONTRACT_CORRECTION_AND_MINIMUM_FOUNDATION_ONLY', productionCertification: false });
  console.log(JSON.stringify({ result: 'PASS', members: names.length }));
} else if (mode === 'bind') {
  const commit = str('rev-parse', 'HEAD');
  assert.equal(str('rev-parse', commit + '^'), base);
  assert.equal(str('show', '-s', '--format=%s', commit), 'fix(memoryos-1.3): correct MO-1307 publication inspection contract');
  assert.equal(str('status', '--porcelain'), '');
  const members = str('diff-tree', '--no-commit-id', '--name-only', '-r', commit).split('\n').filter(Boolean).sort()
    .map(p => record(p, git('show', commit + ':' + p)));
  const binding = { kind: 'MemoryOSReadinessPublicationInspectionCorrectionBinding', version: '1.0.0',
    implementation: { commit, parent: base, tree: str('rev-parse', commit + '^{tree}'), subject: str('show', '-s', '--format=%s', commit) },
    members, graph: ['Freeze -> I1 -> B1 -> C2C -> C2CB'],
    resumed2CAuthority: 'The actual conformance-only direct child C2CB with the prescribed subject and verified binding is the sole corrected continuation baseline. Its exact hash is reported after it exists.',
    stopped2C: 'STOPPED_CONTRACT_INTERFACE_BLOCKER_NOT_PHASE2C_COMPLETE',
    productionChangesInBindingCommit: false, selfReference: 'Binds only existing C2C and its blobs; no current/future binding commit identity is embedded.' };
  write('binding.json', binding);
  console.log(JSON.stringify({ result: 'PASS', C2C: commit, members: members.length }));
} else throw new Error('Use inventory or bind');
