// One finite native diagnostic of the frozen async rename / terminal deadline
// boundary. The engineering workload occupies existing libuv pool threads;
// it creates no process, worker, network request, or publication authority.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pbkdf2 } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createSupervisor } from '../../../memoryos-readiness/src/runtime.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const evidence = path.join(root, 'repositories/cca-conformance/evidence/mo1307/phase2c-continuation/rename-boundary-diagnostic');
const scratch = path.join(root, '.cache/mo1307-phase2c-continuation-rename-' + process.pid);
fs.mkdirSync(scratch, { recursive: false });
const pending = path.join(scratch, 'memoryos-readiness-result.json.pending');
const final = path.join(scratch, 'memoryos-readiness-result.json');
fs.writeFileSync(pending, Buffer.from('{"engineering":"native-pending-rename-witness"}\n'), { flag: 'wx' });
if (process.env.UV_THREADPOOL_SIZE !== undefined) throw new Error('Unexpected threadpool override');
const began = performance.now(), cryptoJobs = [], completedJobs = [];
// These are finite independent contention jobs, not product computation.
// Node's default pool has four threads; enqueue all four before native rename.
for (let i = 0; i < 4; i += 1) cryptoJobs.push(new Promise((resolve, reject) => {
  pbkdf2('fixed-engineering-input', 'fixed-engineering-salt', 1000000, 16, 'sha512', error => {
    completedJobs.push({ job: i, elapsedMs: performance.now() - began });
    error ? reject(error) : resolve();
  });
}));
const supervisor = createSupervisor({ kind: 'cli', started: performance.now() - 29950 });
let observedError = null, atFailure, finalAtFailure, pendingAtFailure, nativeCompleted = false;
supervisor.checkpoint('PUBLICATION');
const submittedAt = performance.now() - began;
const rename = fsp.rename(pending, final).then(() => { nativeCompleted = true; });
try { await supervisor.waitOperation(rename, { stage: 'PUBLICATION' }); }
catch (error) {
  observedError = { code: error.code, stage: error.stage };
  atFailure = performance.now() - began;
  finalAtFailure = fs.existsSync(final);
  pendingAtFailure = fs.existsSync(pending);
}
const nativeCompletedAtFailure = nativeCompleted;
await rename;
const afterNativeRename = performance.now() - began;
await Promise.all(cryptoJobs);
const finalAfter = fs.existsSync(final), pendingAfter = fs.existsSync(pending);
const snapshot = supervisor.snapshot();
await supervisor.dispose();
const result = observedError?.code === 'MO1307_TIMEOUT' && finalAtFailure === false && pendingAtFailure === true
  && nativeCompletedAtFailure === false && finalAfter === true && pendingAfter === false ? 'CONFLICT_REPRODUCED' : 'INCONCLUSIVE';
const receipt = { kind: 'MO1307SubmittedNativeRenameDeadlineDiagnostic', result, runtime: process.version,
  platform: process.platform, arch: process.arch, processId: process.pid,
  mechanism: 'Actual fs.promises.rename queued behind four bounded engineering PBKDF2 jobs on existing libuv threads.',
  declaredScope: 'One classification diagnostic; not a production implementation, acceptance retry, or claim of filesystem cancellation.',
  remainingCliBudgetMs: 50, submittedAt, observedError, atFailure, finalAtFailure, pendingAtFailure,
  nativeCompletedAtFailure, afterNativeRename, finalAfter, pendingAfter, completedJobs, snapshot,
  statement: 'The final path did not exist when the terminal timeout was observed. The same submitted native rename later created it. This is not only a delayed callback after an already committed rename.',
  implications: ['Blind Promise.race around finalization can suppress returned success but cannot suppress a submitted native rename.',
    'Awaiting the non-abortable operation without a race cannot bound an indefinitely stalled wait.',
    'The commit point remains successful native rename; it is not operation submission.'] };
fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify(receipt) + '\n');
