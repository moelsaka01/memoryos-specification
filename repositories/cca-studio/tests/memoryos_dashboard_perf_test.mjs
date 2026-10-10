// MO-1309 Phase 2D (Contract Freeze 1 section 12): the corpus builder, the report and budget logic, and the recorded binding.
// Requirements: DB22 (the certified scale is measured, 100,000 is characterized with no claim). The measuring run itself needs the
// integrated tree and a browser, so it is recorded in docs/mo1309-phase2d-performance.md and re-run by the Windows campaign.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDashboardViewModel } from "../web/js/memoryos-dashboard-viewmodel.js";
import { MEMORYOS_HISTORY_LIMITS } from "../web/js/memoryos-history-contract.js";
import { verifyHistoryExport } from "../web/js/memoryos-history-ledger.js";
import { buildCorpusExport, writeCorpus } from "../scripts/memoryos-dashboard-perf-corpus.mjs";
import { METRICS, PERF_REPORT_KIND, PERF_REPORT_VERSION, evaluateBudgets, median, summarize, validateReport } from "../scripts/memoryos-dashboard-perf-budget.mjs";

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const docs = (name) => path.join(repo, "docs", name);

test("the corpus is a valid MO-1308 export accepted by the product verifier, deterministic, with tombstones and purges", () => {
  const files = buildCorpusExport(60);
  const again = buildCorpusExport(60);
  assert.deepEqual(files.map((f) => [f.path, Buffer.from(f.bytes).toString("hex")]), again.map((f) => [f.path, Buffer.from(f.bytes).toString("hex")]));
  const verification = verifyHistoryExport({ files });
  assert.equal(verification.entryCount, 60);
  assert.equal(verification.tombstones, 3);
  assert.equal(verification.purgedRecords, 3);
  assert.equal(verification.retainedRecords, 54);
  const viewModel = buildDashboardViewModel({ files });
  assert.equal(viewModel.entries.filter((e) => e.retention === "PURGED").length, 3);
  assert.ok(files.filter((f) => f.path.startsWith("entries/")).every((f) => f.bytes.byteLength < MEMORYOS_HISTORY_LIMITS.entryBytes));
  assert.equal(files.filter((f) => f.path.startsWith("records/")).length, 54 * 2, "purged records keep no members");
  assert.equal(buildCorpusExport(0).length, 3, "an empty corpus is the descriptor, the manifest and the marker only");
  assert.throws(() => buildCorpusExport(MEMORYOS_HISTORY_LIMITS.entriesPerLedger + 1), RangeError);
  assert.throws(() => buildCorpusExport(-1), RangeError);
  assert.notDeepEqual(buildCorpusExport(61).map((f) => f.path), files.map((f) => f.path));
});

test("writeCorpus writes the same bytes to disk and refuses an existing directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mo1309-perf-test-"));
  try {
    const target = path.join(root, "c");
    const { files, bytes } = writeCorpus(25, target);
    const expected = buildCorpusExport(25);
    assert.equal(files, expected.length);
    assert.equal(bytes, expected.reduce((n, f) => n + f.bytes.byteLength, 0));
    for (const file of expected) assert.deepEqual(new Uint8Array(fs.readFileSync(path.join(target, ...file.path.split("/")))), file.bytes);
    assert.throws(() => writeCorpus(25, target), /exists/u);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

const run = (overrides = {}) => ({ readMs: 10, viewModelBuildMs: 20, verifyOnlyMs: 5, assembleMs: 3, publishMs: 2, generationWallMs: 100, generationMaxRssMb: 80, snapshotBytes: 5000, loadEventMs: 50,
  domContentLoadedMs: 49, firstPageRows: 100, filterMs: 4, sortMs: 5, nextPageMs: 6, pageHeapMb: 3, domNodes: 1200, ...overrides });
const report = (runs) => ({ kind: PERF_REPORT_KIND, version: PERF_REPORT_VERSION, host: { platform: "linux", node: "v22" }, results: [{ entries: 1000, runs }] });

test("summary statistics and report validation, with negative controls", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  const summary = summarize([run({ generationWallMs: 100 }), run({ generationWallMs: 300 }), run({ generationWallMs: 200 })]);
  assert.deepEqual(summary.generationWallMs, { min: 100, median: 200, max: 300 });
  assert.deepEqual(Object.keys(summary).sort(), Object.keys(METRICS).sort());
  assert.ok(validateReport(report([run()])).ok);
  const refused = (value) => assert.equal(validateReport(value).ok, false);
  refused({ ...report([run()]), kind: "Other" });
  refused({ ...report([run()]), host: null });
  refused({ ...report([run()]), results: [] });
  refused(report([]));
  refused(report([run({ unknownMetric: 1 })]));
  refused(report([run({ readMs: -1 })]));
  refused(report([run({ readMs: Number.NaN })]));
  refused(report([{ ...run(), generationWallMs: undefined }]));
  const incomplete = run(); delete incomplete.loadEventMs;
  refused(report([incomplete])); // generation and load must both have completed
  refused({ ...report([run()]), results: [{ entries: 1000, runs: [run()] }, { entries: 1000, runs: [run()] }] });
});

test("budgets are evaluated on the worst run at the certified scale; a violation, a missing metric and a missing scale are refused", () => {
  const budgets = { scale: 1000, maximum: { generationWallMs: 500, snapshotBytes: 6000, loadEventMs: 200 } };
  assert.ok(evaluateBudgets(report([run(), run({ generationWallMs: 499 })]), budgets).ok);
  const over = evaluateBudgets(report([run(), run({ generationWallMs: 501 })]), budgets);
  assert.equal(over.ok, false);
  assert.deepEqual(over.violations, [{ metric: "generationWallMs", worst: 501, bound: 500 }]);
  assert.equal(evaluateBudgets(report([run({ snapshotBytes: 6001 })]), budgets).ok, false);
  assert.equal(evaluateBudgets(report([run()]), { ...budgets, scale: 10000 }).reason, "scale not measured");
  assert.equal(evaluateBudgets(report([run()]), { scale: 1000, maximum: { nonsense: 1 } }).ok, false);
  assert.equal(evaluateBudgets({ kind: "x" }, budgets).ok, false);
});

// ---- the recorded binding (Freeze section 12) ----
test("DB22 the recorded cloud report is valid, its certified scale follows the Freeze rule, and 100,000 is characterized with no budget or claim", () => {
  const measured = JSON.parse(fs.readFileSync(docs("mo1309-phase2d-cloud-report.json"), "utf8"));
  assert.ok(validateReport(measured).ok);
  const budgets = JSON.parse(fs.readFileSync(docs("mo1309-phase2d-budgets.json"), "utf8"));
  // The Freeze rule: the largest of 1,000 and 10,000 at which generation and load completed.
  const completed = [1000, 10000].filter((n) => measured.results.some((r) => r.entries === n && r.runs.length >= 3 && validateReport({ ...measured, results: [r] }).ok));
  assert.equal(budgets.scale, Math.max(...completed));
  assert.deepEqual(budgets.characterizedOnly, [100000]);
  assert.ok(!Object.hasOwn(budgets, "100000"));
  assert.ok(evaluateBudgets(measured, budgets).ok, "the recorded cloud worst run is within the recorded budgets");
  assert.ok(measured.results.some((r) => r.entries === 100000), "the 100,000-entry characterization is recorded");
  for (const [name, bound] of Object.entries(budgets.maximum)) assert.ok(Object.hasOwn(METRICS, name) && bound > 0, name);
  assert.match(budgets.rule, /owner review/u);
});

test("the prepared Windows run names exactly the commands the runner supports and claims no Windows result", () => {
  const plan = fs.readFileSync(docs("mo1309-phase2d-windows-run.md"), "utf8");
  for (const needle of ["node scripts/memoryos-dashboard-perf.mjs run", "node scripts/memoryos-dashboard-perf.mjs check", "mo1309-phase2d-budgets.json", "24.21.0", "MO1309_BROWSER", "Windows 11 x64", "not been run"]) {
    assert.ok(plan.includes(needle), needle);
  }
  assert.doesNotMatch(plan, /Windows result:|passed on Windows/u);
  const performance = fs.readFileSync(docs("mo1309-phase2d-performance.md"), "utf8");
  assert.match(performance, /No Windows result/u);
});
