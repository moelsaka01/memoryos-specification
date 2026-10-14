// MO-1307 Phase 3D shared helpers: read-only repository access, exact digests, canonical bytes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../../../', import.meta.url));
export const toolRel = 'repositories/cca-conformance/tools/mo1307-phase3d';
export const evidenceRel = 'repositories/cca-conformance/evidence/mo1307/phase3d';
export const inventoryRel = 'repositories/cca-conformance/mo1307-final-release-inventory.json';
export const bindingRel = 'repositories/cca-conformance/mo1307-final-binding.json';
export const docRel = 'docs/mo1307-phase3d-certification.md';
export const toolNames = ['common.mjs', 'build-i3.mjs', 'build-bf.mjs', 'validate-final.mjs'];

// Fixed accepted identities (all single-parent, all verified by build/validate).
export const ids = Object.freeze({
  C3TB: '119e68bdcf0ffc906b4ca03a912aadcb25908346', C3T: '65e24b2debdd70ecb8e52fbccbd6c101621f1917', C3TTree: '324bf600b6cbfaa8564db27fce2d999711270cb8',
  C3V: '98b766f9218b209f52251147213839b9775f6da3', C3VB: '17fa84efe46d30e6f4be85fd2427485677a222a3',
  productionTree: 'b9dabf54572e06c96bb5e48c4e20671f2cc24053',
  E3A: '0d254bba008616b36709fb4b742496a4a15c9e36',
  P3BR2: '4d92f0f21c9c3aad8202f4558d61b9229c7214fc', P3CR2: '7d2006c6e19bb50bffb6c710672be996e3c3590b',
});
export const authorities = Object.freeze(['PROSPECTIVE_HELPER_BOUND@2.0.0', 'PROSPECTIVE_HELPER_AGGREGATE_BOUND@2.0.0']);
export const limits = Object.freeze({ helperWholeLifecycleMs: 9000, aggregateHelperActiveMs: 28000, cliRenameAdmissionMs: 30000, apiWorkerMs: 10000, failureCleanupMs: 2000 });
export const sourceRel = 'repositories/memoryos-readiness';

export const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
export const abs = rel => path.join(root, rel);
export const read = rel => fs.readFileSync(abs(rel));
export const json = rel => JSON.parse(read(rel).toString('utf8'));
export const record = rel => { const bytes = read(rel); return { path: rel, byteLength: bytes.length, sha256: hash(bytes) }; };
export const recordBytes = (rel, bytes) => ({ path: rel, byteLength: bytes.length, sha256: hash(bytes) });
export function git(...args) {
  const r = spawnSync('C:/Program Files/Git/cmd/git.exe', ['-c', 'safe.directory=*', ...args], { cwd: root, encoding: null, windowsHide: true, maxBuffer: 256 << 20 });
  assert.ifError(r.error); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr.toString()}`);
  return r.stdout;
}
export const gitText = (...args) => git(...args).toString('utf8').trim();
export const gitBlob = (commit, rel) => git('show', `${commit}:${rel}`);
export function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])]));
  return value;
}
export const canonicalBytes = value => Buffer.from(JSON.stringify(sortKeys(value), null, 2) + '\n');
export function walkFiles(rel) {
  const out = [];
  (function visit(dir) {
    for (const entry of fs.readdirSync(abs(dir), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const child = dir + '/' + entry.name;
      assert.equal(fs.lstatSync(abs(child)).isSymbolicLink(), false, child);
      if (entry.isDirectory()) visit(child); else out.push(child);
    }
  })(rel);
  return out;
}
export function requireNode() {
  assert.equal(process.version, 'v24.21.0'); assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64');
  assert.equal(hash(fs.readFileSync(process.execPath)), 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
}
// The single-parent lineage from the C3TB binding to the accepted 3AR2 evidence commit.
export const lineage = Object.freeze([
  ['119e68bdcf0ffc906b4ca03a912aadcb25908346', 'C3TB'], ['9f45656c', 'preserve failed C3TB Phase 3AR2'], ['34f42c50', 'C3U production'], ['91c07b1e', 'C3UB binding'],
  ['789d92f9', 'preserve failed C3UB Phase 3AR2'], ['93508316', 'bind Phase 3AR2 B diagnostic'], ['4208ea48', 'preserve Phase 3AR2 B diagnostic blocker'],
  ['98b766f9218b209f52251147213839b9775f6da3', 'C3V production'], ['17fa84efe46d30e6f4be85fd2427485677a222a3', 'C3VB binding'], ['0d254bba008616b36709fb4b742496a4a15c9e36', 'E3A accepted Phase 3AR2 evidence'],
]);
