// MO-1309 Phase 2A (Contract Freeze 1 sections 5, 7, 8, 9): the page sources, scanned and exercised without a browser.
// Requirements: DB05, DB06, DB07 (source scan), DB08 (source scan), DB12 (differential), DB13, DB14.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import vm from "node:vm";
import { buildDashboardViewModel, canonicalViewModelBytes } from "../web/js/memoryos-dashboard-viewmodel.js";
import { MEMORYOS_HISTORY_LAYOUT, MEMORYOS_HISTORY_LIMITS } from "../web/js/memoryos-history-contract.js";
import { queryHistoryLedger } from "../web/js/memoryos-history-ledger.js";
import { DASHBOARD_ACTIONS } from "../web/js/memoryos-dashboard-contract.js";
import { WORDING } from "../web/js/memoryos-dashboard-wording.js";
import { FIXTURE_NAMES, readExportFiles } from "./support-dashboard-fixtures.mjs";
import { assembleTestSnapshot, readDashboardSource } from "./support-dashboard-snapshot.mjs";
import { syntheticViewModel } from "./support-dashboard-synthetic.mjs";

const build = (name) => buildDashboardViewModel({ files: readExportFiles(name) });
const snapshotOf = (name) => assembleTestSnapshot({ viewModel: build(name) });

// Freeze section 5: constructs the page must not contain. Each is tested for teeth below.
const FORBIDDEN_SOURCE = {
  eval: /\beval\s*\(/u, Function: /\b(new\s+)?Function\s*\(/u, innerHTML: /\binnerHTML\b/u, outerHTML: /\bouterHTML\b/u,
  insertAdjacentHTML: /\binsertAdjacentHTML\b/u, documentWrite: /\bdocument\s*\.\s*write/u, javascriptUrl: /javascript:/iu,
  timerString: /\bset(Timeout|Interval)\b/u, dynamicImport: /\bimport\s*\(/u, importStatement: /^\s*import\b/mu, fetch: /\bfetch\b/u,
  xhr: /XMLHttpRequest/u, webSocket: /\bWebSocket\b/u, eventSource: /\bEventSource\b/u, sendBeacon: /\bsendBeacon\b/u,
  formElement: /<form\b|createElement\(\s*["']form["']/iu, windowOpen: /\bopen\s*\(/u, cookie: /\bcookie\b/iu,
  localStorage: /\blocalStorage\b/u, sessionStorage: /\bsessionStorage\b/u, indexedDB: /\bindexedDB\b/iu,
  eventHandlerAttribute: /\bon[a-z]+\s*=/iu, styleAttribute: /\bstyle\s*=|setAttribute\(\s*["']style/u, hrefOrSrc: /\b(href|src)\s*=|["'](href|src)["']/u,
  worker: /\b(Worker|SharedWorker|serviceWorker)\b/u, cssImport: /@import|url\s*\(/u, locationWrite: /\blocation\s*(=|\.)/u,
};
const scanSource = (text) => Object.entries(FORBIDDEN_SOURCE).filter(([, pattern]) => pattern.test(text)).map(([name]) => name);

test("DB07 DB08 the page script, style and template contain no forbidden API, sink, handler or external reference", () => {
  for (const name of ["page.js", "page.css", "page.html"]) assert.deepEqual(scanSource(readDashboardSource(name)), [], name);
});

test("the source scan has teeth (negative controls): every forbidden construct is detected", () => {
  const probes = {
    eval: "eval('1')", Function: "new Function('x')", innerHTML: "a.innerHTML = x", outerHTML: "a.outerHTML", insertAdjacentHTML: "a.insertAdjacentHTML('x', y)",
    documentWrite: "document.write(x)", javascriptUrl: "javascript:void(0)", timerString: "setTimeout('x', 1)", dynamicImport: "import('./x.js')",
    importStatement: "import x from './x.js'", fetch: "fetch('/x')", xhr: "new XMLHttpRequest()", webSocket: "new WebSocket(u)", eventSource: "new EventSource(u)",
    sendBeacon: "navigator.sendBeacon(u)", formElement: "<form>", windowOpen: "window.open(u)", cookie: "document.cookie", localStorage: "localStorage.x",
    sessionStorage: "sessionStorage.x", indexedDB: "indexedDB.open", eventHandlerAttribute: "<a onclick=x>", styleAttribute: "<p style=x>",
    hrefOrSrc: "<a href=x>", worker: "new Worker(u)", cssImport: "@import 'x'", locationWrite: "location = x",
  };
  assert.deepEqual(Object.keys(probes).sort(), Object.keys(FORBIDDEN_SOURCE).sort());
  for (const [name, text] of Object.entries(probes)) assert.ok(scanSource(text).includes(name), name);
});

test("DB05 DB06 the snapshot is one self-contained file: hash-pinned script and style, no external reference", () => {
  for (const name of FIXTURE_NAMES) {
    const { html, csp, script, style } = snapshotOf(name);
    const sha = (text) => `'sha256-${crypto.createHash("sha256").update(text, "utf8").digest("base64")}'`;
    assert.equal(csp, `default-src 'none'; script-src ${sha(script)}; style-src ${sha(style)}; base-uri 'none'; form-action 'none'`);
    assert.doesNotMatch(csp, /unsafe-|data:|blob:|\*/u);
    assert.equal(html.match(/<script\b/gu).length, 2, "one data block and one script");
    assert.equal(html.match(/<style\b/gu).length, 1);
    assert.equal(html.match(/<meta http-equiv="Content-Security-Policy"/gu).length, 1);
    assert.ok(html.indexOf("Content-Security-Policy") < html.indexOf("<style>") && html.indexOf("<style>") < html.indexOf("<script"), "policy comes first");
    // No external reference outside the policy meta and the data block (section 9.2).
    const outside = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/u, "")
      .replace(/<script type="application\/json" id="memoryos-dashboard-data">[\s\S]*?<\/script>/u, "");
    assert.doesNotMatch(outside, /https?:|\/\/|data:|blob:|\bsrc\s*=|\bhref\s*=|<link\b|<iframe\b|<object\b|<embed\b|<img\b|<base\b/iu);
    assert.ok(html.includes(`<style>${style}</style>`) && html.includes(`<script>${script}</script>`));
    assert.ok(Buffer.byteLength(html) < 1_000_000);
  }
});

test("DB09 (page side) the embedded data is escaped, parses back to the canonical view model, and cannot close the block", () => {
  const hostile = syntheticViewModel(3, { workspace: "</script><script>alert(1)</script><!-- & \u2028 \u2029 -->", longSubject: "</SCRIPT> <img src=x onerror=1> \u2028" });
  const { html } = assembleTestSnapshot({ viewModel: hostile });
  const block = /<script type="application\/json" id="memoryos-dashboard-data">([\s\S]*?)<\/script>/u.exec(html)[1];
  assert.doesNotMatch(block, /[<>&\u2028\u2029]/u);
  const parsed = JSON.parse(block);
  assert.equal(parsed.source.workspaceIdentifier, hostile.source.workspaceIdentifier);
  assert.equal(`${JSON.stringify(parsed)}\n`.length > 0, true);
  assert.deepEqual(new TextDecoder().decode(canonicalViewModelBytes(parsed)), new TextDecoder().decode(canonicalViewModelBytes(hostile)));
  assert.equal(html.match(/<script\b/gu).length, 2);
  assert.equal(html.match(/<\/script>/gu).length, 2);
});

test("the footer digest is SHA-256 of the file with that one field blanked (section 5)", () => {
  const { html, digest, blanked } = snapshotOf("single-entry");
  assert.equal(html.replace(digest, ""), blanked);
  assert.equal(digest, `sha256:${crypto.createHash("sha256").update(blanked, "utf8").digest("hex")}`);
  assert.equal(assembleTestSnapshot({ viewModel: build("single-entry") }).html, html, "deterministic");
  assert.notEqual(snapshotOf("claims-only").digest, digest);
});

test("DB14 the template and script carry no display string of their own: the placeholder is the registry, and every static string is a registry value", () => {
  const { html, script } = snapshotOf("all-kinds-tombstoned");
  assert.equal(readDashboardSource("page.js").split("null; /*@@WORDING@@*/").length, 2);
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gu, "").replace(/<style>[\s\S]*?<\/style>/u, "").replace(/<meta[^>]*>/gu, "");
  const text = stripped.replace(/<[^>]+>/gu, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
  const decoded = (value) => value.replace(/&quot;/gu, '"').replace(/&#39;/gu, "'").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&amp;/gu, "&");
  const registry = new Set(Object.values(WORDING));
  for (const line of text) if (!/^(test-assembler|sha256:[0-9a-f]{64})$/u.test(line)) assert.ok(registry.has(decoded(line)), `static text is a registry value: ${line}`);
  assert.ok(script.includes('"document.title"'));
  // Every wording key the script asks for exists in the registry (a static check of say("...") / w(tag, "...")).
  const source = readDashboardSource("page.js");
  const keys = new Set([...source.matchAll(/\b(?:say|w)\(\s*(?:"[a-z0-9]+"\s*,\s*)?"([A-Za-z0-9.]+)"/gu)].map((m) => m[1]).filter((k) => k.includes(".")));
  for (const key of keys) assert.ok(Object.hasOwn(WORDING, key), key);
  assert.ok(keys.size > 30);
});

test("DB13 the script's control actions are exactly members of the closed read-only action set and nothing else writes", () => {
  const source = readDashboardSource("page.js");
  const actions = new Set([...source.matchAll(/"data-action":\s*"([a-z-]+)"/gu)].map((m) => m[1]));
  for (const action of actions) assert.ok(DASHBOARD_ACTIONS.includes(action), action);
  assert.deepEqual([...actions].sort(), ["copy", "expand", "filter", "page"], "sort is chosen by id in one expression");
  assert.match(source, /"data-action": id === "f-sort" \? "sort" : "filter"/u);
  // Only these listeners exist: change, input, click.
  assert.deepEqual([...new Set([...source.matchAll(/addEventListener\("([a-z]+)"/gu)].map((m) => m[1]))].sort(), ["change", "click", "input"]);
  // Attributes are set only through the allow-listed helper.
  assert.equal([...source.matchAll(/setAttribute\(/gu)].length, 1);
});

// ---- DB12: page filtering equals MO-1308 query ----
function pageLogic(name) {
  const { script } = snapshotOf(name);
  const context = {};
  vm.runInNewContext(script, context);
  const logic = context.MemoryOSDashboardLogic;
  assert.ok(logic && !("document" in context));
  return logic;
}
const json = (value) => JSON.parse(JSON.stringify(value));

test("DB12 page filter results equal MO-1308 query for record kind, subject and retention, over every real fixture", () => {
  let compared = 0;
  for (const name of FIXTURE_NAMES) {
    const files = readExportFiles(name);
    const byPath = new Map(files.map((f) => [f.path, f.bytes]));
    const viewModel = build(name);
    const descriptorBytes = byPath.get(MEMORYOS_HISTORY_LAYOUT.descriptor);
    const entries = viewModel.entries.map((e) => byPath.get(`${MEMORYOS_HISTORY_LAYOUT.entriesDirectory}/${String(e.index).padStart(MEMORYOS_HISTORY_LAYOUT.entryIndexDigits, "0")}.json`));
    const logic = pageLogic(name);
    const subjects = [null, { type: "WORKSPACE", value: viewModel.source.workspaceIdentifier }, { type: "WORKSPACE", value: "absent" },
      ...viewModel.entries.flatMap((e) => e.subjects.map((s) => ({ type: s.type, value: s.value })))];
    const kinds = [[], ...viewModel.summary.byRecordKind.map((r) => [r.recordKind]), viewModel.summary.byRecordKind.slice(0, 2).map((r) => r.recordKind).sort()];
    for (const recordKinds of kinds) for (const subject of subjects) for (const retention of ["ANY", "RETAINED", "PURGED"]) {
      const expected = queryHistoryLedger({ descriptorBytes, entries, query: {
        kind: "MemoryOSHistoryQuery", version: "1.0.0", recordKinds, subject, retention, fromIndex: 0, limit: MEMORYOS_HISTORY_LIMITS.queryLimitMaximum } }).entries.map((e) => e.index);
      const actual = json(logic.filterEntries(json(viewModel.entries), { recordKinds, subject, retention, decisionConsistency: null })).map((e) => e.index);
      assert.deepEqual(actual, expected, `${name} ${JSON.stringify({ recordKinds, subject, retention })}`);
      compared += 1;
    }
  }
  assert.ok(compared > 300);
});

test("DB12 the decision-consistency filter, sort and paging behave as specified", () => {
  const logic = pageLogic("all-kinds-tombstoned");
  const viewModel = json(build("all-kinds-tombstoned"));
  const contrary = json(logic.filterEntries(viewModel.entries, { ...logic.NO_FILTER, decisionConsistency: "CONTRARY_TO_READINESS" }));
  assert.ok(contrary.length > 0 && contrary.every((e) => e.decisionConsistency === "CONTRARY_TO_READINESS"));
  const ascending = json(logic.orderEntries(viewModel.entries, "ASCENDING")).map((e) => e.index);
  assert.deepEqual(json(logic.orderEntries(viewModel.entries, "DESCENDING")).map((e) => e.index), [...ascending].reverse());
  const big = syntheticViewModel(250);
  const biglogic = pageLogic("single-entry");
  assert.equal(biglogic.PAGE_SIZE, 100);
  const sizes = [1, 2, 3].map((n) => biglogic.pageOf(json(big.entries), n).items.length);
  assert.deepEqual(sizes, [100, 100, 50]);
  assert.equal(biglogic.pageOf(json(big.entries), 99).page, 3);
  assert.equal(biglogic.pageOf(json(big.entries), 0).page, 1);
  assert.equal(biglogic.pageOf([], 1).pages, 1);
  assert.ok(biglogic.PAGE_SIZE <= MEMORYOS_HISTORY_LIMITS.queryLimitMaximum);
});
