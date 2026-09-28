import { DEFINITIONS } from './constants.mjs';
import { canonicalDigest, candidateDigest, claimDigest } from './canonical.mjs';
import { fail } from './errors.mjs';
import { validateRecord, validateGraphStructure, assertPlainFields } from './foundation.mjs';
import { structurallyEqual } from './schema.mjs';

const L = DEFINITIONS.limits;
const by = key => (a, b) => a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
const edgeKey = edge => [edge.from, edge.type, edge.to].join('\0');
const graphError = (code = 'INPUT', reference = null) => fail(code, 'GRAPH', reference);

function uniqueMap(rows, key, reference = null) {
  const result = new Map();
  for (const row of rows) {
    const id = row[key];
    if (result.has(id)) graphError('INPUT', reference);
    result.set(id, row);
  }
  return result;
}

// Private normalization only: callers must first verify independently pinned
// source bytes, authority provenance and grant/claim/dependency correspondence.
export function normalizeEvidenceGrant(grant, provenance) {
  validateRecord('Grant', grant, { stage: 'GRAPH' });
  if (!Array.isArray(provenance)) graphError();
  if (provenance.length > L.authoritySources) graphError('RESOURCE_LIMIT');
  const sources = uniqueMap(provenance, 'id');
  const classes = new Set();
  for (const id of grant.authoritySourceIds) {
    const source = sources.get(id);
    if (!source) graphError('INPUT', id);
    validateRecord('AuthoritySource', source, { stage: 'GRAPH', reference: id });
    classes.add(source.classification);
  }
  const content = {
    claimDigest: grant.claimDigest,
    dependencyIds: [...grant.dependencyIds],
    scopeId: grant.scopeId,
    assumptions: structuredClone(grant.assumptions),
    applicability: grant.applicability,
    authorityClasses: [...classes].sort(),
  };
  validateRecord('NormalizedGrant', content, { stage: 'GRAPH' });
  return content;
}

// The graph is an internal derived object, never an input-controlled graph API.
// The foundation validates bounds, IDs, cycles and frozen typed endpoints; this
// layer additionally requires one assessment root and complete reachability.
export function validateEvidenceGraph(graph, { candidateDigest: expected = null } = {}) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) graphError();
  if (graph.nodes.length > L.graphNodes || graph.edges.length > L.graphEdges) graphError('GRAPH_LIMIT');
  validateGraphStructure(graph);
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const outgoing = new Map(graph.nodes.map(node => [node.id, []]));
  const incoming = new Map(graph.nodes.map(node => [node.id, []]));
  for (const node of graph.nodes) {
    if (node.type !== 'ASSESSMENT' && node.id !== `${node.type}:${node.digest}`) graphError('INTEGRITY');
  }
  const roots = graph.nodes.filter(node => node.type === 'ASSESSMENT');
  const candidates = graph.nodes.filter(node => node.type === 'CANDIDATE');
  if (roots.length !== 1 || roots[0].id !== 'assessment' || candidates.length !== 1) graphError();
  if (expected !== null && candidates[0].digest !== expected) graphError('CANDIDATE_MISMATCH', 'candidate');
  for (const edge of graph.edges) {
    outgoing.get(edge.from).push(edge);
    incoming.get(edge.to).push(edge);
  }
  const assesses = outgoing.get('assessment').filter(edge => edge.type === 'ASSESSES');
  if (assesses.length !== 1 || assesses[0].to !== candidates[0].id) graphError();
  for (const node of graph.nodes) {
    const out = outgoing.get(node.id), into = incoming.get(node.id);
    if (node.type === 'GRANT') {
      if (into.length !== 1 || into[0].type !== 'ACCEPTS' || out.filter(edge => edge.type === 'AUTHORIZES').length !== 1) graphError();
      const authorities = out.filter(edge => edge.type === 'ROOTED_IN');
      if (authorities.length === 0 || authorities.length > 3) graphError();
    }
    if (node.type === 'CLAIM') {
      if (into.length !== 1 || into[0].type !== 'AUTHORIZES' || out.length === 0) graphError();
      const candidateEdges = out.filter(edge => nodes.get(edge.to).type === 'CANDIDATE');
      if (candidateEdges.length && (candidateEdges.length !== 1 || out.length !== 1)) graphError();
      if (out.length > L.dependenciesPerClaim) graphError('RESOURCE_LIMIT');
    }
  }
  const reached = new Set(['assessment']), queue = ['assessment'];
  for (let i = 0; i < queue.length; i++) for (const edge of outgoing.get(queue[i])) {
    if (!reached.has(edge.to)) { reached.add(edge.to); queue.push(edge.to); }
  }
  if (reached.size !== nodes.size) graphError();
  return graph;
}

export function deriveEvidenceGraph({ candidate, authority, claims }) {
  // These are the existing frozen records. No alternate graph/schema or gate
  // state is accepted, and no raw-source data can contribute normative edges.
  validateRecord('Candidate', candidate, { stage: 'GRAPH', reference: 'candidate' });
  validateRecord('Authority', authority, { stage: 'GRAPH', reference: 'authority' });
  if (!Array.isArray(claims)) graphError();
  if (claims.length > L.claims) graphError('RESOURCE_LIMIT');
  const current = candidateDigest(candidate);
  if (current !== authority.assessment.candidateDigest) graphError('CANDIDATE_MISMATCH', 'candidate');
  const components = uniqueMap(candidate.components, 'id', 'candidate');
  const envelopes = new Map(), claimIdentities = new Set();
  for (const row of claims) {
    assertPlainFields(row, ['envelopeId', 'claim'], 'GRAPH');
    validateRecord('Id', row.envelopeId, { stage: 'GRAPH' });
    validateRecord('Claim', row.claim, { stage: 'GRAPH', reference: row.envelopeId });
    const identity = claimDigest(row.claim);
    if (envelopes.has(row.envelopeId) || claimIdentities.has(identity)) graphError('INPUT', row.envelopeId);
    envelopes.set(row.envelopeId, row.claim); claimIdentities.add(identity);
  }
  const sources = uniqueMap(authority.provenance, 'id', 'authority');
  const grants = uniqueMap(authority.assessment.grants, 'id', 'authority');
  const consumed = new Set();
  for (const slot of authority.assessment.slots) for (const id of slot.grantIds) {
    if (!grants.has(id)) graphError('INPUT', id);
    consumed.add(id);
  }
  if (consumed.size !== grants.size) graphError('EVIDENCE_AUTHORITY', 'authority');
  const nodes = new Map(), edges = new Map(), grantDigests = new Map();
  const usedEnvelopes = new Set(), normalizedIdentities = new Set(), bindings = [];
  const addNode = (type, content) => {
    const digest = type === 'ASSESSMENT' ? null : canonicalDigest(content);
    const id = type === 'ASSESSMENT' ? 'assessment' : `${type}:${digest}`;
    if (!nodes.has(id)) {
      if (nodes.size === L.graphNodes) graphError('GRAPH_LIMIT');
      nodes.set(id, { id, type, digest });
    }
    return id;
  };
  const addEdge = (from, type, to) => {
    const edge = { from, type, to }, key = edgeKey(edge);
    if (!edges.has(key)) {
      if (edges.size === L.graphEdges) graphError('GRAPH_LIMIT');
      edges.set(key, edge);
    }
  };
  addNode('ASSESSMENT');
  const candidateNode = addNode('CANDIDATE', candidate);
  addEdge('assessment', 'ASSESSES', candidateNode);
  for (const grant of authority.assessment.grants) {
    const claim = envelopes.get(grant.envelopeId);
    if (!claim) graphError('INPUT', grant.envelopeId);
    const identity = claimDigest(claim);
    if (identity !== grant.claimDigest) graphError('EVIDENCE_AUTHORITY', grant.id);
    if (usedEnvelopes.has(grant.envelopeId)) graphError('INPUT', grant.id);
    usedEnvelopes.add(grant.envelopeId);
    const normalized = normalizeEvidenceGrant(grant, authority.provenance);
    const grantDigest = canonicalDigest(normalized);
    if (normalizedIdentities.has(grantDigest)) graphError('INPUT', grant.id);
    normalizedIdentities.add(grantDigest); grantDigests.set(grant.id, grantDigest);
    if (!structurallyEqual(claim.dependencies.map(row => row.componentId), grant.dependencyIds)) graphError('EVIDENCE_AUTHORITY', grant.id);
    const grantNode = addNode('GRANT', normalized), claimNode = addNode('CLAIM', claim);
    addEdge('assessment', 'ACCEPTS', grantNode);
    addEdge(grantNode, 'AUTHORIZES', claimNode);
    for (const id of grant.authoritySourceIds) {
      const source = sources.get(id);
      if (!source) graphError('INPUT', id);
      const authorityNode = addNode('AUTHORITY', {
        classification: source.classification, scopeId: grant.scopeId, assumptions: grant.assumptions,
      });
      addEdge(grantNode, 'ROOTED_IN', authorityNode);
    }
    if (claim.binding === 'WHOLE_CANDIDATE') {
      if (claim.originCandidate !== current) graphError('CANDIDATE_MISMATCH', grant.envelopeId);
      if (claim.dependencies.length) graphError('INPUT', grant.envelopeId);
      addEdge(claimNode, 'DEPENDS_ON', candidateNode);
    } else {
      if (!claim.dependencies.length) graphError('INPUT', grant.envelopeId);
      for (const dependency of claim.dependencies) {
        const { componentId: id, role, byteLength, sha256 } = dependency;
        const content = { id, role, byteLength, sha256 }, component = components.get(id);
        if (!component) graphError('INPUT', id);
        if (!structurallyEqual(content, component)) graphError('STALE_EVIDENCE', grant.envelopeId);
        addEdge(claimNode, 'DEPENDS_ON', addNode('DEPENDENCY', content));
      }
    }
    bindings.push({
      grantId: grant.id, grantDigest, claimDigest: identity,
      envelopeId: grant.envelopeId, envelopeSha256: grant.envelopeSha256,
      sourceIds: [...grant.sourceIds], authoritySourceIds: [...grant.authoritySourceIds],
    });
  }
  if (usedEnvelopes.size !== envelopes.size) graphError('EVIDENCE_AUTHORITY');
  const graph = {
    kind: 'MemoryOSReadinessGraph', version: '1.0.0',
    nodes: [...nodes.values()].sort(by('id')),
    edges: [...edges.values()].sort((a, b) => edgeKey(a) < edgeKey(b) ? -1 : edgeKey(a) > edgeKey(b) ? 1 : 0),
  };
  validateEvidenceGraph(graph, { candidateDigest: current });
  const a = authority.assessment;
  const normalizedAuthority = {
    candidateDigest: current, profile: structuredClone(a.profile), stage: a.stage,
    scopeId: a.scopeId, assumptions: structuredClone(a.assumptions),
    requiredComponents: structuredClone(a.requiredComponents), semanticContracts: structuredClone(a.semanticContracts),
    normalizedGrants: [...normalizedIdentities].sort(),
    slots: a.slots.map(slot => ({
      gateId: slot.gateId, grantDigests: slot.grantIds.map(id => grantDigests.get(id)).sort(),
      availability: slot.availability, reason: slot.reason,
    })),
  };
  validateRecord('NormalizedAuthority', normalizedAuthority, { stage: 'GRAPH' });
  return {
    graph, graphDigest: canonicalDigest(graph),
    authorityIdentityDigest: canonicalDigest(normalizedAuthority), normalizedAuthority,
    bindings: bindings.sort(by('grantId')),
  };
}
