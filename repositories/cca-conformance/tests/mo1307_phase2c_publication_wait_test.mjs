// Engineering integration: actual Windows rename/libuv and fixed worker thread;
// framed identities are synthetic, not native-helper acquisition certification.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pbkdf2 } from 'node:crypto';
import { createHook } from 'node:async_hooks';
import { Writable } from 'node:stream';
import { createSupervisor, createSupervisorForTesting, failureCleanupDeadline } from '../../memoryos-readiness/src/runtime.mjs';
import { createPublication, stagePublication, finalizePublication, publicationStatus } from '../../memoryos-readiness/src/publication.mjs';
import { orchestrateCli } from '../../memoryos-readiness/src/cli.mjs';
import { errorExit } from '../../memoryos-readiness/src/errors.mjs';
import { fixtureInspection, pendingName } from '../tools/mo1307-phase2c-correction/publication-fixture.mjs';
import { root, bundle, launchFor, workerURL, capture, syntheticExchange, finalName } from '../tools/mo1307-phase2c-resumed/surface-fixture.mjs';
import { decodeHelperRequest } from '../../memoryos-readiness/src/helper-protocol.mjs';
const base = path.join(root, '.cache/mo1307/phase2c-final/publication-waits-' + process.pid);
const code = expected => error => error.code === 'MO1307_' + expected;
async function parent() { await fs.mkdir(base, { recursive: true }); }

for (const mode of ['deadline', 'cancellation']) test('FCLI actual queued rename awaits settlement after ' + mode, async () => {
  await parent(); assert.equal(process.platform, 'win32'); assert.equal(process.env.UV_THREADPOOL_SIZE, undefined);
  const data = await bundle(), output = path.join(base, 'queued-' + mode), controller = new AbortController();
  let offset = 0;
  const supervisor = createSupervisorForTesting({ kind: 'cli', signal: controller.signal, now: () => performance.now() + offset }, { workerURL });
  const stdout = capture(), exchange = syntheticExchange();
  const actualExchange = async frame => {
    const response = await exchange(frame);
    if (mode === 'deadline' && decodeHelperRequest(frame).sequence === 8) offset = supervisor.deadline - performance.now() - 100;
    return response;
  };
  const began = performance.now(), jobs = []; let requests = 0, settled = false, observation = null, timer;
  let observe; const observed = new Promise(resolve => { observe = resolve; });
  const hook = createHook({ init(_id, type) {
    if (type !== 'FSREQPROMISE' || supervisor.snapshot().publication?.phase !== 'COMMIT_IN_PROGRESS') return;
    requests++;
    for (let i = 0; i < 4; i++) jobs.push(new Promise((resolve, reject) => {
      pbkdf2('fixed-engineering-input', 'fixed-engineering-salt', 1000000, 16, 'sha512', error => error ? reject(error) : resolve());
    }));
    timer = setTimeout(() => {
      controller.abort();
      observation = { elapsedMs: performance.now() - began, settled, snapshot: supervisor.snapshot(),
        finalPresent: existsSync(path.join(output, finalName)), pendingPresent: existsSync(path.join(output, pendingName)), stdoutBytes: stdout.bytes().length };
      observe();
    }, mode === 'deadline' ? 150 : 25);
  } });
  let failure;
  hook.enable();
  try { await orchestrateCli(launchFor(data, output), { supervisor, exchange: actualExchange, stdout: stdout.stream }); }
  catch (error) { failure = error; }
  finally { settled = true; hook.disable(); }
  await observed; clearTimeout(timer); await Promise.all(jobs);
  const snapshot = supervisor.snapshot(), status = snapshot.publication;
  const receipt = { mode, scope: 'ACTUAL_QUEUED_RENAME_AND_CLI_WITH_SYNTHETIC_IDENTITY_FRAMES', requests,
    engineeringClock: mode === 'deadline' ? 'Monotonic elapsed-time offset at slot 8; original CLI absolute deadline has 100ms remaining, no budget restart.' : 'Real monotonic clock',
    finiteJobs: jobs.length, observation, elapsedMs: performance.now() - began, snapshot,
    failure: failure?.code, exitCode: failure ? errorExit(failure) : null, stdoutBytes: stdout.bytes().length,
    failureCleanupDeadline: failure ? failureCleanupDeadline(failure) : null };
  process.stdout.write('# QUEUED_CLI ' + JSON.stringify(receipt) + '\n');
  try {
    assert.equal(failure?.code, 'MO1307_OUTPUT'); assert.equal(errorExit(failure), 21);
    assert.equal(requests, 1); assert.equal(jobs.length, 4);
    assert.equal(observation.settled, false); assert.equal(observation.snapshot.terminalCode, null);
    assert.equal(observation.snapshot.cleanupConfirmed, false);
    assert.equal(observation.snapshot.publication.phase, 'COMMIT_IN_PROGRESS');
    assert.equal(observation.snapshot.publication.dispositionDeadline, null);
    assert.equal(observation.finalPresent, false); assert.equal(observation.pendingPresent, true);
    assert.equal(observation.stdoutBytes, 0); assert.equal(stdout.bytes().length, 0);
    assert.equal(status.phase, 'COMMITTED'); assert.equal(status.namespaceVerified, true);
    assert.equal(status.cancelledAfterAdmission, true);
    assert.equal(status.deadlineExpiredAfterAdmission, mode === 'deadline');
    assert.equal(snapshot.cleanupDeadline, status.dispositionDeadline);
    assert.equal(failureCleanupDeadline(failure), status.dispositionDeadline);
    assert.equal(existsSync(path.join(output, pendingName)), false);
    assert.deepEqual(await fs.readFile(path.join(output, finalName)), data.resultBytes);
  } finally { await supervisor.dispose(); }
});

for (const operation of ['mkdir', 'sync', 'final-open']) test('PWAIT terminal cancellation prevents late advancement after ' + operation, async () => {
  await parent(); const output = path.join(base, operation), controller = new AbortController();
  const supervisor = createSupervisor({ kind: 'cli', signal: controller.signal });
  const seen = [], inspection = await fixtureInspection(output, { checkpoint: () => supervisor.checkpoint('PUBLICATION'), observe: req => seen.push(req.sequence) });
  let release, admitted; const entered = new Promise(resolve => { admitted = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const originalMkdir = fs.mkdir, originalOpen = fs.open; let token, pending;
  try {
    if (operation === 'mkdir') {
      fs.mkdir = async (...args) => { if (args[0] === output) { admitted(); await gate; } return originalMkdir(...args); };
      pending = supervisor.waitOperation(createPublication(output, { inspection }));
    } else {
      token = await supervisor.waitOperation(createPublication(output, { inspection }));
      if (operation === 'final-open') await supervisor.waitOperation(stagePublication(token, Buffer.from('{}\n')), { publicationToken: token });
      fs.open = async (...args) => {
        if (operation === 'final-open' && args[0] === path.join(output, pendingName) && args[1] === 'r') { admitted(); await gate; }
        const handle = await originalOpen(...args);
        if (operation === 'sync') {
          const sync = handle.sync.bind(handle);
          handle.sync = async () => { admitted(); await gate; return sync(); };
        }
        return handle;
      };
      pending = operation === 'sync' ? supervisor.waitOperation(stagePublication(token, Buffer.from('{}\n')), { publicationToken: token })
        : supervisor.waitFinalization(token, () => finalizePublication(token));
    }
    await entered; const before = [...seen]; controller.abort();
    await assert.rejects(pending, code('CANCELLED'));
    assert.equal(existsSync(path.join(output, finalName)), false);
    release(); await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepEqual(seen, before); assert.equal(existsSync(path.join(output, finalName)), false);
    assert.equal(supervisor.snapshot().terminalCode, 'MO1307_CANCELLED');
    if (token) assert.equal(publicationStatus(token).admitted, false);
  } finally { release?.(); fs.mkdir = originalMkdir; fs.open = originalOpen; await supervisor.dispose(); }
});
for (const mode of ['timeout', 'cancellation']) test('FCLI post-commit stalled stdout ' + mode + ' retains final and one transport allowance', async () => {
  await parent(); const data = await bundle(), output = path.join(base, 'stdout-' + mode), controller = new AbortController();
  let offset = 0, timer, delivered = 0;
  const supervisor = createSupervisorForTesting({ kind: 'cli', signal: controller.signal, now: () => performance.now() + offset }, { workerURL });
  const stream = new Writable({ write(chunk, _encoding, _callback) {
    delivered += chunk.length;
    const status = supervisor.snapshot().publication;
    assert.equal(status.phase, 'COMMITTED'); assert.equal(status.namespaceVerified, true);
    timer = setTimeout(() => {
      if (mode === 'cancellation') controller.abort();
      else offset = supervisor.deadline - performance.now() + 1;
    }, 30);
  } });
  stream.on('error', () => {});
  try {
    await assert.rejects(orchestrateCli(launchFor(data, output), { supervisor, exchange: syntheticExchange(), stdout: stream }), code('OUTPUT'));
    const first = supervisor.snapshot();
    assert.equal(first.terminalCode, 'MO1307_OUTPUT'); assert.equal(first.publication.phase, 'COMMITTED');
    assert.equal(first.publication.namespaceVerified, true); assert.ok(delivered > 0); assert.equal(stream.destroyed, true);
    assert.equal(first.cleanupDeadline, first.terminalAt + 2000);
    assert.ok(first.cleanupDeadline > first.publication.dispositionDeadline);
    await supervisor.terminate(); assert.equal(supervisor.snapshot().cleanupDeadline, first.cleanupDeadline);
    assert.equal(existsSync(path.join(output, pendingName)), false);
    assert.deepEqual(await fs.readFile(path.join(output, finalName)), data.resultBytes);
    process.stdout.write('# STDOUT_DISPOSITION ' + JSON.stringify({ mode, delivered, snapshot: first }) + '\n');
  } finally { clearTimeout(timer); stream.destroy(); await supervisor.dispose(); }
});
