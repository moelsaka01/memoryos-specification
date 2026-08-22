import { resolveSnapshot, scopeDefinitions } from "../data/studio-snapshot.js";
import {
  buildGraph,
  cloneDetached,
  findObservation,
  resolveInspectionDetails,
  scopeForRoute,
} from "./studio-model.js";
import { renderGraph } from "./graph.js";
import {
  createGraphViewState,
  reconcileGraphViewState,
  selectGraphNode,
} from "./graph-view-state.js";
import { resolveCommandAdapter } from "./host-adapter.js";
import {
  appendObservationFrame,
  createObservationTimeline,
} from "./observation-timeline.js";
import {
  buildCognitiveTrace,
  createCognitiveTraceQuery,
  queryCognitiveTrace,
} from "./cognitive-trace.js";
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
} from "./cognitive-replay.js";
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
  reconcileEvolutionController,
} from "./cognitive-evolution-controller.js";
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

let snapshot = cloneDetached(resolveSnapshot());
let observationTimeline = createObservationTimeline();
const initialObservation = appendObservationFrame(observationTimeline, {
  snapshot,
  graph: buildGraph(snapshot),
  operation: "InitialObservation",
  resultCode: "OK",
});
observationTimeline = initialObservation.frames;
let currentFrame = initialObservation.current;
let commandAdapter = null;
let operationSequence = 0;
let replayTimer = null;
let comparativeReplayTimer = null;
let graphController = null;
const replayStepDelay = 1250;

const routeMetadata = Object.freeze({
  complete: ["MemoryOS Mission Control", "Observe the complete MemoryOS cognitive system as one deterministic semantic world."],
  memory: ["Memory Foundation", "Follow canonical Memory Domain values within the same cognitive topology."],
  working: ["Working Memory", "Observe temporary task context, activation, and explicit expiration."],
  consolidation: ["Memory Consolidation", "Follow Working Memory as it is promoted into retained knowledge."],
  "long-term": ["Long-Term Memory", "Inspect authoritative retained evidence and durable identity."],
  semantic: ["Semantic Knowledge", "Explore concepts, classifications, relationships, and source evidence."],
  episodic: ["Episodic Knowledge", "Explore experiences in deterministic logical chronology."],
  procedural: ["Procedural Knowledge", "Explore reusable procedures, ordered steps, and provenance."],
  retrieval: ["Memory Retrieval", "Inspect deterministic candidates and their explicit knowledge-source paths."],
  reflection: ["Memory Reflection", "Inspect derived knowledge and every contributing evidence path."],
  providers: ["Memory Providers", "Observe provider-neutral transport without provider implementation state."],
  provenance: ["Workspace Provenance", "Trace explicit evidence paths without inferred relationships."],
  validation: ["Validation State", "Observe Workspace, ordering, provenance, and boundary checks."],
});

const routeByFamily = Object.freeze({
  Memory: "memory",
  "Memory entry": "memory",
  "Memory aggregate": "memory",
  WorkingMemory: "working",
  "Working Memory entry": "working",
  "Working task": "working",
  "WorkingMemory aggregate": "working",
  "Consolidation aggregate": "consolidation",
  "Consolidation session": "consolidation",
  LongTermMemory: "long-term",
  "Long-Term Memory entry": "long-term",
  "LongTermMemory aggregate": "long-term",
  "Provenance snapshot": "provenance",
  SemanticMemory: "semantic",
  "Semantic concept": "semantic",
  "Semantic category": "semantic",
  "SemanticMemory aggregate": "semantic",
  EpisodicMemory: "episodic",
  Episode: "episodic",
  "EpisodicMemory aggregate": "episodic",
  ProceduralMemory: "procedural",
  Procedure: "procedural",
  "Procedure step": "procedural",
  "ProceduralMemory aggregate": "procedural",
  "Retrieval aggregate": "retrieval",
  "Retrieval session": "retrieval",
  "Retrieval candidate": "retrieval",
  Reflection: "reflection",
  "Reflection source": "reflection",
  "Reflection session": "reflection",
  "Reflection session source": "reflection",
  "Reflection aggregate": "reflection",
  "Providers aggregate": "providers",
  "Provider session": "providers",
  "Provider descriptor": "providers",
  "Validation aggregate": "validation",
  "Validation check": "validation",
  Workspace: "complete",
});

const traceableFamilies = new Set([
  "LongTermMemory",
  "Long-Term Memory entry",
  "SemanticMemory",
  "Semantic concept",
  "EpisodicMemory",
  "Episode",
  "ProceduralMemory",
  "Procedure",
  "Retrieval candidate",
  "Reflection",
]);

const perspectiveKindByRoute = Object.freeze({
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
  provenance: "provenance",
  validation: "validation",
});

const elements = {
  shell: document.querySelector(".studio-shell"),
  root: document.querySelector("#view-root"),
  pageTitle: document.querySelector("#page-title"),
  pageDescription: document.querySelector("#page-description"),
  breadcrumb: document.querySelector("#breadcrumb-scope"),
  queryScope: document.querySelector("#query-scope"),
  queryIdentifier: document.querySelector("#query-identifier"),
  globalQuery: document.querySelector("#global-query"),
  inspector: document.querySelector("#studio-inspector"),
  inspectorTitle: document.querySelector("#inspector-title"),
  inspectorContent: document.querySelector("#inspector-content"),
  sidebar: document.querySelector("#scope-nav"),
  backdrop: document.querySelector("#nav-backdrop"),
  menuToggle: document.querySelector("#menu-toggle"),
  forgetDialog: document.querySelector("#forget-dialog"),
  toastRegion: document.querySelector("#toast-region"),
};

const state = {
  route: normalizeRoute(location.hash.slice(1)),
  sessionState: snapshot.session?.state ?? "Open",
  selectedIdentifier: null,
  graphSelection: null,
  graphViewState: createGraphViewState(),
  pendingActivity: null,
  activeTrace: null,
  activeReplay: null,
  replayState: null,
  evolutionController: createEvolutionController(observationTimeline.length),
  evolutionSelection: null,
  comparativeActive: false,
  comparativeTargetKey: null,
  comparativeReconstruction: null,
  comparativeReplayState: null,
  comparativeDiagnostic: null,
  traceDiagnostic: null,
  lastOperation: null,
  busy: false,
};

function clearReplayTimer() {
  if (replayTimer !== null) window.clearTimeout(replayTimer);
  replayTimer = null;
}

function clearReplay() {
  clearReplayTimer();
  state.activeReplay = null;
  state.replayState = null;
}

function synchronizeReplayWithTrace() {
  if (!state.activeTrace) {
    clearReplay();
    return;
  }
  if (state.activeReplay?.traceIdentifier === state.activeTrace.identifier) return;
  clearReplayTimer();
  state.activeReplay = buildCognitiveReplay(state.activeTrace);
  state.replayState = createReplayState(state.activeReplay);
}

function updateReplay(action) {
  if (!state.activeReplay || !state.replayState) return;
  clearReplayTimer();
  const operations = {
    play: playReplay,
    pause: pauseReplay,
    restart: restartReplay,
    previous: previousReplayStep,
    next: nextReplayStep,
  };
  const operation = operations[action];
  if (!operation) return;
  state.replayState = operation(state.activeReplay, state.replayState);
  if (!refreshReplayPresentation()) renderRoute();
  scheduleReplay();
}

function scheduleReplay() {
  clearReplayTimer();
  if (!state.activeReplay || state.replayState?.status !== "playing") return;
  const replayIdentifier = state.activeReplay.identifier;
  replayTimer = window.setTimeout(() => {
    replayTimer = null;
    if (state.activeReplay?.identifier !== replayIdentifier || state.replayState?.status !== "playing") return;
    state.replayState = advanceReplay(state.activeReplay, state.replayState);
    if (!refreshReplayPresentation()) renderRoute();
    scheduleReplay();
  }, replayStepDelay);
}

function clearComparativeReplayTimer() {
  if (comparativeReplayTimer !== null) window.clearTimeout(comparativeReplayTimer);
  comparativeReplayTimer = null;
}

function clearComparativeReconstruction(resetTarget = true) {
  clearComparativeReplayTimer();
  state.comparativeReconstruction = null;
  state.comparativeReplayState = null;
  state.comparativeDiagnostic = null;
  if (resetTarget) {
    state.comparativeActive = false;
    state.comparativeTargetKey = null;
  }
}

function comparableReflectionTarget(pair) {
  const toKeys = new Set(pair.to.world.nodes
    .filter((node) => !node.aggregate && node.kind === "reflection" && node.family === "Reflection")
    .map(({ key }) => key));
  if (state.comparativeTargetKey && toKeys.has(state.comparativeTargetKey)
    && pair.from.world.nodes.some(({ key }) => key === state.comparativeTargetKey)) {
    return state.comparativeTargetKey;
  }
  return pair.from.world.nodes.find((node) => (
    !node.aggregate && node.kind === "reflection" && node.family === "Reflection" && toKeys.has(node.key)
  ))?.key ?? null;
}

function synchronizeComparativeReconstruction(evolution) {
  if (!evolution || !state.evolutionController.active) {
    clearComparativeReconstruction();
    return null;
  }
  if (!state.comparativeActive) {
    clearComparativeReconstruction(false);
    return null;
  }
  const pair = evolutionFrames(observationTimeline, state.evolutionController);
  const targetNodeKey = pair ? comparableReflectionTarget(pair) : null;
  if (!pair || !targetNodeKey) {
    clearComparativeReconstruction(false);
    state.comparativeDiagnostic = "Both observations require the same exact Reflection identity for synchronized reconstruction.";
    return null;
  }
  try {
    const fromTrace = buildCognitiveTrace(pair.from, targetNodeKey);
    const toTrace = buildCognitiveTrace(pair.to, targetNodeKey);
    const reconstruction = buildComparativeReconstruction(pair.from, fromTrace, pair.to, toTrace);
    validateComparativeReconstruction(reconstruction);
    state.comparativeTargetKey = targetNodeKey;
    state.comparativeDiagnostic = null;
    if (state.comparativeReconstruction?.identifier !== reconstruction.identifier) {
      clearComparativeReplayTimer();
      state.comparativeReconstruction = reconstruction;
      state.comparativeReplayState = createComparativeReplayState(reconstruction);
    }
    return state.comparativeReconstruction;
  } catch (error) {
    clearComparativeReconstruction(false);
    state.comparativeDiagnostic = error instanceof Error ? error.message : String(error);
    return null;
  }
}

function activateComparativeReconstruction() {
  const evolution = currentEvolution();
  const pair = evolution ? evolutionFrames(observationTimeline, state.evolutionController) : null;
  const targetNodeKey = pair ? comparableReflectionTarget(pair) : null;
  if (!evolution || !pair || !targetNodeKey) {
    state.comparativeDiagnostic = "Both observations require the same exact Reflection identity for synchronized reconstruction.";
    renderGraphContext();
    return;
  }
  state.comparativeTargetKey = targetNodeKey;
  state.comparativeActive = true;
  renderRoute();
}

function updateComparativeReplay(action) {
  if (action === "compare") {
    state.comparativeActive = false;
    clearComparativeReconstruction(false);
    renderRoute();
    return;
  }
  const reconstruction = state.comparativeReconstruction;
  if (!reconstruction || !state.comparativeReplayState) return;
  clearComparativeReplayTimer();
  const operations = {
    play: playComparativeReplay,
    pause: pauseComparativeReplay,
    previous: previousComparativeStep,
    next: nextComparativeStep,
    reset: resetComparativeReplay,
  };
  const operation = operations[action];
  if (!operation) return;
  state.comparativeReplayState = operation(reconstruction, state.comparativeReplayState);
  if (!refreshComparativePresentation()) renderRoute();
  scheduleComparativeReplay();
}

function scheduleComparativeReplay() {
  clearComparativeReplayTimer();
  if (!state.comparativeReconstruction || state.comparativeReplayState?.status !== "playing") return;
  const reconstructionIdentifier = state.comparativeReconstruction.identifier;
  comparativeReplayTimer = window.setTimeout(() => {
    comparativeReplayTimer = null;
    if (state.comparativeReconstruction?.identifier !== reconstructionIdentifier
      || state.comparativeReplayState?.status !== "playing") return;
    state.comparativeReplayState = advanceComparativeReplay(
      state.comparativeReconstruction,
      state.comparativeReplayState,
    );
    if (!refreshComparativePresentation()) renderRoute();
    scheduleComparativeReplay();
  }, replayStepDelay);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeRoute(route) {
  return Object.hasOwn(routeMetadata, route) ? route : "complete";
}

function stateClass(value) {
  if (["Observed", "Started", "Retained", "Derived", "Exported", "Passed", "Active"].includes(value)) return "success";
  if (["Analyzed", "Promoted", "Prepared"].includes(value)) return "warning";
  return "neutral";
}

function status(value) {
  return `<span class="status-chip ${stateClass(value)}"><span class="status-dot" aria-hidden="true"></span>${escapeHtml(value)}</span>`;
}

function graphIdentity(world, frame, route, activeTrace = null, replayState = null, evolution = null, comparativeView = null) {
  const [title] = routeMetadata[route];
  const observation = route === "complete" ? "Complete cognitive system" : `${title} perspective`;
  const replayLabels = { ready: "Replay ready", playing: "Constructing", paused: "Replay paused", completed: "Replay complete" };
  const comparativeLabels = {
    ready: "Synchronized",
    playing: "Reconstructing together",
    paused: comparativeView?.atDivergence ? "Paused at divergence" : "Reconstruction paused",
    completed: "Comparison complete",
  };
  return `<header class="neural-graph-identity" aria-labelledby="memory-intelligence-graph-title">
    <span class="graph-identity-mark" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="graph-identity-copy">
      <small>${comparativeView ? "Living Connectome · Comparative reconstruction" : activeTrace ? "Living Connectome · Cognitive reconstruction" : evolution ? "Living Connectome · Cognitive evolution" : `Mission Control · ${escapeHtml(observation)}`}</small>
      <strong id="memory-intelligence-graph-title">${comparativeView ? "Where cognition diverged" : activeTrace ? "Evidence becomes Reflection" : evolution ? "What changed?" : escapeHtml(world.identity)}</strong>
    </span>
    <span class="graph-live-state"><i aria-hidden="true"></i>${comparativeView ? comparativeLabels[comparativeView.status] ?? "Comparative Reconstruction" : activeTrace ? replayLabels[replayState?.status] ?? "Cognitive Trace" : evolution ? `Observation ${evolution.from.sequence + 1} → ${evolution.to.sequence + 1}` : `Observed frame ${escapeHtml(frame.sequence + 1)}`}</span>
  </header>`;
}

const traceStages = Object.freeze([
  ["origin-evidence", "Evidence"],
  ["semantic-transformation", "Transformation"],
  ["retrieval", "Retrieval"],
  ["reflection-current", "Reflection"],
]);

function traceSignals(trace, replayView) {
  const orderedSteps = trace.branches.flatMap((branch) => branch.steps);
  const completedRoles = new Set();
  if (replayView?.status === "completed") traceStages.forEach(([role]) => completedRoles.add(role));
  else if (replayView) {
    const replaySteps = state.activeReplay?.steps ?? [];
    replaySteps.slice(0, replayView.cursor + 1).forEach(({ role }) => completedRoles.add(role));
  }
  const currentRole = replayView?.status === "completed"
    ? "reflection-current"
    : state.activeReplay?.steps[replayView?.cursor]?.role ?? (replayView?.status === "ready" ? "origin-evidence" : null);
  const stageMarkup = traceStages.map(([role, label], index) => {
    const nodeCount = new Set(orderedSteps.filter((step) => step.role === role).map(({ nodeKey }) => nodeKey)).size;
    const classes = [completedRoles.has(role) ? "is-complete" : "", currentRole === role ? "is-current" : ""].filter(Boolean).join(" ");
    return `<span class="investigation-stage ${classes}" data-investigation-role="${role}"><i aria-hidden="true">${index + 1}</i><span><small>${escapeHtml(label)}</small><strong>${nodeCount || 1} ${nodeCount === 1 || nodeCount === 0 ? "element" : "elements"}</strong></span></span>`;
  }).join('<b aria-hidden="true">&rarr;</b>');
  const progress = replayView?.status === "completed"
    ? "Reconstruction complete"
    : replayView?.cursor >= 0
      ? `Step ${replayView.cursor + 1} of ${replayView.total}`
      : `${trace.branches.length} evidence branches ready`;
  return `<div class="neural-signal-ribbon trace-signal-ribbon" aria-label="Active cognitive investigation">
    <div class="investigation-stages">${stageMarkup}</div>
    <output class="investigation-progress" aria-live="polite">${escapeHtml(progress)}</output>
  </div>`;
}

function replayElementLabel(step) {
  if (!step || !currentFrame) return null;
  if (step.type === "node") return currentFrame.world.nodes.find(({ key }) => key === step.nodeKey)?.label ?? step.role;
  const edge = currentFrame.world.edges.find(({ key }) => key === step.edgeKey);
  if (!edge) return step.role;
  const from = currentFrame.world.nodes.find(({ key }) => key === edge.from)?.label ?? "Evidence";
  const to = currentFrame.world.nodes.find(({ key }) => key === edge.to)?.label ?? "Knowledge";
  return `${from} → ${to}`;
}

function investigationContextView() {
  const target = currentFrame?.world.nodes.find(({ key }) => key === state.activeTrace?.targetNodeKey);
  const targetObservation = target ? observationsForWorldNode(target)[0]?.value : null;
  const replayView = state.activeReplay && state.replayState ? projectReplay(state.activeReplay, state.replayState) : null;
  const currentStep = state.activeReplay?.steps[replayView?.cursor] ?? null;
  const roleLabel = traceStages.find(([role]) => role === currentStep?.role)?.[1] ?? "Origin evidence";
  const currentLabel = replayView?.status === "completed"
    ? "Reflection reconstructed"
    : replayElementLabel(currentStep) ?? "Evidence paths are ready";
  return `<section class="investigation-context">
    <header><div><span class="eyebrow">Cognitive investigation</span><h2>${escapeHtml(targetObservation?.knowledge ?? target?.label ?? "Reflection")}</h2></div><button class="return-to-world" type="button" data-graph-clear aria-label="Return to semantic world">Return to world</button></header>
    <div class="investigation-current" data-replay-status="${escapeHtml(replayView?.status ?? "ready")}"><span aria-hidden="true"></span><div><small>${escapeHtml(roleLabel)}</small><strong>${escapeHtml(currentLabel)}</strong></div></div>
    <footer><span>${state.activeTrace.branches.length} evidence branches</span><span>${state.activeReplay.steps.length} observed elements</span><span>No inferred steps</span></footer>
  </section>`;
}

function neuralSignals(route) {
  const retrievalCandidates = snapshot.retrievalSessions.reduce((sum, session) => sum + session.candidates.length, 0);
  const evidenceLinks = snapshot.semanticMemory.concepts.reduce((sum, value) => sum + value.sourceEntries.length, 0)
    + snapshot.episodicMemory.episodes.reduce((sum, value) => sum + value.sourceEntries.length, 0)
    + snapshot.proceduralMemory.procedures.reduce((sum, value) => sum + value.sourceEntries.length, 0)
    + snapshot.reflections.reduce((sum, value) => sum + value.sources.length, 0);
  const passed = snapshot.validation.filter(({ state: value }) => value === "Passed").length;
  const signalsByRoute = {
    complete: [["Working", snapshot.workingMemory.entries.length], ["Retained", snapshot.longTermMemory.entries.length], ["Derived", snapshot.semanticMemory.concepts.length + snapshot.episodicMemory.episodes.length + snapshot.proceduralMemory.procedures.length], ["Evidence", evidenceLinks], ["Integrity", `${passed}/${snapshot.validation.length}`]],
    memory: [["Foundation entries", snapshot.memory.entries.length], ["Workspace", "Preserved"], ["Order", "Canonical"]],
    working: [["Active context", snapshot.workingMemory.entries.length], ["Task", snapshot.workingMemory.active ? "Active" : "Inactive"], ["Expiring", snapshot.workingMemory.entries.filter(({ expirationPoint }) => expirationPoint !== null).length]],
    consolidation: [["Sessions", snapshot.consolidationSessions.length], ["Retained", snapshot.consolidationSessions.filter(({ state: value }) => value === "Retained").length], ["Publication", "Atomic"]],
    "long-term": [["Evidence", snapshot.longTermMemory.entries.length], ["Archived", snapshot.longTermMemory.entries.filter(({ archived }) => archived).length], ["Identity", "Durable"]],
    semantic: [["Concepts", snapshot.semanticMemory.concepts.length], ["Source links", snapshot.semanticMemory.concepts.reduce((sum, value) => sum + value.sourceEntries.length, 0)], ["Identity", "Preserved"]],
    episodic: [["Episodes", snapshot.episodicMemory.episodes.length], ["Chronology", "Deterministic"], ["Source links", snapshot.episodicMemory.episodes.reduce((sum, value) => sum + value.sourceEntries.length, 0)]],
    procedural: [["Procedures", snapshot.proceduralMemory.procedures.length], ["Ordered steps", snapshot.proceduralMemory.procedures.reduce((sum, value) => sum + value.steps.length, 0)], ["Source links", snapshot.proceduralMemory.procedures.reduce((sum, value) => sum + value.sourceEntries.length, 0)]],
    retrieval: [["Sessions", snapshot.retrievalSessions.length], ["Candidates", retrievalCandidates], ["Ordering", "Ranked"]],
    reflection: [["Insights", snapshot.reflections.length], ["Converging sources", snapshot.reflections.reduce((sum, value) => sum + value.sources.length, 0)], ["Evidence", "Intact"]],
    providers: [["Sessions", snapshot.providerSessions.length], ["Descriptors", snapshot.providerSessions.reduce((sum, value) => sum + value.descriptors.length, 0)], ["Semantics", "Neutral"]],
    provenance: [["Evidence links", evidenceLinks], ["Source identity", "Preserved"], ["Workspace", "Isolated"]],
    validation: [["Checks", snapshot.validation.length], ["Passed", passed], ["Boundary", "Verified"]],
  };
  return `<div class="neural-signal-ribbon" aria-label="Observed product signals">${signalsByRoute[route].map(([label, value]) => `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`).join("")}</div>`;
}

function evolutionSignals(evolution) {
  const count = (name) => evolution.summary[name] ?? 0;
  const added = count("addedEvidence") + count("addedSemanticTransformations")
    + count("addedRetrievals") + count("addedReflections") + count("addedRelationships");
  const removed = count("removedEvidence") + count("removedSemanticTransformations")
    + count("removedRetrievals") + count("removedReflections") + count("removedRelationships");
  const values = [
    ["Added cognition", added],
    ["Removed cognition", removed],
    ["Modified relationships", count("modifiedRelationships")],
    ["Stable cognition", evolution.unchanged.nodeKeys.length],
    ["Stable relationships", evolution.unchanged.relationshipKeys.length],
  ];
  return `<div class="neural-signal-ribbon evolution-signal-ribbon" aria-label="Cognitive Evolution summary">${values.map(([label, value]) => `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`).join("")}</div>`;
}

function comparativeSignals(reconstruction, view) {
  const values = [
    ["Shared steps", reconstruction.summary.shared],
    ["Divergences", reconstruction.summary.divergent],
    ["Observation A only", reconstruction.summary.aOnly],
    ["Observation B only", reconstruction.summary.bOnly],
    ["Modified", reconstruction.summary.modified],
  ];
  const position = view.status === "completed"
    ? "Complete"
    : view.cursor < 0 ? "Ready" : `${view.cursor + 1} / ${view.total}`;
  return `<div class="neural-signal-ribbon comparative-signal-ribbon" aria-label="Comparative Reconstruction summary">${values.map(([label, value]) => `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`).join("")}<span class="comparative-signal-position"><small>Position</small><strong>${escapeHtml(position)}</strong></span></div>`;
}

function comparativeElementLabel(step, reconstruction) {
  if (!step) return "No matching semantic step";
  if (step.elementType === "node") {
    return reconstruction.world.nodes.find(({ key }) => key === step.key)?.label ?? step.key;
  }
  const edge = reconstruction.world.edges.find(({ key }) => key === step.key);
  if (!edge) return step.key;
  const from = reconstruction.world.nodes.find(({ key }) => key === edge.from)?.label ?? edge.from;
  const to = reconstruction.world.nodes.find(({ key }) => key === edge.to)?.label ?? edge.to;
  return `${from} ${edge.relation} ${to}`;
}

function comparativeContextView(reconstruction, view) {
  const current = view.currentMoment;
  const first = reconstruction.firstDivergenceIndex === null
    ? null
    : reconstruction.moments[reconstruction.firstDivergenceIndex];
  const roleLabels = {
    "origin-evidence": "Evidence",
    "semantic-transformation": "Semantic transformation",
    retrieval: "Retrieval",
    "reflection-current": "Reflection",
  };
  if (!current) {
    const completed = view.status === "completed";
    const heading = reconstruction.summary.divergent === 0
      ? "Investigations are semantically identical"
      : completed ? "Comparative reconstruction complete" : "Two investigations synchronized";
    const firstLabel = first ? `${roleLabels[first.role] ?? first.elementType} at step ${first.index + 1}` : "No divergence";
    return `<section class="comparative-context ${completed ? "is-completed" : "is-ready"}"><header><div><span class="eyebrow">Comparative Reconstruction</span><h2>${escapeHtml(heading)}</h2></div></header><p>Observation ${reconstruction.from.frameSequence + 1} and Observation ${reconstruction.to.frameSequence + 1} share one stable semantic world.</p><dl><div><dt>First divergence</dt><dd>${escapeHtml(firstLabel)}</dd></div><div><dt>Shared moments</dt><dd>${reconstruction.summary.shared}</dd></div><div><dt>Exact divergences</dt><dd>${reconstruction.summary.divergent}</dd></div></dl><footer>No inferred correspondence · no rendering comparison</footer></section>`;
  }
  const stateLabels = {
    shared: "Shared cognition",
    "a-only": "Observation A only",
    "b-only": "Observation B only",
    modified: "Same identity, changed revision",
  };
  return `<section class="comparative-context ${current.divergent ? "is-divergence" : "is-shared"}"><header><div><span class="eyebrow">${escapeHtml(roleLabels[current.role] ?? current.elementType)}</span><h2>${escapeHtml(current.divergent ? "Cognition diverges here" : "Investigations remain identical")}</h2></div><span class="comparative-step-state">${escapeHtml(stateLabels[current.state] ?? current.state)}</span></header><div class="comparative-observations"><section class="observation-a"><span aria-hidden="true"><i>A</i></span><div><small>Observation ${reconstruction.from.frameSequence + 1}</small><strong>${escapeHtml(comparativeElementLabel(current.from, reconstruction))}</strong></div></section><section class="observation-b"><span aria-hidden="true"><i>B</i></span><div><small>Observation ${reconstruction.to.frameSequence + 1}</small><strong>${escapeHtml(comparativeElementLabel(current.to, reconstruction))}</strong></div></section></div><p>${escapeHtml(current.reason)}</p><footer>Semantic step ${current.index + 1} of ${reconstruction.moments.length} · exact runtime fingerprints</footer></section>`;
}

function neuralFlowRibbon() {
  const retrievalCandidates = snapshot.retrievalSessions.reduce((sum, session) => sum + session.candidates.length, 0);
  const values = [
    ["working", "Working", snapshot.workingMemory.entries.length],
    ["consolidation", "Consolidation", snapshot.consolidationSessions.filter(({ state: value }) => value === "Retained").length],
    ["long-term", "Long-Term", snapshot.longTermMemory.entries.length],
    ["retrieval", "Retrieval", retrievalCandidates],
    ["reflection", "Reflection", snapshot.reflections.length],
  ];
  return `<nav class="neural-flow-ribbon" aria-label="Observed MemoryOS lifecycle"><span class="eyebrow">Observed paths</span>${values.map(([target, label, value], index) => `<a href="#${target}" data-flow-route="${target}"><i aria-hidden="true"></i><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(value)} observed</small></span>${index < values.length - 1 ? '<b aria-hidden="true">&rarr;</b>' : ""}</a>`).join("")}</nav>`;
}

function neuralOperationSignal() {
  if (!state.lastOperation) return "";
  const { name, result } = state.lastOperation;
  return `<details class="neural-operation-signal"><summary><span>${escapeHtml(name)}</span>${status(result.succeeded ? "Passed" : "Failed")}</summary><strong>${escapeHtml(result.code)}</strong><p>${escapeHtml(result.message || "Detached result available for inspection.")}</p></details>`;
}

function primitiveRows(value) {
  if (value === null || typeof value !== "object") return [["value", value === null ? "Not set" : value]];
  return Object.entries(value).flatMap(([key, item]) => {
    if (Array.isArray(item)) return [[key, `${item.length} observed`]];
    if (item && typeof item === "object") return [[key, "Observed value"]];
    return [[key, item === null ? "Not set" : item]];
  });
}

function renderNestedInspector(value) {
  if (value === null || typeof value !== "object") return "";
  const groups = Object.entries(value).filter(([, item]) => Array.isArray(item) && item.length > 0);
  return groups.map(([key, values]) => `<section class="inspector-card"><h3>${escapeHtml(key)}</h3><div class="tag-row">${values.map((item) => {
    const label = typeof item === "object" ? (item.identifier ?? item.sourceIdentifier ?? item.value ?? JSON.stringify(item)) : item;
    return `<span class="tag">${escapeHtml(label)}</span>`;
  }).join("")}</div></section>`).join("");
}

function traceDiagnosticView() {
  if (!state.traceDiagnostic) return "";
  return `<div class="trace-diagnostic" role="status"><strong>${escapeHtml(state.traceDiagnostic.code)}</strong><span>${escapeHtml(state.traceDiagnostic.message)}</span></div>`;
}

function graphSelectionView(selection) {
  const observation = selection.observations[0];
  const route = observation.route ?? routeByFamily[observation.family] ?? "provenance";
  const rows = primitiveRows(observation.value);
  const traceAction = traceableFamilies.has(observation.family)
    ? `<button class="button secondary" type="button" data-graph-trace data-identifier="${escapeHtml(selection.identifier)}" data-route="${route}">Trace provenance</button>`
    : "";
  return `<section class="neural-selection">
    <header><div><span class="eyebrow">Graph selection</span><h2>${escapeHtml(observation.family)}</h2></div><button class="rail-close" type="button" data-graph-clear aria-label="Clear graph selection">&times;</button></header>
    <div class="selection-identity"><span class="selection-glyph" aria-hidden="true"></span><span><small>Selected observation</small><strong class="identifier">${escapeHtml(selection.identifier)}</strong></span>${status("Observed")}</div>
    ${traceDiagnosticView()}
    <ul class="key-value-list selection-values">${rows.map(([key, value]) => `<li><span>${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></li>`).join("")}</ul>
    ${renderNestedInspector(observation.value)}
    <div class="selection-actions"><a class="button secondary" href="#${route}">Open perspective</a>${traceAction}</div>
  </section>`;
}

function neuralDefaultContext(route) {
  const [title, description] = routeMetadata[route];
  const standaloneReflection = snapshot.reflections[0];
  const sessionPosition = snapshot.reflectionSessions.findIndex((session) => session.reflection);
  const reflection = standaloneReflection ?? snapshot.reflectionSessions[sessionPosition]?.reflection;
  const reflectionPath = standaloneReflection
    ? "Reflection.values[0]"
    : `Reflection.sessions[${sessionPosition}].reflection`;
  if ((route === "complete" || route === "reflection") && reflection) {
    return `<section class="neural-reflection-beacon">
      <span class="reflection-glyph" aria-hidden="true">&#10022;</span>
      <span class="eyebrow">Reflection convergence</span>
      <h2>${escapeHtml(reflection.knowledge)}</h2>
      <button type="button" data-select-id="${escapeHtml(reflection.identifier)}" data-select-family="Reflection" data-select-path="${escapeHtml(reflectionPath)}">Trace ${reflection.sources.length} evidence sources <span aria-hidden="true">&rarr;</span></button>
    </section>`;
  }
  return `<section class="neural-perspective-guide">
    <span class="eyebrow">Active graph perspective</span>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(description)}</p>
    <small>Select any illuminated node to inspect its exact detached value.</small>
  </section>`;
}

function graphContext(route = state.route) {
  const evolution = currentEvolution();
  const reconstruction = evolution ? synchronizeComparativeReconstruction(evolution) : null;
  const comparativeView = reconstruction && state.comparativeReplayState
    ? projectComparativeReplay(reconstruction, state.comparativeReplayState)
    : null;
  if (reconstruction && comparativeView) return comparativeContextView(reconstruction, comparativeView);
  if (state.comparativeDiagnostic && evolution) {
    return `<section class="evolution-context"><header><div><span class="eyebrow">Comparative Reconstruction unavailable</span><h2>Exact trace pair required</h2></div></header><p>${escapeHtml(state.comparativeDiagnostic)}</p></section>`;
  }
  if (evolution) return evolutionContextView(evolution);
  if (state.activeTrace) return investigationContextView();
  if (state.graphSelection) return graphSelectionView(state.graphSelection);
  return `${state.traceDiagnostic ? `<section class="neural-perspective-guide"><span class="eyebrow">Cognitive Trace unavailable</span><h2>Observed journey rejected</h2>${traceDiagnosticView()}</section>` : ""}${neuralDefaultContext(route)}`;
}

function currentEvolution() {
  if (!state.evolutionController.active) return null;
  const pair = evolutionFrames(observationTimeline, state.evolutionController);
  if (!pair) return null;
  const evolution = compareCognitiveEvolution(pair.from, pair.to);
  validateCognitiveEvolution(evolution);
  return evolution;
}

function comparativeEntryControl() {
  const pair = evolutionFrames(observationTimeline, state.evolutionController);
  const targetNodeKey = pair ? comparableReflectionTarget(pair) : null;
  if (!targetNodeKey) return "";
  return `<button class="button secondary comparative-entry-action" type="button" data-comparative-start>Compare traces</button>`;
}

function evolutionContextView(evolution) {
  const groups = [
    ["Evidence", "addedEvidence", "removedEvidence"],
    ["Semantic transformations", "addedSemanticTransformations", "removedSemanticTransformations"],
    ["Retrievals", "addedRetrievals", "removedRetrievals"],
    ["Reflections", "addedReflections", "removedReflections"],
    ["Relationships", "addedRelationships", "removedRelationships"],
  ];
  if (state.evolutionSelection) {
    const node = state.evolutionSelection;
    const added = evolution.view.addedNodeKeys.includes(node.key);
    const removed = evolution.view.removedNodeKeys.includes(node.key);
    const evolved = evolution.view.evolvedNodeKeys.includes(node.key);
    const stateLabel = evolved ? "Evolved" : added ? "Added" : removed ? "Removed" : "Stable context";
    return `<section class="evolution-context"><header><div><span class="eyebrow">Cognitive Evolution</span><h2>${escapeHtml(node.label)}</h2></div><button class="rail-close" type="button" data-evolution-clear aria-label="Clear evolution selection">&times;</button></header><div class="evolution-state is-${stateLabel.toLowerCase().replaceAll(" ", "-")}"><span aria-hidden="true"></span><div><small>${escapeHtml(node.family ?? node.kind)}</small><strong>${escapeHtml(stateLabel)}</strong></div></div><p>${evolved ? "The same cognitive identity has a different observed semantic revision." : added ? "This cognition is present only in Observation B." : removed ? "This cognition is present only in Observation A." : "This cognition remained semantically unchanged across both observations."}</p>${comparativeEntryControl()}</section>`;
  }
  const rows = groups.map(([label, addedKey, removedKey]) => {
    const added = evolution.summary[addedKey];
    const removed = evolution.summary[removedKey];
    return `<li><span>${escapeHtml(label)}</span><span><b class="evolution-added">+${added}</b><b class="evolution-removed">−${removed}</b></span></li>`;
  }).join("");
  const total = Object.values(evolution.summary).reduce((sum, value) => sum + value, 0);
  return `<section class="evolution-context"><header><div><span class="eyebrow">Cognitive Evolution</span><h2>${total === 0 ? "No semantic changes" : `${total} semantic differences`}</h2></div></header><p>Observation ${evolution.from.sequence + 1} is compared with Observation ${evolution.to.sequence + 1}. Every emphasis comes from immutable runtime truth.</p><ul class="key-value-list evolution-difference-list">${rows}<li><span>Modified relationships</span><span><b class="evolution-modified">~${evolution.summary.modifiedRelationships}</b></span></li></ul>${comparativeEntryControl()}<footer>${evolution.unchanged.nodeKeys.length} cognitive records and ${evolution.unchanged.relationshipKeys.length} relationships remained stable.</footer></section>`;
}

function updateEvolution(action) {
  const frameCount = observationTimeline.length;
  const operations = {
    compare: compareEvolution,
    previous: previousEvolutionObservation,
    next: nextEvolutionObservation,
  };
  const operation = operations[action];
  if (!operation) return;
  const wasActive = state.evolutionController.active;
  state.evolutionController = operation(state.evolutionController, frameCount);
  state.evolutionSelection = null;
  clearComparativeReconstruction(!state.evolutionController.active);
  if (!wasActive && state.evolutionController.active) {
    state.activeTrace = null;
    clearReplay();
    state.traceDiagnostic = null;
    clearObservedSelection();
  }
  renderRoute();
}

function traceContainsNode(trace, nodeKey) {
  return Boolean(trace && nodeKey && trace.branches.some((branch) => (
    branch.steps.some((step) => step.nodeKey === nodeKey)
  )));
}

function queryTraceForNode(node) {
  if (!currentFrame || !node || node.aggregate || node.family !== "Reflection" || node.kind !== "reflection") {
    state.traceDiagnostic = null;
    return null;
  }
  const query = createCognitiveTraceQuery({
    workspaceIdentifier: snapshot.workspaceIdentifier,
    sessionIdentifier: currentFrame.world.frame.sessionIdentifier ?? null,
    frameIdentifier: currentFrame.world.frame.identifier,
    targetNodeKey: node.key,
  });
  const result = queryCognitiveTrace(currentFrame, query);
  state.traceDiagnostic = result.succeeded
    ? null
    : { code: result.code, message: result.message, targetNodeKey: node.key };
  return result.succeeded ? result.trace : null;
}

function reconcileActiveTraceForSelection(node) {
  const previous = state.activeTrace;
  if (node && !node.aggregate && node.family === "Reflection" && node.kind === "reflection") {
    state.activeTrace = queryTraceForNode(node);
  } else if (!traceContainsNode(previous, node?.key)) {
    state.activeTrace = null;
    state.traceDiagnostic = null;
  }
  synchronizeReplayWithTrace();
  return previous?.identifier !== state.activeTrace?.identifier;
}

function rebuildActiveTrace(targetNodeKey) {
  if (!targetNodeKey || !currentFrame) {
    state.activeTrace = null;
    clearReplay();
    state.traceDiagnostic = null;
    return false;
  }
  const target = currentFrame.world.nodes.find((node) => node.key === targetNodeKey);
  const nextTrace = queryTraceForNode(target);
  state.activeTrace = nextTrace;
  synchronizeReplayWithTrace();
  return Boolean(nextTrace);
}

function acceptObservationFrame(view, operation, query, resultCode) {
  const selectedKey = state.graphSelection?.nodeKey ?? state.graphViewState.selectedKey;
  const traceTargetKey = state.activeTrace?.targetNodeKey ?? null;
  const nextSnapshot = cloneDetached(view);
  const accepted = appendObservationFrame(observationTimeline, {
    snapshot: nextSnapshot,
    graph: buildGraph(nextSnapshot),
    operation,
    query,
    resultCode,
  });
  snapshot = nextSnapshot;
  observationTimeline = accepted.frames;
  currentFrame = accepted.current;
  state.evolutionController = reconcileEvolutionController(state.evolutionController, observationTimeline.length);
  state.evolutionSelection = null;
  clearComparativeReconstruction(false);
  state.pendingActivity = currentFrame.activity;
  state.graphViewState = reconcileGraphViewState(currentFrame.world, state.graphViewState);
  synchronizeSelectionWithCurrentFrame(selectedKey);
  if (selectedKey && !state.graphSelection) {
    state.activeTrace = null;
    clearReplay();
    clearComparativeReconstruction();
    state.traceDiagnostic = null;
  } else if (traceTargetKey) {
    if (!rebuildActiveTrace(traceTargetKey)) {
      clearObservedSelection();
    } else {
      const activeSelectedKey = state.graphSelection?.nodeKey ?? state.graphViewState.selectedKey;
      const activeFollowedKey = state.graphViewState.followedKey;
      if ((activeSelectedKey && !traceContainsNode(state.activeTrace, activeSelectedKey))
        || (activeFollowedKey && !traceContainsNode(state.activeTrace, activeFollowedKey))) {
        const target = currentFrame.world.nodes.find((node) => node.key === state.activeTrace.targetNodeKey);
        const observations = target ? observationsForWorldNode(target) : [];
        if (target && observations.length > 0) {
          state.graphSelection = { identifier: target.identifier, observations, nodeKey: target.key };
          state.graphViewState = selectGraphNode(state.graphViewState, target.key);
          populateInspector(target.identifier, observations, false);
        } else {
          state.activeTrace = null;
          clearReplay();
          clearObservedSelection();
        }
      }
    }
  }
}

function renderNeuralPerspective(route = state.route) {
  const frame = currentFrame;
  const evolution = currentEvolution();
  const reconstruction = evolution ? synchronizeComparativeReconstruction(evolution) : null;
  const comparativeView = reconstruction && state.comparativeReplayState
    ? projectComparativeReplay(reconstruction, state.comparativeReplayState)
    : null;
  const world = reconstruction?.world ?? evolution?.world ?? frame.world;
  const activity = state.pendingActivity ?? {};
  const replayView = state.activeReplay && state.replayState
    ? projectReplay(state.activeReplay, state.replayState)
    : null;
  elements.shell.dataset.investigation = state.activeTrace ? "active" : "inactive";
  elements.shell.dataset.evolution = evolution ? "active" : "inactive";
  elements.shell.dataset.comparative = comparativeView ? "active" : "inactive";
  elements.root.innerHTML = `<div class="neural-interface" data-perspective="${escapeHtml(route)}">
    <section class="neural-world${state.activeTrace ? " has-investigation" : ""}${evolution ? " has-evolution" : ""}${comparativeView ? " has-comparative-reconstruction" : ""}" aria-label="${escapeHtml(world.identity)}">
      ${graphIdentity(world, frame, route, state.activeTrace, state.replayState, evolution, comparativeView)}
      ${comparativeView ? comparativeSignals(reconstruction, comparativeView) : state.activeTrace ? traceSignals(state.activeTrace, replayView) : evolution ? evolutionSignals(evolution) : neuralSignals(route)}
      <div id="memory-graph" class="memory-intelligence-graph-host" aria-label="${escapeHtml(world.identity)}"></div>
      <aside class="neural-context" id="graph-context" aria-label="Selected graph context">${graphContext(route)}</aside>
      ${neuralFlowRibbon()}
      ${neuralOperationSignal()}
    </section>
  </div>`;
  const graphContainer = document.querySelector("#memory-graph");
  graphController = renderGraph(graphContainer, world, (node) => {
    if (state.replayState?.status === "playing") {
      clearReplayTimer();
      state.replayState = pauseReplay(state.activeReplay, state.replayState);
    }
    if (comparativeView) {
      if (state.comparativeReplayState?.status === "playing") {
        clearComparativeReplayTimer();
        state.comparativeReplayState = pauseComparativeReplay(reconstruction, state.comparativeReplayState);
      }
      const pair = evolutionFrames(observationTimeline, state.evolutionController);
      const comparable = !node.aggregate && node.kind === "reflection" && node.family === "Reflection"
        && pair?.from.world.nodes.some(({ key }) => key === node.key)
        && pair?.to.world.nodes.some(({ key }) => key === node.key);
      if (comparable && node.key !== state.comparativeTargetKey) {
        state.comparativeTargetKey = node.key;
        clearComparativeReconstruction(false);
        renderRoute();
      } else {
        refreshComparativePresentation();
      }
      return;
    }
    if (evolution) {
      state.evolutionSelection = node;
      const pair = evolutionFrames(observationTimeline, state.evolutionController);
      const comparable = !node.aggregate && node.kind === "reflection" && node.family === "Reflection"
        && pair?.from.world.nodes.some(({ key }) => key === node.key)
        && pair?.to.world.nodes.some(({ key }) => key === node.key);
      if (comparable) state.comparativeTargetKey = node.key;
      renderGraphContext();
      return;
    }
    const targetRoute = routeByFamily[node.family];
    if (node.aggregate && targetRoute && targetRoute !== state.route) {
      location.hash = targetRoute;
      return;
    }
    selectObservation(node.identifier, node.family, node.observationPath, node.key);
  }, {
    perspective: perspectiveKindByRoute[route],
    viewState: state.graphViewState,
    activity,
    trace: state.activeTrace,
    replayView,
    evolutionView: comparativeView ? null : evolution?.view ?? null,
    evolutionControl: state.evolutionController,
    comparativeView,
    onReplayAction: updateReplay,
    onEvolutionAction: updateEvolution,
    onComparativeAction: updateComparativeReplay,
    onViewStateChange(nextViewState) {
      state.graphViewState = nextViewState;
    },
  });
  state.pendingActivity = null;
  graphContainer.addEventListener("graphselectionclear", clearGraphSelection);
  bindGraphContext();
  scheduleReplay();
  scheduleComparativeReplay();
}

function refreshReplayPresentation() {
  if (!state.activeTrace || !state.activeReplay || !state.replayState || !graphController) return false;
  const replayView = projectReplay(state.activeReplay, state.replayState);
  if (!graphController.updateReplayView(replayView)) return false;
  const liveState = document.querySelector(".graph-live-state");
  const replayLabels = { ready: "Replay ready", playing: "Constructing", paused: "Replay paused", completed: "Replay complete" };
  if (liveState) liveState.innerHTML = `<i aria-hidden="true"></i>${replayLabels[state.replayState.status]}`;
  const ribbon = document.querySelector(".trace-signal-ribbon");
  if (ribbon) ribbon.outerHTML = traceSignals(state.activeTrace, replayView);
  renderGraphContext();
  return true;
}

function refreshComparativePresentation() {
  const reconstruction = state.comparativeReconstruction;
  if (!reconstruction || !state.comparativeReplayState || !graphController) return false;
  const view = projectComparativeReplay(reconstruction, state.comparativeReplayState);
  if (!graphController.updateComparativeView(view)) return false;
  const liveState = document.querySelector(".graph-live-state");
  const labels = {
    ready: "Synchronized",
    playing: "Reconstructing together",
    paused: view.atDivergence ? "Paused at divergence" : "Reconstruction paused",
    completed: "Comparison complete",
  };
  if (liveState) liveState.innerHTML = `<i aria-hidden="true"></i>${labels[view.status]}`;
  const ribbon = document.querySelector(".comparative-signal-ribbon");
  if (ribbon) ribbon.outerHTML = comparativeSignals(reconstruction, view);
  renderGraphContext();
  return true;
}

function renderRoute() {
  const [title, description] = routeMetadata[state.route];
  elements.shell.dataset.route = state.route;
  elements.pageTitle.textContent = title;
  elements.pageDescription.textContent = description;
  elements.breadcrumb.textContent = title;
  document.title = `${title} · CCA Memory Studio`;
  document.querySelectorAll(".nav-item").forEach((item) => {
    const active = item.dataset.scope === state.route;
    item.classList.toggle("is-active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  elements.queryScope.value = scopeForRoute(["provenance", "validation"].includes(state.route) ? "complete" : state.route);

  if (state.sessionState === "Forgotten") {
    elements.pageTitle.textContent = "Studio session forgotten";
    elements.pageDescription.textContent = "The detached Studio view is cleared; MemoryOS sources remain unchanged.";
    elements.root.innerHTML = `<section class="session-forgotten-state"><span aria-hidden="true">&times;</span><h2>Studio session forgotten</h2><p>The detached view is cleared. MemoryOS source values were not modified.</p></section>`;
    closeMobileNavigation();
    return;
  }

  renderNeuralPerspective(state.route);
  closeMobileNavigation();
}

function findAnyObservations(identifier, familyHint = null) {
  let observations = findObservation(snapshot, identifier)
    .filter(({ family }) => familyHint === null || family === familyHint)
    .map(({ family, value }) => ({ title: identifier, family, value }));
  if (observations.length === 0 && familyHint !== null) {
    observations = findObservation(snapshot, identifier)
      .map(({ family, value }) => ({ title: identifier, family: familyHint === "Provenance snapshot" ? familyHint : family, value }));
  }
  for (const session of snapshot.retrievalSessions) {
    session.candidates.forEach((candidate, candidatePosition) => {
      if (candidate.sourceIdentifier === identifier && (familyHint === null || familyHint === "Retrieval candidate")) {
        observations.push({ title: identifier, family: "Retrieval candidate", value: { ...candidate, sessionIdentifier: session.identifier, candidatePosition } });
      }
    });
  }
  snapshot.reflections.forEach((reflection) => {
    if (reflection.identifier === identifier && (familyHint === null || familyHint === "Reflection")) observations.push({ title: identifier, family: "Reflection", value: reflection });
  });
  for (const session of snapshot.providerSessions) {
    session.descriptors.forEach((descriptor, descriptorPosition) => {
      if (descriptor.identifier === identifier && (familyHint === null || familyHint === "Provider descriptor")) {
        observations.push({ title: identifier, family: "Provider descriptor", value: { ...descriptor, sessionIdentifier: session.identifier, descriptorPosition } });
      }
    });
  }
  snapshot.consolidationSessions.forEach((session) => {
    if (session.identifier === identifier && (familyHint === null || familyHint === "Consolidation session")) observations.push({ title: identifier, family: "Consolidation session", value: session });
  });
  snapshot.reflectionSessions.forEach((session) => {
    if (session.identifier === identifier && (familyHint === null || familyHint === "Reflection session")) observations.push({ title: identifier, family: "Reflection session", value: session });
  });
  snapshot.retrievalSessions.forEach((session) => {
    if (session.identifier === identifier && (familyHint === null || familyHint === "Retrieval session")) observations.push({ title: identifier, family: "Retrieval session", value: session });
  });
  snapshot.providerSessions.forEach((session) => {
    if (session.identifier === identifier && (familyHint === null || familyHint === "Provider session")) observations.push({ title: identifier, family: "Provider session", value: session });
  });
  snapshot.validation.forEach((check) => {
    if (check.identifier === identifier && (familyHint === null || familyHint === "Validation check")) observations.push({ title: check.label, family: "Validation check", value: check });
  });
  const aggregateObservations = {
    "capability-memory": ["Memory aggregate", snapshot.memory],
    "capability-working": ["WorkingMemory aggregate", snapshot.workingMemory],
    "capability-consolidation": ["Consolidation aggregate", { workspaceIdentifier: snapshot.workspaceIdentifier, sessions: snapshot.consolidationSessions }],
    "capability-long-term": ["LongTermMemory aggregate", snapshot.longTermMemory],
    "capability-semantic": ["SemanticMemory aggregate", snapshot.semanticMemory],
    "capability-episodic": ["EpisodicMemory aggregate", snapshot.episodicMemory],
    "capability-procedural": ["ProceduralMemory aggregate", snapshot.proceduralMemory],
    "capability-retrieval": ["Retrieval aggregate", { workspaceIdentifier: snapshot.workspaceIdentifier, sessions: snapshot.retrievalSessions }],
    "capability-reflection": ["Reflection aggregate", { workspaceIdentifier: snapshot.workspaceIdentifier, reflections: snapshot.reflections, sessions: snapshot.reflectionSessions }],
    "capability-providers": ["Providers aggregate", { workspaceIdentifier: snapshot.workspaceIdentifier, sessions: snapshot.providerSessions }],
    "capability-validation": ["Validation aggregate", { workspaceIdentifier: snapshot.workspaceIdentifier, checks: snapshot.validation, result: snapshot.result }],
  };
  const aggregate = aggregateObservations[identifier];
  if (aggregate && (familyHint === null || familyHint === aggregate[0])) observations.push({ title: identifier, family: aggregate[0], value: aggregate[1] });
  if (identifier === snapshot.workingMemory.activeTaskIdentifier && (familyHint === null || familyHint === "Working task")) observations.push({ title: identifier, family: "Working task", value: { identifier, active: snapshot.workingMemory.active } });
  if ((identifier === "workspace" || identifier === snapshot.workspaceIdentifier) && (familyHint === null || familyHint === "Workspace")) observations.push({ title: snapshot.workspaceIdentifier, family: "Workspace", value: { workspaceIdentifier: snapshot.workspaceIdentifier, observationIdentifier: snapshot.observationIdentifier } });
  return observations;
}

function populateInspector(identifier, observations, open = true) {
  state.selectedIdentifier = identifier;
  elements.inspectorTitle.textContent = observations.length === 1
    ? (observations[0].title ?? identifier)
    : `${identifier} · ${observations.length} locations`;
  elements.inspectorContent.innerHTML = observations.map((observation) => {
    const rows = primitiveRows(observation.value);
    const path = observation.path ? `<p class="identifier text-muted">${escapeHtml(observation.path)}</p>` : "";
    return `<section class="inspector-card"><div class="card-heading"><span class="scope-chip">${escapeHtml(observation.family)}</span>${status("Observed")}</div>${path}<ul class="key-value-list">${rows.map(([key, value]) => `<li><span>${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></li>`).join("")}</ul>${renderNestedInspector(observation.value)}</section>`;
  }).join("");
  if (open) setInspectorClosed(false);
}

function matchingWorldNode(identifier, familyHint = null, observationPath = null) {
  if (!currentFrame) return null;
  if (observationPath) {
    const exact = currentFrame.world.nodes.find((node) => node.observationPath === observationPath);
    if (exact) return exact;
  }
  const matches = currentFrame.world.nodes.filter((node) => node.identifier === identifier
    && (familyHint === null || node.family === familyHint));
  return matches.length === 1 ? matches[0] : null;
}

function observationsForWorldNode(node) {
  const exact = node.observationPath
    ? resolveInspectionDetails(snapshot, [node.observationPath])
      .map(({ path, family, value }) => ({ title: node.identifier, path, family, value }))
    : [];
  return exact.length > 0 ? exact : findAnyObservations(node.identifier, node.family);
}

function clearObservedSelection() {
  state.graphSelection = null;
  state.selectedIdentifier = null;
  state.graphViewState = { ...state.graphViewState, selectedKey: null };
  elements.inspectorTitle.textContent = "No observation selected";
  elements.inspectorContent.replaceChildren();
  setInspectorClosed(true);
}

function synchronizeSelectionWithCurrentFrame(selectedKey) {
  if (!state.graphSelection && !selectedKey) return;
  const node = selectedKey
    ? currentFrame.world.nodes.find(({ key }) => key === selectedKey)
    : null;
  if (!node) {
    clearObservedSelection();
    return;
  }
  const observations = observationsForWorldNode(node);
  if (observations.length === 0) {
    clearObservedSelection();
    return;
  }
  state.graphSelection = { identifier: node.identifier, observations, nodeKey: node.key };
  state.graphViewState = { ...state.graphViewState, selectedKey: node.key };
  populateInspector(node.identifier, observations, false);
}

function selectObservation(identifier, familyHint = null, observationPath = null, nodeKey = null) {
  const exact = observationPath
    ? resolveInspectionDetails(snapshot, [observationPath])
      .map(({ path, family, value }) => ({ title: identifier, path, family, value }))
    : [];
  const observations = exact.length > 0 ? exact : findAnyObservations(identifier, familyHint);
  if (observations.length === 0) {
    showToast("Observation not found", identifier, "error");
    return;
  }
  const worldNode = nodeKey
    ? currentFrame.world.nodes.find((node) => node.key === nodeKey)
    : matchingWorldNode(identifier, familyHint, observationPath);
  state.graphSelection = { identifier, observations, nodeKey: worldNode?.key ?? null };
  state.graphViewState = worldNode
    ? selectGraphNode(state.graphViewState, worldNode.key)
    : { ...state.graphViewState, selectedKey: null };
  const traceChanged = reconcileActiveTraceForSelection(worldNode);
  populateInspector(identifier, observations, false);
  if (traceChanged) renderRoute();
  else renderGraphContext();
}

function renderGraphContext() {
  const context = document.querySelector("#graph-context");
  if (!context) return;
  context.innerHTML = graphContext();
  bindGraphContext();
}

function clearGraphSelection() {
  clearObservedSelection();
  const traceWasActive = Boolean(state.activeTrace);
  state.activeTrace = null;
  clearReplay();
  state.traceDiagnostic = null;
  if (traceWasActive) renderRoute();
  else {
    renderGraphContext();
    document.querySelector("#memory-graph")?.dispatchEvent(new CustomEvent("cleargraphselection"));
  }
}

function bindSelectableRows(root = document) {
  root.querySelectorAll("[data-select-id]").forEach((element) => {
    const select = () => selectObservation(
      element.dataset.selectId,
      element.dataset.selectFamily ?? null,
      element.dataset.selectPath ?? null,
    );
    element.addEventListener("click", select);
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
  });
}

function bindGraphContext() {
  const context = document.querySelector("#graph-context");
  if (!context) return;
  bindSelectableRows(context);
  context.querySelector("[data-graph-clear]")?.addEventListener("click", clearGraphSelection);
  context.querySelector("[data-evolution-clear]")?.addEventListener("click", () => {
    state.evolutionSelection = null;
    renderGraphContext();
    document.querySelector("#memory-graph")?.dispatchEvent(new CustomEvent("cleargraphselection"));
  });
  context.querySelector("[data-comparative-start]")?.addEventListener("click", activateComparativeReconstruction);
  context.querySelector("[data-graph-trace]")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const route = ["retrieval", "reflection"].includes(button.dataset.route) ? button.dataset.route : "complete";
    elements.queryScope.value = scopeForRoute(route);
    elements.queryIdentifier.value = button.dataset.identifier;
    execute("Trace");
  });
}

function selectInspectionResult(query, operationResult) {
  if (!query.identifier || !operationResult.view) return;
  const observations = resolveInspectionDetails(operationResult.view, operationResult.observations)
    .map(({ path, family, value }) => ({ title: path, path, family, value }));
  if (observations.length > 0) {
    const worldNode = matchingWorldNode(
      query.identifier,
      observations.length === 1 ? observations[0].family : null,
      observations.length === 1 ? observations[0].path : null,
    );
    state.graphSelection = { identifier: query.identifier, observations, nodeKey: worldNode?.key ?? null };
    state.graphViewState = worldNode
      ? selectGraphNode(state.graphViewState, worldNode.key)
      : { ...state.graphViewState, selectedKey: null };
    const traceChanged = reconcileActiveTraceForSelection(worldNode);
    populateInspector(query.identifier, observations, false);
    if (traceChanged) renderRoute();
    else renderGraphContext();
  }
}

function setBusy(busy) {
  state.busy = busy;
  document.querySelectorAll("#run-inspect, #run-trace, #run-summary, #observe-view, #export-view, #forget-session")
    .forEach((button) => { button.disabled = busy || (state.sessionState === "Forgotten" && button.id !== "forget-session"); });
}

async function execute(name) {
  if (!commandAdapter || state.busy || state.sessionState === "Forgotten") return;
  const sequence = ++operationSequence;
  const query = {
    workspaceIdentifier: snapshot.workspaceIdentifier,
    scope: elements.queryScope.value,
    identifier: elements.queryIdentifier.value,
  };
  setBusy(true);
  try {
    const operationResult = await commandAdapter[name.toLowerCase()](query);
    if (sequence !== operationSequence) return;
    state.lastOperation = { name, result: operationResult };
    showToast(`${name}: ${operationResult.code}`, operationResult.message || "Operation completed with a detached result.", operationResult.succeeded ? "success" : "error");
    if (name === "Inspect" && operationResult.succeeded) selectInspectionResult(query, operationResult);
    renderRoute();
  } catch (error) {
    if (sequence === operationSequence) showToast(`${name} failed`, error instanceof Error ? error.message : String(error), "error");
  } finally {
    if (sequence === operationSequence) setBusy(false);
  }
}

async function executeSessionOperation(name) {
  if (!commandAdapter || state.busy) return null;
  const sequence = ++operationSequence;
  setBusy(true);
  try {
    const result = name === "observe" ? await commandAdapter.observe(snapshot) : await commandAdapter[name]();
    if (sequence !== operationSequence) return null;
    if (result.succeeded && name === "observe" && result.view) {
      acceptObservationFrame(result.view, "Observe", null, result.code);
    }
    state.lastOperation = { name: name === "exportView" ? "ExportView" : name === "forgetSession" ? "ForgetSession" : "Observe", result };
    if (result.succeeded && name === "observe") state.sessionState = "Observed";
    if (result.succeeded && name === "forgetSession") {
      state.sessionState = "Forgotten";
      observationTimeline = createObservationTimeline();
      currentFrame = null;
      state.evolutionController = createEvolutionController(0);
      state.evolutionSelection = null;
      clearComparativeReconstruction();
      state.pendingActivity = null;
      state.activeTrace = null;
      clearReplay();
      state.traceDiagnostic = null;
      state.graphSelection = null;
      state.graphViewState = createGraphViewState();
    }
    showToast(`${state.lastOperation.name}: ${result.code}`, result.message || "Operation completed with a detached result.", result.succeeded ? "success" : "error");
    updateSessionChrome();
    renderRoute();
    return result;
  } catch (error) {
    if (sequence === operationSequence) showToast(`${name} failed`, error instanceof Error ? error.message : String(error), "error");
    return null;
  } finally {
    if (sequence === operationSequence) setBusy(false);
  }
}

function showToast(title, message, kind = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${kind}`;
  toast.innerHTML = `<span aria-hidden="true">${kind === "error" ? "!" : "✓"}</span><span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></span>`;
  elements.toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function updateSessionChrome() {
  document.querySelector("#top-session-state").innerHTML = `<span class="status-dot" aria-hidden="true"></span>${escapeHtml(state.sessionState)}`;
  document.querySelector("#sidebar-state").textContent = state.sessionState;
  elements.shell.dataset.sessionState = state.sessionState;
  elements.shell.classList.toggle("session-forgotten", state.sessionState === "Forgotten");
  const forgotten = state.sessionState === "Forgotten";
  document.querySelector(".query-bar").hidden = forgotten;
  if (forgotten) setInspectorClosed(true);
  setBusy(state.busy);
}

function setInspectorClosed(closed) {
  elements.inspector.classList.toggle("is-closed", closed);
  elements.inspector.toggleAttribute("inert", closed);
  document.querySelector("#inspector-toggle").setAttribute("aria-expanded", String(!closed));
}

function closeMobileNavigation() {
  elements.sidebar.classList.remove("is-open");
  elements.sidebar.toggleAttribute("inert", window.matchMedia("(max-width: 900px)").matches);
  elements.menuToggle.setAttribute("aria-expanded", "false");
}

function initialize() {
  elements.queryScope.innerHTML = scopeDefinitions.map(({ value, label }) => `<option value="${value}">${escapeHtml(label)}</option>`).join("");
  document.querySelector("#sidebar-session-id").textContent = snapshot.session.identifier;
  document.querySelector("#sidebar-workspace").textContent = snapshot.workspaceIdentifier;
  try {
    commandAdapter = resolveCommandAdapter(snapshot);
  } catch (error) {
    showToast("Host adapter invalid", error instanceof Error ? error.message : String(error), "error");
  }
  setInspectorClosed(true);
  closeMobileNavigation();
  updateSessionChrome();
  renderRoute();

  window.addEventListener("hashchange", () => {
    state.route = normalizeRoute(location.hash.slice(1));
    state.activeTrace = null;
    clearReplay();
    state.traceDiagnostic = null;
    clearObservedSelection();
    state.lastOperation = null;
    renderRoute();
  });
  document.querySelector("#run-inspect").addEventListener("click", () => execute("Inspect"));
  document.querySelector("#run-trace").addEventListener("click", () => execute("Trace"));
  document.querySelector("#run-summary").addEventListener("click", () => execute("Summarize"));
  elements.queryIdentifier.addEventListener("keydown", (event) => {
    if (event.key === "Enter") execute("Inspect");
  });
  elements.globalQuery.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    elements.queryScope.value = "Complete";
    elements.queryIdentifier.value = elements.globalQuery.value;
    execute("Inspect");
  });
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;
    const typing = event.target instanceof HTMLElement
      && (event.target.matches("input, select, textarea") || event.target.isContentEditable);
    if (!typing && state.comparativeReconstruction && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const comparativeActions = {
        ArrowLeft: "previous",
        ArrowRight: "next",
        r: "reset",
        R: "reset",
      };
      if (event.code === "Space") {
        event.preventDefault();
        updateComparativeReplay(state.comparativeReplayState?.status === "playing" ? "pause" : "play");
        return;
      }
      if (comparativeActions[event.key]) {
        event.preventDefault();
        updateComparativeReplay(comparativeActions[event.key]);
        return;
      }
    }
    if (!typing && state.activeReplay && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const replayActions = {
        ArrowLeft: "previous",
        ArrowRight: "next",
        r: "restart",
        R: "restart",
      };
      if (event.code === "Space") {
        event.preventDefault();
        updateReplay(state.replayState?.status === "playing" ? "pause" : "play");
        return;
      }
      if (replayActions[event.key]) {
        event.preventDefault();
        updateReplay(replayActions[event.key]);
        return;
      }
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      elements.globalQuery.focus();
    }
    if (event.key === "Escape") {
      closeMobileNavigation();
      if (state.graphSelection) clearGraphSelection();
      else setInspectorClosed(true);
    }
  });
  document.querySelector("#observe-view").addEventListener("click", () => executeSessionOperation("observe"));
  document.querySelector("#export-view").addEventListener("click", () => executeSessionOperation("exportView"));
  document.querySelector("#forget-session").addEventListener("click", () => elements.forgetDialog.showModal());
  elements.forgetDialog.addEventListener("close", async () => {
    if (elements.forgetDialog.returnValue !== "confirm") return;
    const result = await executeSessionOperation("forgetSession");
    if (result?.succeeded) {
      state.selectedIdentifier = null;
      elements.inspectorTitle.textContent = "Session forgotten";
      elements.inspectorContent.replaceChildren();
    }
  });
  elements.menuToggle.addEventListener("click", () => {
    const open = elements.sidebar.classList.toggle("is-open");
    elements.sidebar.toggleAttribute("inert", !open);
    elements.menuToggle.setAttribute("aria-expanded", String(open));
  });
  elements.backdrop.addEventListener("click", closeMobileNavigation);
  document.querySelector("#inspector-toggle").addEventListener("click", () => {
    setInspectorClosed(!elements.inspector.classList.contains("is-closed"));
  });
  document.querySelector("#inspector-close").addEventListener("click", () => setInspectorClosed(true));
}

initialize();
