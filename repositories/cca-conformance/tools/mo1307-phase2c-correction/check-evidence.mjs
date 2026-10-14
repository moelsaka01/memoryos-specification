// Closed selection of final correction receipts; earlier attempts stay historical.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { packageFiles } from '../mo1307-phase1/package.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const prefix = 'repositories/cca-conformance/evidence/mo1307/phase2c-correction/';
const hash = b => 'sha256:' + createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(path.join(root, p));
const json = p => JSON.parse(read(prefix + p));
const record = p => { const b = read(p); return { path: p, byteLength: b.length, sha256: hash(b) }; };
const check = m => assert.deepEqual(record(m.path), { path: m.path, byteLength: m.byteLength, sha256: m.sha256 });
export const finalPaths = Object.freeze({ focused: 'new-protocol/attempt-4/receipt.json',
  phase1: 'phase1-regression/attempt1/receipt.json', compatibility: 'compatibility/attempt2/matrix.json',
  guard: 'guard-characterization/attempt2/receipt.json', security: 'security-review.json',
  guardDisposition: 'guard-characterization/attempt2/current-source-disposition.json' });
export function checkFinalEvidence() {
  const focused = json(finalPaths.focused);
  assert.equal(focused.result, 'PASS'); assert.equal(focused.tests, 24); assert.equal(focused.pass, 24); assert.equal(focused.fail, 0);
  const campaign = json('new-protocol/attempt-4/campaign.json');
  for (const input of campaign.inputs) check(input);
  const regression = json(finalPaths.phase1);
  assert.equal(regression.result, 'PASS');
  assert.ok(regression.commands.every(c => c.result === 'PASS'));
  const tests = regression.commands.find(c => c.id === 'phase1-tests').tests;
  assert.deepEqual(tests, { count: 105, pass: 105, fail: 0, cancelled: 0, skipped: 0, todo: 0 });
  for (const required of ['schemas', 'fixtures', 'package', 'workspace', 'diff-check']) assert.ok(regression.commands.some(c => c.id === required && c.result === 'PASS'));
  const compatibility = json(finalPaths.compatibility);
  assert.equal(compatibility.result, 'PASS');
  for (const m of compatibility.correctedSourceBindings) check(m);
  assert.deepEqual(compatibility.streams.map(s => [s.stream, s.classification, s.tests.pass, s.exactAcceptedVectors]),
    [['2a', 'UNCHANGED_REUSABLE', 84, 16], ['2b', 'UNCHANGED_REUSABLE', 172, 16]]);
  const guard = json(finalPaths.guard);
  assert.equal(guard.result, 'PASS'); assert.ok(guard.aggregateHelperActiveMs < 20000); assert.ok(guard.seriesWallMs < 30000);
  assert.equal(guard.invocations.length, 9);
  for (const invocation of guard.invocations) {
    assert.equal(invocation.result, 'PASS'); assert.ok(invocation.elapsedMs < 5000);
    assert.equal(invocation.exit, 0); assert.equal(invocation.helperExitedBeforeNextLaunch, true);
    assert.equal(invocation.protocol.code, 'MO1307_INTERNAL'); assert.equal(invocation.protocol.status, 'ERROR');
  }
  const disposition = json(finalPaths.guardDisposition);
  assert.equal(disposition.result, 'PASS'); check(disposition.currentSourceBinding);
  check(disposition.measuredSourceBinding); check(disposition.measurementReceipt);
  const measured = read(disposition.measuredSourceBinding.path).toString('utf8');
  const current = read(disposition.currentSourceBinding.path).toString('utf8');
  for (const segment of disposition.unchangedExercisedSegments) {
    const extract = source => {
      const start = source.indexOf(segment.startMarker), end = source.indexOf(segment.endMarkerExclusive, start);
      assert.ok(start >= 0 && end > start); return Buffer.from(source.slice(start, end));
    };
    const before = extract(measured), after = extract(current);
    assert.ok(before.equals(after)); assert.equal(after.length, segment.byteLength);
    assert.equal(hash(before), segment.measuredSha256); assert.equal(hash(after), segment.currentSha256);
  }
  for (const m of guard.sourceBindings) if (m.path !== 'repositories/memoryos-readiness/src/helper-protocol.mjs') check(m);
  const security = json(finalPaths.security);
  assert.equal(security.reviewResult, 'FOUNDATION_REVIEW_COMPLETE');
  assert.equal(security.threats.length, 14);
  assert.ok(security.threats.every(t => t.foundationReview === 'CONTROL_AND_NEGATIVE_COVERAGE_REVIEWED' && t.testGroups.length > 0));
  for (const m of [...security.reviewedProduction, ...security.reviewedContractAndTests]) check(m);
  return { focusedGroups: 24, phase1Tests: 105, compatibilityTests: 256, exactCompatibilityVectors: 32,
    guardActiveMs: guard.aggregateHelperActiveMs, nativeAcquisitionCertification: false,
    receipts: Object.fromEntries(Object.entries(finalPaths).map(([name, relative]) => [name, record(prefix + relative)])) };
}
if (process.argv[2] === '--seal') {
  const results = checkFinalEvidence();
  const inputs = [...packageFiles.map(p => 'repositories/memoryos-readiness/' + p),
    ...['core', 'fixtures', 'native', 'package'].map(n => 'repositories/cca-conformance/tests/mo1307_phase1_' + n + '_test.mjs'),
    'repositories/cca-conformance/tests/mo1307_phase2c_correction_test.mjs',
    'repositories/cca-conformance/tools/mo1307-phase2c-correction/publication-fixture.mjs'].sort().map(record);
  fs.writeFileSync(path.join(root, prefix, 'final-validation.json'), JSON.stringify({ kind: 'MemoryOSReadinessPublicationCorrectionFinalValidation',
    version: '1.0.0', result: 'PASS', ...results, validatedInputs: inputs,
    sourceStability: 'All production/test files were final before complete Phase1 regression; focused and compatibility campaigns bind exact inputs. No production edits followed their final PASS.',
    phase2CComplete: false, scope: 'CORRECTED_FOUNDATION_ONLY' }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ result: 'PASS', ...results }));
}
export function checkSealedEvidence() {
  const record = json('final-validation.json');
  assert.equal(record.result, 'PASS');
  const current = checkFinalEvidence();
  assert.deepEqual(record.receipts, current.receipts);
  for (const input of record.validatedInputs) check(input);
}
