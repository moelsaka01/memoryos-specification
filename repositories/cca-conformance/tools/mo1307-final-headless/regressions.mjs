// The frozen107 existing regression tests: one selected callback per process, stop at first failure.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { root, absolute, toolRoot, record, write, regressionCases, beginCampaign, verifyBindings, finishCampaign } from './validation-bindings.mjs';

const context = beginCampaign('regressions');
const inventoryPath = toolRoot + '/regression-inventory.json';
const inventory = JSON.parse(fs.readFileSync(absolute(inventoryPath), 'utf8'));
assert.equal(inventory.kind, 'MO1307FinalHeadlessExactRegressionInventory');
assert.equal(inventory.total, 107);
assert.equal(inventory.suites.length, regressionCases.length);
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [index, suite] of inventory.suites.entries()) {
  const [id, file, expected] = regressionCases[index];
  assert.equal(suite.id, id); assert.equal(suite.file, 'repositories/cca-conformance/tests/' + file);
  assert.equal(suite.expectedTests, expected); assert.equal(suite.names.length, expected);
  assert.equal(new Set(suite.names).size, expected);
  assert.deepEqual(record(suite.file), suite.source, 'Exact reviewed test source changed');
  for (const name of suite.names) {
    assert.equal(typeof name, 'string'); assert.ok(name.length > 0 && !/[\r\n]/u.test(name));
    const pattern = new RegExp('^' + escapePattern(name) + '$');
    assert.deepEqual(suite.names.filter(candidate => pattern.test(candidate)), [name]);
  }
}
assert.equal(inventory.suites.reduce((total, suite) => total + suite.names.length, 0), 107);
const commands = [
  { id: 'package-check', args: ['repositories/cca-conformance/tools/mo1307-phase1/package.mjs', 'check'], expectedTests: null, outerGuardMs: 60000 },
  ...inventory.suites.flatMap(suite => suite.names.map((name, index) => ({
    id: suite.id + '-' + String(index + 1).padStart(3, '0'), suite: suite.id, testName: name,
    args: ['--test', '--test-reporter=tap', '--test-concurrency=1', '--test-name-pattern=^' + escapePattern(name) + '$', suite.file],
    expectedTests: 1, sourceSuiteTests: suite.expectedTests, outerGuardMs: 90000,
  }))),
];
const rows = []; let failure = null;
write(context.output + '/plan.json', {
  commands, inventory: record(inventoryPath), expectedTests: 107,
  stopBoundary: 'One predeclared exact-name callback per fresh Node test process; stop before any later mandatory test after the first selected-test or command failure. Original assertions and fixtures are unchanged.',
  excludedRegistrations: 'Nonselected registrations may be omitted or reported as filtered skips by Node. They are not executions, mandatory skips or prior PASS promotion. The selected callback must pass exactly once without skip or todo.',
  outerGuards: 'Engineering command hang guards only; fixed product deadlines remain unchanged.',
  prerequisite: 'Minimum wire exchange and complete finite console/security validation must pass before this driver is launched.',
  remainingSeparateRequirements: ['native-filesystem driver', 'two TOCTOU controls', 'fresh installed-runtime Phase3A A-O after validation and new candidate binding'],
});
try {
  for (const command of commands) {
    verifyBindings(context);
    const started = performance.now();
    const r = spawnSync(process.execPath, command.args, { cwd: root, windowsHide: true, encoding: null, timeout: command.outerGuardMs, maxBuffer: 16 * 1024 * 1024 });
    const stdout = r.stdout ?? Buffer.alloc(0), stderr = r.stderr ?? Buffer.alloc(0);
    const out = context.output + '/' + command.id + '.stdout.txt', err = context.output + '/' + command.id + '.stderr.txt';
    write(out, stdout); write(err, stderr);
    const row = { ...command, executable: process.execPath, exitCode: r.status, signal: r.signal,
      error: r.error ? { code: r.error.code ?? null, message: r.error.message } : null,
      elapsedMs: performance.now() - started, stdout: record(out), stderr: record(err), result: r.status === 0 && !r.error && r.signal === null ? 'PASS' : 'FAIL' };
    if (command.expectedTests !== null) {
      const tap = stdout.toString('utf8');
      const count = key => Number(new RegExp('^# ' + key + ' (\\d+)\\r?$', 'm').exec(tap)?.[1] ?? NaN);
      row.tests = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(k => [k, count(k)]));
      row.testNames = [...tap.matchAll(/^# Subtest: (.+)\r?$/gm)].map(m => m[1].trimEnd());
      const suiteNames = inventory.suites.find(suite => suite.id === command.suite).names;
      const outcomes = [...tap.matchAll(/^(ok|not ok) \d+ - (.+)\r?$/gm)].map(match => {
        const detail = match[2].trimEnd(), directive = /\s+#\s+(SKIP|TODO)\b.*$/iu.exec(detail);
        return { status: match[1], name: directive ? detail.slice(0, directive.index) : detail, directive: directive?.[1].toUpperCase() ?? null };
      });
      row.selected = outcomes.filter(outcome => outcome.name === command.testName);
      row.excludedRegistrations = outcomes.filter(outcome => outcome.name !== command.testName);
      const selectedPass = row.selected.length === 1 && row.selected[0].status === 'ok' && row.selected[0].directive === null;
      const excludedOnly = row.excludedRegistrations.every(outcome => suiteNames.includes(outcome.name) && outcome.status === 'ok' && outcome.directive === 'SKIP');
      const countsMatch = row.tests.pass === 1 && row.tests.tests === outcomes.length && row.tests.skipped === row.excludedRegistrations.length && ['fail', 'cancelled', 'todo'].every(key => row.tests[key] === 0);
      const registrationsMatch = row.testNames.length === outcomes.length && new Set(row.testNames).size === row.testNames.length && new Set(outcomes.map(outcome => outcome.name)).size === outcomes.length && row.testNames.every(name => suiteNames.includes(name)) && row.testNames.includes(command.testName);
      if (!selectedPass || !excludedOnly || !countsMatch || !registrationsMatch) row.result = 'FAIL';
    } else if (row.result === 'PASS') {
      try {
        row.packageCheck = JSON.parse(stdout.toString('utf8'));
        assert.equal(row.packageCheck.members, 89); assert.equal(row.packageCheck.contractMembers, 53); assert.equal(row.packageCheck.externalProductionDependencies, 0);
      } catch { row.result = 'FAIL'; }
    }
    rows.push(row); write(context.output + '/' + command.id + '.receipt.json', row);
    console.log(JSON.stringify({ id: row.id, result: row.result, tests: row.tests ?? null }));
    if (row.result !== 'PASS') throw new Error('Required command failed: ' + command.id);
  }
} catch (error) { failure = { name: error.name, message: error.message, stack: error.stack }; }
finally {
  finishCampaign(context, { suite: 'existing107', result: failure === null && rows.length === commands.length ? 'PASS' : 'FAIL', expectedTests: 107,
    selectedTestPasses: rows.filter(row => row.expectedTests === 1 && row.result === 'PASS').length,
    commands: rows, notRun: commands.filter(c => !rows.some(r => r.id === c.id)).map(c => c.id), failure,
    scope: 'Affected engineering regression subset only; native filesystem, TOCTOU and certification are separate mandatory results.' });
}
