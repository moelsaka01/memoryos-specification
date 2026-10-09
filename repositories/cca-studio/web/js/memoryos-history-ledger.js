// MO-1308 Investigation History ledger core (Contract Freeze 1, Stream 2A).
// Identities, entry construction, chain verification, query and the export model.
// Pure and browser-safe: bytes in, bytes out. No filesystem, network, process,
// clock or randomness (H06, R28, R29, R35, R37). Admission and file storage belong
// to other streams; this module imports only the contract and the canonical module.
import { canonicalize, deepFreeze, mipDigest, sha256Hex, utf8Encode } from "./mip-canonical.js";
import {
  MEMORYOS_HISTORY_DOMAINS as DOMAINS,
  MEMORYOS_HISTORY_KINDS as KINDS,
  MEMORYOS_HISTORY_LAYOUT as LAYOUT,
  MEMORYOS_HISTORY_LIMITS as LIMITS,
  MEMORYOS_HISTORY_VERSION as VERSION,
  RECORD_MEMBER_RULES,
  TOMBSTONE_AUTHENTICITY,
  TOMBSTONE_REASONS,
  decodeHistoryBytes,
  historyFail,
  isAuthorityReference,
  isDigest,
  isLedgerName,
  isWorkspaceIdentifier,
  validateEntry,
  validateExportComplete,
  validateExportManifest,
  validateLedgerDescriptor,
  validateQuery,
  validateQueryResult,
  validateVerification,
} from "./memoryos-history-contract.js";

const before = (left, right) => left < right; // UTF-16 code unit order, the JCS key order
const isBytes = (value) => value instanceof Uint8Array && !(value.buffer instanceof SharedArrayBuffer);
const copyBytes = (bytes) => new Uint8Array(bytes);
const digestOfBytes = (bytes) => `sha256:${sha256Hex(bytes)}`;
const recordKey = (recordKind, recordDigest) => `${recordKind}\n${recordDigest}`;
const entryFileName = (index) => `${LAYOUT.entriesDirectory}/${String(index).padStart(LAYOUT.entryIndexDigits, "0")}.json`;
const HEX64 = /^[0-9a-f]{64}$/u;

function requireBytes(value) {
  if (!isBytes(value)) historyFail("USAGE", "USAGE");
}
function requireByteList(value) {
  if (!Array.isArray(value)) historyFail("USAGE", "USAGE");
  for (const bytes of value) requireBytes(bytes);
}
function requireObject(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) historyFail("USAGE", "USAGE");
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) historyFail("USAGE", "USAGE");
  return value;
}
function requireMemberMap(value) {
  if (!(value instanceof Map)) historyFail("USAGE", "USAGE");
  for (const [recordDigest, members] of value) {
    if (!isDigest(recordDigest) || !Array.isArray(members)) historyFail("USAGE", "USAGE");
    for (const member of members) {
      requireObject(member, ["name", "bytes"]);
      if (typeof member.name !== "string") historyFail("USAGE", "USAGE");
      requireBytes(member.bytes);
    }
  }
}

// ---- Identities (Freeze §8.2, §7.1) ----

export const ledgerIdentifierOf = (descriptor) => mipDigest(DOMAINS.ledger, canonicalize(descriptor));
export const genesisDigestOf = (ledgerIdentifier) => mipDigest(DOMAINS.genesis, ledgerIdentifier);
export const entryDigestOf = (entryWithoutDigest) => mipDigest(DOMAINS.entry, canonicalize(entryWithoutDigest));
export const recordDigestOf = (recordKind, members) => mipDigest(DOMAINS.record, recordKind, canonicalize(members));

function withoutEntryDigest(entry) {
  const { entryDigest, ...rest } = entry; // eslint-disable-line no-unused-vars
  return rest;
}

// ---- Ledger creation ----

export function createHistoryLedger(input) {
  const { ledgerName, workspaceIdentifier } = requireObject(input, ["ledgerName", "workspaceIdentifier"]);
  if (!isLedgerName(ledgerName) || !isWorkspaceIdentifier(workspaceIdentifier)) historyFail("USAGE", "USAGE");
  const descriptor = { kind: KINDS.ledger, version: VERSION, ledgerName, workspaceIdentifier };
  const descriptorBytes = utf8Encode(canonicalize(descriptor));
  if (descriptorBytes.byteLength > LIMITS.descriptorBytes) historyFail("RESOURCE_LIMIT", "ACQUISITION");
  return Object.freeze({ descriptorBytes, ledgerIdentifier: ledgerIdentifierOf(descriptor) });
}

// ---- Chain verification (Freeze §11.1, entries only) ----

function verifyChain(descriptorBytes, entryBytesList) {
  requireBytes(descriptorBytes);
  requireByteList(entryBytesList);
  const descriptor = validateLedgerDescriptor(decodeHistoryBytes(descriptorBytes, { maxBytes: LIMITS.descriptorBytes }));
  const ledgerIdentifier = ledgerIdentifierOf(descriptor);
  if (entryBytesList.length > LIMITS.entriesPerLedger) historyFail("RESOURCE_LIMIT", "VERIFICATION");
  const genesisDigest = genesisDigestOf(ledgerIdentifier);

  const entries = [];
  const recordIndexByKey = new Map();
  const tombstoneIndexByTarget = new Map();
  let previousDigest = genesisDigest;
  for (let index = 0; index < entryBytesList.length; index += 1) {
    const entry = validateEntry(decodeHistoryBytes(entryBytesList[index], { maxBytes: LIMITS.entryBytes }));
    if (entry.ledgerIdentifier !== ledgerIdentifier || entry.index !== index
        || entry.previousEntryDigest !== previousDigest
        || entry.entryDigest !== entryDigestOf(withoutEntryDigest(entry))) historyFail("LEDGER_CORRUPT", "VERIFICATION");
    if (entry.entryType === "RECORD") {
      const { record } = entry;
      if (record.recordDigest !== recordDigestOf(record.recordKind, record.members)) historyFail("LEDGER_CORRUPT", "VERIFICATION");
      const key = recordKey(record.recordKind, record.recordDigest);
      if (recordIndexByKey.has(key)) historyFail("LEDGER_CORRUPT", "VERIFICATION"); // duplicates and purge re-supply (R10, R20)
      recordIndexByKey.set(key, index);
    } else {
      const { tombstone } = entry;
      const target = entries[tombstone.targetIndex];
      if (target === undefined || target.entryType !== "RECORD" || tombstoneIndexByTarget.has(tombstone.targetIndex)
          || tombstone.targetEntryDigest !== target.entryDigest
          || tombstone.targetRecordDigest !== target.record.recordDigest) historyFail("LEDGER_CORRUPT", "VERIFICATION");
      tombstoneIndexByTarget.set(tombstone.targetIndex, index);
    }
    entries.push(entry);
    previousDigest = entry.entryDigest;
  }
  return { descriptor, ledgerIdentifier, genesisDigest, entries, recordIndexByKey, tombstoneIndexByTarget, headDigest: previousDigest };
}

// ---- Full verification (Freeze §11.1) ----

const ledgerStates = new WeakMap();

function verifyMembers(chain, members) {
  let retainedRecords = 0;
  let purgedRecords = 0;
  let tombstones = 0;
  const purgePending = [];
  const referenced = new Set();
  for (const entry of chain.entries) {
    if (entry.entryType === "TOMBSTONE") {
      tombstones += 1;
      continue;
    }
    const { record } = entry;
    referenced.add(record.recordDigest);
    const retained = members.get(record.recordDigest);
    if (chain.tombstoneIndexByTarget.has(entry.index)) {
      // Purged: content is never verified (R19). Any remaining member means the purge is pending.
      purgedRecords += 1;
      if (retained !== undefined && retained.length > 0) purgePending.push(entry.index);
      continue;
    }
    retainedRecords += 1;
    if (retained === undefined || retained.length !== record.members.length) historyFail("RECORD_BYTES_MISMATCH", "VERIFICATION");
    const byName = new Map();
    for (const member of retained) {
      if (byName.has(member.name)) historyFail("RECORD_BYTES_MISMATCH", "VERIFICATION");
      byName.set(member.name, member.bytes);
    }
    for (const expected of record.members) {
      const bytes = byName.get(expected.name);
      if (bytes === undefined || bytes.byteLength !== expected.byteLength || digestOfBytes(bytes) !== expected.sha256) {
        historyFail("RECORD_BYTES_MISMATCH", "VERIFICATION");
      }
    }
  }
  const unreferencedRecords = [...members.keys()].filter((digest) => !referenced.has(digest)).sort();
  return { retainedRecords, purgedRecords, tombstones, purgePending, unreferencedRecords };
}

function buildVerification(chain, members) {
  const counts = verifyMembers(chain, members);
  return {
    kind: KINDS.verification,
    version: VERSION,
    ledgerIdentifier: chain.ledgerIdentifier,
    workspaceIdentifier: chain.descriptor.workspaceIdentifier,
    entryCount: chain.entries.length,
    headDigest: chain.headDigest,
    retainedRecords: counts.retainedRecords,
    purgedRecords: counts.purgedRecords,
    tombstones: counts.tombstones,
    purgePending: counts.purgePending.slice(0, LIMITS.reportedAnomalies),
    unreferencedRecords: counts.unreferencedRecords.slice(0, LIMITS.reportedAnomalies),
    // Staging artifacts are filesystem facts the pure authority cannot see; the file store reports them.
    pendingArtifacts: 0,
  };
}

// Amendment A4.1: admission of a decision claim re-verifies the referenced readiness result's retained bytes, so the
// verified ledger keeps a snapshot of exactly those members (retained READINESS_RESULT records only, copied).
function readinessMembersOf(chain, members) {
  const kept = new Map();
  for (const entry of chain.entries) {
    if (entry.entryType !== "RECORD" || entry.record.recordKind !== "READINESS_RESULT"
        || chain.tombstoneIndexByTarget.has(entry.index)) continue;
    kept.set(entry.record.recordDigest, members.get(entry.record.recordDigest)
      .map((member) => ({ name: member.name, bytes: copyBytes(member.bytes) })));
  }
  return kept;
}

// Returns the verified ledger value: the frozen MemoryOSHistoryVerification, branded by this module.
export function verifyHistoryLedger(input) {
  const { descriptorBytes, entries, members } = requireObject(input, ["descriptorBytes", "entries", "members"]);
  requireMemberMap(members);
  const chain = verifyChain(descriptorBytes, entries);
  const verification = validateVerification(buildVerification(chain, members));
  const ledger = deepFreeze(verification);
  ledgerStates.set(ledger, deepFreeze({ ...chain, descriptor: chain.descriptor, readinessMembers: readinessMembersOf(chain, members) }));
  return ledger;
}

export const isVerifiedHistoryLedger = (value) => ledgerStates.has(value);

function stateOf(ledger) {
  const state = ledgerStates.get(ledger);
  if (state === undefined) historyFail("USAGE", "USAGE");
  return state;
}

// The parsed, frozen MemoryOSHistoryEntry values of a verified ledger (public Freeze shape).
export function historyLedgerEntries(ledger) {
  return stateOf(ledger).entries;
}

// What admission needs from a verified ledger (Amendment A4.1): its Workspace, its entries, and the retained bytes of
// its READINESS_RESULT records, keyed by recordDigest. Plain data, so admission stays independent of this module.
export function historyLedgerView(ledger) {
  const state = stateOf(ledger);
  return Object.freeze({ workspaceIdentifier: state.descriptor.workspaceIdentifier, entries: state.entries, members: state.readinessMembers });
}

// ---- Append and tombstone entry construction (Freeze §8.2, §10.1) ----

function sealEntry(state, fields) {
  if (state.entries.length >= LIMITS.entriesPerLedger) historyFail("RESOURCE_LIMIT", "PUBLICATION");
  const entry = {
    kind: KINDS.entry,
    version: VERSION,
    ledgerIdentifier: state.ledgerIdentifier,
    index: state.entries.length,
    previousEntryDigest: state.headDigest,
    entryType: fields.entryType,
    record: fields.record,
    tombstone: fields.tombstone,
  };
  entry.entryDigest = entryDigestOf(entry);
  const entryBytes = utf8Encode(canonicalize(entry));
  if (entryBytes.byteLength > LIMITS.entryBytes) historyFail("RESOURCE_LIMIT", "PUBLICATION");
  return Object.freeze({ entryBytes, entryDigest: entry.entryDigest, index: entry.index });
}

// `admission` is the closed `record` object of a RECORD entry, as issued by the admission
// authority. This module re-validates its shape, member rules, record digest and ledger rules.
export function appendHistoryEntry(input) {
  const { ledger, admission } = requireObject(input, ["ledger", "admission"]);
  const state = stateOf(ledger);
  // Amendment A11: the entry-count limit comes before any shape check. The would-be entry of a full ledger has index 100000, which the entry shape
  // check below rejects, so the limit must be tested first for the refusal to be RESOURCE_LIMIT (Freeze section 14.2) and not RECORD_INVALID.
  if (state.entries.length >= LIMITS.entriesPerLedger) historyFail("RESOURCE_LIMIT", "PUBLICATION");
  const invalid = () => historyFail("RECORD_INVALID", "ADMISSION");
  if (admission === null || typeof admission !== "object" || Array.isArray(admission)) invalid();
  let parsed;
  try {
    parsed = JSON.parse(canonicalize({
      kind: KINDS.entry, version: VERSION, ledgerIdentifier: state.ledgerIdentifier, index: state.entries.length,
      previousEntryDigest: state.headDigest, entryType: "RECORD", record: admission, tombstone: null,
      entryDigest: state.headDigest, // placeholder digest; only the shape of `record` is checked here
    }));
  } catch {
    return invalid();
  }
  validateEntry(parsed, { code: "RECORD_INVALID", stage: "ADMISSION" });
  const record = parsed.record; // from here on only the canonical copy is used
  if (record.recordDigest !== recordDigestOf(record.recordKind, record.members)) invalid();
  for (const subject of record.subjects) {
    if (subject.type === "WORKSPACE" && subject.value !== state.descriptor.workspaceIdentifier) {
      historyFail("WORKSPACE_MISMATCH", "ADMISSION");
    }
  }
  if (record.recordKind === "HUMAN_DECISION_CLAIM") {
    // Amendment A4.1: a claim is stored only against a retained READINESS_RESULT entry carrying its three digests; the
    // stored decisionConsistency was computed by admission from that result's verified bytes and is never guessed here.
    const subject = (type) => record.subjects.find((candidate) => candidate.type === type)?.value;
    const bound = state.entries.some((entry) => entry.entryType === "RECORD" && entry.record.recordKind === "READINESS_RESULT"
      && !state.tombstoneIndexByTarget.has(entry.index)
      && ["PROOF_BINDING_DIGEST", "READINESS_CANDIDATE_DIGEST", "READINESS_DIGEST"].every((type) => (
        entry.record.subjects.find((candidate) => candidate.type === type)?.value === subject(type))));
    if (!bound) historyFail("DECISION_UNBOUND", "ADMISSION");
  }
  const existing = state.recordIndexByKey.get(recordKey(record.recordKind, record.recordDigest));
  if (existing !== undefined) {
    historyFail(state.tombstoneIndexByTarget.has(existing) ? "RECORD_PURGED" : "RECORD_DUPLICATE", "ADMISSION");
  }
  return sealEntry(state, { entryType: "RECORD", record, tombstone: null });
}

export function tombstoneHistoryEntry(input) {
  const { ledger, targetIndex, reason, authorityReference } = requireObject(input,
    ["ledger", "targetIndex", "reason", "authorityReference"]);
  const state = stateOf(ledger);
  if (!Number.isSafeInteger(targetIndex) || targetIndex < 0 || targetIndex > LIMITS.maximumIndex
      || !TOMBSTONE_REASONS.includes(reason) || !isAuthorityReference(authorityReference)) historyFail("USAGE", "USAGE");
  const target = state.entries[targetIndex];
  if (target === undefined || target.entryType !== "RECORD" || state.tombstoneIndexByTarget.has(targetIndex)) {
    historyFail("TOMBSTONE_INVALID", "ADMISSION");
  }
  return sealEntry(state, {
    entryType: "TOMBSTONE",
    record: null,
    tombstone: {
      targetIndex,
      targetEntryDigest: target.entryDigest,
      targetRecordDigest: target.record.recordDigest,
      reason,
      authorityReference,
      authenticity: TOMBSTONE_AUTHENTICITY,
    },
  });
}

// ---- Query (Freeze §11.2) ----

export function queryHistoryLedger(input) {
  const { descriptorBytes, entries: entryBytesList, query } = requireObject(input, ["descriptorBytes", "entries", "query"]);
  requireBytes(descriptorBytes);
  requireByteList(entryBytesList);
  validateQuery(query);
  const chain = verifyChain(descriptorBytes, entryBytesList);
  const { entries, tombstoneIndexByTarget } = chain;

  const targetOf = (entry) => (entry.entryType === "RECORD" ? entry : entries[entry.tombstone.targetIndex]);
  const retentionOf = (entry) => (entry.entryType === "RECORD" ? (tombstoneIndexByTarget.has(entry.index) ? "PURGED" : "RETAINED") : null);
  const matches = (entry) => {
    const target = targetOf(entry); // tombstones match on their target's kind, subjects and (purged) retention
    if (query.recordKinds.length > 0 && !query.recordKinds.includes(target.record.recordKind)) return false;
    if (query.subject !== null && !target.record.subjects.some((subject) => subject.type === query.subject.type && subject.value === query.subject.value)) return false;
    const purged = entry.entryType === "TOMBSTONE" || tombstoneIndexByTarget.has(entry.index);
    return query.retention === "ANY" || (query.retention === "PURGED") === purged;
  };

  const page = [];
  let nextIndex = null;
  for (let index = query.fromIndex; index < entries.length; index += 1) {
    if (!matches(entries[index])) continue;
    if (page.length === query.limit) {
      nextIndex = index;
      break;
    }
    page.push(entries[index]);
  }

  const resultEntries = page.map((entry) => {
    if (entry.entryType === "TOMBSTONE") {
      return {
        index: entry.index, entryDigest: entry.entryDigest, entryType: "TOMBSTONE", recordKind: null, recordDigest: null,
        admission: null, workspaceAssociation: null, subjects: [], retention: null, tombstoneIndex: null, decisionConsistency: null,
      };
    }
    const { record } = entry;
    return {
      index: entry.index, entryDigest: entry.entryDigest, entryType: "RECORD", recordKind: record.recordKind,
      recordDigest: record.recordDigest, admission: record.admission, workspaceAssociation: record.workspaceAssociation,
      subjects: record.subjects.map((subject) => ({ type: subject.type, value: subject.value })),
      retention: retentionOf(entry), tombstoneIndex: tombstoneIndexByTarget.get(entry.index) ?? null,
      decisionConsistency: record.decisionConsistency, // stored at admission (Amendment A4.1), never recomputed
    };
  });
  return deepFreeze(validateQueryResult({
    kind: KINDS.queryResult,
    version: VERSION,
    ledgerIdentifier: chain.ledgerIdentifier,
    workspaceIdentifier: chain.descriptor.workspaceIdentifier,
    entryCount: entries.length,
    headDigest: chain.headDigest,
    query: JSON.parse(canonicalize(query)),
    entries: resultEntries,
    nextIndex,
  }));
}

// ---- Export model (Freeze §12) ----

export function buildHistoryExport(input) {
  const { descriptorBytes, entries: entryBytesList, members } = requireObject(input, ["descriptorBytes", "entries", "members"]);
  requireMemberMap(members);
  const chain = verifyChain(descriptorBytes, entryBytesList);
  buildVerification(chain, members); // fails closed on any member defect

  const files = [{ path: LAYOUT.descriptor, bytes: copyBytes(descriptorBytes) }];
  entryBytesList.forEach((bytes, index) => files.push({ path: entryFileName(index), bytes: copyBytes(bytes) }));
  for (const entry of chain.entries) {
    if (entry.entryType !== "RECORD" || chain.tombstoneIndexByTarget.has(entry.index)) continue; // purged: no member bytes
    const hex = entry.record.recordDigest.slice("sha256:".length);
    for (const member of members.get(entry.record.recordDigest)) {
      files.push({ path: `${LAYOUT.recordsDirectory}/${hex}/${member.name}`, bytes: copyBytes(member.bytes) });
    }
  }
  files.sort((left, right) => (before(left.path, right.path) ? -1 : 1));
  const manifest = {
    kind: KINDS.exportManifest,
    version: VERSION,
    ledgerIdentifier: chain.ledgerIdentifier,
    workspaceIdentifier: chain.descriptor.workspaceIdentifier,
    entryCount: chain.entries.length,
    headDigest: chain.headDigest,
    files: files.map((file) => ({ path: file.path, byteLength: file.bytes.byteLength, sha256: digestOfBytes(file.bytes) })),
  };
  validateExportManifest(manifest);
  const manifestBytes = utf8Encode(canonicalize(manifest));
  const marker = { kind: KINDS.exportComplete, version: VERSION, manifestSha256: digestOfBytes(manifestBytes) };
  const result = [...files, { path: LAYOUT.exportManifest, bytes: manifestBytes },
    { path: LAYOUT.exportComplete, bytes: utf8Encode(canonicalize(marker)) }];
  result.sort((left, right) => (before(left.path, right.path) ? -1 : 1));
  return Object.freeze({ files: Object.freeze(result.map((file) => Object.freeze(file))) });
}

// Export failures about the manifest, marker, file set or file digests are EXPORT_CORRUPT;
// ledger-content failures keep their section 11.1 code.
export function verifyHistoryExport(input) {
  const { files } = requireObject(input, ["files"]);
  if (!Array.isArray(files)) historyFail("USAGE", "USAGE");
  const byPath = new Map();
  for (const file of files) {
    requireObject(file, ["path", "bytes"]);
    if (typeof file.path !== "string") historyFail("USAGE", "USAGE");
    requireBytes(file.bytes);
    if (byPath.has(file.path)) historyFail("EXPORT_CORRUPT", "VERIFICATION");
    byPath.set(file.path, file.bytes);
  }
  const corrupt = () => historyFail("EXPORT_CORRUPT", "VERIFICATION");
  const manifestBytes = byPath.get(LAYOUT.exportManifest);
  const markerBytes = byPath.get(LAYOUT.exportComplete);
  if (manifestBytes === undefined || markerBytes === undefined) corrupt();
  const marker = validateExportComplete(decodeHistoryBytes(markerBytes, { maxBytes: 1024, code: "EXPORT_CORRUPT" }));
  if (marker.manifestSha256 !== digestOfBytes(manifestBytes)) corrupt();
  const manifest = validateExportManifest(decodeHistoryBytes(manifestBytes, { maxBytes: 64 * 1024 * 1024, code: "EXPORT_CORRUPT" }));

  const listed = new Set(manifest.files.map((file) => file.path));
  const expectedCount = manifest.files.length + 2;
  if (byPath.size !== expectedCount || listed.size !== manifest.files.length) corrupt();
  for (const file of manifest.files) {
    const bytes = byPath.get(file.path);
    if (bytes === undefined || bytes.byteLength !== file.byteLength || digestOfBytes(bytes) !== file.sha256) corrupt();
  }

  const descriptorBytes = byPath.get(LAYOUT.descriptor);
  if (descriptorBytes === undefined) corrupt();
  const entryPaths = manifest.files.filter((file) => file.path.startsWith(`${LAYOUT.entriesDirectory}/`)).map((file) => file.path);
  const entryBytesList = entryPaths.map((path) => byPath.get(path));
  if (entryPaths.some((path, index) => path !== entryFileName(index))) corrupt(); // contiguous from 0, no gap or extra file
  const members = new Map();
  for (const file of manifest.files) {
    if (!file.path.startsWith(`${LAYOUT.recordsDirectory}/`)) continue;
    const [, hex, name] = file.path.split("/");
    if (!HEX64.test(hex)) corrupt();
    const key = `sha256:${hex}`;
    if (!members.has(key)) members.set(key, []);
    members.get(key).push({ name, bytes: byPath.get(file.path) });
  }
  const chain = verifyChain(descriptorBytes, entryBytesList);
  const verification = validateVerification(buildVerification(chain, members));
  if (verification.unreferencedRecords.length > 0 || verification.purgePending.length > 0
      || verification.ledgerIdentifier !== manifest.ledgerIdentifier
      || verification.workspaceIdentifier !== manifest.workspaceIdentifier
      || verification.entryCount !== manifest.entryCount || verification.headDigest !== manifest.headDigest) corrupt();
  return deepFreeze(verification);
}
