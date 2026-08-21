import { semanticWorldLayout, stableWorldHash as stableHash } from "./semantic-world.js";
import {
  createGraphViewState,
  endGraphFollow,
  reconcileGraphViewState,
  selectGraphNode,
  toggleGraphFollow,
} from "./graph-view-state.js";

const viewBox = semanticWorldLayout.viewBox;

const palettes = Object.freeze({
  workspace: ["#1688ff", "#071b31"],
  memory: ["#2c9cff", "#08243d"],
  working: ["#15c7df", "#07313a"],
  consolidation: ["#43b581", "#0b2a25"],
  "long-term": ["#72d96f", "#102d20"],
  semantic: ["#8c62ff", "#20143f"],
  episodic: ["#38a8ff", "#092b45"],
  procedural: ["#fb8c00", "#3a2408"],
  retrieval: ["#00c7c7", "#073436"],
  reflection: ["#e85ad6", "#36102f"],
  providers: ["#8da0b6", "#1a2633"],
  validation: ["#38d996", "#092e25"],
});

const layerDefinitions = Object.freeze([
  [null, "All layers"],
  ["workspace", "Workspace"],
  ["memory", "Memory"],
  ["working", "Working"],
  ["consolidation", "Consolidation"],
  ["long-term", "Long-Term"],
  ["semantic", "Semantic"],
  ["episodic", "Episodic"],
  ["procedural", "Procedural"],
  ["retrieval", "Retrieval"],
  ["reflection", "Reflection"],
  ["providers", "Providers"],
  ["validation", "Validation"],
]);

const perspectiveKinds = Object.freeze({
  complete: null,
  memory: "memory",
  working: "working",
  consolidation: "consolidation",
  "long-term": "long-term",
  semantic: "semantic",
  episodic: "episodic",
  procedural: "procedural",
  retrieval: "retrieval",
  reflection: "reflection",
  providers: "providers",
  validation: "validation",
});

const traceRoleOrder = Object.freeze([
  "origin-evidence",
  "semantic-transformation",
  "retrieval",
  "reflection-current",
]);

const traceRoleLabels = Object.freeze({
  "origin-evidence": "Evidence",
  "semantic-transformation": "Transform",
  retrieval: "Retrieve",
  "reflection-current": "Outcome",
});

export const cognitiveRegionDefinitions = Object.freeze([
  Object.freeze({ kind: "validation", label: "Validation", signature: "boundary", x: 300, y: 225, width: 92, height: 76 }),
  Object.freeze({ kind: "long-term", label: "Long-Term", signature: "archive", x: 395, y: 195, width: 116, height: 82 }),
  Object.freeze({ kind: "semantic", label: "Semantic", signature: "lattice", x: 500, y: 175, width: 116, height: 78 }),
  Object.freeze({ kind: "retrieval", label: "Retrieval", signature: "corridor", x: 565, y: 275, width: 102, height: 58 }),
  Object.freeze({ kind: "reflection", label: "Reflection", signature: "convergence", x: 535, y: 340, width: 124, height: 88 }),
  Object.freeze({ kind: "working", label: "Working", signature: "buffer", x: 350, y: 345, width: 108, height: 66 }),
  Object.freeze({ kind: "providers", label: "Providers", signature: "ports", x: 485, y: 390, width: 112, height: 60 }),
]);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function pointWithinViewport(point) {
  return {
    x: clamp(point.x, 110, viewBox.width - 110),
    y: clamp(point.y, 145, viewBox.height - 105),
  };
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function curvedEdge(from, to, edge) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const direction = stableHash(edge.key ?? `${edge.from}|${edge.to}|${edge.relation}`) % 2 === 0 ? 1 : -1;
  const bend = clamp(distance * .13, 9, edge.relation === "contains" ? 28 : 48) * direction;
  const controlX = ((from.x + to.x) / 2) + (normalX * bend);
  const controlY = ((from.y + to.y) / 2) + (normalY * bend);
  const format = (value) => Number(value.toFixed(2));
  return {
    forward: `M ${format(from.x)} ${format(from.y)} Q ${format(controlX)} ${format(controlY)} ${format(to.x)} ${format(to.y)}`,
    reverse: `M ${format(to.x)} ${format(to.y)} Q ${format(controlX)} ${format(controlY)} ${format(from.x)} ${format(from.y)}`,
    controlX,
    controlY,
  };
}

function pointOnEdge(from, to, geometry, t) {
  const inverse = 1 - t;
  return {
    x: (inverse * inverse * from.x) + (2 * inverse * t * geometry.controlX) + (t * t * to.x),
    y: (inverse * inverse * from.y) + (2 * inverse * t * geometry.controlY) + (t * t * to.y),
  };
}

function flowAppearance(kind) {
  const appearances = {
    evidence: { color: "#59d998", opacity: .62 },
    retrieval: { color: "#32d8d2", opacity: .82 },
    reflection: { color: "#f06ddd", opacity: .9 },
    consolidation: { color: "#67d17a", opacity: .7 },
    association: { color: "#75a9d6", opacity: .38 },
  };
  return appearances[kind];
}

function normalizePerspective(perspective) {
  if (typeof perspective !== "string" || perspective.length === 0) return "complete";
  return Object.hasOwn(perspectiveKinds, perspective) || perspective === "provenance"
    ? perspective
    : "complete";
}

function regionOutline(definition) {
  const { x, y, width, height, signature } = definition;
  const left = x - (width / 2);
  const right = x + (width / 2);
  const top = y - (height / 2);
  const bottom = y + (height / 2);
  if (signature === "lattice") {
    return `M ${left + 14} ${top} L ${right - 14} ${top} L ${right} ${y} L ${right - 14} ${bottom} L ${left + 14} ${bottom} L ${left} ${y} Z`;
  }
  if (signature === "corridor") {
    return `M ${left + 12} ${top} L ${right} ${top} L ${right - 12} ${bottom} L ${left} ${bottom} Z`;
  }
  if (signature === "convergence") {
    return `M ${x} ${top} L ${right} ${y} L ${x} ${bottom} L ${left} ${y} Z`;
  }
  if (signature === "boundary") {
    return `M ${x} ${top} L ${right} ${top + 16} L ${right - 8} ${bottom - 13} L ${x} ${bottom} L ${left + 8} ${bottom - 13} L ${left} ${top + 16} Z`;
  }
  const radius = signature === "buffer" ? height / 2 : 10;
  return `M ${left + radius} ${top} H ${right - radius} Q ${right} ${top} ${right} ${top + radius} V ${bottom - radius} Q ${right} ${bottom} ${right - radius} ${bottom} H ${left + radius} Q ${left} ${bottom} ${left} ${bottom - radius} V ${top + radius} Q ${left} ${top} ${left + radius} ${top} Z`;
}

function appendRegionMotif(group, definition) {
  const { x, y, width, height, signature } = definition;
  const motif = svgElement("g", { class: `cognitive-region-motif motif-${signature}`, "aria-hidden": "true" });
  if (signature === "archive") {
    [-.2, .12].forEach((offset) => motif.append(svgElement("line", {
      x1: x - (width * .34), y1: y + (height * offset), x2: x + (width * .34), y2: y + (height * offset),
    })));
  } else if (signature === "lattice") {
    motif.append(
      svgElement("line", { x1: x - 24, y1: y + 18, x2: x, y2: y - 18 }),
      svgElement("line", { x1: x, y1: y - 18, x2: x + 25, y2: y + 16 }),
      svgElement("line", { x1: x - 24, y1: y + 18, x2: x + 25, y2: y + 16 }),
    );
  } else if (signature === "corridor") {
    motif.append(
      svgElement("line", { x1: x - 25, y1: y, x2: x + 24, y2: y }),
      svgElement("path", { d: `M ${x + 16} ${y - 6} L ${x + 25} ${y} L ${x + 16} ${y + 6}` }),
    );
  } else if (signature === "convergence") {
    motif.append(
      svgElement("line", { x1: x - 30, y1: y - 18, x2: x, y2: y }),
      svgElement("line", { x1: x - 30, y1: y + 18, x2: x, y2: y }),
      svgElement("circle", { cx: x, cy: y, r: 5 }),
    );
  } else if (signature === "buffer") {
    [-18, 0, 18].forEach((offset) => motif.append(svgElement("rect", {
      x: x + offset - 5, y: y - 5, width: 10, height: 10, rx: 2,
    })));
  } else if (signature === "ports") {
    [-24, 0, 24].forEach((offset) => motif.append(svgElement("line", {
      x1: x + offset, y1: y + (height * .26), x2: x + offset, y2: y + (height * .43),
    })));
  } else if (signature === "boundary") {
    motif.append(svgElement("path", { d: `M ${x - 12} ${y} L ${x - 3} ${y + 9} L ${x + 15} ${y - 12}` }));
  }
  group.append(motif);
}

export function prepareTraceJourney(renderingState) {
  if (!renderingState?.active) return Object.freeze([]);
  const seen = new Set();
  const steps = [];
  traceRoleOrder.forEach((role) => {
    renderingState.orderedSteps
      .filter((step) => step.role === role)
      .forEach((step) => {
        if (seen.has(step.nodeKey)) return;
        seen.add(step.nodeKey);
        steps.push(Object.freeze({ ...step, journeyIndex: steps.length }));
      });
  });
  return Object.freeze(steps);
}

export function prepareTraceRenderingState(world, trace = null) {
  const inactive = Object.freeze({
    active: false,
    identifier: null,
    targetNodeKey: null,
    nodeKeys: Object.freeze([]),
    edgeKeys: Object.freeze([]),
    nodeRecords: Object.freeze([]),
    orderedSteps: Object.freeze([]),
  });
  if (trace === null || trace === undefined) return inactive;
  if (!world || !trace || trace.kind !== "MemoryOSCognitiveTrace" || trace.version !== "1.1") {
    throw new TypeError("A MemoryOS 1.1 Cognitive Trace is required for Trace mode.");
  }
  if (trace.frameIdentifier !== world.frame?.identifier) {
    throw new TypeError("The Cognitive Trace is not bound to the rendered semantic-world frame.");
  }
  const worldNodes = new Map(world.nodes.map((node) => [node.key, node]));
  const worldEdges = new Map(world.edges.map((edge) => [edge.key, edge]));
  const nodeRecords = new Map();
  const edgeKeys = new Set();
  const orderedSteps = [];

  trace.branches.forEach((branch, branchIndex) => {
    branch.steps.forEach((step, stepIndex) => {
      const node = worldNodes.get(step.nodeKey);
      if (!node) throw new TypeError(`Cognitive Trace node '${step.nodeKey}' is absent from the rendered world.`);
      if (step.edgeKey !== null) {
        const edge = worldEdges.get(step.edgeKey);
        if (!edge) throw new TypeError(`Cognitive Trace relationship '${step.edgeKey}' is absent from the rendered world.`);
        edgeKeys.add(step.edgeKey);
      }
      const ordinalLabel = `${branchIndex + 1}.${stepIndex + 1}`;
      const record = Object.freeze({
        branch: branchIndex + 1,
        step: stepIndex + 1,
        ordinalLabel,
        role: step.role,
        nodeKey: step.nodeKey,
        edgeKey: step.edgeKey,
        direction: step.direction,
      });
      orderedSteps.push(record);
      const memberships = nodeRecords.get(step.nodeKey) ?? [];
      memberships.push(record);
      nodeRecords.set(step.nodeKey, memberships);
    });
  });
  if (!worldNodes.has(trace.targetNodeKey) || !nodeRecords.has(trace.targetNodeKey)) {
    throw new TypeError("The Cognitive Trace target is absent from the rendered world.");
  }
  const frozenNodeRecords = Object.freeze([...nodeRecords.entries()].map(([nodeKey, memberships]) => {
    const frozenMemberships = Object.freeze([...memberships]);
    const primary = frozenMemberships[0];
    return Object.freeze({
      ...primary,
      nodeKey,
      ordinalLabel: frozenMemberships.map(({ ordinalLabel }) => ordinalLabel).join(", "),
      roles: Object.freeze([...new Set(frozenMemberships.map(({ role }) => role))]),
      memberships: frozenMemberships,
    });
  }));
  return Object.freeze({
    active: true,
    identifier: trace.identifier,
    targetNodeKey: trace.targetNodeKey,
    nodeKeys: Object.freeze(frozenNodeRecords.map(({ nodeKey }) => nodeKey)),
    edgeKeys: Object.freeze([...edgeKeys]),
    nodeRecords: frozenNodeRecords,
    orderedSteps: Object.freeze(orderedSteps),
  });
}

export function renderGraph(
  container,
  world,
  onSelect,
  {
    perspective = "complete",
    viewState = {},
    activity = {},
    trace = null,
    replayView = null,
    onReplayAction = null,
    onViewStateChange = null,
  } = {},
) {
  const activePerspective = normalizePerspective(perspective);
  const identity = world.identity ?? "Memory intelligence graph";
  const graphDescription = world.description ?? "One interactive topology of MemoryOS cognitive state.";
  const positioned = world.nodes;
  const byId = new Map(positioned.map((node) => [node.key, node]));
  const incomingViewState = createGraphViewState(viewState);
  const reconciledViewState = reconcileGraphViewState(world, incomingViewState);
  const viewStateWasReconciled = incomingViewState.selectedKey !== reconciledViewState.selectedKey
    || incomingViewState.followedKey !== reconciledViewState.followedKey;
  const activeNodeKeys = new Set(activity.nodeKeys ?? []);
  const activeEdgeKeys = new Set(activity.edgeKeys ?? []);
  const traceState = prepareTraceRenderingState(world, trace);
  const traceNodeKeys = new Set(traceState.nodeKeys);
  const traceEdgeKeys = new Set(traceState.edgeKeys);
  const traceNodeRecords = new Map(traceState.nodeRecords.map((record) => [record.nodeKey, record]));
  const traceJourney = prepareTraceJourney(traceState);
  const traceJourneyIndex = new Map(traceJourney.map((step) => [step.nodeKey, step.journeyIndex]));
  const traceRegionKinds = new Set(traceJourney.map((step) => byId.get(step.nodeKey)?.kind).filter(Boolean));
  const replayActive = Boolean(traceState.active && replayView?.active);
  let currentReplayView = replayView;
  const replayCompletedNodes = new Set(replayView?.completedNodeKeys ?? []);
  const replayCompletedEdges = new Set(replayView?.completedEdgeKeys ?? []);
  const replayFutureNodes = new Set(replayView?.futureNodeKeys ?? []);
  const replayFutureEdges = new Set(replayView?.futureEdgeKeys ?? []);
  const shell = document.createElement("div");
  shell.className = "knowledge-graph topology-interface memory-intelligence-graph";
  shell.dataset.perspective = activePerspective;
  shell.dataset.graphIdentity = "memory-intelligence-graph";
  shell.dataset.layout = world.layout?.identifier ?? "unidentified-layout";
  shell.dataset.frame = world.frame?.identifier ?? "unidentified-frame";
  shell.dataset.traceMode = traceState.active ? "active" : "inactive";
  if (traceState.active) {
    shell.dataset.traceIdentifier = traceState.identifier;
    shell.classList.add("has-active-trace");
  }
  if (replayActive) {
    shell.dataset.replayStatus = replayView.status;
    shell.dataset.replayCursor = String(replayView.cursor);
    shell.classList.add("has-cognitive-replay");
  }
  shell.setAttribute("role", "region");
  shell.setAttribute("aria-label", identity);

  let interactionMode = reconciledViewState.interactionMode;
  let selectedKey = reconciledViewState.selectedKey;
  let followedKey = reconciledViewState.followedKey;
  let previewKey = null;
  let filteredKind = layerDefinitions.some(([kind]) => kind === reconciledViewState.filteredKind)
    ? reconciledViewState.filteredKind
    : null;
  let dragging = false;
  let dragOrigin = null;
  const camera = {
    scale: clamp(reconciledViewState.camera.scale, .75, 2.5),
    x: reconciledViewState.camera.x,
    y: reconciledViewState.camera.y,
  };
  let followButton = null;
  const emitViewState = () => {
    if (typeof onViewStateChange !== "function") return;
    onViewStateChange({
      selectedKey,
      followedKey,
      filteredKind,
      interactionMode,
      camera: { ...camera },
    });
  };
  const currentViewState = () => ({
    selectedKey,
    followedKey,
    filteredKind,
    interactionMode,
    camera: { ...camera },
  });

  const svg = svgElement("svg", {
    class: "graph-surface topology-surface",
    viewBox: `0 0 ${viewBox.width} ${viewBox.height}`,
    role: "group",
    tabindex: "0",
    "aria-labelledby": "graph-title graph-description",
  });
  const title = svgElement("title", { id: "graph-title" });
  title.textContent = identity;
  const description = svgElement("desc", { id: "graph-description" });
  description.textContent = traceState.active
    ? `${graphDescription} Cognitive Trace mode is active with ${traceState.orderedSteps.length} ordered observations across ${trace.branches.length} evidence branches.`
    : graphDescription;
  svg.append(title, description);

  const defs = svgElement("defs");
  const filter = svgElement("filter", { id: "node-glow", x: "-80%", y: "-80%", width: "260%", height: "260%" });
  filter.append(svgElement("feGaussianBlur", { stdDeviation: "4", result: "blur" }));
  const merge = svgElement("feMerge");
  merge.append(svgElement("feMergeNode", { in: "blur" }), svgElement("feMergeNode", { in: "SourceGraphic" }));
  filter.append(merge);
  defs.append(filter);
  const routeMarker = svgElement("marker", {
    id: "cognitive-trace-arrow",
    viewBox: "0 0 10 10",
    refX: "8",
    refY: "5",
    markerWidth: "5",
    markerHeight: "5",
    orient: "auto-start-reverse",
  });
  routeMarker.append(svgElement("path", { d: "M 1 1 L 9 5 L 1 9 Z" }));
  defs.append(routeMarker);
  svg.append(defs);

  const scene = svgElement("g", { class: "graph-camera topology-camera" });
  const regions = svgElement("g", { class: "cognitive-regions", "aria-hidden": "true" });
  cognitiveRegionDefinitions.forEach((definition) => {
    const region = svgElement("g", {
      class: `cognitive-region region-${definition.kind}${traceRegionKinds.has(definition.kind) ? " is-trace-region" : ""}`,
      "data-region-kind": definition.kind,
      "data-region-signature": definition.signature,
    });
    region.append(svgElement("path", { class: "cognitive-region-boundary", d: regionOutline(definition) }));
    appendRegionMotif(region, definition);
    const label = svgElement("text", {
      class: "cognitive-region-label",
      x: definition.x - (definition.width / 2) + 8,
      y: definition.y - (definition.height / 2) - 7,
    });
    label.textContent = definition.label;
    region.append(label);
    regions.append(region);
  });
  scene.append(regions);
  const edges = svgElement("g", { class: "graph-edges topology-edges", "aria-hidden": "true" });
  const traceRoutes = svgElement("g", { class: "cognitive-trace-routes", "aria-hidden": "true" });
  const edgeRecords = [];
  world.edges.forEach((edge, edgeIndex) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return;
    const geometry = curvedEdge(from, to, edge);
    const flowKind = edge.flowKind;
    const color = flowAppearance(flowKind)?.color ?? palettes[to.kind]?.[0] ?? "#42617b";
    const sharedAttributes = {
      pathLength: "1",
      fill: "none",
      stroke: color,
      "stroke-width": edge.relation === "contains" ? 1 : 1.25,
      "stroke-opacity": edge.relation === "contains" ? .24 : .5,
      "data-relation": edge.relation,
      "data-flow": flowKind ?? "structural",
      "data-from": edge.from,
      "data-to": edge.to,
      "data-from-kind": from.kind,
      "data-to-kind": to.kind,
    };
    const base = svgElement("path", {
      class: `graph-edge-base topology-edge relation-${edge.relation}${flowKind ? ` flow-${flowKind}` : ""}`,
      d: geometry.forward,
      ...sharedAttributes,
    });
    if (activeEdgeKeys.has(edge.key)) base.classList.add("is-observed-activity");
    if (traceState.active) {
      base.classList.add(traceEdgeKeys.has(edge.key) ? "is-trace-relationship" : "is-trace-dimmed");
      const traceStep = traceState.orderedSteps.find((step) => step.edgeKey === edge.key);
      if (traceStep) {
        base.dataset.traceDirection = traceStep.direction;
        base.dataset.traceOrdinal = traceStep.ordinalLabel;
        const route = svgElement("path", {
          class: `cognitive-trace-route route-${traceStep.role}`,
          d: traceStep.direction === "reverse" ? geometry.reverse : geometry.forward,
          "data-trace-ordinal": traceStep.ordinalLabel,
          "data-from": edge.from,
          "data-to": edge.to,
          "data-edge-key": edge.key,
          "marker-end": "url(#cognitive-trace-arrow)",
        });
        traceRoutes.append(route);
      }
    }
    if (replayActive) {
      base.classList.toggle("is-replay-completed", replayCompletedEdges.has(edge.key));
      base.classList.toggle("is-replay-current", replayView.currentEdgeKey === edge.key);
      base.classList.toggle("is-replay-future", replayFutureEdges.has(edge.key));
    }
    const edgeTitle = svgElement("title");
    edgeTitle.textContent = `${from.label} ${edge.relation} ${to.label}`;
    base.append(edgeTitle);
    edges.append(base);

    let flow = null;
    if (flowKind) {
      const appearance = flowAppearance(flowKind);
      const reversesRetrieval = flowKind === "retrieval" && from.kind === "retrieval";
      flow = svgElement("path", {
        class: `graph-edge-flow topology-flow flow-${flowKind}${reversesRetrieval ? " is-reversed" : ""}`,
        d: reversesRetrieval ? geometry.reverse : geometry.forward,
        ...sharedAttributes,
        stroke: appearance.color,
        "stroke-opacity": appearance.opacity,
      });
      if (activeEdgeKeys.has(edge.key)) flow.classList.add("is-observed-activity");
      if (traceState.active) {
        flow.classList.add(traceEdgeKeys.has(edge.key) ? "is-trace-relationship" : "is-trace-dimmed");
        const traceStep = traceState.orderedSteps.find((step) => step.edgeKey === edge.key);
        if (traceStep) {
          flow.dataset.traceDirection = traceStep.direction;
          flow.dataset.traceOrdinal = traceStep.ordinalLabel;
        }
      }
      if (replayActive) {
        flow.classList.toggle("is-replay-completed", replayCompletedEdges.has(edge.key));
        flow.classList.toggle("is-replay-current", replayView.currentEdgeKey === edge.key);
        flow.classList.toggle("is-replay-future", replayFutureEdges.has(edge.key));
      }
      edges.append(flow);
    }
    const synapseCount = flowKind ? 3 : 2;
    for (let synapseIndex = 1; synapseIndex <= synapseCount; synapseIndex += 1) {
      const jitter = ((stableHash(`${edge.from}:${edge.to}:${synapseIndex}`) % 13) - 6) / 100;
      const point = pointOnEdge(from, to, geometry, (synapseIndex / (synapseCount + 1)) + jitter);
      edges.append(svgElement("circle", {
        class: `topology-synapse synapse-${flowKind ?? edge.relation}`,
        cx: Number(point.x.toFixed(2)),
        cy: Number(point.y.toFixed(2)),
        r: flowKind ? .95 : .62,
        fill: color,
        opacity: flowKind ? .7 : .3,
      }));
    }
    edgeRecords.push({ edge, from, to, base, flow, flowKind });
  });
  if (replayActive) {
    traceRoutes.querySelectorAll(".cognitive-trace-route").forEach((route) => {
      const edgeKey = route.dataset.edgeKey;
      route.classList.toggle("is-replay-completed", replayCompletedEdges.has(edgeKey));
      route.classList.toggle("is-replay-current", replayView.currentEdgeKey === edgeKey);
      route.classList.toggle("is-replay-future", replayFutureEdges.has(edgeKey));
    });
  }
  scene.append(edges, traceRoutes);

  const microstructure = svgElement("g", { class: "topology-microstructure", "aria-hidden": "true" });
  positioned.forEach((node) => {
    const [color] = palettes[node.kind] ?? palettes.workspace;
    const microCount = node.aggregate ? 11 : node.detail ? 1 : 4;
    const microPoints = [];
    for (let microIndex = 0; microIndex < microCount; microIndex += 1) {
      const seed = stableHash(`${node.key}:micro:${microIndex}`);
      const angle = ((seed % 360) / 180) * Math.PI;
      const distance = (node.aggregate ? 22 : 12) + ((seed >>> 9) % (node.aggregate ? 18 : 10));
      const point = pointWithinViewport({
        x: node.x + (Math.cos(angle) * distance),
        y: node.y + (Math.sin(angle) * distance * .72),
      });
      microPoints.push(point);
      microstructure.append(svgElement("line", {
        class: `topology-micro-edge micro-${node.kind}`,
        x1: node.x,
        y1: node.y,
        x2: Number(point.x.toFixed(2)),
        y2: Number(point.y.toFixed(2)),
        stroke: color,
      }));
      microstructure.append(svgElement("circle", {
        class: `topology-micro-node micro-${node.kind}`,
        cx: Number(point.x.toFixed(2)),
        cy: Number(point.y.toFixed(2)),
        r: node.aggregate ? 1.55 : 1.05,
        fill: color,
      }));
    }
    for (let microIndex = 1; microIndex < microPoints.length; microIndex += 1) {
      const previous = microPoints[microIndex - 1];
      const current = microPoints[microIndex];
      microstructure.append(svgElement("line", {
        class: `topology-micro-edge micro-${node.kind}`,
        x1: Number(previous.x.toFixed(2)),
        y1: Number(previous.y.toFixed(2)),
        x2: Number(current.x.toFixed(2)),
        y2: Number(current.y.toFixed(2)),
        stroke: color,
      }));
    }
  });
  scene.append(microstructure);

  const nodeGroup = svgElement("g", { class: "graph-nodes topology-nodes" });
  let focusCameraOn = () => {};
  const relatedKeysFor = (nodeKey) => {
    const relatedKeys = new Set([nodeKey]);
    world.edges.forEach((edge) => {
      if (edge.from === nodeKey) relatedKeys.add(edge.to);
      if (edge.to === nodeKey) relatedKeys.add(edge.from);
    });
    return relatedKeys;
  };

  const perspectiveKind = perspectiveKinds[activePerspective] ?? null;
  const perspectiveKeys = new Set();
  const perspectiveEdgeKeys = new Set();
  if (activePerspective === "provenance") {
    edgeRecords.forEach((record, index) => {
      if (["evidence", "reflection", "retrieval"].includes(record.flowKind)) {
        perspectiveKeys.add(record.edge.from);
        perspectiveKeys.add(record.edge.to);
        perspectiveEdgeKeys.add(index);
      }
    });
  } else if (perspectiveKind) {
    positioned.forEach((node) => {
      if (node.kind === perspectiveKind || node.kind === "workspace") perspectiveKeys.add(node.key);
    });
    edgeRecords.forEach((record, index) => {
      if (record.from.kind === perspectiveKind || record.to.kind === perspectiveKind) {
        perspectiveKeys.add(record.edge.from);
        perspectiveKeys.add(record.edge.to);
        perspectiveEdgeKeys.add(index);
      }
    });
  }

  const applyGraphEmphasis = () => {
    const focusKey = previewKey ?? selectedKey;
    const relatedKeys = focusKey ? relatedKeysFor(focusKey) : new Set();
    const hasPerspective = activePerspective !== "complete";
    svg.classList.toggle("has-active-trace", traceState.active);
    svg.classList.toggle("is-graph-focused", Boolean(focusKey));
    svg.classList.toggle("has-perspective", hasPerspective);
    nodeGroup.querySelectorAll(".graph-node").forEach((nodeElement) => {
      const key = nodeElement.dataset.observationKey;
      const selected = key === selectedKey;
      const followed = key === followedKey;
      const inPerspective = !hasPerspective || perspectiveKeys.has(key);
      nodeElement.classList.toggle("is-selected", selected);
      nodeElement.classList.toggle("is-followed", followed);
      nodeElement.classList.toggle("is-graph-related", Boolean(focusKey) && relatedKeys.has(key));
      nodeElement.classList.toggle("is-perspective-primary", Boolean(perspectiveKind) && nodeElement.dataset.kind === perspectiveKind);
      nodeElement.classList.toggle("is-perspective-dimmed", !inPerspective);
      nodeElement.classList.toggle("is-filter-dimmed", Boolean(filteredKind) && nodeElement.dataset.kind !== filteredKind);
      nodeElement.classList.toggle("is-trace-step", traceState.active && traceNodeKeys.has(key));
      nodeElement.classList.toggle("is-trace-target", traceState.active && key === traceState.targetNodeKey);
      nodeElement.classList.toggle("is-trace-dimmed", traceState.active && !traceNodeKeys.has(key));
      const journeyIndex = traceJourneyIndex.get(key);
      const followedIndex = traceJourneyIndex.get(followedKey);
      nodeElement.classList.toggle("is-journey-current", traceState.active && key === followedKey);
      nodeElement.classList.toggle("is-journey-complete", Number.isInteger(journeyIndex) && Number.isInteger(followedIndex) && journeyIndex < followedIndex);
      nodeElement.classList.toggle("is-journey-upcoming", Number.isInteger(journeyIndex) && Number.isInteger(followedIndex) && journeyIndex > followedIndex);
      nodeElement.classList.toggle("is-replay-completed", replayActive && replayCompletedNodes.has(key));
      nodeElement.classList.toggle("is-replay-current", replayActive && currentReplayView.currentNodeKey === key);
      nodeElement.classList.toggle("is-replay-future", replayActive && replayFutureNodes.has(key));
      nodeElement.setAttribute("aria-pressed", String(selected));
    });
    edgeRecords.forEach((record, index) => {
      const related = record.edge.from === focusKey || record.edge.to === focusKey;
      const filtered = Boolean(filteredKind)
        && record.from.kind !== filteredKind
        && record.to.kind !== filteredKind;
      const inPerspective = !hasPerspective || perspectiveEdgeKeys.has(index);
      [record.base, record.flow].filter(Boolean).forEach((edgeElement) => {
        edgeElement.classList.toggle("is-graph-related", Boolean(focusKey) && related);
        edgeElement.classList.toggle("is-perspective-dimmed", !inPerspective);
        edgeElement.classList.toggle("is-filter-dimmed", filtered);
      });
    });
    if (followButton) {
      followButton.classList.toggle("is-active", Boolean(followedKey));
      followButton.setAttribute("aria-pressed", String(Boolean(followedKey)));
      followButton.disabled = traceState.active ? traceJourney.length === 0 : !selectedKey && !followedKey;
      followButton.textContent = traceState.active
        ? (followedKey ? "Following trace" : "Follow trace")
        : (followedKey ? "Following" : "Follow");
    }
    shell.querySelectorAll("[data-trace-journey-action]").forEach((button) => {
      const currentIndex = traceJourneyIndex.get(followedKey);
      if (button.dataset.traceJourneyAction === "previous") button.disabled = !Number.isInteger(currentIndex) || currentIndex <= 0;
      if (button.dataset.traceJourneyAction === "next") button.disabled = !Number.isInteger(currentIndex) || currentIndex >= traceJourney.length - 1;
    });
    const journeyOutput = shell.querySelector(".trace-journey-position");
    if (journeyOutput) {
      const currentIndex = traceJourneyIndex.get(followedKey);
      journeyOutput.value = Number.isInteger(currentIndex) ? `${currentIndex + 1} / ${traceJourney.length}` : `${traceJourney.length} steps`;
    }
  };

  positioned.forEach((node) => {
    const [stroke, fill] = palettes[node.kind] ?? palettes.workspace;
    const group = svgElement("g", {
      class: `graph-node topology-node graph-node-${node.kind}${node.aggregate ? " is-aggregate" : ""}${node.detail ? " is-detail" : ""}`,
      tabindex: "0",
      role: "button",
      "aria-label": `${node.family ?? node.kind}: ${node.label}`,
      "aria-pressed": "false",
      "data-observation-key": node.key,
      "data-observation-path": node.observationPath ?? "",
      "data-kind": node.kind,
      "data-family": node.family ?? node.kind,
      transform: `translate(${node.x} ${node.y})`,
    });
    const traceRecord = traceNodeRecords.get(node.key);
    if (traceRecord) {
      group.dataset.traceRole = traceRecord.roles.join(" ");
      group.dataset.traceOrdinal = traceRecord.ordinalLabel;
      const memberships = traceRecord.memberships
        .map(({ branch, step }) => `branch ${branch}, step ${step}`)
        .join("; ");
      const roles = traceRecord.roles.map((role) => role.replaceAll("-", " ")).join(", ");
      group.setAttribute(
        "aria-label",
        `${node.key === traceState.targetNodeKey ? "Current Reflection; " : ""}Trace memberships: ${memberships}; ${roles}; ${node.family ?? node.kind}: ${node.label}`,
      );
      if (node.key === traceState.targetNodeKey) group.setAttribute("aria-current", "true");
      const journeyIndex = traceJourneyIndex.get(node.key);
      if (Number.isInteger(journeyIndex)) group.dataset.journeyIndex = String(journeyIndex);
      if (traceRecord.roles.includes("origin-evidence")) group.classList.add("is-trace-origin");
    }
    if (activeNodeKeys.has(node.key)) group.classList.add("is-observed-activity");
    const pulse = svgElement("circle", {
      class: `graph-node-pulse graph-node-pulse-${node.kind}`,
      r: node.size + (node.aggregate ? 8 : 5),
      fill: "none",
      stroke,
      "stroke-width": node.aggregate ? 1.2 : .8,
      opacity: node.detail ? .08 : .17,
    });
    const halo = svgElement("circle", {
      class: "graph-node-halo",
      r: node.size + (node.aggregate ? 7 : 5),
      fill: stroke,
      opacity: node.detail ? .06 : .12,
      filter: "url(#node-glow)",
    });
    const body = svgElement("circle", {
      class: "graph-node-body",
      r: node.size,
      fill,
      stroke,
      "stroke-width": node.kind === "workspace" ? 3 : node.aggregate ? 2.4 : 1.7,
    });
    const core = svgElement("circle", {
      class: "graph-node-core",
      r: Math.max(2, node.size * .3),
      fill: stroke,
    });
    const nodeTitle = svgElement("title");
    nodeTitle.textContent = `${node.label} - select for exact details`;
    group.append(pulse, halo, body, core, nodeTitle);
    if (traceRecord) {
      const marker = svgElement("g", { class: "cognitive-trace-marker", "aria-hidden": "true" });
      traceRecord.memberships.forEach((membership, membershipIndex) => {
        const markerX = node.size + 7 + ((membershipIndex % 2) * 17);
        const markerY = -(node.size + 7) - (Math.floor(membershipIndex / 2) * 17);
        const markerEntry = svgElement("g", {
          class: "cognitive-trace-marker-entry",
          "data-trace-ordinal": membership.ordinalLabel,
          "data-trace-role": membership.role,
        });
        markerEntry.append(svgElement("circle", { cx: markerX, cy: markerY, r: 7.5 }));
        const markerText = svgElement("text", {
          x: markerX,
          y: markerY + 2.5,
          "text-anchor": "middle",
        });
        markerText.textContent = membership.role === "origin-evidence"
          ? "O"
          : membership.role === "reflection-current" ? "R" : String(membershipIndex + 1);
        markerEntry.append(markerText);
        marker.append(markerEntry);
      });
      group.append(marker);
      if (traceRecord.roles.includes("origin-evidence") || node.key === traceState.targetNodeKey) {
        const waypoint = svgElement("text", {
          class: "cognitive-trace-waypoint",
          x: 0,
          y: -(node.size + 18),
          "text-anchor": "middle",
        });
        waypoint.textContent = node.key === traceState.targetNodeKey ? "OUTCOME" : "ORIGIN";
        group.append(waypoint);
      }
    }
    if (traceRecord || node.kind === "workspace" || node.aggregate || (!node.detail && node.size >= 12)) {
      const label = svgElement("text", {
        class: traceRecord ? "graph-node-label cognitive-trace-node-label" : "graph-node-label",
        x: 0,
        y: node.size + 18,
        "text-anchor": "middle",
      });
      label.textContent = node.label;
      group.append(label);
    }
    const select = () => {
      if (interactionMode === "pan") return;
      const next = selectGraphNode(currentViewState(), node.key);
      selectedKey = next.selectedKey;
      followedKey = next.followedKey;
      previewKey = null;
      applyGraphEmphasis();
      if (followedKey) focusCameraOn(node);
      emitViewState();
      if (typeof onSelect === "function") onSelect(node);
    };
    group.addEventListener("click", select);
    group.addEventListener("pointerenter", () => { previewKey = node.key; applyGraphEmphasis(); });
    group.addEventListener("pointerleave", () => { previewKey = null; applyGraphEmphasis(); });
    group.addEventListener("focus", () => { previewKey = node.key; applyGraphEmphasis(); });
    group.addEventListener("blur", () => { previewKey = null; applyGraphEmphasis(); });
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
    nodeGroup.append(group);
  });
  scene.append(nodeGroup);
  svg.append(scene);
  shell.append(svg);

  const toolbar = document.createElement("div");
  toolbar.className = "graph-toolbar";
  toolbar.setAttribute("role", "group");
  toolbar.setAttribute("aria-label", "Cognitive topology camera controls");
  const createToolButton = (label, action, compactLabel = label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "graph-tool";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.textContent = compactLabel;
    if (action) button.addEventListener("click", action);
    return button;
  };
  const selectModeButton = createToolButton("Select nodes", null, "Select");
  const panModeButton = createToolButton("Pan graph", null, "Pan");
  selectModeButton.classList.toggle("is-active", interactionMode === "select");
  panModeButton.classList.toggle("is-active", interactionMode === "pan");
  selectModeButton.setAttribute("aria-pressed", String(interactionMode === "select"));
  panModeButton.setAttribute("aria-pressed", String(interactionMode === "pan"));
  shell.classList.toggle("is-pan-mode", interactionMode === "pan");
  const cameraReadout = document.createElement("output");
  cameraReadout.className = "graph-zoom-readout";
  cameraReadout.setAttribute("aria-live", "polite");
  const applyCamera = (notify = true) => {
    camera.x = clamp(camera.x, -340 * camera.scale, 340 * camera.scale);
    camera.y = clamp(camera.y, -210 * camera.scale, 210 * camera.scale);
    scene.setAttribute("transform", `translate(${camera.x} ${camera.y}) scale(${camera.scale})`);
    cameraReadout.value = `${Math.round(camera.scale * 100)}%`;
    if (notify) emitViewState();
  };
  const zoomBy = (factor) => {
    const previous = camera.scale;
    const next = clamp(previous * factor, .75, 2.5);
    camera.x = viewBox.centerX - ((viewBox.centerX - camera.x) * (next / previous));
    camera.y = viewBox.centerY - ((viewBox.centerY - camera.y) * (next / previous));
    camera.scale = next;
    applyCamera();
  };
  const resetCamera = () => {
    followedKey = endGraphFollow(currentViewState()).followedKey;
    camera.scale = 1;
    camera.x = 0;
    camera.y = 0;
    applyCamera();
    applyGraphEmphasis();
  };
  focusCameraOn = (node) => {
    if (!node) return;
    camera.scale = Math.max(camera.scale, traceState.active ? 1.18 : 1.35);
    camera.x = viewBox.centerX - (node.x * camera.scale);
    camera.y = viewBox.centerY - (node.y * camera.scale);
    applyCamera();
  };
  const setInteractionMode = (mode) => {
    interactionMode = mode;
    shell.classList.toggle("is-pan-mode", mode === "pan");
    selectModeButton.classList.toggle("is-active", mode === "select");
    panModeButton.classList.toggle("is-active", mode === "pan");
    selectModeButton.setAttribute("aria-pressed", String(mode === "select"));
    panModeButton.setAttribute("aria-pressed", String(mode === "pan"));
    emitViewState();
  };
  const focusTraceStep = (index) => {
    const step = traceJourney[index];
    const node = step ? byId.get(step.nodeKey) : null;
    if (!node) return;
    const next = selectGraphNode(currentViewState(), node.key);
    selectedKey = next.selectedKey;
    followedKey = node.key;
    previewKey = null;
    applyGraphEmphasis();
    focusCameraOn(node);
    emitViewState();
    if (typeof onSelect === "function") onSelect(node);
  };
  followButton = createToolButton("Follow selected node", null, "Follow");
  followButton.setAttribute("aria-pressed", String(Boolean(followedKey)));
  followButton.addEventListener("click", () => {
    if (traceState.active && !followedKey) {
      focusTraceStep(0);
      return;
    }
    const next = toggleGraphFollow(currentViewState());
    if (next.followedKey === followedKey) return;
    followedKey = next.followedKey;
    applyGraphEmphasis();
    if (followedKey) focusCameraOn(byId.get(followedKey));
    else emitViewState();
  });
  selectModeButton.addEventListener("click", () => setInteractionMode("select"));
  panModeButton.addEventListener("click", () => setInteractionMode("pan"));
  toolbar.append(
    selectModeButton,
    panModeButton,
    followButton,
    createToolButton("Zoom out", () => zoomBy(1 / 1.18), "-"),
    cameraReadout,
    createToolButton("Zoom in", () => zoomBy(1.18), "+"),
    createToolButton("Fit graph", resetCamera, "Fit"),
  );
  let replayControlState = null;
  if (replayActive) {
    toolbar.classList.add("has-replay-controls");
    const replayControls = document.createElement("div");
    replayControls.className = "cognitive-replay-controls";
    replayControls.setAttribute("role", "group");
    replayControls.setAttribute("aria-label", "Cognitive Replay controls");
    const replayAction = (action) => () => {
      if (typeof onReplayAction === "function") onReplayAction(action);
    };
    const restartButton = createToolButton("Restart replay", replayAction("restart"), "Restart");
    const previousButton = createToolButton("Previous replay step", replayAction("previous"), "Previous");
    const playButton = createToolButton("Play replay", replayAction("play"), "Reconstruct");
    const pauseButton = createToolButton("Pause replay", replayAction("pause"), "Pause");
    const nextButton = createToolButton("Next replay step", replayAction("next"), "Next");
    restartButton.disabled = replayView.status === "ready";
    previousButton.disabled = replayView.cursor < 0;
    playButton.disabled = replayView.status === "playing" || replayView.status === "completed";
    pauseButton.disabled = replayView.status !== "playing";
    playButton.hidden = replayView.status === "playing";
    pauseButton.hidden = replayView.status !== "playing";
    nextButton.disabled = replayView.status === "completed";
    const replayPosition = document.createElement("output");
    replayPosition.className = "cognitive-replay-position";
    replayPosition.setAttribute("aria-live", "polite");
    replayPosition.value = replayView.status === "completed"
      ? "Reconstruction complete"
      : replayView.cursor < 0 ? `Ready · ${replayView.total} steps` : `${String(replayView.cursor + 1).padStart(2, "0")} / ${replayView.total}`;
    replayControls.append(restartButton, previousButton, playButton, pauseButton, nextButton, replayPosition);
    replayControlState = { restartButton, previousButton, playButton, pauseButton, nextButton, replayPosition };
    toolbar.prepend(replayControls);
  } else if (traceState.active) {
    toolbar.classList.add("has-trace-journey");
    const journeyGroup = document.createElement("div");
    journeyGroup.className = "trace-journey-controls";
    journeyGroup.setAttribute("role", "group");
    journeyGroup.setAttribute("aria-label", "Move through the active cognitive trace");
    const previousButton = createToolButton("Previous trace step", null, "Previous");
    previousButton.dataset.traceJourneyAction = "previous";
    previousButton.addEventListener("click", () => {
      const currentIndex = traceJourneyIndex.get(followedKey);
      if (Number.isInteger(currentIndex)) focusTraceStep(currentIndex - 1);
    });
    const position = document.createElement("output");
    position.className = "trace-journey-position";
    position.setAttribute("aria-live", "polite");
    const nextButton = createToolButton("Next trace step", null, "Next");
    nextButton.dataset.traceJourneyAction = "next";
    nextButton.addEventListener("click", () => {
      const currentIndex = traceJourneyIndex.get(followedKey);
      if (Number.isInteger(currentIndex)) focusTraceStep(currentIndex + 1);
    });
    journeyGroup.append(previousButton, position, nextButton);
    toolbar.prepend(journeyGroup);
  }
  shell.append(toolbar);
  applyCamera(false);
  if (followedKey) focusCameraOn(byId.get(followedKey));
  applyGraphEmphasis();

  svg.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });
  svg.addEventListener("pointerdown", (event) => {
    if (interactionMode !== "pan" || event.button !== 0) return;
    if (followedKey) {
      followedKey = endGraphFollow(currentViewState()).followedKey;
      applyGraphEmphasis();
      emitViewState();
    }
    dragging = true;
    dragOrigin = { x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y };
    svg.setPointerCapture(event.pointerId);
    shell.classList.add("is-dragging");
    event.preventDefault();
  });
  svg.addEventListener("pointermove", (event) => {
    if (!dragging || !dragOrigin) return;
    const bounds = svg.getBoundingClientRect();
    camera.x = dragOrigin.cameraX + ((event.clientX - dragOrigin.x) * (viewBox.width / bounds.width));
    camera.y = dragOrigin.cameraY + ((event.clientY - dragOrigin.y) * (viewBox.height / bounds.height));
    applyCamera();
  });
  const finishDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    dragOrigin = null;
    shell.classList.remove("is-dragging");
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
  };
  svg.addEventListener("pointerup", finishDrag);
  svg.addEventListener("pointercancel", finishDrag);
  svg.addEventListener("keydown", (event) => {
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomBy(1.18); }
    if (event.key === "-") { event.preventDefault(); zoomBy(1 / 1.18); }
    if (event.key === "0") { event.preventDefault(); resetCamera(); }
    if (event.key === "Escape") {
      selectedKey = null;
      previewKey = null;
      applyGraphEmphasis();
      emitViewState();
      container.dispatchEvent(new CustomEvent("graphselectionclear"));
    }
    const cameraKeys = { ArrowLeft: [24, 0], ArrowRight: [-24, 0], ArrowUp: [0, 24], ArrowDown: [0, -24] };
    if (interactionMode === "pan" && cameraKeys[event.key]) {
      event.preventDefault();
      if (followedKey) {
        followedKey = endGraphFollow(currentViewState()).followedKey;
        applyGraphEmphasis();
      }
      camera.x += cameraKeys[event.key][0];
      camera.y += cameraKeys[event.key][1];
      applyCamera();
    }
  });
  container.addEventListener("cleargraphselection", () => {
    selectedKey = null;
    previewKey = null;
    applyGraphEmphasis();
    emitViewState();
  });

  const legend = document.createElement("ul");
  legend.className = "graph-legend topology-legend";
  legend.setAttribute("aria-label", "Graph layer filters");
  layerDefinitions.forEach(([kind, label]) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "graph-layer-filter";
    button.setAttribute("aria-pressed", String(kind === filteredKind || (kind === null && filteredKind === null)));
    const swatch = document.createElement("span");
    swatch.className = `legend-swatch graph-kind-${kind ?? "all"}`;
    if (kind) swatch.style.background = palettes[kind]?.[0] ?? palettes.workspace[0];
    const text = document.createElement("span");
    text.textContent = label;
    button.append(swatch, text);
    button.addEventListener("click", () => {
      filteredKind = kind;
      legend.querySelectorAll("button").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
      applyGraphEmphasis();
      emitViewState();
    });
    item.append(button);
    legend.append(item);
  });
  shell.append(legend);

  if (traceState.active) {
    const traceList = document.createElement("details");
    traceList.className = "cognitive-trace-accessible-list";
    const traceSummary = document.createElement("summary");
    traceSummary.textContent = `Active cognitive trace (${trace.branches.length} branches)`;
    const orderedTrace = document.createElement("ol");
    traceState.orderedSteps.forEach((step) => {
      const node = byId.get(step.nodeKey);
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.listNode = step.nodeKey;
      button.textContent = `Branch ${step.branch}, step ${step.step}: ${step.role} - ${node.label}`;
      item.append(button);
      orderedTrace.append(item);
    });
    traceList.append(traceSummary, orderedTrace);
    traceList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-list-node]");
      if (!button) return;
      const node = positioned.find(({ key }) => key === button.dataset.listNode);
      if (!node) return;
      const next = selectGraphNode(currentViewState(), node.key);
      selectedKey = next.selectedKey;
      followedKey = next.followedKey;
      previewKey = null;
      applyGraphEmphasis();
      if (followedKey) focusCameraOn(node);
      emitViewState();
      if (typeof onSelect === "function") onSelect(node);
    });
    shell.append(traceList);
  }

  const list = document.createElement("details");
  list.className = "graph-accessible-list";
  const summary = document.createElement("summary");
  summary.textContent = "Accessible graph inventory";
  const inventory = document.createElement("ol");
  positioned.forEach((node) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.listNode = node.key;
    button.textContent = `${node.family ?? node.kind}: ${node.label}`;
    item.append(button);
    inventory.append(item);
  });
  list.append(summary, inventory);
  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-list-node]");
    if (!button) return;
    const node = positioned.find(({ key }) => key === button.dataset.listNode);
    if (!node) return;
    const next = selectGraphNode(currentViewState(), node.key);
    selectedKey = next.selectedKey;
    followedKey = next.followedKey;
    previewKey = null;
    applyGraphEmphasis();
    if (followedKey) focusCameraOn(node);
    emitViewState();
    if (typeof onSelect === "function") onSelect(node);
  });
  shell.append(list);

  applyGraphEmphasis();
  container.replaceChildren(shell);
  if (viewStateWasReconciled) emitViewState();

  const updateReplayView = (nextReplayView) => {
    if (!replayActive || !nextReplayView?.active || nextReplayView.identifier !== currentReplayView.identifier) return false;
    currentReplayView = nextReplayView;
    replayCompletedNodes.clear();
    replayCompletedEdges.clear();
    replayFutureNodes.clear();
    replayFutureEdges.clear();
    nextReplayView.completedNodeKeys.forEach((key) => replayCompletedNodes.add(key));
    nextReplayView.completedEdgeKeys.forEach((key) => replayCompletedEdges.add(key));
    nextReplayView.futureNodeKeys.forEach((key) => replayFutureNodes.add(key));
    nextReplayView.futureEdgeKeys.forEach((key) => replayFutureEdges.add(key));
    shell.dataset.replayStatus = nextReplayView.status;
    shell.dataset.replayCursor = String(nextReplayView.cursor);
    nodeGroup.querySelectorAll(".graph-node").forEach((nodeElement) => {
      const key = nodeElement.dataset.observationKey;
      nodeElement.classList.toggle("is-replay-completed", replayCompletedNodes.has(key));
      nodeElement.classList.toggle("is-replay-current", nextReplayView.currentNodeKey === key);
      nodeElement.classList.toggle("is-replay-future", replayFutureNodes.has(key));
    });
    edgeRecords.forEach(({ edge, base, flow }) => {
      [base, flow].filter(Boolean).forEach((edgeElement) => {
        edgeElement.classList.toggle("is-replay-completed", replayCompletedEdges.has(edge.key));
        edgeElement.classList.toggle("is-replay-current", nextReplayView.currentEdgeKey === edge.key);
        edgeElement.classList.toggle("is-replay-future", replayFutureEdges.has(edge.key));
      });
    });
    traceRoutes.querySelectorAll(".cognitive-trace-route").forEach((route) => {
      const edgeKey = route.dataset.edgeKey;
      route.classList.toggle("is-replay-completed", replayCompletedEdges.has(edgeKey));
      route.classList.toggle("is-replay-current", nextReplayView.currentEdgeKey === edgeKey);
      route.classList.toggle("is-replay-future", replayFutureEdges.has(edgeKey));
    });
    if (replayControlState) {
      const { restartButton, previousButton, playButton, pauseButton, nextButton, replayPosition } = replayControlState;
      restartButton.disabled = nextReplayView.status === "ready";
      previousButton.disabled = nextReplayView.cursor < 0;
      playButton.disabled = nextReplayView.status === "playing" || nextReplayView.status === "completed";
      pauseButton.disabled = nextReplayView.status !== "playing";
      playButton.hidden = nextReplayView.status === "playing";
      pauseButton.hidden = nextReplayView.status !== "playing";
      nextButton.disabled = nextReplayView.status === "completed";
      replayPosition.value = nextReplayView.status === "completed"
        ? "Reconstruction complete"
        : nextReplayView.cursor < 0
          ? `Ready · ${nextReplayView.total} steps`
          : `${String(nextReplayView.cursor + 1).padStart(2, "0")} / ${nextReplayView.total}`;
    }
    applyGraphEmphasis();
    return true;
  };

  return Object.freeze({ updateReplayView });
}
