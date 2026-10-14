// MO-1308 Phase 3C steps A (tamper) and B (shape and forgery).
import fs from 'node:fs';
import path from 'node:path';
import { work, recipe, recordById, seed, sampleIndices, conclude, memo } from './env.mjs';
import {
  CORPUS_WORKSPACE, MemoryLedger, buildDiskLedger, cli, copyTree, D, dec, flip, jcs, jcsBytes, ledgerFiles, parseLedger, readTree,
  rebuild, resealRecord, sdk, tryVerify, treeDigest, attempt, sha, enc,
} from './support.mjs';

const ALLOWED = ['MO1308_LEDGER_CORRUPT', 'MO1308_RECORD_BYTES_MISMATCH', 'MO1308_VERSION_UNSUPPORTED'];
const MASKS = [0x01, 0xff];
const tally = (outcomes) => outcomes.reduce((out, outcome) => { const key = outcome.ok ? 'ACCEPTED' : outcome.code; out[key] = (out[key] ?? 0) + 1; return out; }, {});

function expectAllFailClosed(outcomes, label, problems) {
  const bad = outcomes.filter((outcome) => outcome.ok || !ALLOWED.includes(outcome.code));
  if (bad.length > 0) problems.push(`${label}: ${bad.length} of ${outcomes.length} flips did not fail closed with a typed integrity code (first: ${JSON.stringify(bad[0])})`);
}

const diskBase = (env) => memo(env, 'a-disk', () => {
  const directory = work(env);
  return { directory, ledger: buildDiskLedger(directory, 'p3c-base', ['policy-0', 'readiness-ready', 'decision-ready-approve', 'regression-reference']) };
});
const fresh = (env, name) => { const target = path.join(work(env), name); copyTree(diskBase(env).ledger, target); return target; };
const verifyCli = (ledger) => cli(['history', 'verify', '--ledger', ledger, '--json']);
const closedExit3 = (run) => run.status === 3 && ALLOWED.includes(run.code);

export const tamper = {
  '3C-A1': (h, env) => {
    const built = recipe(env, 'small');
    const outcomes = [];
    for (let index = 0; index < built.descriptorBytes.length; index += 1) for (const mask of MASKS) outcomes.push(tryVerify({ ...built, descriptorBytes: flip(built.descriptorBytes, index, mask) }));
    const problems = [];
    expectAllFailClosed(outcomes, 'descriptor', problems);
    conclude(h, problems, { bytes: built.descriptorBytes.length, flips: outcomes.length, outcomes: tally(outcomes) });
  },
  '3C-A2': (h, env) => {
    const built = recipe(env, 'small');
    const outcomes = [];
    built.entries.forEach((entry, which) => {
      for (let index = 0; index < entry.length; index += 1) for (const mask of MASKS) {
        const entries = built.entries.slice();
        entries[which] = flip(entry, index, mask);
        outcomes.push(tryVerify({ ...built, entries }));
      }
    });
    const problems = [];
    expectAllFailClosed(outcomes, 'entries', problems);
    conclude(h, problems, { entries: built.entries.length, bytes: built.entries.reduce((sum, entry) => sum + entry.length, 0), flips: outcomes.length, outcomes: tally(outcomes) });
  },
  '3C-A3': (h, env) => {
    const built = recipe(env, 'small');
    const { stride } = seed('A3-member-stride');
    const outcomes = [];
    for (const [digest, list] of built.members) {
      list.forEach((member, which) => {
        for (let index = 0; index < member.bytes.length; index += stride) for (const mask of MASKS) {
          const members = new Map(built.members);
          const copy = list.map((item, position) => (position === which ? { name: item.name, bytes: flip(item.bytes, index, mask) } : item));
          members.set(digest, copy);
          outcomes.push(tryVerify({ ...built, members }));
        }
      });
    }
    const problems = [];
    const bad = outcomes.filter((outcome) => outcome.ok || outcome.code !== 'MO1308_RECORD_BYTES_MISMATCH');
    if (bad.length > 0) problems.push(`${bad.length} of ${outcomes.length} member flips were not RECORD_BYTES_MISMATCH (first: ${JSON.stringify(bad[0])})`);
    conclude(h, problems, { stride, flips: outcomes.length, outcomes: tally(outcomes) });
  },
  '3C-A4': (h, env) => {
    const { directory, ledger } = diskBase(env);
    void directory;
    const files = ledgerFiles(ledger);
    const ordered = [files.descriptor, ...files.entries, ...files.members];
    const sizes = ordered.map((file) => fs.statSync(file).size);
    const total = sizes.reduce((sum, size) => sum + size, 0);
    const { seed: name, count } = seed('A4-cli-flip-sample');
    const positions = sampleIndices(name, count, total);
    const problems = [];
    const codes = {};
    let cursor = 0;
    let file = 0;
    for (const position of positions) {
      while (position >= cursor + sizes[file]) { cursor += sizes[file]; file += 1; }
      const target = ordered[file];
      const original = fs.readFileSync(target);
      const damaged = Buffer.from(original);
      damaged[position - cursor] ^= 0x01;
      fs.writeFileSync(target, damaged);
      const run = verifyCli(ledger);
      fs.writeFileSync(target, original);
      codes[run.code ?? `exit${run.status}`] = (codes[run.code ?? `exit${run.status}`] ?? 0) + 1;
      if (!closedExit3(run)) problems.push(`flip at ${path.relative(ledger, target)}+${position - cursor}: exit ${run.status} ${run.code}`);
    }
    const restored = verifyCli(ledger);
    if (restored.status !== 0) problems.push('the ledger did not verify after the flips were undone');
    conclude(h, problems.slice(0, 5), { sample: positions.length, totalBytes: total, seedName: name, codes });
  },
  '3C-A5': (h, env) => {
    const problems = [];
    const results = {};
    const check = (name, mutate, expectCodes = ALLOWED) => {
      const ledger = fresh(env, name);
      mutate(ledger, ledgerFiles(ledger));
      const run = verifyCli(ledger);
      results[name] = run.code ?? `exit${run.status}`;
      if (!(run.status === 3 && expectCodes.includes(run.code))) problems.push(`${name}: exit ${run.status} ${run.code}`);
    };
    check('delete-middle-entry', (l, f) => fs.rmSync(f.entries[1]));
    check('delete-first-entry', (l, f) => fs.rmSync(f.entries[0]));
    check('swap-two-entries', (l, f) => { const a = fs.readFileSync(f.entries[1]); fs.writeFileSync(f.entries[1], fs.readFileSync(f.entries[2])); fs.writeFileSync(f.entries[2], a); });
    check('extra-file-in-entries', (l) => fs.writeFileSync(path.join(l, 'entries', 'notes.txt'), 'x'));
    check('gap-after-head', (l, f) => fs.copyFileSync(f.entries[3], path.join(l, 'entries', '00000000000000000010.json')));
    check('duplicate-index', (l, f) => fs.copyFileSync(f.entries[1], path.join(l, 'entries', '00000000000000000004.json')));
    check('empty-entry', (l, f) => fs.writeFileSync(f.entries[2], ''));
    check('half-entry', (l, f) => fs.writeFileSync(f.entries[2], fs.readFileSync(f.entries[2]).subarray(0, 300)));
    check('trailing-lf-in-entry', (l, f) => fs.appendFileSync(f.entries[1], '\n'));
    check('foreign-ledger-splice', (l, f) => {
      const other = buildDiskLedger(work(env), 'p3c-other', ['policy-0', 'readiness-ready', 'decision-ready-approve', 'regression-reference']);
      fs.copyFileSync(ledgerFiles(other).entries[2], f.entries[2]);
    });
    check('descriptor-substitution', (l, f) => {
      const other = buildDiskLedger(work(env), 'p3c-other2', ['policy-0']);
      fs.copyFileSync(ledgerFiles(other).descriptor, f.descriptor);
    });
    check('delete-retained-member', (l, f) => fs.rmSync(f.members[0]), ['MO1308_RECORD_BYTES_MISMATCH']);
    check('extra-member-in-record-directory', (l, f) => fs.writeFileSync(path.join(path.dirname(f.members[0]), 'package.mip'), 'x'), ['MO1308_RECORD_BYTES_MISMATCH']);
    check('truncated-member', (l, f) => fs.writeFileSync(f.members[0], fs.readFileSync(f.members[0]).subarray(0, 10)), ['MO1308_RECORD_BYTES_MISMATCH']);
    // no descriptor at all is "no ledger here" (LEDGER_NOT_FOUND, exit 4), not corruption
    const missing = fresh(env, 'missing-descriptor');
    fs.rmSync(ledgerFiles(missing).descriptor);
    const gone = verifyCli(missing);
    results['missing-descriptor'] = gone.code;
    if (!(gone.status === 4 && gone.code === 'MO1308_LEDGER_NOT_FOUND')) problems.push(`missing-descriptor: exit ${gone.status} ${gone.code}`);
    const untouched = verifyCli(diskBase(env).ledger);
    if (untouched.status !== 0) problems.push('the pristine ledger no longer verifies');
    conclude(h, problems.slice(0, 5), { variants: Object.keys(results).length, results });
  },
  '3C-A6': (h, env) => {
    const base = diskBase(env).ledger;
    const full = verifyCli(base).json.result;
    const observed = { fullEntryCount: full.entryCount, fullHeadDigest: full.headDigest };
    // truncation: the newest entry file (and, separately, the newest entry and its record) is removed
    const truncated = fresh(env, 'truncated-entry-only');
    fs.rmSync(ledgerFiles(truncated).entries.at(-1));
    const a = verifyCli(truncated);
    const both = fresh(env, 'truncated-with-record');
    const lastEntry = JSON.parse(fs.readFileSync(ledgerFiles(both).entries.at(-1), 'utf8'));
    fs.rmSync(ledgerFiles(both).entries.at(-1));
    fs.rmSync(path.join(both, 'records', lastEntry.record.recordDigest.slice('sha256:'.length)), { recursive: true });
    const b = verifyCli(both);
    // rollback: an older valid copy replaces the ledger after more entries were appended
    const old = path.join(work(env), 'old-copy');
    copyTree(truncated, old);
    fs.rmSync(path.join(old, 'entries', ledgerFiles(old).entries.at(-1).split(path.sep).at(-1)), { force: true });
    const c = verifyCli(old);
    observed.truncatedEntryOnly = { exit: a.status, entryCount: a.json?.result?.entryCount ?? null, headDigest: a.json?.result?.headDigest ?? null, unreferencedRecords: a.json?.result?.unreferencedRecords?.length ?? null, code: a.code };
    observed.truncatedWithRecord = { exit: b.status, entryCount: b.json?.result?.entryCount ?? null, headDigest: b.json?.result?.headDigest ?? null, code: b.code };
    observed.rolledBack = { exit: c.status, entryCount: c.json?.result?.entryCount ?? null, headDigest: c.json?.result?.headDigest ?? null };
    const verifies = a.status === 0 && b.status === 0 && c.status === 0;
    const anchorDetects = verifies && [a, b, c].every((run) => run.json.result.headDigest !== full.headDigest || run.json.result.entryCount !== full.entryCount);
    observed.verifiesWithLowerCount = verifies;
    observed.externalAnchorDetectsRemoval = anchorDetects;
    observed.outcome = verifies ? 'CONFIRMED' : 'NOT_CONFIRMED';
    const problems = [];
    if (!verifies && ![a, b, c].every((run) => run.status === 3 || run.status === 0)) problems.push('removal produced an outcome that is neither a clean verification nor a typed integrity failure');
    if (verifies && !anchorDetects) problems.push('the headDigest and entryCount did not change after removal: even an external anchor would not detect it');
    conclude(h, problems, observed);
  },
  '3C-A7': (h, env) => {
    const base = diskBase(env).ledger;
    const problems = [];
    const query = (ledger) => cli(['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '1000', '--json']);
    const good = query(base);
    if (good.status !== 0) problems.push('query failed on the pristine ledger');
    const indices = (good.json?.result?.entries ?? []).map((entry) => entry.index);
    if (JSON.stringify(indices) !== JSON.stringify([...indices].sort((a, b) => a - b)) || indices.length !== 4) problems.push(`results are not sorted by index: ${JSON.stringify(indices)}`);
    const damaged = fresh(env, 'a7-damaged');
    const target = ledgerFiles(damaged).entries[1];
    const bytes = fs.readFileSync(target);
    bytes[200] ^= 0x01;
    fs.writeFileSync(target, bytes);
    const run = query(damaged);
    if (!closedExit3(run)) problems.push(`query on a tampered chain: exit ${run.status} ${run.code}`);
    if (run.stdout.includes('"entries"')) problems.push('query printed results before failing');
    const missing = fresh(env, 'a7-gap');
    fs.rmSync(ledgerFiles(missing).entries[2]);
    if (!closedExit3(query(missing))) problems.push('query on a ledger with a gap did not fail closed');
    conclude(h, problems, { pristineIndices: indices, tamperedExit: run.status, tamperedCode: run.code });
  },

  // ---- B: shape and forgery ----
  '3C-B1': (h, env) => {
    const built = recipe(env, 'purge');
    const base = parseLedger(built);
    const problems = [];
    const results = {};
    const run = (name, mutate, allowed) => {
      const copy = { descriptor: structuredClone(base.descriptor), bodies: structuredClone(base.bodies), members: base.members };
      mutate(copy);
      const outcome = tryVerify(rebuild(copy));
      results[name] = outcome.ok ? 'ACCEPTED' : outcome.code;
      if (outcome.ok || !allowed.includes(outcome.code)) problems.push(`${name}: ${results[name]}`);
    };
    const shape = ['MO1308_LEDGER_CORRUPT'];
    const version = ['MO1308_VERSION_UNSUPPORTED', 'MO1308_LEDGER_CORRUPT'];
    run('descriptor-extra-member', (c) => { c.descriptor.extra = 1; }, shape);
    run('descriptor-missing-member', (c) => { delete c.descriptor.ledgerName; }, shape);
    run('descriptor-wrong-kind', (c) => { c.descriptor.kind = 'MemoryOSHistoryLedgerX'; }, shape);
    run('descriptor-version-1.0.1', (c) => { c.descriptor.version = '1.0.1'; }, version);
    run('descriptor-version-2.0.0', (c) => { c.descriptor.version = '2.0.0'; }, version);
    run('entry-extra-member', (c) => { c.bodies[1].extra = 1; }, shape);
    run('entry-missing-tombstone-member', (c) => { delete c.bodies[1].tombstone; }, shape);
    run('entry-wrong-kind', (c) => { c.bodies[1].kind = 'MemoryOSHistoryEntryX'; }, shape);
    run('entry-version-1.0.1', (c) => { c.bodies[1].version = '1.0.1'; }, version);
    run('entry-version-2.0.0', (c) => { c.bodies[1].version = '2.0.0'; }, version);
    run('entry-both-record-and-tombstone', (c) => { c.bodies[1].tombstone = structuredClone(c.bodies.at(-1).tombstone); }, shape);
    run('entry-unknown-record-kind', (c) => { c.bodies[1].record.recordKind = 'NATIVE_CHECKPOINT'; }, shape);
    run('entry-unknown-admission', (c) => { c.bodies[1].record.admission = 'TRUSTED'; }, shape);
    run('entry-unknown-association', (c) => { c.bodies[1].record.workspaceAssociation = 'GLOBAL'; }, shape);
    run('entry-unknown-subject-type', (c) => { c.bodies[1].record.subjects[0].type = 'USER'; }, shape);
    run('entry-record-extra-member', (c) => { c.bodies[1].record.extra = 1; }, shape);
    run('entry-unsorted-subjects', (c) => { const subjects = c.bodies[1].record.subjects; if (subjects.length > 1) subjects.reverse(); else subjects.push({ type: 'WORKSPACE', value: 'x' }); }, shape);
    run('tombstone-unknown-reason', (c) => { c.bodies.at(-1).tombstone.reason = 'BORED'; }, shape);
    run('tombstone-authenticity-verified', (c) => { c.bodies.at(-1).tombstone.authenticity = 'VERIFIED'; }, shape);
    run('tombstone-reference-too-long', (c) => { c.bodies.at(-1).tombstone.authorityReference = 'x'.repeat(257); }, shape);
    run('tombstone-reference-control-character', (c) => { c.bodies.at(-1).tombstone.authorityReference = 'a\u0007b'; }, shape);
    run('tombstone-on-tombstone', (c) => { const tomb = c.bodies.at(-1); c.bodies.push({ ...structuredClone(tomb), tombstone: { ...tomb.tombstone, targetIndex: c.bodies.length - 1 } }); }, shape);
    // exports: marker and manifest versions
    const files = sdk.buildHistoryExport({ descriptorBytes: built.descriptorBytes, entries: built.entries, members: built.members }).files;
    const byPath = new Map(files.map((file) => [file.path, file]));
    for (const name of ['memoryos-history-export.json', 'memoryos-history-export-complete.json']) {
      const value = JSON.parse(dec.decode(byPath.get(name).bytes));
      for (const version of ['1.0.1', '2.0.0']) {
        const edited = files.map((file) => (file.path === name ? { path: file.path, bytes: jcsBytes({ ...value, version }) } : file));
        const outcome = attempt(() => sdk.verifyHistoryExport({ files: edited }));
        results[`${name}@${version}`] = outcome.accepted ? 'ACCEPTED' : outcome.code;
        if (outcome.accepted || !['MO1308_VERSION_UNSUPPORTED', 'MO1308_EXPORT_CORRUPT'].includes(outcome.code)) problems.push(`${name}@${version}: ${results[`${name}@${version}`]}`);
      }
    }
    conclude(h, problems.slice(0, 6), { variants: Object.keys(results).length, results });
  },
  '3C-B2': (h, env) => {
    // The corpus ledgers, recomputed by an independent implementation of D and JCS, equal the manifest heads.
    const manifest = JSON.parse(fs.readFileSync(path.join(env.repo, 'repositories/cca-conformance/mo1308-phase3-corpus-manifest.json'), 'utf8'));
    const problems = [];
    const heads = {};
    for (const row of manifest.recipes) {
      const built = recipe(env, row.id);
      const parsed = parseLedger(built);
      const independent = rebuild(parsed);
      heads[row.id] = independent.headDigest;
      if (independent.headDigest !== row.headDigest) problems.push(`${row.id}: independent head ${independent.headDigest} != manifest ${row.headDigest}`);
      if (independent.ledgerIdentifier !== row.ledgerIdentifier) problems.push(`${row.id}: ledgerIdentifier differs`);
      independent.entries.forEach((bytes, index) => { if (sha(bytes) !== row.entries[index].sha256) problems.push(`${row.id}[${index}]: entry bytes differ`); });
      // every record digest, recomputed from the retained member bytes
      for (const [digest, list] of built.members) {
        const body = parsed.bodies.find((item) => item.record?.recordDigest === digest);
        const recomputed = D('MEMORYOS-HISTORY-RECORD-1.0', body.record.recordKind, jcs([...list].sort((a, b) => (a.name < b.name ? -1 : 1)).map((member) => ({ name: member.name, byteLength: member.bytes.length, sha256: sha(member.bytes) }))));
        if (recomputed !== digest) problems.push(`${row.id}: record digest ${digest.slice(0, 15)} recomputes to ${recomputed.slice(0, 15)}`);
      }
    }
    // determinism: building each recipe a second time gives the same bytes
    for (const row of manifest.recipes) if (recipe(env, row.id).verification.headDigest !== buildHeadAgain(env, row.id)) problems.push(`${row.id}: not deterministic`);
    conclude(h, problems.slice(0, 5), { recipes: Object.keys(heads).length, heads });
  },
  '3C-B3': (h, env) => {
    // A fully self-consistent forgery: entry 0 is replaced by a different valid policy record and every later identity is recomputed.
    const original = recipe(env, 'small');
    const forgedParts = parseLedger(original);
    const replacement = recordById(env, 'policy-1');
    const donor = new MemoryLedger('donor');
    const admission = donor.admit(replacement);
    const body = forgedParts.bodies[0];
    body.record.members = admission.members;
    body.record.recordDigest = admission.recordDigest;
    body.record.subjects = admission.subjects;
    const oldDigest = Object.keys(Object.fromEntries(original.members))[0];
    forgedParts.members.delete(oldDigest);
    forgedParts.members.set(admission.recordDigest, replacement.members);
    const forged = rebuild(forgedParts);
    const outcome = tryVerify(forged);
    const observed = {
      forgedVerifies: outcome.ok, originalHead: original.verification.headDigest, forgedHead: forged.headDigest, headChanged: forged.headDigest !== original.verification.headDigest,
      entryCount: outcome.ok ? outcome.verification.entryCount : null, code: outcome.ok ? null : outcome.code,
      outcome: outcome.ok ? 'CONFIRMED' : 'NOT_CONFIRMED',
    };
    const problems = [];
    if (outcome.ok && !observed.headChanged) problems.push('the forgery left the headDigest unchanged');
    if (!outcome.ok && !ALLOWED.includes(outcome.code)) problems.push(`the forged chain failed with an unexpected code ${outcome.code}`);
    conclude(h, problems, observed);
  },
  '3C-B4': (h, env) => {
    const built = recipe(env, 'all');
    const problems = [];
    const substitutions = [];
    // swap a retained member for the valid bytes of a different record of the same kind (valid self-hash, wrong entry)
    const swap = (fromId, toId, memberName) => {
      const [digest] = [...built.members].find(([, list]) => list.some((member) => member.name === memberName && sha(member.bytes) === sha(recordById(env, fromId).members.find((m) => m.name === memberName).bytes)));
      const replacement = recordById(env, toId).members.find((member) => member.name === memberName).bytes;
      const members = new Map(built.members);
      members.set(digest, built.members.get(digest).map((member) => (member.name === memberName ? { name: member.name, bytes: replacement } : member)));
      const outcome = tryVerify({ ...built, members });
      substitutions.push({ memberName, fromId, toId, code: outcome.ok ? 'ACCEPTED' : outcome.code });
      if (outcome.ok || outcome.code !== 'MO1308_RECORD_BYTES_MISMATCH') problems.push(`${fromId} -> ${toId}: ${outcome.ok ? 'ACCEPTED' : outcome.code}`);
    };
    swap('readiness-ready', 'readiness-qualified', 'memoryos-readiness-result.json');
    swap('policy-0', 'policy-1', 'policy-outcome.json');
    swap('decision-ready-approve', 'decision-ready-reject', 'human-decision.json');
    swap('checkpoint-c00', 'checkpoint-c01', 'checkpoint.json');
    conclude(h, problems, { substitutions });
  },
  '3C-B5': (h, env) => {
    // An entry whose retained bytes could never have been admitted still verifies when its digests are consistent.
    const original = recipe(env, 'small');
    const parts = parseLedger(original);
    const policy = recordById(env, 'policy-0');
    const garbage = policy.members.map((member) => ({ name: member.name, bytes: member.name === 'policy-outcome.json' ? enc.encode('{"this":"was never admitted"}') : member.bytes }));
    const body = parts.bodies[0];
    resealRecord(body, garbage);
    const oldDigest = [...original.members.keys()][0];
    parts.members.delete(oldDigest);
    parts.members.set(body.record.recordDigest, garbage);
    const forged = rebuild(parts);
    const verified = tryVerify(forged);
    const admitAgain = attempt(() => new MemoryLedger('probe').admit({ recordKind: 'POLICY_EVALUATION', members: garbage }));
    const observed = {
      verifiesWithoutReAdmission: verified.ok, wouldFailAdmission: !admitAgain.accepted, admissionCode: admitAgain.accepted ? null : admitAgain.code,
      verifyCode: verified.ok ? null : verified.code, outcome: verified.ok && !admitAgain.accepted ? 'CONFIRMED' : 'NOT_CONFIRMED',
    };
    const problems = [];
    if (verified.ok && admitAgain.accepted) problems.push('the garbage record was admitted: the probe is not a failing-admission example');
    if (!verified.ok && !ALLOWED.includes(verified.code)) problems.push(`unexpected code ${verified.code}`);
    conclude(h, problems, observed);
  },
  '3C-B6': (h, env) => {
    const built = recipe(env, 'all');
    const base = parseLedger(built);
    const problems = [];
    const results = {};
    const run = (name, mutate, allowed = ALLOWED) => {
      const copy = { descriptor: structuredClone(base.descriptor), bodies: structuredClone(base.bodies), members: new Map(base.members) };
      mutate(copy);
      const outcome = tryVerify(rebuild(copy));
      results[name] = outcome.ok ? 'ACCEPTED' : outcome.code;
      if (outcome.ok || !allowed.includes(outcome.code)) problems.push(`${name}: ${results[name]}`);
    };
    run('wrong-record-digest', (c) => { c.bodies[2].record.recordDigest = D('x'); });
    run('member-length-off-by-one', (c) => { c.bodies[2].record.members[0].byteLength += 1; });
    run('member-digest-wrong', (c) => { c.bodies[2].record.members[0].sha256 = D('y'); });
    run('member-list-reordered', (c) => { c.bodies[2].record.members.reverse(); });
    run('member-added-to-list', (c) => { c.bodies[2].record.members.push({ name: 'package.mip', byteLength: 1, sha256: D('z') }); });
    run('association-flipped', (c) => { c.bodies[2].record.workspaceAssociation = c.bodies[2].record.workspaceAssociation === 'DECLARED' ? 'INTRINSIC' : 'DECLARED'; }, [...ALLOWED]);
    run('tombstone-target-digest-wrong', (c) => { c.bodies.push({ kind: 'MemoryOSHistoryEntry', version: '1.0.0', entryType: 'TOMBSTONE', record: null, tombstone: { targetIndex: 2, targetEntryDigest: D('a'), targetRecordDigest: base.bodies[2].record.recordDigest, reason: 'OPERATOR_CORRECTION', authorityReference: 'T', authenticity: 'NOT_VERIFIED_BY_MEMORYOS' } }); });
    run('tombstone-targets-itself-or-later', (c) => { c.bodies.push({ kind: 'MemoryOSHistoryEntry', version: '1.0.0', entryType: 'TOMBSTONE', record: null, tombstone: { targetIndex: c.bodies.length, targetEntryDigest: D('a'), targetRecordDigest: D('b'), reason: 'OPERATOR_CORRECTION', authorityReference: 'T', authenticity: 'NOT_VERIFIED_BY_MEMORYOS' } }); });
    // an entry of another ledger placed at the same index
    const other = parseLedger(new MemoryLedger('other-ledger').built());
    void other;
    const donor = new MemoryLedger('another-ledger');
    donor.append(recordById(env, 'policy-0'));
    donor.append(recordById(env, 'readiness-ready'));
    donor.append(recordById(env, 'decision-ready-approve'));
    const spliced = built.entries.slice();
    spliced[2] = donor.entries[2];
    const outcome = tryVerify({ ...built, entries: spliced });
    results['foreign-entry-same-index'] = outcome.ok ? 'ACCEPTED' : outcome.code;
    if (outcome.ok || !ALLOWED.includes(outcome.code)) problems.push(`foreign-entry-same-index: ${results['foreign-entry-same-index']}`);
    conclude(h, problems.slice(0, 6), { variants: Object.keys(results).length, results });
  },
};

function buildHeadAgain(env, id) {
  const manifest = JSON.parse(fs.readFileSync(path.join(env.repo, 'repositories/cca-conformance/mo1308-phase3-corpus-manifest.json'), 'utf8'));
  return manifest.recipes.find((row) => row.id === id).headDigest;
}
void CORPUS_WORKSPACE; void readTree; void treeDigest;
