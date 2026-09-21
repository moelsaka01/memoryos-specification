import { createHash } from 'node:crypto';
import { lstat, open, opendir, realpath } from 'node:fs/promises';
import { resolve, relative, sep, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { J } from './deterministic.mjs';
import { IntegrityError } from './errors.mjs';

export const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const CONTRACT_PIN_SHA256 = 'd81c0b8aece4a106324131d4d356c7d0aac0e8618fac080c6b8b5e3a2381ee65';
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function safeMember(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9_.@/-]+$/u.test(name)
    || name.startsWith('/') || name.includes('\\') || name.split('/').some((part) =>
      !part || part === '.' || part === '..' || part.endsWith('.')
      || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part))) throw new IntegrityError();
  return name;
}
// On Windows lstat can classify non-symlink reparse tags as regular files.
// Node 24.21/libuv opendir Dirent preserves FILE_ATTRIBUTE_REPARSE_POINT for
// every tag. Inspect that view as well; do not spawn a platform helper.
async function ordinaryEntry(path) {
  if (process.platform !== 'win32' || dirname(path) === path) return;
  let count = 0;
  for await (const entry of await opendir(dirname(path), { bufferSize: 32 })) {
    if (++count > 20000) throw new IntegrityError();
    if (entry.name === basename(path)) {
      if (entry.isSymbolicLink() || !(entry.isFile() || entry.isDirectory())) throw new IntegrityError();
      return;
    }
  }
  throw new IntegrityError();
}
export async function regularBytes(root, member) {
  safeMember(member);
  const rootPath = resolve(root);
  const target = resolve(rootPath, ...member.split('/'));
  if (relative(rootPath, target).startsWith(`..${sep}`)) throw new IntegrityError();
  let current = rootPath;
  await ordinaryEntry(current);
  const rootStat = await lstat(current);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new IntegrityError();
  for (const part of member.split('/')) {
    current = resolve(current, part);
    await ordinaryEntry(current);
    const status = await lstat(current);
    if (status.isSymbolicLink() || !(status.isFile() || status.isDirectory())) throw new IntegrityError();
  }
  if (resolve(await realpath(target)).toLowerCase() !== target.toLowerCase()) throw new IntegrityError();
  const before = await lstat(target);
  if (!before.isFile() || before.size > 16 * 1024 * 1024) throw new IntegrityError();
  const handle = await open(target, 'r');
  try {
    const opened = await handle.stat();
    if (opened.ino !== before.ino || opened.dev !== before.dev || opened.size !== before.size) throw new IntegrityError();
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const pathAfter = await lstat(target);
    if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || pathAfter.ino !== opened.ino
      || pathAfter.isSymbolicLink() || bytes.length !== opened.size) throw new IntegrityError();
    return bytes;
  } finally { await handle.close(); }
}
export async function exactFiles(root) {
  const files = [];
  const folded = new Set();
  async function walk(folder, prefix, depth = 0) {
    if (depth > 32) throw new IntegrityError();
    for await (const entry of await opendir(folder, { bufferSize: 32 })) {
      if (folded.size >= 20000 || entry.isSymbolicLink()
        || !(entry.isFile() || entry.isDirectory())) throw new IntegrityError();
      const name = safeMember(prefix + entry.name);
      if (folded.has(name.toLowerCase())) throw new IntegrityError();
      folded.add(name.toLowerCase());
      const path = resolve(folder, entry.name);
      const status = await lstat(path);
      if (status.isSymbolicLink()) throw new IntegrityError();
      if (status.isDirectory()) await walk(path, `${name}/`, depth + 1);
      else if (status.isFile()) files.push(name);
      else throw new IntegrityError();
    }
  }
  await ordinaryEntry(resolve(root));
  const status = await lstat(root);
  if (!status.isDirectory() || status.isSymbolicLink()) throw new IntegrityError();
  await walk(root, '');
  return files.sort();
}
export async function contractIdentityPin(root = PACKAGE_ROOT) {
  const bytes = await regularBytes(root, 'contracts/policy-contract-identities-1.0.0.json');
  if (bytes.length !== 933 || sha256(bytes) !== CONTRACT_PIN_SHA256 || bytes.at(-1) !== 10) throw new IntegrityError();
  return JSON.parse(bytes.toString('utf8'));
}
export async function verifyRuntime(root = PACKAGE_ROOT) {
  const manifestBytes = await regularBytes(root, 'runtime/runtime-closure-manifest.json');
  const pin = JSON.parse(await regularBytes(root, 'contracts/runtime-pin.json'));
  if (sha256(manifestBytes) !== pin.sha256 || manifestBytes.length !== pin.byteLength) throw new IntegrityError();
  const manifest = JSON.parse(manifestBytes);
  if (manifest.kind !== 'MemoryOSMCPRuntimeClosureManifest' || manifest.version !== '1.0.0') throw new IntegrityError();
  const expected = manifest.files.map((entry) => safeMember(entry.path));
  if (J(expected) !== J([...new Set(expected)].sort())) throw new IntegrityError();
  const actual = (await exactFiles(resolve(root, 'runtime'))).filter((name) => name !== 'runtime-closure-manifest.json');
  if (J(actual) !== J(expected)) throw new IntegrityError();
  for (const entry of manifest.files) {
    const bytes = await regularBytes(resolve(root, 'runtime'), entry.path);
    if (bytes.length !== entry.byteLength || sha256(bytes) !== entry.sha256) throw new IntegrityError();
  }
  await contractIdentityPin(root);
  return manifest;
}
export function validateLaunch(version = process.versions.node, environment = process.env, flags = process.execArgv) {
  if (version !== '24.21.0' || environment.NODE_OPTIONS || environment.NODE_PATH
    || flags.some((flag) => !/^--max-old-space-size=[1-9][0-9]*$/u.test(flag))) throw new IntegrityError();
}
export async function verifyDependencies(root = PACKAGE_ROOT) {
  const bytes = await regularBytes(root, 'distribution/dependency-closure.json');
  const pin = JSON.parse(await regularBytes(root, 'contracts/dependency-pin.json'));
  if (bytes.length !== pin.byteLength || sha256(bytes) !== pin.sha256) throw new IntegrityError();
  const manifest = JSON.parse(bytes);
  if (manifest.kind !== 'MemoryOSMCPDependencyClosure' || manifest.version !== '1.0.0') throw new IntegrityError();
  for (const entry of manifest.packages) {
    const expected = manifest.files.filter((file) => file.path.startsWith(`${entry.path}/`)).map((file) => file.path.slice(entry.path.length + 1));
    if (J(await exactFiles(resolve(root, entry.path))) !== J(expected)) throw new IntegrityError();
  }
  for (const entry of manifest.files) {
    const content = await regularBytes(root, entry.path);
    if (content.length !== entry.byteLength || sha256(content) !== entry.sha256) throw new IntegrityError();
  }
  return manifest;
}
