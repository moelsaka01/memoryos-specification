// Deterministic, read-only derivation of every Phase 3D integration claim from immutable repository bytes.
// Used by build-i3 (to write the inventory) and validate-final (to recompute and compare). Executes no product.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ids, limits, authorities, sourceRel, lineage, record, recordBytes, json, read, hash, git, gitText, gitBlob, abs } from './common.mjs';

const e3aEvidence = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h5-corrected';
const evid = name => 'repositories/cca-conformance/evidence/mo1307/' + name;

// [namespace, receipt file, expected result (or outcome), disposition]
export const attemptTable = Object.freeze([
  ['phase3ar2-c3tb', 'certification-receipt.json', 'PHASE3AR2_FAILED_INCOMPLETE', 'PRESERVED_FAILED_NOT_PROMOTED'],
  ['phase3ar2-c3ub', 'certification-receipt.json', 'PHASE3AR2_FAILED_INCOMPLETE', 'PRESERVED_FAILED_NOT_PROMOTED'],
  ['phase3ar2-final', 'certification-receipt.json', 'PHASE3AR2_CONCRETE_BLOCKER', 'PRESERVED_FAILED_NOT_PROMOTED'],
  ['phase3ar2-final-b-gate', 'gate-receipt.json', 'PHASE3AR2_CONCRETE_BLOCKER', 'PRESERVED_FAILED_PRECERTIFICATION_GATE'],
  ['phase3ar2-final-topology-observer-correction', 'receipt.json', 'PASS', 'ZERO_PRODUCT_CORRECTION_VALIDATED'],
  ['phase3ar2-final-corrected-b-gate', 'gate-receipt.json', 'PRE_CERTIFICATION_B_GATE_PASS', 'PRECERTIFICATION_GATE_PASS_NOT_CERTIFICATION'],
  ['phase3ar2-final-h-harness-correction', 'receipt.json', 'H_HARNESS_MARGIN_DEFECT_VALIDATED', 'ZERO_PRODUCT_CORRECTION_VALIDATED'],
  ['phase3ar2-final-h-corrected', 'certification-receipt.json', 'PHASE3AR2_CONCRETE_BLOCKER', 'PRESERVED_FAILED_NOT_PROMOTED'],
  ['phase3ar2-final-h2-harness-correction', 'receipt.json', 'H2_HARNESS_CORRECTION_VALIDATED', 'ZERO_PRODUCT_CORRECTION_VALIDATED'],
  ['phase3ar2-final-h2-corrected', 'certification-receipt.json', 'PHASE3AR2_CONCRETE_BLOCKER', 'PRESERVED_BLOCKED_OPERATOR_NOT_PROMOTED'],
  ['phase3ar2-final-h3-rebinding', 'receipt.json', 'H3_GENERATION_REBOUND_ZERO_PRODUCT', 'ZERO_PRODUCT_REBINDING_VALIDATED'],
  ['phase3ar2-final-h3-corrected', 'certification-receipt.json', 'PHASE3AR2_CONCRETE_BLOCKER', 'PRESERVED_FAILED_NOT_PROMOTED'],
  ['phase3ar2-final-h4-rebinding', 'receipt.json', 'H4_GENERATION_REBOUND_ZERO_PRODUCT', 'ZERO_PRODUCT_REBINDING_VALIDATED'],
  ['phase3ar2-final-h4-corrected', 'certification-receipt.json', 'PHASE3AR2_CONCRETE_BLOCKER', 'PRESERVED_FAILED_NOT_PROMOTED'],
  ['phase3ar2-final-h5-rebinding', 'receipt.json', 'H5_GENERATION_REBOUND_ZERO_PRODUCT', 'ZERO_PRODUCT_REBINDING_VALIDATED'],
  ['phase3ar2-final-h5-corrected', 'certification-receipt.json', 'PHASE3AR2_ACCEPTED_FINAL_CANDIDATE', 'ACCEPTED_FINAL_CANDIDATE'],
]);

// Failure classifications and root causes retained in the failed-attempt disposition (facts established by the preserved reports).
export const attemptNotes = Object.freeze({
  'phase3ar2-final': 'H helper-margin harness defect (artificially delayed EOF left too little headroom); classification H_HARNESS_MARGIN_DEFECT.',
  'phase3ar2-final-b-gate': 'Topology observer re-queried an already-authenticated helper (QueryFullProcessImageNameW error 31) and counted it as an unknown identity; observer defect corrected under MO1307_TOPOLOGY_IDENTITY_POLICY@1.0.0.',
  'phase3ar2-final-h-corrected': 'H2 failure: aggregate fixture shared a live evidence parent (H_AGGREGATE_FIXTURE_INPUT_ISOLATION_DEFECT) plus observer event-ordering defect (H_OBSERVER_EVENT_ORDERING_DEFECT).',
  'phase3ar2-final-h2-corrected': 'Operator error: namespace consumed before the run; no product process ran; preserved blocked.',
  'phase3ar2-final-h3-corrected': 'Step A helper 3 READ_SET reached the unchanged 9000-ms whole-lifecycle deadline under a host-latency spike (ENVIRONMENT); product correctly returned MO1307_TIMEOUT.',
  'phase3ar2-final-h4-corrected': 'Step L publication case 21: shared scratch parent changed NTFS-reported size between product identity inspections (H_PUBLICATION_FIXTURE_PARENT_ISOLATION_DEFECT, harness); steps A-K passed.',
  'phase3ar2-final-h5-corrected': 'Accepted: A-O PASS, 80/80 cases, unchanged limits, unchanged production bytes.',
});

export function derive() {
  const claims = {};

  // 1. Single-parent lineage C3TB -> E3A and exact production identity.
  const full = lineage.map(([c]) => gitText('rev-parse', c + '^{commit}'));
  assert.equal(full[0], ids.C3TB); assert.equal(full[7], ids.C3V); assert.equal(full[8], ids.C3VB); assert.equal(full[9], ids.E3A);
  const chain = full.map((commit, index) => {
    const parents = gitText('show', '-s', '--format=%P', commit).split(' ').filter(Boolean);
    if (index > 0) assert.deepEqual(parents, [full[index - 1]], 'lineage must be single-parent at ' + commit);
    return { commit, role: lineage[index][1], parent: index > 0 ? parents[0] : parents[0] ?? null, subject: gitText('show', '-s', '--format=%s', commit), tree: gitText('rev-parse', commit + '^{tree}') };
  });
  assert.equal(gitText('rev-list', '--count', '--first-parent', ids.E3A + '^{commit}', '^' + ids.C3TB), String(full.length - 1));
  claims.lineage = chain;
  const productionTrees = Object.fromEntries([ids.C3V, ids.C3VB, ids.E3A].map(c => [c, gitText('rev-parse', c + ':' + sourceRel)]));
  for (const tree of Object.values(productionTrees)) assert.equal(tree, ids.productionTree);
  const productionChanges = gitText('diff', '--name-only', ids.C3V, ids.E3A, '--', sourceRel);
  assert.equal(productionChanges, '', 'production bytes must not change after C3V');
  const changedC3TBtoC3V = gitText('diff', '--name-only', ids.C3TB, ids.C3VB, '--', sourceRel).split('\n').map(p => p.slice(sourceRel.length + 1)).sort();
  claims.production = { commit: ids.C3V, tree: ids.productionTree, authorities, limits, unchangedAfterC3V: true, changedFilesFromC3TB: changedC3TBtoC3V,
    helperLimitHistory: 'C3T 8000 ms -> C3V 9000 ms (PROSPECTIVE_HELPER_BOUND@2.0.0); aggregate 28000 ms (PROSPECTIVE_HELPER_AGGREGATE_BOUND@2.0.0); no limit changed during this Phase 3 completion.' };

  // 2. Phase 3A: fresh accepted C3VB installed-runtime certification.
  const receipt = json(e3aEvidence + '/certification-receipt.json');
  assert.equal(receipt.result, 'PHASE3AR2_ACCEPTED_FINAL_CANDIDATE'); assert.equal(receipt.completedMandatoryCases, 80); assert.equal(receipt.concreteBlocker, null);
  assert.deepEqual(receipt.steps.map(s => s.result), Array(15).fill('PASS')); assert.deepEqual(receipt.unexecuted, []);
  const handoff = json(e3aEvidence + '/phase3d-handoff.json');
  assert.equal(handoff.result, 'READY_FOR_SEPARATE_PHASE3D_INTEGRATION'); assert.equal(handoff.phase3AR2Result, 'PHASE3AR2_ACCEPTED_FINAL_CANDIDATE'); assert.equal(handoff.phase3DPerformed, false);
  assert.equal(handoff.candidate.commit ?? handoff.candidate, ids.C3VB);
  const accept = json(e3aEvidence + '/acceptance-validation.json');
  claims.phase3A = {
    commit: ids.E3A, generation: 'phase3ar2-final-h5-corrected', result: receipt.result, completedMandatoryCases: 80, steps: 'A-O PASS',
    receipt: record(e3aEvidence + '/certification-receipt.json'), handoff: record(e3aEvidence + '/phase3d-handoff.json'), acceptanceValidation: record(e3aEvidence + '/acceptance-validation.json'),
    seal: record(e3aEvidence + '/campaign-seal.json'), inventory: record(e3aEvidence + '/recovered-inventory.json'), integrity: record(e3aEvidence + '/integrity-after.json'),
    packageIdentity: handoff.packageIdentity, installedMembers: handoff.installedMemberCount, acceptanceResult: accept.result ?? null,
  };
  assert.equal(handoff.packageIdentity, 'sha256:0890ca4893ef76118eefbb2b5676ad084c60c70408d9e489f92aa33b74ba45b7');
  assert.equal(handoff.installedMemberCount, 89);

  // 3. Phases 3B/3C accepted inputs (immutable git blobs) and the exact C3TB -> C3VB changed-dependency deltas.
  const deltaB = json(e3aEvidence + '/phase3br2-final-binding-delta.json'), deltaC = json(e3aEvidence + '/phase3cr2-final-binding-delta.json');
  for (const delta of [deltaB, deltaC]) { assert.equal(delta.result, 'PASS'); assert.equal(delta.from.bindingCandidate.commit, ids.C3TB); assert.equal(delta.to.bindingCandidate.commit, ids.C3VB); assert.equal(delta.phase3DPerformed, false); assert.equal(delta.productExecution, false); assert.equal(delta.historicalOutcomePromoted, false); }
  const deltaChanged = delta => [...new Set([...delta.changedDependencySet, ...delta.generatedBindings].filter(row => row.changed).map(row => row.path))].sort();
  assert.deepEqual(deltaChanged(deltaB), changedC3TBtoC3V); assert.deepEqual(deltaChanged(deltaC), changedC3TBtoC3V);
  const accepted = (stream, commit, delta, resultField) => {
    assert.deepEqual(gitText('show', '-s', '--format=%P', commit).split(' '), [ids.C3TB], stream + ' acceptance must be a single-parent child of C3TB');
    const members = Object.entries(delta.preservedAcceptance).filter(([, v]) => v && typeof v === 'object' && v.gitBlob).map(([name, v]) => {
      const bytes = gitBlob(commit, v.path);
      assert.equal(hash(bytes), v.sha256, v.path); assert.equal(bytes.length, v.byteLength, v.path); assert.equal(gitText('rev-parse', commit + ':' + v.path), v.gitBlob);
      return { name, commit, path: v.path, byteLength: v.byteLength, sha256: v.sha256, gitBlob: v.gitBlob };
    });
    const main = JSON.parse(gitBlob(commit, members.find(m => m.name === 'receipt').path).toString('utf8'));
    return { commit, subject: gitText('show', '-s', '--format=%s', commit), result: main.result, resultExpected: resultField, rerun: false, members, delta: record(stream === '3B' ? e3aEvidence + '/phase3br2-final-binding-delta.json' : e3aEvidence + '/phase3cr2-final-binding-delta.json'),
      changedDependencies: deltaChanged(delta), unchangedDependencies: delta.unchangedDependencyCount ?? delta.unchangedDependencyProof.members };
  };
  claims.phase3B = accepted('3B', ids.P3BR2, deltaB, 'PHASE3BR2_ACCEPTED'); assert.equal(claims.phase3B.result, 'PHASE3BR2_ACCEPTED');
  claims.phase3C = accepted('3C', ids.P3CR2, deltaC, 'PASS_ACCEPTANCE_READY'); assert.equal(claims.phase3C.result, 'PASS_ACCEPTANCE_READY');
  assert.equal(claims.phase3B.unchangedDependencies, 82); assert.equal(claims.phase3C.unchangedDependencies, 82);

  // 4. Every failed/blocked/corrected attempt in the Phase 3AR2 lineage with its raw receipt digest and disposition.
  claims.attempts = attemptTable.map(([ns, file, expected, disposition]) => {
    const rel = evid(ns) + '/' + file, doc = json(rel);
    assert.equal(doc.result === expected || doc.outcome === expected, true, `${ns}: result ${doc.result}/${doc.outcome} != ${expected}`);
    return { namespace: ns, receipt: record(rel), result: expected, disposition, note: attemptNotes[ns] ?? null, promotedToHistoricalPass: false };
  });
  claims.historyDocuments = fs.readdirSync(abs('docs')).filter(n => /^mo1307-.*\.md$/.test(n) && n !== 'mo1307-phase3d-certification.md').sort().map(n => record('docs/' + n));

  // 5. Tag/push state: no release tag exists.
  const tags = gitText('tag', '-l').split('\n').filter(Boolean);
  claims.tags = { total: tags.length, mo1307Related: tags.filter(t => /mo1307|memoryos-readiness|readiness/i.test(t)) };
  assert.deepEqual(claims.tags.mo1307Related, []);
  return claims;
}
