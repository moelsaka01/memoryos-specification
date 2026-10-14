// Offline receipt/marker analysis only; this file cannot launch a helper.
import assert from 'node:assert/strict';
import { read, json, record, check, write, str, hash } from '../mo1307-helper-deadline-uncensored/common.mjs';
import { restore } from './instrument.mjs';

const E = 'repositories/cca-conformance/evidence/mo1307/phase3a-r2-diagnostic';
const plan = json(E + '/plan.json'), receipt = json(E + '/receipt.json'), manifest = json(E + '/instrumentation.json');
for (const r of [...plan.preservation, ...plan.tooling, receipt.plan, receipt.claim, receipt.response, receipt.markers]) check(r);
assert.equal(receipt.actualLaunchAttempts, 1); assert.equal(receipt.actualHelperExecutions, 1);
assert.equal(receipt.certification, false); assert.equal(receipt.replacementH, 'NOT_ESTABLISHED');
assert.equal(receipt.configuredLimits.helperWholeLifecycleMs, 5000);
assert.equal(receipt.configuredLimits.cleanupMs, 2000);
assert.equal(hash(restore(read(plan.engineeringCopy.path), manifest)), plan.identities.helper.sha256);
const raw = read(receipt.markers.path);
assert.ok(raw.length <= 4096 && raw.every(n => n === 10 || (n >= 32 && n <= 126)));
assert.equal(raw.at(-1), 10);
const rows = raw.toString('ascii').trimEnd().split('\n').map(line => {
  const cells = line.split(' ');
  assert.equal(cells.shift(), 'R2'); const label = cells.shift();
  assert.ok(manifest.markerFormat.labels.includes(label));
  assert.ok(cells.every(c => /^[0-9]+$/.test(c)));
  assert.equal(cells.length, label === 'ENTRY' ? 3 : label === 'FILE' ? 9 : 1);
  return { label, tick: cells[0], values: cells.slice(1) };
});
assert.ok(rows.length <= 50); assert.equal(rows[0].label, 'ENTRY');
for (let i = 1; i < rows.length; i++) assert.ok(BigInt(rows[i].tick) >= BigInt(rows[i - 1].tick));
const ordinary = rows.filter(r => r.label !== 'FILE');
assert.equal(new Set(ordinary.map(r => r.label)).size, ordinary.length);
const lookup = Object.fromEntries(ordinary.map(r => [r.label, r]));
const zero = BigInt(lookup.ENTRY.values[0]), frequency = BigInt(lookup.ENTRY.values[1]);
assert.ok(frequency > 0n && BigInt(lookup.ENTRY.tick) >= zero);
const ms = (a, b) => Number(((BigInt(b) - BigInt(a)) * 10000000n) / frequency) / 10000;
const interval = (from, to) => lookup[from] && lookup[to] ? ms(lookup[from].tick, lookup[to].tick) : null;
const files = rows.filter(r => r.label === 'FILE');
const missing = manifest.markerFormat.labels.filter(label => !rows.some(r => r.label === label));
const phases = [
  { id: 'observer_entry_setup', ms: ms(zero, lookup.ENTRY.tick), status: 'OBSERVED', meaning: 'First script timestamp to ENTRY timestamp; added observation setup, not production startup.' },
  { id: 'entry_to_definitions', ms: interval('ENTRY', 'DEFINITIONS'), status: 'OBSERVED', meaning: 'Includes ENTRY marker overhead and original initial statements/function definitions.' },
  { id: 'native_initialization_inclusive', ms: interval('NATIVE_BEGIN', 'NATIVE_END'), status: 'OBSERVED', meaning: 'Includes fixed signature construction and console proof; observer overhead is included.' },
  { id: 'console_proof_nested', ms: interval('CONSOLE_BEGIN', 'CONSOLE_END'), status: 'OBSERVED_NESTED', meaning: 'Nested within native initialization; must not be added again.' },
  { id: 'request_frame_and_eof', ms: interval('REQUEST_BEGIN', 'REQUEST_READ'), status: 'OBSERVED', meaning: 'Original frame acquisition and EOF; includes marker overhead and possible waiting.' },
  { id: 'request_parsing_and_validation', ms: interval('REQUEST_READ', 'REQUEST_VALID'), status: 'OBSERVED', meaning: 'UTF-8/depth/canonical JSON/schema/path/cap checks together; no subphase attribution.' },
  { id: 'initial_root_acquisition', ms: interval('ROOT_BEGIN', 'ROOT_END'), status: lookup.ROOT_END ? 'OBSERVED' : 'INCOMPLETE', meaning: 'ROOT_END absent. No completed root-acquisition timing is available.' },
  { id: 'root_start_to_error_serialization', ms: interval('ROOT_BEGIN', 'ENCODE_BEGIN'), status: 'OBSERVED_FAILURE_BRACKET', meaning: 'Failed initial root work plus unwinding, error handling and response construction; not pure native cost.' },
  { id: 'response_serialization_and_utf8', ms: interval('ENCODE_BEGIN', 'ENCODE_END'), status: 'OBSERVED_ERROR_RESPONSE_ONLY', meaning: 'Canonical serialization and UTF-8 encoding of the 253-byte framed empty ERROR response, not the successful READ_SET payload.' },
  { id: 'prewrite_to_flushed', ms: interval('PREWRITE', 'FLUSHED'), status: 'OBSERVED', meaning: 'Includes PREWRITE marker overhead and original response writes/flush.' },
];
const conclusion = 'D_NO_DEFENSIBLE_PRODUCTION_CORRECTION_SELECTED_FROM_THIS_OBSERVATION';
assert.equal(receipt.responseObservation.status, 'ERROR');
assert.equal(receipt.responseObservation.code, 'MO1307_FILESYSTEM_BOUNDARY');
assert.equal(files.length, 0); assert.ok(lookup.ROOT_BEGIN && !lookup.ROOT_END && lookup.ENCODE_BEGIN && lookup.FLUSHED);
const result = { kind: 'MO1307Phase3AR2DiagnosticAnalysis', version: '1.0.0', createdAtUtc: new Date().toISOString(),
  evidenceClass: 'R2_DIAGNOSTIC_EVIDENCE_ONLY', receipt: record(E + '/receipt.json'), markers: receipt.markers,
  productionAuthority: plan.productionAuthority, helperExecutions: 1, expectedSuccessfulDMarkers: 37,
  actualMarkers: rows.length, observedMarkers: rows.map(r => ({ ...r, millisecondsSinceFirstScriptTick: ms(zero, r.tick) })),
  missingMarkers: missing, fileProgressRows: files.length, completedFileCounters: files.length ? files.at(-1) : null,
  stopwatchFrequency: frequency.toString(), phases, parentLifecycle: receipt.durations,
  parentIntervals: { launchToFirstMarkerReceiptMs: receipt.times.firstMarkerReceipt - receipt.times.origin,
    spawnCallReturnMs: receipt.times.spawnReturned - receipt.times.spawnEntered,
    firstResponseByteToSettlementMs: receipt.times.transportSettled - receipt.times.firstResponseByte,
    firstToLastResponseByteMs: receipt.times.lastResponseByte - receipt.times.firstResponseByte },
  attribution: 'Initial root-chain acquisition refused before entering file processing. Exact component, native call and Win32 cause are not observed.',
  incompletePhases: ['completed root acquisition', 'per-file acquisition/read', 'post-read held/fresh validation',
    'base64 successful-file snapshot construction', 'final root revalidation', 'successful READ_SET response serialization'],
  instrumentationOverhead: 'UNMEASURED_NOT_SUBTRACTED', childParentClockMapping: 'NOT_ESTABLISHED; child intervals and parent event intervals are reported separately',
  cleanup: { supervisorConfirmed: receipt.cleanupConfirmed, allPipesClosed: Object.values(receipt.pipes).every(Boolean),
    childExit: receipt.events.find(e => e.event === 'exit'), validResponseNativeConsoleProof: true,
    independentExternalConsoleObservation: false, failureCleanupNeeded: false },
  candidateSelection: conclusion, recommendedProductionCorrection: null,
  interpretation: [
    'Neither bounded file-buffer reuse nor successful response serialization was exercised meaningfully; do not select either from this run.',
    'Request parsing/validation is a sizeable completed instrumented span, but no specific redundant implementation or production correction is established.',
    'The early filesystem refusal does not establish its cause or the historical Step G cause.',
    'Instrumented metadata/pipe work can perturb scheduling, allocation and parsing. All durations are observations only.',
    'This is not certification, a timing campaign, reliability evidence, production performance, or replacement-H evidence.'
  ],
  certification: false, phase3APassed: false, historicalStepGCauseEstablished: false, replacementH: 'NOT_ESTABLISHED',
  preservationVerified: receipt.productionAndBoundInputsUnchanged, furtherExecutions: 0 };
write(E + '/analysis.json', result);
write(E + '/offline-validation.json', { kind: 'MO1307Phase3AR2OfflineClosureChecks', createdAtUtc: new Date().toISOString(),
  result: 'PASS', checks: { oneShotClaimAndReceiptBound: true, exactProductionRestoration: true,
    productionAndInputDigestsStillMatch: true, limitsUnchanged: true, rawMarkerFormatAndMonotonicity: true,
    observedAndMissingMarkersAccounted: true, noCurrentFileCountersInvented: true, resultIsDiagnosticOnly: true },
  bindings: [record(E + '/analysis.json'), record(E + '/receipt.json'), record(E + '/plan.json'),
    record(E + '/preexecution-review.json'), record('repositories/cca-conformance/tools/mo1307-phase3a-r2/summarize.mjs')],
  main: str('rev-parse', 'HEAD'), trackedDiff: str('diff', '--name-only'), stagedDiff: str('diff', '--cached', '--name-only'),
  additionalNativeExecutions: 0 });
console.log(JSON.stringify({ candidateSelection: conclusion, actualMarkers: rows.length, missingMarkers: missing,
  phases: phases.map(p => ({ id: p.id, ms: p.ms, status: p.status })), parentIntervals: result.parentIntervals }));
