// Once-only engineering regressions for the console correction, not a 3A/3B/3C campaign.
// Run only after the separate console-security suite passes and package metadata is rebuilt.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { packageFiles } from '../mo1307-phase1/package.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = 'repositories/cca-conformance/evidence/mo1307/console-correction/regressions';
const absolute = path.join(root, output);
const candidate = '865978ff56229b60cca77bdb797987fc7d49aa4e';
const packageTree = 'd9e5d6e407adb59157ee811c90918c9b065b14e1';
const runtimePin = 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
function record(relative) {
  const bytes = fs.readFileSync(path.join(root, relative));
  return { path: relative.replaceAll('\\', '/'), byteLength: bytes.length, sha256: hash(bytes) };
}
function write(name, value) {
  fs.writeFileSync(path.join(absolute, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
function git(args) {
  const result = spawnSync('git', args, { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
  assert.ifError(result.error); assert.equal(result.status, 0, 'Git candidate binding failed');
  return result.stdout.trim();
}
assert.equal(process.argv.length, 2, 'No runtime or output overrides are accepted');
assert.equal(process.version, 'v24.21.0'); assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64');
assert.equal(hash(fs.readFileSync(process.execPath)), runtimePin);
assert.equal(packageFiles.length, 89);
assert.equal(git(['rev-parse', 'HEAD']), candidate);
assert.equal(git(['rev-parse', candidate + ':repositories/memoryos-readiness']), packageTree);
git(['diff', '--quiet', candidate, '--', 'repositories/memoryos-readiness']);
assert.equal(fs.existsSync(absolute), false, 'This regression generation is once-only; retain any earlier attempt');
fs.mkdirSync(absolute, { recursive: true });

const testRoot = 'repositories/cca-conformance/tests/';
const cases = [
  ['package-tests', 'mo1307_phase1_package_test.mjs', 8],
  ['launch-policy', 'mo1307_phase2c_launch_policy_test.mjs', 13],
  ['runtime', 'mo1307_phase2c_runtime_test.mjs', 36],
  ['protocol-publication-correction', 'mo1307_phase2c_correction_test.mjs', 24],
  ['timer-lifetime', 'mo1307_phase2c_timer_lifetime_test.mjs', 1],
  ['native-foundation', 'mo1307_phase1_native_test.mjs', 25],
];
const commands = [
  { id: 'package-check', args: ['repositories/cca-conformance/tools/mo1307-phase1/package.mjs', 'check'], expectedTests: null, outerGuardMs: 60000 },
  ...cases.map(([id, file, expectedTests]) => ({ id, args: ['--test', '--test-reporter=tap', '--test-concurrency=1', testRoot + file], expectedTests, outerGuardMs: 90000 })),
];
const independentRequiredChecks = [
  'Finite console security suite, including source-instrumented failure branches and actual fixed-launch witness',
  'Fresh native filesystem hostile fixtures; JavaScript identity checks alone do not discharge them',
  'Fresh before-read-replacement and held-to-fresh-replacement native TOCTOU witnesses',
  'Fresh installed-runtime Phase3A A-O certification after all engineering validation passes',
];
const inputs = new Set([
  ...packageFiles.map(member => 'repositories/memoryos-readiness/' + member),
  ...cases.map(([, file]) => testRoot + file),
  'repositories/cca-conformance/tools/mo1307-console-correction/regressions.mjs',
]);
function addTree(relative) {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const item = relative + '/' + entry.name;
    assert.equal(entry.isSymbolicLink(), false, 'No linked regression input');
    if (entry.isDirectory()) addTree(item);
    else { assert.equal(entry.isFile(), true, 'Only regular regression inputs'); inputs.add(item); }
  }
}
const rows = [];
let before = [], after = [], failure = null;
try {
  for (const relative of [
    'repositories/cca-conformance/fixtures/mo1307',
    'repositories/cca-conformance/tools/mo1307-phase1',
    'repositories/cca-conformance/tools/mo1307-phase2c-correction',
    'repositories/cca-conformance/tools/mo1307-phase2c-resumed',
    'repositories/cca-conformance/tools/mo1307-phase2c-continuation',
  ]) addTree(relative);
  before = [...inputs].sort().map(record);
  write('inputs-before.json', before);
  write('plan.json', {
    kind: 'MO1307ConsoleCorrectionRegressionPlan', candidate, packageTree, commands,
    expectedTests: 107, retries: 0, parallelCommands: 0,
    stopBoundary: 'The first failed command stops the driver before another command; each original node:test file retains its own case execution behavior.',
    productLimitsMs: { helper: 5000, aggregateHelper: 20000, cli: 30000, apiWorker: 10000, cleanup: 2000, nativeHostWait: 1000 },
    outerGuardScope: 'Engineering command hang guards only; these do not replace, extend, or evaluate product deadlines.',
    independentRequiredChecks,
  });
  for (const command of commands) {
    assert.deepEqual([...inputs].sort().map(record), before, 'Regression inputs changed before a required command');
    const started = performance.now();
    const result = spawnSync(process.execPath, command.args, {
      cwd: root, windowsHide: true, encoding: null,
      timeout: command.outerGuardMs, maxBuffer: 16 * 1024 * 1024,
    });
    const stdout = result.stdout ?? Buffer.alloc(0), stderr = result.stderr ?? Buffer.alloc(0);
    const stdoutPath = output + '/' + command.id + '.stdout.txt';
    const stderrPath = output + '/' + command.id + '.stderr.txt';
    fs.writeFileSync(path.join(root, stdoutPath), stdout, { flag: 'wx' });
    fs.writeFileSync(path.join(root, stderrPath), stderr, { flag: 'wx' });
    const row = {
      ...command, executable: process.execPath, exitCode: result.status, signal: result.signal,
      error: result.error ? { code: result.error.code ?? null, message: result.error.message } : null,
      elapsedMs: performance.now() - started, stdout: record(stdoutPath), stderr: record(stderrPath),
      result: result.status === 0 && !result.error && result.signal === null ? 'PASS' : 'FAIL',
    };
    if (command.expectedTests !== null) {
      const tap = stdout.toString('utf8');
      const count = key => Number(new RegExp('^# ' + key + ' (\\d+)\\r?$', 'm').exec(tap)?.[1] ?? NaN);
      row.tests = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(key => [key, count(key)]));
      row.testNames = [...tap.matchAll(/^# Subtest: (.+)\r?$/gm)].map(match => match[1].trimEnd());
      if (row.tests.tests !== command.expectedTests || row.tests.pass !== command.expectedTests ||
          ['fail', 'cancelled', 'skipped', 'todo'].some(key => row.tests[key] !== 0) || row.testNames.length !== command.expectedTests) row.result = 'FAIL';
    } else if (row.result === 'PASS') {
      try {
        row.packageCheck = JSON.parse(stdout.toString('utf8'));
        if (row.packageCheck.members !== 89 || row.packageCheck.contractMembers !== 53 || row.packageCheck.externalProductionDependencies !== 0) row.result = 'FAIL';
      } catch { row.result = 'FAIL'; }
    }
    rows.push(row); write(command.id + '.receipt.json', row);
    console.log(JSON.stringify({ id: row.id, result: row.result, tests: row.tests ?? null }));
    if (row.result !== 'PASS') throw new Error('Required regression command failed: ' + command.id);
  }
} catch (error) {
  failure = { name: error.name, message: error.message, stack: error.stack };
} finally {
  let sourcesUnchanged = false;
  try { after = [...inputs].sort().map(record); sourcesUnchanged = JSON.stringify(before) === JSON.stringify(after); }
  catch (error) { failure ??= { name: error.name, message: error.message, stack: error.stack }; }
  if (!sourcesUnchanged) failure ??= { name: 'InputBindingFailure', message: 'One or more bound source/fixture inputs changed or were unavailable' };
  write('inputs-after.json', after);
  const result = failure === null && rows.length === commands.length && rows.every(row => row.result === 'PASS') ? 'PASS' : 'FAIL';
  write('receipt.json', {
    kind: 'MO1307ConsoleCorrectionAffectedRegressionReceipt', result, candidate, packageTree,
    runtime: { executable: process.execPath, version: process.version, platform: process.platform, arch: process.arch, sha256: runtimePin },
    expectedTests: 107, commands: rows,
    notRun: commands.filter(command => !rows.some(row => row.id === command.id)).map(command => command.id),
    sourceBindings: before.length, sourcesUnchanged, failure, retries: 0, independentRequiredChecks,
    scope: 'Selected existing package, fixed-launch, runtime/deadline/cleanup, protocol/publication and native-foundation engineering regressions. PASS does not discharge the separately required console-security, hostile native filesystem, native TOCTOU or installed-runtime certification checks.',
    phase3BCampaignRun: false, phase3CCampaignRun: false, certificationAcceptance: false,
  });
  console.log(JSON.stringify({ result, completedCommands: rows.length, expectedTests: 107, sourcesUnchanged }));
  process.exitCode = result === 'PASS' ? 0 : 1;
}
