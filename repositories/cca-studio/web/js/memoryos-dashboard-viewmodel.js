// MO-1309 Cloud Dashboard view model (Contract Freeze 1, Phase 1, section 6).
// Pure: verified export bytes in, MemoryOSDashboardViewModel out. Verification is MO-1308's `verifyHistoryExport`, the sole
// authority; entry meaning (retention, tombstone links, stored decision consistency) has the meaning MO-1308's
// `queryHistoryLedger` gives it (Phase 3: built in one linear pass after one verification, proven equal by differential test). Retained member contents are never read here beyond what verification itself does (9.3).
import {
  MEMORYOS_HISTORY_LAYOUT,
  MEMORYOS_HISTORY_LIMITS,
  MemoryOSHistoryError,
  decodeHistoryBytes,
  validateEntry,
} from "./memoryos-history-contract.js";
import { verifyHistoryExport } from "./memoryos-history-ledger.js";
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
    // Verification has already proven the completion marker names exactly this digest of the manifest bytes.
    const manifestSha256 = `sha256:${sha256Hex(byPath.get(MEMORYOS_HISTORY_LAYOUT.exportManifest))}`;
    // Phase 3 (linear build): verifyHistoryExport above already verified the whole chain and every entry byte once. The entry
    // files are parsed here once each with the public MO-1308 contract validator, and the per-row fields are the ones
    // `queryHistoryLedger` returns (same mapping, differential-tested), so the chain is not re-verified once per query page.
    const parsed = [];
    for (let index = 0; index < verification.entryCount; index += 1) {
      parsed.push(validateEntry(decodeHistoryBytes(byPath.get(entryPath(index)), { maxBytes: MEMORYOS_HISTORY_LIMITS.entryBytes })));
    }
    const tombstoneIndexByTarget = new Map();
    for (const entry of parsed) if (entry.entryType === "TOMBSTONE") tombstoneIndexByTarget.set(entry.tombstone.targetIndex, entry.index);
    const entries = parsed.map((entry) => {
      if (entry.entryType === "TOMBSTONE") {
        return {
          index: entry.index, entryDigest: entry.entryDigest, entryType: "TOMBSTONE", recordKind: null, recordDigest: null, admission: null,
          workspaceAssociation: null, subjects: [], retention: null, tombstoneIndex: null, decisionConsistency: null, members: [],
        };
      }
      const { record } = entry;
      return {
        index: entry.index, entryDigest: entry.entryDigest, entryType: "RECORD", recordKind: record.recordKind, recordDigest: record.recordDigest,
        admission: record.admission, workspaceAssociation: record.workspaceAssociation,
        subjects: record.subjects.map((subject) => ({ type: subject.type, value: subject.value })),
        retention: tombstoneIndexByTarget.has(entry.index) ? "PURGED" : "RETAINED", tombstoneIndex: tombstoneIndexByTarget.get(entry.index) ?? null,
        decisionConsistency: record.decisionConsistency,
        members: record.members.map((member) => ({ name: member.name, byteLength: member.byteLength, sha256: member.sha256 })),
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
