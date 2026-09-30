// The frozen107 existing regression tests, bound to prepared repair bytes; no acceptance claim.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { root, record, write, regressionCases, beginCampaign, verifyBindings, finishCampaign } from './validation-bindings.mjs';

const context = beginCampaign('regressions');
const commands = [
  { id: 'package-check', args: ['repositories/cca-conformance/tools/mo1307-phase1/package.mjs', 'check'], expectedTests: null, outerGuardMs: 60000 },
  ...regressionCases.map(([id, file, expectedTests]) => ({ id, args: ['--test', '--test-reporter=tap', '--test-concurrency=1', 'repositories/cca-conformance/tests/' + file], expectedTests, outerGuardMs: 90000 })),
];
const rows = []; let failure = null;
write(context.output + '/plan.json', {
  commands, expectedTests: 107, stopBoundary: 'Stop before the next required command after any failure; each original node:test file retains its original case scheduler.',
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
      if (row.tests.tests !== command.expectedTests || row.tests.pass !== command.expectedTests || row.testNames.length !== command.expectedTests || ['fail', 'cancelled', 'skipped', 'todo'].some(k => row.tests[k] !== 0)) row.result = 'FAIL';
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
    commands: rows, notRun: commands.filter(c => !rows.some(r => r.id === c.id)).map(c => c.id), failure,
    scope: 'Affected engineering regression subset only; native filesystem, TOCTOU and certification are separate mandatory results.' });
}
