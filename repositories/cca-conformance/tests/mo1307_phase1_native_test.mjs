import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DEFINITIONS as D } from '../../memoryos-readiness/src/constants.mjs';
import { canonicalBytes } from '../../memoryos-readiness/src/canonical.mjs';
import { ReadinessError } from '../../memoryos-readiness/src/errors.mjs';
import { helperLaunchSpecification } from '../../memoryos-readiness/src/helper-transport.mjs';
import { validateRelativeFile, validateAbsoluteRoot, resolveContained, assertDistinctRoots,
  assertDistinctFiles, validateIdentityRecord, assertStableIdentity, assertComponentChain } from '../../memoryos-readiness/src/windows-paths.mjs';
import { parseCliArgs, validateLaunch } from '../../memoryos-readiness/src/cli-args.mjs';
import { encodeHelperRequest, decodeHelperRequest, encodeHelperResponse, decodeHelperResponse,
  validateHelperRequest, createHelperSequence } from '../../memoryos-readiness/src/helper-protocol.mjs';
import { createPublication, stagePublication, finalizePublication } from '../../memoryos-readiness/src/publication.mjs';
import { fixtureInspection, fixtureInspect, fixtureSession, syntheticChain, fixtureRequest } from '../tools/mo1307-phase2c-correction/publication-fixture.mjs';

const cwd = fileURLToPath(new URL('../../../', import.meta.url));
const packageRoot = path.join(cwd, 'repositories', 'memoryos-readiness');
const cli = path.join(packageRoot, 'bin', 'memoryos-readiness.mjs');
const helper = path.join(packageRoot, 'helpers', 'windows-inspect.ps1');
const trustedWindows = 'C:\\Windows'; // Actual native test host installation, never product discovery.
const powershell = path.join(trustedWindows, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const cleanEnv = { SystemRoot: trustedWindows, WINDIR: trustedWindows };
const attempt = path.join(cwd, '.cache', 'mo1307', 'phase1', `native-foundation-${process.pid}`);
const digest = 'sha256:' + '0'.repeat(64);
const code = (fn, expected) => assert.throws(fn, error => error.code === 'MO1307_' + expected);
const rejects = (fn, expected) => assert.rejects(fn, error => error.code === 'MO1307_' + expected);
function args(command = 'evaluate') {
  return [command, '--input-root', 'C:\\Input', '--config', 'config.json', '--authority', 'authority.json',
    '--authority-sha256', digest, '--candidate-sha256', digest,
    command === 'evaluate' ? '--output-root' : '--result-root', 'C:\\Output'];
}
function identity(finalPath, directory = false, overrides = {}) {
  return { attributes: directory ? 16 : 32, byteLength: 0, fileId: '0000000000000001',
    finalPath, isDirectory: directory, linkCount: 1, volumeSerial: '00000001', ...overrides };
}
function request(sequence = 1, command = 'evaluate') {
  const roots = [{ id: 'input', path: 'C:\\Input' }];
  const file = (id, cap, root = 'input') => ({ id, maxBytes: cap, path: id + '.json', root });
  const files = sequence === 1 ? [file('authority', D.limits.authorityBytes), file('config', D.limits.configurationBytes)]
    : sequence === 2 ? [file('candidate', D.limits.candidateBytes), file('manifest', D.limits.manifestBytes)]
      : sequence === 3 ? [file('evidence', D.limits.rawSourceBytes)]
        : command === 'verify' ? [file('result', D.limits.resultBytes, 'result')] : [];
  return { kind: 'MemoryOSReadinessHelperRequest', version: '2.0.0', session: fixtureSession, sequence,
    operation: sequence === 4 && command === 'evaluate' ? 'CHECK_OUTPUT' : 'READ_SET',
    roots: sequence === 4 ? [{ id: command === 'evaluate' ? 'output' : 'result', path: 'C:\\Output' }] : roots,
    files };
}
function errorResponse(req, error = 'MO1307_INTERNAL') {
  return { kind: 'MemoryOSReadinessHelperResponse', version: '2.0.0', session: req.session, sequence: req.sequence,
    operation: req.operation, status: 'ERROR', code: error, roots: [], files: [] };
}
function successResponse(req, bytes = Buffer.from('x')) {
  return { kind: 'MemoryOSReadinessHelperResponse', version: '2.0.0', session: req.session, sequence: req.sequence,
    operation: req.operation, status: req.operation === 'READ_SET' ? 'OK' : 'ABSENT', code: null,
    roots: req.operation === 'READ_SET' ? req.roots.map(root => ({ id: root.id, identity: identity(root.path, true) }))
      : [{ id: 'output-parent', chain: syntheticChain('C:\\') }],
    files: req.files.map(file => {
      const root = req.roots.find(root => root.id === file.root);
      const encoded = bytes.toString('base64');
      return { id: file.id, identity: identity(resolveContained(root.path, file.path), false, { byteLength: bytes.length }),
        bytes: encoded.match(/.{1,4096}/g) ?? [] };
    }) };
}
function rawFrame(value) {
  const body = canonicalBytes(value, { maxBytes: D.limits.helperResponseBytes });
  const header = Buffer.alloc(4); header.writeUInt32BE(body.length); return Buffer.concat([header, body]);
}
let helperAttempt = 0;
function runHelper(frame) {
  const specification = helperLaunchSpecification();
  assert.equal(specification.executable, powershell);
  assert.deepEqual(specification.args, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper]);
  assert.deepEqual(specification.options.env, cleanEnv);
  assert.equal(specification.options.shell, false);
  assert.equal(specification.options.windowsHide, true);
  assert.equal(specification.options.detached, false);
  const child = spawnSync(specification.executable, [...specification.args], {
    ...specification.options, env: { ...specification.options.env }, stdio: [...specification.options.stdio],
    input: frame, encoding: null, timeout: D.limits.helperDeadlineMs,
    maxBuffer: D.limits.helperResponseBytes,
  });
  helperAttempt += 1;
  mkdirSync(attempt, { recursive: true });
  writeFileSync(path.join(attempt, `helper-${helperAttempt}.request`), frame, { flag: 'wx' });
  writeFileSync(path.join(attempt, `helper-${helperAttempt}.stdout`), child.stdout ?? Buffer.alloc(0), { flag: 'wx' });
  writeFileSync(path.join(attempt, `helper-${helperAttempt}.stderr`), child.stderr ?? Buffer.alloc(0), { flag: 'wx' });
  assert.ifError(child.error); assert.equal(child.status, 0); assert.equal(child.stderr.length, 0);
  return child.stdout;
}

test('N01 pinned native runtime and fixed PowerShell installation', async () => {
  assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64'); assert.equal(process.version, 'v24.21.0');
  assert.equal((await fs.stat(powershell)).isFile(), true);
});
test('N02 closed CLI commands and defaults', () => {
  const evaluate = parseCliArgs(args()); assert.equal(evaluate.format, 'json'); assert.equal(evaluate.decision, null);
  assert.equal(parseCliArgs([...args('verify'), '--decision', 'decision.json', '--format', 'text']).format, 'text');
});
test('N03 prototype-sensitive and invented commands reject as usage', () => {
  for (const command of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'evaluateReadiness', 'help', '--help', '--version']) {
    code(() => parseCliArgs(args(command)), 'USAGE');
  }
});
test('N04 duplicate unknown missing extra flags reject', () => {
  for (const argv of [[...args(), '--format', 'json', '--format', 'text'], [...args(), '--help'],
    args().slice(0, -1), [...args(), 'extra'], [...args(), '--format', 'xml'], [...args(), '--decision', 'd.json'],
    [...args(), '--__proto__', 'x'], args().map(x => x === digest ? digest.toUpperCase() : x)]) code(() => parseCliArgs(argv), 'USAGE');
});
test('N05 forbidden runtime environment and Node options reject before I/O', () => {
  const launch = { platform: 'win32', arch: 'x64', version: 'v24.21.0', execArgv: [], environment: {} };
  validateLaunch(launch);
  for (const extra of [{ environment: { NODE_OPTIONS: '' } }, { environment: { node_path: 'x' } },
    { execArgv: ['--inspect'] }, { execArgv: ['--require=evil'] }, { version: 'v24.20.0' }, { platform: 'linux' }]) {
    code(() => validateLaunch({ ...launch, ...extra }), 'USAGE');
  }
});
test('N04b inspectable configuration path failures select lowest logical ID', () => {
  const argv = args().map(value => value === 'config.json' || value === 'authority.json' ? '../invalid' : value);
  assert.throws(() => parseCliArgs(argv), error => error.code === 'MO1307_FILESYSTEM_BOUNDARY'
    && error.stage === 'CONFIGURATION' && error.reference === 'authority');
});
test('N06 relative lexical boundaries and hostile spellings', () => {
  validateRelativeFile('a'.repeat(180)); code(() => validateRelativeFile('a'.repeat(181)), 'FILESYSTEM_BOUNDARY');
  for (const value of ['', '.', '..', 'a/../b', '/a', 'a//b', 'a\\b', 'C:a', 'a:stream', 'a.', 'a ',
    'CON', 'con.txt', 'NUL.json', 'com1.dat', 'LPT9.x', 'x/PRN', 'é.json', '\\\\server\\file', '\\\\?\\C:\\x']) {
    code(() => validateRelativeFile(value), 'FILESYSTEM_BOUNDARY');
  }
});
test('N07 absolute roots full paths overlap and case aliases', () => {
  validateAbsoluteRoot('C:\\Private data\\é'); validateAbsoluteRoot('C:\\');
  assert.equal(validateAbsoluteRoot('C:/Private data/é'), 'C:\\Private data\\é');
  assert.equal(parseCliArgs(args().map(value => value.replaceAll('\\', '/'))).inputRoot, 'C:\\Input');
  for (const root of ['C:relative', '/tmp', '\\\\server\\share', '\\\\?\\C:\\x', 'C:\\x\\..\\y', 'C:\\x.',
    'C:\\x:stream', 'C:\\x\\', 'C:\\x\\\\y', 'C:\\LPT¹', 'C:/x/../y']) code(() => validateAbsoluteRoot(root), 'FILESYSTEM_BOUNDARY');
  assert.equal(resolveContained('C:\\' + 'a'.repeat(235), 'b').length, 240);
  code(() => resolveContained('C:\\' + 'a'.repeat(236), 'b'), 'FILESYSTEM_BOUNDARY');
  for (const roots of [['C:\\Data', 'c:\\data'], ['C:\\Data', 'C:\\Data\\nested'], ['C:\\', 'C:\\Input']]) code(() => assertDistinctRoots(roots), 'FILESYSTEM_BOUNDARY');
  assertDistinctRoots(['C:\\Data', 'C:\\Database']);
  code(() => assertDistinctFiles(['A.json', 'a.json']), 'FILESYSTEM_BOUNDARY');
});
test('N08 identity policy rejects any reparse flag hardlink wrong type and changes', () => {
  validateIdentityRecord(identity('C:\\Input\\f.json'));
  for (const changes of [{ attributes: 32 | 0x400 }, { linkCount: 2 }, { isDirectory: true, attributes: 16 },
    { finalPath: '\\\\?\\C:\\Input\\f.json' }, { extra: 1 }]) {
    code(() => validateIdentityRecord(identity('C:\\Input\\f.json', false, changes)), 'FILESYSTEM_BOUNDARY');
  }
  code(() => assertStableIdentity(identity('C:\\Input\\f.json'), identity('C:\\Input\\f.json', false, { fileId: '0000000000000002' })), 'FILESYSTEM_BOUNDARY');
  const chain = [identity('C:\\', true), identity('C:\\Input', true), identity('C:\\Input\\f.json')];
  assertComponentChain('C:\\Input', 'f.json', chain);
  code(() => assertComponentChain('C:\\Input', 'f.json', chain.slice(1)), 'FILESYSTEM_BOUNDARY');
});
test('N09 helper canonical round-trip and closed operation fields', () => {
  for (let sequence = 1; sequence <= 4; sequence++) assert.deepEqual(JSON.parse(JSON.stringify(decodeHelperRequest(encodeHelperRequest(request(sequence))))), request(sequence));
  for (const change of [{ operation: 'EXEC' }, { sequence: 5 }, { command: 'Get-Content' }, { files: [] }]) {
    code(() => validateHelperRequest({ ...request(), ...change }), 'INPUT');
  }
});
test('N10 helper frame prefix truncation trailing data and caps', () => {
  const frame = encodeHelperRequest(request());
  code(() => decodeHelperRequest(frame.subarray(0, -1)), 'INPUT');
  code(() => decodeHelperRequest(Buffer.concat([frame, Buffer.from([0])])), 'INPUT');
  const large = Buffer.alloc(4); large.writeUInt32BE(65533); code(() => decodeHelperRequest(large), 'RESOURCE_LIMIT');
  code(() => decodeHelperRequest(new Uint8Array(new SharedArrayBuffer(4))), 'INPUT');
});
test('N11 helper sorted explicit allowlist path and per-file boundaries', () => {
  const req = request(3); req.files = Array.from({ length: 128 }, (_, i) => ({ id: 'f' + String(i).padStart(3, '0'), root: 'input', path: `f${i}.json`, maxBytes: 2097152 }));
  validateHelperRequest(req); req.files.push({ id: 'z', root: 'input', path: 'z.json', maxBytes: 1 });
  code(() => validateHelperRequest(req), 'RESOURCE_LIMIT');
  const oversized = request(3); oversized.files[0].maxBytes++; code(() => validateHelperRequest(oversized), 'RESOURCE_LIMIT');
  const swapped = request(); swapped.files.reverse(); code(() => validateHelperRequest(swapped), 'INPUT');
  const alias = request(); alias.files[1].path = 'AUTHORITY.json'; code(() => validateHelperRequest(alias), 'FILESYSTEM_BOUNDARY');
});
test('N12 acquisition needs four serial exits and invalid overlap or retry is terminal', () => {
  const sequence = createHelperSequence('evaluate', { session: fixtureSession });
  for (let step = 1; step <= 4; step++) {
    const req = request(step); sequence.begin(req);
    sequence.complete(encodeHelperResponse(successResponse(req), req)); sequence.helperExited();
  }
  code(() => sequence.begin(request(4)), 'INPUT');
  const overlap = createHelperSequence('evaluate', { session: fixtureSession }); const first = request(); overlap.begin(first);
  code(() => overlap.begin(first), 'INPUT'); code(() => overlap.complete(encodeHelperResponse(successResponse(first), first)), 'INPUT');
  const failed = createHelperSequence('verify', { session: fixtureSession }); failed.begin(first);
  failed.complete(encodeHelperResponse(errorResponse(first), first)); code(() => failed.begin(request(2)), 'INPUT');
});
test('N13 helper response exact snapshot identity and base64 validation', () => {
  const req = request(3); const response = successResponse(req, Buffer.alloc(5000, 0x61));
  assert.equal(decodeHelperResponse(encodeHelperResponse(response, req), req).files[0].identity.byteLength, 5000);
  const corrupt = structuredClone(response); corrupt.files[0].bytes[0] = '!'.repeat(4096);
  code(() => encodeHelperResponse(corrupt, req), 'INPUT');
  const wrong = structuredClone(response); wrong.files[0].identity.finalPath = 'C:\\Elsewhere\\evidence.json';
  code(() => encodeHelperResponse(wrong, req), 'FILESYSTEM_BOUNDARY');
});
test('N14 helper decoded aggregate boundary and +1', () => {
  const req = request(3); req.files = Array.from({ length: 5 }, (_, i) => ({ id: `f${i}`, root: 'input', path: `f${i}.dat`, maxBytes: 2097152 }));
  const response = successResponse(req, Buffer.alloc(2097152));
  response.files[4] = { ...response.files[4], bytes: [], identity: { ...response.files[4].identity, byteLength: 0 } };
  decodeHelperResponse(encodeHelperResponse(response, req), req);
  response.files[4].bytes = ['AA==']; response.files[4].identity.byteLength = 1;
  code(() => encodeHelperResponse(response, req), 'RESOURCE_LIMIT');
});
test('N15 native fixed PowerShell snapshots and checked inspection sanitization', async () => {
  const input = path.join(attempt, 'native-input'), result = path.join(attempt, 'native-result'), output = path.join(attempt, 'native-output');
  await fs.mkdir(input, { recursive: true }); await fs.mkdir(result, { recursive: true });
  for (const leaf of ['authority', 'config', 'candidate', 'manifest', 'evidence']) await fs.writeFile(path.join(input, leaf + '.json'), '{}\n');
  await fs.writeFile(path.join(result, 'result.json'), '{}\n');
  for (const req of [request(1), request(2), request(3), request(4, 'verify')]) {
    req.roots[0].path = req.sequence === 4 ? result : input;
    const response = decodeHelperResponse(runHelper(encodeHelperRequest(req)), req);
    assert.equal(response.code, null); assert.equal(response.status, 'OK');
    for (const entry of response.files) assert.equal(Buffer.from(entry.bytes.join(''), 'base64').toString(), '{}\n');
  }
  for (const slot of [4, 5]) {
    const req = fixtureRequest(slot, 'evaluate', output);
    const response = decodeHelperResponse(runHelper(encodeHelperRequest(req)), req);
    assert.equal(response.status, 'ABSENT'); assert.ok(response.roots[0].chain.length > 1);
  }
  await fs.mkdir(output);
  for (const slot of [6, 7]) {
    const req = fixtureRequest(slot, 'evaluate', output);
    assert.equal(decodeHelperResponse(runHelper(encodeHelperRequest(req)), req).status, 'OK');
  }
  await fs.writeFile(path.join(output, D.filenames.pendingResult), '{}\n');
  for (const slot of [8, 9]) {
    const req = fixtureRequest(slot, 'evaluate', output);
    const response = decodeHelperResponse(runHelper(encodeHelperRequest(req)), req);
    assert.equal(response.status, slot === 8 ? 'OK' : 'FINAL_ABSENT');
    assert.equal(response.roots[0].chain.at(-1).byteLength, 3);
  }
});
test('N16 native helper rejects hostile operation extra fields and oversized frame', () => {
  const req = request();
  for (const value of [{ ...req, operation: 'Invoke-Expression' }, { ...req, secret: 'DO_NOT_LOG_THIS' }]) {
    const bytes = runHelper(rawFrame(value)); assert.equal(bytes.includes(Buffer.from('DO_NOT_LOG_THIS')), false);
    assert.equal(JSON.parse(bytes.subarray(4)).code, 'MO1307_INPUT');
  }
  const header = Buffer.alloc(4); header.writeUInt32BE(65533);
  assert.equal(JSON.parse(runHelper(header).subarray(4)).code, 'MO1307_RESOURCE_LIMIT');
});
test('N17 native CLI evaluates and publishes exact integrated result', async () => {
  const input = path.join(cwd, 'repositories/cca-conformance/fixtures/mo1307/bundles/ready');
  const pins = JSON.parse(await fs.readFile(path.join(input, 'pins.json')));
  const out = path.join(attempt, 'cli-integrated-ready');
  const argv = ['evaluate', '--input-root', input, '--config', 'configuration.json', '--authority', 'authority.json',
    '--authority-sha256', pins.trustedAuthorityDigest, '--candidate-sha256', pins.expectedCandidateDigest, '--output-root', out];
  const child = spawnSync(process.execPath, [cli, ...argv], { env: cleanEnv, encoding: 'utf8', timeout: 32000, windowsHide: true });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr); assert.equal(child.stderr, '');
  assert.deepEqual(Buffer.from(child.stdout), await fs.readFile(path.join(input, 'expected-summary.json')));
  const finalName = 'memoryos-readiness-result.json';
  assert.deepEqual(await fs.readdir(out), [finalName]);
  assert.deepEqual(await fs.readFile(path.join(out, finalName)), await fs.readFile(path.join(input, 'expected-result.json')));
  const rejected = spawnSync(process.execPath, [cli, ...args('__proto__')], { env: cleanEnv, encoding: 'utf8', timeout: 5000, windowsHide: true });
  assert.equal(rejected.status, 10); assert.equal(JSON.parse(rejected.stderr).code, 'MO1307_USAGE');
});
async function outputRoot(name) {
  await fs.mkdir(attempt, { recursive: true });
  return path.join(attempt, name);
}
test('N18 publication exclusive create exact pending and single-file commit', async () => {
  const root = await outputRoot('commit'); const bytes = Buffer.from('{"phase":"foundation"}\n');
  const inspection = await fixtureInspection(root);
  const token = await createPublication(root, { inspection });
  await rejects(async () => createPublication(root, { inspection: await fixtureInspection(root) }), 'OUTPUT');
  await stagePublication(token, bytes);
  assert.deepEqual(await fs.readdir(root), ['memoryos-readiness-result.json.pending']);
  assert.deepEqual(await fs.readFile(path.join(root, 'memoryos-readiness-result.json.pending')), bytes);
  const result = await finalizePublication(token);
  assert.deepEqual(await fs.readdir(root), ['memoryos-readiness-result.json']);
  assert.deepEqual(await fs.readFile(result.path), bytes);
  await rejects(() => finalizePublication(token), 'OUTPUT');
});
test('N19 existing final destination never replaced and pending retained', async () => {
  const root = await outputRoot('collision'); const token = await createPublication(root, { inspection: await fixtureInspection(root) });
  await stagePublication(token, Buffer.from('{}\n'));
  const final = path.join(root, 'memoryos-readiness-result.json'); await fs.writeFile(final, 'existing');
  await rejects(() => finalizePublication(token), 'OUTPUT');
  assert.equal(await fs.readFile(final, 'utf8'), 'existing');
  assert.equal(await fs.readFile(path.join(root, 'memoryos-readiness-result.json.pending'), 'utf8'), '{}\n');
  await rejects(() => finalizePublication(token), 'OUTPUT');
});
test('N20 pending collision and mutation fail closed without cleanup', async () => {
  const root = await outputRoot('pending-collision'); const token = await createPublication(root, { inspection: await fixtureInspection(root) });
  const pending = path.join(root, 'memoryos-readiness-result.json.pending'); await fs.writeFile(pending, 'retained');
  await rejects(() => stagePublication(token, Buffer.from('{}\n')), 'OUTPUT'); assert.equal(await fs.readFile(pending, 'utf8'), 'retained');
  const second = await outputRoot('mutation'); const other = await createPublication(second, { inspection: await fixtureInspection(second) });
  await stagePublication(other, Buffer.from('{}\n')); await fs.writeFile(path.join(second, 'memoryos-readiness-result.json.pending'), '[]\n');
  await rejects(() => finalizePublication(other), 'OUTPUT');
  assert.deepEqual(await fs.readdir(second), ['memoryos-readiness-result.json.pending']);
});
test('N21 publication byte ceiling boundary and +1 before write', async () => {
  const root = await outputRoot('ceiling'); const token = await createPublication(root, { inspection: await fixtureInspection(root) });
  await stagePublication(token, Buffer.alloc(D.limits.resultBytes, 0x61));
  assert.equal((await fs.stat(path.join(root, 'memoryos-readiness-result.json.pending'))).size, D.limits.resultBytes);
  const largeRoot = await outputRoot('oversize'); const large = await createPublication(largeRoot, { inspection: await fixtureInspection(largeRoot) });
  await rejects(() => stagePublication(large, Buffer.alloc(D.limits.resultBytes + 1)), 'OUTPUT');
  assert.deepEqual(await fs.readdir(largeRoot), []);
});
test('N22 branded framed inspection required and identity change rejects', async () => {
  await rejects(() => createPublication(path.join(attempt, 'untrusted')), 'OUTPUT');
  const root = await outputRoot('identity-change'); let changed = false;
  const inspect = async (...values) => {
    const chain = await fixtureInspect(...values); if (changed) chain.at(-1).fileId = '000000000000ffff'; return chain;
  };
  const token = await createPublication(root, { inspection: await fixtureInspection(root, { inspect }) }); changed = true;
  await rejects(() => stagePublication(token, Buffer.from('{}\n')), 'OUTPUT'); assert.deepEqual(await fs.readdir(root), []);
});
test('N23 primitive late checkpoint prevents rename and retains pending', async () => {
  const root = await outputRoot('late'); let late = false;
  const inspection = await fixtureInspection(root, { checkpoint: () => {
    if (late) throw new ReadinessError('TIMEOUT', 'PUBLICATION');
  } });
  const token = await createPublication(root, { inspection });
  await stagePublication(token, Buffer.from('{}\n')); late = true;
  await rejects(() => finalizePublication(token), 'TIMEOUT'); assert.deepEqual(await fs.readdir(root), ['memoryos-readiness-result.json.pending']);
});
test('N24 foundation retains no-network and fixed orchestration boundaries', async () => {
  for (const relative of ['src/windows-paths.mjs', 'src/helper-protocol.mjs', 'src/publication.mjs', 'src/cli-args.mjs', 'bin/memoryos-readiness.mjs']) {
    const source = await fs.readFile(path.join(packageRoot, relative), 'utf8');
    assert.doesNotMatch(source, /(?:node:)?(?:https?|net|tls|dns|dgram|child_process)['"]/);
    // Invocation-scoped deadline timers are permitted. Their lifetime is
    // checked by the finalization correction suite, rather than banning the
    // timer API token regardless of scope. Persistent schedulers remain barred.
    assert.doesNotMatch(source, /\b(?:fetch|WebSocket|createServer|watch|watchFile)\s*\(/);
  }
  const source = await fs.readFile(helper, 'utf8');
  assert.doesNotMatch(source, /\b(?:Invoke-Expression|Invoke-WebRequest|Invoke-RestMethod|Start-Process|Add-Type|Import-Module)\b/);
  assert.equal([...source].every(character => character.charCodeAt(0) < 128), true, 'PowerShell 5.1 script remains ASCII without BOM dependency');
});
