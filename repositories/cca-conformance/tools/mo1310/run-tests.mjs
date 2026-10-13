// MemoryOS 1.3.1 manifest runner: runs each suite of mo1310-test-manifest.json as its own process, keeps its raw log and writes one
// retained-regression row per run (Freeze SH23). It reuses the MO-1309 suite runner (rows, logs, digests); a rerun of a suite is a new row.
//   node tools/mo1310/run-tests.mjs --out <dir> [--suite <id>]... [--run-label <text>]      (none = every suite, in manifest order)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REPO, runSuite } from "../mo1309/run-tests.mjs";
import { matchKnownFailures } from "./known-failures.mjs";

export const MANIFEST = path.join(REPO, "repositories", "cca-conformance", "mo1310-test-manifest.json");

export function readManifest(file = MANIFEST) {
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  if (manifest.kind !== "MO1310TestManifest" || !Array.isArray(manifest.suites)) throw new Error("not an MO-1310 test manifest");
  const ids = new Set();
  for (const suite of manifest.suites) {
    const shapes = [Array.isArray(suite.files), Array.isArray(suite.command), Array.isArray(suite.nodeArgs)].filter(Boolean).length;
    if (typeof suite.id !== "string" || ids.has(suite.id) || typeof suite.cwd !== "string" || shapes !== 1) throw new Error(`bad suite ${suite.id}`);
    ids.add(suite.id);
  }
  return manifest;
}

// The suite as the MO-1309 runner takes it: a `nodeArgs` suite runs under this process's own Node, never a PATH lookup.
export const runnable = (suite) => (suite.nodeArgs ? { id: suite.id, cwd: suite.cwd, command: [process.execPath, ...suite.nodeArgs] } : suite);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const values = (name) => args.flatMap((arg, i) => (arg === `--${name}` ? [args[i + 1]] : []));
  if (!values("out")[0]) { process.stderr.write("usage: --out <dir> [--suite <id>]... [--run-label <text>]\n"); process.exit(2); }
  const outDir = path.resolve(values("out")[0]);
  const wanted = values("suite");
  const manifest = readManifest();
  for (const id of wanted) if (!manifest.suites.some((suite) => suite.id === id)) { process.stderr.write(`unknown suite ${id}\n`); process.exit(2); }
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
  if (execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: REPO, encoding: "utf8" }).trim() !== "") process.stderr.write("warning: the working tree has uncommitted changes; the row commit is HEAD\n");
  let failed = false;
  for (const suite of manifest.suites.filter((s) => wanted.length === 0 || wanted.includes(s.id))) {
    const row = runSuite({ suite: runnable(suite), outDir, commit, label: values("run-label")[0] ?? "" });
    const strict = suite.expect ? (row.tests === suite.expect.tests && row.pass === suite.expect.pass && row.fail === suite.expect.fail) : true;
    const pinned = suite.expectedFailingTests ? matchKnownFailures({ row, logText: fs.readFileSync(path.join(outDir, row.log), "utf8"), names: suite.expectedFailingTests.names }).ok : suite.expectedFailing ? (row.tests === suite.expectedFailing.tests && row.pass === suite.expectedFailing.pass && row.fail === suite.expectedFailing.fail && row.exitCode !== 0) : null;
    process.stdout.write(`${row.suite} run ${row.run}: exit ${row.exitCode}, tests ${row.tests}, pass ${row.pass}, fail ${row.fail}${suite.expect ? (strict ? " (strict count met)" : " (STRICT COUNT NOT MET)") : ""}${pinned === null ? "" : pinned ? " (pinned baseline failures, identical to v1.3.0)" : " (PINNED BASELINE FAILURES NOT MET)"}\n`);
    if (pinned === null ? (row.exitCode !== 0 || !strict) : !pinned) failed = true;
  }
  process.exitCode = failed ? 1 : 0;
}
