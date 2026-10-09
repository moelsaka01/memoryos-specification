// Retained regression (3D-D4, A8.10): one run of each suite, no retries. Writes the record and raw logs outside the worktree.
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const wt = process.argv[2]; const out = process.argv[3];
const { captureRegressionPreconditions, f22DurationMs } = await import(`file:///${wt.split(String.fromCharCode(92)).join("/")}/repositories/cca-conformance/tools/mo1308-phase3d/regression-preconditions.mjs`);
const git = (...a) => spawnSync('git', a, { cwd: wt, encoding: 'utf8' }).stdout.trim();
const commit = git('rev-parse', 'HEAD');
const identity = JSON.parse(fs.readFileSync(path.join(wt, 'repositories/cca-conformance/mo1308-phase3-candidate-identity.json'), 'utf8'));
const studioScript = JSON.parse(fs.readFileSync(path.join(wt, 'repositories/cca-studio/package.json'), 'utf8')).scripts.test.split(/\s+/).slice(2);
const suites = [
  { name: 'mo1307', cwd: 'repositories/cca-conformance', args: ['--test', '--test-concurrency=1', 'tests/mo1307_*_test.mjs'] },
  { name: 'mo1308', cwd: 'repositories/cca-conformance', args: ['--test', '--test-concurrency=1', 'tests/mo1308_*_test.mjs'] },
  { name: 'cli', cwd: 'repositories/memoryos-cli', args: ['--test', '--test-concurrency=1', 'tests/*.test.mjs'] },
  { name: 'studio', cwd: 'repositories/cca-studio', args: ['--test', ...studioScript] },
  { name: 'examples', cwd: 'repositories/memoryos-cli', args: ['examples/run-cli-examples.mjs'] },
];
const only = process.argv[4] ? process.argv[4].split(',') : null;
const record = { kind: 'MO1308Phase3RegressionRecord', version: '1.0.0', commit, candidate: { productionTreeDigest: identity.productionTreeDigest }, suites: [], preconditions: null };
const partial = path.join(out, 'partial.json');
const run = (suite) => new Promise((resolve) => {
  const log = path.join(out, 'logs', `${suite.name}.log`);
  const fd = fs.openSync(log, 'w');
  const child = spawn(process.execPath, suite.args, { cwd: path.join(wt, suite.cwd), stdio: ['ignore', fd, fd], windowsHide: true });
  child.on('close', (code) => { fs.closeSync(fd); resolve({ code, log }); });
});
for (const suite of suites) {
  if (only && !only.includes(suite.name)) continue;
  if (suite.name === 'mo1307') record.preconditions = await captureRegressionPreconditions({ worktree: wt });
  const started = Date.now();
  const { code, log } = await run(suite);
  const bytes = fs.readFileSync(log);
  const text = bytes.toString('utf8');
  const n = (label) => { const m = new RegExp(`^ℹ ${label} ([0-9]+)`, 'm').exec(text); return m ? Number(m[1]) : null; };
  let total = n('tests'); let passed = n('pass'); let failed = n('fail'); const skipped = n('skipped') ?? 0;
  if (suite.name === 'examples') { passed = (text.match(/^PASS /gm) ?? []).length; failed = (text.match(/^FAIL /gm) ?? []).length + (/All MemoryOS CLI examples passed./.test(text) ? 0 : 1); total = passed + failed; }
  const row = { name: suite.name, runner: 'node --test', passed, failed, skipped, total, exitCode: code, logSha256: crypto.createHash('sha256').update(bytes).digest('hex'), elapsedSeconds: Math.round((Date.now() - started) / 1000) };
  record.suites.push(row);
  if (suite.name === 'mo1307') record.preconditions.f22DurationMs = f22DurationMs(text);
  fs.writeFileSync(partial, JSON.stringify(record, null, 2));
  console.log(JSON.stringify(row));
}
fs.writeFileSync(path.join(out, 'regression.json'), `${JSON.stringify(record, null, 2)}\n`);
