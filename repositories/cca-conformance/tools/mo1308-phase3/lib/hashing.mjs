// MO-1308 Phase 3 shared library: hashing and file records. Pure Node; no platform-specific behavior.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { stableBytes } from './stable-json.mjs';

export const sha256Hex = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
export const digestOf = (bytes) => `sha256:${sha256Hex(bytes)}`;
export const digestOfJson = (value) => digestOf(stableBytes(value));
export const posix = (relative) => relative.split(path.sep).join('/');

// {path, byteLength, sha256}: the binding shape used by every receipt. `root` anchors a repository-relative path.
export function recordFile(root, relative) {
  const absolute = path.join(root, relative);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile()) throw new Error(`recordFile: ${relative} is not a regular file`);
  const bytes = fs.readFileSync(absolute);
  return { path: posix(relative), byteLength: bytes.length, sha256: sha256Hex(bytes) };
}

// Every regular file under `directory`, sorted by UTF-16 code unit, as {path, byteLength, sha256}. A symbolic link or any
// other non-regular entry is an error: evidence trees must not contain links.
export function walkRecords(directory, prefix = '') {
  const rows = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const relative = prefix === '' ? name : `${prefix}/${name}`;
    const absolute = path.join(directory, name);
    const stat = fs.lstatSync(absolute);
    if (stat.isDirectory()) rows.push(...walkRecords(absolute, relative));
    else if (stat.isFile()) {
      const bytes = fs.readFileSync(absolute);
      rows.push({ path: relative, byteLength: bytes.length, sha256: sha256Hex(bytes) });
    } else throw new Error(`walkRecords: ${relative} is not a regular file or directory`);
  }
  return rows;
}
