import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  MIP_MEDIA_TYPE,
  MemoryInvestigationPackageError,
  computeMipIntegrity,
  createMemoryInvestigationPackage,
  createMemoryInvestigationPackageArtifact,
  exportMemoryInvestigationPackage,
  importMemoryInvestigationPackage,
  importMemoryInvestigationPackageFile,
  recordRevisionDigest,
  relationshipRevisionDigest,
  serializeMemoryInvestigationPackage,
  verifyMemoryInvestigationPackage,
} from "../web/js/memory-investigation-package.js";
import {
  canonicalize,
  cloneCanonical,
  decodeUtf8,
  sha256Hex,
  utf8Encode,
} from "../web/js/mip-canonical.js";

const fixtureDirectory = fileURLToPath(new URL("./fixtures/mip/", import.meta.url));
const golden = Object.freeze({
  minimal: {
    file: "minimal-observation.mip.b64",
    bytes: 2518,
    sha256: "36cdf11919c58727cc3b5ec0293ffbb1716b57c35899cf06e1a92b130b6b9483",
    packageDigest: "sha256:0333b3e8dd64e14cc1b114546e49f221e95662e695d45e507b7d87ba8b2178ae",
    cognitionDigest: "sha256:80d486e661f8eea7cdd6c257fc706ffa729647879f891be13604e6bc177836e3",
  },
  complete: {
    file: "complete-investigation.mip.b64",
    bytes: 19519,
    sha256: "176b81ef6caecdd6db19caf5ae4e0cdd89fe1f30b43f79d485eb72c6e3b96f32",
    packageDigest: "sha256:0b786c02d37435efe1729d002428ca044175cedb83a9e262c24e18b2f73f1b15",
    cognitionDigest: "sha256:b434df4e88219aeefe722ddb6e658b7e156ec319e8f1b15b73c40a7820305dab",
  },
  extended: {
    file: "noncritical-extension.mip.b64",
    bytes: 2642,
    sha256: "824fbab80067a0f915cdceb8bc8cfc24e01978301603e1e22b490369e2934712",
    packageDigest: "sha256:eded105fd02ca5c66eb03a5aecc995f1560449846d673f0c8a6e7aaf7887a655",
    cognitionDigest: "sha256:80d486e661f8eea7cdd6c257fc706ffa729647879f891be13604e6bc177836e3",
  },
});

async function fixture(name) {
  const encoded = await readFile(`${fixtureDirectory}${golden[name].file}`, "ascii");
  return new Uint8Array(Buffer.from(encoded.trim(), "base64"));
}

async function packageValue(name = "minimal") {
  return cloneCanonical(importMemoryInvestigationPackage(await fixture(name)));
}

function redigest(value) {
  value.integrity = computeMipIntegrity(value);
  return utf8Encode(canonicalize(value));
}

async function mutate(name, change, { updateIntegrity = true } = {}) {
  const value = await packageValue(name);
  change(value);
  return updateIntegrity ? redigest(value) : utf8Encode(canonicalize(value));
}

function primary(input, options) {
  return verifyMemoryInvestigationPackage(input, options).diagnostics[0]?.code ?? null;
}

function draftFrom(value) {
  return {
    packageIdentifier: value.manifest.packageIdentifier,
    workspaceIdentifier: value.manifest.workspaceIdentifier,
    formatVersion: value.formatVersion,
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

test("CCA-MIP-001..010: all published packages import headlessly with exact golden integrity", async () => {
  for (const [name, expected] of Object.entries(golden)) {
    const bytes = await fixture(name);
    const result = verifyMemoryInvestigationPackage(bytes);
    assert.equal(result.valid, true, `${name}: ${JSON.stringify(result.diagnostics)}`);
    assert.equal(bytes.length, expected.bytes);
    assert.equal(sha256Hex(bytes), expected.sha256);
    assert.equal(result.package.integrity.packageDigest, expected.packageDigest);
    assert.equal(result.package.integrity.cognitionDigest, expected.cognitionDigest);
    assert.ok(Object.isFrozen(result.package));
    assert.ok(Object.isFrozen(result.package.observations[0].records));
  }
});

test("CCA-MIP-004,037..044: import/export round trips exact bytes and digest scopes remain distinct", async () => {
  for (const name of Object.keys(golden)) {
    const bytes = await fixture(name);
    const imported = importMemoryInvestigationPackage(bytes);
    assert.deepEqual(exportMemoryInvestigationPackage(imported), bytes);
    assert.deepEqual(serializeMemoryInvestigationPackage(imported), bytes);
  }
  const minimal = importMemoryInvestigationPackage(await fixture("minimal"));
  const extended = importMemoryInvestigationPackage(await fixture("extended"));
  assert.equal(minimal.integrity.cognitionDigest, extended.integrity.cognitionDigest);
  assert.notEqual(minimal.integrity.packageDigest, extended.integrity.packageDigest);
});

test("CCA-MIP-008..010,016,019,039,050..052,064: deterministic export stages accepted source truth atomically", async () => {
  const minimalBytes = await fixture("minimal");
  const minimal = importMemoryInvestigationPackage(minimalBytes);
  const draft = draftFrom(minimal);
  draft.observations[0].records.reverse();
  assert.deepEqual(exportMemoryInvestigationPackage(draft), minimalBytes);
  assert.deepEqual(exportMemoryInvestigationPackage(draft), exportMemoryInvestigationPackage(draft));
  assert.equal(Object.hasOwn(createMemoryInvestigationPackage(draft).metadata, "exportedAt"), false);

  const unaccepted = { ...draft, sourceAccepted: false };
  assert.throws(() => exportMemoryInvestigationPackage(unaccepted), MemoryInvestigationPackageError);
  const unattested = { ...draft, sourceAuthorshipAttested: false };
  assert.throws(() => exportMemoryInvestigationPackage(unattested), MemoryInvestigationPackageError);
  assert.deepEqual(minimalBytes, await fixture("minimal"));
});

test("CCA-MIP-005,048: .mip file envelopes enforce name and media type", async () => {
  const bytes = await fixture("minimal");
  const value = importMemoryInvestigationPackageFile({ name: "investigation.mip", mediaType: MIP_MEDIA_TYPE, bytes });
  assert.equal(value.kind, "MemoryInvestigationPackage");
  assert.throws(() => importMemoryInvestigationPackageFile({ name: "investigation.json", mediaType: MIP_MEDIA_TYPE, bytes }), MemoryInvestigationPackageError);
  assert.throws(() => importMemoryInvestigationPackageFile({ name: "investigation.mip", mediaType: "application/json", bytes }), MemoryInvestigationPackageError);
  const artifact = createMemoryInvestigationPackageArtifact(value, "investigation.mip");
  assert.equal(artifact.mediaType, MIP_MEDIA_TYPE);
  assert.equal(importMemoryInvestigationPackageFile(artifact).manifest.packageIdentifier, value.manifest.packageIdentifier);
});

test("CCA-MIP-005..007,037,045..046: lexical, duplicate, canonical, version, and closed-core diagnostics follow phase precedence", async () => {
  assert.equal(primary(Uint8Array.from([0xff])), "INVALID_ENCODING");
  const minimal = decodeUtf8(await fixture("minimal"));
  assert.equal(primary(minimal.slice(0, -1)), "INVALID_JSON");
  assert.equal(primary(minimal.replace('{"$schema"', '{"kind":"duplicate","$schema"')), "DUPLICATE_MEMBER");
  assert.equal(primary(minimal.replace(":", ": ")), "NON_CANONICAL");
  assert.equal(primary(await mutate("minimal", (value) => { value.formatVersion = "2.0.0"; })), "UNSUPPORTED_VERSION");
  assert.equal(primary(await mutate("minimal", (value) => { delete value.replays; }, { updateIntegrity: false })), "MISSING_REQUIRED_SECTION");
  assert.equal(primary(await mutate("minimal", (value) => { value.camera = {}; }, { updateIntegrity: false })), "UNKNOWN_CORE_MEMBER");
  const diagnostic = verifyMemoryInvestigationPackage(minimal.replace('{"$schema"', '{"kind":"duplicate","$schema"')).diagnostics[0];
  assert.deepEqual(Object.keys(diagnostic), ["code", "path"]);
  assert.ok(diagnostic.path.startsWith("/"));
});

test("CCA-MIP-041..043: checksum changes are rejected before semantic publication", async () => {
  const bytes = await mutate("minimal", (value) => { value.observations[0].records[0].revision.retained = false; }, { updateIntegrity: false });
  assert.equal(primary(bytes), "CHECKSUM_MISMATCH");
  assert.throws(() => importMemoryInvestigationPackage(bytes), MemoryInvestigationPackageError);
});

test("CCA-MIP-011..020: identity, ordering, Workspace, closure, and provenance are validated", async () => {
  assert.equal(primary(await mutate("minimal", (value) => { value.observations[0].workspaceIdentifier = "other"; })), "WORKSPACE_MISMATCH");
  assert.equal(primary(await mutate("minimal", (value) => { value.observations[0].records.push(cloneCanonical(value.observations[0].records[0])); })), "DUPLICATE_IDENTIFIER");
  assert.equal(primary(await mutate("complete", (value) => { value.observations[0].relationships[0].from.identifier = "absent"; })), "DANGLING_REFERENCE");
  assert.equal(primary(await mutate("complete", (value) => {
    const observation = value.observations[0];
    observation.records[0].provenance.push({
      source: cloneCanonical(observation.records.at(-1).reference),
      relationship: cloneCanonical(observation.relationships[0].reference),
    });
  })), "INVALID_PROVENANCE");
  assert.equal(primary(await mutate("complete", (value) => { value.observations[0].records.reverse(); })), "ORDER_VIOLATION");
});

test("CCA-MIP-021..028: Trace and Replay are independently reconstructed", async () => {
  assert.equal(primary(await mutate("complete", (value) => {
    const steps = value.traces[0].branches[0].steps;
    [steps[0], steps[1]] = [steps[1], steps[0]];
  })), "INVALID_TRACE");
  assert.equal(primary(await mutate("complete", (value) => {
    value.replays[0].steps.splice(1, 1);
    value.replays[0].steps.forEach((step, index) => { step.index = index; });
  })), "INVALID_REPLAY");
});

test("CCA-MIP-029..036: Evolution and Comparative Reconstruction are independently recomputed", async () => {
  const complete = importMemoryInvestigationPackage(await fixture("complete"));
  const beforeRecord = complete.observations[0].records.find(({ role }) => role === "semanticTransformation");
  const afterRecord = complete.observations[1].records.find(({ role }) => role === "semanticTransformation");
  assert.equal(recordRevisionDigest(beforeRecord), complete.evolutions[0].differences.find(({ kind }) => kind === "removedSemanticTransformation").beforeRevisionDigest);
  assert.equal(recordRevisionDigest(afterRecord), complete.evolutions[0].differences.find(({ kind }) => kind === "addedSemanticTransformation").afterRevisionDigest);
  const relationship = complete.observations[1].relationships[0];
  assert.match(relationshipRevisionDigest(relationship), /^sha256:[0-9a-f]{64}$/);
  assert.equal(primary(await mutate("complete", (value) => {
    value.evolutions[0].differences.shift();
    value.evolutions[0].differences.forEach((difference, index) => { difference.index = index; });
  })), "INVALID_EVOLUTION");
  assert.equal(primary(await mutate("complete", (value) => {
    const moment = value.comparativeReconstructions[0].moments.find(({ state }) => state !== "shared");
    moment.state = "shared";
    moment.reasonCodes = [];
  })), "INVALID_COMPARATIVE_RECONSTRUCTION");
});

test("CCA-MIP-047..049: semantic failures and resource limits publish no partial state", async () => {
  const existing = importMemoryInvestigationPackage(await fixture("minimal"));
  const snapshot = canonicalize(existing);
  const bad = await mutate("complete", (value) => { value.traces[0].target.identifier = "missing"; });
  assert.throws(() => importMemoryInvestigationPackage(bad), MemoryInvestigationPackageError);
  assert.equal(canonicalize(existing), snapshot);
  const bytes = await fixture("minimal");
  assert.equal(primary(bytes, { maxBytes: bytes.length - 1 }), "RESOURCE_LIMIT_EXCEEDED");
  assert.equal(primary(bytes, { maxDepth: 1 }), "RESOURCE_LIMIT_EXCEEDED");
});

test("CCA-MIP-053..058: extension bijection, preservation, critical handling, and same-major compatibility", async () => {
  const extendedBytes = await fixture("extended");
  assert.deepEqual(exportMemoryInvestigationPackage(importMemoryInvestigationPackage(extendedBytes)), extendedBytes);
  const critical = await mutate("minimal", (value) => {
    value.extensions["org.example.memory.signature"] = { critical: true, payload: { algorithm: "external" }, version: "1.0.0" };
    value.manifest.features.required = ["org.example.memory.signature"];
  });
  assert.equal(primary(critical), "UNSUPPORTED_CRITICAL_EXTENSION");
  assert.equal(verifyMemoryInvestigationPackage(critical, { supportedExtensions: ["org.example.memory.signature"] }).valid, true);
  const newer = await mutate("minimal", (value) => { value.formatVersion = "1.1.0"; });
  assert.equal(verifyMemoryInvestigationPackage(newer).valid, true);
  assert.equal(primary(await mutate("minimal", (value) => { value.formatVersion = "1.0.0-beta"; }, { updateIntegrity: false })), "UNSUPPORTED_VERSION");
});

test("CCA-MIP-054,059..064: presentation, media, Runtime, executable, and generated content are rejected", async () => {
  const extensionMutation = async (payload) => mutate("minimal", (value) => {
    value.extensions["org.example.memory.invalid"] = { critical: false, payload, version: "1.0.0" };
    value.manifest.features.optional = ["org.example.memory.invalid"];
  });
  assert.equal(primary(await extensionMutation({ camera: { x: 1, y: 2 } })), "PROHIBITED_CONTENT");
  assert.equal(primary(await extensionMutation({ eventBusHandle: "live" })), "PROHIBITED_CONTENT");
  assert.equal(primary(await extensionMutation({ generatedExplanation: "invented" })), "PROHIBITED_CONTENT");
  assert.equal(primary(await extensionMutation({ executableScript: "javascript:alert(1)" })), "PROHIBITED_CONTENT");
  assert.equal(primary(await extensionMutation({ observations: [] })), "PROHIBITED_CONTENT");
  assert.equal(primary(await mutate("minimal", (value) => { value.observations[0].records[0].revision.screenshot = "data:image/png;base64,AAAA"; })), "PROHIBITED_CONTENT");
  const legitimateText = await mutate("minimal", (value) => {
    Object.assign(value.observations[0].records[0].revision, {
      catalog: "release evidence",
      company: "source-authored subject",
      description: "source-authored cognition",
    });
  });
  assert.equal(verifyMemoryInvestigationPackage(legitimateText).valid, true);
});

test("MIP implementation remains headless and renderer-independent", async () => {
  const packageSource = await readFile(new URL("../web/js/memory-investigation-package.js", import.meta.url), "utf8");
  const canonicalSource = await readFile(new URL("../web/js/mip-canonical.js", import.meta.url), "utf8");
  const imports = [...packageSource.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(imports, ["./mip-canonical.js"]);
  assert.doesNotMatch(canonicalSource, /^\s*import\s/m);
  assert.doesNotMatch(`${packageSource}\n${canonicalSource}`, /\b(?:document|window|localStorage|sessionStorage|requestAnimationFrame|setTimeout|setInterval|Date\.now|Math\.random)\b/);
});
