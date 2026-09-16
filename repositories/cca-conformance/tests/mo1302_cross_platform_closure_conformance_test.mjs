import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import {
  ACTION_ROOT,
  DISTRIBUTION,
  OUTPUT_NAMES,
  WORKSPACE_ROOT,
  actionRuntime,
  rawSha256,
  removeRetained,
} from "./support/mo1302-action-foundation-support.mjs";
import {
  FINAL_FILES,
  OS_LABELS,
  readOracle,
  verifyGeneration,
} from "../tools/mo1302-hosted-evidence.mjs";
import {
  EXPECTED_NATIVE_POLICY_TESTS,
  NATIVE_POLICY_TEST_REGEX,
  createNativeEvidence,
  validateCTestJUnit,
  validateNativeEvidence,
  validateRegistrationDocument,
} from "../tools/mo1302-native-evidence.mjs";

const CONFORMANCE_ROOT = resolve(WORKSPACE_ROOT, "repositories/cca-conformance");
const INVENTORY_PATH = resolve(CONFORMANCE_ROOT, "mo1302-conformance-inventory.json");
const ENGINEERING_WORKFLOW = ".github/workflows/memoryos-policy-gate-engineering.yml";
const HOSTED_WORKFLOW = ".github/workflows/memoryos-policy-gate-hosted.yml";
const NATIVE_WORKFLOW = ".github/workflows/memoryos-native-policy-gate.yml";
const PRODUCTION_WORKFLOW = ".github/workflows/memoryos-policy-gate.yml";
const WORKFLOW_PATHS = Object.freeze([
  ENGINEERING_WORKFLOW,
  HOSTED_WORKFLOW,
  NATIVE_WORKFLOW,
  PRODUCTION_WORKFLOW,
]);
const PHASE3_COMMIT = "a58db3e1c7b57ca077f31b6814c2514e7a9e51be";
const PHASE3_BINDING_COMMIT = "8949dc9191f5a32c3f6a466cbc067c4effbcc480";
const PHASE3_SUBJECT = "feat(memoryos-1.3): MO-1302 phase 3 cross-platform closure";
const CLOSURE_SUBJECT = "conformance(memoryos-1.3): bind MO-1302 phase 3 revision";
const CORRECTION_SUBJECT = "fix(memoryos-1.3): close MO-1302 hosted release gates";
const CORRECTION_BINDING_SUBJECT =
  "conformance(memoryos-1.3): bind MO-1302 hosted correction";
const HOSTED_CORRECTION_BINDING_COMMIT = "b14fa0d1c165283a4f80cff8e9669ce2070dc7fc";
const NATIVE_CORRECTION_SUBJECT = "fix(memoryos-1.3): close MO-1302 native hosted build";
const NATIVE_CORRECTION_BINDING_SUBJECT =
  "conformance(memoryos-1.3): bind MO-1302 native hosted correction";
const FULL_SHA = /^[0-9a-f]{40}$/u;
const PINS = Object.freeze([
  Object.freeze({
    role: "checkout",
    repository: "actions/checkout",
    revision: "3d3c42e5aac5ba805825da76410c181273ba90b1",
  }),
  Object.freeze({
    role: "downloadArtifact",
    repository: "actions/download-artifact",
    revision: "3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c",
  }),
  Object.freeze({
    role: "setupPython",
    repository: "actions/setup-python",
    revision: "a26af69be951a213d495a4c3e4e4022e16d87065",
  }),
  Object.freeze({
    role: "uploadArtifact",
    repository: "actions/upload-artifact",
    revision: "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
  }),
]);
const POLICY_GTEST_FILTER = [
  "MemoryOsSdk.ExposesVersionedImmutableValueHandles",
  "MemoryOsSdk.DelegatesPolicySemanticsAndRetainsExactBytes",
  "MemoryOsSdk.EvaluatesPolicySetAndCneAsNormalOutcomes",
  "MemoryOsSdk.PreservesMetadataIsolationAndExactCachedBytes",
  "MemoryOsSdk.EvaluatesAnAuthoritativeMipBackedContext",
  "MemoryOsSdk.CapturesAndVerifiesTrustedRegressionPolicyFacts",
  "MemoryOsSdk.VerifiesAllFrozenPolicyEvaluationArtifactsExactly",
  "MemoryOsSdk.PreservesStablePolicyErrorsAcrossTheBridge",
].join(":");

async function text(path) {
  return readFile(resolve(WORKSPACE_ROOT, ...path.split("/")), "utf8");
}

async function inventory() {
  return JSON.parse(await readFile(INVENTORY_PATH, "utf8"));
}

function git(...arguments_) {
  const result = spawnSync("git", arguments_, {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.error, undefined, `git ${arguments_.join(" ")} failed to start`);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function workflowUses(source) {
  return [...source.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s*#.*)?$/gmu)]
    .map((match) => match[1]);
}

function runBlocks(source) {
  const lines = source.split(/\r?\n/u);
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(\s*)run:\s*(.*)$/u.exec(lines[index]);
    if (!match) continue;
    const indentation = match[1].length;
    const members = [match[2]];
    for (index += 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim() === "") {
        members.push(line);
        continue;
      }
      const childIndentation = line.length - line.trimStart().length;
      if (childIndentation <= indentation) {
        index -= 1;
        break;
      }
      members.push(line);
    }
    blocks.push(members.join("\n"));
  }
  return blocks;
}

function validRegistration() {
  return {
    kind: "ctestInfo",
    version: { major: 1, minor: 0 },
    tests: [
      {
        name: "memoryos.sdk.cpp.policy.contract",
        command: [
          "/build/memoryos_sdk_cpp_tests",
          `--gtest_filter=${POLICY_GTEST_FILTER}`,
        ],
        properties: [{
          name: "LABELS",
          value: ["contract", "cpp", "memoryos", "policy", "sdk"],
        }],
      },
      {
        name: "memoryos.sdk.cpp.policy.example",
        command: ["/build/memoryos_sdk_cpp_policy"],
        properties: [{
          name: "LABELS",
          value: ["cpp", "example", "memoryos", "sdk"],
        }],
      },
    ],
  };
}

function validJunit() {
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<testsuite tests=\"2\" failures=\"0\" errors=\"0\" disabled=\"0\" skipped=\"0\">",
    "<testcase name=\"memoryos.sdk.cpp.policy.contract\" status=\"run\"/>",
    "<testcase name=\"memoryos.sdk.cpp.policy.example\" status=\"run\"/>",
    "</testsuite>",
  ].join("");
}

test("engineering and native matrices freeze the exact required hosted runners", async () => {
  assert.deepEqual(OS_LABELS, ["ubuntu-24.04", "windows-2022", "macos-14"]);
  for (const path of [ENGINEERING_WORKFLOW, NATIVE_WORKFLOW]) {
    const source = await text(path);
    assert.match(source, /^\s{6}fail-fast: false$/mu);
    assert.match(source, /^\s{8}os: \[ubuntu-24\.04, windows-2022, macos-14\]$/mu);
    assert.match(source, /^\s{4}runs-on: \$\{\{ matrix\.os \}\}$/mu);
    assert.doesNotMatch(source, /(?:ubuntu|windows|macos)-latest/u);
  }
});

test("the engineering workflow exercises real PASS, FAIL, CNE, Regression, and pin rejection", async () => {
  const source = await text(ENGINEERING_WORKFLOW);
  assert.equal((source.match(/uses: \$\/\.github\/actions\/memoryos-policy-gate/gu) ?? []).length, 5);
  for (const identifier of ["pass", "fail", "cne", "regression", "pin-mismatch"]) {
    assert.match(source, new RegExp(`^\\s{8}id: ${identifier}$`, "mu"));
  }
  assert.equal((source.match(/continue-on-error: true/gu) ?? []).length, 3);
  assert.match(source, /MO_SCENARIO: pass/u);
  assert.match(source, /MO_SCENARIO: fail/u);
  assert.match(source, /MO_SCENARIO: cne/u);
  assert.match(source, /MO_SCENARIO: regression/u);
  assert.match(source, /expected-policy-semantic-digest: sha256:0{64}/u);
  assert.equal((source.match(/uses: actions\/download-artifact@/gu) ?? []).length, 3);
  for (const os of OS_LABELS) assert.match(source, new RegExp(`name: mo1302-action-parity-${os}`, "u"));
  assert.match(source, /node repositories\/cca-conformance\/tools\/mo1302-hosted-evidence\.mjs compare-platforms/u);
});

test("hosted validation composes the reusable workflow with the canonical check and closed scenarios", async () => {
  const source = await text(HOSTED_WORKFLOW);
  const options = [...source.matchAll(/^\s{10}- (direct-pass|artifact-pass|regression-pass|fail|cne)$/gmu)]
    .map((match) => match[1]);
  assert.deepEqual(options, ["direct-pass", "artifact-pass", "regression-pass", "fail", "cne"]);
  assert.match(source, /^\s{2}memoryos-policy-gate:$/mu);
  assert.match(source, /^\s{4}uses: \$\/\.github\/workflows\/memoryos-policy-gate\.yml$/mu);
  assert.match(source, /if: always\(\)/u);
  assert.equal((source.match(/overwrite: false/gu) ?? []).length, 2);
  assert.match(source, /MO_DUPLICATE_UPLOAD_OUTCOME/u);
  assert.match(
    source,
    /candidate-mip-path: \$\{\{ inputs\.scenario != 'artifact-pass' && 'repositories\/cca-studio\/examples\/ai-runtime-adapters\/reference-packages\/openai-agents-reference\.mip' \|\| '' \}\}/u,
  );
  assert.match(
    source,
    /candidate-mip-artifact-name: \$\{\{ inputs\.scenario == 'artifact-pass' && format\('mo1302-candidate-\{0\}-\{1\}', github\.run_id, github\.run_attempt\) \|\| '' \}\}/u,
  );
  assert.doesNotMatch(source, /inputs\.scenario == 'artifact-pass' && '' \|\|/u);
  assert.match(source, /artifact-ids: \$\{\{ steps\.resolve\.outputs\.artifact-id \}\}/u);
  const helper = await text("repositories/cca-conformance/tools/mo1302-hosted-evidence.mjs");
  assert.match(helper, /actions\/runs\/\$\{runId\}\/attempts\/\$\{attempt\}\/jobs\?per_page=100/u);
  assert.doesNotMatch(helper, /jobs\?filter=all/u);
  assert.match(helper, /job\.name === "memoryos-policy-gate \/ MemoryOS Policy Gate"/u);
  assert.match(helper, /retentionMs > 0/u);
  assert.deepEqual(FINAL_FILES, [
    "evaluation-identity.json",
    "evaluation-identity.sha256",
    "evaluation-outcome.json",
    "evaluation-outcome.sha256",
    "gate-receipt.json",
    "policy-identities.json",
  ]);
});

test("workflow static security rejects mutable, privileged, or shell-injected construction", async () => {
  for (const path of WORKFLOW_PATHS) {
    const source = await text(path);
    assert.doesNotMatch(source, /pull_request_target|self-hosted|actions\/cache@|secrets\.|secrets:\s*inherit/u);
    assert.doesNotMatch(source, /^\s*[A-Za-z][A-Za-z0-9-]*:\s*write\s*$/mu);
    assert.doesNotMatch(source, /(?:npm|pnpm|yarn)\s+(?:ci|install)|\b(?:curl|wget)\b/iu);
    for (const block of runBlocks(source)) assert.doesNotMatch(block, /\$\{\{/u);
    for (const reference of workflowUses(source)) {
      assert.doesNotMatch(reference, /\$\{\{/u);
      if (reference.startsWith("$/")) continue;
      assert.match(reference, /^[a-z0-9_.-]+\/[a-z0-9_.-]+@[0-9a-f]{40}$/u);
    }
  }
});

test("third-party Action references exactly match the complete immutable pin inventory", async () => {
  const record = await inventory();
  assert.deepEqual(record.thirdPartyActionPins.scopedFiles, WORKFLOW_PATHS);
  assert.deepEqual(record.thirdPartyActionPins.pins, PINS);
  const actual = new Set();
  for (const path of record.thirdPartyActionPins.scopedFiles) {
    for (const reference of workflowUses(await text(path))) {
      if (!reference.startsWith("$/")) actual.add(reference);
    }
  }
  assert.deepEqual(actual, new Set(PINS.map(
    ({ repository, revision }) => `${repository}@${revision}`,
  )));
  for (const pin of PINS) assert.match(pin.revision, FULL_SHA);
});

test("the hosted oracle is canonical and binds the frozen decision and byte identities", async () => {
  const oraclePath = resolve(
    CONFORMANCE_ROOT,
    "tests/fixtures/github-policy-gate/1.0.0/hosted/oracle.json",
  );
  const bytes = await readFile(oraclePath);
  const oracle = await readOracle();
  assert.equal(bytes.at(-1), 0x0a);
  assert.equal(Buffer.from(JSON.stringify(oracle)).equals(bytes.subarray(0, -1)), true);
  assert.deepEqual(Object.keys(oracle.scenarios), ["cne", "fail", "pass", "regression"]);
  assert.deepEqual(
    Object.fromEntries(Object.entries(oracle.scenarios).map(([name, value]) => [name, value.decision])),
    { cne: "COULD_NOT_EVALUATE", fail: "FAIL", pass: "PASS", regression: "PASS" },
  );
  assert.equal(oracle.scenarios.pass.cliExitCode, "0");
  assert.equal(oracle.scenarios.fail.cliExitCode, "6");
  assert.equal(oracle.scenarios.cne.cliExitCode, "7");
  assert.match(oracle.scenarios.regression.regressionSourceDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(oracle.candidateMip.rawSha256, rawSha256(await readFile(resolve(
    WORKSPACE_ROOT,
    ...oracle.candidateMip.path.split("/"),
  ))));
});

test("the real bundled Action reproduces every oracle generation and detects byte drift", async (t) => {
  const oracle = await readOracle();
  const runnerTemp = await mkdtemp(join(tmpdir(), "memoryos-mo1302-phase3-action-"));
  t.after(() => rm(runnerTemp, { force: true, recursive: true }));
  const manifestDigest = sha256(await readFile(resolve(ACTION_ROOT, "distribution-manifest.json")));
  const previousRevision = process.env.MO_EXPECTED_DISTRIBUTION_REVISION;
  process.env.MO_EXPECTED_DISTRIBUTION_REVISION = DISTRIBUTION.revision;
  t.after(() => {
    if (previousRevision === undefined) delete process.env.MO_EXPECTED_DISTRIBUTION_REVISION;
    else process.env.MO_EXPECTED_DISTRIBUTION_REVISION = previousRevision;
  });

  for (const scenario of ["pass", "fail", "cne", "regression"]) {
    const expected = oracle.scenarios[scenario];
    const result = await actionRuntime.runAction({
      actionRoot: ACTION_ROOT,
      distribution: DISTRIBUTION,
      distributionManifestRawSha256: manifestDigest,
      outputNames: OUTPUT_NAMES,
      environment: {
        GITHUB_WORKSPACE: WORKSPACE_ROOT,
        RUNNER_TEMP: runnerTemp,
        "INPUT_POLICY-KIND": "policy",
        "INPUT_POLICY-PATH": expected.policyPath,
        "INPUT_EXPECTED-POLICY-SEMANTIC-DIGEST": expected.policySemanticDigest,
        "INPUT_CANDIDATE-MIP-PATH": oracle.candidateMip.path,
        "INPUT_REGRESSION-BASELINE-MIP-PATH": scenario === "regression"
          ? oracle.candidateMip.path
          : "",
      },
    });
    try {
      assert.equal(result.outputs.decision, expected.decision);
      assert.equal(result.outputs["cli-exit-code"], expected.cliExitCode);
      assert.equal(result.outputs["gate-class"], expected.gateClass);
      assert.equal(result.outputs["policy-semantic-digest"], expected.policySemanticDigest);
      assert.equal(result.outputs["policy-fact-context-digest"], expected.policyFactContextDigest);
      assert.equal(result.outputs["regression-source-digest"], expected.regressionSourceDigest);
      assert.equal(result.outputs["evaluation-identity-digest"], expected.evaluationIdentity.digest);
      assert.equal(result.outputs["outcome-digest"], expected.outcome.digest);
      await verifyGeneration(result.outputs["artifact-directory"], scenario, oracle);

      if (scenario === "pass") {
        const changed = join(runnerTemp, "changed-generation");
        await mkdir(changed);
        for (const name of FINAL_FILES) {
          await writeFile(changed + `/${name}`, await readFile(join(result.outputs["artifact-directory"], name)));
        }
        await writeFile(
          join(changed, "evaluation-outcome.json"),
          Buffer.concat([await readFile(join(changed, "evaluation-outcome.json")), Buffer.from(" ")]),
        );
        await assert.rejects(verifyGeneration(changed, scenario, oracle), /Outcome byte count differs/u);
      }
    } finally {
      await removeRetained(result);
    }
  }
});

test("the native workflow proves registration before an anchored two-test execution and install", async () => {
  const source = await text(NATIVE_WORKFLOW);
  const registration = source.indexOf("ctest --test-dir out/build/ci --show-only=json-v1");
  const execution = source.indexOf(
    'ctest --test-dir out/build/ci -R "^memoryos\\.sdk\\.cpp\\.(policy\\.contract|policy\\.example)$"',
  );
  const install = source.indexOf("cmake --install out/build/ci --prefix out/stage");
  assert.ok(registration >= 0 && execution > registration && install > execution);
  assert.match(source, /cmake --preset ci/u);
  assert.match(source, /cmake --build --preset ci/u);
  assert.match(source, /--no-tests=error/u);
  assert.match(source, /--output-junit out\/native-policy-evidence\/ctest-results\.xml/u);
  assert.match(source, /node repositories\/cca-conformance\/tools\/mo1302-native-evidence\.mjs validate/u);
});

test("native registration, JUnit, and closed evidence validators accept exact PASS evidence", () => {
  const registration = validateRegistrationDocument(validRegistration());
  assert.deepEqual(registration.registeredTests, EXPECTED_NATIVE_POLICY_TESTS);
  const results = validateCTestJUnit(validJunit());
  assert.deepEqual(results, EXPECTED_NATIVE_POLICY_TESTS.map((name) => ({ name, result: "PASS" })));
  const evidence = createNativeEvidence({
    commit: "a".repeat(40),
    compiler: { identifier: "GNU", version: "14.2.0" },
    installedFiles: [
      "include/memoryos/memoryos.hpp",
      "lib/libmemoryos-sdk.a",
      "share/cca-studio/web/js/investigation-policy-engine.js",
      "share/memoryos-sdk/bridge/investigation-core-host.mjs",
    ],
    registration,
    runner: { label: "ubuntu-24.04", operatingSystem: "Linux", architecture: "X64" },
    testResults: results,
  });
  assert.equal(validateNativeEvidence(evidence), evidence);
  assert.equal(evidence.authority, "nonNormativeEngineeringEvidence");
});

test("native validators reject missing, duplicate, disabled, failed, skipped, and open evidence", () => {
  const missing = validRegistration();
  missing.tests.pop();
  assert.throws(() => validateRegistrationDocument(missing), /missing/u);

  const duplicate = validRegistration();
  duplicate.tests.push(structuredClone(duplicate.tests[0]));
  assert.throws(() => validateRegistrationDocument(duplicate), /repeats/u);

  const disabled = validRegistration();
  disabled.tests[0].properties.push({ name: "DISABLED", value: "TRUE" });
  assert.throws(() => validateRegistrationDocument(disabled), /disabled/u);

  assert.throws(
    () => validateCTestJUnit(validJunit().replace('failures="0"', 'failures="1"')),
    /exactly two passing tests/u,
  );
  assert.throws(
    () => validateCTestJUnit(validJunit().replace('skipped="0"', 'skipped="1"')),
    /exactly two passing tests/u,
  );

  const registration = validateRegistrationDocument(validRegistration());
  const results = validateCTestJUnit(validJunit());
  const evidence = createNativeEvidence({
    commit: "a".repeat(40),
    compiler: { identifier: "GNU", version: "14.2.0" },
    installedFiles: [
      "include/memoryos/memoryos.hpp",
      "lib/libmemoryos-sdk.a",
      "share/cca-studio/web/js/investigation-policy-engine.js",
      "share/memoryos-sdk/bridge/investigation-core-host.mjs",
    ],
    registration,
    runner: { label: "ubuntu-24.04", operatingSystem: "Linux", architecture: "X64" },
    testResults: results,
  });
  assert.throws(() => validateNativeEvidence({ ...evidence, extra: true }), /members must be exactly/u);
});

test("the native dependency manifest uses the pinned repository-supported GoogleTest port", async () => {
  const manifest = JSON.parse(await text("vcpkg.json"));
  assert.equal(manifest["builtin-baseline"], "cd61e1e26a038e82d6550a3ebbe0fbbfe7da78e3");
  assert.deepEqual(manifest.dependencies, ["gtest", "yaml-cpp"]);
  assert.equal(manifest.dependencies.includes("googletest"), false);
  const workspaceVerifier = await text("tools/verify_workspace.py");
  assert.match(workspaceVerifier, /if "gtest" not in dependencies:/u);
  assert.doesNotMatch(workspaceVerifier, /must provide googletest/u);
  const cmake = await text("repositories/cca-sdk/CMakeLists.txt");
  assert.match(cmake, /find_package\(GTest CONFIG REQUIRED\)/u);
  for (const name of EXPECTED_NATIVE_POLICY_TESTS) assert.match(cmake, new RegExp(name.replaceAll(".", "\\."), "u"));
});

test("native corrective sources remain portable under the frozen strict warning profile", async () => {
  const [studioTest, observabilityTest, coreProcess] = await Promise.all([
    text("repositories/cca-studio/tests/memory_studio_test.cpp"),
    text("repositories/cca-core/tests/observability_test.cpp"),
    text("repositories/cca-sdk/src/core_process.cpp"),
  ]);
  assert.match(studioTest, /explicit Fixture\(std::string workspace_identifier_value\s*=/u);
  assert.doesNotMatch(studioTest, /explicit Fixture\(std::string workspace_identifier\s*=/u);
  assert.match(observabilityTest, /std::vector<std::thread> threads;/u);
  assert.match(observabilityTest, /for \(auto& worker : threads\) \{\s*worker\.join\(\);\s*\}/u);
  assert.doesNotMatch(observabilityTest, /std::jthread/u);
  assert.match(
    coreProcess,
    /#if defined\(_WIN32\)\s*#ifndef NOMINMAX\s*#define NOMINMAX\s*#endif\s*#include <Windows\.h>/u,
  );
});

test("the final additive inventory closes every Phase 3 implementation and evidence surface", async () => {
  const record = await inventory();
  assert.equal(record.kind, "MemoryOSMO1302ConformanceInventory");
  assert.equal(record.version, "1.0.0");
  assert.deepEqual(record.runnerMatrices.hosted, OS_LABELS);
  assert.deepEqual(record.runnerMatrices.native, OS_LABELS);
  assert.equal(record.actionDistribution.fileCount, 42);
  assert.equal(
    record.actionDistribution.manifestRawSha256,
    "sha256:2e116b6518934c797e9c562670f2292462be11ee982c778b43f1aaf45a8986f9",
  );
  assert.equal(record.hostedEvidence.status, "requiresPush");
  for (const state of Object.values(record.hostedEvidence)) {
    if (typeof state === "string" && state !== "requiresPush") assert.equal(state, "pendingPublication");
  }
  for (const binding of Object.values(record.hostedEvidence.fixtures)) {
    assert.equal(binding.rawSha256, sha256(await readFile(resolve(
      WORKSPACE_ROOT,
      ...binding.path.split("/"),
    ))));
  }
  for (const path of [
    ...record.implementationSurface,
    ...record.conformanceSurface,
    ...record.documentationSurface,
  ]) await readFile(resolve(WORKSPACE_ROOT, ...path.split("/")));
  for (const path of [
    "repositories/cca-compiler/tests/parser_test.cpp",
    "repositories/cca-core/tests/observability_test.cpp",
    "repositories/cca-sdk/tests/memoryos_sdk_test.cpp",
    "repositories/cca-studio/tests/memory_studio_test.cpp",
  ]) assert.ok(record.conformanceSurface.includes(path));
  for (const path of [
    "repositories/cca-compiler/src/parser.cpp",
    "repositories/cca-core/src/runtime/service_registry.cpp",
    "repositories/cca-sdk/src/core_process.cpp",
    "repositories/cca-sdk/src/json.hpp",
  ]) assert.ok(record.implementationSurface.includes(path));

  const bindings = [
    [record.handoffArtifacts.document, "repositories/cca-conformance/docs/mo1302-handoff.md"],
    [record.handoffArtifacts.vector, "repositories/cca-conformance/tests/fixtures/investigation-policy/1.0.0/mo1302-handoff-vectors.json"],
    [record.handoffArtifacts.mo1301Inventory, "repositories/cca-conformance/mo1301-conformance-inventory.json"],
    [record.actionDistribution.metadata, ".github/actions/memoryos-policy-gate/action.yml"],
    [record.actionDistribution.manifest, ".github/actions/memoryos-policy-gate/distribution-manifest.json"],
  ];
  for (const [binding, expectedPath] of bindings) {
    assert.equal(binding.path, expectedPath);
    assert.equal(binding.rawSha256, sha256(await readFile(resolve(WORKSPACE_ROOT, ...expectedPath.split("/")))));
  }
});

test("documentation provides immutable examples, local parity, security, limitations, and roadmap boundaries", async () => {
  const guide = await text("repositories/cca-conformance/docs/mo1302-github-policy-gate.md");
  const engineering = await text("repositories/cca-conformance/docs/mo1302-engineering-conformance.md");
  const joined = `${guide}\n${engineering}`;
  assert.match(joined, /memoryos-policy-gate \/ MemoryOS Policy Gate/u);
  assert.match(joined, /candidate-mip-path/u);
  assert.match(joined, /candidate-mip-artifact-name/u);
  assert.match(joined, /regression-baseline/u);
  assert.match(joined, /Layer A/u);
  assert.match(joined, /Layer B/u);
  assert.match(joined, /branch protection/iu);
  assert.match(joined, /GitHub\.com/u);
  assert.match(joined, /GitHub Enterprise Server|GHES/u);
  assert.match(joined, /MO-1303/u);
  assert.match(joined, /MO-1306/u);
  assert.match(joined, /MO-1307/u);
  for (const command of [
    "policy identities",
    "policy digest",
    "policy evaluate",
    "verify-identity",
    "verify-outcome",
  ]) assert.match(joined, new RegExp(command, "u"));
  assert.doesNotMatch(joined, /uses:\s+[^\s]+@(?:main|master|v1|memoryos-1\.3-mo1302)\b/u);
  assert.match(joined, /uses:\s+moelsaka01\/memoryos-specification\/\.github\/workflows\/memoryos-policy-gate\.yml@[0-9a-f]{40}/u);
});

test("the Phase 3 commit binding remains historically immutable", async () => {
  const binding = (await inventory()).phase3CommitBinding;
  assert.equal(binding.strategy, "postCommitConformanceCommit");
  assert.equal(binding.status, "bound");
  assert.equal(binding.revision, PHASE3_COMMIT);
  assert.equal(git("rev-parse", `${PHASE3_BINDING_COMMIT}^`), PHASE3_COMMIT);
  assert.equal(git("show", "-s", "--format=%s", PHASE3_COMMIT), PHASE3_SUBJECT);
  assert.equal(git("show", "-s", "--format=%s", PHASE3_BINDING_COMMIT), CLOSURE_SUBJECT);
  assert.deepEqual(git("diff", "--name-only", PHASE3_COMMIT, PHASE3_BINDING_COMMIT).split(/\r?\n/u), [
    "repositories/cca-conformance/mo1302-conformance-inventory.json",
    "repositories/cca-conformance/tests/mo1302_cross_platform_closure_conformance_test.mjs",
  ]);
});

test("the hosted correction uses a separate two-commit self-reference strategy", async () => {
  const binding = (await inventory()).hostedCorrectionCommitBinding;
  assert.equal(binding.strategy, "postCommitConformanceCommit");
  const head = git("rev-parse", "HEAD");
  const subject = git("show", "-s", "--format=%s", "HEAD");
  if (binding.status === "mechanicallyPending") {
    assert.equal(binding.revision, "PENDING");
    assert.ok(head === PHASE3_BINDING_COMMIT || subject === CORRECTION_SUBJECT);
    return;
  }
  assert.equal(binding.status, "bound");
  assert.match(binding.revision, FULL_SHA);
  assert.equal(git("show", "-s", "--format=%s", binding.revision), CORRECTION_SUBJECT);
  assert.equal(git("merge-base", "--is-ancestor", binding.revision, "HEAD"), "");
  const descendants = git(
    "rev-list",
    "--first-parent",
    "--reverse",
    `${binding.revision}..HEAD`,
  ).split(/\r?\n/u).filter(Boolean);
  assert.ok(descendants.length >= 1);
  const bindingCommit = descendants[0];
  assert.equal(git("rev-parse", `${bindingCommit}^`), binding.revision);
  assert.equal(git("show", "-s", "--format=%s", bindingCommit), CORRECTION_BINDING_SUBJECT);
  assert.deepEqual(git("diff", "--name-only", binding.revision, bindingCommit).split(/\r?\n/u), [
    "repositories/cca-conformance/mo1302-conformance-inventory.json",
    "repositories/cca-conformance/tests/mo1302_cross_platform_closure_conformance_test.mjs",
  ]);
});

test("the native hosted correction uses a distinct two-commit self-reference strategy", async () => {
  const binding = (await inventory()).nativeHostedCorrectionCommitBinding;
  assert.equal(binding.strategy, "postCommitConformanceCommit");
  const head = git("rev-parse", "HEAD");
  const subject = git("show", "-s", "--format=%s", "HEAD");
  if (binding.status === "mechanicallyPending") {
    assert.equal(binding.revision, "PENDING");
    assert.ok(head === HOSTED_CORRECTION_BINDING_COMMIT || subject === NATIVE_CORRECTION_SUBJECT);
    return;
  }
  assert.equal(binding.status, "bound");
  assert.match(binding.revision, FULL_SHA);
  assert.equal(git("show", "-s", "--format=%s", binding.revision), NATIVE_CORRECTION_SUBJECT);
  assert.equal(git("merge-base", "--is-ancestor", binding.revision, "HEAD"), "");
  const descendants = git(
    "rev-list",
    "--first-parent",
    "--reverse",
    `${binding.revision}..HEAD`,
  ).split(/\r?\n/u).filter(Boolean);
  assert.ok(descendants.length >= 1);
  const bindingCommit = descendants[0];
  assert.equal(git("rev-parse", `${bindingCommit}^`), binding.revision);
  assert.equal(git("show", "-s", "--format=%s", bindingCommit), NATIVE_CORRECTION_BINDING_SUBJECT);
  assert.deepEqual(git("diff", "--name-only", binding.revision, bindingCommit).split(/\r?\n/u), [
    "repositories/cca-conformance/mo1302-conformance-inventory.json",
  ]);
});
