import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { normalizeEvidenceOutput, WORKSPACE_ROOT } from "./support/conformance-support.mjs";

function summaryCount(output, name) {
  const value = [...output.matchAll(new RegExp(`^# ${name} ([0-9]+)$`, "gmu"))].at(-1)?.[1];
  assert.notEqual(value, undefined, `child TAP omitted ${name} summary`);
  return Number(value);
}

function runTests(relativePaths, expectedTests, options = {}) {
  const { deterministicConformance = false, emit = true, expectedSkipped = [] } = options;
  const arguments_ = ["--test", "--test-reporter=tap"];
  arguments_.push(...relativePaths.map((path) => resolve(WORKSPACE_ROOT, path)));
  const environment = { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", TZ: "UTC" };
  if (deterministicConformance) environment.MEMORYOS_DETERMINISTIC_CONFORMANCE = "1";
  else delete environment.MEMORYOS_DETERMINISTIC_CONFORMANCE;
  delete environment.NODE_TEST_CONTEXT;
  delete environment.NODE_TEST_NAME_PATTERN;
  delete environment.NODE_TEST_REPORTER;
  const result = spawnSync(process.execPath, arguments_, {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    env: environment,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(
    result.status,
    0,
    `Component evidence failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
  );
  assert.equal(result.stderr, "", `Component evidence emitted stderr:\n${result.stderr}`);
  assert.equal(summaryCount(result.stdout, "tests"), expectedTests, "child TAP test-count mismatch");
  assert.equal(
    summaryCount(result.stdout, "pass"),
    expectedTests - expectedSkipped.length,
    "child TAP pass-count mismatch",
  );
  for (const counter of ["fail", "cancelled", "todo"]) {
    assert.equal(summaryCount(result.stdout, counter), 0, `child TAP reported ${counter}`);
  }
  assert.equal(
    summaryCount(result.stdout, "skipped"),
    expectedSkipped.length,
    "child TAP skipped-count mismatch",
  );
  for (const title of expectedSkipped) {
    assert.match(
      result.stdout,
      new RegExp(`# Subtest: ${title.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\r?\\n(?:ok|not ok) [0-9]+ - .* # SKIP`, "u"),
      `child TAP did not skip only the declared timing case '${title}'`,
    );
  }
  if (emit) process.stdout.write(result.stdout);
  return result.stdout;
}

test("Investigation Core and native lifecycle/artifact evidence passes", () => {
  runTests([
    "repositories/cca-studio/tests/investigation_core_test.mjs",
    "repositories/cca-studio/tests/memory_studio_integration_test.mjs",
    "repositories/cca-studio/tests/memory_studio_web_test.mjs",
  ], 99);
});

test("the complete deterministic CCA-MIP conformance evidence passes", () => {
  runTests([
    "repositories/cca-studio/tests/memory_investigation_package_test.mjs",
    "repositories/cca-studio/tests/mip_adversarial_conformance_test.mjs",
    "repositories/cca-studio/tests/mip_canonical_test.mjs",
    "repositories/cca-studio/tests/mip_derived_edge_conformance_test.mjs",
    "repositories/cca-studio/tests/mip_ordering_conformance_test.mjs",
    "repositories/cca-studio/tests/mip_pipeline_conformance_test.mjs",
    "repositories/cca-studio/tests/mip_schema_conformance_test.mjs",
  ], 59);
});

test("AI Runtime Adapter contract evidence passes", () => {
  runTests(["repositories/cca-studio/tests/ai_runtime_adapter_test.mjs"], 35);
});

test("JavaScript SDK parity evidence passes", () => {
  runTests(["repositories/cca-studio/tests/memoryos_sdk_test.mjs"], 11);
});

test("Cognitive Investigation Explorer evidence passes", () => {
  runTests(["repositories/cca-studio/tests/cognitive_investigation_explorer_test.mjs"], 8, {
    deterministicConformance: true,
    expectedSkipped: ["MO-1207 Explorer is read-only and deterministic under bounded navigation"],
  });
});

test("Cognitive Regression deterministic evidence passes", () => {
  runTests(["repositories/cca-studio/tests/cognitive_regression_test.mjs"], 13, {
    deterministicConformance: true,
    expectedSkipped: ["MO-1206 Regression remains deterministic under repeated bounded analysis"],
  });
});

test("CLI contract evidence passes sequentially", () => {
  runTests(["repositories/memoryos-cli/tests/architecture.test.mjs"], 5);
  runTests(["repositories/memoryos-cli/tests/cli-contract.test.mjs"], 5);
  runTests(["repositories/memoryos-cli/tests/package-workflow.test.mjs"], 10);
  runTests(["repositories/memoryos-cli/tests/session.test.mjs"], 6);
  runTests(["repositories/memoryos-cli/tests/investigate.test.mjs"], 5, {
    deterministicConformance: true,
    expectedSkipped: ["investigate remains bounded for a complete deterministic Regression Report"],
  });
  runTests(["repositories/memoryos-cli/tests/human-output.test.mjs"], 1);
});

test("the child harness rejects downstream failure and zero-work execution", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "memoryos-component-evidence-"));
  try {
    const failure = resolve(directory, "failure.mjs");
    const zeroWork = resolve(directory, "zero-work.mjs");
    writeFileSync(
      failure,
      'import test from "node:test"; test("sentinel", () => { throw new Error("sentinel"); });\n',
      "utf8",
    );
    writeFileSync(zeroWork, "export {};\n", "utf8");
    assert.throws(() => runTests([failure], 1, { emit: false }), /Component evidence failed/u);
    assert.throws(() => runTests([zeroWork], 2, { emit: false }), /child TAP test-count mismatch/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("retained native output normalization removes every GoogleTest timing form", () => {
  assert.equal(
    normalizeEvidenceOutput("[----------] 376 tests (170 ms total)\n[ RUN ] X.Y (3 ms)\n"),
    "[----------] 376 tests (<elapsed>)\n[ RUN ] X.Y (<elapsed>)\n",
  );
});
