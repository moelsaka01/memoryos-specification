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

// MO-1308 Contract Freeze 1 §13.3 grammar. Phase 1 pinned "every valid command fails closed"; since Stream 2D the
// grammar is wired to the real SDK and file store, so a valid command is accepted by the grammar and answered by
// the store with a typed, frozen code. Grammar errors are MO1308_USAGE, exit 1, with the fixed message and no echoed input.
async function scratch(t) {
  const root = await mkdtemp(join(tmpdir(), "memoryos-history-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
function jsonError(result) {
  assert.equal(result.stdout, "");
  return JSON.parse(result.stderr).error;
}
function assertAnswered(args, expectedCode, expectedExit) {
  const result = runCli([...args, "--json"]);
  assert.equal(result.status, expectedExit, args.join(" "));
  const error = jsonError(result);
  assert.equal(error.historyCode, expectedCode, args.join(" "));
  assert.equal(error.exitCode, expectedExit);
  assert.notEqual(error.historyCode, "MO1308_USAGE", "a valid command is never a grammar error");
  assert.notEqual(error.historyCode, "MO1308_INTERNAL", "the wiring is real: no command fails closed any more");
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

test("every valid history command is accepted by the grammar and answered by the store with a frozen code", async (t) => {
  const root = await scratch(t);
  const ledger = join(root, "ledger"), output = join(root, "export"), file = join(root, "record.json");
  const missingLedger = ["MO1308_LEDGER_NOT_FOUND", 4], missingFile = ["MO1308_IO", 4];
  const valid = [
    [["history", "init", "--ledger", join(root, "no-parent", "ledger"), "--name", "workspace.history", "--workspace", "workspace-investigation"],
      "MO1308_FILESYSTEM_BOUNDARY", 4],
    ...["MIP_PACKAGE", "INVESTIGATION_CHECKPOINT", "REGRESSION_REPORT", "READINESS_RESULT", "HUMAN_DECISION_CLAIM"].map((kind) => [
      ["history", "append", "--ledger", ledger, "--kind", kind, "--record", file], ...missingFile]),
    [["history", "append", "--ledger", ledger, "--kind", "POLICY_EVALUATION", "--identity", file, "--outcome", file], ...missingFile],
    [["history", "append", "--ledger", ledger, "--kind", "CICD_RUN", "--run", root], "MO1308_RECORD_INVALID", 2],
    [["history", "tombstone", "--ledger", ledger, "--target", "0", "--reason", "PRIVACY_REQUEST", "--authority-reference", "PRIV-2026-0042"], ...missingLedger],
    [["history", "verify", "--ledger", ledger], ...missingLedger],
    [["history", "query", "--ledger", ledger, "--retention", "ANY", "--from", "0", "--limit", "1"], ...missingLedger],
    [["history", "query", "--ledger", ledger, "--kind", "MIP_PACKAGE", "--kind", "CICD_RUN", "--subject-type", "WORKSPACE",
      "--subject", "workspace-investigation", "--retention", "PURGED", "--from", "99999", "--limit", "1000"], ...missingLedger],
    [["history", "export", "--ledger", ledger, "--output", output], ...missingLedger],
    [["history", "verify-export", "--export", output], ...missingLedger],
  ];
  for (const [args, historyCode, exitCode] of valid) assertAnswered(args, historyCode, exitCode);
  assert.equal(existsSync(ledger), false);
  assert.equal(existsSync(output), false);
  assert.equal(existsSync(join(root, "no-parent")), false);
});

test("history grammar rejects malformed commands with MO1308_USAGE", async (t) => {
  const root = await scratch(t);
  const ledger = join(root, "private-ledger-path"), file = join(root, "record.json");
  const QUERY_REQUIRED = ["--retention", "ANY", "--from", "0", "--limit", "1"];
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
    ["history", "query", "--ledger", ledger],
    ["history", "query", "--ledger", ledger, "--from", "0", "--limit", "1"],
    ["history", "query", "--ledger", ledger, "--retention", "ANY", "--limit", "1"],
    ["history", "query", "--ledger", ledger, "--retention", "ANY", "--from", "0"],
    ["history", "query", "--ledger", ledger, "--kind", "MIP_PACKAGE", "--subject-type", "WORKSPACE", "--subject", "w"],
    ["history", "query", "--ledger", ledger, ...QUERY_REQUIRED, "--kind", "NATIVE"],
    ["history", "query", "--ledger", ledger, ...QUERY_REQUIRED, "--kind", "CICD_RUN", "--kind", "CICD_RUN"],
    ["history", "query", "--ledger", ledger, ...QUERY_REQUIRED, "--subject-type", "WORKSPACE"],
    ["history", "query", "--ledger", ledger, ...QUERY_REQUIRED, "--subject", "w"],
    ["history", "query", "--ledger", ledger, ...QUERY_REQUIRED, "--subject-type", "UNKNOWN", "--subject", "w"],
    ["history", "query", "--ledger", ledger, "--retention", "ALL", "--from", "0", "--limit", "1"],
    ["history", "query", "--ledger", ledger, "--retention", "ANY", "--from", "100000", "--limit", "1"],
    ["history", "query", "--ledger", ledger, "--retention", "ANY", "--from", "0", "--limit", "0"],
    ["history", "query", "--ledger", ledger, "--retention", "ANY", "--from", "0", "--limit", "1001"],
    ["history", "export", "--ledger", ledger],
    ["history", "verify-export"],
  ];
  for (const args of invalid) assertUsage(args, ledger);
});

test("history human errors carry the history code and the fixed message", () => {
  const result = runCli(["history", "verify", "--ledger", "private-missing-ledger-name"]);
  assert.equal(result.status, 4);
  assert.equal(result.stderr, ["MemoryOS history verify failed", "code: PACKAGE_ERROR", "exitCode: 4",
    "historyCode: MO1308_LEDGER_NOT_FOUND", "message: No ledger descriptor was found."].join("\n") + "\n");
  assert.ok(!result.stderr.includes("private-missing-ledger-name"));
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
