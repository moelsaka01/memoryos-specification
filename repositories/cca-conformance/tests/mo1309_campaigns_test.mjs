// MO-1309 Phase 3: the Phase 4 campaign scripts. A certifying run is refused anywhere but the Windows host (DB29 guard); a rehearsal
// writes a non-certifying receipt. The full cloud rehearsals are recorded under evidence/mo1309/phase3-rehearsal/ by the handoff steps.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CAMPAIGNS, REQUIRED_NODE, WINDOWS_ONLY, runCampaign } from "../tools/mo1309/campaigns.mjs";
import { REPO } from "../tools/mo1309/run-tests.mjs";

const freeze = fs.readFileSync(path.join(REPO, "docs/mo1309-contract-freeze-1.md"), "utf8");

test("the case ids equal the Freeze section 17 campaign table, and every case names its Windows-only part", () => {
  for (const [stream, ids] of Object.entries(CAMPAIGNS)) {
    const row = freeze.split("\n").find((line) => line.startsWith(`| **${stream}**`));
    assert.deepEqual([...row.matchAll(/(4[ABC]-[A-Z]\d+)/gu)].map((m) => m[1]).filter((id, i, a) => a.indexOf(id) === i), ids, stream);
    for (const id of ids) assert.ok(WINDOWS_ONLY[id] && WINDOWS_ONLY[id].length > 3, id);
  }
});

test("DB29 a certifying run is refused unless it is Windows 11 x64, Node 24.21.0, a clean tree and a new evidence directory", async () => {
  assert.equal(REQUIRED_NODE, "v24.21.0");
  const out = path.join(os.tmpdir(), "mo1309-should-not-exist");
  await assert.rejects(runCampaign("4B", { mode: "certifying", out }), /certifying run refused: .*(platform is not win32|node is)/u);
  assert.equal(fs.existsSync(out), false, "a refused run writes nothing");
  await assert.rejects(runCampaign("4B", { mode: "certifying", out: path.join(REPO, "repositories/cca-conformance/evidence/mo1309/x") }), /refused/u);
});

test("4B rehearsal passes in the cloud and writes a NON-certifying receipt that lists the Windows-only parts", async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "mo1309-4b-"));
  try {
    const receipt = await runCampaign("4B", { mode: "rehearsal", out });
    assert.equal(receipt.certifying, false);
    assert.equal(receipt.accepted, false);
    assert.equal(receipt.result, "REHEARSAL_PASSED_NON_CERTIFYING", JSON.stringify(receipt.cases.filter((c) => c.outcome !== "PASS")));
    assert.deepEqual(receipt.cases.map((c) => c.id), CAMPAIGNS["4B"]);
    for (const c of receipt.cases) assert.ok(c.windowsOnlyPart);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, "4b-receipt.json"), "utf8")).requirements, ["DB05", "DB26", "DB27"]);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
