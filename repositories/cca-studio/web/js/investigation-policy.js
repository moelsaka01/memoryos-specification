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

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function cloneJson(value) {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (value !== null && typeof value === "object") {
    const result = Object.create(null);
    for (const [name, child] of Object.entries(value)) result[name] = cloneJson(child);
    return result;
  }
  return value;
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
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertClosedObject(value, allowed, required, code, artifactKind, label) {
  if (!isObject(value)) fail(code, `${label} must be an object.`, artifactKind);
  const actual = Object.keys(value);
  if (actual.some((name) => !allowed.includes(name))
      || required.some((name) => !Object.hasOwn(value, name))) {
    fail(code, `${label} does not have the frozen closed shape.`, artifactKind);
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
    if (!contract.artifactClasses.includes(parameters.artifactClass)
        || !Number.isSafeInteger(parameters.minimumCount)
        || Object.is(parameters.minimumCount, -0)
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
  if (!Object.hasOwn(REGISTERED_POLICY_RULES, rule.type)) {
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
  if (Object.hasOwn(policy, "metadata")) validateMetadata(policy.metadata, artifactKind);
  if (!Array.isArray(policy.rules) || policy.rules.length === 0) {
    fail("POLICY_SCHEMA_INVALID", "Policy rules must be a non-empty sequence.", artifactKind);
  }
  for (const rule of policy.rules) {
    validateRuleStructure(rule, artifactKind);
  }
  for (const rule of policy.rules) {
    validateRegisteredRule(rule, artifactKind);
  }
  const ruleIdentifiers = new Set();
  for (const rule of policy.rules) {
    if (ruleIdentifiers.has(rule.identifier)) {
      fail("POLICY_SCHEMA_INVALID", "Rule identifiers must be unique within a Policy.", artifactKind);
    }
    ruleIdentifiers.add(rule.identifier);
  }
}

function enforcePolicyLocalLimits(policy, artifactKind) {
  enforceLimit("policy.identifier-utf8-bytes", utf8Encode(policy.identifier).length, artifactKind, "E");
  enforceLimit("policy.authored-version-utf8-bytes", utf8Encode(policy.policyVersion).length, artifactKind, "E");
  enforceLimit(
    "policy.description-utf8-bytes",
    Object.hasOwn(policy, "metadata") ? utf8Encode(policy.metadata.description).length : 0,
    artifactKind,
    "E",
  );
  for (const rule of policy.rules) {
    enforceLimit("policy.rule-identifier-utf8-bytes", utf8Encode(rule.identifier).length, artifactKind, "E");
  }
  enforceLimit("policy.rule-count", policy.rules.length, artifactKind, "E");
}

export function policySemanticProjection(policy) {
  return {
    kind: policy.kind,
    version: policy.version,
    identifier: policy.identifier,
    policyVersion: policy.policyVersion,
    rules: policy.rules.map((rule) => ({
      identifier: rule.identifier,
      type: rule.type,
      version: rule.version,
      parameters: cloneJson(rule.parameters),
    })),
  };
}

class PreparedPolicyArtifact {
  constructor({ artifact, canonicalBytes, semanticBytes, semanticProjection, documentDigest, semanticDigest, policies = [] }) {
    this.kind = artifact.kind;
    this.version = artifact.version;
    this.identifier = artifact.identifier;
    this.documentDigest = documentDigest;
    this.semanticDigest = semanticDigest;
    this.artifact = deepFreeze(artifact);
    this.semanticProjection = deepFreeze(semanticProjection);
    preparedBytes.set(this, {
      canonicalBytes: canonicalBytes.slice(),
      policies: Object.freeze([...policies]),
      semanticBytes: semanticBytes.slice(),
    });
    Object.freeze(this);
  }

  canonicalBytes() {
    return preparedBytes.get(this).canonicalBytes.slice();
  }

  semanticBytes() {
    return preparedBytes.get(this).semanticBytes.slice();
  }

  preparedPolicies() {
    return [...preparedBytes.get(this).policies];
  }
}

function finishPolicyPreparation(policy, artifactKind, enforceLocalLimits = true) {
  if (enforceLocalLimits) enforcePolicyLocalLimits(policy, artifactKind);
  const canonicalBytes = canonicalizeRestrictedJson(policy);
  enforceLimit("policy.canonical-document-bytes", canonicalBytes.length, artifactKind, "F");
  const semanticProjection = policySemanticProjection(policy);
  const semanticBytes = canonicalizeRestrictedJson(semanticProjection);
  return new PreparedPolicyArtifact({
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
  if (Object.hasOwn(policySet, "metadata")) validateMetadata(policySet.metadata, artifactKind);
  if (!Array.isArray(policySet.policies)) {
    fail("POLICY_SCHEMA_INVALID", "Policy Set policies must be a sequence.", artifactKind);
  }
  if (policySet.policies.length === 0) {
    fail("POLICY_SET_INVALID", "Policy Set policies must be a non-empty sequence.", artifactKind);
  }
  for (const member of policySet.policies) {
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
  for (const member of policySet.policies) {
    validatePolicySchema(member.policy, artifactKind);
  }
  for (const member of policySet.policies) {
    if (typeof member.expectedSemanticDigest !== "string"
        || !DIGEST_PATTERN.test(member.expectedSemanticDigest)) {
      fail("POLICY_SET_INVALID", "Policy Set semantic pin is malformed.", artifactKind);
    }
  }
}

function enforcePolicySetLocalLimits(policySet) {
  const artifactKind = INVESTIGATION_POLICY_SET_KIND;
  for (const { policy } of policySet.policies) {
    enforceLimit("policy.identifier-utf8-bytes", utf8Encode(policy.identifier).length, artifactKind, "E");
  }
  for (const { policy } of policySet.policies) {
    enforceLimit("policy.authored-version-utf8-bytes", utf8Encode(policy.policyVersion).length, artifactKind, "E");
  }
  for (const { policy } of policySet.policies) {
    enforceLimit(
      "policy.description-utf8-bytes",
      Object.hasOwn(policy, "metadata") ? utf8Encode(policy.metadata.description).length : 0,
      artifactKind,
      "E",
    );
  }
  for (const { policy } of policySet.policies) {
    for (const rule of policy.rules) {
      enforceLimit("policy.rule-identifier-utf8-bytes", utf8Encode(rule.identifier).length, artifactKind, "E");
    }
  }
  for (const { policy } of policySet.policies) {
    enforceLimit("policy.rule-count", policy.rules.length, artifactKind, "E");
  }
  enforceLimit("policy-set.identifier-utf8-bytes", utf8Encode(policySet.identifier).length, artifactKind, "E");
  enforceLimit("policy-set.authored-version-utf8-bytes", utf8Encode(policySet.policySetVersion).length, artifactKind, "E");
  enforceLimit(
    "policy-set.description-utf8-bytes",
    Object.hasOwn(policySet, "metadata") ? utf8Encode(policySet.metadata.description).length : 0,
    artifactKind,
    "E",
  );
  enforceLimit("policy-set.policy-count", policySet.policies.length, artifactKind, "E");
}

export function policySetSemanticProjection(policySet, preparedPolicies) {
  return {
    kind: policySet.kind,
    version: policySet.version,
    identifier: policySet.identifier,
    policySetVersion: policySet.policySetVersion,
    policies: preparedPolicies.map((policy) => ({ semanticDigest: policy.semanticDigest })),
  };
}

export function prepareInvestigationPolicySet(bytesLike) {
  const artifactKind = INVESTIGATION_POLICY_SET_KIND;
  const policySet = parseArtifact(bytesLike, "policy-set.raw-document-bytes", artifactKind);
  validatePolicySetSchema(policySet);
  enforcePolicySetLocalLimits(policySet);

  const policies = policySet.policies.map(
    (member) => finishPolicyPreparation(member.policy, artifactKind, false),
  );
  for (let index = 0; index < policies.length; index += 1) {
    if (policySet.policies[index].expectedSemanticDigest !== policies[index].semanticDigest) {
      fail("POLICY_DIGEST_MISMATCH", "Policy Set child semantic pin does not match.", artifactKind);
    }
  }
  const identifiers = new Set();
  for (const policy of policies) {
    if (identifiers.has(policy.identifier)) {
      fail("POLICY_SET_INVALID", "Policy Set child identifiers must be unique.", artifactKind);
    }
    identifiers.add(policy.identifier);
  }
  const semanticDigests = new Set();
  for (const policy of policies) {
    if (semanticDigests.has(policy.semanticDigest)) {
      fail("POLICY_SET_INVALID", "Policy Set child semantic digests must be unique.", artifactKind);
    }
    semanticDigests.add(policy.semanticDigest);
  }

  const canonicalBytes = canonicalizeRestrictedJson(policySet);
  enforceLimit("policy-set.canonical-document-bytes", canonicalBytes.length, artifactKind, "F");
  const semanticProjection = policySetSemanticProjection(policySet, policies);
  const semanticBytes = canonicalizeRestrictedJson(semanticProjection);
  const prepared = new PreparedPolicyArtifact({
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
