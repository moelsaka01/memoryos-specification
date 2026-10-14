// MO-1309 Phase 2D: characterizes dashboard view-model build, snapshot generation, snapshot size and page load.
//   node scripts/memoryos-dashboard-perf.mjs run --sizes 1000,10000,100000 --corpus <dir> --runs 3 --out <report.json>
//   node scripts/memoryos-dashboard-perf.mjs check <report.json> <budgets.json>
// `run` builds each synthetic corpus once (scripts/memoryos-dashboard-perf-corpus.mjs), then per run: one child process measures
// read, verify, view-model build, assembly and exclusive publication of the real generator (maxRSS from the child), and one
// browser load of the snapshot over file:// measures load and interactions. It needs the integrated tree (the Phase 2A page and
// harness and the Phase 2B generator) and a Chromium-family browser (MO1309_BROWSER). It reads the clock: it is a measuring tool,
// not a product unit, and nothing it measures enters a snapshot.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PERF_REPORT_KIND, PERF_REPORT_VERSION, evaluateBudgets, summarize, validateReport } from "./memoryos-dashboard-perf-budget.mjs";
import { writeCorpus } from "./memoryos-dashboard-perf-corpus.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const studio = path.join(here, "..");
const mib = 1024 * 1024;

// ---- child: one generation measurement ----
async function measureGeneration(exportDirectory, outputFile) {
  const generator = await import(pathToFileURL(path.join(here, "memoryos-dashboard-generator.mjs")).href);
  const snapshot = await import(pathToFileURL(path.join(studio, "web", "js", "memoryos-dashboard-snapshot.js")).href);
  const history = await import(pathToFileURL(path.join(studio, "web", "js", "memoryos-history-ledger.js")).href);
  const model = await import(pathToFileURL(path.join(studio, "web", "js", "memoryos-dashboard-viewmodel.js")).href);
  const now = () => Number(process.hrtime.bigint()) / 1e6;
  const t0 = now();
  const input = generator.readExportDirectory(exportDirectory);
  const t1 = now();
  history.verifyHistoryExport(input);
  const t2 = now();
  const viewModel = model.buildDashboardViewModel(input);
  const t3 = now();
  const sources = generator.loadPageSources();
  const assembled = snapshot.assembleSnapshot({ viewModel, sources });
  const t4 = now();
  generator.publishExclusively(outputFile, assembled.bytes);
  const t5 = now();
  return { readMs: t1 - t0, verifyOnlyMs: t2 - t1, viewModelBuildMs: t3 - t2, assembleMs: t4 - t3, publishMs: t5 - t4,
    snapshotBytes: assembled.bytes.byteLength, generationMaxRssMb: process.resourceUsage().maxRSS / 1024 };
}

// ---- parent: one browser load ----
async function measurePage(snapshotFile) {
  const { launchBrowser } = await import(pathToFileURL(path.join(studio, "tests", "support-devtools.mjs")).href);
  const browser = await launchBrowser();
  try {
    const page = await browser.openPage({ width: 1280, height: 900 });
    await page.navigate(pathToFileURL(snapshotFile).href);
    const metrics = await page.evaluate(`(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const rows = document.querySelectorAll("#entries tbody tr").length;
      const time = (fn) => { const a = performance.now(); fn(); return performance.now() - a; };
      const set = (id, value) => { const c = document.getElementById(id); c.value = value; c.dispatchEvent(new Event(c.tagName === "INPUT" ? "input" : "change", { bubbles: true })); };
      const kind = document.getElementById("f-kind").options[1] ? document.getElementById("f-kind").options[1].value : "";
      const filterMs = time(() => set("f-retention", "PURGED"));
      set("f-retention", "");
      const sortMs = time(() => set("f-sort", "DESCENDING"));
      set("f-sort", "ASCENDING");
      const next = [...document.querySelectorAll("nav button")].find((b) => b.textContent.includes("Next"));
      const nextPageMs = next && !next.disabled ? time(() => next.click()) : 0;
      return { loadEventMs: nav.loadEventEnd, domContentLoadedMs: nav.domContentLoadedEventEnd, firstPageRows: rows, filterMs, sortMs, nextPageMs, domNodes: document.getElementsByTagName("*").length };
    })()`);
    const heap = await page.call("Runtime.getHeapUsage");
    return { ...metrics, pageHeapMb: heap.usedSize / mib };
  } finally { await browser.close(); }
}

function hostInfo() {
  return { platform: process.platform, arch: process.arch, release: os.release(), node: process.version, cpus: os.cpus().length, cpuModel: os.cpus()[0]?.model ?? "unknown",
    totalMemoryMb: Math.round(os.totalmem() / mib) };
}

async function run(args) {
  const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
  const sizes = option("sizes", "1000,10000").split(",").map(Number);
  const runs = Number(option("runs", "3"));
  const corpusRoot = path.resolve(option("corpus", path.join(os.tmpdir(), "mo1309-perf-corpus")));
  const outFile = option("out", null);
  const report = { kind: PERF_REPORT_KIND, version: PERF_REPORT_VERSION, host: hostInfo(), results: [] };
  fs.mkdirSync(corpusRoot, { recursive: true });
  for (const entries of sizes) {
    const corpus = path.join(corpusRoot, `c${entries}`);
    if (!fs.existsSync(corpus)) writeCorpus(entries, corpus);
    const result = { entries, runs: [] };
    for (let index = 0; index < runs; index += 1) {
      const output = path.join(corpusRoot, `snapshot-${entries}-${index}.html`);
      fs.rmSync(output, { force: true });
      const started = Date.now();
      const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "measure-generation", corpus, output], { encoding: "utf8", maxBuffer: 64 * mib });
      const wall = Date.now() - started;
      if (child.status !== 0) throw new Error(`generation failed at ${entries}: ${child.stderr.split("\n")[0]}`);
      const generation = JSON.parse(child.stdout);
      const page = await measurePage(output);
      result.runs.push({ ...generation, generationWallMs: wall, ...page });
      fs.rmSync(output, { force: true });
      process.stderr.write(`${entries} run ${index + 1}/${runs}: generation ${(wall / 1000).toFixed(1)} s, load ${(page.loadEventMs / 1000).toFixed(2)} s\n`);
    }
    result.summary = summarize(result.runs);
    report.results.push(result);
    if (outFile) fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
  }
  const checked = validateReport({ ...report, results: report.results.map(({ summary, ...rest }) => rest) });
  if (!checked.ok) throw new Error(`report invalid at ${checked.reason}`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function check([reportFile, budgetsFile]) {
  const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
  const budgets = JSON.parse(fs.readFileSync(budgetsFile, "utf8"));
  const result = evaluateBudgets({ ...report, results: report.results.map(({ summary, ...rest }) => rest) }, budgets);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2);
  if (command === "measure-generation") process.stdout.write(`${JSON.stringify(await measureGeneration(args[0], args[1]))}\n`);
  else if (command === "run") await run(args);
  else if (command === "check") process.exitCode = check(args);
  else { process.stderr.write("usage: run | check | measure-generation\n"); process.exitCode = 2; }
}
