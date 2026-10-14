import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64'); assert.equal(process.version, 'v24.21.0');
assert.equal(process.env.UV_THREADPOOL_SIZE, undefined);
const node = fs.readFileSync(process.execPath); assert.equal(node.length, 93580104);
assert.equal(hash(node), 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const runtime = { path: process.execPath, version: process.version, byteLength: node.length, sha256: hash(node) };
let output;
if (process.argv.length === 3) {
  assert.match(process.argv[2], /^attempt-[1-9][0-9]?$/);
  output = path.join(root, 'repositories/cca-conformance/evidence/mo1307/phase2c-finalization-correction/campaigns', process.argv[2]);
} else {
  assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output');
  output = path.resolve(root, process.argv[3]);
  const base = path.resolve(root, '.cache/mo1307/phase2c-finalization-correction/post-binding');
  const relative = path.relative(base, output);
  assert.ok(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}
const write = (name, bytes) => { const destination = path.join(output, name); fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes, { flag: 'wx' }); return { path: name, byteLength: bytes.length, sha256: hash(bytes) }; };
const test = 'repositories/cca-conformance/tests/mo1307_phase2c_finalization_test.mjs';
const queued = 'repositories/cca-conformance/tools/mo1307-phase2c-finalization-correction/queued-rename.mjs';
const members = [test, queued, 'repositories/cca-conformance/tools/mo1307-phase2c-finalization-correction/run-campaign.mjs',
  'repositories/cca-conformance/tools/mo1307-phase2c-correction/publication-fixture.mjs',
  'repositories/cca-conformance/tests/mo1307_phase1_native_test.mjs',
  ...['canonical', 'constants', 'errors', 'helper-protocol', 'publication', 'windows-paths'].map(name => 'repositories/memoryos-readiness/src/' + name + '.mjs')];
const bindings = members.map((name, index) => { const bytes = fs.readFileSync(path.join(root, name));
  return { path: name, byteLength: bytes.length, sha256: hash(bytes),
    retained: write('inputs/' + String(index + 1).padStart(2, '0') + '-' + path.basename(name) + '.data', bytes) }; });
write('campaign.json', Buffer.from(JSON.stringify({ kind: 'MO1307FinalizationCorrectionCampaign', version: '1.0.0',
  startedAt: new Date().toISOString(), runtime, expectedFocusedGroups: 24, queuedExecutions: 1,
  perChildEngineeringTimeoutMs: 20000, noAutomaticRetry: true, sourceBindings: bindings,
  scope: 'Foundation tests, real owned filesystem and one real queued rename; no native acquisition certification.' }, null, 2) + '\n'));
function run(name, args) {
  const began = performance.now();
  const child = spawnSync(process.execPath, args, { cwd: root, timeout: 20000, encoding: null, maxBuffer: 8388608, windowsHide: true });
  return { name, args, exitCode: child.status, signal: child.signal,
    error: child.error ? { code: child.error.code, message: child.error.message } : null,
    elapsedMs: Math.round((performance.now() - began) * 1000) / 1000,
    stdout: child.stdout ?? Buffer.alloc(0), stderr: child.stderr ?? Buffer.alloc(0) };
}
function preserve(run, extra) {
  const { stdout, stderr, ...metadata } = run;
  const receipt = { ...metadata, ...extra, logs: [write(run.name + '/stdout.txt', stdout), write(run.name + '/stderr.txt', stderr)] };
  write(run.name + '/runner-receipt.json', Buffer.from(JSON.stringify(receipt, null, 2) + '\n')); return receipt;
}
const focused = run('focused', ['--test', '--test-reporter=tap', '--test-concurrency=1', test]);
const tap = focused.stdout.toString('utf8');
const counts = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped'].map(key => [key, Number(tap.match(new RegExp('^# ' + key + ' (\\d+)$', 'm'))?.[1] ?? -1)]));
const focusedPass = !focused.error && focused.exitCode === 0 && counts.tests === 24 && counts.pass === 24 && counts.fail === 0 && counts.cancelled === 0 && counts.skipped === 0;
const receipts = [preserve(focused, { result: focusedPass ? 'PASS' : 'FAIL', counts })];
let queuedPass = false;
if (focusedPass) {
  fs.mkdirSync(path.join(output, 'queued'), { recursive: true });
  const witness = run('queued', [queued, path.join(output, 'queued/receipt.json')]);
  let content = null, diagnosticReadError = null;
  try { content = JSON.parse(fs.readFileSync(path.join(output, 'queued/receipt.json'), 'utf8')); }
  catch (error) { diagnosticReadError = error.code ?? error.name; }
  queuedPass = !witness.error && witness.exitCode === 0 && content?.result === 'PASS';
  receipts.push(preserve(witness, { result: queuedPass ? 'PASS' : 'FAIL', diagnosticReadError }));
}
const after = members.map(name => { const bytes = fs.readFileSync(path.join(root, name)); return { path: name, byteLength: bytes.length, sha256: hash(bytes) }; });
let sourceBindingError = null;
try { assert.deepEqual(after, bindings.map(({ path: name, byteLength, sha256 }) => ({ path: name, byteLength, sha256 }))); }
catch (error) { sourceBindingError = error.message; }
const receipt = { kind: 'MO1307FinalizationCorrectionCampaignReceipt', version: '1.0.0', finishedAt: new Date().toISOString(),
  result: focusedPass && queuedPass && sourceBindingError === null ? 'PASS' : 'FAIL', runtime, receipts,
  queuedExecution: focusedPass ? 'EXECUTED_ONCE' : 'NOT_RUN_AFTER_FOCUSED_FAILURE', sourceBindingsAfter: after,
  sourceInputsUnchanged: sourceBindingError === null, sourceBindingError };
write('receipt.json', Buffer.from(JSON.stringify(receipt, null, 2) + '\n'));
process.stdout.write(JSON.stringify({ result: receipt.result, focused: counts, queued: receipt.queuedExecution,
  childResults: receipts.map(row => ({ name: row.name, result: row.result, elapsedMs: row.elapsedMs })), sourceInputsUnchanged: receipt.sourceInputsUnchanged }) + '\n');
if (receipt.result !== 'PASS') process.exitCode = 1;
