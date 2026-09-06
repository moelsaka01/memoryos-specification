import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  canonicalJson,
  buildReport,
  buildRequirementEvidence,
  manifestDigest,
  readJson,
  readCanonicalJson,
  readManifest,
  REFERENCE_EVIDENCE_URI,
  requirementEvidenceInputs,
  retainAssessmentManifest,
  sha256,
  standardRoot,
  validateManifest,
  validateManifestInputsCurrent,
  validateReport,
  validateReviewArtifact,
  validatePublishedStandard,
  WORKSPACE_ROOT,
} from "./support/conformance-support.mjs";
import {
  DIRECT_REQUIREMENT_SELECTORS,
  INCORPORATED_RANGE_CONJUNCTIONS,
  RF_REQUIREMENT_SELECTORS,
  loadMipRequirementSelectors,
  validateRequirementSelectorCatalog,
} from "../tools/requirement-selector-catalog.mjs";

function reportFixture(manifest, profiles = null, nativeProjectionProfile = undefined) {
  const nativeProjectionProfiles = new Set([
    "Investigation Core",
    "Native Investigation Artifacts",
    "SDK",
  ]);
  const selectedProfiles = profiles ?? manifest.conformanceProfiles.profiles.map(({ name }) => name);
  if (
    nativeProjectionProfile === undefined
    && (profiles === null || selectedProfiles.some((profile) => nativeProjectionProfiles.has(profile)))
  ) {
    nativeProjectionProfile = { identifier: "cca-studio-native-observation", version: "1.1.0" };
  }
  const required = new Set(manifest.conformanceProfiles.commonEvidenceGroups);
  for (const name of selectedProfiles) {
    const profile = manifest.conformanceProfiles.profiles.find(({ name: value }) => value === name);
    assert.ok(profile);
    profile.evidenceGroups.forEach((group) => required.add(group));
  }
  const evidence = manifest.evidenceGroups.map((group) => {
    const applicable = required.has(group.id);
    const record = {
      group: group.id,
      status: applicable ? "PASS" : "NOT APPLICABLE",
      implementation: group.implementation,
      requirementIds: group.requirementIds,
      method: group.method,
      inputs: group.inputs,
      inputInventory: group.inputInventory,
      expectedOutcome: group.expectedOutcome,
      observedOutcome: applicable ? "Fixture criteria passed." : "Outside the selected profile.",
      durableEvidence: group.durableEvidence,
      executionReferences: applicable ? group.executionReferences : [],
    };
    if (!applicable) record.reason = "Outside the selected profile.";
    return record;
  });
  const requirementEvidence = manifest.requirements.map((requirement, index) => {
    const applicable = requirement.evidenceGroups.some((group) => required.has(group));
    return {
      requirementId: requirement.id,
      status: applicable ? "PASS" : "NOT APPLICABLE",
      durableEvidence: `${REFERENCE_EVIDENCE_URI}#/requirementEvidence/${index}`,
    };
  });
  const assessment = {
    evidenceRoot: REFERENCE_EVIDENCE_URI,
    evidenceDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    assessor: "MemoryOS conformance fixture",
    date: "2026-09-05",
    requirementEvidence,
  };
  if (profiles) assessment.profiles = profiles;
  if (nativeProjectionProfile) assessment.nativeProjectionProfile = nativeProjectionProfile;
  return {
    report: buildReport(
      manifest,
      evidence,
      {
        name: manifest.implementation.name,
        version: manifest.implementation.version,
        revision: manifest.implementation.revision,
      },
      assessment,
    ),
    requirementEvidence,
  };
}

test("the pinned manifest is complete, ordered, and self-authenticating", async () => {
  const first = await readManifest();
  const second = await readManifest();
  validateManifest(first);
  assert.deepEqual(first, second);
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.match(manifestDigest(first), /^sha256:[0-9a-f]{64}$/u);

  const identifiers = first.requirements.map(({ id }) => id);
  assert.equal(new Set(identifiers).size, identifiers.length);
  for (const mutate of [
    (value) => { value.standard.version = "9.9"; },
    (value) => { value.incorporatedStandards[0].version = "9.9"; },
    (value) => { value.incorporatedStandards[1].version = "8.8"; },
  ]) {
    const substituted = structuredClone(first);
    mutate(substituted);
    assert.throws(() => validateManifest(substituted), /identifier\/version pair differs/u);
  }
  const predatesPublication = structuredClone(first);
  predatesPublication.standard.publicationDate = "2026-09-04";
  assert.throws(() => validateManifest(predatesPublication), /publicationDate|strictly equal/u);
  for (const [label, mutate] of [
    ["Standard", (value) => { value.standard.documents.pop(); }],
    ["MIP", (value) => { value.incorporatedStandards[0].documents.pop(); }],
    ["Runtime", (value) => { value.incorporatedStandards[1].documents.pop(); }],
  ]) {
    const truncated = structuredClone(first);
    mutate(truncated);
    assert.throws(
      () => validateManifest(truncated),
      /publication inventory is incomplete|Standard publication inventory/u,
      `${label} document omission must invalidate the manifest`,
    );
  }
  const expandedPublication = structuredClone(first);
  expandedPublication.standard.documents.push({
    path: "unexpected-publication-member.md",
    sha256: `sha256:${"1".repeat(64)}`,
  });
  expandedPublication.standard.documents.sort((left, right) => (
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  ));
  expandedPublication.standard.publicationDigest = sha256(Buffer.from(
    canonicalJson(expandedPublication.standard.documents),
    "utf8",
  ));
  assert.throws(
    () => validateManifest(expandedPublication),
    /publication inventory is incomplete|Standard publication inventory/u,
    "an added claimant-selected publication member must invalidate the manifest",
  );
  assert.equal(identifiers.some((id) => id.startsWith("CCA-MOS-")), true);
  assert.equal(identifiers.filter((id) => id.startsWith("CCA-MIP-")).length, 64);
  assert.equal(identifiers.filter((id) => id.startsWith("CCA-RF-")).length, 40);
  assert.equal(first.requirements.some(({ statement }) => /^[>|][+-]?$/u.test(statement)), false);
  assert.equal(
    first.requirements.find(({ id }) => id === "CCA-RF-001").statement,
    "The CCA architecture MUST define one coherent Runtime Foundation boundary at Layer 3.",
  );
  assert.match(
    first.requirements.find(({ id }) => id === "CCA-MIP-001").statement,
    /^A Memory Investigation Package MUST contain cognition from exactly one Workspace,/u,
  );
  const implementationPaths = new Set(first.implementation.sourceInventory.map(({ path }) => path));
  assert.equal(
    first.implementation.revision,
    sha256(Buffer.from(canonicalJson(first.implementation.sourceInventory), "utf8")),
  );
  assert.equal(
    [...implementationPaths].some((path) => path.startsWith("repositories/cca-conformance/")),
    false,
    "suite-only changes must not change the assessed product revision",
  );
  assert.equal(
    [...implementationPaths].some((path) => /(?:^|\/)__pycache__(?:\/|$)|\.pyc$/u.test(path)),
    false,
    "generated Python cache bytes must not enter the assessed product revision",
  );
  const cacheDirectory = resolve(
    WORKSPACE_ROOT,
    "repositories/cca-sdk/python/src/memoryos/__pycache__",
  );
  const cacheArtifact = resolve(cacheDirectory, "conformance-inventory-probe.pyc");
  try {
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(cacheArtifact, "generated cache bytes must be irrelevant", "utf8");
    validateManifestInputsCurrent(first);
    assert.equal(
      first.implementation.revision,
      sha256(Buffer.from(canonicalJson(first.implementation.sourceInventory), "utf8")),
    );
  } finally {
    await rm(cacheArtifact, { force: true });
  }
  assert.ok(implementationPaths.has("repositories/cca-studio/package.json"));
  assert.ok(implementationPaths.has("repositories/cca-sdk/python/pyproject.toml"));
  for (const groupId of [
    "MOS-EVID-ADAPT-001", "MOS-EVID-ART-001", "MOS-EVID-COMP-001", "MOS-EVID-CORE-001",
    "MOS-EVID-EXPL-001", "MOS-EVID-LIFE-001", "MOS-EVID-MIP-001", "MOS-EVID-REG-001",
    "MOS-EVID-SDK-001",
  ]) {
    assert.ok(
      first.evidenceGroups.find(({ id }) => id === groupId).inputs
        .includes("repositories/cca-studio/package.json"),
      `${groupId} must commit the Studio module-resolution contract`,
    );
  }
  assert.ok(
    first.evidenceGroups.find(({ id }) => id === "MOS-EVID-SDK-001").inputs
      .includes("repositories/cca-sdk/python/pyproject.toml"),
  );
  assert.ok(
    first.evidenceGroups.find(({ id }) => id === "MOS-EVID-CLI-001").inputs
      .includes("repositories/memoryos-cli/package.json"),
  );
  const staleInputs = structuredClone(first);
  const stalePath = "repositories/cca-sdk/python/pyproject.toml";
  for (const record of [
    ...staleInputs.implementation.sourceInventory,
    ...staleInputs.evidenceGroups.flatMap(({ inputInventory }) => inputInventory),
  ]) {
    if (record.path === stalePath) record.sha256 = `sha256:${"0".repeat(64)}`;
  }
  assert.throws(
    () => validateManifestInputsCurrent(staleInputs),
    /differs from the pinned manifest bytes/u,
  );

  const omitted = structuredClone(first);
  omitted.requirements = omitted.requirements.filter(({ id }) => id !== "CCA-MOS-COMP-005");
  assert.throws(
    () => validateManifest(omitted),
    /CCA-MOS-COMP-005/u,
    "omitting a direct normative requirement must invalidate the manifest",
  );
});

test("the exact MemoryOS Standard and incorporated publications match their pinned digests", async () => {
  const manifest = await readManifest();
  const root = standardRoot();
  assert.notEqual(
    root,
    null,
    "the authoritative Standard publication must be supplied or installed adjacent to the suite",
  );
  await validatePublishedStandard(root, manifest);
});

test("report and manifest schemas preserve independent Standard and implementation versions", async () => {
  const manifestSchema = await readJson(new URL(
    "../schema/requirements-manifest-1.0.schema.json",
    import.meta.url,
  ));
  const reportSchema = await readJson(new URL(
    "../schema/conformance-report-1.0.schema.json",
    import.meta.url,
  ));
  assert.equal(manifestSchema.properties.standard.properties.identifier.const, "CCA-MEMORYOS-1.0");
  assert.equal(reportSchema.properties.standard.properties.identifier.const, "CCA-MEMORYOS-1.0");
  assert.equal(manifestSchema.properties.standard.properties.version.const, "1.0");
  assert.equal(reportSchema.properties.standard.properties.version.const, "1.0");
  assert.equal(manifestSchema.properties.standard.properties.publicationDate.const, "2026-09-05");
  assert.equal(reportSchema.properties.standard.properties.publicationDate.const, "2026-09-05");
  assert.equal(reportSchema.$defs.version.pattern, "^[0-9]+\\.[0-9]+\\.[0-9]+$");
});

test("CCA-MOS-CONF-001: complete reports cover every normative row with no omission or non-applicable status", async () => {
  const manifest = validateManifest(await readManifest());
  const { report, requirementEvidence } = reportFixture(manifest);
  assert.equal(report.results.length, 218);
  assert.equal(report.summary.notApplicable, 0);
  assert.equal(report.results.every(({ status }) => status === "PASS"), true);
  const omitted = structuredClone(report);
  omitted.results.pop();
  assert.throws(() => validateReport(omitted, manifest, requirementEvidence), /218|length|requirement/u);
  const mislabeled = structuredClone(report);
  mislabeled.assessmentLevel = "C1";
  mislabeled.results[0].status = "NOT APPLICABLE";
  mislabeled.results[0].reason = "Incorrectly omitted.";
  mislabeled.summary.pass -= 1;
  mislabeled.summary.notApplicable += 1;
  assert.throws(() => validateReport(mislabeled, manifest), /required by the selected profile/u);
});

test("CCA-MOS-CONF-002: scoped reports apply the published profile registry and justify every non-applicable row", async () => {
  const manifest = validateManifest(await readManifest());
  const { report, requirementEvidence } = reportFixture(manifest, ["SDK"]);
  validateReport(report, manifest, requirementEvidence);
  assert.deepEqual(report.scope, { kind: "profile", profiles: ["SDK"] });
  assert.equal(report.summary.notApplicable > 0, true);
  assert.equal(
    report.results.filter(({ status }) => status === "NOT APPLICABLE").every(({ reason }) => reason.length > 0),
    true,
  );
  const outside = report.results.findIndex(({ status }) => status === "NOT APPLICABLE");
  const mislabeled = structuredClone(report);
  delete mislabeled.results[outside].reason;
  mislabeled.results[outside].status = "PASS";
  mislabeled.summary.pass += 1;
  mislabeled.summary.notApplicable -= 1;
  assert.throws(() => validateReport(mislabeled, manifest), /outside the selected profile/u);
});

test("CCA-MOS-CONF-007: reports bind every required claim identity and assessment field", async () => {
  const manifest = validateManifest(await readManifest());
  const nativeProjectionProfile = { identifier: "cca-studio-native-observation", version: "1.1.0" };
  const { report, requirementEvidence } = reportFixture(manifest, null, nativeProjectionProfile);
  validateReport(report, manifest, requirementEvidence);
  assert.deepEqual(report.standard, {
    identifier: manifest.standard.identifier,
    version: manifest.standard.version,
    publicationDate: manifest.standard.publicationDate,
    publicationDigest: manifest.standard.publicationDigest,
  });
  assert.deepEqual(report.conformance, {
    specificationVersion: "1.0.0",
    suiteIdentifier: "memoryos-conformance",
    suiteVersion: "1.0.0",
    manifestDigest: manifestDigest(manifest),
  });
  assert.deepEqual(report.scope.profiles, manifest.conformanceProfiles.profiles.map(({ name }) => name));
  assert.deepEqual(report.implementation, {
    name: manifest.implementation.name,
    version: manifest.implementation.version,
    revision: manifest.implementation.revision,
  });
  assert.deepEqual(report.nativeProjectionProfile, nativeProjectionProfile);
  assert.equal(report.evidenceRoot, REFERENCE_EVIDENCE_URI);
  assert.deepEqual(report.assessor, { name: "MemoryOS conformance fixture", independent: false });
  assert.equal(report.assessmentDate, "2026-09-05");
  assert.equal(report.assessmentLevel, "C2");
  for (const member of [
    "standard", "conformance", "scope", "implementation", "incorporatedPublications",
    "nativeProjectionProfile", "evidenceRoot", "evidenceDigest", "assessor", "assessmentDate",
    "assessmentLevel", "evidence", "results", "knownFailures", "summary",
  ]) {
    const incomplete = structuredClone(report);
    delete incomplete[member];
    assert.throws(
      () => validateReport(incomplete, manifest),
      /member set|object|native projection profile/u,
      member,
    );
  }
  const implementation = structuredClone(report.implementation);
  const reviewRecordId = "CCA-MOS-CONF-007-review-fixture";
  const review = {
    schemaVersion: "1.0",
    implementation,
    implementationRevisionDigest: implementation.revision,
    reviewRecordId,
    reviewer: "MemoryOS conformance fixture",
    assessmentDate: "2026-09-05",
    attestations: manifest.requirements
      .filter(({ verification }) => verification !== "automated")
      .map((requirement, index) => ({
        requirementId: requirement.id,
        implementation,
        artifacts: requirementEvidenceInputs(requirement, manifest),
        criterion: requirement.statement,
        observedOutcome: "The exact review criterion passed in the deterministic fixture.",
        reviewer: "MemoryOS conformance fixture",
        date: "2026-09-05",
        reviewRecordId,
        implementationRevisionDigest: implementation.revision,
        result: "PASS",
        durableEvidence: `evidence/reference-implementation-review-1.2.0.json#/attestations/${index}`,
      })),
  };
  validateReviewArtifact(review, manifest);
  const relabeledReview = structuredClone(review);
  relabeledReview.implementationRevisionDigest = `sha256:${"0".repeat(64)}`;
  assert.throws(
    () => validateReviewArtifact(relabeledReview, manifest),
    /exact assessed implementation revision/u,
  );
});

test("every normative requirement has explicit verification evidence", async () => {
  const manifest = validateManifest(await readManifest());
  const evidence = new Map(manifest.evidenceGroups.map((group) => [group.id, group]));
  for (const requirement of manifest.requirements) {
    assert.ok(requirement.evidenceGroups.length > 0, requirement.id);
    for (const identifier of requirement.evidenceGroups) {
      assert.ok(evidence.has(identifier), `${requirement.id}: ${identifier}`);
    }
    if (requirement.verification === "automated") {
      assert.ok(
        requirement.evidenceGroups.some((identifier) => evidence.get(identifier).automated),
        `${requirement.id} requires executable evidence`,
      );
    }
  }
});

test("CCA-MOS-CONF-004: every automated requirement is bound to exact committed selectors", async () => {
  const manifest = validateManifest(await readManifest());
  const mip = await loadMipRequirementSelectors(WORKSPACE_ROOT);
  validateRequirementSelectorCatalog(mip);
  for (const requirement of manifest.requirements) {
    const expected = requirement.id.startsWith("CCA-MIP-")
      ? mip[requirement.id]
      : requirement.id.startsWith("CCA-RF-")
        ? RF_REQUIREMENT_SELECTORS[requirement.id]
        : DIRECT_REQUIREMENT_SELECTORS[requirement.id];
    assert.deepEqual(requirement.coverageSelectors, expected, requirement.id);
    if (Object.hasOwn(INCORPORATED_RANGE_CONJUNCTIONS, requirement.id)) {
      assert.equal(requirement.coverageSelectors.length, 0);
      assert.ok(requirement.executionReferences.length > 0);
    } else if (requirement.verification === "automated") {
      assert.ok(requirement.coverageSelectors.length > 0, requirement.id);
    }
  }
});

test("CCA-MOS-CONF-005: missing renamed skipped or duplicate selectors yield requirement failure", async () => {
  const manifest = validateManifest(await readManifest());
  const groups = manifest.evidenceGroups.map((group) => ({ group: group.id, status: "PASS" }));
  const reviews = manifest.requirements
    .filter(({ verification }) => verification !== "automated")
    .map(({ id }, index) => ({
      requirementId: id,
      result: "PASS",
      observedOutcome: "Retained deterministic review outcome.",
      durableEvidence: `evidence/reference-implementation-review-1.2.0.json#/attestations/${index}`,
    }));
  const executions = [...new Set(manifest.requirements.flatMap(({ executionReferences }) => executionReferences))]
    .sort()
    .map((id) => ({
      id,
      status: "PASS",
      exitCode: 0,
      checks: [...new Map(
        manifest.requirements.flatMap(({ coverageSelectors }) => coverageSelectors)
          .filter(({ executionReference }) => executionReference === id)
          .map(({ source, selector }) => [`${source}\0${selector}`, { source, selector, status: "PASS" }]),
      ).values()],
    }));
  const target = manifest.requirements.find(({ id }) => id === "CCA-MOS-CORE-011");
  assert.ok(target);
  const binding = target.coverageSelectors[0];
  const mutate = (operation) => {
    const changed = structuredClone(executions);
    const execution = changed.find(({ id }) => id === binding.executionReference);
    const index = execution.checks.findIndex(({ source, selector }) => (
      source === binding.source && selector === binding.selector
    ));
    assert.notEqual(index, -1);
    operation(execution.checks, index);
    return buildRequirementEvidence(manifest, groups, reviews, changed)
      .find(({ requirementId }) => requirementId === target.id).status;
  };
  assert.equal(mutate((checks, index) => checks.splice(index, 1)), "FAIL");
  assert.equal(mutate((checks, index) => { checks[index].selector += " renamed"; }), "FAIL");
  assert.equal(mutate((checks, index) => { checks[index].status = "SKIP"; }), "FAIL");
  assert.equal(mutate((checks, index) => checks.push({ ...checks[index] })), "FAIL");
});

test("scoped evidence keeps excluded requirements non-applicable without fabricated executions or reviews", async () => {
  const manifest = validateManifest(await readManifest());
  const selectedGroups = new Set([
    ...manifest.conformanceProfiles.commonEvidenceGroups,
    ...manifest.conformanceProfiles.profiles
      .find(({ name }) => name === "AI Runtime Adapter").evidenceGroups,
  ]);
  const groups = manifest.evidenceGroups.map(({ id }) => ({
    group: id,
    status: selectedGroups.has(id) ? "PASS" : "NOT APPLICABLE",
  }));
  const applicable = (requirement) => requirement.evidenceGroups.some((group) => selectedGroups.has(group));
  const reviews = manifest.requirements
    .filter((requirement) => applicable(requirement) && requirement.verification !== "automated")
    .map(({ id }, index) => ({
      requirementId: id,
      result: "PASS",
      observedOutcome: "Retained scoped review outcome.",
      durableEvidence: `portable-review.json#/attestations/${index}`,
    }));
  const executions = [...new Set(
    manifest.requirements.filter(applicable).flatMap(({ executionReferences }) => executionReferences),
  )].sort().map((id) => ({
    id,
    status: "PASS",
    exitCode: 0,
    checks: [...new Map(
      manifest.requirements.filter(applicable)
        .flatMap(({ coverageSelectors }) => coverageSelectors)
        .filter(({ executionReference }) => executionReference === id)
        .map(({ source, selector }) => [`${source}\0${selector}`, { source, selector, status: "PASS" }]),
    ).values()],
  }));
  const rows = buildRequirementEvidence(manifest, groups, reviews, executions);
  for (const wrapperId of ["CCA-MOS-MIP-001", "CCA-MOS-RT-001"]) {
    const wrapper = rows.find(({ requirementId }) => requirementId === wrapperId);
    assert.equal(wrapper.status, "NOT APPLICABLE");
    assert.equal(Object.hasOwn(wrapper, "observedOutcome"), false);
    assert.deepEqual(wrapper.evidenceReferences, []);
  }
  const excludedReview = rows.find(({ requirementId }) => requirementId === "CCA-MOS-CORE-001");
  assert.equal(excludedReview.status, "NOT APPLICABLE");
  assert.equal(Object.hasOwn(excludedReview, "observedOutcome"), false);
  assert.deepEqual(excludedReview.evidenceReferences, []);
  assert.equal(rows.filter(({ status }) => status === "NOT APPLICABLE").length > 0, true);
});

test("content-addressed assessment manifests retain earlier report bindings", async () => {
  const manifest = validateManifest(await readManifest());
  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "memoryos-manifests-"));
  try {
    const firstPath = await retainAssessmentManifest(manifest, temporaryRoot);
    const firstBytes = await readFile(firstPath);
    const firstAssessment = reportFixture(manifest);
    const second = structuredClone(manifest);
    second.implementation.sourceInventory = [{
      path: "portable-target/source-v2",
      kind: "file",
      sha256: `sha256:${"2".repeat(64)}`,
    }];
    second.implementation.name = "Second portable assessment target";
    second.implementation.version = "2.0.0";
    second.implementation.revision = `sha256:${"3".repeat(64)}`;
    const secondIdentity = {
      name: second.implementation.name,
      version: second.implementation.version,
      revision: second.implementation.revision,
    };
    second.evidenceGroups.forEach((group) => { group.implementation = secondIdentity; });
    const secondPath = await retainAssessmentManifest(second, temporaryRoot);
    assert.notEqual(secondPath, firstPath);
    assert.deepEqual(await readFile(firstPath), firstBytes);
    const retainedFirst = await readCanonicalJson(firstPath);
    validateReport(firstAssessment.report, retainedFirst, firstAssessment.requirementEvidence);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
