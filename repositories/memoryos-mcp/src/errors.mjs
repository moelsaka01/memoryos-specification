export const ADAPTER_CODES = Object.freeze([
  'MO1304_INVALID_TOOL_INPUT', 'MO1304_BUSY', 'MO1304_OPERATION_TIMEOUT',
  'MO1304_OUTPUT_LIMIT', 'MO1304_RUNTIME_INTEGRITY', 'MO1304_INTERNAL_FAILURE',
]);
export function adapterError(code, phase = null) {
  if (!ADAPTER_CODES.includes(code)) code = 'MO1304_INTERNAL_FAILURE';
  return { status: 'error', error: { origin: 'adapter', code, phase,
    artifactKind: null, limitIdentifier: null, failureClass: 'operational', verificationFailure: null } };
}
export class IntegrityError extends Error {
  constructor() { super('MO1304_RUNTIME_INTEGRITY'); }
}
/** Only SDK-owned error instances may enter this projection. */
export function memoryosError(error, classes) {
  if (error instanceof IntegrityError) return adapterError('MO1304_RUNTIME_INTEGRITY', 'integrity');
  const policy = error instanceof classes.MemoryOSPolicyPreparationError
    || error instanceof classes.MemoryOSPolicyOperationalError;
  const mip = error instanceof classes.MemoryInvestigationPackageError;
  if (!policy && !mip) return adapterError('MO1304_INTERNAL_FAILURE', 'delegation');
  const nullable = (value) => typeof value === 'string' && value.length <= 128 ? value : null;
  const code = mip ? error.code ?? error.diagnostics?.[0]?.code ?? 'MIP_VALIDATION_FAILED' : error.code;
  if (typeof code !== 'string' || code.length > 128 || !/^[A-Z][A-Z0-9_]*$/u.test(code)) {
    return adapterError('MO1304_INTERNAL_FAILURE', 'delegation');
  }
  return { status: 'error', error: { origin: 'memoryos', code,
    phase: mip ? 'evaluationInput' : nullable(error.phase),
    artifactKind: mip ? 'MemoryInvestigationPackage' : nullable(error.artifactKind),
    limitIdentifier: nullable(error.limitIdentifier),
    failureClass: mip ? 'preparation' : error.failureClass ?? null,
    verificationFailure: typeof error.verificationFailure === 'boolean' ? error.verificationFailure : null } };
}
