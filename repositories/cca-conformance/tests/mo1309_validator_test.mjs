// MO-1309 Phase 3: the 4D validator over synthetic repositories (DB30 and the 4D-D1..D7 rules), each rule with a negative control.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validate } from "../tools/mo1309/validate.mjs";

const sha = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const EV = "repositories/cca-conformance/evidence/mo1309";
const RECORD = "repositories/cca-conformance/mo1309-final-record.json";

function scenario(mutate = () => {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "mo1309-validator-"));
  const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  const write = (relative, content) => { const full = path.join(repo, relative); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, content); return Buffer.from(content); };
  git("init", "-q", "-b", "main"); git("config", "user.email", "t@example.invalid"); git("config", "user.name", "t");
  write("repositories/cca-studio/web/js/product.js", "export const x = 1;\n");
  write("repositories/cca-conformance/mo1309-conformance-inventory.json", JSON.stringify({ requirements: [
    { id: "DB01", cloud: { status: "COVERED", tests: [{ suite: "dashboard-unit" }] }, windows: { campaigns: ["4A"] } },
    { id: "DB05", cloud: { status: "COVERED", tests: [{ suite: "dashboard-unit" }] }, windows: { campaigns: ["4B"] } },
    { id: "DB28", cloud: { status: "COVERED", tests: [] }, windows: { campaigns: ["4C"] } }] }));
  git("add", "-A"); git("commit", "-q", "-m", "candidate");
  const candidate = git("rev-parse", "HEAD");
  const rowsLog = (suite, run) => write(`${EV}/regression/logs/${suite}-${run}.log`, `# tests 5\n# pass 5\n# fail 0\n${suite} ${run}\n`);
  const rows = [1, 2].map((run) => { const log = rowsLog("dashboard-unit", run); return { row: run, suite: "dashboard-unit", run, commit: candidate, exitCode: 0, tests: 5, pass: 5, fail: 0, log: `logs/dashboard-unit-${run}.log`, logSha256: sha(log) }; });
  const rowsBytes = write(`${EV}/regression/rows.json`, JSON.stringify(rows));
  const generations = ["4A", "4B", "4C"].map((stream) => {
    const receipt = write(`${EV}/${stream}/receipt.json`, JSON.stringify({ stream, accepted: true, certifying: true, commit: candidate, cases: [{ id: `${stream}-x`, outcome: "PASS" }] }));
    return { stream, id: `${stream}-g1`, accepted: true, certifying: true, receipt: { path: `${EV}/${stream}/receipt.json`, sha256: sha(receipt) } };
  });
  const disclosures = write("docs/mo1309-release-disclosures.md", "# disclosures\nQ-1 qualification stated.\n");
  const record = { kind: "MO1309FinalRecord", version: "1.0.0", candidate: { commit: candidate }, generations, regression: { rows: { path: `${EV}/regression/rows.json`, sha256: sha(rowsBytes) } },
    disclosures: { path: "docs/mo1309-release-disclosures.md", sha256: sha(disclosures) }, qualifications: [{ id: "Q-1" }], };
  const ctx = { repo, git, write, record, rows, candidate, sha };
  mutate(ctx);
  write(RECORD, JSON.stringify(ctx.record));
  git("add", "-A"); git("commit", "-q", "-m", "I3");
  ctx.i3 = git("rev-parse", "HEAD");
  return ctx;
}
const run = (ctx) => validate({ repo: ctx.repo });
const failing = (result) => result.findings.filter((f) => !f.ok).map((f) => f.id);
const cleanup = (ctx) => fs.rmSync(ctx.repo, { recursive: true, force: true });

test("DB30 4D a consistent record reaches I3_VALID_PENDING_BF; a binding-only BF reaches CERTIFIED_READY_TO_TAG; no tag is created", () => {
  const ctx = scenario();
  try {
    const result = run(ctx);
    assert.deepEqual(failing(result), [], JSON.stringify(result.findings.filter((f) => !f.ok)));
    assert.equal(result.state, "I3_VALID_PENDING_BF");
    assert.equal(result.tagCreated, false);
    ctx.write("repositories/cca-conformance/mo1309-final-binding.json", JSON.stringify({ i3: ctx.i3 })); ctx.git("add", "-A"); ctx.git("commit", "-q", "-m", "BF binding");
    assert.equal(run(ctx).state, "CERTIFIED_READY_TO_TAG");
    assert.equal(ctx.git("tag", "--list"), "", "the validator creates no tag");
  } finally { cleanup(ctx); }
});

test("4D-D7 negative controls: a binding that names another commit, or a BF that changes more than the binding file, is not accepted", () => {
  const wrongName = scenario();
  const extra = scenario();
  try {
    wrongName.write("repositories/cca-conformance/mo1309-final-binding.json", JSON.stringify({ i3: wrongName.candidate })); wrongName.git("add", "-A"); wrongName.git("commit", "-q", "-m", "BF");
    assert.equal(run(wrongName).state, "NOT_READY");
    extra.write("repositories/cca-conformance/mo1309-final-binding.json", JSON.stringify({ i3: extra.i3 })); extra.write("docs/mo1309-extra.md", "x"); extra.git("add", "-A"); extra.git("commit", "-q", "-m", "BF plus extra");
    assert.equal(run(extra).state, "NOT_READY");
  } finally { cleanup(wrongName); cleanup(extra); }
});

test("DB30 negative control: a tampered log is recomputed and rejected", () => {
  const ctx = scenario(({ write, rows }) => write(`${EV}/regression/logs/dashboard-unit-2.log`, "# tests 5\n# pass 5\n# fail 0\nTAMPERED\n"));
  try { const result = run(ctx); assert.equal(result.state, "NOT_READY"); assert.deepEqual(failing(result), ["4D-D4"]); } finally { cleanup(ctx); }
});

test("DB30 negative control: a row whose commit is not HEAD or an ancestor is rejected (row commits are checked, not a record-level commit)", () => {
  const ctx = scenario(({ git, write, rows, candidate, record }) => {
    git("checkout", "-q", "-b", "side"); write("side.txt", "x"); git("add", "-A"); git("commit", "-q", "-m", "side");
    const orphan = git("rev-parse", "HEAD"); git("checkout", "-q", "main");
    rows[1].commit = orphan;
    write(`${EV}/regression/rows.json`, JSON.stringify(rows));
    record.regression.rows.sha256 = sha(Buffer.from(JSON.stringify(rows)));
    record.commit = candidate; // a record-level commit must not rescue it
  });
  try { const result = run(ctx); assert.equal(result.state, "NOT_READY"); assert.ok(failing(result).includes("4D-D4")); } finally { cleanup(ctx); }
});

test("DB30 negative control: a rerun folded into the same run number, a gap in run numbers, and a missing row commit are rejected", () => {
  for (const mutate of [
    (rows) => { rows[1].run = 1; },
    (rows) => { rows[1].run = 3; },
    (rows) => { delete rows[0].commit; },
  ]) {
    const ctx = scenario(({ write, rows, record }) => { mutate(rows); const bytes = Buffer.from(JSON.stringify(rows)); write(`${EV}/regression/rows.json`, bytes); record.regression.rows.sha256 = sha(bytes); });
    try { const result = run(ctx); assert.equal(result.state, "NOT_READY"); assert.ok(failing(result).includes("4D-D4")); } finally { cleanup(ctx); }
  }
});

test("4D-D2 negative controls: two accepted generations, none accepted, and a preserved generation without a disposition are rejected", () => {
  const twice = scenario(({ record }) => { record.generations.push({ ...record.generations[0], id: "4A-g2" }); });
  const none = scenario(({ record }) => { record.generations[0].accepted = false; });
  const noDisposition = scenario(({ record }) => { record.generations.push({ ...record.generations[0], id: "4A-g0", accepted: false, certifying: false }); record.generations[record.generations.length - 1].receipt = record.generations[0].receipt; });
  try { for (const ctx of [twice, none, noDisposition]) { const result = run(ctx); assert.equal(result.state, "NOT_READY"); assert.ok(failing(result).includes("4D-D2")); } } finally { [twice, none, noDisposition].forEach(cleanup); }
});

test("4D-D1 negative control: a production byte changed after the candidate is rejected; evidence and documents are allowed", () => {
  const late = scenario(({ git, write, record }) => { write("repositories/cca-studio/web/js/product.js", "export const x = 2;\n"); });
  try { const result = run(late); assert.equal(result.state, "NOT_READY"); assert.ok(failing(result).includes("4D-D1")); } finally { cleanup(late); }
});

test("4D-D3 and 4D-D6 negative controls: a requirement with no passing suite and a disclosure that omits a qualification are rejected", () => {
  const noSuite = scenario(({ write, rows, record }) => { rows.forEach((r) => { r.exitCode = 1; r.fail = 1; }); const bytes = Buffer.from(JSON.stringify(rows)); write(`${EV}/regression/rows.json`, bytes); record.regression.rows.sha256 = sha(bytes); });
  const silent = scenario(({ write, record }) => { const bytes = write("docs/mo1309-release-disclosures.md", "# disclosures\nnothing\n"); record.disclosures.sha256 = sha(bytes); });
  try {
    const a = run(noSuite); assert.equal(a.state, "NOT_READY"); assert.ok(failing(a).includes("4D-D3"));
    const b = run(silent); assert.equal(b.state, "NOT_READY"); assert.ok(failing(b).includes("4D-D6"));
  } finally { cleanup(noSuite); cleanup(silent); }
});

test("a missing or foreign record is NOT_READY", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mo1309-validator-empty-"));
  try { execFileSync("git", ["init", "-q"], { cwd: dir }); assert.equal(validate({ repo: dir }).state, "NOT_READY"); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("4D rehearsal: the assembled record of non-certifying rehearsal receipts is NOT_READY (a rehearsal can never certify)", async () => {
  const { assembleFinalRecord } = await import("../tools/mo1309/assemble-final.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mo1309-assemble-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  const write = (relative, content) => { const full = path.join(dir, relative); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, content); };
  try {
    git("init", "-q", "-b", "main"); git("config", "user.email", "t@example.invalid"); git("config", "user.name", "t");
    write("a.txt", "1"); git("add", "-A"); git("commit", "-q", "-m", "c");
    const candidate = git("rev-parse", "HEAD");
    for (const stream of ["4a", "4b", "4c"]) write(`${EV}/${stream}/gen-1/${stream}-receipt.json`, JSON.stringify({ stream: stream.toUpperCase(), certifying: false, accepted: false, result: "REHEARSAL_PASSED_NON_CERTIFYING", cases: [] }));
    write(`${EV}/regression/rows.json`, "[]"); write("docs/mo1309-release-disclosures.md", "x");
    const record = assembleFinalRecord({ repo: dir, candidate, evidence: EV, disclosures: "docs/mo1309-release-disclosures.md" });
    assert.deepEqual(record.generations.map((g) => [g.stream, g.certifying, g.accepted]), [["4A", false, false], ["4B", false, false], ["4C", false, false]]);
    write(RECORD, JSON.stringify(record)); write("repositories/cca-conformance/mo1309-conformance-inventory.json", JSON.stringify({ requirements: [] }));
    git("add", "-A"); git("commit", "-q", "-m", "I3");
    const result = validate({ repo: dir });
    assert.equal(result.state, "NOT_READY");
    assert.ok(failing(result).includes("4D-D2"));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
