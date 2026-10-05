// MO-1308 Investigation History admission (Contract Freeze 1, Stream 2B).
// Seven per-kind admission methods (Freeze section 7.3). Each method delegates verification to the
// record kind's owning authority and never re-derives its meaning: MIP-001, Policy and Regression
// modules are called directly; the Standard's checkpoint constructions, the MO-1306 bundle rules and
// the MO-1307 self-digest and decision shapes are checked exactly as the Freeze section 7.3 lists them.
// Pure and browser-safe: bytes in, a closed `record` description out. No SDK, Core, filesystem,
// network, clock, process or predecessor-package import (R08, R28, R29, R35, R37). Nothing here calls
// `verifyReadiness` or `windows-inspect.ps1` (R08).
import { canonicalize, decodeUtf8, mipDigest, parseStrictJson, sha256Hex, utf8Encode } from "./mip-canonical.js";
import { verifyMemoryInvestigationPackage } from "./memory-investigation-package.js";
import {
  POLICY_EVALUATION_IDENTITY_DIGEST_DOMAIN,
  POLICY_EVALUATION_OUTCOME_DIGEST_DOMAIN,
  validateEvaluationIdentity,
  validatePolicyEvaluationOutcome,
} from "./investigation-policy-engine.js";
import { canonicalizeRestrictedJson, domainSeparatedDigest, parseRestrictedJson } from "./policy-canonical.js";
import { parseDetachedCognitiveRegressionReport } from "./regression-policy-fact-source.js";
import {
  ADMISSION_BY_KIND,
  MEMORYOS_HISTORY_KINDS as KINDS,
  MEMORYOS_HISTORY_DOMAINS as DOMAINS,
  MEMORYOS_HISTORY_VERSION as VERSION,
  RECORD_KINDS,
  RECORD_MEMBER_RULES,
  WORKSPACE_ASSOCIATION_BY_KIND,
  historyFail,
  isWorkspaceIdentifier,
  validateEntry,
} from "./memoryos-history-contract.js";

const encoder = new TextEncoder();
const digestOfBytes = (bytes) => `sha256:${sha256Hex(bytes)}`;
const before = (left, right) => left < right; // UTF-16 code unit order
const isBytes = (value) => value instanceof Uint8Array && !(value.buffer instanceof SharedArrayBuffer);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const hasExactKeys = (value, keys) => isObject(value)
  && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const isString = (value) => typeof value === "string";
const equalBytes = (left, right) => left.length === right.length && left.every((byte, index) => byte === right[index]);

// A verification failure inside an owner's rules is always RECORD_INVALID at the admission stage.
const invalid = () => historyFail("RECORD_INVALID", "ADMISSION");
const guard = (condition) => { if (!condition) invalid(); };
// A malformed call (not a verdict about any record) is USAGE, as in the SDK argument guards.
const usage = (condition) => { if (!condition) historyFail("USAGE", "USAGE"); };
// Run an owner's verifier: any owner error, whatever its type or message, becomes RECORD_INVALID.
function owner(action) {
  try {
    return action();
  } catch (error) {
    if (error?.name === "MemoryOSHistoryError") throw error;
    return invalid();
  }
}

// ---- J (MO-1306 / MO-1307 operational serialization), Freeze section 6.1 ----
// Strict parse, restricted value domain (ASCII printable keys, non-negative safe integers, strings
// without C0/DEL or lone surrogates), then byte comparison with JCS(x) + LF. The profiles carry each
// owner's structural limits so that admission accepts exactly what the owner's parser accepts.
const J_PROFILES = Object.freeze({
  // memoryos-ci/src/json.mjs: container nesting <= 8, <= 256 members and <= 1024 values in total, key <= 64.
  MO1306: Object.freeze({ maxContainerDepth: 8, maxTotalMembers: 256, maxValues: 1024, maxMembersPerObject: Infinity,
    maxKeyUnits: 64, maxStringUnits: Infinity, forbiddenKeys: ["__proto__", "prototype", "constructor"] }),
  // memoryos-readiness/src/canonical.mjs and DEFINITIONS.limits: depth 16, 131072 values, 64 members, key 64, string 4096.
  MO1307: Object.freeze({ maxContainerDepth: Infinity, maxLeafDepth: 16, maxTotalMembers: Infinity, maxValues: 131_072,
    maxMembersPerObject: 64, maxKeyUnits: 64, maxStringUnits: 4096, forbiddenKeys: [] }),
});
const C0_OR_DEL = /[\u0000-\u001f\u007f]/u;
const ASCII_PRINTABLE = /^[\x20-\x7e]*$/u;

function jValueDomain(value, profile) {
  let values = 0;
  let members = 0;
  const walk = (current, depth, containerDepth) => {
    values += 1;
    if (values > profile.maxValues) invalid();
    if (profile.maxLeafDepth !== undefined && depth > profile.maxLeafDepth) invalid();
    if (current === null || typeof current === "boolean") return;
    if (typeof current === "string") {
      if (!current.isWellFormed() || C0_OR_DEL.test(current) || current.length > profile.maxStringUnits) invalid();
      return;
    }
    if (typeof current === "number") {
      if (!Number.isSafeInteger(current) || current < 0 || Object.is(current, -0)) invalid();
      return;
    }
    if (containerDepth + 1 > profile.maxContainerDepth) invalid();
    if (Array.isArray(current)) {
      for (const item of current) walk(item, depth + 1, containerDepth + 1);
      return;
    }
    const keys = Object.keys(current);
    if (keys.length > profile.maxMembersPerObject) invalid();
    for (const key of keys) {
      members += 1;
      if (members > profile.maxTotalMembers || key.length > profile.maxKeyUnits || !ASCII_PRINTABLE.test(key)
          || profile.forbiddenKeys.includes(key)) invalid();
      walk(current[key], depth + 1, containerDepth + 1);
    }
  };
  walk(value, 1, 0);
}

function parseJBytes(bytes, profileName, maxBytes) {
  const profile = J_PROFILES[profileName];
  guard(isBytes(bytes) && bytes.byteLength <= maxBytes);
  return owner(() => {
    const text = decodeUtf8(bytes);
    const value = parseStrictJson(text.endsWith("\n") ? text.slice(0, -1) : text, { maxDepth: 64, maxValues: profile.maxValues });
    if (!text.endsWith("\n")) invalid(); // J has exactly one trailing LF
    jValueDomain(value, profile);
    if (`${canonicalize(value)}\n` !== text) invalid();
    return value;
  });
}
const jBytes = (value) => encoder.encode(`${canonicalize(value)}\n`);

// ---- Record members, digest and ledger view ----

const DIGEST_SHAPE = /^sha256:[0-9a-f]{64}$/u;
const isDigestValue = (value) => isString(value) && DIGEST_SHAPE.test(value);

function checkedMembers(recordKind, members) {
  usage(Array.isArray(members) && members.length > 0);
  const byName = new Map();
  for (const member of members) {
    usage(isObject(member) && Object.keys(member).length === 2 && isString(member.name) && isBytes(member.bytes));
    guard(!byName.has(member.name));
    byName.set(member.name, member.bytes);
  }
  const rule = RECORD_MEMBER_RULES[recordKind];
  const names = [...byName.keys()].sort((a, b) => (before(a, b) ? -1 : 1));
  guard(rule.memberSets.some((set) => set.length === names.length && set.every((name, index) => name === names[index])));
  let total = 0;
  for (const bytes of byName.values()) {
    if (bytes.byteLength > rule.memberBytes) historyFail("RESOURCE_LIMIT", "ADMISSION");
    total += bytes.byteLength;
  }
  if (rule.totalBytes !== null && total > rule.totalBytes) historyFail("RESOURCE_LIMIT", "ADMISSION");
  return { byName, names };
}

const recordDigestOf = (recordKind, memberList) => mipDigest(DOMAINS.record, recordKind, canonicalize(memberList));

// The ledger view is plain data from the verified ledger: its Workspace and its parsed entries.
function indexLedger(ledger) {
  if (!isObject(ledger) || !Object.hasOwn(ledger, "workspaceIdentifier") || !Array.isArray(ledger.entries)
      || !isWorkspaceIdentifier(ledger.workspaceIdentifier)) historyFail("USAGE", "USAGE");
  const records = new Map();
  const purged = new Set();
  const readiness = [];
  for (const entry of ledger.entries) {
    owner(() => validateEntry(entry, { code: "USAGE", stage: "USAGE" }));
    if (entry.entryType === "TOMBSTONE") {
      purged.add(entry.tombstone.targetIndex);
      continue;
    }
    records.set(`${entry.record.recordKind}\n${entry.record.recordDigest}`, entry.index);
    if (entry.record.recordKind === "READINESS_RESULT") {
      const subject = (type) => entry.record.subjects.find((candidate) => candidate.type === type)?.value;
      readiness.push({ candidateDigest: subject("READINESS_CANDIDATE_DIGEST"), readinessDigest: subject("READINESS_DIGEST"),
        proofBindingDigest: subject("PROOF_BINDING_DIGEST") });
    }
  }
  return { workspaceIdentifier: ledger.workspaceIdentifier, records, purged, readiness };
}

// ---- MIP_PACKAGE: MIP_001_VERIFIED ----

function admitMipPackage(members, ledger) {
  const bytes = members.byName.get("package.mip");
  const verification = owner(() => verifyMemoryInvestigationPackage(bytes));
  guard(verification.valid === true);
  const { manifest, integrity } = verification.package;
  const workspace = manifest.workspaceIdentifier;
  if (workspace !== ledger.workspaceIdentifier) historyFail("WORKSPACE_MISMATCH", "ADMISSION");
  return [
    { type: "MIP_PACKAGE_DIGEST", value: integrity.packageDigest },
    { type: "MIP_PACKAGE_IDENTIFIER", value: manifest.packageIdentifier },
    { type: "WORKSPACE", value: workspace },
  ];
}

// ---- INVESTIGATION_CHECKPOINT: CORE_LOG_VERIFIED_STATE_ISSUED (H13 option A) ----
// The Standard's nine-member public Core checkpoint projection, checked from its stored bytes.

const CORE_VERSION = "1.0.0";
const MAX_TRANSITIONS = 10_000; // the Core's published transition-count policy
const TRANSITION_KINDS = Object.freeze(["CREATED", "OBSERVED", "PACKAGE_IMPORTED", "TRACE_SELECTED", "REPLAY_PREPARED",
  "REPLAY_ACTION", "EVOLUTION_ENTERED", "EVOLUTION_MOVED", "COMPARATIVE_ENTERED", "COMPARATIVE_ACTION", "COMPARATIVE_LEFT",
  "EVOLUTION_LEFT", "RETURNED_TO_WORLD", "VERIFIED", "ARCHIVED"]);
const CHECKPOINT_KEYS = ["kind", "version", "identifier", "investigationIdentifier", "workspaceIdentifier",
  "transitionLog", "transitionLogDigest", "transitionCount", "stateDigest"];
const TRANSITION_KEYS = ["kind", "version", "investigationIdentifier", "index", "payload", "previousLogDigest", "identifier"];
const LOG_KEYS = ["kind", "version", "investigationIdentifier", "transitions", "digest"];

function admitCheckpoint(members, ledger) {
  const bytes = members.byName.get("checkpoint.json");
  const checkpoint = owner(() => {
    const text = decodeUtf8(bytes);
    const value = parseStrictJson(text, { maxDepth: 256, maxValues: 4_194_304 });
    if (canonicalize(value) !== text) invalid(); // exactly JCS(x), no trailing LF
    return value;
  });
  guard(hasExactKeys(checkpoint, CHECKPOINT_KEYS) && checkpoint.kind === "MemoryOSInvestigationCheckpoint"
    && checkpoint.version === CORE_VERSION);
  const { investigationIdentifier, workspaceIdentifier, transitionLog: log } = checkpoint;
  guard(isWorkspaceIdentifier(investigationIdentifier) && isWorkspaceIdentifier(workspaceIdentifier)
    && isString(checkpoint.identifier) && isString(checkpoint.transitionLogDigest) && isString(checkpoint.stateDigest));
  guard(hasExactKeys(log, LOG_KEYS) && log.kind === "MemoryOSInvestigationTransitionLog" && log.version === CORE_VERSION
    && log.investigationIdentifier === investigationIdentifier && Array.isArray(log.transitions) && isString(log.digest));
  const { transitions } = log;
  guard(transitions.length >= 2 && transitions.length <= MAX_TRANSITIONS && checkpoint.transitionCount === transitions.length);

  // Every transition identity, the published prefix-digest chain, the log digest and the count.
  const materials = [];
  let priorDigest = mipDigest("INVESTIGATION-CORE-LOG-1.0", investigationIdentifier, "[]");
  transitions.forEach((transition, index) => {
    guard(hasExactKeys(transition, TRANSITION_KEYS) && transition.version === CORE_VERSION
      && transition.investigationIdentifier === investigationIdentifier && transition.index === index
      && TRANSITION_KINDS.includes(transition.kind) && isObject(transition.payload)
      && transition.previousLogDigest === priorDigest && isString(transition.identifier));
    const identifier = mipDigest("INVESTIGATION-CORE-TRANSITION-1.0", canonicalize({
      investigationIdentifier, index, kind: transition.kind, payload: transition.payload, previousLogDigest: transition.previousLogDigest,
    }));
    guard(transition.identifier === identifier);
    materials.push(canonicalize({ identifier, index, investigationIdentifier, kind: transition.kind,
      payload: transition.payload, previousLogDigest: transition.previousLogDigest }));
    priorDigest = mipDigest("INVESTIGATION-CORE-LOG-1.0", investigationIdentifier, `[${materials.join(",")}]`);
  });
  guard(log.digest === priorDigest && checkpoint.transitionLogDigest === priorDigest);
  // The checkpoint identifier; the state digest is retained as the Core issued it, not re-derived.
  guard(checkpoint.identifier === mipDigest("INVESTIGATION-CORE-CHECKPOINT-1.0", investigationIdentifier,
    checkpoint.transitionLogDigest, checkpoint.stateDigest));

  // MIP-backed only: transition 0 CREATED(mip, Workspace) and transition 1 PACKAGE_IMPORTED(verified MIP).
  const [created, imported] = transitions;
  guard(created.kind === "CREATED" && created.payload.sourceKind === "mip"
    && created.payload.workspaceIdentifier === workspaceIdentifier);
  if (workspaceIdentifier !== ledger.workspaceIdentifier) historyFail("WORKSPACE_MISMATCH", "ADMISSION");
  guard(imported.kind === "PACKAGE_IMPORTED" && hasExactKeys(imported.payload, ["package", "supportedExtensions"])
    && Array.isArray(imported.payload.supportedExtensions) && imported.payload.supportedExtensions.every(isString));
  const verification = owner(() => verifyMemoryInvestigationPackage(utf8Encode(canonicalize(imported.payload.package)),
    { supportedExtensions: imported.payload.supportedExtensions }));
  guard(verification.valid === true && verification.package.manifest.workspaceIdentifier === workspaceIdentifier);
  return [
    { type: "CHECKPOINT", value: checkpoint.identifier },
    { type: "INVESTIGATION", value: investigationIdentifier },
    { type: "TRANSITION_LOG_DIGEST", value: checkpoint.transitionLogDigest },
    { type: "WORKSPACE", value: workspaceIdentifier },
  ];
}

// ---- POLICY_EVALUATION: SDK_POLICY_ARTIFACTS_VERIFIED ----
// The SDK's detached verifiers are thin wrappers over the Policy modules; this composes the same
// Policy-module functions (exact canonical bytes, validateEvaluationIdentity, validatePolicyEvaluationOutcome,
// the domain-separated digests) because the history authority never imports the SDK or the Core.

function canonicalPolicyArtifact(bytes) {
  const value = parseRestrictedJson(bytes);
  const canonical = canonicalizeRestrictedJson(value);
  guard(equalBytes(bytes, canonical));
  return value;
}

// Returns the verified identity digest and the verified outcome digest of a normative SDK artifact pair.
function verifyPolicyArtifacts(identityBytes, outcomeBytes, expected = {}) {
  return owner(() => {
    const identity = canonicalPolicyArtifact(identityBytes);
    validateEvaluationIdentity(identity);
    const identityDigest = domainSeparatedDigest(POLICY_EVALUATION_IDENTITY_DIGEST_DOMAIN, identityBytes);
    guard(expected.evaluationIdentityDigest === undefined || identityDigest === expected.evaluationIdentityDigest);
    const outcome = canonicalPolicyArtifact(outcomeBytes);
    // Cross-binding: the outcome embeds exactly this identity and its digest.
    validatePolicyEvaluationOutcome(outcome, { expectedIdentity: identity,
      ...(expected.outcomeDigest === undefined ? {} : { expectedOutcomeDigest: expected.outcomeDigest }) });
    guard(outcome.evaluationIdentityDigest === identityDigest);
    const outcomeDigest = domainSeparatedDigest(POLICY_EVALUATION_OUTCOME_DIGEST_DOMAIN, outcomeBytes);
    return { identity, identityDigest, outcome, outcomeDigest };
  });
}

function admitPolicyEvaluation(members) {
  const verified = verifyPolicyArtifacts(members.byName.get("evaluation-identity.json"), members.byName.get("policy-outcome.json"));
  return [
    { type: "EVALUATION_IDENTITY_DIGEST", value: verified.outcome.evaluationIdentityDigest },
    { type: "OUTCOME_DIGEST", value: verified.outcomeDigest },
  ];
}

// ---- REGRESSION_REPORT: SDK_REGRESSION_REPORT_INSPECTED ----
// parseDetachedCognitiveRegressionReport is the module behind the SDK's inspectRegressionReport; it
// validates the closed shape and recomputes the report identifier. Regression is never recomputed.

function admitRegressionReport(members, ledger) {
  const report = owner(() => parseDetachedCognitiveRegressionReport(members.byName.get("regression-report.json")));
  const baseline = report.baseline?.workspaceIdentifier;
  const candidate = report.candidate?.workspaceIdentifier;
  guard(isWorkspaceIdentifier(baseline) && isWorkspaceIdentifier(candidate) && isString(report.identifier));
  if (baseline !== ledger.workspaceIdentifier || candidate !== ledger.workspaceIdentifier) {
    historyFail("WORKSPACE_MISMATCH", "ADMISSION");
  }
  return [
    { type: "REGRESSION_REPORT", value: report.identifier },
    { type: "WORKSPACE", value: baseline },
  ];
}

// ---- CICD_RUN: MO1306_BUNDLE_INTEGRITY_VERIFIED ----
// MO-1306 Freeze section 9 bundle rules that do not need the installation: completion marker, exact
// cardinality and basenames, canonical J, artifact-manifest sizes and digests, marker manifest digest,
// runId consistency, result/projection/exit agreement (section 8) and, when present, the two normative
// SDK artifacts. Distribution, runtime and adapter-installation digests are retained as recorded, not
// re-verified. The closed shapes are the MO-1306 schemas (result, evidence, artifacts, complete).

const CI_FILE_CAPS = Object.freeze({ "memoryos-ci-result.json": 8192, "memoryos-ci-evidence.json": 16_384,
  "evaluation-identity.json": 4060, "policy-outcome.json": 4060, "memoryos-ci-artifacts.json": 8192, "memoryos-ci-complete.json": 1024 });
const CI_PROVIDERS = Object.freeze(["generic", "github", "gitlab", "jenkins", "azure"]);
const CI_CLASSIFICATIONS = Object.freeze({
  PASS: { exitCode: 0, projection: { class: "SUCCESS", jobStatus: "SUCCESS" } },
  FAIL: { exitCode: 6, projection: { class: "POLICY_FAIL", jobStatus: "FAILURE" } },
  COULD_NOT_EVALUATE: { exitCode: 7, projection: { class: "NOT_EVALUATED", jobStatus: "FAILURE" } },
  CONFIGURATION_ERROR: { exitCode: 10, projection: { class: "ADAPTER_ERROR", jobStatus: "FAILURE" } },
  INPUT_ERROR: { exitCode: 11, projection: { class: "ADAPTER_ERROR", jobStatus: "FAILURE" } },
  SEMANTIC_ERROR: { exitCode: 12, projection: { class: "ADAPTER_ERROR", jobStatus: "FAILURE" } },
  TIMEOUT: { exitCode: 13, projection: { class: "TIMEOUT", jobStatus: "FAILURE" } },
  CANCELLED: { exitCode: 14, projection: { class: "CANCELLED", jobStatus: "CANCELLED" } },
  INTEGRITY_ERROR: { exitCode: 15, projection: { class: "ADAPTER_ERROR", jobStatus: "FAILURE" } },
  INTERNAL_ERROR: { exitCode: 16, projection: { class: "ADAPTER_ERROR", jobStatus: "FAILURE" } },
  ARTIFACT_ERROR: { exitCode: 17, projection: { class: "ADAPTER_ERROR", jobStatus: "FAILURE" } },
});
// MO-1306 error catalog: code -> [classification, stage].
const CI_ERRORS = Object.freeze({
  MO1306_USAGE: ["CONFIGURATION_ERROR", "LAUNCH"], MO1306_CONFIG_READ: ["CONFIGURATION_ERROR", "CONFIGURATION"],
  MO1306_CONFIG_INVALID: ["CONFIGURATION_ERROR", "CONFIGURATION"], MO1306_VERSION_UNSUPPORTED: ["CONFIGURATION_ERROR", "CONFIGURATION"],
  MO1306_PROVIDER_UNSUPPORTED: ["CONFIGURATION_ERROR", "CONFIGURATION"], MO1306_METADATA_INVALID: ["CONFIGURATION_ERROR", "METADATA"],
  MO1306_GENERATION_INVALID: ["CONFIGURATION_ERROR", "GENERATION"], MO1306_INPUT_READ: ["INPUT_ERROR", "ACQUISITION"],
  MO1306_INPUT_LIMIT: ["INPUT_ERROR", "ACQUISITION"], MO1306_FILESYSTEM_BOUNDARY: ["INPUT_ERROR", "ACQUISITION"],
  MO1306_INPUT_CHANGED: ["INPUT_ERROR", "ACQUISITION"], MO1306_SEMANTIC_VALIDATION: ["SEMANTIC_ERROR", "SEMANTIC"],
  MO1306_SEMANTIC_INVOCATION: ["SEMANTIC_ERROR", "SEMANTIC"], MO1306_WORKER_PROTOCOL: ["SEMANTIC_ERROR", "SEMANTIC"],
  MO1306_WORKER_EXIT: ["SEMANTIC_ERROR", "SEMANTIC"], MO1306_TIMEOUT: ["TIMEOUT", "SEMANTIC"],
  MO1306_OVERALL_TIMEOUT: ["TIMEOUT", "CLEANUP"], MO1306_CANCELLED: ["CANCELLED", "CLEANUP"],
  MO1306_RUNTIME_INTEGRITY: ["INTEGRITY_ERROR", "INTEGRITY"], MO1306_CONFIG_INTEGRITY: ["INTEGRITY_ERROR", "INTEGRITY"],
  MO1306_POLICY_PIN: ["INTEGRITY_ERROR", "INTEGRITY"], MO1306_SEMANTIC_INTEGRITY: ["INTEGRITY_ERROR", "INTEGRITY"],
  MO1306_BUNDLE_INTEGRITY: ["INTEGRITY_ERROR", "VERIFICATION"], MO1306_INTERNAL_FAILURE: ["INTERNAL_ERROR", "INTERNAL"],
  MO1306_CLEANUP_FAILED: ["INTERNAL_ERROR", "CLEANUP"], MO1306_OUTPUT_LIMIT: ["ARTIFACT_ERROR", "PUBLICATION"],
  MO1306_OUTPUT_EXISTS: ["ARTIFACT_ERROR", "PUBLICATION"], MO1306_ARTIFACT_WRITE: ["ARTIFACT_ERROR", "PUBLICATION"],
});
// MO-1306 allowlist of existing SDK stable error codes that may appear as `semanticCode`.
const CI_SEMANTIC_CODES = Object.freeze([
  "CAPABILITY_UNAVAILABLE", "CHECKPOINT_MISMATCH", "COMPARATIVE",
  "CORE_BUSY", "DETERMINISTIC_FACT_SOURCE_DOMAIN_UNSUPPORTED", "DETERMINISTIC_FACT_SOURCE_DUPLICATE",
  "DETERMINISTIC_FACT_SOURCE_MODEL_VERSION_UNSUPPORTED", "DETERMINISTIC_FACT_SOURCE_SCHEMA_INVALID", "DETERMINISTIC_FACT_SOURCE_SYNTAX_INVALID",
  "DETERMINISTIC_FACT_SOURCE_VERSION_UNSUPPORTED", "DUPLICATE_IDENTIFIER", "EMPTY_RECONSTRUCTION",
  "EVOLUTION", "INVALID_COMMAND", "INVALID_DIVERGENCE_INDEX",
  "INVALID_ENCODING", "INVALID_FRAME", "INVALID_FRAME_ORDER",
  "INVALID_INPUT", "INVALID_MOMENT", "INVALID_QUERY",
  "INVALID_RECONSTRUCTION", "INVALID_SHARED_MOMENT", "INVALID_TRACE",
  "INVALID_TRANSITION", "INVALID_VIEW", "LAYOUT_MISMATCH",
  "LIFECYCLE", "MIP", "MISSING_SEMANTIC_ELEMENT",
  "MUTABLE_RECONSTRUCTION", "NON_CANONICAL_TRACE", "NOT_FOUND",
  "OK", "ORDER_VIOLATION", "POLICY_DIGEST_MISMATCH",
  "POLICY_EVALUATION_OUTCOME_IDENTITY_MISMATCH", "POLICY_EVALUATION_RESOURCE_LIMIT_EXCEEDED", "POLICY_FACT_CONTEXT_ATOMIC_CAPTURE_FAILED",
  "POLICY_FACT_CONTEXT_DIGEST_MISMATCH", "POLICY_FACT_CONTEXT_INCOMPLETE", "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
  "POLICY_FACT_CONTEXT_SCHEMA_INVALID", "POLICY_FACT_CONTEXT_SOURCE_STATE_INVALID", "POLICY_FACT_CONTEXT_SYNTAX_INVALID",
  "POLICY_FACT_CONTEXT_TRANSITION_BINDING_MISMATCH", "POLICY_FACT_CONTEXT_VERSION_UNSUPPORTED", "POLICY_FACT_MODEL_VERSION_UNSUPPORTED",
  "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED", "POLICY_OPERATIONAL_FAILURE", "POLICY_RESOURCE_PROFILE_DIGEST_MISMATCH",
  "POLICY_RESOURCE_PROFILE_IDENTIFIER_UNSUPPORTED", "POLICY_RESOURCE_PROFILE_SCHEMA_INVALID", "POLICY_RESOURCE_PROFILE_SYNTAX_INVALID",
  "POLICY_RESOURCE_PROFILE_VERSION_UNSUPPORTED", "POLICY_SCHEMA_INVALID", "POLICY_SET_INVALID",
  "POLICY_SYNTAX_INVALID", "POLICY_VERSION_UNSUPPORTED", "PROHIBITED_CONTENT",
  "REGRESSION_POLICY_FACT_SOURCE_ATOMIC_CAPTURE_FAILED", "REGRESSION_POLICY_FACT_SOURCE_BASELINE_BINDING_INVALID", "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH",
  "REGRESSION_POLICY_FACT_SOURCE_DIGEST_MISMATCH", "REGRESSION_POLICY_FACT_SOURCE_INCOMPLETE", "REGRESSION_POLICY_FACT_SOURCE_SCHEMA_INVALID",
  "REGRESSION_REPORT_IDENTITY_MISMATCH", "REGRESSION_REPORT_INVALID", "REGRESSION_REPORT_VERSION_UNSUPPORTED",
  "REPLAY", "RESOURCE_LIMIT_EXCEEDED", "RULE_TYPE_UNSUPPORTED",
  "RULE_VERSION_UNSUPPORTED", "SCHEMA_VIOLATION", "SESSION_FORGOTTEN",
  "SESSION_MISMATCH", "SESSION_NOT_OBSERVED", "SOURCE_KIND_MISMATCH",
  "TRACE", "TRANSITION_LOG", "UNSUPPORTED_VERSION",
  "VERIFICATION_FAILED", "WORKSPACE_MISMATCH", "WORLD_MISMATCH",
]);

const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const REVISION = /^[0-9a-f]{40}$/u;
const TOKEN = /^[A-Za-z0-9_./:@-]+$/u;
const RELATIVE_FILE = /^[A-Za-z0-9_. -]+(?:\/[A-Za-z0-9_. -]+)*$/u;
const isInteger = (value) => Number.isSafeInteger(value);
const isBounded = (value, maximum) => isString(value) && value.length >= 1 && value.length <= maximum;
const nullOr = (value, test) => value === null || test(value);

function checkCiResult(value) {
  guard(hasExactKeys(value, ["kind", "version", "runId", "provider", "classification", "semantic", "error", "process",
    "projection", "configurationDigest", "inputDigest", "contractDigest", "limitsDigest", "adapterDigest"]));
  guard(value.kind === "MemoryOSCICDResult" && value.version === "1.0.0" && RUN_ID.test(value.runId)
    && CI_PROVIDERS.includes(value.provider) && Object.hasOwn(CI_CLASSIFICATIONS, value.classification));
  guard(nullOr(value.configurationDigest, isDigestValue) && nullOr(value.inputDigest, isDigestValue)
    && isDigestValue(value.contractDigest) && isDigestValue(value.limitsDigest) && isDigestValue(value.adapterDigest));
  guard(hasExactKeys(value.process, ["exitCode", "termination"]) && [0, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17].includes(value.process.exitCode)
    && ["NORMAL", "TIMEOUT", "CANCELLED", "ABNORMAL"].includes(value.process.termination));
  guard(hasExactKeys(value.projection, ["class", "jobStatus"]));
  if (value.semantic !== null) {
    const semantic = value.semantic;
    guard(hasExactKeys(semantic, ["artifactKind", "decision", "documentDigest", "evaluationIdentityDigest", "outcomeDigest", "semanticDigest"])
      && ["policy", "policySet"].includes(semantic.artifactKind) && ["PASS", "FAIL", "COULD_NOT_EVALUATE"].includes(semantic.decision)
      && [semantic.documentDigest, semantic.evaluationIdentityDigest, semantic.outcomeDigest, semantic.semanticDigest].every(isDigestValue));
  }
  if (value.error !== null) {
    const error = value.error;
    guard(hasExactKeys(error, ["code", "semanticCode", "stage"]) && Object.hasOwn(CI_ERRORS, error.code)
      && ["ACQUISITION", "CLEANUP", "CONFIGURATION", "GENERATION", "INTEGRITY", "INTERNAL", "LAUNCH", "METADATA", "PUBLICATION",
        "SEMANTIC", "VERIFICATION"].includes(error.stage)
      && nullOr(error.semanticCode, (code) => isBounded(code, 128) && /^[A-Z][A-Z0-9_]*$/u.test(code)));
  }
  // Section 8: the projection table is a total function; result, projection and exit agree.
  const row = CI_CLASSIFICATIONS[value.classification];
  guard(value.process.exitCode === row.exitCode && value.projection.class === row.projection.class
    && value.projection.jobStatus === row.projection.jobStatus);
  if (["PASS", "FAIL", "COULD_NOT_EVALUATE"].includes(value.classification)) {
    guard(value.semantic !== null && value.semantic.decision === value.classification && value.error === null
      && value.process.termination === "NORMAL");
  } else {
    guard(value.semantic === null && value.error !== null);
    const [classification, stage] = CI_ERRORS[value.error.code];
    guard(classification === value.classification && stage === value.error.stage);
    guard(value.error.semanticCode === null
      || (value.error.code === "MO1306_SEMANTIC_VALIDATION" && CI_SEMANTIC_CODES.includes(value.error.semanticCode)));
    const terminal = ["TIMEOUT", "CANCELLED"].includes(value.classification) ? value.classification
      : ["MO1306_WORKER_EXIT", "MO1306_INTERNAL_FAILURE"].includes(value.error.code) ? "ABNORMAL" : "NORMAL";
    guard(value.process.termination === terminal);
  }
  return value;
}

function checkCiEvidence(value) {
  guard(hasExactKeys(value, ["kind", "version", "runId", "contract", "configurationSha256", "adapter", "distributionSha256",
    "runtimeClosureSha256", "semanticContractSha256", "inputs", "runtime", "metadata", "resultSha256", "projectionSha256"]));
  guard(value.kind === "MemoryOSCICDEvidence" && value.version === "1.0.0" && RUN_ID.test(value.runId)
    && nullOr(value.configurationSha256, isDigestValue)
    && [value.distributionSha256, value.runtimeClosureSha256, value.semanticContractSha256, value.resultSha256,
      value.projectionSha256].every(isDigestValue));
  guard(hasExactKeys(value.contract, ["id", "limitsSha256", "sha256", "version"]) && value.contract.id === "memoryos.cicd"
    && value.contract.version === "1.0.0" && isDigestValue(value.contract.limitsSha256) && isDigestValue(value.contract.sha256));
  guard(hasExactKeys(value.adapter, ["id", "sha256", "version"]) && CI_PROVIDERS.some((p) => value.adapter.id === `memoryos.cicd.adapter.${p}`)
    && value.adapter.version === "1.0.0" && isDigestValue(value.adapter.sha256));
  guard(Array.isArray(value.inputs) && value.inputs.length <= 3 && value.inputs.every((input) => hasExactKeys(input, ["byteLength", "role", "sha256"])
    && isInteger(input.byteLength) && input.byteLength >= 0 && input.byteLength <= 524_288
    && ["policy", "policySet", "candidateMip", "baselineMip"].includes(input.role) && isDigestValue(input.sha256)));
  guard(hasExactKeys(value.runtime, ["architecture", "nodeSha256", "nodeVersion", "osRelease", "platform"])
    && value.runtime.architecture === "x64" && value.runtime.nodeVersion === "24.21.0" && value.runtime.platform === "win32"
    && isDigestValue(value.runtime.nodeSha256) && isBounded(value.runtime.osRelease, 64) && /^[ -~]+$/u.test(value.runtime.osRelease));
  const metadata = value.metadata;
  guard(hasExactKeys(metadata, ["attempt", "changeRequest", "event", "jobId", "provider", "repository", "revision", "runId"])
    && CI_PROVIDERS.includes(metadata.provider)
    && nullOr(metadata.attempt, (attempt) => isInteger(attempt) && attempt >= 1 && attempt <= 1000)
    && nullOr(metadata.changeRequest, (text) => isBounded(text, 20) && /^[0-9]+$/u.test(text))
    && nullOr(metadata.event, (text) => isBounded(text, 64) && TOKEN.test(text))
    && nullOr(metadata.jobId, (text) => isBounded(text, 128) && TOKEN.test(text))
    && nullOr(metadata.repository, (text) => isBounded(text, 256) && TOKEN.test(text))
    && nullOr(metadata.revision, (text) => REVISION.test(text))
    && nullOr(metadata.runId, (text) => isBounded(text, 128) && TOKEN.test(text)));
  return value;
}

function checkCiArtifacts(value) {
  guard(hasExactKeys(value, ["files", "kind", "runId", "version"]) && value.kind === "MemoryOSCICDArtifacts"
    && value.version === "1.0.0" && RUN_ID.test(value.runId) && Array.isArray(value.files)
    && value.files.length >= 2 && value.files.length <= 4);
  for (const file of value.files) {
    guard(hasExactKeys(file, ["byteLength", "path", "sha256"]) && isInteger(file.byteLength) && file.byteLength >= 0
      && isString(file.path) && file.path.length >= 1 && file.path.length <= 240 && RELATIVE_FILE.test(file.path) && isDigestValue(file.sha256));
  }
  return value;
}

function checkCiComplete(value) {
  guard(hasExactKeys(value, ["kind", "manifestSha256", "runId", "version"]) && value.kind === "MemoryOSCICDComplete"
    && value.version === "1.0.0" && RUN_ID.test(value.runId) && isDigestValue(value.manifestSha256));
  return value;
}

function admitCicdRun(members) {
  const { byName, names } = members;
  const semanticNames = ["evaluation-identity.json", "policy-outcome.json"];
  const has = (name) => byName.has(name);
  // Exact cardinality: 6 files for a completed evaluation, 4 for a handled operational failure.
  const complete = semanticNames.every(has);
  guard(complete ? names.length === 6 : names.length === 4 && semanticNames.every((name) => !has(name)));
  for (const [name, bytes] of byName) guard(bytes.byteLength <= CI_FILE_CAPS[name]);
  const get = (name, check) => {
    const bytes = byName.get(name);
    const value = check(parseJBytes(bytes, "MO1306", CI_FILE_CAPS[name]));
    return { bytes, value };
  };
  const result = get("memoryos-ci-result.json", checkCiResult);
  const evidence = get("memoryos-ci-evidence.json", checkCiEvidence).value;
  const manifestFile = get("memoryos-ci-artifacts.json", checkCiArtifacts);
  const marker = get("memoryos-ci-complete.json", checkCiComplete).value;
  const { value: run } = result;

  // runId consistency and the completion marker.
  guard([evidence.runId, manifestFile.value.runId, marker.runId].every((runId) => runId === run.runId));
  guard(marker.manifestSha256 === digestOfBytes(manifestFile.bytes));
  // The manifest lists exactly the result, evidence and (when present) the two normative files, basename-sorted.
  const listed = names.filter((name) => name !== "memoryos-ci-artifacts.json" && name !== "memoryos-ci-complete.json");
  const rows = manifestFile.value.files;
  guard(rows.length === listed.length && rows.every((row, index) => row.path === listed[index]));
  for (const row of rows) {
    const bytes = byName.get(row.path);
    guard(row.byteLength === bytes.byteLength && row.sha256 === digestOfBytes(bytes));
  }
  // Evidence cross-links that need no installation; distribution, runtime and installed-adapter digests are retained as recorded.
  guard(evidence.resultSha256 === digestOfBytes(result.bytes) && evidence.projectionSha256 === digestOfBytes(jBytes(run.projection))
    && evidence.configurationSha256 === run.configurationDigest && evidence.contract.sha256 === run.contractDigest
    && evidence.contract.limitsSha256 === run.limitsDigest && evidence.adapter.sha256 === run.adapterDigest
    && evidence.adapter.id === `memoryos.cicd.adapter.${run.provider}` && evidence.metadata.provider === run.provider);
  const roles = evidence.inputs.map((input) => input.role);
  guard(!(roles.length > 0 && !["policy", "policySet"].includes(roles[0])) && !(roles.length > 1 && roles[1] !== "candidateMip")
    && !(roles.length > 2 && roles[2] !== "baselineMip"));
  guard(run.inputDigest === null || run.inputDigest === digestOfBytes(jBytes(evidence.inputs)));

  const subjects = [{ type: "CICD_RUN_ID", value: run.runId }];
  if (run.semantic !== null) {
    guard(complete && roles.length >= 2 && run.inputDigest !== null && run.configurationDigest !== null);
    const { semantic } = run;
    // The two normative SDK artifacts pass the POLICY_EVALUATION checks and agree with the result's semantic block.
    const verified = verifyPolicyArtifacts(byName.get("evaluation-identity.json"), byName.get("policy-outcome.json"),
      { evaluationIdentityDigest: semantic.evaluationIdentityDigest, outcomeDigest: semantic.outcomeDigest });
    const expectedKind = semantic.artifactKind === "policy" ? "MemoryOSInvestigationPolicy" : "MemoryOSInvestigationPolicySet";
    guard(verified.identity.evaluatedArtifact?.kind === expectedKind
      && verified.identity.evaluatedArtifact?.semanticDigest === semantic.semanticDigest
      && verified.outcome.result?.decision === semantic.decision);
    subjects.push({ type: "EVALUATION_IDENTITY_DIGEST", value: semantic.evaluationIdentityDigest },
      { type: "OUTCOME_DIGEST", value: semantic.outcomeDigest });
  } else {
    guard(!complete);
  }
  return subjects;
}

// ---- READINESS_RESULT: MO1307_SELF_DIGESTS_RECOMPUTED ----
// Canonical J, kind and version, and recomputation of readinessDigest and proofBindingDigest (MO-1307
// Freeze section 14). This is not a MO-1307 verification: no evidence graph, input or gate is re-derived.

function admitReadinessResult(members) {
  const result = parseJBytes(members.byName.get("memoryos-readiness-result.json"), "MO1307", 4_194_304);
  guard(hasExactKeys(result, ["assessment", "audit", "kind", "proofBindingDigest", "readinessDigest", "version"])
    && result.kind === "MemoryOSReadinessResult" && result.version === "1.0.0"
    && isObject(result.assessment) && isObject(result.audit)
    && isDigestValue(result.readinessDigest) && isDigestValue(result.proofBindingDigest)
    && isDigestValue(result.assessment.candidateDigest));
  const readinessDigest = digestOfBytes(jBytes({ kind: "MemoryOSReadinessIdentity", version: "1.0.0", assessment: result.assessment }));
  guard(result.readinessDigest === readinessDigest);
  const proofBindingDigest = digestOfBytes(jBytes({ kind: "MemoryOSReadinessProofBinding", version: "1.0.0",
    readinessDigest, audit: result.audit }));
  guard(result.proofBindingDigest === proofBindingDigest);
  return [
    { type: "PROOF_BINDING_DIGEST", value: result.proofBindingDigest },
    { type: "READINESS_CANDIDATE_DIGEST", value: result.assessment.candidateDigest },
    { type: "READINESS_DIGEST", value: result.readinessDigest },
  ];
}

// ---- HUMAN_DECISION_CLAIM: MO1307_DECISION_CLAIM_BOUND ----
// The exact MO-1307 section 13 shape, authenticity NOT_VERIFIED_BY_MEMORYOS, bound (H16) to a
// READINESS_RESULT entry already in the ledger. Consistency is a derived query value, never stored here.

function validUtcTimestamp(text) {
  if (!/^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]Z$/u.test(text)) return false;
  const date = new Date(text);
  return Number.isFinite(date.valueOf()) && date.getUTCFullYear() >= 1 && date.toISOString().replace(".000Z", "Z") === text;
}

function admitDecisionClaim(members, ledger) {
  const claim = parseJBytes(members.byName.get("human-decision.json"), "MO1307", 8192);
  guard(hasExactKeys(claim, ["actor", "attestation", "authenticity", "candidateDigest", "decision", "kind", "proofBindingDigest",
    "readinessDigest", "reason", "timestamp", "version"]) && claim.kind === "MemoryOSReadinessHumanDecision" && claim.version === "1.0.0"
    && claim.authenticity === "NOT_VERIFIED_BY_MEMORYOS" && ["APPROVE", "REJECT", "DEFER"].includes(claim.decision)
    && isDigestValue(claim.candidateDigest) && isDigestValue(claim.readinessDigest) && isDigestValue(claim.proofBindingDigest)
    && isBounded(claim.reason, 1024) && nullOr(claim.actor, (actor) => isString(actor) && actor.length <= 128)
    && nullOr(claim.timestamp, (timestamp) => isString(timestamp) && validUtcTimestamp(timestamp))
    && nullOr(claim.attestation, isDigestValue));
  const bound = ledger.readiness.some((entry) => entry.candidateDigest === claim.candidateDigest
    && entry.readinessDigest === claim.readinessDigest && entry.proofBindingDigest === claim.proofBindingDigest);
  if (!bound) historyFail("DECISION_UNBOUND", "ADMISSION");
  return [
    { type: "PROOF_BINDING_DIGEST", value: claim.proofBindingDigest },
    { type: "READINESS_CANDIDATE_DIGEST", value: claim.candidateDigest },
    { type: "READINESS_DIGEST", value: claim.readinessDigest },
  ];
}

const METHODS = Object.freeze({
  MIP_PACKAGE: admitMipPackage,
  INVESTIGATION_CHECKPOINT: admitCheckpoint,
  POLICY_EVALUATION: admitPolicyEvaluation,
  REGRESSION_REPORT: admitRegressionReport,
  CICD_RUN: admitCicdRun,
  READINESS_RESULT: admitReadinessResult,
  HUMAN_DECISION_CLAIM: admitDecisionClaim,
});

// ---- Public entry point ----

function sortedSubjects(subjects) {
  const result = subjects.map((subject) => ({ type: subject.type, value: subject.value }));
  result.sort((left, right) => (before(left.type, right.type) ? -1 : before(right.type, left.type) ? 1
    : before(left.value, right.value) ? -1 : before(right.value, left.value) ? 1 : 0));
  return result;
}

// `ledger` is plain data from the verified ledger: `{ workspaceIdentifier, entries }`, the Workspace and the
// parsed MemoryOSHistoryEntry values. Returns the closed `record` object of a RECORD entry, deeply frozen.
export function admitHistoryRecord(input) {
  usage(isObject(input) && Object.keys(input).length === 3 && ["recordKind", "members", "ledger"].every((key) => Object.hasOwn(input, key)));
  const { recordKind, members: memberInput, ledger: ledgerInput } = input;
  guard(RECORD_KINDS.includes(recordKind)); // an unknown kind is a record verdict (RECORD_INVALID), as in the SDK guard
  const ledger = indexLedger(ledgerInput);
  const members = checkedMembers(recordKind, memberInput);
  const memberList = members.names.map((name) => ({ name, byteLength: members.byName.get(name).byteLength,
    sha256: digestOfBytes(members.byName.get(name)) }));
  const recordDigest = recordDigestOf(recordKind, memberList);
  // One artifact gives one entry; purged bytes can never be re-added (H23).
  const existing = ledger.records.get(`${recordKind}\n${recordDigest}`);
  if (existing !== undefined) historyFail(ledger.purged.has(existing) ? "RECORD_PURGED" : "RECORD_DUPLICATE", "ADMISSION");

  const subjects = sortedSubjects(METHODS[recordKind](members, ledger));
  const record = { recordKind, recordDigest, admission: ADMISSION_BY_KIND[recordKind], members: memberList,
    workspaceAssociation: WORKSPACE_ASSOCIATION_BY_KIND[recordKind], subjects };
  // Final shape check against the frozen entry shape; a failure here is an internal defect, never a verdict.
  try {
    validateEntry(JSON.parse(canonicalize({ kind: KINDS.entry, version: VERSION, ledgerIdentifier: recordDigest, index: 0,
      previousEntryDigest: recordDigest, entryType: "RECORD", record, tombstone: null, entryDigest: recordDigest })));
  } catch {
    historyFail("INTERNAL", "INTERNAL");
  }
  return Object.freeze({ ...record, members: Object.freeze(memberList.map(Object.freeze)),
    subjects: Object.freeze(subjects.map(Object.freeze)) });
}

