// R2 engineering observation only. Preparation launches zero helpers; execution is latched once.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { root, read, json, record, check, write, git, str, blobs, hash } from '../mo1307-helper-deadline-uncensored/common.mjs';
import { instrument, restore } from './instrument.mjs';
import { createSupervisor } from '../../../memoryos-readiness/src/runtime.mjs';
import { helperLaunchSpecification, createHelperTransportForTesting } from '../../../memoryos-readiness/src/helper-transport.mjs';
import { decodeHelperRequest, decodeHelperResponse } from '../../../memoryos-readiness/src/helper-protocol.mjs';
import { DEFINITIONS } from '../../../memoryos-readiness/src/constants.mjs';

const BASE = '4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97';
const PROD = 'defe93989efc6501b1a730b82e79e705884b269b';
const E = 'repositories/cca-conformance/evidence/mo1307/phase3a-r2-diagnostic';
const T = 'repositories/cca-conformance/tools/mo1307-phase3a-r2';
const P = 'repositories/cca-conformance/evidence/mo1307/helper-deadline-characterization';
const REQUEST = P + '/requests/D.request.bin';
const HELPER = 'repositories/memoryos-readiness/helpers/windows-inspect.ps1';
const COPY = E + '/windows-inspect.instrumented.ps1';
const NODE_HASH = 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
const D_HASH = 'sha256:0767b86a4750d2b031c8d923824beb26bc0c7e89f05cf11ba2a21379b755a08e';
const AUTHORIZATION = 'C:/Users/melsa/.codex/attachments/90b1a692-fbb6-4f4d-82e3-e44a4bd49d7c/Pasted text.txt';
const runArgs = ['--request', REQUEST, '--executions', '1', '--helper-limit-ms', '5000', '--cleanup-limit-ms', '2000'];
const absolute = p => path.resolve(root, p);
const rawWrite = (p, bytes) => { fs.mkdirSync(path.dirname(absolute(p)), { recursive: true }); fs.writeFileSync(absolute(p), bytes, { flag: 'wx' }); };
const compactError = e => ({ name: e?.name ?? null, code: e?.code ?? null, stage: e?.stage ?? null });
const state = () => ({ main: str('rev-parse', 'HEAD'), branch: str('branch', '--show-current'),
  mainStatus: str('status', '--porcelain=v1'),
  r3a: str('-c', 'safe.directory=C:/Users/melsa/Documents/Codex/r3a', '-C', 'C:/Users/melsa/Documents/Codex/r3a', 'rev-parse', 'HEAD'),
  r3aStatus: str('-c', 'safe.directory=C:/Users/melsa/Documents/Codex/r3a', '-C', 'C:/Users/melsa/Documents/Codex/r3a', 'status', '--porcelain=v1') });

function basicGate() {
  assert.equal(str('rev-parse', 'HEAD'), BASE);
  assert.equal(str('branch', '--show-current'), 'main');
  assert.equal(str('diff', '--name-only'), '', 'No tracked working-tree edits permitted');
  assert.equal(str('diff', '--cached', '--name-only'), '', 'No staged edits permitted');
  assert.equal(process.version, 'v24.21.0');
  assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64');
  assert.equal(process.execArgv.length, 0);
  assert.ok(!process.env.NODE_OPTIONS && !process.env.NODE_PATH);
  assert.equal(hash(read(process.execPath)), NODE_HASH);
  for (const rev of [PROD, '5cb213eeab8a6deec39a8f8f93ea13a70e053231', 'f4ed5873969ab6b627941dc20d5823c5e853b9fe']) assert.equal(str('cat-file', '-t', rev), 'commit');
  assert.equal(str('diff', '--name-only', PROD, 'HEAD', '--', 'repositories/memoryos-readiness'), '');
  const L = DEFINITIONS.limits;
  assert.equal(L.helperDeadlineMs, 5000); assert.equal(L.cleanupAllowanceMs, 2000);
  assert.equal(L.helperAggregateDeadlineMs, 20000); assert.equal(L.cliDeadlineMs, 30000);
  assert.equal(L.apiDeadlineMs, 10000); assert.equal(L.stderrBytes, 4096);
}

function authorities() {
  basicGate();
  const plan = json(P + '/sample-plan.json');
  const workload = plan.cases.find(c => c.id === 'D');
  assert.equal(workload.request.path, REQUEST); assert.equal(workload.request.sha256, D_HASH);
  assert.equal(workload.fileCount, 19); assert.equal(workload.aggregateBytes, 19711);
  check(workload.request); check(workload.manifest); for (const m of workload.members) check(m);
  const request = decodeHelperRequest(read(REQUEST));
  assert.equal(request.operation, 'READ_SET'); assert.equal(request.sequence, 3); assert.equal(request.files.length, 19);
  assert.equal(request.session, workload.session); assert.equal(request.roots[0].path, workload.root);
  const production = json(P + '/integrity-before.json').members;
  assert.equal(production.length, 89);
  const exact = blobs(PROD, production.map(m => m.path));
  production.forEach((m, i) => { check(m); check(m, exact[i]); });
  assert.equal(hash(read(HELPER)), 'sha256:35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8');
  const runtime = json(P + '/runtime-environment.json');
  check(runtime.node.executable); check(runtime.powershell.executable);
  assert.equal(record(process.execPath).sha256, runtime.node.executable.sha256);
  const spec = helperLaunchSpecification();
  assert.equal(record(spec.executable).sha256, runtime.powershell.executable.sha256);
  const source = json(P + '/authority-source-before.json');
  const inputRoot = source.inputRoots.find(r => r.case === 'D');
  const preservation = [
    ...production, workload.request, workload.manifest, ...workload.members,
    ...inputRoot.files.map(m => ({ ...m, path: path.join(inputRoot.root, m.path) })),
    runtime.node.executable, runtime.powershell.executable,
    ...['docs/mo1307-contract-freeze-1.md', 'docs/mo1307-phase3a-readset-correction.md',
      'docs/mo1307-helper-deadline-characterization.md', 'docs/mo1307-helper-deadline-design.md',
      'docs/mo1307-helper-deadline-uncensored.md', P + '/sample-plan.json', P + '/integrity-before.json',
      P + '/runtime-environment.json', P + '/authority-source-before.json',
      'repositories/cca-conformance/tools/mo1307-helper-deadline-design/campaign.mjs',
      'repositories/cca-conformance/tools/mo1307-helper-deadline-uncensored/common.mjs', AUTHORIZATION,
      'C:/Users/melsa/Documents/Codex/r3a/docs/mo1307-phase3a-refresh.md',
      'C:/Users/melsa/Documents/Codex/r3a/docs/mo1307-phase3a-refresh-localization.md',
      'C:/Users/melsa/Documents/Codex/r3a/docs/mo1307-phase3a-refresh-final.md',
      'C:/Users/melsa/Documents/Codex/r3a/repositories/cca-conformance/evidence/mo1307/phase3a-refresh-final/certification-receipt.json',
    ].map(p => record(p)),
  ];
  for (const m of preservation) check(m);
  const before = state(); assert.equal(before.r3a, PROD);
  return { baseline: BASE, productionAuthority: PROD, authorityState: before, production, workload,
    runtime, launchSpecification: spec, preservation, inputRootFileCount: inputRoot.fileCount,
    identities: { helper: record(HELPER), node: record(process.execPath), powershell: record(spec.executable), request: record(REQUEST) } };
}

function prepare() {
  assert.ok(!fs.existsSync(absolute(E)), 'Preparation is create-only');
  const bound = authorities();
  const transformed = instrument(read(HELPER));
  assert.ok(Buffer.isBuffer(transformed.bytes));
  assert.ok(restore(transformed.bytes, transformed.manifest).equals(read(HELPER)), 'Exact insertion-only recovery required');
  rawWrite(COPY, transformed.bytes);
  write(E + '/instrumentation.json', transformed.manifest);
  const tooling = [T + '/profile-once.mjs', T + '/instrument.mjs', COPY, E + '/instrumentation.json'].map(p => record(p));
  write(E + '/plan.json', { kind: 'MO1307Phase3AR2DiagnosticPlan', version: '1.0.0',
    createdAtUtc: new Date().toISOString(), ...bound, tooling, engineeringCopy: record(COPY),
    command: { executable: process.execPath, args: [absolute(T + '/profile-once.mjs'), ...runArgs], cwd: root },
    limits: { helperWholeLifecycleMs: 5000, cleanupMs: 2000, aggregateHelperMs: 20000, cliMs: 30000, apiWorkerMs: 10000, stderrBytes: 4096 },
    exactExecutionCount: 1, warmups: 0, retries: 0, replacementExecutions: 0,
    sourceMethod: 'Insertion-only engineering copy; original C3RB bytes recovered exactly. Original supervisor and transport imported unchanged.',
    launchDifference: 'Only the final fixed -File argument names the bound engineering copy. Child, stdin request and product transport semantics are retained.',
    evidenceClass: 'R2_DIAGNOSTIC_EVIDENCE_ONLY', historicalStepGCauseEstablished: false, certification: false,
    deadlineCharacterization: false, replacementH: 'NOT_ESTABLISHED', privateSequenceExecuted: false,
    limitations: ['One instrumented surrogate workload; not historical Step G replay.',
      'Stopwatch reads, marker writes, added script parsing and parent listeners add uncalibrated overhead; none is subtracted.',
      'No native external process observer; missing product quiescence remains unconfirmed.',
      'Child and parent clocks are retained separately; marker receipt includes pipe/event-loop delay.',
      'Execution token/access-policy parity with previous accepted runs has not been established.'] });
  console.log(JSON.stringify({ result: 'PREPARED_NO_HELPER_EXECUTION', engineeringCopy: record(COPY), request: bound.identities.request, plannedExecutions: 1 }));
}

async function execute() {
  assert.deepEqual(process.argv.slice(2), runArgs, 'Only the exact authorized D invocation is permitted');
  const plan = json(E + '/plan.json');
  const current = authorities();
  for (const m of [...plan.preservation, ...plan.tooling]) check(m);
  assert.equal(current.authorityState.r3aStatus, plan.authorityState.r3aStatus);
  assert.ok(restore(read(COPY), json(E + '/instrumentation.json')).equals(read(HELPER)));
  const frame = read(REQUEST), request = decodeHelperRequest(frame), spec = helperLaunchSpecification();
  assert.deepEqual(spec, plan.launchSpecification);
  // The create-new claim is never removed, including a launch failure. There is no retry path.
  write(E + '/execution-claimed.json', { kind: 'MO1307Phase3AR2OneShotClaim', claimedAtUtc: new Date().toISOString(),
    plan: record(E + '/plan.json'), tooling: plan.tooling, allowed: 1, command: plan.command });
  let launches = 0, answer = null, error = null, settled = null;
  const events = [], stdoutChunks = [], stderrChunks = [];
  const pipes = { stdin: false, stdout: false, stderr: false };
  let stdoutBytes = 0, stderrBytes = 0, firstByte = null, lastByte = null, firstMarkerReceipt = null;
  let spawnEntered = null, spawnReturned = null, pid = null;
  const abort = new AbortController(); const interrupt = () => abort.abort();
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  const supervisor = createSupervisor({ kind: 'cli', signal: abort.signal });
  const forward = (exe, args, options) => {
    assert.equal(exe, spec.executable); assert.deepEqual(args, [...spec.args]);
    assert.deepEqual(options, { ...spec.options, env: { ...spec.options.env }, stdio: [...spec.options.stdio] });
    assert.equal(launches, 0); launches++;
    const engineeringArgs = [...args]; engineeringArgs[engineeringArgs.length - 1] = absolute(COPY);
    spawnEntered = performance.now();
    const child = spawn(exe, engineeringArgs, options);
    spawnReturned = performance.now(); pid = child.pid ?? null;
    // No throwing assertions, decoding, hashing, logging or disk work after spawn and before ownership returns.
    child.once('spawn', () => events.push({ event: 'spawn', at: performance.now() }));
    child.stdin.once('finish', () => events.push({ event: 'stdin-finish', at: performance.now() }));
    child.stdout.on('data', b => { firstByte ??= performance.now(); lastByte = performance.now(); stdoutBytes += b.length;
      if (stdoutBytes <= DEFINITIONS.limits.helperResponseBytes) stdoutChunks.push(b); });
    child.stderr.on('data', b => { firstMarkerReceipt ??= performance.now(); stderrBytes += b.length;
      if (stderrBytes <= 4096) stderrChunks.push(b); });
    child.once('exit', (code, signal) => events.push({ event: 'exit', at: performance.now(), code, signal }));
    child.once('close', (code, signal) => events.push({ event: 'close', at: performance.now(), code, signal }));
    child.once('error', e => events.push({ event: 'spawn-error', at: performance.now(), error: compactError(e) }));
    for (const key of Object.keys(pipes)) child[key].once('close', () => { pipes[key] = true; events.push({ event: key + '-close', at: performance.now() }); });
    return child;
  };
  const startedAtUtc = new Date().toISOString(), exchangeBegin = performance.now();
  try { answer = await createHelperTransportForTesting(supervisor, forward).exchange(frame); settled = performance.now(); }
  catch (e) { settled = performance.now(); error = compactError(e); }
  finally { await supervisor.dispose(); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
  const snapshot = supervisor.snapshot();
  const rawResponse = Buffer.concat(stdoutChunks), rawMarkers = Buffer.concat(stderrChunks);
  rawWrite(E + '/response.bin', rawResponse); rawWrite(E + '/markers.stderr.bin', rawMarkers);
  let response = null, responseValidation = 'NO_COMPLETE_VALID_RESPONSE', validationError = null;
  try {
    if (rawResponse.length) {
      const decoded = decodeHelperResponse(rawResponse, request);
      response = { status: decoded.status, code: decoded.code, fileCount: decoded.files.length, rootCount: decoded.roots.length };
      if (answer) assert.ok(answer.exitConfirmed === true && Buffer.from(answer.responseBytes).equals(rawResponse));
      if (decoded.status === 'OK') {
        assert.equal(decoded.files.length, request.files.length);
        for (const f of decoded.files) {
          const descriptor = request.files.find(r => r.id === f.id);
          const content = Buffer.from(f.bytes.join(''), 'base64');
          assert.ok(content.equals(read(path.join(request.roots[0].path, ...descriptor.path.split('/')))), 'Snapshot differs from retained input');
        }
        responseValidation = 'EXACT_PROTOCOL_AND_RETAINED_INPUT_BYTES';
      } else responseValidation = 'VALID_PROTOCOL_ERROR_NOT_SUCCESS';
    }
  } catch (e) { validationError = compactError(e); responseValidation = 'RESPONSE_VALIDATION_FAILED'; }
  const preservationFailures = [];
  for (const m of [...plan.preservation, ...plan.tooling]) { try { check(m); } catch { preservationFailures.push(m.path); } }
  const after = state();
  if (after.main !== BASE || after.r3a !== PROD || after.r3aStatus !== plan.authorityState.r3aStatus) preservationFailures.push('GIT_AUTHORITY_STATE');
  const start = snapshot.events.find(e => e.type === 'start' && e.role === 'helper');
  const origin = start ? start.deadline - 5000 : null;
  const result = error?.code === 'MO1307_TIMEOUT' ? 'TIMEOUT' : error ? 'TRANSPORT_ERROR' :
    response?.status === 'OK' && !validationError ? 'DIAGNOSTIC_REQUEST_COMPLETED' : 'DIAGNOSTIC_SEMANTIC_OR_OBSERVATION_ERROR';
  write(E + '/receipt.json', { kind: 'MO1307Phase3AR2DiagnosticReceipt', version: '1.0.0', evidenceClass: 'R2_DIAGNOSTIC_EVIDENCE_ONLY',
    baseline: BASE, productionAuthority: PROD, plan: record(E + '/plan.json'), claim: record(E + '/execution-claimed.json'),
    startedAtUtc, endedAtUtc: new Date().toISOString(), result, error, validationError, actualLaunchAttempts: launches,
    actualHelperExecutions: pid === null ? 0 : 1, pid, configuredLimits: plan.limits, identities: plan.identities,
    engineeringCopy: plan.engineeringCopy, request: plan.workload.request, response: record(E + '/response.bin'),
    markers: record(E + '/markers.stderr.bin'), responseObservation: response, responseValidation,
    stdoutBytes, stderrBytes, pipes, events, nodeTimeOriginUnixMs: performance.timeOrigin,
    times: { origin, originMethod: 'ACTUAL_SUPERVISOR_DEADLINE_MINUS_5000', exchangeBegin, spawnEntered, spawnReturned,
      firstMarkerReceipt, firstResponseByte: firstByte, lastResponseByte: lastByte, transportSettled: settled },
    durations: { wholeTransportSettlementMs: origin === null ? null : settled - origin, exchangeMs: settled - exchangeBegin,
      supervisorHelperActiveMs: snapshot.helperUsedMs, firstResponseByteMs: firstByte === null || origin === null ? null : firstByte - origin,
      terminalMs: snapshot.terminalAt === null || origin === null ? null : snapshot.terminalAt - origin },
    supervisor: snapshot, cleanupConfirmed: snapshot.cleanupConfirmed, independentConsoleExitProof: 'NOT_COLLECTED',
    productionAndBoundInputsUnchanged: preservationFailures.length === 0, preservationFailures, repositoryStateAfter: after,
    certification: false, historicalStepGCauseEstablished: false, deadlineCharacterization: false, replacementH: 'NOT_ESTABLISHED',
    privateSequenceExecuted: false, additionalObserverProcesses: 0, warmups: 0, retries: 0, replacementExecutions: 0,
    limitations: plan.limitations, furtherExecutionAuthorized: false });
  console.log(JSON.stringify({ result, actualHelperExecutions: pid === null ? 0 : 1, lifecycleMs: origin === null ? null : settled - origin,
    response, markerBytes: stderrBytes, cleanupConfirmed: snapshot.cleanupConfirmed, preservationFailures: preservationFailures.length }));
}

if (process.argv.slice(2).join(' ') === '--prepare') prepare();
else await execute();
