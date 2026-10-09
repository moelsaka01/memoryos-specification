// MO-1308 Phase 3A Windows harness: host utilities. Everything here is harness code (never product code, never launched by the
// product). Destructive helpers are confined to a work root: they take the root and refuse any path outside it, remove links with
// unlink/rmdir before anything else, and never recurse through a link (the rules of the Step 3 task).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const isWin = process.platform === 'win32';
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const OBSERVERS_DIR = path.join(HERE, 'observers');
export const PRELOAD = path.join(HERE, 'fault-preload.mjs');
export const PYTHON = process.env.P3A_PYTHON ?? 'C:\\Python314\\python.exe';
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

const within = (root, candidate) => {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
};
export const assertWithin = (root, candidate) => {
  if (!within(root, candidate)) throw new Error(`refusing a path outside the work root: ${candidate}`);
};

export const lstatOrNull = (target) => { try { return fs.lstatSync(target, { bigint: true }); } catch { return null; } };
export const isLink = (target) => lstatOrNull(target)?.isSymbolicLink() ?? false;

// Links: a junction needs no privilege; directory and file symlinks need Developer Mode (recorded by 3A-A6).
export const junction = (target, at) => fs.symlinkSync(target, at, 'junction');
export const dirSymlink = (target, at) => fs.symlinkSync(target, at, 'dir');
export const fileSymlink = (target, at) => fs.symlinkSync(target, at, 'file');

// Removes a link itself (never its target).
export function removeLink(target) {
  try { fs.unlinkSync(target); return; } catch { /* a directory link on some hosts */ }
  fs.rmdirSync(target);
}

// Removes a tree below the work root. Links are removed first, as links; the walk never follows a link and never leaves the root.
export function removeTree(root, target) {
  assertWithin(root, target);
  const st = lstatOrNull(target);
  if (st === null) return;
  if (st.isSymbolicLink()) { removeLink(target); return; }
  if (!st.isDirectory()) { try { fs.chmodSync(target, 0o666); } catch { /* ignore */ } fs.unlinkSync(target); return; }
  for (const name of fs.readdirSync(target)) removeTree(root, path.join(target, name));
  fs.rmdirSync(target);
}

// A link-safe snapshot: kind, size, digest (files only), file index and link count for every name below `root`; a link is recorded
// as a link with its target text and is never followed.
export function snapshot(root) {
  const rows = new Map();
  const walk = (directory, prefix) => {
    for (const name of fs.readdirSync(directory).sort()) {
      const full = path.join(directory, name);
      const relative = prefix === '' ? name : `${prefix}/${name}`;
      const st = fs.lstatSync(full, { bigint: true });
      if (st.isSymbolicLink()) { rows.set(relative, { kind: 'link', target: fs.readlinkSync(full) }); continue; }
      if (st.isDirectory()) { rows.set(relative, { kind: 'dir' }); walk(full, relative); continue; }
      rows.set(relative, { kind: 'file', size: Number(st.size), sha256: sha256(fs.readFileSync(full)), ino: String(st.ino), nlink: Number(st.nlink) });
    }
  };
  walk(root, '');
  return rows;
}
export const snapshotDigest = (rows, { identities = false } = {}) => sha256(Buffer.from(JSON.stringify([...rows].map(([name, row]) => (identities || row.kind !== 'file' ? [name, row] : [name, { kind: row.kind, size: row.size, sha256: row.sha256 }])))));
export function snapshotDiff(before, after, { identities = false } = {}) {
  const problems = [];
  for (const [name, row] of before) {
    const other = after.get(name);
    if (other === undefined) problems.push(`removed: ${name}`);
    else if (JSON.stringify(identities ? row : { ...row, ino: undefined, nlink: undefined }) !== JSON.stringify(identities ? other : { ...other, ino: undefined, nlink: undefined })) problems.push(`changed: ${name}`);
  }
  for (const name of after.keys()) if (!before.has(name)) problems.push(`added: ${name}`);
  return problems;
}

// A byte-for-byte copy of a tree (regular files and directories only; refuses to copy a link).
export function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (lstatOrNull(source)?.isSymbolicLink()) throw new Error(`copyTree refuses a link: ${source}`);
    if (entry.isDirectory()) copyTree(source, target); else fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  }
}

// The NTFS file index of a name (Node reports the 64-bit file index as `ino`, with the volume as `dev`). Never follows a link.
export function fileIndex(target) {
  const st = fs.lstatSync(target, { bigint: true });
  return { dev: String(st.dev), ino: String(st.ino), nlink: Number(st.nlink), size: Number(st.size), kind: st.isSymbolicLink() ? 'link' : st.isDirectory() ? 'dir' : 'file' };
}

// ---- harness-launched observers (PowerShell or Python), every launch recorded ----
const recordObserver = (env, row) => { env.observers?.push(row); };
const toolHash = (file) => { try { return sha256(fs.readFileSync(file)); } catch { return null; } };

export function runPython(env, script, args, { input, timeoutMs = 30000, purpose } = {}) {
  const file = path.join(OBSERVERS_DIR, script);
  const run = spawnSync(PYTHON, ['-I', file, ...args], { encoding: 'utf8', input, timeout: timeoutMs, windowsHide: true, shell: false, maxBuffer: 1 << 26 });
  let json = null;
  try { json = JSON.parse(run.stdout); } catch { json = null; }
  recordObserver(env, { observer: 'python', script, scriptSha256: toolHash(file), purpose: purpose ?? script, status: run.status, signal: run.signal ?? null });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr, json };
}

export function runPowerShell(env, command, { timeoutMs = 60000, purpose } = {}) {
  const run = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', timeout: timeoutMs, windowsHide: true, shell: false, maxBuffer: 1 << 26 });
  recordObserver(env, { observer: 'powershell', purpose: purpose ?? 'observation', commandSha256: sha256(Buffer.from(command)), status: run.status, signal: run.signal ?? null });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

// The independent NTFS file-index reader: CreateFile + GetFileInformationByHandle through ctypes (no Node stat involved).
export function ntfsIdentity(env, paths) {
  const result = runPython(env, 'fileindex.py', paths, { purpose: 'NTFS file index reader (3A-C6, 3A-E3)' });
  if (result.status !== 0 || result.json === null) throw new Error(`fileindex.py failed: ${String(result.stderr).slice(0, 200)}`);
  return result.json;
}

// A hidden-window process with piped stdio, for the pauses and kills of the interruption and race cases. Resolves when it closes.
export function spawnTracked(exe, args, { cwd, env, preloadPlan = null, stdin = 'ignore' } = {}) {
  const execArgv = preloadPlan === null ? [] : ['--import', pathToFileHrefOf(PRELOAD)];
  const merged = { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '', ...(env ?? {}), ...(preloadPlan === null ? {} : { P3A_PLAN: preloadPlan }) };
  const child = spawn(exe, [...execArgv, ...args], { cwd, env: merged, windowsHide: true, shell: false, stdio: [stdin, 'pipe', 'pipe'] });
  const out = []; const err = [];
  child.stdout.on('data', (chunk) => out.push(chunk));
  child.stderr.on('data', (chunk) => err.push(chunk));
  const closed = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') })));
  return { child, pid: child.pid, closed };
}
export const pathToFileHrefOf = (file) => new URL(`file:///${path.resolve(file).replaceAll('\\', '/')}`).href;

// Waits for a file to exist (the preload writes `<id>.reached` when a pause point is hit).
export async function waitForFile(file, timeoutMs, { abort } = {}) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (fs.existsSync(file)) return true;
    if (abort?.() === true) return false;
    await sleep(5);
  }
  return false;
}

// A small seeded generator for schedules (the corpus SHA-256 counter generator is the authority; this is only a stream splitter).
export const seededOrder = (seed, count) => {
  const order = Array.from({ length: count }, (_, index) => index);
  let counter = 0;
  for (let index = count - 1; index > 0; index -= 1) {
    const word = crypto.createHash('sha256').update(`${seed}:${counter}`).digest().readUInt32BE(0); counter += 1;
    const swap = word % (index + 1);
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  return order;
};

// ---- holders, paused CLI runs and ACLs ----
export async function holdOpen(env, target, share) {
  const file = path.join(OBSERVERS_DIR, 'hold.py');
  const child = spawn(PYTHON, ['-I', file, target, share], { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
  env.observers?.push({ observer: 'python', script: 'hold.py', scriptSha256: toolHash(file), purpose: `hold ${path.basename(target)} open, share ${share}`, status: null, signal: null });
  const closed = new Promise((resolve) => child.on('close', resolve));
  await new Promise((resolve, reject) => {
    let seen = '';
    child.stdout.on('data', (chunk) => { seen += chunk; if (seen.includes('READY')) resolve(); else if (seen.includes('ERROR')) reject(new Error(`the holder could not open ${target}: ${seen.trim()}`)); });
    child.on('close', () => reject(new Error(`the holder exited early: ${seen}`)));
  });
  return { release: async () => { child.stdin.end('\n'); await closed; } };
}

// One CLI run through the preload with a plan. Returns a controller: reached(id), release(id), kill(), closed.
export function pausedCli(env, cliPath, args, { dir, points = [], mode = {}, cwd, extraEnv } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const planFile = path.join(dir, 'plan.json');
  fs.writeFileSync(planFile, JSON.stringify({ id: path.basename(dir), dir, mode, points }));
  const tracked = spawnTracked(process.execPath, [cliPath, ...args], { cwd, env: extraEnv, preloadPlan: planFile });
  return {
    pid: tracked.pid, child: tracked.child, closed: tracked.closed, dir,
    reached: (id, timeoutMs = 30000) => waitForFile(path.join(dir, `${id}.reached`), timeoutMs, { abort: () => tracked.child.exitCode !== null }),
    release: (id) => fs.writeFileSync(path.join(dir, `${id}.go`), 'go'),
    kill: () => tracked.child.kill(),
    reachedInfo: (id) => JSON.parse(fs.readFileSync(path.join(dir, `${id}.reached`), 'utf8')),
    events: () => { const file = path.join(dir, `events-${tracked.pid}.jsonl`); return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : []; },
    census: () => { const file = path.join(dir, `census-${tracked.pid}.json`); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null; },
  };
}

// ACLs through icacls (a Microsoft-signed system tool, harness-launched and recorded). The current user is denied the named rights.
const whoami = () => (process.env.USERDOMAIN ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}` : String(process.env.USERNAME));
export function aclDeny(env, target, rights) {
  const run = spawnSync('icacls.exe', [target, '/deny', `${whoami()}:${rights}`], { encoding: 'utf8', windowsHide: true, shell: false });
  env.observers?.push({ observer: 'icacls', purpose: `deny ${rights} on ${path.basename(target)}`, status: run.status, signal: null });
  if (run.status !== 0) throw new Error(`icacls deny failed: ${String(run.stdout).slice(0, 160)}`);
}
export function aclRestore(env, target) {
  const run = spawnSync('icacls.exe', [target, '/remove:d', whoami()], { encoding: 'utf8', windowsHide: true, shell: false });
  env.observers?.push({ observer: 'icacls', purpose: `restore ${path.basename(target)}`, status: run.status, signal: null });
  if (run.status !== 0) throw new Error(`icacls restore failed for ${target}: ${String(run.stdout).replace(/\s+/g, " ").slice(0, 200)}${String(run.stderr).slice(0, 100)}`);
}
export const setReadOnly = (target, on) => fs.chmodSync(target, on ? 0o444 : 0o666);

// The result of a CLI run in the shape support.cli returns (for the runs that go through spawnTracked and the preload).
export function parseClosed(closed) {
  let json = null;
  try { json = JSON.parse(closed.stdout || closed.stderr); } catch { json = null; }
  return { status: closed.code, signal: closed.signal, stdout: closed.stdout, stderr: closed.stderr, json, code: json?.error?.historyCode ?? null, exit: json?.error?.exitCode ?? null };
}

// A CLI run as a promise (a real process, hidden window, piped stdio). `plan` is an optional preload plan file (observation or pauses).
export function cliAsync(cliPath, args, { cwd, env, plan = null, log = null } = {}) {
  const tracked = spawnTracked(process.execPath, [cliPath, ...args], { cwd, env, preloadPlan: plan });
  return tracked.closed.then((closed) => {
    const parsed = parseClosed(closed);
    if (log !== null) log.push({ command: args.slice(0, 2).join(' '), status: closed.code, stdout: `sha256:${sha256(Buffer.from(closed.stdout))}`, stderr: `sha256:${sha256(Buffer.from(closed.stderr))}` });
    return { ...parsed, pid: tracked.pid };
  });
}

// Writes a plan file for the preload and returns its path (a census or events directory is created beside it).
export function writePlan(dir, { mode = {}, points = [] } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'plan.json');
  fs.writeFileSync(file, JSON.stringify({ id: path.basename(dir), dir, mode, points }));
  return file;
}

// The console launcher (observers/console-run.py): runs one command in a chosen console/stdio/signal setting. Resolves with its JSON
// report; `stdout` and `stderr` come back decoded from base64 as Buffers. The launcher is started hidden, so it owns a console of its own.
export function consoleRun(env, spec, { dir }) {
  fs.mkdirSync(dir, { recursive: true });
  const specFile = path.join(dir, `spec-${process.hrtime.bigint()}.json`);
  fs.writeFileSync(specFile, JSON.stringify(spec));
  const script = path.join(OBSERVERS_DIR, 'console-run.py');
  const child = spawn(PYTHON, ['-I', script, specFile], { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  env.observers?.push({ observer: 'python', script: 'console-run.py', scriptSha256: toolHash(script), purpose: `console launcher, mode ${spec.mode}${spec.event ? ` ${spec.event}` : ''}`, status: null, signal: null });
  let out = ''; let err = '';
  child.stdout.on('data', (chunk) => { out += chunk; });
  child.stderr.on('data', (chunk) => { err += chunk; });
  return new Promise((resolve) => child.on('close', (code) => {
    let report = null;
    try { report = JSON.parse(out); } catch { report = null; }
    if (report === null) { resolve({ launcherFailed: true, code, stderr: err.slice(0, 400), stdout: Buffer.alloc(0), stderrBytes: Buffer.alloc(0) }); return; }
    resolve({ ...report, stdout: report.stdout === undefined ? null : Buffer.from(report.stdout, 'base64'), stderr: report.stderr === undefined ? null : Buffer.from(report.stderr, 'base64') });
  }));
}

// Verifies many ledgers in ONE process with the real SDK and the production store (ceiling-ops.mjs verify-many): [{path, ok, result | code}].
export function bulkVerify(paths, directory) {
  fs.mkdirSync(directory, { recursive: true });
  const list = path.join(directory, `verify-many-${process.hrtime.bigint()}.json`);
  fs.writeFileSync(list, JSON.stringify(paths));
  const run = spawnSync(process.execPath, [path.join(HERE, 'ceiling-ops.mjs'), 'verify-many', list], { encoding: 'utf8', windowsHide: true, shell: false, maxBuffer: 1 << 28, env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '' } });
  const out = JSON.parse(run.stdout);
  if (!out.ok) throw new Error(`bulk verify failed: ${out.code ?? out.message}`);
  return out.result;
}
