#!/usr/bin/env node

import assert from "node:assert/strict";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  buildIndependentAssessmentArtifact,
  buildIndependentC3Report,
  canonicalJson,
  readCanonicalJson,
  readManifest,
  standardRoot,
  validatePortableReportEvidenceBinding,
  validatePublishedStandard,
} from "../tests/support/conformance-support.mjs";

function usage() {
  return [
    "Usage:",
    "  node tools/independent-assessment.mjs create --manifest PATH --normative-manifest PATH --source-report PATH --evidence PATH --assessment-output PATH --assessment-reference REF --report-output PATH --assessor NAME --date YYYY-MM-DD --method reviewed|reproduced",
    "  node tools/independent-assessment.mjs validate --manifest PATH --normative-manifest PATH --report PATH --evidence PATH --assessment PATH",
  ].join("\n");
}

function parseArguments(values, required) {
  assert.equal(values.length % 2, 0, usage());
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    assert.match(values[index], /^--[a-z-]+$/u, usage());
    assert.equal(Object.hasOwn(result, values[index]), false, `duplicate ${values[index]}`);
    result[values[index]] = values[index + 1];
  }
  assert.deepEqual(Object.keys(result).sort(), [...required].sort(), usage());
  return result;
}

async function bytes(path) {
  return readFile(path);
}

async function requireAbsent(path, label) {
  await assert.rejects(access(path), `${label} already exists and cannot be rewritten`);
}

async function readAssessmentManifests(options) {
  const manifest = await readManifest(resolve(options["--manifest"]));
  const normativeManifest = await readManifest(resolve(options["--normative-manifest"]));
  const publishedRoot = standardRoot();
  assert.notEqual(
    publishedRoot,
    null,
    "the authoritative Standard publication must be supplied or installed adjacent to the suite",
  );
  await validatePublishedStandard(publishedRoot, normativeManifest);
  return { manifest, normativeManifest };
}

const [mode, ...values] = process.argv.slice(2);

if (mode === "create") {
  const options = parseArguments(values, [
    "--manifest", "--normative-manifest",
    "--source-report", "--evidence", "--assessment-output", "--assessment-reference",
    "--report-output", "--assessor", "--date", "--method",
  ]);
  const { manifest, normativeManifest } = await readAssessmentManifests(options);
  const sourceReportPath = resolve(options["--source-report"]);
  const evidencePath = resolve(options["--evidence"]);
  const assessmentOutput = resolve(options["--assessment-output"]);
  const reportOutput = resolve(options["--report-output"]);
  assert.notEqual(assessmentOutput, reportOutput, "assessment and report outputs must be distinct");
  await Promise.all([
    requireAbsent(assessmentOutput, "independent assessment output"),
    requireAbsent(reportOutput, "C3 report output"),
  ]);
  const sourceReport = await readCanonicalJson(sourceReportPath);
  const evidenceArtifact = await readCanonicalJson(evidencePath);
  const sourceReportBytes = await bytes(sourceReportPath);
  const evidenceBytes = await bytes(evidencePath);
  validatePortableReportEvidenceBinding(
    sourceReport,
    sourceReportBytes,
    evidenceArtifact,
    evidenceBytes,
    manifest,
    null,
    normativeManifest,
  );
  const assessment = buildIndependentAssessmentArtifact(
    sourceReport,
    evidenceBytes,
    manifest,
    {
      assessor: options["--assessor"],
      date: options["--date"],
      method: options["--method"],
    },
  );
  const assessmentBytes = Buffer.from(`${canonicalJson(assessment)}\n`, "utf8");
  const report = buildIndependentC3Report(
    sourceReport,
    evidenceBytes,
    assessment,
    assessmentBytes,
    options["--assessment-reference"],
    manifest,
  );
  const reportBytes = Buffer.from(`${canonicalJson(report)}\n`, "utf8");
  validatePortableReportEvidenceBinding(
    report,
    reportBytes,
    evidenceArtifact,
    evidenceBytes,
    manifest,
    {
      artifact: assessment,
      bytes: assessmentBytes,
      path: options["--assessment-reference"],
    },
    normativeManifest,
  );
  await mkdir(dirname(assessmentOutput), { recursive: true });
  await mkdir(dirname(reportOutput), { recursive: true });
  let assessmentCreated = false;
  try {
    await writeFile(assessmentOutput, assessmentBytes, { flag: "wx" });
    assessmentCreated = true;
    await writeFile(reportOutput, reportBytes, { flag: "wx" });
  } catch (error) {
    if (assessmentCreated) await rm(assessmentOutput, { force: true });
    throw error;
  }
  process.stdout.write(`PASS independent C3 assessment retained at ${assessmentOutput}\n`);
} else if (mode === "validate") {
  const options = parseArguments(values, [
    "--manifest", "--normative-manifest", "--report", "--evidence", "--assessment",
  ]);
  const { manifest, normativeManifest } = await readAssessmentManifests(options);
  const reportPath = resolve(options["--report"]);
  const evidencePath = resolve(options["--evidence"]);
  const assessmentPath = resolve(options["--assessment"]);
  const report = await readCanonicalJson(reportPath);
  const evidenceArtifact = await readCanonicalJson(evidencePath);
  const assessment = await readCanonicalJson(assessmentPath);
  validatePortableReportEvidenceBinding(
    report,
    await bytes(reportPath),
    evidenceArtifact,
    await bytes(evidencePath),
    manifest,
    {
      artifact: assessment,
      bytes: await bytes(assessmentPath),
      path: report.independentAssessment.path,
    },
    normativeManifest,
  );
  process.stdout.write(`PASS ${reportPath}\n`);
} else {
  throw new Error(usage());
}
