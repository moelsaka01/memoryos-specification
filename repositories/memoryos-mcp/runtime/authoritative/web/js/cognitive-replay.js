const replayRoles = Object.freeze([
  "origin-evidence",
  "semantic-transformation",
  "retrieval",
  "reflection-current",
]);

const replayStatuses = new Set(["ready", "playing", "paused", "completed"]);

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function requireTrace(trace) {
  if (!trace || trace.kind !== "MemoryOSCognitiveTrace" || trace.version !== "1.1") {
    throw new TypeError("Cognitive Replay requires a MemoryOS 1.1 Cognitive Trace.");
  }
  if (!Object.isFrozen(trace) || !Array.isArray(trace.branches) || trace.branches.length === 0) {
    throw new TypeError("Cognitive Replay requires an immutable Cognitive Trace with evidence branches.");
  }
}

function membershipsFor(trace, key, property) {
  return trace.branches.flatMap((branch, branchIndex) => branch.steps.flatMap((step, stepIndex) => (
    step[property] === key
      ? [{ branch: branchIndex + 1, step: stepIndex + 1 }]
      : []
  )));
}

export function buildCognitiveReplay(trace) {
  requireTrace(trace);
  const steps = [];
  const seenNodes = new Set();
  const seenEdges = new Set();

  replayRoles.forEach((role) => {
    const roleSteps = trace.branches.flatMap((branch) => branch.steps.filter((step) => step.role === role));
    roleSteps.forEach((step) => {
      if (seenNodes.has(step.nodeKey)) return;
      seenNodes.add(step.nodeKey);
      steps.push({
        index: steps.length,
        type: "node",
        role,
        nodeKey: step.nodeKey,
        edgeKey: null,
        direction: "forward",
        memberships: membershipsFor(trace, step.nodeKey, "nodeKey"),
      });
    });
    roleSteps.forEach((step) => {
      if (step.edgeKey === null || seenEdges.has(step.edgeKey)) return;
      seenEdges.add(step.edgeKey);
      steps.push({
        index: steps.length,
        type: "relationship",
        role,
        nodeKey: null,
        edgeKey: step.edgeKey,
        direction: step.direction,
        memberships: membershipsFor(trace, step.edgeKey, "edgeKey"),
      });
    });
  });

  if (steps.length === 0 || steps.at(-1).nodeKey !== trace.targetNodeKey) {
    throw new TypeError("Cognitive Replay must terminate at the Cognitive Trace target.");
  }
  return freeze({
    kind: "MemoryOSCognitiveReplay",
    version: "1.1",
    identifier: `replay:${trace.identifier}`,
    traceIdentifier: trace.identifier,
    frameIdentifier: trace.frameIdentifier,
    targetNodeKey: trace.targetNodeKey,
    steps,
  });
}

export function createReplayState(replay) {
  if (!replay || replay.kind !== "MemoryOSCognitiveReplay") throw new TypeError("A Cognitive Replay is required.");
  return Object.freeze({ replayIdentifier: replay.identifier, status: "ready", cursor: -1 });
}

function requireState(replay, state) {
  if (!state || state.replayIdentifier !== replay.identifier || !replayStatuses.has(state.status)) {
    throw new TypeError("Replay state is not bound to this Cognitive Replay.");
  }
  if (!Number.isInteger(state.cursor) || state.cursor < -1 || state.cursor >= replay.steps.length) {
    throw new TypeError("Replay cursor is outside the Cognitive Replay.");
  }
}

function state(replay, status, cursor) {
  return Object.freeze({ replayIdentifier: replay.identifier, status, cursor });
}

export function playReplay(replay, current) {
  requireState(replay, current);
  if (current.status === "completed" || current.status === "playing") return current;
  return state(replay, "playing", current.cursor < 0 ? 0 : current.cursor);
}

export function pauseReplay(replay, current) {
  requireState(replay, current);
  return current.status === "playing" ? state(replay, "paused", current.cursor) : current;
}

export function restartReplay(replay, current) {
  requireState(replay, current);
  return state(replay, "ready", -1);
}

export function nextReplayStep(replay, current) {
  requireState(replay, current);
  const cursor = Math.min(current.cursor + 1, replay.steps.length - 1);
  const status = cursor === replay.steps.length - 1 ? "completed" : "paused";
  return state(replay, status, cursor);
}

export function previousReplayStep(replay, current) {
  requireState(replay, current);
  if (current.cursor <= 0) return state(replay, "ready", -1);
  return state(replay, "paused", current.cursor - 1);
}

export function advanceReplay(replay, current) {
  requireState(replay, current);
  if (current.status !== "playing") return current;
  const cursor = Math.min(current.cursor + 1, replay.steps.length - 1);
  return state(replay, cursor === replay.steps.length - 1 ? "completed" : "playing", cursor);
}

export function snapshotReplayState(replay, current) {
  requireState(replay, current);
  return freeze({ ...current });
}

export function restoreReplayState(replay, snapshot) {
  requireState(replay, snapshot);
  return state(replay, snapshot.status, snapshot.cursor);
}

export function projectReplay(replay, current) {
  requireState(replay, current);
  const visible = current.cursor < 0 ? [] : replay.steps.slice(0, current.cursor + 1);
  const completed = current.status === "completed" ? visible : visible.slice(0, -1);
  const active = current.status !== "completed" && current.cursor >= 0 ? replay.steps[current.cursor] : null;
  const future = replay.steps.slice(current.cursor + 1);
  return freeze({
    active: true,
    identifier: replay.identifier,
    status: current.status,
    cursor: current.cursor,
    total: replay.steps.length,
    completedNodeKeys: completed.filter(({ type }) => type === "node").map(({ nodeKey }) => nodeKey),
    completedEdgeKeys: completed.filter(({ type }) => type === "relationship").map(({ edgeKey }) => edgeKey),
    currentNodeKey: active?.type === "node" ? active.nodeKey : null,
    currentEdgeKey: active?.type === "relationship" ? active.edgeKey : null,
    futureNodeKeys: future.filter(({ type }) => type === "node").map(({ nodeKey }) => nodeKey),
    futureEdgeKeys: future.filter(({ type }) => type === "relationship").map(({ edgeKey }) => edgeKey),
    currentRole: active?.role ?? null,
    currentType: active?.type ?? null,
  });
}
