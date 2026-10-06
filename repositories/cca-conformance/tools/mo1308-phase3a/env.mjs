// MO-1308 Phase 3A (platform-neutral part): the case environment. One work root per generation; every ledger the cases create is
// registered so the after-state cases (M1, M4) can check them; every raw CLI output is hashed into the log index (M3).
import fs from 'node:fs';
import path from 'node:path';
import { corpusRecords } from '../mo1308-phase3/corpus.mjs';
import { cli as rawCli, tempDir } from './support.mjs';

export async function makeEnv({ root, option, certifying }) {
  const workRoot = tempDir('mo1308-p3a-work-');
  const env = {
    repo: root, certifying, identity: JSON.parse(fs.readFileSync(path.join(root, 'repositories/cca-conformance/mo1308-phase3-candidate-identity.json'), 'utf8')), evidenceDir: null, cache: {}, temporary: [workRoot], workRoot, log: [],
    // [{path, intentionalCorruption}] ledgers created by the campaign (3A-M1)
    ledgers: [],
    // a path outside the work root that no case may touch (3A-M4)
    sentinelDir: tempDir('mo1308-p3a-sentinel-'),
  };
  env.temporary.push(env.sentinelDir);
  fs.writeFileSync(path.join(env.sentinelDir, 'sentinel.txt'), 'untouched');
  void option;
  process.on('exit', () => { for (const directory of env.temporary) fs.rmSync(directory, { recursive: true, force: true }); });
  return env;
}

export const work = (env, name) => { const directory = path.join(env.workRoot, name); fs.mkdirSync(directory, { recursive: true }); return directory; };
export const records = (env) => (env.cache.records ??= corpusRecords());
export const recordById = (env, id) => records(env).find((record) => record.id === id);
export const run = (env, args, options = {}) => rawCli(args, { ...options, log: env.log });
export const register = (env, ledger, intentionalCorruption = false) => { env.ledgers.push({ path: ledger, intentionalCorruption }); return ledger; };

export function conclude(handle, problems, observed = {}) {
  handle.observe(JSON.parse(JSON.stringify(observed)));
  if (problems.length > 0) throw new Error(`${problems.length} problem(s): ${problems.slice(0, 6).join('; ')}`);
}
