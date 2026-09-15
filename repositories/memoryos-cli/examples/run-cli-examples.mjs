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

function runPolicy(name, args, expectedStatus = 0) {
  const execution = spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(
    execution.status,
    expectedStatus,
    `${name} failed\nstdout:\n${execution.stdout}\nstderr:\n${execution.stderr}`,
  );
  assert.equal(execution.stderr, "", `${name} wrote unexpected standard error`);
  assert.equal(execution.stdout.endsWith("\n"), true, `${name} omitted JSON LF framing`);
  const record = JSON.parse(execution.stdout);
  assert.equal(record.ok, true, `${name} returned an unsuccessful JSON envelope`);
  assert.equal(record.schemaVersion, "1.1", `${name} returned an unknown Policy schema`);
  process.stdout.write(`PASS ${name}\n`);
  return record;
}

const directory = mkdtempSync(join(tmpdir(), "memoryos-cli-examples-"));

try {
  const workspace = join(directory, "workspace.json");
  const snapshot = join(directory, "snapshot.json");
  const packagePath = join(directory, "investigation.mip");
  const exportedPath = join(directory, "exported.mip");
  const workflow = join(directory, "workflow.memoryos");
  const regressionReport = join(directory, "regression.json");
  const policy = join(directory, "example.memoryos-policy.json");
  const failPolicy = join(directory, "fail.memoryos-policy.json");
  const cnePolicy = join(directory, "cne.memoryos-policy.json");
  const canonicalPolicy = join(directory, "example.canonical.memoryos-policy.json");
  const policyIdentity = join(directory, "example.memoryos-policy-evaluation-identity.json");
  const policyIdentityDigest = join(directory, "example.identity.sha256");
  const policyOutcome = join(directory, "example.memoryos-policy-evaluation-outcome.json");
  const policyOutcomeDigest = join(directory, "example.outcome.sha256");
  const failOutcome = join(directory, "fail.memoryos-policy-evaluation-outcome.json");
  const cneOutcome = join(directory, "cne.memoryos-policy-evaluation-outcome.json");

  writeFileSync(
    workspace,
    `${JSON.stringify({ identifier: referenceSnapshot.workspaceIdentifier })}\n`,
    "utf8",
  );
  writeFileSync(snapshot, `${JSON.stringify(referenceSnapshot)}\n`, "utf8");
  const packageBytes = Buffer.from(readFileSync(fixture, "ascii").trim(), "base64");
  writeFileSync(packagePath, packageBytes);
  writeFileSync(policy, JSON.stringify({
    identifier: "pe",
    kind: "MemoryOSInvestigationPolicy",
    policyVersion: "1.0.0",
    rules: [{
      identifier: "a",
      parameters: {},
      type: "memoryos.require-mip-integrity",
      version: "1.0.0",
    }],
    version: "1.0.0",
  }), "utf8");
  writeFileSync(failPolicy, JSON.stringify({
    identifier: "pf",
    kind: "MemoryOSInvestigationPolicy",
    policyVersion: "1.0.0",
    rules: [{
      identifier: "a",
      parameters: { allowedStates: ["Archived"] },
      type: "memoryos.require-lifecycle-state",
      version: "1.0.0",
    }],
    version: "1.0.0",
  }), "utf8");
  writeFileSync(cnePolicy, JSON.stringify({
    identifier: "pc",
    kind: "MemoryOSInvestigationPolicy",
    policyVersion: "1.0.0",
    rules: [{
      identifier: "a",
      parameters: { categories: ["reflection"] },
      type: "memoryos.prohibit-regression-findings",
      version: "1.0.0",
    }],
    version: "1.0.0",
  }), "utf8");

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

  runPolicy("policy validate", ["policy", "validate", "--policy", policy, "--json"]);
  runPolicy("policy digest", [
    "policy", "digest", "--policy", policy,
    "--canonical-output", canonicalPolicy, "--json",
  ]);
  const policyEvaluation = runPolicy("policy evaluate", [
    "policy", "evaluate", "--policy", policy, "--package", packagePath,
    "--outcome", policyOutcome,
    "--identity-output", policyIdentity,
    "--evaluation-identity-digest-output", policyIdentityDigest,
    "--outcome-digest-output", policyOutcomeDigest,
    "--json",
  ]);
  assert.equal(policyEvaluation.result.decision, "PASS");
  const failedEvaluation = runPolicy("policy evaluate FAIL", [
    "policy", "evaluate", "--policy", failPolicy, "--package", packagePath,
    "--outcome", failOutcome, "--json",
  ], 6);
  assert.equal(failedEvaluation.result.decision, "FAIL");
  const cneEvaluation = runPolicy("policy evaluate CNE", [
    "policy", "evaluate", "--policy", cnePolicy, "--package", packagePath,
    "--outcome", cneOutcome, "--json",
  ], 7);
  assert.equal(cneEvaluation.result.decision, "COULD_NOT_EVALUATE");
  assert.equal(readFileSync(policyIdentityDigest).length, 71);
  assert.equal(readFileSync(policyOutcomeDigest).length, 71);
  assert.equal(readFileSync(policyIdentity).at(-1), 0x7d);
  assert.equal(readFileSync(policyOutcome).at(-1), 0x7d);
  runPolicy("policy inspect", [
    "policy", "inspect", "--outcome", policyOutcome, "--json",
  ]);
  runPolicy("policy verify-identity", [
    "policy", "verify-identity", policyIdentity, "--mode", "artifact",
    "--expected-evaluation-identity-digest", readFileSync(policyIdentityDigest, "ascii"),
    "--json",
  ]);
  runPolicy("policy verify-outcome", [
    "policy", "verify-outcome", policyOutcome, "--mode", "artifact",
    "--expected-identity", policyIdentity,
    "--expected-outcome-digest", readFileSync(policyOutcomeDigest, "ascii"),
    "--json",
  ]);
  runPolicy("policy identities", ["policy", "identities", "--json"]);

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
