import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  policyEvaluationIdentityDigest,
  policyEvaluationOutcomeDigest,
  validateEvaluationIdentity,
  validatePolicyEvaluationOutcome,
} from "../../../cca-studio/web/js/investigation-policy-engine.js";
import {
  canonicalizeRestrictedJson,
  parseRestrictedJson,
} from "../../../cca-studio/web/js/policy-canonical.js";

export const MO1301_CONFORMANCE_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const MO1301_WORKSPACE_ROOT = resolve(MO1301_CONFORMANCE_ROOT, "../..");
export const MO1301_INVENTORY_PATH = resolve(
  MO1301_CONFORMANCE_ROOT,
  "mo1301-conformance-inventory.json",
);
export const MO1302_HANDOFF_PATH = resolve(
  MO1301_CONFORMANCE_ROOT,
  "tests/fixtures/investigation-policy/1.0.0/mo1302-handoff-vectors.json",
);

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function rawSha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function assertExactMembers(value, members, label) {
  assert.equal(value !== null && typeof value === "object" && !Array.isArray(value), true,
    `${label} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...members].sort(), `${label} member set changed`);
}

export function assertOrderedUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} contains a duplicate`);
  assert.deepEqual(values, [...values].sort(), `${label} is not lexically ordered`);
}

export function normativeErrorProjection(envelope) {
  const { error } = envelope;
  return {
    command: envelope.command,
    error: {
      artifactKind: error.artifactKind,
      code: error.code,
      exitCode: error.exitCode,
      failureClass: error.failureClass,
      limitIdentifier: error.limitIdentifier,
      phase: error.phase,
    },
    ok: false,
    schemaVersion: "1.1",
  };
}

export function verifyPublicationGeneration({
  evaluationIdentityBytes,
  evaluationIdentityDigest,
  outcomeBytes,
  outcomeDigest,
}) {
  const identity = parseRestrictedJson(evaluationIdentityBytes);
  assert.deepEqual(canonicalizeRestrictedJson(identity), new Uint8Array(evaluationIdentityBytes));
  assert.equal(validateEvaluationIdentity(identity), true);
  assert.equal(policyEvaluationIdentityDigest(identity), evaluationIdentityDigest);

  const outcome = parseRestrictedJson(outcomeBytes);
  assert.deepEqual(canonicalizeRestrictedJson(outcome), new Uint8Array(outcomeBytes));
  assert.equal(validatePolicyEvaluationOutcome(outcome, {
    expectedIdentity: identity,
    expectedOutcomeDigest: outcomeDigest,
  }), true);
  assert.equal(policyEvaluationOutcomeDigest(outcome), outcomeDigest);
  assert.equal(outcome.evaluationIdentityDigest, evaluationIdentityDigest);
  assert.deepEqual(canonicalizeRestrictedJson(outcome.evaluationIdentity),
    new Uint8Array(evaluationIdentityBytes));
  return Object.freeze({ identity, outcome });
}

export function decisionExitCode(decision) {
  if (decision === "PASS") return 0;
  if (decision === "FAIL") return 6;
  if (decision === "COULD_NOT_EVALUATE") return 7;
  throw new TypeError("Unknown completed Policy decision.");
}
