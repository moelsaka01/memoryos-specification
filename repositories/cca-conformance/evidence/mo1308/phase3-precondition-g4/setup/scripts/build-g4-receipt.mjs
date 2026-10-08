import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
const L = 'C:/g4-logs';
const EV = process.argv[2];
const parse = (f) => { const m = new Map(); for (const l of readFileSync(join(L, f), 'utf8').split(/\r?\n/)) { const x = l.match(/Test +#\d+: (\S+) \.+ *(?:\*\*\*)?([A-Za-z ]*[A-Za-z]) +[\d.]+ sec/); if (x) m.set(x[1], x[2].trim()); } return m; };
const B = parse('baseline-ctest-run.log'), C = parse('candidate-ctest-run.log');
const times = (f) => { const t = readFileSync(join(L, f), 'utf8'); return { start: t.match(/start (.+)/)[1].trim(), end: t.match(/end (.+)/)[1].trim(), exit: Number(t.match(/exit=(\d+)/)[1]) }; };
const tb = times('baseline-times.txt'), tc = times('candidate-times.txt');
const ex = JSON.parse(readFileSync(join(L, 'setup/exclusions.json'), 'utf8'));
const CLS = {
  'memoryos.standard.independent': ['ENVIRONMENT', 'AssertionError: the authoritative Standard publication must be supplied or installed adjacent to the suite (portable-report.mjs); no publication is installed in the fresh worktree; identical on BASELINE.'],
  'memoryos.mcp.foundation': ['ENVIRONMENT', 'The MCP foundation suite fails on the missing out/phase2/memoryos-mcp-0.1.0.tgz artifact and on MO1304_RUNTIME_INTEGRITY at server start (raw npm ci output vs the pruned dependency-closure pin); it also rewrites the tracked measurements/phase2-integration.json (A3.4 follow-ups 1 to 3).'],
  'memoryos.standard.mo1304-phase1': ['ENVIRONMENT', 'MO1304_RUNTIME_INTEGRITY: raw npm ci output does not match the pruned MCP dependency-closure pin (A3.4 follow-up 2).'],
  'memoryos.standard.mo1304-phase2': ['ENVIRONMENT', 'ENOENT out/phase2/memoryos-mcp-0.1.0.tgz: the archive is required but not produced by npm ci (A3.4 follow-up 3).'],
  'memoryos.standard.mo1304-phase3-ubuntu': ['ENVIRONMENT', 'The test compares the tracked measurements/phase2-integration.json with its pinned bytes; memoryos.mcp.foundation rewrote it earlier in the same run (A3.4 follow-up 1).'],
  'memoryos.standard.mo1304-phase3-windows': ['ENVIRONMENT', 'Same as memoryos.standard.mo1304-phase3-ubuntu: the tracked measurements/phase2-integration.json was rewritten by memoryos.mcp.foundation earlier in the run.'],
  'memoryos.standard.mo1304-platform-support': ['ENVIRONMENT', 'Same as memoryos.standard.mo1304-phase3-ubuntu: the tracked measurements/phase2-integration.json was rewritten by memoryos.mcp.foundation earlier in the run.'],
  'memoryos.standard.mo1305-phase3': ['ENVIRONMENT', 'Hard-coded workspace root C:/Users/melsa/Documents/Codex/cca-workspace (ValueError WORKSPACE); A3.2 follow-up.'],
  'memoryos.standard.specification': ['TEST', 'Stale 1.2.1 pin of repositories/cca-core/src (A3.2).'],
  'memoryos.standard.coverage-gap': ['TEST', 'Same specification conformance check as memoryos.standard.specification (A3.2).'],
  'memoryos.standard.runtime.reference': ['ENVIRONMENT', 'Not Run: needs cca_core_tests.exe, waived by A3.1.'],
  'memoryos.standard.sdk.cpp.reference': ['ENVIRONMENT_BLOCKED_SAC', 'Not Run: its command is empty because memoryos_sdk_cpp_tests.exe was blocked by Smart App Control and renamed (A3.3); the same in both trees.'],
  'memoryos.sdk.cpp.policy.contract': ['ENVIRONMENT_BLOCKED_SAC', 'Not Run: its command is empty because memoryos_sdk_cpp_tests.exe was blocked by Smart App Control and renamed (A3.3); the same in both trees.'],
};
const names = [...new Set([...B.keys(), ...C.keys()])].sort();
const pass = (s) => s === 'Passed';
const rows = names.map((n) => { const b = B.get(n) ?? null, c = C.get(n) ?? null; let cmp;
  if (b === null) cmp = pass(c) ? 'CANDIDATE_ONLY_PASS' : 'CANDIDATE_ONLY_FAIL';
  else if (c === null) cmp = 'REMOVED_ON_CANDIDATE';
  else if (pass(b) && pass(c)) cmp = 'PASS_BOTH';
  else if (pass(b) && !pass(c)) cmp = 'NEW_FAILURE';
  else if (!pass(b) && pass(c)) cmp = 'NEWLY_PASSING';
  else cmp = 'PRE_EXISTING';
  const k = CLS[n] ?? (/AllocationFailureTest\./.test(n) ? ['PRODUCT_OR_TOOLCHAIN_UNDETERMINED', 'AllocationFailureTest aborts with exit code 3 shortly after RUN, identical on BASELINE (A3.2 classification of the 112 A3.1 failures)'] : null); return { test: n, baseline: b ?? '', candidate: c ?? '', comparison: cmp, classification: cmp === 'PRE_EXISTING' ? (k ? k[0] : 'UNCLASSIFIED') : '', detail: cmp === 'PRE_EXISTING' && k ? k[1] : '' }; });
const cnt = (cm) => rows.filter((r) => r.comparison === cm).length;
const tally = (M) => { const v = [...M.values()]; return { passed: v.filter(pass).length, failed: v.filter((s) => s === 'Failed').length, notRun: v.filter((s) => s === 'Not Run').length, other: v.filter((s) => !pass(s) && s !== 'Failed' && s !== 'Not Run').length }; };
const r1 = pass(C.get('cca.workspace.verify'));
const newFail = rows.filter((r) => r.comparison === 'NEW_FAILURE'), candOnlyFail = rows.filter((r) => r.comparison === 'CANDIDATE_ONLY_FAIL');
const preEx = rows.filter((r) => r.comparison === 'PRE_EXISTING');
const r2 = newFail.length === 0 && cnt('REMOVED_ON_CANDIDATE') === 0, r3 = candOnlyFail.length === 0, r4 = preEx.every((r) => r.classification !== 'UNCLASSIFIED');
const verdict = r1 && r2 && r3 && r4 ? 'PASS' : 'FAILED_PRESERVED';
const side = (t) => ({ commit: t === 'b' ? ex.baseline : ex.candidate, worktree: t === 'b' ? 'g4b' : 'g4c', registered: ex.registeredTests, excluded: ex.ctestExcludedCount, executed: (t === 'b' ? B : C).size, ...tally(t === 'b' ? B : C), exitCode: (t === 'b' ? tb : tc).exit, startedLocal: (t === 'b' ? tb : tc).start, endedLocal: (t === 'b' ? tb : tc).end, dirtyAfterRun: readFileSync(join(L, t === 'b' ? 'baseline-porcelain-after.txt' : 'candidate-porcelain-after.txt'), 'utf8').split(/\r?\n/).filter(Boolean) });
const receipt = {
  kind: 'MO1308Phase3PreconditionG4Receipt', verdict,
  amendments: 'A3 as refined by A3.1 (waiver), A3.2 (differential gate), A3.3 (SAC exclusion) and A3.4 (generation 4); docs/mo1308-contract-freeze-1.md sections 26, 31, 32, 33, 36',
  supersedes: ['generation 2 evidence 4196acf5 (FAILED_PRESERVED) and generation 3 evidence 2edd9d5d (PASS, candidate b0bf2d56), both left untouched'],
  reason: verdict === 'PASS' ? 'Rules 1 to 4 hold: cca.workspace.verify passes on CANDIDATE; no test that passes on BASELINE fails or is Not Run on CANDIDATE; no candidate-only test exists; every test failing on both is PRE_EXISTING with a classification.' : 'See rules.',
  baseline: side('b'), candidate: side('c'),
  command: ex.ctestCommand, exclusions: 'setup/exclusions.json (frozen and committed before the recorded runs, commit 004cfac61491df3a6a48505866c141dfcdf9ff4f)',
  rules: { rule1_workspaceVerifyPassesOnCandidate: r1, rule2_noBaselinePassingTestFailsOrNotRunOnCandidate: r2, rule3_everyCandidateOnlyTestPasses: r3, rule4_everyFailBothTestListedPreExistingWithClassification: r4 },
  comparison: { PASS_BOTH: cnt('PASS_BOTH'), PRE_EXISTING: cnt('PRE_EXISTING'), NEW_FAILURE: cnt('NEW_FAILURE'), NEWLY_PASSING: cnt('NEWLY_PASSING'), CANDIDATE_ONLY_PASS: cnt('CANDIDATE_ONLY_PASS'), CANDIDATE_ONLY_FAIL: cnt('CANDIDATE_ONLY_FAIL'), REMOVED_ON_CANDIDATE: cnt('REMOVED_ON_CANDIDATE') },
  newFailures: newFail, newlyPassing: rows.filter((r) => r.comparison === 'NEWLY_PASSING'), candidateOnlyTests: rows.filter((r) => r.comparison.startsWith('CANDIDATE_ONLY')),
  preExisting: { count: preEx.length, tests: preEx },
  workspaceVerify: { baseline: B.get('cca.workspace.verify'), candidate: C.get('cca.workspace.verify') },
  expectedFromGeneration2: { 'memoryos.vscode.runtime': { baseline: B.get('memoryos.vscode.runtime'), candidate: C.get('memoryos.vscode.runtime') }, 'memoryos.mcp.foundation': { baseline: B.get('memoryos.mcp.foundation'), candidate: C.get('memoryos.mcp.foundation') } },
  setupDeviations: ['MEMORYOS_VSCODE_NPM_EXECUTABLE pinned to npm.cmd at configure (A3.3, identical in both trees)', 'blocked gtest executables renamed to *.exe.sac-blocked in both build dirs (A3.3)', 'npm ci --ignore-scripts in the lockfile directories; built artifacts such as memoryos-mcp/out/phase2/*.tgz were not produced (environment-classified pre-existing failures)', 'npm ci ran before configure; vcpkg checkout copied from the A3.1 tree'],
  smartAppControl: { enforcing: true, unionOfBlockedExecutables: ex.unionOfBlockedExecutables, gtestExecutablesRenamed: ex.gtestExecutablesRenamedInBothTrees.length, excludedTests: ex.ctestExcludedCount, note: 'the blocked set varies between probe rounds; the union of all rounds and of ctest discovery errors is excluded in both runs' },
  note: 'A3.4: the memoryos.mcp.foundation test rewrote the tracked measurements/phase2-integration.json in both worktrees; recorded in dirtyAfterRun, not a gate.',
};
writeFileSync(join(EV, 'comparison.json'), JSON.stringify(rows, null, 2) + '\n');
writeFileSync(join(EV, 'comparison.csv'), 'test,baseline,candidate,comparison,classification\n' + rows.map((r) => [r.test, r.baseline, r.candidate, r.comparison, r.classification].map((x) => `"${x}"`).join(',')).join('\n') + '\n');
writeFileSync(join(EV, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(verdict, JSON.stringify(receipt.comparison), 'B', JSON.stringify(tally(B)), 'C', JSON.stringify(tally(C)));
