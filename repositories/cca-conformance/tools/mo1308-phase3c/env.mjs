// MO-1308 Phase 3C: the case environment shared by every case file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { corpusRecords, sampleIndices, SEEDS, CANARIES } from '../mo1308-phase3/corpus.mjs';
import { RECIPES, buildRecipe } from '../mo1308-phase3/corpus.mjs';

export async function makeEnv({ root, option, certifying }) {
  const env = {
    repo: root, certifying, evidenceDir: null, cache: {}, temporary: [],
  };
  process.on('exit', () => { for (const directory of env.temporary) fs.rmSync(directory, { recursive: true, force: true }); });
  return env;
}

export const work = (env, prefix = 'mo1308-p3c-') => { const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); env.temporary.push(directory); return directory; };
export const memo = (env, key, make) => (env.cache[key] ??= make());
export const records = (env) => memo(env, 'records', () => corpusRecords());
export const recordById = (env, id) => records(env).find((record) => record.id === id);
export const recipe = (env, id) => memo(env, `recipe-${id}`, () => buildRecipe(RECIPES.find((item) => item.id === id), records(env)));
export const seed = (name) => SEEDS[name];
export { sampleIndices, CANARIES };

// Records the observation, then fails the case with the first problems found.
export function conclude(handle, problems, observed = {}) {
  handle.observe(JSON.parse(JSON.stringify(observed)));
  if (problems.length > 0) throw new Error(`${problems.length} problem(s): ${problems.slice(0, 6).join('; ')}`);
}

export function writeArtifact(env, name, bytes) {
  if (env.evidenceDir === null) return null;
  const directory = path.join(env.evidenceDir, 'artifacts');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, name), bytes, { flag: 'wx' });
  return `artifacts/${name}`;
}
