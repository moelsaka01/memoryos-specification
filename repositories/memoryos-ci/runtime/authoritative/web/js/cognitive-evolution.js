import {
  canonicalObservation,
  createSemanticWorld,
  fingerprintObservation,
} from "./semantic-world.js";
import { buildGraph } from "./studio-model.js";

const semanticTransformationFamilies = new Set([
  "SemanticMemory",
  "EpisodicMemory",
  "ProceduralMemory",
]);
const validatedObservationFrames = new WeakSet();

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

function compareText(left, right) {
  const a = String(left);
  const b = String(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function requireFrame(frame, label) {
  if (!frame || frame.kind !== "MemoryOSObservationFrame" || frame.version !== "1.1") {
    throw new TypeError(`${label} must be an immutable MemoryOS 1.1 Observation Frame.`);
  }
  if (validatedObservationFrames.has(frame)) return;
  if (!Object.isFrozen(frame) || !Object.isFrozen(frame.snapshot) || !Object.isFrozen(frame.world)) {
    throw new TypeError(`${label} must be immutable.`);
  }
  if (!Number.isSafeInteger(frame.sequence) || frame.sequence < 0) {
    throw new TypeError(`${label} has an invalid observation sequence.`);
  }
  if (!Array.isArray(frame.world.nodes) || !Array.isArray(frame.world.edges)) {
    throw new TypeError(`${label} has an invalid semantic world.`);
  }
  if (frame.world.frame?.workspaceIdentifier !== frame.snapshot.workspaceIdentifier
    || (frame.world.frame?.sessionIdentifier ?? null) !== (frame.snapshot.session?.identifier ?? null)
    || frame.world.frame?.observationFingerprint !== fingerprintObservation(frame.snapshot)) {
    throw new TypeError(`${label} is not bound to its immutable observation.`);
  }
  if (new Set(frame.world.nodes.map(({ key }) => key)).size !== frame.world.nodes.length
    || new Set(frame.world.edges.map(({ key }) => key)).size !== frame.world.edges.length) {
    throw new TypeError(`${label} contains duplicate semantic-world identities.`);
  }
  let projected;
  try {
    projected = createSemanticWorld(buildGraph(frame.snapshot), {
      frameIndex: frame.sequence,
      observationFingerprint: fingerprintObservation(frame.snapshot),
      observationIdentifier: frame.snapshot.observationIdentifier,
      workspaceIdentifier: frame.snapshot.workspaceIdentifier,
      sessionIdentifier: frame.snapshot.session?.identifier,
      source: frame.snapshot.source,
    });
  } catch (error) {
    throw new TypeError(`${label} cannot be projected deterministically: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (canonicalObservation(projected) !== canonicalObservation(frame.world)) {
    throw new TypeError(`${label} semantic world is not the canonical projection of runtime truth.`);
  }
  if (deeplyFrozen(frame)) validatedObservationFrames.add(frame);
}

function semanticCategory(node) {
  if (node.aggregate || node.detail) return null;
  if (node.kind === "long-term" && node.family === "LongTermMemory") return "evidence";
  if (["semantic", "episodic", "procedural"].includes(node.kind)
    && semanticTransformationFamilies.has(node.family)) return "semanticTransformations";
  if (node.kind === "retrieval" && node.family === "Retrieval session") return "retrievals";
  if (node.kind === "reflection" && node.family === "Reflection") return "reflections";
  return null;
}

function authoritativeNodes(frame) {
  return new Map(frame.world.nodes
    .filter((node) => semanticCategory(node) !== null)
    .map((node) => [node.key, node]));
}

function semanticRelationships(frame) {
  return new Map(frame.world.edges
    .filter((edge) => edge.relation !== "contains")
    .map((edge) => [edge.key, edge]));
}

function relationshipRevision(edge) {
  const { key: ignoredKey, flowKind: ignoredFlowKind, ...semantic } = edge;
  return canonicalObservation(semantic);
}

function nodeReference(node, frameIdentifier, revision = node.revision ?? null) {
  return {
    key: node.key,
    identifier: node.identifier,
    kind: node.kind,
    family: node.family,
    frameIdentifier,
    revisionFingerprint: fingerprintObservation(revision),
  };
}

function relationshipReference(edge, frameIdentifier, revision = relationshipRevision(edge)) {
  return {
    key: edge.key,
    from: edge.from,
    to: edge.to,
    relation: edge.relation,
    frameIdentifier,
    revisionFingerprint: fingerprintObservation(revision),
  };
}

function sorted(values) {
  return values.sort((left, right) => compareText(left.key, right.key));
}

function compareNodes(before, after, fromIdentifier, toIdentifier) {
  const differences = {
    addedEvidence: [],
    removedEvidence: [],
    addedSemanticTransformations: [],
    removedSemanticTransformations: [],
    addedRetrievals: [],
    removedRetrievals: [],
    addedReflections: [],
    removedReflections: [],
  };
  const evolvedNodeKeys = [];
  const unchangedNodeKeys = [];
  const addedNodeKeys = [];
  const removedNodeKeys = [];
  const propertyFor = (prefix, category) => `${prefix}${category[0].toUpperCase()}${category.slice(1)}`;

  [...new Set([...before.keys(), ...after.keys()])].sort(compareText).forEach((key) => {
    const earlier = before.get(key);
    const current = after.get(key);
    if (!earlier) {
      differences[propertyFor("added", semanticCategory(current))].push(nodeReference(current, toIdentifier));
      addedNodeKeys.push(key);
      return;
    }
    if (!current) {
      differences[propertyFor("removed", semanticCategory(earlier))].push(nodeReference(earlier, fromIdentifier));
      removedNodeKeys.push(key);
      return;
    }
    if ((earlier.revision ?? null) === (current.revision ?? null)) {
      unchangedNodeKeys.push(key);
      return;
    }

    // A changed semantic object is represented using the supported contract as
    // one removed semantic version and one added semantic version. The shared
    // stable key lets the renderer present the pair as one evolved identity.
    differences[propertyFor("removed", semanticCategory(earlier))]
      .push(nodeReference(earlier, fromIdentifier));
    differences[propertyFor("added", semanticCategory(current))]
      .push(nodeReference(current, toIdentifier));
    evolvedNodeKeys.push(key);
  });

  Object.values(differences).forEach(sorted);
  return {
    differences,
    projection: {
      addedNodeKeys: addedNodeKeys.sort(compareText),
      removedNodeKeys: removedNodeKeys.sort(compareText),
      evolvedNodeKeys: evolvedNodeKeys.sort(compareText),
      unchangedNodeKeys: unchangedNodeKeys.sort(compareText),
    },
  };
}

function compareRelationships(before, after, fromIdentifier, toIdentifier) {
  const addedRelationships = [];
  const removedRelationships = [];
  const modifiedRelationships = [];
  const addedRelationshipKeys = [];
  const removedRelationshipKeys = [];
  const modifiedRelationshipKeys = [];
  const unchangedRelationshipKeys = [];

  [...new Set([...before.keys(), ...after.keys()])].sort(compareText).forEach((key) => {
    const earlier = before.get(key);
    const current = after.get(key);
    if (!earlier) {
      addedRelationships.push(relationshipReference(current, toIdentifier));
      addedRelationshipKeys.push(key);
      return;
    }
    if (!current) {
      removedRelationships.push(relationshipReference(earlier, fromIdentifier));
      removedRelationshipKeys.push(key);
      return;
    }
    const earlierRevision = relationshipRevision(earlier);
    const currentRevision = relationshipRevision(current);
    if (earlierRevision === currentRevision) {
      unchangedRelationshipKeys.push(key);
      return;
    }
    modifiedRelationships.push({
      key,
      from: current.from,
      to: current.to,
      relation: current.relation,
      fromFrameIdentifier: fromIdentifier,
      toFrameIdentifier: toIdentifier,
      beforeRevisionFingerprint: fingerprintObservation(earlierRevision),
      afterRevisionFingerprint: fingerprintObservation(currentRevision),
    });
    modifiedRelationshipKeys.push(key);
  });

  return {
    differences: {
      addedRelationships: sorted(addedRelationships),
      removedRelationships: sorted(removedRelationships),
      modifiedRelationships: sorted(modifiedRelationships),
    },
    projection: {
      addedRelationshipKeys: addedRelationshipKeys.sort(compareText),
      removedRelationshipKeys: removedRelationshipKeys.sort(compareText),
      modifiedRelationshipKeys: modifiedRelationshipKeys.sort(compareText),
      unchangedRelationshipKeys: unchangedRelationshipKeys.sort(compareText),
    },
  };
}

function unionByKey(before, after) {
  const combined = new Map(before.map((value) => [value.key, value]));
  after.forEach((value) => combined.set(value.key, value));
  return [...combined.values()].sort((left, right) => compareText(left.key, right.key));
}

function comparisonWorld(fromFrame, toFrame, identifier) {
  return {
    kind: "MemoryOSCognitiveEvolutionWorld",
    version: "1.1",
    identity: "Cognitive evolution",
    description: "A deterministic semantic union of two observed cognitive states.",
    layout: toFrame.world.layout,
    frame: {
      ...toFrame.world.frame,
      identifier,
      comparison: {
        fromFrameIdentifier: fromFrame.world.frame.identifier,
        toFrameIdentifier: toFrame.world.frame.identifier,
      },
    },
    nodes: unionByKey(fromFrame.world.nodes, toFrame.world.nodes),
    edges: unionByKey(fromFrame.world.edges, toFrame.world.edges),
  };
}

function summary(differences) {
  return Object.fromEntries(Object.entries(differences).map(([key, values]) => [key, values.length]));
}

export function compareCognitiveEvolution(fromFrame, toFrame) {
  requireFrame(fromFrame, "Frame A");
  requireFrame(toFrame, "Frame B");
  if (fromFrame.sequence >= toFrame.sequence) {
    throw new RangeError("Cognitive Evolution requires Frame A to precede Frame B.");
  }
  if (fromFrame.snapshot.workspaceIdentifier !== toFrame.snapshot.workspaceIdentifier) {
    throw new RangeError("Cognitive Evolution cannot cross a Workspace boundary.");
  }
  const fromSession = fromFrame.snapshot.session?.identifier ?? null;
  const toSession = toFrame.snapshot.session?.identifier ?? null;
  if (fromSession !== toSession) {
    throw new RangeError("Cognitive Evolution cannot cross a Studio session boundary.");
  }
  if (fromFrame.world.layout?.identifier !== toFrame.world.layout?.identifier) {
    throw new RangeError("Cognitive Evolution requires one stable semantic geography.");
  }

  const nodeComparison = compareNodes(
    authoritativeNodes(fromFrame),
    authoritativeNodes(toFrame),
    fromFrame.world.frame.identifier,
    toFrame.world.frame.identifier,
  );
  const relationshipComparison = compareRelationships(
    semanticRelationships(fromFrame),
    semanticRelationships(toFrame),
    fromFrame.world.frame.identifier,
    toFrame.world.frame.identifier,
  );
  const differences = {
    ...nodeComparison.differences,
    ...relationshipComparison.differences,
  };
  const identifier = `evolution:${fromFrame.sequence}:${toFrame.sequence}:${fingerprintObservation({
    workspaceIdentifier: fromFrame.snapshot.workspaceIdentifier,
    fromFrameIdentifier: fromFrame.world.frame.identifier,
    toFrameIdentifier: toFrame.world.frame.identifier,
    differences,
  })}`;
  const evolution = {
    kind: "MemoryOSCognitiveEvolution",
    version: "1.1",
    identifier,
    workspaceIdentifier: fromFrame.snapshot.workspaceIdentifier,
    sessionIdentifier: fromSession,
    from: {
      sequence: fromFrame.sequence,
      frameIdentifier: fromFrame.world.frame.identifier,
      observationIdentifier: fromFrame.snapshot.observationIdentifier,
    },
    to: {
      sequence: toFrame.sequence,
      frameIdentifier: toFrame.world.frame.identifier,
      observationIdentifier: toFrame.snapshot.observationIdentifier,
    },
    differences,
    summary: summary(differences),
    unchanged: {
      nodeKeys: nodeComparison.projection.unchangedNodeKeys,
      relationshipKeys: relationshipComparison.projection.unchangedRelationshipKeys,
    },
    view: {
      kind: "MemoryOSCognitiveEvolutionView",
      version: "1.1",
      identifier,
      ...nodeComparison.projection,
      ...relationshipComparison.projection,
    },
    world: comparisonWorld(fromFrame, toFrame, identifier),
  };
  return deepFreeze(evolution);
}

export function validateCognitiveEvolution(evolution) {
  if (!evolution || evolution.kind !== "MemoryOSCognitiveEvolution" || evolution.version !== "1.1") {
    throw new TypeError("A MemoryOS 1.1 Cognitive Evolution is required.");
  }
  if (!Object.isFrozen(evolution) || !Object.isFrozen(evolution.differences)
    || !Object.isFrozen(evolution.view) || !Object.isFrozen(evolution.world)) {
    throw new TypeError("Cognitive Evolution must be immutable.");
  }
  if (evolution.from.sequence >= evolution.to.sequence) {
    throw new RangeError("Cognitive Evolution observation order is invalid.");
  }
  const worldNodeKeys = new Set(evolution.world.nodes.map(({ key }) => key));
  const worldEdgeKeys = new Set(evolution.world.edges.map(({ key }) => key));
  [
    ...evolution.view.addedNodeKeys,
    ...evolution.view.removedNodeKeys,
    ...evolution.view.evolvedNodeKeys,
    ...evolution.view.unchangedNodeKeys,
  ].forEach((key) => {
    if (!worldNodeKeys.has(key)) throw new TypeError(`Evolution node '${key}' is absent from its semantic world.`);
  });
  [
    ...evolution.view.addedRelationshipKeys,
    ...evolution.view.removedRelationshipKeys,
    ...evolution.view.modifiedRelationshipKeys,
    ...evolution.view.unchangedRelationshipKeys,
  ].forEach((key) => {
    if (!worldEdgeKeys.has(key)) throw new TypeError(`Evolution relationship '${key}' is absent from its semantic world.`);
  });
  return true;
}
