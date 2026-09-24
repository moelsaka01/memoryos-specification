const worldViewBox = Object.freeze({
  width: 960,
  height: 540,
  centerX: 480,
  centerY: 270,
});

const semanticAnchors = Object.freeze({
  workspace: Object.freeze([470, 265]),
  memory: Object.freeze([310, 295]),
  validation: Object.freeze([300, 225]),
  "long-term": Object.freeze([395, 195]),
  semantic: Object.freeze([500, 175]),
  episodic: Object.freeze([600, 205]),
  procedural: Object.freeze([650, 280]),
  retrieval: Object.freeze([565, 275]),
  reflection: Object.freeze([535, 340]),
  providers: Object.freeze([485, 390]),
  consolidation: Object.freeze([420, 335]),
  working: Object.freeze([350, 345]),
});

export const semanticWorldLayout = Object.freeze({
  identifier: "memoryos-semantic-world-v1",
  strategy: "deterministic-semantic-anchors",
  viewBox: worldViewBox,
  anchors: semanticAnchors,
});

export function stableWorldHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableSerialize(value) {
  if (value === undefined) throw new TypeError("Semantic world values cannot contain undefined.");
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError("Semantic world values must contain only finite numbers.");
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError(`Semantic world values cannot contain ${typeof value}.`);
  return serialized;
}

export function fingerprintObservation(value) {
  return stableWorldHash(stableSerialize(value)).toString(16).padStart(8, "0");
}

export function canonicalObservation(value) {
  return stableSerialize(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function pointWithinWorld(point) {
  return {
    x: clamp(point.x, 110, worldViewBox.width - 110),
    y: clamp(point.y, 145, worldViewBox.height - 105),
  };
}

function roundedPoint(point) {
  return {
    x: Number(point.x.toFixed(2)),
    y: Number(point.y.toFixed(2)),
  };
}

function compareText(left, right) {
  const leftText = String(left);
  const rightText = String(right);
  if (leftText < rightText) return -1;
  if (leftText > rightText) return 1;
  return 0;
}

function canonicalNodes(nodes) {
  if (!Array.isArray(nodes)) throw new TypeError("Semantic world nodes must be an array.");
  const copies = nodes.map((node) => {
    if (!node || typeof node !== "object") throw new TypeError("Every semantic world node must be an object.");
    if (typeof node.key !== "string" || node.key.length === 0) throw new TypeError("Every semantic world node requires a key.");
    if (typeof node.kind !== "string" || node.kind.length === 0) throw new TypeError(`Semantic world node '${node.key}' requires a kind.`);
    if (!Number.isFinite(node.size) || node.size <= 0) throw new TypeError(`Semantic world node '${node.key}' requires a positive finite size.`);
    return { ...node };
  });
  copies.sort((left, right) => compareText(left.key, right.key));
  for (let index = 1; index < copies.length; index += 1) {
    if (copies[index - 1].key === copies[index].key) {
      throw new TypeError(`Duplicate semantic world node key '${copies[index].key}'.`);
    }
  }
  return copies;
}

function canonicalEdges(edges, nodeByKey) {
  if (!Array.isArray(edges)) throw new TypeError("Semantic world edges must be an array.");
  const copies = edges.map((edge) => {
    if (!edge || typeof edge !== "object") throw new TypeError("Every semantic world edge must be an object.");
    if (!nodeByKey.has(edge.from) || !nodeByKey.has(edge.to)) {
      throw new TypeError(`Semantic world edge '${edge.from}' -> '${edge.to}' references an unknown node.`);
    }
    if (typeof edge.relation !== "string" || edge.relation.length === 0) {
      throw new TypeError(`Semantic world edge '${edge.from}' -> '${edge.to}' requires a relation.`);
    }
    return { ...edge };
  });
  copies.sort((left, right) => (
    compareText(left.from, right.from)
    || compareText(left.to, right.to)
    || compareText(left.relation, right.relation)
    || compareText(stableSerialize(left), stableSerialize(right))
  ));
  const occurrences = new Map();
  return copies.map((edge) => {
    const semanticKey = `${edge.from}|${edge.relation}|${edge.to}`;
    const occurrence = occurrences.get(semanticKey) ?? 0;
    occurrences.set(semanticKey, occurrence + 1);
    const from = nodeByKey.get(edge.from);
    const to = nodeByKey.get(edge.to);
    let flowKind = null;
    if (edge.relation === "evidence") flowKind = "evidence";
    else if (edge.relation === "contributes" && to.kind === "reflection") flowKind = "reflection";
    else if ((from.kind === "retrieval" || to.kind === "retrieval")
      && (edge.relation !== "contains" || (!from.aggregate && !to.aggregate))) flowKind = "retrieval";
    else if (edge.relation === "contributes"
      && (from.kind === "consolidation" || to.kind === "consolidation")) flowKind = "consolidation";
    else if (edge.relation === "links") flowKind = "association";
    return { ...edge, key: `${semanticKey}|${occurrence}`, flowKind };
  });
}

function stablePosition(anchor, key, minimumRadius, maximumRadius, verticalScale = 1) {
  const outward = Math.atan2(anchor[1] - worldViewBox.centerY, anchor[0] - worldViewBox.centerX);
  const angleUnit = stableWorldHash(`${key}:angle`) / 0xffffffff;
  const radiusUnit = stableWorldHash(`${key}:radius`) / 0xffffffff;
  const angle = outward + (angleUnit * Math.PI * 2);
  const radius = minimumRadius + ((maximumRadius - minimumRadius) * radiusUnit);
  return roundedPoint(pointWithinWorld({
    x: anchor[0] + (Math.cos(angle) * radius),
    y: anchor[1] + (Math.sin(angle) * radius * verticalScale),
  }));
}

function placeNodes(nodes, edges) {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const positioned = new Map();
  const aggregateByKind = new Map();
  const nestedParentByKey = new Map();

  edges.forEach((edge) => {
    const parent = byKey.get(edge.from);
    if (edge.relation === "contains" && parent && !parent.aggregate) {
      nestedParentByKey.set(edge.to, edge.from);
    }
  });

  nodes.forEach((node) => {
    if (node.kind === "workspace") {
      positioned.set(node.key, {
        ...node,
        x: semanticAnchors.workspace[0],
        y: semanticAnchors.workspace[1],
      });
      return;
    }
    if (!node.aggregate) return;
    if (aggregateByKind.has(node.kind)) {
      throw new TypeError(`Semantic world kind '${node.kind}' has more than one aggregate.`);
    }
    aggregateByKind.set(node.kind, node);
    const anchor = semanticAnchors[node.kind] ?? semanticAnchors.workspace;
    positioned.set(node.key, { ...node, x: anchor[0], y: anchor[1] });
  });

  nodes.forEach((node) => {
    if (positioned.has(node.key) || nestedParentByKey.has(node.key)) return;
    const anchor = semanticAnchors[node.kind] ?? semanticAnchors.workspace;
    positioned.set(node.key, {
      ...node,
      ...stablePosition(anchor, node.key, node.detail ? 32 : 40, node.detail ? 47 : 61, .78),
    });
  });

  const pendingChildren = [...nestedParentByKey.entries()]
    .sort(([leftKey], [rightKey]) => compareText(leftKey, rightKey));
  for (let pass = 0; pass < nodes.length && pendingChildren.length > 0; pass += 1) {
    let placedInPass = 0;
    for (let index = pendingChildren.length - 1; index >= 0; index -= 1) {
      const [childKey, parentKey] = pendingChildren[index];
      const parent = positioned.get(parentKey);
      if (!parent) continue;
      const child = byKey.get(childKey);
      positioned.set(childKey, {
        ...child,
        ...stablePosition([parent.x, parent.y], childKey, 23, 36, .82),
      });
      pendingChildren.splice(index, 1);
      placedInPass += 1;
    }
    if (placedInPass === 0) break;
  }

  const unplaced = nodes.filter((node) => !positioned.has(node.key));
  unplaced.forEach((node) => {
    positioned.set(node.key, {
      ...node,
      ...stablePosition([worldViewBox.centerX, worldViewBox.centerY], node.key, 170, 215, .72),
    });
  });

  return nodes.map((node) => positioned.get(node.key));
}

function normalizedFrameIndex(value) {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Semantic world frame index must be a non-negative safe integer.");
  }
  return value;
}

export function createSemanticWorld(graph, metadata = {}) {
  if (!graph || typeof graph !== "object") throw new TypeError("A graph model is required to create a semantic world.");
  const nodes = canonicalNodes(graph.nodes);
  const nodeByKey = new Map(nodes.map((node) => [node.key, node]));
  const edges = canonicalEdges(graph.edges, nodeByKey);
  const positionedNodes = placeNodes(nodes, edges);
  const topologyFingerprint = fingerprintObservation({
    nodes: positionedNodes.map(({ key, identifier, kind, family, size, aggregate, detail, observationPath, revision, x, y }) => ({
      key,
      identifier,
      kind,
      family,
      size,
      aggregate: Boolean(aggregate),
      detail: Boolean(detail),
      observationPath: observationPath ?? null,
      revision: revision ?? null,
      x,
      y,
    })),
    edges,
  });
  const observationFingerprint = metadata.observationFingerprint ?? topologyFingerprint;
  const frameIndex = normalizedFrameIndex(metadata.frameIndex);
  const frameFingerprint = fingerprintObservation({
    frameIndex,
    topologyFingerprint,
    observationFingerprint,
    observationIdentifier: metadata.observationIdentifier ?? null,
    workspaceIdentifier: metadata.workspaceIdentifier ?? null,
    sessionIdentifier: metadata.sessionIdentifier ?? null,
  });
  const observationIdentifier = metadata.observationIdentifier ?? "unidentified-observation";

  return deepFreeze({
    kind: "MemoryOSSemanticWorld",
    version: "1.1",
    identity: graph.identity ?? "Memory intelligence graph",
    description: graph.description ?? "One deterministic semantic world of MemoryOS cognitive state.",
    layout: semanticWorldLayout,
    frame: {
      // Timeline sequence is the collision-free replay address. The compact
      // fingerprint is diagnostic only and is never used as exact identity.
      identifier: `${observationIdentifier}:${frameIndex}:${frameFingerprint}`,
      index: frameIndex,
      fingerprint: frameFingerprint,
      topologyFingerprint,
      observationFingerprint,
      observationIdentifier,
      workspaceIdentifier: metadata.workspaceIdentifier ?? null,
      sessionIdentifier: metadata.sessionIdentifier ?? null,
      source: metadata.source ?? null,
    },
    nodes: positionedNodes,
    edges,
  });
}
