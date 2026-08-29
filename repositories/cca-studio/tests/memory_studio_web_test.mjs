import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { referenceSnapshot, scopeDefinitions } from "../web/data/studio-snapshot.js";
import {
  buildGraph,
  cloneDetached,
  findObservation,
  inspectSnapshot,
  observeSnapshot,
  resolveInspectionDetails,
  summarizeSnapshot,
  summaryLines,
  traceSnapshot,
} from "../web/js/studio-model.js";
import { createReferenceAdapter, operationNames, resolveCommandAdapter } from "../web/js/host-adapter.js";
import {
  createGraphViewState,
  endGraphFollow,
  reconcileGraphViewState,
  selectGraphNode,
  toggleGraphFollow,
} from "../web/js/graph-view-state.js";
import {
  appendObservationFrame,
  createObservationTimeline,
  diffSemanticWorld,
} from "../web/js/observation-timeline.js";
import {
  canonicalObservation,
  createSemanticWorld,
  fingerprintObservation,
  semanticWorldLayout,
} from "../web/js/semantic-world.js";
import {
  buildCognitiveTrace,
  CognitiveTraceError,
  createCognitiveTraceQuery,
  deserializeCognitiveTrace,
  queryCognitiveTrace,
  resolveCognitiveTraceTarget,
  serializeCognitiveTrace,
  validateCognitiveTrace,
} from "../web/js/cognitive-trace.js";
import {
  advanceReplay,
  buildCognitiveReplay,
  createReplayState,
  nextReplayStep,
  pauseReplay,
  playReplay,
  previousReplayStep,
  projectReplay,
  restartReplay,
  restoreReplayState,
  snapshotReplayState,
} from "../web/js/cognitive-replay.js";
import {
  cognitiveRegionDefinitions,
  prepareComparativeRenderingState,
  prepareEvolutionRenderingState,
  prepareTraceJourney,
  prepareTraceRenderingState,
} from "../web/js/graph.js";
import {
  compareCognitiveEvolution,
  validateCognitiveEvolution,
} from "../web/js/cognitive-evolution.js";
import {
  compareEvolution,
  createEvolutionController,
  evolutionFrames,
  nextEvolutionObservation,
  previousEvolutionObservation,
  reconcileEvolutionController,
} from "../web/js/cognitive-evolution-controller.js";
import {
  buildComparativeReconstruction,
  ComparativeReconstructionError,
  validateComparativeReconstruction,
} from "../web/js/cognitive-comparative-reconstruction.js";
import {
  advanceComparativeReplay,
  createComparativeReplayState,
  nextComparativeStep,
  pauseComparativeReplay,
  playComparativeReplay,
  previousComparativeStep,
  projectComparativeReplay,
  resetComparativeReplay,
} from "../web/js/cognitive-comparative-replay.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(testDirectory, "..");

function observationFrameFor(observation = referenceSnapshot, sequence = 0) {
  let timeline = createObservationTimeline();
  let current = null;
  for (let index = 0; index <= sequence; index += 1) {
    const accepted = appendObservationFrame(timeline, {
      snapshot: observation,
      graph: buildGraph(observation),
      operation: index === 0 ? "InitialObservation" : "Observe",
      resultCode: "OK",
    });
    timeline = accepted.frames;
    current = accepted.current;
  }
  return current;
}

function observationPair(before, after, graphForAfter = buildGraph(after)) {
  const first = appendObservationFrame(createObservationTimeline(), {
    snapshot: before,
    graph: buildGraph(before),
    operation: "InitialObservation",
    resultCode: "OK",
  });
  const second = appendObservationFrame(first.frames, {
    snapshot: after,
    graph: graphForAfter,
    operation: "Observe",
    resultCode: "OK",
  });
  return { from: first.current, to: second.current, frames: second.frames };
}

function referenceReflectionNode(frame) {
  return frame.world.nodes.find((node) => node.observationPath === "Reflection.values[0]")
    ?? frame.world.nodes.find((node) => (
      node.family === "Reflection" && node.identifier === "reflection-release-integrity"
    ));
}

function comparativeReconstructionFor(before, after) {
  const pair = observationPair(before, after);
  const fromTarget = referenceReflectionNode(pair.from);
  const toTarget = referenceReflectionNode(pair.to);
  assert.ok(fromTarget && toTarget, "the fixture must expose the same Reflection investigation in both observations");
  const fromTrace = buildCognitiveTrace(pair.from, fromTarget.key);
  const toTrace = buildCognitiveTrace(pair.to, toTarget.key);
  return {
    pair,
    fromTrace,
    toTrace,
    reconstruction: buildComparativeReconstruction(pair.from, fromTrace, pair.to, toTrace),
  };
}

function applicationFunctionSource(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `${name} must remain an explicit application boundary`);
  assert.notEqual(end, -1, `${nextName} must delimit ${name}`);
  return source.slice(start, end);
}

function freezeFixture(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeFixture);
  return Object.freeze(value);
}

test("the visual query model exposes the frozen scope order", () => {
  assert.deepEqual(scopeDefinitions.map(({ value }) => value), [
    "Complete",
    "Memory",
    "WorkingMemory",
    "LongTermMemory",
    "SemanticMemory",
    "EpisodicMemory",
    "ProceduralMemory",
    "Retrieval",
    "Consolidation",
    "Reflection",
    "Providers",
  ]);
});

test("complete summaries use the exact closed key contract and fixed order", () => {
  assert.deepEqual(summaryLines(referenceSnapshot, "Complete"), [
    "Memory.entries=4",
    "WorkingMemory.active=true",
    "WorkingMemory.entries=3",
    "LongTermMemory.entries=5",
    "LongTermMemory.archived=1",
    "SemanticMemory.concepts=3",
    "EpisodicMemory.episodes=3",
    "ProceduralMemory.procedures=2",
    "Retrieval.sessions=2",
    "Retrieval.sessions.Ready=1",
    "Retrieval.sessions.Started=1",
    "Retrieval.sessions.Forgotten=0",
    "Retrieval.candidates=3",
    "Consolidation.sessions=2",
    "Consolidation.sessions.Pristine=1",
    "Consolidation.sessions.Analyzed=0",
    "Consolidation.sessions.Promoted=0",
    "Consolidation.sessions.Retained=1",
    "Consolidation.sessions.Forgotten=0",
    "Consolidation.candidates=1",
    "Reflection.values=1",
    "Reflection.sessions=1",
    "Reflection.sessions.Pristine=0",
    "Reflection.sessions.Prepared=0",
    "Reflection.sessions.Derived=1",
    "Reflection.sessions.Forgotten=0",
    "Reflection.sources=4",
    "Providers.sessions=2",
    "Providers.sessions.Open=1",
    "Providers.sessions.Exported=1",
    "Providers.sessions.Imported=0",
    "Providers.sessions.Forgotten=0",
    "Providers.descriptors=3",
  ]);
});

test("inspection is exact, case-sensitive, deterministic, and does not search content", () => {
  const exact = inspectSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "Complete",
    identifier: "ltm-001",
  });
  assert.equal(exact.code, "OK");
  assert.deepEqual(exact.observations, ["LongTermMemory.entries[0]"]);
  assert.notEqual(exact.view, referenceSnapshot);
  assert.notEqual(exact.view.longTermMemory, referenceSnapshot.longTermMemory);

  const wrongCase = inspectSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "LongTermMemory",
    identifier: "LTM-001",
  });
  assert.equal(wrongCase.code, "NOT_FOUND");

  const content = inspectSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "LongTermMemory",
    identifier: "Workspace ownership is invariant.",
  });
  assert.equal(content.code, "NOT_FOUND");
});

test("inspection details resolve every returned location from the detached result view", () => {
  const changed = cloneDetached(referenceSnapshot);
  changed.longTermMemory.entries[0].value = "newly observed value";
  const longTerm = inspectSnapshot(changed, "Observed", {
    workspaceIdentifier: changed.workspaceIdentifier,
    scope: "LongTermMemory",
    identifier: "ltm-001",
  });
  assert.equal(resolveInspectionDetails(longTerm.view, longTerm.observations)[0].value.value, "newly observed value");

  const consolidation = inspectSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "Consolidation",
    identifier: "ltm-006",
  });
  assert.deepEqual(consolidation.observations, ["Consolidation.sessions[0]"]);
  const [detail] = resolveInspectionDetails(consolidation.view, consolidation.observations);
  assert.equal(detail.family, "Consolidation session");
  assert.equal(detail.value.identifier, "consolidation-session-001");
  assert.equal(detail.value.candidate.longTermMemoryIdentifier, "ltm-006");
});

test("trace exposes only released Retrieval and Reflection chains", () => {
  const trace = traceSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "Complete",
    identifier: "sem-ownership",
  });
  assert.equal(trace.code, "OK");
  assert.deepEqual(trace.explanationChains, [["ltm-001", "sem-ownership"]]);

  const invalid = traceSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "SemanticMemory",
    identifier: "",
  });
  assert.equal(invalid.code, "INVALID_QUERY");

  const retrievalSessionIdentifier = traceSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "Retrieval",
    identifier: "retrieval-session-001",
  });
  assert.equal(retrievalSessionIdentifier.code, "NOT_FOUND");

  const reflectionSessionIdentifier = inspectSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "Reflection",
    identifier: "reflection-session-001",
  });
  assert.equal(reflectionSessionIdentifier.code, "NOT_FOUND");
});

test("ReflectionSession sources remain inspectable and traceable without a standalone Reflection", () => {
  const sessionOnly = cloneDetached(referenceSnapshot);
  sessionOnly.reflections = [];
  const query = {
    workspaceIdentifier: sessionOnly.workspaceIdentifier,
    scope: "Reflection",
    identifier: "sem-determinism",
  };
  const inspection = inspectSnapshot(sessionOnly, "Observed", query);
  assert.deepEqual(inspection.observations, ["Reflection.sessions[0].sources[0]"]);
  assert.equal(resolveInspectionDetails(inspection.view, inspection.observations)[0].value.sourceIdentifier, "sem-determinism");
  assert.deepEqual(traceSnapshot(sessionOnly, "Observed", query).explanationChains, [["ltm-002", "sem-determinism"]]);
  assert.deepEqual(traceSnapshot(sessionOnly, "Observed", {
    ...query,
    identifier: "reflection-release-integrity",
  }).explanationChains, [
    ["ltm-002", "sem-determinism"],
    ["ltm-001", "ltm-002", "proc-release-review"],
  ]);
});

test("duplicate Retrieval source identities preserve every kind and path", () => {
  const duplicate = cloneDetached(referenceSnapshot);
  duplicate.retrievalSessions[0].candidates.push({
    kind: "Episodic",
    workspaceIdentifier: duplicate.workspaceIdentifier,
    sourceIdentifier: "sem-ownership",
    rankScore: 80,
    explanationChain: ["ltm-003", "sem-ownership"],
  });
  const result = inspectSnapshot(duplicate, "Observed", {
    workspaceIdentifier: duplicate.workspaceIdentifier,
    scope: "Retrieval",
    identifier: "sem-ownership",
  });
  assert.deepEqual(result.observations, [
    "Retrieval.sessions[0].candidates[0]",
    "Retrieval.sessions[0].candidates[3]",
  ]);
  assert.deepEqual(resolveInspectionDetails(result.view, result.observations).map(({ value }) => value.kind), ["Semantic", "Episodic"]);
});

test("session and query failures use the frozen result codes", () => {
  const query = {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "Complete",
    identifier: "",
  };
  assert.equal(summarizeSnapshot(referenceSnapshot, "Forgotten", query).code, "SESSION_FORGOTTEN");
  assert.equal(summarizeSnapshot(referenceSnapshot, "Open", query).code, "SESSION_NOT_OBSERVED");
  assert.equal(summarizeSnapshot(referenceSnapshot, "Observed", { ...query, identifier: "mem-001" }).code, "INVALID_QUERY");
  assert.equal(inspectSnapshot(referenceSnapshot, "Observed", { ...query, workspaceIdentifier: "another-workspace" }).code, "WORKSPACE_MISMATCH");
});

test("observe validates every released outer and nested Workspace location", () => {
  assert.equal(observeSnapshot(referenceSnapshot, "Observed", referenceSnapshot).code, "OK");
  const mismatches = [
    ["aggregate", (view) => { view.memory.workspaceIdentifier = "wrong"; }],
    ["Retrieval session", (view) => { view.retrievalSessions[0].workspaceIdentifier = "wrong"; }],
    ["Retrieval candidate", (view) => { view.retrievalSessions[0].candidates[0].workspaceIdentifier = "wrong"; }],
    ["Consolidation session", (view) => { view.consolidationSessions[0].workspaceIdentifier = "wrong"; }],
    ["Consolidation request", (view) => { view.consolidationSessions[0].request.workspaceIdentifier = "wrong"; }],
    ["Consolidation candidate", (view) => { view.consolidationSessions[0].candidate.workspaceIdentifier = "wrong"; }],
    ["Consolidation WorkingMemory", (view) => { view.consolidationSessions[0].workingMemory.workspaceIdentifier = "wrong"; }],
    ["Consolidation LongTermMemory", (view) => { view.consolidationSessions[0].longTermMemory.workspaceIdentifier = "wrong"; }],
    ["Reflection", (view) => { view.reflections[0].workspaceIdentifier = "wrong"; }],
    ["Reflection source", (view) => { view.reflections[0].sources[0].workspaceIdentifier = "wrong"; }],
    ["Reflection session", (view) => { view.reflectionSessions[0].workspaceIdentifier = "wrong"; }],
    ["Reflection query", (view) => { view.reflectionSessions[0].query.workspaceIdentifier = "wrong"; }],
    ["Reflection session source", (view) => { view.reflectionSessions[0].sources[0].workspaceIdentifier = "wrong"; }],
    ["Session Reflection", (view) => { view.reflectionSessions[0].reflection.workspaceIdentifier = "wrong"; }],
    ["Session Reflection source", (view) => { view.reflectionSessions[0].reflection.sources[0].workspaceIdentifier = "wrong"; }],
    ["Provider session", (view) => { view.providerSessions[0].workspaceIdentifier = "wrong"; }],
    ["Provider descriptor", (view) => { view.providerSessions[0].descriptors[0].workspaceIdentifier = "wrong"; }],
  ];
  for (const [label, mutate] of mismatches) {
    const view = cloneDetached(referenceSnapshot);
    mutate(view);
    assert.equal(observeSnapshot(referenceSnapshot, "Observed", view).code, "WORKSPACE_MISMATCH", label);
  }

  const incomplete = cloneDetached(referenceSnapshot);
  delete incomplete.memory;
  assert.equal(observeSnapshot(referenceSnapshot, "Observed", incomplete).code, "INVALID_VIEW");
  incomplete.workspaceIdentifier = "wrong";
  assert.equal(observeSnapshot(referenceSnapshot, "Observed", incomplete).code, "WORKSPACE_MISMATCH");
});

test("the graph contains only explicit observation relationships", () => {
  const graph = buildGraph(referenceSnapshot);
  assert.equal(graph.identity, "Memory intelligence graph");
  assert.match(graph.description, /one deterministic topology/i);
  assert.ok(graph.nodes.some(({ family }) => family === "Workspace"));
  const kinds = new Set(graph.nodes.map(({ kind }) => kind));
  for (const kind of [
    "workspace",
    "memory",
    "working",
    "consolidation",
    "long-term",
    "semantic",
    "episodic",
    "procedural",
    "retrieval",
    "reflection",
    "providers",
    "validation",
  ]) {
    assert.ok(kinds.has(kind), `graph exposes the ${kind} capability`);
  }
  assert.ok(graph.edges.length > 0);
  assert.ok(graph.edges.every(({ relation }) => ["contains", "evidence", "links", "contributes"].includes(relation)));
  assert.equal(graph.edges.some(({ relation }) => relation === "inferred"), false);
  assert.equal(new Set(graph.nodes.map(({ key }) => key)).size, graph.nodes.length);
});

test("equal identifiers in different families retain distinct locations", () => {
  const duplicate = cloneDetached(referenceSnapshot);
  duplicate.memory.entries.push({ identifier: "shared-id", value: "memory" });
  duplicate.longTermMemory.entries.push({ identifier: "shared-id", value: "long-term", archived: false });
  duplicate.semanticMemory.concepts.push({
    identifier: "shared-id",
    meaning: "semantic",
    categories: [],
    linkedConceptIdentifiers: [],
    sourceEntries: [],
  });
  assert.deepEqual(findObservation(duplicate, "shared-id").map(({ family }) => family), ["Memory", "LongTermMemory", "SemanticMemory"]);
  const graph = buildGraph(duplicate);
  const matching = graph.nodes.filter(({ identifier }) => identifier === "shared-id");
  for (const family of ["Memory", "LongTermMemory", "SemanticMemory"]) {
    assert.ok(matching.some((node) => node.family === family), `${family} retains its own graph location`);
  }
  assert.equal(new Set(matching.map(({ key }) => key)).size, matching.length, "every matching graph location has a distinct key");
  assert.equal(new Set(graph.nodes.map(({ key }) => key)).size, graph.nodes.length);
});

test("the semantic world is canonical, stable, and independent of graph input order", () => {
  const graph = buildGraph(referenceSnapshot);
  const metadata = {
    observationIdentifier: referenceSnapshot.observationIdentifier,
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    sessionIdentifier: referenceSnapshot.session.identifier,
    observationFingerprint: fingerprintObservation(referenceSnapshot),
  };
  const first = createSemanticWorld(graph, metadata);
  const reordered = createSemanticWorld({
    ...graph,
    nodes: [...graph.nodes].reverse(),
    edges: [...graph.edges].reverse(),
  }, metadata);

  assert.deepEqual(reordered, first);
  assert.equal(first.layout.identifier, "memoryos-semantic-world-v1");
  assert.equal(first.layout.strategy, "deterministic-semantic-anchors");
  assert.deepEqual(first.layout.viewBox, semanticWorldLayout.viewBox);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.nodes));
  assert.equal(fingerprintObservation({ second: 2, first: 1 }), fingerprintObservation({ first: 1, second: 2 }));
});

test("unrelated topology additions never move existing semantic locations", () => {
  const graph = buildGraph(referenceSnapshot);
  const before = createSemanticWorld(graph);
  const addedKey = "memory:independent-observation:0";
  const after = createSemanticWorld({
    ...graph,
    nodes: [...graph.nodes, {
      key: addedKey,
      identifier: "independent-observation",
      label: "independent-observation",
      kind: "memory",
      family: "Memory",
      size: 5.5,
      revision: "test-revision",
    }],
    edges: [...graph.edges, {
      from: "aggregate:memory",
      to: addedKey,
      relation: "contains",
    }],
  });
  const afterByKey = new Map(after.nodes.map((node) => [node.key, node]));

  before.nodes.forEach((node) => {
    const current = afterByKey.get(node.key);
    assert.ok(current, `${node.key} remains present`);
    assert.deepEqual({ x: current.x, y: current.y }, { x: node.x, y: node.y }, `${node.key} remains fixed`);
  });
});

test("typed source resolution prevents cross-family provenance collisions", () => {
  const collision = cloneDetached(referenceSnapshot);
  const longTerm = { identifier: "shared-source", value: "authoritative evidence", archived: false };
  collision.longTermMemory.entries.push(longTerm);
  collision.semanticMemory.concepts.push({
    identifier: "shared-source",
    meaning: "derived concept with the same text identity",
    categories: [],
    linkedConceptIdentifiers: [],
    sourceEntries: [cloneDetached(longTerm)],
  });
  const graph = buildGraph(collision);
  const longTermNode = graph.nodes.find((node) => node.identifier === "shared-source" && node.family === "LongTermMemory");
  const semanticNode = graph.nodes.find((node) => node.identifier === "shared-source" && node.family === "SemanticMemory");
  assert.ok(longTermNode);
  assert.ok(semanticNode);
  assert.notEqual(longTermNode.key, semanticNode.key);
  assert.ok(graph.edges.some((edge) => edge.relation === "evidence"
    && edge.from === longTermNode.key
    && edge.to === semanticNode.key));
  assert.equal(graph.edges.some((edge) => edge.relation === "evidence" && edge.from === edge.to), false);
});

test("duplicate candidate locations retain exact observation references", () => {
  const duplicate = cloneDetached(referenceSnapshot);
  duplicate.retrievalSessions[0].candidates.push({
    ...cloneDetached(duplicate.retrievalSessions[0].candidates[0]),
    rankScore: 73,
  });
  const candidates = buildGraph(duplicate).nodes
    .filter((node) => node.family === "Retrieval candidate" && node.identifier === "sem-ownership");
  assert.equal(candidates.length, 2);
  assert.equal(new Set(candidates.map(({ key }) => key)).size, 2);
  assert.deepEqual(candidates.map(({ observationPath }) => observationPath), [
    "Retrieval.sessions[0].candidates[0]",
    "Retrieval.sessions[0].candidates[3]",
  ]);
});

test("detail nodes resolve exact category and procedure-step observations", () => {
  const graph = buildGraph(referenceSnapshot);
  const category = graph.nodes.find((node) => node.observationPath === "SemanticMemory.concepts[0].categories[0]");
  const step = graph.nodes.find((node) => node.observationPath === "ProceduralMemory.procedures[0].steps[0]");
  assert.ok(category);
  assert.ok(step);
  assert.deepEqual(resolveInspectionDetails(referenceSnapshot, [category.observationPath]), [{
    path: category.observationPath,
    family: "Semantic category",
    value: "architecture",
  }]);
  assert.deepEqual(resolveInspectionDetails(referenceSnapshot, [step.observationPath]), [{
    path: step.observationPath,
    family: "Procedure step",
    value: "Observe a coherent view",
  }]);
});

test("content-addressed candidate keys survive deterministic reordering and removal", () => {
  const snapshot = cloneDetached(referenceSnapshot);
  const retained = {
    ...cloneDetached(snapshot.retrievalSessions[0].candidates[0]),
    rankScore: 73,
  };
  snapshot.retrievalSessions[0].candidates.push(retained);
  const keyForRetained = (value) => buildGraph(value).nodes.find((node) =>
    node.family === "Retrieval candidate"
      && node.identifier === retained.sourceIdentifier
      && node.revision === canonicalObservation(retained))?.key;
  const initialKey = keyForRetained(snapshot);
  assert.ok(initialKey);

  const reordered = cloneDetached(snapshot);
  reordered.retrievalSessions[0].candidates.reverse();
  assert.equal(keyForRetained(reordered), initialKey);

  const reduced = cloneDetached(snapshot);
  reduced.retrievalSessions[0].candidates = [retained];
  assert.equal(keyForRetained(reduced), initialKey);
});

test("exact canonical revisions detect known short-hash collisions", () => {
  const before = cloneDetached(referenceSnapshot);
  before.memory.entries.push({ identifier: "mem-x", value: "y732c1-zu8t2v" });
  const after = cloneDetached(before);
  after.memory.entries.at(-1).value = "1w50b0e-11vtwzg";
  assert.equal(
    fingerprintObservation(before.memory.entries.at(-1)),
    fingerprintObservation(after.memory.entries.at(-1)),
    "the regression pair intentionally collides in the short display fingerprint",
  );
  assert.notEqual(
    canonicalObservation(before.memory.entries.at(-1)),
    canonicalObservation(after.memory.entries.at(-1)),
  );
  const delta = diffSemanticWorld(createSemanticWorld(buildGraph(before)), createSemanticWorld(buildGraph(after)));
  assert.ok(delta.nodeKeys.includes("memory:mem-x:0"));
});

test("observation frames record only accepted semantic deltas in deterministic sequence", () => {
  let frames = createObservationTimeline();
  const firstResult = appendObservationFrame(frames, {
    snapshot: referenceSnapshot,
    graph: buildGraph(referenceSnapshot),
    operation: "InitialObservation",
    resultCode: "OK",
  });
  frames = firstResult.frames;
  assert.equal(firstResult.current.sequence, 0);
  assert.deepEqual(firstResult.current.activity.nodeKeys, []);
  assert.deepEqual(firstResult.current.activity.edgeKeys, []);

  const changed = cloneDetached(referenceSnapshot);
  changed.longTermMemory.entries[0].value = "new accepted evidence";
  const secondResult = appendObservationFrame(frames, {
    snapshot: changed,
    graph: buildGraph(changed),
    operation: "Observe",
    query: { workspaceIdentifier: changed.workspaceIdentifier, scope: "Complete", identifier: "" },
    resultCode: "OK",
  });
  const second = secondResult.current;
  assert.equal(second.sequence, 1);
  assert.equal(second.activity.edges.added.length, 0);
  assert.equal(second.activity.edges.changed.length, 0);
  assert.equal(second.activity.edges.removed.length, 0);
  assert.ok(second.activity.nodeKeys.includes("aggregate:long-term"));
  const changedEntry = second.world.nodes.find((node) => node.family === "LongTermMemory" && node.identifier === "ltm-001");
  assert.ok(second.activity.nodeKeys.includes(changedEntry.key));
  assert.equal(second.activity.nodeKeys.some((key) => key.includes("sem-ownership")), false);
  assert.ok(Object.isFrozen(second));
  assert.ok(Object.isFrozen(second.snapshot.longTermMemory.entries[0]));
  changed.longTermMemory.entries[0].value = "mutated by caller after acceptance";
  assert.equal(second.snapshot.longTermMemory.entries[0].value, "new accepted evidence");

  const repeated = createSemanticWorld(buildGraph(second.snapshot), {
    frameIndex: second.world.frame.index,
    observationIdentifier: second.snapshot.observationIdentifier,
    workspaceIdentifier: second.snapshot.workspaceIdentifier,
    sessionIdentifier: second.snapshot.session.identifier,
    observationFingerprint: fingerprintObservation(second.snapshot),
    source: second.snapshot.source,
  });
  assert.deepEqual(repeated, second.world);
  assert.deepEqual(diffSemanticWorld(second.world, repeated).nodeKeys, []);
  assert.deepEqual(diffSemanticWorld(second.world, repeated).edgeKeys, []);
});

test("observation timelines enforce success, Workspace, session, and capture semantics", () => {
  const first = appendObservationFrame(createObservationTimeline(), {
    snapshot: referenceSnapshot,
    graph: buildGraph(referenceSnapshot),
    operation: "InitialObservation",
    resultCode: "OK",
  });
  assert.throws(() => appendObservationFrame(first.frames, {
    snapshot: referenceSnapshot,
    graph: buildGraph(referenceSnapshot),
    operation: "Observe",
    resultCode: "FAILED",
  }), /Only successful/);

  const otherWorkspace = cloneDetached(referenceSnapshot);
  otherWorkspace.workspaceIdentifier = "another-workspace";
  assert.throws(() => appendObservationFrame(first.frames, {
    snapshot: otherWorkspace,
    graph: buildGraph(otherWorkspace),
    operation: "Observe",
    resultCode: "OK",
  }), /Workspace boundary/);

  const otherSession = cloneDetached(referenceSnapshot);
  otherSession.session.identifier = "another-studio-session";
  assert.throws(() => appendObservationFrame(first.frames, {
    snapshot: otherSession,
    graph: buildGraph(otherSession),
    operation: "Observe",
    resultCode: "OK",
  }), /session boundary/);

  const recaptured = cloneDetached(referenceSnapshot);
  recaptured.observationIdentifier = "observation-0002";
  const second = appendObservationFrame(first.frames, {
    snapshot: recaptured,
    graph: buildGraph(recaptured),
    operation: "Observe",
    resultCode: "OK",
  }).current;
  assert.deepEqual(second.activity.nodeKeys, [], "capture identity alone is not semantic activity");
  assert.deepEqual(second.activity.edgeKeys, []);
  assert.notEqual(second.world.frame.identifier, first.current.world.frame.identifier, "timeline frames remain unambiguous");
});

test("frame identifiers remain unique when compact diagnostic fingerprints collide", () => {
  const graph = buildGraph(referenceSnapshot);
  const first = createSemanticWorld(graph, {
    frameIndex: 77933,
    observationIdentifier: "observation-fixed",
    observationFingerprint: "62c164de",
  });
  const second = createSemanticWorld(graph, {
    frameIndex: 126328,
    observationIdentifier: "observation-fixed",
    observationFingerprint: "ff4b9ca5",
  });
  assert.equal(first.frame.fingerprint, second.frame.fingerprint, "the regression pair intentionally collides in the compact fingerprint");
  assert.notEqual(first.frame.index, second.frame.index);
  assert.notEqual(first.frame.identifier, second.frame.identifier, "timeline identity includes the collision-free sequence");
});

test("Follow state is stable, transferable, and reconciled without touching observations", () => {
  const world = createSemanticWorld(buildGraph(referenceSnapshot));
  const semantic = world.nodes.find((node) => node.identifier === "sem-ownership" && node.family === "SemanticMemory");
  const procedural = world.nodes.find((node) => node.identifier === "proc-release-review" && node.family === "ProceduralMemory");
  const snapshotFingerprint = canonicalObservation(referenceSnapshot);

  const selected = selectGraphNode(createGraphViewState({ camera: { scale: 1.4, x: 12, y: -8 } }), semantic.key);
  const followed = toggleGraphFollow(selected);
  assert.equal(followed.selectedKey, semantic.key);
  assert.equal(followed.followedKey, semantic.key);
  assert.deepEqual(followed.camera, { scale: 1.4, x: 12, y: -8 });
  assert.deepEqual(reconcileGraphViewState(world, followed), followed);

  const transferred = selectGraphNode(followed, procedural.key);
  assert.equal(transferred.selectedKey, procedural.key);
  assert.equal(transferred.followedKey, procedural.key);
  assert.equal(endGraphFollow(transferred).followedKey, null);

  const removed = { ...world, nodes: world.nodes.filter(({ key }) => key !== procedural.key) };
  const reconciled = reconcileGraphViewState(removed, transferred);
  assert.equal(reconciled.selectedKey, null);
  assert.equal(reconciled.followedKey, null);
  assert.equal(reconcileGraphViewState(world, reconciled).selectedKey, null, "removed selections never resurrect");
  assert.equal(canonicalObservation(referenceSnapshot), snapshotFingerprint, "view interaction never mutates an observation");
});

test("investigation target resolution preserves exact Reflection ownership and cardinality", () => {
  const frame = observationFrameFor();
  const { world } = frame;
  const standalone = world.nodes.find((node) => node.observationPath === "Reflection.values[0]");
  const session = world.nodes.find((node) => node.observationPath === "Reflection.sessions[0]");
  const nested = world.nodes.find((node) => node.observationPath === "Reflection.sessions[0].reflection");
  const aggregate = world.nodes.find((node) => node.key === "aggregate:reflection");
  const semantic = world.nodes.find((node) => node.family === "SemanticMemory");

  assert.ok(standalone && session && nested && aggregate && semantic);
  assert.equal(standalone.identifier, nested.identifier, "the fixture must retain its duplicate public Reflection identity");
  assert.equal(resolveCognitiveTraceTarget(world, standalone.key)?.key, standalone.key);
  assert.equal(resolveCognitiveTraceTarget(world, nested.key)?.key, nested.key);
  assert.equal(resolveCognitiveTraceTarget(world, session.key)?.key, nested.key, "a session resolves only its exact directly owned result");
  assert.equal(resolveCognitiveTraceTarget(world, aggregate.key)?.key, standalone.key, "the aggregate resolves its sole directly owned Reflection value");
  assert.equal(resolveCognitiveTraceTarget(world, semantic.key), null);
  assert.equal(resolveCognitiveTraceTarget(world, "missing"), null);

  const duplicateNested = { ...nested, key: `${nested.key}:duplicate` };
  const ambiguous = {
    ...world,
    nodes: [...world.nodes, duplicateNested].reverse(),
    edges: [...world.edges, { from: session.key, to: duplicateNested.key, relation: "contains" }].reverse(),
  };
  assert.equal(resolveCognitiveTraceTarget(ambiguous, session.key), null, "multiple direct candidates never fall back to collection order");

  const mismatched = {
    ...world,
    edges: world.edges
      .filter((edge) => !(edge.from === session.key && edge.to === nested.key && edge.relation === "contains"))
      .concat({ from: session.key, to: standalone.key, relation: "contains" }),
  };
  assert.equal(resolveCognitiveTraceTarget(mismatched, session.key), null, "a directly contained value with the wrong observation path is rejected");

  const reordered = { ...world, nodes: [...world.nodes].reverse(), edges: [...world.edges].reverse() };
  assert.equal(resolveCognitiveTraceTarget(reordered, session.key)?.key, nested.key);
  assert.equal(resolveCognitiveTraceTarget(reordered, aggregate.key)?.key, standalone.key);
  assert.equal(queryCognitiveTrace(frame, createCognitiveTraceQuery({
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    sessionIdentifier: referenceSnapshot.session.identifier,
    frameIdentifier: frame.world.frame.identifier,
    targetNodeKey: resolveCognitiveTraceTarget(world, aggregate.key).key,
  })).succeeded, true, "the resolved production target constructs a validated trace");
});

test("Cognitive Traces reconstruct every Reflection-owned candidate through a Retrieval boundary", () => {
  const frame = observationFrameFor();
  const target = referenceReflectionNode(frame);
  const trace = buildCognitiveTrace(frame, target.key);

  assert.equal(trace.kind, "MemoryOSCognitiveTrace");
  assert.equal(trace.version, "1.1");
  assert.equal(trace.workspaceIdentifier, referenceSnapshot.workspaceIdentifier);
  assert.equal(trace.sessionIdentifier, referenceSnapshot.session.identifier);
  assert.equal(trace.frameIdentifier, frame.world.frame.identifier);
  assert.equal(trace.frameSequence, frame.sequence);
  assert.equal(trace.targetNodeKey, target.key);
  assert.equal(trace.branches.length, 2);
  assert.deepEqual(trace.branches[0].steps.map(({ role }) => role), [
    "origin-evidence",
    "semantic-transformation",
    "retrieval",
    "reflection-current",
  ]);
  assert.deepEqual(trace.branches[1].steps.map(({ role }) => role), [
    "origin-evidence",
    "origin-evidence",
    "semantic-transformation",
    "retrieval",
    "reflection-current",
  ]);
  assert.equal(trace.branches[1].steps.find(({ role }) => role === "semantic-transformation").direction, "reverse");
  assert.equal(trace.branches[1].steps.find(({ role }) => role === "retrieval").direction, "forward");
  assert.equal(trace.branches.every((branch) => branch.steps.some(({ role }) => role === "retrieval")), true);
  assert.equal(Object.isFrozen(trace), true);
  assert.equal(Object.isFrozen(trace.branches), true);
  assert.equal(Object.isFrozen(trace.branches[0].steps), true);
  assert.equal(validateCognitiveTrace(trace, frame).valid, true);
});

test("Cognitive Trace construction and serialization are deterministic and canonical", () => {
  const frame = observationFrameFor();
  const target = referenceReflectionNode(frame);
  const first = buildCognitiveTrace(frame, target.key);
  const second = buildCognitiveTrace(frame, target.key);
  assert.deepEqual(first, second);
  assert.equal(serializeCognitiveTrace(first), serializeCognitiveTrace(second));

  const serialized = serializeCognitiveTrace(first);
  const restored = deserializeCognitiveTrace(serialized, frame);
  assert.equal(serializeCognitiveTrace(restored), serialized);
  assert.equal(Object.isFrozen(restored.branches[1].steps), true);
});

test("mutable and shallow-frozen Cognitive Traces are rejected and cannot be serialized", () => {
  const frame = observationFrameFor();
  const trace = buildCognitiveTrace(frame, referenceReflectionNode(frame).key);
  const mutable = structuredClone(trace);
  const shallowFrozen = Object.freeze(structuredClone(trace));

  [mutable, shallowFrozen].forEach((candidate) => {
    const validation = validateCognitiveTrace(candidate, frame);
    assert.equal(validation.valid, false);
    assert.equal(validation.issues[0].code, "MUTABLE_TRACE");
    assert.throws(
      () => serializeCognitiveTrace(candidate),
      (error) => error instanceof CognitiveTraceError && error.code === "INVALID_TRACE",
    );
  });
  assert.equal(Object.isFrozen(shallowFrozen), true);
  assert.equal(Object.isFrozen(shallowFrozen.branches), false, "freezing only the root does not establish trace immutability");
});

test("mutable Observation Frame identity replacement invalidates an earlier trace binding", () => {
  const mutableFrame = structuredClone(observationFrameFor());
  const trace = buildCognitiveTrace(mutableFrame, referenceReflectionNode(mutableFrame).key);
  assert.equal(validateCognitiveTrace(trace, mutableFrame).valid, true);

  const changed = cloneDetached(referenceSnapshot);
  changed.reflections[0].query = "Which evidence changed after replacement?";
  const replacement = structuredClone(observationFrameFor(changed));
  Object.keys(mutableFrame).forEach((key) => delete mutableFrame[key]);
  Object.assign(mutableFrame, replacement);

  const validation = validateCognitiveTrace(trace, mutableFrame);
  assert.equal(validation.valid, false);
  assert.equal(
    validation.issues.some(({ code }) => ["FRAME_MISMATCH", "INCONSISTENT_TARGET"].includes(code)),
    true,
  );
});

test("Cognitive Trace queries enforce exact Workspace, session, frame, and typed target bindings", () => {
  const frame = observationFrameFor();
  const target = referenceReflectionNode(frame);
  const query = createCognitiveTraceQuery({
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    sessionIdentifier: referenceSnapshot.session.identifier,
    frameIdentifier: frame.world.frame.identifier,
    targetNodeKey: target.key,
  });
  const result = queryCognitiveTrace(frame, query);
  assert.equal(result.code, "OK");
  assert.equal(result.succeeded, true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.validation.issues), true);

  assert.equal(queryCognitiveTrace(frame, { ...query, workspaceIdentifier: "other-workspace" }).code, "WORKSPACE_MISMATCH");
  assert.equal(queryCognitiveTrace(frame, { ...query, sessionIdentifier: "other-session" }).code, "SESSION_MISMATCH");
  assert.equal(queryCognitiveTrace(frame, { ...query, frameIdentifier: "other-frame" }).code, "FRAME_MISMATCH");
  const semantic = frame.world.nodes.find((node) => node.kind === "semantic" && !node.aggregate && !node.detail);
  assert.equal(queryCognitiveTrace(frame, { ...query, targetNodeKey: semantic.key }).code, "INVALID_TARGET");
  assert.equal(queryCognitiveTrace(frame, { ...query, targetNodeKey: "reflection:missing:0" }).code, "NOT_FOUND");
});

test("Cognitive Trace requires exact Workspace ownership on every owned Reflection location", () => {
  const missingReflectionWorkspace = cloneDetached(referenceSnapshot);
  delete missingReflectionWorkspace.reflections[0].workspaceIdentifier;
  const reflectionFrame = observationFrameFor(missingReflectionWorkspace);
  assert.throws(
    () => buildCognitiveTrace(reflectionFrame, referenceReflectionNode(reflectionFrame).key),
    (error) => error instanceof CognitiveTraceError && error.code === "WORKSPACE_MISMATCH",
  );

  const missingSourceWorkspace = cloneDetached(referenceSnapshot);
  delete missingSourceWorkspace.reflections[0].sources[0].workspaceIdentifier;
  const sourceFrame = observationFrameFor(missingSourceWorkspace);
  assert.throws(
    () => buildCognitiveTrace(sourceFrame, referenceReflectionNode(sourceFrame).key),
    (error) => error instanceof CognitiveTraceError && error.code === "WORKSPACE_MISMATCH",
  );

  const missingSessionWorkspace = cloneDetached(referenceSnapshot);
  missingSessionWorkspace.reflections = [];
  delete missingSessionWorkspace.reflectionSessions[0].reflection.workspaceIdentifier;
  const sessionFrame = observationFrameFor(missingSessionWorkspace);
  const sessionTarget = sessionFrame.world.nodes.find((node) => node.observationPath === "Reflection.sessions[0].reflection");
  assert.throws(
    () => buildCognitiveTrace(sessionFrame, sessionTarget.key),
    (error) => error instanceof CognitiveTraceError && error.code === "WORKSPACE_MISMATCH",
  );
});

test("Cognitive Trace rejects internally inconsistent frame metadata and world projections", () => {
  const frame = observationFrameFor();
  const target = referenceReflectionNode(frame);

  const workspaceTamper = structuredClone(frame);
  workspaceTamper.world.frame.workspaceIdentifier = "another-workspace";
  assert.throws(
    () => buildCognitiveTrace(workspaceTamper, target.key),
    (error) => error instanceof CognitiveTraceError
      && ["WORKSPACE_MISMATCH", "FRAME_MISMATCH"].includes(error.code),
  );

  const sessionTamper = structuredClone(frame);
  sessionTamper.world.frame.sessionIdentifier = "another-session";
  assert.throws(
    () => buildCognitiveTrace(sessionTamper, target.key),
    (error) => error instanceof CognitiveTraceError
      && ["SESSION_MISMATCH", "FRAME_MISMATCH"].includes(error.code),
  );

  const projectionTamper = structuredClone(frame);
  projectionTamper.world.nodes.find((node) => node.key === target.key).revision = canonicalObservation({ forged: true });
  assert.throws(
    () => buildCognitiveTrace(projectionTamper, target.key),
    (error) => error instanceof CognitiveTraceError && error.code === "FRAME_MISMATCH",
  );
});

test("Cognitive Trace rejects missing Reflection-owned evidence atomically", () => {
  const missing = cloneDetached(referenceSnapshot);
  missing.reflections[0].sources[0].semanticConcept.sourceEntries = [];
  const missingFrame = observationFrameFor(missing);
  assert.throws(
    () => buildCognitiveTrace(missingFrame, referenceReflectionNode(missingFrame).key),
    (error) => error instanceof CognitiveTraceError && error.code === "MISSING_EVIDENCE",
  );
});

test("Cognitive Trace remains valid after current source deletion, evidence deletion, and archival", () => {
  const changed = cloneDetached(referenceSnapshot);
  changed.semanticMemory.concepts = changed.semanticMemory.concepts
    .filter(({ identifier }) => identifier !== "sem-determinism");
  changed.proceduralMemory.procedures = changed.proceduralMemory.procedures
    .filter(({ identifier }) => identifier !== "proc-release-review");
  changed.longTermMemory.entries = changed.longTermMemory.entries
    .filter(({ identifier }) => !["ltm-001", "ltm-002"].includes(identifier));
  changed.retrievalSessions = [];
  const changedFrame = observationFrameFor(changed);
  const changedTrace = buildCognitiveTrace(changedFrame, referenceReflectionNode(changedFrame).key);
  assert.equal(changedTrace.branches.length, 2);
  assert.equal(changedTrace.branches.every((branch) => branch.steps.some(({ role }) => role === "origin-evidence")), true);
  assert.equal(changedTrace.branches.every((branch) => branch.steps.some(({ role }) => role === "retrieval")), true);
  assert.equal(validateCognitiveTrace(changedTrace, changedFrame).valid, true);

  const archived = cloneDetached(referenceSnapshot);
  archived.longTermMemory.entries[1].archived = true;
  const archivedFrame = observationFrameFor(archived);
  assert.equal(
    validateCognitiveTrace(
      buildCognitiveTrace(archivedFrame, referenceReflectionNode(archivedFrame).key),
      archivedFrame,
    ).valid,
    true,
  );
});

test("standalone and session-owned Reflections with the same identifier remain independent", () => {
  const independent = cloneDetached(referenceSnapshot);
  independent.reflectionSessions[0].reflection.knowledge = "A separately observed session-owned Reflection.";
  independent.reflectionSessions[0].query.knowledge = independent.reflectionSessions[0].reflection.knowledge;
  independent.reflectionSessions[0].reflection.sources = [cloneDetached(independent.reflectionSessions[0].reflection.sources[0])];
  independent.reflectionSessions[0].sources = cloneDetached(independent.reflectionSessions[0].reflection.sources);
  const frame = observationFrameFor(independent);
  const standaloneTarget = frame.world.nodes.find((node) => node.observationPath === "Reflection.values[0]");
  const sessionTarget = frame.world.nodes.find((node) => node.observationPath === "Reflection.sessions[0].reflection");
  assert.ok(standaloneTarget);
  assert.ok(sessionTarget);
  const standaloneTrace = buildCognitiveTrace(frame, standaloneTarget.key);
  const sessionTrace = buildCognitiveTrace(frame, sessionTarget.key);
  assert.notEqual(standaloneTrace.identifier, sessionTrace.identifier);
  assert.equal(standaloneTrace.branches.length, 2);
  assert.equal(sessionTrace.branches.length, 1);
});

test("a nested session-owned Reflection is traceable without a standalone Reflection", () => {
  const sessionOnly = cloneDetached(referenceSnapshot);
  sessionOnly.reflections = [];
  const frame = observationFrameFor(sessionOnly);
  const target = frame.world.nodes.find((node) => node.observationPath === "Reflection.sessions[0].reflection");
  assert.ok(target);
  const trace = buildCognitiveTrace(frame, target.key);
  assert.equal(trace.targetNodeKey, target.key);
  assert.equal(trace.branches.length, sessionOnly.reflectionSessions[0].sources.length);
  assert.equal(validateCognitiveTrace(trace, frame).valid, true);

  const sessionDefects = [
    ["non-derived state", "INCONSISTENT_EVIDENCE", (view) => { view.reflectionSessions[0].state = "Prepared"; }],
    ["missing query", "INCONSISTENT_EVIDENCE", (view) => { view.reflectionSessions[0].query = null; }],
    ["cross-Workspace query", "WORKSPACE_MISMATCH", (view) => { view.reflectionSessions[0].query.workspaceIdentifier = "another-workspace"; }],
    ["query identifier mismatch", "INCONSISTENT_EVIDENCE", (view) => { view.reflectionSessions[0].query.identifier = "another-reflection"; }],
    ["query knowledge mismatch", "INCONSISTENT_EVIDENCE", (view) => { view.reflectionSessions[0].query.knowledge = "Different derived knowledge."; }],
    ["session/result source mismatch", "INCONSISTENT_EVIDENCE", (view) => { view.reflectionSessions[0].sources[0].chain = ["different-owned-evidence"]; }],
  ];
  sessionDefects.forEach(([label, code, mutate]) => {
    const divergent = cloneDetached(sessionOnly);
    mutate(divergent);
    const divergentFrame = observationFrameFor(divergent);
    const divergentTarget = divergentFrame.world.nodes.find((node) => node.observationPath === "Reflection.sessions[0].reflection");
    assert.throws(
      () => buildCognitiveTrace(divergentFrame, divergentTarget.key),
      (error) => error instanceof CognitiveTraceError && error.code === code,
      label,
    );
  });
});

test("Cognitive Trace preserves typed source identity when identifiers collide across families", () => {
  const collision = cloneDetached(referenceSnapshot);
  collision.semanticMemory.concepts[1].identifier = "shared-derived-id";
  collision.episodicMemory.episodes[0].identifier = "shared-derived-id";
  collision.reflections[0].sources[0].sourceIdentifier = "shared-derived-id";
  collision.reflections[0].sources[0].chain = ["ltm-002", "shared-derived-id"];
  collision.reflections[0].sources[0].semanticConcept.identifier = "shared-derived-id";
  collision.reflections[0].sources[1].sourceIdentifier = "shared-derived-id";
  collision.reflections[0].sources[1].chain = ["ltm-001", "ltm-002", "shared-derived-id"];
  collision.reflections[0].sources[1].procedure.identifier = "shared-derived-id";
  const frame = observationFrameFor(collision);
  const trace = buildCognitiveTrace(frame, referenceReflectionNode(frame).key);
  const transformations = trace.branches.map((branch) => frame.world.nodes.find(
    ({ key }) => key === branch.steps.find(({ role }) => role === "semantic-transformation").nodeKey,
  ));
  assert.deepEqual(transformations.map(({ kind }) => kind), ["semantic", "procedural"]);
  assert.equal(transformations.every(({ identifier }) => identifier === "shared-derived-id"), true);

  const duplicate = cloneDetached(referenceSnapshot);
  duplicate.reflections[0].sources.push(cloneDetached(duplicate.reflections[0].sources[0]));
  const duplicateFrame = observationFrameFor(duplicate);
  assert.throws(
    () => buildCognitiveTrace(duplicateFrame, referenceReflectionNode(duplicateFrame).key),
    (error) => error instanceof CognitiveTraceError && error.code === "AMBIGUOUS_EVIDENCE",
    "a duplicate kind and source identifier is ambiguous even when stored at a distinct path",
  );
});

test("Cognitive Trace validation rejects relationship tampering and never renders a partial trace", () => {
  const frame = observationFrameFor();
  const trace = buildCognitiveTrace(frame, referenceReflectionNode(frame).key);
  const tampered = structuredClone(trace);
  tampered.branches[0].steps[0].edgeKey = "missing-edge";
  freezeFixture(tampered);
  const validation = validateCognitiveTrace(tampered, frame);
  assert.equal(validation.valid, false);
  assert.equal(validation.issues[0].code, "UNKNOWN_RELATIONSHIP");
  assert.throws(() => prepareTraceRenderingState(frame.world, tampered), /absent from the rendered world/);

  const missingWorldEdge = structuredClone(frame);
  const requiredEdge = trace.branches[0].steps[0].edgeKey;
  missingWorldEdge.world.edges = missingWorldEdge.world.edges.filter(({ key }) => key !== requiredEdge);
  assert.throws(
    () => buildCognitiveTrace(missingWorldEdge, trace.targetNodeKey),
    (error) => error instanceof CognitiveTraceError && error.code === "FRAME_MISMATCH",
  );
});

test("Cognitive Trace serialization is reference-only, tamper-evident, and frame-bound", () => {
  const frame = observationFrameFor();
  const trace = buildCognitiveTrace(frame, referenceReflectionNode(frame).key);
  const serialized = serializeCognitiveTrace(trace);
  const parsed = JSON.parse(serialized);
  assert.deepEqual(Object.keys(parsed).sort(), [
    "branches",
    "frameIdentifier",
    "frameSequence",
    "identifier",
    "kind",
    "sessionIdentifier",
    "targetNodeKey",
    "version",
    "workspaceIdentifier",
  ]);
  assert.equal("knowledge" in parsed, false);
  assert.equal("nodes" in parsed, false);
  assert.equal("edges" in parsed, false);
  assert.equal("layout" in parsed, false);
  const decodedKeys = new Set();
  const inspectDecoded = (value) => {
    if (!value || typeof value !== "object") return;
    Object.entries(value).forEach(([key, member]) => {
      decodedKeys.add(key);
      inspectDecoded(member);
    });
  };
  inspectDecoded(parsed);
  [
    "knowledge",
    "meaning",
    "occurrence",
    "activity",
    "value",
    "semanticConcept",
    "episode",
    "procedure",
    "sourceEntries",
    "chain",
    "rankScore",
  ].forEach((payloadKey) => assert.equal(decodedKeys.has(payloadKey), false, `${payloadKey} payload is not serialized`));
  assert.equal(serialized.includes(referenceSnapshot.reflections[0].knowledge), false);
  assert.equal(serialized.includes(referenceSnapshot.longTermMemory.entries[0].value), false);

  const tampered = JSON.parse(serialized);
  tampered.frameSequence += 1;
  assert.throws(() => deserializeCognitiveTrace(JSON.stringify(tampered), frame), CognitiveTraceError);
  assert.throws(() => deserializeCognitiveTrace("{not-json", frame), CognitiveTraceError);
  assert.throws(
    () => serializeCognitiveTrace({ kind: "MemoryOSCognitiveTrace", version: "1.1" }),
    CognitiveTraceError,
  );
  const laterFrame = observationFrameFor(referenceSnapshot, 1);
  assert.throws(() => deserializeCognitiveTrace(serialized, laterFrame), CognitiveTraceError);
});

test("Cognitive Trace addresses are replay-ready and preserve earlier immutable frames", () => {
  const firstFrame = observationFrameFor(referenceSnapshot, 0);
  const secondFrame = observationFrameFor(referenceSnapshot, 1);
  const firstTrace = buildCognitiveTrace(firstFrame, referenceReflectionNode(firstFrame).key);
  const firstBytes = serializeCognitiveTrace(firstTrace);
  const secondTrace = buildCognitiveTrace(secondFrame, referenceReflectionNode(secondFrame).key);
  assert.notEqual(firstTrace.identifier, secondTrace.identifier);
  assert.notEqual(firstTrace.frameIdentifier, secondTrace.frameIdentifier);
  assert.equal(serializeCognitiveTrace(firstTrace), firstBytes);
  assert.equal(serializeCognitiveTrace(deserializeCognitiveTrace(firstBytes, firstFrame)), firstBytes);

  const changedCapture = cloneDetached(referenceSnapshot);
  changedCapture.observationIdentifier = "observation-independent-capture";
  changedCapture.memory.entries[0].value = "A distinct accepted frame with the same local sequence.";
  const independentFrame = observationFrameFor(changedCapture, 0);
  const independentTrace = buildCognitiveTrace(independentFrame, referenceReflectionNode(independentFrame).key);
  assert.notEqual(independentTrace.frameIdentifier, firstTrace.frameIdentifier);
  assert.notEqual(independentTrace.identifier, firstTrace.identifier, "Trace identity includes the collision-free frame address");
});

test("the renderer consumes validated trace membership without computing cognitive journeys", async () => {
  const frame = observationFrameFor();
  const trace = buildCognitiveTrace(frame, referenceReflectionNode(frame).key);
  const rendering = prepareTraceRenderingState(frame.world, trace);
  const expectedNodeKeys = new Set(trace.branches.flatMap(({ steps }) => steps.map(({ nodeKey }) => nodeKey)));
  const expectedEdgeKeys = new Set(trace.branches.flatMap(({ steps }) => steps.map(({ edgeKey }) => edgeKey).filter(Boolean)));
  assert.equal(rendering.active, true);
  assert.deepEqual(new Set(rendering.nodeKeys), expectedNodeKeys);
  assert.deepEqual(new Set(rendering.edgeKeys), expectedEdgeKeys);
  assert.equal(rendering.targetNodeKey, trace.targetNodeKey);
  assert.equal(rendering.orderedSteps.length, 9);
  assert.equal(frame.world.nodes.length > rendering.nodeKeys.length, true);
  const membershipCounts = new Map();
  rendering.orderedSteps.forEach(({ nodeKey }) => {
    membershipCounts.set(nodeKey, (membershipCounts.get(nodeKey) ?? 0) + 1);
  });
  const [sharedNodeKey, sharedMembershipCount] = [...membershipCounts.entries()]
    .find(([, count]) => count > 1);
  assert.ok(sharedNodeKey, "the reference trace contains evidence shared by two branches");
  const sharedRecord = rendering.nodeRecords.find(({ nodeKey }) => nodeKey === sharedNodeKey);
  assert.ok(sharedRecord);
  assert.equal(
    sharedRecord.memberships.length,
    sharedMembershipCount,
    "renderer state preserves every branch membership for shared evidence",
  );

  const rendererSource = await readFile(resolve(studioRoot, "web/js/graph.js"), "utf8");
  const styles = await readFile(resolve(studioRoot, "web/styles.css"), "utf8");
  assert.doesNotMatch(rendererSource, /from\s+["']\.\/cognitive-trace\.js["']/);
  assert.doesNotMatch(rendererSource, /buildCognitiveTrace|queryCognitiveTrace|sourceEntries|explanationChain/);
  assert.match(rendererSource, /prepareTraceRenderingState\(world, trace\)/);
  assert.match(rendererSource, /cognitive-trace-node-label/, "Trace members receive persistent visible labels");
  assert.match(
    styles,
    /\.has-active-trace\s+\.graph-node\.is-trace-step\s*\{[^}]*pointer-events:\s*(?:all|auto)/s,
    "Trace membership overrides layer-filter pointer suppression",
  );
});

test("Living Connectome regions preserve stable cognitive geography without color-only identity", () => {
  assert.deepEqual(
    cognitiveRegionDefinitions.map(({ kind, signature }) => [kind, signature]),
    [
      ["validation", "boundary"],
      ["long-term", "archive"],
      ["semantic", "lattice"],
      ["retrieval", "corridor"],
      ["reflection", "convergence"],
      ["working", "buffer"],
      ["providers", "ports"],
    ],
  );
  cognitiveRegionDefinitions.forEach((region) => {
    assert.equal(Object.isFrozen(region), true);
    assert.equal(Number.isFinite(region.x) && Number.isFinite(region.y), true);
    assert.equal(region.width > 0 && region.height > 0, true);
  });
});

test("Trace Follow derives one deterministic view-only journey from validated membership", () => {
  const frame = observationFrameFor();
  const trace = buildCognitiveTrace(frame, referenceReflectionNode(frame).key);
  const rendering = prepareTraceRenderingState(frame.world, trace);
  const journey = prepareTraceJourney(rendering);

  assert.equal(Object.isFrozen(journey), true);
  assert.equal(journey.length, new Set(journey.map(({ nodeKey }) => nodeKey)).size);
  assert.deepEqual(
    [...new Set(journey.map(({ role }) => role))],
    ["origin-evidence", "semantic-transformation", "retrieval", "reflection-current"],
  );
  assert.deepEqual(journey.map(({ journeyIndex }) => journeyIndex), journey.map((_, index) => index));
  assert.equal(journey.at(-1).nodeKey, trace.targetNodeKey);
  assert.equal(frame.world.nodes.length, 81, "view-only sequencing must not alter the semantic world");
});

test("Cognitive Replay reconstructs only actual trace nodes and relationships in deterministic order", () => {
  const frame = observationFrameFor();
  const trace = buildCognitiveTrace(frame, referenceReflectionNode(frame).key);
  const replay = buildCognitiveReplay(trace);
  const second = buildCognitiveReplay(trace);
  const traceNodes = new Set(trace.branches.flatMap(({ steps }) => steps.map(({ nodeKey }) => nodeKey)));
  const traceEdges = new Set(trace.branches.flatMap(({ steps }) => steps.map(({ edgeKey }) => edgeKey).filter(Boolean)));

  assert.deepEqual(replay, second);
  assert.equal(Object.isFrozen(replay), true);
  assert.equal(replay.steps.every(Object.isFrozen), true);
  assert.equal(replay.steps.every((step) => (
    step.type === "node" ? traceNodes.has(step.nodeKey) : traceEdges.has(step.edgeKey)
  )), true);
  assert.equal(replay.steps.at(-1).nodeKey, trace.targetNodeKey);
  assert.deepEqual(
    [...new Set(replay.steps.map(({ role }) => role))],
    ["origin-evidence", "semantic-transformation", "retrieval", "reflection-current"],
  );
  assert.deepEqual(
    replay.steps.slice(0, 6).map(({ type }) => type),
    ["node", "node", "node", "relationship", "relationship", "relationship"],
    "origin evidence is revealed before the explicit relationships it contributes",
  );
  assert.deepEqual(
    replay.steps.slice(-3).map(({ type }) => type),
    ["relationship", "relationship", "node"],
    "all observed contributions precede the Reflection destination",
  );
});

test("Cognitive Replay play pause restart completion and interruption are exact", () => {
  const frame = observationFrameFor();
  const replay = buildCognitiveReplay(buildCognitiveTrace(frame, referenceReflectionNode(frame).key));
  const ready = createReplayState(replay);
  const playing = playReplay(replay, ready);
  assert.deepEqual(playing, { replayIdentifier: replay.identifier, status: "playing", cursor: 0 });

  const advanced = advanceReplay(replay, playing);
  assert.equal(advanced.cursor, 1);
  const paused = pauseReplay(replay, advanced);
  assert.equal(paused.status, "paused");
  assert.equal(advanceReplay(replay, paused), paused, "paused replay never advances itself");
  assert.equal(nextReplayStep(replay, paused).cursor, 2);
  assert.equal(previousReplayStep(replay, paused).cursor, 0);
  assert.deepEqual(restartReplay(replay, paused), ready);

  let completed = playing;
  while (completed.status !== "completed") completed = advanceReplay(replay, completed);
  assert.equal(completed.cursor, replay.steps.length - 1);
  assert.equal(projectReplay(replay, completed).currentNodeKey, null);
  assert.equal(projectReplay(replay, completed).futureNodeKeys.length, 0);
  assert.equal(projectReplay(replay, completed).futureEdgeKeys.length, 0);
});

test("Cognitive Replay state restoration is immutable frame-bound and deterministic", () => {
  const frame = observationFrameFor();
  const replay = buildCognitiveReplay(buildCognitiveTrace(frame, referenceReflectionNode(frame).key));
  const state = nextReplayStep(replay, nextReplayStep(replay, createReplayState(replay)));
  const snapshot = snapshotReplayState(replay, state);
  const restored = restoreReplayState(replay, snapshot);
  assert.deepEqual(restored, state);
  assert.equal(Object.isFrozen(snapshot), true);

  const nextFrame = observationFrameFor(referenceSnapshot, 1);
  const nextReplay = buildCognitiveReplay(buildCognitiveTrace(nextFrame, referenceReflectionNode(nextFrame).key));
  assert.throws(() => restoreReplayState(nextReplay, snapshot), /not bound/);
});

test("Cognitive Replay remains controller-owned and renderer-independent", async () => {
  const [replaySource, coreSource, appSource, rendererSource, styles] = await Promise.all([
    readFile(resolve(studioRoot, "web/js/cognitive-replay.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/investigation-core.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/app.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/graph.js"), "utf8"),
    readFile(resolve(studioRoot, "web/styles.css"), "utf8"),
  ]);
  assert.doesNotMatch(replaySource, /\bwindow\b|\bdocument\b|setTimeout|setInterval|requestAnimationFrame|Math\.random|Date\./);
  assert.doesNotMatch(rendererSource, /from\s+["']\.\/cognitive-replay\.js["']|buildCognitiveReplay|advanceReplay|playReplay/);
  assert.match(appSource, /investigationCore\.replay\(investigationIdentifier, action\)/);
  assert.match(coreSource, /buildCognitiveReplay\(state\.activeTrace\)/);
  assert.match(coreSource, /projectReplay\(replay, current\)/);
  assert.match(coreSource, /advance: advanceReplay/);
  assert.match(rendererSource, /Cognitive Replay controls/);
  for (const control of ["Play replay", "Pause replay", "Restart replay", "Previous replay step", "Next replay step"]) {
    assert.match(rendererSource, new RegExp(control));
  }
  assert.match(appSource, /event\.code === "Space"/);
  assert.match(appSource, /ArrowLeft: "previous"/);
  assert.match(appSource, /ArrowRight: "next"/);
  const replayStyles = styles.slice(styles.indexOf("MemoryOS 1.1 Sprint 4"));
  assert.match(replayStyles, /\.has-cognitive-replay/);
  assert.doesNotMatch(replayStyles, /animation\s*:/, "Replay visibility never manufactures an animated semantic transition");
});

test("Sprint 5 updates Replay in place and keeps investigation context dominant", async () => {
  const [appSource, rendererSource, styles] = await Promise.all([
    readFile(resolve(studioRoot, "web/js/app.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/graph.js"), "utf8"),
    readFile(resolve(studioRoot, "web/styles.css"), "utf8"),
  ]);
  const updateReplaySource = applicationFunctionSource(appSource, "updateReplay", "scheduleReplay");
  const scheduleReplaySource = applicationFunctionSource(appSource, "scheduleReplay", "escapeHtml");
  assert.match(updateReplaySource, /refreshReplayPresentation\(\)/);
  assert.match(scheduleReplaySource, /refreshReplayPresentation\(\)/);
  assert.match(appSource, /graphController\s*=\s*renderGraph/);
  assert.match(rendererSource, /const updateReplayView\s*=\s*\(nextReplayView\)/);
  assert.match(rendererSource, /return Object\.freeze\(\{ updateReplayView, updateComparativeView \}\)/);
  assert.match(rendererSource, /nextReplayView\.completedNodeKeys/);
  assert.match(rendererSource, /nextReplayView\.completedEdgeKeys/);
  assert.doesNotMatch(rendererSource, /from\s+["']\.\/cognitive-replay\.js["']/);
  assert.match(appSource, /Cognitive investigation/);
  assert.match(appSource, /Return to semantic world/);
  assert.match(appSource, /No inferred steps/);
  assert.match(appSource, /investigation-stages/);
  const polishStyles = styles.slice(styles.indexOf("MemoryOS 1.1 Sprint 5"));
  assert.match(polishStyles, /data-investigation="active"/);
  assert.match(polishStyles, /\.investigation-context/);
  assert.doesNotMatch(polishStyles, /animation\s*:/, "product polish must not manufacture activity");
});

test("Cognitive Evolution reports identical observations without semantic false positives", () => {
  const pair = observationPair(referenceSnapshot, referenceSnapshot);
  const evolution = compareCognitiveEvolution(pair.from, pair.to);
  assert.equal(validateCognitiveEvolution(evolution), true);
  assert.equal(Object.isFrozen(evolution), true);
  assert.equal(Object.isFrozen(evolution.world.nodes), true);
  assert.ok(Object.values(evolution.summary).every((count) => count === 0));
  assert.equal(evolution.view.addedNodeKeys.length, 0);
  assert.equal(evolution.view.removedNodeKeys.length, 0);
  assert.equal(evolution.view.evolvedNodeKeys.length, 0);
  assert.ok(evolution.unchanged.nodeKeys.length > 0);
  assert.ok(evolution.unchanged.relationshipKeys.length > 0);
});

test("Cognitive Evolution distinguishes added removed and evolved cognition from aggregate changes", () => {
  const changed = cloneDetached(referenceSnapshot);
  const removedEvidence = changed.longTermMemory.entries.shift();
  changed.longTermMemory.entries.push({ identifier: "ltm-evolution-added", value: "new evidence", archived: false });
  changed.semanticMemory.concepts[0].meaning = "same concept identity with a new observed meaning";
  changed.retrievalSessions.pop();
  changed.reflections[0].knowledge = "same Reflection identity with new runtime truth";
  const pair = observationPair(referenceSnapshot, changed);
  const evolution = compareCognitiveEvolution(pair.from, pair.to);

  assert.deepEqual(evolution.differences.addedEvidence.map(({ identifier }) => identifier), ["ltm-evolution-added"]);
  assert.deepEqual(evolution.differences.removedEvidence.map(({ identifier }) => identifier), [removedEvidence.identifier]);
  assert.equal(evolution.differences.addedSemanticTransformations.length, 1);
  assert.equal(evolution.differences.removedSemanticTransformations.length, 1);
  assert.equal(evolution.differences.addedReflections.length, 1);
  assert.equal(evolution.differences.removedReflections.length, 1);
  assert.equal(evolution.differences.removedRetrievals.length, 1);
  assert.ok(evolution.view.evolvedNodeKeys.includes("semantic:sem-ownership:0"));
  assert.ok(evolution.view.evolvedNodeKeys.includes("reflection:reflection-release-integrity:0"));
  assert.equal(evolution.differences.addedEvidence.some(({ family }) => /aggregate/i.test(family)), false);

  const worldKeys = new Set(evolution.world.nodes.map(({ key }) => key));
  assert.ok(worldKeys.has(`long-term:${removedEvidence.identifier}:0`), "removed cognition remains visible in the comparison world");
  assert.ok(worldKeys.has("long-term:ltm-evolution-added:0"));
});

test("Cognitive Evolution detects added removed and modified semantic relationships", () => {
  const changed = cloneDetached(referenceSnapshot);
  changed.semanticMemory.concepts[0].linkedConceptIdentifiers = [];
  changed.semanticMemory.concepts[1].linkedConceptIdentifiers.push("sem-ownership");
  changed.reflections[0].sources.reverse();
  const pair = observationPair(referenceSnapshot, changed);
  const evolution = compareCognitiveEvolution(pair.from, pair.to);

  assert.ok(evolution.differences.addedRelationships.length > 0);
  assert.ok(evolution.differences.removedRelationships.length > 0);
  assert.ok(evolution.differences.modifiedRelationships.length > 0);
  assert.deepEqual(
    evolution.view.modifiedRelationshipKeys,
    evolution.differences.modifiedRelationships.map(({ key }) => key),
  );
});

test("Cognitive Evolution rejects graph-only differences that are absent from runtime truth", () => {
  const graph = buildGraph(referenceSnapshot);
  graph.edges.find((edge) => edge.relation === "evidence").validationState = "fabricated";
  const pair = observationPair(referenceSnapshot, referenceSnapshot, graph);
  assert.throws(
    () => compareCognitiveEvolution(pair.from, pair.to),
    /not the canonical projection of runtime truth/,
  );
});

test("Cognitive Evolution comparison is canonical and independent of graph input order", () => {
  const changed = cloneDetached(referenceSnapshot);
  changed.longTermMemory.entries.push({ identifier: "ltm-order-test", value: "order-independent", archived: false });
  const graph = buildGraph(changed);
  const ordered = observationPair(referenceSnapshot, changed, graph);
  const reordered = observationPair(referenceSnapshot, changed, {
    ...graph,
    nodes: [...graph.nodes].reverse(),
    edges: [...graph.edges].reverse(),
  });
  assert.deepEqual(
    compareCognitiveEvolution(reordered.from, reordered.to),
    compareCognitiveEvolution(ordered.from, ordered.to),
  );
});

test("Cognitive Evolution controller exposes only explicit adjacent observation comparison", () => {
  let controller = createEvolutionController(4);
  assert.deepEqual({ from: controller.fromIndex, to: controller.toIndex, active: controller.active }, { from: 2, to: 3, active: false });
  controller = previousEvolutionObservation(controller, 4);
  assert.deepEqual({ from: controller.fromIndex, to: controller.toIndex, active: controller.active }, { from: 1, to: 2, active: false });
  controller = compareEvolution(controller, 4);
  assert.equal(controller.active, true);
  assert.deepEqual({ from: controller.fromIndex, to: controller.toIndex }, { from: 1, to: 2 });
  controller = previousEvolutionObservation(controller, 4);
  assert.deepEqual({ from: controller.fromIndex, to: controller.toIndex }, { from: 0, to: 1 });
  assert.equal(controller.canGoPrevious, false);
  controller = nextEvolutionObservation(controller, 4);
  assert.deepEqual({ from: controller.fromIndex, to: controller.toIndex }, { from: 1, to: 2 });
  assert.deepEqual(evolutionFrames(["zero", "one", "two", "three"], controller), { from: "one", to: "two" });
  assert.equal(reconcileEvolutionController(controller, 5).active, true);
  assert.equal(createEvolutionController(1).available, false);
});

test("the Evolution renderer consumes engine classifications and never computes semantic differences", async () => {
  const changed = cloneDetached(referenceSnapshot);
  changed.longTermMemory.entries.push({ identifier: "ltm-render-test", value: "visible addition", archived: false });
  const pair = observationPair(referenceSnapshot, changed);
  const evolution = compareCognitiveEvolution(pair.from, pair.to);
  const rendering = prepareEvolutionRenderingState(evolution.world, evolution.view);
  assert.deepEqual(rendering.addedNodeKeys, evolution.view.addedNodeKeys);
  assert.deepEqual(rendering.removedRelationshipKeys, evolution.view.removedRelationshipKeys);
  assert.throws(() => prepareEvolutionRenderingState(pair.to.world, evolution.view), /not bound/);

  const [engineSource, rendererSource, appSource, coreSource] = await Promise.all([
    readFile(resolve(studioRoot, "web/js/cognitive-evolution.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/graph.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/app.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/investigation-core.js"), "utf8"),
  ]);
  assert.doesNotMatch(engineSource, /\bwindow\b|\bdocument\b|setTimeout|setInterval|requestAnimationFrame|Math\.random|Date\./);
  assert.doesNotMatch(rendererSource, /from\s+["']\.\/cognitive-evolution\.js["']|compareCognitiveEvolution|canonicalObservation/);
  assert.match(appSource, /investigationCore\.compare\(investigationIdentifier, coreAction\)/);
  assert.match(coreSource, /compareCognitiveEvolution\(pair\.from, pair\.to\)/);
  for (const control of ["Compare", "Previous Observation", "Next Observation"]) {
    assert.match(rendererSource, new RegExp(control));
  }
});

test("Comparative Reconstruction keeps identical investigations unified", () => {
  const { pair, fromTrace, toTrace, reconstruction } = comparativeReconstructionFor(
    referenceSnapshot,
    referenceSnapshot,
  );
  assert.equal(validateComparativeReconstruction(reconstruction), true);
  assert.equal(Object.isFrozen(reconstruction), true);
  assert.equal(Object.isFrozen(reconstruction.moments), true);
  assert.notEqual(fromTrace.identifier, toTrace.identifier, "frame identity is not semantic divergence");
  assert.ok(reconstruction.moments.every(({ state, divergent }) => state === "shared" && !divergent));
  assert.equal(reconstruction.firstDivergenceIndex, null);
  assert.deepEqual(reconstruction.divergenceIndices, []);
  assert.equal(reconstruction.summary.divergent, 0);
  assert.equal(reconstruction.summary.shared, reconstruction.moments.length);
  assert.equal(reconstruction.world.frame.identifier, reconstruction.worldIdentifier);
  assert.equal(reconstruction.world.layout.identifier, pair.from.world.layout.identifier);
  assert.equal(reconstruction.world.layout.identifier, pair.to.world.layout.identifier);
});

test("Comparative Reconstruction detects exact Evidence Transformation Retrieval and Reflection divergence", () => {
  const fixtures = [
    ["origin-evidence", (changed) => {
      changed.reflections[0].sources[0].semanticConcept.sourceEntries[0].value = "Changed exact evidence value";
    }],
    ["semantic-transformation", (changed) => {
      changed.reflections[0].sources[0].semanticConcept.meaning = "Changed exact semantic transformation";
    }],
    ["retrieval", (changed) => {
      changed.reflections[0].sources[0].rankScore += 1;
    }],
    ["reflection-current", (changed) => {
      changed.reflections[0].knowledge = "Changed exact Reflection result";
    }],
  ];
  fixtures.forEach(([expectedRole, mutate]) => {
    const changed = cloneDetached(referenceSnapshot);
    mutate(changed);
    const { reconstruction } = comparativeReconstructionFor(referenceSnapshot, changed);
    const first = reconstruction.moments[reconstruction.firstDivergenceIndex];
    assert.equal(first.role, expectedRole);
    assert.equal(first.state, "modified");
    assert.ok(first.reasonCodes.includes("SEMANTIC_REVISION_CHANGED"));
    assert.notEqual(first.from.revisionFingerprint, first.to.revisionFingerprint);
  });
});

test("Comparative Reconstruction realigns after inserted evidence without cascading divergence", () => {
  const changed = cloneDetached(referenceSnapshot);
  changed.reflections[0].sources[0].semanticConcept.sourceEntries.push({
    identifier: "ltm-comparative-added",
    value: "An additional exact evidence value.",
    archived: false,
  });
  changed.reflections[0].sources[0].chain.splice(-1, 0, "ltm-comparative-added");
  const first = comparativeReconstructionFor(referenceSnapshot, changed).reconstruction;
  const second = comparativeReconstructionFor(referenceSnapshot, changed).reconstruction;
  assert.deepEqual(first, second, "equivalent observation pairs reconstruct identically");

  const inserted = first.moments.find((moment) => (
    moment.state === "b-only"
      && moment.role === "origin-evidence"
      && moment.to?.key.includes("ltm-comparative-added")
  ));
  assert.ok(inserted, "the inserted evidence is one exact Observation-B-only moment");
  assert.equal(first.moments.slice(inserted.index + 1).some((moment) => (
    moment.state === "shared"
      && moment.role === "semantic-transformation"
      && moment.from?.key.includes("proc-release-review")
  )), true, "later unchanged cognition reconverges after the insertion");
  assert.equal(first.world.nodes.filter(({ key }) => key === inserted.to.key).length, 1,
    "both investigations remain in one union semantic world");
});

test("Comparative Reconstruction rejects invalid bindings atomically", () => {
  const { pair, fromTrace, toTrace } = comparativeReconstructionFor(referenceSnapshot, referenceSnapshot);
  assert.throws(
    () => buildComparativeReconstruction(pair.from, toTrace, pair.to, fromTrace),
    (error) => error instanceof ComparativeReconstructionError && error.code === "FRAME_MISMATCH",
  );

  const mutableTrace = structuredClone(fromTrace);
  assert.throws(
    () => buildComparativeReconstruction(pair.from, mutableTrace, pair.to, toTrace),
    (error) => error instanceof ComparativeReconstructionError && error.code === "MUTABLE_TRACE",
  );

  const wrongWorkspace = cloneDetached(referenceSnapshot);
  wrongWorkspace.workspaceIdentifier = "another-workspace";
  wrongWorkspace.session.workspaceIdentifier = "another-workspace";
  assert.throws(() => observationPair(referenceSnapshot, wrongWorkspace), /Workspace boundary/);
});

test("Comparative Replay synchronizes, pauses at every divergence, and resumes explicitly", () => {
  const changed = cloneDetached(referenceSnapshot);
  changed.reflections[0].sources[0].semanticConcept.sourceEntries[0].value = "Changed evidence";
  changed.reflections[0].knowledge = "Changed Reflection";
  const { reconstruction } = comparativeReconstructionFor(referenceSnapshot, changed);
  let state = createComparativeReplayState(reconstruction);
  assert.deepEqual(state, {
    reconstructionIdentifier: reconstruction.identifier,
    status: "ready",
    cursor: -1,
    pauseReason: null,
  });

  state = playComparativeReplay(reconstruction, state);
  assert.equal(state.status, "paused");
  assert.equal(state.pauseReason, "divergence");
  assert.equal(state.cursor, reconstruction.firstDivergenceIndex);
  assert.equal(advanceComparativeReplay(reconstruction, state), state, "a paused divergence never advances itself");

  state = playComparativeReplay(reconstruction, state);
  assert.equal(state.status, "playing", "Play explicitly acknowledges the current divergence");
  do state = advanceComparativeReplay(reconstruction, state);
  while (state.status === "playing");
  assert.equal(state.pauseReason, "divergence", "the next exact divergence pauses reconstruction again");
  assert.ok(state.cursor > reconstruction.firstDivergenceIndex);

  const previous = previousComparativeStep(reconstruction, state);
  assert.equal(previous.status, "paused");
  assert.equal(previous.cursor, state.cursor - 1);
  assert.equal(nextComparativeStep(reconstruction, previous).cursor, state.cursor);
  assert.equal(resetComparativeReplay(reconstruction, state).cursor, -1);
});

test("Comparative Replay completes identical traces deterministically and remains frame-bound", () => {
  const identical = comparativeReconstructionFor(referenceSnapshot, referenceSnapshot).reconstruction;
  let state = playComparativeReplay(identical, createComparativeReplayState(identical));
  assert.equal(state.status, "playing");
  const paused = pauseComparativeReplay(identical, state);
  assert.equal(paused.status, "paused");
  state = playComparativeReplay(identical, paused);
  while (state.status === "playing") state = advanceComparativeReplay(identical, state);
  assert.equal(state.status, "completed");
  const view = projectComparativeReplay(identical, state);
  assert.equal(view.currentMoment, null);
  assert.equal(view.nodeRecords.every(({ phase }) => phase === "completed"), true);
  assert.equal(view.relationshipRecords.every(({ phase }) => phase === "completed"), true);

  const changed = cloneDetached(referenceSnapshot);
  changed.reflections[0].knowledge = "Another frame-bound reconstruction";
  const another = comparativeReconstructionFor(referenceSnapshot, changed).reconstruction;
  assert.throws(() => projectComparativeReplay(another, state), /not bound/);
});

test("Comparative Replay preserves per-side phases when trace order diverges and reconverges", () => {
  const changed = cloneDetached(referenceSnapshot);
  changed.reflections[0].sources.reverse();
  const { reconstruction } = comparativeReconstructionFor(referenceSnapshot, changed);
  const occurrences = new Map();
  reconstruction.moments.forEach((moment) => {
    [["a", moment.from], ["b", moment.to]].forEach(([side, step]) => {
      if (!step || !["a-only", "b-only"].includes(moment.state)) return;
      const identity = `${step.elementType}:${step.key}`;
      const values = occurrences.get(identity) ?? [];
      values.push({ index: moment.index, side, state: moment.state, key: step.key, elementType: step.elementType });
      occurrences.set(identity, values);
    });
  });
  const moved = [...occurrences.values()].find((values) => (
    values.some(({ state }) => state === "a-only") && values.some(({ state }) => state === "b-only")
  ));
  assert.ok(moved, "reordered trace cognition must align as local A-only and B-only moments");
  const aOnly = moved.find(({ state }) => state === "a-only");
  const bOnly = moved.find(({ state }) => state === "b-only");
  assert.ok(aOnly.index < bOnly.index, "the fixed LCS tie emits Observation A before Observation B");

  let controller = createComparativeReplayState(reconstruction);
  while (controller.cursor < aOnly.index) controller = nextComparativeStep(reconstruction, controller);
  let view = projectComparativeReplay(reconstruction, controller);
  let record = view.records.find(({ key, elementType }) => key === aOnly.key && elementType === aOnly.elementType);
  assert.equal(record.semanticState, "a-only");
  assert.equal(record.phase, "current");
  assert.deepEqual(record.sides, ["a"]);
  assert.equal(record.sideRecords.find(({ side }) => side === "a").phase, "current");
  assert.equal(record.sideRecords.find(({ side }) => side === "b").phase, "future");

  while (controller.cursor < bOnly.index) controller = nextComparativeStep(reconstruction, controller);
  view = projectComparativeReplay(reconstruction, controller);
  record = view.records.find(({ key, elementType }) => key === bOnly.key && elementType === bOnly.elementType);
  assert.equal(record.semanticState, "b-only");
  assert.equal(record.phase, "current");
  assert.deepEqual(record.sides, ["b"]);
  assert.equal(record.sideRecords.find(({ side }) => side === "a").phase, "completed");
  assert.equal(record.sideRecords.find(({ side }) => side === "b").phase, "current");
});

test("the Comparative renderer consumes aligned classifications and never computes divergence", async () => {
  const changed = cloneDetached(referenceSnapshot);
  changed.reflections[0].sources[0].semanticConcept.sourceEntries[0].value = "Renderer-visible exact divergence";
  const { reconstruction, pair } = comparativeReconstructionFor(referenceSnapshot, changed);
  const controller = playComparativeReplay(reconstruction, createComparativeReplayState(reconstruction));
  const view = projectComparativeReplay(reconstruction, controller);
  const rendering = prepareComparativeRenderingState(reconstruction.world, view);
  assert.equal(rendering.active, true);
  assert.deepEqual(rendering.nodeRecords, view.nodeRecords);
  assert.deepEqual(rendering.relationshipRecords, view.relationshipRecords);
  assert.equal(rendering.atDivergence, true);
  assert.throws(() => prepareComparativeRenderingState(pair.to.world, view), /not bound/);

  const [engineSource, controllerSource, rendererSource, appSource, coreSource, styles] = await Promise.all([
    readFile(resolve(studioRoot, "web/js/cognitive-comparative-reconstruction.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/cognitive-comparative-replay.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/graph.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/app.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/investigation-core.js"), "utf8"),
    readFile(resolve(studioRoot, "web/styles.css"), "utf8"),
  ]);
  for (const source of [engineSource, controllerSource]) {
    assert.doesNotMatch(source, /\bwindow\b|\bdocument\b|setTimeout|setInterval|requestAnimationFrame|Math\.random|Date\./);
  }
  assert.doesNotMatch(rendererSource, /from\s+["']\.\/cognitive-comparative|buildComparativeReconstruction|advanceComparativeReplay|canonicalObservation/);
  assert.match(appSource, /investigationCore\.compare\(investigationIdentifier, \{/);
  assert.match(coreSource, /buildComparativeReconstruction\(pair\.from, fromTrace, pair\.to, toTrace\)/);
  assert.match(rendererSource, /prepareComparativeRenderingState\(world, comparativeView\)/);
  assert.match(rendererSource, /comparativeSideRecord\(record, side\)/);
  assert.match(rendererSource, /updateComparativeMarker/);
  assert.match(rendererSource, /updateComparativeView/);
  for (const control of ["Compare", "Play", "Pause", "Previous Step", "Next Step", "Reset"]) {
    assert.match(rendererSource, new RegExp(`createToolButton\\(\"${control}`));
  }
  const comparativeStyles = styles.slice(styles.indexOf("MemoryOS 1.1 MO-1107"));
  assert.match(comparativeStyles, /is-comparative-side-a/);
  assert.match(comparativeStyles, /is-comparative-side-b/);
  assert.match(comparativeStyles, /stroke-dasharray/);
  assert.doesNotMatch(comparativeStyles, /animation\s*:/, "comparative presentation never manufactures cognition");
  for (const unsupported of ["Time Machine", "Counterfactual", "timeline scrubber", "branch reality"]) {
    assert.doesNotMatch(`${engineSource}\n${controllerSource}\n${comparativeStyles}`, new RegExp(unsupported, "i"));
  }
});

test("Comparative Reconstruction requires explicit activation and preserves Cognitive Evolution", async () => {
  const applicationSource = await readFile(resolve(studioRoot, "web/js/app.js"), "utf8");
  const synchronizeSource = applicationFunctionSource(
    applicationSource,
    "synchronizeComparativeReconstruction",
    "activateComparativeReconstruction",
  );
  const activationSource = applicationFunctionSource(
    applicationSource,
    "activateComparativeReconstruction",
    "updateComparativeReplay",
  );
  const comparativeControlSource = applicationFunctionSource(
    applicationSource,
    "updateComparativeReplay",
    "scheduleComparativeReplay",
  );
  assert.match(synchronizeSource, /!state\.evolutionController\.active/);
  assert.match(activationSource, /investigationCore\.compare\(investigationIdentifier, \{/);
  assert.match(applicationSource, /state\.comparativeActive = Boolean\(investigationView\.comparativeReconstruction\)/);
  assert.match(applicationSource, /data-comparative-start/);
  assert.match(applicationSource, /evolutionView: comparativeView \? null : evolution\?\.view/);
  assert.doesNotMatch(synchronizeSource, /investigationCore\.compare|comparativeActive = true/,
    "activating Cognitive Evolution alone must never enter Comparative Reconstruction");
  assert.match(comparativeControlSource, /investigationCore\.compare\(investigationIdentifier, "back"\)/);
  assert.doesNotMatch(comparativeControlSource, /updateEvolution\(/,
    "leaving Comparative Reconstruction must return to the existing Evolution view");
});

test("the application exposes deterministic Cognitive Trace query failures", async () => {
  const source = await readFile(resolve(studioRoot, "web/js/app.js"), "utf8");
  assert.match(source, /traceDiagnostic/);
  assert.match(source, /result\.code/);
  assert.match(source, /result\.message/);
});

test("a rebuilt trace retargets both selection and follow when their former member disappears", async () => {
  const source = await readFile(resolve(studioRoot, "web/js/app.js"), "utf8");
  const acceptFrame = applicationFunctionSource(source, "acceptObservationFrame", "renderNeuralPerspective");

  assert.match(acceptFrame, /const activeSelectedKey\s*=\s*state\.graphSelection\?\.nodeKey\s*\?\?\s*state\.graphViewState\.selectedKey/);
  assert.match(acceptFrame, /const activeFollowedKey\s*=\s*state\.graphViewState\.followedKey/);
  assert.match(
    acceptFrame,
    /!traceContainsNode\(state\.activeTrace, activeSelectedKey\)[\s\S]*!traceContainsNode\(state\.activeTrace, activeFollowedKey\)/,
    "both stale interaction anchors must be detected after trace reconstruction",
  );
  assert.match(acceptFrame, /\(\{ key \}\) => key === state\.activeTrace\.targetNodeKey/);
  assert.match(acceptFrame, /state\.graphSelection\s*=\s*\{\s*identifier:\s*target\.identifier,\s*observations,\s*nodeKey:\s*target\.key\s*\}/);
  assert.match(acceptFrame, /state\.graphViewState\s*=\s*selectGraphNode\(state\.graphViewState,\s*target\.key\)/);

  const staleMember = "Semantic concept:retired-member";
  const reflectionTarget = "Reflection:current-target";
  const followedMember = toggleGraphFollow(selectGraphNode(createGraphViewState(), staleMember));
  const retargeted = selectGraphNode(followedMember, reflectionTarget);
  assert.equal(retargeted.selectedKey, reflectionTarget);
  assert.equal(retargeted.followedKey, reflectionTarget, "an active follow transfers with the rebuilt trace target");
});

test("a failed trace rebuild survives selection clearing and renders in the default graph context", async () => {
  const source = await readFile(resolve(studioRoot, "web/js/app.js"), "utf8");
  const coreSource = await readFile(resolve(studioRoot, "web/js/investigation-core.js"), "utf8");
  const acceptFrame = applicationFunctionSource(source, "acceptObservationFrame", "renderNeuralPerspective");
  const clearSelection = applicationFunctionSource(source, "clearObservedSelection", "synchronizeSelectionWithCurrentFrame");
  const graphContext = applicationFunctionSource(source, "graphContext", "traceContainsNode");
  assert.match(coreSource, /previousTargetNodeKey[\s\S]*state\.traceDiagnostic = deepFreeze\(\{/,
    "the Core must retain a deterministic trace-rebuild diagnostic");
  assert.match(acceptFrame, /else if \(state\.traceDiagnostic\) \{[\s\S]*clearObservedSelection\(\)/);
  assert.doesNotMatch(acceptFrame, /traceDiagnostic\s*=\s*null/,
    "frame acceptance must retain the Core diagnostic");
  assert.doesNotMatch(clearSelection, /traceDiagnostic/, "selection cleanup must not erase trace-query evidence");
  assert.match(graphContext, /if\s*\(state\.graphSelection\)\s*return\s+graphSelectionView\(state\.graphSelection\)/);
  assert.match(graphContext, /state\.traceDiagnostic\s*\?/);
  assert.match(graphContext, /Cognitive Trace unavailable/);
  assert.match(graphContext, /traceDiagnosticView\(\)/);
  assert.match(graphContext, /neuralDefaultContext\(route\)/, "the diagnostic remains visible in the default context");
});

test("Cognitive Trace implementation is independent of clocks, randomness, DOM, and host operations", async () => {
  const source = await readFile(resolve(studioRoot, "web/js/cognitive-trace.js"), "utf8");
  assert.doesNotMatch(source, /Math\.random|Date\.|performance\.|setTimeout|setInterval|requestAnimationFrame/);
  assert.doesNotMatch(source, /document\.|window\.|host-adapter|renderGraph/);
  assert.match(source, /MemoryOSCognitiveTrace/);
});

test("the host adapter requires and exposes all six frozen operations", async () => {
  assert.deepEqual(operationNames, ["observe", "inspect", "trace", "summarize", "exportView", "forgetSession"]);
  assert.throws(() => {
    globalThis.__CCA_STUDIO_COMMANDS__ = { inspect() {} };
    resolveCommandAdapter(referenceSnapshot);
  }, /missing/);
  delete globalThis.__CCA_STUDIO_COMMANDS__;

  const adapter = createReferenceAdapter(referenceSnapshot);
  const first = await adapter.exportView();
  assert.equal(first.code, "OK");
  first.view.memory.entries[0].value = "changed detached result";
  const second = await adapter.exportView();
  assert.notEqual(second.view.memory.entries[0].value, first.view.memory.entries[0].value);
  const providerMismatch = cloneDetached(referenceSnapshot);
  providerMismatch.providerSessions[0].workspaceIdentifier = "wrong";
  assert.equal((await adapter.observe(providerMismatch)).code, "WORKSPACE_MISMATCH");
  assert.equal((await adapter.observe(referenceSnapshot)).code, "OK");
  assert.equal((await adapter.inspect({ workspaceIdentifier: referenceSnapshot.workspaceIdentifier, scope: "Complete", identifier: "" })).code, "OK");
  assert.equal((await adapter.trace({ workspaceIdentifier: referenceSnapshot.workspaceIdentifier, scope: "Complete", identifier: "" })).code, "OK");
  assert.equal((await adapter.summarize({ workspaceIdentifier: referenceSnapshot.workspaceIdentifier, scope: "Complete", identifier: "" })).code, "OK");
  assert.equal((await adapter.forgetSession()).code, "OK");
  assert.equal((await adapter.exportView()).code, "SESSION_FORGOTTEN");
});

test("the application shell is local, accessible, responsive, and injection-ready", async () => {
  const [html, css, app, hostAdapter, data, graph, model, semanticWorld, observationTimeline, graphViewState] = await Promise.all([
    readFile(resolve(studioRoot, "web/index.html"), "utf8"),
    readFile(resolve(studioRoot, "web/styles.css"), "utf8"),
    readFile(resolve(studioRoot, "web/js/app.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/host-adapter.js"), "utf8"),
    readFile(resolve(studioRoot, "web/data/studio-snapshot.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/graph.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/studio-model.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/semantic-world.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/observation-timeline.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/graph-view-state.js"), "utf8"),
  ]);

  assert.match(html, /<main class="main-content"/);
  assert.match(html, /Memory intelligence graph/);
  assert.match(html, /aria-label="Memory Studio scopes"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<dialog class="confirm-dialog"/);
  for (const control of ["observe-view", "run-inspect", "run-trace", "run-summary", "export-view", "forget-session"]) {
    assert.match(html, new RegExp(`id="${control}"`));
  }
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion/);
  for (const className of ["neural-interface", "neural-world", "neural-graph-identity", "neural-signal-ribbon", "neural-flow-ribbon", "neural-context"]) {
    assert.match(app, new RegExp(`class="[^"]*${className}`), `${className} is part of the graph-primary markup`);
    assert.match(css, new RegExp(`\\.${className}\\b`), `${className} has presentation rules`);
  }
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
  assert.match(css, /--runtime: #1e88e5/);
  assert.match(css, /--representation: #43b581/);
  assert.match(css, /--commit: #7c4dff/);
  assert.match(css, /--process: #fb8c00/);
  assert.match(hostAdapter, /__CCA_STUDIO_COMMANDS__/);
  assert.doesNotMatch(app, /\.sort\(/);
  assert.match(app, /toggleAttribute\("inert"/);
  assert.match(app, /resolveInspectionDetails\(operationResult\.view, operationResult\.observations\)/);
  assert.match(app, /acceptObservationFrame\(result\.view, "Observe", null, result\.code\)/);
  assert.doesNotMatch(app, /acceptObservationFrame\(operationResult\.view/);
  assert.match(app, /synchronizeSelectionWithCurrentFrame\(selectedKey\)/);
  assert.match(app, /graphContext\(\)/);
  assert.match(app, /graphselectionclear/);
  assert.match(app, /function clearGraphSelection\(\) \{\s*clearObservedSelection\(\)/);
  assert.match(app, /window\.addEventListener\("hashchange",[\s\S]*?clearObservedSelection\(\)/);
  assert.match(app, /function renderNeuralPerspective\(route = state\.route\)/);
  assert.match(app, /renderNeuralPerspective\(state\.route\)/, "every route renders the same cognitive topology");
  assert.match(app, /renderGraph\(graphContainer, world,/);
  assert.match(app, /memory-intelligence-graph-title/);
  assert.doesNotMatch(app, /renderCompleteLegacy|mission-control|intelligence-deck|scope-layout/);
  assert.match(app, /perspective: perspectiveKindByRoute\[route\]/);
  assert.match(app, /viewState: state\.graphViewState/);
  assert.equal((app.match(/selectGraphNode\(state\.graphViewState, worldNode\.key\)/g) ?? []).length, 2,
    "query and contextual selections use the Follow-aware state transition");
  assert.equal((app.match(/: \{ \.\.\.state\.graphViewState, selectedKey: null \}/g) ?? []).length, 2,
    "multi-location or non-node selections cannot retain a stale selected node");
  assert.match(app, /Observed frame/);
  assert.doesNotMatch(app, /Live topology/);
  assert.doesNotMatch(app, /inspectorFamilyByScope/);
  for (const kind of [
    "workspace",
    "memory",
    "working",
    "consolidation",
    "long-term",
    "semantic",
    "episodic",
    "procedural",
    "retrieval",
    "reflection",
    "providers",
    "validation",
  ]) {
    assert.match(graph, new RegExp(`(?:^|[\\s"'])${kind}(?:[\\s"':,]|$)`, "m"), `the renderer recognizes ${kind}`);
  }
  assert.match(graph, /scale: clamp\(reconciledViewState\.camera\.scale, \.75, 2\.5\)/);
  assert.match(graph, /clamp\(previous \* factor, \.75, 2\.5\)/);
  assert.match(graph, /function curvedEdge\(/);
  assert.match(graph, /\bQ \$\{format\(controlX\)\} \$\{format\(controlY\)\}/);
  assert.match(graph, /class: `graph-edge-flow topology-flow flow-\$\{flowKind\}/);
  for (const flow of ["evidence", "retrieval", "reflection", "consolidation"]) {
    assert.match(graph, new RegExp(`${flow}: \\{`), `the topology renders flow-${flow}`);
  }
  assert.match(graph, /perspective = "complete"/);
  assert.match(graph, /Select nodes/);
  assert.match(graph, /Pan graph/);
  assert.match(graph, /Follow selected node/);
  assert.match(graph, /Graph layer filters/);
  assert.match(graph, /role: "group"/);
  assert.match(graph, /Memory intelligence graph/);
  assert.match(graph, /memory-intelligence-graph/);
  assert.doesNotMatch(graph, /role: "img"/);
  assert.doesNotMatch(graph, /brain-(?:outline|surface|stem|midline)/i);
  assert.doesNotMatch(graph, /\bellipse\b/i);
  assert.doesNotMatch(graph, /\bcloud\b/i);
  assert.doesNotMatch(graph, /layoutNodes|edgeFlowKind|resolveSnapshot|host-adapter|studio-model/);
  assert.match(graph, /reconcileGraphViewState\(world, incomingViewState\)/);
  assert.match(graphViewState, /function reconcileGraphViewState/);
  assert.match(graphViewState, /function toggleGraphFollow/);
  assert.match(semanticWorld, /deterministic-semantic-anchors/);
  assert.match(semanticWorld, /function placeNodes\(/);
  assert.match(observationTimeline, /MemoryOSObservationFrame/);
  assert.match(observationTimeline, /diffSemanticWorld/);
  assert.match(observationTimeline, /Only successful detached observations/);
  assert.match(observationTimeline, /cannot cross a Workspace boundary/);
  for (const source of [semanticWorld, observationTimeline, graphViewState]) {
    assert.doesNotMatch(source, /Math\.random|Date\b|performance\.|requestAnimationFrame|setInterval|WebSocket|EventSource|forceSimulation|localeCompare/);
  }
  assert.match(css, /MemoryOS 1\.1: deterministic observation motion/);
  assert.match(css, /\.graph-edge-base\.is-observed-activity/);
  assert.match(css, /animation: none !important/);
  assert.match(data, /__CCA_STUDIO_SNAPSHOT__/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(app, /setInterval|WebSocket|EventSource/);
  const forbiddenGraphName = new RegExp(["Memory", "provenance", "graph"].join(" "));
  for (const source of [html, css, app, graph, model, semanticWorld, observationTimeline, graphViewState]) assert.doesNotMatch(source, forbiddenGraphName);
});

test("MO-1108 bounds graph Tab order with deterministic spatial keyboard navigation", async () => {
  const [graph, css] = await Promise.all([
    readFile(resolve(studioRoot, "web/js/graph.js"), "utf8"),
    readFile(resolve(studioRoot, "web/styles.css"), "utf8"),
  ]);

  assert.match(graph, /let rovingNodeKey\s*=\s*\[/);
  assert.match(graph, /tabindex:\s*interactionMode\s*===\s*"select"\s*&&\s*node\.key\s*===\s*rovingNodeKey\s*\?\s*"0"\s*:\s*"-1"/);
  assert.match(graph, /"aria-disabled": interactionMode === "pan" \? "true" : "false"/);
  assert.match(graph, /function|const spatialNeighbor\s*=/);
  assert.match(graph, /\["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"\]\.includes\(event\.key\)/);
  assert.match(graph, /setRovingNode\(neighbor\.key, true\)/);
  assert.match(graph, /event\.key === "Enter" \|\| event\.key === " "/, "Enter and Space retain native node activation semantics");
  assert.match(css, /\.graph-node\[tabindex="0"\]:focus-visible \.graph-node-body/);
  assert.match(css, /stroke:\s*#f5fbff/);
});

test("MO-1108 preserves native controls and focus across replay and comparison transitions", async () => {
  const [html, app, graph, css] = await Promise.all([
    readFile(resolve(studioRoot, "web/index.html"), "utf8"),
    readFile(resolve(studioRoot, "web/js/app.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/graph.js"), "utf8"),
    readFile(resolve(studioRoot, "web/styles.css"), "utf8"),
  ]);

  assert.match(app, /closest\("button, a, input, select, textarea, summary, \[role='button'\], \[contenteditable='true'\]"\)/);
  assert.match(app, /!typing && !interactive && state\.activeReplay/);
  assert.match(app, /!typing && !interactive && state\.comparativeReconstruction/);
  assert.match(graph, /focusedControl === playButton[\s\S]*pauseButton\.focus\(\)/);
  assert.match(graph, /focusedControl === pauseButton[\s\S]*restartButton : playButton/);
  assert.match(graph, /focusedControl === pauseButton[\s\S]*resetButton : playButton/);
  assert.equal((graph.match(/aria-keyshortcuts/g) ?? []).length, 10);
  assert.match(app, /mobileNavigationQuery\.addEventListener\("change", \(\) => closeMobileNavigation\(\)\)/);
  assert.match(app, /setInspectorClosed\(true, \{ restoreFocus: true \}\)/);
  assert.match(app, /\(\) => elements\.sidebar\.querySelector\("\[aria-current='page'\]"\)/);
  assert.match(app, /const overlayFocusDelay\s*=\s*180/);
  assert.match(app, /function focusAfterOverlayReveal\(resolveTarget, isOpen\)/);
  assert.match(app, /window\.setTimeout\(\(\) => \{[\s\S]*if \(isOpen\(\)\) resolveTarget\(\)\?\.focus\(\)/);
  assert.match(app, /reducedMotionQuery\.matches \? 0 : overlayFocusDelay/);
  assert.match(app, /focusAfterOverlayReveal\([\s\S]*elements\.inspector\.classList\.contains\("is-closed"\)/);
  assert.match(app, /focusAfterOverlayReveal\([\s\S]*elements\.sidebar\.classList\.contains\("is-open"\)/);
  assert.match(app, /elements\.root\.setAttribute\("aria-busy", String\(busy\)\)/);
  assert.match(app, /toast\.setAttribute\("role", kind === "error" \? "alert" : "status"\)/);
  assert.doesNotMatch(html, /<div id="view-root"[^>]*aria-live=/, "the complete graph must not be an unbounded live region");
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.topology-interface \.graph-toolbar/);
  assert.match(css, /\.investigation-stage small,[\s\S]*font-size:\s*11px/);
  assert.match(css, /\.comparative-context > p,[\s\S]*font-size:\s*12px/);
  assert.match(css, /@media \(forced-colors: active\)/);
});

test("the local server rejects malformed encoding without terminating", async (context) => {
  const serverPath = resolve(studioRoot, "scripts/serve.mjs");
  const child = spawn(process.execPath, [serverPath, "0"], { stdio: ["ignore", "pipe", "pipe"] });
  context.after(() => child.kill());
  const port = await new Promise((resolvePort, reject) => {
    const timeout = setTimeout(() => reject(new Error("server did not start")), 5000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      const match = chunk.match(/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolvePort(Number(match[1]));
      }
    });
    child.once("exit", (code) => reject(new Error(`server exited early: ${code}`)));
  });

  const status = await new Promise((resolveStatus, reject) => {
    const outgoing = request({ host: "127.0.0.1", port, path: "/%", method: "GET" }, (response) => {
      response.resume();
      response.on("end", () => resolveStatus(response.statusCode));
    });
    outgoing.on("error", reject);
    outgoing.end();
  });
  assert.equal(status, 400);
  const healthy = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(healthy.status, 200);
  assert.match(await healthy.text(), /CCA Memory Studio/);
});
