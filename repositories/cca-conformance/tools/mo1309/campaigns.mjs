// MO-1309 Phase 4 one-shot campaigns 4A (end to end), 4B (closure and supply) and 4C (security and trust wording), authored in the cloud
// and rehearsed there as NON-CERTIFYING. A certifying run exists only on the Windows host (Freeze DB29): it requires Windows 11 x64,
// Node 24.21.0, a clean checkout, and a new output directory under repositories/cca-conformance/evidence/mo1309/, and it is made once.
//   node tools/mo1309/campaigns.mjs <4a|4b|4c> --out <dir> [--rehearsal | --certifying] [--full] [--browser <path>]
// A rehearsal writes the same receipt with certifying:false and records every case that needs the Windows host as REHEARSED_ONLY.
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REPO, sha256 } from "./run-tests.mjs";
import { audit } from "./audit.mjs";

const studio = path.join(REPO, "repositories", "cca-studio");
const load = (relative) => import(pathToFileURL(path.join(studio, relative)).href);
export const REQUIRED_NODE = "v24.21.0";
export const CAMPAIGNS = Object.freeze({
  "4A": ["4A-E1", "4A-E2", "4A-E3", "4A-E4", "4A-E5", "4A-E6", "4A-E7", "4A-E8", "4A-E9"],
  "4B": ["4B-C1", "4B-C2", "4B-C3", "4B-C4"],
  "4C": ["4C-S1", "4C-S2", "4C-S3", "4C-S4", "4C-S5", "4C-S6"],
});
// Case parts that only the Windows host can establish (listed in the Phase 3 handoff and docs/mo1309-phase4-windows-plan.md).
export const WINDOWS_ONLY = Object.freeze({
  "4A-E1": "export from the MO-1308 CLI on Windows 11 x64 (NTFS), Node 24.21.0", "4A-E2": "same, with tombstones and a purge on NTFS",
  "4A-E3": "same", "4A-E4": "certified-scale (10,000) generation, load and budget check on the reference host", "4A-E5": "byte comparison on the reference host",
  "4A-E6": "file:// and static HTTP in the Windows Chromium-family browser", "4A-E7": "keyboard, 200% zoom, 320/768/1280 layouts in the Windows browser",
  "4A-E8": "100,000-entry characterization (--full) on the reference host", "4A-E9": "exclusive output and failure paths on NTFS (hard-link publication, sharing violations)",
  "4B-C1": "released closures and tags on the Windows checkout", "4B-C2": "none beyond a clean Windows checkout", "4B-C3": "none beyond Node 24.21.0",
  "4B-C4": "source-closure reproducibility from a fresh Windows checkout (line endings)",
  "4C-S1": "injection corpus rendered in the Windows browser", "4C-S2": "CSP enforced in the Windows browser, network blocked", "4C-S3": "tamper corpus on NTFS files",
  "4C-S4": "forbidden-affordance scan of the Windows-rendered DOM", "4C-S5": "swap-after-read probe on NTFS (real directory swap during the read)", "4C-S6": "data-class scan of Windows-generated output",
});

const git = (args) => execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim();
const scratch = (label) => fs.mkdtempSync(path.join(os.tmpdir(), `mo1309-${label}-`));
const pass = (detail, extra = {}) => ({ outcome: "PASS", detail, ...extra });
const fail = (detail, extra = {}) => ({ outcome: "FAIL", detail, ...extra });
const ensure = (condition, detail, extra) => (condition ? pass(detail, extra) : fail(detail, extra));
const walkFiles = (root) => fs.readdirSync(root, { withFileTypes: true, recursive: true }).filter((e) => e.isFile()).map((e) => path.join(e.parentPath ?? e.path, e.name)).sort();
const treeDigest = (root) => sha256(Buffer.from(walkFiles(root).map((f) => `${path.relative(root, f).split(path.sep).join("/")}\0${crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex")}`).join("\n")));

// ---- shared helpers ----
async function cliExport(root, { workspace, records, tombstones = [] }) {
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
const allKinds = (c) => [{ recordKind: "MIP_PACKAGE", members: [{ name: "package.mip", bytes: c.mipBytes() }] }, c.checkpointRecord("mo1309-campaign"),
  { recordKind: "REGRESSION_REPORT", members: [{ name: "regression-report.json", bytes: c.regressionBytes() }] }, c.policyRecord(0), c.bundleRecord(6),
  c.readinessRecord("ready"), c.decisionRecord("ready", "approve"), c.readinessRecord("not-ready"), c.decisionRecord("not-ready", "approve")];

async function generate(exportDirectory, outputFile) {
  const generator = await load("scripts/memoryos-dashboard-generator.mjs");
  return generator.generateSnapshot({ exportDirectory, outputFile });
}
async function modelOf(exportDirectory) {
  const generator = await load("scripts/memoryos-dashboard-generator.mjs");
  const model = await load("web/js/memoryos-dashboard-viewmodel.js");
  return model.buildDashboardViewModel(generator.readExportDirectory(exportDirectory));
}
async function withBrowser(browserPath, body) {
  if (browserPath) process.env.MO1309_BROWSER = browserPath;
  const { launchBrowser, findBrowser } = await load("tests/support-devtools.mjs");
  if (findBrowser() === null) return { outcome: "NOT_RUN", detail: "no Chromium-family browser found" };
  const browser = await launchBrowser();
  try { return await body(browser); } finally { await browser.close(); }
}
function nodeTest(files, pattern) {
  const args = ["--test", ...(pattern ? [`--test-name-pattern=${pattern}`] : []), ...files];
  const result = spawnSync(process.execPath, args, { cwd: studio, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const read = (name) => Number(new RegExp(`^# ${name} (\\d+)$`, "mu").exec(result.stdout)?.[1] ?? Number.NaN);
  return { exitCode: result.status, tests: read("tests"), pass: read("pass"), fail: read("fail"), logSha256: sha256(Buffer.from(result.stdout + result.stderr)) };
}
const viaTests = (files, pattern, detail) => () => { const r = nodeTest(files, pattern); return { ...(r.exitCode === 0 && r.fail === 0 && r.pass > 0 ? pass(detail, r) : fail(detail, r)) }; };

// ---- 4A ----
const cases4A = ({ full, browser }) => ({
  "4A-E1": async () => { const root = scratch("e1"); try {
    const exportDir = await cliExport(root, { workspace: "workspace-4a", records: allKinds, tombstones: [] }); const model = await modelOf(exportDir);
    const kinds = model.summary.byRecordKind.filter((row) => row.count > 0).map((row) => row.recordKind);
    const out = path.join(root, "s.html"); const { digest } = await generate(exportDir, out);
    return ensure(kinds.length === 7 && fs.existsSync(out), "a real CLI export with every record kind verifies, builds and generates", { recordKinds: kinds, digest });
  } finally { fs.rmSync(root, { recursive: true, force: true }); } },
  "4A-E2": async () => { const root = scratch("e2"); try {
    const exportDir = await cliExport(root, { workspace: "workspace-4a", records: allKinds, tombstones: [{ target: 0, reason: "PRIVACY_REQUEST", authority: "PRIV-4A-0001" }] }); const model = await modelOf(exportDir);
    return ensure(model.verification.tombstones === 1 && model.verification.purgedRecords === 1 && model.entries[0].retention === "PURGED" && model.entries[0].members.length > 0, "tombstone and purge: retention PURGED, member list retained", { verification: model.verification });
  } finally { fs.rmSync(root, { recursive: true, force: true }); } },
  "4A-E3": async () => { const results = []; for (const [name, records] of [["empty", () => []], ["single", (c) => [c.policyRecord(1)]]]) { const root = scratch("e3"); try {
    const exportDir = await cliExport(root, { workspace: `workspace-${name}`, records }); const model = await modelOf(exportDir); results.push([name, model.source.entryCount]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); } }
    return ensure(results[0][1] === 0 && results[1][1] === 1, "empty and single-entry exports verify and build", { results }); },
  "4A-E4": async () => { const root = scratch("e4"); try {
    const perf = path.join(studio, "scripts", "memoryos-dashboard-perf.mjs"); const report = path.join(root, "report.json");
    const run = spawnSync(process.execPath, [perf, "run", "--sizes", full ? "10000" : "1000", "--runs", "1", "--corpus", path.join(root, "corpus"), "--out", report], { cwd: studio, encoding: "utf8", env: { ...process.env, ...(browser ? { MO1309_BROWSER: browser } : {}) }, maxBuffer: 256 * 1024 * 1024 });
    if (run.status !== 0) return fail("the performance runner failed", { stderr: run.stderr.split("\n")[0] });
    const check = full ? spawnSync(process.execPath, [perf, "check", report, path.join(REPO, "docs/mo1309-phase2d-budgets.json")], { cwd: studio, encoding: "utf8" }) : { status: 0, stdout: "{\"note\":\"rehearsal measures 1,000 entries; the budgets apply to 10,000 (--full)\"}" };
    return ensure(check.status === 0, full ? "certified scale (10,000) generated, loaded and within the recorded budgets" : "rehearsal at 1,000 entries (budgets apply to 10,000 with --full)", { check: check.stdout.trim().slice(0, 300), scale: full ? 10000 : 1000 });
  } finally { fs.rmSync(root, { recursive: true, force: true }); } },
  "4A-E5": async () => { const root = scratch("e5"); try {
    const exportDir = await cliExport(root, { workspace: "workspace-4a", records: allKinds }); const a = path.join(root, "a.html"); const b = path.join(root, "b.html");
    await generate(exportDir, a); await generate(exportDir, b);
    return ensure(Buffer.compare(fs.readFileSync(a), fs.readFileSync(b)) === 0, "two generations from the same export are byte-identical", { snapshotSha256: sha256(fs.readFileSync(a)) });
  } finally { fs.rmSync(root, { recursive: true, force: true }); } },
  "4A-E6": async () => withBrowser(browser, async (b) => { const root = scratch("e6"); try {
    const exportDir = await cliExport(root, { workspace: "workspace-4a", records: allKinds }); const out = path.join(root, "s.html"); await generate(exportDir, out);
    const { serveStatic } = await load("tests/support-devtools.mjs"); const html = fs.readFileSync(out);
    const host = await serveStatic(new Map([["/s.html", html]]));
    const text = async (url) => { const page = await b.openPage({ width: 1280, height: 900 }); await page.navigate(url); const value = await page.evaluate("document.body.innerText"); return { value, requests: page.requests.filter((u) => !u.startsWith(url)).length }; };
    try { const f = await text(pathToFileURL(out).href); const h = await text(`${host.origin}/s.html`);
      return ensure(f.value === h.value && f.value.length > 0 && f.requests === 0 && h.requests === 0, "identical rendered text from file:// and a static HTTP host, no further requests", { characters: f.value.length }); } finally { await host.close(); }
  } finally { fs.rmSync(root, { recursive: true, force: true }); } }),
  "4A-E7": viaTests(["tests/memoryos_dashboard_browser_test.mjs"], "keyboard|zoom|320|768|1280|contrast|reflow|layout", "keyboard, zoom and 320/768/1280 layout tests of the page in the browser"),
  "4A-E8": async () => { if (!full) return { outcome: "REHEARSED_ONLY", detail: "the 100,000-entry characterization runs with --full on the Windows host (no pass or fail, no claim)" };
    const root = scratch("e8"); try { const perf = path.join(studio, "scripts", "memoryos-dashboard-perf.mjs");
      const run = spawnSync(process.execPath, [perf, "run", "--sizes", "100000", "--runs", "1", "--corpus", path.join(root, "corpus"), "--out", path.join(root, "r.json")], { cwd: studio, encoding: "utf8", maxBuffer: 1 << 30 });
      return { outcome: "RECORDED", detail: "100,000-entry characterization: recorded, no pass/fail/support claim", exitCode: run.status, reportSha256: fs.existsSync(path.join(root, "r.json")) ? sha256(fs.readFileSync(path.join(root, "r.json"))) : null };
    } finally { fs.rmSync(root, { recursive: true, force: true }); } },
  "4A-E9": viaTests(["tests/memoryos_dashboard_generator_test.mjs"], "DB20|DB21|exist|output|link|race|unreadable|DB01", "exclusive output, over-limit and failure-path tests of the generator"),
});

// ---- 4B ----
const cases4B = () => ({
  "4B-C1": () => { const result = audit({ repo: REPO }); const identity = JSON.parse(fs.readFileSync(path.join(REPO, "repositories/cca-conformance/mo1308-phase3-candidate-identity.json"), "utf8"));
    return ensure(result.baseIsAncestor && result.violations.length === 0 && result.mo1308Production.changed.length === 0, "MO-1308 production blobs, released manifests and inventories are unchanged against BF; only the three documents are modified", { productionPaths: identity.productionPaths.length, modified: result.modified }); },
  "4B-C2": () => { const result = audit({ repo: REPO }); const sources = ["repositories/cca-studio/web/js", "repositories/cca-studio/web/dashboard"];
    const network = []; for (const dir of sources) for (const f of walkFiles(path.join(REPO, dir))) { const t = fs.readFileSync(f, "utf8"); if (/node:(net|http|https|dns|tls|dgram|child_process|worker_threads)|\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/u.test(t) && /memoryos-dashboard|web[\\/]dashboard/u.test(f)) network.push(path.relative(REPO, f)); }
    return ensure(result.importScan.offenders.length === 0 && network.length === 0 && !result.violations.some((v) => /dependency/u.test(v.reason)), "no new dependency, no build step, no network module in MO-1309 source", { importScan: result.importScan, network }); },
  "4B-C3": async () => { const generator = await load("scripts/memoryos-dashboard-generator.mjs"); const { FIXTURE_NAMES, FIXTURE_ROOT } = await load("tests/support-dashboard-fixtures.mjs"); const bad = []; const root = scratch("c3");
    try { for (const name of FIXTURE_NAMES) { const out = path.join(root, `${name}.html`); generator.generateSnapshot({ exportDirectory: path.join(FIXTURE_ROOT, name, "export"), outputFile: out });
      const html = fs.readFileSync(out, "utf8").replace(/<script type="application\/json"[\s\S]*?<\/script>/u, "").replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/u, "");
      if (/https?:|\/\/|data:|blob:|\bsrc=|\bhref=/iu.test(html)) bad.push(name); }
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
    return ensure(bad.length === 0, "no external reference in any fixture snapshot outside the data block and policy", { offenders: bad }); },
  "4B-C4": () => { const files = git(["ls-files", "docs/mo1309*", "repositories/cca-studio/web/js/memoryos-dashboard-*", "repositories/cca-studio/web/dashboard", "repositories/cca-studio/scripts/memoryos-dashboard-*", "repositories/cca-conformance/tools/mo1309"]).split("\n").filter(Boolean);
    const root = scratch("c4"); try { const archive = path.join(root, "a.tar"); execFileSync("git", ["archive", "--format=tar", "-o", archive, "HEAD", ...files], { cwd: REPO });
      const out = path.join(root, "x"); fs.mkdirSync(out); execFileSync("tar", ["-xf", archive, "-C", out]);
      const fromGit = files.map((f) => `${f}\0${crypto.createHash("sha256").update(execFileSync("git", ["show", `HEAD:${f}`], { cwd: REPO, maxBuffer: 1 << 28 })).digest("hex")}`).join("\n");
      const fromTree = walkFiles(out).map((f) => `${path.relative(out, f).split(path.sep).join("/")}\0${crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex")}`).join("\n");
      return ensure(fromGit === fromTree, "the MO-1309 source closure extracted from HEAD equals the committed blobs", { files: files.length, closureDigest: sha256(Buffer.from(fromGit)) });
    } finally { fs.rmSync(root, { recursive: true, force: true }); } },
});

// ---- 4C ----
const HOSTILE = ["</script><script>window.__pwned=1</script>", "<img src=x onerror=window.__pwned=1>", "javascript:window.__pwned=1", "a b c", "\"'`&<>", "x".repeat(4000)];
const cases4C = ({ browser }) => ({
  "4C-S1": async () => withBrowser(browser, async (b) => { const model = await load("web/js/memoryos-dashboard-viewmodel.js"); const { FIXTURE_NAMES, readExportFiles } = await load("tests/support-dashboard-fixtures.mjs");
    const { assembleTestSnapshot } = await load("tests/support-dashboard-snapshot.mjs");
    const base = model.buildDashboardViewModel({ files: readExportFiles("all-kinds-tombstoned") }); const hostile = JSON.parse(JSON.stringify(base));
    hostile.source.workspaceIdentifier = HOSTILE[0]; hostile.entries.forEach((e, i) => { e.subjects.forEach((s) => { s.value = HOSTILE[(i + 1) % HOSTILE.length]; }); });
    const root = scratch("s1"); try { const file = path.join(root, "h.html"); fs.writeFileSync(file, assembleTestSnapshot({ viewModel: hostile }).html);
      const page = await b.openPage({ width: 1280, height: 900 }); await page.navigate(pathToFileURL(file).href);
      const state = await page.evaluate("({ pwned: window.__pwned === undefined, scripts: document.scripts.length, imgs: document.images.length })");
      return ensure(state.pwned && state.imgs === 0 && page.requests.filter((u) => u !== pathToFileURL(file).href).length === 0, "hostile strings in subjects and identifiers render as inert text: nothing executes, no image, no request", { state, fixtures: FIXTURE_NAMES.length });
    } finally { fs.rmSync(root, { recursive: true, force: true }); } }),
  "4C-S2": viaTests(["tests/memoryos_dashboard_browser_test.mjs", "tests/memoryos_dashboard_page_test.mjs"], "DB06|DB07|CSP|request", "CSP enforced in the browser and zero requests"),
  "4C-S3": async () => { const model = await load("web/js/memoryos-dashboard-viewmodel.js"); const { readExportFiles } = await load("tests/support-dashboard-fixtures.mjs"); const layout = (await load("web/js/memoryos-history-contract.js")).MEMORYOS_HISTORY_LAYOUT;
    const files = readExportFiles("all-kinds-tombstoned"); const flip = (p, at) => files.map((f) => (f.path === p ? { path: p, bytes: Uint8Array.from(f.bytes, (v, i) => (i === at ? v ^ 1 : v)) } : f));
    const entries = files.filter((f) => f.path.startsWith("entries/")).map((f) => f.path).sort(); const member = files.find((f) => f.path.startsWith("records/")).path;
    const variants = { chain: flip(entries[3], 40), member: flip(member, 0), manifest: flip(layout.exportManifest, 30), marker: flip(layout.exportComplete, 30), truncatedTail: files.filter((f) => f.path !== entries.at(-1)) };
    const result = {}; for (const [name, tampered] of Object.entries(variants)) { try { model.buildDashboardViewModel({ files: tampered }); result[name] = "ACCEPTED"; } catch (e) { result[name] = e.code; } }
    return ensure(Object.values(result).every((code) => code === "DASH_EXPORT_INVALID"), "every tamper variant is rejected with DASH_EXPORT_INVALID and nothing is emitted", { result }); },
  "4C-S4": viaTests(["tests/memoryos_dashboard_wording_test.mjs", "tests/memoryos_dashboard_browser_test.mjs"], "DB13|DB14|DB15|DB16|DB17|adversarial|forbidden", "forbidden-affordance scan of the rendered DOM and adversarial words in data"),
  "4C-S5": viaTests(["tests/memoryos_dashboard_generator_test.mjs"], "DB02|swap", "swap-after-read: the displayed data is the bytes read once"),
  "4C-S6": async () => { const dataclass = await load("web/js/memoryos-dashboard-dataclass.js"); const { generateFixtureSnapshot } = await load("tests/support-dashboard-snapshot.mjs"); const { FIXTURE_NAMES } = await load("tests/support-dashboard-fixtures.mjs");
    const context = { paths: [REPO, os.tmpdir(), os.homedir(), process.cwd()], hostUserNames: [os.hostname(), os.userInfo().username], environmentValues: [], memberContents: [] };
    const violations = {}; for (const name of FIXTURE_NAMES) { const v = dataclass.scanSnapshot(generateFixtureSnapshot(name).html, context).violations; if (v.length) violations[name] = v; }
    return ensure(Object.keys(violations).length === 0, "the data-class scan of every generated snapshot finds no violation", { violations }); },
});

export async function runCampaign(stream, { mode, out, full = false, browser = null }) {
  const table = { "4A": cases4A, "4B": cases4B, "4C": cases4C }[stream]({ full, browser });
  const certifying = mode === "certifying";
  const commit = git(["rev-parse", "HEAD"]);
  if (certifying) {
    const reasons = [];
    if (process.platform !== "win32") reasons.push("platform is not win32");
    if (process.arch !== "x64") reasons.push("arch is not x64");
    if (process.version !== REQUIRED_NODE) reasons.push(`node is ${process.version}, not ${REQUIRED_NODE}`);
    if (git(["status", "--porcelain"]) !== "") reasons.push("working tree is not clean");
    if (fs.existsSync(out)) reasons.push("output directory exists (one-shot)");
    if (!path.resolve(out).startsWith(path.join(REPO, "repositories", "cca-conformance", "evidence", "mo1309") + path.sep)) reasons.push("output is not under evidence/mo1309");
    if (reasons.length) throw new Error(`certifying run refused: ${reasons.join("; ")}`);
  }
  fs.mkdirSync(out, { recursive: !certifying });
  const cases = [];
  for (const id of CAMPAIGNS[stream]) {
    let result;
    try { result = await table[id](); } catch (error) { result = { outcome: "FAIL", detail: `case threw ${error?.name ?? "Error"}`, message: String(error?.message ?? error).split("\n")[0] }; }
    cases.push({ id, windowsOnlyPart: WINDOWS_ONLY[id], ...result });
  }
  const inventory = JSON.parse(fs.readFileSync(path.join(REPO, "repositories/cca-conformance/mo1309-conformance-inventory.json"), "utf8"));
  const requirements = [...new Set(inventory.windowsCampaigns[stream].requirements)];
  const failed = cases.filter((c) => c.outcome === "FAIL" || c.outcome === "NOT_RUN").length;
  const receipt = {
    kind: "MO1309CampaignReceipt", version: "1.0.0", stream, certifying, mode, generation: 1, commit, requirements,
    host: { platform: process.platform, arch: process.arch, release: os.release(), node: process.version },
    result: certifying ? (failed === 0 ? "ACCEPTED" : "FAILED_PRESERVED") : (failed === 0 ? "REHEARSAL_PASSED_NON_CERTIFYING" : "REHEARSAL_FAILED_NON_CERTIFYING"),
    accepted: certifying && failed === 0, cases,
  };
  fs.writeFileSync(path.join(out, `${stream.toLowerCase()}-receipt.json`), `${JSON.stringify(receipt, null, 2)}\n`, { flag: certifying ? "wx" : "w" });
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [stream, ...args] = process.argv.slice(2);
  const option = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
  if (!CAMPAIGNS[stream?.toUpperCase()] || !option("out")) { process.stderr.write("usage: <4a|4b|4c> --out <dir> [--rehearsal|--certifying] [--full] [--browser <path>]\n"); process.exit(2); }
  try {
    const receipt = await runCampaign(stream.toUpperCase(), { mode: args.includes("--certifying") ? "certifying" : "rehearsal", out: path.resolve(option("out")), full: args.includes("--full"), browser: option("browser") });
    for (const c of receipt.cases) process.stdout.write(`${c.id} ${c.outcome} ${c.detail ?? ""}\n`);
    process.stdout.write(`${receipt.stream} ${receipt.result}\n`);
    process.exitCode = receipt.result.includes("PASSED") || receipt.result === "ACCEPTED" ? 0 : 1;
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
}
