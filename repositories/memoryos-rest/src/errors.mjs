/** Internal fixed-code carrier; exception prose is never a wire value. */
export class GatewayError extends Error {
  constructor(code) {
    super('Gateway operation rejected');
    this.code = code.startsWith('MO1305_') ? code : 'MO1305_' + code;
  }
}

export function reject(code) { throw new GatewayError(code); }

export function errorProduct(code, semantic = null) {
  return {status: 'error', error: {code, semantic}};
}

/** Only errors owned by the imported authoritative SDK/MIP classes qualify. */
export function projectSemanticError(error, classes) {
  const policy = error instanceof classes.MemoryOSPolicyPreparationError
    || error instanceof classes.MemoryOSPolicyOperationalError;
  const mip = error instanceof classes.MemoryInvestigationPackageError;
  if (!policy && !mip) return errorProduct('MO1305_INTERNAL_FAILURE');
  const code = mip ? error.code ?? error.diagnostics?.[0]?.code ?? 'MIP_VALIDATION_FAILED' : error.code;
  if (typeof code !== 'string' || code.length < 1 || code.length > 128 || !/^[A-Z][A-Z0-9_]*$/.test(code)) {
    return errorProduct('MO1305_INTERNAL_FAILURE');
  }
  const failureClass = mip ? 'preparation' : error.failureClass ?? null;
  if (![null, 'preparation', 'operational'].includes(failureClass)) return errorProduct('MO1305_INTERNAL_FAILURE');
  const text = (v) => typeof v === 'string' && v.length <= 128 && v.isWellFormed() ? v : null;
  return errorProduct('MO1305_SEMANTIC_REJECTED', {
    origin: 'memoryos', code,
    phase: mip ? 'evaluationInput' : text(error.phase),
    artifactKind: mip ? 'MemoryInvestigationPackage' : text(error.artifactKind),
    limitIdentifier: text(error.limitIdentifier), failureClass,
    verificationFailure: typeof error.verificationFailure === 'boolean' ? error.verificationFailure : null,
  });
}
