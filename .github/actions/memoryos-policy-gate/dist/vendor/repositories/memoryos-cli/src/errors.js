export const ExitCode = Object.freeze({
  success: 0,
  invalidArguments: 1,
  validationFailure: 2,
  verificationFailure: 3,
  packageError: 4,
  sdkFailure: 5,
  policyFail: 6,
  policyCouldNotEvaluate: 7,
});

export class CliError extends Error {
  constructor(exitCode, code, message, details = [], semantic = {}) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
    this.code = code;
    this.details = Object.freeze([...details]);
    this.failureClass = semantic.failureClass ?? null;
    this.phase = semantic.phase ?? null;
    this.artifactKind = semantic.artifactKind ?? null;
    this.limitIdentifier = semantic.limitIdentifier ?? null;
  }
}

export function argumentError(message) {
  return new CliError(
    ExitCode.invalidArguments,
    "INVALID_ARGUMENTS",
    message,
    [],
    { failureClass: "usage" },
  );
}

export function validationError(message, code = "VALIDATION_FAILURE") {
  return new CliError(
    ExitCode.validationFailure,
    code,
    message,
    [],
    { failureClass: "preparation" },
  );
}

export function packageError(message, code = "PACKAGE_ERROR") {
  return new CliError(
    ExitCode.packageError,
    code,
    message,
    [],
    { failureClass: "operational" },
  );
}

export function verificationError(message, code = "VERIFICATION_FAILED", semantic = {}) {
  return new CliError(
    ExitCode.verificationFailure,
    code,
    message,
    semantic.details ?? [],
    {
      artifactKind: semantic.artifactKind ?? null,
      failureClass: "operational",
      limitIdentifier: semantic.limitIdentifier ?? null,
      phase: semantic.phase ?? null,
    },
  );
}

function sdkDiagnostics(error) {
  if (!Array.isArray(error?.diagnostics)) return [];
  return error.diagnostics.map((diagnostic) => {
    if (!diagnostic || typeof diagnostic !== "object") {
      return { code: "SDK_DIAGNOSTIC", message: String(diagnostic) };
    }
    const result = { ...diagnostic };
    if (typeof result.code !== "string") result.code = "SDK_DIAGNOSTIC";
    if (typeof result.operation !== "string" && typeof error.operation === "string") {
      result.operation = error.operation;
    }
    return result;
  });
}

export function normalizeError(error, operation = "cli") {
  if (error instanceof CliError) return error;

  if (error instanceof TypeError || error instanceof RangeError) {
    return new CliError(
      ExitCode.validationFailure,
      error.code ?? "INVALID_INPUT",
      error.message,
      sdkDiagnostics(error),
    );
  }

  if (error?.code === "ENOENT" || error?.code === "EACCES" || error?.code === "EISDIR") {
    return packageError(`Unable to access the requested file for ${operation}.`, error.code);
  }

  const sdkCode = typeof error?.code === "string" ? error.code : "SDK_FAILURE";
  const sdkOperation = typeof error?.operation === "string" ? error.operation : operation;
  const packageOperation = error?.name === "MemoryInvestigationPackageError"
    || ["import", "importPackage", "export", "exportPackage"].includes(sdkOperation);
  if (packageOperation || sdkCode === "CAPABILITY_UNAVAILABLE") {
    return new CliError(
      ExitCode.packageError,
      sdkCode,
      error?.message ?? "MemoryOS package operation failed.",
      sdkDiagnostics(error),
    );
  }

  const callerFailure = new Set([
    "INVALID_INPUT",
    "INVALID_QUERY",
    "INVALID_REGRESSION_REPORT",
    "INVALID_SELECTION",
    "TRACE_NOT_FOUND",
    "WORKSPACE_MISMATCH",
  ]).has(sdkCode);
  return new CliError(
    callerFailure ? ExitCode.validationFailure : ExitCode.sdkFailure,
    sdkCode,
    error?.message ?? "MemoryOS SDK operation failed.",
    sdkDiagnostics(error),
  );
}

export function normalizePolicyError(error, operation = "policy") {
  if (error instanceof CliError) return error;

  const details = Array.isArray(error?.details) ? error.details : sdkDiagnostics(error);
  const semantic = {
    artifactKind: error?.artifactKind ?? null,
    limitIdentifier: error?.limitIdentifier ?? null,
    phase: error?.phase ?? null,
  };
  if (operation === "policy inspect" && error?.verificationFailure === true) {
    return new CliError(
      ExitCode.validationFailure,
      typeof error?.code === "string" ? error.code : "POLICY_INSPECTION_FAILED",
      error?.message ?? "MemoryOS Policy artifact inspection failed.",
      details,
      { ...semantic, failureClass: "preparation" },
    );
  }
  if (operation.startsWith("policy verify-")
      && ["evaluationIdentity", "evaluationOutcome"].includes(error?.phase)
      && (error?.failureClass === "preparation"
        || error?.name === "MemoryOSPolicyPreparationError")) {
    return verificationError(
      error?.message ?? "MemoryOS Policy verification failed.",
      typeof error?.code === "string" ? error.code : "VERIFICATION_FAILED",
      { ...semantic, details },
    );
  }
  if (error?.failureClass === "preparation"
      || error?.name === "MemoryOSPolicyPreparationError") {
    return new CliError(
      ExitCode.validationFailure,
      typeof error?.code === "string" ? error.code : "POLICY_PREPARATION_FAILED",
      error?.message ?? "MemoryOS Policy preparation failed.",
      details,
      { ...semantic, failureClass: "preparation" },
    );
  }
  if (error?.verificationFailure === true) {
    return verificationError(
      error?.message ?? "MemoryOS Policy verification failed.",
      typeof error?.code === "string" ? error.code : "VERIFICATION_FAILED",
      { ...semantic, details },
    );
  }
  if (["ENOENT", "EACCES", "EPERM", "EISDIR", "ENOTDIR", "ENOSPC", "EPIPE"].includes(error?.code)) {
    return packageError(
      `Unable to access the requested Policy artifact for ${operation}.`,
      error.code,
    );
  }
  return new CliError(
    ExitCode.sdkFailure,
    typeof error?.code === "string" ? error.code : "POLICY_OPERATIONAL_FAILURE",
    error?.message ?? "MemoryOS Policy operation failed.",
    details,
    { ...semantic, failureClass: "operational" },
  );
}
