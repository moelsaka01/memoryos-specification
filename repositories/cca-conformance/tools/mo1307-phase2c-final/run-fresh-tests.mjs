// Finite engineering test runner; binds source bytes without rebuilding package metadata.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const [group, attempt] = process.argv.slice(2);
assert.ok(['timer', 'phase1'].includes(group)); assert.match(attempt ?? '', /^attempt[1-9][0-9]*$/);
const hash = b => 'sha256:' + createHash('sha256').update(b).digest('hex');
assert.equal(process.version, 'v24.21.0'); assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64');
const executableSha256 = hash(fs.readFileSync(process.execPath));
assert.equal(executableSha256, 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const tests = group === 'timer' ? ['repositories/cca-conformance/tests/mo1307_phase2c_timer_lifetime_test.mjs'] :
  ['core', 'fixtures', 'package', 'native'].map(n => `repositories/cca-conformance/tests/mo1307_phase1_${n}_test.mjs`);
const inputs = new Set(tests);
const add = relative => {
  const absolute = path.join(root, relative);
  if (fs.statSync(absolute).isDirectory()) {
    for (const entry of fs.readdirSync(absolute).sort()) add(relative + '/' + entry);
  } else inputs.add(relative);
};
for (const name of fs.readdirSync(path.join(root, 'repositories/memoryos-readiness')).sort()) {
  if (!['sbom.spdx.json', 'distribution-manifest.json'].includes(name)) add('repositories/memoryos-readiness/' + name);
}
add('repositories/cca-conformance/tools/mo1307-phase2c-final/run-fresh-tests.mjs');
add('repositories/cca-conformance/tools/mo1307-phase2c-correction/publication-fixture.mjs');
if (group === 'timer') add('repositories/cca-conformance/tools/mo1307-phase2c-continuation/timer-witness.mjs');
else {
  add('repositories/cca-conformance/tools/mo1307-phase1');
  add('repositories/cca-conformance/fixtures/mo1307');
}
const bind = () => [...inputs].sort().map(member => {
  const bytes = fs.readFileSync(path.join(root, member));
  return { path: member, byteLength: bytes.length, sha256: hash(bytes) };
});
const directory = path.join(root, 'repositories/cca-conformance/evidence/mo1307/phase2c-final', group + '-' + attempt);
assert.ok(!fs.existsSync(directory)); fs.mkdirSync(directory);
const before = bind();
const write = (name, bytes) => fs.writeFileSync(path.join(directory, name), bytes, { flag: 'wx' });
write('source-binding-before.json', JSON.stringify(before, null, 2) + '\n');
const args = ['--test', '--test-reporter=tap', '--test-concurrency=1', ...tests];
const startedAt = new Date().toISOString(), started = performance.now();
const answer = spawnSync(process.execPath, args, { cwd: root, windowsHide: true, encoding: null, timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
const elapsedMs = performance.now() - started, stdout = answer.stdout ?? Buffer.alloc(0), stderr = answer.stderr ?? Buffer.alloc(0);
write('stdout.txt', stdout); write('stderr.txt', stderr);
const after = bind(); write('source-binding-after.json', JSON.stringify(after, null, 2) + '\n');
const text = stdout.toString('utf8'), count = name => Number(new RegExp('^# ' + name + ' (\\d+)$', 'm').exec(text)?.[1] ?? NaN);
const counts = Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(name => [name, count(name)]));
const unchanged = JSON.stringify(before) === JSON.stringify(after), expectedCount = group === 'timer' ? 1 : 105;
const pass = answer.status === 0 && !answer.error && unchanged && counts.tests === expectedCount && counts.pass === expectedCount && !counts.fail && !counts.cancelled && !counts.skipped && !counts.todo;
const timerMatch = /^# TIMER_WITNESS (.+)$/m.exec(text);
const receipt = { kind: 'MO1307Phase2CFinalFreshTests', version: '1.0.0', group, attempt, startedAt, elapsedMs,
  runtime: { executable: process.execPath, version: process.version, platform: process.platform, arch: process.arch, sha256: executableSha256 },
  args, exit: answer.status, signal: answer.signal, error: answer.error?.code ?? null,
  tests: counts, expectedCount, sourcesUnchanged: unchanged, boundSourceCount: before.length,
  stdout: { byteLength: stdout.length, sha256: hash(stdout) }, stderr: { byteLength: stderr.length, sha256: hash(stderr) },
  timerWitnesses: timerMatch ? JSON.parse(timerMatch[1]) : null,
  packageSequence: 'Tests read current source and build scratch packages; final root SBOM/distribution metadata must be regenerated and checked after relevant tests. Root metadata excluded from source binding because these tests do not consume it.',
  result: pass ? 'PASS' : 'FAIL' };
write('receipt.json', JSON.stringify(receipt, null, 2) + '\n');
process.stdout.write(JSON.stringify(receipt) + '\n'); process.exitCode = pass ? 0 : 1;
