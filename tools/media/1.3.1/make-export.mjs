// MemoryOS 1.3.1 release media: builds a history ledger and its export with the released CLI, with exactly the commands shown on screen
// (scenes/terminal-export.mjs types the same list). Used to (re)create the folders Studio opens when the terminal take is not re-recorded,
// and to check that the same records always give the same bytes.
//   node tools/media/make-export.mjs WORKSPACE_DIRECTORY      (WORKSPACE_DIRECTORY holds records/ from prepare-records.mjs)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const HISTORY_COMMANDS = [
  'memoryos history init --ledger ledger --name release-investigation --workspace workspace-investigation',
  'memoryos history append --ledger ledger --kind MIP_PACKAGE --record records/mip-reference/package.mip',
  'memoryos history append --ledger ledger --kind INVESTIGATION_CHECKPOINT --record records/checkpoint-c00/checkpoint.json',
  'memoryos history append --ledger ledger --kind INVESTIGATION_CHECKPOINT --record records/checkpoint-c01/checkpoint.json',
  'memoryos history append --ledger ledger --kind INVESTIGATION_CHECKPOINT --record records/checkpoint-c02/checkpoint.json',
  'memoryos history append --ledger ledger --kind POLICY_EVALUATION --identity records/policy-0/evaluation-identity.json --outcome records/policy-0/policy-outcome.json',
  'memoryos history append --ledger ledger --kind POLICY_EVALUATION --identity records/policy-1/evaluation-identity.json --outcome records/policy-1/policy-outcome.json',
  'memoryos history append --ledger ledger --kind REGRESSION_REPORT --record records/regression-reference/regression-report.json',
  'memoryos history append --ledger ledger --kind CICD_RUN --run records/cicd-6',
  'memoryos history append --ledger ledger --kind READINESS_RESULT --record records/readiness-ready/memoryos-readiness-result.json',
  'memoryos history append --ledger ledger --kind HUMAN_DECISION_CLAIM --record records/decision-ready-approve/human-decision.json',
  'memoryos history append --ledger ledger --kind READINESS_RESULT --record records/readiness-not-ready/memoryos-readiness-result.json',
  'memoryos history append --ledger ledger --kind HUMAN_DECISION_CLAIM --record records/decision-not-ready-approve/human-decision.json',
  'memoryos history verify --ledger ledger',
  'memoryos history tombstone --ledger ledger --target 2 --reason OPERATOR_CORRECTION --authority-reference EXAMPLE-REF-001',
  'memoryos history export --ledger ledger --output export',
  'memoryos history verify-export --export export',
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cli = path.join(root, 'repositories/memoryos-cli/bin/memoryos.js');

export function runHistory(workspace, commands = HISTORY_COMMANDS) {
  for (const stale of ['ledger', 'export', 'export-tampered']) fs.rmSync(path.join(workspace, stale), { recursive: true, force: true });
  const results = [];
  for (const command of commands) {
    const args = command.split(' ').slice(1);
    const run = spawnSync(process.execPath, [cli, ...args], { cwd: workspace, encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP } });
    results.push({ command, exit: run.status, stdout: run.stdout, stderr: run.stderr });
    if (run.status !== 0) throw new Error(`failed (${run.status}): ${command}\n${run.stderr}`);
  }
  return results;
}

export function treeDigest(directory) {
  const hash = crypto.createHash('sha256');
  const walk = (dir) => fs.readdirSync(dir).sort().forEach((name) => {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else { hash.update(path.relative(directory, full).replaceAll('\\', '/')); hash.update(fs.readFileSync(full)); }
  });
  walk(directory);
  return hash.digest('hex');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const workspace = path.resolve(process.argv[2] ?? '');
  const results = runHistory(workspace);
  for (const r of results) console.log(`[${r.exit}] ${r.command.slice(0, 100)}`);
  console.log(`export tree sha256 ${treeDigest(path.join(workspace, 'export'))}`);
}
