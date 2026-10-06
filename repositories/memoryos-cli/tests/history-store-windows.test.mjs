import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import * as nodeFs from "node:fs";
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, rmdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import * as contract from "../../cca-studio/web/js/memoryos-history-contract.js";
import { createHistoryStore } from "../src/history-store.js";
import { checkpointRecord, policyRecord } from "./support/history-corpus.mjs";
import { createHistoryEngine } from "./support/history-engine.mjs";

// MO-1308 Contract Freeze 1, Stream 2C: the native-Windows (NTFS) tests of the file store. They exercise the
// items docs/mo1308-phase2c-store.md section 5 lists as host-only: junctions and other reparse points, NTFS hard
// links, exclusive-create semantics, the case-insensitive realpath comparison, drive-letter / UNC / long-path
// forms, and NTFS concurrency with real processes. On any other platform they are skipped, never passed.
// The frozen behaviour asserted throughout (H40 risk acceptance): a link is refused, a swap is detected after the
// fact, no existing content is ever overwritten or replaced, and every later read fails closed.
const WIN = { skip: process.platform === "win32" ? false : "native Windows (NTFS) host test" };
const here = fileURLToPath(new URL("./", import.meta.url));
const worker = join(here, "support", "history-windows-worker.mjs");
const engine = createHistoryEngine();
const enc = new TextEncoder();
const code = (expected, stage) => (error) => error instanceof contract.MemoryOSHistoryError && error.code === `MO1308_${expected}`
  && (stage === undefined || error.stage === stage);

function scratch(t) {
  const root = mkdtempSync(join(tmpdir(), "memoryos-history-win-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
// Real admissible records (Stream 2D): a distinct real checkpoint per label.
const mip = (label) => checkpointRecord(label);
const MEMBER = "checkpoint.json";
function newLedger(t, store = createHistoryStore({ engine })) {
  const root = scratch(t);
  const ledger = join(root, "ledger");
  store.init(ledger, { ledgerName: "workspace.history", workspaceIdentifier: "workspace-investigation" });
  return { root, ledger, store };
}
const QUERY = { kind: "MemoryOSHistoryQuery", version: "1.0.0", recordKinds: [], subject: null, retention: "ANY", fromIndex: 0, limit: 10 };
const entryName = (index) => `${String(index).padStart(20, "0")}.json`;
const junction = (target, path) => symlinkSync(target, path, "junction");
// The record directory an append of `label` will use (the same record appended to a probe ledger).
function recordHexOf(t, label) {
  const probe = newLedger(t);
  probe.store.append(probe.ledger, mip(label));
  return readdirSync(join(probe.ledger, "records"))[0];
}
// Every file under a directory with its bytes: used to prove that nothing existing was changed.
function contents(directory) {
  const result = new Map();
  const walk = (current) => {
    for (const name of readdirSync(current).sort()) {
      const full = join(current, name);
      if (lstatSync(full).isDirectory()) walk(full); else result.set(full.slice(directory.length), readFileSync(full).toString("base64"));
    }
  };
  walk(directory);
  return result;
}
// An fs whose mutating calls can be intercepted just before they run (swap and race tests).
const MUTATING = ["mkdirSync", "openSync", "writeSync", "fsyncSync", "linkSync", "unlinkSync", "rmdirSync", "renameSync"];
function interceptingFs(before) {
  const api = { ...nodeFs };
  for (const name of MUTATING) {
    api[name] = (...args) => {
      before(name, args);
      return nodeFs[name](...args);
    };
  }
  return api;
}
// A real second process that holds a file open with the given sharing mode until released.
async function holdOpen(t, path, share) {
  const quoted = path.replaceAll("'", "''");
  const script = `$f=[System.IO.File]::Open('${quoted}','Open','Read',[System.IO.FileShare]'${share}');`
    + "[Console]::Out.WriteLine('READY');[Console]::Out.Flush();[void][Console]::In.ReadLine();$f.Dispose()";
  const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { stdio: ["pipe", "pipe", "pipe"] });
  const closed = new Promise((resolve) => child.on("close", resolve));
  t.after(() => { if (child.exitCode === null) child.kill(); });
  await new Promise((resolve, reject) => {
    let seen = "";
    child.stdout.on("data", (chunk) => { seen += chunk; if (seen.includes("READY")) resolve(); });
    child.on("close", () => reject(new Error(`lock holder exited early: ${seen}`)));
  });
  return { release: async () => { child.stdin.end("\n"); await closed; } };
}
function runWorker(...args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [worker, ...args.map(String)], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err += chunk; });
    child.on("close", (status) => resolve({ status, out: out.trim(), err: err.trim() }));
  });
}
const parsed = (result) => { assert.equal(result.status, 0, `${result.err}`); return JSON.parse(result.out); };

test("W01 junctions and directory symlinks anywhere on the path or inside the ledger fail closed on every operation (R17, H40)", WIN, (t) => {
  const { root, ledger, store } = newLedger(t);
  store.append(ledger, mip("one"));
  const outside = join(root, "outside");
  mkdirSync(outside);
  const link = join(root, "junction-to-ledger");
  junction(ledger, link);
  assert.ok(lstatSync(link).isSymbolicLink(), "the platform reports a junction as a link, which is what the component check relies on");
  const parentLink = join(root, "junction-to-parent");
  junction(root, parentLink);
  const dirSymlink = join(root, "symlink-to-ledger");
  symlinkSync(ledger, dirSymlink, "dir");
  const attacks = [];
  for (const [kind, root_] of [["junction", link], ["directory symlink", dirSymlink]]) {
    attacks.push([`${kind}: verify`, () => store.verify(root_)]);
    attacks.push([`${kind}: append`, () => store.append(root_, mip("x"))]);
    attacks.push([`${kind}: query`, () => store.query(root_, QUERY)]);
    attacks.push([`${kind}: export`, () => store.exportLedger(root_, join(root, `export-through-${kind.replace(" ", "-")}`))]);
    attacks.push([`${kind}: tombstone`, () => store.tombstone(root_, { targetIndex: 0, reason: "PRIVACY_REQUEST", authorityReference: "x" })]);
  }
  attacks.push(["an ancestor is a junction", () => store.verify(join(parentLink, "ledger"))]);
  attacks.push(["init under a junction parent", () => store.init(join(parentLink, "new-ledger"), { ledgerName: "a", workspaceIdentifier: "w" })]);
  attacks.push(["init at an existing junction", () => store.init(link, { ledgerName: "a", workspaceIdentifier: "w" })]);
  for (const [label, attack] of attacks) assert.throws(attack, code("FILESYSTEM_BOUNDARY"), label);
  assert.deepEqual(readdirSync(outside), []);
  assert.equal(nodeFs.existsSync(join(root, "new-ledger")), false);
  assert.equal(nodeFs.existsSync(join(root, "export-through-junction")), false);

  // A dangling junction is still a link: it is refused as a boundary failure, never reported as "not found".
  const gone = join(root, "gone");
  mkdirSync(gone);
  const dangling = join(root, "dangling");
  junction(gone, dangling);
  rmdirSync(gone);
  assert.throws(() => store.verify(dangling), code("FILESYSTEM_BOUNDARY"), "a dangling junction as the ledger");

  const before = contents(ledger);
  const swap = (name, makeLink) => {
    const original = join(ledger, name);
    const moved = join(root, `moved-${name.replace(/\W/gu, "_")}`);
    renameSync(original, moved);
    makeLink(original, moved);
    try {
      assert.throws(() => store.verify(ledger), code("FILESYSTEM_BOUNDARY"), `${name} as a link: verify`);
      if (name === "entries") assert.throws(() => store.query(ledger, QUERY), code("FILESYSTEM_BOUNDARY"), "entries as a link: query");
      assert.throws(() => store.append(ledger, mip("y")), code("FILESYSTEM_BOUNDARY"), `${name} as a link: append`);
    } finally {
      rmdirSync(original);
      renameSync(moved, original);
    }
    assert.equal(store.verify(ledger).entryCount, 1, `${name} restored`);
  };
  for (const name of ["entries", "records", ".pending"]) {
    swap(name, (original, moved) => junction(moved, original));
    swap(name, (original, moved) => symlinkSync(moved, original, "dir"));
  }
  const hex = readdirSync(join(ledger, "records"))[0];
  swap(join("records", hex), (original, moved) => junction(moved, original));
  assert.deepEqual(contents(ledger), before, "no ledger file was changed by any refused operation");
  assert.deepEqual(readdirSync(outside), []);
});

test("W01b a reparse point that is neither a junction nor a symlink (an app-execution alias) is refused as an input file (H40)", WIN, (t) => {
  const aliases = join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WindowsApps");
  let alias = null;
  try {
    alias = readdirSync(aliases).map((name) => join(aliases, name)).find((path) => { try { const st = lstatSync(path); return st.isSymbolicLink() && !st.isDirectory(); } catch { return false; } });
  } catch { /* no such directory on this host */ }
  if (alias === undefined || alias === null) {
    t.skip("this host has no app-execution alias (an IO_REPARSE_TAG_APPEXECLINK file) to read as an input");
    return;
  }
  const { ledger, store } = newLedger(t);
  assert.throws(() => store.readInputFile(alias, 1_000_000), code("FILESYSTEM_BOUNDARY"), alias);
  assert.equal(store.verify(ledger).entryCount, 0);
});

test("W02 a junction swapped in for a record directory during an append is detected; decoy content survives; the entry is never committed; reads then fail closed (H40)", WIN, (t) => {
  const { root, ledger, store } = newLedger(t);
  const outside = join(root, "outside");
  mkdirSync(outside);
  const hex = recordHexOf(t, "swap");
  // The decoy sits where the member link would land if the swap were followed: it must never be replaced.
  mkdirSync(join(outside, "decoy-dir"));
  writeFileSync(join(outside, MEMBER), "decoy that must survive");
  let swapped = false;
  const attacked = createHistoryStore({ engine, fs: interceptingFs((name, args) => {
    if (!swapped && name === "linkSync" && String(args[1]).includes(hex)) {
      swapped = true;
      rmSync(join(ledger, "records", hex), { recursive: true });
      junction(outside, join(ledger, "records", hex));
    }
  }) });
  let error = null;
  try { attacked.append(ledger, mip("swap")); } catch (caught) { error = caught; }
  assert.ok(swapped, "the swap happened");
  assert.ok(error instanceof contract.MemoryOSHistoryError, "the swap is detected");
  assert.ok(["MO1308_FILESYSTEM_BOUNDARY", "MO1308_RECORD_BYTES_MISMATCH"].includes(error.code), error.code);
  assert.equal(readFileSync(join(outside, MEMBER), "utf8"), "decoy that must survive", "existing content is never overwritten or replaced");
  assert.equal(nodeFs.existsSync(join(ledger, "entries", entryName(0))), false, "the entry was never committed");
  assert.throws(() => store.verify(ledger), code("FILESYSTEM_BOUNDARY"), "every subsequent read fails closed");
  assert.equal(store.query(ledger, QUERY).entries.length, 0, "a query reads entries only, and no entry was committed");
  assert.throws(() => store.append(ledger, mip("again")), code("FILESYSTEM_BOUNDARY"));
  assert.throws(() => store.exportLedger(ledger, join(root, "export")), code("FILESYSTEM_BOUNDARY"));
});

test("W03 the entries directory swapped for a junction at the commit point is detected after the fact: the real entries stay unchanged, reads fail closed (H40)", WIN, (t) => {
  const { root, ledger, store } = newLedger(t);
  store.append(ledger, mip("first"));
  const outside = join(root, "outside");
  mkdirSync(outside);
  const entries = join(ledger, "entries");
  const moved = join(root, "moved-entries");
  const before = contents(entries);
  let swapped = false;
  const attacked = createHistoryStore({ engine, fs: interceptingFs((name, args) => {
    if (!swapped && name === "linkSync" && String(args[1]).endsWith(entryName(1))) {
      swapped = true;
      renameSync(entries, moved);
      junction(outside, entries);
    }
  }) });
  assert.throws(() => attacked.append(ledger, mip("second")), code("FILESYSTEM_BOUNDARY"));
  assert.ok(swapped);
  assert.deepEqual(contents(moved), before, "the real entries directory is exactly as it was: nothing was committed into it or changed");
  assert.throws(() => store.verify(ledger), code("FILESYSTEM_BOUNDARY"), "a read through the swapped directory fails closed");
  assert.throws(() => store.append(ledger, mip("third")), code("FILESYSTEM_BOUNDARY"));
  rmdirSync(entries);
  renameSync(moved, entries);
  assert.equal(store.verify(ledger).entryCount, 1, "with the real directory back the ledger verifies unchanged");
});

test("W04 NTFS hard links: publication leaves one link per file, never replaces a name, and an unremoved staging link is only an anomaly (R06, section 9.2)", WIN, (t) => {
  const { root, ledger, store } = newLedger(t);
  store.append(ledger, mip("one"));
  store.append(ledger, policyRecord(0));
  store.tombstone(ledger, { targetIndex: 0, reason: "PRIVACY_REQUEST", authorityReference: "P-1" });
  // After every operation each published file has exactly one name and a distinct, non-zero NTFS file index.
  const seen = new Set();
  const walk = (directory) => {
    for (const name of readdirSync(directory)) {
      const full = join(directory, name);
      const st = lstatSync(full, { bigint: true });
      if (st.isDirectory()) { walk(full); continue; }
      assert.equal(st.nlink, 1n, `${full} has one link`);
      assert.ok(st.ino !== 0n && !seen.has(st.ino), `${full} has its own file index`);
      seen.add(st.ino);
    }
  };
  walk(ledger);
  assert.deepEqual(readdirSync(join(ledger, ".pending")), [], "no staging link remains");
  // The primitive the store relies on: a hard link never replaces an existing name (also one that differs only in case).
  const staged = join(root, "staged.bin");
  const taken = join(root, "Taken.bin");
  writeFileSync(staged, "staged");
  writeFileSync(taken, "taken");
  assert.throws(() => nodeFs.linkSync(staged, taken), { code: "EEXIST" });
  assert.throws(() => nodeFs.linkSync(staged, join(root, "TAKEN.BIN")), { code: "EEXIST" });
  assert.equal(readFileSync(taken, "utf8"), "taken");
  // A writer that wins the commit name between the check and the link: ours loses, the winner's bytes survive.
  const rival = newLedger(t);
  let planted = false;
  const racing = createHistoryStore({ engine, fs: interceptingFs((name, args) => {
    if (!planted && name === "linkSync" && String(args[1]).endsWith(entryName(0))) { planted = true; writeFileSync(args[1], "the other writer's entry"); }
  }) });
  assert.throws(() => racing.append(rival.ledger, mip("loser")), code("LEDGER_CONFLICT"));
  assert.equal(readFileSync(join(rival.ledger, "entries", entryName(0)), "utf8"), "the other writer's entry", "an existing name is never replaced");
  assert.deepEqual(readdirSync(join(rival.ledger, ".pending")), [], "the losing staging file was discarded");
  // A staging link that cannot be removed leaves two names for one file: reported by verify, harmless to the chain.
  const stuck = newLedger(t);
  const refusing = createHistoryStore({ engine, fs: { ...nodeFs, unlinkSync: (path, ...rest) => {
    if (String(path).includes(".pending")) throw Object.assign(new Error("denied"), { code: "EPERM" });
    return nodeFs.unlinkSync(path, ...rest);
  } } });
  assert.equal(refusing.append(stuck.ledger, mip("stuck")).index, 0, "a failed cleanup does not fail a committed append");
  const committed = lstatSync(join(stuck.ledger, "entries", entryName(0)), { bigint: true });
  assert.equal(committed.nlink, 2n, "the committed name and the staging name are the same file");
  assert.equal(stuck.store.verify(stuck.ledger).pendingArtifacts, 2);
  const staging = readdirSync(join(stuck.ledger, ".pending")).sort();
  const stagingBytes = staging.map((name) => readFileSync(join(stuck.ledger, ".pending", name), "base64"));
  assert.equal(stuck.store.append(stuck.ledger, mip("after")).index, 1, "leftovers never block the next append");
  assert.deepEqual(staging.map((name) => readFileSync(join(stuck.ledger, ".pending", name), "base64")), stagingBytes, "leftovers are never touched");
  assert.equal(stuck.store.verify(stuck.ledger).entryCount, 2);
});

test("W05 exclusive-create semantics: an existing name is never opened for writing, even one locked by another process or differing only in case (R06)", WIN, async (t) => {
  const { root, ledger, store } = newLedger(t);
  // NTFS CREATE_NEW: any existing name, in any case, is refused rather than truncated.
  const name = join(root, "Existing.bin");
  writeFileSync(name, "keep");
  for (const variant of [name, join(root, "EXISTING.BIN"), join(root, "existing.bin")]) {
    assert.throws(() => nodeFs.openSync(variant, nodeFs.constants.O_WRONLY | nodeFs.constants.O_CREAT | nodeFs.constants.O_EXCL), { code: "EEXIST" }, variant);
  }
  assert.throws(() => nodeFs.openSync(root, nodeFs.constants.O_WRONLY | nodeFs.constants.O_CREAT | nodeFs.constants.O_EXCL), { code: "EEXIST" });
  assert.equal(readFileSync(name, "utf8"), "keep");

  // Leftover staging names that another process holds open exclusively are skipped, never opened or replaced.
  const hex = recordHexOf(t, "locked");
  const leftovers = [
    ...[0, 1].map((n) => join(ledger, ".pending", `member-${hex}-${MEMBER}.${n}`)),
    ...[0, 1].map((n) => join(ledger, ".pending", `entry-${String(0).padStart(20, "0")}.${n}`)),
  ];
  leftovers.forEach((path, n) => writeFileSync(path, `leftover ${n}`));
  const holders = [];
  for (const path of leftovers) holders.push(await holdOpen(t, path, "None"));
  assert.equal(store.append(ledger, mip("locked")).index, 0, "the append used the next free staging names");
  for (const holder of holders) await holder.release();
  leftovers.forEach((path, n) => assert.equal(readFileSync(path, "utf8"), `leftover ${n}`, "a leftover is never overwritten"));
  assert.equal(store.verify(ledger).pendingArtifacts, leftovers.length);
});

test("W05b a sharing violation (another process holds a ledger file with no sharing) fails closed with a typed IO error and changes nothing; releasing restores service (R17)", WIN, async (t) => {
  const { ledger, store } = newLedger(t);
  store.append(ledger, mip("one"));
  store.append(ledger, mip("two"));
  const before = contents(ledger);
  const targets = [join(ledger, "entries", entryName(0)), join(ledger, "entries", entryName(1)),
    join(ledger, "records", readdirSync(join(ledger, "records"))[0], MEMBER), join(ledger, "memoryos-history-ledger.json")];
  for (const target of targets) {
    const holder = await holdOpen(t, target, "None");
    try {
      assert.throws(() => store.verify(ledger), code("IO"), `verify with ${target} locked`);
      assert.throws(() => store.append(ledger, mip("three")), code("IO"), `append with ${target} locked`);
      assert.throws(() => store.exportLedger(ledger, join(ledger, "..", "export-locked")), code("IO"), `export with ${target} locked`);
    } finally {
      await holder.release();
    }
    assert.equal(store.verify(ledger).entryCount, 2, `${target} released`);
  }
  assert.deepEqual(contents(ledger), before, "nothing was published or changed while the files were locked");
  assert.equal(nodeFs.existsSync(join(ledger, "..", "export-locked")), false);
});

test("W06 the case-insensitive realpath comparison accepts any casing of the real path and refuses a short (8.3) alias; case-only renames inside a ledger are corruption (R17, H40)", WIN, (t) => {
  const { root, ledger, store } = newLedger(t);
  store.append(ledger, mip("one"));
  const variants = [ledger.toUpperCase(), ledger.toLowerCase(), ledger[0].toLowerCase() + ledger.slice(1),
    ledger.replaceAll("\\", "/"), join(ledger, "entries", "..") + "\\", `${ledger}\\.\\`];
  for (const variant of variants) {
    assert.equal(store.verify(variant).entryCount, 1, variant);
    assert.equal(store.query(variant, QUERY).entries.length, 1, variant);
  }
  assert.equal(store.append(ledger.toUpperCase(), mip("two")).index, 1, "an append through a different casing writes the on-disk names");
  assert.deepEqual(readdirSync(ledger).sort(), [".pending", "entries", "memoryos-history-ledger.json", "records"], "no differently cased name was created");
  assert.deepEqual(readdirSync(join(ledger, "entries")), [entryName(0), entryName(1)]);
  assert.equal(store.exportLedger(ledger.toLowerCase(), join(root, "Export").toUpperCase()).entryCount, 2);
  assert.equal(store.verifyExport(join(root, "export").toUpperCase()).entryCount, 2, "the export lives under its first-written casing");
  assert.equal(store.tombstone(ledger.toLowerCase(), { targetIndex: 0, reason: "PRIVACY_REQUEST", authorityReference: "P-1" }).index, 2);

  // Names inside the ledger are compared exactly: a case-only rename is a layout defect, never silently accepted.
  const before = contents(ledger);
  for (const [from, to] of [["entries", "Entries"], ["records", "RECORDS"], ["memoryos-history-ledger.json", "Memoryos-History-Ledger.json"]]) {
    renameSync(join(ledger, from), join(ledger, to));
    try {
      assert.throws(() => store.verify(ledger), (error) => error instanceof contract.MemoryOSHistoryError && ["MO1308_LEDGER_CORRUPT", "MO1308_LEDGER_NOT_FOUND"].includes(error.code), `${from} renamed to ${to}`);
    } finally {
      renameSync(join(ledger, to), join(ledger, from));
    }
  }
  const hex = readdirSync(join(ledger, "records")).find((name) => readdirSync(join(ledger, "records", name)).length > 0);
  renameSync(join(ledger, "records", hex), join(ledger, "records", hex.toUpperCase()));
  assert.throws(() => store.verify(ledger), code("LEDGER_CORRUPT"), "an upper-case record directory is not a digest name");
  renameSync(join(ledger, "records", hex.toUpperCase()), join(ledger, "records", hex));
  assert.deepEqual(contents(ledger), before);
  assert.equal(store.verify(ledger).entryCount, 3);

  // An 8.3 short alias of a real directory resolves to a different canonical string: refused, nothing written.
  const longName = join(root, "ALongDirectoryNameThatHasAShortAlias");
  mkdirSync(longName);
  const short = execFileSync("cmd.exe", ["/d", "/c", `for %I in ("${longName}") do @echo %~sI`], { encoding: "utf8" }).trim();
  if (short.toLowerCase() === longName.toLowerCase()) {
    t.skip("8.3 short names are not generated on this volume");
    return;
  }
  assert.throws(() => store.init(join(short, "via-short-name"), { ledgerName: "a", workspaceIdentifier: "w" }), code("FILESYSTEM_BOUNDARY"));
  assert.deepEqual(readdirSync(longName), [], "nothing was created through the alias");
  store.init(join(longName, "ledger"), { ledgerName: "a", workspaceIdentifier: "w" });
  assert.throws(() => store.verify(join(short, "ledger")), code("FILESYSTEM_BOUNDARY"));
  assert.throws(() => store.append(join(short, "ledger"), mip("x")), code("FILESYSTEM_BOUNDARY"));
});

test("W07 drive-letter, UNC and long-path forms work end to end; the \\\\?\\ and \\\\.\\ forms are refused fail-closed without creating anything (R17)", WIN, (t) => {
  const { root, ledger, store } = newLedger(t);
  store.append(ledger, mip("one"));
  const head = store.verify(ledger).headDigest;
  // UNC through the local administrative share: the same ledger, the same verification.
  const unc = (path) => `\\\\localhost\\${path[0]}$${path.slice(2)}`;
  assert.ok(nodeFs.existsSync(unc(ledger)), "the UNC form of the scratch directory is reachable from this process");
  assert.equal(store.verify(unc(ledger)).headDigest, head);
  assert.equal(store.append(unc(ledger), mip("two")).index, 1);
  assert.equal(store.query(unc(ledger), QUERY).entries.length, 2);
  store.init(unc(join(root, "unc-ledger")), { ledgerName: "a", workspaceIdentifier: "w" });
  assert.equal(store.append(join(root, "unc-ledger"), mip("u")).index, 0);
  assert.equal(store.exportLedger(unc(ledger), unc(join(root, "unc-export"))).entryCount, 2);
  assert.equal(store.verifyExport(unc(join(root, "unc-export"))).entryCount, 2);
  assert.equal(store.tombstone(unc(ledger), { targetIndex: 0, reason: "PRIVACY_REQUEST", authorityReference: "U-1" }).index, 2);
  assert.equal(store.verify(ledger).entryCount, 3);

  // A path far beyond MAX_PATH, without any prefix (the pinned Node is long-path aware).
  let deep = root;
  for (let level = 0; level < 8; level += 1) deep = join(deep, `${"d".repeat(40)}${level}`);
  mkdirSync(deep, { recursive: true });
  const longLedger = join(deep, "ledger");
  assert.ok(longLedger.length > 300);
  store.init(longLedger, { ledgerName: "a", workspaceIdentifier: "w" });
  store.append(longLedger, mip("long one"));
  store.append(longLedger, mip("long two"));
  assert.equal(store.tombstone(longLedger, { targetIndex: 0, reason: "PRIVACY_REQUEST", authorityReference: "L-1" }).index, 2);
  assert.equal(store.verify(longLedger).entryCount, 3);
  assert.deepEqual(store.query(unc(longLedger), QUERY), store.query(longLedger, QUERY), "the UNC form of a long path answers identically");
  assert.equal(store.exportLedger(longLedger, join(deep, "export")).entryCount, 3);
  assert.equal(store.verifyExport(join(deep, "export")).entryCount, 3);
  assert.ok(join(longLedger, "entries", entryName(0)).length > 300);

  // The extended-length and device prefixes: the canonical form differs from the given one, so they are refused
  // fail-closed (an accepted limitation, not a way around the boundary), and nothing is created or changed.
  const before = contents(ledger);
  for (const prefix of ["\\\\?\\", "\\\\.\\"]) {
    assert.throws(() => store.verify(prefix + ledger), code("FILESYSTEM_BOUNDARY"), `${prefix} verify`);
    assert.throws(() => store.append(prefix + ledger, mip("x")), code("FILESYSTEM_BOUNDARY"), `${prefix} append`);
    assert.throws(() => store.init(`${prefix}${join(root, "prefixed-ledger")}`, { ledgerName: "a", workspaceIdentifier: "w" }), code("FILESYSTEM_BOUNDARY"), `${prefix} init`);
    assert.throws(() => store.exportLedger(prefix + ledger, join(root, "prefixed-export")), code("FILESYSTEM_BOUNDARY"), `${prefix} export`);
  }
  assert.equal(nodeFs.existsSync(join(root, "prefixed-ledger")), false);
  assert.equal(nodeFs.existsSync(join(root, "prefixed-export")), false);
  assert.deepEqual(contents(ledger), before);
});

test("W08 NTFS concurrency: ten real appender processes with concurrent readers; every append that succeeded is in the ledger exactly once, every record that is not was reported as a typed failure, and no failed writer left a record (R15)", WIN, async (t) => {
  const { ledger, store } = newLedger(t);
  const appenders = 10;
  const perWorker = 3;
  const readers = [runWorker("verify", ledger, 12_000), runWorker("verify", ledger, 12_000)];
  const writers = Array.from({ length: appenders }, (_, index) => runWorker("append-detailed", ledger, `w${index}`, perWorker));
  const records = (await Promise.all(writers)).map(parsed).flat();
  const observed = (await Promise.all(readers)).map(parsed);
  assert.equal(records.length, appenders * perWorker, "every writer reported every record it tried");

  // Per-attempt evidence, written to the test output so any recurrence is diagnosable from the log.
  const attempts = records.flatMap((record) => record.attempts.map((attempt) => ({ label: record.label, ...attempt })));
  const failed = attempts.filter((attempt) => !attempt.ok);
  const byCode = {};
  const byErrno = {};
  for (const attempt of failed) {
    byCode[attempt.code] = (byCode[attempt.code] ?? 0) + 1;
    for (const error of attempt.fsErrors ?? []) { const key = `${error.code}/${error.errno}/${error.syscall}`; byErrno[key] = (byErrno[key] ?? 0) + 1; }
  }
  t.diagnostic(`W08 attempts=${attempts.length} succeeded=${attempts.length - failed.length} failedByCode=${JSON.stringify(byCode)} fsErrorsByCodeErrnoSyscall=${JSON.stringify(byErrno)}`);
  for (const record of records.filter((entry) => entry.outcome !== "success")) t.diagnostic(`W08 record not committed by its writer: ${JSON.stringify(record)}`);
  for (const attempt of failed.filter((entry) => entry.code !== "MO1308_LEDGER_CONFLICT")) t.diagnostic(`W08 non-conflict failure: ${JSON.stringify(attempt)}`);
  assert.ok(failed.every((attempt) => ["MO1308_LEDGER_CONFLICT", "MO1308_IO"].includes(attempt.code)), JSON.stringify(failed.filter((a) => !["MO1308_LEDGER_CONFLICT", "MO1308_IO"].includes(a.code))));

  // The exact contract. Present records are identified by the member bytes' digest, which is unique per record.
  const entries = readdirSync(join(ledger, "entries")).map((name) => JSON.parse(readFileSync(join(ledger, "entries", name), "utf8")));
  const digestOf = (text) => `sha256:${crypto.createHash("sha256").update(text).digest("hex")}`;
  const presence = new Map();
  for (const entry of entries) presence.set(entry.record.members[0].sha256, (presence.get(entry.record.members[0].sha256) ?? 0) + 1);
  const succeeded = records.filter((record) => record.outcome === "success");
  const notReported = records.filter((record) => record.outcome !== "success");
  // (a) no lost writes and no duplicates: every success is present exactly once.
  for (const record of succeeded) assert.equal(presence.get(digestOf(record.memberText)) ?? 0, 1, `${record.label} succeeded and must be present exactly once`);
  // (b) no silent loss: every record that is absent had a typed failure reported to its writer.
  const absent = records.filter((record) => (presence.get(digestOf(record.memberText)) ?? 0) === 0);
  for (const record of absent) assert.ok(record.outcome === "failed" && ["MO1308_LEDGER_CONFLICT", "MO1308_IO"].includes(record.finalCode), `${record.label} is absent without a reported failure: ${JSON.stringify(record)}`);
  // (c) no phantom commit: a record whose writer saw a failure is not in the ledger.
  for (const record of notReported) assert.equal(presence.get(digestOf(record.memberText)) ?? 0, 0, `${record.label} failed for its writer yet is in the ledger: ${JSON.stringify(record)}`);
  // (d) the ledger itself: contiguous indices, entry count equals the successes, the chain verifies, readers see no corruption.
  const indices = succeeded.map((record) => record.attempts.at(-1).index).sort((a, b) => a - b);
  assert.deepEqual(indices, indices.map((_, position) => position), "winning indices are exactly 0..n-1, each once");
  assert.equal(entries.length, succeeded.length, "the entry count equals the number of successes");
  assert.deepEqual([...presence.values()].filter((count) => count !== 1), [], "no record is present twice");
  const verification = store.verify(ledger);
  assert.equal(verification.entryCount, succeeded.length);
  assert.deepEqual(readdirSync(join(ledger, "entries")), succeeded.map((_, index) => entryName(index)));
  for (const name of readdirSync(join(ledger, ".pending"))) assert.match(name, /^(entry-[0-9]{20}|member-[0-9a-f]{64}-[a-z.-]+)\.[0-9]+$/u, "only staging names");
  for (const { counts, failures } of observed) {
    assert.ok(counts.length > 0, "the reader completed verifications");
    assert.deepEqual(counts, [...counts].sort((a, b) => a - b), "a reader never sees the ledger shrink");
    assert.deepEqual(Object.keys(failures).filter((key) => !["MO1308_IO", "MO1308_LEDGER_CONFLICT"].includes(key)), [], `readers see no integrity or boundary failure (only a typed IO error or the bounded-retry conflict): ${JSON.stringify(failures)}`);
    assert.ok(counts.at(-1) <= succeeded.length);
  }
});
test("W08b concurrent tombstones and appends in separate processes leave one tombstone per target and a verifying chain (R15, section 10.2)", WIN, async (t) => {
  const { ledger, store } = newLedger(t);
  for (let index = 0; index < 4; index += 1) store.append(ledger, mip(`seed ${index}`));
  const jobs = [runWorker("tombstone", ledger, 0), runWorker("tombstone", ledger, 1), runWorker("tombstone", ledger, 2),
    ...Array.from({ length: 3 }, (_, index) => runWorker("append", ledger, `t${index}`, 2))];
  const outcomes = (await Promise.all(jobs)).map(parsed);
  for (const attempts of outcomes) {
    // Strict: the only failure a racing tombstone or append may see is the commit/snapshot conflict, which the worker
    // retries. RECORD_BYTES_MISMATCH (the defect this test found) is deliberately not tolerated.
    assert.ok(attempts.every((attempt) => attempt.ok || attempt.code === "MO1308_LEDGER_CONFLICT"), JSON.stringify(attempts));
  }
  const verification = store.verify(ledger);
  const entries = readdirSync(join(ledger, "entries")).map((name) => JSON.parse(readFileSync(join(ledger, "entries", name), "utf8")));
  const tombstones = entries.filter((entry) => entry.entryType === "TOMBSTONE").map((entry) => entry.tombstone.targetIndex).sort();
  assert.deepEqual(tombstones, [0, 1, 2], "exactly one tombstone per target");
  assert.deepEqual(verification.purgePending, [], "every purge finished");
  assert.equal(verification.purgedRecords, 3);
  assert.equal(verification.entryCount, 4 + 3 + 6);
});

test("W08c a junction swapper racing real appender processes: the race is exercised, nothing outside is overwritten, and the ledger only ever verifies or fails closed with a typed error (H40)", WIN, async (t) => {
  const { root, ledger, store } = newLedger(t);
  store.append(ledger, mip("seed"));
  const outside = join(root, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "sentinel.txt"), "outside content that must survive");
  const swapper = runWorker("swap", ledger, outside, 6000);
  const appenders = Array.from({ length: 3 }, (_, index) => runWorker("append", ledger, `s${index}`, 4));
  const swapped = parsed(await swapper);
  const outcomes = (await Promise.all(appenders)).map(parsed);
  assert.ok(swapped.swaps > 0, `the swap race was exercised (${JSON.stringify(swapped)})`);
  // LEDGER_CORRUPT is allowed here, and only here: while the swapper has `records` renamed to `records.aside` the ledger
  // root holds a foreign name, which is a typed fail-closed integrity error by design (section 11.1 "an extra file").
  // RECORD_BYTES_MISMATCH is allowed for the same reason: with `records` swapped for a junction the members are
  // genuinely not where the entries say, on a stable entry listing.
  const allowed = new Set(["MO1308_LEDGER_CONFLICT", "MO1308_FILESYSTEM_BOUNDARY", "MO1308_IO", "MO1308_RECORD_BYTES_MISMATCH", "MO1308_LEDGER_NOT_FOUND", "MO1308_LEDGER_CORRUPT"]);
  for (const attempt of outcomes.flat()) assert.ok(attempt.ok || allowed.has(attempt.code), JSON.stringify(attempt));
  assert.equal(readFileSync(join(outside, "sentinel.txt"), "utf8"), "outside content that must survive", "outside content is never overwritten");
  assert.equal(nodeFs.existsSync(join(ledger, "records.aside")), false, "the swapper restored the directory");
  assert.equal(lstatSync(join(ledger, "records")).isDirectory() && !lstatSync(join(ledger, "records")).isSymbolicLink(), true);
  // Whatever the interleaving did, the ledger is either valid or refused with a typed integrity or boundary error.
  try {
    const verification = store.verify(ledger);
    assert.equal(verification.entryCount, readdirSync(join(ledger, "entries")).length);
  } catch (error) {
    assert.ok(error instanceof contract.MemoryOSHistoryError && ["MO1308_FILESYSTEM_BOUNDARY", "MO1308_LEDGER_CORRUPT", "MO1308_RECORD_BYTES_MISMATCH"].includes(error.code), String(error.code ?? error));
  }
  // Entries are only ever added, never changed: each committed entry is a complete, canonical file.
  for (const name of readdirSync(join(ledger, "entries"))) {
    assert.doesNotThrow(() => JSON.parse(readFileSync(join(ledger, "entries", name), "utf8")), name);
  }
});
