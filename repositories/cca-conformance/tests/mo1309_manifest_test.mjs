// MO-1309 Phase 3: the MO-1309 test manifest and runner (DB27 wiring, DB30 row-per-run record).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { REPO, readManifest, runSuite, tapCounts } from "../tools/mo1309/run-tests.mjs";

const listed = (manifest) => new Set(manifest.suites.flatMap((suite) => (suite.files ?? []).map((file) => `${suite.cwd}/${file}`)));
const onDisk = () => [
  ...fs.readdirSync(path.join(REPO, "repositories/cca-studio/tests")).filter((n) => /^memoryos_dashboard_.*_test\.mjs$/u.test(n)).map((n) => `repositories/cca-studio/tests/${n}`),
  ...fs.readdirSync(path.join(REPO, "repositories/cca-conformance/tests")).filter((n) => /^mo1309_.*_test\.mjs$/u.test(n)).map((n) => `repositories/cca-conformance/tests/${n}`),
];
const missingFrom = (manifest, files) => files.filter((file) => !listed(manifest).has(file));

test("DB27 the manifest lists every MO-1309 test file, and each listed file exists", () => {
  const manifest = readManifest();
  assert.deepEqual(missingFrom(manifest, onDisk()), []);
  for (const file of listed(manifest)) assert.ok(fs.existsSync(path.join(REPO, file)), file);
});

test("DB27 negative control: a manifest missing a test file is detected, and a malformed manifest is refused", () => {
  const manifest = readManifest();
  const trimmed = { ...manifest, suites: manifest.suites.map((suite) => ({ ...suite, files: suite.files?.filter((f) => !f.endsWith("memoryos_dashboard_trust_test.mjs")) })) };
  assert.deepEqual(missingFrom(trimmed, onDisk()), ["repositories/cca-studio/tests/memoryos_dashboard_trust_test.mjs"]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mo1309-manifest-"));
  try {
    const bad = path.join(dir, "m.json");
    fs.writeFileSync(bad, JSON.stringify({ kind: "Other", suites: [] })); assert.throws(() => readManifest(bad));
    fs.writeFileSync(bad, JSON.stringify({ kind: "MO1309TestManifest", suites: [{ id: "a", cwd: "x", files: [] }, { id: "a", cwd: "x", files: [] }] })); assert.throws(() => readManifest(bad), /bad suite/u);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("DB30 a rerun is its own row with its own numbered log, and the row digest binds the log bytes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mo1309-rows-"));
  try {
    const suite = { id: "tiny", cwd: "repositories/cca-conformance", command: [process.execPath, "-e", "console.log('# tests 3\\n# pass 3\\n# fail 0')"] };
    const first = runSuite({ suite, outDir: dir, commit: "a".repeat(40) });
    const second = runSuite({ suite, outDir: dir, commit: "b".repeat(40), label: "rerun" });
    const rows = JSON.parse(fs.readFileSync(path.join(dir, "rows.json"), "utf8"));
    assert.deepEqual(rows.map((row) => [row.row, row.suite, row.run]), [[1, "tiny", 1], [2, "tiny", 2]]);
    assert.notEqual(first.log, second.log);
    assert.equal(first.commit, "a".repeat(40)); assert.equal(second.commit, "b".repeat(40), "each row carries its own commit");
    assert.deepEqual([first.tests, first.pass, first.fail, first.exitCode], [3, 3, 0, 0]);
    for (const row of rows) assert.equal(row.logSha256, `sha256:${(awaitSha(fs.readFileSync(path.join(dir, row.log))))}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

import crypto from "node:crypto";
function awaitSha(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }

test("DB30 tapCounts reads the node --test summary and reports a missing summary as NaN (never as a pass)", () => {
  assert.deepEqual(tapCounts("# tests 9\n# suites 0\n# pass 8\n# fail 1\n# cancelled 0\n# skipped 0\n"), { tests: 9, pass: 8, fail: 1, skipped: 0, cancelled: 0 });
  const empty = tapCounts("no summary here");
  assert.ok(Number.isNaN(empty.pass) && Number.isNaN(empty.fail));
});
