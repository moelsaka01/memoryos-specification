// MO-1308 Phase 3A: the case environment. One work root per generation, under the worktree's scratch area (git-excluded), kept
// across the segments of the generation: every ledger the cases create is registered (in a journal in the work root) so the
// after-state cases (M1, M4) see the ledgers of every segment; every raw CLI output is hashed into the log index (M3); every
// harness-launched observer is recorded. A destructive harness never touches a path outside the work root.
import fs from 'node:fs';
import path from 'node:path';
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
