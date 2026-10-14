// MO-1308 Phase 2D characterization (Freeze section 14.2, Amendment A2 item 4): the integrated SDK facade and CLI at the
// frozen 100,000-entry ceiling. Run: node --expose-gc characterize.mjs [entryCount]. Values are recorded, not pass/fail,
// but an operation that returns an error makes the tool exit non-zero and a failed characterization never exits 0.
// Unlike Stream 2C's tool (which used a stand-in engine), every operation here runs the REAL SDK history functions through
// the CLI command layer. The chain is generated directly (an append reads the whole ledger, so building it by appends
// would be quadratic); verification does not re-run admission (section 11.1), so the generated entries are chain-valid
// MIP_PACKAGE entries with synthetic member bytes. The measured append is a REAL admission of the reference MIP as the
// last allowed entry; a last real-process run measures the whole `memoryos history verify` including process start.
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize, mipDigest } from '../../../cca-studio/web/js/mip-canonical.js';
import { MemoryOS } from '../../../cca-studio/web/js/memoryos-sdk.js';
import { executeHistoryCommand } from '../../../memoryos-cli/src/history-commands.js';
import { parseHistoryArguments } from '../../../memoryos-cli/src/history-arguments.js';
import { createHistoryEngine } from '../../../memoryos-cli/tests/support/history-engine.mjs';
import { mipBytes } from '../../../memoryos-cli/tests/support/history-corpus.mjs';

const count = Number(process.argv[2] ?? 100000);
const engine = createHistoryEngine();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'memoryos-history-2d-'));
const ledger = path.join(scratch, 'ledger');
const rows = [];
const enc = new TextEncoder();
const sha = bytes => 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
const cliBin = fileURLToPath(new URL('../../../memoryos-cli/bin/memoryos.js', import.meta.url));
const run = (...argv) => executeHistoryCommand(parseHistoryArguments(argv), { engine });
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
  const created = run('init', '--ledger', ledger, '--name', 'characterization', '--workspace', 'workspace-investigation').result;
  const generated = count - 1;
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
  measure('history query page of 1000 (real SDK query)', () => run('query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '1000'));
  measure('history query with a subject filter over the whole ledger', () => run('query', '--ledger', ledger, '--subject-type', 'WORKSPACE',
    '--subject', 'workspace-investigation', '--retention', 'ANY', '--from', '0', '--limit', '1000'));
  measure('history verify (real SDK verification of every entry and member)', () => run('verify', '--ledger', ledger));
  const record = path.join(scratch, 'reference.mip');
  fs.writeFileSync(record, mipBytes());
  measure('history append of the last allowed entry (real MIP admission, then publish)', () => run('append', '--ledger', ledger, '--kind', 'MIP_PACKAGE', '--record', record));
  const output = path.join(scratch, 'export');
  measure('history export', () => run('export', '--ledger', ledger, '--output', output));
  if (rows.at(-1).outcome === 'ok') measure('history verify-export', () => run('verify-export', '--export', output));
  measure('real process: memoryos history verify (includes process start and module load)', () => {
    const result = spawnSync(process.execPath, [cliBin, 'history', 'verify', '--ledger', ledger, '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    if (result.status !== 0) throw new Error(`exit ${result.status}`);
    return JSON.parse(result.stdout);
  });
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
// The cost of producing a checkpoint record from a real Checkpoint (admission-checked inside the SDK).
const memory = new MemoryOS();
const checkpoint = memory.importPackage(mipBytes(), { identifier: 'characterization' }).checkpoint();
measure('MemoryOS#createHistoryCheckpointRecord (reference MIP checkpoint, 2 transitions)', () => memory.createHistoryCheckpointRecord(checkpoint));
console.log(JSON.stringify({ kind: 'MO1308Phase2DCharacterization', entryCount: count, node: process.version, platform: process.platform, rows }, null, 2));
