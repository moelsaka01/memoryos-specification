import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { admitHistoryRecord } from '../../cca-studio/web/js/memoryos-history-admission.js';
import { legacyAdmitCheckpoint } from './support/mo1308-legacy-checkpoint-oracle.mjs';
import { MemoryOSHistoryError, validateEntry } from '../../cca-studio/web/js/memoryos-history-contract.js';
import { canonicalize, mipDigest } from '../../cca-studio/web/js/mip-canonical.js';
import { MemoryOS } from '../../cca-studio/web/js/memoryos-sdk.js';
import { InvestigationCore } from '../../cca-studio/web/js/investigation-core.js';
import { referenceSnapshot } from '../../cca-studio/web/data/studio-snapshot.js';
import { cloneDetached } from '../../cca-studio/web/js/studio-model.js';
import { verifyMemoryInvestigationPackage } from '../../cca-studio/web/js/memory-investigation-package.js';
import { J as j1306 } from '../../memoryos-ci/src/serialization.mjs';
import { parseJSON as parseJSON1306 } from '../../memoryos-ci/src/json.mjs';
import { checkResult as checkResult1306 } from '../../memoryos-ci/src/contracts.mjs';
import { catalog as catalog1306, projections as projections1306 } from '../../memoryos-ci/src/errors.mjs';
import { canonicalBytes as j1307, parseCanonical as parseCanonical1307 } from '../../memoryos-readiness/src/canonical.mjs';

// MO-1308 Contract Freeze 1, Stream 2B: the seven admission methods (section 7.3). Real artifacts from the
// predecessor releases and the repository evidence are the positive corpus; every forged or defective
// variant is built here, with chains and digests recomputed where a forgery must be self-consistent.
const workspace = fileURLToPath(new URL('../../../', import.meta.url));
const conformance = fileURLToPath(new URL('../', import.meta.url));
const enc = new TextEncoder();
const dec = new TextDecoder();
const WS = 'workspace-investigation';
const sha = bytes => 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
const jcs = value => canonicalize(value);
const D = (domain, ...parts) => mipDigest(domain, ...parts);
const code = (expected, stage) => error => error instanceof MemoryOSHistoryError && error.code === `MO1308_${expected}`
  && (stage === undefined || error.stage === stage);
const bytesOf = value => (typeof value === 'string' ? new Uint8Array(enc.encode(value)) : new Uint8Array(value));
const read = (...segments) => new Uint8Array(fs.readFileSync(path.join(conformance, ...segments)));
const members = object => Object.entries(object).map(([name, bytes]) => ({ name, bytes }));

// ---- Ledger views built from synthetic, shape-valid entries (admission never verifies the chain). ----
const d = n => 'sha256:' + n.toString(16).padStart(64, '0');
let counter = 1000;
function recordEntry(index, recordKind, recordDigest, subjects, extra = {}) {
  return { kind: 'MemoryOSHistoryEntry', version: '1.0.0', ledgerIdentifier: d(1), index, previousEntryDigest: d(2), entryType: 'RECORD',
    record: { recordKind, recordDigest, admission: {
      MIP_PACKAGE: 'MIP_001_VERIFIED', INVESTIGATION_CHECKPOINT: 'CORE_LOG_VERIFIED_STATE_ISSUED', POLICY_EVALUATION: 'SDK_POLICY_ARTIFACTS_VERIFIED',
      REGRESSION_REPORT: 'SDK_REGRESSION_REPORT_INSPECTED', CICD_RUN: 'MO1306_BUNDLE_INTEGRITY_VERIFIED', READINESS_RESULT: 'MO1307_SELF_DIGESTS_RECOMPUTED',
      HUMAN_DECISION_CLAIM: 'MO1307_DECISION_CLAIM_BOUND' }[recordKind],
    members: [{ name: { MIP_PACKAGE: 'package.mip', READINESS_RESULT: 'memoryos-readiness-result.json' }[recordKind] ?? 'package.mip', byteLength: 1, sha256: d(counter++) }],
    workspaceAssociation: ['READINESS_RESULT', 'HUMAN_DECISION_CLAIM', 'POLICY_EVALUATION', 'CICD_RUN'].includes(recordKind) ? 'DECLARED' : 'INTRINSIC',
    subjects, decisionConsistency: recordKind === 'HUMAN_DECISION_CLAIM' ? 'CONSISTENT' : null }, tombstone: null, entryDigest: d(counter++), ...extra };
}
const tombstoneEntry = (index, targetIndex) => ({ kind: 'MemoryOSHistoryEntry', version: '1.0.0', ledgerIdentifier: d(1), index, previousEntryDigest: d(2),
  entryType: 'TOMBSTONE', record: null, tombstone: { targetIndex, targetEntryDigest: d(3), targetRecordDigest: d(4), reason: 'PRIVACY_REQUEST',
    authorityReference: 'P-1', authenticity: 'NOT_VERIFIED_BY_MEMORYOS' }, entryDigest: d(counter++) });
const view = (entries = [], workspaceIdentifier = WS, retained = null) => ({ workspaceIdentifier, entries, ...(retained === null ? {} : { members: retained }) });
const subjectsOf = readinessLike => [
  { type: 'PROOF_BINDING_DIGEST', value: readinessLike.proofBindingDigest },
  { type: 'READINESS_CANDIDATE_DIGEST', value: readinessLike.candidateDigest },
  { type: 'READINESS_DIGEST', value: readinessLike.readinessDigest }];
const admit = (recordKind, memberObject, ledger = view()) => admitHistoryRecord({ recordKind, members: members(memberObject), ledger });

// ---- Independent oracle for the record ----
function expectedRecord(recordKind, memberObject, admission, association, subjects, decisionConsistency = null) {
  const list = Object.keys(memberObject).sort().map(name => ({ name, byteLength: memberObject[name].length, sha256: sha(memberObject[name]) }));
  return { recordKind, recordDigest: D('MEMORYOS-HISTORY-RECORD-1.0', recordKind, jcs(list)), admission, members: list, workspaceAssociation: association, decisionConsistency,
    subjects: [...subjects].sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : a.value < b.value ? -1 : a.value > b.value ? 1 : 0)) };
}

// ---- Corpora ----
const mipBytes = new Uint8Array(Buffer.from(fs.readFileSync(path.join(workspace, 'repositories/cca-studio/tests/fixtures/mip/complete-investigation.mip.b64'), 'ascii').trim(), 'base64'));
const mipPackage = verifyMemoryInvestigationPackage(mipBytes).package;
function checkpointValue(identifier = 'mo1308-2b-checkpoint') {
  const core = new InvestigationCore();
  core.import(mipBytes, { identifier });
  return JSON.parse(JSON.stringify(core.checkpoint(identifier)));
}
const checkpointBytes = value => new Uint8Array(enc.encode(jcs(value)));
// Recompute every transition identity, the prefix-digest chain, the log digest and the checkpoint identifier.
function reseal(checkpoint) {
  const value = structuredClone(checkpoint);
  const id = value.investigationIdentifier;
  let prior = D('INVESTIGATION-CORE-LOG-1.0', id, '[]');
  const materials = [];
  value.transitionLog.transitions.forEach((transition, index) => {
    transition.index = index;
    transition.previousLogDigest = prior;
    transition.identifier = D('INVESTIGATION-CORE-TRANSITION-1.0', jcs({ investigationIdentifier: id, index, kind: transition.kind, payload: transition.payload, previousLogDigest: prior }));
    materials.push(jcs({ identifier: transition.identifier, index, investigationIdentifier: id, kind: transition.kind, payload: transition.payload, previousLogDigest: prior }));
    prior = D('INVESTIGATION-CORE-LOG-1.0', id, `[${materials.join(',')}]`);
  });
  value.transitionLog.digest = prior;
  value.transitionLogDigest = prior;
  value.transitionCount = value.transitionLog.transitions.length;
  value.identifier = D('INVESTIGATION-CORE-CHECKPOINT-1.0', id, prior, value.stateDigest);
  return value;
}

const policyDirectory = name => ({ identity: read('fixtures/mo1306', name, 'evaluation-identity.json'), outcome: read('fixtures/mo1306', name, 'policy-outcome.json') });
const policyNames = ['evaluate-policy-pass', 'evaluate-policy-fail', 'evaluate-policy-cne', 'evaluate-policySet-pass', 'evaluate-policySet-fail', 'evaluate-policySet-cne'];

function bundleDirectories() {
  const found = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full); else if (entry.name === 'memoryos-ci-complete.json') found.push(directory);
    }
  };
  walk(path.join(conformance, 'evidence/mo1306'));
  return found.sort();
}
const bundleMembers = directory => Object.fromEntries(fs.readdirSync(directory).sort().map(name => [name, new Uint8Array(fs.readFileSync(path.join(directory, name)))]));
const realBundles = bundleDirectories();
const readinessDirectories = fs.readdirSync(path.join(conformance, 'fixtures/mo1307/bundles')).sort()
  .filter(name => fs.existsSync(path.join(conformance, 'fixtures/mo1307/bundles', name, 'expected-result.json')));
const readinessBytes = name => read('fixtures/mo1307/bundles', name, 'expected-result.json');

function changedReport() {
  const core = new InvestigationCore();
  const changed = cloneDetached(referenceSnapshot);
  changed.longTermMemory.entries[0].value = 'MO-1308 2B admission Regression change.';
  core.create({ identifier: 'mo1308-2b-baseline', snapshot: referenceSnapshot });
  core.create({ identifier: 'mo1308-2b-candidate', snapshot: changed });
  return JSON.parse(JSON.stringify(core.regression('mo1308-2b-baseline', 'mo1308-2b-candidate')));
}
const reportBytes = report => new Uint8Array(enc.encode(jcs(report)));

// ---- Acceptance matrix ----

test('B01 MIP_PACKAGE: MIP-001 verified; subjects copy the package values; recordDigest equals the oracle (R07)', () => {
  const record = admit('MIP_PACKAGE', { 'package.mip': mipBytes });
  assert.deepEqual({ ...record, members: [...record.members], subjects: [...record.subjects] }, expectedRecord('MIP_PACKAGE', { 'package.mip': mipBytes },
    'MIP_001_VERIFIED', 'INTRINSIC', [
      { type: 'MIP_PACKAGE_DIGEST', value: mipPackage.integrity.packageDigest },
      { type: 'MIP_PACKAGE_IDENTIFIER', value: mipPackage.manifest.packageIdentifier },
      { type: 'WORKSPACE', value: mipPackage.manifest.workspaceIdentifier }]));
  assert.ok(Object.isFrozen(record) && Object.isFrozen(record.members) && Object.isFrozen(record.subjects));
  assert.equal(validateEntry(JSON.parse(jcs({ kind: 'MemoryOSHistoryEntry', version: '1.0.0', ledgerIdentifier: d(1), index: 0, previousEntryDigest: d(2),
    entryType: 'RECORD', record, tombstone: null, entryDigest: d(3) }))).entryType, 'RECORD');
});

test('B02 MIP_PACKAGE rejections: tampered, non-canonical, truncated, wrong Workspace (R11)', () => {
  const flipped = new Uint8Array(mipBytes); flipped[Math.floor(flipped.length / 2)] ^= 1;
  assert.throws(() => admit('MIP_PACKAGE', { 'package.mip': flipped }), code('RECORD_INVALID', 'ADMISSION'));
  assert.throws(() => admit('MIP_PACKAGE', { 'package.mip': new Uint8Array([...mipBytes, 10]) }), code('RECORD_INVALID'));
  assert.throws(() => admit('MIP_PACKAGE', { 'package.mip': mipBytes.slice(0, 100) }), code('RECORD_INVALID'));
  assert.throws(() => admit('MIP_PACKAGE', { 'package.mip': new Uint8Array(0) }), code('RECORD_INVALID'));
  assert.throws(() => admit('MIP_PACKAGE', { 'package.mip': mipBytes }, view([], 'another-workspace')), code('WORKSPACE_MISMATCH', 'ADMISSION'));
});

test('B03 INVESTIGATION_CHECKPOINT: accepts a Core checkpoint of a MIP-backed investigation (H13 option A)', () => {
  const value = checkpointValue();
  assert.equal(Object.keys(value).length, 9);
  const bytes = checkpointBytes(value);
  const record = admit('INVESTIGATION_CHECKPOINT', { 'checkpoint.json': bytes });
  assert.deepEqual({ ...record, members: [...record.members], subjects: [...record.subjects] }, expectedRecord('INVESTIGATION_CHECKPOINT',
    { 'checkpoint.json': bytes }, 'CORE_LOG_VERIFIED_STATE_ISSUED', 'INTRINSIC', [
      { type: 'CHECKPOINT', value: value.identifier }, { type: 'INVESTIGATION', value: value.investigationIdentifier },
      { type: 'TRANSITION_LOG_DIGEST', value: value.transitionLogDigest }, { type: 'WORKSPACE', value: value.workspaceIdentifier }]));
  assert.equal(value.transitionLog.transitions[0].kind, 'CREATED');
  assert.equal(value.transitionLog.transitions[1].kind, 'PACKAGE_IMPORTED');
  // A checkpoint with navigation transitions verifies too.
  const core = new InvestigationCore();
  core.import(mipBytes, { identifier: 'nav' });
  core.returnToWorld('nav');
  const navigated = JSON.parse(JSON.stringify(core.checkpoint('nav')));
  assert.ok(navigated.transitionCount >= 2);
  admit('INVESTIGATION_CHECKPOINT', { 'checkpoint.json': checkpointBytes(navigated) });
});

test('B04 INVESTIGATION_CHECKPOINT rejections: every tampered field, native, wrong Workspace, forged package (R12)', () => {
  const value = checkpointValue();
  const reject = (mutated, expected = 'RECORD_INVALID') => assert.throws(() => admit('INVESTIGATION_CHECKPOINT', { 'checkpoint.json': checkpointBytes(mutated) }), code(expected));
  const tweak = mutate => { const copy = structuredClone(value); mutate(copy); return copy; };
  // Plain tampering (digests left stale).
  reject(tweak(v => { v.identifier = D('x'); }));
  reject(tweak(v => { v.stateDigest = D('y'); }));
  reject(tweak(v => { v.transitionCount += 1; }));
  reject(tweak(v => { v.transitionLogDigest = D('z'); }));
  reject(tweak(v => { v.transitionLog.digest = D('z'); }));
  reject(tweak(v => { v.transitionLog.transitions[0].identifier = D('i'); }));
  reject(tweak(v => { v.transitionLog.transitions[1].previousLogDigest = D('p'); }));
  reject(tweak(v => { v.transitionLog.transitions[1].index = 2; }));
  reject(tweak(v => { v.transitionLog.transitions[0].payload.workspaceIdentifier = 'x'; }));
  reject(tweak(v => { v.extra = 1; }));
  reject(tweak(v => { v.transitionLog.extra = 1; }));
  reject(tweak(v => { v.transitionLog.transitions[0].extra = 1; }));
  reject(tweak(v => { v.kind = 'MemoryOSInvestigationCheckpoint2'; }));
  reject(tweak(v => { v.version = '2.0.0'; }));
  reject(tweak(v => { v.transitionLog.transitions[0].kind = 'NOT_A_KIND'; }));
  reject(tweak(v => { v.transitionLog.transitions.pop(); v.transitionCount = 1; }));
  reject(tweak(v => { v.transitionLog.transitions = []; v.transitionCount = 0; }));
  reject(tweak(v => { v.transitionLog.investigationIdentifier = 'other'; }));
  // Self-consistent forgeries (digests recomputed) are caught by the rules that remain.
  reject(reseal(tweak(v => { v.transitionLog.transitions[0].payload.sourceKind = 'native'; })));
  reject(reseal(tweak(v => { v.transitionLog.transitions[1].kind = 'OBSERVED'; })));
  reject(reseal(tweak(v => { v.transitionLog.transitions[1].payload.package.manifest.packageIdentifier += '-forged'; })));
  // supportedExtensions only widens what the MIP verifier may accept; a package without extensions still verifies.
  admit('INVESTIGATION_CHECKPOINT', { 'checkpoint.json': checkpointBytes(reseal(tweak(v => { v.transitionLog.transitions[1].payload.supportedExtensions = ['urn:supported:extension']; }))) });
  reject(reseal(tweak(v => { v.transitionLog.transitions[1].payload.supportedExtensions = 'x'; })));
  reject(reseal(tweak(v => { delete v.transitionLog.transitions[1].payload.package; })));
  reject(reseal(tweak(v => { v.transitionLog.transitions.splice(1, 1); })));
  reject(reseal(tweak(v => { v.transitionLog.transitions[0].payload.workspaceIdentifier = 'other-workspace'; v.workspaceIdentifier = 'other-workspace'; })), 'WORKSPACE_MISMATCH');
  // The resealed unmodified checkpoint is accepted: the helper itself is faithful.
  admit('INVESTIGATION_CHECKPOINT', { 'checkpoint.json': checkpointBytes(reseal(value)) });
  assert.throws(() => admit('INVESTIGATION_CHECKPOINT', { 'checkpoint.json': checkpointBytes(value) }, view([], 'elsewhere')), code('WORKSPACE_MISMATCH'));
  // Non-canonical bytes and trailing LF are refused (exactly JCS(x)).
  assert.throws(() => admit('INVESTIGATION_CHECKPOINT', { 'checkpoint.json': new Uint8Array([...checkpointBytes(value), 10]) }), code('RECORD_INVALID'));
  assert.throws(() => admit('INVESTIGATION_CHECKPOINT', { 'checkpoint.json': new Uint8Array(enc.encode(JSON.stringify(value, null, 1))) }), code('RECORD_INVALID'));
});

test('B05 a native investigation checkpoint is rejected (R12)', () => {
  const core = new InvestigationCore();
  core.create({ identifier: 'native', snapshot: referenceSnapshot });
  const native = JSON.parse(JSON.stringify(core.checkpoint('native')));
  assert.equal(native.transitionLog.transitions[0].payload.sourceKind, 'native');
  assert.throws(() => admit('INVESTIGATION_CHECKPOINT', { 'checkpoint.json': checkpointBytes(native) }), code('RECORD_INVALID', 'ADMISSION'));
});

test('B06 POLICY_EVALUATION: accepts every released Policy and Policy Set artifact pair', () => {
  for (const name of policyNames) {
    const { identity, outcome } = policyDirectory(name);
    const record = admit('POLICY_EVALUATION', { 'evaluation-identity.json': identity, 'policy-outcome.json': outcome });
    const parsedOutcome = JSON.parse(dec.decode(outcome));
    assert.deepEqual(record.subjects.map(s => s.type), ['EVALUATION_IDENTITY_DIGEST', 'OUTCOME_DIGEST']);
    assert.equal(record.subjects[0].value, parsedOutcome.evaluationIdentityDigest, name);
    assert.equal(record.subjects[1].value, new MemoryOS().verifyPolicyEvaluationOutcomeArtifact(outcome).outcomeDigest, name);
    assert.equal(record.subjects[0].value, new MemoryOS().verifyEvaluationIdentityArtifact(identity).evaluationIdentityDigest, name);
    assert.equal(record.admission, 'SDK_POLICY_ARTIFACTS_VERIFIED');
    assert.equal(record.workspaceAssociation, 'DECLARED');
  }
});

test('B07 POLICY_EVALUATION rejections: swapped, cross-bound to another identity, tampered, non-canonical; agrees with the SDK verifiers', () => {
  const sdk = new MemoryOS();
  const pass = policyDirectory('evaluate-policy-pass'), fail = policyDirectory('evaluate-policy-fail');
  const sdkAccepts = (identity, outcome) => {
    try {
      const a = sdk.verifyEvaluationIdentityArtifact(identity);
      sdk.verifyPolicyEvaluationOutcomeArtifact(outcome, { expectedEvaluationIdentityDigest: a.evaluationIdentityDigest, expectedIdentity: undefined });
      sdk.verifyPolicyEvaluationOutcomeArtifact(outcome, { expectedIdentity: identity });
      return true;
    } catch { return false; }
  };
  const admits = (identity, outcome) => {
    try { admit('POLICY_EVALUATION', { 'evaluation-identity.json': identity, 'policy-outcome.json': outcome }); return true; } catch (error) {
      assert.ok(code('RECORD_INVALID', 'ADMISSION')(error)); return false;
    }
  };
  const cases = [
    ['genuine pass', pass.identity, pass.outcome, true],
    ['genuine fail', fail.identity, fail.outcome, true],
    ['identity of another evaluation', fail.identity, pass.outcome, false],
    ['members swapped', pass.outcome, pass.identity, false],
    ['empty identity', new Uint8Array(0), pass.outcome, false],
    ['trailing newline', new Uint8Array([...pass.identity, 10]), pass.outcome, false],
    ['pretty printed', bytesOf(JSON.stringify(JSON.parse(dec.decode(pass.identity)), null, 2)), pass.outcome, false],
  ];
  for (const [label, identity, outcome, expected] of cases) {
    assert.equal(admits(identity, outcome), expected, `${label}: admission`);
    assert.equal(sdkAccepts(identity, outcome), expected, `${label}: SDK agreement`);
  }
  // Byte flips across both members: admission and the SDK verifiers always agree. Every flip of the identity and
  // every structural flip is rejected. A flip inside a digest-valued data field of the outcome result is still a
  // well-formed outcome, so the SDK's detached inspection (authority "inspectionOnly") accepts it and so does
  // admission: the standalone POLICY_EVALUATION method proves consistency and identity binding, not origin or a
  // recomputed evaluation. That limit is recorded in the Phase 2B record, not hidden.
  let flips = 0, acceptedByBoth = 0;
  for (const [which, original] of [['identity', pass.identity], ['outcome', pass.outcome]]) {
    for (let position = 0; position < original.length; position += 7) {
      const mutated = new Uint8Array(original); mutated[position] ^= 1;
      const identity = which === 'identity' ? mutated : pass.identity, outcome = which === 'outcome' ? mutated : pass.outcome;
      const ours = admits(identity, outcome), theirs = sdkAccepts(identity, outcome);
      assert.equal(ours, theirs, `${which} byte ${position}: admission versus the SDK verifiers`);
      if (which === 'identity') assert.equal(ours, false, `identity byte ${position}`);
      if (ours) acceptedByBoth += 1;
      flips += 1;
    }
  }
  assert.ok(flips > 100);
  assert.ok(acceptedByBoth > 0 && acceptedByBoth < flips / 2, `inspection-only acceptances ${acceptedByBoth} of ${flips}`);
  // The outcome embeds its identity: an outcome re-sealed over a different identity but not matching the supplied one is rejected.
  assert.equal(admits(pass.identity, fail.outcome), false);
});

test('B08 REGRESSION_REPORT: SDK inspection accepted; both Workspaces must equal the ledger Workspace (R11)', () => {
  const report = changedReport();
  const bytes = reportBytes(report);
  const record = admit('REGRESSION_REPORT', { 'regression-report.json': bytes }, view([], report.baseline.workspaceIdentifier));
  assert.deepEqual(record.subjects.map(s => [s.type, s.value]), [['REGRESSION_REPORT', report.identifier], ['WORKSPACE', report.baseline.workspaceIdentifier]]);
  assert.equal(record.admission, 'SDK_REGRESSION_REPORT_INSPECTED');
  assert.equal(record.workspaceAssociation, 'INTRINSIC');
  assert.throws(() => admit('REGRESSION_REPORT', { 'regression-report.json': bytes }, view([], 'other')), code('WORKSPACE_MISMATCH', 'ADMISSION'));
  // Candidate and baseline in different Workspaces: the ledger can match only one, so both are required.
  const split = structuredClone(report); split.candidate.workspaceIdentifier = 'other';
  split.identifier = 'regression:' + D('INVESTIGATION-CORE-REGRESSION-1.0', jcs({ baseline: split.baseline, candidate: split.candidate,
    categories: split.categories, overall: split.overall, regressionDetected: split.regressionDetected })).slice(7);
  // The Regression owner itself rejects a report whose roles span Workspaces, before the ledger comparison.
  assert.throws(() => new MemoryOS().inspectRegressionReport(reportBytes(split)));
  assert.throws(() => admit('REGRESSION_REPORT', { 'regression-report.json': reportBytes(split) }, view([], report.baseline.workspaceIdentifier)), code('RECORD_INVALID', 'ADMISSION'));
  // Integrity rejections agree with the SDK inspection.
  const sdk = new MemoryOS();
  const tampers = [r => { r.identifier = 'regression:' + '0'.repeat(64); }, r => { r.baseline.sourceIdentifier += '-x'; },
    r => { r.categories[0].status = 'x'; }, r => { r.extra = 1; }, r => { delete r.overall; }];
  for (const tamper of tampers) {
    const forged = structuredClone(report); tamper(forged);
    assert.throws(() => sdk.inspectRegressionReport(reportBytes(forged)));
    assert.throws(() => admit('REGRESSION_REPORT', { 'regression-report.json': reportBytes(forged) }, view([], report.baseline.workspaceIdentifier)), code('RECORD_INVALID', 'ADMISSION'));
  }
  assert.throws(() => admit('REGRESSION_REPORT', { 'regression-report.json': new Uint8Array(0) }, view([], report.baseline.workspaceIdentifier)), code('RECORD_INVALID'));
});

test('B09 CICD_RUN: every real MO-1306 bundle in the repository evidence is admitted (completed and operational-failure)', () => {
  assert.ok(realBundles.length > 150, `bundles ${realBundles.length}`);
  let six = 0, four = 0;
  for (const directory of realBundles) {
    const files = bundleMembers(directory);
    const names = Object.keys(files);
    const record = admit('CICD_RUN', files);
    const result = JSON.parse(dec.decode(files['memoryos-ci-result.json']));
    assert.equal(record.members.length, names.length);
    assert.equal(record.recordDigest, expectedRecord('CICD_RUN', files, 'MO1306_BUNDLE_INTEGRITY_VERIFIED', 'DECLARED', []).recordDigest);
    const expectedSubjects = [{ type: 'CICD_RUN_ID', value: result.runId }];
    if (result.semantic) expectedSubjects.push({ type: 'EVALUATION_IDENTITY_DIGEST', value: result.semantic.evaluationIdentityDigest }, { type: 'OUTCOME_DIGEST', value: result.semantic.outcomeDigest });
    assert.deepEqual([...record.subjects].map(s => ({ ...s })), expectedSubjects.sort((a, b) => (a.type < b.type ? -1 : 1)), directory);
    if (names.length === 6) six += 1; else four += 1;
  }
  assert.ok(six >= 3 && four >= 20, `six ${six} four ${four}`);
});

// A self-consistent re-sealing helper for MO-1306 bundles (independent of the module under test).
function resealBundle(files, mutate) {
  const copy = Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, new Uint8Array(bytes)]));
  const parsed = name => JSON.parse(dec.decode(copy[name]));
  const put = (name, value) => { copy[name] = new Uint8Array(enc.encode(j1306(value))); };
  const state = { result: parsed('memoryos-ci-result.json'), evidence: parsed('memoryos-ci-evidence.json') };
  mutate(state, copy);
  put('memoryos-ci-result.json', state.result);
  state.evidence.resultSha256 = sha(copy['memoryos-ci-result.json']);
  state.evidence.projectionSha256 = sha(enc.encode(j1306(state.result.projection)));
  put('memoryos-ci-evidence.json', state.evidence);
  const manifest = parsed('memoryos-ci-artifacts.json');
  manifest.files = Object.keys(copy).filter(n => !['memoryos-ci-artifacts.json', 'memoryos-ci-complete.json'].includes(n)).sort()
    .map(n => ({ byteLength: copy[n].length, path: n, sha256: sha(copy[n]) }));
  put('memoryos-ci-artifacts.json', manifest);
  const marker = parsed('memoryos-ci-complete.json'); marker.manifestSha256 = sha(copy['memoryos-ci-artifacts.json']);
  put('memoryos-ci-complete.json', marker);
  return copy;
}

test('B10 CICD_RUN rejections: structure, integrity, cross-links, forged semantic block (self-consistent forgeries included)', () => {
  const sixDirectories = realBundles.filter(directory => fs.readdirSync(directory).length === 6);
  const classificationOf = directory => JSON.parse(dec.decode(read(path.relative(conformance, path.join(directory, 'memoryos-ci-result.json'))))).classification;
  const sixByClassification = new Map();
  for (const directory of sixDirectories) if (!sixByClassification.has(classificationOf(directory))) sixByClassification.set(classificationOf(directory), bundleMembers(directory));
  assert.deepEqual([...sixByClassification.keys()].sort(), ['COULD_NOT_EVALUATE', 'FAIL', 'PASS']);
  for (const [classification, six] of sixByClassification) forgeryBattery(six, classification, sixDirectories);
  forgeryBattery(null, 'OPERATIONAL', sixDirectories);
});

function forgeryBattery(sixInput, label, sixDirectories) {
  const six = sixInput ?? bundleMembers(sixDirectories[0]);
  const flip = (value, a, b) => (value === a ? b : a);
  const four = bundleMembers(realBundles.find(directory => fs.readdirSync(directory).length === 4));
  const rejects = (files, expected = 'RECORD_INVALID') => assert.throws(() => admit('CICD_RUN', files), code(expected));
  const without = (files, name) => Object.fromEntries(Object.entries(files).filter(([n]) => n !== name));
  admit('CICD_RUN', resealBundle(six, () => {})); // the helper is faithful
  admit('CICD_RUN', resealBundle(four, () => {}));
  // Cardinality and basenames.
  for (const name of Object.keys(six)) rejects(without(six, name));
  rejects({ ...six, 'extra.json': bytesOf('{}') }, 'RECORD_INVALID');
  rejects({ ...four, 'evaluation-identity.json': six['evaluation-identity.json'] });
  rejects({ ...four, 'policy-outcome.json': six['policy-outcome.json'], 'evaluation-identity.json': six['evaluation-identity.json'] });
  // Plain byte flips in each file (hashes now stale).
  for (const files of [six, four]) {
    for (const name of Object.keys(files)) {
      for (const position of [0, Math.floor(files[name].length / 2), files[name].length - 1]) {
        const mutated = { ...files, [name]: new Uint8Array(files[name]) }; mutated[name][position] ^= 1;
        rejects(mutated);
      }
    }
  }
  // Non-J bytes: pretty printed, no trailing LF, two trailing LFs, BOM, unsorted keys.
  const asText = name => dec.decode(six[name]);
  rejects({ ...six, 'memoryos-ci-result.json': bytesOf(JSON.stringify(JSON.parse(asText('memoryos-ci-result.json')), null, 1) + '\n') });
  rejects({ ...six, 'memoryos-ci-result.json': bytesOf(asText('memoryos-ci-result.json').trimEnd()) });
  rejects({ ...six, 'memoryos-ci-result.json': bytesOf(asText('memoryos-ci-result.json') + '\n') });
  rejects({ ...six, 'memoryos-ci-result.json': new Uint8Array([0xef, 0xbb, 0xbf, ...six['memoryos-ci-result.json']]) });
  // Re-sealed forgeries: the rules themselves must catch them.
  rejects(resealBundle(six, ({ result }) => { result.process.exitCode = flip(result.process.exitCode, 6, 7); }));
  rejects(resealBundle(six, ({ result }) => { result.projection.jobStatus = flip(result.projection.jobStatus, 'SUCCESS', 'FAILURE'); }));
  rejects(resealBundle(six, ({ result }) => { result.projection.class = flip(result.projection.class, 'SUCCESS', 'POLICY_FAIL'); }));
  rejects(resealBundle(six, ({ result }) => { result.classification = flip(result.classification, 'PASS', 'FAIL'); }));
  rejects(resealBundle(six, ({ result }) => { result.semantic.decision = flip(result.semantic.decision, 'PASS', 'FAIL'); }));
  rejects(resealBundle(six, ({ result }) => { result.semantic.outcomeDigest = D('forged'); }));
  rejects(resealBundle(six, ({ result }) => { result.semantic.evaluationIdentityDigest = D('forged'); }));
  rejects(resealBundle(six, ({ result }) => { result.semantic.semanticDigest = D('forged'); }));
  rejects(resealBundle(six, ({ result }) => { result.semantic.artifactKind = result.semantic.artifactKind === 'policy' ? 'policySet' : 'policy'; }));
  rejects(resealBundle(six, ({ result }) => { result.inputDigest = null; }));
  rejects(resealBundle(six, ({ result }) => { result.configurationDigest = null; }));
  rejects(resealBundle(six, ({ result }) => { result.inputDigest = D('forged'); }));
  rejects(resealBundle(six, ({ result }) => { result.extra = 1; }));
  rejects(resealBundle(six, ({ result }) => { result.runId = '00000000-0000-4000-8000-000000000000'; }));
  rejects(resealBundle(six, ({ result }) => { result.provider = 'nope'; }));
  rejects(resealBundle(six, ({ evidence }) => { evidence.runId = '00000000-0000-4000-8000-000000000000'; }));
  rejects(resealBundle(six, ({ evidence }) => { evidence.configurationSha256 = D('forged'); }));
  rejects(resealBundle(six, ({ evidence }) => { evidence.adapter.id = 'memoryos.cicd.adapter.other'; }));
  rejects(resealBundle(six, ({ evidence }) => { evidence.runtime.nodeVersion = '22.22.0'; }));
  rejects(resealBundle(six, ({ evidence }) => { evidence.inputs.reverse(); }));
  rejects(resealBundle(six, ({ evidence }) => { evidence.metadata.repository = 'not a token'; }));
  rejects(resealBundle(six, ({ evidence }) => { evidence.contract.sha256 = D('forged'); }));
  // Operational-failure records: the error catalog is a total function.
  rejects(resealBundle(four, ({ result }) => { result.error.stage = result.error.stage === 'ACQUISITION' ? 'CLEANUP' : 'ACQUISITION'; }));
  rejects(resealBundle(four, ({ result }) => { result.error = null; }));
  rejects(resealBundle(four, ({ result }) => { result.error.semanticCode = 'NOT_AN_ALLOWLISTED_SDK_CODE'; }));
  // semanticCode is allowed only with MO1306_SEMANTIC_VALIDATION; any other error code with a semanticCode is rejected.
  rejects(resealBundle(four, ({ result }) => { result.error.code = 'MO1306_INPUT_READ'; result.classification = 'INPUT_ERROR'; result.process.exitCode = 11; result.projection = { class: 'ADAPTER_ERROR', jobStatus: 'FAILURE' }; result.error.stage = 'ACQUISITION'; result.error.semanticCode = 'INVALID_INPUT'; }));
  rejects(resealBundle(four, ({ result }) => { result.process.termination = 'ABNORMAL'; }));
  rejects(resealBundle(four, ({ result }) => { result.semantic = { artifactKind: 'policy', decision: 'PASS', documentDigest: D('a'), evaluationIdentityDigest: D('b'), outcomeDigest: D('c'), semanticDigest: D('d') }; }));
  // Manifest and marker forgeries.
  const manifestOf = files => JSON.parse(dec.decode(files['memoryos-ci-artifacts.json']));
  const withManifest = (files, mutate) => {
    const manifest = manifestOf(files); mutate(manifest);
    const out = { ...files, 'memoryos-ci-artifacts.json': new Uint8Array(enc.encode(j1306(manifest))) };
    const marker = JSON.parse(dec.decode(out['memoryos-ci-complete.json'])); marker.manifestSha256 = sha(out['memoryos-ci-artifacts.json']);
    out['memoryos-ci-complete.json'] = new Uint8Array(enc.encode(j1306(marker)));
    return out;
  };
  rejects(withManifest(six, m => { m.files[0].byteLength += 1; }));
  rejects(withManifest(six, m => { m.files[0].sha256 = D('forged'); }));
  rejects(withManifest(six, m => { m.files.pop(); }));
  rejects(withManifest(six, m => { m.files.reverse(); }));
  rejects(withManifest(six, m => { m.runId = '00000000-0000-4000-8000-000000000000'; }));
  rejects({ ...six, 'memoryos-ci-complete.json': new Uint8Array(enc.encode(j1306({ ...JSON.parse(dec.decode(six['memoryos-ci-complete.json'])), manifestSha256: D('forged') }))) });
  // Cross-bundle splice: the normative artifacts of another run, hashes re-sealed.
  const other = sixDirectories.map(bundleMembers).find(files => sha(files['policy-outcome.json']) !== sha(six['policy-outcome.json']) && sha(files['evaluation-identity.json']) !== sha(six['evaluation-identity.json']));
  assert.ok(other, 'a second distinct completed bundle exists');
  rejects(resealBundle(six, (state, copy) => { copy['policy-outcome.json'] = new Uint8Array(other['policy-outcome.json']); }));
  rejects(resealBundle(six, (state, copy) => { copy['evaluation-identity.json'] = new Uint8Array(other['evaluation-identity.json']); }));
  // Oversized members and totals are RESOURCE_LIMIT, wrong names are RECORD_INVALID.
  assert.throws(() => admit('CICD_RUN', { ...six, 'memoryos-ci-evidence.json': new Uint8Array(49_153) }), code('RESOURCE_LIMIT'));
  assert.throws(() => admit('CICD_RUN', { ...six, 'memoryos-ci-evidence.json': new Uint8Array(16_385) }), code('RECORD_INVALID'));
  assert.ok(label);
}

test('B11 CICD_RUN J parsing agrees with the MO-1306 parser on structural limits (R03)', () => {
  const nest = depth => '['.repeat(depth) + ']'.repeat(depth);
  const owner = text => { try { parseJSON1306(enc.encode(text), 8192, 'BUNDLE_INTEGRITY'); return true; } catch { return false; } };
  const files = bundleMembers(realBundles.find(directory => fs.readdirSync(directory).length === 4));
  const ours = text => { try { admit('CICD_RUN', { ...files, 'memoryos-ci-complete.json': bytesOf(text) }); return true; } catch { return false; } };
  for (const text of [nest(8) + '\n', nest(9) + '\n']) {
    // Both refuse a non-conforming file (admission additionally requires the exact Complete shape); the parsers differ only at depth.
    assert.equal(owner(text), text === nest(8) + '\n');
    assert.equal(ours(text), false);
  }
  // Duplicate keys, __proto__, control characters and lone surrogates are refused by both.
  for (const text of ['{"a":1,"a":2}\n', '{"__proto__":1}\n', '{"a":"\\u0001"}\n', '{"a":"\\ud800"}\n', '{"a":-1}\n', '{"a":1.5}\n']) {
    assert.equal(owner(text), false, text);
    assert.equal(ours(text), false, text);
  }
});

test('B12 READINESS_RESULT: every released MO-1307 result is admitted with recomputed digests; forged variants are not (R08)', () => {
  assert.ok(readinessDirectories.length >= 14);
  for (const name of readinessDirectories) {
    const bytes = readinessBytes(name);
    const result = JSON.parse(dec.decode(bytes));
    const record = admit('READINESS_RESULT', { 'memoryos-readiness-result.json': bytes });
    assert.deepEqual([...record.subjects].map(s => ({ ...s })), [
      { type: 'PROOF_BINDING_DIGEST', value: result.proofBindingDigest },
      { type: 'READINESS_CANDIDATE_DIGEST', value: result.assessment.candidateDigest },
      { type: 'READINESS_DIGEST', value: result.readinessDigest }].sort((a, b) => (a.type < b.type ? -1 : 1)), name);
    assert.equal(record.admission, 'MO1307_SELF_DIGESTS_RECOMPUTED');
    assert.equal(record.workspaceAssociation, 'DECLARED');
    // The independent MO-1307 digest definitions agree with what was admitted.
    assert.equal(sha(j1307({ kind: 'MemoryOSReadinessIdentity', version: '1.0.0', assessment: result.assessment })), result.readinessDigest, name);
  }
});

test('B13 READINESS_RESULT rejections: stale digests, re-sealed forgeries, shape, non-J (R03)', () => {
  const bytes = readinessBytes('ready');
  const result = JSON.parse(dec.decode(bytes));
  const encode = value => new Uint8Array(j1307(value));
  const rejects = mutated => assert.throws(() => admit('READINESS_RESULT', { 'memoryos-readiness-result.json': mutated }), code('RECORD_INVALID', 'ADMISSION'));
  const tweak = mutate => { const copy = structuredClone(result); mutate(copy); return copy; };
  rejects(encode(tweak(r => { r.assessment.readiness = 'NOT_READY'; })));            // identity digest stale
  rejects(encode(tweak(r => { r.audit.manifestSha256 = D('forged'); })));            // proof binding stale
  rejects(encode(tweak(r => { r.readinessDigest = D('forged'); })));
  rejects(encode(tweak(r => { r.proofBindingDigest = D('forged'); })));
  rejects(encode(tweak(r => { r.kind = 'MemoryOSReadinessResult2'; })));
  rejects(encode(tweak(r => { r.version = '2.0.0'; })));
  rejects(encode(tweak(r => { r.extra = 1; })));
  rejects(encode(tweak(r => { delete r.audit; })));
  rejects(encode(tweak(r => { r.assessment.candidateDigest = 'sha256:XYZ'; })));
  // A re-sealed forgery (digests recomputed over a changed assessment) is integrity-consistent, so it is admitted:
  // MO-1308 admission is not a MO-1307 verification (Freeze row, section 7.3).
  const forged = tweak(r => { r.assessment.readiness = 'NOT_READY'; });
  forged.readinessDigest = sha(j1307({ kind: 'MemoryOSReadinessIdentity', version: '1.0.0', assessment: forged.assessment }));
  forged.proofBindingDigest = sha(j1307({ kind: 'MemoryOSReadinessProofBinding', version: '1.0.0', readinessDigest: forged.readinessDigest, audit: forged.audit }));
  admit('READINESS_RESULT', { 'memoryos-readiness-result.json': encode(forged) });
  rejects(new Uint8Array([...bytes, 10]));
  rejects(bytes.slice(0, bytes.length - 1));
  rejects(new Uint8Array(enc.encode(JSON.stringify(result, null, 1) + '\n')));
  rejects(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]));
  rejects(new Uint8Array(0));
  // Byte flips sampled across the file: admission never accepts a flipped file, and agrees with the MO-1307 parser when it can parse.
  let flips = 0;
  for (let position = 0; position < bytes.length; position += 211) {
    const mutated = new Uint8Array(bytes); mutated[position] ^= 1;
    rejects(mutated);
    flips += 1;
  }
  assert.ok(flips > 200);
});

test('B14 READINESS_RESULT J parsing agrees with the MO-1307 parser on structural limits', () => {
  const ownerAccepts = text => { try { parseCanonical1307(enc.encode(text), { maxBytes: 4194304 }); return true; } catch { return false; } };
  const nest = depth => '['.repeat(depth) + ']'.repeat(depth) + '\n';
  assert.equal(ownerAccepts(nest(16)), true);
  assert.equal(ownerAccepts(nest(17)), false);
  // Inside a result the same depth rule applies, measured from the document root. The result is re-sealed with both
  // digests recomputed over its canonical text so that only the structural limit can decide.
  const result = JSON.parse(dec.decode(readinessBytes('ready')));
  const text = value => canonicalize(value) + '\n';
  const sealed = depth => {
    const copy = structuredClone(result);
    let node = copy.audit;
    for (let i = 0; i < depth; i += 1) { node.deep = {}; node = node.deep; }
    copy.readinessDigest = sha(enc.encode(text({ kind: 'MemoryOSReadinessIdentity', version: '1.0.0', assessment: copy.assessment })));
    copy.proofBindingDigest = sha(enc.encode(text({ kind: 'MemoryOSReadinessProofBinding', version: '1.0.0', readinessDigest: copy.readinessDigest, audit: copy.audit })));
    return enc.encode(text(copy));
  };
  const seen = new Set();
  for (const depth of [1, 5, 11, 12, 13, 14, 15, 16, 20]) {
    const bytes = sealed(depth);
    const owner = ownerAccepts(dec.decode(bytes));
    let ours = true;
    try { admit('READINESS_RESULT', { 'memoryos-readiness-result.json': new Uint8Array(bytes) }); } catch { ours = false; }
    assert.equal(ours, owner, `nesting ${depth}`);
    seen.add(owner);
  }
  assert.deepEqual([...seen].sort(), [false, true], 'the boundary lies inside the probed range');
});

function decisionFor(readinessName, kind = 'approve') {
  return read('fixtures/mo1307/human', `${readinessName}-${kind}.json`);
}
// A ledger entry for a released readiness result, with the member descriptor of its real bytes (Amendment A4.1:
// admission re-verifies the retained bytes), and the retained-members map a verified ledger hands to admission.
function readinessMemberList(name) {
  const bytes = readinessBytes(name);
  return [{ name: 'memoryos-readiness-result.json', byteLength: bytes.length, sha256: sha(bytes) }];
}
function readinessEntryFor(name, index = 0) {
  const result = JSON.parse(dec.decode(readinessBytes(name)));
  const entry = recordEntry(index, 'READINESS_RESULT', D('MEMORYOS-HISTORY-RECORD-1.0', 'READINESS_RESULT', jcs(readinessMemberList(name))), [
    { type: 'PROOF_BINDING_DIGEST', value: result.proofBindingDigest }, { type: 'READINESS_CANDIDATE_DIGEST', value: result.assessment.candidateDigest },
    { type: 'READINESS_DIGEST', value: result.readinessDigest }]);
  entry.record.members = readinessMemberList(name);
  return entry;
}
const readinessRetained = (name, index = 0) => new Map([[readinessEntryFor(name, index).record.recordDigest, [{ name: 'memoryos-readiness-result.json', bytes: readinessBytes(name) }]]]);
const claimLedger = (name, extraEntries = [], retained = readinessRetained(name)) => view([readinessEntryFor(name), ...extraEntries], WS, retained);
// The consistency MO-1307 section 13 gives each (decision, readiness) pair.
const expectedConsistency = (decision, readiness) => (decision === 'APPROVE' && !['READY', 'READY_WITH_QUALIFICATIONS'].includes(readiness) ? 'CONTRARY_TO_READINESS' : 'CONSISTENT');

test('B15 HUMAN_DECISION_CLAIM: admitted only against a matching READINESS_RESULT entry (H16, R13)', () => {
  for (const name of ['ready', 'qualified', 'not-ready', 'could-not-evaluate']) {
    const label = name === 'could-not-evaluate' ? 'cne' : name;
    for (const kind of ['approve', 'defer', 'reject']) {
      const bytes = decisionFor(label, kind);
      const claim = JSON.parse(dec.decode(bytes));
      const record = admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': bytes }, claimLedger(name));
      assert.deepEqual([...record.subjects].map(s => ({ ...s })), subjectsOf(claim).sort((a, b) => (a.type < b.type ? -1 : 1)));
      const readiness = JSON.parse(dec.decode(readinessBytes(name))).assessment.readiness;
      assert.equal(record.decisionConsistency, expectedConsistency(claim.decision, readiness), `${name} ${kind}`);
      assert.equal(record.admission, 'MO1307_DECISION_CLAIM_BOUND');
      assert.equal(record.workspaceAssociation, 'DECLARED');
    }
  }
  const bytes = decisionFor('ready');
  // No readiness entry, a different readiness entry, or a partially matching one.
  assert.throws(() => admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': bytes }), code('DECISION_UNBOUND', 'ADMISSION'));
  assert.throws(() => admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': bytes }, claimLedger('qualified')), code('DECISION_UNBOUND'));
  for (const field of ['PROOF_BINDING_DIGEST', 'READINESS_CANDIDATE_DIGEST', 'READINESS_DIGEST']) {
    const entry = readinessEntryFor('ready');
    entry.record.subjects = entry.record.subjects.map(s => (s.type === field ? { ...s, value: d(9) } : s)).sort((a, b) => (a.type < b.type ? -1 : 1));
    assert.throws(() => admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': bytes }, view([entry], WS, readinessRetained('ready'))), code('DECISION_UNBOUND'), field);
  }
  // Another ledger entry kind carrying the same digests does not bind.
  const wrongKind = recordEntry(0, 'MIP_PACKAGE', d(777), [{ type: 'WORKSPACE', value: WS }]);
  assert.throws(() => admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': bytes }, view([wrongKind])), code('DECISION_UNBOUND'));
  // Amendment A4.1 (supersedes J2): a purged readiness result has no bytes to verify, so it no longer binds a new claim.
  assert.throws(() => admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': bytes }, claimLedger('ready', [tombstoneEntry(1, 0)], new Map())), code('DECISION_UNBOUND'));
  assert.throws(() => admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': bytes }, claimLedger('ready', [tombstoneEntry(1, 0)])), code('DECISION_UNBOUND'), 'purged even if bytes are supplied');
});

test('B16 HUMAN_DECISION_CLAIM shape rejections: exact MO-1307 section 13 shape and value rules', () => {
  const claim = JSON.parse(dec.decode(decisionFor('ready')));
  const ledger = () => claimLedger('ready');
  const encode = value => new Uint8Array(j1307(value));
  const rejects = mutate => { const copy = structuredClone(claim); mutate(copy); assert.throws(() => admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': encode(copy) }, ledger()), code('RECORD_INVALID', 'ADMISSION')); };
  const accepts = mutate => { const copy = structuredClone(claim); mutate(copy); admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': encode(copy) }, ledger()); };
  rejects(c => { c.authenticity = 'VERIFIED'; });
  rejects(c => { c.decision = 'MAYBE'; });
  rejects(c => { c.reason = ''; });
  rejects(c => { c.reason = 'r'.repeat(1025); });
  rejects(c => { c.actor = 'a'.repeat(129); });
  rejects(c => { c.timestamp = '2026-02-30T00:00:00Z'; });
  rejects(c => { c.timestamp = '2026-10-04T00:00:00.000Z'; });
  rejects(c => { c.timestamp = '2026-10-04 00:00:00'; });
  rejects(c => { c.timestamp = '2026-10-04T24:00:00Z'; });
  rejects(c => { c.attestation = 'sha256:short'; });
  rejects(c => { c.kind = 'MemoryOSReadinessHumanDecision2'; });
  rejects(c => { c.version = '1.0.1'; });
  rejects(c => { c.extra = 1; });
  rejects(c => { delete c.actor; });
  rejects(c => { c.actor = 5; });
  { const copy = structuredClone(claim); copy.reason = 'tab\there'; assert.throws(() => admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': new Uint8Array(enc.encode(canonicalize(copy) + '\n')) }, ledger()), code('RECORD_INVALID', 'ADMISSION')); }
  accepts(c => { c.actor = 'a'.repeat(128); c.reason = 'r'.repeat(1024); c.timestamp = '2026-10-04T12:30:45Z'; c.attestation = D('att'); });
  accepts(c => { c.actor = ''; });
  accepts(c => { c.timestamp = '2024-02-29T23:59:59Z'; });
  // Oversized and non-J bytes.
  assert.throws(() => admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': new Uint8Array(8193) }, ledger()), code('RESOURCE_LIMIT'));
  assert.throws(() => admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': new Uint8Array([...decisionFor('ready'), 10]) }, ledger()), code('RECORD_INVALID'));
  assert.throws(() => admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': new Uint8Array(enc.encode(JSON.stringify(claim, null, 1) + '\n')) }, ledger()), code('RECORD_INVALID'));
});

test('B17 duplicates and purged records are refused before any verification (R10, R20)', () => {
  const first = admit('MIP_PACKAGE', { 'package.mip': mipBytes });
  const entry = recordEntry(0, 'MIP_PACKAGE', first.recordDigest, [{ type: 'WORKSPACE', value: WS }]);
  assert.throws(() => admit('MIP_PACKAGE', { 'package.mip': mipBytes }, view([entry])), code('RECORD_DUPLICATE', 'ADMISSION'));
  assert.throws(() => admit('MIP_PACKAGE', { 'package.mip': mipBytes }, view([entry, tombstoneEntry(1, 0)])), code('RECORD_PURGED', 'ADMISSION'));
  // A different kind with the same digest value is not a duplicate; the digest already binds the kind.
  const otherKind = recordEntry(0, 'READINESS_RESULT', first.recordDigest, [{ type: 'PROOF_BINDING_DIGEST', value: d(1) }, { type: 'READINESS_CANDIDATE_DIGEST', value: d(2) }, { type: 'READINESS_DIGEST', value: d(3) }]);
  admit('MIP_PACKAGE', { 'package.mip': mipBytes }, view([otherKind]));
  // Admission is pure: the same inputs give the same record, and the view is never changed (R09).
  const ledger = view([entry]);
  const snapshot = JSON.stringify(ledger);
  assert.throws(() => admit('MIP_PACKAGE', { 'package.mip': new Uint8Array([1]) }, ledger), code('RECORD_INVALID'));
  assert.equal(JSON.stringify(ledger), snapshot);
});

test('B18 member rules: exact names, sets, duplicates, per-kind byte limits, argument shapes', () => {
  const ok = { 'package.mip': mipBytes };
  const rejects = (kind, object, expected, ledger) => assert.throws(() => admit(kind, object, ledger), code(expected));
  rejects('MIP_PACKAGE', { 'package.json': mipBytes }, 'RECORD_INVALID');
  rejects('MIP_PACKAGE', { ...ok, 'checkpoint.json': new Uint8Array(1) }, 'RECORD_INVALID');
  rejects('POLICY_EVALUATION', { 'evaluation-identity.json': new Uint8Array(1) }, 'RECORD_INVALID');
  rejects('CICD_RUN', { 'memoryos-ci-result.json': new Uint8Array(1) }, 'RECORD_INVALID');
  rejects('INVESTIGATION_CHECKPOINT', { 'package.mip': mipBytes }, 'RECORD_INVALID');
  assert.throws(() => admitHistoryRecord({ recordKind: 'MIP_PACKAGE', members: [{ name: 'package.mip', bytes: mipBytes }, { name: 'package.mip', bytes: mipBytes }], ledger: view() }), code('RECORD_INVALID'));
  // Per-kind limits (Freeze section 7.1, 14.2) are RESOURCE_LIMIT.
  rejects('MIP_PACKAGE', { 'package.mip': new Uint8Array(16_777_217) }, 'RESOURCE_LIMIT');
  rejects('INVESTIGATION_CHECKPOINT', { 'checkpoint.json': new Uint8Array(33_554_433) }, 'RESOURCE_LIMIT');
  rejects('REGRESSION_REPORT', { 'regression-report.json': new Uint8Array(16_777_217) }, 'RESOURCE_LIMIT');
  rejects('READINESS_RESULT', { 'memoryos-readiness-result.json': new Uint8Array(4_194_305) }, 'RESOURCE_LIMIT');
  rejects('HUMAN_DECISION_CLAIM', { 'human-decision.json': new Uint8Array(8193) }, 'RESOURCE_LIMIT');
  rejects('POLICY_EVALUATION', { 'evaluation-identity.json': new Uint8Array(4061), 'policy-outcome.json': new Uint8Array(1) }, 'RESOURCE_LIMIT');
  rejects('POLICY_EVALUATION', { 'evaluation-identity.json': new Uint8Array(1), 'policy-outcome.json': new Uint8Array(4061) }, 'RESOURCE_LIMIT');
  const names = ['evaluation-identity.json', 'memoryos-ci-artifacts.json', 'memoryos-ci-complete.json', 'memoryos-ci-evidence.json', 'memoryos-ci-result.json', 'policy-outcome.json'];
  rejects('CICD_RUN', Object.fromEntries(names.map(name => [name, new Uint8Array(8_193)])), 'RESOURCE_LIMIT'); // total 49,158 > 49,152
  // Exactly at the limits is not a limit failure (the record is then judged on its content).
  rejects('MIP_PACKAGE', { 'package.mip': new Uint8Array(16_777_216) }, 'RECORD_INVALID');
  rejects('HUMAN_DECISION_CLAIM', { 'human-decision.json': new Uint8Array(8192) }, 'RECORD_INVALID');
  // Unknown kind is a record verdict; malformed calls are USAGE.
  assert.throws(() => admitHistoryRecord({ recordKind: 'INGESTION_REJECTED', members: members(ok), ledger: view() }), code('RECORD_INVALID', 'ADMISSION'));
  assert.throws(() => admitHistoryRecord({ recordKind: 'NATIVE_INVESTIGATION', members: members(ok), ledger: view() }), code('RECORD_INVALID'));
  for (const bad of [undefined, null, [], {}, { recordKind: 'MIP_PACKAGE' }, { recordKind: 'MIP_PACKAGE', members: members(ok), ledger: view(), extra: 1 },
    { recordKind: 'MIP_PACKAGE', members: 'x', ledger: view() }, { recordKind: 'MIP_PACKAGE', members: [], ledger: view() },
    { recordKind: 'MIP_PACKAGE', members: [{ name: 'package.mip', bytes: 'text' }], ledger: view() },
    { recordKind: 'MIP_PACKAGE', members: [{ name: 'package.mip', bytes: mipBytes, extra: 1 }], ledger: view() },
    { recordKind: 'MIP_PACKAGE', members: [{ name: 'package.mip', bytes: new Uint8Array(new SharedArrayBuffer(4)) }], ledger: view() },
    { recordKind: 'MIP_PACKAGE', members: members(ok), ledger: null }, { recordKind: 'MIP_PACKAGE', members: members(ok), ledger: { entries: [] } },
    { recordKind: 'MIP_PACKAGE', members: members(ok), ledger: { workspaceIdentifier: '', entries: [] } },
    { recordKind: 'MIP_PACKAGE', members: members(ok), ledger: { workspaceIdentifier: WS, entries: [{}] } }]) {
    assert.throws(() => admitHistoryRecord(bad), code('USAGE'), JSON.stringify(bad)?.slice(0, 60));
  }
});

test('B19 admission is deterministic: member order, view construction and repetition do not change the record (R04)', () => {
  const { identity, outcome } = policyDirectory('evaluate-policy-pass');
  const forward = admitHistoryRecord({ recordKind: 'POLICY_EVALUATION', ledger: view(), members: [{ name: 'evaluation-identity.json', bytes: identity }, { name: 'policy-outcome.json', bytes: outcome }] });
  const reversed = admitHistoryRecord({ ledger: view(), recordKind: 'POLICY_EVALUATION', members: [{ bytes: outcome, name: 'policy-outcome.json' }, { bytes: identity, name: 'evaluation-identity.json' }] });
  assert.deepEqual(JSON.parse(JSON.stringify(forward)), JSON.parse(JSON.stringify(reversed)));
  assert.equal(jcs(JSON.parse(JSON.stringify(forward))), jcs(JSON.parse(JSON.stringify(admit('POLICY_EVALUATION', { 'evaluation-identity.json': identity, 'policy-outcome.json': outcome })))));
});

test('B20 every admitted record has the closed Freeze entry shape and no time, path or actor field (R24, R35)', () => {
  const samples = [
    admit('MIP_PACKAGE', { 'package.mip': mipBytes }),
    admit('READINESS_RESULT', { 'memoryos-readiness-result.json': readinessBytes('ready') }),
    admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': decisionFor('ready') }, claimLedger('ready')),
    admit('CICD_RUN', bundleMembers(realBundles[0])),
  ];
  for (const record of samples) {
    assert.deepEqual(Object.keys(record).sort(), ['admission', 'decisionConsistency', 'members', 'recordDigest', 'recordKind', 'subjects', 'workspaceAssociation']);
    const text = JSON.stringify(record);
    assert.doesNotMatch(text, /timestamp|actor|reason|observedAt|\d{4}-\d{2}-\d{2}T|https?:|[A-Za-z]:\\\\|\/home\//u);
  }
  // The decision claim's own timestamp and actor stay in the retained bytes only; none is copied into the record.
  const claim = JSON.parse(dec.decode(decisionFor('ready')));
  assert.ok(!JSON.stringify(samples[2]).includes(String(claim.reason)));
});

test('B21 the admission module delegates to owners, imports no SDK, Core, fs or predecessor package, and never runs verifyReadiness (R08, R28, R29, R35, R37)', () => {
  const source = fs.readFileSync(path.join(workspace, 'repositories/cca-studio/web/js/memoryos-history-admission.js'), 'utf8');
  const imports = [...source.matchAll(/^\s*(?:import\s.+?from|\}\s*from)\s+"([^"]+)";$/gmu)].map(match => match[1]);
  assert.deepEqual(imports, ['./mip-canonical.js', './memory-investigation-package.js', './investigation-policy-engine.js', './policy-canonical.js',
    './regression-policy-fact-source.js', './memoryos-history-contract.js']);
  const code2 = source.replace(/^\s*\/\/.*$/gmu, '');
  assert.doesNotMatch(code2, /verifyReadiness|windows-inspect|powershell|child_process|spawn|exec\(|worker_threads/iu);
  assert.doesNotMatch(code2, /node:|readFile|writeFile|fetch\(|(?<![\w.])process\.(env|argv|cwd|exit|platform|hrtime|nextTick)|require\(|import\(/u);
  assert.doesNotMatch(code2, /new Date\(\)|Date\.now|performance\.|setTimeout|setInterval|Math\.random|crypto\./u);
  assert.doesNotMatch(code2, /memoryos-sdk|investigation-core|\.\.\/memoryos-(ci|readiness)\/|memoryos-history-ledger/u);
});

test('B22 no admission verdict leaks input content in its error', () => {
  for (const call of [
    () => admit('MIP_PACKAGE', { 'package.mip': bytesOf('{"secret":"/home/user/token"}') }),
    () => admit('READINESS_RESULT', { 'memoryos-readiness-result.json': bytesOf('{"secret":"/home/user/token"}\n') }),
    () => admit('INVESTIGATION_CHECKPOINT', { 'checkpoint.json': bytesOf('{"secret":"/home/user/token"}') }),
  ]) {
    assert.throws(call, error => error instanceof MemoryOSHistoryError && !/secret|token|home/u.test(String(error.message) + error.stack.split('\n')[0]));
  }
});

test('B23 self-consistent forgeries that only a single rule can catch (checkpoint chain, evidence cross-hashes)', () => {
  // A checkpoint whose transition 1 names the wrong previous log digest, with that transition's identifier, the log
  // digest and the checkpoint identifier all recomputed over the forged value: only the prefix-digest chain rule objects.
  const value = checkpointValue();
  const forged = structuredClone(value);
  const id = forged.investigationIdentifier;
  const first = forged.transitionLog.transitions[0];
  forged.transitionLog.transitions[1].previousLogDigest = D('not-the-prefix');
  const second = forged.transitionLog.transitions[1];
  second.identifier = D('INVESTIGATION-CORE-TRANSITION-1.0', jcs({ investigationIdentifier: id, index: 1, kind: second.kind, payload: second.payload, previousLogDigest: second.previousLogDigest }));
  const material = transition => jcs({ identifier: transition.identifier, index: transition.index, investigationIdentifier: id, kind: transition.kind, payload: transition.payload, previousLogDigest: transition.previousLogDigest });
  forged.transitionLog.digest = D('INVESTIGATION-CORE-LOG-1.0', id, `[${[first, second].map(material).join(',')}]`);
  forged.transitionLogDigest = forged.transitionLog.digest;
  forged.identifier = D('INVESTIGATION-CORE-CHECKPOINT-1.0', id, forged.transitionLogDigest, forged.stateDigest);
  assert.equal(forged.transitionLog.transitions.length, 2);
  assert.throws(() => admit('INVESTIGATION_CHECKPOINT', { 'checkpoint.json': checkpointBytes(forged) }), code('RECORD_INVALID', 'ADMISSION'));

  // A bundle whose evidence names the wrong result or projection hash, with the manifest and marker re-sealed over it.
  const files = bundleMembers(realBundles.find(directory => fs.readdirSync(directory).length === 4));
  const resealTail = mutate => {
    const copy = Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, new Uint8Array(bytes)]));
    const evidence = JSON.parse(dec.decode(copy['memoryos-ci-evidence.json'])); mutate(evidence);
    copy['memoryos-ci-evidence.json'] = new Uint8Array(enc.encode(j1306(evidence)));
    const manifest = JSON.parse(dec.decode(copy['memoryos-ci-artifacts.json']));
    manifest.files = Object.keys(copy).filter(n => !n.endsWith('artifacts.json') && !n.endsWith('complete.json')).sort()
      .map(n => ({ byteLength: copy[n].length, path: n, sha256: sha(copy[n]) }));
    copy['memoryos-ci-artifacts.json'] = new Uint8Array(enc.encode(j1306(manifest)));
    const marker = JSON.parse(dec.decode(copy['memoryos-ci-complete.json'])); marker.manifestSha256 = sha(copy['memoryos-ci-artifacts.json']);
    copy['memoryos-ci-complete.json'] = new Uint8Array(enc.encode(j1306(marker)));
    return copy;
  };
  admit('CICD_RUN', resealTail(() => {}));
  assert.throws(() => admit('CICD_RUN', resealTail(e => { e.resultSha256 = D('wrong-result'); })), code('RECORD_INVALID', 'ADMISSION'));
  assert.throws(() => admit('CICD_RUN', resealTail(e => { e.projectionSha256 = D('wrong-projection'); })), code('RECORD_INVALID', 'ADMISSION'));
  // Installation-bound digests are retained as recorded, not re-verified (Freeze section 7.3): changing them is accepted.
  admit('CICD_RUN', resealTail(e => { e.distributionSha256 = D('another-distribution'); e.runtimeClosureSha256 = D('another-runtime'); e.semanticContractSha256 = D('another-contract'); }));
});

test('B24 CICD result rules agree with the MO-1306 checkResult over the whole error-catalog space (R03, R07)', () => {
  const files = bundleMembers(realBundles.find(directory => fs.readdirSync(directory).length === 4));
  const classifications = ['CONFIGURATION_ERROR', 'INPUT_ERROR', 'SEMANTIC_ERROR', 'TIMEOUT', 'CANCELLED', 'INTEGRITY_ERROR', 'INTERNAL_ERROR', 'ARTIFACT_ERROR'];
  const stages = ['ACQUISITION', 'CLEANUP', 'CONFIGURATION', 'GENERATION', 'INTEGRITY', 'INTERNAL', 'LAUNCH', 'METADATA', 'PUBLICATION', 'SEMANTIC', 'VERIFICATION'];
  const codes = Object.keys(catalog1306.errors);
  let combinations = 0, accepted = 0;
  const ownerAccepts = result => { try { checkResult1306(structuredClone(result)); return true; } catch { return false; } };
  const ours = result => {
    try {
      admit('CICD_RUN', resealBundle(files, state => { state.result = result; }));
      return true;
    } catch (error) { assert.ok(code('RECORD_INVALID', 'ADMISSION')(error)); return false; }
  };
  const base = JSON.parse(dec.decode(files['memoryos-ci-result.json']));
  let index = 0;
  for (const classification of classifications) {
    for (const errorCode of codes) {
      for (const stage of stages) {
        for (const termination of ['NORMAL', 'TIMEOUT', 'CANCELLED', 'ABNORMAL']) {
          index += 1;
          if (index % 11 !== 0 && catalog1306.errors[errorCode][0] !== classification) continue; // all catalog-consistent rows, a stride of the rest
          for (const semanticCode of [null, 'INVALID_INPUT']) {
            const row = projections1306[classification];
            const result = { ...structuredClone(base), classification, semantic: null, error: { code: errorCode, semanticCode, stage },
              process: { exitCode: row.exitCode, termination }, projection: structuredClone(row.projection) };
            const expected = ownerAccepts(result);
            assert.equal(ours(result), expected, `${classification} ${errorCode} ${stage} ${termination} ${semanticCode}`);
            combinations += 1; if (expected) accepted += 1;
          }
        }
      }
    }
  }
  assert.ok(combinations > 600 && accepted >= 20, `combinations ${combinations} accepted ${accepted}`);
});

test('B25 the embedded MO-1306 semantic-code allowlist equals the owner list (drift guard)', () => {
  const files = bundleMembers(realBundles.find(directory => fs.readdirSync(directory).length === 4));
  const owner = JSON.parse(fs.readFileSync(path.join(workspace, 'repositories/memoryos-ci/contracts/semantic-errors.json'), 'utf8')).codes;
  assert.equal(owner.length, 84);
  const base = JSON.parse(dec.decode(files['memoryos-ci-result.json']));
  const result = semanticCode => ({ ...structuredClone(base), classification: 'SEMANTIC_ERROR', semantic: null,
    error: { code: 'MO1306_SEMANTIC_VALIDATION', semanticCode, stage: 'SEMANTIC' }, process: { exitCode: 12, termination: 'NORMAL' },
    projection: { class: 'ADAPTER_ERROR', jobStatus: 'FAILURE' } });
  const ours = value => { try { admit('CICD_RUN', resealBundle(files, state => { state.result = value; })); return true; } catch { return false; } };
  for (const semanticCode of owner) assert.equal(ours(result(semanticCode)), true, semanticCode);
  for (const decoy of ['NOT_A_CODE', 'INVALID_INPUT_X', 'ZZZ', 'CORE_BUSY2']) assert.equal(ours(result(decoy)), false, decoy);
  assert.equal(ours(result(null)), true);
});

// ---- Amendment A4.1: decisionConsistency computed at admission from the verified claim and readiness bytes ----

// A readiness result re-sealed (both digests recomputed with the independent MO-1307 J) over a chosen readiness state.
function resealedReadiness(readiness, tag = '') {
  const result = JSON.parse(dec.decode(readinessBytes('ready')));
  result.assessment.readiness = readiness;
  result.audit.manifestSha256 = D('audit', tag + readiness);
  result.readinessDigest = sha(j1307({ kind: 'MemoryOSReadinessIdentity', version: '1.0.0', assessment: result.assessment }));
  result.proofBindingDigest = sha(j1307({ kind: 'MemoryOSReadinessProofBinding', version: '1.0.0', readinessDigest: result.readinessDigest, audit: result.audit }));
  return { result, bytes: new Uint8Array(j1307(result)) };
}
function ledgerWithResult({ result, bytes }, { sha256 = sha(bytes), recordDigest } = {}) {
  const members = [{ name: 'memoryos-readiness-result.json', byteLength: bytes.length, sha256 }];
  const digest = recordDigest ?? D('MEMORYOS-HISTORY-RECORD-1.0', 'READINESS_RESULT', jcs(members));
  const entry = recordEntry(0, 'READINESS_RESULT', digest, [
    { type: 'PROOF_BINDING_DIGEST', value: result.proofBindingDigest }, { type: 'READINESS_CANDIDATE_DIGEST', value: result.assessment.candidateDigest },
    { type: 'READINESS_DIGEST', value: result.readinessDigest }]);
  entry.record.members = members;
  return { entry, retained: new Map([[digest, [{ name: 'memoryos-readiness-result.json', bytes }]]]) };
}
const claimBytesFor = (result, decision, reason = 'A4.1 test') => new Uint8Array(j1307({ actor: null, attestation: null, authenticity: 'NOT_VERIFIED_BY_MEMORYOS',
  candidateDigest: result.assessment.candidateDigest, decision, kind: 'MemoryOSReadinessHumanDecision', proofBindingDigest: result.proofBindingDigest,
  readinessDigest: result.readinessDigest, reason, timestamp: null, version: '1.0.0' }));

test('B26 decisionConsistency is computed from the verified claim and result for every decision and readiness state (A4.1)', () => {
  const table = { READY: ['CONSISTENT', 'CONSISTENT', 'CONSISTENT'], READY_WITH_QUALIFICATIONS: ['CONSISTENT', 'CONSISTENT', 'CONSISTENT'],
    NOT_READY: ['CONTRARY_TO_READINESS', 'CONSISTENT', 'CONSISTENT'], COULD_NOT_EVALUATE: ['CONTRARY_TO_READINESS', 'CONSISTENT', 'CONSISTENT'] };
  for (const [readiness, expected] of Object.entries(table)) {
    const sealed = resealedReadiness(readiness);
    const { entry, retained } = ledgerWithResult(sealed);
    ['APPROVE', 'REJECT', 'DEFER'].forEach((decision, index) => {
      const record = admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': claimBytesFor(sealed.result, decision) }, view([entry], WS, retained));
      assert.equal(record.decisionConsistency, expected[index], `${decision} ${readiness}`);
      assert.deepEqual(Object.keys(record).sort(), ['admission', 'decisionConsistency', 'members', 'recordDigest', 'recordKind', 'subjects', 'workspaceAssociation']);
    });
  }
  // Every other kind stores null.
  assert.equal(admit('READINESS_RESULT', { 'memoryos-readiness-result.json': readinessBytes('ready') }).decisionConsistency, null);
  assert.equal(admit('MIP_PACKAGE', { 'package.mip': mipBytes }).decisionConsistency, null);
  // The released decision fixtures agree with MO-1307's own derivation (foundation.mjs: APPROVE contrary unless READY or qualified).
  for (const [name, label] of [['ready', 'ready'], ['qualified', 'qualified'], ['not-ready', 'not-ready'], ['could-not-evaluate', 'cne']]) {
    const readiness = JSON.parse(dec.decode(readinessBytes(name))).assessment.readiness;
    for (const kind of ['approve', 'defer', 'reject']) {
      const claim = JSON.parse(dec.decode(decisionFor(label, kind)));
      assert.equal(admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': decisionFor(label, kind) }, claimLedger(name)).decisionConsistency, expectedConsistency(claim.decision, readiness));
    }
  }
});

test('B27 a claim is rejected, never stored with a guessed value, for an absent, purged, unavailable, unverified or inconsistent result (A4.1)', () => {
  const sealed = resealedReadiness('READY');
  const claim = claimBytesFor(sealed.result, 'APPROVE');
  const good = ledgerWithResult(sealed);
  const run = (ledger) => admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': claim }, ledger);
  run(view([good.entry], WS, good.retained)); // control
  // Absent: no entry, or a result that exists only in another ledger (its bytes alone bind nothing).
  assert.throws(() => run(view([], WS, good.retained)), code('DECISION_UNBOUND', 'ADMISSION'));
  assert.throws(() => run(view([], WS)), code('DECISION_UNBOUND'));
  // Purged or unavailable bytes.
  assert.throws(() => run(view([good.entry, tombstoneEntry(1, 0)], WS, good.retained)), code('DECISION_UNBOUND'));
  assert.throws(() => run(view([good.entry], WS, new Map())), code('DECISION_UNBOUND'));
  // The retained bytes are not what the entry recorded.
  const flipped = new Uint8Array(sealed.bytes); flipped[flipped.length >> 1] ^= 1;
  assert.throws(() => run(view([good.entry], WS, new Map([[good.entry.record.recordDigest, [{ name: 'memoryos-readiness-result.json', bytes: flipped }]]]))), code('RECORD_BYTES_MISMATCH'));
  assert.throws(() => run(view([good.entry], WS, new Map([[good.entry.record.recordDigest, [{ name: 'memoryos-readiness-result.json', bytes: sealed.bytes.slice(1) }]]]))), code('RECORD_BYTES_MISMATCH'));
  assert.throws(() => run(view([good.entry], WS, new Map([[good.entry.record.recordDigest, []]]))), code('RECORD_BYTES_MISMATCH'));
  // Present and recorded consistently, but not a verifiable readiness result.
  const tampered = structuredClone(sealed.result); tampered.assessment.readiness = 'NOT_READY'; // digests left stale
  const tamperedBytes = new Uint8Array(j1307(tampered));
  const bad = ledgerWithResult({ result: sealed.result, bytes: tamperedBytes });
  assert.throws(() => run(view([bad.entry], WS, bad.retained)), code('RECORD_INVALID', 'ADMISSION'));
  // A result whose own digests differ from the entry's subjects (and the claim's).
  const other = resealedReadiness('NOT_READY', 'other');
  const swapped = ledgerWithResult({ result: sealed.result, bytes: other.bytes });
  assert.throws(() => run(view([swapped.entry], WS, swapped.retained)), code('RECORD_INVALID'));
  // A re-sealed result with a readiness outside the closed set is not a readiness result.
  const unknown = resealedReadiness('MAYBE_READY');
  const unknownLedger = ledgerWithResult(unknown);
  assert.throws(() => admit('HUMAN_DECISION_CLAIM', { 'human-decision.json': claimBytesFor(unknown.result, 'APPROVE') }, view([unknownLedger.entry], WS, unknownLedger.retained)), code('RECORD_INVALID'));
  // A malformed view is a usage error, not a verdict.
  assert.throws(() => run({ workspaceIdentifier: WS, entries: [good.entry], members: {} }), code('USAGE'));
});

// ---- Amendment A4.5: linear checkpoint admission, byte-identical to the quadratic construction ----

// The Standard's D with native incremental hashing, independent of the module under test.
const nativeD = (domain, ...parts) => {
  const hash = crypto.createHash('sha256').update('MIP-1').update(Buffer.from([0])).update(domain);
  for (const part of parts) hash.update(Buffer.from([0])).update(part);
  return 'sha256:' + hash.digest('hex');
};
// A linear re-sealer (native hash `copy()` per prefix), used to build very long, self-consistent checkpoints.
function fastReseal(checkpoint) {
  const value = structuredClone(checkpoint);
  const id = value.investigationIdentifier;
  let prior = nativeD('INVESTIGATION-CORE-LOG-1.0', id, '[]');
  const running = crypto.createHash('sha256').update('MIP-1').update(Buffer.from([0])).update('INVESTIGATION-CORE-LOG-1.0').update(Buffer.from([0])).update(id).update(Buffer.from([0])).update('[');
  value.transitionLog.transitions.forEach((transition, index) => {
    transition.index = index;
    transition.previousLogDigest = prior;
    transition.identifier = nativeD('INVESTIGATION-CORE-TRANSITION-1.0', jcs({ investigationIdentifier: id, index, kind: transition.kind, payload: transition.payload, previousLogDigest: prior }));
    running.update((index === 0 ? '' : ',') + jcs({ identifier: transition.identifier, index, investigationIdentifier: id, kind: transition.kind, payload: transition.payload, previousLogDigest: prior }));
    prior = 'sha256:' + running.copy().update(']').digest('hex');
  });
  value.transitionLog.digest = prior;
  value.transitionLogDigest = prior;
  value.transitionCount = value.transitionLog.transitions.length;
  value.identifier = nativeD('INVESTIGATION-CORE-CHECKPOINT-1.0', id, prior, value.stateDigest);
  return value;
}
const KINDS_AFTER_IMPORT = ['TRACE_SELECTED', 'REPLAY_PREPARED', 'REPLAY_ACTION', 'EVOLUTION_ENTERED', 'EVOLUTION_MOVED', 'COMPARATIVE_ENTERED',
  'COMPARATIVE_ACTION', 'COMPARATIVE_LEFT', 'EVOLUTION_LEFT', 'RETURNED_TO_WORLD', 'VERIFIED', 'ARCHIVED'];
function longCheckpoint(count) {
  const value = checkpointValue('mo1308-a45');
  const id = value.investigationIdentifier;
  for (let index = value.transitionLog.transitions.length; index < count; index += 1) {
    value.transitionLog.transitions.push({ kind: KINDS_AFTER_IMPORT[index % KINDS_AFTER_IMPORT.length], version: '1.0.0', investigationIdentifier: id, index,
      payload: index % 7 === 0 ? { step: index, note: `navigation ${index} é` } : {}, previousLogDigest: '', identifier: '' });
  }
  return fastReseal(value);
}
const outcomeOf = (action) => {
  try { return { subjects: [...action().subjects].map(subject => `${subject.type}=${subject.value}`) }; } catch (error) {
    return { code: error.code, stage: error.stage };
  }
};
const newOutcome = bytes => outcomeOf(() => admit('INVESTIGATION_CHECKPOINT', { 'checkpoint.json': bytes }));
const oldOutcome = (bytes, digest) => outcomeOf(() => ({ subjects: legacyAdmitCheckpoint(bytes, WS, digest) }));

test('B28 the incremental SHA-256 equals the standard hash for every length, split and clone (A4.5)', async () => {
  const { __sha256ForTests: stream } = await import('../../cca-studio/web/js/memoryos-history-admission.js');
  assert.equal(typeof stream, 'function');
  const hex = (...chunks) => { const s = stream(); for (const chunk of chunks) s.update(chunk); return s.hex(); };
  assert.equal(hex(), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(hex(enc.encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(hex(enc.encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  assert.equal(hex(new Uint8Array(1_000_000).fill(0x61)), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  let seed = 12345;
  const next = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
  for (let length = 0; length <= 300; length += 1) {
    const data = new Uint8Array(length).map(() => next() & 255);
    const expected = crypto.createHash('sha256').update(data).digest('hex');
    assert.equal(hex(data), expected, `length ${length}`);
    const cut = length === 0 ? 0 : next() % (length + 1), cut2 = cut + (length === cut ? 0 : next() % (length - cut + 1));
    assert.equal(hex(data.subarray(0, cut), data.subarray(cut, cut2), data.subarray(cut2)), expected, `split ${length}`);
    // hex() leaves the stream usable, and a clone continues independently.
    const s = stream().update(data.subarray(0, cut));
    const midstate = s.hex();
    assert.equal(midstate, crypto.createHash('sha256').update(data.subarray(0, cut)).digest('hex'));
    const branch = s.clone().update(data.subarray(cut));
    assert.equal(branch.hex(), expected);
    assert.equal(s.update(data.subarray(cut)).hex(), expected);
    assert.equal(branch.update(enc.encode('x')).hex(), crypto.createHash('sha256').update(data).update('x').digest('hex'));
  }
});

test('B29 linear checkpoint admission gives byte-identical results to the quadratic construction on the corpus and tampered variants (A4.5)', () => {
  const base = checkpointValue();
  const core = new InvestigationCore();
  core.import(mipBytes, { identifier: 'nav2' });
  core.returnToWorld('nav2');
  const navigated = JSON.parse(JSON.stringify(core.checkpoint('nav2')));
  const native = (() => { const c = new InvestigationCore(); c.create({ identifier: 'native', snapshot: referenceSnapshot }); return JSON.parse(JSON.stringify(c.checkpoint('native'))); })();
  const tweak = (mutate, source = base) => { const copy = structuredClone(source); mutate(copy); return copy; };
  const variants = [base, navigated, native, longCheckpoint(2), longCheckpoint(3), longCheckpoint(40), reseal(base),
    tweak(v => { v.identifier = D('x'); }), tweak(v => { v.stateDigest = D('y'); }), tweak(v => { v.transitionCount += 1; }),
    tweak(v => { v.transitionLogDigest = D('z'); }), tweak(v => { v.transitionLog.digest = D('z'); }),
    tweak(v => { v.transitionLog.transitions[0].identifier = D('i'); }), tweak(v => { v.transitionLog.transitions[1].previousLogDigest = D('p'); }),
    tweak(v => { v.transitionLog.transitions[1].index = 2; }), tweak(v => { v.extra = 1; }), tweak(v => { v.transitionLog.transitions.pop(); v.transitionCount = 1; }),
    reseal(tweak(v => { v.transitionLog.transitions[0].payload.sourceKind = 'native'; })),
    reseal(tweak(v => { v.transitionLog.transitions[1].kind = 'OBSERVED'; })),
    reseal(tweak(v => { v.transitionLog.transitions[1].payload.package.manifest.packageIdentifier += '-forged'; })),
    reseal(tweak(v => { v.transitionLog.transitions[0].payload.workspaceIdentifier = 'other'; v.workspaceIdentifier = 'other'; })),
    reseal(tweak(v => { v.transitionLog.transitions.splice(1, 1); })),
    // A forged prefix digest inside a long, otherwise consistent log; a swapped pair; a transition from another log.
    (() => { const v = longCheckpoint(30); v.transitionLog.transitions[17].previousLogDigest = D('forged'); return v; })(),
    (() => { const v = longCheckpoint(30); const t = v.transitionLog.transitions; [t[10], t[11]] = [t[11], t[10]]; return v; })(),
    (() => { const v = longCheckpoint(30); v.transitionLog.transitions[20].payload = { step: 'changed' }; return v; })(),
    (() => { const v = longCheckpoint(30); v.transitionLog.digest = D('tail'); return v; })(),
    (() => { const v = longCheckpoint(30); v.transitionCount = 29; return v; })(),
    tweak(v => { v.transitionLog.transitions[0].kind = 'NOT_A_KIND'; })];
  let accepted = 0;
  for (const [index, value] of variants.entries()) {
    const bytes = checkpointBytes(value);
    const expected = oldOutcome(bytes);
    const actual = newOutcome(bytes);
    assert.deepEqual(actual, expected, `variant ${index}`);
    if (expected.subjects) accepted += 1;
  }
  assert.ok(accepted >= 6 && accepted < variants.length - 8, `accepted ${accepted} of ${variants.length}`);
  // Raw non-JSON and non-canonical inputs agree as well.
  for (const bytes of [new Uint8Array(0), enc.encode('{}'), enc.encode('[]'), new Uint8Array([...checkpointBytes(base), 10]), enc.encode(JSON.stringify(base, null, 1))]) {
    assert.deepEqual(newOutcome(bytes), oldOutcome(bytes));
  }
});

test('B30 linear admission equals the quadratic construction on generated checkpoints up to 10,000 transitions (A4.5)', () => {
  // The oracle is the verbatim quadratic algorithm (every prefix re-hashed) with native hashing, so 10,000 transitions finish.
  for (const count of [2, 5, 64, 500, 2500, 10_000]) {
    const value = longCheckpoint(count);
    assert.equal(value.transitionCount, count);
    const bytes = checkpointBytes(value);
    const expected = oldOutcome(bytes, nativeD);
    assert.ok(expected.subjects, `the quadratic oracle accepts ${count} transitions`);
    assert.deepEqual(newOutcome(bytes), expected, `${count} transitions`);
    assert.equal(expected.subjects.includes(`TRANSITION_LOG_DIGEST=${value.transitionLogDigest}`), true);
    // One forged previousLogDigest at the deepest transition is rejected identically.
    const forged = structuredClone(value);
    forged.transitionLog.transitions[count - 1].previousLogDigest = D('forged-tail');
    assert.deepEqual(newOutcome(checkpointBytes(forged)), oldOutcome(checkpointBytes(forged), nativeD), `${count} forged`);
    assert.equal(newOutcome(checkpointBytes(forged)).code, 'MO1308_RECORD_INVALID');
  }
  // The Core's published ceiling: one transition more is not a checkpoint.
  const over = longCheckpoint(10_001);
  assert.deepEqual(newOutcome(checkpointBytes(over)), { code: 'MO1308_RECORD_INVALID', stage: 'ADMISSION' });
});
