import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CONFORMANCE_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const WORKSPACE_ROOT = resolve(CONFORMANCE_ROOT, "../..");
export const MANIFEST_PATH = resolve(CONFORMANCE_ROOT, "requirements-manifest.json");
export const REFERENCE_REPORT_PATH = resolve(
  CONFORMANCE_ROOT,
  "reports/reference-implementation-1.2.1.json",
);
export const REFERENCE_EVIDENCE_PATH = resolve(
  CONFORMANCE_ROOT,
  "evidence/reference-implementation-1.2.1.json",
);
export const REFERENCE_EVIDENCE_URI = "evidence/reference-implementation-1.2.1.json";
export function retainedEvidenceFilename(digest) {
  requireString(digest, "retained evidence digest", SHA256_PATTERN);
  return `reference-implementation-1.2.1-${digest.replace(":", "-")}.json`;
}
export const REFERENCE_REVIEW_PATH = resolve(
  CONFORMANCE_ROOT,
  "evidence/reference-implementation-review-1.2.1.json",
);
export const REFERENCE_REVIEW_URI = "evidence/reference-implementation-review-1.2.1.json";
export const REFERENCE_REPORT_URI = "reports/reference-implementation-1.2.1.json";
export const REFERENCE_MARKDOWN_PATH = resolve(
  CONFORMANCE_ROOT,
  "reports/reference-implementation-1.2.1.md",
);
export const CLI_PATH = resolve(WORKSPACE_ROOT, "repositories/memoryos-cli/bin/memoryos.js");
export const STUDIO_ROOT = resolve(WORKSPACE_ROOT, "repositories/cca-studio");

const REQUIREMENT_PATTERN = /^(?:CCA-MOS-(?:RT|LIFE|MIP|ART|ADAPT|CORE|SDK|CLI|REG|EXPL|CONF|COMP|VER)-[0-9]{3}|CCA-RF-[0-9]{3}|CCA-MIP-[0-9]{3})$/u;
const EVIDENCE_PATTERN = /^MOS-EVID-[A-Z]+-[0-9]{3}$/u;
const STANDARD_VERSION_PATTERN = /^[0-9]+\.[0-9]+$/u;
const IMPLEMENTATION_VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/u;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u;
const REPORT_STATUSES = Object.freeze(["PASS", "FAIL", "NOT APPLICABLE"]);
const STANDARD_PUBLICATION_DATE = "2026-09-05";
const STANDARD_DOCUMENT_PATHS = Object.freeze([
  "CHANGELOG.md", "README.md", "adapter-contract.md", "certification.md", "cli-contract.md",
  "cognitive-regression.md", "compatibility.md", "conformance.md", "diagrams/investigation-lifecycle.mmd",
  "diagrams/platform-boundary.mmd", "investigation-core.md", "investigation-explorer.md",
  "investigation-lifecycle.md", "mip-contract.md", "native-artifacts.md", "native-observation-profile.md",
  "reference-implementation.md", "requirements.yaml", "runtime-behavior.md", "sdk-contract.md", "versioning.md",
]);
const INCORPORATED_DOCUMENT_PATHS = Object.freeze({
  "CCA-MIP-1.0": Object.freeze([
    "MIP-001.md", "conformance.md", "requirements.yaml", "schema/memory-investigation-package-1.0.schema.json",
  ]),
  "CCA-RF-1.0": Object.freeze(["README.md", "conformance.md", "decisions.md", "requirements.yaml"]),
});
const COMPLETE_PROFILES = Object.freeze([
  "AI Runtime Adapter",
  "CLI",
  "Cognitive Investigation Explorer",
  "Cognitive Regression",
  "Investigation Core",
  "MIP Integration",
  "Native Investigation Artifacts",
  "Runtime Observation Boundary",
  "SDK",
]);
export const REFERENCE_NATIVE_PROFILE = Object.freeze({
  identifier: "cca-studio-native-observation",
  version: "1.1.0",
});
export const EXECUTION_COMMANDS = Object.freeze({
  "boundary-js": "node --test tests/boundary_contract_conformance_test.mjs",
  "compatibility-js": "node --test tests/compatibility_conformance_test.mjs",
  "component-js": "MEMORYOS_DETERMINISTIC_CONFORMANCE=1 node --test --test-concurrency=1 <pinned component sources>",
  "reproducibility-meta": "run-reference-evidence in-process repeated authoritative execution comparison",
  "normative-vectors-js": "node --test tests/normative_vectors_conformance_test.mjs",
  "reference-js": "node --test tests/reference_implementation_conformance_test.mjs",
  "runtime-native": "cca_core_tests",
  "sdk-cpp": "memoryos_sdk_cpp_tests",
  "sdk-python": "python repositories/cca-sdk/python/tests/test_memoryos_sdk.py",
  "specification-js": "node --test tests/specification_conformance_test.mjs",
});
export const COMPONENT_EXECUTION_SOURCES = Object.freeze([
  "repositories/cca-studio/tests/ai_runtime_adapter_test.mjs",
  "repositories/cca-studio/tests/cognitive_investigation_explorer_test.mjs",
  "repositories/cca-studio/tests/cognitive_regression_test.mjs",
  "repositories/cca-studio/tests/investigation_core_test.mjs",
  "repositories/cca-studio/tests/memory_investigation_package_test.mjs",
  "repositories/cca-studio/tests/memory_studio_integration_test.mjs",
  "repositories/cca-studio/tests/memory_studio_web_test.mjs",
  "repositories/cca-studio/tests/memoryos_sdk_test.mjs",
  "repositories/cca-studio/tests/mip_adversarial_conformance_test.mjs",
  "repositories/cca-studio/tests/mip_canonical_test.mjs",
  "repositories/cca-studio/tests/mip_derived_edge_conformance_test.mjs",
  "repositories/cca-studio/tests/mip_ordering_conformance_test.mjs",
  "repositories/cca-studio/tests/mip_pipeline_conformance_test.mjs",
  "repositories/cca-studio/tests/mip_schema_conformance_test.mjs",
  "repositories/memoryos-cli/tests/architecture.test.mjs",
  "repositories/memoryos-cli/tests/cli-contract.test.mjs",
  "repositories/memoryos-cli/tests/human-output.test.mjs",
  "repositories/memoryos-cli/tests/investigate.test.mjs",
  "repositories/memoryos-cli/tests/package-workflow.test.mjs",
  "repositories/memoryos-cli/tests/session.test.mjs",
]);
export const EXECUTION_EXPECTATIONS = Object.freeze({
  "boundary-js": Object.freeze({ tests: 2, skips: Object.freeze([]) }),
  "compatibility-js": Object.freeze({ tests: 4, skips: Object.freeze([]) }),
  "component-js": Object.freeze({
    tests: 258,
    skips: Object.freeze([
      "MO-1206 Regression remains deterministic under repeated bounded analysis",
      "MO-1207 Explorer is read-only and deterministic under bounded navigation",
      "investigate remains bounded for a complete deterministic Regression Report",
    ].sort()),
  }),
  "reproducibility-meta": Object.freeze({ tests: 1, skips: Object.freeze([]) }),
  "normative-vectors-js": Object.freeze({ tests: 10, skips: Object.freeze([]) }),
  "reference-js": Object.freeze({ tests: 5, skips: Object.freeze([]) }),
  "runtime-native": Object.freeze({ tests: 376, skips: Object.freeze([]) }),
  "sdk-cpp": Object.freeze({ tests: 13, skips: Object.freeze([]) }),
  "sdk-python": Object.freeze({ tests: 12, skips: Object.freeze([]) }),
  "specification-js": Object.freeze({ tests: 11, skips: Object.freeze([]) }),
});
const JAVASCRIPT_EXECUTION_FILES = Object.freeze({
  "boundary-js": "boundary_contract_conformance_test.mjs",
  "compatibility-js": "compatibility_conformance_test.mjs",
  "component-js": "component_evidence_conformance_test.mjs",
  "normative-vectors-js": "normative_vectors_conformance_test.mjs",
  "reference-js": "reference_implementation_conformance_test.mjs",
  "specification-js": "specification_conformance_test.mjs",
});
const DIRECT_REQUIREMENT_RANGES = Object.freeze([
  ["ADAPT", 9],
  ["ART", 16],
  ["CLI", 10],
  ["COMP", 6],
  ["CONF", 7],
  ["CORE", 12],
  ["EXPL", 8],
  ["LIFE", 12],
  ["MIP", 5],
  ["REG", 8],
  ["RT", 6],
  ["SDK", 10],
  ["VER", 5],
]);
const INCORPORATED_WRAPPERS = Object.freeze(new Set(["CCA-MOS-MIP-001", "CCA-MOS-RT-001"]));

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactMembers(value, expected, label) {
  assert.equal(isPlainObject(value), true, `${label} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label} has an invalid member set`);
}

function requireString(value, label, pattern = null) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.notEqual(value.length, 0, `${label} must not be empty`);
  if (pattern) assert.match(value, pattern, `${label} has an invalid value`);
}

function requireDate(value, label) {
  requireString(value, label, DATE_PATTERN);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  assert.equal(Number.isNaN(parsed.valueOf()), false, `${label} is not a calendar date`);
  assert.equal(parsed.toISOString().slice(0, 10), value, `${label} is not a calendar date`);
}

function requireDateOnOrAfter(value, earliest, label) {
  requireDate(value, label);
  requireDate(earliest, `${label} lower bound`);
  assert.ok(value >= earliest, `${label} predates ${earliest}`);
}

function validateImplementationIdentity(value, label) {
  const hasRevision = isPlainObject(value) && Object.hasOwn(value, "revision");
  exactMembers(value, hasRevision ? ["name", "version", "revision"] : ["name", "version"], label);
  requireString(value.name, `${label} name`);
  requireString(value.version, `${label} version`, IMPLEMENTATION_VERSION_PATTERN);
  if (hasRevision) requireString(value.revision, `${label} revision`);
}

function assertUniqueOrdered(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`);
  assert.deepEqual(values, [...values].sort(), `${label} must use deterministic lexical order`);
}

export function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function normalizeEvidenceOutput(value) {
  return value
    .replace(/\u001b\[[0-9;]*m/gu, "")
    .replaceAll(WORKSPACE_ROOT, "<WORKSPACE>")
    .replaceAll(WORKSPACE_ROOT.replaceAll("\\", "/"), "<WORKSPACE>")
    .replace(/duration_ms: [0-9.]+/gu, "duration_ms: <elapsed>")
    .replace(/# duration_ms [0-9.]+/gu, "# duration_ms <elapsed>")
    .replace(/\([0-9]+ ms(?: total)?\)/gu, "(<elapsed>)")
    .replace(/Ran ([0-9]+) tests? in [0-9.]+s/gu, "Ran $1 tests in <elapsed>");
}

function reproducibleExecutionProjection(execution) {
  const { environment: ignored, ...projection } = execution;
  return projection;
}

export function reproducibilityDiagnostics(primaryExecutions, variantExecutions) {
  const primaryById = new Map(primaryExecutions.map((execution) => [execution.id, execution]));
  const diagnostics = [];
  for (const variant of variantExecutions) {
    const primary = primaryById.get(variant.id);
    if (!primary || canonicalJson(reproducibleExecutionProjection(primary)) !== canonicalJson(reproducibleExecutionProjection(variant))) {
      diagnostics.push(`${variant.id} changed under the controlled irrelevant environment variant`);
    }
  }
  if (variantExecutions.length !== primaryExecutions.length) {
    diagnostics.push("the repeated execution set is incomplete");
  }
  return diagnostics;
}

export function manifestDigest(manifest) {
  return sha256(Buffer.from(canonicalJson(manifest), "utf8"));
}

export function retainedManifestFilename(manifest) {
  return `requirements-manifest-${manifestDigest(manifest).replace(":", "-")}.json`;
}

export async function retainAssessmentManifest(
  manifest,
  manifestsRoot = resolve(CONFORMANCE_ROOT, "manifests"),
) {
  validateManifest(manifest);
  const source = `${canonicalJson(manifest)}\n`;
  const path = resolve(manifestsRoot, retainedManifestFilename(manifest));
  await mkdir(manifestsRoot, { recursive: true });
  try {
    await writeFile(path, source, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    assert.equal(
      await readFile(path, "utf8"),
      source,
      "an immutable retained manifest path contains different bytes",
    );
  }
  return path;
}

export async function readJson(path) {
  const bytes = await readFile(path);
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const value = JSON.parse(source);
  assert.equal(isPlainObject(value), true, `${path} must contain a JSON object`);
  return value;
}

export async function readCanonicalJson(path) {
  const bytes = await readFile(path);
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const value = JSON.parse(source);
  assert.equal(isPlainObject(value), true, `${path} must contain a JSON object`);
  assert.deepEqual(
    bytes,
    Buffer.from(`${canonicalJson(value)}\n`, "utf8"),
    `${path} must use exact canonical UTF-8 JSON bytes`,
  );
  return value;
}

export async function readManifest(path = process.env.MEMORYOS_CONFORMANCE_MANIFEST ?? MANIFEST_PATH) {
  return readCanonicalJson(path);
}

function applicableGroups(profiles, manifest) {
  const groups = new Set(manifest.conformanceProfiles.commonEvidenceGroups);
  for (const profile of profiles) {
    const definition = manifest.conformanceProfiles.profiles.find(({ name }) => name === profile);
    assert.ok(definition, `unknown conformance profile ${profile}`);
    for (const group of definition.evidenceGroups) groups.add(group);
  }
  return groups;
}

function expectedExecutionInputInventory(manifest, identifier) {
  return [...new Map(
    manifest.evidenceGroups
      .filter(({ executionReferences }) => executionReferences.includes(identifier))
      .flatMap(({ inputInventory }) => inputInventory)
      .map((record) => [record.path, record]),
  ).values()].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

function validateExecutionInvocation(execution, nativeBuildAttestation = null) {
  if (execution.id === "reproducibility-meta") {
    assert.equal(
      execution.executablePath,
      resolve(CONFORMANCE_ROOT, "tools/run-reference-evidence.mjs"),
      "reproducibility meta-execution must be produced by the retained evidence runner",
    );
    assert.equal(execution.cwd, resolve(CONFORMANCE_ROOT));
    assert.deepEqual(execution.argv, []);
    return;
  }
  assert.equal(execution.environment.FORCE_COLOR, "0");
  assert.equal(execution.environment.LANG, "C");
  assert.equal(execution.environment.LC_ALL, "C");
  assert.equal(execution.environment.NO_COLOR, "1");
  assert.equal(execution.environment.PYTHONDONTWRITEBYTECODE, "1");
  assert.equal(execution.environment.TZ, "UTC");
  if (execution.id === "component-js") {
    assert.equal(execution.executablePath, resolve(process.execPath), "component-js must use this Node executable");
    assert.equal(execution.cwd, resolve(WORKSPACE_ROOT), "component-js working directory differs");
    assert.equal(execution.environment.MEMORYOS_DETERMINISTIC_CONFORMANCE, "1");
    assert.deepEqual(
      execution.argv,
      [
        "--test",
        "--test-reporter=tap",
        "--test-concurrency=1",
        ...COMPONENT_EXECUTION_SOURCES.map((path) => resolve(WORKSPACE_ROOT, path)),
      ],
      "component-js argv differs",
    );
    return;
  }
  if (Object.hasOwn(JAVASCRIPT_EXECUTION_FILES, execution.id)) {
    assert.equal(execution.executablePath, resolve(process.execPath), `${execution.id} must use this Node executable`);
    assert.equal(execution.cwd, resolve(CONFORMANCE_ROOT), `${execution.id} working directory differs`);
    assert.deepEqual(
      execution.argv,
      [
        "--test",
        "--test-reporter=tap",
        resolve(CONFORMANCE_ROOT, "tests", JAVASCRIPT_EXECUTION_FILES[execution.id]),
      ],
      `${execution.id} argv differs`,
    );
    if (execution.id === "specification-js") {
      assert.equal(execution.environment.MEMORYOS_REQUIRE_PUBLISHED_STANDARD, "1");
      assert.equal(
        execution.environment.MEMORYOS_STANDARD_ROOT,
        resolve(WORKSPACE_ROOT, "../cca-specifications/specifications/CCA-MEMORYOS-1.0"),
      );
    }
    return;
  }
  assert.equal(execution.cwd, resolve(WORKSPACE_ROOT), `${execution.id} working directory differs`);
  if (execution.id === "sdk-python") {
    assert.deepEqual(
      execution.argv,
      [resolve(WORKSPACE_ROOT, "repositories/cca-sdk/python/tests/test_memoryos_sdk.py"), "-v"],
      "sdk-python argv differs",
    );
    return;
  }
  assert.ok(["runtime-native", "sdk-cpp"].includes(execution.id), `unknown execution ${execution.id}`);
  const built = nativeBuildAttestation?.artifacts.find(({ role }) => role === execution.id);
  if (built) {
    assert.deepEqual(execution.argv, [], `${execution.id} argv differs`);
    return;
  }
  const project = execution.id === "runtime-native" ? "runtime" : "sdk";
  const failedBuild = nativeBuildAttestation?.builds.find(({ project: value }) => value === project);
  const cmake = nativeBuildAttestation?.tools.find(({ role }) => role === "cmake");
  assert.ok(failedBuild && cmake, `${execution.id} has neither a built artifact nor attributable build failure`);
  assert.equal(execution.status, "FAIL");
  assert.equal(execution.executablePath, cmake.path);
  assert.equal(execution.executableDigest, cmake.sha256);
  assert.deepEqual(execution.argv, failedBuild.argv);
  assert.equal(execution.cwd, failedBuild.cwd);
  assert.equal(execution.stdoutDigest, failedBuild.stdoutDigest);
  assert.equal(execution.stderrDigest, failedBuild.stderrDigest);
  assert.deepEqual(execution.rawChecks, []);
}

function validateCurrentInput(record, label) {
  exactMembers(record, ["path", "kind", "sha256"], label);
  requireString(record.path, `${label} path`);
  assert.ok(["file", "directory"].includes(record.kind), `${label} kind is invalid`);
  requireString(record.sha256, `${label} digest`, SHA256_PATTERN);
}

function filesBelowSync(root, directory = root) {
  const result = [];
  const entries = readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesBelowSync(root, path));
    else if (entry.isFile()) result.push(relative(root, path).split(sep).join("/"));
  }
  return result.sort();
}

function currentInputRecord(record) {
  const absolute = resolve(WORKSPACE_ROOT, record.path);
  const metadata = statSync(absolute);
  if (record.kind === "file") {
    assert.equal(metadata.isFile(), true, `${record.path} is no longer a regular file`);
    return { ...record, sha256: sha256(readFileSync(absolute)) };
  }
  assert.equal(metadata.isDirectory(), true, `${record.path} is no longer a directory`);
  const documents = filesBelowSync(absolute).map((path) => ({
    path,
    sha256: sha256(readFileSync(resolve(absolute, path))),
  }));
  return {
    ...record,
    sha256: sha256(Buffer.from(canonicalJson(documents), "utf8")),
  };
}

export function validateManifestInputsCurrent(manifest) {
  validateManifest(manifest);
  const inputs = [
    ...manifest.implementation.sourceInventory,
    ...manifest.evidenceGroups.flatMap(({ inputInventory }) => inputInventory),
  ];
  for (const record of inputs) {
    assert.deepEqual(
      currentInputRecord(record),
      record,
      `${record.path} differs from the pinned manifest bytes`,
    );
  }
  return manifest.implementation.sourceInventory;
}

export function validateManifest(manifest) {
  exactMembers(
    manifest,
    ["schemaVersion", "standard", "incorporatedStandards", "conformanceProfiles", "normativeRegistryDigest", "implementation", "evidenceGroups", "requirements"],
    "requirements manifest",
  );
  assert.equal(manifest.schemaVersion, "1.0");
  requireString(manifest.normativeRegistryDigest, "normative registry digest", SHA256_PATTERN);

  exactMembers(
    manifest.standard,
    ["identifier", "version", "publicationDate", "publicationDigest", "documents"],
    "manifest standard",
  );
  assert.equal(manifest.standard.identifier, "CCA-MEMORYOS-1.0");
  assert.equal(manifest.standard.version, "1.0", "Standard identifier/version pair differs");
  assert.equal(manifest.standard.publicationDate, STANDARD_PUBLICATION_DATE);
  requireString(manifest.standard.publicationDigest, "publication digest", SHA256_PATTERN);
  assert.ok(Array.isArray(manifest.standard.documents) && manifest.standard.documents.length > 0);

  const documentPaths = [];
  for (const [index, document] of manifest.standard.documents.entries()) {
    exactMembers(document, ["path", "sha256"], `document ${index}`);
    requireString(document.path, `document ${index} path`);
    assert.equal(document.path.includes("\\"), false, "document paths use portable separators");
    assert.equal(document.path.startsWith("/"), false, "document paths are relative");
    assert.equal(document.path.includes(".."), false, "document paths cannot traverse upward");
    requireString(document.sha256, `document ${index} digest`, SHA256_PATTERN);
    documentPaths.push(document.path);
  }
  assertUniqueOrdered(documentPaths, "standard document paths");
  assert.deepEqual(documentPaths, STANDARD_DOCUMENT_PATHS, "Standard publication inventory is incomplete or extended");
  assert.equal(
    manifest.standard.publicationDigest,
    sha256(Buffer.from(canonicalJson(manifest.standard.documents), "utf8")),
    "publication digest must commit the ordered document inventory",
  );

  assert.ok(Array.isArray(manifest.incorporatedStandards));
  assert.equal(manifest.incorporatedStandards.length, 2);
  const incorporatedIdentifiers = [];
  const incorporatedDocuments = new Map();
  for (const [index, publication] of manifest.incorporatedStandards.entries()) {
    exactMembers(
      publication,
      ["identifier", "version", "publicationDigest", "requirementRange", "evidenceGroups", "documents"],
      `incorporated standard ${index}`,
    );
    assert.ok(["CCA-MIP-1.0", "CCA-RF-1.0"].includes(publication.identifier));
    assert.equal(publication.version, "1.0", `${publication.identifier} identifier/version pair differs`);
    requireString(publication.publicationDigest, `${publication.identifier} publication digest`, SHA256_PATTERN);
    exactMembers(publication.requirementRange, ["first", "last"], `${publication.identifier} range`);
    const expectedRange = publication.identifier === "CCA-MIP-1.0"
      ? { first: "CCA-MIP-001", last: "CCA-MIP-064" }
      : { first: "CCA-RF-001", last: "CCA-RF-040" };
    assert.deepEqual(publication.requirementRange, expectedRange);
    assert.deepEqual(
      publication.evidenceGroups,
      publication.identifier === "CCA-MIP-1.0" ? ["MOS-EVID-MIP-001"] : ["MOS-EVID-RT-001"],
    );
    assert.ok(Array.isArray(publication.documents) && publication.documents.length > 0);
    const paths = [];
    for (const [documentIndex, document] of publication.documents.entries()) {
      exactMembers(document, ["path", "sha256"], `${publication.identifier} document ${documentIndex}`);
      requireString(document.path, `${publication.identifier} document path`);
      assert.equal(document.path.includes("\\"), false, "document paths use portable separators");
      assert.equal(document.path.startsWith("/"), false, "document paths are relative");
      assert.equal(document.path.includes(".."), false, "document paths cannot traverse upward");
      requireString(document.sha256, `${publication.identifier} document digest`, SHA256_PATTERN);
      paths.push(document.path);
    }
    assertUniqueOrdered(paths, `${publication.identifier} document paths`);
    assert.deepEqual(
      paths,
      INCORPORATED_DOCUMENT_PATHS[publication.identifier],
      `${publication.identifier} publication inventory is incomplete or extended`,
    );
    assert.equal(
      publication.publicationDigest,
      sha256(Buffer.from(canonicalJson(publication.documents), "utf8")),
      `${publication.identifier} publication digest must commit its ordered document inventory`,
    );
    incorporatedIdentifiers.push(publication.identifier);
    incorporatedDocuments.set(publication.identifier, new Set(paths));
  }
  assert.deepEqual(incorporatedIdentifiers, ["CCA-MIP-1.0", "CCA-RF-1.0"]);

  exactMembers(
    manifest.conformanceProfiles,
    ["applicability", "commonEvidenceGroups", "profiles"],
    "conformance profile registry",
  );
  assert.equal(
    manifest.conformanceProfiles.applicability,
    "union_of_common_and_selected_profile_evidence_groups",
  );
  assert.ok(Array.isArray(manifest.conformanceProfiles.commonEvidenceGroups));
  assertUniqueOrdered(manifest.conformanceProfiles.commonEvidenceGroups, "common conformance evidence groups");
  assert.ok(Array.isArray(manifest.conformanceProfiles.profiles));
  assert.deepEqual(
    manifest.conformanceProfiles.profiles.map(({ name }) => name),
    COMPLETE_PROFILES,
    "conformance profile names must match the published registry",
  );
  for (const [index, profile] of manifest.conformanceProfiles.profiles.entries()) {
    exactMembers(profile, ["name", "evidenceGroups"], `conformance profile ${index}`);
    assert.ok(Array.isArray(profile.evidenceGroups) && profile.evidenceGroups.length > 0);
    assertUniqueOrdered(profile.evidenceGroups, `${profile.name} evidence groups`);
  }

  exactMembers(
    manifest.implementation,
    Object.hasOwn(manifest.implementation, "revision")
      ? ["name", "version", "revision", "sourceInventory"]
      : ["name", "version", "sourceInventory"],
    "assessment implementation",
  );
  const implementationIdentity = {
    name: manifest.implementation.name,
    version: manifest.implementation.version,
  };
  if (Object.hasOwn(manifest.implementation, "revision")) {
    implementationIdentity.revision = manifest.implementation.revision;
  }
  validateImplementationIdentity(implementationIdentity, "assessment implementation identity");
  assert.ok(Array.isArray(manifest.implementation.sourceInventory));
  manifest.implementation.sourceInventory.forEach((record, index) => {
    validateCurrentInput(record, `assessment implementation source ${index}`);
  });
  assertUniqueOrdered(
    manifest.implementation.sourceInventory.map(({ path }) => path),
    "assessment implementation source paths",
  );

  assert.ok(Array.isArray(manifest.evidenceGroups) && manifest.evidenceGroups.length > 0);
  const evidenceIds = [];
  const automatedEvidence = new Set();
  for (const [index, evidence] of manifest.evidenceGroups.entries()) {
    const expected = [
      "id", "description", "automated", "implementation", "requirementIds",
      "method", "inputs", "inputInventory", "expectedOutcome", "durableEvidence", "executionReferences",
    ];
    if (evidence.automated) expected.push("command");
    exactMembers(evidence, expected, `evidence group ${index}`);
    requireString(evidence.id, `evidence group ${index} id`, EVIDENCE_PATTERN);
    requireString(evidence.description, `evidence group ${index} description`);
    assert.equal(typeof evidence.automated, "boolean");
    validateImplementationIdentity(evidence.implementation, `${evidence.id} implementation`);
    assert.deepEqual(evidence.implementation, implementationIdentity);
    assert.ok(Array.isArray(evidence.requirementIds) && evidence.requirementIds.length > 0);
    assertUniqueOrdered(evidence.requirementIds, `${evidence.id} requirement identifiers`);
    evidence.requirementIds.forEach((id) => requireString(id, `${evidence.id} requirement`, REQUIREMENT_PATTERN));
    requireString(evidence.method, `${evidence.id} method`);
    assert.ok(Array.isArray(evidence.inputs) && evidence.inputs.length > 0);
    evidence.inputs.forEach((input) => requireString(input, `${evidence.id} input`));
    assertUniqueOrdered(evidence.inputs, `${evidence.id} inputs`);
    assert.ok(Array.isArray(evidence.inputInventory) && evidence.inputInventory.length > 0);
    evidence.inputInventory.forEach((record, inventoryIndex) => {
      validateCurrentInput(record, `${evidence.id} input inventory ${inventoryIndex}`);
    });
    assertUniqueOrdered(
      evidence.inputInventory.map(({ path }) => path),
      `${evidence.id} input inventory paths`,
    );
    assert.deepEqual(
      evidence.inputInventory.map(({ path }) => path),
      evidence.inputs,
      `${evidence.id} must commit every declared input`,
    );
    requireString(evidence.expectedOutcome, `${evidence.id} expected outcome`);
    requireString(evidence.durableEvidence, `${evidence.id} durable evidence`);
    assert.ok(Array.isArray(evidence.executionReferences) && evidence.executionReferences.length > 0);
    evidence.executionReferences.forEach((reference) => {
      requireString(reference, `${evidence.id} execution reference`);
    });
    assertUniqueOrdered(evidence.executionReferences, `${evidence.id} execution references`);
    if (evidence.automated) {
      requireString(evidence.command, `evidence group ${index} command`);
      automatedEvidence.add(evidence.id);
    }
    evidenceIds.push(evidence.id);
  }
  assertUniqueOrdered(evidenceIds, "evidence group identifiers");
  const inventoryByPath = new Map();
  for (const record of [
    ...manifest.implementation.sourceInventory,
    ...manifest.evidenceGroups.flatMap(({ inputInventory }) => inputInventory),
  ]) {
    const existing = inventoryByPath.get(record.path);
    if (existing) {
      assert.deepEqual(record, existing, `${record.path} has inconsistent committed input identities`);
    } else {
      inventoryByPath.set(record.path, record);
    }
  }
  const profileGroupUnion = [...new Set([
    ...manifest.conformanceProfiles.commonEvidenceGroups,
    ...manifest.conformanceProfiles.profiles.flatMap(({ evidenceGroups }) => evidenceGroups),
  ])].sort();
  assert.deepEqual(profileGroupUnion, evidenceIds, "profile applicability must cover every evidence group exactly");
  const evidenceSet = new Set(evidenceIds);

  assert.ok(Array.isArray(manifest.requirements) && manifest.requirements.length > 0);
  const requirementIds = [];
  for (const [index, requirement] of manifest.requirements.entries()) {
    const optional = [];
    if (Object.hasOwn(requirement, "incorporatedFrom")) optional.push("incorporatedFrom");
    exactMembers(
      requirement,
      [
        "id",
        "title",
        "statement",
        "sourceDocument",
        "sourceAnchor",
        "verification",
        "verificationMethods",
        "verificationCriteria",
        "evidenceGroups",
        "executionReferences",
        "coverageSelectors",
        ...optional,
      ],
      `requirement ${index}`,
    );
    requireString(requirement.id, `requirement ${index} id`, REQUIREMENT_PATTERN);
    requireString(requirement.title, `${requirement.id} title`);
    requireString(requirement.statement, `${requirement.id} statement`);
    assert.doesNotMatch(
      requirement.statement,
      /^[>|][+-]?$/u,
      `${requirement.id} statement cannot be an unresolved YAML scalar marker`,
    );
    requireString(requirement.sourceDocument, `${requirement.id} source document`);
    const sourceDocuments = requirement.incorporatedFrom
      ? incorporatedDocuments.get(requirement.incorporatedFrom)
      : new Set(documentPaths);
    assert.ok(sourceDocuments?.has(requirement.sourceDocument), `${requirement.id} has an unknown source document`);
    requireString(requirement.sourceAnchor, `${requirement.id} source anchor`);
    assert.ok(["automated", "review", "external"].includes(requirement.verification));
    assert.ok(Array.isArray(requirement.verificationMethods) && requirement.verificationMethods.length > 0);
    requirement.verificationMethods.forEach((method) => requireString(method, `${requirement.id} method`));
    assertUniqueOrdered(requirement.verificationMethods, `${requirement.id} verification methods`);
    assert.ok(Array.isArray(requirement.verificationCriteria) && requirement.verificationCriteria.length > 0);
    requirement.verificationCriteria.forEach((criterion) => {
      requireString(criterion, `${requirement.id} verification criterion`);
    });
    assertUniqueOrdered(requirement.verificationCriteria, `${requirement.id} verification criteria`);
    assert.ok(Array.isArray(requirement.evidenceGroups) && requirement.evidenceGroups.length > 0);
    assertUniqueOrdered(requirement.evidenceGroups, `${requirement.id} evidence groups`);
    for (const group of requirement.evidenceGroups) {
      assert.ok(evidenceSet.has(group), `${requirement.id} cites unknown evidence ${group}`);
    }
    assert.ok(Array.isArray(requirement.executionReferences));
    requirement.executionReferences.forEach((reference) => {
      requireString(reference, `${requirement.id} execution reference`);
    });
    assertUniqueOrdered(requirement.executionReferences, `${requirement.id} execution references`);
    assert.ok(Array.isArray(requirement.coverageSelectors));
    requirement.coverageSelectors.forEach((selector, selectorIndex) => {
      exactMembers(
        selector,
        ["executionReference", "source", "selector"],
        `${requirement.id} coverage selector ${selectorIndex}`,
      );
      requireString(selector.executionReference, `${requirement.id} selector execution`);
      assert.ok(
        requirement.executionReferences.includes(selector.executionReference),
        `${requirement.id} selector cites an undeclared execution`,
      );
      requireString(selector.source, `${requirement.id} selector source`);
      assert.ok(
        manifest.evidenceGroups
          .filter(({ id }) => requirement.evidenceGroups.includes(id))
          .some(({ inputs }) => inputs.includes(selector.source)),
        `${requirement.id} selector source is not a committed group input`,
      );
      requireString(selector.selector, `${requirement.id} selector`);
    });
    if (requirement.verification === "automated") {
      assert.ok(requirement.evidenceGroups.length > 0, `${requirement.id} lacks automated evidence`);
      assert.ok(
        requirement.evidenceGroups.some((group) => automatedEvidence.has(group)),
        `${requirement.id} lacks an executable evidence group`,
      );
      assert.ok(requirement.executionReferences.length > 0, `${requirement.id} lacks attributable execution`);
      if (INCORPORATED_WRAPPERS.has(requirement.id)) {
        assert.equal(requirement.coverageSelectors.length, 0, `${requirement.id} must be an incorporated-range conjunction`);
      } else {
        assert.ok(requirement.coverageSelectors.length > 0, `${requirement.id} lacks criterion-level selectors`);
      }
    } else {
      assert.equal(
        requirement.executionReferences.length,
        0,
        `${requirement.id} review evidence must be supplied by a retained attestation`,
      );
      assert.equal(requirement.coverageSelectors.length, 0, `${requirement.id} review uses retained evidence`);
    }
    if (Object.hasOwn(requirement, "incorporatedFrom")) {
      assert.ok(["CCA-RF-1.0", "CCA-MIP-1.0"].includes(requirement.incorporatedFrom));
      assert.equal(
        requirement.id.startsWith(requirement.incorporatedFrom === "CCA-RF-1.0" ? "CCA-RF-" : "CCA-MIP-"),
        true,
        `${requirement.id} does not belong to ${requirement.incorporatedFrom}`,
      );
    } else {
      assert.equal(requirement.id.startsWith("CCA-MOS-"), true, `${requirement.id} lacks incorporation metadata`);
    }
    requirementIds.push(requirement.id);
  }
  assertUniqueOrdered(requirementIds, "requirement identifiers");

  const expectedRf = Array.from({ length: 40 }, (_, index) => `CCA-RF-${String(index + 1).padStart(3, "0")}`);
  const expectedMip = Array.from({ length: 64 }, (_, index) => `CCA-MIP-${String(index + 1).padStart(3, "0")}`);
  const expectedMos = DIRECT_REQUIREMENT_RANGES.flatMap(([area, count]) => (
    Array.from(
      { length: count },
      (_, index) => `CCA-MOS-${area}-${String(index + 1).padStart(3, "0")}`,
    )
  ));
  assert.deepEqual(requirementIds.filter((id) => id.startsWith("CCA-MOS-")), expectedMos);
  assert.deepEqual(requirementIds.filter((id) => id.startsWith("CCA-RF-")), expectedRf);
  assert.deepEqual(requirementIds.filter((id) => id.startsWith("CCA-MIP-")), expectedMip);
  for (const evidence of manifest.evidenceGroups) {
    assert.deepEqual(
      evidence.requirementIds,
      manifest.requirements
        .filter(({ evidenceGroups }) => evidenceGroups.includes(evidence.id))
        .map(({ id }) => id),
      `${evidence.id} must cite exactly the requirements that cite it`,
    );
    assert.deepEqual(
      evidence.executionReferences,
      [...new Set(manifest.requirements
        .filter(({ evidenceGroups }) => evidenceGroups.includes(evidence.id))
        .flatMap(({ executionReferences }) => executionReferences))].sort(),
      `${evidence.id} must cite exactly the executions attributable to its requirements`,
    );
  }
  assert.equal(
    manifest.normativeRegistryDigest,
    normativeRegistryDigest(manifest),
    "normative registry digest differs from the exact registry projection",
  );
  return manifest;
}

function normativeRequirementProjection(requirement) {
  const projection = {
    id: requirement.id,
    title: requirement.title,
    statement: requirement.statement,
    sourceDocument: requirement.sourceDocument,
    sourceAnchor: requirement.sourceAnchor,
    verification: requirement.verification,
    verificationMethods: requirement.verificationMethods,
    verificationCriteria: requirement.verificationCriteria,
    evidenceGroups: requirement.evidenceGroups,
  };
  if (Object.hasOwn(requirement, "incorporatedFrom")) {
    projection.incorporatedFrom = requirement.incorporatedFrom;
  }
  return projection;
}

export function normativeRegistryDigest(manifest) {
  const projection = {
    conformanceProfiles: manifest.conformanceProfiles,
    evidenceGroups: manifest.evidenceGroups.map(({ id, requirementIds }) => ({ id, requirementIds })),
    requirements: manifest.requirements.map(normativeRequirementProjection),
  };
  return sha256(Buffer.from(canonicalJson(projection), "utf8"));
}

export function validateAssessmentManifest(manifest, normativeManifest) {
  validateManifest(manifest);
  validateManifest(normativeManifest);
  assert.equal(
    manifest.normativeRegistryDigest,
    normativeManifest.normativeRegistryDigest,
    "assessment manifest changes the normative registry digest",
  );
  assert.deepEqual(manifest.standard, normativeManifest.standard, "assessment manifest changes the Standard publication");
  assert.deepEqual(
    manifest.incorporatedStandards,
    normativeManifest.incorporatedStandards,
    "assessment manifest changes an incorporated publication",
  );
  assert.deepEqual(
    manifest.conformanceProfiles,
    normativeManifest.conformanceProfiles,
    "assessment manifest changes normative profile applicability",
  );
  assert.deepEqual(
    manifest.requirements.map(normativeRequirementProjection),
    normativeManifest.requirements.map(normativeRequirementProjection),
    "assessment manifest changes the normative requirement registry",
  );
  assert.deepEqual(
    manifest.evidenceGroups.map(({ id, requirementIds }) => ({ id, requirementIds })),
    normativeManifest.evidenceGroups.map(({ id, requirementIds }) => ({ id, requirementIds })),
    "assessment manifest changes normative evidence-group coverage",
  );
  return manifest;
}

export function validateEvidence(evidence, manifest, implementation = null) {
  assert.ok(Array.isArray(evidence), "report evidence must be an array");
  const expectedGroups = manifest.evidenceGroups.map(({ id }) => id);
  assert.deepEqual(evidence.map(({ group }) => group), expectedGroups);
  for (const [index, item] of evidence.entries()) {
    const manifestGroup = manifest.evidenceGroups[index];
    const expected = [
      "group", "status", "implementation", "requirementIds", "method", "inputs", "inputInventory",
      "expectedOutcome", "observedOutcome", "durableEvidence", "executionReferences",
    ];
    if (item.status !== "PASS") expected.push("reason");
    exactMembers(item, expected, `evidence result ${index}`);
    assert.ok(REPORT_STATUSES.includes(item.status));
    if (item.status !== "PASS") requireString(item.reason, `${item.group} reason`);
    assert.deepEqual(item.implementation, manifestGroup.implementation);
    if (implementation !== null) assert.deepEqual(item.implementation, implementation);
    assert.deepEqual(item.requirementIds, manifestGroup.requirementIds);
    assert.equal(item.method, manifestGroup.method);
    assert.deepEqual(item.inputs, manifestGroup.inputs);
    assert.deepEqual(item.inputInventory, manifestGroup.inputInventory);
    assert.equal(item.expectedOutcome, manifestGroup.expectedOutcome);
    assert.equal(item.durableEvidence, manifestGroup.durableEvidence);
    if (item.status === "NOT APPLICABLE") {
      assert.deepEqual(item.executionReferences, [], `${item.group} must not fabricate out-of-scope execution evidence`);
    } else {
      assert.deepEqual(item.executionReferences, manifestGroup.executionReferences);
    }
    requireString(item.observedOutcome, `${item.group} observed outcome`);
    assert.ok(Array.isArray(item.executionReferences));
    if (item.status !== "NOT APPLICABLE") assert.ok(item.executionReferences.length > 0);
    item.executionReferences.forEach((value) => requireString(value, `${item.group} execution reference`));
    assertUniqueOrdered(item.executionReferences, `${item.group} execution references`);
  }
}

export function executedGroupEvidence(manifest, executions) {
  validateManifest(manifest);
  const executionById = new Map(executions.map((execution) => [execution.id, execution]));
  return manifest.evidenceGroups.map((group) => {
    const executionReferences = group.executionReferences;
    const referenced = executionReferences.map((identifier) => executionById.get(identifier));
    assert.equal(referenced.every(Boolean), true, `${group.id} references an execution that did not run`);
    const status = referenced.every(({ status: value }) => value === "PASS") ? "PASS" : "FAIL";
    const record = {
      group: group.id,
      status,
      implementation: group.implementation,
      requirementIds: group.requirementIds,
      method: group.method,
      inputs: group.inputs,
      inputInventory: group.inputInventory,
      expectedOutcome: group.expectedOutcome,
      observedOutcome: status === "PASS"
        ? "Every referenced deterministic execution completed successfully with every expected check present and passing."
        : `Nonconforming executions: ${referenced.filter(({ status: value }) => value !== "PASS").map(({ id }) => id).join(", ")}.`,
      durableEvidence: group.durableEvidence,
      executionReferences,
    };
    if (status === "FAIL") record.reason = "One or more authoritative target executions did not conform.";
    return record;
  });
}

export function reconcileGroupEvidence(groupEvidence, requirementEvidence) {
  const reconciled = structuredClone(groupEvidence);
  for (const group of reconciled) {
    const rows = requirementEvidence.filter(({ evidenceGroups }) => evidenceGroups.includes(group.group));
    assert.ok(rows.length > 0, `${group.group} has no requirement evidence to aggregate`);
    const status = rows.every(({ status: value }) => value === "NOT APPLICABLE")
      ? "NOT APPLICABLE"
      : rows.some(({ status: value }) => value === "FAIL") ? "FAIL" : "PASS";
    if (status === group.status) continue;
    group.status = status;
    if (status === "FAIL") {
      const failures = rows.filter(({ status: value }) => value === "FAIL").map(({ requirementId }) => requirementId);
      group.observedOutcome = `Requirement-level evidence failed: ${failures.join(", ")}.`;
      group.reason = "One or more criterion-specific requirement outcomes did not conform.";
    } else if (status === "NOT APPLICABLE") {
      group.executionReferences = [];
      group.observedOutcome = "The evidence group is outside the explicitly assessed profile.";
      group.reason = "The evidence group is outside the explicitly assessed profile.";
    } else {
      delete group.reason;
      group.observedOutcome = "Every criterion-specific requirement outcome passed.";
    }
  }
  return reconciled;
}

export function requirementEvidenceInputs(requirement, manifest) {
  const publication = requirement.incorporatedFrom ?? manifest.standard.identifier;
  const source = `${publication}/${requirement.sourceDocument}`;
  const groupInputs = manifest.evidenceGroups
    .filter(({ id }) => requirement.evidenceGroups.includes(id))
    .flatMap(({ inputs }) => inputs);
  return [...new Set([source, ...groupInputs])].sort();
}

export function validateReviewAttestations(attestations, manifest, implementation) {
  assert.ok(Array.isArray(attestations), "review attestations must be an array");
  const reviewRequirements = manifest.requirements.filter(
    ({ verification }) => verification !== "automated",
  );
  assert.deepEqual(
    attestations.map(({ requirementId }) => requirementId),
    reviewRequirements.map(({ id }) => id),
    "review attestations must cover every review or external requirement exactly once",
  );
  for (const [index, attestation] of attestations.entries()) {
    const requirement = reviewRequirements[index];
    const expectedMembers = [
      "requirementId", "implementation", "artifacts", "criterion", "observedOutcome",
      "reviewer", "date", "reviewRecordId", "implementationRevisionDigest", "result", "durableEvidence",
    ];
    if (attestation.result === "FAIL") expectedMembers.push("reason");
    exactMembers(
      attestation,
      expectedMembers,
      `review attestation ${index}`,
    );
    assert.equal(attestation.requirementId, requirement.id);
    assert.deepEqual(attestation.implementation, implementation);
    assert.deepEqual(attestation.artifacts, requirementEvidenceInputs(requirement, manifest));
    assert.equal(attestation.criterion, requirement.statement);
    requireString(attestation.observedOutcome, `${requirement.id} review observed outcome`);
    requireString(attestation.reviewer, `${requirement.id} reviewer`);
    requireString(attestation.date, `${requirement.id} review date`, /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u);
    requireString(attestation.reviewRecordId, `${requirement.id} review record identifier`);
    requireString(
      attestation.implementationRevisionDigest,
      `${requirement.id} reviewed implementation revision digest`,
      SHA256_PATTERN,
    );
    assert.equal(
      attestation.implementationRevisionDigest,
      implementation.revision,
      `${requirement.id} review must bind the exact assessed implementation revision`,
    );
    assert.ok(["PASS", "FAIL"].includes(attestation.result));
    if (attestation.result === "FAIL") requireString(attestation.reason, `${requirement.id} review reason`);
    assert.equal(
      attestation.durableEvidence,
      `evidence/reference-implementation-review-1.2.1.json#/attestations/${index}`,
    );
  }
  return attestations;
}

export function validateReviewArtifact(artifact, manifest) {
  exactMembers(
    artifact,
    [
      "schemaVersion", "implementation", "implementationRevisionDigest", "reviewRecordId",
      "reviewer", "assessmentDate", "attestations",
    ],
    "review artifact",
  );
  assert.equal(artifact.schemaVersion, "1.0");
  validateImplementationIdentity(artifact.implementation, "review implementation");
  requireString(
    artifact.implementationRevisionDigest,
    "reviewed implementation revision digest",
    SHA256_PATTERN,
  );
  assert.equal(
    artifact.implementationRevisionDigest,
    artifact.implementation.revision,
    "review artifact must bind the exact assessed implementation revision",
  );
  requireString(artifact.reviewRecordId, "review record identifier");
  requireString(artifact.reviewer, "review artifact reviewer");
  requireDateOnOrAfter(
    artifact.assessmentDate,
    manifest.standard.publicationDate,
    "review artifact date",
  );
  validateReviewAttestations(artifact.attestations, manifest, artifact.implementation);
  for (const attestation of artifact.attestations) {
    assert.equal(attestation.reviewer, artifact.reviewer);
    assert.equal(attestation.date, artifact.assessmentDate);
    assert.equal(attestation.reviewRecordId, artifact.reviewRecordId);
    assert.equal(attestation.implementationRevisionDigest, artifact.implementationRevisionDigest);
  }
  return artifact;
}

export function buildRequirementEvidence(
  manifest,
  groupEvidence,
  attestations,
  executions,
  evidenceRoot = REFERENCE_EVIDENCE_URI,
) {
  requireString(evidenceRoot, "requirement evidence root");
  const groupById = new Map(groupEvidence.map((record) => [record.group, record]));
  const reviewById = new Map(attestations.map((record) => [record.requirementId, record]));
  const executionById = new Map(executions.map((record, index) => [record.id, { ...record, index }]));
  const records = manifest.requirements.map((requirement, index) => {
    const groups = requirement.evidenceGroups.map((id) => groupById.get(id));
    assert.equal(groups.every(Boolean), true, `${requirement.id} lacks group evidence`);
    const outOfScope = groups.every(({ status }) => status === "NOT APPLICABLE");
    const review = requirement.verification === "automated" || outOfScope
      ? null
      : reviewById.get(requirement.id);
    if (requirement.verification !== "automated" && !outOfScope) {
      assert.ok(review, `${requirement.id} lacks retained review evidence`);
    }
    const referencedExecutions = outOfScope ? [] : requirement.executionReferences.map((identifier) => {
      const execution = executionById.get(identifier);
      assert.ok(execution, `${requirement.id} cites execution '${identifier}' that did not run`);
      return execution;
    });
    const selectorOutcomes = outOfScope ? [] : requirement.coverageSelectors.map((selector) => {
      const execution = executionById.get(selector.executionReference);
      const matches = execution?.checks?.filter(({ source, selector: observed }) => (
        source === selector.source && observed === selector.selector
      )) ?? [];
      return {
        ...selector,
        matches: matches.length,
        status: matches.length === 1 ? matches[0].status : "MISSING_OR_DUPLICATE",
      };
    });
    const selectorFailure = selectorOutcomes.some(({ matches, status: value }) => (
      matches !== 1 || value !== "PASS"
    ));
    const status = outOfScope
      ? "NOT APPLICABLE"
      : referencedExecutions.some(({ status: value, exitCode }) => value !== "PASS" || exitCode !== 0)
      || selectorFailure
      || review?.result === "FAIL"
      ? "FAIL"
      : "PASS";
    const record = {
      requirementId: requirement.id,
      status,
      verification: requirement.verification,
      verificationMethods: requirement.verificationMethods,
      verificationCriteria: requirement.verificationCriteria,
      evidenceGroups: requirement.evidenceGroups,
      executionReferences: requirement.executionReferences,
      coverageSelectors: requirement.coverageSelectors,
      inputs: requirementEvidenceInputs(requirement, manifest),
      expectedOutcome: requirement.statement,
      evidenceReferences: outOfScope
        ? []
        : review
        ? [review.durableEvidence]
        : referencedExecutions.map(({ index: executionIndex }) => (
          `${evidenceRoot}#/executions/${executionIndex}`
        )),
      durableEvidence: `${evidenceRoot}#/requirementEvidence/${index}`,
    };
    if (!outOfScope) {
      record.observedOutcome = review?.observedOutcome
        ?? (selectorFailure
          ? `Criterion-level selector resolution failed: ${selectorOutcomes.map(({ selector, status: value, matches }) => `${selector}=${value}/${matches}`).join(", ")}.`
          : referencedExecutions.some(({ status: value, exitCode }) => value !== "PASS" || exitCode !== 0)
          ? `Referenced executions did not conform: ${referencedExecutions.filter(({ status: value, exitCode }) => value !== "PASS" || exitCode !== 0).map(({ id, diagnostics }) => `${id} (${diagnostics.join("; ")})`).join(", ")}.`
          : `Every declared criterion-level selector resolved exactly once to a passing check: ${selectorOutcomes.map(({ selector }) => selector).join(", ")}.`);
    }
    if (status === "FAIL") record.reason = review?.reason ?? "Attributable conformance evidence failed.";
    if (status === "NOT APPLICABLE") record.reason = "The requirement is outside the explicitly assessed profile.";
    return record;
  });
  const byId = new Map(records.map((record) => [record.requirementId, record]));
  for (const [wrapperId, prefix] of [
    ["CCA-MOS-MIP-001", "CCA-MIP-"],
    ["CCA-MOS-RT-001", "CCA-RF-"],
  ]) {
    const wrapper = byId.get(wrapperId);
    if (!wrapper) continue;
    const incorporated = records.filter(({ requirementId }) => requirementId.startsWith(prefix));
    const allNotApplicable = incorporated.every(({ status: value }) => value === "NOT APPLICABLE");
    const failing = incorporated.filter(({ status: value }) => value === "FAIL");
    if (allNotApplicable) {
      wrapper.status = "NOT APPLICABLE";
      wrapper.reason = "The requirement is outside the explicitly assessed profile.";
      delete wrapper.observedOutcome;
      wrapper.evidenceReferences = [];
    } else {
      wrapper.evidenceReferences = [...new Set([
        ...wrapper.evidenceReferences,
        ...incorporated.map(({ durableEvidence }) => durableEvidence),
      ])].sort();
    }
    if (!allNotApplicable && (failing.length > 0 || incorporated.some(({ status: value }) => value === "NOT APPLICABLE"))) {
      wrapper.status = "FAIL";
      const failedIds = incorporated
        .filter(({ status: value }) => value !== "PASS")
        .map(({ requirementId }) => requirementId);
      wrapper.reason = `Incorporated requirements did not pass: ${failedIds.join(", ")}.`;
      wrapper.observedOutcome = wrapper.reason;
    }
  }
  return records;
}

export function validateRequirementEvidence(records, manifest, groupEvidence, attestations, executions) {
  assert.ok(Array.isArray(records));
  assert.equal(records.length, manifest.requirements.length);
  const expected = buildRequirementEvidence(manifest, groupEvidence, attestations, executions);
  assert.deepEqual(records, expected, "requirement evidence must be the exact attributable projection");
  return records;
}

export function validateEvidenceArtifact(artifact, manifest) {
  exactMembers(
    artifact,
    [
      "schemaVersion", "implementation", "assessor", "assessmentDate",
      "nativeProjectionProfile", "sourceInventory", "reviewEvidence",
      "executionEnvironment", "nativeBuildAttestation", "reproducibility", "executions", "evidence", "reviews", "requirementEvidence",
    ],
    "evidence artifact",
  );
  assert.equal(artifact.schemaVersion, "1.0");
  validateImplementationIdentity(artifact.implementation, "evidence implementation");
  requireString(artifact.implementation.revision, "evidence implementation revision", SHA256_PATTERN);
  assert.deepEqual(artifact.nativeProjectionProfile, REFERENCE_NATIVE_PROFILE);
  assert.ok(Array.isArray(artifact.sourceInventory) && artifact.sourceInventory.length > 0);
  artifact.sourceInventory.forEach((record, index) => {
    validateCurrentInput(record, `evidence source inventory ${index}`);
  });
  assertUniqueOrdered(artifact.sourceInventory.map(({ path }) => path), "evidence source inventory paths");
  assert.equal(
    sha256(Buffer.from(canonicalJson(artifact.sourceInventory), "utf8")),
    artifact.implementation.revision,
    "implementation revision must commit the exact source inventory",
  );
  exactMembers(
    artifact.reviewEvidence,
    ["path", "sha256", "reviewRecordId", "implementationRevisionDigest"],
    "review evidence binding",
  );
  assert.equal(artifact.reviewEvidence.path, REFERENCE_REVIEW_URI);
  requireString(artifact.reviewEvidence.sha256, "review evidence digest", SHA256_PATTERN);
  requireString(artifact.reviewEvidence.reviewRecordId, "review evidence record identifier");
  requireString(
    artifact.reviewEvidence.implementationRevisionDigest,
    "review evidence implementation revision digest",
    SHA256_PATTERN,
  );
  assert.equal(
    artifact.reviewEvidence.implementationRevisionDigest,
    artifact.implementation.revision,
    "review evidence must bind the exact assessed implementation revision",
  );
  const retainedReview = {
    schemaVersion: "1.0",
    implementation: artifact.implementation,
    implementationRevisionDigest: artifact.reviewEvidence.implementationRevisionDigest,
    reviewRecordId: artifact.reviewEvidence.reviewRecordId,
    reviewer: artifact.assessor,
    assessmentDate: artifact.assessmentDate,
    attestations: artifact.reviews,
  };
  validateReviewArtifact(retainedReview, manifest);
  const retainedReviewSource = `${canonicalJson(retainedReview)}\n`;
  assert.equal(
    artifact.reviewEvidence.sha256,
    sha256(Buffer.from(retainedReviewSource, "utf8")),
    "review evidence digest differs from the retained review bytes",
  );
  const retainedReviewRecordIds = [...new Set(
    retainedReview.attestations.map(({ reviewRecordId }) => reviewRecordId),
  )];
  assert.deepEqual(retainedReviewRecordIds, [artifact.reviewEvidence.reviewRecordId]);
  const retainedImplementationDigests = [...new Set(
    retainedReview.attestations.map(({ implementationRevisionDigest }) => implementationRevisionDigest),
  )];
  assert.deepEqual(retainedImplementationDigests, [artifact.reviewEvidence.implementationRevisionDigest]);
  assert.deepEqual(artifact.reviews, retainedReview.attestations);
  assert.deepEqual(retainedReview.implementation, artifact.implementation);
  assert.equal(retainedReview.reviewer, artifact.assessor);
  assert.equal(retainedReview.assessmentDate, artifact.assessmentDate);
  requireString(artifact.assessor, "evidence assessor");
  requireDateOnOrAfter(
    artifact.assessmentDate,
    manifest.standard.publicationDate,
    "evidence assessment date",
  );
  exactMembers(
    artifact.executionEnvironment,
    ["platform", "architecture", "node", "python", "nativeBuild"],
    "execution environment",
  );
  Object.entries(artifact.executionEnvironment).forEach(([key, value]) => {
    requireString(value, `execution environment ${key}`);
  });
  exactMembers(
    artifact.nativeBuildAttestation,
    [
      "sourceRevision", "buildInputInventory", "buildInputDigest", "tools", "resources", "dependencies",
      "buildDirectory", "configures", "builds", "configurationArtifacts", "targets", "artifacts",
    ],
    "native build attestation",
  );
  assert.equal(artifact.nativeBuildAttestation.sourceRevision, artifact.implementation.revision);
  const expectedBuildInputs = [...new Map(
    [
      ...manifest.implementation.sourceInventory,
      ...["runtime-native", "sdk-cpp"]
        .flatMap((id) => expectedExecutionInputInventory(manifest, id)),
    ]
      .map((record) => [record.path, record]),
  ).values()].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  assert.deepEqual(artifact.nativeBuildAttestation.buildInputInventory, expectedBuildInputs);
  assert.equal(
    artifact.nativeBuildAttestation.buildInputDigest,
    sha256(Buffer.from(canonicalJson(expectedBuildInputs), "utf8")),
  );
  assert.ok(Array.isArray(artifact.nativeBuildAttestation.tools));
  assert.deepEqual(
    artifact.nativeBuildAttestation.tools.map(({ role }) => role),
    ["ar", "cmake", "command-processor", "compiler", "cxx", "ninja", "node", "ranlib"],
  );
  for (const [index, tool] of artifact.nativeBuildAttestation.tools.entries()) {
    exactMembers(tool, ["role", "path", "sha256", "version"], `native build tool ${index}`);
    requireString(tool.path, `${tool.role} tool path`);
    requireString(tool.sha256, `${tool.role} tool digest`, SHA256_PATTERN);
    requireString(tool.version, `${tool.role} tool version`);
  }
  const validateResource = (resource, label) => {
    exactMembers(resource, ["role", "root", "inventory", "sha256"], label);
    requireString(resource.role, `${label} role`);
    requireString(resource.root, `${label} root`);
    assert.ok(Array.isArray(resource.inventory) && resource.inventory.length > 0);
    resource.inventory.forEach((record, recordIndex) => {
      exactMembers(record, ["path", "sha256"], `${label} file ${recordIndex}`);
      requireString(record.path, `${label} file path`);
      requireString(record.sha256, `${label} file digest`, SHA256_PATTERN);
    });
    assertUniqueOrdered(resource.inventory.map(({ path }) => path), `${label} file paths`);
    assert.equal(resource.sha256, sha256(Buffer.from(canonicalJson(resource.inventory), "utf8")));
  };
  assert.ok(Array.isArray(artifact.nativeBuildAttestation.resources));
  assert.deepEqual(
    artifact.nativeBuildAttestation.resources.map(({ role }) => role),
    ["cmake-modules", "zig-library"],
  );
  artifact.nativeBuildAttestation.resources.forEach((resource, index) => (
    validateResource(resource, `native resource ${index}`)
  ));
  assert.ok(Array.isArray(artifact.nativeBuildAttestation.dependencies));
  assert.deepEqual(artifact.nativeBuildAttestation.dependencies.map(({ identifier }) => identifier), ["GTest"]);
  const gtest = artifact.nativeBuildAttestation.dependencies[0];
  exactMembers(gtest, ["identifier", "version", "role", "root", "inventory", "sha256"], "GTest dependency");
  requireString(gtest.version, "GTest version");
  assert.equal(gtest.role, "gtest-installation");
  validateResource(
    { role: gtest.role, root: gtest.root, inventory: gtest.inventory, sha256: gtest.sha256 },
    "GTest resource",
  );
  requireString(artifact.nativeBuildAttestation.buildDirectory, "native build directory");
  for (const collectionName of ["configures", "builds"]) {
    const steps = artifact.nativeBuildAttestation[collectionName];
    assert.ok(Array.isArray(steps));
    assert.deepEqual(steps.map(({ project }) => project), ["runtime", "sdk"]);
    for (const step of steps) {
      exactMembers(step, ["project", "argv", "cwd", "stdoutDigest", "stderrDigest", "exitCode"], `native ${collectionName} step`);
      assert.ok(Array.isArray(step.argv) && step.argv.length > 0);
      step.argv.forEach((argument) => requireString(argument, `native ${collectionName} argv`));
      requireString(step.cwd, `native ${collectionName} cwd`);
      requireString(step.stdoutDigest, `native ${collectionName} stdout digest`, SHA256_PATTERN);
      requireString(step.stderrDigest, `native ${collectionName} stderr digest`, SHA256_PATTERN);
      assert.equal(Number.isInteger(step.exitCode), true, `native ${collectionName} returned no exit code`);
    }
  }
  assert.deepEqual(artifact.nativeBuildAttestation.targets, ["cca_core_tests", "memoryos_sdk_cpp_tests"]);
  assert.ok(Array.isArray(artifact.nativeBuildAttestation.configurationArtifacts));
  const successfulConfigures = new Set(
    artifact.nativeBuildAttestation.configures.filter(({ exitCode }) => exitCode === 0).map(({ project }) => project),
  );
  const expectedConfigurationRoles = [
    ...(successfulConfigures.has("runtime")
      ? ["runtime-build-graph", "runtime-cache", "runtime-compile-commands"] : []),
    ...(successfulConfigures.has("sdk")
      ? ["sdk-build-graph", "sdk-cache", "sdk-compile-commands"] : []),
  ];
  assert.deepEqual(
    artifact.nativeBuildAttestation.configurationArtifacts.map(({ role }) => role),
    expectedConfigurationRoles,
  );
  for (const [index, configured] of artifact.nativeBuildAttestation.configurationArtifacts.entries()) {
    exactMembers(configured, ["role", "path", "sha256"], `native configuration artifact ${index}`);
    requireString(configured.path, `${configured.role} configuration path`);
    requireString(configured.sha256, `${configured.role} configuration digest`, SHA256_PATTERN);
  }
  assert.ok(Array.isArray(artifact.nativeBuildAttestation.artifacts));
  const successfulBuilds = new Set(
    artifact.nativeBuildAttestation.builds.filter(({ exitCode }) => exitCode === 0).map(({ project }) => project),
  );
  const expectedArtifactRoles = [
    ...(successfulConfigures.has("runtime") && successfulBuilds.has("runtime") ? ["runtime-native"] : []),
    ...(successfulConfigures.has("sdk") && successfulBuilds.has("sdk") ? ["sdk-cpp"] : []),
  ];
  assert.deepEqual(artifact.nativeBuildAttestation.artifacts.map(({ role }) => role), expectedArtifactRoles);
  for (const [index, built] of artifact.nativeBuildAttestation.artifacts.entries()) {
    exactMembers(built, ["role", "path", "sha256"], `native build artifact ${index}`);
    requireString(built.path, `${built.role} native build artifact path`);
    requireString(built.sha256, `${built.role} native build artifact digest`, SHA256_PATTERN);
  }
  exactMembers(artifact.reproducibility, ["variantEnvironment", "executions"], "reproducibility evidence");
  assert.deepEqual(artifact.reproducibility.variantEnvironment, {
    FORCE_COLOR: "1",
    LANG: "tr_TR.UTF-8",
    LC_ALL: "tr_TR.UTF-8",
    MEMORYOS_LAYOUT: "conformance-irrelevant-layout",
    MEMORYOS_RENDERER: "conformance-irrelevant-renderer",
    NO_COLOR: null,
    TZ: "Pacific/Kiritimati",
  });
  assert.ok(Array.isArray(artifact.reproducibility.executions));
  assert.ok(Array.isArray(artifact.executions) && artifact.executions.length > 0);
  const executionIds = [];
  for (const [index, execution] of artifact.executions.entries()) {
    exactMembers(
      execution,
      [
        "id", "command", "executablePath", "executableDigest", "argv", "cwd",
        "environment",
        "inputInventory", "inputDigest", "stdoutDigest", "stderrDigest",
        "expectedTests", "allowedSkips", "rawChecks", "tests", "pass", "skipped", "fail",
        "checks", "diagnostics", "status", "exitCode",
      ],
      `execution ${index}`,
    );
    requireString(execution.id, `execution ${index} identifier`);
    assert.equal(execution.command, EXECUTION_COMMANDS[execution.id], `${execution.id} command is not authoritative`);
    requireString(execution.executablePath, `${execution.id} executable path`);
    requireString(execution.executableDigest, `${execution.id} executable digest`, SHA256_PATTERN);
    assert.ok(Array.isArray(execution.argv));
    execution.argv.forEach((argument) => requireString(argument, `${execution.id} argv`));
    requireString(execution.cwd, `${execution.id} cwd`);
    assert.equal(isPlainObject(execution.environment), true, `${execution.id} environment must be an object`);
    Object.entries(execution.environment).forEach(([name, value]) => {
      requireString(name, `${execution.id} environment name`);
      requireString(value, `${execution.id} environment ${name}`);
    });
    assert.ok(Array.isArray(execution.inputInventory) && execution.inputInventory.length > 0);
    execution.inputInventory.forEach((record, inputIndex) => {
      validateCurrentInput(record, `${execution.id} input ${inputIndex}`);
    });
    assertUniqueOrdered(execution.inputInventory.map(({ path }) => path), `${execution.id} input paths`);
    assert.equal(
      execution.inputDigest,
      sha256(Buffer.from(canonicalJson(execution.inputInventory), "utf8")),
      `${execution.id} input digest differs`,
    );
    assert.deepEqual(
      execution.inputInventory,
      expectedExecutionInputInventory(manifest, execution.id),
      `${execution.id} input inventory is not the exact committed execution inventory`,
    );
    requireString(execution.stdoutDigest, `${execution.id} stdout digest`, SHA256_PATTERN);
    requireString(execution.stderrDigest, `${execution.id} stderr digest`, SHA256_PATTERN);
    const expectation = EXECUTION_EXPECTATIONS[execution.id];
    assert.ok(expectation, `${execution.id} has no closed execution expectation`);
    assert.equal(execution.expectedTests, expectation.tests);
    assert.deepEqual(execution.allowedSkips, expectation.skips);
    assert.ok(Array.isArray(execution.rawChecks));
    execution.rawChecks.forEach((check, checkIndex) => {
      exactMembers(check, ["selector", "status"], `${execution.id} raw check ${checkIndex}`);
      requireString(check.selector, `${execution.id} raw selector`);
      assert.ok(["PASS", "SKIP", "FAIL"].includes(check.status));
    });
    assert.deepEqual(
      execution.rawChecks,
      [...execution.rawChecks].sort((left, right) => (
        left.selector < right.selector ? -1 : left.selector > right.selector ? 1 : 0
      )),
      `${execution.id} raw checks must be ordered`,
    );
    for (const member of ["expectedTests", "tests", "pass", "skipped", "fail"]) {
      assert.equal(Number.isInteger(execution[member]) && execution[member] >= 0, true);
    }
    assert.ok(Array.isArray(execution.checks));
    execution.checks.forEach((check, checkIndex) => {
      exactMembers(check, ["source", "selector", "status"], `${execution.id} check ${checkIndex}`);
      requireString(check.source, `${execution.id} check source`);
      requireString(check.selector, `${execution.id} check selector`);
      assert.ok(["PASS", "SKIP", "FAIL"].includes(check.status));
    });
    assert.deepEqual(
      execution.checks,
      [...execution.checks].sort((left, right) => {
        const leftKey = `${left.source}\0${left.selector}`;
        const rightKey = `${right.source}\0${right.selector}`;
        return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
      }),
      `${execution.id} attributed checks must be ordered`,
    );
    assert.ok(Array.isArray(execution.diagnostics));
    execution.diagnostics.forEach((diagnostic) => requireString(diagnostic, `${execution.id} diagnostic`));
    const attribution = [...new Map(
      manifest.requirements
        .flatMap(({ coverageSelectors }) => coverageSelectors)
        .filter(({ executionReference }) => executionReference === execution.id)
        .map(({ source, selector }) => [`${source}\0${selector}`, { source, selector }]),
    ).values()];
    const expectedChecks = attribution.flatMap(({ source, selector }) => (
      execution.rawChecks.filter(({ selector: observed }) => observed === selector)
        .map(({ status }) => ({ source, selector, status }))
    )).sort((left, right) => {
      const leftKey = `${left.source}\0${left.selector}`;
      const rightKey = `${right.source}\0${right.selector}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
    assert.deepEqual(execution.checks, expectedChecks, `${execution.id} check attribution differs`);
    assert.equal(execution.tests, execution.rawChecks.length);
    assert.equal(execution.tests, execution.pass + execution.skipped + execution.fail);
    assert.equal(execution.pass, execution.rawChecks.filter(({ status }) => status === "PASS").length);
    assert.equal(execution.skipped, execution.rawChecks.filter(({ status }) => status === "SKIP").length);
    assert.equal(execution.fail, execution.rawChecks.filter(({ status }) => status === "FAIL").length);
    assert.equal(Number.isInteger(execution.exitCode) && execution.exitCode >= 0, true);
    const duplicates = execution.rawChecks.some((check, rawIndex) => (
      rawIndex > 0 && check.selector === execution.rawChecks[rawIndex - 1].selector
    ));
    const observedSkips = execution.rawChecks
      .filter(({ status }) => status === "SKIP")
      .map(({ selector }) => selector);
    const selectorFailure = attribution.some(({ source, selector }) => {
      const matches = execution.checks.filter((check) => (
        check.source === source && check.selector === selector
      ));
      return matches.length !== 1 || matches[0].status !== "PASS";
    });
    const expectedStatus = execution.tests === expectation.tests
      && !duplicates
      && canonicalJson(observedSkips) === canonicalJson(expectation.skips)
      && execution.fail === 0
      && execution.exitCode === 0
      && !selectorFailure
      ? "PASS"
      : "FAIL";
    assert.equal(execution.status, expectedStatus, `${execution.id} execution status differs`);
    assert.equal(execution.diagnostics.length === 0, expectedStatus === "PASS", `${execution.id} diagnostics differ from status`);
    executionIds.push(execution.id);
  }
  assertUniqueOrdered(executionIds, "execution identifiers");
  const executionSet = new Set(executionIds);
  const primaryExecutions = artifact.executions.filter(({ id }) => id !== "reproducibility-meta");
  const reproducibleProjection = reproducibleExecutionProjection;
  assert.deepEqual(
    artifact.reproducibility.executions.map(({ id }) => id),
    primaryExecutions.map(({ id }) => id),
    "the repeated authoritative execution set is incomplete",
  );
  for (const [index, variant] of artifact.reproducibility.executions.entries()) {
    const primary = primaryExecutions[index];
    const expectedEnvironment = { ...primary.environment, ...artifact.reproducibility.variantEnvironment };
    for (const [name, value] of Object.entries(expectedEnvironment)) {
      if (value === null) delete expectedEnvironment[name];
    }
    assert.deepEqual(variant.environment, canonicalValue(expectedEnvironment));
  }
  const reproducibilityMeta = artifact.executions.find(({ id }) => id === "reproducibility-meta");
  assert.ok(reproducibilityMeta, "reproducibility meta-execution is absent");
  const comparisonDiagnostics = reproducibilityDiagnostics(
    primaryExecutions,
    artifact.reproducibility.executions,
  );
  const comparisonStatus = comparisonDiagnostics.length === 0 ? "PASS" : "FAIL";
  assert.equal(reproducibilityMeta.status, comparisonStatus);
  assert.deepEqual(reproducibilityMeta.diagnostics, comparisonDiagnostics);
  assert.equal(
    reproducibilityMeta.stdoutDigest,
    sha256(Buffer.from(canonicalJson({
      primaryExecutions: primaryExecutions.map(reproducibleProjection),
      variantExecutions: artifact.reproducibility.executions.map(reproducibleProjection),
    }), "utf8")),
    "reproducibility comparison digest differs",
  );
  for (const built of artifact.nativeBuildAttestation.artifacts) {
    const execution = artifact.executions.find(({ id }) => id === built.role);
    assert.ok(execution, `native build artifact ${built.role} has no execution`);
    assert.equal(execution.executablePath, built.path);
    assert.equal(execution.executableDigest, built.sha256);
  }
  validateEvidence(artifact.evidence, manifest);
  validateReviewAttestations(artifact.reviews, manifest, artifact.implementation);
  validateRequirementEvidence(
    artifact.requirementEvidence,
    manifest,
    artifact.evidence,
    artifact.reviews,
    artifact.executions,
  );
  for (const group of artifact.evidence) {
    const rows = artifact.requirementEvidence.filter(({ evidenceGroups }) => (
      evidenceGroups.includes(group.group)
    ));
    const expectedStatus = rows.every(({ status }) => status === "NOT APPLICABLE")
      ? "NOT APPLICABLE"
      : rows.some(({ status }) => status === "FAIL") ? "FAIL" : "PASS";
    assert.equal(group.status, expectedStatus, `${group.group} status differs from its requirement evidence`);
  }
  for (const record of artifact.evidence) {
    assert.deepEqual(record.implementation, artifact.implementation);
    for (const reference of record.executionReferences) {
      assert.ok(executionSet.has(reference), `${record.group} cites unknown execution ${reference}`);
    }
  }
  for (const review of artifact.reviews) {
    assert.equal(review.reviewer, artifact.assessor);
    assert.equal(review.date, artifact.assessmentDate);
  }
  const expectedInventory = manifest.implementation.sourceInventory;
  assert.deepEqual(artifact.sourceInventory, expectedInventory);
  return artifact;
}

export function validateEvidenceArtifactCurrent(artifact, manifest) {
  validateEvidenceArtifact(artifact, manifest);
  validateManifestInputsCurrent(manifest);
  const retainedReviewSource = readFileSync(REFERENCE_REVIEW_PATH, "utf8");
  const retainedReview = JSON.parse(retainedReviewSource);
  assert.equal(
    retainedReviewSource,
    `${canonicalJson(retainedReview)}\n`,
    "retained review evidence must use exact canonical JSON bytes",
  );
  validateReviewArtifact(retainedReview, manifest);
  assert.equal(sha256(Buffer.from(retainedReviewSource, "utf8")), artifact.reviewEvidence.sha256);
  assert.deepEqual(retainedReview.attestations, artifact.reviews);
  for (const record of artifact.sourceInventory) {
    assert.deepEqual(
      currentInputRecord(record),
      record,
      `${record.path} differs from the assessed implementation bytes`,
    );
  }
  for (const execution of artifact.executions) {
    validateExecutionInvocation(execution, artifact.nativeBuildAttestation);
    assert.equal(statSync(execution.executablePath).isFile(), true, `${execution.id} executable is not a file`);
    assert.equal(
      sha256(readFileSync(execution.executablePath)),
      execution.executableDigest,
      `${execution.id} executable bytes changed`,
    );
  }
  const attestation = artifact.nativeBuildAttestation;
  for (const tool of attestation.tools) {
    assert.equal(statSync(tool.path).isFile(), true, `${tool.role} attested tool is not a file`);
    assert.equal(sha256(readFileSync(tool.path)), tool.sha256, `${tool.role} attested tool bytes changed`);
  }
  const toolByRole = new Map(attestation.tools.map((tool) => [tool.role, tool]));
  for (const resource of [...attestation.resources, ...attestation.dependencies]) {
    assert.equal(statSync(resource.root).isDirectory(), true, `${resource.role} root is not a directory`);
    const currentInventory = filesBelowSync(resource.root).map((path) => ({
      path,
      sha256: sha256(readFileSync(resolve(resource.root, path))),
    }));
    assert.deepEqual(currentInventory, resource.inventory, `${resource.role} resource inventory changed`);
    assert.equal(
      sha256(Buffer.from(canonicalJson(currentInventory), "utf8")),
      resource.sha256,
      `${resource.role} resource bytes changed`,
    );
  }
  const gtest = attestation.dependencies[0];
  const configureArguments = (source, output) => [
    "-S", resolve(source),
    "-B", resolve(output),
    "-G", "Ninja",
    `-DCMAKE_MAKE_PROGRAM=${toolByRole.get("ninja").path}`,
    `-DCMAKE_CXX_COMPILER=${toolByRole.get("cxx").path}`,
    `-DCMAKE_AR=${toolByRole.get("ar").path}`,
    `-DCMAKE_RANLIB=${toolByRole.get("ranlib").path}`,
    "-DCMAKE_BUILD_TYPE=Debug",
    "-DBUILD_TESTING=ON",
    "-DCCA_BUILD_TESTS=ON",
    "-DCCA_WARNINGS_AS_ERRORS=ON",
    "-DCMAKE_CXX_STANDARD=23",
    "-DCMAKE_CXX_STANDARD_REQUIRED=ON",
    "-DCMAKE_CXX_EXTENSIONS=OFF",
    "-DCMAKE_EXPORT_COMPILE_COMMANDS=ON",
    `-DGTest_DIR=${resolve(gtest.root, "lib/cmake/GTest")}`,
    `-DMEMORYOS_NODE_EXECUTABLE=${toolByRole.get("node").path}`,
    `-DMEMORYOS_CLI_NODE_EXECUTABLE=${toolByRole.get("node").path}`,
    `-DMEMORYOS_CONFORMANCE_NODE_EXECUTABLE=${toolByRole.get("node").path}`,
  ];
  const coreBuild = resolve(attestation.buildDirectory, "core");
  const sdkBuild = resolve(attestation.buildDirectory, "sdk");
  for (const step of [...attestation.configures, ...attestation.builds]) {
    assert.equal(resolve(step.cwd), resolve(WORKSPACE_ROOT));
  }
  assert.deepEqual(
    attestation.configures.map(({ argv }) => argv),
    [
      configureArguments(resolve(WORKSPACE_ROOT, "repositories/cca-core"), coreBuild),
      configureArguments(resolve(WORKSPACE_ROOT, "repositories/cca-sdk"), sdkBuild),
    ],
  );
  assert.deepEqual(attestation.builds.map(({ argv }) => argv), [
    ["--build", coreBuild, "--target", "cca_core_tests", "--parallel", "4"],
    ["--build", sdkBuild, "--target", "memoryos_sdk_cpp_tests", "--parallel", "4"],
  ]);
  for (const configured of attestation.configurationArtifacts) {
    assert.equal(statSync(configured.path).isFile(), true, `${configured.role} configuration artifact is not a file`);
    assert.equal(sha256(readFileSync(configured.path)), configured.sha256, `${configured.role} configuration bytes changed`);
  }
  for (const built of attestation.artifacts) {
    assert.equal(statSync(built.path).isFile(), true, `${built.role} attested artifact is not a file`);
    assert.equal(sha256(readFileSync(built.path)), built.sha256, `${built.role} attested artifact bytes changed`);
  }
  return artifact;
}

function canonicalArtifactBytes(value, bytes, label) {
  const sourceBytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, "utf8");
  new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes);
  const canonicalBytes = Buffer.from(`${canonicalJson(value)}\n`, "utf8");
  assert.deepEqual(sourceBytes, canonicalBytes, `${label} must use exact canonical UTF-8 JSON bytes`);
  return sourceBytes;
}

function validatePortableExecutions(executions, manifest = null) {
  assert.ok(Array.isArray(executions) && executions.length > 0, "portable evidence requires executions");
  const identifiers = [];
  for (const [index, execution] of executions.entries()) {
    exactMembers(
      execution,
      [
        "id", "command", "executablePath", "executableDigest", "argv", "cwd", "environment",
        "inputInventory", "inputDigest", "stdoutDigest", "stderrDigest", "expectedTests",
        "allowedSkips", "rawChecks", "tests", "pass", "skipped", "fail", "checks",
        "diagnostics", "status", "exitCode",
      ],
      `portable execution ${index}`,
    );
    requireString(execution.id, `portable execution ${index} identifier`);
    requireString(execution.command, `${execution.id} command`);
    requireString(execution.executablePath, `${execution.id} executable path`);
    requireString(execution.executableDigest, `${execution.id} executable digest`, SHA256_PATTERN);
    assert.ok(Array.isArray(execution.argv));
    execution.argv.forEach((argument) => requireString(argument, `${execution.id} argument`));
    requireString(execution.cwd, `${execution.id} working directory`);
    assert.equal(isPlainObject(execution.environment), true, `${execution.id} environment must be an object`);
    Object.entries(execution.environment).forEach(([name, value]) => {
      requireString(name, `${execution.id} environment name`);
      requireString(value, `${execution.id} environment ${name}`);
    });
    assert.ok(Array.isArray(execution.inputInventory) && execution.inputInventory.length > 0);
    execution.inputInventory.forEach((record, inputIndex) => (
      validateCurrentInput(record, `${execution.id} input ${inputIndex}`)
    ));
    assertUniqueOrdered(execution.inputInventory.map(({ path }) => path), `${execution.id} input paths`);
    assert.equal(
      execution.inputDigest,
      sha256(Buffer.from(canonicalJson(execution.inputInventory), "utf8")),
      `${execution.id} input digest differs`,
    );
    if (manifest !== null) {
      assert.deepEqual(
        execution.inputInventory,
        expectedExecutionInputInventory(manifest, execution.id),
        `${execution.id} inputs differ from the supplied assessment manifest`,
      );
    }
    requireString(execution.stdoutDigest, `${execution.id} stdout digest`, SHA256_PATTERN);
    requireString(execution.stderrDigest, `${execution.id} stderr digest`, SHA256_PATTERN);
    for (const member of ["expectedTests", "tests", "pass", "skipped", "fail"]) {
      assert.equal(Number.isInteger(execution[member]) && execution[member] >= 0, true, `${execution.id} ${member}`);
    }
    assert.ok(Array.isArray(execution.allowedSkips));
    execution.allowedSkips.forEach((selector) => requireString(selector, `${execution.id} allowed skip`));
    assertUniqueOrdered(execution.allowedSkips, `${execution.id} allowed skips`);
    assert.ok(Array.isArray(execution.rawChecks));
    execution.rawChecks.forEach((check, checkIndex) => {
      exactMembers(check, ["selector", "status"], `${execution.id} raw check ${checkIndex}`);
      requireString(check.selector, `${execution.id} raw selector`);
      assert.ok(["PASS", "SKIP", "FAIL"].includes(check.status));
    });
    const orderedRaw = [...execution.rawChecks].sort((left, right) => (
      left.selector < right.selector ? -1 : left.selector > right.selector ? 1 : 0
    ));
    assert.deepEqual(execution.rawChecks, orderedRaw, `${execution.id} raw checks must be ordered`);
    assert.ok(Array.isArray(execution.checks));
    execution.checks.forEach((check, checkIndex) => {
      exactMembers(check, ["source", "selector", "status"], `${execution.id} check ${checkIndex}`);
      requireString(check.source, `${execution.id} check source`);
      requireString(check.selector, `${execution.id} check selector`);
      assert.ok(["PASS", "SKIP", "FAIL"].includes(check.status));
      assert.equal(
        execution.rawChecks.some(({ selector, status }) => selector === check.selector && status === check.status),
        true,
        `${execution.id} attributed check has no matching raw check`,
      );
      if (manifest !== null) {
        const declared = manifest.requirements.some(({ coverageSelectors }) => (
          coverageSelectors.some((selector) => (
            selector.executionReference === execution.id
            && selector.source === check.source
            && selector.selector === check.selector
          ))
        ));
        assert.equal(declared, true, `${execution.id} attributed an undeclared source/selector pair`);
      }
    });
    const checkKeys = execution.checks.map(({ source, selector }) => `${source}\0${selector}`);
    assertUniqueOrdered(checkKeys, `${execution.id} attributed checks`);
    assert.ok(Array.isArray(execution.diagnostics));
    execution.diagnostics.forEach((value) => requireString(value, `${execution.id} diagnostic`));
    assert.equal(execution.tests, execution.rawChecks.length);
    assert.equal(execution.tests, execution.pass + execution.skipped + execution.fail);
    assert.equal(execution.pass, execution.rawChecks.filter(({ status }) => status === "PASS").length);
    assert.equal(execution.skipped, execution.rawChecks.filter(({ status }) => status === "SKIP").length);
    assert.equal(execution.fail, execution.rawChecks.filter(({ status }) => status === "FAIL").length);
    assert.equal(Number.isInteger(execution.exitCode), true);
    const observedSkips = execution.rawChecks
      .filter(({ status }) => status === "SKIP")
      .map(({ selector }) => selector);
    const duplicates = new Set(execution.rawChecks.map(({ selector }) => selector)).size
      !== execution.rawChecks.length;
    const expectedStatus = execution.tests === execution.expectedTests
      && execution.fail === 0
      && execution.exitCode === 0
      && !duplicates
      && canonicalJson(observedSkips) === canonicalJson(execution.allowedSkips)
      ? "PASS"
      : "FAIL";
    assert.equal(execution.status, expectedStatus, `${execution.id} portable execution status differs`);
    assert.equal(execution.diagnostics.length === 0, expectedStatus === "PASS");
    identifiers.push(execution.id);
  }
  assertUniqueOrdered(identifiers, "portable execution identifiers");
  return executions;
}

function validatePortableExecutionEnvironment(environment) {
  assert.equal(isPlainObject(environment), true, "execution environment must be an object");
  assert.ok(Object.keys(environment).length > 0, "execution environment must not be empty");
  for (const [name, value] of Object.entries(environment)) {
    requireString(name, "execution environment name");
    requireString(value, `execution environment ${name}`);
  }
}

function validatePortableResource(resource, label) {
  exactMembers(resource, ["role", "root", "inventory", "sha256"], label);
  requireString(resource.role, `${label} role`);
  requireString(resource.root, `${label} root`);
  assert.ok(Array.isArray(resource.inventory) && resource.inventory.length > 0, `${label} inventory is empty`);
  resource.inventory.forEach((record, index) => {
    exactMembers(record, ["path", "sha256"], `${label} inventory ${index}`);
    requireString(record.path, `${label} inventory path`);
    requireString(record.sha256, `${label} inventory digest`, SHA256_PATTERN);
  });
  assertUniqueOrdered(resource.inventory.map(({ path }) => path), `${label} inventory paths`);
  assert.equal(
    resource.sha256,
    sha256(Buffer.from(canonicalJson(resource.inventory), "utf8")),
    `${label} aggregate digest differs`,
  );
}

function validatePortableNativeBuildAttestation(attestation, artifact, executionById, manifest) {
  exactMembers(
    attestation,
    [
      "sourceRevision", "buildInputInventory", "buildInputDigest", "tools", "resources", "dependencies",
      "buildDirectory", "configures", "builds", "configurationArtifacts", "targets", "artifacts",
    ],
    "portable native build attestation",
  );
  requireString(attestation.sourceRevision, "portable native source revision");
  assert.equal(
    attestation.sourceRevision,
    sha256(Buffer.from(canonicalJson(artifact.sourceInventory), "utf8")),
    "native build source revision differs from the assessed source inventory",
  );
  assert.ok(Array.isArray(attestation.buildInputInventory) && attestation.buildInputInventory.length > 0);
  attestation.buildInputInventory.forEach((record, index) => (
    validateCurrentInput(record, `portable native build input ${index}`)
  ));
  assertUniqueOrdered(
    attestation.buildInputInventory.map(({ path }) => path),
    "portable native build input paths",
  );
  assert.equal(
    attestation.buildInputDigest,
    sha256(Buffer.from(canonicalJson(attestation.buildInputInventory), "utf8")),
    "portable native build input digest differs",
  );
  const attestedToolPaths = new Set(attestation.tools.map(({ path }) => path));
  const failedBuildExecutionRoles = [...executionById.values()]
    .filter((execution) => (
      execution.status === "FAIL"
      && execution.rawChecks.length === 0
      && attestedToolPaths.has(execution.executablePath)
      && attestation.builds.some((step) => (
        canonicalJson(step.argv) === canonicalJson(execution.argv)
        && step.cwd === execution.cwd
        && step.stdoutDigest === execution.stdoutDigest
        && step.stderrDigest === execution.stderrDigest
      ))
    ))
    .map(({ id }) => id);
  const nativeExecutionRoles = [...new Set([
    ...attestation.artifacts.map(({ role }) => role),
    ...failedBuildExecutionRoles,
  ])];
  const expectedBuildInputs = [...new Map([
    ...artifact.sourceInventory,
    ...nativeExecutionRoles.flatMap((role) => expectedExecutionInputInventory(manifest, role)),
  ].map((record) => [record.path, record])).values()]
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  assert.deepEqual(
    attestation.buildInputInventory,
    expectedBuildInputs,
    "portable native build inputs differ from the assessed source and execution inputs",
  );
  assert.ok(Array.isArray(attestation.tools) && attestation.tools.length > 0);
  for (const [index, tool] of attestation.tools.entries()) {
    exactMembers(tool, ["role", "path", "sha256", "version"], `portable native tool ${index}`);
    requireString(tool.role, `portable native tool ${index} role`);
    requireString(tool.path, `${tool.role} path`);
    requireString(tool.sha256, `${tool.role} digest`, SHA256_PATTERN);
    requireString(tool.version, `${tool.role} version`);
  }
  assertUniqueOrdered(attestation.tools.map(({ role }) => role), "portable native tool roles");
  assert.ok(Array.isArray(attestation.resources));
  attestation.resources.forEach((resource, index) => (
    validatePortableResource(resource, `portable native resource ${index}`)
  ));
  assertUniqueOrdered(attestation.resources.map(({ role }) => role), "portable native resource roles");
  assert.ok(Array.isArray(attestation.dependencies));
  for (const [index, dependency] of attestation.dependencies.entries()) {
    exactMembers(
      dependency,
      ["identifier", "version", "role", "root", "inventory", "sha256"],
      `portable native dependency ${index}`,
    );
    requireString(dependency.identifier, `portable native dependency ${index} identifier`);
    requireString(dependency.version, `${dependency.identifier} version`);
    validatePortableResource(
      {
        role: dependency.role,
        root: dependency.root,
        inventory: dependency.inventory,
        sha256: dependency.sha256,
      },
      `portable native dependency ${dependency.identifier}`,
    );
  }
  assertUniqueOrdered(
    attestation.dependencies.map(({ identifier }) => identifier),
    "portable native dependency identifiers",
  );
  requireString(attestation.buildDirectory, "portable native build directory");
  for (const collectionName of ["configures", "builds"]) {
    const steps = attestation[collectionName];
    assert.ok(Array.isArray(steps) && steps.length > 0, `portable native ${collectionName} are absent`);
    for (const [index, step] of steps.entries()) {
      exactMembers(
        step,
        ["project", "argv", "cwd", "stdoutDigest", "stderrDigest", "exitCode"],
        `portable native ${collectionName} ${index}`,
      );
      requireString(step.project, `portable native ${collectionName} ${index} project`);
      assert.ok(Array.isArray(step.argv) && step.argv.length > 0);
      step.argv.forEach((argument) => requireString(argument, `portable native ${collectionName} argument`));
      requireString(step.cwd, `portable native ${collectionName} working directory`);
      requireString(step.stdoutDigest, `portable native ${collectionName} stdout`, SHA256_PATTERN);
      requireString(step.stderrDigest, `portable native ${collectionName} stderr`, SHA256_PATTERN);
      assert.equal(Number.isInteger(step.exitCode), true, `portable native ${collectionName} returned no exit code`);
    }
  }
  for (const [member, label] of [
    ["configurationArtifacts", "portable native configuration artifact"],
    ["artifacts", "portable native artifact"],
  ]) {
    const records = attestation[member];
    assert.ok(Array.isArray(records), `${label}s are absent`);
    records.forEach((record, index) => {
      exactMembers(record, ["role", "path", "sha256"], `${label} ${index}`);
      requireString(record.role, `${label} ${index} role`);
      requireString(record.path, `${label} ${record.role} path`);
      requireString(record.sha256, `${label} ${record.role} digest`, SHA256_PATTERN);
    });
    assertUniqueOrdered(records.map(({ role }) => role), `${label} roles`);
  }
  assert.ok(Array.isArray(attestation.targets) && attestation.targets.length > 0);
  attestation.targets.forEach((target) => requireString(target, "portable native target"));
  assertUniqueOrdered(attestation.targets, "portable native targets");
  for (const built of attestation.artifacts) {
    const execution = executionById.get(built.role);
    assert.ok(execution, `portable native artifact ${built.role} has no execution`);
    assert.equal(execution.executablePath, built.path);
    assert.equal(execution.executableDigest, built.sha256);
  }
  const failedProjects = new Set([
    ...attestation.configures.filter(({ exitCode }) => exitCode !== 0).map(({ project }) => project),
    ...attestation.builds.filter(({ exitCode }) => exitCode !== 0).map(({ project }) => project),
  ]);
  for (const project of failedProjects) {
    const build = attestation.builds.find(({ project: value }) => value === project);
    assert.ok(build, `failed native project ${project} lacks a retained build step`);
    const matching = [...executionById.values()].filter((execution) => (
      execution.status === "FAIL"
      && execution.rawChecks.length === 0
      && attestedToolPaths.has(execution.executablePath)
      && canonicalJson(execution.argv) === canonicalJson(build.argv)
      && execution.cwd === build.cwd
      && execution.stdoutDigest === build.stdoutDigest
      && execution.stderrDigest === build.stderrDigest
    ));
    assert.ok(matching.length > 0, `failed native project ${project} lacks attributable execution evidence`);
  }
}

function validatePortableReproducibility(reproducibility, executions, manifest) {
  exactMembers(reproducibility, ["variantEnvironment", "executions"], "portable reproducibility evidence");
  assert.equal(isPlainObject(reproducibility.variantEnvironment), true);
  assert.ok(Object.keys(reproducibility.variantEnvironment).length > 0, "reproducibility environment is empty");
  for (const [name, value] of Object.entries(reproducibility.variantEnvironment)) {
    requireString(name, "reproducibility environment name");
    assert.ok(value === null || typeof value === "string", `${name} reproducibility value is invalid`);
  }
  validatePortableExecutions(reproducibility.executions, manifest);
  const primary = executions.filter(({ id }) => id !== "reproducibility-meta");
  assert.deepEqual(
    reproducibility.executions.map(({ id }) => id),
    primary.map(({ id }) => id),
    "portable reproducibility execution set differs",
  );
  for (const [index, variant] of reproducibility.executions.entries()) {
    const expectedEnvironment = { ...primary[index].environment, ...reproducibility.variantEnvironment };
    for (const [name, value] of Object.entries(expectedEnvironment)) {
      if (value === null) delete expectedEnvironment[name];
    }
    assert.deepEqual(variant.environment, canonicalValue(expectedEnvironment));
  }
  const meta = executions.find(({ id }) => id === "reproducibility-meta");
  assert.ok(meta, "portable reproducibility meta-execution is absent");
  const comparisonDiagnostics = reproducibilityDiagnostics(primary, reproducibility.executions);
  assert.equal(meta.status, comparisonDiagnostics.length === 0 ? "PASS" : "FAIL");
  assert.deepEqual(meta.diagnostics, comparisonDiagnostics);
  assert.equal(
    meta.stdoutDigest,
    sha256(Buffer.from(canonicalJson({
      primaryExecutions: primary.map(reproducibleExecutionProjection),
      variantExecutions: reproducibility.executions.map(reproducibleExecutionProjection),
    }), "utf8")),
    "portable reproducibility comparison digest differs",
  );
}

export function validatePortableEvidenceArtifact(artifact, manifest, normativeManifest = manifest) {
  validateAssessmentManifest(manifest, normativeManifest);
  const members = [
    "schemaVersion", "implementation", "sourceInventory", "reviewEvidence", "assessor",
    "assessmentDate", "executions", "evidence", "reviews", "requirementEvidence",
  ];
  for (const optional of [
    "nativeProjectionProfile", "executionEnvironment", "nativeBuildAttestation", "reproducibility",
  ]) {
    if (Object.hasOwn(artifact, optional)) members.push(optional);
  }
  exactMembers(artifact, members, "portable evidence artifact");
  assert.equal(artifact.schemaVersion, "1.0");
  validateImplementationIdentity(artifact.implementation, "portable evidence implementation");
  if (Object.hasOwn(artifact, "nativeProjectionProfile")) {
    exactMembers(artifact.nativeProjectionProfile, ["identifier", "version"], "native projection profile");
    requireString(artifact.nativeProjectionProfile.identifier, "native projection profile identifier");
    requireString(artifact.nativeProjectionProfile.version, "native projection profile version", IMPLEMENTATION_VERSION_PATTERN);
  }
  if (Object.hasOwn(artifact, "executionEnvironment")) {
    validatePortableExecutionEnvironment(artifact.executionEnvironment);
  }
  assert.ok(Array.isArray(artifact.sourceInventory) && artifact.sourceInventory.length > 0);
  artifact.sourceInventory.forEach((record, index) => validateCurrentInput(record, `portable source ${index}`));
  assertUniqueOrdered(artifact.sourceInventory.map(({ path }) => path), "portable source paths");
  assert.deepEqual(
    artifact.sourceInventory,
    manifest.implementation.sourceInventory,
    "portable evidence source inventory differs from the supplied assessment manifest",
  );
  const sourceRevisionDigest = sha256(Buffer.from(canonicalJson(artifact.sourceInventory), "utf8"));
  exactMembers(
    artifact.reviewEvidence,
    ["path", "sha256", "reviewRecordId", "implementationRevisionDigest"],
    "portable review evidence binding",
  );
  requireString(artifact.reviewEvidence.path, "portable review evidence path");
  requireString(artifact.reviewEvidence.sha256, "portable review evidence digest", SHA256_PATTERN);
  requireString(artifact.reviewEvidence.reviewRecordId, "portable review record identifier");
  assert.equal(artifact.reviewEvidence.implementationRevisionDigest, sourceRevisionDigest);
  requireString(artifact.assessor, "portable evidence assessor");
  requireDateOnOrAfter(
    artifact.assessmentDate,
    manifest.standard.publicationDate,
    "portable evidence date",
  );
  validatePortableExecutions(artifact.executions, manifest);
  const executionById = new Map(artifact.executions.map((execution, index) => (
    [execution.id, { ...execution, index }]
  )));
  if (Object.hasOwn(artifact, "nativeBuildAttestation")) {
    validatePortableNativeBuildAttestation(
      artifact.nativeBuildAttestation,
      artifact,
      executionById,
      manifest,
    );
  }
  if (Object.hasOwn(artifact, "reproducibility")) {
    validatePortableReproducibility(artifact.reproducibility, artifact.executions, manifest);
  }
  validateEvidence(artifact.evidence, manifest, artifact.implementation);
  assert.ok(Array.isArray(artifact.reviews));
  assert.ok(Array.isArray(artifact.requirementEvidence));
  assert.equal(artifact.requirementEvidence.length, manifest.requirements.length);
  const requirementStatusById = new Map(
    artifact.requirementEvidence.map(({ requirementId, status }) => [requirementId, status]),
  );
  const reviewRequirements = manifest.requirements.filter(({ id, verification }) => (
    verification !== "automated" && requirementStatusById.get(id) !== "NOT APPLICABLE"
  ));
  assert.deepEqual(artifact.reviews.map(({ requirementId }) => requirementId), reviewRequirements.map(({ id }) => id));
  for (const [index, review] of artifact.reviews.entries()) {
    const requirement = reviewRequirements[index];
    const expectedMembers = [
      "requirementId", "implementation", "artifacts", "criterion", "observedOutcome", "reviewer",
      "date", "reviewRecordId", "implementationRevisionDigest", "result", "durableEvidence",
    ];
    if (review.result === "FAIL") expectedMembers.push("reason");
    exactMembers(review, expectedMembers, `portable review ${index}`);
    assert.deepEqual(review.implementation, artifact.implementation);
    assert.deepEqual(review.artifacts, requirementEvidenceInputs(requirement, manifest));
    assert.equal(review.criterion, requirement.statement);
    assert.equal(review.reviewer, artifact.assessor);
    assert.equal(review.date, artifact.assessmentDate);
    assert.equal(review.reviewRecordId, artifact.reviewEvidence.reviewRecordId);
    assert.equal(review.implementationRevisionDigest, sourceRevisionDigest);
    assert.ok(["PASS", "FAIL"].includes(review.result));
    requireString(review.observedOutcome, `${requirement.id} review outcome`);
    requireString(review.durableEvidence, `${requirement.id} review evidence reference`);
    assert.equal(
      review.durableEvidence,
      `${artifact.reviewEvidence.path}#/attestations/${index}`,
      `${requirement.id} review evidence reference does not resolve to the digest-bound review artifact`,
    );
    if (review.result === "FAIL") requireString(review.reason, `${requirement.id} review failure`);
  }
  const embeddedReview = {
    schemaVersion: "1.0",
    implementation: artifact.implementation,
    implementationRevisionDigest: sourceRevisionDigest,
    reviewRecordId: artifact.reviewEvidence.reviewRecordId,
    reviewer: artifact.assessor,
    assessmentDate: artifact.assessmentDate,
    attestations: artifact.reviews,
  };
  assert.equal(
    artifact.reviewEvidence.sha256,
    sha256(Buffer.from(`${canonicalJson(embeddedReview)}\n`, "utf8")),
    "portable review evidence digest differs",
  );
  const reviewById = new Map(artifact.reviews.map((review) => [review.requirementId, review]));
  for (const [index, record] of artifact.requirementEvidence.entries()) {
    const requirement = manifest.requirements[index];
    const expectedMembers = [
      "requirementId", "status", "verification", "verificationMethods", "verificationCriteria",
      "evidenceGroups", "executionReferences", "coverageSelectors", "inputs", "expectedOutcome",
      "evidenceReferences", "durableEvidence",
    ];
    if (record.status !== "NOT APPLICABLE") expectedMembers.push("observedOutcome");
    if (record.status !== "PASS") expectedMembers.push("reason");
    exactMembers(record, expectedMembers, `portable requirement evidence ${index}`);
    assert.equal(record.requirementId, requirement.id);
    assert.ok(REPORT_STATUSES.includes(record.status));
    assert.equal(record.verification, requirement.verification);
    assert.deepEqual(record.verificationMethods, requirement.verificationMethods);
    assert.deepEqual(record.verificationCriteria, requirement.verificationCriteria);
    assert.deepEqual(record.evidenceGroups, requirement.evidenceGroups);
    assert.deepEqual(record.executionReferences, requirement.executionReferences);
    assert.deepEqual(record.coverageSelectors, requirement.coverageSelectors);
    assert.deepEqual(record.inputs, requirementEvidenceInputs(requirement, manifest));
    assert.equal(record.expectedOutcome, requirement.statement);
    if (record.status !== "NOT APPLICABLE") {
      requireString(record.observedOutcome, `${requirement.id} observed outcome`);
      assert.ok(record.evidenceReferences.length > 0, `${requirement.id} has no evidence references`);
    } else {
      assert.deepEqual(record.evidenceReferences, [], `${requirement.id} must not fabricate out-of-scope evidence`);
    }
    requireString(record.durableEvidence, `${requirement.id} durable evidence`);
    assert.match(record.durableEvidence, new RegExp(`#\\/requirementEvidence\\/${index}$`, "u"));
    if (record.status !== "PASS") requireString(record.reason, `${requirement.id} reason`);
    if (
      record.status !== "NOT APPLICABLE"
      && record.verification === "automated"
      && !INCORPORATED_WRAPPERS.has(requirement.id)
    ) {
      assert.ok(record.coverageSelectors.length > 0, `${requirement.id} lacks portable criterion selectors`);
      const selectorFailure = record.coverageSelectors.some((selector) => {
        exactMembers(selector, ["executionReference", "source", "selector"], `${requirement.id} selector`);
        const execution = executionById.get(selector.executionReference);
        const matches = execution?.checks.filter((check) => (
          check.source === selector.source && check.selector === selector.selector
        )) ?? [];
        return matches.length !== 1 || matches[0].status !== "PASS";
      });
      const executionFailure = record.executionReferences.some((reference) => (
        executionById.get(reference)?.status !== "PASS"
      ));
      assert.equal(
        record.status,
        selectorFailure || executionFailure ? "FAIL" : "PASS",
        `${requirement.id} portable automated status differs`,
      );
    }
    if (record.verification !== "automated" && record.status !== "NOT APPLICABLE") {
      const review = reviewById.get(requirement.id);
      assert.ok(review, `${requirement.id} lacks portable review evidence`);
      assert.equal(record.status, review.result);
      assert.deepEqual(record.evidenceReferences, [review.durableEvidence]);
    } else if (record.verification !== "automated") {
      assert.equal(reviewById.has(requirement.id), false, `${requirement.id} is out of scope and must not fabricate review evidence`);
    }
    if (record.status !== "NOT APPLICABLE" && record.verification === "automated") {
      for (const reference of record.executionReferences) {
        const execution = executionById.get(reference);
        assert.ok(execution, `${requirement.id} cites absent execution ${reference}`);
        assert.equal(
          record.evidenceReferences.some((value) => value.endsWith(`#/executions/${execution.index}`)),
          true,
          `${requirement.id} does not resolve execution evidence ${reference}`,
        );
      }
      for (const reference of record.evidenceReferences) {
        const executionMatch = /#\/executions\/([0-9]+)$/u.exec(reference);
        const requirementMatch = /#\/requirementEvidence\/([0-9]+)$/u.exec(reference);
        assert.ok(executionMatch || requirementMatch, `${requirement.id} has an unresolved evidence reference`);
        if (executionMatch) {
          const execution = artifact.executions[Number(executionMatch[1])];
          assert.ok(execution && record.executionReferences.includes(execution.id));
        }
        if (requirementMatch) {
          assert.equal(INCORPORATED_WRAPPERS.has(requirement.id), true);
          const child = manifest.requirements[Number(requirementMatch[1])];
          const prefix = requirement.id === "CCA-MOS-MIP-001" ? "CCA-MIP-" : "CCA-RF-";
          assert.ok(child?.id.startsWith(prefix));
        }
      }
    }
  }
  const requirementById = new Map(artifact.requirementEvidence.map((record) => [record.requirementId, record]));
  for (const [wrapperId, prefix] of [["CCA-MOS-MIP-001", "CCA-MIP-"], ["CCA-MOS-RT-001", "CCA-RF-"]]) {
    const wrapper = requirementById.get(wrapperId);
    const children = artifact.requirementEvidence.filter(({ requirementId }) => requirementId.startsWith(prefix));
    const expected = children.every(({ status }) => status === "NOT APPLICABLE")
      ? "NOT APPLICABLE"
      : children.every(({ status }) => status === "PASS") ? "PASS" : "FAIL";
    assert.equal(wrapper.status, expected);
  }
  for (const group of artifact.evidence) {
    const rows = artifact.requirementEvidence.filter(({ evidenceGroups }) => evidenceGroups.includes(group.group));
    const expected = rows.every(({ status }) => status === "NOT APPLICABLE")
      ? "NOT APPLICABLE"
      : rows.some(({ status }) => status === "FAIL") ? "FAIL" : "PASS";
    assert.equal(group.status, expected, `${group.group} status differs from its requirement evidence`);
    if (group.status !== "NOT APPLICABLE") {
      for (const reference of group.executionReferences) {
        assert.ok(executionById.has(reference), `${group.group} cites absent execution ${reference}`);
      }
    }
  }
  return artifact;
}

export function validateIndependentAssessmentArtifact(
  artifact,
  report,
  evidenceBytes,
  manifest,
  normativeManifest = manifest,
) {
  validateAssessmentManifest(manifest, normativeManifest);
  exactMembers(
    artifact,
    [
      "schemaVersion", "standard", "conformance", "implementation", "scope", "sourceEvidence",
      "sourceAssessment", "assessmentDate", "assessor", "method", "outcome", "requirementResultsDigest",
    ],
    "independent assessment artifact",
  );
  assert.equal(artifact.schemaVersion, "1.0");
  assert.deepEqual(artifact.standard, report.standard);
  assert.deepEqual(artifact.conformance, report.conformance);
  assert.deepEqual(artifact.implementation, report.implementation);
  assert.deepEqual(artifact.scope, report.scope);
  exactMembers(artifact.sourceEvidence, ["path", "sha256"], "independent source evidence");
  assert.equal(artifact.sourceEvidence.path, report.evidenceRoot);
  requireString(artifact.sourceEvidence.sha256, "independent source evidence digest", SHA256_PATTERN);
  assert.equal(artifact.sourceEvidence.sha256, sha256(evidenceBytes));
  assert.equal(artifact.sourceEvidence.sha256, report.evidenceDigest);
  exactMembers(
    artifact.sourceAssessment,
    ["assessmentLevel", "assessor", "assessmentDate"],
    "independent source assessment",
  );
  assert.equal(artifact.sourceAssessment.assessmentLevel, "C2");
  exactMembers(artifact.sourceAssessment.assessor, ["name", "independent"], "source assessor");
  requireString(artifact.sourceAssessment.assessor.name, "source assessor name");
  assert.equal(artifact.sourceAssessment.assessor.independent, false);
  requireDateOnOrAfter(
    artifact.sourceAssessment.assessmentDate,
    report.standard.publicationDate,
    "source assessment date",
  );
  assert.equal(artifact.assessmentDate, report.assessmentDate);
  assert.deepEqual(artifact.assessor, report.assessor);
  assert.equal(artifact.assessor.independent, true);
  assert.notEqual(
    artifact.assessor.name,
    artifact.sourceAssessment.assessor.name,
    "an independent assessor must differ from the source evidence assessor",
  );
  requireDateOnOrAfter(
    artifact.assessmentDate,
    artifact.sourceAssessment.assessmentDate,
    "independent assessment date",
  );
  assert.ok(["reviewed", "reproduced"].includes(artifact.method));
  assert.equal(artifact.outcome, "PASS");
  assert.equal(
    artifact.requirementResultsDigest,
    sha256(Buffer.from(canonicalJson(report.results), "utf8")),
    "independent assessment requirement-result digest differs",
  );
  validateReport(report, manifest);
  const sourceReport = structuredClone(report);
  sourceReport.assessor = structuredClone(artifact.sourceAssessment.assessor);
  sourceReport.assessmentDate = artifact.sourceAssessment.assessmentDate;
  sourceReport.assessmentLevel = "C2";
  delete sourceReport.independentAssessment;
  validateReport(sourceReport, manifest);
  return artifact;
}

export function buildIndependentAssessmentArtifact(
  sourceReport,
  evidenceBytes,
  manifest,
  assessment,
) {
  validateReport(sourceReport, manifest);
  assert.equal(sourceReport.assessmentLevel, "C2", "C3 assessment requires a C2 source report");
  assert.equal(sourceReport.assessor.independent, false, "C3 source evidence must be a non-independent C2 report");
  requireString(assessment?.assessor, "independent assessor");
  assert.notEqual(
    assessment.assessor,
    sourceReport.assessor.name,
    "an independent assessor must differ from the source evidence assessor",
  );
  requireDateOnOrAfter(assessment?.date, sourceReport.assessmentDate, "independent assessment date");
  assert.ok(["reviewed", "reproduced"].includes(assessment?.method));
  const artifact = {
    schemaVersion: "1.0",
    standard: structuredClone(sourceReport.standard),
    conformance: structuredClone(sourceReport.conformance),
    implementation: structuredClone(sourceReport.implementation),
    scope: structuredClone(sourceReport.scope),
    sourceEvidence: {
      path: sourceReport.evidenceRoot,
      sha256: sha256(evidenceBytes),
    },
    sourceAssessment: {
      assessmentLevel: "C2",
      assessor: structuredClone(sourceReport.assessor),
      assessmentDate: sourceReport.assessmentDate,
    },
    assessmentDate: assessment.date,
    assessor: { name: assessment.assessor, independent: true },
    method: assessment.method,
    outcome: "PASS",
    requirementResultsDigest: sha256(Buffer.from(canonicalJson(sourceReport.results), "utf8")),
  };
  return artifact;
}

export function buildIndependentC3Report(
  sourceReport,
  evidenceBytes,
  independentAssessment,
  independentAssessmentBytes,
  independentAssessmentPath,
  manifest,
) {
  validateReport(sourceReport, manifest);
  assert.equal(sourceReport.assessmentLevel, "C2", "C3 assessment requires a C2 source report");
  assert.deepEqual(independentAssessment.sourceAssessment, {
    assessmentLevel: "C2",
    assessor: sourceReport.assessor,
    assessmentDate: sourceReport.assessmentDate,
  });
  const report = structuredClone(sourceReport);
  report.assessor = structuredClone(independentAssessment.assessor);
  report.assessmentDate = independentAssessment.assessmentDate;
  report.assessmentLevel = "C3";
  report.independentAssessment = {
    path: independentAssessmentPath,
    sha256: sha256(independentAssessmentBytes),
  };
  validateIndependentAssessmentArtifact(independentAssessment, report, evidenceBytes, manifest);
  return validateReport(report, manifest);
}

export function validatePortableReportEvidenceBinding(
  report,
  reportBytes,
  evidenceArtifact,
  evidenceBytes,
  manifest,
  independentAssessment = null,
  normativeManifest = manifest,
) {
  canonicalArtifactBytes(report, reportBytes, "conformance report");
  const canonicalEvidence = canonicalArtifactBytes(evidenceArtifact, evidenceBytes, "conformance evidence");
  validatePortableEvidenceArtifact(evidenceArtifact, manifest, normativeManifest);
  validateReport(report, manifest, evidenceArtifact.requirementEvidence);
  assert.equal(
    report.evidenceDigest,
    sha256(canonicalEvidence),
    "report evidence digest differs from the supplied retained evidence bytes",
  );
  assert.deepEqual(report.implementation, evidenceArtifact.implementation);
  assert.deepEqual(report.nativeProjectionProfile, evidenceArtifact.nativeProjectionProfile);
  assert.deepEqual(report.evidence, evidenceArtifact.evidence);
  if (report.assessmentLevel === "C3") {
    assert.ok(independentAssessment, "C3 requires supplied independent assessment evidence");
    const { artifact, bytes, path } = independentAssessment;
    const canonicalIndependentAssessment = canonicalArtifactBytes(
      artifact,
      bytes,
      "independent assessment",
    );
    assert.equal(report.independentAssessment.path, path);
    assert.equal(report.independentAssessment.sha256, sha256(canonicalIndependentAssessment));
    assert.deepEqual(artifact.sourceAssessment.assessor, {
      name: evidenceArtifact.assessor,
      independent: false,
    });
    assert.equal(artifact.sourceAssessment.assessmentDate, evidenceArtifact.assessmentDate);
    validateIndependentAssessmentArtifact(artifact, report, canonicalEvidence, manifest, normativeManifest);
  } else {
    assert.equal(independentAssessment, null, "only C3 may supply independent assessment evidence");
    assert.equal(report.assessor.name, evidenceArtifact.assessor);
    assert.equal(report.assessmentDate, evidenceArtifact.assessmentDate);
  }
  return report;
}

function expectedRequirementStatus(requirement, evidenceByGroup) {
  const statuses = requirement.evidenceGroups.map((group) => evidenceByGroup.get(group));
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("NOT APPLICABLE")) return "NOT APPLICABLE";
  return "PASS";
}

export function validateReport(report, manifest, requirementEvidence = null) {
  const reportMembers = [
    "schemaVersion", "standard", "conformance", "scope", "implementation",
    "incorporatedPublications", "evidenceRoot", "evidenceDigest", "assessor", "assessmentDate",
    "assessmentLevel", "evidence", "results", "knownFailures", "summary",
  ];
  if (Object.hasOwn(report, "nativeProjectionProfile")) reportMembers.push("nativeProjectionProfile");
  if (Object.hasOwn(report, "independentAssessment")) reportMembers.push("independentAssessment");
  exactMembers(
    report,
    reportMembers,
    "conformance report",
  );
  assert.equal(report.schemaVersion, "1.0");
  exactMembers(
    report.standard,
    ["identifier", "version", "publicationDate", "publicationDigest"],
    "report standard",
  );
  assert.deepEqual(report.standard, {
    identifier: manifest.standard.identifier,
    version: manifest.standard.version,
    publicationDate: manifest.standard.publicationDate,
    publicationDigest: manifest.standard.publicationDigest,
  });
  exactMembers(
    report.conformance,
    ["specificationVersion", "suiteIdentifier", "suiteVersion", "manifestDigest"],
    "report conformance identity",
  );
  assert.equal(report.conformance.specificationVersion, "1.0.0");
  assert.equal(report.conformance.suiteIdentifier, "memoryos-conformance");
  assert.equal(report.conformance.suiteVersion, "1.0.0", "conformance suite identifier/version pair differs");
  assert.equal(report.conformance.manifestDigest, manifestDigest(manifest));
  exactMembers(report.scope, ["kind", "profiles"], "report scope");
  assert.ok(["complete", "profile"].includes(report.scope.kind));
  assert.ok(Array.isArray(report.scope.profiles) && report.scope.profiles.length > 0);
  report.scope.profiles.forEach((profile) => {
    assert.ok(COMPLETE_PROFILES.includes(profile), `unknown conformance profile ${profile}`);
  });
  assertUniqueOrdered(report.scope.profiles, "report profiles");
  if (report.scope.kind === "complete") assert.deepEqual(report.scope.profiles, COMPLETE_PROFILES);
  const requiredGroups = applicableGroups(report.scope.profiles, manifest);
  validateImplementationIdentity(report.implementation, "report implementation");
  const nativeProjectionProfiles = new Set([
    "Investigation Core",
    "Native Investigation Artifacts",
    "SDK",
  ]);
  const requiresNativeProjectionProfile = report.scope.kind === "complete"
    || report.scope.profiles.some((profile) => nativeProjectionProfiles.has(profile));
  if (requiresNativeProjectionProfile) {
    assert.equal(
      Object.hasOwn(report, "nativeProjectionProfile"),
      true,
      "the selected scope requires a native projection profile",
    );
  }
  if (Object.hasOwn(report, "nativeProjectionProfile")) {
    exactMembers(report.nativeProjectionProfile, ["identifier", "version"], "native projection profile");
    requireString(report.nativeProjectionProfile.identifier, "native projection profile identifier");
    requireString(
      report.nativeProjectionProfile.version,
      "native projection profile version",
      IMPLEMENTATION_VERSION_PATTERN,
    );
  }
  assert.deepEqual(
    report.incorporatedPublications,
    manifest.incorporatedStandards.map(({ identifier, version, publicationDigest }) => ({
      identifier,
      version,
      publicationDigest,
    })),
  );
  requireString(report.evidenceRoot, "evidence root");
  requireString(report.evidenceDigest, "evidence digest", SHA256_PATTERN);
  exactMembers(report.assessor, ["name", "independent"], "report assessor");
  requireString(report.assessor.name, "assessor name");
  assert.equal(typeof report.assessor.independent, "boolean");
  requireDateOnOrAfter(report.assessmentDate, report.standard.publicationDate, "assessment date");
  assert.ok(["C1", "C2", "C3"].includes(report.assessmentLevel));
  if (report.assessmentLevel === "C3") {
    assert.equal(report.assessor.independent, true, "C3 requires an independent assessor");
    exactMembers(report.independentAssessment, ["path", "sha256"], "independent assessment binding");
    requireString(report.independentAssessment.path, "independent assessment path");
    requireString(report.independentAssessment.sha256, "independent assessment digest", SHA256_PATTERN);
  } else {
    assert.equal(report.assessor.independent, false, "C1 and C2 reports require a non-independent assessor");
    assert.equal(Object.hasOwn(report, "independentAssessment"), false, "only C3 may bind independent assessment evidence");
  }

  validateEvidence(report.evidence, manifest, report.implementation);
  for (const [index, item] of report.evidence.entries()) {
    assert.equal(
      item.durableEvidence,
      `${report.evidenceRoot}#/evidence/${index}`,
      `${item.group} durable evidence does not resolve under the report evidence root`,
    );
    if (requiredGroups.has(item.group)) {
      assert.notEqual(item.status, "NOT APPLICABLE", `${item.group} is required by the selected profile`);
    } else {
      assert.equal(item.status, "NOT APPLICABLE", `${item.group} is outside the selected profile`);
    }
  }
  report.evidence.forEach(({ implementation }) => assert.deepEqual(implementation, report.implementation));
  assert.ok(Array.isArray(report.results));
  assert.equal(report.results.length, manifest.requirements.length);
  if (requirementEvidence !== null) {
    assert.ok(Array.isArray(requirementEvidence));
    assert.equal(requirementEvidence.length, manifest.requirements.length);
  }
  const counts = { PASS: 0, FAIL: 0, "NOT APPLICABLE": 0 };
  for (const [index, result] of report.results.entries()) {
    const requirement = manifest.requirements[index];
    const expectedMembers = ["requirementId", "status", "evidenceGroups", "evidenceReferences"];
    if (result.status !== "PASS") expectedMembers.push("reason");
    exactMembers(result, expectedMembers, `report result ${index}`);
    assert.equal(result.requirementId, requirement.id);
    assert.ok(REPORT_STATUSES.includes(result.status));
    assert.deepEqual(result.evidenceGroups, requirement.evidenceGroups);
    const attributed = requirementEvidence?.[index] ?? null;
    const expectedReference = `${report.evidenceRoot}#/requirementEvidence/${index}`;
    assert.deepEqual(result.evidenceReferences, [expectedReference]);
    if (attributed) {
      assert.equal(attributed.requirementId, requirement.id);
      assert.equal(attributed.status, result.status);
      assert.equal(attributed.durableEvidence, expectedReference);
    }
    if (result.status !== "PASS") requireString(result.reason, `${requirement.id} result reason`);
    const applicable = requirement.evidenceGroups.some((group) => requiredGroups.has(group));
    if (applicable) {
      assert.notEqual(result.status, "NOT APPLICABLE", `${requirement.id} is required by the selected profile`);
      if (["C2", "C3"].includes(report.assessmentLevel)) {
        assert.equal(result.status, "PASS", `${requirement.id} must pass for ${report.assessmentLevel}`);
      }
    } else {
      assert.equal(result.status, "NOT APPLICABLE", `${requirement.id} is outside the selected profile`);
    }
    counts[result.status] += 1;
  }
  exactMembers(report.summary, ["total", "pass", "fail", "notApplicable"], "report summary");
  assert.deepEqual(report.summary, {
    total: manifest.requirements.length,
    pass: counts.PASS,
    fail: counts.FAIL,
    notApplicable: counts["NOT APPLICABLE"],
  });
  const expectedFailures = report.results
    .filter(({ status }) => status === "FAIL")
    .map(({ requirementId }) => requirementId);
  assert.deepEqual(report.knownFailures, expectedFailures);
  if (report.scope.kind === "complete") assert.equal(counts["NOT APPLICABLE"], 0);
  if (["C2", "C3"].includes(report.assessmentLevel)) {
    assert.equal(counts.FAIL, 0);
    if (report.scope.kind === "complete") assert.equal(counts["NOT APPLICABLE"], 0);
  }
  if (report.assessmentLevel === "C1") {
    assert.ok(counts.FAIL > 0, "C1 requires at least one attributable failed requirement");
  }
  if (report.scope.kind === "complete" && counts.FAIL === 0) {
    assert.ok(["C2", "C3"].includes(report.assessmentLevel));
  }
  return report;
}

export function validateReportEvidenceBinding(report, evidenceArtifact, manifest) {
  validateEvidenceArtifact(evidenceArtifact, manifest);
  validateReport(report, manifest, evidenceArtifact.requirementEvidence);
  assert.equal(report.evidenceRoot, REFERENCE_EVIDENCE_URI, "report evidence root must be canonical");
  assert.equal(
    report.evidenceDigest,
    sha256(Buffer.from(`${canonicalJson(evidenceArtifact)}\n`, "utf8")),
    "report evidence digest differs from the exact retained evidence bytes",
  );
  assert.deepEqual(report.implementation, evidenceArtifact.implementation);
  assert.deepEqual(report.nativeProjectionProfile, evidenceArtifact.nativeProjectionProfile);
  assert.equal(report.assessor.name, evidenceArtifact.assessor);
  assert.equal(report.assessor.independent, false);
  assert.equal(report.assessmentDate, evidenceArtifact.assessmentDate);
  assert.deepEqual(report.evidence, evidenceArtifact.evidence);
  assert.deepEqual(
    report.results.map(({ evidenceReferences }) => evidenceReferences),
    evidenceArtifact.requirementEvidence.map(({ durableEvidence }) => [durableEvidence]),
    "report results must bind the exact retained requirement evidence",
  );
  return report;
}

export function buildReport(manifest, evidence, implementation, assessment) {
  validateManifest(manifest);
  validateEvidence(evidence, manifest, implementation);
  validateImplementationIdentity(implementation, "implementation");
  requireString(assessment?.evidenceRoot, "evidence root");
  requireString(assessment?.evidenceDigest, "evidence digest", SHA256_PATTERN);
  requireString(assessment?.assessor, "assessor");
  requireDateOnOrAfter(assessment?.date, manifest.standard.publicationDate, "assessment date");
  assert.equal(assessment?.independent ?? false, false, "the bundled report generator creates C2 evidence only");
  const scope = assessment?.profiles
    ? { kind: "profile", profiles: [...assessment.profiles].sort() }
    : { kind: "complete", profiles: [...COMPLETE_PROFILES] };
  if (Object.hasOwn(assessment ?? {}, "nativeProjectionProfile")) {
    assert.equal(isPlainObject(assessment.nativeProjectionProfile), true, "native projection profile must be an object");
  }
  const nativeProjectionProfiles = new Set([
    "Investigation Core",
    "Native Investigation Artifacts",
    "SDK",
  ]);
  const requiresNativeProjectionProfile = scope.kind === "complete"
    || scope.profiles.some((profile) => nativeProjectionProfiles.has(profile));
  if (requiresNativeProjectionProfile) {
    assert.equal(
      Object.hasOwn(assessment ?? {}, "nativeProjectionProfile"),
      true,
      "the selected scope requires a native projection profile",
    );
  }
  assert.ok(Array.isArray(assessment?.requirementEvidence));
  assert.equal(assessment.requirementEvidence.length, manifest.requirements.length);
  const results = manifest.requirements.map((requirement, index) => {
    const attributedEvidence = assessment.requirementEvidence[index];
    assert.equal(attributedEvidence.requirementId, requirement.id);
    const status = attributedEvidence.status;
    const result = {
      requirementId: requirement.id,
      status,
      evidenceGroups: requirement.evidenceGroups,
      evidenceReferences: [attributedEvidence.durableEvidence],
    };
    if (status === "NOT APPLICABLE") {
      const reasons = requirement.evidenceGroups
        .map((group) => evidence.find((item) => item.group === group))
        .filter((item) => item?.status === "NOT APPLICABLE")
        .map((item) => `${item.group}: ${item.reason}`);
      result.reason = reasons.join("; ");
    }
    if (status === "FAIL") result.reason = "One or more required evidence groups did not pass.";
    return result;
  });
  const fail = results.filter(({ status }) => status === "FAIL").length;
  const notApplicable = results.filter(({ status }) => status === "NOT APPLICABLE").length;
  const requiredGroups = applicableGroups(scope.profiles, manifest);
  for (const item of evidence) {
    if (requiredGroups.has(item.group)) {
      assert.notEqual(item.status, "NOT APPLICABLE", `${item.group} is required by the selected profile`);
    } else {
      assert.equal(item.status, "NOT APPLICABLE", `${item.group} is outside the selected profile`);
    }
  }
  for (const [index, result] of results.entries()) {
    if (manifest.requirements[index].evidenceGroups.some((group) => requiredGroups.has(group))) {
      assert.notEqual(result.status, "NOT APPLICABLE", `${result.requirementId} is required by the selected profile`);
    } else {
      assert.equal(result.status, "NOT APPLICABLE", `${result.requirementId} is outside the selected profile`);
    }
  }
  const report = {
    schemaVersion: "1.0",
    standard: {
      identifier: manifest.standard.identifier,
      version: manifest.standard.version,
      publicationDate: manifest.standard.publicationDate,
      publicationDigest: manifest.standard.publicationDigest,
    },
    conformance: {
      specificationVersion: "1.0.0",
      suiteIdentifier: "memoryos-conformance",
      suiteVersion: "1.0.0",
      manifestDigest: manifestDigest(manifest),
    },
    scope,
    implementation: { ...implementation },
    incorporatedPublications: manifest.incorporatedStandards.map(
      ({ identifier, version, publicationDigest }) => ({ identifier, version, publicationDigest }),
    ),
    evidenceRoot: assessment.evidenceRoot,
    evidenceDigest: assessment.evidenceDigest,
    assessor: { name: assessment.assessor, independent: false },
    assessmentDate: assessment.date,
    assessmentLevel: fail === 0 && (scope.kind === "profile" || notApplicable === 0) ? "C2" : "C1",
    evidence,
    results,
    knownFailures: results
      .filter(({ status }) => status === "FAIL")
      .map(({ requirementId }) => requirementId),
    summary: {
      total: results.length,
      pass: results.filter(({ status }) => status === "PASS").length,
      fail,
      notApplicable,
    },
  };
  if (Object.hasOwn(assessment ?? {}, "nativeProjectionProfile")) {
    report.nativeProjectionProfile = { ...assessment.nativeProjectionProfile };
  }
  return validateReport(report, manifest, assessment.requirementEvidence);
}

export function serializeReport(report) {
  return `${canonicalJson(report)}\n`;
}

export function reportMarkdown(report, manifest) {
  validateReport(report, manifest);
  const titleById = new Map(manifest.requirements.map(({ id, title }) => [id, title]));
  const lines = [
    "# MemoryOS Reference Implementation Conformance Report",
    "",
    "## Purpose",
    "",
    `This deterministic report evaluates ${report.implementation.name} ${report.implementation.version ?? report.implementation.revision} against ${report.standard.identifier}.`,
    "",
    "## Assessment",
    "",
    `- Standard publication: ${report.standard.identifier} ${report.standard.version} (${report.standard.publicationDate}; ${report.standard.publicationDigest})`,
    `- Conformance specification: ${report.conformance.specificationVersion}`,
    `- Conformance suite: ${report.conformance.suiteIdentifier} ${report.conformance.suiteVersion}`,
    `- Scope: ${report.scope.kind} (${report.scope.profiles.join(", ")})`,
    `- Native projection profile: ${report.nativeProjectionProfile?.identifier ?? "not applicable"}${report.nativeProjectionProfile ? ` ${report.nativeProjectionProfile.version}` : ""}`,
    `- Evidence root: ${report.evidenceRoot}`,
    `- Evidence digest: ${report.evidenceDigest}`,
    `- Assessor: ${report.assessor.name}`,
    `- Assessment date: ${report.assessmentDate}`,
    `- Assessment level: ${report.assessmentLevel}`,
    "",
    "## Summary",
    "",
    `- PASS: ${report.summary.pass}`,
    `- FAIL: ${report.summary.fail}`,
    `- NOT APPLICABLE: ${report.summary.notApplicable}`,
    `- Total normative requirements: ${report.summary.total}`,
    "",
    "## Evidence",
    "",
    "| Group | Method | Status | Durable evidence |",
    "| --- | --- | --- | --- |",
  ];
  for (const evidence of report.evidence) {
    lines.push(
      `| ${evidence.group} | ${evidence.method} | ${evidence.status} | ${evidence.durableEvidence} |`,
    );
  }
  lines.push(
    "",
    "## Requirement results",
    "",
    "| Requirement | Title | Status | Evidence group | Evidence reference | Reason |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const result of report.results) {
    lines.push(
      `| ${result.requirementId} | ${titleById.get(result.requirementId)} | ${result.status} | ${result.evidenceGroups.join(", ")} | ${result.evidenceReferences.join(", ")} | ${result.reason ?? "—"} |`,
    );
  }
  lines.push(
    "",
    "A passing report is verification evidence. Certification remains a separate governance decision.",
    "",
  );
  return lines.join("\n");
}

export function standardRoot() {
  if (process.env.MEMORYOS_STANDARD_ROOT) return resolve(process.env.MEMORYOS_STANDARD_ROOT);
  const adjacent = resolve(WORKSPACE_ROOT, "../cca-specifications/specifications/CCA-MEMORYOS-1.0");
  try {
    return statSync(adjacent).isDirectory() ? adjacent : null;
  } catch {
    return null;
  }
}

function parsePublishedRequirements(source, options = {}) {
  const blocks = source.split(/\n(?=  - id: CCA-)/u).slice(1);
  return blocks.map((block) => {
    const id = block.match(/^  - id: (CCA-[A-Z]+(?:-[A-Z]+)?-[0-9]{3})/u)?.[1];
    const title = block.match(/^    title: (.+)$/mu)?.[1];
    const scalar = block.match(/^    requirement: (.*)$/mu)?.[1];
    let statement = scalar;
    if (/^[>|][+-]?$/u.test(scalar ?? "")) {
      const lines = block.split(/\r?\n/u);
      const start = lines.findIndex((line) => /^    requirement: [>|][+-]?$/u.test(line));
      const content = [];
      for (let index = start + 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.length > 0 && !/^      /u.test(line)) break;
        content.push(line.length === 0 ? "" : line.slice(6));
      }
      if (scalar[0] === ">") {
        const folded = [];
        for (const line of content) {
          if (line.length === 0) folded.push("\n");
          else if (folded.length === 0 || folded.at(-1).endsWith("\n")) folded.push(line);
          else folded[folded.length - 1] = `${folded.at(-1)} ${line}`;
        }
        statement = folded.join("");
      } else statement = content.join("\n");
      const chomp = scalar.slice(1);
      if (chomp !== "-") statement += "\n";
      if (chomp !== "+") statement = statement.replace(/\n+$/u, chomp === "-" ? "" : "\n");
    }
    const verificationMethods = [...new Set(
      [...block.matchAll(/method:\s*([a-z0-9_]+)/gu)].map((match) => match[1]),
    )].sort();
    const verificationCriteria = [...new Set(
      [...block.matchAll(/evidence:\s*([^}\]\r\n]+)/gu)]
        .map((match) => match[1].trim())
        .filter(Boolean),
    )].sort();
    const sourceMetadata = block.match(/^    source: "([^"]+)"$/mu)?.[1] ?? null;
    const sourceDocument = options.sourceDocument ?? sourceMetadata?.split(" § ", 1)[0];
    const evidenceGroups = options.evidenceGroups ?? block.match(/^    evidence_groups: \[([^\]]+)\]$/mu)?.[1]
      ?.split(",").map((value) => value.trim()).sort();
    return {
      id,
      title,
      statement,
      sourceDocument,
      sourceAnchor: id,
      verification: verificationMethods.every((method) => /(?:review|audit|inspection)$/u.test(method))
        ? "review"
        : "automated",
      verificationMethods,
      verificationCriteria,
      evidenceGroups,
    };
  });
}

function parsePublishedConformanceProfiles(source) {
  const section = source.match(/\nconformance_profiles:\n([\s\S]*?)\nrequirements:\n/u)?.[1];
  assert.ok(section, "published requirements registry lacks conformance_profiles");
  const applicability = /^  applicability: (\S+)$/mu.exec(section)?.[1];
  const commonEvidenceGroups = /^  common_evidence_groups: \[([^\]]+)\]$/mu.exec(section)?.[1]
    ?.split(",").map((value) => value.trim());
  const profiles = [...section.matchAll(/^    - name: (.+)\n      evidence_groups: \[([^\]]+)\]$/gmu)]
    .map((match) => ({
      name: match[1],
      evidenceGroups: match[2].split(",").map((value) => value.trim()),
    }));
  return { applicability, commonEvidenceGroups, profiles };
}

function parsePublishedIncorporations(source) {
  const section = source.match(/\nincorporated_requirements:\n([\s\S]*?)\nevidence_groups:\n/u)?.[1];
  assert.ok(section, "published requirements registry lacks incorporated_requirements");
  return section.split(/\n(?=  - specification_id: )/u).map((block) => ({
    identifier: /^  - specification_id: (\S+)$/mu.exec(block)?.[1],
    evidenceGroups: /^    evidence_groups: \[([^\]]+)\]$/mu.exec(block)?.[1]
      ?.split(",").map((value) => value.trim()),
  }));
}

function assertRegistryParity(actualRequirements, manifestRequirements, label) {
  actualRequirements = [...actualRequirements].sort((left, right) => (
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  ));
  manifestRequirements = [...manifestRequirements].sort((left, right) => (
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  ));
  assert.equal(actualRequirements.length, manifestRequirements.length, `${label} requirement count differs`);
  for (const [index, actual] of actualRequirements.entries()) {
    const manifestRequirement = manifestRequirements[index];
    for (const member of [
      "id", "title", "statement", "sourceDocument", "sourceAnchor", "verification",
    ]) {
      assert.deepEqual(
        manifestRequirement[member],
        actual[member],
        `${manifestRequirement.id} ${member} differs from the frozen registry`,
      );
    }
    for (const member of ["verificationMethods", "verificationCriteria", "evidenceGroups"]) {
      assert.deepEqual(
        manifestRequirement[member],
        actual[member],
        `${manifestRequirement.id} ${member} differs from the frozen registry`,
      );
    }
  }
}

export async function validatePublishedStandard(root, manifest) {
  validateManifest(manifest);
  await access(root, constants.R_OK);
  const requirementsSource = await readFile(resolve(root, "requirements.yaml"), "utf8");
  assert.equal(
    /^  specification_id: (\S+)$/mu.exec(requirementsSource)?.[1],
    manifest.standard.identifier,
    "the Standard identifier differs from the frozen publication metadata",
  );
  assert.equal(
    /^  version: "([^"]+)"$/mu.exec(requirementsSource)?.[1],
    manifest.standard.version,
    "the Standard version differs from the frozen publication metadata",
  );
  assert.equal(
    /^  publication_date: "([^"]+)"$/mu.exec(requirementsSource)?.[1],
    manifest.standard.publicationDate,
    "the Standard publication date differs from the frozen publication metadata",
  );
  assert.deepEqual(
    parsePublishedConformanceProfiles(requirementsSource),
    manifest.conformanceProfiles,
    "the conformance profile registry differs from the frozen publication",
  );
  const publishedIncorporations = new Map(
    parsePublishedIncorporations(requirementsSource).map((entry) => [entry.identifier, entry]),
  );
  for (const incorporated of manifest.incorporatedStandards) {
    assert.deepEqual(
      incorporated.evidenceGroups,
      publishedIncorporations.get(incorporated.identifier)?.evidenceGroups,
      `${incorporated.identifier} applicability groups differ from the frozen publication`,
    );
  }
  const publishedDirectIds = [...requirementsSource.matchAll(/^  - id: (CCA-MOS-[A-Z]+-[0-9]{3})$/gmu)]
    .map((match) => match[1]);
  assert.deepEqual(
    manifest.requirements.filter(({ incorporatedFrom }) => !incorporatedFrom).map(({ id }) => id),
    [...publishedDirectIds].sort(),
    "the pinned manifest must contain every direct published requirement exactly once",
  );
  assertRegistryParity(
    parsePublishedRequirements(requirementsSource),
    manifest.requirements.filter(({ incorporatedFrom }) => !incorporatedFrom),
    "CCA-MEMORYOS-1.0",
  );
  for (const document of manifest.standard.documents) {
    const path = resolve(root, document.path);
    const bytes = await readFile(path);
    assert.equal(sha256(bytes), document.sha256, `${document.path} differs from the pinned publication`);
  }
  for (const requirement of manifest.requirements.filter(({ incorporatedFrom }) => !incorporatedFrom)) {
    assert.ok(
      requirementsSource.includes(requirement.id),
      `${requirement.id} is absent from the authoritative requirements manifest`,
    );
    const source = await readFile(resolve(root, requirement.sourceDocument), "utf8");
    assert.ok(
      source.includes(requirement.sourceAnchor),
      `${requirement.sourceAnchor} is absent from ${requirement.sourceDocument}`,
    );
  }

  for (const publication of manifest.incorporatedStandards) {
    const publicationRoot = resolve(dirname(root), publication.identifier);
    await access(publicationRoot, constants.R_OK);
    for (const document of publication.documents) {
      const bytes = await readFile(resolve(publicationRoot, document.path));
      assert.equal(
        sha256(bytes),
        document.sha256,
        `${publication.identifier}/${document.path} differs from the pinned publication`,
      );
    }
    const incorporatedRequirements = manifest.requirements.filter(
      ({ incorporatedFrom }) => incorporatedFrom === publication.identifier,
    );
    const incorporatedRegistry = await readFile(resolve(publicationRoot, "requirements.yaml"), "utf8");
    assertRegistryParity(
      parsePublishedRequirements(incorporatedRegistry, {
        sourceDocument: "requirements.yaml",
        evidenceGroups: [publication.identifier === "CCA-MIP-1.0"
          ? "MOS-EVID-MIP-001"
          : "MOS-EVID-RT-001"],
      }),
      incorporatedRequirements,
      publication.identifier,
    );
    assert.equal(incorporatedRequirements[0]?.id, publication.requirementRange.first);
    assert.equal(incorporatedRequirements.at(-1)?.id, publication.requirementRange.last);
    for (const requirement of incorporatedRequirements) {
      assert.ok(
        incorporatedRegistry.includes(requirement.id),
        `${requirement.id} is absent from ${publication.identifier}/requirements.yaml`,
      );
      const declaredSource = await readFile(
        resolve(publicationRoot, requirement.sourceDocument),
        "utf8",
      );
      assert.ok(
        declaredSource.includes(requirement.sourceAnchor),
        `${requirement.sourceAnchor} is absent from ${publication.identifier}/${requirement.sourceDocument}`,
      );
    }
  }
}

export async function readMipFixture(name) {
  const source = await readFile(resolve(STUDIO_ROOT, `tests/fixtures/mip/${name}.mip.b64`), "ascii");
  return new Uint8Array(Buffer.from(source.trim(), "base64"));
}

export function runCli(arguments_, options = {}) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...arguments_], {
    cwd: options.cwd ?? WORKSPACE_ROOT,
    encoding: options.binary ? null : "utf8",
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", ...options.env },
    input: options.input,
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30_000,
    windowsHide: true,
  });
  assert.ifError(result.error);
  return result;
}

export function parseCliJson(result) {
  assert.equal(typeof result.stdout, "string");
  const lines = result.stdout.trimEnd().split(/\r?\n/u);
  assert.equal(lines.length, 1, "CLI JSON output must contain one record");
  return JSON.parse(lines[0]);
}

export async function importFromWorkspace(relativePath) {
  return import(pathToFileURL(resolve(WORKSPACE_ROOT, relativePath)).href);
}
