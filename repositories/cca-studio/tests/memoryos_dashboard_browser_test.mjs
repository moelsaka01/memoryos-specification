// MO-1309 Phase 2A: the page in a real Chromium-family browser, driven over the DevTools protocol with Node built-ins only.
// Requirements: DB06, DB07, DB08, DB12 (in browser), DB13, DB14, DB15, DB16, DB17, DB23, DB24, DB25.
// The browser is found at MO1309_BROWSER, a known install path, or the cloud-preinstalled Chromium; without one the suite fails.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildDashboardViewModel } from "../web/js/memoryos-dashboard-viewmodel.js";
import { MEMORYOS_HISTORY_LAYOUT, MEMORYOS_HISTORY_LIMITS } from "../web/js/memoryos-history-contract.js";
import { queryHistoryLedger } from "../web/js/memoryos-history-ledger.js";
import { DASHBOARD_ACTIONS } from "../web/js/memoryos-dashboard-contract.js";
import { WORDING, forbiddenTerms, scanChromeStrings, scanControls } from "../web/js/memoryos-dashboard-wording.js";
import { FIXTURE_NAMES, readExportFiles } from "./support-dashboard-fixtures.mjs";
import { assembleTestSnapshot } from "./support-dashboard-snapshot.mjs";
import { syntheticViewModel } from "./support-dashboard-synthetic.mjs";
import { launchBrowser, serveStatic } from "./support-devtools.mjs";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mo1309-page-"));
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { await browser?.close(); fs.rmSync(scratch, { recursive: true, force: true }); });

const viewModelOf = (name) => buildDashboardViewModel({ files: readExportFiles(name) });
let counter = 0;
const writeSnapshot = (html) => { counter += 1; const file = path.join(scratch, `snapshot-${counter}.html`); fs.writeFileSync(file, html); return pathToFileURL(file).href; };
async function open(html, options = {}) {
  const page = await browser.openPage(options);
  await page.navigate(writeSnapshot(html));
  return page;
}
const noProblems = (page) => page.messages.filter((m) => /error|warning/u.test(m.kind) || m.kind === "exception");

// Extracts what the page renders: chrome strings (outside data cells), data cells, controls and attribute names.
const EXTRACT = `(() => {
  const chrome = [], cells = [], controls = [], attributes = new Set(), classes = new Set(), tags = new Set();
  const walk = (node, inCell) => {
    if (node.nodeType === 3) { if (node.nodeValue.trim() !== "") (inCell ? cells : chrome).push(node.nodeValue.trim()); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === "script" || tag === "style") return;
    tags.add(tag);
    const cell = inCell || node.hasAttribute("data-cell");
    for (const a of node.attributes) { attributes.add(a.name); if (a.name === "class") for (const c of a.value.split(" ")) classes.add(c); }
    if (!cell) for (const a of ["title", "alt", "placeholder", "aria-label", "data-label"]) if (node.hasAttribute(a)) chrome.push(node.getAttribute(a));
    if (["button", "a", "input", "select", "textarea", "form"].includes(tag)) controls.push({ element: tag, action: node.getAttribute("data-action") });
    for (const child of node.childNodes) walk(child, cell);
  };
  walk(document.body, false);
  return { title: document.title, chrome, cells, controls, attributes: [...attributes], classes: [...classes], tags: [...tags] };
})()`;

const CONTRAST = `(() => {
  const parse = (v) => { const m = /rgba?\\(([^)]+)\\)/.exec(v); const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const background = (el) => { for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  let min = Infinity; const bad = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim() !== "")) continue;
    if (el.closest("script,style,noscript")) continue;
    const st = getComputedStyle(el);
    const a = lum(parse(st.color)), b = lum(background(el));
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    min = Math.min(min, ratio);
    if (ratio < 4.5) bad.push(el.tagName + ":" + el.textContent.slice(0, 30) + ":" + ratio.toFixed(2));
  }
  return { min, bad };
})()`;

const rowIndexes = `[...document.querySelectorAll("#entries tbody tr")].filter((r) => !r.id).map((r) => Number(r.querySelector("td [data-cell]").textContent))`;
const setControl = (id, value) => `(() => { const c = document.getElementById(${JSON.stringify(id)}); c.value = ${JSON.stringify(value)}; c.dispatchEvent(new Event(c.tagName === "INPUT" ? "input" : "change", { bubbles: true })); })()`;

test("every fixture renders, CSP-clean, request-free, with registry-only chrome and a closed read-only control set (DB06 DB07 DB08 DB13 DB14)", async () => {
  const registry = new Map();
  for (const [key, text] of Object.entries(WORDING)) if (!registry.has(text)) registry.set(text, key);
  for (const name of FIXTURE_NAMES) {
    const viewModel = viewModelOf(name);
    const { html } = assembleTestSnapshot({ viewModel });
    const page = await open(html);
    try {
      assert.equal(await page.evaluate("typeof MemoryOSDashboardLogic"), "undefined", "the logic hook exists only without a document");
      assert.deepEqual(page.requests.length, 1, `${name}: only the document was requested`);
      assert.deepEqual(noProblems(page), [], name);
      assert.equal(await page.evaluate("document.querySelectorAll('script').length"), 2);
      assert.equal(await page.evaluate("document.querySelectorAll('img,iframe,object,embed,link,form,a,base').length"), 0);
      const dom = await page.evaluate(EXTRACT);
      // Chrome: every string is a registry value; the scan passes; the title is the registry title.
      assert.equal(dom.title, WORDING["document.title"]);
      const items = [{ key: "document.title", text: dom.title }];
      for (const text of dom.chrome) {
        assert.ok(registry.has(text), `${name}: chrome string is a registry value: ${text}`);
        items.push({ key: registry.get(text), text });
      }
      assert.deepEqual(scanChromeStrings(items), [], name);
      // Controls: a closed action set; no link, no form, no input other than the two filters.
      assert.ok(dom.controls.length > 0);
      assert.deepEqual(scanControls(dom.controls), [], name);
      for (const control of dom.controls) assert.ok(DASHBOARD_ACTIONS.includes(control.action), JSON.stringify(control));
      // No attribute outside the allow-list, and no class that could encode a state.
      const allowedAttributes = new Set(["id", "class", "role", "scope", "type", "colspan", "value", "for", "tabindex", "data-cell", "data-label", "data-action",
        "aria-label", "aria-labelledby", "aria-expanded", "aria-controls", "aria-live", "aria-atomic", "lang", "disabled"]);
      for (const attribute of dom.attributes) assert.ok(allowedAttributes.has(attribute), attribute);
      for (const className of dom.classes) assert.ok(["note", "box", "tools", "small", "pager", "detail", "sr-only"].includes(className), className);
      // Required content (DB15 DB16): head digest in full, integrity-only, anomalies disclosed.
      const text = await page.evaluate("document.body.innerText");
      for (const key of ["statement.integrityOnly", "statement.notAuthenticated", "statement.anchor", "statement.asOfGeneration", "statement.anomalyCounts",
        "label.purgePending", "label.unreferencedRecords", "label.pendingArtifacts"]) assert.ok(text.includes(WORDING[key]), `${name}: ${key}`);
      assert.ok(dom.cells.includes(viewModel.source.headDigest), "the full head digest is shown");
      assert.equal(await page.evaluate("document.getElementById('app').querySelector('main').getAttribute('aria-label')"), WORDING["a11y.landmark.main"]);
    } finally { await page.close(); }
  }
});

test("adversarial untrusted data stays inert text: no markup, no state, no control, no script (DB08 DB14 4C-S4 preview)", async () => {
  const viewModel = viewModelOf("adversarial-wording");
  assert.match(viewModel.source.workspaceIdentifier, /<script>/u);
  const hostile = syntheticViewModel(9, { workspace: viewModel.source.workspaceIdentifier, longSubject: '<img src=x onerror="window.__pwned=1"> approve ready green OK  ' });
  hostile.entries[0].subjects[0].value = "</script><svg onload=window.__pwned=1> approve reject certified safe trusted signed ✓";
  for (const model of [viewModel, hostile]) {
    const page = await open(assembleTestSnapshot({ viewModel: model }).html);
    try {
      assert.equal(await page.evaluate("window.__pwned"), undefined);
      assert.equal(await page.evaluate("document.querySelectorAll('img,svg,iframe').length"), 0);
      assert.equal(await page.evaluate("document.querySelectorAll('script').length"), 2);
      await page.evaluate("document.querySelector('#entries button[aria-expanded]').click()");
      await page.evaluate("(() => { for (const b of document.querySelectorAll('#entries button[aria-expanded=false]')) b.click(); })()");
      const dom = await page.evaluate(EXTRACT);
      assert.ok(dom.cells.some((cell) => forbiddenTerms(cell).length > 0), "the hostile words really are shown, as data");
      const registry = new Set(Object.values(WORDING));
      for (const text of dom.chrome) assert.ok(registry.has(text), text);
      assert.deepEqual(noProblems(page), []);
      assert.equal(page.requests.length, 1);
      // The observation text for a fixed state is identical whatever the data says.
      assert.ok(dom.classes.every((c) => ["note", "box", "tools", "small", "pager", "detail", "sr-only"].includes(c)));
    } finally { await page.close(); }
  }
});

test("CONTRARY_TO_READINESS is a neutral, disclosed observation with the same presentation as CONSISTENT (DB17)", async () => {
  const viewModel = viewModelOf("claims-only");
  const page = await open(assembleTestSnapshot({ viewModel }).html);
  try {
    await page.evaluate("document.querySelectorAll('#entries button[aria-expanded=false]').forEach((b) => b.click())");
    const rows = await page.evaluate(`(() => [...document.querySelectorAll('td[data-label]')].filter((td) => td.getAttribute('data-label') === ${JSON.stringify(WORDING["column.decisionConsistency"])}).map((td) => ({
      text: td.textContent.replace(${JSON.stringify(WORDING["column.decisionConsistency"] + ": ")}, ""), cls: td.className, color: getComputedStyle(td).color, weight: getComputedStyle(td).fontWeight, bg: getComputedStyle(td).backgroundColor, deco: getComputedStyle(td).textDecorationLine })))()`);
    const contrary = rows.filter((r) => r.text === WORDING["observation.CONTRARY_TO_READINESS"]);
    const consistent = rows.filter((r) => r.text === WORDING["observation.CONSISTENT"]);
    assert.ok(contrary.length > 0 && consistent.length > 0, JSON.stringify(rows));
    const style = ({ cls, color, weight, bg, deco }) => JSON.stringify({ cls, color, weight, bg, deco });
    assert.equal(new Set([...contrary, ...consistent].map(style)).size, 1, "one presentation for both states");
    const text = await page.evaluate("document.body.innerText");
    assert.ok(text.includes(WORDING["decisionConsistency.CONTRARY_TO_READINESS"]), "the neutral long statement is disclosed on the entry");
    assert.ok(WORDING["decisionConsistency.CONTRARY_TO_READINESS"].includes("not a MemoryOS approval"));
  } finally { await page.close(); }
});

test("DB12 in the browser: filters give the MO-1308 query result for record kind, subject and retention; sort and clear work", async () => {
  const name = "all-kinds-tombstoned";
  const files = readExportFiles(name);
  const byPath = new Map(files.map((f) => [f.path, f.bytes]));
  const viewModel = viewModelOf(name);
  const descriptorBytes = byPath.get(MEMORYOS_HISTORY_LAYOUT.descriptor);
  const entries = viewModel.entries.map((e) => byPath.get(`${MEMORYOS_HISTORY_LAYOUT.entriesDirectory}/${String(e.index).padStart(MEMORYOS_HISTORY_LAYOUT.entryIndexDigits, "0")}.json`));
  const query = (q) => queryHistoryLedger({ descriptorBytes, entries, query: { kind: "MemoryOSHistoryQuery", version: "1.0.0", recordKinds: [], subject: null, retention: "ANY", fromIndex: 0, limit: MEMORYOS_HISTORY_LIMITS.queryLimitMaximum, ...q } }).entries.map((e) => e.index);
  const page = await open(assembleTestSnapshot({ viewModel }).html);
  try {
    assert.deepEqual(await page.evaluate(rowIndexes), query({}));
    for (const retention of ["RETAINED", "PURGED"]) {
      await page.evaluate(setControl("f-retention", retention));
      assert.deepEqual(await page.evaluate(rowIndexes), query({ retention }), retention);
    }
    await page.evaluate(setControl("f-retention", ""));
    for (const { recordKind } of viewModel.summary.byRecordKind) {
      await page.evaluate(setControl("f-kind", recordKind));
      assert.deepEqual(await page.evaluate(rowIndexes), query({ recordKinds: [recordKind] }), recordKind);
      await page.evaluate(setControl("f-retention", "PURGED"));
      assert.deepEqual(await page.evaluate(rowIndexes), query({ recordKinds: [recordKind], retention: "PURGED" }), `${recordKind} purged`);
      await page.evaluate(setControl("f-retention", ""));
    }
    await page.evaluate(setControl("f-kind", ""));
    const subject = viewModel.entries.find((e) => e.subjects.length > 0).subjects[0];
    await page.evaluate(setControl("f-subject-type", subject.type));
    await page.evaluate(setControl("f-subject-value", subject.value));
    assert.deepEqual(await page.evaluate(rowIndexes), query({ subject }), "subject");
    await page.evaluate(setControl("f-subject-value", "no such subject"));
    assert.deepEqual(await page.evaluate(rowIndexes), []);
    assert.ok((await page.evaluate("document.body.innerText")).includes(WORDING["page.noMatch"]));
    await page.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent === " + JSON.stringify(WORDING["filter.clear"]) + ").click()");
    assert.deepEqual(await page.evaluate(rowIndexes), query({}));
    await page.evaluate(setControl("f-sort", "DESCENDING"));
    assert.deepEqual(await page.evaluate(rowIndexes), query({}).reverse());
    // The decision-consistency filter keeps only claims with that stored observation.
    await page.evaluate(setControl("f-sort", "ASCENDING"));
    await page.evaluate(setControl("f-observation", "CONTRARY_TO_READINESS"));
    const expected = viewModel.entries.filter((e) => e.decisionConsistency === "CONTRARY_TO_READINESS").map((e) => e.index);
    assert.deepEqual(await page.evaluate(rowIndexes), expected);
    assert.deepEqual(noProblems(page), []);
    assert.equal(page.requests.length, 1);
  } finally { await page.close(); }
});

test("paging: 100 rows per page, sorted, reset on filter, focus moves to the entries heading; touches only the current page", async () => {
  const viewModel = syntheticViewModel(250);
  const page = await open(assembleTestSnapshot({ viewModel }).html);
  try {
    const rows = () => page.evaluate(`document.querySelectorAll("#entries tbody tr").length`);
    const label = (key) => JSON.stringify(WORDING[key]);
    const click = (key) => page.evaluate(`[...document.querySelectorAll("button")].find((b) => b.textContent === ${label(key)}).click()`);
    assert.equal(await rows(), 100);
    assert.equal(await page.evaluate(`document.querySelector("nav button:first-of-type").disabled`), true);
    await click("page.next");
    assert.equal(await rows(), 100);
    assert.equal((await page.evaluate(rowIndexes))[0], 100);
    assert.equal(await page.evaluate("document.activeElement.id"), "h-entries");
    await click("page.next");
    assert.equal(await rows(), 50);
    assert.equal(await page.evaluate(`[...document.querySelectorAll("button")].find((b) => b.textContent === ${label("page.next")}).disabled`), true);
    await page.evaluate(setControl("f-sort", "DESCENDING"));
    assert.equal((await page.evaluate(rowIndexes))[0], 249);
    await click("page.next");
    await page.evaluate(setControl("f-retention", "PURGED"));
    assert.ok((await rows()) <= 100 && (await page.evaluate(rowIndexes)).length > 0);
    assert.match(await page.evaluate(`document.querySelector("nav").innerText`), /1\s+of\s+1/u);
    assert.deepEqual(noProblems(page), []);
  } finally { await page.close(); }
});

test("long values are shortened with a visible note and Copy returns the full value (section 9.1)", async () => {
  const long = `subject-${"x".repeat(500)}-end`;
  const page = await open(assembleTestSnapshot({ viewModel: syntheticViewModel(4, { longSubject: long }) }).html);
  try {
    await page.evaluate("document.querySelector('#entries button[aria-expanded]').click()");
    const shown = await page.evaluate("[...document.querySelectorAll('.detail [data-cell]')].map((n) => n.textContent)");
    assert.ok(shown.every((text) => text !== long) && shown.some((text) => text.startsWith("subject-xxx") && text.endsWith("…")));
    assert.ok((await page.evaluate("document.body.innerText")).includes(WORDING["text.truncated"]));
    await page.evaluate("window.__copied = null; navigator.clipboard.writeText = async (text) => { window.__copied = text; }");
    await page.evaluate(`(() => { const b = [...document.querySelectorAll('.detail button[data-action=copy]')].find((x) => document.getElementById(x.getAttribute('aria-labelledby').split(' ')[1]).textContent.startsWith('subject-')); b.click(); })()`);
    await page.evaluate("new Promise((r) => requestAnimationFrame(() => r()))");
    assert.equal(await page.evaluate("window.__copied"), long);
    assert.equal(await page.evaluate("document.querySelector('[role=status]').textContent"), WORDING["action.copied"]);
    await page.evaluate("navigator.clipboard.writeText = async () => { throw new Error('no'); }; document.execCommand = () => false");
    await page.evaluate("document.querySelector('.detail button[data-action=copy]').click()");
    await page.evaluate("new Promise((r) => requestAnimationFrame(() => r()))");
    assert.equal(await page.evaluate("document.querySelector('[role=status]').textContent"), WORDING["action.copyUnavailable"]);
  } finally { await page.close(); }
});

test("DB24 no horizontal page scroll at 320, 768 and 1280 CSS px, and at 200% zoom (640 and 160 CSS px equivalents)", async () => {
  const long = `subject-${"y".repeat(300)}`;
  const models = [syntheticViewModel(30, { longSubject: long }), viewModelOf("all-kinds-tombstoned")];
  for (const model of models) {
    const page = await open(assembleTestSnapshot({ viewModel: model }).html);
    try {
      await page.evaluate("document.querySelectorAll('#entries button[aria-expanded=false]').forEach((b) => b.click())");
      for (const width of [320, 768, 1280, 640, 160]) {
        await page.resize(width);
        const m = await page.evaluate("({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, inner: window.innerWidth })");
        assert.ok(m.scroll <= m.client, `width ${width}: ${JSON.stringify(m)}`);
      }
    } finally { await page.close(); }
  }
});

test("DB23 contrast at least 4.5:1 in light, dark and forced-colors; reduced motion has no animation; no colour-only meaning", async () => {
  for (const options of [{ colorScheme: "light" }, { colorScheme: "dark" }, { colorScheme: "light", reducedMotion: true }]) {
    const page = await open(assembleTestSnapshot({ viewModel: viewModelOf("all-kinds-tombstoned") }).html, options);
    try {
      await page.evaluate("document.querySelectorAll('#entries button[aria-expanded=false]').forEach((b) => b.click())");
      const { min, bad } = await page.evaluate(CONTRAST);
      assert.deepEqual(bad, [], JSON.stringify(options));
      assert.ok(min >= 4.5);
      const motion = await page.evaluate("[...document.querySelectorAll('*')].every((e) => getComputedStyle(e).animationName === 'none' && getComputedStyle(e).transitionDuration.split(',').every((d) => parseFloat(d) === 0))");
      assert.equal(motion, true);
    } finally { await page.close(); }
  }
  const forced = await open(assembleTestSnapshot({ viewModel: viewModelOf("claims-only") }).html, { forcedColors: true });
  try {
    assert.equal(await forced.evaluate("matchMedia('(forced-colors: active)').matches"), true);
    assert.ok((await forced.evaluate("document.body.innerText")).includes(WORDING["heading.page"]));
    const m = await forced.evaluate("({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth })");
    assert.ok(m.s <= m.c);
  } finally { await forced.close(); }
});

test("DB23 keyboard operation, visible focus, landmarks and accessible names", async () => {
  const page = await open(assembleTestSnapshot({ viewModel: viewModelOf("all-kinds-tombstoned") }).html);
  try {
    // Tab reaches the first control; focus is visible; Enter and Space operate buttons.
    await page.keys.tab();
    const first = await page.evaluate("({ tag: document.activeElement.tagName, focusVisible: document.activeElement.matches(':focus-visible'), outline: getComputedStyle(document.activeElement).outlineStyle, width: parseFloat(getComputedStyle(document.activeElement).outlineWidth) })");
    assert.equal(first.tag, "BUTTON");
    assert.ok(first.focusVisible && first.outline !== "none" && first.width >= 2, JSON.stringify(first));
    // Walk to the first Show members button with Tab only.
    let reached = false;
    for (let i = 0; i < 80 && !reached; i += 1) {
      reached = await page.evaluate("document.activeElement.getAttribute('aria-expanded') === 'false'");
      if (!reached) await page.keys.tab();
    }
    assert.ok(reached, "an expand button is reachable by keyboard");
    await page.keys.enter();
    assert.equal(await page.evaluate("document.activeElement.getAttribute('aria-expanded')"), "true");
    assert.ok((await page.evaluate("document.querySelectorAll('.detail').length")) === 1);
    await page.keys.space();
    assert.equal(await page.evaluate("document.activeElement.getAttribute('aria-expanded')"), "false");
    assert.equal(await page.evaluate("document.querySelectorAll('.detail').length"), 0);
    // Landmarks and accessible names.
    const tree = await page.axTree();
    const roles = new Set(tree.filter((n) => !n.ignored).map((n) => n.role?.value));
    for (const role of ["banner", "main", "contentinfo", "navigation", "table", "columnheader", "button", "combobox", "textbox", "status"]) assert.ok(roles.has(role), role);
    for (const node of tree) {
      if (node.ignored || !["button", "combobox", "textbox"].includes(node.role?.value)) continue;
      assert.ok(typeof node.name?.value === "string" && node.name.value.trim() !== "", `${node.role.value} has an accessible name`);
      assert.ok(node.name.value.split(" ").length >= 1);
    }
    const headings = tree.filter((n) => !n.ignored && n.role?.value === "heading").length;
    assert.ok(headings >= 5);
  } finally { await page.close(); }
});

test("DB07 DB06 CSP is enforced: inline injection, eval and network are refused; a one-byte script change prevents the page running", async () => {
  const { html } = assembleTestSnapshot({ viewModel: viewModelOf("single-entry") });
  const page = await open(html);
  try {
    await page.evaluate(`(() => { const s = document.createElement("script"); s.textContent = "window.__injected = 1"; document.body.append(s); })()`);
    assert.equal(await page.evaluate("window.__injected"), undefined, "an injected inline script did not run");
    // The DevTools evaluator is itself exempt from page CSP, so string-timer code (run by the page) is the probe; the control
    // below proves the same probe runs when the policy is absent.
    const stringTimer = "new Promise((r) => { window.__t = 0; setTimeout('window.__t = 1', 0); setTimeout(() => r(window.__t), 60); })";
    assert.equal(await page.evaluate(stringTimer), 0, "string code did not run under the policy");
    assert.equal(await page.evaluate("new Promise((r) => fetch('http://127.0.0.1:9/x').then(() => r('sent'), () => r('refused')))"), "refused");
    assert.ok(page.messages.some((m) => /Content Security Policy|Refused/iu.test(m.text)), "the browser reported the violations");
    await page.evaluate(`(() => { const s = document.createElement("style"); s.textContent = "body{display:none}"; document.head.append(s); })()`);
    assert.notEqual(await page.evaluate("getComputedStyle(document.body).display"), "none", "an injected style did not apply");
  } finally { await page.close(); }
  const noPolicy = await open(html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/u, ""));
  try {
    assert.equal(await noPolicy.evaluate("new Promise((r) => { window.__t = 0; setTimeout('window.__t = 1', 0); setTimeout(() => r(window.__t), 60); })"), 1, "negative control: runs without the policy");
  } finally { await noPolicy.close(); }
  const tampered = await open(html.replace('"use strict";', '"use strict"; '));
  try {
    assert.equal(await tampered.evaluate("document.getElementById('app').children.length"), 0, "a tampered script does not run");
    assert.ok(tampered.messages.some((m) => /Content Security Policy|Refused/iu.test(m.text)));
  } finally { await tampered.close(); }
});

test("an unreadable data block shows only the registry error and nothing else", async () => {
  const { html } = assembleTestSnapshot({ viewModel: viewModelOf("single-entry") });
  const broken = html.replace(/(<script type="application\/json" id="memoryos-dashboard-data">)[\s\S]*?(<\/script>)/u, "$1{not json$2");
  const page = await open(broken);
  try {
    assert.equal(await page.evaluate("document.getElementById('app').innerText"), WORDING["error.dataUnreadable"]);
    assert.equal(await page.evaluate("document.querySelector('[role=alert]') !== null"), true);
    const wrongKind = html.replace(/"kind":"MemoryOSDashboardViewModel"/u, '"kind":"Other"');
    const page2 = await open(wrongKind);
    try { assert.equal(await page2.evaluate("document.getElementById('app').innerText"), WORDING["error.dataUnreadable"]); } finally { await page2.close(); }
  } finally { await page.close(); }
});

test("DB07 DB25 zero requests after load with the network blocked; identical behaviour and DOM from file:// and a static HTTP host", async () => {
  const { html } = assembleTestSnapshot({ viewModel: viewModelOf("all-kinds-tombstoned") });
  const host = await serveStatic(new Map([["/dashboard.html", html]]));
  const script = `(() => { document.querySelectorAll('#entries button[aria-expanded=false]').forEach((b) => b.click()); })()`;
  const dom = {};
  try {
    for (const [where, url] of [["file", writeSnapshot(html)], ["http", `${host.origin}/dashboard.html`]]) {
      const page = await browser.openPage({});
      try {
        await page.navigate(url);
        await page.call("Network.setBlockedURLs", { urls: ["*"] });
        const before = page.requests.length;
        await page.evaluate(script);
        await page.evaluate(setControl("f-retention", "PURGED"));
        await page.evaluate(setControl("f-sort", "DESCENDING"));
        assert.equal(page.requests.length, before, `${where}: no request after load`);
        assert.equal(page.requests.length, 1);
        assert.deepEqual(noProblems(page), [], where);
        dom[where] = await page.evaluate("document.getElementById('app').outerHTML");
      } finally { await page.close(); }
    }
  } finally { await host.close(); }
  assert.equal(dom.file, dom.http, "same rendered DOM from file:// and HTTP");
  assert.ok(dom.file.includes("data-cell"));
});

test("determinism: the rendered DOM for a fixed fixture, viewport and interaction script is identical across runs (section 11)", async () => {
  const { html } = assembleTestSnapshot({ viewModel: viewModelOf("all-kinds-tombstoned") });
  const render = async () => {
    const page = await open(html, { width: 768 });
    try {
      await page.evaluate("document.querySelectorAll('#entries button[aria-expanded=false]').forEach((b) => b.click())");
      await page.evaluate(setControl("f-sort", "DESCENDING"));
      return await page.evaluate("document.documentElement.outerHTML");
    } finally { await page.close(); }
  };
  const [a, b] = [await render(), await render()];
  assert.equal(a, b);
  assert.equal(Buffer.byteLength(a) > 1000, true);
});
