// Phase 2A semantic conformance over explicitly assumed verified projections.
// This is not public API, raw evidence verification, installed certification,
// dependency reuse authentication, filesystem acquisition or characterization.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canonicalBytes, canonicalDigest, readinessDigest, proofBindingDigest, blockerId } from '../../memoryos-readiness/src/canonical.mjs';
import { DEFINITIONS } from '../../memoryos-readiness/src/constants.mjs';
import { validateResultIdentity, checkDecisionBinding } from '../../memoryos-readiness/src/foundation.mjs';
import { computeReadiness, compareReadinessResult } from '../../memoryos-readiness/src/readiness-core.mjs';
import { projectReadinessResult } from '../../memoryos-readiness/src/readiness-result.mjs';
import { bundleNames, clone, loadProjection, fixtureBytes, fixtureJSON, selected, editClaim, setCoverage, makeUnavailable, addInformational } from '../tools/mo1307-phase2a/fixture-projection.mjs';

const gate = (result, id) => result.assessment.gates.find(row => row.id === id);
const run = verified => {
  const output = computeReadiness(verified);
  return { ...output, jsonSummary: projectReadinessResult(output.result, 'json'), text: projectReadinessResult(output.result, 'text') };
};
const throwsCode = (fn, code) => assert.throws(fn, error => error.code === 'MO1307_' + code);
const bytes = value => Buffer.from(value);
const text = value => typeof value === 'string' ? value : bytes(value).toString('utf8');
const thaw = name => loadProjection(name).verified;
const mandatory = ['artifact', 'binding', 'history', 'provenance', 'provider.azure', 'provider.generic', 'provider.github', 'provider.gitlab', 'provider.jenkins', 'resources', 'sbom', 'scope', 'security', 'semantic', 'supply', 'tag', 'windows'];

for (const name of bundleNames) test(`A01 exact independent Phase 1 result and summary bytes: ${name}`, () => {
  const fixture = loadProjection(name), before = clone(fixture.verified);
  const output = run(fixture.verified);
  assert.deepEqual(output.result, fixture.expected);
  assert.deepEqual(bytes(output.resultBytes), fixture.expectedBytes);
  assert.deepEqual(bytes(output.jsonSummary), fixture.summaryBytes);
  assert.equal(output.readinessDigest, fixture.pins.expectedReadinessDigest);
  assert.equal(output.proofBindingDigest, fixture.pins.expectedProofBindingDigest);
  assert.equal(output.exitCode, fixture.pins.expectedExit);
  assert.deepEqual(fixture.verified, before);
  validateResultIdentity(output.result);
  assert.deepEqual(canonicalBytes(output.result), bytes(output.resultBytes));
  assert.ok(text(output.text).endsWith('humanAction=REVIEW_READINESS_AND_LIMITATIONS\nhumanAction=DECIDE_RELEASE\n'));
  assert.equal(output.result.assessment.gates.length, 22);
});

test('A02 core consumes claims rather than caller gate states and retains complete compiled profile', () => {
  const verified = thaw('ready');
  assert.equal('gates' in verified, false); assert.equal('readiness' in verified, false);
  const result = run(verified).result;
  assert.deepEqual(result.assessment.gates.map(row => row.id), DEFINITIONS.gateDefinitions.map(row => row.id));
  assert.equal(gate(result, 'rest.contract').state, 'NOT_APPLICABLE');
  for (const id of ['provider.azure.live', 'provider.github.hosted', 'provider.gitlab.live', 'provider.jenkins.live']) {
    const child = gate(result, id), parent = gate(result, id.replace(/\.(live|hosted)$/, ''));
    assert.equal(child.state, 'NOT_REQUIRED'); assert.equal(child.mandatory, false);
    assert.equal(child.claimDigest, parent.claimDigest); assert.equal(child.grantDigest, parent.grantDigest);
  }
  const rest = run(thaw('rest-qualified')).result;
  assert.equal(gate(rest, 'rest.contract').state, 'SATISFIED_WITH_QUALIFICATION');
  assert.deepEqual(rest.assessment.providers, []);
  for (const row of rest.assessment.gates.filter(item => item.id.startsWith('provider.'))) {
    assert.equal(row.state, 'NOT_APPLICABLE'); assert.equal(row.claimDigest, null);
    assert.deepEqual(row.qualificationIds, []); assert.deepEqual(row.blockerIds, []);
  }
});

for (const gateId of mandatory) test(`A03 coverage FAIL and UNEVALUABLE drive mandatory ${gateId}`, () => {
  const verified = thaw('ready'), coverage = [...selected(verified, gateId).claim.passed];
  setCoverage(verified, gateId, { failed: coverage });
  let output = run(verified), current = gate(output.result, gateId);
  assert.equal(output.result.assessment.readiness, 'NOT_READY'); assert.equal(current.state, 'BLOCKED');
  assert.deepEqual(output.result.assessment.blockers.map(row => row.checkCode).sort(), coverage.sort());
  assert.ok(output.result.assessment.blockers.every(row => row.reasonCode === 'CHECK_FAILED'));
  setCoverage(verified, gateId, { unevaluable: coverage });
  output = run(verified); current = gate(output.result, gateId);
  assert.equal(output.result.assessment.readiness, 'COULD_NOT_EVALUATE'); assert.equal(current.state, 'COULD_NOT_EVALUATE');
  assert.deepEqual(output.result.assessment.cneReasons.map(row => row.checkCode).sort(), coverage.sort());
  assert.equal(output.result.assessment.blockers.length, 0);
});

test('A04 REST coverage failures retain same-host limitation', () => {
  const verified = thaw('rest-qualified');
  setCoverage(verified, 'rest.contract', { failed: ['OPENAPI'], unevaluable: ['TLS_AUTH'] });
  const result = run(verified).result;
  assert.equal(result.assessment.readiness, 'NOT_READY');
  assert.equal(gate(result, 'rest.contract').state, 'BLOCKED');
  assert.equal(result.assessment.qualifications[0].reasonCode, 'SAME_HOST_REMOTE_ONLY');
  assert.equal(result.assessment.cneReasons[0].checkCode, 'TLS_AUTH');
});

for (const reason of ['MISSING', 'AUTHORITY_UNAVAILABLE', 'STALE', 'UNEVALUABLE']) test(`A05 unavailable ${reason} is CNE with exact reason`, () => {
  const verified = thaw('ready'); makeUnavailable(verified, 'security', reason);
  const result = run(verified).result, current = gate(result, 'security');
  assert.equal(result.assessment.readiness, 'COULD_NOT_EVALUATE');
  assert.equal(current.state, 'COULD_NOT_EVALUATE'); assert.equal(current.claimDigest, null); assert.equal(current.grantDigest, null);
  assert.deepEqual(current.cneReasons, [{ gateId: 'security', reason, checkCode: null }]);
});

test('A06 unavailable provider leaves optional observation empty without fabricating certification', () => {
  const verified = thaw('ready'); makeUnavailable(verified, 'provider.github', 'AUTHORITY_UNAVAILABLE');
  const result = run(verified).result, child = gate(result, 'provider.github.hosted');
  assert.equal(gate(result, 'provider.github').state, 'COULD_NOT_EVALUATE');
  assert.equal(child.state, 'NOT_REQUIRED'); assert.equal(child.claimDigest, null); assert.equal(child.grantDigest, null);
  assert.deepEqual(child.cneReasons, []); assert.deepEqual(child.blockerIds, []);
  assert.ok(result.assessment.providers.every(row => row.provider !== 'github'));
});

test('A07 blockers dominate independent CNE and qualifications without erasing any finding', () => {
  const verified = thaw('qualified');
  setCoverage(verified, 'security', { failed: ['FILESYSTEM', 'NETWORK'], unevaluable: ['PROCESS'] });
  makeUnavailable(verified, 'resources', 'STALE');
  const result = run(verified).result;
  assert.equal(result.assessment.readiness, 'NOT_READY'); assert.equal(result.assessment.blockers.length, 2);
  assert.equal(result.assessment.cneReasons.length, 2); assert.equal(result.assessment.qualifications.length, 5);
  assert.equal(gate(result, 'security').state, 'BLOCKED');
  assert.equal(gate(result, 'resources').state, 'COULD_NOT_EVALUATE');
  for (const row of result.assessment.blockers) assert.equal(row.id, blockerId(row));
});

test('A08 CNE dominates release qualification and informational-only stays READY', () => {
  const verified = thaw('qualified'); makeUnavailable(verified, 'security');
  const result = run(verified).result;
  assert.equal(result.assessment.readiness, 'COULD_NOT_EVALUATE'); assert.equal(result.assessment.qualifications.length, 5);
  const info = run(thaw('informational-ready')).result;
  assert.equal(info.assessment.readiness, 'READY'); assert.equal(info.assessment.qualifications.length, 1);
  assert.equal(gate(info, 'windows').state, 'SATISFIED');
});

test('A09 known provider minimum failures remain blockers, including simultaneous coverage and CNE', () => {
  for (const provider of ['azure', 'generic', 'github', 'gitlab', 'jenkins']) {
    const verified = thaw('ready'), id = 'provider.' + provider;
    editClaim(verified, id, claim => {
      claim.detail.implementation = 'NOT_IMPLEMENTED'; claim.detail.validation = 'NOT_VALIDATED';
      claim.detail.execution = 'NOT_CERTIFIED'; claim.detail.sourceExecutionLabel = 'NOT_CERTIFIED';
      claim.detail.support = 'UNSUPPORTED'; claim.detail.hostedCases = null;
    });
    setCoverage(verified, id, { failed: ['IMPLEMENTATION'], unevaluable: ['OFFLINE_CONTRACT'] });
    const result = run(verified).result, rows = result.assessment.blockers.filter(row => row.gateId === id);
    assert.equal(result.assessment.readiness, 'NOT_READY', provider);
    assert.equal(rows.filter(row => row.checkCode === 'IMPLEMENTATION').length, 1);
    assert.ok(rows.every(row => row.reasonCode === 'PROVIDER_MINIMUM_UNMET'));
    assert.deepEqual(rows.map(row => row.checkCode).sort(), provider === 'github' ? ['IMPLEMENTATION', 'OFFLINE_CONTRACT', 'SUPPORT_DISPOSITION'] : ['EXECUTION_SCOPE', 'IMPLEMENTATION', 'OFFLINE_CONTRACT', 'SUPPORT_DISPOSITION']);
    assert.equal(gate(result, id).cneReasons[0].checkCode, 'OFFLINE_CONTRACT');
    for (const child of result.assessment.gates.filter(row => row.id.startsWith(id + '.'))) assert.equal(child.state, 'NOT_REQUIRED');
  }
});

test('A10 Generic real execution requirement is independent of coverage verdict', () => {
  const verified = thaw('ready');
  editClaim(verified, 'provider.generic', claim => { claim.detail.execution = 'NOT_CERTIFIED'; claim.detail.sourceExecutionLabel = 'NOT_CERTIFIED'; });
  const result = run(verified).result;
  assert.equal(result.assessment.readiness, 'NOT_READY');
  assert.ok(result.assessment.blockers.some(row => row.checkCode === 'EXECUTION_SCOPE' && row.reasonCode === 'PROVIDER_MINIMUM_UNMET'));
});

test('A11 false hosted promotion and required provider disclosure omission are rejected', () => {
  const promoted = thaw('qualified');
  editClaim(promoted, 'provider.github', claim => { claim.detail.execution = 'HOSTED_EXECUTION_CERTIFIED'; claim.detail.sourceExecutionLabel = 'HOSTED_EXECUTION_CERTIFIED'; claim.detail.support = 'SUPPORTED'; claim.qualifications = []; });
  throwsCode(() => run(promoted), 'QUALIFICATION_MISMATCH');
  const omitted = thaw('qualified'); editClaim(omitted, 'provider.github', claim => { claim.qualifications = []; });
  throwsCode(() => run(omitted), 'QUALIFICATION_MISMATCH');
});

test('A12 scope qualification union rejects missing, extra, weakened and conflicting records', () => {
  for (const change of [claim => claim.detail.qualificationIds.pop(), claim => claim.detail.qualificationIds.push('q.unknown')]) {
    const verified = thaw('qualified'); editClaim(verified, 'scope', change); throwsCode(() => run(verified), 'QUALIFICATION_MISMATCH');
  }
  const weakened = thaw('qualified'); editClaim(weakened, 'supply', claim => { claim.qualifications[0].impact = 'INFORMATIONAL'; });
  throwsCode(() => run(weakened), 'QUALIFICATION_MISMATCH');
  const conflict = thaw('informational-ready');
  const duplicate = clone(selected(conflict, 'windows').claim.qualifications[0]); duplicate.gateIds = ['security'];
  editClaim(conflict, 'security', claim => claim.qualifications.push(duplicate));
  throwsCode(() => run(conflict), 'QUALIFICATION_MISMATCH');
});

test('A13 identical qualification carriers share one result with every claim and grant reference', () => {
  const verified = thaw('informational-ready'), same = clone(selected(verified, 'windows').claim.qualifications[0]);
  editClaim(verified, 'security', claim => claim.qualifications.push(same));
  const result = run(verified).result, qualification = result.assessment.qualifications[0];
  assert.equal(result.assessment.qualifications.length, 1); assert.equal(qualification.evidenceClaimDigests.length, 2); assert.equal(qualification.grantDigests.length, 2);
  assert.equal(result.assessment.readiness, 'READY');
});

test('A14 missing scope or history retains known records and defers only completeness', () => {
  const scope = thaw('qualified'); makeUnavailable(scope, 'scope');
  const a = run(scope).result.assessment;
  assert.equal(a.readiness, 'COULD_NOT_EVALUATE'); assert.equal(a.qualifications.length, 5);
  const history = thaw('mo1306-qualified'); makeUnavailable(history, 'history');
  const b = run(history).result.assessment;
  assert.equal(b.readiness, 'COULD_NOT_EVALUATE'); assert.equal(b.history.length, 0);
  assert.ok(b.qualifications.length >= 5);
});

test('A15 preserved history remains negative; observed recurrence blocks active mandatory gates', () => {
  const verified = thaw('mo1306-qualified');
  editClaim(verified, 'history', claim => { claim.detail.records.find(row => row.id === 'history.native-publication').recurrence = 'OBSERVED'; });
  makeUnavailable(verified, 'windows', 'MISSING');
  const result = run(verified).result, current = gate(result, 'windows');
  assert.equal(result.assessment.readiness, 'NOT_READY'); assert.equal(current.state, 'BLOCKED');
  assert.equal(current.cneReasons[0].reason, 'MISSING');
  const blocker = result.assessment.blockers.find(row => row.gateId === 'windows');
  assert.equal(blocker.reasonCode, 'CONDITION_UNSATISFIED'); assert.equal(blocker.checkCode, 'HISTORICAL_CONDITION');
  assert.equal(blocker.claimDigest, selected(verified, 'history').claimDigest);
  assert.equal(blocker.grantDigest, selected(verified, 'history').grantDigest);
  assert.equal(result.assessment.history.find(row => row.id === 'history.native-publication').originalDisposition, 'FAIL / UNRESOLVED');
  assert.equal(result.assessment.qualifications.length, 10);
});

test('A16 currently applicable history and duplicate recurrence produce one exact blocker', () => {
  const verified = thaw('history-blocker-unavailable');
  const result = run(verified).result;
  assert.equal(result.assessment.blockers.length, 1);
  assert.equal(result.assessment.blockers[0].conditionId, 'condition.recurrence');
  assert.equal(result.assessment.history[0].originalOutcome, 'FAIL');
  assert.equal(result.assessment.history[0].disposition, 'CURRENT_APPLICABLE');
});

test('A17 all applicable tag predicates are collected; absent post-tag fabricates no target failure', () => {
  const verified = thaw('post-tag-ready');
  editClaim(verified, 'tag', claim => { claim.detail.name = 'wrong-name'; claim.detail.annotated = false; claim.detail.peeledTarget = '9'.repeat(40); });
  let result = run(verified).result;
  assert.deepEqual(result.assessment.blockers.map(row => row.checkCode).sort(), ['TAG_ANNOTATION', 'TAG_NAME', 'TAG_TARGET']);
  assert.ok(result.assessment.blockers.every(row => row.reasonCode === 'TAG_CONDITION_UNMET'));
  const absent = thaw('post-tag-absent'); result = run(absent).result;
  assert.deepEqual(result.assessment.blockers.map(row => row.checkCode), ['TAG_PRESENCE']);
  const pre = thaw('pre-tag-present'); editClaim(pre, 'tag', claim => { claim.detail.name = 'wrong-name'; claim.detail.annotated = false; claim.detail.peeledTarget = '9'.repeat(40); });
  result = run(pre).result;
  assert.deepEqual(result.assessment.blockers.map(row => row.checkCode).sort(), ['TAG_NAME', 'TAG_PRESENCE']);
});

test('A18 expected negative Policy and operational outcomes remain accepted semantic certification', () => {
  const source = fixtureJSON('bundles/ready/sources/fixture.source.data');
  assert.deepEqual(source.semanticVectors, ['PASS', 'FAIL', 'CNE', 'INPUT_ERROR/11']);
  const result = run(thaw('ready')).result;
  assert.equal(gate(result, 'semantic').state, 'SATISFIED'); assert.equal(result.assessment.readiness, 'READY');
});

test('A19 metadata-only proof change preserves readiness and invalidates old external decision', () => {
  const before = run(thaw('ready')), after = run(thaw('metadata-only'));
  assert.equal(before.readinessDigest, after.readinessDigest); assert.notEqual(before.proofBindingDigest, after.proofBindingDigest);
  throwsCode(() => checkDecisionBinding(fixtureJSON('human/ready-approve.json'), after.result), 'DECISION_MISMATCH');
  const reused = run(thaw('selective-reuse'));
  assert.notEqual(reused.result.assessment.candidateDigest, before.result.assessment.candidateDigest);
  assert.equal(reused.result.assessment.readiness, 'READY');
});

test('A20 nonsemantic input collection order and repeated calls preserve exact result bytes', () => {
  const fixture = loadProjection('mo1306-qualified'), verified = fixture.verified;
  verified.slots.reverse(); verified.claims.reverse();
  const once = run(verified), twice = run(verified);
  assert.deepEqual(bytes(once.resultBytes), fixture.expectedBytes); assert.deepEqual(bytes(twice.resultBytes), fixture.expectedBytes);
  once.result.assessment.gates[0].state = 'BLOCKED'; once.resultBytes[0] = 0;
  assert.deepEqual(bytes(run(verified).resultBytes), fixture.expectedBytes);
});

test('A21 new metadata proof is distinct from normative changed qualification identity', () => {
  const verified = thaw('ready'), before = run(verified);
  addInformational(verified, 'security'); const after = run(verified);
  assert.equal(after.result.assessment.readiness, 'READY');
  assert.notEqual(after.readinessDigest, before.readinessDigest); assert.notEqual(after.proofBindingDigest, before.proofBindingDigest);
});

test('A22 exact comparison rejects existing altered and self-hashed false result fixtures', () => {
  for (const [fixture, base] of [['self-hashed-false-result', 'ready'], ['wrong-proof-digest', 'ready'], ['blocker-suppression', 'not-ready']]) {
    throwsCode(() => compareReadinessResult(thaw(base), fixtureBytes('negative/' + fixture + '.json')), 'RESULT_MISMATCH');
  }
  for (const name of ['ready', 'qualified', 'not-ready', 'could-not-evaluate']) {
    const fixture = loadProjection(name);
    compareReadinessResult(fixture.verified, fixture.expectedBytes);
  }
});

test('A23 result recomputation rejects self-consistent alterations of each normative projection', () => {
  const fixture = loadProjection('mo1306-qualified');
  const mutations = [
    result => { result.assessment.readiness = 'READY'; },
    result => { result.assessment.gates.find(row => row.id === 'provider.github').state = 'SATISFIED'; },
    result => { result.assessment.qualifications.pop(); },
    result => { result.assessment.history[0].originalDisposition = 'REWRITTEN'; },
    result => { result.assessment.providers.find(row => row.provider === 'github').sourceExecutionLabel = 'HOSTED_EXECUTION_CERTIFIED'; },
    result => { result.assessment.graph.edges.pop(); result.assessment.graphDigest = canonicalDigest(result.assessment.graph); },
  ];
  for (const mutate of mutations) {
    const changed = clone(fixture.expected); mutate(changed);
    changed.readinessDigest = readinessDigest(changed.assessment); changed.proofBindingDigest = proofBindingDigest(changed.readinessDigest, changed.audit);
    throwsCode(() => compareReadinessResult(fixture.verified, canonicalBytes(changed)), 'RESULT_MISMATCH');
  }
});

test('A24 V18 retains exact five providers, ten disclosures, twelve negative history rows and human actions', () => {
  const output = run(thaw('mo1306-qualified')), a = output.result.assessment;
  assert.equal(a.readiness, 'READY_WITH_QUALIFICATIONS'); assert.equal(output.exitCode, 2);
  assert.equal(a.qualifications.length, 10); assert.equal(a.history.length, 12); assert.equal(a.providers.length, 5);
  assert.equal(a.qualifications.filter(row => row.reasonCode === 'HISTORICAL_UNRESOLVED_PRESERVED').length, 5);
  const github = a.providers.find(row => row.provider === 'github');
  assert.equal(github.execution, 'HOSTED_EXECUTION_NOT_CERTIFIED'); assert.equal(github.sourceExecutionLabel, 'NOT_CERTIFIED');
  assert.deepEqual(github.hostedCases, { cne: false, fail: false, parity: false, pass: false });
  assert.equal(a.history.find(row => row.id === 'history.hosted-36357568243').originalDisposition, 'FAILURE / HOSTED_BOOTSTRAP_UNRESOLVED');
  assert.equal(a.history.find(row => row.id === 'history.diagnostic-36396330199').originalDisposition, 'FAILURE / STILL_UNRESOLVED / HOSTED_DIAGNOSTIC_EXHAUSTED');
  assert.equal(a.history.find(row => row.id === 'history.native-publication').originalDisposition, 'FAIL / UNRESOLVED');
  const rendered = text(output.text);
  for (const row of a.qualifications) assert.ok(rendered.includes(`qualification=${row.id} reason=${row.reasonCode} `));
  for (const row of a.history) assert.ok(rendered.includes(`history=${row.id} outcome=${row.originalOutcome} `));
  assert.deepEqual(a.requiredHumanActions, ['REVIEW_READINESS_AND_LIMITATIONS', 'DECIDE_RELEASE']);
});

function populateHistory(verified, count, active = false) {
  const rows = Array.from({ length: count }, (_, index) => {
    const suffix = String(index).padStart(3, '0');
    return { id: 'history.boundary.' + suffix, originalOutcome: 'FAIL', originalDisposition: 'FAIL / PRESERVED', sourceIds: ['fixture.source'], conditionId: 'condition.boundary.' + suffix, disposition: active ? 'CURRENT_APPLICABLE' : 'SUPERSEDED', affectedGateIds: active ? ['security'] : [], authoritySourceIds: ['authority.fixture'], recurrence: active ? 'OBSERVED' : 'NOT_APPLICABLE' };
  });
  editClaim(verified, 'history', claim => { claim.detail.records = rows; });
  if (count <= 128) editClaim(verified, 'scope', claim => { claim.detail.conditionIds = rows.map(row => row.conditionId); });
  else makeUnavailable(verified, 'scope');
}

function populateQualifications(verified, count) {
  const rows = Array.from({ length: count }, (_, index) => ({ id: 'q.boundary.' + String(index).padStart(3, '0'), type: 'MemoryOSReadinessQualification', version: '1.0.0', gateIds: ['security'], provider: null, scopeId: verified.scopeId, reasonCode: 'ENVIRONMENT_LIMITATION', impact: 'INFORMATIONAL', disclosureCode: 'ENVIRONMENT_LIMITATION', conditionIds: [] }));
  // Split across individually bounded claims to exercise the global union cap.
  editClaim(verified, 'security', claim => { claim.qualifications = rows.slice(0, 64); });
  editClaim(verified, 'windows', claim => { claim.qualifications = rows.slice(64); });
  if (count <= 128) editClaim(verified, 'scope', claim => { claim.detail.qualificationIds = rows.map(row => row.id); });
  else makeUnavailable(verified, 'scope');
}

test('A25 history count 128 is retained exactly and 129 is a resource error', () => {
  const admitted = thaw('ready'); populateHistory(admitted, 128);
  const result = run(admitted).result;
  assert.equal(result.assessment.history.length, 128); assert.equal(result.assessment.readiness, 'READY');
  assert.ok(result.assessment.history.every(row => row.originalOutcome === 'FAIL'));
  const excessive = thaw('ready'); populateHistory(excessive, 129);
  throwsCode(() => run(excessive), 'RESOURCE_LIMIT');
});

test('A26 global qualification union 128 is complete and 129 cannot be truncated', () => {
  const admitted = thaw('ready'); populateQualifications(admitted, 128);
  const output = run(admitted);
  assert.equal(output.result.assessment.qualifications.length, 128); assert.equal(output.result.assessment.readiness, 'READY');
  assert.equal(text(output.text).split('\n').filter(line => line.startsWith('qualification=')).length, 128);
  const excessive = thaw('ready'); populateQualifications(excessive, 129);
  throwsCode(() => run(excessive), 'RESOURCE_LIMIT');
});

test('A27 128 unique historical blockers are complete and one additional known failure rejects', () => {
  const admitted = thaw('ready'); populateHistory(admitted, 128, true);
  const output = run(admitted);
  assert.equal(output.result.assessment.readiness, 'NOT_READY'); assert.equal(output.result.assessment.blockers.length, 128);
  assert.equal(gate(output.result, 'security').blockerIds.length, 128);
  assert.equal(text(output.text).split('\n').filter(line => line.startsWith('blocker=')).length, 128);
  setCoverage(admitted, 'artifact', { failed: ['ARCHIVE_MEMBERS'] });
  throwsCode(() => run(admitted), 'RESOURCE_LIMIT');
});

test('A28 EVALUATION numeric and logical-reference precedence is independent of collection order', () => {
  const mixed = thaw('qualified');
  editClaim(mixed, 'semantic', claim => { claim.detail.contractIds = ['wrong.contract']; });
  editClaim(mixed, 'scope', claim => { claim.detail.qualificationIds.pop(); });
  for (let index = 0; index < 2; index++) {
    assert.throws(() => run(mixed), error => error.code === 'MO1307_INTEGRITY' && error.stage === 'EVALUATION' && error.reference === 'semantic');
    mixed.claims.reverse(); mixed.slots.reverse();
  }
  const sameCode = thaw('qualified');
  editClaim(sameCode, 'scope', claim => { claim.detail.qualificationIds.pop(); });
  editClaim(sameCode, 'supply', claim => { claim.detail.reviewScope = 'DECLARED_INVENTORY_COMPLETE'; });
  for (let index = 0; index < 2; index++) {
    assert.throws(() => run(sameCode), error => error.code === 'MO1307_QUALIFICATION_MISMATCH' && error.reference === 'scope');
    sameCode.claims.reverse(); sameCode.slots.reverse();
  }
});

test('A29 projection boundary rejects caller gate vectors, accessors and unknown profiles', () => {
  const supplied = thaw('ready'); supplied.gates = [];
  throwsCode(() => run(supplied), 'INPUT');
  const accessor = thaw('ready'); let touched = false;
  Object.defineProperty(accessor, 'claims', { enumerable: true, get() { touched = true; return []; } });
  throwsCode(() => run(accessor), 'INPUT'); assert.equal(touched, false);
  const unknown = thaw('ready'); unknown.profile.id = 'custom'; throwsCode(() => run(unknown), 'PROFILE_MISMATCH');
  const incomplete = thaw('ready'); incomplete.slots.pop(); throwsCode(() => run(incomplete), 'PROFILE_MISMATCH');
});

test('A30 returned proof input uses the exact independent nonrecursive binding shape', () => {
  const output = run(thaw('qualified'));
  assert.deepEqual(output.proofInput, { kind: 'MemoryOSReadinessProofBinding', version: '1.0.0', readinessDigest: output.readinessDigest, audit: output.result.audit });
  assert.equal(canonicalDigest(output.proofInput), output.proofBindingDigest);
  assert.equal('proofBindingDigest' in output.proofInput, false);
});

test('A31 all twelve external human decisions bind computed results without changing readiness', () => {
  const catalog = fixtureJSON('catalog.json');
  const cases = catalog.entries.filter(row => row.path.startsWith('human/'));
  assert.equal(cases.length, 12);
  for (const row of cases) {
    const verified = thaw(row.verificationBundle), output = run(verified), before = bytes(output.resultBytes);
    const decision = checkDecisionBinding(fixtureJSON(row.path), output.result);
    assert.equal(decision.consistency, row.expectedConsistency); assert.equal(decision.authenticity, 'NOT_VERIFIED_BY_MEMORYOS');
    assert.deepEqual(canonicalBytes(output.result), before); assert.deepEqual(bytes(run(verified).resultBytes), before);
  }
});

test('A32 every one of seven qualification codes is retained with its frozen impact', () => {
  const codes = new Map();
  for (const name of ['mo1306-qualified', 'rest-qualified', 'informational-ready']) {
    for (const row of run(thaw(name)).result.assessment.qualifications) codes.set(row.reasonCode, row.impact);
  }
  const verified = thaw('ready'); addInformational(verified, 'windows', 'q.platform');
  editClaim(verified, 'windows', claim => { claim.qualifications[0].reasonCode = 'PLATFORM_NOT_REQUIRED'; claim.qualifications[0].disclosureCode = 'PLATFORM_NOT_REQUIRED'; });
  const output = run(verified);
  assert.equal(output.result.assessment.readiness, 'READY');
  const qualification = output.result.assessment.qualifications[0]; codes.set(qualification.reasonCode, qualification.impact);
  assert.ok(text(output.text).includes('reason=PLATFORM_NOT_REQUIRED impact=INFORMATIONAL'));
  assert.deepEqual([...codes.keys()].sort(), ['BOUNDED_ADVISORY_REVIEW', 'ENVIRONMENT_LIMITATION', 'HISTORICAL_UNRESOLVED_PRESERVED', 'HOSTED_NOT_CERTIFIED', 'PLATFORM_NOT_REQUIRED', 'PROVIDER_NOT_LIVE_CERTIFIED', 'SAME_HOST_REMOTE_ONLY']);
  for (const [code, impact] of codes) assert.equal(impact, ['ENVIRONMENT_LIMITATION', 'PLATFORM_NOT_REQUIRED'].includes(code) ? 'INFORMATIONAL' : 'RELEASE_IMPACTING');
});

test('A33 complete blocker CNE qualification cross-product follows frozen precedence and retains all lists', () => {
  for (const blocked of [false, true]) for (const cne of [false, true]) for (const qualified of [false, true]) {
    const verified = thaw(qualified ? 'qualified' : 'ready');
    if (blocked) setCoverage(verified, 'security', { failed: ['NETWORK'] });
    if (cne) makeUnavailable(verified, 'resources', 'UNEVALUABLE');
    const output = run(verified), a = output.result.assessment;
    assert.equal(a.readiness, blocked ? 'NOT_READY' : cne ? 'COULD_NOT_EVALUATE' : qualified ? 'READY_WITH_QUALIFICATIONS' : 'READY');
    assert.equal(a.blockers.length, blocked ? 1 : 0); assert.equal(a.cneReasons.length, cne ? 1 : 0); assert.equal(a.qualifications.length, qualified ? 5 : 0);
    assert.equal(output.exitCode, blocked ? 3 : cne ? 4 : qualified ? 2 : 0);
  }
});

test('A34 permutations preserve exact gate blocker qualification history JSON and text bytes', () => {
  for (const name of ['mixed-precedence', 'history-blocker-unavailable', 'mo1306-qualified']) {
    const verified = thaw(name), expected = run(verified);
    verified.slots.reverse(); verified.claims.reverse();
    const actual = run(verified);
    for (const key of ['gates', 'blockers', 'qualifications', 'cneReasons', 'history', 'providers']) assert.deepEqual(canonicalBytes(actual.result.assessment[key]), canonicalBytes(expected.result.assessment[key]), name + ':' + key);
    for (const key of ['resultBytes', 'jsonSummary', 'text']) assert.deepEqual(bytes(actual[key]), bytes(expected[key]), name + ':' + key);
  }
});

test('A35 comparison rejects omitted mandatory CNE and substituted candidate profile or identity digest', () => {
  for (const [name, mutate] of [
    ['could-not-evaluate', result => { result.assessment.cneReasons = []; result.assessment.gates.find(row => row.id === 'security').cneReasons = []; }],
    ['ready', result => { result.assessment.candidate.source.commit = '9'.repeat(40); }],
    ['ready', result => { result.assessment.profile.id = 'rest'; }],
    ['ready', result => { result.assessment.candidateDigest = 'sha256:' + '9'.repeat(64); }],
    ['ready', result => { result.assessment.authorityIdentityDigest = 'sha256:' + '9'.repeat(64); }],
  ]) {
    const fixture = loadProjection(name), changed = clone(fixture.expected); mutate(changed);
    changed.readinessDigest = readinessDigest(changed.assessment); changed.proofBindingDigest = proofBindingDigest(changed.readinessDigest, changed.audit);
    throwsCode(() => compareReadinessResult(fixture.verified, canonicalBytes(changed)), 'RESULT_MISMATCH');
  }
});

test('A36 static pure-core import closure excludes acquisition execution network and ambient selectors', () => {
  const root = new URL('../../memoryos-readiness/src/', import.meta.url), visited = new Set(), pending = ['readiness-core.mjs', 'readiness-result.mjs'];
  const builtins = new Set();
  while (pending.length) {
    const name = pending.pop(); if (visited.has(name)) continue; visited.add(name);
    const source = readFileSync(new URL(name, root), 'utf8');
    for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      if (specifier.startsWith('node:')) builtins.add(specifier);
      else { assert.match(specifier, /^\.\/[a-z-]+\.mjs$/); pending.push(specifier.slice(2)); }
    }
    assert.doesNotMatch(source, /\b(?:import\s*\(|require\s*\(|eval\s*\(|fetch\s*\(|process\s*\.|setTimeout\s*\(|setInterval\s*\(|Date\s*\.\s*now\s*\(|performance\s*\.|new\s+Date\s*\(\s*\))/);
  }
  assert.deepEqual([...builtins].sort(), ['node:crypto', 'node:path']);
  assert.ok(visited.has('canonical.mjs') && visited.has('foundation.mjs') && visited.has('projections.mjs'));
});

test('A37 coverage missing duplicate cross-partition or contradictory verdict uses INTEGRITY', () => {
  const mutations = [claim => claim.passed.pop(), claim => { claim.failed = [claim.passed[0]]; claim.verdict = 'FAIL'; }, claim => { claim.verdict = 'FAIL'; }];
  for (const mutate of mutations) {
    const verified = thaw('ready'); editClaim(verified, 'semantic', mutate);
    throwsCode(() => run(verified), 'INTEGRITY');
  }
});

test('A38 nested candidate accessor is rejected before calling user code', () => {
  const verified = thaw('ready'); let touched = 0;
  Object.defineProperty(verified.candidate.product, 'name', { enumerable: true, get() { touched++; return 'memoryos-ci'; } });
  throwsCode(() => run(verified), 'INPUT'); assert.equal(touched, 0);
});

test('A39 informational qualification on an inactive gate remains global without activating that gate', () => {
  const verified = thaw('ready'); addInformational(verified, 'security', 'q.inactive');
  editClaim(verified, 'security', claim => { claim.qualifications[0].gateIds = ['rest.contract']; });
  const output = run(verified), inactive = gate(output.result, 'rest.contract');
  assert.equal(output.result.assessment.readiness, 'READY'); assert.equal(output.result.assessment.qualifications.length, 1);
  assert.equal(inactive.state, 'NOT_APPLICABLE'); assert.deepEqual(inactive.qualificationIds, []);
  assert.ok(text(output.text).includes('qualification=q.inactive reason=ENVIRONMENT_LIMITATION impact=INFORMATIONAL provider=null gates=rest.contract'));
});

test('A40 preserved-history qualification must match exact condition and affected gates', () => {
  for (const mutate of [qualification => { qualification.gateIds = ['semantic']; }, qualification => { qualification.conditionIds = ['condition.unknown']; }]) {
    const verified = thaw('mo1306-qualified');
    editClaim(verified, 'history', claim => mutate(claim.qualifications.find(row => row.reasonCode === 'HISTORICAL_UNRESOLVED_PRESERVED')));
    throwsCode(() => run(verified), 'QUALIFICATION_MISMATCH');
  }
});

test('A41 unavailable scope never exempts locally invalid or omitted required provider qualifications', () => {
  const malformed = thaw('qualified'); makeUnavailable(malformed, 'scope');
  editClaim(malformed, 'provider.github', claim => { claim.qualifications[0].gateIds = ['provider.github']; });
  throwsCode(() => run(malformed), 'QUALIFICATION_MISMATCH');
  const omitted = thaw('qualified'); makeUnavailable(omitted, 'scope');
  editClaim(omitted, 'provider.github', claim => { claim.qualifications = []; });
  throwsCode(() => run(omitted), 'QUALIFICATION_MISMATCH');
});

test('A42 minimum-met contradictory qualified support is an error; lower minimum unsupported facts are blockers', () => {
  for (const provider of ['azure', 'github', 'gitlab', 'jenkins']) {
    const verified = thaw('qualified');
    editClaim(verified, 'provider.' + provider, claim => { claim.detail.support = 'SUPPORTED'; });
    throwsCode(() => run(verified), 'QUALIFICATION_MISMATCH');
  }
  const lower = thaw('ready');
  editClaim(lower, 'provider.github', claim => { claim.detail.implementation = 'NOT_IMPLEMENTED'; claim.detail.validation = 'NOT_VALIDATED'; claim.detail.execution = 'NOT_CERTIFIED'; claim.detail.sourceExecutionLabel = 'NOT_CERTIFIED'; claim.detail.support = 'UNSUPPORTED'; claim.detail.hostedCases = null; });
  const output = run(lower);
  assert.equal(output.result.assessment.readiness, 'NOT_READY');
  assert.ok(output.result.assessment.blockers.every(row => row.reasonCode === 'PROVIDER_MINIMUM_UNMET'));
});

test('A43 known history only contributes blockers to active mandatory affected gates', () => {
  const verified = thaw('history-blocker-unavailable');
  editClaim(verified, 'history', claim => { claim.detail.records[0].affectedGateIds = ['provider.github.hosted', 'rest.contract']; });
  const result = run(verified).result;
  assert.equal(result.assessment.readiness, 'COULD_NOT_EVALUATE');
  assert.deepEqual(result.assessment.blockers, []); assert.equal(result.assessment.history.length, 1);
  assert.equal(gate(result, 'provider.github.hosted').state, 'NOT_REQUIRED'); assert.equal(gate(result, 'rest.contract').state, 'NOT_APPLICABLE');
});

test('A44 conflicting qualification scope errors choose the smallest logical ID regardless of carrier order', () => {
  const verified = thaw('qualified');
  editClaim(verified, 'provider.azure', claim => { claim.qualifications[0].scopeId = 'wrong.azure.scope'; });
  editClaim(verified, 'supply', claim => { claim.qualifications[0].scopeId = 'wrong.supply.scope'; });
  for (let index = 0; index < 2; index++) {
    assert.throws(() => computeReadiness(verified), error => error.code === 'MO1307_QUALIFICATION_MISMATCH' && error.stage === 'EVALUATION' && error.reference === 'q.advisory');
    verified.claims.reverse(); verified.slots.reverse();
  }
});

test('A45 REST unevaluable required coverage yields CNE with same-host qualification retained', () => {
  const verified = thaw('rest-qualified');
  const qualified = run(verified);
  assert.equal(qualified.result.assessment.readiness, 'READY_WITH_QUALIFICATIONS'); assert.equal(qualified.exitCode, 2);
  assert.equal(qualified.result.assessment.qualifications.length, 1);
  assert.equal(qualified.result.assessment.qualifications[0].reasonCode, 'SAME_HOST_REMOTE_ONLY');
  setCoverage(verified, 'rest.contract', { unevaluable: ['OPENAPI'] });
  const output = run(verified), a = output.result.assessment;
  assert.equal(a.readiness, 'COULD_NOT_EVALUATE'); assert.equal(output.exitCode, 4);
  assert.equal(gate(output.result, 'rest.contract').state, 'COULD_NOT_EVALUATE');
  assert.deepEqual(a.blockers, []);
  assert.deepEqual(a.cneReasons, [{ gateId: 'rest.contract', reason: 'UNEVALUABLE', checkCode: 'OPENAPI' }]);
  assert.deepEqual(a.qualifications.map(row => row.reasonCode), ['SAME_HOST_REMOTE_ONLY']);
  assert.ok(text(output.text).includes('reason=SAME_HOST_REMOTE_ONLY impact=RELEASE_IMPACTING'));
});
