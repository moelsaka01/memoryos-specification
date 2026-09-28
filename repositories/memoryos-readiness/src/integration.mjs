import { DEFINITIONS } from './constants.mjs';
import { parseCanonical } from './canonical.mjs';
import { inspectFoundationInputs, checkDecisionBinding } from './foundation.mjs';
import { fail, ReadinessError } from './errors.mjs';
import { verifyEvidence, verifyResultEvidence } from './evidence-verifier.mjs';
import { computeReadiness } from './readiness-core.mjs';

// Fixed accepted authority and computation modules execute inside the existing
// isolated worker. Neither public input nor environment selects an implementation.

// Exact closed 2B -> 2A handoff. This adapter confers no authority by itself.
export function adaptVerifiedEvidence({ projection: p, audit }) {
  return { candidate: p.candidate, candidateDigest: p.candidateDigest, profile: p.profile,
    stage: p.stage, scopeId: p.normalizedAuthority.scopeId,
    authorityIdentityDigest: p.authorityIdentityDigest, slots: p.normalizedAuthority.slots,
    claims: p.claims, graph: p.graph, graphDigest: p.graphDigest, audit };
}

export function evidenceInput(input) {
  const { configurationBytes, candidateBytes, manifestBytes, authorityBytes, files,
    expectedCandidateDigest, trustedAuthorityDigest } = input;
  return { configurationBytes, candidateBytes, manifestBytes, authorityBytes, files,
    expectedCandidateDigest, trustedAuthorityDigest };
}

export function verifyDecisionBytes(bytes, result) {
  if (bytes === null) return null;
  try {
    return checkDecisionBinding(parseCanonical(bytes, { maxBytes: DEFINITIONS.limits.decisionBytes,
      stage: 'VERIFICATION', reference: 'decision' }), result);
  } catch (error) {
    if (error?.code === 'MO1307_RESOURCE_LIMIT') throw error;
    fail('DECISION_MISMATCH', 'VERIFICATION', 'decision');
  }
}

export function assessInWorker(input, verify) {
  let deferredSemanticFailure = null;
  try { inspectFoundationInputs(input, verify); }
  catch (error) {
    // Preserve closed byte admission (including supplied result/decision caps),
    // while 2B owns earlier authority/graph diagnosis for rejected semantics.
    // Its failure-only diagnosis can replace rejection, never admit evidence.
    if (!(error instanceof ReadinessError) || error.stage !== 'EVALUATION') throw error;
    deferredSemanticFailure = error;
  }
  const original = evidenceInput(input);
  const verified = verify ? verifyResultEvidence(original, input.resultBytes) : verifyEvidence(original);
  if (deferredSemanticFailure) throw deferredSemanticFailure;
  const computed = computeReadiness(adaptVerifiedEvidence(verified));
  if (verify && !Buffer.from(input.resultBytes).equals(Buffer.from(computed.resultBytes))) fail('RESULT_MISMATCH', 'VERIFICATION', 'result');
  const value = { resultBytes: Uint8Array.from(computed.resultBytes), readinessDigest: computed.readinessDigest,
    proofBindingDigest: computed.proofBindingDigest };
  if (verify) value.decision = verifyDecisionBytes(input.decisionBytes, computed.result);
  return value;
}
