import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFINITIONS as D } from '../../memoryos-readiness/src/constants.mjs';
import { ReadinessError } from '../../memoryos-readiness/src/errors.mjs';
import { encodeHelperRequest, decodeHelperRequest, encodeHelperResponse, decodeHelperResponse,
  createHelperSequence, createPublicationInspection, consumePublicationInspection, inspectPublication } from '../../memoryos-readiness/src/helper-protocol.mjs';
import { createPublication, stagePublication, finalizePublication } from '../../memoryos-readiness/src/publication.mjs';
import { fixtureRequest as request, fixtureResponse as response, fixtureSession as session,
  completedAcquisition, syntheticChain, fixtureInspection, fixtureInspect, publicationOperations,
  pendingName, finalName } from '../tools/mo1307-phase2c-correction/publication-fixture.mjs';

const root = 'C:\\Private\\Output';
const attempt = fileURLToPath(new URL(`../../../.cache/mo1307/phase2c-correction/native-${process.pid}/`, import.meta.url));
const code = (fn, expected = 'INPUT') => assert.throws(fn, error => error.code === 'MO1307_' + expected);
const rejects = (fn, expected = 'INPUT') => assert.rejects(fn, error => error.code === 'MO1307_' + expected);
const sequence = (command = 'evaluate', options = {}) => createHelperSequence(command, { session, ...options });
function finishSlot(state, n, command = 'evaluate', output = root, mutate = value => value) {
  const req = request(n, command, output); state.begin(req);
  const reply = mutate(response(req)); state.complete(encodeHelperResponse(reply, req)); state.helperExited();
}
function ready(command = 'evaluate') {
  const state = completedAcquisition(command, root); state.beginWorker(); state.endWorker(); return state;
}
function capability({ state = ready(), output = root, exchange, checkpoint = () => {} } = {}) {
  return createPublicationInspection(state, output, { checkpoint,
    exchange: exchange ?? (async frame => { const req = decodeHelperRequest(frame);
      return { responseBytes: encodeHelperResponse(response(req), req), exitConfirmed: true }; }) });
}
async function owned(name) { await fs.mkdir(attempt, { recursive: true }); return path.join(attempt, name); }

test('C2C01 corrected limits leave all byte ceilings unchanged', () => {
  assert.equal(D.limits.helperRequests, 9); assert.equal(D.limits.helperVerifyRequests, 4);
  assert.equal(D.limits.helperDeadlineMs, 5000); assert.equal(D.limits.helperAggregateDeadlineMs, 20000);
  assert.equal(D.limits.helperChainComponents, 120);
  assert.equal(D.limits.helperRequestBytes, 65536); assert.equal(D.limits.helperResponseBytes, 16777216);
  assert.equal(D.limits.cliDeadlineMs, 30000); assert.equal(D.limits.apiDeadlineMs, 10000);
  assert.equal(D.limits.cleanupAllowanceMs, 2000);
});
test('C2C02 every required observation has a canonical closed framed representation', () => {
  for (let n = 4; n <= 9; n++) {
    const req = request(n, 'evaluate', root);
    assert.deepEqual(JSON.parse(JSON.stringify(decodeHelperRequest(encodeHelperRequest(req)))), req);
    const reply = response(req);
    assert.deepEqual(JSON.parse(JSON.stringify(decodeHelperResponse(encodeHelperResponse(reply, req), req))), reply);
    assert.ok(reply.roots[0].chain.length >= 2);
  }
});
test('C2C03 old wire version missing session unknown fields and arbitrary operations reject', () => {
  for (const change of [{ version: '1.0.0' }, { session: undefined }, { session: 'X'.repeat(64) },
    { executable: 'powershell' }, { operation: 'EXEC' }, { operation: 'READ_SET', sequence: 5 }]) {
    code(() => encodeHelperRequest({ ...request(), ...change }));
  }
});
test('C2C04 operation sequence and fixed output leaf authority are closed', () => {
  for (let n = 5; n <= 9; n++) {
    for (const operation of publicationOperations.filter(value => value !== publicationOperations[n - 5])) {
      code(() => encodeHelperRequest({ ...request(n, 'evaluate', root), operation }));
    }
    code(() => encodeHelperRequest({ ...request(n, 'evaluate', root), files: [{ id: 'x', root: 'output', path: 'x', maxBytes: 1 }] }));
  }
  code(() => encodeHelperRequest({ ...request(9, 'evaluate', root), sequence: 10 }));
});
test('C2C05 bounded frames reject trailing requests responses and alternate session', () => {
  const req = request(9, 'evaluate', root), bytes = encodeHelperResponse(response(req), req);
  code(() => decodeHelperResponse(Buffer.concat([bytes, bytes]), req));
  const input = encodeHelperRequest(req); code(() => decodeHelperRequest(Buffer.concat([input, input])));
  code(() => encodeHelperResponse({ ...response(req), session: '1'.repeat(64) }, req));
  code(() => encodeHelperResponse({ ...response(req), extra: [] }, req));
  const cap = Buffer.alloc(4); cap.writeUInt32BE(D.limits.helperResponseBytes - 3);
  code(() => decodeHelperResponse(cap, req), 'RESOURCE_LIMIT');
});
test('C2C06 complete acquisition then terminated worker then five publication requests', () => {
  const state = sequence(); for (let n = 1; n <= 4; n++) finishSlot(state, n);
  state.beginWorker(); state.endWorker();
  for (let n = 5; n <= 9; n++) finishSlot(state, n);
  code(() => state.begin(request(9, 'evaluate', root)));
});
test('C2C07 helper completion cannot substitute for fully quiescent exit', () => {
  const state = sequence(), req = request(); state.begin(req); state.complete(encodeHelperResponse(response(req), req));
  code(() => state.begin(request(2))); code(() => state.helperExited());
  const beforeWorker = sequence(); for (let n = 1; n <= 3; n++) finishSlot(beforeWorker, n);
  const last = request(4, 'evaluate', root); beforeWorker.begin(last); beforeWorker.complete(encodeHelperResponse(response(last), last));
  code(() => beforeWorker.beginWorker()); code(() => beforeWorker.helperExited());
});
test('C2C08 helper and worker overlap and repeated worker transition are terminal', () => {
  const running = completedAcquisition('evaluate', root); running.beginWorker();
  code(() => running.begin(request(5, 'evaluate', root))); code(() => running.endWorker());
  const early = sequence(); code(() => early.beginWorker()); code(() => early.begin(request()));
  const duplicate = ready(); code(() => duplicate.beginWorker());
});
test('C2C09 verify remains four reads followed by worker and cannot publish', () => {
  const state = ready('verify');
  code(() => createPublicationInspection(state, root, { exchange: async () => {}, checkpoint: () => {} }));
  code(() => state.begin(request(5, 'evaluate', root)));
  const decision = request(4, 'verify', 'C:\\Result');
  decision.roots.unshift({ id: 'input', path: 'C:\\Input' });
  decision.files.unshift({ id: 'decision', path: 'decision.json', root: 'input', maxBytes: D.limits.decisionBytes });
  decodeHelperResponse(encodeHelperResponse(response(decision), decision), decision);
});
test('C2C10 request failure abort and transport failure permit no retry', async () => {
  const state = sequence(); state.begin(request()); state.abort(); code(() => state.begin(request()));
  const cap = capability({ exchange: async () => { throw new Error('fixture transport failure'); } });
  consumePublicationInspection(cap, root); await assert.rejects(() => inspectPublication(cap, 'CHECK_OUTPUT'));
  await rejects(() => inspectPublication(cap, 'CHECK_OUTPUT'));
});
test('C2C11 full component chains reject missing ancestors wrong paths reparse and hardlinks', () => {
  const req = request(8, 'evaluate', root), original = response(req);
  for (const change of [chain => chain.shift(), chain => { chain.at(-1).finalPath = 'C:\\Other\\' + pendingName; },
    chain => { chain[1].attributes |= 0x400; }, chain => { chain.at(-1).linkCount = 2; }]) {
    const reply = structuredClone(original); change(reply.roots[0].chain);
    code(() => encodeHelperResponse(reply, req), 'FILESYSTEM_BOUNDARY');
  }
  const long = structuredClone(original); long.roots[0].chain = Array.from({ length: 121 }, () => original.roots[0].chain[0]);
  code(() => encodeHelperResponse(long, req), 'RESOURCE_LIMIT');
  for (const malformed of [null, {}, 'not-a-chain']) {
    const reply = structuredClone(original); reply.roots[0].chain = malformed;
    code(() => encodeHelperResponse(reply, req));
  }
});
test('C2C12 acquisition parent cannot be reused after native identity change', () => {
  const state = ready(); const req = request(5, 'evaluate', root); state.begin(req);
  const changed = response(req); changed.roots[0].chain.at(-1).fileId = '0000000000000002';
  code(() => state.complete(encodeHelperResponse(changed, req)), 'FILESYSTEM_BOUNDARY');
  code(() => state.begin(req));
});
test('C2C13 path and cross-invocation session substitutions terminate assessment', () => {
  const changedRoot = ready(); code(() => changedRoot.begin(request(5, 'evaluate', 'C:\\Private\\Other')), 'FILESYSTEM_BOUNDARY');
  code(() => changedRoot.begin(request(5, 'evaluate', root)));
  const changedSession = sequence(); code(() => changedSession.begin({ ...request(), session: '1'.repeat(64) }));
  code(() => changedSession.begin(request()));
});
test('C2C14 capability branding root binding and single claim exclude substitution', async () => {
  code(() => consumePublicationInspection({}, root));
  const cap = capability(); code(() => consumePublicationInspection(cap, 'C:\\Private\\Other'), 'FILESYSTEM_BOUNDARY');
  code(() => consumePublicationInspection(cap, root));
  const used = capability(); consumePublicationInspection(used, root); code(() => consumePublicationInspection(used, root));
  await rejects(() => inspectPublication(used, 'CHECK_OUTPUT'));
  const wrongFactory = ready(); code(() => capability({ state: wrongFactory, output: 'C:\\Private\\Other' }), 'FILESYSTEM_BOUNDARY');
  code(() => capability({ state: wrongFactory }));
  const state = ready(); const original = capability({ state }); code(() => capability({ state }));
  code(() => consumePublicationInspection(original, root));
});
test('C2C15 unclaimed out-of-order or concurrent inspection cannot be retried', async () => {
  const unclaimed = capability(); await rejects(() => inspectPublication(unclaimed, 'CHECK_OUTPUT'));
  code(() => consumePublicationInspection(unclaimed, root));
  const order = capability(); consumePublicationInspection(order, root);
  await rejects(() => inspectPublication(order, 'INSPECT_OUTPUT_ROOT')); await rejects(() => inspectPublication(order, 'CHECK_OUTPUT'));
  let release; const busy = capability({ exchange: async frame => { await new Promise(resolve => { release = resolve; });
    const req = decodeHelperRequest(frame); return { responseBytes: encodeHelperResponse(response(req), req), exitConfirmed: true }; } });
  consumePublicationInspection(busy, root); const pending = inspectPublication(busy, 'CHECK_OUTPUT');
  await rejects(() => inspectPublication(busy, 'CHECK_OUTPUT')); release(); await rejects(() => pending);
});
test('C2C16 bridge requires exact transport fields and confirmed process quiescence', async () => {
  for (const change of [{ exitConfirmed: false }, { extra: 1 }]) {
    const cap = capability({ exchange: async frame => { const req = decodeHelperRequest(frame);
      return { responseBytes: encodeHelperResponse(response(req), req), exitConfirmed: true, ...change }; } });
    consumePublicationInspection(cap, root); await rejects(() => inspectPublication(cap, 'CHECK_OUTPUT'));
    await rejects(() => inspectPublication(cap, 'CHECK_OUTPUT'));
  }
});
test('C2C17 per-invocation deadline includes response parsing and process exit', () => {
  for (const boundary of ['complete', 'exit']) {
    let now = 0; const state = sequence('evaluate', { now: () => now }), req = request(); state.begin(req);
    if (boundary === 'exit') { now = 4999; state.complete(encodeHelperResponse(response(req), req)); }
    now = 5000; code(() => boundary === 'complete' ? state.complete(encodeHelperResponse(response(req), req)) : state.helperExited(), 'TIMEOUT');
    code(() => state.begin(req));
  }
});
test('C2C18 aggregate helper budget cannot silently multiply with sequential invocations', () => {
  let now = 0; const state = sequence('evaluate', { now: () => now });
  for (let n = 1; n <= 4; n++) { const req = request(n, 'evaluate', root); state.begin(req); now += 4999;
    state.complete(encodeHelperResponse(response(req), req)); state.helperExited(); }
  state.beginWorker(); state.endWorker(); const next = request(5, 'evaluate', root); state.begin(next);
  now += 4; code(() => state.complete(encodeHelperResponse(response(next), next)), 'TIMEOUT');
});
test('C2C19 overall CLI deadline and nonmonotonic clock fail without grace', () => {
  let now = 0; const state = sequence('evaluate', { now: () => now });
  for (let n = 1; n <= 4; n++) finishSlot(state, n); state.beginWorker(); now = 30000;
  code(() => state.endWorker(), 'TIMEOUT');
  let clock = 10; const backwards = sequence('evaluate', { now: () => clock }); clock = 9; code(() => backwards.begin(request()));
});
test('C2C20 framed publication performs exact five observations and one final rename', async () => {
  const output = await owned('complete'), observed = [];
  const inspection = await fixtureInspection(output, { observe: req => observed.push([req.sequence, req.operation]) });
  const token = await createPublication(output, { inspection }); const bytes = Buffer.from('{"fixture":true}\n');
  await stagePublication(token, bytes); const result = await finalizePublication(token);
  assert.deepEqual(observed, publicationOperations.map((operation, index) => [index + 5, operation]));
  assert.deepEqual(await fs.readdir(output), [finalName]); assert.deepEqual(await fs.readFile(result.path), bytes);
  await rejects(() => finalizePublication(token), 'OUTPUT');
});
test('C2C21 cancellation after each publication inspection is terminal and retains incomplete attempt', async () => {
  for (const target of publicationOperations) {
    const output = await owned('cancel-' + target.toLowerCase()); let observed = null;
    const inspection = await fixtureInspection(output, { observe: req => { observed = req.operation; }, checkpoint: () => {
      if (observed === target) throw new ReadinessError('CANCELLED', 'PUBLICATION'); } });
    let token;
    await rejects(async () => { token = await createPublication(output, { inspection });
      await stagePublication(token, Buffer.from('{}\n')); await finalizePublication(token); }, 'CANCELLED');
    const entries = await fs.readdir(output).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (target === 'CHECK_OUTPUT') assert.equal(entries, null);
    else if (['INSPECT_PENDING', 'CHECK_FINALIZATION'].includes(target)) assert.deepEqual(entries, [pendingName]);
    else assert.deepEqual(entries, []);
    if (token) await rejects(() => finalizePublication(token), 'OUTPUT');
  }
});
test('C2C22 immediate pre-rename checkpoint blocks timeout after final native observation', async () => {
  const output = await owned('deadline-before-rename'); let finalizedObservation = false, checks = 0;
  const inspection = await fixtureInspection(output, { observe: req => { if (req.operation === 'CHECK_FINALIZATION') finalizedObservation = true; },
    checkpoint: () => { if (finalizedObservation && ++checks === 2) throw new ReadinessError('TIMEOUT', 'PUBLICATION'); } });
  const token = await createPublication(output, { inspection }); await stagePublication(token, Buffer.from('{}\n'));
  await rejects(() => finalizePublication(token), 'TIMEOUT'); assert.deepEqual(await fs.readdir(output), [pendingName]);
});
test('C2C23 final native pending identity comparison rejects stale replacement and retains bytes', async () => {
  const output = await owned('stale-final'); let phase = null;
  const inspection = await fixtureInspection(output, { observe: req => { phase = req.operation; }, inspect: async (...args) => {
    const chain = await fixtureInspect(...args); if (phase === 'CHECK_FINALIZATION') chain.at(-1).fileId = '000000000000ffff'; return chain; } });
  const token = await createPublication(output, { inspection }); await stagePublication(token, Buffer.from('{}\n'));
  await rejects(() => finalizePublication(token), 'OUTPUT'); assert.deepEqual(await fs.readdir(output), [pendingName]);
});
test('C2C24 mismatched branded capability and legacy callback cannot create an output root', async () => {
  const output = await owned('substitution');
  await rejects(() => createPublication(output, { inspection: capability() }), 'OUTPUT');
  await rejects(() => createPublication(output, { inspect: fixtureInspect }), 'OUTPUT');
  assert.equal(await fs.stat(output).catch(error => error.code), 'ENOENT');
});
