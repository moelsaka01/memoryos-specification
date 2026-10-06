// Test helper (Stream 2C): one concurrent appender in its own process. It appends one record to the ledger
// named by argv[2], retrying after LEDGER_CONFLICT, and prints every attempt as JSON.
import { createHistoryStore } from "../../src/history-store.js";
import { createHistoryEngineDouble } from "./history-engine-double.mjs";

const [ledger, label] = process.argv.slice(2);
const store = createHistoryStore({ engine: createHistoryEngineDouble() });
const member = { name: "package.mip", bytes: new Uint8Array(new TextEncoder().encode(`concurrent record ${label}`)) };
const attempts = [];
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const result = store.append(ledger, { recordKind: "MIP_PACKAGE", members: [member] });
    attempts.push({ ok: true, index: result.index });
    break;
  } catch (error) {
    attempts.push({ ok: false, code: error.code ?? "UNEXPECTED" });
    if (error.code !== "MO1308_LEDGER_CONFLICT") break;
  }
}
process.stdout.write(JSON.stringify(attempts));
