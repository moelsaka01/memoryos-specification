// Engineering-only adapter for Phase 2A, deliberately outside the shipped package.
// These fixed fixture projections ASSUME upstream verification; loading a fixture
// does not authenticate its authority, grants, history, sources, reuse or graph.
// No gates/readiness/blockers/derived qualifications are copied into core input.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalDigest } from '../../../memoryos-readiness/src/canonical.mjs';

export const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../fixtures/mo1307');
export const fixtureBytes = path => readFileSync(resolve(fixtureRoot, path));
export const fixtureJSON = path => JSON.parse(fixtureBytes(path));
export const bundleNames = readdirSync(resolve(fixtureRoot, 'bundles')).sort();
export const clone = value => structuredClone(value);
const unique = values => [...new Set(values)].sort();
const by = key => (a, b) => a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;

export function loadProjection(name = 'ready') {
  if (!bundleNames.includes(name)) throw Error('Unknown fixed fixture bundle');
  const base = `bundles/${name}/`;
  const authority = fixtureJSON(base + 'authority.json');
  const manifest = fixtureJSON(base + 'manifest.json');
  const expected = fixtureJSON(base + 'expected-result.json');
  const bindings = new Map(expected.audit.bindings.map(row => [row.grantId, row]));
  const a = expected.assessment;
  const verified = {
    candidate: fixtureJSON(base + 'candidate.json'), candidateDigest: a.candidateDigest,
    profile: clone(a.profile), stage: a.stage, scopeId: authority.assessment.scopeId,
    authorityIdentityDigest: a.authorityIdentityDigest,
    slots: authority.assessment.slots.map(({ grantIds, ...slot }) => ({ ...slot, grantDigests: unique(grantIds.map(id => bindings.get(id).grantDigest)) })),
    claims: authority.assessment.grants.map(grant => {
      const entry = manifest.entries.find(row => row.id === grant.envelopeId);
      const claim = fixtureJSON(base + entry.path).claim;
      return { claim, claimDigest: grant.claimDigest, grantDigest: bindings.get(grant.id).grantDigest };
    }),
    graph: clone(a.graph), graphDigest: a.graphDigest, audit: clone(expected.audit),
  };
  return { verified, expected, expectedBytes: fixtureBytes(base + 'expected-result.json'), summaryBytes: fixtureBytes(base + 'expected-summary.json'), pins: fixtureJSON(base + 'pins.json') };
}

export function selected(verified, gateId) {
  const slot = verified.slots.find(row => row.gateId === gateId);
  return verified.claims.find(row => slot.grantDigests.includes(row.grantDigest));
}

// Synthetic semantic mutations update normalized identities and supplied graph
// references mechanically. They do NOT produce/review new production authority
// or regenerate raw source proofs. Phase 2B must verify those at integration.
export function editClaim(verified, gateId, edit) {
  const row = selected(verified, gateId);
  if (!row) throw Error('Mutation needs an available claim');
  const oldClaim = row.claimDigest, oldGrant = row.grantDigest;
  edit(row.claim);
  row.claimDigest = canonicalDigest(row.claim);
  const binding = verified.audit.bindings.find(item => item.grantDigest === oldGrant);
  const authorityClasses = unique(binding.authoritySourceIds.map(id => verified.audit.authoritySources.find(item => item.id === id).classification));
  row.grantDigest = canonicalDigest({ claimDigest: row.claimDigest, dependencyIds: row.claim.dependencies.map(item => item.componentId), scopeId: row.claim.scopeId, assumptions: row.claim.assumptions, applicability: row.claim.originCandidate === verified.candidateDigest ? 'CURRENT' : 'REUSED', authorityClasses });
  for (const slot of verified.slots) slot.grantDigests = slot.grantDigests.map(id => id === oldGrant ? row.grantDigest : id).sort();
  binding.claimDigest = row.claimDigest; binding.grantDigest = row.grantDigest;
  const changed = new Map([['CLAIM:' + oldClaim, 'CLAIM:' + row.claimDigest], ['GRANT:' + oldGrant, 'GRANT:' + row.grantDigest]]);
  for (const node of verified.graph.nodes) if (changed.has(node.id)) { node.id = changed.get(node.id); node.digest = node.id.slice(node.type.length + 1); }
  for (const edge of verified.graph.edges) { edge.from = changed.get(edge.from) ?? edge.from; edge.to = changed.get(edge.to) ?? edge.to; }
  verified.graph.nodes.sort(by('id'));
  verified.graph.edges.sort((a, b) => by('from')(a, b) || by('type')(a, b) || by('to')(a, b));
  verified.graphDigest = canonicalDigest(verified.graph);
  return row;
}

export function setCoverage(verified, gateId, { failed = [], unevaluable = [] }) {
  return editClaim(verified, gateId, claim => {
    const all = unique([...claim.passed, ...claim.failed, ...claim.unevaluable]);
    claim.failed = [...failed].sort(); claim.unevaluable = [...unevaluable].sort();
    claim.passed = all.filter(code => !failed.includes(code) && !unevaluable.includes(code));
    claim.verdict = failed.length ? 'FAIL' : unevaluable.length ? 'UNEVALUABLE' : 'PASS';
  });
}

export function makeUnavailable(verified, gateId, reason = 'MISSING') {
  const row = selected(verified, gateId);
  const removed = row.grantDigest;
  for (const slot of verified.slots.filter(item => item.grantDigests.includes(removed))) {
    slot.grantDigests = []; slot.availability = 'UNAVAILABLE'; slot.reason = reason;
  }
  verified.claims = verified.claims.filter(item => item !== row);
  verified.audit.bindings = verified.audit.bindings.filter(item => item.grantDigest !== removed);
  const removeIds = new Set(['GRANT:' + removed, 'CLAIM:' + row.claimDigest]);
  verified.graph.nodes = verified.graph.nodes.filter(item => !removeIds.has(item.id));
  verified.graph.edges = verified.graph.edges.filter(item => !removeIds.has(item.from) && !removeIds.has(item.to));
  verified.graphDigest = canonicalDigest(verified.graph);
}

export function addInformational(verified, gateId, id = 'q.extra') {
  const qualification = { id, type: 'MemoryOSReadinessQualification', version: '1.0.0', gateIds: [gateId], provider: null, scopeId: verified.scopeId, reasonCode: 'ENVIRONMENT_LIMITATION', impact: 'INFORMATIONAL', disclosureCode: 'ENVIRONMENT_LIMITATION', conditionIds: [] };
  editClaim(verified, gateId, claim => { claim.qualifications.push(qualification); claim.qualifications.sort(by('id')); });
  editClaim(verified, 'scope', claim => { claim.detail.qualificationIds.push(id); claim.detail.qualificationIds.sort(); });
  return qualification;
}
