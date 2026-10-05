import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as ledgerModule from '../../cca-studio/web/js/memoryos-history-ledger.js';
import { MemoryOSHistoryError } from '../../cca-studio/web/js/memoryos-history-contract.js';

// MO-1308 Contract Freeze 1, Stream 2A: ledger core (identities, chain, verify, query, export model).
// Identities are checked against an independent oracle (node:crypto and a local canonical
// serializer), never against the module under test.
const {
  appendHistoryEntry, buildHistoryExport, createHistoryLedger, historyLedgerEntries, isVerifiedHistoryLedger,
  queryHistoryLedger, tombstoneHistoryEntry, verifyHistoryExport, verifyHistoryLedger,
} = ledgerModule;

const enc = new TextEncoder();
const dec = new TextDecoder();
const sha = bytes => 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
// Independent JCS for the closed value domain used here (ASCII keys, integers, strings, arrays, null, booleans).
const jcs = value => {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(jcs).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + jcs(value[key])).join(',') + '}';
};
const D = (domain, ...parts) => {
  const chunks = [enc.encode('MIP-1'), Buffer.from([0]), enc.encode(domain)];
  for (const part of parts) chunks.push(Buffer.from([0]), typeof part === 'string' ? enc.encode(part) : part);
  return sha(Buffer.concat(chunks));
};
const code = (expected, stage) => error => error instanceof MemoryOSHistoryError && error.code === `MO1308_${expected}`
  && (stage === undefined || error.stage === stage);

const WORKSPACE = 'workspace-investigation';
const NAME = 'workspace.history';
const MEMBER_BYTES = { 'package.mip': 2048, 'checkpoint.json': 900, 'regression-report.json': 700, 'human-decision.json': 300,
  'memoryos-readiness-result.json': 1200, 'evaluation-identity.json': 400, 'policy-outcome.json': 410 };

// Oracle-side record builder: members -> record object of a RECORD entry.
function recordOf(recordKind, memberBytes, subjects, workspaceAssociation, admission, decisionConsistency = null) {
  const members = Object.keys(memberBytes).sort().map(name => ({ name, byteLength: memberBytes[name].length, sha256: sha(memberBytes[name]) }));
  return { recordKind, recordDigest: D('MEMORYOS-HISTORY-RECORD-1.0', recordKind, jcs(members)), admission, members, workspaceAssociation, decisionConsistency,
    subjects: [...subjects].sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : a.value < b.value ? -1 : 1)) };
}
const bytesOf = text => enc.encode(text);
const mip = (tag, workspace = WORKSPACE) => {
  const memberBytes = { 'package.mip': bytesOf('MIP-package-' + tag) };
  return { memberBytes, record: recordOf('MIP_PACKAGE', memberBytes, [
    { type: 'MIP_PACKAGE_DIGEST', value: sha(memberBytes['package.mip']) }, { type: 'MIP_PACKAGE_IDENTIFIER', value: 'pkg-' + tag },
    { type: 'WORKSPACE', value: workspace }], 'INTRINSIC', 'MIP_001_VERIFIED') };
};
const readiness = tag => {
  const memberBytes = { 'memoryos-readiness-result.json': bytesOf('readiness-' + tag) };
  return { memberBytes, record: recordOf('READINESS_RESULT', memberBytes, [
    { type: 'PROOF_BINDING_DIGEST', value: sha(bytesOf('p' + tag)) }, { type: 'READINESS_CANDIDATE_DIGEST', value: sha(bytesOf('c' + tag)) },
    { type: 'READINESS_DIGEST', value: sha(bytesOf('r' + tag)) }], 'DECLARED', 'MO1307_SELF_DIGESTS_RECOMPUTED') };
};
const decision = (tag, consistency = 'CONSISTENT', variant = '') => {
  const memberBytes = { 'human-decision.json': bytesOf('decision-' + tag + variant) };
  return { memberBytes, record: recordOf('HUMAN_DECISION_CLAIM', memberBytes, [
    { type: 'PROOF_BINDING_DIGEST', value: sha(bytesOf('p' + tag)) }, { type: 'READINESS_CANDIDATE_DIGEST', value: sha(bytesOf('c' + tag)) },
    { type: 'READINESS_DIGEST', value: sha(bytesOf('r' + tag)) }], 'DECLARED', 'MO1307_DECISION_CLAIM_BOUND', consistency) };
};
const policy = tag => {
  const memberBytes = { 'evaluation-identity.json': bytesOf('identity-' + tag), 'policy-outcome.json': bytesOf('outcome-' + tag) };
  return { memberBytes, record: recordOf('POLICY_EVALUATION', memberBytes, [
    { type: 'EVALUATION_IDENTITY_DIGEST', value: sha(bytesOf('e' + tag)) }, { type: 'OUTCOME_DIGEST', value: sha(bytesOf('o' + tag)) }],
  'DECLARED', 'SDK_POLICY_ARTIFACTS_VERIFIED') };
};

// A small ledger driver mirroring what a store does: verify, append, repeat.
class Driver {
  constructor(workspace = WORKSPACE, name = NAME) {
    const created = createHistoryLedger({ ledgerName: name, workspaceIdentifier: workspace });
    this.descriptorBytes = created.descriptorBytes;
    this.ledgerIdentifier = created.ledgerIdentifier;
    this.entries = [];
    this.members = new Map();
  }
  ledger() { return verifyHistoryLedger({ descriptorBytes: this.descriptorBytes, entries: this.entries, members: this.members }); }
  add({ memberBytes, record }) {
    const result = appendHistoryEntry({ ledger: this.ledger(), admission: record });
    this.entries.push(result.entryBytes);
    this.members.set(record.recordDigest, Object.keys(memberBytes).sort().map(name => ({ name, bytes: memberBytes[name] })));
    return result;
  }
  tombstone(targetIndex, reason = 'PRIVACY_REQUEST', authorityReference = 'PRIV-2026-0042', { purge = true } = {}) {
    const target = JSON.parse(dec.decode(this.entries[targetIndex]));
    const result = tombstoneHistoryEntry({ ledger: this.ledger(), targetIndex, reason, authorityReference });
    this.entries.push(result.entryBytes);
    if (purge) this.members.delete(target.record.recordDigest);
    return result;
  }
  input() { return { descriptorBytes: this.descriptorBytes, entries: this.entries, members: this.members }; }
  query(overrides = {}) {
    return queryHistoryLedger({ descriptorBytes: this.descriptorBytes, entries: this.entries,
      query: { kind: 'MemoryOSHistoryQuery', version: '1.0.0', recordKinds: [], subject: null, retention: 'ANY', fromIndex: 0, limit: 1000, ...overrides } });
  }
}
function sampleLedger() {
  const driver = new Driver();
  driver.add(mip('a'));          // 0
  driver.add(policy('b'));       // 1
  driver.add(readiness('c'));    // 2
  driver.add(mip('d'));          // 3
  return driver;
}

test('L01 identities equal the independent oracle (R02 golden construction)', () => {
  const created = createHistoryLedger({ ledgerName: NAME, workspaceIdentifier: WORKSPACE });
  const descriptor = { kind: 'MemoryOSHistoryLedger', version: '1.0.0', ledgerName: NAME, workspaceIdentifier: WORKSPACE };
  assert.equal(dec.decode(created.descriptorBytes), jcs(descriptor));
  const ledgerIdentifier = D('MEMORYOS-HISTORY-LEDGER-1.0', jcs(descriptor));
  assert.equal(created.ledgerIdentifier, ledgerIdentifier);
  const driver = new Driver();
  const first = driver.add(mip('a'));
  const entry = JSON.parse(dec.decode(driver.entries[0]));
  assert.equal(entry.previousEntryDigest, D('MEMORYOS-HISTORY-GENESIS-1.0', ledgerIdentifier));
  const { entryDigest, ...rest } = entry;
  assert.equal(entryDigest, D('MEMORYOS-HISTORY-ENTRY-1.0', jcs(rest)));
  assert.equal(first.entryDigest, entryDigest);
  assert.equal(entry.record.recordDigest, mip('a').record.recordDigest);
  assert.equal(dec.decode(driver.entries[0]), jcs(entry), 'entry files are exact JCS bytes with no trailing LF');
  assert.equal(driver.ledger().headDigest, entryDigest);
});

test('L02 an empty ledger verifies with the genesis digest as head', () => {
  const driver = new Driver();
  const ledger = driver.ledger();
  assert.equal(ledger.entryCount, 0);
  assert.equal(ledger.headDigest, D('MEMORYOS-HISTORY-GENESIS-1.0', driver.ledgerIdentifier));
  assert.deepEqual(Object.keys(ledger), ['kind', 'version', 'ledgerIdentifier', 'workspaceIdentifier', 'entryCount', 'headDigest',
    'retainedRecords', 'purgedRecords', 'tombstones', 'purgePending', 'unreferencedRecords', 'pendingArtifacts']);
  assert.ok(isVerifiedHistoryLedger(ledger));
  assert.ok(Object.isFrozen(ledger));
  assert.equal(isVerifiedHistoryLedger({ ...ledger }), false, 'a copy of the public fields is not a verified ledger');
});

test('L03 entries are contiguous from 0 and chained by previousEntryDigest (R05)', () => {
  const driver = sampleLedger();
  const parsed = driver.entries.map(bytes => JSON.parse(dec.decode(bytes)));
  parsed.forEach((entry, index) => {
    assert.equal(entry.index, index);
    assert.equal(entry.previousEntryDigest, index === 0 ? D('MEMORYOS-HISTORY-GENESIS-1.0', driver.ledgerIdentifier) : parsed[index - 1].entryDigest);
    assert.equal(entry.ledgerIdentifier, driver.ledgerIdentifier);
  });
  const ledger = driver.ledger();
  assert.deepEqual([ledger.entryCount, ledger.retainedRecords, ledger.purgedRecords, ledger.tombstones], [4, 4, 0, 0]);
  assert.deepEqual(historyLedgerEntries(ledger).map(entry => entry.entryDigest), parsed.map(entry => entry.entryDigest));
  assert.ok(Object.isFrozen(historyLedgerEntries(ledger)[0]));
});

test('L04 equivalent appends are byte-identical regardless of volatile inputs (R04)', () => {
  const build = () => {
    const driver = new Driver();
    for (const item of [mip('a'), policy('b'), readiness('c')]) driver.add(item);
    return driver;
  };
  const one = build(), two = build();
  assert.deepEqual(one.entries.map(b => [...b]), two.entries.map(b => [...b]));
  assert.deepEqual([...one.descriptorBytes], [...two.descriptorBytes]);
  // Map insertion order of the retained members is not part of any output.
  const reordered = build();
  reordered.members = new Map([...reordered.members].reverse());
  assert.deepEqual({ ...reordered.ledger() }, { ...one.ledger() });
  assert.deepEqual(buildHistoryExport(reordered.input()).files.map(f => [f.path, [...f.bytes]]),
    buildHistoryExport(one.input()).files.map(f => [f.path, [...f.bytes]]));
  // Members must arrive name-sorted, as the admission authority emits them; a reversed list is not another ledger.
  const item = policy('b');
  const reversed = { ...item.record, members: [...item.record.members].reverse() };
  assert.throws(() => new Driver().add({ memberBytes: item.memberBytes, record: reversed }), code('RECORD_INVALID', 'ADMISSION'));
});

test('L05 append re-validates the admission record and enforces ledger rules', () => {
  const driver = sampleLedger();
  const ledger = driver.ledger();
  const fresh = mip('z').record;
  assert.throws(() => appendHistoryEntry({ ledger: { ...ledger }, admission: fresh }), code('USAGE'));
  assert.throws(() => appendHistoryEntry({ ledger, admission: { ...fresh, recordDigest: sha(bytesOf('forged')) } }), code('RECORD_INVALID', 'ADMISSION'));
  assert.throws(() => appendHistoryEntry({ ledger, admission: { ...fresh, extra: 1 } }), code('RECORD_INVALID', 'ADMISSION'));
  assert.throws(() => appendHistoryEntry({ ledger, admission: { ...fresh, admission: 'MO1307_SELF_DIGESTS_RECOMPUTED' } }), code('RECORD_INVALID', 'ADMISSION'));
  assert.throws(() => appendHistoryEntry({ ledger, admission: null }), code('RECORD_INVALID', 'ADMISSION'));
  assert.throws(() => appendHistoryEntry({ ledger, admission: mip('z', 'other-workspace').record }), code('WORKSPACE_MISMATCH', 'ADMISSION'));
  assert.throws(() => appendHistoryEntry({ ledger, admission: mip('a').record }), code('RECORD_DUPLICATE', 'ADMISSION'));
  assert.throws(() => appendHistoryEntry({ ledger, admission: mip('a').record, extra: 1 }), code('USAGE'));
  const accepted = appendHistoryEntry({ ledger, admission: fresh });
  assert.equal(accepted.index, 4);
  assert.equal(driver.entries.length, 4, 'a rejected or pure append never changes the ledger (R09)');
});

test('L06 tombstone lifecycle: governed entry, chain verifies after purge, purged content is never verified (R18, R19, R20)', () => {
  const driver = sampleLedger();
  const target = JSON.parse(dec.decode(driver.entries[0]));
  const result = driver.tombstone(0, 'LEGAL_REQUIREMENT', 'CASE-7');
  const entry = JSON.parse(dec.decode(result.entryBytes));
  assert.deepEqual(entry.tombstone, { targetIndex: 0, targetEntryDigest: target.entryDigest, targetRecordDigest: target.record.recordDigest,
    reason: 'LEGAL_REQUIREMENT', authorityReference: 'CASE-7', authenticity: 'NOT_VERIFIED_BY_MEMORYOS' });
  assert.equal(entry.entryType, 'TOMBSTONE');
  assert.equal(entry.record, null);
  const ledger = driver.ledger();
  assert.deepEqual([ledger.entryCount, ledger.retainedRecords, ledger.purgedRecords, ledger.tombstones], [5, 3, 1, 1]);
  assert.deepEqual(ledger.purgePending, []);
  // Re-supply of purged bytes is impossible (H23).
  assert.throws(() => appendHistoryEntry({ ledger, admission: mip('a').record }), code('RECORD_PURGED', 'ADMISSION'));
  // Tombstone rules: one per target, not a tombstone, target must exist.
  const again = { ledger, reason: 'PRIVACY_REQUEST', authorityReference: 'X' };
  assert.throws(() => tombstoneHistoryEntry({ ...again, targetIndex: 0 }), code('TOMBSTONE_INVALID'));
  assert.throws(() => tombstoneHistoryEntry({ ...again, targetIndex: 4 }), code('TOMBSTONE_INVALID'));
  assert.throws(() => tombstoneHistoryEntry({ ...again, targetIndex: 5 }), code('TOMBSTONE_INVALID'));
  assert.throws(() => tombstoneHistoryEntry({ ...again, targetIndex: 100000 }), code('USAGE'));
  assert.throws(() => tombstoneHistoryEntry({ ...again, targetIndex: 1, reason: 'EXPIRED' }), code('USAGE'));
  assert.throws(() => tombstoneHistoryEntry({ ...again, targetIndex: 1, authorityReference: 'é' }), code('USAGE'));
  assert.throws(() => tombstoneHistoryEntry({ ...again, targetIndex: 1, authorityReference: '' }), code('USAGE'));
});

test('L07 a crash during purge is reported as purgePending, and a completed purge is not', () => {
  const driver = sampleLedger();
  driver.tombstone(1, 'DATA_MINIMIZATION', 'DM-1', { purge: false }); // tombstone committed, members still present
  const pending = driver.ledger();
  assert.deepEqual(pending.purgePending, [1]);
  assert.equal(pending.purgedRecords, 1);
  driver.members.delete(JSON.parse(dec.decode(driver.entries[1])).record.recordDigest);
  assert.deepEqual(driver.ledger().purgePending, []);
});

test('L08 verify checks every retained member and recomputes record digests (R21)', () => {
  const driver = sampleLedger();
  const digest0 = JSON.parse(dec.decode(driver.entries[0])).record.recordDigest;
  const flipped = new Map(driver.members);
  const members = flipped.get(digest0).map(m => ({ ...m, bytes: new Uint8Array(m.bytes) }));
  members[0].bytes[0] ^= 1;
  flipped.set(digest0, members);
  assert.throws(() => verifyHistoryLedger({ ...driver.input(), members: flipped }), code('RECORD_BYTES_MISMATCH', 'VERIFICATION'));
  const shorter = new Map(driver.members);
  shorter.set(digest0, [{ name: 'package.mip', bytes: bytesOf('short') }]);
  assert.throws(() => verifyHistoryLedger({ ...driver.input(), members: shorter }), code('RECORD_BYTES_MISMATCH'));
  const missing = new Map(driver.members);
  missing.delete(digest0);
  assert.throws(() => verifyHistoryLedger({ ...driver.input(), members: missing }), code('RECORD_BYTES_MISMATCH'));
  const extra = new Map(driver.members);
  extra.set(digest0, [...driver.members.get(digest0), { name: 'checkpoint.json', bytes: bytesOf('x') }]);
  assert.throws(() => verifyHistoryLedger({ ...driver.input(), members: extra }), code('RECORD_BYTES_MISMATCH'));
  const unreferenced = new Map(driver.members);
  const orphan = sha(bytesOf('orphan'));
  unreferenced.set(orphan, [{ name: 'package.mip', bytes: bytesOf('orphan') }]);
  assert.deepEqual(verifyHistoryLedger({ ...driver.input(), members: unreferenced }).unreferencedRecords, [orphan]);
});

test('L09 tamper corpus: a single-byte flip anywhere in the descriptor or any entry fails closed (R21)', () => {
  const driver = new Driver();
  driver.add(mip('a'));
  driver.add(readiness('c'));
  driver.tombstone(0);
  const targets = [['descriptor', driver.descriptorBytes], ...driver.entries.map((bytes, index) => [`entry ${index}`, bytes])];
  let flips = 0;
  for (const [label, original] of targets) {
    for (let position = 0; position < original.length; position += 1) {
      const mutated = new Uint8Array(original);
      mutated[position] ^= 0x01;
      const input = label === 'descriptor' ? { ...driver.input(), descriptorBytes: mutated }
        : { ...driver.input(), entries: driver.entries.map((bytes, index) => (`entry ${index}` === label ? mutated : bytes)) };
      assert.throws(() => verifyHistoryLedger(input), error => error instanceof MemoryOSHistoryError && [3, 2].includes(error.exitCode),
        `${label} byte ${position}`);
      flips += 1;
    }
  }
  assert.ok(flips > 1500, `flips ${flips}`);
});

test('L10 structural tamper: deletion, reorder, gap, foreign splice, descriptor substitution, trailing LF', () => {
  const driver = sampleLedger();
  const base = driver.input();
  const fail = (overrides, expected = 'LEDGER_CORRUPT') => assert.throws(() => verifyHistoryLedger({ ...base, ...overrides }), code(expected));
  fail({ entries: [driver.entries[1], ...driver.entries.slice(1)] });                  // duplicate of index 1 at index 0
  fail({ entries: driver.entries.slice(1) });                                          // first entry deleted
  fail({ entries: [driver.entries[0], driver.entries[2], driver.entries[1], driver.entries[3]] }); // reordered
  fail({ entries: [driver.entries[0], driver.entries[1], driver.entries[3]] });        // gap
  fail({ entries: [...driver.entries, driver.entries[3]] });                           // extra duplicate file
  const other = new Driver(WORKSPACE, 'other.history');
  other.add(mip('a'));
  fail({ entries: [driver.entries[0], other.entries[0], ...driver.entries.slice(2)] });  // foreign-ledger splice
  fail({ descriptorBytes: other.descriptorBytes });                                    // descriptor substitution
  fail({ descriptorBytes: new Uint8Array([...driver.descriptorBytes, 10]) });          // trailing LF
  fail({ entries: [new Uint8Array([...driver.entries[0], 10]), ...driver.entries.slice(1)] });
  // Truncation to a shorter valid prefix still verifies: the head is the highest contiguous index (Freeze §9.1).
  assert.equal(verifyHistoryLedger({ ...base, entries: driver.entries.slice(0, 2), members: base.members }).entryCount, 2);
});

test('L11 tombstone targets are verified, not trusted', () => {
  const driver = sampleLedger();
  const sealed = tombstoneHistoryEntry({ ledger: driver.ledger(), targetIndex: 0, reason: 'PRIVACY_REQUEST', authorityReference: 'A' });
  const rebuild = (mutate) => {
    const entry = JSON.parse(dec.decode(sealed.entryBytes));
    mutate(entry);
    const { entryDigest, ...rest } = entry; // eslint-disable-line no-unused-vars
    entry.entryDigest = D('MEMORYOS-HISTORY-ENTRY-1.0', jcs(rest));
    return enc.encode(jcs(entry));
  };
  const members = new Map(driver.members);
  members.delete(JSON.parse(dec.decode(driver.entries[0])).record.recordDigest);
  const verify = bytes => verifyHistoryLedger({ ...driver.input(), entries: [...driver.entries, bytes], members });
  assert.equal(verify(sealed.entryBytes).tombstones, 1);
  assert.throws(() => verify(rebuild(e => { e.tombstone.targetEntryDigest = sha(bytesOf('x')); })), code('LEDGER_CORRUPT'));
  assert.throws(() => verify(rebuild(e => { e.tombstone.targetRecordDigest = sha(bytesOf('x')); })), code('LEDGER_CORRUPT'));
  assert.throws(() => verify(rebuild(e => { e.tombstone.targetIndex = 4; })), code('LEDGER_CORRUPT'));
  assert.throws(() => verifyHistoryLedger({ ...driver.input(), entries: [...driver.entries, sealed.entryBytes, rebuild(e => { e.index = 5; e.previousEntryDigest = JSON.parse(dec.decode(sealed.entryBytes)).entryDigest; })], members }), code('LEDGER_CORRUPT'));
});

test('L12 query: filters, order, retention, tombstone matching and pagination (R22)', () => {
  const driver = sampleLedger();
  driver.tombstone(0, 'PRIVACY_REQUEST', 'P-1');  // index 4
  const all = driver.query();
  assert.deepEqual(all.entries.map(e => e.index), [0, 1, 2, 3, 4]);
  assert.equal(all.nextIndex, null);
  assert.equal(all.entryCount, 5);
  assert.deepEqual(all.entries[0], { index: 0, entryDigest: all.entries[0].entryDigest, entryType: 'RECORD', recordKind: 'MIP_PACKAGE',
    recordDigest: mip('a').record.recordDigest, admission: 'MIP_001_VERIFIED', workspaceAssociation: 'INTRINSIC',
    subjects: mip('a').record.subjects, retention: 'PURGED', tombstoneIndex: 4, decisionConsistency: null });
  assert.deepEqual(all.entries[4], { index: 4, entryDigest: all.entries[4].entryDigest, entryType: 'TOMBSTONE', recordKind: null, recordDigest: null,
    admission: null, workspaceAssociation: null, subjects: [], retention: null, tombstoneIndex: null, decisionConsistency: null });
  assert.deepEqual(driver.query({ recordKinds: ['MIP_PACKAGE'] }).entries.map(e => e.index), [0, 3, 4], 'tombstones match on their target kind');
  assert.deepEqual(driver.query({ recordKinds: ['MIP_PACKAGE', 'READINESS_RESULT'] }).entries.map(e => e.index), [0, 2, 3, 4]);
  assert.deepEqual(driver.query({ retention: 'PURGED' }).entries.map(e => e.index), [0, 4]);
  assert.deepEqual(driver.query({ retention: 'RETAINED' }).entries.map(e => e.index), [1, 2, 3]);
  const subject = { type: 'MIP_PACKAGE_IDENTIFIER', value: 'pkg-a' };
  assert.deepEqual(driver.query({ subject }).entries.map(e => e.index), [0, 4], 'tombstones match on their target subjects');
  assert.deepEqual(driver.query({ subject: { type: 'WORKSPACE', value: 'other' } }).entries, []);
  const pageOne = driver.query({ limit: 2 });
  assert.deepEqual([pageOne.entries.map(e => e.index), pageOne.nextIndex], [[0, 1], 2]);
  const pageTwo = driver.query({ limit: 2, fromIndex: pageOne.nextIndex });
  assert.deepEqual([pageTwo.entries.map(e => e.index), pageTwo.nextIndex], [[2, 3], 4]);
  const pageThree = driver.query({ limit: 2, fromIndex: pageTwo.nextIndex });
  assert.deepEqual([pageThree.entries.map(e => e.index), pageThree.nextIndex], [[4], null]);
  assert.deepEqual(driver.query({ fromIndex: 99999 }).entries, []);
  assert.deepEqual(driver.query({ retention: 'RETAINED', recordKinds: ['MIP_PACKAGE'], limit: 1, fromIndex: 1 }).entries.map(e => e.index), [3]);
  assert.deepEqual(JSON.parse(JSON.stringify(all.query)), { kind: 'MemoryOSHistoryQuery', version: '1.0.0', recordKinds: [], subject: null,
    retention: 'ANY', fromIndex: 0, limit: 1000 });
});

test('L13 query verifies the chain before answering and rejects malformed queries (R22)', () => {
  const driver = sampleLedger();
  const corrupt = new Uint8Array(driver.entries[2]);
  corrupt[40] ^= 1;
  const call = (entries, query = {}) => queryHistoryLedger({ descriptorBytes: driver.descriptorBytes, entries,
    query: { kind: 'MemoryOSHistoryQuery', version: '1.0.0', recordKinds: [], subject: null, retention: 'ANY', fromIndex: 0, limit: 10, ...query } });
  assert.throws(() => call([driver.entries[0], driver.entries[1], corrupt, driver.entries[3]]), code('LEDGER_CORRUPT'));
  assert.throws(() => call(driver.entries, { limit: 0 }), code('QUERY_INVALID'));
  assert.throws(() => call(driver.entries, { limit: 1001 }), code('QUERY_INVALID'));
  assert.throws(() => call(driver.entries, { retention: 'ALL' }), code('QUERY_INVALID'));
  assert.throws(() => call(driver.entries, { recordKinds: ['MIP_PACKAGE', 'MIP_PACKAGE'] }), code('QUERY_INVALID'));
  assert.throws(() => call(driver.entries, { subject: { type: 'NOPE', value: 'x' } }), code('QUERY_INVALID'));
  assert.throws(() => queryHistoryLedger({ descriptorBytes: driver.descriptorBytes, entries: driver.entries }), code('USAGE'));
  // Member bytes are not needed, and not read, by a query (Freeze §11.2).
  assert.equal(call(driver.entries).entries.length, 4);
});

test('L14 decisionConsistency is stored at admission, returned by query without member bytes, and covered by the entry identity (Amendment A4.1)', () => {
  const driver = sampleLedger();                      // 0 mip, 1 policy, 2 readiness c, 3 mip
  driver.add(decision('c', 'CONTRARY_TO_READINESS')); // 4
  driver.add(decision('c', 'CONSISTENT', '-second'));  // 5 (the same readiness digests, different claim bytes)
  const all = driver.query();
  const stored = all.entries.filter(e => e.recordKind === 'HUMAN_DECISION_CLAIM');
  assert.deepEqual(stored.map(e => [e.index, e.decisionConsistency]), [[4, 'CONTRARY_TO_READINESS'], [5, 'CONSISTENT']]);
  assert.ok(all.entries.filter(e => e.recordKind !== 'HUMAN_DECISION_CLAIM').every(e => e.decisionConsistency === null));
  // The stored value is a member of the entry record, so the entry digest covers it.
  const entry = JSON.parse(dec.decode(driver.entries[4]));
  assert.equal(entry.record.decisionConsistency, 'CONTRARY_TO_READINESS');
  const { entryDigest, ...rest } = entry;
  assert.equal(entryDigest, D('MEMORYOS-HISTORY-ENTRY-1.0', jcs(rest)));
  const flipped = structuredClone(entry); flipped.record.decisionConsistency = 'CONSISTENT';
  assert.throws(() => verifyHistoryLedger({ ...driver.input(), entries: [...driver.entries.slice(0, 4), enc.encode(jcs(flipped)), driver.entries[5]] }), code('LEDGER_CORRUPT'));
  // A query needs no member bytes and never recomputes: it answers from entries alone.
  assert.equal(queryHistoryLedger({ descriptorBytes: driver.descriptorBytes, entries: driver.entries,
    query: { kind: 'MemoryOSHistoryQuery', version: '1.0.0', recordKinds: ['HUMAN_DECISION_CLAIM'], subject: null, retention: 'ANY', fromIndex: 0, limit: 10 } }).entries.length, 2);
  // The value survives a later purge of the claim and of the readiness result.
  driver.tombstone(4);
  driver.tombstone(2);
  const after = driver.query({ recordKinds: ['HUMAN_DECISION_CLAIM'] });
  assert.deepEqual(after.entries.map(e => [e.index, e.retention, e.decisionConsistency]), [[4, 'PURGED', 'CONTRARY_TO_READINESS'], [5, 'RETAINED', 'CONSISTENT'], [6, null, null]]);
  assert.equal(driver.ledger().entryCount, 8);
  // Tombstone entries never carry a value.
  assert.ok(driver.query().entries.filter(e => e.entryType === 'TOMBSTONE').every(e => e.decisionConsistency === null));
});

test('L14b a claim is rejected, never stored with a guessed value, when its readiness result is absent, purged or in another ledger (Amendment A4.1)', () => {
  const driver = sampleLedger();                      // readiness result "c" at index 2
  const before = driver.entries.length;
  const claim = decision('c', 'CONSISTENT');
  const ledger = driver.ledger();
  // Absent: digests that match no READINESS_RESULT entry.
  assert.throws(() => appendHistoryEntry({ ledger, admission: decision('zzz').record }), code('DECISION_UNBOUND', 'ADMISSION'));
  // Present only in another ledger (another Workspace): absent here.
  const other = new Driver('other-workspace', 'other.history');
  other.add(readiness('x'));
  assert.throws(() => appendHistoryEntry({ ledger, admission: decision('x').record }), code('DECISION_UNBOUND'));
  // A partially matching result does not bind.
  const partial = structuredClone(claim.record);
  partial.subjects = partial.subjects.map(s => (s.type === 'READINESS_DIGEST' ? { ...s, value: sha(bytesOf('other')) } : s)).sort((a, b) => (a.type < b.type ? -1 : 1));
  assert.throws(() => appendHistoryEntry({ ledger, admission: partial }), code('DECISION_UNBOUND'));
  // Purged: the referenced result's bytes are gone, so it cannot be re-verified and does not bind.
  driver.tombstone(2);
  assert.throws(() => appendHistoryEntry({ ledger: driver.ledger(), admission: claim.record }), code('DECISION_UNBOUND'));
  // A claim record without a stored value, or with an unknown value, is not a record at all.
  for (const value of [null, 'APPROVED', 'consistent']) {
    assert.throws(() => appendHistoryEntry({ ledger: sampleLedger().ledger(), admission: { ...claim.record, decisionConsistency: value } }), code('RECORD_INVALID', 'ADMISSION'), String(value));
  }
  // A value on a record that is not a claim is rejected.
  assert.throws(() => appendHistoryEntry({ ledger, admission: { ...mip('q').record, decisionConsistency: 'CONSISTENT' } }), code('RECORD_INVALID'));
  assert.equal(driver.entries.length, before + 1, 'only the tombstone was added: no claim entry exists');
  assert.equal(driver.query({ recordKinds: ['HUMAN_DECISION_CLAIM'] }).entries.length, 0);
});

test('L14c historyLedgerView gives admission the Workspace, the entries and only retained readiness bytes (Amendment A4.1)', () => {
  const driver = sampleLedger();
  const view = ledgerModule.historyLedgerView(driver.ledger());
  assert.equal(view.workspaceIdentifier, WORKSPACE);
  assert.equal(view.entries.length, 4);
  const readinessDigest = JSON.parse(dec.decode(driver.entries[2])).record.recordDigest;
  assert.deepEqual([...view.members.keys()], [readinessDigest]);
  assert.deepEqual(new Uint8Array(view.members.get(readinessDigest)[0].bytes), readiness('c').memberBytes['memoryos-readiness-result.json']);
  const original = driver.members.get(readinessDigest)[0].bytes;
  original[0] ^= 1; // mutating the caller's array afterwards must not change the snapshot
  assert.notEqual(view.members.get(readinessDigest)[0].bytes[0], original[0], 'the view holds a snapshot');
  original[0] ^= 1;
  driver.tombstone(2);
  assert.equal(ledgerModule.historyLedgerView(driver.ledger()).members.size, 0, 'a purged result has no bytes');
});

test('L15 export is complete, deterministic and verifiable (R23)', () => {
  const driver = sampleLedger();
  driver.tombstone(0);
  const first = buildHistoryExport(driver.input());
  const second = buildHistoryExport({ ...driver.input(), members: new Map([...driver.members].reverse()) });
  assert.deepEqual(first.files.map(f => [f.path, [...f.bytes]]), second.files.map(f => [f.path, [...f.bytes]]), 'byte-identical for equal ledgers');
  const paths = first.files.map(f => f.path);
  assert.deepEqual(paths, [...paths].sort(), 'path order');
  assert.ok(paths.includes('memoryos-history-export.json') && paths.includes('memoryos-history-export-complete.json'));
  assert.ok(paths.includes('memoryos-history-ledger.json'));
  assert.equal(paths.filter(p => p.startsWith('entries/')).length, 5);
  const purgedHex = mip('a').record.recordDigest.slice(7);
  assert.equal(paths.some(p => p.includes(purgedHex)), false, 'a purged record exports no member bytes (H22)');
  assert.equal(paths.filter(p => p.startsWith('records/')).length, 4);
  const byPath = new Map(first.files.map(f => [f.path, f.bytes]));
  const manifest = JSON.parse(dec.decode(byPath.get('memoryos-history-export.json')));
  assert.equal(manifest.entryCount, 5);
  assert.deepEqual(manifest.files.map(f => f.path), paths.filter(p => !p.startsWith('memoryos-history-export')), 'manifest excludes the two export files');
  assert.equal(JSON.parse(dec.decode(byPath.get('memoryos-history-export-complete.json'))).manifestSha256, sha(byPath.get('memoryos-history-export.json')));
  assert.equal(dec.decode(byPath.get('memoryos-history-export.json')), jcs(manifest));
  const verified = verifyHistoryExport({ files: first.files.map(f => ({ path: f.path, bytes: f.bytes })) });
  assert.deepEqual(
    { ...verified },
    { ...driver.ledger() },
  );
  assert.equal(Object.isFrozen(first.files[0]), true);
});

test('L16 verify-export fails closed on every single-byte flip, missing, extra and reordered file (R23)', () => {
  const driver = new Driver();
  driver.add(mip('a'));
  driver.add(readiness('c'));
  driver.tombstone(0);
  const exported = buildHistoryExport(driver.input()).files.map(f => ({ path: f.path, bytes: f.bytes }));
  assert.equal(verifyHistoryExport({ files: exported }).entryCount, 3);
  let flips = 0;
  for (const [fileIndex, file] of exported.entries()) {
    for (let position = 0; position < file.bytes.length; position += 1) {
      const mutated = new Uint8Array(file.bytes);
      mutated[position] ^= 0x01;
      const files = exported.map((other, index) => (index === fileIndex ? { path: other.path, bytes: mutated } : other));
      assert.throws(() => verifyHistoryExport({ files }), error => error instanceof MemoryOSHistoryError && error.exitCode === 3, `${file.path} byte ${position}`);
      flips += 1;
    }
  }
  assert.ok(flips > 2000, `flips ${flips}`);
  const fail = (files, expected = 'EXPORT_CORRUPT') => assert.throws(() => verifyHistoryExport({ files }), code(expected));
  fail(exported.filter(f => f.path !== 'memoryos-history-export-complete.json'));
  fail(exported.filter(f => f.path !== 'memoryos-history-export.json'));
  fail(exported.filter(f => f.path !== 'memoryos-history-ledger.json'));
  fail(exported.filter(f => !f.path.startsWith('entries/00000000000000000001')));
  fail([...exported, { path: 'entries/00000000000000000009.json', bytes: bytesOf('{}') }]);
  fail([...exported, exported[0]]);
  fail([]);
});

test('L17 verify-export keeps section 11.1 codes for a consistent manifest over corrupt content', () => {
  const driver = sampleLedger();
  const exported = buildHistoryExport(driver.input()).files;
  const forge = (mutate) => {
    const files = new Map(exported.map(f => [f.path, f.bytes]));
    const entries = [...files.keys()].filter(p => p.startsWith('entries/'));
    mutate(files, entries);
    const listed = [...files.keys()].filter(p => !p.startsWith('memoryos-history-export')).sort();
    const manifest = JSON.parse(dec.decode(files.get('memoryos-history-export.json')));
    manifest.files = listed.map(path => ({ path, byteLength: files.get(path).length, sha256: sha(files.get(path)) }));
    const manifestBytes = enc.encode(jcs(manifest));
    files.set('memoryos-history-export.json', manifestBytes);
    files.set('memoryos-history-export-complete.json', enc.encode(jcs({ kind: 'MemoryOSHistoryExportComplete', version: '1.0.0', manifestSha256: sha(manifestBytes) })));
    return [...files].map(([path, bytes]) => ({ path, bytes }));
  };
  const swapped = forge((files, entries) => { const a = files.get(entries[1]); files.set(entries[1], files.get(entries[2])); files.set(entries[2], a); });
  assert.throws(() => verifyHistoryExport({ files: swapped }), code('LEDGER_CORRUPT'));
  const orphanHex = 'ab'.repeat(32);
  const withOrphan = forge(files => files.set(`records/${orphanHex}/package.mip`, bytesOf('x')));
  assert.throws(() => verifyHistoryExport({ files: withOrphan }), code('EXPORT_CORRUPT'));
  const badMember = forge(files => { const key = [...files.keys()].find(p => p.startsWith('records/')); files.set(key, bytesOf('tampered')); });
  assert.throws(() => verifyHistoryExport({ files: badMember }), code('RECORD_BYTES_MISMATCH'));
});

test('L18 limits are enforced (R26): entry size, descriptor size, entries per ledger', () => {
  const ledger = createHistoryLedger({ ledgerName: 'a', workspaceIdentifier: 'w'.repeat(900) });
  assert.ok(ledger.descriptorBytes.length <= 1024);
  assert.throws(() => createHistoryLedger({ ledgerName: 'a', workspaceIdentifier: 'w'.repeat(1100) }), code('RESOURCE_LIMIT'));
  // An entry larger than 16,384 bytes is refused with RESOURCE_LIMIT and changes nothing.
  const driver = new Driver();
  const big = mip('a');
  big.record.subjects = [{ type: 'MIP_PACKAGE_IDENTIFIER', value: 'i'.repeat(17000) }, { type: 'WORKSPACE', value: WORKSPACE }];
  big.record.recordDigest = D('MEMORYOS-HISTORY-RECORD-1.0', 'MIP_PACKAGE', jcs(big.record.members));
  assert.throws(() => driver.add(big), code('RESOURCE_LIMIT', 'PUBLICATION'));
  assert.equal(driver.entries.length, 0);
  // More than 100,000 entries are refused before any entry is parsed.
  assert.throws(() => verifyHistoryLedger({ descriptorBytes: driver.descriptorBytes, entries: new Array(100001).fill(new Uint8Array(1)), members: new Map() }), code('RESOURCE_LIMIT'));
  // 17 subjects exceed the per-entry maximum of 16.
  const manySubjects = mip('b');
  manySubjects.record.subjects = Array.from({ length: 17 }, (_, i) => ({ type: 'MIP_PACKAGE_IDENTIFIER', value: 'v' + String(i).padStart(2, '0') }));
  assert.throws(() => driver.add(manySubjects), code('RECORD_INVALID', 'ADMISSION'));
});

test('L19 argument shapes fail with USAGE', () => {
  const driver = sampleLedger();
  assert.throws(() => createHistoryLedger(), code('USAGE'));
  assert.throws(() => createHistoryLedger({ ledgerName: 'Bad', workspaceIdentifier: 'w' }), code('USAGE'));
  assert.throws(() => createHistoryLedger({ ledgerName: 'a', workspaceIdentifier: '' }), code('USAGE'));
  assert.throws(() => verifyHistoryLedger({ descriptorBytes: 'x', entries: [], members: new Map() }), code('USAGE'));
  assert.throws(() => verifyHistoryLedger({ descriptorBytes: driver.descriptorBytes, entries: [], members: {} }), code('USAGE'));
  assert.throws(() => verifyHistoryLedger({ descriptorBytes: driver.descriptorBytes, entries: [], members: new Map([['x', []]]) }), code('USAGE'));
  assert.throws(() => buildHistoryExport({ descriptorBytes: driver.descriptorBytes, entries: ['x'], members: new Map() }), code('USAGE'));
  assert.throws(() => verifyHistoryExport({ files: [{ path: 'x' }] }), code('USAGE'));
  assert.throws(() => verifyHistoryExport({ files: 'x' }), code('USAGE'));
  assert.throws(() => tombstoneHistoryEntry({ ledger: {}, targetIndex: 0, reason: 'PRIVACY_REQUEST', authorityReference: 'x' }), code('USAGE'));
});

test('L20 data classes: no time, path, URL or actor appears in any MO-1308-authored bytes (R24, R35)', () => {
  const driver = sampleLedger();
  driver.tombstone(0);
  const exported = buildHistoryExport(driver.input()).files.filter(f => !f.path.startsWith('records/'));
  const text = [dec.decode(driver.descriptorBytes), ...driver.entries.map(b => dec.decode(b)), ...exported.map(f => dec.decode(f.bytes)),
    JSON.stringify({ ...driver.ledger() }), JSON.stringify(driver.query({ recordKinds: ['MIP_PACKAGE'] }))].join('\n');
  assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}T|timestamp|observedAt|createdAt|https?:|[A-Za-z]:\\|\/home\//u);
  for (const bytes of driver.entries) {
    assert.deepEqual(Object.keys(JSON.parse(dec.decode(bytes))).sort(),
      ['entryDigest', 'entryType', 'index', 'kind', 'ledgerIdentifier', 'previousEntryDigest', 'record', 'tombstone', 'version']);
  }
});

test('L21 the ledger module is pure and imports only the contract and canonical modules (R28, R29, R35, R37)', () => {
  const sourcePath = fileURLToPath(new URL('../../cca-studio/web/js/memoryos-history-ledger.js', import.meta.url));
  const source = fs.readFileSync(sourcePath, 'utf8');
  const imports = [...source.matchAll(/^\s*(?:import\s.+?from|\}\s*from)\s+"([^"]+)";$/gmu)].map(match => match[1]);
  assert.deepEqual(imports, ['./mip-canonical.js', './memoryos-history-contract.js']);
  assert.doesNotMatch(source, /new Date|Date\.|performance\.|setTimeout|setInterval|Math\.random|crypto\.|process\.|require\(|import\(/u);
  assert.doesNotMatch(source, /node:|child_process|powershell|spawn|exec\(|readFile|writeFile|fetch\(/iu);
  assert.doesNotMatch(source, /timestamp|observedAt|createdAt/iu);
  assert.doesNotMatch(source, /memoryos-sdk|investigation-core|memoryos-history-admission/u);
});

test('L22 every Freeze error raised carries only a fixed message', () => {
  const driver = sampleLedger();
  try {
    verifyHistoryLedger({ ...driver.input(), descriptorBytes: bytesOf('{"secret":"/home/user/x"}') });
    assert.fail('expected failure');
  } catch (error) {
    assert.ok(error instanceof MemoryOSHistoryError);
    assert.doesNotMatch(String(error.message) + String(error.stack).split('\n')[0], /secret|home/u);
  }
});

test('L23 re-sealed forgeries (valid entry digest) are caught by the chain rules themselves (R05, R10, R20)', () => {
  const driver = sampleLedger();
  const reseal = (bytes, mutate) => {
    const entry = JSON.parse(dec.decode(bytes));
    mutate(entry);
    const { entryDigest, ...rest } = entry; // eslint-disable-line no-unused-vars
    entry.entryDigest = D('MEMORYOS-HISTORY-ENTRY-1.0', jcs(rest));
    return enc.encode(jcs(entry));
  };
  const at = (index, bytes) => driver.entries.map((original, i) => (i === index ? bytes : original));
  const fail = entries => assert.throws(() => verifyHistoryLedger({ ...driver.input(), entries }), code('LEDGER_CORRUPT', 'VERIFICATION'));
  fail(at(3, reseal(driver.entries[3], e => { e.previousEntryDigest = sha(bytesOf('elsewhere')); })));
  fail(at(3, reseal(driver.entries[3], e => { e.index = 2; })));
  fail(at(3, reseal(driver.entries[3], e => { e.ledgerIdentifier = sha(bytesOf('foreign')); })));
  fail(at(3, reseal(driver.entries[3], e => { e.record.recordDigest = sha(bytesOf('forged')); })));
  // A record entry repeating an earlier (recordKind, recordDigest), with the chain re-linked and re-sealed.
  const first = JSON.parse(dec.decode(driver.entries[0]));
  const prior = JSON.parse(dec.decode(driver.entries[2])).entryDigest;
  fail([...driver.entries.slice(0, 3), reseal(driver.entries[3], e => { e.record = first.record; e.previousEntryDigest = prior; })]);
  // A forged re-supply after a purge.
  driver.tombstone(0);
  const head = JSON.parse(dec.decode(driver.entries[4])).entryDigest;
  const resupplied = reseal(driver.entries[3], e => { e.record = first.record; e.index = 5; e.previousEntryDigest = head; });
  assert.throws(() => verifyHistoryLedger({ ...driver.input(), entries: [...driver.entries, resupplied] }), code('LEDGER_CORRUPT'));
});
