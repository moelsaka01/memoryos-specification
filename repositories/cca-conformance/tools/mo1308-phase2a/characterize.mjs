// MO-1308 Phase 2A characterization (Freeze section 14.2): time and memory of the ledger core at the
// frozen limits. Values are recorded, not pass/fail. Run: node --expose-gc characterize.mjs [entryCount]
import { canonicalize, sha256Hex } from '../../../cca-studio/web/js/mip-canonical.js';
import {
  buildHistoryExport, createHistoryLedger, entryDigestOf, genesisDigestOf, queryHistoryLedger, recordDigestOf,
  verifyHistoryExport, verifyHistoryLedger,
} from '../../../cca-studio/web/js/memoryos-history-ledger.js';

const count = Number(process.argv[2] ?? 100000);
const encoder = new TextEncoder();
const digest = n => 'sha256:' + n.toString(16).padStart(64, '0');
const gc = () => { if (globalThis.gc) globalThis.gc(); };
const measure = (label, action) => {
  gc();
  const startMemory = process.memoryUsage().heapUsed;
  const start = process.hrtime.bigint();
  const value = action();
  const milliseconds = Number(process.hrtime.bigint() - start) / 1e6;
  const heapDeltaMiB = (process.memoryUsage().heapUsed - startMemory) / 1048576;
  console.error(`${label}: ${milliseconds.toFixed(0)} ms, heap +${heapDeltaMiB.toFixed(1)} MiB`);
  return { value, row: { label, milliseconds: Math.round(milliseconds), heapDeltaMiB: Math.round(heapDeltaMiB * 10) / 10 } };
};

const created = createHistoryLedger({ ledgerName: 'characterization', workspaceIdentifier: 'workspace-investigation' });
const generated = measure(`generate ${count} entries`, () => {
  const entries = [];
  const members = new Map();
  let previous = genesisDigestOf(created.ledgerIdentifier);
  for (let index = 0; index < count; index += 1) {
    const name = 'package.mip';
    const bytes = encoder.encode(`package ${index}`);
    const memberList = [{ name, byteLength: bytes.length, sha256: `sha256:${sha256Hex(bytes)}` }];
    const record = {
      recordKind: 'MIP_PACKAGE', recordDigest: recordDigestOf('MIP_PACKAGE', memberList), admission: 'MIP_001_VERIFIED',
      members: memberList, workspaceAssociation: 'INTRINSIC',
      subjects: [{ type: 'MIP_PACKAGE_DIGEST', value: digest(index + 1) }, { type: 'MIP_PACKAGE_IDENTIFIER', value: `pkg-${index}` },
        { type: 'WORKSPACE', value: 'workspace-investigation' }],
    };
    const entry = { kind: 'MemoryOSHistoryEntry', version: '1.0.0', ledgerIdentifier: created.ledgerIdentifier, index,
      previousEntryDigest: previous, entryType: 'RECORD', record, tombstone: null };
    entry.entryDigest = entryDigestOf(entry);
    previous = entry.entryDigest;
    entries.push(encoder.encode(canonicalize(entry)));
    members.set(record.recordDigest, [{ name, bytes }]);
  }
  return { entries, members };
});
const { entries, members } = generated.value;
const rows = [generated.row];
const chainInput = { descriptorBytes: created.descriptorBytes, entries };
const query = { kind: 'MemoryOSHistoryQuery', version: '1.0.0', recordKinds: [], subject: null, retention: 'ANY', fromIndex: 0, limit: 1000 };
rows.push(measure('query page of 1000 entries (chain verify + filter)', () => queryHistoryLedger({ ...chainInput, query })).row);
rows.push(measure('query: subject filter over the full ledger', () => queryHistoryLedger({ ...chainInput,
  query: { ...query, subject: { type: 'MIP_PACKAGE_IDENTIFIER', value: `pkg-${count - 1}` }, limit: 10 } })).row);
let verified = null;
try {
  verified = measure('verify (chain and members)', () => verifyHistoryLedger({ ...chainInput, members }));
  rows.push(verified.row);
} catch (error) {
  rows.push({ label: 'verify (chain and members)', failed: error.code ?? String(error) });
}
if (verified !== null) {
  const exported = measure('build export (verify + manifest)', () => buildHistoryExport({ ...chainInput, members }));
  rows.push(exported.row);
  rows.push(measure('verify export', () => verifyHistoryExport({ files: exported.value.files })).row);
}
console.log(JSON.stringify({ kind: 'MO1308Phase2ACharacterization', entryCount: count, node: process.version, rows }, null, 2));
