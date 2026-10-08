// MO-1308 Phase 3D: the preconditions of the one-shot retained regression (case 3D-D4, A8.10). The MO-1307 suite runs once, strictly 639/639,
// with its F22 test unchanged and no test re-run (D5). It runs in a fresh worktree with no `.cache/mo1307` leftovers (a stale
// `focused-<pid>` directory of an earlier run can fail F22's setup), on a quiet host, and the record carries what was observed:
//   preconditions: { freshWorktree, mo1307CacheBeforeRun: 'ABSENT'|'EMPTY', loadSample: { cpuPercent, sampledMs, logicalCpus }, f22DurationMs, retries }
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const MO1307_CACHE = '.cache/mo1307';
export const QUIET_CPU_PERCENT = 20;

// 'ABSENT' | 'EMPTY' | 'NOT_EMPTY' for the MO-1307 cache tree of a worktree.
export function mo1307CacheState(worktree) {
  const directory = path.join(worktree, ...MO1307_CACHE.split('/'));
  if (!fs.existsSync(directory)) return 'ABSENT';
  const entries = fs.readdirSync(directory, { recursive: true });
  return entries.length === 0 ? 'EMPTY' : 'NOT_EMPTY';
}

// Average CPU use of the whole host over `sampledMs` (recorded, and compared with QUIET_CPU_PERCENT by the caller).
export async function loadSample(sampledMs = 2000) {
  const total = () => os.cpus().reduce((sum, cpu) => ({ idle: sum.idle + cpu.times.idle, all: sum.all + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq }), { idle: 0, all: 0 });
  const before = total();
  await new Promise((resolve) => setTimeout(resolve, sampledMs));
  const after = total();
  const all = after.all - before.all;
  return { cpuPercent: all > 0 ? Math.round((1 - (after.idle - before.idle) / all) * 1000) / 10 : 0, sampledMs, logicalCpus: os.cpus().length };
}

// The reported duration of the F22 test in a node:test log (spec reporter), in milliseconds, or null.
export function f22DurationMs(logText) {
  const match = /^\s*[✔✖]\s+F22\b.*\(([0-9]+(?:\.[0-9]+)?)ms\)\s*$/mu.exec(logText);
  return match === null ? null : Number(match[1]);
}

// The `preconditions` member for a regression record. Throws when a precondition does not hold: the run must not start.
export async function captureRegressionPreconditions({ worktree, requireQuiet = true }) {
  const mo1307CacheBeforeRun = mo1307CacheState(worktree);
  if (mo1307CacheBeforeRun === 'NOT_EMPTY') throw new Error(`${MO1307_CACHE} is not empty in ${worktree}: the regression needs a fresh worktree`);
  const sample = await loadSample();
  if (requireQuiet && sample.cpuPercent > QUIET_CPU_PERCENT) throw new Error(`the host is not quiet: ${sample.cpuPercent}% CPU over ${sample.sampledMs} ms (limit ${QUIET_CPU_PERCENT}%)`);
  return { freshWorktree: true, mo1307CacheBeforeRun, loadSample: sample, f22DurationMs: null, retries: 0 };
}
