import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { buildComparativeReconstruction } from "../web/js/cognitive-comparative-reconstruction.js";
import {
  advanceComparativeReplay,
  createComparativeReplayState,
  playComparativeReplay,
  projectComparativeReplay,
} from "../web/js/cognitive-comparative-replay.js";
import { compareCognitiveEvolution } from "../web/js/cognitive-evolution.js";
import {
  advanceReplay,
  buildCognitiveReplay,
  createReplayState,
  playReplay,
  projectReplay,
} from "../web/js/cognitive-replay.js";
import { buildCognitiveTrace } from "../web/js/cognitive-trace.js";
import { alignDeterministicSequences } from "../web/js/deterministic-sequence-alignment.js";
import {
  prepareComparativeRenderingState,
  prepareEvolutionRenderingState,
  prepareTraceRenderingState,
} from "../web/js/graph.js";
import {
  benchmarkNodeCounts,
  createBenchmarkFrame,
  createBenchmarkPair,
  reflectionTarget,
} from "./memoryos-scalability-fixture.mjs";

const processStartedAt = performance.now();

function parseArguments(argv) {
  const argumentsByName = new Map(argv.map((argument) => {
    const [name, value = "true"] = argument.replace(/^--/, "").split("=", 2);
    return [name, value];
  }));
  const sizes = argumentsByName.has("sizes")
    ? argumentsByName.get("sizes").split(",").map(Number)
    : [...benchmarkNodeCounts];
  const samples = Number(argumentsByName.get("samples") ?? 5);
  if (!sizes.every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new TypeError("--sizes must contain comma-separated positive integers.");
  }
  if (!Number.isSafeInteger(samples) || samples < 1) {
    throw new TypeError("--samples must be a positive integer.");
  }
  return { sizes, samples, output: argumentsByName.get("output") ?? null };
}

function garbageCollect() {
  if (typeof globalThis.gc === "function") globalThis.gc();
}

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

async function measure(samples, setup, operation) {
  const values = [];
  for (let sample = 0; sample < samples; sample += 1) {
    garbageCollect();
    const input = await setup(sample);
    const started = performance.now();
    await operation(input, sample);
    values.push(performance.now() - started);
  }
  values.sort((left, right) => left - right);
  return Object.freeze({
    samples,
    minimumMs: Number(values[0].toFixed(3)),
    medianMs: Number(percentile(values, 0.5).toFixed(3)),
    p95Ms: Number(percentile(values, 0.95).toFixed(3)),
    maximumMs: Number(values.at(-1).toFixed(3)),
  });
}

function runReplay(trace) {
  const replay = buildCognitiveReplay(trace);
  let state = playReplay(replay, createReplayState(replay));
  while (state.status === "playing") {
    projectReplay(replay, state);
    state = advanceReplay(replay, state);
  }
  projectReplay(replay, state);
  return replay;
}

function runComparativeReplay(reconstruction) {
  let state = playComparativeReplay(
    reconstruction,
    createComparativeReplayState(reconstruction),
  );
  while (state.status !== "completed") {
    projectComparativeReplay(reconstruction, state);
    if (state.status === "paused") state = playComparativeReplay(reconstruction, state);
    state = advanceComparativeReplay(reconstruction, state);
  }
  return projectComparativeReplay(reconstruction, state);
}

function preparedInvestigation(pair) {
  const fromTrace = buildCognitiveTrace(pair.from, reflectionTarget(pair.from).key);
  const toTrace = buildCognitiveTrace(pair.to, reflectionTarget(pair.to).key);
  const evolution = compareCognitiveEvolution(pair.from, pair.to);
  const reconstruction = buildComparativeReconstruction(
    pair.from,
    fromTrace,
    pair.to,
    toTrace,
  );
  return { pair, fromTrace, toTrace, evolution, reconstruction };
}

async function retainedHeapMiB(nodeCount) {
  garbageCollect();
  const before = process.memoryUsage().heapUsed;
  let investigation = preparedInvestigation(createBenchmarkPair(nodeCount));
  garbageCollect();
  const after = process.memoryUsage().heapUsed;
  const value = Number(((after - before) / 1_048_576).toFixed(3));
  // Keep the complete immutable model live until after the measurement.
  if (investigation.reconstruction.world.nodes.length !== nodeCount) {
    throw new Error("The retained benchmark model changed unexpectedly.");
  }
  investigation = null;
  garbageCollect();
  return Math.max(0, value);
}

function alignmentSequences(length) {
  const from = Array.from({ length }, (_, index) => ({ identity: `semantic-step:${index}` }));
  return {
    from,
    identical: from,
    insertion: [
      ...from.slice(0, Math.floor(length / 2)),
      { identity: "semantic-step:inserted" },
      ...from.slice(Math.floor(length / 2)),
    ],
    reordered: from.toReversed(),
  };
}

async function benchmarkAlignment(length, samples) {
  const sequences = alignmentSequences(length);
  const identical = await measure(samples, async () => sequences, async ({ from, identical: to }) => {
    alignDeterministicSequences(from, to);
  });
  const insertion = await measure(samples, async () => sequences, async ({ from, insertion: to }) => {
    alignDeterministicSequences(from, to);
  });
  const reordered = await measure(samples, async () => sequences, async ({ from, reordered: to }) => {
    alignDeterministicSequences(from, to);
  });
  garbageCollect();
  const before = process.memoryUsage();
  const aligned = alignDeterministicSequences(sequences.from, sequences.reordered);
  const after = process.memoryUsage();
  if (aligned.length !== (length * 2) - 1) throw new Error("Worst-case alignment cardinality changed.");
  return {
    identical,
    insertion,
    reordered,
    measuredReorderedArrayBufferMiB: Number(Math.max(
      0,
      (after.arrayBuffers - before.arrayBuffers) / 1_048_576,
    ).toFixed(3)),
  };
}

async function benchmarkNodeCount(nodeCount, samples) {
  const acceptedObservation = await measure(
    samples,
    async () => null,
    async () => createBenchmarkFrame(nodeCount),
  );
  const traceGeneration = await measure(
    samples,
    async () => {
      const frame = createBenchmarkFrame(nodeCount);
      return { frame, target: reflectionTarget(frame).key };
    },
    async ({ frame, target }) => buildCognitiveTrace(frame, target),
  );

  const investigation = preparedInvestigation(createBenchmarkPair(nodeCount));
  const replay = await measure(
    samples,
    async () => investigation.fromTrace,
    async (trace) => runReplay(trace),
  );
  const evolution = await measure(
    samples,
    async () => investigation.pair,
    async (pair) => compareCognitiveEvolution(pair.from, pair.to),
  );
  const comparativeReconstruction = await measure(
    samples,
    async () => investigation,
    async ({ pair, fromTrace, toTrace }) => buildComparativeReconstruction(
      pair.from,
      fromTrace,
      pair.to,
      toTrace,
    ),
  );
  const comparativeReplay = await measure(
    samples,
    async () => investigation.reconstruction,
    async (reconstruction) => runComparativeReplay(reconstruction),
  );
  const rendererPreparation = await measure(
    samples,
    async () => investigation,
    async ({ pair, fromTrace, evolution: comparison, reconstruction }) => {
      prepareTraceRenderingState(pair.from.world, fromTrace);
      prepareEvolutionRenderingState(comparison.world, comparison.view);
      const comparativeView = runComparativeReplay(reconstruction);
      prepareComparativeRenderingState(reconstruction.world, comparativeView);
    },
  );

  return Object.freeze({
    nodeCount,
    edgeCount: investigation.reconstruction.world.edges.length,
    traceSteps: buildCognitiveReplay(investigation.fromTrace).steps.length,
    comparativeMoments: investigation.reconstruction.moments.length,
    retainedHeapMiB: await retainedHeapMiB(nodeCount),
    sequenceAlignment: await benchmarkAlignment(nodeCount, samples),
    latency: {
      acceptedObservation,
      traceGeneration,
      replay,
      evolution,
      comparativeReconstruction,
      comparativeReplay,
      rendererPreparation,
    },
  });
}

const options = parseArguments(process.argv.slice(2));
const results = [];
for (const size of options.sizes) {
  process.stderr.write(`Benchmarking ${size.toLocaleString("en-US")} nodes...\n`);
  results.push(await benchmarkNodeCount(size, options.samples));
}

const report = {
  schema: "MemoryOS-1.1-EngineeringBenchmark-1",
  generatedAt: new Date().toISOString(),
  environment: {
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    v8: process.versions.v8,
    cpu: process.env.PROCESSOR_IDENTIFIER ?? "unreported",
    garbageCollectionExposed: typeof globalThis.gc === "function",
    startupToBenchmarkMs: Number(processStartedAt.toFixed(3)),
  },
  configuration: {
    samples: options.samples,
    nodeCounts: options.sizes,
    deterministicLayout: true,
    rendererMeasure: "renderer-state preparation; browser DOM benchmark is reported separately",
  },
  results,
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (options.output) await writeFile(options.output, serialized, "utf8");
process.stdout.write(serialized);
