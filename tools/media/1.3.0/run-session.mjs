// Runs every step of session-plan.mjs for real in the scratch workspace and records stdout, stderr and the exit code.
//   node tools/media/run-session.mjs DEMO_DIRECTORY TRANSCRIPT_FILE
// DEMO_DIRECTORY must already hold records/ and policy/ (prepare-records.mjs); ledger, export and dashboard are created here.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [demo, transcriptFile] = process.argv.slice(2, 4).map((p) => path.resolve(p));
const { STEPS } = await import(pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), process.argv[4] || 'session-plan.mjs')).href);
const cli = path.join(repo, 'repositories/memoryos-cli/bin/memoryos.js');
const GIT_USR_BIN = 'C:/Program Files/Git/usr/bin';
const tool = (name) => (fs.existsSync(`${GIT_USR_BIN}/${name}.exe`) ? `${GIT_USR_BIN}/${name}.exe` : name);
for (const stale of ['ledger', 'ledger-tampered', 'export', 'dashboard.html', 'out']) fs.rmSync(path.join(demo, stale), { recursive: true, force: true });
fs.mkdirSync(path.join(demo, 'out'), { recursive: true });

const transcript = [];
for (const step of STEPS) {
  let command;
  let args;
  let display;
  if (step.cli) {
    command = process.execPath;
    args = [cli, ...step.cli];
    display = `memoryos ${step.cli.join(' ')}`;
  } else if (step.repoNode) {
    command = process.execPath;
    args = [path.join(repo, step.repoNode[0]), ...step.repoNode.slice(1)];
    display = step.display;
  } else {
    command = tool(step.exec[0]);
    args = step.exec.slice(1);
    display = step.exec.map((a) => (/[\s"\\|]/.test(a) ? `'${a}'` : a)).join(' ');
  }
  const cwd = step.cwd === 'repo' ? repo : demo;
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP };
  const run = spawnSync(command, args, { cwd, encoding: 'utf8', env, maxBuffer: 1 << 26 });
  let stdout = run.stdout ?? '';
  if (step.uniq) stdout = `${[...new Set(stdout.split('\n').filter(Boolean))].sort().join('\n')}\n`;
  const policyExit = step.cli && step.cli[0] === 'policy' && [6, 7].includes(run.status);
  if (!(run.status === 0 || step.allowFail || policyExit)) throw new Error(`step failed (${run.status}): ${display}\n${run.stderr}`);
  transcript.push({ scene: step.scene, display, exit: run.status, stdout, stderr: run.stderr ?? '' });
  console.log(`[${run.status}] ${display.slice(0, 110)}`);
}
fs.writeFileSync(transcriptFile, JSON.stringify({ node: process.version, steps: transcript }, null, 1));
console.log(`wrote ${transcript.length} steps to ${transcriptFile}`);
