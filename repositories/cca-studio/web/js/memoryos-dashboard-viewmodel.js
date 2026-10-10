// MO-1309 Cloud Dashboard view model (Contract Freeze 1, Phase 1, section 6).
// Pure: verified export bytes in, MemoryOSDashboardViewModel out. Verification is MO-1308's `verifyHistoryExport`, the sole
// authority; entry meaning (retention, tombstone links, stored decision consistency) is MO-1308's `queryHistoryLedger`.
// This module re-derives nothing. Retained member contents are never read here beyond what verification itself does (9.3).
import {
  MEMORYOS_HISTORY_LAYOUT,
  MEMORYOS_HISTORY_LIMITS,
  MemoryOSHistoryError,
  decodeHistoryBytes,
  validateEntry,
} from "./memoryos-history-contract.js";
import { queryHistoryLedger, verifyHistoryExport } from "./memoryos-history-ledger.js";
import { canonicalize, decodeUtf8, parseStrictJson, sha256Hex, utf8Encode } from "./mip-canonical.js";
import {
  DASHBOARD_VIEWMODEL_KIND,
  DASHBOARD_VIEWMODEL_VERSION,
  DECISION_CONSISTENCY,
  DashboardError,
  RECORD_KINDS,
  RETENTION_STATES,
  validateDashboardViewModel,
} from "./memoryos-dashboard-contract.js";

const entryPath = (index) => `${MEMORYOS_HISTORY_LAYOUT.entriesDirectory}/${String(index).padStart(MEMORYOS_HISTORY_LAYOUT.entryIndexDigits, "0")}.json`;

function mapHistoryError(error) {
  if (!(error instanceof MemoryOSHistoryError)) return error;
  if (error.code === "MO1308_USAGE") return new DashboardError("DASH_USAGE");
  if (error.code === "MO1308_RESOURCE_LIMIT") return new DashboardError("DASH_LIMIT_EXCEEDED", error.code);
  return new DashboardError("DASH_EXPORT_INVALID", error.code);
}

const tally = (values, rows, field) => values.map((value) => ({ [field]: value, count: rows.filter((row) => row[field === "value" ? "decisionConsistency" : field] === value).length }));

// `input` is { files: [{ path, bytes }] }: the in-memory export, exactly as `verifyHistoryExport` takes it.
// Throws DashboardError (DASH_USAGE, DASH_LIMIT_EXCEEDED, DASH_EXPORT_INVALID carrying the MO-1308 code) and nothing else.
export function buildDashboardViewModel(input) {
  try {
    const verification = verifyHistoryExport(input); // the sole verification authority; throws on any defect
    const byPath = new Map(input.files.map((file) => [file.path, file.bytes]));
    const descriptorBytes = byPath.get(MEMORYOS_HISTORY_LAYOUT.descriptor);
    // Verification has already proven the completion marker names exactly this digest of the manifest bytes.
    const manifestSha256 = `sha256:${sha256Hex(byPath.get(MEMORYOS_HISTORY_LAYOUT.exportManifest))}`;
    const entryBytes = [];
    for (let index = 0; index < verification.entryCount; index += 1) entryBytes.push(byPath.get(entryPath(index)));

    // Entry meaning comes from MO-1308 query, page by page, in index order.
    const rows = [];
    let fromIndex = 0;
    while (fromIndex !== null) {
      const page = queryHistoryLedger({
        descriptorBytes,
        entries: entryBytes,
        query: { kind: "MemoryOSHistoryQuery", version: "1.0.0", recordKinds: [], subject: null, retention: "ANY", fromIndex, limit: MEMORYOS_HISTORY_LIMITS.queryLimitMaximum },
      });
      rows.push(...page.entries);
      fromIndex = page.nextIndex;
    }

    // The only addition to a query row: members (names, lengths, digests), as stored in the verified entry.
    const entries = rows.map((row) => {
      const entry = validateEntry(decodeHistoryBytes(entryBytes[row.index], { maxBytes: MEMORYOS_HISTORY_LIMITS.entryBytes }));
      return {
        index: row.index, entryDigest: row.entryDigest, entryType: row.entryType, recordKind: row.recordKind, recordDigest: row.recordDigest,
        admission: row.admission, workspaceAssociation: row.workspaceAssociation,
        subjects: row.subjects.map((subject) => ({ type: subject.type, value: subject.value })),
        retention: row.retention, tombstoneIndex: row.tombstoneIndex, decisionConsistency: row.decisionConsistency,
        members: entry.entryType === "RECORD" ? entry.record.members.map((member) => ({ name: member.name, byteLength: member.byteLength, sha256: member.sha256 })) : [],
      };
    });
    const records = entries.filter((entry) => entry.entryType === "RECORD");

    const viewModel = {
      kind: DASHBOARD_VIEWMODEL_KIND,
      version: DASHBOARD_VIEWMODEL_VERSION,
      source: {
        ledgerIdentifier: verification.ledgerIdentifier, workspaceIdentifier: verification.workspaceIdentifier,
        entryCount: verification.entryCount, headDigest: verification.headDigest, manifestSha256,
      },
      verification: {
        retainedRecords: verification.retainedRecords, purgedRecords: verification.purgedRecords, tombstones: verification.tombstones,
        purgePending: [...verification.purgePending], unreferencedRecords: [...verification.unreferencedRecords],
        pendingArtifacts: verification.pendingArtifacts,
      },
      summary: {
        byRecordKind: tally(RECORD_KINDS, records, "recordKind"),
        byRetention: tally(RETENTION_STATES, records, "retention"),
        byDecisionConsistency: tally(DECISION_CONSISTENCY, records, "value"),
      },
      entries,
    };
    if (!validateDashboardViewModel(viewModel).ok) throw new TypeError("Internal view model defect.");
    return viewModel;
  } catch (error) {
    throw mapHistoryError(error);
  }
}

// Canonical form: RFC 8785 JCS plus one trailing newline (section 6.6). Refuses a value outside the closed shape.
export function canonicalViewModelBytes(viewModel) {
  if (!validateDashboardViewModel(viewModel).ok) throw new DashboardError("DASH_USAGE");
  return utf8Encode(`${canonicalize(viewModel)}\n`);
}

// The page reads its embedded data with this: strict parse, closed shape, and exact canonical bytes (no alternative encoding).
export function readCanonicalViewModel(bytes) {
  try {
    const text = decodeUtf8(bytes);
    if (!text.endsWith("\n")) return { ok: false, reason: "$" };
    const viewModel = parseStrictJson(text.slice(0, -1));
    if (`${canonicalize(viewModel)}\n` !== text) return { ok: false, reason: "$" };
    const checked = validateDashboardViewModel(viewModel);
    return checked.ok ? { ok: true, viewModel } : checked;
  } catch {
    return { ok: false, reason: "$" };
  }
}
