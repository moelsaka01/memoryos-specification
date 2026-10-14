// MO-1309 Phase 1 test support: loads the checked-in fixtures (real exports produced by the released MO-1308 CLI).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "memoryos-dashboard", "1.0.0");
export const FIXTURE_NAMES = Object.freeze(["adversarial-wording", "all-kinds-tombstoned", "claims-only", "empty", "single-entry"]);

export function readExportFiles(name) {
  const root = path.join(FIXTURE_ROOT, name, "export");
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push({ path: path.relative(root, full).split(path.sep).join("/"), bytes: new Uint8Array(fs.readFileSync(full)) });
    }
  };
  walk(root);
  return files;
}

export const readPinnedViewModelBytes = (name) => new Uint8Array(fs.readFileSync(path.join(FIXTURE_ROOT, name, "view-model.json")));
