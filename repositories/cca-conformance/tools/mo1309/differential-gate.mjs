// MO-1309 differential no-regression gate in the style of MO-1308 Amendment A3.2 (Freeze section 32 of the MO-1308 Freeze), as far as the cloud allows.
//   node tools/mo1309/differential-gate.mjs --out <dir> [--base <commit>] [--candidate <rev>] [--jobs <n>]
// A3.2 runs CTest (default preset) at BASELINE and CANDIDATE. CTest needs the MSVC/vcpkg toolchain and `cca_core_tests` (Windows host; see the
// Phase 3 handoff), so the cloud gate runs the Node-driven suites that CTest launches, at the same granularity (one unit per test file), in two
// detached git worktrees with an identical toolchain and environment, and applies the A3.2 verdict rules:
//   1. the workspace verifier passes on CANDIDATE (or fails identically on both and is listed PRE_EXISTING);
//   2. no unit or test that passes on BASELINE fails or is Not Run on CANDIDATE;
//   3. every unit or test present on CANDIDATE but not on BASELINE passes;
//   4. every unit that fails on both is listed PRE_EXISTING with a classification.
// Anything else is FAILED_PRESERVED. Each side's raw log is kept and digested. The gate writes only under --out.
import { execFileSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BASELINE_BF } from "./audit.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const sha = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const git = (args, cwd = REPO) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 1 << 28 }).trim();

// Units: every Node test file CTest launches (conformance, CLI) plus the studio suite as `npm test` runs it. Discovered per worktree.
export function discoverUnits(root) {
  const units = [];
  const list = (relative, pattern) => { const dir = path.join(root, relative); return fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => pattern.test(n)).sort().map((n) => `${relative}/${n}`) : []; };
  for (const file of list("repositories/cca-conformance/tests", /_test\.mjs$/u)) units.push({ id: `conformance:${path.basename(file)}`, cwd: "repositories/cca-conformance", args: ["--test", `tests/${path.basename(file)}`] });
  for (const file of list("repositories/memoryos-cli/tests", /\.test\.mjs$/u)) units.push({ id: `cli:${path.basename(file)}`, cwd: "repositories/memoryos-cli", args: ["--test", `tests/${path.basename(file)}`] });
  const studio = JSON.parse(fs.readFileSync(path.join(root, "repositories/cca-studio/package.json"), "utf8")).scripts.test.replace(/^node --test /u, "").split(/\s+/u);
  for (const file of studio) units.push({ id: `studio:${path.basename(file)}`, cwd: "repositories/cca-studio", args: ["--test", file] });
  return units;
}

// TAP: "ok N - name" / "not ok N - name" at any indentation; nested names are joined by " > ".
export function parseTap(text) {
  const tests = new Map(); const stack = [];
  for (const line of text.split("\n")) {
    const match = /^(\s*)(not ok|ok) \d+ - (.*?)(?: # (SKIP|TODO).*)?$/u.exec(line);
    if (!match) { const sub = /^(\s*)# Subtest: (.*)$/u.exec(line); if (sub) { stack.length = sub[1].length / 4; stack[sub[1].length / 4] = sub[2]; } continue; }
    const depth = match[1].length / 4; stack.length = depth; stack[depth] = match[3];
    tests.set(stack.join(" > "), match[4] === "SKIP" || match[4] === "TODO" ? "skipped" : match[2] === "ok" ? "pass" : "fail");
  }
  return tests;
}

function runUnit(root, unit, logDir, side) {
  return new Promise((resolve) => {
    const chunks = [];
    const child = spawn(process.execPath, unit.args, { cwd: path.join(root, unit.cwd), env: { ...process.env, NO_COLOR: "1", CI: "" }, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => child.kill("SIGKILL"), 900000);
    child.stdout.on("data", (c) => chunks.push(c)); child.stderr.on("data", (c) => chunks.push(c));
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const log = Buffer.concat(chunks); const name = `${side}-${unit.id.replace(/[^A-Za-z0-9_.-]/gu, "_")}.log`;
      fs.writeFileSync(path.join(logDir, name), log);
      resolve({ id: unit.id, exitCode: code ?? -1, signal, log: `logs/${name}`, logSha256: sha(log), tests: parseTap(log.toString("utf8")) });
    });
  });
}

async function runSide(root, units, logDir, side, jobs) {
  const results = []; let next = 0;
  await Promise.all(Array.from({ length: jobs }, async () => { while (next < units.length) { const unit = units[next]; next += 1; results.push(await runUnit(root, unit, logDir, side)); process.stderr.write(`${side} ${unit.id} exit ${results.at(-1).exitCode}\n`); } }));
  return new Map(results.map((r) => [r.id, r]));
}

// Classification of a unit that fails on both sides, from its own log. Recorded, not judged: a shared failure is PRE_EXISTING either way.
export function classify(logText) {
  if (/Cannot find (package|module)|ERR_MODULE_NOT_FOUND|esbuild|yauzl|zod/u.test(logText)) return "environment (Node dependencies are not installed in a fresh worktree)";
  if (/ENOENT|EACCES|Standard|cca-specifications|memoryos-1\.[0-9]-mo|tag|lineage|ancestor|bdf8fd4/u.test(logText)) return "environment (tag, lineage or Standard-clone dependent)";
  return "undetermined";
}

export function verdictOf({ base, candidate, workspace }) {
  const rules = { r1: true, r2: [], r3: [], r4: [] };
  if (workspace.candidateExit !== 0 && workspace.baseExit === 0) rules.r1 = false;
  for (const [id, b] of base) {
    const c = candidate.get(id);
    if (b.exitCode === 0 && (!c || c.exitCode !== 0)) rules.r2.push({ unit: id, candidate: c ? `exit ${c.exitCode}` : "not run" });
    for (const [name, status] of b.tests) if (status === "pass" && c && c.tests.get(name) !== "pass" && c.tests.has(name) === false && c.exitCode !== 0) rules.r2.push({ unit: id, test: name, candidate: "missing or failing" });
    for (const [name, status] of b.tests) if (status === "pass" && c && c.tests.get(name) === "fail") rules.r2.push({ unit: id, test: name, candidate: "fail" });
  }
  for (const [id, c] of candidate) {
    const b = base.get(id);
    if (!b && c.exitCode !== 0) rules.r3.push({ unit: id, candidate: `exit ${c.exitCode}` });
    if (b) for (const [name, status] of c.tests) if (!b.tests.has(name) && status === "fail") rules.r3.push({ unit: id, test: name });
    if (b && b.exitCode !== 0 && c.exitCode !== 0) rules.r4.push({ unit: id, classification: classify(fs.existsSync(c.__logPath ?? "") ? fs.readFileSync(c.__logPath, "utf8") : "") });
  }
  const ok = rules.r1 && rules.r2.length === 0 && rules.r3.length === 0;
  return { verdict: ok ? "PASS" : "FAILED_PRESERVED", rules };
}

export async function runGate({ out, base = BASELINE_BF, candidate = "HEAD", jobs = 2 }) {
  const baseCommit = git(["rev-parse", "--verify", `${base}^{commit}`]); const candidateCommit = git(["rev-parse", "--verify", `${candidate}^{commit}`]);
  fs.mkdirSync(path.join(out, "logs"), { recursive: true });
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mo1309-gate-"));
  const trees = { base: path.join(scratch, "base"), candidate: path.join(scratch, "candidate") };
  try {
    git(["worktree", "add", "--detach", trees.base, baseCommit]); git(["worktree", "add", "--detach", trees.candidate, candidateCommit]);
    const unitsBase = discoverUnits(trees.base); const unitsCandidate = discoverUnits(trees.candidate);
    const python = (root) => { const r = execFileSync("sh", ["-c", `cd ${JSON.stringify(root)} && (python3 tools/verify_workspace.py >/dev/null 2>&1; echo $?)`], { encoding: "utf8" }).trim(); return Number(r); };
    const workspace = { baseExit: python(trees.base), candidateExit: python(trees.candidate) };
    const base = await runSide(trees.base, unitsBase, path.join(out, "logs"), "base", jobs);
    const candidateResults = await runSide(trees.candidate, unitsCandidate, path.join(out, "logs"), "candidate", jobs);
    for (const [id, r] of candidateResults) r.__logPath = path.join(out, r.log);
    const { verdict, rules } = verdictOf({ base, candidate: candidateResults, workspace });
    const table = [...new Set([...base.keys(), ...candidateResults.keys()])].sort().map((id) => ({ unit: id, base: base.get(id) ? (base.get(id).exitCode === 0 ? "pass" : `fail (exit ${base.get(id).exitCode})`) : "absent",
      candidate: candidateResults.get(id) ? (candidateResults.get(id).exitCode === 0 ? "pass" : `fail (exit ${candidateResults.get(id).exitCode})`) : "absent",
      baseTests: base.get(id) ? base.get(id).tests.size : 0, candidateTests: candidateResults.get(id) ? candidateResults.get(id).tests.size : 0,
      baseLog: base.get(id)?.logSha256 ?? null, candidateLog: candidateResults.get(id)?.logSha256 ?? null }));
    const preExisting = rules.r4.map((entry) => ({ ...entry, status: "PRE_EXISTING" }));
    const receipt = { kind: "MO1309DifferentialGateReceipt", version: "1.0.0", style: "MO-1308 Amendment A3.2, Node-driven units only", certifying: false,
      baseline: baseCommit, candidate: candidateCommit, host: { platform: process.platform, arch: process.arch, node: process.version }, workspaceVerify: workspace,
      verdict, rules: { workspaceVerifyOk: rules.r1, regressions: rules.r2, newFailures: rules.r3 }, preExisting,
      counts: { baseUnits: base.size, candidateUnits: candidateResults.size, newUnits: [...candidateResults.keys()].filter((id) => !base.has(id)).length },
      notRunInCloud: ["CTest default preset (MSVC, vcpkg, GoogleTest)", "cca_core_tests and the 112 *AllocationFailureTest cases", "memoryos.sdk.cpp.*", "memoryos.standard.runtime.reference", "Windows-only CLI store tests"] };
    fs.writeFileSync(path.join(out, "comparison.json"), `${JSON.stringify(table, null, 2)}\n`);
    fs.writeFileSync(path.join(out, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
    return receipt;
  } finally {
    for (const tree of Object.values(trees)) { try { git(["worktree", "remove", "--force", tree]); } catch { /* already gone */ } }
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
  if (!option("out")) { process.stderr.write("usage: --out <dir> [--base <commit>] [--candidate <rev>] [--jobs <n>]\n"); process.exit(2); }
  const receipt = await runGate({ out: path.resolve(option("out")), base: option("base", BASELINE_BF), candidate: option("candidate", "HEAD"), jobs: Number(option("jobs", "2")) });
  process.stdout.write(`${JSON.stringify({ verdict: receipt.verdict, counts: receipt.counts, regressions: receipt.rules.regressions.length, newFailures: receipt.rules.newFailures.length, preExisting: receipt.preExisting.length })}\n`);
  process.exitCode = receipt.verdict === "PASS" ? 0 : 1;
}
