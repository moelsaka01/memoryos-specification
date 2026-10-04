import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import * as contract from "../../cca-studio/web/js/memoryos-history-contract.js";
import {
  HISTORY_RECORD_KINDS,
  HISTORY_RETENTION_FILTERS,
  HISTORY_SUBJECT_TYPES,
  HISTORY_TOMBSTONE_REASONS,
  HISTORY_USAGE_MESSAGE,
} from "../src/history-arguments.js";
import { runCli } from "./test-helpers.mjs";

// MO-1308 Contract Freeze 1 §13.3 Phase 1 grammar. Every valid command fails
// closed (MO1308_INTERNAL, exit 5) and writes nothing; grammar errors are
// MO1308_USAGE, exit 1, with the fixed message and no echoed input.
async function scratch(t) {
  const root = await mkdtemp(join(tmpdir(), "memoryos-history-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
function jsonError(result) {
  assert.equal(result.stdout, "");
  return JSON.parse(result.stderr).error;
}
function assertGuard(args) {
  const result = runCli([...args, "--json"]);
  assert.equal(result.status, 5, args.join(" "));
  assert.deepEqual(jsonError(result), {
    code: "SDK_FAILURE", details: [], exitCode: 5, historyCode: "MO1308_INTERNAL",
    message: new contract.MemoryOSHistoryError("INTERNAL", "INTERNAL").message,
  });
}
function assertUsage(args, secret = null) {
  const result = runCli([...args, "--json"]);
  assert.equal(result.status, 1, args.join(" "));
  const parsed = JSON.parse(result.stderr);
  assert.equal(parsed.command, "history");
  assert.deepEqual(parsed.error, {
    code: "INVALID_ARGUMENTS", details: [], exitCode: 1, historyCode: "MO1308_USAGE", message: HISTORY_USAGE_MESSAGE,
  });
  if (secret !== null) assert.ok(!result.stderr.includes(secret));
}

test("history grammar enumerations equal the SDK contract and the fixed usage message", () => {
  assert.deepEqual(HISTORY_RECORD_KINDS, contract.RECORD_KINDS);
  assert.deepEqual(HISTORY_TOMBSTONE_REASONS, contract.TOMBSTONE_REASONS);
  assert.deepEqual(HISTORY_SUBJECT_TYPES, contract.SUBJECT_TYPES);
  assert.deepEqual(HISTORY_RETENTION_FILTERS, contract.RETENTION_FILTERS);
  assert.equal(HISTORY_USAGE_MESSAGE, new contract.MemoryOSHistoryError("USAGE", "USAGE").message);
});

test("every valid history command fails closed and writes nothing", async (t) => {
  const root = await scratch(t);
  const ledger = join(root, "ledger"), output = join(root, "export"), file = join(root, "record.json");
  const valid = [
    ["history", "init", "--ledger", ledger, "--name", "workspace.history", "--workspace", "workspace-investigation"],
    ["history", "append", "--ledger", ledger, "--kind", "MIP_PACKAGE", "--record", file],
    ["history", "append", "--ledger", ledger, "--kind", "INVESTIGATION_CHECKPOINT", "--record", file],
    ["history", "append", "--ledger", ledger, "--kind", "REGRESSION_REPORT", "--record", file],
    ["history", "append", "--ledger", ledger, "--kind", "READINESS_RESULT", "--record", file],
    ["history", "append", "--ledger", ledger, "--kind", "HUMAN_DECISION_CLAIM", "--record", file],
    ["history", "append", "--ledger", ledger, "--kind", "POLICY_EVALUATION", "--identity", file, "--outcome", file],
    ["history", "append", "--ledger", ledger, "--kind", "CICD_RUN", "--run", root],
    ["history", "tombstone", "--ledger", ledger, "--target", "0", "--reason", "PRIVACY_REQUEST", "--authority-reference", "PRIV-2026-0042"],
    ["history", "verify", "--ledger", ledger],
    ["history", "query", "--ledger", ledger],
    ["history", "query", "--ledger", ledger, "--kind", "MIP_PACKAGE", "--kind", "CICD_RUN", "--subject-type", "WORKSPACE",
      "--subject", "workspace-investigation", "--retention", "PURGED", "--from", "99999", "--limit", "1000"],
    ["history", "export", "--ledger", ledger, "--output", output],
    ["history", "verify-export", "--export", output],
  ];
  for (const args of valid) assertGuard(args);
  assert.equal(existsSync(ledger), false);
  assert.equal(existsSync(output), false);
});

test("history grammar rejects malformed commands with MO1308_USAGE", async (t) => {
  const root = await scratch(t);
  const ledger = join(root, "private-ledger-path"), file = join(root, "record.json");
  const invalid = [
    ["history"],
    ["history", "unknown", "--ledger", ledger],
    ["history", "verify"],
    ["history", "verify", "--ledger", ledger, "positional"],
    ["history", "verify", "--ledger", ledger, "--ledger", ledger],
    ["history", "verify", "--ledger", ledger, "--unknown", "x"],
    ["history", "verify", "--ledger"],
    ["history", "verify", "--ledger="],
    ["history", "init", "--ledger", ledger, "--name", "Upper", "--workspace", "w"],
    ["history", "init", "--ledger", ledger, "--name", "a".repeat(65), "--workspace", "w"],
    ["history", "append", "--ledger", ledger, "--kind", "INGESTION_REJECTED", "--record", file],
    ["history", "append", "--ledger", ledger, "--kind", "MIP_PACKAGE"],
    ["history", "append", "--ledger", ledger, "--kind", "MIP_PACKAGE", "--run", root],
    ["history", "append", "--ledger", ledger, "--kind", "MIP_PACKAGE", "--record", file, "--identity", file],
    ["history", "append", "--ledger", ledger, "--kind", "POLICY_EVALUATION", "--identity", file],
    ["history", "append", "--ledger", ledger, "--kind", "POLICY_EVALUATION", "--record", file],
    ["history", "append", "--ledger", ledger, "--kind", "CICD_RUN", "--record", file],
    ["history", "tombstone", "--ledger", ledger, "--target", "100000", "--reason", "PRIVACY_REQUEST", "--authority-reference", "x"],
    ["history", "tombstone", "--ledger", ledger, "--target", "01", "--reason", "PRIVACY_REQUEST", "--authority-reference", "x"],
    ["history", "tombstone", "--ledger", ledger, "--target", "-1", "--reason", "PRIVACY_REQUEST", "--authority-reference", "x"],
    ["history", "tombstone", "--ledger", ledger, "--target", "0", "--reason", "EXPIRED", "--authority-reference", "x"],
    ["history", "tombstone", "--ledger", ledger, "--target", "0", "--reason", "PRIVACY_REQUEST", "--authority-reference", "x".repeat(257)],
    ["history", "tombstone", "--ledger", ledger, "--target", "0", "--reason", "PRIVACY_REQUEST", "--authority-reference", "ticket é"],
    ["history", "query", "--ledger", ledger, "--kind", "NATIVE"],
    ["history", "query", "--ledger", ledger, "--subject-type", "WORKSPACE"],
    ["history", "query", "--ledger", ledger, "--subject", "w"],
    ["history", "query", "--ledger", ledger, "--subject-type", "UNKNOWN", "--subject", "w"],
    ["history", "query", "--ledger", ledger, "--retention", "ALL"],
    ["history", "query", "--ledger", ledger, "--from", "100000"],
    ["history", "query", "--ledger", ledger, "--limit", "0"],
    ["history", "query", "--ledger", ledger, "--limit", "1001"],
    ["history", "export", "--ledger", ledger],
    ["history", "verify-export"],
  ];
  for (const args of invalid) assertUsage(args, ledger);
});

test("history human errors carry the history code and the fixed message", () => {
  const result = runCli(["history", "verify", "--ledger", "x"]);
  assert.equal(result.status, 5);
  assert.equal(result.stderr, ["MemoryOS history verify failed", "code: SDK_FAILURE", "exitCode: 5",
    "historyCode: MO1308_INTERNAL", "message: An internal history failure occurred."].join("\n") + "\n");
});

test("history help lists the exact frozen grammar", () => {
  const result = runCli(["help", "history"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^memoryos history init --ledger DIR --name NAME --workspace ID \[--json\]$/mu);
  assert.match(result.stdout, /^memoryos history verify-export --export DIR \[--json\]$/mu);
  assert.equal(result.stdout.trim().split("\n").length, 7);
});

test("non-history error envelopes are unchanged (no historyCode)", () => {
  const result = runCli(["nonexistent-command", "--json"]);
  assert.equal(result.status, 1);
  assert.equal(Object.hasOwn(JSON.parse(result.stderr).error, "historyCode"), false);
});

test("history grammar performs no I/O, starts no process and reads no clock (R35, R37)", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../src/history-arguments.js", import.meta.url), "utf8");
  const imports = [...source.matchAll(/^import\s.+?from\s+"([^"]+)";$/gmu)].map((match) => match[1]);
  assert.deepEqual(imports, ["./errors.js"]);
  assert.doesNotMatch(source, /node:|child_process|powershell|spawn|new Date|Date\.|performance\.|process\./iu);
});
