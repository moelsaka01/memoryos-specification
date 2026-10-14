import { regularBytes, PACKAGE_ROOT } from './integrity.mjs';
import { IntegrityError } from './errors.mjs';

export const LIMIT_NAMES = Object.freeze([
  'requestFrameBytes', 'responseFrameBytes', 'argumentsBytes', 'productBytes',
  'metadataBytes', 'requestIdCodeUnits', 'jsonStringCodeUnits', 'jsonDepth', 'jsonNodes', 'jsonMembers',
  'inputChunkBytes', 'diagnosticBytes', 'workerHeapMiB', 'workerYoungMiB', 'workerStackMiB',
  'workerExternalBytes', 'parentAttributableBytes', 'requestsPerSecond', 'controlsPerSecond',
  'partialFrameMs', 'operationMs', 'outputDrainMs', 'shutdownMs',
]);
export function validateLimits(value) {
  if (!value || value.kind !== 'MemoryOSMCPResourceLimits' || value.version !== '1.0.0' || value.status !== 'measured'
    || Object.keys(value.values ?? {}).sort().join() !== [...LIMIT_NAMES].sort().join()
    || LIMIT_NAMES.some((name) => !Number.isSafeInteger(value.values[name]) || value.values[name] < 1)
    || value.values.requestFrameBytes < value.values.argumentsBytes
    || value.values.responseFrameBytes < value.values.productBytes) throw new IntegrityError();
  return Object.freeze({ ...value.values });
}
export async function loadLimits(root = PACKAGE_ROOT) {
  try { return validateLimits(JSON.parse(await regularBytes(root, 'contracts/limits.json'))); }
  catch { throw new IntegrityError(); }
}
