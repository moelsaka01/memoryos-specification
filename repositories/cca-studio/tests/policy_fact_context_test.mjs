import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { referenceSnapshot } from "../web/data/studio-snapshot.js";
import { InvestigationCore } from "../web/js/investigation-core.js";
import { MEMORYOS_POLICY_RESOURCE_PROFILE } from "../web/js/investigation-policy-contracts.js";
import { exportMemoryInvestigationPackage } from "../web/js/memory-investigation-package.js";
import {
  POLICY_FACT_CONTEXT_DOMAIN_ORDER,
  POLICY_FACT_CONTEXT_FAILURE_CODES,
  POLICY_FACT_CONTEXT_RESOURCE_LIMIT_IDENTIFIERS,
  assertAuthoritativePolicyFactContext,
  capturePolicyFactContext,
  policyFactContextCanonicalBytes,
  policyFactContextDigest,
  policyFactIdentifier,
  preparePolicyFactContext,
  projectPolicyFactContext,
  validatePolicyFactContext,
} from "../web/js/policy-fact-context.js";
import {
  MemoryOSPolicyError,
  canonicalizeRestrictedJson,
  utf8Encode,
} from "../web/js/policy-canonical.js";

const clone = (value) => structuredClone(value);
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const goldenPath = new URL(
  "./fixtures/investigation-policy/1.0.0/final-evaluation-identity-outcome-golden-vectors.json",
  import.meta.url,
);
const boundaryManifestPath = new URL(
  "./fixtures/investigation-policy/1.0.0/boundary-v2-manifest.json",
  import.meta.url,
);
const expectedDomains = [
  "lifecycle",
  "transitions",
  "observations",
  "artifactCardinalities",
  "activeTrace",
  "activeReplay",
  "activeEvolution",
  "activeComparativeReconstruction",
  "verification",
  "mipIntegrity",
  "compatibility",
];
const artifactClasses = ["evidence", "semanticTransformation", "retrieval", "reflection"];
const nativeCompatibility = [
  ["nativeObservationProfileIdentifier", "cca-studio-native-observation"],
  ["nativeObservationProfileVersion", "1.1.0"],
  ["nativeSnapshotContract", "CCA-STUDIO-1.0"],
];
const mipCompatibility = [
  ["mipCanonicalizationProfile", "RFC8785"],
  ["mipDigestProfile", "SHA-256"],
  ["mipFormatVersion", "1.0.0"],
  ["mipSchema", "urn:memoryos:mip:schema:1.0.0"],
  ["mipValidationProfile", "MIP-CORE-1.0"],
];

let goldenRecords;
async function goldenContextDigest(recordId) {
  goldenRecords ??= JSON.parse(await readFile(goldenPath, "utf8")).records;
  const record = goldenRecords.find((entry) => entry.recordId === recordId);
  assert.ok(record, `missing frozen golden record ${recordId}`);
  return record.logicalEvaluationIdentity.policyFactContext.contextDigest;
}

async function mipFixture(name = "complete-investigation.mip.b64") {
  const encoded = await readFile(new URL(`./fixtures/mip/${name}`, import.meta.url), "ascii");
  return new Uint8Array(Buffer.from(encoded.trim(), "base64"));
}

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

function assertDeepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

function countFacts(context) {
  return Object.values(context.facts).reduce(
    (total, state) => total + (state.availability === "available" ? state.items.length : 0),
    0,
  );
}

function assertFactIdentifiersAndOrder(context) {
  for (const domain of expectedDomains) {
    const state = context.facts[domain];
    if (state.availability !== "available") continue;
    for (const item of state.items) {
      assert.equal(item.factIdentifier, policyFactIdentifier(domain, item.subject), domain);
    }
  }
  context.facts.transitions.items.forEach((item, index) => assert.equal(item.value.index, index));
  context.facts.observations.items.forEach((item, index) => assert.equal(item.subject.position, index));
  context.facts.artifactCardinalities.items.forEach((item, index) => {
    const observation = context.facts.observations.items[Math.floor(index / artifactClasses.length)];
    assert.equal(item.subject.observationFactIdentifier, observation.factIdentifier);
    assert.equal(item.subject.artifactClass, artifactClasses[index % artifactClasses.length]);
  });
}

function assertContextShape(prepared, sourceKind, compatibility) {
  assert.deepEqual(Object.keys(prepared), [
    "kind", "version", "factModelVersion", "contextDigest", "artifact",
  ]);
  assert.equal(Object.isFrozen(prepared), true);
  assert.match(prepared.contextDigest, digestPattern);
  const { artifact } = prepared;
  assert.deepEqual(Object.keys(artifact).sort(), [
    "factModelVersion", "facts", "investigation", "kind", "transitionLog", "version",
  ].sort());
  assert.deepEqual(Object.keys(artifact.investigation).sort(), [
    "identifier", "sourceKind", "workspaceIdentifier",
  ].sort());
  assert.equal(Object.hasOwn(artifact.investigation, "sourceIdentifier"), false);
  assert.equal(artifact.investigation.sourceKind, sourceKind);
  assert.deepEqual(Object.keys(artifact.facts), expectedDomains);
  assert.deepEqual(POLICY_FACT_CONTEXT_DOMAIN_ORDER, expectedDomains);
  for (const domain of expectedDomains) {
    const expectedAvailability = domain === "mipIntegrity" && sourceKind === "native"
      ? "notApplicable"
      : "available";
    assert.equal(artifact.facts[domain].availability, expectedAvailability, domain);
  }
  assert.deepEqual(
    artifact.facts.compatibility.items.map(({ subject, value }) => [subject.name, value.value]),
    compatibility,
  );
  assertFactIdentifiersAndOrder(artifact);
  assertDeepFrozen(artifact);
}

function nativeContext(identifier = "investigation-native-reference") {
  const core = new InvestigationCore();
  core.create({ identifier, snapshot: referenceSnapshot });
  return { core, prepared: capturePolicyFactContext(core, identifier) };
}

function transitionBoundaryContext(base, count) {
  const context = clone(base);
  context.facts.transitions.items = Array.from({ length: count }, (_, index) => {
    const identifier = `sha256:${index.toString(16).padStart(64, "0")}`;
    const subject = { identifier };
    return {
      factIdentifier: policyFactIdentifier("transitions", subject),
      subject,
      value: { index, kind: index === 0 ? "CREATED" : "OBSERVED" },
    };
  });
  context.transitionLog.transitionCount = count;
  context.transitionLog.headTransitionIdentifier = context.facts.transitions.items.at(-1).subject.identifier;
  return context;
}

function extensionName(index, length) {
  const first = `a${String(index).padStart(2, "0")}${"a".repeat(60)}`;
  const second = "b".repeat(63);
  const third = "c".repeat(length - first.length - second.length - 2);
  return `${first}.${second}.${third}`;
}

function canonicalBoundaryContext(base, targetByteCount) {
  const context = clone(base);
  const featureCount = 50;
  const currentByteCount = canonicalizeRestrictedJson(context).length;
  const totalNameBytes = targetByteCount - currentByteCount - (3 * featureCount - 1);
  const floor = Math.floor(totalNameBytes / featureCount);
  const remainder = totalNameBytes % featureCount;
  assert.ok(floor >= 129 && floor < 191);
  context.facts.mipIntegrity.items[0].value.features.optional = Array.from(
    { length: featureCount },
    (_, index) => extensionName(index, floor + (index >= featureCount - remainder ? 1 : 0)),
  );
  assert.equal(canonicalizeRestrictedJson(context).length, targetByteCount);
  return context;
}

async function activeMipContext() {
  const sourceCore = new InvestigationCore();
  const sourceInvestigation = sourceCore.import(await mipFixture(), {
    identifier: "capability-source-complete",
  });
  const sourcePackage = sourceInvestigation.state.package;
  const observation = sourcePackage.observations[0];
  const trace = sourcePackage.traces.find((entry) => (
    entry.observationIdentifier === observation.identifier
  ));
  const replay = sourcePackage.replays.find((entry) => entry.traceIdentifier === trace?.identifier);
  assert.ok(trace && replay);
  const bytes = exportMemoryInvestigationPackage({
    packageIdentifier: "i",
    workspaceIdentifier: sourcePackage.manifest.workspaceIdentifier,
    metadata: sourcePackage.metadata,
    observations: [observation],
    traces: [trace],
    replays: [replay],
    evolutions: [],
    comparativeReconstructions: [],
    extensions: {},
    sourceAccepted: true,
    sourceAuthorshipAttested: true,
  });
  const core = new InvestigationCore();
  core.import(bytes, { identifier: "i" });
  core.trace("i", trace.identifier);
  let guard = 0;
  while (core.load("i").state.replayState.status !== "completed") {
    core.replay("i", "next");
    assert.ok((guard += 1) < 1000);
  }
  core.verify("i");
  return { core, prepared: capturePolicyFactContext(core, "i") };
}

test("native capture is the closed immutable Fact Model 1.0.0 projection and matches the frozen vector", async () => {
  const { core, prepared } = nativeContext();
  assertContextShape(prepared, "native", nativeCompatibility);
  assert.equal(prepared.contextDigest, await goldenContextDigest("vector-policy-native-no-regression"));
  assert.equal(prepared.contextDigest, "sha256:33692b902a37080b69a2f6f3c62cbdc70a60ece98779b60125fc0ff10a770e0d");
  assert.equal(prepared.artifact.facts.mipIntegrity.availability, "notApplicable");
  assert.deepEqual(prepared.artifact.facts.activeTrace.items, []);
  assert.deepEqual(prepared.artifact.facts.activeReplay.items, []);
  assert.deepEqual(prepared.artifact.facts.activeEvolution.items, []);
  assert.deepEqual(prepared.artifact.facts.activeComparativeReconstruction.items, []);
  assert.deepEqual(prepared.artifact.facts.verification.items, []);
  assert.equal(
    prepared.artifact.facts.lifecycle.items[0].factIdentifier,
    "sha256:f1ff5ef29cf24a457696116afdd7764dfeb8f40146a17b75fb54ccd168f599ce",
  );
  assert.equal(
    prepared.artifact.facts.observations.items[0].factIdentifier,
    "sha256:853cca22d794e52e39ae29acfaef0fe8aa6f55c06b1f495da757485a473613d3",
  );
  const canonical = canonicalizeRestrictedJson(prepared.artifact);
  assert.deepEqual(prepared.canonicalBytes(), canonical);
  assert.deepEqual(policyFactContextCanonicalBytes(prepared), canonical);
  assert.equal(policyFactContextDigest(prepared), prepared.contextDigest);
  assert.equal(policyFactContextDigest(prepared.artifact), prepared.contextDigest);
  assert.equal(validatePolicyFactContext(prepared.artifact), true);
  assert.equal(assertAuthoritativePolicyFactContext(prepared, core), true);
  const callerCopy = prepared.canonicalBytes();
  callerCopy[0] ^= 0xff;
  assert.deepEqual(prepared.canonicalBytes(), canonical);
});

test("point-in-time capture atomically binds one Core state and keeps earlier facts immutable", async () => {
  const identifier = "cf5b2-point-in-time";
  const core = new InvestigationCore();
  core.create({ identifier, snapshot: clone(referenceSnapshot) });
  const before = capturePolicyFactContext(core, identifier);
  const beforeBytes = before.canonicalBytes();
  core.observe(identifier, {
    operation: "CF5B2AdditionalObservation",
    snapshot: clone(referenceSnapshot),
  });
  const after = capturePolicyFactContext(core, identifier);
  assert.equal(before.contextDigest, await goldenContextDigest("vector-transition-before"));
  assert.equal(after.contextDigest, await goldenContextDigest("vector-transition-after"));
  assert.equal(before.artifact.transitionLog.transitionCount, 2);
  assert.equal(after.artifact.transitionLog.transitionCount, 3);
  assert.equal(before.artifact.facts.observations.items.length, 1);
  assert.equal(after.artifact.facts.observations.items.length, 2);
  assert.equal(
    before.artifact.facts.lifecycle.items[0].factIdentifier,
    after.artifact.facts.lifecycle.items[0].factIdentifier,
    "fact identifiers are context-local subject identities, not global evidence identities",
  );
  assert.notEqual(before.contextDigest, after.contextDigest);
  assert.deepEqual(before.canonicalBytes(), beforeBytes);
  assert.throws(() => { before.artifact.version = "2.0.0"; }, TypeError);
  expectCode(
    () => capturePolicyFactContext(core, "missing-investigation"),
    "POLICY_FACT_CONTEXT_ATOMIC_CAPTURE_FAILED",
  );
  expectCode(
    () => projectPolicyFactContext({}),
    "POLICY_FACT_CONTEXT_SOURCE_STATE_INVALID",
  );
});

test("transition binding never consults a mutable Array.prototype.at", () => {
  const identifier = "transition-head-intrinsic-hardening";
  const core = new InvestigationCore();
  core.create({ identifier, snapshot: clone(referenceSnapshot) });
  core.observe(identifier, {
    operation: "AdditionalObservation",
    snapshot: clone(referenceSnapshot),
  });
  const retainedLog = core.load(identifier).transitionLog;
  const expectedHead = retainedLog.transitions[retainedLog.transitions.length - 1].identifier;
  const originalAt = Array.prototype.at;
  let prepared;
  try {
    Array.prototype.at = function poisonedAt() { return this[0]; };
    prepared = capturePolicyFactContext(core, identifier);
  } finally {
    Array.prototype.at = originalAt;
  }
  assert.equal(prepared.artifact.transitionLog.headTransitionIdentifier, expectedHead);
  assert.equal(
    prepared.artifact.facts.transitions.items[
      prepared.artifact.facts.transitions.items.length - 1
    ].subject.identifier,
    expectedHead,
  );
  assert.equal(assertAuthoritativePolicyFactContext(prepared, core), true);
});

test("MIP inventory alone never manufactures local active-artifact state", async () => {
  const core = new InvestigationCore();
  const imported = core.import(await mipFixture(), { identifier: "investigation-context-mip-inventory" });
  const prepared = capturePolicyFactContext(core, imported.identifier);
  assertContextShape(prepared, "mip", mipCompatibility);
  const mipFact = prepared.artifact.facts.mipIntegrity.items[0];
  assert.equal(mipFact.subject.packageIdentifier, imported.state.package.manifest.packageIdentifier);
  assert.deepEqual(mipFact.value.inventory, {
    comparativeReconstructions: 1,
    evolutions: 1,
    observations: 2,
    replays: 2,
    traces: 2,
  });
  for (const domain of [
    "activeTrace", "activeReplay", "activeEvolution", "activeComparativeReconstruction",
  ]) {
    assert.deepEqual(prepared.artifact.facts[domain], { availability: "available", items: [] });
  }
});

test("locally activated, completed, and verified MIP state matches the frozen MIP context digest", async () => {
  const { core, prepared } = await activeMipContext();
  assertContextShape(prepared, "mip", mipCompatibility);
  assert.equal(assertAuthoritativePolicyFactContext(prepared, core), true);
  assert.equal(prepared.contextDigest, await goldenContextDigest("vector-policy-mip"));
  assert.equal(prepared.contextDigest, "sha256:ff0836a3aa363b55467a2c3d18a99a295a7e9535ffbaffd1f9972a11ba41ac6f");
  assert.equal(prepared.artifact.transitionLog.transitionCount, 12);
  assert.equal(prepared.artifact.facts.observations.items.length, 1);
  assert.equal(prepared.artifact.facts.activeTrace.items.length, 1);
  assert.equal(prepared.artifact.facts.activeReplay.items.length, 1);
  assert.equal(prepared.artifact.facts.activeReplay.items[0].value.status, "completed");
  assert.equal(prepared.artifact.facts.verification.items.length, 1);
  assert.equal(prepared.artifact.facts.verification.items[0].value.status, "passed");
  assert.equal(prepared.artifact.facts.activeEvolution.items.length, 0);
  assert.equal(prepared.artifact.facts.activeComparativeReconstruction.items.length, 0);
});

test("native projection binds each locally active artifact to its exact retained state", () => {
  const identifier = "context-native-active-artifacts";
  const second = clone(referenceSnapshot);
  second.observationIdentifier = "context-native-active-second";
  second.longTermMemory.entries[0].value = "A deterministic Phase 2 evolution.";
  const core = new InvestigationCore();
  core.create({ identifier, snapshot: referenceSnapshot });
  let investigation = core.observe(identifier, { snapshot: second });
  const target = investigation.state.currentFrame.world.nodes.find(({ observationPath }) => (
    observationPath === "Reflection.values[0]"
  ));
  assert.ok(target);
  core.trace(identifier, target.key);
  let traceContext = capturePolicyFactContext(core, identifier);
  assert.equal(traceContext.artifact.facts.activeTrace.items.length, 1);
  assert.equal(traceContext.artifact.facts.activeReplay.items.length, 1);
  assert.equal(traceContext.artifact.facts.activeEvolution.items.length, 0);

  let guard = 0;
  while (core.load(identifier).state.replayState.status !== "completed") {
    core.replay(identifier, "next");
    assert.ok((guard += 1) < 1000);
  }
  core.compare(identifier, "enter");
  core.compare(identifier, "start");
  const comparisonContext = capturePolicyFactContext(core, identifier);
  assert.equal(comparisonContext.artifact.facts.activeTrace.items.length, 0);
  assert.equal(comparisonContext.artifact.facts.activeReplay.items.length, 0);
  assert.equal(comparisonContext.artifact.facts.activeEvolution.items.length, 1);
  assert.equal(comparisonContext.artifact.facts.activeComparativeReconstruction.items.length, 1);
  assert.notEqual(traceContext.contextDigest, comparisonContext.contextDigest);

  core.verify(identifier);
  const verified = capturePolicyFactContext(core, identifier);
  assert.equal(verified.artifact.facts.verification.items[0].value.status, "passed");
  assert.deepEqual(
    verified.artifact.facts.verification.items[0].value.checks.map(({ code }) => code),
    ["TRANSITION_LOG", "LIFECYCLE", "EVOLUTION", "COMPARATIVE"],
  );
  const verifiedPrefixDigest = verified.artifact.facts.verification.items[0].value.transitionLogDigest;
  core.archive(identifier);
  const archived = capturePolicyFactContext(core, identifier);
  assert.equal(archived.artifact.facts.lifecycle.items[0].value.state, "Archived");
  assert.equal(
    archived.artifact.facts.verification.items[0].value.transitionLogDigest,
    verifiedPrefixDigest,
  );
  assert.notEqual(archived.artifact.transitionLog.transitionLogDigest, verifiedPrefixDigest);
});

test("MIP projection exposes Evolution and Comparative facts only after exact local designation", async () => {
  const identifier = "context-mip-active-comparison";
  const core = new InvestigationCore();
  core.import(await mipFixture(), { identifier });
  const imported = capturePolicyFactContext(core, identifier);
  assert.equal(imported.artifact.facts.mipIntegrity.items[0].value.inventory.evolutions, 1);
  assert.equal(imported.artifact.facts.mipIntegrity.items[0].value.inventory.comparativeReconstructions, 1);
  assert.deepEqual(imported.artifact.facts.activeEvolution.items, []);
  assert.deepEqual(imported.artifact.facts.activeComparativeReconstruction.items, []);

  core.trace(identifier, "trace-observation-b");
  let guard = 0;
  while (core.load(identifier).state.replayState.status !== "completed") {
    core.replay(identifier, "next");
    assert.ok((guard += 1) < 1000);
  }
  core.compare(identifier, "enter");
  core.compare(identifier, "start");
  const active = capturePolicyFactContext(core, identifier);
  assert.equal(active.artifact.facts.activeEvolution.items[0].subject.identifier,
    "evolution-observation-a-observation-b");
  assert.equal(active.artifact.facts.activeComparativeReconstruction.items[0].subject.identifier,
    "comparative-observation-a-observation-b");
  assert.equal(
    active.artifact.facts.activeComparativeReconstruction.items[0].value.evolutionFactIdentifier,
    active.artifact.facts.activeEvolution.items[0].factIdentifier,
  );
});

test("serialized round trips preserve identity but cannot mint Core authority", () => {
  const { core, prepared } = nativeContext("context-authority");
  const bytes = prepared.canonicalBytes();
  const roundTrip = preparePolicyFactContext(bytes, { expectedContextDigest: prepared.contextDigest });
  assert.notEqual(roundTrip, prepared);
  assert.deepEqual(
    canonicalizeRestrictedJson(roundTrip.artifact),
    canonicalizeRestrictedJson(prepared.artifact),
  );
  assert.deepEqual(roundTrip.canonicalBytes(), bytes);
  assert.equal(roundTrip.contextDigest, prepared.contextDigest);
  assert.equal(validatePolicyFactContext(roundTrip.artifact, {
    expectedContextDigest: prepared.contextDigest,
  }), true);
  assert.equal(assertAuthoritativePolicyFactContext(prepared, core), true);
  Object.defineProperty(core, "load", {
    configurable: true,
    value: () => { throw new Error("public load bridge must not be traversed"); },
  });
  const recaptured = capturePolicyFactContext(core, "context-authority");
  assert.equal(recaptured.contextDigest, prepared.contextDigest);
  const foreignCore = new InvestigationCore();
  for (const untrusted of [roundTrip, { ...prepared }, prepared.artifact]) {
    expectCode(
      () => assertAuthoritativePolicyFactContext(untrusted, core),
      "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
    );
  }
  expectCode(
    () => assertAuthoritativePolicyFactContext(prepared, foreignCore),
    "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
  );
  expectCode(
    () => capturePolicyFactContext({ load: () => core.load("context-authority") }, "context-authority"),
    "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
  );
});

test("serialized validation preserves the frozen seven-step primary precedence", () => {
  assert.deepEqual(POLICY_FACT_CONTEXT_FAILURE_CODES, [
    "POLICY_FACT_CONTEXT_SYNTAX_INVALID",
    "POLICY_FACT_CONTEXT_SCHEMA_INVALID",
    "POLICY_FACT_CONTEXT_VERSION_UNSUPPORTED",
    "POLICY_FACT_MODEL_VERSION_UNSUPPORTED",
    "POLICY_FACT_CONTEXT_TRANSITION_BINDING_MISMATCH",
    "POLICY_FACT_CONTEXT_INCOMPLETE",
    "POLICY_FACT_CONTEXT_DIGEST_MISMATCH",
    "POLICY_FACT_CONTEXT_ATOMIC_CAPTURE_FAILED",
    "POLICY_FACT_CONTEXT_SOURCE_STATE_INVALID",
    "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
  ]);
  const base = nativeContext("context-validation-precedence").prepared.artifact;
  const wrongDigest = `sha256:${"0".repeat(64)}`;
  expectCode(
    () => preparePolicyFactContext(utf8Encode("{"), { expectedContextDigest: wrongDigest }),
    "POLICY_FACT_CONTEXT_SYNTAX_INVALID",
  );
  let candidate = clone(base);
  candidate.extra = "x".repeat(257);
  candidate.version = "2.0.0";
  assert.throws(
    () => validatePolicyFactContext(candidate, { expectedContextDigest: wrongDigest }),
    (error) => {
      assert.equal(error.code, "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED");
      assert.equal(error.limitIdentifier, "json.string-utf8-bytes");
      assert.equal(error.enforcementPhase, "C");
      assert.equal(error.configuredLimit, 256);
      assert.equal(error.observedAtLeast, 257);
      return true;
    },
  );
  candidate = clone(base);
  candidate.extra = true;
  candidate.version = "2.0.0";
  expectCode(
    () => validatePolicyFactContext(candidate, { expectedContextDigest: wrongDigest }),
    "POLICY_FACT_CONTEXT_SCHEMA_INVALID",
  );
  candidate = clone(base);
  candidate.version = "2.0.0";
  candidate.factModelVersion = "2.0.0";
  candidate.transitionLog.transitionCount += 1;
  candidate.facts.compatibility.items = [];
  expectCode(
    () => validatePolicyFactContext(candidate, { expectedContextDigest: wrongDigest }),
    "POLICY_FACT_CONTEXT_VERSION_UNSUPPORTED",
  );
  candidate = clone(base);
  candidate.factModelVersion = "2.0.0";
  candidate.transitionLog.transitionCount += 1;
  candidate.facts.compatibility.items = [];
  expectCode(
    () => validatePolicyFactContext(candidate, { expectedContextDigest: wrongDigest }),
    "POLICY_FACT_MODEL_VERSION_UNSUPPORTED",
  );
  candidate = clone(base);
  candidate.transitionLog.transitionCount += 1;
  candidate.facts.compatibility.items = [];
  expectCode(
    () => validatePolicyFactContext(candidate, { expectedContextDigest: wrongDigest }),
    "POLICY_FACT_CONTEXT_TRANSITION_BINDING_MISMATCH",
  );
  candidate = clone(base);
  candidate.facts.lifecycle.items[0].factIdentifier = wrongDigest;
  expectCode(
    () => validatePolicyFactContext(candidate, { expectedContextDigest: wrongDigest }),
    "POLICY_FACT_CONTEXT_INCOMPLETE",
  );
  expectCode(
    () => validatePolicyFactContext(base, { expectedContextDigest: wrongDigest }),
    "POLICY_FACT_CONTEXT_DIGEST_MISMATCH",
  );
});

test("PolicyFactContext limits 17-21 accept exact boundaries and reject first-above inputs", async () => {
  const limits = MEMORYOS_POLICY_RESOURCE_PROFILE.limits;
  assert.deepEqual(POLICY_FACT_CONTEXT_RESOURCE_LIMIT_IDENTIFIERS, [
    "policy-fact-context.raw-document-bytes",
    "policy-fact-context.canonical-document-bytes",
    "policy-fact-context.transition-count",
    "policy-fact-context.observation-count",
    "policy-fact-context.total-fact-count",
  ]);
  assert.deepEqual(
    POLICY_FACT_CONTEXT_RESOURCE_LIMIT_IDENTIFIERS.map((identifier) => limits[identifier]),
    [16384, 16384, 32, 4, 59],
  );
  const manifest = JSON.parse(await readFile(boundaryManifestPath, "utf8"));

  const base = nativeContext("context-resource-boundaries").prepared;
  const rawLimit = limits["policy-fact-context.raw-document-bytes"];
  const rawExact = new Uint8Array(rawLimit);
  rawExact.set(base.canonicalBytes());
  rawExact.fill(0x20, base.canonicalBytes().length);
  assert.equal(preparePolicyFactContext(rawExact.subarray(0, rawLimit - 1)).contextDigest, base.contextDigest);
  assert.equal(preparePolicyFactContext(rawExact).contextDigest, base.contextDigest);
  const rawAbove = new Uint8Array(rawLimit + 1);
  rawAbove.set(rawExact);
  rawAbove[rawLimit] = 0x20;
  expectCode(
    () => preparePolicyFactContext(rawAbove),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "policy-fact-context.raw-document-bytes",
  );

  const mipCore = new InvestigationCore();
  const mip = mipCore.import(await mipFixture(), { identifier: "context-canonical-boundary" });
  const mipBase = capturePolicyFactContext(mipCore, mip.identifier).artifact;
  const canonicalLimit = limits["policy-fact-context.canonical-document-bytes"];
  const canonicalBelow = canonicalBoundaryContext(mipBase, canonicalLimit - 1);
  assert.equal(validatePolicyFactContext(canonicalBelow), true);
  const canonicalExact = canonicalBoundaryContext(mipBase, canonicalLimit);
  assert.equal(validatePolicyFactContext(canonicalExact), true);
  assert.equal(
    preparePolicyFactContext(canonicalizeRestrictedJson(canonicalExact)).canonicalBytes().length,
    canonicalLimit,
  );
  const canonicalAbove = clone(canonicalExact);
  canonicalAbove.facts.mipIntegrity.items[0].value.features.optional[49] += "c";
  assert.equal(canonicalizeRestrictedJson(canonicalAbove).length, canonicalLimit + 1);
  expectCode(
    () => validatePolicyFactContext(canonicalAbove),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "policy-fact-context.canonical-document-bytes",
  );
  const canonicalProof = manifest.reachabilityProofs.find(({ limitIdentifier }) => (
    limitIdentifier === "policy-fact-context.canonical-document-bytes"
  ));
  assert.equal(canonicalProof.status, "PROVED_UNREACHABLE_TARGET");
  assert.equal(canonicalProof.target, canonicalLimit + 1);
  assert.equal(canonicalProof.expectedFirstLimitingCondition, "policy-fact-context.raw-document-bytes");
  assert.equal(
    canonicalProof.proofDigest,
    "sha256:17166fa1b572055d567e61063e839763b7e64d14be9727963c0a9d78117a2d7a",
  );

  assert.equal(validatePolicyFactContext(transitionBoundaryContext(base.artifact, 31)), true);
  const transitionExact = transitionBoundaryContext(base.artifact, 32);
  assert.equal(validatePolicyFactContext(transitionExact), true);
  expectCode(
    () => validatePolicyFactContext(transitionBoundaryContext(base.artifact, 33)),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "policy-fact-context.transition-count",
  );

  const observationCore = new InvestigationCore();
  const observationIdentifier = "context-observation-boundary";
  observationCore.create({ identifier: observationIdentifier, snapshot: clone(referenceSnapshot) });
  for (let index = 1; index < 3; index += 1) {
    observationCore.observe(observationIdentifier, { snapshot: clone(referenceSnapshot) });
  }
  assert.equal(
    capturePolicyFactContext(observationCore, observationIdentifier).artifact.facts.observations.items.length,
    3,
  );
  observationCore.observe(observationIdentifier, { snapshot: clone(referenceSnapshot) });
  assert.equal(
    capturePolicyFactContext(observationCore, observationIdentifier).artifact.facts.observations.items.length,
    4,
  );
  observationCore.observe(observationIdentifier, { snapshot: clone(referenceSnapshot) });
  expectCode(
    () => capturePolicyFactContext(observationCore, observationIdentifier),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "policy-fact-context.observation-count",
  );

  const totalCore = new InvestigationCore();
  const totalIdentifier = "context-total-fact-boundary";
  let totalInvestigation = totalCore.create({
    identifier: totalIdentifier,
    snapshot: clone(referenceSnapshot),
  });
  for (let index = 1; index < 4; index += 1) {
    totalInvestigation = totalCore.observe(totalIdentifier, { snapshot: clone(referenceSnapshot) });
  }
  const reflection = totalInvestigation.state.currentFrame.world.nodes.find(
    ({ observationPath }) => observationPath === "Reflection.values[0]",
  ) ?? totalInvestigation.state.currentFrame.world.nodes.find(({ family }) => family === "Reflection");
  assert.ok(reflection);
  totalInvestigation = totalCore.trace(totalIdentifier, reflection.key);
  while (totalInvestigation.state.replayState.status !== "completed") {
    totalInvestigation = totalCore.replay(totalIdentifier, "next");
  }
  while (totalInvestigation.transitionLog.transitions.length < 30) {
    totalInvestigation = totalCore.replay(totalIdentifier, "previous");
    totalInvestigation = totalCore.replay(totalIdentifier, "next");
  }
  totalCore.verify(totalIdentifier);
  const totalBelow = capturePolicyFactContext(totalCore, totalIdentifier).artifact;
  assert.equal(countFacts(totalBelow), 58);
  assert.equal(validatePolicyFactContext(totalBelow), true);
  totalCore.archive(totalIdentifier);
  const totalExact = capturePolicyFactContext(totalCore, totalIdentifier).artifact;
  assert.equal(countFacts(totalExact), 59);
  assert.equal(validatePolicyFactContext(totalExact), true);

  const totalProof = manifest.reachabilityProofs.find(({ limitIdentifier }) => (
    limitIdentifier === "policy-fact-context.total-fact-count"
  ));
  assert.equal(totalProof.status, "PROVED_UNREACHABLE_TARGET");
  assert.equal(totalProof.maximum, 59);
  assert.equal(totalProof.target, 60);
  assert.equal(
    totalProof.proofDigest,
    "sha256:4b24557a78c8709258cf5d6c55eda5929155d6c03dea9f73a77d47a71ebeedb2",
  );

  const totalAbove = clone(totalExact);
  totalAbove.facts.lifecycle.items.push({
    factIdentifier: `sha256:${"9".repeat(64)}`,
    subject: {},
    value: { state: "Archived" },
  });
  assert.equal(countFacts(totalAbove), 60);
  expectCode(
    () => validatePolicyFactContext(totalAbove),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "policy-fact-context.total-fact-count",
  );
});
