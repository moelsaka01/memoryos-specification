import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { referenceSnapshot } from "../web/data/studio-snapshot.js";
import {
  COGNITIVE_REGRESSION_VERSION,
  RegressionCategory,
  compareCognitiveRegression,
  validateCognitiveRegression,
} from "../web/js/cognitive-regression.js";
import {
  InvestigationCore,
  InvestigationCoreError,
  projectInvestigation,
} from "../web/js/investigation-core.js";
import {
  exportMemoryInvestigationPackage,
  importMemoryInvestigationPackage,
} from "../web/js/memory-investigation-package.js";
import { canonicalize, deepFreeze } from "../web/js/mip-canonical.js";
import { cloneDetached } from "../web/js/studio-model.js";

const categoryOrder = Object.freeze([
  "replay",
  "reflection",
  "evidence",
  "retrieval",
  "evolution",
  "verification",
  "transition",
  "lifecycle",
]);

function category(report, name) {
  return report.categories.find((entry) => entry.category === name);
}

function snapshot(mutator = () => {}) {
  const value = cloneDetached(referenceSnapshot);
  mutator(value);
  return value;
}

function reflectionKey(investigation) {
  const node = investigation.state.currentFrame.world.nodes.find(({ observationPath }) => (
    observationPath === "Reflection.values[0]"
  ));
  assert.ok(node);
  return node.key;
}

function nativePair(candidateSnapshot = referenceSnapshot, suffix = "pair") {
  const core = new InvestigationCore();
  const baseline = core.create({ identifier: `regression-baseline-${suffix}`, snapshot: referenceSnapshot });
  const candidate = core.create({ identifier: `regression-candidate-${suffix}`, snapshot: candidateSnapshot });
  return { baseline, candidate, core };
}

function completeReplay(core, identifier) {
  let investigation = core.load(identifier);
  let guard = 0;
  while (investigation.state.replayState.status !== "completed") {
    investigation = core.replay(identifier, "next");
    guard += 1;
    assert.ok(guard < 10_000);
  }
  return investigation;
}

async function mipFixture(name = "complete-investigation.mip.b64") {
  const encoded = await readFile(new URL(`./fixtures/mip/${name}`, import.meta.url), "ascii");
  return new Uint8Array(Buffer.from(encoded.trim(), "base64"));
}

function packageDraft(source, packageIdentifier, mutate = () => {}) {
  const observations = structuredClone(source.observations);
  mutate(observations);
  return exportMemoryInvestigationPackage({
    comparativeReconstructions: [],
    evolutions: [],
    extensions: {},
    metadata: source.metadata,
    observations,
    packageIdentifier,
    replays: [],
    sourceAccepted: true,
    sourceAuthorshipAttested: true,
    traces: [],
    workspaceIdentifier: source.manifest.workspaceIdentifier,
  });
}

test("MO-1206 regression reports use the closed immutable deterministic contract", () => {
  const { baseline, candidate, core } = nativePair(referenceSnapshot, "contract");
  const report = core.regression(baseline.identifier, candidate.identifier);

  assert.equal(COGNITIVE_REGRESSION_VERSION, "1.0.0");
  assert.deepEqual(Object.values(RegressionCategory), categoryOrder);
  assert.equal(report.kind, "MemoryOSCognitiveRegressionReport");
  assert.equal(report.version, "1.0.0");
  assert.match(report.identifier, /^regression:[0-9a-f]{64}$/u);
  assert.equal(report.regressionDetected, false);
  assert.equal(report.overall, "identical");
  assert.deepEqual(report.categories.map(({ category: name }) => name), categoryOrder);
  assert.ok(report.categories.every(({ status, differences }) => (
    status === "identical" && differences.length === 0
  )));
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.categories), true);
  assert.equal(Object.isFrozen(report.categories[0].differences), true);
  assert.equal(validateCognitiveRegression(report), true);
  assert.deepEqual(compareCognitiveRegression(baseline, candidate), report);
  const invalid = structuredClone(report);
  [invalid.categories[0], invalid.categories[1]] = [invalid.categories[1], invalid.categories[0]];
  assert.throws(
    () => validateCognitiveRegression(deepFreeze(invalid)),
    /fixed deterministic contract/,
  );
  assert.throws(
    () => compareCognitiveRegression(structuredClone(baseline), candidate),
    /immutable Investigation Core investigation/,
  );
});

test("MO-1206 detects added removed and modified evidence facts directionally", () => {
  const modified = nativePair(snapshot((value) => {
    value.longTermMemory.entries[0].value = "Modified deterministic evidence.";
  }), "evidence-modified");
  const modifiedReport = modified.core.regression(modified.baseline.identifier, modified.candidate.identifier);
  assert.deepEqual(category(modifiedReport, "evidence").differences.map(({ change }) => change), ["modified"]);

  const added = nativePair(snapshot((value) => {
    value.longTermMemory.entries.push({
      archived: false,
      identifier: "ltm-regression-added",
      value: "Added deterministic evidence.",
    });
  }), "evidence-added");
  const addedReport = added.core.regression(added.baseline.identifier, added.candidate.identifier);
  assert.deepEqual(category(addedReport, "evidence").differences.map(({ change }) => change), ["added"]);
  const reversed = added.core.regression(added.candidate.identifier, added.baseline.identifier);
  assert.deepEqual(category(reversed, "evidence").differences.map(({ change }) => change), ["removed"]);
  assert.equal(
    category(addedReport, "evidence").differences[0].afterDigest,
    category(reversed, "evidence").differences[0].beforeDigest,
  );

  const removed = nativePair(snapshot((value) => {
    value.longTermMemory.entries = value.longTermMemory.entries.filter(({ identifier }) => (
      identifier !== "ltm-004"
    ));
  }), "evidence-removed");
  assert.deepEqual(
    category(removed.core.regression(removed.baseline.identifier, removed.candidate.identifier), "evidence")
      .differences.map(({ change }) => change),
    ["removed"],
  );
});

test("MO-1206 reports Reflection and Retrieval facts without interpreting them", () => {
  const reflection = nativePair(snapshot((value) => {
    value.reflections[0].knowledge = "Changed source-authored Reflection.";
  }), "reflection");
  const reflectionDifference = category(
    reflection.core.regression(reflection.baseline.identifier, reflection.candidate.identifier),
    "reflection",
  );
  assert.equal(reflectionDifference.status, "changed");
  assert.deepEqual(reflectionDifference.differences.map(({ change }) => change), ["modified"]);

  const retrieval = nativePair(snapshot((value) => {
    value.retrievalSessions[0].candidates[0].rankScore += 1;
  }), "retrieval");
  const retrievalDifference = category(
    retrieval.core.regression(retrieval.baseline.identifier, retrieval.candidate.identifier),
    "retrieval",
  );
  assert.equal(retrievalDifference.status, "changed");
  assert.deepEqual(retrievalDifference.differences.map(({ change }) => change), ["modified"]);

  for (const difference of [...reflectionDifference.differences, ...retrievalDifference.differences]) {
    assert.deepEqual(Object.keys(difference), [
      "change", "subject", "beforeDigest", "afterDigest",
    ]);
    assert.match(difference.beforeDigest, /^sha256:[0-9a-f]{64}$/u);
    assert.match(difference.afterDigest, /^sha256:[0-9a-f]{64}$/u);
  }
});

test("MO-1206 detects Replay facts including deterministic Replay state", () => {
  const { baseline, candidate, core } = nativePair(referenceSnapshot, "replay");
  core.trace(baseline.identifier, reflectionKey(baseline));
  core.trace(candidate.identifier, reflectionKey(candidate));
  core.replay(candidate.identifier, "next");

  const report = core.regression(baseline.identifier, candidate.identifier);
  const replay = category(report, "replay");
  assert.equal(replay.status, "changed");
  assert.deepEqual(replay.differences.map(({ change }) => change), ["modified"]);
  assert.equal(category(report, "reflection").status, "identical");
  assert.equal(category(report, "evidence").status, "identical");
  assert.equal(category(report, "retrieval").status, "identical");
});

test("MO-1206 detects exact Evolution artifacts without renderer projections", () => {
  const core = new InvestigationCore();
  const first = snapshot();
  const second = snapshot((value) => { value.observationIdentifier = "regression-observation-second"; });
  const changedSecond = snapshot((value) => {
    value.observationIdentifier = "regression-observation-second";
    value.longTermMemory.entries[0].value = "Evolution changed this evidence.";
  });
  let baseline = core.create({ identifier: "regression-evolution-baseline", snapshot: first });
  baseline = core.observe(baseline.identifier, { snapshot: second });
  let candidate = core.create({ identifier: "regression-evolution-candidate", snapshot: first });
  candidate = core.observe(candidate.identifier, { snapshot: changedSecond });
  core.trace(baseline.identifier, reflectionKey(baseline));
  core.trace(candidate.identifier, reflectionKey(candidate));
  completeReplay(core, baseline.identifier);
  completeReplay(core, candidate.identifier);
  core.compare(baseline.identifier, "enter");
  core.compare(candidate.identifier, "enter");

  const report = core.regression(baseline.identifier, candidate.identifier);
  assert.equal(category(report, "evolution").status, "changed");
  const text = canonicalize(report);
  assert.doesNotMatch(text, /MemoryOSCognitiveEvolutionWorld|MemoryOSCognitiveEvolutionView/u);
  assert.doesNotMatch(text, /"(?:x|y|layout|camera|pixel)"/u);
});

test("MO-1206 assigns semantic transformations and relationships to Evolution", () => {
  const transformation = nativePair(snapshot((value) => {
    value.semanticMemory.concepts[0].meaning = "Changed semantic transformation.";
  }), "semantic-transformation");
  const transformationDifferences = category(transformation.core.regression(
    transformation.baseline.identifier,
    transformation.candidate.identifier,
  ), "evolution").differences;
  assert.ok(transformationDifferences.some(({ change, subject }) => (
    change === "modified" && subject.artifact === "semanticTransformation"
  )));

  const relationship = nativePair(snapshot((value) => {
    value.semanticMemory.concepts[0].linkedConceptIdentifiers = [];
  }), "semantic-relationship");
  const relationshipDifferences = category(relationship.core.regression(
    relationship.baseline.identifier,
    relationship.candidate.identifier,
  ), "evolution").differences;
  assert.ok(relationshipDifferences.some(({ change, subject }) => (
    change === "removed" && subject.artifact === "relationship"
  )));
});

test("MO-1206 detects Verification Transition and Lifecycle facts independently", () => {
  const verification = nativePair(referenceSnapshot, "verification");
  verification.core.verify(verification.candidate.identifier);
  const verificationReport = verification.core.regression(
    verification.baseline.identifier,
    verification.candidate.identifier,
  );
  assert.equal(category(verificationReport, "verification").status, "changed");
  assert.equal(category(verificationReport, "transition").status, "changed");
  assert.equal(category(verificationReport, "lifecycle").status, "changed");

  const transition = nativePair(referenceSnapshot, "transition");
  transition.core.observe(transition.candidate.identifier, { snapshot: referenceSnapshot });
  const transitionReport = transition.core.regression(
    transition.baseline.identifier,
    transition.candidate.identifier,
  );
  assert.equal(category(transitionReport, "transition").status, "changed");
  assert.equal(category(transitionReport, "lifecycle").status, "identical");
  assert.equal(category(transitionReport, "evidence").status, "identical");
  assert.equal(category(transitionReport, "reflection").status, "identical");
  assert.equal(category(transitionReport, "retrieval").status, "identical");

  const lifecycle = nativePair(referenceSnapshot, "lifecycle");
  lifecycle.core.archive(lifecycle.candidate.identifier);
  assert.equal(category(lifecycle.core.regression(
    lifecycle.baseline.identifier,
    lifecycle.candidate.identifier,
  ), "lifecycle").status, "changed");
});

test("MO-1206 preserves native Observation transition history after state convergence", () => {
  const core = new InvestigationCore();
  const priorBaseline = snapshot((value) => {
    value.observationIdentifier = "regression-prior-baseline";
    value.longTermMemory.entries[0].value = "Earlier baseline evidence.";
  });
  const priorCandidate = snapshot((value) => {
    value.observationIdentifier = "regression-prior-candidate";
    value.longTermMemory.entries[0].value = "Earlier candidate evidence.";
  });
  const converged = snapshot((value) => {
    value.observationIdentifier = "regression-converged";
  });
  const baseline = core.create({
    identifier: "regression-history-baseline",
    snapshot: priorBaseline,
  });
  const candidate = core.create({
    identifier: "regression-history-candidate",
    snapshot: priorCandidate,
  });
  core.observe(baseline.identifier, { snapshot: converged });
  core.observe(candidate.identifier, { snapshot: converged });

  const report = core.regression(baseline.identifier, candidate.identifier);
  assert.equal(category(report, "evidence").status, "identical");
  assert.equal(category(report, "reflection").status, "identical");
  assert.equal(category(report, "retrieval").status, "identical");
  assert.equal(category(report, "transition").status, "changed");
  assert.deepEqual(
    category(report, "transition").differences.map(({ change, subject }) => ({
      change,
      index: subject.index,
    })),
    [{ change: "modified", index: 1 }],
  );
});

test("MO-1206 compares verified MIP cognition and ignores local aliases and package metadata", async () => {
  const bytes = await mipFixture();
  const core = new InvestigationCore();
  const baseline = core.import(bytes, { identifier: "local-regression-baseline" });
  const candidate = core.import(bytes, { identifier: "local-regression-candidate" });
  const beforeBaseline = baseline.transitionLog.digest;
  const beforeCandidate = candidate.transitionLog.digest;
  const first = core.regression(baseline.identifier, candidate.identifier);
  const second = core.regression(baseline.identifier, candidate.identifier);

  assert.deepEqual(first, second);
  assert.equal(first.overall, "identical");
  assert.equal(first.baseline.sourceIdentifier, "mip-reference-complete");
  assert.equal(first.candidate.sourceIdentifier, "mip-reference-complete");
  assert.equal(core.load(baseline.identifier).transitionLog.digest, beforeBaseline);
  assert.equal(core.load(candidate.identifier).transitionLog.digest, beforeCandidate);

  const minimal = await mipFixture("minimal-observation.mip.b64");
  const extended = await mipFixture("noncritical-extension.mip.b64");
  const metadataCore = new InvestigationCore();
  metadataCore.import(minimal, { identifier: "metadata-baseline" });
  metadataCore.import(extended, { identifier: "metadata-candidate" });
  const metadataReport = metadataCore.regression("metadata-baseline", "metadata-candidate");
  assert.equal(metadataReport.overall, "identical");
  assert.ok(metadataReport.categories.every(({ status }) => status === "identical"));

  const extensionPackage = importMemoryInvestigationPackage(extended);
  const extensionName = Object.keys(extensionPackage.extensions)[0];
  assert.ok(extensionName);
  const compatibilityCore = new InvestigationCore();
  compatibilityCore.import(extended, { identifier: "compatibility-baseline" });
  compatibilityCore.import(extended, {
    identifier: "compatibility-candidate",
    supportedExtensions: [extensionName],
  });
  const compatibilityReport = compatibilityCore.regression(
    "compatibility-baseline",
    "compatibility-candidate",
  );
  assert.equal(compatibilityReport.overall, "identical");
  assert.equal(category(compatibilityReport, "transition").status, "identical");
});

test("MO-1206 uses MIP cognition digests and reports only validated source facts", async () => {
  const source = importMemoryInvestigationPackage(await mipFixture());
  const baselineBytes = packageDraft(source, "regression-package-baseline");
  const candidateBytes = packageDraft(source, "regression-package-candidate", (observations) => {
    const evidence = observations.at(-1).records.find(({ role }) => role === "evidence");
    evidence.revision = { ...evidence.revision, regressionMarker: "candidate" };
    const transformation = observations.at(-1).records.find(({ role }) => (
      role === "semanticTransformation"
    ));
    transformation.revision = { ...transformation.revision, regressionMarker: "candidate" };
    const relationship = observations.at(-1).relationships[0];
    relationship.revision = { ...relationship.revision, regressionMarker: "candidate" };
  });
  const core = new InvestigationCore();
  const baseline = core.import(baselineBytes, { identifier: "cognition-baseline" });
  const candidate = core.import(candidateBytes, { identifier: "cognition-candidate" });
  const report = core.regression(baseline.identifier, candidate.identifier);

  assert.equal(category(report, "evidence").status, "changed");
  assert.ok(category(report, "evolution").differences.some(({ subject }) => (
    subject.artifact === "semanticTransformation"
  )));
  assert.ok(category(report, "evolution").differences.some(({ change, subject }) => (
    change === "modified" && subject.artifact === "relationship"
  )));
  assert.equal(category(report, "transition").status, "changed");
  assert.equal(category(report, "verification").status, "identical");
  assert.equal(report.regressionDetected, true);
  assert.equal(report.overall, "regressionDetected");
});

test("MO-1206 Regression is read-only atomic and enforces Core boundaries", async () => {
  const { baseline, candidate, core } = nativePair(referenceSnapshot, "read-only");
  const beforeBaseline = {
    digest: baseline.transitionLog.digest,
    projection: canonicalize(projectInvestigation(baseline)),
  };
  const beforeCandidate = {
    digest: candidate.transitionLog.digest,
    projection: canonicalize(projectInvestigation(candidate)),
  };
  core.regression(baseline.identifier, candidate.identifier);
  assert.equal(core.load(baseline.identifier).transitionLog.digest, beforeBaseline.digest);
  assert.equal(canonicalize(projectInvestigation(core.load(baseline.identifier))), beforeBaseline.projection);
  assert.equal(core.load(candidate.identifier).transitionLog.digest, beforeCandidate.digest);
  assert.equal(canonicalize(projectInvestigation(core.load(candidate.identifier))), beforeCandidate.projection);

  const workspaceCore = new InvestigationCore();
  workspaceCore.create({ identifier: "workspace-a", workspaceIdentifier: "workspace-a" });
  workspaceCore.create({ identifier: "workspace-b", workspaceIdentifier: "workspace-b" });
  assert.throws(
    () => workspaceCore.regression("workspace-a", "workspace-b"),
    (error) => error instanceof InvestigationCoreError
      && error.code === "WORKSPACE_MISMATCH" && error.operation === "regression",
  );

  const sourceCore = new InvestigationCore();
  sourceCore.create({ identifier: "native-source", workspaceIdentifier: "workspace-investigation" });
  sourceCore.import(await mipFixture(), { identifier: "mip-source" });
  assert.throws(
    () => sourceCore.regression("native-source", "mip-source"),
    (error) => error instanceof InvestigationCoreError
      && error.code === "SOURCE_KIND_MISMATCH" && error.operation === "regression",
  );
  assert.throws(
    () => sourceCore.regression("missing", "mip-source"),
    (error) => error instanceof InvestigationCoreError
      && error.code === "NOT_FOUND" && error.operation === "load",
  );
});

test("MO-1206 Regression remains deterministic under repeated bounded analysis", async () => {
  const bytes = await mipFixture();
  const core = new InvestigationCore();
  core.import(bytes, { identifier: "performance-baseline" });
  core.import(bytes, { identifier: "performance-candidate" });
  const expected = canonicalize(core.regression("performance-baseline", "performance-candidate"));
  const started = performance.now();
  for (let index = 0; index < 10; index += 1) {
    assert.equal(
      canonicalize(core.regression("performance-baseline", "performance-candidate")),
      expected,
    );
  }
  assert.ok(performance.now() - started < 5_000, "10 bounded package regressions must complete in five seconds");
});

test("MO-1206 Regression engine remains renderer-independent and interpretation-free", async () => {
  const source = await readFile(new URL("../web/js/cognitive-regression.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\b(?:window|document|HTMLElement|Canvas|WebGL|requestAnimationFrame|setTimeout|setInterval|Date\.now|Math\.random)\b/u);
  assert.doesNotMatch(source, /(?:querySelector|addEventListener|classList|\.style\b)/u);
  assert.doesNotMatch(source, /(?:score|rank|predict|infer|explain|summarize|recommend)/iu);
  assert.doesNotMatch(source, /from\s+["']\.\/(?:app|graph|graph-view-state)\.js["']/u);
  assert.deepEqual(
    [...source.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1]),
    ["./mip-canonical.js"],
  );
});
