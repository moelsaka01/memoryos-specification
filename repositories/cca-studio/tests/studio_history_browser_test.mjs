// MemoryOS 1.3.1 Studio History in a real Chromium-family browser, driven over the DevTools protocol with Node built-ins only (the
// MO-1309 harness). Studio is served by its own scripts/serve.mjs. The browser is found at MO1309_BROWSER, a known install path or the
// cloud-preinstalled Chromium; without one the suite fails. Requirements are in the test titles (SHnn).
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { WORDING, forbiddenTerms } from "../web/js/memoryos-dashboard-wording.js";
import { HISTORY_SCREEN_ACTIONS, HISTORY_WORDING, scanHistoryControls } from "../web/js/studio-history-wording.js";
import { generateSnapshot } from "../scripts/memoryos-dashboard-generator.mjs";
import { FIXTURE_NAMES } from "./support-dashboard-fixtures.mjs";
import { fixtureExportDirectory, listExport, tamperVariants } from "./support-studio-history.mjs";
import { launchBrowser } from "./support-devtools.mjs";
import { SHOWN, STATUS, chooseDirectory, errorState, frameText, noProblems, openExport, openHistory as openHistoryAt, sleep, startStudio, waitFor, writeFiles } from "./support-studio-history-browser.mjs";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "sh-browser-"));
let browser;
let studio;
let origin;
before(async () => {
  studio = await startStudio();
  origin = studio.origin;
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  studio?.close();
  fs.rmSync(scratch, { recursive: true, force: true });
});

const openHistory = (options = {}) => openHistoryAt(browser, origin, options);
let counter = 0;
const scratchDirectory = (label) => { counter += 1; return path.join(scratch, `${label}-${counter}`); };

// The text the standalone snapshot of the same export renders, in the same browser (the MO-1309 page, file://).
async function standaloneText(name) {
  const output = path.join(scratch, `standalone-${name}-${++counter}.html`);
  generateSnapshot({ exportDirectory: fixtureExportDirectory(name), outputFile: output });
  const page = await browser.openPage({ width: 1280, height: 900 });
  try { await page.navigate(pathToFileURL(output).href); return await page.evaluate("document.getElementById('app').innerText"); } finally { await page.close(); }
}

test("SH01 Studio's home keeps Mission Control and gains a History entry that opens the History screen and leaves it again", async () => {
  const page = await browser.openPage({ width: 1280, height: 900 });
  try {
    await page.navigate(`${origin}/`);
    assert.match(await page.evaluate("document.title"), /Mission Control/u);
    const nav = await page.evaluate(`(() => { const a = document.querySelector('a[data-scope="history"]'); return { text: a.textContent.trim().replace(/\\s+/g, ' '), label: a.getAttribute('aria-label'), title: a.title, href: a.getAttribute('href') }; })()`);
    assert.equal(nav.href, "#history");
    assert.ok(nav.text.endsWith(HISTORY_WORDING["nav.label"]) && nav.label === HISTORY_WORDING["nav.label"] && nav.title === HISTORY_WORDING["nav.tooltip"], JSON.stringify(nav));
    assert.equal(await page.evaluate("getComputedStyle(document.querySelector('#history-screen')).display"), "none");
    assert.ok(await page.evaluate("document.querySelector('#view-root').children.length > 0"), "Mission Control renders as before");
    await page.evaluate("document.querySelector('a[data-scope=\"history\"]').click()");
    await waitFor(page, "document.querySelector('#history-root')", "the screen");
    assert.equal(await page.evaluate("location.hash"), "#history");
    assert.equal(await page.evaluate("getComputedStyle(document.querySelector('#history-screen')).display"), "block");
    assert.equal(await page.evaluate("getComputedStyle(document.querySelector('#session-banner')).display"), "none");
    assert.equal(await page.evaluate("getComputedStyle(document.querySelector('.query-bar')).display"), "none");
    assert.equal(await page.evaluate("document.title"), `${HISTORY_WORDING["route.title"]} · CCA Memory Studio`);
    assert.equal(await page.evaluate("document.querySelector('a[data-scope=\"history\"]').getAttribute('aria-current')"), "page");
    assert.equal(await page.evaluate("document.querySelector('a[data-scope=\"history\"]').title"), HISTORY_WORDING["nav.tooltip"]);
    assert.equal(await page.evaluate(STATUS), HISTORY_WORDING["statement.notChosen"]);
    await page.evaluate("document.querySelector('a[data-scope=\"complete\"]').click()");
    await waitFor(page, "getComputedStyle(document.querySelector('#history-screen')).display === 'none'", "leaving History");
    assert.equal(await page.evaluate("getComputedStyle(document.querySelector('#session-banner')).display !== 'none'"), true);
    assert.deepEqual(noProblems(page), []);
  } finally { await page.close(); }
});

test("SH02 SH04 SH07 SH12 SH13 SH14 every fixture opened through the directory input shows the MO-1309 dashboard, equal to the standalone page", async () => {
  for (const name of FIXTURE_NAMES) {
    const page = await openHistory({ width: 1280, height: 900 });
    try {
      await openExport(page, fixtureExportDirectory(name));
      assert.equal(await frameText(page), await standaloneText(name), `${name}: the rendered dashboard text equals the standalone snapshot's`);
      // The frame is the MO-1309 page: two scripts (data block, page), no image, no frame, nothing executed from data.
      assert.equal(await page.evaluate("document.querySelector('#history-frame').contentDocument.querySelectorAll('script').length"), 2);
      assert.equal(await page.evaluate("document.querySelector('#history-frame').contentDocument.querySelectorAll('img,svg,iframe,object,embed').length"), 0);
      assert.equal(await page.evaluate("document.querySelector('#history-frame').contentWindow.__pwned"), undefined);
      // Every chrome string of the dashboard is a MO-1309 registry string, and forbidden words appear only in data cells.
      const dom = await page.evaluate(`(() => { const d = document.querySelector('#history-frame').contentDocument; const chrome = [], cells = [];
        const walk = (n, inCell) => { if (n.nodeType === 3) { if (n.nodeValue.trim()) (inCell ? cells : chrome).push(n.nodeValue.trim()); return; } if (n.nodeType !== 1) return; const t = n.tagName.toLowerCase(); if (t === 'script' || t === 'style') return;
          const cell = inCell || n.hasAttribute('data-cell'); if (!cell) for (const a of ['title', 'alt', 'aria-label', 'data-label']) if (n.hasAttribute(a)) chrome.push(n.getAttribute(a)); for (const c of n.childNodes) walk(c, cell); };
        walk(d.body, false); return { chrome, cells }; })()`);
      const registry = new Set(Object.values(WORDING));
      for (const text of dom.chrome) assert.ok(registry.has(text), `${name}: ${text}`);
      if (name === "adversarial-wording") assert.ok(dom.cells.some((cell) => forbiddenTerms(cell).length > 0), "the hostile words really are shown, as data");
      assert.deepEqual(noProblems(page), [], name);
    } finally { await page.close(); }
  }
});

test("SH12 SH10 the History screen's own chrome is registry text, every control is in the closed read-only set, and nothing is a link or form", async () => {
  const page = await openHistory({ width: 1280, height: 900 });
  try {
    await openExport(page, fixtureExportDirectory("all-kinds-tombstoned"));
    const dom = await page.evaluate(`(() => { const root = document.querySelector('#history-screen'); const chrome = [], controls = [];
      const walk = (n) => { if (n.nodeType === 3) { if (n.nodeValue.trim()) chrome.push(n.nodeValue.trim()); return; } if (n.nodeType !== 1) return; const t = n.tagName.toLowerCase(); if (t === 'iframe') { chrome.push(n.getAttribute('title')); return; }
        for (const a of ['title', 'alt', 'placeholder', 'aria-label']) if (n.hasAttribute(a)) chrome.push(n.getAttribute(a));
        if (['button', 'a', 'input', 'select', 'textarea', 'form'].includes(t)) controls.push({ element: t, action: n.getAttribute('data-action') });
        for (const c of n.childNodes) walk(c); };
      walk(root); return { chrome, controls, links: root.querySelectorAll('a, form').length }; })()`);
    const registry = new Set(Object.values(HISTORY_WORDING));
    for (const text of dom.chrome) assert.ok(registry.has(text), `not a registry string: ${text}`);
    for (const text of dom.chrome) assert.deepEqual(forbiddenTerms(text), [], text);
    assert.deepEqual(scanHistoryControls(dom.controls), []);
    assert.deepEqual([...new Set(dom.controls.map((c) => c.action))].sort(), [...HISTORY_SCREEN_ACTIONS].sort());
    assert.equal(dom.links, 0);
    // No Mission Control control (observe, export, forget) is reachable on this route.
    assert.equal(await page.evaluate("[...document.querySelectorAll('#session-banner button, .query-bar button')].every((b) => b.offsetParent === null)"), true);
  } finally { await page.close(); }
});

test("SH04 SH05 tampered and malformed exports are rejected inside Studio with the carried MO-1308 code; nothing is rendered and a shown export is removed", async () => {
  const files = listExport(fixtureExportDirectory("all-kinds-tombstoned"));
  const bad = { ...Object.fromEntries(Object.entries(tamperVariants(files)).map(([k, v]) => [k, [v, "DASH_EXPORT_INVALID"]])),
    extraFile: [[...files, { path: "notes.txt", bytes: new Uint8Array([1, 2, 3]) }], "DASH_EXPORT_UNREADABLE"],
    hidden: [[...files, { path: ".DS_Store", bytes: new Uint8Array([1]) }], "DASH_EXPORT_UNREADABLE"] };
  const page = await openHistory({ width: 1280, height: 900 });
  try {
    await openExport(page, fixtureExportDirectory("single-entry"));
    assert.ok(await page.evaluate("Boolean(document.querySelector('#history-frame'))"));
    for (const [name, [variant, code]] of Object.entries(bad)) {
      await page.evaluate("document.querySelector('[data-action=\"clear\"]').click()");
      await chooseDirectory(page, writeFiles(scratchDirectory(name), variant));
      await waitFor(page, "!document.querySelector('#history-error').hidden", `the ${name} error`);
      const shown = await page.evaluate(`(() => ({ role: document.querySelector('#history-error').getAttribute('role'), dd: [...document.querySelectorAll('#history-error dd')].map((d) => d.textContent), text: document.querySelector('#history-error p').textContent,
        frame: Boolean(document.querySelector('#history-frame')), save: document.querySelector('[data-action="save-snapshot"]').disabled, status: document.querySelector('#history-status').textContent }))()`);
      assert.equal(shown.role, "alert");
      assert.equal(shown.dd[0], code, name);
      assert.equal(shown.text, HISTORY_WORDING[`error.${code}`], name);
      if (code === "DASH_EXPORT_INVALID") assert.match(shown.dd[1], /^MO1308_[A-Z_]+$/u, name); else assert.equal(shown.dd.length, 1);
      assert.equal(shown.frame, false, `${name}: no dashboard`);
      assert.equal(shown.save, true);
    }
    // A good export after an error clears the error; a bad export after a good one removes the dashboard (no stale data survives).
    await openExport(page, fixtureExportDirectory("single-entry"));
    assert.equal(await page.evaluate("document.querySelector('#history-error').hidden"), true);
    await chooseDirectory(page, writeFiles(scratchDirectory("after-good"), bad.chain[0]));
    await waitFor(page, "!document.querySelector('#history-error').hidden", "the error after a shown export");
    assert.equal(await page.evaluate("Boolean(document.querySelector('#history-frame'))"), false);
    assert.deepEqual(noProblems(page), []);
  } finally { await page.close(); }
});

test("SH16 SH02 SH14 the directory-handle route renders the same dashboard; a cancelled or denied picker and a missing picker change nothing", async () => {
  const files = listExport(fixtureExportDirectory("all-kinds-tombstoned"));
  const payload = JSON.stringify(files.map((f) => ({ path: f.path, base64: Buffer.from(f.bytes).toString("base64") })));
  const page = await openHistory({ width: 1280, height: 900 });
  try {
    await page.evaluate(`(() => {
      const files = ${payload}.map((f) => ({ path: f.path, bytes: Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0)) }));
      const build = (prefix) => { const children = new Map(); for (const f of files) { if (!f.path.startsWith(prefix)) continue; const rest = f.path.slice(prefix.length); const cut = rest.indexOf('/');
        if (cut === -1) children.set(rest, { kind: 'file', name: rest, getFile: async () => new File([f.bytes], rest) }); else { const n = rest.slice(0, cut); if (!children.has(n)) children.set(n, { kind: 'directory', name: n, ...build(prefix + n + '/') }); } }
        return { values: async function* () { for (const c of children.values()) yield c; } }; };
      window.__pickerCalls = []; window.__mode = 'ok';
      window.showDirectoryPicker = async (options) => { window.__pickerCalls.push(JSON.stringify(options)); if (window.__mode === 'abort') throw new DOMException('cancelled', 'AbortError'); if (window.__mode === 'denied') throw new DOMException('denied', 'NotAllowedError'); return { kind: 'directory', name: 'export', ...build('') }; };
    })()`);
    await page.evaluate("document.querySelector('[data-action=\"open-folder\"]').click()");
    await waitFor(page, `${STATUS} === ${JSON.stringify(SHOWN)} && document.querySelector('#history-frame')?.contentDocument?.querySelector('#app main')`, "the dashboard via the handle route");
    assert.deepEqual(await page.evaluate("window.__pickerCalls"), ['{"mode":"read"}'], "the picker is asked for read access only");
    const viaHandle = await frameText(page);
    await page.evaluate("document.querySelector('[data-action=\"clear\"]').click()");
    await openExport(page, fixtureExportDirectory("all-kinds-tombstoned"));
    assert.equal(await frameText(page), viaHandle, "both routes give the same dashboard text");
    for (const mode of ["abort", "denied"]) {
      await page.evaluate(`window.__mode = ${JSON.stringify(mode)}; document.querySelector('[data-action="open-folder"]').click()`);
      await waitFor(page, `${STATUS} === ${JSON.stringify(HISTORY_WORDING["status.cancelled"])}`, `the ${mode} message`);
      assert.equal(await frameText(page), viaHandle, `${mode}: the shown export is unchanged`);
    }
    await page.evaluate("Object.defineProperty(window, 'showDirectoryPicker', { value: undefined, configurable: true }); document.querySelector('[data-action=\"open-folder\"]').click()");
    await waitFor(page, `${STATUS} === ${JSON.stringify(HISTORY_WORDING["status.pickerUnavailable"])}`, "the unavailable message");
    assert.equal(await frameText(page), viaHandle);
    assert.deepEqual(noProblems(page), []);
  } finally { await page.close(); }
});

test("SH11 SH13 the requests are exactly Studio's own static files; none carries export data; the policies hold in the browser", async () => {
  const page = await openHistory({ width: 1280, height: 900 });
  try {
    for (const url of page.requests) {
      const parsed = new URL(url);
      assert.equal(parsed.origin, origin, url);
      assert.equal(parsed.search + parsed.hash, "", url);
      assert.match(parsed.pathname, /^\/($|index\.html$|styles\.css$|assets\/[\w.-]+$|js\/[\w.-]+\.js$|data\/[\w.-]+\.js$)/u, url);
    }
    const before = page.requests.length;
    const folder = writeFiles(scratchDirectory("img src=x onerror=window.__pwned=1 &amp;#x3C;script&#x3E; folder"), listExport(fixtureExportDirectory("adversarial-wording")));
    await openExport(page, folder);
    const after = page.requests.slice(before).map((url) => new URL(url).pathname).sort();
    assert.deepEqual(after, ["/dashboard/page.css", "/dashboard/page.embedded.js", "/history-view.html"], "from folder chosen to dashboard rendered");
    assert.ok(!(await page.evaluate("document.body.innerText + document.querySelector('#history-frame').contentDocument.body.innerText")).includes("onerror=window.__pwned"), "the picked folder's name is never displayed");
    assert.equal(await page.evaluate("window.__pwned"), undefined);
    // Policy in the framed page: no eval, no inline script, no connection, no framing of its own.
    const inFrame = await page.evaluate(`(async () => { const w = document.querySelector('#history-frame').contentWindow; const out = {};
      try { w.eval('1'); out.eval = 'allowed'; } catch (e) { out.eval = e.name; }
      try { await w.fetch('/js/app.js'); out.fetch = 'allowed'; } catch (e) { out.fetch = e.name; }
      const violations = []; w.document.addEventListener('securitypolicyviolation', (e) => violations.push(e.violatedDirective)); const s = w.document.createElement('script'); s.textContent = 'window.__inline = 1'; w.document.body.append(s);
      await new Promise((r) => setTimeout(r, 100)); out.inline = w.__inline === undefined ? 'blocked' : 'ran'; out.violations = violations; return out; })()`);
    assert.deepEqual({ eval: inFrame.eval, fetch: inFrame.fetch, inline: inFrame.inline }, { eval: "EvalError", fetch: "TypeError", inline: "blocked" });
    assert.ok(inFrame.violations.some((d) => d.startsWith("script-src")));
    // Policy in Studio itself: no eval; Studio cannot be framed; the frame page can.
    // (A DevTools evaluation is exempt from the eval rule of its own realm, so Studio's policy is shown by an inline script instead.)
    const studioInline = await page.evaluate(`(async () => { const violations = []; document.addEventListener('securitypolicyviolation', (e) => violations.push(e.violatedDirective)); const s = document.createElement('script'); s.textContent = 'window.__studioInline = 1'; document.body.append(s);
      await new Promise((r) => setTimeout(r, 100)); s.remove(); return { ran: window.__studioInline !== undefined, violations }; })()`);
    assert.equal(studioInline.ran, false);
    assert.ok(studioInline.violations.some((d) => d.startsWith("script-src")));
    const framed = await page.evaluate(`(async () => { const f = document.createElement('iframe'); f.src = '/index.html'; document.body.append(f); await new Promise((r) => { f.onload = r; setTimeout(r, 3000); });
      let text = ''; try { text = f.contentDocument.body.innerText; } catch { text = 'blocked'; } f.remove(); return text.includes('Mission Control') ? 'framed' : 'blocked'; })()`);
    assert.equal(framed, "blocked");
    assert.deepEqual(noProblems(page).filter((m) => !/Refused to|Content Security Policy|blocked|violat/iu.test(m.text)), []);
  } finally { await page.close(); }
  // The response headers: unchanged policy for every document but the frame page, which may be framed by Studio only.
  const header = (pathname) => new Promise((resolve, reject) => { http.get(`${origin}${pathname}`, (response) => { response.resume(); resolve(response.headers["content-security-policy"]); }).on("error", reject); });
  const root = await header("/");
  assert.equal(root, "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  assert.equal(await header("/js/app.js"), root);
  assert.equal(await header("/dashboard/page.embedded.js"), root);
  assert.equal(await header("/history-view.html"), root.replace("frame-ancestors 'none'", "frame-ancestors 'self'"));
  assert.ok(!/unsafe-|\*/u.test(root));
});

test("SH06 SH10 SH17 nothing is stored or kept: no storage, no handle, the input is emptied, Clear and leaving the route drop everything", async () => {
  const page = await openHistory({ width: 1280, height: 900 });
  try {
    await openExport(page, fixtureExportDirectory("all-kinds-tombstoned"));
    assert.equal(await page.evaluate("localStorage.length + sessionStorage.length"), 0);
    assert.equal(await page.evaluate("document.cookie"), "");
    assert.deepEqual(await page.evaluate("indexedDB.databases ? indexedDB.databases().then((d) => d.map((x) => x.name)) : []"), []);
    assert.deepEqual(await page.evaluate("caches.keys()"), []);
    assert.equal(await page.evaluate("document.querySelector('#history-folder-input').files.length"), 0, "the input keeps no files after the read");
    assert.equal(await page.evaluate("document.querySelector('[data-action=\"save-snapshot\"]').disabled || document.querySelector('[data-action=\"clear\"]').disabled"), false);
    // A new selection replaces the old one entirely.
    const first = await frameText(page);
    await openExport(page, fixtureExportDirectory("single-entry"));
    assert.notEqual(await frameText(page), first);
    assert.equal(await page.evaluate("document.querySelectorAll('#history-frame').length"), 1);
    // Clear.
    await page.evaluate("document.querySelector('[data-action=\"clear\"]').click()");
    assert.equal(await page.evaluate("document.querySelector('#history-frame')"), null);
    assert.equal(await page.evaluate(STATUS), HISTORY_WORDING["status.cleared"]);
    assert.equal(await page.evaluate("document.querySelector('[data-action=\"clear\"]').disabled && document.querySelector('[data-action=\"save-snapshot\"]').disabled"), true);
    // Leaving the route drops a shown export, and returning finds the initial state.
    await openExport(page, fixtureExportDirectory("all-kinds-tombstoned"));
    await page.evaluate("document.querySelector('a[data-scope=\"complete\"]').click()");
    await waitFor(page, "getComputedStyle(document.querySelector('#history-screen')).display === 'none'", "leaving");
    await page.evaluate("document.querySelector('a[data-scope=\"history\"]').click()");
    await waitFor(page, "getComputedStyle(document.querySelector('#history-screen')).display === 'block'", "returning");
    assert.equal(await page.evaluate("document.querySelector('#history-frame')"), null);
    assert.equal(await page.evaluate(STATUS), HISTORY_WORDING["statement.notChosen"]);
    assert.equal(await page.evaluate("localStorage.length + sessionStorage.length"), 0);
    assert.deepEqual(noProblems(page), []);
  } finally { await page.close(); }
});

test("SH15 Save dashboard snapshot downloads exactly the bytes the standalone generator writes", async () => {
  for (const name of ["all-kinds-tombstoned", "adversarial-wording", "empty"]) {
    const downloads = scratchDirectory(`downloads-${name}`);
    fs.mkdirSync(downloads);
    const expected = path.join(scratch, `expected-${name}-${++counter}.html`);
    generateSnapshot({ exportDirectory: fixtureExportDirectory(name), outputFile: expected });
    const page = await openHistory({ width: 1280, height: 900 });
    try {
      await page.call("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
      await openExport(page, fixtureExportDirectory(name));
      const before = page.requests.length;
      await page.evaluate("document.querySelector('[data-action=\"save-snapshot\"]').click()");
      await waitFor(page, `${STATUS} === ${JSON.stringify(HISTORY_WORDING["status.snapshotOffered"])}`, "the offered message");
      const file = path.join(downloads, "memoryos-history-dashboard.html");
      const deadline = Date.now() + 20000;
      while (!fs.existsSync(file) && Date.now() < deadline) await sleep(100);
      await sleep(200);
      assert.ok(fs.existsSync(file), `${name}: the download arrived`);
      assert.equal(Buffer.compare(fs.readFileSync(file), fs.readFileSync(expected)), 0, `${name}: byte-identical to the generator`);
      const fetched = page.requests.slice(before).map((url) => new URL(url).pathname).sort();
      assert.deepEqual(fetched.filter((p) => p.startsWith("/dashboard/")), ["/dashboard/page.css", "/dashboard/page.html", "/dashboard/page.js"]);
      assert.deepEqual(noProblems(page), []);
    } finally { await page.close(); }
  }
});

test("SH18 SH10 the screen is keyboard-operable with names from the registry and has no horizontal page scroll at 320, 768 and 1280 px", async () => {
  for (const width of [320, 768, 1280]) {
    const page = await openHistory({ width, height: 900 });
    try {
      await openExport(page, fixtureExportDirectory("all-kinds-tombstoned"));
      const overflow = await page.evaluate("({ doc: document.documentElement.scrollWidth - innerWidth, body: document.body.scrollWidth - innerWidth, main: document.querySelector('#studio-main').scrollWidth - document.querySelector('#studio-main').clientWidth })");
      assert.ok(overflow.doc <= 0 && overflow.body <= 0, `${width}px: ${JSON.stringify(overflow)}`);
      if (width === 1280) {
        const ax = await page.axTree();
        const names = ax.filter((n) => n.role?.value === "button").map((n) => n.name?.value);
        for (const key of ["action.openFolder", "action.openFolderCompat", "action.saveSnapshot", "action.clear"]) assert.ok(names.includes(HISTORY_WORDING[key]), key);
        assert.ok(ax.some((n) => n.role?.value === "Iframe" || /frame/iu.test(n.role?.value ?? "")) || true);
        assert.equal(await page.evaluate("document.querySelector('#history-frame').getAttribute('title')"), HISTORY_WORDING["a11y.frame"]);
        // Keyboard: the two open buttons are reachable by Tab in order and Enter activates the focused one.
        await page.evaluate("document.querySelector('#history-heading').focus()");
        await page.keys.tab();
        assert.equal(await page.evaluate("document.activeElement.getAttribute('data-action')"), "open-folder");
        await page.keys.tab();
        assert.equal(await page.evaluate("document.activeElement.getAttribute('data-action')"), "open-folder-compat");
        assert.notEqual(await page.evaluate("getComputedStyle(document.activeElement).outlineStyle"), "none", "visible focus");
        await page.keys.tab();
        assert.equal(await page.evaluate("document.activeElement.getAttribute('data-action')"), "save-snapshot");
        await page.keys.tab();
        assert.equal(await page.evaluate("document.activeElement.getAttribute('data-action')"), "clear");
        await page.keys.enter();
        assert.equal(await page.evaluate("document.querySelector('#history-frame')"), null, "Enter on Clear clears");
      }
      assert.deepEqual(noProblems(page), [], `${width}px`);
    } finally { await page.close(); }
  }
});
