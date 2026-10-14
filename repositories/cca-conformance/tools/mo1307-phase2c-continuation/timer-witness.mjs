// Engineering observation only: real owned file I/O, synthetic framed identities,
// and invocation-scoped async resource observation. No native identity claim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage, createHook } from 'node:async_hooks';
import { createSupervisor } from '../../../memoryos-readiness/src/runtime.mjs';
import { createPublication, stagePublication, finalizePublication, publicationStatus } from '../../../memoryos-readiness/src/publication.mjs';
import { fixtureInspection } from '../mo1307-phase2c-correction/publication-fixture.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const pendingName = 'memoryos-readiness-result.json.pending';
const finalName = 'memoryos-readiness-result.json';
const nextTurn = () => new Promise(resolve => setImmediate(resolve));
const forbiddenResources = new Set(['TCPSERVERWRAP', 'FSEVENTWRAP', 'STATWATCHER', 'UDPWRAP']);

async function within(promise, maximum = 1000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('engineering operation did not settle within witness bound')), maximum);
    })]);
  } finally { clearTimeout(timer); }
}

async function observeInvocation(name, run) {
  const context = new AsyncLocalStorage(), scope = {}, active = new Map(), forbidden = [];
  let timerCount = 0, callbacks = 0;
  const hook = createHook({
    init(id, type, _trigger, resource) {
      if (context.getStore() !== scope) return;
      if (type === 'Timeout') { active.set(id, resource); timerCount++; }
      if (forbiddenResources.has(type)) forbidden.push(type);
    },
    before(id) { if (active.has(id)) callbacks++; },
    destroy(id) { active.delete(id); },
  });
  hook.enable();
  try {
    const result = await context.run(scope, run);
    await nextTurn(); await nextTurn();
    assert.equal(active.size, 0, name + ': no invocation timer survives settlement/disposal');
    assert.deepEqual(forbidden, [], name + ': no server or watcher resource was created');
    const atSettlement = callbacks;
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(callbacks, atSettlement, name + ': no post-invocation timer callback');
    assert.equal(active.size, 0, name + ': no timer was rearmed across runs');
    assert.ok(timerCount > 0, name + ': observation included an actual operational timer');
    return { name, observedTimers: timerCount, remainingTimers: active.size,
      serverOrWatcherResources: forbidden.length, callbacksAfterSettlement: callbacks - atSettlement, ...result };
  } finally {
    hook.disable(); context.disable();
    // If the assertion fails, terminate only these tracked engineering timers
    // so the failed witness itself remains bounded. This never turns it PASS.
    for (const timer of active.values()) clearTimeout(timer);
  }
}

export async function runTimerLifetimeWitness() {
  const parent = path.join(root, '.cache', 'mo1307', 'phase2c-final', `timers-${process.pid}-${Date.now()}`);
  await fs.mkdir(parent, { recursive: true });
  const rows = [], bytes = Buffer.from('{"timer":"bounded"}\n');
  for (const name of ['success-a', 'write-failure', 'write-cancellation', 'rename-failure', 'post-admission-cancellation', 'stalled-write-cancellation', 'success-b']) {
    let releaseStalled = null, stalledPromise = null;
    try { rows.push(await observeInvocation(name, async () => {
      const controller = new AbortController(), supervisor = createSupervisor({ kind: 'cli', signal: controller.signal });
      const destination = path.join(parent, name), originalOpen = fs.open, originalRename = fs.rename;
      let pending = null, observedCode = null, token = null;
      try {
        const inspection = await fixtureInspection(destination, { checkpoint: () => supervisor.checkpoint('PUBLICATION') });
        token = await supervisor.waitOperation(createPublication(destination, { inspection }));
        if (name === 'write-failure' || name === 'write-cancellation' || name === 'stalled-write-cancellation') {
          fs.open = async (...args) => {
            const handle = await originalOpen(...args);
            if (args[0] !== path.join(destination, pendingName)) return handle;
            handle.writeFile = async (_bytes, { signal } = {}) => {
              if (name === 'write-failure') throw new Error('engineering write failure');
              assert.ok(signal instanceof AbortSignal, 'pending write receives a bounded cancellation signal');
              controller.abort();
              if (name === 'stalled-write-cancellation') await new Promise((_, reject) => { releaseStalled = () => reject(new Error('engineering releases stalled write after observation')); });
              await new Promise((_, reject) => {
                const stop = () => reject(new Error('engineering aborted write'));
                if (signal.aborted) stop(); else signal.addEventListener('abort', stop, { once: true });
              });
            };
            return handle;
          };
        }
        pending = stagePublication(token, bytes);
        pending.catch(() => {});
        if (name === 'stalled-write-cancellation') stalledPromise = pending;
        await within(supervisor.waitOperation(pending, { publicationToken: token }));
        if (name === 'rename-failure') fs.rename = async () => { throw new Error('engineering native rename rejection'); };
        if (name === 'post-admission-cancellation') fs.rename = async (...args) => {
          assert.equal(publicationStatus(token).phase, 'COMMIT_IN_PROGRESS');
          controller.abort();
          return originalRename(...args);
        };
        await supervisor.waitFinalization(token, () => finalizePublication(token));
        supervisor.beginPublicationTransport(token);
        assert.deepEqual(await fs.readFile(path.join(destination, finalName)), bytes);
      } catch (error) {
        observedCode = error.code;
        const expected = ['write-failure', 'rename-failure', 'post-admission-cancellation'].includes(name) ? 'MO1307_OUTPUT' : ['write-cancellation', 'stalled-write-cancellation'].includes(name) ? 'MO1307_CANCELLED' : null;
        assert.ok(expected, name + ': unexpected failure ' + error.message);
        assert.equal(observedCode, expected);
        if (pending && name !== 'stalled-write-cancellation') await within(pending.catch(() => {}));
        if (name === 'post-admission-cancellation') {
          assert.equal(publicationStatus(token).phase, 'COMMITTED');
          assert.equal(publicationStatus(token).cancelledAfterAdmission, true);
          assert.deepEqual(await fs.readFile(path.join(destination, finalName)), bytes);
        } else if (name !== 'stalled-write-cancellation') await assert.rejects(fs.stat(path.join(destination, finalName)), error => error.code === 'ENOENT');
      } finally {
        fs.open = originalOpen; fs.rename = originalRename;
        await supervisor.dispose();
      }
      if (name.startsWith('success')) assert.equal(observedCode, null);
      else assert.notEqual(observedCode, null);
      assert.equal(supervisor.snapshot().activeRole, null);
      assert.equal(supervisor.snapshot().cleanupConfirmed, true);
      return { outcome: name.startsWith('success') ? 'COMMITTED' : observedCode, activeRole: null };
    })); } finally {
      if (releaseStalled) { releaseStalled(); await within(stalledPromise.catch(() => {})); }
    }
  }
  return rows;
}
