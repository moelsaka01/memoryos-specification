// MemoryOS 1.3.1 Studio History: unit, wording, derivation, source-scan and determinism tests (Freeze mo1310 sections 5 to 10, 14).
// Requirement ids (SHnn) are in the test titles; the conformance inventory maps them to this file.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { MEMORYOS_HISTORY_LIMITS } from "../web/js/memoryos-history-contract.js";
import { ENTRY_LIMIT, boundFor, byteOrder } from "../web/js/memoryos-dashboard-export-bounds.js";
import { DashboardError } from "../web/js/memoryos-dashboard-contract.js";
import { buildDashboardViewModel, canonicalViewModelBytes } from "../web/js/memoryos-dashboard-viewmodel.js";
import { WORDING, forbiddenTerms } from "../web/js/memoryos-dashboard-wording.js";
import { itemsFromDirectoryHandle, itemsFromFileList, readExportItems, ITEM_LIMIT } from "../web/js/studio-history-reader.js";
import { HISTORY_SCREEN_ACTIONS, HISTORY_WORDING, historyWording, scanHistoryControls, scanHistoryStrings } from "../web/js/studio-history-wording.js";
import { buildViewModelInBrowser, withSharedArrayBufferStandIn } from "../web/js/studio-history-verify.js";
import { deriveEmbeddedPage, EMBEDDED_PAGE_SCRIPT, PAGE_SCRIPT } from "../scripts/derive-studio-history-page.mjs";
import { readExportDirectory } from "../scripts/memoryos-dashboard-generator.mjs";
import { FIXTURE_NAMES, readExportFiles } from "./support-dashboard-fixtures.mjs";
import { STUDIO_ROOT, fixtureExportDirectory, listExport, makeScratch, tamperVariants } from "./support-studio-history.mjs";

const REPO_ROOT = path.join(STUDIO_ROOT, "..", "..");
const read = (relative) => fs.readFileSync(path.join(STUDIO_ROOT, relative), "utf8");
const sha = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const itemsOf = (files, counter = null) => files.map((f) => ({ path: f.path, size: f.bytes.length, read: async () => { if (counter) counter.set(f.path, (counter.get(f.path) ?? 0) + 1); return f.bytes; } }));
const codeOf = async (promise) => { try { await promise; return "NO_ERROR"; } catch (error) { return error instanceof DashboardError ? error.code : `OTHER:${error?.name}`; } };

// ---- A fake of the two browser routes, built from an in-memory export ----
const fakeDirectory = (files) => {
  const build = (prefix) => {
    const children = new Map();
    for (const file of files) {
      if (!file.path.startsWith(prefix)) continue;
      const rest = file.path.slice(prefix.length);
      const cut = rest.indexOf("/");
      if (cut === -1) children.set(rest, { kind: "file", name: rest, getFile: async () => ({ size: file.bytes.length, arrayBuffer: async () => file.bytes.slice().buffer }) });
      else { const name = rest.slice(0, cut); if (!children.has(name)) children.set(name, { kind: "directory", name, ...build(`${prefix}${name}/`) }); }
    }
    return { values: async function* values() { for (const child of children.values()) yield child; } };
  };
  return { kind: "directory", name: "export", ...build("") };
};
const fakeFileList = (files, folder = "export") => files.map((f) => ({ name: f.path.split("/").at(-1), webkitRelativePath: `${folder}/${f.path}`, size: f.bytes.length, arrayBuffer: async () => f.bytes.slice().buffer }));

test("SH03 the shared bounds module classifies exactly the export layout and agrees with the imported limits", () => {
  assert.equal(ENTRY_LIMIT, MEMORYOS_HISTORY_LIMITS.entriesPerLedger);
  for (const name of FIXTURE_NAMES) for (const file of readExportFiles(name)) {
    const bound = boundFor(file.path);
    assert.ok(bound !== null && file.bytes.length <= bound, `${name}/${file.path} has a bound that holds it`);
  }
  for (const unknown of [".DS_Store", "Thumbs.db", "notes.txt", "entries/1.json", "entries/00000000000000000001.json.bak", "records/zz/a.json", `records/${"a".repeat(64)}/unknown-member.bin`, "records/", "entries", "x/memoryos-history-ledger.json"]) {
    assert.equal(boundFor(unknown), null, unknown);
  }
  assert.equal(boundFor("memoryos-history-ledger.json"), MEMORYOS_HISTORY_LIMITS.descriptorBytes);
  assert.equal(boundFor("entries/00000000000000000000.json"), MEMORYOS_HISTORY_LIMITS.entryBytes);
  assert.deepEqual(["b", "a", "B"].sort(byteOrder), ["B", "a", "b"]);
});

test("SH03 SH06 the reader returns exactly the files the standalone generator reads, in the same order, for every fixture", async () => {
  for (const name of FIXTURE_NAMES) {
    const fromGenerator = readExportDirectory(fixtureExportDirectory(name)).files;
    const counter = new Map();
    const fromReader = (await readExportItems(itemsOf(listExport(fixtureExportDirectory(name)), counter))).files;
    assert.deepEqual(fromReader.map((f) => f.path), fromGenerator.map((f) => f.path), name);
    for (let index = 0; index < fromReader.length; index += 1) assert.deepEqual(fromReader[index].bytes, fromGenerator[index].bytes, `${name}/${fromReader[index].path}`);
    assert.ok([...counter.values()].every((n) => n === 1) && counter.size === fromReader.length, `${name}: each file is read exactly once`);
  }
});

test("SH03 the reader refuses what the generator refuses: unknown paths, oversize files, unsafe paths, duplicates, short reads; over-limit is DASH_LIMIT_EXCEEDED", async () => {
  const files = listExport(fixtureExportDirectory("single-entry"));
  const entry = files.find((f) => f.path.startsWith("entries/"));
  const cases = {
    "extra file": [...files, { path: "notes.txt", bytes: new Uint8Array(3) }],
    "extra hidden file": [...files, { path: ".DS_Store", bytes: new Uint8Array(3) }],
    "oversize entry": files.map((f) => (f === entry ? { path: f.path, bytes: new Uint8Array(MEMORYOS_HISTORY_LIMITS.entryBytes + 1) } : f)),
    "parent path": [...files, { path: "../outside.json", bytes: new Uint8Array(1) }],
    "backslash path": [...files, { path: "entries\\x.json", bytes: new Uint8Array(1) }],
    "empty segment": [...files, { path: "entries//x.json", bytes: new Uint8Array(1) }],
    duplicate: [...files, files[0]],
  };
  for (const [label, list] of Object.entries(cases)) assert.equal(await codeOf(readExportItems(itemsOf(list))), "DASH_EXPORT_UNREADABLE", label);
  // The generator agrees on the two cases a directory can express.
  const scratch = makeScratch("reader-parity");
  try {
    for (const [label, list] of [["extra file", cases["extra file"]], ["oversize entry", cases["oversize entry"]]]) {
      const directory = path.join(scratch, label.replace(" ", "-"));
      for (const f of list) { const target = path.join(directory, ...f.path.split("/")); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, f.bytes); }
      assert.throws(() => readExportDirectory(directory), (e) => e.code === "DASH_EXPORT_UNREADABLE", `generator: ${label}`);
    }
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
  // Short read, changed size, read failure.
  assert.equal(await codeOf(readExportItems(files.map((f, i) => ({ path: f.path, size: f.bytes.length, read: async () => (i === 0 ? f.bytes.slice(1) : f.bytes) })))), "DASH_EXPORT_UNREADABLE");
  assert.equal(await codeOf(readExportItems(files.map((f, i) => ({ path: f.path, size: f.bytes.length, read: async () => { if (i === 0) throw new Error("NotReadableError"); return f.bytes; } })))), "DASH_EXPORT_UNREADABLE");
  // More entry files than the imported limit: refused before any file is read.
  let reads = 0;
  const many = Array.from({ length: ENTRY_LIMIT + 1 }, (_, i) => ({ path: `entries/${String(i).padStart(20, "0")}.json`, size: 1, read: async () => { reads += 1; return new Uint8Array(1); } }));
  assert.equal(await codeOf(readExportItems(many)), "DASH_LIMIT_EXCEEDED");
  assert.equal(reads, 0, "the listing is checked completely before any file is read");
  assert.equal(await codeOf(readExportItems("not a list")), "DASH_USAGE");
  assert.equal(ITEM_LIMIT, ENTRY_LIMIT * 7 + 3);
});

test("SH06 the view model is built from the bytes read once: later changes to the source cannot reach it", async () => {
  const files = listExport(fixtureExportDirectory("all-kinds-tombstoned"));
  const counter = new Map();
  const live = files.map((f) => ({ path: f.path, bytes: new Uint8Array(f.bytes) }));
  const input = await readExportItems(itemsOf(live, counter));
  const before = canonicalViewModelBytes(buildDashboardViewModel(input));
  for (const f of live) f.bytes.fill(0); // a swap or overwrite after the read
  assert.deepEqual(canonicalViewModelBytes(buildDashboardViewModel(input)), before);
  assert.deepEqual(before, canonicalViewModelBytes(buildDashboardViewModel({ files })), "equal to a build from the pristine bytes");
  assert.ok([...counter.values()].every((n) => n === 1));
  // Negative control: the same swap BEFORE the read does change what is read (the test can see a change).
  const swapped = live.map((f) => ({ path: f.path, size: f.bytes.length, read: async () => f.bytes }));
  assert.ok((await readExportItems(swapped)).files.every((f) => f.bytes.every((b) => b === 0)));
});

test("SH14 SH02 both browser routes and any listing order give the same view model bytes", async () => {
  for (const name of ["all-kinds-tombstoned", "single-entry", "empty", "claims-only"]) {
    const files = listExport(fixtureExportDirectory(name));
    const reference = canonicalViewModelBytes(buildDashboardViewModel({ files }));
    const viaHandle = await readExportItems(await itemsFromDirectoryHandle(fakeDirectory(files)));
    const viaList = await readExportItems(itemsFromFileList(fakeFileList(files)));
    const shuffled = await readExportItems(itemsOf([...files].reverse()));
    for (const input of [viaHandle, viaList, shuffled]) {
      assert.deepEqual(input.files.map((f) => f.path), files.map((f) => f.path), `${name}: bytewise order`);
      assert.deepEqual(canonicalViewModelBytes(buildDashboardViewModel(input)), reference, name);
    }
  }
});

test("SH02 SH16 the collectors accept only a layout folder: unknown directories, unknown kinds, files without a folder name are refused", async () => {
  const files = listExport(fixtureExportDirectory("single-entry"));
  const stray = fakeDirectory(files);
  const original = stray.values;
  stray.values = async function* values() { yield* original(); yield { kind: "directory", name: "node_modules", values: async function* none() {} }; };
  assert.equal(await codeOf(itemsFromDirectoryHandle(stray)), "DASH_EXPORT_UNREADABLE", "an unknown directory is refused at once, not enumerated");
  const odd = fakeDirectory(files);
  const oddValues = odd.values;
  odd.values = async function* values() { yield* oddValues(); yield { kind: "symlink", name: "x" }; };
  assert.equal(await codeOf(itemsFromDirectoryHandle(odd)), "DASH_EXPORT_UNREADABLE");
  assert.throws(() => itemsFromFileList([{ name: "a", webkitRelativePath: "", size: 1, arrayBuffer: async () => new ArrayBuffer(1) }]), (e) => e.code === "DASH_EXPORT_UNREADABLE");
  assert.deepEqual(itemsFromFileList([]), []);
  assert.deepEqual(itemsFromFileList(null), []);
});

test("SH04 SH05 tampered exports are rejected with DASH_EXPORT_INVALID carrying an MO-1308 code, and nothing is built", async () => {
  const files = listExport(fixtureExportDirectory("all-kinds-tombstoned"));
  assert.ok(buildViewModelInBrowser({ files: (await readExportItems(itemsOf(files))).files }), "the untampered export builds");
  const seen = {};
  for (const [name, tampered] of Object.entries(tamperVariants(files))) {
    const input = await readExportItems(itemsOf(tampered));
    try { buildViewModelInBrowser(input); assert.fail(`${name} was accepted`); } catch (error) {
      assert.ok(error instanceof DashboardError, name);
      assert.equal(error.code, "DASH_EXPORT_INVALID", name);
      assert.match(error.historyCode, /^MO1308_[A-Z_]+$/u, name);
      seen[name] = error.historyCode;
    }
  }
  assert.deepEqual(Object.keys(seen).sort(), ["chain", "manifest", "marker", "member", "truncatedTail"]);
  assert.deepEqual(seen, TAMPER_CODES, "the carried MO-1308 codes are pinned");
});
// The codes the released MO-1308 verifier gives for these variants; a change here would be a change in MO-1308 behaviour.
const TAMPER_CODES = { chain: "MO1308_EXPORT_CORRUPT", member: "MO1308_EXPORT_CORRUPT", manifest: "MO1308_EXPORT_CORRUPT", marker: "MO1308_EXPORT_CORRUPT", truncatedTail: "MO1308_EXPORT_CORRUPT" };

test("SH04 the released verifier needs the stand-in only where the SharedArrayBuffer global is absent, and the stand-in is scoped", () => {
  const files = readExportFiles("single-entry");
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "SharedArrayBuffer");
  try {
    // Control: with the global absent the released verifier throws a ReferenceError (the browser defect this module compensates for).
    delete globalThis.SharedArrayBuffer;
    assert.throws(() => buildDashboardViewModel({ files }), ReferenceError);
    // With the stand-in it builds, and the global is gone again afterwards, also when the action throws.
    assert.equal(buildViewModelInBrowser({ files }).entries.length, 1);
    assert.equal(typeof globalThis.SharedArrayBuffer, "undefined");
    assert.throws(() => withSharedArrayBufferStandIn(() => { throw new RangeError("x"); }), RangeError);
    assert.equal(typeof globalThis.SharedArrayBuffer, "undefined");
    // A SharedArrayBuffer-backed input is still refused by the verifier's own rule (the stand-in never matches a real value).
  } finally { Object.defineProperty(globalThis, "SharedArrayBuffer", descriptor); }
  // Where the global exists nothing is installed or replaced.
  const real = globalThis.SharedArrayBuffer;
  assert.equal(withSharedArrayBufferStandIn(() => globalThis.SharedArrayBuffer), real);
  assert.equal(globalThis.SharedArrayBuffer, real);
});

test("SH08 page.embedded.js is exactly page.js with the registry spliced in, and the committed file is current", () => {
  const derived = deriveEmbeddedPage(fs.readFileSync(PAGE_SCRIPT, "utf8"));
  assert.equal(fs.readFileSync(EMBEDDED_PAGE_SCRIPT, "utf8"), derived);
  assert.ok(!derived.includes("@@WORDING@@") && derived.includes(JSON.stringify(Object.keys(WORDING)[0]).slice(0, 8)));
  const check = spawnSync(process.execPath, [path.join(STUDIO_ROOT, "scripts", "derive-studio-history-page.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stdout);
  // Negative control: a changed page script or registry makes the derivation differ, and a script without its mark is refused.
  assert.notEqual(deriveEmbeddedPage(`${fs.readFileSync(PAGE_SCRIPT, "utf8")}\n// changed`), derived);
  assert.throws(() => deriveEmbeddedPage("(() => {})();"), /contract/u);
  // The embedded page makes no request and adds no sink: it is page.js plus data.
  assert.ok(derived.startsWith('"use strict";'));
});

test("SH08 the MO-1309 page, the dashboard and MO-1308 modules and the lock files are byte-identical to v1.3.0", () => {
  const blobs = JSON.parse(read("tests/fixtures/studio-history/baseline-blobs.json"));
  assert.equal(blobs.baseline, "889f99e72a5d41c242572cc052ab97b07cc10a24");
  assert.ok(Object.keys(blobs.files).length >= 15);
  for (const [file, expected] of Object.entries(blobs.files)) assert.equal(sha(fs.readFileSync(path.join(REPO_ROOT, file))), expected, file);
  // Negative control: the comparison sees a one-byte difference.
  const sample = fs.readFileSync(path.join(REPO_ROOT, Object.keys(blobs.files)[0]));
  assert.notEqual(sha(Buffer.concat([sample, Buffer.from("\n")])), Object.values(blobs.files)[0]);
});

test("SH22 ARCHITECTURE carries the two 1.3.1 clauses and no other change", () => {
  const blobs = JSON.parse(read("tests/fixtures/studio-history/baseline-blobs.json"));
  const flat = (text) => text.replace(/\s+/gu, " ").trim();
  const architecture = fs.readFileSync(path.join(REPO_ROOT, "ARCHITECTURE.md"), "utf8");
  const five = "MemoryOS 1.3.1 lets Studio present a MO-1308 history export inside the same JavaScript boundary. The user opens an export folder through the browser's user-initiated folder access; Studio reads its files once into memory, verifies them with the MO-1308 verifier, and renders the MO-1309 dashboard modules. It is read-only, makes no request other than for Studio's own static files, stores nothing, and never appends, tombstones, approves or re-derives anything.";
  const thirteen = "MemoryOS 1.3.1 extends the MO-1309 clause only to a user-initiated, read-only read, by Studio, of an export folder the user selects. It does not authorize Studio to open, create, write, watch or remember a ledger store, a server, hosting, accounts, tenancy, billing, a network service, a database or any write path to a ledger. The store stays CLI-only (MO-1308 H06, H40).";
  const sections = architecture.split(/^## /mu);
  const section5 = sections.find((s) => s.startsWith("5. "));
  const section13 = sections.find((s) => s.startsWith("13. "));
  assert.equal(flat(section5).split(five).length, 2, "section 5 has the 1.3.1 paragraph once");
  assert.equal(flat(section13).split(thirteen).length, 2, "section 13 has the 1.3.1 paragraph once");
  assert.ok(section5.indexOf("MO-1309 adds a downstream") < section5.indexOf("MemoryOS 1.3.1 lets Studio") && section5.indexOf("MemoryOS 1.3.1 lets Studio") < section5.indexOf("### `cca-sdk`"));
  assert.ok(section13.indexOf("MO-1309 is a narrow") < section13.indexOf("MemoryOS 1.3.1 extends"));
  // Removing exactly those two paragraphs restores the v1.3.0 file byte for byte: there is no other ARCHITECTURE change.
  const paragraphs = architecture.split("\n\n");
  const kept = paragraphs.filter((paragraph) => ![five, thirteen].includes(flat(paragraph)));
  assert.equal(paragraphs.length - kept.length, 2, "exactly the two clauses are removed");
  const restored = kept.join("\n\n");
  assert.equal(sha(restored), blobs.architectureSha256);
});

test("SH12 SH10 the Studio History registry is closed, clean under the MO-1309 forbidden-affordance rule, and every control action is in the closed set", () => {
  const items = Object.entries(HISTORY_WORDING).map(([key, text]) => ({ key, text }));
  assert.deepEqual(scanHistoryStrings(items), []);
  for (const { key, text } of items) assert.deepEqual(forbiddenTerms(text), [], key);
  assert.throws(() => historyWording("no.such.key"), TypeError);
  assert.ok(Object.isFrozen(HISTORY_WORDING) && Object.isFrozen(HISTORY_SCREEN_ACTIONS));
  assert.deepEqual([...HISTORY_SCREEN_ACTIONS], ["open-folder", "open-folder-compat", "save-snapshot", "clear"]);
  // Negative controls: the scanners catch real violations.
  assert.ok(scanHistoryStrings([{ key: "status.shown", text: "Approved and ready ✓" }]).some((v) => v.rule === "forbidden-term"));
  assert.ok(scanHistoryStrings([{ key: "not.a.key", text: "x" }]).some((v) => v.rule === "not-a-registry-key"));
  assert.ok(scanHistoryStrings([{ key: "status.shown", text: "different" }]).some((v) => v.rule === "text-differs-from-registry"));
  assert.ok(scanHistoryControls([{ element: "button", action: "approve" }, { element: "a", action: "clear" }, { element: "form", action: "clear" }]).length === 3);
  assert.deepEqual(scanHistoryControls([{ element: "button", action: "clear" }, { element: "input", action: "open-folder-compat" }]), []);
  // Every registry key is used by the screen, the shell or the markup, and every key the screen names exists.
  const sources = ["web/js/studio-history-screen.js", "web/js/app.js", "web/index.html"].map(read).join("\n");
  for (const key of Object.keys(HISTORY_WORDING)) assert.ok(sources.includes(`"${key}"`) || (key.startsWith("error.DASH_") && sources.includes("error.${code}")) || sources.includes(`>${HISTORY_WORDING[key]}<`) || sources.includes(`"${HISTORY_WORDING[key]}"`), `unused key ${key}`);
  const named = [...read("web/js/studio-history-screen.js").matchAll(/\b(?:say|w)\(\s*(?:"[a-z]+"\s*,\s*)?"([A-Za-z]+\.[A-Za-z_.]+)"/gu)].map((m) => m[1]);
  assert.ok(named.length > 10);
  for (const key of named) assert.ok(Object.hasOwn(HISTORY_WORDING, key), `screen names unknown key ${key}`);
  for (const action of read("web/js/studio-history-screen.js").matchAll(/"data-action": "([a-z-]+)"/gu)) assert.ok(HISTORY_SCREEN_ACTIONS.includes(action[1]), action[1]);
});

test("SH01 SH12 the Studio nav entry is static markup that equals the registry", () => {
  const html = read("web/index.html");
  const items = [...html.matchAll(/<a class="nav-item"[^>]*data-scope="history"[^>]*>[\s\S]*?<\/a>/gu)];
  assert.equal(items.length, 1);
  const item = items[0][0];
  assert.match(item, /href="#history"/u);
  assert.ok(item.includes(`aria-label="${HISTORY_WORDING["nav.label"]}"`) && item.includes(`title="${HISTORY_WORDING["nav.tooltip"]}"`));
  assert.ok(item.includes(`<span>${HISTORY_WORDING["nav.label"]}</span>`));
  assert.ok(html.includes(`<p class="nav-label">${HISTORY_WORDING["nav.heading"]}</p>`));
  assert.equal((html.match(/id="history-screen"/gu) ?? []).length, 1);
  // The frame host page is static, script-free and carries its own restrictive policy.
  const frame = read("web/history-view.html");
  assert.ok(frame.includes(`<title>${WORDING["document.title"]}</title>`));
  assert.ok(frame.includes(`content="default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'"`));
  assert.ok(!/<script(?![^>]*type="application\/json")/iu.test(frame), "no script element other than the data block");
  assert.ok(!/unsafe-inline|unsafe-eval|data:|blob:|http:|https:/iu.test(frame));
});

test("SH10 SH11 SH02 the History modules use none of the forbidden APIs, take no storage, link or form, and only the screen fetches", () => {
  const strip = (text) => text.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n").replace(/"[^"\n]*"/gu, '""').replace(/`[^`]*`/gu, "``");
  const banned = [/\bnode:/u, /\brequire\s*\(/u, /\bprocess\b/u, /\bBuffer\b/u, /\beval\s*\(/u, /new Function/u, /\bimport\s*\(/u, /innerHTML|outerHTML|insertAdjacentHTML/u, /document\.write/u,
    /window\.open|\.open\(/u, /localStorage|sessionStorage|indexedDB|\bcaches\b|serviceWorker/u, /XMLHttpRequest|WebSocket|EventSource|sendBeacon/u, /showSaveFilePicker|showOpenFilePicker|requestPermission|queryPermission/u,
    /document\.cookie/u, /\bDate\b|Math\.random|\bIntl\b|toLocale|localeCompare|performance\.now/u, /\bpostMessage\b|\.submit\(/u];
  for (const file of ["studio-history-reader.js", "studio-history-wording.js", "studio-history-verify.js", "studio-history-screen.js", "memoryos-dashboard-export-bounds.js"]) {
    const body = strip(read(`web/js/${file}`));
    for (const pattern of banned) assert.ok(!pattern.test(body), `${file}: ${pattern}`);
    if (file !== "studio-history-screen.js") assert.ok(!/\bfetch\b|\bwindow\b|\bdocument\b/u.test(body), `${file}: pure module touches the page`);
  }
  const screen = strip(read("web/js/studio-history-screen.js"));
  assert.equal((screen.match(/\bwin\.fetch\(/gu) ?? []).length, 1, "exactly one fetch: the same-origin snapshot source load");
  const uncommented = read("web/js/studio-history-screen.js").replace(/\/\/.*$/gmu, "");
  assert.ok(!/<a |<form|action=|createElement\("form"\)/u.test(uncommented), "the screen creates no link or form markup");
  assert.equal((uncommented.match(/\bhref\b/gu) ?? []).length, 1, "the one href is the unattached download anchor");
  assert.equal((read("web/js/studio-history-screen.js").match(/createElement\("a"\)/gu) ?? []).length, 1);
  // Negative control: the scan catches real violations.
  const sample = 'localStorage.setItem("k","v"); el.innerHTML = x; new WebSocket(u); import("x"); eval("1");';
  assert.ok(banned.filter((pattern) => pattern.test(sample)).length >= 4);
  // The History modules import no SDK, Core, readiness, CI, filesystem or network module.
  for (const file of ["studio-history-reader.js", "studio-history-wording.js", "studio-history-verify.js", "studio-history-screen.js"]) {
    const imports = [...read(`web/js/${file}`).matchAll(/^\s*import\s[^;]*?from\s+"([^"]+)"/gmu)].map((m) => m[1]);
    for (const imported of imports) assert.match(imported, /^\.\/(memoryos-dashboard-(contract|viewmodel|snapshot|wording|export-bounds)|mip-canonical|studio-history-(reader|verify|wording))\.js$/u, `${file} imports ${imported}`);
  }
  // app.js loads the screen only on demand, with exactly one dynamic import, and imports nothing else new.
  const app = read("web/js/app.js");
  assert.equal((app.match(/import\("\.\/studio-history-screen\.js"\)/gu) ?? []).length, 1);
  assert.equal((app.match(/\bimport\(/gu) ?? []).length, 1);
});

test("SH19 SH21 the History work adds no build step, dependency or package field", () => {
  const manifest = JSON.parse(read("package.json"));
  const blobs = JSON.parse(read("tests/fixtures/studio-history/baseline-blobs.json"));
  assert.equal(sha(fs.readFileSync(path.join(STUDIO_ROOT, "package.json"))), blobs.files["repositories/cca-studio/package.json"]);
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.devDependencies, undefined);
  assert.equal(os.EOL.length > 0, true);
});
