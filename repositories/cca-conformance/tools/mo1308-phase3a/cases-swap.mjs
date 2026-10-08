// MO-1308 Phase 3A step G: directory-swap races (H40, Q01). The product is real CLI processes; the swap is done by the harness while the
// product is stopped at an exact step by the preload (G1-G5), or by a free-running junction swapper process (G6). The accepted H40 behaviour:
// a swap is detected AFTER the fact, never prevented, existing content is never overwritten or replaced, and every later read fails closed.
// Each case therefore asserts the typed failure, that nothing existing outside the ledger changed, that nothing was committed, and records
// what (if anything) landed outside before detection (the evidence for the Q01 disclosure).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { CLI, appendArgs, initArgs, recordDigestOf } from './support.mjs';
import { conclude, recordById, register, run, work } from './env.mjs';
import { ledgerWith } from './cases-cli.mjs';
import { POINT, entryName, hexOf, pausedAppend, stoppedThenReleased } from './cases-ntfs.mjs';
import { HERE, junction, parseClosed, pausedCli, removeLink, snapshot, snapshotDiff } from './win.mjs';
import { drbgWord } from '../mo1308-phase3/corpus.mjs';

const p = (...parts) => path.join(...parts);
const BOUNDARY = 'MO1308_FILESYSTEM_BOUNDARY';
const exists = (target) => { try { fs.lstatSync(target); return true; } catch { return false; } };
const verifyArgs = (ledger) => ['history', 'verify', '--ledger', ledger, '--json'];
const POINTS = {
  purgeUnlink: { id: 'P', op: 'unlinkSync', match: { 0: 'records/[0-9a-f]{64}/' }, nth: 1, when: 'before', action: 'pause' },
  exportMarker: { id: 'P', op: 'openSync', match: { 0: 'memoryos-history-export-complete[.]json$' }, nth: 1, when: 'before', action: 'pause' },
  descriptorLink: { id: 'P', op: 'linkSync', match: { 1: 'memoryos-history-ledger[.]json$' }, nth: 1, when: 'before', action: 'pause' },
  secondEntriesListing: { id: 'P', op: 'readdirSync', match: { 0: 'entries$' }, nth: 2, when: 'before', action: 'pause' },
};
export { POINTS };
const outsideDir = (env, name, decoys = {}) => {
  const directory = p(work(env, 'outside'), name);
  fs.mkdirSync(directory, { recursive: true });
  for (const [file, bytes] of Object.entries(decoys)) fs.writeFileSync(p(directory, file), bytes);
  return directory;
};
const decoyText = 'decoy content that must survive';
const landed = (directory, before) => snapshotDiff(before, snapshot(directory)).filter((row) => row.startsWith('added')).map((row) => row.slice('added: '.length));
const changedExisting = (directory, before) => snapshotDiff(before, snapshot(directory)).filter((row) => !row.startsWith('added'));

async function stoppedRun(env, args, point, name, during, { mode } = {}) {
  const controller = pausedCli(env, CLI, args, { dir: p(work(env, 'pause'), name), points: [point], mode });
  const result = await stoppedThenReleased(controller, during);
  return { controller, result };
}

export const swapCases = {
  '3A-G1': async (h, env) => {
    const problems = []; const results = {}; const evidence = {};
    for (const [variant, decoy] of [['decoy', true], ['bare', false]]) {
      const ledger = ledgerWith(env, `g1-${variant}`, ['checkpoint-c00']); register(env, ledger, true);
      const outside = outsideDir(env, `g1-${variant}`, decoy ? { 'checkpoint.json': decoyText } : {});
      const before = snapshot(outside);
      const hex = hexOf(recordById(env, 'checkpoint-c01'));
      const { controller } = pausedAppend(env, ledger, 'checkpoint-c01', `g1-${variant}`, POINT.memberLink);
      const result = await stoppedThenReleased(controller, () => { fs.rmdirSync(p(ledger, 'records', hex)); junction(outside, p(ledger, 'records', hex)); });
      results[`${variant}: the append`] = `${result.status}:${result.code}`;
      const allowed = decoy ? [BOUNDARY, 'MO1308_RECORD_BYTES_MISMATCH'] : [BOUNDARY];
      if (![3, 4].includes(result.status) || !allowed.includes(result.code)) problems.push(`${variant}: the swap was not detected as a typed failure: ${result.status} ${result.code}`);
      for (const row of changedExisting(outside, before)) problems.push(`${variant}: existing outside content changed: ${row}`);
      if (decoy && fs.readFileSync(p(outside, 'checkpoint.json'), 'utf8') !== decoyText) problems.push('the decoy was overwritten or replaced');
      if (fs.readdirSync(p(ledger, 'entries')).length !== 1) problems.push(`${variant}: an entry was committed`);
      for (const [name, args, wanted] of [['verify', verifyArgs(ledger), BOUNDARY], ['append', appendArgs(ledger, recordById(env, 'checkpoint-c02'), p(work(env, 'in'), `g1-${variant}-again`)), BOUNDARY],
        ['export', ['history', 'export', '--ledger', ledger, '--output', p(work(env, 'g1x'), variant), '--json'], BOUNDARY]]) {
        const later = run(env, args); results[`${variant}: later ${name}`] = `${later.status}:${later.code}`;
        if (later.code !== wanted) problems.push(`${variant}: a later ${name} gave ${later.status} ${later.code}, wanted fail-closed ${wanted}`);
      }
      const query = run(env, ['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '10', '--json']);
      if (query.status !== 0 || query.json?.result?.entries?.length !== 1) problems.push(`${variant}: a query reads the entries only and must still answer`);
      evidence[variant] = { landedOutsideBeforeDetection: landed(outside, before) };
      removeLink(p(ledger, 'records', hex)); fs.mkdirSync(p(ledger, 'records', hex));
      const restored = run(env, verifyArgs(ledger));
      if (restored.status !== 0) problems.push(`${variant}: restored but verify gives ${restored.status} ${restored.code}`);
      else register(env, ledger, false, { interrupted: true });
    }
    conclude(h, problems, { results, evidence, h40: 'detected after the fact; nothing prevented; no existing content overwritten' });
  },

  '3A-G2': async (h, env) => {
    const problems = []; const results = {}; const evidence = {};
    for (const [variant, decoy] of [['decoy', true], ['bare', false]]) {
      const ledger = ledgerWith(env, `g2-${variant}`, ['checkpoint-c00']); register(env, ledger, true);
      const outside = outsideDir(env, `g2-${variant}`, decoy ? { [entryName(1)]: decoyText } : {});
      const before = snapshot(outside);
      const entries = p(ledger, 'entries'); const moved = p(work(env, 'g2moved'), variant);
      const realBefore = snapshot(entries);
      const { controller } = pausedAppend(env, ledger, 'checkpoint-c01', `g2-${variant}`, POINT.entryLink);
      const result = await stoppedThenReleased(controller, () => { fs.renameSync(entries, moved); junction(outside, entries); });
      results[`${variant}: the append`] = `${result.status}:${result.code}`;
      if (result.status !== 4 || ![BOUNDARY, 'MO1308_LEDGER_CONFLICT'].includes(result.code)) problems.push(`${variant}: the swap at the commit point gave ${result.status} ${result.code}`);
      if (decoy && result.code === 'MO1308_LEDGER_CONFLICT') results[`${variant}: note`] = 'the decoy entry name existed, so the link lost like any commit race';
      for (const row of changedExisting(outside, before)) problems.push(`${variant}: existing outside content changed: ${row}`);
      for (const row of snapshotDiff(realBefore, snapshot(moved), { identities: true })) problems.push(`${variant}: the real entries directory changed: ${row}`);
      const later = run(env, verifyArgs(ledger)); results[`${variant}: later verify`] = `${later.status}:${later.code}`;
      if (later.code !== BOUNDARY) problems.push(`${variant}: a read through the swapped directory gave ${later.status} ${later.code}`);
      evidence[variant] = { landedOutsideBeforeDetection: landed(outside, before) };
      removeLink(entries); fs.renameSync(moved, entries);
      const restored = run(env, verifyArgs(ledger));
      if (restored.status !== 0 || restored.json?.result?.entryCount !== 1) problems.push(`${variant}: with the real directory back the ledger must verify unchanged: ${restored.status} ${restored.code}`);
      else register(env, ledger, false, { interrupted: true });
    }
    conclude(h, problems, { results, evidence });
  },

  '3A-G3': async (h, env) => {
    // A swap during a tombstone purge (A10, Freeze section 37.1 row 3): the tombstone entry is committed, then the record directory becomes a
    // junction to a directory that holds decoy files under the member names. The product proves the ledger root, records/ and the record directory
    // are not links and are the directories it read, before EVERY deletion. Two stops: (a) right after the tombstone entry was published, before the
    // purge starts, and (b) right after the first member was removed, before the next check. In both the purge must be refused with
    // MO1308_FILESYSTEM_BOUNDARY and NOTHING outside the ledger may be deleted or changed (every outside file byte-identical afterwards); every
    // later read fails closed, nothing existing is replaced, and the committed tombstone's purge is resumable. (A swap in the single instant between
    // the check and one unlink is the disclosed H40 residual and is not what this case tests.)
    const problems = []; const results = {};
    const record = recordById(env, 'cicd-4');
    const hex = hexOf(record);
    if (record.members.length < 2) problems.push(`the record has ${record.members.length} member(s): the between-members stop needs two`);
    const tombstoneArgs = (ledger) => ['history', 'tombstone', '--ledger', ledger, '--target', '1', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A-G3', '--json'];
    const stops = [
      ['before the purge starts', { id: 'P', op: 'linkSync', match: { 1: 'entries/[0-9]{20}[.]json$' }, nth: 1, when: 'after', action: 'pause' }, 0],
      ['between two members', { id: 'P', op: 'unlinkSync', match: { 0: 'records/[0-9a-f]{64}/' }, nth: 1, when: 'after', action: 'pause' }, 1],
    ];
    const outsideSnapshots = {};
    for (const [stop, point, removedFromReal] of stops) {
      const tag = stop.replace(/\W+/g, '-');
      const ledger = ledgerWith(env, `g3-${tag}`, ['checkpoint-c00', 'cicd-4']); register(env, ledger, true);
      const decoys = Object.fromEntries(record.members.map((member) => [member.name, `${decoyText} ${member.name}`]));
      const outside = outsideDir(env, `g3-${tag}`, decoys);
      const before = snapshot(outside);
      const moved = p(work(env, 'g3moved'), tag);
      const realBefore = snapshot(p(ledger, 'records', hex));
      const { result } = await stoppedRun(env, tombstoneArgs(ledger), point, `g3-${tag}`,
        () => { fs.renameSync(p(ledger, 'records', hex), moved); junction(outside, p(ledger, 'records', hex)); });
      results[`${stop}: the tombstone`] = `${result.status}:${result.code ?? 'ok'}`;
      if (result.status !== 4 || result.code !== BOUNDARY) problems.push(`${stop}: the purge gave ${result.status} ${result.code ?? 'ok'}, wanted 4 ${BOUNDARY}`);
      // nothing outside the ledger was deleted, changed or added
      for (const row of snapshotDiff(before, snapshot(outside), { identities: true })) problems.push(`${stop}: outside content changed: ${row}`);
      for (const [name, text] of Object.entries(decoys)) {
        const file = p(outside, name);
        if (!exists(file) || fs.readFileSync(file, 'utf8') !== text) problems.push(`${stop}: the outside sentinel ${name} is missing or differs`);
      }
      outsideSnapshots[stop] = { files: Object.keys(decoys).length, unchanged: true };
      // the real record directory lost at most the members removed before the swap
      const realRows = snapshotDiff(realBefore, snapshot(moved), { identities: true });
      if (realRows.length !== removedFromReal || realRows.some((row) => !row.startsWith('removed'))) problems.push(`${stop}: the real record directory changed unexpectedly: ${realRows.join(', ')}`);
      const later = run(env, verifyArgs(ledger)); results[`${stop}: later verify`] = `${later.status}:${later.code}`;
      if (later.code !== BOUNDARY) problems.push(`${stop}: a read after the swap gave ${later.status} ${later.code}, wanted fail-closed ${BOUNDARY}`);
      removeLink(p(ledger, 'records', hex)); fs.renameSync(moved, p(ledger, 'records', hex));
      const restored = run(env, verifyArgs(ledger));
      results[`${stop}: verify with the real directory back`] = `${restored.status}:${restored.code ?? 'ok'}`;
      if (restored.status !== 0 || !(restored.json?.result?.purgePending ?? []).includes(1)) problems.push(`${stop}: with the real directory back the committed tombstone must show the purge as pending`);
      else {
        const finish = run(env, tombstoneArgs(ledger));
        results[`${stop}: rerun finishes the purge`] = `${finish.status}:${finish.code ?? 'ok'}`;
        if (finish.status !== 0) problems.push(`${stop}: the purge rerun gave ${finish.status} ${finish.code}`); else register(env, ledger, false, { interrupted: true });
      }
    }
    conclude(h, problems, { results, outside: outsideSnapshots, decoysDeletedThroughTheSwappedJunction: [], h40: 'a swap between the check and one unlink is not prevented (Q01); a swap before a check is refused with nothing deleted' });
  },

  '3A-G4': async (h, env) => {
    const problems = []; const results = {}; const evidence = {};
    // export: the output directory is swapped for a junction after the product created it, before the completion marker
    for (const [variant, decoy] of [['decoy', true], ['bare', false]]) {
      const ledger = ledgerWith(env, `g4-export-${variant}`, ['checkpoint-c00', 'policy-0']);
      const outside = outsideDir(env, `g4-export-${variant}`, decoy ? { 'memoryos-history-export-complete.json': decoyText } : {});
      const before = snapshot(outside); const ledgerBefore = snapshot(ledger);
      const output = p(work(env, 'g4x'), `export-${variant}`); const moved = p(work(env, 'g4x'), `moved-${variant}`);
      const { result } = await stoppedRun(env, ['history', 'export', '--ledger', ledger, '--output', output, '--json'], POINTS.exportMarker, `g4-export-${variant}`,
        () => { fs.renameSync(output, moved); junction(outside, output); });
      results[`export ${variant}`] = `${result.status}:${result.code}`;
      if (result.status !== 4 || ![BOUNDARY, 'MO1308_IO'].includes(result.code)) problems.push(`export ${variant}: ${result.status} ${result.code}`);
      for (const row of changedExisting(outside, before)) problems.push(`export ${variant}: existing outside content changed: ${row}`);
      if (decoy && fs.readFileSync(p(outside, 'memoryos-history-export-complete.json'), 'utf8') !== decoyText) problems.push('the decoy marker was overwritten');
      for (const row of snapshotDiff(ledgerBefore, snapshot(ledger), { identities: true })) problems.push(`export ${variant}: the ledger changed: ${row}`);
      const incomplete = run(env, ['history', 'verify-export', '--export', moved, '--json']);
      if (incomplete.code !== 'MO1308_EXPORT_CORRUPT') problems.push(`export ${variant}: the real, unfinished export gave ${incomplete.status} ${incomplete.code}, wanted EXPORT_CORRUPT`);
      evidence[`export ${variant}`] = { landedOutsideBeforeDetection: landed(outside, before) };
      removeLink(output);
    }
    // init: the new ledger directory is swapped for a junction before its descriptor is published
    for (const [variant, decoy] of [['decoy', true], ['bare', false]]) {
      const outside = outsideDir(env, `g4-init-${variant}`, decoy ? { 'memoryos-history-ledger.json': decoyText } : {});
      const before = snapshot(outside);
      const ledger = p(work(env, 'g4i'), `ledger-${variant}`); const moved = p(work(env, 'g4i'), `moved-${variant}`);
      const { result } = await stoppedRun(env, initArgs(ledger, 'g4'), POINTS.descriptorLink, `g4-init-${variant}`, () => { fs.renameSync(ledger, moved); junction(outside, ledger); });
      results[`init ${variant}`] = `${result.status}:${result.code}`;
      if (result.status !== 4 || ![BOUNDARY, 'MO1308_LEDGER_EXISTS', 'MO1308_IO'].includes(result.code)) problems.push(`init ${variant}: ${result.status} ${result.code}`);
      for (const row of changedExisting(outside, before)) problems.push(`init ${variant}: existing outside content changed: ${row}`);
      if (exists(p(moved, 'memoryos-history-ledger.json'))) problems.push(`init ${variant}: a descriptor was published into the real directory after the swap`);
      evidence[`init ${variant}`] = { landedOutsideBeforeDetection: landed(outside, before) };
      removeLink(ledger);
    }
    conclude(h, problems, { results, evidence });
  },

  '3A-G5': async (h, env) => {
    // the ledger root is swapped for a junction to a different ledger between the two entry listings of one read: the answer is either the
    // original ledger's or a typed failure, never the other ledger's
    const problems = []; const results = {};
    for (const [variant, ids] of [['different entry count', ['checkpoint-c05', 'checkpoint-c06', 'checkpoint-c07']], ['same entry count', ['checkpoint-c05', 'checkpoint-c06']]]) {
      const name = variant.replace(/\W+/g, '-');
      const ledger = ledgerWith(env, `g5-${name}`, ['checkpoint-c00', 'checkpoint-c01']);
      const other = ledgerWith(env, `g5-${name}-other`, ids);
      const originalHead = run(env, verifyArgs(ledger)).json?.result?.headDigest;
      const otherHead = run(env, verifyArgs(other)).json?.result?.headDigest;
      if (originalHead === otherHead) problems.push('the two ledgers are the same');
      const before = snapshot(ledger);
      const moved = p(work(env, 'g5moved'), name);
      const { result } = await stoppedRun(env, verifyArgs(ledger), POINTS.secondEntriesListing, `g5-${name}`, () => { fs.renameSync(ledger, moved); junction(other, ledger); });
      const head = result.json?.result?.headDigest ?? null;
      results[variant] = `${result.status}:${result.code ?? 'ok'}${head === null ? '' : head === originalHead ? ':original' : ':OTHER'}`;
      if (head !== null && head !== originalHead) problems.push(`${variant}: the read reported the other ledger's head`);
      if (result.status !== 0 && result.code !== BOUNDARY) problems.push(`${variant}: ${result.status} ${result.code}, wanted the original answer or ${BOUNDARY}`);
      for (const row of snapshotDiff(before, snapshot(moved), { identities: true })) problems.push(`${variant}: the real ledger changed: ${row}`);
      removeLink(ledger); fs.renameSync(moved, ledger);
      if (run(env, verifyArgs(ledger)).status !== 0) problems.push(`${variant}: not restored`);
    }
    conclude(h, problems, { results });
  },

  '3A-G6': async (h, env) => {
    const problems = []; const results = {};
    const ledger = ledgerWith(env, 'g6', ['checkpoint-c00']); register(env, ledger, true);
    const outside = outsideDir(env, 'g6', { 'sentinel.txt': 'outside content that must survive' });
    const before = snapshot(outside);
    const swaps = 200;
    const swapper = spawn(process.execPath, [p(HERE, 'swapper.mjs'), env.workRoot, ledger, outside, String(swaps), 'MO1308-P3-G6-SWAP-1', '480'], { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let swapperOut = ''; swapper.stdout.on('data', (chunk) => { swapperOut += chunk; });
    const swapperDone = new Promise((resolve) => swapper.on('close', resolve));
    let finished = false; swapperDone.then(() => { finished = true; });
    // three appenders race it: each appends its own records (checkpoint-f00..f29) until the swapper has done its swaps
    const attempts = [];
    const appender = async (slot) => {
      for (let index = 0; index < 10 && !finished; index += 1) {
        const id = `checkpoint-f${slot}${index}`;
        const result = parseClosed(await new Promise((resolve) => {
          const child = spawn(process.execPath, [CLI, ...appendArgs(ledger, recordById(env, id), p(work(env, 'in'), `g6-${id}`))], { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } });
          let out = ''; let err = '';
          child.stdout.on('data', (chunk) => { out += chunk; }); child.stderr.on('data', (chunk) => { err += chunk; });
          child.on('close', (code, signal) => resolve({ code, signal, stdout: out, stderr: err }));
        }));
        attempts.push({ id, status: result.status, code: result.code });
      }
    };
    await Promise.all([appender(0), appender(1), appender(2)]);
    const swapperExit = await swapperDone;
    let swapped = null; try { swapped = JSON.parse(swapperOut); } catch { problems.push(`the swapper reported nothing (exit ${swapperExit})`); }
    if (swapped !== null && swapped.swaps !== swaps) problems.push(`the swapper completed ${swapped.swaps} of ${swaps} swaps`);
    const allowed = new Set(['MO1308_LEDGER_CONFLICT', BOUNDARY, 'MO1308_IO', 'MO1308_RECORD_BYTES_MISMATCH', 'MO1308_LEDGER_NOT_FOUND', 'MO1308_LEDGER_CORRUPT']);
    const byCode = {};
    for (const attempt of attempts) { const key = attempt.status === 0 ? 'ok' : attempt.code ?? `exit-${attempt.status}`; byCode[key] = (byCode[key] ?? 0) + 1; if (attempt.status !== 0 && !allowed.has(attempt.code)) problems.push(`${attempt.id}: untyped or unexpected failure ${attempt.status} ${attempt.code}`); }
    for (const row of changedExisting(outside, before)) problems.push(`outside content changed: ${row}`);
    if (fs.readFileSync(p(outside, 'sentinel.txt'), 'utf8') !== 'outside content that must survive') problems.push('the sentinel was overwritten');
    if (exists(p(ledger, 'records.aside'))) problems.push('the swapper left records.aside');
    const recordsStat = fs.lstatSync(p(ledger, 'records'));
    if (!recordsStat.isDirectory() || recordsStat.isSymbolicLink()) problems.push('records is not a real directory after the swapper finished');
    const final = run(env, verifyArgs(ledger));
    results['final verify'] = `${final.status}:${final.code ?? 'ok'}`;
    if (final.status !== 0 && ![BOUNDARY, 'MO1308_LEDGER_CORRUPT', 'MO1308_RECORD_BYTES_MISMATCH'].includes(final.code)) problems.push(`the ledger neither verifies nor fails closed typed: ${final.status} ${final.code}`);
    if (final.status === 0) register(env, ledger, false, { interrupted: true });
    for (const name of fs.readdirSync(p(ledger, 'entries'))) { try { JSON.parse(fs.readFileSync(p(ledger, 'entries', name), 'utf8')); } catch { problems.push(`${name} is not a complete entry`); } }
    conclude(h, problems, { swaps: swapped, appenderAttempts: attempts.length, byCode, results, landedOutsideBeforeDetection: landed(outside, before), schedule: 'MO1308-P3-G6-SWAP-1 (200 swaps, seeded holds of 5-25 ms)' });
  },
};
void recordDigestOf; void drbgWord;
