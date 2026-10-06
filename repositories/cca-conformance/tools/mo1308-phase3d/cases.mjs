// MO-1308 Phase 3D: the seven integration cases. Each runs the read-only validator once (memoized) and fails with the reasons
// when its case is NOT_READY. On the Windows host after BF this is the validator run; before that every case reports the
// current state honestly, so a rehearsal of 3D is expected to end REHEARSAL_FAILED until the evidence exists.
import path from 'node:path';
import { evaluate } from './validate.mjs';

export async function makeEnv({ root, option, certifying }) {
  const options = { root };
  for (const [flag, key] of [['--a32-receipt', 'a32ReceiptPath'], ['--regression', 'regressionPath'], ['--evidence-root', 'evidenceRoot'], ['--head', 'head']]) {
    const value = option(flag);
    if (value !== null && value !== undefined) options[key] = value;
  }
  return { repo: root, certifying, options, evidenceDir: null, cache: {} };
}

const report = (env) => (env.cache.report ??= evaluate(env.options).report);

function verdictCase(id) {
  return (h, env) => {
    const row = report(env).cases.find((item) => item.id === id);
    h.observe(JSON.parse(JSON.stringify({ status: row.status, observed: row.observed, runResult: report(env).result })));
    if (row.status !== 'READY') throw new Error(`NOT_READY: ${row.problems.slice(0, 5).join('; ')}`);
  };
}

export const impls = Object.fromEntries(['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'].map((id) => [`3D-${id}`, verdictCase(`3D-${id}`)]));
export const hostOnly = {};
void path;
