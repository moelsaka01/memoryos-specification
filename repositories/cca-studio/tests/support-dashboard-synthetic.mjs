// MO-1309 test support: a synthetic but shape-valid view model of any size, for paging and layout tests of the page.
// It is NOT an export and proves nothing about verification; exports used as evidence come from the released CLI.
import { sha256Hex } from "../web/js/mip-canonical.js";
import {
  ADMISSION_BY_KIND, DECISION_CONSISTENCY, MEMBER_NAMES, RECORD_KINDS, RETENTION_STATES, SUBJECT_TYPES, WORKSPACE_ASSOCIATIONS,
  validateDashboardViewModel,
} from "../web/js/memoryos-dashboard-contract.js";

const digest = (label, index) => `sha256:${sha256Hex(`${label}:${index}`)}`;

export function syntheticViewModel(count, { longSubject = null, workspace = "workspace-synthetic" } = {}) {
  const entries = [];
  const tombstoneOf = new Map();
  for (let index = 0; index < count; index += 1) {
    if (index % 7 === 6 && !tombstoneOf.has(index - 3) && entries[index - 3]?.entryType === "RECORD") {
      tombstoneOf.set(index - 3, index);
      entries.push({ index, entryDigest: digest("e", index), entryType: "TOMBSTONE", recordKind: null, recordDigest: null, admission: null,
        workspaceAssociation: null, subjects: [], retention: null, tombstoneIndex: null, decisionConsistency: null, members: [] });
      continue;
    }
    const recordKind = RECORD_KINDS[index % RECORD_KINDS.length];
    const subjects = [{ type: SUBJECT_TYPES[index % SUBJECT_TYPES.length], value: `value-${index % 5}` }];
    if (longSubject !== null && index === 0) subjects.push({ type: "INVESTIGATION", value: longSubject });
    entries.push({
      index, entryDigest: digest("e", index), entryType: "RECORD", recordKind, recordDigest: digest("r", index), admission: ADMISSION_BY_KIND[recordKind],
      workspaceAssociation: WORKSPACE_ASSOCIATIONS[index % WORKSPACE_ASSOCIATIONS.length], subjects, retention: "RETAINED", tombstoneIndex: null,
      decisionConsistency: recordKind === "HUMAN_DECISION_CLAIM" ? DECISION_CONSISTENCY[index % 2] : null,
      members: [{ name: MEMBER_NAMES[0], byteLength: 100 + index, sha256: digest("m", index) }],
    });
  }
  for (const [target, tombstone] of tombstoneOf) {
    entries[target].retention = "PURGED";
    entries[target].tombstoneIndex = tombstone;
  }
  const records = entries.filter((entry) => entry.entryType === "RECORD");
  const tally = (values, field, pick) => values.map((value) => ({ [field]: value, count: records.filter((r) => pick(r) === value).length }));
  const viewModel = {
    kind: "MemoryOSDashboardViewModel", version: "1.0.0",
    source: { ledgerIdentifier: digest("ledger", 0), workspaceIdentifier: workspace, entryCount: count, headDigest: digest("head", count), manifestSha256: digest("manifest", 0) },
    verification: {
      retainedRecords: records.filter((r) => r.retention === "RETAINED").length, purgedRecords: records.filter((r) => r.retention === "PURGED").length,
      tombstones: entries.length - records.length, purgePending: [], unreferencedRecords: [], pendingArtifacts: 0,
    },
    summary: {
      byRecordKind: tally(RECORD_KINDS, "recordKind", (r) => r.recordKind), byRetention: tally(RETENTION_STATES, "retention", (r) => r.retention),
      byDecisionConsistency: tally(DECISION_CONSISTENCY, "value", (r) => r.decisionConsistency),
    },
    entries,
  };
  const checked = validateDashboardViewModel(viewModel);
  if (!checked.ok) throw new Error(`synthetic view model invalid at ${checked.reason}`);
  return viewModel;
}
