// Release-media helper: copy a history export folder and change exactly ONE byte of one stored entry file (one hexadecimal character of its
// recorded entry digest), to show that the verifiers notice it. The source is never modified.
//   node tamper-copy.mjs SOURCE_EXPORT NEW_EXPORT        (NEW_EXPORT must not exist)
import fs from 'node:fs';
import path from 'node:path';

const [source, target] = process.argv.slice(2);
if (!source || !target || fs.existsSync(target)) { console.error('usage: tamper-copy.mjs SOURCE_EXPORT NEW_EXPORT (NEW_EXPORT must not exist)'); process.exit(2); }
fs.cpSync(source, target, { recursive: true });
const relative = 'entries/00000000000000000001.json';
const file = path.join(target, relative);
const bytes = fs.readFileSync(file);
const marker = '"entryDigest":"sha256:';
const offset = bytes.indexOf(marker) + marker.length;
const before = bytes[offset];
bytes[offset] = before === 0x30 ? 0x31 : 0x30;
fs.writeFileSync(file, bytes);
const hex = (n) => `0x${n.toString(16).padStart(2, '0')}`;
console.log(`copied ${source} to ${target}`);
console.log(`changed 1 byte in ${relative} at offset ${offset}: ${hex(before)} -> ${hex(bytes[offset])}`);
