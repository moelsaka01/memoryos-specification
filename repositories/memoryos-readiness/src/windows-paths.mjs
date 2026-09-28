import path from 'node:path';
import { fail } from './errors.mjs';
import { DEFINITIONS } from './constants.mjs';

// Lexical policy is shared by CLI, manifest and private helper validation.
// Native acquisition must separately establish *every* component's identity;
// Node's symlink bit alone does not establish the Windows reparse policy.
const DEVICE = /^(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i;
const RELATIVE = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const MAX_RELATIVE = DEFINITIONS.limits.relativePathChars;
const MAX_FULL = DEFINITIONS.limits.fullPathCodeUnits;
const REPARSE_POINT = 0x400;
const DIRECTORY = 0x10;
const IDENTITY_KEYS = ['attributes', 'byteLength', 'fileId', 'finalPath', 'isDirectory', 'linkCount', 'volumeSerial'];

function boundary(stage, reference) { fail('FILESYSTEM_BOUNDARY', stage, reference); }
function ordinarySegment(segment) {
  return segment !== '' && segment !== '.' && segment !== '..'
    && !/[. ]$/.test(segment) && !DEVICE.test(segment)
    && !/[\x00-\x1f\x7f<>:"/\\|?*]/.test(segment)
    && !/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(segment);
}

export function validateRelativeFile(value, { stage = 'ACQUISITION', reference = null } = {}) {
  if (typeof value !== 'string' || value.length < 1 || value.length > MAX_RELATIVE
      || !RELATIVE.test(value) || !value.split('/').every(ordinarySegment)) boundary(stage, reference);
  return value;
}

export function validateAbsoluteRoot(value, { stage = 'ACQUISITION', reference = null } = {}) {
  // Windows accepts either separator for local drive roots. Substituting only
  // that separator retains the same native path; dot/trailing/device/ADS forms
  // are rejected rather than normalized into a different file.
  if (typeof value !== 'string' || value.length > MAX_FULL || !/^[A-Za-z]:[\\/]/.test(value)) boundary(stage, reference);
  const ordinary = value.replaceAll('/', '\\');
  if ((ordinary.length > 3 && ordinary.endsWith('\\'))
      || (ordinary.length > 3 && !ordinary.slice(3).split('\\').every(ordinarySegment))) boundary(stage, reference);
  return ordinary;
}

export function resolveContained(root, relative, options = {}) {
  root = validateAbsoluteRoot(root, options);
  validateRelativeFile(relative, options);
  const resolved = root + (root.endsWith('\\') ? '' : '\\') + relative.replaceAll('/', '\\');
  if (resolved.length > MAX_FULL) boundary(options.stage ?? 'ACQUISITION', options.reference ?? null);
  return resolved;
}

export function assertDistinctRoots(roots, options = {}) {
  if (!Array.isArray(roots)) boundary(options.stage ?? 'ACQUISITION', options.reference ?? null);
  const folded = roots.map(root => validateAbsoluteRoot(root, options).toUpperCase());
  for (let i = 0; i < folded.length; i += 1) {
    for (let j = i + 1; j < folded.length; j += 1) {
      const a = folded[i]; const b = folded[j];
      if (a === b || b.startsWith(a.endsWith('\\') ? a : a + '\\')
          || a.startsWith(b.endsWith('\\') ? b : b + '\\')) boundary(options.stage ?? 'ACQUISITION', options.reference ?? null);
    }
  }
}

export function assertDistinctFiles(paths, options = {}) {
  if (!Array.isArray(paths)) boundary(options.stage ?? 'ACQUISITION', options.reference ?? null);
  const seen = new Set();
  for (const relative of paths) {
    const key = validateRelativeFile(relative, options).toUpperCase();
    if (seen.has(key)) boundary(options.stage ?? 'ACQUISITION', options.reference ?? null);
    seen.add(key);
  }
}

export function validateIdentityRecord(identity, { directory = false, stage = 'ACQUISITION', reference = null } = {}) {
  const invalid = () => boundary(stage, reference);
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)
      || Object.keys(identity).sort().join(',') !== IDENTITY_KEYS.join(',')) invalid();
  const { attributes, byteLength, fileId, finalPath, isDirectory, linkCount, volumeSerial } = identity;
  if (!Number.isSafeInteger(attributes) || attributes < 0 || attributes > 0xffffffff
      || (attributes & REPARSE_POINT) !== 0 || typeof isDirectory !== 'boolean'
      || isDirectory !== directory || Boolean(attributes & DIRECTORY) !== directory
      || !Number.isSafeInteger(byteLength) || byteLength < 0
      || !Number.isSafeInteger(linkCount) || linkCount < 1 || (!directory && linkCount !== 1)
      || typeof volumeSerial !== 'string' || !/^[a-f0-9]{8}$/.test(volumeSerial)
      || typeof fileId !== 'string' || !/^[a-f0-9]{16}$/.test(fileId)) invalid();
  if (validateAbsoluteRoot(finalPath, { stage, reference }) !== finalPath) invalid();
  return identity;
}

export function assertStableIdentity(before, after, options = {}) {
  validateIdentityRecord(before, options);
  validateIdentityRecord(after, options);
  if (IDENTITY_KEYS.some(key => before[key] !== after[key])) boundary(options.stage ?? 'ACQUISITION', options.reference ?? null);
}

// Component identities are supplied by the fixed trusted native helper, never
// inferred from an arbitrary caller's unverified path or lstat result.
export function assertComponentChain(root, relative, chain, options = {}) {
  const full = relative === null ? validateAbsoluteRoot(root, options) : resolveContained(root, relative, options);
  const parsed = path.win32.parse(full);
  const pieces = full.slice(parsed.root.length).split('\\').filter(Boolean);
  const expected = [parsed.root];
  for (const piece of pieces) expected.push(expected.at(-1) + (expected.at(-1).endsWith('\\') ? '' : '\\') + piece);
  if (!Array.isArray(chain) || chain.length !== expected.length) boundary(options.stage ?? 'ACQUISITION', options.reference ?? null);
  chain.forEach((identity, index) => {
    validateIdentityRecord(identity, { ...options, directory: index < chain.length - 1 || relative === null });
    if (identity.finalPath.toUpperCase() !== expected[index].toUpperCase()) boundary(options.stage ?? 'ACQUISITION', options.reference ?? null);
  });
  return full;
}
