// MO-1308 Stream 2D test corpus: real, admissible records for every record kind, built from the repository's own
// released artifacts (MIP fixture, MO-1306 Policy fixtures and evidence bundles, MO-1307 results and decisions) and
// from the real SDK (checkpoint records). Test-only; it is used by the CLI tests and the 2D integration suite.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalize } from "../../../cca-studio/web/js/mip-canonical.js";
import { MemoryOS } from "../../../cca-studio/web/js/memoryos-sdk.js";

const repositories = fileURLToPath(new URL("../../../", import.meta.url));
const read = (...segments) => new Uint8Array(readFileSync(join(repositories, ...segments)));

export const CORPUS_WORKSPACE = "workspace-investigation";

export const mipBytes = () => new Uint8Array(Buffer.from(
  readFileSync(join(repositories, "cca-studio/tests/fixtures/mip/complete-investigation.mip.b64"), "ascii").trim(), "base64"));

const checkpoints = new Map();
// A real checkpoint record; every label is a distinct investigation identifier and so a distinct record.
export function checkpointBytes(label) {
  if (!checkpoints.has(label)) {
    const memory = new MemoryOS();
    const checkpoint = memory.importPackage(mipBytes(), { identifier: String(label) }).checkpoint();
    checkpoints.set(label, memory.createHistoryCheckpointRecord(checkpoint));
  }
  return new Uint8Array(checkpoints.get(label));
}
export const checkpointRecord = (label) => ({
  recordKind: "INVESTIGATION_CHECKPOINT", members: [{ name: "checkpoint.json", bytes: checkpointBytes(label) }],
});

export const POLICY_FIXTURES = Object.freeze(["evaluate-policy-pass", "evaluate-policy-fail", "evaluate-policy-cne",
  "evaluate-policySet-pass", "evaluate-policySet-fail", "evaluate-policySet-cne"]);
export const policyFiles = (index = 0) => ({
  identity: read("cca-conformance/fixtures/mo1306", POLICY_FIXTURES[index], "evaluation-identity.json"),
  outcome: read("cca-conformance/fixtures/mo1306", POLICY_FIXTURES[index], "policy-outcome.json"),
});
export const policyRecord = (index = 0) => {
  const { identity, outcome } = policyFiles(index);
  return { recordKind: "POLICY_EVALUATION", members: [
    { name: "evaluation-identity.json", bytes: identity }, { name: "policy-outcome.json", bytes: outcome }] };
};

function bundleDirectories(directory, found = []) {
  for (const name of readdirSync(directory).sort()) {
    const full = join(directory, name);
    if (statSync(full).isDirectory()) bundleDirectories(full, found);
    else if (name === "memoryos-ci-complete.json") found.push(directory);
  }
  return found;
}
let bundles = null;
// A real MO-1306 bundle directory (a completed evaluation, 6 files, or a handled operational failure, 4 files).
export function bundleDirectory(fileCount = 6) {
  bundles ??= bundleDirectories(join(repositories, "cca-conformance/evidence/mo1306"));
  const found = bundles.find((directory) => readdirSync(directory).length === fileCount);
  if (found === undefined) throw new Error(`no ${fileCount}-file MO-1306 bundle in the repository evidence`);
  return found;
}
export const bundleRecord = (fileCount = 6) => ({
  recordKind: "CICD_RUN",
  members: readdirSync(bundleDirectory(fileCount)).sort().map((name) => ({
    name, bytes: new Uint8Array(readFileSync(join(bundleDirectory(fileCount), name))) })),
});

export const READINESS_NAMES = Object.freeze(["ready", "qualified", "not-ready", "could-not-evaluate"]);
export const readinessBytes = (name) => read("cca-conformance/fixtures/mo1307/bundles", name, "expected-result.json");
export const readinessRecord = (name) => ({
  recordKind: "READINESS_RESULT", members: [{ name: "memoryos-readiness-result.json", bytes: readinessBytes(name) }] });
// The released human decision fixtures are named by readiness result: ready-approve.json, cne-defer.json, ...
const DECISION_PREFIX = Object.freeze({ ready: "ready", qualified: "qualified", "not-ready": "not-ready", "could-not-evaluate": "cne" });
export const decisionBytes = (name, kind = "approve") => read("cca-conformance/fixtures/mo1307/human", `${DECISION_PREFIX[name]}-${kind}.json`);
export const decisionRecord = (name, kind = "approve") => ({
  recordKind: "HUMAN_DECISION_CLAIM", members: [{ name: "human-decision.json", bytes: decisionBytes(name, kind) }] });

// A regression report between two investigations of the reference Workspace (a real Core regression).
export function regressionBytes() {
  const memory = new MemoryOS();
  const baseline = memory.importPackage(mipBytes(), { identifier: "mo1308-2d-baseline" });
  const candidate = memory.importPackage(mipBytes(), { identifier: "mo1308-2d-candidate" });
  return new TextEncoder().encode(canonicalize(JSON.parse(JSON.stringify(memory.regression(baseline, candidate)))));
}
