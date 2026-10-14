import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { canonicalBytes, parseCanonical, canonicalDigest, digest } from '../../memoryos-readiness/src/canonical.mjs';
import { validateSchema } from '../../memoryos-readiness/src/schema.mjs';
import * as foundation from '../../memoryos-readiness/src/foundation.mjs';
import { validateRelativeFile } from '../../memoryos-readiness/src/windows-paths.mjs';
import { summaryProjection, textProjection } from '../../memoryos-readiness/src/projections.mjs';

const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/mo1307');
const repo = resolve(fixtureRoot, '../../../..');
const bytes = path => readFileSync(resolve(fixtureRoot, path));
const json = path => JSON.parse(bytes(path));
const cat = json('catalog.json');
const def = name => name.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('');
const hash = value => 'sha256:' + createHash('sha256').update(value).digest('hex');
const bundleNames = readdirSync(resolve(fixtureRoot, 'bundles')).sort();
const bundle = name => {
  const base = 'bundles/' + name + '/';
  return { base, candidate: json(base + 'candidate.json'), configuration: json(base + 'configuration.json'), manifest: json(base + 'manifest.json'), authority: json(base + 'authority.json'), result: json(base + 'expected-result.json'), pins: json(base + 'pins.json') };
};
const throwsCode = (fn, code, label) => assert.throws(fn, e => e.code === code, label);

test('fixture catalog is finite, complete and matches independent exact-byte SHA-256', () => {
  assert.equal(cat.fixtureOnly, true); assert.equal(cat.productionCertification, false);
  assert.equal(cat.entries.length, 485); assert.equal(cat.files.length, 581);
  assert.equal(new Set(cat.entries.map(x => x.id)).size, 485);
  assert.equal(new Set(cat.files.map(x => x.path)).size, 581);
  for (const file of cat.files) {
    const raw = bytes(file.path); assert.equal(raw.length, file.byteLength, file.path); assert.equal(hash(raw), file.sha256, file.path);
  }
  assert.deepEqual([...cat.files].sort((a, b) => a.path < b.path ? -1 : 1), cat.files);
});

test('476 non-parser fixture records match closed schema and local foundation classifications', () => {
  let count = 0;
  for (const row of cat.entries.filter(x => x.layer !== 'PARSER')) {
    const raw = bytes(row.path); const value = parseCanonical(raw); assert.deepEqual(canonicalBytes(value), raw, row.path);
    if (!row.schemaValid) throwsCode(() => validateSchema(def(row.schema), value), 'MO1307_INPUT', row.path);
    else validateSchema(def(row.schema), value);
    if (row.foundationValid) {
      foundation.validateRecord(def(row.schema), value);
      if (row.schema === 'candidate') foundation.validateCandidate(value);
      if (row.schema === 'manifest') foundation.validateManifest(value);
      if (row.schema === 'evidence') foundation.validateEnvelope(value);
      if (row.schema === 'graph') foundation.validateGraphStructure(value);
      if (row.schema === 'result' && !row.layer) foundation.validateResultIdentity(value);
    }
    count++;
  }
  assert.equal(count, 476);
});

test('nine malformed byte/parser vectors reject with exact operational codes', () => {
  const rows = cat.entries.filter(x => x.layer === 'PARSER'); assert.equal(rows.length, 9);
  for (const row of rows) { assert.equal(row.schemaValid, null); throwsCode(() => parseCanonical(bytes(row.path)), row.expectedCode, row.id); }
});

test('focused Phase 1 negative fixtures use the appropriate foundation seam', () => {
  const handlers = {
    'unknown-field': x => foundation.validateCandidate(x),
    'profile-substitution': x => foundation.validateCandidate(x),
    'unknown-profile': x => foundation.validateRecord('Configuration', x),
    'unknown-evidence-version': x => foundation.validateEnvelope(x),
    'duplicate-component-id': x => foundation.validateCandidate(x),
    'unsorted-components': x => foundation.validateCandidate(x),
    'dangling-provider': x => foundation.validateCandidate(x),
    'unsafe-traversal': x => validateRelativeFile(x.candidate),
    'unsafe-device': x => validateRelativeFile(x.candidate),
    'unsafe-backslash': x => validateRelativeFile(x.candidate),
    'qualification-impact': x => foundation.validateRecord('Qualification', x, { code: 'QUALIFICATION_MISMATCH', stage: 'EVALUATION' }),
    'qualification-duplicate-gate': x => foundation.validateRecord('Qualification', x, { code: 'QUALIFICATION_MISMATCH', stage: 'EVALUATION' }),
    'history-pass-rewrite': x => foundation.validateRecord('History', x, { code: 'HISTORY_MISMATCH', stage: 'EVALUATION' }),
    'false-hosted-promotion': x => foundation.validateProviderDetail(x),
    'graph-dangling': x => foundation.validateGraphStructure(x),
    'graph-cycle': x => foundation.validateGraphStructure(x),
    'graph-node-limit': x => foundation.validateGraphStructure(x),
  };
  assert.equal(Object.keys(handlers).length, 17);
  for (const [id, run] of Object.entries(handlers)) {
    const row = cat.entries.find(x => x.path === 'negative/' + id + '.json'); assert.ok(row, id);
    throwsCode(() => run(json(row.path)), row.expectedCode, id);
  }
});

test('all sixteen complete bundles pass snapshot, pin and byte-integrity foundations', () => {
  assert.equal(bundleNames.length, 16);
  for (const name of bundleNames) {
    const b = bundle(name);
    const input = { configurationBytes: bytes(b.base + 'configuration.json'), candidateBytes: bytes(b.base + 'candidate.json'), manifestBytes: bytes(b.base + 'manifest.json'), authorityBytes: bytes(b.base + 'authority.json'),
      files: b.manifest.entries.map(e => ({ id: e.id, bytes: bytes(b.base + e.path) })), expectedCandidateDigest: b.pins.expectedCandidateDigest, trustedAuthorityDigest: b.pins.trustedAuthorityDigest };
    foundation.inspectFoundationInputs(input);
    assert.equal(digest(input.candidateBytes), b.pins.expectedCandidateDigest, name);
    assert.equal(digest(input.authorityBytes), b.pins.trustedAuthorityDigest, name);
    assert.equal(digest(input.manifestBytes), b.authority.manifestSha256, name);
    for (const grant of b.authority.assessment.grants) {
      const entry = b.manifest.entries.find(e => e.id === grant.envelopeId); const envelope = json(b.base + entry.path);
      assert.equal(hash(bytes(b.base + entry.path)), grant.envelopeSha256, grant.id);
      assert.equal(canonicalDigest(envelope.claim), grant.claimDigest, grant.id);
      assert.deepEqual(envelope.sources, grant.sourceIds, grant.id);
      assert.deepEqual(envelope.claim.dependencies.map(x => x.componentId), grant.dependencyIds, grant.id);
      for (const id of grant.sourceIds) assert.equal(b.manifest.entries.find(e => e.id === id)?.type, 'SOURCE', id);
      for (const id of grant.authoritySourceIds) assert.equal(b.manifest.entries.find(e => e.id === id)?.type, 'AUTHORITY_SOURCE', id);
    }
  }
});

test('reference aggregation retains all records and realizes all four readiness states', () => {
  const states = new Set();
  for (const name of bundleNames) {
    const b = bundle(name); const a = b.result.assessment;
    const input = Object.fromEntries(['gates', 'blockers', 'qualifications', 'cneReasons', 'history', 'providers'].map(key => [key, a[key]]));
    const aggregated = foundation.aggregateReference(input);
    assert.equal(aggregated.readiness, b.pins.expectedReadiness, name);
    for (const key of Object.keys(input)) assert.deepEqual(aggregated[key], input[key], name + ':' + key);
    states.add(aggregated.readiness);
  }
  assert.deepEqual([...states].sort(), ['COULD_NOT_EVALUATE', 'NOT_READY', 'READY', 'READY_WITH_QUALIFICATIONS']);
  const mixed = bundle('mixed-precedence').result.assessment;
  assert.ok(mixed.blockers.length && mixed.cneReasons.length && mixed.qualifications.length);
  const recurrent = bundle('history-blocker-unavailable').result.assessment;
  const gate = recurrent.gates.find(x => x.id === 'security');
  assert.equal(gate.state, 'BLOCKED'); assert.equal(gate.cneReasons[0].reason, 'MISSING');
  assert.equal(recurrent.blockers[0].reasonCode, 'CONDITION_UNSATISFIED');
  assert.equal(bundle('informational-ready').result.assessment.qualifications[0].impact, 'INFORMATIONAL');
});

test('canonical result identities and summaries match exact independently constructed fixture bytes', () => {
  for (const name of bundleNames) {
    const b = bundle(name); foundation.validateResultIdentity(b.result);
    assert.equal(b.result.readinessDigest, b.pins.expectedReadinessDigest);
    assert.equal(b.result.proofBindingDigest, b.pins.expectedProofBindingDigest);
    assert.deepEqual(summaryProjection(b.result), bytes(b.base + 'expected-summary.json'), name);
    const text = textProjection(b.result).toString('utf8');
    for (const q of b.result.assessment.qualifications) assert.ok(text.includes('qualification=' + q.id + ' reason=' + q.reasonCode));
    for (const h of b.result.assessment.history) assert.ok(text.includes('history=' + h.id + ' outcome=' + h.originalOutcome));
    assert.ok(text.endsWith('humanAction=DECIDE_RELEASE\n'));
  }
});

test('all fourteen evidence types and six graph node / five edge types have canonical positives', () => {
  const evidence = cat.entries.filter(x => x.path.startsWith('positive/evidence-')).map(x => json(x.path));
  assert.equal(new Set(evidence.map(x => x.claim.type)).size, 14);
  const b = bundle('ready'); const graph = b.result.assessment.graph;
  assert.deepEqual([...new Set(graph.nodes.map(x => x.type))].sort(), ['ASSESSMENT', 'AUTHORITY', 'CANDIDATE', 'CLAIM', 'DEPENDENCY', 'GRANT']);
  assert.deepEqual([...new Set(graph.edges.map(x => x.type))].sort(), ['ACCEPTS', 'ASSESSES', 'AUTHORIZES', 'DEPENDS_ON', 'ROOTED_IN']);
  for (const e of b.manifest.entries.filter(x => x.type === 'ENVELOPE')) {
    const claimDigest = canonicalDigest(json(b.base + e.path).claim);
    assert.ok(graph.nodes.some(n => n.id === 'CLAIM:' + claimDigest && n.digest === claimDigest));
  }
  assert.equal(new Set(cat.entries.filter(x => x.schema === 'qualification' && x.path.startsWith('positive/')).map(x => json(x.path).reasonCode)).size, 7);
});

test('MO-1306 preserves actual production, BF, tag, package and all nineteen source history rows', () => {
  const b = bundle('mo1306-qualified'); const map = json(b.base + 'predecessor-map.json');
  assert.equal(map.production, '701d48ee2012675966360dda775ab13013c09ab9');
  assert.equal(map.methodology, '85a0f85c1ebd013c545ccf2b3efe58a760e6cf37');
  assert.equal(map.scope, '6e562c578f86022ee28911f7b91a8b3aa209da17');
  assert.equal(map.immutableInventory, 'f8e19fc5427cf3acfe60d5e2717dc87d0c74e04a');
  assert.equal(b.candidate.expectedTag.target, '332ab0d2c35643ea8d155bcbea9c5019b304bbe3');
  assert.equal(b.candidate.source.tree, '4e3340465fb2d3590c46207c8d2c2829937b8e57');
  assert.equal(map.tagObject, '9dd37b7757314b8cecbfc018ff7cdd8c2aa0cab8');
  assert.equal(b.candidate.components.find(x => x.role === 'ARCHIVE').sha256, 'sha256:7649f6df77c3f6163eb94b343974abaeccebbd5bcb8a2208cc889128904ce45d');
  assert.equal(b.candidate.components.find(x => x.role === 'SBOM').sha256, 'sha256:b0b68e37e1b29da4e1e7127c09d5b692f35d87ad024a73a4bb52a44fd761902e');
  assert.equal(b.candidate.components.find(x => x.role === 'PROVENANCE').sha256, 'sha256:f9f5ac2b9c3ac91c761c97426e8f7130c3786ecc988d31f72d56528509199759');
  assert.equal(map.componentMap.filter(x => x.role === 'SOURCE_MEMBER').length, 94);
  for (const source of map.sources.filter(x => x.originalPath !== null)) assert.deepEqual(bytes(b.base + source.path), readFileSync(resolve(repo, source.originalPath)), source.id);
  const raw = json(b.base + 'sources/released.history.data');
  assert.equal(raw.records.length, 19); assert.equal(b.result.assessment.history.length, 12);
  for (const row of raw.records) {
    assert.ok(b.manifest.entries.some(e => e.id === 'history-source.' + row.id));
    const normalized = b.result.assessment.history.find(x => x.id === 'history.' + row.id);
    if (row.historicalFailureOrUnclosedGate) { assert.ok(normalized); assert.equal(normalized.originalDisposition, row.disposition); assert.notEqual(normalized.originalOutcome, 'PASS'); }
    else assert.equal(normalized, undefined);
  }
  assert.equal(b.result.assessment.history.find(x => x.id === 'history.native-publication').originalDisposition, 'FAIL / UNRESOLVED');
  assert.equal(b.result.assessment.history.find(x => x.id === 'history.hosted-36357568243').originalDisposition, 'FAILURE / HOSTED_BOOTSTRAP_UNRESOLVED');
  assert.equal(b.result.assessment.history.find(x => x.id === 'history.diagnostic-36396330199').originalDisposition, 'FAILURE / STILL_UNRESOLVED / HOSTED_DIAGNOSTIC_EXHAUSTED');
});

test('MO-1306 provider limitations and ten disclosures cannot silently become hosted certification', () => {
  const a = bundle('mo1306-qualified').result.assessment; const by = id => a.providers.find(x => x.provider === id);
  assert.equal(a.readiness, 'READY_WITH_QUALIFICATIONS'); assert.equal(a.qualifications.length, 10);
  assert.equal(by('generic').validation, 'REAL_EXECUTION_CERTIFIED'); assert.equal(by('generic').execution, 'REAL_EXECUTION_CERTIFIED');
  assert.equal(by('github').validation, 'OFFLINE_VALIDATED'); assert.equal(by('github').execution, 'HOSTED_EXECUTION_NOT_CERTIFIED');
  assert.equal(by('github').sourceExecutionLabel, 'NOT_CERTIFIED'); assert.equal(by('github').support, 'SUPPORTED_WITH_HOSTED_CERTIFICATION_LIMITATION');
  assert.deepEqual(by('github').hostedCases, { cne: false, fail: false, parity: false, pass: false });
  for (const id of ['azure', 'gitlab', 'jenkins']) { assert.equal(by(id).validation, 'CONTRACT_VALIDATED'); assert.equal(by(id).execution, 'NOT_LIVE_PROVIDER_CERTIFIED'); assert.equal(by(id).support, 'SUPPORTED_WITH_CONTRACT_VALIDATION_ONLY'); }
  assert.equal(a.qualifications.filter(x => x.reasonCode === 'HISTORICAL_UNRESOLVED_PRESERVED').length, 5);
  for (const gate of a.gates.filter(x => /\.(hosted|live)$/.test(x.id))) assert.equal(gate.state, 'NOT_REQUIRED');
});

test('metadata-only proof changes and selective dependency reuse keep separate identities', () => {
  const base = bundle('ready'); const metadata = bundle('metadata-only'); const reused = bundle('selective-reuse');
  assert.equal(base.result.readinessDigest, metadata.result.readinessDigest); assert.notEqual(base.result.proofBindingDigest, metadata.result.proofBindingDigest);
  assert.notEqual(base.pins.trustedAuthorityDigest, metadata.pins.trustedAuthorityDigest);
  assert.notEqual(base.pins.expectedCandidateDigest, reused.pins.expectedCandidateDigest);
  const first = json(base.base + 'envelopes/security.json').claim; const second = json(reused.base + 'envelopes/security.json').claim;
  assert.deepEqual(first.dependencies, second.dependencies); assert.equal(second.originCandidate, base.pins.expectedCandidateDigest);
  assert.equal(reused.authority.assessment.grants.find(x => x.id === 'grant.security').applicability, 'REUSED');
  assert.equal(second.binding, 'DEPENDENCY_SET');
  const decision = json('human/ready-approve.json');
  throwsCode(() => foundation.checkDecisionBinding(decision, metadata.result), 'MO1307_DECISION_MISMATCH');
});

test('human decision bindings leave all readiness and proof bytes unchanged', () => {
  const rows = cat.entries.filter(x => x.path.startsWith('human/')); assert.equal(rows.length, 12);
  for (const row of rows) {
    const b = bundle(row.verificationBundle); const before = canonicalBytes(b.result); const projection = foundation.checkDecisionBinding(json(row.path), b.result);
    assert.equal(projection.consistency, row.expectedConsistency, row.path); assert.equal(projection.authenticity, 'NOT_VERIFIED_BY_MEMORYOS');
    assert.deepEqual(canonicalBytes(b.result), before);
  }
  for (const id of ['human-proof-mismatch', 'human-candidate-mismatch', 'human-readiness-mismatch']) throwsCode(() => foundation.checkDecisionBinding(json('negative/' + id + '.json'), bundle('ready').result), 'MO1307_DECISION_MISMATCH', id);
});

test('tag fixtures distinguish pre/post stage predicates from operational tampering', () => {
  for (const [name, checks] of [['pre-tag-present', ['TAG_PRESENCE']], ['post-tag-absent', ['TAG_PRESENCE']], ['post-tag-wrong-target', ['TAG_TARGET']], ['post-tag-lightweight', ['TAG_ANNOTATION']]]) {
    const b = bundle(name); assert.equal(b.result.assessment.readiness, 'NOT_READY');
    assert.deepEqual(b.result.assessment.blockers.map(x => x.checkCode).sort(), checks);
    assert.ok(b.result.assessment.blockers.every(x => x.reasonCode === 'TAG_CONDITION_UNMET'));
  }
  const actual = bundle('mo1306-qualified');
  assert.equal(actual.result.assessment.stage, 'POST_TAG_VERIFICATION');
  assert.equal(json(actual.base + 'envelopes/tag.json').claim.detail.object, '9dd37b7757314b8cecbfc018ff7cdd8c2aa0cab8');
  assert.equal(actual.result.assessment.gates.find(x => x.id === 'tag').state, 'SATISFIED');
});

test('future semantic negatives are classified without claiming a Phase 2 verifier exists', () => {
  const rows = cat.entries.filter(x => x.layer === 'PHASE2'); assert.ok(rows.length >= 12);
  for (const row of rows) { assert.equal(row.schemaValid, true); assert.equal(row.foundationValid, true); assert.ok(bundleNames.includes(row.verificationBundle)); }
  const b = bundle('ready');
  assert.notEqual(canonicalDigest(json('negative/candidate-substitution.json')), b.pins.expectedCandidateDigest);
  assert.notEqual(canonicalDigest(json('negative/forged-authority.json')), b.pins.trustedAuthorityDigest);
  const old = bundle('mo1306-qualified').authority.assessment.grants.find(x => x.id === 'grant.history');
  assert.notEqual(canonicalDigest(json('negative/history-omission.json').claim), old.claimDigest);
  assert.notEqual(json('negative/wrong-proof-digest.json').proofBindingDigest, b.result.proofBindingDigest);
  // Self-consistent hashes are deliberately insufficient: a later independently
  // recomputed evaluation must reject this false result, despite this check passing.
  const selfHashed = json('negative/self-hashed-false-result.json'); foundation.validateResultIdentity(selfHashed);
  assert.notEqual(selfHashed.assessment.readiness, b.result.assessment.readiness);
  const recipes = json('scenarios/acquisition.json'); assert.equal(recipes.scenarios.length, 10);
  assert.ok(recipes.scenarios.every(x => /^PHASE2/.test(x.phase)));
});
