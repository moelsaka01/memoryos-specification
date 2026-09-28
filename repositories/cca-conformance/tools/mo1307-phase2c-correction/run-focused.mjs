import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
assert.equal(process.version, 'v24.21.0'); assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64');
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const nodeBytes = fs.readFileSync(process.execPath);
assert.equal(nodeBytes.length, 93580104);
assert.equal(hash(nodeBytes), 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const runtime = { executable: process.execPath, version: process.version, platform: process.platform,
  arch: process.arch, byteLength: nodeBytes.length, sha256: hash(nodeBytes) };
let destination;
if (process.argv.length === 3) {
  assert.match(process.argv[2], /^attempt-[1-9][0-9]?$/);
  destination = path.join(root, 'repositories/cca-conformance/evidence/mo1307/phase2c-correction/new-protocol', process.argv[2]);
} else {
  assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output');
  const postBinding = path.resolve(root, '.cache/mo1307/phase2c-correction/post-binding');
  destination = path.resolve(root, process.argv[3]);
  const relative = path.relative(postBinding, destination);
  assert.ok(relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep)
    && !path.isAbsolute(relative), 'Explicit output must be a descendant of the post-binding cache directory');
}
fs.mkdirSync(destination, { recursive: true });
const write = (name, bytes) => { fs.writeFileSync(path.join(destination, name), bytes, { flag: 'wx' });
  return { name, byteLength: bytes.length, sha256: hash(bytes) }; };
const test = 'repositories/cca-conformance/tests/mo1307_phase2c_correction_test.mjs';
const bindings = [test, 'repositories/cca-conformance/tools/mo1307-phase2c-correction/publication-fixture.mjs',
  'repositories/memoryos-readiness/src/helper-protocol.mjs', 'repositories/memoryos-readiness/src/publication.mjs',
  'repositories/memoryos-readiness/src/constants.mjs', 'repositories/memoryos-readiness/src/canonical.mjs',
  'repositories/memoryos-readiness/src/errors.mjs', 'repositories/memoryos-readiness/src/windows-paths.mjs',
  'repositories/cca-conformance/tools/mo1307-phase2c-correction/run-focused.mjs'].map((name, index) => {
    const bytes = fs.readFileSync(path.join(root, name));
    return { path: name, byteLength: bytes.length, sha256: hash(bytes),
      retained: write(String(index + 1).padStart(2, '0') + '-' + path.basename(name) + '.data', bytes) };
  });
write('campaign.json', Buffer.from(JSON.stringify({ kind: 'MemoryOSReadinessPublicationInspectionFocusedCampaign',
  version: '1.0.0', startedAt: new Date().toISOString(), executions: 1, expectedGroups: 24,
  noAutomaticRetry: true, scope: 'FOUNDATION_PROTOCOL_AND_OWNED_PUBLICATION_FIXTURES',
  syntheticTransport: true, nativeAcquisitionCertification: false, runtime, inputs: bindings }, null, 2) + '\n'));
const started = performance.now();
const child = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-concurrency=1', test], {
  cwd: root, timeout: 60000, encoding: null, maxBuffer: 8388608, windowsHide: true,
});
const stdout = child.stdout ?? Buffer.alloc(0), stderr = child.stderr ?? Buffer.alloc(0);
const text = stdout.toString('utf8');
const tests = Number(text.match(/^# tests (\d+)$/m)?.[1] ?? 0);
const pass = Number(text.match(/^# pass (\d+)$/m)?.[1] ?? 0);
const fail = Number(text.match(/^# fail (\d+)$/m)?.[1] ?? 0);
const inputsAfter = bindings.map(({ path: name }) => {
  try { const bytes = fs.readFileSync(path.join(root, name)); return { path: name, byteLength: bytes.length, sha256: hash(bytes) }; }
  catch (error) { return { path: name, readError: error.code ?? 'READ_ERROR' }; }
});
let inputBindingError = null;
try {
  assert.deepEqual(inputsAfter, bindings.map(({ path: name, byteLength, sha256 }) => ({ path: name, byteLength, sha256 })),
    'Every focused-suite source input must remain byte-identical throughout execution');
} catch (error) { inputBindingError = { code: error.code ?? 'INPUT_BINDING_CHANGED', message: error.message }; }
const receipt = { kind: 'MemoryOSReadinessPublicationInspectionFocusedReceipt', version: '1.0.0',
  finishedAt: new Date().toISOString(), elapsedMs: Math.round((performance.now() - started) * 1000) / 1000,
  status: child.status, signal: child.signal, error: child.error ? { code: child.error.code, message: child.error.message } : null,
  runtime, inputsAfter, inputsUnchanged: inputBindingError === null, inputBindingError,
  tests, pass, fail, result: !child.error && inputBindingError === null && child.status === 0 && tests === 24 && pass === 24 && fail === 0 ? 'PASS' : 'FAIL',
  logs: [write('stdout.txt', stdout), write('stderr.txt', stderr)] };
write('receipt.json', Buffer.from(JSON.stringify(receipt, null, 2) + '\n'));
process.stdout.write(JSON.stringify(receipt) + '\n');
if (receipt.result !== 'PASS') process.exitCode = 1;
