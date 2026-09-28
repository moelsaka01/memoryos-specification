// One finite native Windows regression. Framed identity fixtures are synthetic;
// the rename, libuv contention and namespace observations are actual filesystem I/O.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pbkdf2 } from 'node:crypto';
import { createHook } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';
import { ReadinessError } from '../../../memoryos-readiness/src/errors.mjs';
import { createPublication, stagePublication, finalizePublication, publicationStatus,
  recordPublicationInterruption, publicationTransportCheckpoint } from '../../../memoryos-readiness/src/publication.mjs';
import { fixtureInspection, finalName, pendingName } from '../mo1307-phase2c-correction/publication-fixture.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64'); assert.equal(process.version, 'v24.21.0');
assert.equal(process.env.UV_THREADPOOL_SIZE, undefined); assert.equal(process.argv.length, 3);
const receiptPath = path.resolve(process.argv[2]);
const relative = path.relative(root, receiptPath).replaceAll('\\', '/');
assert.ok(relative.startsWith('repositories/cca-conformance/evidence/mo1307/phase2c-finalization-correction/')
  || relative.startsWith('.cache/mo1307/phase2c-finalization-correction/post-binding/'));
const scratchParent = path.join(root, '.cache/mo1307/phase2c-finalization-correction'); fs.mkdirSync(scratchParent, { recursive: true });
const scratch = path.join(scratchParent, 'queued-' + process.pid); fs.mkdirSync(scratch, { recursive: false });
const output = path.join(scratch, 'output'), pendingPath = path.join(output, pendingName), finalPath = path.join(output, finalName);
const bytes = Buffer.from('{"engineering":"actual-queued-rename-settlement"}\n');
const jobs = [], completedJobs = []; let began, admittedAt, deadline, finalInspection = false, finalChecks = 0, timer;
let token, settled = false, observation = null, submittedAt = null, renameRequests = 0;
let timerDone; const observedTimer = new Promise(resolve => { timerDone = resolve; });
const inspection = await fixtureInspection(output, {
  observe: request => { if (request.operation === 'CHECK_FINALIZATION') finalInspection = true; },
  checkpoint: () => {
    if (deadline !== undefined && performance.now() >= deadline) throw new ReadinessError('TIMEOUT', 'PUBLICATION');
    if (!finalInspection || ++finalChecks !== 2) return;
    admittedAt = performance.now(); deadline = admittedAt + 50;
    for (let i = 0; i < 4; i++) jobs.push(new Promise((resolve, reject) => {
      pbkdf2('fixed-engineering-input', 'fixed-engineering-salt', 1000000, 16, 'sha512', error => {
        completedJobs.push({ job: i, elapsedMs: performance.now() - began }); error ? reject(error) : resolve();
      });
    }));
    timer = setTimeout(() => {
      observation = { elapsedMs: performance.now() - began, statusBefore: publicationStatus(token),
        finalizeSettled: settled, finalPresent: fs.existsSync(finalPath), pendingPresent: fs.existsSync(pendingPath) };
      recordPublicationInterruption(token, 'MO1307_TIMEOUT');
      observation.statusAfter = recordPublicationInterruption(token, 'MO1307_CANCELLED');
      timerDone();
    }, Math.max(1, Math.ceil(deadline - performance.now())));
  },
});
token = await createPublication(output, { inspection }); await stagePublication(token, bytes);
const hook = createHook({ init(_id, type) {
  if (type === 'FSREQPROMISE' && publicationStatus(token).phase === 'COMMIT_IN_PROGRESS') {
    renameRequests++; submittedAt ??= performance.now() - began;
  }
} });
began = performance.now(); hook.enable();
let result, failure = null;
try { result = await finalizePublication(token); } catch (error) { failure = { code: error.code, stage: error.stage }; }
finally { settled = true; hook.disable(); }
const completedAt = performance.now() - began;
await observedTimer; clearTimeout(timer); await Promise.all(jobs);
const finalStatus = publicationStatus(token), finalPresent = fs.existsSync(finalPath), pendingPresent = fs.existsSync(pendingPath);
let transportError = null;
try { publicationTransportCheckpoint(token); } catch (error) { transportError = error.code; }
const sameBytes = finalPresent && Buffer.compare(await fsp.readFile(finalPath), bytes) === 0;
const accepted = failure === null && renameRequests === 1 && jobs.length === 4 && submittedAt !== null
  && submittedAt < deadline - began && observation?.elapsedMs >= deadline - began
  && observation.finalizeSettled === false && observation.statusBefore.phase === 'COMMIT_IN_PROGRESS'
  && observation.finalPresent === false && observation.pendingPresent === true
  && finalStatus.phase === 'COMMITTED' && finalStatus.namespaceVerified === true
  && finalStatus.deadlineExpiredAfterAdmission && finalStatus.cancelledAfterAdmission
  && finalPresent && !pendingPresent && sameBytes && transportError === 'MO1307_OUTPUT';
const receipt = { kind: 'MO1307CorrectedQueuedRenameRegression', version: '1.0.0', result: accepted ? 'PASS' : 'FAIL',
  scope: 'ONE_REAL_QUEUED_RENAME_WITH_SYNTHETIC_FRAMED_IDENTITY_FIXTURES', processId: process.pid,
  runtime: process.version, platform: process.platform, arch: process.arch, engineeringAdmissionWindowMs: 50,
  defaultLibuvThreads: 4, finitePbkdf2Jobs: 4, iterationsPerJob: 1000000,
  admissionCheckpointAtMs: admittedAt - began, submittedAtMs: submittedAt,
  submissionTimingSource: 'FSREQPROMISE init inside the actual unmodified fs.promises.rename call while foundation phase is COMMIT_IN_PROGRESS',
  admissionDeadlineAtMs: deadline - began, observation, completedAtMs: completedAt, completedJobs,
  renameRequests, failure, finalStatus, resultProjection: result ?? null,
  finalPresent, pendingPresent, sameBytes, transportError,
  noEarlyTimeoutOrCancellation: !failure && observation?.finalizeSettled === false,
  productMutationAuthority: 'One actual same-directory rename only; no custom rename hook, no cleanup deletion, no retry.',
  engineeringScope: 'One parent-bounded child; no helper/worker launch or full native acquisition acceptance. Existing libuv contention jobs are engineering only.',
  settlementBoundClaimed: false };
fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify(receipt) + '\n');
if (!accepted) process.exitCode = 1;
