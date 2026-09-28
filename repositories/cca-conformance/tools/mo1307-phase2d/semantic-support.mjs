// Engineering fixture support only. Production imports no module from here.
import fs from 'node:fs';
import { canonicalBytes, digest } from '../../../memoryos-readiness/src/canonical.mjs';
import { verifyEvidence } from '../../../memoryos-readiness/src/evidence-verifier.mjs';
import { computeReadiness } from '../../../memoryos-readiness/src/readiness-core.mjs';
import { adaptVerifiedEvidence } from '../../../memoryos-readiness/src/integration.mjs';
import { loadBundle, inputOf, repin, envelopeFor, grantFor } from '../mo1307-phase2b/test-support.mjs';

export { loadBundle, inputOf, repin, envelopeFor, grantFor };
export const bundleNames = Object.freeze(['could-not-evaluate', 'history-blocker-unavailable',
  'informational-ready', 'metadata-only', 'mixed-precedence', 'mo1306-qualified', 'not-ready',
  'post-tag-absent', 'post-tag-lightweight', 'post-tag-ready', 'post-tag-wrong-target',
  'pre-tag-present', 'qualified', 'ready', 'rest-qualified', 'selective-reuse']);
export const readEvidence = relative => JSON.parse(fs.readFileSync(new URL('../../evidence/mo1307/' + relative, import.meta.url)));
export const accepted2AVectors = () => readEvidence('phase2a/acceptance/normative-vectors.json').vectors;
export const lineageRecord = () => readEvidence('phase2b/development/mo1306-source-lineage.json');
export const sameBytes = (assert, left, right, message) => assert.deepEqual(Buffer.from(left), Buffer.from(right), message);
export const otherDigest = 'sha256:' + 'f'.repeat(64);
export const throwsCode = (assert, fn, code, stage) => assert.throws(fn,
  error => error.code === 'MO1307_' + code && (stage === undefined || error.stage === stage));
export function evaluateBundle(name) {
  const bundle = loadBundle(name), input = inputOf(bundle), verified = verifyEvidence(input);
  const adapted = adaptVerifiedEvidence(verified), computed = computeReadiness(adapted);
  return { bundle, input, verified, adapted, computed };
}
export function verifyInput(input, resultBytes, decisionBytes = null) {
  return { ...input, resultBytes: Uint8Array.from(resultBytes), decisionBytes };
}
export function decisionFor(result, decision = 'APPROVE') {
  return { kind: 'MemoryOSReadinessHumanDecision', version: '1.0.0',
    candidateDigest: result.assessment.candidateDigest, readinessDigest: result.readinessDigest,
    proofBindingDigest: result.proofBindingDigest, decision,
    authenticity: 'NOT_VERIFIED_BY_MEMORYOS', actor: null, attestation: null,
    reason: 'Engineering binding control; no human release authorization.', timestamp: null };
}
export function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).reverse()
    .map(key => [key, reverseObjectKeys(value[key])]));
  return value;
}
export function vectorRecord(name, evaluated = evaluateBundle(name)) {
  const { computed, verified } = evaluated, a = computed.result.assessment;
  return { name, readiness: a.readiness, exit: computed.exitCode, gates: a.gates.length,
    blockers: a.blockers.length, cne: a.cneReasons.length, qualifications: a.qualifications.length,
    history: a.history.length, providers: a.providers.length, candidateDigest: a.candidateDigest,
    graphDigest: a.graphDigest, graphNodes: a.graph.nodes.length, graphEdges: a.graph.edges.length,
    readinessDigest: computed.readinessDigest, proofBindingDigest: computed.proofBindingDigest,
    result: { byteLength: computed.resultBytes.length, sha256: digest(computed.resultBytes) },
    authorityIdentityDigest: a.authorityIdentityDigest, trustedAuthorityDigest: verified.audit.trustedAuthorityDigest,
    exactExpectedResult: Buffer.from(computed.resultBytes).equals(canonicalBytes(evaluated.bundle.result)),
    resultScope: 'ACTUAL_2B_VERIFICATION_TO_2A_COMPUTATION_VIA_ACCEPTED_2C_ADAPTER' };
}
