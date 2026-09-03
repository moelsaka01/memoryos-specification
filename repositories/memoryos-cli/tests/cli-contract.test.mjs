import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCanonicalJson,
  assertPresentationFree,
  makeFixtures,
  parseJsonOutput,
  runCli,
} from "./test-helpers.mjs";

test("version and help expose the deterministic supported command surface", () => {
  const humanVersion = runCli(["version"]);
  assert.equal(humanVersion.status, 0);
  assert.equal(humanVersion.stderr, "");
  assert.equal(
    humanVersion.stdout,
    "MemoryOS version\ncliVersion: 1.0.0\nsdkVersion: 1.0.0\n",
  );

  const jsonVersion = runCli(["version", "--json"]);
  assert.equal(jsonVersion.status, 0);
  assertCanonicalJson(jsonVersion.stdout);
  assert.deepEqual(parseJsonOutput(jsonVersion), {
    command: "version",
    ok: true,
    result: { cliVersion: "1.0.0", sdkVersion: "1.0.0" },
    schemaVersion: "1.0",
  });

  for (const alias of [["--version"], ["-V"]]) {
    assert.equal(runCli(alias).stdout, humanVersion.stdout);
  }

  const help = runCli(["help"]);
  assert.equal(help.status, 0);
  assert.equal(help.stderr, "");
  for (const command of [
    "version", "help", "observe", "trace", "replay", "compare",
    "regression", "investigate", "verify", "import", "export", "inspect", "session",
  ]) {
    assert.match(help.stdout, new RegExp(`^  ${command}\\s`, "mu"));
  }
  assert.doesNotMatch(help.stdout, /^  (?:batch|checkpoint|restore)\s/mu);
  assert.equal(runCli([]).stdout, help.stdout);
  assert.equal(runCli(["--help"]).stdout, help.stdout);
  assert.match(runCli(["help", "compare"]).stdout, /^memoryos compare PACKAGE /u);
  assert.match(
    runCli(["help", "regression"]).stdout,
    /^memoryos regression BASELINE CANDIDATE /u,
  );
  assert.match(
    runCli(["help", "investigate"]).stdout,
    /^memoryos investigate REPORT /u,
  );
});

test("argument failures are stable, non-interactive, and use exit code 1", () => {
  const cases = [
    [],
    ["unknown"],
    ["observe"],
    ["trace", "package.mip"],
    ["replay", "package.mip"],
    ["compare", "left.mip", "right.mip", "--trace", "t", "--evolution", "e"],
    ["regression"],
    ["regression", "baseline.mip"],
    ["regression", "baseline.mip", "candidate.mip", "extra.mip"],
    ["regression", "baseline.mip", "candidate.mip", "--id", "unsupported"],
    ["export", "package.mip"],
    ["version", "--json", "--json"],
  ];
  // An empty command intentionally aliases help and is tested above.
  cases.shift();
  for (const arguments_ of cases) {
    const first = runCli([...arguments_, "--json"]);
    const second = runCli([...arguments_, "--json"]);
    assert.equal(first.status, 1, arguments_.join(" "));
    assert.equal(first.stdout, "");
    assert.equal(first.stderr, second.stderr);
    assertCanonicalJson(first.stderr);
    const envelope = parseJsonOutput(first, "stderr");
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error.exitCode, 1);
    assert.equal(envelope.error.code, "INVALID_ARGUMENTS");
    assert.doesNotMatch(first.stderr, /\u001b\[/u);
  }
});

test("observe requires explicit deterministic files and emits stable summaries", async (t) => {
  const fixture = await makeFixtures(t);
  const arguments_ = [
    "observe",
    "--workspace", fixture.workspacePath,
    "--snapshot", fixture.snapshotPath,
    "--id", "cli-observe-contract",
    "--json",
  ];
  const first = runCli(arguments_);
  const second = runCli(arguments_);
  assert.equal(first.status, 0);
  assert.equal(first.stderr, "");
  assert.equal(first.stdout, second.stdout);
  assertCanonicalJson(first.stdout);
  const value = parseJsonOutput(first);
  assert.equal(value.result.identifier, "cli-observe-contract");
  assert.equal(value.result.lifecycle, "Observed");
  assert.equal(value.result.phase, "observe");
  assert.equal(value.result.sourceKind, "native");
  assert.equal(value.result.workspaceIdentifier, "workspace-memoryos-release");
  assert.equal(value.result.transitionCount, 2);
  assert.match(value.result.transitionLogDigest, /^sha256:[0-9a-f]{64}$/u);
  assertPresentationFree(value);

  const human = runCli(arguments_.slice(0, -1));
  assert.equal(human.status, 0);
  assert.equal(human.stderr, "");
  assert.match(human.stdout, /^MemoryOS observe\n/u);
  assert.doesNotMatch(human.stdout, /\u001b\[|\d{4}-\d{2}-\d{2}T/u);
});

test("input validation failures use exit code 2 and deterministic JSON", async (t) => {
  const fixture = await makeFixtures(t);
  const cases = [
    [
      "observe", "--workspace", fixture.invalidJsonPath,
      "--snapshot", fixture.snapshotPath, "--json",
    ],
    [
      "observe", "--workspace", fixture.arrayJsonPath,
      "--snapshot", fixture.snapshotPath, "--json",
    ],
    [
      "observe", "--workspace", fixture.foreignWorkspacePath,
      "--snapshot", fixture.snapshotPath, "--json",
    ],
  ];
  for (const arguments_ of cases) {
    const first = runCli(arguments_);
    const second = runCli(arguments_);
    assert.equal(first.status, 2);
    assert.equal(first.stdout, "");
    assert.equal(first.stderr, second.stderr);
    assertCanonicalJson(first.stderr);
    const value = parseJsonOutput(first, "stderr");
    assert.equal(value.error.exitCode, 2);
    assert.equal(value.ok, false);
  }
});

test("all documented exit-code classes are observable", async (t) => {
  const fixture = await makeFixtures(t);
  const missing = `${fixture.root}/does-not-exist.mip`;
  const invalidArguments = runCli(["unknown", "--json"]);
  const validation = runCli([
    "observe", "--workspace", fixture.invalidJsonPath,
    "--snapshot", fixture.snapshotPath, "--json",
  ]);
  const verification = runCli(["verify", fixture.corruptPackagePath, "--json"]);
  const packageFailure = runCli(["import", missing, "--json"]);
  const sdkFailure = runCli(["session", "--json"], {
    input: `${JSON.stringify({ command: "replay", action: "next" })}\n`,
  });

  assert.deepEqual(
    [
      invalidArguments.status,
      validation.status,
      verification.status,
      packageFailure.status,
      sdkFailure.status,
    ],
    [1, 2, 3, 4, 2],
  );

  // A Core lifecycle error after import is an SDK failure rather than a CLI
  // input-schema failure.
  const lifecycle = runCli(["session", "--json"], {
    input: [
      JSON.stringify({ command: "import", package: fixture.packagePath }),
      JSON.stringify({
        command: "compare",
        evolution: "evolution-observation-a-observation-b",
      }),
      "",
    ].join("\n"),
  });
  assert.equal(lifecycle.status, 5);
  const records = lifecycle.stdout.trimEnd().split(/\r?\n/u).map(JSON.parse);
  assert.equal(records.at(-1).error.exitCode, 5);
  assert.equal(records.at(-1).error.code, "INVALID_TRANSITION");
});
