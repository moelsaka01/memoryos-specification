// MO-1309 Phase 1 (Contract Freeze 1 section 7): the wording registry and its rendered-string scan.
// Requirements: DB14, DB15 (registry content), DB16 (anomaly wording), DB17, DB13 (closed action set).
import test from "node:test";
import assert from "node:assert/strict";
import * as contract from "../web/js/memoryos-dashboard-contract.js";
import {
  ENUM_GROUPS, ENUM_LABELS, NEGATION_ALLOW_LIST, WORDING, WORDING_KEYS, forbiddenTerms, renderedStrings, scanChromeStrings, scanControls, wording,
} from "../web/js/memoryos-dashboard-wording.js";
import { buildDashboardViewModel } from "../web/js/memoryos-dashboard-viewmodel.js";
import { FIXTURE_NAMES, readExportFiles } from "./support-dashboard-fixtures.mjs";

const build = (name) => buildDashboardViewModel({ files: readExportFiles(name) });
const clone = (value) => JSON.parse(JSON.stringify(value));

test("DB14 the registry is closed, frozen and covers every imported enum value exactly", () => {
  assert.ok(Object.isFrozen(WORDING) && Object.isFrozen(WORDING_KEYS) && Object.isFrozen(ENUM_LABELS));
  assert.deepEqual(WORDING_KEYS, Object.keys(WORDING).sort());
  for (const [group, values] of Object.entries(ENUM_GROUPS)) {
    assert.deepEqual(Object.keys(ENUM_LABELS[group]).sort(), [...values].sort(), `${group} labels name exactly the imported values`);
    for (const value of values) assert.equal(wording(`${group}.${value}`), ENUM_LABELS[group][value]);
  }
  assert.deepEqual(Object.keys(ENUM_LABELS).sort(), Object.keys(ENUM_GROUPS).sort());
  for (const code of Object.keys(contract.DASHBOARD_ERRORS)) assert.equal(wording(`error.${code}`), contract.DASHBOARD_ERRORS[code].message);
  for (const text of Object.values(WORDING)) assert.ok(typeof text === "string" && text.length > 0 && text.isWellFormed() && text === text.trim());
  assert.throws(() => wording("no.such.key"), TypeError);
  assert.throws(() => wording("__proto__"), TypeError);
  assert.throws(() => wording("toString"), TypeError);
  assert.throws(() => { WORDING["document.title"] = "x"; });
  assert.equal(new Set(Object.values(ENUM_LABELS.recordKind)).size, Object.keys(ENUM_LABELS.recordKind).length, "labels of one group are distinct");
});

test("DB14 every registry string passes the forbidden-affordance scan, except closed negation entries limited to listed terms", () => {
  const items = Object.entries(WORDING).map(([key, text]) => ({ key, text }));
  assert.deepEqual(scanChromeStrings(items), []);
  // The allow-list is closed and not stale: each key exists, and every allowed term is really present in that string.
  for (const [key, terms] of Object.entries(NEGATION_ALLOW_LIST)) {
    assert.ok(Object.hasOwn(WORDING, key), key);
    assert.deepEqual([...forbiddenTerms(WORDING[key])].sort(), [...terms].sort(), `${key}: allowance equals what the string contains`);
  }
  // Only strings that negate or disclaim a claim may use a forbidden word.
  for (const key of Object.keys(NEGATION_ALLOW_LIST)) {
    assert.match(WORDING[key], /\b(not|no|never|cannot|does not|takes no)\b/iu, `${key} negates the claim it names`);
  }
  assert.deepEqual(Object.keys(NEGATION_ALLOW_LIST).sort(), ["decisionConsistency.CONSISTENT", "decisionConsistency.CONTRARY_TO_READINESS", "statement.noDecision", "statement.notAuthenticated"]);
});

test("the scanner has teeth: each forbidden class is detected (negative controls)", () => {
  const probes = {
    approve: ["Approve", "approved by", "Approval granted"], reject: ["Reject", "rejected"], ready: ["Ready", "all ready"], green: ["Green", "go green"],
    certify: ["Certified", "certification"], pass: ["Pass", "Passed", "passes"], fail: ["Fail", "failed", "failure"], safe: ["Safe", "safety"],
    trusted: ["Trusted", "trust"], authentic: ["Authentic", "authenticated"], signed: ["signed"], encrypted: ["encrypted"],
    verified: ["Verified", "verified ledger"], OK: ["OK"], success: ["Success", "successful"], mark: ["✓", "✔ done", "✗", "✅", "❌", "🟢", "×"],
  };
  for (const [term, texts] of Object.entries(probes)) for (const text of texts) assert.ok(forbiddenTerms(text).includes(term), `${term} in ${JSON.stringify(text)}`);
  // Qualified, neutral and substring-only uses are not flagged.
  for (const text of ["integrity verification", "integrity-verified", "Readiness result", "Package", "Tokenized", "Okay-ish is not a word here".replace("Okay-ish", "Ordinal"), "Unsigned"]) {
    assert.deepEqual(forbiddenTerms(text), [], JSON.stringify(text));
  }
  const registryKey = "heading.page";
  assert.deepEqual(scanChromeStrings([{ key: registryKey, text: WORDING[registryKey] }]), []);
  assert.deepEqual(scanChromeStrings([{ key: registryKey, text: "All checks passed ✓" }]).map((v) => v.rule).sort(), ["forbidden-term", "forbidden-term", "text-differs-from-registry"].sort());
  assert.equal(scanChromeStrings([{ key: "not.a.key", text: "Hello" }])[0].rule, "not-a-registry-key");
  // A negation entry may not smuggle in an unlisted word.
  assert.deepEqual(scanChromeStrings([{ key: "statement.notAuthenticated", text: `${WORDING["statement.notAuthenticated"]} Ready.` }]).map((v) => v.term ?? v.rule).sort(), ["ready", "text-differs-from-registry"]);
  // Controls: only the closed read-only action set, and no link or form.
  assert.deepEqual(scanControls(contract.DASHBOARD_ACTIONS.map((action) => ({ element: "button", action }))), []);
  for (const action of ["approve", "reject", "acknowledge", "append", "tombstone", "import", "purge", "submit", "delete", "write", "export"]) {
    assert.equal(scanControls([{ element: "button", action }])[0].rule, "action-not-read-only", action);
  }
  assert.equal(scanControls([{ element: "a", action: "copy" }])[0].rule, "navigation-or-form");
  assert.equal(scanControls([{ element: "form", action: "filter" }])[0].rule, "navigation-or-form");
  assert.equal(scanControls([{ element: "input", action: undefined }])[0].rule, "action-not-read-only");
});

test("DB15/DB16 mandatory registry content (section 7.4) is present", () => {
  const all = (key) => wording(key);
  assert.match(all("statement.integrityOnly"), /integrity checking only/u);
  assert.match(all("statement.notAuthenticated"), /not authenticated, not signed and not encrypted/u);
  assert.match(all("statement.anchor"), /most recent entries/u);
  assert.match(all("statement.anchor"), /return to an earlier state/u);
  assert.match(all("statement.anchor"), /head digest you recorded elsewhere/u);
  assert.match(all("statement.asOfGeneration"), /one export as it was when this file was generated/u);
  assert.match(all("statement.asOfGeneration"), /not a view of a current store/u);
  assert.match(all("statement.anomalyCounts"), /Purge pending, unreferenced records and pending artifacts .* counts only/u);
  for (const key of ["label.headDigest", "label.purgePending", "label.unreferencedRecords", "label.pendingArtifacts", "action.copy", "action.copyDigest"]) assert.ok(WORDING[key], key);
  assert.match(all("statement.metadataDisclosure"), /discloses entry metadata/u);
  assert.match(all("statement.membersNotShown"), /Member contents are never shown/u);
  assert.match(all("statement.readOnly"), /cannot change, add or remove/u);
  for (const key of ["decisionConsistency.CONSISTENT", "decisionConsistency.CONTRARY_TO_READINESS"]) {
    assert.match(all(key), /does not decide/u, key);
    assert.match(all(key), /human decision claim is not a MemoryOS approval/u, key);
    assert.match(all(key), /^Observation:/u, key);
  }
});

test("DB14/DB17 the rendered-string scan is clean for every fixture, and every chrome string is a registry key", () => {
  for (const name of FIXTURE_NAMES) {
    const { chrome, untrusted } = renderedStrings(build(name));
    assert.deepEqual(scanChromeStrings(chrome), [], name);
    assert.ok(chrome.length > 25 && untrusted.length > 5, name);
    for (const item of chrome) assert.equal(item.text, WORDING[item.key]);
    assert.ok(untrusted.every((item) => typeof item.cell === "string" && typeof item.text === "string"));
  }
});

test("DB17 CONTRARY_TO_READINESS is a neutral observation: same structure and weight as CONSISTENT, no success or failure wording", () => {
  const consistent = ENUM_LABELS.decisionConsistency.CONSISTENT;
  const contrary = ENUM_LABELS.decisionConsistency.CONTRARY_TO_READINESS;
  const shape = (text) => text.replace(/matching|differing from/u, "<relation>");
  assert.equal(shape(consistent), shape(contrary), "the two observations differ only in the relation word");
  assert.deepEqual(forbiddenTerms(consistent.replace(/MemoryOS approval/u, "MemoryOS record")), []);
  assert.deepEqual(forbiddenTerms(contrary.replace(/MemoryOS approval/u, "MemoryOS record")), []);
  const model = build("claims-only");
  const keys = renderedStrings(model).chrome.map((item) => item.key);
  assert.ok(keys.includes("decisionConsistency.CONSISTENT") && keys.includes("decisionConsistency.CONTRARY_TO_READINESS"));
  // The summary lists both values with the same row form, in the imported order.
  assert.deepEqual(model.summary.byDecisionConsistency.map((row) => Object.keys(row)), [["value", "count"], ["value", "count"]]);
});

test("adversarial words in untrusted data are inert text: they never change a key, a label or a control", () => {
  const adversarial = build("adversarial-wording");
  const { chrome, untrusted } = renderedStrings(adversarial);
  assert.deepEqual(scanChromeStrings(chrome), []);
  const hostile = untrusted.filter((item) => forbiddenTerms(item.text).length > 0);
  assert.ok(hostile.length > 0, "the fixture really carries forbidden words in untrusted cells");
  assert.ok(hostile.every((item) => item.cell === "workspaceIdentifier" || item.cell === "subjectValue"));
  assert.ok(forbiddenTerms(adversarial.source.workspaceIdentifier).length >= 8);
  assert.match(adversarial.source.workspaceIdentifier, /<script>/u);

  // Replace every untrusted string by a benign one: the chrome strings (the whole non-data page) must be identical.
  const benign = clone(adversarial);
  benign.source.workspaceIdentifier = "workspace-benign";
  for (const entry of benign.entries) for (const subject of entry.subjects) subject.value = subject.type === "WORKSPACE" ? "workspace-benign" : subject.value;
  assert.equal(contract.validateDashboardViewModel(benign).ok, true);
  assert.deepEqual(renderedStrings(benign).chrome, chrome, "chrome is a function of the structure, never of untrusted text");

  // Words that name states or actions, injected into every free-text position of a valid model, change nothing.
  const injected = clone(adversarial);
  injected.source.workspaceIdentifier = "CONTRARY_TO_READINESS CONSISTENT RETAINED approve";
  for (const entry of injected.entries) for (const subject of entry.subjects) subject.value = `${subject.value} PURGED reject green`;
  assert.equal(contract.validateDashboardViewModel(injected).ok, true);
  assert.deepEqual(renderedStrings(injected).chrome, chrome);
});

test("the rendered-string model is deterministic and ordered by index", () => {
  for (const name of FIXTURE_NAMES) {
    const model = build(name);
    assert.deepEqual(renderedStrings(model), renderedStrings(clone(model)));
    const indexes = renderedStrings(model).untrusted.filter((item) => item.cell === "index").map((item) => Number(item.text));
    assert.deepEqual(indexes, model.entries.map((entry) => entry.index));
  }
});
