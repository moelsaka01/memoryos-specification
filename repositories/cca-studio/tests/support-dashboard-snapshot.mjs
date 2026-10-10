// MO-1309 test support (Phase 3): snapshots for the page tests are the REAL generator's output, not a re-implementation.
// `assembleTestSnapshot` calls the production assembler (web/js/memoryos-dashboard-snapshot.js) over the production page sources;
// `generateFixtureSnapshot` runs the production generator end to end over a fixture export directory. The Phase 2A test assembler
// that mirrored Freeze section 5 by hand is gone (DB05/DB06 are therefore tested against the product's own bytes).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assembleSnapshot } from "../web/js/memoryos-dashboard-snapshot.js";
import { generateSnapshot, loadPageSources } from "../scripts/memoryos-dashboard-generator.mjs";
import { FIXTURE_ROOT } from "./support-dashboard-fixtures.mjs";

export const DASHBOARD_SOURCE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "dashboard");
export const readDashboardSource = (name) => fs.readFileSync(path.join(DASHBOARD_SOURCE_ROOT, name), "utf8");

const between = (html, open, close) => html.slice(html.lastIndexOf(open) + open.length, html.lastIndexOf(close));

export function assembleTestSnapshot({ viewModel, generatorVersion }) {
  const result = assembleSnapshot({ viewModel, sources: loadPageSources(), ...(generatorVersion ? { generatorVersion } : {}) });
  const { html, digest, csp } = result;
  return { html, csp, digest, script: between(html, "<script>", "</script>"), style: between(html, "<style>", "</style>"), blanked: html.replace(digest, "") };
}

export function generateFixtureSnapshot(name) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mo1309-fixture-snapshot-"));
  try {
    const outputFile = path.join(directory, "snapshot.html");
    const { digest } = generateSnapshot({ exportDirectory: path.join(FIXTURE_ROOT, name, "export"), outputFile });
    return { html: fs.readFileSync(outputFile, "utf8"), digest };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
