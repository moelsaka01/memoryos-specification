// Exactly two uninstrumented whole-lifecycle witnesses: retained seq5 failure first, then retained seq4 pass comparator.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { decodeHelperResponse, encodeHelperResponse } from '../../../memoryos-readiness/src/helper-protocol.mjs';
import { absolute, beginCampaign, finishCampaign, hash, record, verifyBindings, write } from './validation-bindings.mjs';

const context = beginCampaign('performance');
const specification = context.manifest.launch;
const witnesses = [
  { id: 'retained-exact-slot5-former-failure', sequence: 5, input: 'repositories/cca-conformance/evidence/mo1307/n17-correction/native-filesystem/003.request.bin', expectedRequestSha256: 'sha256:71a9040815c137ac0980f9e985c1a03e23dfd57873f5940ba393f36d64113dad' },
  { id: 'retained-exact-slot4-pass-comparator', sequence: 4, input: 'repositories/cca-conformance/evidence/mo1307/n17-correction/native-filesystem/002.request.bin', expectedRequestSha256: 'sha256:9ebe7421a723770cf6950694b0fea840123c5916c1d66ca141ab37a81933ef29' },
];
const rows = [];
let failure = null;
let executed = 0;
write(context.output + '/plan.json', {
  order: witnesses.map(witness => witness.id), oneExecutionEach: true, retries: 0, warmups: 0,
  helperDeadlineMs: 5000, frozenDeadlineRelation: 'elapsedMs < 5000', uninstrumentedCandidate: record('repositories/memoryos-readiness/helpers/windows-inspect.ps1'),
  exactRetainedRequests: witnesses.map(witness => ({ ...witness, input: record(witness.input) })),
  stopRule: 'If the first formerly failing witness fails or reaches 5000 ms, do not execute the comparator.',
  cacheState: 'Ordinary OS cache state is uncontrolled; there is no cache flush, deliberate helper warmup, or replacement execution. Slot 5 is the first helper launch in this correction validation generation.',
});
function requestFromFrame(frame) {
  assert.ok(frame.length >= 4); assert.equal(frame.readUInt32BE(0), frame.length - 4);
  return JSON.parse(frame.subarray(4).toString('utf8'));
}
function runWitness(witness) {
  verifyBindings(context);
  const frame = fs.readFileSync(absolute(witness.input));
  assert.equal(hash(frame), witness.expectedRequestSha256);
  const request = requestFromFrame(frame);
  assert.equal(request.kind, 'MemoryOSReadinessHelperRequest'); assert.equal(request.version, '2.0.0');
  assert.equal(request.operation, 'CHECK_OUTPUT'); assert.equal(request.sequence, witness.sequence); assert.deepEqual(request.files, []);
  const output = request.roots.find(entry => entry.id === 'output').path;
  assert.equal(output, context.manifest.performance.exactFixtureState.output);
  assert.equal(fs.statSync(context.manifest.performance.exactFixtureState.parent).isDirectory(), true);
  assert.equal(fs.existsSync(output), false);
  const folder = context.output + '/' + witness.id;
  fs.mkdirSync(absolute(folder), { recursive: false });
  write(folder + '/request.bin', frame);
  executed++;
  const started = performance.now();
  const child = spawnSync(specification.executable, [...specification.args], {
    ...specification.options, input: frame, encoding: null, timeout: 5000, maxBuffer: 16777216,
    env: { ...specification.options.env }, stdio: [...specification.options.stdio],
  });
  const elapsedMs = performance.now() - started;
  write(folder + '/response.bin', child.stdout ?? Buffer.alloc(0));
  write(folder + '/stderr.txt', child.stderr ?? Buffer.alloc(0));
  const invocation = {
    id: witness.id, sequence: witness.sequence, pid: child.pid, elapsedMs, deadlineMs: 5000, exitCode: child.status, signal: child.signal,
    postDeadlineReturnMs: Math.max(0, elapsedMs - 5000),
    error: child.error ? { code: child.error.code ?? null, message: child.error.message } : null,
    request: record(folder + '/request.bin'), response: record(folder + '/response.bin'), stderr: record(folder + '/stderr.txt'),
    settlementBasis: 'spawnSync returned with a concrete child status/signal and complete captured stdout/stderr buffers; individual pipe-event timestamps are not separately observed',
  };
  write(folder + '/invocation.json', invocation);
  try {
    assert.ok(Number.isInteger(child.pid) && child.pid > 0, 'The whole-lifecycle witness has one concrete helper process identity');
    assert.ifError(child.error); assert.equal(child.status, 0); assert.equal(child.signal, null); assert.equal(child.stderr.length, 0);
    assert.ok(elapsedMs < 5000, 'The complete helper lifecycle must be strictly below 5000 ms');
    assert.ok(child.stdout.length >= 4 && child.stdout.length <= 16777216); assert.equal(child.stdout.readUInt32BE(0), child.stdout.length - 4);
    const response = decodeHelperResponse(child.stdout, request);
    assert.equal(response.status, 'ABSENT'); assert.equal(response.code, null); assert.equal(response.operation, 'CHECK_OUTPUT');
    assert.equal(response.sequence, witness.sequence); assert.equal(response.session, request.session); assert.deepEqual(response.files, []);
    assert.equal(response.roots.length, 1); assert.equal(response.roots[0].id, 'output-parent'); assert.equal(response.roots[0].chain.length, 5);
    assert.deepEqual(encodeHelperResponse(response, request), child.stdout, 'Response is the exact canonical wire frame');
    assert.equal(fs.existsSync(output), false, 'CHECK_OUTPUT remains read-only absence inspection');
    const row = { id: witness.id, result: 'PASS', sequence: witness.sequence, elapsedMs, deadlineMs: 5000, invocation: record(folder + '/invocation.json'), responseStatus: response.status, chainLength: response.roots[0].chain.length };
    write(folder + '/receipt.json', row); rows.push(row);
  } catch (error) {
    const timeoutCleanupWithinBound = child.error?.code !== 'ETIMEDOUT' || elapsedMs - 5000 < 2000;
    const row = { id: witness.id, result: 'FAIL', sequence: witness.sequence, elapsedMs, deadlineMs: 5000, invocation: record(folder + '/invocation.json'), timeoutCleanupWithinBound, failure: { name: error.name, message: error.message, stack: error.stack } };
    write(folder + '/receipt.json', row); rows.push(row); throw error;
  }
}
try {
  const a = fs.readFileSync(absolute(witnesses[0].input));
  const b = fs.readFileSync(absolute(witnesses[1].input));
  assert.equal(a.length, b.length); const offsets = []; for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) offsets.push(index);
  assert.deepEqual(offsets, [196]); assert.equal(a[196], '5'.charCodeAt(0)); assert.equal(b[196], '4'.charCodeAt(0));
  runWitness(witnesses[0]);
  runWitness(witnesses[1]);
} catch (error) {
  failure = { name: error.name, message: error.message, stack: error.stack };
} finally {
  finishCampaign(context, {
    suite: 'bounded-performance', result: failure === null && rows.length === 2 ? 'PASS' : 'FAIL', rows, failure,
    executed, requiredOrder: witnesses.map(witness => witness.id),
    notRun: witnesses.slice(executed).map(witness => witness.id),
    retries: 0, warmups: 0, distributionsCharacterized: false,
    cacheState: 'Ordinary OS cache state uncontrolled; no cache flush or deliberate helper warmup. Slot 5 was first.',
  });
}
