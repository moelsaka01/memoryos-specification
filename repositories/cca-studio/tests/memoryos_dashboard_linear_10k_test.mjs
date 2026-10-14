// MO-1309 Phase 3: differential at the certified scale (10,000 entries). The reference is the quadratic Phase 1 builder, so this
// test takes about a minute; it is its own file so the quick selection can skip it.
import test from "node:test";
import assert from "node:assert/strict";
import { buildCorpusExport } from "../scripts/memoryos-dashboard-perf-corpus.mjs";
import { differential } from "./support-dashboard-differential.mjs";

test("10,000-entry synthetic corpus: linear view model is byte-identical to the per-page reference", { timeout: 900000 }, () => {
  const result = differential(buildCorpusExport(10000));
  assert.equal(result.identical, true);
  assert.equal(JSON.parse(Buffer.from(result.linear).toString("utf8")).entries.length, 10000);
});
