import { referenceSnapshot } from "../web/data/studio-snapshot.js";
import { appendObservationFrame, createObservationTimeline } from "../web/js/observation-timeline.js";
import { buildGraph } from "../web/js/studio-model.js";

export const benchmarkNodeCounts = Object.freeze([100, 500, 1_000, 5_000, 10_000]);

const referenceNodeCount = buildGraph(referenceSnapshot).nodes.length;

function detachedClone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function benchmarkEntry(index) {
  const suffix = String(index).padStart(5, "0");
  return {
    identifier: `benchmark-evidence-${suffix}`,
    value: `Deterministic benchmark evidence ${suffix}`,
    archived: false,
  };
}

export function createBenchmarkSnapshot(nodeCount, revision = "a") {
  if (!Number.isSafeInteger(nodeCount) || nodeCount < referenceNodeCount) {
    throw new RangeError(`Benchmark node count must be an integer of at least ${referenceNodeCount}.`);
  }
  const snapshot = detachedClone(referenceSnapshot);
  snapshot.observationIdentifier = `benchmark-observation-${nodeCount}-${revision}`;
  snapshot.source = "memoryos-1.1-engineering-benchmark";
  const extraEntries = nodeCount - referenceNodeCount;
  for (let index = 0; index < extraEntries; index += 1) {
    snapshot.longTermMemory.entries.push(benchmarkEntry(index));
  }

  // The second observation changes exact runtime truth while preserving all
  // semantic identities and stable geography. This creates one deterministic
  // evidence/transformation divergence without synthetic renderer state.
  if (revision === "b") {
    const source = snapshot.reflections[0].sources[0].semanticConcept;
    source.meaning = `${source.meaning} [revision b]`;
    source.sourceEntries[0].value = `${source.sourceEntries[0].value} [revision b]`;
  }

  const graph = buildGraph(snapshot);
  if (graph.nodes.length !== nodeCount) {
    throw new Error(`Benchmark fixture requested ${nodeCount} nodes but projected ${graph.nodes.length}.`);
  }
  return snapshot;
}

export function createBenchmarkFrame(nodeCount) {
  const snapshot = createBenchmarkSnapshot(nodeCount, "a");
  return appendObservationFrame(createObservationTimeline(), {
    snapshot,
    graph: buildGraph(snapshot),
    operation: "InitialObservation",
    resultCode: "OK",
  }).current;
}

export function createBenchmarkPair(nodeCount) {
  const before = createBenchmarkSnapshot(nodeCount, "a");
  const after = createBenchmarkSnapshot(nodeCount, "b");
  const first = appendObservationFrame(createObservationTimeline(), {
    snapshot: before,
    graph: buildGraph(before),
    operation: "InitialObservation",
    resultCode: "OK",
  });
  const second = appendObservationFrame(first.frames, {
    snapshot: after,
    graph: buildGraph(after),
    operation: "Observe",
    resultCode: "OK",
  });
  return Object.freeze({ from: first.current, to: second.current });
}

export function reflectionTarget(frame) {
  const target = frame.world.nodes.find((node) => node.observationPath === "Reflection.values[0]");
  if (!target) throw new Error("The benchmark fixture does not expose its reference Reflection.");
  return target;
}
