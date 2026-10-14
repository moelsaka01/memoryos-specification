// MemoryOS 1.3.1: the export layout path classes and byte bounds that the MO-1309 generator applies before it reads a file, as
// one browser-safe definition. The generator (Node) and the Studio History screen (browser) import it; neither redefines it.
// Pure: no filesystem, network, clock or DOM. The bounds are the imported MO-1308 limits (MO-1309 Freeze section 12).
import { MEMORYOS_HISTORY_LAYOUT, MEMORYOS_HISTORY_LIMITS, RECORD_MEMBER_RULES } from "./memoryos-history-contract.js";

export const MARKER_BYTES = 1024;
export const MANIFEST_BYTES = 64 * 1024 * 1024; // the bound MO-1308 verification itself applies to the manifest
export const ENTRY_FILE = /^entries\/\d{20}\.json$/u;
export const RECORD_FILE = /^records\/[0-9a-f]{64}\/([^/]+)$/u;

const memberBound = (name) => Math.max(0, ...Object.values(RECORD_MEMBER_RULES).filter((rule) => rule.memberSets.some((set) => set.includes(name))).map((rule) => rule.memberBytes));

// The byte bound of a relative export path, or null for a path the export layout does not define.
export function boundFor(relativePath) {
  if (relativePath === MEMORYOS_HISTORY_LAYOUT.descriptor) return MEMORYOS_HISTORY_LIMITS.descriptorBytes;
  if (relativePath === MEMORYOS_HISTORY_LAYOUT.exportComplete) return MARKER_BYTES;
  if (relativePath === MEMORYOS_HISTORY_LAYOUT.exportManifest) return MANIFEST_BYTES;
  if (ENTRY_FILE.test(relativePath)) return MEMORYOS_HISTORY_LIMITS.entryBytes;
  const record = RECORD_FILE.exec(relativePath);
  if (record) { const bound = memberBound(record[1]); return bound > 0 ? bound : null; }
  return null;
}

export const isEntryFile = (relativePath) => ENTRY_FILE.test(relativePath);
export const ENTRY_LIMIT = MEMORYOS_HISTORY_LIMITS.entriesPerLedger;

// Bytewise ordering of (ASCII) names; never locale-dependent.
export const byteOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
