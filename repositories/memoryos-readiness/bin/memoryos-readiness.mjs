#!/usr/bin/env node
import { parseCliArgs, validateLaunch } from '../src/cli-args.mjs';
import { errorExit, fail, operationalError, serializeError } from '../src/errors.mjs';

// Closed diagnostics must not be replaced by Node's raw unhandled stream stack.
process.stderr.on('error', () => { process.exitCode = 21; });

try {
  validateLaunch({ platform: process.platform, arch: process.arch, version: process.version,
    execArgv: process.execArgv, environment: process.env });
  parseCliArgs(process.argv.slice(2));
  // Phase 1 establishes the closed launch/path contract only. Full bounded
  // configuration/snapshot acquisition and assessment are Phase 2C/2A/2B work.
  // No input is read, output created or fake readiness returned by this guard.
  fail('INTERNAL', 'ACQUISITION', null);
} catch (error) {
  const safe = operationalError(error, 'ACQUISITION');
  process.exitCode = errorExit(safe);
  process.stderr.write(serializeError(safe));
}
