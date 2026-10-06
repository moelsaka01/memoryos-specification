import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as sdk from "../web/js/memoryos-sdk.js";

const { MemoryOS, MemoryOSHistoryError } = sdk;
const code = (expected, stage) => (error) => error instanceof MemoryOSHistoryError
  && error.code === `MO1308_${expected}` && (stage === undefined || error.stage === stage);
const bytes = (text = "{}") => new TextEncoder().encode(text);
const query = { kind: "MemoryOSHistoryQuery", version: "1.0.0", recordKinds: [], subject: null, retention: "ANY", fromIndex: 0, limit: 10 };
const digest = `sha256:${"a".repeat(64)}`;
const members = () => new Map([[digest, [{ name: "package.mip", bytes: bytes() }]]]);

async function mipCheckpoint(memory) {
  const encoded = await readFile(new URL("./fixtures/mip/complete-investigation.mip.b64", import.meta.url), "ascii");
  return memory.importPackage(new Uint8Array(Buffer.from(encoded.trim(), "base64")), { identifier: "mo1308-guard" }).checkpoint();
}

test("MO-1308 SDK exposes exactly the frozen history surface", () => {
  for (const name of ["createHistoryLedger", "admitHistoryRecord", "appendHistoryEntry", "tombstoneHistoryEntry",
    "verifyHistoryLedger", "queryHistoryLedger", "buildHistoryExport", "verifyHistoryExport"]) {
    assert.equal(typeof sdk[name], "function", name);
  }
  assert.equal(typeof MemoryOS.prototype.createHistoryCheckpointRecord, "function");
  assert.equal(typeof MemoryOSHistoryError, "function");
  assert.equal(sdk.MEMORYOS_SDK_VERSION, "1.2.0");
});

test("MO-1308 SDK well-formed calls reach the history authorities and report their frozen codes", () => {
  // Phase 2D replaced the Phase 1 fail-closed guard: a well-formed call now runs the real authority, so bad bytes are
  // integrity failures (section 14.1), never MO1308_INTERNAL.
  const created = sdk.createHistoryLedger({ ledgerName: "workspace.history", workspaceIdentifier: "workspace-investigation" });
  assert.ok(created.descriptorBytes instanceof Uint8Array);
  assert.match(created.ledgerIdentifier, /^sha256:[0-9a-f]{64}$/u);
  const corrupt = [
    () => sdk.verifyHistoryLedger({ descriptorBytes: bytes(), entries: [bytes()], members: members() }),
    () => sdk.queryHistoryLedger({ descriptorBytes: bytes(), entries: [], query }),
    () => sdk.buildHistoryExport({ descriptorBytes: bytes(), entries: [], members: new Map() }),
  ];
  for (const call of corrupt) assert.throws(call, (error) => code("LEDGER_CORRUPT", "VERIFICATION")(error) && error.exitCode === 3);
  assert.throws(() => sdk.verifyHistoryExport({ files: [{ path: "memoryos-history-ledger.json", bytes: bytes() }] }),
    (error) => code("EXPORT_CORRUPT", "VERIFICATION")(error) && error.exitCode === 3);
});

test("MO-1308 SDK rejects malformed arguments with the frozen codes", () => {
  const usage = [
    () => sdk.createHistoryLedger(), () => sdk.createHistoryLedger([]),
    () => sdk.createHistoryLedger({ ledgerName: "a", workspaceIdentifier: "w", extra: 1 }),
    () => sdk.createHistoryLedger({ ledgerName: "Upper", workspaceIdentifier: "w" }),
    () => sdk.createHistoryLedger({ ledgerName: "a", workspaceIdentifier: "" }),
    () => sdk.verifyHistoryLedger({ descriptorBytes: "{}", entries: [], members: new Map() }),
    () => sdk.verifyHistoryLedger({ descriptorBytes: bytes(), entries: [bytes(), "x"], members: new Map() }),
    () => sdk.verifyHistoryLedger({ descriptorBytes: bytes(), entries: [], members: {} }),
    () => sdk.verifyHistoryLedger({ descriptorBytes: bytes(), entries: [], members: new Map([["not-a-digest", []]]) }),
    () => sdk.verifyHistoryLedger({ descriptorBytes: new Uint8Array(new SharedArrayBuffer(2)), entries: [], members: new Map() }),
    () => sdk.verifyHistoryExport({ files: [{ path: "x", bytes: bytes(), extra: true }] }),
    () => sdk.admitHistoryRecord({ recordKind: "MIP_PACKAGE", members: [{ name: "package.mip", bytes: bytes() }], ledger: {} }),
    () => sdk.appendHistoryEntry({ ledger: {}, admission: {} }),
    () => sdk.tombstoneHistoryEntry({ ledger: {}, targetIndex: 0, reason: "PRIVACY_REQUEST", authorityReference: "PRIV-1" }),
    () => sdk.tombstoneHistoryEntry({ ledger: {}, targetIndex: 100000, reason: "PRIVACY_REQUEST", authorityReference: "PRIV-1" }),
    () => sdk.tombstoneHistoryEntry({ ledger: {}, targetIndex: 0, reason: "EXPIRED", authorityReference: "PRIV-1" }),
    () => sdk.tombstoneHistoryEntry({ ledger: {}, targetIndex: 0, reason: "PRIVACY_REQUEST", authorityReference: "" }),
  ];
  for (const call of usage) assert.throws(call, code("USAGE", "USAGE"));
  assert.throws(() => sdk.admitHistoryRecord({ recordKind: "INGESTION_REJECTED", members: [], ledger: {} }), code("RECORD_INVALID", "ADMISSION"));
  assert.throws(() => sdk.queryHistoryLedger({ descriptorBytes: bytes(), entries: [], query: { ...query, limit: 1001 } }), code("QUERY_INVALID"));
});

test("MO-1308 createHistoryCheckpointRecord accepts only this instance's Checkpoint and returns the admitted bytes", async () => {
  const memory = new MemoryOS(), other = new MemoryOS();
  const checkpoint = await mipCheckpoint(memory);
  assert.throws(() => other.createHistoryCheckpointRecord(checkpoint), code("USAGE", "USAGE"));
  assert.throws(() => memory.createHistoryCheckpointRecord({ ...checkpoint }), code("USAGE", "USAGE"));
  const record = memory.createHistoryCheckpointRecord(checkpoint);
  assert.ok(record instanceof Uint8Array);
  const projection = JSON.parse(new TextDecoder().decode(record));
  assert.deepEqual(Object.keys(projection).sort(), ["identifier", "investigationIdentifier", "kind", "stateDigest",
    "transitionCount", "transitionLog", "transitionLogDigest", "version", "workspaceIdentifier"]);
  assert.equal(projection.identifier, checkpoint.identifier);
  // The record is a history record, never a restore source (H14): it is a verifiable ledger member.
  const { descriptorBytes } = sdk.createHistoryLedger({ ledgerName: "workspace.history", workspaceIdentifier: checkpoint.workspaceIdentifier });
  const ledger = sdk.verifyHistoryLedger({ descriptorBytes, entries: [], members: new Map() });
  const admission = sdk.admitHistoryRecord({ recordKind: "INVESTIGATION_CHECKPOINT", members: [{ name: "checkpoint.json", bytes: record }], ledger });
  assert.equal(admission.admission, "CORE_LOG_VERIFIED_STATE_ISSUED");
});

test("MO-1308 SDK history surface performs no I/O and does not mutate inputs (R29)", async () => {
  const source = await readFile(new URL("../web/js/memoryos-sdk.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from\s+["']node:|require\(|child_process|powershell/iu);
  const input = { descriptorBytes: bytes('{"a":1}'), entries: [bytes()], members: members() };
  const before = JSON.stringify([...input.members.keys()]) + Buffer.from(input.descriptorBytes).toString("hex");
  assert.throws(() => sdk.verifyHistoryLedger(input), code("LEDGER_CORRUPT"));
  assert.equal(JSON.stringify([...input.members.keys()]) + Buffer.from(input.descriptorBytes).toString("hex"), before);
});
