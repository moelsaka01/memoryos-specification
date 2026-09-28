import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { canonicalBytes as J, canonicalDigest as H } from '../../memoryos-readiness/src/canonical.mjs';
import { deriveEvidenceGraph, normalizeEvidenceGrant, validateEvidenceGraph } from '../../memoryos-readiness/src/evidence-graph.mjs';

const fixtures = new URL('../fixtures/mo1307/', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, fixtures), 'utf8'));
const clone = value => structuredClone(value);
const code = (fn, expected) => assert.throws(fn, error => error.code === `MO1307_${expected}` && error.stage === 'GRAPH');
const edgeKey = edge => [edge.from, edge.type, edge.to].join('\0');
const sort = graph => {
  graph.nodes.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  graph.edges.sort((a, b) => edgeKey(a) < edgeKey(b) ? -1 : edgeKey(a) > edgeKey(b) ? 1 : 0);
  return graph;
};
function bundle(name = 'ready') {
  const prefix = `bundles/${name}/`, manifest = read(prefix + 'manifest.json');
  return {
    candidate: read(prefix + 'candidate.json'), authority: read(prefix + 'authority.json'),
    claims: manifest.entries.filter(entry => entry.type === 'ENVELOPE').map(entry => ({
      envelopeId: entry.id, claim: read(prefix + entry.path).claim,
    })),
  };
}
const ready = () => read('bundles/ready/expected-graph.json');
const change = (operation, graph = ready()) => { operation(graph); return sort(graph); };

for (const name of readdirSync(new URL('bundles/', fixtures))) test(`G01 exact frozen graph, authority and audit bindings: ${name}`, () => {
  const input = bundle(name), actual = deriveEvidenceGraph(input);
  const expected = read(`bundles/${name}/expected-result.json`);
  assert.deepEqual(J(actual.graph), readFileSync(new URL(`bundles/${name}/expected-graph.json`, fixtures)));
  assert.equal(actual.graphDigest, expected.assessment.graphDigest);
  assert.equal(actual.authorityIdentityDigest, expected.assessment.authorityIdentityDigest);
  assert.deepEqual(actual.bindings, expected.audit.bindings);
  assert.equal(Object.hasOwn(actual, 'readiness'), false);
  assert.deepEqual(actual, deriveEvidenceGraph({ ...input, claims: input.claims.toReversed() }));
});

test('G02 exactly six node and five edge types, one root, content sharing and origin provenance', () => {
  const input = bundle('mo1306-qualified'), { graph } = deriveEvidenceGraph(input);
  assert.deepEqual([...new Set(graph.nodes.map(row => row.type))].sort(), ['ASSESSMENT', 'AUTHORITY', 'CANDIDATE', 'CLAIM', 'DEPENDENCY', 'GRANT']);
  assert.deepEqual([...new Set(graph.edges.map(row => row.type))].sort(), ['ACCEPTS', 'ASSESSES', 'AUTHORIZES', 'DEPENDS_ON', 'ROOTED_IN']);
  assert.equal(graph.nodes.filter(row => row.type === 'ASSESSMENT').length, 1);
  const selected = input.authority.assessment.grants.length;
  assert.equal(graph.nodes.filter(row => row.type === 'GRANT').length, selected);
  assert.equal(graph.nodes.filter(row => row.type === 'CLAIM').length, selected);
  assert.ok(graph.nodes.filter(row => row.type === 'AUTHORITY').length < selected);
  const reused = deriveEvidenceGraph(bundle('selective-reuse')).graph;
  assert.equal(reused.nodes.filter(row => row.type === 'CANDIDATE').length, 1);
});

test('G03 metadata and opaque historical cross-links cannot add normative authority or cycles', () => {
  assert.deepEqual(deriveEvidenceGraph(bundle()).graph, deriveEvidenceGraph(bundle('metadata-only')).graph);
  const input = bundle('mo1306-qualified'), original = deriveEvidenceGraph(input);
  for (const source of input.authority.provenance) {
    source.path = 'changed/source.data'; source.sha256 = H('opaque self-reference to future grant and assessment');
    source.revision = 'a'.repeat(40); source.blob = 'b'.repeat(40); source.tree = 'c'.repeat(40);
    if (source.releaseTag) source.releaseTag.target = source.revision;
  }
  const changed = deriveEvidenceGraph(input);
  assert.deepEqual(changed.graph, original.graph);
  assert.equal(changed.authorityIdentityDigest, original.authorityIdentityDigest);
  // Byte verification belongs to the upstream authority verifier: raw mutation
  // under unchanged trusted pins must fail there, before this private seam.
});

test('G04 missing normative claim, dependency, authority, grant and edge endpoints reject', () => {
  for (const type of ['CLAIM', 'DEPENDENCY', 'AUTHORITY', 'GRANT', 'CANDIDATE']) {
    code(() => validateEvidenceGraph(change(graph => {
      const target = graph.nodes.find(node => node.type === type);
      graph.nodes = graph.nodes.filter(node => node.id !== target.id);
    })), 'INPUT');
  }
  code(() => validateEvidenceGraph(change(graph => { graph.edges[0].to = `CLAIM:${H('missing')}`; })), 'INPUT');
});

test('G05 duplicate node IDs, duplicate edges, malformed content IDs and unknown types reject', () => {
  code(() => validateEvidenceGraph(change(graph => graph.nodes.push(clone(graph.nodes[0])))), 'INPUT');
  code(() => validateEvidenceGraph(change(graph => graph.edges.push(clone(graph.edges[0])))), 'INPUT');
  code(() => validateEvidenceGraph(change(graph => { graph.nodes[0].digest = H('substituted'); })), 'INTEGRITY');
  code(() => validateEvidenceGraph(change(graph => { graph.nodes[0].type = 'SOURCE'; })), 'INPUT');
  code(() => validateEvidenceGraph(change(graph => { graph.edges[0].type = 'APPROVES'; })), 'INPUT');
});

test('G06 wrong edge direction, endpoint type, root and candidate identity reject', () => {
  code(() => validateEvidenceGraph(change(graph => {
    const edge = graph.edges.find(row => row.type === 'ROOTED_IN'); edge.type = 'DEPENDS_ON';
  })), 'INPUT');
  code(() => validateEvidenceGraph(change(graph => {
    graph.nodes = graph.nodes.filter(row => row.type !== 'ASSESSMENT');
    graph.edges = graph.edges.filter(row => row.from !== 'assessment');
  })), 'INPUT');
  code(() => validateEvidenceGraph(ready(), { candidateDigest: H('wrong candidate') }), 'CANDIDATE_MISMATCH');
  code(() => validateEvidenceGraph(change(graph => {
    graph.nodes.find(row => row.type === 'ASSESSMENT').id = 'wrong-root';
  })), 'INPUT');
});

test('G07 every grant and claim must be rooted and every normative node reachable', () => {
  for (const type of ['ACCEPTS', 'AUTHORIZES', 'ROOTED_IN', 'ASSESSES']) code(() => validateEvidenceGraph(change(graph => {
    const target = graph.edges.find(edge => edge.type === type);
    graph.edges = graph.edges.filter(edge => edge !== target);
  })), 'INPUT');
  code(() => validateEvidenceGraph(change(graph => {
    const digest = H('unreachable'); graph.nodes.push({ id: `DEPENDENCY:${digest}`, type: 'DEPENDENCY', digest });
  })), 'INPUT');
  code(() => validateEvidenceGraph(change(graph => {
    const claim = graph.nodes.find(node => node.type === 'CLAIM');
    graph.edges = graph.edges.filter(edge => edge.from !== claim.id);
  })), 'INPUT');
});

test('G08 internal normative cycles and self references retain exact GRAPH_CYCLE classification', () => {
  code(() => validateEvidenceGraph(read('negative/graph-cycle.json')), 'GRAPH_CYCLE');
  code(() => validateEvidenceGraph(change(graph => {
    const id = graph.nodes.find(node => node.type === 'CLAIM').id;
    graph.edges.push({ from: id, type: 'DEPENDS_ON', to: id });
  })), 'GRAPH_CYCLE');
  code(() => validateEvidenceGraph(change(graph => {
    const grant = graph.nodes.find(node => node.type === 'GRANT').id;
    graph.edges.push({ from: grant, type: 'ROOTED_IN', to: 'assessment' });
  })), 'GRAPH_CYCLE');
});

test('G09 dependency claims cannot mix current candidate and dependency edges', () => {
  code(() => validateEvidenceGraph(change(graph => {
    const edge = graph.edges.find(row => row.type === 'DEPENDS_ON' && row.to.startsWith('DEPENDENCY:'));
    graph.edges.push({ from: edge.from, type: 'DEPENDS_ON', to: graph.nodes.find(node => node.type === 'CANDIDATE').id });
  })), 'INPUT');
});

function syntheticGraph(dependencies, claims, dependencyEdges) {
  const graph = { kind: 'MemoryOSReadinessGraph', version: '1.0.0', nodes: [], edges: [] };
  const node = (type, i) => {
    const digest = type === 'ASSESSMENT' ? null : H({ type, i });
    const id = type === 'ASSESSMENT' ? 'assessment' : `${type}:${digest}`;
    graph.nodes.push({ id, type, digest }); return id;
  };
  const edge = (from, type, to) => graph.edges.push({ from, type, to });
  const root = node('ASSESSMENT', 0), candidate = node('CANDIDATE', 0), authority = node('AUTHORITY', 0);
  edge(root, 'ASSESSES', candidate);
  const deps = Array.from({ length: dependencies }, (_, i) => node('DEPENDENCY', i));
  let remaining = dependencyEdges, cursor = 0;
  for (let i = 0; i < claims; i++) {
    const grant = node('GRANT', i), claim = node('CLAIM', i);
    edge(root, 'ACCEPTS', grant); edge(grant, 'AUTHORIZES', claim); edge(grant, 'ROOTED_IN', authority);
    const count = Math.min(1024, remaining - (claims - i - 1));
    for (let j = 0; j < count; j++) edge(claim, 'DEPENDS_ON', deps[(cursor++) % deps.length]);
    remaining -= count;
  }
  assert.equal(remaining, 0);
  return sort(graph);
}

test('G10 graph nodes exactly 2048 pass and 2049 fail before expansion', () => {
  const graph = syntheticGraph(2041, 2, 2041);
  assert.equal(graph.nodes.length, 2048); validateEvidenceGraph(graph);
  const digest = H('one additional node'); graph.nodes.push({ id: `DEPENDENCY:${digest}`, type: 'DEPENDENCY', digest });
  code(() => validateEvidenceGraph(sort(graph)), 'GRAPH_LIMIT');
});

test('G11 graph edges exactly 8192 pass and 8193 fail before expansion', () => {
  const graph = syntheticGraph(1024, 8, 8167);
  assert.equal(graph.edges.length, 8192); validateEvidenceGraph(graph);
  const claim = graph.nodes.filter(row => row.type === 'CLAIM').find(row => graph.edges.filter(edge => edge.from === row.id).length < 1024);
  const targets = new Set(graph.edges.filter(row => row.from === claim.id).map(row => row.to));
  const dep = graph.nodes.find(row => row.type === 'DEPENDENCY' && !targets.has(row.id));
  graph.edges.push({ from: claim.id, type: 'DEPENDS_ON', to: dep.id });
  code(() => validateEvidenceGraph(sort(graph)), 'GRAPH_LIMIT');
});

test('G12 dependencies per claim exactly 1024 pass and 1025 fail', () => {
  const graph = syntheticGraph(1024, 1, 1024); validateEvidenceGraph(graph);
  const digest = H('one extra dependency'), id = `DEPENDENCY:${digest}`;
  graph.nodes.push({ id, type: 'DEPENDENCY', digest });
  graph.edges.push({ from: graph.nodes.find(row => row.type === 'CLAIM').id, type: 'DEPENDS_ON', to: id });
  code(() => validateEvidenceGraph(sort(graph)), 'RESOURCE_LIMIT');
});

test('G13 derivation cannot silently drop or duplicate claims, grants or authorities', () => {
  let input = bundle(); input.claims.pop(); code(() => deriveEvidenceGraph(input), 'INPUT');
  input = bundle(); input.claims.push(clone(input.claims[0])); code(() => deriveEvidenceGraph(input), 'INPUT');
  input = bundle(); input.claims.push({ ...clone(input.claims[0]), envelopeId: 'envelope.extra' }); code(() => deriveEvidenceGraph(input), 'INPUT');
  input = bundle(); input.authority.provenance.push(clone(input.authority.provenance[0])); code(() => deriveEvidenceGraph(input), 'INPUT');
  input = bundle(); input.authority.assessment.grants.push(clone(input.authority.assessment.grants[0])); code(() => deriveEvidenceGraph(input), 'INPUT');
  input = bundle(); input.authority.assessment.slots[0].grantIds = ['grant.missing']; code(() => deriveEvidenceGraph(input), 'INPUT');
  input = bundle(); input.authority.provenance = []; code(() => deriveEvidenceGraph(input), 'INPUT');
});

test('G14 claimed identity, dependency identity and candidate root mismatches reject', () => {
  let input = bundle(); input.claims[0].claim.originCandidate = H('changed claim'); code(() => deriveEvidenceGraph(input), 'EVIDENCE_AUTHORITY');
  input = bundle(); input.authority.assessment.candidateDigest = H('wrong root'); code(() => deriveEvidenceGraph(input), 'CANDIDATE_MISMATCH');
  input = bundle();
  const row = input.claims.find(item => item.claim.dependencies.length), grant = input.authority.assessment.grants.find(item => item.envelopeId === row.envelopeId);
  row.claim.dependencies[0].sha256 = H('changed dependency'); grant.claimDigest = H(row.claim);
  code(() => deriveEvidenceGraph(input), 'STALE_EVIDENCE');
});

test('G15 normalized grant identity omits audit bytes, retains classes and scoped assumptions', () => {
  const input = bundle(), grant = input.authority.assessment.grants[0];
  const normalized = normalizeEvidenceGrant(grant, input.authority.provenance);
  const auditChange = { ...grant, id: 'different.grant', envelopeSha256: H('different bytes'), sourceIds: ['different.source'] };
  assert.deepEqual(normalized, normalizeEvidenceGrant(auditChange, input.authority.provenance));
  assert.deepEqual(Object.keys(normalized).sort(), ['applicability', 'assumptions', 'authorityClasses', 'claimDigest', 'dependencyIds', 'scopeId']);
  assert.notEqual(H(normalized), H(normalizeEvidenceGrant({ ...grant, assumptions: [{ id: 'reviewed', sha256: H('assumption') }] }, input.authority.provenance)));
});

test('G16 noncanonical normative array order rejects instead of silently changing identity', () => {
  const input = bundle(), row = input.claims.find(item => item.claim.dependencies.length > 1);
  row.claim.dependencies.reverse(); code(() => deriveEvidenceGraph(input), 'INPUT');
  code(() => validateEvidenceGraph({ ...ready(), nodes: ready().nodes.toReversed() }), 'INPUT');
});

test('G17 derivation enforces the edge ceiling while expanding verified claim dependencies', () => {
  const input = bundle();
  while (input.candidate.components.length < 1024) {
    const id = `padding.${String(input.candidate.components.length).padStart(4, '0')}`;
    input.candidate.components.push({ id, role: 'SOURCE_MEMBER', byteLength: 1, sha256: H(id) });
  }
  input.candidate.components.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const current = H(input.candidate);
  input.authority.assessment.candidateDigest = current;
  input.authority.assessment.requiredComponents = clone(input.candidate.components);
  for (const row of input.claims) {
    row.claim.originCandidate = current;
    if (row.claim.binding === 'DEPENDENCY_SET') row.claim.dependencies = input.candidate.components.map(({ id: componentId, ...rest }) => ({ componentId, ...rest }));
    const grant = input.authority.assessment.grants.find(item => item.envelopeId === row.envelopeId);
    grant.claimDigest = H(row.claim); grant.dependencyIds = row.claim.dependencies.map(item => item.componentId);
  }
  code(() => deriveEvidenceGraph(input), 'GRAPH_LIMIT');
});

test('G18 arbitrary object property insertion order preserves exact graph and authority bytes', () => {
  const reverseKeys = value => Array.isArray(value) ? value.map(reverseKeys) : value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseKeys(child)])) : value;
  const input = bundle('mo1306-qualified');
  assert.deepEqual(J(deriveEvidenceGraph(reverseKeys(input))), J(deriveEvidenceGraph(input)));
});
