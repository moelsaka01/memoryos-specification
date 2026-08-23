import { semanticWorldLayout, stableWorldHash as stableHash } from "./semantic-world.js";
import {
  createGraphViewState,
  endGraphFollow,
  reconcileGraphViewState,
  selectGraphNode,
  toggleGraphFollow,
  toggleGraphRegionIsolation,
} from "./graph-view-state.js";

const viewBox = semanticWorldLayout.viewBox;
const rendererViewBox = Object.freeze({
  x: -72,
  y: -42,
  width: viewBox.width + 144,
  height: viewBox.height + 84,
  centerX: viewBox.centerX,
  centerY: viewBox.centerY,
});

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

export function prepareEvolutionRenderingState(world, evolutionView = null) {
  const inactive = Object.freeze({
    active: false,
    identifier: null,
    addedNodeKeys: Object.freeze([]),
    removedNodeKeys: Object.freeze([]),
    evolvedNodeKeys: Object.freeze([]),
    addedRelationshipKeys: Object.freeze([]),
    removedRelationshipKeys: Object.freeze([]),
    modifiedRelationshipKeys: Object.freeze([]),
  });
  if (evolutionView === null || evolutionView === undefined) return inactive;
  if (!world || evolutionView.kind !== "MemoryOSCognitiveEvolutionView" || evolutionView.version !== "1.1") {
    throw new TypeError("A MemoryOS 1.1 Cognitive Evolution view is required.");
  }
  if (world.kind !== "MemoryOSCognitiveEvolutionWorld" || world.frame?.identifier !== evolutionView.identifier) {
    throw new TypeError("The Cognitive Evolution view is not bound to the rendered semantic world.");
  }
  const nodeKeys = new Set(world.nodes.map(({ key }) => key));
  const relationshipKeys = new Set(world.edges.map(({ key }) => key));
  const requireKeys = (keys, available, label) => {
    if (!Array.isArray(keys)) throw new TypeError(`Cognitive Evolution ${label} must be an array.`);
    keys.forEach((key) => {
      if (!available.has(key)) throw new TypeError(`Cognitive Evolution ${label} '${key}' is absent from the rendered world.`);
    });
    return Object.freeze([...keys]);
  };
  return Object.freeze({
    active: true,
    identifier: evolutionView.identifier,
    addedNodeKeys: requireKeys(evolutionView.addedNodeKeys, nodeKeys, "added node"),
    removedNodeKeys: requireKeys(evolutionView.removedNodeKeys, nodeKeys, "removed node"),
    evolvedNodeKeys: requireKeys(evolutionView.evolvedNodeKeys, nodeKeys, "evolved node"),
    addedRelationshipKeys: requireKeys(evolutionView.addedRelationshipKeys, relationshipKeys, "added relationship"),
    removedRelationshipKeys: requireKeys(evolutionView.removedRelationshipKeys, relationshipKeys, "removed relationship"),
    modifiedRelationshipKeys: requireKeys(evolutionView.modifiedRelationshipKeys, relationshipKeys, "modified relationship"),
  });
}

export function prepareComparativeRenderingState(world, comparativeView = null) {
  const inactive = Object.freeze({
    active: false,
    identifier: null,
    status: null,
    nodeRecords: Object.freeze([]),
    relationshipRecords: Object.freeze([]),
  });
  if (comparativeView === null || comparativeView === undefined) return inactive;
  if (!world || comparativeView.kind !== "MemoryOSComparativeReconstructionView"
    || comparativeView.version !== "1.1") {
    throw new TypeError("A MemoryOS 1.1 Comparative Reconstruction view is required.");
  }
  if (world.kind !== "MemoryOSCognitiveEvolutionWorld"
    || world.frame?.identifier !== comparativeView.worldIdentifier) {
    throw new TypeError("The Comparative Reconstruction view is not bound to the rendered one-world projection.");
  }
  const nodeKeys = new Set(world.nodes.map(({ key }) => key));
  const relationshipKeys = new Set(world.edges.map(({ key }) => key));
  const semanticStates = new Set(["shared", "a-only", "b-only", "modified", "split"]);
  const phases = new Set(["completed", "current", "future", "split"]);
  const sides = new Set(["a", "b"]);
  const requireRecords = (records, available, label) => {
    if (!Array.isArray(records)) throw new TypeError(`Comparative ${label} records must be an array.`);
    return Object.freeze(records.map((record) => {
      if (!record || !available.has(record.key) || !semanticStates.has(record.semanticState)
        || !phases.has(record.phase) || !Array.isArray(record.sides)
        || record.sides.some((side) => !sides.has(side))
        || !Array.isArray(record.occurrences) || !Array.isArray(record.sideRecords)) {
        throw new TypeError(`Comparative ${label} record is not an exact member of the one-world projection.`);
      }
      const requireOccurrence = (occurrence) => {
        if (!occurrence || !sides.has(occurrence.side)
          || !semanticStates.has(occurrence.semanticState) || !phases.has(occurrence.phase)
          || !Number.isSafeInteger(occurrence.momentIndex)) {
          throw new TypeError(`Comparative ${label} occurrence is invalid.`);
        }
        return Object.freeze({ ...occurrence });
      };
      const occurrences = Object.freeze(record.occurrences.map(requireOccurrence));
      const sideRecords = Object.freeze(record.sideRecords.map((sideRecord) => {
        if (!sideRecord || !sides.has(sideRecord.side)
          || !semanticStates.has(sideRecord.semanticState) || !phases.has(sideRecord.phase)
          || !Array.isArray(sideRecord.occurrences)) {
          throw new TypeError(`Comparative ${label} side record is invalid.`);
        }
        return Object.freeze({
          ...sideRecord,
          occurrences: Object.freeze(sideRecord.occurrences.map(requireOccurrence)),
        });
      }));
      return Object.freeze({ ...record, occurrences, sideRecords });
    }));
  };
  return Object.freeze({
    active: true,
    identifier: comparativeView.identifier,
    status: comparativeView.status,
    pauseReason: comparativeView.pauseReason,
    cursor: comparativeView.cursor,
    total: comparativeView.total,
    atDivergence: comparativeView.atDivergence,
    currentMoment: comparativeView.currentMoment,
    moments: Object.freeze([...(comparativeView.moments ?? [])]),
    nodeRecords: requireRecords(comparativeView.nodeRecords, nodeKeys, "node"),
    relationshipRecords: requireRecords(comparativeView.relationshipRecords, relationshipKeys, "relationship"),
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
    evolutionView = null,
    evolutionControl = null,
    comparativeView = null,
    onReplayAction = null,
    onEvolutionAction = null,
    onComparativeAction = null,
    onViewStateChange = null,
  } = {},
) {
  const activePerspective = normalizePerspective(perspective);
  const identity = world.identity ?? "Memory intelligence graph";
  const graphDescription = world.description ?? "One interactive topology of MemoryOS cognitive state.";
  const positioned = world.nodes;
  const byId = new Map(positioned.map((node) => [node.key, node]));
  const edgeByKey = new Map(world.edges.map((edge) => [edge.key, edge]));
  const denseWorld = positioned.length >= 500;
  const incomingViewState = createGraphViewState(viewState);
  const reconciledViewState = reconcileGraphViewState(world, incomingViewState);
  const viewStateWasReconciled = incomingViewState.selectedKey !== reconciledViewState.selectedKey
    || incomingViewState.followedKey !== reconciledViewState.followedKey;
  const activeNodeKeys = new Set(activity.nodeKeys ?? []);
  const activeEdgeKeys = new Set(activity.edgeKeys ?? []);
  const traceState = prepareTraceRenderingState(world, trace);
  const evolutionState = prepareEvolutionRenderingState(world, evolutionView);
  const comparativeState = prepareComparativeRenderingState(world, comparativeView);
  if ([traceState.active, evolutionState.active, comparativeState.active].filter(Boolean).length > 1) {
    throw new TypeError("Trace, Cognitive Evolution, and Comparative Reconstruction are exclusive renderer modes.");
  }
  const traceNodeKeys = new Set(traceState.nodeKeys);
  const traceEdgeKeys = new Set(traceState.edgeKeys);
  const traceNodeRecords = new Map(traceState.nodeRecords.map((record) => [record.nodeKey, record]));
  const traceEdgeRecords = new Map(traceState.orderedSteps
    .filter((step) => step.edgeKey)
    .map((step) => [step.edgeKey, step]));
  const traceJourney = prepareTraceJourney(traceState);
  const traceJourneyIndex = new Map(traceJourney.map((step) => [step.nodeKey, step.journeyIndex]));
  const traceRegionKinds = new Set(traceJourney.map((step) => byId.get(step.nodeKey)?.kind).filter(Boolean));
  const replayActive = Boolean(traceState.active && replayView?.active);
  let currentReplayView = replayView;
  const replayCompletedNodes = new Set(replayView?.completedNodeKeys ?? []);
  const replayCompletedEdges = new Set(replayView?.completedEdgeKeys ?? []);
  const replayFutureNodes = new Set(replayView?.futureNodeKeys ?? []);
  const replayFutureEdges = new Set(replayView?.futureEdgeKeys ?? []);
  const evolutionAddedNodes = new Set(evolutionState.addedNodeKeys);
  const evolutionRemovedNodes = new Set(evolutionState.removedNodeKeys);
  const evolutionEvolvedNodes = new Set(evolutionState.evolvedNodeKeys);
  const evolutionAddedRelationships = new Set(evolutionState.addedRelationshipKeys);
  const evolutionRemovedRelationships = new Set(evolutionState.removedRelationshipKeys);
  const evolutionModifiedRelationships = new Set(evolutionState.modifiedRelationshipKeys);
  const evolutionRegionKinds = new Set([
    ...evolutionState.addedNodeKeys,
    ...evolutionState.removedNodeKeys,
    ...evolutionState.evolvedNodeKeys,
  ].map((key) => byId.get(key)?.kind).filter(Boolean));
  let currentComparativeView = comparativeView;
  const comparativeNodeRecords = new Map(comparativeState.nodeRecords.map((record) => [record.key, record]));
  const comparativeRelationshipRecords = new Map(comparativeState.relationshipRecords.map((record) => [record.key, record]));
  const comparativeRegionKinds = new Set(comparativeState.nodeRecords
    .map(({ key }) => byId.get(key)?.kind)
    .filter(Boolean));
  const relationshipEndpoints = (keys) => keys.flatMap((key) => {
    const relationship = edgeByKey.get(key);
    return relationship ? [relationship.from, relationship.to] : [];
  });
  const investigationNodeKeys = Object.freeze([...new Set(
    traceState.active
      ? traceState.nodeKeys
      : evolutionState.active
        ? [
          ...evolutionState.addedNodeKeys,
          ...evolutionState.removedNodeKeys,
          ...evolutionState.evolvedNodeKeys,
          ...relationshipEndpoints([
            ...evolutionState.addedRelationshipKeys,
            ...evolutionState.removedRelationshipKeys,
            ...evolutionState.modifiedRelationshipKeys,
          ]),
        ]
        : comparativeState.active
          ? [
            ...comparativeState.nodeRecords.map(({ key }) => key),
            ...relationshipEndpoints(comparativeState.relationshipRecords.map(({ key }) => key)),
          ]
          : [],
  )].filter((key) => byId.has(key)));
  const comparativeClasses = [
    "is-comparative-step",
    "is-comparative-shared",
    "is-comparative-a-only",
    "is-comparative-b-only",
    "is-comparative-modified",
    "is-comparative-split",
    "is-comparative-completed",
    "is-comparative-current",
    "is-comparative-future",
    "is-comparative-side-a",
    "is-comparative-side-b",
    "is-comparative-side-both",
  ];
  const applyComparativeRecord = (element, record) => {
    if (!element) return;
    comparativeClasses.forEach((className) => element.classList.remove(className));
    if (!record) return;
    element.classList.add(
      "is-comparative-step",
      `is-comparative-${record.semanticState}`,
      `is-comparative-${record.phase}`,
      `is-comparative-side-${record.sides.length === 2 ? "both" : record.sides[0]}`,
    );
  };
  const comparativeStateLabels = Object.freeze({
    shared: "Shared cognition",
    "a-only": "Observation A only",
    "b-only": "Observation B only",
    modified: "Modified cognition",
    split: "Divergent trace order",
  });
  const comparativeSideRecord = (record, side) => (
    record?.sideRecords.find((sideRecord) => sideRecord.side === side) ?? null
  );
  const updateComparativeMarker = (marker, record) => {
    if (!marker) return;
    const semanticState = record?.semanticState ?? "shared";
    const visible = semanticState !== "shared";
    marker.setAttribute("display", visible ? "inline" : "none");
    marker.setAttribute("class", `comparative-reconstruction-marker marker-${semanticState}`);
    const shape = semanticState === "a-only" ? "a"
      : semanticState === "b-only" ? "b" : "both";
    marker.querySelectorAll("[data-comparative-marker-shape]").forEach((element) => {
      element.setAttribute("display", element.dataset.comparativeMarkerShape === shape ? "inline" : "none");
    });
    const label = marker.querySelector("text");
    if (label) label.textContent = semanticState === "a-only" ? "A" : semanticState === "b-only" ? "B" : "A|B";
  };
  const applyComparativeNodeRecord = (element, record) => {
    applyComparativeRecord(element, record);
    const node = byId.get(element?.dataset.observationKey);
    if (!element || !node || !record) return;
    element.dataset.comparativeState = record.semanticState;
    element.dataset.comparativePhase = record.phase;
    element.setAttribute(
      "aria-label",
      `${comparativeStateLabels[record.semanticState]}; ${record.phase} comparative step; ${node.family ?? node.kind}: ${node.label}`,
    );
    updateComparativeMarker(element.querySelector(".comparative-reconstruction-marker"), record);
  };
  const shell = document.createElement("div");
  shell.className = "knowledge-graph topology-interface memory-intelligence-graph";
  shell.dataset.perspective = activePerspective;
  shell.dataset.graphIdentity = "memory-intelligence-graph";
  shell.dataset.layout = world.layout?.identifier ?? "unidentified-layout";
  shell.dataset.frame = world.frame?.identifier ?? "unidentified-frame";
  shell.dataset.traceMode = traceState.active ? "active" : "inactive";
  shell.classList.toggle("is-dense-world", denseWorld);
  if (traceState.active) {
    shell.dataset.traceIdentifier = traceState.identifier;
    shell.classList.add("has-active-trace");
  }
  if (replayActive) {
    shell.dataset.replayStatus = replayView.status;
    shell.dataset.replayCursor = String(replayView.cursor);
    shell.classList.add("has-cognitive-replay");
  }
  if (evolutionState.active) {
    shell.dataset.evolutionIdentifier = evolutionState.identifier;
    shell.classList.add("has-cognitive-evolution");
  }
  if (comparativeState.active) {
    shell.dataset.comparativeIdentifier = comparativeState.identifier;
    shell.dataset.comparativeStatus = comparativeState.status;
    shell.dataset.comparativeCursor = String(comparativeState.cursor);
    shell.dataset.comparativeDivergence = String(Boolean(comparativeState.atDivergence));
    shell.classList.add("has-comparative-reconstruction");
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
  const regionElements = new Map();
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
  const synchronizeIsolationControls = () => {
    shell.classList.toggle("has-region-isolation", Boolean(filteredKind));
    if (filteredKind) shell.dataset.isolatedRegion = filteredKind;
    else delete shell.dataset.isolatedRegion;
    regionElements.forEach((region, kind) => {
      const isolated = filteredKind === kind;
      region.classList.toggle("is-region-isolated", isolated);
      region.classList.toggle("is-isolated", isolated);
      region.classList.toggle("is-region-dimmed", Boolean(filteredKind) && !isolated);
      region.setAttribute("aria-pressed", String(isolated));
      region.style.opacity = filteredKind ? (isolated ? ".78" : ".07") : "";
    });
    shell.querySelectorAll(".graph-layer-filter").forEach((button) => {
      const kind = button.dataset.regionKind || null;
      const active = kind === filteredKind;
      button.setAttribute("aria-pressed", String(active));
      if (kind === null) {
        setControlDisabled(button, filteredKind === null, "All cognitive regions are already visible.");
      } else {
        button.title = active
          ? `Show all cognitive regions; ${button.dataset.regionLabel} is currently isolated.`
          : `Isolate ${button.dataset.regionLabel} cognitive region`;
      }
    });
  };
  const toggleRegionIsolation = (kind) => {
    const next = toggleGraphRegionIsolation(currentViewState(), kind);
    filteredKind = next.filteredKind;
    synchronizeIsolationControls();
    applyGraphEmphasis();
    emitViewState();
  };

  const svg = svgElement("svg", {
    class: "graph-surface topology-surface",
    viewBox: `${rendererViewBox.x} ${rendererViewBox.y} ${rendererViewBox.width} ${rendererViewBox.height}`,
    role: "group",
    tabindex: "0",
    "aria-labelledby": "graph-title graph-description",
  });
  const title = svgElement("title", { id: "graph-title" });
  title.textContent = identity;
  const description = svgElement("desc", { id: "graph-description" });
  description.textContent = comparativeState.active
    ? `${graphDescription} Comparative Reconstruction is active in one semantic world with two synchronized deterministic traces.`
    : traceState.active
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
  const regions = svgElement("g", {
    class: "cognitive-regions",
    role: "group",
    "aria-label": "Cognitive region isolation controls",
    style: "pointer-events: visiblePainted;",
  });
  cognitiveRegionDefinitions.forEach((definition) => {
    const region = svgElement("g", {
      class: `cognitive-region region-${definition.kind}${traceRegionKinds.has(definition.kind) ? " is-trace-region" : ""}${evolutionRegionKinds.has(definition.kind) ? " is-evolution-region" : ""}${comparativeRegionKinds.has(definition.kind) ? " is-comparative-region" : ""}`,
      role: "button",
      tabindex: interactionMode === "select" ? "0" : "-1",
      "aria-label": `Isolate ${definition.label} cognitive region`,
      "aria-disabled": interactionMode === "pan" ? "true" : "false",
      "aria-description": interactionMode === "pan" ? "Region isolation is disabled while Pan mode is active." : "Toggle this cognitive region isolation.",
      "aria-pressed": String(filteredKind === definition.kind),
      "data-region-kind": definition.kind,
      "data-region-signature": definition.signature,
      style: `pointer-events: visiblePainted; cursor: ${interactionMode === "pan" ? "grab" : "pointer"};`,
    });
    const regionTitle = svgElement("title");
    regionTitle.textContent = `${definition.label} cognitive region. Activate to isolate this region.`;
    region.append(regionTitle);
    region.append(svgElement("rect", {
      class: "cognitive-region-hit-target",
      x: definition.x - (definition.width / 2),
      y: definition.y - (definition.height / 2),
      width: definition.width,
      height: definition.height,
      fill: "transparent",
      "pointer-events": "all",
    }));
    region.append(svgElement("path", { class: "cognitive-region-boundary", d: regionOutline(definition) }));
    appendRegionMotif(region, definition);
    const label = svgElement("text", {
      class: "cognitive-region-label",
      x: definition.x - (definition.width / 2) + 8,
      y: definition.y - (definition.height / 2) - 7,
    });
    label.textContent = definition.label;
    region.append(label);
    region.addEventListener("pointerdown", (event) => {
      if (interactionMode !== "pan") event.stopPropagation();
    });
    region.addEventListener("click", (event) => {
      if (interactionMode === "pan") return;
      event.stopPropagation();
      toggleRegionIsolation(definition.kind);
    });
    region.addEventListener("keydown", (event) => {
      if (interactionMode === "pan") return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      toggleRegionIsolation(definition.kind);
    });
    regionElements.set(definition.kind, region);
    regions.append(region);
  });
  scene.append(regions);
  const edges = svgElement("g", { class: "graph-edges topology-edges", "aria-hidden": "true" });
  const traceRoutes = svgElement("g", { class: "cognitive-trace-routes", "aria-hidden": "true" });
  const comparativeRoutes = svgElement("g", { class: "comparative-reconstruction-routes", "aria-hidden": "true" });
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
    if (evolutionState.active) {
      base.classList.toggle("is-evolution-added", evolutionAddedRelationships.has(edge.key));
      base.classList.toggle("is-evolution-removed", evolutionRemovedRelationships.has(edge.key));
      base.classList.toggle("is-evolution-modified", evolutionModifiedRelationships.has(edge.key));
      base.classList.toggle("is-evolution-stable", !evolutionAddedRelationships.has(edge.key)
        && !evolutionRemovedRelationships.has(edge.key) && !evolutionModifiedRelationships.has(edge.key));
    }
    if (traceState.active) {
      base.classList.add(traceEdgeKeys.has(edge.key) ? "is-trace-relationship" : "is-trace-dimmed");
      const traceStep = traceEdgeRecords.get(edge.key);
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
    applyComparativeRecord(base, comparativeRelationshipRecords.get(edge.key));
    const relationshipEvolution = evolutionAddedRelationships.has(edge.key) ? "Added relationship: "
      : evolutionRemovedRelationships.has(edge.key) ? "Removed relationship: "
        : evolutionModifiedRelationships.has(edge.key) ? "Modified relationship: " : "";
    if (!denseWorld || traceEdgeKeys.has(edge.key) || comparativeRelationshipRecords.has(edge.key)
      || relationshipEvolution.length > 0) {
      const edgeTitle = svgElement("title");
      edgeTitle.textContent = `${relationshipEvolution}${from.label} ${edge.relation} ${to.label}`;
      base.append(edgeTitle);
    }
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
      if (evolutionState.active) {
        flow.classList.toggle("is-evolution-added", evolutionAddedRelationships.has(edge.key));
        flow.classList.toggle("is-evolution-removed", evolutionRemovedRelationships.has(edge.key));
        flow.classList.toggle("is-evolution-modified", evolutionModifiedRelationships.has(edge.key));
        flow.classList.toggle("is-evolution-stable", !evolutionAddedRelationships.has(edge.key)
          && !evolutionRemovedRelationships.has(edge.key) && !evolutionModifiedRelationships.has(edge.key));
      }
      if (traceState.active) {
        flow.classList.add(traceEdgeKeys.has(edge.key) ? "is-trace-relationship" : "is-trace-dimmed");
        const traceStep = traceEdgeRecords.get(edge.key);
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
      applyComparativeRecord(flow, comparativeRelationshipRecords.get(edge.key));
      edges.append(flow);
    }
    const comparativeRecord = comparativeRelationshipRecords.get(edge.key);
    const comparativeEdgeRoutes = [];
    if (comparativeRecord) {
      const sharedOnly = comparativeRecord.occurrences.every(({ semanticState }) => semanticState === "shared");
      if (sharedOnly) {
        const sharedRoute = svgElement("path", {
          class: "comparative-reconstruction-route route-shared",
          d: geometry.forward,
          fill: "none",
          "data-edge-key": edge.key,
          "data-comparative-side": "both",
        });
        applyComparativeRecord(sharedRoute, comparativeRecord);
        comparativeRoutes.append(sharedRoute);
        comparativeEdgeRoutes.push(sharedRoute);
      } else {
        comparativeRecord.sideRecords.forEach(({ side }) => {
          const sideRoute = svgElement("path", {
            class: `comparative-reconstruction-route route-side-${side}`,
            d: geometry.forward,
            fill: "none",
            "data-edge-key": edge.key,
            "data-comparative-side": side,
          });
          applyComparativeRecord(sideRoute, comparativeSideRecord(comparativeRecord, side));
          comparativeRoutes.append(sideRoute);
          comparativeEdgeRoutes.push(sideRoute);
        });
      }
    }
    // Synapses are non-semantic texture. Omitting them on dense worlds bounds
    // DOM growth without removing a node, relationship, flow, or interaction.
    const synapseCount = denseWorld ? 0 : flowKind ? 3 : 2;
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
    edgeRecords.push({ edge, from, to, base, flow, flowKind, comparativeEdgeRoutes });
  });
  if (replayActive) {
    traceRoutes.querySelectorAll(".cognitive-trace-route").forEach((route) => {
      const edgeKey = route.dataset.edgeKey;
      route.classList.toggle("is-replay-completed", replayCompletedEdges.has(edgeKey));
      route.classList.toggle("is-replay-current", replayView.currentEdgeKey === edgeKey);
      route.classList.toggle("is-replay-future", replayFutureEdges.has(edgeKey));
    });
  }
  scene.append(edges, traceRoutes, comparativeRoutes);

  const microstructure = svgElement("g", { class: "topology-microstructure", "aria-hidden": "true" });
  positioned.forEach((node) => {
    const [color] = palettes[node.kind] ?? palettes.workspace;
    // Preserve aggregate geography while gracefully reducing decorative local
    // topology at scale. Runtime truth and selectable graph elements remain.
    const microCount = denseWorld ? (node.aggregate ? 5 : 0) : node.aggregate ? 11 : node.detail ? 1 : 4;
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
  const nodeElements = new Map();
  let rovingNodeKey = [
    selectedKey,
    replayActive ? currentReplayView?.currentNodeKey : null,
    comparativeState.active
      ? comparativeState.nodeRecords.find(({ phase }) => phase === "current")?.key
      : null,
    traceState.active ? traceState.targetNodeKey : null,
    positioned[0]?.key,
  ].find((key) => key && byId.has(key)) ?? null;
  const setRovingNode = (nodeKey, focus = false) => {
    const nextElement = nodeElements.get(nodeKey);
    if (!nextElement || interactionMode !== "select") return false;
    if (rovingNodeKey !== nodeKey) nodeElements.get(rovingNodeKey)?.setAttribute("tabindex", "-1");
    rovingNodeKey = nodeKey;
    nextElement.setAttribute("tabindex", "0");
    if (focus) nextElement.focus();
    return true;
  };
  const spatialNeighbor = (origin, direction) => {
    const vectors = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const vector = vectors[direction];
    if (!origin || !vector) return null;
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    positioned.forEach((candidate) => {
      if (candidate.key === origin.key) return;
      const dx = candidate.x - origin.x;
      const dy = candidate.y - origin.y;
      const primary = (dx * vector[0]) + (dy * vector[1]);
      if (primary <= 0) return;
      const secondary = Math.abs((dx * vector[1]) - (dy * vector[0]));
      const score = primary + (secondary * 3);
      if (score < bestScore || (score === bestScore && candidate.key < best.key)) {
        best = candidate;
        bestScore = score;
      }
    });
    return best;
  };
  let focusCameraOn = () => {};
  const relatedByKey = new Map();
  const edgeRecordsByNodeKey = new Map();
  const edgeRecordByKey = new Map();
  const edgeIndexByRecord = new Map();
  world.edges.forEach((edge) => {
    const from = relatedByKey.get(edge.from) ?? new Set([edge.from]);
    const to = relatedByKey.get(edge.to) ?? new Set([edge.to]);
    from.add(edge.to);
    to.add(edge.from);
    relatedByKey.set(edge.from, from);
    relatedByKey.set(edge.to, to);
  });
  edgeRecords.forEach((record, index) => {
    edgeRecordByKey.set(record.edge.key, record);
    edgeIndexByRecord.set(record, index);
    [record.edge.from, record.edge.to].forEach((key) => {
      const records = edgeRecordsByNodeKey.get(key) ?? [];
      records.push(record);
      edgeRecordsByNodeKey.set(key, records);
    });
  });
  const relatedKeysFor = (nodeKey) => relatedByKey.get(nodeKey) ?? new Set([nodeKey]);

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

  let emphasisInitialized = false;
  let previousFocusKey = null;
  let previousSelectedKey = null;
  let previousFollowedKey = null;
  let previousFilteredKind = null;
  const applyGraphEmphasis = () => {
    const focusKey = previewKey ?? selectedKey;
    const relatedKeys = focusKey ? relatedKeysFor(focusKey) : new Set();
    const hasPerspective = activePerspective !== "complete";
    const followedIndex = traceJourneyIndex.get(followedKey);
    const fullUpdate = !emphasisInitialized || previousFilteredKind !== filteredKind;
    svg.classList.toggle("has-active-trace", traceState.active);
    svg.classList.toggle("has-cognitive-evolution", evolutionState.active);
    svg.classList.toggle("has-comparative-reconstruction", comparativeState.active);
    // Descendant-wide focus selectors trigger a complete SVG style pass. Dense
    // worlds emphasize only the indexed related set instead.
    svg.classList.toggle("is-graph-focused", !denseWorld && Boolean(focusKey));
    svg.classList.toggle("has-perspective", hasPerspective);
    const updateNode = (nodeElement, includeInvariantState) => {
      const key = nodeElement.dataset.observationKey;
      const selected = key === selectedKey;
      const followed = key === followedKey;
      nodeElement.classList.toggle("is-selected", selected);
      nodeElement.classList.toggle("is-followed", followed);
      nodeElement.classList.toggle("is-graph-related", Boolean(focusKey) && relatedKeys.has(key));
      const journeyIndex = traceJourneyIndex.get(key);
      nodeElement.classList.toggle("is-journey-current", traceState.active && key === followedKey);
      nodeElement.classList.toggle("is-journey-complete", Number.isInteger(journeyIndex) && Number.isInteger(followedIndex) && journeyIndex < followedIndex);
      nodeElement.classList.toggle("is-journey-upcoming", Number.isInteger(journeyIndex) && Number.isInteger(followedIndex) && journeyIndex > followedIndex);
      nodeElement.setAttribute("aria-pressed", String(selected));
      if (!includeInvariantState) return;
      const inPerspective = !hasPerspective || perspectiveKeys.has(key);
      nodeElement.classList.toggle("is-perspective-primary", Boolean(perspectiveKind) && nodeElement.dataset.kind === perspectiveKind);
      nodeElement.classList.toggle("is-perspective-dimmed", !inPerspective);
      nodeElement.classList.toggle("is-filter-dimmed", Boolean(filteredKind) && nodeElement.dataset.kind !== filteredKind);
      nodeElement.classList.toggle("is-trace-step", traceState.active && traceNodeKeys.has(key));
      nodeElement.classList.toggle("is-trace-target", traceState.active && key === traceState.targetNodeKey);
      nodeElement.classList.toggle("is-trace-dimmed", traceState.active && !traceNodeKeys.has(key));
      nodeElement.classList.toggle("is-replay-completed", replayActive && replayCompletedNodes.has(key));
      nodeElement.classList.toggle("is-replay-current", replayActive && currentReplayView.currentNodeKey === key);
      nodeElement.classList.toggle("is-replay-future", replayActive && replayFutureNodes.has(key));
      nodeElement.classList.toggle("is-evolution-added", evolutionState.active && evolutionAddedNodes.has(key));
      nodeElement.classList.toggle("is-evolution-removed", evolutionState.active && evolutionRemovedNodes.has(key));
      nodeElement.classList.toggle("is-evolution-evolved", evolutionState.active && evolutionEvolvedNodes.has(key));
      nodeElement.classList.toggle("is-evolution-stable", evolutionState.active
        && !evolutionAddedNodes.has(key) && !evolutionRemovedNodes.has(key) && !evolutionEvolvedNodes.has(key));
      applyComparativeNodeRecord(nodeElement, comparativeNodeRecords.get(key));
    };
    const updateEdge = (record, index, includeInvariantState) => {
      const related = record.edge.from === focusKey || record.edge.to === focusKey;
      [record.base, record.flow].filter(Boolean).forEach((edgeElement) => {
        edgeElement.classList.toggle("is-graph-related", Boolean(focusKey) && related);
        if (includeInvariantState) {
          const filtered = Boolean(filteredKind)
            && record.from.kind !== filteredKind
            && record.to.kind !== filteredKind;
          edgeElement.classList.toggle("is-perspective-dimmed", hasPerspective && !perspectiveEdgeKeys.has(index));
          edgeElement.classList.toggle("is-filter-dimmed", filtered);
        }
      });
    };
    if (fullUpdate) {
      nodeElements.forEach((element) => updateNode(element, true));
      edgeRecords.forEach((record, index) => updateEdge(record, index, true));
    } else {
      const affectedNodeKeys = new Set([
        previousSelectedKey,
        selectedKey,
        previousFollowedKey,
        followedKey,
      ].filter(Boolean));
      [previousFocusKey, focusKey].filter(Boolean).forEach((key) => {
        relatedKeysFor(key).forEach((relatedKey) => affectedNodeKeys.add(relatedKey));
      });
      if (previousFollowedKey !== followedKey) traceNodeKeys.forEach((key) => affectedNodeKeys.add(key));
      affectedNodeKeys.forEach((key) => {
        const element = nodeElements.get(key);
        if (element) updateNode(element, false);
      });
      if (previousFocusKey !== focusKey) {
        const affectedEdges = new Set();
        [previousFocusKey, focusKey].filter(Boolean).forEach((key) => {
          (edgeRecordsByNodeKey.get(key) ?? []).forEach((record) => affectedEdges.add(record));
        });
        affectedEdges.forEach((record) => updateEdge(record, edgeIndexByRecord.get(record), false));
      }
    }
    emphasisInitialized = true;
    previousFocusKey = focusKey;
    previousSelectedKey = selectedKey;
    previousFollowedKey = followedKey;
    previousFilteredKind = filteredKind;
    if (followButton) {
      followButton.classList.toggle("is-active", Boolean(followedKey));
      followButton.setAttribute("aria-pressed", String(Boolean(followedKey)));
      const followDisabled = traceState.active ? traceJourney.length === 0 : !selectedKey && !followedKey;
      setControlDisabled(
        followButton,
        followDisabled,
        traceState.active ? "The active trace has no focusable steps." : "Select a node to enable Follow.",
      );
      followButton.textContent = traceState.active
        ? (followedKey ? "Following trace" : "Follow trace")
        : (followedKey ? "Following" : "Follow");
    }
    if (fitButton) synchronizeCameraControls();
    shell.querySelectorAll("[data-trace-journey-action]").forEach((button) => {
      const currentIndex = traceJourneyIndex.get(followedKey);
      if (button.dataset.traceJourneyAction === "previous") {
        setControlDisabled(
          button,
          !Number.isInteger(currentIndex) || currentIndex <= 0,
          Number.isInteger(currentIndex) ? "Already at the first trace step." : "Choose Follow trace to begin the journey.",
        );
      }
      if (button.dataset.traceJourneyAction === "next") {
        setControlDisabled(
          button,
          !Number.isInteger(currentIndex) || currentIndex >= traceJourney.length - 1,
          Number.isInteger(currentIndex) ? "Already at the final trace step." : "Choose Follow trace to begin the journey.",
        );
      }
    });
    const journeyOutput = shell.querySelector(".trace-journey-position");
    if (journeyOutput) {
      const currentIndex = traceJourneyIndex.get(followedKey);
      journeyOutput.value = Number.isInteger(currentIndex) ? `${currentIndex + 1} / ${traceJourney.length}` : `${traceJourney.length} steps`;
    }
  };

  const renderedTraceLabels = new Set();
  positioned.forEach((node) => {
    const [stroke, fill] = palettes[node.kind] ?? palettes.workspace;
    const group = svgElement("g", {
      class: `graph-node topology-node graph-node-${node.kind}${node.aggregate ? " is-aggregate" : ""}${node.detail ? " is-detail" : ""}`,
      tabindex: interactionMode === "select" && node.key === rovingNodeKey ? "0" : "-1",
      role: "button",
      "aria-label": `${node.family ?? node.kind}: ${node.label}`,
      "aria-disabled": interactionMode === "pan" ? "true" : "false",
      "aria-description": interactionMode === "pan" ? "Node selection is disabled while Pan mode is active." : "Select this observed cognitive element.",
      "aria-pressed": "false",
      "data-observation-key": node.key,
      "data-observation-path": node.observationPath ?? "",
      "data-kind": node.kind,
      "data-family": node.family ?? node.kind,
      transform: `translate(${node.x} ${node.y})`,
    });
    const traceRecord = traceNodeRecords.get(node.key);
    const traceLabelIdentity = traceRecord ? `${node.kind}:${node.label}` : null;
    const traceLabelDuplicate = traceLabelIdentity ? renderedTraceLabels.has(traceLabelIdentity) : false;
    if (traceLabelIdentity) renderedTraceLabels.add(traceLabelIdentity);
    if (traceLabelDuplicate) group.classList.add("is-trace-label-duplicate");
    const comparativeRecord = comparativeNodeRecords.get(node.key);
    const evolutionStatus = evolutionEvolvedNodes.has(node.key) ? "evolved"
      : evolutionAddedNodes.has(node.key) ? "added"
        : evolutionRemovedNodes.has(node.key) ? "removed" : evolutionState.active ? "stable" : null;
    if (evolutionStatus) {
      group.dataset.evolutionState = evolutionStatus;
      group.setAttribute("aria-label", `${evolutionStatus} cognition; ${node.family ?? node.kind}: ${node.label}`);
    }
    if (comparativeRecord) {
      group.dataset.comparativeState = comparativeRecord.semanticState;
      group.dataset.comparativePhase = comparativeRecord.phase;
      group.setAttribute(
        "aria-label",
        `${comparativeStateLabels[comparativeRecord.semanticState]}; ${comparativeRecord.phase} comparative step; ${node.family ?? node.kind}: ${node.label}`,
      );
      if (comparativeRecord.phase === "current") group.setAttribute("aria-current", "step");
    }
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
    const richNode = !denseWorld || node.aggregate || traceRecord || comparativeRecord
      || ["added", "removed", "evolved"].includes(evolutionStatus);
    const nodeTitle = svgElement("title");
    nodeTitle.textContent = `${node.label} - select for exact details`;
    if (richNode) {
      group.append(pulse, halo, body, core, nodeTitle);
    } else {
      // The interactive semantic node remains intact; only redundant visual
      // layers are omitted in dense worlds.
      group.append(body, nodeTitle);
    }
    if (["added", "removed", "evolved"].includes(evolutionStatus)) {
      const evolutionMarker = svgElement("g", { class: `cognitive-evolution-marker marker-${evolutionStatus}`, "aria-hidden": "true" });
      evolutionMarker.append(svgElement("circle", { cx: node.size + 7, cy: -(node.size + 7), r: 7.5 }));
      const markerText = svgElement("text", { x: node.size + 7, y: -(node.size + 4.2), "text-anchor": "middle" });
      markerText.textContent = evolutionStatus === "added" ? "+" : evolutionStatus === "removed" ? "−" : "~";
      evolutionMarker.append(markerText);
      group.append(evolutionMarker);
    }
    if (comparativeRecord && comparativeRecord.occurrences.some(({ semanticState }) => semanticState !== "shared")) {
      const marker = svgElement("g", {
        class: `comparative-reconstruction-marker marker-${comparativeRecord.semanticState}`,
        "aria-hidden": "true",
      });
      const markerX = node.size + 8;
      const markerY = -(node.size + 8);
      marker.append(
        svgElement("rect", {
          x: markerX - 7, y: markerY - 7, width: 14, height: 14, rx: 2,
          "data-comparative-marker-shape": "a",
        }),
        svgElement("path", {
          d: `M ${markerX} ${markerY - 8} L ${markerX + 8} ${markerY} L ${markerX} ${markerY + 8} L ${markerX - 8} ${markerY} Z`,
          "data-comparative-marker-shape": "b",
        }),
        svgElement("circle", {
          cx: markerX, cy: markerY, r: 8,
          "data-comparative-marker-shape": "both",
        }),
      );
      const markerText = svgElement("text", { x: markerX, y: markerY + 3, "text-anchor": "middle" });
      marker.append(markerText);
      updateComparativeMarker(marker, comparativeRecord);
      group.append(marker);
    }
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
    if (traceRecord || comparativeRecord || ["added", "removed", "evolved"].includes(evolutionStatus)
      || node.kind === "workspace" || node.aggregate) {
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
      if (selectedKey === node.key) {
        selectedKey = null;
        followedKey = endGraphFollow(currentViewState()).followedKey;
        previewKey = null;
        applyGraphEmphasis();
        emitViewState();
        container.dispatchEvent(new CustomEvent("graphselectionclear"));
        return;
      }
      setRovingNode(node.key);
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
    group.addEventListener("focus", () => {
      setRovingNode(node.key);
      previewKey = node.key;
      applyGraphEmphasis();
    });
    group.addEventListener("blur", () => { previewKey = null; applyGraphEmphasis(); });
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
        return;
      }
      if (interactionMode === "select" && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        const neighbor = spatialNeighbor(node, event.key);
        if (neighbor) {
          event.preventDefault();
          setRovingNode(neighbor.key, true);
        }
      }
    });
    nodeElements.set(node.key, group);
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
    button.dataset.controlLabel = label;
    button.textContent = compactLabel;
    if (action) button.addEventListener("click", action);
    return button;
  };
  const setControlDisabled = (button, disabled, reason) => {
    if (!button) return;
    button.disabled = Boolean(disabled);
    if (button.disabled) {
      button.title = reason;
      button.setAttribute("aria-description", reason);
      button.dataset.disabledReason = reason;
      return;
    }
    button.title = button.dataset.controlLabel ?? button.getAttribute("aria-label") ?? "";
    button.removeAttribute("aria-description");
    delete button.dataset.disabledReason;
  };
  const selectModeButton = createToolButton("Select nodes", null, "Select");
  const panModeButton = createToolButton("Pan graph", null, "Pan");
  selectModeButton.classList.toggle("is-active", interactionMode === "select");
  panModeButton.classList.toggle("is-active", interactionMode === "pan");
  selectModeButton.setAttribute("aria-pressed", String(interactionMode === "select"));
  panModeButton.setAttribute("aria-pressed", String(interactionMode === "pan"));
  setControlDisabled(selectModeButton, interactionMode === "select", "Select mode is already active.");
  setControlDisabled(panModeButton, interactionMode === "pan", "Pan mode is already active.");
  shell.classList.toggle("is-pan-mode", interactionMode === "pan");
  const cameraReadout = document.createElement("output");
  cameraReadout.className = "graph-zoom-readout";
  cameraReadout.setAttribute("aria-live", "polite");
  let focusInvestigationButton = null;
  let zoomOutButton = null;
  let zoomInButton = null;
  let fitButton = null;
  const cameraTargetForKeys = (keys) => {
    const nodes = keys.map((key) => byId.get(key)).filter(Boolean);
    if (nodes.length === 0) return null;
    const bounds = nodes.reduce((current, node) => {
      const radius = Number(node.size) + 28;
      return {
        minX: Math.min(current.minX, node.x - radius),
        maxX: Math.max(current.maxX, node.x + radius),
        minY: Math.min(current.minY, node.y - radius),
        maxY: Math.max(current.maxY, node.y + radius),
      };
    }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
    const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
    const availableWidth = rendererViewBox.width - 180;
    const availableHeight = rendererViewBox.height - 150;
    const scale = clamp(Math.min(availableWidth / contentWidth, availableHeight / contentHeight), .75, 2.05);
    const contentCenterX = (bounds.minX + bounds.maxX) / 2;
    const contentCenterY = (bounds.minY + bounds.maxY) / 2;
    return {
      scale,
      x: rendererViewBox.centerX - (contentCenterX * scale),
      y: rendererViewBox.centerY - (contentCenterY * scale),
    };
  };
  const synchronizeCameraControls = () => {
    setControlDisabled(zoomOutButton, camera.scale <= .75, "The graph is already at minimum zoom.");
    setControlDisabled(zoomInButton, camera.scale >= 2.5, "The graph is already at maximum zoom.");
    const atHome = Math.abs(camera.scale - 1) < .0001
      && Math.abs(camera.x) < .0001
      && Math.abs(camera.y) < .0001
      && !followedKey;
    setControlDisabled(fitButton, atHome, "The complete graph already fits the viewport.");
    const investigationTarget = cameraTargetForKeys(investigationNodeKeys);
    const atInvestigation = investigationTarget
      && Math.abs(camera.scale - investigationTarget.scale) < .0001
      && Math.abs(camera.x - investigationTarget.x) < .0001
      && Math.abs(camera.y - investigationTarget.y) < .0001
      && !followedKey;
    setControlDisabled(
      focusInvestigationButton,
      Boolean(atInvestigation),
      "The active investigation already fits the viewport.",
    );
  };
  const applyCamera = (notify = true) => {
    camera.x = clamp(camera.x, -rendererViewBox.width * .36 * camera.scale, rendererViewBox.width * .36 * camera.scale);
    camera.y = clamp(camera.y, -rendererViewBox.height * .36 * camera.scale, rendererViewBox.height * .36 * camera.scale);
    scene.setAttribute("transform", `translate(${camera.x} ${camera.y}) scale(${camera.scale})`);
    cameraReadout.value = `${Math.round(camera.scale * 100)}%`;
    synchronizeCameraControls();
    if (notify) emitViewState();
  };
  const zoomBy = (factor) => {
    const previous = camera.scale;
    const next = clamp(previous * factor, .75, 2.5);
    camera.x = rendererViewBox.centerX - ((rendererViewBox.centerX - camera.x) * (next / previous));
    camera.y = rendererViewBox.centerY - ((rendererViewBox.centerY - camera.y) * (next / previous));
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
    camera.x = rendererViewBox.centerX - (node.x * camera.scale);
    camera.y = rendererViewBox.centerY - (node.y * camera.scale);
    applyCamera();
  };
  const focusCameraOnKeys = (keys) => {
    const target = cameraTargetForKeys(keys);
    if (!target) return;
    camera.scale = target.scale;
    camera.x = target.x;
    camera.y = target.y;
    applyCamera();
  };
  const setInteractionMode = (mode) => {
    interactionMode = mode;
    shell.classList.toggle("is-pan-mode", mode === "pan");
    selectModeButton.classList.toggle("is-active", mode === "select");
    panModeButton.classList.toggle("is-active", mode === "pan");
    selectModeButton.setAttribute("aria-pressed", String(mode === "select"));
    panModeButton.setAttribute("aria-pressed", String(mode === "pan"));
    setControlDisabled(selectModeButton, mode === "select", "Select mode is already active.");
    setControlDisabled(panModeButton, mode === "pan", "Pan mode is already active.");
    nodeElements.forEach((element, key) => {
      const disabled = mode === "pan";
      element.setAttribute("aria-disabled", String(disabled));
      element.setAttribute(
        "aria-description",
        disabled ? "Node selection is disabled while Pan mode is active." : "Select this observed cognitive element.",
      );
      element.setAttribute("tabindex", !disabled && key === rovingNodeKey ? "0" : "-1");
    });
    regionElements.forEach((region) => {
      const disabled = mode === "pan";
      region.setAttribute("aria-disabled", String(disabled));
      region.setAttribute(
        "aria-description",
        disabled ? "Region isolation is disabled while Pan mode is active." : "Toggle this cognitive region isolation.",
      );
      region.setAttribute("tabindex", disabled ? "-1" : "0");
      region.style.cursor = disabled ? "grab" : "pointer";
    });
    if (mode === "pan" && nodeElements.get(rovingNodeKey)?.contains(document.activeElement)) svg.focus();
    emitViewState();
  };
  const focusTraceStep = (index) => {
    const step = traceJourney[index];
    const node = step ? byId.get(step.nodeKey) : null;
    if (!node) return;
    setRovingNode(node.key);
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
  toolbar.append(selectModeButton, panModeButton, followButton);
  if (investigationNodeKeys.length > 0) {
    focusInvestigationButton = createToolButton(
      "Focus active investigation",
      () => {
        followedKey = endGraphFollow(currentViewState()).followedKey;
        applyGraphEmphasis();
        focusCameraOnKeys(investigationNodeKeys);
      },
      "Focus investigation",
    );
    focusInvestigationButton.dataset.investigationAction = "focus";
    toolbar.append(focusInvestigationButton);
  }
  zoomOutButton = createToolButton("Zoom out", () => zoomBy(1 / 1.18), "-");
  zoomInButton = createToolButton("Zoom in", () => zoomBy(1.18), "+");
  fitButton = createToolButton("Fit graph", resetCamera, "Fit");
  toolbar.append(zoomOutButton, cameraReadout, zoomInButton, fitButton);
  let replayControlState = null;
  let comparativeControlState = null;
  if (comparativeState.active) {
    toolbar.classList.add("has-comparative-controls");
    const controls = document.createElement("div");
    controls.className = "comparative-reconstruction-controls";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "Comparative Reconstruction controls");
    const comparativeAction = (action) => () => {
      if (typeof onComparativeAction === "function") onComparativeAction(action);
    };
    const compareButton = createToolButton("Back to changes", comparativeAction("compare"), "Back to changes");
    compareButton.classList.add("is-active");
    const resetButton = createToolButton("Reset", comparativeAction("reset"), "Reset");
    const previousButton = createToolButton("Previous Step", comparativeAction("previous"), "Previous");
    const playButton = createToolButton("Play", comparativeAction("play"), "Play");
    const pauseButton = createToolButton("Pause", comparativeAction("pause"), "Pause");
    const nextButton = createToolButton("Next Step", comparativeAction("next"), "Next");
    resetButton.setAttribute("aria-keyshortcuts", "R");
    previousButton.setAttribute("aria-keyshortcuts", "ArrowLeft");
    playButton.setAttribute("aria-keyshortcuts", "Space");
    pauseButton.setAttribute("aria-keyshortcuts", "Space");
    nextButton.setAttribute("aria-keyshortcuts", "ArrowRight");
    setControlDisabled(resetButton, comparativeState.status === "ready", "Comparative Reconstruction is already at its starting state.");
    setControlDisabled(previousButton, comparativeState.cursor < 0, "Comparative Reconstruction has not advanced yet.");
    setControlDisabled(
      playButton,
      comparativeState.status === "playing" || comparativeState.status === "completed",
      comparativeState.status === "completed"
        ? "Comparative Reconstruction is complete; reset it to reconstruct again."
        : "Comparative Reconstruction is already playing.",
    );
    setControlDisabled(pauseButton, comparativeState.status !== "playing", "Comparative Reconstruction is not playing.");
    playButton.hidden = comparativeState.status === "playing";
    pauseButton.hidden = comparativeState.status !== "playing";
    setControlDisabled(nextButton, comparativeState.status === "completed", "Comparative Reconstruction is already complete.");
    const position = document.createElement("output");
    position.className = "comparative-reconstruction-position";
    position.setAttribute("aria-live", "polite");
    position.setAttribute("aria-atomic", "true");
    position.value = comparativeState.atDivergence
      ? `Divergence · ${String(comparativeState.cursor + 1).padStart(2, "0")} / ${comparativeState.total}`
      : comparativeState.status === "completed"
        ? "Complete · Reset to reconstruct again"
        : comparativeState.cursor < 0
          ? `Synchronized · Next starts 1 / ${comparativeState.total}`
          : `${String(comparativeState.cursor + 1).padStart(2, "0")} / ${comparativeState.total}`;
    controls.append(compareButton, resetButton, previousButton, playButton, pauseButton, nextButton, position);
    comparativeControlState = {
      resetButton,
      previousButton,
      playButton,
      pauseButton,
      nextButton,
      position,
    };
    toolbar.prepend(controls);
  } else if (replayActive) {
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
    restartButton.setAttribute("aria-keyshortcuts", "R");
    previousButton.setAttribute("aria-keyshortcuts", "ArrowLeft");
    playButton.setAttribute("aria-keyshortcuts", "Space");
    pauseButton.setAttribute("aria-keyshortcuts", "Space");
    nextButton.setAttribute("aria-keyshortcuts", "ArrowRight");
    setControlDisabled(restartButton, replayView.status === "ready", "Replay is already at its starting state.");
    setControlDisabled(previousButton, replayView.cursor < 0, "Replay has not advanced yet.");
    setControlDisabled(
      playButton,
      replayView.status === "playing" || replayView.status === "completed",
      replayView.status === "completed" ? "Replay is complete; restart it to reconstruct again." : "Replay is already playing.",
    );
    setControlDisabled(pauseButton, replayView.status !== "playing", "Replay is not playing.");
    playButton.hidden = replayView.status === "playing";
    pauseButton.hidden = replayView.status !== "playing";
    setControlDisabled(nextButton, replayView.status === "completed", "Replay is already complete.");
    const replayPosition = document.createElement("output");
    replayPosition.className = "cognitive-replay-position";
    replayPosition.setAttribute("aria-live", "polite");
    replayPosition.value = replayView.status === "completed"
      ? "Complete · Restart to reconstruct again"
      : replayView.cursor < 0
        ? `Ready · Next starts 1 / ${replayView.total}`
        : `${String(replayView.cursor + 1).padStart(2, "0")} / ${replayView.total}`;
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
  if (!traceState.active && !comparativeState.active && evolutionControl) {
    const evolutionControls = document.createElement("div");
    evolutionControls.className = "cognitive-evolution-controls";
    evolutionControls.setAttribute("role", "group");
    evolutionControls.setAttribute("aria-label", "Cognitive Evolution controls");
    const evolutionAction = (action) => () => {
      if (typeof onEvolutionAction === "function") onEvolutionAction(action);
    };
    const previousButton = createToolButton("Previous Observation", evolutionAction("previous"), "Previous");
    const compareButton = createToolButton("Compare", evolutionAction("compare"), evolutionControl.active ? "Comparing" : "Compare");
    const nextButton = createToolButton("Next Observation", evolutionAction("next"), "Next");
    setControlDisabled(
      previousButton,
      !evolutionControl.available || !evolutionControl.canGoPrevious,
      evolutionControl.available
        ? "This comparison starts with the earliest observation pair."
        : evolutionControl.unavailableReason || "Observe another frame to compare cognition.",
    );
    setControlDisabled(
      compareButton,
      !evolutionControl.available,
      evolutionControl.unavailableReason || "Observe another frame to compare cognition.",
    );
    compareButton.classList.toggle("is-active", Boolean(evolutionControl.active));
    compareButton.setAttribute("aria-pressed", String(Boolean(evolutionControl.active)));
    setControlDisabled(
      nextButton,
      !evolutionControl.available || !evolutionControl.canGoNext,
      evolutionControl.available
        ? "This comparison ends with the latest observation pair."
        : evolutionControl.unavailableReason || "Observe another frame to compare cognition.",
    );
    const position = document.createElement("output");
    position.className = "cognitive-evolution-position";
    position.setAttribute("aria-live", "polite");
    position.value = evolutionControl.available
      ? !evolutionControl.canGoPrevious && !evolutionControl.canGoNext
        ? `Only pair · Observation ${evolutionControl.fromIndex + 1} → ${evolutionControl.toIndex + 1}`
        : `Observation ${evolutionControl.fromIndex + 1} → ${evolutionControl.toIndex + 1}`
      : evolutionControl.unavailableReason || "Observe again to compare";
    evolutionControls.append(previousButton, compareButton, nextButton, position);
    toolbar.prepend(evolutionControls);
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
    camera.x = dragOrigin.cameraX + ((event.clientX - dragOrigin.x) * (rendererViewBox.width / bounds.width));
    camera.y = dragOrigin.cameraY + ((event.clientY - dragOrigin.y) * (rendererViewBox.height / bounds.height));
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
    button.dataset.regionKind = kind ?? "";
    button.dataset.regionLabel = label;
    button.dataset.controlLabel = kind ? `Isolate ${label} cognitive region` : "Show all cognitive regions";
    button.title = kind ? `Isolate ${label} cognitive region` : "Show all cognitive regions";
    button.setAttribute("aria-pressed", String(kind === filteredKind || (kind === null && filteredKind === null)));
    const swatch = document.createElement("span");
    swatch.className = `legend-swatch graph-kind-${kind ?? "all"}`;
    if (kind) swatch.style.background = palettes[kind]?.[0] ?? palettes.workspace[0];
    const text = document.createElement("span");
    text.textContent = label;
    button.append(swatch, text);
    button.addEventListener("click", () => {
      if (kind) {
        toggleRegionIsolation(kind);
        return;
      }
      filteredKind = null;
      synchronizeIsolationControls();
      applyGraphEmphasis();
      emitViewState();
    });
    item.append(button);
    legend.append(item);
  });
  shell.append(legend);
  synchronizeIsolationControls();

  if (comparativeState.active) {
    const reconstructionList = document.createElement("details");
    reconstructionList.className = "comparative-reconstruction-accessible-list";
    const reconstructionSummary = document.createElement("summary");
    reconstructionSummary.textContent = `Comparative Reconstruction (${comparativeState.moments.length} synchronized moments)`;
    const ordered = document.createElement("ol");
    const describeStep = (step) => {
      if (!step) return "no matching step";
      if (step.elementType === "node") return byId.get(step.key)?.label ?? step.key;
      const edge = edgeByKey.get(step.key);
      if (!edge) return step.key;
      return `${byId.get(edge.from)?.label ?? edge.from} ${edge.relation} ${byId.get(edge.to)?.label ?? edge.to}`;
    };
    comparativeState.moments.forEach((moment) => {
      const item = document.createElement("li");
      item.dataset.comparativeMoment = String(moment.index);
      if (moment.index === comparativeState.cursor && comparativeState.status !== "completed") {
        item.setAttribute("aria-current", "step");
      }
      item.textContent = `Step ${moment.index + 1}, ${moment.state}: A ${describeStep(moment.from)}; B ${describeStep(moment.to)}. ${moment.reason}`;
      ordered.append(item);
    });
    reconstructionList.append(reconstructionSummary, ordered);
    shell.append(reconstructionList);
  }

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
      const node = byId.get(button.dataset.listNode);
      if (!node) return;
      if (selectedKey === node.key) {
        selectedKey = null;
        followedKey = endGraphFollow(currentViewState()).followedKey;
        previewKey = null;
        applyGraphEmphasis();
        emitViewState();
        container.dispatchEvent(new CustomEvent("graphselectionclear"));
        return;
      }
      const next = selectGraphNode(currentViewState(), node.key);
      setRovingNode(node.key);
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

  if (!denseWorld) {
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
      const node = byId.get(button.dataset.listNode);
      if (!node) return;
      if (selectedKey === node.key) {
        selectedKey = null;
        followedKey = endGraphFollow(currentViewState()).followedKey;
        previewKey = null;
        applyGraphEmphasis();
        emitViewState();
        container.dispatchEvent(new CustomEvent("graphselectionclear"));
        return;
      }
      const next = selectGraphNode(currentViewState(), node.key);
      setRovingNode(node.key);
      selectedKey = next.selectedKey;
      followedKey = next.followedKey;
      previewKey = null;
      applyGraphEmphasis();
      if (followedKey) focusCameraOn(node);
      emitViewState();
      if (typeof onSelect === "function") onSelect(node);
    });
    shell.append(list);
  }

  applyGraphEmphasis();
  container.replaceChildren(shell);
  if (viewStateWasReconciled) emitViewState();

  const updateReplayView = (nextReplayView) => {
    if (!replayActive || !nextReplayView?.active || nextReplayView.identifier !== currentReplayView.identifier) return false;
    const affectedNodeKeys = new Set([
      ...replayCompletedNodes,
      ...replayFutureNodes,
      currentReplayView.currentNodeKey,
      ...nextReplayView.completedNodeKeys,
      ...nextReplayView.futureNodeKeys,
      nextReplayView.currentNodeKey,
    ].filter(Boolean));
    const affectedEdgeKeys = new Set([
      ...replayCompletedEdges,
      ...replayFutureEdges,
      currentReplayView.currentEdgeKey,
      ...nextReplayView.completedEdgeKeys,
      ...nextReplayView.futureEdgeKeys,
      nextReplayView.currentEdgeKey,
    ].filter(Boolean));
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
    affectedNodeKeys.forEach((key) => {
      const nodeElement = nodeElements.get(key);
      if (!nodeElement) return;
      nodeElement.classList.toggle("is-replay-completed", replayCompletedNodes.has(key));
      nodeElement.classList.toggle("is-replay-current", nextReplayView.currentNodeKey === key);
      nodeElement.classList.toggle("is-replay-future", replayFutureNodes.has(key));
    });
    affectedEdgeKeys.forEach((key) => {
      const record = edgeRecordByKey.get(key);
      if (!record) return;
      const { edge, base, flow } = record;
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
    if (followedKey) {
      const nextFollowKey = nextReplayView.currentNodeKey
        ?? (nextReplayView.status === "ready" ? traceJourney[0]?.nodeKey : null);
      const nextFollowNode = nextFollowKey ? byId.get(nextFollowKey) : null;
      if (nextFollowNode && nextFollowKey !== followedKey) {
        followedKey = nextFollowKey;
        setRovingNode(nextFollowKey);
        focusCameraOn(nextFollowNode);
      }
    }
    if (replayControlState) {
      const { restartButton, previousButton, playButton, pauseButton, nextButton, replayPosition } = replayControlState;
      const focusedControl = document.activeElement;
      setControlDisabled(restartButton, nextReplayView.status === "ready", "Replay is already at its starting state.");
      setControlDisabled(previousButton, nextReplayView.cursor < 0, "Replay has not advanced yet.");
      setControlDisabled(
        playButton,
        nextReplayView.status === "playing" || nextReplayView.status === "completed",
        nextReplayView.status === "completed" ? "Replay is complete; restart it to reconstruct again." : "Replay is already playing.",
      );
      setControlDisabled(pauseButton, nextReplayView.status !== "playing", "Replay is not playing.");
      playButton.hidden = nextReplayView.status === "playing";
      pauseButton.hidden = nextReplayView.status !== "playing";
      setControlDisabled(nextButton, nextReplayView.status === "completed", "Replay is already complete.");
      replayPosition.value = nextReplayView.status === "completed"
        ? "Complete · Restart to reconstruct again"
        : nextReplayView.cursor < 0
          ? `Ready · Next starts 1 / ${nextReplayView.total}`
          : `${String(nextReplayView.cursor + 1).padStart(2, "0")} / ${nextReplayView.total}`;
      if (focusedControl === playButton && playButton.hidden && !pauseButton.disabled) pauseButton.focus();
      if (focusedControl === pauseButton && pauseButton.hidden) {
        (nextReplayView.status === "completed" ? restartButton : playButton).focus();
      }
    }
    applyGraphEmphasis();
    return true;
  };

  const updateComparativeView = (nextComparativeView) => {
    if (!comparativeState.active || !nextComparativeView?.active
      || nextComparativeView.identifier !== currentComparativeView.identifier) return false;
    const next = prepareComparativeRenderingState(world, nextComparativeView);
    const affectedNodeKeys = new Set([
      ...comparativeNodeRecords.keys(),
      ...next.nodeRecords.map(({ key }) => key),
    ]);
    const affectedRelationshipKeys = new Set([
      ...comparativeRelationshipRecords.keys(),
      ...next.relationshipRecords.map(({ key }) => key),
    ]);
    currentComparativeView = nextComparativeView;
    comparativeNodeRecords.clear();
    comparativeRelationshipRecords.clear();
    next.nodeRecords.forEach((record) => comparativeNodeRecords.set(record.key, record));
    next.relationshipRecords.forEach((record) => comparativeRelationshipRecords.set(record.key, record));
    shell.dataset.comparativeStatus = next.status;
    shell.dataset.comparativeCursor = String(next.cursor);
    shell.dataset.comparativeDivergence = String(Boolean(next.atDivergence));
    affectedNodeKeys.forEach((key) => {
      const nodeElement = nodeElements.get(key);
      if (!nodeElement) return;
      const record = comparativeNodeRecords.get(key);
      applyComparativeNodeRecord(nodeElement, record);
      if (record?.phase === "current") nodeElement.setAttribute("aria-current", "step");
      else nodeElement.removeAttribute("aria-current");
    });
    affectedRelationshipKeys.forEach((key) => {
      const edgeRecord = edgeRecordByKey.get(key);
      if (!edgeRecord) return;
      const { edge, base, flow, comparativeEdgeRoutes } = edgeRecord;
      const record = comparativeRelationshipRecords.get(edge.key);
      [base, flow].filter(Boolean).forEach((element) => applyComparativeRecord(element, record));
      comparativeEdgeRoutes.forEach((route) => {
        const side = route.dataset.comparativeSide;
        applyComparativeRecord(route, side === "both" ? record : comparativeSideRecord(record, side));
      });
    });
    shell.querySelectorAll("[data-comparative-moment]").forEach((item) => {
      const active = Number(item.dataset.comparativeMoment) === next.cursor && next.status !== "completed";
      if (active) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    if (comparativeControlState) {
      const { resetButton, previousButton, playButton, pauseButton, nextButton, position } = comparativeControlState;
      const focusedControl = document.activeElement;
      setControlDisabled(resetButton, next.status === "ready", "Comparative Reconstruction is already at its starting state.");
      setControlDisabled(previousButton, next.cursor < 0, "Comparative Reconstruction has not advanced yet.");
      setControlDisabled(
        playButton,
        next.status === "playing" || next.status === "completed",
        next.status === "completed"
          ? "Comparative Reconstruction is complete; reset it to reconstruct again."
          : "Comparative Reconstruction is already playing.",
      );
      setControlDisabled(pauseButton, next.status !== "playing", "Comparative Reconstruction is not playing.");
      playButton.hidden = next.status === "playing";
      pauseButton.hidden = next.status !== "playing";
      setControlDisabled(nextButton, next.status === "completed", "Comparative Reconstruction is already complete.");
      position.value = next.atDivergence
        ? `Divergence · ${String(next.cursor + 1).padStart(2, "0")} / ${next.total}`
        : next.status === "completed"
          ? "Complete · Reset to reconstruct again"
          : next.cursor < 0
            ? `Synchronized · Next starts 1 / ${next.total}`
            : `${String(next.cursor + 1).padStart(2, "0")} / ${next.total}`;
      if (focusedControl === playButton && playButton.hidden && !pauseButton.disabled) pauseButton.focus();
      if (focusedControl === pauseButton && pauseButton.hidden) {
        (next.status === "completed" ? resetButton : playButton).focus();
      }
    }
    applyGraphEmphasis();
    return true;
  };

  return Object.freeze({ updateReplayView, updateComparativeView });
}
