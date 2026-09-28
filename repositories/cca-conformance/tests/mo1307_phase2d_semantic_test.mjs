// Integrated pure semantics. Actual native/API process execution has separate
// campaigns; these tests call the same fixed worker implementation directly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalBytes, canonicalDigest, digest, readinessDigest, proofBindingDigest } from '../../memoryos-readiness/src/canonical.mjs';
import { DEFINITIONS } from '../../memoryos-readiness/src/constants.mjs';
import { verifyEvidence, verifyResultEvidence } from '../../memoryos-readiness/src/evidence-verifier.mjs';
import { validateEvidenceGraph } from '../../memoryos-readiness/src/evidence-graph.mjs';
import { computeReadiness } from '../../memoryos-readiness/src/readiness-core.mjs';
import { projectReadinessResult } from '../../memoryos-readiness/src/readiness-result.mjs';
import { adaptVerifiedEvidence, evidenceInput, verifyDecisionBytes, assessInWorker } from '../../memoryos-readiness/src/integration.mjs';
import { bundleNames, accepted2AVectors, lineageRecord, sameBytes, otherDigest, throwsCode,
  evaluateBundle, verifyInput, decisionFor, reverseObjectKeys, loadBundle, inputOf, repin,
  envelopeFor, grantFor } from '../tools/mo1307-phase2d/semantic-support.mjs';

const code = (fn, expected, stage) => throwsCode(assert, fn, expected, stage);
const check = input => assessInWorker(input, false);
const verify = (input, result, decision = null) => assessInWorker(verifyInput(input, result, decision), true);
const repairedResult = result => {
  result.assessment.graphDigest = canonicalDigest(result.assessment.graph);
  result.readinessDigest = readinessDigest(result.assessment);
  result.proofBindingDigest = proofBindingDigest(result.readinessDigest, result.audit);
  return canonicalBytes(result);
};

for (const name of bundleNames) test('D01 actual integrated evaluation and independent verify: ' + name, () => {
  const { bundle, input, verified, adapted, computed } = evaluateBundle(name);
  const expected = canonicalBytes(bundle.result), result = check(input), checked = verify(input, expected);
  sameBytes(assert, computed.resultBytes, expected, name);
  sameBytes(assert, result.resultBytes, expected, name);
  sameBytes(assert, checked.resultBytes, expected, name);
  assert.equal(checked.decision, null);
  assert.equal(computed.result.assessment.gates.length, 22);
  assert.deepEqual(computed.result.assessment.gates.map(g => g.id), DEFINITIONS.gateDefinitions.map(g => g.id));
  assert.equal(result.readinessDigest, bundle.pins.expectedReadinessDigest);
  assert.equal(result.proofBindingDigest, bundle.pins.expectedProofBindingDigest);
  assert.deepEqual(adapted.slots, verified.projection.normalizedAuthority.slots);
  for (const field of ['candidate', 'candidateDigest', 'profile', 'stage', 'authorityIdentityDigest',
    'qualifications', 'history', 'providers', 'graph', 'graphDigest']) {
    sameBytes(assert, canonicalBytes(computed.result.assessment[field]), canonicalBytes(verified.projection[field]), name + ':' + field);
  }
  assert.deepEqual(computed.result.audit, verified.audit);
  assert.deepEqual(verifyResultEvidence(input, computed.resultBytes), verified);
  const old = accepted2AVectors().find(v => v.name === name);
  assert.equal(computed.readinessDigest, old.readinessDigest);
  assert.equal(computed.exitCode, old.exit);
  if (name !== 'mo1306-qualified') {
    assert.equal(digest(computed.resultBytes), old.result.sha256);
    assert.equal(computed.resultBytes.length, old.result.byteLength);
    assert.equal(computed.proofBindingDigest, old.proofBindingDigest);
    assert.equal(digest(projectReadinessResult(computed.result)), old.jsonSummary.sha256);
  } else {
    const correction = lineageRecord();
    assert.equal(old.proofBindingDigest, correction.before.pins.expectedProofBindingDigest);
    assert.equal(computed.proofBindingDigest, correction.after.pins.expectedProofBindingDigest);
    assert.notEqual(computed.proofBindingDigest, old.proofBindingDigest);
    assert.equal(correction.unchanged.entireNormativeAssessmentByteIdentical, true);
    assert.equal(computed.result.assessment.graphDigest, correction.unchanged.graphDigest);
    assert.equal(computed.result.assessment.authorityIdentityDigest, correction.unchanged.authorityIdentityDigest);
  }
});

test('D02 all four states and blocker-over-CNE precedence survive the actual pipeline', () => {
  for (const [name, readiness, exit] of [['ready', 'READY', 0], ['qualified', 'READY_WITH_QUALIFICATIONS', 2],
    ['not-ready', 'NOT_READY', 3], ['could-not-evaluate', 'COULD_NOT_EVALUATE', 4], ['mixed-precedence', 'NOT_READY', 3]]) {
    const { computed } = evaluateBundle(name);
    assert.equal(computed.result.assessment.readiness, readiness); assert.equal(computed.exitCode, exit);
  }
});

test('D03 adapter has exactly the accepted closed fields and never uses diagnostics as authority', () => {
  const { verified, adapted } = evaluateBundle('ready');
  assert.deepEqual(Object.keys(adapted).sort(), ['audit', 'authorityIdentityDigest', 'candidate', 'candidateDigest',
    'claims', 'graph', 'graphDigest', 'profile', 'scopeId', 'slots', 'stage'].sort());
  const changed = structuredClone(verified); changed.diagnostics = [{ readiness: 'NOT_READY', grant: 'invented' }];
  sameBytes(assert, computeReadiness(adaptVerifiedEvidence(changed)).resultBytes, computeReadiness(adapted).resultBytes);
  assert.equal(Object.hasOwn(verified.projection, 'readiness'), false);
});

test('D04 MO1306 all nineteen source rows and twelve negative projections remain exact', () => {
  const { bundle, computed } = evaluateBundle('mo1306-qualified'), a = computed.result.assessment;
  const raw = JSON.parse(bundle.files.get('released.history'));
  assert.equal(raw.records.length, 19); assert.equal(a.history.length, 12); assert.equal(a.qualifications.length, 10);
  for (const record of raw.records) {
    const source = bundle.manifest.entries.find(e => e.id === 'history-source.' + record.id);
    assert.ok(source); assert.equal(digest(bundle.files.get(source.id)), source.sha256);
    const projected = a.history.find(h => h.id === 'history.' + record.id);
    if (record.historicalFailureOrUnclosedGate) {
      assert.ok(projected); assert.equal(projected.originalDisposition, record.disposition);
      assert.notEqual(projected.originalOutcome, 'PASS');
    } else assert.equal(projected, undefined);
  }
  assert.equal(a.history.find(h => h.id === 'history.native-publication').originalDisposition, 'FAIL / UNRESOLVED');
  assert.equal(a.history.find(h => h.id === 'history.diagnostic-36396330199').originalDisposition,
    'FAILURE / STILL_UNRESOLVED / HOSTED_DIAGNOSTIC_EXHAUSTED');
});

test('D05 MO1306 provider axes and ten disclosures retain their exact released limitations', () => {
  const a = evaluateBundle('mo1306-qualified').computed.result.assessment, by = id => a.providers.find(p => p.provider === id);
  assert.equal(a.readiness, 'READY_WITH_QUALIFICATIONS'); assert.equal(a.qualifications.length, 10);
  assert.equal(by('generic').execution, 'REAL_EXECUTION_CERTIFIED');
  assert.equal(by('github').validation, 'OFFLINE_VALIDATED'); assert.equal(by('github').execution, 'HOSTED_EXECUTION_NOT_CERTIFIED');
  assert.equal(by('github').sourceExecutionLabel, 'NOT_CERTIFIED');
  assert.deepEqual(by('github').hostedCases, { cne: false, fail: false, parity: false, pass: false });
  for (const provider of ['azure', 'gitlab', 'jenkins']) {
    assert.equal(by(provider).validation, 'CONTRACT_VALIDATED');
    assert.equal(by(provider).execution, 'NOT_LIVE_PROVIDER_CERTIFIED');
    assert.equal(by(provider).support, 'SUPPORTED_WITH_CONTRACT_VALIDATION_ONLY');
  }
});

test('D06 MO1306 raw configuration lineage survives integration and original omission still rejects', () => {
  const b = loadBundle('mo1306-qualified'), correction = lineageRecord();
  const ids = b.manifest.entries.filter(e => e.id.startsWith('configuration-source.')).map(e => e.id);
  assert.equal(ids.length, 8);
  for (const grant of b.authority.assessment.grants) {
    const envelope = b.envelopes.get(grant.envelopeId);
    if (envelope.claim.dependencies.some(d => d.role === 'CONFIGURATION')) assert.deepEqual(grant.sourceIds.filter(id => ids.includes(id)), ids);
    assert.deepEqual(envelope.sources, grant.sourceIds);
  }
  for (const row of correction.before.rawSources) { assert.equal(b.files.get(row.id).length, row.byteLength); assert.equal(digest(b.files.get(row.id)), row.sha256); }
  for (const grant of b.authority.assessment.grants) {
    grant.sourceIds = grant.sourceIds.filter(id => !ids.includes(id));
    b.envelopes.get(grant.envelopeId).sources = b.envelopes.get(grant.envelopeId).sources.filter(id => !ids.includes(id));
  }
  const original = repin(b); assert.equal(digest(original.authorityBytes), correction.before.pins.trustedAuthorityDigest);
  code(() => check(original), 'EVIDENCE_AUTHORITY', 'AUTHORITY');
});

test('D07 verified historical applicability blocks an unavailable mandatory gate without erasing CNE', () => {
  const { verified, computed } = evaluateBundle('history-blocker-unavailable'), a = computed.result.assessment;
  for (const link of verified.projection.historicalApplicability) {
    assert.ok(a.blockers.some(b => b.gateId === link.gateId && b.conditionId === link.conditionId));
  }
  assert.equal(a.readiness, 'NOT_READY');
  assert.ok(a.cneReasons.some(c => c.gateId === 'security'));
  assert.equal(a.gates.find(g => g.id === 'security').state, 'BLOCKED');
});

test('D08 REST authority remains separate with mandatory same-host qualification and no providers', () => {
  const { computed } = evaluateBundle('rest-qualified'), a = computed.result.assessment;
  assert.equal(a.candidate.product.name, 'memoryos-rest'); assert.equal(a.profile.id, 'rest');
  assert.equal(a.readiness, 'READY_WITH_QUALIFICATIONS'); assert.deepEqual(a.providers, []);
  assert.equal(a.qualifications.filter(q => q.reasonCode === 'SAME_HOST_REMOTE_ONLY').length, 1);
  assert.ok(a.gates.filter(g => g.id.startsWith('provider.')).every(g => !g.applicable));
});

for (const [name, decision, consistency] of [['ready', 'APPROVE', 'CONSISTENT'], ['ready', 'REJECT', 'CONSISTENT'],
  ['ready', 'DEFER', 'CONSISTENT'], ['qualified', 'APPROVE', 'CONSISTENT'], ['not-ready', 'APPROVE', 'CONTRARY_TO_READINESS']]) {
  test('D09 human decision binding is downstream and never changes readiness: ' + name + '/' + decision, () => {
    const { input, computed } = evaluateBundle(name), bytes = canonicalBytes(decisionFor(computed.result, decision));
    const result = verify(input, computed.resultBytes, bytes);
    sameBytes(assert, result.resultBytes, computed.resultBytes);
    assert.deepEqual(result.decision, { decision, consistency, authenticity: 'NOT_VERIFIED_BY_MEMORYOS' });
    assert.deepEqual(result.decision, verifyDecisionBytes(bytes, computed.result));
  });
}
for (const field of ['candidateDigest', 'readinessDigest', 'proofBindingDigest']) test('D10 mismatched human decision rejects: ' + field, () => {
  const { input, computed } = evaluateBundle('ready'), decision = decisionFor(computed.result); decision[field] = otherDigest;
  code(() => verify(input, computed.resultBytes, canonicalBytes(decision)), 'DECISION_MISMATCH', 'VERIFICATION');
});

test('D11 tag-stage facts yield exact mandatory blockers and never execute Git', () => {
  for (const [name, checkCode] of [['pre-tag-present', 'TAG_PRESENCE'], ['post-tag-absent', 'TAG_PRESENCE'],
    ['post-tag-lightweight', 'TAG_ANNOTATION'], ['post-tag-wrong-target', 'TAG_TARGET']]) {
    const a = evaluateBundle(name).computed.result.assessment;
    assert.equal(a.readiness, 'NOT_READY'); assert.ok(a.blockers.some(b => b.gateId === 'tag' && b.checkCode === checkCode));
  }
  assert.equal(evaluateBundle('post-tag-ready').computed.result.assessment.readiness, 'READY');
  const wrongName = loadBundle('post-tag-ready');
  envelopeFor(wrongName, 'TAG_OBSERVATION').claim.detail.name = 'memoryos-1.3-wrong-tag';
  const changed = JSON.parse(Buffer.from(check(repin(wrongName)).resultBytes).toString('utf8'));
  assert.equal(changed.assessment.readiness, 'NOT_READY');
  assert.ok(changed.assessment.blockers.some(b => b.gateId === 'tag' && b.checkCode === 'TAG_NAME'));
});

const negatives = [
  ['candidate substitution', 'CANDIDATE_MISMATCH', () => { const input = inputOf(loadBundle()); input.expectedCandidateDigest = otherDigest; return input; }],
  ['trust-root mismatch', 'EVIDENCE_AUTHORITY', () => { const input = inputOf(loadBundle()); input.trustedAuthorityDigest = otherDigest; return input; }],
  ['raw-source tamper', 'INTEGRITY', () => { const input = inputOf(loadBundle()); input.files.find(f => f.id === 'fixture.source').bytes[0] ^= 1; return input; }],
  ['claim tamper under an old grant', 'EVIDENCE_AUTHORITY', () => { const b = loadBundle(); const c = envelopeFor(b, 'SECURITY_AUDIT').claim; c.failed = [c.passed.shift()]; c.verdict = 'FAIL'; return repin(b, { grants: false }); }],
  ['grant substitution', 'EVIDENCE_AUTHORITY', () => { const b = loadBundle(); b.authority.assessment.slots.find(s => s.gateId === 'security').grantIds = ['grant.semantic']; return repin(b); }],
  ['stale dependency', 'STALE_EVIDENCE', () => { const b = loadBundle(); envelopeFor(b, 'SECURITY_AUDIT').claim.dependencies[0].sha256 = otherDigest; return repin(b); }],
  ['history rewrite with intact grant', 'EVIDENCE_AUTHORITY', () => { const b = loadBundle('mo1306-qualified'); envelopeFor(b, 'HISTORICAL_DISPOSITION').claim.detail.records[0].originalDisposition = 'invented resolution'; return repin(b, { grants: false }); }],
  ['history PASS fabrication', 'HISTORY_MISMATCH', () => { const b = loadBundle('mo1306-qualified'); envelopeFor(b, 'HISTORICAL_DISPOSITION').claim.detail.records[0].originalOutcome = 'PASS'; return repin(b); }],
  ['qualification omission', 'QUALIFICATION_MISMATCH', () => { const b = loadBundle('qualified'); envelopeFor(b, 'PROVIDER_CERTIFICATION', 'github').claim.qualifications = []; return repin(b); }],
  ['provider false hosted promotion', 'QUALIFICATION_MISMATCH', () => { const b = loadBundle('mo1306-qualified'); const d = envelopeFor(b, 'PROVIDER_CERTIFICATION', 'github').claim.detail; d.execution = 'HOSTED_EXECUTION_CERTIFIED'; d.sourceExecutionLabel = d.execution; d.support = 'SUPPORTED'; return repin(b); }],
  ['dangling authority reference', 'INPUT', () => { const b = loadBundle(); grantFor(b, envelopeFor(b, 'SECURITY_AUDIT')).authoritySourceIds = ['authority.missing']; return repin(b); }],
  ['profile substitution', 'PROFILE_MISMATCH', () => { const b = loadBundle(); b.configuration.profile = { id: 'rest', version: '1.0.0' }; return inputOf(b); }],
  ['path traversal rejected by the frozen manifest schema', 'INPUT', () => { const b = loadBundle(); b.manifest.entries.find(e => e.id === 'fixture.source').path = '../escape.data'; return repin(b); }],
];
for (const [name, expected, makeInput] of negatives) test('D12 integrated operational failure remains an error: ' + name, () => code(() => check(makeInput()), expected));

test('D13 result verification independently rechecks original raw bytes before trusting a valid result', () => {
  const b = loadBundle(), input = inputOf(b); input.files.find(f => f.id === 'fixture.source').bytes[0] ^= 1;
  code(() => verify(input, canonicalBytes(b.result)), 'INTEGRITY', 'INTEGRITY');
});

test('D14 self-consistent changed readiness passes evidence-only support but fails integrated recomputation', () => {
  const b = loadBundle(), input = inputOf(b), forged = structuredClone(b.result);
  forged.assessment.readiness = 'NOT_READY'; const bytes = repairedResult(forged);
  // This assertion exposes exactly the division of responsibility: 2B does not
  // pretend to calculate final readiness; integrated 2A recomputation must.
  assert.ok(verifyResultEvidence(input, bytes));
  code(() => verify(input, bytes), 'RESULT_MISMATCH', 'VERIFICATION');
});

for (const field of ['readinessDigest', 'proofBindingDigest']) test('D15 supplied result digest tamper rejects: ' + field, () => {
  const b = loadBundle(), forged = structuredClone(b.result); forged[field] = otherDigest;
  code(() => verify(inputOf(b), canonicalBytes(forged)), 'RESULT_MISMATCH', 'VERIFICATION');
});

test('D16 self-consistent result history or qualification omission cannot hide behind repaired hashes', () => {
  for (const field of ['history', 'qualifications']) {
    const b = loadBundle('mo1306-qualified'), forged = structuredClone(b.result); forged.assessment[field].pop();
    code(() => verify(inputOf(b), repairedResult(forged)), 'RESULT_MISMATCH', 'VERIFICATION');
  }
});

test('D17 derived graph is candidate-rooted, authority-rooted, closed and bounded', () => {
  for (const name of ['ready', 'mo1306-qualified', 'rest-qualified']) {
    const { verified } = evaluateBundle(name), p = verified.projection;
    validateEvidenceGraph(p.graph, { candidateDigest: p.candidateDigest });
    const nodes = new Map(p.graph.nodes.map(n => [n.id, n]));
    assert.equal(p.graph.nodes.filter(n => n.type === 'ASSESSMENT').length, 1);
    assert.ok(nodes.has('assessment')); assert.equal(p.graph.nodes.filter(n => n.type === 'CANDIDATE').length, 1);
    assert.ok(p.graph.edges.every(e => nodes.has(e.from) && nodes.has(e.to)));
    for (const grant of p.graph.nodes.filter(n => n.type === 'GRANT')) assert.ok(p.graph.edges.some(e => e.from === grant.id && e.type === 'ROOTED_IN'));
    assert.ok(p.graph.nodes.length <= 2048 && p.graph.edges.length <= 8192);
  }
});

test('D18 no supplied cyclic or dangling graph can replace independently derived evidence', () => {
  const { verified, input, computed } = evaluateBundle('ready');
  const cyclic = structuredClone(verified.projection.graph);
  cyclic.edges.push({ from: 'assessment', type: 'ACCEPTS', to: 'assessment' });
  code(() => validateEvidenceGraph(cyclic), 'GRAPH_CYCLE', 'GRAPH');
  const dangling = structuredClone(verified.projection.graph); dangling.edges[0].to = 'CLAIM:' + otherDigest;
  code(() => validateEvidenceGraph(dangling), 'INPUT', 'GRAPH');
  const extra = { ...input, graph: cyclic }; code(() => check(extra), 'INPUT', 'LAUNCH');
  const forged = structuredClone(computed.result); forged.assessment.graph = cyclic;
  code(() => verify(input, repairedResult(forged)), 'RESULT_MISMATCH', 'VERIFICATION');
});

test('D19 repeated calls and nonsemantic object/map insertion order preserve exact normative bytes', () => {
  const b = loadBundle('qualified'), original = check(inputOf(b));
  sameBytes(assert, check(inputOf(b)).resultBytes, original.resultBytes);
  b.configuration = reverseObjectKeys(b.configuration); b.candidate = reverseObjectKeys(b.candidate);
  b.manifest = reverseObjectKeys(b.manifest); b.authority = reverseObjectKeys(b.authority);
  b.envelopes = new Map([...b.envelopes].reverse().map(([id, value]) => [id, reverseObjectKeys(value)]));
  b.files = new Map([...b.files].reverse());
  const input = repin(b); sameBytes(assert, check(Object.fromEntries(Object.entries(input).reverse())).resultBytes, original.resultBytes);
});

test('D20 signed set ordering is preserved rather than silently normalized during integration', () => {
  const b = loadBundle(); b.manifest.entries.reverse(); code(() => check(repin(b)), 'INPUT', 'CONFIGURATION');
  const input = inputOf(loadBundle()); input.files.reverse(); code(() => check(input), 'INPUT', 'ACQUISITION');
});

test('D21 metadata affects exact proof audit while leaving all readiness semantics byte-identical', () => {
  const a = evaluateBundle('ready').computed.result, b = evaluateBundle('metadata-only').computed.result;
  sameBytes(assert, canonicalBytes(a.assessment), canonicalBytes(b.assessment));
  assert.equal(a.readinessDigest, b.readinessDigest); assert.notEqual(a.proofBindingDigest, b.proofBindingDigest);
});

test('D22 selective reuse stays explicit and relevant changes fail before readiness computation', () => {
  const { verified, computed } = evaluateBundle('selective-reuse');
  assert.equal(computed.result.assessment.readiness, 'READY');
  assert.ok(verified.projection.reuse.some(r => r.disposition === 'REUSED'));
  for (const row of verified.projection.reuse.filter(r => r.disposition === 'REUSED')) {
    assert.equal(row.binding, 'DEPENDENCY_SET'); assert.notEqual(row.originCandidate, row.candidateDigest);
  }
  const b = loadBundle('selective-reuse'); envelopeFor(b, 'SEMANTIC_CONFORMANCE').claim.dependencies[0].sha256 = otherDigest;
  code(() => check(repin(b)), 'STALE_EVIDENCE', 'AUTHORITY');
});

test('D23 evidenceInput strips only known verification transport fields and adds no authority', () => {
  const input = inputOf(loadBundle()), projected = evidenceInput(verifyInput(input, canonicalBytes(loadBundle().result)));
  assert.deepEqual(projected, input);
  assert.equal(Object.hasOwn(projected, 'resultBytes'), false); assert.equal(Object.hasOwn(projected, 'decisionBytes'), false);
});

test('D24 integrated preflight preserves accepted authority-before-semantic error priority', () => {
  const b = loadBundle('qualified'), envelope = envelopeFor(b, 'PROVIDER_CERTIFICATION', 'github');
  envelope.claim.detail.support = 'SUPPORTED'; repin(b);
  grantFor(b, envelope).claimDigest = otherDigest;
  const input = repin(b, { grants: false });
  code(() => verifyEvidence(input), 'EVIDENCE_AUTHORITY', 'AUTHORITY');
  code(() => check(input), 'EVIDENCE_AUTHORITY', 'AUTHORITY');
});
