// MO-1308 Phase 3C: the data-class scanner (Freeze H09, R24, R35). MO-1308-authored bytes may contain only identifiers and names,
// digests, byte lengths, integers, closed enum values, closed member names, exact owner subject values and the tombstone authority
// reference. They never contain paths, URLs, host or user names, timestamps, environment values, exception messages or stacks.
// `scanText` finds canaries and forbidden classes in text; `scanAuthored` walks a parsed MO-1308 structure and skips exactly the two
// free-form places (subject values and the authority reference), which it reports separately.
import { dec } from './support.mjs';

const DIGEST = /sha256:[0-9a-f]{64}|\b[0-9a-f]{64}\b/g;
export const FORBIDDEN_CLASSES = Object.freeze([
  ['ABSOLUTE_WINDOWS_PATH', /[A-Za-z]:[\\/]/],
  ['UNC_PATH', /\\\\[A-Za-z0-9_.-]+\\/],
  ['ABSOLUTE_POSIX_PATH', /(^|[\s"'=:(,[])\/(?:tmp|home|Users|var|etc|usr|opt|root|private|mnt|Volumes)(?:\/|\b)/],
  ['URL', /\b[a-z][a-z0-9+.-]*:\/\/[^\s"']+/i],
  ['ISO_TIMESTAMP', /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/],
  ['DATE', /\b\d{4}[-/]\d{2}[-/]\d{2}\b/],
  ['EPOCH_SECONDS_OR_MILLISECONDS', /(?<![\w.])(?:1[0-9]{9}|1[0-9]{12})(?![\w.])/],
  ['STACK_FRAME', /\bat\s+[\w.<>$ ]+\s+\(?(?:file:|node:|\/|[A-Za-z]:)[^)\s]*:\d+:\d+\)?/],
  ['NODE_INTERNAL', /node:internal|ERR_[A-Z_]{4,}|\bE(?:NOENT|PERM|ACCES|EXIST|BUSY|NOTDIR|ISDIR|MFILE)\b|errno|syscall/],
  ['EXCEPTION_NAME', /\b(?:Type|Range|Syntax|Reference)Error\b|\bError:\s/],
]);

export const stripDigests = (text) => text.replace(DIGEST, 'DIGEST');

export function scanText(text, canaries, { label = '' } = {}) {
  const findings = [];
  const plain = stripDigests(text);
  for (const canary of canaries) if (canary.value.length >= 4 && text.includes(canary.value)) findings.push({ label, kind: `CANARY_${canary.class}`, sample: canary.value.slice(0, 40) });
  for (const [kind, pattern] of FORBIDDEN_CLASSES) {
    const match = pattern.exec(plain);
    if (match !== null) findings.push({ label, kind, sample: match[0].slice(0, 60) });
  }
  return findings;
}

// Walks a parsed value, calling `visit(path, value)` for every string and number except below the skipped paths.
function walk(value, pathSegments, skip, visit) {
  const pathText = pathSegments.join('.');
  if (skip(pathText)) return;
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, [...pathSegments, '[]'], skip, visit));
  else if (value !== null && typeof value === 'object') for (const [key, item] of Object.entries(value)) { visit(`${pathText}.#key`, key); walk(item, [...pathSegments, key], skip, visit); }
  else visit(pathText, value);
}

const SKIP_ENTRY = (pathText) => /(^|\.)record\.subjects\.\[\]\.value$/.test(pathText) || /(^|\.)tombstone\.authorityReference$/.test(pathText);
const SKIP_RESULT = (pathText) => /subjects\.\[\]\.value$/.test(pathText) || /authorityReference$/.test(pathText);

// Scans JSON bytes (an entry, descriptor, verification, query result, manifest, marker or error). Returns {findings, freeForm}.
export function scanAuthoredJson(bytes, canaries, { label, skip = SKIP_ENTRY } = {}) {
  const findings = [];
  const freeForm = [];
  let value;
  try { value = JSON.parse(typeof bytes === 'string' ? bytes : dec.decode(bytes)); } catch { return { findings: [{ label, kind: 'NOT_JSON', sample: '' }], freeForm }; }
  walk(value, [], skip, (where, item) => {
    if (typeof item === 'string') findings.push(...scanText(item, canaries, { label: `${label}:${where}` }));
    else if (typeof item === 'number' && Number.isInteger(item) && /^(?:1[0-9]{9}|1[0-9]{12})$/.test(String(item))) findings.push({ label: `${label}:${where}`, kind: 'EPOCH_SECONDS_OR_MILLISECONDS', sample: String(item) });
  });
  const collect = (node, where) => {
    if (Array.isArray(node)) node.forEach((item) => collect(item, where));
    else if (node !== null && typeof node === 'object') {
      if (typeof node.authorityReference === 'string') freeForm.push({ kind: 'authorityReference', value: node.authorityReference });
      if (Array.isArray(node.subjects)) for (const subject of node.subjects) if (typeof subject?.value === 'string') freeForm.push({ kind: `subject:${subject.type}`, value: subject.value });
      for (const item of Object.values(node)) collect(item, where);
    }
  };
  collect(value, label);
  return { findings, freeForm };
}
export { SKIP_RESULT };
