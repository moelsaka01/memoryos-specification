import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { PACKAGE_ROOT, contractIdentityPin, verifyRuntime } from './integrity.mjs';
import { decodeBase64, names, validateInput } from './contracts.mjs';
import { J } from './deterministic.mjs';
import { adapterError, IntegrityError, memoryosError } from './errors.mjs';

export async function execute(name, args) {
  if (!validateInput(name, args)) return adapterError('MO1304_INVALID_TOOL_INPUT', 'input');
  let sdk;
  let mip;
  try {
    await verifyRuntime();
    const pin = await contractIdentityPin();
    sdk = await import(pathToFileURL(resolve(PACKAGE_ROOT, 'runtime/authoritative/web/js/memoryos-sdk.js')).href);
    mip = await import(pathToFileURL(resolve(PACKAGE_ROOT, 'runtime/authoritative/web/js/memory-investigation-package.js')).href);
    if (sdk.MEMORYOS_SDK_VERSION !== '1.1.0') throw new IntegrityError();
    const memory = new sdk.MemoryOS();
    const identities = memory.policyContractIdentities();
    if (J(identities) !== J(pin)) throw new IntegrityError();
    let product;
    if (name === names[0]) product = { status: 'ok', identities };
    else if (name === names[2] || name === names[3]) {
      const prepared = name === names[2]
        ? memory.preparePolicy(decodeBase64(args.policyBase64, 2048))
        : memory.preparePolicySet(decodeBase64(args.policySetBase64, 4096));
      product = { status: 'ok', artifactKind: prepared.kind, artifactVersion: prepared.version,
        canonicalArtifactBase64: Buffer.from(prepared.toBytes()).toString('base64'),
        documentDigest: prepared.documentDigest, semanticDigest: prepared.semanticDigest };
    } else if (name === names[1]) {
      const policy = args.artifactKind === 'policy';
      const prepared = policy ? memory.preparePolicy(decodeBase64(args.artifactBase64, 2048))
        : memory.preparePolicySet(decodeBase64(args.artifactBase64, 4096));
      const investigation = memory.importPackage(decodeBase64(args.candidateMipBase64, 524288), {
        identifier: 'memoryos-policy-evaluation-candidate',
      });
      const context = memory.capturePolicyFactContext(investigation);
      const evaluation = policy ? memory.evaluatePolicy(prepared, context, {}) : memory.evaluatePolicySet(prepared, context, {});
      const identityBytes = evaluation.evaluationIdentityBytes();
      const outcomeBytes = evaluation.canonicalOutcomeBytes();
      memory.verifyEvaluationIdentityArtifact(identityBytes, evaluation.evaluationIdentityDigest);
      memory.verifyPolicyEvaluationOutcomeArtifact(outcomeBytes, {
        expectedEvaluationIdentityDigest: evaluation.evaluationIdentityDigest, expectedOutcomeDigest: evaluation.outcomeDigest,
      });
      product = { status: 'ok', artifactKind: prepared.kind, semanticDigest: prepared.semanticDigest,
        decision: evaluation.decision, evaluationIdentityBase64: Buffer.from(identityBytes).toString('base64'),
        evaluationIdentityDigest: evaluation.evaluationIdentityDigest, outcomeBase64: Buffer.from(outcomeBytes).toString('base64'),
        outcomeDigest: evaluation.outcomeDigest };
    } else {
      const verification = name === names[4]
        ? memory.verifyEvaluationIdentityArtifact(decodeBase64(args.evaluationIdentityBase64, 4060), args.expectedEvaluationIdentityDigest)
        : memory.verifyPolicyEvaluationOutcomeArtifact(decodeBase64(args.outcomeBase64, 4060), {
          expectedEvaluationIdentityDigest: args.expectedEvaluationIdentityDigest, expectedOutcomeDigest: args.expectedOutcomeDigest,
        });
      product = { status: 'ok', artifactKind: verification.artifactKind, artifactVersion: verification.artifactVersion,
        verified: verification.verified, authority: verification.authority, verificationScope: verification.verificationScope,
        evaluationIdentityDigest: verification.evaluationIdentityDigest,
        ...(name === names[5] ? { decision: verification.decision, outcomeDigest: verification.outcomeDigest } : {}) };
    }
    await verifyRuntime();
    return product;
  } catch (error) {
    if (error instanceof IntegrityError || !sdk || !mip) return adapterError('MO1304_RUNTIME_INTEGRITY', 'integrity');
    return memoryosError(error, { ...sdk, ...mip });
  }
}
