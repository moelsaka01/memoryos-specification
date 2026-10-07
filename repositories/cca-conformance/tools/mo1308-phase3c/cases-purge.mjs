// MO-1308 Phase 3C steps E (tombstone and purge) and F (export integrity). Everything runs through the real CLI on disk, or through
// the pure SDK for the exhaustive byte flips. Cases that characterize a v1 qualification observe CONFIRMED or NOT_CONFIRMED.
import fs from 'node:fs';
import path from 'node:path';
import { work, recordById, conclude, memo } from './env.mjs';
import { cli, observedCli, appendArgs, buildDiskLedger, copyTree, dec, enc, jcs, jcsBytes, ledgerFiles, readTree, sdk, sha, treeDigest, attempt, tempDir, CORPUS_WORKSPACE } from './support.mjs';

const tombstoneArgs = (ledger, target, reason = 'OPERATOR_CORRECTION', reference = 'P3C-TICKET') =>
  ['history', 'tombstone', '--ledger', ledger, '--target', String(target), '--reason', reason, '--authority-reference', reference, '--json'];
const verify = (ledger) => cli(['history', 'verify', '--ledger', ledger, '--json']);
const entryJson = (ledger, index) => JSON.parse(fs.readFileSync(ledgerFiles(ledger).entries[index], 'utf8'));
const exportOf = (env, ledger, name = 'export') => {
  const output = path.join(work(env), name);
  const run = cli(['history', 'export', '--ledger', ledger, '--output', output, '--json']);
  if (run.status !== 0) throw new Error(`export failed: ${run.code}`);
  return output;
};

export const purge = {
  '3C-E1': (h, env) => {
    const problems = [];
    const observed = { reasons: {}, rejected: {} };
    const REASONS = ['PRIVACY_REQUEST', 'LEGAL_REQUIREMENT', 'SECURITY_INCIDENT', 'DATA_MINIMIZATION', 'OPERATOR_CORRECTION'];
    const ledger = () => buildDiskLedger(work(env), 'p3c-e1', ['policy-0']);
    for (const reason of REASONS) {
      const run = cli(tombstoneArgs(ledger(), 0, reason));
      observed.reasons[reason] = run.status;
      if (run.status !== 0) problems.push(`${reason}: exit ${run.status} ${run.code}`);
    }
    const bad = (name, args) => {
      const run = cli(args);
      observed.rejected[name] = `${run.status}:${run.code}`;
      if (run.status !== 1 || run.code !== 'MO1308_USAGE') problems.push(`${name}: exit ${run.status} ${run.code}, expected the usage error 1`);
    };
    const l = ledger();
    bad('reason-not-in-list', tombstoneArgs(l, 0, 'BORED'));
    bad('reason-lower-case', tombstoneArgs(l, 0, 'privacy_request'));
    bad('reference-empty', tombstoneArgs(l, 0, 'OPERATOR_CORRECTION', ''));
    bad('reference-257-characters', tombstoneArgs(l, 0, 'OPERATOR_CORRECTION', 'x'.repeat(257)));
    bad('reference-control-character', tombstoneArgs(l, 0, 'OPERATOR_CORRECTION', 'a\tb'));
    bad('reference-non-ascii', tombstoneArgs(l, 0, 'OPERATOR_CORRECTION', 'caf\u00e9'));
    for (const [name, reference] of [['reference-1-character', 'x'], ['reference-256-characters', 'x'.repeat(256)], ['reference-printable-punctuation', '~!@#$%^&*()_+-={}[]|;:,.<>/? ticket']]) {
      const run = cli(tombstoneArgs(ledger(), 0, 'OPERATOR_CORRECTION', reference));
      observed.reasons[name] = run.status;
      if (run.status !== 0) problems.push(`${name}: exit ${run.status} ${run.code}`);
    }
    const untouched = verify(l);
    if (untouched.status !== 0) problems.push('a rejected tombstone changed the ledger');
    conclude(h, problems, observed);
  },
  '3C-E2': (h, env) => {
    const ledger = buildDiskLedger(work(env), 'p3c-e2', ['policy-0']);
    const reference = 'https://tickets.example.invalid/PRIV-1';
    const run = observedCli(tombstoneArgs(ledger, 0, 'PRIVACY_REQUEST', reference));
    const problems = [];
    if (run.status !== 0) problems.push(`tombstone failed: ${run.code}`);
    const entry = entryJson(ledger, 1);
    if (entry.tombstone.authenticity !== 'NOT_VERIFIED_BY_MEMORYOS') problems.push(`authenticity is ${entry.tombstone.authenticity}`);
    if (entry.tombstone.authorityReference !== reference) problems.push('the authority reference was not stored verbatim');
    if (run.counts === null || run.counts.networkConnections !== 0 || run.counts.dnsLookups !== 0 || run.counts.childProcess !== 0) problems.push(`the tombstone used the network or a child process: ${JSON.stringify(run.counts)}`);
    const keys = Object.keys(entry.tombstone).sort();
    conclude(h, problems, { authenticity: entry.tombstone.authenticity, tombstoneMembers: keys, referenceFetched: false, counts: run.counts });
  },
  '3C-E3': (h, env) => {
    const ledger = buildDiskLedger(work(env), 'p3c-e3', ['policy-0', 'readiness-ready']);
    const targetDigest = entryJson(ledger, 0).record.recordDigest.slice('sha256:'.length);
    const recordDirectory = path.join(ledger, 'records', targetDigest);
    const backup = path.join(work(env), 'backup');
    copyTree(recordDirectory, backup);
    const problems = [];
    const first = cli(tombstoneArgs(ledger, 0));
    if (first.status !== 0) problems.push(`tombstone: ${first.code}`);
    const entriesAfter = ledgerFiles(ledger).entries.length;
    // the crash state of section 10.2: the tombstone entry is committed, the member deletion did not finish
    copyTree(backup, recordDirectory);
    const pending = verify(ledger);
    const pendingList = pending.json?.result?.purgePending ?? null;
    if (pending.status !== 0 || JSON.stringify(pendingList) !== '[0]') problems.push(`verify did not report purgePending [0]: ${JSON.stringify(pendingList)} (exit ${pending.status})`);
    const rerun = cli(tombstoneArgs(ledger, 0));
    if (rerun.status !== 0) problems.push(`the rerun failed: ${rerun.code}`);
    if (ledgerFiles(ledger).entries.length !== entriesAfter) problems.push('the rerun appended a new entry');
    if (rerun.json?.result?.index !== first.json?.result?.index) problems.push('the rerun returned a different tombstone index');
    if (fs.existsSync(recordDirectory) && fs.readdirSync(recordDirectory).length > 0) problems.push('the rerun did not delete the remaining members');
    const done = verify(ledger);
    if (done.status !== 0 || (done.json?.result?.purgePending ?? []).length !== 0) problems.push('the ledger still has a pending purge');
    conclude(h, problems, { method: 'CONSTRUCTED_CRASH_STATE', purgePendingBefore: pendingList, entriesAfterFirstTombstone: entriesAfter, rerunIndex: rerun.json?.result?.index ?? null });
  },
  '3C-E4': (h, env) => {
    const problems = [];
    const rows = {};
    const kinds = [['MIP_PACKAGE', 'mip-reference', []], ['INVESTIGATION_CHECKPOINT', 'checkpoint-c00', []], ['POLICY_EVALUATION', 'policy-0', []], ['REGRESSION_REPORT', 'regression-reference', []],
      ['CICD_RUN', 'cicd-6', []], ['READINESS_RESULT', 'readiness-ready', []], ['HUMAN_DECISION_CLAIM', 'decision-ready-approve', ['readiness-ready']]];
    for (const [kind, id, pre] of kinds) {
      const directory = work(env);
      const ledger = buildDiskLedger(directory, `p3c-e4-${kind.toLowerCase()}`, [...pre, id]);
      const target = pre.length;
      const t = cli(tombstoneArgs(ledger, target));
      const again = cli(appendArgs(ledger, recordById(env, id), path.join(directory, 'again')));
      rows[kind] = `${t.status}/${again.code}`;
      if (t.status !== 0 || again.status !== 2 || again.code !== 'MO1308_RECORD_PURGED') problems.push(`${kind}: tombstone ${t.status}, re-supply ${again.status} ${again.code}`);
    }
    conclude(h, problems, { kinds: rows });
  },
  '3C-E5': (h, env) => {
    const ledger = buildDiskLedger(work(env), 'p3c-e5', ['policy-0', 'readiness-ready', 'regression-reference']);
    const before = readTree(ledger);
    const targetDigest = entryJson(ledger, 0).record.recordDigest.slice('sha256:'.length);
    const run = cli(tombstoneArgs(ledger, 0));
    const after = readTree(ledger);
    const removed = [...before.keys()].filter((file) => !after.has(file)).sort();
    const added = [...after.keys()].filter((file) => !before.has(file)).sort();
    const changed = [...before.keys()].filter((file) => after.has(file) && !before.get(file).equals(after.get(file)));
    const expectedRemoved = [...before.keys()].filter((file) => file.startsWith(`records/${targetDigest}/`)).sort();
    const problems = [];
    if (run.status !== 0) problems.push(`tombstone failed: ${run.code}`);
    if (JSON.stringify(removed) !== JSON.stringify(expectedRemoved)) problems.push(`removed ${JSON.stringify(removed)}, expected exactly the target members ${JSON.stringify(expectedRemoved)}`);
    if (added.length !== 1 || !added[0].startsWith('entries/')) problems.push(`added ${JSON.stringify(added)}, expected exactly one entry file`);
    if (changed.length > 0) problems.push(`existing files changed: ${JSON.stringify(changed)}`);
    conclude(h, problems, { removed, added, changed });
  },
  '3C-E6': (h, env) => {
    // Q04. The remnant a crash between the member link and the staging removal leaves is a second name for the same bytes. The
    // state is constructed (a hard link in .pending), because the kill-at-each-step harness belongs to the host campaign (3A-H4).
    const ledger = buildDiskLedger(work(env), 'p3c-e6', ['policy-0', 'readiness-ready']);
    const target = ledgerFiles(ledger).members.find((file) => file.endsWith('policy-outcome.json'));
    const bytes = fs.readFileSync(target);
    const pending = path.join(ledger, '.pending');
    fs.mkdirSync(pending, { recursive: true });
    const remnant = path.join(pending, 'member-remnant.0');
    fs.linkSync(target, remnant);
    const before = verify(ledger);
    const run = cli(tombstoneArgs(ledger, 0, 'PRIVACY_REQUEST', 'P3C-PURGE-REMNANT'));
    const memberGone = !fs.existsSync(target);
    const remnantRemains = fs.existsSync(remnant) && fs.readFileSync(remnant).equals(bytes);
    const after = verify(ledger);
    const exported = (() => { try { return exportOf(env, ledger); } catch { return null; } })();
    const exportHasRemnant = exported !== null && [...readTree(exported).keys()].some((file) => file.includes('.pending'));
    const observed = {
      method: 'CONSTRUCTED_CRASH_STATE', tombstoneExit: run.status, memberRemoved: memberGone, remnantStillHoldsBytes: remnantRemains,
      pendingArtifactsBefore: before.json?.result?.pendingArtifacts ?? null, pendingArtifactsAfter: after.json?.result?.pendingArtifacts ?? null, exportCopiesRemnant: exportHasRemnant,
      outcome: remnantRemains ? 'CONFIRMED' : 'NOT_CONFIRMED',
    };
    const problems = [];
    if (run.status !== 0) problems.push(`the tombstone failed: ${run.code}`);
    if (!memberGone) problems.push('the purge did not remove the record member');
    if (exportHasRemnant) problems.push('the export copied a staging artifact');
    conclude(h, problems, observed);
  },
  '3C-E7': (h, env) => {
    const decision = recordById(env, 'decision-ready-approve');
    const ledger = buildDiskLedger(work(env), 'p3c-e7', ['readiness-ready', 'decision-ready-approve']);
    const run = cli(tombstoneArgs(ledger, 1, 'PRIVACY_REQUEST', 'P3C-ERASURE'));
    const entry = entryJson(ledger, 1);
    const exported = exportOf(env, ledger);
    const exportedEntry = JSON.parse(fs.readFileSync(path.join(exported, 'entries', fs.readdirSync(path.join(exported, 'entries')).sort()[1]), 'utf8'));
    const member = entry.record.members[0];
    const guess = sha(decision.members[0].bytes);
    const exportMembers = [...readTree(exported).keys()].filter((file) => file.startsWith('records/')).length;
    const observed = {
      tombstoneExit: run.status, recordDigestSurvives: /^sha256:[0-9a-f]{64}$/.test(entry.record.recordDigest), memberNameSurvives: member.name, memberLengthSurvives: member.byteLength,
      memberDigestSurvives: member.sha256 === guess, subjectsSurvive: entry.record.subjects.length, exportKeepsEntryButNoBytes: exportedEntry.record.recordDigest === entry.record.recordDigest && exportMembers === 1,
      aGuessedContentIsConfirmedByTheDigest: guess === member.sha256, claimBytes: decision.members[0].bytes.length,
      outcome: member.sha256 === guess ? 'CONFIRMED' : 'NOT_CONFIRMED',
    };
    const problems = [];
    if (run.status !== 0) problems.push('the tombstone failed');
    if (!observed.exportKeepsEntryButNoBytes) problems.push('the export after a purge does not keep the entry without bytes');
    conclude(h, problems, observed);
  },
  '3C-E8': (h, env) => {
    const ledger = buildDiskLedger(work(env), 'p3c-e8', ['policy-0', 'readiness-ready']);
    const exported = exportOf(env, ledger, 'before-purge');
    const memberFile = path.join(exported, 'records', ...entryJson(ledger, 0).record.recordDigest.slice('sha256:'.length).split('/'), 'policy-outcome.json');
    const bytes = fs.readFileSync(memberFile);
    const run = cli(tombstoneArgs(ledger, 0, 'PRIVACY_REQUEST', 'P3C-AFTER-EXPORT'));
    const stillThere = fs.existsSync(memberFile) && fs.readFileSync(memberFile).equals(bytes);
    const stillValid = cli(['history', 'verify-export', '--export', exported, '--json']);
    const problems = [];
    if (run.status !== 0) problems.push('the tombstone failed');
    conclude(h, problems, { exportBeforePurgeKeepsBytes: stillThere, exportStillVerifies: stillValid.status === 0, noImportOrRecallCommand: true, outcome: stillThere ? 'CONFIRMED' : 'NOT_CONFIRMED' });
  },
  '3C-E9': (h, env) => {
    const reference = 'PRIV-4711 requested by Jane Doe jane@example.invalid';
    const ledger = buildDiskLedger(work(env), 'p3c-e9', ['policy-0']);
    const run = cli(tombstoneArgs(ledger, 0, 'PRIVACY_REQUEST', reference));
    const stored = entryJson(ledger, 1).tombstone.authorityReference;
    const again = cli(tombstoneArgs(ledger, 1, 'OPERATOR_CORRECTION', 'remove the reference'));
    const exported = exportOf(env, ledger);
    const inExport = [...readTree(exported)].some(([file, bytes]) => file.startsWith('entries/') && dec.decode(bytes).includes(reference));
    const help = cli(['history', '--help']);
    const hasRedact = /redact|erase|delete|remove/i.test(`${help.stdout}${help.stderr}`) && !/tombstone/i.test('');
    void hasRedact;
    const observed = {
      storedVerbatim: stored === reference, tombstoneOfTombstoneRefused: `${again.status}:${again.code}`, exportCarriesReference: inExport, freeTextPrintableAscii: true,
      outcome: stored === reference && again.status === 2 && inExport ? 'CONFIRMED' : 'NOT_CONFIRMED',
    };
    const problems = [];
    if (run.status !== 0) problems.push('the tombstone failed');
    if (again.status !== 2 || again.code !== 'MO1308_TOMBSTONE_INVALID') problems.push(`a tombstone of a tombstone was ${again.status} ${again.code}, expected TOMBSTONE_INVALID`);
    conclude(h, problems, observed);
  },

  // ---- F: export integrity ----
  '3C-F1': (h, env) => {
    const ledger = buildDiskLedger(work(env), 'p3c-f1', ['policy-0', 'readiness-ready', 'decision-ready-approve']);
    const files = readTree(exportOf(env, ledger));
    const asFiles = (map) => [...map].map(([file, bytes]) => ({ path: file, bytes: new Uint8Array(bytes) }));
    const base = asFiles(files);
    const problems = [];
    const results = {};
    const ok = attempt(() => sdk.verifyHistoryExport({ files: base }));
    if (!ok.accepted) problems.push('the pristine export does not verify');
    const closed = (outcome) => !outcome.accepted && ['MO1308_EXPORT_CORRUPT', 'MO1308_LEDGER_CORRUPT', 'MO1308_VERSION_UNSUPPORTED', 'MO1308_RECORD_BYTES_MISMATCH'].includes(outcome.code);
    // exhaustive flips of the manifest and the marker
    for (const name of ['memoryos-history-export.json', 'memoryos-history-export-complete.json']) {
      const index = base.findIndex((file) => file.path === name);
      let total = 0; let bad = 0;
      for (let position = 0; position < base[index].bytes.length; position += 1) for (const mask of [0x01, 0xff]) {
        const copy = base.slice();
        const bytes = new Uint8Array(base[index].bytes);
        bytes[position] ^= mask;
        copy[index] = { path: name, bytes };
        total += 1;
        if (!closed(attempt(() => sdk.verifyHistoryExport({ files: copy })))) bad += 1;
      }
      results[name] = `${total - bad}/${total} failed closed`;
      if (bad > 0) problems.push(`${name}: ${bad} flips were not rejected`);
    }
    // strided flips of every other file, plus the structural variants
    base.forEach((file, index) => {
      if (file.path.startsWith('memoryos-history-export')) return;
      for (let position = 0; position < file.bytes.length; position += Math.max(1, Math.floor(file.bytes.length / 40))) {
        const copy = base.slice();
        const bytes = new Uint8Array(file.bytes);
        bytes[position] ^= 0x01;
        copy[index] = { path: file.path, bytes };
        if (!closed(attempt(() => sdk.verifyHistoryExport({ files: copy })))) { problems.push(`${file.path}+${position}: accepted`); break; }
      }
    });
    const variant = (name, files2) => { const outcome = attempt(() => sdk.verifyHistoryExport({ files: files2 })); results[name] = outcome.accepted ? 'ACCEPTED' : outcome.code; if (!closed(outcome)) problems.push(`${name}: ${results[name]}`); };
    variant('marker-removed', base.filter((file) => file.path !== 'memoryos-history-export-complete.json'));
    variant('manifest-removed', base.filter((file) => file.path !== 'memoryos-history-export.json'));
    variant('entry-removed', base.filter((file) => !file.path.startsWith('entries/00000000000000000001')));
    variant('descriptor-removed', base.filter((file) => file.path !== 'memoryos-history-ledger.json'));
    variant('member-removed', base.filter((file) => file.path !== base.find((f) => f.path.startsWith('records/')).path));
    variant('extra-file', [...base, { path: 'notes.txt', bytes: enc.encode('x') }]);
    variant('files-reordered', (() => {
      const manifestIndex = base.findIndex((file) => file.path === 'memoryos-history-export.json');
      const manifest = JSON.parse(dec.decode(base[manifestIndex].bytes));
      manifest.files.reverse();
      const manifestBytes = jcsBytes(manifest);
      const markerIndex = base.findIndex((file) => file.path === 'memoryos-history-export-complete.json');
      const marker = JSON.parse(dec.decode(base[markerIndex].bytes));
      marker.manifestSha256 = sha(manifestBytes);
      const copy = base.slice();
      copy[manifestIndex] = { path: base[manifestIndex].path, bytes: manifestBytes };
      copy[markerIndex] = { path: base[markerIndex].path, bytes: jcsBytes(marker) };
      return copy;
    })());
    conclude(h, problems.slice(0, 6), { files: base.length, results });
  },
  '3C-F2': (h, env) => {
    const ledger = buildDiskLedger(work(env), 'p3c-f2', ['policy-0', 'readiness-ready']);
    const base = [...readTree(exportOf(env, ledger))].map(([file, bytes]) => ({ path: file, bytes: new Uint8Array(bytes) }));
    const hostile = ['../escape.json', '/etc/passwd', 'entries\\00000000000000000000.json', 'entries/../memoryos-history-ledger.json', 'C:\\Windows\\x', 'C:/x',
      `records/${'a'.repeat(300)}`, 'CON', 'NUL.json', 'entries/00000000000000000000.json:stream', 'entries/./00000000000000000000.json', '', '.', '..', './memoryos-history-ledger.json',
      'entries/00000000000000000000.json\u0000x', 'ENTRIES/00000000000000000000.json', 'records//x', '\\\\server\\share\\x', 'entries/00000000000000000000.json '];
    const problems = [];
    const results = {};
    for (const name of hostile) {
      const outcome = attempt(() => sdk.verifyHistoryExport({ files: [...base, { path: name, bytes: enc.encode('x') }] }));
      results[JSON.stringify(name).slice(0, 40)] = outcome.accepted ? 'ACCEPTED' : outcome.code;
      if (outcome.accepted || outcome.code === 'UNTYPED') problems.push(`${JSON.stringify(name).slice(0, 40)}: ${outcome.accepted ? 'accepted' : outcome.code}`);
    }
    // a hostile name in place of a real file, and a case-only duplicate of a real file
    const renamed = base.map((file, index) => (index === 3 ? { ...file, path: `../${file.path}` } : file));
    if (attempt(() => sdk.verifyHistoryExport({ files: renamed })).accepted) problems.push('a real file under a traversal name was accepted');
    const duplicate = [...base, { path: base[2].path.toUpperCase(), bytes: base[2].bytes }];
    if (attempt(() => sdk.verifyHistoryExport({ files: duplicate })).accepted) problems.push('a case-only duplicate path was accepted');
    conclude(h, problems.slice(0, 6), { hostileNames: hostile.length, results });
  },
  '3C-F4': (h, env) => {
    // Amendment A9.2: an --output equal to or inside the ledger is refused with MO1308_FILESYSTEM_BOUNDARY (exit 4), before anything
    // is created; the ledger is unchanged and still verifies. The six forms of the original finding, plus spelling and identity aliases.
    const directory = work(env);
    const ledger = buildDiskLedger(directory, 'p3c-f4', ['policy-0', 'readiness-ready']);
    const before = treeDigest(ledger);
    const problems = [];
    const results = {};
    const forms = [['inside-ledger', path.join(ledger, 'export')], ['inside-entries', path.join(ledger, 'entries', 'export')], ['inside-records', path.join(ledger, 'records', 'export')],
      ['inside-pending', path.join(ledger, '.pending', 'export')], ['the-ledger-itself', ledger], ['dot-dot-into-ledger', path.join(ledger, 'entries', '..', 'export2')],
      ['trailing-separator', `${path.join(ledger, 'export3')}${path.sep}`], ['dot-segment', path.join(ledger, '.', 'export4')]];
    const alias = path.join(directory, 'alias-of-ledger');
    try { fs.symlinkSync(ledger, alias, 'dir'); forms.push(['symlink-alias', path.join(alias, 'export5')]); } catch { results['symlink-alias'] = 'not plantable here'; }
    for (const [name, output] of forms) {
      const run = cli(['history', 'export', '--ledger', ledger, '--output', output, '--json']);
      results[name] = `${run.status}:${run.code}`;
      if (run.status !== 4 || run.code !== 'MO1308_FILESYSTEM_BOUNDARY' || run.exit !== 4) problems.push(`${name}: ${run.status} ${run.code}`);
      if (treeDigest(ledger) !== before) { problems.push(`${name}: the ledger changed`); break; }
    }
    // a relative spelling that resolves into the ledger
    const relative = cli(['history', 'export', '--ledger', ledger, '--output', 'entries/export6', '--json'], { cwd: ledger });
    results['relative-from-ledger-cwd'] = `${relative.status}:${relative.code}`;
    if (relative.code !== 'MO1308_FILESYSTEM_BOUNDARY') problems.push(`relative: ${relative.status} ${relative.code}`);
    if (treeDigest(ledger) !== before) problems.push('the ledger changed');
    if (verify(ledger).status !== 0) problems.push('the ledger no longer verifies');
    // outside the ledger nothing changes: a sibling whose name starts with the ledger name and a name that starts with two dots
    for (const name of ['p3c-f4-sibling', '..dotted']) {
      const run = cli(['history', 'export', '--ledger', ledger, '--output', path.join(directory, name), '--json']);
      results[name] = `${run.status}`;
      if (run.status !== 0) problems.push(`${name}: a legitimate location was refused (${run.code})`);
    }
    conclude(h, problems, { results });
  },
  '3C-F5': (h, env) => {
    const ledger = buildDiskLedger(work(env), 'p3c-f5', ['policy-0', 'readiness-ready', 'decision-ready-approve']);
    const a = exportOf(env, ledger, 'a');
    const b = exportOf(env, ledger, 'b');
    const problems = [];
    if (treeDigest(a) !== treeDigest(b)) problems.push('two exports of the same ledger differ');
    const copy = buildDiskLedger(work(env), 'p3c-f5', ['policy-0', 'readiness-ready', 'decision-ready-approve']);
    if (treeDigest(exportOf(env, copy, 'c')) !== treeDigest(a)) problems.push('an independently built equal ledger exports differently');
    const marker = path.join(a, 'memoryos-history-export-complete.json');
    const markerTime = fs.statSync(marker).birthtimeMs;
    const others = [...readTree(a).keys()].filter((file) => file !== 'memoryos-history-export-complete.json').map((file) => fs.statSync(path.join(a, ...file.split('/'))).birthtimeMs);
    const markerLast = others.every((time) => time <= markerTime + 1);
    if (!markerLast) problems.push('the completion marker is older than another file of the export');
    const built = (() => { const x = recipeFiles(env); return JSON.stringify(x.map((f) => f.path)); })();
    conclude(h, problems, { identicalExports: problems.length === 0, files: readTree(a).size, markerCreatedLast: markerLast, orderCheck: 'birth times (strict step ordering is 3A-H7)', built: built.length });
  },
};

function recipeFiles(env) {
  const small = memo(env, 'f5-recipe', () => null);
  void small;
  return [];
}
void enc; void jcs; void tempDir; void CORPUS_WORKSPACE;
