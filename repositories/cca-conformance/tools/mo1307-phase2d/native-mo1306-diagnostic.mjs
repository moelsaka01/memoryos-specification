// One real integrated MO1306 evaluation with operational observations only.
// No testing supervisor/transport, worker override, retry or deadline change.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { performance } from 'node:perf_hooks';
import { root, evidence, json, write, record, check, hash } from './common.mjs';
import { packageFiles, checkPackage } from '../mo1307-phase1/package.mjs';
import { loadBundle } from '../mo1307-phase2b/test-support.mjs';
import { createSupervisor } from '../../../memoryos-readiness/src/runtime.mjs';
import { createHelperTransport, helperLaunchSpecification } from '../../../memoryos-readiness/src/helper-transport.mjs';
import { decodeHelperRequest, decodeHelperResponse } from '../../../memoryos-readiness/src/helper-protocol.mjs';
import { orchestrateCli } from '../../../memoryos-readiness/src/cli.mjs';
import { parseCliArgs } from '../../../memoryos-readiness/src/cli-args.mjs';
import { canonicalBytes } from '../../../memoryos-readiness/src/canonical.mjs';
import { summaryProjection } from '../../../memoryos-readiness/src/projections.mjs';
import { DEFINITIONS } from '../../../memoryos-readiness/src/constants.mjs';

assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output');
assert.equal(process.version, 'v24.21.0'); assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64');
const runtimeBytes = fs.readFileSync(process.execPath);
assert.equal(runtimeBytes.length, 93580104);
assert.equal(hash(runtimeBytes), 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const output = process.argv[3].replaceAll('\\', '/');
assert.ok(path.resolve(root, output).startsWith(path.resolve(root, evidence + '/native') + path.sep));
assert.equal(json(evidence + '/pre-native-authorization.json').result, 'PASS'); checkPackage();
assert.equal(fs.existsSync(path.join(root, output)), false);
fs.mkdirSync(path.join(root, output), { recursive: true });
const scratch = path.join(root, '.cache', 'm7d-m6diag-' + process.pid);
assert.equal(fs.existsSync(scratch), false); fs.mkdirSync(scratch);
const directory = path.join(scratch, 'mo1306-qualified'); fs.mkdirSync(directory);
const input = path.join(directory, 'input'), parent = path.join(directory, 'publication');
const fixture = 'repositories/cca-conformance/fixtures/mo1307/bundles/mo1306-qualified';
fs.cpSync(path.join(root, fixture), input, { recursive: true }); fs.mkdirSync(parent);
fs.writeFileSync(path.join(parent, 'owned-parent.txt'), 'One MO1306 diagnostic; retain all owned evidence.\n', { flag: 'wx' });
const destination = path.join(parent, 'result'), b = loadBundle('mo1306-qualified');
const walk = p => fs.readdirSync(path.join(root, p)).sort().flatMap(name => {
  const next = p + '/' + name;
  return fs.statSync(path.join(root, next)).isDirectory() ? walk(next) : [next];
});
const sourceBindings = [...packageFiles.map(p => 'repositories/memoryos-readiness/' + p), ...walk(fixture),
  'repositories/cca-conformance/tools/mo1307-phase2d/native-mo1306-diagnostic.mjs',
  'repositories/cca-conformance/tools/mo1307-phase2d/common.mjs',
  'repositories/cca-conformance/tools/mo1307-phase2b/test-support.mjs'].sort().map(p => record(p));
const inputSizes = {
  controls: Object.fromEntries(['configuration.json', 'authority.json', 'candidate.json', 'manifest.json'].map(p => [p, fs.statSync(path.join(input, p)).size])),
  manifestFiles: b.manifest.entries.length,
  manifestBytes: b.manifest.entries.reduce((sum, entry) => sum + entry.byteLength, 0),
};
write(output + '/campaign.json', { kind: 'MO1307NativeMO1306DiagnosticCampaign', version: '1.0.0', sourceBindings,
  inputSizes, launch: helperLaunchSpecification(), command: 'evaluate', invocationCount: 1, maxHelperRequests: 9,
  fixedProductionSupervisor: true, fixedProductionHelper: true, fixedProductionWorker: true,
  semanticDoubles: false, nativeDoubles: false, workerOverrides: false, retries: 0,
  budgetOverrides: false, apiDeadlineMs: DEFINITIONS.limits.apiDeadlineMs, cliDeadlineMs: DEFINITIONS.limits.cliDeadlineMs,
  helperDeadlineMs: DEFINITIONS.limits.helperDeadlineMs, helperAggregateDeadlineMs: DEFINITIONS.limits.helperAggregateDeadlineMs,
  cleanupAllowanceMs: DEFINITIONS.limits.cleanupAllowanceMs,
  scope: 'TRUSTED_ENGINEERING_OBSERVATION_OF_ACTUAL_PRIVATE_ORCHESTRATOR; NOT_PACKAGED_CLI_LAUNCH_OR_PHASE3_CERTIFICATION' });

const launch = parseCliArgs(['evaluate', '--input-root', input, '--config', 'configuration.json', '--authority', 'authority.json',
  '--authority-sha256', b.pins.trustedAuthorityDigest, '--candidate-sha256', b.pins.expectedCandidateDigest, '--output-root', destination]);
const supervisor = createSupervisor({ kind: 'cli' }), transport = createHelperTransport(supervisor), requests = [], chunks = [];
const started = performance.now(); let outcome = null, failure = null;
const describe = error => ({ code: error?.code ?? null, stage: error?.stage ?? null, reference: error?.reference ?? null,
  message: String(error?.message ?? error) });
const stdout = new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
const exchange = async frame => {
  const request = decodeHelperRequest(frame), prefix = output + '/' + String(request.sequence).padStart(2, '0');
  const observed = { sequence: request.sequence, operation: request.operation, session: request.session,
    files: request.files.map(f => ({ id: f.id, maxBytes: f.maxBytes })), startedAt: performance.now(),
    finishedAt: null, status: null, exitConfirmed: false, error: null };
  requests.push(observed);
  fs.writeFileSync(path.join(root, prefix + '.request.bin'), frame, { flag: 'wx' });
  observed.request = record(prefix + '.request.bin');
  try {
    const answer = await transport.exchange(frame);
    fs.writeFileSync(path.join(root, prefix + '.response.bin'), answer.responseBytes, { flag: 'wx' });
    observed.response = record(prefix + '.response.bin');
    const response = decodeHelperResponse(answer.responseBytes, request);
    observed.status = response.status; observed.exitConfirmed = answer.exitConfirmed;
    return answer;
  } catch (error) { observed.error = describe(error); throw error; }
  finally { observed.finishedAt = performance.now(); observed.elapsedMs = observed.finishedAt - observed.startedAt; }
};
try { outcome = await orchestrateCli(launch, { supervisor, exchange, stdout }); }
catch (error) { failure = describe(error); }
finally { try { await supervisor.dispose(); } catch (error) { failure ??= describe(error); } }
const snapshot = supervisor.snapshot(), stdoutBytes = Buffer.concat(chunks);
fs.writeFileSync(path.join(root, output, 'stdout.data'), stdoutBytes, { flag: 'wx' });
const names = fs.existsSync(destination) ? fs.readdirSync(destination).sort() : [];
const namespace = { outputRootExists: fs.existsSync(destination), names, files: [] };
for (const name of names) {
  const file = path.join(destination, name), stat = fs.statSync(file);
  namespace.files.push({ name, isFile: stat.isFile(), byteLength: stat.size,
    sha256: stat.isFile() && stat.size <= DEFINITIONS.limits.resultBytes ? hash(fs.readFileSync(file)) : null });
}
let exactResult = false, exactSummary = false;
if (!failure) {
  try {
    assert.equal(outcome.exitCode, 2); assert.equal(outcome.committed, true);
    assert.equal(requests.length, 9); assert.equal(snapshot.workers, 1); assert.equal(snapshot.activeRole, null);
    assert.equal(snapshot.cleanupConfirmed, true); assert.ok(requests.every(r => r.exitConfirmed));
    assert.deepEqual(names, ['memoryos-readiness-result.json']);
    assert.deepEqual(fs.readFileSync(path.join(destination, names[0])), canonicalBytes(b.result)); exactResult = true;
    assert.deepEqual(stdoutBytes, summaryProjection(b.result, 'evaluate', null)); exactSummary = true;
  } catch (error) { failure = describe(error); }
}
let sourceInputsUnchanged = true;
for (const member of sourceBindings) { try { check(member); } catch (error) { sourceInputsUnchanged = false; failure ??= describe(error); } }
const helperStarts = snapshot.events.filter(e => e.type === 'start' && e.role === 'helper');
const lastHelperStart = helperStarts.at(-1) ?? null;
const observation = { lastHelperStart, terminalEvent: snapshot.events.find(e => e.type === 'terminal') ?? null,
  lastRequest: requests.at(-1) ?? null, completedHelperOrdinals: snapshot.events.filter(e => e.type === 'quiescent' && e.role === 'helper').map(e => e.ordinal),
  observedDeadlineMinusStartEventMs: lastHelperStart ? lastHelperStart.deadline - lastHelperStart.at : null,
  aggregateChargedForCompletedHelpersMs: snapshot.helperUsedMs,
  interpretation: 'Events are operational observations. Start-event time follows private launch-clock capture by a small interval. Determine limiting budget from recorded deadline, aggregate charge and terminal event; wall time and ACQUISITION label alone do not identify the slot or root cause.' };
const result = failure ? 'FAIL' : 'PASS';
write(output + '/receipt.json', { kind: 'MO1307NativeMO1306Diagnostic', version: '1.0.0', result,
  elapsedMs: performance.now() - started, failure, outcome, sourceBindings, sourceInputsUnchanged,
  inputSizes, requests, snapshot, observation, namespace, stdout: record(output + '/stdout.data'), exactResult, exactSummary,
  configuredFixedWorker: true, semanticDoubles: false, nativeDoubles: false, normativeLimitsChanged: false,
  rootCause: 'NOT_INFERRED_BY_HARNESS', scope: 'ACTUAL_PRIVATE_ORCHESTRATOR_DIAGNOSTIC', phase3Certification: false });
console.log(JSON.stringify({ result, failure, helpers: snapshot.helpers, workers: snapshot.workers,
  lastRequestSequence: requests.at(-1)?.sequence ?? null, observation, namespace }));
process.exitCode = failure ? 1 : 0;
