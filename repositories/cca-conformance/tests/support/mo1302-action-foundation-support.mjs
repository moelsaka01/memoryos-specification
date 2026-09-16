import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { MemoryOS } from "../../../cca-studio/web/js/memoryos-sdk.js";
import {
  canonicalizeRestrictedJson,
  parseRestrictedJson,
} from "../../../cca-studio/web/js/policy-canonical.js";

export const CONFORMANCE_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const WORKSPACE_ROOT = resolve(CONFORMANCE_ROOT, "../..");
export const ACTION_ROOT = resolve(WORKSPACE_ROOT, ".github/actions/memoryos-policy-gate");
export const VECTOR_PATH = resolve(
  CONFORMANCE_ROOT,
  "tests/fixtures/github-policy-gate/1.0.0/mo1302-action-foundation-vectors.json",
);
export const HANDOFF_PATH = resolve(
  CONFORMANCE_ROOT,
  "tests/fixtures/investigation-policy/1.0.0/mo1302-handoff-vectors.json",
);
export const GOLDEN_VECTOR_PATH = resolve(
  WORKSPACE_ROOT,
  "repositories/cca-studio/tests/fixtures/investigation-policy/1.0.0/final-evaluation-identity-outcome-golden-vectors.json",
);
export const FULL_MIP_B64_PATH = resolve(
  WORKSPACE_ROOT,
  "repositories/cca-studio/tests/fixtures/mip/complete-investigation.mip.b64",
);

export const DISTRIBUTION = Object.freeze({
  repository: "moelsaka01/memoryos-specification",
  revision: "af6a405b3cd9097ce469b16a854a0568b8acee1f",
});

export const OUTPUT_NAMES = Object.freeze([
  "gate-class",
  "decision",
  "cli-exit-code",
  "publication-valid",
  "policy-semantic-digest",
  "evaluation-identity-digest",
  "outcome-digest",
  "policy-fact-context-digest",
  "regression-source-digest",
  "evaluation-identity-path",
  "outcome-path",
  "artifact-directory",
  "stable-code",
  "failure-class",
  "phase",
  "artifact-kind",
  "limit-identifier",
  "distribution-repository",
  "distribution-revision",
]);

const require = createRequire(import.meta.url);
export const actionBootstrap = require(resolve(ACTION_ROOT, "dist/index.js"));
export const actionRuntime = await import(
  `${pathToFileURL(resolve(ACTION_ROOT, "dist/action-runtime.mjs")).href}?conformance=1`
);

export function rawSha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function canonicalBytes(value) {
  return Buffer.from(canonicalizeRestrictedJson(value));
}

export function canonicalEnvelope(command, result, ok = true) {
  const envelope = ok
    ? { command, ok: true, result, schemaVersion: "1.1" }
    : { command, error: result, ok: false, schemaVersion: "1.1" };
  return Buffer.concat([canonicalBytes(envelope), Buffer.from("\n")]);
}

export function mo1301Error({
  code = "POLICY_SCHEMA_INVALID",
  exitCode = 2,
  failureClass = "preparation",
  phase = "artifactIntake",
  artifactKind = "MemoryOSInvestigationPolicy",
  limitIdentifier = null,
} = {}) {
  return {
    artifactKind,
    code,
    details: [],
    exitCode,
    failureClass,
    limitIdentifier,
    message: "non-normative test diagnostic",
    phase,
  };
}

export function rule(identifier, type, parameters = {}) {
  return { identifier, parameters, type, version: "1.0.0" };
}

export function policy(identifier, frozenRule) {
  return {
    identifier,
    kind: "MemoryOSInvestigationPolicy",
    policyVersion: "1.0.0",
    rules: [frozenRule],
    version: "1.0.0",
  };
}

export function policySet(identifier, child, expectedSemanticDigest) {
  return {
    identifier,
    kind: "MemoryOSInvestigationPolicySet",
    policies: [{ expectedSemanticDigest, policy: child }],
    policySetVersion: "1.0.0",
    version: "1.0.0",
  };
}

function semanticDigestFor(memory, kind, value) {
  const bytes = Uint8Array.from(Buffer.from(JSON.stringify(value)));
  return kind === "policy"
    ? memory.preparePolicy(bytes).semanticDigest
    : memory.preparePolicySet(bytes).semanticDigest;
}

export async function makeActionFixture(testContext) {
  const root = await mkdtemp(join(tmpdir(), "memoryos-mo1302-action-"));
  const workspace = join(root, "workspace");
  const runnerTemp = join(root, "runner-temp");
  await mkdir(join(workspace, "policies"), { recursive: true });
  await mkdir(join(workspace, "packages"), { recursive: true });
  await mkdir(runnerTemp, { recursive: true });
  testContext?.after(async () => rm(root, { force: true, recursive: true }));

  const memory = new MemoryOS();
  const values = {
    pass: policy("pa", rule("a", "memoryos.require-mip-integrity")),
    fail: policy("pf", rule("a", "memoryos.require-verification-completed")),
    cne: policy(
      "pc",
      rule("a", "memoryos.prohibit-regression-findings", { categories: ["reflection"] }),
    ),
  };
  const passDigest = semanticDigestFor(memory, "policy", values.pass);
  values.set = policySet("ps", values.pass, passDigest);

  const paths = {};
  const digests = {};
  for (const [name, value] of Object.entries(values)) {
    const kind = name === "set" ? "policy-set" : "policy";
    const suffix = kind === "policy" ? "memoryos-policy.json" : "memoryos-policy-set.json";
    paths[name] = `policies/${name}.${suffix}`;
    await writeFile(join(workspace, ...paths[name].split("/")), JSON.stringify(value), "utf8");
    digests[name] = semanticDigestFor(memory, kind, value);
  }

  const mipBytes = Buffer.from((await readFile(FULL_MIP_B64_PATH, "ascii")).trim(), "base64");
  paths.candidate = "packages/candidate.mip";
  paths.baseline = "packages/baseline.mip";
  paths.corrupt = "packages/corrupt.mip";
  await writeFile(join(workspace, ...paths.candidate.split("/")), mipBytes);
  await writeFile(join(workspace, ...paths.baseline.split("/")), mipBytes);
  const corruptBytes = Buffer.from(mipBytes);
  corruptBytes[corruptBytes.length - 2] ^= 1;
  await writeFile(join(workspace, ...paths.corrupt.split("/")), corruptBytes);

  return Object.freeze({
    digests: Object.freeze(digests),
    mipBytes,
    paths: Object.freeze(paths),
    root,
    runnerTemp,
    values: Object.freeze(values),
    workspace,
  });
}

export function actionEnvironment(fixture, policyName, overrides = {}) {
  const policyKind = policyName === "set" ? "policy-set" : "policy";
  return {
    GITHUB_WORKSPACE: fixture.workspace,
    RUNNER_TEMP: fixture.runnerTemp,
    "INPUT_POLICY-KIND": policyKind,
    "INPUT_POLICY-PATH": fixture.paths[policyName],
    "INPUT_EXPECTED-POLICY-SEMANTIC-DIGEST": fixture.digests[policyName],
    "INPUT_CANDIDATE-MIP-PATH": fixture.paths.candidate,
    "INPUT_REGRESSION-BASELINE-MIP-PATH": "",
    ...overrides,
  };
}

export async function runActionFixture(fixture, policyName, options = {}) {
  const distributionManifestRawSha256 = rawSha256(await readFile(resolve(
    ACTION_ROOT,
    "distribution-manifest.json",
  )));
  return actionRuntime.runAction({
    actionRoot: ACTION_ROOT,
    distribution: DISTRIBUTION,
    distributionManifestRawSha256,
    environment: actionEnvironment(fixture, policyName, options.environment),
    outputNames: OUTPUT_NAMES,
    ...(options.spawn === undefined ? {} : { spawn: options.spawn }),
  });
}

export function spawnInterceptor(interceptor) {
  return (executable, args, options) => {
    const actual = spawnSync(executable, args, options);
    return interceptor({ actual, args, executable, options }) ?? actual;
  };
}

export function replaceCliEnvelope(actual, mutate, status = actual.status) {
  const envelope = JSON.parse(Buffer.from(actual.stdout).toString("utf8"));
  mutate(envelope);
  return {
    ...actual,
    signal: null,
    status,
    stdout: canonicalEnvelope(envelope.command, envelope.ok ? envelope.result : envelope.error, envelope.ok),
  };
}

export function protocolResult(command, result, status = 0, ok = true, stderr = Buffer.alloc(0)) {
  return {
    error: undefined,
    signal: null,
    status,
    stderr,
    stdout: canonicalEnvelope(command, result, ok),
  };
}

export function assertClosedOutputs(outputs) {
  assert.deepEqual(Object.keys(outputs), OUTPUT_NAMES);
  for (const value of Object.values(outputs)) {
    assert.equal(typeof value, "string");
    assert.doesNotMatch(value, /[\r\n\0]/u);
  }
}

export function assertAutomationFailure(result, code, phase) {
  assert.equal(result.jobSuccess, false);
  assertClosedOutputs(result.outputs);
  assert.equal(result.outputs["gate-class"], "tool-failure");
  assert.equal(result.outputs["publication-valid"], "false");
  assert.equal(result.outputs["stable-code"], code);
  assert.equal(result.outputs["failure-class"], "automation");
  assert.equal(result.outputs.phase, phase);
  for (const name of [
    "policy-semantic-digest", "evaluation-identity-digest", "outcome-digest",
    "policy-fact-context-digest", "regression-source-digest", "evaluation-identity-path",
    "outcome-path", "artifact-directory",
  ]) assert.equal(result.outputs[name], "", `${name} leaked from a failed invocation`);
}

export async function retainedFiles(result) {
  const root = result.outputs["artifact-directory"];
  const names = (await readdir(root)).sort();
  const files = Object.fromEntries(await Promise.all(names.map(async (name) => [
    name,
    await readFile(join(root, name)),
  ])));
  return { files, names, root };
}

export async function removeRetained(result) {
  const root = result?.outputs?.["artifact-directory"];
  if (typeof root === "string" && root.length > 0) await rm(root, { force: true, recursive: true });
}

export async function copyGeneration(result, destination) {
  await mkdir(destination, { recursive: true });
  for (const name of actionRuntime.internalContract.GENERATION_FILE_NAMES) {
    const target = join(destination, name);
    await cp(join(result.outputs["artifact-directory"], name), target);
    await chmod(target, 0o600);
  }
}

export function parseCanonical(bytes) {
  const parsed = parseRestrictedJson(bytes);
  assert.deepEqual(Buffer.from(canonicalizeRestrictedJson(parsed)), Buffer.from(bytes));
  return parsed;
}

export async function makeActionDistributionCopy(testContext) {
  const root = await mkdtemp(join(tmpdir(), "memoryos-mo1302-distribution-"));
  const actionRoot = join(root, "memoryos-policy-gate");
  await cp(ACTION_ROOT, actionRoot, { recursive: true });
  testContext?.after(async () => rm(root, { force: true, recursive: true }));
  return { actionRoot, root };
}

export function loadDistributionCopy(actionRoot) {
  const entrypoint = resolve(actionRoot, "dist/index.js");
  delete require.cache[entrypoint];
  return require(entrypoint);
}

export async function readVector() {
  return JSON.parse(await readFile(VECTOR_PATH, "utf8"));
}

export async function assertFileReference(reference) {
  const bytes = await readFile(resolve(WORKSPACE_ROOT, reference.path));
  assert.equal(rawSha256(bytes), reference.rawSha256, reference.path);
  return bytes;
}
