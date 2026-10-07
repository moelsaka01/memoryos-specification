// usage: node build-exclusions.mjs <setupDir> <g2NamesJson>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [setup, g2names] = process.argv.slice(2);
const rd = (f) => JSON.parse(readFileSync(join(setup, f), 'utf8').replace(/^﻿/, ''));
const rounds = ['blocked-probe.json', 'blocked-probe-round2.json', 'blocked-probe-round3.json', 'blocked-probe-round4.json'];
const perTree = { g4b: new Set(), g4c: new Set() }; const probeRounds = [];
rounds.forEach((f, i) => { const rows = rd(f); const b = rows.filter((x) => !x.launched); probeRounds.push({ round: i + 1, probed: rows.length, blocked: b.map((x) => `${x.tree}:${x.exe}`).sort() }); for (const x of b) perTree[x.tree].add(x.exe); });
const extra = readFileSync(join(setup, 'discovery-extra-blocked.txt'), 'utf8').split(/\r?\n/).filter(Boolean);
const extraExes = extra.map((l) => l.match(/: (\S+\.exe) result/)[1]);
for (const e of extraExes) { /* blocked at ctest discovery in one tree; renamed in both */ }
const renames = readFileSync(join(setup, 'sac-renames.txt'), 'utf8').split(/\r?\n/).filter(Boolean).filter((l) => l.startsWith('g4b renamed')).map((l) => l.replace('g4b renamed ', ''));
const gtestRenamed = [...new Set([...renames, ...extraExes])].sort();
const union = [...new Set([...perTree.g4b, ...perTree.g4c, ...extraExes])].sort();
const nonGtest = union.filter((e) => !gtestRenamed.includes(e));
const tests = rd('ctest-tests-g4b.json').tests;
const testsC = rd('ctest-tests-g4c.json').tests;
const rel = (c) => (c ? c[0].replace(/\\/g, '/').replace(/^.*\/out\/build\/default\//, '') : null);
const mapped = {}; const mappedTests = new Set();
for (const t of tests) { const r = rel(t.command); if (r && nonGtest.includes(r)) { (mapped[r] ??= []).push(t.name); mappedTests.add(t.name); } }
const placeholders = tests.map((t) => t.name).filter((n) => /_NOT_BUILT$/.test(n));
const placeholdersC = testsC.map((t) => t.name).filter((n) => /_NOT_BUILT$/.test(n));
if (JSON.stringify(placeholders.slice().sort()) !== JSON.stringify(placeholdersC.slice().sort())) throw new Error('placeholder sets differ between trees');
if (JSON.stringify(tests.map((t) => t.name).sort()) !== JSON.stringify(testsC.map((t) => t.name).sort())) throw new Error('registered test sets differ between trees');
const excluded = [...placeholders, ...[...mappedTests]];
const unmappedBlocked = nonGtest.filter((e) => !mapped[e]);
const regex = '^(' + excluded.map((n) => n.replace(/\./g, '\\.')).join('|') + ')$';
const ctestCommand = `ctest --preset default -E "${regex}" --timeout 3600`;
const guardOk = union.every((e) => /^repositories\/[^\n]+\.exe$/.test(e));
// gtest names
const raw = rd('gtest-list-raw.json'); const g2 = JSON.parse(readFileSync(g2names, 'utf8').replace(/^﻿/, ''));
const parse = (txt) => { const out = []; let suite = ''; for (const line of txt.split(/\r?\n/)) { if (!line.trim()) continue; if (/^\S/.test(line)) { suite = line.trim().replace(/\s*#.*$/, ''); } else { out.push(suite + line.trim().replace(/\s*#.*$/, '')); } } return out; };
const names = {}; const sources = {};
for (const e of gtestRenamed) {
  if (raw[e]) { names[e] = parse(raw[e].raw); sources[e] = `--gtest_list_tests of the same executable built unblocked in ${raw[e].source} (A3.1 tree; C and C++ sources are identical between BF and the candidate)`; }
  else if (g2[e]) { names[e] = g2[e]; sources[e] = 'names recorded in the generation 2 evidence (phase3-precondition-g2/setup/excluded-gtest-test-names.json), built unblocked in the A3.1 tree'; }
  else throw new Error('no names for ' + e);
}
writeFileSync(join(setup, 'excluded-gtest-test-names.json'), JSON.stringify({ sources, names }, null, 2) + '\n');
const ex = {
  kind: 'MO1308Phase3PreconditionG4Exclusions', amendments: 'A3.1 (cca_core_tests), A3.2, A3.3, A3.4 (generation 4)', frozenBeforeRecordedRuns: true,
  baseline: '1dd1e8c82fe0ed5a32a894744392f2c279f89d4c', candidate: 'f4211c8c502f771bc78c2d2ab509c20d2b715676',
  trees: { baseline: 'g4b', candidate: 'g4c' },
  probeRounds, blockedPerTree: { g4b: [...perTree.g4b].sort(), g4c: [...perTree.g4c].sort() }, blockedAtCtestDiscovery: extra,
  unionOfBlockedExecutables: union.length, unionList: union,
  gtestExecutablesRenamedInBothTrees: gtestRenamed, nonGtestBlockedExecutables: nonGtest, testsForNonGtestBlockedExecutables: mapped,
  blockedExecutablesWithNoCtestTest: unmappedBlocked,
  guard: guardOk ? 'all blocked executables are native C++ test, example or tool binaries built under repositories/ (no node.exe, python.exe, cmake.exe, ctest.exe, npm.cmd); the pinned node.exe, python.exe, cmake.exe and ctest.exe launch normally' : 'GUARD FAILED',
  registeredTests: tests.length, ctestExcludedNames: excluded, ctestExcludedCount: excluded.length, ctestExcludeRegex: regex, ctestCommand,
  excludedGtestTestNames: 'excluded-gtest-test-names.json',
  classification: 'ENVIRONMENT_BLOCKED_SAC for every excluded test except cca_core_tests_NOT_BUILT, which is the A3.1 waiver',
};
writeFileSync(join(setup, 'exclusions.json'), JSON.stringify(ex, null, 2) + '\n');
writeFileSync(join(setup, '..', 'ctest-command.txt'), ctestCommand + '\n');
console.log('registered', tests.length, 'excluded', excluded.length, 'union', union.length, 'gtest', gtestRenamed.length, 'nonGtest', nonGtest.length, 'unmapped', unmappedBlocked.join(','), 'guard', guardOk);
