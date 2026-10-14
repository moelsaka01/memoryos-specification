// Release-media helper: copy a ledger directory and flip ONE bit in one stored entry, to show that verification notices a changed entry.
//   node tamper-copy.mjs SOURCE_LEDGER NEW_LEDGER
import fs from 'node:fs';
import path from 'node:path';

const [source, target] = process.argv.slice(2);
if (!source || !target || fs.existsSync(target)) { console.error('usage: tamper-copy.mjs SOURCE_LEDGER NEW_LEDGER (NEW_LEDGER must not exist)'); process.exit(2); }
fs.cpSync(source, target, { recursive: true });
const entry = path.join(target, 'entries', '00000000000000000001.json');
const bytes = fs.readFileSync(entry);
const at = bytes.indexOf('"entryDigest":"sha256:') + '"entryDigest":"sha256:'.length;
bytes[at] = bytes[at] === 0x30 ? 0x31 : 0x30; // one character of the stored entry digest
fs.writeFileSync(entry, bytes);
console.log(`copied ${source} to ${target}`);
console.log('changed 1 byte in entries/00000000000000000001.json');
