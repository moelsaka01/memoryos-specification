// MO-1308 Phase 3A step H: interruption (R16). The product runs as a real CLI process, stopped by the preload at an exact step of its
// protocol and then killed by the harness (the process killer: TerminateProcess), or hit by Ctrl-C / Ctrl-Break through the console launcher,
// or started with no standard handles at all. After every interruption the ledger is read by real processes: nothing is published before
// the commit point, the leftovers are reported and never history, the chain verifies, a rerun of the same command finishes the work, and
// nothing existing is ever overwritten.
import fs from 'node:fs';
import path from 'node:path';
import { CLI, appendArgs, initArgs } from './support.mjs';
import { conclude, recordById, register, run, work } from './env.mjs';
import { ledgerWith } from './cases-cli.mjs';
import { POINT, entryName, hexOf, pausedAppend } from './cases-ntfs.mjs';
import { POINTS } from './cases-swap.mjs';
import { PRELOAD, consoleRun, pathToFileHrefOf, pausedCli, sha256, snapshot, snapshotDiff, writePlan } from './win.mjs';

const p = (...parts) => path.join(...parts);
const verifyArgs = (ledger) => ['history', 'verify', '--ledger', ledger, '--json'];
const queryArgs = (ledger) => ['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '100', '--json'];
const exists = (target) => { try { fs.lstatSync(target); return true; } catch { return false; } };
const bytes = (file) => fs.readFileSync(file);

// Runs `args` to the pause point and kills it there (the process killer). Returns the controller and the closed result.
async function killedAt(env, args, point, name, { mode } = {}) {
  const controller = pausedCli(env, CLI, args, { dir: p(work(env, 'pause'), name), points: [point], mode });
  const reached = await controller.reached('P');
  if (!reached) { controller.kill(); const closed = await controller.closed; throw new Error(`${name}: the pause point was not reached (${closed.stderr.slice(0, 160)})`); }
  controller.kill();
  const closed = await controller.closed;
  return { controller, closed };
}
const state = (env, ledger) => { const out = run(env, verifyArgs(ledger)); return { status: out.status, code: out.code, result: out.json?.result ?? null }; };

export const killCases = {
  '3A-H1': async (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'h1', ['checkpoint-c00']); register(env, ledger, false, { interrupted: true });
    const before = state(env, ledger); const snapBefore = snapshot(ledger);
    const record = recordById(env, 'checkpoint-c01'); const hex = hexOf(record);
    const { closed } = await killedAt(env, appendArgs(ledger, record, p(work(env, 'in'), 'h1')), POINT.memberLink, 'h1');
    const after = state(env, ledger);
    if (closed.code === 0) problems.push('the killed process exited 0');
    if (after.status !== 0 || after.result.entryCount !== 1 || after.result.headDigest !== before.result.headDigest) problems.push(`the ledger changed or no longer verifies: ${after.status} ${after.code}`);
    if (exists(p(ledger, 'records', hex, 'checkpoint.json'))) problems.push('the member was published although the process was killed before its link');
    if (fs.readdirSync(p(ledger, 'entries')).length !== 1) problems.push('an entry was published');
    const staged = fs.readdirSync(p(ledger, '.pending'));
    if (staged.length !== 1 || !staged[0].startsWith('member-')) problems.push(`.pending holds ${JSON.stringify(staged)}`);
    if (after.result?.pendingArtifacts !== 1) problems.push(`verify reports ${after.result?.pendingArtifacts} staging leftovers`);
    const leftover = p(ledger, '.pending', staged[0] ?? 'none'); const leftoverBytes = exists(leftover) ? sha256(bytes(leftover)) : null;
    const rerun = run(env, appendArgs(ledger, record, p(work(env, 'in'), 'h1')));
    if (rerun.status !== 0 || rerun.json?.result?.index !== 1) problems.push(`the rerun gave ${rerun.status} ${rerun.code}`);
    if (leftoverBytes !== null && (!exists(leftover) || sha256(bytes(leftover)) !== leftoverBytes)) problems.push('the leftover staging file was modified or removed by the rerun');
    const final = state(env, ledger);
    if (final.status !== 0 || final.result.entryCount !== 2) problems.push('the ledger does not verify with the appended entry');
    for (const row of snapshotDiff(snapBefore, snapshot(ledger)).filter((entry) => entry.startsWith('removed') || entry.startsWith('changed'))) problems.push(`an existing file changed: ${row}`);
    conclude(h, problems, { killedExit: closed.code, afterKill: { entries: after.result?.entryCount, pendingArtifacts: after.result?.pendingArtifacts, unreferencedRecords: after.result?.unreferencedRecords }, rerun: rerun.status });
  },

  '3A-H2': async (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'h2', ['checkpoint-c00']); register(env, ledger, false, { interrupted: true });
    const before = state(env, ledger);
    const record = recordById(env, 'checkpoint-c01'); const hex = hexOf(record);
    const { closed } = await killedAt(env, appendArgs(ledger, record, p(work(env, 'in'), 'h2')), POINT.entryStage, 'h2');
    const after = state(env, ledger);
    if (closed.code === 0) problems.push('the killed process exited 0');
    if (after.status !== 0 || after.result.entryCount !== 1 || after.result.headDigest !== before.result.headDigest) problems.push(`the ledger changed or no longer verifies: ${after.status} ${after.code}`);
    const member = p(ledger, 'records', hex, 'checkpoint.json');
    if (!exists(member) || sha256(bytes(member)) !== sha256(Buffer.from(record.members[0].bytes))) problems.push('the linked member is missing or differs from the supplied bytes');
    if (fs.readdirSync(p(ledger, 'entries')).length !== 1) problems.push('an entry was published');
    if (JSON.stringify(after.result?.unreferencedRecords) !== JSON.stringify([`sha256:${hex}`]) && !(after.result?.unreferencedRecords ?? []).some((value) => String(value).includes(hex))) problems.push(`verify does not list the unreferenced record: ${JSON.stringify(after.result?.unreferencedRecords)}`);
    if (after.result?.pendingArtifacts !== 0) problems.push(`verify reports ${after.result?.pendingArtifacts} staging leftovers`);
    const rerun = run(env, appendArgs(ledger, record, p(work(env, 'in'), 'h2')));
    if (rerun.status !== 0 || rerun.json?.result?.index !== 1) problems.push(`the rerun gave ${rerun.status} ${rerun.code}`);
    const final = state(env, ledger);
    if (final.status !== 0 || final.result.entryCount !== 2 || (final.result.unreferencedRecords ?? ['x']).length !== 0) problems.push('after the rerun the record must be referenced and the ledger must verify');
    conclude(h, problems, { killedExit: closed.code, afterKill: { entries: after.result?.entryCount, unreferencedRecords: after.result?.unreferencedRecords, pendingArtifacts: after.result?.pendingArtifacts }, rerun: rerun.status });
  },

  '3A-H3': async (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'h3', ['checkpoint-c00']); register(env, ledger, false, { interrupted: true });
    const before = state(env, ledger);
    const record = recordById(env, 'checkpoint-c01');
    const { closed } = await killedAt(env, appendArgs(ledger, record, p(work(env, 'in'), 'h3')), POINT.entryLink, 'h3');
    const after = state(env, ledger);
    if (closed.code === 0) problems.push('the killed process exited 0');
    if (after.status !== 0 || after.result.entryCount !== 1 || after.result.headDigest !== before.result.headDigest) problems.push(`the ledger changed or no longer verifies: ${after.status} ${after.code}`);
    if (exists(p(ledger, 'entries', entryName(1)))) problems.push('the entry was published although the process was killed before its link');
    const staged = fs.readdirSync(p(ledger, '.pending'));
    if (!staged.some((name) => name.startsWith('entry-'))) problems.push('the staged entry is missing from .pending');
    if (after.result?.pendingArtifacts < 1) problems.push('verify does not report the staged entry');
    const rerun = run(env, appendArgs(ledger, record, p(work(env, 'in'), 'h3')));
    if (rerun.status !== 0 || rerun.json?.result?.index !== 1) problems.push(`the rerun gave ${rerun.status} ${rerun.code}`);
    const final = state(env, ledger);
    if (final.status !== 0 || final.result.entryCount !== 2) problems.push('the ledger does not verify with the appended entry');
    conclude(h, problems, { killedExit: closed.code, afterKill: { entries: after.result?.entryCount, pendingArtifacts: after.result?.pendingArtifacts }, rerun: rerun.status });
  },

  '3A-H4': async (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'h4', ['checkpoint-c00']); register(env, ledger, false, { interrupted: true });
    const record = recordById(env, 'checkpoint-c01');
    const { closed } = await killedAt(env, appendArgs(ledger, record, p(work(env, 'in'), 'h4')), POINT.entryUnlink, 'h4');
    const after = state(env, ledger);
    if (closed.code === 0) problems.push('the killed process exited 0');
    // the commit point had passed: the entry is history, and the staging name that was not removed is only an anomaly
    if (after.status !== 0 || after.result.entryCount !== 2) problems.push(`the committed entry is not history: ${after.status} ${after.code} ${after.result?.entryCount}`);
    if (after.result?.pendingArtifacts < 1) problems.push('the unremoved staging name is not reported');
    const stat = fs.statSync(p(ledger, 'entries', entryName(1)), { bigint: true });
    if (stat.nlink !== 2n) problems.push(`the committed entry has ${stat.nlink} names (the entry and its staging name)`);
    const rerun = run(env, appendArgs(ledger, record, p(work(env, 'in'), 'h4')));
    if (rerun.status !== 2 || rerun.code !== 'MO1308_RECORD_DUPLICATE') problems.push(`the rerun of a committed record gave ${rerun.status} ${rerun.code}`);
    const next = run(env, appendArgs(ledger, recordById(env, 'checkpoint-c02'), p(work(env, 'in'), 'h4n')));
    if (next.status !== 0 || next.json?.result?.index !== 2) problems.push(`a later append is blocked by the leftover: ${next.status} ${next.code}`);
    conclude(h, problems, { killedExit: closed.code, afterKill: { entries: after.result?.entryCount, pendingArtifacts: after.result?.pendingArtifacts, entryNames: Number(stat.nlink) }, rerun: `${rerun.status}:${rerun.code}` });
  },

  '3A-H5': async (h, env) => {
    const problems = [];
    const record = recordById(env, 'cicd-4'); const hex = hexOf(record);
    const ledger = ledgerWith(env, 'h5', ['checkpoint-c00', 'cicd-4']); register(env, ledger, false, { interrupted: true });
    const args = ['history', 'tombstone', '--ledger', ledger, '--target', '1', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A-H5', '--json'];
    const { closed } = await killedAt(env, args, POINTS.purgeUnlink, 'h5');
    const after = state(env, ledger);
    if (closed.code === 0) problems.push('the killed process exited 0');
    if (after.status !== 0 || after.result.entryCount !== 3 || after.result.tombstones !== 1) problems.push(`the tombstone is not committed: ${after.status} ${after.code} ${after.result?.entryCount}`);
    if (JSON.stringify(after.result?.purgePending) !== '[1]') problems.push(`purgePending is ${JSON.stringify(after.result?.purgePending)}, not [1]`);
    const members = fs.readdirSync(p(ledger, 'records', hex));
    if (members.length !== record.members.length) problems.push(`${members.length} of ${record.members.length} members remain: the kill came after a deletion`);
    const rerun = run(env, args);
    if (rerun.status !== 0) problems.push(`the rerun gave ${rerun.status} ${rerun.code}`);
    const final = state(env, ledger);
    if (final.status !== 0 || final.result.entryCount !== 3 || (final.result.purgePending ?? [1]).length !== 0 || final.result.purgedRecords !== 1) problems.push('the rerun did not finish the purge without a new entry');
    if (exists(p(ledger, 'records', hex)) && fs.readdirSync(p(ledger, 'records', hex)).length > 0) problems.push('members remain after the finished purge');
    conclude(h, problems, { killedExit: closed.code, afterKill: { entries: after.result?.entryCount, purgePending: after.result?.purgePending, membersRemaining: members.length }, rerun: rerun.status });
  },

  '3A-H6': async (h, env) => {
    const problems = [];
    const record = recordById(env, 'cicd-4'); const hex = hexOf(record);
    const ledger = ledgerWith(env, 'h6', ['checkpoint-c00', 'cicd-4']); register(env, ledger, false, { interrupted: true });
    const args = ['history', 'tombstone', '--ledger', ledger, '--target', '1', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A-H6', '--json'];
    // the third deletion under records/ is about to run: two members are gone, two remain
    const stopAfterTwo = { ...POINTS.purgeUnlink, nth: 3 };
    const { closed } = await killedAt(env, args, stopAfterTwo, 'h6');
    const after = state(env, ledger);
    if (closed.code === 0) problems.push('the killed process exited 0');
    const remaining = fs.existsSync(p(ledger, 'records', hex)) ? fs.readdirSync(p(ledger, 'records', hex)) : [];
    if (remaining.length !== record.members.length - 2) problems.push(`${remaining.length} members remain, ${record.members.length - 2} expected in the middle of the deletion`);
    if (after.status !== 0) problems.push(`a half-purged ledger gives ${after.status} ${after.code}, never an integrity failure`);
    if (JSON.stringify(after.result?.purgePending) !== '[1]') problems.push(`purgePending is ${JSON.stringify(after.result?.purgePending)}`);
    for (const [name, command] of [['query', queryArgs(ledger)], ['export', ['history', 'export', '--ledger', ledger, '--output', p(work(env, 'h6x'), 'half'), '--json']]]) {
      const read = run(env, command);
      if (read.status !== 0) problems.push(`${name} of a half-purged ledger gives ${read.status} ${read.code}`);
    }
    const rerun = run(env, args);
    if (rerun.status !== 0) problems.push(`the rerun gave ${rerun.status} ${rerun.code}`);
    const final = state(env, ledger);
    if (final.status !== 0 || final.result.entryCount !== 3 || (final.result.purgePending ?? [1]).length !== 0) problems.push('the rerun did not finish the purge without a new entry');
    conclude(h, problems, { killedExit: closed.code, afterKill: { purgePending: after.result?.purgePending, membersRemaining: remaining.length }, rerun: rerun.status });
  },

  '3A-H7': async (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'h7', ['checkpoint-c00', 'policy-0']);
    const before = snapshot(ledger);
    const output = p(work(env, 'h7x'), 'export');
    const { closed } = await killedAt(env, ['history', 'export', '--ledger', ledger, '--output', output, '--json'], POINTS.exportMarker, 'h7');
    if (closed.code === 0) problems.push('the killed process exited 0');
    const names = fs.existsSync(output) ? fs.readdirSync(output) : [];
    if (names.includes('memoryos-history-export-complete.json')) problems.push('the completion marker exists');
    const verified = run(env, ['history', 'verify-export', '--export', output, '--json']);
    if (verified.status !== 3 || verified.code !== 'MO1308_EXPORT_CORRUPT') problems.push(`verify-export of an unfinished export gave ${verified.status} ${verified.code}, wanted EXPORT_CORRUPT`);
    for (const row of snapshotDiff(before, snapshot(ledger), { identities: true })) problems.push(`the export changed the ledger: ${row}`);
    const again = run(env, ['history', 'export', '--ledger', ledger, '--output', output, '--json']);
    if (again.status !== 4 || again.code !== 'MO1308_LEDGER_EXISTS') problems.push(`an export over the unfinished one gave ${again.status} ${again.code}`);
    const fresh = run(env, ['history', 'export', '--ledger', ledger, '--output', p(work(env, 'h7x'), 'fresh'), '--json']);
    if (fresh.status !== 0 || run(env, ['history', 'verify-export', '--export', p(work(env, 'h7x'), 'fresh'), '--json']).status !== 0) problems.push('a fresh export does not complete and verify');
    conclude(h, problems, { killedExit: closed.code, filesWritten: names.length, verifyExport: `${verified.status}:${verified.code}`, overExisting: `${again.status}:${again.code}` });
  },

  '3A-H8': async (h, env) => {
    const problems = [];
    const ledger = p(work(env, 'h8'), 'ledger');
    const { closed } = await killedAt(env, initArgs(ledger, 'h8'), POINTS.descriptorLink, 'h8');
    if (closed.code === 0) problems.push('the killed process exited 0');
    if (exists(p(ledger, 'memoryos-history-ledger.json'))) problems.push('a descriptor was published although init was killed before its link');
    const names = fs.existsSync(ledger) ? fs.readdirSync(ledger).sort() : [];
    if (JSON.stringify(names) !== JSON.stringify(['.pending', 'entries', 'records'])) problems.push(`the half-made directory holds ${JSON.stringify(names)}`);
    register(env, ledger, true);
    for (const [name, args, wanted] of [['verify', verifyArgs(ledger), 'MO1308_LEDGER_NOT_FOUND'], ['append', appendArgs(ledger, recordById(env, 'checkpoint-c00'), p(work(env, 'in'), 'h8')), 'MO1308_LEDGER_NOT_FOUND'], ['init again', initArgs(ledger, 'h8'), 'MO1308_LEDGER_EXISTS']]) {
      const result = run(env, args);
      if (result.status !== 4 || result.code !== wanted) problems.push(`${name} on the half-made directory gave ${result.status} ${result.code}, wanted ${wanted}`);
    }
    const fresh = p(work(env, 'h8'), 'fresh');
    if (run(env, initArgs(fresh, 'h8')).status !== 0 || run(env, verifyArgs(fresh)).status !== 0) problems.push('a fresh init does not work');
    conclude(h, problems, { killedExit: closed.code, halfMade: names });
  },

  '3A-H9': async (h, env) => {
    // Ctrl-C and Ctrl-Break, delivered through a console to a product stopped before its commit point: nothing is published
    const problems = []; const results = {};
    const cases = [
      ['append', 'C', POINT.entryStage], ['append', 'BREAK', POINT.entryStage], ['init', 'C', POINTS.descriptorLink], ['init', 'BREAK', POINTS.descriptorLink],
      ['export', 'C', POINTS.exportMarker], ['export', 'BREAK', POINTS.exportMarker],
    ];
    for (const [operation, event, point] of cases) {
      const name = `h9-${operation}-${event}`.toLowerCase();
      const dir = p(work(env, 'pause'), name);
      let args; let ledger; let output;
      if (operation === 'append') { ledger = ledgerWith(env, name, ['checkpoint-c00']); register(env, ledger, false, { interrupted: true }); args = appendArgs(ledger, recordById(env, 'checkpoint-c01'), p(work(env, 'in'), name)); }
      else if (operation === 'init') { ledger = p(work(env, name), 'ledger'); args = initArgs(ledger, name); }
      else { ledger = ledgerWith(env, name, ['checkpoint-c00']); output = p(work(env, `${name}x`), 'export'); args = ['history', 'export', '--ledger', ledger, '--output', output, '--json']; }
      const before = operation === 'init' ? null : snapshot(ledger);
      const plan = writePlan(dir, { points: [point] });
      const report = await consoleRun(env, {
        mode: 'signal', exe: process.execPath, args: ['--import', pathToFileHrefOf(PRELOAD), CLI, ...args], cwd: env.workRoot, event,
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, P3A_PLAN: plan }, waitFile: p(dir, 'P.reached'), waitTimeoutMs: 60000, timeoutMs: 90000,
      }, { dir });
      results[`${operation} ${event}`] = report.launcherFailed ? `launcher failed: ${report.stderr}` : `exit ${report.exitCode}, event ${report.eventSent}`;
      if (report.launcherFailed) { problems.push(`${operation} ${event}: ${report.stderr}`); continue; }
      if (report.eventSent !== event) problems.push(`${operation} ${event}: the event was not delivered`);
      if (report.timedOut) problems.push(`${operation} ${event}: the process did not end`);
      if (report.exitCode === 0) problems.push(`${operation} ${event}: the interrupted process exited 0`);
      if (operation === 'append') {
        const after = state(env, ledger);
        if (after.status !== 0 || after.result.entryCount !== 1) problems.push(`append ${event}: the ledger changed or fails: ${after.status} ${after.code}`);
        for (const row of snapshotDiff(before, snapshot(ledger)).filter((entry) => entry.startsWith('removed') || entry.startsWith('changed'))) problems.push(`append ${event}: an existing file changed: ${row}`);
        if (fs.readdirSync(p(ledger, 'entries')).length !== 1) problems.push(`append ${event}: an entry was published`);
      } else if (operation === 'init') {
        if (exists(p(ledger, 'memoryos-history-ledger.json'))) problems.push(`init ${event}: a descriptor was published`);
        register(env, ledger, true);
      } else {
        if (exists(p(output, 'memoryos-history-export-complete.json'))) problems.push(`export ${event}: a completion marker exists`);
        const verified = run(env, ['history', 'verify-export', '--export', output, '--json']);
        if (verified.code !== 'MO1308_EXPORT_CORRUPT') problems.push(`export ${event}: verify-export gave ${verified.status} ${verified.code}`);
        for (const row of snapshotDiff(before, snapshot(ledger), { identities: true })) problems.push(`export ${event}: the ledger changed: ${row}`);
      }
    }
    conclude(h, problems, { results });
  },

  '3A-H10': async (h, env) => {
    // no standard handles at all (DETACHED_PROCESS, nothing inherited): the command ends on its own, typed, and the ledger state is consistent
    const problems = []; const results = {};
    const closedRun = (args, name) => consoleRun(env, { mode: 'closed', exe: process.execPath, args: [CLI, ...args], cwd: env.workRoot, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot }, timeoutMs: 90000 }, { dir: p(work(env, 'pause'), name) });
    const ledger = ledgerWith(env, 'h10', ['checkpoint-c00', 'policy-0']);
    const base = state(env, ledger);
    const sane = (name, report) => {
      results[name] = report.launcherFailed ? 'launcher failed' : `exit ${report.exitCode}${report.timedOut ? ' (timed out)' : ''}`;
      if (report.launcherFailed) { problems.push(`${name}: ${report.stderr}`); return false; }
      if (report.timedOut) problems.push(`${name}: the command did not end`);
      if (report.exitCode < 0 || report.exitCode > 5) problems.push(`${name}: exit ${report.exitCode} is not a typed category (a crash)`);
      return true;
    };
    for (const [name, args] of [['verify', verifyArgs(ledger)], ['query', queryArgs(ledger)]]) {
      if (sane(name, await closedRun(args, `h10-${name}`))) { const after = state(env, ledger); if (after.status !== 0 || after.result.headDigest !== base.result.headDigest) problems.push(`${name}: the ledger changed`); }
    }
    // append: exit 0 means the entry exists, anything else means it does not; either way the ledger verifies
    const appendReport = await closedRun(appendArgs(ledger, recordById(env, 'checkpoint-c01'), p(work(env, 'in'), 'h10')), 'h10-append');
    if (sane('append', appendReport)) {
      const after = state(env, ledger);
      if (after.status !== 0) problems.push(`append: the ledger does not verify afterwards: ${after.code}`);
      else if ((appendReport.exitCode === 0) !== (after.result.entryCount === 3)) problems.push(`append: exit ${appendReport.exitCode} but ${after.result.entryCount} entries (a partial publication or a lost success)`);
    }
    const exportOut = p(work(env, 'h10x'), 'export');
    const exportReport = await closedRun(['history', 'export', '--ledger', ledger, '--output', exportOut, '--json'], 'h10-export');
    if (sane('export', exportReport)) {
      const complete = exists(p(exportOut, 'memoryos-history-export-complete.json'));
      if ((exportReport.exitCode === 0) !== complete) problems.push(`export: exit ${exportReport.exitCode} but the marker ${complete ? 'exists' : 'is missing'}`);
      if (complete && run(env, ['history', 'verify-export', '--export', exportOut, '--json']).status !== 0) problems.push('the export made with closed stdio does not verify');
    }
    const initPath = p(work(env, 'h10i'), 'ledger');
    const initReport = await closedRun(initArgs(initPath, 'h10'), 'h10-init');
    if (sane('init', initReport)) {
      const made = exists(p(initPath, 'memoryos-history-ledger.json'));
      if ((initReport.exitCode === 0) !== made) problems.push(`init: exit ${initReport.exitCode} but the descriptor ${made ? 'exists' : 'is missing'}`);
      if (made) { register(env, initPath); if (run(env, verifyArgs(initPath)).status !== 0) problems.push('the ledger made with closed stdio does not verify'); }
    }
    const tomb = await closedRun(['history', 'tombstone', '--ledger', ledger, '--target', '0', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A-H10', '--json'], 'h10-tombstone');
    if (sane('tombstone', tomb)) {
      const after = state(env, ledger);
      if (after.status !== 0 || (tomb.exitCode === 0 && (after.result.tombstones !== 1 || after.result.purgePending.length !== 0))) problems.push('tombstone with closed stdio left an inconsistent state');
    }
    conclude(h, problems, { results });
  },
};
void bytes;
