// Engineering observations from actual integrated pure computation; no doubles.
import assert from 'node:assert/strict';
import { canonicalBytes, canonicalDigest, digest } from '../../../memoryos-readiness/src/canonical.mjs';
import { validateEvidenceGraph } from '../../../memoryos-readiness/src/evidence-graph.mjs';
import { assessInWorker, verifyDecisionBytes } from '../../../memoryos-readiness/src/integration.mjs';
import { bundleNames, evaluateBundle, vectorRecord, accepted2AVectors, lineageRecord,
  loadBundle, inputOf, repin, reverseObjectKeys, decisionFor, otherDigest } from './semantic-support.mjs';

export function collectSemanticMatrices() {
  const vectors = [], graphs = [], historicalComparisons = [];
  const oldVectors = accepted2AVectors(), correction = lineageRecord();
  for (const name of bundleNames) {
    const evaluated = evaluateBundle(name), row = vectorRecord(name, evaluated), p = evaluated.verified.projection;
    assert.equal(row.exactExpectedResult, true);
    const old = oldVectors.find(v => v.name === name);
    assert.equal(row.readinessDigest, old.readinessDigest);
    if (name === 'mo1306-qualified') {
      assert.equal(row.proofBindingDigest, correction.after.pins.expectedProofBindingDigest);
      assert.equal(old.proofBindingDigest, correction.before.pins.expectedProofBindingDigest);
      assert.notEqual(row.proofBindingDigest, old.proofBindingDigest);
    } else {
      assert.equal(row.result.sha256, old.result.sha256);
      assert.equal(row.proofBindingDigest, old.proofBindingDigest);
    }
    historicalComparisons.push({ name, normativeReadinessDigestUnchanged: true,
      resultAndProofDisposition: name === 'mo1306-qualified' ? 'ACCEPTED_2B_RAW_LINEAGE_AUDIT_ONLY_CORRECTION' : 'EXACT_ACCEPTED_2A_BYTES',
      oldProofBindingDigest: old.proofBindingDigest, integratedProofBindingDigest: row.proofBindingDigest });
    const worker = assessInWorker(evaluated.input, false);
    assert.deepEqual(Buffer.from(worker.resultBytes), Buffer.from(evaluated.computed.resultBytes));
    validateEvidenceGraph(p.graph, { candidateDigest: p.candidateDigest });
    const members = new Set(p.graph.nodes.map(n => n.id));
    assert.ok(p.graph.edges.every(e => members.has(e.from) && members.has(e.to)));
    vectors.push({ ...row, fixedWorkerSeamMatchesDirectComputation: true, result: { ...row.result }, validation: 'PASS' });
    graphs.push({ name, graph: p.graph, graphDigest: p.graphDigest, candidateDigest: p.candidateDigest,
      authorityIdentityDigest: p.authorityIdentityDigest, rawTrustedAuthorityDigest: evaluated.verified.audit.trustedAuthorityDigest,
      grants: evaluated.verified.audit.bindings.length, acceptedClaims: p.claims.length,
      sourceInputs: evaluated.verified.audit.inputs.length, authoritySources: evaluated.verified.audit.authoritySources.length,
      acyclic: true, closed: true, candidateRooted: true, authorityRooted: true, futureOrSelfReference: false, result: 'PASS' });
  }
  const determinism = [];
  for (const name of ['ready', 'qualified', 'mo1306-qualified']) {
    const bundle = loadBundle(name), original = assessInWorker(inputOf(bundle), false);
    const repeat = assessInWorker(inputOf(bundle), false);
    bundle.configuration = reverseObjectKeys(bundle.configuration); bundle.candidate = reverseObjectKeys(bundle.candidate);
    bundle.manifest = reverseObjectKeys(bundle.manifest); bundle.authority = reverseObjectKeys(bundle.authority);
    bundle.envelopes = new Map([...bundle.envelopes].reverse().map(([id, value]) => [id, reverseObjectKeys(value)]));
    bundle.files = new Map([...bundle.files].reverse());
    const input = repin(bundle), reordered = assessInWorker(Object.fromEntries(Object.entries(input).reverse()), false);
    assert.deepEqual(Buffer.from(repeat.resultBytes), Buffer.from(original.resultBytes));
    assert.deepEqual(Buffer.from(reordered.resultBytes), Buffer.from(original.resultBytes));
    determinism.push({ name, actualComputations: 3, repeatedInputBytesIdentical: true,
      objectAndMapInsertionOrderBytesIdentical: true, normativeResultSha256: digest(original.resultBytes),
      readinessDigest: original.readinessDigest, proofBindingDigest: original.proofBindingDigest, result: 'PASS' });
  }
  const decisions = [];
  for (const [name, decision] of [['ready', 'APPROVE'], ['ready', 'REJECT'], ['ready', 'DEFER'], ['qualified', 'APPROVE'], ['not-ready', 'APPROVE']]) {
    const { computed } = evaluateBundle(name), projection = verifyDecisionBytes(canonicalBytes(decisionFor(computed.result, decision)), computed.result);
    assert.equal(projection.authenticity, 'NOT_VERIFIED_BY_MEMORYOS');
    assert.equal(projection.consistency, name === 'not-ready' ? 'CONTRARY_TO_READINESS' : 'CONSISTENT');
    decisions.push({ name, decision, projection, readiness: computed.result.assessment.readiness,
      candidateDigest: computed.result.assessment.candidateDigest, readinessDigest: computed.readinessDigest,
      proofBindingDigest: computed.proofBindingDigest, readinessUnaffected: true, result: 'PASS' });
  }
  const ready = evaluateBundle('ready').computed.result;
  for (const field of ['candidateDigest', 'readinessDigest', 'proofBindingDigest']) {
    const decision = decisionFor(ready); decision[field] = otherDigest; let observed = null;
    try { verifyDecisionBytes(canonicalBytes(decision), ready); } catch (error) { observed = error.code; }
    assert.equal(observed, 'MO1307_DECISION_MISMATCH');
    decisions.push({ name: 'ready', mismatchedField: field, observedError: observed, result: 'PASS' });
  }
  const historical = evaluateBundle('history-blocker-unavailable'), expectedLinks = historical.verified.projection.historicalApplicability;
  const historicalLinks = expectedLinks.map(link => ({ ...link, blockers: historical.computed.result.assessment.blockers.filter(b => b.gateId === link.gateId && b.conditionId === link.conditionId).map(b => b.id) }));
  assert.ok(historicalLinks.every(link => link.blockers.length > 0));
  const qualified = evaluateBundle('mo1306-qualified'), rawHistory = JSON.parse(qualified.bundle.files.get('released.history'));
  assert.equal(rawHistory.records.length, 19); assert.equal(qualified.computed.result.assessment.history.length, 12);
  return {
    vectorMatrix: { kind: 'MO1307IntegratedSemanticVectors', version: '1.0.0', result: 'PASS', vectors, historicalComparisons,
      fourReadinessStates: [...new Set(vectors.map(v => v.readiness))].sort(), allGates: 22,
      scope: 'ACTUAL_FIXED_WORKER_SEMANTIC_FUNCTION_AND_ACTUAL_2B_2A_MODULES; NO_NATIVE_LAUNCH_CLAIM' },
    graphMatrix: { kind: 'MO1307IntegratedEvidenceGraphMatrix', version: '1.0.0', result: 'PASS', graphs },
    determinismMatrix: { kind: 'MO1307IntegratedPureDeterminism', version: '1.0.0', result: 'PASS', cases: determinism,
      frozenSetOrder: 'Preserved; reversing signed manifest/files arrays rejects instead of changing their identities.',
      nativeSessionsAndOutputRoots: 'Covered by the separate integrated native campaign; not asserted by pure tests.' },
    decisionMatrix: { kind: 'MO1307IntegratedDecisionBinding', version: '1.0.0', result: 'PASS', cases: decisions },
    preservationMatrix: { kind: 'MO1307IntegratedSemanticPreservation', version: '1.0.0', result: 'PASS',
      mo1306: { rawHistoryRows: rawHistory.records.length, history: qualified.computed.result.assessment.history,
        qualifications: qualified.computed.result.assessment.qualifications, providers: qualified.computed.result.assessment.providers,
        candidateDigest: qualified.computed.result.assessment.candidateDigest, graphDigest: qualified.computed.result.assessment.graphDigest,
        readiness: qualified.computed.result.assessment.readiness, readinessDigest: qualified.computed.readinessDigest,
        proofBindingDigest: qualified.computed.proofBindingDigest, authorityAuditSha256: canonicalDigest(qualified.verified.audit),
        normalizedHistoricalFactsPreserved: true }, historicalLinks },
  };
}
