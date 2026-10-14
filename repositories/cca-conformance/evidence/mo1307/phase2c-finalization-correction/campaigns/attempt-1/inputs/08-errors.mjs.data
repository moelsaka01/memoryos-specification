import { DEFINITIONS } from './constants.mjs';

const byCode = new Map(DEFINITIONS.errors.map(row => [row.code, row]));
const stages = new Set(['LAUNCH', 'CONFIGURATION', 'ACQUISITION', 'INTEGRITY', 'AUTHORITY', 'GRAPH', 'EVALUATION', 'VERIFICATION', 'PUBLICATION']);
const id = /^[a-z][a-z0-9._-]{0,63}$/u;

export class ReadinessError extends Error {
  constructor(code, stage, reference = null) {
    const wire = typeof code === 'string' && code.startsWith('MO1307_') ? code : `MO1307_${code}`;
    const valid = byCode.has(wire) && stages.has(stage) && (reference === null || (typeof reference === 'string' && id.test(reference)));
    super(valid ? wire : 'MO1307_INTERNAL');
    Object.defineProperties(this, {
      name: {value: 'ReadinessError'},
      code: {value: valid ? wire : 'MO1307_INTERNAL', enumerable: true},
      stage: {value: valid ? stage : 'EVALUATION', enumerable: true},
      reference: {value: valid ? reference : null, enumerable: true},
    });
  }
}

export function fail(code, stage, reference = null) { throw new ReadinessError(code, stage, reference); }
export function operationalError(error, stage = 'EVALUATION') {
  return error instanceof ReadinessError ? error : new ReadinessError('INTERNAL', stage);
}
export function errorExit(error) { return byCode.get(operationalError(error).code).exit; }
export function evaluationExit(state) {
  if (!Object.hasOwn(DEFINITIONS.evaluationExits, state)) fail('INPUT', 'EVALUATION');
  return DEFINITIONS.evaluationExits[state];
}
export function serializeError(error) {
  const e = operationalError(error);
  // Fixed key order is ASCII J order; no exception message, stack or input text.
  return Buffer.from(JSON.stringify({code:e.code,kind:'MemoryOSReadinessError',reference:e.reference,stage:e.stage,version:'1.0.0'}) + '\n', 'utf8');
}
