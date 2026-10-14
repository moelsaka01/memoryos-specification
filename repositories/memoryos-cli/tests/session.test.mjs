import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import test from "node:test";

import {
  SELECTORS,
  assertCanonicalJson,
  makeFixtures,
  parseJsonLines,
  runCli,
} from "./test-helpers.mjs";

function workflow(records) {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

test("session preserves opaque checkpoints and restores exact SDK state", async (t) => {
  const fixture = await makeFixtures(t);
  const input = workflow([
    { command: "import", package: fixture.packagePath, identifier: "session-checkpoint" },
    { command: "trace", reflection: SELECTORS.trace },
    { command: "replay", action: "open" },
    { command: "replay", action: "next" },
    { command: "checkpoint", name: "after-origin" },
    { command: "restore", name: "after-origin" },
    { command: "inspect" },
    { command: "replay", action: "next" },
    { command: "inspect" },
  ]);
  const first = runCli(["session", "--json"], { input });
  const second = runCli(["session", "--json"], { input });
  assert.equal(first.status, 0);
  assert.equal(first.stderr, "");
  assert.equal(first.stdout, second.stdout);
  assertCanonicalJson(first.stdout);
  const records = parseJsonLines(first.stdout);
  assert.equal(records.length, 9);
  assert.deepEqual(records[4].result, { name: "after-origin", stored: true });

  const checkpointState = records[3].result;
  const restoredState = records[5].result;
  const inspectedRestoredState = records[6].result;
  const mutatedState = records[8].result;
  assert.notEqual(mutatedState.transitionLogDigest, checkpointState.transitionLogDigest);
  assert.equal(restoredState.transitionLogDigest, checkpointState.transitionLogDigest);
  assert.equal(restoredState.transitionCount, checkpointState.transitionCount);
  assert.deepEqual(inspectedRestoredState, restoredState);
  assert.doesNotMatch(first.stdout, /checkpointToken|stateDigest|transitionLogDigest.*after-origin/u);
});

test("checkpoint names cannot restore across live CLI sessions", async (t) => {
  const fixture = await makeFixtures(t);
  const create = runCli(["session", "--json"], {
    input: workflow([
      { command: "import", package: fixture.packagePath },
      { command: "checkpoint", name: "process-local" },
    ]),
  });
  assert.equal(create.status, 0);

  const restore = runCli(["session", "--json"], {
    input: workflow([{ command: "restore", name: "process-local" }]),
  });
  assert.equal(restore.status, 2);
  const [failure] = parseJsonLines(restore.stdout);
  assert.equal(failure.error.code, "UNKNOWN_CHECKPOINT");
  assert.equal(failure.error.exitCode, 2);
});

test("session executes Trace, complete Replay, and Compare in one live SDK", async (t) => {
  const fixture = await makeFixtures(t);
  const replaySteps = Array.from({ length: 9 }, () => ({
    command: "replay",
    action: "next",
  }));
  const input = workflow([
    { command: "import", package: fixture.packagePath, identifier: "session-compare" },
    { command: "trace", reflection: SELECTORS.trace },
    { command: "replay", action: "open" },
    ...replaySteps,
    { command: "compare", evolution: SELECTORS.evolution },
    { command: "inspect" },
  ]);
  const result = runCli(["session", "--json"], { input });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const records = parseJsonLines(result.stdout);
  const completedReplay = records.at(-3).result;
  const comparison = records.at(-2).result;
  const inspection = records.at(-1).result;
  assert.equal(completedReplay.replayStatus, "completed");
  assert.equal(completedReplay.cursor, 8);
  assert.equal(comparison.evolutionIdentifier, SELECTORS.evolution);
  assert.equal(comparison.stage, "evolution");
  assert.equal(comparison.lifecycle, "ComparisonReady");
  assert.equal(inspection.phase, "evolution");
  assert.equal(inspection.transitionLogDigest, comparison.transitionLogDigest);
});

test("session can verify and byte-preserving export through the SDK", async (t) => {
  const fixture = await makeFixtures(t);
  const result = runCli(["session", "--json"], {
    input: workflow([
      { command: "verify", package: fixture.packagePath },
      { command: "import", package: fixture.packagePath, identifier: "session-export" },
      { command: "export", output: fixture.outputPath },
    ]),
  });
  assert.equal(result.status, 0);
  const records = parseJsonLines(result.stdout);
  assert.equal(records[0].result.valid, true);
  assert.equal(records[2].result.byteLength, fixture.packageBytes.length);
  assert.deepEqual(await readFile(fixture.outputPath), fixture.packageBytes);
});

test("native observations fail export safely without fabricating a MIP", async (t) => {
  const fixture = await makeFixtures(t);
  await writeFile(fixture.outputPath, "sentinel", "utf8");
  const result = runCli(["session", "--json"], {
    input: workflow([
      {
        command: "observe",
        identifier: "native-not-exportable",
        snapshot: fixture.snapshotPath,
        workspace: fixture.workspacePath,
      },
      { command: "export", output: fixture.outputPath },
    ]),
  });
  assert.equal(result.status, 4);
  const records = parseJsonLines(result.stdout);
  assert.equal(records.at(-1).error.code, "CAPABILITY_UNAVAILABLE");
  assert.equal(records.at(-1).error.exitCode, 4);
  assert.equal(await readFile(fixture.outputPath, "utf8"), "sentinel");
});

test("session accepts a workflow file and fails malformed JSON deterministically", async (t) => {
  const fixture = await makeFixtures(t);
  const workflowPath = `${fixture.root}/workflow.memoryos`;
  await writeFile(workflowPath, workflow([
    { command: "version" },
    { command: "import", package: fixture.packagePath },
    { command: "inspect" },
  ]));
  const fromFile = runCli(["session", workflowPath, "--json"]);
  assert.equal(fromFile.status, 0);
  assert.equal(parseJsonLines(fromFile.stdout).length, 3);

  const malformed = runCli(["session", "--json"], { input: "{\n" });
  assert.equal(malformed.status, 2);
  assert.equal(malformed.stderr, "");
  const [failure] = parseJsonLines(malformed.stdout);
  assert.equal(failure.error.code, "INVALID_SESSION_JSON");
  assert.equal(failure.error.exitCode, 2);
});
