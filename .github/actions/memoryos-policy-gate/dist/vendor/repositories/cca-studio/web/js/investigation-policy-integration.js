import {
  MEMORYOS_POLICY_RESOURCE_PROFILE,
  MEMORYOS_POLICY_RESOURCE_PROFILE_DIGEST,
  MACHINE_DEFINITION_IDENTITIES,
} from "./investigation-policy-contracts.js";
import {
  POLICY_EVALUATION_IDENTITY_DIGEST_DOMAIN,
  POLICY_EVALUATION_IDENTITY_KIND,
  POLICY_EVALUATION_OUTCOME_DIGEST_DOMAIN,
  POLICY_EVALUATION_OUTCOME_KIND,
  POLICY_EVALUATOR_VERSION,
  POLICY_OUTCOME_CONTRACT_VERSION,
  MemoryOSPolicyEvaluationInvariantError,
  createInvestigationPolicyEvaluator,
  evaluateInvestigationPolicy,
  policyEvaluationIdentityDigest,
  policyEvaluationOutcomeDigest,
  validateEvaluationIdentity,
  validatePolicyEvaluationOutcome,
} from "./investigation-policy-engine.js";
import {
  INVESTIGATION_POLICY_KIND,
  INVESTIGATION_POLICY_SET_KIND,
  prepareInvestigationPolicy,
  prepareInvestigationPolicySet,
} from "./investigation-policy.js";
import {
  capturePolicyFactContext as captureCorePolicyFactContext,
  capturePolicyFactContextAndRegressionSource,
  policyFactContextCanonicalBytes,
  preparePolicyFactContext,
} from "./policy-fact-context.js";
import {
  DETERMINISTIC_FACT_SOURCE_REGISTRY,
  DETERMINISTIC_FACT_SOURCE_REGISTRY_DIGEST,
  DETERMINISTIC_FACT_SOURCE_REGISTRY_VERSION,
  REGRESSION_POLICY_FACT_SOURCE_DOMAIN,
  REGRESSION_POLICY_FACT_SOURCE_MODEL_DIGEST,
  REGRESSION_POLICY_FACT_SOURCE_MODEL_VERSION,
  REGRESSION_POLICY_FACT_SOURCE_VERSION,
  cognitiveRegressionReportIdentifier,
  parseDetachedCognitiveRegressionReport,
  prepareRegressionPolicyFactSource,
  regressionPolicyFactSourceCanonicalBytes,
} from "./regression-policy-fact-source.js";
import {
  MemoryOSPolicyError,
  canonicalizeRestrictedJson,
  domainSeparatedDigest,
  parseRestrictedJson,
  toUint8Array,
} from "./policy-canonical.js";

const IntrinsicString = String;
const IntrinsicTypeError = TypeError;
const IntrinsicUint8Array = Uint8Array;
const intrinsicArrayIsArray = Array.isArray;
const intrinsicObjectAssign = Object.assign;
const intrinsicObjectFreeze = Object.freeze;
const intrinsicObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicObjectGetPrototypeOf = Object.getPrototypeOf;
const intrinsicObjectIsFrozen = Object.isFrozen;
const intrinsicObjectKeys = Object.keys;
const intrinsicObjectValues = Object.values;
const intrinsicReflectApply = Reflect.apply;
const intrinsicStringIncludes = String.prototype.includes;
const intrinsicStringStartsWith = String.prototype.startsWith;
const intrinsicWeakMapGet = WeakMap.prototype.get;
const intrinsicWeakMapSet = WeakMap.prototype.set;
const typedArrayPrototype = intrinsicObjectGetPrototypeOf(IntrinsicUint8Array.prototype);
const typedArrayTagGetter = intrinsicObjectGetOwnPropertyDescriptor(
  typedArrayPrototype,
  Symbol.toStringTag,
).get;

const PRIVATE = Symbol("MemoryOS Policy integration private construction");
const preparedCapabilities = new WeakMap();
const contextCapabilities = new WeakMap();
const sourceCapabilities = new WeakMap();
const evaluationValues = new WeakMap();
const byteValues = new WeakMap();

const FACT_MODEL_IDENTITY = MACHINE_DEFINITION_IDENTITIES.find(
  ({ identityName }) => identityName === "factModelDigest",
);
const RULE_REGISTRY_IDENTITY = MACHINE_DEFINITION_IDENTITIES.find(
  ({ identityName }) => identityName === "ruleRegistryDigest",
);

function copyBytes(value) {
  return toUint8Array(value, "MemoryOS Policy canonical bytes");
}

function isUint8Array(value) {
  try {
    return intrinsicReflectApply(typedArrayTagGetter, value, []) === "Uint8Array";
  } catch {
    return false;
  }
}

function weakMapGet(map, key) {
  return intrinsicReflectApply(intrinsicWeakMapGet, map, [key]);
}

function weakMapSet(map, key, value) {
  intrinsicReflectApply(intrinsicWeakMapSet, map, [key, value]);
}

function requireBytes(value, label) {
  if (!isUint8Array(value)) throw new IntrinsicTypeError(`${label} must be a Uint8Array.`);
  return copyBytes(value);
}

function requireObject(value, label) {
  if (value === null || typeof value !== "object" || intrinsicArrayIsArray(value)) {
    throw new IntrinsicTypeError(`${label} must be an object.`);
  }
  return value;
}

function exactOptions(value, names, label) {
  const options = requireObject(value ?? {}, label);
  const optionNames = intrinsicObjectKeys(options);
  for (let index = 0; index < optionNames.length; index += 1) {
    const optionName = optionNames[index];
    let supported = false;
    for (let allowedIndex = 0; allowedIndex < names.length; allowedIndex += 1) {
      if (optionName === names[allowedIndex]) {
        supported = true;
        break;
      }
    }
    if (!supported) {
      throw new IntrinsicTypeError(`${label} contains unsupported member '${optionName}'.`);
    }
  }
  return options;
}

function byteEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || intrinsicObjectIsFrozen(value)) return value;
  const children = intrinsicObjectValues(value);
  for (let index = 0; index < children.length; index += 1) deepFreeze(children[index]);
  return intrinsicObjectFreeze(value);
}

function normalizePhase(error) {
  if (error?.phase === "policyArtifact") return "policyArtifact";
  if (error?.phase === "policyFactContext") return "policyFactContext";
  if (error?.artifactKind === "MemoryOSCognitiveRegressionReport") return "regressionReport";
  if (error?.phase === "deterministicFactSource") return "regressionPolicyFactSource";
  if (error?.phase === "policyEvaluation") return "evaluationInput";
  if (error?.phase === "policyEvaluationIdentity") return "evaluationIdentity";
  if (error?.phase === "policyEvaluationOutcome") return "evaluationOutcome";
  return "evaluationInput";
}

export class MemoryOSPolicyPreparationError extends Error {
  constructor(error) {
    super(IntrinsicString(error?.message ?? "MemoryOS Policy artifact preparation failed."));
    this.name = "MemoryOSPolicyPreparationError";
    this.code = IntrinsicString(error.code);
    this.phase = normalizePhase(error);
    this.artifactKind = error.artifactKind ?? null;
    this.limitIdentifier = error.limitIdentifier ?? null;
    this.failureClass = "preparation";
    this.details = intrinsicObjectFreeze(error.details === undefined ? [] : [error.details]);
    intrinsicObjectFreeze(this);
  }
}

export class MemoryOSPolicyOperationalError extends Error {
  constructor(operation, message, options = {}) {
    super(IntrinsicString(message));
    this.name = "MemoryOSPolicyOperationalError";
    this.operation = IntrinsicString(operation);
    this.code = IntrinsicString(options.code ?? "POLICY_OPERATIONAL_FAILURE");
    this.phase = options.phase ?? null;
    this.artifactKind = options.artifactKind ?? null;
    this.limitIdentifier = options.limitIdentifier ?? null;
    this.failureClass = "operational";
    this.verificationFailure = options.verificationFailure === true;
    this.details = intrinsicObjectFreeze([...(options.details ?? [])]);
    intrinsicObjectFreeze(this);
  }
}

function translate(operation, callback) {
  try {
    return callback();
  } catch (error) {
    if (error instanceof IntrinsicTypeError) throw error;
    if (error instanceof MemoryOSPolicyPreparationError
        || error instanceof MemoryOSPolicyOperationalError) throw error;
    if (error instanceof MemoryOSPolicyError) throw new MemoryOSPolicyPreparationError(error);
    const verificationFailure = intrinsicReflectApply(
      intrinsicStringStartsWith,
      operation,
      ["verify"],
    ) || intrinsicReflectApply(intrinsicStringStartsWith, operation, ["inspectEvaluation"]);
    throw new MemoryOSPolicyOperationalError(
      operation,
      error?.message ?? "MemoryOS Policy integration failed.",
      {
        code: verificationFailure ? "VERIFICATION_FAILED" : "POLICY_OPERATIONAL_FAILURE",
        phase: intrinsicReflectApply(intrinsicStringIncludes, operation, ["Outcome"])
          ? "evaluationOutcome"
          : intrinsicReflectApply(intrinsicStringIncludes, operation, ["Identity"])
            ? "evaluationIdentity" : null,
        verificationFailure,
      },
    );
  }
}

class CanonicalByteValue {
  constructor(token, bytes) {
    if (token !== PRIVATE) {
      throw new IntrinsicTypeError("Canonical Policy values are SDK-created.");
    }
    weakMapSet(byteValues, this, copyBytes(bytes));
  }

  toBytes() {
    return copyBytes(weakMapGet(byteValues, this));
  }
}

export class MemoryOSPreparedPolicy extends CanonicalByteValue {
  constructor(token, owner, capability) {
    super(token, capability.canonicalBytes());
    weakMapSet(preparedCapabilities, this, intrinsicObjectFreeze({ capability, owner }));
    this.kind = capability.kind;
    this.version = capability.version;
    this.identifier = capability.identifier;
    this.artifact = capability.artifact;
    this.semanticProjection = capability.semanticProjection;
    this.documentDigest = capability.documentDigest;
    this.semanticDigest = capability.semanticDigest;
    intrinsicObjectFreeze(this);
  }
}

export class MemoryOSPolicyFactContextInspection extends CanonicalByteValue {
  constructor(token, capability) {
    super(token, policyFactContextCanonicalBytes(capability));
    this.kind = capability.artifact.kind;
    this.version = capability.artifact.version;
    this.artifact = capability.artifact;
    this.factModelVersion = capability.artifact.factModelVersion;
    this.contextDigest = capability.contextDigest;
    this.authority = "inspectionOnly";
    intrinsicObjectFreeze(this);
  }
}

export class MemoryOSAuthoritativePolicyFactContext extends CanonicalByteValue {
  constructor(token, owner, capability) {
    super(token, policyFactContextCanonicalBytes(capability));
    weakMapSet(contextCapabilities, this, intrinsicObjectFreeze({ capability, owner }));
    this.kind = capability.artifact.kind;
    this.version = capability.artifact.version;
    this.artifact = capability.artifact;
    this.factModelVersion = capability.artifact.factModelVersion;
    this.contextDigest = capability.contextDigest;
    intrinsicObjectFreeze(this);
  }
}

export class MemoryOSRegressionPolicyFactSourceInspection extends CanonicalByteValue {
  constructor(token, capability) {
    super(token, regressionPolicyFactSourceCanonicalBytes(capability));
    this.kind = capability.artifact.kind;
    this.version = capability.artifact.version;
    this.artifact = capability.artifact;
    this.domain = capability.domain;
    this.sourceModelVersion = capability.artifact.sourceModelVersion;
    this.sourceDigest = capability.sourceDigest;
    this.authority = "inspectionOnly";
    intrinsicObjectFreeze(this);
  }
}

export class MemoryOSAuthoritativeRegressionPolicyFactSource extends CanonicalByteValue {
  constructor(token, owner, capability, context) {
    super(token, regressionPolicyFactSourceCanonicalBytes(capability));
    weakMapSet(sourceCapabilities, this, intrinsicObjectFreeze({ capability, context, owner }));
    this.kind = capability.artifact.kind;
    this.version = capability.artifact.version;
    this.artifact = capability.artifact;
    this.domain = capability.domain;
    this.sourceModelVersion = capability.artifact.sourceModelVersion;
    this.sourceDigest = capability.sourceDigest;
    intrinsicObjectFreeze(this);
  }
}

export class MemoryOSRegressionReportInspection extends CanonicalByteValue {
  constructor(token, report) {
    super(token, canonicalizeRestrictedJson(report));
    this.kind = report.kind;
    this.version = report.version;
    this.artifact = report;
    this.reportIdentifier = cognitiveRegressionReportIdentifier(report);
    this.authority = "inspectionOnly";
    intrinsicObjectFreeze(this);
  }
}

export class MemoryOSAuthoritativeRegressionPolicyFacts {
  constructor(token, context, source) {
    if (token !== PRIVATE) {
      throw new IntrinsicTypeError("Regression Policy facts are SDK-created.");
    }
    this.policyFactContext = context;
    this.regressionPolicyFactSource = source;
    intrinsicObjectFreeze(this);
  }
}

export class MemoryOSPolicyEvaluation {
  constructor(token, owner, evaluation) {
    if (token !== PRIVATE) {
      throw new IntrinsicTypeError("Policy evaluations are SDK-created.");
    }
    const identityBytes = evaluation.evaluationIdentityBytes();
    const outcomeBytes = evaluation.canonicalOutcomeBytes();
    weakMapSet(evaluationValues, this, intrinsicObjectFreeze({
      evaluation,
      identityBytes: copyBytes(identityBytes),
      outcomeBytes: copyBytes(outcomeBytes),
      owner,
    }));
    this.evaluationIdentity = evaluation.evaluationIdentity;
    this.evaluationIdentityDigest = evaluation.evaluationIdentityDigest;
    this.outcome = evaluation.outcome;
    this.outcomeDigest = evaluation.outcomeDigest;
    this.decision = evaluation.outcome.result.decision;
    this.cacheDisposition = evaluation.cacheDisposition;
    intrinsicObjectFreeze(this);
  }

  evaluationIdentityBytes() {
    return copyBytes(weakMapGet(evaluationValues, this).identityBytes);
  }

  canonicalOutcomeBytes() {
    return copyBytes(weakMapGet(evaluationValues, this).outcomeBytes);
  }

  toBytes() {
    return this.canonicalOutcomeBytes();
  }
}

export class MemoryOSPolicyArtifactVerification {
  constructor(token, value, bytes) {
    if (token !== PRIVATE) {
      throw new IntrinsicTypeError("Policy verification results are SDK-created.");
    }
    weakMapSet(byteValues, this, copyBytes(bytes));
    intrinsicReflectApply(intrinsicObjectAssign, Object, [this, value]);
    intrinsicObjectFreeze(this);
  }

  toBytes() {
    return copyBytes(weakMapGet(byteValues, this));
  }
}

function unwrapPrepared(value, owner, kind) {
  const retained = weakMapGet(preparedCapabilities, value);
  if (!retained || retained.capability.kind !== kind) {
    throw new IntrinsicTypeError(`A prepared ${kind} is required.`);
  }
  return retained.capability;
}

function unwrapContext(value, owner) {
  const retained = weakMapGet(contextCapabilities, value);
  if (!retained || retained.owner !== owner) {
    throw new MemoryOSPolicyPreparationError(new MemoryOSPolicyError(
      "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
      "PolicyFactContext is not authoritative for this MemoryOS instance.",
      { artifactKind: "MemoryOSPolicyFactContext", phase: "policyFactContext" },
    ));
  }
  return retained.capability;
}

function unwrapSource(value, owner, context) {
  const retained = weakMapGet(sourceCapabilities, value);
  if (!retained || retained.owner !== owner) {
    throw new MemoryOSPolicyPreparationError(new MemoryOSPolicyError(
      "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
      "Regression source is not authoritative for this MemoryOS instance.",
      { artifactKind: "MemoryOSRegressionPolicyFactSource", phase: "deterministicFactSource" },
    ));
  }
  if (retained.context !== context) {
    throw new MemoryOSPolicyPreparationError(new MemoryOSPolicyError(
      "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH",
      "Regression source is not bound to this candidate context capability.",
      { artifactKind: "MemoryOSRegressionPolicyFactSource", phase: "deterministicFactSource" },
    ));
  }
  return retained.capability;
}

function parsedCanonicalArtifact(bytes, label) {
  const input = requireBytes(bytes, label);
  const value = parseRestrictedJson(input);
  const canonical = canonicalizeRestrictedJson(value);
  if (!byteEqual(input, canonical)) {
    throw new MemoryOSPolicyOperationalError(
      `inspect${label}`,
      `${label} bytes are not the exact canonical representation.`,
      { code: "VERIFICATION_FAILED", verificationFailure: true },
    );
  }
  return { bytes: input, value };
}

function contractIdentities() {
  return deepFreeze({
    kind: "MemoryOSPolicyContractIdentities",
    version: "1.0.0",
    evaluatorVersion: POLICY_EVALUATOR_VERSION,
    factModel: {
      factModelVersion: FACT_MODEL_IDENTITY.expectedVersions.factModelVersion,
      factModelDigest: FACT_MODEL_IDENTITY.normativeDigest,
    },
    ruleRegistry: {
      ruleRegistryVersion: RULE_REGISTRY_IDENTITY.expectedVersions.ruleRegistryVersion,
      ruleRegistryDigest: RULE_REGISTRY_IDENTITY.normativeDigest,
    },
    deterministicFactSourceRegistry: {
      registryVersion: DETERMINISTIC_FACT_SOURCE_REGISTRY_VERSION,
      registryDigest: DETERMINISTIC_FACT_SOURCE_REGISTRY_DIGEST,
      sources: [{
        domain: REGRESSION_POLICY_FACT_SOURCE_DOMAIN,
        wireVersion: REGRESSION_POLICY_FACT_SOURCE_VERSION,
        sourceModelVersion: REGRESSION_POLICY_FACT_SOURCE_MODEL_VERSION,
        sourceModelDigest: REGRESSION_POLICY_FACT_SOURCE_MODEL_DIGEST,
      }],
    },
    resourceProfile: {
      identifier: MEMORYOS_POLICY_RESOURCE_PROFILE.identifier,
      version: MEMORYOS_POLICY_RESOURCE_PROFILE.version,
      resourceProfileDigest: MEMORYOS_POLICY_RESOURCE_PROFILE_DIGEST,
    },
    outcomeContractVersion: POLICY_OUTCOME_CONTRACT_VERSION,
  });
}

export function createMemoryOSPolicyIntegration(core) {
  const owner = intrinsicObjectFreeze({ core });
  const evaluator = createInvestigationPolicyEvaluator(core);

  const prepare = (bytes, kind) => translate("preparePolicy", () => {
    const copied = requireBytes(bytes, `${kind} bytes`);
    const capability = kind === INVESTIGATION_POLICY_KIND
      ? prepareInvestigationPolicy(copied)
      : prepareInvestigationPolicySet(copied);
    return new MemoryOSPreparedPolicy(PRIVATE, owner, capability);
  });

  const evaluate = (artifact, context, options, kind) => translate("evaluatePolicy", () => {
    const request = exactOptions(options, ["regressionSource"], "Policy evaluation options");
    const contextCapability = unwrapContext(context, owner);
    const sources = request.regressionSource === undefined
      ? [] : [unwrapSource(request.regressionSource, owner, context)];
    const result = evaluateInvestigationPolicy(
      evaluator,
      unwrapPrepared(artifact, owner, kind),
      contextCapability,
      sources,
    );
    return new MemoryOSPolicyEvaluation(PRIVATE, owner, result);
  });

  const reconstruct = (artifact, context, options) => {
    const kind = weakMapGet(preparedCapabilities, artifact)?.capability.kind;
    if (kind === INVESTIGATION_POLICY_KIND) return evaluate(artifact, context, options, kind);
    if (kind === INVESTIGATION_POLICY_SET_KIND) return evaluate(artifact, context, options, kind);
    throw new IntrinsicTypeError("A prepared Policy or Policy Set is required.");
  };

  return intrinsicObjectFreeze({
    preparePolicy(bytes) {
      return prepare(bytes, INVESTIGATION_POLICY_KIND);
    },

    preparePolicySet(bytes) {
      return prepare(bytes, INVESTIGATION_POLICY_SET_KIND);
    },

    inspectPolicyFactContext(bytes, options = {}) {
      return translate("inspectPolicyFactContext", () => {
        const copied = requireBytes(bytes, "PolicyFactContext bytes");
        const request = exactOptions(options, ["expectedContextDigest"], "Context inspection options");
        return new MemoryOSPolicyFactContextInspection(
          PRIVATE,
          preparePolicyFactContext(copied, request),
        );
      });
    },

    inspectRegressionPolicyFactSource(bytes, options = {}) {
      return translate("inspectRegressionPolicyFactSource", () => {
        const copied = requireBytes(bytes, "RegressionPolicyFactSource bytes");
        const request = exactOptions(options, ["expectedSourceDigest"], "Source inspection options");
        return new MemoryOSRegressionPolicyFactSourceInspection(
          PRIVATE,
          prepareRegressionPolicyFactSource(copied, request),
        );
      });
    },

    inspectRegressionReport(bytes) {
      return translate("inspectRegressionReport", () => new MemoryOSRegressionReportInspection(
        PRIVATE,
        parseDetachedCognitiveRegressionReport(requireBytes(bytes, "Regression report bytes")),
      ));
    },

    capturePolicyFactContext(identifier) {
      return translate("capturePolicyFactContext", () => new MemoryOSAuthoritativePolicyFactContext(
        PRIVATE,
        owner,
        captureCorePolicyFactContext(core, identifier),
      ));
    },

    captureRegressionPolicyFacts(baselineIdentifier, candidateIdentifier) {
      return translate("captureRegressionPolicyFacts", () => {
        const pair = capturePolicyFactContextAndRegressionSource(
          core,
          baselineIdentifier,
          candidateIdentifier,
        );
        const context = new MemoryOSAuthoritativePolicyFactContext(
          PRIVATE,
          owner,
          pair.policyFactContext,
        );
        const source = new MemoryOSAuthoritativeRegressionPolicyFactSource(
          PRIVATE,
          owner,
          pair.regressionPolicyFactSource,
          context,
        );
        return new MemoryOSAuthoritativeRegressionPolicyFacts(PRIVATE, context, source);
      });
    },

    evaluatePolicy(artifact, context, options = {}) {
      return evaluate(artifact, context, options, INVESTIGATION_POLICY_KIND);
    },

    evaluatePolicySet(artifact, context, options = {}) {
      return evaluate(artifact, context, options, INVESTIGATION_POLICY_SET_KIND);
    },

    verifyEvaluationIdentityArtifact(bytes, expectedEvaluationIdentityDigest) {
      return translate("verifyEvaluationIdentityArtifact", () => {
        const parsed = parsedCanonicalArtifact(bytes, "Evaluation Identity");
        validateEvaluationIdentity(parsed.value);
        const digest = domainSeparatedDigest(POLICY_EVALUATION_IDENTITY_DIGEST_DOMAIN, parsed.bytes);
        if (expectedEvaluationIdentityDigest !== undefined
            && (typeof expectedEvaluationIdentityDigest !== "string"
              || digest !== expectedEvaluationIdentityDigest)) {
          throw new MemoryOSPolicyOperationalError(
            "verifyEvaluationIdentityArtifact",
            "Evaluation Identity digest does not match.",
            { code: "VERIFICATION_FAILED", phase: "evaluationIdentity", verificationFailure: true },
          );
        }
        deepFreeze(parsed.value);
        return new MemoryOSPolicyArtifactVerification(PRIVATE, {
          artifactKind: POLICY_EVALUATION_IDENTITY_KIND,
          artifactVersion: parsed.value.version,
          authority: "inspectionOnly",
          evaluationIdentity: parsed.value,
          evaluationIdentityDigest: digest,
          verificationScope: "serializedArtifact",
          verified: true,
        }, parsed.bytes);
      });
    },

    verifyEvaluationIdentityForEvaluation(bytes, artifact, context, options = {}) {
      return translate("verifyEvaluationIdentityForEvaluation", () => {
        const parsed = parsedCanonicalArtifact(bytes, "Evaluation Identity");
        validateEvaluationIdentity(parsed.value);
        const evaluation = reconstruct(artifact, context, options);
        if (!byteEqual(parsed.bytes, evaluation.evaluationIdentityBytes())) {
          throw new MemoryOSPolicyOperationalError(
            "verifyEvaluationIdentityForEvaluation",
            "Evaluation Identity does not match authoritative reconstruction.",
            { code: "VERIFICATION_FAILED", phase: "evaluationIdentity", verificationFailure: true },
          );
        }
        return new MemoryOSPolicyArtifactVerification(PRIVATE, {
          artifactKind: POLICY_EVALUATION_IDENTITY_KIND,
          artifactVersion: parsed.value.version,
          authority: "authoritativeReconstruction",
          evaluationIdentity: parsed.value,
          evaluationIdentityDigest: evaluation.evaluationIdentityDigest,
          verificationScope: "authoritativeReconstruction",
          verified: true,
        }, parsed.bytes);
      });
    },

    verifyPolicyEvaluationOutcomeArtifact(bytes, options = {}) {
      return translate("verifyPolicyEvaluationOutcomeArtifact", () => {
        const request = exactOptions(options, [
          "expectedIdentity", "expectedEvaluationIdentityDigest", "expectedOutcomeDigest",
        ], "Outcome verification options");
        if (request.expectedIdentity !== undefined
            && request.expectedEvaluationIdentityDigest !== undefined) {
          throw new IntrinsicTypeError(
            "Expected identity and identity digest are mutually exclusive.",
          );
        }
        const parsed = parsedCanonicalArtifact(bytes, "Policy evaluation outcome");
        let expectedIdentity;
        if (request.expectedIdentity !== undefined) {
          expectedIdentity = parsedCanonicalArtifact(
            request.expectedIdentity,
            "Expected Evaluation Identity",
          ).value;
        }
        validatePolicyEvaluationOutcome(parsed.value, {
          ...(expectedIdentity === undefined ? {} : { expectedIdentity }),
          ...(request.expectedOutcomeDigest === undefined
            ? {} : { expectedOutcomeDigest: request.expectedOutcomeDigest }),
        });
        const identityDigest = policyEvaluationIdentityDigest(parsed.value.evaluationIdentity);
        if (request.expectedEvaluationIdentityDigest !== undefined
            && request.expectedEvaluationIdentityDigest !== identityDigest) {
          throw new MemoryOSPolicyOperationalError(
            "verifyPolicyEvaluationOutcomeArtifact",
            "Outcome Evaluation Identity digest does not match.",
            { code: "VERIFICATION_FAILED", phase: "evaluationOutcome", verificationFailure: true },
          );
        }
        const outcomeDigest = policyEvaluationOutcomeDigest(parsed.value);
        deepFreeze(parsed.value);
        return new MemoryOSPolicyArtifactVerification(PRIVATE, {
          artifactKind: POLICY_EVALUATION_OUTCOME_KIND,
          artifactVersion: parsed.value.version,
          authority: "inspectionOnly",
          decision: parsed.value.result.decision,
          evaluationIdentityDigest: identityDigest,
          outcome: parsed.value,
          outcomeDigest,
          verificationScope: "serializedArtifact",
          verified: true,
        }, parsed.bytes);
      });
    },

    verifyPolicyEvaluationOutcomeForEvaluation(bytes, artifact, context, options = {}) {
      return translate("verifyPolicyEvaluationOutcomeForEvaluation", () => {
        const request = exactOptions(
          options,
          ["regressionSource", "expectedOutcomeDigest"],
          "Authoritative outcome verification options",
        );
        const parsed = parsedCanonicalArtifact(bytes, "Policy evaluation outcome");
        validatePolicyEvaluationOutcome(parsed.value, request.expectedOutcomeDigest === undefined
          ? {} : { expectedOutcomeDigest: request.expectedOutcomeDigest });
        const evaluation = reconstruct(artifact, context, request.regressionSource === undefined
          ? {} : { regressionSource: request.regressionSource });
        if (!byteEqual(parsed.bytes, evaluation.canonicalOutcomeBytes())) {
          throw new MemoryOSPolicyOperationalError(
            "verifyPolicyEvaluationOutcomeForEvaluation",
            "Outcome does not match authoritative re-evaluation.",
            { code: "VERIFICATION_FAILED", phase: "evaluationOutcome", verificationFailure: true },
          );
        }
        return new MemoryOSPolicyArtifactVerification(PRIVATE, {
          artifactKind: POLICY_EVALUATION_OUTCOME_KIND,
          artifactVersion: parsed.value.version,
          authority: "authoritativeReconstruction",
          decision: evaluation.decision,
          evaluationIdentityDigest: evaluation.evaluationIdentityDigest,
          outcome: parsed.value,
          outcomeDigest: evaluation.outcomeDigest,
          verificationScope: "authoritativeReconstruction",
          verified: true,
        }, parsed.bytes);
      });
    },

    policyContractIdentities() {
      return contractIdentities();
    },
  });
}

export const MEMORYOS_POLICY_CONTRACT_IDENTITIES = contractIdentities();

// These imports are referenced above to keep all contract bindings explicit.
void DETERMINISTIC_FACT_SOURCE_REGISTRY;
void domainSeparatedDigest;
void policyEvaluationIdentityDigest;
void policyEvaluationOutcomeDigest;
void MemoryOSPolicyEvaluationInvariantError;
