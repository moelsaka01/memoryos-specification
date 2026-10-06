import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import * as nodeFs from "node:fs";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync, symlinkSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import * as contract from "../../cca-studio/web/js/memoryos-history-contract.js";
import { executeHistoryCommand } from "../src/history-commands.js";
import { parseHistoryArguments } from "../src/history-arguments.js";
import {
  STORE_LAYOUT, STORE_LIMITS, STORE_MEMBER_NAMES, STORE_POLICY_MEMBERS, STORE_RECORD_FILE_MEMBER, STORE_RUN_MAX, STORE_SNAPSHOT_ATTEMPTS, createHistoryStore,
} from "../src/history-store.js";
import { createHistoryEngine } from "./support/history-engine.mjs";
import { bundleDirectory, checkpointRecord, mipBytes, policyFiles, policyRecord } from "./support/history-corpus.mjs";

// MO-1308 Contract Freeze 1, Stream 2C: the file store and command layer, against the frozen SDK
// signatures only; Stream 2D runs it against the real SDK functions (tests/support/history-engine.mjs) with real records
// (tests/support/history-corpus.mjs). Tests that need native Windows (junctions, reparse points,
// pinned Node v24.21.0) are Windows-host items in docs/mo1308-phase2c-store.md.
const here = fileURLToPath(new URL("./", import.meta.url));
const engine = createHistoryEngine();
const enc = new TextEncoder();
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const code = (expected, stage) => (error) => error instanceof contract.MemoryOSHistoryError && error.code === `MO1308_${expected}`
  && (stage === undefined || error.stage === stage);

function scratch(t) {
  const root = mkdtempSync(join(tmpdir(), "memoryos-history-store-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
// Real admissible records (Stream 2D): a distinct real checkpoint per label, and the released Policy pairs.
const mip = (label) => checkpointRecord(label);
const MEMBER = "checkpoint.json";
const policy = (label) => policyRecord(label === "two" ? 0 : 1);
function newLedger(t, store = createHistoryStore({ engine })) {
  const root = scratch(t);
  const ledger = join(root, "ledger");
  store.init(ledger, { ledgerName: "workspace.history", workspaceIdentifier: "workspace-investigation" });
  return { root, ledger, store };
}

// A snapshot of every file under a directory: bytes, inode and size (R06: no file is ever modified).
function snapshot(directory) {
  const result = new Map();
  const walk = (current) => {
    for (const name of readdirSync(current).sort()) {
      const full = join(current, name);
      const st = lstatSync(full, { bigint: true });
      if (st.isDirectory()) walk(full);
      else result.set(relative(directory, full).split("\\").join("/"), `${st.ino}:${st.size}:${sha(readFileSync(full))}`);
    }
  };
  walk(directory);
  return result;
}
const treeNames = (directory) => [...snapshot(directory).keys()];
const snapshotBytes = (directory) => [...snapshotRaw(directory)];
function snapshotRaw(directory) {
  const result = new Map();
  const walk = (current) => {
    for (const name of readdirSync(current).sort()) {
      const full = join(current, name);
      if (lstatSync(full).isDirectory()) walk(full); else result.set(relative(directory, full).split("\\").join("/"), sha(readFileSync(full)));
    }
  };
  walk(directory);
  return result;
}


// An fs whose mutating calls can be counted, made to fail, or intercepted (interruption, race and swap tests).
const MUTATING = ["mkdirSync", "openSync", "writeSync", "fsyncSync", "linkSync", "unlinkSync", "rmdirSync", "renameSync"];
function instrumentedFs({ failAt = -1, before = null } = {}) {
  const calls = [];
  const api = { ...nodeFs };
  for (const name of MUTATING) {
    api[name] = (...args) => {
      const writing = name !== "openSync" || (typeof args[1] === "number" && (args[1] & nodeFs.constants.O_CREAT) !== 0);
      if (!writing) return nodeFs[name](...args);
      const index = calls.length;
      calls.push({ name, path: typeof args[0] === "string" ? args[0] : null, second: typeof args[1] === "string" ? args[1] : null });
      if (before !== null) before(name, args, index);
      if (index === failAt) throw Object.assign(new Error("injected fault"), { code: "EIO" });
      return nodeFs[name](...args);
    };
  }
  api.calls = calls;
  return api;
}

test("T01 store constants equal the Freeze contract module (layout, limits, member names)", () => {
  assert.deepEqual({ descriptor: STORE_LAYOUT.descriptor, entries: STORE_LAYOUT.entries, records: STORE_LAYOUT.records, pending: STORE_LAYOUT.pending,
    entryDigits: STORE_LAYOUT.entryDigits, exportManifest: STORE_LAYOUT.exportManifest, exportComplete: STORE_LAYOUT.exportComplete },
  { descriptor: contract.MEMORYOS_HISTORY_LAYOUT.descriptor, entries: contract.MEMORYOS_HISTORY_LAYOUT.entriesDirectory,
    records: contract.MEMORYOS_HISTORY_LAYOUT.recordsDirectory, pending: contract.MEMORYOS_HISTORY_LAYOUT.pendingDirectory,
    entryDigits: contract.MEMORYOS_HISTORY_LAYOUT.entryIndexDigits, exportManifest: contract.MEMORYOS_HISTORY_LAYOUT.exportManifest,
    exportComplete: contract.MEMORYOS_HISTORY_LAYOUT.exportComplete });
  assert.equal(STORE_LIMITS.entries, contract.MEMORYOS_HISTORY_LIMITS.entriesPerLedger);
  assert.equal(STORE_LIMITS.entryBytes, contract.MEMORYOS_HISTORY_LIMITS.entryBytes);
  assert.equal(STORE_LIMITS.descriptorBytes, contract.MEMORYOS_HISTORY_LIMITS.descriptorBytes);
  assert.equal(STORE_LIMITS.reported, contract.MEMORYOS_HISTORY_LIMITS.reportedAnomalies);
  assert.equal(STORE_LIMITS.stdoutBytes, contract.MEMORYOS_HISTORY_LIMITS.cliJsonStdoutBytes);
  assert.deepEqual([...STORE_MEMBER_NAMES], [...contract.MEMBER_NAMES]);
  for (const name of contract.MEMBER_NAMES) {
    const owners = Object.values(contract.RECORD_MEMBER_RULES).filter((rule) => rule.memberSets.flat().includes(name));
    assert.equal(STORE_LIMITS.memberBytes[name], Math.max(...owners.map((rule) => rule.memberBytes)), name);
  }
  for (const [kind, rule] of Object.entries(STORE_RECORD_FILE_MEMBER)) {
    assert.deepEqual(contract.RECORD_MEMBER_RULES[kind].memberSets, [[rule.name]], kind);
    assert.equal(contract.RECORD_MEMBER_RULES[kind].memberBytes, rule.maxBytes, kind);
  }
  assert.deepEqual(contract.RECORD_MEMBER_RULES.POLICY_EVALUATION.memberSets, [[STORE_POLICY_MEMBERS.identity, STORE_POLICY_MEMBERS.outcome]]);
  assert.equal(contract.RECORD_MEMBER_RULES.POLICY_EVALUATION.memberBytes, STORE_POLICY_MEMBERS.maxBytes);
  assert.equal(contract.RECORD_MEMBER_RULES.CICD_RUN.totalBytes, STORE_RUN_MAX.totalBytes);
  assert.equal(contract.RECORD_MEMBER_RULES.CICD_RUN.memberSets[0].length, STORE_RUN_MAX.files);
});

test("T02 init creates exactly the frozen layout once; an existing target or a missing parent is refused (section 9.1)", (t) => {
  const { root, ledger, store } = newLedger(t);
  assert.deepEqual(treeNames(ledger), ["memoryos-history-ledger.json"]);
  assert.deepEqual(readdirSync(ledger).sort(), [".pending", "entries", "memoryos-history-ledger.json", "records"]);
  assert.deepEqual(readdirSync(join(ledger, ".pending")), [], "staging is removed");
  const descriptor = readFileSync(join(ledger, "memoryos-history-ledger.json"));
  assert.deepEqual(JSON.parse(descriptor.toString()), { kind: "MemoryOSHistoryLedger", version: "1.0.0", ledgerName: "workspace.history", workspaceIdentifier: "workspace-investigation" });
  assert.throws(() => store.init(ledger, { ledgerName: "workspace.history", workspaceIdentifier: "workspace-investigation" }), code("LEDGER_EXISTS"));
  assert.deepEqual(readFileSync(join(ledger, "memoryos-history-ledger.json")), descriptor, "an existing ledger is never changed");
  assert.throws(() => store.init(join(root, "missing", "ledger"), { ledgerName: "a", workspaceIdentifier: "w" }), code("FILESYSTEM_BOUNDARY"));
  assert.throws(() => store.init(root, { ledgerName: "a", workspaceIdentifier: "w" }), code("LEDGER_EXISTS"));
  assert.equal(store.verify(ledger).entryCount, 0);
  assert.throws(() => store.verify(join(root, "nothing")), code("LEDGER_NOT_FOUND"));
  mkdirSync(join(root, "empty"));
  assert.throws(() => store.verify(join(root, "empty")), code("LEDGER_NOT_FOUND"));
  assert.throws(() => store.verify(""), code("USAGE"));
  assert.throws(() => store.verify("a\0b"), code("USAGE"));
});

test("T03 append publishes members, then the entry; every earlier file is untouched (R06, R15)", (t) => {
  const { ledger, store } = newLedger(t);
  const first = store.append(ledger, mip("one"));
  assert.equal(first.index, 0);
  const afterFirst = snapshot(ledger);
  const names = [...afterFirst.keys()];
  assert.ok(names.includes("entries/00000000000000000000.json"));
  assert.equal(names.filter((name) => name.startsWith("records/")).length, 1);
  assert.deepEqual(readdirSync(join(ledger, ".pending")), []);
  const second = store.append(ledger, policy("two"));
  assert.equal(second.index, 1);
  const afterSecond = snapshot(ledger);
  for (const [name, value] of afterFirst) assert.equal(afterSecond.get(name), value, `${name} is unchanged (same inode, size and bytes)`);
  const verification = store.verify(ledger);
  assert.deepEqual([verification.entryCount, verification.retainedRecords, verification.purgedRecords, verification.pendingArtifacts], [2, 2, 0, 0]);
  assert.equal(verification.headDigest, second.entryDigest);
  const entry = JSON.parse(readFileSync(join(ledger, "entries/00000000000000000001.json"), "utf8"));
  assert.equal(entry.record.recordKind, "POLICY_EVALUATION");
  const hex = entry.record.recordDigest.slice(7);
  assert.deepEqual(readdirSync(join(ledger, "records", hex)).sort(), ["evaluation-identity.json", "policy-outcome.json"]);
  assert.deepEqual(new Uint8Array(readFileSync(join(ledger, "records", hex, "policy-outcome.json"))), policy("two").members[1].bytes);
});

test("T04 rejected appends change nothing: duplicates, wrong members, purged re-supply (R09, R10, R20)", (t) => {
  const { ledger, store } = newLedger(t);
  store.append(ledger, mip("one"));
  const before = snapshot(ledger);
  assert.throws(() => store.append(ledger, mip("one")), code("RECORD_DUPLICATE", "ADMISSION"));
  assert.throws(() => store.append(ledger, { recordKind: "MIP_PACKAGE", members: [{ name: "checkpoint.json", bytes: new Uint8Array(1) }] }), code("RECORD_INVALID"));
  assert.throws(() => store.append(ledger, { recordKind: "NATIVE", members: mip("x").members }), code("RECORD_INVALID"));
  assert.deepEqual(snapshot(ledger), before, "no file, no staging name and no record directory was created");
  store.tombstone(ledger, { targetIndex: 0, reason: "PRIVACY_REQUEST", authorityReference: "P-1" });
  const afterPurge = snapshot(ledger);
  assert.throws(() => store.append(ledger, mip("one")), code("RECORD_PURGED", "ADMISSION"));
  assert.deepEqual(snapshot(ledger), afterPurge);
});

test("T05 the commit point is exclusive creation of entries/<n>.json: a lost race is LEDGER_CONFLICT and publishes nothing (R15, H41)", (t) => {
  const { ledger, store } = newLedger(t);
  store.append(ledger, mip("base"));
  const rival = createHistoryStore({ engine });
  let raced = false;
  const racingFs = instrumentedFs({ before: (name, args) => {
    if (!raced && name === "linkSync" && /entries[\\/]00000000000000000001\.json$/u.test(String(args[1]))) {
      raced = true;
      rival.append(ledger, mip("winner")); // the rival commits entry 1 between this writer's read and its commit
    }
  } });
  const loser = createHistoryStore({ engine, fs: racingFs });
  assert.throws(() => loser.append(ledger, mip("loser")), code("LEDGER_CONFLICT", "PUBLICATION"));
  assert.ok(raced);
  const verification = store.verify(ledger);
  assert.equal(verification.entryCount, 2);
  const entry = JSON.parse(readFileSync(join(ledger, "entries/00000000000000000001.json"), "utf8"));
  assert.equal(entry.record.members[0].sha256, `sha256:${sha(mip("winner").members[0].bytes)}`, "the winner's entry is intact");
  // The loser's record members are an unreferenced record, never history; verify discloses them and never deletes them.
  assert.equal(verification.unreferencedRecords.length, 1);
  assert.equal(verification.pendingArtifacts, 0);
  // The loser may retry after re-reading.
  assert.equal(store.append(ledger, mip("loser")).index, 2);
  assert.equal(store.verify(ledger).unreferencedRecords.length, 0);
});

test("T06 interruption at every mutating step before the commit point publishes nothing; after it, a complete entry (R16)", (t) => {
  const probe = newLedger(t);
  probe.store.append(probe.ledger, mip("base"));
  const counting = instrumentedFs();
  createHistoryStore({ engine, fs: counting }).append(probe.ledger, policy("target"));
  const steps = counting.calls.length;
  assert.ok(steps > 10);
  let before = 0, after = 0;
  for (let failAt = 0; failAt < steps; failAt += 1) {
    const { ledger, store } = newLedger(t);
    store.append(ledger, mip("base"));
    const faulty = instrumentedFs({ failAt });
    let error = null;
    try { createHistoryStore({ engine, fs: faulty }).append(ledger, policy("target")); } catch (caught) { error = caught; }
    const committed = nodeFs.existsSync(join(ledger, "entries/00000000000000000001.json"));
    const verification = store.verify(ledger); // a complete or absent entry: the chain always verifies
    if (!committed) {
      before += 1;
      assert.ok(error instanceof contract.MemoryOSHistoryError, `step ${failAt}: a failure before the commit reports a history error`);
      assert.equal(verification.entryCount, 1, `step ${failAt}: nothing published`);
    } else {
      after += 1;
      assert.equal(verification.entryCount, 2, `step ${failAt}: the committed entry is complete`);
      assert.equal(verification.retainedRecords, 2);
    }
    // Disclosed anomalies never break integrity, verify never deletes them, and the ledger stays usable.
    const before2 = snapshot(ledger);
    store.verify(ledger);
    assert.deepEqual(snapshot(ledger), before2, `step ${failAt}: verify never writes`);
    if (!committed) assert.equal(store.append(ledger, policy("target")).index, 1, `step ${failAt}: retry succeeds`);
  }
  assert.ok(before >= 8 && after >= 1, `before ${before} after ${after}`);
});

test("T07 tombstone commits first, then purges every member; the chain still verifies (R18, R19, section 10.2)", (t) => {
  const { ledger, store } = newLedger(t);
  store.append(ledger, mip("one"));
  store.append(ledger, policy("two"));
  const targetEntry = JSON.parse(readFileSync(join(ledger, "entries/00000000000000000001.json"), "utf8"));
  const hex = targetEntry.record.recordDigest.slice(7);
  const done = store.tombstone(ledger, { targetIndex: 1, reason: "LEGAL_REQUIREMENT", authorityReference: "CASE-7" });
  assert.equal(done.index, 2);
  assert.equal(nodeFs.existsSync(join(ledger, "records", hex)), false, "the emptied record directory is removed");
  const tombstone = JSON.parse(readFileSync(join(ledger, "entries/00000000000000000002.json"), "utf8"));
  assert.deepEqual(tombstone.tombstone, { targetIndex: 1, targetEntryDigest: targetEntry.entryDigest, targetRecordDigest: targetEntry.record.recordDigest,
    reason: "LEGAL_REQUIREMENT", authorityReference: "CASE-7", authenticity: "NOT_VERIFIED_BY_MEMORYOS" });
  const verification = store.verify(ledger);
  assert.deepEqual([verification.entryCount, verification.retainedRecords, verification.purgedRecords, verification.tombstones, verification.purgePending], [3, 1, 1, 1, []]);
  assert.throws(() => store.tombstone(ledger, { targetIndex: 1, reason: "LEGAL_REQUIREMENT", authorityReference: "CASE-7" }), code("TOMBSTONE_INVALID"));
  assert.throws(() => store.tombstone(ledger, { targetIndex: 2, reason: "PRIVACY_REQUEST", authorityReference: "x" }), code("TOMBSTONE_INVALID"));
  assert.throws(() => store.tombstone(ledger, { targetIndex: 9, reason: "PRIVACY_REQUEST", authorityReference: "x" }), code("TOMBSTONE_INVALID"));
  assert.equal(store.verify(ledger).entryCount, 3);
});

test("T08 a crash during purge leaves purgePending; re-running the same command finishes it without a new entry (section 10.2)", (t) => {
  const probe = newLedger(t);
  probe.store.append(probe.ledger, policy("target"));
  const counting = instrumentedFs();
  createHistoryStore({ engine, fs: counting }).tombstone(probe.ledger, { targetIndex: 0, reason: "PRIVACY_REQUEST", authorityReference: "P-1" });
  const unlinks = counting.calls.map((call, index) => [call, index]).filter(([call]) => call.name === "unlinkSync");
  assert.ok(unlinks.length >= 2);
  let interrupted = 0;
  for (const [, failAt] of counting.calls.map((call, index) => [call, index]).filter(([call]) => ["unlinkSync", "rmdirSync"].includes(call.name))) {
    const { ledger, store } = newLedger(t);
    store.append(ledger, policy("target"));
    const faulty = instrumentedFs({ failAt });
    const entriesBefore = readdirSync(join(ledger, "entries")).length;
    let error = null;
    try { createHistoryStore({ engine, fs: faulty }).tombstone(ledger, { targetIndex: 0, reason: "PRIVACY_REQUEST", authorityReference: "P-1" }); } catch (caught) { error = caught; }
    assert.equal(readdirSync(join(ledger, "entries")).length, entriesBefore + 1, "the tombstone entry was committed before any deletion");
    const verification = store.verify(ledger);
    if (error !== null) {
      interrupted += 1;
      assert.ok(verification.purgePending.includes(0) || verification.purgedRecords === 1);
    }
    if (verification.purgePending.length > 0) {
      assert.throws(() => store.tombstone(ledger, { targetIndex: 0, reason: "DATA_MINIMIZATION", authorityReference: "P-1" }), code("TOMBSTONE_INVALID"), "a different command is not a re-run");
      const resumed = store.tombstone(ledger, { targetIndex: 0, reason: "PRIVACY_REQUEST", authorityReference: "P-1" });
      assert.equal(resumed.index, 1, "the existing tombstone entry is reported, none is appended");
      assert.equal(readdirSync(join(ledger, "entries")).length, entriesBefore + 1);
    }
    const final = store.verify(ledger);
    assert.deepEqual([final.purgePending, final.purgedRecords, final.entryCount], [[], 1, 2]);
    // Every member is gone; only emptied directories may remain (their removal is cosmetic and best effort).
    assert.deepEqual(treeNames(join(ledger, "records")), [], "no member file remains");
  }
  assert.ok(interrupted >= 2);
});

test("T09 verify fails closed on every layout defect (section 11.1)", (t) => {
  const { ledger, store } = newLedger(t);
  store.append(ledger, mip("one"));
  store.append(ledger, mip("two"));
  assert.equal(store.verify(ledger).entryCount, 2);
  const hex = readdirSync(join(ledger, "records"))[0];
  const entry = (index) => join(ledger, "entries", `${String(index).padStart(20, "0")}.json`);
  const attempt = (label, expected, setup, undo) => {
    setup();
    try { assert.throws(() => store.verify(ledger), code(expected), label); } finally { undo(); }
    assert.equal(store.verify(ledger).entryCount, 2, `${label}: restored`);
  };
  attempt("extra root file", "LEDGER_CORRUPT", () => writeFileSync(join(ledger, "stray.txt"), "x"), () => rmSync(join(ledger, "stray.txt")));
  attempt("foreign file among entries", "LEDGER_CORRUPT", () => writeFileSync(join(ledger, "entries", "readme.txt"), "x"), () => rmSync(join(ledger, "entries", "readme.txt")));
  attempt("gap in the entry names", "LEDGER_CORRUPT", () => writeFileSync(entry(3), "{}"), () => rmSync(entry(3)));
  attempt("first entry missing", "LEDGER_CORRUPT", () => nodeFs.renameSync(entry(0), join(ledger, "moved-entry")), () => nodeFs.renameSync(join(ledger, "moved-entry"), entry(0)));
  const swapBytes = [readFileSync(entry(0)), readFileSync(entry(1))];
  attempt("entries reordered", "LEDGER_CORRUPT", () => { writeFileSync(entry(0), swapBytes[1]); writeFileSync(entry(1), swapBytes[0]); }, () => { writeFileSync(entry(0), swapBytes[0]); writeFileSync(entry(1), swapBytes[1]); });
  const descriptor = join(ledger, "memoryos-history-ledger.json");
  const savedDescriptor = readFileSync(descriptor);
  const other = createHistoryStore({ engine }).init(join(scratch(t), "other"), { ledgerName: "other.history", workspaceIdentifier: "workspace-investigation" });
  void other;
  attempt("descriptor substituted", "LEDGER_CORRUPT", () => writeFileSync(descriptor, savedDescriptor.toString().replace("workspace.history", "workspace.hist0ry")), () => writeFileSync(descriptor, savedDescriptor));
  attempt("record directory that is not a digest", "LEDGER_CORRUPT", () => mkdirSync(join(ledger, "records", "not-a-digest")), () => rmSync(join(ledger, "records", "not-a-digest"), { recursive: true }));
  attempt("unknown file in a record directory", "LEDGER_CORRUPT", () => writeFileSync(join(ledger, "records", hex, "notes.txt"), "x"), () => rmSync(join(ledger, "records", hex, "notes.txt")));
  attempt("foreign member name in a record directory", "RECORD_BYTES_MISMATCH", () => writeFileSync(join(ledger, "records", hex, "package.mip"), "x"), () => rmSync(join(ledger, "records", hex, "package.mip")));
  const member = join(ledger, "records", hex, MEMBER);
  const memberBytes = readFileSync(member);
  attempt("member missing", "RECORD_BYTES_MISMATCH", () => rmSync(member), () => writeFileSync(member, memberBytes));
  attempt("member replaced by a shorter file", "RECORD_BYTES_MISMATCH", () => writeFileSync(member, "short"), () => writeFileSync(member, memberBytes));
  assert.deepEqual(store.verify(ledger).purgePending, []);
});

test("T10 verify reports staging and unreferenced artifacts; tampered bytes fail closed (R21)", (t) => {
  const { ledger, store } = newLedger(t);
  store.append(ledger, mip("one"));
  const original = snapshot(ledger);
  writeFileSync(join(ledger, ".pending", "leftover.0"), "x");
  writeFileSync(join(ledger, ".pending", "leftover.1"), "y");
  const orphan = "ab".repeat(32);
  mkdirSync(join(ledger, "records", orphan));
  writeFileSync(join(ledger, "records", orphan, MEMBER), "orphan");
  const verification = store.verify(ledger);
  assert.equal(verification.pendingArtifacts, 2);
  assert.deepEqual(verification.unreferencedRecords, [`sha256:${orphan}`]);
  assert.equal(verification.entryCount, 1);
  assert.ok(nodeFs.existsSync(join(ledger, ".pending", "leftover.0")), "verify never deletes");
  // An empty directory under records is not an unreferenced record.
  mkdirSync(join(ledger, "records", "cd".repeat(32)));
  assert.deepEqual(store.verify(ledger).unreferencedRecords, [`sha256:${orphan}`]);
  // Staging leftovers do not block the next append, which uses the next free staging name.
  assert.equal(store.append(ledger, mip("two")).index, 1);
  assert.equal(store.verify(ledger).pendingArtifacts, 2);
  void original;
  // Tampering: single-byte flips of the descriptor, an entry and a member.
  const targets = [join(ledger, "memoryos-history-ledger.json"), join(ledger, "entries/00000000000000000001.json")];
  const hex = JSON.parse(readFileSync(targets[1], "utf8")).record.recordDigest.slice(7);
  targets.push(join(ledger, "records", hex, MEMBER));
  for (const target of targets) {
    const bytes = readFileSync(target);
    for (const position of [0, Math.floor(bytes.length / 2), bytes.length - 1]) {
      const flipped = Buffer.from(bytes); flipped[position] ^= 1;
      writeFileSync(target, flipped);
      assert.throws(() => store.verify(ledger), (error) => error instanceof contract.MemoryOSHistoryError && error.exitCode === 3, `${target} ${position}`);
    }
    writeFileSync(target, bytes);
  }
  assert.equal(store.verify(ledger).entryCount, 2);
  // Oversized files are refused before they are read in full.
  writeFileSync(join(ledger, "entries/00000000000000000001.json"), Buffer.alloc(16_385));
  assert.throws(() => store.verify(ledger), code("RESOURCE_LIMIT"));
});

function symlinkOrSkip(t, target, path) {
  try {
    symlinkSync(target, path);
    return true;
  } catch {
    t.skip("symbolic links are not creatable on this host (Windows-host item)");
    return false;
  }
}

test("T11 filesystem boundary: a link anywhere on the path or inside the ledger fails closed on every operation (R17, H40)", (t) => {
  const { root, ledger, store } = newLedger(t);
  store.append(ledger, mip("one"));
  const outside = join(root, "outside");
  mkdirSync(outside);
  // The ledger root, an ancestor, and each directory and file inside it.
  const attacks = [];
  const link = join(root, "link-to-ledger");
  if (!symlinkOrSkip(t, ledger, link)) return;
  attacks.push(["root is a link", () => store.verify(link)]);
  const parentLink = join(root, "link-to-parent");
  symlinkSync(root, parentLink);
  attacks.push(["an ancestor is a link", () => store.verify(join(parentLink, "ledger"))]);
  attacks.push(["append through a link", () => store.append(link, mip("x"))]);
  attacks.push(["query through a link", () => store.query(link, { kind: "MemoryOSHistoryQuery", version: "1.0.0", recordKinds: [], subject: null, retention: "ANY", fromIndex: 0, limit: 10 })]);
  attacks.push(["export through a link", () => store.exportLedger(link, join(root, "export-through-link"))]);
  attacks.push(["tombstone through a link", () => store.tombstone(link, { targetIndex: 0, reason: "PRIVACY_REQUEST", authorityReference: "x" })]);
  attacks.push(["init under a linked parent", () => store.init(join(parentLink, "new-ledger"), { ledgerName: "a", workspaceIdentifier: "w" })]);
  for (const [label, attack] of attacks) assert.throws(attack, code("FILESYSTEM_BOUNDARY"), label);
  assert.deepEqual(readdirSync(outside), []);
  assert.equal(nodeFs.existsSync(join(root, "export-through-link")), false);
  assert.equal(nodeFs.existsSync(join(root, "new-ledger")), false);

  const swap = (name, makeLink) => {
    const original = join(ledger, name);
    const moved = join(root, `moved-${name.replace(/\W/gu, "_")}`);
    nodeFs.renameSync(original, moved);
    makeLink(original);
    try {
      assert.throws(() => store.verify(ledger), code("FILESYSTEM_BOUNDARY"), `${name} as a link: verify`);
      assert.throws(() => store.append(ledger, mip("y")), code("FILESYSTEM_BOUNDARY"), `${name} as a link: append`);
    } finally {
      rmSync(original, { recursive: true, force: true });
      nodeFs.renameSync(moved, original);
    }
    assert.equal(store.verify(ledger).entryCount, 1, `${name} restored`);
  };
  swap("entries", (path) => symlinkSync(join(root, "moved-entries"), path));
  swap("records", (path) => symlinkSync(join(root, "moved-records"), path));
  swap(".pending", (path) => symlinkSync(join(root, "moved-_pending"), path));
  swap("memoryos-history-ledger.json", (path) => symlinkSync(join(root, "moved-memoryos_history_ledger_json"), path));
  const entryPath = join(ledger, "entries/00000000000000000000.json");
  const entryBytes = readFileSync(entryPath);
  const decoy = join(outside, "decoy.json");
  writeFileSync(decoy, entryBytes);
  rmSync(entryPath);
  symlinkSync(decoy, entryPath);
  assert.throws(() => store.verify(ledger), code("FILESYSTEM_BOUNDARY"), "an entry file that is a link");
  rmSync(entryPath);
  writeFileSync(entryPath, entryBytes);
  const hex = readdirSync(join(ledger, "records"))[0];
  const memberPath = join(ledger, "records", hex, MEMBER);
  const memberBytes = readFileSync(memberPath);
  writeFileSync(join(outside, "member"), memberBytes);
  rmSync(memberPath);
  symlinkSync(join(outside, "member"), memberPath);
  assert.throws(() => store.verify(ledger), code("FILESYSTEM_BOUNDARY"), "a member file that is a link");
  rmSync(memberPath);
  writeFileSync(memberPath, memberBytes);
  assert.equal(store.verify(ledger).entryCount, 1);
});

test("T12 a handle/path identity mismatch fails closed (H40)", (t) => {
  const { ledger, store } = newLedger(t);
  const lying = { ...nodeFs, fstatSync: (fd, options) => { const st = nodeFs.fstatSync(fd, options); return { ...st, ino: st.ino + 1n, isFile: () => st.isFile(), isDirectory: () => st.isDirectory(), isSymbolicLink: () => st.isSymbolicLink() }; } };
  const stolen = createHistoryStore({ engine, fs: lying });
  assert.throws(() => stolen.verify(ledger), code("FILESYSTEM_BOUNDARY")); // read identity
  assert.throws(() => stolen.append(ledger, mip("x")), code("FILESYSTEM_BOUNDARY"));
  assert.equal(store.verify(ledger).entryCount, 0, "nothing was published");
});

test("T12b a published name whose identity differs from the staged file is detected after the link (H40)", (t) => {
  const { ledger, store } = newLedger(t);
  let linked = false;
  const lying = { ...nodeFs,
    linkSync: (existing, created) => { nodeFs.linkSync(existing, created); if (/entries[\\/]00000000000000000000\.json$/u.test(String(created))) linked = true; },
    lstatSync: (path, options) => {
      const st = nodeFs.lstatSync(path, options);
      return linked && /entries[\\/]00000000000000000000\.json$/u.test(String(path))
        ? { ...st, ino: st.ino + 7n, isFile: () => st.isFile(), isDirectory: () => st.isDirectory(), isSymbolicLink: () => st.isSymbolicLink() } : st;
    } };
  assert.throws(() => createHistoryStore({ engine, fs: lying }).append(ledger, mip("identity")), code("FILESYSTEM_BOUNDARY", "PUBLICATION"));
  assert.ok(linked);
  // The mismatch is reported after the fact: the new name exists, was never overwritten, and a normal read still verifies the chain.
  assert.equal(store.verify(ledger).entryCount, 1);
});

test("T13 a directory swapped for a link during an append is detected after the fact; no content is overwritten; reads then fail closed (H40 risk acceptance)", (t) => {
  const { root, ledger, store } = newLedger(t);
  const outside = join(root, "outside");
  mkdirSync(outside);
  const recordHex = (() => { const probe = newLedger(t); probe.store.append(probe.ledger, mip("swap")); return readdirSync(join(probe.ledger, "records"))[0]; })();
  // Plant a different decoy under the name the member will be linked to: the link must never replace it.
  writeFileSync(join(outside, MEMBER), "decoy that must survive");
  let swapped = false;
  const swapping = instrumentedFs({ before: (name, args) => {
    if (!swapped && name === "linkSync" && String(args[1]).includes(recordHex)) {
      swapped = true;
      rmSync(join(ledger, "records", recordHex), { recursive: true });
      if (!symlinkOrSkip(t, outside, join(ledger, "records", recordHex))) swapped = false;
    }
  } });
  const attacked = createHistoryStore({ engine, fs: swapping });
  let error = null;
  try { attacked.append(ledger, mip("swap")); } catch (caught) { error = caught; }
  if (!swapped) return;
  assert.ok(error instanceof contract.MemoryOSHistoryError, "the swap is detected");
  assert.ok(["MO1308_FILESYSTEM_BOUNDARY", "MO1308_RECORD_BYTES_MISMATCH"].includes(error.code), error.code);
  assert.equal(readFileSync(join(outside, MEMBER), "utf8"), "decoy that must survive", "existing content is never overwritten or replaced");
  assert.equal(nodeFs.existsSync(join(ledger, "entries/00000000000000000000.json")), false, "the entry was never committed");
  assert.throws(() => store.verify(ledger), code("FILESYSTEM_BOUNDARY"), "every subsequent read fails closed");
  assert.throws(() => store.append(ledger, mip("again")), code("FILESYSTEM_BOUNDARY"));
});

test("T13b the same swap with no decoy is detected after the link: a boundary failure, the entry is never committed (H40)", (t) => {
  const { root, ledger, store } = newLedger(t);
  const outside = join(root, "outside");
  mkdirSync(outside);
  const hex = (() => { const probe = newLedger(t); probe.store.append(probe.ledger, mip("swap2")); return readdirSync(join(probe.ledger, "records"))[0]; })();
  let swapped = false;
  const swapping = instrumentedFs({ before: (name, args) => {
    if (!swapped && name === "linkSync" && String(args[1]).includes(hex)) {
      swapped = true;
      rmSync(join(ledger, "records", hex), { recursive: true });
      if (!symlinkOrSkip(t, outside, join(ledger, "records", hex))) swapped = false;
    }
  } });
  assert.throws(() => (swapped = false, createHistoryStore({ engine, fs: swapping }).append(ledger, mip("swap2"))), (error) => error instanceof contract.MemoryOSHistoryError && (swapped === false || error.code === "MO1308_FILESYSTEM_BOUNDARY"));
  if (!swapped) return;
  assert.equal(nodeFs.existsSync(join(ledger, "entries/00000000000000000000.json")), false);
  assert.throws(() => store.verify(ledger), code("FILESYSTEM_BOUNDARY"));
});

test("T14 export is written once, marker last, byte-identical for equal ledgers, and verify-export fails closed (R23, section 12)", (t) => {
  const first = newLedger(t), second = newLedger(t);
  for (const { ledger, store } of [first, second]) {
    store.append(ledger, mip("one"));
    store.append(ledger, policy("two"));
    store.append(ledger, mip("three"));
    store.tombstone(ledger, { targetIndex: 0, reason: "PRIVACY_REQUEST", authorityReference: "P-1" });
  }
  const a = join(first.root, "export"), b = join(second.root, "export");
  const summary = first.store.exportLedger(first.ledger, a);
  second.store.exportLedger(second.ledger, b);
  assert.equal(summary.entryCount, 4);
  assert.deepEqual(snapshotBytes(a), snapshotBytes(b), "equal ledgers give byte-identical exports");
  const names = treeNames(a);
  assert.ok(names.includes("memoryos-history-export.json") && names.includes("memoryos-history-export-complete.json"));
  assert.equal(names.filter((name) => name.startsWith("entries/")).length, 4);
  assert.equal(names.filter((name) => name.startsWith("records/")).length, 3, "retained members only: the purged record has no bytes");
  assert.equal(first.store.verifyExport(a).entryCount, 4);
  assert.throws(() => first.store.exportLedger(first.ledger, a), code("LEDGER_EXISTS"));
  assert.throws(() => first.store.exportLedger(first.ledger, join(first.root, "nope", "export")), code("FILESYSTEM_BOUNDARY"));
  // The marker is the commit point: without it the export is incomplete and verify-export refuses it.
  rmSync(join(a, "memoryos-history-export-complete.json"));
  assert.throws(() => first.store.verifyExport(a), code("EXPORT_CORRUPT"));
  // An interruption before the marker leaves no marker.
  const interruptedPath = join(first.root, "interrupted");
  const counting = instrumentedFs();
  createHistoryStore({ engine, fs: counting }).exportLedger(first.ledger, join(first.root, "probe-export"));
  const markerWrite = counting.calls.map((call, index) => [call, index]).filter(([call]) => call.name === "openSync").at(-1)[1];
  const faulty = instrumentedFs({ failAt: markerWrite });
  assert.throws(() => createHistoryStore({ engine, fs: faulty }).exportLedger(first.ledger, interruptedPath), (error) => error instanceof contract.MemoryOSHistoryError);
  assert.equal(nodeFs.existsSync(join(interruptedPath, "memoryos-history-export-complete.json")), false);
  assert.throws(() => first.store.verifyExport(interruptedPath), code("EXPORT_CORRUPT"));
  // Tampering with any exported file fails closed.
  const c = join(first.root, "export-c");
  first.store.exportLedger(first.ledger, c);
  for (const name of treeNames(c)) {
    const path = join(c, name);
    const bytes = readFileSync(path);
    const flipped = Buffer.from(bytes); flipped[Math.floor(bytes.length / 2)] ^= 1;
    writeFileSync(path, flipped);
    assert.throws(() => first.store.verifyExport(c), (error) => error instanceof contract.MemoryOSHistoryError && error.exitCode === 3, name);
    writeFileSync(path, bytes);
  }
  writeFileSync(join(c, "extra.txt"), "x");
  assert.throws(() => first.store.verifyExport(c), code("EXPORT_CORRUPT"));
});
test("T15 query and verify-export are read-only; query verifies the chain and never reads member bytes (R22)", (t) => {
  const { ledger, store } = newLedger(t);
  store.append(ledger, mip("one"));
  store.append(ledger, policy("two"));
  const before = snapshot(ledger);
  const base = { kind: "MemoryOSHistoryQuery", version: "1.0.0", recordKinds: [], subject: null, retention: "ANY", fromIndex: 0, limit: 10 };
  assert.equal(store.query(ledger, base).entries.length, 2);
  assert.deepEqual(store.query(ledger, { ...base, recordKinds: ["POLICY_EVALUATION"] }).entries.map((entry) => entry.index), [1]);
  assert.deepEqual(snapshot(ledger), before);
  // Member bytes are not read by a query: a corrupted member does not stop it, but verify does.
  const hex = readdirSync(join(ledger, "records"))[0];
  const memberPath = join(ledger, "records", hex, readdirSync(join(ledger, "records", hex))[0]);
  const bytes = readFileSync(memberPath);
  writeFileSync(memberPath, "tampered");
  assert.equal(store.query(ledger, base).entries.length, 2);
  assert.throws(() => store.verify(ledger), code("RECORD_BYTES_MISMATCH"));
  writeFileSync(memberPath, bytes);
  const reads = [];
  const spying = { ...nodeFs, openSync: (path, ...rest) => { reads.push(String(path)); return nodeFs.openSync(path, ...rest); } };
  createHistoryStore({ engine, fs: spying }).query(ledger, base);
  assert.equal(reads.some((path) => /records[\\/]/u.test(path)), false);
  // A corrupt entry stops the query (the chain is verified first).
  const entry = join(ledger, "entries/00000000000000000001.json");
  const original = readFileSync(entry);
  const flipped = Buffer.from(original); flipped[10] ^= 1;
  writeFileSync(entry, flipped);
  assert.throws(() => store.query(ledger, base), code("LEDGER_CORRUPT"));
});

test("T16 commands: arguments become store operations, inputs are read through the boundary, errors carry only fixed text (section 13.3, 14.1)", (t) => {
  const root = scratch(t);
  const ledger = join(root, "ledger");
  const run = (...argv) => executeHistoryCommand(parseHistoryArguments(argv), { engine });
  assert.deepEqual(Object.keys(run("init", "--ledger", ledger, "--name", "workspace.history", "--workspace", "workspace-investigation").result), ["ledgerIdentifier"]);
  const file = join(root, "package.mip");
  writeFileSync(file, mipBytes());
  assert.deepEqual(Object.keys(run("append", "--ledger", ledger, "--kind", "MIP_PACKAGE", "--record", file).result).sort(), ["entryDigest", "index"], "Amendment A4.2: append result");
  writeFileSync(join(root, "identity.json"), policyFiles(0).identity);
  writeFileSync(join(root, "outcome.json"), policyFiles(0).outcome);
  assert.equal(run("append", "--ledger", ledger, "--kind", "POLICY_EVALUATION", "--identity", join(root, "identity.json"), "--outcome", join(root, "outcome.json")).result.index, 1);
  const bundle = join(root, "bundle");
  mkdirSync(bundle);
  for (const name of readdirSync(bundleDirectory(4))) writeFileSync(join(bundle, name), readFileSync(join(bundleDirectory(4), name)));
  assert.equal(run("append", "--ledger", ledger, "--kind", "CICD_RUN", "--run", bundle).result.index, 2);
  assert.equal(run("verify", "--ledger", ledger).result.entryCount, 3);
  assert.equal(run("query", "--ledger", ledger, "--retention", "ANY", "--from", "0", "--limit", "10").result.entries.length, 3);
  const queried = run("query", "--ledger", ledger, "--kind", "POLICY_EVALUATION", "--kind", "MIP_PACKAGE", "--retention", "RETAINED", "--from", "0", "--limit", "10").result;
  assert.deepEqual(queried.query.recordKinds, ["MIP_PACKAGE", "POLICY_EVALUATION"], "the kinds are ordered strictly ascending by the command layer (Amendment A2)");
  const tombstoned = run("tombstone", "--ledger", ledger, "--target", "0", "--reason", "PRIVACY_REQUEST", "--authority-reference", "P-1").result;
  assert.equal(tombstoned.index, 3);
  assert.deepEqual(Object.keys(tombstoned).sort(), ["entryDigest", "index"], "Amendment A4.2: tombstone result");
  const exported = join(root, "export");
  const exportResult = run("export", "--ledger", ledger, "--output", exported).result;
  assert.deepEqual(Object.keys(exportResult).sort(), ["entryCount", "headDigest", "ledgerIdentifier"], "Amendment A4.2: export result");
  assert.equal(exportResult.entryCount, 4);
  assert.equal(run("verify-export", "--export", exported).result.entryCount, 4);

  const errorOf = (...argv) => { try { run(...argv); } catch (error) { return error; } return assert.fail("expected an error"); };
  const secret = join(root, "secret-directory-name");
  const missing = errorOf("verify", "--ledger", secret);
  assert.equal(missing.historyCode, "MO1308_LEDGER_NOT_FOUND");
  assert.equal(missing.exitCode, 4);
  for (const error of [missing, errorOf("append", "--ledger", ledger, "--kind", "MIP_PACKAGE", "--record", join(root, "secret-missing-file")),
    errorOf("append", "--ledger", ledger, "--kind", "MIP_PACKAGE", "--record", file)]) {
    assert.ok(error.historyCode.startsWith("MO1308_"));
    assert.doesNotMatch(JSON.stringify([error.message, error.historyCode, error.exitCode]) + String(error.stack).split("\n")[0], /secret|memoryos-history-store|ENOENT|\/tmp/u);
  }
  assert.equal(errorOf("append", "--ledger", ledger, "--kind", "MIP_PACKAGE", "--record", file).historyCode, "MO1308_RECORD_PURGED", "that record was tombstoned above (H23)");
  assert.equal(errorOf("append", "--ledger", ledger, "--kind", "POLICY_EVALUATION", "--identity", join(root, "identity.json"), "--outcome", join(root, "outcome.json")).historyCode, "MO1308_RECORD_DUPLICATE");
  assert.equal(errorOf("append", "--ledger", ledger, "--kind", "MIP_PACKAGE", "--record", file).exitCode, 2);
  // Exit categories (H30): 2 admission, 3 integrity, 4 filesystem, 5 internal.
  assert.equal(errorOf("init", "--ledger", ledger, "--name", "a", "--workspace", "w").exitCode, 4);
  assert.equal(errorOf("verify-export", "--export", root).historyCode, "MO1308_EXPORT_CORRUPT");
  // Oversized inputs are refused before they are admitted.
  const big = join(root, "big.json");
  writeFileSync(big, Buffer.alloc(8193));
  assert.equal(errorOf("append", "--ledger", ledger, "--kind", "HUMAN_DECISION_CLAIM", "--record", big).historyCode, "MO1308_RESOURCE_LIMIT");
  // A bundle directory with a foreign file or too many files is not a bundle.
  writeFileSync(join(bundle, "notes.txt"), "x");
  assert.equal(errorOf("append", "--ledger", ledger, "--kind", "CICD_RUN", "--run", bundle).historyCode, "MO1308_RECORD_INVALID");
  // No engine: fail closed with MO1308_INTERNAL, exit 5, and nothing is written.
  const closed = (() => { try { executeHistoryCommand(parseHistoryArguments(["init", "--ledger", join(root, "never"), "--name", "a", "--workspace", "w"])); } catch (error) { return error; } return null; })();
  assert.equal(closed.historyCode, "MO1308_INTERNAL");
  assert.equal(closed.exitCode, 5);
  assert.equal(nodeFs.existsSync(join(root, "never")), false);
  // An unexpected fault is INTERNAL, never its own text.
  const broken = { ...engine, verifyHistoryLedger: () => { throw new TypeError("secret detail /home/user"); } };
  try { executeHistoryCommand(parseHistoryArguments(["verify", "--ledger", ledger]), { engine: broken }); assert.fail("expected an error"); } catch (error) {
    assert.equal(error.historyCode, "MO1308_INTERNAL");
    assert.doesNotMatch(error.message, /secret|home/u);
  }
});

test("T17 concurrent appenders in separate processes: exactly one entry per index, losers get LEDGER_CONFLICT, the chain verifies (R15)", async (t) => {
  const { ledger, store } = newLedger(t);
  const script = join(here, "support", "history-append-worker.mjs");
  const workers = 6;
  const children = Array.from({ length: workers }, (_, index) => new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ledger, String(index)], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.on("close", (status) => resolve({ status, out: out.trim() }));
  }));
  const results = await Promise.all(children);
  assert.ok(results.every((result) => result.status === 0), JSON.stringify(results));
  const outcomes = results.map((result) => JSON.parse(result.out));
  const wins = outcomes.flatMap((outcome) => outcome.filter((attempt) => attempt.ok));
  const indices = wins.map((attempt) => attempt.index).sort((a, b) => a - b);
  assert.deepEqual(indices, indices.map((_, position) => position), "winning indices are exactly 0..n-1, each once");
  const verification = store.verify(ledger);
  assert.equal(verification.entryCount, wins.length);
  assert.ok(outcomes.flat().every((attempt) => attempt.ok || ["MO1308_LEDGER_CONFLICT", "MO1308_RECORD_DUPLICATE"].includes(attempt.code)));
  assert.ok(wins.length >= workers, "each worker eventually committed its record after retrying");
});

test("T18 the store is Node-only, helper-free, timeless and never overwrites (R06, R35, R37, H40)", async (t) => {
  const store = readFileSync(join(here, "../src/history-store.js"), "utf8");
  const commands = readFileSync(join(here, "../src/history-commands.js"), "utf8");
  const strip = (text) => text.replace(/^\s*\/\/.*$/gmu, "");
  for (const source of [strip(store), strip(commands)]) {
    assert.doesNotMatch(source, /child_process|spawn|exec\(|execFile|fork\(|worker_threads|powershell|\.ps1|cmd\.exe/iu);
    assert.doesNotMatch(source, /Date\b|performance\.|setTimeout|setInterval|setImmediate|Math\.random|randomBytes|randomUUID|hrtime/u);
    assert.doesNotMatch(source, /timestamp|createdAt|observedAt|mtime|ctime|birthtime/iu);
    assert.doesNotMatch(source, /fetch\(|node:net|node:http|node:dns/u);
    assert.doesNotMatch(source, /renameSync|copyFileSync|writeFileSync|appendFileSync|truncateSync|ftruncateSync|utimesSync|chmodSync|rmSync|createWriteStream|symlinkSync/u);
  }
  const imports = (source) => [...source.matchAll(/^import\s[\s\S]+?from\s+"([^"]+)";$/gmu)].map((match) => match[1]);
  assert.deepEqual(imports(store), ["node:fs", "node:path"]);
  assert.deepEqual(imports(commands), ["./errors.js", "./history-store.js"]);
  // The only deletions are staging names and purge of a tombstoned record's members (unlink/rmdir).
  const deletions = [...strip(store).matchAll(/(unlinkSync|rmdirSync)\(([^)]*)\)/gu)].map((match) => `${match[1]}(${match[2].trim()})`);
  assert.deepEqual(deletions, ["unlinkSync(staged.path)", "unlinkSync(path)", "rmdirSync(directory)"]);
  // Existing names are never replaced: new files use O_EXCL, publication is a hard link.
  assert.match(store, /O_EXCL/u);
  assert.match(store, /linkSync\(staged\.path, finalPath\)/u);
  void t;
});

test("T19 nothing outside the SDK facade and the contract is imported by the history sources; commands.js stays the only SDK importer (ARCHITECTURE section 5)", () => {
  for (const name of ["history-store.js", "history-commands.js"]) {
    const specifiers = [...readFileSync(join(here, "../src", name), "utf8").matchAll(/^import\s[\s\S]+?from\s+"([^"]+)";$/gmu)].map((match) => match[1]);
    assert.ok(specifiers.every((specifier) => !/memoryos-sdk|memoryos-history|cca-studio/u.test(specifier)), `${name}: ${specifiers}`);
  }
});

// ---- Consistent snapshot (found by W08b on the Windows host; platform independent) ----
// An fs whose directory listings are observed and can trigger a concurrent writer at an exact point of a read.
// The writer is a second store on the real fs; no production seam is involved (the store takes `fs` by design).
function listingFs(onListing) {
  const counts = { entries: 0, records: 0 };
  const api = { ...nodeFs, counts };
  api.readdirSync = (path, ...rest) => {
    const text = String(path).split("\\").join("/");
    const kind = text.endsWith("/entries") ? "entries" : text.endsWith("/records") ? "records" : null;
    if (kind !== null) { counts[kind] += 1; onListing(kind, counts[kind]); }
    return nodeFs.readdirSync(path, ...rest);
  };
  return api;
}
const purge = (store, ledger, targetIndex) => store.tombstone(ledger, { targetIndex, reason: "PRIVACY_REQUEST", authorityReference: `R-${targetIndex}` });

test("T20 a purge committed between the entry listing and the member listing never produces RECORD_BYTES_MISMATCH: the read is repeated on a consistent snapshot (section 10.2, found by W08b)", (t) => {
  assert.equal(STORE_SNAPSHOT_ATTEMPTS, 8);
  const operations = {
    verify: (store, ledger) => { const result = store.verify(ledger); assert.deepEqual([result.entryCount, result.purgePending, result.purgedRecords], [3, [], 1]); },
    append: (store, ledger) => assert.equal(store.append(ledger, mip("after")).index, 3),
    export: (store, ledger, root) => assert.equal(store.exportLedger(ledger, join(root, "export")).entryCount, 3),
    tombstone: (store, ledger) => assert.equal(purge(store, ledger, 1).index, 3),
    query: (store, ledger) => assert.equal(store.query(ledger, { kind: "MemoryOSHistoryQuery", version: "1.0.0", recordKinds: [], subject: null, retention: "ANY", fromIndex: 0, limit: 10 }).entries.length, 3, "the stable second pass answers (the purged record is listed once, plus its tombstone entry, section 11.2)"),
  };
  for (const [name, operation] of Object.entries(operations)) {
    const { root, ledger, store } = newLedger(t);
    store.append(ledger, mip("one"));
    store.append(ledger, mip("two"));
    let injected = false;
    // Members are listed after the entries; a query lists no members, so its writer strikes before the closing re-listing.
    const racing = listingFs((kind, count) => {
      if (!injected && (name === "query" ? kind === "entries" && count === 2 : kind === "records")) { injected = true; purge(store, ledger, 0); }
    });
    operation(createHistoryStore({ engine, fs: racing }), ledger, root);
    assert.ok(injected, `${name}: the purge was injected`);
    assert.equal(racing.counts.entries, 4, `${name}: the first pass was discarded and a second, stable pass followed`);
    assert.equal(store.verify(ledger).entryCount, name === "append" || name === "tombstone" ? 4 : 3, `${name}: the ledger is consistent afterwards`);
  }
});

test("T21 when writers overtake every pass the read fails with LEDGER_CONFLICT after exactly the fixed number of passes, never with an integrity code, and publishes nothing", (t) => {
  for (const name of ["verify", "append", "export", "tombstone"]) {
    const { root, ledger, store } = newLedger(t);
    store.append(ledger, mip("seed"));
    let writers = 0;
    const racing = listingFs((kind) => { if (kind === "records") { writers += 1; store.append(ledger, mip(`writer ${writers}`)); } });
    const reader = createHistoryStore({ engine, fs: racing });
    const attempt = {
      verify: () => reader.verify(ledger), append: () => reader.append(ledger, mip("never")),
      export: () => reader.exportLedger(ledger, join(root, "export")), tombstone: () => purge(reader, ledger, 0),
    }[name];
    assert.throws(attempt, (error) => code("LEDGER_CONFLICT", "ACQUISITION")(error) && error.exitCode === 4, name);
    assert.equal(racing.counts.records, STORE_SNAPSHOT_ATTEMPTS, `${name}: exactly the fixed number of passes`);
    assert.equal(racing.counts.entries, 2 * STORE_SNAPSHOT_ATTEMPTS, `${name}: each pass lists the entries twice`);
    assert.equal(readdirSync(join(ledger, "entries")).length, 1 + writers, `${name}: only the other writers published`);
    assert.equal(nodeFs.existsSync(join(root, "export")), false, `${name}: nothing was exported`);
  }
});

test("T22 on a stable snapshot every mismatch is reported exactly as before: corruption of a quiescent ledger is an integrity error found in a single pass", (t) => {
  const { ledger, store } = newLedger(t);
  store.append(ledger, mip("one"));
  store.append(ledger, mip("two"));
  const hex = readdirSync(join(ledger, "records"))[0];
  const member = join(ledger, "records", hex, MEMBER);
  const bytes = readFileSync(member);
  const observed = listingFs(() => {});
  const probe = createHistoryStore({ engine, fs: observed });
  const expectOnce = (label, expected) => {
    observed.counts.entries = 0;
    observed.counts.records = 0;
    assert.throws(() => probe.verify(ledger), code(expected), label);
    assert.deepEqual([observed.counts.entries, observed.counts.records], [2, 1], `${label}: one pass only (no retry)`);
  };
  const flipped = Buffer.from(bytes); flipped[0] ^= 1;
  writeFileSync(member, flipped);
  expectOnce("member bytes changed", "RECORD_BYTES_MISMATCH");
  writeFileSync(member, bytes);
  rmSync(member);
  expectOnce("member missing from a retained record", "RECORD_BYTES_MISMATCH");
  writeFileSync(member, bytes);
  const entry = join(ledger, "entries", "00000000000000000001.json");
  const entryBytes = readFileSync(entry);
  const damaged = Buffer.from(entryBytes); damaged[10] ^= 1;
  writeFileSync(entry, damaged);
  assert.throws(() => probe.verify(ledger), (error) => error instanceof contract.MemoryOSHistoryError && error.exitCode === 3);
  writeFileSync(entry, entryBytes);
  assert.equal(probe.verify(ledger).entryCount, 2, "restored: a quiescent ledger is read in one pass");
});