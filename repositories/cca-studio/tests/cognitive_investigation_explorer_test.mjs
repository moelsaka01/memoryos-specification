import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { referenceSnapshot } from "../web/data/studio-snapshot.js";
import {
  COGNITIVE_INVESTIGATION_EXPLORER_VERSION,
  ExplorerCategory,
  navigateCognitiveRegression,
  serializeCognitiveInvestigationResult,
  validateCognitiveInvestigationResult,
} from "../web/js/cognitive-investigation-explorer.js";
import {
  InvestigationCore,
  InvestigationCoreError,
  projectInvestigation,
} from "../web/js/investigation-core.js";
import { canonicalize, deepFreeze } from "../web/js/mip-canonical.js";
import { cloneDetached } from "../web/js/studio-model.js";

function snapshot(mutator = () => {}) {
  const value = cloneDetached(referenceSnapshot);
  mutator(value);
  return value;
}

function reflectionKey(investigation) {
  return investigation.state.currentFrame.world.nodes.find(({ observationPath }) => (
    observationPath === "Reflection.values[0]"
  )).key;
}

function pair(candidateSnapshot = referenceSnapshot, suffix = "pair") {
  const core = new InvestigationCore();
  const baseline = core.create({ identifier: `explorer-baseline-${suffix}`, snapshot: referenceSnapshot });
  const candidate = core.create({ identifier: `explorer-candidate-${suffix}`, snapshot: candidateSnapshot });
  return { baseline, candidate, core };
}

function completeReplay(core, identifier) {
  let value = core.load(identifier);
  while (value.state.replayState.status !== "completed") {
    value = core.replay(identifier, "next");
  }
  return value;
}

test("MO-1207 Explorer returns a closed immutable deterministic result from detached JSON", () => {
  const { baseline, candidate, core } = pair(snapshot((value) => {
    value.longTermMemory.entries[0].value = "Changed deterministic evidence.";
  }), "contract");
  const report = core.regression(baseline.identifier, candidate.identifier);
  const detached = JSON.parse(JSON.stringify(report));
  const result = core.investigate(detached);

  assert.equal(COGNITIVE_INVESTIGATION_EXPLORER_VERSION, "1.0.0");
  assert.deepEqual(Object.values(ExplorerCategory), [
    "replay", "reflection", "evidence", "retrieval", "evolution",
    "verification", "transition", "lifecycle",
  ]);
  assert.equal(result.kind, "MemoryOSCognitiveInvestigationResult");
  assert.equal(result.version, "1.0.0");
  assert.match(result.identifier, /^explorer:[0-9a-f]{64}$/u);
  assert.equal(result.regressionIdentifier, report.identifier);
  assert.equal(result.workspaceIdentifier, referenceSnapshot.workspaceIdentifier);
  assert.deepEqual(result.query, {
    category: null,
    reflectionIdentifier: null,
    transition: null,
  });
  assert.equal(result.status, "matched");
  assert.equal(result.matchCount, result.matches.length);
  assert.ok(result.matches.length > 0);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.matches), true);
  assert.equal(Object.isFrozen(result.matches[0]), true);
  assert.equal(Object.isFrozen(result.matches[0].subject), true);
  assert.equal(validateCognitiveInvestigationResult(result), true);
  assert.equal(serializeCognitiveInvestigationResult(result), canonicalize(result));
  assert.deepEqual(core.investigate(detached), result);
  assert.deepEqual(navigateCognitiveRegression(detached), result);
});

test("MO-1207 Explorer navigates Evidence Reflection Retrieval Replay Evolution and Verification", () => {
  const changed = snapshot((value) => {
    value.longTermMemory.entries[0].value = "Explorer evidence changed.";
    value.reflections[0].knowledge = "Explorer Reflection changed.";
    value.retrievalSessions[0].candidates[0].rankScore += 1;
    value.semanticMemory.concepts[0].meaning = "Explorer semantic transformation changed.";
  });
  const { baseline, candidate, core } = pair(changed, "facets");
  core.trace(baseline.identifier, reflectionKey(baseline));
  core.trace(candidate.identifier, reflectionKey(candidate));
  core.replay(candidate.identifier, "next");
  core.verify(candidate.identifier);
  const report = core.regression(baseline.identifier, candidate.identifier);

  for (const category of [
    "replay", "reflection", "evidence", "retrieval", "evolution", "verification",
  ]) {
    const result = core.investigate(report, { category });
    assert.equal(result.status, "matched", category);
    assert.ok(result.matches.every((match) => match.category === category));
    assert.deepEqual(result.matches.map(({ index }) => index), result.matches.map((_, index) => index));
  }

  const reflection = core.investigate(report, {
    reflectionIdentifier: "reflection-release-integrity",
  });
  assert.equal(reflection.matchCount, 1);
  assert.equal(reflection.matches[0].category, "reflection");
  assert.equal(reflection.matches[0].subject.identifier, "reflection-release-integrity");

  const missing = core.investigate(report, { reflectionIdentifier: "reflection-missing" });
  assert.equal(missing.status, "empty");
  assert.equal(missing.matchCount, 0);
  assert.deepEqual(missing.matches, []);
});

test("MO-1207 Explorer navigates exact Transition and lifecycle evidence", () => {
  const { baseline, candidate, core } = pair(referenceSnapshot, "transition");
  core.trace(baseline.identifier, reflectionKey(baseline));
  core.trace(candidate.identifier, reflectionKey(candidate));
  completeReplay(core, candidate.identifier);
  const report = core.regression(baseline.identifier, candidate.identifier);

  const action = core.investigate(report, { transition: "next" });
  assert.equal(action.status, "matched");
  assert.ok(action.matches.length > 0);
  assert.ok(action.matches.every(({ category, subject }) => (
    category === "transition"
    && [subject.transition.beforeAction, subject.transition.afterAction].includes("next")
  )));

  const complete = core.investigate(report, { transition: "replay-complete" });
  assert.equal(complete.matchCount, 1);
  assert.equal(complete.matches[0].category, "lifecycle");
  assert.equal(complete.matches[0].subject.lifecycle.afterState, "ReplayComplete");

  assert.equal(
    core.investigate(report, { transition: "ReplayComplete" }).identifier,
    complete.identifier,
  );
  assert.equal(core.investigate(report, { transition: "not-a-transition" }).status, "empty");
});

test("MO-1207 Explorer endpoints terminate at exact report evidence", () => {
  const { baseline, candidate, core } = pair(snapshot((value) => {
    value.longTermMemory.entries[0].value = "Endpoint evidence changed.";
  }), "endpoints");
  const report = core.regression(baseline.identifier, candidate.identifier);
  const result = core.investigate(report, { category: "evidence" });
  assert.equal(result.matchCount, 1);
  const [match] = result.matches;
  assert.equal(match.change, "modified");
  assert.notEqual(match.baseline.digest, match.candidate.digest);
  assert.equal(match.baseline.sourceIdentifier, baseline.identifier);
  assert.equal(match.candidate.sourceIdentifier, candidate.identifier);
  assert.equal(match.baseline.sourceKind, "native");
  assert.equal(match.candidate.sourceKind, "native");
  assert.match(match.baseline.pointer, /^\/categories\/2\/differences\/0\/beforeDigest$/u);
  assert.match(match.candidate.pointer, /^\/categories\/2\/differences\/0\/afterDigest$/u);
  assert.equal(match.baseline.digest, report.categories[2].differences[0].beforeDigest);
  assert.equal(match.candidate.digest, report.categories[2].differences[0].afterDigest);

  const addedPair = pair(snapshot((value) => {
    value.longTermMemory.entries.push({
      archived: false,
      identifier: "ltm-explorer-added",
      value: "Added Explorer evidence.",
    });
  }), "added");
  const added = addedPair.core.investigate(
    addedPair.core.regression(addedPair.baseline.identifier, addedPair.candidate.identifier),
    { category: "evidence" },
  ).matches[0];
  assert.equal(added.baseline, null);
  assert.ok(added.candidate);
});

test("MO-1207 Explorer rejects malformed reports queries and results without partial output", () => {
  const { baseline, candidate, core } = pair(referenceSnapshot, "validation");
  const report = core.regression(baseline.identifier, candidate.identifier);
  const invalidReport = structuredClone(report);
  invalidReport.identifier = `regression:${"0".repeat(64)}`;
  assert.throws(
    () => core.investigate(invalidReport),
    (error) => error instanceof InvestigationCoreError
      && error.code === "INVALID_REGRESSION_REPORT" && error.operation === "investigate",
  );
  assert.throws(
    () => core.investigate({}),
    (error) => error instanceof InvestigationCoreError
      && error.code === "INVALID_REGRESSION_REPORT" && error.operation === "investigate",
  );
  for (const query of [
    null,
    { unknown: true },
    { category: "rendering" },
    { reflectionIdentifier: "" },
    { transition: "" },
  ]) {
    assert.throws(
      () => core.investigate(report, query),
      (error) => error instanceof InvestigationCoreError
        && error.code === "INVALID_QUERY" && error.operation === "investigate",
    );
  }
  assert.throws(() => core.investigate(report, {
    reflectionIdentifier: "reflection-release-integrity",
    transition: "observed",
  }), /mutually exclusive/u);
  assert.throws(() => core.investigate(report, {
    category: "evidence",
    reflectionIdentifier: "reflection-release-integrity",
  }), /Reflection navigation/u);

  const result = core.investigate(report);
  const malformed = structuredClone(result);
  malformed.matchCount += 1;
  assert.throws(
    () => validateCognitiveInvestigationResult(deepFreeze(malformed)),
    /closed immutable/u,
  );
  assert.throws(
    () => validateCognitiveInvestigationResult(structuredClone(result)),
    /closed immutable/u,
  );
});

test("MO-1207 Explorer is read-only and deterministic under bounded navigation", {
  skip: process.env.MEMORYOS_DETERMINISTIC_CONFORMANCE === "1"
    ? "timing-only check is outside deterministic conformance evidence"
    : false,
}, () => {
  const { baseline, candidate, core } = pair(snapshot((value) => {
    value.longTermMemory.entries[0].value = "Performance evidence changed.";
  }), "performance");
  const report = core.regression(baseline.identifier, candidate.identifier);
  const before = [baseline, candidate].map((investigation) => ({
    digest: investigation.transitionLog.digest,
    projection: canonicalize(projectInvestigation(investigation)),
  }));
  const expected = serializeCognitiveInvestigationResult(core.investigate(report));
  const started = performance.now();
  for (let index = 0; index < 100; index += 1) {
    assert.equal(serializeCognitiveInvestigationResult(core.investigate(report)), expected);
  }
  assert.ok(performance.now() - started < 5_000);
  [baseline, candidate].forEach((investigation, index) => {
    const current = core.load(investigation.identifier);
    assert.equal(current.transitionLog.digest, before[index].digest);
    assert.equal(canonicalize(projectInvestigation(current)), before[index].projection);
  });
});

test("MO-1207 Explorer accepts an identical MIP-backed regression without inventing evidence", async () => {
  const encoded = await readFile(
    new URL("./fixtures/mip/complete-investigation.mip.b64", import.meta.url),
    "ascii",
  );
  const bytes = new Uint8Array(Buffer.from(encoded.trim(), "base64"));
  const core = new InvestigationCore();
  const baseline = core.import(bytes, { identifier: "explorer-mip-baseline" });
  const candidate = core.import(bytes, { identifier: "explorer-mip-candidate" });
  const report = core.regression(baseline.identifier, candidate.identifier);
  const result = core.investigate(JSON.parse(JSON.stringify(report)));

  assert.equal(result.status, "empty");
  assert.equal(result.matchCount, 0);
  assert.equal(result.workspaceIdentifier, report.baseline.workspaceIdentifier);
  assert.deepEqual(result.matches, []);
});

test("MO-1207 Explorer remains renderer-independent and performs no investigation execution", async () => {
  const source = await readFile(
    new URL("../web/js/cognitive-investigation-explorer.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /\b(?:window|document|HTMLElement|Canvas|WebGL|requestAnimationFrame|setTimeout|setInterval|Date\.now|Math\.random)\b/u);
  assert.doesNotMatch(source, /(?:querySelector|addEventListener|classList|\.style\b)/u);
  assert.doesNotMatch(source, /from\s+["']\.\/(?:app|graph|graph-view-state|cognitive-replay|cognitive-trace)\.js["']/u);
  assert.doesNotMatch(source, /\b(?:buildCognitiveTrace|buildCognitiveReplay|advanceReplay|compareCognitiveRegression)\b/u);
  assert.doesNotMatch(source, /(?:score|rank|predict|infer|explain|summarize|recommend)/iu);
  assert.deepEqual(
    [...source.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1]),
    ["./cognitive-regression.js", "./mip-canonical.js"],
  );
});
