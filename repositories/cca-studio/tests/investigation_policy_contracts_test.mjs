import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { sha256Hex } from "../web/js/mip-canonical.js";
import {
  MACHINE_DEFINITION_IDENTITIES,
  MEMORYOS_POLICY_RESOURCE_PROFILE,
  MEMORYOS_POLICY_RESOURCE_PROFILE_BYTE_COUNT,
  MEMORYOS_POLICY_RESOURCE_PROFILE_DIGEST,
  MEMORYOS_POLICY_RESOURCE_PROFILE_DOMAIN,
  MEMORYOS_POLICY_RESOURCE_PROFILE_RAW_SHA256,
  MemoryOSMachineContractIntegrityError,
  REGISTERED_ARTIFACT_CLASSES,
  REGISTERED_LIFECYCLE_STATES,
  REGISTERED_POLICY_RULES,
  REGISTERED_REGRESSION_CATEGORIES,
  RESOURCE_PROFILE_BOOTSTRAP_LIMITS,
  verifyMachineContractDefinition,
  verifyMachineContractDefinitions,
  verifyMemoryOSPolicyResourceProfile,
} from "../web/js/investigation-policy-contracts.js";
import {
  MemoryOSPolicyError,
  canonicalizeRestrictedJson,
  domainSeparatedDigest,
  parseRestrictedJson,
  utf8Encode,
} from "../web/js/policy-canonical.js";

const dataRoot = new URL("../web/data/investigation-policy/1.0.0/", import.meta.url);
const readData = (relative) => readFile(new URL(relative, dataRoot));
const clone = (value) => structuredClone(value);

function expectCode(operation, code, limitIdentifier = undefined) {
  assert.throws(operation, (error) => {
    assert.ok(error instanceof MemoryOSPolicyError);
    assert.equal(error.code, code);
    if (limitIdentifier !== undefined) {
      assert.equal(error.limitIdentifier, limitIdentifier);
      assert.equal(error.observedAtLeast, error.configuredLimit + 1);
    }
    return true;
  });
}

test("the exact frozen Resource Profile bytes, digest, and 31-limit inventory verify", async () => {
  const raw = await readData("memoryos-policy-resource-profile-standard-1.0.0.json");
  const verified = verifyMemoryOSPolicyResourceProfile(raw);
  assert.equal(raw.length, MEMORYOS_POLICY_RESOURCE_PROFILE_BYTE_COUNT);
  assert.equal(`sha256:${sha256Hex(raw)}`, MEMORYOS_POLICY_RESOURCE_PROFILE_RAW_SHA256);
  assert.equal(domainSeparatedDigest(MEMORYOS_POLICY_RESOURCE_PROFILE_DOMAIN, raw), MEMORYOS_POLICY_RESOURCE_PROFILE_DIGEST);
  assert.deepEqual(canonicalizeRestrictedJson(verified), canonicalizeRestrictedJson(MEMORYOS_POLICY_RESOURCE_PROFILE));
  assert.equal(Object.keys(verified.limits).length, 31);
  assert.equal(verified.limits["evaluation.outcome-canonical-bytes"], 4060);
  assert.equal(raw.at(-1), 0x7d);
});

test("Resource Profile raw bootstrap accepts below/exact and rejects first above deterministically", async () => {
  const raw = await readData("memoryos-policy-resource-profile-standard-1.0.0.json");
  assert.doesNotThrow(() => verifyMemoryOSPolicyResourceProfile(raw));
  const limit = RESOURCE_PROFILE_BOOTSTRAP_LIMITS["resource-profile.bootstrap.raw-document-bytes"];
  const exact = Buffer.concat([raw, Buffer.alloc(limit - raw.length, 0x20)]);
  expectCode(() => verifyMemoryOSPolicyResourceProfile(exact), "POLICY_RESOURCE_PROFILE_DIGEST_MISMATCH");
  const above = Buffer.concat([exact, Buffer.of(0x20)]);
  expectCode(
    () => verifyMemoryOSPolicyResourceProfile(above),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "resource-profile.bootstrap.raw-document-bytes",
  );
  const deceptive = new Uint8Array(limit + 1);
  Object.defineProperties(deceptive, {
    buffer: { get: () => new ArrayBuffer(1) },
    byteLength: { get: () => 1 },
    byteOffset: { get: () => 0 },
  });
  expectCode(
    () => verifyMemoryOSPolicyResourceProfile(deceptive),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "resource-profile.bootstrap.raw-document-bytes",
  );
});

test("Resource Profile depth bootstrap enforces exact and first-above before schema", () => {
  const exact = utf8Encode('{"x":[[[]]]}');
  expectCode(() => verifyMemoryOSPolicyResourceProfile(exact), "POLICY_RESOURCE_PROFILE_SCHEMA_INVALID");
  const above = utf8Encode('{"x":[[[[]]]]}');
  expectCode(
    () => verifyMemoryOSPolicyResourceProfile(above),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "resource-profile.bootstrap.json.nesting-depth",
  );
});

test("Resource Profile value-count bootstrap enforces exact and first-above before schema", () => {
  const exact = utf8Encode(JSON.stringify(Array.from({ length: 63 }, () => 0)));
  expectCode(() => verifyMemoryOSPolicyResourceProfile(exact), "POLICY_RESOURCE_PROFILE_SCHEMA_INVALID");
  const above = utf8Encode(JSON.stringify(Array.from({ length: 64 }, () => 0)));
  expectCode(
    () => verifyMemoryOSPolicyResourceProfile(above),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "resource-profile.bootstrap.json.value-count",
  );
});

test("Resource Profile decoded-string bootstrap enforces exact and first-above before schema", () => {
  const exact = utf8Encode(JSON.stringify("a".repeat(128)));
  expectCode(() => verifyMemoryOSPolicyResourceProfile(exact), "POLICY_RESOURCE_PROFILE_SCHEMA_INVALID");
  const above = utf8Encode(JSON.stringify("a".repeat(129)));
  expectCode(
    () => verifyMemoryOSPolicyResourceProfile(above),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "resource-profile.bootstrap.json.string-utf8-bytes",
  );
});

test("Resource Profile completes syntax validation before classifying bootstrap counters", () => {
  expectCode(
    () => verifyMemoryOSPolicyResourceProfile(utf8Encode("[[[[[")),
    "POLICY_RESOURCE_PROFILE_SYNTAX_INVALID",
  );
  expectCode(
    () => verifyMemoryOSPolicyResourceProfile(utf8Encode(`[${"0,".repeat(64)}`)),
    "POLICY_RESOURCE_PROFILE_SYNTAX_INVALID",
  );
  expectCode(
    () => verifyMemoryOSPolicyResourceProfile(utf8Encode(`${JSON.stringify("a".repeat(129))}x`)),
    "POLICY_RESOURCE_PROFILE_SYNTAX_INVALID",
  );
  expectCode(
    () => verifyMemoryOSPolicyResourceProfile(utf8Encode(JSON.stringify({ a: [[[["x".repeat(129)]]]] }))),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "resource-profile.bootstrap.json.nesting-depth",
  );
  expectCode(
    () => verifyMemoryOSPolicyResourceProfile(utf8Encode(JSON.stringify([
      "x".repeat(129), ...Array.from({ length: 63 }, () => 0),
    ]))),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "resource-profile.bootstrap.json.value-count",
  );
});

test("Resource Profile bootstrap completes the deepest raw-bounded syntax envelopes", () => {
  const deepestValid = `${"[".repeat(2047)}0${"]".repeat(2047)}`;
  assert.equal(utf8Encode(deepestValid).length, 4095);
  expectCode(
    () => verifyMemoryOSPolicyResourceProfile(utf8Encode(deepestValid)),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "resource-profile.bootstrap.json.nesting-depth",
  );
  const deepestMalformed = "[".repeat(4096);
  assert.equal(utf8Encode(deepestMalformed).length, 4096);
  expectCode(
    () => verifyMemoryOSPolicyResourceProfile(utf8Encode(deepestMalformed)),
    "POLICY_RESOURCE_PROFILE_SYNTAX_INVALID",
  );
});

test("Resource Profile validation rejects syntax, unknown members, identity, and version precisely", async () => {
  expectCode(() => verifyMemoryOSPolicyResourceProfile(utf8Encode("{")), "POLICY_RESOURCE_PROFILE_SYNTAX_INVALID");
  const unknown = clone(MEMORYOS_POLICY_RESOURCE_PROFILE);
  unknown.extra = true;
  expectCode(() => verifyMemoryOSPolicyResourceProfile(canonicalizeRestrictedJson(unknown)), "POLICY_RESOURCE_PROFILE_SCHEMA_INVALID");
  const identifier = clone(MEMORYOS_POLICY_RESOURCE_PROFILE);
  identifier.identifier = "memoryos.policy.resource-profile.other";
  expectCode(() => verifyMemoryOSPolicyResourceProfile(canonicalizeRestrictedJson(identifier)), "POLICY_RESOURCE_PROFILE_IDENTIFIER_UNSUPPORTED");
  const malformedIdentifier = clone(MEMORYOS_POLICY_RESOURCE_PROFILE);
  malformedIdentifier.identifier = "MemoryOS";
  expectCode(() => verifyMemoryOSPolicyResourceProfile(canonicalizeRestrictedJson(malformedIdentifier)), "POLICY_RESOURCE_PROFILE_SCHEMA_INVALID");
  const version = clone(MEMORYOS_POLICY_RESOURCE_PROFILE);
  version.version = "2.0.0";
  expectCode(() => verifyMemoryOSPolicyResourceProfile(canonicalizeRestrictedJson(version)), "POLICY_RESOURCE_PROFILE_VERSION_UNSUPPORTED");
  const identifierBeforeVersion = clone(version);
  identifierBeforeVersion.identifier = "memoryos.policy.resource-profile.other";
  expectCode(() => verifyMemoryOSPolicyResourceProfile(canonicalizeRestrictedJson(identifierBeforeVersion)), "POLICY_RESOURCE_PROFILE_IDENTIFIER_UNSUPPORTED");
  for (const invalidLimit of [0, 9007199254740991]) {
    const invalid = clone(MEMORYOS_POLICY_RESOURCE_PROFILE);
    invalid.limits["evaluation.outcome-canonical-bytes"] = invalidLimit;
    expectCode(() => verifyMemoryOSPolicyResourceProfile(canonicalizeRestrictedJson(invalid)), "POLICY_RESOURCE_PROFILE_SCHEMA_INVALID");
  }
});

test("all 16 immutable machine definitions reproduce exact bytes and normative identities", async () => {
  const verified = await verifyMachineContractDefinitions(readData);
  assert.equal(verified.length, 16);
  for (const descriptor of MACHINE_DEFINITION_IDENTITIES) {
    const raw = await readData(descriptor.artifactPath);
    assert.equal(raw.length, descriptor.canonicalByteCount, descriptor.identityName);
    assert.equal(`sha256:${sha256Hex(raw)}`, descriptor.rawSHA256, descriptor.identityName);
    assert.deepEqual(canonicalizeRestrictedJson(parseRestrictedJson(raw)), new Uint8Array(raw), descriptor.identityName);
    assert.equal(domainSeparatedDigest(descriptor.digestDomain, raw), descriptor.normativeDigest, descriptor.identityName);
  }
  assert.ok(Object.isFrozen(verified[0]));
  assert.ok(Object.isFrozen(verified[0].domains));
  assert.throws(() => { verified[0].version = "2.0.0"; }, TypeError);
});

test("runtime rule preparation contracts exhaustively match the frozen registry and parameter schemas", async () => {
  const definitionValues = await Promise.all(MACHINE_DEFINITION_IDENTITIES.map(async ({ artifactPath }) => (
    parseRestrictedJson(await readData(artifactPath))
  )));
  const registry = definitionValues.find(({ kind }) => kind === "MemoryOSInvestigationPolicyRuleRegistry");
  const schemas = new Map(definitionValues
    .filter(({ kind }) => kind === "MemoryOSInvestigationPolicyRuleParameterSchema")
    .map((schema) => [schema.ruleType, schema]));
  assert.deepEqual(Object.keys(REGISTERED_POLICY_RULES), registry.rules.map(({ ruleType }) => ruleType));
  assert.equal(schemas.size, 6);
  for (const row of registry.rules) {
    const schema = schemas.get(row.ruleType);
    const runtime = REGISTERED_POLICY_RULES[row.ruleType];
    assert.equal(runtime.version, row.ruleVersion);
    assert.equal(schema.ruleVersion, row.ruleVersion);
    assert.equal(schema.identifier, row.parameterSchemaIdentifier);
    if (schema.schema.members.length === 0) {
      assert.deepEqual(runtime.parameterContract, { kind: "emptyObject" });
    } else if (row.ruleType === "memoryos.require-artifact-cardinality") {
      assert.deepEqual(runtime.parameterContract, {
        artifactClasses: REGISTERED_ARTIFACT_CLASSES,
        kind: "artifactCardinalityObject",
        maximum: schema.schema.members[1].valueContract.maximum,
        minimum: schema.schema.members[1].valueContract.minimum,
      });
      assert.deepEqual(schema.schema.members[0].valueContract.values, REGISTERED_ARTIFACT_CLASSES);
    } else {
      const member = schema.schema.members[0];
      const expectedOrder = row.ruleType === "memoryos.require-lifecycle-state"
        ? REGISTERED_LIFECYCLE_STATES
        : REGISTERED_REGRESSION_CATEGORIES;
      assert.deepEqual(member.valueContract.membersInCanonicalOrder, expectedOrder);
      assert.deepEqual(runtime.parameterContract, {
        kind: "registeredOrderedStringSetObject",
        maximumItems: member.valueContract.maximumItems,
        member: member.name,
        registeredOrder: expectedOrder,
      });
      assert.equal(member.valueContract.minimumItems, 1);
      assert.equal(member.valueContract.uniqueness, "required");
      assert.equal(member.valueContract.inputOrder, "mustMatchRegisteredOrder");
    }
  }
});

test("the frozen definition manifest cross-binds the independent descriptor table", async () => {
  const raw = await readData("definition-manifest.json");
  assert.equal(raw.length, 6838);
  assert.equal(`sha256:${sha256Hex(raw)}`, "sha256:50b60f6dcc613e524ff14c3a794a316f9ef668e2d7e64974c711052446104bd2");
  assert.deepEqual(canonicalizeRestrictedJson(parseRestrictedJson(raw)), new Uint8Array(raw));
  const manifest = parseRestrictedJson(raw);
  assert.equal(manifest.kind, "MemoryOSMachineReadableContractDefinitionManifest");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.identityCount, 16);
  assert.deepEqual(
    manifest.identities.map(({ artifactPath, canonicalByteCount, digestDomain, identityName, normativeDigest, ordinal, rawSHA256 }) => ({ artifactPath, canonicalByteCount, digestDomain, identityName, normativeDigest, ordinal, rawSHA256 })),
    MACHINE_DEFINITION_IDENTITIES.map(({ artifactPath, canonicalByteCount, digestDomain, identityName, normativeDigest, ordinal, rawSHA256 }) => ({ artifactPath, canonicalByteCount, digestDomain, identityName, normativeDigest, ordinal, rawSHA256 })),
  );
});

test("machine-definition verification fails closed for altered bytes and a wrong version", async () => {
  const descriptor = MACHINE_DEFINITION_IDENTITIES[1];
  const raw = await readData(descriptor.artifactPath);
  const altered = Buffer.from(raw);
  altered[altered.length - 2] = altered[altered.length - 2] === 0x5d ? 0x20 : 0x5d;
  assert.throws(() => verifyMachineContractDefinition(altered, descriptor), MemoryOSMachineContractIntegrityError);

  const value = parseRestrictedJson(raw);
  value.parameterSchemaVersion = "2.0.0";
  const wrongVersion = canonicalizeRestrictedJson(value);
  assert.equal(wrongVersion.length, descriptor.canonicalByteCount);
  assert.throws(
    () => verifyMachineContractDefinition(wrongVersion, descriptor),
    MemoryOSMachineContractIntegrityError,
  );
});

test("verified Resource Profile data is deeply immutable", async () => {
  const verified = verifyMemoryOSPolicyResourceProfile(
    await readData("memoryos-policy-resource-profile-standard-1.0.0.json"),
  );
  assert.ok(Object.isFrozen(verified));
  assert.ok(Object.isFrozen(verified.limits));
  assert.throws(() => { verified.limits["json.nesting-depth"] = 17; }, TypeError);
});

test("installed machine definitions contain no sizing placeholder identity", async () => {
  const texts = await Promise.all(MACHINE_DEFINITION_IDENTITIES.map(async ({ artifactPath }) => (await readData(artifactPath)).toString("utf8")));
  const joined = texts.join("\n");
  assert.doesNotMatch(joined, /(?:__[^_]*SIZE[^_]*__|PLACEHOLDER|SIZING[_ -]?TOKEN|TO[_ -]?BE[_ -]?SIZED)/iu);
});
