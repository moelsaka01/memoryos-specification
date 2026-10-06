// MO-1308 Phase 3 shared library: failure classes and dispositions. The classes are MO-1307 Freeze section 21's (reaffirmed by
// owner decision D5): diagnose before any rerun, and never retry until pass. A disposition is a separate record about a
// preserved failed generation; it is never an edit of that generation's evidence.
import { check, closedObject, int, isDigest, nullable, oneOf, str, lit, bool } from './shape.mjs';

export const FAILURE_CLASSES = Object.freeze([
  'PRODUCT_DEFECT', 'CONTRACT_DEFECT', 'ENVIRONMENT_BLOCKER', 'HARNESS_DEFECT', 'INTERRUPTION', 'HISTORICAL_FAILURE',
]);
export const NEXT_ACTIONS = Object.freeze(['NEW_GENERATION', 'OWNER_REVIEW', 'ACCEPT_AS_QUALIFICATION', 'NONE']);

// A product defect that changes public behavior, and any contract defect, returns to owner review (CCA-ENG-2.0; D5).
export const requiresOwnerReview = (disposition) => disposition.class === 'CONTRACT_DEFECT'
  || (disposition.class === 'PRODUCT_DEFECT' && disposition.publicBehaviourChange === true);

const subject = closedObject({ step: str(1, 16), caseId: nullable(str(1, 32)) });

export const DISPOSITION_SHAPE = closedObject({
  kind: lit('MO1308Phase3Disposition'),
  version: lit('1.0.0'),
  stream: oneOf(['3A', '3B', '3C', '3D']),
  generation: str(1, 64),
  evidenceSealSha256: isDigest,
  subjects: (value, path, problems) => {
    if (!Array.isArray(value) || value.length === 0) problems.push(`${path}: expected a non-empty array`);
    else value.forEach((item, index) => subject(item, `${path}[${index}]`, problems));
  },
  class: oneOf(FAILURE_CLASSES),
  publicBehaviourChange: bool,
  diagnosis: str(1, 4000),
  nextAction: oneOf(NEXT_ACTIONS),
  ownerReviewRequired: bool,
  ownerApprovalReference: nullable(str(1, 256)),
  rerunOrdinal: nullable(int(2, 99)),
});

export function validateDisposition(value) {
  const problems = check(DISPOSITION_SHAPE, value);
  if (problems.length > 0) return problems;
  if (value.ownerReviewRequired !== requiresOwnerReview(value)) problems.push('$.ownerReviewRequired: does not match the failure class rule');
  if (value.nextAction === 'NEW_GENERATION' && value.rerunOrdinal === null) problems.push('$.rerunOrdinal: required for NEW_GENERATION');
  if (value.nextAction !== 'NEW_GENERATION' && value.rerunOrdinal !== null) problems.push('$.rerunOrdinal: only for NEW_GENERATION');
  if (value.ownerReviewRequired && value.nextAction === 'NEW_GENERATION' && value.ownerApprovalReference === null) {
    problems.push('$.ownerApprovalReference: a generation after an owner-review class needs the owner approval reference');
  }
  if (value.class === 'HISTORICAL_FAILURE' && value.nextAction === 'NEW_GENERATION') {
    problems.push('$.class: HISTORICAL_FAILURE is not a reason for a new generation');
  }
  return problems;
}
