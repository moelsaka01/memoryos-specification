import { performance } from 'node:perf_hooks';
import { operationalError } from './errors.mjs';
import { snapshotApiInput, apiSignal } from './api-input.mjs';
import { createSupervisor } from './runtime.mjs';

async function call(input, options, verify, started) {
  let supervisor;
  try {
    const signal = apiSignal(options);
    supervisor = createSupervisor({ kind: 'api', signal, started });
    supervisor.checkpoint('LAUNCH');
    // Copy before the first await: caller mutation cannot change this call.
    const snapshot = snapshotApiInput(input, verify, stage => supervisor.checkpoint(stage));
    supervisor.checkpoint('CONFIGURATION');
    const result = await supervisor.runWorker(snapshot, { verify });
    supervisor.checkpoint('EVALUATION');
    return result;
  } catch (error) {
    if (supervisor) await supervisor.terminate(error);
    throw operationalError(error);
  } finally { if (supervisor) await supervisor.dispose(); }
}

export async function evaluateReadiness(input, options) { return call(input, options, false, performance.now()); }
export async function verifyReadiness(input, options) { return call(input, options, true, performance.now()); }
