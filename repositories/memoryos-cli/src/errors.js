export const ExitCode = Object.freeze({
  success: 0,
  invalidArguments: 1,
  validationFailure: 2,
  verificationFailure: 3,
  packageError: 4,
  sdkFailure: 5,
});

export class CliError extends Error {
  constructor(exitCode, code, message, details = []) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
    this.code = code;
    this.details = Object.freeze([...details]);
  }
}

export function argumentError(message) {
  return new CliError(
    ExitCode.invalidArguments,
    "INVALID_ARGUMENTS",
    message,
  );
}

export function validationError(message, code = "VALIDATION_FAILURE") {
  return new CliError(ExitCode.validationFailure, code, message);
}

export function packageError(message, code = "PACKAGE_ERROR") {
  return new CliError(ExitCode.packageError, code, message);
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
