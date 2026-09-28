import test from 'node:test';
import assert from 'node:assert/strict';
import { runTimerLifetimeWitness } from '../tools/mo1307-phase2c-continuation/timer-witness.mjs';

test('N24-C invocation timers clear after success, write/rename failure and pre/post-admission cancellation including a stalled write; no server, watcher or cross-run callbacks', async () => {
  const rows = await runTimerLifetimeWitness();
  assert.equal(rows.length, 7);
  process.stdout.write('# TIMER_WITNESS ' + JSON.stringify(rows) + '\n');
});
