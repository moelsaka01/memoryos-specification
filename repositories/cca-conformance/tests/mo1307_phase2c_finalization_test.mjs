import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage, createHook } from 'node:async_hooks';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { ReadinessError } from '../../memoryos-readiness/src/errors.mjs';
import { createPublication, stagePublication, finalizePublication, publicationStatus,
  recordPublicationInterruption, publicationTransportCheckpoint } from '../../memoryos-readiness/src/publication.mjs';
import { fixtureInspection, pendingName, finalName } from '../tools/mo1307-phase2c-correction/publication-fixture.mjs';

const attempt = fileURLToPath(new URL(`../../../.cache/mo1307/phase2c-finalization-correction/focused-${process.pid}/`, import.meta.url));
const bytes = Buffer.from('{"engineering":"finalization-boundary"}\n');
const rejects = (fn, expected) => assert.rejects(fn, error => error.code === 'MO1307_' + expected);
const throws = (fn, expected) => assert.throws(fn, error => error.code === 'MO1307_' + expected);
async function staged(name, checkpoint = () => {}) {
  await fs.mkdir(attempt, { recursive: true }); const root = path.join(attempt, name);
  const inspection = await fixtureInspection(root, { checkpoint });
  const token = await createPublication(root, { inspection }); await stagePublication(token, bytes);
  return { root, token, pending: path.join(root, pendingName), final: path.join(root, finalName) };
}
async function deferredRename(action) {
  const original = fs.rename; let release, reject, calls = 0, submitted;
  const admission = new Promise(resolve => { submitted = resolve; });
  fs.rename = (from, to) => {
    calls++; submitted();
    return new Promise((resolve, failure) => {
      release = () => original(from, to).then(resolve, failure); reject = failure;
    });
  };
  try { await action({ admission, release: () => release(), reject: error => reject(error), count: () => calls }); }
  finally { fs.rename = original; }
}
async function auditTimers(action) {
  const scope = new AsyncLocalStorage(), marker = {}, live = new Set(); let settled = false, lateCallbacks = 0;
  const hook = createHook({ init(id, type) { if (type === 'Timeout' && scope.getStore() === marker) live.add(id); },
    before(id) { if (settled && live.has(id)) lateCallbacks++; }, destroy(id) { live.delete(id); } });
  hook.enable();
  try { await scope.run(marker, action); settled = true; await nextTurn(); await nextTurn();
    return { live: live.size, lateCallbacks }; }
  finally { hook.disable(); scope.disable(); }
}

test('F01 publication status is an immutable operational snapshot before submission', async () => {
  const { token } = await staged('initial'); const status = publicationStatus(token);
  assert.deepEqual(status, { phase: 'PRE_SUBMISSION', admitted: false, deadlineExpiredAfterAdmission: false,
    cancelledAfterAdmission: false, namespaceVerified: false, dispositionDeadline: null });
  assert.equal(Object.isFrozen(status), true); throws(() => publicationStatus({}), 'OUTPUT');
});
test('F02 timeout before submission prevents any rename and retains pending', async () => {
  const item = await staged('timeout-before'); recordPublicationInterruption(item.token, 'MO1307_TIMEOUT');
  let called = false; const original = fs.rename; fs.rename = async () => { called = true; };
  try { await rejects(() => finalizePublication(item.token), 'TIMEOUT'); } finally { fs.rename = original; }
  assert.equal(called, false); assert.equal(existsSync(item.final), false); assert.deepEqual(await fs.readFile(item.pending), bytes);
});
test('F03 cancellation before submission prevents rename and is terminal', async () => {
  const item = await staged('cancel-before'); recordPublicationInterruption(item.token, 'MO1307_CANCELLED');
  await rejects(() => finalizePublication(item.token), 'CANCELLED'); await rejects(() => finalizePublication(item.token), 'OUTPUT');
  assert.equal(existsSync(item.final), false); assert.deepEqual(await fs.readFile(item.pending), bytes);
});
test('F04 actual admission checkpoint rejects a deadline reached after final native inspection', async () => {
  await fs.mkdir(attempt, { recursive: true }); const root = path.join(attempt, 'admission-equality'); let finalInspection = false, checks = 0;
  const inspection = await fixtureInspection(root, { observe: req => { if (req.operation === 'CHECK_FINALIZATION') finalInspection = true; },
    checkpoint: () => { if (finalInspection && ++checks === 2) throw new ReadinessError('TIMEOUT', 'PUBLICATION'); } });
  const token = await createPublication(root, { inspection }); await stagePublication(token, bytes);
  await rejects(() => finalizePublication(token), 'TIMEOUT'); assert.equal(existsSync(path.join(root, finalName)), false);
});
test('F05 admitted delayed success remains unresolved at post-submission deadline', async () => {
  const item = await staged('delayed-timeout');
  await deferredRename(async gate => {
    let settled = false; const pending = finalizePublication(item.token).finally(() => { settled = true; });
    await gate.admission; assert.equal(publicationStatus(item.token).phase, 'COMMIT_IN_PROGRESS');
    assert.equal(publicationStatus(item.token).dispositionDeadline, null);
    const observed = recordPublicationInterruption(item.token, 'MO1307_TIMEOUT');
    assert.equal(observed.deadlineExpiredAfterAdmission, true); await nextTurn();
    assert.equal(settled, false); assert.equal(existsSync(item.final), false); assert.equal(existsSync(item.pending), true);
    await gate.release(); assert.deepEqual(await pending, { path: item.final, byteLength: bytes.length });
    assert.equal(gate.count(), 1); assert.equal(publicationStatus(item.token).phase, 'COMMITTED');
    assert.equal(publicationStatus(item.token).namespaceVerified, true);
    assert.ok(Number.isFinite(publicationStatus(item.token).dispositionDeadline));
  });
});
test('F06 cancellation after submission is recorded without early cancellation or namespace cleanup', async () => {
  const item = await staged('delayed-cancel');
  await deferredRename(async gate => {
    let settled = false; const pending = finalizePublication(item.token).finally(() => { settled = true; });
    await gate.admission; recordPublicationInterruption(item.token, 'MO1307_CANCELLED'); await nextTurn();
    assert.equal(settled, false); assert.deepEqual(await fs.readFile(item.pending), bytes); assert.equal(existsSync(item.final), false);
    assert.equal(publicationStatus(item.token).cancelledAfterAdmission, true);
    await gate.release(); await pending; assert.deepEqual(await fs.readFile(item.final), bytes);
  });
});
test('F07 admitted failure after deadline resolves OUTPUT only after exact submitted operation settles', async () => {
  const item = await staged('delayed-failure');
  await deferredRename(async gate => {
    const pending = finalizePublication(item.token); await gate.admission;
    recordPublicationInterruption(item.token, 'MO1307_TIMEOUT'); recordPublicationInterruption(item.token, 'MO1307_CANCELLED');
    const checked = rejects(() => pending, 'OUTPUT'); gate.reject(Object.assign(new Error('fixture rename rejection'), { code: 'EACCES' })); await checked;
    assert.equal(gate.count(), 1); assert.equal(publicationStatus(item.token).phase, 'FAILED'); assert.equal(publicationStatus(item.token).admitted, true);
    assert.ok(Number.isFinite(publicationStatus(item.token).dispositionDeadline));
    assert.deepEqual(await fs.readFile(item.pending), bytes); assert.equal(existsSync(item.final), false);
  });
});
test('F08 no second rename or token reuse while an admitted rename is outstanding', async () => {
  const item = await staged('no-second');
  await deferredRename(async gate => {
    const pending = finalizePublication(item.token); await gate.admission;
    await rejects(() => finalizePublication(item.token), 'OUTPUT'); await rejects(() => stagePublication(item.token, bytes), 'OUTPUT');
    assert.equal(gate.count(), 1); await gate.release(); await pending; assert.equal(gate.count(), 1);
  });
});
test('F09 commit status changes only after successful actual rename and then preserves bytes', async () => {
  const item = await staged('commit-point');
  await deferredRename(async gate => {
    const pending = finalizePublication(item.token); await gate.admission;
    assert.equal(publicationStatus(item.token).phase, 'COMMIT_IN_PROGRESS'); assert.equal(existsSync(item.final), false);
    await gate.release(); await pending; assert.equal(publicationStatus(item.token).phase, 'COMMITTED');
    assert.equal(existsSync(item.pending), false); assert.deepEqual(await fs.readFile(item.final), bytes);
  });
});
test('F10 mandatory checkpoint overrun after settlement is operational metadata, not precommit TIMEOUT', async () => {
  let expired = false; const item = await staged('settlement-observation', () => { if (expired) throw new ReadinessError('TIMEOUT', 'PUBLICATION'); });
  await deferredRename(async gate => { const pending = finalizePublication(item.token); await gate.admission; expired = true;
    await gate.release(); await pending; assert.equal(publicationStatus(item.token).deadlineExpiredAfterAdmission, true); });
});
test('F11 postcommit deadline or cancellation prevents a success summary and retains committed final', async () => {
  for (const code of ['MO1307_TIMEOUT', 'MO1307_CANCELLED']) {
    const item = await staged('transport-' + code); await finalizePublication(item.token); recordPublicationInterruption(item.token, code);
    throws(() => publicationTransportCheckpoint(item.token), 'OUTPUT'); assert.deepEqual(await fs.readFile(item.final), bytes);
    assert.equal(publicationStatus(item.token).phase, 'COMMITTED');
  }
});
test('F12 normal verified commit permits transport while precommit and failed tokens do not', async () => {
  const item = await staged('transport-normal'); throws(() => publicationTransportCheckpoint(item.token), 'OUTPUT');
  await finalizePublication(item.token); publicationTransportCheckpoint(item.token);
  await rejects(() => finalizePublication(item.token), 'OUTPUT'); assert.deepEqual(await fs.readFile(item.final), bytes);
});
test('F13 wrong interruption code and foreign token cannot create publication authority', async () => {
  const item = await staged('invalid-interruption'); throws(() => recordPublicationInterruption({}, 'MO1307_TIMEOUT'), 'OUTPUT');
  throws(() => recordPublicationInterruption(item.token, 'MO1307_INTERNAL'), 'OUTPUT');
});
test('F14 changed pending bytes before admission prevent rename', async () => {
  const item = await staged('changed-pending'); await fs.writeFile(item.pending, Buffer.alloc(bytes.length, 0x20));
  await rejects(() => finalizePublication(item.token), 'OUTPUT'); assert.equal(publicationStatus(item.token).admitted, false);
  assert.equal(existsSync(item.final), false);
});
test('F15 existing final is retained and finalization never retries or chooses another basename', async () => {
  const item = await staged('existing-final'); await fs.writeFile(item.final, 'preexisting', { flag: 'wx' });
  await rejects(() => finalizePublication(item.token), 'OUTPUT'); await rejects(() => finalizePublication(item.token), 'OUTPUT');
  assert.equal(await fs.readFile(item.final, 'utf8'), 'preexisting'); assert.deepEqual((await fs.readdir(item.root)).sort(), [finalName, pendingName].sort());
});
test('F16 postcommit transport error cannot retract or reclassify committed final as partial', async () => {
  const item = await staged('stdout-failure'); await finalizePublication(item.token); publicationTransportCheckpoint(item.token);
  const stdout = { write() { throw new ReadinessError('OUTPUT', 'PUBLICATION'); } };
  throws(() => stdout.write('summary\n'), 'OUTPUT'); assert.deepEqual(await fs.readFile(item.final), bytes);
  assert.equal(publicationStatus(item.token).phase, 'COMMITTED'); assert.equal(existsSync(item.pending), false);
});
test('F17 bounded invocation timers are allowed and destroyed after successful operation', async () => {
  const observed = await auditTimers(async () => { let timer;
    try { await new Promise(resolve => { timer = setTimeout(resolve, 1); }); } finally { clearTimeout(timer); } });
  assert.deepEqual(observed, { live: 0, lateCallbacks: 0 });
});
test('F18 timer lifetime policy detects a persistent cross-run scheduler', async () => {
  let leaked; try {
    const observed = await auditTimers(async () => { leaked = setInterval(() => {}, 1000); });
    assert.equal(observed.live, 1); assert.throws(() => assert.equal(observed.live, 0));
  } finally { clearInterval(leaked); }
});
test('F19 actual foundation finalization leaves no live timers across sequential invocations', async () => {
  for (const name of ['timer-success-a', 'timer-success-b']) {
    const observed = await auditTimers(async () => { const item = await staged(name); await finalizePublication(item.token); });
    assert.deepEqual(observed, { live: 0, lateCallbacks: 0 });
  }
});
test('F20 failed and cancelled foundation calls leave no cross-run timers', async () => {
  for (const [name, code] of [['timer-cancel', 'CANCELLED'], ['timer-timeout', 'TIMEOUT']]) {
    const observed = await auditTimers(async () => { const item = await staged(name); recordPublicationInterruption(item.token, 'MO1307_' + code);
      await rejects(() => finalizePublication(item.token), code); });
    assert.deepEqual(observed, { live: 0, lateCallbacks: 0 });
  }
});
test('F21 failed read-only namespace verification retains committed output and clears its timer', async () => {
  const item = await staged('verification-failure'); const original = fs.open;
  const observed = await auditTimers(async () => {
    fs.open = async (name, ...args) => { if (name === item.final) throw Object.assign(new Error('fixture access failure'), { code: 'EACCES' });
      return original(name, ...args); };
    try { await rejects(() => finalizePublication(item.token), 'OUTPUT'); } finally { fs.open = original; }
  });
  assert.deepEqual(observed, { live: 0, lateCallbacks: 0 });
  assert.equal(publicationStatus(item.token).phase, 'COMMITTED'); assert.equal(publicationStatus(item.token).namespaceVerified, false);
  assert.deepEqual(await fs.readFile(item.final), bytes); throws(() => publicationTransportCheckpoint(item.token), 'OUTPUT');
});
test('F22 read-only verification timeout is bounded and late handle completion only closes', async () => {
  const item = await staged('verification-timeout'); const original = fs.open; let release, closed = 0;
  const observed = await auditTimers(async () => {
    fs.open = (name, ...args) => name === item.final ? new Promise(resolve => { release = async () => {
      const handle = await original(name, ...args), close = handle.close.bind(handle);
      handle.close = async () => { closed++; await close(); }; resolve(handle);
    }; }) : original(name, ...args);
    try {
      const began = performance.now(); await rejects(() => finalizePublication(item.token), 'OUTPUT');
      assert.ok(performance.now() - began < 5000, 'Readonly confirmation must stop within the bounded engineering tolerance');
      assert.equal(publicationStatus(item.token).phase, 'COMMITTED'); assert.equal(publicationStatus(item.token).namespaceVerified, false);
      assert.ok(performance.now() >= publicationStatus(item.token).dispositionDeadline);
      await release(); await nextTurn(); await nextTurn();
    } finally { fs.open = original; }
  });
  assert.deepEqual(observed, { live: 0, lateCallbacks: 0 }); assert.equal(closed, 1);
  assert.deepEqual(await fs.readFile(item.final), bytes); assert.equal(existsSync(item.pending), false);
});
test('F23 interruption recorded while pre-submission read is pending prevents later admission', async () => {
  const item = await staged('pre-read-interruption'), original = fs.open; let release, entered;
  const readEntered = new Promise(resolve => { entered = resolve; });
  fs.open = (name, ...args) => name === item.pending && args[0] === 'r' ? new Promise(resolve => {
    entered(); release = async () => resolve(await original(name, ...args));
  }) : original(name, ...args);
  try {
    const pending = finalizePublication(item.token); await readEntered; recordPublicationInterruption(item.token, 'MO1307_CANCELLED');
    const checked = rejects(() => pending, 'CANCELLED'); await release(); await checked;
  } finally { fs.open = original; }
  assert.equal(publicationStatus(item.token).admitted, false); assert.equal(existsSync(item.final), false);
});
test('F24 the first observed pre-submission interruption remains terminal', async () => {
  const item = await staged('first-interruption'); recordPublicationInterruption(item.token, 'MO1307_CANCELLED');
  recordPublicationInterruption(item.token, 'MO1307_TIMEOUT'); await rejects(() => finalizePublication(item.token), 'CANCELLED');
  assert.equal(publicationStatus(item.token).admitted, false); assert.deepEqual(await fs.readFile(item.pending), bytes);
});
