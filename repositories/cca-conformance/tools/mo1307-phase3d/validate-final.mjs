// Read-only validator for the MO-1307 Phase 3D certification state. Writes nothing; executes no product.
//   On I3 (parent = accepted 3AR2 evidence commit): reports I3_VALID_PENDING_BF.
//   On BF (binding-only child of I3): reports CERTIFIED_READY_TO_TAG after every binding and claim is re-derived.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { evidenceRel, inventoryRel, bindingRel, docRel, toolRel, toolNames, ids, limits, abs, record, json, gitText, gitBlob, hash, requireNode, sortKeys } from './common.mjs';
import { derive } from './claims.mjs';

requireNode();
const hasBinding = fs.existsSync(abs(bindingRel));
const head = gitText('rev-parse', 'HEAD');
assert.equal(gitText('status', '--porcelain=v1', '--untracked-files=all'), '', 'validation requires a clean committed tree');
const parent = gitText('show', '-s', '--format=%P', 'HEAD');
const i3 = hasBinding ? parent : head;
assert.equal(gitText('show', '-s', '--format=%P', i3), ids.E3A, 'I3 must be a single-parent child of the accepted 3AR2 evidence commit');
assert.equal(gitText('rev-list', '--count', `${ids.E3A}..${i3}`), '1');

// Scope of I3: only additions inside the Phase 3D paths; BF: exactly the binding file.
const i3Changes = gitText('diff', '--name-status', ids.E3A, i3).split('\n').filter(Boolean).map(l => l.split('\t'));
assert.ok(i3Changes.every(([s, p]) => s === 'A' && (p.startsWith(evidenceRel + '/') || p.startsWith(toolRel + '/') || p === inventoryRel || p === docRel)), 'I3 changes outside Phase 3D scope');
if (hasBinding) assert.deepEqual(gitText('diff', '--name-status', i3, 'HEAD').split('\n').filter(Boolean).map(l => l.split('\t')), [['A', bindingRel]], 'BF must add exactly the binding file');
// Production bytes: exactly C3VB's tree, untouched.
assert.equal(gitText('rev-parse', 'HEAD:repositories/memoryos-readiness'), ids.productionTree);
assert.equal(gitText('diff', '--name-only', ids.C3VB, 'HEAD', '--', 'repositories/memoryos-readiness'), '');

// Recompute every claim from immutable inputs and compare with the I3 inventory.
const inventory = json(inventoryRel);
assert.equal(inventory.kind, 'MO1307Phase3DFinalReleaseInventory'); assert.equal(inventory.result, 'I3_COMPLETE_PENDING_BF_BINDING');
assert.deepEqual(sortKeys(JSON.parse(JSON.stringify(derive()))), sortKeys(inventory.claims), 'claims differ from independent re-derivation');
assert.deepEqual(inventory.candidate, { binding: ids.C3VB, production: ids.C3V, productionTree: ids.productionTree, evidenceCommit: ids.E3A, authorities: ['PROSPECTIVE_HELPER_BOUND@2.0.0', 'PROSPECTIVE_HELPER_AGGREGATE_BOUND@2.0.0'], limits });
const same = (row) => assert.deepEqual(record(row.path), row);
for (const row of inventory.tooling) same(row);
assert.deepEqual(inventory.tooling.map(r => r.path.split('/').pop()), toolNames.concat(['claims.mjs']).sort());
same(inventory.document); same(inventory.reproducibility); same(inventory.audit);
for (const copy of inventory.acceptedInputCopies) { same(copy.copy); assert.equal(hash(gitBlob(copy.source.commit, copy.source.path)), copy.copy.sha256); }
assert.equal(inventory.acceptedInputCopies.length, inventory.claims.phase3B.members.length + inventory.claims.phase3C.members.length);
const repro = json(inventory.reproducibility.path), audit = json(inventory.audit.path);
assert.equal(repro.result, 'PASS'); assert.equal(repro.byteIdentical, true); assert.equal(repro.assemblies.length, 2);
assert.equal(repro.assemblies[0].sha256, repro.assemblies[1].sha256); assert.equal(repro.assemblies[0].sha256, repro.acceptedGenerationArchive.sha256);
assert.deepEqual(record(repro.acceptedGenerationArchive.path), repro.acceptedGenerationArchive);
assert.equal(repro.externalProductionDependencies, 0); assert.equal(repro.packageIdentity, inventory.claims.phase3A.packageIdentity);
assert.equal(audit.result, 'PASS_WITH_DISCLOSED_STALE_TEST_BASELINE'); assert.equal(audit.contract.gates, 22); assert.equal(audit.conformanceSuite.fail, Object.keys(audit.conformanceSuite.failingTests).length); assert.deepEqual(Object.keys(audit.conformanceSuite.failingTests).sort(), ['C2C01', 'C2C17', 'C2C18', 'NRT01', 'R07', 'R08', 'R09']); assert.equal(audit.conformanceSuite.cancelled, 0);
assert.equal(audit.conformanceSuite.files, audit.conformanceSuite.suiteFiles.length); for (const row of audit.conformanceSuite.suiteFiles) same(row);
assert.equal(audit.acceptedGenerationVectors.cases, 80); assert.deepEqual(record(audit.acceptedGenerationVectors.receipt.path), audit.acceptedGenerationVectors.receipt);
assert.equal(inventory.tagPolicy.releaseTag, 'ABSENT');

let bound = null;
if (hasBinding) {
  const binding = json(bindingRel);
  assert.equal(binding.kind, 'MO1307Phase3DFinalBinding'); assert.equal(binding.result, 'BF_BINDING_ONLY');
  assert.equal(binding.i3.commit, i3); assert.equal(binding.i3.tree, gitText('rev-parse', i3 + '^{tree}')); assert.equal(binding.i3.parent, ids.E3A);
  assert.deepEqual(binding.inventory, record(inventoryRel));
  assert.deepEqual(binding.files.map(f => f.path).sort(), i3Changes.map(([, p]) => p).sort());
  for (const f of binding.files) { assert.deepEqual({ path: f.path, byteLength: f.byteLength, sha256: f.sha256 }, record(f.path)); assert.equal(f.gitBlob, gitText('rev-parse', `${i3}:${f.path}`)); assert.equal(hash(gitBlob(i3, f.path)), f.sha256); }
  assert.equal(JSON.stringify(binding).includes(head), false, 'BF must not embed its own hash');
  bound = { path: bindingRel, ...record(bindingRel) };
}
process.stdout.write(JSON.stringify({
  result: hasBinding ? 'CERTIFIED_READY_TO_TAG' : 'I3_VALID_PENDING_BF', head, i3, bf: hasBinding ? head : null, candidate: ids.C3VB, production: { commit: ids.C3V, tree: ids.productionTree },
  streams: { '3A': inventory.claims.phase3A.result, '3B': inventory.claims.phase3B.result, '3C': inventory.claims.phase3C.result },
  attempts: inventory.claims.attempts.length, conformanceTests: { total: audit.conformanceSuite.total, pass: audit.conformanceSuite.pass, fail: audit.conformanceSuite.fail },
  packageReproducible: true, releaseTag: 'ABSENT', humanTagReviewRequired: true, binding: bound,
}) + '\n');
