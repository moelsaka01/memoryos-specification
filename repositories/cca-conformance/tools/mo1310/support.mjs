// MemoryOS 1.3.1 campaign support: real exports produced by the released MO-1308 CLI (the same construction the MO-1309 campaign used).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO } from "../mo1309/run-tests.mjs";

// `records` receives the MO-1308 corpus helpers and returns the records to append; `tombstones` is [{ target, reason, authority }].
export async function cliExport(root, { workspace, records, tombstones = [] }) {
  const corpus = await import(pathToFileURL(path.join(REPO, "repositories/memoryos-cli/tests/support/history-corpus.mjs")).href);
  const bin = path.join(REPO, "repositories/memoryos-cli/bin/memoryos.js");
  const cli = (...args) => {
    const result = spawnSync(process.execPath, [bin, "history", ...args, "--json"], { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
    if (result.status !== 0) throw new Error(`memoryos history ${args[0]} failed`);
    return JSON.parse(result.stdout);
  };
  const ledger = path.join(root, "ledger");
  cli("init", "--ledger", ledger, "--name", "workspace.history", "--workspace", workspace);
  for (const record of records(corpus)) {
    const directory = fs.mkdtempSync(path.join(root, "in-"));
    const write = (name) => { const full = path.join(directory, name); fs.writeFileSync(full, record.members.find((m) => m.name === name).bytes); return full; };
    let args;
    if (record.recordKind === "POLICY_EVALUATION") args = ["--identity", write("evaluation-identity.json"), "--outcome", write("policy-outcome.json")];
    else if (record.recordKind === "CICD_RUN") { const run = path.join(directory, "run"); fs.mkdirSync(run); for (const m of record.members) fs.writeFileSync(path.join(run, m.name), m.bytes); args = ["--run", run]; }
    else args = ["--record", write(record.members[0].name)];
    cli("append", "--ledger", ledger, "--kind", record.recordKind, ...args);
  }
  for (const t of tombstones) cli("tombstone", "--ledger", ledger, "--target", String(t.target), "--reason", t.reason, "--authority-reference", t.authority);
  const out = path.join(root, "export");
  cli("export", "--ledger", ledger, "--output", out);
  return out;
}

// One record of every MO-1308 kind.
export const allKinds = (c) => [{ recordKind: "MIP_PACKAGE", members: [{ name: "package.mip", bytes: c.mipBytes() }] }, c.checkpointRecord("mo1310-campaign"),
  { recordKind: "REGRESSION_REPORT", members: [{ name: "regression-report.json", bytes: c.regressionBytes() }] }, c.policyRecord(0), c.bundleRecord(6),
  c.readinessRecord("ready"), c.decisionRecord("ready", "approve"), c.readinessRecord("not-ready"), c.decisionRecord("not-ready", "approve")];
