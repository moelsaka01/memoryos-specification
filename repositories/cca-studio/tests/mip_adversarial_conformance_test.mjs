import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MemoryInvestigationPackageError,
  computeMipIntegrity,
  createMemoryInvestigationPackageArtifact,
  exportMemoryInvestigationPackage,
  importMemoryInvestigationPackage,
  importMemoryInvestigationPackageFile,
  recordRevisionDigest,
  relationshipRevisionDigest,
  verifyMemoryInvestigationPackage,
} from "../web/js/memory-investigation-package.js";
import {
  canonicalize,
  cloneCanonical,
  utf8Encode,
} from "../web/js/mip-canonical.js";

const fixtureFiles = {
  minimal: "minimal-observation.mip.b64",
  complete: "complete-investigation.mip.b64",
  extended: "noncritical-extension.mip.b64",
};

async function fixture(name) {
  const encoded = await readFile(new URL(`./fixtures/mip/${fixtureFiles[name]}`, import.meta.url), "ascii");
  return new Uint8Array(Buffer.from(encoded.trim(), "base64"));
}

async function packageValue(name = "minimal") {
  return cloneCanonical(importMemoryInvestigationPackage(await fixture(name)));
}

function redigest(value) {
  value.integrity = computeMipIntegrity(value);
  return utf8Encode(canonicalize(value));
}

function verifyChanged(value, updateIntegrity = true, options = {}) {
  const bytes = updateIntegrity ? redigest(value) : utf8Encode(canonicalize(value));
  return verifyMemoryInvestigationPackage(bytes, options);
}

function expectPrimary(result, code) {
  assert.equal(result.valid, false);
  assert.equal(result.diagnostics[0]?.code, code);
  assert.equal(result.package, null);
}

function draftFrom(value) {
  return {
    packageIdentifier: value.manifest.packageIdentifier,
    workspaceIdentifier: value.manifest.workspaceIdentifier,
    metadata: value.metadata,
    observations: value.observations,
    traces: value.traces,
    replays: value.replays,
    evolutions: value.evolutions,
    comparativeReconstructions: value.comparativeReconstructions,
    extensions: value.extensions,
    sourceAccepted: true,
    sourceAuthorshipAttested: true,
  };
}

function evolutionDraft(complete) {
  const from = cloneCanonical(complete.observations[0]);
  const to = cloneCanonical(from);
  from.identifier = "observation-from";
  from.sequence = 10;
  to.identifier = "observation-to";
  to.sequence = 20;
  const draft = draftFrom(complete);
  draft.packageIdentifier = "mip-evolution-conformance";
  draft.observations = [from, to];
  draft.traces = [];
  draft.replays = [];
  draft.evolutions = [];
  draft.comparativeReconstructions = [];
  return { draft, from, to };
}

function evolutionArtifact(from, to, differences) {
  return {
    differences: differences.map((difference, index) => ({ ...difference, index })),
    fromObservationIdentifier: from.identifier,
    identifier: `evolution-${from.identifier}-${to.identifier}`,
    toObservationIdentifier: to.identifier,
    workspaceIdentifier: from.workspaceIdentifier,
  };
}

test("integrity validation independently rejects section, cognition, and package commitment mismatches", async () => {
  const mutations = [
    (value) => { value.integrity.sectionDigests[0].digest = `sha256:${"0".repeat(64)}`; },
    (value) => { value.integrity.cognitionDigest = `sha256:${"0".repeat(64)}`; },
    (value) => { value.integrity.packageDigest = `sha256:${"0".repeat(64)}`; },
  ];
  for (const mutate of mutations) {
    const value = await packageValue();
    mutate(value);
    expectPrimary(verifyChanged(value, false), "CHECKSUM_MISMATCH");
  }

  const original = await packageValue();
  const metadataOnly = cloneCanonical(original);
  metadataOnly.metadata.exportedAt = "2026-08-28T00:00:00Z";
  metadataOnly.integrity = computeMipIntegrity(metadataOnly);
  assert.equal(metadataOnly.integrity.cognitionDigest, original.integrity.cognitionDigest);
  assert.notEqual(metadataOnly.integrity.packageDigest, original.integrity.packageDigest);

  const cognitiveChange = cloneCanonical(original);
  cognitiveChange.observations[0].records[0].revision.retained = false;
  cognitiveChange.integrity = computeMipIntegrity(cognitiveChange);
  assert.notEqual(cognitiveChange.integrity.cognitionDigest, original.integrity.cognitionDigest);
  assert.notEqual(cognitiveChange.integrity.packageDigest, original.integrity.packageDigest);
});

test("Workspace ownership is enforced for every persisted cognitive artifact", async () => {
  for (const section of [
    "observations",
    "traces",
    "replays",
    "evolutions",
    "comparativeReconstructions",
  ]) {
    const value = await packageValue("complete");
    assert.ok(value[section].length > 0, `${section} fixture coverage`);
    value[section][0].workspaceIdentifier = "workspace-foreign";
    expectPrimary(verifyChanged(value), "WORKSPACE_MISMATCH");
  }
});

test("provenance validation enforces role grammar, cardinality, relationship use, and connectivity", async () => {
  const changes = [
    (value) => {
      const observation = value.observations[0];
      observation.records.find(({ role }) => role === "evidence").provenance.push(
        cloneCanonical(observation.records.find(({ role }) => role === "semanticTransformation").provenance[0]),
      );
    },
    (value) => { value.observations[0].records.find(({ role }) => role === "semanticTransformation").provenance = []; },
    (value) => {
      const record = value.observations[0].records.find(({ role }) => role === "retrieval");
      record.provenance.push(cloneCanonical(record.provenance[0]));
    },
    (value) => { value.observations[0].records.find(({ role }) => role === "reflection").provenance = []; },
    (value) => {
      const record = value.observations[1].records.find(({ role }) => role === "semanticTransformation");
      record.provenance[1].relationship = cloneCanonical(record.provenance[0].relationship);
    },
    (value) => {
      const observation = value.observations[0];
      const retrieval = observation.records.find(({ role }) => role === "retrieval");
      retrieval.provenance[0].source = cloneCanonical(observation.records.find(({ role }) => role === "evidence").reference);
    },
  ];
  for (const change of changes) {
    const value = await packageValue("complete");
    change(value);
    expectPrimary(verifyChanged(value), "INVALID_PROVENANCE");
  }
});

test("Trace and Replay reconstruction reject bad bindings, indices, terminals, and payload", async () => {
  const traceChanges = [
    (value) => {
      value.traces[0].target = cloneCanonical(
        value.observations[0].records.find(({ role }) => role === "semanticTransformation").reference,
      );
    },
    (value) => { value.traces[0].branches[0].index = 1; },
    (value) => { value.traces[0].branches[0].steps[0].index = 1; },
    (value) => {
      value.traces[0].branches[0].steps.at(-1).relationship = cloneCanonical(
        value.observations[0].relationships[0].reference,
      );
    },
  ];
  for (const change of traceChanges) {
    const value = await packageValue("complete");
    change(value);
    expectPrimary(verifyChanged(value), "INVALID_TRACE");
  }

  const missingFinal = await packageValue("complete");
  missingFinal.replays[0].steps.pop();
  expectPrimary(verifyChanged(missingFinal), "INVALID_REPLAY");

  const wrongBinding = await packageValue("complete");
  wrongBinding.replays[0].traceIdentifier = wrongBinding.traces[1].identifier;
  expectPrimary(verifyChanged(wrongBinding), "DANGLING_REFERENCE");

  const injectedPayload = await packageValue("complete");
  injectedPayload.traces[0].branches[0].steps[0].payload = { explanation: "not allowed" };
  expectPrimary(verifyChanged(injectedPayload), "SCHEMA_VIOLATION");
});

test("reverse relationship orientation reconstructs into reverse Trace and Replay directions", async () => {
  const complete = await packageValue("complete");
  const draft = draftFrom(complete);
  draft.observations = [cloneCanonical(complete.observations[0])];
  for (const relationship of draft.observations[0].relationships) {
    [relationship.from, relationship.to] = [relationship.to, relationship.from];
  }
  draft.traces = [cloneCanonical(complete.traces[0])];
  for (const step of draft.traces[0].branches[0].steps) {
    if (step.relationship !== null) step.direction = "reverse";
  }
  draft.replays = [cloneCanonical(complete.replays[0])];
  for (const step of draft.replays[0].steps) {
    if (step.elementType === "relationship") step.direction = "reverse";
  }
  draft.evolutions = [];
  draft.comparativeReconstructions = [];

  const imported = importMemoryInvestigationPackage(exportMemoryInvestigationPackage(draft));
  assert.ok(imported.traces[0].branches[0].steps.slice(0, -1).every(({ direction }) => direction === "reverse"));
  assert.ok(imported.replays[0].steps.filter(({ elementType }) => elementType === "relationship")
    .every(({ direction }) => direction === "reverse"));
});

test("Evolution recomputation covers every record difference kind and modified relationships", async () => {
  const complete = await packageValue("complete");
  const roleKinds = {
    semanticTransformation: ["addedSemanticTransformation", "removedSemanticTransformation"],
    retrieval: ["addedRetrieval", "removedRetrieval"],
    reflection: ["addedReflection", "removedReflection"],
  };
  for (const [role, [addedKind, removedKind]] of Object.entries(roleKinds)) {
    const { draft, from, to } = evolutionDraft(complete);
    const before = from.records.find((record) => record.role === role);
    const after = to.records.find((record) => record.role === role);
    after.revision.conformanceMutation = role;
    draft.evolutions = [evolutionArtifact(from, to, [
      { afterRevisionDigest: recordRevisionDigest(after), beforeRevisionDigest: null, kind: addedKind, subject: after.reference },
      { afterRevisionDigest: null, beforeRevisionDigest: recordRevisionDigest(before), kind: removedKind, subject: before.reference },
    ])];
    const imported = importMemoryInvestigationPackage(exportMemoryInvestigationPackage(draft));
    assert.deepEqual(imported.evolutions[0].differences.map(({ kind }) => kind), [addedKind, removedKind]);
  }

  const { draft, from, to } = evolutionDraft(complete);
  const before = from.relationships[0];
  const after = to.relationships[0];
  after.relationshipType = "contributesUpdated";
  draft.evolutions = [evolutionArtifact(from, to, [{
    afterRevisionDigest: relationshipRevisionDigest(after),
    beforeRevisionDigest: relationshipRevisionDigest(before),
    kind: "modifiedRelationship",
    subject: after.reference,
  }])];
  const imported = importMemoryInvestigationPackage(exportMemoryInvestigationPackage(draft));
  assert.equal(imported.evolutions[0].differences[0].kind, "modifiedRelationship");
});

test("Evolution recomputation covers added and removed evidence and relationships", async () => {
  const complete = await packageValue("complete");

  const added = evolutionDraft(complete);
  const addedEvidence = {
    provenance: [],
    reference: { identifier: "ltm-extra", kind: "memoryos.longTermMemoryEntry", occurrence: 0 },
    revision: { retained: true },
    role: "evidence",
  };
  added.to.records.push(addedEvidence);
  added.draft.evolutions = [evolutionArtifact(added.from, added.to, [{
    afterRevisionDigest: recordRevisionDigest(addedEvidence),
    beforeRevisionDigest: null,
    kind: "addedEvidence",
    subject: addedEvidence.reference,
  }])];
  assert.equal(
    importMemoryInvestigationPackage(exportMemoryInvestigationPackage(added.draft)).evolutions[0].differences[0].kind,
    "addedEvidence",
  );

  const removed = evolutionDraft(complete);
  const removedEvidence = cloneCanonical(addedEvidence);
  removed.from.records.push(removedEvidence);
  removed.draft.evolutions = [evolutionArtifact(removed.from, removed.to, [{
    afterRevisionDigest: null,
    beforeRevisionDigest: recordRevisionDigest(removedEvidence),
    kind: "removedEvidence",
    subject: removedEvidence.reference,
  }])];
  assert.equal(
    importMemoryInvestigationPackage(exportMemoryInvestigationPackage(removed.draft)).evolutions[0].differences[0].kind,
    "removedEvidence",
  );

  const published = importMemoryInvestigationPackage(await fixture("complete"));
  assert.ok(published.evolutions[0].differences.some(({ kind }) => kind === "addedRelationship"));

  const reverseDraft = draftFrom(published);
  const reverseFrom = cloneCanonical(published.observations[1]);
  const reverseTo = cloneCanonical(published.observations[0]);
  reverseFrom.identifier = "observation-reverse-from";
  reverseFrom.sequence = 10;
  reverseTo.identifier = "observation-reverse-to";
  reverseTo.sequence = 20;
  const removedRecord = reverseFrom.records.find(({ reference }) => reference.identifier === "ltm-002");
  const removedRelationship = reverseFrom.relationships.find(({ reference }) => reference.identifier === "rel-evidence-002");
  const beforeSemantic = reverseFrom.records.find(({ role }) => role === "semanticTransformation");
  const afterSemantic = reverseTo.records.find(({ role }) => role === "semanticTransformation");
  reverseDraft.observations = [reverseFrom, reverseTo];
  reverseDraft.traces = [];
  reverseDraft.replays = [];
  reverseDraft.comparativeReconstructions = [];
  reverseDraft.evolutions = [evolutionArtifact(reverseFrom, reverseTo, [
    { afterRevisionDigest: null, beforeRevisionDigest: recordRevisionDigest(removedRecord), kind: "removedEvidence", subject: removedRecord.reference },
    { afterRevisionDigest: null, beforeRevisionDigest: relationshipRevisionDigest(removedRelationship), kind: "removedRelationship", subject: removedRelationship.reference },
    { afterRevisionDigest: recordRevisionDigest(afterSemantic), beforeRevisionDigest: null, kind: "addedSemanticTransformation", subject: afterSemantic.reference },
    { afterRevisionDigest: null, beforeRevisionDigest: recordRevisionDigest(beforeSemantic), kind: "removedSemanticTransformation", subject: beforeSemantic.reference },
  ])];
  const reverse = importMemoryInvestigationPackage(exportMemoryInvestigationPackage(reverseDraft));
  assert.ok(reverse.evolutions[0].differences.some(({ kind }) => kind === "removedRelationship"));
});

test("Comparative Reconstruction deterministically emits A-only divergence when the earlier Trace has extra cognition", async () => {
  const complete = await packageValue("complete");
  const from = cloneCanonical(complete.observations[1]);
  const to = cloneCanonical(complete.observations[0]);
  from.identifier = "observation-comparative-from";
  from.sequence = 10;
  to.identifier = "observation-comparative-to";
  to.sequence = 20;

  const fromTrace = cloneCanonical(complete.traces[1]);
  fromTrace.identifier = "trace-comparative-from";
  fromTrace.observationIdentifier = from.identifier;
  const toTrace = cloneCanonical(complete.traces[0]);
  toTrace.identifier = "trace-comparative-to";
  toTrace.observationIdentifier = to.identifier;

  const removedRecord = from.records.find(({ reference }) => reference.identifier === "ltm-002");
  const removedRelationship = from.relationships.find(({ reference }) => reference.identifier === "rel-evidence-002");
  const beforeSemantic = from.records.find(({ role }) => role === "semanticTransformation");
  const afterSemantic = to.records.find(({ role }) => role === "semanticTransformation");
  const evolution = evolutionArtifact(from, to, [
    { afterRevisionDigest: null, beforeRevisionDigest: recordRevisionDigest(removedRecord), kind: "removedEvidence", subject: removedRecord.reference },
    { afterRevisionDigest: null, beforeRevisionDigest: relationshipRevisionDigest(removedRelationship), kind: "removedRelationship", subject: removedRelationship.reference },
    { afterRevisionDigest: recordRevisionDigest(afterSemantic), beforeRevisionDigest: null, kind: "addedSemanticTransformation", subject: afterSemantic.reference },
    { afterRevisionDigest: null, beforeRevisionDigest: recordRevisionDigest(beforeSemantic), kind: "removedSemanticTransformation", subject: beforeSemantic.reference },
  ]);

  const published = complete.comparativeReconstructions[0];
  const moments = published.moments.map((moment) => {
    if (moment.state === "bOnly") {
      return { from: cloneCanonical(moment.to), index: moment.index, reasonCodes: ["A_ONLY"], state: "aOnly", to: null };
    }
    return {
      from: cloneCanonical(moment.to),
      index: moment.index,
      reasonCodes: cloneCanonical(moment.reasonCodes),
      state: moment.state,
      to: cloneCanonical(moment.from),
    };
  });
  const comparative = {
    divergenceIndices: moments.filter(({ state }) => state !== "shared").map(({ index }) => index),
    evolutionIdentifier: evolution.identifier,
    fromObservationIdentifier: from.identifier,
    fromTraceIdentifier: fromTrace.identifier,
    identifier: "comparative-a-only",
    moments,
    toObservationIdentifier: to.identifier,
    toTraceIdentifier: toTrace.identifier,
    workspaceIdentifier: from.workspaceIdentifier,
  };
  const draft = draftFrom(complete);
  draft.packageIdentifier = "mip-comparative-a-only";
  draft.observations = [from, to];
  draft.traces = [fromTrace, toTrace];
  draft.replays = [];
  draft.evolutions = [evolution];
  draft.comparativeReconstructions = [comparative];

  const imported = importMemoryInvestigationPackage(exportMemoryInvestigationPackage(draft));
  const aOnly = imported.comparativeReconstructions[0].moments.filter(({ state }) => state === "aOnly");
  assert.equal(aOnly.length, 2);
  for (const { reasonCodes } of aOnly) assert.deepEqual(reasonCodes, ["A_ONLY"]);
});

test("same-phase diagnostics are deterministically sorted and an earlier phase wins", async () => {
  const modelFailures = await packageValue();
  modelFailures.manifest.inventory.traces = 4;
  modelFailures.observations[0].workspaceIdentifier = "other-workspace";
  const result = verifyChanged(modelFailures);
  assert.deepEqual(result.diagnostics, [...result.diagnostics].sort((left, right) => (
    left.code.localeCompare(right.code) || left.path.localeCompare(right.path)
  )));
  assert.ok(result.diagnostics.some(({ code }) => code === "ORDER_VIOLATION"));
  assert.ok(result.diagnostics.some(({ code }) => code === "WORKSPACE_MISMATCH"));

  const earlierIntegrityFailure = await packageValue();
  earlierIntegrityFailure.observations[0].workspaceIdentifier = "other-workspace";
  const integrityResult = verifyChanged(earlierIntegrityFailure, false);
  assert.ok(integrityResult.diagnostics.length >= 1);
  assert.ok(integrityResult.diagnostics.every(({ code }) => code === "CHECKSUM_MISMATCH"));
});

test("extension contract enforces reverse-DNS names, shape, bijection, versions, and critical support", async () => {
  const invalidName = await packageValue();
  invalidName.extensions.invalid = { critical: false, payload: {}, version: "1.0.0" };
  invalidName.manifest.features.optional = ["invalid"];
  expectPrimary(verifyChanged(invalidName), "SCHEMA_VIOLATION");

  const featureOnly = await packageValue();
  featureOnly.manifest.features.optional = ["org.example.missing"];
  expectPrimary(verifyChanged(featureOnly), "SCHEMA_VIOLATION");

  const extensionOnly = await packageValue();
  extensionOnly.extensions["org.example.extra"] = { critical: false, payload: {}, version: "1.0.0" };
  expectPrimary(verifyChanged(extensionOnly), "SCHEMA_VIOLATION");

  const badVersion = await packageValue("extended");
  badVersion.extensions["org.example.audit"].version = "1.01.0";
  expectPrimary(verifyChanged(badVersion), "SCHEMA_VIOLATION");

  const critical = await packageValue();
  critical.extensions["org.example.critical"] = { critical: true, payload: {}, version: "1.0.0" };
  critical.manifest.features.required = ["org.example.critical"];
  const criticalBytes = redigest(critical);
  expectPrimary(verifyMemoryInvestigationPackage(criticalBytes), "UNSUPPORTED_CRITICAL_EXTENSION");
  assert.equal(verifyMemoryInvestigationPackage(criticalBytes, {
    supportedExtensions: ["org.example.critical"],
  }).valid, true);
});

test("prohibited content detects security material, runtime residue, active media, and copied cognition", async () => {
  const payloads = [
    { apiKey: "secret" },
    { password: "secret" },
    { history: [] },
    { log: [] },
    { diagnostics: [] },
    { endpoint: "https://provider.invalid" },
    { localPath: "C:\\private\\memory.mip" },
    { uri: "data:application/javascript,alert(1)" },
    { temporaryCache: {} },
    { source: "H4sIAAAAAAAA/8tIzcnJBwCGphA2BQAAAA==" },
    { source: "UmFyIRoHAM+QcwAADQAAAAAAAAC6f3Q=" },
    { source: "N3q8ryccAARhdGVzdA==" },
    { source: "AAABAAEAEBAAAAAAIABoBAAAFgAA" },
    { source: "console.log('active')" },
    { source: "(()=>alert('x'))()" },
    { source: "print('active')" },
    { source: "rm -rf /tmp/mip" },
    { source: "https://provider.example/graphql" },
    { source: "wss://provider.example/cognition" },
    { source: "grpc://provider.example/service" },
    { source: "Bearer abcdefghijklmnopqrstuvwxyz" },
    { source: "postgres://user:password@host/database" },
    { follow: true },
    { navigation: {} },
    { inspector: {} },
    { displaySummaries: [] },
    { aiGeneratedSummary: "generated" },
    { llmGeneratedExplanation: "generated" },
    { indexes: [] },
    { unrelatedDiagnostics: [] },
    { runtimeImplementationState: {} },
    { eventBuses: [] },
    { serviceRegistries: [] },
    { dependencyInjectors: [] },
    { providerImplementationDetails: {} },
    { executableScripts: [] },
  ];
  for (const payload of payloads) {
    const value = await packageValue();
    value.extensions["org.example.prohibited"] = { critical: false, payload, version: "1.0.0" };
    value.manifest.features.optional = ["org.example.prohibited"];
    expectPrimary(verifyChanged(value), "PROHIBITED_CONTENT");
  }

  for (const member of [
    "observingQuery", "transientOperationResult", "activeRoute", "highlightDelta",
    "layout", "view", "control", "route", "follow", "rendererState",
  ]) {
    const value = await packageValue();
    value.observations[0].records[0].revision[member] = { active: true };
    expectPrimary(verifyChanged(value), "PROHIBITED_CONTENT");
  }

  for (const [member, text] of Object.entries({
    diagnostics: "unrelated runtime diagnostics",
    history: "browser navigation history",
    log: "runtime log entry",
    provider: "sqlite connection configuration",
    runtime: "running event bus handle 0x1234",
  })) {
    const value = await packageValue();
    value.observations[0].records[0].revision[member] = text;
    expectPrimary(verifyChanged(value), "PROHIBITED_CONTENT");
  }

  const duplicated = await packageValue();
  duplicated.extensions["org.example.duplicated"] = {
    critical: false,
    payload: { snapshot: cloneCanonical(duplicated.observations[0].records[0].revision) },
    version: "1.0.0",
  };
  duplicated.manifest.features.optional = ["org.example.duplicated"];
  expectPrimary(verifyChanged(duplicated), "PROHIBITED_CONTENT");
});

test("hostile inputs fail safely without draft spoofing, stack overflow, raw errors, or path traversal", async () => {
  const imported = importMemoryInvestigationPackage(await fixture("minimal"));
  const spoof = cloneCanonical(imported);
  assert.throws(
    () => exportMemoryInvestigationPackage(spoof),
    (error) => error instanceof MemoryInvestigationPackageError
      && error.diagnostics[0]?.code === "PROHIBITED_CONTENT",
  );

  const deeplyNested = utf8Encode(`${"[".repeat(3000)}0${"]".repeat(3000)}`);
  const deepResult = verifyMemoryInvestigationPackage(deeplyNested, { maxDepth: 5 });
  expectPrimary(deepResult, "RESOURCE_LIMIT_EXCEEDED");
  const beyondSafeParserDepth = utf8Encode(`${"[".repeat(5000)}0${"]".repeat(5000)}`);
  expectPrimary(verifyMemoryInvestigationPackage(beyondSafeParserDepth, {
    maxBytes: 100_000,
    maxDepth: 20_000,
    maxValues: 30_000,
  }), "RESOURCE_LIMIT_EXCEEDED");
  expectPrimary(verifyMemoryInvestigationPackage(await fixture("minimal"), {
    maxValues: 3,
  }), "RESOURCE_LIMIT_EXCEEDED");
  expectPrimary(verifyMemoryInvestigationPackage(await fixture("complete"), {
    maxAlignmentCells: 1,
  }), "RESOURCE_LIMIT_EXCEEDED");

  const malformedDrafts = [null, {}, {
    observations: [{}],
    sourceAccepted: true,
    sourceAuthorshipAttested: true,
  }];
  for (const draft of malformedDrafts) {
    assert.throws(
      () => exportMemoryInvestigationPackage(draft),
      (error) => error instanceof MemoryInvestigationPackageError
        && Array.isArray(error.diagnostics)
        && typeof error.diagnostics[0]?.code === "string",
    );
  }

  for (const name of ["../escape.mip", "folder/escape.mip", "folder\\escape.mip", "C:\\escape.mip"]) {
    assert.throws(
      () => createMemoryInvestigationPackageArtifact(imported, name),
      (error) => error instanceof MemoryInvestigationPackageError
        && error.diagnostics[0]?.path === "/name",
    );
  }
});

test("Producer trust, versions, critical support, timestamps, and artifact envelopes remain explicit", async () => {
  const imported = importMemoryInvestigationPackage(await fixture("minimal"));
  const futureDraft = draftFrom(imported);
  futureDraft.formatVersion = "1.999.0";
  assert.throws(
    () => exportMemoryInvestigationPackage(futureDraft),
    (error) => error instanceof MemoryInvestigationPackageError
      && error.diagnostics[0]?.code === "UNSUPPORTED_VERSION",
  );

  const criticalDraft = draftFrom(imported);
  criticalDraft.extensions = {
    "org.example.critical": { critical: true, payload: { revision: "extension-v1" }, version: "1.0.0" },
  };
  assert.throws(
    () => exportMemoryInvestigationPackage(criticalDraft),
    (error) => error instanceof MemoryInvestigationPackageError
      && error.diagnostics[0]?.code === "UNSUPPORTED_CRITICAL_EXTENSION",
  );
  const criticalBytes = exportMemoryInvestigationPackage(criticalDraft, {
    supportedExtensions: ["org.example.critical"],
  });
  expectPrimary(verifyMemoryInvestigationPackage(criticalBytes), "UNSUPPORTED_CRITICAL_EXTENSION");
  assert.equal(verifyMemoryInvestigationPackage(criticalBytes, {
    supportedExtensions: ["org.example.critical"],
  }).valid, true);

  const leapSecond = await packageValue();
  leapSecond.metadata.exportedAt = "2016-12-31T23:59:60Z";
  assert.equal(verifyChanged(leapSecond).valid, true);
  leapSecond.metadata.exportedAt = "2024-01-01T23:59:60Z";
  expectPrimary(verifyChanged(leapSecond), "SCHEMA_VIOLATION");

  const sourceText = await packageValue();
  Object.assign(sourceText.observations[0].records[0].revision, {
    code: "DXB",
    color: "red",
    generatedExplanation: "The source explains the observed evidence.",
    history: "The source remembers the earlier evidence.",
    narrative: "Data: the evidence was retained. File: the memory record follows. Import data from the source.",
    recommendation: "The source retained its own recommendation.",
    thread: "source-authored subject",
  });
  assert.equal(verifyChanged(sourceText).valid, true);
  sourceText.observations[0].records[0].revision.code = "alert(1)";
  expectPrimary(verifyChanged(sourceText), "PROHIBITED_CONTENT");

  assert.equal(importMemoryInvestigationPackageFile({
    bytes: await fixture("minimal"),
    mediaType: "application/vnd.memoryos.mip+json",
    name: "CON.foo.mip",
  }).manifest.packageIdentifier, imported.manifest.packageIdentifier);

  const unsafeIdentifierDraft = draftFrom(imported);
  unsafeIdentifierDraft.packageIdentifier = "../../outside";
  const artifact = createMemoryInvestigationPackageArtifact(unsafeIdentifierDraft);
  assert.match(artifact.name, /^memory-investigation-[0-9a-f]{16}\.mip$/);
  assert.doesNotMatch(artifact.name, /[\\/]/);
});
