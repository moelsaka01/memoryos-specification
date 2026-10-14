// MO-1308 Phase 3A steps C (C6) and E (E1-E7): NTFS semantics through real CLI processes. The Windows-only parts are the
// file-index reader (a second, independent reader in Python/ctypes next to Node's own), the handle holder (a Python process
// holding a name open with a chosen sharing mode), and the pause points of the preload (the stopped process is the product,
// at an exact step of the append protocol; the harness plants a name while it is stopped, then releases it).
import fs from 'node:fs';
import path from 'node:path';
import { CLI, appendArgs, recordDigestOf, sha, treeDigest } from './support.mjs';
import { conclude, recordById, register, run, work } from './env.mjs';
import { ledgerWith } from './cases-cli.mjs';
import { aclDeny, aclRestore, holdOpen, runPython, lstatOrNull, ntfsIdentity, parseClosed, pausedCli, removeTree, setReadOnly, sha256, snapshot, snapshotDiff, spawnTracked } from './win.mjs';

const p = (...parts) => path.join(...parts);
const entryName = (index) => `${String(index).padStart(20, '0')}.json`;
const hexOf = (record) => recordDigestOf(record.recordKind, record.members).slice('sha256:'.length);
const fileRows = (rows) => [...rows].filter(([, row]) => row.kind === 'file');
const toPath = (root, relative) => p(root, ...relative.split('/'));
const bytesOf = (file) => fs.readFileSync(file);
const mtimeOf = (file) => String(fs.statSync(file, { bigint: true }).mtimeNs);

// An append of corpus record `id` into `ledger` that stops at `point` (a pause point of the preload), plus the input directory.
function pausedAppend(env, ledger, id, name, point, extra = {}) {
  const record = recordById(env, id);
  const args = appendArgs(ledger, record, p(work(env, 'in'), `${name}-${id}`));
  const controller = pausedCli(env, CLI, args, { dir: p(work(env, 'pause'), name), points: [point], ...extra });
  return { controller, record };
}
// A10: staging names are <role>.<pid>.<n>, so a case cannot know them before the process runs. The stop (firstStaging) is the first look the product
// takes at a staging name (the lstat that refuses a planted link, before any create). The stopped process's id is read from the preload's reached
// file; the case plants or holds the names of THAT process and releases it. The product still meets the planted names at exactly the places the old
// fixed names were met (its first attempts, counters 0 and 1), so nothing a case proves is weakened.
const POINT = {
  firstStaging: { id: 'P', op: 'lstatSync', match: { 0: '[.]pending/(member|entry)-' }, nth: 1, when: 'before', action: 'pause' },
  memberLink: { id: 'P', op: 'linkSync', match: { 0: '[.]pending/member-' }, nth: 1, when: 'before', action: 'pause' },
  entryStage: { id: 'P', op: 'openSync', match: { 0: '[.]pending/entry-' }, nth: 1, when: 'before', action: 'pause' },
  entryLink: { id: 'P', op: 'linkSync', match: { 1: 'entries/[0-9]{20}[.]json$' }, nth: 1, when: 'before', action: 'pause' },
  entryUnlink: { id: 'P', op: 'unlinkSync', match: { 0: '[.]pending/entry-' }, nth: 1, when: 'before', action: 'pause' },
};
export { POINT, pausedAppend, entryName, hexOf };
export const memberStage = (hex, pid, n, name = 'checkpoint.json') => `member-${hex}-${name}.${pid}.${n}`;
export const entryStage = (index, pid, n) => `entry-${entryName(index).replace('.json', '')}.${pid}.${n}`;

// An append of corpus record `id` that is stopped before its first staging name is looked at. `during(pid)` acts on the stopped ledger (pid is the
// product process's own, read from the preload), then the append is released. Returns its CLI result and the pid.
export async function appendWithStagingNames(env, ledger, id, name, during) {
  const { controller } = pausedAppend(env, ledger, id, name, POINT.firstStaging);
  let pid = null;
  const result = await stoppedThenReleased(controller, async () => { pid = controller.reachedInfo('P').pid; await during(pid); });
  return { result, pid };
}

// Runs a paused append to its stop, lets `during` act on the stopped ledger, releases it, returns the CLI result.
export async function stoppedThenReleased(controller, during) {
  const reached = await controller.reached('P');
  if (!reached) { controller.kill(); const closed = await controller.closed; throw new Error(`the pause point was not reached: ${closed.stderr.slice(0, 160)}`); }
  try { await during(); } finally { controller.release('P'); }
  return parseClosed(await controller.closed);
}

export const ntfsCases = {
  '3A-C6': (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'c6', ['mip-reference', 'policy-0', 'cicd-4', 'readiness-ready']);
    const cross = (rows, label) => {
      const names = fileRows(rows).map(([name]) => name);
      const independent = ntfsIdentity(env, names.map((name) => toPath(ledger, name)));
      independent.forEach((row, index) => {
        const mine = rows.get(names[index]);
        if (row.error !== undefined) problems.push(`${label}: the independent reader failed on ${names[index]}`);
        else if (row.fileIndex !== mine.ino || row.links !== mine.nlink) problems.push(`${label}: the readers disagree on ${names[index]} (${row.fileIndex}/${row.links} vs ${mine.ino}/${mine.nlink})`);
      });
    };
    const base = snapshot(ledger);
    cross(base, 'initial');
    const steps = [];
    let current = base;
    const stable = (label, allowRemoved = []) => {
      const after = snapshot(ledger);
      for (const [name, row] of fileRows(current)) {
        const now = after.get(name);
        if (now === undefined) { if (!allowRemoved.includes(name)) problems.push(`${label}: ${name} disappeared`); continue; }
        if (now.sha256 !== row.sha256 || now.ino !== row.ino || now.size !== row.size) problems.push(`${label}: ${name} changed bytes or file index`);
        if (now.nlink !== 1) problems.push(`${label}: ${name} has ${now.nlink} names`);
      }
      steps.push({ label, files: fileRows(after).length });
      current = after;
      return after;
    };
    const ok = (label, result) => { if (result.status !== 0) problems.push(`${label}: exit ${result.status} ${result.code}`); };
    ok('verify', run(env, ['history', 'verify', '--ledger', ledger, '--json'])); stable('verify');
    ok('query', run(env, ['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '100', '--json'])); stable('query');
    const decision = recordById(env, 'decision-ready-approve');
    ok('append', run(env, appendArgs(ledger, decision, p(work(env, 'in'), 'c6-decision')))); stable('append');
    ok('export', run(env, ['history', 'export', '--ledger', ledger, '--output', p(work(env, 'c6x'), 'export'), '--json'])); stable('export');
    const target = hexOf(recordById(env, 'mip-reference'));
    const targetMembers = [...current.keys()].filter((name) => name.startsWith(`records/${target}/`));
    ok('tombstone', run(env, ['history', 'tombstone', '--ledger', ledger, '--target', '0', '--reason', 'OPERATOR_CORRECTION', '--authority-reference', 'P3A-C6', '--json']));
    const after = stable('tombstone (the only deletion)', targetMembers);
    for (const name of targetMembers) if (after.has(name)) problems.push(`the purged member ${name} still exists`);
    const removedElsewhere = [...base.keys()].filter((name) => !after.has(name) && !name.startsWith(`records/${target}`));
    if (removedElsewhere.length > 0) problems.push(`only purge deletes members, yet ${removedElsewhere.join(', ')} vanished`);
    ok('verify after', run(env, ['history', 'verify', '--ledger', ledger, '--json'])); stable('verify after purge');
    cross(after, 'final');
    const seen = new Map();
    for (const [name, row] of fileRows(after)) { if (seen.has(row.ino)) problems.push(`${name} shares a file index with ${seen.get(row.ino)}`); seen.set(row.ino, name); }
    conclude(h, problems, { filesInitially: fileRows(base).length, steps, purgedMembers: targetMembers.length, independentReader: 'Python ctypes GetFileInformationByHandle' });
  },

  '3A-E1': async (h, env) => {
    const problems = [];
    const results = {};
    const record = recordById(env, 'checkpoint-c00');
    const hex = hexOf(record);
    // (a) staging names that exist in another case are skipped: never opened, never replaced
    const a = ledgerWith(env, 'e1-staging', []); register(env, a, false, { interrupted: true }); // planted staging leftovers are disclosed anomalies
    // the stopped process's own names (A10): its first entry and member names in another case, and its second member name
    let stagingPlants = [];
    const planted = new Map();
    const appended = await appendWithStagingNames(env, a, 'checkpoint-c00', 'e1-a', (pid) => {
      stagingPlants = [`ENTRY-${entryName(0).replace('.json', '')}.${pid}.0`, `MEMBER-${hex}-CHECKPOINT.JSON.${pid}.0`, memberStage(hex, pid, 1)];
      for (const name of stagingPlants) { const file = p(a, '.pending', name); fs.writeFileSync(file, `planted ${name}`, { flag: 'wx' }); planted.set(file, { bytes: sha256(bytesOf(file)), mtime: mtimeOf(file), ino: String(fs.statSync(file, { bigint: true }).ino) }); }
    });
    results.staging = appended.result.status; results.processId = appended.pid;
    if (appended.result.status !== 0) problems.push(`the append beside differently cased staging names failed: ${appended.result.code}`);
    for (const [file, before] of planted) {
      if (!fs.existsSync(file)) problems.push(`${path.basename(file)}: a planted staging name was removed`);
      else if (sha256(bytesOf(file)) !== before.bytes || mtimeOf(file) !== before.mtime || String(fs.statSync(file, { bigint: true }).ino) !== before.ino) problems.push(`${path.basename(file)}: a planted staging name was opened or replaced`);
    }
    const verifyA = run(env, ['history', 'verify', '--ledger', a, '--json']);
    if (verifyA.status !== 0 || verifyA.json?.result?.pendingArtifacts !== stagingPlants.length) problems.push(`verify after: ${verifyA.status} pending ${verifyA.json?.result?.pendingArtifacts}`);
    // (b) the commit name taken in another case between the read and the link: LEDGER_CONFLICT, the planted bytes untouched
    for (const [label, plantedName] of [['entry name in another case', `${entryName(0).replace('.json', '')}.JSON`], ['entry name in the same case', entryName(0)]]) {
      const ledger = ledgerWith(env, `e1-${label.replace(/\W+/g, '-')}`, []);
      register(env, ledger, true);
      const { controller } = pausedAppend(env, ledger, 'checkpoint-c01', `e1-${label.replace(/\W+/g, '-')}`, POINT.entryLink, { mode: { events: true } });
      const plant = p(ledger, 'entries', plantedName);
      let before = null;
      const result = await stoppedThenReleased(controller, () => { fs.writeFileSync(plant, 'the other writer\'s entry', { flag: 'wx' }); before = { bytes: sha256(bytesOf(plant)), mtime: mtimeOf(plant) }; });
      results[label] = `${result.status}:${result.code}`;
      if (result.status !== 4 || result.code !== 'MO1308_LEDGER_CONFLICT') problems.push(`${label}: ${result.status} ${result.code}`);
      if (sha256(bytesOf(plant)) !== before.bytes || mtimeOf(plant) !== before.mtime) problems.push(`${label}: the planted name was modified`);
      const names = fs.readdirSync(p(ledger, 'entries'));
      if (names.length !== 1 || names[0] !== plantedName) problems.push(`${label}: entries holds ${JSON.stringify(names)}`);
      if (fs.readdirSync(p(ledger, '.pending')).length !== 0) problems.push(`${label}: the loser left a staging name`);
      const opened = controller.events().filter((event) => event.op === 'openSync' && event.ok === true && String(event.a0).toLowerCase() === plant.replaceAll('\\', '/').toLowerCase());
      if (opened.length > 0) problems.push(`${label}: the planted name was opened`);
    }
    conclude(h, problems, { results, stagingPlanted: stagingPlants.length });
  },

  '3A-E2': async (h, env) => {
    const problems = [];
    const results = {};
    // the primitive the store relies on: a hard link never replaces a name, in any case
    const base = work(env, 'e2');
    const staged = p(base, 'staged.bin'); const taken = p(base, 'Taken.bin');
    fs.writeFileSync(staged, 'staged'); fs.writeFileSync(taken, 'taken');
    for (const variant of [taken, p(base, 'TAKEN.BIN'), p(base, 'taken.bin')]) {
      try { fs.linkSync(staged, variant); problems.push(`a hard link replaced ${path.basename(variant)}`); } catch (error) { if (error.code !== 'EEXIST') problems.push(`${path.basename(variant)}: ${error.code}`); }
    }
    if (fs.readFileSync(taken, 'utf8') !== 'taken') problems.push('the primitive replaced an existing name');
    // the member name: different bytes under another case are RECORD_BYTES_MISMATCH and the planted bytes survive
    const record = recordById(env, 'checkpoint-c02');
    const hex = hexOf(record);
    const mismatch = ledgerWith(env, 'e2-member-different', []);
    const first = pausedAppend(env, mismatch, 'checkpoint-c02', 'e2-member-different', POINT.memberLink);
    const plant = p(mismatch, 'records', hex, 'CHECKPOINT.JSON');
    let before = null;
    const result = await stoppedThenReleased(first.controller, () => { fs.writeFileSync(plant, 'different bytes', { flag: 'wx' }); before = { bytes: sha256(bytesOf(plant)), mtime: mtimeOf(plant) }; });
    results.memberDifferent = `${result.status}:${result.code}`;
    if (result.status !== 3 || result.code !== 'MO1308_RECORD_BYTES_MISMATCH') problems.push(`member in another case, different bytes: ${result.status} ${result.code}`);
    if (sha256(bytesOf(plant)) !== before.bytes || mtimeOf(plant) !== before.mtime) problems.push('the planted member was modified');
    if (fs.readdirSync(p(mismatch, 'entries')).length !== 0) problems.push('an entry was committed over a mismatching member');
    register(env, mismatch, true, { interrupted: true });
    // the member name: identical bytes under another case are accepted after a byte comparison, never replaced
    const identical = ledgerWith(env, 'e2-member-identical', []);
    const second = pausedAppend(env, identical, 'checkpoint-c02', 'e2-member-identical', POINT.memberLink);
    const plant2 = p(identical, 'records', hex, 'CHECKPOINT.JSON');
    let before2 = null;
    const result2 = await stoppedThenReleased(second.controller, () => { fs.writeFileSync(plant2, record.members[0].bytes, { flag: 'wx' }); before2 = { bytes: sha256(bytesOf(plant2)), mtime: mtimeOf(plant2), ino: String(fs.statSync(plant2, { bigint: true }).ino) }; });
    results.memberIdentical = `${result2.status}:${result2.code}`;
    if (result2.status !== 0) problems.push(`member in another case, identical bytes: ${result2.status} ${result2.code}`);
    if (sha256(bytesOf(plant2)) !== before2.bytes || mtimeOf(plant2) !== before2.mtime || String(fs.statSync(plant2, { bigint: true }).ino) !== before2.ino) problems.push('the identical planted member was replaced');
    if (fs.readdirSync(p(identical, 'records', hex)).length !== 1) problems.push(`the record directory holds ${JSON.stringify(fs.readdirSync(p(identical, 'records', hex)))}`);
    // the ledger now has a differently cased member name: reads fail closed (a layout defect, never silently accepted)
    const afterRead = run(env, ['history', 'verify', '--ledger', identical, '--json']);
    results.verifyAfterCasedMember = `${afterRead.status}:${afterRead.code}`;
    if (afterRead.status !== 3 || afterRead.code !== 'MO1308_LEDGER_CORRUPT') problems.push(`a cased member name must fail closed: ${afterRead.status} ${afterRead.code}`);
    register(env, identical, true);
    conclude(h, problems, { results });
  },

  '3A-E3': async (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'e3', []);
    const events = [];
    const rows = [];
    for (const [index, id] of ['cicd-6', 'mip-reference', 'policy-0'].entries()) {
      const record = recordById(env, id);
      const controller = pausedCli(env, CLI, appendArgs(ledger, record, p(work(env, 'in'), `e3-${id}`)), { dir: p(work(env, 'pause'), `e3-${index}`), mode: { events: true } });
      const result = parseClosed(await controller.closed);
      if (result.status !== 0) { problems.push(`append ${id}: ${result.status} ${result.code}`); continue; }
      events.push(...controller.events().filter((event) => event.op === 'linkSync' && event.ok === true));
      rows.push({ id, hex: hexOf(record), members: record.members.map((member) => ({ name: member.name, sha: sha256(Buffer.from(member.bytes)) })) });
    }
    // every publication was a hard link: the staging name and the final name were one file (same index; two names at that moment)
    for (const event of events) {
      if (event.srcIno === null || event.srcIno !== event.destIno) problems.push(`${path.basename(event.a1)}: not a hard link of its staging file (${event.srcIno} vs ${event.destIno})`);
      if (event.destNlink !== 2) problems.push(`${path.basename(event.a1)}: ${event.destNlink} names right after the link`);
    }
    const expectedLinks = rows.reduce((sum, row) => sum + row.members.length, 0) + rows.length;
    if (events.length !== expectedLinks) problems.push(`${events.length} link operations, ${expectedLinks} expected (members plus entries)`);
    // afterwards: one name per file, distinct file indexes, identical bytes
    const after = snapshot(ledger);
    const seen = new Map();
    for (const [name, row] of fileRows(after)) {
      if (row.nlink !== 1) problems.push(`${name}: ${row.nlink} names after the operation`);
      if (seen.has(row.ino)) problems.push(`${name} shares a file index with ${seen.get(row.ino)}`); else seen.set(row.ino, name);
    }
    for (const row of rows) for (const member of row.members) {
      const stored = after.get(`records/${row.hex}/${member.name}`);
      if (stored === undefined || stored.sha256 !== member.sha) problems.push(`${row.hex.slice(0, 8)}/${member.name}: stored bytes differ from the supplied bytes`);
    }
    const independent = ntfsIdentity(env, fileRows(after).map(([name]) => toPath(ledger, name)));
    independent.forEach((row, index) => { if (row.fileIndex !== fileRows(after)[index][1].ino) problems.push('the independent reader disagrees with the stat file index'); });
    conclude(h, problems, { linkOperations: events.length, publishedFiles: seen.size, allSameFileAtLink: events.every((event) => event.srcIno === event.destIno), distinctFileIndexes: seen.size === fileRows(after).length });
  },

  '3A-E4': async (h, env) => {
    const problems = [];
    const results = {};
    const ledger = ledgerWith(env, 'e4', ['mip-reference', 'policy-0']);
    const before = snapshot(ledger);
    const exportDir = p(work(env, 'e4x'), 'export');
    const targets = [`entries/${entryName(0)}`, `entries/${entryName(1)}`, `records/${hexOf(recordById(env, 'mip-reference'))}/package.mip`, 'memoryos-history-ledger.json'];
    for (const relative of targets) {
      const file = toPath(ledger, relative);
      const holder = await holdOpen(env, file, 'none');
      try {
        for (const [name, args] of [['verify', ['history', 'verify', '--ledger', ledger, '--json']],
          ['append', appendArgs(ledger, recordById(env, 'checkpoint-c03'), p(work(env, 'in'), 'e4'))],
          ['export', ['history', 'export', '--ledger', ledger, '--output', exportDir, '--json']]]) {
          const result = run(env, args);
          results[`${relative} ${name}`] = `${result.status}:${result.code}`;
          if (result.status !== 4 || result.code !== 'MO1308_IO') problems.push(`${name} with ${relative} locked: ${result.status} ${result.code}`);
        }
      } finally { await holder.release(); }
      const during = snapshotDiff(before, snapshot(ledger));
      if (during.length > 0) problems.push(`${relative}: the ledger changed while locked: ${during.slice(0, 3).join(', ')}`);
      if (fs.existsSync(exportDir)) problems.push('an export was created while a file was locked');
      const restored = run(env, ['history', 'verify', '--ledger', ledger, '--json']);
      if (restored.status !== 0) problems.push(`${relative}: released but verify gives ${restored.status} ${restored.code}`);
    }
    const final = run(env, appendArgs(ledger, recordById(env, 'checkpoint-c03'), p(work(env, 'in'), 'e4')));
    if (final.status !== 0) problems.push(`service was not restored: ${final.status} ${final.code}`);
    conclude(h, problems, { results, lockedFiles: targets.length });
  },

  '3A-E5': async (h, env) => {
    const problems = [];
    const record = recordById(env, 'checkpoint-c04');
    const hex = hexOf(record);
    const ledger = ledgerWith(env, 'e5', []); register(env, ledger, false, { interrupted: true }); // held leftovers stay as disclosed anomalies
    // the first two member and entry names of the stopped process (A10 names), held open with sharing none while the product runs on
    let leftovers = [];
    const expected = new Map();
    const holders = [];
    let result;
    try {
      ({ result } = await appendWithStagingNames(env, ledger, 'checkpoint-c04', 'e5', async (pid) => {
        leftovers = [memberStage(hex, pid, 0), memberStage(hex, pid, 1), entryStage(0, pid, 0), entryStage(0, pid, 1)].map((name) => p(ledger, '.pending', name));
        leftovers.forEach((file, index) => { fs.writeFileSync(file, `leftover ${index}`, { flag: 'wx' }); expected.set(file, { bytes: sha256(bytesOf(file)), ino: String(fs.statSync(file, { bigint: true }).ino) }); });
        for (const file of leftovers) holders.push(await holdOpen(env, file, 'none'));
      }));
    } finally { for (const holder of holders) await holder.release(); }
    if (result.status !== 0 || result.json?.result?.index !== 0) problems.push(`the append used held names badly: ${result.status} ${result.code}`);
    for (const [file, before] of expected) {
      if (!fs.existsSync(file) || sha256(bytesOf(file)) !== before.bytes || String(fs.statSync(file, { bigint: true }).ino) !== before.ino) problems.push(`${path.basename(file)} was opened, replaced or removed`);
    }
    const verified = run(env, ['history', 'verify', '--ledger', ledger, '--json']);
    if (verified.status !== 0 || verified.json?.result?.pendingArtifacts !== leftovers.length) problems.push(`verify: ${verified.status} pending ${verified.json?.result?.pendingArtifacts}`);
    conclude(h, problems, { heldNames: leftovers.length, pendingArtifactsReported: verified.json?.result?.pendingArtifacts ?? null });
  },

  '3A-E6': async (h, env) => {
    // Q02, hypothesis 2: a staging name that is delete-pending (marked for deletion with the classic, non-POSIX disposition while
    // another handle stays open: the name remains on the volume until that handle closes). The probe records what an exclusive
    // create of such a name returns, and what the product does when its first staging names are in that state. Pre-registered:
    // CONFIRMED = the exclusive create is EPERM and the product fails with a typed IO; NOT_CONFIRMED = the exclusive create is
    // EEXIST (or the state cannot be produced) and the product succeeds; anything else is UNEXPECTED and fails the case.
    const base = work(env, 'e6');
    const create = (file) => { try { fs.closeSync(fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o644)); return 'created'; } catch (error) { return error.code; } };
    const nodeFile = p(base, 'node-unlink.0');
    fs.writeFileSync(nodeFile, 'staging');
    const nodeHolder = await holdOpen(env, nodeFile, 'all');
    let nodeUnlink;
    try { fs.unlinkSync(nodeFile); nodeUnlink = create(nodeFile); } finally { await nodeHolder.release(); }
    const pendingFile = p(base, 'delete-pending.0');
    fs.writeFileSync(pendingFile, 'staging');
    const pendingHolder = await holdOpen(env, pendingFile, 'pending');
    let primitive; let listed;
    try { listed = fs.readdirSync(base).includes('delete-pending.0'); primitive = create(pendingFile); } finally { await pendingHolder.release(); }
    const afterRelease = fs.existsSync(pendingFile) ? 'name remains' : 'name gone';
    // the product with its first staging names delete-pending
    const record = recordById(env, 'checkpoint-c05');
    const hex = hexOf(record);
    const ledger = ledgerWith(env, 'e6', []);
    // the first member and entry names of the stopped process (A10 names) are made delete-pending
    const holders = [];
    let stateProduced = false;
    let product;
    try {
      ({ result: product } = await appendWithStagingNames(env, ledger, 'checkpoint-c05', 'e6', async (pid) => {
        const names = [memberStage(hex, pid, 0), entryStage(0, pid, 0)].map((n) => p(ledger, '.pending', n));
        for (const file of names) { fs.writeFileSync(file, 'pending'); holders.push(await holdOpen(env, file, 'pending')); }
        stateProduced = names.every((file) => fs.readdirSync(path.dirname(file)).includes(path.basename(file)));
      }));
    } finally { for (const held of holders) await held.release(); }
    const afterwards = run(env, ['history', 'verify', '--ledger', ledger, '--json']);
    let outcome = 'UNEXPECTED';
    if (listed && stateProduced && primitive === 'EPERM' && product.code === 'MO1308_IO') outcome = 'CONFIRMED';
    else if ((!listed || primitive === 'EEXIST' || primitive === 'created') && product.status === 0) outcome = 'NOT_CONFIRMED';
    register(env, ledger, false, { interrupted: product.status !== 0 });
    h.observe({
      outcome, deletePendingStateProduced: listed && stateProduced, exclusiveCreateOfDeletePendingName: primitive, exclusiveCreateAfterNodeUnlink: nodeUnlink, afterRelease,
      productAppend: `${product.status}:${product.code ?? 'ok'}`, verifyAfter: `${afterwards.status}:${afterwards.code ?? 'ok'}`,
      note: 'EPERM from the exclusive create and IO from the product confirm hypothesis 2; EEXIST (or no delete-pending state) and a successful append refute it',
    });
  },

  '3A-E7': (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'e7', ['mip-reference', 'policy-0', 'cicd-4']);
    const before = snapshot(ledger);
    const files = fileRows(before).map(([name]) => toPath(ledger, name));
    for (const file of files) setReadOnly(file, true);
    const marked = files.filter((file) => (fs.statSync(file).mode & 0o200) === 0).length;
    try {
      if (marked !== files.length) problems.push(`only ${marked} of ${files.length} files carry the read-only attribute`);
      const out = p(work(env, 'e7x'), 'export');
      for (const [name, args] of [['verify', ['history', 'verify', '--ledger', ledger, '--json']], ['query', ['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '10', '--json']],
        ['export', ['history', 'export', '--ledger', ledger, '--output', out, '--json']]]) {
        const result = run(env, args);
        if (result.status !== 0) problems.push(`${name} on read-only files: ${result.status} ${result.code}`);
      }
      const verifyExport = run(env, ['history', 'verify-export', '--export', out, '--json']);
      if (verifyExport.status !== 0) problems.push(`verify-export: ${verifyExport.status} ${verifyExport.code}`);
      const diff = snapshotDiff(before, snapshot(ledger), { identities: true });
      if (diff.length > 0) problems.push(`reads modified the ledger: ${diff.slice(0, 3).join(', ')}`);
    } finally { for (const file of files) setReadOnly(file, false); }
    conclude(h, problems, { readOnlyFiles: marked });
  },
};
void aclDeny; void aclRestore; void lstatOrNull; void removeTree; void sha; void treeDigest; void spawnTracked;
