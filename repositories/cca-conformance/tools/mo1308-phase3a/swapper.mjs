// MO-1308 Phase 3A Windows harness: the junction swapper (G6). A separate process that races the product's operations on one ledger:
//   node swapper.mjs <work-root> <ledger> <outside> <swaps> <seed> [<max-seconds>]
// Each swap renames <ledger>/records aside, plants a junction named records that points at <outside>, holds it for a seeded number of
// milliseconds (5-25), waits a seeded gap (20-120 ms) before the next swap, removes the junction (rmdir: the link, never its target) and renames the directory back. It completes exactly <swaps>
// swaps (a rename that NTFS refuses because a handle is open inside the directory is counted as refused, not as a swap), always
// restores the directory, and prints one JSON object. It refuses any path outside <work-root>. Harness only; the product never runs it.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [workRoot, ledger, outside, swapsText, seed, secondsText = '600'] = process.argv.slice(2);
const within = (candidate) => { const relative = path.relative(path.resolve(workRoot), path.resolve(candidate)); return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); };
if (!within(ledger) || !within(outside)) { process.stderr.write('the swapper refuses paths outside the work root\n'); process.exit(2); }
const records = path.join(ledger, 'records');
const aside = path.join(ledger, 'records.aside');
const word = (counter) => crypto.createHash('sha256').update(`${seed}:${counter}`).digest().readUInt32BE(0);
const pause = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
const target = Number(swapsText);
const end = Date.now() + Number(secondsText) * 1000;
let swaps = 0; let refused = 0; let heldMs = 0;
while (swaps < target && Date.now() < end) {
  try { fs.renameSync(records, aside); } catch { refused += 1; pause(2); continue; }
  try {
    fs.symlinkSync(outside, records, 'junction');
    const hold = 5 + (word(swaps) % 21);
    pause(hold); heldMs += hold;
    fs.rmdirSync(records);
    swaps += 1;
  } finally {
    // restore: the directory must be back whatever happened
    try { if (fs.lstatSync(records).isSymbolicLink()) fs.rmdirSync(records); } catch { /* absent */ }
    fs.renameSync(aside, records);
  }
  // a seeded gap between swaps (20-120 ms) lets the racing operations make progress between them
  pause(20 + (word(100000 + swaps) % 101));
}
process.stdout.write(JSON.stringify({ swaps, refused, heldMs, completed: swaps === target }));
