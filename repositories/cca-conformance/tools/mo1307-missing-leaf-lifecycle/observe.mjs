// Exactly one instrumented missing-leaf execution under the unchanged product supervisor. No retry.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createSupervisor } from '../../../memoryos-readiness/src/runtime.mjs';
import { createHelperTransportForTesting, helperLaunchSpecification } from '../../../memoryos-readiness/src/helper-transport.mjs';
import { decodeHelperRequest, decodeHelperResponse } from '../../../memoryos-readiness/src/helper-protocol.mjs';
import { DEFINITIONS } from '../../../memoryos-readiness/src/constants.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const tool = 'repositories/cca-conformance/tools/mo1307-missing-leaf-lifecycle';
const base = 'repositories/cca-conformance/evidence/mo1307/missing-leaf-lifecycle';
const preparation = base + '/diagnostic-preparation-2';
const output = base + '/diagnostic-observation';
const prior = 'repositories/cca-conformance/evidence/mo1307/slot5-deadline-correction/native-filesystem';
const expectedPrior = 'repositories/cca-conformance/evidence/mo1307/n15-correction/native-filesystem';
const baseHead = '0599476f53815a4ccd05e0ba3cac600396ca201c';
const productionTree = '6a0bf13aaf40e20b68e469989b5a34ef74cf2903';
const abs = relative => path.join(root, relative);
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const record = file => { const bytes = fs.readFileSync(file); return { path: path.relative(root, file).replaceAll('\\', '/'), byteLength: bytes.length, sha256: hash(bytes) }; };
const check = binding => assert.deepEqual(record(abs(binding.path)), binding);
const read = relative => fs.readFileSync(abs(relative));
const json = relative => JSON.parse(read(relative).toString('utf8'));
const errorRecord = error => ({ name: error?.name ?? null, code: error?.code ?? null, stage: error?.stage ?? null, message: error?.message ?? String(error), stack: error?.stack ?? null });
const put = (name, bytes) => { fs.writeFileSync(abs(output + '/' + name), bytes, { flag: 'wx' }); return record(abs(output + '/' + name)); };
const write = (name, value) => put(name, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
const walk = (directory, prefix = '') => fs.readdirSync(path.join(directory, prefix), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1).flatMap(entry => {
  const relative = prefix ? prefix + '/' + entry.name : entry.name;
  const stat = fs.lstatSync(path.join(directory, relative));
  assert.equal(stat.isSymbolicLink(), false);
  return stat.isDirectory() ? walk(directory, relative) : [{ ...record(path.join(directory, relative)), relative }];
});
const topology = (directory, prefix = '') => fs.readdirSync(path.join(directory, prefix), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1).flatMap(entry => {
  const relative = prefix ? prefix + '/' + entry.name : entry.name;
  const stat = fs.lstatSync(path.join(directory, relative));
  assert.equal(stat.isSymbolicLink(), false);
  return [{ relative, type: stat.isDirectory() ? 'directory' : 'file' }, ...(stat.isDirectory() ? topology(directory, relative) : [])];
});
function git(...args) {
  const result = spawnSync('C:/Program Files/Git/cmd/git.exe', ['-c', 'safe.directory=C:/m7fix', ...args], { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
const nsMs = value => Number(value) / 1e6;

assert.equal(process.argv.length, 2, 'No alternate case, request, or launch option');
assert.equal(path.resolve(root).toLowerCase(), 'c:\\m7fix');
assert.equal(process.platform, 'win32');
assert.equal(process.arch, 'x64');
assert.equal(process.version, 'v24.21.0');
assert.equal(fs.existsSync(abs(output)), false, 'The one diagnostic generation has already been consumed');
assert.equal(git('rev-parse', 'HEAD'), baseHead);
assert.equal(git('branch', '--show-current'), 'codex/mo1307-missing-leaf-lifecycle');
assert.equal(git('rev-parse', 'HEAD:repositories/memoryos-readiness'), productionTree);
assert.equal(git('status', '--short', '--', 'repositories/memoryos-readiness'), '', 'Production package must be unmodified');

const proof = json(preparation + '/preparation.json');
assert.equal(proof.result, 'PASS');
assert.equal(proof.helperExecutions, 0);
assert.equal(proof.exactInverseEquality, true);
assert.equal(proof.source.sha256, 'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127');
for (const binding of [proof.source, proof.sourceInventory, proof.generator, proof.observer, proof.diagnosticCopy, proof.inverse, proof.ledger,
  proof.request, proof.retainedRequest, proof.expectedResponse, proof.retainedExpectedResponse, ...proof.sourceMembers]) check(binding);
assert.deepEqual(read(preparation + '/inverse-reconstruction.ps1.data'), read(proof.source.path));
assert.deepEqual(walk(proof.fixtureRoot), proof.fixtureFiles);
assert.deepEqual(topology(proof.fixtureRoot), proof.fixtureTopology);
assert.equal(fs.existsSync(proof.missingLeaf), false);

const frame = read(preparation + '/request.bin');
assert.deepEqual(frame, read(prior + '/018.request.bin'));
assert.equal(frame.length, 370);
assert.equal(hash(frame), 'sha256:bc7fc31df72889016b27af48de1693cddadf3181d2f763d78d1ddec73b24c5ee');
const request = decodeHelperRequest(frame);
assert.equal(request.operation, 'READ_SET');
assert.equal(request.sequence, 3);
assert.equal(request.files.length, 1);
assert.deepEqual(Object.keys(request.files[0]).sort(), ['id', 'maxBytes', 'path', 'root']);
assert.equal(request.files[0].id, 'missing'); assert.equal(request.files[0].maxBytes, 2097152);
assert.equal(request.files[0].path, 'missing.bin'); assert.equal(request.files[0].root, 'input');
assert.equal(request.roots.length, 1);
assert.equal(path.resolve(request.roots[0].path).toLowerCase(), proof.fixtureRoot.toLowerCase());
const expectedResponse = read(preparation + '/expected-response.bin');
assert.deepEqual(expectedResponse, read(expectedPrior + '/018.response.bin'));
assert.equal(expectedResponse.length, 239);
assert.equal(hash(expectedResponse), 'sha256:f613a4ff5e77ede05ac444f4c44670cebd60aa7ac097abb7db1e472511a6f2ea');
const expectedDecoded = decodeHelperResponse(expectedResponse, request);
assert.deepEqual({ status: expectedDecoded.status, code: expectedDecoded.code, files: expectedDecoded.files, roots: expectedDecoded.roots },
  { status: 'ERROR', code: 'MO1307_INPUT', files: [], roots: [] });

const launch = helperLaunchSpecification();
const limits = DEFINITIONS.limits;
for (const [key, value] of Object.entries({ helperDeadlineMs: 5000, helperAggregateDeadlineMs: 20000, cliDeadlineMs: 30000,
  cleanupAllowanceMs: 2000, stderrBytes: 4096, helperResponseBytes: 16777216 })) assert.equal(limits[key], value);
assert.equal(launch.options.detached, false);
assert.equal(launch.options.windowsHide, true);
assert.equal(launch.options.shell, false);
assert.deepEqual([...launch.options.stdio], ['pipe', 'pipe', 'pipe']);
assert.deepEqual({ ...launch.options.env }, { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' });
assert.equal(path.resolve(launch.args.at(-1)), path.resolve(abs(proof.source.path)));
const diagnosticArgs = [...launch.args];
diagnosticArgs[diagnosticArgs.length - 1] = abs(proof.diagnosticCopy.path);
const rules = json(tool + '/classification-rules.json');
assert.equal(rules.dominance.includes('greater than 50 percent'), true);
assert.deepEqual(rules.limits, { helperWholeLifecycleMs: 5000, failureCleanupMs: 2000, invocations: 1, retries: 0, alternateInputs: 0 });
const staticBindings = [record(abs(base + '/authorization.txt')), record(abs(tool + '/instrument.mjs')), record(abs(tool + '/observe.mjs')),
  record(abs(tool + '/classification-rules.json')), record(abs(preparation + '/preparation.json')),
  proof.preflightCorrection, proof.priorPreparation,
  record(abs(prior + '/017.invocation.json')), record(abs(prior + '/017.request.bin')), record(abs(prior + '/017.response.bin')),
  record(abs(prior + '/018.invocation.json')), record(abs(prior + '/018.request.bin')), record(abs(expectedPrior + '/018.invocation.json')),
  record(abs(expectedPrior + '/018.response.bin')), record(abs('docs/mo1307-contract-freeze-1.md')),
  record(abs('docs/mo1307-missing-leaf-lifecycle.md')), record(abs('repositories/memoryos-readiness/helpers/README.md')),
  record(process.execPath), record(launch.executable)];

fs.mkdirSync(abs(output), { recursive: false });
let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), transportAnswer = null, transportError = null, fatal = null;
let sourceUnchanged = false, fixtureUnchanged = false, classification = 'DIAGNOSTIC_INCOMPLETE';
const row = { kind: 'one-instrumented-missing-leaf', helperInvocations: 0, retries: 0, alternateInputs: 0, events: [], markerReceipts: [], startedUtc: new Date().toISOString() };
let t0 = null, t0PerformanceMs = null, t0PerformanceUncertaintyMs = null, t14 = null, childCode = null, childSignal = null, stderrPending = '';
const captured = { stdout: [], stderr: [] }, totals = { stdout: 0, stderr: 0 };
const states = { stdinFinished: false, stdinClosed: false, stdoutEnded: false, stdoutClosed: false, stderrEnded: false, stderrClosed: false, processExited: false, processClosed: false };
const elapsed = at => t0 === null ? null : nsMs(at - t0);
const event = (name, detail = {}) => { const at = process.hrtime.bigint(); row.events.push({ name, elapsedMs: elapsed(at), ...detail }); return at; };
const maybeT14 = () => {
  if (t14 === null && states.stdinClosed && states.stdoutClosed && states.stderrClosed && states.processClosed) {
    t14 = process.hrtime.bigint(); row.events.push({ name: 'T14', elapsedMs: elapsed(t14) });
  }
};
const consumeDiagnosticText = (text, at) => {
  stderrPending += text;
  for (;;) {
    const newline = stderrPending.indexOf('\n');
    if (newline < 0) break;
    const line = stderrPending.slice(0, newline).replace(/\r$/u, ''); stderrPending = stderrPending.slice(newline + 1);
    if (line.length) row.markerReceipts.push({ line, elapsedMs: elapsed(at), observerHrtimeNs: at.toString() });
  }
};
const snapshotObservation = () => {
  stdout = Buffer.concat(captured.stdout); stderr = Buffer.concat(captured.stderr);
  row.totalBytes = { ...totals };
  row.captureTruncated = stdout.length !== totals.stdout || stderr.length !== totals.stderr;
  row.states = { ...states };
  row.exitCode = childCode; row.exitSignal = childSignal;
  row.t0HrtimeNs = t0?.toString() ?? null; row.t14HrtimeNs = t14?.toString() ?? null;
  row.t0ToT14Ms = t0 !== null && t14 !== null ? elapsed(t14) : null;
};

const seal = write('seal.json', {
  kind: 'MO1307MissingLeafLifecycleDiagnosticSeal', baseHead, productionTree, source: proof.sourceMembers,
  preparation: record(abs(preparation + '/preparation.json')), bindings: staticBindings,
  fixtureRoot: proof.fixtureRoot, fixtureFiles: proof.fixtureFiles, fixtureTopology: proof.fixtureTopology, missingLeaf: proof.missingLeaf,
  request: proof.request, expectedResponse: proof.expectedResponse,
  originalLaunch: launch, diagnosticLaunch: { executable: launch.executable, args: diagnosticArgs, options: launch.options },
  limits: { helperWholeLifecycleMs: 5000, helperAggregateMs: 20000, cliMs: 30000, failureCleanupMs: 2000,
    responseBytes: 16777216, stderrBytes: 4096 }, classificationRules: record(abs(tool + '/classification-rules.json')),
  policy: { helperInvocations: 1, retries: 0, alternateInputs: 0, productMutation: false, diagnosticCopyOnly: true,
    exactProductSupervisor: true, noLatencyDistributionClaim: true, certification: false }, sealedUtc: new Date().toISOString()
});
row.seal = seal;
write('invocation-start.json', { seal, invocationsAllowed: 1, retries: 0, request: proof.request,
  diagnosticHelper: proof.diagnosticCopy, startedUtc: new Date().toISOString() });

try {
  for (const binding of [...proof.sourceMembers, ...staticBindings, proof.diagnosticCopy, proof.request, proof.expectedResponse]) check(binding);
  const supervisor = createSupervisor({ kind: 'cli' });
  const transport = createHelperTransportForTesting(supervisor, (executable, args, options) => {
    assert.equal(executable, launch.executable);
    assert.deepEqual(args, [...launch.args]);
    assert.deepEqual(options, { ...launch.options, env: { ...launch.options.env }, stdio: [...launch.options.stdio] });
    assert.equal(row.helperInvocations, 0, 'Exactly one helper launch');
    row.helperInvocations++;
    const performanceBeforeT0 = performance.now();
    t0 = process.hrtime.bigint();
    const performanceAfterT0 = performance.now();
    t0PerformanceMs = (performanceBeforeT0 + performanceAfterT0) / 2;
    t0PerformanceUncertaintyMs = (performanceAfterT0 - performanceBeforeT0) / 2;
    row.events.push({ name: 'T0', elapsedMs: 0 });
    const child = spawn(executable, diagnosticArgs, options);
    row.pid = child.pid ?? null;
    child.once('spawn', () => event('spawn'));
    child.stdin.once('finish', () => { states.stdinFinished = true; event('stdin-finish'); });
    for (const label of ['stdout', 'stderr']) {
      child[label].once('end', () => { states[label + 'Ended'] = true; event(label + '-end'); });
      child[label].on('data', bytes => {
        const at = process.hrtime.bigint();
        totals[label] += bytes.length;
        const cap = label === 'stdout' ? limits.helperResponseBytes : limits.stderrBytes;
        const retained = captured[label].reduce((sum, item) => sum + item.length, 0);
        const keep = bytes.subarray(0, Math.max(0, cap - retained));
        if (keep.length) captured[label].push(Buffer.from(keep));
        if (label === 'stdout' && !row.firstStdoutByteMs) row.firstStdoutByteMs = elapsed(at);
        if (label === 'stderr') consumeDiagnosticText(bytes.toString('ascii'), at);
      });
    }
    for (const [label, stream] of [['stdin', child.stdin], ['stdout', child.stdout], ['stderr', child.stderr]]) {
      stream.once('close', () => { states[label + 'Closed'] = true; event(label + '-close'); maybeT14(); });
      stream.on('error', error => event(label + '-error', { code: error.code ?? null, message: error.message.slice(0, 256) }));
    }
    child.once('error', error => event('process-error', { code: error.code ?? null, message: error.message.slice(0, 256) }));
    child.once('exit', (code, signal) => { states.processExited = true; childCode = code; childSignal = signal; event('process-exit', { code, signal }); });
    child.once('close', (code, signal) => { states.processClosed = true; childCode = code; childSignal = signal; event('process-close', { code, signal }); maybeT14(); });
    return child;
  });
  try { transportAnswer = await transport.exchange(frame); } catch (error) { transportError = error; }
  finally { try { await supervisor.dispose(); } catch (error) { transportError ??= error; } row.supervisor = supervisor.snapshot(); }
  row.transport = transportError ? { outcome: 'REJECTED', error: errorRecord(transportError) }
    : { outcome: 'RESOLVED', exitConfirmed: transportAnswer?.exitConfirmed === true, responseBytes: transportAnswer?.responseBytes?.length ?? null };
  snapshotObservation();
  assert.equal(row.helperInvocations, 1);
  assert.notEqual(t0, null);
  assert.notEqual(t14, null);
  assert.equal(row.captureTruncated, false);
  assert.equal(stderrPending, '');
  assert.equal(stderr.length, totals.stderr);
  assert.ok(stderr.length <= limits.stderrBytes);
  assert.ok(states.stdinClosed && states.stdoutClosed && states.stderrClosed && states.processClosed);
  const lines = stderr.toString('ascii').split(/\r?\n/u).filter(Boolean);
  const stageLines = lines.filter(line => /^MO1307D\|T(?:[1-9]|1[0-3])\|/u.test(line));
  const snapshotLines = lines.filter(line => line.startsWith('MO1307D|SNAPSHOT|'));
  assert.equal(lines.length, 16);
  assert.equal(stageLines.length, 13);
  assert.equal(snapshotLines.length, 3);
  const stageTicks = new Map();
  let frequency = null;
  for (const line of stageLines) {
    const [, stage, tickText, frequencyText] = line.split('|');
    assert.equal(stageTicks.has(stage), false);
    const tick = BigInt(tickText), currentFrequency = BigInt(frequencyText);
    frequency ??= currentFrequency; assert.equal(currentFrequency, frequency);
    stageTicks.set(stage, tick);
  }
  assert.equal(stageTicks.size, 13);
  const finalTicks = [0n, ...Array.from({ length: 13 }, (_, index) => stageTicks.get('T' + (index + 1)))];
  assert.ok(finalTicks.slice(1).every(value => typeof value === 'bigint'));
  const parseCounts = text => Object.fromEntries(text.split(',').map(item => { const split = item.indexOf('='); assert.ok(split > 0); return [item.slice(0, split), Number(item.slice(split + 1))]; }));
  const snapshots = new Map();
  for (const line of snapshotLines) {
    const parts = line.split('|'); assert.equal(parts.length, 4); assert.equal(snapshots.has(parts[2]), false);
    snapshots.set(parts[2], parseCounts(parts[3]));
  }
  assert.deepEqual([...snapshots.keys()], ['T7', 'T8', 'T10']);
  const counts = snapshots.get('T8'), serializedCounts = snapshots.get('T10'), decisionCounts = snapshots.get('T7');
  const countKeys = Object.keys(proof.expectedCounts).filter(key => key !== 'nativeImportedCalls').sort();
  assert.deepEqual(Object.keys(counts).sort(), countKeys);
  assert.deepEqual(Object.keys(serializedCounts).sort(), countKeys);
  assert.deepEqual(Object.keys(decisionCounts).sort(), countKeys);
  for (const [key, value] of Object.entries(proof.expectedCounts)) {
    if (key !== 'nativeImportedCalls' && key !== 'responseBytes') assert.equal(counts[key], value, 'T8 ' + key);
    if (key !== 'nativeImportedCalls') assert.equal(serializedCounts[key], value, 'T10 ' + key);
  }
  assert.equal(counts.responseBytes, 0);
  for (const key of ['rootValidations','relativeValidations','segmentValidations','openChains','chainComponents','filesAttempted','filesProcessed',
    'createFileW','lastErrorReads','getFileInformationByHandle','getFinalPathNameByHandleW','getFileType','getStdHandle','getConsoleProcessList',
    'freeConsole','stablePasses','heldChecks','freshReopens','successfulHandles']) assert.equal(decisionCounts[key], counts[key], 'T7 ' + key);
  assert.equal(decisionCounts.handleDisposals, 0); assert.equal(decisionCounts.responseBytes, 0);
  const nativeImportedCalls = counts.createFileW + counts.getFileInformationByHandle + counts.getFinalPathNameByHandleW + counts.getFileType
    + counts.getStdHandle + counts.getConsoleProcessList + counts.freeConsole;
  assert.equal(nativeImportedCalls, proof.expectedCounts.nativeImportedCalls);
  let previous = 0n;
  for (let index = 1; index <= 13; index++) { assert.ok(finalTicks[index] >= previous); previous = finalTicks[index]; }
  const helperStages = {};
  for (let index = 1; index <= 13; index++) helperStages['T' + index] = Number(finalTicks[index] - finalTicks[1]) * 1000 / Number(frequency);
  const receiptMap = new Map();
  for (const receipt of row.markerReceipts) {
    const match = /^MO1307D\|(T(?:[1-9]|1[0-3]))\|/u.exec(receipt.line);
    if (match) { assert.equal(receiptMap.has(match[1]), false); receiptMap.set(match[1], receipt); }
  }
  assert.equal(receiptMap.size, 13);
  let previousReceipt = 0;
  for (let index = 1; index <= 13; index++) { const value = receiptMap.get('T' + index).elapsedMs; assert.ok(value >= previousReceipt); previousReceipt = value; }
  assert.ok(row.t0ToT14Ms >= previousReceipt);
  const qpcToNs = tick => tick * 1000000000n / frequency;
  const stageNs = new Map(Array.from({ length: 13 }, (_, index) => ['T' + (index + 1), qpcToNs(finalTicks[index + 1])]));
  const toleranceNs = 1000000n;
  assert.ok(stageNs.get('T1') >= t0 - toleranceNs, 'Node hrtime and Stopwatch QPC origins must align at T1');
  assert.ok(stageNs.get('T13') <= t14 + toleranceNs, 'Node hrtime and Stopwatch QPC origins must align at T13');
  for (let index = 1; index <= 13; index++) {
    const stage = 'T' + index, receiptNs = BigInt(receiptMap.get(stage).observerHrtimeNs);
    assert.ok(receiptNs + toleranceNs >= stageNs.get(stage), stage + ' receipt cannot precede helper tick');
    assert.ok(receiptNs <= t14 + toleranceNs, stage + ' receipt must precede T14');
  }
  const alignedStages = Object.fromEntries(Array.from({ length: 13 }, (_, index) => {
    const stage = 'T' + (index + 1); return [stage, nsMs(stageNs.get(stage) - t0)];
  }));
  const receiptStages = Object.fromEntries(Array.from({ length: 13 }, (_, index) => {
    const stage = 'T' + (index + 1); return [stage, receiptMap.get(stage).elapsedMs];
  }));
  row.timing = { qpcAlignedCumulativeMs: { T0: 0, ...alignedStages, T14: row.t0ToT14Ms }, markerReceiptUpperBoundMs: receiptStages,
    helperCumulativeFromT1Ms: helperStages,
    helperFrequency: Number(frequency), helperRawTicks: Object.fromEntries(Array.from({ length: 13 }, (_, index) => ['T' + (index + 1), finalTicks[index + 1].toString()])),
    qpcAlignmentToleranceNs: Number(toleranceNs), note: 'Windows Node hrtime and .NET Stopwatch raw QPC clocks aligned and passed receipt-causality checks. Helper intervals include preceding flushed diagnostic markers. T13 is the final minimal flushed marker immediately before exit.' };
  const bucketEndpoints = { T0: 0, ...alignedStages, T14: row.t0ToT14Ms };
  const buckets = rules.buckets.map(bucket => ({ name: bucket.name, start: bucket.start, end: bucket.end,
    durationMs: bucketEndpoints[bucket.end] - bucketEndpoints[bucket.start] }));
  assert.ok(buckets.every(bucket => bucket.durationMs >= -0.001));
  assert.ok(Math.abs(buckets.reduce((sum, bucket) => sum + bucket.durationMs, 0) - row.t0ToT14Ms) < 0.01);
  const timeout = row.transport.outcome === 'REJECTED' && row.transport.error.code === 'MO1307_TIMEOUT';
  let helperDeadlineQpcNs = null;
  if (timeout) {
    assert.ok(Number.isFinite(t0PerformanceMs)); assert.ok(Number.isFinite(t0PerformanceUncertaintyMs));
    const helperStarts = row.supervisor.events.filter(event => event.type === 'start' && event.role === 'helper');
    assert.equal(helperStarts.length, 1); assert.ok(Number.isFinite(helperStarts[0].deadline));
    helperDeadlineQpcNs = t0 + BigInt(Math.round((helperStarts[0].deadline - t0PerformanceMs) * 1000000));
    const pairingUncertaintyNs = BigInt(Math.ceil(t0PerformanceUncertaintyMs * 1000000)) + toleranceNs;
    const t13ReceiptNs = BigInt(receiptMap.get('T13').observerHrtimeNs);
    if (stageNs.get('T12') < helperDeadlineQpcNs + pairingUncertaintyNs && t13ReceiptNs + pairingUncertaintyNs >= helperDeadlineQpcNs) {
      throw new Error('The flushed T12/T13 diagnostic marker work may have crossed the exact helper lease deadline; instrumentation contamination');
    }
  }
  const dominant = buckets.filter(bucket => bucket.durationMs > row.t0ToT14Ms * 0.5);
  classification = dominant.length === 1 ? dominant[0].name : rules.fallback;
  row.classification = { value: classification, rule: rules.dominance, buckets, productTimedOut: timeout,
    helperDeadlineQpcNs: helperDeadlineQpcNs?.toString() ?? null,
    performanceQpcPairingUncertaintyMs: t0PerformanceUncertaintyMs };
  row.response = { observedBytes: stdout.length, observedSha256: hash(stdout), expectedByteMatch: stdout.equals(expectedResponse),
    instrumentedResponseBytes: serializedCounts.responseBytes };
  if (stdout.length > 0) {
    try { const decoded = decodeHelperResponse(stdout, request); Object.assign(row.response, { status: decoded.status, code: decoded.code,
      files: decoded.files.length, roots: decoded.roots.length }); } catch (error) { row.response.decodeError = errorRecord(error); }
  }
  if (row.transport.outcome === 'RESOLVED') {
    assert.equal(row.transport.exitConfirmed, true); assert.deepEqual(stdout, expectedResponse);
    assert.equal(childCode, 0); assert.equal(childSignal, null); assert.ok(Object.values(states).every(Boolean));
  } else {
    assert.equal(timeout, true, 'Only the frozen product timeout may coexist with a complete diagnostic');
  }
} catch (error) {
  fatal = errorRecord(error);
} finally {
  try {
    snapshotObservation();
    row.stdout = put('stdout.bin', stdout);
    row.stderr = put('stderr.txt', stderr);
    for (const binding of [...proof.sourceMembers, ...staticBindings, proof.diagnosticCopy, proof.request, proof.expectedResponse]) check(binding);
    sourceUnchanged = true;
    assert.deepEqual(walk(proof.fixtureRoot), proof.fixtureFiles);
    assert.deepEqual(topology(proof.fixtureRoot), proof.fixtureTopology);
    assert.equal(fs.existsSync(proof.missingLeaf), false);
    fixtureUnchanged = true;
  } catch (error) { fatal ??= errorRecord(error); }
  if (fatal) classification = 'DIAGNOSTIC_INCOMPLETE';
  if (fatal) write('stopped.json', { outcome: 'DIAGNOSTIC_INCOMPLETE', noRetry: true, noSecondSample: true, fatal });
  write('receipt.json', {
    kind: 'MO1307MissingLeafLifecycleDiagnosticReceipt', result: fatal ? 'DIAGNOSTIC_INCOMPLETE' : 'PASS',
    classification, row, fatal, sourceUnchanged, fixtureUnchanged, helperInvocations: row.helperInvocations,
    retries: 0, alternateInputs: 0, candidate: null, productValidation: false, certification: false,
    scope: 'One diagnostic copy execution of retained invocation 018 under the unchanged 5000 ms helper lifecycle supervisor.',
    finishedUtc: new Date().toISOString()
  });
  console.log(JSON.stringify({ result: fatal ? 'DIAGNOSTIC_INCOMPLETE' : 'PASS', classification, helperInvocations: row.helperInvocations,
    receipt: abs(output + '/receipt.json') }));
  process.exitCode = fatal ? 1 : 0;
}
