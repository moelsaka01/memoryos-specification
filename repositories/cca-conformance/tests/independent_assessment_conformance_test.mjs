import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildIndependentAssessmentArtifact,
  buildIndependentC3Report,
  buildReport,
  buildRequirementEvidence,
  canonicalJson,
  executedGroupEvidence,
  MANIFEST_PATH,
  normativeRegistryDigest,
  readCanonicalJson,
  readManifest,
  reconcileGroupEvidence,
  REFERENCE_EVIDENCE_URI,
  REFERENCE_NATIVE_PROFILE,
  reproducibilityDiagnostics,
  requirementEvidenceInputs,
  sha256,
  validateAssessmentManifest,
  validateIndependentAssessmentArtifact,
  validatePortableEvidenceArtifact,
  validatePortableReportEvidenceBinding,
} from "./support/conformance-support.mjs";
import { validateJsonSchema } from "../tools/json-schema-validator.mjs";

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function externalAssessmentManifest(normativeManifest) {
  const manifest = structuredClone(normativeManifest);
  const sourceInventory = [{
    path: "portable-target/src/memoryos.example",
    kind: "file",
    sha256: sha256(Buffer.from("portable MemoryOS implementation source", "utf8")),
  }];
  const implementation = {
    name: "Portable MemoryOS Implementation",
    version: "2.3.4",
    revision: "portable-release-revision-42",
  };
  manifest.implementation = { ...implementation, sourceInventory };
  const groupById = new Map(manifest.evidenceGroups.map((group, index) => {
    const source = `portable-target/tests/${group.id.toLowerCase()}.checks`;
    const inputInventory = [{
      path: source,
      kind: "file",
      sha256: sha256(Buffer.from(`portable evidence source ${group.id}`, "utf8")),
    }];
    Object.assign(group, {
      implementation,
      method: "portable deterministic conformance adapter",
      inputs: [source],
      inputInventory,
      expectedOutcome: "The assessment-specific selectors resolve to passing portable target checks.",
      durableEvidence: `portable-evidence.json#/evidence/${index}`,
      command: `portable-adapter --group ${group.id}`,
    });
    return [group.id, { group, source }];
  }));
  for (const requirement of manifest.requirements) {
    if (requirement.verification !== "automated") {
      requirement.executionReferences = [];
      requirement.coverageSelectors = [];
      continue;
    }
    if (["CCA-MOS-MIP-001", "CCA-MOS-RT-001"].includes(requirement.id)) continue;
    const { source } = groupById.get(requirement.evidenceGroups[0]);
    const executionReference = requirement.id === "CCA-MOS-CONF-003"
      ? "reproducibility-meta"
      : `portable-${requirement.evidenceGroups[0].toLowerCase()}`;
    requirement.executionReferences = [executionReference];
    requirement.coverageSelectors = [{
      executionReference,
      source,
      selector: `${requirement.id}: portable implementation criterion`,
    }];
  }
  for (const [wrapperId, prefix] of [["CCA-MOS-MIP-001", "CCA-MIP-"], ["CCA-MOS-RT-001", "CCA-RF-"]]) {
    const wrapper = manifest.requirements.find(({ id }) => id === wrapperId);
    wrapper.coverageSelectors = [];
    wrapper.executionReferences = [...new Set(
      manifest.requirements
        .filter(({ id, verification }) => id.startsWith(prefix) && verification === "automated")
        .flatMap(({ executionReferences }) => executionReferences),
    )].sort(compare);
  }
  for (const group of manifest.evidenceGroups) {
    group.executionReferences = [...new Set(
      manifest.requirements
        .filter(({ evidenceGroups }) => evidenceGroups.includes(group.id))
        .flatMap(({ executionReferences }) => executionReferences),
    )].sort(compare);
  }
  return manifest;
}

function portableExecutions(manifest) {
  const identifiers = [...new Set(
    manifest.requirements.flatMap(({ executionReferences }) => executionReferences),
  )].sort(compare);
  return identifiers.map((id) => {
    const bindings = [...new Map(
      manifest.requirements
        .flatMap(({ coverageSelectors }) => coverageSelectors)
        .filter(({ executionReference }) => executionReference === id)
        .map(({ source, selector }) => [`${source}\0${selector}`, { source, selector }]),
    ).values()].sort((left, right) => compare(
      `${left.source}\0${left.selector}`,
      `${right.source}\0${right.selector}`,
    ));
    const rawChecks = [...new Set(bindings.map(({ selector }) => selector))]
      .sort(compare)
      .map((selector) => ({ selector, status: "PASS" }));
    const inputInventory = [...new Map(
      manifest.evidenceGroups
        .filter(({ executionReferences }) => executionReferences.includes(id))
        .flatMap(({ inputInventory: records }) => records)
        .map((record) => [record.path, record]),
    ).values()].sort((left, right) => compare(left.path, right.path));
    return {
      id,
      command: `portable conformance adapter ${id}`,
      executablePath: `portable-target/bin/${id}`,
      executableDigest: sha256(Buffer.from(`portable executable ${id}`, "utf8")),
      argv: ["--conformance"],
      cwd: "portable-target",
      environment: {},
      inputInventory,
      inputDigest: sha256(Buffer.from(canonicalJson(inputInventory), "utf8")),
      stdoutDigest: sha256(Buffer.from(`portable output ${id}`, "utf8")),
      stderrDigest: sha256(Buffer.alloc(0)),
      expectedTests: rawChecks.length,
      allowedSkips: [],
      rawChecks,
      tests: rawChecks.length,
      pass: rawChecks.length,
      skipped: 0,
      fail: 0,
      checks: bindings.map((binding) => ({ ...binding, status: "PASS" })),
      diagnostics: [],
      status: "PASS",
      exitCode: 0,
    };
  });
}

function portableNativeBuildAttestation(manifest, sourceInventory, executions) {
  const nativeExecutions = executions
    .filter(({ id }) => id !== "reproducibility-meta")
    .slice(0, 2);
  assert.equal(nativeExecutions.length, 2);
  const executionInputs = manifest.evidenceGroups
    .filter(({ executionReferences }) => (
      executionReferences.some((identifier) => nativeExecutions.some(({ id }) => id === identifier))
    ))
    .flatMap(({ inputInventory }) => inputInventory);
  const buildInputInventory = [...new Map(
    [...sourceInventory, ...executionInputs].map((record) => [record.path, record]),
  ).values()].sort((left, right) => compare(left.path, right.path));
  const resourceInventory = [{
    path: "portable-toolchain.resource",
    sha256: sha256(Buffer.from("portable toolchain resource", "utf8")),
  }];
  return {
    sourceRevision: sha256(Buffer.from(canonicalJson(sourceInventory), "utf8")),
    buildInputInventory,
    buildInputDigest: sha256(Buffer.from(canonicalJson(buildInputInventory), "utf8")),
    tools: [{
      role: "portable-compiler",
      path: "portable-target/toolchain/compiler",
      sha256: sha256(Buffer.from("portable compiler", "utf8")),
      version: "1.0",
    }],
    dependencies: [],
    resources: [{
      role: "portable-toolchain-resources",
      root: "portable-target/toolchain/resources",
      inventory: resourceInventory,
      sha256: sha256(Buffer.from(canonicalJson(resourceInventory), "utf8")),
    }],
    buildDirectory: "portable-target/build",
    configures: ["portable-runtime", "portable-sdk"].map((project) => ({
      project,
      argv: ["configure", project],
      cwd: "portable-target",
      stdoutDigest: sha256(Buffer.from(`configured ${project}`, "utf8")),
      stderrDigest: sha256(Buffer.alloc(0)),
      exitCode: 0,
    })),
    builds: ["portable-runtime", "portable-sdk"].map((project) => ({
      project,
      argv: ["build", project],
      cwd: "portable-target",
      stdoutDigest: sha256(Buffer.from(`built ${project}`, "utf8")),
      stderrDigest: sha256(Buffer.alloc(0)),
      exitCode: 0,
    })),
    configurationArtifacts: ["portable-runtime", "portable-sdk"].map((project) => ({
      role: `${project}-build-graph`,
      path: `portable-target/build/${project}/graph`,
      sha256: sha256(Buffer.from(`portable build graph ${project}`, "utf8")),
    })),
    targets: nativeExecutions.map(({ id }) => id),
    artifacts: nativeExecutions.map((execution) => ({
      role: execution.id,
      path: execution.executablePath,
      sha256: execution.executableDigest,
    })),
  };
}

function reproducibleExecutionProjection(execution) {
  const { environment: ignored, ...projection } = execution;
  return projection;
}

function portableFixture(manifest) {
  const sourceInventory = manifest.implementation.sourceInventory;
  const implementationRevisionDigest = sha256(Buffer.from(canonicalJson(sourceInventory), "utf8"));
  const { sourceInventory: ignored, ...implementation } = manifest.implementation;
  const assessor = "Portable conformance team";
  const assessmentDate = "2026-09-05";
  const reviewRecordId = "portable-review-1";
  const executions = portableExecutions(manifest);
  const primaryExecutions = executions.filter(({ id }) => id !== "reproducibility-meta");
  const variantEnvironment = { LANG: "tr_TR.UTF-8", TZ: "Pacific/Kiritimati" };
  const variantExecutions = primaryExecutions.map((execution) => ({
    ...structuredClone(execution),
    environment: { ...execution.environment, ...variantEnvironment },
  }));
  const reproducibilityMeta = executions.find(({ id }) => id === "reproducibility-meta");
  assert.ok(reproducibilityMeta);
  reproducibilityMeta.stdoutDigest = sha256(Buffer.from(canonicalJson({
    primaryExecutions: primaryExecutions.map(reproducibleExecutionProjection),
    variantExecutions: variantExecutions.map(reproducibleExecutionProjection),
  }), "utf8"));
  const reproducibility = { variantEnvironment, executions: variantExecutions };
  let evidence = executedGroupEvidence(manifest, executions);
  const reviews = manifest.requirements
    .filter(({ verification }) => verification !== "automated")
    .map((requirement, index) => ({
      requirementId: requirement.id,
      implementation,
      artifacts: requirementEvidenceInputs(requirement, manifest),
      criterion: requirement.statement,
      observedOutcome: "The independent portable fixture review criterion passed.",
      reviewer: assessor,
      date: assessmentDate,
      reviewRecordId,
      implementationRevisionDigest,
      result: "PASS",
      durableEvidence: `portable-review.json#/attestations/${index}`,
    }));
  const requirementEvidence = buildRequirementEvidence(
    manifest,
    evidence,
    reviews,
    executions,
    "portable-evidence.json",
  );
  evidence = reconcileGroupEvidence(evidence, requirementEvidence);
  const reviewArtifact = {
    schemaVersion: "1.0",
    implementation,
    implementationRevisionDigest,
    reviewRecordId,
    reviewer: assessor,
    assessmentDate,
    attestations: reviews,
  };
  const evidenceArtifact = {
    schemaVersion: "1.0",
    implementation,
    nativeProjectionProfile: REFERENCE_NATIVE_PROFILE,
    sourceInventory,
    reviewEvidence: {
      path: "portable-review.json",
      sha256: sha256(Buffer.from(`${canonicalJson(reviewArtifact)}\n`, "utf8")),
      reviewRecordId,
      implementationRevisionDigest,
    },
    assessor,
    assessmentDate,
    executionEnvironment: { platform: "portable-fixture" },
    nativeBuildAttestation: portableNativeBuildAttestation(manifest, sourceInventory, executions),
    reproducibility,
    executions,
    evidence,
    reviews,
    requirementEvidence,
  };
  const evidenceBytes = Buffer.from(`${canonicalJson(evidenceArtifact)}\n`, "utf8");
  const sourceReport = buildReport(manifest, evidence, implementation, {
    assessor,
    date: assessmentDate,
    evidenceRoot: "portable-evidence.json",
    evidenceDigest: sha256(evidenceBytes),
    nativeProjectionProfile: REFERENCE_NATIVE_PROFILE,
    requirementEvidence,
  });
  return { evidenceArtifact, reviewArtifact, sourceReport };
}

function rebuildPortableEvidence(manifest, artifact) {
  let evidence = executedGroupEvidence(manifest, artifact.executions);
  artifact.requirementEvidence = buildRequirementEvidence(
    manifest,
    evidence,
    artifact.reviews,
    artifact.executions,
    "portable-evidence.json",
  );
  artifact.evidence = reconcileGroupEvidence(evidence, artifact.requirementEvidence);
  return artifact;
}

function assertPortableC1(manifest, normativeManifest, artifact) {
  validatePortableEvidenceArtifact(artifact, manifest, normativeManifest);
  const evidenceBytes = Buffer.from(`${canonicalJson(artifact)}\n`, "utf8");
  const report = buildReport(manifest, artifact.evidence, artifact.implementation, {
    assessor: artifact.assessor,
    date: artifact.assessmentDate,
    evidenceRoot: "portable-evidence.json",
    evidenceDigest: sha256(evidenceBytes),
    nativeProjectionProfile: artifact.nativeProjectionProfile,
    requirementEvidence: artifact.requirementEvidence,
  });
  const reportBytes = Buffer.from(`${canonicalJson(report)}\n`, "utf8");
  validatePortableReportEvidenceBinding(
    report,
    reportBytes,
    artifact,
    evidenceBytes,
    manifest,
    null,
    normativeManifest,
  );
  assert.equal(report.assessmentLevel, "C1");
  assert.equal(report.results.length, 218);
  assert.ok(report.summary.fail > 0);
  return report;
}

test("portable C3 assessments bind exact evidence, identities, scope, and all requirement results", async () => {
  const normativeManifest = await readManifest();
  const manifest = externalAssessmentManifest(normativeManifest);
  validateAssessmentManifest(manifest, normativeManifest);
  await validateJsonSchema(
    manifest,
    new URL("../schema/requirements-manifest-1.0.schema.json", import.meta.url),
  );
  assert.equal(manifest.implementation.name, "Portable MemoryOS Implementation");
  assert.notDeepEqual(
    manifest.requirements.find(({ id }) => id === "CCA-MOS-CORE-011").coverageSelectors,
    normativeManifest.requirements.find(({ id }) => id === "CCA-MOS-CORE-011").coverageSelectors,
  );
  const corruptedRegistry = structuredClone(manifest);
  corruptedRegistry.requirements.find(({ id }) => id === "CCA-MOS-COMP-005").statement += " Corrupted.";
  corruptedRegistry.normativeRegistryDigest = normativeRegistryDigest(corruptedRegistry);
  assert.throws(
    () => validateAssessmentManifest(corruptedRegistry, normativeManifest),
    /normative (?:requirement )?registry/u,
  );
  const corruptedApplicability = structuredClone(manifest);
  const adapter = corruptedApplicability.conformanceProfiles.profiles
    .find(({ name }) => name === "AI Runtime Adapter");
  const cli = corruptedApplicability.conformanceProfiles.profiles.find(({ name }) => name === "CLI");
  [adapter.evidenceGroups, cli.evidenceGroups] = [cli.evidenceGroups, adapter.evidenceGroups];
  corruptedApplicability.normativeRegistryDigest = normativeRegistryDigest(corruptedApplicability);
  assert.throws(
    () => validateAssessmentManifest(corruptedApplicability, normativeManifest),
    /normative registry digest|profile applicability/u,
  );
  const corruptedGroupCoverage = structuredClone(manifest);
  const compRequirement = corruptedGroupCoverage.requirements
    .find(({ id }) => id === "CCA-MOS-COMP-005");
  const confRequirement = corruptedGroupCoverage.requirements
    .find(({ id }) => id === "CCA-MOS-CONF-006");
  [compRequirement.evidenceGroups, confRequirement.evidenceGroups] = [
    confRequirement.evidenceGroups,
    compRequirement.evidenceGroups,
  ];
  for (const group of corruptedGroupCoverage.evidenceGroups) {
    group.requirementIds = corruptedGroupCoverage.requirements
      .filter(({ evidenceGroups }) => evidenceGroups.includes(group.id))
      .map(({ id }) => id);
  }
  corruptedGroupCoverage.normativeRegistryDigest = normativeRegistryDigest(corruptedGroupCoverage);
  assert.throws(
    () => validateAssessmentManifest(corruptedGroupCoverage, normativeManifest),
    /normative registry digest|normative requirement registry|evidence-group coverage/u,
  );
  const { evidenceArtifact, reviewArtifact, sourceReport } = portableFixture(manifest);
  const evidenceBytes = Buffer.from(`${canonicalJson(evidenceArtifact)}\n`, "utf8");
  await validateJsonSchema(
    reviewArtifact,
    new URL("../schema/review-attestations-1.0.schema.json", import.meta.url),
  );
  await validateJsonSchema(
    evidenceArtifact,
    new URL("../schema/conformance-evidence-1.0.schema.json", import.meta.url),
  );
  await validateJsonSchema(
    sourceReport,
    new URL("../schema/conformance-report-1.0.schema.json", import.meta.url),
  );
  validatePortableEvidenceArtifact(evidenceArtifact, manifest, normativeManifest);

  const failedEvidenceArtifact = structuredClone(evidenceArtifact);
  const failedExecution = failedEvidenceArtifact.executions[0];
  const failedSelector = failedExecution.rawChecks[0].selector;
  failedExecution.rawChecks[0].status = "FAIL";
  failedExecution.checks
    .filter(({ selector }) => selector === failedSelector)
    .forEach((check) => { check.status = "FAIL"; });
  failedExecution.pass -= 1;
  failedExecution.fail += 1;
  failedExecution.status = "FAIL";
  failedExecution.exitCode = 1;
  failedExecution.diagnostics = ["one or more target checks failed", "target process exited 1"];
  const failedVariantIndex = failedEvidenceArtifact.reproducibility.executions
    .findIndex(({ id }) => id === failedExecution.id);
  const failedVariantEnvironment = failedEvidenceArtifact.reproducibility
    .executions[failedVariantIndex].environment;
  failedEvidenceArtifact.reproducibility.executions[failedVariantIndex] = {
    ...structuredClone(failedExecution),
    environment: failedVariantEnvironment,
  };
  const failedPrimaryExecutions = failedEvidenceArtifact.executions
    .filter(({ id }) => id !== "reproducibility-meta");
  const failedReproducibilityMeta = failedEvidenceArtifact.executions
    .find(({ id }) => id === "reproducibility-meta");
  failedReproducibilityMeta.stdoutDigest = sha256(Buffer.from(canonicalJson({
    primaryExecutions: failedPrimaryExecutions.map(reproducibleExecutionProjection),
    variantExecutions: failedEvidenceArtifact.reproducibility.executions
      .map(reproducibleExecutionProjection),
  }), "utf8"));
  failedEvidenceArtifact.evidence = executedGroupEvidence(
    manifest,
    failedEvidenceArtifact.executions,
  );
  failedEvidenceArtifact.requirementEvidence = buildRequirementEvidence(
    manifest,
    failedEvidenceArtifact.evidence,
    failedEvidenceArtifact.reviews,
    failedEvidenceArtifact.executions,
    "portable-evidence.json",
  );
  failedEvidenceArtifact.evidence = reconcileGroupEvidence(
    failedEvidenceArtifact.evidence,
    failedEvidenceArtifact.requirementEvidence,
  );
  validatePortableEvidenceArtifact(failedEvidenceArtifact, manifest, normativeManifest);
  const failedEvidenceBytes = Buffer.from(`${canonicalJson(failedEvidenceArtifact)}\n`, "utf8");
  const failedReport = buildReport(
    manifest,
    failedEvidenceArtifact.evidence,
    failedEvidenceArtifact.implementation,
    {
      assessor: failedEvidenceArtifact.assessor,
      date: failedEvidenceArtifact.assessmentDate,
      evidenceRoot: "portable-evidence.json",
      evidenceDigest: sha256(failedEvidenceBytes),
      nativeProjectionProfile: failedEvidenceArtifact.nativeProjectionProfile,
      requirementEvidence: failedEvidenceArtifact.requirementEvidence,
    },
  );
  const failedReportBytes = Buffer.from(`${canonicalJson(failedReport)}\n`, "utf8");
  validatePortableReportEvidenceBinding(
    failedReport,
    failedReportBytes,
    failedEvidenceArtifact,
    failedEvidenceBytes,
    manifest,
    null,
    normativeManifest,
  );
  await validateJsonSchema(
    failedReport,
    new URL("../schema/conformance-report-1.0.schema.json", import.meta.url),
  );
  assert.equal(failedReport.assessmentLevel, "C1");
  assert.equal(failedReport.results.length, 218);
  assert.ok(failedReport.summary.fail > 0);
  assert.deepEqual(
    failedReport.knownFailures,
    failedReport.results.filter(({ status }) => status === "FAIL").map(({ requirementId }) => requirementId),
  );
  assert.throws(
    () => buildIndependentAssessmentArtifact(
      failedReport,
      failedEvidenceBytes,
      manifest,
      { assessor: "Independent MemoryOS assessor", date: "2026-09-05", method: "reviewed" },
    ),
    /requires a C2 source report/u,
  );

  assert.throws(
    () => buildIndependentAssessmentArtifact(
      sourceReport,
      evidenceBytes,
      manifest,
      { assessor: sourceReport.assessor.name, date: "2026-09-05", method: "reviewed" },
    ),
    /must differ from the source evidence assessor/u,
  );
  assert.throws(
    () => buildIndependentAssessmentArtifact(
      sourceReport,
      evidenceBytes,
      manifest,
      { assessor: "Independent MemoryOS assessor", date: "2026-09-04", method: "reviewed" },
    ),
    /predates/u,
  );

  const assessment = buildIndependentAssessmentArtifact(
    sourceReport,
    evidenceBytes,
    manifest,
    {
      assessor: "Independent MemoryOS assessor",
      date: "2026-09-05",
      method: "reproduced",
    },
  );
  const assessmentBytes = Buffer.from(`${canonicalJson(assessment)}\n`, "utf8");
  await validateJsonSchema(
    assessment,
    new URL("../schema/independent-assessment-1.0.schema.json", import.meta.url),
  );
  const assessmentPath = "assessments/portable-memoryos-2.3.4.json";
  const report = buildIndependentC3Report(
    sourceReport,
    evidenceBytes,
    assessment,
    assessmentBytes,
    assessmentPath,
    manifest,
  );
  const reportBytes = Buffer.from(`${canonicalJson(report)}\n`, "utf8");
  await validateJsonSchema(
    report,
    new URL("../schema/conformance-report-1.0.schema.json", import.meta.url),
  );
  validatePortableReportEvidenceBinding(
    report,
    reportBytes,
    evidenceArtifact,
    evidenceBytes,
    manifest,
    { artifact: assessment, bytes: assessmentBytes, path: assessmentPath },
    normativeManifest,
  );
  assert.equal(report.assessmentLevel, "C3");
  assert.equal(report.results.length, 218);
  assert.equal(report.results.every(({ status }) => status === "PASS"), true);

  const selfAssessment = structuredClone(assessment);
  selfAssessment.assessor.name = selfAssessment.sourceAssessment.assessor.name;
  const selfAssessedReport = structuredClone(report);
  selfAssessedReport.assessor = structuredClone(selfAssessment.assessor);
  assert.throws(
    () => validateIndependentAssessmentArtifact(
      selfAssessment,
      selfAssessedReport,
      evidenceBytes,
      manifest,
      normativeManifest,
    ),
    /must differ from the source evidence assessor/u,
  );
  const relabeledSourceAssessment = structuredClone(assessment);
  relabeledSourceAssessment.sourceAssessment.assessmentLevel = "C1";
  assert.throws(
    () => validateIndependentAssessmentArtifact(
      relabeledSourceAssessment,
      report,
      evidenceBytes,
      manifest,
      normativeManifest,
    ),
    /strictly equal|C2/u,
  );
  const temporallyInvalidAssessment = structuredClone(assessment);
  temporallyInvalidAssessment.sourceAssessment.assessmentDate = "2026-09-06";
  assert.throws(
    () => validateIndependentAssessmentArtifact(
      temporallyInvalidAssessment,
      report,
      evidenceBytes,
      manifest,
      normativeManifest,
    ),
    /predates/u,
  );

  const wrongSuite = structuredClone(sourceReport);
  wrongSuite.conformance.suiteVersion = "9.9.9";
  assert.throws(
    () => validatePortableReportEvidenceBinding(
      wrongSuite,
      Buffer.from(`${canonicalJson(wrongSuite)}\n`, "utf8"),
      evidenceArtifact,
      evidenceBytes,
      manifest,
      null,
      normativeManifest,
    ),
    /suite identifier\/version pair differs|strictly equal/u,
  );
  const earlyReportAssessment = {
    assessor: evidenceArtifact.assessor,
    date: "2026-09-04",
    evidenceRoot: "portable-evidence.json",
    evidenceDigest: sha256(evidenceBytes),
    nativeProjectionProfile: evidenceArtifact.nativeProjectionProfile,
    requirementEvidence: evidenceArtifact.requirementEvidence,
  };
  assert.throws(
    () => buildReport(manifest, evidenceArtifact.evidence, evidenceArtifact.implementation, earlyReportAssessment),
    /predates/u,
  );

  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "memoryos-portable-report-"));
  try {
    const manifestPath = resolve(temporaryRoot, "assessment-manifest.json");
    const evidencePath = resolve(temporaryRoot, "evidence.json");
    const reportPath = resolve(temporaryRoot, "report.json");
    const malformedManifestPath = resolve(temporaryRoot, "malformed-manifest.json");
    await writeFile(manifestPath, `${canonicalJson(manifest)}\n`, "utf8");
    await writeFile(evidencePath, evidenceBytes);
    const malformedManifestBytes = Buffer.from(`${canonicalJson(manifest)}\n`, "utf8");
    malformedManifestBytes[1] = 0xff;
    await writeFile(malformedManifestPath, malformedManifestBytes);
    await assert.rejects(
      readCanonicalJson(malformedManifestPath),
      undefined,
      "malformed UTF-8 manifest bytes must fail closed",
    );
    const portableReport = fileURLToPath(new URL("../tools/portable-report.mjs", import.meta.url));
    const common = [
      "--manifest", manifestPath,
      "--normative-manifest", MANIFEST_PATH,
      "--evidence", evidencePath,
      "--evidence-reference", "portable-evidence.json",
    ];
    const created = spawnSync(process.execPath, [
      portableReport,
      "create",
      ...common,
      "--output", reportPath,
      "--profiles", "complete",
    ], { encoding: "utf8", windowsHide: true });
    assert.equal(created.status, 0, created.stderr);
    const createdReport = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(createdReport.assessmentLevel, "C2");
    const validated = spawnSync(process.execPath, [
      portableReport,
      "validate",
      ...common,
      "--report", reportPath,
    ], { encoding: "utf8", windowsHide: true });
    assert.equal(validated.status, 0, validated.stderr);
    const overwrite = spawnSync(process.execPath, [
      portableReport,
      "create",
      ...common,
      "--output", reportPath,
      "--profiles", "complete",
    ], { encoding: "utf8", windowsHide: true });
    assert.notEqual(overwrite.status, 0, "portable report publication must reject overwrite");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  const substitutedEvidence = structuredClone(evidenceArtifact);
  substitutedEvidence.requirementEvidence
    .find(({ requirementId }) => requirementId === "CCA-MOS-CORE-011")
    .coverageSelectors[0].selector = "claimant-selected substitute";
  const substitutedBytes = Buffer.from(`${canonicalJson(substitutedEvidence)}\n`, "utf8");
  assert.throws(
    () => validatePortableReportEvidenceBinding(
      report,
      reportBytes,
      substitutedEvidence,
      substitutedBytes,
      manifest,
      { artifact: assessment, bytes: assessmentBytes, path: assessmentPath },
      normativeManifest,
    ),
    /coverageSelectors|deep-equal/u,
  );
  const wrongInputs = structuredClone(evidenceArtifact);
  wrongInputs.executions[0].inputInventory[0].sha256 = `sha256:${"a".repeat(64)}`;
  wrongInputs.executions[0].inputDigest = sha256(Buffer.from(
    canonicalJson(wrongInputs.executions[0].inputInventory),
    "utf8",
  ));
  assert.throws(
    () => validatePortableEvidenceArtifact(wrongInputs, manifest, normativeManifest),
    /inputs differ from the supplied assessment manifest/u,
  );
  const wrongSourceInventory = structuredClone(evidenceArtifact);
  wrongSourceInventory.sourceInventory[0].path = "portable-target/src/substituted.example";
  assert.throws(
    () => validatePortableEvidenceArtifact(wrongSourceInventory, manifest, normativeManifest),
    /source inventory differs from the supplied assessment manifest/u,
  );
  const earlyEvidence = structuredClone(evidenceArtifact);
  earlyEvidence.assessmentDate = "2026-09-04";
  assert.throws(
    () => validatePortableEvidenceArtifact(earlyEvidence, manifest, normativeManifest),
    /predates/u,
  );
  const alternateEvidence = structuredClone(evidenceArtifact);
  alternateEvidence.executionEnvironment.platform = "portable-fixture-alternate";
  validatePortableEvidenceArtifact(alternateEvidence, manifest, normativeManifest);
  const alternateEvidenceBytes = Buffer.from(`${canonicalJson(alternateEvidence)}\n`, "utf8");
  assert.throws(
    () => validatePortableReportEvidenceBinding(
      sourceReport,
      Buffer.from(`${canonicalJson(sourceReport)}\n`, "utf8"),
      alternateEvidence,
      alternateEvidenceBytes,
      manifest,
      null,
      normativeManifest,
    ),
    /report evidence digest differs/u,
  );
  const forgedReproducibility = structuredClone(evidenceArtifact);
  forgedReproducibility.reproducibility.executions[0].stdoutDigest = `sha256:${"c".repeat(64)}`;
  assert.throws(
    () => validatePortableEvidenceArtifact(forgedReproducibility, manifest, normativeManifest),
    /changed under the retained reproducibility environment|strictly equal/u,
  );
  const forgedCounters = structuredClone(evidenceArtifact);
  forgedCounters.executions[0].rawChecks[0].status = "FAIL";
  assert.throws(
    () => validatePortableEvidenceArtifact(forgedCounters, manifest, normativeManifest),
    /rawChecks|strictly equal|attributed check/u,
  );
  const unrelatedBuildInput = structuredClone(evidenceArtifact);
  unrelatedBuildInput.nativeBuildAttestation.buildInputInventory.push({
    path: "portable-target/unrelated.input",
    kind: "file",
    sha256: `sha256:${"b".repeat(64)}`,
  });
  unrelatedBuildInput.nativeBuildAttestation.buildInputInventory.sort((left, right) => compare(left.path, right.path));
  unrelatedBuildInput.nativeBuildAttestation.buildInputDigest = sha256(Buffer.from(
    canonicalJson(unrelatedBuildInput.nativeBuildAttestation.buildInputInventory),
    "utf8",
  ));
  assert.throws(
    () => validatePortableEvidenceArtifact(unrelatedBuildInput, manifest, normativeManifest),
    /build inputs differ/u,
  );
  const unresolvedReview = structuredClone(evidenceArtifact);
  unresolvedReview.reviews[0].durableEvidence = "portable-review.json#/attestations/999";
  const reviewRequirement = unresolvedReview.requirementEvidence
    .find(({ requirementId }) => requirementId === unresolvedReview.reviews[0].requirementId);
  reviewRequirement.evidenceReferences = [unresolvedReview.reviews[0].durableEvidence];
  const embeddedReview = {
    schemaVersion: "1.0",
    implementation: unresolvedReview.implementation,
    implementationRevisionDigest: unresolvedReview.reviewEvidence.implementationRevisionDigest,
    reviewRecordId: unresolvedReview.reviewEvidence.reviewRecordId,
    reviewer: unresolvedReview.assessor,
    assessmentDate: unresolvedReview.assessmentDate,
    attestations: unresolvedReview.reviews,
  };
  unresolvedReview.reviewEvidence.sha256 = sha256(Buffer.from(`${canonicalJson(embeddedReview)}\n`, "utf8"));
  assert.throws(
    () => validatePortableEvidenceArtifact(unresolvedReview, manifest, normativeManifest),
    /does not resolve to the digest-bound review artifact/u,
  );

  assert.throws(
    () => validatePortableReportEvidenceBinding(
      report,
      reportBytes,
      evidenceArtifact,
      evidenceBytes,
      manifest,
      null,
      normativeManifest,
    ),
    /requires supplied independent assessment/u,
  );
  const wrongEvidenceRoot = structuredClone(sourceReport);
  wrongEvidenceRoot.evidenceRoot = "unbound-evidence.json";
  assert.throws(
    () => validatePortableReportEvidenceBinding(
      wrongEvidenceRoot,
      `${canonicalJson(wrongEvidenceRoot)}\n`,
      evidenceArtifact,
      evidenceBytes,
      manifest,
      null,
      normativeManifest,
    ),
    /durable evidence does not resolve under the report evidence root/u,
  );
  const relabeled = structuredClone(assessment);
  relabeled.implementation.version = "9.9.9";
  const relabeledBytes = Buffer.from(`${canonicalJson(relabeled)}\n`, "utf8");
  const relabeledReport = structuredClone(report);
  relabeledReport.independentAssessment.sha256 = sha256(relabeledBytes);
  const relabeledReportBytes = Buffer.from(`${canonicalJson(relabeledReport)}\n`, "utf8");
  assert.throws(
    () => validatePortableReportEvidenceBinding(
      relabeledReport,
      relabeledReportBytes,
      evidenceArtifact,
      evidenceBytes,
      manifest,
      { artifact: relabeled, bytes: relabeledBytes, path: assessmentPath },
      normativeManifest,
    ),
    /Expected values to be strictly deep-equal/u,
  );
  const nonIndependent = structuredClone(assessment);
  nonIndependent.assessor.independent = false;
  await assert.rejects(
    validateJsonSchema(
      nonIndependent,
      new URL("../schema/independent-assessment-1.0.schema.json", import.meta.url),
    ),
    /const differs/u,
  );
  assert.throws(
    () => validatePortableReportEvidenceBinding(
      report,
      `${JSON.stringify(report, null, 2)}\n`,
      evidenceArtifact,
      evidenceBytes,
      manifest,
      { artifact: assessment, bytes: assessmentBytes, path: assessmentPath },
      normativeManifest,
    ),
    /exact canonical UTF-8 JSON bytes/u,
  );
  for (const [label, artifact, bytes, suppliedAssessment] of [
    ["report", report, Buffer.from(`${canonicalJson(report)}\n`, "utf8"), { artifact: assessment, bytes: assessmentBytes, path: assessmentPath }],
    ["evidence", evidenceArtifact, Buffer.from(`${canonicalJson(evidenceArtifact)}\n`, "utf8"), { artifact: assessment, bytes: assessmentBytes, path: assessmentPath }],
    ["assessment", assessment, Buffer.from(`${canonicalJson(assessment)}\n`, "utf8"), { artifact: assessment, bytes: Buffer.from(`${canonicalJson(assessment)}\n`, "utf8"), path: assessmentPath }],
  ]) {
    bytes[1] = 0xff;
    const reportBytesValue = label === "report" ? bytes : Buffer.from(`${canonicalJson(report)}\n`, "utf8");
    const evidenceBytesValue = label === "evidence" ? bytes : evidenceBytes;
    const independent = label === "assessment" ? { ...suppliedAssessment, bytes } : suppliedAssessment;
    assert.throws(
      () => validatePortableReportEvidenceBinding(
        report,
        reportBytesValue,
        evidenceArtifact,
        evidenceBytesValue,
        manifest,
        independent,
        normativeManifest,
      ),
      undefined,
      `malformed UTF-8 ${label} bytes must fail closed`,
    );
  }
});

test("portable C1 retains no-parseable-test and dual native build failures", async () => {
  const normativeManifest = await readManifest();
  const manifest = externalAssessmentManifest(normativeManifest);
  const base = portableFixture(manifest).evidenceArtifact;

  const irreproducible = structuredClone(base);
  const primaryExecutions = irreproducible.executions.filter(({ id }) => id !== "reproducibility-meta");
  irreproducible.reproducibility.executions[0].stdoutDigest = sha256(Buffer.from(
    "deliberately changed output under irrelevant environment variation",
    "utf8",
  ));
  const reproducibilityMeta = irreproducible.executions.find(({ id }) => id === "reproducibility-meta");
  assert.ok(reproducibilityMeta);
  reproducibilityMeta.rawChecks.forEach((check) => { check.status = "FAIL"; });
  reproducibilityMeta.checks.forEach((check) => { check.status = "FAIL"; });
  reproducibilityMeta.pass = 0;
  reproducibilityMeta.skipped = 0;
  reproducibilityMeta.fail = reproducibilityMeta.rawChecks.length;
  reproducibilityMeta.status = "FAIL";
  reproducibilityMeta.exitCode = 0;
  reproducibilityMeta.diagnostics = reproducibilityDiagnostics(
    primaryExecutions,
    irreproducible.reproducibility.executions,
  );
  reproducibilityMeta.stdoutDigest = sha256(Buffer.from(canonicalJson({
    primaryExecutions: primaryExecutions.map(reproducibleExecutionProjection),
    variantExecutions: irreproducible.reproducibility.executions.map(reproducibleExecutionProjection),
  }), "utf8"));
  rebuildPortableEvidence(manifest, irreproducible);
  const irreproducibleReport = assertPortableC1(manifest, normativeManifest, irreproducible);
  assert.equal(
    irreproducibleReport.results.find(({ requirementId }) => requirementId === "CCA-MOS-CONF-003").status,
    "FAIL",
  );

  const noCases = structuredClone(base);
  delete noCases.reproducibility;
  const noCasesExecution = noCases.executions.find(({ id }) => id !== "reproducibility-meta");
  assert.ok(noCasesExecution);
  noCasesExecution.rawChecks = [];
  noCasesExecution.checks = [];
  noCasesExecution.tests = 0;
  noCasesExecution.pass = 0;
  noCasesExecution.skipped = 0;
  noCasesExecution.fail = 0;
  noCasesExecution.status = "FAIL";
  noCasesExecution.exitCode = 0;
  noCasesExecution.diagnostics = [
    `expected ${noCasesExecution.expectedTests} tests, observed 0`,
    "target process produced no parseable test cases",
  ];
  rebuildPortableEvidence(manifest, noCases);
  assertPortableC1(manifest, normativeManifest, noCases);

  const failedBuild = structuredClone(base);
  delete failedBuild.reproducibility;
  const builtArtifacts = [...failedBuild.nativeBuildAttestation.artifacts];
  const tool = failedBuild.nativeBuildAttestation.tools[0];
  for (const [index, built] of builtArtifacts.entries()) {
    const configure = failedBuild.nativeBuildAttestation.configures[index];
    const build = failedBuild.nativeBuildAttestation.builds[index];
    configure.exitCode = 1;
    build.exitCode = 1;
    const execution = failedBuild.executions.find(({ id }) => id === built.role);
    assert.ok(execution);
    Object.assign(execution, {
      executablePath: tool.path,
      executableDigest: tool.sha256,
      argv: build.argv,
      cwd: build.cwd,
      stdoutDigest: build.stdoutDigest,
      stderrDigest: build.stderrDigest,
      rawChecks: [],
      tests: 0,
      pass: 0,
      skipped: 0,
      fail: 0,
      checks: [],
      diagnostics: [
        `suite-controlled ${build.project} target did not produce its test executable`,
        "target process produced no parseable test cases",
      ],
      status: "FAIL",
      exitCode: 1,
    });
  }
  failedBuild.nativeBuildAttestation.configurationArtifacts = [];
  failedBuild.nativeBuildAttestation.artifacts = [];
  rebuildPortableEvidence(manifest, failedBuild);
  const buildFailureReport = assertPortableC1(manifest, normativeManifest, failedBuild);
  assert.ok(
    builtArtifacts.every(({ role }) => buildFailureReport.results.some((result) => (
      result.status === "FAIL"
      && manifest.requirements.find(({ id }) => id === result.requirementId)
        .executionReferences.includes(role)
    ))),
  );
});
