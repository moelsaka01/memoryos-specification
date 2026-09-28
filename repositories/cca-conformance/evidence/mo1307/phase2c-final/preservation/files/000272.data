// Engineering native operational witness. Production transport/supervisor and
// publication are real; the sole worker returns fixed reviewed fixture bytes.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createSupervisorForTesting } from '../../../memoryos-readiness/src/runtime.mjs';
import { createHelperTransport } from '../../../memoryos-readiness/src/helper-transport.mjs';
import { decodeHelperRequest } from '../../../memoryos-readiness/src/helper-protocol.mjs';
import { orchestrateCli } from '../../../memoryos-readiness/src/cli.mjs';
import { bundle, root, workerURL, finalName, launchFor, capture } from './surface-fixture.mjs';
const [receiptDirectory] = process.argv.slice(2);
if (!receiptDirectory || !path.isAbsolute(receiptDirectory)) throw new Error('explicit absolute receipt directory');
await fs.mkdir(receiptDirectory, { recursive: false });
const scratch = path.join(root, '.cache/mo1307-phase2c-resumed/native-surfaces-' + process.pid);
await fs.mkdir(scratch, { recursive: true });
const data = await bundle(), results = [];
const started = performance.now();
async function witness(name, command, options = {}) {
  const at = performance.now(), controller = new AbortController();
  const supervisor = createSupervisorForTesting({ kind: 'cli', signal: controller.signal }, { workerURL });
  const transport = createHelperTransport(supervisor), requests = [], output = capture(options.failWrite);
  const destination = command === 'verify' ? path.join(scratch, 'evaluate-a') : path.join(scratch, name);
  const exchange = async frame => {
    const request = decodeHelperRequest(frame); requests.push({ session: request.session, sequence: request.sequence, operation: request.operation });
    if (options.cancelSlot === request.sequence) controller.abort();
    return transport.exchange(frame);
  };
  let outcome, error = null;
  try {
    outcome = await orchestrateCli(launchFor(data, destination, command), { supervisor, exchange, stdout: output.stream });
    if (options.expectedError) throw new Error('expected rejection missing');
    assert.equal(outcome.exitCode, 0);
    assert.equal(requests.length, command === 'evaluate' ? 9 : 4);
    assert.deepEqual(requests.map(r => r.sequence), Array.from({ length: requests.length }, (_, i) => i + 1));
    assert.equal(new Set(requests.map(r => r.session)).size, 1);
    assert.deepEqual(await fs.readFile(path.join(destination, finalName)), data.resultBytes);
  } catch (failure) {
    error = { code: failure.code ?? null, message: failure.message };
    if (failure.code !== options.expectedError) throw failure;
    if (options.failWrite) assert.deepEqual(await fs.readFile(path.join(destination, finalName)), data.resultBytes);
    if (options.cancelSlot === 9) assert.deepEqual(await fs.readdir(destination), [finalName + '.pending']);
  } finally {
    await supervisor.dispose();
    results.push({ name, command, elapsedMs: performance.now() - at, requests, outcome, error, snapshot: supervisor.snapshot(), outputBytes: output.bytes().length });
    await fs.writeFile(path.join(receiptDirectory, name + '.json'), JSON.stringify(results.at(-1), null, 2) + '\n');
  }
  if (name === 'evaluate-a') await fs.writeFile(path.join(receiptDirectory, 'summary-a.data'), output.bytes());
  if (name === 'evaluate-b') assert.deepEqual(output.bytes(), await fs.readFile(path.join(receiptDirectory, 'summary-a.data')));
}
let result = 'PASS', failure = null;
try {
  await witness('evaluate-a', 'evaluate');
  await witness('verify', 'verify');
  await witness('evaluate-b', 'evaluate');
  assert.notEqual(results[0].requests[0].session, results[2].requests[0].session);
  await witness('stdout-failure', 'evaluate', { failWrite: true, expectedError: 'MO1307_OUTPUT' });
  await witness('cancel-before-finalization', 'evaluate', { cancelSlot: 9, expectedError: 'MO1307_CANCELLED' });
} catch (error) { result = 'FAIL'; failure = { code: error.code ?? null, message: error.message }; }
const receipt = { kind: 'MO1307Phase2CNativeSurfaces', result, failure, pid: process.pid, elapsedMs: performance.now() - started,
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  semanticIntegration: 'REVIEWED_FIXED_ENGINEERING_DOUBLE_NOT_2A_2B_CERTIFICATION', results };
await fs.writeFile(path.join(receiptDirectory, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
process.stdout.write(JSON.stringify({ result, cases: results.length, elapsedMs: receipt.elapsedMs }) + '\n');
process.exitCode = result === 'PASS' ? 0 : 1;
