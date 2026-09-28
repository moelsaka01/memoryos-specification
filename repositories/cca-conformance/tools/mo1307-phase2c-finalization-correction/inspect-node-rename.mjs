import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64'); assert.equal(process.version, 'v24.21.0');
const runtimeBytes = fs.readFileSync(process.execPath);
assert.equal(runtimeBytes.length, 93580104);
assert.equal(hash(runtimeBytes), 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const functions = [['fs.promises.rename', fsp.rename, 2], ['fs.rename', fs.rename, 3], ['fs.renameSync', fs.renameSync, 2]]
  .map(([name, fn, parameters]) => {
    assert.equal(fn.length, parameters);
    const source = Function.prototype.toString.call(fn), bytes = Buffer.from(source, 'utf8');
    assert.doesNotMatch(source, /AbortSignal|signal|\bcancel\b/);
    assert.match(source, /binding\.rename\(/);
    return { name, declaredParameterCount: fn.length, source, byteLength: bytes.length, sha256: hash(bytes) };
  });
const receipt = { kind: 'MO1307PinnedNodeRenameApiEvidence', version: '1.0.0', observedAt: new Date().toISOString(),
  runtime: { path: process.execPath, version: process.version, platform: process.platform, arch: process.arch,
    byteLength: runtimeBytes.length, sha256: hash(runtimeBytes) }, functions,
  findings: ['The pinned fs.promises.rename wrapper has only oldPath/newPath parameters and directly awaits binding.rename; it accepts no AbortSignal option.',
    'The callback wrapper passes one FSReqCallback to binding.rename; the synchronous wrapper invokes binding.rename directly. Neither wrapper exposes cancellation.',
    'A synchronous call blocks JavaScript observation and does not create a hard native execution bound.',
    'Racing a promise or moving a rename to a worker/child has not demonstrated cancellation of an already-submitted native namespace mutation.'],
  limitations: ['Local public-wrapper evidence only; no claim that all possible Win32 mechanisms are universally incapable of cancellation.',
    'No rename, process, worker, native sidecar, network call or unbounded experiment was run by this inspection.'] };
const destination = path.join(root, 'repositories/cca-conformance/evidence/mo1307/phase2c-finalization-correction/local-api-evidence.json');
fs.writeFileSync(destination, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ result: 'PASS', inspectedFunctions: functions.length, runtimeHashVerified: true }) + '\n');
