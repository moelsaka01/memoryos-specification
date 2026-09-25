import { sha256Hex } from "./mip-canonical.js";
import {
  MemoryOSPolicyError,
  canonicalizeRestrictedJson,
  domainSeparatedDigest,
  isDottedIdentifier,
  isStableSemVer,
  inspectByteInput,
  parseRestrictedJson,
  parseRestrictedJsonWithCensus,
} from "./policy-canonical.js";

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

export const RESOURCE_PROFILE_BOOTSTRAP_LIMITS = deepFreeze({
  "resource-profile.bootstrap.raw-document-bytes": 4096,
  "resource-profile.bootstrap.json.nesting-depth": 4,
  "resource-profile.bootstrap.json.value-count": 64,
  "resource-profile.bootstrap.json.string-utf8-bytes": 128,
});

export const MEMORYOS_POLICY_RESOURCE_PROFILE = deepFreeze({
  identifier: "memoryos.policy.resource-profile.standard",
  kind: "MemoryOSPolicyResourceProfile",
  limits: {
    "evaluation.evidence-canonical-bytes": 1024,
    "evaluation.evidence-fact-identifier-count": 4,
    "evaluation.input-canonical-bytes": 16384,
    "evaluation.outcome-canonical-bytes": 4060,
    "evaluation.rule-evaluation-count": 4,
    "evaluation.selection-matched-fact-identifier-count": 4,
    "evaluation.selector-candidate-visit-count": 16,
    "json.nesting-depth": 16,
    "json.string-utf8-bytes": 256,
    "json.value-count": 512,
    "policy-fact-context.canonical-document-bytes": 16384,
    "policy-fact-context.observation-count": 4,
    "policy-fact-context.raw-document-bytes": 16384,
    "policy-fact-context.total-fact-count": 59,
    "policy-fact-context.transition-count": 32,
    "policy-set.authored-version-utf8-bytes": 8,
    "policy-set.canonical-document-bytes": 2048,
    "policy-set.description-utf8-bytes": 2,
    "policy-set.identifier-utf8-bytes": 2,
    "policy-set.policy-count": 4,
    "policy-set.raw-document-bytes": 2048,
    "policy.authored-version-utf8-bytes": 8,
    "policy.canonical-document-bytes": 1024,
    "policy.description-utf8-bytes": 2,
    "policy.identifier-utf8-bytes": 2,
    "policy.raw-document-bytes": 1024,
    "policy.rule-count": 4,
    "policy.rule-identifier-utf8-bytes": 2,
    "regression-policy-fact-source.canonical-document-bytes": 7916,
    "regression-policy-fact-source.finding-count": 8,
    "regression-policy-fact-source.raw-document-bytes": 8192,
  },
  version: "1.0.0",
});

export const MEMORYOS_POLICY_RESOURCE_PROFILE_DIGEST =
  "sha256:c091573dfd05481f5759ef077e15af16689382a7432fa546c6630c4caeaa5239";
export const MEMORYOS_POLICY_RESOURCE_PROFILE_BYTE_COUNT = 1369;
export const MEMORYOS_POLICY_RESOURCE_PROFILE_RAW_SHA256 =
  "sha256:9706cb8b9bf23af8c861aeb1a92d0fafefd4dd7723a65a93077460f654879f3c";
export const MEMORYOS_POLICY_RESOURCE_PROFILE_DOMAIN = "MEMORYOS-POLICY-RESOURCE-PROFILE-1.0";

const PARAMETER_DOMAIN = "MEMORYOS-POLICY-RULE-PARAMETER-SCHEMA-1.0";
const RULE_MODEL_DOMAIN = "MEMORYOS-POLICY-RULE-MODEL-1.0";

export const MACHINE_DEFINITION_IDENTITIES = deepFreeze([
  {
    artifactPath: "definitions/memoryos-policy-fact-model-definition-1.0.0.json",
    canonicalByteCount: 33207,
    digestDomain: "MEMORYOS-POLICY-FACT-MODEL-1.0",
    expectedKind: "MemoryOSPolicyFactModelDefinition",
    expectedVersions: { contextVersion: "1.0.0", factModelVersion: "1.0.0", version: "1.0.0" },
    identityName: "factModelDigest",
    normativeDigest: "sha256:b36b9488161cb67d8e971e802d15ad76d662d46f96e1304182de343ba69ef7a8",
    ordinal: 1,
    rawSHA256: "sha256:7c21121c17895cea1a55ef29eeb0f566f27e259936d9ba4cae443caf8b6f5c70",
  },
  {
    artifactPath: "definitions/parameter-schema-require-verification-completed-1.0.0.json",
    canonicalByteCount: 295,
    digestDomain: PARAMETER_DOMAIN,
    expectedKind: "MemoryOSInvestigationPolicyRuleParameterSchema",
    expectedVersions: { parameterSchemaVersion: "1.0.0", ruleVersion: "1.0.0" },
    identityName: "parameterSchemaDigest:memoryos.require-verification-completed@1.0.0",
    normativeDigest: "sha256:c4f201e5640bfee2727c29207434e02eb0bd551edb10741af0e58f816cbb1fda",
    ordinal: 2,
    rawSHA256: "sha256:ac6711d4070e8f5ed42e50b2d15245235d583c24e4addcf96ee6c54d2d1f5b0e",
  },
  {
    artifactPath: "definitions/parameter-schema-require-replay-completed-1.0.0.json",
    canonicalByteCount: 283,
    digestDomain: PARAMETER_DOMAIN,
    expectedKind: "MemoryOSInvestigationPolicyRuleParameterSchema",
    expectedVersions: { parameterSchemaVersion: "1.0.0", ruleVersion: "1.0.0" },
    identityName: "parameterSchemaDigest:memoryos.require-replay-completed@1.0.0",
    normativeDigest: "sha256:d772f5d395accfe939392a55cbf01a276bb7b0f3bc22ad8ef020bfa702cfe1a8",
    ordinal: 3,
    rawSHA256: "sha256:b9351605f1b7ccc24d1e8983997a44a39b5eddfd6ee6fe4fcc6e5c5a11ccb308",
  },
  {
    artifactPath: "definitions/parameter-schema-require-artifact-cardinality-1.0.0.json",
    canonicalByteCount: 571,
    digestDomain: PARAMETER_DOMAIN,
    expectedKind: "MemoryOSInvestigationPolicyRuleParameterSchema",
    expectedVersions: { parameterSchemaVersion: "1.0.0", ruleVersion: "1.0.0" },
    identityName: "parameterSchemaDigest:memoryos.require-artifact-cardinality@1.0.0",
    normativeDigest: "sha256:cedd36cd2f4dc088e6f69b9899ed1f6726c41a447b4f1cad75fb8ed37a70eb4e",
    ordinal: 4,
    rawSHA256: "sha256:2fcf8964f8257e8db8ecf3fbb6264a3b468210b7e47b7cfed5bea34eba3bafcf",
  },
  {
    artifactPath: "definitions/parameter-schema-require-lifecycle-state-1.0.0.json",
    canonicalByteCount: 633,
    digestDomain: PARAMETER_DOMAIN,
    expectedKind: "MemoryOSInvestigationPolicyRuleParameterSchema",
    expectedVersions: { parameterSchemaVersion: "1.0.0", ruleVersion: "1.0.0" },
    identityName: "parameterSchemaDigest:memoryos.require-lifecycle-state@1.0.0",
    normativeDigest: "sha256:8983f9f126040c0fea2cca03dae5ee16942eb40739cfaa640404b9875e1cc050",
    ordinal: 5,
    rawSHA256: "sha256:8a5d87f830addf3f0ee7afbad2cc09fdf9c9242aa4e4e9122ea945e56c6722d1",
  },
  {
    artifactPath: "definitions/parameter-schema-prohibit-regression-findings-1.0.0.json",
    canonicalByteCount: 611,
    digestDomain: PARAMETER_DOMAIN,
    expectedKind: "MemoryOSInvestigationPolicyRuleParameterSchema",
    expectedVersions: { parameterSchemaVersion: "1.0.0", ruleVersion: "1.0.0" },
    identityName: "parameterSchemaDigest:memoryos.prohibit-regression-findings@1.0.0",
    normativeDigest: "sha256:36c22936984cd6ef3898ca26e9d36751d95669b875e341fedd559432c57d21ff",
    ordinal: 6,
    rawSHA256: "sha256:620df48fa29d6d9908a07388e8b8f29612edb333dfb462baa38ab5d9d5be47b2",
  },
  {
    artifactPath: "definitions/parameter-schema-require-mip-integrity-1.0.0.json",
    canonicalByteCount: 277,
    digestDomain: PARAMETER_DOMAIN,
    expectedKind: "MemoryOSInvestigationPolicyRuleParameterSchema",
    expectedVersions: { parameterSchemaVersion: "1.0.0", ruleVersion: "1.0.0" },
    identityName: "parameterSchemaDigest:memoryos.require-mip-integrity@1.0.0",
    normativeDigest: "sha256:39e891c4f6873d28567af3b01e50ab9c7330b7adb39d8bd9401f396587950e90",
    ordinal: 7,
    rawSHA256: "sha256:5ad65272d4ebd3f4ae44004a95b9fb8bbb1966c5e782319353c48966bf0ac4f1",
  },
  {
    artifactPath: "definitions/rule-model-require-verification-completed-1.0.0.json",
    canonicalByteCount: 3405,
    digestDomain: RULE_MODEL_DOMAIN,
    expectedKind: "MemoryOSInvestigationPolicyRuleModel",
    expectedVersions: { ruleModelVersion: "1.0.0", ruleVersion: "1.0.0" },
    identityName: "ruleModelDigest:memoryos.require-verification-completed@1.0.0",
    normativeDigest: "sha256:ae84ed91b85204ec1873a8dff0163b5b645b471950821b8f93e585137da41c62",
    ordinal: 8,
    rawSHA256: "sha256:93a2b879355453f93074a6e22fb5c02ab91f0d32262e9f9ce304aafc589cdd93",
  },
  {
    artifactPath: "definitions/rule-model-require-replay-completed-1.0.0.json",
    canonicalByteCount: 3362,
    digestDomain: RULE_MODEL_DOMAIN,
    expectedKind: "MemoryOSInvestigationPolicyRuleModel",
    expectedVersions: { ruleModelVersion: "1.0.0", ruleVersion: "1.0.0" },
    identityName: "ruleModelDigest:memoryos.require-replay-completed@1.0.0",
    normativeDigest: "sha256:74d0b26fbd4def080d858c5c742d35eac886b8ab8fd1e403a1e681091a55a9f1",
    ordinal: 9,
    rawSHA256: "sha256:d9c75456e77dc683b7596429764c32a2e4db86b58c0e7a6011c3675d26d983b5",
  },
  {
    artifactPath: "definitions/rule-model-require-artifact-cardinality-1.0.0.json",
    canonicalByteCount: 3922,
    digestDomain: RULE_MODEL_DOMAIN,
    expectedKind: "MemoryOSInvestigationPolicyRuleModel",
    expectedVersions: { ruleModelVersion: "1.0.0", ruleVersion: "1.0.0" },
    identityName: "ruleModelDigest:memoryos.require-artifact-cardinality@1.0.0",
    normativeDigest: "sha256:638230e094f4aa30b5df46288b131f8d62f540c81bf901bc04b423316d1e2d42",
    ordinal: 10,
    rawSHA256: "sha256:5c24cb817cba2c69f9373d110172d8e6aab44b7ecf57e58948d83cddb9eee8a8",
  },
  {
    artifactPath: "definitions/rule-model-require-lifecycle-state-1.0.0.json",
    canonicalByteCount: 2623,
    digestDomain: RULE_MODEL_DOMAIN,
    expectedKind: "MemoryOSInvestigationPolicyRuleModel",
    expectedVersions: { ruleModelVersion: "1.0.0", ruleVersion: "1.0.0" },
    identityName: "ruleModelDigest:memoryos.require-lifecycle-state@1.0.0",
    normativeDigest: "sha256:9e8a0642193f80ed6d672f6fc5a46364333f62b897f2dd774188040ae37ed36d",
    ordinal: 11,
    rawSHA256: "sha256:33195741df8452491c3cca1da113c68f2f656ed6251822247ac091851bdcebca",
  },
  {
    artifactPath: "definitions/rule-model-prohibit-regression-findings-1.0.0.json",
    canonicalByteCount: 2936,
    digestDomain: RULE_MODEL_DOMAIN,
    expectedKind: "MemoryOSInvestigationPolicyRuleModel",
    expectedVersions: { ruleModelVersion: "1.0.0", ruleVersion: "1.0.0" },
    identityName: "ruleModelDigest:memoryos.prohibit-regression-findings@1.0.0",
    normativeDigest: "sha256:c6e0a20af72c89f7d96f3a69fb9401c185a003aaa81cff01bccd112e02887dca",
    ordinal: 12,
    rawSHA256: "sha256:2b1ac4cc8ceb644925f9a59d4542ec1f1cf10b183618b3c26b49cbc4d7f3ed13",
  },
  {
    artifactPath: "definitions/rule-model-require-mip-integrity-1.0.0.json",
    canonicalByteCount: 2441,
    digestDomain: RULE_MODEL_DOMAIN,
    expectedKind: "MemoryOSInvestigationPolicyRuleModel",
    expectedVersions: { ruleModelVersion: "1.0.0", ruleVersion: "1.0.0" },
    identityName: "ruleModelDigest:memoryos.require-mip-integrity@1.0.0",
    normativeDigest: "sha256:e820f4f6986ffca3da888347ec684a2f76d5b9503e6b5e8c0152404c9a5f64d9",
    ordinal: 13,
    rawSHA256: "sha256:9e6e90760778f7ecd9b4e31a4d9125e8bb970261226cf92c56f7d6b1232a3d34",
  },
  {
    artifactPath: "definitions/rule-registry-1.0.0.json",
    canonicalByteCount: 2736,
    digestDomain: "MEMORYOS-POLICY-RULE-REGISTRY-1.0",
    expectedKind: "MemoryOSInvestigationPolicyRuleRegistry",
    expectedVersions: { ruleRegistryVersion: "1.0.0" },
    identityName: "ruleRegistryDigest",
    normativeDigest: "sha256:aaa19116563d209f680b063cdccf49d899069683f9778271c4ca2c4559b94fd7",
    ordinal: 14,
    rawSHA256: "sha256:630081c528855bcbd5ff9dc20082377b8cafcfc0249b86052e68be0eb4f9c43a",
  },
  {
    artifactPath: "definitions/regression-policy-fact-source-model-1.0.0.json",
    canonicalByteCount: 23040,
    digestDomain: "MEMORYOS-DETERMINISTIC-FACT-SOURCE-MODEL-1.0",
    expectedKind: "MemoryOSRegressionPolicyFactSourceModelDefinition",
    expectedVersions: { sourceModelVersion: "1.0.0", wireVersion: "1.0.0" },
    identityName: "sourceModelDigest:cognitiveRegression@1.0.0",
    normativeDigest: "sha256:e7d1fdf24758f2a0ac9ad609df578f95c058bf3cbab9f02a650f9cc12dab1c0d",
    ordinal: 15,
    rawSHA256: "sha256:a548f66522784563099519fb438f8ab8ba26d453855d43c5e1fe6a8ebe528ab9",
  },
  {
    artifactPath: "definitions/deterministic-fact-source-registry-1.0.0.json",
    canonicalByteCount: 427,
    digestDomain: "MEMORYOS-DETERMINISTIC-FACT-SOURCE-REGISTRY-1.0",
    expectedKind: "MemoryOSDeterministicFactSourceRegistry",
    expectedVersions: { registryVersion: "1.0.0" },
    identityName: "deterministicFactSourceRegistryDigest",
    normativeDigest: "sha256:392d688acb866753c6ff85b7030131b38990b27d8a2a0ef6e8e052c8c4e048de",
    ordinal: 16,
    rawSHA256: "sha256:5c0cf98b82d4b06689b77ac5edc6d00fdda42b1dae75e2f2fb0bd34bdac32582",
  },
]);

export const REGISTERED_LIFECYCLE_STATES = Object.freeze([
  "Created", "Observed", "Traced", "ReplayReady", "Replaying",
  "ReplayComplete", "ComparisonReady", "Comparing", "Verified", "Archived",
]);

export const REGISTERED_REGRESSION_CATEGORIES = Object.freeze([
  "replay", "reflection", "evidence", "retrieval", "evolution",
  "verification", "transition", "lifecycle",
]);

export const REGISTERED_ARTIFACT_CLASSES = Object.freeze([
  "evidence", "semanticTransformation", "retrieval", "reflection",
]);

export const REGISTERED_POLICY_RULES = deepFreeze({
  "memoryos.prohibit-regression-findings": {
    parameterContract: { kind: "registeredOrderedStringSetObject", member: "categories", maximumItems: 8, registeredOrder: REGISTERED_REGRESSION_CATEGORIES },
    version: "1.0.0",
  },
  "memoryos.require-artifact-cardinality": {
    parameterContract: { artifactClasses: REGISTERED_ARTIFACT_CLASSES, kind: "artifactCardinalityObject", maximum: 9007199254740991, minimum: 1 },
    version: "1.0.0",
  },
  "memoryos.require-lifecycle-state": {
    parameterContract: { kind: "registeredOrderedStringSetObject", member: "allowedStates", maximumItems: 10, registeredOrder: REGISTERED_LIFECYCLE_STATES },
    version: "1.0.0",
  },
  "memoryos.require-mip-integrity": { parameterContract: { kind: "emptyObject" }, version: "1.0.0" },
  "memoryos.require-replay-completed": { parameterContract: { kind: "emptyObject" }, version: "1.0.0" },
  "memoryos.require-verification-completed": { parameterContract: { kind: "emptyObject" }, version: "1.0.0" },
});

function byteEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false;
  return true;
}

export class MemoryOSMachineContractIntegrityError extends Error {
  constructor(message, artifactPath = undefined) {
    super(message);
    this.name = "MemoryOSMachineContractIntegrityError";
    if (artifactPath !== undefined) this.artifactPath = artifactPath;
  }
}

function integrityFailure(descriptor, reason) {
  throw new MemoryOSMachineContractIntegrityError(
    `Frozen machine definition ${descriptor.artifactPath} failed verification: ${reason}`,
    descriptor.artifactPath,
  );
}

export function verifyMachineContractDefinition(bytesLike, descriptor) {
  if (!MACHINE_DEFINITION_IDENTITIES.includes(descriptor)) {
    throw new TypeError("Machine-definition verification requires a frozen descriptor.");
  }
  const input = inspectByteInput(bytesLike, "Machine-definition bytes");
  if (input.byteLength !== descriptor.canonicalByteCount) {
    integrityFailure(descriptor, "byte count mismatch");
  }
  const bytes = input.snapshot();
  if (`sha256:${sha256Hex(bytes)}` !== descriptor.rawSHA256) integrityFailure(descriptor, "raw SHA-256 mismatch");
  let value;
  try {
    value = parseRestrictedJson(bytes);
  } catch {
    integrityFailure(descriptor, "restricted JSON invalid");
  }
  const canonical = canonicalizeRestrictedJson(value);
  if (!byteEqual(canonical, bytes)) integrityFailure(descriptor, "source bytes are not the frozen canonical bytes");
  if (value.kind !== descriptor.expectedKind) integrityFailure(descriptor, "kind mismatch");
  for (const [name, expected] of Object.entries(descriptor.expectedVersions)) {
    if (value[name] !== expected) integrityFailure(descriptor, `${name} mismatch`);
  }
  if (domainSeparatedDigest(descriptor.digestDomain, canonical) !== descriptor.normativeDigest) {
    integrityFailure(descriptor, "normative digest mismatch");
  }
  return deepFreeze(value);
}

function deriveRuntimeParameterContract(schema, registryDescriptor) {
  if (schema?.kind !== "closedObject" || !Array.isArray(schema.members)) {
    integrityFailure(registryDescriptor, "parameter schema is not a closed object");
  }
  if (schema.members.length === 0) return { kind: "emptyObject" };
  if (schema.members.length === 2
      && schema.members[0]?.name === "artifactClass"
      && schema.members[0]?.presence === "required"
      && schema.members[0]?.valueContract?.kind === "stringEnum"
      && Array.isArray(schema.members[0].valueContract.values)
      && schema.members[1]?.name === "minimumCount"
      && schema.members[1]?.presence === "required"
      && schema.members[1]?.valueContract?.kind === "safeInteger") {
    return {
      artifactClasses: schema.members[0].valueContract.values,
      kind: "artifactCardinalityObject",
      maximum: schema.members[1].valueContract.maximum,
      minimum: schema.members[1].valueContract.minimum,
    };
  }
  if (schema.members.length === 1) {
    const member = schema.members[0];
    const valueContract = member?.valueContract;
    if (member?.presence === "required"
        && valueContract?.kind === "registeredOrderedStringSet"
        && valueContract.inputOrder === "mustMatchRegisteredOrder"
        && valueContract.minimumItems === 1
        && valueContract.uniqueness === "required"
        && Array.isArray(valueContract.membersInCanonicalOrder)) {
      return {
        kind: "registeredOrderedStringSetObject",
        member: member.name,
        maximumItems: valueContract.maximumItems,
        registeredOrder: valueContract.membersInCanonicalOrder,
      };
    }
  }
  integrityFailure(registryDescriptor, "parameter schema has no registered runtime representation");
}

export function verifyRuntimePolicyContractBindings(verifiedDefinitions) {
  if (!Array.isArray(verifiedDefinitions)
      || verifiedDefinitions.length !== MACHINE_DEFINITION_IDENTITIES.length) {
    throw new TypeError("All verified machine definitions are required for runtime binding.");
  }
  const registryIndex = MACHINE_DEFINITION_IDENTITIES.findIndex(
    ({ expectedKind }) => expectedKind === "MemoryOSInvestigationPolicyRuleRegistry",
  );
  const registryDescriptor = MACHINE_DEFINITION_IDENTITIES[registryIndex];
  const registry = verifiedDefinitions[registryIndex];
  const schemas = new Map();
  const models = new Map();
  for (let index = 0; index < verifiedDefinitions.length; index += 1) {
    const value = verifiedDefinitions[index];
    const descriptor = MACHINE_DEFINITION_IDENTITIES[index];
    if (value?.kind === "MemoryOSInvestigationPolicyRuleParameterSchema") {
      if (schemas.has(value.ruleType)) integrityFailure(registryDescriptor, "duplicate parameter-schema rule type");
      schemas.set(value.ruleType, { descriptor, value });
    } else if (value?.kind === "MemoryOSInvestigationPolicyRuleModel") {
      if (models.has(value.ruleType)) integrityFailure(registryDescriptor, "duplicate rule-model rule type");
      models.set(value.ruleType, { descriptor, value });
    }
  }
  const runtimeTypes = Object.keys(REGISTERED_POLICY_RULES);
  const registryTypes = registry?.rules?.map(({ ruleType }) => ruleType);
  if (!Array.isArray(registryTypes)
      || schemas.size !== runtimeTypes.length
      || models.size !== runtimeTypes.length
      || !byteEqual(canonicalizeRestrictedJson(runtimeTypes), canonicalizeRestrictedJson(registryTypes))) {
    integrityFailure(registryDescriptor, "runtime rule inventory mismatch");
  }
  for (const row of registry.rules) {
    if (!Object.hasOwn(REGISTERED_POLICY_RULES, row.ruleType)) {
      integrityFailure(registryDescriptor, "runtime rule type is not registered");
    }
    const registration = REGISTERED_POLICY_RULES[row.ruleType];
    const schema = schemas.get(row.ruleType);
    const model = models.get(row.ruleType);
    if (registration.version !== row.ruleVersion
        || schema?.value.ruleVersion !== row.ruleVersion
        || schema?.value.identifier !== row.parameterSchemaIdentifier
        || schema?.descriptor.normativeDigest !== row.parameterSchemaDigest
        || model?.value.ruleVersion !== row.ruleVersion
        || model?.value.identifier !== row.ruleModelIdentifier
        || model?.descriptor.normativeDigest !== row.ruleModelDigest) {
      integrityFailure(registryDescriptor, `runtime binding mismatch for ${row.ruleType}`);
    }
    const derived = deriveRuntimeParameterContract(schema.value.schema, registryDescriptor);
    if (!byteEqual(
      canonicalizeRestrictedJson(derived),
      canonicalizeRestrictedJson(registration.parameterContract),
    )) {
      integrityFailure(registryDescriptor, `runtime parameter contract mismatch for ${row.ruleType}`);
    }
  }
  return true;
}

export async function verifyMachineContractDefinitions(loadBytes) {
  if (typeof loadBytes !== "function") throw new TypeError("A machine-definition byte loader is required.");
  const verified = [];
  for (const descriptor of MACHINE_DEFINITION_IDENTITIES) {
    verified.push(verifyMachineContractDefinition(await loadBytes(descriptor.artifactPath), descriptor));
  }
  verifyRuntimePolicyContractBindings(verified);
  return Object.freeze(verified);
}

function profileResourceFailure(limitIdentifier, configuredLimit) {
  throw new MemoryOSPolicyError(
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    `MemoryOS Policy Resource Profile exceeds ${limitIdentifier}.`,
    {
      artifactKind: "MemoryOSPolicyResourceProfile",
      configuredLimit,
      enforcementPhase: "0",
      limitIdentifier,
      observedAtLeast: configuredLimit + 1,
    },
  );
}

function profileFailure(code, message) {
  throw new MemoryOSPolicyError(code, message, {
    artifactKind: "MemoryOSPolicyResourceProfile",
    enforcementPhase: "0",
  });
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value);
  return actual.length === expected.length && expected.every((name) => Object.hasOwn(value, name));
}

export function verifyMemoryOSPolicyResourceProfile(bytesLike) {
  const rawLimit = RESOURCE_PROFILE_BOOTSTRAP_LIMITS["resource-profile.bootstrap.raw-document-bytes"];
  const input = inspectByteInput(bytesLike, "Resource-profile bytes");
  if (input.byteLength > rawLimit) {
    profileResourceFailure("resource-profile.bootstrap.raw-document-bytes", rawLimit);
  }
  const bytes = input.snapshot();

  let parsed;
  try {
    parsed = parseRestrictedJsonWithCensus(bytes, {
      maximumDepth: RESOURCE_PROFILE_BOOTSTRAP_LIMITS["resource-profile.bootstrap.json.nesting-depth"],
      maximumStringUtf8Bytes: RESOURCE_PROFILE_BOOTSTRAP_LIMITS["resource-profile.bootstrap.json.string-utf8-bytes"],
      maximumValueCount: RESOURCE_PROFILE_BOOTSTRAP_LIMITS["resource-profile.bootstrap.json.value-count"],
    });
  } catch {
    profileFailure("POLICY_RESOURCE_PROFILE_SYNTAX_INVALID", "Resource Profile is not valid restricted JSON.");
  }

  const { census } = parsed;
  for (const [limitIdentifier, observed] of [
    ["resource-profile.bootstrap.json.nesting-depth", census.maximumDepth],
    ["resource-profile.bootstrap.json.value-count", census.valueCount],
    ["resource-profile.bootstrap.json.string-utf8-bytes", census.maximumStringUtf8Bytes],
  ]) {
    const configured = RESOURCE_PROFILE_BOOTSTRAP_LIMITS[limitIdentifier];
    if (observed > configured) profileResourceFailure(limitIdentifier, configured);
  }
  const { value: profile } = parsed;

  if (!exactKeys(profile, ["identifier", "kind", "limits", "version"])
      || profile.kind !== "MemoryOSPolicyResourceProfile"
      || !isObject(profile.limits)) {
    profileFailure("POLICY_RESOURCE_PROFILE_SCHEMA_INVALID", "Resource Profile has an invalid closed shape.");
  }
  if (typeof profile.identifier !== "string" || !isDottedIdentifier(profile.identifier)) {
    profileFailure("POLICY_RESOURCE_PROFILE_SCHEMA_INVALID", "Resource Profile identifier is malformed.");
  }
  if (typeof profile.version !== "string" || !isStableSemVer(profile.version)) {
    profileFailure("POLICY_RESOURCE_PROFILE_SCHEMA_INVALID", "Resource Profile version is not stable SemVer.");
  }
  const expectedLimitNames = Object.keys(MEMORYOS_POLICY_RESOURCE_PROFILE.limits);
  if (!exactKeys(profile.limits, expectedLimitNames)
      || Object.values(profile.limits).some(
        (limit) => !Number.isSafeInteger(limit) || limit < 1 || limit > 9007199254740990,
      )) {
    profileFailure("POLICY_RESOURCE_PROFILE_SCHEMA_INVALID", "Resource Profile limit inventory is invalid.");
  }
  if (profile.identifier !== MEMORYOS_POLICY_RESOURCE_PROFILE.identifier) {
    profileFailure("POLICY_RESOURCE_PROFILE_IDENTIFIER_UNSUPPORTED", "Resource Profile identifier is unsupported.");
  }
  if (profile.version !== MEMORYOS_POLICY_RESOURCE_PROFILE.version) {
    profileFailure("POLICY_RESOURCE_PROFILE_VERSION_UNSUPPORTED", "Resource Profile version is unsupported.");
  }

  const canonical = canonicalizeRestrictedJson(profile);
  if (!byteEqual(canonical, bytes)
      || bytes.length !== MEMORYOS_POLICY_RESOURCE_PROFILE_BYTE_COUNT
      || `sha256:${sha256Hex(bytes)}` !== MEMORYOS_POLICY_RESOURCE_PROFILE_RAW_SHA256
      || domainSeparatedDigest(MEMORYOS_POLICY_RESOURCE_PROFILE_DOMAIN, canonical)
        !== MEMORYOS_POLICY_RESOURCE_PROFILE_DIGEST) {
    profileFailure("POLICY_RESOURCE_PROFILE_DIGEST_MISMATCH", "Resource Profile bytes or digest do not match the frozen profile.");
  }
  for (const [identifier, expected] of Object.entries(MEMORYOS_POLICY_RESOURCE_PROFILE.limits)) {
    if (profile.limits[identifier] !== expected) {
      profileFailure("POLICY_RESOURCE_PROFILE_DIGEST_MISMATCH", "Resource Profile limit values do not match the frozen profile.");
    }
  }
  return deepFreeze(profile);
}
