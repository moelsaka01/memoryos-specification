// MO-1309 Phase 3: the closure and MO-1308-unchanged audit (DB26, DB27, DB31, DB32) with negative controls.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASELINE_BF, audit, classifyDiff, importSpecifiers, isAllowedSpecifier } from "../tools/mo1309/audit.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 1 << 28 });

test("DB26 DB27 classifyDiff accepts MO-1309 additions and the three documents, and refuses everything else (negative controls)", () => {
  assert.deepEqual(classifyDiff([
    { status: "A", path: "repositories/cca-studio/web/js/memoryos-dashboard-viewmodel.js" }, { status: "A", path: "docs/mo1309-phase3-handoff.md" },
    { status: "M", path: "ARCHITECTURE.md" }, { status: "M", path: "ROADMAP.md" }, { status: "M", path: "CHANGELOG.md" }]), []);
  const bad = (entry) => assert.equal(classifyDiff([entry]).length, 1, JSON.stringify(entry));
  bad({ status: "M", path: "repositories/cca-studio/web/js/memoryos-history-ledger.js" });          // an MO-1308 production file changed
  bad({ status: "M", path: "repositories/cca-studio/package.json" });                               // the pinned manifest edited
  bad({ status: "D", path: "repositories/cca-studio/web/js/memoryos-sdk.js" });                     // a released file deleted
  bad({ status: "A", path: "repositories/cca-studio/web/js/memoryos-sdk-extra.js" });               // an addition outside MO-1309 paths
  bad({ status: "A", path: "repositories/cca-studio/tests/fixtures/memoryos-dashboard/package.json" }); // a dependency file hidden inside an allowed prefix
  bad({ status: "A", path: "repositories/cca-conformance/tools/mo1309/package-lock.json" });
  bad({ status: "M", path: "repositories/memoryos-cli/bin/memoryos.js" });
  bad({ status: "M", path: "docs/mo1309-contract-freeze-1.md" });                                   // even an MO-1309 document may not be a modification of a BF file
});

test("DB27 import scan: relative and node: specifiers pass, a package or URL specifier is an offender (negative control)", () => {
  assert.deepEqual(importSpecifiers('import a from "./a.js";\nimport fs from "node:fs";\nexport { b } from "../b.js";\nconst x = await import("./c.js");').filter((s) => !isAllowedSpecifier(s)), []);
  assert.deepEqual(importSpecifiers('import z from "zod";\nimport("https://x.example/y.js");\nconst r = require("esbuild");').filter((s) => !isAllowedSpecifier(s)), ["zod", "https://x.example/y.js", "esbuild"]);
});

test("DB26 DB27 the whole milestone against BF bf2fdc87: only MO-1309 additions and three documents; every MO-1308 production blob is unchanged; no new import", () => {
  const result = audit({ repo, base: BASELINE_BF, head: "HEAD" });
  assert.equal(result.baseIsAncestor, true, "BF is an ancestor of the candidate");
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.mo1308Production.changed, []);
  assert.ok(result.mo1308Production.paths >= 40, "the candidate identity lists the MO-1308 production paths");
  assert.deepEqual(result.importScan.offenders, []);
  assert.deepEqual(result.modified, ["M ARCHITECTURE.md", "M CHANGELOG.md", "M ROADMAP.md"]);
  assert.equal(result.ok, true);
});

test("DB27 the studio package manifest is byte-identical to BF and the MO-1309 tests are wired by a separate manifest (no build step, no script change)", () => {
  assert.equal(git("rev-parse", `HEAD:repositories/cca-studio/package.json`), git("rev-parse", `${BASELINE_BF}:repositories/cca-studio/package.json`));
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, "repositories/cca-studio/package.json"), "utf8"));
  assert.equal(Object.hasOwn(manifest, "dependencies"), false);
  assert.ok(!/memoryos_dashboard/u.test(JSON.stringify(manifest.scripts)), "dashboard tests are not in the pinned manifest");
  assert.ok(!Object.keys(manifest.scripts).some((name) => /build|compile|bundle/u.test(name)), "no build step");
});

test("DB31 ARCHITECTURE.md differs from BF by additions only, and they are the two Freeze section 20 clauses", () => {
  const diff = git("diff", "--unified=0", BASELINE_BF, "HEAD", "--", "ARCHITECTURE.md");
  const removed = diff.split("\n").filter((line) => line.startsWith("-") && !line.startsWith("---"));
  assert.deepEqual(removed, [], "no line removed");
  const freeze = fs.readFileSync(path.join(repo, "docs/mo1309-contract-freeze-1.md"), "utf8").replace(/\n/gu, " ").replace(/ {2,}/gu, " ");
  const added = diff.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).map((line) => line.slice(1)).filter(Boolean);
  assert.ok(added.length >= 2);
  const joined = added.join(" ").replace(/ {2,}/gu, " ");
  for (const needle of ["MO-1309 adds a downstream presentation of MO-1308 history exports", "MO-1309 is a narrow downstream-presentation clause"]) {
    assert.ok(joined.includes(needle) && freeze.includes(needle), needle);
  }
});

test("DB32 no export-performance work: the MO-1308 exporter and every MO-1308 production path are byte-identical to the released candidate", () => {
  const result = audit({ repo });
  assert.equal(result.mo1308Production.changed.length, 0);
  for (const file of ["repositories/cca-studio/web/js/memoryos-history-ledger.js", "repositories/cca-studio/web/js/memoryos-history-contract.js", "repositories/memoryos-cli/src/history-store.js"]) {
    assert.equal(git("rev-parse", `HEAD:${file}`), git("rev-parse", `${BASELINE_BF}:${file}`), file);
  }
});
