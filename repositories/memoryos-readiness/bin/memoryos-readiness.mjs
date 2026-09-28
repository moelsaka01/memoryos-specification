#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { runCli } from '../src/cli.mjs';
import { errorExit, operationalError } from '../src/errors.mjs';

const started = performance.now();
const controller = new AbortController();
const cancel = () => controller.abort();
process.once('SIGINT', cancel);
process.once('SIGTERM', cancel);
// Never expose a raw Node stream exception or helper diagnostic.
process.stderr.on('error', () => { process.exitCode = 21; });
process.stdout.on('error', () => {});
try {
  const result = await runCli(process.argv.slice(2), { signal: controller.signal, started, stderr: process.stderr });
  process.exitCode = result.exitCode;
} catch (error) {
  process.exitCode = errorExit(operationalError(error, 'ACQUISITION'));
} finally {
  process.off('SIGINT', cancel); process.off('SIGTERM', cancel);
}
