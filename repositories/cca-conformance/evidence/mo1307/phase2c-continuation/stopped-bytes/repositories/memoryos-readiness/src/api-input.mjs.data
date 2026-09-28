import { types } from 'node:util';
import { DEFINITIONS } from './constants.mjs';
import { fail, operationalError } from './errors.mjs';
import { digest, parseCanonical } from './canonical.mjs';
import { assertPlainFields, selectPhaseError, validateRecord, validateCandidate, validateManifest } from './foundation.mjs';
import { structurallyEqual } from './schema.mjs';

const L = DEFINITIONS.limits;
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'byteLength').get;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer').get;
const controls = ['configuration', 'candidate', 'manifest', 'authority'];
function admit(bytes, cap, stage, reference) {
  if (!types.isUint8Array(bytes) || types.isSharedArrayBuffer(bufferOf.call(bytes))) fail('INPUT', stage, reference);
  const size = lengthOf.call(bytes);
  if (size > cap) fail('RESOURCE_LIMIT', stage, reference);
  return size;
}
function phaseChecks(checks, stage, checkpoint) {
  const errors = [];
  for (const check of checks) {
    // A deadline/cancellation checkpoint is outside numeric error selection:
    // terminal operational interruption must not lose to a parser error.
    checkpoint(stage);
    try { check(); } catch (error) { errors.push(operationalError(error, stage)); }
    checkpoint(stage);
  }
  selectPhaseError(errors.map(error => () => { throw error; }), stage);
}

// Only bounded bootstrap validation runs at public entry. It establishes the
// earlier CONFIGURATION phase and manifest-specific copy caps, never authority,
// claim semantics, graph, readiness or result verification. Those remain inside
// the supervised thread. Every byte snapshot is detached before the first await.
export function snapshotApiInput(input, verify = false, checkpoint = () => {}) {
  checkpoint('LAUNCH');
  const fields = ['configurationBytes', 'candidateBytes', 'manifestBytes', 'authorityBytes', 'files',
    'expectedCandidateDigest', 'trustedAuthorityDigest', ...(verify ? ['resultBytes', 'decisionBytes'] : [])];
  assertPlainFields(input, fields);
  for (const pin of ['expectedCandidateDigest', 'trustedAuthorityDigest']) {
    if (typeof input[pin] !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(input[pin])) fail('USAGE', 'LAUNCH');
  }
  const copies = { expectedCandidateDigest: input.expectedCandidateDigest, trustedAuthorityDigest: input.trustedAuthorityDigest };
  const parsed = Object.create(null), validated = Object.create(null);
  const reference = name => name === 'configuration' ? 'config' : name;
  phaseChecks([
    ...controls.map(name => () => {
      const key = name + 'Bytes';
      admit(input[key], L[key], 'CONFIGURATION', reference(name));
      copies[key] = new Uint8Array(input[key]);
      parsed[name] = parseCanonical(copies[key], { maxBytes: L[key], stage: 'CONFIGURATION', reference: reference(name) });
    }),
    () => { if (copies.authorityBytes && digest(copies.authorityBytes) !== input.trustedAuthorityDigest) fail('EVIDENCE_AUTHORITY', 'CONFIGURATION', 'authority'); },
    () => { if (copies.candidateBytes && digest(copies.candidateBytes) !== input.expectedCandidateDigest) fail('CANDIDATE_MISMATCH', 'CONFIGURATION', 'candidate'); },
    ...controls.map(name => () => {
      if (!Object.hasOwn(parsed, name)) return;
      if (name === 'candidate') validateCandidate(parsed.candidate, input.expectedCandidateDigest);
      else validateRecord(name[0].toUpperCase() + name.slice(1), parsed[name], {
        stage: 'CONFIGURATION', reference: reference(name), ...(name === 'configuration' ? { code: 'CONFIGURATION' } : {}) });
      validated[name] = true;
    }),
    () => { if (validated.authority && copies.manifestBytes && parsed.authority.manifestSha256 !== digest(copies.manifestBytes)) fail('INTEGRITY', 'CONFIGURATION', 'manifest'); },
    () => { if (validated.configuration && validated.candidate && !structurallyEqual(parsed.configuration.profile, parsed.candidate.profile)) fail('PROFILE_MISMATCH', 'CONFIGURATION', 'config'); },
    () => { if (validated.configuration && validated.authority && !structurallyEqual(parsed.configuration.profile, parsed.authority.assessment.profile)) fail('PROFILE_MISMATCH', 'CONFIGURATION', 'config'); },
    () => { if (validated.configuration && validated.authority && parsed.configuration.stage !== parsed.authority.assessment.stage) fail('CONFIGURATION', 'CONFIGURATION', 'config'); },
  ], 'CONFIGURATION', checkpoint);

  checkpoint('ACQUISITION');
  validateManifest(parsed.manifest);
  if (!Array.isArray(input.files)) fail('INPUT', 'ACQUISITION');
  if (input.files.length > L.manifestFiles) fail('RESOURCE_LIMIT', 'ACQUISITION');
  if (Object.getOwnPropertySymbols(input.files).length || Object.getOwnPropertyNames(input.files).length !== input.files.length + 1) fail('INPUT', 'ACQUISITION');
  let previous = '';
  const files = [];
  for (let index = 0; index < input.files.length; index++) {
    checkpoint('ACQUISITION');
    const descriptor = Object.getOwnPropertyDescriptor(input.files, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('INPUT', 'ACQUISITION');
    const file = descriptor.value;
    assertPlainFields(file, ['id', 'bytes'], 'ACQUISITION');
    if (typeof file.id !== 'string' || !/^[a-z][a-z0-9._-]{0,63}$/.test(file.id) || file.id <= previous) fail('INPUT', 'ACQUISITION');
    previous = file.id;
    files.push(file);
  }
  if (files.length !== parsed.manifest.entries.length || files.some((file, index) => file.id !== parsed.manifest.entries[index].id)) fail('INPUT', 'ACQUISITION', 'manifest');
  let total = 0;
  phaseChecks([
    ...files.map((file, index) => () => {
      const cap = parsed.manifest.entries[index].type === 'ENVELOPE' ? L.envelopeBytes : L.rawSourceBytes;
      total += admit(file.bytes, cap, 'ACQUISITION', file.id);
      if (total > L.aggregateEvidenceBytes) fail('RESOURCE_LIMIT', 'ACQUISITION', file.id);
    }),
    ...(verify ? [
      () => admit(input.resultBytes, L.resultBytes, 'ACQUISITION', 'result'),
      () => { if (input.decisionBytes !== null) admit(input.decisionBytes, L.decisionBytes, 'ACQUISITION', 'decision'); },
    ] : []),
  ], 'ACQUISITION', checkpoint);
  copies.files = files.map(file => {
    checkpoint('ACQUISITION');
    return { id: file.id, bytes: new Uint8Array(file.bytes) };
  });
  if (verify) {
    copies.resultBytes = new Uint8Array(input.resultBytes);
    copies.decisionBytes = input.decisionBytes === null ? null : new Uint8Array(input.decisionBytes);
  }
  checkpoint('ACQUISITION');
  return copies;
}

export function apiSignal(options) {
  if (options === undefined) return undefined;
  if (!options || typeof options !== 'object') fail('INPUT', 'LAUNCH');
  const keys = Object.getOwnPropertyNames(options);
  if (keys.some(key => key !== 'signal')) fail('INPUT', 'LAUNCH');
  assertPlainFields(options, keys);
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) fail('INPUT', 'LAUNCH');
  return options.signal;
}
