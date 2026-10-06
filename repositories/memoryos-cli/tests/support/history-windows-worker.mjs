// Test helper (Stream 2C, native-Windows tests): one real process for the NTFS concurrency tests.
//   append <ledger> <label> <count>   appends <count> records, retrying after LEDGER_CONFLICT
//   append-detailed <ledger> <label> <count>   as append, reporting every record's outcome and every failed attempt in full
//   tombstone <ledger> <target>       tombstones one entry, retrying after LEDGER_CONFLICT
//   verify <ledger> <milliseconds>    verifies in a loop and reports every distinct outcome
//   swap <ledger> <outside> <ms>      repeatedly swaps `records` for a junction to <outside> and back
// Every mode prints one JSON document and exits 0 unless the process itself crashes.
import * as nodeFs from "node:fs";
import { join } from "node:path";
import { createHistoryStore } from "../../src/history-store.js";
import { createHistoryEngineDouble } from "./history-engine-double.mjs";

const [mode, ledger, ...rest] = process.argv.slice(2);
const store = createHistoryStore({ engine: createHistoryEngineDouble() });
const codeOf = (error) => error?.code ?? "UNEXPECTED";
// A wall-clock bound for the loop modes only; the store itself never reads a clock (R35).
const until = (milliseconds) => { const end = Date.now() + Number(milliseconds); return () => Date.now() < end; };
const out = (value) => process.stdout.write(JSON.stringify(value));

if (mode === "append") {
  const [label, count] = rest;
  const attempts = [];
  for (let record = 0; record < Number(count); record += 1) {
    const member = { name: "package.mip", bytes: new Uint8Array(new TextEncoder().encode(`windows concurrent record ${label}-${record}`)) };
    for (let attempt = 0; attempt < 200; attempt += 1) {
      try {
        attempts.push({ ok: true, index: store.append(ledger, { recordKind: "MIP_PACKAGE", members: [member] }).index });
        break;
      } catch (error) {
        attempts.push({ ok: false, code: codeOf(error) });
        if (error.code !== "MO1308_LEDGER_CONFLICT") break;
      }
    }
  }
  out(attempts);
} else if (mode === "append-detailed") {
  // The same appends, but every record's outcome and every attempt's failure is reported in full: the typed code, the
  // stage and, for every Node file-system error thrown during the attempt, its code, errno, syscall and path. The
  // recording wraps the `fs` handed to the store; the store itself is the production module, unchanged.
  const [label, count] = rest;
  let thrown = [];
  const recording = { ...nodeFs };
  const wrap = (name, value) => (...args) => {
    try {
      return value(...args);
    } catch (error) {
      thrown.push({ call: name, code: error?.code ?? null, errno: error?.errno ?? null, syscall: error?.syscall ?? null, path: error?.path ?? null });
      throw error;
    }
  };
  for (const [name, value] of Object.entries(nodeFs)) {
    if (typeof value !== "function") continue;
    recording[name] = wrap(name, value);
    // `realpathSync.native` is a property of the function; the store calls it.
    if (typeof value.native === "function") recording[name].native = wrap(`${name}.native`, value.native);
  }
  const recordingStore = createHistoryStore({ engine: createHistoryEngineDouble(), fs: recording });
  const records = [];
  for (let record = 0; record < Number(count); record += 1) {
    const text = `windows concurrent record ${label}-${record}`;
    const member = { name: "package.mip", bytes: new Uint8Array(new TextEncoder().encode(text)) };
    const attempts = [];
    let outcome = "failed";
    for (let attempt = 0; attempt < 200; attempt += 1) {
      thrown = [];
      try {
        attempts.push({ ok: true, index: recordingStore.append(ledger, { recordKind: "MIP_PACKAGE", members: [member] }).index });
        outcome = "success";
        break;
      } catch (error) {
        // ENOENT and EEXIST are the store's own expected probes (a missing name, an occupied staging name).
        const fsErrors = thrown.filter((entry) => entry.code !== "ENOENT" && entry.code !== "EEXIST");
        attempts.push({ ok: false, code: codeOf(error), stage: error?.stage ?? null, fsErrors });
        if (error.code !== "MO1308_LEDGER_CONFLICT") break;
      }
    }
    records.push({ label: `${label}-${record}`, memberText: text, outcome, finalCode: outcome === "success" ? null : attempts.at(-1).code, attempts });
  }
  out(records);
} else if (mode === "tombstone") {
  const [target] = rest;
  const attempts = [];
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      attempts.push({ ok: true, index: store.tombstone(ledger, { targetIndex: Number(target), reason: "PRIVACY_REQUEST", authorityReference: `W-${target}` }).index });
      break;
    } catch (error) {
      attempts.push({ ok: false, code: codeOf(error) });
      if (error.code !== "MO1308_LEDGER_CONFLICT") break;
    }
  }
  out(attempts);
} else if (mode === "verify") {
  const [milliseconds] = rest;
  const live = until(milliseconds);
  const counts = [];
  const failures = {};
  while (live()) {
    try {
      counts.push(store.verify(ledger).entryCount);
    } catch (error) {
      failures[codeOf(error)] = (failures[codeOf(error)] ?? 0) + 1;
    }
  }
  out({ counts, failures });
} else if (mode === "swap") {
  const [outside, milliseconds] = rest;
  const live = until(milliseconds);
  const records = join(ledger, "records");
  const aside = join(ledger, "records.aside");
  let swaps = 0;
  let refused = 0;
  while (live()) {
    try {
      nodeFs.renameSync(records, aside);
    } catch {
      refused += 1; // a handle inside the directory makes NTFS refuse the rename: the race did not happen this round
      continue;
    }
    try {
      nodeFs.symlinkSync(outside, records, "junction");
      swaps += 1;
      const pause = Date.now() + 15;
      while (Date.now() < pause) { /* hold the junction in place for a moment */ }
      nodeFs.rmdirSync(records);
    } finally {
      nodeFs.renameSync(aside, records);
    }
  }
  out({ swaps, refused });
} else {
  process.stderr.write("unknown mode");
  process.exit(2);
}
