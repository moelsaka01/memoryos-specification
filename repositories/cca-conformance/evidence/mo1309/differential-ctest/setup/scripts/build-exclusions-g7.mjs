// MO-1309 W6b: freeze the Smart App Control exclusions (MO-1308 Amendment A3.3 rule) for the CTest differential, BEFORE the recorded runs.
// usage: node build-exclusions-g7.mjs <setupDir> <baselineCommit> <candidateCommit>
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
const [setup, baseline, candidate] = process.argv.slice(2);
const rd = (f) => JSON.parse(readFileSync(join(setup, f), "utf8").replace(/^\uFEFF/u, ""));
const head = (d) => execFileSync("git", ["-C", d, "rev-parse", "HEAD"]).toString().trim();
if (head("C:/g7b") !== baseline || head("C:/g7c") !== candidate) throw new Error("tree commits differ from the arguments");
const rounds = ["blocked-probe.json", "blocked-probe-round2.json", "blocked-probe-round3.json", "blocked-probe-round4.json"];
const perTree = { g7b: new Set(), g7c: new Set() }; const probeRounds = [];
rounds.forEach((f, i) => { const rows = rd(f); const blocked = rows.filter((x) => !x.launched); probeRounds.push({ round: i + 1, probed: rows.length, blocked: blocked.map((x) => `${x.tree}:${x.exe}`).sort() }); for (const x of blocked) perTree[x.tree].add(x.exe); });
const union = [...new Set([...perTree.g7b, ...perTree.g7c])].sort();
const tests = rd("ctest-tests-g7b.json").tests; const testsC = rd("ctest-tests-g7c.json").tests;
if (JSON.stringify(tests.map((t) => t.name).sort()) !== JSON.stringify(testsC.map((t) => t.name).sort())) throw new Error("registered test sets differ between trees");
const BS = String.fromCharCode(92);
const rel = (c) => (c ? c[0].split(BS).join("/").replace(new RegExp("^.*/out/build/default/", "u"), "") : null);
const mapped = {}; const mappedTests = new Set();
for (const t of tests) { const r = rel(t.command); if (r && union.includes(r)) { (mapped[r] ??= []).push(t.name); mappedTests.add(t.name); } }
const placeholders = tests.map((t) => t.name).filter((n) => /_NOT_BUILT$/u.test(n));
const excluded = [...placeholders, ...mappedTests];
const guardOk = union.every((e) => /^repositories\/[^\n]+\.exe$/u.test(e));
if (!guardOk) throw new Error("GUARD: a blocked executable is not a native binary built under repositories/");
const regex = "^(" + excluded.map((n) => n.split(".").join(BS + ".")).join("|") + ")$";
const ctestCommand = `ctest --preset default -E "${regex}" --timeout 3600`;
const ex = {
  kind: "MO1309Phase4W6bExclusions", amendments: "MO-1308 A3.1 (cca_core_tests waiver), A3.2 (differential), A3.3 (Smart App Control union exclusion), A3.4", frozenBeforeRecordedRuns: true,
  baseline, candidate, trees: { baseline: "g7b", candidate: "g7c" },
  probeRounds, blockedPerTree: { g7b: [...perTree.g7b].sort(), g7c: [...perTree.g7c].sort() }, unionOfBlockedExecutables: union.length, unionList: union,
  gtestExecutablesRenamedInBothTrees: [], nonGtestBlockedExecutables: union, testsForNonGtestBlockedExecutables: mapped,
  guard: "every blocked executable is a native C++ example or tool binary built under repositories/ (no node.exe, python.exe, cmake.exe, ctest.exe, npm.cmd)",
  registeredTests: tests.length, ctestExcludedNames: excluded, ctestExcludedCount: excluded.length, ctestExcludeRegex: regex, ctestCommand,
  classification: "ENVIRONMENT_BLOCKED_SAC for every excluded test except cca_core_tests_NOT_BUILT, which is the A3.1 waiver",
};
writeFileSync(join(setup, "exclusions.json"), JSON.stringify(ex, null, 2) + "\n");
writeFileSync(join(setup, "..", "ctest-command.txt"), ctestCommand + "\n");
console.log("registered", tests.length, "excluded", excluded.length, "union", union.length, "names", excluded.join(","));
