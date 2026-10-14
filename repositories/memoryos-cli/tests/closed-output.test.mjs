import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { CLI_BIN, runCli } from "./test-helpers.mjs";

// MO-1308 Phase 3A finding 3A-L3 (Amendment A10): a closed standard output must never crash the CLI. No stack trace or path is emitted,
// and an operation that was carried out is not reported as failed merely because its output could not be written.
const closedStdout = (args) => new Promise((resolve) => {
  const child = spawn(process.execPath, [CLI_BIN, ...args], { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdout.destroy(); // the reader is gone before the CLI writes
  child.on("close", (code) => resolve({ code, stderr }));
});
const WORKSPACE = ["--workspace", "workspace-investigation"];

test("L3a a closed stdout after a committed init: no crash, no trace, exit 0, the ledger exists", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "memoryos-closed-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const ledger = join(root, "ledger");
  const result = await closedStdout(["history", "init", "--ledger", ledger, "--name", "closed", ...WORKSPACE, "--json"]);
  assert.equal(existsSync(join(ledger, "memoryos-history-ledger.json")), true);
  assert.equal(result.stderr, "", result.stderr);
  assert.equal(result.code, 0);
});

test("L3b a closed stdout on a read-only command: no crash, no trace, exit 0", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "memoryos-closed-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const ledger = join(root, "ledger");
  assert.equal(runCli(["history", "init", "--ledger", ledger, "--name", "closed", ...WORKSPACE, "--json"]).status, 0);
  const result = await closedStdout(["history", "verify", "--ledger", ledger, "--json"]);
  assert.equal(result.stderr, "", result.stderr);
  assert.equal(result.code, 0);
});

test("L3c a failure whose error output cannot be written keeps its exit category and prints no trace", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "memoryos-closed-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const child = spawn(process.execPath, [CLI_BIN, "history", "verify", "--ledger", join(root, "none"), "--json"], { stdio: ["ignore", "pipe", "pipe"] });
  const outcome = await new Promise((resolve) => {
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.destroy(); // the error envelope goes to stderr, which is closed
    child.on("close", (code) => resolve({ code, stdout }));
  });
  assert.equal(outcome.code, 4);
  assert.equal(outcome.stdout, "");
});
