#!/usr/bin/env node
import { validateLaunch, verifyDependencies, verifyRuntime } from '../src/integrity.mjs';

import { loadLimits } from '../src/limits.mjs';

let diagnosticWritten = false;
function fatal() {
  process.exitCode = 1;
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
  const server = await startServer({ fatal });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    const timer = setTimeout(() => { fatal(); process.exit(1); }, server.limits.shutdownMs);
    server.close().then(() => { clearTimeout(timer); }, () => { fatal(); process.exit(1); });
  });
} catch { fatal(); }
