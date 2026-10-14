import { openSync, closeSync, readSync, fstatSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { resolve, dirname, parse, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { J } from './serialization.mjs';
import { reject } from './errors.mjs';

export const packageRoot = fileURLToPath(new URL('../', import.meta.url));
export const nodeSha256 = 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
export const identitySha256 = 'd81c0b8aece4a106324131d4d356c7d0aac0e8618fac080c6b8b5e3a2381ee65';
export const closureSha256 = '6cbe6bd5b164eb032e00645da06fb90f3e57d15ead33d7e9defa4d1538366705';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = () => reject('RUNTIME_INTEGRITY');
const same = (a, b) => a.ino === b.ino && a.dev === b.dev && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;

export function localPath(path) {
  if (typeof path !== 'string' || !/^[A-Za-z]:[\\/]/u.test(path) || /[:\x00-\x1f]/u.test(path.slice(2))) fail();
  const absolute = resolve(path);
  if (absolute.toLowerCase() !== path.replaceAll('/', '\\').toLowerCase()) fail();
  const parts = relative(parse(absolute).root, absolute).split(sep);
  if (parts.some(x => /[. ]$/u.test(x) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(x))) fail();
  let current = parse(absolute).root;
  for (const part of parts) {
    current = resolve(current, part);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) fail();
  }
  if (realpathSync(absolute).toLowerCase() !== absolute.toLowerCase()) fail();
  return absolute;
}

export function readChecked(path, maximum) {
  path = localPath(path);
  const before = lstatSync(path);
  if (!before.isFile() || before.nlink !== 1 || before.size > maximum) fail();
  const fd = openSync(path, 'r');
  try {
    if (!same(before, fstatSync(fd))) fail();
    const bytes = Buffer.alloc(before.size + 1);
    let count = 0, read;
    while ((read = readSync(fd, bytes, count, bytes.length - count, count)) > 0) count += read;
    if (count !== before.size || !same(before, fstatSync(fd)) || !same(before, lstatSync(path))) fail();
    return bytes.subarray(0, count);
  } finally { closeSync(fd); }
}

export function verifyRuntime() {
  if (process.versions.node !== '24.21.0' || process.platform !== 'win32' || process.arch !== 'x64') fail();
  // Stream the external 93 MB runtime so verification cannot consume its size in external memory.
  const path = localPath(process.execPath), before = lstatSync(path);
  if (!before.isFile() || before.nlink !== 1) fail();
  const fd = openSync(path, 'r'), chunk = Buffer.alloc(65536), hash = createHash('sha256');
  try {
    if (!same(before, fstatSync(fd))) fail();
    let count;
    while ((count = readSync(fd, chunk, 0, chunk.length, null)) > 0) hash.update(chunk.subarray(0, count));
    if (!same(before, fstatSync(fd)) || !same(before, lstatSync(path)) || hash.digest('hex') !== nodeSha256) fail();
  } finally { closeSync(fd); }
}

export function verifyDistribution(root = packageRoot, expectedManifest = null) {
  root = resolve(root); localPath(root);
  const bytes = readChecked(resolve(root, 'distribution-manifest.json'), 262144);
  if (expectedManifest !== null && sha256(bytes) !== expectedManifest) fail();
  const manifest = JSON.parse(bytes);
  if (J(manifest) !== bytes.toString('utf8') || manifest.kind !== 'MemoryOSRESTDistributionManifest'
      || manifest.version !== '1.0.0' || manifest.package !== 'memoryos-rest' || manifest.packageVersion !== '0.1.0'
      || Object.keys(manifest).sort().join(',') !== 'files,kind,package,packageVersion,version'
      || !Array.isArray(manifest.files) || manifest.files.length > 256) fail();
  const seen = new Set(), expected = new Set(['distribution-manifest.json']);
  let prior = '';
  for (const row of manifest.files) {
    if (Object.keys(row).sort().join(',') !== 'byteLength,path,sha256' || typeof row.path !== 'string'
        || !/^[A-Za-z0-9_.\-/]+$/u.test(row.path) || row.path.length > 240 || row.path.startsWith('/')
        || row.path.split('/').some(x => !x || x === '.' || x === '..') || row.path <= prior
        || seen.has(row.path.toLowerCase()) || !Number.isSafeInteger(row.byteLength) || row.byteLength < 0
        || row.byteLength > 8388608 || !/^[0-9a-f]{64}$/u.test(row.sha256)) fail();
    const content = readChecked(resolve(root, row.path), row.byteLength);
    if (content.length !== row.byteLength || sha256(content) !== row.sha256) fail();
    prior = row.path; seen.add(row.path.toLowerCase()); expected.add(row.path);
  }
  function walk(folder, prefix = '') {
    for (const item of readdirSync(folder, {withFileTypes:true})) {
      const name = prefix + item.name, path = resolve(folder, item.name), stat = lstatSync(path);
      if (stat.isSymbolicLink()) fail();
      if (stat.isDirectory()) {
        if (![...expected].some(p => p.startsWith(name + '/'))) fail();
        walk(path, name + '/');
      } else if (!stat.isFile() || stat.nlink !== 1 || !expected.delete(name)) fail();
    }
  }
  walk(root);
  if (expected.size) fail();
  const closureBytes = readChecked(resolve(root, 'runtime/runtime-closure-manifest.json'), 65536);
  const identity = readChecked(resolve(root, 'contracts/policy-contract-identities-1.0.0.json'), 933);
  if (sha256(closureBytes) !== closureSha256 || identity.length !== 933 || sha256(identity) !== identitySha256) fail();
  const closure = JSON.parse(closureBytes);
  if (closure.files.length !== 25) fail();
  for (const row of closure.files) {
    const content = readChecked(resolve(root, 'runtime', row.path), row.byteLength);
    if (content.length !== row.byteLength || sha256(content) !== row.sha256) fail();
  }
  return sha256(bytes);
}
