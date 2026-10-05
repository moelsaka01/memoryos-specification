// A conforming stand-in for the SDK history functions (Freeze section 13.2), used only by the Stream 2C
// tests. Stream 2C is built against the frozen SDK signatures only; the real functions are Streams 2A and
// 2B, integrated in Stream 2D, and until then the SDK functions fail closed. This double implements the
// frozen byte formats and rules just far enough to drive the file store: identities, the chain, member
// verification, tombstones, a filter-only query and the export model. Admission here trusts the member
// names and sizes (it is NOT the 2B admission), and records carry only a WORKSPACE subject and a trusted decisionConsistency.
import crypto from "node:crypto";

import {
  MEMBER_NAMES, MemoryOSHistoryError, RECORD_KINDS, RECORD_MEMBER_RULES, TOMBSTONE_REASONS, decodeHistoryBytes, validateEntry,
  validateVerification,
} from "../../../cca-studio/web/js/memoryos-history-contract.js";
import { canonicalize, mipDigest } from "../../../cca-studio/web/js/mip-canonical.js";

const enc = new TextEncoder();
const sha = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const fail = (code, stage) => { throw new MemoryOSHistoryError(code, stage); };
const jcsBytes = (value) => new Uint8Array(enc.encode(canonicalize(value)));
const ledgerBrand = new WeakMap();
const admissionBrand = new WeakSet();

function chain(descriptorBytes, entryBytes) {
  const descriptor = decodeHistoryBytes(descriptorBytes, { maxBytes: 1024 });
  const ledgerIdentifier = mipDigest("MEMORYOS-HISTORY-LEDGER-1.0", canonicalize(descriptor));
  let head = mipDigest("MEMORYOS-HISTORY-GENESIS-1.0", ledgerIdentifier);
  const entries = [];
  const tombstoned = new Map();
  const keys = new Set();
  entryBytes.forEach((bytes, index) => {
    const entry = validateEntry(decodeHistoryBytes(bytes, { maxBytes: 16384 }));
    const { entryDigest, ...rest } = entry;
    if (entry.ledgerIdentifier !== ledgerIdentifier || entry.index !== index || entry.previousEntryDigest !== head
        || entryDigest !== mipDigest("MEMORYOS-HISTORY-ENTRY-1.0", canonicalize(rest))) fail("LEDGER_CORRUPT", "VERIFICATION");
    if (entry.entryType === "RECORD") {
      const key = `${entry.record.recordKind}\n${entry.record.recordDigest}`;
      if (keys.has(key)) fail("LEDGER_CORRUPT", "VERIFICATION");
      keys.add(key);
    } else {
      tombstoned.set(entry.tombstone.targetIndex, index);
    }
    entries.push(entry);
    head = entryDigest;
  });
  return { descriptor, ledgerIdentifier, headDigest: head, entries, tombstoned, keys };
}

export function createHistoryEngineDouble() {
  const seal = (state, fields) => {
    const entry = { kind: "MemoryOSHistoryEntry", version: "1.0.0", ledgerIdentifier: state.ledgerIdentifier, index: state.entries.length,
      previousEntryDigest: state.headDigest, ...fields };
    entry.entryDigest = mipDigest("MEMORYOS-HISTORY-ENTRY-1.0", canonicalize(entry));
    return { entryBytes: jcsBytes(entry), entryDigest: entry.entryDigest, index: entry.index };
  };
  const engine = {
    MemoryOSHistoryError,
    createHistoryLedger({ ledgerName, workspaceIdentifier }) {
      const descriptor = { kind: "MemoryOSHistoryLedger", version: "1.0.0", ledgerName, workspaceIdentifier };
      return { descriptorBytes: jcsBytes(descriptor), ledgerIdentifier: mipDigest("MEMORYOS-HISTORY-LEDGER-1.0", canonicalize(descriptor)) };
    },
    verifyHistoryLedger({ descriptorBytes, entries, members }) {
      const state = chain(descriptorBytes, entries);
      let retained = 0, purged = 0, tombstones = 0;
      const purgePending = [], referenced = new Set();
      for (const entry of state.entries) {
        if (entry.entryType === "TOMBSTONE") { tombstones += 1; continue; }
        const { recordDigest } = entry.record;
        referenced.add(recordDigest);
        const files = members.get(recordDigest);
        if (state.tombstoned.has(entry.index)) {
          purged += 1;
          if (files !== undefined) purgePending.push(entry.index);
          continue;
        }
        retained += 1;
        if (files === undefined || files.length !== entry.record.members.length) fail("RECORD_BYTES_MISMATCH", "VERIFICATION");
        for (const expected of entry.record.members) {
          const file = files.find((candidate) => candidate.name === expected.name);
          if (file === undefined || file.bytes.length !== expected.byteLength || sha(file.bytes) !== expected.sha256) fail("RECORD_BYTES_MISMATCH", "VERIFICATION");
        }
      }
      const verification = validateVerification({ kind: "MemoryOSHistoryVerification", version: "1.0.0", ledgerIdentifier: state.ledgerIdentifier,
        workspaceIdentifier: state.descriptor.workspaceIdentifier, entryCount: state.entries.length, headDigest: state.headDigest,
        retainedRecords: retained, purgedRecords: purged, tombstones, purgePending,
        unreferencedRecords: [...members.keys()].filter((digest) => !referenced.has(digest)).sort(), pendingArtifacts: 0 });
      const ledger = Object.freeze({ ...verification });
      ledgerBrand.set(ledger, state);
      return ledger;
    },
    admitHistoryRecord({ recordKind, members, ledger }) {
      const state = ledgerBrand.get(ledger);
      if (state === undefined || !RECORD_KINDS.includes(recordKind)) fail("RECORD_INVALID", "ADMISSION");
      const names = members.map((member) => member.name).sort();
      if (!RECORD_MEMBER_RULES[recordKind].memberSets.some((set) => set.length === names.length && set.every((name, index) => name === names[index]))) {
        fail("RECORD_INVALID", "ADMISSION");
      }
      const list = names.map((name) => { const bytes = members.find((member) => member.name === name).bytes; return { name, byteLength: bytes.length, sha256: sha(bytes) }; });
      const recordDigest = mipDigest("MEMORYOS-HISTORY-RECORD-1.0", recordKind, canonicalize(list));
      const key = `${recordKind}\n${recordDigest}`;
      if (state.keys.has(key)) {
        const index = state.entries.find((entry) => entry.record?.recordDigest === recordDigest).index;
        fail(state.tombstoned.has(index) ? "RECORD_PURGED" : "RECORD_DUPLICATE", "ADMISSION");
      }
      const admission = Object.freeze({ recordKind, recordDigest, members: list,
        admission: { MIP_PACKAGE: "MIP_001_VERIFIED", INVESTIGATION_CHECKPOINT: "CORE_LOG_VERIFIED_STATE_ISSUED", POLICY_EVALUATION: "SDK_POLICY_ARTIFACTS_VERIFIED",
          REGRESSION_REPORT: "SDK_REGRESSION_REPORT_INSPECTED", CICD_RUN: "MO1306_BUNDLE_INTEGRITY_VERIFIED", READINESS_RESULT: "MO1307_SELF_DIGESTS_RECOMPUTED",
          HUMAN_DECISION_CLAIM: "MO1307_DECISION_CLAIM_BOUND" }[recordKind],
        workspaceAssociation: ["MIP_PACKAGE", "INVESTIGATION_CHECKPOINT", "REGRESSION_REPORT"].includes(recordKind) ? "INTRINSIC" : "DECLARED",
        subjects: ["MIP_PACKAGE", "INVESTIGATION_CHECKPOINT", "REGRESSION_REPORT"].includes(recordKind)
          ? [{ type: "WORKSPACE", value: state.descriptor.workspaceIdentifier }] : [],
        // Amendment A4.1: the real admission computes this from the claim and the readiness result; the stand-in trusts it.
        decisionConsistency: recordKind === "HUMAN_DECISION_CLAIM" ? "CONSISTENT" : null });
      admissionBrand.add(admission);
      return admission;
    },
    appendHistoryEntry({ ledger, admission }) {
      const state = ledgerBrand.get(ledger);
      if (state === undefined || !admissionBrand.has(admission)) fail("USAGE", "USAGE");
      return seal(state, { entryType: "RECORD", record: JSON.parse(canonicalize(admission)), tombstone: null });
    },
    tombstoneHistoryEntry({ ledger, targetIndex, reason, authorityReference }) {
      const state = ledgerBrand.get(ledger);
      if (state === undefined || !TOMBSTONE_REASONS.includes(reason)) fail("USAGE", "USAGE");
      const target = state.entries[targetIndex];
      if (target === undefined || target.entryType !== "RECORD" || state.tombstoned.has(targetIndex)) fail("TOMBSTONE_INVALID", "ADMISSION");
      return seal(state, { entryType: "TOMBSTONE", record: null, tombstone: { targetIndex, targetEntryDigest: target.entryDigest,
        targetRecordDigest: target.record.recordDigest, reason, authorityReference, authenticity: "NOT_VERIFIED_BY_MEMORYOS" } });
    },
    queryHistoryLedger({ descriptorBytes, entries, query }) {
      const state = chain(descriptorBytes, entries);
      const matches = state.entries.filter((entry) => entry.index >= query.fromIndex && entry.entryType === "RECORD"
        && (query.recordKinds.length === 0 || query.recordKinds.includes(entry.record.recordKind)));
      const page = matches.slice(0, query.limit);
      return { kind: "MemoryOSHistoryQueryResult", version: "1.0.0", ledgerIdentifier: state.ledgerIdentifier,
        workspaceIdentifier: state.descriptor.workspaceIdentifier, entryCount: state.entries.length, headDigest: state.headDigest, query,
        entries: page.map((entry) => ({ index: entry.index, entryDigest: entry.entryDigest, entryType: "RECORD", recordKind: entry.record.recordKind,
          recordDigest: entry.record.recordDigest, admission: entry.record.admission, workspaceAssociation: entry.record.workspaceAssociation,
          subjects: entry.record.subjects, retention: state.tombstoned.has(entry.index) ? "PURGED" : "RETAINED",
          tombstoneIndex: state.tombstoned.get(entry.index) ?? null, decisionConsistency: entry.record.decisionConsistency })),
        nextIndex: matches.length > query.limit ? matches[query.limit].index : null };
    },
    buildHistoryExport({ descriptorBytes, entries, members }) {
      const ledger = engine.verifyHistoryLedger({ descriptorBytes, entries, members });
      const state = ledgerBrand.get(ledger);
      const files = [{ path: "memoryos-history-ledger.json", bytes: descriptorBytes }];
      entries.forEach((bytes, index) => files.push({ path: `entries/${String(index).padStart(20, "0")}.json`, bytes }));
      for (const entry of state.entries) {
        if (entry.entryType !== "RECORD" || state.tombstoned.has(entry.index)) continue;
        for (const member of members.get(entry.record.recordDigest)) files.push({ path: `records/${entry.record.recordDigest.slice(7)}/${member.name}`, bytes: member.bytes });
      }
      files.sort((a, b) => (a.path < b.path ? -1 : 1));
      const manifest = jcsBytes({ kind: "MemoryOSHistoryExport", version: "1.0.0", ledgerIdentifier: ledger.ledgerIdentifier,
        workspaceIdentifier: ledger.workspaceIdentifier, entryCount: ledger.entryCount, headDigest: ledger.headDigest,
        files: files.map((file) => ({ path: file.path, byteLength: file.bytes.length, sha256: sha(file.bytes) })) });
      const marker = jcsBytes({ kind: "MemoryOSHistoryExportComplete", version: "1.0.0", manifestSha256: sha(manifest) });
      return { files: [...files, { path: "memoryos-history-export.json", bytes: manifest }, { path: "memoryos-history-export-complete.json", bytes: marker }]
        .sort((a, b) => (a.path < b.path ? -1 : 1)) };
    },
    verifyHistoryExport({ files }) {
      const byPath = new Map(files.map((file) => [file.path, file.bytes]));
      const manifestBytes = byPath.get("memoryos-history-export.json"), markerBytes = byPath.get("memoryos-history-export-complete.json");
      if (manifestBytes === undefined || markerBytes === undefined) fail("EXPORT_CORRUPT", "VERIFICATION");
      const manifest = decodeHistoryBytes(manifestBytes, { maxBytes: 1 << 26, code: "EXPORT_CORRUPT" });
      if (decodeHistoryBytes(markerBytes, { maxBytes: 1024, code: "EXPORT_CORRUPT" }).manifestSha256 !== sha(manifestBytes)) fail("EXPORT_CORRUPT", "VERIFICATION");
      if (byPath.size !== manifest.files.length + 2) fail("EXPORT_CORRUPT", "VERIFICATION");
      for (const file of manifest.files) {
        const bytes = byPath.get(file.path);
        if (bytes === undefined || bytes.length !== file.byteLength || sha(bytes) !== file.sha256) fail("EXPORT_CORRUPT", "VERIFICATION");
      }
      return Object.freeze({ kind: "MemoryOSHistoryVerification", version: "1.0.0", ledgerIdentifier: manifest.ledgerIdentifier,
        workspaceIdentifier: manifest.workspaceIdentifier, entryCount: manifest.entryCount, headDigest: manifest.headDigest, retainedRecords: 0,
        purgedRecords: 0, tombstones: 0, purgePending: [], unreferencedRecords: [], pendingArtifacts: 0 });
    },
  };
  void MEMBER_NAMES;
  return engine;
}
