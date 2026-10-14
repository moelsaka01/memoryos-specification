// MemoryOS 1.3.1 ONE combined one-shot certification campaign "SH" (Freeze mo1310 section 15), authored in the cloud and rehearsed there
// as NON-CERTIFYING. A certifying run exists only on the Windows reference host: it requires Windows 11 x64, Node v24.21.0 exactly, a clean
// checkout and a NEW output directory under repositories/cca-conformance/evidence/mo1310/campaign/, and it is made once per generation.
//   node tools/mo1310/campaign.mjs --out <dir> [--rehearsal | --certifying] [--browser <path>]
// A rehearsal writes the same receipt with certifying:false. Case families: end to end (SH-E1..E7), security and wording (SH-S1..S5), closure (SH-C1..C5).
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO, sha256, tapCounts } from "../mo1309/run-tests.mjs";
import { allKinds, cliExport } from "./support.mjs";

const studio = path.join(REPO, "repositories", "cca-studio");
const load = (relative) => import(pathToFileURL(path.join(studio, relative)).href);
export const REQUIRED_NODE = "v24.21.0";
export const BASELINE = "889f99e72a5d41c242572cc052ab97b07cc10a24";
export const EVIDENCE_ROOT = path.join(REPO, "repositories", "cca-conformance", "evidence", "mo1310", "campaign");
export const CASES = Object.freeze(["SH-E1", "SH-E2", "SH-E3", "SH-E4", "SH-E5", "SH-E6", "SH-E7", "SH-S1", "SH-S2", "SH-S3", "SH-S4", "SH-S5", "SH-C1", "SH-C2", "SH-C3", "SH-C4", "SH-C5"]);
// What only the Windows host can establish for each case.
export const WINDOWS_ONLY = Object.freeze({
  "SH-E1": "home and History in Edge on Windows 11 x64", "SH-E2": "a CLI export made on NTFS with Node 24.21.0, opened through the directory input in Edge",
  "SH-E3": "the directory-handle code path in Edge", "SH-E4": "tampered NTFS exports in Edge", "SH-E5": "empty and single-entry NTFS exports in Edge",
  "SH-E6": "the download written by Edge equals the generator's file", "SH-E7": "keyboard and 320/768/1280 layouts in Edge",
  "SH-S1": "request set, CSP and forbidden APIs in Edge", "SH-S2": "wording scan of the Edge-rendered DOM", "SH-S3": "injection corpus in Edge", "SH-S4": "read-once probe in Edge", "SH-S5": "no storage or kept handle in Edge",
  "SH-C1": "no C/C++ change proof on the Windows checkout", "SH-C2": "no dependency change on the Windows checkout", "SH-C3": "generator differential against v1.3.0 under Windows line endings",
  "SH-C4": "derived page and v1.3.0 blobs under the Windows checkout", "SH-C5": "source closure reproducible from a fresh Windows checkout",
});

const git = (args) => execFileSync("git", args, { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28 }).trim();
const scratch = (label) => fs.mkdtempSync(path.join(os.tmpdir(), `sh-${label}-`));
const pass = (detail, extra = {}) => ({ outcome: "PASS", detail, ...extra });
const fail = (detail, extra = {}) => ({ outcome: "FAIL", detail, ...extra });
const ensure = (condition, detail, extra) => (condition ? pass(detail, extra) : fail(detail, extra));
const walkFiles = (root) => fs.readdirSync(root, { withFileTypes: true, recursive: true }).filter((e) => e.isFile()).map((e) => path.join(e.parentPath ?? e.path, e.name)).sort();

function nodeTest(files, pattern) {
  const args = ["--test", ...(pattern ? [`--test-name-pattern=${pattern}`] : []), ...files];
  const result = spawnSync(process.execPath, args, { cwd: studio, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const { tests, pass: passed, fail: failed } = tapCounts(result.stdout);
  return { exitCode: result.status, tests, pass: passed, fail: failed, logSha256: sha256(Buffer.from(result.stdout + result.stderr)) };
}
const viaTests = (files, pattern, detail) => () => { const r = nodeTest(files, pattern); return r.exitCode === 0 && r.fail === 0 && r.pass > 0 ? pass(detail, r) : fail(detail, r); };

// A Studio server and a browser for the cases that drive a real export through the screen; closed afterwards.
async function withStudio(browserPath, body) {
  if (browserPath) process.env.MO1309_BROWSER = browserPath;
  const devtools = await load("tests/support-devtools.mjs");
  if (devtools.findBrowser() === null) return { outcome: "NOT_RUN", detail: "no Chromium-family browser found (set MO1309_BROWSER)" };
  const support = await load("tests/support-studio-history-browser.mjs");
  const server = await support.startStudio();
  const browser = await devtools.launchBrowser();
  try { return await body({ browser, origin: server.origin, support }); } finally { await browser.close(); server.close(); }
}
const standaloneText = async (browser, exportDirectory, root) => {
  const generator = await load("scripts/memoryos-dashboard-generator.mjs");
  const output = path.join(root, `standalone-${crypto.randomBytes(4).toString("hex")}.html`);
  generator.generateSnapshot({ exportDirectory, outputFile: output });
  const page = await browser.openPage({ width: 1280, height: 900 });
  try { await page.navigate(pathToFileURL(output).href); return { text: await page.evaluate("document.getElementById('app').innerText"), output }; } finally { await page.close(); }
};
const modelOf = async (exportDirectory) => {
  const generator = await load("scripts/memoryos-dashboard-generator.mjs");
  const model = await load("web/js/memoryos-dashboard-viewmodel.js");
  return model.buildDashboardViewModel(generator.readExportDirectory(exportDirectory));
};

const cases = ({ browser: browserPath }) => ({
  "SH-E1": viaTests(["tests/studio_history_browser_test.mjs"], "SH01|SH17", "home keeps Mission Control and gains History, which opens and leaves; Clear, a new selection and leaving the route drop the export"),
  "SH-E2": () => withStudio(browserPath, async ({ browser, origin, support }) => { const root = scratch("e2"); try {
    const exportDir = await cliExport(root, { workspace: "workspace-investigation", records: allKinds, tombstones: [{ target: 0, reason: "PRIVACY_REQUEST", authority: "PRIV-SH-0001" }] });
    const model = await modelOf(exportDir); const standalone = await standaloneText(browser, exportDir, root);
    const page = await support.openHistory(browser, origin, { width: 1280, height: 900 });
    try { await support.openExport(page, exportDir); const text = await support.frameText(page);
      return ensure(text === standalone.text && text.includes(model.source.headDigest) && model.verification.tombstones === 1 && model.verification.purgedRecords === 1 && model.entries[0].retention === "PURGED" && support.noProblems(page).length === 0,
        "a real CLI export (every record kind, a tombstone and a purge) opened through the directory input shows the dashboard, equal to the standalone page, with the full head digest", { entries: model.source.entryCount, headDigest: model.source.headDigest });
    } finally { await page.close(); }
  } finally { fs.rmSync(root, { recursive: true, force: true }); } }),
  "SH-E3": viaTests(["tests/studio_history_browser_test.mjs"], "SH16|SH14", "both input routes render the same dashboard; cancelled, denied and missing pickers change nothing"),
  "SH-E4": () => withStudio(browserPath, async ({ browser, origin, support }) => { const root = scratch("e4"); try {
    const exportDir = await cliExport(root, { workspace: "workspace-investigation", records: allKinds, tombstones: [{ target: 0, reason: "PRIVACY_REQUEST", authority: "PRIV-SH-0002" }] });
    const { listExport, tamperVariants } = await load("tests/support-studio-history.mjs"); const variants = tamperVariants(listExport(exportDir)); const result = {};
    const page = await support.openHistory(browser, origin, { width: 1280, height: 900 });
    try { for (const [name, files] of Object.entries(variants)) {
        await page.evaluate("document.querySelector('[data-action=\"clear\"]').click()");
        await support.openExport(page, support.writeFiles(path.join(root, `t-${name}`), files), false);
        const state = await support.errorState(page); result[name] = { code: state.dd[0], historyCode: state.dd[1] ?? null, frame: state.frame, saveDisabled: state.save }; }
      const ok = Object.values(result).every((r) => r.code === "DASH_EXPORT_INVALID" && /^MO1308_[A-Z_]+$/u.test(r.historyCode) && r.frame === false && r.saveDisabled === true);
      return ensure(ok && Object.keys(result).length === 5, "chain, member, manifest, marker and truncated-tail variants of a real CLI export are rejected inside Studio with the carried MO-1308 code and nothing rendered", { result });
    } finally { await page.close(); }
  } finally { fs.rmSync(root, { recursive: true, force: true }); } }),
  "SH-E5": () => withStudio(browserPath, async ({ browser, origin, support }) => { const results = []; for (const [name, records] of [["empty", () => []], ["single", (c) => [c.policyRecord(1)]]]) { const root = scratch("e5"); try {
    const exportDir = await cliExport(root, { workspace: `workspace-${name}`, records }); const standalone = await standaloneText(browser, exportDir, root);
    const page = await support.openHistory(browser, origin, { width: 1280, height: 900 });
    try { await support.openExport(page, exportDir); results.push([name, (await support.frameText(page)) === standalone.text]); } finally { await page.close(); }
  } finally { fs.rmSync(root, { recursive: true, force: true }); } }
    return ensure(results.length === 2 && results.every(([, same]) => same), "empty and single-entry CLI exports open and equal the standalone page", { results }); }),
  "SH-E6": () => withStudio(browserPath, async ({ browser, origin, support }) => { const root = scratch("e6"); try {
    const exportDir = await cliExport(root, { workspace: "workspace-investigation", records: allKinds });
    const generator = await load("scripts/memoryos-dashboard-generator.mjs"); const expected = path.join(root, "expected.html"); generator.generateSnapshot({ exportDirectory: exportDir, outputFile: expected });
    const downloads = path.join(root, "downloads"); fs.mkdirSync(downloads);
    const page = await support.openHistory(browser, origin, { width: 1280, height: 900 });
    try { await page.call("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloads }); await support.openExport(page, exportDir);
      await page.evaluate("document.querySelector('[data-action=\"save-snapshot\"]').click()");
      const file = path.join(downloads, "memoryos-history-dashboard.html"); const deadline = Date.now() + 30000;
      while (!fs.existsSync(file) && Date.now() < deadline) await support.sleep(100);
      await support.sleep(300);
      const same = fs.existsSync(file) && Buffer.compare(fs.readFileSync(file), fs.readFileSync(expected)) === 0;
      return ensure(same, "Save dashboard snapshot downloads exactly the bytes the standalone generator writes", { snapshotSha256: fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null });
    } finally { await page.close(); }
  } finally { fs.rmSync(root, { recursive: true, force: true }); } }),
  "SH-E7": viaTests(["tests/studio_history_browser_test.mjs"], "SH18", "keyboard, names and 320/768/1280 layouts of the History screen"),
  "SH-S1": viaTests(["tests/studio_history_browser_test.mjs", "tests/studio_history_unit_test.mjs"], "SH11", "request allow-list, policies in the browser and the forbidden-API source scan"),
  "SH-S2": viaTests(["tests/studio_history_browser_test.mjs", "tests/studio_history_unit_test.mjs"], "SH12", "registry scan of the rendered screen and dashboard, closed action set, adversarial words as data"),
  "SH-S3": viaTests(["tests/studio_history_browser_test.mjs"], "SH13", "hostile strings and folder names are inert"),
  "SH-S4": viaTests(["tests/studio_history_browser_test.mjs", "tests/studio_history_unit_test.mjs"], "SH06", "read once; later changes to the source cannot reach the displayed data"),
  "SH-S5": viaTests(["tests/studio_history_browser_test.mjs", "tests/studio_history_unit_test.mjs"], "SH10", "no storage, no link or form, no kept handle; closed read-only actions"),
  "SH-C1": async () => { const { isNativePath } = await load("tests/support-studio-history.mjs"); const closure = nodeTest(["tests/studio_history_closure_test.mjs"], "SH19|SH20");
    const changed = git(["diff", "--name-only", BASELINE, "HEAD"]).split("\n").filter(Boolean); const native = changed.filter(isNativePath);
    return ensure(closure.exitCode === 0 && closure.fail === 0 && native.length === 0, "no C/C++/CMake/vcpkg path differs from v1.3.0 (the proof that the C++ CTest run may be skipped) and no MO-1308 production blob changed",
      { ...closure, nativeChangeProof: { baseline: BASELINE, head: git(["rev-parse", "HEAD"]), changedPaths: changed.length, nativePaths: native } }); },
  "SH-C2": viaTests(["tests/studio_history_closure_test.mjs"], "SH21", "no dependency, lock file, build step or released-file change outside the documented list"),
  "SH-C3": viaTests(["tests/studio_history_differential_test.mjs"], null, "the generator's output is byte-identical to v1.3.0 on every fixture and corpus (golden and live differential)"),
  "SH-C4": viaTests(["tests/studio_history_unit_test.mjs"], "SH08|SH22", "page.embedded.js is current, the MO-1309 page and modules equal their v1.3.0 blobs, and ARCHITECTURE carries only the two clauses"),
  "SH-C5": () => { const files = git(["diff", "--name-only", "--diff-filter=AM", BASELINE, "HEAD"]).split("\n").filter(Boolean); const root = scratch("c5"); try {
    const archive = path.join(root, "a.tar"); execFileSync("git", ["archive", "--format=tar", "-o", archive, "HEAD", ...files], { cwd: REPO }); const out = path.join(root, "x"); fs.mkdirSync(out); execFileSync("tar", ["-xf", archive, "-C", out]);
    const digest = (b) => crypto.createHash("sha256").update(b).digest("hex");
    const fromGit = files.map((f) => `${f}\0${digest(execFileSync("git", ["show", `HEAD:${f}`], { cwd: REPO, maxBuffer: 1 << 28 }))}`).join("\n");
    const fromTree = walkFiles(out).map((f) => `${path.relative(out, f).split(path.sep).join("/")}\0${digest(fs.readFileSync(f))}`).sort().join("\n");
    return ensure(fromGit.split("\n").sort().join("\n") === fromTree, "the MemoryOS 1.3.1 source closure extracted from HEAD equals the committed blobs", { files: files.length, closureDigest: sha256(Buffer.from(fromTree)) });
  } finally { fs.rmSync(root, { recursive: true, force: true }); } },
});

export async function runCampaign({ mode, out, browser = null }) {
  const table = cases({ browser });
  const certifying = mode === "certifying";
  const commit = git(["rev-parse", "HEAD"]);
  if (certifying) {
    const reasons = [];
    if (process.platform !== "win32") reasons.push("platform is not win32");
    if (process.arch !== "x64") reasons.push("arch is not x64");
    if (process.version !== REQUIRED_NODE) reasons.push(`node is ${process.version}, not ${REQUIRED_NODE}`);
    if (git(["status", "--porcelain"]) !== "") reasons.push("working tree is not clean");
    if (fs.existsSync(out)) reasons.push("output directory exists (one-shot)");
    if (!path.resolve(out).startsWith(EVIDENCE_ROOT + path.sep)) reasons.push("output is not under evidence/mo1310/campaign");
    if (reasons.length) throw new Error(`certifying run refused: ${reasons.join("; ")}`);
  }
  fs.mkdirSync(out, { recursive: !certifying });
  const results = [];
  for (const id of CASES) {
    let result;
    try { result = await table[id](); } catch (error) { result = { outcome: "FAIL", detail: `case threw ${error?.name ?? "Error"}`, message: String(error?.message ?? error).split("\n")[0] }; }
    results.push({ id, windowsOnlyPart: WINDOWS_ONLY[id], ...result });
  }
  const failed = results.filter((c) => c.outcome === "FAIL" || c.outcome === "NOT_RUN").length;
  const generation = Number(/^gen-(\d+)$/u.exec(path.basename(out))?.[1] ?? 1);
  const receipt = {
    kind: "MO1310CampaignReceipt", version: "1.0.0", campaign: "SH", certifying, mode, generation, commit, baseline: BASELINE,
    host: { platform: process.platform, arch: process.arch, release: os.release(), node: process.version },
    result: certifying ? (failed === 0 ? "ACCEPTED" : "FAILED_PRESERVED") : (failed === 0 ? "REHEARSAL_PASSED_NON_CERTIFYING" : "REHEARSAL_FAILED_NON_CERTIFYING"),
    accepted: certifying && failed === 0, cases: results,
  };
  fs.writeFileSync(path.join(out, "mo1310-campaign-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: certifying ? "wx" : "w" });
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
  if (!option("out") || (args.includes("--certifying") && args.includes("--rehearsal"))) { process.stderr.write("usage: --out <dir> [--rehearsal|--certifying] [--browser <path>]\n"); process.exit(2); }
  try {
    const receipt = await runCampaign({ mode: args.includes("--certifying") ? "certifying" : "rehearsal", out: path.resolve(option("out")), browser: option("browser") });
    for (const c of receipt.cases) process.stdout.write(`${c.id} ${c.outcome} ${c.detail ?? ""}\n`);
    process.stdout.write(`SH ${receipt.result}\n`);
    process.exitCode = receipt.result.includes("PASSED") || receipt.result === "ACCEPTED" ? 0 : 1;
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
}
