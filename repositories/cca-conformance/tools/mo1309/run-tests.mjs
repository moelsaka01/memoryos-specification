// MO-1309 manifest runner: runs each suite of mo1309-test-manifest.json as its own process, keeps its raw log, and writes one
// retained-regression row per run (Freeze DB30). It reads the clock only to stamp rows; nothing it prints enters a product file.
//   node tools/mo1309/run-tests.mjs --out <dir> [--suite <id>]... [--run-label <text>]   (repeat --suite to run several; none = all)
// Rows are appended to <dir>/rows.json; every run, including a rerun of the same suite, is a new row bound to its own log file.
import { spawnSync, execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(here, "..", "..", "..", "..");
export const MANIFEST = path.join(REPO, "repositories", "cca-conformance", "mo1309-test-manifest.json");
export const sha256 = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;

export function readManifest(file = MANIFEST) {
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  if (manifest.kind !== "MO1309TestManifest" || !Array.isArray(manifest.suites)) throw new Error("not an MO-1309 test manifest");
  const ids = new Set();
  for (const suite of manifest.suites) {
    if (typeof suite.id !== "string" || ids.has(suite.id) || typeof suite.cwd !== "string" || (!Array.isArray(suite.files) && !Array.isArray(suite.command))) throw new Error(`bad suite ${suite.id}`);
    ids.add(suite.id);
  }
  return manifest;
}

export const commandOf = (suite) => (suite.command ? suite.command : [process.execPath, "--test", ...suite.files]);

// TAP summary lines of node --test: "# tests N", "# pass N", "# fail N".
export function tapCounts(text) {
  const read = (name) => Number(new RegExp(`^# ${name} (\\d+)$`, "mu").exec(text)?.[1] ?? Number.NaN);
  return { tests: read("tests"), pass: read("pass"), fail: read("fail"), skipped: read("skipped"), cancelled: read("cancelled") };
}

export function runSuite({ suite, outDir, commit, label = "" }) {
  const command = commandOf(suite);
  const started = new Date();
  const result = spawnSync(command[0], command.slice(1), { cwd: path.join(REPO, suite.cwd), encoding: "buffer", maxBuffer: 512 * 1024 * 1024, env: process.env });
  const finished = new Date();
  const log = Buffer.concat([result.stdout ?? Buffer.alloc(0), Buffer.from("\n--- stderr ---\n"), result.stderr ?? Buffer.alloc(0)]);
  fs.mkdirSync(path.join(outDir, "logs"), { recursive: true });
  const rowsFile = path.join(outDir, "rows.json");
  const rows = fs.existsSync(rowsFile) ? JSON.parse(fs.readFileSync(rowsFile, "utf8")) : [];
  const runIndex = rows.filter((row) => row.suite === suite.id).length + 1;
  const logName = `logs/${String(rows.length + 1).padStart(3, "0")}-${suite.id}-run${runIndex}.log`;
  fs.writeFileSync(path.join(outDir, logName), log, { flag: "wx" });
  const counts = tapCounts(log.toString("utf8"));
  const row = {
    row: rows.length + 1, suite: suite.id, run: runIndex, label, commit, cwd: suite.cwd, command: command.map((part, i) => (i === 0 && part === process.execPath ? "node" : part)),
    exitCode: result.status, ...counts, startedUtc: started.toISOString(), finishedUtc: finished.toISOString(), log: logName, logSha256: sha256(log),
  };
  rows.push(row);
  fs.writeFileSync(rowsFile, `${JSON.stringify(rows, null, 2)}\n`);
  return row;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const values = (name) => args.flatMap((arg, i) => (arg === `--${name}` ? [args[i + 1]] : []));
  const outDir = path.resolve(values("out")[0] ?? "");
  if (!values("out")[0]) { process.stderr.write("usage: --out <dir> [--suite <id>]... [--run-label <text>]\n"); process.exit(2); }
  const manifest = readManifest();
  const wanted = values("suite");
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
  if (execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: REPO, encoding: "utf8" }).trim() !== "") process.stderr.write("warning: the working tree has uncommitted changes; the row commit is HEAD\n");
  let failed = false;
  for (const suite of manifest.suites.filter((s) => wanted.length === 0 || wanted.includes(s.id))) {
    const row = runSuite({ suite, outDir, commit, label: values("run-label")[0] ?? "" });
    process.stdout.write(`${row.suite} run ${row.run}: exit ${row.exitCode}, tests ${row.tests}, pass ${row.pass}, fail ${row.fail}\n`);
    if (row.exitCode !== 0) failed = true;
  }
  process.exitCode = failed ? 1 : 0;
}
