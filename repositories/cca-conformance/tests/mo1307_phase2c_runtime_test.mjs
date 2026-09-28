import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { createSupervisor, createSupervisorForTesting } from '../../memoryos-readiness/src/runtime.mjs';
import { helperLaunchSpecification, createHelperTransportForTesting } from '../../memoryos-readiness/src/helper-transport.mjs';
import { encodeHelperRequest, encodeHelperResponse } from '../../memoryos-readiness/src/helper-protocol.mjs';
import { ReadinessError } from '../../memoryos-readiness/src/errors.mjs';
import { adaptVerifiedEvidence, evidenceInput, verifyDecisionBytes } from '../../memoryos-readiness/src/integration.mjs';

const workerURL = new URL('../tools/mo1307-phase2c-resumed/runtime-worker.mjs', import.meta.url);
const code = expected => error => error?.code === 'MO1307_' + expected;
const request = { kind: 'MemoryOSReadinessHelperRequest', version: '2.0.0', session: 'f'.repeat(64), sequence: 4,
  operation: 'CHECK_OUTPUT', roots: [{ id: 'output', path: 'C:\\phase2c-output' }], files: [] };
const identity = { attributes: 16, byteLength: 0, fileId: '1'.repeat(16), finalPath: 'C:\\', isDirectory: true, linkCount: 1, volumeSerial: '0'.repeat(8) };
const answer = { kind: 'MemoryOSReadinessHelperResponse', version: '2.0.0', session: request.session, sequence: 4,
  operation: request.operation, roots: [{ id: 'output-parent', chain: [identity] }], files: [], status: 'ABSENT', code: null };
const frame = encodeHelperRequest(request), response = encodeHelperResponse(answer, request);

function fakeSpawn({ stdout = response, stderr = Buffer.alloc(0), exitCode = 0, hold = 0, finish = true, onLaunch = () => {} } = {}) {
  return (...args) => {
    onLaunch(...args);
    const child = new EventEmitter();
    child.pid = 7; child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.stdin.resume();
    let closed = false, timer;
    const endProcess = code => {
      if (closed) return; closed = true; clearTimeout(timer);
      child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
      setImmediate(() => child.emit('close', code));
    };
    child.kill = () => { endProcess(null); return true; };
    queueMicrotask(() => {
      child.stdout.write(stdout); child.stderr.write(stderr);
      if (finish) { child.stdout.end(); child.stderr.end(); timer = setTimeout(() => endProcess(exitCode), hold); }
    });
    return child;
  };
}
async function withSupervisor(options, action, dependencies = {}) {
  const supervisor = createSupervisorForTesting(options, dependencies);
  try { return await action(supervisor); } finally { await supervisor.dispose(); }
}

for (const kind of ['api', 'cli']) test(`R01 ${kind} exact absolute deadline and equality`, async () => {
  let now = 100;
  await withSupervisor({ kind, now: () => now }, async supervisor => {
    const limit = kind === 'api' ? 10000 : 30000;
    now += limit - 1; supervisor.checkpoint(); now += 1;
    assert.throws(() => supervisor.checkpoint(), code('TIMEOUT'));
    assert.throws(() => supervisor.checkpoint(), code('TIMEOUT'));
  });
});
test('R02 earlier cancellation stays terminal after deadline', async () => {
  let now = 0; const abort = new AbortController();
  await withSupervisor({ kind: 'api', now: () => now, signal: abort.signal }, async supervisor => {
    now = 9999; abort.abort(); now = 10000;
    assert.throws(() => supervisor.checkpoint(), code('CANCELLED'));
  });
});
test('R03 timeout wins simultaneous first cancellation observation', async () => {
  let now = 0; const abort = new AbortController();
  await withSupervisor({ kind: 'api', now: () => now, signal: abort.signal }, async supervisor => {
    now = 10000; abort.abort(); assert.throws(() => supervisor.checkpoint(), code('TIMEOUT'));
  });
});
test('R04 preaborted signal prevents any launch', async () => {
  const abort = new AbortController(); abort.abort();
  await withSupervisor({ kind: 'cli', signal: abort.signal }, async supervisor => {
    let called = false;
    await assert.rejects(supervisor.runOwned('helper', () => { called = true; }), code('CANCELLED'));
    assert.equal(called, false);
  });
});
test('R05 monotonic decreasing clock rejects', async () => {
  let now = 2;
  await withSupervisor({ kind: 'api', now: () => now }, async supervisor => {
    now = 1; assert.throws(() => supervisor.checkpoint(), code('INTERNAL')); now = 2;
  });
});
test('R06 API cannot launch helper', async () => {
  await withSupervisor({ kind: 'api' }, async supervisor => {
    await assert.rejects(supervisor.runOwned('helper', () => {}), code('INTERNAL'));
  });
});
test('R07 helper deadline includes all active time; equality rejects', async () => {
  let now = 0;
  await withSupervisor({ kind: 'cli', now: () => now }, async supervisor => {
    await assert.rejects(supervisor.runOwned('helper', () => {
      now = 5000; return { completion: Promise.resolve(), closed: Promise.resolve(), terminate() {} };
    }), code('TIMEOUT'));
    assert.equal(supervisor.snapshot().cleanupConfirmed, true);
  });
});
test('R08 aggregate deadline does not reset across helpers', async () => {
  let now = 0;
  await withSupervisor({ kind: 'cli', now: () => now }, async supervisor => {
    for (let i = 0; i < 4; i += 1) await supervisor.runOwned('helper', () => {
      now += 4999; return { completion: Promise.resolve(), closed: Promise.resolve(), terminate() {} };
    });
    assert.equal(supervisor.snapshot().helperUsedMs, 19996);
    await assert.rejects(supervisor.runOwned('helper', lease => {
      assert.equal(lease.deadline, 20000); now = 20000;
      return { completion: Promise.resolve(), closed: Promise.resolve(), terminate() {} };
    }), code('TIMEOUT'));
  });
});
test('R09 worker time is excluded from helper aggregate but inside overall', async () => {
  let now = 0;
  await withSupervisor({ kind: 'cli', now: () => now }, async supervisor => {
    await supervisor.runOwned('helper', () => { now = 10; return { completion: Promise.resolve(), closed: Promise.resolve(), terminate() {} }; });
    await supervisor.runOwned('worker', lease => { assert.equal(lease.deadline, 10010); now = 9010; return { completion: Promise.resolve(), closed: Promise.resolve(), terminate() {} }; });
    assert.equal(supervisor.snapshot().helperUsedMs, 10);
    await supervisor.runOwned('helper', lease => { assert.equal(lease.deadline, 14010); return { completion: Promise.resolve(), closed: Promise.resolve(), terminate() {} }; });
  });
});
test('R10 helper overlap is terminal and cleans prior owned role', async () => {
  await withSupervisor({ kind: 'cli' }, async supervisor => {
    let close;
    const first = supervisor.runOwned('helper', () => ({ completion: new Promise(() => {}), closed: new Promise(resolve => { close = resolve; }), terminate() { close(); } }));
    await assert.rejects(supervisor.runOwned('helper', () => {}), code('INTERNAL'));
    await assert.rejects(first, code('INTERNAL')); assert.equal(supervisor.snapshot().cleanupConfirmed, true);
  });
});
test('R11 helper and worker cannot overlap', async () => {
  await withSupervisor({ kind: 'cli' }, async supervisor => {
    let close;
    const first = supervisor.runOwned('helper', () => ({ completion: new Promise(() => {}), closed: new Promise(resolve => { close = resolve; }), terminate() { close(); } }));
    await assert.rejects(supervisor.runWorker({}), code('INTERNAL')); await assert.rejects(first, code('INTERNAL'));
  });
});
test('R12 frame alone cannot advance before actual close', async () => {
  await withSupervisor({ kind: 'cli' }, async supervisor => {
    const transport = createHelperTransportForTesting(supervisor, fakeSpawn({ hold: 50 }));
    let done = false; const task = transport.exchange(frame).then(result => { done = true; return result; });
    await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(done, false);
    const result = await task; assert.equal(result.exitConfirmed, true);
    assert.equal(supervisor.snapshot().activeRole, null);
  });
});
test('R13 launch uses only fixed executable/script/environment and no shell', () => {
  const specification = helperLaunchSpecification();
  assert.equal(specification.executable, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.deepEqual(Object.keys(specification.options.env).sort(), ['SystemRoot', 'WINDIR']);
  assert.deepEqual(specification.args.slice(0, 6), ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File']);
  assert.equal(specification.options.shell, false); assert.equal(specification.options.windowsHide, true);
  assert.equal(specification.options.detached, false);
});
for (const [name, options, expected] of [
  ['trailing byte', { stdout: Buffer.concat([response, Buffer.from('x')]) }, 'INPUT'],
  ['extra frame', { stdout: Buffer.concat([response, response]) }, 'INPUT'],
  ['debug stdout', { stdout: Buffer.concat([Buffer.from('debug'), response]) }, 'RESOURCE_LIMIT'],
  ['truncated frame', { stdout: response.subarray(0, -1) }, 'INPUT'],
  ['oversized prefix', { stdout: Buffer.from([1, 0, 0, 0]) }, 'RESOURCE_LIMIT'],
  ['stderr overflow', { stderr: Buffer.alloc(4097) }, 'RESOURCE_LIMIT'],
  ['nonzero exit', { exitCode: 1 }, 'INTERNAL'],
]) test(`R14 helper ${name} fails closed`, async () => {
  await withSupervisor({ kind: 'cli' }, async supervisor => {
    await assert.rejects(createHelperTransportForTesting(supervisor, fakeSpawn(options)).exchange(frame), code(expected));
    assert.equal(supervisor.snapshot().cleanupConfirmed, !['trailing byte', 'extra frame', 'debug stdout', 'truncated frame', 'oversized prefix'].includes(name));
  });
});
test('R15 cancellation in launch terminates and ignores later valid frame', async () => {
  const abort = new AbortController();
  await withSupervisor({ kind: 'cli', signal: abort.signal }, async supervisor => {
    await assert.rejects(createHelperTransportForTesting(supervisor, fakeSpawn({ onLaunch: () => abort.abort() })).exchange(frame), code('CANCELLED'));
    assert.equal(supervisor.snapshot().cleanupConfirmed, true);
  });
});
test('R16 cancellation during transport cleans child', async () => {
  const abort = new AbortController();
  await withSupervisor({ kind: 'cli', signal: abort.signal }, async supervisor => {
    const pending = createHelperTransportForTesting(supervisor, fakeSpawn({ finish: false })).exchange(frame);
    setTimeout(() => abort.abort(), 10);
    await assert.rejects(pending, code('CANCELLED')); assert.equal(supervisor.snapshot().cleanupConfirmed, false);
    assert.throws(() => transportAgain(supervisor), code('CANCELLED'));
  });
});
function transportAgain(supervisor) { return createHelperTransportForTesting(supervisor, fakeSpawn()).exchange(frame); }
test('R17 fixed actual worker has empty environment and exact heap intent', async () => {
  await withSupervisor({ kind: 'api' }, async supervisor => {
    const result = await supervisor.runWorker({ mode: 'environment' });
    const observed = JSON.parse(Buffer.from(result.resultBytes));
    assert.deepEqual(observed.environment, {});
    assert.equal(observed.resourceLimits.maxOldGenerationSizeMb, 128);
    assert.equal(observed.resourceLimits.maxYoungGenerationSizeMb, 16);
    assert.equal(supervisor.snapshot().workers, 1); assert.equal(supervisor.snapshot().cleanupConfirmed, true);
  }, { workerURL });
});
test('R18 successful worker result waits for termination', async () => {
  await withSupervisor({ kind: 'api' }, async supervisor => {
    let done = false; const pending = supervisor.runWorker({ mode: 'hold' }).then(value => { done = true; return value; });
    await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(done, false);
    await pending; assert.equal(supervisor.snapshot().activeRole, null);
    await assert.rejects(supervisor.runWorker({}), code('INTERNAL'));
  }, { workerURL });
});
for (const mode of ['crash', 'duplicate', 'stdout']) test(`R19 actual worker ${mode} fails closed`, async () => {
  await withSupervisor({ kind: 'api' }, async supervisor => {
    await assert.rejects(supervisor.runWorker({ mode }), code('INTERNAL'));
    assert.equal(supervisor.snapshot().cleanupConfirmed, true);
  }, { workerURL });
});
test('R20 cancellation actually terminates CPU-bound worker thread', async () => {
  const abort = new AbortController();
  await withSupervisor({ kind: 'api', signal: abort.signal }, async supervisor => {
    const pending = supervisor.runWorker({ mode: 'spin' }); setTimeout(() => abort.abort(), 40);
    await assert.rejects(pending, code('CANCELLED')); assert.equal(supervisor.snapshot().cleanupConfirmed, true);
  }, { workerURL });
});
test('R21 production worker executes accepted 2A/2B and confirms quiescence', async () => {
  const root = new URL('../fixtures/mo1307/bundles/ready/', import.meta.url);
  const read = name => readFile(new URL(name, root));
  const [configurationBytes, candidateBytes, manifestBytes, authorityBytes, pinsBytes] = await Promise.all(['configuration.json', 'candidate.json', 'manifest.json', 'authority.json', 'pins.json'].map(read));
  const pins = JSON.parse(pinsBytes), manifest = JSON.parse(manifestBytes);
  const input = { configurationBytes, candidateBytes, manifestBytes, authorityBytes,
    expectedCandidateDigest: pins.expectedCandidateDigest, trustedAuthorityDigest: pins.trustedAuthorityDigest,
    files: await Promise.all(manifest.entries.map(async row => ({ id: row.id, bytes: await read(row.path) }))) };
  const supervisor = createSupervisor({ kind: 'api' });
  try { const actual = await supervisor.runWorker(input); assert.deepEqual(Buffer.from(actual.resultBytes), await read('expected-result.json')); assert.equal(supervisor.snapshot().cleanupConfirmed, true); }
  finally { await supervisor.dispose(); }
});
test('R22 adapter matches closed 2A handoff; operational/session fields excluded', () => {
  const p = { candidate: {}, candidateDigest: 'a', profile: {}, stage: 'PRE_TAG_READINESS', authorityIdentityDigest: 'b',
    normalizedAuthority: { scopeId: 'reviewed', slots: [] }, claims: [], graph: {}, graphDigest: 'c', session: 'ignored', diagnostics: ['ignored'] };
  assert.deepEqual(Object.keys(adaptVerifiedEvidence({ projection: p, audit: {} })).sort(),
    ['audit', 'authorityIdentityDigest', 'candidate', 'candidateDigest', 'claims', 'graph', 'graphDigest', 'profile', 'scopeId', 'slots', 'stage']);
});

test('R23 verify evidence seam excludes result and decision bytes', () => {
  const input = { configurationBytes: new Uint8Array(), candidateBytes: new Uint8Array(), manifestBytes: new Uint8Array(), authorityBytes: new Uint8Array(),
    files: [], expectedCandidateDigest: 'a', trustedAuthorityDigest: 'b', resultBytes: new Uint8Array(), decisionBytes: null };
  assert.deepEqual(Object.keys(evidenceInput(input)).sort(), ['authorityBytes', 'candidateBytes', 'configurationBytes', 'expectedCandidateDigest', 'files', 'manifestBytes', 'trustedAuthorityDigest']);
});
test('R24 malformed decision uses dedicated mismatch, cap uses resource', () => {
  assert.throws(() => verifyDecisionBytes(Buffer.from('no json'), {}), code('DECISION_MISMATCH'));
  assert.throws(() => verifyDecisionBytes(Buffer.alloc(8193), {}), code('RESOURCE_LIMIT'));
  assert.equal(verifyDecisionBytes(null, {}), null);
});
test('R25 actual worker policy denies filesystem/network/process/module escape imports', async () => {
  await withSupervisor({ kind: 'api' }, async supervisor => {
    const value = await supervisor.runWorker({ mode: 'policy' });
    const observations = JSON.parse(Buffer.from(value.resultBytes));
    assert.equal(Object.keys(observations).length, 13);
    for (const [name, denied] of Object.entries(observations)) assert.equal(denied, true, name);
  }, { workerURL });
});

test('R26 cancellation preempts pending publication promise without another role', async () => {
  const controller = new AbortController();
  await withSupervisor({ kind: 'cli', signal: controller.signal }, async supervisor => {
    const waiting = supervisor.waitOperation(new Promise(() => {}));
    controller.abort(); await assert.rejects(waiting, code('CANCELLED'));
    assert.equal(supervisor.snapshot().helpers, 0); assert.equal(supervisor.snapshot().workers, 0);
  });
});
test('R27 late publication promise cannot restore terminal success', async () => {
  const controller = new AbortController();
  await withSupervisor({ kind: 'cli', signal: controller.signal }, async supervisor => {
    let finish;
    const waiting = supervisor.waitOperation(new Promise(resolve => { finish = resolve; }));
    controller.abort(); finish('late'); await assert.rejects(waiting, code('CANCELLED'));
    assert.throws(() => supervisor.checkpoint('PUBLICATION'), code('CANCELLED'));
  });
});
