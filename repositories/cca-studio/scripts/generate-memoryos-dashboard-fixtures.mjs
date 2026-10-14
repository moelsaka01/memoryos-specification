// MO-1309 Phase 1: regenerate the dashboard fixtures from REAL small MO-1308 exports.
// Every export is produced by the released `memoryos history` CLI (real processes) over the MO-1308 Stream 2D corpus;
// nothing is synthesized. Usage: node scripts/generate-memoryos-dashboard-fixtures.mjs (from repositories/cca-studio).
// Output: tests/fixtures/memoryos-dashboard/1.0.0/<name>/export/** (checked in as bytes) and the pinned canonical view model
// bytes <name>/view-model.json, built by the Phase 1 view-model module from those bytes.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDashboardViewModel, canonicalViewModelBytes } from "../web/js/memoryos-dashboard-viewmodel.js";
import {
  bundleRecord, checkpointRecord, decisionRecord, mipBytes, policyRecord, readinessRecord, regressionBytes,
} from "../../memoryos-cli/tests/support/history-corpus.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const cliBin = path.resolve(here, "../../memoryos-cli/bin/memoryos.js");
const target = path.resolve(here, "../tests/fixtures/memoryos-dashboard/1.0.0");

const cli = (...args) => {
  const result = spawnSync(process.execPath, [cliBin, "history", ...args, "--json"], { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  if (result.status !== 0) throw new Error(`memoryos history ${args[0]} failed: ${result.stderr}`);
  return JSON.parse(result.stdout);
};

function append(root, ledger, record) {
  const directory = fs.mkdtempSync(path.join(root, "in-"));
  const file = (name) => {
    const full = path.join(directory, name);
    fs.writeFileSync(full, record.members.find((member) => member.name === name).bytes);
    return full;
  };
  let args;
  if (record.recordKind === "POLICY_EVALUATION") args = ["--identity", file("evaluation-identity.json"), "--outcome", file("policy-outcome.json")];
  else if (record.recordKind === "CICD_RUN") {
    const run = path.join(directory, "run");
    fs.mkdirSync(run);
    for (const member of record.members) fs.writeFileSync(path.join(run, member.name), member.bytes);
    args = ["--run", run];
  } else args = ["--record", file(record.members[0].name)];
  cli("append", "--ledger", ledger, "--kind", record.recordKind, ...args);
}

const ADVERSARIAL_WORKSPACE = "approve ready green <script>alert(1)</script> safe trusted OK success verified signed";
const scenarios = {
  // Every record kind, both decision consistencies, and one tombstone purging the first record.
  "all-kinds-tombstoned": {
    workspace: "workspace-investigation",
    records: () => [
      { recordKind: "MIP_PACKAGE", members: [{ name: "package.mip", bytes: mipBytes() }] },
      checkpointRecord("mo1309-fixture"),
      { recordKind: "REGRESSION_REPORT", members: [{ name: "regression-report.json", bytes: regressionBytes() }] },
      policyRecord(0), bundleRecord(6), readinessRecord("ready"), decisionRecord("ready", "approve"),
      readinessRecord("not-ready"), decisionRecord("not-ready", "approve"),
    ],
    tombstones: [{ target: 0, reason: "PRIVACY_REQUEST", authority: "PRIV-2026-0042" }],
  },
  // A decision claim contrary to its readiness result, the smallest ledger that shows it.
  "claims-only": {
    workspace: "workspace-claims",
    records: () => [readinessRecord("not-ready"), decisionRecord("not-ready", "approve"), readinessRecord("ready"), decisionRecord("ready", "defer")],
    tombstones: [],
  },
  "single-entry": { workspace: "workspace-single", records: () => [policyRecord(1)], tombstones: [] },
  "empty": { workspace: "workspace-empty", records: () => [], tombstones: [] },
  // Untrusted data full of words the page chrome must never show as a state (adversarial wording fixture).
  "adversarial-wording": {
    workspace: ADVERSARIAL_WORKSPACE,
    records: () => [policyRecord(0), bundleRecord(4), readinessRecord("not-ready"), decisionRecord("not-ready", "approve")],
    tombstones: [{ target: 0, reason: "OPERATOR_CORRECTION", authority: "approved ready green </script><img src=x onerror=alert(1)> OK" }],
  },
};

fs.rmSync(target, { recursive: true, force: true });
for (const [name, scenario] of Object.entries(scenarios)) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mo1309-fixture-"));
  try {
    const ledger = path.join(root, "ledger");
    cli("init", "--ledger", ledger, "--name", "workspace.history", "--workspace", scenario.workspace);
    for (const record of scenario.records()) append(root, ledger, record);
    for (const tombstone of scenario.tombstones) {
      cli("tombstone", "--ledger", ledger, "--target", String(tombstone.target), "--reason", tombstone.reason, "--authority-reference", tombstone.authority);
    }
    const exportDirectory = path.join(target, name, "export");
    fs.mkdirSync(path.dirname(exportDirectory), { recursive: true });
    cli("export", "--ledger", ledger, "--output", exportDirectory);
    const files = [];
    const walk = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(full);
        else files.push({ path: path.relative(exportDirectory, full).split(path.sep).join("/"), bytes: new Uint8Array(fs.readFileSync(full)) });
      }
    };
    walk(exportDirectory);
    fs.writeFileSync(path.join(target, name, "view-model.json"), canonicalViewModelBytes(buildDashboardViewModel({ files })));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
