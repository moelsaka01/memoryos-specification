// MO-1309 W6b: computes the A3.2 comparison and receipt from the two recorded CTest logs. usage: node build-receipt-g7.mjs <logsDir> <evidenceDir>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [L, EV] = process.argv.slice(2);
const parse = (f) => { const m = new Map(); for (const l of readFileSync(join(L, f), "utf8").split(/\r?\n/u)) { const x = l.match(/Test +#\d+: (\S+) \.+ *(?:\*\*\*)?([A-Za-z ]*[A-Za-z]) +[\d.]+ sec/u); if (x) m.set(x[1], x[2].trim()); } return m; };
const B = parse("baseline-ctest-run.log"); const C = parse("candidate-ctest-run.log");
const times = (f) => { const t = readFileSync(join(L, f), "utf8"); return { start: t.match(/start (.+)/u)[1].trim(), end: t.match(/end (.+)/u)[1].trim(), exit: Number(t.match(/exit=(\d+)/u)[1]) }; };
const tb = times("baseline-times.txt"); const tc = times("candidate-times.txt");
const ex = JSON.parse(readFileSync(join(L, "setup/exclusions.json"), "utf8"));
const same = "identical result on BASELINE (BF), where the code under test is byte-identical for this unit";
const CLS = {
  "memoryos.standard.independent": ["ENVIRONMENT", "AssertionError: the authoritative Standard publication must be supplied or installed adjacent to the suite; none is installed in a fresh worktree; " + same],
  "memoryos.mcp.foundation": ["ENVIRONMENT", "The MCP foundation suite fails on the missing out/phase2/memoryos-mcp-0.1.0.tgz artifact and on MO1304_RUNTIME_INTEGRITY at server start (raw npm ci output versus the pruned dependency-closure pin); it rewrites the tracked measurements/phase2-integration.json (A3.4 follow-ups 1 to 3); " + same],
  "memoryos.standard.mo1304-phase1": ["ENVIRONMENT", "MO1304_RUNTIME_INTEGRITY: raw npm ci output does not match the pruned MCP dependency-closure pin (A3.4 follow-up 2); " + same],
  "memoryos.standard.mo1304-phase2": ["ENVIRONMENT", "ENOENT out/phase2/memoryos-mcp-0.1.0.tgz: the archive is required but not produced by npm ci (A3.4 follow-up 3); " + same],
  "memoryos.standard.mo1304-phase3-ubuntu": ["ENVIRONMENT", "The test compares the tracked measurements/phase2-integration.json with its pinned bytes; memoryos.mcp.foundation rewrote it earlier in the same run (A3.4 follow-up 1); " + same],
  "memoryos.standard.mo1304-phase3-windows": ["ENVIRONMENT", "Same as memoryos.standard.mo1304-phase3-ubuntu: the tracked measurements/phase2-integration.json was rewritten by memoryos.mcp.foundation earlier in the run; " + same],
  "memoryos.standard.mo1304-platform-support": ["ENVIRONMENT", "Same as memoryos.standard.mo1304-phase3-ubuntu: the tracked measurements/phase2-integration.json was rewritten by memoryos.mcp.foundation earlier in the run; " + same],
  "memoryos.standard.mo1305-phase3": ["ENVIRONMENT", "Hard-coded workspace root C:/Users/melsa/Documents/Codex/cca-workspace (ValueError WORKSPACE, tools/mo1305-phase3d/common.py); A3.2 follow-up; " + same],
  "memoryos.standard.specification": ["TEST", "Stale 1.2.1 pin of repositories/cca-core/src (A3.2); " + same],
  "memoryos.standard.coverage-gap": ["TEST", "Same specification conformance check as memoryos.standard.specification (A3.2); " + same],
  "memoryos.standard.runtime.reference": ["ENVIRONMENT", "Not Run: needs cca_core_tests.exe, waived by A3.1 (MSVC 19.44 C2607); " + same],
};
const names = [...new Set([...B.keys(), ...C.keys()])].sort();
const pass = (s) => s === "Passed";
const rows = names.map((n) => {
  const b = B.get(n) ?? null; const c = C.get(n) ?? null; let comparison;
  if (b === null) comparison = pass(c) ? "CANDIDATE_ONLY_PASS" : "CANDIDATE_ONLY_FAIL";
  else if (c === null) comparison = "REMOVED_ON_CANDIDATE";
  else if (pass(b) && pass(c)) comparison = "PASS_BOTH";
  else if (pass(b) && !pass(c)) comparison = "NEW_FAILURE";
  else if (!pass(b) && pass(c)) comparison = "NEWLY_PASSING";
  else comparison = "PRE_EXISTING";
  const k = CLS[n] ?? (/AllocationFailureTest\./u.test(n) ? ["PRODUCT_OR_TOOLCHAIN_UNDETERMINED", "AllocationFailureTest case (googletest): the test executable aborts shortly after RUN, in the same way on BASELINE; the C and C++ sources are identical between BF and the candidate (A3.2 classification of the 112 cases)"] : null);
  return { test: n, baseline: b, candidate: c, comparison, classification: comparison === "PRE_EXISTING" ? (k?.[0] ?? "UNCLASSIFIED") : null, reason: comparison === "PRE_EXISTING" ? (k?.[1] ?? "") : null };
});
const cnt = (cm) => rows.filter((r) => r.comparison === cm).length;
const tally = (M) => { const v = [...M.values()]; return { passed: v.filter(pass).length, failed: v.filter((s) => s === "Failed").length, notRun: v.filter((s) => s === "Not Run").length }; };
const r1 = pass(C.get("cca.workspace.verify"));
const newFail = rows.filter((r) => r.comparison === "NEW_FAILURE"); const candOnlyFail = rows.filter((r) => r.comparison === "CANDIDATE_ONLY_FAIL"); const preEx = rows.filter((r) => r.comparison === "PRE_EXISTING");
const r2 = newFail.length === 0 && cnt("REMOVED_ON_CANDIDATE") === 0; const r3 = candOnlyFail.length === 0; const r4 = preEx.every((r) => r.classification !== "UNCLASSIFIED");
const verdict = r1 && r2 && r3 && r4 ? "PASS" : "FAILED_PRESERVED";
const receipt = {
  kind: "MO1309Phase4W6bCtestReceipt", verdict,
  amendments: "MO-1308 Amendments A3.1 (cca_core_tests waiver), A3.2 (differential rule), A3.3 (Smart App Control union exclusion), A3.4; docs/mo1308-contract-freeze-1.md sections 31, 32, 33, 36",
  reason: verdict === "PASS" ? "Rules 1 to 4 hold: cca.workspace.verify passes on CANDIDATE; no test that passes on BASELINE fails or is Not Run on CANDIDATE; no candidate-only test exists; every test failing on both is PRE_EXISTING with a classification." : "A rule failed; see rules and the comparison.",
  baseline: { commit: ex.baseline, worktree: "C:/g7b", registered: ex.registeredTests, excluded: ex.ctestExcludedCount, executed: B.size, ...tally(B), ...tb },
  candidate: { commit: ex.candidate, worktree: "C:/g7c", registered: ex.registeredTests, excluded: ex.ctestExcludedCount, executed: C.size, ...tally(C), ...tc },
  command: ex.ctestCommand, exclusions: "setup/exclusions.json (frozen and committed before the recorded runs, commit " + readFileSync(join(L, "frozen-commit.txt"), "utf8").trim() + ")",
  rules: { rule1_workspaceVerifyPassesOnCandidate: r1, rule2_noBaselinePassingTestFailsOrNotRunOnCandidate: r2, rule3_everyCandidateOnlyTestPasses: r3, rule4_everyFailBothTestListedPreExistingWithClassification: r4 },
  comparison: { PASS_BOTH: cnt("PASS_BOTH"), PRE_EXISTING: cnt("PRE_EXISTING"), NEW_FAILURE: cnt("NEW_FAILURE"), NEWLY_PASSING: cnt("NEWLY_PASSING"), CANDIDATE_ONLY_PASS: cnt("CANDIDATE_ONLY_PASS"), CANDIDATE_ONLY_FAIL: cnt("CANDIDATE_ONLY_FAIL"), REMOVED_ON_CANDIDATE: cnt("REMOVED_ON_CANDIDATE") },
  newFailures: newFail, candidateOnlyTests: rows.filter((r) => r.comparison.startsWith("CANDIDATE_ONLY")),
  preExisting: { count: preEx.length, tests: preEx.map(({ test, baseline, candidate, classification, reason }) => ({ test, baseline, candidate, classification, reason })) },
  workspaceVerify: { baseline: B.get("cca.workspace.verify"), candidate: C.get("cca.workspace.verify") },
  setupDeviations: ["MEMORYOS_VSCODE_NPM_EXECUTABLE pinned to npm.cmd at configure (A3.3, identical in both trees)", "npm ci --ignore-scripts in the five lockfile directories; built with the pinned Node; Smart App Control left enforcing", "vcpkg checkout (commit cd61e1e2) copied into each tree before configure"],
  smartAppControl: { enforcing: true, unionOfBlockedExecutables: ex.unionOfBlockedExecutables, excludedTests: ex.ctestExcludedCount, note: "the blocked set varies between probe rounds; only round 1 blocked one example binary, which is excluded by name in both runs" },
  note: "memoryos.mcp.foundation rewrote the tracked measurements/phase2-integration.json in both trees (A3.4); recorded in the porcelain files, not a gate.",
};
writeFileSync(join(EV, "comparison.json"), JSON.stringify(rows, null, 2) + "\n");
writeFileSync(join(EV, "comparison.csv"), "test,baseline,candidate,comparison,classification\n" + rows.map((r) => [r.test, r.baseline, r.candidate, r.comparison, r.classification ?? ""].map((x) => `"${x}"`).join(",")).join("\n") + "\n");
writeFileSync(join(EV, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(verdict, JSON.stringify(receipt.comparison), "B", JSON.stringify(tally(B)), "C", JSON.stringify(tally(C)));
