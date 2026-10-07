// MO-1308 Phase 3A Windows harness: the armed half of the fault-injection preload (loaded only when a plan is named).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, syncBuiltinESMExports } from 'node:module';

const require = createRequire(import.meta.url);
const real = { existsSync: fs.existsSync, writeFileSync: fs.writeFileSync, appendFileSync: fs.appendFileSync, lstatSync: fs.lstatSync };
const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const ERRNO = { EPERM: -4048, EACCES: -4092, EBUSY: -4082, EIO: -4101, ENOSPC: -4055, EEXIST: -4075 };
const MUTATING = ['openSync', 'closeSync', 'linkSync', 'unlinkSync', 'mkdirSync', 'rmdirSync', 'renameSync', 'fsyncSync'];
const OBSERVED = ['openSync', 'closeSync', 'linkSync', 'unlinkSync', 'mkdirSync', 'rmdirSync', 'renameSync', 'fsyncSync', 'writeSync', 'readSync', 'fstatSync',
  'lstatSync', 'statSync', 'readFileSync', 'readdirSync', 'realpathSync', 'copyFileSync', 'symlinkSync', 'readlinkSync'];

export async function arm(planFile) {
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const dir = plan.dir;
  const mode = { errors: false, events: false, children: false, exitCensus: false, exitPause: false, ...(plan.mode ?? {}) };
  const points = (plan.points ?? []).map((point) => ({
    ...point, nth: point.nth ?? 1, when: point.when ?? 'before', seen: 0,
    matchers: Object.entries(point.match ?? {}).map(([index, source]) => [Number(index), new RegExp(source)]),
  }));
  const state = { errors: [], counts: {}, openFds: new Map() };
  const identityOf = (file) => { try { const st = real.lstatSync(file, { bigint: true }); return { ino: String(st.ino), nlink: Number(st.nlink) }; } catch { return null; } };
  const norm = (value) => (typeof value === 'string' ? value.replaceAll('\\', '/') : null);
  const log = (row) => { try { real.appendFileSync(path.join(dir, `events-${process.pid}.jsonl`), `${JSON.stringify(row)}\n`); } catch { /* the log must never change the run */ } };

  const matches = (point, name, args) => point.op === name && point.matchers.every(([index, regex]) => { const value = norm(args[index]); return value !== null && regex.test(value); });
  const reach = (point, name, args) => {
    real.writeFileSync(path.join(dir, `${point.id}.reached`), JSON.stringify({ pid: process.pid, op: name, args: args.map((value) => (typeof value === 'string' ? value : typeof value)), nth: point.seen }));
    const go = path.join(dir, `${point.id}.go`);
    const end = Date.now() + (point.timeoutMs ?? 120000);
    while (!real.existsSync(go)) {
      if (Date.now() > end) process.exit(97);
      wait(20);
    }
  };
  const inject = (point, name) => {
    const code = point.code ?? 'EPERM';
    const error = new Error(`${code}: injected by the harness, ${name}`);
    Object.assign(error, { code, errno: ERRNO[code] ?? -1, syscall: point.syscall ?? name.replace(/Sync$/u, '') });
    throw error;
  };
  const trigger = (when, name, args) => {
    for (const point of points) {
      if (point.when !== when || !matches(point, name, args)) continue;
      point.seen += 1;
      if (point.seen !== point.nth) continue;
      if (point.action === 'pause') reach(point, name, args); else if (point.action === 'fail') inject(point, name);
    }
  };

  const wrap = (name) => {
    const target = fs[name];
    if (typeof target !== 'function') return;
    const wrapper = function observed(...args) {
      trigger('before', name, args);
      const srcStat = mode.events && name === 'linkSync' ? identityOf(args[0]) : null;
      let result;
      try {
        result = target.apply(this, args);
      } catch (error) {
        if (mode.errors) state.errors.push({ op: name, code: error?.code ?? null, errno: error?.errno ?? null, syscall: error?.syscall ?? null, path: norm(error?.path ?? (typeof args[0] === 'string' ? args[0] : null)), dest: norm(error?.dest ?? null), flags: name === 'openSync' ? args[1] ?? null : null });
        if (mode.events && MUTATING.includes(name)) log({ op: name, a0: norm(args[0]), a1: typeof args[1] === 'string' ? norm(args[1]) : null, flags: name === 'openSync' ? args[1] ?? null : undefined, error: error?.code ?? 'ERR' });
        throw error;
      }
      if (mode.exitCensus && name === 'openSync') state.openFds.set(result, norm(args[0]));
      if (mode.exitCensus && name === 'closeSync') state.openFds.delete(args[0]);
      if (mode.events && MUTATING.includes(name)) log({ op: name, a0: norm(args[0]), a1: typeof args[1] === 'string' ? norm(args[1]) : null, flags: name === 'openSync' ? args[1] ?? null : undefined, ok: true, ...(name === 'linkSync' ? { srcIno: srcStat?.ino ?? null, srcNlink: srcStat?.nlink ?? null, destIno: identityOf(args[1])?.ino ?? null, destNlink: identityOf(args[1])?.nlink ?? null } : {}) });
      trigger('after', name, args);
      return result;
    };
    if (typeof target.native === 'function') {
      const native = target.native;
      wrapper.native = function observedNative(...args) {
        try { return native.apply(this, args); } catch (error) {
          if (mode.errors) state.errors.push({ op: `${name}.native`, code: error?.code ?? null, errno: error?.errno ?? null, syscall: error?.syscall ?? null, path: norm(args[0]), dest: null, flags: null });
          throw error;
        }
      };
    }
    fs[name] = wrapper;
  };
  if (points.length > 0 || mode.errors || mode.events || mode.exitCensus) for (const name of OBSERVED) wrap(name);

  if (mode.children) {
    const bump = (key) => { state.counts[key] = (state.counts[key] ?? 0) + 1; };
    const hook = (target, names, key) => {
      for (const name of names) {
        const target0 = target[name];
        if (typeof target0 !== 'function') continue;
        target[name] = function observed(...args) { bump(key); return target0.apply(this, args); };
      }
    };
    hook(require('node:child_process'), ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'], 'childProcess');
    const net = require('node:net');
    const connect = net.Socket.prototype.connect;
    net.Socket.prototype.connect = function observed(...args) { bump('networkConnections'); return connect.apply(this, args); };
    hook(net, ['connect', 'createConnection', 'createServer'], 'networkConnections');
    hook(require('node:dns'), ['lookup', 'resolve', 'resolve4', 'resolve6'], 'dnsLookups');
    hook(require('node:worker_threads'), ['Worker'], 'workerThreads');
    try { hook(require('node:dgram'), ['createSocket'], 'networkConnections'); } catch { /* absent */ }
  }
  try { syncBuiltinESMExports(); } catch { /* older Node */ }

  if (mode.exitCensus || mode.errors || mode.children || mode.exitPause) {
    process.on('exit', (exitCode) => {
      const census = {
        pid: process.pid, exitCode, counts: state.counts, errors: state.errors, openFds: [...state.openFds].map(([fd, file]) => ({ fd, path: file })),
        activeResources: process.getActiveResourcesInfo?.() ?? null, memory: process.memoryUsage(), resource: process.resourceUsage(),
      };
      try { real.writeFileSync(path.join(dir, `census-${process.pid}.json`), JSON.stringify(census)); } catch { /* ignore */ }
      if (mode.exitPause) {
        real.writeFileSync(path.join(dir, `exit-${process.pid}.reached`), String(process.pid));
        const go = path.join(dir, `exit-${process.pid}.go`);
        const end = Date.now() + 60000;
        while (!real.existsSync(go) && Date.now() < end) wait(20);
      }
    });
  }
}
