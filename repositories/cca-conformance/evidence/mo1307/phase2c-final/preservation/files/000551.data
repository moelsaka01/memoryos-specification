import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createSupervisorForTesting } from '../../memoryos-readiness/src/runtime.mjs';
const workerURL = new URL('../tools/mo1307-phase2c-resumed/runtime-worker.mjs', import.meta.url);
const receipt = new URL('../evidence/mo1307/phase2c-resumed/runtime/native-worker-deadline.json', import.meta.url);
test('NRT01 native CPU-bound worker is terminated at fixed 10000ms CLI evaluation deadline', { timeout: 14000 }, async () => {
  const started = performance.now();
  const supervisor = createSupervisorForTesting({ kind: 'cli' }, { workerURL });
  let error;
  try { await supervisor.runWorker({ mode: 'spin' }); assert.fail('late success'); }
  catch (caught) { error = caught; }
  finally { await supervisor.dispose(); }
  const elapsedMs = performance.now() - started;
  const snapshot = supervisor.snapshot();
  await fs.writeFile(receipt, JSON.stringify({ runtime: process.version, platform: process.platform,
    case: 'NRT01', elapsedMs, errorCode: error?.code, snapshot,
    witness: 'Actual Node worker thread executing an infinite CPU loop; production supervisor external timer and Worker.terminate; fixed 10000ms sub-budget.' }, null, 2) + '\n', { flag: 'wx' });
  assert.equal(error.code, 'MO1307_TIMEOUT');
  assert.equal(snapshot.workers, 1); assert.equal(snapshot.cleanupConfirmed, true);
  assert.ok(elapsedMs >= 10000 && elapsedMs < 12000, String(elapsedMs));
});
