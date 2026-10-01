// Evidence-only source-derived prospective-H copy of the private sequence and
// publication-inspection owner in production helper-protocol.mjs. Request and
// response validation remain the production implementation. The only deadline
// change is the explicit frozen H for each helper; 20s aggregate and 30s CLI
// limits remain the production constants.
import { performance } from 'node:perf_hooks';
import {
  decodeHelperRequest,
  decodeHelperResponse,
  encodeHelperRequest,
  validateHelperRequest,
} from '../../../memoryos-readiness/src/helper-protocol.mjs';
import { DEFINITIONS } from '../../../memoryos-readiness/src/constants.mjs';
import { fail } from '../../../memoryos-readiness/src/errors.mjs';
import { assertStableIdentity, validateAbsoluteRoot } from '../../../memoryos-readiness/src/windows-paths.mjs';

const L = DEFINITIONS.limits;
const SESSION = /^[a-f0-9]{64}$/;
const PUBLICATION_OPERATIONS = ['CHECK_OUTPUT', 'INSPECT_OUTPUT_ROOT', 'CHECK_STAGE_ROOT', 'INSPECT_PENDING', 'CHECK_FINALIZATION'];
const sequences = new WeakMap();
const inspections = new WeakMap();
function reject(code = 'INPUT') { fail(code, 'ACQUISITION', null); }
function closed(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).sort().join(',') !== keys.join(',')) reject();
}

export function createProspectiveHelperSequence(command, {
  session,
  helperBoundMs,
  now = () => performance.now(),
  afterHelperExited,
} = {}) {
  if (!['evaluate', 'verify'].includes(command) || typeof session !== 'string' || !SESSION.test(session)
      || typeof now !== 'function' || !Number.isFinite(helperBoundMs)
      || helperBoundMs <= L.helperDeadlineMs || helperBoundMs > L.helperAggregateDeadlineMs
      || (afterHelperExited !== undefined && typeof afterHelperExited !== 'function')) reject();
  const start = now();
  if (!Number.isFinite(start)) reject();
  const state = { command, session, helperBoundMs, start, next: 1, active: null, completed: null, awaitingExit: false, failed: false,
    worker: 'NOT_STARTED', output: null, parent: null, claimed: false, usedMs: 0, launched: null, last: start, events: [] };
  const event = (type, at, detail = {}) => state.events.push({ type, at, ...detail });
  const terminal = fn => { try { if (state.failed) reject(); return fn(); } catch (error) { state.failed = true; throw error; } };
  const checkpoint = () => terminal(() => {
    const current = now();
    if (!Number.isFinite(current) || current < state.last) reject();
    state.last = current;
    if (current >= start + L.cliDeadlineMs || (state.launched !== null
        && (current >= state.launched + helperBoundMs
          || state.usedMs + current - state.launched >= L.helperAggregateDeadlineMs))) fail('TIMEOUT', 'ACQUISITION', null);
    return current;
  });
  const api = Object.freeze({
    session,
    begin(request) { return terminal(() => {
      const current = checkpoint();
      validateHelperRequest(request);
      if (state.active || state.awaitingExit || state.worker === 'RUNNING'
          || state.next > (command === 'evaluate' ? L.helperRequests : L.helperVerifyRequests)
          || request.sequence !== state.next || request.session !== session
          || (state.next <= 4 && state.worker !== 'NOT_STARTED')
          || (state.next > 4 && state.worker !== 'STOPPED')
          || (state.next === 4 && request.operation !== (command === 'evaluate' ? 'CHECK_OUTPUT' : 'READ_SET'))) reject();
      if (state.usedMs >= L.helperAggregateDeadlineMs) fail('TIMEOUT', 'ACQUISITION', null);
      const encoded = encodeHelperRequest(request);
      const copy = decodeHelperRequest(encoded);
      if (state.next === 4 && command === 'evaluate') state.output = validateAbsoluteRoot(copy.roots[0].path);
      if (state.next > 4 && validateAbsoluteRoot(copy.roots[0].path) !== state.output) reject('FILESYSTEM_BOUNDARY');
      state.active = copy; state.launched = current; state.next += 1;
      return encoded;
    }); },
    complete(bytes) { return terminal(() => {
      const current = checkpoint();
      if (!state.active || state.awaitingExit) reject();
      const response = decodeHelperResponse(bytes, state.active);
      if (response.status === 'ERROR') { state.failed = true; return response; }
      if (state.active.sequence === 4 && command === 'evaluate') state.parent = structuredClone(response.roots[0].chain);
      if (state.active.sequence === 5) {
        const chain = response.roots[0].chain;
        if (chain.length !== state.parent.length) reject('FILESYSTEM_BOUNDARY');
        chain.forEach((item, index) => assertStableIdentity(state.parent[index], item, { directory: true }));
      }
      state.completed = { request: state.active, response }; state.active = null; state.awaitingExit = true;
      checkpoint();
      return response;
    }); },
    helperExited() { return terminal(() => {
      const current = checkpoint();
      if (!state.awaitingExit || state.active || state.launched === null) reject();
      const duration = current - state.launched;
      state.usedMs += duration;
      const completed = state.completed;
      if (!completed) reject();
      event('helper-exited', current, { durationMs: duration, usedMs: state.usedMs });
      state.launched = null; state.awaitingExit = false;
      state.completed = null;
      // Evidence validation is synchronous and ordered before the next helper,
      // but occurs only after the production-equivalent endpoint is charged.
      afterHelperExited?.(Object.freeze({ request: completed.request, response: completed.response,
        durationMs: duration, usedMs: state.usedMs, endpointAt: current }));
    }); },
    beginWorker() { return terminal(() => {
      const current = checkpoint();
      if (state.next !== 5 || state.active || state.awaitingExit || state.worker !== 'NOT_STARTED') reject();
      state.worker = 'RUNNING'; event('worker-begin', current);
    }); },
    endWorker() { return terminal(() => {
      const current = checkpoint();
      if (state.worker !== 'RUNNING') reject();
      state.worker = 'STOPPED'; event('worker-end', current);
    }); },
    checkpoint,
    abort() { state.failed = true; },
  });
  sequences.set(api, state);
  return api;
}

export function prospectiveSequenceSnapshot(sequence) {
  const state = sequences.get(sequence);
  if (!state) reject();
  return structuredClone({ command: state.command, session: state.session, helperBoundMs: state.helperBoundMs,
    next: state.next, active: state.active?.sequence ?? null, awaitingExit: state.awaitingExit, failed: state.failed,
    worker: state.worker, output: state.output, claimed: state.claimed, usedMs: state.usedMs,
    launched: state.launched, start: state.start, last: state.last, events: state.events });
}

export function createPublicationInspection(sequence, root, { exchange, checkpoint } = {}) {
  const state = sequences.get(sequence);
  try {
    if (!state || state.failed || state.command !== 'evaluate' || state.worker !== 'STOPPED'
        || state.next !== 5 || state.active || state.awaitingExit || state.claimed
        || typeof exchange !== 'function' || typeof checkpoint !== 'function') reject();
    sequence.checkpoint();
    root = validateAbsoluteRoot(root);
    if (root !== state.output) reject('FILESYSTEM_BOUNDARY');
    state.claimed = true;
  } catch (error) { if (state) sequence.abort(); throw error; }
  const capability = Object.freeze({});
  const check = () => {
    try { sequence.checkpoint(); checkpoint(); sequence.checkpoint(); }
    catch (error) { sequence.abort(); throw error; }
  };
  inspections.set(capability, { sequence, root, exchange, check, used: false, busy: false, failed: false, next: 0 });
  return capability;
}

export function consumePublicationInspection(capability, root) {
  const state = inspections.get(capability);
  try {
    if (!state || state.used || state.failed) reject();
    state.used = true;
    if (validateAbsoluteRoot(root) !== state.root) reject('FILESYSTEM_BOUNDARY');
    state.check();
    return state.check;
  } catch (error) { if (state) { state.failed = true; state.sequence.abort(); } throw error; }
}

export async function inspectPublication(capability, operation) {
  const state = inspections.get(capability);
  if (!state || !state.used || state.failed || state.busy || PUBLICATION_OPERATIONS[state.next] !== operation) {
    if (state) { state.failed = true; state.sequence.abort(); }
    reject();
  }
  state.busy = true;
  try {
    state.check();
    const request = { files: [], kind: 'MemoryOSReadinessHelperRequest', operation,
      roots: [{ id: 'output', path: state.root }], sequence: state.next + 5,
      session: state.sequence.session, version: '2.0.0' };
    const answer = await state.exchange(state.sequence.begin(request));
    closed(answer, ['exitConfirmed', 'responseBytes']);
    if (answer.exitConfirmed !== true) reject();
    const response = state.sequence.complete(answer.responseBytes);
    if (response.status === 'ERROR') reject();
    state.sequence.helperExited();
    state.check();
    state.next += 1;
    return structuredClone(response.roots[0].chain);
  } catch (error) { state.failed = true; state.sequence.abort(); throw error; }
  finally { state.busy = false; }
}
