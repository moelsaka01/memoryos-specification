import { InvestigationCore } from "./investigation-core.js";
import {
  INVESTIGATION_POLICY_KIND,
  INVESTIGATION_POLICY_SET_KIND,
  prepareInvestigationPolicy,
  prepareInvestigationPolicySet,
  preparedInvestigationPolicyArtifactEvaluationView,
} from "./investigation-policy.js";
import {
  MACHINE_DEFINITION_IDENTITIES,
  MEMORYOS_POLICY_RESOURCE_PROFILE,
  MEMORYOS_POLICY_RESOURCE_PROFILE_DIGEST,
} from "./investigation-policy-contracts.js";
import {
  POLICY_FACT_MODEL_DIGEST,
  assertAuthoritativePolicyFactContext,
  normalizeAuthoritativeDeterministicFactSources,
  policyFactContextCanonicalBytes,
  policyFactContextDigest,
} from "./policy-fact-context.js";
import {
  DETERMINISTIC_FACT_SOURCE_REGISTRY_DIGEST,
  DETERMINISTIC_FACT_SOURCE_REGISTRY_VERSION,
  REGRESSION_POLICY_FACT_SOURCE_DOMAIN,
  regressionPolicyFactSourceCanonicalBytes,
  regressionPolicyFactSourceDigest,
} from "./regression-policy-fact-source.js";
import {
  MemoryOSPolicyError,
  canonicalizeRestrictedJson,
  domainSeparatedDigest,
  isDottedIdentifier,
  parseRestrictedJson,
  utf8Encode,
} from "./policy-canonical.js";

export const POLICY_EVALUATOR_VERSION = "1.0.0";
export const POLICY_EVALUATION_IDENTITY_KIND = "MemoryOSPolicyEvaluationIdentity";
export const POLICY_EVALUATION_IDENTITY_VERSION = "1.0.0";
export const POLICY_EVALUATION_OUTCOME_KIND = "MemoryOSPolicyEvaluationOutcome";
export const POLICY_EVALUATION_OUTCOME_VERSION = "1.0.0";
export const POLICY_OUTCOME_CONTRACT_VERSION = "1.0.0";
export const POLICY_EVALUATION_IDENTITY_DIGEST_DOMAIN =
  "MEMORYOS-POLICY-EVALUATION-IDENTITY-1.0";
export const POLICY_EVALUATION_OUTCOME_DIGEST_DOMAIN =
  "MEMORYOS-POLICY-EVALUATION-OUTCOME-1.0";

const RULE_REGISTRY_VERSION = "1.0.0";
let RULE_REGISTRY_DIGEST;
for (let index = 0; index < MACHINE_DEFINITION_IDENTITIES.length; index += 1) {
  const entry = MACHINE_DEFINITION_IDENTITIES[index];
  if (entry.identityName === "ruleRegistryDigest") RULE_REGISTRY_DIGEST = entry.normativeDigest;
}
if (RULE_REGISTRY_DIGEST
    !== "sha256:aaa19116563d209f680b063cdccf49d899069683f9778271c4ca2c4559b94fd7") {
  throw new Error("Frozen Policy Rule Registry identity is unavailable.");
}

const LIMITS = MEMORYOS_POLICY_RESOURCE_PROFILE.limits;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DECISIONS = new Set(["PASS", "FAIL", "COULD_NOT_EVALUATE"]);
const POST_IDENTITY_LIMITS = new Set([
  "evaluation.selection-matched-fact-identifier-count",
  "evaluation.evidence-fact-identifier-count",
  "evaluation.evidence-canonical-bytes",
  "evaluation.outcome-canonical-bytes",
]);
const DECISION_CODE_ROWS = Object.freeze({
  PROHIBIT_REGRESSION_FINDINGS_NOT_SATISFIED: "FAIL",
  PROHIBIT_REGRESSION_FINDINGS_SATISFIED: "PASS",
  PROHIBIT_REGRESSION_FINDINGS_SOURCE_NOT_SUPPLIED: "COULD_NOT_EVALUATE",
  REQUIRE_ARTIFACT_CARDINALITY_FACTS_UNAVAILABLE: "COULD_NOT_EVALUATE",
  REQUIRE_ARTIFACT_CARDINALITY_NOT_SATISFIED: "FAIL",
  REQUIRE_ARTIFACT_CARDINALITY_SATISFIED: "PASS",
  REQUIRE_LIFECYCLE_STATE_FACTS_UNAVAILABLE: "COULD_NOT_EVALUATE",
  REQUIRE_LIFECYCLE_STATE_NOT_SATISFIED: "FAIL",
  REQUIRE_LIFECYCLE_STATE_SATISFIED: "PASS",
  REQUIRE_MIP_INTEGRITY_FACTS_UNAVAILABLE: "COULD_NOT_EVALUATE",
  REQUIRE_MIP_INTEGRITY_NOT_SATISFIED: "FAIL",
  REQUIRE_MIP_INTEGRITY_SATISFIED: "PASS",
  REQUIRE_REPLAY_COMPLETED_FACTS_UNAVAILABLE: "COULD_NOT_EVALUATE",
  REQUIRE_REPLAY_COMPLETED_NOT_SATISFIED: "FAIL",
  REQUIRE_REPLAY_COMPLETED_SATISFIED: "PASS",
  REQUIRE_VERIFICATION_COMPLETED_FACTS_UNAVAILABLE: "COULD_NOT_EVALUATE",
  REQUIRE_VERIFICATION_COMPLETED_NOT_SATISFIED: "FAIL",
  REQUIRE_VERIFICATION_COMPLETED_SATISFIED: "PASS",
});
const REGRESSION_CATEGORY_ORDER = Object.freeze([
  "replay", "reflection", "evidence", "retrieval", "evolution",
  "verification", "transition", "lifecycle",
]);

const intrinsicReflectApply = Reflect.apply;
const intrinsicReflectOwnKeys = Reflect.ownKeys;
const intrinsicObjectDefineProperties = Object.defineProperties;
const intrinsicObjectFreeze = Object.freeze;
const intrinsicObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicObjectGetPrototypeOf = Object.getPrototypeOf;
const intrinsicObjectHasOwn = Object.hasOwn;
const intrinsicObjectKeys = Object.keys;
const intrinsicObjectValues = Object.values;
const intrinsicArrayIsArray = Array.isArray;
const intrinsicRegExpExec = RegExp.prototype.exec;
const IntrinsicSet = Set;
const intrinsicSetAdd = Set.prototype.add;
const intrinsicSetHas = Set.prototype.has;
const IntrinsicMap = Map;
const intrinsicMapGet = Map.prototype.get;
const intrinsicMapSet = Map.prototype.set;
const evaluators = new WeakMap();
const evaluations = new WeakMap();
const weakMapGet = WeakMap.prototype.get;
const weakMapHas = WeakMap.prototype.has;
const weakMapSet = WeakMap.prototype.set;
const IntrinsicUint8Array = Uint8Array;
const intrinsicTypedArrayPrototype = intrinsicObjectGetPrototypeOf(Uint8Array.prototype);
const intrinsicTypedArrayByteLengthGetter = intrinsicObjectGetOwnPropertyDescriptor(
  intrinsicTypedArrayPrototype,
  "byteLength",
).get;
const intrinsicUint8ArraySet = Uint8Array.prototype.set;
const EVALUATOR_TOKEN = Symbol("MemoryOS Policy evaluator");
const EVALUATION_TOKEN = Symbol("MemoryOS Policy evaluation");

function privateGet(map, key) {
  return intrinsicReflectApply(weakMapGet, map, [key]);
}

function privateHas(map, key) {
  return intrinsicReflectApply(weakMapHas, map, [key]);
}

function privateSet(map, key, value) {
  intrinsicReflectApply(weakMapSet, map, [key, value]);
}

function byteLength(value) {
  return intrinsicReflectApply(intrinsicTypedArrayByteLengthGetter, value, []);
}

function copyBytes(value) {
  const length = byteLength(value);
  const result = new IntrinsicUint8Array(length);
  intrinsicReflectApply(intrinsicUint8ArraySet, result, [value, 0]);
  return result;
}

function deepFreeze(value, seen = new IntrinsicSet()) {
  if (value === null || typeof value !== "object"
      || intrinsicReflectApply(intrinsicSetHas, seen, [value])) return value;
  intrinsicReflectApply(intrinsicSetAdd, seen, [value]);
  const children = intrinsicObjectValues(value);
  for (let index = 0; index < children.length; index += 1) deepFreeze(children[index], seen);
  return intrinsicObjectFreeze(value);
}

function byteEqual(left, right) {
  const leftLength = byteLength(left);
  const rightLength = byteLength(right);
  if (leftLength !== rightLength) return false;
  for (let index = 0; index < leftLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function exactKeys(value, names) {
  if (value === null || typeof value !== "object" || intrinsicArrayIsArray(value)) return false;
  const actual = intrinsicObjectKeys(value);
  if (actual.length !== names.length) return false;
  for (let index = 0; index < names.length; index += 1) {
    if (!intrinsicObjectHasOwn(value, names[index])) return false;
  }
  return true;
}

function isDigest(value) {
  return typeof value === "string"
    && intrinsicReflectApply(intrinsicRegExpExec, DIGEST_PATTERN, [value]) !== null;
}

function isBoundedIdentifier(value, limitIdentifier) {
  // The frozen dotted-identifier alphabet is ASCII. Reject by code-unit count
  // before invoking either the lexical matcher or UTF-8 encoder so detached
  // outcome validation cannot allocate for an overlong attacker-controlled
  // identifier.
  return typeof value === "string"
    && value.length <= LIMITS[limitIdentifier]
    && isDottedIdentifier(value)
    && byteLength(utf8Encode(value)) <= LIMITS[limitIdentifier];
}

function invariant(condition, message) {
  if (!condition) throw new MemoryOSPolicyEvaluationInvariantError(message);
}

export class MemoryOSPolicyEvaluationInvariantError extends Error {
  constructor(message) {
    super(message);
    this.name = "MemoryOSPolicyEvaluationInvariantError";
    intrinsicObjectFreeze(this);
  }
}
intrinsicObjectFreeze(MemoryOSPolicyEvaluationInvariantError.prototype);

function inputResourceFailure(identifier, artifactKind) {
  const configuredLimit = LIMITS[identifier];
  throw new MemoryOSPolicyError(
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    `Policy evaluation exceeds ${identifier}.`,
    {
      artifactKind,
      configuredLimit,
      enforcementPhase: "H",
      limitIdentifier: identifier,
      observedAtLeast: configuredLimit + 1,
      phase: "policyEvaluation",
    },
  );
}

function coreSource(contextDigest) {
  return { contextDigest, kind: "policyFactContext" };
}

function externalSource(sourceDigest) {
  return { externalSourceDigest: sourceDigest, kind: "deterministicFactSource" };
}

function coreFactReference(domain, fact, contextDigest) {
  return {
    domain,
    factIdentifier: fact.factIdentifier,
    kind: "MemoryOSPolicyFactReference",
    source: coreSource(contextDigest),
  };
}

function coreSelection(domain, selectorIdentifier, parameters, facts, contextDigest) {
  const matchedFactIdentifiers = [];
  for (let index = 0; index < facts.length; index += 1) {
    matchedFactIdentifiers[index] = facts[index].factIdentifier;
  }
  return {
    domain,
    kind: "MemoryOSPolicyFactSelection",
    matchCount: matchedFactIdentifiers.length,
    matchedFactIdentifiers,
    selector: { identifier: selectorIdentifier, parameters, version: "1.0.0" },
    source: coreSource(contextDigest),
  };
}

function externalSelection(sourceDigest, parameters, facts) {
  const matchedFactIdentifiers = [];
  for (let index = 0; index < facts.length; index += 1) {
    matchedFactIdentifiers[index] = facts[index].factIdentifier;
  }
  return {
    domain: REGRESSION_POLICY_FACT_SOURCE_DOMAIN,
    factDomain: "findings",
    kind: "MemoryOSPolicyFactSelection",
    matchCount: matchedFactIdentifiers.length,
    matchedFactIdentifiers,
    selector: {
      identifier: "memoryos.selector.regression-findings-by-category",
      parameters,
      version: "1.0.0",
    },
    source: externalSource(sourceDigest),
  };
}

function domainState(domain, availability, contextDigest) {
  return {
    availability,
    domain,
    kind: "MemoryOSPolicyFactDomainState",
    source: coreSource(contextDigest),
  };
}

function sourceAbsence() {
  return {
    domain: REGRESSION_POLICY_FACT_SOURCE_DOMAIN,
    kind: "MemoryOSDeterministicFactSourceAbsence",
  };
}

function ruleResult(rule, decision, decisionCode, evidence) {
  const result = {
    decision,
    decisionCode,
    evidence: [evidence],
    ruleIdentifier: rule.identifier,
    ruleType: rule.type,
    ruleVersion: rule.version,
  };
  validateRuleResult(result);
  return result;
}

function unavailableOrNotApplicable(rule, state, domain, contextDigest, codes) {
  if (state.availability === "unavailable") {
    return ruleResult(
      rule,
      "COULD_NOT_EVALUATE",
      codes.unavailable,
      domainState(domain, state.availability, contextDigest),
    );
  }
  if (state.availability === "notApplicable") {
    return ruleResult(
      rule,
      "FAIL",
      codes.notSatisfied,
      domainState(domain, state.availability, contextDigest),
    );
  }
  return undefined;
}

function evaluateVerification(rule, context, contextDigest) {
  const domain = "verification";
  const state = context.facts[domain];
  const nonAvailable = unavailableOrNotApplicable(rule, state, domain, contextDigest, {
    notSatisfied: "REQUIRE_VERIFICATION_COMPLETED_NOT_SATISFIED",
    unavailable: "REQUIRE_VERIFICATION_COMPLETED_FACTS_UNAVAILABLE",
  });
  if (nonAvailable !== undefined) return nonAvailable;
  invariant(state.availability === "available", "Verification domain availability is invalid.");
  if (state.items.length === 0) {
    return ruleResult(rule, "FAIL", "REQUIRE_VERIFICATION_COMPLETED_NOT_SATISFIED",
      coreSelection(domain, "memoryos.selector.verification-all", {}, [], contextDigest));
  }
  invariant(state.items.length === 1, "Verification domain cardinality is invalid.");
  const fact = state.items[0];
  return fact.value.status === "passed"
    ? ruleResult(rule, "PASS", "REQUIRE_VERIFICATION_COMPLETED_SATISFIED",
      coreFactReference(domain, fact, contextDigest))
    : ruleResult(rule, "FAIL", "REQUIRE_VERIFICATION_COMPLETED_NOT_SATISFIED",
      coreFactReference(domain, fact, contextDigest));
}

function evaluateReplay(rule, context, contextDigest) {
  const domain = "activeReplay";
  const state = context.facts[domain];
  const nonAvailable = unavailableOrNotApplicable(rule, state, domain, contextDigest, {
    notSatisfied: "REQUIRE_REPLAY_COMPLETED_NOT_SATISFIED",
    unavailable: "REQUIRE_REPLAY_COMPLETED_FACTS_UNAVAILABLE",
  });
  if (nonAvailable !== undefined) return nonAvailable;
  invariant(state.availability === "available", "Replay domain availability is invalid.");
  if (state.items.length === 0) {
    return ruleResult(rule, "FAIL", "REQUIRE_REPLAY_COMPLETED_NOT_SATISFIED",
      coreSelection(domain, "memoryos.selector.active-replay-all", {}, [], contextDigest));
  }
  invariant(state.items.length === 1, "Replay domain cardinality is invalid.");
  const fact = state.items[0];
  return fact.value.status === "completed"
    ? ruleResult(rule, "PASS", "REQUIRE_REPLAY_COMPLETED_SATISFIED",
      coreFactReference(domain, fact, contextDigest))
    : ruleResult(rule, "FAIL", "REQUIRE_REPLAY_COMPLETED_NOT_SATISFIED",
      coreFactReference(domain, fact, contextDigest));
}

function evaluateArtifactCardinality(rule, context, contextDigest) {
  const domain = "artifactCardinalities";
  const state = context.facts[domain];
  const nonAvailable = unavailableOrNotApplicable(rule, state, domain, contextDigest, {
    notSatisfied: "REQUIRE_ARTIFACT_CARDINALITY_NOT_SATISFIED",
    unavailable: "REQUIRE_ARTIFACT_CARDINALITY_FACTS_UNAVAILABLE",
  });
  if (nonAvailable !== undefined) return nonAvailable;
  invariant(state.availability === "available", "Artifact-cardinality availability is invalid.");
  const matches = [];
  let remaining = rule.parameters.minimumCount;
  for (let index = 0; index < state.items.length; index += 1) {
    const fact = state.items[index];
    if (fact.subject.artifactClass !== rule.parameters.artifactClass) continue;
    matches[matches.length] = fact;
    if (remaining !== 0) {
      remaining = fact.value.count >= remaining ? 0 : remaining - fact.value.count;
    }
  }
  const decision = remaining === 0 ? "PASS" : "FAIL";
  return ruleResult(
    rule,
    decision,
    decision === "PASS"
      ? "REQUIRE_ARTIFACT_CARDINALITY_SATISFIED"
      : "REQUIRE_ARTIFACT_CARDINALITY_NOT_SATISFIED",
    coreSelection(
      domain,
      "memoryos.selector.artifact-cardinality-by-class",
      { artifactClass: rule.parameters.artifactClass },
      matches,
      contextDigest,
    ),
  );
}

function evaluateLifecycle(rule, context, contextDigest) {
  const domain = "lifecycle";
  const state = context.facts[domain];
  const nonAvailable = unavailableOrNotApplicable(rule, state, domain, contextDigest, {
    notSatisfied: "REQUIRE_LIFECYCLE_STATE_NOT_SATISFIED",
    unavailable: "REQUIRE_LIFECYCLE_STATE_FACTS_UNAVAILABLE",
  });
  if (nonAvailable !== undefined) return nonAvailable;
  invariant(state.availability === "available" && state.items.length === 1,
    "Lifecycle domain cardinality is invalid.");
  const fact = state.items[0];
  let allowed = false;
  for (let index = 0; index < rule.parameters.allowedStates.length; index += 1) {
    if (rule.parameters.allowedStates[index] === fact.value.state) allowed = true;
  }
  return ruleResult(
    rule,
    allowed ? "PASS" : "FAIL",
    allowed ? "REQUIRE_LIFECYCLE_STATE_SATISFIED" : "REQUIRE_LIFECYCLE_STATE_NOT_SATISFIED",
    coreFactReference(domain, fact, contextDigest),
  );
}

function evaluateRegression(rule, source) {
  if (source === undefined) {
    return ruleResult(
      rule,
      "COULD_NOT_EVALUATE",
      "PROHIBIT_REGRESSION_FINDINGS_SOURCE_NOT_SUPPLIED",
      sourceAbsence(),
    );
  }
  const sourceDigest = regressionPolicyFactSourceDigest(source);
  const findings = sourceArtifact(source).facts.findings;
  const matches = [];
  for (let index = 0; index < findings.length; index += 1) {
    const fact = findings[index];
    let prohibited = false;
    for (let categoryIndex = 0; categoryIndex < rule.parameters.categories.length; categoryIndex += 1) {
      if (rule.parameters.categories[categoryIndex] === fact.subject.category) prohibited = true;
    }
    if (prohibited) matches[matches.length] = fact;
  }
  const decision = matches.length === 0 ? "PASS" : "FAIL";
  return ruleResult(
    rule,
    decision,
    decision === "PASS"
      ? "PROHIBIT_REGRESSION_FINDINGS_SATISFIED"
      : "PROHIBIT_REGRESSION_FINDINGS_NOT_SATISFIED",
    externalSelection(sourceDigest, { categories: copySequence(rule.parameters.categories) }, matches),
  );
}

function evaluateMipIntegrity(rule, context, contextDigest) {
  const domain = "mipIntegrity";
  const state = context.facts[domain];
  const nonAvailable = unavailableOrNotApplicable(rule, state, domain, contextDigest, {
    notSatisfied: "REQUIRE_MIP_INTEGRITY_NOT_SATISFIED",
    unavailable: "REQUIRE_MIP_INTEGRITY_FACTS_UNAVAILABLE",
  });
  if (nonAvailable !== undefined) return nonAvailable;
  invariant(state.availability === "available" && state.items.length === 1,
    "MIP-integrity domain cardinality is invalid.");
  return ruleResult(
    rule,
    "PASS",
    "REQUIRE_MIP_INTEGRITY_SATISFIED",
    coreFactReference(domain, state.items[0], contextDigest),
  );
}

function evaluateRule(rule, context, contextDigest, source) {
  switch (rule.type) {
    case "memoryos.require-verification-completed":
      return evaluateVerification(rule, context, contextDigest);
    case "memoryos.require-replay-completed":
      return evaluateReplay(rule, context, contextDigest);
    case "memoryos.require-artifact-cardinality":
      return evaluateArtifactCardinality(rule, context, contextDigest);
    case "memoryos.require-lifecycle-state":
      return evaluateLifecycle(rule, context, contextDigest);
    case "memoryos.prohibit-regression-findings":
      return evaluateRegression(rule, source);
    case "memoryos.require-mip-integrity":
      return evaluateMipIntegrity(rule, context, contextDigest);
    default:
      throw new MemoryOSPolicyEvaluationInvariantError("Prepared Policy contains an unknown rule.");
  }
}

function copySequence(value) {
  const result = [];
  for (let index = 0; index < value.length; index += 1) result[index] = value[index];
  return result;
}

function aggregate(results) {
  let sawCne = false;
  for (let index = 0; index < results.length; index += 1) {
    if (results[index].decision === "FAIL") return "FAIL";
    if (results[index].decision === "COULD_NOT_EVALUATE") sawCne = true;
  }
  return sawCne ? "COULD_NOT_EVALUATE" : "PASS";
}

function evaluatePolicy(view, context, contextDigest, source) {
  const rules = view.artifact.rules;
  const results = [];
  for (let index = 0; index < rules.length; index += 1) {
    results[index] = evaluateRule(rules[index], context, contextDigest, source);
  }
  return {
    decision: aggregate(results),
    kind: "MemoryOSPolicyResult",
    policyIdentifier: view.artifact.identifier,
    policySemanticDigest: view.semanticDigest,
    ruleResults: results,
  };
}

function evaluateArtifact(topView, context, contextDigest, source) {
  if (topView.artifact.kind === INVESTIGATION_POLICY_KIND) {
    return evaluatePolicy(topView, context, contextDigest, source);
  }
  const policyResults = [];
  for (let index = 0; index < topView.policies.length; index += 1) {
    policyResults[index] = evaluatePolicy(
      preparedInvestigationPolicyArtifactEvaluationView(topView.policies[index]),
      context,
      contextDigest,
      source,
    );
  }
  return {
    decision: aggregate(policyResults),
    kind: "MemoryOSPolicySetResult",
    policyResults,
    policySetIdentifier: topView.artifact.identifier,
    policySetSemanticDigest: topView.semanticDigest,
  };
}

function dependencyDomain(rule) {
  switch (rule.type) {
    case "memoryos.require-verification-completed": return "verification";
    case "memoryos.require-replay-completed": return "activeReplay";
    case "memoryos.require-artifact-cardinality": return "artifactCardinalities";
    case "memoryos.require-lifecycle-state": return "lifecycle";
    case "memoryos.require-mip-integrity": return "mipIntegrity";
    default: return undefined;
  }
}

function phaseHMetrics(topView, context, sources) {
  let ruleCount = 0;
  let visits = 0;
  const policyViews = topView.artifact.kind === INVESTIGATION_POLICY_KIND
    ? [topView]
    : policyViewsFor(topView);
  for (let policyIndex = 0; policyIndex < policyViews.length; policyIndex += 1) {
    const rules = policyViews[policyIndex].artifact.rules;
    ruleCount += rules.length;
    for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
      const rule = rules[ruleIndex];
      if (rule.type === "memoryos.prohibit-regression-findings") {
        if (sources.length === 1) visits += sourceArtifact(sources[0]).facts.findings.length;
      } else {
        const state = context.facts[dependencyDomain(rule)];
        if (state.availability === "available") visits += state.items.length;
      }
    }
  }
  return { policyViews, ruleCount, visits };
}

function policyViewsFor(topView) {
  const result = [];
  for (let index = 0; index < topView.policies.length; index += 1) {
    result[index] = preparedInvestigationPolicyArtifactEvaluationView(topView.policies[index]);
  }
  return result;
}

function buildEvaluationIdentity(topView, context, contextDigest, sources) {
  const externalSources = [];
  for (let index = 0; index < sources.length; index += 1) {
    externalSources[index] = {
      domain: sourceArtifact(sources[index]).domain,
      sourceDigest: regressionPolicyFactSourceDigest(sources[index]),
    };
  }
  return {
    deterministicFactSourceRegistry: {
      registryDigest: DETERMINISTIC_FACT_SOURCE_REGISTRY_DIGEST,
      registryVersion: DETERMINISTIC_FACT_SOURCE_REGISTRY_VERSION,
    },
    evaluatedArtifact: {
      artifactVersion: topView.artifact.version,
      kind: topView.artifact.kind,
      semanticDigest: topView.semanticDigest,
    },
    evaluatorVersion: POLICY_EVALUATOR_VERSION,
    externalSources,
    kind: POLICY_EVALUATION_IDENTITY_KIND,
    outcomeContractVersion: POLICY_OUTCOME_CONTRACT_VERSION,
    policyFactContext: {
      contextDigest,
      contextVersion: context.version,
      factModelDigest: POLICY_FACT_MODEL_DIGEST,
      factModelVersion: context.factModelVersion,
    },
    resourceProfile: {
      identifier: MEMORYOS_POLICY_RESOURCE_PROFILE.identifier,
      resourceProfileDigest: MEMORYOS_POLICY_RESOURCE_PROFILE_DIGEST,
      version: MEMORYOS_POLICY_RESOURCE_PROFILE.version,
    },
    ruleRegistry: {
      ruleRegistryDigest: RULE_REGISTRY_DIGEST,
      ruleRegistryVersion: RULE_REGISTRY_VERSION,
    },
    version: POLICY_EVALUATION_IDENTITY_VERSION,
  };
}

function sourceArtifact(source) {
  return source !== null && typeof source === "object"
      && source.artifact !== undefined
    ? source.artifact
    : source;
}

export function policyEvaluationIdentityDigest(identity) {
  validateEvaluationIdentity(identity);
  const bytes = canonicalizeRestrictedJson(identity);
  return domainSeparatedDigest(POLICY_EVALUATION_IDENTITY_DIGEST_DOMAIN, bytes);
}

export function policyEvaluationOutcomeDigest(outcome) {
  validatePolicyEvaluationOutcome(outcome);
  const bytes = canonicalizeRestrictedJson(outcome);
  return domainSeparatedDigest(POLICY_EVALUATION_OUTCOME_DIGEST_DOMAIN, bytes);
}

function flatRuleResults(result) {
  const values = [];
  if (result.kind === "MemoryOSPolicyResult") {
    for (let index = 0; index < result.ruleResults.length; index += 1) {
      values[values.length] = result.ruleResults[index];
    }
  } else if (result.kind === "MemoryOSPolicySetResult") {
    for (let policyIndex = 0; policyIndex < result.policyResults.length; policyIndex += 1) {
      const rules = result.policyResults[policyIndex].ruleResults;
      for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
        values[values.length] = rules[ruleIndex];
      }
    }
  }
  return values;
}

function phaseIMetrics(result) {
  const results = flatRuleResults(result);
  let maximumSelectionIdentifiers = 0;
  let evidenceIdentifiers = 0;
  let evidenceBytes = 0;
  for (let index = 0; index < results.length; index += 1) {
    const evidence = results[index].evidence;
    evidenceBytes += byteLength(canonicalizeRestrictedJson(evidence));
    const item = evidence[0];
    if (item.kind === "MemoryOSPolicyFactReference") evidenceIdentifiers += 1;
    if (item.kind === "MemoryOSPolicyFactSelection") {
      evidenceIdentifiers += item.matchedFactIdentifiers.length;
      if (item.matchedFactIdentifiers.length > maximumSelectionIdentifiers) {
        maximumSelectionIdentifiers = item.matchedFactIdentifiers.length;
      }
    }
  }
  return { evidenceBytes, evidenceIdentifiers, maximumSelectionIdentifiers };
}

function resourceLimitResult(identifier) {
  const configuredLimit = LIMITS[identifier];
  return {
    code: "POLICY_EVALUATION_RESOURCE_LIMIT_EXCEEDED",
    configuredLimit,
    decision: "COULD_NOT_EVALUATE",
    kind: "MemoryOSPolicyEvaluationResourceLimitResult",
    limitIdentifier: identifier,
    observedAtLeast: configuredLimit + 1,
  };
}

function evaluationOutcome(identity, identityDigest, result) {
  return {
    evaluationIdentity: identity,
    evaluationIdentityDigest: identityDigest,
    kind: POLICY_EVALUATION_OUTCOME_KIND,
    result,
    version: POLICY_EVALUATION_OUTCOME_VERSION,
  };
}

function completeOutcome(identity, identityBytes, identityDigest, completedResult) {
  // Internal semantic/result invariants precede resource replacement. An
  // invalid generated result is operational failure and can never be masked
  // as a normative evaluation-wide resource CNE.
  validateResult(completedResult, identity);
  const phaseI = phaseIMetrics(completedResult);
  const checks = [
    ["evaluation.selection-matched-fact-identifier-count", phaseI.maximumSelectionIdentifiers],
    ["evaluation.evidence-fact-identifier-count", phaseI.evidenceIdentifiers],
    ["evaluation.evidence-canonical-bytes", phaseI.evidenceBytes],
  ];
  for (let index = 0; index < checks.length; index += 1) {
    if (checks[index][1] > LIMITS[checks[index][0]]) {
      return finalizeOutcome(identity, identityBytes, identityDigest, resourceLimitResult(checks[index][0]));
    }
  }

  const attempted = evaluationOutcome(identity, identityDigest, completedResult);
  const attemptedBytes = canonicalizeRestrictedJson(attempted);
  if (byteLength(attemptedBytes) > LIMITS["evaluation.outcome-canonical-bytes"]) {
    return finalizeOutcome(
      identity,
      identityBytes,
      identityDigest,
      resourceLimitResult("evaluation.outcome-canonical-bytes"),
    );
  }
  validatePolicyEvaluationOutcome(attempted);
  return finalizeValidatedOutcome(identity, identityBytes, identityDigest, attempted, attemptedBytes);
}

function finalizeOutcome(identity, identityBytes, identityDigest, result) {
  const outcome = evaluationOutcome(identity, identityDigest, result);
  validatePolicyEvaluationOutcome(outcome);
  const outcomeBytes = canonicalizeRestrictedJson(outcome);
  invariant(
    byteLength(outcomeBytes) <= LIMITS["evaluation.outcome-canonical-bytes"],
    "The frozen resource-limit outcome does not fit the supported Resource Profile.",
  );
  return finalizeValidatedOutcome(identity, identityBytes, identityDigest, outcome, outcomeBytes);
}

function finalizeValidatedOutcome(identity, identityBytes, identityDigest, outcome, outcomeBytes) {
  invariant(byteEqual(identityBytes, canonicalizeRestrictedJson(identity)),
    "Evaluation Identity canonical bytes changed during evaluation.");
  return {
    identity,
    identityBytes,
    identityDigest,
    outcome,
    outcomeBytes,
    outcomeDigest: domainSeparatedDigest(POLICY_EVALUATION_OUTCOME_DIGEST_DOMAIN, outcomeBytes),
  };
}

function validateSourceDescriptor(source, external) {
  if (external) {
    invariant(exactKeys(source, ["externalSourceDigest", "kind"])
      && source.kind === "deterministicFactSource" && isDigest(source.externalSourceDigest),
    "External evidence source is invalid.");
  } else {
    invariant(exactKeys(source, ["contextDigest", "kind"])
      && source.kind === "policyFactContext" && isDigest(source.contextDigest),
    "Core evidence source is invalid.");
  }
}

function validateEvidence(evidence) {
  invariant(evidence !== null && typeof evidence === "object" && !intrinsicArrayIsArray(evidence),
    "Evidence must be a closed object.");
  if (evidence.kind === "MemoryOSPolicyFactReference") {
    const external = evidence.source?.kind === "deterministicFactSource";
    invariant(exactKeys(evidence, external
      ? ["domain", "factDomain", "factIdentifier", "kind", "source"]
      : ["domain", "factIdentifier", "kind", "source"]),
    "Fact-reference evidence shape is invalid.");
    validateSourceDescriptor(evidence.source, external);
    invariant(isDigest(evidence.factIdentifier), "Fact-reference identifier is invalid.");
    if (external) {
      invariant(evidence.domain === REGRESSION_POLICY_FACT_SOURCE_DOMAIN
        && (evidence.factDomain === "summary" || evidence.factDomain === "categories"
          || evidence.factDomain === "findings"),
      "External fact-reference domain is invalid.");
    } else {
      invariant(!intrinsicObjectHasOwn(evidence, "factDomain"),
        "Core fact references must not contain factDomain.");
    }
    return;
  }
  if (evidence.kind === "MemoryOSPolicyFactSelection") {
    const external = evidence.source?.kind === "deterministicFactSource";
    invariant(exactKeys(evidence, external
      ? ["domain", "factDomain", "kind", "matchCount", "matchedFactIdentifiers", "selector", "source"]
      : ["domain", "kind", "matchCount", "matchedFactIdentifiers", "selector", "source"]),
    "Selection evidence shape is invalid.");
    validateSourceDescriptor(evidence.source, external);
    invariant(intrinsicArrayIsArray(evidence.matchedFactIdentifiers)
      && evidence.matchCount === evidence.matchedFactIdentifiers.length
      // A serialized completed result may contain a pre-resource Regression
      // selection of at most eight findings. Core selectors can expose at most
      // the four frozen artifact-cardinality facts. Bound this before walking
      // the array; limits 28/29 are applied later as Phase-I resource gates.
      && evidence.matchedFactIdentifiers.length <= (external
        ? LIMITS["regression-policy-fact-source.finding-count"]
        : LIMITS["policy-fact-context.observation-count"]),
    "Selection evidence cardinality is invalid.");
    const identifiers = new IntrinsicSet();
    for (let index = 0; index < evidence.matchedFactIdentifiers.length; index += 1) {
      const identifier = evidence.matchedFactIdentifiers[index];
      invariant(isDigest(identifier)
        && !intrinsicReflectApply(intrinsicSetHas, identifiers, [identifier]),
      "Selection fact identifier is invalid or duplicated.");
      intrinsicReflectApply(intrinsicSetAdd, identifiers, [identifier]);
    }
    invariant(exactKeys(evidence.selector, ["identifier", "parameters", "version"])
      && typeof evidence.selector.identifier === "string"
      && evidence.selector.version === "1.0.0",
    "Selection identity is invalid.");
    if (external) {
      invariant(evidence.domain === REGRESSION_POLICY_FACT_SOURCE_DOMAIN
        && evidence.factDomain === "findings",
      "External selection domain is invalid.");
    } else {
      invariant(!intrinsicObjectHasOwn(evidence, "factDomain"),
        "Core selections must not contain factDomain.");
    }
    return;
  }
  if (evidence.kind === "MemoryOSPolicyFactDomainState") {
    invariant(exactKeys(evidence, ["availability", "domain", "kind", "source"])
      && (evidence.availability === "notApplicable" || evidence.availability === "unavailable"),
    "Domain-state evidence shape is invalid.");
    validateSourceDescriptor(evidence.source, false);
    return;
  }
  if (evidence.kind === "MemoryOSDeterministicFactSourceAbsence") {
    invariant(exactKeys(evidence, ["domain", "kind"])
      && evidence.domain === REGRESSION_POLICY_FACT_SOURCE_DOMAIN,
    "External-source absence evidence shape is invalid.");
    return;
  }
  throw new MemoryOSPolicyEvaluationInvariantError("Unknown policy evidence kind.");
}

function isCoreFactReference(evidence, domain) {
  return evidence.kind === "MemoryOSPolicyFactReference"
    && evidence.source.kind === "policyFactContext"
    && evidence.domain === domain;
}

function isCoreDomainState(evidence, domain, availability) {
  return evidence.kind === "MemoryOSPolicyFactDomainState"
    && evidence.source.kind === "policyFactContext"
    && evidence.domain === domain
    && evidence.availability === availability;
}

function isCoreSelection(evidence, domain, selectorIdentifier) {
  return evidence.kind === "MemoryOSPolicyFactSelection"
    && evidence.source.kind === "policyFactContext"
    && evidence.domain === domain
    && evidence.selector.identifier === selectorIdentifier;
}

function isRegisteredRegressionCategorySet(categories) {
  if (!intrinsicArrayIsArray(categories)
      || categories.length === 0
      || categories.length > REGRESSION_CATEGORY_ORDER.length) return false;
  let prior = -1;
  for (let index = 0; index < categories.length; index += 1) {
    let position = -1;
    for (let registered = 0; registered < REGRESSION_CATEGORY_ORDER.length; registered += 1) {
      if (categories[index] === REGRESSION_CATEGORY_ORDER[registered]) position = registered;
    }
    if (position <= prior) return false;
    prior = position;
  }
  return true;
}

function isRegressionSelection(evidence) {
  return evidence.kind === "MemoryOSPolicyFactSelection"
    && evidence.source.kind === "deterministicFactSource"
    && evidence.domain === REGRESSION_POLICY_FACT_SOURCE_DOMAIN
    && evidence.factDomain === "findings"
    && evidence.selector.identifier === "memoryos.selector.regression-findings-by-category"
    && exactKeys(evidence.selector.parameters, ["categories"])
    && isRegisteredRegressionCategorySet(evidence.selector.parameters.categories);
}

function validateRuleResultEvidence(result) {
  const evidence = result.evidence[0];
  let valid = false;
  switch (result.ruleType) {
    case "memoryos.require-verification-completed":
      if (result.decisionCode === "REQUIRE_VERIFICATION_COMPLETED_SATISFIED") {
        valid = isCoreFactReference(evidence, "verification");
      } else if (result.decisionCode === "REQUIRE_VERIFICATION_COMPLETED_FACTS_UNAVAILABLE") {
        valid = isCoreDomainState(evidence, "verification", "unavailable");
      } else if (result.decisionCode === "REQUIRE_VERIFICATION_COMPLETED_NOT_SATISFIED") {
        valid = isCoreDomainState(evidence, "verification", "notApplicable")
          || isCoreFactReference(evidence, "verification")
          || (isCoreSelection(evidence, "verification", "memoryos.selector.verification-all")
            && exactKeys(evidence.selector.parameters, []) && evidence.matchCount === 0);
      }
      break;
    case "memoryos.require-replay-completed":
      if (result.decisionCode === "REQUIRE_REPLAY_COMPLETED_SATISFIED") {
        valid = isCoreFactReference(evidence, "activeReplay");
      } else if (result.decisionCode === "REQUIRE_REPLAY_COMPLETED_FACTS_UNAVAILABLE") {
        valid = isCoreDomainState(evidence, "activeReplay", "unavailable");
      } else if (result.decisionCode === "REQUIRE_REPLAY_COMPLETED_NOT_SATISFIED") {
        valid = isCoreDomainState(evidence, "activeReplay", "notApplicable")
          || isCoreFactReference(evidence, "activeReplay")
          || (isCoreSelection(evidence, "activeReplay", "memoryos.selector.active-replay-all")
            && exactKeys(evidence.selector.parameters, []) && evidence.matchCount === 0);
      }
      break;
    case "memoryos.require-artifact-cardinality": {
      const selection = isCoreSelection(
        evidence,
        "artifactCardinalities",
        "memoryos.selector.artifact-cardinality-by-class",
      ) && exactKeys(evidence.selector.parameters, ["artifactClass"])
        && (evidence.selector.parameters.artifactClass === "evidence"
          || evidence.selector.parameters.artifactClass === "semanticTransformation"
          || evidence.selector.parameters.artifactClass === "retrieval"
          || evidence.selector.parameters.artifactClass === "reflection");
      if (result.decisionCode === "REQUIRE_ARTIFACT_CARDINALITY_SATISFIED") {
        valid = selection;
      } else if (result.decisionCode === "REQUIRE_ARTIFACT_CARDINALITY_FACTS_UNAVAILABLE") {
        valid = isCoreDomainState(evidence, "artifactCardinalities", "unavailable");
      } else if (result.decisionCode === "REQUIRE_ARTIFACT_CARDINALITY_NOT_SATISFIED") {
        valid = selection || isCoreDomainState(evidence, "artifactCardinalities", "notApplicable");
      }
      break;
    }
    case "memoryos.require-lifecycle-state":
      if (result.decisionCode === "REQUIRE_LIFECYCLE_STATE_SATISFIED") {
        valid = isCoreFactReference(evidence, "lifecycle");
      } else if (result.decisionCode === "REQUIRE_LIFECYCLE_STATE_FACTS_UNAVAILABLE") {
        valid = isCoreDomainState(evidence, "lifecycle", "unavailable");
      } else if (result.decisionCode === "REQUIRE_LIFECYCLE_STATE_NOT_SATISFIED") {
        valid = isCoreFactReference(evidence, "lifecycle")
          || isCoreDomainState(evidence, "lifecycle", "notApplicable");
      }
      break;
    case "memoryos.prohibit-regression-findings":
      if (result.decisionCode === "PROHIBIT_REGRESSION_FINDINGS_SOURCE_NOT_SUPPLIED") {
        valid = evidence.kind === "MemoryOSDeterministicFactSourceAbsence";
      } else if (result.decisionCode === "PROHIBIT_REGRESSION_FINDINGS_SATISFIED") {
        valid = isRegressionSelection(evidence) && evidence.matchCount === 0;
      } else if (result.decisionCode === "PROHIBIT_REGRESSION_FINDINGS_NOT_SATISFIED") {
        valid = isRegressionSelection(evidence) && evidence.matchCount > 0;
      }
      break;
    case "memoryos.require-mip-integrity":
      if (result.decisionCode === "REQUIRE_MIP_INTEGRITY_SATISFIED") {
        valid = isCoreFactReference(evidence, "mipIntegrity");
      } else if (result.decisionCode === "REQUIRE_MIP_INTEGRITY_FACTS_UNAVAILABLE") {
        valid = isCoreDomainState(evidence, "mipIntegrity", "unavailable");
      } else if (result.decisionCode === "REQUIRE_MIP_INTEGRITY_NOT_SATISFIED") {
        valid = isCoreDomainState(evidence, "mipIntegrity", "notApplicable");
      }
      break;
    default:
      break;
  }
  invariant(valid, "Rule evidence does not match its frozen rule-model decision row.");
}

function validateRuleResult(result) {
  invariant(exactKeys(result, [
    "decision", "decisionCode", "evidence", "ruleIdentifier", "ruleType", "ruleVersion",
  ]), "Rule-result shape is invalid.");
  invariant(intrinsicReflectApply(intrinsicSetHas, DECISIONS, [result.decision])
    && DECISION_CODE_ROWS[result.decisionCode] === result.decision,
  "Rule decision/code pair is invalid.");
  invariant(intrinsicArrayIsArray(result.evidence) && result.evidence.length === 1,
    "Every initial rule result must have exactly one evidence member.");
  validateEvidence(result.evidence[0]);
  validateRuleResultEvidence(result);
  invariant(isBoundedIdentifier(result.ruleIdentifier, "policy.rule-identifier-utf8-bytes")
    && typeof result.ruleType === "string"
    && result.ruleVersion === "1.0.0", "Rule traceability is invalid.");
}

function validateEvidenceIdentity(evidence, identity) {
  if (evidence.kind === "MemoryOSDeterministicFactSourceAbsence") {
    invariant(identity.externalSources.length === 0,
      "External-source absence evidence contradicts the Evaluation Identity.");
    return;
  }
  if (evidence.source.kind === "policyFactContext") {
    invariant(
      evidence.source.contextDigest === identity.policyFactContext.contextDigest,
      "Core evidence does not bind the Evaluation Identity PolicyFactContext.",
    );
    return;
  }
  invariant(identity.externalSources.length === 1
    && identity.externalSources[0].domain === evidence.domain
    && identity.externalSources[0].sourceDigest === evidence.source.externalSourceDigest,
  "External evidence does not bind the Evaluation Identity deterministic source.");
}

function validatePolicyResult(result, identity) {
  invariant(exactKeys(result, [
    "decision", "kind", "policyIdentifier", "policySemanticDigest", "ruleResults",
  ]) && result.kind === "MemoryOSPolicyResult" && isDigest(result.policySemanticDigest)
    && isBoundedIdentifier(result.policyIdentifier, "policy.identifier-utf8-bytes")
    && intrinsicArrayIsArray(result.ruleResults)
    && result.ruleResults.length > 0
    && result.ruleResults.length <= LIMITS["evaluation.rule-evaluation-count"],
  "Policy-result shape is invalid.");
  const ruleIdentifiers = new IntrinsicSet();
  for (let index = 0; index < result.ruleResults.length; index += 1) {
    validateRuleResult(result.ruleResults[index]);
    invariant(!intrinsicReflectApply(intrinsicSetHas, ruleIdentifiers, [
      result.ruleResults[index].ruleIdentifier,
    ]), "Policy result contains a duplicate rule identifier.");
    intrinsicReflectApply(intrinsicSetAdd, ruleIdentifiers, [
      result.ruleResults[index].ruleIdentifier,
    ]);
    validateEvidenceIdentity(result.ruleResults[index].evidence[0], identity);
  }
  invariant(result.decision === aggregate(result.ruleResults), "Policy aggregation is invalid.");
}

function validateResourceResult(result) {
  invariant(exactKeys(result, [
    "code", "configuredLimit", "decision", "kind", "limitIdentifier", "observedAtLeast",
  ]) && result.kind === "MemoryOSPolicyEvaluationResourceLimitResult"
    && result.decision === "COULD_NOT_EVALUATE"
    && result.code === "POLICY_EVALUATION_RESOURCE_LIMIT_EXCEEDED"
    && intrinsicReflectApply(intrinsicSetHas, POST_IDENTITY_LIMITS, [result.limitIdentifier])
    && result.configuredLimit === LIMITS[result.limitIdentifier]
    && result.observedAtLeast === result.configuredLimit + 1,
  "Resource-limit result is invalid.");
}

function validateResult(result, identity) {
  if (result.kind === "MemoryOSPolicyResult") {
    validatePolicyResult(result, identity);
    invariant(identity.evaluatedArtifact.kind === INVESTIGATION_POLICY_KIND
      && result.policySemanticDigest === identity.evaluatedArtifact.semanticDigest,
    "Policy result does not bind the Evaluation Identity.");
    return;
  }
  if (result.kind === "MemoryOSPolicySetResult") {
    invariant(exactKeys(result, [
      "decision", "kind", "policyResults", "policySetIdentifier", "policySetSemanticDigest",
    ]) && intrinsicArrayIsArray(result.policyResults) && result.policyResults.length > 0
      && result.policyResults.length <= LIMITS["policy-set.policy-count"]
      && isBoundedIdentifier(result.policySetIdentifier, "policy-set.identifier-utf8-bytes")
      && isDigest(result.policySetSemanticDigest),
    "Policy Set result is invalid.");
    let totalRuleResults = 0;
    for (let index = 0; index < result.policyResults.length; index += 1) {
      const child = result.policyResults[index];
      invariant(child !== null && typeof child === "object"
        && intrinsicArrayIsArray(child.ruleResults)
        && child.ruleResults.length > 0
        && child.ruleResults.length <= LIMITS["evaluation.rule-evaluation-count"],
      "Policy Set child rule-result cardinality is invalid.");
      totalRuleResults += child.ruleResults.length;
    }
    invariant(totalRuleResults <= LIMITS["evaluation.rule-evaluation-count"],
      "Policy Set result exceeds the pre-identity rule-evaluation limit.");
    const policyIdentifiers = new IntrinsicSet();
    const policyDigests = new IntrinsicSet();
    for (let index = 0; index < result.policyResults.length; index += 1) {
      validatePolicyResult(result.policyResults[index], identity);
      invariant(!intrinsicReflectApply(intrinsicSetHas, policyIdentifiers, [
        result.policyResults[index].policyIdentifier,
      ]) && !intrinsicReflectApply(intrinsicSetHas, policyDigests, [
        result.policyResults[index].policySemanticDigest,
      ]), "Policy Set result contains a duplicate child identity.");
      intrinsicReflectApply(intrinsicSetAdd, policyIdentifiers, [
        result.policyResults[index].policyIdentifier,
      ]);
      intrinsicReflectApply(intrinsicSetAdd, policyDigests, [
        result.policyResults[index].policySemanticDigest,
      ]);
    }
    invariant(result.decision === aggregate(result.policyResults)
      && identity.evaluatedArtifact.kind === INVESTIGATION_POLICY_SET_KIND
      && result.policySetSemanticDigest === identity.evaluatedArtifact.semanticDigest,
    "Policy Set aggregation or identity binding is invalid.");
    return;
  }
  if (result.kind === "MemoryOSPolicyEvaluationResourceLimitResult") {
    validateResourceResult(result);
    return;
  }
  throw new MemoryOSPolicyEvaluationInvariantError("Unknown Policy evaluation result kind.");
}

export function validateEvaluationIdentity(identity) {
  invariant(exactKeys(identity, [
    "deterministicFactSourceRegistry", "evaluatedArtifact", "evaluatorVersion",
    "externalSources", "kind", "outcomeContractVersion", "policyFactContext",
    "resourceProfile", "ruleRegistry", "version",
  ]), "Evaluation Identity root shape is invalid.");
  invariant(identity.kind === POLICY_EVALUATION_IDENTITY_KIND
    && identity.version === POLICY_EVALUATION_IDENTITY_VERSION
    && identity.evaluatorVersion === POLICY_EVALUATOR_VERSION
    && identity.outcomeContractVersion === POLICY_OUTCOME_CONTRACT_VERSION,
  "Evaluation Identity version is unsupported.");
  invariant(exactKeys(identity.deterministicFactSourceRegistry, ["registryDigest", "registryVersion"])
    && identity.deterministicFactSourceRegistry.registryDigest === DETERMINISTIC_FACT_SOURCE_REGISTRY_DIGEST
    && identity.deterministicFactSourceRegistry.registryVersion === DETERMINISTIC_FACT_SOURCE_REGISTRY_VERSION,
  "Deterministic Fact Source Registry binding is invalid.");
  invariant(exactKeys(identity.ruleRegistry, ["ruleRegistryDigest", "ruleRegistryVersion"])
    && identity.ruleRegistry.ruleRegistryDigest === RULE_REGISTRY_DIGEST
    && identity.ruleRegistry.ruleRegistryVersion === RULE_REGISTRY_VERSION,
  "Rule Registry binding is invalid.");
  invariant(exactKeys(identity.resourceProfile, ["identifier", "resourceProfileDigest", "version"])
    && identity.resourceProfile.identifier === MEMORYOS_POLICY_RESOURCE_PROFILE.identifier
    && identity.resourceProfile.version === MEMORYOS_POLICY_RESOURCE_PROFILE.version
    && identity.resourceProfile.resourceProfileDigest === MEMORYOS_POLICY_RESOURCE_PROFILE_DIGEST,
  "Resource Profile binding is invalid.");
  invariant(exactKeys(identity.evaluatedArtifact, ["artifactVersion", "kind", "semanticDigest"])
    && identity.evaluatedArtifact.artifactVersion === "1.0.0"
    && (identity.evaluatedArtifact.kind === INVESTIGATION_POLICY_KIND
      || identity.evaluatedArtifact.kind === INVESTIGATION_POLICY_SET_KIND)
    && isDigest(identity.evaluatedArtifact.semanticDigest),
  "Evaluated-artifact binding is invalid.");
  invariant(exactKeys(identity.policyFactContext, [
    "contextDigest", "contextVersion", "factModelDigest", "factModelVersion",
  ]) && identity.policyFactContext.contextVersion === "1.0.0"
    && identity.policyFactContext.factModelVersion === "1.0.0"
    && identity.policyFactContext.factModelDigest === POLICY_FACT_MODEL_DIGEST
    && isDigest(identity.policyFactContext.contextDigest),
  "PolicyFactContext identity binding is invalid.");
  invariant(intrinsicArrayIsArray(identity.externalSources) && identity.externalSources.length <= 1,
    "External-source identity cardinality is invalid.");
  for (let index = 0; index < identity.externalSources.length; index += 1) {
    const source = identity.externalSources[index];
    invariant(exactKeys(source, ["domain", "sourceDigest"])
      && source.domain === REGRESSION_POLICY_FACT_SOURCE_DOMAIN && isDigest(source.sourceDigest),
    "External-source identity is invalid.");
  }
  return true;
}

export function validatePolicyEvaluationOutcome(outcome, options = {}) {
  invariant(exactKeys(outcome, [
    "evaluationIdentity", "evaluationIdentityDigest", "kind", "result", "version",
  ]), "Policy evaluation outcome root shape is invalid.");
  invariant(outcome.kind === POLICY_EVALUATION_OUTCOME_KIND,
    "Policy evaluation outcome kind is invalid.");
  // Validate each version as an individually supported contract value before
  // applying the dedicated root/identity cross-binding classification.
  invariant(outcome.version === POLICY_EVALUATION_OUTCOME_VERSION,
    "Policy evaluation outcome version is unsupported.");
  validateEvaluationIdentity(outcome.evaluationIdentity);
  if (outcome.version !== outcome.evaluationIdentity.outcomeContractVersion) {
    throw new MemoryOSPolicyError(
      "POLICY_EVALUATION_OUTCOME_IDENTITY_MISMATCH",
      "Outcome version does not match its Evaluation Identity outcome contract version.",
      { artifactKind: POLICY_EVALUATION_OUTCOME_KIND, phase: "policyEvaluationOutcome" },
    );
  }
  const identityBytes = canonicalizeRestrictedJson(outcome.evaluationIdentity);
  const identityDigest = domainSeparatedDigest(POLICY_EVALUATION_IDENTITY_DIGEST_DOMAIN, identityBytes);
  invariant(outcome.evaluationIdentityDigest === identityDigest,
    "Outcome Evaluation Identity digest is invalid.");
  validateResult(outcome.result, outcome.evaluationIdentity);
  if (outcome.result.kind !== "MemoryOSPolicyEvaluationResourceLimitResult") {
    invariant(flatRuleResults(outcome.result).length
      <= LIMITS["evaluation.rule-evaluation-count"],
    "Completed outcome exceeds the pre-identity rule-evaluation limit.");
    const metrics = phaseIMetrics(outcome.result);
    invariant(
      metrics.maximumSelectionIdentifiers
        <= LIMITS["evaluation.selection-matched-fact-identifier-count"],
      "Completed outcome exceeds the selection identifier limit and must be resource CNE.",
    );
    invariant(
      metrics.evidenceIdentifiers <= LIMITS["evaluation.evidence-fact-identifier-count"],
      "Completed outcome exceeds the evidence identifier limit and must be resource CNE.",
    );
    invariant(
      metrics.evidenceBytes <= LIMITS["evaluation.evidence-canonical-bytes"],
      "Completed outcome exceeds the evidence byte limit and must be resource CNE.",
    );
  }
  const outcomeBytes = canonicalizeRestrictedJson(outcome);
  invariant(byteLength(outcomeBytes) <= LIMITS["evaluation.outcome-canonical-bytes"],
    "Policy evaluation outcome exceeds the supported outcome byte limit.");
  if (options.expectedIdentity !== undefined) {
    invariant(byteEqual(identityBytes, canonicalizeRestrictedJson(options.expectedIdentity)),
      "Outcome embedded Evaluation Identity does not match the requested identity.");
  }
  if (options.expectedOutcomeDigest !== undefined) {
    invariant(options.expectedOutcomeDigest
      === domainSeparatedDigest(POLICY_EVALUATION_OUTCOME_DIGEST_DOMAIN, outcomeBytes),
    "Outcome digest does not match.");
  }
  return true;
}

class PolicyEvaluator {
  constructor(token, ownerCore) {
    if (token !== EVALUATOR_TOKEN) throw new TypeError("Policy evaluators cannot be constructed by callers.");
    privateSet(evaluators, this, intrinsicObjectFreeze({ cache: new IntrinsicMap(), ownerCore }));
    intrinsicObjectFreeze(this);
  }
}
intrinsicObjectFreeze(PolicyEvaluator.prototype);

class PreparedPolicyEvaluation {
  constructor(token, record) {
    if (token !== EVALUATION_TOKEN) throw new TypeError("Policy evaluations cannot be constructed by callers.");
    const retained = intrinsicObjectFreeze({
      ...record,
      identityBytes: copyBytes(record.identityBytes),
      outcomeBytes: copyBytes(record.outcomeBytes),
    });
    privateSet(evaluations, this, retained);
    intrinsicObjectDefineProperties(this, {
      cacheDisposition: { enumerable: true, value: retained.cacheDisposition },
      evaluationIdentity: { enumerable: true, value: retained.identity },
      evaluationIdentityDigest: { enumerable: true, value: retained.identityDigest },
      outcome: { enumerable: true, value: retained.outcome },
      outcomeDigest: { enumerable: true, value: retained.outcomeDigest },
    });
    intrinsicObjectFreeze(this);
  }

  evaluationIdentityBytes() {
    return copyBytes(privateGet(evaluations, this).identityBytes);
  }

  canonicalOutcomeBytes() {
    return copyBytes(privateGet(evaluations, this).outcomeBytes);
  }
}
intrinsicObjectFreeze(PreparedPolicyEvaluation.prototype);

export function createInvestigationPolicyEvaluator(ownerCore) {
  if (ownerCore === null || typeof ownerCore !== "object"
      || intrinsicObjectGetPrototypeOf(ownerCore) !== InvestigationCore.prototype) {
    throw new TypeError("A Policy evaluator requires an exact released InvestigationCore owner.");
  }
  return new PolicyEvaluator(EVALUATOR_TOKEN, ownerCore);
}

function cacheEntry(fresh) {
  return intrinsicObjectFreeze({
    evaluationIdentityDigest: fresh.identityDigest,
    identityBytes: copyBytes(fresh.identityBytes),
    outcomeBytes: copyBytes(fresh.outcomeBytes),
    outcomeDigest: fresh.outcomeDigest,
  });
}

function recomputeOutcome(
  topView,
  context,
  contextDigest,
  source,
  identity,
  identityBytes,
  identityDigest,
) {
  const completedResult = deepFreeze(evaluateArtifact(topView, context, contextDigest, source));
  return completeOutcome(identity, identityBytes, identityDigest, completedResult);
}

function validateCacheEntry(
  entry,
  identity,
  identityBytes,
  identityDigest,
  topView,
  context,
  contextDigest,
  source,
) {
  try {
    if (entry.evaluationIdentityDigest !== identityDigest
        || !byteEqual(entry.identityBytes, identityBytes)
        || domainSeparatedDigest(POLICY_EVALUATION_IDENTITY_DIGEST_DOMAIN, entry.identityBytes)
          !== identityDigest
        || domainSeparatedDigest(POLICY_EVALUATION_OUTCOME_DIGEST_DOMAIN, entry.outcomeBytes)
          !== entry.outcomeDigest) return undefined;
    const parsed = parseRestrictedJson(entry.outcomeBytes);
    if (!byteEqual(canonicalizeRestrictedJson(parsed), entry.outcomeBytes)) return undefined;
    validatePolicyEvaluationOutcome(parsed, {
      expectedIdentity: identity,
      expectedOutcomeDigest: entry.outcomeDigest,
    });
    const fresh = recomputeOutcome(
      topView,
      context,
      contextDigest,
      source,
      identity,
      identityBytes,
      identityDigest,
    );
    if (!byteEqual(entry.outcomeBytes, fresh.outcomeBytes)
        || entry.outcomeDigest !== fresh.outcomeDigest) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function evaluateInvestigationPolicy(evaluator, preparedArtifact, contextCapability, sources = []) {
  if (!privateHas(evaluators, evaluator)) throw new TypeError("A trusted Policy evaluator is required.");
  const evaluatorState = privateGet(evaluators, evaluator);
  const topView = preparedInvestigationPolicyArtifactEvaluationView(preparedArtifact);
  assertAuthoritativePolicyFactContext(contextCapability, evaluatorState.ownerCore);
  const normalizedSources = normalizeAuthoritativeDeterministicFactSources(
    sources,
    evaluatorState.ownerCore,
    contextCapability,
  );
  const context = contextCapability.artifact;
  const contextBytes = policyFactContextCanonicalBytes(contextCapability);
  const contextDigest = policyFactContextDigest(contextCapability);

  let inputBytes = byteLength(topView.semanticBytes) + byteLength(contextBytes);
  for (let index = 0; index < normalizedSources.length; index += 1) {
    inputBytes += byteLength(regressionPolicyFactSourceCanonicalBytes(normalizedSources[index]));
  }
  if (inputBytes > LIMITS["evaluation.input-canonical-bytes"]) {
    inputResourceFailure("evaluation.input-canonical-bytes", topView.artifact.kind);
  }
  const phaseH = phaseHMetrics(topView, context, normalizedSources);
  if (phaseH.ruleCount > LIMITS["evaluation.rule-evaluation-count"]) {
    inputResourceFailure("evaluation.rule-evaluation-count", topView.artifact.kind);
  }
  if (phaseH.visits > LIMITS["evaluation.selector-candidate-visit-count"]) {
    inputResourceFailure("evaluation.selector-candidate-visit-count", topView.artifact.kind);
  }

  const identity = deepFreeze(buildEvaluationIdentity(topView, context, contextDigest, normalizedSources));
  validateEvaluationIdentity(identity);
  const identityBytes = canonicalizeRestrictedJson(identity);
  const identityDigest = domainSeparatedDigest(POLICY_EVALUATION_IDENTITY_DIGEST_DOMAIN, identityBytes);
  const source = normalizedSources.length === 0 ? undefined : normalizedSources[0];
  const retained = intrinsicReflectApply(intrinsicMapGet, evaluatorState.cache, [identityDigest]);
  if (retained !== undefined) {
    const retainedOutcome = validateCacheEntry(
      retained,
      identity,
      identityBytes,
      identityDigest,
      topView,
      context,
      contextDigest,
      source,
    );
    if (retainedOutcome !== undefined) {
      deepFreeze(retainedOutcome);
      return new PreparedPolicyEvaluation(EVALUATION_TOKEN, {
        cacheDisposition: "HIT_RETURN_EXACT_RETAINED_BYTES",
        identity,
        identityBytes,
        identityDigest,
        outcome: retainedOutcome,
        outcomeBytes: copyBytes(retained.outcomeBytes),
        outcomeDigest: retained.outcomeDigest,
      });
    }
  }

  const fresh = recomputeOutcome(
    topView,
    context,
    contextDigest,
    source,
    identity,
    identityBytes,
    identityDigest,
  );
  deepFreeze(fresh.outcome);
  intrinsicReflectApply(intrinsicMapSet, evaluatorState.cache, [identityDigest, cacheEntry(fresh)]);
  return new PreparedPolicyEvaluation(EVALUATION_TOKEN, {
    ...fresh,
    cacheDisposition: "MISS_RECOMPUTE",
  });
}

export function isPreparedPolicyEvaluation(value) {
  return privateHas(evaluations, value);
}

export const POLICY_RULE_DECISION_CODES = intrinsicObjectFreeze(intrinsicObjectKeys(DECISION_CODE_ROWS));

// This verifier is deliberately detached from evaluator authority. It exists so
// frozen cache evidence can be inspected without creating a cache-injection API.
export function inspectDetachedPolicyEvaluationCacheVector(vector) {
  invariant(vector !== null && typeof vector === "object", "A detached cache vector is required.");
  const input = vector.authoritativeInput;
  invariant(input !== null && typeof input === "object"
    && input.artifact !== undefined && input.policyFactContext !== undefined
    && intrinsicArrayIsArray(input.externalSources),
  "Detached cache vector authoritative-input shape is invalid.");

  const artifactBytes = canonicalizeRestrictedJson(input.artifact);
  const preparedArtifact = input.artifact.kind === INVESTIGATION_POLICY_KIND
    ? prepareInvestigationPolicy(artifactBytes)
    : prepareInvestigationPolicySet(artifactBytes);
  const topView = preparedInvestigationPolicyArtifactEvaluationView(preparedArtifact);
  const context = input.policyFactContext;
  const contextDigest = policyFactContextDigest(context);
  const identity = buildEvaluationIdentity(topView, context, contextDigest, input.externalSources);
  const identityBytes = canonicalizeRestrictedJson(identity);
  const requestIdentityBytes = canonicalizeRestrictedJson(vector.requestIdentity);
  if (!byteEqual(identityBytes, requestIdentityBytes)) {
    return "MISS_RECOMPUTE_REQUEST_INPUT_BINDING_MISMATCH";
  }

  const requestDigest = domainSeparatedDigest(POLICY_EVALUATION_IDENTITY_DIGEST_DOMAIN, requestIdentityBytes);
  if (vector.cacheKey !== requestDigest) return "MISS_RECOMPUTE_KEY_MISMATCH";

  const retainedIdentityBytes = utf8Encode(vector.retainedEvaluationIdentityBytes);
  if (!byteEqual(retainedIdentityBytes, requestIdentityBytes)) {
    return "MISS_RECOMPUTE_IDENTITY_BYTES_MISMATCH";
  }
  if (domainSeparatedDigest(POLICY_EVALUATION_IDENTITY_DIGEST_DOMAIN, retainedIdentityBytes)
      !== vector.cacheKey) return "MISS_RECOMPUTE_IDENTITY_DIGEST_MISMATCH";

  const retainedOutcomeBytes = utf8Encode(vector.retainedOutcomeBytes);
  if (domainSeparatedDigest(POLICY_EVALUATION_OUTCOME_DIGEST_DOMAIN, retainedOutcomeBytes)
      !== vector.retainedOutcomeDigest) return "MISS_RECOMPUTE_OUTCOME_DIGEST_MISMATCH";

  let retainedOutcome;
  try {
    retainedOutcome = parseRestrictedJson(retainedOutcomeBytes);
  } catch {
    return "MISS_RECOMPUTE_OUTCOME_PARSE_FAILURE";
  }
  if (!byteEqual(canonicalizeRestrictedJson(retainedOutcome), retainedOutcomeBytes)) {
    return "MISS_RECOMPUTE_OUTCOME_NONCANONICAL";
  }
  if (!byteEqual(canonicalizeRestrictedJson(retainedOutcome.evaluationIdentity), requestIdentityBytes)
      || retainedOutcome.evaluationIdentityDigest !== requestDigest) {
    return "MISS_RECOMPUTE_EMBEDDED_IDENTITY_MISMATCH";
  }
  const retainedRules = retainedOutcome.result !== undefined
    ? flatRuleResults(retainedOutcome.result)
    : [];
  for (let index = 0; index < retainedRules.length; index += 1) {
    if (!intrinsicObjectHasOwn(DECISION_CODE_ROWS, retainedRules[index].decisionCode)) {
      return "MISS_RECOMPUTE_OUTCOME_SEMANTIC_MISMATCH";
    }
  }
  try {
    validatePolicyEvaluationOutcome(retainedOutcome, {
      expectedIdentity: identity,
      expectedOutcomeDigest: vector.retainedOutcomeDigest,
    });
  } catch {
    return "MISS_RECOMPUTE_OUTCOME_INVARIANT_FAILURE";
  }

  const source = input.externalSources.length === 0 ? undefined : input.externalSources[0];
  const fresh = recomputeOutcome(
    topView,
    context,
    contextDigest,
    source,
    identity,
    identityBytes,
    requestDigest,
  );
  if (!byteEqual(retainedOutcomeBytes, fresh.outcomeBytes)
      || vector.retainedOutcomeDigest !== fresh.outcomeDigest) {
    return "MISS_RECOMPUTE_OUTCOME_SEMANTIC_MISMATCH";
  }
  return "HIT_RETURN_EXACT_RETAINED_BYTES";
}
