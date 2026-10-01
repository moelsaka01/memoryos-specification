import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
// Evidence-only source-derived copy of production runtime.mjs. The prospective
// helper bound is injected explicitly; CLI, aggregate, worker and cleanup
// limits and all ownership/termination behavior remain unchanged.
import { DEFINITIONS } from '../../../memoryos-readiness/src/constants.mjs';
import { ReadinessError, fail, operationalError } from '../../../memoryos-readiness/src/errors.mjs';
import { publicationStatus, recordPublicationInterruption, publicationTransportCheckpoint } from './prospective-publication.mjs';

const L = DEFINITIONS.limits;
const ENTRY = new URL('../../../memoryos-readiness/src/worker-entry.mjs', import.meta.url);
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const failureDeadlines = new WeakMap();
// Private error transport metadata; never appears in normative error fields.
export function failureCleanupDeadline(error) { return failureDeadlines.get(error) ?? null; }

export function createProspectiveSupervisor(options) { return buildSupervisor(options, {}); }
// Private engineering injection. Package root accepts no worker/runtime override.
export function createSupervisorForTesting(options, dependencies = {}) {
  return buildSupervisor(options, dependencies);
}

function buildSupervisor({ kind, signal, started, now = () => performance.now(), helperBoundMs } = {}, dependencies) {
  if (!['api', 'cli'].includes(kind) || typeof now !== 'function'
      || !Number.isFinite(helperBoundMs) || helperBoundMs <= L.helperDeadlineMs || helperBoundMs > L.helperAggregateDeadlineMs
      || (signal !== undefined && !(signal instanceof AbortSignal))) fail('INPUT', 'LAUNCH');
  const readNow = () => {
    const current = now();
    if (!Number.isFinite(current) || current < last) fail('INTERNAL', 'LAUNCH');
    last = current;
    return current;
  };
  let last = -Infinity;
  const initial = readNow();
  started ??= initial;
  if (!Number.isFinite(started) || started > initial) fail('INPUT', 'LAUNCH');
  const deadline = started + (kind === 'api' ? L.apiDeadlineMs : L.cliDeadlineMs);
  let terminal = null, terminalAt = null, terminalCleanupDeadline = null, disposed = false, active = null;
  let publication = null;
  const publicationView = () => publication ? publicationStatus(publication.token) : null;
  let helpers = 0, workers = 0, helperUsedMs = 0, clockTimer = null;
  const events = [], stopListeners = new Set();
  const record = (type, detail = {}) => events.push(Object.freeze({ type, at: readNow(), ...detail }));
  const stop = (error, stage = 'EVALUATION', dispositionDeadline = null) => {
    if (!terminal) {
      terminal = operationalError(error, stage); terminalAt = readNow();
      terminalCleanupDeadline = dispositionDeadline ?? terminalAt + L.cleanupAllowanceMs;
      failureDeadlines.set(terminal, dispositionDeadline ?? performance.now() + L.cleanupAllowanceMs);
      clearTimeout(clockTimer);
      record('terminal', { code: terminal.code, stage: terminal.stage });
      for (const listener of stopListeners) listener(terminal);
    }
    return terminal;
  };
  const checkpoint = (stage = 'EVALUATION', limit = active?.deadline ?? deadline) => {
    if (terminal) throw terminal;
    if (disposed) throw stop(new ReadinessError('INTERNAL', stage));
    const current = readNow();
    // An abort callback is itself a checkpoint. Equal-time first observation
    // chooses TIMEOUT; a previously terminal CANCELLED can never be replaced.
    const status = publicationView();
    const interruption = current >= Math.min(deadline, limit) ? 'TIMEOUT' : signal?.aborted ? 'CANCELLED' : null;
    if (interruption && status?.admitted) {
      const observed = [];
      if (current >= Math.min(deadline, limit) && !status.deadlineExpiredAfterAdmission) observed.push('MO1307_TIMEOUT');
      if (signal?.aborted && !status.cancelledAfterAdmission) observed.push('MO1307_CANCELLED');
      for (const code of observed) {
        recordPublicationInterruption(publication.token, code);
        record('publication-interruption', { code, phase: status.phase });
      }
      // An admitted rename owns settlement. Neither terminal failure nor the
      // two-second disposition clock can start before its actual outcome.
      if (!publication.transport) throw new ReadinessError(interruption, stage);
      throw stop(new ReadinessError('OUTPUT', 'PUBLICATION'));
    }
    if (interruption) throw stop(new ReadinessError(interruption, stage));
    return current;
  };
  const arm = () => {
    clearTimeout(clockTimer);
    if (disposed || terminal) return;
    const stage = active?.stage ?? 'EVALUATION';
    const limit = Math.min(deadline, active?.deadline ?? deadline);
    clockTimer = setTimeout(() => {
      try { checkpoint(stage, limit); arm(); } catch { /* stop wakes the owner */ }
    }, Math.max(1, Math.ceil(limit - readNow())));
    clockTimer.unref?.();
  };
  const onAbort = () => { try { checkpoint(active?.stage ?? 'LAUNCH'); } catch { /* terminal */ } };
  signal?.addEventListener('abort', onAbort, { once: true });
  arm();

  const cleanup = async (owner) => {
    const cleanupDeadline = terminalAt + L.cleanupAllowanceMs;
    let timer;
    try {
      try { owner.terminate?.(); } catch { /* still require closed observation */ }
      const remaining = Math.max(0, cleanupDeadline - readNow());
      const result = await Promise.race([
        Promise.resolve(owner.closed).then(() => true, () => false),
        new Promise(resolve => { timer = setTimeout(() => resolve(false), remaining); }),
      ]);
      owner.cleanupConfirmed = result === true && readNow() <= cleanupDeadline && owner.quiescence();
      if (!owner.cleanupConfirmed) owner.abandon?.();
      record('cleanup', { role: owner.kind, confirmed: owner.cleanupConfirmed });
    } finally { clearTimeout(timer); }
  };

  const runOwned = async (role, start, { stage = role === 'helper' ? 'ACQUISITION' : 'EVALUATION' } = {}) => {
    if (publicationView()?.admitted) throw new ReadinessError('INTERNAL', stage);
    checkpoint(stage);
    if (!['helper', 'worker'].includes(role) || typeof start !== 'function' || active
        || (role === 'helper' && kind !== 'cli') || (role === 'worker' && workers !== 0)) {
      throw stop(new ReadinessError('INTERNAL', stage));
    }
    const launch = readNow();
    const limit = role === 'helper'
      ? Math.min(deadline, launch + helperBoundMs, launch + L.helperAggregateDeadlineMs - helperUsedMs)
      : Math.min(deadline, launch + L.apiDeadlineMs);
    checkpoint(stage, limit);
    const owner = { kind: role, deadline: limit, stage, launch, terminate: null, closed: null, cleanupConfirmed: false, quiescence: () => true, abandon: null };
    active = owner;
    role === 'helper' ? helpers += 1 : workers += 1;
    let wake, settleOwner;
    owner.settled = new Promise(resolve => { settleOwner = resolve; });
    const stopped = new Promise((_, reject) => { wake = reject; stopListeners.add(wake); });
    // Install the rejecting promise before starting so synchronous launch abort
    // cannot lose cancellation. The catch also prevents an abandoned rejection.
    stopped.catch(() => {});
    record('start', { role, deadline: limit, ordinal: role === 'helper' ? helpers : workers });
    arm();
    try {
      const child = start(Object.freeze({ deadline: limit, checkpoint: () => checkpoint(stage, limit),
        fail: error => stop(error, stage), observe: detail => record('observation', { role, ...detail }) }));
      if (!child || typeof child.terminate !== 'function' || !child.completion || !child.closed) fail('INTERNAL', stage);
      owner.terminate = child.terminate; owner.closed = child.closed;
      owner.quiescence = child.quiescence ?? (() => true); owner.abandon = child.abandon;
      const result = await Promise.race([child.completion, stopped]);
      // completion is not authority for exit: closed must separately settle.
      await Promise.race([child.closed, stopped]);
      checkpoint(stage, limit);
      if (!owner.quiescence()) fail('INTERNAL', stage);
      owner.cleanupConfirmed = true;
      if (role === 'helper') helperUsedMs += readNow() - launch;
      record('quiescent', { role, ordinal: role === 'helper' ? helpers : workers });
      return result;
    } catch (error) {
      stop(error, stage);
      if (owner.closed) await cleanup(owner);
      else { owner.cleanupConfirmed = true; record('cleanup', { role, confirmed: true, launchFailed: true }); }
      throw terminal;
    } finally {
      stopListeners.delete(wake);
      if (owner.cleanupConfirmed) active = null;
      settleOwner(); arm();
    }
  };

  const runWorker = (input, { verify = false } = {}) => runOwned('worker', lease => {
    const WorkerClass = dependencies.WorkerClass ?? Worker;
    const worker = new WorkerClass(dependencies.workerURL ?? ENTRY, {
      workerData: { input, verify }, env: {}, execArgv: [], stdin: false, stdout: true, stderr: true,
      resourceLimits: { maxOldGenerationSizeMb: L.workerOldHeapMiB, maxYoungGenerationSizeMb: L.workerYoungHeapMiB },
      trackUnmanagedFds: true,
    });
    let resolveClosed, resolveCompletion, rejectCompletion, response = null, messages = 0, bytes = 0, exitCode;
    let stdoutClosed = false, stderrClosed = false, exited = false;
    const closed = new Promise(resolve => { resolveClosed = resolve; });
    const completion = new Promise((resolve, reject) => { resolveCompletion = resolve; rejectCompletion = reject; });
    const finish = () => {
      if (!exited || !stdoutClosed || !stderrClosed) return;
      resolveClosed();
      if (exitCode !== 0 || messages !== 1) rejectCompletion(new ReadinessError('INTERNAL', 'EVALUATION'));
      else if (response?.status === 'ERROR') rejectCompletion(new ReadinessError(response.code, response.stage, response.reference));
      else if (response?.status === 'OK') resolveCompletion(response.value);
      else rejectCompletion(new ReadinessError('INTERNAL', 'EVALUATION'));
    };
    const unexpectedOutput = data => {
      bytes += data.byteLength;
      lease.fail(new ReadinessError(bytes > L.stderrBytes ? 'RESOURCE_LIMIT' : 'INTERNAL', 'EVALUATION'));
    };
    worker.stdout.on('data', unexpectedOutput);
    worker.stderr.on('data', unexpectedOutput);
    worker.stdout.once('end', () => { stdoutClosed = true; finish(); });
    worker.stderr.once('end', () => { stderrClosed = true; finish(); });
    worker.stdout.on('error', () => lease.fail(new ReadinessError('INTERNAL', 'EVALUATION')));
    worker.stderr.on('error', () => lease.fail(new ReadinessError('INTERNAL', 'EVALUATION')));
    worker.on('message', value => {
      try {
        lease.checkpoint();
        if (++messages !== 1 || !value || typeof value !== 'object') fail('INTERNAL', 'EVALUATION');
        if (value.status === 'OK') value = { status: 'OK', value: validateWorkerValue(value.value, verify) };
        else if (value.status !== 'ERROR' || Object.keys(value).sort().join(',') !== 'code,reference,stage,status') fail('INTERNAL', 'EVALUATION');
        response = value;
      } catch (error) { lease.fail(error); }
    });
    worker.on('error', error => {
      const code = error?.code === 'ERR_WORKER_OUT_OF_MEMORY' ? 'RESOURCE_LIMIT' : 'INTERNAL';
      lease.fail(new ReadinessError(code, 'EVALUATION'));
    });
    worker.once('exit', code => { exited = true; exitCode = code; finish(); });
    lease.observe({ threadId: worker.threadId, resourceLimits: worker.resourceLimits });
    return { completion, closed, terminate: () => { worker.terminate().catch(() => {}); }, abandon: () => worker.unref() };
  });

  return Object.freeze({
    kind, deadline, now: readNow, checkpoint, runOwned, runWorker,
    async waitOperation(promise, { stage = 'PUBLICATION', publicationToken = null } = {}) {
      const operation = Promise.resolve(promise);
      operation.catch(() => {});
      if (publicationView()?.admitted) throw new ReadinessError('INTERNAL', stage);
      if (publicationToken) publicationStatus(publicationToken);
      const notifyInterruption = error => {
        if (publicationToken && ['MO1307_TIMEOUT', 'MO1307_CANCELLED'].includes(error.code)) {
          recordPublicationInterruption(publicationToken, error.code);
        }
      };
      let wake;
      try {
        // The promise may have started before this call. Even a failed initial
        // checkpoint must synchronously stop its publication-owned write timer.
        checkpoint(stage);
        const stopped = new Promise((_, reject) => {
          wake = error => { notifyInterruption(error); reject(error); };
          stopListeners.add(wake);
        });
        const value = await Promise.race([operation, stopped]);
        checkpoint(stage);
        return value;
      } catch (error) {
        const failure = stop(error, stage); notifyInterruption(failure); throw failure;
      } finally { stopListeners.delete(wake); }
    },
    async waitFinalization(token, operation) {
      if (kind !== 'cli' || publication || active || typeof operation !== 'function') fail('INTERNAL', 'PUBLICATION');
      checkpoint('PUBLICATION');
      if (publicationStatus(token).phase !== 'PRE_SUBMISSION') fail('OUTPUT', 'PUBLICATION');
      publication = { token, transport: false, task: null };
      arm();
      let wake;
      const task = (async () => {
        try {
          // Stop events may preempt only before admission. The exact admitted
          // operation owns this promise until its outcome is actually observed.
          const value = await new Promise((resolve, reject) => {
            wake = error => { if (!publicationStatus(token).admitted) reject(error); };
            stopListeners.add(wake);
            Promise.resolve().then(operation).then(resolve, reject);
          });
          const status = publicationView();
          if (status.phase === 'COMMIT_IN_PROGRESS' || !status.admitted) fail('INTERNAL', 'PUBLICATION');
          return value;
        } catch (error) {
          const status = publicationView();
          if (status.admitted) {
            if (status.phase === 'COMMIT_IN_PROGRESS') throw new ReadinessError('INTERNAL', 'PUBLICATION');
            throw stop(new ReadinessError('OUTPUT', 'PUBLICATION'), 'PUBLICATION', status.dispositionDeadline);
          }
          throw stop(error, 'PUBLICATION');
        } finally { stopListeners.delete(wake); }
      })();
      publication.task = task;
      return task;
    },
    beginPublicationTransport(token) {
      if (!publication || publication.token !== token || publication.transport) fail('INTERNAL', 'PUBLICATION');
      try { publicationTransportCheckpoint(token); }
      catch { throw stop(new ReadinessError('OUTPUT', 'PUBLICATION'), 'PUBLICATION', publicationStatus(token).dispositionDeadline); }
      publication.transport = true;
      record('publication-transport');
    },
    async terminate(error = new ReadinessError('INTERNAL', 'EVALUATION')) {
      if (publicationView()?.phase === 'COMMIT_IN_PROGRESS') await publication.task.catch(() => {});
      const status = publicationView();
      if (status?.admitted) stop(error?.code === 'MO1307_OUTPUT' ? error : new ReadinessError('OUTPUT', 'PUBLICATION'), 'PUBLICATION', publication.transport ? null : status.dispositionDeadline);
      else stop(error); if (active?.settled) await active.settled;
      return active === null;
    },
    async dispose() {
      if (publicationView()?.phase === 'COMMIT_IN_PROGRESS') await publication.task.catch(() => {});
      if (active && !terminal) stop(new ReadinessError('INTERNAL', 'EVALUATION'));
      if (active?.settled) await active.settled;
      disposed = true; clearTimeout(clockTimer); signal?.removeEventListener('abort', onAbort);
    },
    snapshot: () => ({ kind, deadline, helperBoundMs, helpers, workers, helperUsedMs, activeRole: active?.kind ?? null,
      cleanupConfirmed: active === null && publicationView()?.phase !== 'COMMIT_IN_PROGRESS', publication: publicationView(), terminalCode: terminal?.code ?? null, terminalAt,
      cleanupDeadline: terminalCleanupDeadline, events: events.map(row => ({ ...row })) }),
  });
}

function validateWorkerValue(value, verify) {
  const keys = ['proofBindingDigest', 'readinessDigest', 'resultBytes', ...(verify ? ['decision'] : [])].sort().join(',');
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join(',') !== keys
      || !(value.resultBytes instanceof Uint8Array) || value.resultBytes.buffer instanceof SharedArrayBuffer
      || value.resultBytes.byteLength > L.resultBytes || !DIGEST.test(value.readinessDigest) || !DIGEST.test(value.proofBindingDigest)) fail('INTERNAL', 'EVALUATION');
  if (verify && value.decision !== null && (!value.decision || Object.keys(value.decision).sort().join(',') !== 'authenticity,consistency,decision'
      || !['APPROVE', 'REJECT', 'DEFER'].includes(value.decision.decision)
      || !['CONSISTENT', 'CONTRARY_TO_READINESS'].includes(value.decision.consistency)
      || value.decision.authenticity !== 'NOT_VERIFIED_BY_MEMORYOS')) fail('INTERNAL', 'EVALUATION');
  return { resultBytes: Uint8Array.from(value.resultBytes), readinessDigest: value.readinessDigest,
    proofBindingDigest: value.proofBindingDigest, ...(verify ? { decision: structuredClone(value.decision) } : {}) };
}
