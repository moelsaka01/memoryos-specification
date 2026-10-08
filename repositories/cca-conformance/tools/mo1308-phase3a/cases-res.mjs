// MO-1308 Phase 3A step K: resources and process (R37). Every product operation runs as a real CLI process under the observation preload
// (child_process, net, dns and worker counters; open-file table at exit), is stopped by the preload at its exit, and is read from outside by
// a Python observer (open handle count, memory, descendant processes) and by netstat (sockets of that pid) before it is let go. The first
// case of the step proves the preload is a no-op when disarmed, so that what it reports can be trusted. PowerShell may be used by the harness
// (and every launch is recorded); the product must never launch it.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CLI, appendArgs, initArgs, treeDigest } from './support.mjs';
import { conclude, recordById, register, run, work } from './env.mjs';
import { HERE, PRELOAD, bulkVerify, pathToFileHrefOf, pausedCli, runPython, sha256, waitForFile, writePlan } from './win.mjs';

const p = (...parts) => path.join(...parts);
const MODE = { children: true, exitCensus: true, exitPause: true };
const exists = (target) => { try { fs.lstatSync(target); return true; } catch { return false; } };
const spawnNode = (args, env = {}) => spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, shell: false, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env } });

// One operation under observation: returns the preload census, the outside observer's view and the sockets of the pid.
async function observed(env, name, args) {
  const dir = p(work(env, 'k'), name);
  const controller = pausedCli(env, CLI, args, { dir, mode: MODE });
  const reached = await waitForFile(p(dir, `exit-${controller.pid}.reached`), 60000, { abort: () => controller.child.exitCode !== null });
  let outside = null; let sockets = null;
  if (reached) {
    outside = runPython(env, 'proc.py', [String(controller.pid)], { purpose: `process census of ${name} (3A-K1..K3)` }).json;
    const netstat = spawnSync('netstat.exe', ['-ano'], { encoding: 'utf8', windowsHide: true, shell: false });
    env.observers.push({ observer: 'netstat', purpose: `sockets of ${name} (3A-K2)`, status: netstat.status, signal: null });
    sockets = String(netstat.stdout).split('\n').filter((line) => /^\s*(TCP|UDP)/u.test(line) && line.trim().split(/\s+/u).at(-1) === String(controller.pid));
    fs.writeFileSync(p(dir, `exit-${controller.pid}.go`), 'go');
  }
  const closed = await controller.closed;
  return { name, args: args.slice(0, 2).join(' '), reached, exitCode: closed.code, census: controller.census(), outside, sockets };
}

// The representative operation set, run once and shared by K1-K3.
async function operationSet(env) {
  if (env.cache.operationSet !== undefined) return env.cache.operationSet;
  const base = work(env, 'kops');
  const ledger = p(base, 'ledger');
  const input = (id) => appendArgs(ledger, recordById(env, id), p(work(env, 'in'), `k-${id}`));
  const rows = [];
  const ops = [
    ['init', initArgs(ledger, 'k')], ['append checkpoint', input('checkpoint-c00')], ['append policy', input('policy-0')], ['append cicd (6 files)', input('cicd-6')],
    ['append readiness', input('readiness-ready')], ['append decision', input('decision-ready-approve')], ['append mip', input('mip-reference')],
    ['verify', ['history', 'verify', '--ledger', ledger, '--json']], ['query', ['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '100', '--json']],
    ['export', ['history', 'export', '--ledger', ledger, '--output', p(base, 'export'), '--json']], ['verify-export', ['history', 'verify-export', '--export', p(base, 'export'), '--json']],
    ['tombstone', ['history', 'tombstone', '--ledger', ledger, '--target', '1', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A-K', '--json']],
    ['a refused command', ['history', 'verify', '--ledger', p(base, 'no-ledger'), '--json']],
  ];
  for (const [name, args] of ops) rows.push(await observed(env, name.replace(/\W+/g, '-'), args));
  register(env, ledger);
  env.cache.operationSet = { ledger, rows };
  return env.cache.operationSet;
}

export const resourceCases = {
  '3A-K1': async (h, env) => {
    const problems = [];
    // 1. the preload is a no-op when disarmed: the probe sees identical function sources with and without it, and a different digest when armed
    const probe = p(HERE, 'preload-probe.mjs');
    const plain = JSON.parse(spawnNode([probe]).stdout || '{}');
    const disarmed = JSON.parse(spawnNode(['--import', pathToFileHrefOf(PRELOAD), probe]).stdout || '{}');
    const armedPlan = writePlan(p(work(env, 'k1'), 'armed'), { mode: { errors: true, children: true, events: true } });
    const armed = JSON.parse(spawnNode(['--import', pathToFileHrefOf(PRELOAD), probe], { P3A_PLAN: armedPlan }).stdout || '{}');
    if (!plain.digest || plain.digest !== disarmed.digest) problems.push('the disarmed preload changed a function the probe watches');
    if (!armed.digest || armed.digest === plain.digest) problems.push('the probe cannot see an armed preload (its control failed)');
    if (disarmed.exitListeners !== plain.exitListeners) problems.push('the disarmed preload registered an exit listener');
    // ... and its output and its writes are byte-identical: twin ledgers built with and without it, and the same reads
    const twin = (label, withPreload) => {
      const directory = p(work(env, 'k1'), label);
      fs.mkdirSync(directory);
      const ledger = p(directory, 'ledger');
      const nodeArgs = withPreload ? ['--import', pathToFileHrefOf(PRELOAD)] : [];
      const outputs = [];
      for (const args of [initArgs(ledger, 'k1'), appendArgs(ledger, recordById(env, 'checkpoint-c00'), p(directory, 'in0')), appendArgs(ledger, recordById(env, 'cicd-4'), p(directory, 'in1')),
        ['history', 'verify', '--ledger', ledger, '--json'], ['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '10', '--json']]) {
        const out = spawnNode([...nodeArgs, CLI, ...args]);
        outputs.push(`${out.status}|${sha256(Buffer.from(out.stdout))}|${sha256(Buffer.from(out.stderr))}`);
      }
      return { tree: treeDigest(ledger), outputs };
    };
    const without = twin('without', false); const with_ = twin('with', true);
    if (without.tree !== with_.tree) problems.push('a ledger built with the disarmed preload differs from one built without it');
    if (JSON.stringify(without.outputs) !== JSON.stringify(with_.outputs)) problems.push('command outputs differ with the disarmed preload');
    // 2. no product operation creates a child process
    const { rows } = await operationSet(env);
    const children = {};
    for (const row of rows) {
      if (!row.reached) { problems.push(`${row.name}: the observation preload did not report`); continue; }
      const counted = row.census?.counts?.childProcess ?? 0;
      const descendants = (row.outside?.descendants ?? []).filter((item) => !/^conhost\.exe$/iu.test(item.image));
      children[row.name] = { counted, descendants: descendants.map((item) => item.image) };
      if (counted !== 0) problems.push(`${row.name}: the product called a child_process function ${counted} times`);
      if (descendants.length > 0) problems.push(`${row.name}: descendant processes exist: ${descendants.map((item) => item.image).join(', ')}`);
      if (descendants.some((item) => /powershell|pwsh/iu.test(item.image))) problems.push(`${row.name}: PowerShell was launched`);
    }
    conclude(h, problems, { disarmedNoOp: { probeDigest: plain.digest?.slice(0, 16), functionsWatched: plain.functions, identicalWithDisarmedPreload: plain.digest === disarmed.digest, controlDiffersWhenArmed: armed.digest !== plain.digest, twinLedgersIdentical: without.tree === with_.tree }, operations: rows.length, children });
  },

  '3A-K2': async (h, env) => {
    const problems = [];
    const { rows } = await operationSet(env);
    const seen = {};
    for (const row of rows) {
      const counts = row.census?.counts ?? {};
      seen[row.name] = { network: counts.networkConnections ?? 0, dns: counts.dnsLookups ?? 0, workers: counts.workerThreads ?? 0, sockets: row.sockets?.length ?? null };
      if ((counts.networkConnections ?? 0) !== 0) problems.push(`${row.name}: ${counts.networkConnections} network calls`);
      if ((counts.dnsLookups ?? 0) !== 0) problems.push(`${row.name}: ${counts.dnsLookups} name resolutions`);
      if (row.sockets === null) problems.push(`${row.name}: no socket observation`);
      else if (row.sockets.length > 0) problems.push(`${row.name}: netstat shows sockets for the process: ${row.sockets[0].trim()}`);
    }
    conclude(h, problems, { seen });
  },

  '3A-K3': async (h, env) => {
    const problems = [];
    const { rows } = await operationSet(env);
    const census = rows.map((row) => ({
      operation: row.name, exit: row.exitCode, handleCountAtExit: row.outside?.handleCount ?? null, workingSetMiB: row.outside ? Math.round(row.outside.workingSetBytes / 1048576 * 10) / 10 : null,
      peakWorkingSetMiB: row.outside ? Math.round(row.outside.peakWorkingSetBytes / 1048576 * 10) / 10 : null, pagefileMiB: row.outside ? Math.round(row.outside.pagefileBytes / 1048576 * 10) / 10 : null,
      maxRssKiB: row.census?.resource?.maxRSS ?? null, filesOpenedAndNotClosed: (row.census?.openFds ?? []).length, activeResourcesAtExit: row.census?.activeResources ?? null,
    }));
    for (const row of census) if (row.filesOpenedAndNotClosed > 0) problems.push(`${row.operation}: ${row.filesOpenedAndNotClosed} file handles were still open at exit`);
    // after exit no name of the ledger is locked: every file can be opened exclusively and a directory renamed
    const { ledger } = await operationSet(env);
    const probe = p(path.dirname(ledger), 'renamed');
    try { fs.renameSync(ledger, probe); fs.renameSync(probe, ledger); } catch (error) { problems.push(`the ledger directory cannot be renamed after the operations: ${error.code}`); }
    h.observe({ census, note: 'no handle remains open after exit: the open-file table at exit was empty for every operation, and the ledger directory could be renamed afterwards', problems: problems.slice(0, 6) });
    if (problems.length > 0) throw new Error(`${problems.length} problem(s): ${problems.slice(0, 6).join('; ')}`);
  },

  '3A-K4': (h, env) => {
    const problems = [];
    const latest = new Map();
    for (const row of env.ledgers) latest.set(row.path, row);
    let clean = 0; let interruptedWithAnomalies = 0; let skipped = 0;
    // one process verifies every ledger the campaign made (the real SDK and the production store, as the CLI composes them)
    const checked = new Map(bulkVerify([...latest.values()].filter((row) => exists(row.path) && !row.intentionalCorruption).map((row) => row.path), p(env.workRoot, 'k4')).map((row) => [row.path, row]));
    for (const row of latest.values()) {
      if (!exists(row.path)) { skipped += 1; continue; }
      if (row.intentionalCorruption) { skipped += 1; continue; }
      const verified = checked.get(row.path);
      if (verified === undefined || !verified.ok) { problems.push(`${path.basename(row.path)}: does not verify (${verified?.code ?? 'not checked'})`); continue; }
      const result = verified.result;
      const pendingOnDisk = exists(p(row.path, '.pending')) ? fs.readdirSync(p(row.path, '.pending')).length : 0; // a ledger written from memory (J11) has no .pending directory
      const recordDirs = fs.readdirSync(p(row.path, 'records')).filter((name) => fs.readdirSync(p(row.path, 'records', name)).length > 0);
      const entries = fs.readdirSync(p(row.path, 'entries')).map((name) => JSON.parse(fs.readFileSync(p(row.path, 'entries', name), 'utf8')));
      const referenced = new Set(entries.filter((entry) => entry.entryType === 'RECORD').map((entry) => entry.record.recordDigest.slice('sha256:'.length)));
      const unreferencedOnDisk = recordDirs.filter((name) => !referenced.has(name)).length;
      // anomalies are always DISCLOSED by verify, exactly
      if (result.pendingArtifacts !== pendingOnDisk) problems.push(`${path.basename(row.path)}: ${pendingOnDisk} staging names on disk, verify reports ${result.pendingArtifacts}`);
      if ((result.unreferencedRecords ?? []).length !== unreferencedOnDisk) problems.push(`${path.basename(row.path)}: ${unreferencedOnDisk} unreferenced records on disk, verify reports ${(result.unreferencedRecords ?? []).length}`);
      if (row.interrupted) { if (pendingOnDisk + unreferencedOnDisk > 0) interruptedWithAnomalies += 1; continue; }
      // ... and none exist after successful operations
      clean += 1;
      if (pendingOnDisk > 0) problems.push(`${path.basename(row.path)}: ${pendingOnDisk} staging names remain after successful operations`);
      if (unreferencedOnDisk > 0) problems.push(`${path.basename(row.path)}: ${unreferencedOnDisk} unreferenced records after successful operations`);
    }
    // no temporary or lock file anywhere in the work root (the harness's own journals excepted)
    const strays = [];
    const walk = (directory) => {
      for (const name of fs.readdirSync(directory)) {
        const full = p(directory, name);
        const st = fs.lstatSync(full);
        if (st.isSymbolicLink()) continue;
        if (/(^~|\.(tmp|temp|lock|swp|part)$|^\.lock$|\.lck$)/iu.test(name)) strays.push(path.relative(env.workRoot, full));
        if (st.isDirectory()) walk(full);
      }
    };
    walk(env.workRoot);
    if (strays.length > 0) problems.push(`temporary or lock files: ${strays.slice(0, 3).join(', ')}`);
    conclude(h, problems, { ledgersChecked: clean + interruptedWithAnomalies, cleanAfterSuccessfulOperations: clean, interruptedLedgersWithDisclosedAnomalies: interruptedWithAnomalies, skipped, strayFiles: strays.length });
  },
};
