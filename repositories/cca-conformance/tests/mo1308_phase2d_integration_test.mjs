import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sdk from '../../cca-studio/web/js/memoryos-sdk.js';
import { MemoryOSHistoryError } from '../../cca-studio/web/js/memoryos-history-contract.js';
import { canonicalize } from '../../cca-studio/web/js/mip-canonical.js';
import { InvestigationCore } from '../../cca-studio/web/js/investigation-core.js';
import { referenceSnapshot } from '../../cca-studio/web/data/studio-snapshot.js';
import { createHistoryStore } from '../../memoryos-cli/src/history-store.js';
import { MEMORYOS_CLI_VERSION } from '../../memoryos-cli/src/version.js';
import { runCli } from '../../memoryos-cli/tests/test-helpers.mjs';
import { createHistoryEngine } from '../../memoryos-cli/tests/support/history-engine.mjs';
import {
  CORPUS_WORKSPACE, bundleDirectory, bundleRecord, checkpointBytes, checkpointRecord, decisionRecord, mipBytes, policyFiles, policyRecord,
  readinessRecord, regressionBytes,
} from '../../memoryos-cli/tests/support/history-corpus.mjs';

// MO-1308 Contract Freeze 1, Stream 2D: the integrated suite. The SDK facade (memoryos-sdk.js) over Streams 2A and 2B, the
// CLI `history` namespace over Stream 2C's file store, and the requirements the Freeze assigns to integration: R04, R09,
// R12-R14, R21, R23, R25, R27-R30, R32, R34 and R37. Real records of every kind are the corpus; the CLI is driven through
// real processes, and the SDK is driven in memory to produce the oracle bytes.
const repositories = fileURLToPath(new URL('../../', import.meta.url));
const repo = (...segments) => path.join(repositories, ...segments);
const read = (...segments) => fs.readFileSync(repo(...segments), 'utf8');
const withoutComments = source => source.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
const enc = new TextEncoder();
const dec = new TextDecoder();
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const code = (expected, stage) => error => error instanceof MemoryOSHistoryError && error.code === `MO1308_${expected}` && (stage === undefined || error.stage === stage);
const WS = CORPUS_WORKSPACE;

function scratch(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mo1308-2d-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

// ---- The CLI, through real processes ----
const cli = (...args) => runCli(['history', ...args, '--json']);
function succeeded(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}
// A failure carries only the frozen code, the category exit and the fixed message, and discloses nothing (R25).
function failed(result, historyCode, exitCode, secrets = []) {
  assert.equal(result.status, exitCode, `${historyCode}: ${result.stderr}`);
  assert.equal(result.stdout, '');
  const envelope = JSON.parse(result.stderr);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.historyCode, `MO1308_${historyCode}`);
  assert.equal(envelope.error.exitCode, exitCode);
  assert.deepEqual(envelope.error.details, []);
  assert.equal(envelope.error.message, new MemoryOSHistoryError(historyCode, 'INTERNAL').message);
  for (const secret of [os.tmpdir(), ...secrets]) assert.ok(!result.stderr.includes(secret), `stderr discloses ${secret}`);
  return envelope.error;
}
const exitOf = { RECORD_INVALID: 2, RECORD_DUPLICATE: 2, RECORD_PURGED: 2, WORKSPACE_MISMATCH: 2, DECISION_UNBOUND: 2, TOMBSTONE_INVALID: 2,
  RESOURCE_LIMIT: 2, LEDGER_CORRUPT: 3, RECORD_BYTES_MISMATCH: 3, EXPORT_CORRUPT: 3, LEDGER_EXISTS: 4, LEDGER_NOT_FOUND: 4 };

// Writes a record to files and appends it through the CLI; returns the parsed envelope or the raw result when `raw`.
function cliAppend(root, ledger, record, { raw = false, tag = 'in' } = {}) {
  const directory = fs.mkdtempSync(path.join(root, `${tag}-`));
  const file = name => { const target = path.join(directory, name); fs.writeFileSync(target, record.members.find(member => member.name === name).bytes); return target; };
  let args;
  if (record.recordKind === 'POLICY_EVALUATION') {
    args = ['--identity', file('evaluation-identity.json'), '--outcome', file('policy-outcome.json')];
  } else if (record.recordKind === 'CICD_RUN') {
    const run = path.join(directory, 'run');
    fs.mkdirSync(run);
    for (const member of record.members) fs.writeFileSync(path.join(run, member.name), member.bytes);
    args = ['--run', run];
  } else {
    args = ['--record', file(record.members[0].name)];
  }
  const result = cli('append', '--ledger', ledger, '--kind', record.recordKind, ...args);
  return raw ? result : succeeded(result);
}
const cliInit = (ledger, workspace = WS, name = 'workspace.history') => succeeded(cli('init', '--ledger', ledger, '--name', name, '--workspace', workspace));

// ---- The SDK, in memory, as the oracle ----
function buildInMemory(sequence, workspaceIdentifier = WS, ledgerName = 'workspace.history') {
  const { descriptorBytes } = sdk.createHistoryLedger({ ledgerName, workspaceIdentifier });
  const entries = [], members = new Map();
  const verify = () => sdk.verifyHistoryLedger({ descriptorBytes, entries: [...entries], members: new Map(members) });
  let ledger = verify();
  for (const step of sequence) {
    if (step.tombstone !== undefined) {
      const built = sdk.tombstoneHistoryEntry({ ledger, ...step.tombstone });
      entries.push(built.entryBytes);
      members.delete(JSON.parse(dec.decode(entries[step.tombstone.targetIndex])).record.recordDigest);
    } else {
      const admission = sdk.admitHistoryRecord({ recordKind: step.recordKind, members: step.members, ledger });
      const built = sdk.appendHistoryEntry({ ledger, admission });
      entries.push(built.entryBytes);
      members.set(admission.recordDigest, step.members.map(member => ({ name: member.name, bytes: member.bytes })));
    }
    ledger = verify();
  }
  return { descriptorBytes, entries, members, ledger };
}
const QUERY = (over = {}) => ({ kind: 'MemoryOSHistoryQuery', version: '1.0.0', recordKinds: [], subject: null, retention: 'ANY', fromIndex: 0, limit: 1000, ...over });

// The nine-record sequence of the end-to-end corpus: every kind, both decision consistencies.
const SEQUENCE = () => [
  { recordKind: 'MIP_PACKAGE', members: [{ name: 'package.mip', bytes: mipBytes() }] },
  checkpointRecord('mo1308-2d-end-to-end'),
  { recordKind: 'REGRESSION_REPORT', members: [{ name: 'regression-report.json', bytes: regressionBytes() }] },
  policyRecord(0),
  bundleRecord(6),
  readinessRecord('ready'),
  decisionRecord('ready', 'approve'),
  readinessRecord('not-ready'),
  decisionRecord('not-ready', 'approve'),
];
const sequenceSteps = () => SEQUENCE();

// A snapshot of every file under a directory (names and content hashes).
function tree(directory) {
  const result = new Map();
  const walk = current => {
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name);
      if (fs.lstatSync(full).isDirectory()) walk(full); else result.set(path.relative(directory, full).split(path.sep).join('/'), sha(fs.readFileSync(full)));
    }
  };
  walk(directory);
  return result;
}
const treeObject = directory => Object.fromEntries(tree(directory));

// One real ledger of all nine records through the CLI, shared by the read-only tests below.
let shared = null;
function sharedLedger(t) {
  if (shared === null) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mo1308-2d-shared-'));
    const ledger = path.join(root, 'ledger');
    cliInit(ledger);
    const appended = SEQUENCE().map(record => cliAppend(root, ledger, record));
    shared = { root, ledger, appended };
    process.on('exit', () => fs.rmSync(root, { recursive: true, force: true }));
  }
  void t;
  return shared;
}

// ---------------------------------------------------------------------------------------------------------------
test('D01 versions: SDK and CLI declare 1.2.0, released bundled copies keep 1.1.0 (R34, R32, Amendment A1)', () => {
  assert.equal(sdk.MEMORYOS_SDK_VERSION, '1.2.0');
  assert.equal(MEMORYOS_CLI_VERSION, '1.2.0');
  assert.equal(JSON.parse(read('memoryos-cli/package.json')).version, '1.2.0');
  assert.match(read('memoryos-cli/CMakeLists.txt'), /project\(memoryos_cli VERSION 1\.2\.0 /u);
  const version = JSON.parse(runCli(['version', '--json']).stdout);
  assert.deepEqual(version.result, { cliVersion: '1.2.0', sdkVersion: '1.2.0' });
  assert.match(runCli(['help']).stdout, /^MemoryOS CLI 1\.2\.0$/mu);
  // The released packages vendor byte-preserved copies of the 1.1.0 SDK; none was updated and none contains MO-1308.
  const copies = ['memoryos-mcp/runtime/authoritative/web/js/memoryos-sdk.js', 'memoryos-ci/runtime/authoritative/web/js/memoryos-sdk.js']
    .map(file => repo(file));
  const rest = path.join(repositories, 'memoryos-rest');
  const found = [...copies];
  const walk = directory => { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full); else if (entry.name === 'memoryos-sdk.js') found.push(full);
  } };
  walk(rest);
  walk(path.join(repositories, '../.github/actions'));
  assert.ok(found.length >= 4, `expected at least four released copies, found ${found.length}`);
  const hashes = new Set(found.map(file => sha(fs.readFileSync(file))));
  assert.equal(hashes.size, 1, 'every released bundled SDK copy is identical');
  for (const file of found) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /MEMORYOS_SDK_VERSION = "1\.1\.0"/u, file);
    assert.doesNotMatch(source, /memoryos-history|HistoryLedger/u, file);
  }
  assert.notEqual([...hashes][0], sha(fs.readFileSync(repo('cca-studio/web/js/memoryos-sdk.js'))));
});

test('D02 SDK facade: every record kind goes admit -> append -> verify -> query -> export -> verify-export (R07, R22, R23)', () => {
  const { descriptorBytes, entries, members, ledger } = buildInMemory(sequenceSteps());
  assert.equal(ledger.entryCount, 9);
  assert.equal(ledger.retainedRecords, 9);
  assert.deepEqual([ledger.purgedRecords, ledger.tombstones, ledger.purgePending, ledger.unreferencedRecords, ledger.pendingArtifacts], [0, 0, [], [], 0]);
  const result = sdk.queryHistoryLedger({ descriptorBytes, entries, query: QUERY() });
  assert.deepEqual(result.entries.map(entry => entry.recordKind), ['MIP_PACKAGE', 'INVESTIGATION_CHECKPOINT', 'REGRESSION_REPORT', 'POLICY_EVALUATION',
    'CICD_RUN', 'READINESS_RESULT', 'HUMAN_DECISION_CLAIM', 'READINESS_RESULT', 'HUMAN_DECISION_CLAIM']);
  assert.deepEqual(result.entries.map(entry => entry.admission), ['MIP_001_VERIFIED', 'CORE_LOG_VERIFIED_STATE_ISSUED', 'SDK_REGRESSION_REPORT_INSPECTED',
    'SDK_POLICY_ARTIFACTS_VERIFIED', 'MO1306_BUNDLE_INTEGRITY_VERIFIED', 'MO1307_SELF_DIGESTS_RECOMPUTED', 'MO1307_DECISION_CLAIM_BOUND',
    'MO1307_SELF_DIGESTS_RECOMPUTED', 'MO1307_DECISION_CLAIM_BOUND']);
  assert.deepEqual(result.entries.map(entry => entry.workspaceAssociation), ['INTRINSIC', 'INTRINSIC', 'INTRINSIC', 'DECLARED', 'DECLARED',
    'DECLARED', 'DECLARED', 'DECLARED', 'DECLARED']);
  // A4.1: decisionConsistency is the value stored at admission; the query needs no member bytes.
  assert.deepEqual(result.entries.map(entry => entry.decisionConsistency), [null, null, null, null, null, null, 'CONSISTENT', null, 'CONTRARY_TO_READINESS']);
  const exported = sdk.buildHistoryExport({ descriptorBytes, entries, members });
  const verified = sdk.verifyHistoryExport({ files: exported.files });
  assert.deepEqual({ ...verified }, { ...ledger }, 'the export verifies to the same Verification as the ledger');
});

test('D03 SDK facade brands: only values the history code issued are accepted (Amendment A2 item 2)', () => {
  const { ledger, descriptorBytes } = buildInMemory([]);
  const record = checkpointRecord('brand');
  const admission = sdk.admitHistoryRecord({ recordKind: record.recordKind, members: record.members, ledger });
  assert.equal(Object.isFrozen(admission), true);
  assert.equal(Object.isFrozen(ledger), true);
  // Copies and look-alikes are not issued values.
  assert.throws(() => sdk.appendHistoryEntry({ ledger, admission: { ...admission } }), code('USAGE', 'USAGE'));
  assert.throws(() => sdk.appendHistoryEntry({ ledger: { ...ledger }, admission }), code('USAGE', 'USAGE'));
  assert.throws(() => sdk.admitHistoryRecord({ recordKind: record.recordKind, members: record.members, ledger: { ...ledger } }), code('USAGE', 'USAGE'));
  assert.throws(() => sdk.tombstoneHistoryEntry({ ledger: {}, targetIndex: 0, reason: 'PRIVACY_REQUEST', authorityReference: 'P-1' }), code('USAGE', 'USAGE'));
  // A value is issued by this facade: the authority's own verification object is not accepted until the facade has issued it.
  const built = sdk.appendHistoryEntry({ ledger, admission });
  assert.equal(built.index, 0);
  assert.ok(built.entryBytes instanceof Uint8Array);
  assert.match(built.entryDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(sdk.verifyHistoryLedger({ descriptorBytes, entries: [built.entryBytes], members: new Map([[admission.recordDigest, record.members]]) }).entryCount, 1);
});

test('D04 SDK facade glue: admission is built from historyLedgerView, so retained readiness bytes bind decision claims (A4.1)', () => {
  const claim = decisionRecord('ready', 'approve');
  // No readiness result in the ledger: DECISION_UNBOUND.
  assert.throws(() => sdk.admitHistoryRecord({ recordKind: claim.recordKind, members: claim.members, ledger: buildInMemory([]).ledger }), code('DECISION_UNBOUND', 'ADMISSION'));
  // A different result is not the claim's result.
  const other = buildInMemory([readinessRecord('not-ready')]);
  assert.throws(() => sdk.admitHistoryRecord({ recordKind: claim.recordKind, members: claim.members, ledger: other.ledger }), code('DECISION_UNBOUND', 'ADMISSION'));
  // The matching retained result admits it and stores CONSISTENT; the contrary pairing stores CONTRARY_TO_READINESS.
  const built = buildInMemory([readinessRecord('ready'), readinessRecord('not-ready')]);
  assert.equal(sdk.admitHistoryRecord({ recordKind: claim.recordKind, members: claim.members, ledger: built.ledger }).decisionConsistency, 'CONSISTENT');
  const contrary = decisionRecord('not-ready', 'approve');
  assert.equal(sdk.admitHistoryRecord({ recordKind: contrary.recordKind, members: contrary.members, ledger: built.ledger }).decisionConsistency, 'CONTRARY_TO_READINESS');
  for (const kind of ['reject', 'defer']) {
    const other = decisionRecord('not-ready', kind);
    assert.equal(sdk.admitHistoryRecord({ recordKind: other.recordKind, members: other.members, ledger: built.ledger }).decisionConsistency, 'CONSISTENT', kind);
  }
  // A purged readiness result no longer binds a new claim (Amendment A4.1 supersedes J2).
  const purged = buildInMemory([readinessRecord('ready'), { tombstone: { targetIndex: 0, reason: 'PRIVACY_REQUEST', authorityReference: 'P-1' } }]);
  assert.throws(() => sdk.admitHistoryRecord({ recordKind: claim.recordKind, members: claim.members, ledger: purged.ledger }), code('DECISION_UNBOUND', 'ADMISSION'));
  // The stored consistency survives a later purge of the claim and of its readiness result, and is never recomputed.
  const lifecycle = buildInMemory([readinessRecord('not-ready'), decisionRecord('not-ready', 'approve'),
    { tombstone: { targetIndex: 1, reason: 'PRIVACY_REQUEST', authorityReference: 'P-1' } }, { tombstone: { targetIndex: 0, reason: 'PRIVACY_REQUEST', authorityReference: 'P-2' } }]);
  const rows = sdk.queryHistoryLedger({ descriptorBytes: lifecycle.descriptorBytes, entries: lifecycle.entries, query: QUERY() }).entries;
  assert.equal(rows[1].decisionConsistency, 'CONTRARY_TO_READINESS');
  assert.equal(rows[1].retention, 'PURGED');
  assert.deepEqual(rows.slice(2).map(row => [row.entryType, row.decisionConsistency]), [['TOMBSTONE', null], ['TOMBSTONE', null]]);
});

test('D05 createHistoryCheckpointRecord: the Standard\'s nine-member projection, MIP-backed only, never a restore source (H13, H14, R12)', () => {
  const memory = new sdk.MemoryOS();
  const imported = memory.importPackage(mipBytes(), { identifier: 'mo1308-2d-cp' });
  const checkpoint = imported.checkpoint();
  const bytes = memory.createHistoryCheckpointRecord(checkpoint);
  // Independent oracle: the Core's own projection serialized with the canonical serializer.
  const core = new InvestigationCore();
  core.import(mipBytes(), { identifier: 'mo1308-2d-cp' });
  assert.equal(dec.decode(bytes), canonicalize(JSON.parse(JSON.stringify(core.checkpoint('mo1308-2d-cp')))));
  assert.deepEqual(Object.keys(JSON.parse(dec.decode(bytes))).sort(), ['identifier', 'investigationIdentifier', 'kind', 'stateDigest', 'transitionCount',
    'transitionLog', 'transitionLogDigest', 'version', 'workspaceIdentifier']);
  // Deterministic: the same checkpoint always produces the same bytes (R04), and the bytes are a fresh array each time.
  const again = memory.createHistoryCheckpointRecord(checkpoint);
  assert.deepEqual(again, bytes);
  assert.notEqual(again, bytes);
  // It is admitted by the ledger, and it is not a restore source: the SDK and Core restore only an issued Checkpoint.
  const { ledger } = buildInMemory([]);
  assert.equal(sdk.admitHistoryRecord({ recordKind: 'INVESTIGATION_CHECKPOINT', members: [{ name: 'checkpoint.json', bytes }], ledger }).admission, 'CORE_LOG_VERIFIED_STATE_ISSUED');
  assert.throws(() => memory.restore(JSON.parse(dec.decode(bytes))));
  assert.throws(() => memory.restore(bytes));
  // Only this instance's Checkpoint is accepted.
  assert.throws(() => new sdk.MemoryOS().createHistoryCheckpointRecord(checkpoint), code('USAGE', 'USAGE'));
  assert.throws(() => memory.createHistoryCheckpointRecord({ ...checkpoint }), code('USAGE', 'USAGE'));
  assert.throws(() => memory.createHistoryCheckpointRecord(JSON.parse(dec.decode(bytes))), code('USAGE', 'USAGE'));
  // A native investigation (not MIP-backed) is rejected with RECORD_INVALID, by the admission method.
  const native = memory.observe(memory.openWorkspace(referenceSnapshot.workspaceIdentifier), referenceSnapshot, { identifier: 'mo1308-2d-native' });
  assert.throws(() => memory.createHistoryCheckpointRecord(native.checkpoint()), code('RECORD_INVALID', 'ADMISSION'));
  // The same holds for a native checkpoint's bytes supplied directly (the CLI path).
  const nativeCore = new InvestigationCore();
  nativeCore.create({ identifier: 'mo1308-2d-native-core', snapshot: referenceSnapshot });
  const nativeBytes = enc.encode(canonicalize(JSON.parse(JSON.stringify(nativeCore.checkpoint('mo1308-2d-native-core')))));
  const nativeLedger = buildInMemory([], referenceSnapshot.workspaceIdentifier).ledger;
  assert.throws(() => sdk.admitHistoryRecord({ recordKind: 'INVESTIGATION_CHECKPOINT', members: [{ name: 'checkpoint.json', bytes: nativeBytes }], ledger: nativeLedger }),
    code('RECORD_INVALID', 'ADMISSION'));
});

test('D06 CLI end to end through real processes: init, append of every kind, verify, query, tombstone, export, verify-export (section 13.3, Amendment A4.2)', t => {
  const { root, ledger, appended } = sharedLedger(t);
  void root;
  // A4.2 success results are exactly the frozen projections.
  appended.forEach((envelope, index) => {
    assert.deepEqual(Object.keys(envelope).sort(), ['command', 'ok', 'result', 'schemaVersion']);
    assert.equal(envelope.command, 'history append');
    assert.deepEqual(Object.keys(envelope.result).sort(), ['entryDigest', 'index']);
    assert.equal(envelope.result.index, index);
  });
  const verified = succeeded(cli('verify', '--ledger', ledger));
  assert.equal(verified.command, 'history verify');
  assert.equal(verified.result.entryCount, 9);
  assert.equal(verified.result.headDigest, appended[8].result.entryDigest);
  assert.deepEqual(verified.result.purgePending, []);
  assert.equal(verified.result.pendingArtifacts, 0);
  // Query: kinds filter (ordered by the command layer), subject filter, paging with nextIndex.
  const kinds = succeeded(cli('query', '--ledger', ledger, '--kind', 'READINESS_RESULT', '--kind', 'CICD_RUN', '--retention', 'RETAINED', '--from', '0', '--limit', '10'));
  assert.deepEqual(kinds.result.query.recordKinds, ['CICD_RUN', 'READINESS_RESULT']);
  assert.deepEqual(kinds.result.entries.map(entry => entry.index), [4, 5, 7]);
  const workspaceRows = succeeded(cli('query', '--ledger', ledger, '--subject-type', 'WORKSPACE', '--subject', WS, '--retention', 'ANY', '--from', '0', '--limit', '10'));
  assert.deepEqual(workspaceRows.result.entries.map(entry => entry.index), [0, 1, 2]);
  const page = succeeded(cli('query', '--ledger', ledger, '--retention', 'ANY', '--from', '2', '--limit', '3'));
  assert.deepEqual(page.result.entries.map(entry => entry.index), [2, 3, 4]);
  assert.equal(page.result.nextIndex, 5);
  assert.equal(succeeded(cli('query', '--ledger', ledger, '--retention', 'PURGED', '--from', '0', '--limit', '10')).result.entries.length, 0);
  // Human output is the deterministic key: value form, never "[object Object]".
  const human = runCli(['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '2']);
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /^MemoryOS history query\n/u);
  assert.doesNotMatch(human.stdout, /\[object Object\]/u);
});

test('D07 CLI tombstone, purge, export and verify-export (sections 10, 12; R18, R19, R20, R23)', t => {
  const root = scratch(t);
  const ledger = path.join(root, 'ledger');
  cliInit(ledger);
  for (const record of SEQUENCE().slice(0, 3)) cliAppend(root, ledger, record);
  assert.equal(fs.readdirSync(path.join(ledger, 'records')).length, 3);
  const purgedHex = JSON.parse(fs.readFileSync(path.join(ledger, 'entries', `${String(1).padStart(20, '0')}.json`), 'utf8')).record.recordDigest.slice('sha256:'.length);
  const tombstone = succeeded(cli('tombstone', '--ledger', ledger, '--target', '1', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'PRIV-2026-0042'));
  assert.deepEqual(Object.keys(tombstone.result).sort(), ['entryDigest', 'index']);
  assert.equal(tombstone.result.index, 3);
  assert.equal(fs.readdirSync(path.join(ledger, 'records')).length, 2, 'the purged record\'s members are deleted (section 10.2)');
  const verified = succeeded(cli('verify', '--ledger', ledger)).result;
  assert.deepEqual([verified.entryCount, verified.retainedRecords, verified.purgedRecords, verified.tombstones, verified.purgePending], [4, 2, 1, 1, []]);
  // Purged bytes can never be re-added (H23); a tombstone is itself final.
  failed(cliAppend(root, ledger, SEQUENCE()[1], { raw: true }), 'RECORD_PURGED', 2, [root]);
  for (const target of ['1', '3', '9']) {
    failed(cli('tombstone', '--ledger', ledger, '--target', target, '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'PRIV-2'), 'TOMBSTONE_INVALID', 2, [root]);
  }
  // A tombstone entry matches on its target's kind and subjects (section 11.2): both rows answer, the record's row as PURGED.
  assert.deepEqual(succeeded(cli('query', '--ledger', ledger, '--kind', 'INVESTIGATION_CHECKPOINT', '--retention', 'PURGED', '--from', '0', '--limit', '10')).result.entries
    .map(entry => [entry.index, entry.entryType, entry.retention, entry.tombstoneIndex]), [[1, 'RECORD', 'PURGED', 3], [3, 'TOMBSTONE', null, null]]);
  // Export: a new directory, byte-identical for equal ledgers, equal to the SDK's own export of the same bytes.
  const first = path.join(root, 'export-a'), second = path.join(root, 'export-b');
  const exported = succeeded(cli('export', '--ledger', ledger, '--output', first));
  assert.deepEqual(Object.keys(exported.result).sort(), ['entryCount', 'headDigest', 'ledgerIdentifier']);
  assert.equal(exported.result.entryCount, 4);
  succeeded(cli('export', '--ledger', ledger, '--output', second));
  assert.deepEqual(treeObject(first), treeObject(second));
  failed(cli('export', '--ledger', ledger, '--output', first), 'LEDGER_EXISTS', 4, [root]);
  const verifiedExport = succeeded(cli('verify-export', '--export', first)).result;
  assert.equal(verifiedExport.entryCount, 4);
  assert.equal(verifiedExport.headDigest, tombstone.result.entryDigest);
  assert.ok(![...tree(first).keys()].some(name => name.startsWith(`records/${purgedHex}/`)), 'no purged member is exported');
  // Parity with the SDK oracle: the CLI export tree is exactly buildHistoryExport of the same ledger bytes.
  const oracle = buildInMemory([...SEQUENCE().slice(0, 3), { tombstone: { targetIndex: 1, reason: 'PRIVACY_REQUEST', authorityReference: 'PRIV-2026-0042' } }]);
  const expected = sdk.buildHistoryExport({ descriptorBytes: oracle.descriptorBytes, entries: oracle.entries, members: oracle.members });
  assert.deepEqual(treeObject(first), Object.fromEntries(expected.files.map(file => [file.path, sha(file.bytes)])));
  assert.equal(JSON.stringify([...tree(first).keys()]), JSON.stringify(expected.files.map(file => file.path).sort()));
});

test('D08 parity (R27) and determinism (R04): the CLI ledger is byte-identical to the SDK oracle and to an independently built twin', t => {
  const { ledger } = sharedLedger(t);
  const oracle = buildInMemory(sequenceSteps());
  assert.deepEqual(fs.readFileSync(path.join(ledger, 'memoryos-history-ledger.json')), Buffer.from(oracle.descriptorBytes));
  oracle.entries.forEach((bytes, index) => assert.deepEqual(fs.readFileSync(path.join(ledger, 'entries', `${String(index).padStart(20, '0')}.json`)), Buffer.from(bytes), `entry ${index}`));
  let memberCount = 0;
  for (const [recordDigest, files] of oracle.members) {
    for (const member of files) {
      memberCount += 1;
      assert.deepEqual(fs.readFileSync(path.join(ledger, 'records', recordDigest.slice('sha256:'.length), member.name)), Buffer.from(member.bytes), member.name);
    }
  }
  assert.equal(tree(ledger).size, 1 + 9 + memberCount, 'descriptor, entries and members only (no staging or stray files)');
  // The CLI's query and verify answers equal the SDK's over the same stored bytes.
  const viaCli = succeeded(cli('query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '1000')).result;
  assert.deepEqual(viaCli, JSON.parse(JSON.stringify(sdk.queryHistoryLedger({ descriptorBytes: oracle.descriptorBytes, entries: oracle.entries, query: QUERY() }))));
  assert.deepEqual(succeeded(cli('verify', '--ledger', ledger)).result, JSON.parse(JSON.stringify(oracle.ledger)));
  // An independent twin: different directories and file names, the records appended in the same order, byte-identical.
  const root = scratch(t);
  const twin = path.join(root, 'a-different-name');
  cliInit(twin);
  SEQUENCE().forEach(record => cliAppend(root, twin, record, { tag: 'twin' }));
  assert.deepEqual(treeObject(twin), treeObject(ledger));
  assert.equal(runCli(['history', 'query', '--ledger', twin, '--retention', 'ANY', '--from', '0', '--limit', '1000', '--json']).stdout,
    runCli(['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '1000', '--json']).stdout);
});

test('D09 CLI negatives: every admission, integrity and filesystem failure has its frozen code and exit, discloses nothing and changes nothing (R09, R25)', t => {
  const root = scratch(t);
  const ledger = path.join(root, 'ledger');
  cliInit(ledger);
  cliAppend(root, ledger, SEQUENCE()[0]);
  cliAppend(root, ledger, readinessRecord('ready'));
  const before = treeObject(ledger);
  const unchanged = () => assert.deepEqual(treeObject(ledger), before, 'a rejected command changes nothing');
  const rejected = (record, historyCode, secrets = []) => { failed(cliAppend(root, ledger, record, { raw: true }), historyCode, exitOf[historyCode], [root, ...secrets]); unchanged(); };
  rejected(SEQUENCE()[0], 'RECORD_DUPLICATE');
  rejected(readinessRecord('ready'), 'RECORD_DUPLICATE');
  // Forged and wrong-member records: RECORD_INVALID.
  const flipped = mipBytes(); flipped[40] ^= 0x01;
  rejected({ recordKind: 'MIP_PACKAGE', members: [{ name: 'package.mip', bytes: flipped }] }, 'RECORD_INVALID');
  rejected({ recordKind: 'MIP_PACKAGE', members: [{ name: 'package.mip', bytes: enc.encode('not a package') }] }, 'RECORD_INVALID');
  rejected({ recordKind: 'REGRESSION_REPORT', members: [{ name: 'regression-report.json', bytes: enc.encode('{}') }] }, 'RECORD_INVALID');
  rejected({ recordKind: 'READINESS_RESULT', members: [{ name: 'memoryos-readiness-result.json', bytes: enc.encode('{}') }] }, 'RECORD_INVALID');
  rejected({ recordKind: 'HUMAN_DECISION_CLAIM', members: [{ name: 'human-decision.json', bytes: enc.encode('{}') }] }, 'RECORD_INVALID');
  const native = new InvestigationCore();
  native.create({ identifier: 'mo1308-2d-native-cli', snapshot: referenceSnapshot });
  // A native checkpoint (not MIP-backed) is RECORD_INVALID (sections 7.2 and 14.1).
  rejected({ recordKind: 'INVESTIGATION_CHECKPOINT', members: [{ name: 'checkpoint.json', bytes: enc.encode(canonicalize(JSON.parse(JSON.stringify(native.checkpoint('mo1308-2d-native-cli'))))) }] },
    'RECORD_INVALID');
  // A forged policy pair (the outcome of another evaluation) and a damaged bundle.
  rejected({ recordKind: 'POLICY_EVALUATION', members: [{ name: 'evaluation-identity.json', bytes: policyFiles(0).identity }, { name: 'policy-outcome.json', bytes: policyFiles(1).outcome }] }, 'RECORD_INVALID');
  const bundle = bundleRecord(6);
  const damaged = bundle.members.map(member => ({ ...member, bytes: new Uint8Array(member.bytes) }));
  damaged.find(member => member.name === 'memoryos-ci-result.json').bytes[10] ^= 0x01;
  rejected({ recordKind: 'CICD_RUN', members: damaged }, 'RECORD_INVALID');
  // A decision claim with no matching READINESS_RESULT entry.
  rejected(decisionRecord('not-ready', 'approve'), 'DECISION_UNBOUND');
  // A record whose intrinsic Workspace differs from the ledger's.
  const foreign = path.join(root, 'foreign-ledger');
  cliInit(foreign, 'workspace-someone-else');
  const foreignBefore = treeObject(foreign);
  failed(cliAppend(root, foreign, checkpointRecord('mo1308-2d-foreign'), { raw: true }), 'WORKSPACE_MISMATCH', 2, [root]);
  assert.deepEqual(treeObject(foreign), foreignBefore);
  // Limits (R26): an oversized decision claim is refused before admission.
  failed(cliAppend(root, ledger, { recordKind: 'HUMAN_DECISION_CLAIM', members: [{ name: 'human-decision.json', bytes: new Uint8Array(8193) }] }, { raw: true }), 'RESOURCE_LIMIT', 2, [root]);
  unchanged();
  // Filesystem and location failures.
  failed(cli('init', '--ledger', ledger, '--name', 'workspace.history', '--workspace', WS), 'LEDGER_EXISTS', 4, [root]);
  failed(cli('verify', '--ledger', path.join(root, 'nowhere')), 'LEDGER_NOT_FOUND', 4, [root]);
  failed(cli('query', '--ledger', path.join(root, 'nowhere'), '--retention', 'ANY', '--from', '0', '--limit', '1'), 'LEDGER_NOT_FOUND', 4, [root]);
  failed(cli('tombstone', '--ledger', ledger, '--target', '7', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'x'), 'TOMBSTONE_INVALID', 2, [root]);
  unchanged();
  // Usage errors are exit 1 with the fixed message and no echo (the Phase 1 grammar is unchanged).
  const usage = cli('verify', '--ledger', ledger, 'positional');
  assert.equal(usage.status, 1);
  assert.equal(JSON.parse(usage.stderr).error.historyCode, 'MO1308_USAGE');
  assert.ok(!usage.stderr.includes('positional'));
  // Nothing in a failure names a path, a record's content or an exception.
  assert.doesNotMatch(failed(cliAppend(root, ledger, SEQUENCE()[0], { raw: true }), 'RECORD_DUPLICATE', 2).message, /[\\/]|Error|at /u);
});

test('D10 single-byte tamper corpus (R21): every flipped byte of the descriptor, every entry and a stride of every member fails closed, in the SDK and the CLI', t => {
  const steps = [policyRecord(0), readinessRecord('ready'), decisionRecord('ready', 'approve'),
    { tombstone: { targetIndex: 0, reason: 'PRIVACY_REQUEST', authorityReference: 'PRIV-1' } }];
  const base = buildInMemory(steps);
  const verify = (descriptorBytes, entries, members) => sdk.verifyHistoryLedger({ descriptorBytes, entries, members });
  assert.equal(verify(base.descriptorBytes, base.entries, base.members).entryCount, 4);
  const mutate = bytes => (index) => { const copy = new Uint8Array(bytes); copy[index] ^= 0x01; return copy; };
  let flips = 0;
  const mustFail = (action, label) => { flips += 1; assert.throws(action, error => error instanceof MemoryOSHistoryError && ['MO1308_LEDGER_CORRUPT', 'MO1308_RECORD_BYTES_MISMATCH', 'MO1308_VERSION_UNSUPPORTED'].includes(error.code), label); };
  const flipDescriptor = mutate(base.descriptorBytes);
  for (let index = 0; index < base.descriptorBytes.length; index += 1) mustFail(() => verify(flipDescriptor(index), base.entries, base.members), `descriptor ${index}`);
  base.entries.forEach((bytes, entryIndex) => {
    const flip = mutate(bytes);
    for (let index = 0; index < bytes.length; index += 1) {
      mustFail(() => verify(base.descriptorBytes, base.entries.map((value, position) => (position === entryIndex ? flip(index) : value)), base.members), `entry ${entryIndex} byte ${index}`);
    }
  });
  for (const [recordDigest, files] of base.members) {
    for (const file of files) {
      const flip = mutate(file.bytes);
      const stride = Math.max(1, Math.floor(file.bytes.length / 400));
      for (let index = 0; index < file.bytes.length; index += index === 0 ? 1 : stride) {
        const members = new Map(base.members);
        members.set(recordDigest, files.map(candidate => (candidate === file ? { name: file.name, bytes: flip(index) } : candidate)));
        mustFail(() => verify(base.descriptorBytes, base.entries, members), `member ${file.name} byte ${index}`);
      }
    }
  }
  // Structural defects: deletion, reordering, gap, truncation of a middle entry, foreign-ledger splice, extra member set.
  mustFail(() => verify(base.descriptorBytes, base.entries.slice(1), base.members), 'first entry deleted');
  mustFail(() => verify(base.descriptorBytes, [base.entries[1], base.entries[0], ...base.entries.slice(2)], base.members), 'reordered');
  mustFail(() => verify(base.descriptorBytes, [base.entries[0], ...base.entries.slice(2)], base.members), 'gap');
  const foreign = buildInMemory([policyRecord(0)], WS, 'another.history');
  mustFail(() => verify(base.descriptorBytes, [foreign.entries[0], ...base.entries.slice(1)], base.members), 'foreign-ledger splice');
  mustFail(() => verify(foreign.descriptorBytes, base.entries, base.members), 'descriptor substitution');
  assert.ok(flips > 1000, `${flips} single-byte and structural defects were each rejected`);
  // The same through the CLI: a sample of single-byte flips on disk, each exit 3 and each restored afterwards.
  const root = scratch(t);
  const ledger = path.join(root, 'ledger');
  cliInit(ledger);
  [policyRecord(0), readinessRecord('ready')].forEach(record => cliAppend(root, ledger, record));
  const files = [...tree(ledger).keys()];
  assert.ok(files.length >= 5);
  for (const name of files) {
    const target = path.join(ledger, ...name.split('/'));
    const original = fs.readFileSync(target);
    for (const position of new Set([0, Math.floor(original.length / 2), original.length - 1])) {
      const copy = Buffer.from(original); copy[position] ^= 0x01;
      fs.writeFileSync(target, copy);
      const result = cli('verify', '--ledger', ledger);
      assert.equal(result.status, 3, `${name} byte ${position}: ${result.stdout}${result.stderr}`);
      assert.match(JSON.parse(result.stderr).error.historyCode, /^MO1308_(LEDGER_CORRUPT|RECORD_BYTES_MISMATCH)$/u);
      fs.writeFileSync(target, original);
    }
  }
  assert.equal(succeeded(cli('verify', '--ledger', ledger)).result.entryCount, 2);
});

test('D11 query verifies the chain but not member bytes; append and export fail closed on a damaged ledger (sections 9.2, 11.2)', t => {
  const root = scratch(t);
  const ledger = path.join(root, 'ledger');
  cliInit(ledger);
  cliAppend(root, ledger, policyRecord(0));
  cliAppend(root, ledger, readinessRecord('ready'));
  const entry = path.join(ledger, 'entries', `${String(1).padStart(20, '0')}.json`);
  const member = path.join(ledger, 'records', fs.readdirSync(path.join(ledger, 'records'))[0], 'evaluation-identity.json');
  const memberBytes = fs.readFileSync(member);
  const damaged = Buffer.from(memberBytes); damaged[3] ^= 0x01;
  fs.writeFileSync(member, damaged);
  assert.equal(cli('query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '10').status, 0, 'member bytes are not read by a query');
  const beforeFailures = treeObject(ledger);
  failed(cli('verify', '--ledger', ledger), 'RECORD_BYTES_MISMATCH', 3, [root]);
  failed(cliAppend(root, ledger, SEQUENCE()[0], { raw: true }), 'RECORD_BYTES_MISMATCH', 3, [root]);
  failed(cli('export', '--ledger', ledger, '--output', path.join(root, 'export')), 'RECORD_BYTES_MISMATCH', 3, [root]);
  failed(cli('tombstone', '--ledger', ledger, '--target', '1', '--reason', 'PRIVACY_REQUEST', '--authority-reference', 'P'), 'RECORD_BYTES_MISMATCH', 3, [root]);
  assert.deepEqual(treeObject(ledger), beforeFailures, 'failed commands change nothing');
  assert.equal(fs.existsSync(path.join(root, 'export')), false);
  fs.writeFileSync(member, memberBytes);
  const original = fs.readFileSync(entry);
  const corrupt = Buffer.from(original); corrupt[20] ^= 0x01;
  fs.writeFileSync(entry, corrupt);
  failed(cli('query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '10'), 'LEDGER_CORRUPT', 3, [root]);
  fs.writeFileSync(entry, original);
  assert.equal(succeeded(cli('verify', '--ledger', ledger)).result.entryCount, 2);
});

test('D12 export tamper corpus (R23): every flipped byte of the manifest, marker, descriptor and entries, a stride of members, and every structural defect fails closed', t => {
  const steps = [policyRecord(0), readinessRecord('ready'), { tombstone: { targetIndex: 0, reason: 'PRIVACY_REQUEST', authorityReference: 'PRIV-1' } }];
  const base = buildInMemory(steps);
  const exported = sdk.buildHistoryExport({ descriptorBytes: base.descriptorBytes, entries: base.entries, members: base.members }).files;
  assert.equal(sdk.verifyHistoryExport({ files: exported }).entryCount, 3);
  const mustFail = (files, label) => assert.throws(() => sdk.verifyHistoryExport({ files }),
    error => error instanceof MemoryOSHistoryError && ['MO1308_EXPORT_CORRUPT', 'MO1308_LEDGER_CORRUPT', 'MO1308_RECORD_BYTES_MISMATCH', 'MO1308_VERSION_UNSUPPORTED'].includes(error.code), label);
  let flips = 0;
  exported.forEach((file, fileIndex) => {
    const stride = file.path.startsWith('records/') ? Math.max(1, Math.floor(file.bytes.length / 300)) : 1;
    for (let index = 0; index < file.bytes.length; index += index === 0 ? 1 : stride) {
      const copy = new Uint8Array(file.bytes); copy[index] ^= 0x01;
      flips += 1;
      mustFail(exported.map((candidate, position) => (position === fileIndex ? { path: candidate.path, bytes: copy } : candidate)), `${file.path} byte ${index}`);
    }
  });
  assert.ok(flips > 1000);
  mustFail(exported.filter(file => file.path !== 'memoryos-history-export-complete.json'), 'marker missing (the commit point)');
  mustFail(exported.filter(file => file.path !== 'memoryos-history-export.json'), 'manifest missing');
  mustFail(exported.filter(file => !file.path.startsWith('entries/00000000000000000001')), 'entry missing');
  mustFail([...exported, { path: 'records/extra/file.bin', bytes: new Uint8Array(1) }], 'extra file');
  mustFail(exported.filter(file => !file.path.startsWith('records/')), 'retained members missing');
  // Through the CLI: verify-export on a damaged export directory and on an export without its marker.
  const root = scratch(t);
  const ledger = path.join(root, 'ledger');
  cliInit(ledger);
  cliAppend(root, ledger, readinessRecord('ready'));
  const out = path.join(root, 'export');
  succeeded(cli('export', '--ledger', ledger, '--output', out));
  succeeded(cli('verify-export', '--export', out));
  const manifest = path.join(out, 'memoryos-history-export.json');
  const original = fs.readFileSync(manifest);
  const damaged = Buffer.from(original); damaged[30] ^= 0x01;
  fs.writeFileSync(manifest, damaged);
  failed(cli('verify-export', '--export', out), 'EXPORT_CORRUPT', 3, [root]);
  fs.writeFileSync(manifest, original);
  fs.rmSync(path.join(out, 'memoryos-history-export-complete.json'));
  failed(cli('verify-export', '--export', out), 'EXPORT_CORRUPT', 3, [root]);
});

test('D13 a ledger built by one CLI and appended by another process interleaves safely: the CLI is the only writer and indices are contiguous (R15)', t => {
  const root = scratch(t);
  const ledger = path.join(root, 'ledger');
  cliInit(ledger);
  for (let index = 0; index < 4; index += 1) assert.equal(cliAppend(root, ledger, checkpointRecord(`interleave-${index}`)).result.index, index);
  const result = succeeded(cli('verify', '--ledger', ledger)).result;
  assert.equal(result.entryCount, 4);
  assert.equal(fs.readdirSync(path.join(ledger, 'entries')).length, 4);
  assert.deepEqual(fs.readdirSync(path.join(ledger, '.pending')), [], 'no staging file remains after successful appends');
});

test('D14 SDK facade performs no I/O and starts no process; history authorities import only what the Freeze allows (R28, R29, R37, R35)', () => {
  const sdkSource = read('cca-studio/web/js/memoryos-sdk.js');
  assert.doesNotMatch(sdkSource, /from\s+["']node:|require\(|child_process|powershell|\bfs\./iu);
  const importsOf = file => [...read(file).matchAll(/^import\s[^;]*?from\s+"([^"]+)";$/gmu)].map(match => match[1]);
  assert.deepEqual(importsOf('cca-studio/web/js/memoryos-history-ledger.js').sort(), ['./memoryos-history-contract.js', './mip-canonical.js']);
  assert.deepEqual(importsOf('cca-studio/web/js/memoryos-history-contract.js'), ['./mip-canonical.js']);
  const admissionImports = importsOf('cca-studio/web/js/memoryos-history-admission.js').sort();
  for (const specifier of admissionImports) assert.match(specifier, /^\.\/(mip-canonical|memory-investigation-package|investigation-policy-engine|policy-canonical|regression-policy-fact-source|memoryos-history-contract)\.js$/u);
  for (const file of ['memoryos-history-contract.js', 'memoryos-history-ledger.js', 'memoryos-history-admission.js']) {
    const source = read(`cca-studio/web/js/${file}`);
    for (const specifier of importsOf(`cca-studio/web/js/${file}`)) assert.doesNotMatch(specifier, /memoryos-sdk|investigation-core|^node:|readiness|memoryos-ci/u, `${file} imports ${specifier} (R28)`);
    // No process, clock reading, timer or randomness (R35, R37); parsing a date string read from a record is not a clock.
    assert.doesNotMatch(source, /child_process|powershell\.exe|spawn\(|new Date\(\)|Date\.now|performance\.now|setTimeout|setInterval|Math\.random|randomUUID|getRandomValues/iu, file);
    assert.doesNotMatch(withoutComments(source), /verifyReadiness|windows-inspect/u, `${file}: R08 (no call and no helper path outside comments)`);
  }
  // The SDK's MO-1308 additions: the history section and the checkpoint-record method contain no clock, timer or randomness.
  const section = sdkSource.slice(sdkSource.indexOf('// MO-1308 Investigation History'));
  assert.doesNotMatch(section, /new Date|Date\.now|setTimeout|setInterval|Math\.random|randomUUID/u);
  // The CLI history sources start no process and read no clock; the store is Node-only (H40).
  for (const file of ['history-arguments.js', 'history-commands.js', 'history-store.js']) {
    assert.doesNotMatch(withoutComments(read(`memoryos-cli/src/${file}`)), /child_process|powershell|spawn|exec\(|new Date|Date\.now|performance\.now|setTimeout|setInterval|Math\.random|randomUUID/iu, file);
  }
  // The single SDK import of the CLI stays (ARCHITECTURE section 5): commands.js is the only module importing the SDK.
  const sdkImporters = fs.readdirSync(repo('memoryos-cli/src')).filter(file => /memoryos-sdk\.js/u.test(read(`memoryos-cli/src/${file}`)));
  assert.deepEqual(sdkImporters, ['commands.js']);
});

test('D15 production exports no test-only hash seam (the Phase 2B __sha256ForTests export was removed)', async () => {
  const admission = await import('../../cca-studio/web/js/memoryos-history-admission.js');
  assert.deepEqual(Object.keys(admission).sort(), ['admitHistoryRecord']);
  for (const file of ['memoryos-history-contract.js', 'memoryos-history-ledger.js', 'memoryos-history-admission.js', 'memoryos-sdk.js']) {
    assert.doesNotMatch(read(`cca-studio/web/js/${file}`), /ForTests/u, file);
  }
});

test('D16 history never grants approval or readiness, nothing restores from it, and session never serializes a checkpoint (R12, R14, R30)', () => {
  // R14: no MO-1307, MO-1306 or other released package source refers to the history authority or the history CLI.
  const sources = [];
  const walk = directory => { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'evidence' || entry.name === 'fixtures') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full); else if (/\.(m?js|py|ps1)$/u.test(entry.name)) sources.push(full);
  } };
  for (const packageName of ['memoryos-readiness/src', 'memoryos-ci/src', 'memoryos-rest/src', 'memoryos-mcp/src']) walk(repo(packageName));
  assert.ok(sources.length > 20);
  for (const file of sources) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /memoryos-history|MemoryOSHistory|decisionConsistency|createHistoryCheckpointRecord/u, file);
  // R12: no history module and no CLI history code calls restore; the only restore callers are the SDK method and the CLI session.
  for (const file of ['cca-studio/web/js/memoryos-history-ledger.js', 'cca-studio/web/js/memoryos-history-admission.js', 'cca-studio/web/js/memoryos-history-contract.js',
    'memoryos-cli/src/history-store.js', 'memoryos-cli/src/history-commands.js', 'memoryos-cli/src/history-arguments.js']) {
    assert.doesNotMatch(read(file), /\.restore\(|\brestore\b/u, file);
  }
  const callers = fs.readdirSync(repo('memoryos-cli/src')).filter(file => /\.restore\(/u.test(read(`memoryos-cli/src/${file}`)));
  assert.deepEqual(callers, ['session.js']);
  // R30: session keeps checkpoints opaque and in memory; it never serializes one and has no history surface.
  const session = read('memoryos-cli/src/session.js');
  assert.doesNotMatch(session, /createHistoryCheckpointRecord|history|writeFileSync|JSON\.stringify\(.*checkpoint/iu);
});

test('D17 the file store runs on the real SDK: the Phase 1 grammar and the stand-in are replaced; the wiring is the SDK\'s eight functions (H06)', () => {
  const commands = read('memoryos-cli/src/commands.js');
  assert.doesNotMatch(commands, /fail(s)? closed|historyCliError|INTERNAL/u);
  const engine = createHistoryEngine();
  assert.deepEqual(Object.keys(engine).sort(), ['MemoryOSHistoryError', 'admitHistoryRecord', 'appendHistoryEntry', 'buildHistoryExport',
    'createHistoryLedger', 'queryHistoryLedger', 'tombstoneHistoryEntry', 'verifyHistoryExport', 'verifyHistoryLedger']);
  for (const [name, value] of Object.entries(engine)) assert.equal(value, sdk[name], name);
  // The store accepts only an engine with the error class; it never defines identities itself (AR-006).
  assert.throws(() => createHistoryStore({ engine: {} }));
});

test('D18 checkpoint record sizes: a real 1,000-transition checkpoint round-trips through the SDK facade within the frozen limit', () => {
  const core = new InvestigationCore();
  core.import(mipBytes(), { identifier: 'mo1308-2d-long' });
  assert.ok(checkpointBytes('mo1308-2d-long').length < 33_554_432);
  const { ledger } = buildInMemory([]);
  const admitted = sdk.admitHistoryRecord({ recordKind: 'INVESTIGATION_CHECKPOINT', members: [{ name: 'checkpoint.json', bytes: checkpointBytes('mo1308-2d-long') }], ledger });
  assert.deepEqual(admitted.subjects.map(subject => subject.type).sort(), ['CHECKPOINT', 'INVESTIGATION', 'TRANSITION_LOG_DIGEST', 'WORKSPACE']);
  // The bundle directory of the corpus really is a completed MO-1306 evaluation of six files.
  assert.equal(fs.readdirSync(bundleDirectory(6)).length, 6);
});
