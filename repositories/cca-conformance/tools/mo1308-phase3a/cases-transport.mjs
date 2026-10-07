// MO-1308 Phase 3A step L: output transport and host variance (L1-L6). Real CLI processes; the console, the pipe, the file and the headless
// launch are made by the console launcher (a Python harness observer that owns a console), the hostile environments by the harness.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { CLI, MemoryLedger, appendArgs, initArgs, jcs, parseLedger, rebuild, recordDigestOf, resealCheckpoint, sha, treeDigest, writeLedgerToDisk, dec, enc } from './support.mjs';
import { conclude, recordById, register, run, work } from './env.mjs';
import { ledgerWith } from './cases-cli.mjs';
import { HERE, consoleRun, pathToFileHrefOf, sha256, sleep } from './win.mjs';

const p = (...parts) => path.join(...parts);
const verifyJson = (ledger) => ['history', 'verify', '--ledger', ledger, '--json'];
const verifyHuman = (ledger) => ['history', 'verify', '--ledger', ledger];
const queryJson = (ledger, limit = 100) => ['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', String(limit), '--json'];
const norm = (text) => String(text).replace(/\r\n/gu, '\n').replace(/\n+$/u, '');
const NODE_ENV = { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '' };
const CLOCK = p(HERE, 'clock-shift.mjs');

// A ledger whose query page is megabytes (the J11 construction: valid checkpoints with the longest identifier, entries of about 5.2 KB).
function bigLedger(env, count) {
  if (env.cache[`big-${count}`] !== undefined) return env.cache[`big-${count}`];
  const base = JSON.parse(dec.decode(recordById(env, 'checkpoint-c00').members[0].bytes));
  const seed = new MemoryLedger('l3');
  seed.append({ recordKind: 'INVESTIGATION_CHECKPOINT', members: [{ name: 'checkpoint.json', bytes: enc.encode(jcs(base)) }] });
  const parts = parseLedger(seed.built());
  const bodies = []; const members = new Map();
  for (let index = 0; index < count; index += 1) {
    const id = `${'p'.repeat(4090)}${String(index).padStart(6, '0')}`.slice(-4096);
    const sealed = resealCheckpoint(JSON.parse(JSON.stringify(base).split(base.investigationIdentifier).join(id)));
    const member = { name: 'checkpoint.json', bytes: enc.encode(jcs(sealed)) };
    const body = structuredClone(parts.bodies[0]);
    const value = { CHECKPOINT: sealed.identifier, INVESTIGATION: id, TRANSITION_LOG_DIGEST: sealed.transitionLogDigest, WORKSPACE: sealed.workspaceIdentifier };
    body.record.subjects = body.record.subjects.map((subject) => ({ type: subject.type, value: value[subject.type] }));
    body.record.members = [{ name: member.name, byteLength: member.bytes.length, sha256: sha(member.bytes) }];
    body.record.recordDigest = recordDigestOf('INVESTIGATION_CHECKPOINT', [member]);
    bodies.push(body); members.set(body.record.recordDigest, [member]);
  }
  const built = rebuild({ descriptor: parts.descriptor, bodies, members });
  const ledger = register(env, writeLedgerToDisk(built, p(work(env, 'big'), `ledger-${count}`)));
  env.cache[`big-${count}`] = ledger;
  return ledger;
}

// The same operations from scratch under a given process setting: returns the ledger tree digest and a digest of every command's output.
function scenario(env, name, { cwd, nodeArgs = [], extraEnv = {}, relative = false, spelling = (value) => value } = {}) {
  const directory = p(work(env, 'l-scenarios'), name);
  fs.mkdirSync(directory, { recursive: true });
  const ledgerAbsolute = p(directory, 'ledger');
  const where = relative ? path.relative(cwd, ledgerAbsolute) : spelling(ledgerAbsolute);
  const exportAbsolute = p(directory, 'export');
  const outputs = [];
  const exec = (args) => {
    const out = spawnSync(process.execPath, [...nodeArgs, CLI, ...args], { cwd, encoding: 'buffer', windowsHide: true, shell: false, env: { ...NODE_ENV, ...extraEnv } });
    outputs.push({ args: args.slice(0, 2).join(' '), status: out.status, stdout: sha256(out.stdout), stderr: sha256(out.stderr) });
    return out;
  };
  const input = (id) => appendArgs(where, recordById(env, id), p(directory, `in-${id}`));
  exec(initArgs(where, 'l'));
  for (const id of ['checkpoint-c00', 'policy-0', 'cicd-4', 'readiness-ready', 'decision-ready-approve']) exec(input(id));
  exec(verifyJson(where)); exec(verifyHuman(where)); exec(queryJson(where, 10));
  exec(['history', 'tombstone', '--ledger', where, '--target', '1', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P3A-L', '--json']);
  exec(['history', 'export', '--ledger', where, '--output', relative ? path.relative(cwd, exportAbsolute) : spelling(exportAbsolute), '--json']);
  exec(['history', 'verify-export', '--export', relative ? path.relative(cwd, exportAbsolute) : spelling(exportAbsolute), '--json']);
  register(env, ledgerAbsolute);
  return { tree: treeDigest(ledgerAbsolute), exportTree: treeDigest(exportAbsolute), outputs };
}
const same = (problems, label, left, right) => {
  if (left.tree !== right.tree) problems.push(`${label}: the ledger bytes differ`);
  if (left.exportTree !== right.exportTree) problems.push(`${label}: the export bytes differ`);
  left.outputs.forEach((row, index) => { const other = right.outputs[index]; if (row.status !== other.status || row.stdout !== other.stdout || row.stderr !== other.stderr) problems.push(`${label}: the output of "${row.args}" differs`); });
};

export const transportCases = {
  '3A-L1': async (h, env) => {
    const problems = []; const results = {};
    const ledger = ledgerWith(env, 'l1', ['checkpoint-c00', 'policy-0', 'readiness-ready']);
    const commands = [['verify (JSON)', verifyJson(ledger)], ['verify (human)', verifyHuman(ledger)], ['query (JSON)', queryJson(ledger, 50)], ['a refusal (human)', ['history', 'verify', '--ledger', p(env.workRoot, 'none')]],
      ['a refusal (JSON)', ['history', 'verify', '--ledger', p(env.workRoot, 'none'), '--json']], ['help', ['help', 'history']]];
    for (const [label, args] of commands) {
      const byPage = {};
      for (const codePage of [437, 65001]) {
        const dir = p(work(env, 'l1'), `${label.replace(/\W+/g, '-')}-${codePage}`);
        const pipe = await consoleRun(env, { mode: 'pipe', exe: process.execPath, args: [CLI, ...args], cwd: env.workRoot, env: NODE_ENV, codePage, timeoutMs: 60000 }, { dir });
        const screen = await consoleRun(env, { mode: 'console', exe: process.execPath, args: [CLI, ...args], cwd: env.workRoot, env: NODE_ENV, codePage, timeoutMs: 60000 }, { dir });
        if (pipe.launcherFailed || screen.launcherFailed) { problems.push(`${label} at ${codePage}: the launcher failed: ${pipe.stderr ?? ''} ${screen.stderr ?? ''}`); continue; }
        byPage[codePage] = { pipe: pipe.stdout, pipeErr: pipe.stderr, exit: pipe.exitCode, codePageSeen: pipe.codePage, screen: screen.consoleText ?? '', screenExit: screen.exitCode };
        if (pipe.codePage !== codePage) problems.push(`${label}: the console code page was ${pipe.codePage}, not ${codePage}`);
      }
      const a = byPage[437]; const b = byPage[65001];
      if (a === undefined || b === undefined) continue;
      if (Buffer.compare(a.pipe, b.pipe) !== 0 || Buffer.compare(a.pipeErr, b.pipeErr) !== 0 || a.exit !== b.exit) problems.push(`${label}: bytes or exit differ between code pages 437 and 65001`);
      // what the console shows is what the pipe carries (the screen buffer is text; line ends and trailing blanks are the console's)
      const expected = norm(Buffer.concat([a.exit === 0 ? a.pipe : Buffer.alloc(0), a.exit === 0 ? Buffer.alloc(0) : Buffer.concat([a.pipeErr, a.pipe])]).toString('utf8'));
      const unwrap = (text) => text.split('\n').map((line) => line.trimEnd()).join('\n');
      if (unwrap(norm(a.screen)) !== unwrap(norm(b.screen)) || a.screenExit !== b.screenExit) problems.push(`${label}: the console text differs between code pages`);
      if (unwrap(norm(a.screen)).replace(/\s+/gu, '') !== unwrap(expected).replace(/\s+/gu, '')) problems.push(`${label}: the console text is not the text of the pipe`);
      results[label] = `exit ${a.exit}, ${a.pipe.length + a.pipeErr.length} bytes, identical at 437 and 65001`;
    }
    conclude(h, problems, { results });
  },

  '3A-L2': async (h, env) => {
    const problems = []; const results = {};
    const ledger = ledgerWith(env, 'l2', ['checkpoint-c00', 'policy-0', 'readiness-ready']);
    const commands = [['verify (JSON)', verifyJson(ledger)], ['verify (human)', verifyHuman(ledger)], ['query (JSON)', queryJson(ledger, 50)], ['a refusal (human)', ['history', 'verify', '--ledger', p(env.workRoot, 'none')]], ['a refusal (JSON)', ['history', 'verify', '--ledger', p(env.workRoot, 'none'), '--json']]];
    for (const [label, args] of commands) {
      const dir = p(work(env, 'l2'), label.replace(/\W+/g, '-'));
      const base = { exe: process.execPath, args: [CLI, ...args], cwd: env.workRoot, env: NODE_ENV, timeoutMs: 60000 };
      const pipe = await consoleRun(env, { ...base, mode: 'pipe' }, { dir });
      const file = await consoleRun(env, { ...base, mode: 'file', stdoutFile: p(dir, 'out.bin'), stderrFile: p(dir, 'err.bin') }, { dir });
      const headless = await consoleRun(env, { ...base, mode: 'headless' }, { dir });
      const screen = await consoleRun(env, { ...base, mode: 'console' }, { dir });
      if ([pipe, file, headless, screen].some((row) => row.launcherFailed)) { problems.push(`${label}: a launcher failed: ${[pipe, file, headless, screen].find((row) => row.launcherFailed).stderr}`); continue; }
      const fileOut = fs.readFileSync(p(dir, 'out.bin')); const fileErr = fs.readFileSync(p(dir, 'err.bin'));
      if (Buffer.compare(pipe.stdout, fileOut) !== 0 || Buffer.compare(pipe.stderr, fileErr) !== 0) problems.push(`${label}: the file and the pipe differ`);
      if (Buffer.compare(pipe.stdout, headless.stdout) !== 0 || Buffer.compare(pipe.stderr, headless.stderr) !== 0) problems.push(`${label}: the headless launch and the pipe differ`);
      if (new Set([pipe.exitCode, file.exitCode, headless.exitCode, screen.exitCode]).size !== 1) problems.push(`${label}: exit codes differ: ${[pipe.exitCode, file.exitCode, headless.exitCode, screen.exitCode].join(', ')}`);
      const expected = norm(Buffer.concat([pipe.stdout, pipe.stderr]).toString('utf8')).replace(/\s+/gu, '');
      if (norm(screen.consoleText ?? '').replace(/\s+/gu, '') !== expected) problems.push(`${label}: the console text is not the text of the pipe`);
      results[label] = `exit ${pipe.exitCode}; pipe, file and headless bytes identical (${pipe.stdout.length + pipe.stderr.length}); console text equal`;
    }
    conclude(h, problems, { results });
  },

  '3A-L3': async (h, env) => {
    const problems = []; const results = {};
    const ledger = bigLedger(env, 600);
    const args = queryJson(ledger, 600);
    const reference = spawnSync(process.execPath, [CLI, ...args], { encoding: 'buffer', windowsHide: true, shell: false, env: NODE_ENV, maxBuffer: 1 << 28 });
    if (reference.status !== 0 || reference.stdout.length < 2 * 1024 * 1024) problems.push(`the reference output is ${reference.stdout.length} bytes with exit ${reference.status}`);
    // a slow reader: the whole output arrives, byte for byte, with the same exit
    const slow = await new Promise((resolve) => {
      const child = spawn(process.execPath, [CLI, ...args], { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: NODE_ENV });
      const chunks = []; const errors = [];
      child.stderr.on('data', (chunk) => errors.push(chunk));
      child.stdout.on('data', async (chunk) => { chunks.push(chunk); child.stdout.pause(); await sleep(30); child.stdout.resume(); });
      child.on('close', (code) => resolve({ code, stdout: Buffer.concat(chunks), stderr: Buffer.concat(errors) }));
    });
    results['slow reader'] = `exit ${slow.code}, ${slow.stdout.length} bytes`;
    if (slow.code !== 0 || Buffer.compare(slow.stdout, reference.stdout) !== 0 || slow.stderr.length !== 0) problems.push('a slow reader did not receive the complete, identical output');
    // a closed pipe: the reader goes away before the product writes. Read-only commands publish nothing; an append that was already
    // committed stays committed; every outcome is a defined exit and carries no stack trace
    const leaks = (text) => /\n\s+at\s|node:internal|\.mjs:\d+|C:\\|Error:/u.test(text);
    const closedPipe = (args2) => new Promise((resolve) => {
      const child = spawn(process.execPath, [CLI, ...args2], { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: NODE_ENV });
      const errors = [];
      child.stderr.on('data', (chunk) => errors.push(chunk));
      child.stdout.destroy();
      child.on('close', (code, signal) => resolve({ code, signal, stderr: Buffer.concat(errors).toString('utf8') }));
    });
    const queryClosed = await closedPipe(args);
    results['closed pipe: query'] = `exit ${queryClosed.code}`;
    if (queryClosed.code === null || queryClosed.code > 5 || queryClosed.code < 0) problems.push(`closed pipe, query: exit ${queryClosed.code} ${queryClosed.signal ?? ''}`);
    if (leaks(queryClosed.stderr)) problems.push(`closed pipe, query: stderr carries a stack trace or a path: ${queryClosed.stderr.slice(0, 120)}`);
    const mutable = ledgerWith(env, 'l3-append', ['checkpoint-c00']);
    const appendClosed = await closedPipe(appendArgs(mutable, recordById(env, 'checkpoint-c01'), p(work(env, 'in'), 'l3')));
    const after = run(env, verifyJson(mutable));
    results['closed pipe: append'] = `exit ${appendClosed.code}; entries ${after.json?.result?.entryCount}`;
    if (after.status !== 0) problems.push(`closed pipe, append: the ledger does not verify afterwards: ${after.code}`);
    else if ((appendClosed.code === 0) !== (after.json.result.entryCount === 2)) problems.push(`closed pipe, append: exit ${appendClosed.code} but ${after.json.result.entryCount} entries (no partial publication, no lost success)`);
    if (appendClosed.code === null || appendClosed.code > 5) problems.push(`closed pipe, append: exit ${appendClosed.code}`);
    if (leaks(appendClosed.stderr)) problems.push(`closed pipe, append: stderr carries a stack trace or a path: ${appendClosed.stderr.slice(0, 120)}`);
    conclude(h, problems, { results, bytes: reference.stdout.length });
  },

  '3A-L4': (h, env) => {
    // The host's clock and time zone are system settings that this harness must not change. The product is run with TZ set to other
    // zones and with Date moved by years (clock-shift.mjs): every byte of the ledger, the export and every output is identical.
    const problems = [];
    const base = scenario(env, 'l4-base', { cwd: env.workRoot });
    const variants = [
      ['TZ=UTC', { extraEnv: { TZ: 'UTC' } }], ['TZ=Pacific/Kiritimati (UTC+14)', { extraEnv: { TZ: 'Pacific/Kiritimati' } }], ['TZ=Etc/GMT+12 (UTC-12)', { extraEnv: { TZ: 'Etc/GMT+12' } }],
      ['TZ=America/St_Johns (UTC-3:30)', { extraEnv: { TZ: 'America/St_Johns' } }], ['clock +400 days', { nodeArgs: ['--import', pathToFileHrefOf(CLOCK)], extraEnv: { P3A_CLOCK_SHIFT_MS: String(400 * 86400000) } }],
      ['clock -9 years', { nodeArgs: ['--import', pathToFileHrefOf(CLOCK)], extraEnv: { P3A_CLOCK_SHIFT_MS: String(-9 * 365 * 86400000) } }],
      ['clock +30 years and TZ=Pacific/Kiritimati', { nodeArgs: ['--import', pathToFileHrefOf(CLOCK)], extraEnv: { P3A_CLOCK_SHIFT_MS: String(30 * 365 * 86400000), TZ: 'Pacific/Kiritimati' } }],
    ];
    const seen = [];
    for (const [index, [label, options]] of variants.entries()) { same(problems, label, base, scenario(env, `l4-${index}`, { cwd: env.workRoot, ...options })); seen.push(label); }
    // the shift is real: the control proves the clock-shift preload moves Date in this runtime
    const control = spawnSync(process.execPath, ['--import', pathToFileHrefOf(CLOCK), '-e', 'process.stdout.write(String(Date.now()))'], { encoding: 'utf8', windowsHide: true, env: { ...NODE_ENV, P3A_CLOCK_SHIFT_MS: String(400 * 86400000) } });
    if (Math.abs(Number(control.stdout) - Date.now() - 400 * 86400000) > 60000) problems.push('the clock-shift preload did not move Date');
    conclude(h, problems, { variants: seen, systemClockAndZone: 'not changed (system settings); simulated per process: TZ variants and a shifted Date', bytesCompared: 'ledger tree, export tree and every command output' });
  },

  '3A-L5': (h, env) => {
    const problems = [];
    const root = work(env, 'l5');
    const base = scenario(env, 'l5-base', { cwd: env.workRoot });
    const deep = p(root, 'a', 'b', 'c'); fs.mkdirSync(deep, { recursive: true });
    const variants = [
      ['another working directory', { cwd: deep }], ['the drive root as the working directory', { cwd: path.parse(env.workRoot).root }], ['relative paths from the work root', { cwd: env.workRoot, relative: true }],
      ['relative paths from a deep directory', { cwd: deep, relative: true }], ['drive letter in lower case', { cwd: env.workRoot, spelling: (value) => value[0].toLowerCase() + value.slice(1) }],
      ['drive letter in upper case', { cwd: env.workRoot, spelling: (value) => value[0].toUpperCase() + value.slice(1) }], ['forward slashes', { cwd: env.workRoot, spelling: (value) => value.replaceAll('\\', '/') }],
      ['dot-dot segments', { cwd: env.workRoot, spelling: (value) => p(path.dirname(value), 'x', '..', path.basename(value)) }],
    ];
    const seen = [];
    for (const [index, [label, options]] of variants.entries()) { same(problems, label, base, scenario(env, `l5-${index}`, options)); seen.push(label); }
    conclude(h, problems, { variants: seen, note: 'one volume (C:); the drive letter in both cases and the drive root as the working directory are the drive variance available without changing system drive mappings' });
  },

  '3A-L6': (h, env) => {
    // Hostile NODE_OPTIONS and environment variables: the behaviour is recorded. Pre-registered outcomes per variant: UNCHANGED (stdout, stderr,
    // exit and bytes as the baseline), RUNTIME_STDERR_ONLY (only the Node runtime added text to stderr), RUNTIME_REFUSED (Node refused to
    // start the process; the product never ran and the ledger is untouched), PRODUCT_BYTES_CHANGED (a failure of this case).
    const probe = (label, nodeEnv, { nodeArgs = [] } = {}) => {
      const directory = p(work(env, 'l6'), label.replace(/\W+/g, '-'));
      fs.mkdirSync(directory, { recursive: true });
      const ledger = p(directory, 'ledger');
      const exec = (args) => spawnSync(process.execPath, [...nodeArgs, CLI, ...args], { encoding: 'buffer', windowsHide: true, shell: false, env: { ...NODE_ENV, ...nodeEnv }, timeout: 60000 });
      const results = [exec(initArgs(ledger, 'l6')), exec(appendArgs(ledger, recordById(env, 'checkpoint-c00'), p(directory, 'in'))), exec(verifyJson(ledger)), exec(queryJson(ledger, 10))];
      register(env, ledger, true);
      return { results, tree: fs.existsSync(ledger) ? treeDigest(ledger) : null };
    };
    const baseline = probe('baseline', {});
    const hook = p(work(env, 'l6'), 'hook.cjs'); fs.writeFileSync(hook, "require('node:fs').appendFileSync(process.env.P3A_HOOK_LOG, 'loaded\\n');");
    const hookLog = p(work(env, 'l6'), 'hook.log');
    const variants = [
      ['NODE_OPTIONS=--require a harmless hook', { NODE_OPTIONS: `--require ${hook.replaceAll('\\', '/')}`, P3A_HOOK_LOG: hookLog }], ['NODE_OPTIONS=--max-old-space-size=8', { NODE_OPTIONS: '--max-old-space-size=8' }],
      ['NODE_OPTIONS=--no-warnings', { NODE_OPTIONS: '--no-warnings' }], ['NODE_OPTIONS=--unknown-flag', { NODE_OPTIONS: '--this-flag-does-not-exist' }], ['NODE_OPTIONS=--stack-trace-limit=0', { NODE_OPTIONS: '--stack-trace-limit=0' }],
      ['NODE_DEBUG=fs', { NODE_DEBUG: 'fs' }], ['NODE_EXTRA_CA_CERTS to a missing file', { NODE_EXTRA_CA_CERTS: p(env.workRoot, 'missing-ca.pem') }], ['UV_THREADPOOL_SIZE=1', { UV_THREADPOOL_SIZE: '1' }],
      ['NODE_PATH to a decoy directory', { NODE_PATH: p(env.workRoot) }], ['FORCE_COLOR=3 and NO_COLOR=1', { FORCE_COLOR: '3', NO_COLOR: '1' }], ['TZ=not-a-zone and LANG=xx', { TZ: 'not-a-zone', LANG: 'xx_XX' }],
      ['a 30,000-character variable', { P3A_HUGE: 'x'.repeat(30000) }], ['MEMORYOS_* look-alike variables', { MEMORYOS_LEDGER: p(env.workRoot, 'elsewhere'), MEMORYOS_OUTPUT: p(env.workRoot, 'elsewhere2'), MEMORYOS_HOME: env.workRoot }],
    ];
    const rows = []; const problems = [];
    const same = (a, b) => a.length === b.length && a.every((row, index) => row.status === b[index].status && Buffer.compare(row.stdout, b[index].stdout) === 0 && Buffer.compare(row.stderr, b[index].stderr) === 0);
    for (const [label, nodeEnv] of variants) {
      const observedRun = probe(label, nodeEnv);
      let outcome;
      const stdoutSame = observedRun.results.every((row, index) => row.status === baseline.results[index].status && Buffer.compare(row.stdout, baseline.results[index].stdout) === 0);
      if (same(observedRun.results, baseline.results) && observedRun.tree === baseline.tree) outcome = 'UNCHANGED';
      else if (stdoutSame && observedRun.tree === baseline.tree) outcome = 'RUNTIME_STDERR_ONLY';
      else if (observedRun.results.every((row) => row.status !== 0) && observedRun.tree === null) outcome = 'RUNTIME_REFUSED';
      else outcome = 'PRODUCT_BYTES_CHANGED';
      if (outcome === 'PRODUCT_BYTES_CHANGED') problems.push(`${label}: outputs or ledger bytes changed`);
      rows.push({ variant: label, outcome, exits: observedRun.results.map((row) => row.status), stderrBytes: observedRun.results.map((row) => row.stderr.length) });
    }
    h.observe({ variants: rows, hookLoaded: fs.existsSync(hookLog) ? fs.readFileSync(hookLog, 'utf8').trim().split('\n').length : 0, problems });
    if (problems.length > 0) throw new Error(`${problems.length} problem(s): ${problems.slice(0, 6).join('; ')}`);
  },
};
void sha256; void pathToFileHrefOf;
