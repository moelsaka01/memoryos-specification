// Writes the binding-only BF record. Run once on the committed I3 tip. BF adds exactly one file and edits nothing.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { root, evidenceRel, inventoryRel, bindingRel, docRel, toolRel, ids, abs, record, gitText, gitBlob, canonicalBytes, requireNode, hash } from './common.mjs';

requireNode();
const i3 = gitText('rev-parse', 'HEAD');
assert.equal(gitText('show', '-s', '--format=%P', 'HEAD'), ids.E3A, 'I3 must be a single-parent child of the accepted 3AR2 evidence commit');
assert.equal(gitText('status', '--porcelain=v1', '--untracked-files=all'), '', 'I3 must be committed and the worktree clean');
assert.equal(fs.existsSync(abs(bindingRel)), false, 'BF binding already exists');
const changed = gitText('diff', '--name-status', ids.E3A, 'HEAD').split('\n').filter(Boolean).map(line => { const [status, ...rest] = line.split('\t'); return { status, path: rest.join('\t') }; });
assert.ok(changed.length > 0 && changed.every(c => c.status === 'A'), 'I3 must only add files');
assert.ok(changed.every(c => c.path.startsWith(evidenceRel + '/') || c.path.startsWith(toolRel + '/') || c.path === inventoryRel || c.path === docRel), 'I3 added a file outside the Phase 3D scope');
const files = changed.map(c => ({ ...record(c.path), gitBlob: gitText('rev-parse', `HEAD:${c.path}`) }));
const binding = {
  kind: 'MO1307Phase3DFinalBinding', version: '1.0.0', result: 'BF_BINDING_ONLY',
  i3: { commit: i3, tree: gitText('rev-parse', 'HEAD^{tree}'), parent: ids.E3A, addedFileCount: files.length },
  candidate: { binding: ids.C3VB, production: ids.C3V, productionTree: ids.productionTree, evidenceCommit: ids.E3A },
  inventory: record(inventoryRel), files,
  statement: 'This binding-only child binds the exact I3 commit and its immutable bytes. It embeds no future BF hash. The accepted certification state is established only by the read-only validator on the containing BF commit; any later annotated release tag must target that exact BF and requires separate human review.',
  tagPolicy: { releaseTag: 'ABSENT', humanTagReviewRequired: true, computedReadyIsNotAHumanDecision: true, push: false, tag: false },
};
const bytes = canonicalBytes(binding);
fs.writeFileSync(abs(bindingRel), bytes, { flag: 'wx' });
process.stdout.write(JSON.stringify({ result: 'BF_BINDING_WRITTEN', binding: { path: bindingRel, byteLength: bytes.length, sha256: hash(bytes) }, i3 }) + '\n');
