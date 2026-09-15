import {
  canonicalize, mipDigest, sha256Hex, utf8Encode as mipUtf8Encode,
} from "./mip-canonical.js";
import { INVESTIGATION_CORE_VERSION } from "./investigation-core.js";
import {
  MEMORYOS_POLICY_RESOURCE_PROFILE, REGISTERED_REGRESSION_CATEGORIES,
} from "./investigation-policy-contracts.js";
import {
  MemoryOSPolicyError, canonicalizeRestrictedJson, domainSeparatedDigest,
  inspectByteInput, isStableSemVer, isUnicodeScalarString, jsonCensus,
  parseRestrictedJson,
} from "./policy-canonical.js";

const intrinsicObjectDefineProperties = Object.defineProperties;
const intrinsicObjectFreeze = Object.freeze;
const intrinsicObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicObjectGetPrototypeOf = Object.getPrototypeOf;
const intrinsicObjectHasOwn = Object.hasOwn;
const intrinsicObjectKeys = Object.keys;
const intrinsicObjectValues = Object.values;
const intrinsicArrayIsArray = Array.isArray;
const intrinsicArrayPrototype = Array.prototype;
const IntrinsicMap = Map;
const intrinsicMapGet = Map.prototype.get;
const intrinsicMapSet = Map.prototype.set;
const intrinsicNumberIsSafeInteger = Number.isSafeInteger;
const IntrinsicSet = Set;
const intrinsicSetAdd = Set.prototype.add;
const intrinsicSetHas = Set.prototype.has;
const intrinsicArraySort = Array.prototype.sort;
const intrinsicRegExpExec = RegExp.prototype.exec;
const IntrinsicString = String;
const intrinsicStringCharCodeAt = String.prototype.charCodeAt;
const intrinsicStringSlice = String.prototype.slice;
const intrinsicMathMin = Math.min;
const intrinsicReflectApply = Reflect.apply;
const intrinsicReflectOwnKeys = Reflect.ownKeys;
const IntrinsicUint8Array = Uint8Array;
const IntrinsicTypeError = TypeError;
const intrinsicTypedArrayPrototype = intrinsicObjectGetPrototypeOf(Uint8Array.prototype);
const intrinsicTypedArrayByteLengthGetter = intrinsicObjectGetOwnPropertyDescriptor(
  intrinsicTypedArrayPrototype,
  "byteLength",
).get;
const intrinsicUint8ArraySet = Uint8Array.prototype.set;

export const REGRESSION_POLICY_FACT_SOURCE_KIND = "MemoryOSRegressionPolicyFactSource";
export const REGRESSION_POLICY_FACT_SOURCE_VERSION = "1.0.0";
export const REGRESSION_POLICY_FACT_SOURCE_DOMAIN = "cognitiveRegression";
export const REGRESSION_POLICY_FACT_SOURCE_MODEL_VERSION = "1.0.0";
export const REGRESSION_POLICY_FACT_SOURCE_MODEL_DIGEST =
  "sha256:e7d1fdf24758f2a0ac9ad609df578f95c058bf3cbab9f02a650f9cc12dab1c0d";
export const REGRESSION_POLICY_FACT_SOURCE_SCHEMA_IDENTIFIER =
  "MEMORYOS-REGRESSION-POLICY-FACT-SOURCE-SCHEMA-1.0";
export const REGRESSION_POLICY_FACT_SOURCE_DIGEST_DOMAIN =
  "MEMORYOS-REGRESSION-POLICY-FACT-SOURCE-1.0";
export const REGRESSION_POLICY_FACT_IDENTIFIER_DOMAIN =
  "MEMORYOS-REGRESSION-POLICY-FACT-IDENTIFIER-1.0";
export const REGRESSION_SUBJECT_DIGEST_DOMAIN =
  "MEMORYOS-COGNITIVE-REGRESSION-SUBJECT-1.0";
export const DETERMINISTIC_FACT_SOURCE_REGISTRY_VERSION = "1.0.0";
export const DETERMINISTIC_FACT_SOURCE_REGISTRY_DIGEST =
  "sha256:392d688acb866753c6ff85b7030131b38990b27d8a2a0ef6e8e052c8c4e048de";

const REPORT_KIND = "MemoryOSCognitiveRegressionReport";
const REPORT_VERSION = "1.0.0";
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const REPORT_ID = /^regression:[0-9a-f]{64}$/u;
const DOMAIN = /^[a-z][A-Za-z0-9]{0,63}$/u;
const FACT_DOMAINS = new IntrinsicSet(["summary", "categories", "findings"]);
const CATEGORIES = new IntrinsicSet(REGISTERED_REGRESSION_CATEGORIES);
const CATEGORY_INDEX = new IntrinsicMap();
for (let index = 0; index < REGISTERED_REGRESSION_CATEGORIES.length; index += 1) {
  intrinsicReflectApply(intrinsicMapSet, CATEGORY_INDEX, [
    REGISTERED_REGRESSION_CATEGORIES[index], index,
  ]);
}
const STATUSES = new IntrinsicSet(["identical", "changed"]);
const CHANGES = new IntrinsicSet(["added", "removed", "modified"]);
const OVERALL = new IntrinsicSet(["identical", "regressionDetected"]);
const LIMITS = MEMORYOS_POLICY_RESOURCE_PROFILE.limits;
const prepared = new WeakMap();
const PREPARED_SOURCE_TOKEN = Symbol("MemoryOS prepared Regression policy fact source");
const weakMapGet = WeakMap.prototype.get;
const weakMapHas = WeakMap.prototype.has;
const weakMapSet = WeakMap.prototype.set;

function privateGet(map, key) { return intrinsicReflectApply(weakMapGet, map, [key]); }
function privateHas(map, key) { return intrinsicReflectApply(weakMapHas, map, [key]); }
function privateSet(map, key, value) { intrinsicReflectApply(weakMapSet, map, [key, value]); }
function copyBytes(value) {
  const byteLength = intrinsicReflectApply(intrinsicTypedArrayByteLengthGetter, value, []);
  const result = new IntrinsicUint8Array(byteLength);
  intrinsicReflectApply(intrinsicUint8ArraySet, result, [value, 0]);
  return result;
}

function byteLength(value) {
  return intrinsicReflectApply(intrinsicTypedArrayByteLengthGetter, value, []);
}

function freeze(value, seen = new IntrinsicSet()) {
  if (value === null || typeof value !== "object"
      || intrinsicReflectApply(intrinsicSetHas, seen, [value])) return value;
  intrinsicReflectApply(intrinsicSetAdd, seen, [value]);
  const children = intrinsicObjectValues(value);
  for (let index = 0; index < children.length; index += 1) freeze(children[index], seen);
  return intrinsicObjectFreeze(value);
}

function detachedRestrictedJson(value, code, message) {
  try {
    return parseRestrictedJson(canonicalizeRestrictedJson(value));
  } catch {
    fail(code, message);
  }
}

function object(value) {
  return value !== null && typeof value === "object" && !intrinsicArrayIsArray(value);
}
function keys(value, expected) {
  if (!object(value) || intrinsicObjectKeys(value).length !== expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (!intrinsicObjectHasOwn(value, expected[index])) return false;
  }
  return true;
}
function dense(value) {
  if (!intrinsicArrayIsArray(value) || intrinsicObjectKeys(value).length !== value.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!intrinsicObjectHasOwn(value, index)) return false;
  }
  return true;
}
function identity(value) { return isUnicodeScalarString(value) && value.length > 0; }
function count(value) { return intrinsicNumberIsSafeInteger(value) && value >= 0; }

function matches(pattern, value) {
  return intrinsicReflectApply(intrinsicRegExpExec, pattern, [value]) !== null;
}

function member(set, value) {
  return intrinsicReflectApply(intrinsicSetHas, set, [value]);
}

function mapValue(map, key) {
  return intrinsicReflectApply(intrinsicMapGet, map, [key]);
}

function setMapValue(map, key, value) {
  intrinsicReflectApply(intrinsicMapSet, map, [key, value]);
}

function sourceKind(value) { return value === "native" || value === "mip"; }

function fail(code, message, details = {}) {
  throw new MemoryOSPolicyError(code, message, {
    artifactKind: REGRESSION_POLICY_FACT_SOURCE_KIND,
    phase: "deterministicFactSource",
    ...details,
  });
}
function reportFail(code, message) {
  throw new MemoryOSPolicyError(code, message, {
    artifactKind: REPORT_KIND, phase: "deterministicFactSource",
  });
}
function limit(identifier, observed, phase) {
  const configuredLimit = LIMITS[identifier];
  if (observed <= configuredLimit) return;
  fail("POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED", `Source exceeds ${identifier}.`, {
    configuredLimit, enforcementPhase: phase, limitIdentifier: identifier,
    observedAtLeast: configuredLimit + 1,
  });
}
function jsonLimits(value) {
  let census;
  try { census = jsonCensus(value); } catch {
    fail("DETERMINISTIC_FACT_SOURCE_SCHEMA_INVALID", "Source is outside restricted JSON.");
  }
  limit("json.nesting-depth", census.maximumDepth, "C");
  limit("json.value-count", census.valueCount, "C");
  limit("json.string-utf8-bytes", census.maximumStringUtf8Bytes, "C");
}
function schema(message) { fail("REGRESSION_POLICY_FACT_SOURCE_SCHEMA_INVALID", message); }
function incomplete(message) { fail("REGRESSION_POLICY_FACT_SOURCE_INCOMPLETE", message); }

function common(source) {
  if (!object(source)) fail("DETERMINISTIC_FACT_SOURCE_SCHEMA_INVALID", "Source must be an object.");
  const required = ["kind", "version", "domain", "sourceModelVersion", "binding", "facts"];
  for (let index = 0; index < required.length; index += 1) {
    if (!intrinsicObjectHasOwn(source, required[index])) {
      fail("DETERMINISTIC_FACT_SOURCE_SCHEMA_INVALID", "Common source envelope is incomplete.");
    }
  }
  if (!identity(source.kind) || !identity(source.domain) || !matches(DOMAIN, source.domain)
      || typeof source.version !== "string" || !isStableSemVer(source.version)
      || typeof source.sourceModelVersion !== "string" || !isStableSemVer(source.sourceModelVersion)
      || !object(source.binding) || !object(source.facts)) {
    fail("DETERMINISTIC_FACT_SOURCE_SCHEMA_INVALID", "Common source envelope is malformed.");
  }
  if (source.domain !== REGRESSION_POLICY_FACT_SOURCE_DOMAIN) {
    fail("DETERMINISTIC_FACT_SOURCE_DOMAIN_UNSUPPORTED", "Source domain is unsupported.");
  }
  if (source.version !== REGRESSION_POLICY_FACT_SOURCE_VERSION) {
    fail("DETERMINISTIC_FACT_SOURCE_VERSION_UNSUPPORTED", "Source version is unsupported.");
  }
  if (source.sourceModelVersion !== REGRESSION_POLICY_FACT_SOURCE_MODEL_VERSION) {
    fail("DETERMINISTIC_FACT_SOURCE_MODEL_VERSION_UNSUPPORTED", "Source model version is unsupported.");
  }
}

function binding(value, role) {
  const candidate = role === "candidate";
  if (!object(value) || !sourceKind(value.sourceKind)) {
    schema(`${role} binding is malformed.`);
  }
  const required = value.sourceKind === "native"
    ? candidate
      ? ["coreVersion", "investigationIdentifier", "policyFactContextDigest", "sourceKind", "transitionLogDigest", "workspaceIdentifier"]
      : ["coreVersion", "investigationIdentifier", "sourceKind", "transitionLogDigest", "workspaceIdentifier"]
    : candidate
      ? ["coreVersion", "investigationIdentifier", "policyFactContextDigest", "sourceIdentifier", "sourceKind", "transitionLogDigest", "workspaceIdentifier"]
      : ["coreVersion", "investigationIdentifier", "sourceIdentifier", "sourceKind", "transitionLogDigest", "workspaceIdentifier"];
  if (!keys(value, required) || value.coreVersion !== INVESTIGATION_CORE_VERSION
      || !identity(value.investigationIdentifier) || !identity(value.workspaceIdentifier)
      || !matches(DIGEST, value.transitionLogDigest)
      || (candidate && !matches(DIGEST, value.policyFactContextDigest))
      || (value.sourceKind === "mip" && !identity(value.sourceIdentifier))) {
    schema(`${role} binding violates the frozen discriminated union.`);
  }
}

function findingShape(fact) {
  if (!keys(fact, ["factIdentifier", "subject", "value"])
      || !matches(DIGEST, fact.factIdentifier)
      || !keys(fact.subject, ["category", "subjectDigest"])
      || !member(CATEGORIES, fact.subject.category)
      || !matches(DIGEST, fact.subject.subjectDigest)
      || !keys(fact.value, ["afterDigest", "beforeDigest", "change"])
      || !member(CHANGES, fact.value.change)) schema("Finding fact is malformed.");
  const { afterDigest, beforeDigest, change } = fact.value;
  const valid = change === "added" ? beforeDigest === null && matches(DIGEST, afterDigest)
    : change === "removed" ? matches(DIGEST, beforeDigest) && afterDigest === null
      : matches(DIGEST, beforeDigest) && matches(DIGEST, afterDigest)
        && beforeDigest !== afterDigest;
  if (!valid) schema("Finding digests do not match the change kind.");
}

function sourceShape(source) {
  if (!keys(source, ["binding", "domain", "facts", "kind", "sourceModelVersion", "version"])
      || source.kind !== REGRESSION_POLICY_FACT_SOURCE_KIND) schema("Source root is not closed.");
  if (!keys(source.binding, ["baseline", "candidate", "report"])) schema("Binding is not closed.");
  binding(source.binding.baseline, "baseline");
  binding(source.binding.candidate, "candidate");
  const tuple = source.binding.report;
  if (!keys(tuple, ["identifier", "kind", "version"]) || tuple.kind !== REPORT_KIND
      || !matches(REPORT_ID, tuple.identifier) || typeof tuple.version !== "string"
      || !isStableSemVer(tuple.version)) schema("Report identity tuple is malformed.");
  if (source.binding.baseline.sourceKind !== source.binding.candidate.sourceKind
      || source.binding.baseline.workspaceIdentifier !== source.binding.candidate.workspaceIdentifier) {
    schema("Baseline and candidate binding disagree.");
  }
  const facts = source.facts;
  if (!keys(facts, ["categories", "findings", "summary"])
      || !dense(facts.categories) || !dense(facts.findings)) schema("Fact inventory is malformed.");
  if (!keys(facts.summary, ["factIdentifier", "subject", "value"])
      || !matches(DIGEST, facts.summary.factIdentifier)
      || !keys(facts.summary.subject, [])
      || !keys(facts.summary.value, ["findingCount", "overall"])
      || !count(facts.summary.value.findingCount)
      || !member(OVERALL, facts.summary.value.overall)) {
    schema("Summary fact is malformed.");
  }
  for (let index = 0; index < facts.categories.length; index += 1) {
    const fact = facts.categories[index];
    if (!keys(fact, ["factIdentifier", "subject", "value"])
        || !matches(DIGEST, fact.factIdentifier)
        || !keys(fact.subject, ["category"]) || !member(CATEGORIES, fact.subject.category)
        || !keys(fact.value, ["findingCount", "status"])
        || !count(fact.value.findingCount) || !member(STATUSES, fact.value.status)) {
      schema("Category fact is malformed.");
    }
  }
  for (let index = 0; index < facts.findings.length; index += 1) {
    findingShape(facts.findings[index]);
  }
}

export function regressionPolicyFactIdentifier(factDomain, subject) {
  if (!member(FACT_DOMAINS, factDomain) || !object(subject)) {
    throw new IntrinsicTypeError("Invalid Regression fact subject.");
  }
  return domainSeparatedDigest(REGRESSION_POLICY_FACT_IDENTIFIER_DOMAIN, canonicalizeRestrictedJson({
    domain: REGRESSION_POLICY_FACT_SOURCE_DOMAIN, factDomain,
    sourceModelVersion: REGRESSION_POLICY_FACT_SOURCE_MODEL_VERSION, subject,
  }));
}

function concatenate(parts) {
  let length = 0;
  for (let index = 0; index < parts.length; index += 1) {
    length += byteLength(parts[index]);
  }
  const result = new IntrinsicUint8Array(length);
  let offset = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    intrinsicReflectApply(intrinsicUint8ArraySet, result, [part, offset]);
    offset += byteLength(part);
  }
  return result;
}

export function regressionSubjectDigest(category, subject) {
  if (!member(CATEGORIES, category) || !object(subject)) {
    throw new IntrinsicTypeError("Invalid Regression subject.");
  }
  const separator = new IntrinsicUint8Array(1);
  return `sha256:${sha256Hex(concatenate([
    mipUtf8Encode(REGRESSION_SUBJECT_DIGEST_DOMAIN), separator,
    mipUtf8Encode(category), separator, mipUtf8Encode(canonicalize(subject)),
  ]))}`;
}

function completeness(source) {
  const { categories, findings, summary } = source.facts;
  if (categories.length !== REGISTERED_REGRESSION_CATEGORIES.length) incomplete("Category inventory is incomplete.");
  for (let index = 0; index < categories.length; index += 1) {
    const fact = categories[index];
    if (fact.subject.category !== REGISTERED_REGRESSION_CATEGORIES[index]) incomplete("Category order is invalid.");
  }
  const identifiers = new IntrinsicSet();
  const retainIdentifier = (fact) => {
    if (!matches(DIGEST, fact.factIdentifier)
        || intrinsicReflectApply(intrinsicSetHas, identifiers, [fact.factIdentifier])) {
      incomplete("Fact identifier is invalid.");
    }
    intrinsicReflectApply(intrinsicSetAdd, identifiers, [fact.factIdentifier]);
  };
  retainIdentifier(summary);
  for (let index = 0; index < categories.length; index += 1) retainIdentifier(categories[index]);
  for (let index = 0; index < findings.length; index += 1) retainIdentifier(findings[index]);
  if (summary.factIdentifier !== regressionPolicyFactIdentifier("summary", summary.subject)) incomplete("Summary ID is invalid.");
  for (let index = 0; index < categories.length; index += 1) {
    const fact = categories[index];
    if (fact.factIdentifier !== regressionPolicyFactIdentifier("categories", fact.subject)) incomplete("Category ID is invalid.");
  }
  const counts = new IntrinsicMap();
  for (let index = 0; index < REGISTERED_REGRESSION_CATEGORIES.length; index += 1) {
    setMapValue(counts, REGISTERED_REGRESSION_CATEGORIES[index], 0);
  }
  let previous = -1;
  for (let findingIndex = 0; findingIndex < findings.length; findingIndex += 1) {
    const fact = findings[findingIndex];
    const categoryIndex = mapValue(CATEGORY_INDEX, fact.subject.category);
    if (categoryIndex < previous) incomplete("Finding category order is invalid.");
    previous = categoryIndex;
    setMapValue(counts, fact.subject.category, mapValue(counts, fact.subject.category) + 1);
    if (fact.factIdentifier !== regressionPolicyFactIdentifier("findings", fact.subject)) incomplete("Finding ID is invalid.");
  }
  let total = 0;
  for (let index = 0; index < categories.length; index += 1) {
    const fact = categories[index];
    const observed = mapValue(counts, fact.subject.category); total += observed;
    if (fact.value.findingCount !== observed
        || fact.value.status !== (observed === 0 ? "identical" : "changed")) incomplete("Category is inconsistent.");
  }
  if (summary.value.findingCount !== findings.length || summary.value.findingCount !== total
      || summary.value.overall !== (total === 0 ? "identical" : "regressionDetected")) incomplete("Summary is inconsistent.");
}

class PreparedSource {
  constructor(token, record) {
    if (token !== PREPARED_SOURCE_TOKEN) {
      throw new IntrinsicTypeError("Prepared source capabilities cannot be constructed by callers.");
    }
    const retained = { ...record, canonical: copyBytes(record.canonical) };
    privateSet(prepared, this, retained);
    intrinsicObjectDefineProperties(this, {
      artifact: { enumerable: true, value: retained.artifact },
      canonicalByteLength: { enumerable: true, value: byteLength(retained.canonical) },
      domain: { enumerable: true, value: REGRESSION_POLICY_FACT_SOURCE_DOMAIN },
      sourceDigest: { enumerable: true, value: retained.sourceDigest },
    });
    intrinsicObjectFreeze(this);
  }
  canonicalBytes() { return copyBytes(privateGet(prepared, this).canonical); }
}
intrinsicObjectFreeze(PreparedSource.prototype);
export function isPreparedRegressionPolicyFactSource(value) { return privateHas(prepared, value); }

function expected(options) {
  if (options === undefined) return null;
  if (!object(options)) throw new IntrinsicTypeError("Invalid options.");
  const optionKeys = intrinsicObjectKeys(options);
  for (let index = 0; index < optionKeys.length; index += 1) {
    if (optionKeys[index] !== "expectedSourceDigest") {
      throw new IntrinsicTypeError("Invalid options.");
    }
  }
  const value = options.expectedSourceDigest ?? null;
  if (value !== null && !matches(DIGEST, value)) {
    throw new IntrinsicTypeError("Invalid expected source digest.");
  }
  return value;
}

function prepareValue(value, options) {
  const expectedDigest = expected(options);
  const source = freeze(detachedRestrictedJson(
    value,
    "DETERMINISTIC_FACT_SOURCE_SCHEMA_INVALID",
    "Source is outside restricted JSON.",
  ));
  jsonLimits(source); common(source); sourceShape(source);
  if (source.binding.report.version !== REPORT_VERSION) fail("REGRESSION_REPORT_VERSION_UNSUPPORTED", "Report version is unsupported.");
  limit("regression-policy-fact-source.finding-count", source.facts.findings.length, "E");
  completeness(source);
  const canonical = canonicalizeRestrictedJson(source);
  limit("regression-policy-fact-source.canonical-document-bytes", byteLength(canonical), "F");
  const sourceDigest = domainSeparatedDigest(REGRESSION_POLICY_FACT_SOURCE_DIGEST_DOMAIN, canonical);
  if (expectedDigest !== null && expectedDigest !== sourceDigest) fail("REGRESSION_POLICY_FACT_SOURCE_DIGEST_MISMATCH", "Source digest mismatch.");
  return new PreparedSource(PREPARED_SOURCE_TOKEN, { artifact: source, canonical, sourceDigest });
}
export function prepareRegressionPolicyFactSourceValue(value, options) { return prepareValue(value, options); }

export function prepareRegressionPolicyFactSource(bytesLike, options) {
  let input;
  try {
    input = inspectByteInput(bytesLike, "Regression policy fact-source bytes");
  } catch {
    fail("DETERMINISTIC_FACT_SOURCE_SYNTAX_INVALID", "Source input is not an immutable byte snapshot.", { enforcementPhase: "A" });
  }
  limit("regression-policy-fact-source.raw-document-bytes", input.byteLength, "A");
  let source;
  try { source = parseRestrictedJson(input.snapshot()); } catch {
    fail("DETERMINISTIC_FACT_SOURCE_SYNTAX_INVALID", "Source is not restricted JSON.", { enforcementPhase: "B" });
  }
  return prepareValue(source, options);
}

export function validateRegressionPolicyFactSource(value, options) {
  prepareValue(value, options);
  return true;
}

export function regressionPolicyFactSourceCanonicalBytes(value) {
  if (privateHas(prepared, value)) return copyBytes(privateGet(prepared, value).canonical);
  return prepareValue(value).canonicalBytes();
}

export function regressionPolicyFactSourceDigest(value) {
  if (privateHas(prepared, value)) return privateGet(prepared, value).sourceDigest;
  return prepareValue(value).sourceDigest;
}

function reportProjection(report) {
  return { baseline: report.baseline, candidate: report.candidate, categories: report.categories,
    overall: report.overall, regressionDetected: report.regressionDetected };
}
export function cognitiveRegressionReportIdentifier(report) {
  if (!object(report)) throw new IntrinsicTypeError("A Cognitive Regression report is required.");
  const digest = mipDigest(
    "INVESTIGATION-CORE-REGRESSION-1.0",
    canonicalize(reportProjection(report)),
  );
  return `regression:${intrinsicReflectApply(intrinsicStringSlice, digest, [7])}`;
}
function reportDescriptor(value) {
  return keys(value, ["sourceIdentifier", "sourceKind", "workspaceIdentifier"])
    && identity(value.sourceIdentifier) && sourceKind(value.sourceKind)
    && identity(value.workspaceIdentifier);
}

function reportShape(report) {
  if (!keys(report, ["baseline", "candidate", "categories", "identifier", "kind", "overall", "regressionDetected", "version"])
      || report.kind !== REPORT_KIND || typeof report.version !== "string" || !isStableSemVer(report.version)
      || !matches(REPORT_ID, report.identifier)
      || !reportDescriptor(report.baseline) || !reportDescriptor(report.candidate)
      || report.baseline.sourceKind !== report.candidate.sourceKind
      || report.baseline.workspaceIdentifier !== report.candidate.workspaceIdentifier
      || !dense(report.categories) || report.categories.length !== REGISTERED_REGRESSION_CATEGORIES.length
      || typeof report.regressionDetected !== "boolean" || !member(OVERALL, report.overall)) {
    reportFail("REGRESSION_REPORT_INVALID", "Report is malformed.");
  }
  let detected = false;
  for (let index = 0; index < report.categories.length; index += 1) {
    const entry = report.categories[index];
    if (!keys(entry, ["category", "differences", "status"])
        || entry.category !== REGISTERED_REGRESSION_CATEGORIES[index]
        || !member(STATUSES, entry.status)
        || !dense(entry.differences) || entry.status !== (entry.differences.length ? "changed" : "identical")) {
      reportFail("REGRESSION_REPORT_INVALID", "Report category is malformed.");
    }
    detected ||= entry.status === "changed";
    let previous = null;
    for (let differenceIndex = 0; differenceIndex < entry.differences.length; differenceIndex += 1) {
      const difference = entry.differences[differenceIndex];
      if (!keys(difference, ["afterDigest", "beforeDigest", "change", "subject"])
          || !member(CHANGES, difference.change) || !object(difference.subject)) {
        reportFail("REGRESSION_REPORT_INVALID", "Difference is malformed.");
      }
      const { afterDigest, beforeDigest, change } = difference;
      const valid = change === "added" ? beforeDigest === null && matches(DIGEST, afterDigest)
        : change === "removed" ? matches(DIGEST, beforeDigest) && afterDigest === null
          : matches(DIGEST, beforeDigest) && matches(DIGEST, afterDigest)
            && beforeDigest !== afterDigest;
      if (!valid) reportFail("REGRESSION_REPORT_INVALID", "Difference digests are malformed.");
      let subject;
      try { subject = canonicalize(difference.subject); } catch { reportFail("REGRESSION_REPORT_INVALID", "Difference subject is invalid."); }
      if (previous !== null && previous >= subject) reportFail("REGRESSION_REPORT_INVALID", "Difference order is invalid.");
      previous = subject;
    }
  }
  if (report.regressionDetected !== detected || report.overall !== (detected ? "regressionDetected" : "identical")) {
    reportFail("REGRESSION_REPORT_INVALID", "Report overall status is inconsistent.");
  }
}

export function inspectDetachedCognitiveRegressionReport(value) {
  let report;
  try {
    report = freeze(parseRestrictedJson(canonicalizeRestrictedJson(value)));
  } catch {
    reportFail("REGRESSION_REPORT_INVALID", "Report is outside restricted JSON.");
  }
  if (!object(report) || typeof report.version !== "string" || !isStableSemVer(report.version)) {
    reportFail("REGRESSION_REPORT_INVALID", "Report version is malformed.");
  }
  if (report.version !== REPORT_VERSION) {
    reportFail("REGRESSION_REPORT_VERSION_UNSUPPORTED", "Report version is unsupported.");
  }
  reportShape(report);
  let identifier;
  try { identifier = cognitiveRegressionReportIdentifier(report); } catch { reportFail("REGRESSION_REPORT_INVALID", "Report is not canonicalizable."); }
  if (identifier !== report.identifier) reportFail("REGRESSION_REPORT_IDENTITY_MISMATCH", "Report identity mismatch.");
  return report;
}
export function parseDetachedCognitiveRegressionReport(bytesLike) {
  let input;
  try {
    input = inspectByteInput(bytesLike, "Cognitive Regression report bytes");
  } catch {
    reportFail("REGRESSION_REPORT_INVALID", "Report input is not an immutable byte snapshot.");
  }
  let report;
  try { report = parseRestrictedJson(input.snapshot()); } catch { reportFail("REGRESSION_REPORT_INVALID", "Report is not restricted JSON."); }
  return inspectDetachedCognitiveRegressionReport(report);
}

function captured(investigation, role, contextDigest = null) {
  const code = role === "baseline" ? "REGRESSION_POLICY_FACT_SOURCE_BASELINE_BINDING_INVALID"
    : "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH";
  const bad = (message) => fail(code, message);
  if (!object(investigation) || investigation.kind !== "MemoryOSInvestigation"
      || investigation.version !== INVESTIGATION_CORE_VERSION || !identity(investigation.identifier)
      || !object(investigation.state) || investigation.state.kind !== "MemoryOSInvestigationState"
      || investigation.state.version !== INVESTIGATION_CORE_VERSION
      || investigation.state.investigationIdentifier !== investigation.identifier
      || !sourceKind(investigation.state.sourceKind)
      || !identity(investigation.state.workspaceIdentifier) || !object(investigation.transitionLog)
      || investigation.transitionLog.kind !== "MemoryOSInvestigationTransitionLog"
      || investigation.transitionLog.version !== INVESTIGATION_CORE_VERSION
      || investigation.transitionLog.investigationIdentifier !== investigation.identifier
      || !matches(DIGEST, investigation.transitionLog.digest)) bad(`Captured ${role} state is invalid.`);
  if (role === "candidate" && !matches(DIGEST, contextDigest)) bad("Candidate context digest is invalid.");
  const result = { coreVersion: INVESTIGATION_CORE_VERSION, investigationIdentifier: investigation.identifier,
    sourceKind: investigation.state.sourceKind, transitionLogDigest: investigation.transitionLog.digest,
    workspaceIdentifier: investigation.state.workspaceIdentifier };
  if (role === "candidate") result.policyFactContextDigest = contextDigest;
  if (result.sourceKind === "mip") {
    result.sourceIdentifier = investigation.state.package?.manifest?.packageIdentifier;
    if (!identity(result.sourceIdentifier)) bad(`Captured ${role} MIP identity is invalid.`);
  }
  return result;
}
function bound(report, state, role) {
  const expected = state.sourceKind === "mip" ? state.sourceIdentifier : state.investigationIdentifier;
  if (report.sourceKind !== state.sourceKind || report.workspaceIdentifier !== state.workspaceIdentifier
      || report.sourceIdentifier !== expected) {
    fail(role === "baseline" ? "REGRESSION_POLICY_FACT_SOURCE_BASELINE_BINDING_INVALID"
      : "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH", `Report ${role} binding mismatch.`);
  }
}

export function projectRegressionPolicyFactSource(reportValue, baselineValue, candidateValue, contextDigest) {
  const report = inspectDetachedCognitiveRegressionReport(reportValue);
  const baseline = captured(baselineValue, "baseline");
  const candidate = captured(candidateValue, "candidate", contextDigest);
  bound(report.baseline, baseline, "baseline"); bound(report.candidate, candidate, "candidate");
  if (baseline.sourceKind !== candidate.sourceKind || baseline.workspaceIdentifier !== candidate.workspaceIdentifier) {
    fail("REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH", "Captured roles are incompatible.");
  }
  const categories = [];
  const findings = [];
  for (let categoryIndex = 0; categoryIndex < report.categories.length; categoryIndex += 1) {
    const { category, differences, status } = report.categories[categoryIndex];
    const subject = { category };
    categories[categoryIndex] = {
      factIdentifier: regressionPolicyFactIdentifier("categories", subject), subject,
      value: { findingCount: differences.length, status } };
    for (let differenceIndex = 0; differenceIndex < differences.length; differenceIndex += 1) {
      const difference = differences[differenceIndex];
      const findingSubject = {
        category,
        subjectDigest: regressionSubjectDigest(category, difference.subject),
      };
      findings[findings.length] = {
        factIdentifier: regressionPolicyFactIdentifier("findings", findingSubject),
        subject: findingSubject,
        value: {
          afterDigest: difference.afterDigest,
          beforeDigest: difference.beforeDigest,
          change: difference.change,
        },
      };
    }
  }
  const subject = {};
  return prepareValue({
    kind: REGRESSION_POLICY_FACT_SOURCE_KIND, version: REGRESSION_POLICY_FACT_SOURCE_VERSION,
    domain: REGRESSION_POLICY_FACT_SOURCE_DOMAIN, sourceModelVersion: REGRESSION_POLICY_FACT_SOURCE_MODEL_VERSION,
    binding: { baseline, candidate, report: { identifier: report.identifier, kind: report.kind, version: report.version } },
    facts: { summary: { factIdentifier: regressionPolicyFactIdentifier("summary", subject), subject,
      value: { findingCount: findings.length, overall: report.overall } }, categories, findings },
  }).artifact;
}

function ascii(left, right) {
  const length = intrinsicMathMin(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftCode = intrinsicReflectApply(intrinsicStringCharCodeAt, left, [index]);
    const rightCode = intrinsicReflectApply(intrinsicStringCharCodeAt, right, [index]);
    if (leftCode !== rightCode) return leftCode - rightCode;
  }
  return left.length - right.length;
}

function sourceSequence(values) {
  if (!intrinsicArrayIsArray(values) || intrinsicObjectGetPrototypeOf(values) !== intrinsicArrayPrototype) {
    fail("DETERMINISTIC_FACT_SOURCE_SCHEMA_INVALID", "Sources must be an intrinsic dense sequence.");
  }
  const ownKeys = intrinsicReflectOwnKeys(values);
  let hasSymbol = false;
  for (let index = 0; index < ownKeys.length; index += 1) {
    if (typeof ownKeys[index] === "symbol") hasSymbol = true;
  }
  if (hasSymbol || ownKeys.length !== values.length + 1) {
    fail("DETERMINISTIC_FACT_SOURCE_SCHEMA_INVALID", "Sources must be a dense sequence without custom members.");
  }
  const result = [];
  for (let index = 0; index < values.length; index += 1) {
    const descriptor = intrinsicObjectGetOwnPropertyDescriptor(values, IntrinsicString(index));
    if (!descriptor || !("value" in descriptor) || descriptor.get !== undefined
        || descriptor.set !== undefined) {
      fail("DETERMINISTIC_FACT_SOURCE_SCHEMA_INVALID", "Source sequence members must be data values.");
    }
    result[result.length] = descriptor.value;
  }
  return result;
}

export function normalizeDeterministicFactSources(values) {
  const sequence = sourceSequence(values);
  const artifacts = [];
  for (let index = 0; index < sequence.length; index += 1) {
    const value = sequence[index];
    artifacts[index] = privateHas(prepared, value) ? privateGet(prepared, value).artifact : value;
  }
  const domains = new IntrinsicSet();
  for (let index = 0; index < artifacts.length; index += 1) {
    const value = artifacts[index];
    jsonLimits(value);
    common(value);
    if (intrinsicReflectApply(intrinsicSetHas, domains, [value.domain])) {
      fail("DETERMINISTIC_FACT_SOURCE_DUPLICATE", "Duplicate Regression source.");
    }
    intrinsicReflectApply(intrinsicSetAdd, domains, [value.domain]);
  }
  const result = [];
  for (let index = 0; index < sequence.length; index += 1) {
    const value = sequence[index];
    result[index] = privateHas(prepared, value) ? value : prepareValue(value);
  }
  intrinsicReflectApply(intrinsicArraySort, result, [(left, right) => ascii(left.domain, right.domain)]);
  return intrinsicObjectFreeze(result);
}

export const REGRESSION_POLICY_FACT_SOURCE_MODEL = freeze({
  digest: REGRESSION_POLICY_FACT_SOURCE_MODEL_DIGEST, domain: REGRESSION_POLICY_FACT_SOURCE_DOMAIN,
  schemaIdentifier: REGRESSION_POLICY_FACT_SOURCE_SCHEMA_IDENTIFIER,
  sourceKind: REGRESSION_POLICY_FACT_SOURCE_KIND,
  sourceModelVersion: REGRESSION_POLICY_FACT_SOURCE_MODEL_VERSION,
  wireVersion: REGRESSION_POLICY_FACT_SOURCE_VERSION,
});
export const DETERMINISTIC_FACT_SOURCE_REGISTRY = freeze({
  kind: "MemoryOSDeterministicFactSourceRegistry", registryVersion: DETERMINISTIC_FACT_SOURCE_REGISTRY_VERSION,
  sources: [{ cardinality: { maximum: 1, minimum: 0 }, domain: REGRESSION_POLICY_FACT_SOURCE_DOMAIN,
    schemaIdentifier: REGRESSION_POLICY_FACT_SOURCE_SCHEMA_IDENTIFIER, sourceKind: REGRESSION_POLICY_FACT_SOURCE_KIND,
    sourceModelDigest: REGRESSION_POLICY_FACT_SOURCE_MODEL_DIGEST,
    sourceModelVersion: REGRESSION_POLICY_FACT_SOURCE_MODEL_VERSION,
    wireVersion: REGRESSION_POLICY_FACT_SOURCE_VERSION }],
});
