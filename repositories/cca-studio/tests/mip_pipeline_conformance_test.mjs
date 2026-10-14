import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MemoryInvestigationPackageError,
  computeMipIntegrity,
  createMemoryInvestigationPackageArtifact,
  exportMemoryInvestigationPackage,
  importMemoryInvestigationPackage,
  serializeMemoryInvestigationPackage,
  verifyMemoryInvestigationPackage,
} from "../web/js/memory-investigation-package.js";
import {
  canonicalize,
  cloneCanonical,
  decodeUtf8,
  utf8Encode,
} from "../web/js/mip-canonical.js";

const fixtureFiles = Object.freeze({
  complete: "complete-investigation.mip.b64",
  extended: "noncritical-extension.mip.b64",
  minimal: "minimal-observation.mip.b64",
});

const stableDiagnosticCodes = Object.freeze([
  "RESOURCE_LIMIT_EXCEEDED",
  "INVALID_ENCODING",
  "INVALID_JSON",
  "DUPLICATE_MEMBER",
  "NON_CANONICAL",
  "UNSUPPORTED_VERSION",
  "MISSING_REQUIRED_SECTION",
  "UNKNOWN_CORE_MEMBER",
  "SCHEMA_VIOLATION",
  "CHECKSUM_MISMATCH",
  "WORKSPACE_MISMATCH",
  "DUPLICATE_IDENTIFIER",
  "ORDER_VIOLATION",
  "DANGLING_REFERENCE",
  "INVALID_PROVENANCE",
  "INVALID_TRACE",
  "INVALID_REPLAY",
  "INVALID_EVOLUTION",
  "INVALID_COMPARATIVE_RECONSTRUCTION",
  "UNSUPPORTED_CRITICAL_EXTENSION",
  "PROHIBITED_CONTENT",
]);

async function fixture(name) {
  const encoded = await readFile(new URL(`./fixtures/mip/${fixtureFiles[name]}`, import.meta.url), "ascii");
  return new Uint8Array(Buffer.from(encoded.trim(), "base64"));
}

async function mutablePackage(name = "minimal") {
  return cloneCanonical(importMemoryInvestigationPackage(await fixture(name)));
}

function redigest(value) {
  value.integrity = computeMipIntegrity(value);
  return utf8Encode(canonicalize(value));
}

async function changed(name, change, updateIntegrity = true) {
  const value = await mutablePackage(name);
  change(value);
  return updateIntegrity ? redigest(value) : utf8Encode(canonicalize(value));
}

function draftFrom(value) {
  return {
    comparativeReconstructions: value.comparativeReconstructions,
    evolutions: value.evolutions,
    extensions: value.extensions,
    formatVersion: value.formatVersion,
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

function invalidResult(input, options = {}) {
  const result = verifyMemoryInvestigationPackage(input, options);
  assert.equal(result.valid, false);
  assert.equal(result.package, null);
  assert.equal(result.bytes, null);
  return result;
}

function expectPrimary(input, code, options = {}) {
  const result = invalidResult(input, options);
  assert.equal(result.diagnostics[0]?.code, code, JSON.stringify(result.diagnostics));
  return result;
}

function validJsonPointer(path) {
  return path === "" || /^(?:\/(?:[^~/]|~0|~1)*)+$/.test(path);
}

async function criticalExtensionBytes({ prohibited = false } = {}) {
  return changed("minimal", (value) => {
    value.extensions["org.example.memory.signature"] = {
      critical: true,
      payload: prohibited ? { screenshot: "inline" } : { algorithm: "external" },
      version: "1.0.0",
    };
    value.manifest.features.required = ["org.example.memory.signature"];
  });
}

test("CCA-MIP-045: adjacent multi-defect vectors prove the exact thirteen-phase precedence", async () => {
  const noncanonicalUnsupported = decodeUtf8(await changed("minimal", (value) => {
    value.formatVersion = "2.0.0";
  })).replace(":", ": ");

  const unsupportedAndChecksum = await changed("minimal", (value) => {
    value.formatVersion = "2.0.0";
    value.integrity.packageDigest = `sha256:${"0".repeat(64)}`;
  }, false);

  const checksumAndWorkspace = await changed("minimal", (value) => {
    value.observations[0].workspaceIdentifier = "workspace-foreign";
    value.integrity.packageDigest = `sha256:${"0".repeat(64)}`;
  }, false);

  const workspaceAndDangling = await changed("complete", (value) => {
    value.observations[0].workspaceIdentifier = "workspace-foreign";
    value.observations[0].relationships[0].from.identifier = "missing";
  });

  const danglingAndTrace = await changed("complete", (value) => {
    value.observations[0].relationships[0].from.identifier = "missing";
    [value.traces[0].branches[0].steps[0], value.traces[0].branches[0].steps[1]] =
      [value.traces[0].branches[0].steps[1], value.traces[0].branches[0].steps[0]];
  });

  const traceAndReplay = await changed("complete", (value) => {
    [value.traces[0].branches[0].steps[0], value.traces[0].branches[0].steps[1]] =
      [value.traces[0].branches[0].steps[1], value.traces[0].branches[0].steps[0]];
    value.replays[0].steps.splice(1, 1);
    value.replays[0].steps.forEach((step, index) => { step.index = index; });
  });

  const replayAndEvolution = await changed("complete", (value) => {
    value.replays[0].steps.splice(1, 1);
    value.replays[0].steps.forEach((step, index) => { step.index = index; });
    value.evolutions[0].differences.shift();
    value.evolutions[0].differences.forEach((difference, index) => { difference.index = index; });
  });

  const evolutionAndComparative = await changed("complete", (value) => {
    value.evolutions[0].differences.shift();
    value.evolutions[0].differences.forEach((difference, index) => { difference.index = index; });
    const moment = value.comparativeReconstructions[0].moments.find(({ state }) => state !== "shared");
    moment.state = "shared";
    moment.reasonCodes = [];
  });

  const comparativeAndProhibited = await changed("complete", (value) => {
    const moment = value.comparativeReconstructions[0].moments.find(({ state }) => state !== "shared");
    moment.state = "shared";
    moment.reasonCodes = [];
    value.extensions["org.example.memory.presentation"] = {
      critical: false,
      payload: { screenshot: "inline" },
      version: "1.0.0",
    };
    value.manifest.features.optional = ["org.example.memory.presentation"];
  });

  const prohibitedAndVerification = await changed("minimal", (value) => {
    value.observations[0].records[0].revision.screenshot = "inline";
    value.verification.checks[0].code = "CANONICAL_BYTES";
  });

  const verificationOnly = await changed("minimal", (value) => {
    value.verification.checks[0].code = "CANONICAL_BYTES";
  });

  const phaseVectors = [
    { phase: 1, input: Uint8Array.from([0xff, 0xff]), options: { maxBytes: 1 }, primary: "RESOURCE_LIMIT_EXCEEDED" },
    { phase: 2, input: '{"duplicate":,"duplicate":1}', primary: "INVALID_JSON" },
    { phase: 3, input: noncanonicalUnsupported, primary: "NON_CANONICAL" },
    { phase: 4, input: unsupportedAndChecksum, primary: "UNSUPPORTED_VERSION" },
    { phase: 5, input: checksumAndWorkspace, primary: "CHECKSUM_MISMATCH" },
    { phase: 6, input: workspaceAndDangling, primary: "WORKSPACE_MISMATCH" },
    { phase: 7, input: danglingAndTrace, primary: "DANGLING_REFERENCE" },
    { phase: 8, input: traceAndReplay, primary: "INVALID_TRACE" },
    { phase: 9, input: replayAndEvolution, primary: "INVALID_REPLAY" },
    { phase: 10, input: evolutionAndComparative, primary: "INVALID_EVOLUTION" },
    { phase: 11, input: comparativeAndProhibited, primary: "INVALID_COMPARATIVE_RECONSTRUCTION" },
    { phase: 12, input: prohibitedAndVerification, primary: "PROHIBITED_CONTENT" },
    { phase: 13, input: verificationOnly, primary: "SCHEMA_VIOLATION" },
  ];

  assert.deepEqual(phaseVectors.map(({ phase }) => phase), Array.from({ length: 13 }, (_, index) => index + 1));
  for (const { phase, input, options, primary } of phaseVectors) {
    const result = expectPrimary(input, primary, options);
    assert.ok(result.diagnostics.length > 0, `phase ${phase} must not publish a partial success`);
  }
});

test("CCA-MIP-046: every closed diagnostic code has stable shape and an RFC 6901 pointer", async () => {
  const minimalText = decodeUtf8(await fixture("minimal"));
  const cases = [
    { code: "RESOURCE_LIMIT_EXCEEDED", path: "", input: await fixture("minimal"), options: { maxBytes: 1 } },
    { code: "INVALID_ENCODING", path: "", input: Uint8Array.from([0xff]) },
    { code: "INVALID_JSON", path: "", input: minimalText.slice(0, -1) },
    { code: "DUPLICATE_MEMBER", path: "/kind", input: minimalText.replace('{"$schema"', '{"kind":"duplicate","$schema"') },
    { code: "NON_CANONICAL", path: "", input: minimalText.replace(":", ": ") },
    { code: "UNSUPPORTED_VERSION", path: "/formatVersion", input: await changed("minimal", (value) => { value.formatVersion = "2.0.0"; }) },
    { code: "MISSING_REQUIRED_SECTION", path: "/replays", input: await changed("minimal", (value) => { delete value.replays; }, false) },
    { code: "UNKNOWN_CORE_MEMBER", path: "/camera", input: await changed("minimal", (value) => { value.camera = {}; }, false) },
    { code: "SCHEMA_VIOLATION", path: "/metadata/producer/name", input: await changed("minimal", (value) => { value.metadata.producer.name = ""; }) },
    { code: "CHECKSUM_MISMATCH", path: "/integrity/packageDigest", input: await changed("minimal", (value) => { value.integrity.packageDigest = `sha256:${"0".repeat(64)}`; }, false) },
    { code: "WORKSPACE_MISMATCH", path: "/observations/0/workspaceIdentifier", input: await changed("minimal", (value) => { value.observations[0].workspaceIdentifier = "workspace-foreign"; }) },
    { code: "DUPLICATE_IDENTIFIER", path: "/observations/0/records/1/reference", input: await changed("minimal", (value) => { value.observations[0].records.push(cloneCanonical(value.observations[0].records[0])); }) },
    { code: "ORDER_VIOLATION", path: "/observations/0/records", input: await changed("complete", (value) => { value.observations[0].records.reverse(); }) },
    { code: "DANGLING_REFERENCE", path: "/observations/0/relationships/0/from", input: await changed("complete", (value) => { value.observations[0].relationships[0].from.identifier = "missing"; }) },
    { code: "INVALID_PROVENANCE", path: "/observations/0/records/1/provenance", input: await changed("complete", (value) => { value.observations[0].records[1].provenance = []; }) },
    { code: "INVALID_TRACE", path: "/traces/0", input: await changed("complete", (value) => { [value.traces[0].branches[0].steps[0], value.traces[0].branches[0].steps[1]] = [value.traces[0].branches[0].steps[1], value.traces[0].branches[0].steps[0]]; }) },
    { code: "INVALID_REPLAY", path: "/replays/0", input: await changed("complete", (value) => { value.replays[0].steps.pop(); }) },
    { code: "INVALID_EVOLUTION", path: "/evolutions/0", input: await changed("complete", (value) => { value.evolutions[0].differences.shift(); value.evolutions[0].differences.forEach((difference, index) => { difference.index = index; }); }) },
    { code: "INVALID_COMPARATIVE_RECONSTRUCTION", path: "/comparativeReconstructions/0", input: await changed("complete", (value) => { const moment = value.comparativeReconstructions[0].moments.find(({ state }) => state !== "shared"); moment.state = "shared"; moment.reasonCodes = []; }) },
    { code: "UNSUPPORTED_CRITICAL_EXTENSION", path: "/extensions/org.example.memory.signature", input: await criticalExtensionBytes() },
    { code: "PROHIBITED_CONTENT", path: "/observations/0/records/0/revision/screenshot", input: await changed("minimal", (value) => { value.observations[0].records[0].revision.screenshot = "inline"; }) },
  ];

  assert.deepEqual(cases.map(({ code }) => code), stableDiagnosticCodes);
  for (const { code, input, options, path } of cases) {
    const result = expectPrimary(input, code, options);
    const diagnostic = result.diagnostics[0];
    assert.deepEqual(Object.keys(diagnostic), ["code", "path"]);
    assert.equal(diagnostic.path, path, code);
    assert.equal(validJsonPointer(diagnostic.path), true, `${code}: ${diagnostic.path}`);
    assert.equal(Object.isFrozen(diagnostic), true);
    assert.equal(Object.hasOwn(diagnostic, "stack"), false);
    assert.equal(Object.hasOwn(diagnostic, "message"), false);
    assert.equal(Object.hasOwn(diagnostic, "phase"), false);
    for (const entry of result.diagnostics) {
      assert.ok(stableDiagnosticCodes.includes(entry.code), entry.code);
      assert.equal(validJsonPointer(entry.path), true, `${entry.code}: ${entry.path}`);
    }
  }
});

test("CCA-MIP-046: multiple diagnostics are deterministically ordered by path then code within a phase", async () => {
  const schemaBytes = await changed("minimal", (value) => {
    value.metadata.producer.name = "";
    value.metadata.source.name = "";
  });
  const schema = invalidResult(schemaBytes).diagnostics;
  assert.deepEqual(schema, [
    { code: "SCHEMA_VIOLATION", path: "/metadata/producer/name" },
    { code: "SCHEMA_VIOLATION", path: "/metadata/source/name" },
  ]);

  const integrityBytes = await changed("minimal", (value) => {
    value.observations[0].records[0].revision.retained = false;
  }, false);
  const integrity = invalidResult(integrityBytes).diagnostics;
  assert.deepEqual(integrity.map(({ path }) => path), [
    "/integrity/cognitionDigest",
    "/integrity/packageDigest",
    "/integrity/sectionDigests/2",
  ]);

  const extension = invalidResult(await criticalExtensionBytes({ prohibited: true })).diagnostics;
  assert.deepEqual(extension, [
    { code: "UNSUPPORTED_CRITICAL_EXTENSION", path: "/extensions/org.example.memory.signature" },
    { code: "PROHIBITED_CONTENT", path: "/extensions/org.example.memory.signature/payload/screenshot" },
  ]);
});

test("CCA-MIP-051..052: detached-byte publication is atomic and never mutates caller-owned state", async () => {
  const completeBytes = await fixture("complete");
  const complete = await mutablePackage("complete");
  const draft = draftFrom(complete);
  draft.observations.forEach((observation) => { observation.records.reverse(); });
  const callerBefore = canonicalize(draft);
  const published = exportMemoryInvestigationPackage(draft);
  assert.deepEqual(published, completeBytes);
  assert.equal(canonicalize(draft), callerBefore);
  assert.notEqual(published, completeBytes);

  const sentinelDestination = new Uint8Array([0x4d, 0x49, 0x50]);
  const sentinelBefore = new Uint8Array(sentinelDestination);
  const failureDrafts = [];

  const semanticFailure = draftFrom(await mutablePackage("complete"));
  semanticFailure.traces[0].target.identifier = "missing";
  failureDrafts.push(semanticFailure);

  const prohibitedFailure = draftFrom(await mutablePackage("minimal"));
  prohibitedFailure.observations[0].records[0].revision.screenshot = "inline";
  failureDrafts.push(prohibitedFailure);

  const versionFailure = draftFrom(await mutablePackage("minimal"));
  versionFailure.formatVersion = "1.1.0";
  failureDrafts.push(versionFailure);

  for (const failureDraft of failureDrafts) {
    const before = canonicalize(failureDraft);
    let partialBytes;
    assert.throws(() => { partialBytes = exportMemoryInvestigationPackage(failureDraft); }, MemoryInvestigationPackageError);
    assert.equal(partialBytes, undefined);
    assert.equal(canonicalize(failureDraft), before);
    assert.deepEqual(sentinelDestination, sentinelBefore);
  }
});

test("CCA-MIP-051..052: artifact publication failure returns nothing and preserves all preexisting state", async () => {
  const minimal = importMemoryInvestigationPackage(await fixture("minimal"));
  const packageBefore = canonicalize(minimal);
  const destination = new Uint8Array([7, 8, 9]);
  const destinationBefore = new Uint8Array(destination);
  let artifact;
  assert.throws(
    () => { artifact = createMemoryInvestigationPackageArtifact(minimal, "../partial.mip"); },
    (error) => error instanceof MemoryInvestigationPackageError
      && error.diagnostics[0]?.code === "SCHEMA_VIOLATION"
      && error.diagnostics[0]?.path === "/name",
  );
  assert.equal(artifact, undefined);
  assert.equal(canonicalize(minimal), packageBefore);
  assert.deepEqual(destination, destinationBefore);
});

test("CCA-MIP-052: failed import and verification preserve existing package and expose no partial state", async () => {
  const existing = importMemoryInvestigationPackage(await fixture("minimal"));
  const existingBefore = canonicalize(existing);
  const semanticFailure = await changed("complete", (value) => {
    value.traces[0].target.identifier = "missing";
  });
  const integrityFailure = await changed("minimal", (value) => {
    value.integrity.packageDigest = `sha256:${"0".repeat(64)}`;
  }, false);
  const resourceBytes = await fixture("minimal");
  const failures = [
    { input: Uint8Array.from([0xff]) },
    { input: integrityFailure },
    { input: semanticFailure },
    { input: resourceBytes, options: { maxBytes: resourceBytes.length - 1 } },
  ];

  for (const { input, options } of failures) {
    const verification = invalidResult(input, options);
    assert.equal(verification.package, null);
    assert.equal(verification.bytes, null);
    assert.throws(() => importMemoryInvestigationPackage(input, options), MemoryInvestigationPackageError);
    assert.equal(canonicalize(existing), existingBefore);
  }
});

test("CCA-MIP-055: every public round-trip preserves an unknown noncritical extension exactly", async () => {
  const extendedBytes = await fixture("extended");
  const imported = importMemoryInvestigationPackage(extendedBytes);
  const extensionBefore = canonicalize(imported.extensions["org.example.audit"]);

  assert.deepEqual(serializeMemoryInvestigationPackage(imported), extendedBytes);
  assert.deepEqual(exportMemoryInvestigationPackage(imported), extendedBytes);
  const artifact = createMemoryInvestigationPackageArtifact(imported, "extended.mip");
  assert.deepEqual(Uint8Array.from(artifact.bytes), extendedBytes);
  assert.equal(canonicalize(artifact.package.extensions["org.example.audit"]), extensionBefore);

  const draft = draftFrom(cloneCanonical(imported));
  const newlyPublished = importMemoryInvestigationPackage(exportMemoryInvestigationPackage(draft));
  assert.equal(canonicalize(newlyPublished.extensions["org.example.audit"]), extensionBefore);
});

test("CCA-MIP-058: compatibility is explicit, lossless, and never silently coerces a wire version", async () => {
  const sameMajorBytes = await changed("extended", (value) => {
    value.formatVersion = "1.4.2";
  });
  const sameMajor = importMemoryInvestigationPackage(sameMajorBytes);
  assert.equal(sameMajor.formatVersion, "1.4.2");
  assert.deepEqual(exportMemoryInvestigationPackage(sameMajor), sameMajorBytes);

  const representable = draftFrom(cloneCanonical(sameMajor));
  representable.formatVersion = "1.0.0";
  const downgraded = importMemoryInvestigationPackage(exportMemoryInvestigationPackage(representable));
  assert.equal(downgraded.formatVersion, "1.0.0");
  assert.equal(
    canonicalize(downgraded.extensions["org.example.audit"]),
    canonicalize(sameMajor.extensions["org.example.audit"]),
  );
  for (const section of ["observations", "traces", "replays", "evolutions", "comparativeReconstructions"]) {
    assert.equal(canonicalize(downgraded[section]), canonicalize(sameMajor[section]), section);
  }

  const implicitCoercion = draftFrom(cloneCanonical(sameMajor));
  assert.throws(
    () => exportMemoryInvestigationPackage(implicitCoercion),
    (error) => error instanceof MemoryInvestigationPackageError
      && error.diagnostics[0]?.code === "UNSUPPORTED_VERSION"
      && error.diagnostics[0]?.path === "/formatVersion",
  );

  const criticalDraft = draftFrom(await mutablePackage("minimal"));
  criticalDraft.extensions["org.example.memory.signature"] = {
    critical: true,
    payload: { algorithm: "external" },
    version: "1.0.0",
  };
  assert.throws(
    () => exportMemoryInvestigationPackage(criticalDraft),
    (error) => error instanceof MemoryInvestigationPackageError
      && error.diagnostics[0]?.code === "UNSUPPORTED_CRITICAL_EXTENSION",
  );
  const supported = importMemoryInvestigationPackage(
    exportMemoryInvestigationPackage(criticalDraft, { supportedExtensions: ["org.example.memory.signature"] }),
    { supportedExtensions: ["org.example.memory.signature"] },
  );
  assert.equal(Object.hasOwn(supported.extensions, "org.example.memory.signature"), true);

  const unknownMajor = await changed("minimal", (value) => { value.formatVersion = "2.0.0"; });
  expectPrimary(unknownMajor, "UNSUPPORTED_VERSION");
  const unknownCore = await changed("minimal", (value) => { value.futureCore = {}; }, false);
  expectPrimary(unknownCore, "UNKNOWN_CORE_MEMBER");
});
