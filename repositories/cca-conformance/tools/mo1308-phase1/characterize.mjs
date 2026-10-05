#!/usr/bin/env node
// MO-1308 Contract Freeze 1 §14.2: Phase 1 characterization at the frozen limits.
// Phase 1 implements only the contract (byte decoder and shape validators), so
// only those operations are measured here. Ledger, admission, query and export
// operations are characterized by the phases that implement them.
// Read-only: prints one JSON object to stdout and writes nothing.
import { performance } from 'node:perf_hooks';
import { canonicalize } from '../../../cca-studio/web/js/mip-canonical.js';
import {
  MEMORYOS_HISTORY_LIMITS as L, decodeHistoryBytes, validateEntry, validateExportManifest, validateQueryResult,
} from '../../../cca-studio/web/js/memoryos-history-contract.js';

const digest = n => 'sha256:' + (n % 4096).toString(16).padStart(3, '0').repeat(22).slice(0, 64);
function maximalEntry(index) {
  const subjects = [{ type: 'MIP_PACKAGE_DIGEST', value: digest(index) }, { type: 'MIP_PACKAGE_IDENTIFIER', value: 'p' },
    { type: 'WORKSPACE', value: 'w'.repeat(1) }];
  const entry = { kind: 'MemoryOSHistoryEntry', version: '1.0.0', ledgerIdentifier: digest(1), index, previousEntryDigest: digest(index + 2),
    entryType: 'RECORD', record: { recordKind: 'MIP_PACKAGE', recordDigest: digest(index + 3), admission: 'MIP_001_VERIFIED',
      members: [{ name: 'package.mip', byteLength: 16_777_216, sha256: digest(index + 4) }], workspaceAssociation: 'INTRINSIC', subjects, decisionConsistency: null },
    tombstone: null, entryDigest: digest(index + 5) };
  // Pad the identifier subject so the canonical entry is as close as possible to the entry-file limit.
  const size = new TextEncoder().encode(canonicalize(entry)).length;
  subjects[1].value = 'p'.repeat(1 + L.entryBytes - size - 1);
  return entry;
}
function measure(label, run) {
  globalThis.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const started = performance.now();
  const detail = run();
  const elapsedMs = Math.round((performance.now() - started) * 1000) / 1000;
  return { label, elapsedMs, heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore, ...detail };
}

const encoder = new TextEncoder();
const results = [];
results.push(measure('generate+decode+validate 100000 maximal entries (generation included; entries are not held in memory)', () => {
  let bytes = 0;
  for (let index = 0; index < L.entriesPerLedger; index += 1) {
    const encoded = encoder.encode(canonicalize(maximalEntry(index)));
    bytes = Math.max(bytes, encoded.length);
    validateEntry(decodeHistoryBytes(encoded, { maxBytes: L.entryBytes }));
  }
  return { entries: L.entriesPerLedger, maxEntryBytes: bytes };
}));
results.push(measure('validate query result page of 1000 entries', () => {
  const query = { kind: 'MemoryOSHistoryQuery', version: '1.0.0', recordKinds: [], subject: null, retention: 'ANY', fromIndex: 0, limit: L.queryLimitMaximum };
  const entries = Array.from({ length: L.queryLimitMaximum }, (_, index) => ({ index, entryDigest: digest(index), entryType: 'RECORD',
    recordKind: 'MIP_PACKAGE', recordDigest: digest(index + 1), admission: 'MIP_001_VERIFIED', workspaceAssociation: 'INTRINSIC',
    subjects: [{ type: 'WORKSPACE', value: 'w' }], retention: 'RETAINED', tombstoneIndex: null, decisionConsistency: null }));
  const value = { kind: 'MemoryOSHistoryQueryResult', version: '1.0.0', ledgerIdentifier: digest(1), workspaceIdentifier: 'w',
    entryCount: L.entriesPerLedger, headDigest: digest(2), query, entries, nextIndex: null };
  const bytes = encoder.encode(canonicalize(value)).length;
  validateQueryResult(value);
  return { bytes, withinCliStdout: bytes <= L.cliJsonStdoutBytes };
}));
results.push(measure('validate export manifest for 100000 entries', () => {
  const files = Array.from({ length: L.entriesPerLedger }, (_, index) => ({
    path: `entries/${String(index).padStart(20, '0')}.json`, byteLength: L.entryBytes, sha256: digest(index) }));
  files.push({ path: 'memoryos-history-ledger.json', byteLength: L.descriptorBytes, sha256: digest(7) });
  validateExportManifest({ kind: 'MemoryOSHistoryExport', version: '1.0.0', ledgerIdentifier: digest(1), workspaceIdentifier: 'w',
    entryCount: L.entriesPerLedger, headDigest: digest(2), files });
  return { files: files.length };
}));
process.stdout.write(JSON.stringify({ kind: 'MO1308Phase1Characterization', version: '1.0.0', node: process.version,
  platform: process.platform, arch: process.arch, limits: L, results }) + '\n');
