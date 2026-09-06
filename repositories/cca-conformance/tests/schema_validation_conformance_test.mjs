import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import {
  CONFORMANCE_ROOT,
  REFERENCE_EVIDENCE_PATH,
  REFERENCE_REPORT_PATH,
  REFERENCE_REVIEW_PATH,
  readCanonicalJson,
  readManifest,
  retainedEvidenceFilename,
  retainedManifestFilename,
  validateManifest,
} from "./support/conformance-support.mjs";
import { validateJsonSchema } from "../tools/json-schema-validator.mjs";

const manifestSchema = new URL("../schema/requirements-manifest-1.0.schema.json", import.meta.url);

test("published JSON Schema and semantic validation accept the exact pinned manifest", async () => {
  const manifest = await readManifest();
  validateManifest(manifest);
  await validateJsonSchema(manifest, manifestSchema);
});

test("published JSON Schema and semantic validation reject the same manifest contract mutations", async () => {
  const manifest = await readManifest();
  const mutations = [
    (value) => { value.standard.version = "1.0.0"; },
    (value) => { value.unpublished = true; },
    (value) => { value.requirements.pop(); },
    (value) => { value.conformanceProfiles.profiles[0].name = "Unknown profile"; },
    (value) => { value.incorporatedStandards[0].evidenceGroups = ["MOS-EVID-RT-001"]; },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const changed = structuredClone(manifest);
    mutate(changed);
    assert.throws(() => validateManifest(changed), undefined, `semantic mutation ${index}`);
    await assert.rejects(
      validateJsonSchema(changed, manifestSchema),
      undefined,
      `schema mutation ${index}`,
    );
  }
});

test("published JSON Schemas independently validate every retained Reference Implementation artifact", async () => {
  const manifest = await readManifest();
  const retainedManifest = await readCanonicalJson(resolve(
    CONFORMANCE_ROOT,
    "manifests",
    retainedManifestFilename(manifest),
  ));
  const review = await readCanonicalJson(REFERENCE_REVIEW_PATH);
  const evidence = await readCanonicalJson(REFERENCE_EVIDENCE_PATH);
  const report = await readCanonicalJson(REFERENCE_REPORT_PATH);
  const retainedEvidence = await readCanonicalJson(resolve(
    CONFORMANCE_ROOT,
    "evidence",
    retainedEvidenceFilename(report.evidenceDigest),
  ));
  assert.deepEqual(retainedEvidence, evidence);
  const fixtures = [
    [retainedManifest, "requirements-manifest-1.0.schema.json"],
    [review, "review-attestations-1.0.schema.json"],
    [evidence, "conformance-evidence-1.0.schema.json"],
    [retainedEvidence, "conformance-evidence-1.0.schema.json"],
    [report, "conformance-report-1.0.schema.json"],
  ];
  for (const [value, schema] of fixtures) {
    await validateJsonSchema(value, new URL(`../schema/${schema}`, import.meta.url));
  }

  const invalidReview = structuredClone(review);
  invalidReview.unpublished = true;
  await assert.rejects(
    validateJsonSchema(
      invalidReview,
      new URL("../schema/review-attestations-1.0.schema.json", import.meta.url),
    ),
  );
  const invalidEvidence = structuredClone(evidence);
  invalidEvidence.executions[0].diagnostics = null;
  await assert.rejects(
    validateJsonSchema(
      invalidEvidence,
      new URL("../schema/conformance-evidence-1.0.schema.json", import.meta.url),
    ),
  );
  const invalidReport = structuredClone(report);
  invalidReport.assessmentLevel = "C0";
  await assert.rejects(
    validateJsonSchema(
      invalidReport,
      new URL("../schema/conformance-report-1.0.schema.json", import.meta.url),
    ),
  );
});
