import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { referenceSnapshot } from "../../cca-studio/web/data/studio-snapshot.js";

const cli = fileURLToPath(new URL("../bin/memoryos.js", import.meta.url));
const fixture = fileURLToPath(new URL(
  "../../cca-studio/tests/fixtures/mip/complete-investigation.mip.b64",
  import.meta.url,
));

function run(name, args, expectedLines = 1) {
  const execution = spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(
    execution.status,
    0,
    `${name} failed\nstdout:\n${execution.stdout}\nstderr:\n${execution.stderr}`,
  );
  assert.equal(execution.stderr, "", `${name} wrote unexpected standard error`);
  const lines = execution.stdout.trimEnd().split("\n");
  assert.equal(lines.length, expectedLines, `${name} emitted an unexpected line count`);
  const records = lines.map((line) => JSON.parse(line));
  for (const record of records) {
    assert.equal(record.ok, true, `${name} returned an unsuccessful JSON envelope`);
    assert.equal(record.schemaVersion, "1.0", `${name} returned an unknown JSON schema`);
  }
  process.stdout.write(`PASS ${name}\n`);
  return records;
}

const directory = mkdtempSync(join(tmpdir(), "memoryos-cli-examples-"));

try {
  const workspace = join(directory, "workspace.json");
  const snapshot = join(directory, "snapshot.json");
  const packagePath = join(directory, "investigation.mip");
  const exportedPath = join(directory, "exported.mip");
  const workflow = join(directory, "workflow.memoryos");
  const regressionReport = join(directory, "regression.json");

  writeFileSync(
    workspace,
    `${JSON.stringify({ identifier: referenceSnapshot.workspaceIdentifier })}\n`,
    "utf8",
  );
  writeFileSync(snapshot, `${JSON.stringify(referenceSnapshot)}\n`, "utf8");
  const packageBytes = Buffer.from(readFileSync(fixture, "ascii").trim(), "base64");
  writeFileSync(packagePath, packageBytes);

  run("version", ["version", "--json"]);
  run("help", ["help", "replay", "--json"]);
  run("observe", [
    "observe", "--workspace", workspace, "--snapshot", snapshot,
    "--id", "cli-example-observation", "--json",
  ]);
  run("trace", [
    "trace", packagePath, "--reflection", "trace-observation-b",
    "--id", "cli-example-trace", "--json",
  ]);
  run("replay", [
    "replay", packagePath, "--trace", "trace-observation-b",
    "--action", "next", "--id", "cli-example-replay", "--json",
  ]);
  run("compare", [
    "compare", packagePath, "--trace", "trace-observation-b",
    "--evolution", "evolution-observation-a-observation-b",
    "--id", "cli-example-compare", "--json",
  ]);
  const [regression] = run("regression", [
    "regression", packagePath, packagePath, "--json",
  ]);
  assert.equal(regression.result.overall, "identical");
  assert.equal(regression.result.regressionDetected, false);
  writeFileSync(regressionReport, JSON.stringify(regression), "utf8");
  const [investigation] = run("investigate", [
    "investigate", regressionReport, "--category", "reflection", "--json",
  ]);
  assert.equal(investigation.result.query.category, "reflection");
  run("verify", ["verify", packagePath, "--json"]);
  run("import", ["import", packagePath, "--id", "cli-example-import", "--json"]);
  run("export", [
    "export", packagePath, "--output", exportedPath,
    "--id", "cli-example-export", "--json",
  ]);
  assert.deepEqual(readFileSync(exportedPath), packageBytes, "export must preserve exact MIP bytes");
  run("inspect", ["inspect", packagePath, "--id", "cli-example-inspect", "--json"]);

  const sessionRecords = [
    { command: "import", identifier: "cli-example-session", package: packagePath },
    { command: "checkpoint", name: "imported" },
    { command: "restore", name: "imported" },
    { command: "trace", reflection: "trace-observation-b" },
    { command: "replay", action: "open" },
    { command: "replay", action: "next" },
    { command: "inspect" },
  ];
  writeFileSync(
    workflow,
    `${sessionRecords.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8",
  );
  const session = run("session checkpoint/restore", ["session", workflow, "--json"], 7);
  assert.equal(session[1].command, "checkpoint");
  assert.deepEqual(session[1].result, { name: "imported", stored: true });
  assert.equal(session[2].command, "restore");
  assert.equal(session[2].result.lifecycle, session[0].result.lifecycle);
  assert.equal(session[2].result.transitionLogDigest, session[0].result.transitionLogDigest);

  process.stdout.write("All MemoryOS CLI examples passed.\n");
} finally {
  rmSync(directory, { force: true, recursive: true });
}
