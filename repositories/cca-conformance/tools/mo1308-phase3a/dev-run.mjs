// Authoring aid: runs cases directly. `node dev-run.mjs '3A-B*'` (VERBOSE=1 prints observations).
import { impls } from './cases.mjs';
import { makeEnv } from './env.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const env = await makeEnv({ root: repo, option: () => null, certifying: false });
const patterns = process.argv.slice(2).map((p) => new RegExp(`^${p.replace(/\*/g, '.*')}$`));
for (const id of Object.keys(impls).filter((id) => patterns.some((p) => p.test(id))).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
  const started = Date.now();
  let observed = null; let skipped = null;
  const handle = { observe: (value) => { observed = value; }, skip: (reason) => { skipped = reason; } };
  try { await impls[id](handle, env); console.log(skipped === null ? 'PASS' : 'SKIP', id, `${Date.now() - started}ms`, skipped ?? ''); } catch (error) { console.log('FAIL', id, `${Date.now() - started}ms`, String(error.message).slice(0, 400)); }
  if (process.env.VERBOSE) console.log(JSON.stringify(observed)?.slice(0, 600));
}
