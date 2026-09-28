import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { helperLaunchSpecification } from '../../../memoryos-readiness/src/helper-transport.mjs';
import { encodeHelperRequest, decodeHelperResponse } from '../../../memoryos-readiness/src/helper-protocol.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const [receiptRoot, mode, fixtureRoot] = process.argv.slice(2);
assert.ok(receiptRoot && path.isAbsolute(receiptRoot));
assert.ok(receiptRoot.startsWith(path.join(root, 'repositories/cca-conformance/evidence/mo1307/phase2c-final/')));
assert.ok(['final-path', 'acl-denied', 'acl-restored'].includes(mode));
fs.mkdirSync(receiptRoot, { recursive: false });
const launch = helperLaunchSpecification();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const put = (leaf, bytes) => fs.writeFileSync(path.join(receiptRoot, leaf), bytes, { flag: 'wx' });
const invocations = []; let failure = null;
put('campaign.json', JSON.stringify({ mode, launch, helperSha256: hash(fs.readFileSync(launch.args.at(-1))), policy: 'Finite explicit native calls; stop on first unexpected result; no retry.' }, null, 2) + '\n');
function native(rootPath, operation, expected) {
  const request = { kind: 'MemoryOSReadinessHelperRequest', version: '2.0.0', session: 'ab'.repeat(32), sequence: operation === 'READ_SET' ? 3 : 4, operation,
    roots: [{ id: operation === 'READ_SET' ? 'input' : 'output', path: rootPath }], files: [] };
  const frame = encodeHelperRequest(request), started = performance.now();
  const child = spawnSync(launch.executable, [...launch.args], { ...launch.options, env: { ...launch.options.env }, input: frame, timeout: 5000, maxBuffer: 16777216 });
  const ordinal = String(invocations.length + 1).padStart(3, '0');
  put(ordinal + '.request.bin', frame); put(ordinal + '.response.bin', child.stdout ?? Buffer.alloc(0)); put(ordinal + '.stderr.txt', child.stderr ?? Buffer.alloc(0));
  const row = { rootPath, operation, expected, durationMs: performance.now() - started, exitCode: child.status, error: child.error?.code ?? null, stdoutBytes: child.stdout?.length ?? 0, stderrBytes: child.stderr?.length ?? 0 }; invocations.push(row);
  assert.ifError(child.error); assert.equal(child.status, 0); assert.equal(child.stderr.length, 0); assert.ok(row.durationMs < 5000);
  const response = decodeHelperResponse(child.stdout, request); row.status = response.status; row.code = response.code;
  assert.equal(response.status, expected);
  if (expected === 'ERROR') { assert.equal(response.code, 'MO1307_FILESYSTEM_BOUNDARY'); assert.deepEqual(response.roots, []); assert.deepEqual(response.files, []); }
  return response;
}
try {
  if (mode === 'final-path') {
    const canonical = native('C:\\Program Files', 'READ_SET', 'OK');
    assert.equal(canonical.roots[0].identity.finalPath.toLowerCase(), 'c:\\program files');
    native('C:\\PROGRA~1', 'READ_SET', 'ERROR');
  } else {
    const intended = path.join(root, '.cache/mo1307-final-native/acl-guard-01');
    assert.equal(fixtureRoot, intended);
    native(path.join(fixtureRoot, 'absent-output'), 'CHECK_OUTPUT', mode === 'acl-denied' ? 'ERROR' : 'ABSENT');
  }
} catch (error) { failure = { message: String(error.message), stack: String(error.stack) }; process.exitCode = 1; }
finally { put('receipt.json', JSON.stringify({ kind: 'MO1307FinalNativeSupplement', mode, result: failure ? 'FAIL' : 'PASS', failure, invocations }, null, 2) + '\n'); console.log(JSON.stringify({ mode, result: failure ? 'FAIL' : 'PASS', invocations: invocations.length, receiptRoot })); }