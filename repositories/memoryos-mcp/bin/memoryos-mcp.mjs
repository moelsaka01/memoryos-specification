#!/usr/bin/env node
import { validateLaunch, verifyDependencies, verifyRuntime } from '../src/integrity.mjs';
import { Socket } from 'node:net';

import { loadLimits } from '../src/limits.mjs';

let diagnosticWritten = false;
let output; let shuttingDown = false;
function fatal() {
  process.exitCode = 1;
  shuttingDown = true; output?.destroy();
  if (!diagnosticWritten) { diagnosticWritten = true; process.stderr.write('MO1304_FATAL\n'); }
  setImmediate(() => process.exit(1));
}
process.on('uncaughtException', fatal);
process.on('unhandledRejection', fatal);
try {
  validateLaunch();
  await loadLimits();
  await verifyDependencies();
  await verifyRuntime();
  const { startServer } = await import('../src/server.mjs');
  // Own the existing stdio pipe descriptor. Unlike process.stdout's protected
  // handle, this can cancel a blocked native write during bounded shutdown.
  output = new Socket({ fd: 1, readable: false, writable: true, highWaterMark: 1 });
  if (process.platform === 'win32') {
    // Pinned Node 24.21.0 replaces fd 1/2 Socket writes with makeSyncWrite.
    // Restore this owned instance's asynchronous methods and nonblocking pipe.
    // Fail closed if the exact pinned runtime no longer provides this boundary.
    if (!Object.hasOwn(output, '_write') || typeof output._handle?.setBlocking !== 'function'
      || output._handle.setBlocking(false) !== 0) throw new Error('STDIO_RUNTIME_MISMATCH');
    output._write = Socket.prototype._write;
    output._writev = Socket.prototype._writev;
  }
  output.on('error', () => { if (!shuttingDown) fatal(); });
  const server = await startServer({ output, fatal, onend: () => {
    shuttingDown = true; output.destroy();
    setImmediate(() => process.exit(process.exitCode ?? 0));
  } });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    const timer = setTimeout(() => { fatal(); process.exit(1); }, server.limits.shutdownMs);
    server.close().then(() => { clearTimeout(timer); }, () => { fatal(); process.exit(1); });
  });
} catch { fatal(); }
