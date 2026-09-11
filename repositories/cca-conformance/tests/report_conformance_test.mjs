import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  REFERENCE_REPORT_PATH,
  REFERENCE_EVIDENCE_PATH,
  REFERENCE_REVIEW_PATH,
  buildReport,
  buildRequirementEvidence,
  canonicalJson,
  executedGroupEvidence,
  readCanonicalJson,
  readManifest,
  reconcileGroupEvidence,
  reproducibilityDiagnostics,
  reportMarkdown,
  serializeReport,
  sha256,
  validateEvidenceArtifact,
  validateReport,
  validateReportEvidenceBinding,
} from "./support/conformance-support.mjs";
import { validateJsonSchema } from "../tools/json-schema-validator.mjs";

const reportPath = process.env.MEMORYOS_CONFORMANCE_REPORT
  ? resolve(process.env.MEMORYOS_CONFORMANCE_REPORT)
  : REFERENCE_REPORT_PATH;
const evidencePath = process.env.MEMORYOS_CONFORMANCE_EVIDENCE
  ? resolve(process.env.MEMORYOS_CONFORMANCE_EVIDENCE)
  : REFERENCE_EVIDENCE_PATH;
const markdownPath = process.env.MEMORYOS_CONFORMANCE_MARKDOWN
  ? resolve(process.env.MEMORYOS_CONFORMANCE_MARKDOWN)
  : new URL("../reports/reference-implementation-1.2.1.md", import.meta.url);

function reproducibleProjection(execution) {
  const projection = structuredClone(execution);
  delete projection.environment;
  return projection;
}

async function readBoundManifest(report) {
  return readManifest(boundManifestPath(report));
}

function boundManifestPath(report) {
  return process.env.MEMORYOS_CONFORMANCE_MANIFEST
    ? resolve(process.env.MEMORYOS_CONFORMANCE_MANIFEST)
    : fileURLToPath(new URL(
      `../manifests/requirements-manifest-${report.conformance.manifestDigest.replace(":", "-")}.json`,
      import.meta.url,
    ));
}

test("the Reference Implementation report covers every normative requirement", async () => {
  const report = await readCanonicalJson(reportPath);
  const manifest = await readBoundManifest(report);
  const evidenceArtifact = await readCanonicalJson(evidencePath);
  validateEvidenceArtifact(evidenceArtifact, manifest);
  validateReport(report, manifest, evidenceArtifact.requirementEvidence);
  assert.deepEqual(report.evidence, evidenceArtifact.evidence);
  assert.deepEqual(report.implementation, evidenceArtifact.implementation);
  assert.equal(report.assessor.name, evidenceArtifact.assessor);
  assert.equal(report.assessmentDate, evidenceArtifact.assessmentDate);
  assert.equal(report.summary.total, manifest.requirements.length);
  assert.equal(report.summary.pass, manifest.requirements.length);
  assert.equal(report.summary.fail, 0);
  assert.equal(report.summary.notApplicable, 0);
  assert.equal(report.assessmentLevel, "C2");
  assert.equal(report.scope.kind, "complete");
  assert.equal(report.assessor.independent, false);
  assert.deepEqual(report.nativeProjectionProfile, {
    identifier: "cca-studio-native-observation",
    version: "1.1.0",
  });
  assert.deepEqual(
    report.results.map(({ requirementId }) => requirementId),
    manifest.requirements.map(({ id }) => id),
  );
  const reviewArtifact = await readCanonicalJson(REFERENCE_REVIEW_PATH);
  await validateJsonSchema(
    reviewArtifact,
    new URL("../schema/review-attestations-1.0.schema.json", import.meta.url),
  );
  await validateJsonSchema(
    evidenceArtifact,
    new URL("../schema/conformance-evidence-1.0.schema.json", import.meta.url),
  );
  await validateJsonSchema(
    report,
    new URL("../schema/conformance-report-1.0.schema.json", import.meta.url),
  );
});

test("checked-in JSON and Markdown reports are exact deterministic projections", async () => {
  const report = await readCanonicalJson(reportPath);
  const manifest = await readBoundManifest(report);
  const evidenceArtifact = await readCanonicalJson(evidencePath);
  const expected = buildReport(manifest, report.evidence, report.implementation, {
    assessor: report.assessor.name,
    date: report.assessmentDate,
    evidenceRoot: report.evidenceRoot,
    evidenceDigest: report.evidenceDigest,
    nativeProjectionProfile: report.nativeProjectionProfile,
    requirementEvidence: evidenceArtifact.requirementEvidence,
  });
  assert.equal(serializeReport(report), serializeReport(expected));
  const markdown = await readFile(markdownPath, "utf8");
  assert.equal(markdown, reportMarkdown(report, manifest));
  const reportBytes = await readFile(reportPath);
  const markdownBytes = await readFile(markdownPath);
  const reportTool = fileURLToPath(new URL("../tools/conformance-report.mjs", import.meta.url));
  const overwrite = spawnSync(process.execPath, [
    reportTool,
    "generate",
    resolve(evidencePath),
    resolve(reportPath),
    fileURLToPath(markdownPath),
    report.implementation.name,
    report.implementation.version,
    report.assessor.name,
    report.assessmentDate,
    report.evidenceRoot,
    report.nativeProjectionProfile.identifier,
    report.nativeProjectionProfile.version,
    boundManifestPath(report),
  ], { encoding: "utf8", windowsHide: true });
  assert.notEqual(overwrite.status, 0, "retained report publication must reject overwrite");
  assert.deepEqual(await readFile(reportPath), reportBytes);
  assert.deepEqual(await readFile(markdownPath), markdownBytes);
});

test("FAIL and NOT APPLICABLE derive only from explicit evidence status", async () => {
  const passing = await readCanonicalJson(reportPath);
  const manifest = await readBoundManifest(passing);
  const evidenceArtifact = await readCanonicalJson(evidencePath);
  const target = manifest.requirements.find(({ id }) => id === "CCA-MOS-CORE-011");
  assert.ok(target);
  const failedExecutions = structuredClone(evidenceArtifact.executions);
  const binding = target.coverageSelectors[0];
  const failedExecution = failedExecutions.find(({ id }) => id === binding.executionReference);
  assert.ok(failedExecution);
  const raw = failedExecution.rawChecks.find(({ selector }) => selector === binding.selector);
  assert.ok(raw);
  raw.status = "FAIL";
  failedExecution.checks
    .filter(({ source, selector }) => source === binding.source && selector === binding.selector)
    .forEach((check) => { check.status = "FAIL"; });
  failedExecution.pass -= 1;
  failedExecution.fail += 1;
  failedExecution.status = "FAIL";
  failedExecution.exitCode = 1;
  failedExecution.diagnostics = ["one or more target checks failed", "target process exited 1"];
  let failedEvidence = executedGroupEvidence(manifest, failedExecutions);
  const failedRequirementEvidence = buildRequirementEvidence(
    manifest,
    failedEvidence,
    evidenceArtifact.reviews,
    failedExecutions,
    passing.evidenceRoot,
  );
  failedEvidence = reconcileGroupEvidence(failedEvidence, failedRequirementEvidence);
  const assessment = {
    assessor: passing.assessor.name,
    date: passing.assessmentDate,
    evidenceRoot: passing.evidenceRoot,
    evidenceDigest: passing.evidenceDigest,
    nativeProjectionProfile: passing.nativeProjectionProfile,
    requirementEvidence: failedRequirementEvidence,
  };
  const failedReport = buildReport(manifest, failedEvidence, passing.implementation, assessment);
  assert.equal(
    failedReport.results.find(({ requirementId }) => requirementId === target.id).status,
    "FAIL",
  );
  assert.equal(failedReport.assessmentLevel, "C1");
  assert.ok(failedReport.summary.fail > 0);
  assert.ok(failedReport.knownFailures.includes(target.id));
  await validateJsonSchema(
    failedReport,
    new URL("../schema/conformance-report-1.0.schema.json", import.meta.url),
  );

  const failedReviews = structuredClone(evidenceArtifact.reviews);
  const reviewTarget = failedReviews.find(({ requirementId }) => requirementId === "CCA-MOS-COMP-005");
  assert.ok(reviewTarget);
  reviewTarget.result = "FAIL";
  reviewTarget.reason = "The retained architecture review found a conformance defect.";
  reviewTarget.observedOutcome = "The reviewed product boundary did not satisfy the criterion.";
  let reviewFailureGroups = executedGroupEvidence(manifest, evidenceArtifact.executions);
  const reviewFailureRows = buildRequirementEvidence(
    manifest,
    reviewFailureGroups,
    failedReviews,
    evidenceArtifact.executions,
    passing.evidenceRoot,
  );
  reviewFailureGroups = reconcileGroupEvidence(reviewFailureGroups, reviewFailureRows);
  const reviewFailureReport = buildReport(manifest, reviewFailureGroups, passing.implementation, {
    assessor: passing.assessor.name,
    date: passing.assessmentDate,
    evidenceRoot: passing.evidenceRoot,
    evidenceDigest: passing.evidenceDigest,
    nativeProjectionProfile: passing.nativeProjectionProfile,
    requirementEvidence: reviewFailureRows,
  });
  validateReport(reviewFailureReport, manifest, reviewFailureRows);
  await validateJsonSchema(
    reviewFailureReport,
    new URL("../schema/conformance-report-1.0.schema.json", import.meta.url),
  );
  assert.equal(reviewFailureReport.assessmentLevel, "C1");
  assert.equal(
    reviewFailureReport.results.find(({ requirementId }) => requirementId === "CCA-MOS-COMP-005").status,
    "FAIL",
  );
  assert.equal(
    reviewFailureReport.results.find(({ requirementId }) => requirementId === "CCA-MOS-COMP-001").status,
    "PASS",
    "a failed review must not overwrite an unrelated passing automated row in the same group",
  );
  assert.equal(
    reviewFailureReport.evidence.find(({ group }) => group === "MOS-EVID-COMP-001").status,
    "FAIL",
  );
  const falseC2 = structuredClone(failedReport);
  falseC2.assessmentLevel = "C2";
  assert.throws(
    () => validateReport(falseC2, manifest, failedRequirementEvidence),
    /must pass for C2|strictly equal/u,
  );

  const irreproducibleArtifact = structuredClone(evidenceArtifact);
  const primaryExecutions = irreproducibleArtifact.executions
    .filter(({ id }) => id !== "reproducibility-meta");
  irreproducibleArtifact.reproducibility.executions[0].stdoutDigest = sha256(Buffer.from(
    "deliberately changed output under irrelevant environment variation",
    "utf8",
  ));
  const reproducibilityMeta = irreproducibleArtifact.executions
    .find(({ id }) => id === "reproducibility-meta");
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
    irreproducibleArtifact.reproducibility.executions,
  );
  reproducibilityMeta.stdoutDigest = sha256(Buffer.from(canonicalJson({
    primaryExecutions: primaryExecutions.map(reproducibleProjection),
    variantExecutions: irreproducibleArtifact.reproducibility.executions.map(reproducibleProjection),
  }), "utf8"));
  let irreproducibleGroups = executedGroupEvidence(manifest, irreproducibleArtifact.executions);
  irreproducibleArtifact.requirementEvidence = buildRequirementEvidence(
    manifest,
    irreproducibleGroups,
    irreproducibleArtifact.reviews,
    irreproducibleArtifact.executions,
    passing.evidenceRoot,
  );
  irreproducibleGroups = reconcileGroupEvidence(
    irreproducibleGroups,
    irreproducibleArtifact.requirementEvidence,
  );
  irreproducibleArtifact.evidence = irreproducibleGroups;
  validateEvidenceArtifact(irreproducibleArtifact, manifest);
  const irreproducibleBytes = Buffer.from(`${canonicalJson(irreproducibleArtifact)}\n`, "utf8");
  const irreproducibleReport = buildReport(
    manifest,
    irreproducibleGroups,
    passing.implementation,
    {
      assessor: passing.assessor.name,
      date: passing.assessmentDate,
      evidenceRoot: passing.evidenceRoot,
      evidenceDigest: sha256(irreproducibleBytes),
      nativeProjectionProfile: passing.nativeProjectionProfile,
      requirementEvidence: irreproducibleArtifact.requirementEvidence,
    },
  );
  validateReportEvidenceBinding(irreproducibleReport, irreproducibleArtifact, manifest);
  assert.equal(irreproducibleReport.assessmentLevel, "C1");
  assert.equal(
    irreproducibleReport.results
      .find(({ requirementId }) => requirementId === "CCA-MOS-CONF-003").status,
    "FAIL",
  );

  const profile = "SDK";
  const requiredGroups = new Set([
    ...manifest.conformanceProfiles.commonEvidenceGroups,
    ...manifest.conformanceProfiles.profiles.find(({ name }) => name === profile).evidenceGroups,
  ]);
  const excludedEvidence = structuredClone(passing.evidence);
  for (const item of excludedEvidence) {
    if (requiredGroups.has(item.group)) continue;
    item.status = "NOT APPLICABLE";
    item.reason = "Evidence group is outside this explicit SDK profile.";
    item.executionReferences = [];
  }
  const excludedRequirementEvidence = buildRequirementEvidence(
    manifest,
    excludedEvidence,
    evidenceArtifact.reviews,
    evidenceArtifact.executions,
    passing.evidenceRoot,
  );
  const excludedReport = buildReport(manifest, excludedEvidence, passing.implementation, {
    assessor: passing.assessor.name,
    date: passing.assessmentDate,
    evidenceRoot: passing.evidenceRoot,
    evidenceDigest: passing.evidenceDigest,
    profiles: [profile],
    nativeProjectionProfile: passing.nativeProjectionProfile,
    requirementEvidence: excludedRequirementEvidence,
  });
  const excludedTarget = manifest.requirements.find(({ evidenceGroups }) => (
    evidenceGroups.every((identifier) => !requiredGroups.has(identifier))
  ));
  assert.ok(excludedTarget);
  const excludedResult = excludedReport.results.find(
    ({ requirementId }) => requirementId === excludedTarget.id,
  );
  assert.equal(excludedResult.status, "NOT APPLICABLE");
  assert.match(excludedResult.reason, /outside this explicit SDK profile/u);
  assert.equal(excludedReport.assessmentLevel, "C2");
  assert.deepEqual(excludedReport.nativeProjectionProfile, passing.nativeProjectionProfile);

  assert.throws(
    () => buildReport(manifest, passing.evidence, passing.implementation, {
      ...assessment,
      profiles: ["Unknown Profile"],
    }),
    /unknown conformance profile/u,
  );
  assert.throws(
    () => buildReport(manifest, passing.evidence, passing.implementation, {
      ...assessment,
      nativeProjectionProfile: null,
    }),
    /native projection profile is required/u,
  );
});
