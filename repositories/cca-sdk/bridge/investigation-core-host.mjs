import { createInterface } from "node:readline";

import {
  INVESTIGATION_CORE_VERSION,
  InvestigationCore,
  InvestigationCoreError,
  projectInvestigation,
} from "../../cca-studio/web/js/investigation-core.js";
import {
  MIP_FORMAT_VERSION,
  MIP_MEDIA_TYPE,
  verifyMemoryInvestigationPackage,
} from "../../cca-studio/web/js/memory-investigation-package.js";
import { canonicalize } from "../../cca-studio/web/js/mip-canonical.js";
import {
  MemoryOSPolicyOperationalError,
  MemoryOSPolicyPreparationError,
  createMemoryOSPolicyIntegration,
} from "../../cca-studio/web/js/investigation-policy-integration.js";

const PROTOCOL_VERSION = "1.0.0";
const MAX_MESSAGE_BYTES = 64 * 1024 * 1024;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const REQUEST_MEMBERS = Object.freeze(["id", "method", "params", "version"]);

const core = new InvestigationCore();
const policy = createMemoryOSPolicyIntegration(core);
const checkpoints = new Map();
const policyFactContexts = new Map();
const regressionPolicyFactSources = new Map();
let nextPolicyCapabilityIdentifier = 0;

class BindingError extends Error {
  constructor(code, operation, message, details = {}) {
    super(message);
    this.name = "BindingError";
    this.code = code;
    this.operation = operation;
    this.diagnostics = Object.freeze([{ code, operation, message, ...details }]);
  }
}

function fail(code, operation, message, details = {}) {
  throw new BindingError(code, operation, message, details);
}

function requireObject(value, operation, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("INVALID_REQUEST", operation, `${label} must be an object.`);
  }
  return value;
}

function requireText(value, operation, label) {
  if (typeof value !== "string" || value.length === 0) {
    fail("INVALID_REQUEST", operation, `${label} must be a non-empty string.`);
  }
  return value;
}

function requireExtensions(value, operation) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    fail("INVALID_REQUEST", operation, "supportedExtensions must be an array of non-empty strings.");
  }
  return [...value].sort();
}

function decodeBytes(value, operation) {
  if (typeof value !== "string") {
    fail("INVALID_REQUEST", operation, "bytesBase64 must be a string.");
  }
  if (!BASE64.test(value)) {
    fail("INVALID_REQUEST", operation, "bytesBase64 must use canonical RFC 4648 Base64 encoding.");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) {
    fail("INVALID_REQUEST", operation, "bytesBase64 is not canonical Base64.");
  }
  return new Uint8Array(bytes);
}

function encodeBytes(value) {
  return Buffer.from(value).toString("base64");
}

function requireClosedParams(params, required, optional, operation) {
  const allowed = new Set([...required, ...optional]);
  const names = Object.keys(params);
  if (names.some((name) => !allowed.has(name))
      || required.some((name) => !Object.hasOwn(params, name))) {
    fail("INVALID_REQUEST", operation, `${operation} parameters have an invalid closed shape.`);
  }
  return params;
}

function optionalText(params, name, operation) {
  if (!Object.hasOwn(params, name)) return undefined;
  return requireText(params[name], operation, name);
}

function retainCapability(values, prefix, value) {
  const identifier = `${prefix}:${nextPolicyCapabilityIdentifier}`;
  nextPolicyCapabilityIdentifier += 1;
  values.set(identifier, value);
  return identifier;
}

function requireCapability(values, token, operation, label) {
  const identifier = requireText(token, operation, label);
  const value = values.get(identifier);
  if (value === undefined) {
    fail("CAPABILITY_NOT_FOUND", operation, `${label} is not owned by this binding instance.`);
  }
  return value;
}

function preparedPolicyResult(value) {
  return {
    artifact: value.artifact,
    bytesBase64: encodeBytes(value.toBytes()),
    documentDigest: value.documentDigest,
    identifier: value.identifier,
    kind: value.kind,
    semanticDigest: value.semanticDigest,
    semanticProjection: value.semanticProjection,
    version: value.version,
  };
}

function contextResult(value, capabilityToken = null) {
  return {
    artifact: value.artifact,
    authority: capabilityToken === null ? value.authority : "authoritative",
    bytesBase64: encodeBytes(value.toBytes()),
    capabilityToken,
    contextDigest: value.contextDigest,
    factModelVersion: value.factModelVersion,
    kind: value.kind,
    version: value.version,
  };
}

function sourceResult(value, capabilityToken = null) {
  return {
    artifact: value.artifact,
    authority: capabilityToken === null ? value.authority : "authoritative",
    bytesBase64: encodeBytes(value.toBytes()),
    capabilityToken,
    domain: value.domain,
    kind: value.kind,
    sourceDigest: value.sourceDigest,
    sourceModelVersion: value.sourceModelVersion,
    version: value.version,
  };
}

function reportInspectionResult(value) {
  return {
    artifact: value.artifact,
    authority: value.authority,
    bytesBase64: encodeBytes(value.toBytes()),
    kind: value.kind,
    reportIdentifier: value.reportIdentifier,
    version: value.version,
  };
}

function evaluationResult(value) {
  return {
    cacheDisposition: value.cacheDisposition,
    canonicalOutcomeBytesBase64: encodeBytes(value.canonicalOutcomeBytes()),
    decision: value.decision,
    evaluationIdentity: value.evaluationIdentity,
    evaluationIdentityBytesBase64: encodeBytes(value.evaluationIdentityBytes()),
    evaluationIdentityDigest: value.evaluationIdentityDigest,
    outcome: value.outcome,
    outcomeDigest: value.outcomeDigest,
  };
}

function verificationResultValue(value) {
  const result = { bytesBase64: encodeBytes(value.toBytes()) };
  for (const [name, member] of Object.entries(value)) result[name] = member;
  return result;
}

function preparedPolicyFromParams(params, operation, expectedKind = null) {
  const bytes = decodeBytes(params.artifactBytesBase64, operation);
  const kind = expectedKind ?? params.artifactKind;
  if (kind === "MemoryOSInvestigationPolicy") return policy.preparePolicy(bytes);
  if (kind === "MemoryOSInvestigationPolicySet") return policy.preparePolicySet(bytes);
  fail("INVALID_REQUEST", operation, "artifactKind is unsupported.");
}

function authoritativeInputs(params, operation) {
  const context = requireCapability(
    policyFactContexts,
    params.policyFactContextToken,
    operation,
    "policyFactContextToken",
  );
  const sourceToken = optionalText(params, "regressionPolicyFactSourceToken", operation);
  return {
    context,
    options: sourceToken === undefined ? {} : {
      regressionSource: requireCapability(
        regressionPolicyFactSources,
        sourceToken,
        operation,
        "regressionPolicyFactSourceToken",
      ),
    },
  };
}

function investigationResult(investigation) {
  return {
    investigation: projectInvestigation(investigation),
    transitionLog: {
      count: investigation.transitionLog.transitions.length,
      digest: investigation.transitionLog.digest,
    },
  };
}

function verificationResult(investigation) {
  const result = investigationResult(investigation);
  return {
    ...result,
    verification: investigation.state.verificationSession,
  };
}

function packageOptions(params, operation) {
  return { supportedExtensions: requireExtensions(params.supportedExtensions, operation) };
}

function dispatch(method, rawParams) {
  const params = requireObject(rawParams, method, "params");
  switch (method) {
  case "health":
    return {
      investigationCoreVersion: INVESTIGATION_CORE_VERSION,
      protocolVersion: PROTOCOL_VERSION,
    };
  case "observe": {
    requireObject(params.snapshot, method, "snapshot");
    const input = {
      operation: params.operation,
      query: params.query,
      resultCode: params.resultCode,
      snapshot: params.snapshot,
    };
    const investigation = params.investigationIdentifier === undefined
      ? core.create({
        ...input,
        identifier: params.identifier,
        workspaceIdentifier: requireText(params.workspaceIdentifier, method, "workspaceIdentifier"),
      })
      : core.observe(
        requireText(params.investigationIdentifier, method, "investigationIdentifier"),
        input,
      );
    return investigationResult(investigation);
  }
  case "load":
    return investigationResult(core.load(requireText(
      params.investigationIdentifier,
      method,
      "investigationIdentifier",
    )));
  case "trace":
    return investigationResult(core.trace(
      requireText(params.investigationIdentifier, method, "investigationIdentifier"),
      params.selection,
    ));
  case "replay":
    return investigationResult(core.replay(
      requireText(params.investigationIdentifier, method, "investigationIdentifier"),
      requireText(params.action, method, "action"),
    ));
  case "compare":
    requireObject(params.command, method, "command");
    return investigationResult(core.compare(
      requireText(params.investigationIdentifier, method, "investigationIdentifier"),
      params.command,
    ));
  case "regression":
    return {
      regression: core.regression(
        requireText(
          params.baselineInvestigationIdentifier,
          method,
          "baselineInvestigationIdentifier",
        ),
        requireText(
          params.candidateInvestigationIdentifier,
          method,
          "candidateInvestigationIdentifier",
        ),
      ),
    };
  case "investigate":
    return {
      investigationResult: core.investigate(
        requireObject(params.report, method, "report"),
        requireObject(params.query, method, "query"),
      ),
    };
  case "verifyInvestigation":
    return verificationResult(core.verify(requireText(
      params.investigationIdentifier,
      method,
      "investigationIdentifier",
    )));
  case "checkpoint": {
    const checkpoint = core.checkpoint(requireText(
      params.investigationIdentifier,
      method,
      "investigationIdentifier",
    ));
    checkpoints.set(checkpoint.identifier, checkpoint);
    return {
      checkpointToken: checkpoint.identifier,
      investigationIdentifier: checkpoint.investigationIdentifier,
      stateDigest: checkpoint.stateDigest,
      transitionCount: checkpoint.transitionCount,
      transitionLogDigest: checkpoint.transitionLogDigest,
      workspaceIdentifier: checkpoint.workspaceIdentifier,
    };
  }
  case "restore": {
    const checkpointToken = requireText(params.checkpointToken, method, "checkpointToken");
    const checkpoint = checkpoints.get(checkpointToken);
    if (!checkpoint) {
      fail("CHECKPOINT_NOT_FOUND", method, "The checkpoint token is not owned by this binding instance.");
    }
    return investigationResult(core.restore(checkpoint));
  }
  case "archive":
    return investigationResult(core.archive(requireText(
      params.investigationIdentifier,
      method,
      "investigationIdentifier",
    )));
  case "returnToWorld":
    return investigationResult(core.returnToWorld(requireText(
      params.investigationIdentifier,
      method,
      "investigationIdentifier",
    )));
  case "importPackage": {
    const options = packageOptions(params, method);
    if (params.identifier !== undefined) options.identifier = params.identifier;
    return investigationResult(core.import(decodeBytes(params.bytesBase64, method), options));
  }
  case "exportPackage": {
    const investigationIdentifier = requireText(
      params.investigationIdentifier,
      method,
      "investigationIdentifier",
    );
    const options = params.supportedExtensions === undefined
      ? {}
      : packageOptions(params, method);
    return {
      bytesBase64: encodeBytes(core.export(investigationIdentifier, options)),
    };
  }
  case "verifyPackage": {
    const options = packageOptions(params, method);
    const verification = verifyMemoryInvestigationPackage(
      decodeBytes(params.bytesBase64, method),
      options,
    );
    return {
      bytesBase64: verification.valid ? encodeBytes(verification.bytes) : null,
      diagnostics: verification.diagnostics,
      formatVersion: MIP_FORMAT_VERSION,
      manifest: verification.valid ? verification.package.manifest : null,
      mediaType: MIP_MEDIA_TYPE,
      valid: verification.valid,
    };
  }
  case "preparePolicy": {
    requireClosedParams(params, ["bytesBase64"], [], method);
    return preparedPolicyResult(policy.preparePolicy(decodeBytes(params.bytesBase64, method)));
  }
  case "preparePolicySet": {
    requireClosedParams(params, ["bytesBase64"], [], method);
    return preparedPolicyResult(policy.preparePolicySet(decodeBytes(params.bytesBase64, method)));
  }
  case "inspectPolicyFactContext": {
    requireClosedParams(params, ["bytesBase64"], ["expectedContextDigest"], method);
    const expectedContextDigest = optionalText(params, "expectedContextDigest", method);
    const value = policy.inspectPolicyFactContext(
      decodeBytes(params.bytesBase64, method),
      expectedContextDigest === undefined ? {} : { expectedContextDigest },
    );
    return contextResult(value);
  }
  case "inspectRegressionPolicyFactSource": {
    requireClosedParams(params, ["bytesBase64"], ["expectedSourceDigest"], method);
    const expectedSourceDigest = optionalText(params, "expectedSourceDigest", method);
    const value = policy.inspectRegressionPolicyFactSource(
      decodeBytes(params.bytesBase64, method),
      expectedSourceDigest === undefined ? {} : { expectedSourceDigest },
    );
    return sourceResult(value);
  }
  case "inspectRegressionReport": {
    requireClosedParams(params, ["bytesBase64"], [], method);
    return reportInspectionResult(policy.inspectRegressionReport(
      decodeBytes(params.bytesBase64, method),
    ));
  }
  case "capturePolicyFactContext": {
    requireClosedParams(params, ["investigationIdentifier"], [], method);
    const value = policy.capturePolicyFactContext(requireText(
      params.investigationIdentifier,
      method,
      "investigationIdentifier",
    ));
    const token = retainCapability(policyFactContexts, "policy-fact-context", value);
    return contextResult(value, token);
  }
  case "captureRegressionPolicyFacts": {
    requireClosedParams(params, [
      "baselineInvestigationIdentifier", "candidateInvestigationIdentifier",
    ], [], method);
    const value = policy.captureRegressionPolicyFacts(
      requireText(params.baselineInvestigationIdentifier, method, "baselineInvestigationIdentifier"),
      requireText(params.candidateInvestigationIdentifier, method, "candidateInvestigationIdentifier"),
    );
    const contextToken = retainCapability(
      policyFactContexts,
      "policy-fact-context",
      value.policyFactContext,
    );
    const sourceToken = retainCapability(
      regressionPolicyFactSources,
      "regression-policy-fact-source",
      value.regressionPolicyFactSource,
    );
    return {
      policyFactContext: contextResult(value.policyFactContext, contextToken),
      regressionPolicyFactSource: sourceResult(
        value.regressionPolicyFactSource,
        sourceToken,
      ),
    };
  }
  case "evaluatePolicy":
  case "evaluatePolicySet": {
    requireClosedParams(params, [
      "artifactBytesBase64", "policyFactContextToken",
    ], ["regressionPolicyFactSourceToken"], method);
    const artifact = preparedPolicyFromParams(
      params,
      method,
      method === "evaluatePolicy"
        ? "MemoryOSInvestigationPolicy" : "MemoryOSInvestigationPolicySet",
    );
    const inputs = authoritativeInputs(params, method);
    return evaluationResult(method === "evaluatePolicy"
      ? policy.evaluatePolicy(artifact, inputs.context, inputs.options)
      : policy.evaluatePolicySet(artifact, inputs.context, inputs.options));
  }
  case "verifyEvaluationIdentityArtifact": {
    requireClosedParams(params, ["bytesBase64"], ["expectedEvaluationIdentityDigest"], method);
    const expectedDigest = optionalText(params, "expectedEvaluationIdentityDigest", method);
    return verificationResultValue(policy.verifyEvaluationIdentityArtifact(
      decodeBytes(params.bytesBase64, method),
      expectedDigest,
    ));
  }
  case "verifyEvaluationIdentityForEvaluation": {
    requireClosedParams(params, [
      "artifactBytesBase64", "artifactKind", "bytesBase64", "policyFactContextToken",
    ], ["regressionPolicyFactSourceToken"], method);
    const artifact = preparedPolicyFromParams(params, method);
    const inputs = authoritativeInputs(params, method);
    return verificationResultValue(policy.verifyEvaluationIdentityForEvaluation(
      decodeBytes(params.bytesBase64, method),
      artifact,
      inputs.context,
      inputs.options,
    ));
  }
  case "verifyPolicyEvaluationOutcomeArtifact": {
    requireClosedParams(params, ["bytesBase64"], [
      "expectedEvaluationIdentityBytesBase64", "expectedEvaluationIdentityDigest",
      "expectedOutcomeDigest",
    ], method);
    const expectedIdentityBytes = Object.hasOwn(params, "expectedEvaluationIdentityBytesBase64")
      ? decodeBytes(params.expectedEvaluationIdentityBytesBase64, method) : undefined;
    const expectedIdentityDigest = optionalText(
      params,
      "expectedEvaluationIdentityDigest",
      method,
    );
    const expectedOutcomeDigest = optionalText(params, "expectedOutcomeDigest", method);
    const options = {
      ...(expectedIdentityBytes === undefined ? {} : { expectedIdentity: expectedIdentityBytes }),
      ...(expectedIdentityDigest === undefined
        ? {} : { expectedEvaluationIdentityDigest: expectedIdentityDigest }),
      ...(expectedOutcomeDigest === undefined ? {} : { expectedOutcomeDigest }),
    };
    return verificationResultValue(policy.verifyPolicyEvaluationOutcomeArtifact(
      decodeBytes(params.bytesBase64, method),
      options,
    ));
  }
  case "verifyPolicyEvaluationOutcomeForEvaluation": {
    requireClosedParams(params, [
      "artifactBytesBase64", "artifactKind", "bytesBase64", "policyFactContextToken",
    ], ["expectedOutcomeDigest", "regressionPolicyFactSourceToken"], method);
    const artifact = preparedPolicyFromParams(params, method);
    const inputs = authoritativeInputs(params, method);
    const expectedOutcomeDigest = optionalText(params, "expectedOutcomeDigest", method);
    return verificationResultValue(policy.verifyPolicyEvaluationOutcomeForEvaluation(
      decodeBytes(params.bytesBase64, method),
      artifact,
      inputs.context,
      {
        ...inputs.options,
        ...(expectedOutcomeDigest === undefined ? {} : { expectedOutcomeDigest }),
      },
    ));
  }
  case "policyContractIdentities":
    requireClosedParams(params, [], [], method);
    return { identities: policy.policyContractIdentities() };
  default:
    fail("UNKNOWN_METHOD", "binding", `Unknown private binding method '${String(method)}'.`);
  }
}

function errorValue(error, operation) {
  if (error instanceof MemoryOSPolicyPreparationError
      || error instanceof MemoryOSPolicyOperationalError) {
    return {
      artifactKind: error.artifactKind,
      code: error.code,
      details: error.details,
      diagnostics: [],
      failureClass: error.failureClass,
      limitIdentifier: error.limitIdentifier,
      message: error.message,
      operation,
      phase: error.phase,
      verificationFailure: error.verificationFailure === true,
    };
  }
  if (error instanceof InvestigationCoreError || error instanceof BindingError) {
    return {
      code: error.code,
      diagnostics: error.diagnostics,
      message: error.message,
      operation: error.operation,
    };
  }
  return {
    code: "BINDING_FAILURE",
    diagnostics: [{
      code: "BINDING_FAILURE",
      message: "The private Investigation Core binding failed.",
      operation,
    }],
    message: "The private Investigation Core binding failed.",
    operation,
  };
}

function writeResponse(value) {
  // Core public values are immutable class instances. JSON detaches their
  // enumerable public data; canonicalize then fixes the private wire order.
  const detached = JSON.parse(JSON.stringify(value));
  process.stdout.write(`${canonicalize(detached)}\n`);
}

function parseRequest(line) {
  if (Buffer.byteLength(line, "utf8") > MAX_MESSAGE_BYTES) {
    fail("RESOURCE_LIMIT_EXCEEDED", "binding", "The private binding request exceeds its resource policy.");
  }
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    fail("INVALID_REQUEST", "binding", "The private binding request is not valid JSON.");
  }
  requireObject(request, "binding", "request");
  if (canonicalize(Object.keys(request).sort()) !== canonicalize(REQUEST_MEMBERS)) {
    fail("INVALID_REQUEST", "binding", "The private binding request must have the exact protocol shape.");
  }
  if (request.version !== PROTOCOL_VERSION) {
    fail("UNSUPPORTED_PROTOCOL", "binding", `Unsupported private binding protocol '${String(request.version)}'.`);
  }
  if (!Number.isSafeInteger(request.id) || request.id < 0) {
    fail("INVALID_REQUEST", "binding", "The request id must be a non-negative safe integer.");
  }
  requireText(request.method, "binding", "method");
  requireObject(request.params, request.method, "params");
  return request;
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });

for await (const line of input) {
  let id = null;
  let operation = "binding";
  try {
    const request = parseRequest(line);
    id = request.id;
    operation = request.method;
    writeResponse({
      id,
      ok: true,
      result: dispatch(request.method, request.params),
      version: PROTOCOL_VERSION,
    });
  } catch (error) {
    writeResponse({
      error: errorValue(error, operation),
      id,
      ok: false,
      version: PROTOCOL_VERSION,
    });
  }
}
