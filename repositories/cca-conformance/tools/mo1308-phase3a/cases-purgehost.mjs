// MO-1308 Phase 3A step I: tombstone and purge on the host (R18-R20). Real CLI processes on NTFS; a member held open with a sharing mode
// that forbids deletion (a Python holder), and a purge stopped half-way by the preload and killed, are the host-only parts. The platform-neutral
// logic of the same rules is covered per record kind by 3C (E1-E5, F1-F5); here every assertion is made on the real file system.
import fs from 'node:fs';
import path from 'node:path';
import { CLI, appendArgs } from './support.mjs';
import { conclude, recordById, register, run, work } from './env.mjs';
import { ledgerWith } from './cases-cli.mjs';
import { hexOf } from './cases-ntfs.mjs';
import { POINTS } from './cases-swap.mjs';
import { holdOpen, pausedCli, snapshot } from './win.mjs';

const p = (...parts) => path.join(...parts);
const verifyArgs = (ledger) => ['history', 'verify', '--ledger', ledger, '--json'];
const queryArgs = (ledger, retention = 'ANY') => ['history', 'query', '--ledger', ledger, '--retention', retention, '--from', '0', '--limit', '100', '--json'];
const tombstoneArgs = (ledger, target, reference = 'P3A-I') => ['history', 'tombstone', '--ledger', ledger, '--target', String(target), '--reason', 'PRIVACY_REQUEST', '--authority-reference', reference, '--json'];
const exists = (target) => { try { fs.lstatSync(target); return true; } catch { return false; } };
const IDS = ['mip-reference', 'policy-0', 'readiness-ready', 'decision-ready-approve', 'checkpoint-c00'];
const entryFile = (ledger, index) => JSON.parse(fs.readFileSync(p(ledger, 'entries', `${String(index).padStart(20, '0')}.json`), 'utf8'));

export const purgeHostCases = {
  '3A-I1': (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'i1', IDS);
    const before = run(env, verifyArgs(ledger)).json.result;
    const policyHex = hexOf(recordById(env, 'policy-0'));
    const result = run(env, tombstoneArgs(ledger, 1));
    if (result.status !== 0 || result.json?.result?.index !== 5) problems.push(`the tombstone gave ${result.status} ${result.code} (index ${result.json?.result?.index})`);
    const after = run(env, verifyArgs(ledger));
    if (after.status !== 0) problems.push(`the chain does not verify after the purge: ${after.code}`);
    const view = after.json?.result ?? {};
    if (view.purgedRecords !== 1 || view.retainedRecords !== before.retainedRecords - 1 || view.tombstones !== 1 || (view.purgePending ?? [1]).length !== 0) problems.push(`the verification counts are wrong: ${JSON.stringify({ purged: view.purgedRecords, retained: view.retainedRecords, tombstones: view.tombstones, pending: view.purgePending })}`);
    if (exists(p(ledger, 'records', policyHex)) && fs.readdirSync(p(ledger, 'records', policyHex)).length > 0) problems.push('the purged record still has member files');
    const query = run(env, queryArgs(ledger));
    const entries = query.json?.result?.entries ?? [];
    const purged = entries.find((entry) => entry.index === 1);
    if (purged?.retention !== 'PURGED' || purged?.tombstoneIndex !== 5) problems.push(`the purged entry is reported ${purged?.retention} / tombstone ${purged?.tombstoneIndex}`);
    for (const entry of entries.filter((item) => item.entryType === 'RECORD' && item.index !== 1)) if (entry.retention !== 'RETAINED') problems.push(`entry ${entry.index} is ${entry.retention}`);
    const tombstone = entryFile(ledger, 5);
    if (tombstone.entryType !== 'TOMBSTONE' || tombstone.tombstone?.authenticity !== 'NOT_VERIFIED_BY_MEMORYOS') problems.push('the tombstone entry is not shaped or labelled as required');
    const onlyPurged = run(env, queryArgs(ledger, 'PURGED')).json?.result?.entries?.map((entry) => entry.index) ?? [];
    if (JSON.stringify(onlyPurged) !== '[1,5]') problems.push(`the PURGED filter returns ${JSON.stringify(onlyPurged)}`);
    conclude(h, problems, { verification: { entries: view.entryCount, purged: view.purgedRecords, retained: view.retainedRecords, tombstones: view.tombstones }, purgedEntryReportedAs: purged?.retention ?? null });
  },

  '3A-I2': async (h, env) => {
    const problems = [];
    const record = recordById(env, 'cicd-4'); const hex = hexOf(record);
    const ledger = ledgerWith(env, 'i2', ['checkpoint-c00', 'cicd-4']); register(env, ledger, false, { interrupted: true });
    const held = p(ledger, 'records', hex, 'memoryos-ci-evidence.json');
    const holder = await holdOpen(env, held, 'read'); // readable, but deletion is refused
    let blocked;
    try { blocked = run(env, tombstoneArgs(ledger, 1, 'P3A-I2')); } finally { await holder.release(); }
    if (blocked.status !== 4 || blocked.code !== 'MO1308_IO') problems.push(`the purge with a member held open gave ${blocked.status} ${blocked.code}, wanted a typed IO`);
    const mid = run(env, verifyArgs(ledger));
    if (mid.status !== 0 || JSON.stringify(mid.json?.result?.purgePending) !== '[1]' || mid.json?.result?.tombstones !== 1) problems.push(`the committed tombstone must show the purge as pending: ${mid.status} ${JSON.stringify(mid.json?.result?.purgePending)}`);
    if (!exists(held)) problems.push('the held member was deleted while it was held');
    const rerun = run(env, tombstoneArgs(ledger, 1, 'P3A-I2'));
    if (rerun.status !== 0) problems.push(`the rerun after release gave ${rerun.status} ${rerun.code}`);
    const final = run(env, verifyArgs(ledger));
    if (final.status !== 0 || final.json?.result?.entryCount !== 3 || (final.json?.result?.purgePending ?? [1]).length !== 0) problems.push('the rerun did not finish the purge without a new entry');
    conclude(h, problems, { whileHeld: `${blocked.status}:${blocked.code}`, pendingWhileHeld: mid.json?.result?.purgePending ?? null, rerun: rerun.status });
  },

  '3A-I3': (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'i3', ['mip-reference', 'checkpoint-c00']);
    const mip = recordById(env, 'mip-reference');
    const purge = run(env, tombstoneArgs(ledger, 0));
    if (purge.status !== 0) problems.push(`the purge failed: ${purge.code}`);
    const before = snapshot(ledger);
    const again = run(env, appendArgs(ledger, mip, p(work(env, 'in'), 'i3')));
    if (again.status !== 2 || again.code !== 'MO1308_RECORD_PURGED') problems.push(`re-supplying purged bytes gave ${again.status} ${again.code}`);
    const changed = [...snapshot(ledger)].filter(([name, row]) => !before.has(name) || JSON.stringify(before.get(name)) !== JSON.stringify(row));
    if (changed.length > 0) problems.push(`the refusal changed the ledger: ${changed[0][0]}`);
    // a different record of the same kind is still admitted
    const other = run(env, appendArgs(ledger, recordById(env, 'checkpoint-c01'), p(work(env, 'in'), 'i3b')));
    if (other.status !== 0) problems.push(`another record is refused: ${other.code}`);
    conclude(h, problems, { resupply: `${again.status}:${again.code}` });
  },

  '3A-I4': (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'i4', IDS);
    const hex = hexOf(recordById(env, 'policy-0'));
    run(env, tombstoneArgs(ledger, 1));
    const out = p(work(env, 'i4x'), 'export');
    const exported = run(env, ['history', 'export', '--ledger', ledger, '--output', out, '--json']);
    if (exported.status !== 0) problems.push(`the export failed: ${exported.code}`);
    const rows = [...snapshot(out)].filter(([, row]) => row.kind === 'file').map(([name]) => name);
    if (rows.some((name) => name.includes(hex))) problems.push('the export carries member bytes of the purged record');
    const entries = rows.filter((name) => name.startsWith('entries/'));
    if (entries.length !== 6) problems.push(`the export carries ${entries.length} entries, 6 expected (every record entry and the tombstone)`);
    const verified = run(env, ['history', 'verify-export', '--export', out, '--json']);
    if (verified.status !== 0) problems.push(`verify-export gave ${verified.status} ${verified.code}`);
    // the purged members' bytes appear nowhere in the export
    const policy = recordById(env, 'policy-0');
    const needles = policy.members.map((member) => Buffer.from(member.bytes));
    for (const name of rows) { const content = fs.readFileSync(p(out, ...name.split('/'))); for (const needle of needles) if (content.includes(needle)) problems.push(`${name} contains purged member bytes`); }
    const query = run(env, queryArgs(ledger)).json?.result?.entries ?? [];
    const kinds = query.map((entry) => `${entry.index}:${entry.entryType}`);
    if (!kinds.includes('1:RECORD') || !kinds.includes('5:TOMBSTONE')) problems.push(`query lacks the record entry or its tombstone: ${kinds.join(',')}`);
    conclude(h, problems, { exportFiles: rows.length, entriesExported: entries.length, queryEntries: kinds });
  },

  '3A-I5': (h, env) => {
    const problems = []; const results = {};
    const ledger = ledgerWith(env, 'i5', IDS);
    const attempt = (label, args, status, code) => { const result = run(env, args); results[label] = `${result.status}:${result.code ?? 'ok'}`; if (result.status !== status || (code !== null && result.code !== code)) problems.push(`${label}: ${result.status} ${result.code}, wanted ${status} ${code}`); return result; };
    attempt('a retained record entry', tombstoneArgs(ledger, 1), 0, null);
    attempt('the same target again', tombstoneArgs(ledger, 1, 'P3A-I5-second'), 2, 'MO1308_TOMBSTONE_INVALID');
    attempt('the same target again, other reason', ['history', 'tombstone', '--ledger', ledger, '--target', '1', '--reason', 'LEGAL_REQUIREMENT', '--authority-reference', 'P3A-I5', '--json'], 2, 'MO1308_TOMBSTONE_INVALID');
    attempt('a tombstone entry as the target', tombstoneArgs(ledger, 5), 2, 'MO1308_TOMBSTONE_INVALID');
    attempt('an index beyond the ledger', tombstoneArgs(ledger, 99), 2, 'MO1308_TOMBSTONE_INVALID');
    attempt('a non-numeric target', tombstoneArgs(ledger, 'one'), 1, 'MO1308_USAGE');
    attempt('a bad reason', ['history', 'tombstone', '--ledger', ledger, '--target', '2', '--reason', 'BECAUSE', '--authority-reference', 'P3A-I5', '--json'], 1, 'MO1308_USAGE');
    attempt('an authority reference with a control character', ['history', 'tombstone', '--ledger', ledger, '--target', '2', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'bad\u0007reference', '--json'], 1, null);
    attempt('a second, different target', tombstoneArgs(ledger, 2, 'P3A-I5-b'), 0, null);
    const entries = Array.from({ length: 7 }, (_, index) => entryFile(ledger, index));
    const tombstoneTargets = entries.filter((entry) => entry.entryType === 'TOMBSTONE').map((entry) => entry.tombstone.targetIndex).sort();
    if (JSON.stringify(tombstoneTargets) !== '[1,2]') problems.push(`tombstone targets ${JSON.stringify(tombstoneTargets)}`);
    if (fs.existsSync(p(ledger, 'entries', `${String(7).padStart(20, '0')}.json`))) problems.push('a refused tombstone left an entry');
    const verified = run(env, verifyArgs(ledger));
    if (verified.status !== 0) problems.push(`the chain does not verify: ${verified.code}`);
    conclude(h, problems, { results });
  },

  '3A-I6': async (h, env) => {
    const problems = [];
    const record = recordById(env, 'cicd-4'); const hex = hexOf(record);
    const ledger = ledgerWith(env, 'i6', ['checkpoint-c00', 'cicd-4']); register(env, ledger, false, { interrupted: true });
    const args = tombstoneArgs(ledger, 1, 'P3A-I6');
    // a purge stopped half-way and killed: one member deleted, three remain
    const controller = pausedCli(env, CLI, args, { dir: p(work(env, 'pause'), 'i6'), points: [{ ...POINTS.purgeUnlink, nth: 2 }] });
    if (!(await controller.reached('P'))) { controller.kill(); throw new Error('the purge did not reach its second deletion'); }
    controller.kill(); await controller.closed;
    const verify = run(env, verifyArgs(ledger)).json?.result;
    const query = run(env, queryArgs(ledger)).json?.result?.entries ?? [];
    const out = p(work(env, 'i6x'), 'export');
    const exported = run(env, ['history', 'export', '--ledger', ledger, '--output', out, '--json']);
    const view = query.find((entry) => entry.index === 1);
    if (JSON.stringify(verify?.purgePending) !== '[1]') problems.push(`verify: purgePending ${JSON.stringify(verify?.purgePending)}`);
    if (view?.retention !== 'PURGED' || view?.tombstoneIndex !== 2) problems.push(`query: the pending target is ${view?.retention} / ${view?.tombstoneIndex}, as it is for a finished purge`);
    if (exported.status !== 0) problems.push(`export of a purge-pending ledger gave ${exported.status} ${exported.code}`);
    const exportedMembers = exported.status === 0 ? [...snapshot(out)].filter(([name, row]) => row.kind === 'file' && name.includes(hex)).map(([name]) => name) : [];
    const verifiedExport = exported.status === 0 ? run(env, ['history', 'verify-export', '--export', out, '--json']) : null;
    if (verifiedExport !== null && verifiedExport.status !== 0) problems.push(`verify-export of the pending export gave ${verifiedExport.status} ${verifiedExport.code}`);
    // the three views agree with the finished state once the purge completes
    const finish = run(env, args);
    const done = run(env, verifyArgs(ledger)).json?.result;
    if (finish.status !== 0 || (done?.purgePending ?? [1]).length !== 0) problems.push('the rerun did not finish the purge');
    const doneQuery = run(env, queryArgs(ledger)).json?.result?.entries?.find((entry) => entry.index === 1);
    if (doneQuery?.retention !== view?.retention) problems.push('query reports the target differently before and after the purge finished');
    conclude(h, problems, { verify: { purgePending: verify?.purgePending, purgedRecords: verify?.purgedRecords, retainedRecords: verify?.retainedRecords }, queryRetention: view?.retention ?? null, exportStatus: exported.status, exportCarriesPurgedMembers: exportedMembers.length, afterRerun: done?.purgePending ?? null });
  },
};
