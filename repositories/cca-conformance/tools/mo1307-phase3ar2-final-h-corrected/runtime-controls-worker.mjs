// Reviewed engineering-only real thread. No filesystem/process/network access,
// semantic authority or public selector; only bounded timing and canned bytes.
import { workerData, parentPort } from 'node:worker_threads';
const input = workerData.input;
if (input.mode === 'spin') { while (true) {} }
if (input.mode === 'wait') {
  if (!Number.isInteger(input.delayMs) || input.delayMs < 0 || input.delayMs > 11000) throw new Error('engineering delay bound');
  await new Promise(resolve => setTimeout(resolve, input.delayMs));
}
parentPort.postMessage({ status: 'OK', value: { resultBytes: new Uint8Array([10]),
  readinessDigest: 'sha256:' + '1'.repeat(64), proofBindingDigest: 'sha256:' + '2'.repeat(64) } });
parentPort.close();