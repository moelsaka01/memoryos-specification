import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { referenceSnapshot } from "../../cca-studio/web/data/studio-snapshot.js";
import { anthropicSdkAdapter } from "../../cca-studio/web/js/adapters/anthropic-sdk-adapter.js";
import { langGraphAdapter } from "../../cca-studio/web/js/adapters/langgraph-adapter.js";
import { openAIAgentsSdkAdapter } from "../../cca-studio/web/js/adapters/openai-agents-sdk-adapter.js";
import {
  InvestigationCore,
  LifecycleState,
  projectInvestigation,
} from "../../cca-studio/web/js/investigation-core.js";
import {
  exportMemoryInvestigationPackage,
  importMemoryInvestigationPackage,
  verifyMemoryInvestigationPackage,
} from "../../cca-studio/web/js/memory-investigation-package.js";
import { canonicalize } from "../../cca-studio/web/js/mip-canonical.js";
import { MemoryOS } from "../../cca-studio/web/js/memoryos-sdk.js";
import { cloneDetached } from "../../cca-studio/web/js/studio-model.js";
import { referenceSource } from "../../cca-studio/tests/fixtures/adapters/reference-sources.mjs";
import { parseCliJson, readMipFixture, runCli } from "./support/conformance-support.mjs";

function changedSnapshot() {
  const value = cloneDetached(referenceSnapshot);
  value.observationIdentifier = "observation-conformance-candidate";
  value.longTermMemory.entries[0].value = "Conformance evidence changed.";
  value.semanticMemory.concepts[0].meaning = "Conformance meaning changed.";
  value.retrievalSessions[0].candidates[0].rankScore += 1;
  value.reflections[0].knowledge = "Conformance reflection changed.";
  return value;
}

function reflectionKey(investigation) {
  const reflection = investigation.state.currentFrame.world.nodes.find(
    ({ observationPath }) => observationPath === "Reflection.values[0]",
  );
  assert.ok(reflection, "the reference observation exposes an exact Reflection");
  return reflection.key;
}

function completeReplay(core, identifier) {
  let value = core.load(identifier);
  while (value.state.replayState.status !== "completed") value = core.replay(identifier, "next");
  return value;
}

function executeLifecycle(identifier) {
  const core = new InvestigationCore();
  core.create({ identifier, snapshot: referenceSnapshot });
  let value = core.observe(identifier, { snapshot: changedSnapshot() });
  const targetNodeKey = reflectionKey(value);
  value = core.trace(identifier, targetNodeKey);
  assert.equal(value.state.lifecycle, LifecycleState.ReplayReady);
  value = completeReplay(core, identifier);
  assert.equal(value.state.lifecycle, LifecycleState.ReplayComplete);
  value = core.compare(identifier, "enter");
  assert.equal(value.state.lifecycle, LifecycleState.ComparisonReady);
  value = core.compare(identifier, "start");
  assert.equal(value.state.lifecycle, LifecycleState.Comparing);
  core.compare(identifier, "back");
  core.compare(identifier, "back");
  value = core.returnToWorld(identifier);
  assert.equal(value.state.lifecycle, LifecycleState.Observed);
  return value;
}

test("Runtime-independent Investigation lifecycle is immutable and deterministic", () => {
  const first = executeLifecycle("conformance-lifecycle");
  const second = executeLifecycle("conformance-lifecycle");
  assert.deepEqual(first.transitionLog, second.transitionLog);
  assert.equal(
    canonicalize(structuredClone(projectInvestigation(first))),
    canonicalize(structuredClone(projectInvestigation(second))),
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.state), true);
  assert.equal(Object.isFrozen(first.transitionLog), true);
});

test("MIP import, verification, and export preserve every published golden byte", async () => {
  for (const name of ["complete-investigation", "minimal-observation", "noncritical-extension"]) {
    const bytes = await readMipFixture(name);
    const first = verifyMemoryInvestigationPackage(bytes);
    const second = verifyMemoryInvestigationPackage(bytes);
    assert.equal(first.valid, true, `${name}: ${JSON.stringify(first.diagnostics)}`);
    assert.deepEqual(first, second);
    assert.deepEqual(exportMemoryInvestigationPackage(importMemoryInvestigationPackage(bytes)), bytes);
  }
  const invalid = new Uint8Array([0xff]);
  assert.deepEqual(verifyMemoryInvestigationPackage(invalid), verifyMemoryInvestigationPackage(invalid));
  assert.equal(verifyMemoryInvestigationPackage(invalid).valid, false);
});

test("reference AI Runtime adapters reproduce their immutable MIP evidence", async () => {
  const adapters = {
    anthropic: anthropicSdkAdapter,
    langgraph: langGraphAdapter,
    "openai-agents": openAIAgentsSdkAdapter,
  };
  for (const [name, adapter] of Object.entries(adapters)) {
    const request = {
      observationIdentifier: `observation-${name}-reference`,
      observationSequence: 0,
      packageIdentifier: `mip-adapter-${name}-reference`,
      sourceVersion: "reference-fixture-1.0.0",
      workspaceIdentifier: "workspace-adapter-reference",
    };
    const first = await adapter.exportInvestigation(await referenceSource(name), request);
    const second = await adapter.exportInvestigation(await referenceSource(name), request);
    const golden = new Uint8Array(await readFile(new URL(
      `../../cca-studio/examples/ai-runtime-adapters/reference-packages/${name}-reference.mip`,
      import.meta.url,
    )));
    assert.deepEqual(first, second);
    assert.deepEqual(first, golden);
    assert.equal(verifyMemoryInvestigationPackage(first).valid, true);
  }
});

test("SDK delegates exact deterministic Regression and Explorer behavior", () => {
  const execute = () => {
    const memory = new MemoryOS();
    const workspace = memory.openWorkspace(referenceSnapshot.workspaceIdentifier);
    const baseline = memory.observe(workspace, referenceSnapshot, { identifier: "conformance-sdk-baseline" });
    const candidate = memory.observe(workspace, changedSnapshot(), { identifier: "conformance-sdk-candidate" });
    const report = memory.regression(baseline, candidate);
    const result = memory.investigate(report, { category: "reflection" });
    return { report, result };
  };
  const first = execute();
  const second = execute();
  assert.deepEqual(structuredClone(first.report), structuredClone(second.report));
  assert.deepEqual(structuredClone(first.result), structuredClone(second.result));
  assert.equal(first.report.regressionDetected, true);
  assert.equal(first.result.status, "matched");
  assert.ok(first.result.matches.length > 0);
  assert.equal(Object.isFrozen(first.report), true);
  assert.equal(Object.isFrozen(first.result), true);
});

test("CLI exposes stable JSON and delegates MIP, Regression, and Explorer to the SDK", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "memoryos-conformance-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packagePath = join(root, "investigation.mip");
  const reportPath = join(root, "regression.json");
  const packageBytes = await readMipFixture("complete-investigation");
  await writeFile(packagePath, packageBytes);

  const versionFirst = runCli(["version", "--json"]);
  const versionSecond = runCli(["version", "--json"]);
  assert.equal(versionFirst.status, 0);
  assert.equal(versionFirst.stderr, "");
  assert.equal(versionFirst.stdout, versionSecond.stdout);

  const verifyFirst = runCli(["verify", packagePath, "--json"]);
  const verifySecond = runCli(["verify", packagePath, "--json"]);
  assert.equal(verifyFirst.status, 0);
  assert.equal(verifyFirst.stdout, verifySecond.stdout);
  assert.equal(parseCliJson(verifyFirst).result.valid, true);

  const regressionFirst = runCli(["regression", packagePath, packagePath, "--json"]);
  const regressionSecond = runCli(["regression", packagePath, packagePath, "--json"]);
  assert.equal(regressionFirst.status, 0);
  assert.equal(regressionFirst.stdout, regressionSecond.stdout);
  const report = parseCliJson(regressionFirst).result;
  await writeFile(reportPath, `${JSON.stringify(report)}\n`, "utf8");
  const navigation = runCli(["investigate", reportPath, "--json"]);
  assert.equal(navigation.status, 0);
  assert.equal(parseCliJson(navigation).result.status, "empty");

  const memory = new MemoryOS();
  const baseline = memory.importPackage(packageBytes);
  const candidate = memory.importPackage(packageBytes, { identifier: "conformance-cli-candidate" });
  const sdkReport = memory.regression(baseline, candidate);
  assert.equal(report.regressionDetected, sdkReport.regressionDetected);
  assert.deepEqual(report.categories, structuredClone(sdkReport.categories));
});
