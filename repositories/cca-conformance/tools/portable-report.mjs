#!/usr/bin/env node

import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  buildReport,
  canonicalJson,
  readCanonicalJson,
  readManifest,
  sha256,
  standardRoot,
  validateAssessmentManifest,
  validatePortableEvidenceArtifact,
  validatePortableReportEvidenceBinding,
  validatePublishedStandard,
} from "../tests/support/conformance-support.mjs";

function usage() {
  return [
    "Usage:",
    "  node tools/portable-report.mjs create --manifest PATH --normative-manifest PATH --evidence PATH --evidence-reference REF --output PATH --profiles complete|PROFILE[,PROFILE...]",
    "  node tools/portable-report.mjs validate --manifest PATH --normative-manifest PATH --evidence PATH --evidence-reference REF --report PATH",
  ].join("\n");
}

function parseArguments(values, required) {
  assert.equal(values.length % 2, 0, usage());
  const options = {};
  for (let index = 0; index < values.length; index += 2) {
    assert.match(values[index], /^--[a-z-]+$/u, usage());
    assert.equal(Object.hasOwn(options, values[index]), false, `duplicate ${values[index]}`);
    options[values[index]] = values[index + 1];
  }
  assert.deepEqual(Object.keys(options).sort(), [...required].sort(), usage());
  return options;
}

async function loadInputs(options) {
  const manifest = await readManifest(resolve(options["--manifest"]));
  const normativeManifest = await readManifest(resolve(options["--normative-manifest"]));
  validateAssessmentManifest(manifest, normativeManifest);
  const publishedRoot = standardRoot();
  assert.notEqual(
    publishedRoot,
    null,
    "the authoritative Standard publication must be supplied or installed adjacent to the suite",
  );
  await validatePublishedStandard(publishedRoot, normativeManifest);
  const evidencePath = resolve(options["--evidence"]);
  const evidenceArtifact = await readCanonicalJson(evidencePath);
  const evidenceBytes = await readFile(evidencePath);
  validatePortableEvidenceArtifact(evidenceArtifact, manifest, normativeManifest);
  return { manifest, normativeManifest, evidenceArtifact, evidenceBytes };
}

const [mode, ...values] = process.argv.slice(2);

if (mode === "create") {
  const options = parseArguments(values, [
    "--manifest", "--normative-manifest", "--evidence", "--evidence-reference", "--output", "--profiles",
  ]);
  const { manifest, normativeManifest, evidenceArtifact, evidenceBytes } = await loadInputs(options);
  const profileValue = options["--profiles"];
  const assessment = {
    assessor: evidenceArtifact.assessor,
    date: evidenceArtifact.assessmentDate,
    evidenceRoot: options["--evidence-reference"],
    evidenceDigest: sha256(evidenceBytes),
    requirementEvidence: evidenceArtifact.requirementEvidence,
  };
  if (profileValue !== "complete") {
    assessment.profiles = profileValue.split(",").map((value) => value.trim());
  }
  if (Object.hasOwn(evidenceArtifact, "nativeProjectionProfile")) {
    assessment.nativeProjectionProfile = evidenceArtifact.nativeProjectionProfile;
  }
  const report = buildReport(
    manifest,
    evidenceArtifact.evidence,
    evidenceArtifact.implementation,
    assessment,
  );
  assert.ok(["C1", "C2"].includes(report.assessmentLevel));
  const reportBytes = Buffer.from(`${canonicalJson(report)}\n`, "utf8");
  validatePortableReportEvidenceBinding(
    report,
    reportBytes,
    evidenceArtifact,
    evidenceBytes,
    manifest,
    null,
    normativeManifest,
  );
  const output = resolve(options["--output"]);
  await assert.rejects(access(output), "portable report already exists and cannot be rewritten");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, reportBytes, { flag: "wx" });
  process.stdout.write(`PASS ${report.assessmentLevel} ${output}\n`);
} else if (mode === "validate") {
  const options = parseArguments(values, [
    "--manifest", "--normative-manifest", "--evidence", "--evidence-reference", "--report",
  ]);
  const { manifest, normativeManifest, evidenceArtifact, evidenceBytes } = await loadInputs(options);
  const reportPath = resolve(options["--report"]);
  const report = await readCanonicalJson(reportPath);
  assert.ok(["C1", "C2"].includes(report.assessmentLevel), "portable C1/C2 validator does not accept C3");
  assert.equal(report.evidenceRoot, options["--evidence-reference"]);
  validatePortableReportEvidenceBinding(
    report,
    await readFile(reportPath),
    evidenceArtifact,
    evidenceBytes,
    manifest,
    null,
    normativeManifest,
  );
  process.stdout.write(`PASS ${report.assessmentLevel} ${reportPath}\n`);
} else {
  throw new Error(usage());
}
