// MO-1309 Phase 1 (Contract Freeze 1): source scans, dependency direction, MO-1308 immutability, ARCHITECTURE text and
// human-authority separation. Requirements: DB11, DB26, DB31, DB14/DB17 (readiness and decision claims are never approval).
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as history from "../web/js/memoryos-history-contract.js";
import { buildDashboardViewModel, canonicalViewModelBytes } from "../web/js/memoryos-dashboard-viewmodel.js";
import { ENUM_LABELS, renderedStrings, forbiddenTerms } from "../web/js/memoryos-dashboard-wording.js";
import { FIXTURE_NAMES, readExportFiles } from "./support-dashboard-fixtures.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const webJs = path.join(here, "..", "web", "js");
const root = path.join(here, "..", "..", "..");
const MODULES = ["memoryos-dashboard-contract.js", "memoryos-dashboard-viewmodel.js", "memoryos-dashboard-wording.js"];
const source = (file) => fs.readFileSync(path.join(webJs, file), "utf8");
const code = (file) => source(file).split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
const importsOf = (file) => [...source(file).matchAll(/^\s*(?:import|export)\s[^;]*?from\s+"([^"]+)"/gmu)].map((match) => match[1]).sort();
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("DB26 dashboard modules import only the MO-1308 history contract and ledger, the canonical module and each other", () => {
  const allowed = {
    "memoryos-dashboard-contract.js": ["./memoryos-history-contract.js"],
    "memoryos-dashboard-viewmodel.js": ["./memoryos-dashboard-contract.js", "./memoryos-history-contract.js", "./memoryos-history-ledger.js", "./mip-canonical.js"],
    "memoryos-dashboard-wording.js": ["./memoryos-dashboard-contract.js"],
  };
  for (const file of MODULES) assert.deepEqual(importsOf(file), allowed[file], file);
  // No module of the dashboard may be reached from MO-1308 or from the SDK (dependency direction, section 4.4).
  for (const other of fs.readdirSync(webJs).filter((name) => name.endsWith(".js") && !name.startsWith("memoryos-dashboard-"))) {
    assert.ok(!/memoryos-dashboard-/u.test(source(other)), `${other} must not depend on the dashboard`);
  }
});

test("DB26 pure and browser-safe: no filesystem, network, process, clock, random, locale or storage API", () => {
  const banned = [/\bnode:/u, /\brequire\s*\(/u, /\bprocess\b/u, /\bBuffer\b/u, /\bDate\b/u, /\bperformance\b/u, /Math\.random/u, /\bcrypto\b/u,
    /\bIntl\b/u, /toLocale/u, /localeCompare/u, /\bfetch\b/u, /XMLHttpRequest/u, /WebSocket/u, /\bglobalThis\b/u, /\bwindow\b/u, /\bdocument\b/u,
    /\blocalStorage\b/u, /\bsessionStorage\b/u, /\bindexedDB\b/u, /\beval\s*\(/u, /new Function/u, /import\s*\(/u, /setTimeout|setInterval/u,
    /\bsdk\b/iu];  // imports are pinned exactly by the first test
  for (const file of MODULES) {
    const body = code(file).replace(/"[^"\n]*"/gu, '""').replace(/`[^`]*`/gu, "``");
    for (const pattern of banned) assert.ok(!pattern.test(body), `${file}: ${pattern}`);
  }
  // Negative control: the same patterns do catch real violations.
  const sample = 'import fs from "node:fs"; const t = Date.now(); const r = Math.random(); fetch(u); const p = process.env;';
  assert.ok(banned.filter((pattern) => pattern.test(sample)).length >= 4, "scanner detects node:, Date, Math.random, fetch, process");
});

test("DB11 enums and limits are not redefined or copied: no enum list, no limit number, no re-declared export", () => {
  const values = [...history.RECORD_KINDS, ...history.RETENTION_STATES, ...history.DECISION_CONSISTENCY, ...history.ENTRY_TYPES,
    ...history.WORKSPACE_ASSOCIATIONS, ...history.SUBJECT_TYPES, ...Object.values(history.ADMISSION_BY_KIND)];
  const alternation = values.map((value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|");
  const twoInAList = new RegExp(`\\[[^\\]]*"(?:${alternation})"[^\\]]*"(?:${alternation})"[^\\]]*\\]`, "u");
  const limitNumbers = Object.values(history.MEMORYOS_HISTORY_LIMITS).filter((value) => value >= 1000).map((value) => String(value));
  const numberPattern = new RegExp(`(?<![\\w.])(?:${limitNumbers.flatMap((n) => [n, n.replace(/\B(?=(\d{3})+(?!\d))/gu, "_")]).join("|")})(?![\\w.])`, "u");
  for (const file of MODULES) {
    const body = code(file);
    assert.ok(!twoInAList.test(body), `${file}: an array literal re-lists imported enum values`);
    assert.ok(!numberPattern.test(body), `${file}: a limit number is copied`);
    assert.ok(!/export const (?:RECORD_KINDS|RETENTION_STATES|DECISION_CONSISTENCY|ENTRY_TYPES|WORKSPACE_ASSOCIATIONS|SUBJECT_TYPES|ADMISSION_BY_KIND|MEMORYOS_HISTORY_LIMITS)\s*=/u.test(body), file);
  }
  // Negative control for the scanner itself.
  assert.ok(twoInAList.test('const KINDS = ["MIP_PACKAGE", "CICD_RUN"];'));
  assert.ok(numberPattern.test("const max = 100_000;") && numberPattern.test("const max = 16384;"));
  assert.ok(!numberPattern.test("const size = 100;"));
});

test("DB26 MO-1308 production bytes are unchanged by MO-1309 (pinned digests of the released history modules)", () => {
  const pins = {
    "memoryos-history-admission.js": "5c1882a2e3ac300e0f2ebd751114298058babb66a0b60a14a1b1f31fa8f164cc",
    "memoryos-history-contract.js": "8157eea5dc22763eca9c2ab080aa264eed561b3b3bf1edce78c2f89814b5c7db",
    "memoryos-history-ledger.js": "e039950ccec3f690e5aec4c208e73eba0cba58be6ad64ee49f6a3cb8bbfcb888",
    "mip-canonical.js": "0dd9dbaed8c3fdf92600dec4d998fe290dd9b2b83344198711ec88f0ec95fa68",
  };
  for (const [file, digest] of Object.entries(pins)) assert.equal(sha256(path.join(webJs, file)), digest, file);
});

test("DB31 ARCHITECTURE section 5 and section 13 carry exactly the two clauses of Freeze section 20", () => {
  const flat = (text) => text.replace(/\s+/gu, " ").trim();
  const architecture = fs.readFileSync(path.join(root, "ARCHITECTURE.md"), "utf8");
  const five = "MO-1309 adds a downstream presentation of MO-1308 history exports inside the same JavaScript boundary: a pure view model, a wording registry, a static dependency-free snapshot generator and a read-only page. It reads a verified export once, performs no network access, writes only an operator-named output file, owns no state, and never re-derives record semantics or appends, tombstones or approves anything.";
  const thirteen = "MO-1309 is a narrow downstream-presentation clause for a generated static page that presents a verified MO-1308 export. It is not an exception for hosting: it does not authorize a server, hosting, accounts, tenancy, billing, a network service, a database or any write path to a ledger. An operator who hosts the generated file does so outside MemoryOS.";
  const sections = architecture.split(/^## /mu);
  const section5 = sections.find((section) => section.startsWith("5. "));
  const section13 = sections.find((section) => section.startsWith("13. "));
  assert.equal(flat(section5).split(five).length, 2, "section 5 has the MO-1309 paragraph once");
  assert.equal(flat(section13).split(thirteen).length, 2, "section 13 has the MO-1309 paragraph once");
  assert.ok(section5.indexOf("MO-1308 adds the Investigation History authority") < section5.indexOf("MO-1309 adds a downstream"), "after the MO-1308 paragraph");
  assert.ok(section5.indexOf("MO-1309 adds a downstream") < section5.indexOf("### `cca-sdk`"), "under cca-studio");
  assert.ok(section13.indexOf("MO-1308 is the separately approved exception") < section13.indexOf("MO-1309 is a narrow"), "appended after the MO-1308 paragraph");
  assert.equal((architecture.match(/MO-1309/gu) ?? []).length, 2, "no other ARCHITECTURE change names MO-1309");
});

test("human-authority separation: readiness results and decision claims are described, never presented as approval", () => {
  for (const name of FIXTURE_NAMES) {
    const model = build(name);
    const bytes = new TextDecoder().decode(canonicalViewModelBytes(model));
    // Closed vocabulary of the model: no field or enum value names an approval, rejection, readiness verdict or decision.
    const keys = new Set();
    const walk = (node) => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === "object") for (const [key, value] of Object.entries(node)) { keys.add(key); walk(value); }
    };
    walk(model);
    for (const key of keys) assert.ok(!/approv|reject|verdict|decision(?!Consistency)|ready$|status|result|pass|fail|ok$/iu.test(key), `${name}: field ${key}`);
    // The only decision-related datum is the stored consistency enum; its two values are the imported MO-1308 values.
    for (const entry of model.entries) {
      if (entry.recordKind === "HUMAN_DECISION_CLAIM") assert.ok(history.DECISION_CONSISTENCY.includes(entry.decisionConsistency));
      else assert.equal(entry.decisionConsistency, null);
    }
    // A decision claim's payload (APPROVE / REJECT / DEFER, reason, actor) and a readiness verdict never enter the model.
    assert.ok(!/APPROVE|REJECT|DEFER|"ready"|"qualified"|NOT_READY|COULD_NOT_EVALUATE|READY_QUALIFIED/u.test(bytes.replace(/CONTRARY_TO_READINESS|READINESS_RESULT|READINESS_DIGEST|READINESS_CANDIDATE_DIGEST/gu, "")), name);
  }
});

test("human-authority separation: the dashboard never decides; consistency has no effect on any count, order, state or label weight", () => {
  const model = build("claims-only");
  const swapped = JSON.parse(JSON.stringify(model));
  for (const entry of swapped.entries) if (entry.decisionConsistency !== null) entry.decisionConsistency = entry.decisionConsistency === "CONSISTENT" ? "CONTRARY_TO_READINESS" : "CONSISTENT";
  swapped.summary.byDecisionConsistency.reverse().forEach((row, index) => { row.value = model.summary.byDecisionConsistency[index].value; });
  // Everything other than the observation itself is unchanged: ordering, counts, verification, entry identity.
  const strip = (m) => JSON.stringify({ ...m, summary: { ...m.summary, byDecisionConsistency: null }, entries: m.entries.map(({ decisionConsistency, ...rest }) => rest) });
  assert.equal(strip(swapped), strip(model));
  // The presentation of either observation has the same structure: one registry string, equal length class, same wording frame.
  const a = renderedStrings(model).chrome.filter((item) => item.key.startsWith("decisionConsistency."));
  assert.ok(a.length >= 2);
  assert.ok(a.every((item) => item.text.startsWith("Observation: the claim is recorded as ")));
  assert.ok(Math.abs(ENUM_LABELS.decisionConsistency.CONSISTENT.length - ENUM_LABELS.decisionConsistency.CONTRARY_TO_READINESS.length) < 8);
  // No registry label for a record kind or state is an approval, a readiness verdict or a ranking.
  for (const group of ["recordKind", "entryType", "retention", "workspaceAssociation", "admission"]) {
    for (const text of Object.values(ENUM_LABELS[group])) assert.deepEqual(forbiddenTerms(text), [], text);
  }
  assert.equal(ENUM_LABELS.recordKind.READINESS_RESULT, "Readiness result");
  assert.equal(ENUM_LABELS.recordKind.HUMAN_DECISION_CLAIM, "Human decision claim");
});

test("the wording module exposes no function that maps a state to a verdict, colour, class or boolean", () => {
  const body = code("memoryos-dashboard-wording.js") + code("memoryos-dashboard-contract.js") + code("memoryos-dashboard-viewmodel.js");
  assert.ok(!/\b(?:className|classList|style|color|colour|icon|isApproved|isReady|isGreen|isOk|severity|level)\b/iu.test(body.replace(/"[^"\n]*"/gu, '""')));
});

function build(name) {
  return buildDashboardViewModel({ files: readExportFiles(name) });
}
