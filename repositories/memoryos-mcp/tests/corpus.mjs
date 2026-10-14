import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PACKAGE_ROOT } from '../src/integrity.mjs';
import { MemoryOS } from '../runtime/authoritative/web/js/memoryos-sdk.js';
import { computeMipIntegrity } from '../runtime/authoritative/web/js/memory-investigation-package.js';
import { canonicalize, utf8Encode } from '../runtime/authoritative/web/js/mip-canonical.js';
import { canonicalizeRestrictedJson } from '../runtime/authoritative/web/js/policy-canonical.js';

import { referenceSnapshot } from '../../cca-studio/web/data/studio-snapshot.js';
import { InvestigationCore } from '../runtime/authoritative/web/js/investigation-core.js';
import { capturePolicyFactContextAndRegressionSource } from '../runtime/authoritative/web/js/policy-fact-context.js';
import { createInvestigationPolicyEvaluator, evaluateInvestigationPolicy } from '../runtime/authoritative/web/js/investigation-policy-engine.js';
import { prepareInvestigationPolicy, prepareInvestigationPolicySet } from '../runtime/authoritative/web/js/investigation-policy.js';

const workspace = resolve(PACKAGE_ROOT, '../..');
const fixtureRoot = resolve(workspace, 'repositories/cca-studio/tests/fixtures');
export const b64 = (bytes) => Buffer.from(bytes).toString('base64');
export async function fixtures() {
  const result = {};
  for (const kind of ['pass', 'fail', 'cne']) result[kind] = await readFile(resolve(workspace,
    `repositories/cca-conformance/tests/fixtures/github-policy-gate/1.0.0/hosted/${kind}.memoryos-policy.json`));
  result.mip = Buffer.from((await readFile(resolve(fixtureRoot, 'mip/minimal-observation.mip.b64'), 'ascii')).trim(), 'base64');
  const memory = new MemoryOS();
  const policy = JSON.parse(result.pass);
  result.set = Buffer.from(canonicalizeRestrictedJson({ identifier: 's', kind: 'MemoryOSInvestigationPolicySet',
    version: '1.0.0', policySetVersion: '1.0.0', policies: [{ policy, expectedSemanticDigest: memory.preparePolicy(result.pass).semanticDigest }] }));
  result.golden = JSON.parse(await readFile(resolve(fixtureRoot, 'investigation-policy/1.0.0/final-evaluation-identity-outcome-golden-vectors.json'))).records;
  return result;
}
export async function maximalMip(size = 524288) {
  const base = JSON.parse((await fixtures()).mip);
  function render(length) {
    const value = structuredClone(base);
    value.extensions['org.memoryos.measurement.padding'] = { critical: false, payload: { padding: 'a'.repeat(length) }, version: '1.0.0' };
    value.manifest.features.optional = [...value.manifest.features.optional, 'org.memoryos.measurement.padding'].sort();
    value.integrity = computeMipIntegrity(value);
    return Buffer.from(utf8Encode(canonicalize(value)));
  }
  const bytes = render(size - render(0).length);
  if (bytes.length !== size) throw new Error('MIP_BOUNDARY');
  return bytes;
}
export async function measurementCorpus() {
  const fixture = await fixtures();
  const memory = new MemoryOS();
  const selected = { policy: fixture.pass, policySet: fixture.set };
  const evaluations = { policy: fixture.pass, policySet: fixture.set };
  const context = memory.capturePolicyFactContext(memory.importPackage(fixture.mip, { identifier: 'memoryos-policy-evaluation-candidate' }));
  const candidates = [];
  const carrierRoot = resolve(fixtureRoot, 'investigation-policy/1.0.0/boundary-carriers');
  for (const name of (await readdir(carrierRoot)).sort()) {
    const bytes = await readFile(resolve(carrierRoot, name));
    for (const [kind, maximum] of [['policy', 1024], ['policySet', 2048]]) {
      try {
        const prepared = kind === 'policy' ? memory.preparePolicy(bytes) : memory.preparePolicySet(bytes);
        const canonical = Buffer.from(prepared.toBytes());
        if (canonical.length > selected[kind].length && canonical.length <= maximum) selected[kind] = canonical;
        try {
          if (kind === 'policy') memory.evaluatePolicy(prepared, context, {});
          else memory.evaluatePolicySet(prepared, context, {});
          if (canonical.length > evaluations[kind].length) evaluations[kind] = canonical;
        } catch { /* Preparation and evaluation have distinct authoritative resource bounds. */ }
      } catch { /* Invalid boundary carriers are negative witnesses, never valid measurements. */ }
    }
  }
  const mip = await maximalMip();
  if (!memory.verifyPackage(mip).valid) throw new Error('MIP_BOUNDARY_INVALID');
  const { identity, outcome } = maximumVerificationArtifacts();
  candidates.push({ label: 'identities', name: 'memoryos_contract_identities', args: {} });
  for (const [kind, maximum, tool, field] of [['policy', 1024, 'memoryos_prepare_policy', 'policyBase64'],
    ['policySet', 2048, 'memoryos_prepare_policy_set', 'policySetBase64']]) {
    const bytes = selected[kind];
    const padded = Buffer.concat([Buffer.alloc(maximum - bytes.length, 32), bytes]);
    candidates.push({ label: `prepare-${kind}`, name: tool, args: { [field]: b64(padded) } });
    candidates.push({ label: `evaluate-${kind}`, name: 'memoryos_evaluate_policy', args: {
      artifactKind: kind, artifactBase64: b64(Buffer.concat([Buffer.alloc(maximum - evaluations[kind].length, 32), evaluations[kind]])), candidateMipBase64: b64(mip),
    } });
  }
  candidates.push({ label: 'verify-identity', name: 'memoryos_verify_evaluation_identity', args: {
    evaluationIdentityBase64: b64(Buffer.from(identity.canonicalIdentityBytes)), expectedEvaluationIdentityDigest: identity.evaluationIdentityDigest,
  } });
  candidates.push({ label: 'verify-outcome', name: 'memoryos_verify_policy_outcome', args: {
    outcomeBase64: b64(Buffer.from(outcome.canonicalOutcomeBytes)), expectedEvaluationIdentityDigest: outcome.evaluationIdentityDigest,
    expectedOutcomeDigest: outcome.outcomeDigest,
  } });
  return candidates;
}

// Reproduce the authoritative MO-1301 limit-31 maximum witness. Regression is
// used only to construct serialized verification fixtures, never evaluation inputs.
export function maximumVerificationArtifacts() {
  const core = new InvestigationCore();
  const baseline = 'mo1301-authoritative-verification-baseline';
  const candidate = 'mo1301-authoritative-verification-candidate';
  core.create({ identifier: baseline, snapshot: structuredClone(referenceSnapshot) });
  core.create({ identifier: candidate, snapshot: structuredClone(referenceSnapshot) });
  core.verify(candidate);
  const captured = capturePolicyFactContextAndRegressionSource(core, baseline, candidate);
  const policies = ['a', 'b', 'c', 'd'].map((letter, index) => ({
    identifier: `p${letter}`, kind: 'MemoryOSInvestigationPolicy', policyVersion: '0.0.0', version: '1.0.0',
    rules: [{ identifier: `r${letter}`, parameters: {}, version: '1.0.0',
      type: index < 2 ? 'memoryos.require-mip-integrity' : 'memoryos.require-verification-completed' }],
  }));
  const prepared = prepareInvestigationPolicySet(canonicalizeRestrictedJson({
    identifier: 'ss', kind: 'MemoryOSInvestigationPolicySet', policySetVersion: '0.0.0', version: '1.0.0',
    policies: policies.map(policy => ({ policy, expectedSemanticDigest:
      prepareInvestigationPolicy(canonicalizeRestrictedJson(policy)).semanticDigest })),
  }));
  const result = evaluateInvestigationPolicy(createInvestigationPolicyEvaluator(core), prepared,
    captured.policyFactContext, [captured.regressionPolicyFactSource]);
  const identityBytes = result.evaluationIdentityBytes();
  const outcomeBytes = result.canonicalOutcomeBytes();
  if (identityBytes.length !== 1186 || outcomeBytes.length !== 4060) throw new Error('MAXIMUM_ARTIFACT_WITNESS');
  const memory = new MemoryOS();
  memory.verifyEvaluationIdentityArtifact(identityBytes, result.evaluationIdentityDigest);
  memory.verifyPolicyEvaluationOutcomeArtifact(outcomeBytes, { expectedEvaluationIdentityDigest: result.evaluationIdentityDigest,
    expectedOutcomeDigest: result.outcomeDigest });
  return { identity: { canonicalIdentityBytes: identityBytes, evaluationIdentityDigest: result.evaluationIdentityDigest },
    outcome: { canonicalOutcomeBytes: outcomeBytes, evaluationIdentityDigest: result.evaluationIdentityDigest, outcomeDigest: result.outcomeDigest } };
}
