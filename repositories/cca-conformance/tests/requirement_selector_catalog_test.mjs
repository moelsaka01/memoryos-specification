import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DIRECT_REQUIREMENT_SELECTORS,
  INCORPORATED_RANGE_CONJUNCTIONS,
  RF_REQUIREMENT_SELECTORS,
  loadMipRequirementSelectors,
  parseMipRequirementSelectors,
  validateRequirementSelectorCatalog,
} from "../tools/requirement-selector-catalog.mjs";

const conformanceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(conformanceRoot, "../..");
const matrixPath = resolve(workspaceRoot, "repositories/cca-studio/docs/mip-conformance-matrix.md");

test("requirement selector catalog covers every direct and incorporated requirement exactly", async () => {
  const mip = await loadMipRequirementSelectors(workspaceRoot);
  assert.deepEqual(validateRequirementSelectorCatalog(mip), {
    directRequirements: 114,
    directAutomated: 100,
    directSelectorBound: 98,
    directReview: 14,
    incorporatedConjunctions: 2,
    runtimeFoundationRequirements: 40,
    runtimeFoundationAutomated: 16,
    runtimeFoundationReview: 24,
    mipRequirements: 64,
    mipAutomated: 61,
    mipReview: 3,
  });

  assert.deepEqual(INCORPORATED_RANGE_CONJUNCTIONS, {
    "CCA-MOS-MIP-001": {
      registry: "CCA-MIP-1.0",
      firstRequirement: "CCA-MIP-001",
      lastRequirement: "CCA-MIP-064",
      requirementCount: 64,
    },
    "CCA-MOS-RT-001": {
      registry: "CCA-RF-1.0",
      firstRequirement: "CCA-RF-001",
      lastRequirement: "CCA-RF-040",
      requirementCount: 40,
    },
  });
  assert.equal(DIRECT_REQUIREMENT_SELECTORS["CCA-MOS-MIP-001"].length, 0);
  assert.equal(DIRECT_REQUIREMENT_SELECTORS["CCA-MOS-RT-001"].length, 0);
});

test("MIP matrix aliases expand to full exact selector conjunctions", async () => {
  const matrix = await readFile(matrixPath, "utf8");
  const parsed = parseMipRequirementSelectors(matrix);
  const loaded = await loadMipRequirementSelectors(workspaceRoot);
  assert.deepEqual(parsed, loaded);

  assert.deepEqual(parsed["CCA-MIP-001"].map(({ selector }) => selector), [
    "CCA-MIP-001..010: all published packages import headlessly with exact golden integrity",
    "CCA-MIP-011..020: identity, ordering, Workspace, closure, and provenance are validated",
    "CCA-MIP-021..028: Trace and Replay are independently reconstructed",
    "CCA-MIP-029..036: Evolution and Comparative Reconstruction are independently recomputed",
    "Workspace ownership is enforced for every persisted cognitive artifact",
  ]);
  assert.deepEqual(parsed["CCA-MIP-003"], []);
  assert.deepEqual(parsed["CCA-MIP-044"], []);
  assert.deepEqual(parsed["CCA-MIP-057"], []);
  assert.equal(parsed["CCA-MIP-040"].length, 13);
  assert.equal(parsed["CCA-MIP-048"].length, 15);
  assert.equal(parsed["CCA-MIP-050"].length, 18);
  assert.ok(parsed["CCA-MIP-040"].every(({ executionReference }) => executionReference === "component-js"));
});

test("MIP matrix parsing rejects incomplete and undefined traceability", async () => {
  const matrix = await readFile(matrixPath, "utf8");
  assert.throws(
    () => parseMipRequirementSelectors(matrix.replace(/^\| CCA-MIP-064 \|.*\r?\n/mu, "")),
    /exactly 64 requirements/u,
  );
  assert.throws(
    () => parseMipRequirementSelectors(matrix.replace("P01, P07–P09, A13", "P99")),
    /undefined MIP test alias P99/u,
  );
});

test("selector catalog excludes generated report tests from its evidence basis", async () => {
  const mip = await loadMipRequirementSelectors(workspaceRoot);
  const all = [
    ...Object.values(DIRECT_REQUIREMENT_SELECTORS),
    ...Object.values(RF_REQUIREMENT_SELECTORS),
    ...Object.values(mip),
  ].flat();
  assert.ok(all.length > 0);
  assert.ok(all.every(({ executionReference }) => executionReference !== "report-js"));
  assert.ok(all.every(({ source }) => !source.endsWith("/report_conformance_test.mjs")));
});
