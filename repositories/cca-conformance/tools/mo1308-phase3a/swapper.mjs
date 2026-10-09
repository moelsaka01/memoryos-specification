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
// Removing the junction and restoring the directory are retried while NTFS refuses them because a racing process still holds a handle on
// the link or inside the directory (EPERM/EBUSY/EACCES): the directory must always come back, so this waits (bounded, 60 s) rather than
// leaving records.aside behind or crashing with the junction still planted.
const transient = (error) => ['EPERM', 'EBUSY', 'EACCES'].includes(error.code);
function retrying(action) {
  const limit = Date.now() + 60000;
  for (;;) {
    try { return action(); } catch (error) {
      if (!transient(error) || Date.now() > limit) throw error;
      refusedRestores += 1; pause(5);
    }
  }
}
const removeJunction = () => retrying(() => { if (fs.lstatSync(records, { throwIfNoEntry: false })?.isSymbolicLink()) fs.rmdirSync(records); });
// While records is swapped out a racing append may re-create it as a real directory (the accepted H40 stray creation). The restore then moves
// whatever the product put there into the saved directory (a name already there is kept, the stray copy dropped), removes the stray directory
// and renames the saved directory back, so records is always the original directory again. Each occurrence is counted in the report.
function absorbStray() {
  const info = fs.lstatSync(records, { throwIfNoEntry: false });
  if (info === undefined || info.isSymbolicLink() || !info.isDirectory()) return;
  for (const name of fs.readdirSync(records)) {
    const from = path.join(records, name); const to = path.join(aside, name);
    if (fs.existsSync(to)) fs.rmSync(from, { recursive: true, force: true }); else fs.renameSync(from, to);
  }
  fs.rmdirSync(records);
  strayRecords += 1;
}
const restore = () => retrying(() => { absorbStray(); fs.renameSync(aside, records); });
let refusedRestores = 0; let strayRecords = 0;
let swaps = 0; let refused = 0; let heldMs = 0;
while (swaps < target && Date.now() < end) {
  try { fs.renameSync(records, aside); } catch { refused += 1; pause(2); continue; }
  try {
    let planted = false;
    try { fs.symlinkSync(outside, records, 'junction'); planted = true; } catch (error) { if (error.code !== 'EEXIST') throw error; refused += 1; }
    if (planted) {
      const hold = 5 + (word(swaps) % 21);
      pause(hold); heldMs += hold;
      removeJunction();
      swaps += 1;
    }
  } finally {
    // restore: the directory must be back whatever happened
    removeJunction();
    restore();
  }
  // a seeded gap between swaps (20-120 ms) lets the racing operations make progress between them
  pause(20 + (word(100000 + swaps) % 101));
}
process.stdout.write(JSON.stringify({ swaps, refused, heldMs, refusedRestores, strayRecords, completed: swaps === target }));
