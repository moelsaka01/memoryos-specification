// Execute exactly one isolated, instrumented INSPECT_PENDING lifecycle. No retry, warmup, alternate fixture, or certification.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const tool = 'repositories/cca-conformance/tools/mo1307-phase3ar2-b-inspect-pending';
const base = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub-b-inspect-pending';
const preparation = base + '/diagnostic-preparation';
const output = base + '/diagnostic-observation';
const installedRoot = path.join(root, '.cache/phase3ar2-c3ub/install/node_modules/memoryos-readiness');
const sourceRoot = path.join(root, 'repositories/memoryos-readiness');
const expectedFixtureRoot = path.join(root, '.cache/phase3ar2-c3ub/v1/p/primary');
const preservedInvocationPath = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub/semantics/B-ready/evaluate/invocation.json';
const preservedObservationPath = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub/semantics/B-ready/evaluate/observation.json';
const preservedReceiptPath = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub/semantics/B-ready/evaluate/receipt.json';
const abs = relative => path.join(root, relative);
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const record = file => { const bytes = fs.readFileSync(file); return { path: path.relative(root, file).replaceAll('\\', '/'), byteLength: bytes.length, sha256: hash(bytes) }; };
const bindRelative = (relative, bytes) => ({ path: relative, byteLength: bytes.length, sha256: hash(bytes) });
const check = binding => assert.deepEqual(record(abs(binding.path)), {
  path: binding.path, byteLength: binding.byteLength, sha256: binding.sha256,
});
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
  const result = spawnSync('C:/Program Files/Git/cmd/git.exe', args, { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
const nsMs = value => Number(value) / 1e6;

assert.equal(process.argv.length, 2, 'No alternate case, request, fixture, or launch option');
assert.equal(path.resolve(root).toLowerCase(), 'c:\\users\\melsa\\documents\\codex\\3ar2');
assert.equal(process.platform, 'win32');
assert.equal(process.arch, 'x64');
assert.equal(process.version, 'v24.21.0');
assert.equal(hash(fs.readFileSync(process.execPath)), 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(fs.existsSync(abs(output)), false, 'The one diagnostic generation has already been consumed');
const diagnosticToolchainCommit = git('rev-parse', 'HEAD');
assert.equal(git('rev-parse', 'HEAD^'), '789d92f94638ddbe63d38dc957746bf1f7d308c2');
assert.equal(git('branch', '--show-current'), 'codex/mo1307-phase3ar2-c3ub');
assert.equal(git('rev-parse', '91c07b1e93f65ab6252024984073c171ff5d7648:repositories/memoryos-readiness'), '302cf1a506e974b2102a78be1b9c920ac80105b2');
assert.equal(git('rev-parse', 'HEAD:repositories/memoryos-readiness'), '302cf1a506e974b2102a78be1b9c920ac80105b2');
assert.equal(git('status', '--short', '--', 'repositories/memoryos-readiness'), '', 'Production package must be unmodified');
assert.equal(git('status', '--short', '--', tool), '', 'Committed diagnostic toolchain must be unmodified');
assert.equal(git('status', '--short', '--', 'repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub'), '', 'Preserved failed generation must be unmodified');

const proof = json(preparation + '/preparation.json');
assert.equal(proof.result, 'PASS');
assert.equal(proof.helperExecutions, 0);
assert.equal(proof.diagnosticToolchainCommit, diagnosticToolchainCommit);
assert.equal(proof.exactInverseEquality, true);
assert.equal(proof.source.sha256, 'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127');
assert.deepEqual({
  authorization: proof.authorization.path, source: proof.source.path, installedHelper: proof.installedHelper.path,
  generator: proof.generator.path, observer: proof.observer.path, rules: proof.rules.path,
  diagnosticCopy: proof.diagnosticCopy.path, inverse: proof.inverse.path, ledger: proof.ledger.path,
  request: proof.request.path, installedManifest: proof.installedManifest.path,
  preservedInvocation: proof.preservedFailure.invocation.path, preservedObservation: proof.preservedFailure.observation.path,
  preservedReceipt: proof.preservedFailure.receipt.path,
}, {
  authorization: base + '/authorization.txt', source: 'repositories/memoryos-readiness/helpers/windows-inspect.ps1',
  installedHelper: '.cache/phase3ar2-c3ub/install/node_modules/memoryos-readiness/helpers/windows-inspect.ps1',
  generator: tool + '/instrument.mjs', observer: tool + '/observe.mjs', rules: tool + '/classification-rules.json',
  diagnosticCopy: preparation + '/instrumented.ps1', inverse: preparation + '/inverse-reconstruction.ps1.data',
  ledger: preparation + '/replacement-ledger.json', request: preparation + '/request.bin',
  installedManifest: 'repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub/installed-before.json',
  preservedInvocation: preservedInvocationPath, preservedObservation: preservedObservationPath, preservedReceipt: preservedReceiptPath,
});
for (const binding of [proof.authorization, proof.source, proof.installedHelper, proof.generator, proof.observer, proof.rules,
  proof.diagnosticCopy, proof.inverse, proof.ledger, proof.request, proof.installedManifest, proof.preservedFailure.observation,
  proof.preservedFailure.invocation, proof.preservedFailure.receipt, ...proof.sourceMembers, ...proof.installedMembers]) check(binding);
assert.deepEqual(walk(sourceRoot), proof.sourceMembers);
assert.deepEqual(walk(installedRoot), proof.installedMembers);
assert.deepEqual(read(preparation + '/inverse-reconstruction.ps1.data'), read(proof.source.path));
const sourceText = read(proof.source.path).toString('utf8');
const diagnosticText = read(proof.diagnosticCopy.path).toString('utf8');
const ledger = json(proof.ledger.path);
assert.equal(Array.isArray(ledger), true); assert.equal(ledger.length, proof.replacements);
let priorEnd = 0;
for (const patch of ledger) {
  assert.deepEqual(Object.keys(patch).sort(), ['after', 'before', 'label', 'offset']);
  assert.equal(typeof patch.label, 'string'); assert.ok(patch.label.length > 0);
  assert.equal(Number.isSafeInteger(patch.offset), true); assert.ok(patch.offset >= priorEnd);
  assert.equal(typeof patch.before, 'string'); assert.equal(typeof patch.after, 'string');
  assert.equal(sourceText.slice(patch.offset, patch.offset + patch.before.length), patch.before);
  priorEnd = patch.offset + patch.before.length;
}
let replayed = sourceText;
for (const patch of [...ledger].reverse()) replayed = replayed.slice(0, patch.offset) + patch.after + replayed.slice(patch.offset + patch.before.length);
assert.equal(replayed, diagnosticText, 'Executed diagnostic copy must be the declared source transformation');
assert.equal(proof.fixtureRoot.toLowerCase(), expectedFixtureRoot.toLowerCase());
assert.equal(proof.pendingPath.toLowerCase(), path.join(expectedFixtureRoot, 'memoryos-readiness-result.json.pending').toLowerCase());
assert.equal(proof.finalPath.toLowerCase(), path.join(expectedFixtureRoot, 'memoryos-readiness-result.json').toLowerCase());
assert.deepEqual(proof.fixtureTopology, [{ relative: 'memoryos-readiness-result.json.pending', type: 'file' }]);
assert.equal(proof.fixtureFiles.length, 1); assert.equal(proof.fixtureFiles[0].relative, 'memoryos-readiness-result.json.pending');
assert.equal(proof.fixtureFiles[0].byteLength, 59987);
assert.equal(proof.fixtureFiles[0].sha256, 'sha256:8ec1375f09103b8d1b791985065c3589bdf8ba2a4ed661dcc081d48468049fa7');
assert.deepEqual(walk(expectedFixtureRoot), proof.fixtureFiles);
assert.deepEqual(topology(expectedFixtureRoot), proof.fixtureTopology);
assert.equal(fs.existsSync(proof.pendingPath), true);
assert.equal(fs.existsSync(proof.finalPath), false);
assert.equal(proof.preservedFailure.invocation.sha256, 'sha256:25c0fa4ba53e5f66fc51b513df8477087bcb6e1d9c09a0a5175b146196862b6f');
assert.equal(proof.preservedFailure.observation.sha256, 'sha256:2d54aff20768e005e6826bcdbacfa0633aa95f1be41305e8debf2146865d17fe');
assert.equal(proof.preservedFailure.receipt.sha256, 'sha256:43055070edbd604e611a093e9e41021c996492f694c3ef11bfc62afa75febc29');
const preservedInvocation = json(preservedInvocationPath), preservedObservation = json(preservedObservationPath), preservedReceipt = json(preservedReceiptPath);
assert.equal(preservedInvocation.step, 'B'); assert.equal(preservedInvocation.name, 'ready'); assert.equal(preservedInvocation.operation, 'evaluate');
assert.equal(path.resolve(preservedInvocation.productArgs.at(-1)).toLowerCase(), expectedFixtureRoot.toLowerCase());
assert.equal(preservedReceipt.result, 'FAIL'); assert.equal(preservedReceipt.exit, 29); assert.equal(preservedReceipt.stdout.byteLength, 0);
const preservedFailed = preservedObservation.requests[7];
assert.equal(preservedFailed.ordinal, 8); assert.equal(preservedFailed.sequence, 8); assert.equal(preservedFailed.operation, 'INSPECT_PENDING');
assert.equal(preservedFailed.requestBytes, 311);
assert.equal(preservedFailed.requestSha256, 'sha256:9b577cba71ad249f85cc142588f3795f26afbda419cd500c7e9a5883a516c78f');
assert.equal(preservedFailed.priorChargedMs, 19297.744300000002); assert.equal(preservedFailed.disposition, 'REJECTED');
assert.equal(preservedFailed.error.code, 'MO1307_TIMEOUT'); assert.equal(preservedFailed.responseAcceptedByTransport, false);
assert.equal(preservedFailed.responseArrived, false); assert.equal(preservedFailed.responseComplete, false); assert.equal(preservedFailed.responseSha256, null);
const preservedStart = preservedObservation.supervisors[0].snapshot.events.find(event => event.type === 'start' && event.role === 'helper' && event.ordinal === 8);
assert.ok(preservedStart); assert.ok(Math.abs(preservedStart.deadline - preservedStart.at - 702.2263) < 0.001);
assert.ok(Math.abs(preservedStart.deadline - preservedFailed.spawnAt - 702.1707) < 0.001);
assert.ok(Math.abs(proof.preservedFailure.remainingAggregateMs - 702.2556999999982) < 0.001);
assert.ok(Math.abs(proof.preservedFailure.supervisorLeaseMs - 702.2263) < 0.001);
assert.ok(Math.abs(proof.preservedFailure.t0PreSpawnWindowMs - 702.1707) < 0.001);
assert.equal(proof.preservedFailure.responseAccepted, false);

const runtime = await import(pathToFileURL(path.join(installedRoot, 'src/runtime.mjs')).href);
const helperTransport = await import(pathToFileURL(path.join(installedRoot, 'src/helper-transport.mjs')).href);
const protocol = await import(pathToFileURL(path.join(installedRoot, 'src/helper-protocol.mjs')).href);
const constants = await import(pathToFileURL(path.join(installedRoot, 'src/constants.mjs')).href);
const { createSupervisor } = runtime;
const { createHelperTransportForTesting, helperLaunchSpecification } = helperTransport;
const { decodeHelperRequest, decodeHelperResponse, encodeHelperResponse } = protocol;
const { DEFINITIONS } = constants;

const frame = read(preparation + '/request.bin');
assert.equal(frame.length, 311);
assert.equal(frame.readUInt32BE(0), 307);
assert.equal(hash(frame), proof.request.sha256);
assert.equal(hash(frame), proof.originalRequestLimitation.diagnosticSha256);
assert.notEqual(hash(frame), proof.originalRequestLimitation.originalSha256);
assert.equal(proof.originalRequestLimitation.byteIdenticalReplay, false);
const request = decodeHelperRequest(frame);
assert.deepEqual(request, { files: [], kind: 'MemoryOSReadinessHelperRequest', operation: 'INSPECT_PENDING',
  roots: [{ id: 'output', path: expectedFixtureRoot }], sequence: 8,
  session: '46ecb2b7a2ca88709a040ca203e68b7eb40d13c554161ab9bfd951dfd094c179', version: '2.0.0' });
assert.deepEqual(request, proof.requestObject);
const launch = helperLaunchSpecification();
const limits = DEFINITIONS.limits;
assert.deepEqual({
  helperDeadlineMs: limits.helperDeadlineMs, helperAggregateDeadlineMs: limits.helperAggregateDeadlineMs,
  cliDeadlineMs: limits.cliDeadlineMs, apiDeadlineMs: limits.apiDeadlineMs, cleanupAllowanceMs: limits.cleanupAllowanceMs,
  stderrBytes: limits.stderrBytes, helperResponseBytes: limits.helperResponseBytes,
}, {
  helperDeadlineMs: 9000, helperAggregateDeadlineMs: 20000, cliDeadlineMs: 30000, apiDeadlineMs: 10000,
  cleanupAllowanceMs: 2000, stderrBytes: 4096, helperResponseBytes: 16777216,
});
assert.equal(launch.options.detached, false);
assert.equal(launch.options.windowsHide, true);
assert.equal(launch.options.shell, false);
assert.deepEqual([...launch.options.stdio], ['pipe', 'pipe', 'pipe']);
assert.deepEqual({ ...launch.options.env }, { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' });
assert.equal(path.resolve(launch.args.at(-1)), path.resolve(proof.installedHelper.path ? abs(proof.installedHelper.path) : path.join(installedRoot, 'helpers/windows-inspect.ps1')));
const diagnosticArgs = [...launch.args];
diagnosticArgs[diagnosticArgs.length - 1] = abs(proof.diagnosticCopy.path);
const rules = json(tool + '/classification-rules.json');
assert.equal(rules.kind, 'MO1307Phase3AR2BInspectPendingClassificationRules'); assert.equal(rules.version, 1);
assert.equal(rules.dominance.includes('greater than 50 percent'), true);
assert.deepEqual(rules.stageOrder, Array.from({ length: 14 }, (_, index) => 'T' + index));
assert.deepEqual(rules.snapshotStages, ['T2', 'T6', 'T7', 'T12']);
assert.equal(rules.qpcAlignmentToleranceNs, 1000000);
assert.deepEqual(rules.buckets.map(({ key, classification, start, end }) => ({ key, classification, start, end })), [
  { key: 'commonStartup', classification: 'COMMON_STARTUP_DOMINANT', start: 'T0', end: 'T6' },
  { key: 'inspectPendingAcquisition', classification: 'INSPECT_PENDING_ACQUISITION_DOMINANT', start: 'T6', end: 'T7' },
  { key: 'responseObjectCompletion', classification: 'OTHER_CONCRETE_DOMINANT_COST', start: 'T7', end: 'T8' },
  { key: 'serialization', classification: 'SERIALIZATION_DOMINANT', start: 'T8', end: 'T11' },
  { key: 'settlement', classification: 'SETTLEMENT_DOMINANT', start: 'T11', end: 'T13' },
]);
assert.deepEqual(rules.limits, {
  diagnosticSupervisorHelperMs: 9000, preservedBSupervisorLeaseMs: 702.2263, preservedBT0PreSpawnWindowMs: 702.1707, helperAggregateMs: 20000,
  cliMs: 30000, apiWorkerMs: 10000, failureCleanupMs: 2000, invocations: 1, retries: 0, alternateInputs: 0,
});
const staticBindings = [record(abs(base + '/authorization.txt')), record(abs(tool + '/instrument.mjs')),
  record(abs(tool + '/observe.mjs')), record(abs(tool + '/classification-rules.json')),
  record(abs(preparation + '/preparation.json')), record(process.execPath), record(launch.executable)];

let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), transportAnswer = null, transportError = null, fatal = null;
let sourceUnchanged = false, installedUnchanged = false, fixtureUnchanged = false;
let outputClaimed = false;
let classification = 'DIAGNOSTIC_INCOMPLETE';
const row = { kind: 'one-isolated-instrumented-B-ready-evaluate-INSPECT_PENDING', launchAttempts: 0, helperInvocations: 0, retries: 0,
  alternateInputs: 0, warmups: 0, events: [], markerReceipts: [], startedUtc: new Date().toISOString() };
let t0 = null, t13 = null, childCode = null, childSignal = null, stderrPending = '', stderrParsedBytes = 0;
const captured = { stdout: [], stderr: [] }, totals = { stdout: 0, stderr: 0 };
const states = { stdinFinished: false, stdinClosed: false, stdoutEnded: false, stdoutClosed: false,
  stderrEnded: false, stderrClosed: false, processExited: false, processClosed: false };
const elapsed = at => t0 === null ? null : nsMs(at - t0);
const event = (name, detail = {}) => { const at = process.hrtime.bigint(); row.events.push({ name, elapsedMs: elapsed(at), ...detail }); return at; };
const maybeT13 = () => {
  if (t13 === null && states.stdinClosed && states.stdoutClosed && states.stderrClosed && states.processClosed) {
    t13 = process.hrtime.bigint(); row.events.push({ name: 'T13', elapsedMs: elapsed(t13) });
  }
};
const consumeDiagnosticText = (text, at) => {
  const textBytes = Buffer.byteLength(text, 'ascii'), room = Math.max(0, limits.stderrBytes - stderrParsedBytes);
  if (textBytes > room) row.stderrParserOverflow = true;
  const retained = text.slice(0, room); stderrParsedBytes += Buffer.byteLength(retained, 'ascii'); stderrPending += retained;
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
  row.t0HrtimeNs = t0?.toString() ?? null; row.t13HrtimeNs = t13?.toString() ?? null;
  row.t0ToT13Ms = t0 !== null && t13 !== null ? elapsed(t13) : null;
};

const sealPayload = {
  kind: 'MO1307Phase3AR2BInspectPendingDiagnosticSeal', candidate: proof.candidate,
  preparation: record(abs(preparation + '/preparation.json')), bindings: staticBindings,
  source: proof.sourceMembers, installed: proof.installedMembers, fixtureRoot: proof.fixtureRoot,
  fixtureFiles: proof.fixtureFiles, fixtureTopology: proof.fixtureTopology,
  request: proof.request, originalRequestLimitation: proof.originalRequestLimitation,
  originalLaunch: launch, diagnosticLaunch: { executable: launch.executable, args: diagnosticArgs, options: launch.options },
  limits: rules.limits, preservedFailure: proof.preservedFailure, classificationRules: record(abs(tool + '/classification-rules.json')),
  policy: { helperInvocations: 1, retries: 0, warmups: 0, alternateInputs: 0, productMutation: false,
    diagnosticCopyOnly: true, isolatedFreshSupervisorForFullLifecycle: true,
    preservedBTimeoutNeverPromotedToSuccess: true, noLatencyDistributionClaim: true, certification: false },
  sealedUtc: new Date().toISOString()
};
const sealBytes = Buffer.from(JSON.stringify(sealPayload, null, 2) + '\n');
const seal = bindRelative(output + '/seal.json', sealBytes);
row.seal = seal;
const invocationStartPayload = { seal, invocationsAllowed: 1, retries: 0, warmups: 0, request: proof.request,
  diagnosticHelper: proof.diagnosticCopy, preservedSupervisorLeaseMs: proof.preservedFailure.supervisorLeaseMs,
  preservedT0PreSpawnWindowMs: proof.preservedFailure.t0PreSpawnWindowMs, startedUtc: new Date().toISOString() };
const invocationStartBytes = Buffer.from(JSON.stringify(invocationStartPayload, null, 2) + '\n');
const invocationStart = bindRelative(output + '/invocation-start.json', invocationStartBytes);

try {
  fs.mkdirSync(abs(output), { recursive: false }); outputClaimed = true;
  assert.deepEqual(put('seal.json', sealBytes), seal);
  assert.deepEqual(put('invocation-start.json', invocationStartBytes), invocationStart);
  for (const binding of [...proof.sourceMembers, ...proof.installedMembers, ...staticBindings,
    proof.diagnosticCopy, proof.request, seal, invocationStart]) check(binding);
  const supervisor = createSupervisor({ kind: 'cli' });
  const transport = createHelperTransportForTesting(supervisor, (executable, args, options) => {
    assert.equal(executable, launch.executable);
    assert.deepEqual(args, [...launch.args]);
    assert.deepEqual(options, { ...launch.options, env: { ...launch.options.env }, stdio: [...launch.options.stdio] });
    assert.equal(row.launchAttempts, 0, 'Exactly one helper launch attempt');
    row.launchAttempts++;
    t0 = process.hrtime.bigint();
    row.events.push({ name: 'T0', elapsedMs: 0 });
    const child = spawn(executable, diagnosticArgs, options);
    row.pid = child.pid ?? null;
    child.once('spawn', () => { row.helperInvocations++; event('spawn'); });
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
        if (label === 'stdout' && row.firstStdoutByteObservedMs === undefined) row.firstStdoutByteObservedMs = elapsed(at);
        if (label === 'stderr') consumeDiagnosticText(bytes.toString('ascii'), at);
      });
    }
    for (const [label, stream] of [['stdin', child.stdin], ['stdout', child.stdout], ['stderr', child.stderr]]) {
      stream.once('close', () => { states[label + 'Closed'] = true; event(label + '-close'); maybeT13(); });
      stream.on('error', error => event(label + '-error', { code: error.code ?? null, message: error.message.slice(0, 256) }));
    }
    child.once('error', error => event('process-error', { code: error.code ?? null, message: error.message.slice(0, 256) }));
    child.once('exit', (code, signal) => { states.processExited = true; childCode = code; childSignal = signal; event('process-exit', { code, signal }); });
    child.once('close', (code, signal) => { states.processClosed = true; childCode = code; childSignal = signal; event('process-close', { code, signal }); maybeT13(); });
    return child;
  });
  try { transportAnswer = await transport.exchange(frame); } catch (error) { transportError = error; }
  finally { try { await supervisor.dispose(); } catch (error) { transportError ??= error; } row.supervisor = supervisor.snapshot(); }
  row.transport = transportError ? { outcome: 'REJECTED', error: errorRecord(transportError) }
    : { outcome: 'RESOLVED_FOR_DIAGNOSTIC_ONLY', exitConfirmed: transportAnswer?.exitConfirmed === true,
      responseBytes: transportAnswer?.responseBytes?.length ?? null };
  snapshotObservation();
  assert.equal(row.launchAttempts, 1);
  assert.equal(row.helperInvocations, 1);
  assert.equal(Number.isSafeInteger(row.pid), true);
  assert.equal(row.events.filter(item => item.name === 'spawn').length, 1);
  assert.notEqual(t0, null);
  assert.notEqual(t13, null);
  assert.equal(row.captureTruncated, false);
  assert.notEqual(row.stderrParserOverflow, true);
  assert.equal(stderrPending, '');
  assert.equal(stderr.length, totals.stderr);
  assert.ok(stderr.length <= limits.stderrBytes);
  assert.ok(Object.values(states).every(Boolean));

  const lines = stderr.toString('ascii').split(/\r?\n/u).filter(Boolean);
  assert.equal(lines.length, 16);
  assert.equal(row.markerReceipts.length, 16);
  assert.deepEqual(row.markerReceipts.map(receipt => receipt.line), lines);
  const stageLines = lines.slice(0, 12), snapshotLines = lines.slice(12);
  assert.deepEqual(stageLines.map(line => /^MO1307D\|(T(?:[1-9]|1[0-2]))\|[0-9]+\|[0-9]+$/u.exec(line)?.[1]),
    Array.from({ length: 12 }, (_, index) => 'T' + (index + 1)));
  const stageTicks = new Map();
  let frequency = null;
  for (const line of stageLines) {
    const match = /^MO1307D\|(T(?:[1-9]|1[0-2]))\|([0-9]+)\|([0-9]+)$/u.exec(line); assert.ok(match);
    const [, stage, tickText, frequencyText] = match;
    assert.equal(stageTicks.has(stage), false);
    const tick = BigInt(tickText), currentFrequency = BigInt(frequencyText);
    assert.ok(tick > 0n); assert.ok(currentFrequency > 0n);
    frequency ??= currentFrequency; assert.equal(currentFrequency, frequency);
    stageTicks.set(stage, tick);
  }
  assert.equal(stageTicks.size, 12);
  const parseCounts = text => {
    const entries = text.split(',').map(item => {
      const split = item.indexOf('='); assert.ok(split > 0); const key = item.slice(0, split), value = Number(item.slice(split + 1));
      assert.ok(Number.isSafeInteger(value) && value >= 0); return [key, value];
    });
    assert.equal(new Set(entries.map(([key]) => key)).size, entries.length);
    const value = Object.fromEntries(entries); assert.deepEqual(Object.keys(value), rules.counterKeys); return value;
  };
  const snapshots = new Map();
  for (const line of snapshotLines) {
    const match = /^MO1307D\|SNAPSHOT\|(T(?:2|6|7|12))\|(.+)$/u.exec(line); assert.ok(match);
    assert.equal(snapshots.has(match[1]), false); snapshots.set(match[1], parseCounts(match[2]));
  }
  assert.deepEqual([...snapshots.keys()], rules.snapshotStages);
  const atT2 = snapshots.get('T2'), atT6 = snapshots.get('T6'), atT7 = snapshots.get('T7'), atT12 = snapshots.get('T12');
  const zeroCounts = Object.fromEntries(rules.counterKeys.map(key => [key, 0]));
  assert.deepEqual(atT2, { ...zeroCounts, getFileType: 3, getStdHandle: 3, getConsoleProcessList: 1, freeConsole: 1 });
  assert.deepEqual(atT6, { ...zeroCounts, rootValidations: 1, segmentValidations: 10, getFileType: 3,
    getStdHandle: 3, getConsoleProcessList: 1, freeConsole: 1, requestBytes: 311 });
  const expectedAcquired = { ...zeroCounts };
  for (const [key, value] of Object.entries(proof.expectedCounts)) if (key !== 'nativeImportedCalls') expectedAcquired[key] = value;
  expectedAcquired.handleDisposals = 12;
  assert.deepEqual(atT7, expectedAcquired);
  assert.deepEqual(atT12, { ...expectedAcquired, handleDisposals: 24, responseBytes: stdout.length });
  const nativeCalls = counts => counts.createFileW + counts.getFileInformationByHandle + counts.getFinalPathNameByHandleW
    + counts.getFileType + counts.getStdHandle + counts.getConsoleProcessList + counts.freeConsole;
  assert.equal(nativeCalls(atT2), 8);
  assert.equal(nativeCalls(atT6), 8);
  assert.equal(nativeCalls(atT7), proof.expectedCounts.nativeImportedCalls);
  assert.equal(nativeCalls(atT12), proof.expectedCounts.nativeImportedCalls);
  const receiptMap = new Map();
  for (const receipt of row.markerReceipts) {
    const match = /^MO1307D\|(T(?:[1-9]|1[0-2]))\|/u.exec(receipt.line);
    if (match) { assert.equal(receiptMap.has(match[1]), false); receiptMap.set(match[1], receipt); }
  }
  assert.equal(receiptMap.size, 12);
  const qpcToNs = tick => tick * 1000000000n / frequency;
  const stageNs = new Map(Array.from({ length: 12 }, (_, index) => ['T' + (index + 1), qpcToNs(stageTicks.get('T' + (index + 1)))]));
  const toleranceNs = BigInt(rules.qpcAlignmentToleranceNs);
  let previous = t0 - toleranceNs;
  for (let index = 1; index <= 12; index++) {
    const stage = 'T' + index, value = stageNs.get(stage);
    assert.ok(value >= previous, stage + ' must be monotonic'); previous = value;
    const receiptNs = BigInt(receiptMap.get(stage).observerHrtimeNs);
    assert.ok(receiptNs + toleranceNs >= value, stage + ' receipt cannot precede helper tick');
    assert.ok(receiptNs <= t13 + toleranceNs, stage + ' receipt must precede T13');
  }
  assert.ok(stageNs.get('T1') >= t0 - toleranceNs, 'Node hrtime and Stopwatch QPC origins must align at T1');
  assert.ok(stageNs.get('T12') <= t13 + toleranceNs, 'Node hrtime and Stopwatch QPC origins must align at T12');
  const alignedStages = Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
    const stage = 'T' + (index + 1); return [stage, nsMs(stageNs.get(stage) - t0)];
  }));
  const helperStages = Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
    const stage = 'T' + (index + 1); return [stage, Number(stageTicks.get(stage) - stageTicks.get('T1')) * 1000 / Number(frequency)];
  }));
  const receiptStages = Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
    const stage = 'T' + (index + 1); return [stage, receiptMap.get(stage).elapsedMs];
  }));
  row.timing = {
    qpcAlignedCumulativeMs: { T0: 0, ...alignedStages, T13: row.t0ToT13Ms },
    markerReceiptUpperBoundMs: receiptStages, helperCumulativeFromT1Ms: helperStages,
    helperFrequency: Number(frequency), helperRawTicks: Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
      const stage = 'T' + (index + 1); return [stage, stageTicks.get(stage).toString()];
    })),
    qpcAlignmentToleranceNs: Number(toleranceNs),
    definitions: {
      T0: 'diagnostic supervisor immediately before spawn', T1: 'PowerShell script entry',
      T2: 'native/runtime initialization complete', T3: 'request frame read and EOF complete',
      T4: 'canonical parse and outer schema validation complete', T5: 'path/root/operation validation complete',
      T6: 'INSPECT_PENDING native acquisition start', T7: 'pending-file identity/path acquisition complete',
      T8: 'response object complete', T9: 'canonical serialization and frame header complete',
      T10: 'unchanged four-byte header write returned; first response byte is proven written',
      T11: 'response body write and flush complete', T12: 'exit initiation begins after final diagnostic snapshot; buffered telemetry drains before exit',
      T13: 'process and stdin/stdout/stderr all settled'
    },
    note: 'Windows Node hrtime and .NET Stopwatch raw QPC clocks aligned. Ticks/counter snapshots were buffered in memory and emitted once after T12; stage calls and counter snapshots retain small disclosed instrumentation overhead.'
  };
  const endpoints = { T0: 0, ...alignedStages, T13: row.t0ToT13Ms };
  const buckets = rules.buckets.map(bucket => ({ key: bucket.key, classification: bucket.classification, start: bucket.start, end: bucket.end,
    durationMs: endpoints[bucket.end] - endpoints[bucket.start] }));
  assert.ok(buckets.every(bucket => bucket.durationMs >= -0.001));
  assert.ok(Math.abs(buckets.reduce((sum, bucket) => sum + bucket.durationMs, 0) - row.t0ToT13Ms) < 0.01);
  const dominant = buckets.filter(bucket => bucket.durationMs > row.t0ToT13Ms * 0.5);
  classification = dominant.length === 1 ? dominant[0].classification : 'OTHER_CONCRETE_DOMINANT_COST';
  const validClassifications = ['COMMON_STARTUP_DOMINANT', 'INSPECT_PENDING_ACQUISITION_DOMINANT',
    'SERIALIZATION_DOMINANT', 'SETTLEMENT_DOMINANT', 'OTHER_CONCRETE_DOMINANT_COST'];
  assert.ok(validClassifications.includes(classification));
  row.classification = { value: classification, basis: dominant.length === 1 ? dominant[0].key : 'no_unique_majority',
    rule: rules.dominance, buckets };

  assert.equal(row.transport.outcome, 'RESOLVED_FOR_DIAGNOSTIC_ONLY');
  assert.equal(row.transport.exitConfirmed, true);
  assert.equal(childCode, 0);
  assert.equal(childSignal, null);
  assert.equal(row.supervisor.helpers, 1);
  assert.equal(row.supervisor.workers, 0);
  assert.equal(row.supervisor.terminalCode, null);
  assert.equal(row.supervisor.cleanupConfirmed, true);
  assert.ok(row.supervisor.helperUsedMs < 9000);
  assert.deepEqual(transportAnswer.responseBytes, stdout);
  const response = decodeHelperResponse(stdout, request);
  assert.deepEqual(encodeHelperResponse(response, request), stdout);
  assert.equal(response.status, 'OK');
  assert.equal(response.code, null);
  assert.equal(response.operation, 'INSPECT_PENDING');
  assert.equal(response.sequence, 8);
  assert.equal(response.session, request.session);
  assert.equal(response.files.length, 0);
  assert.equal(response.roots.length, 1);
  assert.equal(response.roots[0].id, 'pending');
  assert.equal(response.roots[0].chain.length, 12);
  assert.equal(response.roots[0].chain.at(-1).byteLength, 59987);
  row.response = { observedBytes: stdout.length, observedSha256: hash(stdout), canonicalReencodeExact: true,
    status: response.status, code: response.code, operation: response.operation, sequence: response.sequence,
    files: response.files.length, roots: response.roots.length, pathDepth: response.roots[0].chain.length,
    pendingFileBytes: response.roots[0].chain.at(-1).byteLength };
  const cutoffMs = proof.preservedFailure.t0PreSpawnWindowMs;
  row.preservedLogicalCutoff = {
    t0PreSpawnWindowMs: cutoffMs, supervisorLeaseMs: proof.preservedFailure.supervisorLeaseMs,
    priorHelperActiveMs: proof.preservedFailure.priorHelperActiveMs,
    remainingAggregateMs: proof.preservedFailure.remainingAggregateMs,
    stagesReachedByCutoff: Object.entries(endpoints).filter(([, value]) => value <= cutoffMs).map(([stage]) => stage),
    firstResponseByteWrittenByCutoff: alignedStages.T10 <= cutoffMs,
    responseCompleteByCutoff: alignedStages.T11 <= cutoffMs,
    authoritativeOutcome: 'MO1307_TIMEOUT', responseAccepted: false,
    disposition: 'The isolated process was allowed to complete only for engineering observation. Its post-cutoff response is never promoted to B success.'
  };
} catch (error) {
  fatal = errorRecord(error);
} finally {
  if (!outputClaimed) {
    classification = 'DIAGNOSTIC_INCOMPLETE';
    process.stderr.write(JSON.stringify({ result: 'DIAGNOSTIC_INCOMPLETE', namespaceClaimed: false, fatal }) + '\n');
  } else {
    try {
      snapshotObservation();
      row.stdout = put('stdout.bin', stdout);
      row.stderr = put('stderr.txt', stderr);
      for (const binding of [...proof.sourceMembers, ...proof.installedMembers, ...staticBindings,
        proof.diagnosticCopy, proof.request, seal, invocationStart]) check(binding);
      assert.deepEqual(walk(sourceRoot), proof.sourceMembers);
      sourceUnchanged = true;
      assert.deepEqual(walk(installedRoot), proof.installedMembers);
      installedUnchanged = true;
      assert.deepEqual(walk(expectedFixtureRoot), proof.fixtureFiles);
      assert.deepEqual(topology(expectedFixtureRoot), proof.fixtureTopology);
      assert.equal(fs.existsSync(proof.pendingPath), true);
      assert.equal(fs.existsSync(proof.finalPath), false);
      fixtureUnchanged = true;
    } catch (error) {
      const finalizationError = errorRecord(error); (row.finalizationErrors ??= []).push(finalizationError); fatal ??= finalizationError;
    }
    if (fatal) classification = 'DIAGNOSTIC_INCOMPLETE';
    if (fatal) write('stopped.json', { outcome: 'DIAGNOSTIC_INCOMPLETE', noRetry: true, noSecondSample: true, fatal,
      finalizationErrors: row.finalizationErrors ?? [] });
    write('receipt.json', {
      kind: 'MO1307Phase3AR2BInspectPendingDiagnosticReceipt', result: fatal ? 'DIAGNOSTIC_INCOMPLETE' : 'PASS',
      classification, row, fatal, sourceUnchanged, installedUnchanged, fixtureUnchanged,
      launchAttempts: row.launchAttempts, helperInvocations: row.helperInvocations, retries: 0, warmups: 0, alternateInputs: 0,
      logicalBOutcome: 'MO1307_TIMEOUT', logicalBResponseAccepted: false,
      candidate: proof.candidate, productValidation: false, certification: false,
      scope: 'One isolated diagnostic-copy execution of the preserved B/ready/evaluate/INSPECT_PENDING request shape and exact pending fixture. The unrecoverable random session is replaced by the disclosed fixed session, so this is not a byte-identical request replay. A fresh 9000-ms supervisor permits full lifecycle observation; the preserved 702.1707-ms T0-to-deadline aggregate-selected window and MO1307_TIMEOUT remain authoritative.',
      finishedUtc: new Date().toISOString()
    });
    console.log(JSON.stringify({ result: fatal ? 'DIAGNOSTIC_INCOMPLETE' : 'PASS', classification,
      helperInvocations: row.helperInvocations, receipt: abs(output + '/receipt.json') }));
  }
  process.exitCode = fatal ? 1 : 0;
}
