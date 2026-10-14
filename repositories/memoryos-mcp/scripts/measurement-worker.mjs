import { parentPort, workerData } from 'node:worker_threads';
import { execute } from '../src/delegation.mjs';
import { J } from '../src/deterministic.mjs';
const start = performance.now();
const initial = process.memoryUsage();
const result = await execute(workerData.name, workerData.args);
const text = J(result);
parentPort.postMessage({ status: result.status, errorCode: result.error?.code ?? null, outputBytes: Buffer.byteLength(text),
  elapsedMs: performance.now() - start, initial, final: process.memoryUsage(), maxRSSKiB: process.resourceUsage().maxRSS });
parentPort.close();
