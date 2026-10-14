#!/usr/bin/env node

import assert from "node:assert/strict";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildReport,
  REFERENCE_EVIDENCE_PATH,
  REFERENCE_EVIDENCE_URI,
  REFERENCE_MARKDOWN_PATH,
  REFERENCE_NATIVE_PROFILE,
  REFERENCE_REPORT_PATH,
  readCanonicalJson,
  readManifest,
  reportMarkdown,
  retainedEvidenceFilename,
  serializeReport,
  sha256,
  validateReportEvidenceBinding,
} from "../tests/support/conformance-support.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  return [
    "Usage:",
    "  node tools/conformance-report.mjs validate [REPORT.json] [MANIFEST.json]",
    "  node tools/conformance-report.mjs generate EVIDENCE.json REPORT.json REPORT.md NAME VERSION ASSESSOR DATE EVIDENCE_ROOT NATIVE_PROFILE NATIVE_PROFILE_VERSION MANIFEST.json",
  ].join("\n");
}

async function main() {
  const [command, ...arguments_] = process.argv.slice(2);
  if (command === "validate") {
    assert.ok(arguments_.length <= 2, usage());
    const reportPath = resolve(arguments_[0] ?? "reports/reference-implementation-1.2.0.json");
    assert.equal(reportPath, REFERENCE_REPORT_PATH, "bundled report validation requires the canonical report path");
    const report = await readCanonicalJson(reportPath);
    const retainedManifestPath = resolve(
      root,
      "manifests",
      `requirements-manifest-${report.conformance.manifestDigest.replace(":", "-")}.json`,
    );
    const manifest = await readManifest(
      arguments_[1] ? resolve(arguments_[1]) : retainedManifestPath,
    );
    assert.equal(report.evidenceRoot, REFERENCE_EVIDENCE_URI, "report evidence root is not canonical");
    const evidence = await readCanonicalJson(REFERENCE_EVIDENCE_PATH);
    assert.equal(report.evidenceDigest, sha256(await readFile(REFERENCE_EVIDENCE_PATH)));
    const immutableEvidencePath = resolve(
      dirname(REFERENCE_EVIDENCE_PATH),
      retainedEvidenceFilename(report.evidenceDigest),
    );
    const immutableEvidence = await readCanonicalJson(immutableEvidencePath);
    assert.deepEqual(immutableEvidence, evidence, "content-addressed evidence differs from the canonical alias");
    assert.equal(sha256(await readFile(immutableEvidencePath)), report.evidenceDigest);
    validateReportEvidenceBinding(report, evidence, manifest);
    process.stdout.write(`PASS ${reportPath}\n`);
    return;
  }
  if (command === "generate" && arguments_.length === 11) {
    const [
      evidencePath, reportPath, markdownPath, name, version, assessor, date,
      evidenceRoot, nativeProfile, nativeProfileVersion,
    ] = arguments_;
    const manifest = await readManifest(resolve(arguments_[10]));
    assert.equal(resolve(evidencePath), REFERENCE_EVIDENCE_PATH, "bundled generation requires canonical evidence path");
    assert.equal(resolve(reportPath), REFERENCE_REPORT_PATH, "bundled generation requires canonical report path");
    assert.equal(resolve(markdownPath), REFERENCE_MARKDOWN_PATH, "bundled generation requires canonical Markdown path");
    assert.equal(evidenceRoot, REFERENCE_EVIDENCE_URI, "bundled generation requires canonical evidence root");
    const evidenceValue = await readCanonicalJson(REFERENCE_EVIDENCE_PATH);
    const evidenceDigest = sha256(await readFile(REFERENCE_EVIDENCE_PATH));
    const immutableEvidencePath = resolve(dirname(REFERENCE_EVIDENCE_PATH), retainedEvidenceFilename(evidenceDigest));
    assert.deepEqual(
      await readCanonicalJson(immutableEvidencePath),
      evidenceValue,
      "content-addressed evidence differs from the canonical alias",
    );
    assert.equal(name, evidenceValue.implementation.name, "implementation name differs from retained evidence");
    assert.equal(version, evidenceValue.implementation.version, "implementation version differs from retained evidence");
    assert.equal(assessor, evidenceValue.assessor, "assessor differs from retained evidence");
    assert.equal(date, evidenceValue.assessmentDate, "assessment date differs from retained evidence");
    assert.deepEqual(
      { identifier: nativeProfile, version: nativeProfileVersion },
      evidenceValue.nativeProjectionProfile,
      "native projection profile differs from retained evidence",
    );
    const report = buildReport(
      manifest,
      evidenceValue.evidence,
      evidenceValue.implementation,
      {
        assessor,
        date,
        evidenceRoot,
        evidenceDigest,
        nativeProjectionProfile: { identifier: nativeProfile, version: nativeProfileVersion },
        requirementEvidence: evidenceValue.requirementEvidence,
      },
    );
    validateReportEvidenceBinding(report, evidenceValue, manifest);
    const resolvedReportPath = resolve(reportPath);
    const resolvedMarkdownPath = resolve(markdownPath);
    await assert.rejects(access(resolvedReportPath), "retained JSON report already exists and cannot be rewritten");
    await assert.rejects(access(resolvedMarkdownPath), "retained Markdown report already exists and cannot be rewritten");
    await mkdir(dirname(resolvedReportPath), { recursive: true });
    await mkdir(dirname(resolvedMarkdownPath), { recursive: true });
    let jsonCreated = false;
    try {
      await writeFile(resolvedReportPath, serializeReport(report), { encoding: "utf8", flag: "wx" });
      jsonCreated = true;
      await writeFile(resolvedMarkdownPath, reportMarkdown(report, manifest), { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (jsonCreated) await rm(resolvedReportPath, { force: true });
      throw error;
    }
    process.stdout.write(`${serializeReport(report)}`);
    return;
  }
  throw new Error(usage());
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
