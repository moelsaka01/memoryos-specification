import {
  MemoryOSPolicyError,
  canonicalizeRestrictedJson,
  domainSeparatedDigest,
  isDottedIdentifier,
  isStableSemVer,
  isUnicodeScalarString,
  inspectByteInput,
  jsonCensus,
  parseRestrictedJson,
  utf8Encode,
  validateRegisteredOrderedStringSet,
} from "./policy-canonical.js";
import {
  MEMORYOS_POLICY_RESOURCE_PROFILE,
  REGISTERED_POLICY_RULES,
} from "./investigation-policy-contracts.js";

export const INVESTIGATION_POLICY_VERSION = "1.0.0";
export const INVESTIGATION_POLICY_KIND = "MemoryOSInvestigationPolicy";
export const INVESTIGATION_POLICY_SET_KIND = "MemoryOSInvestigationPolicySet";

export const INVESTIGATION_POLICY_DIGEST_DOMAINS = Object.freeze({
  document: "MEMORYOS-POLICY-DOCUMENT-1.0",
  semantic: "MEMORYOS-POLICY-SEMANTICS-1.0",
  setDocument: "MEMORYOS-POLICY-SET-DOCUMENT-1.0",
  setSemantic: "MEMORYOS-POLICY-SET-SEMANTICS-1.0",
});

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const LIMITS = MEMORYOS_POLICY_RESOURCE_PROFILE.limits;
const preparedBytes = new WeakMap();
const PREPARED_POLICY_ARTIFACT_TOKEN = Symbol("MemoryOS prepared Policy artifact");
const intrinsicReflectApply = Reflect.apply;
const intrinsicObjectDefineProperties = Object.defineProperties;
const intrinsicObjectFreeze = Object.freeze;
const intrinsicObjectCreate = Object.create;
const intrinsicObjectEntries = Object.entries;
const intrinsicObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicObjectHasOwn = Object.hasOwn;
const intrinsicObjectKeys = Object.keys;
const intrinsicObjectIs = Object.is;
const intrinsicObjectValues = Object.values;
const intrinsicArrayIsArray = Array.isArray;
const intrinsicNumberIsSafeInteger = Number.isSafeInteger;
const intrinsicRegExpTest = RegExp.prototype.test;
const IntrinsicSet = Set;
const intrinsicSetAdd = Set.prototype.add;
const intrinsicSetHas = Set.prototype.has;
const weakMapGet = WeakMap.prototype.get;
const weakMapHas = WeakMap.prototype.has;
const weakMapSet = WeakMap.prototype.set;
const IntrinsicUint8Array = Uint8Array;
const intrinsicTypedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const intrinsicTypedArrayByteLengthGetter = intrinsicObjectGetOwnPropertyDescriptor(
  intrinsicTypedArrayPrototype,
  "byteLength",
).get;
const intrinsicUint8ArraySet = Uint8Array.prototype.set;

function privateGet(map, key) {
  return intrinsicReflectApply(weakMapGet, map, [key]);
}

function privateHas(map, key) {
  return intrinsicReflectApply(weakMapHas, map, [key]);
}

function privateSet(map, key, value) {
  intrinsicReflectApply(weakMapSet, map, [key, value]);
}

function copyBytes(value) {
  const byteLength = intrinsicReflectApply(intrinsicTypedArrayByteLengthGetter, value, []);
  const result = new IntrinsicUint8Array(byteLength);
  intrinsicReflectApply(intrinsicUint8ArraySet, result, [value, 0]);
  return result;
}

function byteLength(value) {
  return intrinsicReflectApply(intrinsicTypedArrayByteLengthGetter, value, []);
}

function deepFreeze(value, seen = new IntrinsicSet()) {
  if (value === null || typeof value !== "object"
      || intrinsicReflectApply(intrinsicSetHas, seen, [value])) return value;
  intrinsicReflectApply(intrinsicSetAdd, seen, [value]);
  const children = intrinsicObjectValues(value);
  for (let index = 0; index < children.length; index += 1) deepFreeze(children[index], seen);
  return intrinsicObjectFreeze(value);
}

function cloneJson(value) {
  if (intrinsicArrayIsArray(value)) {
    const result = [];
    for (let index = 0; index < value.length; index += 1) result[index] = cloneJson(value[index]);
    return result;
  }
  if (value !== null && typeof value === "object") {
    const result = intrinsicObjectCreate(null);
    const entries = intrinsicObjectEntries(value);
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      result[entry[0]] = cloneJson(entry[1]);
    }
    return result;
  }
  return value;
}

function arrayIncludes(values, expected) {
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === expected) return true;
  }
  return false;
}

function fail(code, message, artifactKind, details = {}) {
  throw new MemoryOSPolicyError(code, message, {
    artifactKind,
    phase: "policyArtifact",
    ...details,
  });
}

function resourceFailure(limitIdentifier, artifactKind, enforcementPhase) {
  const configuredLimit = LIMITS[limitIdentifier];
  fail(
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    `${artifactKind} exceeds ${limitIdentifier}.`,
    artifactKind,
    {
      configuredLimit,
      enforcementPhase,
      limitIdentifier,
      observedAtLeast: configuredLimit + 1,
    },
  );
}

function enforceLimit(limitIdentifier, observed, artifactKind, enforcementPhase) {
  if (observed > LIMITS[limitIdentifier]) resourceFailure(limitIdentifier, artifactKind, enforcementPhase);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !intrinsicArrayIsArray(value);
}

function assertClosedObject(value, allowed, required, code, artifactKind, label) {
  if (!isObject(value)) fail(code, `${label} must be an object.`, artifactKind);
  const actual = intrinsicObjectKeys(value);
  for (let index = 0; index < actual.length; index += 1) {
    if (!arrayIncludes(allowed, actual[index])) {
      fail(code, `${label} does not have the frozen closed shape.`, artifactKind);
    }
  }
  for (let index = 0; index < required.length; index += 1) {
    if (!intrinsicObjectHasOwn(value, required[index])) {
      fail(code, `${label} does not have the frozen closed shape.`, artifactKind);
    }
  }
}

function assertScalarString(value, code, artifactKind, label, allowEmpty = false) {
  if (!isUnicodeScalarString(value) || (!allowEmpty && value.length === 0)) {
    fail(code, `${label} must be ${allowEmpty ? "a" : "a non-empty"} Unicode scalar string.`, artifactKind);
  }
}

function validateArtifactVersion(version, artifactKind) {
  if (typeof version !== "string" || !isStableSemVer(version)) {
    fail("POLICY_SCHEMA_INVALID", "Artifact version must use stable SemVer.", artifactKind);
  }
  if (version !== INVESTIGATION_POLICY_VERSION) {
    fail("POLICY_VERSION_UNSUPPORTED", `Unsupported artifact version ${version}.`, artifactKind);
  }
}

function validateMetadata(metadata, artifactKind) {
  assertClosedObject(metadata, ["description"], ["description"], "POLICY_SCHEMA_INVALID", artifactKind, "metadata");
  assertScalarString(metadata.description, "POLICY_SCHEMA_INVALID", artifactKind, "metadata.description");
}

function validateParameters(parameters, registration, artifactKind) {
  const contract = registration.parameterContract;
  if (contract.kind === "emptyObject") {
    assertClosedObject(parameters, [], [], "POLICY_SCHEMA_INVALID", artifactKind, "rule.parameters");
    return;
  }
  if (contract.kind === "artifactCardinalityObject") {
    assertClosedObject(
      parameters,
      ["artifactClass", "minimumCount"],
      ["artifactClass", "minimumCount"],
      "POLICY_SCHEMA_INVALID",
      artifactKind,
      "rule.parameters",
    );
    if (!arrayIncludes(contract.artifactClasses, parameters.artifactClass)
        || !intrinsicNumberIsSafeInteger(parameters.minimumCount)
        || intrinsicObjectIs(parameters.minimumCount, -0)
        || parameters.minimumCount < contract.minimum
        || parameters.minimumCount > contract.maximum) {
      fail("POLICY_SCHEMA_INVALID", "Artifact-cardinality parameters are invalid.", artifactKind);
    }
    return;
  }
  if (contract.kind === "registeredOrderedStringSetObject") {
    assertClosedObject(
      parameters,
      [contract.member],
      [contract.member],
      "POLICY_SCHEMA_INVALID",
      artifactKind,
      "rule.parameters",
    );
    const members = parameters[contract.member];
    if (!validateRegisteredOrderedStringSet(members, contract.registeredOrder)
        || members.length > contract.maximumItems) {
      fail("POLICY_SCHEMA_INVALID", `${contract.member} is not the frozen registered ordered set.`, artifactKind);
    }
    return;
  }
  throw new TypeError(`Unknown internal parameter contract ${String(contract.kind)}.`);
}

function validateRuleStructure(rule, artifactKind) {
  assertClosedObject(
    rule,
    ["identifier", "type", "version", "parameters"],
    ["identifier", "type", "version", "parameters"],
    "POLICY_SCHEMA_INVALID",
    artifactKind,
    "rule",
  );
  assertScalarString(rule.identifier, "POLICY_SCHEMA_INVALID", artifactKind, "rule.identifier");
  if (!isDottedIdentifier(rule.identifier)) {
    fail("POLICY_SCHEMA_INVALID", "Rule identifier does not match the frozen identifier grammar.", artifactKind);
  }
  assertScalarString(rule.type, "POLICY_SCHEMA_INVALID", artifactKind, "rule.type");
  if (!isDottedIdentifier(rule.type)) {
    fail("POLICY_SCHEMA_INVALID", "Rule type does not match the frozen identifier grammar.", artifactKind);
  }
  if (typeof rule.version !== "string" || !isStableSemVer(rule.version)) {
    fail("POLICY_SCHEMA_INVALID", "Rule version must use stable SemVer.", artifactKind);
  }
  if (!isObject(rule.parameters)) {
    fail("POLICY_SCHEMA_INVALID", "Rule parameters must be a registered closed object.", artifactKind);
  }
}

function validateRegisteredRule(rule, artifactKind) {
  if (!intrinsicObjectHasOwn(REGISTERED_POLICY_RULES, rule.type)) {
    fail("RULE_TYPE_UNSUPPORTED", `Unsupported rule type ${rule.type}.`, artifactKind);
  }
  const registration = REGISTERED_POLICY_RULES[rule.type];
  if (rule.version !== registration.version) {
    fail("RULE_VERSION_UNSUPPORTED", `Unsupported version ${rule.version} for ${rule.type}.`, artifactKind);
  }
  validateParameters(rule.parameters, registration, artifactKind);
}

function validatePolicySchema(policy, artifactKind = INVESTIGATION_POLICY_KIND) {
  if (!isObject(policy)) fail("POLICY_SCHEMA_INVALID", "Policy must be an object.", artifactKind);
  if (policy.kind !== INVESTIGATION_POLICY_KIND) {
    fail("POLICY_SCHEMA_INVALID", "Policy kind is invalid.", artifactKind);
  }
  validateArtifactVersion(policy.version, artifactKind);
  assertClosedObject(
    policy,
    ["kind", "version", "identifier", "policyVersion", "metadata", "rules"],
    ["kind", "version", "identifier", "policyVersion", "rules"],
    "POLICY_SCHEMA_INVALID",
    artifactKind,
    "Policy",
  );
  assertScalarString(policy.identifier, "POLICY_SCHEMA_INVALID", artifactKind, "Policy.identifier");
  if (!isDottedIdentifier(policy.identifier)) {
    fail("POLICY_SCHEMA_INVALID", "Policy identifier does not match the frozen identifier grammar.", artifactKind);
  }
  if (typeof policy.policyVersion !== "string" || !isStableSemVer(policy.policyVersion)) {
    fail("POLICY_SCHEMA_INVALID", "policyVersion must use stable SemVer.", artifactKind);
  }
  if (intrinsicObjectHasOwn(policy, "metadata")) validateMetadata(policy.metadata, artifactKind);
  if (!intrinsicArrayIsArray(policy.rules) || policy.rules.length === 0) {
    fail("POLICY_SCHEMA_INVALID", "Policy rules must be a non-empty sequence.", artifactKind);
  }
  for (let index = 0; index < policy.rules.length; index += 1) {
    validateRuleStructure(policy.rules[index], artifactKind);
  }
  for (let index = 0; index < policy.rules.length; index += 1) {
    validateRegisteredRule(policy.rules[index], artifactKind);
  }
  const ruleIdentifiers = new IntrinsicSet();
  for (let index = 0; index < policy.rules.length; index += 1) {
    const rule = policy.rules[index];
    if (intrinsicReflectApply(intrinsicSetHas, ruleIdentifiers, [rule.identifier])) {
      fail("POLICY_SCHEMA_INVALID", "Rule identifiers must be unique within a Policy.", artifactKind);
    }
    intrinsicReflectApply(intrinsicSetAdd, ruleIdentifiers, [rule.identifier]);
  }
}

function enforcePolicyLocalLimits(policy, artifactKind) {
  enforceLimit("policy.identifier-utf8-bytes", byteLength(utf8Encode(policy.identifier)), artifactKind, "E");
  enforceLimit("policy.authored-version-utf8-bytes", byteLength(utf8Encode(policy.policyVersion)), artifactKind, "E");
  enforceLimit(
    "policy.description-utf8-bytes",
    intrinsicObjectHasOwn(policy, "metadata")
      ? byteLength(utf8Encode(policy.metadata.description)) : 0,
    artifactKind,
    "E",
  );
  for (let index = 0; index < policy.rules.length; index += 1) {
    enforceLimit(
      "policy.rule-identifier-utf8-bytes",
      byteLength(utf8Encode(policy.rules[index].identifier)),
      artifactKind,
      "E",
    );
  }
  enforceLimit("policy.rule-count", policy.rules.length, artifactKind, "E");
}

export function policySemanticProjection(policy) {
  const rules = [];
  for (let index = 0; index < policy.rules.length; index += 1) {
    const rule = policy.rules[index];
    rules[index] = {
      identifier: rule.identifier,
      type: rule.type,
      version: rule.version,
      parameters: cloneJson(rule.parameters),
    };
  }
  return {
    kind: policy.kind,
    version: policy.version,
    identifier: policy.identifier,
    policyVersion: policy.policyVersion,
    rules,
  };
}

class PreparedPolicyArtifact {
  constructor(token, record) {
    if (token !== PREPARED_POLICY_ARTIFACT_TOKEN) {
      throw new TypeError("Prepared Policy artifact capabilities cannot be constructed by callers.");
    }
    const {
      artifact,
      canonicalBytes,
      semanticBytes,
      semanticProjection,
      documentDigest,
      semanticDigest,
      policies = [],
    } = record;
    const retained = intrinsicObjectFreeze({
      artifact: deepFreeze(artifact),
      canonicalBytes: copyBytes(canonicalBytes),
      documentDigest,
      policies: intrinsicObjectFreeze(copyPolicyCapabilities(policies)),
      semanticBytes: copyBytes(semanticBytes),
      semanticDigest,
      semanticProjection: deepFreeze(semanticProjection),
    });
    privateSet(preparedBytes, this, retained);
    intrinsicObjectDefineProperties(this, {
      kind: { enumerable: true, value: retained.artifact.kind },
      version: { enumerable: true, value: retained.artifact.version },
      identifier: { enumerable: true, value: retained.artifact.identifier },
      documentDigest: { enumerable: true, value: retained.documentDigest },
      semanticDigest: { enumerable: true, value: retained.semanticDigest },
      artifact: { enumerable: true, value: retained.artifact },
      semanticProjection: { enumerable: true, value: retained.semanticProjection },
    });
    intrinsicObjectFreeze(this);
  }

  canonicalBytes() {
    return copyBytes(privateGet(preparedBytes, this).canonicalBytes);
  }

  semanticBytes() {
    return copyBytes(privateGet(preparedBytes, this).semanticBytes);
  }

  preparedPolicies() {
    return copyPolicyCapabilities(privateGet(preparedBytes, this).policies);
  }
}
intrinsicObjectFreeze(PreparedPolicyArtifact.prototype);

export function isPreparedInvestigationPolicyArtifact(value) {
  return privateHas(preparedBytes, value);
}

export function assertPreparedInvestigationPolicyArtifact(value) {
  if (!privateHas(preparedBytes, value)) {
    throw new TypeError("A trusted prepared Policy or Policy Set capability is required.");
  }
  return true;
}

function copyPolicyCapabilities(policies) {
  const result = [];
  for (let index = 0; index < policies.length; index += 1) result[index] = policies[index];
  return result;
}

export function preparedInvestigationPolicyArtifactEvaluationView(value) {
  assertPreparedInvestigationPolicyArtifact(value);
  const retained = privateGet(preparedBytes, value);
  return intrinsicObjectFreeze({
    artifact: retained.artifact,
    canonicalBytes: copyBytes(retained.canonicalBytes),
    documentDigest: retained.documentDigest,
    policies: intrinsicObjectFreeze(copyPolicyCapabilities(retained.policies)),
    semanticBytes: copyBytes(retained.semanticBytes),
    semanticDigest: retained.semanticDigest,
    semanticProjection: retained.semanticProjection,
  });
}

function finishPolicyPreparation(policy, artifactKind, enforceLocalLimits = true) {
  if (enforceLocalLimits) enforcePolicyLocalLimits(policy, artifactKind);
  const canonicalBytes = canonicalizeRestrictedJson(policy);
  enforceLimit("policy.canonical-document-bytes", canonicalBytes.length, artifactKind, "F");
  const semanticProjection = policySemanticProjection(policy);
  const semanticBytes = canonicalizeRestrictedJson(semanticProjection);
  return new PreparedPolicyArtifact(PREPARED_POLICY_ARTIFACT_TOKEN, {
    artifact: policy,
    canonicalBytes,
    semanticBytes,
    semanticProjection,
    documentDigest: domainSeparatedDigest(INVESTIGATION_POLICY_DIGEST_DOMAINS.document, canonicalBytes),
    semanticDigest: domainSeparatedDigest(INVESTIGATION_POLICY_DIGEST_DOMAINS.semantic, semanticBytes),
  });
}

export function enforcePolicyJsonResourceLimits(value, artifactKind) {
  const census = jsonCensus(value);
  enforceLimit("json.nesting-depth", census.maximumDepth, artifactKind, "C");
  enforceLimit("json.value-count", census.valueCount, artifactKind, "C");
  enforceLimit("json.string-utf8-bytes", census.maximumStringUtf8Bytes, artifactKind, "C");
  return census;
}

function parseArtifact(bytesLike, rawLimitIdentifier, artifactKind) {
  const input = inspectByteInput(bytesLike, `${artifactKind} bytes`);
  enforceLimit(rawLimitIdentifier, input.byteLength, artifactKind, "A");
  const bytes = input.snapshot();
  let artifact;
  try {
    artifact = parseRestrictedJson(bytes);
  } catch {
    fail("POLICY_SYNTAX_INVALID", `${artifactKind} is not valid restricted JSON.`, artifactKind, { enforcementPhase: "B" });
  }
  enforcePolicyJsonResourceLimits(artifact, artifactKind);
  return artifact;
}

export function prepareInvestigationPolicy(bytesLike) {
  const policy = parseArtifact(bytesLike, "policy.raw-document-bytes", INVESTIGATION_POLICY_KIND);
  validatePolicySchema(policy);
  return finishPolicyPreparation(policy, INVESTIGATION_POLICY_KIND);
}

function validatePolicySetSchema(policySet) {
  const artifactKind = INVESTIGATION_POLICY_SET_KIND;
  if (!isObject(policySet)) fail("POLICY_SCHEMA_INVALID", "Policy Set must be an object.", artifactKind);
  if (policySet.kind !== INVESTIGATION_POLICY_SET_KIND) {
    fail("POLICY_SCHEMA_INVALID", "Policy Set kind is invalid.", artifactKind);
  }
  validateArtifactVersion(policySet.version, artifactKind);
  assertClosedObject(
    policySet,
    ["kind", "version", "identifier", "policySetVersion", "metadata", "policies"],
    ["kind", "version", "identifier", "policySetVersion", "policies"],
    "POLICY_SCHEMA_INVALID",
    artifactKind,
    "Policy Set",
  );
  assertScalarString(policySet.identifier, "POLICY_SCHEMA_INVALID", artifactKind, "Policy Set identifier");
  if (!isDottedIdentifier(policySet.identifier)) {
    fail("POLICY_SCHEMA_INVALID", "Policy Set identifier does not match the frozen identifier grammar.", artifactKind);
  }
  if (typeof policySet.policySetVersion !== "string" || !isStableSemVer(policySet.policySetVersion)) {
    fail("POLICY_SCHEMA_INVALID", "policySetVersion must use stable SemVer.", artifactKind);
  }
  if (intrinsicObjectHasOwn(policySet, "metadata")) validateMetadata(policySet.metadata, artifactKind);
  if (!intrinsicArrayIsArray(policySet.policies)) {
    fail("POLICY_SCHEMA_INVALID", "Policy Set policies must be a sequence.", artifactKind);
  }
  if (policySet.policies.length === 0) {
    fail("POLICY_SET_INVALID", "Policy Set policies must be a non-empty sequence.", artifactKind);
  }
  for (let index = 0; index < policySet.policies.length; index += 1) {
    const member = policySet.policies[index];
    assertClosedObject(
      member,
      ["policy", "expectedSemanticDigest"],
      ["policy", "expectedSemanticDigest"],
      "POLICY_SET_INVALID",
      artifactKind,
      "Policy Set member",
    );
    if (member.policy?.kind === INVESTIGATION_POLICY_SET_KIND) {
      fail("POLICY_SET_INVALID", "Nested Policy Sets are prohibited.", artifactKind);
    }
  }
  for (let index = 0; index < policySet.policies.length; index += 1) {
    validatePolicySchema(policySet.policies[index].policy, artifactKind);
  }
  for (let index = 0; index < policySet.policies.length; index += 1) {
    const member = policySet.policies[index];
    if (typeof member.expectedSemanticDigest !== "string"
        || !intrinsicReflectApply(intrinsicRegExpTest, DIGEST_PATTERN, [member.expectedSemanticDigest])) {
      fail("POLICY_SET_INVALID", "Policy Set semantic pin is malformed.", artifactKind);
    }
  }
}

function enforcePolicySetLocalLimits(policySet) {
  const artifactKind = INVESTIGATION_POLICY_SET_KIND;
  for (let index = 0; index < policySet.policies.length; index += 1) {
    const policy = policySet.policies[index].policy;
    enforceLimit("policy.identifier-utf8-bytes", byteLength(utf8Encode(policy.identifier)), artifactKind, "E");
  }
  for (let index = 0; index < policySet.policies.length; index += 1) {
    const policy = policySet.policies[index].policy;
    enforceLimit(
      "policy.authored-version-utf8-bytes",
      byteLength(utf8Encode(policy.policyVersion)),
      artifactKind,
      "E",
    );
  }
  for (let index = 0; index < policySet.policies.length; index += 1) {
    const policy = policySet.policies[index].policy;
    enforceLimit(
      "policy.description-utf8-bytes",
      intrinsicObjectHasOwn(policy, "metadata")
        ? byteLength(utf8Encode(policy.metadata.description)) : 0,
      artifactKind,
      "E",
    );
  }
  for (let policyIndex = 0; policyIndex < policySet.policies.length; policyIndex += 1) {
    const policy = policySet.policies[policyIndex].policy;
    for (let ruleIndex = 0; ruleIndex < policy.rules.length; ruleIndex += 1) {
      enforceLimit(
        "policy.rule-identifier-utf8-bytes",
        byteLength(utf8Encode(policy.rules[ruleIndex].identifier)),
        artifactKind,
        "E",
      );
    }
  }
  for (let index = 0; index < policySet.policies.length; index += 1) {
    const policy = policySet.policies[index].policy;
    enforceLimit("policy.rule-count", policy.rules.length, artifactKind, "E");
  }
  enforceLimit("policy-set.identifier-utf8-bytes", byteLength(utf8Encode(policySet.identifier)), artifactKind, "E");
  enforceLimit(
    "policy-set.authored-version-utf8-bytes",
    byteLength(utf8Encode(policySet.policySetVersion)),
    artifactKind,
    "E",
  );
  enforceLimit(
    "policy-set.description-utf8-bytes",
    intrinsicObjectHasOwn(policySet, "metadata")
      ? byteLength(utf8Encode(policySet.metadata.description)) : 0,
    artifactKind,
    "E",
  );
  enforceLimit("policy-set.policy-count", policySet.policies.length, artifactKind, "E");
}

export function policySetSemanticProjection(policySet, preparedPolicies) {
  const policies = [];
  for (let index = 0; index < preparedPolicies.length; index += 1) {
    policies[index] = { semanticDigest: preparedPolicies[index].semanticDigest };
  }
  return {
    kind: policySet.kind,
    version: policySet.version,
    identifier: policySet.identifier,
    policySetVersion: policySet.policySetVersion,
    policies,
  };
}

export function prepareInvestigationPolicySet(bytesLike) {
  const artifactKind = INVESTIGATION_POLICY_SET_KIND;
  const policySet = parseArtifact(bytesLike, "policy-set.raw-document-bytes", artifactKind);
  validatePolicySetSchema(policySet);
  enforcePolicySetLocalLimits(policySet);

  const policies = [];
  for (let index = 0; index < policySet.policies.length; index += 1) {
    policies[index] = finishPolicyPreparation(policySet.policies[index].policy, artifactKind, false);
  }
  for (let index = 0; index < policies.length; index += 1) {
    if (policySet.policies[index].expectedSemanticDigest !== policies[index].semanticDigest) {
      fail("POLICY_DIGEST_MISMATCH", "Policy Set child semantic pin does not match.", artifactKind);
    }
  }
  const identifiers = new IntrinsicSet();
  for (let index = 0; index < policies.length; index += 1) {
    const policy = policies[index];
    if (intrinsicReflectApply(intrinsicSetHas, identifiers, [policy.identifier])) {
      fail("POLICY_SET_INVALID", "Policy Set child identifiers must be unique.", artifactKind);
    }
    intrinsicReflectApply(intrinsicSetAdd, identifiers, [policy.identifier]);
  }
  const semanticDigests = new IntrinsicSet();
  for (let index = 0; index < policies.length; index += 1) {
    const policy = policies[index];
    if (intrinsicReflectApply(intrinsicSetHas, semanticDigests, [policy.semanticDigest])) {
      fail("POLICY_SET_INVALID", "Policy Set child semantic digests must be unique.", artifactKind);
    }
    intrinsicReflectApply(intrinsicSetAdd, semanticDigests, [policy.semanticDigest]);
  }

  const canonicalBytes = canonicalizeRestrictedJson(policySet);
  enforceLimit("policy-set.canonical-document-bytes", canonicalBytes.length, artifactKind, "F");
  const semanticProjection = policySetSemanticProjection(policySet, policies);
  const semanticBytes = canonicalizeRestrictedJson(semanticProjection);
  const prepared = new PreparedPolicyArtifact(PREPARED_POLICY_ARTIFACT_TOKEN, {
    artifact: policySet,
    canonicalBytes,
    semanticBytes,
    semanticProjection,
    documentDigest: domainSeparatedDigest(INVESTIGATION_POLICY_DIGEST_DOMAINS.setDocument, canonicalBytes),
    semanticDigest: domainSeparatedDigest(INVESTIGATION_POLICY_DIGEST_DOMAINS.setSemantic, semanticBytes),
    policies,
  });
  return prepared;
}
