import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as contract from "../web/js/memoryos-history-contract.js";

const {
  ADMISSION_BY_KIND, MEMBER_NAMES, MEMORYOS_HISTORY_DOMAINS, MEMORYOS_HISTORY_ERRORS, MEMORYOS_HISTORY_KINDS,
  MEMORYOS_HISTORY_LAYOUT, MEMORYOS_HISTORY_LIMITS, MEMORYOS_HISTORY_STAGES, MemoryOSHistoryError,
  RECORD_KINDS, RECORD_MEMBER_RULES, SUBJECT_SOURCES, SUBJECT_TYPES, TOMBSTONE_REASONS,
  WORKSPACE_ASSOCIATION_BY_KIND, decodeHistoryBytes,
} = contract;

const fixtureURL = new URL("./fixtures/memoryos-history/1.0.0/shape-cases.json", import.meta.url);
const sourceURL = new URL("../web/js/memoryos-history-contract.js", import.meta.url);
const historyError = (expected) => (error) => error instanceof MemoryOSHistoryError && error.code === expected
  && error.exitCode === MEMORYOS_HISTORY_ERRORS[expected.slice("MO1308_".length)].exitCode;

test("MO-1308 contract enumerations equal Contract Freeze 1 exactly", () => {
  assert.deepEqual(RECORD_KINDS, ["MIP_PACKAGE", "INVESTIGATION_CHECKPOINT", "POLICY_EVALUATION",
    "REGRESSION_REPORT", "CICD_RUN", "READINESS_RESULT", "HUMAN_DECISION_CLAIM"]);
  assert.deepEqual(ADMISSION_BY_KIND, {
    MIP_PACKAGE: "MIP_001_VERIFIED", INVESTIGATION_CHECKPOINT: "CORE_LOG_VERIFIED_STATE_ISSUED",
    POLICY_EVALUATION: "SDK_POLICY_ARTIFACTS_VERIFIED", REGRESSION_REPORT: "SDK_REGRESSION_REPORT_INSPECTED",
    CICD_RUN: "MO1306_BUNDLE_INTEGRITY_VERIFIED", READINESS_RESULT: "MO1307_SELF_DIGESTS_RECOMPUTED",
    HUMAN_DECISION_CLAIM: "MO1307_DECISION_CLAIM_BOUND",
  });
  assert.deepEqual(WORKSPACE_ASSOCIATION_BY_KIND, {
    MIP_PACKAGE: "INTRINSIC", INVESTIGATION_CHECKPOINT: "INTRINSIC", POLICY_EVALUATION: "DECLARED",
    REGRESSION_REPORT: "INTRINSIC", CICD_RUN: "DECLARED", READINESS_RESULT: "DECLARED", HUMAN_DECISION_CLAIM: "DECLARED",
  });
  assert.deepEqual(SUBJECT_TYPES, ["WORKSPACE", "MIP_PACKAGE_DIGEST", "MIP_PACKAGE_IDENTIFIER", "INVESTIGATION",
    "CHECKPOINT", "TRANSITION_LOG_DIGEST", "EVALUATION_IDENTITY_DIGEST", "OUTCOME_DIGEST", "REGRESSION_REPORT",
    "CICD_RUN_ID", "READINESS_CANDIDATE_DIGEST", "READINESS_DIGEST", "PROOF_BINDING_DIGEST"]);
  assert.deepEqual(TOMBSTONE_REASONS, ["PRIVACY_REQUEST", "LEGAL_REQUIREMENT", "SECURITY_INCIDENT",
    "DATA_MINIMIZATION", "OPERATOR_CORRECTION"]);
  assert.deepEqual(MEMORYOS_HISTORY_STAGES, ["USAGE", "ACQUISITION", "VERIFICATION", "ADMISSION", "PUBLICATION", "INTERNAL"]);
  assert.deepEqual(MEMORYOS_HISTORY_DOMAINS, { ledger: "MEMORYOS-HISTORY-LEDGER-1.0", genesis: "MEMORYOS-HISTORY-GENESIS-1.0",
    entry: "MEMORYOS-HISTORY-ENTRY-1.0", record: "MEMORYOS-HISTORY-RECORD-1.0" });
  assert.deepEqual(Object.values(MEMORYOS_HISTORY_KINDS).sort(), ["MemoryOSHistoryEntry", "MemoryOSHistoryExport",
    "MemoryOSHistoryExportComplete", "MemoryOSHistoryLedger", "MemoryOSHistoryQuery", "MemoryOSHistoryQueryResult",
    "MemoryOSHistoryVerification"]);
});

test("MO-1308 error catalog and limits equal Contract Freeze 1 §14 exactly", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(MEMORYOS_HISTORY_ERRORS).map(([code, { exitCode }]) => [code, exitCode])), {
    USAGE: 1, RECORD_INVALID: 2, RECORD_DUPLICATE: 2, RECORD_PURGED: 2, WORKSPACE_MISMATCH: 2, DECISION_UNBOUND: 2,
    TOMBSTONE_INVALID: 2, QUERY_INVALID: 2, RESOURCE_LIMIT: 2, LEDGER_CORRUPT: 3, RECORD_BYTES_MISMATCH: 3,
    EXPORT_CORRUPT: 3, VERSION_UNSUPPORTED: 3, LEDGER_EXISTS: 4, LEDGER_NOT_FOUND: 4, LEDGER_CONFLICT: 4,
    FILESYSTEM_BOUNDARY: 4, IO: 4, INTERNAL: 5,
  });
  assert.deepEqual(MEMORYOS_HISTORY_LIMITS, {
    entriesPerLedger: 100000, maximumIndex: 99999, entryBytes: 16384, descriptorBytes: 1024, subjectsPerEntry: 16,
    queryLimitMinimum: 1, queryLimitMaximum: 1000, cliJsonStdoutBytes: 4194304, reportedAnomalies: 1000,
    ledgerNameMaximum: 64, authorityReferenceMaximum: 256,
  });
  const perMember = Object.fromEntries(Object.entries(RECORD_MEMBER_RULES).map(([kind, rule]) => [kind, [rule.memberBytes, rule.totalBytes]]));
  assert.deepEqual(perMember, {
    MIP_PACKAGE: [16777216, null], INVESTIGATION_CHECKPOINT: [33554432, null], POLICY_EVALUATION: [4060, null],
    REGRESSION_REPORT: [16777216, null], CICD_RUN: [49152, 49152], READINESS_RESULT: [4194304, null], HUMAN_DECISION_CLAIM: [8192, null],
  });
  assert.deepEqual(MEMORYOS_HISTORY_LAYOUT, { descriptor: "memoryos-history-ledger.json", entriesDirectory: "entries",
    recordsDirectory: "records", pendingDirectory: ".pending", entryIndexDigits: 20,
    exportManifest: "memoryos-history-export.json", exportComplete: "memoryos-history-export-complete.json" });
  assert.equal(MEMBER_NAMES.length, 11);
});

test("MO-1308 errors carry the closed code, stage and exit with fixed messages only", () => {
  const error = new MemoryOSHistoryError("QUERY_INVALID", "USAGE");
  assert.deepEqual({ code: error.code, stage: error.stage, exitCode: error.exitCode }, { code: "MO1308_QUERY_INVALID", stage: "USAGE", exitCode: 2 });
  assert.equal(error.message, MEMORYOS_HISTORY_ERRORS.QUERY_INVALID.message);
  assert.ok(Object.isFrozen(error));
  const unknown = new MemoryOSHistoryError("NOT_A_CODE", "NOT_A_STAGE");
  assert.deepEqual({ code: unknown.code, stage: unknown.stage }, { code: "MO1308_INTERNAL", stage: "INTERNAL" });
});

test("MO-1308 subject sources bind every kind to closed owner fields", () => {
  assert.deepEqual(Object.keys(SUBJECT_SOURCES), RECORD_KINDS);
  for (const kind of RECORD_KINDS) {
    const types = SUBJECT_SOURCES[kind].map((source) => source.type);
    assert.ok(types.every((type) => SUBJECT_TYPES.includes(type)), kind);
    assert.equal(new Set(types).size, types.length, kind);
    assert.ok(types.length <= MEMORYOS_HISTORY_LIMITS.subjectsPerEntry, kind);
    assert.equal(types.includes("WORKSPACE"), WORKSPACE_ASSOCIATION_BY_KIND[kind] === "INTRINSIC", kind);
    const members = RECORD_MEMBER_RULES[kind].memberSets.flat();
    assert.ok(SUBJECT_SOURCES[kind].every((source) => members.includes(source.member)), kind);
  }
});

test("MO-1308 shape fixtures validate exactly as declared", async () => {
  const bytes = new Uint8Array(await readFile(fixtureURL));
  const fixture = decodeHistoryBytes(bytes, { maxBytes: 1 << 20 });
  assert.equal(fixture.kind, "MemoryOSHistoryShapeFixtures");
  assert.equal(fixture.cases.length, 54);
  for (const { id, validator, value, expect } of fixture.cases) {
    if (expect === "VALID") assert.equal(contract[validator](value), value, id);
    else assert.throws(() => contract[validator](value), historyError(expect), id);
  }
});

test("MO-1308 history bytes are exact JCS without BOM or trailing LF", () => {
  const encode = (text) => new TextEncoder().encode(text);
  const valid = '{"a":1,"b":[true,null]}';
  assert.deepEqual(decodeHistoryBytes(encode(valid), { maxBytes: 64 }), { a: 1, b: [true, null] });
  for (const text of [`${valid}\n`, '{"b":[true,null],"a":1}', '{"a": 1,"b":[true,null]}', '{"a":1,"a":2}', '{"a":1.0}']) {
    assert.throws(() => decodeHistoryBytes(encode(text), { maxBytes: 64 }), historyError("MO1308_LEDGER_CORRUPT"), text);
  }
  const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...encode(valid)]);
  assert.throws(() => decodeHistoryBytes(bom, { maxBytes: 64 }), historyError("MO1308_LEDGER_CORRUPT"));
  assert.throws(() => decodeHistoryBytes(encode(valid), { maxBytes: 8 }), historyError("MO1308_RESOURCE_LIMIT"));
  assert.throws(() => decodeHistoryBytes(valid, { maxBytes: 64 }), historyError("MO1308_USAGE"));
  assert.throws(() => decodeHistoryBytes(encode("[1] "), { maxBytes: 64, code: "EXPORT_CORRUPT" }), historyError("MO1308_EXPORT_CORRUPT"));
});

test("MO-1308 contract module is pure, browser-safe and timeless (R28, R29, R35, R37)", async () => {
  const source = await readFile(sourceURL, "utf8");
  const imports = [...source.matchAll(/^import\s.+?from\s+"([^"]+)";$/gmu)].map((match) => match[1]);
  assert.deepEqual(imports, ["./mip-canonical.js"]);
  assert.doesNotMatch(source, /new Date|Date\.|performance\.|setTimeout|setInterval|Math\.random|crypto\.|process\.|require\(|import\(/u);
  assert.doesNotMatch(source, /node:|child_process|powershell|spawn|exec\(/iu);
  assert.doesNotMatch(source, /timestamp|observedAt|createdAt/iu);
});
