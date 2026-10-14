import { referenceSnapshot } from "../web/data/studio-snapshot.js";
import { MemoryOS } from "../web/js/memoryos-sdk.js";

const encode = (value) => new TextEncoder().encode(JSON.stringify(value));
const memory = new MemoryOS();

const policyValue = {
  identifier: "p",
  kind: "MemoryOSInvestigationPolicy",
  policyVersion: "1.0.0",
  rules: [{
    identifier: "r",
    parameters: {},
    type: "memoryos.require-verification-completed",
    version: "1.0.0",
  }],
  version: "1.0.0",
};
const preparedPolicy = memory.preparePolicy(encode(policyValue));

const policySetValue = {
  identifier: "s",
  kind: "MemoryOSInvestigationPolicySet",
  policies: [{
    expectedSemanticDigest: preparedPolicy.semanticDigest,
    policy: policyValue,
  }],
  policySetVersion: "1.0.0",
  version: "1.0.0",
};
const preparedPolicySet = memory.preparePolicySet(encode(policySetValue));

const workspace = memory.openWorkspace(referenceSnapshot.workspaceIdentifier);
const baseline = memory.observe(workspace, structuredClone(referenceSnapshot), {
  identifier: "policy-example-baseline",
});
const changed = structuredClone(referenceSnapshot);
changed.observationIdentifier = "policy-example-candidate-observation";
changed.longTermMemory.entries[0].value = "A deterministic candidate change.";
const candidate = memory.observe(workspace, changed, {
  identifier: "policy-example-candidate",
});

const captured = memory.captureRegressionPolicyFacts(baseline, candidate);
const evaluation = memory.evaluatePolicy(
  preparedPolicy,
  captured.policyFactContext,
  { regressionSource: captured.regressionPolicyFactSource },
);
const setEvaluation = memory.evaluatePolicySet(
  preparedPolicySet,
  captured.policyFactContext,
  { regressionSource: captured.regressionPolicyFactSource },
);

// Serialization retains canonical bytes, but never production authority.
const contextInspection = memory.inspectPolicyFactContext(
  captured.policyFactContext.toBytes(),
  { expectedContextDigest: captured.policyFactContext.contextDigest },
);
const sourceInspection = memory.inspectRegressionPolicyFactSource(
  captured.regressionPolicyFactSource.toBytes(),
  { expectedSourceDigest: captured.regressionPolicyFactSource.sourceDigest },
);
const detachedReport = memory.regression(baseline, candidate);
const reportInspection = memory.inspectRegressionReport(encode(detachedReport));

const identityVerification = memory.verifyEvaluationIdentityArtifact(
  evaluation.evaluationIdentityBytes(),
  evaluation.evaluationIdentityDigest,
);
const outcomeVerification = memory.verifyPolicyEvaluationOutcomeArtifact(
  evaluation.canonicalOutcomeBytes(),
  {
    expectedEvaluationIdentityDigest: evaluation.evaluationIdentityDigest,
    expectedOutcomeDigest: evaluation.outcomeDigest,
  },
);

console.log(JSON.stringify({
  contractIdentities: memory.policyContractIdentities(),
  policy: {
    documentDigest: preparedPolicy.documentDigest,
    semanticDigest: preparedPolicy.semanticDigest,
  },
  policySet: {
    documentDigest: preparedPolicySet.documentDigest,
    semanticDigest: preparedPolicySet.semanticDigest,
  },
  evaluation: {
    decision: evaluation.decision,
    evaluationIdentityDigest: evaluation.evaluationIdentityDigest,
    outcomeDigest: evaluation.outcomeDigest,
  },
  setDecision: setEvaluation.decision,
  inspections: {
    contextAuthority: contextInspection.authority,
    regressionSourceAuthority: sourceInspection.authority,
    reportAuthority: reportInspection.authority,
  },
  verification: {
    identity: identityVerification.verified,
    outcome: outcomeVerification.verified,
  },
}, null, 2));
