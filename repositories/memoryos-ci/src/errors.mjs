import { readFileSync } from 'node:fs';
import { J } from './serialization.mjs';

export const catalog = JSON.parse(readFileSync(new URL('../contracts/errors.json', import.meta.url)));
export const projections = JSON.parse(readFileSync(new URL('../contracts/projection.json', import.meta.url))).classifications;
export class CIError extends Error {
  constructor(code, semanticCode = null) {
    super('MemoryOS CI operation rejected');
    this.code = code.startsWith('MO1306_') ? code : 'MO1306_' + code;
    if (!Object.hasOwn(catalog.errors, this.code)) throw new TypeError('Unknown machine error');
    this.semanticCode = semanticCode;
  }
}
export function reject(code, semanticCode = null) { throw new CIError(code, semanticCode); }
export function errorObject(error) {
  const known = error instanceof CIError ? error : new CIError('INTERNAL_FAILURE');
  return {code:known.code, stage:catalog.errors[known.code][2], semanticCode:known.semanticCode};
}
export function classification(error) { return catalog.errors[errorObject(error).code][0]; }
export function project(value) {
  if (typeof value !== 'string' || !Object.hasOwn(projections, value)) reject('INTERNAL_FAILURE');
  return structuredClone(projections[value].projection);
}
// Fixed prose only; never interpolate exception messages, inputs or environment.
export function diagnosticWriter(write) {
  let bytes = 0, records = 0, truncated = false;
  return (error) => {
    if (truncated) return;
    const e = errorObject(error);
    let record = {kind:'MemoryOSCICDDiagnostic', version:'1.0.0', code:e.code, stage:e.stage, message:'The requested operation could not complete.'};
    let output = J(record);
    if (records >= 31 || bytes + Buffer.byteLength(output) > 15360) {
      record = {...record, code:'MO1306_DIAGNOSTICS_TRUNCATED', stage:'INTERNAL', message:'Additional diagnostics were discarded.'};
      output = J(record); truncated = true;
    }
    bytes += Buffer.byteLength(output); records++; write(output);
  };
}
