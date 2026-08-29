import {
  buildComparativeReconstruction,
  validateComparativeReconstruction,
} from "./cognitive-comparative-reconstruction.js";
import {
  advanceComparativeReplay,
  createComparativeReplayState,
  nextComparativeStep,
  pauseComparativeReplay,
  playComparativeReplay,
  previousComparativeStep,
  projectComparativeReplay,
  resetComparativeReplay,
} from "./cognitive-comparative-replay.js";
import {
  compareCognitiveEvolution,
  validateCognitiveEvolution,
} from "./cognitive-evolution.js";
import {
  compareEvolution,
  createEvolutionController,
  evolutionFrames,
  nextEvolutionObservation,
  previousEvolutionObservation,
} from "./cognitive-evolution-controller.js";
import {
  advanceReplay,
  buildCognitiveReplay,
  createReplayState,
  nextReplayStep,
  pauseReplay,
  playReplay,
  previousReplayStep,
  projectReplay,
  restartReplay,
  restoreReplayState,
  snapshotReplayState,
} from "./cognitive-replay.js";
import {
  buildCognitiveTrace,
  resolveCognitiveTraceTarget,
  validateCognitiveTrace,
} from "./cognitive-trace.js";
import {
  importMemoryInvestigationPackage,
  serializeMemoryInvestigationPackage,
  verifyMemoryInvestigationPackage,
} from "./memory-investigation-package.js";
import {
  canonicalize,
  cloneCanonical,
  deepFreeze,
  mipDigest,
} from "./mip-canonical.js";
import {
  appendObservationFrame,
  createObservationTimeline,
} from "./observation-timeline.js";
import { buildGraph } from "./studio-model.js";

export const INVESTIGATION_CORE_VERSION = "1.0.0";
const MAX_TRANSITION_COUNT = 10_000;
const MAX_TRANSITION_PAYLOAD_BYTES = 16 * 1024 * 1024;

export const LifecycleState = Object.freeze({
  Created: "Created",
  Observed: "Observed",
  Traced: "Traced",
  ReplayReady: "ReplayReady",
  Replaying: "Replaying",
  ReplayComplete: "ReplayComplete",
  ComparisonReady: "ComparisonReady",
  Comparing: "Comparing",
  Verified: "Verified",
  Archived: "Archived",
});

const lifecycleValues = new Set(Object.values(LifecycleState));
const transitionKinds = new Set([
  "CREATED",
  "OBSERVED",
  "PACKAGE_IMPORTED",
  "TRACE_SELECTED",
  "REPLAY_PREPARED",
  "REPLAY_ACTION",
  "EVOLUTION_ENTERED",
  "EVOLUTION_MOVED",
  "COMPARATIVE_ENTERED",
  "COMPARATIVE_ACTION",
  "COMPARATIVE_LEFT",
  "EVOLUTION_LEFT",
  "RETURNED_TO_WORLD",
  "VERIFIED",
  "ARCHIVED",
]);
const acceptedStudioSnapshotMembers = Object.freeze([
  "consolidationSessions",
  "contract",
  "episodicMemory",
  "longTermMemory",
  "memory",
  "observationIdentifier",
  "proceduralMemory",
  "providerSessions",
  "reflectionSessions",
  "reflections",
  "result",
  "retrievalSessions",
  "semanticMemory",
  "session",
  "source",
  "validation",
  "workingMemory",
  "workspaceIdentifier",
]);
const replayActions = Object.freeze({
  play: playReplay,
  pause: pauseReplay,
  restart: restartReplay,
  previous: previousReplayStep,
  next: nextReplayStep,
  advance: advanceReplay,
});
const comparativeActions = Object.freeze({
  play: playComparativeReplay,
  pause: pauseComparativeReplay,
  reset: resetComparativeReplay,
  previousStep: previousComparativeStep,
  nextStep: nextComparativeStep,
  advance: advanceComparativeReplay,
});
const comparisonActions = new Set([
  "enter",
  "previous",
  "next",
  "start",
  "play",
  "pause",
  "reset",
  "previousStep",
  "nextStep",
  "advance",
  "back",
]);

function nonEmptyText(value) {
  return typeof value === "string" && value.length > 0;
}

function coreDiagnostic(code, operation, message, details = {}) {
  return deepFreeze({ code, operation, message, ...details });
}

export class InvestigationCoreError extends Error {
  constructor(code, operation, message, details = {}) {
    super(message);
    this.name = "InvestigationCoreError";
    this.code = code;
    this.operation = operation;
    this.diagnostics = Object.freeze([coreDiagnostic(code, operation, message, details)]);
    Object.freeze(this.diagnostics);
  }
}

function fail(code, operation, message, details = {}) {
  throw new InvestigationCoreError(code, operation, message, details);
}

function requireObject(value, operation, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("INVALID_INPUT", operation, `${label} must be an object.`);
  }
  return value;
}

function requireIdentifier(value, operation, label = "Investigation identifier") {
  if (!nonEmptyText(value)) fail("INVALID_INPUT", operation, `${label} is required.`);
  return value;
}

function canonicalClone(value, operation, label) {
  try {
    return deepFreeze(cloneCanonical(value));
  } catch (error) {
    fail(
      error?.code === "RESOURCE_LIMIT_EXCEEDED" ? "RESOURCE_LIMIT_EXCEEDED" : "INVALID_INPUT",
      operation,
      `${label} must be detached canonical data.`,
    );
  }
}

function acceptedStudioSnapshot(value, operation) {
  const snapshot = canonicalClone(value, operation, "Observation snapshot");
  requireObject(snapshot, operation, "Observation snapshot");
  const members = Object.keys(snapshot).sort();
  if (canonicalize(members) !== canonicalize(acceptedStudioSnapshotMembers)
    || snapshot.contract !== "CCA-STUDIO-1.0"
    || !nonEmptyText(snapshot.workspaceIdentifier)
    || !nonEmptyText(snapshot.observationIdentifier)
    || !nonEmptyText(snapshot.source)
    || !nonEmptyText(snapshot.session?.identifier)) {
    fail(
      "INVALID_INPUT",
      operation,
      "Observation input must be an accepted detached CCA-STUDIO-1.0 view with no foreign top-level state.",
    );
  }
  return snapshot;
}

function transitionMaterial(transition) {
  return {
    identifier: transition.identifier,
    index: transition.index,
    investigationIdentifier: transition.investigationIdentifier,
    kind: transition.kind,
    payload: transition.payload,
    previousLogDigest: transition.previousLogDigest,
  };
}

function transitionIdentifier(investigationIdentifier, index, kind, payload, previousLogDigest) {
  return mipDigest(
    "INVESTIGATION-CORE-TRANSITION-1.0",
    canonicalize({ investigationIdentifier, index, kind, payload, previousLogDigest }),
  );
}

export class Transition {
  constructor({ investigationIdentifier, index, kind, payload, previousLogDigest }) {
    requireIdentifier(investigationIdentifier, "transition", "Transition investigation identifier");
    if (!Number.isSafeInteger(index) || index < 0) {
      fail("INVALID_TRANSITION", "transition", "Transition indices must be contiguous non-negative safe integers.");
    }
    if (!transitionKinds.has(kind)) {
      fail("INVALID_TRANSITION", "transition", `Unknown transition kind '${String(kind)}'.`);
    }
    if (!nonEmptyText(previousLogDigest)) {
      fail("INVALID_TRANSITION", "transition", "A transition must bind the preceding transition-log digest.");
    }
    this.kind = kind;
    this.version = INVESTIGATION_CORE_VERSION;
    this.investigationIdentifier = investigationIdentifier;
    this.index = index;
    this.payload = canonicalClone(payload ?? {}, "transition", "Transition payload");
    if (new TextEncoder().encode(canonicalize(this.payload)).byteLength > MAX_TRANSITION_PAYLOAD_BYTES) {
      fail("RESOURCE_LIMIT_EXCEEDED", "transition", "Transition payload exceeds the Investigation Core resource policy.");
    }
    this.previousLogDigest = previousLogDigest;
    this.identifier = transitionIdentifier(
      investigationIdentifier,
      index,
      kind,
      this.payload,
      previousLogDigest,
    );
    Object.freeze(this);
  }
}

function emptyLogDigest(investigationIdentifier) {
  return mipDigest("INVESTIGATION-CORE-LOG-1.0", investigationIdentifier, "[]");
}

function logDigest(investigationIdentifier, transitions) {
  if (transitions.length === 0) return emptyLogDigest(investigationIdentifier);
  return mipDigest(
    "INVESTIGATION-CORE-LOG-1.0",
    investigationIdentifier,
    canonicalize(transitions.map(transitionMaterial)),
  );
}

export class TransitionLog {
  constructor(investigationIdentifier, transitions = []) {
    requireIdentifier(investigationIdentifier, "transitionLog");
    if (!Array.isArray(transitions)) {
      fail("INVALID_TRANSITION", "transitionLog", "TransitionLog transitions must be an array.");
    }
    if (transitions.length > MAX_TRANSITION_COUNT) {
      fail("RESOURCE_LIMIT_EXCEEDED", "transitionLog", "TransitionLog exceeds the Investigation Core resource policy.");
    }
    let priorDigest = emptyLogDigest(investigationIdentifier);
    const accepted = [];
    transitions.forEach((entry, index) => {
      let transition;
      if (entry instanceof Transition) {
        transition = entry;
      } else {
        requireObject(entry, "transitionLog", "Serialized transition");
        const expectedMembers = [
          "identifier",
          "index",
          "investigationIdentifier",
          "kind",
          "payload",
          "previousLogDigest",
          "version",
        ];
        if (canonicalize(Object.keys(entry).sort()) !== canonicalize(expectedMembers)
          || entry.version !== INVESTIGATION_CORE_VERSION) {
          fail("INVALID_TRANSITION", "transitionLog", "A serialized transition must have the exact closed Core shape.", { transitionIndex: index });
        }
        transition = new Transition(entry);
        if (entry.identifier !== transition.identifier) {
          fail("INVALID_TRANSITION", "transitionLog", "A serialized transition identifier does not match its canonical content.", { transitionIndex: index });
        }
      }
      if (transition.investigationIdentifier !== investigationIdentifier
        || transition.index !== index
        || transition.previousLogDigest !== priorDigest) {
        fail("INVALID_TRANSITION", "transitionLog", "The transition chain is not contiguous and digest-bound.", { transitionIndex: index });
      }
      const expectedIdentifier = transitionIdentifier(
        investigationIdentifier,
        index,
        transition.kind,
        transition.payload,
        transition.previousLogDigest,
      );
      if (transition.identifier !== expectedIdentifier) {
        fail("INVALID_TRANSITION", "transitionLog", "A transition identifier does not match its canonical content.", { transitionIndex: index });
      }
      accepted.push(transition);
      priorDigest = logDigest(investigationIdentifier, accepted);
    });
    this.kind = "MemoryOSInvestigationTransitionLog";
    this.version = INVESTIGATION_CORE_VERSION;
    this.investigationIdentifier = investigationIdentifier;
    this.transitions = Object.freeze(accepted);
    this.digest = logDigest(investigationIdentifier, accepted);
    Object.freeze(this);
  }

  append(kind, payload = {}) {
    const transition = new Transition({
      investigationIdentifier: this.investigationIdentifier,
      index: this.transitions.length,
      kind,
      payload,
      previousLogDigest: this.digest,
    });
    return new TransitionLog(this.investigationIdentifier, [...this.transitions, transition]);
  }
}

export class ReplaySession {
  constructor(replay, state, sourceKind) {
    this.kind = "MemoryOSInvestigationReplaySession";
    this.version = INVESTIGATION_CORE_VERSION;
    this.replay = replay;
    this.state = state;
    this.view = replay && state ? projectCoreReplay(replay, state, sourceKind) : null;
    deepFreeze(this);
  }
}

export class ComparisonSession {
  constructor({ evolution = null, reconstruction = null, replayState = null, sourceKind = "native" }) {
    this.kind = "MemoryOSInvestigationComparisonSession";
    this.version = INVESTIGATION_CORE_VERSION;
    this.evolution = evolution;
    this.reconstruction = reconstruction;
    this.replayState = replayState;
    this.view = reconstruction && replayState
      ? projectCoreComparative(reconstruction, replayState, sourceKind)
      : null;
    deepFreeze(this);
  }
}

export class VerificationSession {
  constructor({ investigationIdentifier, transitionLogDigest, lifecycle, checks }) {
    this.kind = "MemoryOSInvestigationVerificationSession";
    this.version = INVESTIGATION_CORE_VERSION;
    this.identifier = mipDigest(
      "INVESTIGATION-CORE-VERIFICATION-1.0",
      investigationIdentifier,
      transitionLogDigest,
      lifecycle,
    );
    this.investigationIdentifier = investigationIdentifier;
    this.transitionLogDigest = transitionLogDigest;
    this.lifecycle = lifecycle;
    this.status = "passed";
    this.checks = checks;
    deepFreeze(this);
  }
}

function stateFingerprint(state) {
  return mipDigest("INVESTIGATION-CORE-STATE-1.0", canonicalize({
    activeReplayIdentifier: state.activeReplay?.identifier ?? null,
    activeTraceIdentifier: state.activeTrace?.identifier ?? null,
    comparativeIdentifier: state.comparativeReconstruction?.identifier ?? null,
    comparativeReplayState: state.comparativeReplayState,
    currentObservationIdentifier: state.currentFrame?.world?.frame?.identifier
      ?? state.currentPackageObservation?.identifier
      ?? null,
    evolutionIdentifier: state.evolution?.identifier ?? null,
    investigationIdentifier: state.investigationIdentifier,
    lifecycle: state.lifecycle,
    observationIdentifiers: state.observationFrames.length > 0
      ? state.observationFrames.map(({ world }) => world.frame.identifier)
      : state.packageObservations.map(({ identifier }) => identifier),
    replayState: state.replayState,
    sourceKind: state.sourceKind,
    supportedExtensions: state.supportedExtensions,
    traceDiagnostic: state.traceDiagnostic,
    workspaceIdentifier: state.workspaceIdentifier,
  }));
}

export class Checkpoint {
  constructor(investigation, state) {
    this.kind = "MemoryOSInvestigationCheckpoint";
    this.version = INVESTIGATION_CORE_VERSION;
    this.investigationIdentifier = investigation.identifier;
    this.workspaceIdentifier = state.workspaceIdentifier;
    this.transitionLog = investigation.transitionLog;
    this.transitionLogDigest = investigation.transitionLog.digest;
    this.transitionCount = investigation.transitionLog.transitions.length;
    this.stateDigest = stateFingerprint(state);
    this.identifier = mipDigest(
      "INVESTIGATION-CORE-CHECKPOINT-1.0",
      this.investigationIdentifier,
      this.transitionLogDigest,
      this.stateDigest,
    );
    Object.freeze(this);
  }
}

export class InvestigationState {
  constructor(value) {
    Object.assign(this, value);
    this.kind = "MemoryOSInvestigationState";
    this.version = INVESTIGATION_CORE_VERSION;
    if (!lifecycleValues.has(this.lifecycle)) {
      fail("INVALID_TRANSITION", "derive", "The transition log did not derive a valid lifecycle state.");
    }
    this.replaySession = this.activeReplay && this.replayState
      ? new ReplaySession(this.activeReplay, this.replayState, this.sourceKind)
      : null;
    this.comparisonSession = this.evolution
      ? new ComparisonSession({
        evolution: this.evolution,
        reconstruction: this.comparativeReconstruction,
        replayState: this.comparativeReplayState,
        sourceKind: this.sourceKind,
      })
      : null;
    deepFreeze(this);
  }
}

export class Investigation {
  constructor(identifier, transitionLog, state) {
    this.kind = "MemoryOSInvestigation";
    this.version = INVESTIGATION_CORE_VERSION;
    this.identifier = identifier;
    this.transitionLog = transitionLog;
    this.state = state;
    Object.freeze(this);
  }
}

function initialMutableState(investigationIdentifier) {
  return {
    investigationIdentifier,
    lifecycle: null,
    workspaceIdentifier: null,
    sourceKind: null,
    package: null,
    packageObservations: [],
    currentPackageObservation: null,
    observationFrames: createObservationTimeline(),
    currentFrame: null,
    activeTrace: null,
    activeReplay: null,
    replayState: null,
    evolutionController: createEvolutionController(0),
    evolution: null,
    evolutionPackageIndex: null,
    comparativeReconstruction: null,
    comparativeReplayState: null,
    comparisonCheckpoint: null,
    verificationSession: null,
    traceDiagnostic: null,
    supportedExtensions: [],
  };
}

function requireCreated(state, transition) {
  if (state.lifecycle === null) return;
  fail("INVALID_TRANSITION", transition.kind, "An investigation may be created exactly once.", { currentState: state.lifecycle });
}

function requireLive(state, operation) {
  if (state.lifecycle === null) {
    fail("INVALID_TRANSITION", operation, "The investigation has not been created.");
  }
  if (state.lifecycle === LifecycleState.Archived) {
    fail("INVALID_TRANSITION", operation, "An archived investigation is immutable.", { currentState: state.lifecycle });
  }
}

function clearActiveInvestigation(state) {
  state.activeTrace = null;
  state.activeReplay = null;
  state.replayState = null;
  state.evolution = null;
  state.evolutionPackageIndex = null;
  state.comparativeReconstruction = null;
  state.comparativeReplayState = null;
  state.comparisonCheckpoint = null;
  state.traceDiagnostic = null;
  state.evolutionController = createEvolutionController(
    state.sourceKind === "native" ? state.observationFrames.length : state.packageObservations.length,
  );
}

function referenceKey(reference) {
  return canonicalize(reference);
}

function createCoreReplayState(replay, sourceKind) {
  if (sourceKind === "native") return createReplayState(replay);
  return deepFreeze({ replayIdentifier: replay.identifier, status: "ready", cursor: -1 });
}

function projectCoreReplay(replay, current, sourceKind) {
  if (sourceKind === "native") return projectReplay(replay, current);
  const visible = current.cursor < 0 ? [] : replay.steps.slice(0, current.cursor + 1);
  const completed = current.status === "completed" ? visible : visible.slice(0, -1);
  const active = current.status !== "completed" && current.cursor >= 0 ? replay.steps[current.cursor] : null;
  const future = replay.steps.slice(current.cursor + 1);
  const nodeKeys = (steps) => steps
    .filter(({ elementType }) => elementType === "node")
    .map(({ node }) => referenceKey(node));
  const relationshipKeys = (steps) => steps
    .filter(({ elementType }) => elementType === "relationship")
    .map(({ relationship }) => referenceKey(relationship));
  return deepFreeze({
    kind: "MemoryOSInvestigationPackageReplayView",
    version: INVESTIGATION_CORE_VERSION,
    identifier: replay.identifier,
    status: current.status,
    cursor: current.cursor,
    total: replay.steps.length,
    completedNodeKeys: nodeKeys(completed),
    completedEdgeKeys: relationshipKeys(completed),
    currentNodeKey: active?.elementType === "node" ? referenceKey(active.node) : null,
    currentEdgeKey: active?.elementType === "relationship" ? referenceKey(active.relationship) : null,
    futureNodeKeys: nodeKeys(future),
    futureEdgeKeys: relationshipKeys(future),
    currentRole: active?.role ?? null,
    currentType: active?.elementType ?? null,
  });
}

function comparativeState(reconstruction, status, cursor, pauseReason = null) {
  return deepFreeze({
    reconstructionIdentifier: reconstruction.identifier,
    status,
    cursor,
    pauseReason,
  });
}

function comparativeStateAt(reconstruction, cursor, otherwise = "paused") {
  if (cursor >= reconstruction.moments.length) {
    return comparativeState(reconstruction, "completed", reconstruction.moments.length - 1);
  }
  const divergent = reconstruction.moments[cursor].state !== "shared";
  return divergent
    ? comparativeState(reconstruction, "paused", cursor, "divergence")
    : comparativeState(reconstruction, otherwise, cursor, otherwise === "paused" ? "engineer" : null);
}

function packageComparativeAction(reconstruction, current, action) {
  if (action === "reset") return comparativeState(reconstruction, "ready", -1);
  if (action === "pause") {
    return current.status === "playing"
      ? comparativeState(reconstruction, "paused", current.cursor, "engineer")
      : current;
  }
  if (action === "play") {
    if (["playing", "completed"].includes(current.status)) return current;
    if (current.status === "ready") {
      return comparativeStateAt(reconstruction, 0, reconstruction.moments.length === 1 ? "completed" : "playing");
    }
    return comparativeState(reconstruction, "playing", current.cursor);
  }
  if (action === "previousStep") {
    return current.cursor <= 0
      ? comparativeState(reconstruction, "ready", -1)
      : comparativeStateAt(reconstruction, current.cursor - 1);
  }
  if (action === "advance" && current.status !== "playing") return current;
  if (current.status === "completed") return current;
  if (current.cursor === reconstruction.moments.length - 1) {
    return comparativeState(reconstruction, "completed", current.cursor);
  }
  return comparativeStateAt(
    reconstruction,
    current.cursor + 1,
    action === "advance" ? "playing" : "paused",
  );
}

function projectCoreComparative(reconstruction, current, sourceKind) {
  if (sourceKind === "native") return projectComparativeReplay(reconstruction, current);
  const currentMoment = current.status === "completed" || current.cursor < 0
    ? null
    : reconstruction.moments[current.cursor];
  return deepFreeze({
    kind: "MemoryOSInvestigationPackageComparativeView",
    version: INVESTIGATION_CORE_VERSION,
    identifier: reconstruction.identifier,
    active: true,
    status: current.status,
    pauseReason: current.pauseReason,
    cursor: current.cursor,
    total: reconstruction.moments.length,
    firstDivergenceIndex: reconstruction.divergenceIndices[0] ?? null,
    divergenceIndices: reconstruction.divergenceIndices,
    divergenceCount: reconstruction.divergenceIndices.length,
    currentMoment,
    atDivergence: currentMoment?.state !== undefined && currentMoment.state !== "shared",
    moments: reconstruction.moments,
  });
}

function selectPackageTrace(state, payload) {
  const traces = state.package?.traces ?? [];
  let trace = null;
  if (nonEmptyText(payload.traceIdentifier)) {
    trace = traces.find(({ identifier }) => identifier === payload.traceIdentifier) ?? null;
  } else if (payload.targetReference !== null && typeof payload.targetReference === "object") {
    const key = referenceKey(payload.targetReference);
    trace = traces.find(({ target }) => referenceKey(target) === key) ?? null;
  } else if (nonEmptyText(payload.targetIdentifier)) {
    trace = traces.find(({ target }) => target.identifier === payload.targetIdentifier) ?? null;
  } else {
    trace = traces.at(-1) ?? null;
  }
  if (!trace) {
    fail("CAPABILITY_UNAVAILABLE", "trace", "The imported package contains no matching source-authored Cognitive Trace.");
  }
  return trace;
}

function prepareReplay(state) {
  if (!state.activeTrace) fail("INVALID_TRANSITION", "replay", "A validated Cognitive Trace is required before Replay.");
  if (state.sourceKind === "native") return buildCognitiveReplay(state.activeTrace);
  const replay = state.package.replays.find(({ traceIdentifier }) => traceIdentifier === state.activeTrace.identifier);
  if (!replay) {
    fail("CAPABILITY_UNAVAILABLE", "replay", "The imported package contains no source-authored Replay for the selected Trace.");
  }
  return replay;
}

function lifecycleForReplayState(replayState) {
  if (replayState.status === "ready") return LifecycleState.ReplayReady;
  if (replayState.status === "completed") return LifecycleState.ReplayComplete;
  return LifecycleState.Replaying;
}

function enterEvolution(state, payload) {
  if (!state.activeReplay || state.replayState?.status !== "completed") {
    fail("INVALID_TRANSITION", "compare", "Replay must complete before deterministic comparison.", { currentState: state.lifecycle });
  }
  const observationCount = state.sourceKind === "native"
    ? state.observationFrames.length
    : state.packageObservations.length;
  if (observationCount < 2) {
    fail("INVALID_TRANSITION", "compare", "At least two accepted observations are required for comparison.");
  }
  state.comparisonCheckpoint = deepFreeze({
    frameIdentifier: state.currentFrame?.world.frame.identifier
      ?? state.currentPackageObservation?.identifier
      ?? null,
    targetNodeKey: state.sourceKind === "native" ? state.activeTrace.targetNodeKey : null,
    traceIdentifier: state.activeTrace.identifier,
    replayState: snapshotReplayState(state.activeReplay, state.replayState),
  });
  if (state.sourceKind === "native") {
    state.evolutionController = compareEvolution(
      createEvolutionController(state.observationFrames.length),
      state.observationFrames.length,
    );
    const pair = evolutionFrames(state.observationFrames, state.evolutionController);
    state.evolution = compareCognitiveEvolution(pair.from, pair.to);
    validateCognitiveEvolution(state.evolution);
  } else {
    const evolutions = state.package.evolutions;
    const index = nonEmptyText(payload.evolutionIdentifier)
      ? evolutions.findIndex(({ identifier }) => identifier === payload.evolutionIdentifier)
      : evolutions.length - 1;
    if (index < 0) {
      fail("CAPABILITY_UNAVAILABLE", "compare", "The imported package contains no source-authored Cognitive Evolution.");
    }
    state.evolutionPackageIndex = index;
    state.evolution = evolutions[index];
  }
  state.activeTrace = null;
  state.activeReplay = null;
  state.replayState = null;
  state.comparativeReconstruction = null;
  state.comparativeReplayState = null;
  state.lifecycle = LifecycleState.ComparisonReady;
}

function moveEvolution(state, direction) {
  if (!state.evolution || state.comparativeReconstruction) {
    fail("INVALID_TRANSITION", "compare", "Observation navigation requires Cognitive Evolution without an active Comparative Reconstruction.");
  }
  if (state.sourceKind === "native") {
    const operation = direction === "previous" ? previousEvolutionObservation : nextEvolutionObservation;
    state.evolutionController = operation(state.evolutionController, state.observationFrames.length);
    const pair = evolutionFrames(state.observationFrames, state.evolutionController);
    state.evolution = compareCognitiveEvolution(pair.from, pair.to);
    validateCognitiveEvolution(state.evolution);
  } else {
    const delta = direction === "previous" ? -1 : 1;
    const next = Math.max(0, Math.min(state.package.evolutions.length - 1, state.evolutionPackageIndex + delta));
    state.evolutionPackageIndex = next;
    state.evolution = state.package.evolutions[next];
  }
  state.lifecycle = LifecycleState.ComparisonReady;
}

function enterComparative(state, payload) {
  if (!state.evolution || state.comparativeReconstruction) {
    fail("INVALID_TRANSITION", "compare", "Cognitive Evolution must be active before Comparative Reconstruction.");
  }
  let reconstruction;
  if (state.sourceKind === "native") {
    const pair = evolutionFrames(state.observationFrames, state.evolutionController);
    const targetNodeKey = payload.targetNodeKey ?? state.comparisonCheckpoint?.targetNodeKey;
    if (!pair || !nonEmptyText(targetNodeKey)) {
      fail("INVALID_INPUT", "compare", "Comparative Reconstruction requires the exact Reflection target shared by both observations.");
    }
    const fromTrace = buildCognitiveTrace(pair.from, targetNodeKey);
    const toTrace = buildCognitiveTrace(pair.to, targetNodeKey);
    reconstruction = buildComparativeReconstruction(pair.from, fromTrace, pair.to, toTrace);
    validateComparativeReconstruction(reconstruction);
  } else {
    const values = state.package.comparativeReconstructions;
    const source = nonEmptyText(payload.comparativeIdentifier)
      ? values.find(({ identifier }) => identifier === payload.comparativeIdentifier)
      : values.find(({ evolutionIdentifier }) => evolutionIdentifier === state.evolution.identifier);
    if (!source) {
      fail("CAPABILITY_UNAVAILABLE", "compare", "The imported package contains no source-authored Comparative Reconstruction for this Evolution.");
    }
    reconstruction = source;
  }
  state.comparativeReconstruction = reconstruction;
  state.comparativeReplayState = state.sourceKind === "native"
    ? createComparativeReplayState(reconstruction)
    : comparativeState(reconstruction, "ready", -1);
  state.lifecycle = LifecycleState.Comparing;
}

function restoreComparisonCheckpoint(state) {
  const checkpoint = state.comparisonCheckpoint;
  if (!checkpoint) fail("CHECKPOINT_MISMATCH", "compare", "Comparison has no deterministic Replay checkpoint to restore.");
  if (state.sourceKind === "native") {
    const frame = state.observationFrames.find(({ world }) => world.frame.identifier === checkpoint.frameIdentifier);
    if (!frame) fail("CHECKPOINT_MISMATCH", "compare", "The checkpoint observation is no longer available.");
    state.currentFrame = state.observationFrames.at(-1) ?? null;
    state.activeTrace = buildCognitiveTrace(frame, checkpoint.targetNodeKey);
  } else {
    state.activeTrace = state.package.traces.find(({ identifier }) => identifier === checkpoint.traceIdentifier) ?? null;
    if (!state.activeTrace) fail("CHECKPOINT_MISMATCH", "compare", "The checkpoint Trace is no longer available.");
  }
  state.activeReplay = prepareReplay(state);
  state.replayState = restoreReplayState(state.activeReplay, checkpoint.replayState);
  state.evolution = null;
  state.evolutionPackageIndex = null;
  state.comparativeReconstruction = null;
  state.comparativeReplayState = null;
  state.comparisonCheckpoint = null;
  state.evolutionController = createEvolutionController(
    state.sourceKind === "native" ? state.observationFrames.length : state.packageObservations.length,
  );
  state.lifecycle = lifecycleForReplayState(state.replayState);
}

function applyTransition(state, transition) {
  const { kind, payload } = transition;
  if (kind === "CREATED") {
    requireCreated(state, transition);
    if (!nonEmptyText(payload.workspaceIdentifier) || !["native", "mip"].includes(payload.sourceKind)) {
      fail("INVALID_TRANSITION", kind, "Creation requires an exact Workspace and supported source kind.");
    }
    state.workspaceIdentifier = payload.workspaceIdentifier;
    state.sourceKind = payload.sourceKind;
    state.lifecycle = LifecycleState.Created;
    return;
  }
  requireLive(state, kind);
  if (kind === "OBSERVED") {
    if (state.sourceKind !== "native") {
      fail("INVALID_TRANSITION", kind, "A MIP-backed investigation cannot accept a native Studio observation.");
    }
    if (payload.snapshot.workspaceIdentifier !== state.workspaceIdentifier) {
      fail("WORKSPACE_MISMATCH", "observe", "The observation crosses the Investigation Workspace boundary.");
    }
    const previousTargetNodeKey = state.activeTrace?.targetNodeKey ?? null;
    let accepted;
    try {
      accepted = appendObservationFrame(state.observationFrames, {
        snapshot: payload.snapshot,
        graph: buildGraph(payload.snapshot),
        operation: payload.operation,
        query: payload.query,
        resultCode: payload.resultCode,
      });
    } catch (error) {
      if (error instanceof InvestigationCoreError) throw error;
      fail("INVALID_INPUT", "observe", error instanceof Error ? error.message : "The observation is invalid.");
    }
    if (accepted.current.snapshot.workspaceIdentifier !== state.workspaceIdentifier) {
      fail("WORKSPACE_MISMATCH", kind, "The observation crosses the Investigation Workspace boundary.");
    }
    state.observationFrames = accepted.frames;
    state.currentFrame = accepted.current;
    clearActiveInvestigation(state);
    if (previousTargetNodeKey) {
      try {
        const target = resolveCognitiveTraceTarget(state.currentFrame.world, previousTargetNodeKey);
        if (!target) throw new TypeError("The prior Reflection is absent from the accepted observation.");
        state.activeTrace = buildCognitiveTrace(state.currentFrame, target.key);
        state.activeReplay = buildCognitiveReplay(state.activeTrace);
        state.replayState = createCoreReplayState(state.activeReplay, state.sourceKind);
        state.lifecycle = LifecycleState.ReplayReady;
      } catch (error) {
        state.traceDiagnostic = deepFreeze({
          code: error?.code ?? "INVALID_TRACE",
          message: error instanceof Error ? error.message : String(error),
          targetNodeKey: previousTargetNodeKey,
        });
        state.lifecycle = LifecycleState.Observed;
      }
    } else {
      state.lifecycle = LifecycleState.Observed;
    }
    return;
  }
  if (kind === "PACKAGE_IMPORTED") {
    if (state.sourceKind !== "mip" || state.package) {
      fail("INVALID_TRANSITION", kind, "A verified MIP may be imported exactly once into a MIP-backed investigation.");
    }
    const extensionOptions = { supportedExtensions: payload.supportedExtensions };
    const verification = verifyMemoryInvestigationPackage(
      serializeMemoryInvestigationPackage(payload.package, extensionOptions),
      extensionOptions,
    );
    if (!verification.valid) fail("VERIFICATION_FAILED", kind, "The stored MIP no longer verifies.");
    if (verification.package.manifest.workspaceIdentifier !== state.workspaceIdentifier) {
      fail("WORKSPACE_MISMATCH", kind, "The imported MIP crosses the Investigation Workspace boundary.");
    }
    state.package = verification.package;
    state.supportedExtensions = deepFreeze([...payload.supportedExtensions]);
    state.packageObservations = verification.package.observations;
    state.currentPackageObservation = verification.package.observations.at(-1) ?? null;
    state.evolutionController = createEvolutionController(state.packageObservations.length);
    state.lifecycle = LifecycleState.Observed;
    return;
  }
  if (kind === "TRACE_SELECTED") {
    if (state.lifecycle === LifecycleState.Comparing || state.lifecycle === LifecycleState.Archived) {
      fail("INVALID_TRANSITION", kind, "Trace selection is unavailable in the current lifecycle state.", { currentState: state.lifecycle });
    }
    if (state.sourceKind === "native") {
      if (!state.currentFrame) fail("INVALID_TRANSITION", kind, "An accepted observation is required before Trace.");
      const target = resolveCognitiveTraceTarget(state.currentFrame.world, payload.selectedNodeKey);
      if (!target) fail("INVALID_INPUT", "trace", "The selected semantic object does not resolve to one exact Reflection.");
      state.activeTrace = buildCognitiveTrace(state.currentFrame, target.key);
    } else {
      state.activeTrace = selectPackageTrace(state, payload);
    }
    state.activeReplay = null;
    state.replayState = null;
    state.evolution = null;
    state.comparativeReconstruction = null;
    state.comparativeReplayState = null;
    state.comparisonCheckpoint = null;
    state.traceDiagnostic = null;
    state.lifecycle = LifecycleState.Traced;
    return;
  }
  if (kind === "REPLAY_PREPARED") {
    if (state.lifecycle !== LifecycleState.Traced) {
      fail("INVALID_TRANSITION", kind, "Replay preparation requires the Traced lifecycle state.", { currentState: state.lifecycle });
    }
    state.activeReplay = prepareReplay(state);
    state.replayState = createCoreReplayState(state.activeReplay, state.sourceKind);
    state.lifecycle = LifecycleState.ReplayReady;
    return;
  }
  if (kind === "REPLAY_ACTION") {
    const operation = replayActions[payload.action];
    if (!operation || !state.activeReplay || !state.replayState || state.evolution) {
      fail("INVALID_TRANSITION", kind, "The Replay command is not valid in the current lifecycle state.", { currentState: state.lifecycle });
    }
    state.replayState = operation(state.activeReplay, state.replayState);
    state.lifecycle = lifecycleForReplayState(state.replayState);
    return;
  }
  if (kind === "EVOLUTION_ENTERED") {
    enterEvolution(state, payload);
    return;
  }
  if (kind === "EVOLUTION_MOVED") {
    moveEvolution(state, payload.direction);
    return;
  }
  if (kind === "COMPARATIVE_ENTERED") {
    enterComparative(state, payload);
    return;
  }
  if (kind === "COMPARATIVE_ACTION") {
    const operation = comparativeActions[payload.action];
    if (!operation || !state.comparativeReconstruction || !state.comparativeReplayState) {
      fail("INVALID_TRANSITION", kind, "The Comparative Replay command is not valid in the current lifecycle state.", { currentState: state.lifecycle });
    }
    state.comparativeReplayState = state.sourceKind === "native"
      ? operation(state.comparativeReconstruction, state.comparativeReplayState)
      : packageComparativeAction(
        state.comparativeReconstruction,
        state.comparativeReplayState,
        payload.action,
      );
    state.lifecycle = LifecycleState.Comparing;
    return;
  }
  if (kind === "COMPARATIVE_LEFT") {
    if (!state.comparativeReconstruction || !state.evolution) {
      fail("INVALID_TRANSITION", kind, "Comparative Reconstruction is not active.");
    }
    state.comparativeReconstruction = null;
    state.comparativeReplayState = null;
    state.lifecycle = LifecycleState.ComparisonReady;
    return;
  }
  if (kind === "EVOLUTION_LEFT") {
    if (!state.evolution || state.comparativeReconstruction) {
      fail("INVALID_TRANSITION", kind, "Cognitive Evolution cannot be left while Comparative Reconstruction is active.");
    }
    restoreComparisonCheckpoint(state);
    return;
  }
  if (kind === "RETURNED_TO_WORLD") {
    clearActiveInvestigation(state);
    state.lifecycle = state.currentFrame || state.currentPackageObservation
      ? LifecycleState.Observed
      : LifecycleState.Created;
    return;
  }
  if (kind === "VERIFIED") {
    state.lifecycle = LifecycleState.Verified;
    return;
  }
  if (kind === "ARCHIVED") {
    state.lifecycle = LifecycleState.Archived;
  }
}

function verificationChecks(state) {
  const checks = [
    { code: "TRANSITION_LOG", status: "passed" },
    { code: "LIFECYCLE", status: "passed" },
  ];
  if (state.sourceKind === "native") {
    if (state.activeTrace) {
      const frame = state.observationFrames.find(({ world }) => world.frame.identifier === state.activeTrace.frameIdentifier);
      const validation = frame ? validateCognitiveTrace(state.activeTrace, frame) : { valid: false };
      if (!validation.valid) fail("VERIFICATION_FAILED", "verify", "The active Cognitive Trace is not derivable from its observation.");
      checks.push({ code: "TRACE", status: "passed" });
    }
    if (state.activeReplay) {
      if (!state.activeTrace
        || canonicalize(buildCognitiveReplay(state.activeTrace)) !== canonicalize(state.activeReplay)) {
        fail("VERIFICATION_FAILED", "verify", "The active Replay is not the exact deterministic projection of its Trace.");
      }
      restoreReplayState(state.activeReplay, state.replayState);
      checks.push({ code: "REPLAY", status: "passed" });
    }
    if (state.evolution) {
      validateCognitiveEvolution(state.evolution);
      checks.push({ code: "EVOLUTION", status: "passed" });
    }
    if (state.comparativeReconstruction) {
      validateComparativeReconstruction(state.comparativeReconstruction);
      projectComparativeReplay(state.comparativeReconstruction, state.comparativeReplayState);
      checks.push({ code: "COMPARATIVE", status: "passed" });
    }
  } else if (state.package) {
    const options = { supportedExtensions: state.supportedExtensions };
    const result = verifyMemoryInvestigationPackage(
      serializeMemoryInvestigationPackage(state.package, options),
      options,
    );
    if (!result.valid) fail("VERIFICATION_FAILED", "verify", "The imported MIP failed deterministic verification.");
    checks.push({ code: "MIP", status: "passed" });
  }
  return deepFreeze(checks);
}

function deriveInvestigation(log) {
  if (!(log instanceof TransitionLog)) fail("INVALID_TRANSITION", "derive", "A TransitionLog is required.");
  const state = initialMutableState(log.investigationIdentifier);
  log.transitions.forEach((transition) => applyTransition(state, transition));
  if (state.lifecycle === null) fail("INVALID_TRANSITION", "derive", "A TransitionLog must begin with creation.");
  if (log.transitions.some(({ kind }) => kind === "VERIFIED")) {
    const lastVerification = [...log.transitions].reverse().find(({ kind }) => kind === "VERIFIED");
    const afterVerification = log.transitions.slice(lastVerification.index + 1);
    const remainsValid = afterVerification.every(({ kind }) => kind === "ARCHIVED");
    if (remainsValid) {
      const verifiedTransitions = log.transitions.slice(0, lastVerification.index + 1);
      const verifiedLog = new TransitionLog(log.investigationIdentifier, verifiedTransitions);
      const verifiedState = initialMutableState(log.investigationIdentifier);
      verifiedTransitions.forEach((transition) => applyTransition(verifiedState, transition));
      state.verificationSession = new VerificationSession({
        investigationIdentifier: log.investigationIdentifier,
        transitionLogDigest: verifiedLog.digest,
        lifecycle: LifecycleState.Verified,
        checks: verificationChecks(verifiedState),
      });
    }
  }
  return new InvestigationState(state);
}

function phaseForState(state) {
  if (state.lifecycle === LifecycleState.Archived) return "archived";
  if (state.comparativeReconstruction) return "compare";
  if (state.evolution) return "evolution";
  if (state.activeTrace && state.replayState
    && (state.replayState.cursor >= 0 || state.replayState.status !== "ready")) return "replay";
  if (state.activeTrace) return "trace";
  return "observe";
}

export function investigationPhase(value) {
  const state = value instanceof Investigation ? value.state : value;
  if (!(state instanceof InvestigationState)) {
    fail("INVALID_INPUT", "phase", "An immutable Investigation or InvestigationState is required.");
  }
  return phaseForState(state);
}

export function investigationAvailability(value) {
  const state = value instanceof Investigation ? value.state : value;
  if (!(state instanceof InvestigationState)) {
    fail("INVALID_INPUT", "availability", "An immutable Investigation or InvestigationState is required.");
  }
  const observationCount = state.sourceKind === "native"
    ? state.observationFrames.length
    : state.packageObservations.length;
  const archived = state.lifecycle === LifecycleState.Archived;
  return deepFreeze({
    trace: !archived && (state.sourceKind === "native"
      ? Boolean(state.currentFrame)
      : state.package?.traces.length > 0),
    replay: !archived && Boolean(state.activeReplay),
    compare: !archived && (Boolean(state.evolution)
      || (state.replayState?.status === "completed" && observationCount >= 2)),
    comparative: !archived && Boolean(state.evolution)
      && (state.sourceKind === "native" || state.package.comparativeReconstructions.length > 0),
    verify: !archived,
    checkpoint: true,
    export: state.sourceKind === "mip" && Boolean(state.package),
  });
}

export function projectInvestigation(value) {
  const investigation = value instanceof Investigation ? value : null;
  const state = investigation?.state ?? value;
  if (!(state instanceof InvestigationState)) {
    fail("INVALID_INPUT", "project", "An immutable Investigation or InvestigationState is required.");
  }
  const comparisonFrames = state.sourceKind === "native" && state.evolution
    ? evolutionFrames(state.observationFrames, state.evolutionController)
    : state.sourceKind === "mip" && state.evolution
      ? {
        from: state.packageObservations.find(({ identifier }) => (
          identifier === state.evolution.fromObservationIdentifier
        )) ?? null,
        to: state.packageObservations.find(({ identifier }) => (
          identifier === state.evolution.toObservationIdentifier
        )) ?? null,
      }
      : null;
  return deepFreeze({
    identifier: investigation?.identifier ?? state.investigationIdentifier,
    lifecycle: state.lifecycle,
    phase: phaseForState(state),
    workspaceIdentifier: state.workspaceIdentifier,
    sourceKind: state.sourceKind,
    observationFrames: state.observationFrames,
    packageObservations: state.packageObservations,
    currentFrame: state.currentFrame,
    currentPackageObservation: state.currentPackageObservation,
    trace: state.activeTrace,
    replay: state.activeReplay,
    replayState: state.replayState,
    replayView: state.replaySession?.view ?? null,
    evolutionController: state.evolutionController,
    evolution: state.evolution,
    comparisonFrames,
    comparativeReconstruction: state.comparativeReconstruction,
    comparativeReplayState: state.comparativeReplayState,
    comparativeView: state.comparisonSession?.view ?? null,
    traceDiagnostic: state.traceDiagnostic,
    verification: state.verificationSession,
    availability: investigationAvailability(state),
  });
}

function investigationIdentifierFor(workspaceIdentifier, sourceIdentifier) {
  return `investigation:${mipDigest(
    "INVESTIGATION-CORE-IDENTIFIER-1.0",
    workspaceIdentifier,
    sourceIdentifier,
  ).slice(7)}`;
}

export class InvestigationCore {
  #logs = new Map();

  #busy = new Set();

  #publish(identifier, log, derivedState = null) {
    const state = derivedState ?? deriveInvestigation(log);
    this.#logs.set(identifier, log);
    return new Investigation(identifier, log, state);
  }

  #commit(identifier, transitions, operation) {
    requireIdentifier(identifier, operation);
    const current = this.#logs.get(identifier);
    if (!current) fail("NOT_FOUND", operation, `Investigation '${identifier}' does not exist.`);
    if (this.#busy.has(identifier)) {
      fail("CORE_BUSY", operation, "The Investigation Core is already committing this investigation.");
    }
    this.#busy.add(identifier);
    try {
      const values = Array.isArray(transitions) ? transitions : [transitions];
      let candidate = current;
      values.forEach(({ kind, payload = {} }) => {
        candidate = candidate.append(kind, payload);
      });
      const state = deriveInvestigation(candidate);
      return this.#publish(identifier, candidate, state);
    } finally {
      this.#busy.delete(identifier);
    }
  }

  create(input = {}) {
    requireObject(input, "create", "Create input");
    const snapshot = input.snapshot === undefined ? null : acceptedStudioSnapshot(input.snapshot, "create");
    const workspaceIdentifier = input.workspaceIdentifier ?? snapshot?.workspaceIdentifier;
    requireIdentifier(workspaceIdentifier, "create", "Workspace identifier");
    const sourceIdentifier = snapshot?.observationIdentifier ?? input.sourceIdentifier ?? "created";
    const identifier = input.identifier ?? investigationIdentifierFor(workspaceIdentifier, sourceIdentifier);
    requireIdentifier(identifier, "create");
    if (this.#logs.has(identifier)) fail("DUPLICATE_IDENTIFIER", "create", `Investigation '${identifier}' already exists.`);
    let log = new TransitionLog(identifier).append("CREATED", {
      sourceKind: "native",
      workspaceIdentifier,
    });
    if (snapshot) {
      log = log.append("OBSERVED", {
        operation: input.operation ?? "InitialObservation",
        query: input.query ?? null,
        resultCode: input.resultCode ?? "OK",
        snapshot,
      });
    }
    return this.#publish(identifier, log);
  }

  load(identifier) {
    requireIdentifier(identifier, "load");
    const log = this.#logs.get(identifier);
    if (!log) fail("NOT_FOUND", "load", `Investigation '${identifier}' does not exist.`);
    return new Investigation(identifier, log, deriveInvestigation(log));
  }

  observe(identifier, input) {
    requireObject(input, "observe", "Observation input");
    const snapshot = acceptedStudioSnapshot(input.snapshot, "observe");
    return this.#commit(identifier, {
      kind: "OBSERVED",
      payload: {
        operation: input.operation ?? "Observe",
        query: input.query ?? null,
        resultCode: input.resultCode ?? "OK",
        snapshot,
      },
    }, "observe");
  }

  trace(identifier, selection) {
    const current = this.load(identifier);
    const payload = current.state.sourceKind === "native"
      ? { selectedNodeKey: typeof selection === "string" ? selection : selection?.selectedNodeKey ?? null }
      : {
        targetIdentifier: selection?.targetIdentifier ?? null,
        targetReference: selection?.targetReference ?? null,
        traceIdentifier: typeof selection === "string" ? selection : selection?.traceIdentifier ?? null,
      };
    return this.#commit(identifier, [
      { kind: "TRACE_SELECTED", payload },
      { kind: "REPLAY_PREPARED", payload: {} },
    ], "trace");
  }

  replay(identifier, action) {
    if (!Object.hasOwn(replayActions, action)) {
      fail("INVALID_COMMAND", "replay", `Unknown Replay action '${String(action)}'.`);
    }
    const current = this.load(identifier);
    if (!current.state.activeReplay || !current.state.replayState) {
      fail("INVALID_TRANSITION", "replay", "Replay is not prepared.", { currentState: current.state.lifecycle });
    }
    const next = replayActions[action](current.state.activeReplay, current.state.replayState);
    if (next === current.state.replayState
      || canonicalize(next) === canonicalize(current.state.replayState)) return current;
    return this.#commit(identifier, { kind: "REPLAY_ACTION", payload: { action } }, "replay");
  }

  compare(identifier, command) {
    const input = typeof command === "string" ? { action: command } : command;
    requireObject(input, "compare", "Compare command");
    if (!comparisonActions.has(input.action)) {
      fail("INVALID_COMMAND", "compare", `Unknown Compare action '${String(input.action)}'.`);
    }
    const state = this.load(identifier).state;
    if (input.action === "enter") {
      return this.#commit(identifier, {
        kind: "EVOLUTION_ENTERED",
        payload: { evolutionIdentifier: input.evolutionIdentifier ?? null },
      }, "compare");
    }
    if (["previous", "next"].includes(input.action)) {
      const canMove = state.sourceKind === "native"
        ? (input.action === "previous"
          ? state.evolutionController.canGoPrevious
          : state.evolutionController.canGoNext)
        : (input.action === "previous"
          ? state.evolutionPackageIndex > 0
          : state.evolutionPackageIndex < state.package.evolutions.length - 1);
      if (!canMove) return this.load(identifier);
      return this.#commit(identifier, {
        kind: "EVOLUTION_MOVED",
        payload: { direction: input.action },
      }, "compare");
    }
    if (input.action === "start") {
      return this.#commit(identifier, {
        kind: "COMPARATIVE_ENTERED",
        payload: {
          comparativeIdentifier: input.comparativeIdentifier ?? null,
          targetNodeKey: input.targetNodeKey ?? null,
        },
      }, "compare");
    }
    if (input.action === "back") {
      return this.#commit(identifier, {
        kind: state.comparativeReconstruction ? "COMPARATIVE_LEFT" : "EVOLUTION_LEFT",
        payload: {},
      }, "compare");
    }
    if (!state.comparativeReconstruction || !state.comparativeReplayState) {
      fail("INVALID_TRANSITION", "compare", "Comparative Reconstruction is not active.");
    }
    const operation = comparativeActions[input.action];
    const next = state.sourceKind === "native"
      ? operation(state.comparativeReconstruction, state.comparativeReplayState)
      : packageComparativeAction(
        state.comparativeReconstruction,
        state.comparativeReplayState,
        input.action,
      );
    if (next === state.comparativeReplayState
      || canonicalize(next) === canonicalize(state.comparativeReplayState)) return this.load(identifier);
    return this.#commit(identifier, {
      kind: "COMPARATIVE_ACTION",
      payload: { action: input.action },
    }, "compare");
  }

  checkpoint(identifier) {
    const investigation = this.load(identifier);
    return new Checkpoint(investigation, investigation.state);
  }

  restore(checkpoint) {
    if (!(checkpoint instanceof Checkpoint)
      || !(checkpoint.transitionLog instanceof TransitionLog)
      || checkpoint.transitionLog.digest !== checkpoint.transitionLogDigest
      || checkpoint.transitionLog.transitions.length !== checkpoint.transitionCount) {
      fail("CHECKPOINT_MISMATCH", "restore", "The checkpoint is not bound to an intact authoritative TransitionLog.");
    }
    const state = deriveInvestigation(checkpoint.transitionLog);
    if (state.workspaceIdentifier !== checkpoint.workspaceIdentifier
      || stateFingerprint(state) !== checkpoint.stateDigest) {
      fail("CHECKPOINT_MISMATCH", "restore", "The checkpoint cache does not match the state derived from its TransitionLog.");
    }
    const existing = this.#logs.get(checkpoint.investigationIdentifier);
    if (existing && existing.digest !== checkpoint.transitionLogDigest) {
      fail("CHECKPOINT_MISMATCH", "restore", "Restoration would replace a different authoritative TransitionLog.");
    }
    this.#logs.set(checkpoint.investigationIdentifier, checkpoint.transitionLog);
    return new Investigation(checkpoint.investigationIdentifier, checkpoint.transitionLog, state);
  }

  verify(identifier) {
    const investigation = this.load(identifier);
    verificationChecks(investigation.state);
    return this.#commit(identifier, { kind: "VERIFIED", payload: {} }, "verify");
  }

  archive(identifier) {
    return this.#commit(identifier, { kind: "ARCHIVED", payload: {} }, "archive");
  }

  export(identifier, options = {}) {
    const investigation = this.load(identifier);
    if (!investigation.state.package) {
      fail(
        "CAPABILITY_UNAVAILABLE",
        "export",
        "MIP export requires a verified MIP-backed investigation; the Core never invents a Studio-to-MIP translation.",
      );
    }
    return serializeMemoryInvestigationPackage(investigation.state.package, {
      ...options,
      supportedExtensions: options.supportedExtensions ?? investigation.state.supportedExtensions,
    });
  }

  import(input, options = {}) {
    const source = input?.bytes ?? input;
    const packageValue = importMemoryInvestigationPackage(source, options);
    const identifier = options.identifier ?? investigationIdentifierFor(
      packageValue.manifest.workspaceIdentifier,
      packageValue.manifest.packageIdentifier,
    );
    if (this.#logs.has(identifier)) fail("DUPLICATE_IDENTIFIER", "import", `Investigation '${identifier}' already exists.`);
    const supportedExtensions = [...(options.supportedExtensions ?? [])].sort();
    let log = new TransitionLog(identifier).append("CREATED", {
      sourceKind: "mip",
      workspaceIdentifier: packageValue.manifest.workspaceIdentifier,
    });
    log = log.append("PACKAGE_IMPORTED", { package: packageValue, supportedExtensions });
    return this.#publish(identifier, log);
  }

  returnToWorld(identifier) {
    const current = this.load(identifier);
    if (investigationPhase(current) === "observe") return current;
    return this.#commit(identifier, { kind: "RETURNED_TO_WORLD", payload: {} }, "returnToWorld");
  }
}
