// MO-1308 Phase 3A step JC: the J-C ceiling run (100,000 entries), its own segment with its own clock. The chain is generated directly on
// disk (an append reads the whole ledger, so building it by appends would be quadratic; verification does not re-run admission, so the
// generated entries are chain-valid MIP_PACKAGE entries with synthetic member bytes), then every operation of the Freeze 14.2 ceiling runs:
// the real SDK and production store in a helper process (JC4-JC7), the real CLI in processes (JC2, JC3, JC8, JC9). Timings are recorded; the
// 200,000-file ledger and the export are NOT retained (digests, counts and logs only). The independent D and JCS of support.mjs generate the
// entries; the product verifies them, so a disagreement fails JC4.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { CLI, D, enc, initArgs, jcs, jcsBytes, sha } from './support.mjs';
import { conclude, recordById, work } from './env.mjs';
import { HERE, removeTree, sha256 } from './win.mjs';
import { verifyCandidate } from '../mo1308-phase3/lib/candidate.mjs';
import { drbgWord } from '../mo1308-phase3/corpus.mjs';

const p = (...parts) => path.join(...parts);
const OPS = p(HERE, 'ceiling-ops.mjs');
const NODE_ENV = { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '' };
const FULL = 100000;
// Q11 pre-registration: the register says a 100,000-entry export takes about 16 minutes on the reference host. CONFIRMED when this run's export
// takes at least half of that (8 minutes); NOT_CONFIRMED when it is clearly faster.
const Q11_CONFIRMED_AT_MS = 8 * 60 * 1000;
const entryName = (index) => `${String(index).padStart(20, '0')}.json`;
const seconds = (ms) => Math.round(ms / 100) / 10;

const entriesWanted = (env) => (!env.certifying && env.tag === 'dev' && process.env.P3A_CEILING_DEV_ENTRIES ? Number(process.env.P3A_CEILING_DEV_ENTRIES) : FULL);
const state = (env) => (env.cache.ceiling ??= { dir: p(work(env, 'ceiling')), timings: [], total: entriesWanted(env) });
const note = (env, label, ms, extra = {}) => { state(env).timings.push({ label, ms, seconds: seconds(ms), ...extra }); };

function ops(args, { maxHeapMiB = 8192 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [`--max-old-space-size=${maxHeapMiB}`, OPS, ...args], { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: NODE_ENV });
    let out = ''; let err = '';
    child.stdout.on('data', (chunk) => { out += chunk; }); child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('close', (code) => { let json = null; try { json = JSON.parse(out); } catch { json = null; } resolve({ code, json, stderr: err.slice(0, 400) }); });
  });
}
function cliRun(args) {
  const started = Date.now();
  const out = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', windowsHide: true, shell: false, env: NODE_ENV, maxBuffer: 1 << 29, timeout: 90 * 60 * 1000 });
  let json = null; try { json = JSON.parse(out.stdout || out.stderr); } catch { json = null; }
  return { status: out.status, json, bytes: Buffer.byteLength(out.stdout ?? ''), ms: Date.now() - started, code: json?.error?.historyCode ?? null };
}
// A fingerprint of the ledger that a refused command must leave alone: counts, the last entries and a seeded sample of entry files.
function fingerprint(ledger, total) {
  const names = fs.readdirSync(p(ledger, 'entries'));
  const sample = [0, 1, total - 2, total - 1, ...Array.from({ length: 200 }, (_, index) => drbgWord('MO1308-P3-JC9-SAMPLE-1', index) % total)].filter((index) => index >= 0 && index < names.length);
  return {
    entries: names.length, records: fs.readdirSync(p(ledger, 'records')).length, pending: fs.readdirSync(p(ledger, '.pending')).length, top: fs.readdirSync(ledger).sort().join(','),
    sample: sha256(Buffer.from(sample.map((index) => `${index}:${sha256(fs.readFileSync(p(ledger, 'entries', names[index])))}`).join('\n'))),
  };
}

export const ceilingCases = {
  '3A-JC1': (h, env) => {
    const s = state(env);
    s.scratchBefore = fs.readdirSync(env.scratch).sort();
    s.ledger = p(s.dir, 'ledger');
    const init = cliRun(initArgs(s.ledger, 'ceiling'));
    if (init.status !== 0) throw new Error(`init failed: ${init.code}`);
    const descriptor = JSON.parse(fs.readFileSync(p(s.ledger, 'memoryos-history-ledger.json'), 'utf8'));
    const ledgerIdentifier = D('MEMORYOS-HISTORY-LEDGER-1.0', jcs(descriptor));
    const generated = s.total - 1;
    const started = Date.now();
    let previous = D('MEMORYOS-HISTORY-GENESIS-1.0', ledgerIdentifier);
    for (let index = 0; index < generated; index += 1) {
      const bytes = enc.encode(`package ${index}`);
      const members = [{ name: 'package.mip', byteLength: bytes.length, sha256: sha(bytes) }];
      const record = { recordKind: 'MIP_PACKAGE', recordDigest: D('MEMORYOS-HISTORY-RECORD-1.0', 'MIP_PACKAGE', jcs(members)), admission: 'MIP_001_VERIFIED', members, workspaceAssociation: 'INTRINSIC',
        subjects: [{ type: 'WORKSPACE', value: 'workspace-investigation' }], decisionConsistency: null };
      const entry = { kind: 'MemoryOSHistoryEntry', version: '1.0.0', ledgerIdentifier, index, previousEntryDigest: previous, entryType: 'RECORD', record, tombstone: null };
      entry.entryDigest = D('MEMORYOS-HISTORY-ENTRY-1.0', jcs(entry));
      previous = entry.entryDigest;
      fs.writeFileSync(p(s.ledger, 'entries', entryName(index)), jcsBytes(entry), { flag: 'wx' });
      const directory = p(s.ledger, 'records', record.recordDigest.slice('sha256:'.length));
      fs.mkdirSync(directory);
      fs.writeFileSync(p(directory, 'package.mip'), bytes, { flag: 'wx' });
    }
    const ms = Date.now() - started;
    s.generatedHead = previous;
    note(env, `generate ${generated} entries and members`, ms);
    h.observe({ generated, seconds: seconds(ms), entriesPerSecond: Math.round(generated / (ms / 1000)), headDigest: previous });
  },

  '3A-JC2': (h, env) => {
    const s = state(env);
    const out = cliRun(['history', 'query', '--ledger', s.ledger, '--retention', 'ANY', '--from', '0', '--limit', '1000', '--json']);
    note(env, 'query page of 1000 (real CLI)', out.ms, { stdoutBytes: out.bytes });
    if (out.status !== 0) throw new Error(`the query page failed: ${out.status} ${out.code}`);
    h.observe({ seconds: seconds(out.ms), stdoutBytes: out.bytes, entriesReturned: out.json.result.entries.length });
  },

  '3A-JC3': (h, env) => {
    const s = state(env);
    const out = cliRun(['history', 'query', '--ledger', s.ledger, '--subject-type', 'WORKSPACE', '--subject', 'workspace-investigation', '--retention', 'ANY', '--from', '0', '--limit', '1000', '--json']);
    note(env, 'query with a subject filter over the whole ledger (real CLI)', out.ms, { stdoutBytes: out.bytes });
    if (out.status !== 0) throw new Error(`the filtered query failed: ${out.status} ${out.code}`);
    h.observe({ seconds: seconds(out.ms), stdoutBytes: out.bytes, entriesReturned: out.json.result.entries.length, nextFrom: out.json.result.nextFromIndex ?? null });
  },

  '3A-JC4': async (h, env) => {
    const s = state(env);
    const out = await ops(['verify', s.ledger]);
    note(env, `verify of ${s.total - 1} entries (real SDK, production store)`, out.json?.ms ?? 0);
    if (!out.json?.ok) throw new Error(`verify failed: ${JSON.stringify(out.json)} ${out.stderr}`);
    const problems = [];
    if (out.json.result.entryCount !== s.total - 1) problems.push(`entryCount ${out.json.result.entryCount}`);
    if (out.json.result.headDigest !== s.generatedHead) problems.push('the head digest differs from the generated chain');
    if (out.json.result.pendingArtifacts !== 0 || (out.json.result.unreferencedRecords ?? []).length !== 0) problems.push('the generated ledger reports anomalies');
    conclude(h, problems, { seconds: seconds(out.json.ms), entryCount: out.json.result.entryCount, peakRssMiB: out.json.heapMiB });
  },

  '3A-JC5': async (h, env) => {
    const s = state(env);
    const file = p(s.dir, 'reference.mip');
    fs.writeFileSync(file, recordById(env, 'mip-reference').members[0].bytes);
    const out = await ops(['append', s.ledger, 'MIP_PACKAGE', 'package.mip', file]);
    note(env, 'append of the last allowed entry (real MIP admission, then publish)', out.json?.ms ?? 0);
    if (!out.json?.ok) throw new Error(`the 100,000th append failed: ${JSON.stringify(out.json)}`);
    const problems = [];
    if (out.json.result.index !== s.total - 1) problems.push(`index ${out.json.result.index}`);
    conclude(h, problems, { seconds: seconds(out.json.ms), index: out.json.result.index });
  },

  '3A-JC6': async (h, env) => {
    const s = state(env);
    s.exportDir = p(s.dir, 'export');
    const out = await ops(['export', s.ledger, s.exportDir]);
    note(env, `export of ${s.total} entries`, out.json?.ms ?? 0);
    if (!out.json?.ok) throw new Error(`the export failed: ${JSON.stringify(out.json)}`);
    const names = fs.readdirSync(s.exportDir);
    const markerLast = names.includes('memoryos-history-export-complete.json') && names.includes('memoryos-history-export.json');
    h.observe({
      outcome: out.json.ms >= Q11_CONFIRMED_AT_MS ? 'CONFIRMED' : 'NOT_CONFIRMED', seconds: seconds(out.json.ms), minutes: Math.round(out.json.ms / 6000) / 10, entryCount: out.json.result.entryCount, markerPresent: markerLast,
      referenceHostSeconds: 1000.9, preRegistered: 'CONFIRMED when the export takes at least 8 minutes (half of the register\'s 16)',
    });
  },

  '3A-JC7': async (h, env) => {
    const s = state(env);
    const out = await ops(['verify-export', s.exportDir]);
    note(env, `verify-export of ${s.total} entries`, out.json?.ms ?? 0);
    if (!out.json?.ok) throw new Error(`verify-export failed: ${JSON.stringify(out.json)}`);
    const problems = [];
    if (out.json.result.entryCount !== s.total) problems.push(`entryCount ${out.json.result.entryCount}`);
    conclude(h, problems, { seconds: seconds(out.json.ms), entryCount: out.json.result.entryCount });
  },

  '3A-JC8': (h, env) => {
    const s = state(env);
    const out = cliRun(['history', 'verify', '--ledger', s.ledger, '--json']);
    note(env, 'real process: memoryos history verify (process start, module load, verification)', out.ms);
    if (out.status !== 0) throw new Error(`the real-process verify failed: ${out.status} ${out.code}`);
    h.observe({ seconds: seconds(out.ms), entryCount: out.json.result.entryCount, headDigest: out.json.result.headDigest, exit: out.status });
  },

  '3A-JC9': (h, env) => {
    const s = state(env);
    const before = fingerprint(s.ledger, s.total);
    const input = p(s.dir, 'checkpoint.json');
    fs.writeFileSync(input, recordById(env, 'checkpoint-c00').members[0].bytes);
    const out = cliRun(['history', 'append', '--ledger', s.ledger, '--kind', 'INVESTIGATION_CHECKPOINT', '--record', input, '--json']);
    note(env, 'the 100,001st append, refused (real CLI)', out.ms);
    const after = fingerprint(s.ledger, s.total);
    const problems = [];
    if (s.total === FULL && (out.status !== 2 || out.code !== 'MO1308_RESOURCE_LIMIT')) problems.push(`the 100,001st append gave ${out.status} ${out.code}`);
    if (JSON.stringify(before) !== JSON.stringify(after)) problems.push('the refused append changed the ledger');
    conclude(h, problems, { seconds: seconds(out.ms), result: `${out.status}:${out.code}`, entries: after.entries, records: after.records });
  },

  '3A-JC10': (h, env) => {
    const s = state(env);
    const problems = verifyCandidate({ repo: env.repo, identity: env.identity, against: 'HEAD', worktree: true });
    const final = cliRun(['history', 'verify', '--ledger', s.ledger, '--json']);
    const head = final.json?.result?.headDigest ?? null; const count = final.json?.result?.entryCount ?? null;
    const removalStarted = Date.now();
    removeTree(env.workRoot, s.ledger);
    if (s.exportDir !== undefined) removeTree(env.workRoot, s.exportDir);
    note(env, 'removal of the ceiling data (not retained)', Date.now() - removalStarted);
    const outside = fs.readdirSync(env.scratch).sort();
    if (JSON.stringify(outside) !== JSON.stringify(s.scratchBefore)) problems.push(`the scratch area changed: ${outside.join(',')}`);
    if (fs.existsSync(s.ledger) || (s.exportDir !== undefined && fs.existsSync(s.exportDir))) problems.push('the ceiling data was not removed');
    const git = spawnSync('git', ['status', '--porcelain'], { cwd: env.repo, encoding: 'utf8' }).stdout.trim();
    if (git !== '') problems.push(`the worktree is not clean: ${git.split('\n')[0]}`);
    if (env.evidenceDir !== null) {
      const directory = p(env.evidenceDir, 'artifacts');
      fs.mkdirSync(directory, { recursive: true });
      const file = p(directory, 'ceiling-timing-table.json');
      if (!fs.existsSync(file)) fs.writeFileSync(file, `${JSON.stringify({ kind: 'MO1308Phase3AJCTimingTable', entries: s.total, timings: s.timings, headDigest: head, entryCount: count, retained: 'digests and timings only' }, null, 2)}\n`, { flag: 'wx' });
    }
    conclude(h, problems, { productionBlobsUnchanged: problems.length === 0, finalHead: head, finalEntryCount: count, retained: 'digests and logs only', timingTable: s.timings.map((row) => `${row.label}: ${row.seconds}s`) });
  },
};
void spawn;
