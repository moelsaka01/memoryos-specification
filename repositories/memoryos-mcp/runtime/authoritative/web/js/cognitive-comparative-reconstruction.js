import { buildCognitiveReplay } from "./cognitive-replay.js";
import { validateCognitiveTrace } from "./cognitive-trace.js";
import {
  compareCognitiveEvolution,
  validateCognitiveEvolution,
} from "./cognitive-evolution.js";
import {
  canonicalObservation,
  fingerprintObservation,
} from "./semantic-world.js";
import { alignDeterministicSequences } from "./deterministic-sequence-alignment.js";

const states = Object.freeze(["shared", "a-only", "b-only", "modified"]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function compareText(left, right) {
  const a = String(left);
  const b = String(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

export class ComparativeReconstructionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ComparativeReconstructionError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new ComparativeReconstructionError(code, message);
}

function requireBoundTrace(frame, trace, label) {
  if (!frame || frame.kind !== "MemoryOSObservationFrame" || frame.version !== "1.1") {
    fail("INVALID_FRAME", `${label} requires an immutable MemoryOS 1.1 Observation Frame.`);
  }
  if (!trace || trace.kind !== "MemoryOSCognitiveTrace" || trace.version !== "1.1") {
    fail("INVALID_TRACE", `${label} requires an immutable MemoryOS 1.1 Cognitive Trace.`);
  }
  const validation = validateCognitiveTrace(trace, frame);
  if (!validation.valid) {
    const issue = validation.issues[0];
    fail(issue?.code ?? "INVALID_TRACE", `${label} is not an exact trace of its bound frame: ${issue?.message ?? "validation failed"}`);
  }
}

function semanticEdgeRevision(edge) {
  const { flowKind: ignoredFlowKind, ...semantic } = edge;
  return canonicalObservation(semantic);
}

function resolvedReplaySteps(frame, replay, label) {
  const nodes = new Map(frame.world.nodes.map((node) => [node.key, node]));
  const relationships = new Map(frame.world.edges.map((edge) => [edge.key, edge]));
  return replay.steps.map((step) => {
    const key = step.type === "node" ? step.nodeKey : step.edgeKey;
    const semantic = step.type === "node" ? nodes.get(key) : relationships.get(key);
    if (!semantic) fail("MISSING_SEMANTIC_ELEMENT", `${label} references '${key}', which is absent from its bound semantic world.`);
    const exactRevision = step.type === "node"
      ? canonicalObservation(semantic.revision ?? null)
      : semanticEdgeRevision(semantic);
    return deepFreeze({
      index: step.index,
      identity: `${step.type}:${key}`,
      elementType: step.type,
      role: step.role,
      key,
      nodeKey: step.nodeKey,
      edgeKey: step.edgeKey,
      direction: step.direction,
      exactRevision,
      revisionFingerprint: fingerprintObservation(exactRevision),
    });
  });
}

function stepReference(step) {
  if (!step) return null;
  return {
    replayIndex: step.index,
    elementType: step.elementType,
    role: step.role,
    key: step.key,
    nodeKey: step.nodeKey,
    edgeKey: step.edgeKey,
    direction: step.direction,
    revisionFingerprint: step.revisionFingerprint,
  };
}

function classifyMoment(pair, index) {
  const { from, to } = pair;
  if (!from) {
    return {
      index,
      state: "b-only",
      divergent: true,
      role: to.role,
      elementType: to.elementType,
      reasonCodes: ["B_ONLY"],
      reason: "Observation B contains this exact semantic step; Observation A does not.",
      from: null,
      to: stepReference(to),
    };
  }
  if (!to) {
    return {
      index,
      state: "a-only",
      divergent: true,
      role: from.role,
      elementType: from.elementType,
      reasonCodes: ["A_ONLY"],
      reason: "Observation A contains this exact semantic step; Observation B does not.",
      from: stepReference(from),
      to: null,
    };
  }

  const reasonCodes = [];
  if (from.exactRevision !== to.exactRevision) {
    reasonCodes.push(from.elementType === "relationship"
      ? "RELATIONSHIP_REVISION_CHANGED"
      : "SEMANTIC_REVISION_CHANGED");
  }
  if (from.role !== to.role || from.direction !== to.direction) reasonCodes.push("TRACE_BINDING_CHANGED");
  const divergent = reasonCodes.length > 0;
  const reasons = {
    RELATIONSHIP_REVISION_CHANGED: "The same relationship identity has a different exact runtime revision.",
    SEMANTIC_REVISION_CHANGED: "The same semantic identity has a different exact runtime revision.",
    TRACE_BINDING_CHANGED: "The same semantic identity has a different trace role or traversal direction.",
  };
  return {
    index,
    state: divergent ? "modified" : "shared",
    divergent,
    role: to.role,
    elementType: to.elementType,
    reasonCodes,
    reason: divergent
      ? reasonCodes.map((code) => reasons[code]).join(" ")
      : "Both observations contain the same exact semantic step.",
    from: stepReference(from),
    to: stepReference(to),
  };
}

function summarize(moments) {
  const summary = {
    moments: moments.length,
    shared: 0,
    divergent: 0,
    aOnly: 0,
    bOnly: 0,
    modified: 0,
    evidence: 0,
    semanticTransformations: 0,
    retrievals: 0,
    reflections: 0,
    relationships: 0,
  };
  moments.forEach((moment) => {
    if (moment.divergent) summary.divergent += 1;
    else summary.shared += 1;
    if (moment.state === "a-only") summary.aOnly += 1;
    if (moment.state === "b-only") summary.bOnly += 1;
    if (moment.state === "modified") summary.modified += 1;
    if (moment.divergent && moment.elementType === "relationship") summary.relationships += 1;
    if (!moment.divergent || moment.elementType !== "node") return;
    if (moment.role === "origin-evidence") summary.evidence += 1;
    if (moment.role === "semantic-transformation") summary.semanticTransformations += 1;
    if (moment.role === "retrieval") summary.retrievals += 1;
    if (moment.role === "reflection-current") summary.reflections += 1;
  });
  return summary;
}

export function buildComparativeReconstruction(fromFrame, fromTrace, toFrame, toTrace) {
  requireBoundTrace(fromFrame, fromTrace, "Observation A");
  requireBoundTrace(toFrame, toTrace, "Observation B");
  if (fromFrame.sequence >= toFrame.sequence) {
    fail("INVALID_FRAME_ORDER", "Comparative Reconstruction requires Observation A to precede Observation B.");
  }
  if (fromTrace.workspaceIdentifier !== toTrace.workspaceIdentifier) {
    fail("WORKSPACE_MISMATCH", "Comparative Reconstruction cannot cross a Workspace boundary.");
  }
  if (fromTrace.sessionIdentifier !== toTrace.sessionIdentifier) {
    fail("SESSION_MISMATCH", "Comparative Reconstruction cannot cross a Studio session boundary.");
  }
  if (fromFrame.world.layout?.identifier !== toFrame.world.layout?.identifier) {
    fail("LAYOUT_MISMATCH", "Comparative Reconstruction requires one stable semantic geography.");
  }

  const evolution = compareCognitiveEvolution(fromFrame, toFrame);
  validateCognitiveEvolution(evolution);
  const fromReplay = buildCognitiveReplay(fromTrace);
  const toReplay = buildCognitiveReplay(toTrace);
  const fromSteps = resolvedReplaySteps(fromFrame, fromReplay, "Observation A replay");
  const toSteps = resolvedReplaySteps(toFrame, toReplay, "Observation B replay");
  const moments = alignDeterministicSequences(fromSteps, toSteps)
    .map((pair, index) => classifyMoment(pair, index));
  const divergenceIndices = moments.filter(({ divergent }) => divergent).map(({ index }) => index);
  const identityMaterial = {
    workspaceIdentifier: fromTrace.workspaceIdentifier,
    fromFrameIdentifier: fromFrame.world.frame.identifier,
    fromTraceIdentifier: fromTrace.identifier,
    toFrameIdentifier: toFrame.world.frame.identifier,
    toTraceIdentifier: toTrace.identifier,
    moments: moments.map(({ state, reasonCodes, from, to }) => ({ state, reasonCodes, from, to })),
  };
  const identifier = `comparative-reconstruction:${fromFrame.sequence}:${toFrame.sequence}:${fingerprintObservation(identityMaterial)}`;
  const result = {
    kind: "MemoryOSComparativeReconstruction",
    version: "1.1",
    identifier,
    workspaceIdentifier: fromTrace.workspaceIdentifier,
    sessionIdentifier: fromTrace.sessionIdentifier,
    evolutionIdentifier: evolution.identifier,
    worldIdentifier: evolution.world.frame.identifier,
    from: {
      frameSequence: fromFrame.sequence,
      frameIdentifier: fromFrame.world.frame.identifier,
      traceIdentifier: fromTrace.identifier,
      replayIdentifier: fromReplay.identifier,
      targetNodeKey: fromTrace.targetNodeKey,
    },
    to: {
      frameSequence: toFrame.sequence,
      frameIdentifier: toFrame.world.frame.identifier,
      traceIdentifier: toTrace.identifier,
      replayIdentifier: toReplay.identifier,
      targetNodeKey: toTrace.targetNodeKey,
    },
    moments,
    divergenceIndices,
    firstDivergenceIndex: divergenceIndices[0] ?? null,
    summary: summarize(moments),
    world: evolution.world,
  };
  validateComparativeReconstruction(deepFreeze(result));
  return result;
}

export function validateComparativeReconstruction(reconstruction) {
  if (!reconstruction || reconstruction.kind !== "MemoryOSComparativeReconstruction"
    || reconstruction.version !== "1.1") {
    fail("INVALID_RECONSTRUCTION", "A MemoryOS 1.1 Comparative Reconstruction is required.");
  }
  if (!Object.isFrozen(reconstruction) || !Object.isFrozen(reconstruction.moments)
    || !Object.isFrozen(reconstruction.world)) {
    fail("MUTABLE_RECONSTRUCTION", "Comparative Reconstruction must be immutable.");
  }
  if (reconstruction.world.frame?.identifier !== reconstruction.worldIdentifier
    || reconstruction.worldIdentifier !== reconstruction.evolutionIdentifier) {
    fail("WORLD_MISMATCH", "Comparative Reconstruction is not bound to its one semantic world.");
  }
  if (!Array.isArray(reconstruction.moments) || reconstruction.moments.length === 0) {
    fail("EMPTY_RECONSTRUCTION", "Comparative Reconstruction requires at least one aligned semantic moment.");
  }
  const worldNodes = new Set(reconstruction.world.nodes.map(({ key }) => key));
  const worldRelationships = new Set(reconstruction.world.edges.map(({ key }) => key));
  reconstruction.moments.forEach((moment, index) => {
    if (moment.index !== index || !states.includes(moment.state)
      || moment.divergent !== (moment.state !== "shared")) {
      fail("INVALID_MOMENT", "Comparative Reconstruction moments must be contiguous and canonically classified.");
    }
    [moment.from, moment.to].filter(Boolean).forEach((step) => {
      const available = step.elementType === "node" ? worldNodes : worldRelationships;
      if (!available.has(step.key)) {
        fail("MISSING_SEMANTIC_ELEMENT", `Comparative moment '${index}' references '${step.key}' outside the one semantic world.`);
      }
    });
    if (moment.state === "shared" && (!moment.from || !moment.to
      || moment.from.key !== moment.to.key || moment.reasonCodes.length !== 0)) {
      fail("INVALID_SHARED_MOMENT", "A shared comparative moment requires the same exact semantic identity on both observations.");
    }
  });
  const expectedDivergences = reconstruction.moments
    .filter(({ divergent }) => divergent)
    .map(({ index }) => index);
  if (canonicalObservation(expectedDivergences) !== canonicalObservation(reconstruction.divergenceIndices)
    || reconstruction.firstDivergenceIndex !== (expectedDivergences[0] ?? null)) {
    fail("INVALID_DIVERGENCE_INDEX", "Comparative divergence indices do not match the aligned semantic moments.");
  }
  return true;
}
