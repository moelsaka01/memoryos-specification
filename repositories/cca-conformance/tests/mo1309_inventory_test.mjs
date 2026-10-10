// MO-1309 Phase 3: mo1309-conformance-inventory.json covers DB01..DB32 and agrees with the Freeze and the test sources.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ALL_IDS, INVENTORY, buildInventory, expandList, parseCampaigns, parseRequirements } from "../tools/mo1309/inventory.mjs";
import { REPO } from "../tools/mo1309/run-tests.mjs";

const committed = () => JSON.parse(fs.readFileSync(INVENTORY, "utf8"));
const freeze = () => fs.readFileSync(path.join(REPO, "docs/mo1309-contract-freeze-1.md"), "utf8");

test("the committed inventory equals the inventory rebuilt from the Freeze, the manifest and the test titles", () => {
  assert.equal(fs.readFileSync(INVENTORY, "utf8"), `${JSON.stringify(buildInventory(), null, 2)}\n`);
});

test("DB01..DB32 each appear exactly once, with the Freeze text, and each has cloud coverage or a recorded artefact", () => {
  const inventory = committed();
  assert.deepEqual(inventory.requirements.map((r) => r.id), ALL_IDS);
  assert.equal(new Set(inventory.requirements.map((r) => r.id)).size, 32);
  const frozen = parseRequirements(freeze());
  assert.deepEqual(frozen.map((r) => r.id), ALL_IDS);
  for (const requirement of inventory.requirements) {
    assert.equal(requirement.text, frozen.find((r) => r.id === requirement.id).text, requirement.id);
    assert.equal(requirement.cloud.status, "COVERED", `${requirement.id} has cloud coverage or a record`);
    assert.ok(requirement.cloud.tests.length > 0 || requirement.cloud.records.length > 0, requirement.id);
  }
});

test("every cited test exists in its file under its exact title, and its suite is in the manifest", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO, "repositories/cca-conformance/mo1309-test-manifest.json"), "utf8"));
  const suites = new Set(manifest.suites.map((s) => s.id));
  for (const requirement of committed().requirements) {
    for (const cited of requirement.cloud.tests) {
      assert.ok(suites.has(cited.suite), `${requirement.id}: suite ${cited.suite}`);
      assert.ok(fs.readFileSync(path.join(REPO, cited.file), "utf8").includes(cited.title), `${requirement.id}: ${cited.title}`);
      assert.ok(cited.title.includes(requirement.id), `${requirement.id} is named in its test title`);
    }
    for (const record of requirement.cloud.records) assert.ok(fs.existsSync(path.join(REPO, record.split(" ")[0])) || /^[a-z]/u.test(record), record);
  }
});

test("Windows campaigns come from the Freeze table, no inventory row claims certification, and the status is cloud-only", () => {
  const inventory = committed();
  assert.equal(inventory.status, "CLOUD_COVERAGE_ONLY_NOT_CERTIFIED");
  assert.deepEqual(Object.keys(inventory.windowsCampaigns), ["4A", "4B", "4C", "4D"]);
  assert.deepEqual(inventory.windowsCampaigns["4A"].requirements, ["DB01", "DB03", "DB18", "DB20", "DB22", "DB23", "DB24", "DB25", "DB29"]);
  assert.deepEqual(inventory.windowsCampaigns["4B"].requirements, ["DB05", "DB26", "DB27"]);
  assert.deepEqual(inventory.windowsCampaigns["4C"].requirements, ["DB02", "DB03", "DB04", "DB06", "DB07", "DB08", "DB09", "DB13", "DB14", "DB15", "DB17", "DB19", "DB28"]);
  assert.equal(inventory.windowsCampaigns["4D"].requirements.length, 32);
  for (const requirement of inventory.requirements) assert.equal(requirement.windows.certifying, false);
  assert.equal(inventory.requirements.find((r) => r.id === "DB29").windows.status, "PENDING_WINDOWS");
});

test("negative controls: a Freeze table missing a row, or a removed test title, changes the rebuilt inventory", () => {
  const text = freeze();
  assert.equal(parseRequirements(text.replace(/^\| DB17 \|.*$/mu, "")).length, 31);
  assert.deepEqual(expandList("DB01, 03, 18, 20, 22–25, 29"), ["DB01", "DB03", "DB18", "DB20", "DB22", "DB23", "DB24", "DB25", "DB29"]);
  assert.equal(parseCampaigns(text)["4C"].cases.length, 6);
  const rebuilt = buildInventory();
  const tampered = JSON.parse(JSON.stringify(rebuilt));
  tampered.requirements[0].cloud.tests.pop();
  assert.notEqual(JSON.stringify(tampered), JSON.stringify(committed()), "dropping a cited test is visible");
});
