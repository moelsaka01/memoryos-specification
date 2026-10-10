// MO-1309 Cloud Dashboard generator (Contract Freeze 1, Phase 2B, sections 4.3, 5, 9.4, 11 and 13).
// Usage: node scripts/memoryos-dashboard-generator.mjs <export-directory> <output-file>
// Reads one MO-1308 MemoryOSHistoryExport directory ONCE into memory, verifies those bytes with verifyHistoryExport (through
// buildDashboardViewModel), and writes one self-contained HTML snapshot. It opens no socket, resolves no name, never parses or
// embeds retained member contents, and never reads the export directory again after the single read.
// Failure prints one line on standard error whose first token is the dashboard code; nothing partial is ever left behind.
import nodeFs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MEMORYOS_HISTORY_LAYOUT, MEMORYOS_HISTORY_LIMITS, RECORD_MEMBER_RULES } from "../web/js/memoryos-history-contract.js";
import { DASHBOARD_ERRORS, DashboardError } from "../web/js/memoryos-dashboard-contract.js";
import { buildDashboardViewModel } from "../web/js/memoryos-dashboard-viewmodel.js";
import { DASHBOARD_GENERATOR_VERSION, assembleSnapshot } from "../web/js/memoryos-dashboard-snapshot.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PAGE_SOURCE_DIRECTORY = path.join(here, "..", "web", "dashboard");

// ---- Bounds (imported limits only; Freeze section 12) ----
const MARKER_BYTES = 1024;
const MANIFEST_BYTES = 64 * 1024 * 1024; // the bound MO-1308 verification itself applies to the manifest
const memberBound = (name) => Math.max(0, ...Object.values(RECORD_MEMBER_RULES).filter((rule) => rule.memberSets.some((set) => set.includes(name))).map((rule) => rule.memberBytes));
const ENTRY_FILE = /^entries\/\d{20}\.json$/u;
const RECORD_FILE = /^records\/[0-9a-f]{64}\/([^/]+)$/u;

function boundFor(relativePath) {
  if (relativePath === MEMORYOS_HISTORY_LAYOUT.descriptor) return MEMORYOS_HISTORY_LIMITS.descriptorBytes;
  if (relativePath === MEMORYOS_HISTORY_LAYOUT.exportComplete) return MARKER_BYTES;
  if (relativePath === MEMORYOS_HISTORY_LAYOUT.exportManifest) return MANIFEST_BYTES;
  if (ENTRY_FILE.test(relativePath)) return MEMORYOS_HISTORY_LIMITS.entryBytes;
  const record = RECORD_FILE.exec(relativePath);
  if (record) { const bound = memberBound(record[1]); return bound > 0 ? bound : null; }
  return null; // a path the export layout does not define
}

const byteOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // bytewise on the (ASCII) names; never locale-dependent

// Reads every file of the export exactly once. `fs` is injectable so tests can count reads and swap the directory after the read.
// Pass 1 lists the tree (lstat only, bytewise order) and checks the imported limits; pass 2 reads each listed file once.
export function readExportDirectory(directory, fs = nodeFs) {
  const unreadable = () => new DashboardError("DASH_EXPORT_UNREADABLE");
  const listed = [];
  let entryFiles = 0;
  const lstat = (target) => { try { return fs.lstatSync(target); } catch { throw unreadable(); } };
  const root = lstat(directory);
  if (!root.isDirectory()) throw unreadable(); // a symbolic link, junction or file is refused, never followed

  const walk = (absolute, relative) => {
    let names;
    try { names = fs.readdirSync(absolute); } catch { throw unreadable(); }
    names.sort(byteOrder);
    for (const name of names) {
      const childAbsolute = path.join(absolute, name);
      const childRelative = relative === "" ? name : `${relative}/${name}`;
      const stat = lstat(childAbsolute);
      if (stat.isDirectory()) { walk(childAbsolute, childRelative); continue; }
      if (!stat.isFile()) throw unreadable(); // symbolic link, junction, device, socket, fifo
      if (ENTRY_FILE.test(childRelative)) {
        entryFiles += 1;
        if (entryFiles > MEMORYOS_HISTORY_LIMITS.entriesPerLedger) throw new DashboardError("DASH_LIMIT_EXCEEDED");
      }
      const bound = boundFor(childRelative);
      if (bound === null || stat.size > bound) throw unreadable(); // unknown path or oversize file
      listed.push({ absolute: childAbsolute, relative: childRelative, stat });
    }
  };
  walk(directory, "");
  return { files: listed.map(({ absolute, relative, stat }) => ({ path: relative, bytes: readOnce(absolute, stat, fs) })) };
}

function readOnce(absolute, stat, fs) {
  let descriptor;
  try {
    descriptor = fs.openSync(absolute, "r");
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.size !== stat.size || (stat.ino !== 0 && opened.ino !== stat.ino) || opened.dev !== stat.dev) throw new Error("changed");
    const bytes = new Uint8Array(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(descriptor, bytes, offset, bytes.length - offset, null);
      if (count === 0) throw new Error("short");
      offset += count;
    }
    if (fs.readSync(descriptor, new Uint8Array(1), 0, 1, null) !== 0) throw new Error("grew"); // the file grew while being read
    return bytes;
  } catch {
    throw new DashboardError("DASH_EXPORT_UNREADABLE");
  } finally {
    if (descriptor !== undefined) { try { fs.closeSync(descriptor); } catch { /* nothing to recover */ } }
  }
}

export function loadPageSources(directory = DEFAULT_PAGE_SOURCE_DIRECTORY, fs = nodeFs) {
  try {
    const read = (name) => fs.readFileSync(path.join(directory, name), "utf8");
    return { template: read("page.html"), style: read("page.css"), script: read("page.js") };
  } catch {
    throw new DashboardError("DASH_IO_FAILURE");
  }
}

// Exclusive staging then a non-replacing hard link: a partial file never appears under the final name and an existing file is
// never overwritten. A failed exclusive create is a typed IO failure and is not retried (modelled on MO-1308 A6).
export function publishExclusively(outputFile, bytes, fs = nodeFs) {
  const directory = path.dirname(outputFile);
  const staging = path.join(directory, `.${path.basename(outputFile)}.staging-${process.pid}`);
  let created = false;
  try {
    let descriptor;
    try { descriptor = fs.openSync(staging, "wx", 0o644); created = true; } catch { throw new DashboardError("DASH_IO_FAILURE"); }
    try {
      let offset = 0;
      while (offset < bytes.length) offset += fs.writeSync(descriptor, bytes, offset, bytes.length - offset);
      fs.fsyncSync(descriptor);
    } catch { throw new DashboardError("DASH_IO_FAILURE"); } finally { try { fs.closeSync(descriptor); } catch { /* reported by the write above */ } }
    try { fs.linkSync(staging, outputFile); } catch (error) { throw new DashboardError(error?.code === "EEXIST" ? "DASH_OUTPUT_EXISTS" : "DASH_IO_FAILURE"); }
  } finally {
    if (created) { try { fs.unlinkSync(staging); } catch { /* the final name, if published, is a separate link */ } }
  }
}

// The whole job. Returns { digest }. Throws DashboardError only.
export function generateSnapshot({ exportDirectory, outputFile, sources = null, fs = nodeFs, generatorVersion }) {
  if (typeof exportDirectory !== "string" || typeof outputFile !== "string" || exportDirectory === "" || outputFile === "") throw new DashboardError("DASH_USAGE");
  let existing = null;
  try { existing = fs.lstatSync(outputFile); } catch { /* absent is the normal case */ }
  if (existing !== null) throw new DashboardError("DASH_OUTPUT_EXISTS");
  const input = readExportDirectory(exportDirectory, fs); // the only read of the export
  const viewModel = buildDashboardViewModel(input); // MO-1308 verification over the in-memory bytes; throws before anything is written
  const result = assembleSnapshot({ viewModel, sources: sources ?? loadPageSources(DEFAULT_PAGE_SOURCE_DIRECTORY, fs), ...(generatorVersion ? { generatorVersion } : {}) });
  publishExclusively(outputFile, result.bytes, fs);
  return { digest: result.digest };
}

// The command line. The first token of the single standard-error line is the code (Freeze section 13).
export function main(argv, { stdout = process.stdout, stderr = process.stderr, ...options } = {}) {
  try {
    if (argv.length !== 2) throw new DashboardError("DASH_USAGE");
    const { digest } = generateSnapshot({ exportDirectory: argv[0], outputFile: argv[1], ...options });
    stdout.write(`snapshot ${digest}\n`);
    return 0;
  } catch (error) {
    const known = error instanceof DashboardError ? error : new DashboardError("DASH_IO_FAILURE");
    const message = Object.hasOwn(DASHBOARD_ERRORS, known.code) ? DASHBOARD_ERRORS[known.code].message : "";
    stderr.write(`${known.code}${known.historyCode ? ` ${known.historyCode}` : ""} ${message}\n`);
    return known.code === "DASH_USAGE" ? 2 : 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
export { DASHBOARD_GENERATOR_VERSION };
