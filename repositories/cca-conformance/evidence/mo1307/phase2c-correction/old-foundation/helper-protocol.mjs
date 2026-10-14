import { canonicalBytes, parseCanonical } from './canonical.mjs';
import { DEFINITIONS } from './constants.mjs';
import { fail } from './errors.mjs';
import { assertDistinctFiles, assertDistinctRoots, resolveContained, validateAbsoluteRoot, validateIdentityRecord } from './windows-paths.mjs';

const LIMITS = DEFINITIONS.limits;
const ID = /^[a-z][a-z0-9._-]{0,63}$/;
const OPERATIONS = new Set(['READ_SET', 'CHECK_OUTPUT']);
const REQUEST_KEYS = ['files', 'kind', 'operation', 'roots', 'sequence', 'version'];
const RESPONSE_KEYS = ['code', 'files', 'kind', 'operation', 'roots', 'sequence', 'status', 'version'];
const REQUEST_KIND = 'MemoryOSReadinessHelperRequest';
const RESPONSE_KIND = 'MemoryOSReadinessHelperResponse';
const VERSION = '1.0.0';
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
  if (request.operation === 'CHECK_OUTPUT') {
    if (request.sequence !== 4 || request.files.length !== 0 || request.roots.length !== 1 || !roots.has('output')) reject();
  } else {
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
      || response.sequence !== request.sequence || response.operation !== request.operation
      || !Array.isArray(response.roots) || !Array.isArray(response.files)) reject();
  if (response.status === 'ERROR') {
    if (!ERROR_CODES.has(response.code) || response.roots.length !== 0 || response.files.length !== 0) reject();
    return response;
  }
  if (response.code !== null || response.status !== (request.operation === 'READ_SET' ? 'OK' : 'ABSENT')) reject();
  if (response.files.length > LIMITS.helperRequestPaths) reject('RESOURCE_LIMIT');
  ordered(response.roots.map(root => root?.id));
  ordered(response.files.map(file => file?.id));
  // CHECK_OUTPUT proves the existing parent identity. The absent destination
  // itself has no identity; publication will exclusively create and bind it.
  if (request.operation === 'CHECK_OUTPUT') {
    if (response.files.length !== 0 || response.roots.length !== 1 || response.roots[0].id !== 'output-parent') reject();
    closed(response.roots[0], ['id', 'identity']);
    validateIdentityRecord(response.roots[0].identity, { directory: true });
    const destination = validateAbsoluteRoot(request.roots[0].path);
    const parent = destination.slice(0, destination.lastIndexOf('\\')) || destination.slice(0, 3);
    if (response.roots[0].identity.finalPath.toUpperCase() !== (parent.length === 2 ? parent + '\\' : parent).toUpperCase()) reject('FILESYSTEM_BOUNDARY');
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

// Pure admission state, not acquisition orchestration. A failed or outstanding
// request permanently consumes its slot; callers cannot retry in the same run.
export function createHelperSequence(command) {
  if (!['evaluate', 'verify'].includes(command)) reject();
  let next = 1; let active = null; let failed = false;
  return Object.freeze({
    begin(request) {
      validateHelperRequest(request);
      if (failed || active !== null || next > LIMITS.helperRequests || request.sequence !== next
          || (next === 4 && request.operation !== (command === 'evaluate' ? 'CHECK_OUTPUT' : 'READ_SET'))) reject();
      const encoded = encodeHelperRequest(request);
      active = decodeHelperRequest(encoded); next += 1;
      return encoded;
    },
    complete(bytes) {
      if (active === null || failed) reject();
      const request = active; active = null;
      try {
        const response = decodeHelperResponse(bytes, request);
        if (response.status === 'ERROR') failed = true;
        return response;
      } catch (error) { failed = true; throw error; }
    },
    abort() { active = null; failed = true; },
  });
}
