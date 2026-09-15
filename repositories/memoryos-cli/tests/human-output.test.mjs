import assert from "node:assert/strict";
import test from "node:test";

import {
  SELECTORS,
  assertCanonicalJson,
  makeFixtures,
  parseJsonLines,
  parseJsonOutput,
  runCli,
} from "./test-helpers.mjs";

function sessionInput(fixture) {
  return [
    JSON.stringify({ command: "version" }),
    JSON.stringify({
      command: "observe",
      identifier: "cli-human-session-observe",
      snapshot: fixture.snapshotPath,
      workspace: fixture.workspacePath,
    }),
    JSON.stringify({ command: "inspect" }),
    JSON.stringify({ command: "import", identifier: "cli-human-session", package: fixture.packagePath }),
    JSON.stringify({ command: "verify" }),
    JSON.stringify({ command: "trace", reflection: SELECTORS.trace }),
    JSON.stringify({ command: "replay", action: "open" }),
    ...Array.from({ length: 9 }, () => JSON.stringify({ command: "replay", action: "next" })),
    JSON.stringify({ command: "checkpoint", name: "cli-human-checkpoint" }),
    JSON.stringify({ command: "restore", name: "cli-human-checkpoint" }),
    JSON.stringify({ command: "compare", evolution: SELECTORS.evolution }),
    JSON.stringify({ command: "export", output: fixture.outputPath }),
    JSON.stringify({ command: "inspect" }),
    "",
  ].join("\n");
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

function humanValue(value) {
  if (Array.isArray(value)) return value.length === 0 ? "none" : value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(canonicalValue(value));
  if (value === null) return "none";
  return String(value);
}

function ordinaryHuman(command, result) {
  const lines = [`MemoryOS ${command}`];
  for (const key of Object.keys(result).sort()) lines.push(`${key}: ${humanValue(result[key])}`);
  return `${lines.join("\n")}\n`;
}

function appendHumanFields(lines, path, value) {
  if (Array.isArray(value)) {
    if (value.length === 0) lines.push(`${path}: none`);
    else value.forEach((child, index) => appendHumanFields(lines, `${path}[${index}]`, child));
    return;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value).sort()) {
      appendHumanFields(lines, path.length === 0 ? key : `${path}.${key}`, value[key]);
    }
    return;
  }
  lines.push(`${path}: ${humanValue(value)}`);
}

function standaloneHuman(command, result) {
  if (command === "help") return `${result.usage}\n`;
  if (command !== "regression" && command !== "investigate") {
    return ordinaryHuman(command, result);
  }
  const lines = [`MemoryOS ${command}`];
  appendHumanFields(lines, "", result);
  return `${lines.join("\n")}\n`;
}

test("CCA-MOS-CLI-004: every command emits deterministic human output through the production CLI", async (t) => {
  const fixture = await makeFixtures(t);
  const cases = [
    { command: "version", arguments: ["version"], prefix: "MemoryOS version\n" },
    { command: "help", arguments: ["help"], prefix: "MemoryOS CLI 1.1.0\n" },
    {
      command: "observe",
      arguments: [
        "observe",
        "--workspace", fixture.workspacePath,
        "--snapshot", fixture.snapshotPath,
        "--id", "cli-human-observe",
      ],
      prefix: "MemoryOS observe\n",
    },
    {
      command: "trace",
      arguments: [
        "trace", fixture.packagePath,
        "--reflection", SELECTORS.trace,
        "--id", "cli-human-trace",
      ],
      prefix: "MemoryOS trace\n",
    },
    {
      command: "replay",
      arguments: [
        "replay", fixture.packagePath,
        "--trace", SELECTORS.trace,
        "--action", "next",
        "--id", "cli-human-replay",
      ],
      prefix: "MemoryOS replay\n",
    },
    {
      command: "compare",
      arguments: [
        "compare", fixture.packagePath,
        "--trace", SELECTORS.trace,
        "--evolution", SELECTORS.evolution,
        "--id", "cli-human-compare",
      ],
      prefix: "MemoryOS compare\n",
    },
    {
      command: "regression",
      arguments: [
        "regression", fixture.regressionBaselinePath, fixture.regressionCandidatePath,
      ],
      prefix: "MemoryOS regression\n",
    },
    {
      command: "investigate",
      arguments: ["investigate", fixture.regressionReportPath],
      prefix: "MemoryOS investigate\n",
    },
    {
      command: "verify",
      arguments: ["verify", fixture.packagePath],
      prefix: "MemoryOS verify\n",
    },
    {
      command: "import",
      arguments: ["import", fixture.packagePath, "--id", "cli-human-import"],
      prefix: "MemoryOS import\n",
    },
    {
      command: "export",
      arguments: [
        "export", fixture.packagePath,
        "--output", fixture.outputPath,
        "--id", "cli-human-export",
      ],
      prefix: "MemoryOS export\n",
    },
    {
      command: "inspect",
      arguments: ["inspect", fixture.packagePath, "--id", "cli-human-inspect"],
      prefix: "MemoryOS inspect\n",
    },
    {
      command: "session",
      arguments: ["session"],
      input: sessionInput(fixture),
      prefix: "MemoryOS version\n",
    },
  ];

  for (const entry of cases) {
    const options = entry.input === undefined ? {} : { input: entry.input };
    const first = runCli(entry.arguments, options);
    const second = runCli(entry.arguments, options);
    const jsonArguments = [...entry.arguments, "--json"];
    const jsonFirst = runCli(jsonArguments, options);
    const jsonSecond = runCli(jsonArguments, options);
    assert.equal(first.status, 0, entry.command);
    assert.equal(first.stderr, "", entry.command);
    assert.equal(first.stdout, second.stdout, entry.command);
    assert.equal(jsonFirst.status, 0, `${entry.command} --json`);
    assert.equal(jsonFirst.stderr, "", `${entry.command} --json`);
    assert.equal(jsonFirst.stdout, jsonSecond.stdout, `${entry.command} --json`);
    assertCanonicalJson(jsonFirst.stdout);
    if (entry.command === "session") {
      const envelopes = parseJsonLines(jsonFirst.stdout);
      assert.equal(envelopes.length, 21);
      assert.deepEqual(
        [...new Set(envelopes.map(({ command }) => command))].sort(),
        [
          "checkpoint", "compare", "export", "import", "inspect", "observe",
          "replay", "restore", "trace", "verify", "version",
        ],
      );
      assert.equal(
        first.stdout,
        envelopes.map(({ command, result }) => ordinaryHuman(command, result)).join(""),
      );
    } else {
      const envelope = parseJsonOutput(jsonFirst);
      assert.equal(envelope.command, entry.command);
      assert.equal(first.stdout, standaloneHuman(entry.command, envelope.result), entry.command);
    }
    assert.ok(first.stdout.startsWith(entry.prefix), entry.command);
    assert.ok(first.stdout.endsWith("\n"), entry.command);
    assert.doesNotMatch(first.stdout, /^\s*[{[]/u, entry.command);
    assert.doesNotMatch(
      first.stdout,
      /\u001b\[|\[object Object\]|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}|\b(?:NaN|undefined)\b/u,
      entry.command,
    );
  }
});
