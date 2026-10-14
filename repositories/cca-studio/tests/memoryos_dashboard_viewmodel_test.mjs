// MO-1309 Phase 1 (Contract Freeze 1): view model contract, builder, determinism and MO-1308 query parity.
// Requirements: DB03 (error mapping), DB04 (shape), DB10, DB11 (equality), DB17 (neutral shape), DB18/DB19 (determinism inputs).
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as history from "../web/js/memoryos-history-contract.js";
import { queryHistoryLedger } from "../web/js/memoryos-history-ledger.js";
import * as contract from "../web/js/memoryos-dashboard-contract.js";
import {
  buildDashboardViewModel, canonicalViewModelBytes, readCanonicalViewModel,
} from "../web/js/memoryos-dashboard-viewmodel.js";
import { FIXTURE_NAMES, readExportFiles, readPinnedViewModelBytes } from "./support-dashboard-fixtures.mjs";

const dec = new TextDecoder();
const clone = (value) => JSON.parse(JSON.stringify(value));
const build = (name) => buildDashboardViewModel({ files: readExportFiles(name) });
const code = (expected, historyCode) => (error) => error instanceof contract.DashboardError && error.code === expected
  && (historyCode === undefined || error.historyCode === historyCode);

test("DB11 enums and limits are the MO-1308 values, re-exported by identity, never copies", () => {
  for (const name of ["RECORD_KINDS", "ENTRY_TYPES", "WORKSPACE_ASSOCIATIONS", "RETENTION_STATES", "DECISION_CONSISTENCY", "SUBJECT_TYPES",
    "ADMISSION_BY_KIND", "MEMORYOS_HISTORY_LIMITS", "MEMBER_NAMES"]) {
    assert.ok(history[name] !== undefined, name);
    assert.equal(contract[name], history[name], `${name} is the imported object`);
  }
  assert.ok(contract.DASHBOARD_PAGE_SIZE <= history.MEMORYOS_HISTORY_LIMITS.queryLimitMaximum);
  assert.equal(contract.DASHBOARD_PAGE_SIZE, 100);
  assert.deepEqual([...contract.DASHBOARD_ACTIONS], ["filter", "sort", "page", "expand", "copy", "select-entry"]);
  assert.deepEqual(Object.keys(contract.DASHBOARD_ERRORS), ["DASH_USAGE", "DASH_EXPORT_UNREADABLE", "DASH_EXPORT_INVALID", "DASH_LIMIT_EXCEEDED", "DASH_OUTPUT_EXISTS", "DASH_IO_FAILURE"]);
});

test("fixtures build to the pinned canonical bytes and validate", () => {
  for (const name of FIXTURE_NAMES) {
    const viewModel = build(name);
    assert.deepEqual(contract.validateDashboardViewModel(viewModel), { ok: true }, name);
    assert.deepEqual(canonicalViewModelBytes(viewModel), readPinnedViewModelBytes(name), name);
    const read = readCanonicalViewModel(readPinnedViewModelBytes(name));
    assert.equal(read.ok, true, name);
    assert.deepEqual(read.viewModel, viewModel, name);
  }
});

test("DB17/DB18 the all-kinds fixture has the expected counts, both observations, one purge and a canonical newline", () => {
  const viewModel = build("all-kinds-tombstoned");
  assert.deepEqual(viewModel.verification, { retainedRecords: 8, purgedRecords: 1, tombstones: 1, purgePending: [], unreferencedRecords: [], pendingArtifacts: 0 });
  assert.equal(viewModel.source.entryCount, 10);
  assert.equal(viewModel.source.headDigest, viewModel.entries[9].entryDigest);
  assert.deepEqual(viewModel.summary.byRecordKind.map((row) => [row.recordKind, row.count]), [
    ["MIP_PACKAGE", 1], ["INVESTIGATION_CHECKPOINT", 1], ["POLICY_EVALUATION", 1], ["REGRESSION_REPORT", 1], ["CICD_RUN", 1], ["READINESS_RESULT", 2], ["HUMAN_DECISION_CLAIM", 2]]);
  assert.deepEqual(viewModel.summary.byDecisionConsistency.map((row) => [row.value, row.count]), [["CONSISTENT", 1], ["CONTRARY_TO_READINESS", 1]]);
  assert.deepEqual(viewModel.summary.byRetention.map((row) => [row.retention, row.count]), [["RETAINED", 8], ["PURGED", 1]]);
  const purged = viewModel.entries[0];
  assert.equal(purged.retention, "PURGED");
  assert.equal(purged.tombstoneIndex, 9);
  assert.ok(purged.members.length > 0, "the entry keeps the member list MO-1308 retains after a purge");
  assert.equal(viewModel.entries[9].entryType, "TOMBSTONE");
  assert.equal(canonicalViewModelBytes(viewModel).at(-1), 0x0a);
  const empty = build("empty");
  assert.equal(empty.source.entryCount, 0);
  assert.deepEqual(empty.entries, []);
  assert.ok(empty.summary.byRecordKind.every((row) => row.count === 0), "zero counts are listed");
});

test("DB10 the shape is closed: unknown, missing, mistyped or out-of-enum members are rejected everywhere", () => {
  const base = build("all-kinds-tombstoned");
  const claim = base.entries.find((entry) => entry.recordKind === "HUMAN_DECISION_CLAIM");
  const tombstone = base.entries.find((entry) => entry.entryType === "TOMBSTONE");
  const paths = [[], ["source"], ["verification"], ["summary"], ["summary", "byRecordKind", 0], ["entries", claim.index],
    ["entries", claim.index, "subjects", 0], ["entries", claim.index, "members", 0], ["entries", tombstone.index]];
  const at = (root, path) => path.reduce((value, key) => value[key], root);
  const reasons = new Set();
  for (const path of paths) {
    const target = at(base, path);
    const keys = Object.keys(target);
    const mutate = (change) => { const copy = clone(base); change(at(copy, path)); const result = contract.validateDashboardViewModel(copy); assert.equal(result.ok, false, JSON.stringify(path)); reasons.add(result.reason); };
    mutate((value) => { value.unexpectedMember = 1; });
    for (const key of keys) {
      mutate((value) => { delete value[key]; });
      mutate((value) => { value[key] = typeof value[key] === "number" ? "1" : typeof value[key] === "string" || value[key] === null ? 7 : null; });
    }
  }
  for (const [path, value] of [
    [["kind"], "Other"], [["version"], "2.0.0"], [["entries", 0, "recordKind"], "NEW_KIND"], [["entries", 0, "retention"], "ARCHIVED"],
    [["entries", 0, "entryType"], "NOTE"], [["entries", 0, "admission"], "SDK_REGRESSION_REPORT_INSPECTED"],
    [["entries", 0, "workspaceAssociation"], "OTHER"], [["entries", claim.index, "decisionConsistency"], "APPROVED"],
    [["entries", claim.index, "subjects", 0, "type"], "AUTHOR"], [["entries", 0, "members", 0, "name"], "notes.txt"],
    [["entries", 0, "entryDigest"], "sha256:xyz"], [["source", "headDigest"], "abc"], [["source", "workspaceIdentifier"], ""],
    [["entries", 1, "index"], 5], [["source", "entryCount"], 99], [["source", "entryCount"], 100001],
    [["summary", "byRecordKind", 0, "recordKind"], "CICD_RUN"], [["summary", "byRetention", 0, "count"], 99],
    [["verification", "retainedRecords"], 0], [["verification", "tombstones"], 2], [["verification", "purgePending"], [3, 1]],
    [["entries", 0, "tombstoneIndex"], 5], [["entries", 0, "tombstoneIndex"], null], [["entries", 0, "decisionConsistency"], "CONSISTENT"],
    [["entries", 0, "subjects"], new Array(17).fill({ type: "WORKSPACE", value: "w" })],
  ]) {
    const copy = clone(base);
    const parent = at(copy, path.slice(0, -1));
    parent[path.at(-1)] = value;
    assert.equal(contract.validateDashboardViewModel(copy).ok, false, JSON.stringify(path));
  }
  for (const value of [null, undefined, 3, "x", [], [base], Object.create({ kind: base.kind })]) assert.equal(contract.validateDashboardViewModel(value).ok, false);
  const reordered = clone(base);
  reordered.entries.reverse();
  assert.equal(contract.validateDashboardViewModel(reordered).ok, false, "entries are index-ascending and contiguous from 0");
  const shortList = clone(base);
  shortList.entries.pop();
  assert.equal(contract.validateDashboardViewModel(shortList).ok, false, "entryCount equals the number of entries");
  const unsortedSummary = clone(base);
  unsortedSummary.summary.byRecordKind.reverse();
  assert.equal(contract.validateDashboardViewModel(unsortedSummary).ok, false, "summary arrays follow the imported enum order");
  assert.ok([...reasons].every((reason) => /^[\w$.[\]]+$/u.test(reason)), "a reason is a location, never input content");
  assert.throws(() => canonicalViewModelBytes({ ...base, extra: 1 }), code("DASH_USAGE"));
  assert.equal(readCanonicalViewModel(new TextEncoder().encode(`${JSON.stringify(base, null, 1)}\n`)).ok, false, "non-canonical bytes are refused");
  assert.equal(readCanonicalViewModel(canonicalViewModelBytes(base).slice(0, -1)).ok, false, "the trailing newline is part of the form");
  assert.equal(readCanonicalViewModel(new Uint8Array([0xff, 0xfe])).ok, false);
});

test("DB04 the view model holds names, lengths and digests of members, never member contents", () => {
  for (const name of FIXTURE_NAMES) {
    const viewModel = build(name);
    for (const entry of viewModel.entries) for (const member of entry.members) assert.deepEqual(Object.keys(member).sort(), ["byteLength", "name", "sha256"]);
    const text = dec.decode(canonicalViewModelBytes(viewModel));
    // Decision payloads, reasons and tombstone authority text exist in the export bytes and must not reach the view model.
    for (const secret of ["External fixture decision only", "\"decision\"", "APPROVE", "approved ready green", "PRIV-2026-0042", "PRIVACY_REQUEST", "onerror"]) {
      assert.ok(!text.includes(secret), `${name}: ${secret}`);
    }
  }
});

test("MO-1308 parity: every view-model row equals the MO-1308 query row for the same ledger", () => {
  for (const name of FIXTURE_NAMES) {
    const files = readExportFiles(name);
    const byPath = new Map(files.map((file) => [file.path, file.bytes]));
    const viewModel = build(name);
    const entryBytes = viewModel.entries.map((entry) => byPath.get(`entries/${String(entry.index).padStart(20, "0")}.json`));
    const result = queryHistoryLedger({
      descriptorBytes: byPath.get("memoryos-history-ledger.json"), entries: entryBytes,
      query: { kind: "MemoryOSHistoryQuery", version: "1.0.0", recordKinds: [], subject: null, retention: "ANY", fromIndex: 0, limit: 1000 },
    });
    assert.equal(result.headDigest, viewModel.source.headDigest);
    assert.equal(result.ledgerIdentifier, viewModel.source.ledgerIdentifier);
    assert.equal(result.workspaceIdentifier, viewModel.source.workspaceIdentifier);
    assert.deepEqual(viewModel.entries.map(({ members, ...row }) => row), clone(result.entries), name);
  }
});

test("DB03 a defective export builds nothing and carries the MO-1308 code; wrong arguments are DASH_USAGE", () => {
  const files = readExportFiles("all-kinds-tombstoned");
  const tampered = files.map((file) => ({ path: file.path, bytes: new Uint8Array(file.bytes) }));
  tampered.find((file) => file.path.startsWith("entries/")).bytes[40] ^= 1;
  assert.throws(() => buildDashboardViewModel({ files: tampered }), code("DASH_EXPORT_INVALID", "MO1308_EXPORT_CORRUPT"));
  assert.throws(() => buildDashboardViewModel({ files: files.filter((file) => file.path !== "memoryos-history-export-complete.json") }), code("DASH_EXPORT_INVALID", "MO1308_EXPORT_CORRUPT"));
  assert.throws(() => buildDashboardViewModel({ files: [...files, files[0]] }), code("DASH_EXPORT_INVALID", "MO1308_EXPORT_CORRUPT"));
  assert.throws(() => buildDashboardViewModel({ files: [] }), code("DASH_EXPORT_INVALID"));
  for (const bad of [undefined, null, {}, { files: "x" }, { files: [], extra: 1 }, { files: [{ path: "a", bytes: "text" }] }]) {
    assert.throws(() => buildDashboardViewModel(bad), code("DASH_USAGE"));
  }
  const error = new contract.DashboardError("DASH_EXPORT_INVALID", "MO1308_EXPORT_CORRUPT");
  assert.equal(error.message, contract.DASHBOARD_ERRORS.DASH_EXPORT_INVALID.message, "fixed message, no input content");
  assert.equal(new contract.DashboardError("NOT_A_CODE").code, "DASH_USAGE");
});

test("DB18/DB19 determinism: identical bytes give identical canonical bytes, whatever the file order, copy kind, locale or time zone", () => {
  for (const name of FIXTURE_NAMES) {
    const files = readExportFiles(name);
    const first = canonicalViewModelBytes(buildDashboardViewModel({ files }));
    assert.deepEqual(canonicalViewModelBytes(buildDashboardViewModel({ files })), first, name);
    const permuted = [...files].reverse();
    assert.deepEqual(canonicalViewModelBytes(buildDashboardViewModel({ files: permuted })), first, `${name}: reversed`);
    const shuffled = files.map((file, index) => [(index * 7919) % 104729, file]).sort((a, b) => a[0] - b[0]).map(([, file]) => file);
    assert.deepEqual(canonicalViewModelBytes(buildDashboardViewModel({ files: shuffled })), first, `${name}: shuffled`);
    const buffers = files.map((file) => ({ path: file.path, bytes: Buffer.from(file.bytes) }));
    assert.deepEqual(canonicalViewModelBytes(buildDashboardViewModel({ files: buffers })), first, `${name}: Buffer`);
    assert.deepEqual(first, readPinnedViewModelBytes(name), `${name}: pinned`);
  }
});

test("DB19 no wall-clock or locale dependence: fresh processes under hostile time zones, locales and clocks give the pinned bytes", () => {
  const script = fileURLToPath(new URL("./support-dashboard-determinism-probe.mjs", import.meta.url));
  const environments = [
    { TZ: "UTC", LC_ALL: "C", LANG: "C" },
    { TZ: "Pacific/Kiritimati", LC_ALL: "tr_TR.UTF-8", LANG: "tr_TR.UTF-8" },
    { TZ: "America/St_Johns", LC_ALL: "de_DE.UTF-8", LANG: "de_DE.UTF-8" },
    { TZ: "Asia/Kolkata", LC_ALL: "ja_JP.UTF-8", LANG: "ja_JP.UTF-8", MO1309_PROBE_FREEZE_CLOCK: "1" },
  ];
  const outputs = environments.map((env) => {
    const result = spawnSync(process.execPath, [script], { encoding: "utf8", env: { PATH: process.env.PATH, ...env }, maxBuffer: 64 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  });
  assert.ok(outputs[0].length > 100);
  for (const output of outputs) assert.equal(output, outputs[0]);
});

test("the view model carries no timestamp, path, host, user, clock or locale value", () => {
  const forbiddenKeys = /time|date|clock|locale|path|host|user|generated|created|zone/iu;
  const values = /(?:\d{4}-\d{2}-\d{2}T)|(?:^|[^\w])(?:[A-Za-z]:\\|\/(?:home|tmp|Users|var)\/)/u;
  for (const name of FIXTURE_NAMES) {
    const walk = (node, where) => {
      if (Array.isArray(node)) node.forEach((item, index) => walk(item, `${where}[${index}]`));
      else if (node !== null && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) { assert.ok(!forbiddenKeys.test(key), `${name}: ${where}.${key}`); walk(value, `${where}.${key}`); }
      } else if (typeof node === "string") assert.ok(name === "adversarial-wording" || !values.test(node), `${name}: ${where}`);
    };
    walk(build(name), "$");
  }
});
