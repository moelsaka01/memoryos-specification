// MO-1308 Phase 3 shared library: exclusive, write-once evidence files. A campaign never edits or replaces a record it wrote.
import fs from 'node:fs';
import path from 'node:path';
import { stableBytes } from './stable-json.mjs';
import { sha256Hex } from './hashing.mjs';

export function writeOnce(evidenceDir, relative, value) {
  const absolute = path.join(evidenceDir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const bytes = Buffer.isBuffer(value) ? value : stableBytes(value);
  fs.writeFileSync(absolute, bytes, { flag: 'wx' });
  return { path: relative, byteLength: bytes.length, sha256: sha256Hex(bytes) };
}

export const readJson = (evidenceDir, relative) => JSON.parse(fs.readFileSync(path.join(evidenceDir, ...relative.split('/')), 'utf8'));
export const exists = (evidenceDir, relative) => fs.existsSync(path.join(evidenceDir, ...relative.split('/')));
export const fileSha256 = (evidenceDir, relative) => sha256Hex(fs.readFileSync(path.join(evidenceDir, ...relative.split('/'))));
