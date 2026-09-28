import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { canonicalBytes } from '../../memoryos-readiness/src/canonical.mjs';
import { snapshotApiInput } from '../../memoryos-readiness/src/api-input.mjs';
import { evaluateReadiness, verifyReadiness } from '../../memoryos-readiness/src/index.mjs';
import { parseCliArgs } from '../../memoryos-readiness/src/cli-args.mjs';
import { createSupervisorForTesting } from '../../memoryos-readiness/src/runtime.mjs';
import { orchestrateCli } from '../../memoryos-readiness/src/cli.mjs';
import { acquireCliInputs } from '../../memoryos-readiness/src/acquisition.mjs';
import { createHelperSequence } from '../../memoryos-readiness/src/helper-protocol.mjs';
import { adaptVerifiedEvidence } from '../../memoryos-readiness/src/integration.mjs';
import { summaryProjection, textProjection } from '../../memoryos-readiness/src/projections.mjs';
import { bundle, root, workerURL, finalName, launchFor, capture, syntheticExchange } from '../tools/mo1307-phase2c-resumed/surface-fixture.mjs';
const scratch = path.join(root, '.cache/mo1307-phase2c-resumed/surfaces-' + process.pid);
await fs.mkdir(scratch, { recursive: true });
const ready = await bundle();
const is = suffix => error => error.code === 'MO1307_' + suffix;
const run = async (launch, extra = {}) => {
  const supervisor = createSupervisorForTesting({ kind: 'cli', signal: extra.signal }, { workerURL });
  const output = capture(extra.failWrite), seen = [];
  try {
    const result = await orchestrateCli(launch, { supervisor, exchange: syntheticExchange(request => { seen.push(request); extra.observe?.(request); }), stdout: output.stream });
    return { result, output: output.bytes(), seen, snapshot: supervisor.snapshot() };
  } finally { await supervisor.dispose(); }
};
for (const [name, exit] of [['ready', 0], ['qualified', 2], ['not-ready', 3], ['could-not-evaluate', 4]]) {
  test('SURFACE evaluate nine slots exact bytes/summary/exit ' + name, async () => {
    const data = await bundle(name), destination = path.join(scratch, name);
    const answer = await run(launchFor(data, destination));
    assert.equal(answer.result.exitCode, exit); assert.equal(answer.result.committed, true);
    assert.deepEqual(answer.seen.map(r => r.sequence), [1,2,3,4,5,6,7,8,9]);
    assert.equal(new Set(answer.seen.map(r => r.session)).size, 1);
    assert.match(answer.seen[0].session, /^[a-f0-9]{64}$/);
    assert.deepEqual(await fs.readFile(path.join(destination, finalName)), data.resultBytes);
    assert.deepEqual(answer.output, summaryProjection(JSON.parse(data.resultBytes)));
    assert.deepEqual(await fs.readdir(destination), [finalName]);
    assert.equal(answer.snapshot.workers, 1);
  });
}
test('SURFACE verify four slots exit0 no writes', async () => {
  const destination = path.join(scratch, 'ready');
  const before = await fs.readdir(destination);
  const answer = await run(launchFor(ready, destination, 'verify'));
  assert.equal(answer.result.exitCode, 0); assert.equal(answer.result.committed, false);
  assert.deepEqual(answer.seen.map(r => r.sequence), [1,2,3,4]);
  assert.ok(answer.seen.every(r => r.operation === 'READ_SET'));
  assert.deepEqual(answer.output, summaryProjection(JSON.parse(ready.resultBytes), 'verify'));
  assert.deepEqual(await fs.readdir(destination), before);
});
test('SURFACE decision transport downstream and authenticity retained', async () => {
  const local = path.join(scratch, 'decision-input'); await fs.cp(ready.directory, local, { recursive: true });
  const result = JSON.parse(ready.resultBytes);
  const decision = { kind: 'MemoryOSReadinessHumanDecision', version: '1.0.0', candidateDigest: result.assessment.candidateDigest,
    readinessDigest: result.readinessDigest, proofBindingDigest: result.proofBindingDigest, decision: 'REJECT', reason: 'private reason sentinel',
    actor: 'not-authenticated', timestamp: null, authenticity: 'NOT_VERIFIED_BY_MEMORYOS', attestation: null };
  await fs.writeFile(path.join(local, 'decision.json'), canonicalBytes(decision));
  const answer = await run(launchFor({ ...ready, directory: local }, path.join(scratch, 'ready'), 'verify', 'decision.json'));
  const summary = JSON.parse(answer.output);
  assert.deepEqual(summary.decision, { authenticity: 'NOT_VERIFIED_BY_MEMORYOS', consistency: 'CONSISTENT', decision: 'REJECT' });
  assert.equal(summary.readiness, 'READY'); assert.equal(answer.result.exitCode, 0);
  assert.equal(answer.seen[3].files.map(f => f.id).join(','), 'decision,result');
  assert.ok(!answer.output.includes('sentinel')); assert.ok(!answer.output.includes('not-authenticated'));
});
test('SURFACE verify altered supplied result rejects before stdout', async () => {
  const dest = path.join(scratch, 'altered-result'); await fs.mkdir(dest);
  const modified = JSON.parse(ready.resultBytes); modified.assessment.readiness = 'NOT_READY';
  await fs.writeFile(path.join(dest, finalName), canonicalBytes(modified));
  await assert.rejects(run(launchFor(ready, dest, 'verify')), is('RESULT_MISMATCH'));
  assert.deepEqual(await fs.readdir(dest), [finalName]);
});
test('SURFACE tag observations transported as original bytes without Git', async () => {
  for (const name of ['pre-tag-present', 'post-tag-ready']) {
    const data = await bundle(name), seen = [];
    const launch = launchFor(data, path.join(scratch, name));
    const input = await acquireCliInputs(launch, createHelperSequence('evaluate'), syntheticExchange(r => seen.push(r)), () => {});
    assert.deepEqual(input.files, data.input.files);
    assert.equal(seen.length, 4);
    const tags = input.files.filter(f => f.id.includes('tag'));
    assert.ok(tags.length > 0);
  }
});
test('SURFACE determinism across random sessions and output roots', async () => {
  const a = await run(launchFor(ready, path.join(scratch, 'det-a')));
  const b = await run(launchFor(ready, path.join(scratch, 'det-b')));
  assert.notEqual(a.seen[0].session, b.seen[0].session);
  assert.deepEqual(a.output, b.output); assert.equal(a.result.exitCode, b.result.exitCode);
  assert.deepEqual(await fs.readFile(path.join(scratch, 'det-a', finalName)), await fs.readFile(path.join(scratch, 'det-b', finalName)));
});
test('SURFACE complete text output', async () => {
  const answer = await run(launchFor(ready, path.join(scratch, 'text'), 'evaluate', null, 'text'));
  assert.deepEqual(answer.output, textProjection(JSON.parse(ready.resultBytes)));
  assert.equal(answer.output.at(-1), 10);
});
test('SURFACE post-rename stdout failure returns OUTPUT retains committed result', async () => {
  const dest = path.join(scratch, 'stdout-fail');
  await assert.rejects(run(launchFor(ready, dest), { failWrite: true }), is('OUTPUT'));
  assert.deepEqual(await fs.readFile(path.join(dest, finalName)), ready.resultBytes);
});
test('SURFACE cancellation before worker no directory publication', async () => {
  const controller = new AbortController(), dest = path.join(scratch, 'cancel-worker');
  await assert.rejects(run(launchFor(ready, dest), { signal: controller.signal, observe: req => { if (req.sequence === 4) controller.abort(); } }), is('CANCELLED'));
  await assert.rejects(fs.stat(dest), error => error.code === 'ENOENT');
});
test('SURFACE cancellation before final inspection retains pending', async () => {
  const controller = new AbortController(), dest = path.join(scratch, 'cancel-final');
  await assert.rejects(run(launchFor(ready, dest), { signal: controller.signal, observe: req => { if (req.sequence === 9) controller.abort(); } }), is('CANCELLED'));
  assert.deepEqual(await fs.readdir(dest), [finalName + '.pending']);
});
test('SURFACE 2B to 2A adapter selects exact handoff fields', () => {
  const p = { candidate: {}, candidateDigest: 'candidate', profile: {}, stage: 'stage', authorityIdentityDigest: 'authority',
    normalizedAuthority: { scopeId: 'scope', slots: [{ gateId: 'gate', grantDigests: [] }] }, claims: [], graph: {}, graphDigest: 'graph', diagnostics: 'must-not-enter' };
  const adapted = adaptVerifiedEvidence({ projection: p, audit: {} });
  assert.deepEqual(Object.keys(adapted).sort(), ['audit','authorityIdentityDigest','candidate','candidateDigest','claims','graph','graphDigest','profile','scopeId','slots','stage']);
  assert.equal(adapted.slots, p.normalizedAuthority.slots); assert.equal(adapted.scopeId, 'scope');
});
for (const [label, change, code] of [
  ['wrong argument', () => null, 'INPUT'],
  ['shared array', x => ({ ...x, candidateBytes: new Uint8Array(new SharedArrayBuffer(2)) }), 'INPUT'],
  ['duplicate file ID', x => ({ ...x, files: [x.files[0], x.files[0]] }), 'INPUT'],
  ['oversized candidate', x => ({ ...x, candidateBytes: new Uint8Array(524289) }), 'RESOURCE_LIMIT'],
  ['unknown property', x => ({ ...x, path: 'secret' }), 'INPUT'],
  ['wrong pin', x => ({ ...x, trustedAuthorityDigest: 'wrong' }), 'USAGE'],
]) test('API admission ' + label, () => assert.throws(() => snapshotApiInput(change(ready.input)), is(code)));
test('API snapshots all bytes before asynchronous work', () => {
  const data = structuredClone(ready.input), copy = snapshotApiInput(data);
  const before = copy.candidateBytes[0]; data.candidateBytes[0] ^= 1;
  assert.equal(copy.candidateBytes[0], before); assert.notEqual(copy.candidateBytes.buffer, data.candidateBytes.buffer);
});
test('API caller mutation after entry cannot affect worker', async () => {
  const data = structuredClone(ready.input), pending = evaluateReadiness(data);
  data.candidateBytes.fill(0); data.files[0].bytes.fill(0);
  assert.deepEqual(Buffer.from((await pending).resultBytes), ready.resultBytes);
});
test('API missing declared file rejects', async () => {
  await assert.rejects(evaluateReadiness({ ...ready.input, files: ready.input.files.slice(1) }), is('INPUT'));
});
test('API abort before entry is terminal', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(evaluateReadiness(ready.input, { signal: controller.signal }), is('CANCELLED'));
});
test('API abort during worker terminates', async () => {
  const controller = new AbortController();
  const pending = evaluateReadiness(ready.input, { signal: controller.signal });
  controller.abort(); await assert.rejects(pending, is('CANCELLED'));
});
test('API public evaluate and verify execute accepted integrated semantics', async () => {
  const evaluated = await evaluateReadiness(ready.input);
  const verified = await verifyReadiness({ ...ready.input, resultBytes: ready.resultBytes, decisionBytes: null });
  assert.deepEqual(Buffer.from(evaluated.resultBytes), ready.resultBytes);
  assert.deepEqual(Buffer.from(verified.resultBytes), ready.resultBytes);
  assert.equal(verified.readinessDigest, evaluated.readinessDigest);
  assert.equal(verified.proofBindingDigest, evaluated.proofBindingDigest);
  assert.equal(verified.decision, null);
});
const pin = ready.pins.expectedCandidateDigest;
const validArgs = ['evaluate','--input-root','C:\\Input','--config','config.json','--authority','authority.json','--authority-sha256',pin,'--candidate-sha256',pin,'--output-root','C:\\Output'];
for (const command of ['', 'unknown', 'constructor', 'toString', '__proto__', 'Evaluate']) test('CLI dispatch ' + JSON.stringify(command), () => assert.throws(() => parseCliArgs([command,...validArgs.slice(1)]), is('USAGE')));
for (const [label, argv, code] of [
  ['missing command', [], 'USAGE'], ['missing flag', validArgs.slice(0,-2), 'USAGE'],
  ['duplicate flag',[...validArgs,'--config','twice.json'],'USAGE'], ['unknown flag',[...validArgs,'--remote','https://example.invalid'],'USAGE'],
  ['unsafe path', validArgs.map(x => x === 'config.json' ? '../escape' : x),'FILESYSTEM_BOUNDARY'],
  ['overlong argument', validArgs.map(x => x === 'config.json' ? 'x'.repeat(181) : x),'FILESYSTEM_BOUNDARY'],
]) test('CLI negative ' + label, () => assert.throws(() => parseCliArgs(argv), is(code)));
