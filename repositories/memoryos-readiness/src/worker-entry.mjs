import { parentPort, workerData } from 'node:worker_threads';
import { installWorkerPolicy } from './worker-policy.mjs';

// Worker input is a copied bounded byte record, never code or a module selector.
installWorkerPolicy();
try {
  const { assessInWorker } = await import('./integration.mjs');
  const value = assessInWorker(workerData.input, workerData.verify);
  parentPort.postMessage({ status: 'OK', value });
} catch (error) {
  const { operationalError } = await import('./errors.mjs');
  const safe = operationalError(error);
  parentPort.postMessage({ status: 'ERROR', code: safe.code, stage: safe.stage, reference: safe.reference });
} finally { parentPort.close(); }
