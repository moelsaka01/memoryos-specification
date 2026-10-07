// MO-1308 Phase 3A Windows harness: the probe that proves the fault-injection preload is a no-op when disarmed (3A-K1). It prints a
// SHA-256 over the source text of every function the armed preload would wrap, and the names of the loaded builtin modules. Run three
// ways, the digest must be identical without the preload and with the preload disarmed, and different when it is armed (so the probe
// can see a patch). Harness only.
import crypto from 'node:crypto';
import cp from 'node:child_process';
import dns from 'node:dns';
import fs from 'node:fs';
import net from 'node:net';
import { Worker } from 'node:worker_threads';

const rows = [];
const add = (label, fn) => { rows.push([label, typeof fn === 'function' ? `${fn.name}:${Function.prototype.toString.call(fn).length}:${crypto.createHash('sha256').update(Function.prototype.toString.call(fn)).digest('hex')}` : String(fn)]); };
for (const name of ['openSync', 'closeSync', 'linkSync', 'unlinkSync', 'mkdirSync', 'rmdirSync', 'renameSync', 'fsyncSync', 'writeSync', 'readSync', 'fstatSync', 'lstatSync', 'statSync', 'readFileSync', 'readdirSync', 'realpathSync', 'copyFileSync', 'symlinkSync', 'readlinkSync']) add(`fs.${name}`, fs[name]);
add('fs.realpathSync.native', fs.realpathSync.native);
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) add(`child_process.${name}`, cp[name]);
add('net.Socket.prototype.connect', net.Socket.prototype.connect);
for (const name of ['connect', 'createConnection', 'createServer']) add(`net.${name}`, net[name]);
for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6']) add(`dns.${name}`, dns[name]);
add('worker_threads.Worker', Worker);
const digest = crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
process.stdout.write(JSON.stringify({ digest, functions: rows.length, exitListeners: process.listenerCount('exit'), execArgv: process.execArgv.length }));
