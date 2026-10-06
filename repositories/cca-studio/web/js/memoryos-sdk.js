import {
  InvestigationCore,
  InvestigationCoreError,
  projectInvestigation,
} from "./investigation-core.js";
import { verifyMemoryInvestigationPackage } from "./memory-investigation-package.js";
import {
  MemoryOSAuthoritativePolicyFactContext,
  MemoryOSAuthoritativeRegressionPolicyFactSource,
  MemoryOSAuthoritativeRegressionPolicyFacts,
  MemoryOSPolicyArtifactVerification,
  MemoryOSPolicyEvaluation,
  MemoryOSPolicyFactContextInspection,
  MemoryOSPolicyOperationalError,
  MemoryOSPolicyPreparationError,
  MemoryOSPreparedPolicy,
  MemoryOSRegressionPolicyFactSourceInspection,
  MemoryOSRegressionReportInspection,
  createMemoryOSPolicyIntegration,
} from "./investigation-policy-integration.js";
import { canonicalize as historyCanonicalize } from "./mip-canonical.js";
import { admitHistoryRecord as admitHistoryRecordAuthority } from "./memoryos-history-admission.js";
import {
  appendHistoryEntry as appendHistoryEntryAuthority,
  buildHistoryExport as buildHistoryExportAuthority,
  createHistoryLedger as createHistoryLedgerAuthority,
  historyLedgerView,
  queryHistoryLedger as queryHistoryLedgerAuthority,
  tombstoneHistoryEntry as tombstoneHistoryEntryAuthority,
  verifyHistoryExport as verifyHistoryExportAuthority,
  verifyHistoryLedger as verifyHistoryLedgerAuthority,
} from "./memoryos-history-ledger.js";
import {
  MEMORYOS_HISTORY_LIMITS as HISTORY_LIMITS,
  MemoryOSHistoryError,
  RECORD_KINDS as HISTORY_RECORD_KINDS,
  TOMBSTONE_REASONS as HISTORY_TOMBSTONE_REASONS,
  isAuthorityReference as isHistoryAuthorityReference,
  isDigest as isHistoryDigest,
  isLedgerName as isHistoryLedgerName,
  isWorkspaceIdentifier as isHistoryWorkspaceIdentifier,
  validateQuery as validateHistoryQuery,
} from "./memoryos-history-contract.js";

export const MEMORYOS_SDK_VERSION = "1.2.0";

export {
  MemoryOSAuthoritativePolicyFactContext,
  MemoryOSAuthoritativeRegressionPolicyFactSource,
  MemoryOSAuthoritativeRegressionPolicyFacts,
  MemoryOSPolicyArtifactVerification,
  MemoryOSPolicyEvaluation,
  MemoryOSPolicyFactContextInspection,
  MemoryOSPolicyOperationalError,
  MemoryOSPolicyPreparationError,
  MemoryOSPreparedPolicy,
  MemoryOSRegressionPolicyFactSourceInspection,
  MemoryOSRegressionReportInspection,
  MemoryOSHistoryError,
};

const PRIVATE = Symbol("MemoryOS SDK private construction");
const primordialReflectApply = Reflect.apply;
const primordialWeakMapGet = WeakMap.prototype.get;
const primordialWeakMapSet = WeakMap.prototype.set;
const memoryBindings = new WeakMap();
const workspaceBindings = new WeakMap();
const workspaceIdentifiers = new WeakMap();
const investigationBindings = new WeakMap();
const investigationIdentifiers = new WeakMap();
const replayBindings = new WeakMap();
const replayIdentifiers = new WeakMap();
const comparisonBindings = new WeakMap();
const checkpointBindings = new WeakMap();
const checkpointValues = new WeakMap();
const packageValues = new WeakMap();

function weakMapGet(values, key) {
  return primordialReflectApply(primordialWeakMapGet, values, [key]);
}

function weakMapSet(values, key, value) {
  primordialReflectApply(primordialWeakMapSet, values, [key, value]);
}

const investigationQueryMembers = Object.freeze([
  "category",
  "reflectionIdentifier",
  "transition",
]);

function requirePrivate(token, type) {
  if (token !== PRIVATE) throw new TypeError(`${type} values are created by MemoryOS.`);
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

function requireIdentifier(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} is required.`);
  }
  return value;
}

function bindingFor(value, values, type) {
  const binding = weakMapGet(values, value);
  if (!binding) throw new TypeError(`${type} must be an SDK-owned value.`);
  return binding;
}

function packageInput(value) {
  const stored = weakMapGet(packageValues, value);
  return stored ? Uint8Array.from(stored.bytes) : value;
}

function packageOptions(value, options = {}) {
  requireObject(options, "Package options");
  const stored = weakMapGet(packageValues, value);
  if (!stored || options.supportedExtensions !== undefined) return options;
  return { ...options, supportedExtensions: stored.supportedExtensions };
}

function regressionReportInput(value) {
  const input = requireObject(value, "Cognitive Regression report");
  if (input.command === "regression" && input.ok === true && input.schemaVersion === "1.0") {
    return requireObject(input.result, "Cognitive Regression report envelope result");
  }
  return input instanceof RegressionReport ? { ...input } : input;
}

function investigationQueryInput(value = {}) {
  const input = requireObject(value, "Investigation query");
  const unexpected = Object.keys(input).filter((key) => !investigationQueryMembers.includes(key));
  if (unexpected.length > 0) {
    throw new TypeError(`Investigation query contains unsupported member '${unexpected.sort()[0]}'.`);
  }
  return Object.fromEntries(
    investigationQueryMembers.map((member) => [member, input[member] ?? null]),
  );
}

function wrapPackage(verification, supportedExtensions = []) {
  if (!verification.valid || !verification.package || !verification.bytes) return null;
  return new MemoryInvestigationPackage(PRIVATE, {
    bytes: verification.bytes,
    packageValue: verification.package,
    supportedExtensions,
  });
}

class PrivateSdkBinding {
  constructor() {
    this.core = new InvestigationCore();
    this.policy = createMemoryOSPolicyIntegration(this.core);
  }

  wrapInvestigation(value) {
    return new Investigation(PRIVATE, this, value.identifier);
  }

  load(identifier) {
    return this.core.load(identifier);
  }

  project(identifier) {
    return projectInvestigation(this.load(identifier));
  }

  observeWorkspace(workspace, snapshot, options) {
    if (weakMapGet(workspaceBindings, workspace) !== this) {
      throw new TypeError("Workspace belongs to a different MemoryOS instance.");
    }
    requireObject(options, "Observation options");
    const value = this.core.create({
      ...options,
      snapshot,
      workspaceIdentifier: weakMapGet(workspaceIdentifiers, workspace),
    });
    return this.wrapInvestigation(value);
  }

  observeInvestigation(identifier, snapshot, options) {
    requireObject(options, "Observation options");
    return this.wrapInvestigation(this.core.observe(identifier, { ...options, snapshot }));
  }

  importPackage(input, options) {
    return this.wrapInvestigation(this.core.import(
      packageInput(input),
      packageOptions(input, options),
    ));
  }

  exportPackage(investigation, options) {
    if (weakMapGet(investigationBindings, investigation) !== this) {
      throw new TypeError("Investigation belongs to a different MemoryOS instance.");
    }
    const identifier = weakMapGet(investigationIdentifiers, investigation);
    const coreInvestigation = this.load(identifier);
    const supportedExtensions = options.supportedExtensions
      ?? coreInvestigation.state.supportedExtensions;
    const bytes = this.core.export(identifier, { ...options, supportedExtensions });
    const verification = verifyMemoryInvestigationPackage(bytes, { ...options, supportedExtensions });
    return wrapPackage(verification, supportedExtensions);
  }

  regression(baseline, candidate) {
    if (weakMapGet(investigationBindings, baseline) !== this
      || weakMapGet(investigationBindings, candidate) !== this) {
      throw new TypeError("Regression investigations must belong to this MemoryOS instance.");
    }
    return new RegressionReport(PRIVATE, this.core.regression(
      weakMapGet(investigationIdentifiers, baseline),
      weakMapGet(investigationIdentifiers, candidate),
    ));
  }

  investigate(report, query) {
    return new InvestigationResult(
      PRIVATE,
      this.core.investigate(
        regressionReportInput(report),
        investigationQueryInput(query),
      ),
    );
  }

  capturePolicyFactContext(investigation) {
    if (weakMapGet(investigationBindings, investigation) !== this) {
      throw new TypeError("Investigation belongs to a different MemoryOS instance.");
    }
    return this.policy.capturePolicyFactContext(weakMapGet(investigationIdentifiers, investigation));
  }

  captureRegressionPolicyFacts(baseline, candidate) {
    if (weakMapGet(investigationBindings, baseline) !== this
        || weakMapGet(investigationBindings, candidate) !== this) {
      throw new TypeError("Regression investigations must belong to this MemoryOS instance.");
    }
    return this.policy.captureRegressionPolicyFacts(
      weakMapGet(investigationIdentifiers, baseline),
      weakMapGet(investigationIdentifiers, candidate),
    );
  }

  restore(checkpoint) {
    const value = weakMapGet(checkpointValues, checkpoint);
    if (!value || weakMapGet(checkpointBindings, checkpoint) !== this) {
      throw new TypeError("Checkpoint belongs to a different MemoryOS binding.");
    }
    return this.wrapInvestigation(this.core.restore(value));
  }
}

export class Workspace {
  constructor(token, binding, identifier) {
    requirePrivate(token, "Workspace");
    weakMapSet(workspaceBindings, this, binding);
    weakMapSet(workspaceIdentifiers, this, requireIdentifier(identifier, "Workspace identifier"));
    Object.freeze(this);
  }

  get identifier() {
    return weakMapGet(workspaceIdentifiers, this);
  }
}

export class MemoryInvestigationPackage {
  constructor(token, { bytes, packageValue, supportedExtensions }) {
    requirePrivate(token, "MemoryInvestigationPackage");
    const immutableBytes = Object.freeze(Array.from(bytes));
    const immutableExtensions = Object.freeze([...supportedExtensions].sort());
    weakMapSet(packageValues, this, {
      bytes: immutableBytes,
      packageValue,
      supportedExtensions: immutableExtensions,
    });
    this.kind = packageValue.kind;
    this.version = packageValue.formatVersion;
    this.manifest = packageValue.manifest;
    this.byteLength = immutableBytes.length;
    this.supportedExtensions = immutableExtensions;
    Object.freeze(this);
  }

  get value() {
    return weakMapGet(packageValues, this).packageValue;
  }

  toBytes() {
    return Uint8Array.from(weakMapGet(packageValues, this).bytes);
  }
}

export class VerificationResult {
  constructor(token, value) {
    requirePrivate(token, "VerificationResult");
    this.kind = "MemoryOSSDKVerificationResult";
    this.version = MEMORYOS_SDK_VERSION;
    this.valid = Boolean(value.valid);
    this.status = this.valid ? "passed" : "failed";
    this.diagnostics = value.diagnostics ?? Object.freeze([]);
    this.package = value.package ?? null;
    this.investigationIdentifier = value.investigationIdentifier ?? null;
    this.transitionLogDigest = value.transitionLogDigest ?? null;
    this.lifecycle = value.lifecycle ?? null;
    this.checks = value.checks ?? Object.freeze([]);
    Object.freeze(this);
  }
}

export class RegressionReport {
  constructor(token, value) {
    requirePrivate(token, "RegressionReport");
    this.kind = value.kind;
    this.version = value.version;
    this.identifier = value.identifier;
    this.baseline = value.baseline;
    this.candidate = value.candidate;
    this.categories = value.categories;
    this.regressionDetected = value.regressionDetected;
    this.overall = value.overall;
    Object.freeze(this);
  }
}

export class InvestigationResult {
  constructor(token, value) {
    requirePrivate(token, "InvestigationResult");
    this.kind = value.kind;
    this.version = value.version;
    this.identifier = value.identifier;
    this.regressionIdentifier = value.regressionIdentifier;
    this.workspaceIdentifier = value.workspaceIdentifier;
    this.query = value.query;
    this.status = value.status;
    this.matchCount = value.matchCount;
    this.matches = value.matches;
    Object.freeze(this);
  }
}

export class Checkpoint {
  constructor(token, binding, value) {
    requirePrivate(token, "Checkpoint");
    weakMapSet(checkpointBindings, this, binding);
    weakMapSet(checkpointValues, this, value);
    this.kind = value.kind;
    this.version = value.version;
    this.identifier = value.identifier;
    this.investigationIdentifier = value.investigationIdentifier;
    this.workspaceIdentifier = value.workspaceIdentifier;
    this.transitionLogDigest = value.transitionLogDigest;
    this.transitionCount = value.transitionCount;
    this.stateDigest = value.stateDigest;
    Object.freeze(this);
  }
}

export class ReplaySession {
  constructor(token, binding, investigationIdentifier, replayIdentifier) {
    requirePrivate(token, "ReplaySession");
    weakMapSet(replayBindings, this, { binding, investigationIdentifier });
    weakMapSet(replayIdentifiers, this, replayIdentifier);
    Object.freeze(this);
  }

  #current() {
    const { binding, investigationIdentifier } = bindingFor(this, replayBindings, "ReplaySession");
    const current = binding.load(investigationIdentifier);
    if (current.state.activeReplay?.identifier !== weakMapGet(replayIdentifiers, this)) {
      throw new InvestigationCoreError(
        "SESSION_MISMATCH",
        "replay",
        "ReplaySession no longer identifies the active deterministic Replay.",
      );
    }
    return { binding, investigationIdentifier, current };
  }

  #apply(action) {
    const { binding, investigationIdentifier } = this.#current();
    binding.core.replay(investigationIdentifier, action);
    return this;
  }

  get investigation() {
    const { binding, current } = this.#current();
    return binding.wrapInvestigation(current);
  }

  get replay() {
    return this.#current().current.state.activeReplay;
  }

  get state() {
    return this.#current().current.state.replayState;
  }

  get view() {
    return this.#current().current.state.replaySession.view;
  }

  play() { return this.#apply("play"); }

  pause() { return this.#apply("pause"); }

  restart() { return this.#apply("restart"); }

  next() { return this.#apply("next"); }

  previous() { return this.#apply("previous"); }

  advance() { return this.#apply("advance"); }
}

export class ComparisonSession {
  constructor(token, binding, investigationIdentifier, evolutionIdentifier) {
    requirePrivate(token, "ComparisonSession");
    weakMapSet(comparisonBindings, this, {
      active: false,
      binding,
      initialCommand: Object.freeze({ action: "enter", evolutionIdentifier }),
      investigationIdentifier,
    });
    Object.freeze(this);
  }

  #current() {
    const session = bindingFor(this, comparisonBindings, "ComparisonSession");
    if (!session.active) {
      throw new InvestigationCoreError(
        "INVALID_TRANSITION",
        "compare",
        "ComparisonSession must be activated through Investigation.compare().",
      );
    }
    const { binding, investigationIdentifier } = session;
    return { binding, investigationIdentifier, current: binding.load(investigationIdentifier) };
  }

  #apply(command) {
    const { binding, investigationIdentifier } = this.#current();
    binding.core.compare(investigationIdentifier, command);
    return this;
  }

  get investigation() {
    const { binding, current } = this.#current();
    return binding.wrapInvestigation(current);
  }

  get lifecycle() {
    return this.#current().current.state.lifecycle;
  }

  get evolution() {
    return this.#current().current.state.evolution;
  }

  get reconstruction() {
    return this.#current().current.state.comparativeReconstruction;
  }

  get state() {
    return this.#current().current.state.comparativeReplayState;
  }

  get view() {
    return this.#current().current.state.comparisonSession?.view ?? null;
  }

  previousObservation() { return this.#apply("previous"); }

  nextObservation() { return this.#apply("next"); }

  start(reflectionSelection) {
    if (reflectionSelection === undefined || reflectionSelection === null) {
      throw new TypeError("Comparative Reconstruction requires an explicit Reflection selection.");
    }
    const selection = typeof reflectionSelection === "string"
      ? { targetNodeKey: requireIdentifier(reflectionSelection, "Reflection node key") }
      : requireObject(reflectionSelection, "Reflection selection");
    const comparativeIdentifier = selection.comparativeIdentifier ?? null;
    const targetNodeKey = selection.targetNodeKey ?? null;
    const sourceKind = this.#current().current.state.sourceKind;
    const valid = sourceKind === "native"
      ? targetNodeKey !== null && comparativeIdentifier === null
      : comparativeIdentifier !== null && targetNodeKey === null;
    if (!valid) {
      throw new TypeError(
        sourceKind === "native"
          ? "Native Comparative Reconstruction requires exactly one explicit target node key."
          : "Package Comparative Reconstruction requires exactly one explicit Comparative Reconstruction identifier.",
      );
    }
    if (comparativeIdentifier !== null) {
      requireIdentifier(comparativeIdentifier, "Comparative Reconstruction identifier");
    }
    if (targetNodeKey !== null) requireIdentifier(targetNodeKey, "Reflection node key");
    return this.#apply(sourceKind === "native"
      ? { action: "start", targetNodeKey }
      : { action: "start", comparativeIdentifier });
  }

  play() { return this.#apply("play"); }

  pause() { return this.#apply("pause"); }

  reset() { return this.#apply("reset"); }

  next() { return this.#apply("nextStep"); }

  previous() { return this.#apply("previousStep"); }

  advance() { return this.#apply("advance"); }

  back() { return this.#apply("back"); }
}

export class Investigation {
  constructor(token, binding, identifier) {
    requirePrivate(token, "Investigation");
    weakMapSet(investigationBindings, this, binding);
    weakMapSet(investigationIdentifiers, this, requireIdentifier(identifier, "Investigation identifier"));
    Object.freeze(this);
  }

  #binding() {
    return bindingFor(this, investigationBindings, "Investigation");
  }

  get identifier() {
    return weakMapGet(investigationIdentifiers, this);
  }

  get view() {
    return this.#binding().project(this.identifier);
  }

  get lifecycle() {
    return this.#binding().load(this.identifier).state.lifecycle;
  }

  get phase() {
    return this.view.phase;
  }

  get availability() {
    return this.view.availability;
  }

  get workspaceIdentifier() {
    return this.view.workspaceIdentifier;
  }

  get transitionLog() {
    return this.#binding().load(this.identifier).transitionLog;
  }

  refresh() {
    return this.#binding().wrapInvestigation(this.#binding().load(this.identifier));
  }

  observe(snapshot, options = {}) {
    return this.#binding().observeInvestigation(this.identifier, snapshot, options);
  }

  trace(reflectionSelection) {
    if (reflectionSelection === undefined || reflectionSelection === null) {
      throw new TypeError("Trace requires an explicit Reflection selection.");
    }
    return this.#binding().wrapInvestigation(
      this.#binding().core.trace(this.identifier, reflectionSelection),
    );
  }

  replay() {
    const current = this.#binding().load(this.identifier);
    if (!current.state.activeReplay) {
      throw new InvestigationCoreError(
        "INVALID_TRANSITION",
        "replay",
        "Replay is not prepared.",
        { currentState: current.state.lifecycle },
      );
    }
    return new ReplaySession(
      PRIVATE,
      this.#binding(),
      this.identifier,
      current.state.activeReplay.identifier,
    );
  }

  comparisonSession(evolutionIdentifier) {
    if (arguments.length === 0) {
      throw new TypeError(
        "comparisonSession() requires an explicit Cognitive Evolution identifier or null for native observations.",
      );
    }
    if (evolutionIdentifier !== null) {
      requireIdentifier(evolutionIdentifier, "Cognitive Evolution identifier");
    }
    const sourceKind = this.#binding().load(this.identifier).state.sourceKind;
    if (sourceKind === "native" && evolutionIdentifier !== null) {
      throw new TypeError("Native comparison requires an explicit null Cognitive Evolution identifier.");
    }
    if (sourceKind === "mip" && evolutionIdentifier === null) {
      throw new TypeError("Package comparison requires an exact Cognitive Evolution identifier.");
    }
    return new ComparisonSession(
      PRIVATE,
      this.#binding(),
      this.identifier,
      evolutionIdentifier,
    );
  }

  compare(comparisonSession) {
    const value = weakMapGet(comparisonBindings, comparisonSession);
    if (!value || value.binding !== this.#binding() || value.investigationIdentifier !== this.identifier) {
      throw new TypeError("compare() requires this Investigation's explicit ComparisonSession.");
    }
    if (value.active) {
      throw new TypeError("ComparisonSession is already active.");
    }
    value.binding.core.compare(value.investigationIdentifier, value.initialCommand);
    value.active = true;
    return comparisonSession;
  }

  verify() {
    const verified = this.#binding().core.verify(this.identifier);
    const session = verified.state.verificationSession;
    return new VerificationResult(PRIVATE, {
      valid: session.status === "passed",
      investigationIdentifier: session.investigationIdentifier,
      transitionLogDigest: session.transitionLogDigest,
      lifecycle: session.lifecycle,
      checks: session.checks,
    });
  }

  checkpoint() {
    const binding = this.#binding();
    return new Checkpoint(PRIVATE, binding, binding.core.checkpoint(this.identifier));
  }

  restore(checkpoint) {
    if (checkpoint?.investigationIdentifier !== this.identifier) {
      throw new TypeError("Checkpoint belongs to a different Investigation.");
    }
    return this.#binding().restore(checkpoint);
  }

  returnToWorld() {
    return this.#binding().wrapInvestigation(
      this.#binding().core.returnToWorld(this.identifier),
    );
  }

  archive() {
    return this.#binding().wrapInvestigation(this.#binding().core.archive(this.identifier));
  }
}

export class InvestigationQuery {
  constructor(options = {}) {
    const input = investigationQueryInput(options);
    for (const member of investigationQueryMembers) {
      const value = input[member] ?? null;
      if (value !== null && (typeof value !== "string" || value.length === 0)) {
        throw new TypeError(`Investigation query '${member}' must be null or a non-empty string.`);
      }
      this[member] = value;
    }
    Object.freeze(this);
  }
}

Object.freeze(InvestigationQuery.prototype);
Object.freeze(InvestigationQuery);

export class MemoryOS {
  constructor() {
    weakMapSet(memoryBindings, this, new PrivateSdkBinding());
    Object.freeze(this);
  }

  #binding() {
    return bindingFor(this, memoryBindings, "MemoryOS");
  }

  openWorkspace(identifier) {
    return new Workspace(PRIVATE, this.#binding(), identifier);
  }

  observe(workspace, snapshot, options = {}) {
    return this.#binding().observeWorkspace(workspace, snapshot, options);
  }

  importPackage(input, options = {}) {
    return this.#binding().importPackage(input, options);
  }

  exportPackage(investigation, options = {}) {
    requireObject(options, "Package options");
    return this.#binding().exportPackage(investigation, options);
  }

  verifyPackage(input, options = {}) {
    const effectiveOptions = packageOptions(input, options);
    const verification = verifyMemoryInvestigationPackage(packageInput(input), effectiveOptions);
    return new VerificationResult(PRIVATE, {
      valid: verification.valid,
      diagnostics: verification.diagnostics,
      package: wrapPackage(verification, effectiveOptions.supportedExtensions ?? []),
    });
  }

  regression(baseline, candidate) {
    return this.#binding().regression(baseline, candidate);
  }

  investigate(report, query = {}) {
    return this.#binding().investigate(report, query);
  }

  preparePolicy(bytes) {
    return this.#binding().policy.preparePolicy(bytes);
  }

  preparePolicySet(bytes) {
    return this.#binding().policy.preparePolicySet(bytes);
  }

  inspectPolicyFactContext(bytes, options = {}) {
    return this.#binding().policy.inspectPolicyFactContext(bytes, options);
  }

  inspectRegressionPolicyFactSource(bytes, options = {}) {
    return this.#binding().policy.inspectRegressionPolicyFactSource(bytes, options);
  }

  inspectRegressionReport(bytes) {
    return this.#binding().policy.inspectRegressionReport(bytes);
  }

  capturePolicyFactContext(investigation) {
    return this.#binding().capturePolicyFactContext(investigation);
  }

  captureRegressionPolicyFacts(baseline, candidate) {
    return this.#binding().captureRegressionPolicyFacts(baseline, candidate);
  }

  evaluatePolicy(policy, context, options = {}) {
    return this.#binding().policy.evaluatePolicy(policy, context, options);
  }

  evaluatePolicySet(policySet, context, options = {}) {
    return this.#binding().policy.evaluatePolicySet(policySet, context, options);
  }

  verifyEvaluationIdentityArtifact(bytes, expectedEvaluationIdentityDigest) {
    return this.#binding().policy.verifyEvaluationIdentityArtifact(
      bytes,
      expectedEvaluationIdentityDigest,
    );
  }

  verifyEvaluationIdentityForEvaluation(bytes, artifact, context, options = {}) {
    return this.#binding().policy.verifyEvaluationIdentityForEvaluation(
      bytes,
      artifact,
      context,
      options,
    );
  }

  verifyPolicyEvaluationOutcomeArtifact(bytes, options = {}) {
    return this.#binding().policy.verifyPolicyEvaluationOutcomeArtifact(bytes, options);
  }

  verifyPolicyEvaluationOutcomeForEvaluation(bytes, artifact, context, options = {}) {
    return this.#binding().policy.verifyPolicyEvaluationOutcomeForEvaluation(
      bytes,
      artifact,
      context,
      options,
    );
  }

  policyContractIdentities() {
    return this.#binding().policy.policyContractIdentities();
  }

  restore(checkpoint) {
    return this.#binding().restore(checkpoint);
  }

  // MO-1308 Contract Freeze 1 §7.2, §13.2: the JCS bytes of the Standard's nine-member public Core checkpoint projection,
  // for the CLI to append. A record only, never a restore source (H14). A native investigation is rejected by the same
  // admission method the ledger applies (RECORD_INVALID), so the bytes returned are bytes that admission accepts.
  createHistoryCheckpointRecord(checkpoint) {
    const binding = this.#binding();
    const value = weakMapGet(checkpointValues, checkpoint);
    if (!value || weakMapGet(checkpointBindings, checkpoint) !== binding) historyGuardFail("USAGE", "USAGE");
    let bytes;
    try {
      bytes = new TextEncoder().encode(historyCanonicalize(JSON.parse(JSON.stringify(value))));
    } catch {
      historyGuardFail("RECORD_INVALID", "ADMISSION");
    }
    admitHistoryRecordAuthority({
      recordKind: "INVESTIGATION_CHECKPOINT",
      members: [{ name: "checkpoint.json", bytes }],
      ledger: { workspaceIdentifier: value.workspaceIdentifier, entries: [], members: new Map() },
    });
    return bytes;
  }
}

// MO-1308 Investigation History (Contract Freeze 1 §13.2): thin forwarding functions over the pure history authorities
// (memoryos-history-ledger.js and memoryos-history-admission.js). The SDK performs no file I/O (H06). `ledger` is the
// verified-ledger value returned by verifyHistoryLedger and `admission` the record returned by admitHistoryRecord;
// each is branded here when it is issued, so only values this facade issued are accepted back. The SDK checks the
// frozen argument shapes before it delegates, builds admission's ledger view from the verified ledger
// (historyLedgerView, which includes the retained READINESS_RESULT bytes Amendment A4.1 needs) and adds nothing else.
const historyLedgers = new WeakSet();
const historyAdmissions = new WeakSet();

function historyGuardFail(code, stage) {
  throw new MemoryOSHistoryError(code, stage);
}
function historyArgument(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) historyGuardFail("USAGE", "USAGE");
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    historyGuardFail("USAGE", "USAGE");
  }
  return value;
}
const isHistoryBytes = (value) => value instanceof Uint8Array && !(value.buffer instanceof SharedArrayBuffer);
function historyBytes(value) {
  if (!isHistoryBytes(value)) historyGuardFail("USAGE", "USAGE");
}
function historyByteList(value) {
  if (!Array.isArray(value) || !value.every(isHistoryBytes)) historyGuardFail("USAGE", "USAGE");
}
function historyMembers(value) {
  if (!Array.isArray(value) || value.length === 0) historyGuardFail("USAGE", "USAGE");
  for (const member of value) {
    historyArgument(member, ["name", "bytes"]);
    if (typeof member.name !== "string") historyGuardFail("USAGE", "USAGE");
    historyBytes(member.bytes);
  }
}
function historyMemberMap(value) {
  if (!(value instanceof Map)) historyGuardFail("USAGE", "USAGE");
  for (const [recordDigest, members] of value) {
    if (!isHistoryDigest(recordDigest)) historyGuardFail("USAGE", "USAGE");
    historyMembers(members);
  }
}
function historyLedger(value) {
  if (!historyLedgers.has(value)) historyGuardFail("USAGE", "USAGE");
}

export function createHistoryLedger(input) {
  const { ledgerName, workspaceIdentifier } = historyArgument(input, ["ledgerName", "workspaceIdentifier"]);
  if (!isHistoryLedgerName(ledgerName) || !isHistoryWorkspaceIdentifier(workspaceIdentifier)) historyGuardFail("USAGE", "USAGE");
  return createHistoryLedgerAuthority({ ledgerName, workspaceIdentifier });
}

export function admitHistoryRecord(input) {
  const { recordKind, members, ledger } = historyArgument(input, ["recordKind", "members", "ledger"]);
  if (!HISTORY_RECORD_KINDS.includes(recordKind)) historyGuardFail("RECORD_INVALID", "ADMISSION");
  historyMembers(members);
  historyLedger(ledger);
  const admission = admitHistoryRecordAuthority({ recordKind, members, ledger: historyLedgerView(ledger) });
  historyAdmissions.add(admission);
  return admission;
}

export function appendHistoryEntry(input) {
  const { ledger, admission } = historyArgument(input, ["ledger", "admission"]);
  historyLedger(ledger);
  if (!historyAdmissions.has(admission)) historyGuardFail("USAGE", "USAGE");
  return appendHistoryEntryAuthority({ ledger, admission });
}

export function tombstoneHistoryEntry(input) {
  const { ledger, targetIndex, reason, authorityReference } = historyArgument(input,
    ["ledger", "targetIndex", "reason", "authorityReference"]);
  if (!Number.isSafeInteger(targetIndex) || targetIndex < 0 || targetIndex > HISTORY_LIMITS.maximumIndex
      || !HISTORY_TOMBSTONE_REASONS.includes(reason) || !isHistoryAuthorityReference(authorityReference)) {
    historyGuardFail("USAGE", "USAGE");
  }
  historyLedger(ledger);
  return tombstoneHistoryEntryAuthority({ ledger, targetIndex, reason, authorityReference });
}

export function verifyHistoryLedger(input) {
  const { descriptorBytes, entries, members } = historyArgument(input, ["descriptorBytes", "entries", "members"]);
  historyBytes(descriptorBytes);
  historyByteList(entries);
  historyMemberMap(members);
  const ledger = verifyHistoryLedgerAuthority({ descriptorBytes, entries, members });
  historyLedgers.add(ledger);
  return ledger;
}

export function queryHistoryLedger(input) {
  const { descriptorBytes, entries, query } = historyArgument(input, ["descriptorBytes", "entries", "query"]);
  historyBytes(descriptorBytes);
  historyByteList(entries);
  validateHistoryQuery(query);
  return queryHistoryLedgerAuthority({ descriptorBytes, entries, query });
}

export function buildHistoryExport(input) {
  const { descriptorBytes, entries, members } = historyArgument(input, ["descriptorBytes", "entries", "members"]);
  historyBytes(descriptorBytes);
  historyByteList(entries);
  historyMemberMap(members);
  return buildHistoryExportAuthority({ descriptorBytes, entries, members });
}

export function verifyHistoryExport(input) {
  const { files } = historyArgument(input, ["files"]);
  if (!Array.isArray(files)) historyGuardFail("USAGE", "USAGE");
  for (const file of files) {
    historyArgument(file, ["path", "bytes"]);
    if (typeof file.path !== "string") historyGuardFail("USAGE", "USAGE");
    historyBytes(file.bytes);
  }
  return verifyHistoryExportAuthority({ files });
}
