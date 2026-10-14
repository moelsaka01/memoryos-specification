import { renderGraph } from "./graph.js";
import { createSemanticWorld } from "./semantic-world.js";

const targetNodeCounts = Object.freeze([100, 500, 1_000, 5_000, 10_000]);
const kinds = Object.freeze([
  "working", "long-term", "semantic", "episodic", "procedural",
  "retrieval", "reflection", "providers", "validation",
]);
const graphContainer = document.querySelector("#benchmark-graph");
const status = document.querySelector("#status");
const output = document.querySelector("#results");
const runButton = document.querySelector("#run");

function benchmarkGraph(nodeCount) {
  const nodes = [{
    key: "workspace",
    identifier: "benchmark-workspace",
    label: "Workspace",
    kind: "workspace",
    family: "Workspace",
    size: 21,
    aggregate: true,
    revision: "workspace-v1",
  }];
  const edges = [];
  for (let index = 1; index < nodeCount; index += 1) {
    const kind = kinds[(index - 1) % kinds.length];
    const key = `${kind}:benchmark-${String(index).padStart(5, "0")}:0`;
    nodes.push({
      key,
      identifier: `benchmark-${index}`,
      label: `Benchmark ${index}`,
      kind,
      family: `Benchmark ${kind}`,
      size: 5,
      revision: `revision-${index}`,
    });
    edges.push({ from: "workspace", to: key, relation: "contains" });
  }
  return { identity: "MemoryOS renderer benchmark", nodes, edges };
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame((timestamp) => resolve(timestamp)));
}

function taskBoundary(delayMs) {
  return new Promise((resolve) => setTimeout(() => resolve(performance.now()), delayMs));
}

function milliseconds(value) {
  return Number(value.toFixed(3));
}

async function measureNodeCount(nodeCount) {
  const projectionStarted = performance.now();
  const world = createSemanticWorld(benchmarkGraph(nodeCount), {
    frameIndex: 0,
    observationIdentifier: `renderer-benchmark-${nodeCount}`,
    workspaceIdentifier: "benchmark-workspace",
    sessionIdentifier: "renderer-benchmark-session",
    source: "memoryos-1.1-browser-render-benchmark",
  });
  const projectionMs = performance.now() - projectionStarted;

  const renderStarted = performance.now();
  renderGraph(graphContainer, world, () => {});
  const domConstructionMs = performance.now() - renderStarted;
  const firstFrameTimestamp = await nextFrame();
  const frameDeliveryMs = firstFrameTimestamp - renderStarted;
  await nextFrame();
  const visualSettleStarted = performance.now();
  const visualSettleTimestamp = await taskBoundary(100);
  const visualSettleMs = visualSettleTimestamp - visualSettleStarted;

  const selectable = graphContainer.querySelector(".graph-node:not(.is-aggregate)");
  const interactionStarted = performance.now();
  selectable.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  const interactionSynchronousMs = performance.now() - interactionStarted;
  const interactionFrameTimestamp = await nextFrame();
  const interactionFrameMs = interactionFrameTimestamp - interactionStarted;
  const domElements = graphContainer.querySelectorAll("*").length;
  const heapMiB = performance.memory
    ? performance.memory.usedJSHeapSize / 1_048_576
    : null;
  return {
    nodeCount,
    edgeCount: world.edges.length,
    domElements,
    projectionMs: milliseconds(projectionMs),
    domConstructionMs: milliseconds(domConstructionMs),
    frameDeliveryMs: milliseconds(frameDeliveryMs),
    visualSettleMs: milliseconds(visualSettleMs),
    interactionSynchronousMs: milliseconds(interactionSynchronousMs),
    interactionFrameMs: milliseconds(interactionFrameMs),
    usedJSHeapMiB: heapMiB === null ? null : milliseconds(heapMiB),
  };
}

export async function runBrowserRenderBenchmark(nodeCounts = targetNodeCounts) {
  runButton.disabled = true;
  const results = [];
  try {
    for (const nodeCount of nodeCounts) {
      status.value = `Measuring ${nodeCount.toLocaleString("en-US")} nodes`;
      await nextFrame();
      results.push(await measureNodeCount(nodeCount));
      output.textContent = JSON.stringify(results, null, 2);
    }
    const report = {
      schema: "MemoryOS-1.1-BrowserRendererBenchmark-1",
      generatedAt: new Date().toISOString(),
      environment: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemoryGiB: navigator.deviceMemory ?? null,
        viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      },
      notes: {
        frameDelivery: "Elapsed from render invocation to the next requestAnimationFrame callback.",
        visualSettle: "Measured task boundary after cold frame delivery, allowing initial SVG paint before interaction.",
        interaction: "Steady-state semantic-node click through synchronous emphasis and next frame delivery.",
      },
      results,
    };
    output.textContent = JSON.stringify(report, null, 2);
    status.value = "Complete";
    globalThis.memoryOSBrowserBenchmark = report;
    return report;
  } finally {
    runButton.disabled = false;
  }
}

runButton.addEventListener("click", () => runBrowserRenderBenchmark());
const requestedSizes = new URLSearchParams(location.search).get("sizes");
if (new URLSearchParams(location.search).get("autorun") === "1") {
  const sizes = requestedSizes ? requestedSizes.split(",").map(Number) : targetNodeCounts;
  runBrowserRenderBenchmark(sizes);
}
