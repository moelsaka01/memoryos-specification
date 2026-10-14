// MO-1308 Phase 1: regenerate the Investigation History shape fixtures (JCS bytes, synthetic digests).
import fs from 'node:fs';
import { canonicalize } from '../web/js/mip-canonical.js';
const d = n => 'sha256:' + n.toString(16).padStart(2, '0').repeat(32);
const clone = v => JSON.parse(JSON.stringify(v));
const ledger = { kind: 'MemoryOSHistoryLedger', version: '1.0.0', ledgerName: 'workspace-investigation.history', workspaceIdentifier: 'workspace-investigation' };
const recordEntry = { kind: 'MemoryOSHistoryEntry', version: '1.0.0', ledgerIdentifier: d(1), index: 0, previousEntryDigest: d(2), entryType: 'RECORD',
  record: { recordKind: 'MIP_PACKAGE', recordDigest: d(3), admission: 'MIP_001_VERIFIED', members: [{ name: 'package.mip', byteLength: 2048, sha256: d(4) }],
    workspaceAssociation: 'INTRINSIC', subjects: [{ type: 'MIP_PACKAGE_DIGEST', value: d(5) }, { type: 'MIP_PACKAGE_IDENTIFIER', value: 'mip-reference-complete' }, { type: 'WORKSPACE', value: 'workspace-investigation' }], decisionConsistency: null },
  tombstone: null, entryDigest: d(6) };
const cicdFailure = { ...clone(recordEntry), index: 1, previousEntryDigest: d(6), entryDigest: d(7),
  record: { recordKind: 'CICD_RUN', recordDigest: d(8), admission: 'MO1306_BUNDLE_INTEGRITY_VERIFIED',
    members: ['memoryos-ci-artifacts.json', 'memoryos-ci-complete.json', 'memoryos-ci-evidence.json', 'memoryos-ci-result.json'].map((name, i) => ({ name, byteLength: 512 + i, sha256: d(16 + i) })),
    workspaceAssociation: 'DECLARED', subjects: [{ type: 'CICD_RUN_ID', value: '3f1c2a64-9e2b-4c55-8a1d-6f0b7e9c2d10' }], decisionConsistency: null } };
const claimEntry = { ...clone(recordEntry), index: 3, previousEntryDigest: d(9), entryDigest: d(14),
  record: { recordKind: 'HUMAN_DECISION_CLAIM', recordDigest: d(15), admission: 'MO1307_DECISION_CLAIM_BOUND', members: [{ name: 'human-decision.json', byteLength: 300, sha256: d(16) }],
    workspaceAssociation: 'DECLARED', subjects: [{ type: 'PROOF_BINDING_DIGEST', value: d(17) }, { type: 'READINESS_CANDIDATE_DIGEST', value: d(18) }, { type: 'READINESS_DIGEST', value: d(19) }], decisionConsistency: 'CONTRARY_TO_READINESS' } };
const tombstone = { kind: 'MemoryOSHistoryEntry', version: '1.0.0', ledgerIdentifier: d(1), index: 2, previousEntryDigest: d(7), entryType: 'TOMBSTONE', record: null,
  tombstone: { targetIndex: 0, targetEntryDigest: d(6), targetRecordDigest: d(3), reason: 'PRIVACY_REQUEST', authorityReference: 'PRIV-2026-0042', authenticity: 'NOT_VERIFIED_BY_MEMORYOS' }, entryDigest: d(9) };
const query = { kind: 'MemoryOSHistoryQuery', version: '1.0.0', recordKinds: ['MIP_PACKAGE'], subject: { type: 'WORKSPACE', value: 'workspace-investigation' }, retention: 'ANY', fromIndex: 0, limit: 100 };
const verification = { kind: 'MemoryOSHistoryVerification', version: '1.0.0', ledgerIdentifier: d(1), workspaceIdentifier: 'workspace-investigation', entryCount: 3, headDigest: d(9),
  retainedRecords: 1, purgedRecords: 1, tombstones: 1, purgePending: [], unreferencedRecords: [], pendingArtifacts: 0 };
const queryResult = { kind: 'MemoryOSHistoryQueryResult', version: '1.0.0', ledgerIdentifier: d(1), workspaceIdentifier: 'workspace-investigation', entryCount: 3, headDigest: d(9), query,
  entries: [{ index: 0, entryDigest: d(6), entryType: 'RECORD', recordKind: 'MIP_PACKAGE', recordDigest: d(3), admission: 'MIP_001_VERIFIED', workspaceAssociation: 'INTRINSIC',
    subjects: recordEntry.record.subjects, retention: 'PURGED', tombstoneIndex: 2, decisionConsistency: null }], nextIndex: null };
const exportManifest = { kind: 'MemoryOSHistoryExport', version: '1.0.0', ledgerIdentifier: d(1), workspaceIdentifier: 'workspace-investigation', entryCount: 3, headDigest: d(9),
  files: [{ path: 'entries/00000000000000000000.json', byteLength: 900, sha256: d(10) }, { path: 'memoryos-history-ledger.json', byteLength: 120, sha256: d(11) }] };
const exportComplete = { kind: 'MemoryOSHistoryExportComplete', version: '1.0.0', manifestSha256: d(12) };
const cases = [];
const add = (id, validator, value, expect) => cases.push({ id, validator, value, expect });
add('ledger-valid', 'validateLedgerDescriptor', ledger, 'VALID');
add('entry-record-valid', 'validateEntry', recordEntry, 'VALID');
add('entry-cicd-failure-valid', 'validateEntry', cicdFailure, 'VALID');
add('entry-claim-contrary-valid', 'validateEntry', claimEntry, 'VALID');
add('entry-claim-consistent-valid', 'validateEntry', { ...clone(claimEntry), record: { ...clone(claimEntry.record), decisionConsistency: 'CONSISTENT' } }, 'VALID');
add('entry-tombstone-valid', 'validateEntry', tombstone, 'VALID');
add('query-valid', 'validateQuery', query, 'VALID');
add('verification-valid', 'validateVerification', verification, 'VALID');
add('query-result-valid', 'validateQueryResult', queryResult, 'VALID');
add('export-manifest-valid', 'validateExportManifest', exportManifest, 'VALID');
add('export-complete-valid', 'validateExportComplete', exportComplete, 'VALID');
add('query-multiple-kinds-valid', 'validateQuery', { ...query, recordKinds: ['CICD_RUN', 'MIP_PACKAGE'] }, 'VALID');
const bad = (id, validator, base, mutate, expect) => { const v = clone(base); mutate(v); add(id, validator, v, expect); };
bad('ledger-extra-member', 'validateLedgerDescriptor', ledger, v => { v.createdAt = 'x'; }, 'MO1308_LEDGER_CORRUPT');
bad('ledger-no-workspace', 'validateLedgerDescriptor', ledger, v => { delete v.workspaceIdentifier; }, 'MO1308_LEDGER_CORRUPT');
bad('ledger-empty-workspace', 'validateLedgerDescriptor', ledger, v => { v.workspaceIdentifier = ''; }, 'MO1308_LEDGER_CORRUPT');
bad('ledger-name-uppercase', 'validateLedgerDescriptor', ledger, v => { v.ledgerName = 'History'; }, 'MO1308_LEDGER_CORRUPT');
bad('ledger-version-2', 'validateLedgerDescriptor', ledger, v => { v.version = '2.0.0'; }, 'MO1308_VERSION_UNSUPPORTED');
bad('entry-time-member', 'validateEntry', recordEntry, v => { v.observedAt = '2026-10-04T00:00:00Z'; }, 'MO1308_LEDGER_CORRUPT');
bad('entry-both-null', 'validateEntry', recordEntry, v => { v.record = null; }, 'MO1308_LEDGER_CORRUPT');
bad('entry-record-with-tombstone', 'validateEntry', recordEntry, v => { v.tombstone = clone(tombstone.tombstone); }, 'MO1308_LEDGER_CORRUPT');
bad('entry-index-limit', 'validateEntry', recordEntry, v => { v.index = 100000; }, 'MO1308_LEDGER_CORRUPT');
bad('entry-wrong-admission', 'validateEntry', recordEntry, v => { v.record.admission = 'SDK_REGRESSION_REPORT_INSPECTED'; }, 'MO1308_LEDGER_CORRUPT');
bad('entry-wrong-association', 'validateEntry', recordEntry, v => { v.record.workspaceAssociation = 'DECLARED'; }, 'MO1308_LEDGER_CORRUPT');
bad('entry-unknown-kind', 'validateEntry', recordEntry, v => { v.record.recordKind = 'INGESTION_REJECTED'; }, 'MO1308_LEDGER_CORRUPT');
bad('entry-member-name', 'validateEntry', recordEntry, v => { v.record.members[0].name = 'package.json'; }, 'MO1308_LEDGER_CORRUPT');
bad('entry-member-oversize', 'validateEntry', recordEntry, v => { v.record.members[0].byteLength = 16777217; }, 'MO1308_LEDGER_CORRUPT');
bad('entry-subject-not-for-kind', 'validateEntry', recordEntry, v => { v.record.subjects = [{ type: 'CICD_RUN_ID', value: 'x' }]; }, 'MO1308_LEDGER_CORRUPT');
bad('entry-subjects-unsorted', 'validateEntry', recordEntry, v => { v.record.subjects.reverse(); }, 'MO1308_LEDGER_CORRUPT');
bad('entry-subjects-duplicate', 'validateEntry', recordEntry, v => { v.record.subjects.push(clone(v.record.subjects[2])); }, 'MO1308_LEDGER_CORRUPT');
bad('entry-cicd-five-members', 'validateEntry', cicdFailure, v => { v.record.members.splice(1, 1); }, 'MO1308_LEDGER_CORRUPT');
bad('entry-claim-consistency-null', 'validateEntry', claimEntry, v => { v.record.decisionConsistency = null; }, 'MO1308_LEDGER_CORRUPT');
bad('entry-claim-consistency-unknown', 'validateEntry', claimEntry, v => { v.record.decisionConsistency = 'APPROVED'; }, 'MO1308_LEDGER_CORRUPT');
bad('entry-record-consistency-set', 'validateEntry', recordEntry, v => { v.record.decisionConsistency = 'CONSISTENT'; }, 'MO1308_LEDGER_CORRUPT');
bad('entry-record-consistency-missing', 'validateEntry', recordEntry, v => { delete v.record.decisionConsistency; }, 'MO1308_LEDGER_CORRUPT');
bad('entry-digest-uppercase', 'validateEntry', recordEntry, v => { v.entryDigest = 'sha256:' + 'AB'.repeat(32); }, 'MO1308_LEDGER_CORRUPT');
bad('tombstone-unknown-reason', 'validateEntry', tombstone, v => { v.tombstone.reason = 'EXPIRED'; }, 'MO1308_LEDGER_CORRUPT');
bad('tombstone-authenticity', 'validateEntry', tombstone, v => { v.tombstone.authenticity = 'VERIFIED'; }, 'MO1308_LEDGER_CORRUPT');
bad('tombstone-reference-non-ascii', 'validateEntry', tombstone, v => { v.tombstone.authorityReference = 'ticket é'; }, 'MO1308_LEDGER_CORRUPT');
bad('tombstone-reference-too-long', 'validateEntry', tombstone, v => { v.tombstone.authorityReference = 'x'.repeat(257); }, 'MO1308_LEDGER_CORRUPT');
bad('tombstone-forward-target', 'validateEntry', tombstone, v => { v.tombstone.targetIndex = 2; }, 'MO1308_LEDGER_CORRUPT');
bad('query-limit-zero', 'validateQuery', query, v => { v.limit = 0; }, 'MO1308_QUERY_INVALID');
bad('query-limit-1001', 'validateQuery', query, v => { v.limit = 1001; }, 'MO1308_QUERY_INVALID');
bad('query-retention', 'validateQuery', query, v => { v.retention = 'ALL'; }, 'MO1308_QUERY_INVALID');
bad('query-unknown-kind', 'validateQuery', query, v => { v.recordKinds = ['NATIVE_INVESTIGATION']; }, 'MO1308_QUERY_INVALID');
bad('query-version', 'validateQuery', query, v => { v.version = '1.1.0'; }, 'MO1308_QUERY_INVALID');
bad('query-kinds-duplicate', 'validateQuery', query, v => { v.recordKinds = ['MIP_PACKAGE', 'MIP_PACKAGE']; }, 'MO1308_QUERY_INVALID');
bad('query-kinds-unsorted', 'validateQuery', query, v => { v.recordKinds = ['MIP_PACKAGE', 'CICD_RUN']; }, 'MO1308_QUERY_INVALID');
bad('query-result-subjects-duplicate', 'validateQueryResult', queryResult, v => { v.entries[0].subjects.push(clone(v.entries[0].subjects[2])); }, 'MO1308_INTERNAL');
bad('query-result-claim-consistency-null', 'validateQueryResult', queryResult, v => { v.entries[0].recordKind = 'HUMAN_DECISION_CLAIM'; v.entries[0].admission = 'MO1307_DECISION_CLAIM_BOUND'; v.entries[0].workspaceAssociation = 'DECLARED'; v.entries[0].decisionConsistency = null; }, 'MO1308_INTERNAL');
bad('query-result-record-consistency-set', 'validateQueryResult', queryResult, v => { v.entries[0].decisionConsistency = 'CONSISTENT'; }, 'MO1308_INTERNAL');
bad('verification-unsorted-pending', 'validateVerification', verification, v => { v.purgePending = [3, 1]; }, 'MO1308_LEDGER_CORRUPT');
bad('export-path-traversal', 'validateExportManifest', exportManifest, v => { v.files.push({ path: 'records/../x', byteLength: 1, sha256: d(13) }); }, 'MO1308_EXPORT_CORRUPT');
bad('export-unsorted', 'validateExportManifest', exportManifest, v => { v.files.reverse(); }, 'MO1308_EXPORT_CORRUPT');
bad('export-complete-extra', 'validateExportComplete', exportComplete, v => { v.timestamp = 'x'; }, 'MO1308_EXPORT_CORRUPT');
const fixture = { kind: 'MemoryOSHistoryShapeFixtures', version: '1.0.0', note: 'Shape fixtures with synthetic digests; not identity vectors.', cases };
fs.writeFileSync(new URL('../tests/fixtures/memoryos-history/1.0.0/shape-cases.json', import.meta.url), canonicalize(fixture));
console.log(cases.length, 'cases');
