import { buildGraph } from "./studio-model.js";
import {
  canonicalObservation,
  createSemanticWorld,
  fingerprintObservation,
} from "./semantic-world.js";

export const cognitiveTraceRoles = Object.freeze([
  "origin-evidence",
  "semantic-transformation",
  "retrieval",
  "reflection-current",
]);

const roleOrder = new Map(cognitiveTraceRoles.map((role, index) => [role, index]));
const validatedTraceInstances = new WeakSet();
const validatedObservationFrames = new WeakSet();
const validatedTraceBindings = new WeakMap();
const supportedSources = Object.freeze({
  Semantic: Object.freeze({ field: "semanticConcept", kind: "semantic" }),
  Episodic: Object.freeze({ field: "episode", kind: "episodic" }),
  Procedural: Object.freeze({ field: "procedure", kind: "procedural" }),
});

const resultMessages = Object.freeze({
  OK: "The cognitive trace was constructed from the accepted observation frame.",
  INVALID_QUERY: "The cognitive trace query is invalid.",
  WORKSPACE_MISMATCH: "The cognitive trace query crosses the observed Workspace boundary.",
  SESSION_MISMATCH: "The cognitive trace query crosses the Studio session boundary.",
  FRAME_MISMATCH: "The cognitive trace query does not address the observed frame.",
  NOT_FOUND: "The selected Reflection is not present in the observed frame.",
  INVALID_TARGET: "The selected target is not an observable Reflection.",
  MISSING_EVIDENCE: "The selected Reflection does not have complete authoritative evidence.",
  AMBIGUOUS_EVIDENCE: "The selected Reflection has ambiguous authoritative evidence.",
  INCONSISTENT_EVIDENCE: "The selected Reflection evidence is inconsistent with its owned snapshot.",
  INCONSISTENT_RELATIONSHIP: "The selected Reflection relationships are inconsistent with the semantic world.",
  INVALID_TRACE: "The cognitive trace failed deterministic integrity validation.",
});

export class CognitiveTraceError extends Error {
  constructor(code, message = resultMessages[code] ?? resultMessages.INVALID_TRACE) {
    super(message);
    this.name = "CognitiveTraceError";
    this.code = code;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function deeplyFrozen(value) {
  if (!value || typeof value !== "object" || !Object.isFrozen(value)) return false;
  return Object.values(value).every((member) => (
    !member || typeof member !== "object" || deeplyFrozen(member)
  ));
}

function nonEmptyText(value) {
  return typeof value === "string" && value.length > 0;
}

function canonicalProjectedWorld(frame) {
  const snapshot = frame.snapshot;
  return createSemanticWorld(buildGraph(snapshot), {
    frameIndex: frame.sequence,
    observationFingerprint: fingerprintObservation(snapshot),
    observationIdentifier: snapshot.observationIdentifier,
    workspaceIdentifier: snapshot.workspaceIdentifier,
    sessionIdentifier: snapshot.session?.identifier,
    source: snapshot.source,
  });
}

function requireObservationFrame(frame) {
  if (!frame || frame.kind !== "MemoryOSObservationFrame" || frame.version !== "1.1") {
    throw new CognitiveTraceError("INVALID_TRACE", "A MemoryOS 1.1 observation frame is required.");
  }
  if (validatedObservationFrames.has(frame)) return frame;
  if (!frame.snapshot || !frame.world || frame.world.kind !== "MemoryOSSemanticWorld") {
    throw new CognitiveTraceError("INVALID_TRACE", "The observation frame must own a detached snapshot and semantic world.");
  }
  const snapshot = frame.snapshot;
  const worldFrame = frame.world.frame;
  if (!nonEmptyText(snapshot.workspaceIdentifier)
    || snapshot.workspaceIdentifier !== worldFrame.workspaceIdentifier) {
    throw new CognitiveTraceError("WORKSPACE_MISMATCH", "The observation snapshot and semantic world do not share an exact Workspace identity.");
  }
  if ((snapshot.session?.identifier ?? null) !== (worldFrame.sessionIdentifier ?? null)) {
    throw new CognitiveTraceError("SESSION_MISMATCH", "The observation snapshot and semantic world do not share an exact Studio session identity.");
  }
  if (!nonEmptyText(snapshot.observationIdentifier)
    || snapshot.observationIdentifier !== worldFrame.observationIdentifier
    || frame.sequence !== worldFrame.index
    || fingerprintObservation(snapshot) !== worldFrame.observationFingerprint) {
    throw new CognitiveTraceError("FRAME_MISMATCH", "The observation snapshot does not match the semantic-world frame metadata.");
  }
  let projected;
  try {
    projected = canonicalProjectedWorld(frame);
  } catch (error) {
    throw new CognitiveTraceError("FRAME_MISMATCH", `The observation frame cannot be projected deterministically: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (canonicalObservation(projected) !== canonicalObservation(frame.world)) {
    throw new CognitiveTraceError("FRAME_MISMATCH", "The semantic world is not the canonical projection of its bound observation snapshot.");
  }
  // Weak identity caching is safe only for the deeply immutable accepted frame.
  // It avoids rebuilding and serializing the same full semantic world for every
  // trace, replay, and comparative validation while retaining no frame lifetime.
  if (deeplyFrozen(frame)) validatedObservationFrames.add(frame);
  return frame;
}

function uniqueMatch(values, predicate, missingCode, ambiguousCode, label) {
  const matches = values.map((value, index) => ({ value, index })).filter(({ value }) => predicate(value));
  if (matches.length === 0) throw new CognitiveTraceError(missingCode, `${label} is missing.`);
  if (matches.length > 1) throw new CognitiveTraceError(ambiguousCode, `${label} is ambiguous.`);
  return matches[0];
}

function worldNodeAtPath(world, observationPath, expectedKind, label) {
  const match = uniqueMatch(
    world.nodes,
    (node) => node.observationPath === observationPath,
    "INCONSISTENT_RELATIONSHIP",
    "INCONSISTENT_RELATIONSHIP",
    label,
  ).value;
  if (expectedKind && match.kind !== expectedKind) {
    throw new CognitiveTraceError("INCONSISTENT_RELATIONSHIP", `${label} has the wrong semantic-world kind.`);
  }
  return match;
}

function worldEdge(world, from, to, relation, label) {
  return uniqueMatch(
    world.edges,
    (edge) => edge.from === from && edge.to === to && edge.relation === relation,
    "INCONSISTENT_RELATIONSHIP",
    "INCONSISTENT_RELATIONSHIP",
    label,
  ).value;
}

function validateWorkspace(value, workspaceIdentifier, label) {
  if (!value || value.workspaceIdentifier !== workspaceIdentifier) {
    throw new CognitiveTraceError("WORKSPACE_MISMATCH", `${label} does not belong to the observed Workspace.`);
  }
}

function traceIdentifier(frame, targetNodeKey) {
  return [
    "trace",
    encodeURIComponent(frame.snapshot.workspaceIdentifier),
    encodeURIComponent(frame.world.frame.identifier),
    encodeURIComponent(targetNodeKey),
  ].join(":");
}

function validateReflectionShape(reflection, workspaceIdentifier, label) {
  validateWorkspace(reflection, workspaceIdentifier, label);
  if (!nonEmptyText(reflection.identifier) || !nonEmptyText(reflection.knowledge)
    || !Array.isArray(reflection.sources) || reflection.sources.length === 0) {
    throw new CognitiveTraceError("MISSING_EVIDENCE", `${label} is not a complete derived Reflection.`);
  }
}

function isExactReflectionTarget(node) {
  if (!node || node.aggregate || node.kind !== "reflection" || node.family !== "Reflection") return false;
  const path = node.observationPath ?? "";
  return /^Reflection\.values\[(0|[1-9]\d*)\]$/.test(path)
    || /^Reflection\.sessions\[(0|[1-9]\d*)\]\.reflection$/.test(path);
}

export function resolveCognitiveTraceTarget(world, selectedNodeKey) {
  if (!world || !Array.isArray(world.nodes) || !Array.isArray(world.edges)
    || !nonEmptyText(selectedNodeKey)) return null;
  const selected = world.nodes.find((node) => node.key === selectedNodeKey);
  if (!selected) return null;
  if (isExactReflectionTarget(selected)) return selected;

  const mayOwnReflection = selected.kind === "reflection"
    && (selected.aggregate || selected.family === "Reflection session");
  if (!mayOwnReflection) return null;

  const directlyOwnedKeys = new Set(world.edges
    .filter((edge) => edge.from === selected.key && edge.relation === "contains")
    .map((edge) => edge.to));
  const candidates = world.nodes.filter((node) => (
    directlyOwnedKeys.has(node.key)
    && isExactReflectionTarget(node)
    && (selected.family === "Reflection session"
      ? node.observationPath === `${selected.observationPath}.reflection`
      : /^Reflection\.values\[(0|[1-9]\d*)\]$/.test(node.observationPath ?? ""))
  ));
  return candidates.length === 1 ? candidates[0] : null;
}

function matchingReflection(frame, targetNodeKey) {
  const target = frame.world.nodes.find((node) => node.key === targetNodeKey);
  if (!target) throw new CognitiveTraceError("NOT_FOUND");
  if (target.aggregate || target.kind !== "reflection" || target.family !== "Reflection") {
    throw new CognitiveTraceError("INVALID_TARGET");
  }

  const standalone = /^Reflection\.values\[(0|[1-9]\d*)\]$/.exec(target.observationPath ?? "");
  if (standalone) {
    const index = Number(standalone[1]);
    const reflection = frame.snapshot.reflections?.[index];
    if (!reflection || reflection.identifier !== target.identifier) throw new CognitiveTraceError("NOT_FOUND");
    validateReflectionShape(reflection, frame.snapshot.workspaceIdentifier, "Reflection");
    return { reflection, reflectionPath: `Reflection.values[${index}]`, target };
  }

  const nested = /^Reflection\.sessions\[(0|[1-9]\d*)\]\.reflection$/.exec(target.observationPath ?? "");
  if (!nested) throw new CognitiveTraceError("INVALID_TARGET");
  const index = Number(nested[1]);
  const session = frame.snapshot.reflectionSessions?.[index];
  const reflection = session?.reflection;
  if (!reflection || reflection.identifier !== target.identifier) throw new CognitiveTraceError("NOT_FOUND");
  validateWorkspace(session, frame.snapshot.workspaceIdentifier, "Reflection session");
  validateReflectionShape(reflection, frame.snapshot.workspaceIdentifier, "Reflection session result");
  if (session.state !== "Derived" || !session.query || !nonEmptyText(session.query.identifier)
    || !nonEmptyText(session.query?.knowledge)
    || session.query.identifier !== reflection.identifier
    || session.query.knowledge !== reflection.knowledge
    || !Array.isArray(session.sources) || !Array.isArray(reflection.sources)
    || canonicalObservation(session.sources) !== canonicalObservation(reflection.sources)) {
    throw new CognitiveTraceError("INCONSISTENT_EVIDENCE", "A derived ReflectionSession must preserve its query, result, and ordered source candidates exactly.");
  }
  validateWorkspace(session.query, frame.snapshot.workspaceIdentifier, "Reflection session query");
  return { reflection, reflectionPath: `Reflection.sessions[${index}].reflection`, target };
}

function validateCandidateSource(source, sourceDefinition, workspaceIdentifier) {
  validateWorkspace(source, workspaceIdentifier, "Reflection source candidate");
  if (!nonEmptyText(source.sourceIdentifier)
    || !Number.isSafeInteger(source.rankScore) || source.rankScore < 0 || source.rankScore > 0xffffffff
    || !Array.isArray(source.chain) || source.chain.length === 0
    || !source.chain.every(nonEmptyText)) {
    throw new CognitiveTraceError("INCONSISTENT_EVIDENCE", "A Reflection source candidate is incomplete.");
  }
  const typedFields = Object.values(supportedSources).map(({ field }) => field);
  const populated = typedFields.filter((field) => source[field] !== null && source[field] !== undefined);
  if (populated.length !== 1 || populated[0] !== sourceDefinition.field) {
    throw new CognitiveTraceError("INCONSISTENT_EVIDENCE", "A Reflection source candidate must own exactly one value of its declared kind.");
  }
  const sourceValue = source[sourceDefinition.field];
  if (!sourceValue || sourceValue.identifier !== source.sourceIdentifier) {
    throw new CognitiveTraceError("INCONSISTENT_EVIDENCE", "A Reflection source candidate does not identify its owned value.");
  }
  if (!Array.isArray(sourceValue.sourceEntries) || sourceValue.sourceEntries.length === 0) {
    throw new CognitiveTraceError("MISSING_EVIDENCE", "A Reflection source candidate has no owned Long-Term evidence.");
  }
  sourceValue.sourceEntries.forEach((entry) => {
    if (!entry || !nonEmptyText(entry.identifier)) {
      throw new CognitiveTraceError("INCONSISTENT_EVIDENCE", "An owned Long-Term evidence value has no identifier.");
    }
  });
  return sourceValue;
}

function constructCognitiveTrace(frame, targetNodeKey) {
  requireObservationFrame(frame);
  if (!nonEmptyText(targetNodeKey)) throw new CognitiveTraceError("INVALID_QUERY");
  const workspaceIdentifier = frame.snapshot.workspaceIdentifier;
  const { reflection, reflectionPath, target } = matchingReflection(frame, targetNodeKey);
  const sourceIdentities = new Set();

  const branches = reflection.sources.map((source, sourceIndex) => {
    const sourceDefinition = supportedSources[source?.kind];
    if (!sourceDefinition) {
      throw new CognitiveTraceError("INCONSISTENT_EVIDENCE", "A Reflection source candidate has an unsupported kind.");
    }
    const sourceIdentity = `${source.kind}:${source.sourceIdentifier}`;
    if (sourceIdentities.has(sourceIdentity)) {
      throw new CognitiveTraceError("AMBIGUOUS_EVIDENCE", "A Reflection contains a duplicate typed source candidate.");
    }
    sourceIdentities.add(sourceIdentity);
    if (source.sourceIdentifier === reflection.identifier) {
      throw new CognitiveTraceError("INCONSISTENT_EVIDENCE", "A Reflection cannot use its own target identity as a source candidate.");
    }
    const sourceValue = validateCandidateSource(source, sourceDefinition, workspaceIdentifier);
    const sourceReferencePath = `${reflectionPath}.sources[${sourceIndex}]`;
    const sourceValuePath = `${sourceReferencePath}.${sourceDefinition.field}`;
    const candidateNode = worldNodeAtPath(frame.world, sourceReferencePath, "retrieval", "Reflection-owned candidate node");
    const sourceNode = worldNodeAtPath(frame.world, sourceValuePath, sourceDefinition.kind, "Reflection-owned source node");
    const sourceLink = worldEdge(frame.world, candidateNode.key, sourceNode.key, "links", "Reflection-owned retrieval relationship");
    const contribution = worldEdge(frame.world, candidateNode.key, target.key, "contributes", "Reflection contribution");
    const steps = [];

    sourceValue.sourceEntries.forEach((entry, evidenceIndex) => {
      const evidencePath = `${sourceValuePath}.sourceEntries[${evidenceIndex}]`;
      const evidenceNode = worldNodeAtPath(frame.world, evidencePath, "long-term", "Reflection-owned evidence node");
      const evidenceEdge = worldEdge(frame.world, evidenceNode.key, sourceNode.key, "evidence", "Owned evidence relationship");
      steps.push({ sequence: steps.length, role: "origin-evidence", nodeKey: evidenceNode.key, edgeKey: evidenceEdge.key, direction: "forward" });
    });
    steps.push({ sequence: steps.length, role: "semantic-transformation", nodeKey: sourceNode.key, edgeKey: sourceLink.key, direction: "reverse" });
    steps.push({ sequence: steps.length, role: "retrieval", nodeKey: candidateNode.key, edgeKey: contribution.key, direction: "forward" });
    steps.push({ sequence: steps.length, role: "reflection-current", nodeKey: target.key, edgeKey: null, direction: null });
    return { sequence: sourceIndex, sourceReferencePath, steps };
  });

  return deepFreeze({
    kind: "MemoryOSCognitiveTrace",
    version: "1.1",
    identifier: traceIdentifier(frame, target.key),
    workspaceIdentifier,
    sessionIdentifier: frame.world.frame.sessionIdentifier ?? null,
    frameIdentifier: frame.world.frame.identifier,
    frameSequence: frame.sequence,
    targetNodeKey: target.key,
    branches,
  });
}

function basicTraceIssues(trace, frame) {
  const issues = [];
  const report = (code, message) => issues.push({ sequence: issues.length, code, message });
  if (!trace || trace.kind !== "MemoryOSCognitiveTrace" || trace.version !== "1.1") {
    report("INVALID_MODEL", "The value is not a MemoryOS 1.1 Cognitive Trace.");
    return issues;
  }
  if (!deeplyFrozen(trace)) {
    report("MUTABLE_TRACE", "A Cognitive Trace and every nested member must be immutable.");
  }
  if (!nonEmptyText(trace.identifier)) report("INVALID_IDENTIFIER", "A Cognitive Trace requires an identifier.");
  if (trace.workspaceIdentifier !== frame.snapshot.workspaceIdentifier) report("WORKSPACE_MISMATCH", resultMessages.WORKSPACE_MISMATCH);
  if (trace.sessionIdentifier !== (frame.world.frame.sessionIdentifier ?? null)) report("SESSION_MISMATCH", resultMessages.SESSION_MISMATCH);
  if (trace.frameIdentifier !== frame.world.frame.identifier || trace.frameSequence !== frame.sequence) report("FRAME_MISMATCH", resultMessages.FRAME_MISMATCH);
  if (!nonEmptyText(trace.targetNodeKey)) report("INVALID_TARGET", resultMessages.INVALID_TARGET);
  if (!Array.isArray(trace.branches) || trace.branches.length === 0) {
    report("MISSING_BRANCH", "A Cognitive Trace requires at least one source branch.");
    return issues;
  }

  const worldNodes = new Map(frame.world.nodes.map((node) => [node.key, node]));
  const worldEdges = new Map(frame.world.edges.map((edge) => [edge.key, edge]));
  trace.branches.forEach((branch, branchIndex) => {
    if (branch.sequence !== branchIndex) report("INVALID_BRANCH_ORDER", "Trace branch sequences must be contiguous.");
    if (!nonEmptyText(branch.sourceReferencePath)) report("INVALID_SOURCE_REFERENCE", "A trace branch requires its exact source reference path.");
    if (!Array.isArray(branch.steps) || branch.steps.length < 4) {
      report("MISSING_STEP", "Every trace branch requires evidence, transformation, retrieval, and current Reflection steps.");
      return;
    }
    let previousRole = -1;
    const roleCounts = new Map(cognitiveTraceRoles.map((role) => [role, 0]));
    const branchNodes = new Set();
    branch.steps.forEach((step, stepIndex) => {
      if (step.sequence !== stepIndex) report("INVALID_STEP_ORDER", "Trace step sequences must be contiguous.");
      const order = roleOrder.get(step.role);
      if (order === undefined || order < previousRole) report("INVALID_ROLE_ORDER", "Trace roles must use the frozen cognitive order.");
      else previousRole = order;
      if (order !== undefined) roleCounts.set(step.role, roleCounts.get(step.role) + 1);
      const node = worldNodes.get(step.nodeKey);
      if (!node) report("UNKNOWN_NODE", `Trace node '${step.nodeKey}' is not present in the bound semantic world.`);
      branchNodes.add(step.nodeKey);
      if (step.edgeKey !== null) {
        const edge = worldEdges.get(step.edgeKey);
        if (!edge) report("UNKNOWN_RELATIONSHIP", `Trace relationship '${step.edgeKey}' is not present in the bound semantic world.`);
        else if (edge.from !== step.nodeKey && edge.to !== step.nodeKey) report("INCONSISTENT_RELATIONSHIP", "A trace step relationship does not touch its node.");
        if (!["forward", "reverse"].includes(step.direction)) report("INVALID_DIRECTION", "A trace relationship requires an explicit traversal direction.");
      } else if (step.role !== "reflection-current" || step.direction !== null) {
        report("MISSING_RELATIONSHIP", "Only the current Reflection step may omit a relationship.");
      }
    });
    if (roleCounts.get("origin-evidence") < 1
      || roleCounts.get("semantic-transformation") !== 1
      || roleCounts.get("retrieval") !== 1
      || roleCounts.get("reflection-current") !== 1) {
      report("INVALID_ROLE_CARDINALITY", "Each branch requires one or more origins and exactly one transformation, retrieval, and current Reflection.");
    }
    const terminal = branch.steps.at(-1);
    if (terminal?.role !== "reflection-current" || terminal.nodeKey !== trace.targetNodeKey) {
      report("INVALID_TERMINAL", "Every trace branch must terminate at the selected Reflection.");
    }
    branch.steps.forEach((step) => {
      if (step.edgeKey === null) return;
      const edge = worldEdges.get(step.edgeKey);
      if (edge && (!branchNodes.has(edge.from) || !branchNodes.has(edge.to))) {
        report("RELATIONSHIP_OUTSIDE_BRANCH", "A trace relationship leaves its source branch.");
      }
    });
  });
  return issues;
}

export function validateCognitiveTrace(trace, frame) {
  try {
    requireObservationFrame(frame);
  } catch (error) {
    return deepFreeze({
      kind: "MemoryOSCognitiveTraceValidation",
      version: "1.1",
      valid: false,
      issues: [{ sequence: 0, code: error.code ?? "INVALID_FRAME", message: error.message }],
    });
  }
  if (deeplyFrozen(frame) && validatedTraceBindings.get(trace)?.has(frame)) {
    return deepFreeze({
      kind: "MemoryOSCognitiveTraceValidation",
      version: "1.1",
      valid: true,
      issues: [],
    });
  }
  const issues = basicTraceIssues(trace, frame);
  if (issues.length === 0) {
    try {
      const expected = constructCognitiveTrace(frame, trace.targetNodeKey);
      if (canonicalObservation(trace) !== canonicalObservation(expected)) {
        issues.push({ sequence: issues.length, code: "NON_CANONICAL_TRACE", message: "The trace does not match deterministic reconstruction from its bound frame." });
      }
    } catch (error) {
      issues.push({ sequence: issues.length, code: error.code ?? "INVALID_TRACE", message: error.message });
    }
  }
  const validation = deepFreeze({ kind: "MemoryOSCognitiveTraceValidation", version: "1.1", valid: issues.length === 0, issues });
  if (validation.valid && deeplyFrozen(trace) && deeplyFrozen(frame)) {
    validatedTraceInstances.add(trace);
    const frames = validatedTraceBindings.get(trace) ?? new WeakSet();
    frames.add(frame);
    validatedTraceBindings.set(trace, frames);
  }
  return validation;
}

export function buildCognitiveTrace(frame, targetNodeKey) {
  const trace = constructCognitiveTrace(frame, targetNodeKey);
  const validation = validateCognitiveTrace(trace, frame);
  if (!validation.valid) throw new CognitiveTraceError("INVALID_TRACE", validation.issues[0]?.message);
  return trace;
}

export function createCognitiveTraceQuery({ workspaceIdentifier, sessionIdentifier, frameIdentifier, targetNodeKey }) {
  if (![workspaceIdentifier, frameIdentifier, targetNodeKey].every(nonEmptyText)
    || (sessionIdentifier !== null && !nonEmptyText(sessionIdentifier))) throw new CognitiveTraceError("INVALID_QUERY");
  return deepFreeze({ kind: "MemoryOSCognitiveTraceQuery", version: "1.1", workspaceIdentifier, sessionIdentifier, frameIdentifier, targetNodeKey });
}

function queryResult(code, trace = null, validation = null, message = null) {
  return deepFreeze({
    kind: "MemoryOSCognitiveTraceResult",
    version: "1.1",
    succeeded: code === "OK",
    code,
    message: message ?? resultMessages[code] ?? resultMessages.INVALID_TRACE,
    trace,
    validation,
  });
}

export function queryCognitiveTrace(frame, query) {
  try {
    requireObservationFrame(frame);
    if (!query || query.kind !== "MemoryOSCognitiveTraceQuery" || query.version !== "1.1"
      || !nonEmptyText(query.workspaceIdentifier) || !nonEmptyText(query.frameIdentifier)
      || !nonEmptyText(query.targetNodeKey)) return queryResult("INVALID_QUERY");
    if (query.workspaceIdentifier !== frame.snapshot.workspaceIdentifier) return queryResult("WORKSPACE_MISMATCH");
    if (query.sessionIdentifier !== (frame.world.frame.sessionIdentifier ?? null)) return queryResult("SESSION_MISMATCH");
    if (query.frameIdentifier !== frame.world.frame.identifier) return queryResult("FRAME_MISMATCH");
    const trace = constructCognitiveTrace(frame, query.targetNodeKey);
    const validation = validateCognitiveTrace(trace, frame);
    return validation.valid
      ? queryResult("OK", trace, validation)
      : queryResult("INVALID_TRACE", null, validation, validation.issues[0]?.message);
  } catch (error) {
    if (error instanceof CognitiveTraceError) return queryResult(error.code, null, null, error.message);
    throw error;
  }
}

export function serializeCognitiveTrace(trace) {
  if (!trace || !validatedTraceInstances.has(trace) || !deeplyFrozen(trace)) {
    throw new CognitiveTraceError("INVALID_TRACE", "Only an immutable, validated Cognitive Trace can be serialized.");
  }
  return canonicalObservation(trace);
}

export function deserializeCognitiveTrace(serialized, frame) {
  if (typeof serialized !== "string" || serialized.length === 0) throw new CognitiveTraceError("INVALID_TRACE");
  let trace;
  try {
    trace = deepFreeze(JSON.parse(serialized));
  } catch {
    throw new CognitiveTraceError("INVALID_TRACE", "The serialized Cognitive Trace is not valid JSON.");
  }
  const validation = validateCognitiveTrace(trace, frame);
  if (!validation.valid) throw new CognitiveTraceError("INVALID_TRACE", validation.issues[0]?.message);
  return trace;
}
