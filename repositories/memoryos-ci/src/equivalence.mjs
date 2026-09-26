import { J } from './serialization.mjs';
import { checkResult } from './contracts.mjs';
import { project, projections, reject } from './errors.mjs';

export const equivalenceClassifications = Object.freeze([
  'PASS', 'FAIL', 'COULD_NOT_EVALUATE', 'CONFIGURATION_ERROR', 'INPUT_ERROR',
  'INTEGRITY_ERROR', 'TIMEOUT', 'CANCELLED'
]);

// Adapter comparison is operational only; semantic bytes remain opaque and
// continue to be verified by the established bundle verifier.
export function equivalentProjection(classification, result) {
  if (!equivalenceClassifications.includes(classification) || !Object.hasOwn(projections, classification)) reject('BUNDLE_INTEGRITY');
  checkResult(result);
  return result.classification === classification && result.process.exitCode === projections[classification].exitCode && J(result.projection) === J(project(classification));
}
