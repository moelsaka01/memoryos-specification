#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const testsRoot = resolve(root, "tests");
const expectedFiles = Object.freeze([
  "boundary_contract_conformance_test.mjs",
  "compatibility_conformance_test.mjs",
  "component_evidence_conformance_test.mjs",
  "coverage_gap_conformance_test.mjs",
  "independent_assessment_conformance_test.mjs",
  "mo1301_integration_conformance_test.mjs",
  "mo1302_action_foundation_conformance_test.mjs",
  "mo1302_cross_platform_closure_conformance_test.mjs",
  "mo1302_github_product_conformance_test.mjs",
  "mo1303_phase1_conformance_test.mjs",
  "mo1303_phase2_conformance_test.mjs",
  "mo1303_phase3_conformance_test.mjs",
  "mo1304_phase1_conformance_test.mjs",
  "mo1304_phase2_conformance_test.mjs",
  "mo1304_phase3_ubuntu_conformance_test.mjs",
  "mo1304_phase3_windows_conformance_test.mjs",
  "mo1304_platform_support_conformance_test.mjs",
  "mo1305_host_guard_test.mjs",
  "mo1305_phase1_conformance_test.mjs",
  "normative_vectors_conformance_test.mjs",
  "reference_implementation_conformance_test.mjs",
  "report_conformance_test.mjs",
  "requirement_selector_catalog_test.mjs",
  "schema_validation_conformance_test.mjs",
  "specification_conformance_test.mjs",
]);

function locatePython() {
  const configured = [
    process.env.MEMORYOS_CONFORMANCE_PYTHON,
    process.env.Python3_EXECUTABLE,
    process.env.PYTHON,
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  const candidates = configured.length > 0 ? configured : ["python3", "python"];
  for (const candidate of candidates) {
    const probe = spawnSync(
      candidate,
      ["-c", "import os,sys; print(os.path.realpath(sys.executable))"],
      { encoding: "utf8", windowsHide: true },
    );
    if (probe.error || probe.status !== 0 || probe.stderr !== "") continue;
    const lines = probe.stdout.trim().split(/\r?\n/u).filter(Boolean);
    if (lines.length !== 1) continue;
    const executable = resolve(lines[0]);
    try {
      if (statSync(executable).isFile()) return executable;
    } catch {
      // Continue through the deterministic candidate list.
    }
  }
  throw new Error(
    "The conformance suite requires Python; set MEMORYOS_CONFORMANCE_PYTHON to a Python executable.",
  );
}

function summaryCount(output, name) {
  const value = [...output.matchAll(new RegExp(`^# ${name} ([0-9]+)$`, "gmu"))].at(-1)?.[1];
  assert.notEqual(value, undefined, `Node test output omitted ${name}`);
  return Number(value);
}

const actualFiles = (await readdir(testsRoot))
  .filter((path) => path.endsWith("_test.mjs"))
  .sort();
assert.deepEqual(actualFiles, expectedFiles, "conformance test inventory changed without registration");

// The MO-1305 installed-artifact gate has a Windows-only support contract.
const selectedFiles = actualFiles.filter((path) =>
  !["mo1305_host_guard_test.mjs", "mo1305_phase1_conformance_test.mjs"].includes(path) || process.platform === "win32");

const python = locatePython();
const environment = {
  ...process.env,
  MEMORYOS_CONFORMANCE_PYTHON: python,
  NO_COLOR: "1",
  TZ: "UTC",
};
const adjacentStandard = resolve(root, "../../../cca-specifications/specifications/CCA-MEMORYOS-1.0");
try {
  if (statSync(adjacentStandard).isDirectory()) {
    environment.MEMORYOS_STANDARD_ROOT = adjacentStandard;
    environment.MEMORYOS_REQUIRE_PUBLISHED_STANDARD = "1";
  }
} catch {
  if (environment.MEMORYOS_STANDARD_ROOT) environment.MEMORYOS_REQUIRE_PUBLISHED_STANDARD = "1";
}
delete environment.FORCE_COLOR;
delete environment.NODE_TEST_CONTEXT;
delete environment.NODE_TEST_NAME_PATTERN;
delete environment.NODE_TEST_REPORTER;

const result = spawnSync(
  process.execPath,
  [
    "--test",
    "--test-concurrency=1",
    "--test-reporter=tap",
    ...selectedFiles.map((path) => resolve(testsRoot, path)),
  ],
  {
    cwd: root,
    encoding: "utf8",
    env: environment,
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  },
);
assert.ifError(result.error);
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
assert.equal(result.status, 0, "conformance test process failed");
assert.equal(result.stderr, "", "conformance tests emitted stderr");
const executedTests = summaryCount(result.stdout, "tests");
assert.ok(executedTests > 0, "conformance suite executed no tests");
assert.equal(summaryCount(result.stdout, "pass"), executedTests, "not every registered test passed");
for (const counter of ["fail", "cancelled", "skipped", "todo"]) {
  assert.equal(summaryCount(result.stdout, counter), 0, `Node test output reported ${counter}`);
}
