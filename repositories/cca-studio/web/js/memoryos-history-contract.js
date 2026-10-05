// MO-1308 Investigation History contract (Contract Freeze 1, Phase 1).
// Closed constants, enumerations, limits and shape validators only. Identities,
// chain verification, query, export and admission belong to later phases.
// Browser-safe and pure: no filesystem, network, process, clock or randomness.
import { canonicalize, decodeUtf8, parseStrictJson } from "./mip-canonical.js";

const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) freeze(value[key]);
  }
  return value;
};

export const MEMORYOS_HISTORY_VERSION = "1.0.0";

export const MEMORYOS_HISTORY_KINDS = freeze({
  ledger: "MemoryOSHistoryLedger",
  entry: "MemoryOSHistoryEntry",
  verification: "MemoryOSHistoryVerification",
  query: "MemoryOSHistoryQuery",
  queryResult: "MemoryOSHistoryQueryResult",
  exportManifest: "MemoryOSHistoryExport",
  exportComplete: "MemoryOSHistoryExportComplete",
});

// Freeze §8.2, §7.1. Domains for the Standard's D construction (2A computes them).
export const MEMORYOS_HISTORY_DOMAINS = freeze({
  ledger: "MEMORYOS-HISTORY-LEDGER-1.0",
  genesis: "MEMORYOS-HISTORY-GENESIS-1.0",
  entry: "MEMORYOS-HISTORY-ENTRY-1.0",
  record: "MEMORYOS-HISTORY-RECORD-1.0",
});

export const RECORD_KINDS = freeze([
  "MIP_PACKAGE",
  "INVESTIGATION_CHECKPOINT",
  "POLICY_EVALUATION",
  "REGRESSION_REPORT",
  "CICD_RUN",
  "READINESS_RESULT",
  "HUMAN_DECISION_CLAIM",
]);

// Freeze §7.3: exactly one admission method per kind (H13 option A for checkpoints).
export const ADMISSION_BY_KIND = freeze({
  MIP_PACKAGE: "MIP_001_VERIFIED",
  INVESTIGATION_CHECKPOINT: "CORE_LOG_VERIFIED_STATE_ISSUED",
  POLICY_EVALUATION: "SDK_POLICY_ARTIFACTS_VERIFIED",
  REGRESSION_REPORT: "SDK_REGRESSION_REPORT_INSPECTED",
  CICD_RUN: "MO1306_BUNDLE_INTEGRITY_VERIFIED",
  READINESS_RESULT: "MO1307_SELF_DIGESTS_RECOMPUTED",
  HUMAN_DECISION_CLAIM: "MO1307_DECISION_CLAIM_BOUND",
});

// Freeze §7.1, H26: one ledger per Workspace; INTRINSIC or DECLARED association.
export const WORKSPACE_ASSOCIATION_BY_KIND = freeze({
  MIP_PACKAGE: "INTRINSIC",
  INVESTIGATION_CHECKPOINT: "INTRINSIC",
  POLICY_EVALUATION: "DECLARED",
  REGRESSION_REPORT: "INTRINSIC",
  CICD_RUN: "DECLARED",
  READINESS_RESULT: "DECLARED",
  HUMAN_DECISION_CLAIM: "DECLARED",
});

const CICD_SEMANTIC_MEMBERS = ["evaluation-identity.json", "policy-outcome.json"];
const CICD_OPERATIONAL_MEMBERS = [
  "memoryos-ci-artifacts.json", "memoryos-ci-complete.json",
  "memoryos-ci-evidence.json", "memoryos-ci-result.json",
];

// Freeze §7.1 members per kind. memberSets lists every allowed exact name set.
export const RECORD_MEMBER_RULES = freeze({
  MIP_PACKAGE: { memberSets: [["package.mip"]], memberBytes: 16_777_216, totalBytes: null },
  INVESTIGATION_CHECKPOINT: { memberSets: [["checkpoint.json"]], memberBytes: 33_554_432, totalBytes: null },
  POLICY_EVALUATION: { memberSets: [["evaluation-identity.json", "policy-outcome.json"]], memberBytes: 4060, totalBytes: null },
  REGRESSION_REPORT: { memberSets: [["regression-report.json"]], memberBytes: 16_777_216, totalBytes: null },
  CICD_RUN: {
    memberSets: [[...CICD_SEMANTIC_MEMBERS, ...CICD_OPERATIONAL_MEMBERS].sort(), [...CICD_OPERATIONAL_MEMBERS]],
    memberBytes: 49_152,
    totalBytes: 49_152,
  },
  READINESS_RESULT: { memberSets: [["memoryos-readiness-result.json"]], memberBytes: 4_194_304, totalBytes: null },
  HUMAN_DECISION_CLAIM: { memberSets: [["human-decision.json"]], memberBytes: 8192, totalBytes: null },
});

export const MEMBER_NAMES = freeze([...new Set(Object.values(RECORD_MEMBER_RULES)
  .flatMap((rule) => rule.memberSets.flat()))].sort());

export const SUBJECT_TYPES = freeze([
  "WORKSPACE",
  "MIP_PACKAGE_DIGEST",
  "MIP_PACKAGE_IDENTIFIER",
  "INVESTIGATION",
  "CHECKPOINT",
  "TRANSITION_LOG_DIGEST",
  "EVALUATION_IDENTITY_DIGEST",
  "OUTCOME_DIGEST",
  "REGRESSION_REPORT",
  "CICD_RUN_ID",
  "READINESS_CANDIDATE_DIGEST",
  "READINESS_DIGEST",
  "PROOF_BINDING_DIGEST",
]);

// Freeze §8.2: Phase 1 binds each kind's subject source fields to the owner's
// published shape without changing them. Values are copied exactly by 2B.
export const SUBJECT_SOURCES = freeze({
  MIP_PACKAGE: [
    { type: "MIP_PACKAGE_DIGEST", member: "package.mip", field: "integrity.packageDigest" },
    { type: "MIP_PACKAGE_IDENTIFIER", member: "package.mip", field: "manifest.packageIdentifier" },
    { type: "WORKSPACE", member: "package.mip", field: "manifest.workspaceIdentifier" },
  ],
  INVESTIGATION_CHECKPOINT: [
    { type: "CHECKPOINT", member: "checkpoint.json", field: "identifier" },
    { type: "INVESTIGATION", member: "checkpoint.json", field: "investigationIdentifier" },
    { type: "TRANSITION_LOG_DIGEST", member: "checkpoint.json", field: "transitionLogDigest" },
    { type: "WORKSPACE", member: "checkpoint.json", field: "workspaceIdentifier" },
  ],
  POLICY_EVALUATION: [
    { type: "EVALUATION_IDENTITY_DIGEST", member: "policy-outcome.json", field: "evaluationIdentityDigest" },
    { type: "OUTCOME_DIGEST", member: "policy-outcome.json", field: "outcomeDigest returned by the SDK outcome-artifact verifier" },
  ],
  REGRESSION_REPORT: [
    { type: "REGRESSION_REPORT", member: "regression-report.json", field: "identifier" },
    { type: "WORKSPACE", member: "regression-report.json", field: "baseline.workspaceIdentifier" },
  ],
  CICD_RUN: [
    { type: "CICD_RUN_ID", member: "memoryos-ci-result.json", field: "runId" },
    { type: "EVALUATION_IDENTITY_DIGEST", member: "memoryos-ci-result.json", field: "semantic.evaluationIdentityDigest" },
    { type: "OUTCOME_DIGEST", member: "memoryos-ci-result.json", field: "semantic.outcomeDigest" },
  ],
  READINESS_RESULT: [
    { type: "PROOF_BINDING_DIGEST", member: "memoryos-readiness-result.json", field: "proofBindingDigest" },
    { type: "READINESS_CANDIDATE_DIGEST", member: "memoryos-readiness-result.json", field: "assessment.candidateDigest" },
    { type: "READINESS_DIGEST", member: "memoryos-readiness-result.json", field: "readinessDigest" },
  ],
  HUMAN_DECISION_CLAIM: [
    { type: "PROOF_BINDING_DIGEST", member: "human-decision.json", field: "proofBindingDigest" },
    { type: "READINESS_CANDIDATE_DIGEST", member: "human-decision.json", field: "candidateDigest" },
    { type: "READINESS_DIGEST", member: "human-decision.json", field: "readinessDigest" },
  ],
});

export const ENTRY_TYPES = freeze(["RECORD", "TOMBSTONE"]);
export const WORKSPACE_ASSOCIATIONS = freeze(["DECLARED", "INTRINSIC"]);
export const TOMBSTONE_REASONS = freeze([
  "PRIVACY_REQUEST", "LEGAL_REQUIREMENT", "SECURITY_INCIDENT", "DATA_MINIMIZATION", "OPERATOR_CORRECTION",
]);
export const TOMBSTONE_AUTHENTICITY = "NOT_VERIFIED_BY_MEMORYOS";
export const RETENTION_FILTERS = freeze(["ANY", "RETAINED", "PURGED"]);
export const RETENTION_STATES = freeze(["RETAINED", "PURGED"]);
export const DECISION_CONSISTENCY = freeze(["CONSISTENT", "CONTRARY_TO_READINESS"]);

// Freeze §14.2.
export const MEMORYOS_HISTORY_LIMITS = freeze({
  entriesPerLedger: 100_000,
  maximumIndex: 99_999,
  entryBytes: 16_384,
  descriptorBytes: 1024,
  subjectsPerEntry: 16,
  queryLimitMinimum: 1,
  queryLimitMaximum: 1000,
  cliJsonStdoutBytes: 4_194_304,
  reportedAnomalies: 1000,
  ledgerNameMaximum: 64,
  authorityReferenceMaximum: 256,
});

// Freeze §9.1 and §12 layout names.
export const MEMORYOS_HISTORY_LAYOUT = freeze({
  descriptor: "memoryos-history-ledger.json",
  entriesDirectory: "entries",
  recordsDirectory: "records",
  pendingDirectory: ".pending",
  entryIndexDigits: 20,
  exportManifest: "memoryos-history-export.json",
  exportComplete: "memoryos-history-export-complete.json",
});

export const MEMORYOS_HISTORY_STAGES = freeze(["USAGE", "ACQUISITION", "VERIFICATION", "ADMISSION", "PUBLICATION", "INTERNAL"]);

// Freeze §14.1: closed catalog. Messages are fixed and carry no input content.
export const MEMORYOS_HISTORY_ERRORS = freeze({
  USAGE: { exitCode: 1, message: "Invalid command, flag or argument." },
  RECORD_INVALID: { exitCode: 2, message: "The record failed admission." },
  RECORD_DUPLICATE: { exitCode: 2, message: "The record is already in the ledger." },
  RECORD_PURGED: { exitCode: 2, message: "A purged record cannot be added again." },
  WORKSPACE_MISMATCH: { exitCode: 2, message: "The record Workspace differs from the ledger Workspace." },
  DECISION_UNBOUND: { exitCode: 2, message: "No matching readiness result is in the ledger." },
  TOMBSTONE_INVALID: { exitCode: 2, message: "The tombstone target is not eligible." },
  QUERY_INVALID: { exitCode: 2, message: "The query is malformed." },
  RESOURCE_LIMIT: { exitCode: 2, message: "A history limit was exceeded." },
  LEDGER_CORRUPT: { exitCode: 3, message: "The ledger failed integrity verification." },
  RECORD_BYTES_MISMATCH: { exitCode: 3, message: "Retained record bytes do not match their entry." },
  EXPORT_CORRUPT: { exitCode: 3, message: "The export failed integrity verification." },
  VERSION_UNSUPPORTED: { exitCode: 3, message: "Stored history data has an unsupported version." },
  LEDGER_EXISTS: { exitCode: 4, message: "The target location already exists." },
  LEDGER_NOT_FOUND: { exitCode: 4, message: "No ledger descriptor was found." },
  LEDGER_CONFLICT: { exitCode: 4, message: "Another writer committed this entry first." },
  FILESYSTEM_BOUNDARY: { exitCode: 4, message: "A filesystem boundary check failed." },
  IO: { exitCode: 4, message: "A read, write or link operation failed." },
  INTERNAL: { exitCode: 5, message: "An internal history failure occurred." },
});

export class MemoryOSHistoryError extends Error {
  constructor(suffix, stage) {
    const entry = Object.hasOwn(MEMORYOS_HISTORY_ERRORS, suffix) ? MEMORYOS_HISTORY_ERRORS[suffix] : MEMORYOS_HISTORY_ERRORS.INTERNAL;
    const code = Object.hasOwn(MEMORYOS_HISTORY_ERRORS, suffix) ? suffix : "INTERNAL";
    super(entry.message);
    this.name = "MemoryOSHistoryError";
    this.code = `MO1308_${code}`;
    this.stage = MEMORYOS_HISTORY_STAGES.includes(stage) ? stage : "INTERNAL";
    this.exitCode = entry.exitCode;
    Object.freeze(this);
  }
}

export function historyFail(suffix, stage) {
  throw new MemoryOSHistoryError(suffix, stage);
}

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const LEDGER_NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/u;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/u;

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const isIndex = (value) => Number.isSafeInteger(value) && value >= 0 && value <= MEMORYOS_HISTORY_LIMITS.maximumIndex;
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
const isWellFormedText = (value) => typeof value === "string" && value.length > 0 && value.isWellFormed();
const before = (left, right) => left < right; // UTF-16 code unit order, the JCS key order

export const isDigest = (value) => typeof value === "string" && DIGEST.test(value);
export const isLedgerName = (value) => typeof value === "string" && LEDGER_NAME.test(value);
export const isWorkspaceIdentifier = isWellFormedText; // Core and CCA-MIP-1.0: non-empty, untrimmed string
export const isAuthorityReference = (value) => typeof value === "string" && value.length <= MEMORYOS_HISTORY_LIMITS.authorityReferenceMaximum
  && PRINTABLE_ASCII.test(value);

function exactKeys(value, keys, code, stage) {
  if (!isPlainObject(value)) historyFail(code, stage);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) historyFail(code, stage);
}
function kindAndVersion(value, kind, code, stage) {
  if (value.kind !== kind) historyFail(code, stage);
  if (value.version !== MEMORYOS_HISTORY_VERSION) {
    historyFail(typeof value.version === "string" && code !== "QUERY_INVALID" ? "VERSION_UNSUPPORTED" : code, stage);
  }
}
function strictlyAscending(values, key, code, stage) {
  for (let index = 1; index < values.length; index += 1) {
    if (!before(key(values[index - 1]), key(values[index]))) historyFail(code, stage);
  }
}

// MO-1308-authored files are exactly JCS(x) bytes, no BOM and no trailing LF (Freeze §6.2).
export function decodeHistoryBytes(bytes, { maxBytes, code = "LEDGER_CORRUPT", stage = "VERIFICATION" } = {}) {
  if (!(bytes instanceof Uint8Array)) historyFail("USAGE", "USAGE");
  if (!Number.isSafeInteger(maxBytes) || bytes.byteLength > maxBytes) historyFail("RESOURCE_LIMIT", stage);
  let text;
  let value;
  try {
    text = decodeUtf8(bytes);
    value = parseStrictJson(text, { maxDepth: 16 });
  } catch {
    return historyFail(code, stage);
  }
  let canonical;
  try { canonical = canonicalize(value); } catch { return historyFail(code, stage); }
  if (canonical !== text) historyFail(code, stage);
  return value;
}

export function validateLedgerDescriptor(value, { code = "LEDGER_CORRUPT", stage = "VERIFICATION" } = {}) {
  exactKeys(value, ["kind", "version", "ledgerName", "workspaceIdentifier"], code, stage);
  kindAndVersion(value, MEMORYOS_HISTORY_KINDS.ledger, code, stage);
  if (!isLedgerName(value.ledgerName) || !isWorkspaceIdentifier(value.workspaceIdentifier)) historyFail(code, stage);
  return value;
}

function validateMembers(recordKind, members, code, stage) {
  if (!Array.isArray(members) || members.length === 0) historyFail(code, stage);
  const rule = RECORD_MEMBER_RULES[recordKind];
  let total = 0;
  for (const member of members) {
    exactKeys(member, ["name", "byteLength", "sha256"], code, stage);
    if (typeof member.name !== "string" || !isCount(member.byteLength) || !isDigest(member.sha256)) historyFail(code, stage);
    if (member.byteLength > rule.memberBytes) historyFail(code, stage);
    total += member.byteLength;
  }
  strictlyAscending(members, (member) => member.name, code, stage);
  const names = members.map((member) => member.name);
  if (!rule.memberSets.some((set) => set.length === names.length && set.every((name, index) => name === names[index]))) {
    historyFail(code, stage);
  }
  if (rule.totalBytes !== null && total > rule.totalBytes) historyFail(code, stage);
}

// Amendment A2: subjects are strictly ascending by (type, value), with no duplicates.
function subjectsStrictlyAscending(subjects, code, stage) {
  for (let index = 1; index < subjects.length; index += 1) {
    const left = subjects[index - 1], right = subjects[index];
    if (before(right.type, left.type) || (right.type === left.type && !before(left.value, right.value))) historyFail(code, stage);
  }
}

function validateSubjects(recordKind, subjects, code, stage) {
  if (!Array.isArray(subjects) || subjects.length > MEMORYOS_HISTORY_LIMITS.subjectsPerEntry) historyFail(code, stage);
  const allowed = new Set(SUBJECT_SOURCES[recordKind].map((source) => source.type));
  for (const subject of subjects) {
    exactKeys(subject, ["type", "value"], code, stage);
    if (!allowed.has(subject.type) || !isWellFormedText(subject.value)) historyFail(code, stage);
  }
  subjectsStrictlyAscending(subjects, code, stage);
}

export function validateEntry(value, { code = "LEDGER_CORRUPT", stage = "VERIFICATION" } = {}) {
  exactKeys(value, ["kind", "version", "ledgerIdentifier", "index", "previousEntryDigest", "entryType", "record", "tombstone", "entryDigest"], code, stage);
  kindAndVersion(value, MEMORYOS_HISTORY_KINDS.entry, code, stage);
  if (!isDigest(value.ledgerIdentifier) || !isIndex(value.index) || !isDigest(value.previousEntryDigest)
      || !isDigest(value.entryDigest) || !ENTRY_TYPES.includes(value.entryType)) historyFail(code, stage);
  if (value.entryType === "RECORD") {
    if (value.tombstone !== null) historyFail(code, stage);
    const record = value.record;
    exactKeys(record, ["recordKind", "recordDigest", "admission", "members", "workspaceAssociation", "subjects", "decisionConsistency"], code, stage);
    if (!RECORD_KINDS.includes(record.recordKind) || !isDigest(record.recordDigest)
        || record.admission !== ADMISSION_BY_KIND[record.recordKind]
        || record.workspaceAssociation !== WORKSPACE_ASSOCIATION_BY_KIND[record.recordKind]) historyFail(code, stage);
    validateMembers(record.recordKind, record.members, code, stage);
    validateSubjects(record.recordKind, record.subjects, code, stage);
    // Amendment A4.1: stored at admission; non-null exactly for a HUMAN_DECISION_CLAIM, never null there.
    if (record.recordKind === "HUMAN_DECISION_CLAIM" ? !DECISION_CONSISTENCY.includes(record.decisionConsistency)
      : record.decisionConsistency !== null) historyFail(code, stage);
  } else {
    if (value.record !== null) historyFail(code, stage);
    const tombstone = value.tombstone;
    exactKeys(tombstone, ["targetIndex", "targetEntryDigest", "targetRecordDigest", "reason", "authorityReference", "authenticity"], code, stage);
    if (!isIndex(tombstone.targetIndex) || tombstone.targetIndex >= value.index
        || !isDigest(tombstone.targetEntryDigest) || !isDigest(tombstone.targetRecordDigest)
        || !TOMBSTONE_REASONS.includes(tombstone.reason) || !isAuthorityReference(tombstone.authorityReference)
        || tombstone.authenticity !== TOMBSTONE_AUTHENTICITY) historyFail(code, stage);
  }
  return value;
}

export function validateQuery(value, { code = "QUERY_INVALID", stage = "USAGE" } = {}) {
  exactKeys(value, ["kind", "version", "recordKinds", "subject", "retention", "fromIndex", "limit"], code, stage);
  kindAndVersion(value, MEMORYOS_HISTORY_KINDS.query, code, stage);
  if (!Array.isArray(value.recordKinds) || value.recordKinds.some((kind) => !RECORD_KINDS.includes(kind))) historyFail(code, stage);
  // Amendment A2: recordKinds are strictly ascending (no duplicates), like every other set.
  strictlyAscending(value.recordKinds, (kind) => kind, code, stage);
  if (value.subject !== null) {
    exactKeys(value.subject, ["type", "value"], code, stage);
    if (!SUBJECT_TYPES.includes(value.subject.type) || !isWellFormedText(value.subject.value)) historyFail(code, stage);
  }
  if (!RETENTION_FILTERS.includes(value.retention) || !isIndex(value.fromIndex)
      || !Number.isSafeInteger(value.limit) || value.limit < MEMORYOS_HISTORY_LIMITS.queryLimitMinimum
      || value.limit > MEMORYOS_HISTORY_LIMITS.queryLimitMaximum) historyFail(code, stage);
  return value;
}

export function validateVerification(value, { code = "LEDGER_CORRUPT", stage = "VERIFICATION" } = {}) {
  exactKeys(value, ["kind", "version", "ledgerIdentifier", "workspaceIdentifier", "entryCount", "headDigest",
    "retainedRecords", "purgedRecords", "tombstones", "purgePending", "unreferencedRecords", "pendingArtifacts"], code, stage);
  kindAndVersion(value, MEMORYOS_HISTORY_KINDS.verification, code, stage);
  if (!isDigest(value.ledgerIdentifier) || !isWorkspaceIdentifier(value.workspaceIdentifier)
      || !isCount(value.entryCount) || value.entryCount > MEMORYOS_HISTORY_LIMITS.entriesPerLedger || !isDigest(value.headDigest)
      || !isCount(value.retainedRecords) || !isCount(value.purgedRecords) || !isCount(value.tombstones)
      || !isCount(value.pendingArtifacts)) historyFail(code, stage);
  if (!Array.isArray(value.purgePending) || value.purgePending.length > MEMORYOS_HISTORY_LIMITS.reportedAnomalies
      || value.purgePending.some((index) => !isIndex(index))) historyFail(code, stage);
  strictlyAscending(value.purgePending, (index) => index, code, stage);
  if (!Array.isArray(value.unreferencedRecords) || value.unreferencedRecords.length > MEMORYOS_HISTORY_LIMITS.reportedAnomalies
      || value.unreferencedRecords.some((digest) => !isDigest(digest))) historyFail(code, stage);
  strictlyAscending(value.unreferencedRecords, (digest) => digest, code, stage);
  return value;
}

export function validateQueryResult(value, { code = "INTERNAL", stage = "INTERNAL" } = {}) {
  exactKeys(value, ["kind", "version", "ledgerIdentifier", "workspaceIdentifier", "entryCount", "headDigest", "query", "entries", "nextIndex"], code, stage);
  kindAndVersion(value, MEMORYOS_HISTORY_KINDS.queryResult, code, stage);
  if (!isDigest(value.ledgerIdentifier) || !isWorkspaceIdentifier(value.workspaceIdentifier)
      || !isCount(value.entryCount) || !isDigest(value.headDigest)
      || !(value.nextIndex === null || isIndex(value.nextIndex))) historyFail(code, stage);
  validateQuery(value.query, { code, stage });
  if (!Array.isArray(value.entries) || value.entries.length > value.query.limit) historyFail(code, stage);
  for (const entry of value.entries) {
    exactKeys(entry, ["index", "entryDigest", "entryType", "recordKind", "recordDigest", "admission",
      "workspaceAssociation", "subjects", "retention", "tombstoneIndex", "decisionConsistency"], code, stage);
    if (!isIndex(entry.index) || !isDigest(entry.entryDigest) || !ENTRY_TYPES.includes(entry.entryType)) historyFail(code, stage);
    const nullOr = (candidate, test) => candidate === null || test(candidate);
    if (!nullOr(entry.recordKind, (kind) => RECORD_KINDS.includes(kind))
        || !nullOr(entry.recordDigest, isDigest)
        || !nullOr(entry.admission, (admission) => Object.values(ADMISSION_BY_KIND).includes(admission))
        || !nullOr(entry.workspaceAssociation, (association) => WORKSPACE_ASSOCIATIONS.includes(association))
        || !nullOr(entry.retention, (retention) => RETENTION_STATES.includes(retention))
        || !nullOr(entry.tombstoneIndex, isIndex)
        || !nullOr(entry.decisionConsistency, (consistency) => DECISION_CONSISTENCY.includes(consistency))) historyFail(code, stage);
    // Amendment A4.1: the stored value of a claim record entry; null for every other entry and every tombstone.
    if ((entry.entryType === "RECORD" && entry.recordKind === "HUMAN_DECISION_CLAIM") === (entry.decisionConsistency === null)) historyFail(code, stage);
    if (!Array.isArray(entry.subjects) || entry.subjects.length > MEMORYOS_HISTORY_LIMITS.subjectsPerEntry) historyFail(code, stage);
    for (const subject of entry.subjects) {
      exactKeys(subject, ["type", "value"], code, stage);
      if (!SUBJECT_TYPES.includes(subject.type) || !isWellFormedText(subject.value)) historyFail(code, stage);
    }
    subjectsStrictlyAscending(entry.subjects, code, stage);
  }
  strictlyAscending(value.entries, (entry) => entry.index, code, stage);
  return value;
}

const EXPORT_PATH = /^(?:memoryos-history-ledger\.json|entries\/[0-9]{20}\.json|records\/[0-9a-f]{64}\/[a-z0-9.-]+)$/u;

export function validateExportManifest(value, { code = "EXPORT_CORRUPT", stage = "VERIFICATION" } = {}) {
  exactKeys(value, ["kind", "version", "ledgerIdentifier", "workspaceIdentifier", "entryCount", "headDigest", "files"], code, stage);
  kindAndVersion(value, MEMORYOS_HISTORY_KINDS.exportManifest, code, stage);
  if (!isDigest(value.ledgerIdentifier) || !isWorkspaceIdentifier(value.workspaceIdentifier)
      || !isCount(value.entryCount) || value.entryCount > MEMORYOS_HISTORY_LIMITS.entriesPerLedger
      || !isDigest(value.headDigest) || !Array.isArray(value.files)) historyFail(code, stage);
  for (const file of value.files) {
    exactKeys(file, ["path", "byteLength", "sha256"], code, stage);
    if (typeof file.path !== "string" || !EXPORT_PATH.test(file.path) || !isCount(file.byteLength) || !isDigest(file.sha256)) historyFail(code, stage);
    if (file.path.startsWith("records/") && !MEMBER_NAMES.includes(file.path.slice(file.path.lastIndexOf("/") + 1))) historyFail(code, stage);
  }
  strictlyAscending(value.files, (file) => file.path, code, stage);
  return value;
}

export function validateExportComplete(value, { code = "EXPORT_CORRUPT", stage = "VERIFICATION" } = {}) {
  exactKeys(value, ["kind", "version", "manifestSha256"], code, stage);
  kindAndVersion(value, MEMORYOS_HISTORY_KINDS.exportComplete, code, stage);
  if (!isDigest(value.manifestSha256)) historyFail(code, stage);
  return value;
}
