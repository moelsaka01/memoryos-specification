import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MemoryInvestigationPackageError,
  computeMipIntegrity,
  exportMemoryInvestigationPackage,
  importMemoryInvestigationPackage,
  verifyMemoryInvestigationPackage,
} from "../web/js/memory-investigation-package.js";
import {
  canonicalize,
  cloneCanonical,
  decodeUtf8,
  utf8Encode,
} from "../web/js/mip-canonical.js";

const MAX_INTEROPERABLE_INTEGER = 9007199254740991;
const fixtureFiles = Object.freeze({
  complete: "complete-investigation.mip.b64",
  minimal: "minimal-observation.mip.b64",
});

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

function draftFrom(value) {
  return {
    comparativeReconstructions: value.comparativeReconstructions,
    evolutions: value.evolutions,
    extensions: value.extensions,
    metadata: value.metadata,
    observations: value.observations,
    packageIdentifier: value.manifest.packageIdentifier,
    replays: value.replays,
    sourceAccepted: true,
    sourceAuthorshipAttested: true,
    traces: value.traces,
    workspaceIdentifier: value.manifest.workspaceIdentifier,
  };
}

function expectExportCode(action, code, path) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof MemoryInvestigationPackageError);
    assert.equal(error.diagnostics[0]?.code, code);
    if (path !== undefined) assert.equal(error.diagnostics[0]?.path, path);
    return true;
  });
}

function expectVerifyCode(bytes, code, path) {
  const result = verifyMemoryInvestigationPackage(bytes);
  assert.equal(result.valid, false);
  assert.equal(result.package, null);
  assert.equal(result.diagnostics[0]?.code, code);
  if (path !== undefined) assert.equal(result.diagnostics[0]?.path, path);
}

function observationPair(value, firstSequence, secondSequence) {
  const first = cloneCanonical(value.observations[0]);
  const second = cloneCanonical(value.observations[0]);
  first.identifier = "observation-source-a";
  first.sequence = firstSequence;
  second.identifier = "observation-source-b";
  second.sequence = secondSequence;
  return [first, second];
}

test("CCA-MIP-006,038: interoperable integer boundaries and declared decimal strings remain exact", async () => {
  const source = await packageValue();
  source.manifest.packageIdentifier = "mip-scalar-boundary";
  source.observations[0].sequence = MAX_INTEROPERABLE_INTEGER;
  source.observations[0].records[0].revision.sourceDeclaredDecimalInteger = "9007199254740992";
  source.observations[0].records[0].revision.minimumInteroperableInteger = -MAX_INTEROPERABLE_INTEGER;
  const exported = exportMemoryInvestigationPackage(draftFrom(source));
  const imported = importMemoryInvestigationPackage(exported);
  assert.equal(imported.observations[0].sequence, MAX_INTEROPERABLE_INTEGER);
  assert.equal(
    imported.observations[0].records[0].revision.sourceDeclaredDecimalInteger,
    "9007199254740992",
  );
  assert.equal(
    imported.observations[0].records[0].revision.minimumInteroperableInteger,
    -MAX_INTEROPERABLE_INTEGER,
  );

  for (const change of [
    (value) => { value.observations[0].sequence = MAX_INTEROPERABLE_INTEGER + 1; },
    (value) => { value.observations[0].sequence = "9007199254740992"; },
    (value) => { value.observations[0].records[0].reference.occurrence = "9007199254740992"; },
    (value) => { value.observations[0].records[0].revision.undeclaredInteger = MAX_INTEROPERABLE_INTEGER + 1; },
  ]) {
    const invalid = await packageValue();
    change(invalid);
    expectExportCode(() => exportMemoryInvestigationPackage(draftFrom(invalid)), "SCHEMA_VIOLATION");
  }

  const rawUnsafeInteger = decodeUtf8(await fixture("minimal"))
    .replace('"sequence":0', '"sequence":9007199254740992');
  expectVerifyCode(rawUnsafeInteger, "INVALID_JSON", "/observations/0/sequence");
});

test("CCA-MIP-012: colliding source identities require contiguous occurrences in authoritative order", async () => {
  const valid = await packageValue();
  valid.manifest.packageIdentifier = "mip-occurrence-order";
  const occurrenceZero = cloneCanonical(valid.observations[0].records[0]);
  const occurrenceOne = cloneCanonical(occurrenceZero);
  occurrenceZero.revision.sourceOrdinal = 0;
  occurrenceOne.reference.occurrence = 1;
  occurrenceOne.revision.sourceOrdinal = 1;
  valid.observations[0].records = [occurrenceZero, occurrenceOne];
  const relationshipZero = {
    from: cloneCanonical(occurrenceZero.reference),
    reference: { identifier: "relationship-collision", kind: "memoryos.relationship", occurrence: 0 },
    relationshipType: "contextLink",
    revision: { sourceOrdinal: 0 },
    to: cloneCanonical(occurrenceOne.reference),
  };
  const relationshipOne = cloneCanonical(relationshipZero);
  relationshipOne.reference.occurrence = 1;
  relationshipOne.revision.sourceOrdinal = 1;
  valid.observations[0].relationships = [relationshipZero, relationshipOne];
  const imported = importMemoryInvestigationPackage(exportMemoryInvestigationPackage(draftFrom(valid)));
  assert.deepEqual(imported.observations[0].records.map(({ reference }) => reference.occurrence), [0, 1]);
  assert.deepEqual(imported.observations[0].records.map(({ revision }) => revision.sourceOrdinal), [0, 1]);
  assert.deepEqual(imported.observations[0].relationships.map(({ reference }) => reference.occurrence), [0, 1]);

  const gap = await packageValue();
  const gapFirst = cloneCanonical(gap.observations[0].records[0]);
  const gapSecond = cloneCanonical(gapFirst);
  gapSecond.reference.occurrence = 2;
  gap.observations[0].records = [gapFirst, gapSecond];
  expectExportCode(
    () => exportMemoryInvestigationPackage(draftFrom(gap)),
    "ORDER_VIOLATION",
    "/observations/0/records/1/reference/occurrence",
  );

  const relationshipGap = await packageValue();
  const endpoint = cloneCanonical(relationshipGap.observations[0].records[0].reference);
  const relationshipGapZero = {
    from: endpoint,
    reference: { identifier: "relationship-gap", kind: "memoryos.relationship", occurrence: 0 },
    relationshipType: "contextLink",
    revision: {},
    to: cloneCanonical(endpoint),
  };
  const relationshipGapTwo = cloneCanonical(relationshipGapZero);
  relationshipGapTwo.reference.occurrence = 2;
  relationshipGap.observations[0].relationships = [relationshipGapZero, relationshipGapTwo];
  expectExportCode(
    () => exportMemoryInvestigationPackage(draftFrom(relationshipGap)),
    "ORDER_VIOLATION",
    "/observations/0/relationships/1/reference/occurrence",
  );

  const duplicate = await packageValue();
  duplicate.observations[0].records.push(cloneCanonical(duplicate.observations[0].records[0]));
  expectExportCode(
    () => exportMemoryInvestigationPackage(draftFrom(duplicate)),
    "DUPLICATE_IDENTIFIER",
    "/observations/0/records/1/reference",
  );

  const reordered = await packageValue();
  const reorderedZero = cloneCanonical(reordered.observations[0].records[0]);
  const reorderedOne = cloneCanonical(reorderedZero);
  reorderedOne.reference.occurrence = 1;
  reordered.observations[0].records = [reorderedOne, reorderedZero];
  expectExportCode(
    () => exportMemoryInvestigationPackage(draftFrom(reordered)),
    "ORDER_VIOLATION",
    "/observations/0/records/0/reference/occurrence",
  );
});

test("CCA-MIP-012: inconsistent occurrence references fail in their deterministic semantic phase", async () => {
  const mutations = [
    {
      code: "INVALID_PROVENANCE",
      change(value) {
        const record = value.observations[0].records.find(({ role }) => role === "semanticTransformation");
        record.provenance[0].source.occurrence += 1;
      },
    },
    {
      code: "INVALID_TRACE",
      change(value) { value.traces[0].target.occurrence += 1; },
    },
    {
      code: "INVALID_REPLAY",
      change(value) {
        value.replays[0].steps.find(({ node }) => node !== null).node.occurrence += 1;
      },
    },
    {
      code: "INVALID_EVOLUTION",
      change(value) { value.evolutions[0].differences[0].subject.occurrence += 1; },
    },
    {
      code: "INVALID_COMPARATIVE_RECONSTRUCTION",
      change(value) { value.comparativeReconstructions[0].moments[0].from.reference.occurrence += 1; },
    },
  ];
  for (const { change, code } of mutations) {
    const invalid = await packageValue("complete");
    change(invalid);
    expectVerifyCode(redigest(invalid), code);
  }
});

test("CCA-MIP-018: sequence gaps are valid and preserved exactly", async () => {
  const source = await packageValue();
  source.manifest.packageIdentifier = "mip-observation-gap";
  source.observations = observationPair(source, 10, 40);
  source.traces = [];
  source.replays = [];
  source.evolutions = [];
  source.comparativeReconstructions = [];
  const imported = importMemoryInvestigationPackage(exportMemoryInvestigationPackage(draftFrom(source)));
  assert.deepEqual(imported.observations.map(({ sequence }) => sequence), [10, 40]);
});

test("CCA-MIP-018: duplicate and descending Observation sequences are rejected", async () => {
  const duplicate = await packageValue();
  duplicate.observations = observationPair(duplicate, 10, 10);
  expectExportCode(
    () => exportMemoryInvestigationPackage(draftFrom(duplicate)),
    "ORDER_VIOLATION",
    "/observations/1/sequence",
  );

  const valid = await packageValue();
  valid.observations = observationPair(valid, 10, 40);
  valid.traces = [];
  valid.replays = [];
  valid.evolutions = [];
  valid.comparativeReconstructions = [];
  const descendingPackage = cloneCanonical(importMemoryInvestigationPackage(
    exportMemoryInvestigationPackage(draftFrom(valid)),
  ));
  descendingPackage.observations.reverse();
  expectVerifyCode(redigest(descendingPackage), "ORDER_VIOLATION", "/observations");
});

test("CCA-MIP-018: Producer rejects source chronology inversion before canonical normalization", async () => {
  const source = await packageValue();
  source.observations = observationPair(source, 40, 10);
  source.traces = [];
  source.replays = [];
  source.evolutions = [];
  source.comparativeReconstructions = [];
  expectExportCode(
    () => exportMemoryInvestigationPackage(draftFrom(source)),
    "ORDER_VIOLATION",
    "/observations/1/sequence",
  );
});
