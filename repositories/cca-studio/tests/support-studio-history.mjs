// MemoryOS 1.3.1 test support: the inputs of the generator differential (every MO-1309 fixture and a deterministic corpus), the
// generator-output digest of an input, and helpers that read an export directory the way a browser would hand it to Studio.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { writeCorpus } from "../scripts/memoryos-dashboard-perf-corpus.mjs";
import { FIXTURE_NAMES, FIXTURE_ROOT } from "./support-dashboard-fixtures.mjs";

export const STUDIO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const GOLDEN_PATH = path.join(STUDIO_ROOT, "tests", "fixtures", "studio-history", "generator-golden.json");
export const CORPUS_SIZES = Object.freeze([50, 1000]);
export const BASELINE_COMMIT = "889f99e72a5d41c242572cc052ab97b07cc10a24"; // tag v1.3.0

export const fixtureExportDirectory = (name) => path.join(FIXTURE_ROOT, name, "export");

// Every input of the differential: [id, export directory]. Corpus exports are written under `scratchRoot`.
export function differentialInputs(scratchRoot) {
  const inputs = FIXTURE_NAMES.map((name) => [`fixture:${name}`, fixtureExportDirectory(name)]);
  for (const size of CORPUS_SIZES) {
    const directory = path.join(scratchRoot, `corpus-${size}`);
    writeCorpus(size, directory);
    inputs.push([`corpus:${size}`, directory]);
  }
  return inputs;
}

export const makeScratch = (label) => fs.mkdtempSync(path.join(os.tmpdir(), `sh-${label}-`));
export const sha256Hex = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

// Walks an export directory in bytewise order: [{ path, bytes }].
export function listExport(directory) {
  const out = [];
  const walk = (current, prefix) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = path.join(current, entry.name);
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(full, rel); else out.push({ path: rel, bytes: new Uint8Array(fs.readFileSync(full)) });
    }
  };
  walk(directory, "");
  return out;
}

// A tampered copy of a fixture export, as an in-memory file list. Each variant breaks exactly one MO-1308 defence.
export function tamperVariants(files) {
  const flip = (p, at) => files.map((f) => (f.path === p ? { path: p, bytes: Uint8Array.from(f.bytes, (v, i) => (i === at ? v ^ 1 : v)) } : f));
  const entries = files.filter((f) => f.path.startsWith("entries/")).map((f) => f.path).sort();
  const member = files.find((f) => f.path.startsWith("records/")).path;
  return {
    chain: flip(entries[3], 40),
    member: flip(member, 0),
    manifest: flip("memoryos-history-export.json", 30),
    marker: flip("memoryos-history-export-complete.json", 30),
    truncatedTail: files.filter((f) => f.path !== entries.at(-1)),
  };
}

// ---- Closure classification (SH19, SH20, SH21): pure, so a negative control can feed it samples ----
export const NATIVE_SOURCE = /\.(c|cc|cpp|cxx|c\+\+|h|hh|hpp|hxx|h\+\+|inl|ipp|ixx|cppm|mm|m)$/iu;
export const NATIVE_BUILD = /(^|\/)(CMakeLists\.txt|CMakePresets\.json|CMakeUserPresets\.json|vcpkg\.json|vcpkg-configuration\.json|conanfile\.(txt|py)|Makefile|meson\.build)$|\.cmake$|^cmake\//iu;
export const DEPENDENCY_FILE = /(^|\/)(package\.json|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|requirements[^/]*\.txt|Pipfile(\.lock)?|pyproject\.toml|go\.(mod|sum)|Cargo\.(toml|lock))$/iu;
export const isNativePath = (file) => NATIVE_SOURCE.test(file) || NATIVE_BUILD.test(file);
export const isDependencyPath = (file) => DEPENDENCY_FILE.test(file);
