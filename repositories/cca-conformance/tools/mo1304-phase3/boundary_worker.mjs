// Certification-only instrumentation, adapted from immutable B2 tests.
import { workerData,parentPort } from 'node:worker_threads';
import { guards,freshAudit } from './boundary_guard.mjs';
const audit=freshAudit();guards(workerData.phase3AuditRoot,audit);
const post=parentPort.postMessage.bind(parentPort);parentPort.postMessage=message=>post({...message,phase3Audit:audit});
await import(workerData.phase3OriginalWorker);
