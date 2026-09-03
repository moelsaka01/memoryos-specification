import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import {
  assertCanonicalJson,
  assertPresentationFree,
  makeFixtures,
  parseJsonOutput,
  runCli,
} from "./test-helpers.mjs";

function category(report, name) {
  return report.categories.find(({ category: value }) => value === name);
}

test("investigate delegates raw and enveloped Regression Reports with stable JSON", async (t) => {
  const fixture = await makeFixtures(t);
  const arguments_ = ["investigate", fixture.regressionReportPath, "--json"];
  const first = runCli(arguments_);
  const second = runCli(arguments_);
  assert.equal(first.status, 0);
  assert.equal(first.stderr, "");
  assert.equal(first.stdout, second.stdout);
  assertCanonicalJson(first.stdout);

  const result = parseJsonOutput(first).result;
  const expectedCount = fixture.regressionReport.categories.reduce(
    (sum, entry) => sum + entry.differences.length,
    0,
  );
  assert.equal(result.kind, "MemoryOSCognitiveInvestigationResult");
  assert.equal(result.regressionIdentifier, fixture.regressionReport.identifier);
  assert.equal(result.status, "matched");
  assert.equal(result.matchCount, expectedCount);
  assert.deepEqual(result.query, {
    category: null,
    reflectionIdentifier: null,
    transition: null,
  });
  assertPresentationFree(result);

  const envelope = runCli([
    "investigate", fixture.regressionEnvelopePath, "--json",
  ]);
  assert.equal(envelope.status, 0);
  assert.deepEqual(parseJsonOutput(envelope).result, result);

  const streamed = runCli(["investigate", "-", "--json"], {
    input: JSON.stringify({
      command: "regression",
      ok: true,
      result: fixture.regressionReport,
      schemaVersion: "1.0",
    }),
  });
  assert.equal(streamed.status, 0);
  assert.deepEqual(parseJsonOutput(streamed).result, result);

  const empty = runCli([
    "investigate", fixture.regressionReportPath,
    "--category", "lifecycle",
    "--json",
  ]);
  assert.equal(empty.status, 0);
  assert.deepEqual(
    {
      matchCount: parseJsonOutput(empty).result.matchCount,
      status: parseJsonOutput(empty).result.status,
    },
    { matchCount: 0, status: "empty" },
  );

  const human = runCli(arguments_.slice(0, -1));
  assert.equal(human.status, 0);
  assert.equal(human.stderr, "");
  assert.match(human.stdout, /^MemoryOS investigate\n/u);
  assert.match(human.stdout, /matches\[0\]\.category:/u);
  assert.doesNotMatch(human.stdout, /\[object Object\]|\u001b\[|\d{4}-\d{2}-\d{2}T/u);
});

test("investigate selects Evidence, Reflection, Retrieval, and Evolution through the SDK", async (t) => {
  const fixture = await makeFixtures(t);
  for (const selected of ["evidence", "reflection", "retrieval", "evolution"]) {
    const execution = runCli([
      "investigate", fixture.regressionReportPath,
      "--category", selected,
      "--json",
    ]);
    assert.equal(execution.status, 0, selected);
    const result = parseJsonOutput(execution).result;
    assert.equal(result.query.category, selected);
    assert.ok(result.matchCount > 0, selected);
    assert.ok(result.matches.every(({ category: value }) => value === selected), selected);
  }

  const reflectionIdentifier = category(
    fixture.regressionReport,
    "reflection",
  ).differences[0].subject.identifier;
  const reflection = runCli([
    "investigate", fixture.regressionReportPath,
    "--category", "reflection",
    "--reflection", reflectionIdentifier,
    "--json",
  ]);
  assert.equal(reflection.status, 0);
  const result = parseJsonOutput(reflection).result;
  assert.equal(result.query.reflectionIdentifier, reflectionIdentifier);
  assert.ok(result.matches.length > 0);
  assert.ok(result.matches.every(({ category: value, subject }) => (
    value === "reflection" && subject.identifier === reflectionIdentifier
  )));
});

test("investigate selects Replay, Transition, and Verification facts exactly", async (t) => {
  const fixture = await makeFixtures(t);
  const replay = runCli([
    "investigate", fixture.replayRegressionReportPath,
    "--category", "replay",
    "--json",
  ]);
  assert.equal(replay.status, 0);
  const replayResult = parseJsonOutput(replay).result;
  assert.ok(replayResult.matchCount > 0);
  assert.ok(replayResult.matches.every(({ category: value }) => value === "replay"));

  const transition = runCli([
    "investigate", fixture.regressionReportPath,
    "--transition", "package-imported",
    "--json",
  ]);
  assert.equal(transition.status, 0);
  const transitionResult = parseJsonOutput(transition).result;
  assert.equal(transitionResult.query.transition, "package-imported");
  assert.ok(transitionResult.matchCount > 0);
  assert.ok(transitionResult.matches.every(({ category: value }) => (
    value === "transition" || value === "lifecycle"
  )));

  const verification = runCli([
    "investigate", fixture.verificationRegressionReportPath,
    "--category", "verification",
    "--json",
  ]);
  assert.equal(verification.status, 0);
  const verificationResult = parseJsonOutput(verification).result;
  assert.ok(verificationResult.matchCount > 0);
  assert.ok(verificationResult.matches.every(({ category: value }) => value === "verification"));
});

test("investigate rejects invalid grammar, reports, categories, and selector combinations", async (t) => {
  const fixture = await makeFixtures(t);
  for (const arguments_ of [
    ["investigate", "--json"],
    ["investigate", fixture.regressionReportPath, fixture.regressionReportPath, "--json"],
    ["investigate", fixture.regressionReportPath, "--unknown", "value", "--json"],
  ]) {
    const result = runCli(arguments_);
    assert.equal(result.status, 1, arguments_.join(" "));
    assert.equal(parseJsonOutput(result, "stderr").error.exitCode, 1);
  }

  const reflectionIdentifier = category(
    fixture.regressionReport,
    "reflection",
  ).differences[0].subject.identifier;
  for (const arguments_ of [
    ["investigate", fixture.invalidJsonPath, "--json"],
    ["investigate", fixture.malformedRegressionReportPath, "--json"],
    ["investigate", fixture.regressionReportPath, "--category", "unknown", "--json"],
    [
      "investigate", fixture.regressionReportPath,
      "--reflection", reflectionIdentifier,
      "--transition", "package-imported",
      "--json",
    ],
    [
      "investigate", fixture.regressionReportPath,
      "--category", "evidence",
      "--reflection", reflectionIdentifier,
      "--json",
    ],
  ]) {
    const first = runCli(arguments_);
    const second = runCli(arguments_);
    assert.equal(first.status, 2, arguments_.join(" "));
    assert.equal(first.stdout, "");
    assert.equal(first.stderr, second.stderr);
    assertCanonicalJson(first.stderr);
  }
});

test("investigate remains bounded for a complete deterministic Regression Report", async (t) => {
  const fixture = await makeFixtures(t);
  const started = performance.now();
  const result = runCli(["investigate", fixture.regressionReportPath, "--json"]);
  const elapsed = performance.now() - started;
  assert.equal(result.status, 0);
  assert.ok(elapsed < 5_000, `Investigation CLI exceeded 5 seconds: ${elapsed}ms`);
});
