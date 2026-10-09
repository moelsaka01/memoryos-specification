// MO-1308 Phase 3A: the case environment. One work root per generation, under the worktree's scratch area (git-excluded), kept
// across the segments of the generation: every ledger the cases create is registered (in a journal in the work root) so the
// after-state cases (M1, M4) see the ledgers of every segment; every raw CLI output is hashed into the log index (M3); every
// harness-launched observer is recorded. A destructive harness never touches a path outside the work root.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { corpusRecords } from '../mo1308-phase3/corpus.mjs';
import { cli as rawCli } from './support.mjs';
import { isWin, removeTree } from './win.mjs';

export const SCRATCH = '.p3a-work';

// A journal-backed list: push appends a line, all() reads every line back (so a later segment's process sees the earlier ones).
function journal(workRoot, name) {
  const file = path.join(workRoot, `.journal-${name}.jsonl`);
  return {
    push(row) { fs.appendFileSync(file, `${JSON.stringify(row)}\n`); },
    all() { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : []; },
    get length() { return this.all().length; },
    map(callback) { return this.all().map(callback); },
  };
}

export async function makeEnv({ root, option, certifying }) {
  const tag = option('--generation') ?? `rehearsal-r${option('--number') ?? 1}`;
  const scratch = path.join(root, SCRATCH);
  fs.mkdirSync(scratch, { recursive: true });
  const workRoot = path.join(scratch, tag);
  fs.mkdirSync(workRoot, { recursive: true });
  // The sentinel directory is a sibling of the work root inside the scratch area: no case may touch it (3A-M4).
  const sentinelDir = path.join(scratch, `${tag}-sentinel`);
  fs.mkdirSync(sentinelDir, { recursive: true });
  if (!fs.existsSync(path.join(sentinelDir, 'sentinel.txt'))) fs.writeFileSync(path.join(sentinelDir, 'sentinel.txt'), 'untouched');
  const ledgerJournal = journal(workRoot, 'ledgers');
  const env = {
    repo: root, certifying, tag, scratch, identity: JSON.parse(fs.readFileSync(path.join(root, 'repositories/cca-conformance/mo1308-phase3-candidate-identity.json'), 'utf8')),
    evidenceDir: null, cache: {}, temporary: [], workRoot, sentinelDir, isWin,
    log: journal(workRoot, 'raw-log'), observers: journal(workRoot, 'observers'),
    // journal of {path, intentionalCorruption, interrupted} for ledgers created by the campaign (3A-M1, 3A-K4)
    ledgerJournal,
    get ledgers() { return ledgerJournal.all(); },
  };
  // A rehearsal that ended well removes its work root (a failed one keeps it for the diagnosis); a certifying generation is cleaned by `cleanup`.
  if (!certifying && tag.startsWith('rehearsal')) process.on('exit', (code) => { if (code === 0) cleanupEnv(env); });
  return env;
}

// Removes the work root and the sentinel directory (links first, never through a link, never outside the scratch area).
export function cleanupEnv(env) {
  removeTree(env.scratch, env.workRoot);
  removeTree(env.scratch, env.sentinelDir);
}

export const work = (env, name) => { const directory = path.join(env.workRoot, name); fs.mkdirSync(directory, { recursive: true }); return directory; };
export const records = (env) => (env.cache.records ??= corpusRecords());
export const recordById = (env, id) => records(env).find((record) => record.id === id);
export const run = (env, args, options = {}) => rawCli(args, { ...options, log: env.log });
export const register = (env, ledger, intentionalCorruption = false, { interrupted = false } = {}) => { env.ledgerJournal.push({ path: ledger, intentionalCorruption, interrupted }); return ledger; };

export function conclude(handle, problems, observed = {}) {
  handle.observe(JSON.parse(JSON.stringify(observed)));
  if (problems.length > 0) throw new Error(`${problems.length} problem(s): ${problems.slice(0, 6).join('; ')}`);
}

// The clean-tree check (3A-A3, 3A-JC10): `git status --porcelain` over the worktree, ignoring EXACTLY the running generation's own evidence
// directory (note A8.12; the directory is protected by its own seal) and nothing else. Every untracked, modified or deleted path anywhere else
// is returned: a sibling generation's directory, a file next to the evidence directory, a modified tracked file. Untracked files are listed one
// by one (-uall) so a collapsed directory entry can never hide a stray file, and -z keeps odd file names exact.
export function porcelainOutside(entries, excludedRelative, caseInsensitive = isWin) {
  const fold = (value) => (caseInsensitive ? value.toLowerCase() : value);
  const excluded = excludedRelative === null ? null : fold(excludedRelative.split(path.sep).join('/').replace(/\/+$/, ''));
  const inside = (file) => {
    if (excluded === null || excluded === '' || excluded === '..' || excluded.startsWith('../')) return false;
    const candidate = fold(file.replace(/\/+$/, ''));
    return candidate === excluded || candidate.startsWith(`${excluded}/`);
  };
  const lines = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry === '') continue;
    const status = entry.slice(0, 2); const file = entry.slice(3);
    const files = [file];
    if (status[0] === 'R' || status[0] === 'C' || status[1] === 'R' || status[1] === 'C') { index += 1; files.push(entries[index] ?? ''); }
    if (files.every(inside)) continue;
    lines.push(`${status} ${files.join(' <- ')}`);
  }
  return lines;
}

export function worktreePorcelain(env) {
  const result = spawnSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { cwd: env.repo, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (result.status !== 0) return [`git status failed: ${String(result.stderr).trim()}`];
  const relative = env.evidenceDir === null ? null : path.relative(env.repo, path.resolve(env.evidenceDir));
  return porcelainOutside(result.stdout.split('\0'), relative);
}
