import {
  canonicalize,
  mipDigest,
} from "./mip-canonical.js";

const intrinsicReflectApply = Reflect.apply;
const intrinsicObjectFreeze = Object.freeze;
const intrinsicObjectGetPrototypeOf = Object.getPrototypeOf;
const intrinsicObjectIsFrozen = Object.isFrozen;
const intrinsicObjectKeys = Object.keys;
const intrinsicObjectValues = Object.values;
const intrinsicArrayIsArray = Array.isArray;
const intrinsicArraySort = Array.prototype.sort;
const intrinsicRegExpExec = RegExp.prototype.exec;
const intrinsicStringSlice = String.prototype.slice;
const intrinsicSetAdd = Set.prototype.add;
const intrinsicSetHas = Set.prototype.has;
const intrinsicMapGet = Map.prototype.get;
const intrinsicMapHas = Map.prototype.has;
const intrinsicMapSet = Map.prototype.set;
const intrinsicWeakSetAdd = WeakSet.prototype.add;
const intrinsicWeakSetHas = WeakSet.prototype.has;
const IntrinsicMap = Map;
const IntrinsicSet = Set;
const IntrinsicWeakSet = WeakSet;
const IntrinsicRangeError = RangeError;
const IntrinsicTypeError = TypeError;

export const COGNITIVE_REGRESSION_VERSION = "1.0.0";

export const RegressionCategory = intrinsicObjectFreeze({
  Replay: "replay",
  Reflection: "reflection",
  Evidence: "evidence",
  Retrieval: "retrieval",
  Evolution: "evolution",
  Verification: "verification",
  Transition: "transition",
  Lifecycle: "lifecycle",
});

const categoryOrder = intrinsicObjectFreeze(intrinsicObjectValues(RegressionCategory));
const categoryStatus = new IntrinsicSet(["identical", "changed"]);
const changeKinds = new IntrinsicSet(["added", "removed", "modified"]);
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const validatedInvestigations = new IntrinsicWeakSet();
const semanticFamily = intrinsicObjectFreeze({
  evidence: intrinsicObjectFreeze({ family: "LongTermMemory", kind: "long-term" }),
  reflection: intrinsicObjectFreeze({ family: "Reflection", kind: "reflection" }),
  retrieval: intrinsicObjectFreeze({ family: "Retrieval session", kind: "retrieval" }),
});
const semanticTransformationFamilies = new IntrinsicSet([
  "SemanticMemory",
  "EpisodicMemory",
  "ProceduralMemory",
]);

function setHas(set, value) {
  return intrinsicReflectApply(intrinsicSetHas, set, [value]);
}

function matches(pattern, value) {
  return intrinsicReflectApply(intrinsicRegExpExec, pattern, [value]) !== null;
}

function mapGet(map, key) {
  return intrinsicReflectApply(intrinsicMapGet, map, [key]);
}

function mapHas(map, key) {
  return intrinsicReflectApply(intrinsicMapHas, map, [key]);
}

function mapSet(map, key, value) {
  intrinsicReflectApply(intrinsicMapSet, map, [key, value]);
}

function weakSetHas(set, value) {
  return intrinsicReflectApply(intrinsicWeakSetHas, set, [value]);
}

function weakSetAdd(set, value) {
  intrinsicReflectApply(intrinsicWeakSetAdd, set, [value]);
}

function deepFreeze(value, seen = new IntrinsicSet()) {
  if (value === null || typeof value !== "object" || setHas(seen, value)) return value;
  intrinsicReflectApply(intrinsicSetAdd, seen, [value]);
  const children = intrinsicObjectValues(value);
  for (let index = 0; index < children.length; index += 1) {
    deepFreeze(children[index], seen);
  }
  return intrinsicObjectFreeze(value);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactMembers(value, members) {
  if (!value || typeof value !== "object" || intrinsicArrayIsArray(value)) return false;
  const actual = intrinsicObjectKeys(value);
  const expected = [];
  for (let index = 0; index < members.length; index += 1) expected[index] = members[index];
  intrinsicReflectApply(intrinsicArraySort, actual, []);
  intrinsicReflectApply(intrinsicArraySort, expected, []);
  return canonicalize(actual) === canonicalize(expected);
}

function hasExpectedPrototype(value, name) {
  return intrinsicObjectGetPrototypeOf(value)?.constructor?.name === name;
}

function requireInvestigation(value, label) {
  if (value && weakSetHas(validatedInvestigations, value)) return value;
  if (!value || value.kind !== "MemoryOSInvestigation"
    || !exactMembers(value, ["identifier", "kind", "state", "transitionLog", "version"])
    || !hasExpectedPrototype(value, "Investigation")
    || !value.state || value.state.kind !== "MemoryOSInvestigationState"
    || !hasExpectedPrototype(value.state, "InvestigationState")
    || !value.transitionLog || value.transitionLog.kind !== "MemoryOSInvestigationTransitionLog"
    || !exactMembers(value.transitionLog, [
      "digest", "investigationIdentifier", "kind", "transitions", "version",
    ])
    || !hasExpectedPrototype(value.transitionLog, "TransitionLog")
    || typeof value.identifier !== "string" || value.identifier.length === 0
    || value.state.version !== value.version
    || value.transitionLog.version !== value.version
    || value.state.investigationIdentifier !== value.identifier
    || value.transitionLog.investigationIdentifier !== value.identifier
    || !matches(digestPattern, value.transitionLog.digest)
    || typeof value.state.workspaceIdentifier !== "string"
    || value.state.workspaceIdentifier.length === 0
    || (value.state.sourceKind !== "mip" && value.state.sourceKind !== "native")
    || !intrinsicArrayIsArray(value.transitionLog.transitions)
    || !intrinsicObjectIsFrozen(value)
    || !intrinsicObjectIsFrozen(value.state)
    || !intrinsicObjectIsFrozen(value.transitionLog)
    || !intrinsicObjectIsFrozen(value.transitionLog.transitions)
    || !validTransitions(value)
    || !deeplyFrozen(value)) {
    throw new IntrinsicTypeError(`${label} must be an immutable Investigation Core investigation.`);
  }
  weakSetAdd(validatedInvestigations, value);
  return value;
}

function validTransitions(investigation) {
  const transitions = investigation.transitionLog.transitions;
  for (let index = 0; index < transitions.length; index += 1) {
    const transition = transitions[index];
    if (!transition || !intrinsicObjectIsFrozen(transition)
        || !exactMembers(transition, [
          "identifier", "index", "investigationIdentifier", "kind", "payload",
          "previousLogDigest", "version",
        ])
        || !hasExpectedPrototype(transition, "Transition")
        || transition.index !== index
        || transition.investigationIdentifier !== investigation.identifier
        || transition.version !== investigation.version
        || !matches(digestPattern, transition.identifier)
        || !matches(digestPattern, transition.previousLogDigest)) {
      return false;
    }
  }
  return true;
}

function sourceDescriptor(investigation) {
  const { state } = investigation;
  return {
    sourceIdentifier: state.sourceKind === "mip"
      ? state.package.manifest.packageIdentifier
      : investigation.identifier,
    sourceKind: state.sourceKind,
    workspaceIdentifier: state.workspaceIdentifier,
  };
}

function fact(subject, value) {
  return { subject, value };
}

function currentRecords(state, role) {
  if (state.sourceKind !== "mip") return [];
  const records = state.currentPackageObservation?.records ?? [];
  const result = [];
  for (let index = 0; index < records.length; index += 1) {
    if (records[index].role === role) {
      result[result.length] = fact(records[index].reference, records[index]);
    }
  }
  return result;
}

function currentNodes(state, category) {
  if (state.sourceKind !== "native") return [];
  const identity = semanticFamily[category];
  const nodes = state.currentFrame?.world.nodes ?? [];
  const result = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (!node.aggregate && !node.detail
        && node.family === identity.family && node.kind === identity.kind) {
      result[result.length] = fact(
        {
          family: node.family,
          identifier: node.identifier,
          key: node.key,
          kind: node.kind,
        },
        {
          family: node.family,
          identifier: node.identifier,
          key: node.key,
          kind: node.kind,
          revision: node.revision ?? null,
        },
      );
    }
  }
  return result;
}

function semanticFacts(state, category) {
  const role = category === RegressionCategory.Evidence
    ? "evidence"
    : category === RegressionCategory.Reflection
      ? "reflection"
      : "retrieval";
  return state.sourceKind === "mip"
    ? currentRecords(state, role)
    : currentNodes(state, category);
}

function replayFacts(state) {
  const replays = state.sourceKind === "mip"
    ? state.package.replays
    : state.activeReplay ? [state.activeReplay] : [];
  const result = [];
  for (let index = 0; index < replays.length; index += 1) {
    const replay = replays[index];
    result[index] = fact(
      { identifier: replay.identifier },
      {
        artifact: replay,
        state: state.activeReplay?.identifier === replay.identifier ? state.replayState : null,
      },
    );
  }
  return result;
}

function nativeEvolutionValue(evolution) {
  return {
    differences: evolution.differences,
    from: evolution.from,
    identifier: evolution.identifier,
    sessionIdentifier: evolution.sessionIdentifier,
    to: evolution.to,
    workspaceIdentifier: evolution.workspaceIdentifier,
  };
}

function semanticTransformationFacts(state) {
  const result = [];
  if (state.sourceKind === "mip") {
    const records = state.currentPackageObservation?.records ?? [];
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      if (record.role === "semanticTransformation") {
        result[result.length] = fact(
          { artifact: "semanticTransformation", reference: record.reference },
          record,
        );
      }
    }
    return result;
  }
  const nodes = state.currentFrame?.world.nodes ?? [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (!node.aggregate && !node.detail
        && setHas(semanticTransformationFamilies, node.family)
        && (node.kind === "semantic" || node.kind === "episodic" || node.kind === "procedural")) {
      result[result.length] = fact(
        { artifact: "semanticTransformation", key: node.key },
        {
          family: node.family,
          identifier: node.identifier,
          key: node.key,
          kind: node.kind,
          revision: node.revision ?? null,
        },
      );
    }
  }
  return result;
}

function relationshipFacts(state) {
  const result = [];
  if (state.sourceKind === "mip") {
    const relationships = state.currentPackageObservation?.relationships ?? [];
    for (let index = 0; index < relationships.length; index += 1) {
      const relationship = relationships[index];
      result[index] = fact(
        { artifact: "relationship", reference: relationship.reference },
        relationship,
      );
    }
    return result;
  }
  const edges = state.currentFrame?.world.edges ?? [];
  for (let index = 0; index < edges.length; index += 1) {
    const edge = edges[index];
    if (edge.relation !== "contains") {
      const { flowKind: ignoredFlowKind, key, ...semantic } = edge;
      result[result.length] = fact({ artifact: "relationship", key }, semantic);
    }
  }
  return result;
}

function evolutionFacts(state) {
  const evolutions = state.sourceKind === "mip"
    ? state.package.evolutions
    : state.evolution ? [state.evolution] : [];
  const result = [];
  const transformations = semanticTransformationFacts(state);
  for (let index = 0; index < transformations.length; index += 1) {
    result[result.length] = transformations[index];
  }
  const relationships = relationshipFacts(state);
  for (let index = 0; index < relationships.length; index += 1) {
    result[result.length] = relationships[index];
  }
  for (let index = 0; index < evolutions.length; index += 1) {
    const evolution = evolutions[index];
    result[result.length] = fact(
      { artifact: "evolution", identifier: evolution.identifier },
      {
        active: state.evolution?.identifier === evolution.identifier,
        artifact: state.sourceKind === "native" ? nativeEvolutionValue(evolution) : evolution,
      },
    );
  }
  return result;
}

function verificationFacts(state) {
  const core = state.verificationSession
    ? {
      checks: state.verificationSession.checks,
      status: state.verificationSession.status,
    }
    : null;
  return [fact(
    { kind: "verification" },
    {
      core,
      package: state.sourceKind === "mip" ? state.package.verification : null,
    },
  )];
}

function normalizedTransitionPayload(transition) {
  const { kind, payload } = transition;
  if (kind === "CREATED") return { sourceKind: payload.sourceKind };
  if (kind === "OBSERVED") {
    return {
      operation: payload.operation,
      query: payload.query,
      resultCode: payload.resultCode,
      snapshot: payload.snapshot,
    };
  }
  if (kind === "PACKAGE_IMPORTED") {
    return {
      cognitionDigest: payload.package.integrity.cognitionDigest,
    };
  }
  return payload;
}

function transitionFacts(investigation) {
  const transitions = investigation.transitionLog.transitions;
  const result = [];
  for (let index = 0; index < transitions.length; index += 1) {
    const transition = transitions[index];
    result[index] = fact(
      { index: transition.index },
      {
        kind: transition.kind,
        payload: normalizedTransitionPayload(transition),
      },
    );
  }
  return result;
}

function lifecycleFacts(state) {
  return [fact({ kind: "lifecycle" }, { state: state.lifecycle })];
}

function factsFor(investigation, category) {
  const { state } = investigation;
  if (category === RegressionCategory.Replay) return replayFacts(state);
  if (category === RegressionCategory.Reflection
      || category === RegressionCategory.Evidence
      || category === RegressionCategory.Retrieval) return semanticFacts(state, category);
  if (category === RegressionCategory.Evolution) return evolutionFacts(state);
  if (category === RegressionCategory.Verification) return verificationFacts(state);
  if (category === RegressionCategory.Transition) return transitionFacts(investigation);
  return lifecycleFacts(state);
}

function indexedFacts(values) {
  const facts = new IntrinsicMap();
  const keys = [];
  for (let index = 0; index < values.length; index += 1) {
    const entry = values[index];
    const key = canonicalize(entry.subject);
    if (mapHas(facts, key)) {
      throw new IntrinsicTypeError(`Regression facts contain duplicate subject ${key}.`);
    }
    mapSet(facts, key, entry);
    keys[keys.length] = key;
  }
  return { facts, keys };
}

function factDigest(category, value) {
  return mipDigest(
    "INVESTIGATION-CORE-REGRESSION-FACT-1.0",
    category,
    canonicalize(value),
  );
}

function compareFacts(category, beforeValues, afterValues) {
  const before = indexedFacts(beforeValues);
  const after = indexedFacts(afterValues);
  const subjects = new IntrinsicSet();
  const subjectKeys = [];
  for (let index = 0; index < before.keys.length; index += 1) {
    const key = before.keys[index];
    if (!setHas(subjects, key)) {
      intrinsicReflectApply(intrinsicSetAdd, subjects, [key]);
      subjectKeys[subjectKeys.length] = key;
    }
  }
  for (let index = 0; index < after.keys.length; index += 1) {
    const key = after.keys[index];
    if (!setHas(subjects, key)) {
      intrinsicReflectApply(intrinsicSetAdd, subjects, [key]);
      subjectKeys[subjectKeys.length] = key;
    }
  }
  intrinsicReflectApply(intrinsicArraySort, subjectKeys, [compareText]);
  const differences = [];
  for (let index = 0; index < subjectKeys.length; index += 1) {
    const key = subjectKeys[index];
    const earlier = mapGet(before.facts, key);
    const current = mapGet(after.facts, key);
    const beforeDigest = earlier ? factDigest(category, earlier.value) : null;
    const afterDigest = current ? factDigest(category, current.value) : null;
    if (beforeDigest === afterDigest) continue;
    let subject = earlier?.subject ?? current.subject;
    if (category === RegressionCategory.Transition) {
      subject = {
        ...subject,
        transition: {
          afterAction: current?.value.payload?.action ?? null,
          afterKind: current?.value.kind ?? null,
          beforeAction: earlier?.value.payload?.action ?? null,
          beforeKind: earlier?.value.kind ?? null,
        },
      };
    } else if (category === RegressionCategory.Lifecycle) {
      subject = {
        ...subject,
        lifecycle: {
          afterState: current?.value.state ?? null,
          beforeState: earlier?.value.state ?? null,
        },
      };
    }
    differences[differences.length] = {
      change: earlier ? current ? "modified" : "removed" : "added",
      subject,
      beforeDigest,
      afterDigest,
    };
  }
  return {
    category,
    status: differences.length === 0 ? "identical" : "changed",
    differences,
  };
}

function reportIdentifier(material) {
  const digest = mipDigest(
    "INVESTIGATION-CORE-REGRESSION-1.0",
    canonicalize(material),
  );
  return `regression:${intrinsicReflectApply(intrinsicStringSlice, digest, [7])}`;
}

function deeplyFrozen(value) {
  if (!value || typeof value !== "object") return true;
  if (!intrinsicObjectIsFrozen(value)) return false;
  const children = intrinsicObjectValues(value);
  for (let index = 0; index < children.length; index += 1) {
    if (!deeplyFrozen(children[index])) return false;
  }
  return true;
}

export function validateCognitiveRegression(report) {
  if (!exactMembers(report, [
    "baseline", "candidate", "categories", "identifier", "kind", "overall",
    "regressionDetected", "version",
  ]) || report.kind !== "MemoryOSCognitiveRegressionReport"
    || report.version !== COGNITIVE_REGRESSION_VERSION
    || !deeplyFrozen(report)
    || !exactMembers(report.baseline, ["sourceIdentifier", "sourceKind", "workspaceIdentifier"])
    || !exactMembers(report.candidate, ["sourceIdentifier", "sourceKind", "workspaceIdentifier"])
    || !intrinsicArrayIsArray(report.categories)
    || report.categories.length !== categoryOrder.length) {
    throw new IntrinsicTypeError("A closed immutable MemoryOS Cognitive Regression Report is required.");
  }
  const descriptors = [report.baseline, report.candidate];
  for (let index = 0; index < descriptors.length; index += 1) {
    const descriptor = descriptors[index];
    if (typeof descriptor.sourceIdentifier !== "string" || descriptor.sourceIdentifier.length === 0
        || typeof descriptor.sourceKind !== "string" || descriptor.sourceKind.length === 0
        || typeof descriptor.workspaceIdentifier !== "string" || descriptor.workspaceIdentifier.length === 0
        || (descriptor.sourceKind !== "mip" && descriptor.sourceKind !== "native")) {
      throw new IntrinsicTypeError("Regression source descriptors require stable non-empty identities.");
    }
  }
  if (report.baseline.workspaceIdentifier !== report.candidate.workspaceIdentifier
    || report.baseline.sourceKind !== report.candidate.sourceKind) {
    throw new IntrinsicTypeError("Regression sources must share one Workspace and source kind.");
  }
  let detected = false;
  for (let categoryIndex = 0; categoryIndex < report.categories.length; categoryIndex += 1) {
    const category = report.categories[categoryIndex];
    if (!exactMembers(category, ["category", "differences", "status"])
      || category.category !== categoryOrder[categoryIndex]
      || !setHas(categoryStatus, category.status)
      || !intrinsicArrayIsArray(category.differences)
      || category.status !== (category.differences.length === 0 ? "identical" : "changed")) {
      throw new IntrinsicTypeError("Regression categories must use the fixed deterministic contract.");
    }
    detected ||= category.status === "changed";
    let previousSubject = null;
    for (let differenceIndex = 0; differenceIndex < category.differences.length; differenceIndex += 1) {
      const difference = category.differences[differenceIndex];
      if (!exactMembers(difference, [
        "afterDigest", "beforeDigest", "change", "subject",
      ]) || !setHas(changeKinds, difference.change)
        || !difference.subject || typeof difference.subject !== "object"
        || intrinsicArrayIsArray(difference.subject)) {
        throw new IntrinsicTypeError("Regression differences must use the closed factual contract.");
      }
      const before = difference.beforeDigest;
      const after = difference.afterDigest;
      const valid = difference.change === "added"
        ? before === null && matches(digestPattern, after)
        : difference.change === "removed"
          ? matches(digestPattern, before) && after === null
          : matches(digestPattern, before) && matches(digestPattern, after) && before !== after;
      if (!valid) {
        throw new IntrinsicTypeError("Regression difference digests do not match their change kind.");
      }
      const subject = canonicalize(difference.subject);
      if (previousSubject !== null && compareText(previousSubject, subject) >= 0) {
        throw new IntrinsicTypeError("Regression differences must be uniquely ordered by subject identity.");
      }
      previousSubject = subject;
    }
  }
  if (report.regressionDetected !== detected
    || report.overall !== (detected ? "regressionDetected" : "identical")) {
    throw new IntrinsicTypeError("Regression overall status does not match its factual categories.");
  }
  const material = {
    baseline: report.baseline,
    candidate: report.candidate,
    categories: report.categories,
    overall: report.overall,
    regressionDetected: report.regressionDetected,
  };
  if (report.identifier !== reportIdentifier(material)) {
    throw new IntrinsicTypeError("Regression report identity does not match its canonical content.");
  }
  return true;
}

export function compareCognitiveRegression(baselineValue, candidateValue) {
  const baselineInvestigation = requireInvestigation(baselineValue, "Baseline");
  const candidateInvestigation = requireInvestigation(candidateValue, "Candidate");
  const baseline = sourceDescriptor(baselineInvestigation);
  const candidate = sourceDescriptor(candidateInvestigation);
  if (baseline.workspaceIdentifier !== candidate.workspaceIdentifier) {
    throw new IntrinsicRangeError("Cognitive Regression cannot cross a Workspace boundary.");
  }
  if (baseline.sourceKind !== candidate.sourceKind) {
    throw new IntrinsicRangeError("Cognitive Regression requires investigations with the same source kind.");
  }
  const categories = [];
  let regressionDetected = false;
  for (let index = 0; index < categoryOrder.length; index += 1) {
    const category = categoryOrder[index];
    categories[index] = compareFacts(
      category,
      factsFor(baselineInvestigation, category),
      factsFor(candidateInvestigation, category),
    );
    if (categories[index].status === "changed") regressionDetected = true;
  }
  const material = {
    baseline,
    candidate,
    categories,
    overall: regressionDetected ? "regressionDetected" : "identical",
    regressionDetected,
  };
  const report = deepFreeze({
    kind: "MemoryOSCognitiveRegressionReport",
    version: COGNITIVE_REGRESSION_VERSION,
    identifier: reportIdentifier(material),
    ...material,
  });
  validateCognitiveRegression(report);
  return report;
}
