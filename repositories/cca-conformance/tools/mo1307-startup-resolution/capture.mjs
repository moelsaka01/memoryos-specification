// Exactly one full-startup observation. Root may repair the captured mechanical cause; no diagnostic retry.
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
const T = 'repositories/cca-conformance/tools/mo1307-startup-resolution';
const E = 'repositories/cca-conformance/evidence/mo1307/startup-resolution/diagnostic';
const preparation = 'repositories/cca-conformance/evidence/mo1307/startup-resolution/diagnostic-preparation';
const prior = 'repositories/cca-conformance/evidence/mo1307/headless-cleanup/minimum-wire-smoke';
const baseHead = 'c285fd8e3100a0d6f4367b0e36298ade39dbdd38';
const candidate = null;
const abs = p => path.join(root, p);
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const record = file => { const bytes = fs.readFileSync(file); return { path: path.relative(root, file).replaceAll('\\', '/'), byteLength: bytes.length, sha256: hash(bytes) }; };
const read = relative => fs.readFileSync(abs(relative));
const json = relative => JSON.parse(read(relative).toString('utf8'));
const errorRecord = e => ({ name: e.name, code: e.code ?? null, stage: e.stage ?? null, message: e.message, stack: e.stack });
function put(name, bytes) { fs.writeFileSync(abs(E + '/' + name), bytes, { flag: 'wx' }); return record(abs(E + '/' + name)); }
const write = (name, value) => put(name, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
function git(...args) {
  const result = spawnSync('C:/Program Files/Git/cmd/git.exe', ['-c', 'safe.directory=' + root.replaceAll('\\', '/').replace(/\/$/, ''), ...args], { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 30000 });
  assert.ifError(result.error); assert.equal(result.status, 0); return result.stdout.trim();
}
const classificationById = {
  T001:'STARTUP_EXCEPTION_DEFECT', T002:'STARTUP_EXCEPTION_DEFECT', T003:'STARTUP_EXCEPTION_DEFECT',
  T004:'STARTUP_PIPE_DEFECT', T005:'STARTUP_PIPE_DEFECT', T006:'STARTUP_PIPE_DEFECT',
  T007:'STARTUP_NATIVE_BINDING_DEFECT', T008:'STARTUP_NATIVE_BINDING_DEFECT', T009:'STARTUP_NATIVE_BINDING_DEFECT',
  T010:'STARTUP_EXCEPTION_DEFECT', T011:'STARTUP_CONSOLE_MEMBERSHIP_DEFECT', T012:'STARTUP_CONSOLE_MEMBERSHIP_DEFECT',
  T013:'STARTUP_CONSOLE_MEMBERSHIP_DEFECT', T014:'STARTUP_CONSOLE_MEMBERSHIP_DEFECT', T015:'STARTUP_PIPE_DEFECT',
  T016:'STARTUP_DETACH_DEFECT', T017:'STARTUP_DETACH_DEFECT', T018:'STARTUP_POST_DETACH_PROOF_DEFECT',
  T019:'STARTUP_POST_DETACH_PROOF_DEFECT', T020:'STARTUP_POST_DETACH_PROOF_DEFECT',
  T021:'STARTUP_CLEANUP_DEFECT', T022:'STARTUP_CLEANUP_DEFECT', T023:'STARTUP_EXCEPTION_DEFECT',
  T024:'STARTUP_EXCEPTION_DEFECT', T025:'STARTUP_EXCEPTION_DEFECT',
};
assert.equal(process.argv.length, 2, 'No alternate case or launch override');
assert.equal(fs.existsSync(abs(E)), false, 'This single diagnostic generation has already been consumed');
fs.mkdirSync(abs(E), { recursive: false }); // Consume the generation even if preflight fails.
const row = { name: 'one-instrumented-startup', candidate, baseHead, helperInvocations: 0, events: [], startedUtc: new Date().toISOString() };
let sourceBefore = [], preflightBindings = [], seal = null, fatal = null, sourceUnchanged = false, captureResult = 'CAPTURE_INCOMPLETE', classification = null;
let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), transportResult = null;
let diagnosis = { scriptEntryOccurred: false, lastSuccessfulId: null, firstFailure: null, classification: null, records: [] };
let packageFiles = [];
const members = () => packageFiles.map(name => record(abs('repositories/memoryos-readiness/' + name)));
const checkBindings = () => { assert.deepEqual(members(), sourceBefore); for (const binding of preflightBindings) assert.deepEqual(record(abs(binding.path)), binding); };
try {
  assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64'); assert.equal(process.version, 'v24.21.0');
  assert.equal(git('rev-parse', 'HEAD'), baseHead, 'Exact unaccepted source base required');
  packageFiles = JSON.parse(read('repositories/memoryos-readiness/package.json')).files;
  assert.equal(packageFiles.length, 89); sourceBefore = members();
  const failedReceipt = json(prior + '/receipt.json'), failedSeal = json(prior + '/seal.json');
  assert.equal(failedReceipt.result, 'FAIL'); assert.equal(failedReceipt.helperInvocations, 1); assert.equal(failedReceipt.case.exitCode, 22);
  assert.deepEqual(sourceBefore, failedReceipt.source, 'Production bytes must match the failed smoke');
  const frame = read(prior + '/request.bin');
  assert.equal(frame.length, 358); assert.equal(hash(frame), 'sha256:563886671cce30ab7882833374bedb9b0b823368ee56d98d2a82cd0e02d705e5');
  assert.deepEqual(record(abs(prior + '/request.bin')), failedSeal.request);
  const request = decodeHelperRequest(frame); // Used internally; not emitted as diagnostics.
  const inputPath = abs('.cache/mo1307-headless-cleanup-minimum-wire-smoke/input/small.bin');
  const inputBytes = fs.readFileSync(inputPath);
  assert.equal(inputBytes.length, 3); assert.equal(hash(inputBytes), 'sha256:ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356');
  assert.deepEqual(inputBytes, Buffer.from('{}\n')); assert.deepEqual(record(inputPath), failedSeal.input);
  assert.equal(request.roots.length, 1); assert.equal(request.files.length, 1);
  assert.equal(path.resolve(request.roots[0].path, request.files[0].path), path.resolve(inputPath));
  const launch = helperLaunchSpecification(), L = DEFINITIONS.limits;
  assert.deepEqual(launch, failedSeal.launch, 'Only diagnostic script substitution is allowed');
  assert.equal(launch.options.detached, false); assert.equal(launch.options.windowsHide, true); assert.equal(launch.options.shell, false);
  assert.deepEqual([...launch.options.stdio], ['pipe', 'pipe', 'pipe']);
  assert.deepEqual({ ...launch.options.env }, { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' });
  for (const [key, value] of Object.entries({ helperDeadlineMs: 5000, helperAggregateDeadlineMs: 20000, cliDeadlineMs: 30000, apiDeadlineMs: 10000, cleanupAllowanceMs: 2000, stderrBytes: 4096 })) assert.equal(L[key], value);
  const nodeBinding = record(process.execPath), psBinding = record(launch.executable);
  assert.deepEqual(nodeBinding, failedSeal.runtime[0]); assert.deepEqual(psBinding, failedSeal.runtime[1]);
  const copyPath = preparation + '/instrumented.ps1', proofPath = preparation + '/instrumentation-proof.json';
  const proof = json(proofPath);
  assert.equal(proof.result, 'PASS'); assert.equal(proof.reversibleAdditions, true);
  assert.equal(proof.exactInverseEquality, true);
  assert.deepEqual(proof.source, record(launch.args.at(-1)));
  assert.deepEqual(proof.generator, record(abs(T + '/instrument.mjs')));
  assert.deepEqual(proof.diagnosticCopy, record(abs(copyPath)));
  assert.equal(proof.inverseSha256, proof.source.sha256);
  assert.deepEqual(read(preparation + '/inverse-reconstruction.ps1.data'), fs.readFileSync(launch.args.at(-1)));
  assert.equal(proof.stderr.productCapBytes, L.stderrBytes); assert.ok(proof.stderr.totalMaximumBytes <= L.stderrBytes);
  assert.notEqual(path.resolve(abs(copyPath)), path.resolve(launch.args.at(-1)));
  preflightBindings = [
    record(abs(T + '/capture.mjs')), record(abs(T + '/instrument.mjs')), record(abs(copyPath)), record(abs(proofPath)),
    record(abs(preparation + '/replacement-ledger.json')), record(abs(preparation + '/inverse-reconstruction.ps1.data')),
    record(abs(prior + '/request.bin')), record(inputPath),
    record(abs('docs/mo1307-headless-cleanup-correction.md')), record(abs('repositories/cca-conformance/evidence/mo1307/startup-resolution/user-request.txt')),
    record(abs(prior + '/receipt.json')), record(abs(prior + '/seal.json')), nodeBinding, psBinding,
  ];
  const diagnosticArgs = [...launch.args]; diagnosticArgs[diagnosticArgs.length - 1] = abs(copyPath);
  row.request = put('request.bin', frame);
  row.launch = { executable: launch.executable, args: diagnosticArgs, options: launch.options };
  write('seal.json', {
    kind: 'MO1307FullStartupResolutionDiagnosticSeal', candidate, baseHead, basePackageTree: git('rev-parse', 'HEAD:repositories/memoryos-readiness'),
    source: sourceBefore, bindings: preflightBindings, request: row.request, input: record(inputPath), originalLaunch: launch, diagnosticLaunch: row.launch,
    instrumentationProof: record(abs(proofPath)), limits: { helperMs: 5000, aggregateHelperMs: 20000, cliMs: 30000, apiMs: 10000, cleanupMs: 2000, nativeHostWaitMs: 1000, stderrBytes: 4096 },
    policy: { invocations: 1, retries: 0, alternateCases: 0, stdoutInstrumentation: false, productionMutation: false, noCertification: true, unexpectedSuccessStops: true },
    diagnosis: 'Bounded stderr trace arrays and one failure object parsed only after production transport settlement. Strict transport result remains separate from engineering startup diagnosis.',
    classifications: [...new Set(Object.values(classificationById)), 'STARTUP_FAILURE_NOT_REPRODUCED'], sealedUtc: new Date().toISOString(),
  });
  seal = record(abs(E + '/seal.json')); row.seal = seal; checkBindings();
  const captured = { stdout: [], stderr: [] }, totals = { stdout: 0, stderr: 0 }, retained = { stdout: 0, stderr: 0 };
  const streams = { stdinFinished: false, stdinClosed: false, stdoutEnded: false, stdoutClosed: false, stderrEnded: false, stderrClosed: false, processExited: false, processClosed: false };
  let childCode = null, childSignal = null, answer = null, problem = null;
  const start = performance.now(), supervisor = createSupervisor({ kind: 'cli' });
  const event = (name, detail = {}) => row.events.push({ event: name, at: performance.now(), elapsedMs: performance.now() - start, ...detail });
  const transport = createHelperTransportForTesting(supervisor, (executable, args, options) => {
    assert.equal(executable, launch.executable); assert.deepEqual(args, [...launch.args]);
    assert.deepEqual(options, { ...launch.options, env: { ...launch.options.env }, stdio: [...launch.options.stdio] });
    assert.equal(row.helperInvocations, 0, 'Never launch twice'); row.helperInvocations++;
    const child = spawn(executable, diagnosticArgs, options); row.pid = child.pid;
    child.once('spawn', () => event('spawn'));
    child.stdin.once('finish', () => { streams.stdinFinished = true; event('stdin-finish'); });
    for (const label of ['stdout', 'stderr']) {
      child[label].once('end', () => { streams[label + 'Ended'] = true; event(label + '-end'); });
      child[label].on('data', bytes => {
        totals[label] += bytes.length;
        const cap = label === 'stdout' ? L.helperResponseBytes : L.stderrBytes;
        const keep = bytes.subarray(0, Math.max(0, cap - retained[label]));
        if (keep.length) { captured[label].push(Buffer.from(keep)); retained[label] += keep.length; }
      });
    }
    for (const [label, stream] of [['stdin', child.stdin], ['stdout', child.stdout], ['stderr', child.stderr]]) {
      stream.once('close', () => { streams[label + 'Closed'] = true; event(label + '-close'); });
      stream.on('error', error => event(label + '-error', { code: error.code ?? null, message: error.message.slice(0, 256) }));
    }
    child.once('error', error => event('process-error', { code: error.code ?? null, message: error.message.slice(0, 256) }));
    child.once('exit', (code, signal) => { streams.processExited = true; event('process-exit', { code, signal }); });
    child.once('close', (code, signal) => { streams.processClosed = true; childCode = code; childSignal = signal; event('process-close', { code, signal }); });
    return child; // Actual streams and lifecycle, with no stderr filtering or stdout proxy.
  });
  write('invocation-start.json', { candidate, baseHead, seal, request: row.request, launch: row.launch, invocationsAllowed: 1, retries: 0, startedUtc: new Date().toISOString() });
  try { answer = await transport.exchange(frame); } catch (error) { problem = error; }
  finally {
    try { await supervisor.dispose(); } catch (error) { problem ??= error; }
    row.elapsedProductMs = performance.now() - start; row.snapshot = supervisor.snapshot(); row.streams = streams; row.exitCode = childCode; row.exitSignal = childSignal;
    stdout = Buffer.concat(captured.stdout); stderr = Buffer.concat(captured.stderr);
    row.stdout = put('stdout.data', stdout); row.stderr = put('stderr.data', stderr);
    row.stdoutTotalBytes = totals.stdout; row.stderrTotalBytes = totals.stderr;
    row.captureTruncated = totals.stdout > retained.stdout || totals.stderr > retained.stderr;
    transportResult = problem ? { outcome: 'REJECTED', error: errorRecord(problem) } : { outcome: 'RESOLVED', exitConfirmed: answer?.exitConfirmed === true, responseBytes: answer?.responseBytes?.length ?? null };
    row.transport = transportResult;
  }
  assert.equal(row.helperInvocations, 1);
  let response = null;
  if (childCode === 0) {
    try {
      response = decodeHelperResponse(stdout, request);
      row.wireResponse = { status: response.status, code: response.code };
    } catch (error) { row.wireResponseError = errorRecord(error); }
  }
  try {
    const diagnosticLines = stderr.toString('utf8').split(/\r?\n/u).filter(line => line.length > 0);
    const diagnostics = diagnosticLines.map(line => JSON.parse(line));
    const trace = diagnostics.filter(Array.isArray), failures = diagnostics.filter(value => !Array.isArray(value));
    assert.ok(trace.length > 0 && failures.length <= 1, 'One bounded full-startup trace');
    let elapsed = -1;
    for (const event of trace) {
      assert.equal(event.length, 6);
      const [id, ms, value, nativeError, meaningful, passed] = event;
      assert.ok(proof.ids.some(item => item.id === id), 'Trace ID must be predeclared: ' + id);
      assert.ok(Number.isFinite(ms) && ms >= elapsed && ms >= 0); elapsed = ms;
      assert.ok(value === null || ['string','number','boolean'].includes(typeof value));
      assert.ok(nativeError === null || Number.isInteger(nativeError));
      assert.ok(meaningful === 0 || meaningful === 1); assert.ok(passed === 0 || passed === 1);
    }
    diagnosis.records = diagnostics; diagnosis.trace = trace;
    diagnosis.scriptEntryOccurred = trace.some(value => value[0] === 'T001' && value[5] === 1);
    diagnosis.startupCompletionReached = trace.some(value => value[0] === 'T023' && value[5] === 1);
    diagnosis.firstRequestReadReached = trace.some(value => value[0] === 'T024' && value[5] === 1);
    if (failures.length === 1) {
      const failure = failures[0];
      assert.equal(failure.kind, 'MO1307StartupTraceFailure');
      assert.equal(failure.outerId, 'T025');
      assert.equal(failure.traceOverflow, 0);
      const firstFailedEvent = trace.find(event => event[5] === 0);
      if(firstFailedEvent)assert.equal(failure.firstFailure?.id,firstFailedEvent[0], 'First failed event must survive later guards and cleanup');
      assert.ok(typeof failure.firstFailure?.id === 'string' && /^T(?:00[1-9]|01[0-9]|02[0-5])(?:\.[A-Za-z0-9]+)*$/u.test(failure.firstFailure.id));
      const baseId = failure.firstFailure.id.split('.')[0];
      assert.ok(classificationById[baseId]);
      const declaration = proof.ids.find(item => item.id === failure.firstFailure.id);
      assert.ok(declaration && declaration.status === 'INSTRUMENTED');
      diagnosis.lastSuccessfulId = failure.firstFailure.lastSuccessfulId ?? null;
      diagnosis.firstFailure = {...failure.firstFailure, operation:declaration.operation};
      diagnosis.outerException = failure.outerException ?? null;
      diagnosis.firstFailureBaseId = baseId;
      diagnosis.cleanupLastSuccessfulId = failure.cleanupLastSuccessfulId ?? null;
      diagnosis.activeIdAtOuterCatch = failure.activeId ?? null;
    }
  } catch (error) { diagnosis.parseError = errorRecord(error); }
  if (response && childCode === 0) {
    // A valid OK or ERROR frame proves startup completed, even if diagnostics are malformed.
    classification = 'STARTUP_FAILURE_NOT_REPRODUCED'; captureResult = 'NOT_REPRODUCED_STOP';
  } else if (!row.captureTruncated && !diagnosis.parseError && childCode === 22 && stdout.length === 0 && diagnosis.scriptEntryOccurred && diagnosis.firstFailure) {
    classification = classificationById[diagnosis.firstFailureBaseId]; captureResult = 'STARTUP_FAILURE_CAPTURED';
  } else {
    diagnosis.unavailableReason = 'Exact startup failure was not established by the bounded retained diagnostic; no inferred classification or second invocation.';
  }
  diagnosis.classification = classification;
  write('diagnosis.json', diagnosis);
  checkBindings();
} catch (error) { fatal = errorRecord(error); }
finally {
  try { if (sourceBefore.length === 89) { checkBindings(); sourceUnchanged = true; } } catch (error) { fatal ??= errorRecord(error); }
  if (fatal || !sourceUnchanged) captureResult = 'CAPTURE_INCOMPLETE';
  write('stopped.json', { reason: captureResult, classification, noMoreDiagnosticInvocations: true, postRepairSmokeRequiresNewRepairedSourceBinding: true, retries: 0, alternateCases: 0, certificationStarted: false, targetedMechanicalRepairAuthorizedAfterCapturedCauseReview: true });
  write('receipt.json', { kind: 'MO1307FullStartupResolutionDiagnosticReceipt', result: captureResult, candidate, candidateStatus:'DIAGNOSTIC_ONLY_NOT_CANDIDATE', baseHead, case: row, classification,
    diagnosis, transportResult, fatal, seal, source: sourceBefore, sourceUnchanged, helperInvocations: row.helperInvocations,
    additionalCasesExecuted: 0, retries: 0, certificationStarted: false, diagnosticOnly: true,
    limitsUnchanged: true, finishedUtc: new Date().toISOString(),
    interpretation: 'Engineering diagnostic outcome only. Startup failure is never validation PASS; native quiescence is not inferred from helper exit or closed streams. Missing diagnostic evidence remains unclassified.' });
  console.log(JSON.stringify({ result: captureResult, classification, helperInvocations: row.helperInvocations, exit: row.exitCode ?? null, stdoutBytes: row.stdoutTotalBytes ?? null, stderrBytes: row.stderrTotalBytes ?? null, receipt: E + '/receipt.json' }));
  process.exitCode = captureResult === 'CAPTURE_INCOMPLETE' ? 1 : 0;
}
