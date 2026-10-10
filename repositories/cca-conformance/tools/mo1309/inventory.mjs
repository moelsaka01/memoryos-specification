// MO-1309 conformance inventory: builds (and checks) mo1309-conformance-inventory.json from the Freeze requirement table (section 16),
// the Freeze campaign table (section 17) and the DB-tagged titles of the manifest's test files. Pure over files; read-only on `--check`.
//   node tools/mo1309/inventory.mjs build > mo1309-conformance-inventory.json
//   node tools/mo1309/inventory.mjs check          (exit 1 when the committed inventory differs from the rebuilt one)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REPO, readManifest, sha256 } from "./run-tests.mjs";

export const INVENTORY = path.join(REPO, "repositories", "cca-conformance", "mo1309-conformance-inventory.json");
const FREEZE = path.join(REPO, "docs", "mo1309-contract-freeze-1.md");
const ids = (count) => Array.from({ length: count }, (_, i) => `DB${String(i + 1).padStart(2, "0")}`);
export const ALL_IDS = ids(32);

export function expandList(text) {
  const out = [];
  for (const part of text.replace(/DB/gu, "").split(",").map((p) => p.trim()).filter(Boolean)) {
    const range = /^(\d+)[–-](\d+)$/u.exec(part);
    if (range) for (let n = Number(range[1]); n <= Number(range[2]); n += 1) out.push(n);
    else out.push(Number(part));
  }
  return out.map((n) => `DB${String(n).padStart(2, "0")}`);
}

export function parseRequirements(freezeText) {
  const rows = [];
  for (const line of freezeText.split("\n")) {
    const match = /^\| (DB\d\d) \| (.*) \| ([^|]*) \| ([^|]*) \|$/u.exec(line);
    if (match) rows.push({ id: match[1], text: match[2].trim(), phases: match[3].trim(), provenBy: match[4].trim() });
  }
  return rows;
}

export function parseCampaigns(freezeText) {
  const campaigns = {};
  for (const line of freezeText.split("\n")) {
    const match = /^\| \*\*(4[ABCD])\*\* [^|]*\|[^|]*\|(.*)\| ([^|]*) \|$/u.exec(line);
    if (match) campaigns[match[1]] = { cases: [...match[2].matchAll(/(4[ABCD]-[A-Z]\d+)/gu)].map((m) => m[1]), requirements: match[3].trim() === "all" ? ALL_IDS : expandList(match[3]) };
  }
  return campaigns;
}

// DB-tagged test titles of the manifest's files (single-line `test("...")` titles).
export function taggedTitles(manifest) {
  const byId = new Map(ALL_IDS.map((id) => [id, []]));
  for (const suite of manifest.suites) {
    for (const file of suite.files ?? []) {
      const full = path.join(REPO, suite.cwd, file);
      const text = fs.readFileSync(full, "utf8");
      for (const match of text.matchAll(/^test\(\s*(["'`])((?:(?!\1).)*)\1/gmu)) {
        for (const id of new Set(match[2].match(/DB\d\d/gu) ?? [])) byId.get(id)?.push({ suite: suite.id, file: `${suite.cwd}/${file}`, title: match[2] });
      }
    }
  }
  return byId;
}

// Requirements whose proof is a recorded artefact rather than a DB-tagged test title (listed here, each also has a tagged Phase 3 test).
export const RECORDS = Object.freeze({
  DB22: "docs/mo1309-phase2d-performance.md; docs/mo1309-phase3-cloud-report.json; docs/mo1309-phase2d-budgets.json",
  DB30: "repositories/cca-conformance/tools/mo1309/validate.mjs; retained regression record rows with one log each",
  DB32: "docs/mo1309-contract-freeze-1.md section 18; no export-performance work was done (audit: no MO-1308 byte changed)",
});

export function buildInventory() {
  const requirements = parseRequirements(fs.readFileSync(FREEZE, "utf8"));
  const campaigns = parseCampaigns(fs.readFileSync(FREEZE, "utf8"));
  const titles = taggedTitles(readManifest());
  const rows = ALL_IDS.map((id) => {
    const requirement = requirements.find((row) => row.id === id);
    const windowsCases = Object.entries(campaigns).filter(([, c]) => c.requirements.includes(id)).map(([name]) => name);
    const cloud = titles.get(id);
    const windowsOnly = requirement.phases.includes("4A") && cloud.length === 0 && !RECORDS[id];
    return {
      id, text: requirement.text, freezePhases: requirement.phases, freezeProvenBy: requirement.provenBy,
      cloud: { status: cloud.length > 0 || RECORDS[id] ? "COVERED" : "NONE", tests: cloud, records: RECORDS[id] ? RECORDS[id].split("; ") : [] },
      windows: { campaigns: windowsCases, status: windowsCases.some((c) => c !== "4D") ? "PENDING_WINDOWS" : "VALIDATOR_ONLY", certifying: false },
      note: windowsOnly ? "Windows-only requirement" : undefined,
    };
  }).map((row) => JSON.parse(JSON.stringify(row)));
  return { kind: "MO1309ConformanceInventory", version: "1.0.0", requirementSource: { path: "docs/mo1309-contract-freeze-1.md", sha256: sha256(fs.readFileSync(FREEZE)) },
    manifest: { path: "repositories/cca-conformance/mo1309-test-manifest.json", sha256: sha256(fs.readFileSync(path.join(REPO, "repositories/cca-conformance/mo1309-test-manifest.json"))) },
    status: "CLOUD_COVERAGE_ONLY_NOT_CERTIFIED", windowsCampaigns: campaigns, requirements: rows };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  const built = `${JSON.stringify(buildInventory(), null, 2)}\n`;
  if (mode === "build") process.stdout.write(built);
  else if (mode === "check") { const same = fs.readFileSync(INVENTORY, "utf8") === built; process.stdout.write(`${same ? "inventory current" : "inventory differs"}\n`); process.exitCode = same ? 0 : 1; }
  else { process.stderr.write("usage: build | check\n"); process.exitCode = 2; }
}
