// MemoryOS 1.3.1: the conformance tooling (manifest, inventory, campaign guard rails, final validator). Requirements: SH23 (one row per suite run),
// SH24 (the inventory maps every requirement), and the certification rules of Freeze section 15. Every rule has a negative control.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { REPO } from "../tools/mo1309/run-tests.mjs";
import { MANIFEST, readManifest, runnable } from "../tools/mo1310/run-tests.mjs";
import { ALL_IDS, FREEZE, INVENTORY, buildInventory, expandList, parseCampaign, parseRequirements } from "../tools/mo1310/inventory.mjs";
import { CASES, WINDOWS_ONLY, runCampaign } from "../tools/mo1310/campaign.mjs";
import { validate, BASELINE } from "../tools/mo1310/validate.mjs";
import { assembleFinalRecord } from "../tools/mo1310/assemble-final.mjs";

const sha = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;

test("SH23 the manifest is well formed, every suite file exists, every History and MO-1309 suite is named, and the MO-1307 suite is strict", () => {
  const manifest = readManifest();
  const ids = manifest.suites.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const required of ["studio-history", "studio-history-browser", "studio-existing", "cli", "mo1308", "mo1309-dashboard-unit", "mo1309-dashboard-browser", "mo1309-dashboard-differential-10k", "mo1309-tools", "mo1309-baseline-bound", "mo1310-tools", "mo1307-strict"]) assert.ok(ids.includes(required), required);
  for (const suite of manifest.suites) for (const file of suite.files ?? []) assert.ok(fs.existsSync(path.join(REPO, suite.cwd, file)), `${suite.id}: ${file}`);
  assert.deepEqual(manifest.suites.find((s) => s.id === "mo1307-strict").expect, { tests: 639, pass: 639, fail: 0 });
  // The MO-1309 dashboard suites are the ones its own manifest runs (nothing dropped from the retained regression).
  const mo1309 = JSON.parse(fs.readFileSync(path.join(REPO, "repositories/cca-conformance/mo1309-test-manifest.json"), "utf8"));
  const files = (m, id) => m.suites.find((s) => s.id === id).files;
  assert.deepEqual(files(manifest, "mo1309-dashboard-unit"), files(mo1309, "dashboard-unit"));
  assert.deepEqual(files(manifest, "mo1309-dashboard-browser"), files(mo1309, "dashboard-browser"));
  assert.deepEqual(files(manifest, "mo1309-dashboard-differential-10k"), files(mo1309, "dashboard-differential-10k"));
  assert.deepEqual([...files(manifest, "mo1309-tools"), ...files(manifest, "mo1309-baseline-bound")].sort(), [...files(mo1309, "mo1309-tools")].sort(), "the MO-1309 tooling tests are split in two suites, none dropped");
  assert.deepEqual(manifest.suites.find((s) => s.id === "mo1309-baseline-bound").expectedFailing, { tests: 11, pass: 9, fail: 2, reason: manifest.suites.find((s) => s.id === "mo1309-baseline-bound").expectedFailing.reason });
  // `nodeArgs` run under the runner's own Node; the studio suite stays the declared npm command.
  assert.deepEqual(runnable({ id: "x", cwd: "y", nodeArgs: ["--test", "a"] }).command, [process.execPath, "--test", "a"]);
  assert.deepEqual(manifest.suites.find((s) => s.id === "studio-existing").command, ["npm", "test", "--silent"]);
  // Negative control: a manifest of the wrong kind or a suite with two shapes is refused.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mo1310-manifest-"));
  try {
    const write = (name, value) => { const file = path.join(scratch, name); fs.writeFileSync(file, JSON.stringify(value)); return file; };
    assert.throws(() => readManifest(write("kind.json", { kind: "other", suites: [] })), /not an MO-1310/u);
    assert.throws(() => readManifest(write("shape.json", { kind: "MO1310TestManifest", suites: [{ id: "a", cwd: "b", files: [], command: [] }] })), /bad suite/u);
    assert.throws(() => readManifest(write("dup.json", { kind: "MO1310TestManifest", suites: [{ id: "a", cwd: "b", files: [] }, { id: "a", cwd: "b", files: [] }] })), /bad suite/u);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});

test("SH24 the committed inventory equals the rebuilt one and covers SH01 to SH24 from the Freeze, with the campaign families", () => {
  assert.equal(fs.readFileSync(INVENTORY, "utf8"), `${JSON.stringify(buildInventory(), null, 2)}\n`);
  const inventory = JSON.parse(fs.readFileSync(INVENTORY, "utf8"));
  assert.equal(inventory.status, "CLOUD_COVERAGE_ONLY_NOT_CERTIFIED");
  assert.deepEqual(inventory.requirements.map((r) => r.id), [...ALL_IDS]);
  for (const requirement of inventory.requirements) assert.equal(requirement.cloud.status, "COVERED", requirement.id);
  const freeze = fs.readFileSync(FREEZE, "utf8");
  assert.equal(parseRequirements(freeze).length, 24);
  const families = parseCampaign(freeze);
  assert.deepEqual(Object.keys(families), ["End to end", "Security and wording", "Closure"]);
  assert.deepEqual(Object.values(families).flatMap((f) => f.cases), [...CASES], "the campaign cases are exactly the Freeze's");
  for (const id of CASES) assert.ok(typeof WINDOWS_ONLY[id] === "string" && WINDOWS_ONLY[id].length > 0, id);
  // Every requirement the Freeze assigns to a campaign family carries it in the inventory; the rest are regression-only.
  for (const requirement of inventory.requirements) {
    const expected = Object.entries(families).filter(([, f]) => f.requirements.includes(requirement.id)).map(([name]) => name);
    assert.deepEqual(requirement.windows.families, expected, requirement.id);
    assert.equal(requirement.windows.certifying, false);
  }
  // Negative controls: the list expansion and the parser do not invent entries.
  assert.deepEqual(expandList("SH01–SH03, SH07"), ["SH01", "SH02", "SH03", "SH07"]);
  assert.deepEqual(parseRequirements("| not a row |"), []);
  // A row without any tagged test or record would be NONE: the inventory marks it.
  const tampered = freeze.replace("| SH24 | The conformance inventory", "| SH99 | The conformance inventory");
  assert.equal(parseRequirements(tampered).some((r) => r.id === "SH99"), true);
});

test("SH23 the campaign refuses a certifying run off the Windows host, off the pinned Node, from a dirty tree, into an existing or foreign directory", async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mo1310-campaign-"));
  try {
    await assert.rejects(runCampaign({ mode: "certifying", out: path.join(scratch, "gen-1") }), /certifying run refused: .*(platform is not win32|node is|not under evidence)/u);
    await assert.rejects(runCampaign({ mode: "certifying", out: scratch }), /output directory exists|not under evidence/u);
    assert.equal(fs.readdirSync(scratch).length, 0, "a refused run writes nothing");
    assert.equal(CASES.length, 17);
    assert.deepEqual(CASES.filter((id) => id.startsWith("SH-E")).length, 7);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});

// ---- The final validator over synthetic repositories ----
const EV = "repositories/cca-conformance/evidence/mo1310";
const RECORD = "repositories/cca-conformance/mo1310-final-record.json";
const BINDING = "repositories/cca-conformance/mo1310-final-binding.json";

function scenario(mutate = () => {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "mo1310-validator-"));
  const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  const write = (relative, content) => { const full = path.join(repo, relative); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, content); return Buffer.from(content); };
  git("init", "-q", "-b", "main"); git("config", "user.email", "t@example.invalid"); git("config", "user.name", "t");
  write("repositories/cca-studio/web/js/product.js", "export const x = 1;\n");
  write("repositories/cca-conformance/mo1310-test-manifest.json", JSON.stringify({ kind: "MO1310TestManifest", suites: [
    { id: "unit", cwd: "x", files: [] }, { id: "mo1307-strict", cwd: "x", nodeArgs: [], expect: { tests: 639, pass: 639, fail: 0 } },
    { id: "pinned", cwd: "x", files: [], expectedFailing: { tests: 11, pass: 9, fail: 2 } }] }));
  write("repositories/cca-conformance/mo1310-conformance-inventory.json", JSON.stringify({ campaign: { families: { "End to end": { cases: ["SH-E1"] }, Closure: { cases: ["SH-C1"] } } }, requirements: [
    { id: "SH01", cloud: { status: "COVERED", tests: [{ suite: "unit" }] }, windows: { families: ["End to end"] } },
    { id: "SH19", cloud: { status: "COVERED", tests: [{ suite: "unit" }] }, windows: { families: ["Closure"] } },
    { id: "SH23", cloud: { status: "COVERED", tests: [] }, windows: { families: [] } }] }));
  git("add", "-A"); git("commit", "-q", "-m", "candidate");
  const candidate = git("rev-parse", "HEAD");
  const rowOf = (suite, run, counts) => { const log = write(`${EV}/regression/logs/${suite}-${run}.log`, `# tests ${counts.tests}\n# pass ${counts.pass}\n# fail ${counts.fail}\n`);
    return { row: 0, suite, run, commit: candidate, exitCode: counts.fail === 0 ? 0 : 1, ...counts, log: `logs/${suite}-${run}.log`, logSha256: sha(log) }; };
  const rows = [rowOf("unit", 1, { tests: 5, pass: 5, fail: 0 }), rowOf("mo1307-strict", 1, { tests: 639, pass: 639, fail: 0 }), rowOf("pinned", 1, { tests: 11, pass: 9, fail: 2 })];
  const rowsBytes = write(`${EV}/regression/rows.json`, JSON.stringify(rows));
  const receiptBytes = write(`${EV}/campaign/gen-1/mo1310-campaign-receipt.json`, JSON.stringify({ kind: "MO1310CampaignReceipt", certifying: true, accepted: true, commit: candidate, host: { platform: "win32", arch: "x64" },
    cases: [{ id: "SH-E1", outcome: "PASS" }, { id: "SH-C1", outcome: "PASS", nativeChangeProof: { baseline: BASELINE, nativePaths: [] } }] }));
  const gate = write(`${EV}/differential/receipt.json`, JSON.stringify({ baseline: BASELINE, candidate, verdict: "PASS_QUALIFIED_CLOUD_SUBSET" }));
  const disclosures = write("docs/mo1310-release-disclosures.md", "# disclosures\nQ-1 qualification stated.\n");
  const record = { kind: "MO1310FinalRecord", version: "1.0.0", candidate: { commit: candidate },
    generations: [{ id: "SH-gen-1", accepted: true, certifying: true, receipt: { path: `${EV}/campaign/gen-1/mo1310-campaign-receipt.json`, sha256: sha(receiptBytes) } }],
    regression: { rows: { path: `${EV}/regression/rows.json`, sha256: sha(rowsBytes) } }, differential: { receipt: { path: `${EV}/differential/receipt.json`, sha256: sha(gate) } },
    disclosures: { path: "docs/mo1310-release-disclosures.md", sha256: sha(disclosures) }, qualifications: [{ id: "Q-1" }] };
  const ctx = { repo, git, write, record, rows, candidate, rowOf };
  mutate(ctx);
  write(RECORD, JSON.stringify(ctx.record));
  git("add", "-A"); git("commit", "-q", "-m", "I3");
  ctx.i3 = git("rev-parse", "HEAD");
  return ctx;
}
const failing = (result) => result.findings.filter((f) => !f.ok).map((f) => f.id);
const cleanup = (ctx) => fs.rmSync(ctx.repo, { recursive: true, force: true });
const rebindRows = (ctx) => { const bytes = ctx.write(`${EV}/regression/rows.json`, JSON.stringify(ctx.rows)); ctx.record.regression.rows.sha256 = sha(bytes); };

test("SH23 a consistent record reaches I3_VALID_PENDING_BF, a binding-only BF reaches CERTIFIED_READY_TO_TAG, and no tag is created", () => {
  const ctx = scenario();
  try {
    const result = validate({ repo: ctx.repo });
    assert.deepEqual(failing(result), [], JSON.stringify(result.findings.filter((f) => !f.ok)));
    assert.equal(result.state, "I3_VALID_PENDING_BF");
    assert.equal(result.tagCreated, false);
    ctx.write(BINDING, JSON.stringify({ i3: ctx.i3 })); ctx.git("add", "-A"); ctx.git("commit", "-q", "-m", "BF binding");
    assert.equal(validate({ repo: ctx.repo }).state, "CERTIFIED_READY_TO_TAG");
    assert.equal(ctx.git("tag", "--list"), "");
    // A binding that names another commit, or a BF that changes more than the binding, is not a binding.
    ctx.write("repositories/cca-studio/web/js/product.js", "export const x = 2;\n"); ctx.git("add", "-A"); ctx.git("commit", "-q", "-m", "late production change");
    assert.equal(validate({ repo: ctx.repo }).state, "NOT_READY");
  } finally { cleanup(ctx); }
});

test("SH23 each rule has a negative control: wrong platform, two accepted generations, missing disposition, a stale log, a rerun without its own row, a missed strict count, no native proof, a missing disclosure", () => {
  const cases = {
    "SH-D2 not a Windows run": [(c) => { const receipt = JSON.parse(fs.readFileSync(path.join(c.repo, `${EV}/campaign/gen-1/mo1310-campaign-receipt.json`), "utf8")); receipt.host.platform = "linux";
      const bytes = c.write(`${EV}/campaign/gen-1/mo1310-campaign-receipt.json`, JSON.stringify(receipt)); c.record.generations[0].receipt.sha256 = sha(bytes); }, ["SH-D2", "SH-D3"]],
    "SH-D2 preserved generation without a disposition": [(c) => { const bytes = c.write(`${EV}/campaign/gen-0/mo1310-campaign-receipt.json`, JSON.stringify({ kind: "MO1310CampaignReceipt", certifying: true, accepted: false, host: { platform: "win32", arch: "x64" }, cases: [] }));
      c.record.generations.unshift({ id: "SH-gen-0", accepted: false, certifying: true, receipt: { path: `${EV}/campaign/gen-0/mo1310-campaign-receipt.json`, sha256: sha(bytes) } }); }, ["SH-D2", "SH-D6"]],
    "SH-D4 stale log": [(c) => { c.write(`${EV}/regression/logs/unit-1.log`, "changed after the row was recorded\n"); }, ["SH-D4"]],
    "SH-D4 rerun under the same run number": [(c) => { c.rows.push({ ...c.rows[0], row: 3 }); rebindRows(c); }, ["SH-D4"]],
    "SH-D4 strict count not met": [(c) => { c.rows[1] = { ...c.rowOf("mo1307-strict", 1, { tests: 639, pass: 632, fail: 7 }) }; rebindRows(c); }, ["SH-D4"]],
    "SH-D4 a pinned baseline suite with other counts": [(c) => { c.rows[2] = { ...c.rowOf("pinned", 1, { tests: 11, pass: 8, fail: 3 }) }; rebindRows(c); }, ["SH-D4"]],
    "SH-D4 a pinned baseline suite that now passes outright": [(c) => { c.rows[2] = { ...c.rowOf("pinned", 1, { tests: 11, pass: 11, fail: 0 }) }; rebindRows(c); }, ["SH-D4"]],
    "SH-D4 a suite without a passing row": [(c) => { c.rows = c.rows.filter((r) => r.suite !== "unit"); rebindRows(c); }, ["SH-D4", "SH-D3"]],
    "SH-D5 native proof missing": [(c) => { const receipt = JSON.parse(fs.readFileSync(path.join(c.repo, `${EV}/campaign/gen-1/mo1310-campaign-receipt.json`), "utf8")); receipt.cases[1].nativeChangeProof.nativePaths = ["a.cpp"];
      const bytes = c.write(`${EV}/campaign/gen-1/mo1310-campaign-receipt.json`, JSON.stringify(receipt)); c.record.generations[0].receipt.sha256 = sha(bytes); }, ["SH-D5"]],
    "SH-D5 differential against the wrong base": [(c) => { const bytes = c.write(`${EV}/differential/receipt.json`, JSON.stringify({ baseline: "bf2fdc87e9b2bfc25588ef61deacac6c04684376", candidate: c.candidate, verdict: "PASS" })); c.record.differential.receipt.sha256 = sha(bytes); }, ["SH-D5"]],
    "SH-D6 a qualification the disclosures do not state": [(c) => { c.record.qualifications.push({ id: "Q-UNSTATED" }); }, ["SH-D6"]],
    "SH-D1 a production change after the candidate": [(c) => { c.write("repositories/cca-studio/web/js/product.js", "export const x = 3;\n"); }, ["SH-D1"]],
  };
  for (const [label, [mutate, expected]] of Object.entries(cases)) {
    const ctx = scenario(mutate);
    try {
      const result = validate({ repo: ctx.repo });
      assert.equal(result.state, "NOT_READY", label);
      for (const id of expected.slice(0, 1)) assert.ok(failing(result).includes(id), `${label}: ${failing(result)}`);
    } finally { cleanup(ctx); }
  }
});

test("SH23 a rerun is its own numbered row and the validator accepts it", () => {
  const ctx = scenario((c) => { c.rows.push({ ...c.rowOf("unit", 2, { tests: 5, pass: 5, fail: 0 }), row: 3 }); rebindRows(c); });
  try {
    assert.deepEqual(failing(validate({ repo: ctx.repo })), []);
  } finally { cleanup(ctx); }
});

test("SH23 the assembler binds the evidence, copies accepted and certifying from the receipt and decides nothing", () => {
  const ctx = scenario();
  try {
    const record = assembleFinalRecord({ repo: ctx.repo, candidate: ctx.candidate, evidence: EV, disclosures: "docs/mo1310-release-disclosures.md", differential: `${EV}/differential/receipt.json`, qualifications: ["Q-1"] });
    assert.equal(record.kind, "MO1310FinalRecord");
    assert.equal(record.generations.length, 1);
    assert.deepEqual({ accepted: record.generations[0].accepted, certifying: record.generations[0].certifying }, { accepted: true, certifying: true });
    assert.equal(record.generations[0].receipt.sha256, ctx.record.generations[0].receipt.sha256);
    assert.equal(record.regression.rows.sha256, ctx.record.regression.rows.sha256);
    fs.writeFileSync(path.join(ctx.repo, RECORD), JSON.stringify(record)); ctx.git("add", "-A"); ctx.git("commit", "-q", "-m", "assembled");
    assert.deepEqual(failing(validate({ repo: ctx.repo })), []);
  } finally { cleanup(ctx); }
});
