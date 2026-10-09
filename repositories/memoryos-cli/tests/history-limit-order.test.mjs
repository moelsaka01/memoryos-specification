import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

import { createHistoryStore } from "../src/history-store.js";
import { checkpointRecord } from "./support/history-corpus.mjs";

// Amendment A11 (correction round 3): a Freeze section 14.2 limit must not be masked by a shape check. The 100,001st append used to fail
// the shape check of its would-be entry (index 100000 is outside the index range) and returned RECORD_INVALID instead of RESOURCE_LIMIT.
// The real SDK is exercised through a copy of the history modules whose two ledger limits are made tiny (3 entries, maximum index 2): the
// ordering logic under test is the unmodified production code, and no 100,000-entry ledger is needed.

const webDirectory = fileURLToPath(new URL("../../cca-studio/web/", import.meta.url));

async function tinyEngine(t, entries) {
  const copy = mkdtempSync(join(tmpdir(), "mo1308-tiny-sdk-"));
  t.after(() => rmSync(copy, { recursive: true, force: true }));
  cpSync(webDirectory, copy, { recursive: true });
  const contractFile = join(copy, "js", "memoryos-history-contract.js");
  const original = readFileSync(contractFile, "utf8");
  const patched = original.replace("entriesPerLedger: 100_000,", `entriesPerLedger: ${entries},`).replace("maximumIndex: 99_999,", `maximumIndex: ${entries - 1},`);
  assert.notEqual(patched, original, "the limits were found and replaced");
  assert.ok(patched.includes(`entriesPerLedger: ${entries},`) && patched.includes(`maximumIndex: ${entries - 1},`));
  writeFileSync(contractFile, patched);
  const sdk = await import(pathToFileURL(join(copy, "js", "memoryos-sdk.js")).href);
  return Object.freeze({
    MemoryOSHistoryError: sdk.MemoryOSHistoryError, admitHistoryRecord: sdk.admitHistoryRecord, appendHistoryEntry: sdk.appendHistoryEntry,
    buildHistoryExport: sdk.buildHistoryExport, createHistoryLedger: sdk.createHistoryLedger, queryHistoryLedger: sdk.queryHistoryLedger,
    tombstoneHistoryEntry: sdk.tombstoneHistoryEntry, verifyHistoryExport: sdk.verifyHistoryExport, verifyHistoryLedger: sdk.verifyHistoryLedger,
  });
}

function snapshot(directory) {
  const rows = [];
  const walk = (current, prefix) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path, `${prefix}${entry.name}/`);
      else rows.push(`${prefix}${entry.name}:${readFileSync(path).length}:${readFileSync(path).toString("base64")}`);
    }
  };
  walk(directory, "");
  return rows.sort().join("\n");
}

test("L01 a full ledger refuses the next append with RESOURCE_LIMIT before any shape check, and changes nothing", async (t) => {
  const engine = await tinyEngine(t, 3);
  const store = createHistoryStore({ engine });
  const root = mkdtempSync(join(tmpdir(), "mo1308-limit-order-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const ledger = join(root, "ledger");
  store.init(ledger, { ledgerName: "workspace.history", workspaceIdentifier: "workspace-investigation" });
  for (const label of ["one", "two", "three"]) assert.equal(typeof store.append(ledger, checkpointRecord(label)).index, "number");
  assert.equal(store.verify(ledger).entryCount, 3, "the ledger is exactly full");
  const before = snapshot(ledger);
  assert.throws(() => store.append(ledger, checkpointRecord("four")),
    (error) => error.code === "MO1308_RESOURCE_LIMIT" && error.stage === "PUBLICATION", "the next append is RESOURCE_LIMIT at the publication stage");
  assert.equal(snapshot(ledger), before, "nothing was written, staged or removed");
  assert.equal(store.verify(ledger).entryCount, 3);
});

test("L02 a ledger exactly at a limit of four accepts four appends and refuses the fifth with RESOURCE_LIMIT", async (t) => {
  const engine = await tinyEngine(t, 4);
  const store = createHistoryStore({ engine });
  const root = mkdtempSync(join(tmpdir(), "mo1308-limit-order-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const ledger = join(root, "ledger");
  store.init(ledger, { ledgerName: "workspace.history", workspaceIdentifier: "workspace-investigation" });
  for (const label of ["one", "two", "three", "four"]) assert.equal(typeof store.append(ledger, checkpointRecord(label)).index, "number");
  assert.throws(() => store.append(ledger, checkpointRecord("five")), (error) => error.code === "MO1308_RESOURCE_LIMIT");
});
