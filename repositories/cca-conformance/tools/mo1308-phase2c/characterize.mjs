// MO-1308 Phase 2C characterization (Freeze section 14.2): file-store time and memory at the frozen
// 100,000-entry ceiling. Run: node --expose-gc characterize.mjs [entryCount]. Values are recorded, not pass/fail,
// but an operation that returns an error makes the tool exit non-zero and a failed characterization never exits 0.
// Entries follow Amendment A4.1: `record.decisionConsistency` is null for every non-claim record (only MIP_PACKAGE
// records are generated here).
// The SDK history functions do not exist until Stream 2D, so the stand-in engine from the Stream 2C tests supplies
// verification; the numbers therefore bound the store's I/O plus a native-crypto verifier, not the real engine.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { canonicalize, mipDigest } from '../../../cca-studio/web/js/mip-canonical.js';
import { createHistoryStore } from '../../../memoryos-cli/src/history-store.js';
import { createHistoryEngineDouble } from '../../../memoryos-cli/tests/support/history-engine-double.mjs';

const count = Number(process.argv[2] ?? 100000);
const engine = createHistoryEngineDouble();
const store = createHistoryStore({ engine });
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'memoryos-history-2c-'));
const ledger = path.join(scratch, 'ledger');
const rows = [];
const enc = new TextEncoder();
const sha = bytes => 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
function measure(label, action) {
  if (globalThis.gc) globalThis.gc();
  const before = process.memoryUsage().heapUsed;
  const start = process.hrtime.bigint();
  let outcome = 'ok';
  let value;
  try { value = action(); } catch (error) { outcome = error.code ?? String(error); process.exitCode = 1; }
  const milliseconds = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
  const heapDeltaMiB = Math.round((process.memoryUsage().heapUsed - before) / 104857.6) / 10;
  rows.push({ label, outcome, milliseconds, heapDeltaMiB });
  console.error(`${label}: ${outcome}, ${milliseconds} ms, heap +${heapDeltaMiB} MiB`);
  return value;
}

try {
  const created = store.init(ledger, { ledgerName: 'characterization', workspaceIdentifier: 'workspace-investigation' });
  // Generate the chain directly (an append reads the whole ledger, so building it by appends would be quadratic).
  const generated = count - 1; // the measured append is entry number `count`, the ledger ceiling
  measure(`generate ${generated} entries and members on disk`, () => {
    let previous = mipDigest('MEMORYOS-HISTORY-GENESIS-1.0', created.ledgerIdentifier);
    for (let index = 0; index < generated; index += 1) {
      const bytes = enc.encode(`package ${index}`);
      const members = [{ name: 'package.mip', byteLength: bytes.length, sha256: sha(bytes) }];
      const record = { recordKind: 'MIP_PACKAGE', recordDigest: mipDigest('MEMORYOS-HISTORY-RECORD-1.0', 'MIP_PACKAGE', canonicalize(members)),
        admission: 'MIP_001_VERIFIED', members, workspaceAssociation: 'INTRINSIC', subjects: [{ type: 'WORKSPACE', value: 'workspace-investigation' }],
        decisionConsistency: null };
      const entry = { kind: 'MemoryOSHistoryEntry', version: '1.0.0', ledgerIdentifier: created.ledgerIdentifier, index,
        previousEntryDigest: previous, entryType: 'RECORD', record, tombstone: null };
      entry.entryDigest = mipDigest('MEMORYOS-HISTORY-ENTRY-1.0', canonicalize(entry));
      previous = entry.entryDigest;
      fs.writeFileSync(path.join(ledger, 'entries', `${String(index).padStart(20, '0')}.json`), canonicalize(entry));
      const directory = path.join(ledger, 'records', record.recordDigest.slice(7));
      fs.mkdirSync(directory);
      fs.writeFileSync(path.join(directory, 'package.mip'), bytes);
    }
  });
  const query = { kind: 'MemoryOSHistoryQuery', version: '1.0.0', recordKinds: [], subject: null, retention: 'ANY', fromIndex: 0, limit: 1000 };
  measure('store.query page of 1000 (list and read every entry, no members)', () => store.query(ledger, query));
  measure('store.verify (list and read every entry and member)', () => store.verify(ledger));
  measure('store.append of the last allowed entry (verify the whole ledger, then publish)', () => store.append(ledger, { recordKind: 'MIP_PACKAGE', members: [{ name: 'package.mip', bytes: enc.encode('one more') }] }));
  const output = path.join(scratch, 'export');
  measure('store.exportLedger', () => store.exportLedger(ledger, output));
  // verifyExport needs a completed export; when the export failed that failure is already recorded.
  if (rows.at(-1).outcome === 'ok') measure('store.verifyExport', () => store.verifyExport(output));
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
console.log(JSON.stringify({ kind: 'MO1308Phase2CCharacterization', entryCount: count, node: process.version, platform: process.platform, rows }, null, 2));
