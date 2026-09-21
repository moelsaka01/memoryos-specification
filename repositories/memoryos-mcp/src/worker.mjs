import { parentPort, workerData } from 'node:worker_threads';
import { execute } from './delegation.mjs';
import { J } from './deterministic.mjs';
import { adapterError } from './errors.mjs';

// Exactly one operation, then the owner terminates/reaps this worker.
try {
  const product = await execute(workerData.name, workerData.args);
  const text = J(product);
  const result = Buffer.byteLength(text) <= workerData.outputBytes ? text
    : J(adapterError('MO1304_OUTPUT_LIMIT', 'publication'));
  parentPort.postMessage({ generation: workerData.generation, text: result });
} catch {
  parentPort.postMessage({ generation: workerData.generation,
    text: J(adapterError('MO1304_INTERNAL_FAILURE', 'worker')) });
} finally { parentPort.close(); }
