// MO-1309 Phase 2C (Contract Freeze 1 sections 9, 10, 11): the data-class scanner rules, the H40/A6 structural re-review checks
// and the trust-wording constraints. Requirements: DB04, DB05, DB06, DB19, DB28 (and the 4C-S6 rule set).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDashboardViewModel } from "../web/js/memoryos-dashboard-viewmodel.js";
import { DATA_CLASSES, DATA_CLASS_RULES, scanSnapshot } from "../web/js/memoryos-dashboard-dataclass.js";
import { WORDING } from "../web/js/memoryos-dashboard-wording.js";
import { FIXTURE_NAMES, readExportFiles } from "./support-dashboard-fixtures.mjs";
import { miniSnapshot, reseal } from "./support-dashboard-mini-snapshot.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const studio = path.join(here, "..");
const repo = path.join(studio, "..", "..");
const model = (name) => buildDashboardViewModel({ files: readExportFiles(name) });
const rulesOf = (html, context) => [...new Set(scanSnapshot(html, context).violations.map((v) => v.rule))].sort();

test("the data-class model is closed and every rule names a defined class and a requirement", () => {
  assert.ok(Object.isFrozen(DATA_CLASSES) && Object.isFrozen(DATA_CLASS_RULES));
  const ids = DATA_CLASS_RULES.map((rule) => rule.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const rule of DATA_CLASS_RULES) {
    assert.ok(Object.hasOwn(DATA_CLASSES, rule.class), rule.id);
    assert.match(rule.requirement, /^DB\d\d/u);
    assert.ok(rule.rule.length > 20);
  }
  assert.deepEqual(Object.keys(DATA_CLASSES).filter((name) => name.startsWith("FORBIDDEN_")).sort(),
    ["FORBIDDEN_CLOCK", "FORBIDDEN_DIAGNOSTIC", "FORBIDDEN_ENVIRONMENT", "FORBIDDEN_HOST_USER", "FORBIDDEN_MEMBER_CONTENT", "FORBIDDEN_PATH", "FORBIDDEN_REFERENCE"]);
});

test("a clean snapshot of every fixture, including the adversarial one, passes every rule", () => {
  const context = { paths: ["/home/operator/exports/run-7", "C:\\Users\\operator\\out.html"], hostUserNames: ["build-host-17", "operator"], environmentValues: ["secret-env-value"],
    memberContents: [new TextEncoder().encode('{"kind":"ExampleMember","payload":"retained member contents must never appear in a snapshot"}')] };
  for (const name of FIXTURE_NAMES) assert.deepEqual(scanSnapshot(miniSnapshot(model(name)), context).violations, [], name);
  assert.match(model("adversarial-wording").source.workspaceIdentifier, /<script>/u);
});

const base = () => miniSnapshot(model("all-kinds-tombstoned"));
const html0 = base();
const insertAfterApp = (html, text) => html.replace('<div id="app">', `<div id="app">${text}`);
// One negative control per rule: a real violation, resealed so that only the rule under test is the point of the case.
const CONTROLS = {
  S1: { html: () => html0.replace("</body>", "<script>void 1</script></body>") },
  S1b: { rule: "S1", html: () => html0.replace("<title>", '<meta http-equiv="refresh" content="0"><title>') },
  S1c: { rule: "S1", html: () => html0.replace("<title>", '<meta name="referrer" content="always"><title>') },
  S2: { html: () => reseal(html0.replace("default-src &#39;none&#39;", "default-src &#39;none&#39;; img-src *")) },
  S3: { html: () => html0.replace(/id="snapshot-digest">sha256:[0-9a-f]{4}/u, 'id="snapshot-digest">sha256:0000') },
  D1: { html: () => reseal(html0.replace('"kind":"MemoryOSDashboardViewModel"', '"kind":"Other"')) },
  D2: { html: () => reseal(insertAfterApp(html0, "<p>A sentence that is not registry text</p>")) },
  R1: { html: () => reseal(insertAfterApp(html0, '<img alt="" src="x.png">')) },
  F1: { html: () => reseal(insertAfterApp(html0, "<p>See /home/operator/export for details</p>")), also: ["D2"] },
  F2: { html: () => reseal(insertAfterApp(html0, "<p>2026-10-10T10:22:31Z</p>")), also: ["D2"] },
  F3: { html: () => reseal(insertAfterApp(html0, "<p>TypeError: boom</p>")), also: ["D2"] },
  F4: { html: () => html0, context: { hostUserNames: ["MemoryOS"] } },
  F5: { html: () => html0, context: { environmentValues: ["Generator"] } },
  F6: { html: () => html0, context: { paths: ["history export"] } },
  M1: { html: () => html0, context: { memberContents: [WORDING["statement.integrityOnly"]] } },
};

test("every rule has a negative control that fires it (the scanner has teeth), and the clean case does not", () => {
  assert.deepEqual([...new Set(Object.entries(CONTROLS).map(([id, c]) => c.rule ?? id))].sort(), DATA_CLASS_RULES.map((rule) => rule.id).sort());
  assert.deepEqual(scanSnapshot(html0, {}).violations, []);
  for (const [id, control] of Object.entries(CONTROLS)) {
    const rule = control.rule ?? id;
    const found = rulesOf(control.html(), control.context ?? {});
    assert.ok(found.includes(rule), `${rule} fires: ${found}`);
    for (const other of found) assert.ok(other === rule || (control.also ?? []).includes(other), `${rule} control also fired ${other}`);
  }
});

test("violations name a rule and a location only, never the offending content", () => {
  const html = reseal(insertAfterApp(html0, "<p>/home/operator-secret-name/export</p>"));
  const result = scanSnapshot(html, { hostUserNames: ["operator-secret-name"] });
  assert.ok(result.violations.length >= 2);
  assert.ok(!JSON.stringify(result).includes("operator-secret-name"));
  for (const violation of result.violations) assert.deepEqual(Object.keys(violation).sort(), ["location", "rule"]);
});

test("DB19 scan targets: paths, timestamps, hosts, users and members are caught in the data block position and in the frame", () => {
  const cases = [
    ["C:\\Users\\a\\x", "F1"], ["\\\\server\\share\\x", "F1"], ["~/exports", "F1"], ["file:///tmp/x", "F1"],
    ["Wed, 07 Oct 2026 10:00:00", "F2"], ["10:22:31", "F2"], ["1760000000000", "F2"], ["UTC+2", "F2"],
    ["\n    at run (/tmp/a.mjs:1:2)", "F3"], ["ENOENT", "F3"], ["MO1308_EXPORT_CORRUPT", "F3"],
  ];
  for (const [text, rule] of cases) assert.ok(rulesOf(reseal(insertAfterApp(html0, `<p>${text}</p>`))).includes(rule), `${rule}: ${text}`);
  // Registry text, the fixed footer and values inside the data block are not flagged for these patterns.
  const withTimeLikeData = miniSnapshot({ ...model("single-entry"), source: { ...model("single-entry").source, workspaceIdentifier: "2026-10-10T10:22:31Z /home/x C:\\x TypeError" } });
  assert.deepEqual(scanSnapshot(withTimeLikeData, {}).violations, [], "untrusted data may say anything inside the data block; the shape, not the content, is checked");
});

// ---- H40 / A6 structural re-review (Freeze section 10), over every dashboard file present in the tree ----
const dashboardFiles = () => {
  const out = [];
  const add = (directory, pattern) => { const full = path.join(studio, directory); if (fs.existsSync(full)) for (const name of fs.readdirSync(full).sort()) if (pattern.test(name)) out.push(path.join(full, name)); };
  add("web/js", /^memoryos-dashboard-.*\.js$/u);
  add("scripts", /^memoryos-dashboard-generator\.mjs$/u);
  add("web/dashboard", /^page\.(js|html|css)$/u);
  return out;
};
const codeOnly = (file) => fs.readFileSync(file, "utf8").split("\n").filter((line) => !/^\s*(\/\/|\/\*)/u.test(line)).join("\n").replace(/\/\*[\s\S]*?\*\//gu, "");

test("DB28 H40: no dashboard file creates, opens or mutates a ledger store; the only MO-1308 ledger functions imported are verification and query", () => {
  const files = dashboardFiles();
  for (const required of ["memoryos-dashboard-contract.js", "memoryos-dashboard-viewmodel.js", "memoryos-dashboard-wording.js", "memoryos-dashboard-dataclass.js"]) {
    assert.ok(files.some((file) => file.endsWith(required)), required);
  }
  const mutating = /\b(createHistoryLedger|appendHistoryEntry|tombstoneHistoryEntry|buildHistoryExport|verifyHistoryLedger|historyLedgerEntries)\b/u;
  const importedFromLedger = /import\s*\{([^}]*)\}\s*from\s*"[^"]*memoryos-history-ledger\.js"/gu;
  for (const file of files) {
    const text = codeOnly(file);
    assert.ok(!mutating.test(text), `${path.basename(file)} uses no ledger mutation or store function`);
    assert.ok(!/history-store|history-admission|history-commands|memoryos-sdk|memoryos-cli|"\.pending"|"entries"\s*,\s*"w"/u.test(text), path.basename(file));
    for (const match of text.matchAll(importedFromLedger)) {
      for (const name of match[1].split(",").map((part) => part.trim()).filter(Boolean)) assert.ok(["queryHistoryLedger", "verifyHistoryExport"].includes(name), `${path.basename(file)} imports ${name}`);
    }
  }
  // Negative control for the scan itself.
  assert.ok(mutating.test('import { appendHistoryEntry } from "./memoryos-history-ledger.js"'));
});

test("DB28 A6: where a dashboard file writes, it creates exclusively and never replaces; no write API that replaces, renames or truncates", () => {
  const replacing = /\b(writeFile|writeFileSync|appendFile|appendFileSync|rename|renameSync|copyFile|copyFileSync|cp|cpSync|truncate|truncateSync|symlink|symlinkSync|mkdir|mkdirSync|rm|rmSync|rmdir|createWriteStream|utimes|chmod|chown)\s*\(/u;
  for (const file of dashboardFiles()) {
    const text = codeOnly(file);
    assert.ok(!replacing.test(text), `${path.basename(file)} has no replacing or tree-changing filesystem call`);
    for (const flag of text.matchAll(/openSync\([^)]*?,\s*"([a-z+]+)"/gu)) assert.ok(["r", "wx"].includes(flag[1]), `${path.basename(file)} opens with ${flag[1]}`);
  }
  assert.ok(replacing.test("fs.writeFileSync(out, data)") && replacing.test("fs.renameSync(a, b)"));
});

test("DB28 the registry makes no multi-user, hosted-service, shared-storage, tenancy or store claim; the store claim stays local single-user v1", () => {
  for (const [key, text] of Object.entries(WORDING)) assert.doesNotMatch(text, /multi-user|shared storage|shared store|tenan|cloud service|hosted service|account|server|login|sign in/iu, key);
  assert.deepEqual(Object.entries(WORDING).filter(([, text]) => /\bstore\b/iu.test(text)).map(([key]) => key), ["statement.asOfGeneration"], "the only mention of a store negates it");
  // The disclosures the trust review relies on are present, each as a registry key.
  for (const key of ["statement.integrityOnly", "statement.notAuthenticated", "statement.anchor", "statement.asOfGeneration", "statement.metadataDisclosure", "statement.noDecision", "statement.readOnly", "statement.membersNotShown", "statement.anomalyCounts"]) {
    assert.ok(Object.hasOwn(WORDING, key), key);
  }
  assert.match(WORDING["statement.metadataDisclosure"], /operator's responsibility/u);
  assert.match(WORDING["statement.anchor"], /head digest/u);
});

test("the trust review document exists, states the unchanged store claim and lists every threat with its requirement", () => {
  const doc = fs.readFileSync(path.join(repo, "docs", "mo1309-phase2c-trust-review.md"), "utf8");
  for (const needle of ["H40", "A6", "local single-user v1", "native Windows 11 x64", "Threat model", "Data classes", "DB28", "DB19", "DB04", "Residual", "CONTRACT_DEFECT"]) assert.ok(doc.includes(needle), needle);
  const threats = [...doc.matchAll(/^\| (T\d{2}) \|/gmu)].map((m) => m[1]);
  assert.ok(threats.length >= 14 && new Set(threats).size === threats.length);
  for (const rule of DATA_CLASS_RULES) assert.ok(doc.includes(`| ${rule.id} |`), `rule ${rule.id} documented`);
  assert.ok(!/\bnot yet\b|TODO|TBD/u.test(doc));
});
