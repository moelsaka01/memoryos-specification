// MO-1308 Phase 3B: the offline smoke driver. It runs a fixed command sequence of the history CLI through real processes, once
// from an extracted closure (only the pinned Node, a stripped environment, no repository around the closure) and once from the
// working tree, so the outputs can be compared byte for byte. Inputs are written from the sealed corpus.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { corpusRecords, CORPUS_WORKSPACE } from '../mo1308-phase3/corpus.mjs';
import { walkRecords } from '../mo1308-phase3/lib/hashing.mjs';

export const SMOKE_LEDGER_NAME = 'p3b-smoke';
const RECORDS = ['policy-0', 'readiness-ready', 'decision-ready-approve'];

export function writeInputs(directory) {
  const byId = new Map(corpusRecords().map((record) => [record.id, record]));
  const member = (id, name) => Buffer.from(byId.get(id).members.find((item) => item.name === name).bytes);
  fs.mkdirSync(directory, { recursive: true });
  const files = {
    identity: path.join(directory, 'evaluation-identity.json'), outcome: path.join(directory, 'policy-outcome.json'),
    readiness: path.join(directory, 'readiness.json'), decision: path.join(directory, 'decision.json'),
  };
  fs.writeFileSync(files.identity, member('policy-0', 'evaluation-identity.json'));
  fs.writeFileSync(files.outcome, member('policy-0', 'policy-outcome.json'));
  fs.writeFileSync(files.readiness, member('readiness-ready', 'memoryos-readiness-result.json'));
  fs.writeFileSync(files.decision, member('decision-ready-approve', 'human-decision.json'));
  void RECORDS;
  return files;
}

export const smokeCommands = (inputs, ledger, exportDirectory) => [
  ['history', 'init', '--ledger', ledger, '--name', SMOKE_LEDGER_NAME, '--workspace', CORPUS_WORKSPACE, '--json'],
  ['history', 'append', '--ledger', ledger, '--kind', 'POLICY_EVALUATION', '--identity', inputs.identity, '--outcome', inputs.outcome, '--json'],
  ['history', 'append', '--ledger', ledger, '--kind', 'READINESS_RESULT', '--record', inputs.readiness, '--json'],
  ['history', 'append', '--ledger', ledger, '--kind', 'HUMAN_DECISION_CLAIM', '--record', inputs.decision, '--json'],
  ['history', 'verify', '--ledger', ledger, '--json'],
  ['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '10', '--json'],
  ['history', 'export', '--ledger', ledger, '--output', exportDirectory, '--json'],
  ['history', 'verify-export', '--export', exportDirectory, '--json'],
];

// The Node permission model flag for the running Node, or null when it has none (used by the C4 runtime proof). The smoke
// itself does not use it: the history store lstat()s every ancestor of its ledger path (H40), which the permission model
// cannot grant without opening the whole subtree, so completeness is proven by construction instead: the closure is extracted
// into a directory with no repository around it.
export function permissionFlag(nodeMajor = Number(process.versions.node.split('.')[0])) {
  if (nodeMajor >= 24) return '--permission';
  if (nodeMajor >= 20) return '--experimental-permission';
  return null;
}

export function runSequence({ nodeExecutable = process.execPath, cliPath, workDirectory, restrict = null }) {
  fs.mkdirSync(workDirectory, { recursive: true });
  const inputs = writeInputs(path.join(workDirectory, 'in'));
  const ledger = path.join(workDirectory, 'ledger');
  const exportDirectory = path.join(workDirectory, 'export');
  const env = { PATH: process.env.PATH ?? '', ...(process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot ?? '' } : {}) };
  const results = smokeCommands(inputs, ledger, exportDirectory).map((args) => {
    const run = spawnSync(nodeExecutable, [cliPath, ...args], { cwd: workDirectory, env, encoding: 'utf8', windowsHide: true, shell: false });
    return { command: args[1], status: run.status, stdout: run.stdout, stderr: run.stderr };
  });
  return { results, ledger, exportDirectory, ledgerFiles: fs.existsSync(ledger) ? walkRecords(ledger) : [], exportFiles: fs.existsSync(exportDirectory) ? walkRecords(exportDirectory) : [] };
}
