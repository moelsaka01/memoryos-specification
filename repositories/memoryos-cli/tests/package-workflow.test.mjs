import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SELECTORS,
  assertCanonicalJson,
  makeFixtures,
  parseJsonOutput,
  runCli,
} from "./test-helpers.mjs";

test("verify delegates valid and invalid package truth with exit code 3 on failure", async (t) => {
  const fixture = await makeFixtures(t);
  const valid = runCli(["verify", fixture.packagePath, "--json"]);
  assert.equal(valid.status, 0);
  assert.equal(valid.stderr, "");
  assert.deepEqual(parseJsonOutput(valid).result, {
    diagnosticCount: 0,
    diagnostics: [],
    status: "passed",
    valid: true,
  });

  for (const path of [fixture.corruptPackagePath, fixture.emptyPackagePath]) {
    const first = runCli(["verify", path, "--json"]);
    const second = runCli(["verify", path, "--json"]);
    assert.equal(first.status, 3);
    assert.equal(first.stdout, "");
    assert.equal(first.stderr, second.stderr);
    assertCanonicalJson(first.stderr);
    const value = parseJsonOutput(first, "stderr");
    assert.equal(value.error.code, "VERIFICATION_FAILED");
    assert.equal(value.error.exitCode, 3);
    assert.ok(value.error.details.length > 0);
  }
});

test("import and inspect expose the same deterministic SDK investigation metadata", async (t) => {
  const fixture = await makeFixtures(t);
  const options = [fixture.packagePath, "--id", "cli-package-metadata", "--json"];
  const imported = runCli(["import", ...options]);
  const inspected = runCli(["inspect", ...options]);
  assert.equal(imported.status, 0);
  assert.equal(inspected.status, 0);
  const importResult = parseJsonOutput(imported).result;
  const inspectResult = parseJsonOutput(inspected).result;
  assert.deepEqual(inspectResult, importResult);
  assert.deepEqual(
    {
      identifier: importResult.identifier,
      lifecycle: importResult.lifecycle,
      phase: importResult.phase,
      sourceKind: importResult.sourceKind,
      transitionCount: importResult.transitionCount,
      workspaceIdentifier: importResult.workspaceIdentifier,
    },
    {
      identifier: "cli-package-metadata",
      lifecycle: "Observed",
      phase: "observe",
      sourceKind: "mip",
      transitionCount: 2,
      workspaceIdentifier: "workspace-investigation",
    },
  );
});

test("trace requires and preserves one exact package Trace selector", async (t) => {
  const fixture = await makeFixtures(t);
  const traced = runCli([
    "trace", fixture.packagePath,
    "--reflection", SELECTORS.trace,
    "--id", "cli-trace",
    "--json",
  ]);
  assert.equal(traced.status, 0);
  const result = parseJsonOutput(traced).result;
  assert.equal(result.lifecycle, "ReplayReady");
  assert.equal(result.phase, "trace");
  assert.equal(result.availability.replay, true);
  assert.equal(result.transitionCount, 4);

  const missing = runCli([
    "trace", fixture.packagePath,
    "--reflection", "trace-does-not-exist",
    "--json",
  ]);
  assert.equal(missing.status, 4);
  assert.equal(parseJsonOutput(missing, "stderr").error.code, "CAPABILITY_UNAVAILABLE");
});

test("replay applies repeated SDK actions in caller order and is deterministic", async (t) => {
  const fixture = await makeFixtures(t);
  const arguments_ = [
    "replay", fixture.packagePath,
    "--trace", SELECTORS.trace,
    "--action", "play",
    "--action", "pause",
    "--action", "next",
    "--action", "previous",
    "--action", "restart",
    "--action", "next",
    "--action", "advance",
    "--id", "cli-replay-actions",
    "--json",
  ];
  const first = runCli(arguments_);
  const second = runCli(arguments_);
  assert.equal(first.status, 0);
  assert.equal(first.stderr, "");
  assert.equal(first.stdout, second.stdout);
  assertCanonicalJson(first.stdout);
  const result = parseJsonOutput(first).result;
  assert.equal(result.identifier, "cli-replay-actions");
  assert.equal(result.lifecycle, "Replaying");
  assert.equal(result.phase, "replay");
  assert.equal(result.replayIdentifier, "replay-observation-b");
  assert.equal(result.replayStatus, "paused");
  assert.equal(result.cursor, 0);

  const unsupported = runCli([
    "replay", fixture.packagePath,
    "--trace", SELECTORS.trace,
    "--action", "complete",
    "--json",
  ]);
  assert.equal(unsupported.status, 2);
  assert.equal(parseJsonOutput(unsupported, "stderr").error.code, "INVALID_REPLAY_ACTION");
});

test("compare uses one package, completes its Replay, and enters exact Evolution", async (t) => {
  const fixture = await makeFixtures(t);
  const arguments_ = [
    "compare", fixture.packagePath,
    "--trace", SELECTORS.trace,
    "--evolution", SELECTORS.evolution,
    "--id", "cli-compare",
    "--json",
  ];
  const first = runCli(arguments_);
  const second = runCli(arguments_);
  assert.equal(first.status, 0);
  assert.equal(first.stdout, second.stdout);
  const result = parseJsonOutput(first).result;
  assert.equal(result.identifier, "cli-compare");
  assert.equal(result.evolutionIdentifier, SELECTORS.evolution);
  assert.equal(result.lifecycle, "ComparisonReady");
  assert.equal(result.phase, "evolution");
  assert.equal(result.stage, "evolution");
  assert.equal(result.replaySteps, 9);
  assert.equal(result.transitionCount, 14);

  const crossPackage = runCli([
    "compare", fixture.packagePath, fixture.packagePath,
    "--trace", SELECTORS.trace,
    "--evolution", SELECTORS.evolution,
    "--json",
  ]);
  assert.equal(crossPackage.status, 1);
});

test("export is a byte-for-byte SDK round trip for files and stdout", async (t) => {
  const fixture = await makeFixtures(t);
  const exported = runCli([
    "export", fixture.packagePath,
    "--output", fixture.outputPath,
    "--id", "cli-export",
    "--json",
  ]);
  assert.equal(exported.status, 0);
  assert.equal(exported.stderr, "");
  const result = parseJsonOutput(exported).result;
  assert.equal(result.byteLength, fixture.packageBytes.length);
  assert.equal(result.packageKind, "MemoryInvestigationPackage");
  assert.equal(result.packageVersion, "1.0.0");
  assert.deepEqual(await readFile(fixture.outputPath), fixture.packageBytes);

  const raw = runCli([
    "export", fixture.packagePath,
    "--output", "-",
    "--id", "cli-export-stdout",
  ], { binary: true });
  assert.equal(raw.status, 0);
  assert.equal(raw.stderr.length, 0);
  assert.deepEqual(raw.stdout, fixture.packageBytes);

  const conflict = runCli([
    "export", fixture.packagePath,
    "--output", "-",
    "--json",
  ]);
  assert.equal(conflict.status, 1);
  assert.equal(conflict.stdout, "");
});

test("package stdin supports non-interactive verification and import", async (t) => {
  const fixture = await makeFixtures(t);
  const verified = runCli(["verify", "-", "--json"], { input: fixture.packageBytes });
  assert.equal(verified.status, 0);
  assert.equal(parseJsonOutput(verified).result.valid, true);

  const imported = runCli(["import", "-", "--id", "cli-stdin", "--json"], {
    input: fixture.packageBytes,
  });
  assert.equal(imported.status, 0);
  assert.equal(parseJsonOutput(imported).result.identifier, "cli-stdin");
});

test("invalid package import is reported as a package error", async (t) => {
  const fixture = await makeFixtures(t);
  const invalid = runCli(["import", fixture.corruptPackagePath, "--json"]);
  assert.equal(invalid.status, 4);
  assert.equal(invalid.stdout, "");
  const value = parseJsonOutput(invalid, "stderr");
  assert.equal(value.error.exitCode, 4);
  assert.ok(value.error.details.length > 0);
});
