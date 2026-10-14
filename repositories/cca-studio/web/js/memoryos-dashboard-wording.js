// MO-1309 Cloud Dashboard wording registry and forbidden-affordance rule (Contract Freeze 1, Phase 1, section 7).
// Every string the page chrome may show is a key of this closed table. The page shows no approve / ready / green affordance
// on any technical state: states are described neutrally, with the same weight, and never by colour alone.
// Pure and browser-safe. Untrusted export data is never a registry value; it is carried separately and flagged `untrusted`.
import {
  ADMISSION_BY_KIND,
  DASHBOARD_ACTIONS,
  DECISION_CONSISTENCY,
  DASHBOARD_ERRORS,
  ENTRY_TYPES,
  RECORD_KINDS,
  RETENTION_STATES,
  SUBJECT_TYPES,
  WORKSPACE_ASSOCIATIONS,
} from "./memoryos-dashboard-contract.js";

const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) freeze(value[key]);
  }
  return value;
};

// Neutral display names for imported enum values. A coverage test requires each table to name exactly the imported values.
export const ENUM_LABELS = freeze({
  recordKind: {
    MIP_PACKAGE: "Investigation package",
    INVESTIGATION_CHECKPOINT: "Investigation checkpoint",
    POLICY_EVALUATION: "Policy evaluation",
    REGRESSION_REPORT: "Regression report",
    CICD_RUN: "Pipeline run",
    READINESS_RESULT: "Readiness result",
    HUMAN_DECISION_CLAIM: "Human decision claim",
  },
  entryType: { RECORD: "Record entry", TOMBSTONE: "Tombstone entry" },
  retention: { RETAINED: "Members retained", PURGED: "Members purged" },
  workspaceAssociation: { DECLARED: "Workspace declared by the operator", INTRINSIC: "Workspace read from the record" },
  admission: {
    MIP_001_VERIFIED: "Package checked against its own format",
    CORE_LOG_VERIFIED_STATE_ISSUED: "Transition log checked, state issued by the engine",
    SDK_POLICY_ARTIFACTS_VERIFIED: "Policy artifacts checked by the SDK",
    SDK_REGRESSION_REPORT_INSPECTED: "Regression report inspected by the SDK",
    MO1306_BUNDLE_INTEGRITY_VERIFIED: "Run bundle checked for integrity",
    MO1307_SELF_DIGESTS_RECOMPUTED: "Result digests recomputed",
    MO1307_DECISION_CLAIM_BOUND: "Claim bound to a readiness result in this history",
  },
  subjectType: {
    WORKSPACE: "Workspace",
    MIP_PACKAGE_DIGEST: "Package digest",
    MIP_PACKAGE_IDENTIFIER: "Package identifier",
    INVESTIGATION: "Investigation",
    CHECKPOINT: "Checkpoint",
    TRANSITION_LOG_DIGEST: "Transition log digest",
    EVALUATION_IDENTITY_DIGEST: "Evaluation identity digest",
    OUTCOME_DIGEST: "Outcome digest",
    REGRESSION_REPORT: "Regression report",
    CICD_RUN_ID: "Pipeline run identifier",
    READINESS_CANDIDATE_DIGEST: "Candidate digest",
    READINESS_DIGEST: "Readiness digest",
    PROOF_BINDING_DIGEST: "Proof binding digest",
  },
  // CONTRARY_TO_READINESS is a neutral, disclosed observation; both values carry the same statement (section 7.3).
  decisionConsistency: {
    CONSISTENT: "Observation: the claim is recorded as matching its readiness result. This page does not decide, and a human decision claim is not a MemoryOS approval.",
    CONTRARY_TO_READINESS: "Observation: the claim is recorded as differing from its readiness result. This page does not decide, and a human decision claim is not a MemoryOS approval.",
  },
});

const CHROME = {
  "document.title": "MemoryOS history export view",
  "heading.page": "MemoryOS history export view",
  "heading.source": "Source export",
  "heading.integrity": "What this view does and does not show",
  "heading.counts": "Counts",
  "heading.anomalies": "Disclosed anomaly counts",
  "heading.entries": "History entries",
  "heading.members": "Members",
  "heading.subjects": "Subjects",

  "statement.integrityOnly": "This view reports integrity checking only. It shows that the recorded entries, hashes and links agree with each other as recorded.",
  "statement.notAuthenticated": "The history is not authenticated, not signed and not encrypted.",
  "statement.anchor": "Removal of the most recent entries, or a return to an earlier state, can be detected only by comparing the head digest with a head digest you recorded elsewhere. Record the head digest outside this file.",
  "statement.asOfGeneration": "This page shows one export as it was when this file was generated. It is not a view of a current store.",
  "statement.anomalyCounts": "Purge pending, unreferenced records and pending artifacts are disclosed here as counts only.",
  "statement.metadataDisclosure": "This file discloses entry metadata (identifiers, subjects and digests) to anyone who can read it. Controlling access to a hosted copy is the operator's responsibility.",
  "statement.noDecision": "This page makes no claim about authenticity, completeness, currency or approval, and takes no decision.",
  "statement.readOnly": "This page only displays data. It cannot change, add or remove anything.",
  "statement.membersNotShown": "Member contents are never shown. Only member names, lengths and digests are listed.",

  "label.ledgerIdentifier": "Ledger identifier",
  "label.workspaceIdentifier": "Workspace identifier",
  "label.entryCount": "Entry count",
  "label.headDigest": "Head digest",
  "label.manifestSha256": "Export manifest digest",
  "label.retainedRecords": "Records with members retained",
  "label.purgedRecords": "Records with members purged",
  "label.tombstones": "Tombstone entries",
  "label.purgePending": "Purge pending (entry indexes)",
  "label.unreferencedRecords": "Unreferenced records (digests)",
  "label.pendingArtifacts": "Pending artifacts",
  "label.none": "None",
  "label.byRecordKind": "By record kind",
  "label.byRetention": "By member retention",
  "label.byDecisionConsistency": "Human decision claims, by recorded observation",
  "label.generator": "Generator version",
  "label.snapshotDigest": "Snapshot digest",

  "column.index": "Index",
  "column.entryType": "Entry type",
  "column.recordKind": "Record kind",
  "column.recordDigest": "Record digest",
  "column.entryDigest": "Entry digest",
  "column.admission": "Admission method",
  "column.workspaceAssociation": "Workspace association",
  "column.retention": "Member retention",
  "column.tombstoneIndex": "Tombstone entry index",
  "column.decisionConsistency": "Recorded observation",
  "column.subjects": "Subjects",
  "column.members": "Members",
  "column.memberName": "Member name",
  "column.memberLength": "Length in bytes",
  "column.memberDigest": "Member digest",

  "filter.recordKind": "Filter by record kind",
  "filter.retention": "Filter by member retention",
  "filter.subject": "Filter by subject",
  "filter.subjectType": "Subject type",
  "filter.subjectValue": "Subject value",
  "filter.decisionConsistency": "Filter by recorded observation",
  "filter.any": "Any",
  "filter.clear": "Clear filters",
  "sort.label": "Sort order",
  "sort.ascending": "Index ascending",
  "sort.descending": "Index descending",
  "page.previous": "Previous page",
  "page.next": "Next page",
  "page.position": "Page",
  "page.of": "of",
  "page.rows": "Rows shown",
  "page.noMatch": "No entries match the current filters.",
  "page.empty": "This export contains no entries.",
  "action.expand": "Show members",
  "action.collapse": "Hide members",
  "action.copy": "Copy",
  "action.copyDigest": "Copy digest",
  "action.copied": "Copied to the clipboard.",
  "action.copyUnavailable": "Copying is not available in this browser.",
  "action.select": "Select entry",
  "text.truncated": "Value shortened for display. Use Copy for the full value.",
  "text.notApplicable": "Not applicable",

  "a11y.landmark.main": "History entries view",
  "a11y.landmark.filters": "Filters",
  "a11y.landmark.counts": "Counts",
  "a11y.landmark.pagination": "Pagination",
  "a11y.table": "History entries table",
  "a11y.membersTable": "Members of the selected entry",

  "error.dataUnreadable": "The embedded data could not be read, so nothing is shown.",

  // Added in Phase 2A for the page: short neutral observation names (the long statement stays in decisionConsistency.*),
  // the no-script text and the filter-update announcement.
  "observation.CONSISTENT": "Recorded as matching its readiness result",
  "observation.CONTRARY_TO_READINESS": "Recorded as differing from its readiness result",
  "statement.scriptRequired": "This page needs scripts enabled to display its data.",
  "page.updated": "The entries shown were updated.",
};
for (const [code, { message }] of Object.entries(DASHBOARD_ERRORS)) CHROME[`error.${code}`] = message;
for (const [group, labels] of Object.entries(ENUM_LABELS)) {
  for (const [value, text] of Object.entries(labels)) CHROME[`${group}.${value}`] = text;
}

// The closed registry: key -> string. Frozen; the page has no display string outside it (DB14).
export const WORDING = freeze({ ...CHROME });
export const WORDING_KEYS = freeze(Object.keys(WORDING).sort());

export function wording(key) {
  if (typeof key !== "string" || !Object.hasOwn(WORDING, key)) throw new TypeError("Unknown wording key.");
  return WORDING[key];
}

// ---- The forbidden-affordance rule (section 7.5) ----
// Matched case-insensitively on whole words unless noted. `verified` is forbidden unless qualified by "integrity".
const FORBIDDEN = freeze([
  ["approve", /\bapprov\w*/iu], ["reject", /\breject\w*/iu], ["ready", /\bready\b/iu], ["green", /\bgreen\b/iu],
  ["certify", /\bcertif\w*/iu], ["pass", /\bpass\w*/iu], ["fail", /\bfail\w*/iu], ["safe", /\bsafe\w*/iu],
  ["trusted", /\btrust\w*/iu], ["authentic", /\bauthentic\w*/iu], ["signed", /\bsigned\b/iu], ["encrypted", /\bencrypted\b/iu],
  ["verified", /(?<!integrity[ -])\bverified\b/iu], ["OK", /\bOK\b/u], ["success", /\bsuccess\w*/iu],
  ["mark", /[✓✔✅☑✗✘❌❎✕✖×⛔🟢🔴🟡🟩🟥]/u],
]);

export function forbiddenTerms(text) {
  return FORBIDDEN.filter(([, pattern]) => pattern.test(text)).map(([term]) => term);
}

// The closed allow-list reviewed in Phase 1: registry keys whose text *negates* a claim, and exactly the terms each may
// contain. A key not listed here may contain none; a listed key may contain only the listed terms.
export const NEGATION_ALLOW_LIST = freeze({
  "statement.notAuthenticated": ["authentic", "signed", "encrypted"],
  "statement.noDecision": ["authentic", "approve"],
  "decisionConsistency.CONSISTENT": ["approve"],
  "decisionConsistency.CONTRARY_TO_READINESS": ["approve"],
});

// Scans (key, text) pairs of chrome strings. Returns violations; an empty array means the scan is clean.
export function scanChromeStrings(items) {
  const violations = [];
  for (const { key, text } of items) {
    if (typeof key !== "string" || !Object.hasOwn(WORDING, key)) violations.push({ key, rule: "not-a-registry-key" });
    else if (WORDING[key] !== text) violations.push({ key, rule: "text-differs-from-registry" });
    const allowed = Object.hasOwn(NEGATION_ALLOW_LIST, key) ? NEGATION_ALLOW_LIST[key] : [];
    for (const term of forbiddenTerms(text)) if (!allowed.includes(term)) violations.push({ key, rule: "forbidden-term", term });
  }
  return violations;
}

// Scans controls: every button, link or input must carry an action from the closed read-only set, and no link may navigate.
export function scanControls(controls) {
  const violations = [];
  for (const control of controls) {
    if (!DASHBOARD_ACTIONS.includes(control.action)) violations.push({ element: control.element, rule: "action-not-read-only" });
    if (control.element === "a" || control.element === "form") violations.push({ element: control.element, rule: "navigation-or-form" });
  }
  return violations;
}

// ---- Pure rendered-string model ----
// The strings a page shows for a view model, as data: chrome strings (registry keys) and untrusted strings (export data).
// Untrusted strings are inert text in data cells: they never select a key, a state or a control. Phase 2A feeds the same
// scanner with the strings it extracts from the rendered DOM.
export function renderedStrings(viewModel) {
  const chrome = [];
  const untrusted = [];
  const say = (key) => chrome.push({ key, text: wording(key) });
  const data = (cell, text) => untrusted.push({ cell, text: String(text) });
  for (const key of ["document.title", "heading.page", "heading.source", "heading.integrity", "heading.counts", "heading.anomalies",
    "heading.entries", "statement.integrityOnly", "statement.notAuthenticated", "statement.anchor", "statement.asOfGeneration",
    "statement.anomalyCounts", "statement.metadataDisclosure", "statement.noDecision", "statement.readOnly", "statement.membersNotShown",
    "label.ledgerIdentifier", "label.workspaceIdentifier", "label.entryCount", "label.headDigest", "label.manifestSha256",
    "label.retainedRecords", "label.purgedRecords", "label.tombstones", "label.purgePending", "label.unreferencedRecords",
    "label.pendingArtifacts", "label.byRecordKind", "label.byRetention", "label.byDecisionConsistency"]) say(key);
  const { source, verification, summary } = viewModel;
  data("ledgerIdentifier", source.ledgerIdentifier);
  data("workspaceIdentifier", source.workspaceIdentifier);
  data("entryCount", source.entryCount);
  data("headDigest", source.headDigest);
  data("manifestSha256", source.manifestSha256);
  for (const field of ["retainedRecords", "purgedRecords", "tombstones", "pendingArtifacts"]) data(field, verification[field]);
  for (const index of verification.purgePending) data("purgePending", index);
  for (const digest of verification.unreferencedRecords) data("unreferencedRecords", digest);
  for (const row of summary.byRecordKind) { say(`recordKind.${row.recordKind}`); data("count", row.count); }
  for (const row of summary.byRetention) { say(`retention.${row.retention}`); data("count", row.count); }
  for (const row of summary.byDecisionConsistency) { say(`decisionConsistency.${row.value}`); data("count", row.count); }
  if (viewModel.entries.length === 0) say("page.empty");
  for (const entry of viewModel.entries) {
    data("index", entry.index);
    data("entryDigest", entry.entryDigest);
    say(`entryType.${entry.entryType}`);
    if (entry.entryType === "TOMBSTONE") continue;
    say(`recordKind.${entry.recordKind}`);
    data("recordDigest", entry.recordDigest);
    say(`admission.${entry.admission}`);
    say(`workspaceAssociation.${entry.workspaceAssociation}`);
    say(`retention.${entry.retention}`);
    if (entry.tombstoneIndex !== null) data("tombstoneIndex", entry.tombstoneIndex);
    if (entry.decisionConsistency !== null) say(`decisionConsistency.${entry.decisionConsistency}`);
    for (const subject of entry.subjects) { say(`subjectType.${subject.type}`); data("subjectValue", subject.value); }
    for (const member of entry.members) { data("memberName", member.name); data("memberLength", member.byteLength); data("memberDigest", member.sha256); }
  }
  return { chrome, untrusted };
}

// Compile-time coverage helpers used by the tests: the enum groups the labels must cover.
export const ENUM_GROUPS = freeze({
  recordKind: RECORD_KINDS,
  entryType: ENTRY_TYPES,
  retention: RETENTION_STATES,
  workspaceAssociation: WORKSPACE_ASSOCIATIONS,
  admission: Object.values(ADMISSION_BY_KIND),
  subjectType: SUBJECT_TYPES,
  decisionConsistency: DECISION_CONSISTENCY,
});
