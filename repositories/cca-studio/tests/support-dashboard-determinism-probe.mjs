// MO-1309 Phase 1 test support: prints the canonical view models of every fixture (run in fresh processes by the determinism test).
import { buildDashboardViewModel, canonicalViewModelBytes } from "../web/js/memoryos-dashboard-viewmodel.js";
import { FIXTURE_NAMES, readExportFiles } from "./support-dashboard-fixtures.mjs";

if (process.env.MO1309_PROBE_FREEZE_CLOCK === "1") {
  // A frozen, absurd clock: any dependence on it would change the output.
  const fixed = Date.UTC(2001, 8, 9, 1, 46, 40);
  Date.now = () => fixed;
  globalThis.Date = class extends Date { constructor(...a) { super(...(a.length ? a : [fixed])); } };
}
const crypto = await import("node:crypto");
const out = [];
for (const name of FIXTURE_NAMES) {
  const bytes = canonicalViewModelBytes(buildDashboardViewModel({ files: readExportFiles(name) }));
  out.push(`${name} ${crypto.createHash("sha256").update(bytes).digest("hex")}`);
}
process.stdout.write(`${out.join("\n")}\n`);
