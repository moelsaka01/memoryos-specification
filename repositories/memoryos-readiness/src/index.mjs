import { performance } from 'node:perf_hooks';
import { DEFINITIONS } from './constants.mjs';
import { fail, operationalError } from './errors.mjs';
import { inspectFoundationInputs, assertPlainFields } from './foundation.mjs';

async function foundationCall(input,options,verify) {
  const started=performance.now();
  try {
    if(options!==undefined){if(!options||typeof options!=='object')fail('INPUT','LAUNCH');const keys=Object.getOwnPropertyNames(options);if(keys.some(k=>k!=='signal'))fail('INPUT','LAUNCH');assertPlainFields(options,keys);}
    const signal=options?.signal;
    if(signal!==undefined && !(signal instanceof AbortSignal))fail('INPUT','LAUNCH');
    if(signal?.aborted)fail('CANCELLED','LAUNCH');
    inspectFoundationInputs(input,verify);
    if(performance.now()-started>=DEFINITIONS.limits.apiDeadlineMs)fail('TIMEOUT','EVALUATION');
    if(signal?.aborted)fail('CANCELLED','EVALUATION');
    // Phase 1 implements validation seams, not 2A/2B assessment or 2C orchestration.
    // A complete-looking result would falsely claim those checks ran. Fail closed
    // with the frozen operational error until later authorized implementations.
    fail('INTERNAL','EVALUATION');
  } catch(error) { throw operationalError(error); }
}

export async function evaluateReadiness(input,options) { return foundationCall(input,options,false); }
export async function verifyReadiness(input,options) { return foundationCall(input,options,true); }
