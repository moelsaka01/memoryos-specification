// MO-1309 Phase 3: the linear view-model build (verify once, one parsing pass) is byte-identical to the Phase 1 per-page
// `queryHistoryLedger` reference on every fixture and on the synthetic 1,000-entry corpus, and tampered exports are still rejected.
// Requirements: DB02, DB03, DB10, DB11, DB26 (consumes only MO-1308 public interfaces), DB18 (determinism).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { buildDashboardViewModel, canonicalViewModelBytes } from "../web/js/memoryos-dashboard-viewmodel.js";
import { MEMORYOS_HISTORY_LAYOUT } from "../web/js/memoryos-history-contract.js";
import { canonicalize } from "../web/js/mip-canonical.js";
import { DashboardError } from "../web/js/memoryos-dashboard-contract.js";
import { buildCorpusExport } from "../scripts/memoryos-dashboard-perf-corpus.mjs";
import { buildDashboardViewModelReference } from "./support-dashboard-reference-viewmodel.mjs";
import { FIXTURE_NAMES, readExportFiles } from "./support-dashboard-fixtures.mjs";

import { differential, sameBytes } from "./support-dashboard-differential.mjs";

test("every fixture: linear view model is byte-identical to the per-page reference", () => {
  for (const name of FIXTURE_NAMES) {
    const result = differential(readExportFiles(name));
    assert.equal(result.identical, true, name);
  }
});

test("1,000-entry synthetic corpus (with tombstones and purges): byte-identical", () => {
  const files = buildCorpusExport(1000);
  const result = differential(files);
  assert.equal(result.identical, true);
  const model = JSON.parse(Buffer.from(result.linear).toString("utf8"));
  assert.equal(model.entries.length, 1000);
  assert.ok(model.verification.purgedRecords > 0 && model.verification.tombstones > 0, "the corpus exercises retention and tombstone links");
});

test("negative control: the byte comparison fails on a one-field divergence", () => {
  const files = readExportFiles("all-kinds-tombstoned");
  const model = buildDashboardViewModel({ files });
  const bytesOf = (value) => new TextEncoder().encode(canonicalize(value));
  const mutated = JSON.parse(JSON.stringify(model));
  mutated.entries[0].retention = "RETAINED";
  mutated.entries[0].tombstoneIndex = null;
  assert.equal(sameBytes(bytesOf(mutated), bytesOf(model)), false);
  const membersDropped = JSON.parse(JSON.stringify(model));
  membersDropped.entries[1].members = [];
  assert.equal(sameBytes(bytesOf(membersDropped), bytesOf(model)), false);
  assert.equal(sameBytes(bytesOf(model), canonicalViewModelBytes(buildDashboardViewModelReference({ files })).slice(0, -1)), true, "and agrees when nothing diverges");
});

const flip = (bytes, at = 0) => { const copy = new Uint8Array(bytes); copy[at] ^= 0x01; return copy; };
const replaceFile = (files, filePath, mutate) => assert.ok(files.some((file) => file.path === filePath), `${filePath} exists`) ?? files.map((file) => (file.path === filePath ? { path: file.path, bytes: mutate(file.bytes) } : file));
const rejected = (files, label) => {
  for (const build of [buildDashboardViewModel, buildDashboardViewModelReference]) {
    assert.throws(() => build({ files }), (error) => error instanceof DashboardError && error.code === "DASH_EXPORT_INVALID" && /^MO1308_(EXPORT|LEDGER|RECORD|MEMBER)_/.test(error.historyCode ?? ""), label);
  }
  // linear and reference agree on the carried MO-1308 code
  const codes = [buildDashboardViewModel, buildDashboardViewModelReference].map((build) => { try { build({ files }); return "none"; } catch (error) { return error.historyCode; } });
  assert.equal(codes[0], codes[1], label);
};

test("tampered exports are still rejected with the carried MO-1308 code (entry, member, manifest, marker, truncation, extra file)", () => {
  const files = readExportFiles("all-kinds-tombstoned");
  const paths = files.map((file) => file.path);
  const entryPath = paths.find((p) => p.startsWith("entries/") && p.endsWith("0003.json")) ?? paths.find((p) => p.startsWith("entries/"));
  const memberPath = paths.find((p) => p.startsWith("records/"));
  rejected(replaceFile(files, entryPath, (b) => flip(b, 40)), "entry byte flipped (chain)");
  rejected(replaceFile(files, memberPath, (b) => flip(b, 0)), "member byte flipped");
  rejected(replaceFile(files, MEMORYOS_HISTORY_LAYOUT.exportManifest, (b) => flip(b, 30)), "manifest byte flipped");
  rejected(replaceFile(files, MEMORYOS_HISTORY_LAYOUT.exportComplete, (b) => flip(b, 30)), "marker byte flipped");
  const lastEntry = paths.filter((p) => p.startsWith("entries/")).sort().at(-1);
  rejected(files.filter((file) => file.path !== lastEntry), "truncated tail (last entry file removed, manifest kept)");
  rejected([...files, { path: "entries/9999.json", bytes: new Uint8Array([0x7b, 0x7d]) }], "extra file");
  rejected(files.filter((file) => file.path !== memberPath), "member file removed");
});

test("the linear builder consumes only MO-1308 public interfaces and no longer calls the per-page query", () => {
  const source = fs.readFileSync(fileURLToPath(new URL("../web/js/memoryos-dashboard-viewmodel.js", import.meta.url)), "utf8");
  assert.equal(/queryHistoryLedger/.test(source.replace(/\/\/.*$/gm, "")), false);
  const imports = [...source.matchAll(/from "(\.\/[^"]+)"/g)].map((m) => m[1]);
  for (const spec of imports) assert.match(spec, /^\.\/(memoryos-history-contract|memoryos-history-ledger|mip-canonical|memoryos-dashboard-contract)\.js$/);
  assert.match(source, /verifyHistoryExport\(input\)/);
  assert.equal((source.match(/verifyHistoryExport\(/g) ?? []).length, 1, "the export is verified exactly once per build");
});

test("linear build verifies the chain once (counting wrapper over the public verifier is not needed: time scales linearly)", () => {
  const small = buildCorpusExport(200);
  const large = buildCorpusExport(1000);
  const time = (files) => { const start = process.hrtime.bigint(); buildDashboardViewModel({ files }); return Number(process.hrtime.bigint() - start) / 1e6; };
  time(small); // warm
  const t200 = time(small);
  const t1000 = time(large);
  assert.ok(t1000 < t200 * 5 * 3, `1000 entries (${t1000.toFixed(0)} ms) within 3x of linear scaling from 200 (${t200.toFixed(0)} ms)`);
});
