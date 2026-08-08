const viewBox = Object.freeze({ width: 960, height: 540, centerX: 480, centerY: 270 });

const topologyAnchors = Object.freeze({
  workspace: [470, 265],
  memory: [310, 295],
  validation: [300, 225],
  "long-term": [395, 195],
  semantic: [500, 175],
  episodic: [600, 205],
  procedural: [650, 280],
  retrieval: [565, 275],
  reflection: [535, 340],
  providers: [485, 390],
  consolidation: [420, 335],
  working: [350, 345],
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

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function pointWithinViewport(point) {
  return {
    x: clamp(point.x, 110, viewBox.width - 110),
    y: clamp(point.y, 145, viewBox.height - 105),
  };
}

function orderedAroundCenter(nodes, degreeByKey) {
  return [...nodes].sort((left, right) => {
    const degreeDifference = (degreeByKey.get(right.key) ?? 0) - (degreeByKey.get(left.key) ?? 0);
    if (degreeDifference !== 0) return degreeDifference;
    return left.key.localeCompare(right.key);
  });
}

function fanPosition(anchor, index, count, radius, spread = Math.PI * 2) {
  const outward = Math.atan2(anchor[1] - viewBox.centerY, anchor[0] - viewBox.centerX);
  const offset = count <= 1 ? 0 : (index / count) * spread;
  return pointWithinViewport({
    x: anchor[0] + (Math.cos(outward + offset) * radius),
    y: anchor[1] + (Math.sin(outward + offset) * radius),
  });
}

function layoutNodes(nodes, edges) {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const positioned = new Map();
  const degreeByKey = new Map(nodes.map((node) => [node.key, 0]));
  const aggregateByKind = new Map();
  const nestedParentByKey = new Map();

  edges.forEach((edge) => {
    degreeByKey.set(edge.from, (degreeByKey.get(edge.from) ?? 0) + 1);
    degreeByKey.set(edge.to, (degreeByKey.get(edge.to) ?? 0) + 1);
    const parent = byKey.get(edge.from);
    if (edge.relation === "contains" && parent && !parent.aggregate) {
      nestedParentByKey.set(edge.to, edge.from);
    }
  });

  nodes.forEach((node) => {
    if (node.kind === "workspace") {
      positioned.set(node.key, { ...node, x: topologyAnchors.workspace[0], y: topologyAnchors.workspace[1] });
      return;
    }
    if (!node.aggregate) return;
    aggregateByKind.set(node.kind, node);
    const anchor = topologyAnchors[node.kind] ?? topologyAnchors.workspace;
    positioned.set(node.key, { ...node, x: anchor[0], y: anchor[1] });
  });

  aggregateByKind.forEach((aggregate, kind) => {
    const anchor = topologyAnchors[kind] ?? topologyAnchors.workspace;
    const members = nodes.filter((node) => node.kind === kind
      && node.key !== aggregate.key
      && !nestedParentByKey.has(node.key));
    const ordered = orderedAroundCenter(members, degreeByKey);
    const radius = ordered.length > 5 ? 58 : ordered.length > 2 ? 51 : 43;
    ordered.forEach((node, index) => {
      positioned.set(node.key, { ...node, ...fanPosition(anchor, index, ordered.length, radius) });
    });
  });

  const nestedByParent = new Map();
  nestedParentByKey.forEach((parentKey, childKey) => {
    const children = nestedByParent.get(parentKey) ?? [];
    children.push(byKey.get(childKey));
    nestedByParent.set(parentKey, children);
  });
  nestedByParent.forEach((children, parentKey) => {
    const parent = positioned.get(parentKey);
    if (!parent) return;
    const outward = Math.atan2(parent.y - viewBox.centerY, parent.x - viewBox.centerX);
    const ordered = orderedAroundCenter(children.filter(Boolean), degreeByKey);
    ordered.forEach((node, index) => {
      const offset = ordered.length <= 1 ? 0 : ((index / (ordered.length - 1)) - .5) * 1.35;
      const radius = 24 + Math.min(12, ordered.length * 2);
      positioned.set(node.key, {
        ...node,
        ...pointWithinViewport({
          x: parent.x + (Math.cos(outward + offset) * radius),
          y: parent.y + (Math.sin(outward + offset) * radius),
        }),
      });
    });
  });

  const unplaced = nodes.filter((node) => !positioned.has(node.key));
  unplaced.forEach((node, index) => {
    const angle = ((index / Math.max(unplaced.length, 1)) * Math.PI * 2) - (Math.PI / 2);
    positioned.set(node.key, {
      ...node,
      x: viewBox.centerX + (Math.cos(angle) * 195),
      y: viewBox.centerY + (Math.sin(angle) * 145),
    });
  });

  return nodes.map((node) => positioned.get(node.key));
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function curvedEdge(from, to, edge, edgeIndex) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const direction = stableHash(`${edge.from}|${edge.to}|${edge.relation}|${edgeIndex}`) % 2 === 0 ? 1 : -1;
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

function edgeFlowKind(edge, from, to) {
  if (edge.relation === "evidence") return "evidence";
  if (edge.relation === "contributes" && to.kind === "reflection") return "reflection";
  if (from.kind === "retrieval" || to.kind === "retrieval") {
    if (edge.relation !== "contains" || (!from.aggregate && !to.aggregate)) return "retrieval";
  }
  if (edge.relation === "contributes" && (from.kind === "consolidation" || to.kind === "consolidation")) return "consolidation";
  if (edge.relation === "links") return "association";
  return null;
}

function flowAppearance(kind) {
  const appearances = {
    evidence: { color: "#59d998", duration: 5.2, opacity: .62 },
    retrieval: { color: "#32d8d2", duration: 2.7, opacity: .82 },
    reflection: { color: "#f06ddd", duration: 3.15, opacity: .9 },
    consolidation: { color: "#67d17a", duration: 4.4, opacity: .7 },
    association: { color: "#75a9d6", duration: 7.2, opacity: .38 },
  };
  return appearances[kind];
}

function normalizePerspective(perspective) {
  if (typeof perspective !== "string" || perspective.length === 0) return "complete";
  return Object.hasOwn(perspectiveKinds, perspective) || perspective === "provenance"
    ? perspective
    : "complete";
}

export function renderGraph(container, graph, onSelect, { perspective = "complete" } = {}) {
  const activePerspective = normalizePerspective(perspective);
  const identity = graph.identity ?? "Memory intelligence graph";
  const graphDescription = graph.description ?? "One interactive topology of MemoryOS cognitive state.";
  const positioned = layoutNodes(graph.nodes, graph.edges);
  const byId = new Map(positioned.map((node) => [node.key, node]));
  const shell = document.createElement("div");
  shell.className = "knowledge-graph topology-interface memory-intelligence-graph";
  shell.dataset.perspective = activePerspective;
  shell.dataset.graphIdentity = "memory-intelligence-graph";
  shell.setAttribute("role", "region");
  shell.setAttribute("aria-label", identity);

  let interactionMode = "select";
  let selectedKey = null;
  let previewKey = null;
  let filteredKind = null;
  let dragging = false;
  let dragOrigin = null;
  const camera = { scale: 1, x: 0, y: 0 };

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
  description.textContent = graphDescription;
  svg.append(title, description);

  const defs = svgElement("defs");
  const filter = svgElement("filter", { id: "node-glow", x: "-80%", y: "-80%", width: "260%", height: "260%" });
  filter.append(svgElement("feGaussianBlur", { stdDeviation: "4", result: "blur" }));
  const merge = svgElement("feMerge");
  merge.append(svgElement("feMergeNode", { in: "blur" }), svgElement("feMergeNode", { in: "SourceGraphic" }));
  filter.append(merge);
  defs.append(filter);
  svg.append(defs);

  const scene = svgElement("g", { class: "graph-camera topology-camera" });
  const edges = svgElement("g", { class: "graph-edges topology-edges", "aria-hidden": "true" });
  const edgeRecords = [];
  graph.edges.forEach((edge, edgeIndex) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return;
    const geometry = curvedEdge(from, to, edge, edgeIndex);
    const flowKind = edgeFlowKind(edge, from, to);
    const color = flowAppearance(flowKind)?.color ?? palettes[to.kind]?.[0] ?? "#42617b";
    const sharedAttributes = {
      pathLength: "1",
      fill: "none",
      stroke: color,
      "stroke-width": edge.relation === "contains" ? 1 : 1.25,
      "stroke-opacity": edge.relation === "contains" ? .24 : .5,
      style: `--edge-delay:${100 + (edgeIndex * 14)}ms;--flow-delay:${edgeIndex * -145}ms`,
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
        style: `${sharedAttributes.style};animation-duration:${appearance.duration}s;${flowKind === "consolidation" ? "filter:none" : ""}`,
      });
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
        style: `--synapse-delay:${-((edgeIndex * 83) + (synapseIndex * 240))}ms`,
      }));
    }
    edgeRecords.push({ edge, from, to, base, flow, flowKind });
  });
  scene.append(edges);

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
        style: `--micro-delay:${-((seed % 5200))}ms`,
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
  const relatedKeysFor = (nodeKey) => {
    const relatedKeys = new Set([nodeKey]);
    graph.edges.forEach((edge) => {
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
    svg.classList.toggle("is-graph-focused", Boolean(focusKey));
    svg.classList.toggle("has-perspective", hasPerspective);
    nodeGroup.querySelectorAll(".graph-node").forEach((nodeElement) => {
      const key = nodeElement.dataset.observationKey;
      const selected = key === selectedKey;
      const inPerspective = !hasPerspective || perspectiveKeys.has(key);
      nodeElement.classList.toggle("is-selected", selected);
      nodeElement.classList.toggle("is-graph-related", Boolean(focusKey) && relatedKeys.has(key));
      nodeElement.classList.toggle("is-perspective-primary", Boolean(perspectiveKind) && nodeElement.dataset.kind === perspectiveKind);
      nodeElement.classList.toggle("is-perspective-dimmed", !inPerspective);
      nodeElement.classList.toggle("is-filter-dimmed", Boolean(filteredKind) && nodeElement.dataset.kind !== filteredKind);
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
  };

  positioned.forEach((node, nodeIndex) => {
    const [stroke, fill] = palettes[node.kind] ?? palettes.workspace;
    const revealIndex = node.kind === "workspace" ? 0 : nodeIndex + 1;
    const pulseOffset = -((stableHash(node.key) % 4000) / 1000);
    const pulseDuration = 4.8 + ((stableHash(`${node.key}:pulse`) % 22) / 10);
    const group = svgElement("g", {
      class: `graph-node topology-node graph-node-${node.kind}${node.aggregate ? " is-aggregate" : ""}${node.detail ? " is-detail" : ""}`,
      tabindex: "0",
      role: "button",
      "aria-label": `${node.family ?? node.kind}: ${node.label}`,
      "aria-pressed": "false",
      "data-observation-key": node.key,
      "data-kind": node.kind,
      "data-family": node.family ?? node.kind,
      style: `--node-delay:${130 + (revealIndex * 18)}ms;--pulse-delay:${pulseOffset}s;--pulse-duration:${pulseDuration}s`,
      transform: `translate(${node.x} ${node.y})`,
    });
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
      style: node.detail ? "" : `animation:graph-node-breathe ${pulseDuration}s ${pulseOffset}s ease-in-out infinite`,
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
    if (node.kind === "workspace" || node.aggregate || (!node.detail && node.size >= 12)) {
      const label = svgElement("text", { x: 0, y: node.size + 18, "text-anchor": "middle" });
      label.textContent = node.label;
      group.append(label);
    }
    const select = () => {
      if (interactionMode === "pan") return;
      selectedKey = node.key;
      previewKey = null;
      applyGraphEmphasis();
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
  selectModeButton.classList.add("is-active");
  selectModeButton.setAttribute("aria-pressed", "true");
  panModeButton.setAttribute("aria-pressed", "false");
  const cameraReadout = document.createElement("output");
  cameraReadout.className = "graph-zoom-readout";
  cameraReadout.setAttribute("aria-live", "polite");
  const applyCamera = () => {
    camera.x = clamp(camera.x, -340 * camera.scale, 340 * camera.scale);
    camera.y = clamp(camera.y, -210 * camera.scale, 210 * camera.scale);
    scene.setAttribute("transform", `translate(${camera.x} ${camera.y}) scale(${camera.scale})`);
    cameraReadout.value = `${Math.round(camera.scale * 100)}%`;
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
    camera.scale = 1;
    camera.x = 0;
    camera.y = 0;
    applyCamera();
  };
  const setInteractionMode = (mode) => {
    interactionMode = mode;
    shell.classList.toggle("is-pan-mode", mode === "pan");
    selectModeButton.classList.toggle("is-active", mode === "select");
    panModeButton.classList.toggle("is-active", mode === "pan");
    selectModeButton.setAttribute("aria-pressed", String(mode === "select"));
    panModeButton.setAttribute("aria-pressed", String(mode === "pan"));
  };
  selectModeButton.addEventListener("click", () => setInteractionMode("select"));
  panModeButton.addEventListener("click", () => setInteractionMode("pan"));
  toolbar.append(
    selectModeButton,
    panModeButton,
    createToolButton("Zoom out", () => zoomBy(1 / 1.18), "-"),
    cameraReadout,
    createToolButton("Zoom in", () => zoomBy(1.18), "+"),
    createToolButton("Fit graph", resetCamera, "Fit"),
  );
  shell.append(toolbar);
  resetCamera();

  svg.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });
  svg.addEventListener("pointerdown", (event) => {
    if (interactionMode !== "pan" || event.button !== 0) return;
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
      container.dispatchEvent(new CustomEvent("graphselectionclear"));
    }
    const cameraKeys = { ArrowLeft: [24, 0], ArrowRight: [-24, 0], ArrowUp: [0, 24], ArrowDown: [0, -24] };
    if (interactionMode === "pan" && cameraKeys[event.key]) {
      event.preventDefault();
      camera.x += cameraKeys[event.key][0];
      camera.y += cameraKeys[event.key][1];
      applyCamera();
    }
  });
  container.addEventListener("cleargraphselection", () => {
    selectedKey = null;
    previewKey = null;
    applyGraphEmphasis();
  });

  const legend = document.createElement("ul");
  legend.className = "graph-legend topology-legend";
  legend.setAttribute("aria-label", "Graph layer filters");
  layerDefinitions.forEach(([kind, label], index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "graph-layer-filter";
    button.setAttribute("aria-pressed", String(index === 0));
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
    });
    item.append(button);
    legend.append(item);
  });
  shell.append(legend);

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
    selectedKey = node.key;
    previewKey = null;
    applyGraphEmphasis();
    if (typeof onSelect === "function") onSelect(node);
  });
  shell.append(list);

  applyGraphEmphasis();
  container.replaceChildren(shell);
}
