import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, unlinkSync, writeFileSync } from "node:fs";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import { validateJsonSchema } from "../tools/json-schema-validator.mjs";

import {
  ACTION_ROOT,
  DISTRIBUTION,
  GOLDEN_VECTOR_PATH,
  HANDOFF_PATH,
  OUTPUT_NAMES,
  WORKSPACE_ROOT,
  actionBootstrap,
  actionEnvironment,
  actionRuntime,
  assertAutomationFailure,
  assertClosedOutputs,
  assertFileReference,
  canonicalBytes,
  canonicalEnvelope,
  copyGeneration,
  loadDistributionCopy,
  makeActionDistributionCopy,
  makeActionFixture,
  mo1301Error,
  parseCanonical,
  protocolResult,
  rawSha256,
  readVector,
  removeRetained,
  replaceCliEnvelope,
  retainedFiles,
  runActionFixture,
  spawnInterceptor,
} from "./support/mo1302-action-foundation-support.mjs";

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const FINAL_FILES = [
  "evaluation-identity.json",
  "evaluation-identity.sha256",
  "evaluation-outcome.json",
  "evaluation-outcome.sha256",
  "gate-receipt.json",
  "policy-identities.json",
];

function assertProtocolFailure(callback, phase) {
  assert.throws(callback, (error) => {
    assert.deepEqual(error.failure, {
      kind: "MemoryOSGitHubPolicyGateAutomationFailure",
      version: "1.0.0",
      code: "MEMORYOS_CI_CLI_PROTOCOL_INVALID",
      phase,
    });
    return true;
  });
}

function assertGenerationFailure(callback) {
  assert.throws(callback, (error) => {
    assert.equal(error.failure?.code, "MEMORYOS_CI_PUBLICATION_GENERATION_INVALID");
    assert.equal(error.failure?.phase, "publicationGeneration");
    return true;
  });
}

test("the frozen Action vector is closed, authentic, and drives its expected gate result", async () => {
  const vectorBytes = await readFile(resolve(
    WORKSPACE_ROOT,
    "repositories/cca-conformance/tests/fixtures/github-policy-gate/1.0.0/mo1302-action-foundation-vectors.json",
  ));
  const vector = await readVector();
  await validateJsonSchema(
    vector,
    new URL("../schema/github-policy-gate-test-vector-1.0.schema.json", import.meta.url),
  );
  assert.equal(vector.kind, "MemoryOSGitHubPolicyGateTestVector");
  assert.equal(vector.version, "1.0.0");
  assert.equal(vector.vectorIdentifier, "frozen-mo1301-policy-pin-mismatch");
  assert.deepEqual(Object.keys(vector).sort(), [
    "baseEvaluation", "expected", "faults", "kind", "presentation", "vectorIdentifier", "version",
  ]);
  assert.equal(vector.faults.length, 1);
  assert.deepEqual(vector.faults[0], {
    form: "wellFormedMismatch",
    kind: "policyPinMismatch",
    replacementValue: `sha256:${"0".repeat(64)}`,
  });
  assert.deepEqual(vector.expected.primaryFailure, {
    code: "MEMORYOS_CI_POLICY_PIN_MISMATCH",
    kind: "MemoryOSGitHubPolicyGateAutomationFailure",
    phase: "policyPreparation",
    version: "1.0.0",
  });
  await validateJsonSchema(
    vector.expected.primaryFailure,
    new URL("../schema/github-policy-gate-automation-failure-1.0.schema.json", import.meta.url),
  );
  assert.equal(vectorBytes.at(0) === 0xef, false);
  assert.equal(vectorBytes.at(-1), 0x7d);
  assert.equal(Buffer.from(JSON.stringify(vector)).equals(vectorBytes), true);

  const references = [
    vector.baseEvaluation.policy,
    vector.baseEvaluation.candidateMip,
    vector.baseEvaluation.policyIdentities,
    vector.baseEvaluation.oracle.evaluationIdentity,
    vector.baseEvaluation.oracle.evaluationIdentityDigest,
    vector.baseEvaluation.oracle.outcome,
    vector.baseEvaluation.oracle.outcomeDigest,
  ];
  for (const reference of references) await assertFileReference(reference);
  assert.equal(vector.baseEvaluation.policyIdentities.path,
    "repositories/cca-conformance/tests/fixtures/investigation-policy/1.0.0/mo1302-handoff-vectors.json");
  assert.equal(vector.baseEvaluation.oracle.outcome.path,
    "repositories/cca-studio/tests/fixtures/investigation-policy/1.0.0/final-evaluation-identity-outcome-golden-vectors.json");
  assert.equal(rawSha256(await readFile(HANDOFF_PATH)), vector.baseEvaluation.policyIdentities.rawSha256);
  assert.equal(rawSha256(await readFile(GOLDEN_VECTOR_PATH)), vector.baseEvaluation.oracle.outcome.rawSha256);

  const manifest = JSON.parse(await readFile(resolve(
    ACTION_ROOT,
    "distribution-manifest.json",
  ), "utf8"));
  const manifestSchema = new URL(
    "../schema/github-policy-gate-distribution-manifest-1.0.schema.json",
    import.meta.url,
  );
  await validateJsonSchema(manifest, manifestSchema);
  const selfIncluding = structuredClone(manifest);
  selfIncluding.files.push({
    byteCount: 1,
    path: "distribution-manifest.json",
    rawSha256: `sha256:${"0".repeat(64)}`,
    role: "runtimeModule",
  });
  await assert.rejects(validateJsonSchema(selfIncluding, manifestSchema));

  const runnerTemp = await mkdtemp(join(tmpdir(), "memoryos-vector-run-"));
  try {
    const fault = vector.faults[0];
    const result = await actionRuntime.runAction({
      actionRoot: ACTION_ROOT,
      distribution: DISTRIBUTION,
      distributionManifestRawSha256: rawSha256(await readFile(resolve(
        ACTION_ROOT,
        "distribution-manifest.json",
      ))),
      environment: {
        GITHUB_WORKSPACE: WORKSPACE_ROOT,
        RUNNER_TEMP: runnerTemp,
        "INPUT_POLICY-KIND": vector.baseEvaluation.policyKind,
        "INPUT_POLICY-PATH": vector.baseEvaluation.policy.path,
        "INPUT_EXPECTED-POLICY-SEMANTIC-DIGEST": fault.replacementValue,
        "INPUT_CANDIDATE-MIP-PATH": vector.baseEvaluation.candidateMip.path,
        "INPUT_REGRESSION-BASELINE-MIP-PATH": "",
      },
      outputNames: OUTPUT_NAMES,
    });
    assert.equal(result.outputs["gate-class"], vector.expected.gateClass);
    assert.equal(result.outputs.decision, "");
    assert.equal(result.outputs["publication-valid"], String(vector.expected.publicationValid));
    assert.equal(result.outputs["stable-code"], vector.expected.primaryFailure.code);
    assert.equal(result.outputs.phase, vector.expected.primaryFailure.phase);
  } finally {
    await rm(runnerTemp, { force: true, recursive: true });
  }
});

test("Action metadata, bootstrap exports, and distribution closure are exact", async () => {
  const metadata = await readFile(resolve(ACTION_ROOT, "action.yml"), "utf8");
  assert.match(metadata, /^name: MemoryOS Deterministic Policy Gate\r?\n/u);
  assert.match(metadata, /description: Evaluate and verify a pinned MemoryOS Investigation Policy or Policy Set against authoritative Memory Investigation Package input\./u);
  assert.match(metadata, /using: node24/u);
  assert.match(metadata, /main: dist\/index\.js/u);
  for (const forbidden of [/^author:/mu, /^branding:/mu, /^pre:/mu, /^post:/mu]) {
    assert.doesNotMatch(metadata, forbidden);
  }
  assert.deepEqual(actionBootstrap.OUTPUT_NAMES, OUTPUT_NAMES);
  assert.deepEqual(actionBootstrap.verifyRuntimeContext({
    serverUrl: "https://github.com",
    repository: DISTRIBUTION.repository,
    revision: DISTRIBUTION.revision,
    nodeMajor: 24,
  }), DISTRIBUTION);
  assert.doesNotThrow(() => actionBootstrap.verifyDistributionManifest());
  const manifest = actionBootstrap.verifyDistributionManifest();
  assert.equal(manifest.kind, "MemoryOSGitHubPolicyGateDistributionManifest");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.files.some(({ path }) => path === "distribution-manifest.json"), false);
  assert.deepEqual(manifest.files.map(({ path }) => path), actionBootstrap.enumerateClosure(ACTION_ROOT));
  assert.equal(manifest.files.filter(({ role }) => role === "actionMetadata").length, 1);
  assert.equal(manifest.files.filter(({ role }) => role === "entrypoint").length, 1);

  for (const context of [
    { serverUrl: "https://github.com", repository: "owner/other", revision: DISTRIBUTION.revision, nodeMajor: 24 },
    { serverUrl: "https://github.com", repository: DISTRIBUTION.repository, revision: "main", nodeMajor: 24 },
    { serverUrl: "https://github.com", repository: DISTRIBUTION.repository, revision: DISTRIBUTION.revision, nodeMajor: 22 },
    { serverUrl: "https://example.invalid", repository: DISTRIBUTION.repository, revision: DISTRIBUTION.revision, nodeMajor: 24 },
  ]) assert.throws(() => actionBootstrap.verifyRuntimeContext(context));
});

test("distribution verification rejects missing, changed, extra, misdeclared, and symlinked members", async (t) => {
  async function mutateAndReject(mutate) {
    const { actionRoot } = await makeActionDistributionCopy(t);
    await mutate(actionRoot);
    const bootstrap = loadDistributionCopy(actionRoot);
    assert.throws(() => bootstrap.verifyDistributionManifest());
  }

  await mutateAndReject(async (root) => {
    const path = join(root, "distribution-manifest.json");
    const value = JSON.parse(await readFile(path, "utf8"));
    value.files.splice(2, 1);
    await writeFile(path, actionBootstrap.canonicalJson(value));
  });
  await mutateAndReject(async (root) => {
    const path = join(root, "dist/action-runtime.mjs");
    await writeFile(path, Buffer.concat([await readFile(path), Buffer.from(" ")]));
  });
  await mutateAndReject(async (root) => {
    await writeFile(join(root, "dist/unlisted.js"), "export {};", "utf8");
  });
  await mutateAndReject(async (root) => {
    const path = join(root, "distribution-manifest.json");
    const value = JSON.parse(await readFile(path, "utf8"));
    value.files[0].byteCount += 1;
    await writeFile(path, actionBootstrap.canonicalJson(value));
  });
  await mutateAndReject(async (root) => {
    const path = join(root, "distribution-manifest.json");
    const value = JSON.parse(await readFile(path, "utf8"));
    value.files[0].rawSha256 = `sha256:${"0".repeat(64)}`;
    await writeFile(path, actionBootstrap.canonicalJson(value));
  });

  const { actionRoot } = await makeActionDistributionCopy(t);
  const member = join(actionRoot, "dist/contracts/policy-contract-identities-1.0.0.json");
  try {
    await unlink(member);
    await symlink(join(actionRoot, "action.yml"), member, "file");
    const bootstrap = loadDistributionCopy(actionRoot);
    assert.throws(() => bootstrap.verifyDistributionManifest());
  } catch (error) {
    if (["EPERM", "EACCES", "UNKNOWN"].includes(error.code)) t.diagnostic("symlink creation unavailable on this host");
    else throw error;
  }
});

test("PortablePath and action-input validation reject every frozen lexical attack class", async (t) => {
  assert.deepEqual(actionRuntime.validatePortablePath("a/B 1/c_d-e.json"), ["a", "B 1", "c_d-e.json"]);
  assert.equal(actionRuntime.validatePortablePath("", { optional: true }), null);
  const invalid = [
    "", " ", "/absolute", "C:/drive", "//unc/share", "../escape", "a/../escape",
    "https://example.invalid/a", "a\\b", "a:b", "a*", "a?", "a[0]", "CON", "nul.txt",
    " leading", "trailing ", "trailing.", ".", "..", "a//b", "~/.policy", "$ENV/policy",
    "a\0b",
  ];
  for (const value of invalid) {
    assert.throws(() => actionRuntime.validatePortablePath(value), (error) =>
      error.failure?.code === "MEMORYOS_CI_INPUT_PATH_INVALID" && error.failure.phase === "actionInput",
    value);
  }

  const fixture = await makeActionFixture(t);
  const cases = [
    [{ "INPUT_POLICY-KIND": "Policy" }, "MEMORYOS_CI_CLI_PROTOCOL_INVALID"],
    [{ "INPUT_EXPECTED-POLICY-SEMANTIC-DIGEST": "sha256:no" }, "MEMORYOS_CI_POLICY_PIN_MISMATCH"],
    [{ "INPUT_POLICY-PATH": "policies" }, "MEMORYOS_CI_INPUT_PATH_INVALID"],
    [{ "INPUT_CANDIDATE-MIP-PATH": "packages/missing.mip" }, "MEMORYOS_CI_INPUT_PATH_INVALID"],
  ];
  for (const [environment, code] of cases) {
    const result = await runActionFixture(fixture, "pass", { environment });
    assertAutomationFailure(result, code, "actionInput");
  }

  const symlinkPath = join(fixture.workspace, "packages", "candidate-link.mip");
  try {
    await symlink(join(fixture.workspace, ...fixture.paths.candidate.split("/")), symlinkPath, "file");
    const result = await runActionFixture(fixture, "pass", {
      environment: { "INPUT_CANDIDATE-MIP-PATH": "packages/candidate-link.mip" },
    });
    assertAutomationFailure(result, "MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
  } catch (error) {
    if (["EPERM", "EACCES", "UNKNOWN"].includes(error.code)) t.diagnostic("input symlink creation unavailable on this host");
    else throw error;
  }
  const directoryLink = join(fixture.workspace, "packages-link");
  try {
    await symlink(
      join(fixture.workspace, "packages"),
      directoryLink,
      process.platform === "win32" ? "junction" : "dir",
    );
    const result = await runActionFixture(fixture, "pass", {
      environment: { "INPUT_CANDIDATE-MIP-PATH": "packages-link/candidate.mip" },
    });
    assertAutomationFailure(result, "MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");
  } catch (error) {
    if (["EPERM", "EACCES", "UNKNOWN"].includes(error.code)) t.diagnostic("directory link creation unavailable on this host");
    else throw error;
  }
});

test("immutable snapshots isolate evaluation from post-capture caller mutations", async (t) => {
  const fixture = await makeActionFixture(t);
  let first = true;
  const spawn = spawnInterceptor(({ actual }) => {
    if (first) {
      first = false;
      writeFile(join(fixture.workspace, ...fixture.paths.pass.split("/")), "not json");
      writeFile(join(fixture.workspace, ...fixture.paths.candidate.split("/")), "not a mip");
    }
    return actual;
  });
  const result = await runActionFixture(fixture, "pass", { spawn });
  assert.equal(result.outputs.decision, "PASS");
  assert.equal(result.outputs["gate-class"], "pass");
  await removeRetained(result);
});

test("Layer B rejects every independently changed frozen identity and malformed protocol", async (t) => {
  const mutations = [
    (result) => { result.evaluatorVersion = "9.0.0"; },
    (result) => { result.factModel.factModelVersion = "9.0.0"; },
    (result) => { result.factModel.factModelDigest = `sha256:${"0".repeat(64)}`; },
    (result) => { result.ruleRegistry.ruleRegistryVersion = "9.0.0"; },
    (result) => { result.ruleRegistry.ruleRegistryDigest = `sha256:${"0".repeat(64)}`; },
    (result) => { result.deterministicFactSourceRegistry.registryVersion = "9.0.0"; },
    (result) => { result.deterministicFactSourceRegistry.registryDigest = `sha256:${"0".repeat(64)}`; },
    (result) => { result.deterministicFactSourceRegistry.sources[0].wireVersion = "9.0.0"; },
    (result) => { result.deterministicFactSourceRegistry.sources[0].sourceModelVersion = "9.0.0"; },
    (result) => { result.deterministicFactSourceRegistry.sources[0].sourceModelDigest = `sha256:${"0".repeat(64)}`; },
    (result) => { result.resourceProfile.identifier = "other"; },
    (result) => { result.resourceProfile.version = "9.0.0"; },
    (result) => { result.resourceProfile.resourceProfileDigest = `sha256:${"0".repeat(64)}`; },
    (result) => { result.outcomeContractVersion = "9.0.0"; },
  ];
  for (const mutate of mutations) {
    const fixture = await makeActionFixture(t);
    let intercepted = false;
    const spawn = spawnInterceptor(({ actual, args }) => {
      if (!intercepted && args.includes("identities")) {
        intercepted = true;
        return replaceCliEnvelope(actual, ({ result }) => mutate(result));
      }
      return actual;
    });
    const result = await runActionFixture(fixture, "pass", { spawn });
    assertAutomationFailure(result, "MEMORYOS_CI_CONTRACT_IDENTITY_MISMATCH", "contractIdentityPreflight");
  }

  const fixture = await makeActionFixture(t);
  const malformed = () => ({ error: undefined, signal: null, status: 0, stdout: Buffer.from("not json\n"), stderr: Buffer.alloc(0) });
  const result = await runActionFixture(fixture, "pass", { spawn: malformed });
  assertAutomationFailure(result, "MEMORYOS_CI_CLI_PROTOCOL_INVALID", "contractIdentityPreflight");
});

test("policy preparation enforces kind and semantic pins before evaluation", async (t) => {
  const fixture = await makeActionFixture(t);
  const mismatch = await runActionFixture(fixture, "pass", {
    environment: { "INPUT_EXPECTED-POLICY-SEMANTIC-DIGEST": `sha256:${"0".repeat(64)}` },
  });
  assertAutomationFailure(mismatch, "MEMORYOS_CI_POLICY_PIN_MISMATCH", "policyPreparation");

  let changed = false;
  const kindSpawn = spawnInterceptor(({ actual, args }) => {
    if (!changed && args.includes("digest")) {
      changed = true;
      return replaceCliEnvelope(actual, ({ result }) => { result.artifactKind = "MemoryOSInvestigationPolicySet"; });
    }
    return actual;
  });
  const kindMismatch = await runActionFixture(fixture, "pass", { spawn: kindSpawn });
  assertAutomationFailure(kindMismatch, "MEMORYOS_CI_POLICY_PIN_MISMATCH", "policyPreparation");
});

test("CLI transport accepts only one exact stdout envelope and propagates MO-1301 projections", () => {
  const request = {
    actionRoot: ACTION_ROOT,
    args: ["policy", "identities", "--json"],
    cwd: ACTION_ROOT,
    expectedCommand: "policy identities",
    invocation: "identitiesPreflight",
  };
  const identity = { kind: "test" };
  const success = actionRuntime.invokeCli({
    ...request,
    spawn: () => protocolResult("policy identities", identity, 0, true, Buffer.from("ignored diagnostic")),
  });
  assert.deepEqual({ ...success.result }, identity);

  for (let exitCode = 1; exitCode <= 5; exitCode += 1) {
    const failureClass = exitCode === 1 ? "usage" : (exitCode === 2 ? "preparation" : "operational");
    const error = mo1301Error({ exitCode, failureClass });
    assert.throws(() => actionRuntime.invokeCli({
      ...request,
      spawn: () => protocolResult("policy identities", error, exitCode, false),
    }), (failure) => {
      assert.deepEqual(failure.error, {
        artifactKind: error.artifactKind,
        code: error.code,
        exitCode,
        failureClass: error.failureClass,
        limitIdentifier: null,
        phase: error.phase,
      });
      return true;
    });
  }

  assertProtocolFailure(() => actionRuntime.invokeCli({
    ...request,
    spawn: () => ({ error: undefined, signal: null, status: 8, stdout: canonicalEnvelope("policy identities", identity), stderr: Buffer.alloc(0) }),
  }), "contractIdentityPreflight");
  assertProtocolFailure(() => actionRuntime.invokeCli({
    ...request,
    spawn: () => ({ error: undefined, signal: "SIGTERM", status: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }),
  }), "contractIdentityPreflight");
  assertProtocolFailure(() => actionRuntime.invokeCli({ ...request, spawn: () => { throw new Error("launch"); } }), "contractIdentityPreflight");
  assertProtocolFailure(() => actionRuntime.invokeCli({
    ...request,
    spawn: () => ({
      error: undefined,
      signal: null,
      status: 0,
      stderr: Buffer.alloc(0),
      stdout: Buffer.from("null\n"),
    }),
  }), "contractIdentityPreflight");
  for (const mutate of [
    (error) => { error.code = "INVALID\nCODE"; },
    (error) => { error.artifactKind = "Artifact\0Kind"; },
    (error) => { error.limitIdentifier = " limit"; },
    (error) => { error.phase = "phase\rbreak"; },
  ]) {
    const error = mo1301Error({ exitCode: 2, failureClass: "preparation" });
    mutate(error);
    assertProtocolFailure(() => actionRuntime.invokeCli({
      ...request,
      spawn: () => protocolResult("policy identities", error, 2, false),
    }), "contractIdentityPreflight");
  }
  assertProtocolFailure(() => actionRuntime.invokeCli({
    ...request,
    spawn: () => ({ error: undefined, signal: null, status: 0, stdout: Buffer.from("{}\n"), stderr: Buffer.alloc(0) }),
  }), "contractIdentityPreflight");
  const ciError = mo1301Error({ code: "MEMORYOS_CI_INTERNAL_FAILURE", exitCode: 5 });
  assertProtocolFailure(() => actionRuntime.invokeCli({
    ...request,
    spawn: () => protocolResult("policy identities", ciError, 5, false),
  }), "contractIdentityPreflight");
});

test("real bundled orchestration verifies PASS, FAIL, CNE, Policy Set, and trusted Regression", async (t) => {
  const scenarios = [
    ["pass", {}, "PASS", "0", "pass", "MemoryOSInvestigationPolicy", false],
    ["fail", {}, "FAIL", "6", "policy-fail", "MemoryOSInvestigationPolicy", false],
    ["cne", {}, "COULD_NOT_EVALUATE", "7", "policy-cne", "MemoryOSInvestigationPolicy", false],
    ["set", {}, "PASS", "0", "pass", "MemoryOSInvestigationPolicySet", false],
    ["cne", { "INPUT_REGRESSION-BASELINE-MIP-PATH": "packages/baseline.mip" }, "PASS", "0", "pass", "MemoryOSInvestigationPolicy", true],
  ];
  for (const [name, environment, decision, exitCode, gateClass, artifactKind, regression] of scenarios) {
    const fixture = await makeActionFixture(t);
    const result = await runActionFixture(fixture, name, { environment });
    assertClosedOutputs(result.outputs);
    assert.equal(result.jobSuccess, decision === "PASS");
    assert.equal(result.outputs.decision, decision);
    assert.equal(result.outputs["cli-exit-code"], exitCode);
    assert.equal(result.outputs["gate-class"], gateClass);
    assert.equal(result.outputs["publication-valid"], "true");
    assert.equal(result.outputs["artifact-kind"], artifactKind);
    assert.match(result.outputs["policy-semantic-digest"], DIGEST_PATTERN);
    assert.match(result.outputs["evaluation-identity-digest"], DIGEST_PATTERN);
    assert.match(result.outputs["outcome-digest"], DIGEST_PATTERN);
    assert.match(result.outputs["policy-fact-context-digest"], DIGEST_PATTERN);
    assert.equal(regression, result.outputs["regression-source-digest"].length > 0);
    if (regression) assert.match(result.outputs["regression-source-digest"], DIGEST_PATTERN);
    assert.equal(result.outputs["distribution-repository"], DISTRIBUTION.repository);
    assert.equal(result.outputs["distribution-revision"], DISTRIBUTION.revision);

    const retained = await retainedFiles(result);
    assert.deepEqual(retained.names, FINAL_FILES);
    const identity = parseCanonical(retained.files["evaluation-identity.json"]);
    const outcome = parseCanonical(retained.files["evaluation-outcome.json"]);
    assert.deepEqual(outcome.evaluationIdentity, identity);
    assert.equal(outcome.result.decision, decision);
    assert.equal(retained.files["evaluation-identity.sha256"].toString("ascii"), result.outputs["evaluation-identity-digest"]);
    assert.equal(retained.files["evaluation-outcome.sha256"].toString("ascii"), result.outputs["outcome-digest"]);
    assert.equal(retained.files["policy-identities.json"].at(-1), 0x0a);
    await removeRetained(result);
  }
});

test("valid MO-1301 evaluation failures propagate unchanged and publish no generation", async (t) => {
  const fixture = await makeActionFixture(t);
  const result = await runActionFixture(fixture, "pass", {
    environment: { "INPUT_CANDIDATE-MIP-PATH": fixture.paths.corrupt },
  });
  assert.equal(result.jobSuccess, false);
  assertClosedOutputs(result.outputs);
  assert.equal(result.outputs["gate-class"], "tool-failure");
  assert.equal(result.outputs["publication-valid"], "false");
  assert.notEqual(result.outputs["stable-code"], "");
  assert.doesNotMatch(result.outputs["stable-code"], /^MEMORYOS_CI_/u);
  assert.equal(result.outputs["artifact-directory"], "");
  assert.equal(result.outputs.decision, "");
});

test("postflight contract identity mismatch is rejected after otherwise valid reconstruction", async (t) => {
  const fixture = await makeActionFixture(t);
  let identities = 0;
  const spawn = spawnInterceptor(({ actual, args }) => {
    if (args.includes("identities")) {
      identities += 1;
      if (identities === 2) {
        return replaceCliEnvelope(actual, ({ result }) => { result.evaluatorVersion = "9.0.0"; });
      }
    }
    return actual;
  });
  const result = await runActionFixture(fixture, "pass", { spawn });
  assertAutomationFailure(result, "MEMORYOS_CI_CONTRACT_IDENTITY_MISMATCH", "postEvaluationIdentityRecheck");
});

test("generation verifier rejects every incomplete, malformed, extra, and mixed generation", async (t) => {
  const fixture = await makeActionFixture(t);
  const result = await runActionFixture(fixture, "pass");
  assert.equal(result.outputs.decision, "PASS");
  const evaluation = {
    decision: "PASS",
    evaluationIdentityDigest: result.outputs["evaluation-identity-digest"],
    outcomeDigest: result.outputs["outcome-digest"],
  };
  const baseline = join(fixture.root, "generation-baseline");
  await copyGeneration(result, baseline);
  assert.doesNotThrow(() => actionRuntime.verifyGeneration(baseline, evaluation));

  let ordinal = 0;
  async function reject(mutate) {
    const root = join(fixture.root, `generation-invalid-${ordinal += 1}`);
    await cp(baseline, root, { recursive: true });
    await mutate(root);
    assertGenerationFailure(() => actionRuntime.verifyGeneration(root, evaluation));
  }
  for (const name of actionRuntime.internalContract.GENERATION_FILE_NAMES) {
    await reject(async (root) => unlink(join(root, name)));
  }
  await reject(async (root) => writeFile(join(root, "extra"), "x"));
  await reject(async (root) => {
    const path = join(root, "evaluation-identity.sha256");
    await writeFile(path, Buffer.concat([await readFile(path), Buffer.from("\n")]));
  });
  const symlinkRoot = join(fixture.root, "generation-invalid-symlink");
  await cp(baseline, symlinkRoot, { recursive: true });
  try {
    const identity = join(symlinkRoot, "evaluation-identity.json");
    await unlink(identity);
    await symlink(join(symlinkRoot, "evaluation-outcome.json"), identity, "file");
    assertGenerationFailure(() => actionRuntime.verifyGeneration(symlinkRoot, evaluation));
  } catch (error) {
    if (["EPERM", "EACCES", "UNKNOWN"].includes(error.code)) t.diagnostic("generation symlink creation unavailable on this host");
    else throw error;
  }
  await reject(async (root) => {
    const path = join(root, "evaluation-identity.sha256");
    const bytes = await readFile(path);
    await writeFile(path, Buffer.from([...bytes].map((byte) => byte | 0x80)));
  });
  await reject(async (root) => writeFile(join(root, "evaluation-outcome.sha256"), `sha256:${"0".repeat(64)}`));
  await reject(async (root) => {
    const path = join(root, "evaluation-identity.json");
    const identity = JSON.parse(await readFile(path, "utf8"));
    identity.evaluatedArtifact.semanticDigest = `sha256:${"0".repeat(64)}`;
    await writeFile(path, canonicalBytes(identity));
  });
  await reject(async (root) => {
    const path = join(root, "evaluation-outcome.json");
    const outcome = JSON.parse(await readFile(path, "utf8"));
    outcome.evaluationIdentity.evaluatorVersion = "9.0.0";
    await writeFile(path, canonicalBytes(outcome));
  });
  await removeRetained(result);
});

test("artifact verifier rejections remain MO-1301 failures and reconstruction contradictions are Action failures", async (t) => {
  const targets = [
    ["verify-identity", "artifact", "POLICY_EVALUATION_IDENTITY_SCHEMA_INVALID"],
    ["verify-outcome", "artifact", "POLICY_EVALUATION_OUTCOME_SCHEMA_INVALID"],
    ["verify-outcome", "evaluation", "POLICY_EVALUATION_OUTCOME_RECONSTRUCTION_MISMATCH"],
  ];
  for (const [command, mode, code] of targets) {
    const fixture = await makeActionFixture(t);
    const spawn = spawnInterceptor(({ actual, args }) => {
      const modeIndex = args.indexOf("--mode");
      if (args.includes(command) && modeIndex >= 0 && args[modeIndex + 1] === mode) {
        return protocolResult(
          command === "verify-identity" ? "policy verify-identity" : "policy verify-outcome",
          mo1301Error({ code, exitCode: 2, phase: "artifactIntake" }),
          2,
          false,
        );
      }
      return actual;
    });
    const result = await runActionFixture(fixture, "pass", { spawn });
    assert.equal(result.outputs["stable-code"], code);
    assert.notEqual(result.outputs["failure-class"], "automation");
    assert.equal(result.outputs["publication-valid"], "false");
    assert.equal(result.outputs["artifact-directory"], "");
  }

  const fixture = await makeActionFixture(t);
  const contradiction = spawnInterceptor(({ actual, args }) => {
    const modeIndex = args.indexOf("--mode");
    if (args.includes("verify-outcome") && modeIndex >= 0 && args[modeIndex + 1] === "evaluation") {
      return replaceCliEnvelope(actual, ({ result }) => { result.decision = "FAIL"; });
    }
    return actual;
  });
  const result = await runActionFixture(fixture, "pass", { spawn: contradiction });
  assertAutomationFailure(result, "MEMORYOS_CI_AUTHORITATIVE_RECONSTRUCTION_FAILED", "authoritativeReconstruction");
});

test("all six wrong decision/exit pairings are rejected after full verification", async (t) => {
  const cases = [
    ["pass", 6], ["pass", 7],
    ["fail", 0], ["fail", 7],
    ["cne", 0], ["cne", 6],
  ];
  for (const [name, replacementExit] of cases) {
    const fixture = await makeActionFixture(t);
    const spawn = spawnInterceptor(({ actual, args }) => {
      if (args.includes("evaluate")) return { ...actual, status: replacementExit };
      return actual;
    });
    const result = await runActionFixture(fixture, name, { spawn });
    assertAutomationFailure(result, "MEMORYOS_CI_DECISION_EXIT_MISMATCH", "decisionExitCrossCheck");
    assert.equal(result.outputs["cli-exit-code"], String(replacementExit));
  }
});

test("receipt is deterministic, closed, path-free, self-exclusionary, and hashes exactly five retained files", async (t) => {
  const fixture = await makeActionFixture(t);
  const result = await runActionFixture(fixture, "pass");
  const { files, names } = await retainedFiles(result);
  assert.deepEqual(names, FINAL_FILES);
  assert.equal(files["gate-receipt.json"].at(-1), 0x7d);
  const receipt = parseCanonical(files["gate-receipt.json"]);
  await validateJsonSchema(
    receipt,
    new URL("../schema/github-policy-gate-receipt-1.0.schema.json", import.meta.url),
  );
  assert.deepEqual(Object.keys(receipt).sort(), [
    "contractIdentities", "decision", "distribution", "evaluationIdentityDigest", "kind",
    "originalCliExitCode", "outcomeDigest", "policy", "policyFactContextDigest",
    "publicationValid", "regressionSourceDigest", "retainedFileRawSha256", "version",
  ]);
  assert.equal(receipt.kind, "MemoryOSGitHubPolicyGateReceipt");
  assert.equal(receipt.version, "1.0.0");
  assert.equal(receipt.publicationValid, true);
  assert.deepEqual(Object.keys(receipt.retainedFileRawSha256).sort(), FINAL_FILES.filter((name) => name !== "gate-receipt.json"));
  for (const [name, digest] of Object.entries(receipt.retainedFileRawSha256)) {
    assert.equal(digest, rawSha256(files[name]));
  }
  const text = files["gate-receipt.json"].toString("utf8");
  assert.doesNotMatch(text, /gate-receipt\.json|timestamp|generatedAt|diagnostic|\\|memoryos-mo1302-action-/u);
  assert.equal(canonicalBytes(receipt).equals(files["gate-receipt.json"]), true);
  await removeRetained(result);
});

test("retained publication rejects a post-verification generation mutation", async (t) => {
  const fixture = await makeActionFixture(t);
  let identities = 0;
  let sealedRoot;
  const spawn = spawnInterceptor(({ actual, args }) => {
    const verifyIdentityIndex = args.indexOf("verify-identity");
    if (verifyIdentityIndex >= 0) sealedRoot = dirname(args[verifyIdentityIndex + 1]);
    if (args.includes("identities")) {
      identities += 1;
      if (identities === 2) {
        const sidecar = join(sealedRoot, "evaluation-outcome.sha256");
        chmodSync(sidecar, 0o600);
        unlinkSync(sidecar);
        writeFileSync(sidecar, `sha256:${"0".repeat(64)}`);
      }
    }
    return actual;
  });
  const result = await runActionFixture(fixture, "pass", { spawn });
  assertAutomationFailure(
    result,
    "MEMORYOS_CI_ARTIFACT_PUBLICATION_FAILED",
    "artifactPublication",
  );
});

test("outputs are exactly nineteen safe scalars for verified and failed invocations", async (t) => {
  const fixture = await makeActionFixture(t);
  const pass = await runActionFixture(fixture, "pass");
  assertClosedOutputs(pass.outputs);
  assert.deepEqual(Object.keys(pass.outputs), OUTPUT_NAMES);

  const invalid = await runActionFixture(fixture, "pass", {
    environment: { "INPUT_POLICY-PATH": "../escape" },
  });
  assertAutomationFailure(invalid, "MEMORYOS_CI_INPUT_PATH_INVALID", "actionInput");

  const outputRoot = await mkdtemp(join(tmpdir(), "memoryos-output-api-"));
  t.after(async () => rm(outputRoot, { force: true, recursive: true }));
  const outputFile = join(outputRoot, "output.txt");
  actionBootstrap.writeOutputs(actionBootstrap.emptyOutputs(), outputFile);
  assert.equal((await readFile(outputFile, "utf8")).split("\n").filter(Boolean).length, 19);
  for (const bad of ["line\nfeed", "carriage\rreturn", "nul\0byte"]) {
    const values = actionBootstrap.emptyOutputs();
    values.decision = bad;
    assert.throws(() => actionBootstrap.writeOutputs(values, outputFile));
  }
  await removeRetained(pass);
});

test("Phase 1 distribution remains isolated from shell, network, authority upgrade, and Phase 2 workflow code", async () => {
  const runtime = await readFile(resolve(ACTION_ROOT, "dist/action-runtime.mjs"), "utf8");
  const bootstrap = await readFile(resolve(ACTION_ROOT, "dist/index.js"), "utf8");
  const driver = await readFile(resolve(ACTION_ROOT, "dist/cli-driver.mjs"), "utf8");
  const complete = `${runtime}\n${bootstrap}\n${driver}`;
  assert.match(runtime, /spawn\(process\.execPath/u);
  assert.match(runtime, /shell: false/u);
  assert.doesNotMatch(runtime, /env\.PATH|environment\.PATH|\bPATH\b.*memoryos/iu);
  assert.doesNotMatch(complete, /npm install|npm ci|pnpm|yarn|child_process\.exec\(|\bfetch\s*\(|node:(?:http|https|net|dns)|\bundici\b/iu);
  assert.doesNotMatch(complete, /authoritative.*(?:fromJson|deserialize)|upgradeAuthority|providerRegistration/iu);
  for (const phrase of ["actions/checkout", "actions/download-artifact", "actions/upload-artifact", "GITHUB_STEP_SUMMARY", "::warning", "::error"]) {
    assert.equal(complete.includes(phrase), false, phrase);
  }

  const fixtureRoot = await mkdtemp(join(tmpdir(), "memoryos-shell-data-"));
  try {
    let error;
    try {
      actionRuntime.validatePortablePath("$(touch pwned)");
      assert.fail("shell metacharacters must not pass PortablePath validation");
    } catch (cause) {
      error = cause;
    }
    assert.equal(error.failure.code, "MEMORYOS_CI_INPUT_PATH_INVALID");
    assert.deepEqual(await readdir(fixtureRoot), []);
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
});
