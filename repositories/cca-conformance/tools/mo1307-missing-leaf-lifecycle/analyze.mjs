// Offline analysis correction for the one sealed execution. Never launches a helper or another process.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const base = 'repositories/cca-conformance/evidence/mo1307/missing-leaf-lifecycle';
const observation = base + '/diagnostic-observation';
const preparation = base + '/diagnostic-preparation-2';
const output = base + '/diagnostic-analysis-correction';
const tool = 'repositories/cca-conformance/tools/mo1307-missing-leaf-lifecycle';
const abs = relative => path.join(root, relative);
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const record = file => { const bytes = fs.readFileSync(file); return { path: path.relative(root, file).replaceAll('\\', '/'), byteLength: bytes.length, sha256: hash(bytes) }; };
const read = relative => fs.readFileSync(abs(relative));
const json = relative => JSON.parse(read(relative).toString('utf8'));
const put = (name, value) => { const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + '\n'); fs.writeFileSync(abs(output + '/' + name), bytes, { flag: 'wx' }); return record(abs(output + '/' + name)); };
const check = binding => assert.deepEqual(record(abs(binding.path)), binding);
const ms = nanoseconds => Number(nanoseconds) / 1e6;

assert.equal(process.argv.length, 2, 'Offline analysis accepts no alternate observation');
assert.equal(path.resolve(root).toLowerCase(), 'c:\\m7fix');
assert.equal(process.version, 'v24.21.0');
assert.equal(fs.existsSync(abs(output)), false, 'Offline analysis correction already exists');

const receipt = json(observation + '/receipt.json');
const stopped = json(observation + '/stopped.json');
const seal = json(observation + '/seal.json');
const invocationStart = json(observation + '/invocation-start.json');
const proof = json(preparation + '/preparation.json');
const rules = json(tool + '/classification-rules.json');
assert.equal(receipt.result, 'DIAGNOSTIC_INCOMPLETE');
assert.equal(receipt.classification, 'DIAGNOSTIC_INCOMPLETE');
assert.equal(receipt.helperInvocations, 1);
assert.equal(receipt.retries, 0); assert.equal(receipt.alternateInputs, 0);
assert.equal(stopped.outcome, 'DIAGNOSTIC_INCOMPLETE'); assert.equal(stopped.noRetry, true); assert.equal(stopped.noSecondSample, true);
assert.equal(receipt.fatal.name, 'AssertionError');
assert.ok(receipt.fatal.message.includes("'rootValidations'"));
assert.ok(receipt.fatal.message.includes("'chainComponents'"));
assert.ok(receipt.fatal.stack.includes('observe.mjs:247:10'));
assert.equal(receipt.sourceUnchanged, true); assert.equal(receipt.fixtureUnchanged, true);
assert.equal(proof.result, 'PASS'); assert.equal(proof.helperExecutions, 0); assert.equal(proof.expectedCounts.responseBytes, 239);

const rawBindings = [record(abs(observation + '/receipt.json')), record(abs(observation + '/stopped.json')),
  record(abs(observation + '/seal.json')), record(abs(observation + '/invocation-start.json')),
  receipt.row.stdout, receipt.row.stderr, record(abs(preparation + '/preparation.json')),
  record(abs(tool + '/classification-rules.json')), record(abs(tool + '/observe.mjs')), record(fileURLToPath(import.meta.url)),
  record(abs(base + '/authorization.txt')), proof.request, proof.expectedResponse, proof.source, proof.sourceInventory];
for (const binding of rawBindings) check(binding);
assert.deepEqual(receipt.row.seal, rawBindings[2]);
assert.deepEqual(seal.preparation, rawBindings[6]);
assert.deepEqual(invocationStart.seal, rawBindings[2]);
assert.deepEqual(invocationStart.request, proof.request); assert.deepEqual(invocationStart.diagnosticHelper, proof.diagnosticCopy);
assert.equal(invocationStart.invocationsAllowed, 1); assert.equal(invocationStart.retries, 0);
assert.deepEqual(seal.source, proof.sourceMembers);
for (const binding of [...seal.source, ...seal.bindings]) check(binding);
assert.deepEqual(seal.classificationRules, record(abs(tool + '/classification-rules.json')));
assert.deepEqual(seal.request, proof.request); assert.deepEqual(seal.expectedResponse, proof.expectedResponse);
assert.equal(receipt.row.transport.outcome, 'RESOLVED'); assert.equal(receipt.row.transport.exitConfirmed, true);
assert.equal(receipt.row.transport.responseBytes, 239); assert.equal(receipt.row.exitCode, 0); assert.equal(receipt.row.exitSignal, null);
assert.equal(receipt.row.t0ToT14Ms, 3167.0189);
assert.equal(receipt.row.totalBytes.stdout, 239); assert.equal(receipt.row.totalBytes.stderr, 1653);
assert.equal(receipt.row.captureTruncated, false);
assert.ok(Object.values(receipt.row.states).every(Boolean));

const stdout = read(observation + '/stdout.bin'), stderr = read(observation + '/stderr.txt');
const expectedResponse = read(preparation + '/expected-response.bin');
assert.deepEqual(stdout, expectedResponse);
assert.equal(stdout.length, 239); assert.equal(hash(stdout), 'sha256:f613a4ff5e77ede05ac444f4c44670cebd60aa7ac097abb7db1e472511a6f2ea');
assert.equal(stdout.readUInt32BE(0), 235);
const response = JSON.parse(stdout.subarray(4).toString('utf8'));
assert.equal(response.status, 'ERROR'); assert.equal(response.code, 'MO1307_INPUT');
assert.deepEqual(response.files, []); assert.deepEqual(response.roots, []);
assert.equal(response.operation, 'READ_SET'); assert.equal(response.sequence, 3);
assert.equal(response.session, 'a1'.repeat(32)); assert.equal(response.version, '2.0.0');

const lines = stderr.toString('ascii').split(/\r?\n/u).filter(Boolean);
const stageLines = lines.filter(line => /^MO1307D\|T(?:[1-9]|1[0-3])\|/u.test(line));
const snapshotLines = lines.filter(line => line.startsWith('MO1307D|SNAPSHOT|'));
assert.equal(lines.length, 16); assert.equal(stageLines.length, 13); assert.equal(snapshotLines.length, 3);
const observedOrder = lines.map(line => {
  const stage = /^MO1307D\|(T(?:[1-9]|1[0-3]))\|/u.exec(line)?.[1];
  if (stage) return stage;
  const snapshot = /^MO1307D\|SNAPSHOT\|(T(?:7|8|10))\|/u.exec(line)?.[1];
  return snapshot ? 'SNAPSHOT_' + snapshot : null;
});
assert.deepEqual(observedOrder, ['T1','T2','T3','T4','T5','T6','T7','SNAPSHOT_T7','T8','SNAPSHOT_T8','T9','T10','SNAPSHOT_T10','T11','T12','T13']);
assert.equal(receipt.row.markerReceipts.length, 16);
for (let index = 0; index < lines.length; index++) assert.equal(receipt.row.markerReceipts[index].line, lines[index]);
let frequency = null;
const stageTicks = new Map();
for (const line of stageLines) {
  const parts = line.split('|'); assert.equal(parts.length, 4); assert.equal(stageTicks.has(parts[1]), false);
  const tick = BigInt(parts[2]), currentFrequency = BigInt(parts[3]); frequency ??= currentFrequency; assert.equal(currentFrequency, frequency);
  stageTicks.set(parts[1], tick);
}
assert.equal(frequency, 10000000n); assert.equal(stageTicks.size, 13);
let previousTick = 0n;
for (let index = 1; index <= 13; index++) { const tick = stageTicks.get('T' + index); assert.ok(tick >= previousTick); previousTick = tick; }

function parseSnapshot(line) {
  const parts = line.split('|'); assert.equal(parts.length, 4); assert.equal(parts[0], 'MO1307D'); assert.equal(parts[1], 'SNAPSHOT');
  const source = parts[3], matches = [...source.matchAll(/(?:^| )([A-Za-z][A-Za-z0-9]*)=(-?\d+)(?= |$)/gu)];
  assert.ok(matches.length > 0);
  assert.equal(matches.map(match => match[0].trim()).join(' '), source);
  const counts = {};
  for (const match of matches) { assert.equal(Object.hasOwn(counts, match[1]), false, 'Duplicate snapshot key'); counts[match[1]] = Number(match[2]); }
  return { stage: parts[2], counts };
}
const snapshots = new Map(snapshotLines.map(line => { const parsed = parseSnapshot(line); return [parsed.stage, parsed.counts]; }));
assert.deepEqual([...snapshots.keys()], ['T7', 'T8', 'T10']);
const expectedKeys = Object.keys(proof.expectedCounts).filter(key => key !== 'nativeImportedCalls').sort();
for (const counts of snapshots.values()) assert.deepEqual(Object.keys(counts).sort(), expectedKeys);
const decisionCounts = snapshots.get('T7'), acquisitionCounts = snapshots.get('T8'), serializedCounts = snapshots.get('T10');
for (const [key, value] of Object.entries(proof.expectedCounts)) {
  if (key !== 'nativeImportedCalls' && key !== 'responseBytes') assert.equal(acquisitionCounts[key], value, 'T8 ' + key);
  if (key !== 'nativeImportedCalls') assert.equal(serializedCounts[key], value, 'T10 ' + key);
}
assert.equal(acquisitionCounts.responseBytes, 0); assert.equal(decisionCounts.handleDisposals, 0); assert.equal(decisionCounts.responseBytes, 0);
for (const key of expectedKeys.filter(key => !['handleDisposals', 'responseBytes'].includes(key))) assert.equal(decisionCounts[key], acquisitionCounts[key], 'T7 ' + key);
const nativeImportedCalls = acquisitionCounts.createFileW + acquisitionCounts.getFileInformationByHandle
  + acquisitionCounts.getFinalPathNameByHandleW + acquisitionCounts.getFileType + acquisitionCounts.getStdHandle
  + acquisitionCounts.getConsoleProcessList + acquisitionCounts.freeConsole;
assert.equal(nativeImportedCalls, 57);

const t0 = BigInt(receipt.row.t0HrtimeNs), t14 = BigInt(receipt.row.t14HrtimeNs);
const toNs = tick => tick * 1000000000n / frequency;
const absolute = { T0: t0, T14: t14 };
for (let index = 1; index <= 13; index++) absolute['T' + index] = toNs(stageTicks.get('T' + index));
let prior = absolute.T0;
for (let index = 1; index <= 14; index++) { const value = absolute['T' + index]; assert.ok(value >= prior); prior = value; }
assert.equal(ms(t14 - t0), receipt.row.t0ToT14Ms);
const receipts = new Map();
for (const item of receipt.row.markerReceipts) {
  const match = /^MO1307D\|(T(?:[1-9]|1[0-3]))\|/u.exec(item.line);
  if (match) { assert.equal(receipts.has(match[1]), false); receipts.set(match[1], item); }
}
assert.equal(receipts.size, 13);
for (let index = 1; index <= 13; index++) {
  const stage = 'T' + index, observed = BigInt(receipts.get(stage).observerHrtimeNs);
  assert.ok(observed + 1000000n >= absolute[stage]); assert.ok(observed <= t14 + 1000000n);
}

const adjacent = [];
for (let index = 0; index < 14; index++) {
  const start = 'T' + index, end = 'T' + (index + 1);
  adjacent.push({ start, end, durationMs: ms(absolute[end] - absolute[start]) });
}
const buckets = rules.buckets.map(bucket => ({ name: bucket.name, start: bucket.start, end: bucket.end,
  durationMs: ms(absolute[bucket.end] - absolute[bucket.start]),
  percentOfLifecycle: Number((100 * ms(absolute[bucket.end] - absolute[bucket.start]) / ms(t14 - t0)).toFixed(6)) }));
assert.ok(Math.abs(buckets.reduce((sum, bucket) => sum + bucket.durationMs, 0) - ms(t14 - t0)) < 0.0001);
const dominant = buckets.filter(bucket => bucket.durationMs > ms(t14 - t0) * 0.5);
const classification = dominant.length === 1 ? dominant[0].name : rules.fallback;
assert.equal(classification, 'COMMON_STARTUP_COST_DOMINANT');

fs.mkdirSync(abs(output), { recursive: false });
const analysis = {
  kind: 'MO1307MissingLeafLifecycleOfflineAnalysisCorrection', result: 'PASS', classification,
  helperExecutionsAdded: 0, totalAuthorizedHelperExecutions: 1, retries: 0, alternateInputs: 0,
  originalReceipt: rawBindings[0], originalStopped: rawBindings[1], seal: rawBindings[2], stdout: receipt.row.stdout, stderr: receipt.row.stderr,
  parserCorrection: {
    originalFailure: 'Observer expected comma-separated snapshot fields after PowerShell emitted one space-separated key=value string.',
    correction: 'Parse the already sealed snapshot payload with a closed ASCII key=integer grammar. No helper, request, fixture, deadline, or measured byte changed.',
    rawEvidenceComplete: true, originalDiagnosticIncompleteReceiptPreserved: true
  },
  lifecycle: { totalMs: ms(t14 - t0), withinFrozen5000Ms: ms(t14 - t0) < 5000,
    marginMs: 5000 - ms(t14 - t0), adjacentIntervals: adjacent, buckets,
    cumulativeMs: Object.fromEntries(Array.from({ length: 15 }, (_, index) => ['T' + index, ms(absolute['T' + index] - t0)])) },
  counters: { atDecisionT7: decisionCounts, afterUnwindT8: acquisitionCounts, afterSerializationT10: serializedCounts,
    nativeImportedCalls },
  response: { byteLength: stdout.length, sha256: hash(stdout), status: response.status, code: response.code,
    files: response.files.length, roots: response.roots.length },
  transport: receipt.row.transport, process: { exitCode: receipt.row.exitCode, signal: receipt.row.exitSignal, states: receipt.row.states },
  invariants: { sourceUnchanged: receipt.sourceUnchanged, fixtureUnchanged: receipt.fixtureUnchanged,
    packageMembers: proof.sourceMembers.length, stdoutExactExpectedBytes: stdout.equals(expectedResponse),
    noLatencyDistributionClaim: true, diagnosticOnly: true, productValidation: false, certification: false },
  bindings: rawBindings, analyzedUtc: new Date().toISOString()
};
const analysisRecord = put('analysis.json', analysis);
put('receipt.json', { kind: 'MO1307MissingLeafLifecycleOfflineAnalysisReceipt', result: 'PASS', classification,
  helperExecutionsAdded: 0, totalAuthorizedHelperExecutions: 1, retries: 0, analysis: analysisRecord,
  scope: 'Offline correction of the counter-delimiter parser over the single sealed observation. No second sample or helper execution.',
  finishedUtc: new Date().toISOString() });
console.log(JSON.stringify({ result: 'PASS', classification, helperExecutionsAdded: 0, analysis: analysisRecord }));
