import {
  canonicalObservation,
  createSemanticWorld,
  fingerprintObservation,
} from "./semantic-world.js";

function detachedClone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function indexedByKey(values) {
  return new Map(values.map((value) => [value.key, value]));
}

function changedKeys(previousValues, currentValues) {
  const previous = indexedByKey(previousValues);
  const current = indexedByKey(currentValues);
  const added = [];
  const changed = [];
  const removed = [];

  current.forEach((value, key) => {
    const earlier = previous.get(key);
    if (!earlier) {
      added.push(key);
      return;
    }
    if (canonicalObservation(earlier) !== canonicalObservation(value)) changed.push(key);
  });
  previous.forEach((_, key) => {
    if (!current.has(key)) removed.push(key);
  });
  return { added, changed, removed };
}

export function diffSemanticWorld(previous, current) {
  if (!previous) {
    return deepFreeze({
      nodes: { added: [], changed: [], removed: [] },
      edges: { added: [], changed: [], removed: [] },
      nodeKeys: [],
      edgeKeys: [],
    });
  }
  const nodes = changedKeys(previous.nodes, current.nodes);
  const edges = changedKeys(previous.edges, current.edges);
  return deepFreeze({
    nodes,
    edges,
    nodeKeys: [...nodes.added, ...nodes.changed],
    edgeKeys: [...edges.added, ...edges.changed],
  });
}

export function createObservationTimeline() {
  return Object.freeze([]);
}

export function appendObservationFrame(
  frames,
  {
    snapshot,
    graph,
    operation = "Observe",
    query = null,
    resultCode = "OK",
  },
) {
  if (!Array.isArray(frames)) throw new TypeError("Observation timeline must be an array.");
  if (!snapshot || typeof snapshot !== "object") throw new TypeError("An accepted detached observation is required.");
  if (typeof snapshot.workspaceIdentifier !== "string" || snapshot.workspaceIdentifier.length === 0) {
    throw new TypeError("An accepted detached observation requires a Workspace identifier.");
  }
  if (!graph || typeof graph !== "object") throw new TypeError("A graph projection is required.");
  if (typeof operation !== "string" || operation.length === 0) throw new TypeError("Observation operation is required.");
  if (typeof resultCode !== "string" || resultCode.length === 0) throw new TypeError("Observation result code is required.");
  if (resultCode !== "OK") throw new RangeError("Only successful detached observations may enter the timeline.");

  const history = Object.isFrozen(frames) ? frames : Object.freeze([...frames]);
  const detachedSnapshot = deepFreeze(detachedClone(snapshot));
  const prior = history.at(-1);
  if (prior && prior.snapshot.workspaceIdentifier !== detachedSnapshot.workspaceIdentifier) {
    throw new RangeError("Observation frames cannot cross a Workspace boundary.");
  }
  if (prior && (prior.snapshot.session?.identifier ?? null) !== (detachedSnapshot.session?.identifier ?? null)) {
    throw new RangeError("Observation frames cannot cross a Studio session boundary.");
  }
  const sequence = history.length;
  const world = createSemanticWorld(graph, {
    frameIndex: sequence,
    observationFingerprint: fingerprintObservation(detachedSnapshot),
    observationIdentifier: detachedSnapshot.observationIdentifier,
    workspaceIdentifier: detachedSnapshot.workspaceIdentifier,
    sessionIdentifier: detachedSnapshot.session?.identifier,
    source: detachedSnapshot.source,
  });
  const activity = diffSemanticWorld(prior?.world ?? null, world);
  const frame = deepFreeze({
    kind: "MemoryOSObservationFrame",
    version: "1.1",
    sequence,
    operation,
    query: query === null ? null : detachedClone(query),
    resultCode,
    snapshot: detachedSnapshot,
    world,
    activity,
  });
  const next = Object.freeze([...history, frame]);
  return Object.freeze({ frames: next, current: frame });
}

export function currentObservationFrame(frames) {
  if (!Array.isArray(frames)) throw new TypeError("Observation timeline must be an array.");
  return frames.at(-1) ?? null;
}
