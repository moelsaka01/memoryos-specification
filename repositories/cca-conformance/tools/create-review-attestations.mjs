#!/usr/bin/env node

import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalJson,
  REFERENCE_REVIEW_PATH,
  readJson,
  readManifest,
  requirementEvidenceInputs,
  validateManifestInputsCurrent,
  validateReviewArtifact,
} from "../tests/support/conformance-support.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(root, "../..");
const standardRoot = process.env.MEMORYOS_STANDARD_ROOT
  ? resolve(process.env.MEMORYOS_STANDARD_ROOT)
  : resolve(workspaceRoot, "../cca-specifications/specifications/CCA-MEMORYOS-1.0");
const specificationsRoot = dirname(standardRoot);
function usage() {
  return "Usage: node tools/create-review-attestations.mjs --manifest PATH --input COMPLETED-REVIEW.json --output PATH";
}

function parseArguments(values) {
  assert.equal(values.length % 2, 0, usage());
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    assert.match(values[index], /^--[a-z-]+$/u, usage());
    assert.equal(Object.hasOwn(result, values[index]), false, `duplicate ${values[index]}`);
    result[values[index]] = values[index + 1];
  }
  for (const name of ["--manifest", "--input", "--output"]) {
    assert.ok(result[name], `missing ${name}\n${usage()}`);
  }
  assert.equal(Object.keys(result).length, 3, usage());
  return result;
}

function artifactPath(path) {
  const separator = path.indexOf("/");
  if (separator > 0 && path.startsWith("CCA-")) {
    return resolve(specificationsRoot, path.slice(0, separator), path.slice(separator + 1));
  }
  return resolve(workspaceRoot, path);
}

function exactMembers(value, expected, label) {
  assert.equal(value !== null && typeof value === "object" && !Array.isArray(value), true, `${label} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label} has an invalid member set`);
}

function bindCompletedReview(source, manifest) {
  if (!Object.hasOwn(source, "outcomes")) return source;
  exactMembers(
    source,
    ["schemaVersion", "implementation", "reviewer", "assessmentDate", "reviewRecordId", "outcomes"],
    "completed review",
  );
  assert.equal(source.schemaVersion, "1.0");
  exactMembers(source.implementation, ["name", "version"], "completed review implementation");
  const implementation = manifest.evidenceGroups[0].implementation;
  assert.equal(source.implementation.name, implementation.name);
  assert.equal(source.implementation.version, implementation.version);
  const implementationRevisionDigest = manifest.implementation.revision;
  assert.equal(implementation.revision, implementationRevisionDigest);
  assert.ok(Array.isArray(source.outcomes), "completed review outcomes must be an array");
  const requirements = manifest.requirements.filter(({ verification }) => verification !== "automated");
  assert.deepEqual(
    source.outcomes.map(({ requirementId }) => requirementId),
    requirements.map(({ id }) => id),
    "completed review outcomes must cover every review requirement in canonical order",
  );
  const attestations = source.outcomes.map((outcome, index) => {
    const members = ["requirementId", "observedOutcome", "result"];
    if (outcome.result === "FAIL") members.push("reason");
    exactMembers(outcome, members, `completed review outcome ${index}`);
    assert.ok(["PASS", "FAIL"].includes(outcome.result), `${outcome.requirementId} has an invalid result`);
    assert.equal(typeof outcome.observedOutcome, "string");
    assert.notEqual(outcome.observedOutcome.length, 0);
    if (outcome.result === "FAIL") {
      assert.equal(typeof outcome.reason, "string");
      assert.notEqual(outcome.reason.length, 0);
    }
    const requirement = requirements[index];
    const attestation = {
      requirementId: requirement.id,
      implementation,
      artifacts: requirementEvidenceInputs(requirement, manifest),
      criterion: requirement.statement,
      observedOutcome: outcome.observedOutcome,
      reviewer: source.reviewer,
      date: source.assessmentDate,
      reviewRecordId: source.reviewRecordId,
      implementationRevisionDigest,
      result: outcome.result,
      durableEvidence: `evidence/reference-implementation-review-1.2.1.json#/attestations/${index}`,
    };
    if (outcome.result === "FAIL") attestation.reason = outcome.reason;
    return attestation;
  });
  return {
    schemaVersion: source.schemaVersion,
    implementation,
    implementationRevisionDigest,
    reviewRecordId: source.reviewRecordId,
    reviewer: source.reviewer,
    assessmentDate: source.assessmentDate,
    attestations,
  };
}

const options = parseArguments(process.argv.slice(2));
const manifest = await readManifest(resolve(options["--manifest"]));
validateManifestInputsCurrent(manifest);
const input = resolve(options["--input"]);
const output = resolve(options["--output"]);
assert.equal(output, REFERENCE_REVIEW_PATH, "retained review evidence must use the canonical path");
assert.notEqual(input, output, "the completed review source and retained output must be distinct files");
const artifact = bindCompletedReview(await readJson(input), manifest);
validateReviewArtifact(artifact, manifest);
for (const attestation of artifact.attestations) {
  for (const cited of attestation.artifacts) await access(artifactPath(cited));
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${canonicalJson(artifact)}\n`, { encoding: "utf8", flag: "wx" });
process.stdout.write(`PASS ${artifact.attestations.length} explicit review attestations retained at ${output}\n`);
