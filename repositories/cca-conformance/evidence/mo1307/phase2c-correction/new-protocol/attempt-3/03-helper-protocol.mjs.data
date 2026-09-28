import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { canonicalBytes, parseCanonical } from './canonical.mjs';
import { DEFINITIONS } from './constants.mjs';
import { fail } from './errors.mjs';
import { assertComponentChain, assertStableIdentity, assertDistinctFiles, assertDistinctRoots, resolveContained, validateAbsoluteRoot, validateIdentityRecord } from './windows-paths.mjs';

const LIMITS = DEFINITIONS.limits;
const ID = /^[a-z][a-z0-9._-]{0,63}$/;
const PUBLICATION_OPERATIONS = ['CHECK_OUTPUT', 'INSPECT_OUTPUT_ROOT', 'CHECK_STAGE_ROOT', 'INSPECT_PENDING', 'CHECK_FINALIZATION'];
const OPERATIONS = new Set(['READ_SET', ...PUBLICATION_OPERATIONS]);
const REQUEST_KEYS = ['files', 'kind', 'operation', 'roots', 'sequence', 'session', 'version'];
const RESPONSE_KEYS = ['code', 'files', 'kind', 'operation', 'roots', 'sequence', 'session', 'status', 'version'];
const REQUEST_KIND = 'MemoryOSReadinessHelperRequest';
const RESPONSE_KIND = 'MemoryOSReadinessHelperResponse';
const VERSION = '2.0.0';
const SESSION = /^[a-f0-9]{64}$/;
const ERROR_CODES = new Set(['MO1307_INPUT', 'MO1307_FILESYSTEM_BOUNDARY', 'MO1307_RESOURCE_LIMIT', 'MO1307_INTERNAL']);

function reject(code = 'INPUT') { fail(code, 'ACQUISITION', null); }
function closed(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).sort().join(',') !== keys.join(',')) reject();
}
function ordered(values) {
  if (values.some((id, index) => typeof id !== 'string' || !ID.test(id)
      || (index > 0 && values[index - 1] >= id))) reject();
}

export function validateHelperRequest(request) {
  closed(request, REQUEST_KEYS);
  if (request.kind !== REQUEST_KIND || request.version !== VERSION
      || typeof request.session !== 'string' || !SESSION.test(request.session)
      || !OPERATIONS.has(request.operation) || !Number.isSafeInteger(request.sequence)
      || request.sequence < 1 || request.sequence > LIMITS.helperRequests
      || !Array.isArray(request.roots) || !Array.isArray(request.files)) reject();
  if (request.roots.length > 3 || request.files.length > LIMITS.helperRequestPaths) reject('RESOURCE_LIMIT');
  ordered(request.roots.map(root => root?.id));
  const roots = new Map();
  for (const root of request.roots) {
    closed(root, ['id', 'path']);
    if (!['input', 'result', 'output'].includes(root.id)) reject();
    roots.set(root.id, validateAbsoluteRoot(root.path));
  }
  assertDistinctRoots([...roots.values()]);
  ordered(request.files.map(file => file?.id));
  const paths = new Map();
  for (const file of request.files) {
    closed(file, ['id', 'maxBytes', 'path', 'root']);
    if (!roots.has(file.root) || file.root === 'output' || !Number.isSafeInteger(file.maxBytes) || file.maxBytes < 0) reject();
    resolveContained(roots.get(file.root), file.path, { reference: file.id });
    if (file.maxBytes > LIMITS.resultBytes) reject('RESOURCE_LIMIT');
    if (!paths.has(file.root)) paths.set(file.root, []);
    paths.get(file.root).push(file.path);
  }
  for (const values of paths.values()) assertDistinctFiles(values);
  const ids = request.files.map(file => file.id).join(',');
  if (request.operation !== 'READ_SET') {
    if (request.files.length !== 0 || request.roots.length !== 1 || !roots.has('output')
        || (request.sequence === 4 ? request.operation !== 'CHECK_OUTPUT'
          : request.sequence < 5 || PUBLICATION_OPERATIONS[request.sequence - 5] !== request.operation)) reject();
    // Both fixed publication basenames must fit; no caller-selected leaf paths.
    resolveContained(roots.get('output'), DEFINITIONS.filenames.pendingResult);
    resolveContained(roots.get('output'), DEFINITIONS.filenames.result);
  } else {
    if (request.sequence > LIMITS.helperVerifyRequests) reject();
    if (roots.has('output') || request.roots.length === 0) reject();
    if (request.sequence < 4 && (request.roots.length !== 1 || !roots.has('input'))) reject();
    if (request.sequence === 1 && ids !== 'authority,config') reject();
    if (request.sequence === 2 && ids !== 'candidate,manifest') reject();
    if (request.sequence === 4 && (ids !== 'result' && ids !== 'decision,result')) reject();
    const caps = request.sequence === 1 ? { authority: LIMITS.authorityBytes, config: LIMITS.configurationBytes }
      : request.sequence === 2 ? { candidate: LIMITS.candidateBytes, manifest: LIMITS.manifestBytes }
        : request.sequence === 4 ? { decision: LIMITS.decisionBytes, result: LIMITS.resultBytes } : null;
    for (const file of request.files) {
      if (caps && file.maxBytes !== caps[file.id]) reject();
      if (request.sequence === 3 && file.maxBytes > LIMITS.rawSourceBytes) reject('RESOURCE_LIMIT');
      if (file.root !== (file.id === 'result' && request.sequence === 4 ? 'result' : 'input')) reject();
    }
    if (request.roots.some(root => !request.files.some(file => file.root === root.id)) && request.files.length !== 0) reject();
  }
  return request;
}

// One 32-bit big-endian byte count followed by exactly one canonical JSON value.
// The published frame ceilings include the four-byte prefix; no extra frames,
// trailing bytes, BOM, debug text or process stderr may become protocol data.
function frame(value, ceiling) {
  const body = canonicalBytes(value, { maxBytes: ceiling - 4, stage: 'ACQUISITION' });
  if (body.byteLength + 4 > ceiling) reject('RESOURCE_LIMIT');
  const result = Buffer.allocUnsafe(body.byteLength + 4);
  result.writeUInt32BE(body.byteLength, 0);
  result.set(body, 4);
  return result;
}
function unframe(bytes, ceiling) {
  if (!(bytes instanceof Uint8Array) || bytes.buffer instanceof SharedArrayBuffer) reject();
  if (bytes.byteLength > ceiling) reject('RESOURCE_LIMIT');
  if (bytes.byteLength < 4) reject();
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = data.readUInt32BE(0);
  if (size + 4 > ceiling) reject('RESOURCE_LIMIT');
  if (size !== data.byteLength - 4) reject();
  return parseCanonical(data.subarray(4), { maxBytes: ceiling - 4, stage: 'ACQUISITION' });
}
export function encodeHelperRequest(request) { return frame(validateHelperRequest(request), LIMITS.helperRequestBytes); }
export function decodeHelperRequest(bytes) { return validateHelperRequest(unframe(bytes, LIMITS.helperRequestBytes)); }

export function validateHelperResponse(response, request) {
  validateHelperRequest(request);
  closed(response, RESPONSE_KEYS);
  if (response.kind !== RESPONSE_KIND || response.version !== VERSION
      || response.sequence !== request.sequence || response.session !== request.session || response.operation !== request.operation
      || !Array.isArray(response.roots) || !Array.isArray(response.files)) reject();
  if (response.status === 'ERROR') {
    if (!ERROR_CODES.has(response.code) || response.roots.length !== 0 || response.files.length !== 0) reject();
    return response;
  }
  const status = request.operation === 'CHECK_OUTPUT' ? 'ABSENT' : request.operation === 'CHECK_FINALIZATION' ? 'FINAL_ABSENT' : 'OK';
  if (response.code !== null || response.status !== status) reject();
  if (response.files.length > LIMITS.helperRequestPaths) reject('RESOURCE_LIMIT');
  ordered(response.roots.map(root => root?.id));
  ordered(response.files.map(file => file?.id));
  if (request.operation !== 'READ_SET') {
    const pending = ['INSPECT_PENDING', 'CHECK_FINALIZATION'].includes(request.operation);
    const id = request.operation === 'CHECK_OUTPUT' ? 'output-parent' : pending ? 'pending' : 'output';
    if (response.files.length !== 0 || response.roots.length !== 1 || response.roots[0].id !== id) reject();
    closed(response.roots[0], ['chain', 'id']);
    const chain = response.roots[0].chain;
    if (!Array.isArray(chain)) reject();
    if (chain.length > LIMITS.helperChainComponents) reject('RESOURCE_LIMIT');
    const destination = validateAbsoluteRoot(request.roots[0].path);
    const root = request.operation === 'CHECK_OUTPUT' ? path.win32.dirname(destination) : destination;
    assertComponentChain(root, pending ? DEFINITIONS.filenames.pendingResult : null, chain);
    return response;
  }
  if (response.roots.length !== request.roots.length || response.files.length !== request.files.length) reject();
  response.roots.forEach((root, index) => {
    closed(root, ['id', 'identity']);
    validateIdentityRecord(root.identity, { directory: true });
    if (root.id !== request.roots[index].id || root.identity.finalPath.toUpperCase() !== validateAbsoluteRoot(request.roots[index].path).toUpperCase()) reject('FILESYSTEM_BOUNDARY');
  });
  let total = 0;
  response.files.forEach((file, index) => {
    closed(file, ['bytes', 'id', 'identity']);
    const declared = request.files[index];
    if (file.id !== declared.id || !Array.isArray(file.bytes)) reject();
    // Base64 is chunked into 4096-character strings (last may be shorter),
    // preserving the shared JSON string ceiling even for 4 MiB snapshots.
    const encodedLimit = Math.ceil(declared.maxBytes / 3) * 4;
    if (file.bytes.length > Math.ceil(encodedLimit / 4096)) reject('RESOURCE_LIMIT');
    let encodedLength = 0;
    for (let part = 0; part < file.bytes.length; part += 1) {
      const chunk = file.bytes[part];
      if (typeof chunk !== 'string' || chunk.length < 1 || chunk.length > 4096
          || (part < file.bytes.length - 1 && chunk.length !== 4096)) reject();
      encodedLength += chunk.length;
    }
    if (encodedLength > encodedLimit) reject('RESOURCE_LIMIT');
    const encoded = file.bytes.join('');
    const decoded = Buffer.from(encoded, 'base64');
    if (decoded.toString('base64') !== encoded) reject();
    if (decoded.byteLength > declared.maxBytes) reject('RESOURCE_LIMIT');
    total += decoded.byteLength;
    validateIdentityRecord(file.identity, { reference: file.id });
    const root = request.roots.find(item => item.id === declared.root);
    if (file.identity.byteLength !== decoded.byteLength
        || file.identity.finalPath.toUpperCase() !== resolveContained(root.path, declared.path).toUpperCase()) reject('FILESYSTEM_BOUNDARY');
  });
  if (request.sequence === 3 && total > LIMITS.aggregateEvidenceBytes) reject('RESOURCE_LIMIT');
  return response;
}
export function encodeHelperResponse(response, request) { return frame(validateHelperResponse(response, request), LIMITS.helperResponseBytes); }
export function decodeHelperResponse(bytes, request) { return validateHelperResponse(unframe(bytes, LIMITS.helperResponseBytes), request); }

// Admission and bounded clocks only; the resumed 2C supervisor must supply the
// fixed process transport and prove helper/console and worker termination.
const sequences = new WeakMap();
const inspections = new WeakMap();
export function createHelperSequence(command, { session = randomBytes(32).toString('hex'), now = () => performance.now() } = {}) {
  if (!['evaluate', 'verify'].includes(command) || typeof session !== 'string' || !SESSION.test(session) || typeof now !== 'function') reject();
  const start = now();
  if (!Number.isFinite(start)) reject();
  const state = { command, session, next: 1, active: null, awaitingExit: false, failed: false,
    worker: 'NOT_STARTED', output: null, parent: null, claimed: false, usedMs: 0, launched: null, last: start };
  const terminal = fn => { try { if (state.failed) reject(); return fn(); } catch (error) { state.failed = true; throw error; } };
  const checkpoint = () => terminal(() => {
    const current = now();
    if (!Number.isFinite(current) || current < state.last) reject();
    state.last = current;
    if (current >= start + LIMITS.cliDeadlineMs || (state.launched !== null
        && (current >= state.launched + LIMITS.helperDeadlineMs
          || state.usedMs + current - state.launched >= LIMITS.helperAggregateDeadlineMs))) fail('TIMEOUT', 'ACQUISITION', null);
    return current;
  });
  const api = Object.freeze({
    session,
    begin(request) { return terminal(() => {
      const current = checkpoint();
      validateHelperRequest(request);
      if (state.active || state.awaitingExit || state.worker === 'RUNNING'
          || state.next > (command === 'evaluate' ? LIMITS.helperRequests : LIMITS.helperVerifyRequests)
          || request.sequence !== state.next || request.session !== session
          || (state.next <= 4 && state.worker !== 'NOT_STARTED')
          || (state.next > 4 && state.worker !== 'STOPPED')
          || (state.next === 4 && request.operation !== (command === 'evaluate' ? 'CHECK_OUTPUT' : 'READ_SET'))) reject();
      if (state.usedMs >= LIMITS.helperAggregateDeadlineMs) fail('TIMEOUT', 'ACQUISITION', null);
      const encoded = encodeHelperRequest(request);
      const copy = decodeHelperRequest(encoded);
      if (state.next === 4 && command === 'evaluate') state.output = validateAbsoluteRoot(copy.roots[0].path);
      if (state.next > 4 && validateAbsoluteRoot(copy.roots[0].path) !== state.output) reject('FILESYSTEM_BOUNDARY');
      state.active = copy; state.launched = current; state.next += 1;
      return encoded;
    }); },
    complete(bytes) { return terminal(() => {
      checkpoint();
      if (!state.active || state.awaitingExit) reject();
      const response = decodeHelperResponse(bytes, state.active);
      if (response.status === 'ERROR') { state.failed = true; return response; }
      if (state.active.sequence === 4 && command === 'evaluate') state.parent = structuredClone(response.roots[0].chain);
      if (state.active.sequence === 5) {
        const chain = response.roots[0].chain;
        if (chain.length !== state.parent.length) reject('FILESYSTEM_BOUNDARY');
        chain.forEach((item, index) => assertStableIdentity(state.parent[index], item, { directory: true }));
      }
      state.active = null; state.awaitingExit = true;
      checkpoint();
      return response;
    }); },
    helperExited() { return terminal(() => {
      const current = checkpoint();
      if (!state.awaitingExit || state.active || state.launched === null) reject();
      state.usedMs += current - state.launched;
      state.launched = null; state.awaitingExit = false;
    }); },
    beginWorker() { return terminal(() => {
      checkpoint();
      if (state.next !== 5 || state.active || state.awaitingExit || state.worker !== 'NOT_STARTED') reject();
      state.worker = 'RUNNING';
    }); },
    endWorker() { return terminal(() => {
      checkpoint();
      if (state.worker !== 'RUNNING') reject();
      state.worker = 'STOPPED';
    }); },
    checkpoint,
    abort() { state.failed = true; },
  });
  sequences.set(api, state);
  return api;
}

// Internal, branded authority seam. exchange is the trusted fixed-helper byte
// transport, never a callback returning unframed native identity assertions.
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
    const request = { files: [], kind: REQUEST_KIND, operation, roots: [{ id: 'output', path: state.root }],
      sequence: state.next + 5, session: state.sequence.session, version: VERSION };
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
