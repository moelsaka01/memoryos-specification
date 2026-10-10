// MO-1309 Cloud Dashboard contract (Contract Freeze 1, Phase 1).
// Closed constants, the view model shape validator and the dashboard error catalog. Enums and limits are IMPORTED
// from the MO-1308 history contract and re-exported by identity, never redefined or copied (Freeze section 4.2, DB11).
// Browser-safe and pure: no filesystem, network, process, clock, locale or randomness.
import {
  ADMISSION_BY_KIND,
  DECISION_CONSISTENCY,
  ENTRY_TYPES,
  MEMBER_NAMES,
  MEMORYOS_HISTORY_LIMITS,
  RECORD_KINDS,
  RETENTION_STATES,
  SUBJECT_TYPES,
  WORKSPACE_ASSOCIATIONS,
  isDigest,
  isWorkspaceIdentifier,
} from "./memoryos-history-contract.js";

export {
  ADMISSION_BY_KIND,
  DECISION_CONSISTENCY,
  ENTRY_TYPES,
  MEMBER_NAMES,
  MEMORYOS_HISTORY_LIMITS,
  RECORD_KINDS,
  RETENTION_STATES,
  SUBJECT_TYPES,
  WORKSPACE_ASSOCIATIONS,
};

const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) freeze(value[key]);
  }
  return value;
};

export const DASHBOARD_VIEWMODEL_KIND = "MemoryOSDashboardViewModel";
export const DASHBOARD_VIEWMODEL_VERSION = "1.0.0";

// Freeze section 8.2: a presentation constant, at most the MO-1308 query maximum.
export const DASHBOARD_PAGE_SIZE = 100;

// Freeze section 7.5: the closed read-only action set. No other action exists on the page.
export const DASHBOARD_ACTIONS = freeze(["filter", "sort", "page", "expand", "copy", "select-entry"]);

// Freeze section 13: the closed dashboard error catalog. Messages are fixed and carry no input content.
export const DASHBOARD_ERRORS = freeze({
  DASH_USAGE: { message: "Invalid arguments." },
  DASH_EXPORT_UNREADABLE: { message: "The export could not be read." },
  DASH_EXPORT_INVALID: { message: "The export did not match its recorded integrity data." },
  DASH_LIMIT_EXCEEDED: { message: "A history limit was exceeded." },
  DASH_OUTPUT_EXISTS: { message: "The output already exists." },
  DASH_IO_FAILURE: { message: "The output could not be written." },
});

// `historyCode` carries the MO-1308 code (for example "MO1308_EXPORT_CORRUPT") when the failure came from verification.
export class DashboardError extends Error {
  constructor(code, historyCode = null) {
    const known = Object.hasOwn(DASHBOARD_ERRORS, code);
    super(known ? DASHBOARD_ERRORS[code].message : "Invalid arguments.");
    this.name = "DashboardError";
    this.code = known ? code : "DASH_USAGE";
    this.historyCode = typeof historyCode === "string" ? historyCode : null;
    Object.freeze(this);
  }
}

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
const isIndex = (value) => isCount(value) && value <= MEMORYOS_HISTORY_LIMITS.maximumIndex;
const isText = (value) => typeof value === "string" && value.length > 0 && value.isWellFormed();
const nullOr = (value, test) => value === null || test(value);

class Invalid extends Error {}
const reject = (path) => { throw new Invalid(path); };
const need = (condition, path) => { if (!condition) reject(path); };

function exactKeys(value, keys, path) {
  need(isPlainObject(value), path);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  need(actual.length === expected.length && actual.every((key, index) => key === expected[index]), path);
}

function checkSource(source) {
  exactKeys(source, ["ledgerIdentifier", "workspaceIdentifier", "entryCount", "headDigest", "manifestSha256"], "source");
  need(isDigest(source.ledgerIdentifier) && isWorkspaceIdentifier(source.workspaceIdentifier)
    && isCount(source.entryCount) && source.entryCount <= MEMORYOS_HISTORY_LIMITS.entriesPerLedger
    && isDigest(source.headDigest) && isDigest(source.manifestSha256), "source");
}

function ascending(values, path) {
  for (let index = 1; index < values.length; index += 1) need(values[index - 1] < values[index], path);
}

function checkVerification(verification) {
  exactKeys(verification, ["retainedRecords", "purgedRecords", "tombstones", "purgePending", "unreferencedRecords", "pendingArtifacts"], "verification");
  need(isCount(verification.retainedRecords) && isCount(verification.purgedRecords) && isCount(verification.tombstones)
    && isCount(verification.pendingArtifacts), "verification");
  need(Array.isArray(verification.purgePending) && verification.purgePending.length <= MEMORYOS_HISTORY_LIMITS.reportedAnomalies
    && verification.purgePending.every(isIndex), "verification.purgePending");
  ascending(verification.purgePending, "verification.purgePending");
  need(Array.isArray(verification.unreferencedRecords) && verification.unreferencedRecords.length <= MEMORYOS_HISTORY_LIMITS.reportedAnomalies
    && verification.unreferencedRecords.every(isDigest), "verification.unreferencedRecords");
  ascending(verification.unreferencedRecords, "verification.unreferencedRecords");
}

// Summary arrays hold one row per imported enum value, in the imported enum order (zero counts included).
function checkTally(rows, field, values, path) {
  need(Array.isArray(rows) && rows.length === values.length, path);
  rows.forEach((row, index) => {
    exactKeys(row, [field, "count"], path);
    need(row[field] === values[index] && isCount(row.count), path);
  });
}

function checkEntry(entry, index, entryCount, path) {
  exactKeys(entry, ["index", "entryDigest", "entryType", "recordKind", "recordDigest", "admission", "workspaceAssociation",
    "subjects", "retention", "tombstoneIndex", "decisionConsistency", "members"], path);
  need(entry.index === index && isDigest(entry.entryDigest) && ENTRY_TYPES.includes(entry.entryType), path);
  need(Array.isArray(entry.subjects) && entry.subjects.length <= MEMORYOS_HISTORY_LIMITS.subjectsPerEntry, `${path}.subjects`);
  for (const subject of entry.subjects) {
    exactKeys(subject, ["type", "value"], `${path}.subjects`);
    need(SUBJECT_TYPES.includes(subject.type) && isText(subject.value), `${path}.subjects`);
  }
  need(Array.isArray(entry.members), `${path}.members`);
  for (const member of entry.members) {
    exactKeys(member, ["name", "byteLength", "sha256"], `${path}.members`);
    need(MEMBER_NAMES.includes(member.name) && isCount(member.byteLength) && isDigest(member.sha256), `${path}.members`);
  }
  if (entry.entryType === "TOMBSTONE") {
    need(entry.recordKind === null && entry.recordDigest === null && entry.admission === null && entry.workspaceAssociation === null
      && entry.retention === null && entry.tombstoneIndex === null && entry.decisionConsistency === null
      && entry.subjects.length === 0 && entry.members.length === 0, path);
    return;
  }
  need(RECORD_KINDS.includes(entry.recordKind) && isDigest(entry.recordDigest) && entry.admission === ADMISSION_BY_KIND[entry.recordKind]
    && WORKSPACE_ASSOCIATIONS.includes(entry.workspaceAssociation) && RETENTION_STATES.includes(entry.retention), path);
  need(nullOr(entry.tombstoneIndex, isIndex), path);
  need((entry.retention === "PURGED") === (entry.tombstoneIndex !== null), path);
  if (entry.tombstoneIndex !== null) need(entry.tombstoneIndex > index && entry.tombstoneIndex < entryCount, path);
  // Amendment A4.1 of MO-1308: non-null exactly for a HUMAN_DECISION_CLAIM.
  if (entry.recordKind === "HUMAN_DECISION_CLAIM") need(DECISION_CONSISTENCY.includes(entry.decisionConsistency), path);
  else need(entry.decisionConsistency === null, path);
}

// Returns { ok: true } or { ok: false, reason } where reason is a path-like location only (no input content). The catalog
// of Freeze section 13 has no view-model code, so this validator introduces none.
export function validateDashboardViewModel(value) {
  try {
    exactKeys(value, ["kind", "version", "source", "verification", "summary", "entries"], "$");
    need(value.kind === DASHBOARD_VIEWMODEL_KIND && value.version === DASHBOARD_VIEWMODEL_VERSION, "$.kind");
    checkSource(value.source);
    checkVerification(value.verification);
    exactKeys(value.summary, ["byRecordKind", "byRetention", "byDecisionConsistency"], "summary");
    checkTally(value.summary.byRecordKind, "recordKind", RECORD_KINDS, "summary.byRecordKind");
    checkTally(value.summary.byRetention, "retention", RETENTION_STATES, "summary.byRetention");
    checkTally(value.summary.byDecisionConsistency, "value", DECISION_CONSISTENCY, "summary.byDecisionConsistency");
    need(Array.isArray(value.entries) && value.entries.length === value.source.entryCount, "entries");
    value.entries.forEach((entry, index) => checkEntry(entry, index, value.source.entryCount, `entries[${index}]`));
    value.entries.forEach((entry, index) => {
      if (entry.tombstoneIndex !== null) need(value.entries[entry.tombstoneIndex].entryType === "TOMBSTONE", `entries[${index}]`);
    });

    // Cross-checks: the summary and the verification counts must agree with the entries they describe.
    const count = (test) => value.entries.filter(test).length;
    const records = (test) => count((entry) => entry.entryType === "RECORD" && test(entry));
    need(value.summary.byRecordKind.every((row) => row.count === records((entry) => entry.recordKind === row.recordKind)), "summary.byRecordKind");
    need(value.summary.byRetention.every((row) => row.count === records((entry) => entry.retention === row.retention)), "summary.byRetention");
    need(value.summary.byDecisionConsistency.every((row) => row.count === records((entry) => entry.decisionConsistency === row.value)),
      "summary.byDecisionConsistency");
    need(value.verification.retainedRecords === records((entry) => entry.retention === "RETAINED")
      && value.verification.purgedRecords === records((entry) => entry.retention === "PURGED")
      && value.verification.tombstones === count((entry) => entry.entryType === "TOMBSTONE"), "verification");
    return { ok: true };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, reason: error.message };
    throw error;
  }
}
