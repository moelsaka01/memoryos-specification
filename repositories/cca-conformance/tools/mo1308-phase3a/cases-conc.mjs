// MO-1308 Phase 3A step F: concurrency through real CLI processes (F1-F7). Every appender, tombstoner, exporter and reader is its own
// `memoryos history ...` process, started together; the harness only starts, waits and reads. F7 repeats the F1 workload ten times with
// the observation preload in errors-only mode, which reports each process's file-system errors (the typed IO failure of the product hides
// the errno), and counts the runs that saw a staging EPERM (owner decision D6: two or more runs escalate).
import fs from 'node:fs';
import path from 'node:path';
import { CLI, appendArgs, recordDigestOf, sha, treeDigest } from './support.mjs';
import { conclude, recordById, register, work } from './env.mjs';
import { ledgerWith } from './cases-cli.mjs';
import { cliAsync, snapshot, snapshotDiff, writePlan } from './win.mjs';
import { drbgWord } from '../mo1308-phase3/corpus.mjs';

const p = (...parts) => path.join(...parts);
const CONFLICT = 'MO1308_LEDGER_CONFLICT';
const RETRY_BOUND = 200;
const TYPED_FOR_READERS = new Set([CONFLICT, 'MO1308_IO']);
const INTEGRITY_OR_BOUNDARY = ['MO1308_LEDGER_CORRUPT', 'MO1308_RECORD_BYTES_MISMATCH', 'MO1308_FILESYSTEM_BOUNDARY', 'MO1308_EXPORT_CORRUPT', 'MO1308_VERSION_UNSUPPORTED', 'MO1308_INTERNAL', 'MO1308_LEDGER_NOT_FOUND'];
const entryName = (index) => `${String(index).padStart(20, '0')}.json`;
const labels = (count, prefix = 'checkpoint-f') => Array.from({ length: count }, (_, index) => `${prefix}${String(index).padStart(2, '0')}`);
const memberDigest = (record) => `sha256:${sha(record.members[0].bytes).slice('sha256:'.length)}`;
const orderedBySeed = (seed, count) => Array.from({ length: count }, (_, index) => index).sort((a, b) => drbgWord(seed, a) - drbgWord(seed, b));
const ORDER_SEED = 'MO1308-P3-F-ORDER-1';

// One appender: its records in turn, each retried after LEDGER_CONFLICT only (a typed IO is not retried: Amendment A6).
async function appender(env, ledger, ids, { tag, plan = null, firstPlan = null }) {
  const out = [];
  let first = true;
  for (const id of ids) {
    const record = recordById(env, id);
    const args = appendArgs(ledger, record, p(work(env, 'in'), `${tag}-${id}`));
    const attempts = [];
    let outcome = 'failed';
    for (let attempt = 0; attempt < RETRY_BOUND; attempt += 1) {
      const result = await cliAsync(CLI, args, { plan: first && firstPlan !== null ? firstPlan : plan, log: env.log });
      first = false;
      if (result.status === 0) { attempts.push({ ok: true, index: result.json?.result?.index ?? null }); outcome = 'success'; break; }
      attempts.push({ ok: false, code: result.code, status: result.status });
      if (result.code !== CONFLICT) break;
    }
    out.push({ id, outcome, finalCode: outcome === 'success' ? null : attempts.at(-1).code, attempts });
  }
  return out;
}

// A reader: verify (and optionally query) in a loop until `stopped()`; every outcome is kept.
async function reader(env, ledger, stopped, { query = false, plan = null } = {}) {
  const counts = []; const failures = {}; let runs = 0;
  const queryArgs = ['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '1000', '--json'];
  while (!stopped()) {
    const result = await cliAsync(CLI, query && runs % 2 === 1 ? queryArgs : ['history', 'verify', '--ledger', ledger, '--json'], { plan, log: env.log });
    runs += 1;
    if (result.status === 0) { if (!query || runs % 2 === 1) counts.push(result.json?.result?.entryCount ?? -1); } else failures[result.code ?? `exit-${result.status}`] = (failures[result.code ?? `exit-${result.status}`] ?? 0) + 1;
  }
  return { counts, failures, runs };
}

const readEntries = (ledger) => fs.readdirSync(p(ledger, 'entries')).map((name) => JSON.parse(fs.readFileSync(p(ledger, 'entries', name), 'utf8')));
const verifyLedger = (env, ledger) => { const out = cliSync(env, ledger); return out; };
import { run as syncRun } from './env.mjs';
function cliSync(env, ledger) { return syncRun(env, ['history', 'verify', '--ledger', ledger, '--json']); }

const reEscape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A start barrier: every process of the first attempt stops at its first read of the ledger directory (after node has started and loaded
// the product), and the harness releases them all at once, so the commits really race instead of queueing behind process start-up.
function startBarrier(env, ledger, name, mode = {}) {
  const dir = p(work(env, 'barrier'), name);
  fs.mkdirSync(dir, { recursive: true });
  const goFile = p(dir, 'go');
  const root = ledger.replaceAll('\\', '/');
  const planFor = (slot) => writePlan(p(dir, `w${slot}`), { mode, points: [{ id: 'B', op: 'readdirSync', match: { 0: `${reEscape(root)}$` }, ignoreCase: true, nth: 1, when: 'before', action: 'pause', perProcess: true, goFile, timeoutMs: 240000 }] });
  const reachedCount = () => fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).reduce((sum, entry) => sum + fs.readdirSync(p(dir, entry.name)).filter((file) => file.startsWith('B-') && file.endsWith('.reached')).length, 0);
  const waitAll = async (count, timeoutMs = 120000) => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) { if (reachedCount() >= count) return true; await new Promise((resolve) => setTimeout(resolve, 20)); }
    return false;
  };
  return { dir, planFor, waitAll, release: () => fs.writeFileSync(goFile, 'go') };
}

// The F1 workload: 10 appenders of 3 records each (checkpoint-f00..f29), started together (a barrier, in the seeded order), with 2 readers.
async function f1Workload(env, name, { mode = {}, plan = null } = {}) {
  const ledger = ledgerWith(env, name, []);
  const ids = labels(30);
  const order = orderedBySeed(ORDER_SEED, 10);
  const barrier = startBarrier(env, ledger, name, mode);
  let done = false;
  const writers = order.map((slot) => appender(env, ledger, ids.slice(slot * 3, slot * 3 + 3), { tag: `${name}-w${slot}`, plan, firstPlan: barrier.planFor(slot) }));
  const arrived = await barrier.waitAll(10);
  barrier.release();
  const readers = [reader(env, ledger, () => done, { plan }), reader(env, ledger, () => done, { plan })];
  const written = (await Promise.all(writers)).flat();
  done = true;
  const observed = await Promise.all(readers);
  return { ledger, records: written, observed, ids, barrier: { dir: barrier.dir, allArrived: arrived } };
}

// The exact contract of F1 (and of every F1 repetition in F7): returns problems and statistics.
function checkF1(env, label, outcome) {
  const problems = [];
  const { ledger, records, observed } = outcome;
  const entries = readEntries(ledger);
  const presence = new Map();
  for (const entry of entries) presence.set(entry.record.members[0].sha256, (presence.get(entry.record.members[0].sha256) ?? 0) + 1);
  const succeeded = records.filter((record) => record.outcome === 'success');
  const failed = records.filter((record) => record.outcome !== 'success');
  const present = (record) => presence.get(memberDigest(recordById(env, record.id))) ?? 0;
  const failedCodes = {};
  for (const record of records) for (const attempt of record.attempts) if (!attempt.ok) failedCodes[attempt.code ?? 'untyped'] = (failedCodes[attempt.code ?? 'untyped'] ?? 0) + 1;
  for (const record of records) for (const attempt of record.attempts) if (!attempt.ok && attempt.code === null) problems.push(`${label}: ${record.id} had an untyped failure (exit ${attempt.status})`);
  for (const record of succeeded) if (present(record) !== 1) problems.push(`${label}: ${record.id} succeeded and is present ${present(record)} times`);
  for (const record of records) if (present(record) === 0 && !(record.outcome === 'failed' && ['MO1308_LEDGER_CONFLICT', 'MO1308_IO'].includes(record.finalCode))) problems.push(`${label}: ${record.id} is absent without a typed failure`);
  for (const record of failed) if (present(record) !== 0) problems.push(`${label}: ${record.id} failed for its writer yet is in the ledger`);
  const indices = succeeded.map((record) => record.attempts.at(-1).index).sort((a, b) => a - b);
  if (JSON.stringify(indices) !== JSON.stringify(indices.map((_, position) => position))) problems.push(`${label}: the winning indices are not 0..n-1`);
  if (entries.length !== succeeded.length) problems.push(`${label}: ${entries.length} entries for ${succeeded.length} successes`);
  if ([...presence.values()].some((count) => count !== 1)) problems.push(`${label}: a record is present twice`);
  const names = fs.readdirSync(p(ledger, 'entries'));
  if (JSON.stringify(names) !== JSON.stringify(succeeded.map((_, index) => entryName(index)))) problems.push(`${label}: the entry names are not contiguous`);
  if (fs.readdirSync(p(ledger, '.pending')).length > 0) register(env, ledger, false, { interrupted: true });
  const verification = cliSync(env, ledger);
  if (verification.status !== 0 || verification.json?.result?.entryCount !== succeeded.length) problems.push(`${label}: the chain does not verify (${verification.status} ${verification.code})`);
  for (const name of fs.readdirSync(p(ledger, '.pending'))) if (!/^(entry-[0-9]{20}|member-[0-9a-f]{64}-[a-z.-]+)\.[0-9]+$/u.test(name)) problems.push(`${label}: ${name} is not a staging name`);
  for (const { counts, failures } of observed) {
    if (counts.length === 0) problems.push(`${label}: a reader completed no verification`);
    if (JSON.stringify(counts) !== JSON.stringify([...counts].sort((a, b) => a - b))) problems.push(`${label}: a reader saw the ledger shrink`);
    for (const code of Object.keys(failures)) if (!TYPED_FOR_READERS.has(code)) problems.push(`${label}: a reader saw ${code} (${failures[code]} times)`);
    if (counts.length > 0 && counts.at(-1) > succeeded.length) problems.push(`${label}: a reader saw more entries than were committed`);
  }
  return { problems, succeeded: succeeded.length, failedRecords: failed.length, failedAttemptsByCode: failedCodes, readerRuns: observed.map((item) => item.runs), readerFailures: observed.map((item) => item.failures) };
}

export const concCases = {
  '3A-F1': async (h, env) => {
    const outcome = await f1Workload(env, 'f1');
    const verdict = checkF1(env, 'F1', outcome);
    conclude(h, verdict.problems, { appenders: 10, readers: 2, succeeded: verdict.succeeded, recordsNotCommitted: verdict.failedRecords, failedAttemptsByCode: verdict.failedAttemptsByCode, readerRuns: verdict.readerRuns, readerFailures: verdict.readerFailures });
  },

  '3A-F2': async (h, env) => {
    const problems = [];
    const seedIds = labels(6, 'checkpoint-c');
    const ledger = ledgerWith(env, 'f2', seedIds);
    const barrier = startBarrier(env, ledger, 'f2');
    const tombstoner = async (target) => {
      const attempts = [];
      for (let attempt = 0; attempt < RETRY_BOUND; attempt += 1) {
        const result = await cliAsync(CLI, ['history', 'tombstone', '--ledger', ledger, '--target', String(target), '--reason', 'PRIVACY_REQUEST', '--authority-reference', `F2-${target}`, '--json'], { log: env.log, plan: attempt === 0 ? barrier.planFor(target) : null });
        attempts.push({ ok: result.status === 0, code: result.code });
        // a conflict is retried; a typed IO is retried too, because re-running the same tombstone finishes an interrupted purge
        if (result.status === 0 || ![CONFLICT, 'MO1308_IO'].includes(result.code)) break;
      }
      return { target, attempts };
    };
    const jobs = [tombstoner(0), tombstoner(1), tombstoner(2),
      ...[0, 1, 2].map((slot) => appender(env, ledger, [0, 1].map((index) => `checkpoint-f${slot}${index}`), { tag: `f2-a${slot}`, firstPlan: barrier.planFor(10 + slot) }))];
    barrier.waitAll(6).then(() => barrier.release());
    const results = await Promise.all(jobs);
    const tombstones = results.slice(0, 3);
    for (const { target, attempts } of tombstones) if (!attempts.at(-1).ok) problems.push(`the tombstone of ${target} did not succeed: ${attempts.at(-1).code}`);
    const appends = results.slice(3).flat();
    for (const record of appends) if (record.outcome !== 'success' && !['MO1308_IO', CONFLICT].includes(record.finalCode)) problems.push(`${record.id}: ${record.finalCode}`);
    const entries = readEntries(ledger);
    const tombstoneEntries = entries.filter((entry) => entry.entryType === 'TOMBSTONE');
    const targets = tombstoneEntries.map((entry) => entry.tombstone.targetIndex).sort();
    if (JSON.stringify(targets) !== '[0,1,2]') problems.push(`tombstone targets ${JSON.stringify(targets)}`);
    const verification = cliSync(env, ledger);
    if (verification.status !== 0) problems.push(`the chain does not verify: ${verification.code}`);
    if ((verification.json?.result?.purgePending ?? [0]).length !== 0) problems.push('a purge is not finished');
    if (verification.json?.result?.purgedRecords !== 3) problems.push(`purgedRecords ${verification.json?.result?.purgedRecords}`);
    const succeededAppends = appends.filter((record) => record.outcome === 'success').length;
    if (entries.length !== seedIds.length + 3 + succeededAppends) problems.push(`${entries.length} entries, ${seedIds.length + 3 + succeededAppends} expected`);
    conclude(h, problems, { tombstones: tombstones.map((item) => ({ target: item.target, attempts: item.attempts.length })), appendsSucceeded: succeededAppends, entries: entries.length });
  },

  '3A-F3': async (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'f3', labels(2, 'checkpoint-c'));
    let done = false;
    const barrier = startBarrier(env, ledger, 'f3');
    const exports = []; let serial = 0;
    const exporter = async (slot) => {
      const mine = [];
      while (!done && mine.length < 40) {
        const output = p(work(env, 'f3x'), `e${slot}-${serial += 1}`);
        const result = await cliAsync(CLI, ['history', 'export', '--ledger', ledger, '--output', output, '--json'], { log: env.log, plan: mine.length === 0 ? barrier.planFor(20 + slot) : null });
        mine.push({ output, status: result.status, code: result.code, entryCount: result.json?.result?.entryCount ?? null, headDigest: result.json?.result?.headDigest ?? null });
      }
      exports.push(...mine);
    };
    const appenders = [0, 1, 2].map((slot) => appender(env, ledger, [0, 1].map((index) => `checkpoint-f${slot}${index}`), { tag: `f3-a${slot}`, firstPlan: barrier.planFor(slot) }));
    const exporters = [exporter(0), exporter(1)];
    barrier.waitAll(5).then(() => barrier.release());
    await Promise.all(appenders);
    done = true;
    await Promise.all(exporters);
    const final = readEntries(ledger);
    let verified = 0; let conflicts = 0;
    for (const item of exports) {
      if (item.status === 0) {
        const check = await cliAsync(CLI, ['history', 'verify-export', '--export', item.output, '--json'], { log: env.log });
        if (check.status !== 0) problems.push(`an export of ${item.entryCount} entries does not verify: ${check.code}`);
        else verified += 1;
        // the export is a consistent snapshot: its head is the digest of ledger entry entryCount-1
        if (item.entryCount > final.length || final[item.entryCount - 1]?.entryDigest !== item.headDigest) problems.push(`an export (${item.entryCount} entries) is not a prefix snapshot of the ledger`);
      } else if (item.code === CONFLICT) { conflicts += 1; if (fs.existsSync(item.output) && fs.readdirSync(item.output).includes('memoryos-history-export-complete.json')) problems.push('a conflicted export carries a completion marker'); } else problems.push(`an export failed with ${item.status} ${item.code}`);
    }
    if (verified === 0) problems.push('no export completed');
    const verification = cliSync(env, ledger);
    if (verification.status !== 0) problems.push(`the ledger does not verify: ${verification.code}`);
    conclude(h, problems, { exports: exports.length, verified, conflicts, finalEntries: final.length });
  },

  '3A-F4': async (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'f4', labels(12));
    let done = false;
    const readers = [reader(env, ledger, () => done), reader(env, ledger, () => done), reader(env, ledger, () => done, { query: true })];
    const purges = [];
    for (let target = 0; target < 12; target += 1) {
      let result;
      for (let attempt = 0; attempt < RETRY_BOUND; attempt += 1) {
        result = await cliAsync(CLI, ['history', 'tombstone', '--ledger', ledger, '--target', String(target), '--reason', 'DATA_MINIMIZATION', '--authority-reference', `F4-${target}`, '--json'], { log: env.log });
        if (result.status === 0 || ![CONFLICT, 'MO1308_IO'].includes(result.code)) break;
      }
      purges.push(result.status === 0);
    }
    done = true;
    const observed = await Promise.all(readers);
    if (purges.some((ok) => !ok)) problems.push('a tombstone did not succeed');
    for (const { counts, failures, runs } of observed) {
      if (runs === 0) problems.push('a reader ran nothing');
      for (const code of Object.keys(failures)) if (INTEGRITY_OR_BOUNDARY.includes(code) || !TYPED_FOR_READERS.has(code)) problems.push(`a reader saw ${code} (${failures[code]} times) during the purge`);
      void counts;
    }
    const final = cliSync(env, ledger);
    if (final.status !== 0 || final.json?.result?.purgedRecords !== 12 || (final.json?.result?.purgePending ?? [0]).length !== 0) problems.push('the purge did not complete cleanly');
    conclude(h, problems, { purges: purges.length, readerRuns: observed.map((item) => item.runs), readerFailures: observed.map((item) => item.failures) });
  },

  '3A-F5': async (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'f5', []);
    const barrier = startBarrier(env, ledger, 'f5');
    const workers = Array.from({ length: 8 }, (_, slot) => appender(env, ledger, ['checkpoint-c07'], { tag: `f5-w${slot}`, firstPlan: barrier.planFor(slot) }));
    barrier.waitAll(8).then(() => barrier.release());
    // the same record: the first to commit wins; every other attempt, after any conflict, is RECORD_DUPLICATE
    const results = (await Promise.all(workers)).flat();
    const winners = results.filter((record) => record.outcome === 'success').length;
    const finals = {};
    for (const record of results.filter((item) => item.outcome !== 'success')) finals[record.finalCode] = (finals[record.finalCode] ?? 0) + 1;
    if (winners !== 1) problems.push(`${winners} writers succeeded`);
    for (const code of Object.keys(finals)) if (!['MO1308_RECORD_DUPLICATE', 'MO1308_IO'].includes(code)) problems.push(`a loser ended with ${code}`);
    const entries = readEntries(ledger);
    if (entries.length !== 1) problems.push(`${entries.length} entries`);
    const verification = cliSync(env, ledger);
    if (verification.status !== 0 || verification.json?.result?.entryCount !== 1) problems.push('the ledger does not verify with exactly one entry');
    conclude(h, problems, { writers: 8, winners, loserOutcomes: finals });
  },

  '3A-F6': async (h, env) => {
    const problems = [];
    const ledger = ledgerWith(env, 'f6', ['checkpoint-c00', 'checkpoint-c01']);
    // distinct authority references: a second tombstone of the same target is then never a resumption of the first one's purge
    const barrier = startBarrier(env, ledger, 'f6');
    const workers = Array.from({ length: 6 }, (_, slot) => (async () => {
      const attempts = [];
      for (let attempt = 0; attempt < RETRY_BOUND; attempt += 1) {
        const result = await cliAsync(CLI, ['history', 'tombstone', '--ledger', ledger, '--target', '0', '--reason', 'PRIVACY_REQUEST', '--authority-reference', `F6-${slot}`, '--json'], { log: env.log, plan: attempt === 0 ? barrier.planFor(slot) : null });
        attempts.push({ status: result.status, code: result.code });
        if (result.code !== CONFLICT) break;
      }
      return attempts.at(-1);
    })());
    barrier.waitAll(6).then(() => barrier.release());
    const finals = await Promise.all(workers);
    const winners = finals.filter((item) => item.status === 0).length;
    if (winners !== 1) problems.push(`${winners} tombstones succeeded`);
    for (const item of finals.filter((entry) => entry.status !== 0)) if (!['MO1308_TOMBSTONE_INVALID', 'MO1308_IO'].includes(item.code)) problems.push(`a loser ended with ${item.code}`);
    const entries = readEntries(ledger);
    if (entries.filter((entry) => entry.entryType === 'TOMBSTONE').length !== 1) problems.push('there is not exactly one tombstone entry');
    const verification = cliSync(env, ledger);
    if (verification.status !== 0 || (verification.json?.result?.purgePending ?? [0]).length !== 0) problems.push('the ledger does not verify with the purge finished');
    conclude(h, problems, { workers: 6, winners, loserCodes: finals.filter((item) => item.status !== 0).map((item) => item.code) });
  },

  '3A-F7': async (h, env) => {
    // F1, ten times, with every process observed in errors-only mode. EPERM from an exclusive create of a staging name is the census.
    const problems = [];
    const runs = [];
    for (let repetition = 0; repetition < 10; repetition += 1) {
      const dir = p(work(env, 'f7'), `run-${repetition}`);
      const plan = writePlan(dir, { mode: { errors: true } });
      const outcome = await f1Workload(env, `f7-${repetition}`, { mode: { errors: true }, plan });
      if (!outcome.barrier.allArrived) problems.push(`run ${repetition + 1}: the start barrier timed out`);
      const verdict = checkF1(env, `run ${repetition + 1}`, outcome);
      problems.push(...verdict.problems);
      const byKind = {}; let stagingEperm = 0; let census = 0;
      const censusFiles = [dir, ...fs.readdirSync(outcome.barrier.dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => p(outcome.barrier.dir, entry.name))]
        .flatMap((directory) => fs.readdirSync(directory).filter((file) => file.startsWith('census-')).map((file) => p(directory, file)));
      for (const censusFile of censusFiles) {
        census += 1;
        const row = JSON.parse(fs.readFileSync(censusFile, 'utf8'));
        for (const error of row.errors) {
          if (['ENOENT', 'EEXIST'].includes(error.code)) continue; // the store's own probes: a missing name, an occupied staging name
          const key = `${error.code}/${error.syscall}/${error.op}`;
          byKind[key] = (byKind[key] ?? 0) + 1;
          if (error.code === 'EPERM' && error.op === 'openSync' && String(error.path).includes('/.pending/')) stagingEperm += 1;
        }
      }
      if (census === 0) problems.push(`run ${repetition + 1}: no process wrote a census (the observation preload did not run)`);
      runs.push({ run: repetition + 1, succeeded: verdict.succeeded, failedRecords: verdict.failedRecords, failedAttemptsByCode: verdict.failedAttemptsByCode, processesObserved: census, stagingEperm, fileSystemErrors: byKind });
    }
    const withEperm = runs.filter((row) => row.stagingEperm > 0).length;
    h.observe({
      outcome: withEperm > 0 ? 'CONFIRMED' : 'NOT_CONFIRMED', repetitions: 10, runsWithStagingEperm: withEperm, escalationThreshold: 2, runs, problems: problems.slice(0, 6),
      note: 'Q02: CONFIRMED when a staging EPERM occurred (the typed IO failure of A6 was reproduced); NOT_CONFIRMED when none occurred in ten runs. Q10: host latency is recorded in the per-run timings of the step receipt.',
    });
    if (problems.length > 0) throw new Error(`${problems.length} problem(s): ${problems.slice(0, 6).join('; ')}`);
    if (withEperm >= 2) h.escalate(`${withEperm} of 10 F7 runs saw a staging EPERM (owner decision D6: escalate at 2 or more)`);
  },
};
void recordDigestOf; void register; void treeDigest; void snapshot; void snapshotDiff; void verifyLedger;
