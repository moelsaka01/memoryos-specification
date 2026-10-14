export const MEMORYOS_VSCODE_ADAPTER_ERROR_CODES = Object.freeze({
  CANCELLED: "MEMORYOS_VSCODE_CANCELLED",
  WORKSPACE_UNTRUSTED: "MEMORYOS_VSCODE_WORKSPACE_UNTRUSTED",
  OPERATION_IN_PROGRESS: "MEMORYOS_VSCODE_OPERATION_IN_PROGRESS",
  INPUT_REQUIRED: "MEMORYOS_VSCODE_INPUT_REQUIRED",
  INPUT_UNSUPPORTED: "MEMORYOS_VSCODE_INPUT_UNSUPPORTED",
  INPUT_LIMIT_EXCEEDED: "MEMORYOS_VSCODE_INPUT_LIMIT_EXCEEDED",
  ARTIFACT_READ_FAILED: "MEMORYOS_VSCODE_ARTIFACT_READ_FAILED",
  DISTRIBUTION_INTEGRITY_MISMATCH: "MEMORYOS_VSCODE_DISTRIBUTION_INTEGRITY_MISMATCH",
  CONTRACT_IDENTITY_MISMATCH: "MEMORYOS_VSCODE_CONTRACT_IDENTITY_MISMATCH",
  OUTPUT_INVALID: "MEMORYOS_VSCODE_OUTPUT_INVALID",
  WORKER_FAILED: "MEMORYOS_VSCODE_WORKER_FAILED",
} as const);

export type MemoryOSAdapterErrorCode =
  (typeof MEMORYOS_VSCODE_ADAPTER_ERROR_CODES)[keyof typeof MEMORYOS_VSCODE_ADAPTER_ERROR_CODES];

export const MEMORYOS_VSCODE_ADAPTER_ERROR_CODE_CATALOG = Object.freeze(
  Object.values(MEMORYOS_VSCODE_ADAPTER_ERROR_CODES),
) as readonly MemoryOSAdapterErrorCode[];

const ADAPTER_ERROR_CODE_SET: ReadonlySet<string> = new Set(
  MEMORYOS_VSCODE_ADAPTER_ERROR_CODE_CATALOG,
);
const MACHINE_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/u;

export class MemoryOSAdapterError extends Error {
  readonly code: MemoryOSAdapterErrorCode;

  constructor(code: MemoryOSAdapterErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MemoryOSAdapterError";
    this.code = code;
  }
}

export function isMemoryOSAdapterErrorCode(value: unknown): value is MemoryOSAdapterErrorCode {
  return typeof value === "string" && ADAPTER_ERROR_CODE_SET.has(value);
}

/**
 * Validate a stable code supplied by the authoritative MemoryOS CLI and
 * preserve it byte-for-byte. This deliberately does not map CLI failures to
 * extension decisions or to the extension adapter-code namespace.
 */
export function preserveMemoryOSStableCode(code: unknown): string {
  if (typeof code !== "string"
      || !MACHINE_CODE_PATTERN.test(code)
      || isMemoryOSAdapterErrorCode(code)) {
    throw new MemoryOSAdapterError(
      MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OUTPUT_INVALID,
      "The MemoryOS CLI returned an invalid stable machine code.",
    );
  }
  return code;
}

export function asMemoryOSAdapterError(
  error: unknown,
  fallbackCode: MemoryOSAdapterErrorCode = MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED,
  fallbackMessage = "The MemoryOS extension operation failed.",
): MemoryOSAdapterError {
  if (error instanceof MemoryOSAdapterError) return error;
  return new MemoryOSAdapterError(fallbackCode, fallbackMessage, { cause: error });
}
