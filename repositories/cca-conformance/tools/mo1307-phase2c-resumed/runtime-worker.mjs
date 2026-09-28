// Reviewed engineering worker: canned bytes only. Never installed or selected by
// product inputs. Supports finite lifecycle witnesses without 2A/2B authority.
import { workerData, parentPort, resourceLimits } from 'node:worker_threads';
const { input, verify } = workerData;
if (input.mode === 'policy') {
  const { installWorkerPolicy } = await import('../../../memoryos-readiness/src/worker-policy.mjs');
  installWorkerPolicy();
  const outcomes = {};
  for (const name of ['node:fs', 'node:fs/promises', 'node:http', 'node:https', 'node:net', 'node:tls', 'node:dgram', 'node:dns', 'node:child_process', 'node:vm', 'node:worker_threads']) {
    try { await import(name); outcomes[name] = false; } catch { outcomes[name] = true; }
  }
  for (const [name, call] of [['fetch', () => fetch('https://example.invalid')], ['getBuiltinModule', () => process.getBuiltinModule('fs')]]) {
    try { call(); outcomes[name] = false; } catch { outcomes[name] = true; }
  }
  input.value = { resultBytes: Buffer.from(JSON.stringify(outcomes)) };
}
if (input.mode === 'spin') { while (true) {} }
if (input.mode === 'crash') throw new Error('engineering crash');
if (input.mode === 'stdout') process.stdout.write('unexpected');
if (input.mode === 'late') await new Promise(resolve => setTimeout(resolve, 15000));
const value = { resultBytes: new Uint8Array([10]), readinessDigest: 'sha256:' + '1'.repeat(64), proofBindingDigest: 'sha256:' + '2'.repeat(64) };
if (verify) value.decision = null;
if (input.mode === 'environment') value.resultBytes = Buffer.from(JSON.stringify({ environment: process.env, resourceLimits }));
if (input.value) Object.assign(value, input.value);
parentPort.postMessage({ status: 'OK', value });
if (input.mode === 'duplicate') parentPort.postMessage({ status: 'OK', value });
if (input.mode === 'hold') await new Promise(resolve => setTimeout(resolve, 100));
parentPort.close();
