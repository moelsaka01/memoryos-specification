// MO-1309 Phase 2D: a synthetic MO-1308 export of N entries, built with the ledger's own identity primitives and exported by
// MO-1308's `buildHistoryExport`, then accepted by `verifyHistoryExport` before it is written. It is NOT an export produced by
// the released CLI (the released exporter needs about 16 minutes for 100,000 entries, MO-1308 Q11, and 100,000 CLI appends are
// slower still); it has the same file layout, entry shape and member sizes as a CLI export of POLICY_EVALUATION records,
// with one tombstone (and its purge) in every twenty entries. Deterministic: the same N gives the same bytes.
// Usage: node scripts/memoryos-dashboard-perf-corpus.mjs <entries> <output-directory>   (the directory must not exist)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonicalize, sha256Hex, utf8Encode } from "../web/js/mip-canonical.js";
import { ADMISSION_BY_KIND, MEMORYOS_HISTORY_KINDS, MEMORYOS_HISTORY_LIMITS, MEMORYOS_HISTORY_VERSION, WORKSPACE_ASSOCIATION_BY_KIND } from "../web/js/memoryos-history-contract.js";
import { buildHistoryExport, createHistoryLedger, entryDigestOf, genesisDigestOf, recordDigestOf, verifyHistoryExport } from "../web/js/memoryos-history-ledger.js";

export const CORPUS_WORKSPACE = "workspace-perf-corpus";
const digestOf = (text) => `sha256:${sha256Hex(text)}`;

// Member bytes of record i: JSON text padded to a realistic length (about 1.1 KB and 2.0 KB, as in a CLI export).
function memberBytes(index, name, target) {
  const head = canonicalize({ corpus: "mo1309-perf", index, member: name });
  return utf8Encode(`${head}${"0123456789abcdef".repeat(Math.ceil(target / 16))}`.slice(0, target));
}

export function buildCorpusExport(entryCount) {
  if (!Number.isSafeInteger(entryCount) || entryCount < 0 || entryCount > MEMORYOS_HISTORY_LIMITS.entriesPerLedger) throw new RangeError("entry count");
  const ledger = createHistoryLedger({ ledgerName: "workspace.history", workspaceIdentifier: CORPUS_WORKSPACE });
  const entries = [];
  const members = new Map();
  const recordDigests = [];
  let previous = genesisDigestOf(ledger.ledgerIdentifier);
  for (let index = 0; index < entryCount; index += 1) {
    const tombstoneTarget = index % 20 === 19 ? index - 10 : null;
    const base = { kind: MEMORYOS_HISTORY_KINDS.entry, version: MEMORYOS_HISTORY_VERSION, ledgerIdentifier: ledger.ledgerIdentifier, index, previousEntryDigest: previous };
    let entry;
    if (tombstoneTarget === null) {
      const files = [{ name: "evaluation-identity.json", bytes: memberBytes(index, "evaluation-identity.json", 1062) },
        { name: "policy-outcome.json", bytes: memberBytes(index, "policy-outcome.json", 1963) }];
      const memberList = files.map((f) => ({ name: f.name, byteLength: f.bytes.byteLength, sha256: digestOf(f.bytes) }));
      const recordDigest = recordDigestOf("POLICY_EVALUATION", memberList);
      recordDigests.push(recordDigest);
      members.set(recordDigest, files);
      entry = { ...base, entryType: "RECORD", tombstone: null, record: {
        recordKind: "POLICY_EVALUATION", recordDigest, admission: ADMISSION_BY_KIND.POLICY_EVALUATION, members: memberList,
        workspaceAssociation: WORKSPACE_ASSOCIATION_BY_KIND.POLICY_EVALUATION, decisionConsistency: null,
        subjects: [{ type: "EVALUATION_IDENTITY_DIGEST", value: digestOf(`identity:${index}`) }, { type: "OUTCOME_DIGEST", value: digestOf(`outcome:${index}`) }],
      } };
    } else {
      const target = entries[tombstoneTarget];
      members.delete(target.record.recordDigest); // purged: no member bytes are retained
      entry = { ...base, entryType: "TOMBSTONE", record: null, tombstone: {
        targetIndex: tombstoneTarget, targetEntryDigest: target.entryDigest, targetRecordDigest: target.record.recordDigest,
        reason: "PRIVACY_REQUEST", authorityReference: `PERF-${String(index).padStart(6, "0")}`, authenticity: "NOT_VERIFIED_BY_MEMORYOS",
      } };
    }
    entry.entryDigest = entryDigestOf(entry);
    previous = entry.entryDigest;
    entries.push(entry);
  }
  const files = buildHistoryExport({ descriptorBytes: ledger.descriptorBytes, entries: entries.map((e) => utf8Encode(canonicalize(e))), members });
  verifyHistoryExport({ files: files.files }); // the product's own verifier accepts the corpus
  return files.files;
}

export function writeCorpus(entryCount, directory) {
  if (fs.existsSync(directory)) throw new Error("output directory exists");
  const files = buildCorpusExport(entryCount);
  for (const file of files) {
    const target = path.join(directory, ...file.path.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.bytes, { flag: "wx" });
  }
  return { files: files.length, bytes: files.reduce((sum, f) => sum + f.bytes.byteLength, 0) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [count, directory] = process.argv.slice(2);
  const result = writeCorpus(Number(count), path.resolve(directory));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
export const here = path.dirname(fileURLToPath(import.meta.url));
