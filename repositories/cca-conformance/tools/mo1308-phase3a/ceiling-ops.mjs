// MO-1308 Phase 3A Windows harness: one history operation through the REAL SDK history functions and the production file store, in its own
// process so that the ceiling run's memory stays out of the case runner (3A-JC4, JC5, JC6, JC7). It is the same composition the CLI uses:
// the production store (memoryos-cli/src/history-store.js) with the SDK facade as its engine.
//   node --max-old-space-size=8192 ceiling-ops.mjs verify <ledger>
//   node ... append <ledger> <kind> <member-name> <file>
//   node ... export <ledger> <output>
//   node ... verify-export <export>
// Prints one JSON object {ok, op, ms, result | code, stage}. Harness only.
import fs from 'node:fs';
import {
  MemoryOSHistoryError, admitHistoryRecord, appendHistoryEntry, buildHistoryExport, createHistoryLedger, queryHistoryLedger,
  tombstoneHistoryEntry, verifyHistoryExport, verifyHistoryLedger,
} from '../../../cca-studio/web/js/memoryos-sdk.js';
import { createHistoryStore } from '../../../memoryos-cli/src/history-store.js';

const engine = Object.freeze({ MemoryOSHistoryError, admitHistoryRecord, appendHistoryEntry, buildHistoryExport, createHistoryLedger, queryHistoryLedger, tombstoneHistoryEntry, verifyHistoryExport, verifyHistoryLedger });
const store = createHistoryStore({ engine });
const [op, ...rest] = process.argv.slice(2);
const started = process.hrtime.bigint();
const elapsed = () => Math.round(Number(process.hrtime.bigint() - started) / 1e6);
try {
  let result;
  if (op === 'verify') result = store.verify(rest[0]);
  else if (op === 'append') result = store.append(rest[0], { recordKind: rest[1], members: [{ name: rest[2], bytes: new Uint8Array(fs.readFileSync(rest[3])) }] });
  else if (op === 'export') result = store.exportLedger(rest[0], rest[1]);
  else if (op === 'verify-export') result = store.verifyExport(rest[0]);
  else throw new Error(`unknown operation ${op}`);
  process.stdout.write(JSON.stringify({ ok: true, op, ms: elapsed(), result: JSON.parse(JSON.stringify(result, (key, value) => (typeof value === 'bigint' ? String(value) : value))), heapMiB: Math.round(process.memoryUsage().rss / 1048576) }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, op, ms: elapsed(), code: error?.code ?? null, stage: error?.stage ?? null, message: error instanceof MemoryOSHistoryError ? null : String(error?.message ?? error).slice(0, 200) }));
}
