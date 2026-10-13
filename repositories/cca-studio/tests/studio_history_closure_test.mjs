// MemoryOS 1.3.1 closure checks against the v1.3.0 baseline: SH19 (no C/C++ file, CMake file or vcpkg manifest changed, which is the
// recorded proof that lets certification skip the C++ CTest run), SH20 (no MO-1308 production blob changed) and SH21 (no dependency,
// lock file or build-step change; no new import specifier). Every test fails, and is never skipped, when the baseline commit is absent.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BASELINE_COMMIT, STUDIO_ROOT, isDependencyPath, isNativePath } from "./support-studio-history.mjs";

const REPO_ROOT = path.join(STUDIO_ROOT, "..", "..");
const git = (...args) => execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

function changedPaths() {
  const present = spawnSync("git", ["cat-file", "-e", `${BASELINE_COMMIT}^{commit}`], { cwd: REPO_ROOT });
  assert.equal(present.status, 0, `the baseline commit ${BASELINE_COMMIT} is not in this repository; fetch full history and tags (never skipped)`);
  const tracked = git("diff", "--name-status", "--no-renames", BASELINE_COMMIT).split("\n").filter(Boolean).map((line) => { const [status, ...rest] = line.split("\t"); return { status: status[0], path: rest.join("\t") }; });
  const untracked = git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean).map((file) => ({ status: "A", path: file }));
  return [...tracked, ...untracked];
}

test("SH19 the classifier recognizes C, C++, CMake and vcpkg paths and nothing else (negative controls)", () => {
  for (const native of ["a/b.cpp", "x.hpp", "x/y.h", "z.cc", "CMakeLists.txt", "repositories/cca-core/CMakeLists.txt", "cmake/tools.cmake", "CMakePresets.json", "vcpkg.json", "vcpkg-configuration.json", "tests/foo.inl"]) assert.ok(isNativePath(native), native);
  for (const other of ["web/js/app.js", "docs/readme.md", "tests/a.mjs", "repositories/cca-studio/scripts/serve.mjs", "ARCHITECTURE.md"]) assert.ok(!isNativePath(other), other);
  for (const dependency of ["package.json", "repositories/x/package-lock.json", "yarn.lock", "requirements.txt"]) assert.ok(isDependencyPath(dependency), dependency);
  assert.ok(!isDependencyPath("web/js/package.js"));
});

test("SH19 no C or C++ file, CMake file or vcpkg manifest differs from v1.3.0 (proof that the C++ CTest run may be skipped)", () => {
  const entries = changedPaths();
  assert.ok(entries.length > 0);
  const native = entries.filter((entry) => isNativePath(entry.path));
  assert.deepEqual(native, []);
});

test("SH20 every MO-1308 production blob is the recorded one and unchanged from v1.3.0", () => {
  const identity = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "repositories", "cca-conformance", "mo1308-phase3-candidate-identity.json"), "utf8"));
  assert.ok(identity.productionPaths.length >= 40);
  const problems = [];
  for (const entry of identity.productionPaths) {
    const working = git("hash-object", "--", entry.path).trim();
    const base = git("rev-parse", `${BASELINE_COMMIT}:${entry.path}`).trim();
    if (working !== entry.blob || base !== entry.blob) problems.push({ path: entry.path, recorded: entry.blob, working, base });
  }
  assert.deepEqual(problems, []);
  // Negative control: the check would see a changed file.
  const sample = identity.productionPaths[0];
  assert.notEqual(execFileSync("git", ["hash-object", "--stdin"], { cwd: REPO_ROOT, input: `${fs.readFileSync(path.join(REPO_ROOT, sample.path), "utf8")}\n`, encoding: "utf8" }).trim(), sample.blob);
});

test("SH21 no dependency, lock file or build-step file changed, and no file was removed or modified outside the documented list", () => {
  const entries = changedPaths();
  assert.deepEqual(entries.filter((entry) => isDependencyPath(entry.path)), []);
  const MODIFIED_ALLOWED = new Set([
    "ARCHITECTURE.md", "CHANGELOG.md", "ROADMAP.md", "README.md", "KNOWN_ISSUES.md", "RELEASE_NOTES.md",
    "repositories/cca-studio/web/index.html", "repositories/cca-studio/web/styles.css", "repositories/cca-studio/web/js/app.js", "repositories/cca-studio/scripts/serve.mjs",
    "repositories/cca-studio/scripts/memoryos-dashboard-generator.mjs",
    "repositories/cca-studio/tests/memoryos_dashboard_generator_test.mjs", "repositories/cca-studio/tests/memoryos_dashboard_separation_test.mjs",
  ]);
  const unexpected = entries.filter((entry) => entry.status !== "A" && !MODIFIED_ALLOWED.has(entry.path));
  assert.deepEqual(unexpected, [], "released files modified or deleted outside the documented list");
  // No new import specifier other than a relative path or a node: built-in in any added or modified Studio source (web, scripts; test files are checked by the import pin of their own suites).
  const specifiers = (text) => [...text.matchAll(/(?:^|[\s;])(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)|\brequire\(\s*["']([^"']+)["']\s*\)/gmu)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4]);
  const offenders = [];
  for (const entry of entries.filter((e) => e.status !== "D" && /^repositories\/cca-studio\/(web\/js|web\/dashboard|scripts)\/.*\.(m?js)$/u.test(e.path))) {
    for (const specifier of specifiers(fs.readFileSync(path.join(REPO_ROOT, entry.path), "utf8"))) {
      if (!(specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("node:"))) offenders.push({ file: entry.path, specifier });
    }
  }
  assert.deepEqual(offenders, []);
  assert.deepEqual(specifiers('import x from "left-pad"; const y = require("lodash");'), ["left-pad", "lodash"], "negative control: the scan sees a bare specifier");
});
