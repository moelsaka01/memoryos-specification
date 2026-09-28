// Finite command receipt runner: each directory is exclusive; failures retained.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
const [directory, executable, ...args] = process.argv.slice(2);
if (!directory || !executable) throw new Error('explicit directory/executable required');
fs.mkdirSync(directory, { recursive: false });
const started = performance.now();
const answer = spawnSync(executable, args, { cwd: process.cwd(), encoding: null, timeout: 60000, maxBuffer: 16*1024*1024, windowsHide: true });
const stdout = answer.stdout ?? Buffer.alloc(0), stderr = answer.stderr ?? Buffer.alloc(0);
fs.writeFileSync(path.join(directory, 'stdout.txt'), stdout); fs.writeFileSync(path.join(directory, 'stderr.txt'), stderr);
const out = stdout.toString('utf8'), counter = name => Number(new RegExp('^# ' + name + ' (\\d+)$', 'm').exec(out)?.[1] ?? 0);
const receipt = { kind: 'MO1307Phase2CCommandReceipt', executable, args, elapsedMs: performance.now()-started,
  exit: answer.status, error: answer.error?.code ?? null, tests: { count: counter('tests'), pass: counter('pass'), fail: counter('fail'), cancelled: counter('cancelled'), skipped: counter('skipped') },
  stdoutSha256: createHash('sha256').update(stdout).digest('hex'), stderrSha256: createHash('sha256').update(stderr).digest('hex'),
  result: answer.status === 0 && !answer.error ? 'PASS' : 'FAIL' };
fs.writeFileSync(path.join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2)+'\n');
process.stdout.write(JSON.stringify(receipt)+'\n'); process.exitCode = answer.status === 0 && !answer.error ? 0 : 1;
