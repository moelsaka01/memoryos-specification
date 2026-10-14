import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { helperLaunchSpecification } from '../../../memoryos-readiness/src/helper-transport.mjs';
import { canonicalBytes } from '../../../memoryos-readiness/src/canonical.mjs';
import { encodeHelperRequest, decodeHelperResponse } from '../../../memoryos-readiness/src/helper-protocol.mjs';
import { root, absolute, beginCampaign, verifyBindings, finishCampaign, selectedFilesystemCases } from './validation-bindings.mjs';

const context = beginCampaign('native-filesystem');
const attemptName = 'headless-cleanup-native-filesystem';
const receiptRoot = absolute(context.output);
const expectedCases = selectedFilesystemCases(context.manifest.filesystem.shortAlias);
assert.deepEqual(expectedCases, context.manifest.filesystem.cases);
const sandbox = path.join(root, '.cache', 'mo1307-headless-cleanup', 'filesystem-' + process.pid);
fs.mkdirSync(sandbox, { recursive: true });
const input = path.join(sandbox, 'input'); fs.mkdirSync(input);
const output = path.join(sandbox, 'output');
const helper = path.join(root, 'repositories/memoryos-readiness/helpers/windows-inspect.ps1');
const specification = helperLaunchSpecification();
const session = 'a1'.repeat(32);
const rows = []; const invocations = []; let failed = null;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const put = (name, bytes) => fs.writeFileSync(path.join(receiptRoot, name), bytes, { flag: 'wx' });
put('helper.ps1.data', fs.readFileSync(helper));
put('campaign.json', JSON.stringify({ attemptName, source: context.manifestBinding, sourceIdentity: context.manifest.sourceIdentity,
  componentOrigin: { commit: 'defe93989efc6501b1a730b82e79e705884b269b', path: 'repositories/cca-conformance/tools/mo1307-phase2c-final-native/helper-filesystem.mjs' },
  helperSha256: hash(fs.readFileSync(helper)), policy: 'Finite predeclared ordered tests; stop on first unexpected result; preserve every invocation; no automatic retry.',
  cases: expectedCases, shortAlias: context.manifest.filesystem.shortAlias, expectedHelperInvocations: context.manifest.filesystem.expectedHelperInvocations,
  timeoutMs: 5000, responseBytes: 16777216, nativeWindowsOnly: true, launch: specification,
  launchSourceSha256: hash(fs.readFileSync(new URL("../../../memoryos-readiness/src/helper-transport.mjs", import.meta.url))) }, null, 2) + '\n');
function rawFrame(value) {
  const body = typeof value === 'string' ? Buffer.from(value) : canonicalBytes(value);
  const prefix = Buffer.alloc(4); prefix.writeUInt32BE(body.length); return Buffer.concat([prefix, body]);
}
function request(sequence, operation = 'READ_SET', files = []) {
  return { kind: 'MemoryOSReadinessHelperRequest', version: '2.0.0', session, sequence, operation,
    roots: [{ id: operation === 'READ_SET' ? 'input' : 'output', path: operation === 'READ_SET' ? input : output }], files };
}
const file = (id, cap = 2097152, relative = id + '.bin') => ({ id, maxBytes: cap, path: relative, root: 'input' });
function run(frame, req = null) {
  verifyBindings(context);
  const index = String(invocations.length + 1).padStart(3, '0');
  put(index + '.request.bin', frame);
  const start = performance.now();
  const child = spawnSync(specification.executable, [...specification.args], {
    ...specification.options, input: frame, encoding: null, timeout: 5000,
    maxBuffer: 16777216, env: { ...specification.options.env }, stdio: [...specification.options.stdio],
  });
  const durationMs = performance.now() - start;
  put(index + '.response.bin', child.stdout ?? Buffer.alloc(0)); put(index + '.stderr.txt', child.stderr ?? Buffer.alloc(0));
  invocations.push({ index, durationMs, exitCode: child.status, signal: child.signal, error: child.error?.code ?? null,
    requestBytes: frame.length, responseBytes: child.stdout?.length ?? 0, stderrBytes: child.stderr?.length ?? 0,
    requestSha256: hash(frame), responseSha256: hash(child.stdout ?? Buffer.alloc(0)) });
  put(index + '.invocation.json', JSON.stringify(invocations.at(-1), null, 2) + '\n');
  assert.ifError(child.error); assert.equal(child.status, 0); assert.equal(child.signal, null); assert.equal(child.stderr.length, 0); assert.ok(durationMs < 5000);
  assert.ok(child.stdout.length >= 4 && child.stdout.length <= 16777216, 'Exactly one bounded response frame');
  assert.equal(child.stdout.readUInt32BE(0), child.stdout.length - 4, 'Exact stdout frame prefix and body length');
  return req ? decodeHelperResponse(child.stdout, req) : JSON.parse(child.stdout.subarray(4));
}
function check(name, action) {
  const started = performance.now();
  try { assert.equal(name, expectedCases[rows.length], 'Predeclared case order'); verifyBindings(context); const detail = action(); rows.push({ name, outcome: 'PASS', durationMs: performance.now() - started, detail: detail ?? null }); }
  catch (error) { rows.push({ name, outcome: 'FAIL', durationMs: performance.now() - started, error: String(error.stack) }); throw error; }
}
function okay(req) { const response = run(encodeHelperRequest(req), req); assert.equal(response.code, null); return response; }
function reject(req, code = 'MO1307_FILESYSTEM_BOUNDARY') {
  const response = run(rawFrame(req)); assert.equal(response.status, 'ERROR'); assert.equal(response.code, code);
  assert.deepEqual(response.roots, []); assert.deepEqual(response.files, []);
}
try {
  fs.writeFileSync(path.join(input, 'a.bin'), Buffer.from([0, 1, 2, 127, 128, 255]));
  check('native READ_SET same-handle bytes and seven-field identity', () => {
    const response = okay(request(3, 'READ_SET', [file('a')]));
    assert.deepEqual(Buffer.from(response.files[0].bytes.join(''), 'base64'), fs.readFileSync(path.join(input, 'a.bin')));
    assert.equal(response.files[0].identity.linkCount, 1);
    assert.deepEqual(Object.keys(response.files[0].identity).sort(), ['attributes', 'byteLength', 'fileId', 'finalPath', 'isDirectory', 'linkCount', 'volumeSerial']);
    return { roots: response.roots, file: response.files[0].identity };
  });
  if (!attemptName.startsWith('smoke')) {
    let parent; let created; let staged;
    check('native CHECK_OUTPUT slots4/5 full stable drive-parent chains', () => {
      const a = okay(request(4, 'CHECK_OUTPUT')); assert.equal(a.status, 'ABSENT');
      const b = okay(request(5, 'CHECK_OUTPUT')); assert.equal(b.status, 'ABSENT');
      assert.deepEqual(a.roots, b.roots); parent = b.roots[0].chain;
      assert.equal(parent[0].finalPath.toLowerCase(), path.parse(output).root.toLowerCase());
      return { length: parent.length, chain: parent };
    });
    fs.mkdirSync(output);
    check('native INSPECT_OUTPUT_ROOT and CHECK_STAGE_ROOT stable full chain', () => {
      const a = okay(request(6, 'INSPECT_OUTPUT_ROOT')); const b = okay(request(7, 'CHECK_STAGE_ROOT'));
      assert.deepEqual(a.roots, b.roots); created = b.roots[0].chain; assert.deepEqual(created.slice(0, -1), parent);
      return { length: created.length, chain: created };
    });
    fs.writeFileSync(path.join(output, 'memoryos-readiness-result.json.pending'), '{}\n', { flag: 'wx' });
    check('native INSPECT_PENDING and CHECK_FINALIZATION stable full chain/final absence', () => {
      const a = okay(request(8, 'INSPECT_PENDING')); const b = okay(request(9, 'CHECK_FINALIZATION'));
      assert.equal(b.status, 'FINAL_ABSENT'); assert.deepEqual(a.roots, b.roots); staged = b.roots[0].chain;
      assert.deepEqual(staged.slice(0, -1), created); assert.equal(staged.at(-1).byteLength, 3);
      return { length: staged.length, chain: staged };
    });
    check('existing output rejected by native absence', () => reject(request(4, 'CHECK_OUTPUT')));
    fs.writeFileSync(path.join(output, 'memoryos-readiness-result.json'), 'existing');
    check('existing final rejected by native absence', () => reject(request(9, 'CHECK_FINALIZATION')));
    check('changed pending identity observed natively', () => {
      const pending = path.join(output, 'memoryos-readiness-result.json.pending'); fs.renameSync(pending, pending + '.old'); fs.writeFileSync(pending, '{}\n');
      const changed = okay(request(8, 'INSPECT_PENDING')).roots[0].chain;
      assert.notEqual(changed.at(-1).fileId, staged.at(-1).fileId);
      return { before: staged.at(-1), after: changed.at(-1) };
    });
    for (const [name, value] of [['traversal', '../a.bin'], ['ADS', 'a.bin:stream']]) check(name + ' native request rejection', () => reject(request(3, 'READ_SET', [file('a', 2097152, value)])));
    for (const [name, value] of [['drive-relative', 'C:relative'], ['UNC', '\\\\server\\share'], ['device', '\\\\?\\C:\\data']]) check(name + ' native request rejection', () => {
      const req = request(3, 'READ_SET', [file('a')]); req.roots[0].path = value; reject(req);
    });
    check('missing ancestor rejected', () => reject(request(3, 'READ_SET', [file('missing', 1, 'missing/a.bin')])));
    check('missing leaf is INPUT rather than absent success', () => reject(request(3, 'READ_SET', [file('missing')]), 'MO1307_INPUT'));
    fs.mkdirSync(path.join(input, 'wrong.bin'));
    check('directory used as file rejected', () => reject(request(3, 'READ_SET', [file('wrong')])));
    fs.linkSync(path.join(input, 'a.bin'), path.join(input, 'hard.bin'));
    check('hardlinked input rejected', () => reject(request(3, 'READ_SET', [file('hard')])));
    fs.writeFileSync(path.join(input, 'target.bin'), 'target'); fs.mkdirSync(path.join(input, 'target-directory'));
    fs.symlinkSync(path.join(input, 'target.bin'), path.join(input, 'link.bin'), 'file');
    check('file symlink rejected', () => reject(request(3, 'READ_SET', [file('link')])));
    fs.symlinkSync(path.join(input, 'target-directory'), path.join(input, 'directory-link'), 'dir');
    check('directory symlink ancestor rejected', () => reject(request(3, 'READ_SET', [file('link', 1, 'directory-link/a.bin')])));
    fs.symlinkSync(path.join(input, 'target-directory'), path.join(input, 'junction'), 'junction');
    check('junction ancestor rejected', () => reject(request(3, 'READ_SET', [file('link', 1, 'junction/a.bin')])));
    fs.writeFileSync(path.join(input, 'large.bin'), Buffer.alloc(2097152, 0x61));
    check('2MiB read and canonical base64 chunks within fixed deadline', () => {
      const res = okay(request(3, 'READ_SET', [file('large')])); assert.equal(res.files[0].identity.byteLength, 2097152);
      assert.equal(Buffer.from(res.files[0].bytes.join(''), 'base64').length, 2097152);
    });
    check('per-file decoded cap rejection', () => reject(request(3, 'READ_SET', [file('large', 2097151)]), 'MO1307_RESOURCE_LIMIT'));
    check('existing pending exclusive creation refuses overwrite', () => {
      const pending = path.join(output, 'memoryos-readiness-result.json.pending');
      const before = fs.readFileSync(pending);
      assert.throws(() => fs.openSync(pending, 'wx'), error => error.code === 'EEXIST');
      assert.deepEqual(fs.readFileSync(pending), before);
      const native = okay(request(8, 'INSPECT_PENDING'));
      assert.equal(native.roots[0].chain.at(-1).byteLength, before.length);
    });
    const { alias: shortAlias, canonicalPath, applicable } = context.manifest.filesystem.shortAlias;
    if (applicable) {
        check('existing native short alias rejected for wrong final handle path', () => {
          const normal = request(3); normal.roots[0].path = canonicalPath;
          assert.equal(okay(normal).roots[0].identity.finalPath.toLowerCase(), canonicalPath.toLowerCase());
          const alias = request(3); alias.roots[0].path = shortAlias; reject(alias);
          return { alias: shortAlias, nativeCanonicalPath: canonicalPath };
        });
    }
    const req = request(3, 'READ_SET', [file('target')]);
    for (const [name, mutate] of [['wrong version', x => x.version = '1.0.0'], ['wrong session', x => x.session = 'F'.repeat(64)], ['wrong sequence', x => x.sequence = 10], ['wrong operation', x => x.operation = 'EXEC'], ['unknown field', x => x.secret = 'NATIVE_CREDENTIAL_SENTINEL']]) check(name + ' rejects', () => { const value = structuredClone(req); mutate(value); reject(value, 'MO1307_INPUT'); });
    const canonical = Buffer.from(canonicalBytes(req)).toString();
    for (const [name, body] of [['duplicate key', canonical.replace('"sequence":3', '"sequence":3,"sequence":3')], ['noncanonical body', ' ' + canonical]]) check(name + ' rejects', () => assert.equal(run(rawFrame(body)).code, 'MO1307_INPUT'));
    const frame = encodeHelperRequest(req);
    for (const [name, bytes] of [['truncated frame', frame.subarray(0, -1)], ['extra frame', Buffer.concat([frame, frame])], ['trailing bytes', Buffer.concat([frame, Buffer.from([0])])]]) check(name + ' rejects', () => assert.equal(run(bytes).code, 'MO1307_INPUT'));
    check('oversized request rejects', () => { const header = Buffer.alloc(4); header.writeUInt32BE(65533); assert.equal(run(header).code, 'MO1307_RESOURCE_LIMIT'); });
  }
  assert.deepEqual(rows.map(row => row.name), expectedCases);
  assert.equal(invocations.length, context.manifest.filesystem.expectedHelperInvocations);
} catch (error) { failed = String(error.stack); process.exitCode = 1; }
finally {
  finishCampaign(context, { suite: 'native-filesystem', result: failed === null ? 'PASS' : 'FAIL', attemptName,
    runtime: { version: process.version, platform: process.platform, arch: process.arch },
    rows, invocations, passed: rows.filter(x => x.outcome === 'PASS').length, failed: rows.filter(x => x.outcome === 'FAIL').length,
    stopped: failed !== null, failure: failed, notRun: expectedCases.filter(name => !rows.some(row => row.name === name)),
    shortAlias: context.manifest.filesystem.shortAlias,
    limitations: ['Internal native component checks execute in every real helper; deterministic adversarial concurrent namespace mutation is excluded by private immutable-root precondition.', 'Cross-slot equality rejection belongs to protocol/publication tests; this witness records actual native changes.', 'No other-volume fixture created; reparse mount/junction and final-handle-path validation remain fixed native checks.', 'Conditional short-alias applicability was inspected and bound before this generation; it is never reported PASS when absent.'] });
}
