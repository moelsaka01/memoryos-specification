// MemoryOS 1.3.1 conformance inventory: builds (and checks) mo1310-conformance-inventory.json from the Freeze requirement table
// (docs/mo1310-studio-history-1.3.1.md section 14), the certification campaign table (section 15) and the SH-tagged titles of the
// manifest's test files. Pure over files; read-only on `check`.
//   node tools/mo1310/inventory.mjs build > mo1310-conformance-inventory.json
//   node tools/mo1310/inventory.mjs check          (exit 1 when the committed inventory differs from the rebuilt one)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REPO, sha256 } from "../mo1309/run-tests.mjs";
import { MANIFEST, readManifest } from "./run-tests.mjs";

export const INVENTORY = path.join(REPO, "repositories", "cca-conformance", "mo1310-conformance-inventory.json");
export const FREEZE = path.join(REPO, "docs", "mo1310-studio-history-1.3.1.md");
export const ALL_IDS = Object.freeze(Array.from({ length: 24 }, (_, i) => `SH${String(i + 1).padStart(2, "0")}`));

export function expandList(text) {
  const out = [];
  for (const part of text.replace(/SH/gu, "").split(",").map((p) => p.trim()).filter(Boolean)) {
    const range = /^(\d+)[–-](\d+)$/u.exec(part);
    if (range) for (let n = Number(range[1]); n <= Number(range[2]); n += 1) out.push(n);
    else out.push(Number(part));
  }
  return out.map((n) => `SH${String(n).padStart(2, "0")}`);
}

export function parseRequirements(freezeText) {
  const rows = [];
  for (const line of freezeText.split("\n")) {
    const match = /^\| (SH\d\d) \| (.*) \| ([^|]*) \| ([^|]*) \|$/u.exec(line);
    if (match) rows.push({ id: match[1], text: match[2].trim(), phases: match[3].trim(), provenBy: match[4].trim() });
  }
  return rows;
}

// Section 15's campaign table: one row per family; the cases are the SH-x ids, the last cell lists the requirements.
export function parseCampaign(freezeText) {
  const families = {};
  for (const line of freezeText.split("\n")) {
    const match = /^\| (End to end|Security and wording|Closure) \|(.*)\| ([^|]*) \|$/u.exec(line);
    if (match) families[match[1]] = { cases: [...match[2].matchAll(/(SH-[ESC]\d+)/gu)].map((m) => m[1]), requirements: expandList(match[3]) };
  }
  return families;
}

// SH-tagged test titles of the manifest's files (single-line `test("...")` titles).
export function taggedTitles(manifest) {
  const byId = new Map(ALL_IDS.map((id) => [id, []]));
  for (const suite of manifest.suites) {
    for (const file of suite.files ?? []) {
      const text = fs.readFileSync(path.join(REPO, suite.cwd, file), "utf8");
      for (const match of text.matchAll(/^test\(\s*(["'`])((?:(?!\1).)*)\1/gmu)) {
        for (const id of new Set(match[2].match(/SH\d\d/gu) ?? [])) byId.get(id)?.push({ suite: suite.id, file: `${suite.cwd}/${file}`, title: match[2] });
      }
    }
  }
  return byId;
}

// Requirements whose proof includes a recorded artefact in addition to tagged titles.
export const RECORDS = Object.freeze({
  SH23: "repositories/cca-conformance/tools/mo1310/validate.mjs; retained regression record rows with one log each",
  SH24: "repositories/cca-conformance/tools/mo1310/inventory.mjs check; repositories/cca-conformance/mo1310-conformance-inventory.json",
});

export function buildInventory() {
  const freezeText = fs.readFileSync(FREEZE, "utf8");
  const requirements = parseRequirements(freezeText);
  const families = parseCampaign(freezeText);
  const titles = taggedTitles(readManifest());
  const rows = ALL_IDS.map((id) => {
    const requirement = requirements.find((row) => row.id === id);
    const campaignFamilies = Object.entries(families).filter(([, family]) => family.requirements.includes(id)).map(([name]) => name);
    const cloud = titles.get(id);
    return JSON.parse(JSON.stringify({
      id, text: requirement.text, freezePhases: requirement.phases, freezeProvenBy: requirement.provenBy,
      cloud: { status: cloud.length > 0 || RECORDS[id] ? "COVERED" : "NONE", tests: cloud, records: RECORDS[id] ? RECORDS[id].split("; ") : [] },
      windows: { campaign: campaignFamilies.length > 0 ? "SH" : null, families: campaignFamilies, status: campaignFamilies.length > 0 ? "PENDING_WINDOWS" : "REGRESSION_ONLY", certifying: false },
    }));
  });
  return { kind: "MO1310ConformanceInventory", version: "1.0.0", requirementSource: { path: "docs/mo1310-studio-history-1.3.1.md", sha256: sha256(fs.readFileSync(FREEZE)) },
    manifest: { path: "repositories/cca-conformance/mo1310-test-manifest.json", sha256: sha256(fs.readFileSync(MANIFEST)) },
    status: "CLOUD_COVERAGE_ONLY_NOT_CERTIFIED", campaign: { id: "SH", families }, requirements: rows };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  const built = `${JSON.stringify(buildInventory(), null, 2)}\n`;
  if (mode === "build") process.stdout.write(built);
  else if (mode === "check") { const same = fs.readFileSync(INVENTORY, "utf8") === built; process.stdout.write(`${same ? "inventory current" : "inventory differs"}\n`); process.exitCode = same ? 0 : 1; }
  else { process.stderr.write("usage: build | check\n"); process.exitCode = 2; }
}
