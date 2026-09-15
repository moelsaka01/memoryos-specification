import {
  INVESTIGATION_CORE_VERSION,
  Investigation,
  InvestigationCore,
  InvestigationState,
  Transition,
  TransitionLog,
  captureInvestigationCoreStateForPolicy,
} from "./investigation-core.js";
import {
  COGNITIVE_REGRESSION_VERSION,
  compareCognitiveRegression,
} from "./cognitive-regression.js";
import {
  MACHINE_DEFINITION_IDENTITIES,
  MEMORYOS_POLICY_RESOURCE_PROFILE,
} from "./investigation-policy-contracts.js";
import { computeMipIntegrity } from "./memory-investigation-package.js";
import { canonicalize } from "./mip-canonical.js";
import {
  MemoryOSPolicyError,
  canonicalizeRestrictedJson,
  canonicalizeRestrictedJsonText,
  domainSeparatedDigest,
  inspectByteInput,
  isStableSemVer,
  isUnicodeScalarString,
  jsonCensus,
  parseRestrictedJson,
  utf16Compare,
} from "./policy-canonical.js";
import { createSemanticWorld, fingerprintObservation } from "./semantic-world.js";
import { buildGraph } from "./studio-model.js";
import {
  REGRESSION_POLICY_FACT_SOURCE_KIND,
  normalizeDeterministicFactSources,
  prepareRegressionPolicyFactSourceValue,
  projectRegressionPolicyFactSource,
} from "./regression-policy-fact-source.js";

const intrinsicObjectDefineProperties = Object.defineProperties;
const intrinsicObjectFreeze = Object.freeze;
const intrinsicObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicObjectGetPrototypeOf = Object.getPrototypeOf;
const intrinsicObjectIsFrozen = Object.isFrozen;
const intrinsicObjectKeys = Object.keys;
const intrinsicObjectValues = Object.values;
const IntrinsicSet = Set;
const intrinsicSetAdd = Set.prototype.add;
const intrinsicSetHas = Set.prototype.has;
const IntrinsicUint8Array = Uint8Array;
const intrinsicTypedArrayPrototype = intrinsicObjectGetPrototypeOf(Uint8Array.prototype);
const intrinsicTypedArrayByteLengthGetter = intrinsicObjectGetOwnPropertyDescriptor(
  intrinsicTypedArrayPrototype,
  "byteLength",
).get;
const intrinsicUint8ArraySet = Uint8Array.prototype.set;

export const POLICY_FACT_CONTEXT_KIND = "MemoryOSPolicyFactContext";
export const POLICY_FACT_CONTEXT_VERSION = "1.0.0";
export const POLICY_FACT_MODEL_VERSION = "1.0.0";
export const POLICY_FACT_CONTEXT_DIGEST_DOMAIN = "MEMORYOS-POLICY-FACT-CONTEXT-1.0";
export const POLICY_FACT_IDENTIFIER_DIGEST_DOMAIN = "MEMORYOS-POLICY-FACT-IDENTIFIER-1.0";
export const POLICY_FACT_MODEL_DIGEST = MACHINE_DEFINITION_IDENTITIES.find(
  ({ identityName }) => identityName === "factModelDigest",
)?.normativeDigest;

export const POLICY_FACT_CONTEXT_FAILURE_CODES = Object.freeze([
  "POLICY_FACT_CONTEXT_SYNTAX_INVALID",
  "POLICY_FACT_CONTEXT_SCHEMA_INVALID",
  "POLICY_FACT_CONTEXT_VERSION_UNSUPPORTED",
  "POLICY_FACT_MODEL_VERSION_UNSUPPORTED",
  "POLICY_FACT_CONTEXT_TRANSITION_BINDING_MISMATCH",
  "POLICY_FACT_CONTEXT_INCOMPLETE",
  "POLICY_FACT_CONTEXT_DIGEST_MISMATCH",
  "POLICY_FACT_CONTEXT_ATOMIC_CAPTURE_FAILED",
  "POLICY_FACT_CONTEXT_SOURCE_STATE_INVALID",
  "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
]);

export const POLICY_FACT_CONTEXT_DOMAIN_ORDER = Object.freeze([
  "lifecycle",
  "transitions",
  "observations",
  "artifactCardinalities",
  "activeTrace",
  "activeReplay",
  "activeEvolution",
  "activeComparativeReconstruction",
  "verification",
  "mipIntegrity",
  "compatibility",
]);

export const POLICY_FACT_CONTEXT_RESOURCE_LIMIT_IDENTIFIERS = Object.freeze([
  "policy-fact-context.raw-document-bytes",
  "policy-fact-context.canonical-document-bytes",
  "policy-fact-context.transition-count",
  "policy-fact-context.observation-count",
  "policy-fact-context.total-fact-count",
]);

const LIMITS = MEMORYOS_POLICY_RESOURCE_PROFILE.limits;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const EXTENSION_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?){2,}$/u;
const SOURCE_KINDS = new Set(["native", "mip"]);
const LIFECYCLE_STATES = new Set([
  "Created", "Observed", "Traced", "ReplayReady", "Replaying",
  "ReplayComplete", "ComparisonReady", "Comparing", "Verified", "Archived",
]);
const TRANSITION_KINDS = new Set([
  "CREATED", "OBSERVED", "PACKAGE_IMPORTED", "TRACE_SELECTED", "REPLAY_PREPARED",
  "REPLAY_ACTION", "EVOLUTION_ENTERED", "EVOLUTION_MOVED", "COMPARATIVE_ENTERED",
  "COMPARATIVE_ACTION", "COMPARATIVE_LEFT", "EVOLUTION_LEFT", "RETURNED_TO_WORLD",
  "VERIFIED", "ARCHIVED",
]);
const ARTIFACT_CLASSES = Object.freeze([
  "evidence", "semanticTransformation", "retrieval", "reflection",
]);
const ACTIVE_STATUSES = new Set(["ready", "playing", "paused", "completed"]);
const MIP_SECTION_NAMES = Object.freeze([
  "manifest", "metadata", "observations", "traces", "replays", "evolutions",
  "comparativeReconstructions", "extensions", "verification",
]);
const MIP_CHECKS = Object.freeze([
  "STRUCTURE", "CANONICAL_BYTES", "INTEGRITY", "REFERENCE_CLOSURE",
  "DETERMINISTIC_DERIVATIONS", "PROHIBITED_CONTENT",
]);
const NATIVE_CHECKS = Object.freeze([
  "TRANSITION_LOG", "LIFECYCLE", "TRACE", "REPLAY", "EVOLUTION", "COMPARATIVE",
]);
const COMPATIBILITY = Object.freeze({
  native: Object.freeze([
    Object.freeze(["nativeObservationProfileIdentifier", "cca-studio-native-observation"]),
    Object.freeze(["nativeObservationProfileVersion", "1.1.0"]),
    Object.freeze(["nativeSnapshotContract", "CCA-STUDIO-1.0"]),
  ]),
  mip: Object.freeze([
    Object.freeze(["mipCanonicalizationProfile", "RFC8785"]),
    Object.freeze(["mipDigestProfile", "SHA-256"]),
    Object.freeze(["mipFormatVersion", "1.0.0"]),
    Object.freeze(["mipSchema", "urn:memoryos:mip:schema:1.0.0"]),
    Object.freeze(["mipValidationProfile", "MIP-CORE-1.0"]),
  ]),
});
const preparedData = new WeakMap();
const authoritativeOwners = new WeakMap();
const authoritativeRegressionOwners = new WeakMap();
const PREPARED_CONTEXT_TOKEN = Symbol("MemoryOS prepared PolicyFactContext");
const intrinsicReflectApply = Reflect.apply;
const weakMapGet = WeakMap.prototype.get;
const weakMapHas = WeakMap.prototype.has;
const weakMapSet = WeakMap.prototype.set;

function privateGet(map, key) {
  return intrinsicReflectApply(weakMapGet, map, [key]);
}

function privateHas(map, key) {
  return intrinsicReflectApply(weakMapHas, map, [key]);
}

function privateSet(map, key, value) {
  intrinsicReflectApply(weakMapSet, map, [key, value]);
}

function copyBytes(value) {
  const byteLength = intrinsicReflectApply(intrinsicTypedArrayByteLengthGetter, value, []);
  const result = new IntrinsicUint8Array(byteLength);
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

function fail(code, message, details = {}) {
  throw new MemoryOSPolicyError(code, message, {
    artifactKind: POLICY_FACT_CONTEXT_KIND,
    phase: "policyFactContext",
    ...details,
  });
}

function sourceFail(code, message, details = {}) {
  throw new MemoryOSPolicyError(code, message, {
    artifactKind: REGRESSION_POLICY_FACT_SOURCE_KIND,
    phase: "deterministicFactSource",
    ...details,
  });
}

function schema(condition, message) {
  if (!condition) fail("POLICY_FACT_CONTEXT_SCHEMA_INVALID", message);
}

function incomplete(condition, message) {
  if (!condition) fail("POLICY_FACT_CONTEXT_INCOMPLETE", message);
}

function transitionBinding(condition, message) {
  if (!condition) fail("POLICY_FACT_CONTEXT_TRANSITION_BINDING_MISMATCH", message);
}

function enforceLimit(identifier, observed, phase) {
  const configuredLimit = LIMITS[identifier];
  if (observed <= configuredLimit) return;
  fail(
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    `${POLICY_FACT_CONTEXT_KIND} exceeds ${identifier}.`,
    {
      configuredLimit,
      enforcementPhase: phase,
      limitIdentifier: identifier,
      observedAtLeast: configuredLimit + 1,
    },
  );
}

function isObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = intrinsicObjectGetPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function closed(value, names, label) {
  schema(isObject(value), `${label} must be an object.`);
  const actual = intrinsicObjectKeys(value).sort(utf16Compare);
  const expected = [...names].sort(utf16Compare);
  schema(
    actual.length === expected.length && actual.every((name, index) => name === expected[index]),
    `${label} must have its exact closed member set.`,
  );
}

function scalar(value, label, allowEmpty = false) {
  schema(isUnicodeScalarString(value) && (allowEmpty || value.length > 0), `${label} is invalid.`);
}

function digest(value, label) {
  schema(typeof value === "string" && DIGEST_PATTERN.test(value), `${label} must be a lowercase SHA-256 digest.`);
}

function integer(value, label, positive = false) {
  schema(Number.isSafeInteger(value) && value >= (positive ? 1 : 0), `${label} must be a ${positive ? "positive" : "non-negative"} safe integer.`);
}

function same(left, right) {
  return canonicalizeRestrictedJsonText(left) === canonicalizeRestrictedJsonText(right);
}

function unicodeScalarCompare(left, right) {
  const leftScalars = Array.from(left, (value) => value.codePointAt(0));
  const rightScalars = Array.from(right, (value) => value.codePointAt(0));
  const length = Math.min(leftScalars.length, rightScalars.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftScalars[index] - rightScalars[index];
    if (difference !== 0) return difference;
  }
  return leftScalars.length - rightScalars.length;
}

function orderedSet(values) {
  return values.every((value, index) => (
    scalarBoolean(value)
    && (index === 0 || unicodeScalarCompare(values[index - 1], value) < 0)
  ));
}

function scalarBoolean(value) {
  return isUnicodeScalarString(value) && value.length > 0;
}

function fact(domain, subject, value) {
  return {
    factIdentifier: policyFactIdentifier(domain, subject),
    subject,
    value,
  };
}

function available(items) {
  return { availability: "available", items };
}

function validateFactEnvelope(domain, item, index, sourceKind) {
  closed(item, ["factIdentifier", "subject", "value"], `${domain}[${index}]`);
  digest(item.factIdentifier, `${domain}[${index}].factIdentifier`);
  const { subject, value } = item;
  if (domain === "lifecycle") {
    closed(subject, [], "lifecycle subject");
    closed(value, ["state"], "lifecycle value");
    schema(LIFECYCLE_STATES.has(value.state), "Lifecycle state is not registered.");
  } else if (domain === "transitions") {
    closed(subject, ["identifier"], "transition subject");
    digest(subject.identifier, "Transition identifier");
    closed(value, ["index", "kind"], "transition value");
    integer(value.index, "Transition index");
    schema(TRANSITION_KINDS.has(value.kind), "Transition kind is not registered.");
  } else if (domain === "observations") {
    closed(subject, ["identifier", "position"], "observation subject");
    scalar(subject.identifier, "Observation identifier");
    integer(subject.position, "Observation position");
    closed(value, ["sequence"], "observation value");
    integer(value.sequence, "Observation sequence");
  } else if (domain === "artifactCardinalities") {
    closed(subject, ["artifactClass", "observationFactIdentifier"], "artifact-cardinality subject");
    schema(ARTIFACT_CLASSES.includes(subject.artifactClass), "Artifact class is not registered.");
    digest(subject.observationFactIdentifier, "Observation fact identifier");
    closed(value, ["count"], "artifact-cardinality value");
    integer(value.count, "Artifact count");
  } else if (domain === "activeTrace") {
    closed(subject, ["identifier"], "active Trace subject");
    scalar(subject.identifier, "Active Trace identifier");
    closed(value, ["branchCount", "observationFactIdentifier", "roleCounts", "stepCount"], "active Trace value");
    integer(value.branchCount, "Trace branch count", true);
    digest(value.observationFactIdentifier, "Trace observation fact identifier");
    integer(value.stepCount, "Trace step count", true);
    closed(value.roleCounts, ["originEvidence", "reflectionCurrent", "retrieval", "semanticTransformation"], "Trace role counts");
    for (const name of ["originEvidence", "reflectionCurrent", "retrieval", "semanticTransformation"]) {
      integer(value.roleCounts[name], `Trace ${name} count`);
    }
  } else if (domain === "activeReplay") {
    closed(subject, ["identifier"], "active Replay subject");
    scalar(subject.identifier, "Active Replay identifier");
    closed(value, ["observationFactIdentifier", "status", "stepCount", "traceFactIdentifier"], "active Replay value");
    digest(value.observationFactIdentifier, "Replay observation fact identifier");
    digest(value.traceFactIdentifier, "Replay Trace fact identifier");
    integer(value.stepCount, "Replay step count", true);
    schema(ACTIVE_STATUSES.has(value.status), "Replay status is invalid.");
  } else if (domain === "activeEvolution") {
    closed(subject, ["identifier"], "active Evolution subject");
    scalar(subject.identifier, "Active Evolution identifier");
    closed(value, ["differenceCount", "fromObservationFactIdentifier", "toObservationFactIdentifier"], "active Evolution value");
    integer(value.differenceCount, "Evolution difference count");
    digest(value.fromObservationFactIdentifier, "Evolution from-observation fact identifier");
    digest(value.toObservationFactIdentifier, "Evolution to-observation fact identifier");
  } else if (domain === "activeComparativeReconstruction") {
    closed(subject, ["identifier"], "active Comparative Reconstruction subject");
    scalar(subject.identifier, "Comparative Reconstruction identifier");
    closed(value, ["divergenceCount", "evolutionFactIdentifier", "momentCount", "status"], "active Comparative Reconstruction value");
    integer(value.divergenceCount, "Comparative divergence count");
    digest(value.evolutionFactIdentifier, "Comparative Evolution fact identifier");
    integer(value.momentCount, "Comparative moment count", true);
    schema(ACTIVE_STATUSES.has(value.status), "Comparative status is invalid.");
  } else if (domain === "verification") {
    closed(subject, ["identifier"], "Verification subject");
    scalar(subject.identifier, "Verification identifier");
    closed(value, ["checks", "lifecycle", "status", "transitionLogDigest"], "Verification value");
    schema(Array.isArray(value.checks), "Verification checks must be an array.");
    value.checks.forEach((check) => {
      closed(check, ["code", "status"], "Verification check");
      schema(check.status === "passed", "Verification check status must be passed.");
      schema((sourceKind === "mip" ? [...NATIVE_CHECKS.slice(0, 2), "MIP"] : NATIVE_CHECKS).includes(check.code), "Verification check code is invalid.");
    });
    schema(value.lifecycle === "Verified" && value.status === "passed", "Verification completion values are invalid.");
    digest(value.transitionLogDigest, "Verified transition-log digest");
  } else if (domain === "mipIntegrity") {
    validateMipIntegrityFact(subject, value);
  } else if (domain === "compatibility") {
    closed(subject, ["name"], "Compatibility subject");
    scalar(subject.name, "Compatibility claim name");
    closed(value, ["value"], "Compatibility value");
    scalar(value.value, "Compatibility claim value");
  }
}

function validateMipIntegrityFact(subject, value) {
  closed(subject, ["packageIdentifier"], "MIP integrity subject");
  scalar(subject.packageIdentifier, "MIP package identifier");
  closed(value, ["features", "formatVersion", "integrity", "inventory", "schemaIdentifier", "verification"], "MIP integrity value");
  closed(value.features, ["optional", "required"], "MIP features");
  for (const name of ["optional", "required"]) {
    schema(Array.isArray(value.features[name]), `MIP ${name} features must be an array.`);
    value.features[name].forEach((entry) => schema(EXTENSION_PATTERN.test(entry), "MIP extension name is invalid."));
  }
  schema(value.formatVersion === "1.0.0", "MIP format version is invalid.");
  schema(value.schemaIdentifier === "urn:memoryos:mip:schema:1.0.0", "MIP schema identifier is invalid.");
  closed(value.integrity, ["cognitionDigest", "packageDigest", "profile", "sectionDigests"], "MIP integrity values");
  digest(value.integrity.cognitionDigest, "MIP cognition digest");
  digest(value.integrity.packageDigest, "MIP package digest");
  schema(value.integrity.profile === "MIP-SHA-256-1.0", "MIP integrity profile is invalid.");
  schema(Array.isArray(value.integrity.sectionDigests) && value.integrity.sectionDigests.length === MIP_SECTION_NAMES.length, "MIP section digests are invalid.");
  value.integrity.sectionDigests.forEach((entry, index) => {
    closed(entry, ["digest", "name"], "MIP section digest");
    schema(entry.name === MIP_SECTION_NAMES[index], "MIP section digest order is invalid.");
    digest(entry.digest, "MIP section digest");
  });
  closed(value.inventory, ["comparativeReconstructions", "evolutions", "observations", "replays", "traces"], "MIP inventory");
  for (const name of ["comparativeReconstructions", "evolutions", "replays", "traces"]) integer(value.inventory[name], `MIP ${name} count`);
  integer(value.inventory.observations, "MIP observations count", true);
  closed(value.verification, ["checks", "profile", "status"], "MIP verification");
  schema(value.verification.profile === "MIP-CORE-1.0" && value.verification.status === "passed", "MIP verification status is invalid.");
  schema(Array.isArray(value.verification.checks) && value.verification.checks.length === MIP_CHECKS.length, "MIP verification checks are invalid.");
  value.verification.checks.forEach((entry, index) => {
    closed(entry, ["code", "status"], "MIP verification check");
    schema(entry.code === MIP_CHECKS[index] && entry.status === "passed", "MIP verification check order is invalid.");
  });
}

function validateContextSchema(context) {
  closed(context, ["factModelVersion", "facts", "investigation", "kind", "transitionLog", "version"], "PolicyFactContext");
  schema(context.kind === POLICY_FACT_CONTEXT_KIND, "PolicyFactContext kind is invalid.");
  schema(isStableSemVer(context.version), "PolicyFactContext version must be stable SemVer.");
  schema(isStableSemVer(context.factModelVersion), "Fact-model version must be stable SemVer.");
  closed(context.investigation, ["identifier", "sourceKind", "workspaceIdentifier"], "PolicyFactContext investigation");
  scalar(context.investigation.identifier, "Investigation identifier");
  scalar(context.investigation.workspaceIdentifier, "Workspace identifier");
  schema(SOURCE_KINDS.has(context.investigation.sourceKind), "Investigation source kind is invalid.");
  closed(context.transitionLog, ["coreVersion", "headTransitionIdentifier", "transitionCount", "transitionLogDigest"], "PolicyFactContext transitionLog");
  schema(isStableSemVer(context.transitionLog.coreVersion), "Core version must be stable SemVer.");
  digest(context.transitionLog.headTransitionIdentifier, "Head transition identifier");
  digest(context.transitionLog.transitionLogDigest, "Transition-log digest");
  integer(context.transitionLog.transitionCount, "Transition count", true);
  closed(context.facts, POLICY_FACT_CONTEXT_DOMAIN_ORDER, "PolicyFactContext facts");
  for (const domain of POLICY_FACT_CONTEXT_DOMAIN_ORDER) {
    const state = context.facts[domain];
    schema(isObject(state) && ["available", "notApplicable", "unavailable"].includes(state.availability), `${domain} availability is invalid.`);
    if (state.availability === "available") {
      closed(state, ["availability", "items"], `${domain} domain state`);
      schema(Array.isArray(state.items), `${domain} items must be an array.`);
      state.items.forEach((item, index) => validateFactEnvelope(domain, item, index, context.investigation.sourceKind));
    } else {
      closed(state, ["availability"], `${domain} domain state`);
    }
  }
}

function validateVersions(context) {
  if (context.version !== POLICY_FACT_CONTEXT_VERSION) {
    fail("POLICY_FACT_CONTEXT_VERSION_UNSUPPORTED", `Unsupported PolicyFactContext version '${context.version}'.`);
  }
  if (context.factModelVersion !== POLICY_FACT_MODEL_VERSION) {
    fail("POLICY_FACT_MODEL_VERSION_UNSUPPORTED", `Unsupported fact-model version '${context.factModelVersion}'.`);
  }
}

function enforceJsonLimits(context) {
  const census = jsonCensus(context);
  enforceLimit("json.nesting-depth", census.maximumDepth, "C");
  enforceLimit("json.value-count", census.valueCount, "C");
  enforceLimit("json.string-utf8-bytes", census.maximumStringUtf8Bytes, "C");
}

function enforceContextLocalLimits(context) {
  const availableItems = POLICY_FACT_CONTEXT_DOMAIN_ORDER.flatMap((domain) => (
    context.facts[domain].availability === "available" ? context.facts[domain].items : []
  ));
  const observationCount = context.facts.observations.availability === "available"
    ? context.facts.observations.items.length
    : 0;
  enforceLimit("policy-fact-context.transition-count", context.transitionLog.transitionCount, "E");
  enforceLimit("policy-fact-context.observation-count", observationCount, "E");
  enforceLimit("policy-fact-context.total-fact-count", availableItems.length, "E");
}

function validateTransitionBindings(context) {
  const transitions = context.facts.transitions;
  transitionBinding(transitions.availability === "available", "Transitions must be available.");
  transitionBinding(context.transitionLog.coreVersion === INVESTIGATION_CORE_VERSION, "Core version does not bind the released Core semantics.");
  transitionBinding(transitions.items.length === context.transitionLog.transitionCount, "Transition count does not match transition facts.");
  transitions.items.forEach((item, index) => transitionBinding(item.value.index === index, "Transition indices must be contiguous from zero."));
  transitionBinding(transitions.items[0]?.value.kind === "CREATED", "The transition log must begin with CREATED.");
  transitionBinding(
    transitions.items.at(-1)?.subject.identifier === context.transitionLog.headTransitionIdentifier,
    "The head transition identifier does not equal the last transition fact subject.",
  );
  if (context.investigation.sourceKind === "native") {
    transitionBinding(!transitions.items.some(({ value }) => value.kind === "PACKAGE_IMPORTED"), "Native transition logs cannot import a MIP.");
  } else {
    transitionBinding(transitions.items[1]?.value.kind === "PACKAGE_IMPORTED", "MIP transition logs require the CREATED, PACKAGE_IMPORTED prefix.");
  }
}

function verifyFacts(context) {
  for (const domain of POLICY_FACT_CONTEXT_DOMAIN_ORDER) {
    const state = context.facts[domain];
    if (state.availability !== "available") continue;
    const identifiers = new Set();
    const subjects = new Set();
    for (const item of state.items) {
      const expected = policyFactIdentifier(domain, item.subject);
      incomplete(item.factIdentifier === expected, `${domain} fact identifier does not match its subject.`);
      const subjectKey = canonicalizeRestrictedJsonText(item.subject);
      incomplete(!identifiers.has(item.factIdentifier) && !subjects.has(subjectKey), `${domain} contains duplicate fact subjects or identifiers.`);
      identifiers.add(item.factIdentifier);
      subjects.add(subjectKey);
    }
  }
}

function expectedChecks(context) {
  if (context.investigation.sourceKind === "mip") return ["TRANSITION_LOG", "LIFECYCLE", "MIP"];
  const result = ["TRANSITION_LOG", "LIFECYCLE"];
  for (const [domain, code] of [
    ["activeTrace", "TRACE"], ["activeReplay", "REPLAY"],
    ["activeEvolution", "EVOLUTION"], ["activeComparativeReconstruction", "COMPARATIVE"],
  ]) if (context.facts[domain].items.length === 1) result.push(code);
  return result;
}

function validateCompleteness(context) {
  const { sourceKind } = context.investigation;
  for (const domain of POLICY_FACT_CONTEXT_DOMAIN_ORDER) {
    const expected = domain === "mipIntegrity" && sourceKind === "native" ? "notApplicable" : "available";
    incomplete(context.facts[domain].availability === expected, `${domain} availability is incomplete for ${sourceKind}.`);
  }
  verifyFacts(context);
  incomplete(context.facts.lifecycle.items.length === 1, "Lifecycle must contain exactly one fact.");
  const observations = context.facts.observations.items;
  const observationIds = new Set();
  observations.forEach((item, index) => {
    incomplete(item.subject.position === index, "Observation positions must equal retained array positions.");
    if (sourceKind === "native") incomplete(item.value.sequence === index, "Native observation sequence must equal retained position.");
    if (sourceKind === "mip") incomplete(!observationIds.has(item.subject.identifier), "MIP observation identifiers must be unique.");
    observationIds.add(item.subject.identifier);
    if (sourceKind === "mip" && index > 0) {
      const previous = observations[index - 1];
      incomplete(
        previous.value.sequence < item.value.sequence
          || (previous.value.sequence === item.value.sequence
            && unicodeScalarCompare(previous.subject.identifier, item.subject.identifier) < 0),
        "MIP observations must be ordered by sequence and identifier.",
      );
    }
  });
  const observationFactIds = new Set(observations.map(({ factIdentifier }) => factIdentifier));
  const cards = context.facts.artifactCardinalities.items;
  incomplete(cards.length === observations.length * ARTIFACT_CLASSES.length, "Artifact cardinalities must cover every observation and class.");
  cards.forEach((item, index) => {
    const observationIndex = Math.floor(index / ARTIFACT_CLASSES.length);
    incomplete(item.subject.observationFactIdentifier === observations[observationIndex]?.factIdentifier, "Artifact cardinality observation order is invalid.");
    incomplete(item.subject.artifactClass === ARTIFACT_CLASSES[index % ARTIFACT_CLASSES.length], "Artifact cardinality class order is invalid.");
  });
  for (const domain of ["activeTrace", "activeReplay", "activeEvolution", "activeComparativeReconstruction", "verification"]) {
    incomplete(context.facts[domain].items.length <= 1, `${domain} cardinality exceeds one.`);
  }
  const trace = context.facts.activeTrace.items[0];
  if (trace) {
    const counts = trace.value.roleCounts;
    incomplete(observationFactIds.has(trace.value.observationFactIdentifier), "Active Trace observation binding is invalid.");
    incomplete(counts.originEvidence >= trace.value.branchCount, "Active Trace origin-evidence count is incomplete.");
    incomplete(counts.semanticTransformation === trace.value.branchCount && counts.retrieval === trace.value.branchCount && counts.reflectionCurrent === trace.value.branchCount, "Active Trace per-branch role counts are invalid.");
    incomplete(trace.value.stepCount === counts.originEvidence + counts.semanticTransformation + counts.retrieval + counts.reflectionCurrent, "Active Trace step count is invalid.");
  }
  const replay = context.facts.activeReplay.items[0];
  if (replay) {
    incomplete(Boolean(trace) && replay.value.traceFactIdentifier === trace.factIdentifier, "Active Replay Trace binding is invalid.");
    incomplete(replay.value.observationFactIdentifier === trace?.value.observationFactIdentifier, "Active Replay observation binding is invalid.");
  }
  const evolution = context.facts.activeEvolution.items[0];
  if (evolution) {
    const from = observations.findIndex(({ factIdentifier }) => factIdentifier === evolution.value.fromObservationFactIdentifier);
    const to = observations.findIndex(({ factIdentifier }) => factIdentifier === evolution.value.toObservationFactIdentifier);
    incomplete(from >= 0 && to > from, "Active Evolution observation bindings are invalid.");
  }
  const comparative = context.facts.activeComparativeReconstruction.items[0];
  if (comparative) incomplete(Boolean(evolution) && comparative.value.evolutionFactIdentifier === evolution.factIdentifier, "Comparative Reconstruction Evolution binding is invalid.");
  const verification = context.facts.verification.items[0];
  if (verification) incomplete(same(verification.value.checks, expectedChecks(context).map((code) => ({ code, status: "passed" }))), "Verification check inventory or order is invalid.");
  const expectedCompatibility = COMPATIBILITY[sourceKind];
  const compatibility = context.facts.compatibility.items;
  incomplete(compatibility.length === expectedCompatibility.length, "Compatibility claim inventory is incomplete.");
  compatibility.forEach((item, index) => incomplete(
    item.subject.name === expectedCompatibility[index][0] && item.value.value === expectedCompatibility[index][1],
    "Compatibility claim value or order is invalid.",
  ));
  if (sourceKind === "mip") {
    const mip = context.facts.mipIntegrity.items;
    incomplete(mip.length === 1, "MIP integrity must contain exactly one fact.");
    incomplete(mip[0].value.inventory.observations === observations.length, "MIP observation inventory does not match observation facts.");
    const optional = mip[0].value.features.optional;
    const required = mip[0].value.features.required;
    incomplete(orderedSet(optional) && orderedSet(required), "MIP features must be ordered unique sets.");
    incomplete(optional.every((name) => !required.includes(name)), "MIP optional and required features must be disjoint.");
    for (const [domain, inventoryName] of [
      ["activeTrace", "traces"], ["activeReplay", "replays"], ["activeEvolution", "evolutions"],
      ["activeComparativeReconstruction", "comparativeReconstructions"],
    ]) if (context.facts[domain].items.length === 1) incomplete(mip[0].value.inventory[inventoryName] >= 1, `Active ${domain} is absent from MIP inventory.`);
  }
}

function validateNormalizedContext(context, expectedContextDigest) {
  enforceJsonLimits(context);
  validateContextSchema(context);
  validateVersions(context);
  enforceContextLocalLimits(context);
  validateTransitionBindings(context);
  validateCompleteness(context);
  const bytes = canonicalizeRestrictedJson(context);
  enforceLimit("policy-fact-context.canonical-document-bytes", bytes.length, "F");
  const contextDigest = domainSeparatedDigest(POLICY_FACT_CONTEXT_DIGEST_DOMAIN, bytes);
  if (expectedContextDigest !== undefined && contextDigest !== expectedContextDigest) {
    fail("POLICY_FACT_CONTEXT_DIGEST_MISMATCH", "PolicyFactContext digest does not match the expected digest.", {
      actualDigest: contextDigest,
      expectedDigest: expectedContextDigest,
    });
  }
  return { bytes, contextDigest };
}

class PreparedPolicyFactContext {
  constructor(token, artifact, bytes, contextDigest) {
    if (token !== PREPARED_CONTEXT_TOKEN) {
      throw new TypeError("Prepared PolicyFactContext capabilities cannot be constructed by callers.");
    }
    intrinsicObjectDefineProperties(this, {
      kind: { enumerable: true, value: POLICY_FACT_CONTEXT_KIND },
      version: { enumerable: true, value: POLICY_FACT_CONTEXT_VERSION },
      factModelVersion: { enumerable: true, value: POLICY_FACT_MODEL_VERSION },
      contextDigest: { enumerable: true, value: contextDigest },
      artifact: { enumerable: true, value: artifact },
    });
    privateSet(preparedData, this, { bytes: copyBytes(bytes) });
    intrinsicObjectFreeze(this);
  }

  canonicalBytes() {
    return copyBytes(privateGet(preparedData, this).bytes);
  }
}
intrinsicObjectFreeze(PreparedPolicyFactContext.prototype);

function prepared(context, expectedContextDigest) {
  const { bytes, contextDigest } = validateNormalizedContext(context, expectedContextDigest);
  deepFreeze(context);
  return new PreparedPolicyFactContext(PREPARED_CONTEXT_TOKEN, context, bytes, contextDigest);
}

function normalizeLogicalContext(value) {
  let bytes;
  try {
    bytes = canonicalizeRestrictedJson(value);
    return parseRestrictedJson(bytes);
  } catch {
    fail("POLICY_FACT_CONTEXT_SCHEMA_INVALID", "PolicyFactContext must be closed restricted JSON data.");
  }
}

export function policyFactIdentifier(domain, subject) {
  if (!POLICY_FACT_CONTEXT_DOMAIN_ORDER.includes(domain)) {
    throw new TypeError(`Unknown PolicyFactContext domain: ${String(domain)}`);
  }
  let bytes;
  try {
    bytes = canonicalizeRestrictedJson({
      domain,
      factModelVersion: POLICY_FACT_MODEL_VERSION,
      subject,
    });
  } catch {
    throw new TypeError("Policy fact subject must be closed restricted JSON data.");
  }
  return domainSeparatedDigest(POLICY_FACT_IDENTIFIER_DIGEST_DOMAIN, bytes);
}

export function preparePolicyFactContext(bytesLike, { expectedContextDigest } = {}) {
  let input;
  try {
    input = inspectByteInput(bytesLike, "PolicyFactContext bytes");
  } catch {
    fail("POLICY_FACT_CONTEXT_SYNTAX_INVALID", "PolicyFactContext input must be immutable byte input.", { enforcementPhase: "A" });
  }
  enforceLimit("policy-fact-context.raw-document-bytes", input.byteLength, "A");
  let context;
  try {
    context = parseRestrictedJson(input.snapshot());
  } catch {
    fail("POLICY_FACT_CONTEXT_SYNTAX_INVALID", "PolicyFactContext is not valid restricted JSON.", { enforcementPhase: "B" });
  }
  return prepared(context, expectedContextDigest);
}

export function validatePolicyFactContext(value, { expectedContextDigest } = {}) {
  const context = normalizeLogicalContext(value);
  validateNormalizedContext(context, expectedContextDigest);
  return true;
}

export function policyFactContextCanonicalBytes(value) {
  if (privateHas(preparedData, value)) return copyBytes(privateGet(preparedData, value).bytes);
  const context = normalizeLogicalContext(value);
  return copyBytes(validateNormalizedContext(context).bytes);
}

export function policyFactContextDigest(value) {
  if (privateHas(preparedData, value)) return value.contextDigest;
  const context = normalizeLogicalContext(value);
  return validateNormalizedContext(context).contextDigest;
}

function assertExactCore(core) {
  if (core === null || typeof core !== "object" || intrinsicObjectGetPrototypeOf(core) !== InvestigationCore.prototype) {
    fail("POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED", "PolicyFactContext capture requires an exact released InvestigationCore owner.");
  }
}

function validateCapturedInvestigation(investigation) {
  if (intrinsicObjectGetPrototypeOf(investigation) !== Investigation.prototype
      || intrinsicObjectGetPrototypeOf(investigation.transitionLog) !== TransitionLog.prototype
      || intrinsicObjectGetPrototypeOf(investigation.state) !== InvestigationState.prototype
      || !intrinsicObjectIsFrozen(investigation)
      || !intrinsicObjectIsFrozen(investigation.transitionLog)
      || !intrinsicObjectIsFrozen(investigation.state)) {
    throw new TypeError("Core capture did not return the exact immutable Investigation shape.");
  }
  const { transitionLog } = investigation;
  if (transitionLog.investigationIdentifier !== investigation.identifier
      || transitionLog.version !== INVESTIGATION_CORE_VERSION
      || transitionLog.transitions.length === 0
      || transitionLog.transitions.some((entry) => intrinsicObjectGetPrototypeOf(entry) !== Transition.prototype || !intrinsicObjectIsFrozen(entry))) {
    throw new TypeError("Captured transition log is not an exact released Core log.");
  }
  const reconstructed = new TransitionLog(investigation.identifier, transitionLog.transitions);
  if (reconstructed.digest !== transitionLog.digest) throw new TypeError("Captured transition-log digest is invalid.");
}

function validateNativeFrames(state) {
  let sessionIdentifier;
  state.observationFrames.forEach((frame, index) => {
    if (!intrinsicObjectIsFrozen(frame) || frame.sequence !== index
        || frame.snapshot.workspaceIdentifier !== state.workspaceIdentifier
        || frame.world.frame.workspaceIdentifier !== state.workspaceIdentifier
        || frame.world.frame.observationIdentifier !== frame.snapshot.observationIdentifier
        || frame.world.frame.index !== index) throw new TypeError("Native observation frame binding is invalid.");
    const currentSession = frame.snapshot.session?.identifier;
    if (!scalarBoolean(currentSession)
        || frame.world.frame.sessionIdentifier !== currentSession
        || (index > 0 && sessionIdentifier !== currentSession)) throw new TypeError("Native observation session binding is invalid.");
    sessionIdentifier = currentSession;
    const expected = createSemanticWorld(buildGraph(frame.snapshot), {
      frameIndex: index,
      observationFingerprint: fingerprintObservation(frame.snapshot),
      observationIdentifier: frame.snapshot.observationIdentifier,
      workspaceIdentifier: frame.snapshot.workspaceIdentifier,
      sessionIdentifier: currentSession,
      source: frame.snapshot.source,
    });
    if (canonicalize(expected) !== canonicalize(frame.world)) throw new TypeError("Native semantic world is not the canonical snapshot projection.");
  });
}

function nativeCardinality(frame, artifactClass) {
  const nodes = frame.world.nodes.filter(({ aggregate, detail }) => !aggregate && !detail);
  if (artifactClass === "evidence") return nodes.filter(({ kind, family }) => kind === "long-term" && family === "LongTermMemory").length;
  if (artifactClass === "retrieval") return nodes.filter(({ kind, family }) => kind === "retrieval" && family === "Retrieval session").length;
  if (artifactClass === "reflection") return nodes.filter(({ kind, family }) => kind === "reflection" && family === "Reflection").length;
  return nodes.filter(({ kind, family }) => (
    ["semantic", "episodic", "procedural"].includes(kind)
    && ["SemanticMemory", "EpisodicMemory", "ProceduralMemory"].includes(family)
  )).length;
}

function traceRoleCounts(trace, sourceKind) {
  const counts = { originEvidence: 0, reflectionCurrent: 0, retrieval: 0, semanticTransformation: 0 };
  const normalization = {
    "origin-evidence": "originEvidence",
    "reflection-current": "reflectionCurrent",
    retrieval: "retrieval",
    "semantic-transformation": "semanticTransformation",
  };
  for (const branch of trace.branches) for (const step of branch.steps) {
    const role = sourceKind === "native" ? normalization[step.role] : step.role;
    if (!(role in counts)) throw new TypeError("Active Trace contains an unregistered role.");
    counts[role] += 1;
  }
  return counts;
}

function differenceCount(evolution, sourceKind) {
  if (sourceKind === "mip") return evolution.differences.length;
  return intrinsicObjectValues(evolution.differences).reduce((sum, entries) => sum + entries.length, 0);
}

function projectContext(investigation) {
  validateCapturedInvestigation(investigation);
  const { state, transitionLog } = investigation;
  if (state.investigationIdentifier !== investigation.identifier
      || !SOURCE_KINDS.has(state.sourceKind)
      || !scalarBoolean(state.workspaceIdentifier)) throw new TypeError("Core-derived Investigation state binding is invalid.");
  if (state.sourceKind === "native") validateNativeFrames(state);
  if (state.sourceKind === "mip") {
    if (!state.package || state.package.manifest.workspaceIdentifier !== state.workspaceIdentifier
        || state.packageObservations !== state.package.observations) throw new TypeError("MIP-backed Investigation state binding is invalid.");
    const expectedIntegrity = computeMipIntegrity(state.package);
    if (canonicalize(expectedIntegrity) !== canonicalize(state.package.integrity)) throw new TypeError("Imported MIP integrity is invalid.");
  }
  const sourceObservations = state.sourceKind === "native" ? state.observationFrames : state.packageObservations;
  const observationItems = sourceObservations.map((entry, position) => fact(
    "observations",
    {
      identifier: state.sourceKind === "native" ? entry.snapshot.observationIdentifier : entry.identifier,
      position,
    },
    { sequence: entry.sequence },
  ));
  const observationBySourceId = new Map();
  sourceObservations.forEach((entry, index) => {
    const key = state.sourceKind === "native" ? entry.world.frame.identifier : entry.identifier;
    observationBySourceId.set(key, observationItems[index]);
  });
  const cardinalities = observationItems.flatMap((observation, position) => ARTIFACT_CLASSES.map((artifactClass) => fact(
    "artifactCardinalities",
    { artifactClass, observationFactIdentifier: observation.factIdentifier },
    {
      count: state.sourceKind === "native"
        ? nativeCardinality(sourceObservations[position], artifactClass)
        : sourceObservations[position].records.filter(({ role }) => role === artifactClass).length,
    },
  )));
  let traceItem;
  if (state.activeTrace) {
    const observationKey = state.sourceKind === "native" ? state.activeTrace.frameIdentifier : state.activeTrace.observationIdentifier;
    const observation = observationBySourceId.get(observationKey);
    if (!observation) throw new TypeError("Active Trace does not bind a retained observation.");
    const counts = traceRoleCounts(state.activeTrace, state.sourceKind);
    traceItem = fact("activeTrace", { identifier: state.activeTrace.identifier }, {
      branchCount: state.activeTrace.branches.length,
      observationFactIdentifier: observation.factIdentifier,
      roleCounts: counts,
      stepCount: intrinsicObjectValues(counts).reduce((sum, count) => sum + count, 0),
    });
  }
  let replayItem;
  if (state.activeReplay) {
    if (!traceItem || !state.replayState || state.replayState.replayIdentifier !== state.activeReplay.identifier) throw new TypeError("Active Replay state binding is invalid.");
    replayItem = fact("activeReplay", { identifier: state.activeReplay.identifier }, {
      observationFactIdentifier: traceItem.value.observationFactIdentifier,
      status: state.replayState.status,
      stepCount: state.activeReplay.steps.length,
      traceFactIdentifier: traceItem.factIdentifier,
    });
  }
  let evolutionItem;
  if (state.evolution) {
    const from = observationBySourceId.get(
      state.sourceKind === "native" ? state.evolution.from.frameIdentifier : state.evolution.fromObservationIdentifier,
    );
    const to = observationBySourceId.get(
      state.sourceKind === "native" ? state.evolution.to.frameIdentifier : state.evolution.toObservationIdentifier,
    );
    if (!from || !to) throw new TypeError("Active Evolution does not bind retained observations.");
    evolutionItem = fact("activeEvolution", { identifier: state.evolution.identifier }, {
      differenceCount: differenceCount(state.evolution, state.sourceKind),
      fromObservationFactIdentifier: from.factIdentifier,
      toObservationFactIdentifier: to.factIdentifier,
    });
  }
  let comparativeItem;
  if (state.comparativeReconstruction) {
    if (!evolutionItem || !state.comparativeReplayState
        || state.comparativeReplayState.reconstructionIdentifier !== state.comparativeReconstruction.identifier) throw new TypeError("Active Comparative Reconstruction state binding is invalid.");
    comparativeItem = fact("activeComparativeReconstruction", { identifier: state.comparativeReconstruction.identifier }, {
      divergenceCount: state.comparativeReconstruction.divergenceIndices.length,
      evolutionFactIdentifier: evolutionItem.factIdentifier,
      momentCount: state.comparativeReconstruction.moments.length,
      status: state.comparativeReplayState.status,
    });
  }
  const verificationItem = state.verificationSession
    ? fact("verification", { identifier: state.verificationSession.identifier }, {
      checks: state.verificationSession.checks.map(({ code, status }) => ({ code, status })),
      lifecycle: state.verificationSession.lifecycle,
      status: state.verificationSession.status,
      transitionLogDigest: state.verificationSession.transitionLogDigest,
    })
    : null;
  let mipIntegrity = { availability: "notApplicable" };
  if (state.sourceKind === "mip") {
    const packageValue = state.package;
    const recomputedIntegrity = computeMipIntegrity(packageValue);
    mipIntegrity = available([fact("mipIntegrity", { packageIdentifier: packageValue.manifest.packageIdentifier }, {
      features: {
        optional: [...packageValue.manifest.features.optional],
        required: [...packageValue.manifest.features.required],
      },
      formatVersion: packageValue.formatVersion,
      integrity: {
        cognitionDigest: recomputedIntegrity.cognitionDigest,
        packageDigest: recomputedIntegrity.packageDigest,
        profile: recomputedIntegrity.profile,
        sectionDigests: recomputedIntegrity.sectionDigests.map(({ digest: value, name }) => ({ digest: value, name })),
      },
      inventory: { ...packageValue.manifest.inventory },
      schemaIdentifier: packageValue.$schema,
      verification: {
        checks: packageValue.verification.checks.map(({ code, status }) => ({ code, status })),
        profile: packageValue.verification.profile,
        status: packageValue.verification.status,
      },
    })]);
  }
  return {
    factModelVersion: POLICY_FACT_MODEL_VERSION,
    facts: {
      lifecycle: available([fact("lifecycle", {}, { state: state.lifecycle })]),
      transitions: available(transitionLog.transitions.map((entry) => fact(
        "transitions", { identifier: entry.identifier }, { index: entry.index, kind: entry.kind },
      ))),
      observations: available(observationItems),
      artifactCardinalities: available(cardinalities),
      activeTrace: available(traceItem ? [traceItem] : []),
      activeReplay: available(replayItem ? [replayItem] : []),
      activeEvolution: available(evolutionItem ? [evolutionItem] : []),
      activeComparativeReconstruction: available(comparativeItem ? [comparativeItem] : []),
      verification: available(verificationItem ? [verificationItem] : []),
      mipIntegrity,
      compatibility: available(COMPATIBILITY[state.sourceKind].map(([name, value]) => fact(
        "compatibility", { name }, { value },
      ))),
    },
    investigation: {
      identifier: investigation.identifier,
      sourceKind: state.sourceKind,
      workspaceIdentifier: state.workspaceIdentifier,
    },
    kind: POLICY_FACT_CONTEXT_KIND,
    transitionLog: {
      coreVersion: INVESTIGATION_CORE_VERSION,
      headTransitionIdentifier: transitionLog.transitions.at(-1).identifier,
      transitionCount: transitionLog.transitions.length,
      transitionLogDigest: transitionLog.digest,
    },
    version: POLICY_FACT_CONTEXT_VERSION,
  };
}

export function projectPolicyFactContext(investigation) {
  try {
    return prepared(projectContext(investigation));
  } catch (error) {
    if (error instanceof MemoryOSPolicyError && error.code === "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED") throw error;
    fail("POLICY_FACT_CONTEXT_SOURCE_STATE_INVALID", "Investigation state cannot produce a complete PolicyFactContext.", {
      sourceCode: typeof error?.code === "string" ? error.code : undefined,
    });
  }
}

export function capturePolicyFactContext(core, identifier) {
  assertExactCore(core);
  let investigation;
  try {
    investigation = captureInvestigationCoreStateForPolicy(core, identifier);
  } catch (error) {
    fail("POLICY_FACT_CONTEXT_ATOMIC_CAPTURE_FAILED", "Investigation Core could not atomically capture one committed state.", {
      sourceCode: typeof error?.code === "string" ? error.code : undefined,
    });
  }
  const result = projectPolicyFactContext(investigation);
  privateSet(authoritativeOwners, result, core);
  return result;
}

export function assertAuthoritativePolicyFactContext(context, ownerCore) {
  assertExactCore(ownerCore);
  if (!privateHas(preparedData, context) || privateGet(authoritativeOwners, context) !== ownerCore) {
    fail("POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED", "PolicyFactContext is not an adapter-minted capability for this Investigation Core owner.");
  }
  return true;
}

export function capturePolicyFactContextAndRegressionSource(
  core,
  baselineIdentifier,
  candidateIdentifier,
) {
  if (core === null || typeof core !== "object"
      || intrinsicObjectGetPrototypeOf(core) !== InvestigationCore.prototype) {
    sourceFail(
      "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
      "Trusted Regression capture requires an exact released InvestigationCore owner.",
    );
  }
  let baseline;
  let candidate;
  try {
    baseline = captureInvestigationCoreStateForPolicy(core, baselineIdentifier);
    candidate = captureInvestigationCoreStateForPolicy(core, candidateIdentifier);
  } catch (error) {
    sourceFail(
      "REGRESSION_POLICY_FACT_SOURCE_ATOMIC_CAPTURE_FAILED",
      "Investigation Core could not atomically capture the Regression pair.",
      { sourceCode: typeof error?.code === "string" ? error.code : undefined },
    );
  }

  let context;
  try {
    context = prepared(projectContext(candidate));
  } catch (error) {
    if (error instanceof MemoryOSPolicyError
        && error.code === "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED") throw error;
    fail(
      "POLICY_FACT_CONTEXT_SOURCE_STATE_INVALID",
      "Candidate state cannot produce a complete PolicyFactContext.",
      { sourceCode: typeof error?.code === "string" ? error.code : undefined },
    );
  }

  if (baseline.version !== INVESTIGATION_CORE_VERSION
      || baseline.transitionLog.version !== INVESTIGATION_CORE_VERSION
      || baseline.state.version !== INVESTIGATION_CORE_VERSION) {
    sourceFail(
      "REGRESSION_POLICY_FACT_SOURCE_BASELINE_BINDING_INVALID",
      "Baseline state does not bind the supported Core version.",
    );
  }
  if (candidate.version !== context.artifact.transitionLog.coreVersion
      || candidate.transitionLog.version !== context.artifact.transitionLog.coreVersion
      || candidate.state.version !== context.artifact.transitionLog.coreVersion
      || candidate.identifier !== context.artifact.investigation.identifier
      || candidate.transitionLog.digest !== context.artifact.transitionLog.transitionLogDigest) {
    sourceFail(
      "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH",
      "Candidate state does not bind the captured PolicyFactContext.",
    );
  }
  if (baseline.state.workspaceIdentifier !== candidate.state.workspaceIdentifier
      || baseline.state.sourceKind !== candidate.state.sourceKind) {
    sourceFail(
      "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH",
      "Baseline and candidate must share one Workspace and source kind.",
    );
  }

  let report;
  try {
    report = compareCognitiveRegression(baseline, candidate);
  } catch (error) {
    sourceFail(
      "REGRESSION_REPORT_INVALID",
      "The released Regression construction did not produce a valid report.",
      { sourceCode: typeof error?.code === "string" ? error.code : undefined },
    );
  }
  if (report.version !== COGNITIVE_REGRESSION_VERSION) {
    sourceFail("REGRESSION_REPORT_VERSION_UNSUPPORTED", "Regression report version is unsupported.");
  }

  const sourceArtifact = projectRegressionPolicyFactSource(
    report,
    baseline,
    candidate,
    context.contextDigest,
  );
  const source = prepareRegressionPolicyFactSourceValue(sourceArtifact);

  // Authority is published only after both complete artifacts, their digests,
  // and every cross-binding have succeeded.
  privateSet(authoritativeOwners, context, core);
  privateSet(authoritativeRegressionOwners, source, intrinsicObjectFreeze({
    baseline,
    candidate,
    context,
    core,
    report,
  }));
  return intrinsicObjectFreeze({
    policyFactContext: context,
    regressionPolicyFactSource: source,
  });
}

export function assertAuthoritativeRegressionPolicyFactSource(source, ownerCore, candidateContext) {
  if (ownerCore === null || typeof ownerCore !== "object"
      || intrinsicObjectGetPrototypeOf(ownerCore) !== InvestigationCore.prototype) {
    sourceFail(
      "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
      "Regression source owner is not an exact released InvestigationCore.",
    );
  }
  const receipt = privateGet(authoritativeRegressionOwners, source);
  if (!receipt || receipt.core !== ownerCore) {
    sourceFail(
      "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
      "Regression source is not a trusted capability for this owner.",
    );
  }
  if (receipt.context !== candidateContext) {
    sourceFail(
      "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH",
      "Regression source is not bound to the supplied candidate context capability.",
    );
  }
  assertAuthoritativePolicyFactContext(candidateContext, ownerCore);
  const { artifact } = source;
  if (artifact.binding.baseline.coreVersion !== receipt.baseline.version
      || artifact.binding.baseline.investigationIdentifier !== receipt.baseline.identifier
      || artifact.binding.baseline.transitionLogDigest !== receipt.baseline.transitionLog.digest
      || artifact.binding.baseline.workspaceIdentifier !== receipt.baseline.state.workspaceIdentifier
      || artifact.binding.baseline.sourceKind !== receipt.baseline.state.sourceKind) {
    sourceFail(
      "REGRESSION_POLICY_FACT_SOURCE_BASELINE_BINDING_INVALID",
      "Regression source no longer agrees with retained baseline provenance.",
    );
  }
  if (artifact.binding.candidate.coreVersion !== receipt.candidate.version
      || artifact.binding.candidate.investigationIdentifier !== receipt.candidate.identifier
      || artifact.binding.candidate.policyFactContextDigest !== candidateContext.contextDigest
      || artifact.binding.candidate.transitionLogDigest !== receipt.candidate.transitionLog.digest
      || artifact.binding.candidate.workspaceIdentifier !== receipt.candidate.state.workspaceIdentifier
      || artifact.binding.candidate.sourceKind !== receipt.candidate.state.sourceKind) {
    sourceFail(
      "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH",
      "Regression source no longer agrees with retained candidate provenance.",
    );
  }
  if (receipt.baseline.state.sourceKind === "mip"
      && artifact.binding.baseline.sourceIdentifier
        !== receipt.baseline.state.package.manifest.packageIdentifier) {
    sourceFail(
      "REGRESSION_POLICY_FACT_SOURCE_BASELINE_BINDING_INVALID",
      "Regression source MIP baseline identifier is invalid.",
    );
  }
  if (receipt.candidate.state.sourceKind === "mip"
      && artifact.binding.candidate.sourceIdentifier
        !== receipt.candidate.state.package.manifest.packageIdentifier) {
    sourceFail(
      "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH",
      "Regression source MIP candidate identifier is invalid.",
    );
  }
  return true;
}

export function normalizeAuthoritativeDeterministicFactSources(
  sources,
  ownerCore,
  candidateContext,
) {
  assertAuthoritativePolicyFactContext(candidateContext, ownerCore);
  const normalized = normalizeDeterministicFactSources(sources);
  for (let index = 0; index < normalized.length; index += 1) {
    assertAuthoritativeRegressionPolicyFactSource(normalized[index], ownerCore, candidateContext);
  }
  return normalized;
}
