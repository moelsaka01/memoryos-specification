import { workerData,parentPort } from 'node:worker_threads';
import { guards,freshAudit } from './phase2-guard.mjs';
const audit=freshAudit();guards(workerData.phase2AuditRoot,audit);
const post=parentPort.postMessage.bind(parentPort);parentPort.postMessage=message=>post({...message,phase2Audit:audit});
await import(workerData.phase2OriginalWorker);
