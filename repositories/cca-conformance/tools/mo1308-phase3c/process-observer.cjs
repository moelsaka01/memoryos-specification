// MO-1308 Phase 3C: a preload (`node --require process-observer.cjs`) that counts child-process and network activity of the CLI
// and writes the counts, as JSON, to the file named by P3C_OBSERVER_LOG when the process exits. It only observes: every call goes
// on to the real function. It is pure JavaScript and the same on every platform.
'use strict';
const fs = require('node:fs');
const counts = { childProcess: 0, networkConnections: 0, dnsLookups: 0, workerThreads: 0 };
const wrap = (target, names, key) => {
  for (const name of names) {
    const original = target[name];
    if (typeof original !== 'function') continue;
    target[name] = function observed(...args) { counts[key] += 1; return original.apply(this, args); };
  }
};
wrap(require('node:child_process'), ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'], 'childProcess');
const net = require('node:net');
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function observed(...args) { counts.networkConnections += 1; return connect.apply(this, args); };
wrap(net, ['connect', 'createConnection'], 'networkConnections');
wrap(require('node:dns'), ['lookup', 'resolve', 'resolve4', 'resolve6'], 'dnsLookups');
wrap(require('node:worker_threads'), ['Worker'], 'workerThreads');
try { require('node:module').syncBuiltinESMExports(); } catch { /* older Node */ }
process.on('exit', () => {
  if (process.env.P3C_OBSERVER_LOG) fs.appendFileSync(process.env.P3C_OBSERVER_LOG, `${JSON.stringify(counts)}\n`);
});
