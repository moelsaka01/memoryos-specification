import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildComparativeReconstruction } from "../web/js/cognitive-comparative-reconstruction.js";
import {
  createComparativeReplayState,
  projectComparativeReplay,
} from "../web/js/cognitive-comparative-replay.js";
import { compareCognitiveEvolution, validateCognitiveEvolution } from "../web/js/cognitive-evolution.js";
import { buildCognitiveReplay, createReplayState, projectReplay } from "../web/js/cognitive-replay.js";
import { buildCognitiveTrace, validateCognitiveTrace } from "../web/js/cognitive-trace.js";
import { alignDeterministicSequences } from "../web/js/deterministic-sequence-alignment.js";
import {
  prepareComparativeRenderingState,
  prepareEvolutionRenderingState,
  prepareTraceRenderingState,
} from "../web/js/graph.js";
import { canonicalObservation, createSemanticWorld } from "../web/js/semantic-world.js";
import { buildGraph } from "../web/js/studio-model.js";
import {
  benchmarkNodeCounts,
  createBenchmarkPair,
  createBenchmarkSnapshot,
  reflectionTarget,
} from "../benchmarks/memoryos-scalability-fixture.mjs";

function referenceAlignment(fromSteps, toSteps) {
  const table = Array.from(
    { length: fromSteps.length + 1 },
    () => Array(toSteps.length + 1).fill(0),
  );
  for (let fromIndex = fromSteps.length - 1; fromIndex >= 0; fromIndex -= 1) {
    for (let toIndex = toSteps.length - 1; toIndex >= 0; toIndex -= 1) {
      table[fromIndex][toIndex] = fromSteps[fromIndex].identity === toSteps[toIndex].identity
        ? table[fromIndex + 1][toIndex + 1] + 1
        : Math.max(table[fromIndex + 1][toIndex], table[fromIndex][toIndex + 1]);
    }
  }
  const aligned = [];
  let fromIndex = 0;
  let toIndex = 0;
  while (fromIndex < fromSteps.length || toIndex < toSteps.length) {
    const from = fromSteps[fromIndex] ?? null;
    const to = toSteps[toIndex] ?? null;
    if (from && to && from.identity === to.identity) {
      aligned.push({ from, to });
      fromIndex += 1;
      toIndex += 1;
    } else if (from && (!to || table[fromIndex + 1][toIndex] >= table[fromIndex][toIndex + 1])) {
      aligned.push({ from, to: null });
      fromIndex += 1;
    } else {
      aligned.push({ from: null, to });
      toIndex += 1;
    }
  }
  return aligned;
}

function sequenceValues(maximumLength) {
  const values = [[]];
  let preceding = [[]];
  for (let length = 1; length <= maximumLength; length += 1) {
    const next = preceding.flatMap((sequence) => ["a", "b"].map((identity) => [
      ...sequence,
      { identity },
    ]));
    values.push(...next);
    preceding = next;
  }
  return values;
}

function simplified(aligned) {
  return aligned.map(({ from, to }) => [from?.identity ?? null, to?.identity ?? null]);
}

test("100 through 10,000-node semantic worlds preserve exact deterministic geography", () => {
  benchmarkNodeCounts.forEach((nodeCount) => {
    const snapshot = createBenchmarkSnapshot(nodeCount);
    const graph = buildGraph(snapshot);
    const metadata = {
      frameIndex: 0,
      observationFingerprint: "benchmark-observation",
      observationIdentifier: snapshot.observationIdentifier,
      workspaceIdentifier: snapshot.workspaceIdentifier,
      sessionIdentifier: snapshot.session.identifier,
      source: snapshot.source,
    };
    const first = createSemanticWorld(graph, metadata);
    const second = createSemanticWorld({
      ...graph,
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
    }, metadata);
    assert.equal(first.nodes.length, nodeCount);
    assert.equal(canonicalObservation(first), canonicalObservation(second));
    assert.equal(first.frame.topologyFingerprint, second.frame.topologyFingerprint);
  });
});

test("the complete investigation pipeline remains deterministic through 10,000 nodes", () => {
  benchmarkNodeCounts.forEach((nodeCount) => {
    const pair = createBenchmarkPair(nodeCount);
    const fromTrace = buildCognitiveTrace(pair.from, reflectionTarget(pair.from).key);
    const toTrace = buildCognitiveTrace(pair.to, reflectionTarget(pair.to).key);
    assert.equal(validateCognitiveTrace(fromTrace, pair.from).valid, true);
    assert.equal(validateCognitiveTrace(toTrace, pair.to).valid, true);

    const replay = buildCognitiveReplay(fromTrace);
    const replayView = projectReplay(replay, createReplayState(replay));
    const evolution = compareCognitiveEvolution(pair.from, pair.to);
    assert.equal(validateCognitiveEvolution(evolution), true);
    const reconstruction = buildComparativeReconstruction(pair.from, fromTrace, pair.to, toTrace);
    const comparativeView = projectComparativeReplay(
      reconstruction,
      createComparativeReplayState(reconstruction),
    );
    assert.equal(reconstruction.world.nodes.length, nodeCount);
    assert.ok(reconstruction.divergenceIndices.length > 0);
    assert.equal(prepareTraceRenderingState(pair.from.world, fromTrace).active, true);
    assert.equal(prepareEvolutionRenderingState(evolution.world, evolution.view).active, true);
    assert.equal(prepareComparativeRenderingState(reconstruction.world, comparativeView).active, true);
    assert.equal(replayView.total, replay.steps.length);
  });
});

test("packed sequence alignment preserves every legacy LCS tie for exhaustive short traces", () => {
  const values = sequenceValues(6);
  values.forEach((from) => values.forEach((to) => {
    assert.deepEqual(
      simplified(alignDeterministicSequences(from, to)),
      simplified(referenceAlignment(from, to)),
    );
  }));
});

test("10,000-step identical, insertion, and reordered traces align without a full-number matrix", () => {
  const length = 10_000;
  const from = Array.from({ length }, (_, index) => ({ identity: `step:${index}` }));
  const identical = alignDeterministicSequences(from, from);
  const insertion = alignDeterministicSequences(from, [
    ...from.slice(0, length / 2),
    { identity: "step:inserted" },
    ...from.slice(length / 2),
  ]);
  const reordered = alignDeterministicSequences(from, from.toReversed());
  assert.equal(identical.length, length);
  assert.equal(insertion.length, length + 1);
  assert.deepEqual(simplified(insertion).filter(([left, right]) => left !== right), [[null, "step:inserted"]]);
  assert.equal(reordered.length, (length * 2) - 1);
  assert.equal(reordered.filter(({ from: left, to: right }) => left && right).length, 1);
});

test("dense rendering retains semantic elements while bounding decorative DOM growth", async () => {
  const source = await readFile(new URL("../web/js/graph.js", import.meta.url), "utf8");
  assert.match(source, /const denseWorld = positioned\.length >= 500/);
  assert.match(source, /const synapseCount = denseWorld \? 0/);
  assert.match(source, /const microCount = denseWorld \? \(node\.aggregate \? 5 : 0\)/);
  assert.doesNotMatch(source, /traceState\.orderedSteps\.find\(\(step\) => step\.edgeKey/);
  assert.match(source, /const relatedByKey = new Map\(\)/);
  assert.match(source, /if \(!denseWorld\) \{\s+const list = document\.createElement\("details"\)/);
  assert.match(source, /const richNode = !denseWorld/);
  assert.match(source, /is-graph-focused", !denseWorld && Boolean\(focusKey\)/);
  assert.doesNotMatch(source, /is-dense-graph-focused/);
  assert.match(source, /const affectedNodeKeys = new Set/);
  assert.match(source, /const affectedEdgeKeys = new Set/);
  assert.doesNotMatch(source, /nodeGroup\.querySelectorAll\("\.graph-node"\)\.forEach/);
});

test("Cognitive Evolution ordering is independent of host locale collation", async () => {
  const source = await readFile(new URL("../web/js/cognitive-evolution.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /localeCompare/);
  assert.match(source, /return a < b \? -1 : a > b \? 1 : 0/);
});
