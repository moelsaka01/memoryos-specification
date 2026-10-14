#!/usr/bin/env node
// Development aid: run chosen 3C cases directly (no seal, no evidence) and print result, time and observation.
//   node dev-run.mjs 3C-A1 3C-A2 ...   (all cases of a step: 3C-A*)
import { impls, makeEnv } from './cases.mjs';
import { repositoryRoot } from '../mo1308-phase3/lib/git.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = repositoryRoot(path.dirname(fileURLToPath(import.meta.url)));
const env = await makeEnv({ root, option: () => null, certifying: false });
const wanted = process.argv.slice(2).flatMap((pattern) => (pattern.endsWith('*') ? Object.keys(impls).filter((id) => id.startsWith(pattern.slice(0, -1))) : [pattern]));
for (const id of wanted) {
  const observed = {};
  const handle = { signal: new AbortController().signal, observe: (values) => Object.assign(observed, values), escalate: (reason) => { observed.ESCALATED = reason; }, skip: (reason) => { observed.SKIPPED = reason; } };
  const start = Date.now();
  let result = 'PASS';
  let detail = '';
  try { await impls[id](handle, env); } catch (error) { result = 'FAIL'; detail = String(error.message).slice(0, 400); }
  console.log(`${result} ${id} ${Date.now() - start}ms ${detail}`);
  if (process.env.VERBOSE) console.log(JSON.stringify(observed).slice(0, 600));
}
