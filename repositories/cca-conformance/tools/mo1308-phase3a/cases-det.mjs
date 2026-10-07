// MO-1308 Phase 3A steps A (the platform-neutral gate), C (determinism and layout) and M (after-state).
// What needs NTFS (drive, case-insensitive names, file index, code pages) is declared host-only in cases.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CORPUS_WORKSPACE, appendArgs, contract, initArgs, queryArgs, readTree, sha, treeDigest, treeList, tempDir } from './support.mjs';
import { conclude, recordById, register, run, work } from './env.mjs';
import { ledgerWith } from './cases-cli.mjs';
import { verifyCandidate } from '../mo1308-phase3/lib/candidate.mjs';
import { bulkVerify } from './win.mjs';

const IDS = ['mip-reference', 'checkpoint-c00', 'policy-0', 'regression-reference', 'cicd-6', 'cicd-4', 'readiness-ready', 'decision-ready-approve'];
const LAYOUT = contract.MEMORYOS_HISTORY_LAYOUT;
const TIME = [/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/, /\b\d{4}[-/]\d{2}[-/]\d{2}\b/, /(?<![\w.])(?:1[0-9]{9}|1[0-9]{12})(?![\w.])/, /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b[ ,]/];
const stripDigests = (text) => text.replace(/sha256:[0-9a-f]{64}|\b[0-9a-f]{64}\b/g, 'DIGEST');
const authoredFiles = (root) => [...readTree(root)].filter(([relative]) => relative === LAYOUT.descriptor || relative.startsWith('entries/') || /^memoryos-history-export/.test(relative));

// The same operations as `ids`, built from another directory, working directory, environment and time zone.
function twin(env, name, variance) {
  const base = path.join(work(env, 'c'), name);
  fs.mkdirSync(base, { recursive: true });
  const cwd = path.join(base, 'cwd'); fs.mkdirSync(cwd);
  const ledger = path.join(base, 'a', 'b', `ledger-${name}`); fs.mkdirSync(path.dirname(ledger), { recursive: true });
  const options = { cwd, env: variance };
  const init = run(env, initArgs(ledger, 'twin'), options);
  if (init.status !== 0) throw new Error(`twin init ${name}`);
  register(env, ledger);
  IDS.forEach((id) => { const result = run(env, appendArgs(ledger, recordById(env, id), path.join(base, `in-${id}`)), options); if (result.status !== 0) throw new Error(`twin ${name} append ${id}`); });
  return { ledger, options, base };
}
const twins = (env) => (env.cache.twins ??= [
  twin(env, 'one', { TZ: 'UTC', LANG: 'C', LC_ALL: 'C' }),
  twin(env, 'two', { TZ: 'Pacific/Kiritimati', LANG: 'de_DE.UTF-8', LC_ALL: 'de_DE.UTF-8', MEMORYOS_NOISE: 'x'.repeat(2000), NO_COLOR: '1' }),
]);

export const detCases = {
  '3A-A3': (h, env) => {
    const problems = [];
    for (const problem of verifyCandidate({ repo: env.repo, identity: env.identity, against: 'HEAD', worktree: true })) problems.push(problem);
    const status = spawnSync('git', ['status', '--porcelain'], { cwd: env.repo, encoding: 'utf8' }).stdout.trim();
    if (env.certifying && status !== '') problems.push('the worktree is not clean');
    conclude(h, problems, { productionTreeDigest: env.identity.productionTreeDigest, dirtyFiles: status === '' ? 0 : status.split('\n').length });
  },
  '3A-C1': (h, env) => {
    const [one, two] = twins(env);
    const first = readTree(one.ledger); const second = readTree(two.ledger);
    const problems = [];
    if (JSON.stringify([...first.keys()]) !== JSON.stringify([...second.keys()])) problems.push('different file sets');
    for (const [relative, bytes] of first) if (!second.has(relative) || Buffer.compare(bytes, second.get(relative)) !== 0) problems.push(`${relative} differs`);
    conclude(h, problems, { files: first.size, digest: treeDigest(one.ledger) });
  },
  '3A-C2': (h, env) => {
    const [one, two] = twins(env);
    const problems = [];
    const exportOne = path.join(one.base, 'export'); const exportTwo = path.join(two.base, 'export');
    run(env, ['history', 'export', '--ledger', one.ledger, '--output', exportOne, '--json'], one.options);
    run(env, ['history', 'export', '--ledger', two.ledger, '--output', exportTwo, '--json'], two.options);
    if (treeDigest(exportOne) !== treeDigest(exportTwo)) problems.push('the exports differ');
    const same = (args) => { const a = run(env, args(one.ledger), one.options); const b = run(env, args(two.ledger), two.options); return a.stdout === b.stdout && a.stderr === b.stderr && a.status === b.status; };
    if (!same((ledger) => ['history', 'verify', '--ledger', ledger, '--json'])) problems.push('verify outputs differ');
    if (!same((ledger) => ['history', 'verify', '--ledger', ledger])) problems.push('human verify outputs differ');
    if (!same((ledger) => queryArgs(ledger))) problems.push('query outputs differ');
    const verified = run(env, ['history', 'verify-export', '--export', exportOne, '--json'], one.options);
    const verifiedTwo = run(env, ['history', 'verify-export', '--export', exportTwo, '--json'], two.options);
    if (verified.stdout !== verifiedTwo.stdout || verified.status !== 0) problems.push('verify-export outputs differ');
    conclude(h, problems, { exportDigest: treeDigest(exportOne) });
  },
  '3A-C3': (h, env) => {
    const [one] = twins(env);
    const problems = [];
    const top = fs.readdirSync(one.ledger).sort();
    const expected = [LAYOUT.descriptor, LAYOUT.entriesDirectory, LAYOUT.recordsDirectory, LAYOUT.pendingDirectory].sort();
    if (JSON.stringify(top) !== JSON.stringify(expected)) problems.push(`top level ${top.join(',')}`);
    if (fs.readdirSync(path.join(one.ledger, LAYOUT.pendingDirectory)).length !== 0) problems.push('.pending is not empty after successful operations');
    const entries = fs.readdirSync(path.join(one.ledger, LAYOUT.entriesDirectory)).sort();
    if (JSON.stringify(entries) !== JSON.stringify(IDS.map((_, index) => `${String(index).padStart(LAYOUT.entryIndexDigits, '0')}.json`))) problems.push('entry names');
    for (const directory of fs.readdirSync(path.join(one.ledger, LAYOUT.recordsDirectory))) {
      if (!/^[0-9a-f]{64}$/.test(directory)) problems.push(`records/${directory}`);
      for (const member of fs.readdirSync(path.join(one.ledger, LAYOUT.recordsDirectory, directory))) if (!contract.MEMBER_NAMES.includes(member)) problems.push(`member ${member}`);
    }
    conclude(h, problems, { top, entries: entries.length });
  },
  '3A-C4': (h, env) => {
    const [one] = twins(env);
    const problems = [];
    const exportDir = path.join(one.base, 'export-c4');
    run(env, ['history', 'export', '--ledger', one.ledger, '--output', exportDir, '--json'], one.options);
    const texts = [...authoredFiles(one.ledger), ...authoredFiles(exportDir)].map(([name, bytes]) => [name, bytes.toString('utf8')]);
    for (const args of [['history', 'verify', '--ledger', one.ledger], queryArgs(one.ledger), ['history', 'verify', '--ledger', one.ledger, '--json']]) { const result = run(env, args, one.options); texts.push([args.slice(0, 2).join(' '), result.stdout + result.stderr]); }
    for (const [name, text] of texts) for (const pattern of TIME) if (pattern.test(stripDigests(text))) problems.push(`${name}: matches ${pattern}`);
    conclude(h, problems, { scanned: texts.length });
  },
  '3A-C5': (h, env) => {
    const [one] = twins(env);
    const problems = [];
    const descriptor = JSON.parse(fs.readFileSync(path.join(one.ledger, LAYOUT.descriptor), 'utf8'));
    const kinds = new Set();
    for (const name of fs.readdirSync(path.join(one.ledger, LAYOUT.entriesDirectory))) {
      const entry = JSON.parse(fs.readFileSync(path.join(one.ledger, LAYOUT.entriesDirectory, name), 'utf8'));
      if (entry.ledgerIdentifier === undefined) problems.push(`${name}: no ledger identifier`);
      if (entry.entryType !== 'RECORD') continue;
      kinds.add(entry.record.recordKind);
      for (const subject of entry.record.subjects) if (subject.type === 'WORKSPACE' && subject.value !== descriptor.workspaceIdentifier) problems.push(`${name}: a second Workspace`);
      if (!['INTRINSIC', 'DECLARED'].includes(contract.WORKSPACE_ASSOCIATION_BY_KIND[entry.record.recordKind])) problems.push(`${name}: association`);
    }
    for (const kind of kinds) if (contract.WORKSPACE_ASSOCIATION_BY_KIND[kind] === undefined) problems.push(`${kind}: no association`);
    if (Object.values(contract.WORKSPACE_ASSOCIATION_BY_KIND).some((value) => !['INTRINSIC', 'DECLARED'].includes(value))) problems.push('the association table has another value');
    conclude(h, problems, { workspace: descriptor.workspaceIdentifier, kinds: [...kinds].sort() });
  },
  '3A-M1': (h, env) => {
    const problems = [];
    let verified = 0; let corrupt = 0;
    // the latest registration of a path wins (a case registers a ledger when it makes it, and again when it interrupts or corrupts it)
    const latest = new Map();
    for (const row of env.ledgers) latest.set(row.path, row);
    // hundreds of small ledgers: verified in one process by the real SDK and the production store (the CLI verify is the same composition)
    const present = [...latest.values()].filter((row) => fs.existsSync(row.path));
    corrupt = present.filter((row) => row.intentionalCorruption).length;
    const checked = bulkVerify(present.filter((row) => !row.intentionalCorruption).map((row) => row.path), path.join(env.workRoot, 'm1'));
    for (const row of checked) { verified += 1; if (!row.ok) problems.push(`${path.basename(row.path)}: ${row.code}`); }
    conclude(h, problems, { verified, recordedIntentionalCorruptions: corrupt });
  },
  '3A-M2': (h, env) => {
    conclude(h, verifyCandidate({ repo: env.repo, identity: env.identity, against: 'HEAD', worktree: true }), { productionTreeDigest: env.identity.productionTreeDigest });
  },
  '3A-M3': (h, env) => {
    // the raw-log index: a digest per raw CLI output of the campaign; the sealed evidence inventory is the runner's own
    const index = env.log.map((entry, number) => ({ number, ...entry }));
    const problems = index.length === 0 ? ['no raw output was recorded'] : [];
    if (env.evidenceDir !== null) {
      const directory = path.join(env.evidenceDir, 'artifacts'); fs.mkdirSync(directory, { recursive: true });
      const file = path.join(directory, 'raw-log-index.json');
      if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(index), { flag: 'wx' });
    }
    // every observer the harness launched (Python or PowerShell: never the product) is recorded with the hash of the script it ran
    const observers = env.observers.all();
    if (env.evidenceDir !== null) {
      const directory = path.join(env.evidenceDir, 'artifacts'); fs.mkdirSync(directory, { recursive: true });
      const file = path.join(directory, 'observer-launches.json');
      if (!fs.existsSync(file)) fs.writeFileSync(file, `${JSON.stringify(observers.map((row, number) => ({ number, ...row })), null, 2)}
`, { flag: 'wx' });
    }
    for (const row of observers) if (row.observer === 'python' && (typeof row.scriptSha256 !== 'string' || row.scriptSha256.length !== 64)) problems.push(`an observer launch has no script hash: ${row.script}`);
    const byTool = {}; for (const row of observers) byTool[row.observer] = (byTool[row.observer] ?? 0) + 1;
    conclude(h, problems, { rawOutputs: index.length, indexDigest: sha(Buffer.from(JSON.stringify(index))), harnessObserverLaunches: byTool });
  },
  '3A-M4': (h, env) => {
    const problems = [];
    const outside = fs.readdirSync(env.sentinelDir);
    if (JSON.stringify(outside) !== '["sentinel.txt"]' || fs.readFileSync(path.join(env.sentinelDir, 'sentinel.txt'), 'utf8') !== 'untouched') problems.push('the sentinel directory changed');
    for (const { path: ledger } of env.ledgers) if (!path.resolve(ledger).startsWith(path.resolve(env.workRoot) + path.sep)) problems.push(`a ledger outside the work root: ${path.basename(ledger)}`);
    conclude(h, problems, { ledgers: env.ledgers.length, listing: treeList(env.sentinelDir) });
  },
};
void CORPUS_WORKSPACE; void tempDir; void ledgerWith;
