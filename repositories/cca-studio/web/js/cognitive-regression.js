import {
  canonicalize,
  deepFreeze,
  mipDigest,
} from "./mip-canonical.js";

export const COGNITIVE_REGRESSION_VERSION = "1.0.0";

export const RegressionCategory = Object.freeze({
  Replay: "replay",
  Reflection: "reflection",
  Evidence: "evidence",
  Retrieval: "retrieval",
  Evolution: "evolution",
  Verification: "verification",
  Transition: "transition",
  Lifecycle: "lifecycle",
});

const categoryOrder = Object.freeze(Object.values(RegressionCategory));
const categoryStatus = new Set(["identical", "changed"]);
const changeKinds = new Set(["added", "removed", "modified"]);
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const validatedInvestigations = new WeakSet();
const semanticFamily = Object.freeze({
  evidence: Object.freeze({ family: "LongTermMemory", kind: "long-term" }),
  reflection: Object.freeze({ family: "Reflection", kind: "reflection" }),
  retrieval: Object.freeze({ family: "Retrieval session", kind: "retrieval" }),
});
const semanticTransformationFamilies = new Set([
  "SemanticMemory",
  "EpisodicMemory",
  "ProceduralMemory",
]);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactMembers(value, members) {
  return value && typeof value === "object" && !Array.isArray(value)
    && canonicalize(Object.keys(value).sort()) === canonicalize([...members].sort());
}

function hasExpectedPrototype(value, name) {
  return Object.getPrototypeOf(value)?.constructor?.name === name;
}

function requireInvestigation(value, label) {
  if (value && validatedInvestigations.has(value)) return value;
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
    || !digestPattern.test(value.transitionLog.digest)
    || typeof value.state.workspaceIdentifier !== "string"
    || value.state.workspaceIdentifier.length === 0
    || !["mip", "native"].includes(value.state.sourceKind)
    || !Array.isArray(value.transitionLog.transitions)
    || !Object.isFrozen(value)
    || !Object.isFrozen(value.state)
    || !Object.isFrozen(value.transitionLog)
    || !Object.isFrozen(value.transitionLog.transitions)
    || value.transitionLog.transitions.some((transition, index) => (
      !transition || !Object.isFrozen(transition)
      || !exactMembers(transition, [
        "identifier", "index", "investigationIdentifier", "kind", "payload",
        "previousLogDigest", "version",
      ])
      || !hasExpectedPrototype(transition, "Transition")
      || transition.index !== index
      || transition.investigationIdentifier !== value.identifier
      || transition.version !== value.version
      || !digestPattern.test(transition.identifier)
      || !digestPattern.test(transition.previousLogDigest)
    ))
    || !deeplyFrozen(value)) {
    throw new TypeError(`${label} must be an immutable Investigation Core investigation.`);
  }
  validatedInvestigations.add(value);
  return value;
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
  return (state.currentPackageObservation?.records ?? [])
    .filter((record) => record.role === role)
    .map((record) => fact(record.reference, record));
}

function currentNodes(state, category) {
  if (state.sourceKind !== "native") return [];
  const identity = semanticFamily[category];
  return (state.currentFrame?.world.nodes ?? [])
    .filter((node) => !node.aggregate && !node.detail
      && node.family === identity.family && node.kind === identity.kind)
    .map((node) => fact(
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
    ));
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
  return replays.map((replay) => fact(
    { identifier: replay.identifier },
    {
      artifact: replay,
      state: state.activeReplay?.identifier === replay.identifier ? state.replayState : null,
    },
  ));
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
  if (state.sourceKind === "mip") {
    return (state.currentPackageObservation?.records ?? [])
      .filter(({ role }) => role === "semanticTransformation")
      .map((record) => fact(
        { artifact: "semanticTransformation", reference: record.reference },
        record,
      ));
  }
  return (state.currentFrame?.world.nodes ?? [])
    .filter((node) => !node.aggregate && !node.detail
      && semanticTransformationFamilies.has(node.family)
      && ["semantic", "episodic", "procedural"].includes(node.kind))
    .map((node) => fact(
      { artifact: "semanticTransformation", key: node.key },
      {
        family: node.family,
        identifier: node.identifier,
        key: node.key,
        kind: node.kind,
        revision: node.revision ?? null,
      },
    ));
}

function relationshipFacts(state) {
  if (state.sourceKind === "mip") {
    return (state.currentPackageObservation?.relationships ?? []).map((relationship) => fact(
      { artifact: "relationship", reference: relationship.reference },
      relationship,
    ));
  }
  return (state.currentFrame?.world.edges ?? [])
    .filter(({ relation }) => relation !== "contains")
    .map((edge) => {
      const { flowKind: ignoredFlowKind, key, ...semantic } = edge;
      return fact({ artifact: "relationship", key }, semantic);
    });
}

function evolutionFacts(state) {
  const evolutions = state.sourceKind === "mip"
    ? state.package.evolutions
    : state.evolution ? [state.evolution] : [];
  return [
    ...semanticTransformationFacts(state),
    ...relationshipFacts(state),
    ...evolutions.map((evolution) => fact(
      { artifact: "evolution", identifier: evolution.identifier },
      {
        active: state.evolution?.identifier === evolution.identifier,
        artifact: state.sourceKind === "native" ? nativeEvolutionValue(evolution) : evolution,
      },
    )),
  ];
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
  return investigation.transitionLog.transitions.map((transition) => fact(
    { index: transition.index },
    {
      kind: transition.kind,
      payload: normalizedTransitionPayload(transition),
    },
  ));
}

function lifecycleFacts(state) {
  return [fact({ kind: "lifecycle" }, { state: state.lifecycle })];
}

function factsFor(investigation, category) {
  const { state } = investigation;
  if (category === RegressionCategory.Replay) return replayFacts(state);
  if ([RegressionCategory.Reflection, RegressionCategory.Evidence, RegressionCategory.Retrieval]
    .includes(category)) return semanticFacts(state, category);
  if (category === RegressionCategory.Evolution) return evolutionFacts(state);
  if (category === RegressionCategory.Verification) return verificationFacts(state);
  if (category === RegressionCategory.Transition) return transitionFacts(investigation);
  return lifecycleFacts(state);
}

function indexedFacts(values) {
  const result = new Map();
  values.forEach((entry) => {
    const key = canonicalize(entry.subject);
    if (result.has(key)) throw new TypeError(`Regression facts contain duplicate subject ${key}.`);
    result.set(key, entry);
  });
  return result;
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
  const subjectKeys = [...new Set([...before.keys(), ...after.keys()])].sort(compareText);
  const differences = [];
  subjectKeys.forEach((key) => {
    const earlier = before.get(key);
    const current = after.get(key);
    const beforeDigest = earlier ? factDigest(category, earlier.value) : null;
    const afterDigest = current ? factDigest(category, current.value) : null;
    if (beforeDigest === afterDigest) return;
    differences.push({
      change: earlier ? current ? "modified" : "removed" : "added",
      subject: earlier?.subject ?? current.subject,
      beforeDigest,
      afterDigest,
    });
  });
  return {
    category,
    status: differences.length === 0 ? "identical" : "changed",
    differences,
  };
}

function reportIdentifier(material) {
  return `regression:${mipDigest(
    "INVESTIGATION-CORE-REGRESSION-1.0",
    canonicalize(material),
  ).slice(7)}`;
}

function deeplyFrozen(value) {
  if (!value || typeof value !== "object") return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(deeplyFrozen);
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
    || !Array.isArray(report.categories)
    || report.categories.length !== categoryOrder.length) {
    throw new TypeError("A closed immutable MemoryOS Cognitive Regression Report is required.");
  }
  for (const descriptor of [report.baseline, report.candidate]) {
    if (![descriptor.sourceIdentifier, descriptor.sourceKind, descriptor.workspaceIdentifier]
      .every((value) => typeof value === "string" && value.length > 0)
      || !["mip", "native"].includes(descriptor.sourceKind)) {
      throw new TypeError("Regression source descriptors require stable non-empty identities.");
    }
  }
  if (report.baseline.workspaceIdentifier !== report.candidate.workspaceIdentifier
    || report.baseline.sourceKind !== report.candidate.sourceKind) {
    throw new TypeError("Regression sources must share one Workspace and source kind.");
  }
  let detected = false;
  report.categories.forEach((category, categoryIndex) => {
    if (!exactMembers(category, ["category", "differences", "status"])
      || category.category !== categoryOrder[categoryIndex]
      || !categoryStatus.has(category.status)
      || !Array.isArray(category.differences)
      || category.status !== (category.differences.length === 0 ? "identical" : "changed")) {
      throw new TypeError("Regression categories must use the fixed deterministic contract.");
    }
    detected ||= category.status === "changed";
    let previousSubject = null;
    category.differences.forEach((difference) => {
      if (!exactMembers(difference, [
        "afterDigest", "beforeDigest", "change", "subject",
      ]) || !changeKinds.has(difference.change)
        || !difference.subject || typeof difference.subject !== "object"
        || Array.isArray(difference.subject)) {
        throw new TypeError("Regression differences must use the closed factual contract.");
      }
      const before = difference.beforeDigest;
      const after = difference.afterDigest;
      const valid = difference.change === "added"
        ? before === null && digestPattern.test(after)
        : difference.change === "removed"
          ? digestPattern.test(before) && after === null
          : digestPattern.test(before) && digestPattern.test(after) && before !== after;
      if (!valid) throw new TypeError("Regression difference digests do not match their change kind.");
      const subject = canonicalize(difference.subject);
      if (previousSubject !== null && compareText(previousSubject, subject) >= 0) {
        throw new TypeError("Regression differences must be uniquely ordered by subject identity.");
      }
      previousSubject = subject;
    });
  });
  if (report.regressionDetected !== detected
    || report.overall !== (detected ? "regressionDetected" : "identical")) {
    throw new TypeError("Regression overall status does not match its factual categories.");
  }
  const material = {
    baseline: report.baseline,
    candidate: report.candidate,
    categories: report.categories,
    overall: report.overall,
    regressionDetected: report.regressionDetected,
  };
  if (report.identifier !== reportIdentifier(material)) {
    throw new TypeError("Regression report identity does not match its canonical content.");
  }
  return true;
}

export function compareCognitiveRegression(baselineValue, candidateValue) {
  const baselineInvestigation = requireInvestigation(baselineValue, "Baseline");
  const candidateInvestigation = requireInvestigation(candidateValue, "Candidate");
  const baseline = sourceDescriptor(baselineInvestigation);
  const candidate = sourceDescriptor(candidateInvestigation);
  if (baseline.workspaceIdentifier !== candidate.workspaceIdentifier) {
    throw new RangeError("Cognitive Regression cannot cross a Workspace boundary.");
  }
  if (baseline.sourceKind !== candidate.sourceKind) {
    throw new RangeError("Cognitive Regression requires investigations with the same source kind.");
  }
  const categories = categoryOrder.map((category) => compareFacts(
    category,
    factsFor(baselineInvestigation, category),
    factsFor(candidateInvestigation, category),
  ));
  const regressionDetected = categories.some(({ status }) => status === "changed");
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
